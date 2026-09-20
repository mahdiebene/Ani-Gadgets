#!/bin/bash
# Read-only deployment checks; never prints password values.
set -euo pipefail
compose=(docker compose -f /opt/anigadgets/deploy/compose.yml)
# Integration tests require a disposable, owner-provisioned database, not production.
# Even rolled-back test inserts advance sequences; catalogue tests also need owner access.
"${compose[@]}" run --rm --no-deps -e TEST_DATABASE=0 ingest node --test
"${compose[@]}" exec -T api node - <<'NODE'
const assert = require('node:assert/strict');
const { createPool } = require('./src/db/pool');
(async () => {
  const pool = createPool();
  try {
    assert.equal((await pool.query('SELECT current_user AS role')).rows[0].role, 'anigadgets_reader');
    await assert.rejects(pool.query('UPDATE products SET is_available = false WHERE false'),
      error => ['42501', '25006'].includes(error.code));
    const get = async path => {
      const response = await fetch(`http://127.0.0.1:3001${path}`, { signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, 200, `${path} must be healthy`);
      return response.json();
    };
    const health = await get('/health');
    assert.equal(health.status, 'ok');
    assert.equal(health.ingestion.status, 'ok');
    const first = await get('/api/products?limit=3');
    const second = await get('/api/products?limit=3&offset=3');
    assert.ok(first.pagination.total >= 100, 'First ingestion must provide at least 100 available products');
    assert.equal(first.data.length, 3);
    assert.equal(second.data.length, 3);
    assert.equal(first.data.some(a => second.data.some(b => a.id === b.id)), false);
    for (const product of first.data) {
      assert.ok(product.price > 0 && product.image_url && product.anime_name);
      assert.ok(Number.isInteger(product.units_sold) && product.units_sold >= 0);
      assert.equal(new URL(product.product_url).hostname, 'www.daraz.com.bd');
    }
    const stats = (await get('/api/stats')).data;
    assert.equal(stats.totalProducts, first.pagination.total);
    const categories = (await get('/api/products/meta/categories')).data;
    const anime = (await get('/api/products/meta/anime')).data;
    assert.ok(categories.includes(first.data[0].category));
    assert.ok(anime.includes(first.data[0].anime_name));
    console.log(`Verified read-only credentials, health, pagination, stats and metadata: ${stats.totalProducts} available products.`);
  } finally { await pool.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
NODE
curl --fail-with-body --silent --show-error --max-time 10 http://127.0.0.1:18083/health
echo
systemctl list-timers 'anigadgets-*' --no-pager