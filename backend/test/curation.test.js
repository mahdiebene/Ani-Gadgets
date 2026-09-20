const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { validateDocument } = require('../src/catalogue/validation');
const { createDemo } = require('../src/catalogue/demo');
const { compareOffers } = require('../src/catalogue/comparison');
const { createApp } = require('../src/app');
const { fakeDatabase } = require('./helpers');

test('100 fictional identities validate without database or external requests', () => {
  const data = validateDocument(createDemo());
  assert.equal(data.products.length, 100);
  assert.equal(data.observations.length, 200);
  assert.ok(data.products.every(p => p.is_demo));
});

test('CLI defaults to database-free validation and rejects unsafe command combinations', () => {
  const cli = path.resolve(__dirname, '../src/catalogue/cli.js');
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/nope', CATALOGUE_ALLOW_DEMO: '' } });
  assert.equal(run(['--demo']).status, 0);
  assert.match(run(['--demo', '--dry-run']).stdout, /no database connection/);
  for (const args of [[], ['--wrong'], ['--demo', '--apply', '--dry-run'], ['--file'], ['--file', 'relative.json'], ['--demo', '--apply']]) assert.notEqual(run(args).status, 0);
});

test('curation rejects unknown fields, unsafe URLs, unreviewed publication and bad prices/dates', () => {
  for (const mutate of [
    d => { d.products = null; },
    d => { d.products[0].image_url = 'https://example.test/image'; },
    d => { d.products[0].identity_reference_url = 'javascript:alert(1)'; },
    d => { d.products[0].identity_reference_url = 'https://user:pass@example.test'; },
    d => { d.products[0].reviewed = false; },
    d => { d.products[0].published = null; },
    d => { d.products[0].reviewed = 'true'; },
    d => { d.products.push(d.products[0]); },
    d => { d.observations[0].full_price = -1; },
    d => { d.observations[0].full_price = 1.234; },
    d => { d.observations[0].full_price = 1.00001; },
    d => { d.observations[0].full_price = null; },
    d => { d.observations[0].deposit_amount = 1e10; },
    d => { d.observations[0].currency = 'bdt'; },
    d => { d.observations[0].observed_at = '2999-01-01T00:00:00Z'; },
    d => { d.observations[0].expires_at = '2000-01-01T00:00:00Z'; },
    d => { d.observations[0].observed_at = '2026-02-30T00:00:00Z'; },
    d => { d.observations[0].delivery_destination = null; },
    d => { d.observations.push(d.observations[0]); },
    d => { d.mode = 'observations'; }
  ]) {
    const doc = createDemo(Date.now(), 1); mutate(doc);
    assert.throws(() => validateDocument(doc), /Invalid catalogue/);
  }
});

const complete = (overrides = {}) => ({
  id: 1, catalogue_product_id: 1, listing_url: 'https://example.test/1', observed_at: '2026-01-01T00:00:00Z', expires_at: '2026-01-03T00:00:00Z',
  currency: 'BDT', price_kind: 'full', full_price: 1000, shipping_amount: 50, tax_amount: 0, fee_amount: 0,
  ships_to_bangladesh: true, delivery_destination: 'Dhaka', condition: 'new', included_parts: 'All', purchase_route: 'local', availability: 'in_stock', ...overrides
});
const now = Date.parse('2026-01-02T00:00:00Z');
test('complete totals use equivalent groups and preserve zero costs', () => {
  const offers = compareOffers([complete(), complete({ id: 2, full_price: 1200 }), complete({ id: 3, condition: 'used', full_price: 500 })], now);
  assert.equal(offers[0].landed_total, 1050);
  assert.equal(offers[0].lowest_complete_total, true);
  assert.equal(offers[1].lowest_complete_total, false);
  assert.equal(offers[2].lowest_complete_total, false);
  assert.equal(compareOffers([complete()], now)[0].lowest_complete_total, false);
  for (const difference of [{ delivery_destination: 'Chattogram' }, { included_parts: 'Missing stand' }, { purchase_route: 'proxy' }, { catalogue_product_id: 2 }]) {
    assert.ok(compareOffers([complete(), complete(difference)], now).every(o => !o.lowest_complete_total));
  }
});
test('deposits, missing costs, stale stock, foreign currencies and unknown eligibility cannot win', () => {
  for (const change of [{ price_kind: 'deposit' }, { shipping_amount: null }, { tax_amount: null }, { currency: 'USD' },
    { observed_at: '2999-01-01' }, { expires_at: null }, { expires_at: '2025-01-01' }, { ships_to_bangladesh: null },
    { included_parts: null }, { availability: 'preorder' }, { listing_url: 'javascript:alert(1)' }]) {
    const row = compareOffers([complete(change)], now)[0];
    assert.equal(row.landed_total, null); assert.equal(row.lowest_complete_total, false); assert.ok(row.comparison_reasons.length);
  }
});
test('catalogue API is read-only, validates inputs and handles unavailable/missing records', async t => {
  const calls = [];
  const app = createApp({ db: fakeDatabase(), catalogue: {
    list: async args => { calls.push(args); return { products: [], total: 0 }; },
    detail: async id => id === 1 ? { product: { id: 1, identity_reference_url: 'javascript:x' }, offers: [complete()], history: [], evidence: [] } : null
  }, logger: { error() {} } });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { app.locals.close(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/catalogue`;
  assert.equal((await fetch(`${base}?search[]=x`)).status, 400);
  assert.equal((await fetch(`${base}?offset=-1`)).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await fetch(`${base}?search=Naruto&limit=10000`)).status, 200);
  assert.equal(calls[0].limit, 100);
  assert.equal((await fetch(`${base}/2`)).status, 404);
  assert.equal((await fetch(`${base}/abc`)).status, 400);
  assert.equal((await fetch(base, { method: 'POST' })).status, 404);
  const response = await fetch(`${base}/1`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).data.product.identity_reference_url, null);
});

test('disabled and failing catalogues return explicit errors without database detail leaks', async t => {
  for (const catalogue of [undefined, { list: async () => { throw new Error('private database details'); } }]) {
    const app = createApp({ db: fakeDatabase(), catalogue, logger: { error() {} } });
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/catalogue`);
      assert.equal(response.status, catalogue ? 500 : 503);
      assert.equal((await response.text()).includes('private database details'), false);
    } finally { app.locals.close(); await new Promise(resolve => server.close(resolve)); }
  }
});