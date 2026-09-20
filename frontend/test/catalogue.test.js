import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateBdt, lowestTotal, readTarget, saveTarget } from '../src/utils/catalogue.js';
import { createWishlistStore } from '../src/utils/wishlist.js';

test('manual FX estimate needs all amounts, a positive rate and timestamp', () => {
  assert.equal(estimateBdt([10, 2, 0, 0], 120, '2026-01-01'), 1440);
  for (const args of [[[10, null, 0, 0], 120, '2026-01-01'], [[10, 0, 0, 0], 0, '2026-01-01'], [[10, 0, 0, 0], 120, '2999-01-01'], [[10, 0, 0, 0], 120, '']]) assert.equal(estimateBdt(...args), null);
});
test('targets tolerate blocked storage, persist and can be cleared', () => {
  const values = new Map(); const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  assert.equal(saveTarget(1, '1500', storage), true); assert.equal(readTarget(1, storage), '1500');
  assert.equal(saveTarget(1, '', storage), true); assert.equal(readTarget(1, storage), '');
  assert.equal(saveTarget(1, '-1', storage), false);
  assert.equal(saveTarget(1, '100', { setItem() { throw new Error(); } }), false);
  assert.equal(readTarget(1, storage), '100', 'blocked saves remain for this session');
  assert.equal(lowestTotal([{ fresh: true, expires_at: '2999-01-01', landed_total: 1500 }, { fresh: false, landed_total: 100 }, { fresh: true, landed_total: null }]), 1500);
  assert.equal(lowestTotal([{ fresh: true, expires_at: '2000-01-01', landed_total: 100 }]), null);
});
test('catalogue and legacy saved IDs are separate, persistent namespaces', () => {
  const values = new Map(); const storage = () => ({ getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) });
  const store = createWishlistStore({ storage }); store.toggle('catalogue:1'); store.toggle('listing:1');
  assert.deepEqual(createWishlistStore({ storage }).getSnapshot(), ['catalogue:1', 'listing:1']);
  store.toggle('catalogue:1'); assert.deepEqual(store.getSnapshot(), ['listing:1']);
});