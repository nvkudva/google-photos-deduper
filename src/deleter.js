// Google Photos' jsaction handlers ignore untrusted events: element.click() and
// full synthetic PointerEvent/MouseEvent sequences were both verified to do
// nothing, including on the always-visible "Clear selection" button. Real input
// therefore has to come from the DevTools protocol, which is why the extension
// asks for the "debugger" permission.
//
// Deletion runs one screenful at a time rather than selecting the whole library
// and trashing it in one go: with the DOM recycling tiles, selection state for
// rows that no longer exist is not something to bet a delete on.
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

  // `kind` picks the guard: tiles must clear the header, buttons must not.
  async function clickElement(el, kind = 'tile') {
    const rect = kind === 'button' ? sel.buttonRect(el) : sel.safeRect(el); // re-read immediately before dispatch
    if (!rect) return false;
    await clickAt(rect);
    return true;
  }

  // Google Photos renders more than one checkbox node per tile, so counting
  // elements over-reports. What matters is how many distinct photos are
  // selected, which is what the "Move to bin" click is about to act on.
  const checkedCount = () => {
    const ids = new Set();
    let loose = 0;
    for (const c of document.querySelectorAll(`${sel.S.checkbox}[aria-checked="true"]`)) {
      if (sel.isSelectAll(c)) continue;
      const w = c.closest(sel.S.wrapper);
      const a = w && w.querySelector(sel.S.tile);
      const t = a && sel.readTile(a);
      if (t) ids.add(t.id);
      else loose++;
    }
    return ids.size + loose;
  };

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

  async function trashSelection(log) {
    const bin = document.querySelector(sel.S.moveToBin);
    if (!bin) throw new Error('"Move to bin" button not found while items were selected');
    if (!(await clickElement(bin, 'button'))) throw new Error('"Move to bin" button was not in a clickable position');

    // Google Photos usually trashes straight away and shows a "Moved to the
    // bin" snackbar with Undo; a confirm dialog only appears in some cases. So
    // the dialog is handled when it turns up, and success is judged by the
    // selection emptying - not by the dialog, and not by the toolbar button
    // disappearing, which it does not reliably do.
    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      if (!confirmed) {
        const c = findConfirm();
        if (c && c.button) {
          log(`confirm dialog: "${c.label}"`);
          await clickElement(c.button, 'button');
          confirmed = true;
          continue;
        }
      }
      if (checkedCount() === 0) return true;
    }
    throw new Error('the selection never cleared after clicking "Move to bin" - stopped');
  }

  async function clearSelection() {
    const btn = document.querySelector(sel.S.clearSelection);
    if (btn) await clickElement(btn, 'button');
  }

  async function run({ targetIds, dryRun = true, batchSize = 30, onProgress = () => {}, shouldStop = () => false }) {
    const targets = new Set(targetIds);
    const log = (m) => onProgress({ log: m });

    // The grid renders lazily, and not at all while the tab is hidden, so give
    // it a chance to appear instead of failing on an empty page.
    let scroller = sel.findScroller();
    for (let i = 0; i < 20 && (!scroller || !sel.liveTiles().length); i++) {
      await sleep(500);
      scroller = sel.findScroller();
    }
    if (!scroller) throw new Error('the photo grid has not loaded - scroll the page once and try again');
    const deleted = [];
    let wouldDelete = 0;

    if (!dryRun) await bg('attach');
    try {
      scroller.scrollTop = 0;
      await sleep(1200);

      let idle = 0;
      while (targets.size && !shouldStop()) {
        // Same constraint as the scan: Google Photos stops rendering while the
        // tab is hidden, so there is nothing to click. Say so rather than
        // sitting on "Deleting..." while nothing happens.
        if (document.hidden) {
          onProgress({ stalled: true, deleted: deleted.length, remaining: targets.size });
          await sleep(1500);
          continue;
        }

        const here = sel.liveTiles()
          .map((a) => ({ a, t: sel.readTile(a) }))
          .filter((x) => x.t && targets.has(x.t.id))
          .slice(0, batchSize);

        if (here.length) {
          if (dryRun) {
            wouldDelete += here.length;
            here.forEach((x) => targets.delete(x.t.id));
          } else {
            const picked = [];
            for (const x of here) {
              const cb = sel.tileCheckbox(x.a);
              if (!cb || cb.getAttribute('aria-checked') === 'true') continue;
              if (await clickElement(cb)) {
                picked.push(x.t.id);
                await sleep(120);
              }
            }
            const n = checkedCount();
            if (picked.length && n > 0) {
              if (n !== picked.length) {
                log(`selection mismatch: clicked ${picked.length}, ${n} checked - stopping`);
                await clearSelection();
                break;
              }
              await trashSelection(log);
              deleted.push(...picked);
              picked.forEach((id) => targets.delete(id));
              await store.remove(picked);
              onProgress({ deleted: deleted.length, remaining: targets.size });
              await sleep(900);
              continue; // the grid reflows after a delete; re-read from here
            }
          }
        }

        const atBottom = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 4;
        if (atBottom) { if (++idle >= 3) break; } else idle = 0;
        scroller.scrollTop += Math.round(scroller.clientHeight * 0.75);
        await sleep(500);
      }
    } finally {
      if (!dryRun) await bg('detach').catch(() => {});
    }

    return { deleted: deleted.length, wouldDelete, notFound: targets.size };
  }

  window.GPDD.deleter = { run };
})();
