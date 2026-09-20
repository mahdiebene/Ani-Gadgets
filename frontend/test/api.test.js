import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts, fetchSources, fetchCatalogue, fetchCatalogueProduct } from '../src/utils/api.js';

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

test('search and source survive URL encoding and below-threshold listings stay discoverable', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url, 'https://example.test').searchParams;
    assert.equal(params.get('source'), 'Example & partner');
    assert.equal(params.get('search'), 'Naruto figure');
    assert.equal(params.get('minScore'), '0');
    return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }));
  });
  await fetchProducts({ source: 'Example & partner', search: 'Naruto figure' });
});

test('source metadata uses the source endpoint', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, '/api/products/meta/sources');
    return new Response(JSON.stringify({ data: ['daraz'] }));
  });
  assert.deepEqual(await fetchSources(), ['daraz']);
});

test('obsolete requests receive the abort signal and remain distinguishable from errors', async t => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.signal, controller.signal);
    throw new DOMException('Aborted', 'AbortError');
  });
  await assert.rejects(fetchProducts({}, { signal: controller.signal }), error => error.name === 'AbortError');
});

test('catalogue pagination encodes literal search/category and forwards cancellation', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const request = new URL(url, 'https://example.test');
    assert.equal(request.pathname, '/api/catalogue');
    assert.equal(request.searchParams.get('search'), 'A & B');
    assert.equal(request.searchParams.get('category'), 'Manga');
    assert.equal(request.searchParams.get('offset'), '40');
    assert.equal(options.signal, controller.signal);
    return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }));
  });
  assert.equal((await fetchCatalogue({ search: 'A & B', category: 'Manga', page: 3 }, { signal: controller.signal })).pagination.total, 0);
});

test('catalogue detail exposes missing/unavailable errors rather than success-shaped empty data', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }));
  await assert.rejects(fetchCatalogueProduct(99), error => error.status === 404);
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(fetchCatalogueProduct(1), error => error.name === 'AbortError');
});