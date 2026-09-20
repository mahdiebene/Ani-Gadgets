import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWishlistStore, WISHLIST_STORAGE_KEY } from '../src/utils/wishlist.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { assert.equal(key, WISHLIST_STORAGE_KEY); value = next; } };
}

test('saving synchronizes subscribers and survives a new store (reload)', () => {
  const storage = memoryStorage();
  const store = createWishlistStore({ storage: () => storage });
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  store.toggle('listing:1');
  assert.deepEqual(store.getSnapshot(), ['listing:1']);
  assert.equal(store.getSnapshot(), store.getSnapshot());
  assert.equal(changes, 1);
  const reloaded = createWishlistStore({ storage: () => storage });
  assert.deepEqual(reloaded.getSnapshot(), ['listing:1']);
  store.toggle('listing:1');
  assert.deepEqual(store.getSnapshot(), []);
  unsubscribe();
});

test('malformed saved values are ignored and only stable listing IDs persist', () => {
  for (const raw of ['bad json', '{}', 'null']) {
    assert.deepEqual(createWishlistStore({ storage: () => memoryStorage(raw) }).getSnapshot(), []);
  }
  const store = createWishlistStore({ storage: () => memoryStorage('["listing:1","listing:1",42,"url:bad"]') });
  assert.deepEqual(store.getSnapshot(), ['listing:1']);
  store.toggle(null);
  store.toggle('url:bad');
  assert.deepEqual(store.getSnapshot(), ['listing:1']);
});

test('storage failures retain session saves even after resubscription', () => {
  for (const storage of [() => { throw new Error('denied'); }, () => ({
    getItem: () => '[]', setItem: () => { throw new Error('quota'); }
  })]) {
    const store = createWishlistStore({ storage });
    store.toggle('listing:2');
    const unsubscribe = store.subscribe(() => {});
    assert.deepEqual(store.getSnapshot(), ['listing:2']);
    unsubscribe();
  }
});

test('cross-tab saves and storage clearing synchronize while unrelated events are ignored', () => {
  const storage = memoryStorage();
  const target = new EventTarget();
  const store = createWishlistStore({ storage: () => storage, eventTarget: target });
  const unsubscribe = store.subscribe(() => {});
  function notify(key) { target.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: storage })); }
  storage.setItem(WISHLIST_STORAGE_KEY, '["listing:9"]');
  notify('unrelated');
  assert.deepEqual(store.getSnapshot(), []);
  notify(WISHLIST_STORAGE_KEY);
  assert.deepEqual(store.getSnapshot(), ['listing:9']);
  storage.setItem(WISHLIST_STORAGE_KEY, null);
  notify(null);
  assert.deepEqual(store.getSnapshot(), []);
  unsubscribe();
});