export const WISHLIST_STORAGE_KEY = 'anigadgets:wishlist:v1';
const EMPTY = Object.freeze([]);

function parseSaved(raw) {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? [...new Set(value.filter(key => typeof key === 'string' && /^listing:[1-9]\d*$/.test(key)))].sort()
      : [];
  } catch {
    return [];
  }
}

// An external store keeps all cards synchronized without per-card localStorage writes.
// In private/blocked storage environments, saving still works for this session.
export function createWishlistStore({ storage = () => globalThis.localStorage, eventTarget = globalThis.window } = {}) {
  let snapshot = EMPTY;
  let initialized = false;
  let sessionOnly = false;
  const listeners = new Set();

  function replace(next) {
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = Object.freeze(next);
    listeners.forEach(listener => listener());
  }

  function read() {
    if (sessionOnly) return;
    try {
      const target = storage();
      if (target) replace(parseSaved(target.getItem(WISHLIST_STORAGE_KEY)));
    } catch { /* Preserve in-memory state if storage is blocked. */ }
  }

  function onStorage(event) {
    if (event.key !== null && event.key !== WISHLIST_STORAGE_KEY) return;
    try {
      if (event.storageArea && event.storageArea !== storage()) return;
    } catch { return; }
    read();
  }

  return {
    getSnapshot() {
      if (!initialized) { initialized = true; read(); }
      return snapshot;
    },
    getServerSnapshot: () => EMPTY,
    subscribe(listener) {
      if (listeners.size === 0) {
        initialized = true;
        read();
        eventTarget?.addEventListener('storage', onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) eventTarget?.removeEventListener('storage', onStorage);
      };
    },
    toggle(key) {
      if (typeof key !== 'string' || !/^listing:[1-9]\d*$/.test(key)) return;
      if (!initialized) { initialized = true; read(); }
      const next = snapshot.includes(key) ? snapshot.filter(item => item !== key) : [...snapshot, key].sort();
      try { storage()?.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next)); } catch { sessionOnly = true; }
      replace(next);
    }
  };
}

export const wishlistStore = createWishlistStore();