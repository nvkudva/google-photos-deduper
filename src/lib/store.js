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

  async function putMany(items) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(ITEMS, 'readwrite');
      const os = t.objectStore(ITEMS);
      items.forEach((i) => os.put(i));
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
  }

  async function allItems() {
    const db = await open();
    return new Promise((res, rej) => {
      const out = [];
      const t = db.transaction(ITEMS, 'readonly');
      const cur = t.objectStore(ITEMS).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res(out);
        out.push(c.value);
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
  }

  async function knownIds() {
    const db = await open();
    return new Promise((res, rej) => {
      const s = new Set();
      const t = db.transaction(ITEMS, 'readonly');
      const cur = t.objectStore(ITEMS).openKeyCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res(s);
        s.add(c.key);
        c.continue();
      };
      cur.onerror = () => rej(cur.error);
    });
  }

  const count = () => tx(ITEMS, 'readonly', (os) => os.count());
  const remove = (ids) => tx(ITEMS, 'readwrite', (os) => ids.forEach((i) => os.delete(i)));
  const clear = () => tx(ITEMS, 'readwrite', (os) => os.clear());
  const getMeta = (k) => tx(META, 'readonly', (os) => os.get(k));
  const setMeta = (k, v) => tx(META, 'readwrite', (os) => os.put(v, k));

  window.GPDD.store = { putMany, allItems, knownIds, count, remove, clear, getMeta, setMeta };
})();
