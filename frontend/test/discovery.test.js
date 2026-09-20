import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, formatRelativeTime } from '../src/utils/helpers.js';
import { purchaseLink, sourceLabel, listingKey } from '../src/utils/listings.js';
import { createBrowseFilters, nextBrowseNavigation } from '../src/utils/browse.js';

test('unknown prices never look free and PostgreSQL numeric strings format correctly', () => {
  for (const price of [null, undefined, '', ' ', 'unknown', NaN, Infinity, -1, false]) {
    assert.equal(formatPrice(price), 'Price unknown');
  }
  assert.equal(formatPrice(0), '৳0');
  assert.equal(formatPrice('1250.50'), '৳1,250.5');
});

test('missing, malformed and future observations are not labelled just seen', () => {
  for (const date of [null, undefined, '', 'bad-date', '2999-01-01']) assert.equal(formatRelativeTime(date), 'Unknown');
  assert.equal(formatRelativeTime(new Date().toISOString()), 'Just now');
});

test('purchase links use the source, seller or host and reject unsafe URLs', () => {
  assert.equal(purchaseLink({ source: 'daraz', product_url: 'https://www.daraz.com.bd/products/1' }).label, 'View on Daraz');
  assert.equal(purchaseLink({ source: 'Example partner', product_url: 'https://example.test/figure' }).label, 'View on Example partner');
  assert.equal(purchaseLink({ seller_name: 'Example seller', product_url: 'https://example.test/figure' }).label, 'View on Example seller');
  assert.equal(purchaseLink({ product_url: 'https://example.test/figure' }).label, 'View on example.test');
  for (const product_url of [undefined, '/relative', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.test']) {
    assert.equal(purchaseLink({ product_url }), null);
  }
  assert.equal(sourceLabel(null), 'Unknown source');
  assert.equal(listingKey({ id: 12 }), 'listing:12');
  assert.equal(listingKey({ id: null }), null);
});

test('each submitted search/category navigation resets browse state, including repeated searches', () => {
  const first = nextBrowseNavigation({ revision: 1 }, { search: '  Naruto figure  ' });
  assert.equal(first.search, 'Naruto figure');
  const repeated = nextBrowseNavigation({ ...first, category: 'Figures', source: 'daraz', maxPrice: 500 }, { search: first.search });
  assert.equal(repeated.revision, 3);
  assert.deepEqual(createBrowseFilters(repeated), {
    search: 'Naruto figure', category: '', anime: '', source: '', minPrice: '', maxPrice: '', sortBy: 'intelligent_score', sortOrder: 'desc'
  });
  assert.equal(nextBrowseNavigation(repeated, { category: 'Figures' }).search, '');
});