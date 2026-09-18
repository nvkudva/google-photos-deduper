window.GPDD = window.GPDD || {};

(() => {
  const { sel, store, scanner, grouping, api } = window.GPDD;
  const { mount, results, nav } = window.GPDD.ui;
  if (window.__gpddBooted) return;
  window.__gpddBooted = true;

  const ui = mount();
  nav.mount(ui);
  const state = {
    groups: [], toDelete: new Set(), dismissed: new Set(), runningIds: new Set(),
    running: false, stop: false,
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'togglePanel') ui.toggle();
  });

  // The content script runs before the grid has rendered, so the check waits for
  // tiles to appear rather than reporting an empty page as a broken one.
  refreshHistogram();

  (async () => {
    for (let i = 0; i < 30; i++) {
      if (sel.liveTiles().length) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const problems = sel.selfCheck();
    if (problems.length) {
      ui.setWarn('Google Photos looks different than this extension expects: ' + problems.join('; '));
    }
  })();

  // Reported once per render rather than per image, so a handful of dead
  // thumbnails says so plainly instead of leaving silent gaps in the review.
  ui.setThumbWarning = (n) => {
    ui.setWarn(
      `${n} thumbnail${n === 1 ? '' : 's'} could not be loaded. Those photos are still in the results; ` +
        'scroll the grid past them, or scan again, to pick up fresh links.'
    );
  };

  function refresh() {
    results.renderGroups(ui, state.groups, state, refresh);
    const n = state.toDelete.size;
    ui.del.disabled = !n || state.running;
    ui.dellbl.textContent = n ? `Move ${n} to bin` : 'Move selected to bin';
  }

  // A skipped group keeps its photos in the store and in the results - it is
  // only taken out of the selection, so nothing is lost by skipping it.
  ui.onGroupSkip = (g) => {
    g.items.forEach((it) => { state.dismissed.add(it.id); state.toDelete.delete(it.id); });
    refresh();
  };
  ui.onGroupUndoSkip = (g) => {
    g.items.forEach((it) => {
      state.dismissed.delete(it.id);
      if (it.id !== g.keeperId) state.toDelete.add(it.id);
    });
    refresh();
  };
  // Bins this card's marked duplicates only, leaving the rest of the selection
  // exactly as it is.
  ui.onGroupBin = (g) => {
    if (state.running) return;
    const ids = g.items.filter((it) => it.id !== g.keeperId && state.toDelete.has(it.id)).map((it) => it.id);
    if (ids.length) runDelete(ids, { partial: true });
  };

  // The sparkline behind the range scrubber is drawn from whatever has already
  // been scanned, so it is empty on a first run and fills in from then on.
  async function refreshHistogram() {
    ui.range.setHistogram(await store.allItems());
  }

  async function regroup() {
    const items = await store.allItems();
    ui.range.setHistogram(items);
    if (items.length > 20000) ui.setStatus(`Grouping ${items.length} photos…`, { keepUndo: true });
    const res = await grouping.group(items, {
      similarity: Number(ui.sim.value),
      onProgress: ({ done }) => {
        if (items.length > 20000) ui.setBar(Math.round((done / 8) * 100));
      },
    });
    state.groups = res.groups;
    if (res.capped) {
      ui.setWarn(
        `${res.capped} band${res.capped === 1 ? '' : 's'} of near-identical photos were too large to compare ` +
          'exhaustively, so a few matches inside them may be missing. Identical photos are still grouped.'
      );
    }
    // Only the first page is selected. The rest are selected as they are shown,
    // so the delete count never covers groups that cannot be looked at.
    state.shown = Math.min(state.groups.length, results.PAGE);
    state.toDelete = new Set();
    results.addSelection(state.groups, state, 0, state.shown);
    const dupes = state.groups.reduce((s, g) => s + g.items.length - 1, 0);
    ui.setStatus(`${items.length} scanned · ${state.groups.length} groups · ${dupes} duplicates`, { keepUndo: true });
    refresh();
  }

  ui.sim.onchange = () => { ui.simv.textContent = ui.sim.value + '%'; if (state.groups.length || !state.running) regroup(); };

  ui.scan.onclick = async () => {
    state.running = true; state.stop = false;
    ui.scan.disabled = true; ui.stop.disabled = false; refresh();
    ui.setWarn('');
    ui.setScanning(true);
    const range = ui.range.get();
    ui.setStatus(
      range.full ? 'Scanning…' : `Scanning ${range.label}…`
    );
    try {
      const res = await scanner.scan({
        maxItems: Number(ui.cap.value) || Infinity,
        fromMs: range.fromMs,
        toMs: range.toMs,
        shouldStop: () => state.stop,
        onProgress: (p) => {
          if (p.log) return ui.addLog(p.log);
          if (p.pct != null) ui.setBar(p.pct);
          ui.setStatus(`Scanning… ${p.scanned} photos hashed` + (p.skipped ? ` · ${p.skipped} thumbnails could not be fetched` : ''));
        },
      });
      await regroup();
      if (res.skipped) {
        ui.setWarn(
          `${res.skipped} thumbnails could not be fetched, so those photos are not in the results. Scan again to pick them up.`
        );
      }
    } catch (e) {
      ui.setWarn(String(e.message || e));
      ui.setStatus('Scan stopped.');
    } finally {
      state.running = false;
      ui.setScanning(false);
      ui.scan.disabled = false; ui.stop.disabled = true; refresh();
    }
  };

  ui.stop.onclick = () => { state.stop = true; ui.setStatus('Stopping…'); };
  ui.scanstop.onclick = () => ui.stop.onclick();

  ui.reset.onclick = async () => {
    await store.clear();
    state.groups = []; state.toDelete = new Set(); state.dismissed = new Set();
    ui.setBar(0); ui.setStatus('Cleared. Nothing in Google Photos was changed.');
    await refreshHistogram();
    refresh();
  };

  async function runDelete(ids, { partial = false } = {}) {
    const targetIds = ids || [...state.toDelete];
    const shownBefore = state.shown;
    // api.run takes the confirmed photos out of the store, so the rows to put
    // back on an undo are taken from the groups while they are still there.
    const want = new Set(targetIds);
    const rows = new Map();
    state.groups.forEach((g) => g.items.forEach((it) => { if (want.has(it.id)) rows.set(it.id, it); }));
    state.running = true; state.stop = false;
    state.runningIds = new Set(targetIds);
    ui.scan.disabled = true; ui.stop.disabled = false; refresh();
    ui.setWarn('');
    ui.setBusy(true);
    ui.setStatus(`Deleting ${targetIds.length}…`);
    let r = null;
    let failed = null;
    try {
      r = await api.run({
        targetIds,
        shouldStop: () => state.stop,
        onProgress: (p) => {
          if (p.log) return ui.addLog(p.log);
          ui.setStatus(
            `Deleted ${p.deleted}` +
              (p.skipped ? ` · ${p.skipped} skipped` : '') +
              ` · ${p.remaining} to go`
          );
        },
      });
    } catch (e) {
      failed = String(e.message || e);
      ui.setWarn(failed);
    } finally {
      state.running = false;
      state.runningIds = new Set();
      ui.setBusy(false);
      ui.scan.disabled = false;
      ui.stop.disabled = true;
      // Every confirmed deletion is already out of the store, so the cards have
      // to be rebuilt even when the run ended badly or was stopped part way -
      // otherwise they go on offering photos that are now in the bin.
      try {
        await regroup();
      } catch (e) {
        ui.setWarn(`The results could not be rebuilt: ${e.message || e}`);
      }
      // Anything the run did not finish is re-selected, so clicking the button
      // again picks up exactly those rather than starting from the top. A photo
      // that was skipped is still in the store, so it is still in the rebuilt
      // groups.
      const pending = r ? [...r.skipped, ...r.remaining] : [];
      // A card-level run must not narrow the selection down to that one card,
      // so it keeps the selection regroup() just rebuilt and only restores the
      // pages that were on screen before.
      if (partial) {
        if (shownBefore > state.shown) {
          const from = state.shown;
          state.shown = Math.min(state.groups.length, shownBefore);
          results.addSelection(state.groups, state, from, state.shown);
        }
        refresh();
      } else if (pending.length) {
        reselect(pending);
      }

      // Only a run that binned something can be undone, and only until the
      // next one replaces it.
      state.lastDelete = r && r.deleted ? { keys: r.deletedKeys, rows } : null;

      // regroup() rewrites the status line, so the outcome goes on last.
      ui.setStatus(
        (failed ? `Delete stopped: ${failed}` : `Moved ${r.deleted} to the bin — recoverable there.`) +
          (r && r.alreadyBinned ? ` ${r.alreadyBinned} were already there.` : '') +
          (pending.length ? ` ${pending.length} left${partial ? ' in that group.' : ' — click again to carry on.'}` : ''),
        { keepUndo: true }
      );
      ui.setUndo(state.lastDelete ? state.lastDelete.keys.size : 0);
    }
  }

  ui.undo.onclick = async () => {
    const last = state.lastDelete;
    if (!last || state.running) return;
    // Same lock a delete takes: putting rows back and regrouping must not race
    // a scan or another bin run started while it is in flight.
    state.running = true;
    ui.scan.disabled = true;
    ui.undo.disabled = true;
    refresh();
    ui.setBusy(true);
    ui.setWarn('');
    ui.setStatus(`Putting ${last.keys.size} back…`, { keepUndo: true });
    let back;
    try {
      back = await api.restore(last.keys, {
        onProgress: (p) => { if (p.log) ui.addLog(p.log); },
      });
    } catch (e) {
      ui.setWarn(`Undo failed: ${e.message || e}`);
      ui.setStatus('Nothing was restored — the photos are still in the bin.', { keepUndo: true });
      ui.undo.disabled = false;
      back = null;
    }
    if (back) try {
      // Only the photos Google's reply names go back in the store, so a partial
      // restore leaves the rest out of the results rather than showing rows for
      // photos still in the bin.
      const restored = back.map((id) => last.rows.get(id)).filter(Boolean);
      if (restored.length) await store.putMany(restored);
      // Restoring is idempotent, so the offer stays up when nothing came back
      // and the keys are still there to try again with.
      if (back.length) state.lastDelete = null;
      await regroup();
      ui.setStatus(
        back.length === last.keys.size
          ? `Put ${back.length} back.`
          : `Put ${back.length} back — ${last.keys.size - back.length} stayed in the bin.`,
        { keepUndo: !back.length }
      );
      if (!back.length) ui.undo.disabled = false;
    } catch (e) {
      ui.setWarn(`The photos are back in the library, but the results could not be rebuilt: ${e.message || e}`);
    } finally {
      state.running = false;
      ui.scan.disabled = false;
      ui.setBusy(false);
      refresh();
    }
  };

  // Put the given ids back in the selection after a regroup, expanding the
  // visible page far enough to cover them: nothing may be queued for deletion
  // that the user cannot scroll to and look at.
  function reselect(ids) {
    const want = new Set(ids);
    let deepest = -1;
    state.groups.forEach((g, i) => {
      if (g.items.some((it) => want.has(it.id) && it.id !== g.keeperId)) deepest = i;
    });
    if (deepest < 0) return;
    state.shown = Math.max(state.shown, deepest + 1);
    state.toDelete = new Set();
    state.groups.slice(0, state.shown).forEach((g) => {
      g.items.forEach((it) => {
        if (it.id !== g.keeperId && want.has(it.id)) state.toDelete.add(it.id);
      });
    });
    refresh();
  }

  // Deliberately not window.confirm(): a content script's native dialog blocks
  // the whole renderer. Two clicks on the button itself, with a timeout that
  // disarms it.
  let armed = null;
  ui.del.onclick = () => {
    const n = state.toDelete.size;
    if (!armed) {
      armed = setTimeout(() => {
        armed = null;
        refresh();
      }, 15000);
      // Kept short on purpose: a longer label reflows the footer and moves the
      // button out from under the pointer, so the confirming click misses.
      ui.dellbl.textContent = 'Confirm delete';
      ui.setStatus(`Click the red button again to move ${n} to the bin. Recoverable from the bin.`);
      return;
    }
    clearTimeout(armed);
    armed = null;
    runDelete();
  };

  store.count().then((c) => { if (c) regroup(); });
})();
