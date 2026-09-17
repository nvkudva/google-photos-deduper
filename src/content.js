window.GPDD = window.GPDD || {};

(() => {
  const { sel, store, scanner, grouping, deleter, overlay } = window.GPDD;
  if (window.__gpddBooted) return;
  window.__gpddBooted = true;

  const ui = overlay.mount();
  const state = { groups: [], toDelete: new Set(), running: false, stop: false };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'togglePanel') ui.toggle();
  });

  // Development convenience: unpacked extensions only pick up edited files after
  // a reload on chrome://extensions, which nothing on the page can reach. This
  // lets the page ask for that reload instead:
  //   document.dispatchEvent(new Event('gpdd-reload'))
  // It only restarts this extension - it exposes no data and no other action.
  document.addEventListener('gpdd-reload', () => {
    chrome.runtime.sendMessage({ type: 'reloadExtension' }, () => void chrome.runtime.lastError);
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

  function refresh() {
    overlay.renderGroups(ui, state.groups, state, refresh);
    const n = state.toDelete.size;
    ui.del.disabled = !n || state.running;
    ui.dellbl.textContent = n ? `Move ${n} to bin` : 'Move selected to bin';
  }

  // The sparkline behind the range scrubber is drawn from whatever has already
  // been scanned, so it is empty on a first run and fills in from then on.
  async function refreshHistogram() {
    ui.range.setHistogram(await store.allItems());
  }

  async function regroup() {
    const items = await store.allItems();
    ui.range.setHistogram(items);
    state.groups = grouping.group(items, {
      similarity: Number(ui.sim.value),
      includeVideos: ui.vid.checked,
    });
    state.toDelete = new Set();
    state.groups.forEach((g) => g.items.forEach((i) => { if (i.id !== g.keeperId) state.toDelete.add(i.id); }));
    const dupes = state.groups.reduce((s, g) => s + g.items.length - 1, 0);
    ui.setStatus(`${items.length} scanned · ${state.groups.length} groups · ${dupes} duplicates`);
    refresh();
  }

  ui.max.onclick = () => {
    ui.panel.classList.remove('collapsed');
    ui.panel.classList.toggle('maxed');
    ui.preview.classList.remove('on');
    ui.syncChrome();
    refresh(); // re-renders tiles at the size the new mode needs
  };

  ui.sim.onchange = () => { ui.simv.textContent = ui.sim.value + '%'; if (state.groups.length || !state.running) regroup(); };
  ui.vid.onchange = () => regroup();

  ui.scan.onclick = async () => {
    state.running = true; state.stop = false;
    ui.scan.disabled = true; ui.stop.disabled = false; refresh();
    ui.setWarn('');
    ui.setScanning(true);
    const range = ui.range.get();
    ui.setStatus(
      (range.full ? 'Scanning…' : `Scanning ${range.label}…`) +
        ' keep this tab visible; Google Photos stops rendering when it is hidden.'
    );
    try {
      const res = await scanner.scan({
        maxItems: Number(ui.cap.value) || Infinity,
        fromMs: range.fromMs,
        toMs: range.toMs,
        shouldStop: () => state.stop,
        // Tiles under the scanning bar are left for a later scroll position
        // rather than the bar being hidden and restored around every capture.
        blockedRect: () => ui.blockedRect(),
        onProgress: (p) => {
          if (p.stalled) return ui.setStatus('Paused — this tab must stay visible for Google Photos to render.');
          if (p.seeking) {
            const at = p.seekAt ? ` — at ${new Date(p.seekAt).toLocaleDateString()}` : '';
            return ui.setStatus(`Jumping to ${range.label}${at}`);
          }
          if (p.pct != null) ui.setBar(p.pct);
          ui.setStatus(`Scanning… ${p.scanned} photos hashed` + (p.skipped ? ` · ${p.skipped} blank crops retried` : ''));
        },
      });
      await regroup();
      // A few blank crops are normal - a tile can be captured mid-paint and is
      // retried. A high rate means the scan is outrunning the page, and the
      // photos behind those crops are silently missing from the results.
      const offered = res.added + res.skipped;
      if (offered && res.skipped / offered > 0.15) {
        ui.setWarn(
          `${res.skipped} of ${offered} tiles were captured before their thumbnail loaded and could not be hashed. ` +
            'Those photos are not in the results. Scan again to pick them up, and keep the tab in the foreground while it runs.'
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
    state.groups = []; state.toDelete = new Set();
    ui.setBar(0); ui.setStatus('Cleared. Nothing in Google Photos was changed.');
    await refreshHistogram();
    refresh();
  };

  async function runDelete() {
    state.running = true; state.stop = false;
    ui.scan.disabled = true; ui.stop.disabled = false; refresh();
    ui.setWarn('');
    ui.setStatus('Deleting…');
    try {
      const r = await deleter.run({
        targetIds: [...state.toDelete],
        dryRun: false,
        shouldStop: () => state.stop,
        onProgress: (p) => {
          if (p.log) return ui.addLog(p.log);
          ui.setStatus(`Deleted ${p.deleted} · ${p.remaining} to go`);
        },
      });
      await regroup();
      // regroup() rewrites the status line, so the outcome goes on last.
      ui.setStatus(`Moved ${r.deleted} to the bin — recoverable there.` + (r.notFound ? ` ${r.notFound} were not reachable.` : ''));
    } catch (e) {
      ui.setWarn(String(e.message || e));
      ui.setStatus('Delete stopped.');
    } finally {
      state.running = false;
      ui.scan.disabled = false; ui.stop.disabled = true; refresh();
    }
  }

  // Deliberately not window.confirm(): a content script's native dialog blocks
  // the whole renderer, which freezes the very page the deleter has to drive.
  // Two clicks on the button itself, with a timeout that disarms it.
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
