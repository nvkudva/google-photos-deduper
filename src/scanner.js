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
    fromMs = null, // inclusive, oldest end of the range
    toMs = null,   // exclusive, newest end of the range
  } = {}) {
    const problems = sel.selfCheck();
    if (problems.length) throw new Error('Google Photos UI changed: ' + problems.join('; '));

    const scroller = sel.findScroller();

    const ranged = fromMs != null || toMs != null;
    const inRange = (ts) =>
      !ranged || (ts != null && (fromMs == null || ts >= fromMs) && (toMs == null || ts < toMs));

    // The main library grid is strictly newest-first, which is what lets a
    // ranged scan skip ahead and stop early. Album views are not, so there the
    // range is only a filter and the whole album still gets walked.
    const ordered = !document.querySelector('a[href*="/documents/"]');

    // Jumping the scroller straight to an offset renders that part of the grid,
    // so the newer edge of the range is found by bisecting it rather than
    // walking to it. Measured on a real library: the main scroller is ~3.1M
    // pixels tall, about 2,100 screenfuls, so a linear skip to a two-year-old
    // photo takes minutes. Bisection gets there in roughly a dozen probes.
    async function seekTo(targetMs, tick) {
      const probe = async () => {
        for (let i = 0; i < 8; i++) {
          await sleep(300);
          const ts = tileTimes();
          if (ts.length) return Math.max(...ts);
        }
        return null; // nothing rendered here
      };
      let lo = 0; // newest end of the bracket
      let hi = 1; // oldest end
      for (let i = 0; i < 18; i++) {
        const travel = scroller.scrollHeight - scroller.clientHeight;
        if (travel <= 0 || (hi - lo) * travel < scroller.clientHeight) break;
        scroller.scrollTop = Math.round(((lo + hi) / 2) * travel);
        const newest = await probe();
        if (newest == null) return false; // fall back to walking
        if (newest >= targetMs) lo = (lo + hi) / 2;
        else hi = (lo + hi) / 2;
        tick(newest);
      }
      // Land a little newer than the boundary. The sequential walk only ever
      // moves older, so overshooting drops photos instead of scanning them.
      const travel = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = Math.max(0, Math.round(lo * travel) - scroller.clientHeight * 2);
      await sleep(650);
      return true;
    }

    const tileTimes = () =>
      sel.liveTiles().map((a) => { const t = sel.readTile(a); return t ? t.ts : null; }).filter(Boolean);

    // Drop rows whose hash came from a flat crop, so this pass hashes those
    // photos properly instead of leaving them permanently unmatched. Only
    // inside the range - this run will never revisit anything outside it.
    const poisoned = (await store.allItems())
      .filter((i) => hash.degenerate(i.hash) && inRange(i.ts))
      .map((i) => i.id);
    if (poisoned.length) await store.remove(poisoned);

    const known = await store.knownIds();
    const seenThisRun = new Set();

    let added = 0;
    let skipped = 0; // crops rejected as flat - see hash.degenerate
    let sanityChecked = false;
    let idleRounds = 0;
    let lastTop = -1;
    // Skip forward, without hashing, until the newest end of the range is on
    // screen; then stop once the grid has run older than the far end.
    let seeking = ranged && ordered && toMs != null;
    let pastRounds = 0;

    const harvest = async () => {
      const fresh = sel.liveTiles().filter((a) => {
        const t = sel.readTile(a);
        return t && inRange(t.ts) && !known.has(t.id) && !seenThisRun.has(t.id);
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
      skipped += cand.length - rows.length;
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

    if (seeking) {
      onProgress({ seeking: true, scanned: known.size, added });
      await seekTo(toMs, (newest) =>
        onProgress({ seeking: true, seekAt: newest, scanned: known.size, added })
      );
    }

    while (!shouldStop()) {
      if (document.hidden) {
        onProgress({ stalled: true, scanned: known.size, added });
        await sleep(1500);
        continue;
      }

      if (seeking) {
        const ts = tileTimes();
        const atEnd = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 4;
        // Leave the skip as soon as the boundary row is anywhere on screen, so
        // hashing starts a screenful early rather than exactly on the edge -
        // a tile straddling the viewport edge is rejected by croppable().
        if (!ts.length || Math.min(...ts) < toMs || (atEnd && scroller.scrollTop === lastTop)) {
          seeking = false;
        } else {
          onProgress({ seeking: true, scanned: known.size, added });
          lastTop = scroller.scrollTop;
          scroller.scrollTop += scroller.clientHeight;
          await sleep(300);
          continue;
        }
      }

      if ((await harvest()) === -1) {
        onProgress({ stalled: true, scanned: known.size, added });
        await sleep(1500);
        continue;
      }
      onProgress({
        scanned: known.size,
        added,
        skipped,
        // Scroll position is meaningless as progress for a ranged scan: a
        // 2016-only pass would finish at 30%.
        pct: ranged ? null : Math.min(100, Math.round((scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight)) * 100)),
      });

      // The cap is per run. known.size counts the whole store, so comparing
      // against it would end a second scan before it started.
      if (added >= maxItems) break;

      if (ordered && fromMs != null) {
        const ts = tileTimes();
        if (ts.length && Math.max(...ts) < fromMs) {
          if (++pastRounds >= 3) break;
        } else {
          pastRounds = 0;
        }
      }

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

    await store.setMeta('lastScan', { at: Date.now(), scanned: known.size, skipped });
    return { scanned: known.size, added, skipped };
  }

  window.GPDD.scanner = { scan };
})();
