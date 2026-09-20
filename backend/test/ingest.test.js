const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchAnime } = require('../src/ingest/animeMatcher');
const { normalizeItem, parseCount } = require('../src/ingest/normalize');
const { createDarazClient, parseCatalog } = require('../src/ingest/darazClient');
const { runIngest, readConfig } = require('../src/ingest/run');
const { fakeDatabase, listing } = require('./helpers');

test('matcher rejects substring collisions, short names and ambiguous ordinary words', () => {
  for (const name of ['LED lamp', 'silver bracelet', 'dragon toy', 'power bank', 'bond glue', 'law book', 'L figure', 'bleach cleaner']) {
    assert.equal(matchAnime(name), null, name);
  }
  for (const [name, anime] of [
    ['Death Note L figure', 'Death Note'], ['Gon anime figure', 'Hunter x Hunter'],
    ['GOJO keychain', 'Jujutsu Kaisen'], ['Dragon-Ball Z figure', 'Dragon Ball'],
    ['Power Chainsaw Man figure', 'Chainsaw Man'], ['Pokémon plush', 'Pokemon'], ['anime lamp', 'Anime']
  ]) assert.equal(matchAnime(name).name, anime);
});

test('normalizer handles live Daraz strings, URLs, sold counts and stock correctly', () => {
  const row = normalizeItem(listing(), 'anime figure', '2026-09-20T00:00:00.000Z');
  assert.equal(row.price, 450);
  assert.equal(row.units_sold, 424);
  assert.equal(row.product_url, 'https://www.daraz.com.bd/products/naruto-i123456.html');
  assert.equal(row.image_url, 'https://static-01.daraz.com.bd/p/naruto.jpg');
  assert.equal(row.anime_name, 'Naruto');
  assert.equal(row.discount_percent, 50);
  assert.equal(row.category, 'Figures');
  assert.equal(row.daraz_item_id, '123456');
  assert.equal(normalizeItem(listing({ inStock: false }), 'anime').is_available, false);
  assert.equal(normalizeItem(listing({ inStock: 'false' }), 'anime').in_stock, false);
  assert.equal(normalizeItem(listing({ inStock: undefined }), 'anime').in_stock, null);
  assert.equal(normalizeItem(listing({ name: 'plain lamp' }), 'anime'), null);
  for (const [value, count] of [['1.2K sold', 1200], ['1,424 sold', 1424], ['2M+ sold', 2000000], [undefined, 0]]) {
    assert.equal(parseCount(value), count);
  }
  assert.throws(() => parseCount('many sold'));
  for (const bad of [{ price: 0 }, { image: 'javascript:alert(1)' }, { itemUrl: 'https://evil.com/products/a' }, { itemId: 'NaN' }]) {
    assert.throws(() => normalizeItem(listing(bad), 'anime'));
  }
});

const catalog = (page, total = 2, items = [listing()]) => ({
  mainInfo: { totalResults: String(total), pageSize: '1', page: String(page) }, mods: { listItems: items }
});
const response = data => ({ headers: { 'content-type': 'application/json' }, data });

test('catalog parser detects malformed, challenged, inconsistent and repeated-page responses', () => {
  assert.throws(() => parseCatalog({}, 1));
  assert.throws(() => parseCatalog(catalog(1, 10, []), 1), /anti-bot/);
  assert.throws(() => parseCatalog(catalog(1), 2));
  assert.equal(parseCatalog(catalog(1, 0, []), 1).complete, true);
});

test('Daraz client paginates, delays, retries transient errors and obeys its request cap', async () => {
  let attempts = 0;
  const delays = [];
  const client = createDarazClient({ delayMs: 1000, wait: async ms => delays.push(ms), request: async (url, options) => {
    if (++attempts === 1) throw Object.assign(new Error('timeout'), { isAxiosError: true });
    return response(catalog(options.params.page));
  } });
  const result = await client.search('anime', 5);
  assert.equal(result.items.length, 2);
  assert.equal(result.complete, true);
  assert.equal(client.requests, 3);
  assert.deepEqual(delays, [2000, 1000]);
  const capped = createDarazClient({ maxRequests: 1, request: async () => response(catalog(1)) });
  assert.equal((await capped.search('anime', 5)).complete, false);
  assert.equal(capped.requests, 1);
  await assert.rejects(capped.fetchPage('anime', 2), /budget/);
});

test('Daraz non-JSON and permanent errors fail immediately without retrying', async () => {
  let attempts = 0;
  const client = createDarazClient({ request: async () => { attempts++; return { headers: { 'content-type': 'text/html' }, data: '<html>' }; } });
  await assert.rejects(client.search('anime'), /non-JSON/);
  assert.equal(attempts, 1);
});

const config = { ...readConfig({}), minProducts: 1 };
const logger = { info() {} };
const clientWith = (items, complete = true) => ({ requests: 1, search: async () => ({ items, complete }) });

test('ingestion deduplicates, preserves first-seen/owner and only reconciles after writes', async () => {
  const firstSeen = '2025-01-01T00:00:00.000Z';
  const db = fakeDatabase(call => call.method === 'findExisting' ? [{
    product_url: 'https://www.daraz.com.bd/products/naruto-i123456.html',
    first_seen_at: firstSeen, times_seen: 3, search_keyword: 'Naruto figure'
  }] : []);
  const { rows } = await runIngest({ db, config, logger, keywords: ['anime'], client: clientWith([listing(), listing()]) });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].first_seen_at, firstSeen);
  assert.equal(rows[0].times_seen, 4);
  assert.equal(rows[0].search_keyword, 'Naruto figure');
  assert.ok(rows[0].intelligent_score > 45);
  assert.equal(rows[0].score_breakdown.freshness.score, 0);
  assert.deepEqual(db.calls.map(c => c.method), ['transaction', 'findExisting', 'upsertProducts', 'retireMissing']);
  assert.deepEqual(db.calls[3].args[0], ['anime']);
});

test('capped scope cannot retire unseen rows, and age alone never hides products', async () => {
  const db = fakeDatabase();
  await runIngest({ db, config, logger, keywords: ['anime'], client: clientWith([listing()], false) });
  assert.equal(db.calls.some(c => c.method === 'retireMissing'), false);
});

test('fetch/normalization/minimum-count failures make no writes', async () => {
  for (const client of [
    { search: async () => { throw new Error('challenge'); } }, clientWith([]), clientWith([listing({ price: 'bad' })])
  ]) {
    const db = fakeDatabase();
    await assert.rejects(runIngest({ db, config, logger, keywords: ['anime'], client }));
    assert.equal(db.calls.length, 0);
  }
});

test('failed upsert prevents unavailable cleanup and rejects the run', async () => {
  const db = fakeDatabase(call => { if (call.method === 'upsertProducts') throw new Error('write failed'); return []; });
  await assert.rejects(runIngest({ db, config, logger, keywords: ['anime'], client: clientWith([listing()]) }), /write failed/);
  assert.equal(db.calls.some(c => c.method === 'retireMissing'), false);
});

test('dry-run requires no credentials and environment limits reject invalid values', async () => {
  const { summary } = await runIngest({ dryRun: true, config, logger, keywords: ['anime'], client: clientWith([listing()]) });
  assert.equal(summary.products, 1);
  assert.equal(summary.reconciledScopes, 0);
  assert.throws(() => readConfig({ INGEST_MAX_REQUESTS: '-1' }));
  assert.throws(() => readConfig({ SCRAPE_DELAY_MS: '0' }));
});