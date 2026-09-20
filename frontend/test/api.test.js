import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts } from '../src/utils/api.js';

test('pagination reads API pagination.total and requests the second page offset', async t => {
  let requested;
  t.mock.method(globalThis, 'fetch', async url => {
    requested = url;
    return new Response(JSON.stringify({ data: [{ id: 21 }], pagination: { limit: 20, offset: 20, total: 101 } }));
  });
  const result = await fetchProducts({ page: 2, limit: 20 });
  assert.equal(result.total, 101);
  assert.equal(result.totalPages, 6);
  assert.equal(result.currentPage, 2);
  assert.match(requested, /offset=20/);
});

test('zero totals remain zero rather than falling back to another count', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: [], pagination: { total: 0 }, count: 42 })));
  assert.equal((await fetchProducts()).total, 0);
});

test('API failures reject instead of returning an empty products array', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 500 }));
  await assert.rejects(fetchProducts(), error => error.status === 500);
});