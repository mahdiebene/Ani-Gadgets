const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');
const { createRateLimiter } = require('../src/middleware/rateLimit');
const { fakeDatabase } = require('./helpers');

async function serve(t, db, options = {}) {
  const app = createApp({ db, logger: { error() {} }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    app.locals.close();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, init) => {
    const response = await fetch(`${base}${path}`, init);
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
}

test('products cap limits, report totals, and paginate with a stable tie-breaker', async t => {
  const db = fakeDatabase(() => ({ products: [{ id: 101 }], total: 350 }));
  const get = await serve(t, db);
  const result = await get('/api/products?limit=10000&offset=100');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pagination, { total: 350, limit: 100, offset: 100 });
  assert.equal(db.calls[0].args[0].offset, 100);
  assert.equal(db.calls[0].args[0].limit, 100);
});

test('malformed filters are client errors without issuing database queries', async t => {
  const db = fakeDatabase();
  const get = await serve(t, db);
  for (const query of ['limit=-1', 'limit=0', 'limit=NaN', 'limit=1.5', 'offset=-1', 'minScore=0),id.gt.0', 'minPrice=abc', 'minPrice=500&maxPrice=10', 'search[]=x']) {
    assert.equal((await get(`/api/products?${query}`)).status, 400, query);
  }
  assert.equal(db.calls.length, 0);
});

test('search punctuation is passed as full-text data, never an or-filter expression', async t => {
  const db = fakeDatabase();
  const get = await serve(t, db);
  const search = 'Naruto, (figure) "quoted" \\ %';
  assert.equal((await get(`/api/products?search=${encodeURIComponent(search)}`)).status, 200);
  assert.equal(db.calls[0].method, 'listProducts');
  assert.equal(db.calls[0].args[0].search, search);
});

test('source metadata and filters use real database data and reject malformed inputs', async t => {
  const db = fakeDatabase(call => call.method === 'metadata'
    ? { sources: ['daraz', 'Example partner'] } : { products: [], total: 0 });
  const get = await serve(t, db);
  assert.deepEqual((await get('/api/products/meta/sources')).body.data, ['daraz', 'Example partner']);
  assert.equal((await get('/api/products?source=Example%20partner')).status, 200);
  assert.equal(db.calls[1].args[0].source, 'Example partner');
  const before = db.calls.length;
  for (const value of ['source[]=daraz', `source=${'a'.repeat(51)}`]) {
    assert.equal((await get(`/api/products?${value}`)).status, 400);
  }
  assert.equal(db.calls.length, before);
});

test('metadata and stats use aggregates and the shared threshold', async t => {
  const categories = Array.from({ length: 1100 }, (_, i) => `Category ${i}`);
  const db = fakeDatabase(call => call.method === 'metadata' ? { categories, anime: ['Naruto'] } : { totalProducts: 12000 });
  const get = await serve(t, db);
  assert.equal((await get('/api/products/meta/categories')).body.data.length, 1100);
  assert.deepEqual((await get('/api/products/meta/anime')).body.data, ['Naruto']);
  assert.equal((await get('/api/stats')).body.data.totalProducts, 12000);
  assert.deepEqual(db.calls.map(c => c.method), ['metadata', 'metadata', 'stats']);
  assert.deepEqual(db.calls[2].args, [45]);
});

test('database failures never become healthy empty stats or leak details', async t => {
  const db = fakeDatabase(() => { throw Object.assign(new Error('secret postgres relation / connection details'), { status: 400 }); });
  const get = await serve(t, db);
  for (const path of ['/api/products', '/api/products/meta/anime', '/api/products/1', '/api/anime', '/api/stats']) {
    const result = await get(path);
    assert.equal(result.status, 500, path);
    assert.equal(JSON.stringify(result.body).includes('secret'), false);
    assert.equal(result.body.success, false);
  }
  const health = await get('/health');
  assert.equal(health.status, 503);
  assert.equal(health.body.database, 'unreachable');
});

test('health distinguishes fresh, stale and empty databases without changing rows', async t => {
  let newest = new Date().toISOString();
  const db = fakeDatabase(() => newest);
  const get = await serve(t, db);
  assert.equal((await get('/health')).status, 200);
  newest = '2020-01-01T00:00:00Z';
  const stale = await get('/health');
  assert.equal(stale.status, 503);
  assert.equal(stale.body.ingestion.status, 'stale');
  newest = null;
  const empty = await get('/health');
  assert.equal(empty.status, 503);
  assert.equal(empty.body.database, 'ok');
  assert.equal(empty.body.ingestion.status, 'empty');
  assert.equal(db.calls.every(c => c.method === 'lastUpdated'), true);
});

test('missing records and unknown endpoints return 404; bad IDs return 400', async t => {
  const get = await serve(t, fakeDatabase(() => null));
  for (const path of ['/api/products/123', '/api/anime/123', '/unknown']) assert.equal((await get(path)).status, 404);
  assert.equal((await get('/api/products/not-a-number')).status, 400);
});

test('MAL product lookup uses canonical anime_name rather than unpopulated anime_id', async t => {
  const db = fakeDatabase(call => call.method === 'getAnime' ? { title: 'Shingeki no Kyojin', title_english: 'Attack on Titan' } : { products: [], total: 0 });
  const get = await serve(t, db);
  assert.equal((await get('/api/anime/16498/products?limit=1000')).status, 200);
  assert.deepEqual(db.calls[1].args[0], { anime: 'Attack on Titan', limit: 100, offset: 0 });
});

test('CORS allows exact origins and rejects suffix tricks and unrelated previews', async t => {
  const get = await serve(t, fakeDatabase());
  const good = await get('/', { headers: { Origin: 'https://anigadgetsbd.app' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://anigadgetsbd.app');
  for (const origin of ['https://evil-anigadgetsbd.app', 'https://evil.vercel.app', 'https://anigadgetsbd.app.evil.com']) {
    assert.equal((await get('/', { headers: { Origin: origin } })).status, 403);
  }
});

test('forwarded IPs are ignored by default and one-hop trust uses only the nearest forwarded IP', async t => {
  const previous = process.env.TRUST_PROXY;
  t.after(() => {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });
  delete process.env.TRUST_PROXY;
  const direct = await serve(t, fakeDatabase(), { rateLimitOptions: { max: 1 } });
  assert.equal((await direct('/api/products', { headers: { 'X-Forwarded-For': '192.0.2.1' } })).status, 200);
  assert.equal((await direct('/api/products', { headers: { 'X-Forwarded-For': '192.0.2.2' } })).status, 429);

  process.env.TRUST_PROXY = '1';
  const proxied = await serve(t, fakeDatabase(), { rateLimitOptions: { max: 1 } });
  assert.equal((await proxied('/api/products', { headers: { 'X-Forwarded-For': '192.0.2.1, 198.51.100.1' } })).status, 200);
  assert.equal((await proxied('/api/products', { headers: { 'X-Forwarded-For': '192.0.2.2, 198.51.100.1' } })).status, 429);
  assert.equal((await proxied('/api/products', { headers: { 'X-Forwarded-For': '198.51.100.2' } })).status, 200);
});

test('rate limiter prunes expired IPs and bounds memory without evicting active clients', () => {
  let time = 0;
  const limiter = createRateLimiter({ max: 1, maxEntries: 2, windowMs: 1000, now: () => time });
  let passed = 0;
  let status;
  const res = { set() {}, status(value) { status = value; return this; }, json() {} };
  const hit = ip => limiter.middleware({ ip }, res, () => passed++);
  try {
    hit('a'); hit('a');
    assert.equal(status, 429);
    hit('b'); hit('c');
    assert.equal(passed, 2);
    assert.equal(limiter.entries.size, 2);
    time = 1001;
    limiter.prune();
    assert.equal(limiter.entries.size, 0);
    hit('c');
    assert.equal(passed, 3);
  } finally { limiter.close(); }
});