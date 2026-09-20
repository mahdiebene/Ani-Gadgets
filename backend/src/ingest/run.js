const { generateBDSearchKeywords } = require('../config/bdAnimeConfig');
const { createDarazClient } = require('./darazClient');
const { normalizeItem } = require('./normalize');
const { calculateIntelligentTrendingScore } = require('../services/intelligentScorerService');

function envInteger(env, key, fallback, min, max) {
  if (env[key] === undefined || env[key] === '') return fallback;
  const value = Number(env[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}: expected ${min}..${max}`);
  return value;
}

function readConfig(env = process.env) {
  return {
    delayMs: envInteger(env, 'SCRAPE_DELAY_MS', 3000, 1000, 60000),
    maxRequests: envInteger(env, 'INGEST_MAX_REQUESTS', 100, 1, 500),
    maxKeywords: envInteger(env, 'INGEST_MAX_KEYWORDS', 25, 1, 200),
    maxPages: envInteger(env, 'INGEST_MAX_PAGES', 2, 1, 10),
    maxProducts: envInteger(env, 'INGEST_MAX_PRODUCTS', 1000, 1, 10000),
    minProducts: envInteger(env, 'INGEST_MIN_PRODUCTS', 100, 1, 10000)
  };
}

async function runIngest({ db, client, config = readConfig(), keywords, dryRun = false, logger = console, now = new Date().toISOString() } = {}) {
  if (config.minProducts > config.maxProducts) throw new Error('INGEST_MIN_PRODUCTS exceeds INGEST_MAX_PRODUCTS');
  if (!dryRun && !db) throw new Error('Ingestion requires a writable PostgreSQL repository');
  client ||= createDarazClient(config);
  keywords ||= generateBDSearchKeywords().slice(0, config.maxKeywords);
  const products = new Map();
  const completedScopes = [];
  let truncated = false;
  // Gather and validate before ANY database writes. A challenge must never erase data.
  for (const keyword of keywords) {
    if (client.exhausted) { truncated = true; break; }
    const term = typeof keyword === 'string' ? keyword : keyword.term;
    const result = await client.search(term, config.maxPages);
    let scopeComplete = result.complete;
    for (const item of result.items) {
      const row = normalizeItem(item, term, now);
      if (!row) continue;
      if (!products.has(row.product_url) && products.size >= config.maxProducts) {
        truncated = true;
        scopeComplete = false;
        break;
      }
      if (!products.has(row.product_url)) products.set(row.product_url, row);
    }
    if (scopeComplete) completedScopes.push(term);
    logger.info(`${term}: ${result.items.length} listings (${scopeComplete ? 'complete' : 'capped'})`);
    if (truncated) break;
  }
  if (products.size < config.minProducts) {
    throw new Error(`Only ${products.size} valid anime products; minimum is ${config.minProducts}. No database changes made.`);
  }
  const rows = [...products.values()];
  const save = async store => {
    for (let offset = 0; offset < rows.length; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      let previous = new Map();
      if (!dryRun) {
        const existing = await store.findExisting(batch.map(row => row.product_url));
        previous = new Map(existing.map(row => [row.product_url, row]));
      }
      for (const row of batch) {
        const old = previous.get(row.product_url);
        row.first_seen_at = old?.first_seen_at || old?.created_at || now;
        row.times_seen = (old?.times_seen || 0) + 1;
        // Keep a stable owning search scope for safe unavailable reconciliation.
        row.search_keyword = old?.search_keyword || row.search_keyword;
        const score = calculateIntelligentTrendingScore(row);
        Object.assign(row, {
          intelligent_score: score.totalScore, trending_score: score.totalScore,
          trending_status: score.trendingStatus, trending_label: score.trendingLabel,
          score_breakdown: { ...score.breakdown, penalties: score.penalties },
          score_explanation: score.explanation, score_version: 3
        });
      }
      if (!dryRun) await store.upsertProducts(batch);
    }
    // Only fully enumerated scopes may hide missing rows; never use an age-based purge.
    // If any read/upsert fails above, this block is not reached.
    if (!dryRun && !truncated && completedScopes.length) {
      await store.retireMissing(completedScopes, now);
    }
  };
  // One transaction: a failed batch/cleanup rolls back the entire run.
  if (dryRun) await save(null);
  else await db.transaction(save);
  const summary = { dryRun, products: rows.length, requests: client.requests, truncated,
    reconciledScopes: dryRun || truncated ? 0 : completedScopes.length };
  logger.info(JSON.stringify(summary));
  return { summary, rows };
}

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--dry-run')) throw new Error('Usage: npm run ingest -- [--dry-run]');
    const dryRun = args.includes('--dry-run');
    const pool = dryRun ? null : require('../db/pool').createPool();
    const db = pool ? require('../db/repository').createRepository(pool) : null;
    try { await runIngest({ db, dryRun }); }
    finally { if (pool) await pool.end(); }
  })().catch(error => {
    // Avoid logging Axios request objects/headers or any database credentials.
    console.error('Ingestion failed:', error.code || error.message);
    process.exitCode = 1;
  });
}

module.exports = { runIngest, readConfig };