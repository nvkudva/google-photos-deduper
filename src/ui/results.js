// The results list: one card per group of similar photos, paged, with the
// keeper/bin marking and the per-card actions.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { ICON, preview } = window.GPDD.ui;

  // Each group renders with one keeper (green) and the rest marked for deletion
  // (red). Clicking a thumbnail promotes it to keeper; clicking the corner badge
  // toggles whether that single item is deleted.
  // Thumbnail URLs are a stable per-photo token plus a size suffix, so they do
  // not rot the way a signed URL would. They can still fail - a photo deleted
  // elsewhere, a token rotated - and a broken <img> in a review list is worse
  // than a visible gap, because it looks like the photo rather than the link is
  // gone. Any tile still live in the grid is a fresher source than the store.
  function liveThumbs() {
    const map = new Map();
    for (const a of document.querySelectorAll('a[href*="/photo/"]')) {
      const id = (a.getAttribute('href').match(/\/photo\/([^/?#]+)/) || [])[1];
      if (!id || map.has(id)) continue;
      const el = a.querySelector('[data-latest-bg]');
      if (!el) continue;
      const bg = el.getAttribute('data-latest-bg') || getComputedStyle(el).backgroundImage;
      const url = (String(bg).match(/url\("?([^")]+)"?\)/) || [null, bg])[1];
      if (url && /^https?:/.test(url)) map.set(id, url);
    }
    return map;
  }

  // Groups are rendered a page at a time, and the delete selection covers
  // exactly the pages that have been rendered. Selecting every group while
  // showing 200 of them is how 149 photos ended up queued out of sight.
  const PAGE = 200;

  function addSelection(groups, state, from, to) {
    if (!state.dismissed) state.dismissed = new Set();
    for (let i = from; i < to; i++) {
      const g = groups[i];
      g.items.forEach((it) => {
        if (it.id !== g.keeperId && !state.dismissed.has(it.id)) state.toDelete.add(it.id);
      });
    }
  }

  function wheel() {
    const s = document.createElement('span');
    s.className = 'spin';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  // A card's own buttons: skip it, or bin just its duplicates. A skipped card
  // collapses to its heading and can be brought back, rather than vanishing -
  // a group that disappeared would look like photos had been deleted.
  function groupActions(ui, g, state) {
    const bar = document.createElement('div');
    bar.className = 'gact';
    const marked = g.items.filter((it) => it.id !== g.keeperId && state.toDelete.has(it.id));
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'gskip';
    skip.textContent = 'Skip';
    skip.title = 'Leave this group alone';
    skip.disabled = !!state.running;
    skip.onclick = () => ui.onGroupSkip && ui.onGroupSkip(g);
    const bin = document.createElement('button');
    bin.type = 'button';
    bin.className = 'gbin';
    bin.disabled = !marked.length || !!state.running;
    bin.title = marked.length
      ? `Move ${marked.length} of these to the bin now — recoverable from the bin`
      : 'Nothing in this group is marked for the bin';
    if (state.running && state.runningIds && g.items.some((it) => state.runningIds.has(it.id))) {
      bin.classList.add('working');
    }
    bin.append(wheel(), document.createTextNode(marked.length ? `Move ${marked.length} to bin` : 'Move to bin'));
    bin.onclick = () => ui.onGroupBin && ui.onGroupBin(g);
    bar.append(skip, bin);
    return bar;
  }

  function renderGroups(ui, groups, state, onChange) {
    ui.results.textContent = '';
    if (!groups.length) {
      ui.results.textContent = '';
      return;
    }
    if (!state.dismissed) state.dismissed = new Set();
    const live = liveThumbs();
    let broken = 0;
    const frag = document.createDocumentFragment();
    if (!state.shown || state.shown > groups.length) state.shown = Math.min(groups.length, PAGE);
    groups.slice(0, state.shown).forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'grp';
      const h = document.createElement('h4');
      const when = g.items[0].ts ? new Date(g.items[0].ts).toLocaleDateString() : 'unknown date';
      const date = document.createElement('span');
      date.className = 'when';
      date.textContent = when;
      h.append(date);
      box.append(h);
      if (g.items.every((it) => state.dismissed.has(it.id))) {
        box.className = 'grp skipped';
        const flag = document.createElement('span');
        flag.className = 'flag';
        flag.textContent = `${g.items.length} similar photos · skipped`;
        h.append(flag);
        const bar = document.createElement('div');
        bar.className = 'gact';
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.textContent = 'Undo skip';
        undo.disabled = !!state.running;
        undo.onclick = () => ui.onGroupUndoSkip && ui.onGroupUndoSkip(g);
        bar.append(undo);
        h.append(bar);
        frag.append(box);
        return;
      }
      h.append(groupActions(ui, g, state));
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      const keepItem = (item) => {
        g.items.forEach((o) => state.toDelete.add(o.id));
        state.toDelete.delete(item.id);
        onChange();
      };
      g.items.forEach((it, idx) => {
        const t = document.createElement('div');
        const marked = state.toDelete.has(it.id);
        t.className = 'tile ' + (marked ? 'bin' : 'keeper');
        t.dataset.id = it.id;
        const img = document.createElement('img');
        const src = live.get(it.id) || it.thumb || '';
        img.src = src;
        img.loading = 'lazy';
        img.alt = '';
        img.onerror = () => {
          t.classList.add('gone-thumb');
          img.removeAttribute('src');
          broken++;
          if (ui.setThumbWarning) ui.setThumbWarning(broken);
        };
        img.title = 'Click to view full size';
        img.onclick = () => preview.openModal(ui, g, idx, state, keepItem);
        // The badge is the per-item toggle the old text caption used to be.
        const mark = document.createElement('button');
        mark.type = 'button';
        mark.className = 'mark';
        mark.innerHTML = marked ? ICON.cross : ICON.check;
        mark.title = marked ? 'Going to the bin — click to keep' : 'Keeping — click to send to the bin';
        mark.setAttribute('aria-label', mark.title);
        mark.onclick = () => {
          if (state.toDelete.has(it.id)) state.toDelete.delete(it.id);
          else state.toDelete.add(it.id);
          onChange();
        };
        preview.attachPreview(ui, img, it);
        t.append(img, mark);
        tiles.append(t);
      });
      box.append(tiles);
      frag.append(box);
    });

    if (groups.length > state.shown) {
      const rest = groups.length - state.shown;
      const bar = document.createElement('div');
      bar.className = 'more';
      const label = document.createElement('span');
      label.textContent = `Showing ${state.shown} of ${groups.length} groups`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'act sec';
      btn.textContent = `Show ${Math.min(PAGE, rest)} more`;
      btn.onclick = () => {
        const from = state.shown;
        state.shown = Math.min(groups.length, from + PAGE);
        addSelection(groups, state, from, state.shown);
        onChange();
      };
      bar.append(label, btn);
      frag.append(bar);
    }
    ui.results.append(frag);
  }

  window.GPDD.ui.results = { renderGroups, addSelection, PAGE };
})();
