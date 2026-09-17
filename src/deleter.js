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

  // Every call is bounded. An MV3 service worker can be evicted mid-run, and a
  // sendMessage whose callback never fires leaves the promise pending for good:
  // the run stops with no error, no progress and nothing in the log. A rejection
  // instead becomes a failed attempt, which is retried and then skipped.
  const BG_TIMEOUT = 10000;
  const bg = (type, payload = {}) =>
    new Promise((res, rej) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        rej(new Error(`the extension did not answer "${type}" within ${BG_TIMEOUT / 1000}s`));
      }, BG_TIMEOUT);
      chrome.runtime.sendMessage({ type, ...payload }, (r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
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

  // A confirm dialog only appears in some cases, so it is handled when it turns
  // up rather than waited for.
  function findConfirm() {
    const dialog = document.querySelector('[role="alertdialog"],[role="dialog"]');
    if (!dialog) return null;
    const buttons = [...dialog.querySelectorAll('button,[role="button"]')];
    const hit = buttons.find((b) => {
      const text = `${b.textContent || ''} ${b.getAttribute('aria-label') || ''}`.trim();
      return /move to bin|move to trash|^delete|^remove/i.test(text) && !/cancel|keep/i.test(text);
    });
    return hit ? { dialog, button: hit, label: (hit.textContent || '').trim().slice(0, 40) } : { dialog, button: null, label: null };
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

  // One photo: open it, click Move to bin, wait for the app to react. Returns
  // 'done', or why it did not, so the caller can decide about retrying.
  async function attempt(id, shouldStop, log) {
    // Everything this attempt sees is measured from here. Using the whole
    // history of the photo instead was a false-negative generator: after it has
    // been opened once, every rpcid it uses is already on record, so nothing
    // after the click can look new and a deletion that really happened reads as
    // a skip. A retry opens the photo a second time, so it hit this every time.
    const startedAt = Date.now();
    if (!(await showPhoto(id, shouldStop))) return 'did not open';

    const bin = visibleBin();
    if (!bin) return 'no Move to bin button on screen';

    // Confirmation comes from the network, not the page: /photo/<id> looks the
    // same whether the photo is binned or not, the view does not move, and no
    // snackbar is emitted.
    //
    // What this proves is that the app reacted to the click, not that the photo
    // was trashed. The trash request itself has never been caught naming the
    // photo: recording every batchexecute and extracting the media ids from
    // each body finds only reads about it - VrseUb photo metadata, xPf9xf,
    // yQelMe/CuHOKd, and the SXol3b thumbnail batch. nQy5td fires on the click
    // and returns an encrypted Tink key, so the trash call probably carries an
    // opaque token instead of the media key.
    //
    // So this is a liveness check, deliberately not a receipt. It is why
    // failing it is a skip rather than an error, and why a photo already in the
    // bin still passes. Deletions were verified the only way that is currently
    // sound: looking the ids up in /trash afterwards.
    //
    // The rpcids are split because batchexecute batches several RPCs into one
    // request, so the combined string "yQelMe,CuHOKd" looked new even though
    // CuHOKd had been seen on its own - which is what made a read confirm a
    // deletion.
    const before = await bg('netLog', { id, since: startedAt });
    const seen = new Set(before.rows.flatMap((r) => r.rpcids.split(',')));
    const clickedAt = Date.now();
    if (!(await clickElement(bin))) return 'the button moved out of reach';

    let confirmClicked = false;
    for (let i = 0; i < 25; i++) {
      if (shouldStop()) return 'stopped';
      await sleep(200);
      // A confirm dialog only turns up in some cases; handle it if it does -
      // once. Without this guard the dialog was re-clicked on every pass of the
      // poll, up to 25 CDP round trips per photo, which stalled the run.
      if (!confirmClicked) {
        const c = findConfirm();
        if (c && c.button) {
          log(`confirm dialog: "${c.label}"`);
          await clickElement(c.button);
          confirmClicked = true;
        }
      }
      const after = await bg('netLog', { id, since: clickedAt });
      const hit = after.rows.find(
        (r) => r.status === 200 && r.rpcids.split(',').some((x) => x && !seen.has(x))
      );
      if (hit) return 'done';
    }
    return 'no trash request followed the click';
  }

  // Attempts per photo. A photo that will not delete twice in a row will not
  // delete on a third go either - the useful retries are the transient ones,
  // a view that had not finished rendering or a toolbar mid-reflow.
  const ATTEMPTS = 2;
  // No single photo may wedge a run. Every step inside attempt() is bounded, so
  // this should never fire - but a run that stops dead with no error and no log
  // is the worst failure this thing has, and a deadline turns any unforeseen
  // stall into an ordinary skip. It does not cancel the work still in flight,
  // which is why it is generous: it is a backstop, not a schedule.
  const ATTEMPT_DEADLINE = 30000;
  const deadline = (p, ms) =>
    Promise.race([p, new Promise((res) => setTimeout(() => res('took too long'), ms))]);
  // Consecutive failures that mean something is broken rather than unlucky.
  // Without this a run works through the whole selection achieving nothing.
  const GIVE_UP_AFTER = 5;

  async function run({
    targetIds, dryRun = true, onProgress = () => {}, shouldStop = () => false,
  }) {
    const targets = new Set(targetIds);
    const log = (m) => onProgress({ log: m });
    const home = location.pathname + location.search;
    const deleted = [];
    const skipped = []; // { id, why } - offered back for a retry
    let wouldDelete = 0;
    let inARow = 0;
    let stoppedEarly = false;

    const report = () =>
      onProgress({
        deleted: deleted.length,
        skipped: skipped.length,
        remaining: targets.size,
      });

    if (!dryRun) await bg('attach');
    try {
      for (const id of [...targets]) {
        if (shouldStop()) { stoppedEarly = true; break; }

        // Same constraint as the scan: Google Photos stops rendering while the
        // tab is hidden, so there is nothing to click. Say so rather than
        // sitting on "Deleting..." while nothing happens.
        while (document.hidden && !shouldStop()) {
          onProgress({ stalled: true, deleted: deleted.length, remaining: targets.size });
          await sleep(1500);
        }
        if (shouldStop()) { stoppedEarly = true; break; }

        if (dryRun) {
          if (await showPhoto(id, shouldStop)) {
            wouldDelete++;
            targets.delete(id);
          } else {
            skipped.push({ id, why: 'did not open' });
          }
          continue;
        }

        let why = null;
        for (let tryNo = 1; tryNo <= ATTEMPTS; tryNo++) {
          // A thrown attempt is just a failed one. Letting it escape aborted the
          // whole run and lost the record of what was left to do.
          why = await deadline(
            attempt(id, shouldStop, log).catch((e) => String(e.message || e)),
            ATTEMPT_DEADLINE
          );
          if (why === 'done' || why === 'stopped') break;
          if (tryNo < ATTEMPTS) {
            log(`${id.slice(-8)}: ${why} - retrying`);
            await sleep(600);
          }
        }

        if (why === 'stopped') { stoppedEarly = true; break; }

        if (why === 'done') {
          inARow = 0;
          deleted.push(id);
          targets.delete(id);
          // Only now, so a run that dies leaves the store describing exactly
          // what is still in the library and the next run picks up the rest.
          await store.remove([id]);
        } else {
          skipped.push({ id, why });
          if (++inARow >= GIVE_UP_AFTER) {
            log(`${inARow} in a row failed (${why}) - stopping rather than working through the rest`);
            stoppedEarly = true;
            report();
            break;
          }
        }
        report();
      }
    } finally {
      // Put the user back where they started, whatever happened.
      history.replaceState({}, '', home);
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (!dryRun) await bg('detach').catch(() => {});
    }

    for (const s of skipped.slice(0, 5)) log(`skipped ${s.id.slice(-8)}: ${s.why}`);
    if (skipped.length > 5) log(`...and ${skipped.length - 5} more skipped`);

    return {
      deleted: deleted.length,
      wouldDelete,
      skipped: skipped.map((s) => s.id),
      // Never attempted, because the run stopped: still selected, still there.
      remaining: [...targets].filter((id) => !skipped.some((s) => s.id === id)),
      stoppedEarly,
    };
  }

  window.GPDD.deleter = { run };
})();
