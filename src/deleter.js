// Google Photos' jsaction handlers ignore untrusted events: element.click() and
// full synthetic PointerEvent/MouseEvent sequences were both verified to do
// nothing, including on the always-visible "Clear selection" button. Real input
// therefore has to come from the DevTools protocol, which is why the extension
// asks for the "debugger" permission.
//
// Deletion opens each photo's own detail view rather than hunting for its tile
// in the grid. The grid walk that came before had to scroll past the whole
// library to find scattered targets: measured at 166s to cover 334k of 2.58M
// pixels, about 19 minutes a pass no matter how many photos were being deleted.
// A detail view is reached directly from the photo id, so the cost is per
// target instead of per library, and there is no selection to get out of sync.
//
// The SPA routes off history state: replaceState to /photo/<id> plus a popstate
// puts that photo on screen in 41-433ms without a page load, and without
// growing the history the user's back button walks.
window.GPDD = window.GPDD || {};

(() => {
  const { sel, store } = window.GPDD;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const bg = (type, payload = {}) =>
    new Promise((res, rej) => {
      chrome.runtime.sendMessage({ type, ...payload }, (r) => {
        if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
        if (r && r.error) return rej(new Error(r.error));
        res(r);
      });
    });

  const clickAt = (rect) =>
    bg('cdpClick', { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) });

  // Nothing in the grid is clicked any more, so the overlay cannot swallow a
  // click the way it did when tiles were the target: the toolbar button this
  // dispatches to sits at the top of the screen, clear of the panel.
  async function clickElement(el) {
    const rect = sel.buttonRect(el); // re-read immediately before dispatch
    if (!rect) return false;
    await clickAt(rect);
    return true;
  }

  // Which photo the detail view is actually showing. The carousel keeps the
  // previous and next photos mounted at full size too, so "a photo is on
  // screen" is not enough - and neither is "a Move to bin button exists",
  // which survives the navigation unchanged (measured: it reported ready in
  // 1ms, before the view had switched at all). The element carrying
  // data-media-key that covers the viewport centre is the current one:
  // verified over six photos, correct every time, 0-433ms after the popstate.
  const centreKey = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let best = null;
    for (const el of document.querySelectorAll('[data-media-key]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 300 || r.height < 300) continue;
      if (r.left > cx || r.right < cx || r.top > cy || r.bottom < cy) continue;
      const area = r.width * r.height;
      // Smallest box enclosing the centre - the containers nest.
      if (!best || area < best.area) best = { key: el.getAttribute('data-media-key'), area };
    }
    return best && best.key;
  };

  const navigate = (id) => {
    history.replaceState({}, '', '/photo/' + id);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // This is an identity check, not a change check: it asks whether the photo on
  // screen is the one we mean to bin, so landing on it instantly is a pass, and
  // a view that never commits is a skip rather than a click on someone else.
  async function showPhoto(id, shouldStop) {
    navigate(id);
    for (let waited = 0; waited < 8000; waited += 40) {
      if (shouldStop()) return false;
      if (centreKey() === id) return true;
      await sleep(40);
    }
    return false;
  }

  // More than one node carries this aria-label and querySelector returns a
  // zero-sized hidden one, so take the first that is really on screen.
  function visibleBin() {
    for (const b of document.querySelectorAll(sel.S.moveToBin)) {
      if (sel.buttonRect(b)) return b;
    }
    return null;
  }

  async function run({
    targetIds, dryRun = true, onProgress = () => {}, shouldStop = () => false,
  }) {
    const targets = new Set(targetIds);
    const log = (m) => onProgress({ log: m });
    const home = location.pathname + location.search;
    const deleted = [];
    let wouldDelete = 0;
    const missed = [];

    if (!dryRun) await bg('attach');
    try {
      for (const id of [...targets]) {
        if (shouldStop()) break;

        // Same constraint as the scan: Google Photos stops rendering while the
        // tab is hidden, so there is nothing to click. Say so rather than
        // sitting on "Deleting..." while nothing happens.
        while (document.hidden && !shouldStop()) {
          onProgress({ stalled: true, deleted: deleted.length, remaining: targets.size });
          await sleep(1500);
        }
        if (shouldStop()) break;

        if (!(await showPhoto(id, shouldStop))) {
          missed.push(id);
          continue;
        }
        if (dryRun) {
          wouldDelete++;
          targets.delete(id);
          continue;
        }

        const bin = visibleBin();
        if (!bin || !(await clickElement(bin))) {
          missed.push(id);
          continue;
        }

        // Google Photos usually trashes straight away; a confirm dialog only
        // turns up in some cases, so it is handled when it appears. Success is
        // the photo leaving the screen - not the dialog, and not the button,
        // which is shared with the next photo the carousel slides in.
        let confirmed = false;
        let gone = false;
        for (let i = 0; i < 25 && !gone; i++) {
          await sleep(200);
          if (!confirmed) {
            const c = findConfirm();
            if (c && c.button) {
              log(`confirm dialog: "${c.label}"`);
              await clickElement(c.button);
              confirmed = true;
              continue;
            }
          }
          if (centreKey() !== id) gone = true;
        }
        if (!gone) {
          log(`${id.slice(-8)} did not leave the screen after "Move to bin" - stopping`);
          break;
        }

        deleted.push(id);
        targets.delete(id);
        await store.remove([id]);
        onProgress({ deleted: deleted.length, remaining: targets.size });
      }
    } finally {
      // Put the user back where they started, whatever happened.
      history.replaceState({}, '', home);
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (!dryRun) await bg('detach').catch(() => {});
    }

    if (missed.length) log(`${missed.length} could not be opened - they may already be gone`);
    return { deleted: deleted.length, wouldDelete, notFound: targets.size };
  }

  window.GPDD.deleter = { run };
})();
