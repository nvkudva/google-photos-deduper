// Virtualisation-aware harvester.
// Measured: ~130 tiles live in the DOM at a time, ~108 dropped per 6000px of
// scroll. Tiles that scroll past are gone, so each one is hashed and
// checkpointed to IndexedDB while it is on screen. The walk is never repeated.
//
// Hashing crops a screenshot of the viewport, so a tile only counts when it is
// wholly visible. The scroll step is deliberately smaller than a viewport to
// give every row a fully-visible moment.
window.GPDD = window.GPDD || {};

(() => {
  const { sel, hash, store } = window.GPDD;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function scan({
    maxItems = Infinity,
    onProgress = () => {},
    shouldStop = () => false,
    blockedRect = () => null,
    hideChrome = async (fn) => fn(),
  } = {}) {
    const problems = sel.selfCheck();
    if (problems.length) throw new Error('Google Photos UI changed: ' + problems.join('; '));

    const scroller = sel.findScroller();

    // Drop rows whose hash came from a flat crop, so this pass hashes those
    // photos properly instead of leaving them permanently unmatched.
    const poisoned = (await store.allItems()).filter((i) => hash.degenerate(i.hash)).map((i) => i.id);
    if (poisoned.length) await store.remove(poisoned);

    const known = await store.knownIds();
    const seenThisRun = new Set();

    let added = 0;
    let sanityChecked = false;
    let idleRounds = 0;
    let lastTop = -1;

    const harvest = async () => {
      const fresh = sel.liveTiles().filter((a) => {
        const t = sel.readTile(a);
        return t && !known.has(t.id) && !seenThisRun.has(t.id);
      });
      if (!fresh.length) return 0;

      // Only tiles whose thumbnail has actually painted: an unpainted tile
      // crops to a flat rectangle, which is worse than not hashing it at all.
      const painted = fresh.filter((a) => sel.thumbUrl(a));
      const cand = hash.croppable(painted, blockedRect()).slice(0, 120);
      if (!cand.length) return 0;

      // Rects are re-read inside the hidden-chrome window so the screenshot and
      // the crop boxes describe the same frame.
      const res = await hideChrome(async () => {
        const rects = cand.map(({ a }) => {
          const r = a.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        });
        return hash.hashRects(rects);
      });
      // A backgrounded tab cannot be captured. That is a pause, not a failure.
      if (res.inactive) return -1;
      const hashes = res.hashes;

      const rows = [];
      cand.forEach(({ a }, i) => {
        // A tile is only marked seen once it actually has a hash. Crops that
        // fell outside the captured frame stay unmarked so a later scroll
        // position gets another go at them, instead of being lost for the run.
        if (!hashes[i]) return;
        const t = sel.readTile(a);
        if (!t) return;
        seenThisRun.add(t.id);
        known.add(t.id);
        rows.push({ id: t.id, kind: t.kind, ts: t.ts, day: t.day, thumb: t.thumb, hash: hashes[i] });
      });
      if (!rows.length) return 0;

      if (!sanityChecked && rows.length >= 6) {
        const got = rows.map((r) => r.hash).filter(Boolean);
        if (got.length < 3) throw new Error('the screen capture could not be read - check the extension has permission for this page');
        if (new Set(got).size < 2) throw new Error('every tile hashed identically - the capture is probably blank');
        sanityChecked = true;
      }

      await store.putMany(rows);
      added += rows.length;
      return rows.length;
    };

    while (!shouldStop()) {
      if (document.hidden) {
        onProgress({ stalled: true, scanned: known.size, added });
        await sleep(1500);
        continue;
      }

      if ((await harvest()) === -1) {
        onProgress({ stalled: true, scanned: known.size, added });
        await sleep(1500);
        continue;
      }
      onProgress({
        scanned: known.size,
        added,
        pct: Math.min(100, Math.round((scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)) * 100)),
      });

      if (known.size >= maxItems) break;

      const atBottom = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 4;
      if (atBottom && scroller.scrollTop === lastTop) {
        if (++idleRounds >= 3) break;
      } else {
        idleRounds = 0;
      }
      lastTop = scroller.scrollTop;

      scroller.scrollTop += Math.round(scroller.clientHeight * 0.6);
      // Google Photos renders on rAF; let the new rows paint before capturing.
      await sleep(650);
    }

    await store.setMeta('lastScan', { at: Date.now(), scanned: known.size });
    return { scanned: known.size, added };
  }

  window.GPDD.scanner = { scan };
})();
