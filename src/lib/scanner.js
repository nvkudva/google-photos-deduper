// The library is read through the same batchexecute RPC the page uses to fill
// its timeline (lcxiM), 500 items a request, newest first, with a page token
// for the next request. The request and item shapes are from
// xob0t/Google-Photos-Toolkit (MIT), verified live before use. Each item carries its media key, dedup key, capture
// time and a thumbnail base URL. The thumbnails are then fetched at 32px with
// the session cookies (the host answers a credentialed cross-origin fetch with
// real bytes; only the cookieless and crossOrigin="anonymous" routes get a
// placeholder) and hashed here. Nothing is scrolled or screenshotted, and the
// tab does not need to be visible.
//
// Measured: 500 items per listing request in ~1s. A thumbnail takes the server
// ~250ms (recent photo) to ~600ms (old, cold) regardless of size or how many
// are in flight, so throughput is concurrency-bound: ~100/s at 64 in flight,
// ~150/s at 128, and worse again at 256. 10,000 photos ran in 96s at 64.
window.GPDD = window.GPDD || {};

(() => {
  const { hash, store } = window.GPDD;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const RPC_LIST = 'lcxiM'; // [pageId, startTs, pageSize, null, 1, source] -> [items, nextPageId, oldestTs]
  const PAGE = 500;
  const SOURCE_LIBRARY = 1; // 2 archive, 3 both
  const DURATION_KEY = '76647426'; // in the item's trailing object; present only for videos
  const IN_FLIGHT = 128;
  const MIN_IN_FLIGHT = 8;
  const HASH_SIZE = '=w32-h32'; // fit inside, aspect kept - what dHash expects
  const THUMB_SIZE = '=w192-h192-no'; // what the results panel shows

  function parseItem(it) {
    if (!Array.isArray(it) || typeof it[0] !== 'string' || !Array.isArray(it[1]) || typeof it[1][0] !== 'string') return null;
    const ext = it[it.length - 1];
    const isVideo = !!(ext && typeof ext === 'object' && !Array.isArray(ext) && ext[DURATION_KEY]);
    const ts = typeof it[2] === 'number' ? it[2] : null;
    return {
      id: it[0],
      base: it[1][0],
      dedup: typeof it[3] === 'string' ? it[3] : null,
      ts,
      day: ts != null ? new Date(ts).toISOString().slice(0, 10) : 'unknown',
      kind: isVideo ? 'Video' : 'Photo',
    };
  }

  async function listPage(api, pageId, startTs) {
    const [p] = await api.batch(RPC_LIST, [[pageId, startTs, PAGE, null, 1, SOURCE_LIBRARY]]);
    if (!p || !Array.isArray(p[0])) throw new Error('the library listing came back in an unexpected shape');
    return { items: p[0].map(parseItem).filter(Boolean), next: p[1] || null, oldestTs: Number(p[2]) || null };
  }

  async function fetchHash(base) {
    const res = await fetch(base + HASH_SIZE, { credentials: 'include' });
    if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`got ${blob.type || 'no'} content`);
    return hash.dhashBlob(blob);
  }

  async function scan({
    maxItems = Infinity,
    onProgress = () => {},
    shouldStop = () => false,
    fromMs = null, // inclusive, oldest end of the range
    toMs = null,   // exclusive, newest end of the range
  } = {}) {
    const { api } = window.GPDD;
    const known = await store.knownIds();
    const stats = { startedAt: Date.now(), pages: 0, fetched: 0, failed: 0, throttled: 0, hashMs: 0 };
    let added = 0;
    let skipped = 0; // thumbnails that could not be fetched or hashed
    let stoppedEarly = false;
    const startTs = toMs != null ? toMs - 1 : null;
    let newestTs = null;

    const report = (oldestTs) => {
      let pct = null;
      if (oldestTs != null && newestTs != null) {
        const floor = fromMs != null ? fromMs : null;
        if (floor != null && newestTs > floor) pct = Math.min(100, Math.round(((newestTs - oldestTs) / (newestTs - floor)) * 100));
      }
      onProgress({ scanned: known.size, added, skipped, pct });
    };

    // Rate limiting shows as 429 (or 503) on the thumbnail host. The first one
    // in a burst halves the number in flight and pauses every worker, doubling
    // the pause on each further burst up to a minute. A long clean stretch
    // grows the concurrency back a quarter at a time.
    let allowed = IN_FLIGHT;
    let pausedUntil = 0;
    let backoffMs = 5000;
    let clean = 0;
    const throttled = (status) => {
      if (Date.now() < pausedUntil) return; // already backing off for this burst
      allowed = Math.max(MIN_IN_FLIGHT, allowed >> 1);
      pausedUntil = Date.now() + backoffMs;
      stats.throttled++;
      onProgress({ log: `Google answered ${status}: pausing ${backoffMs / 1000}s, then ${allowed} at a time` });
      backoffMs = Math.min(60000, backoffMs * 2);
      clean = 0;
    };
    const succeeded = () => {
      if (++clean < 2000 || allowed >= IN_FLIGHT) return;
      allowed = Math.min(IN_FLIGHT, allowed + (allowed >> 2));
      backoffMs = 5000;
      clean = 0;
    };

    // The next listing request is in flight while this page's thumbnails are
    // fetched, so the ~1s a listing takes is not paid per page.
    const twice = (id) => listPage(api, id, startTs).catch(() => sleep(3000).then(() => listPage(api, id, startTs)));
    let ahead = twice(null);
    while (true) {
      if (shouldStop()) { stoppedEarly = true; break; }
      const page = await ahead;
      stats.pages++;
      ahead = page.next ? twice(page.next) : null;
      if (newestTs == null && page.items.length) newestTs = page.items[0].ts;

      const wanted = page.items.filter((it) =>
        !known.has(it.id) && (fromMs == null || it.ts == null || it.ts >= fromMs) && (toMs == null || it.ts == null || it.ts < toMs)
      ).slice(0, Math.max(0, maxItems - added));

      const rows = [];
      let idx = 0;
      const t0 = performance.now();
      await Promise.all(Array.from({ length: IN_FLIGHT }, async (_, k) => {
        while (idx < wanted.length && !shouldStop()) {
          if (k >= allowed) { await sleep(1000); continue; }
          const wait = pausedUntil - Date.now();
          if (wait > 0) { await sleep(wait); continue; }
          const it = wanted[idx++];
          let h = null;
          let ok = false;
          for (let attempt = 0, limited = 0; attempt < 2 && limited < 8 && !ok; ) {
            try { h = await fetchHash(it.base); ok = true; succeeded(); }
            catch (e) {
              if (e.status === 429 || e.status === 503) { limited++; throttled(e.status); await sleep(Math.max(0, pausedUntil - Date.now())); }
              else if (++attempt < 2) await sleep(500);
            }
          }
          if (!ok) { skipped++; stats.failed++; continue; }
          stats.fetched++;
          rows.push({ id: it.id, kind: it.kind, ts: it.ts, day: it.day, thumb: it.base + THUMB_SIZE, hash: h });
        }
      }));
      stats.hashMs += performance.now() - t0;

      if (rows.length) {
        await store.putMany(rows);
        rows.forEach((r) => known.add(r.id));
        added += rows.length;
      }
      report(page.oldestTs);

      if (added >= maxItems) break;
      if (fromMs != null && page.oldestTs != null && page.oldestTs < fromMs) break;
      if (!ahead) break;
    }

    if (ahead) ahead.catch(() => {}); // a prefetch abandoned by an early exit

    stats.elapsedMs = Date.now() - stats.startedAt;
    stats.perSecond = stats.elapsedMs ? +((added / stats.elapsedMs) * 1000).toFixed(2) : 0;
    await store.setMeta('lastScan', { at: Date.now(), scanned: known.size, skipped, stats });
    return { scanned: known.size, added, skipped, stoppedEarly, stats };
  }

  window.GPDD.scanner = { scan };
})();
