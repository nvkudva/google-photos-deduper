// IndexedDB, not chrome.storage.local: a ~100k-item library overruns the 10MB quota.
window.GPDD = window.GPDD || {};

(() => {
  const DB = 'gpdd';
  const ITEMS = 'items';
  const META = 'meta';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(ITEMS)) {
          const os = db.createObjectStore(ITEMS, { keyPath: 'id' });
          os.createIndex('day', 'day');
          os.createIndex('hash', 'hash');
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }

  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  };

  // Walks every row of the items store, resolving when the cursor runs out.
  const walk = async (openCursor, visit) => {
    const db = await open();
    return new Promise((res, rej) => {
      const cur = openCursor(db.transaction(ITEMS, 'readonly').objectStore(ITEMS));
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res();
        visit(c);
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
  };

  const putMany = (items) => tx(ITEMS, 'readwrite', (os) => items.forEach((i) => os.put(i)));

  async function allItems() {
    const out = [];
    await walk((os) => os.openCursor(), (c) => out.push(c.value));
    return out;
  }

  async function knownIds() {
    const s = new Set();
    await walk((os) => os.openKeyCursor(), (c) => s.add(c.key));
    return s;
  }

  const count = () => tx(ITEMS, 'readonly', (os) => os.count());
  const remove = (ids) => tx(ITEMS, 'readwrite', (os) => ids.forEach((i) => os.delete(i)));
  const clear = () => tx(ITEMS, 'readwrite', (os) => os.clear());
  const setMeta = (k, v) => tx(META, 'readwrite', (os) => os.put(v, k));

  window.GPDD.store = { putMany, allItems, knownIds, count, remove, clear, setMeta };
})();
