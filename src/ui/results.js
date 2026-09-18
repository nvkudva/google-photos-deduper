// The results list: one card per group of similar photos, paged, with the
// keeper/bin marking and the per-card actions.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { ICON, preview, css } = window.GPDD.ui;

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

  const CSS = css`
    /* =============================================================== results == */
    .results {
      margin-top: var(--s4);
      &:empty {
        margin-top: 0;
      }
    }
    .grp {
      background: var(--raised);
      border: 1px solid var(--hair);
      border-radius: var(--r2);
      padding: var(--s3);
      margin-bottom: var(--s2);
      h4 {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--s3);
        margin: 0 0 10px;
        font: 500 var(--t2)/1.3 var(--ui);
        color: var(--fg);
        .when {
          font-weight: 400;
          font-size: var(--t1);
          color: var(--fg-3);
          white-space: nowrap;
        }
        .flag {
          font-weight: 400;
          font-size: var(--t1);
          color: var(--fg-3);
        }
      }
      &.skipped {
        opacity: 0.6;
        h4 {
          margin-bottom: 0;
        }
      }
    }

    /* Per-group actions: deal with one card without touching the rest of the
   selection. */
    .gact {
      display: flex;
      align-items: center;
      gap: var(--s1);
      margin-left: auto;
      button {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px;
        border: 1px solid var(--line);
        border-radius: 999px;
        cursor: pointer;
        font: 500 var(--t1)/1.2 var(--ui);
        background: transparent;
        color: var(--fg-2);
        &:hover:not(:disabled) {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent);
        }
        &.working .spin {
          display: block;
        }
      }
      .gbin {
        color: var(--gone);
        border-color: rgba(242, 184, 181, 0.42);
        &:hover:not(:disabled) {
          background: var(--gone);
          border-color: var(--gone);
          color: var(--gone-ink);
        }
      }
    }

    /* Four to a row whatever the panel width, rather than a fixed tile size that
   silently drops to three when the column is a few pixels short. */
    .tiles {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--s2);
    }
    .tile {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--r1);
      img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        border-radius: inherit;
        background: var(--thumb);
        cursor: pointer;
      }
      /* The ring is drawn on a pseudo-element so it sits above the image and
     never affects layout. */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow: inset 0 0 0 2px transparent;
        transition: box-shadow 0.12s;
      }
      &.keeper {
        &::after {
          box-shadow: inset 0 0 0 2px var(--keep);
        }
        .mark {
          background: var(--keep);
          color: var(--keep-ink);
        }
      }
      &.bin {
        &::after {
          box-shadow: inset 0 0 0 2px var(--gone);
        }
        .mark {
          background: var(--gone);
          color: var(--gone-ink);
        }
        img {
          opacity: 0.45;
        }
      }
      /* A thumbnail that will not load shows as an empty frame rather than the
     browser's broken-image glyph, which reads as a missing photo. */
      &.gone-thumb {
        background: var(--sunken);
        &::before {
          content: '?';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--fg-3);
          font: 400 var(--t4)/1 var(--ui);
        }
      }
    }
    /* The corner badge: the per-item keep / bin toggle. */
    .mark {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 19px;
      height: 19px;
      padding: 0;
      -webkit-appearance: none;
      appearance: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 0;
      cursor: pointer;
      svg {
        width: 12px;
        height: 12px;
        display: block;
      }
      &:hover {
        filter: brightness(1.12);
      }
      &:focus-visible {
        outline: 2px solid var(--fg);
        outline-offset: 2px;
      }
    }

    .more {
      display: flex;
      align-items: center;
      gap: var(--s3);
      margin-top: var(--s3);
      padding-top: var(--s3);
      border-top: 1px solid var(--hair);
      span {
        flex: 1 1 auto;
        color: var(--fg-3);
        font-size: var(--t2);
      }
    }
  `;

  // Parsed once at load and cloned per card, which is cheaper than a chain of
  // createElement calls at 200 groups. Whitespace between tags is dropped so
  // the templates can be laid out for reading without adding text nodes.
  const tpl = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.replace(/>\s+</g, '><').trim();
    return t.content.firstElementChild;
  };

  // A node's data-bind names the slots it takes from the data object:
  // `text:key`, `html:key` (trusted markup only - the icons), `class:key`, or
  // any attribute or property by name. Values are assigned after cloning and
  // never interpolated into the markup, so a caption or a URL that came from
  // Google cannot turn into markup inside the shadow root.
  function fill(template, data) {
    const node = template.cloneNode(true);
    for (const el of [node, ...node.querySelectorAll('[data-bind]')]) {
      const spec = el.getAttribute('data-bind');
      if (!spec) continue;
      el.removeAttribute('data-bind');
      for (const pair of spec.split(' ')) {
        const [target, key] = pair.split(':');
        const v = data[key];
        if (target === 'text') el.textContent = v;
        else if (target === 'html') el.innerHTML = v;
        else if (target === 'class') {
          if (v) el.classList.add(v);
        } else if (target in el) el[target] = v;
        else el.setAttribute(target, v);
      }
    }
    return node;
  }

  const CARD = tpl(
    /* HTML */ ` <div class="grp" data-bind="data-g:g">
      <h4><span class="when" data-bind="text:when"></span></h4>
      <div class="tiles"></div>
    </div>`,
  );

  // A skipped card collapses to its heading and can be brought back, rather
  // than vanishing - a group that disappeared would look like photos had been
  // deleted.
  const SKIPPED = tpl(
    /* HTML */ ` <div class="grp skipped" data-bind="data-g:g">
      <h4>
        <span class="when" data-bind="text:when"></span>
        <span class="flag" data-bind="text:flag"></span>
        <div class="gact">
          <button type="button" data-action="unskip" data-bind="disabled:running">Undo skip</button>
        </div>
      </h4>
    </div>`,
  );

  // A card's own buttons: skip it, or bin just its duplicates.
  const ACTIONS = tpl(
    /* HTML */ ` <div class="gact">
      <button
        type="button"
        class="gskip"
        data-action="skip"
        title="Leave this group alone"
        data-bind="disabled:running"
      >
        Skip
      </button>
      <button type="button" class="gbin" data-action="bin" data-bind="disabled:binOff title:binHint class:binMode">
        <span class="spin" aria-hidden="true"></span>
        <span data-bind="text:binLabel"></span>
      </button>
    </div>`,
  );

  const TILE = tpl(
    /* HTML */ ` <div class="tile" data-bind="class:mode data-id:id">
      <img alt="" loading="lazy" data-action="keep" data-bind="src:src title:hint" />
      <button
        class="mark"
        type="button"
        data-action="toggle"
        data-bind="html:icon title:markHint aria-label:markHint"
      ></button>
    </div>`,
  );

  const MORE = tpl(
    /* HTML */ ` <div class="more">
      <span data-bind="text:showing"></span>
      <button type="button" class="act sec" data-action="more" data-bind="text:label"></button>
    </div>`,
  );

  // What the last render put on screen. The delegated handlers read it, so a
  // click on a card finds its group in the array that built the card.
  let current = null;

  const ACTION = {
    keep: (g, it) => {
      g.items.forEach((o) => current.state.toDelete.add(o.id));
      current.state.toDelete.delete(it.id);
      current.onChange();
    },
    toggle: (g, it) => {
      const { toDelete } = current.state;
      if (toDelete.has(it.id)) toDelete.delete(it.id);
      else toDelete.add(it.id);
      current.onChange();
    },
    skip: (g) => current.ui.onGroupSkip && current.ui.onGroupSkip(g),
    unskip: (g) => current.ui.onGroupUndoSkip && current.ui.onGroupUndoSkip(g),
    bin: (g) => current.ui.onGroupBin && current.ui.onGroupBin(g),
    more: () => {
      const { groups, state } = current;
      const from = state.shown;
      state.shown = Math.min(groups.length, from + PAGE);
      addSelection(groups, state, from, state.shown);
      current.onChange();
    },
  };

  // One listener on the list instead of one per node: the list is rebuilt on
  // every change, so per-node listeners would be re-created hundreds of times
  // over. Each clickable node names its action in the markup.
  const wired = new WeakSet();
  function wire(host) {
    if (wired.has(host)) return;
    wired.add(host);
    host.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-action]');
      if (!hit || !current) return;
      const card = hit.closest('.grp');
      const g = card ? current.groups[Number(card.dataset.g)] : null;
      const tile = hit.closest('.tile');
      const it = tile && g ? g.items.find((i) => i.id === tile.dataset.id) : null;
      ACTION[hit.dataset.action](g, it);
    });
    // A thumbnail that will not load shows as an empty frame rather than the
    // browser's broken-image glyph. error does not bubble, so it is caught on
    // the way down.
    host.addEventListener(
      'error',
      (e) => {
        const tile = e.target.closest && e.target.closest('.tile');
        if (!tile || !current) return;
        tile.classList.add('gone-thumb');
        e.target.removeAttribute('src');
        current.broken++;
        if (current.ui.setThumbWarning) current.ui.setThumbWarning(current.broken);
      },
      true,
    );
  }

  function groupActions(g, state) {
    const marked = g.items.filter((it) => it.id !== g.keeperId && state.toDelete.has(it.id)).length;
    const working = !!(state.running && state.runningIds && g.items.some((it) => state.runningIds.has(it.id)));
    return fill(ACTIONS, {
      running: !!state.running,
      binOff: !marked || !!state.running,
      binHint: marked
        ? `Move ${marked} of these to the bin now — recoverable from the bin`
        : 'Nothing in this group is marked for the bin',
      binMode: working ? 'working' : '',
      binLabel: marked ? `Move ${marked} to bin` : 'Move to bin',
    });
  }

  function renderGroups(ui, groups, state, onChange) {
    ui.results.textContent = '';
    if (!groups.length) return;
    if (!state.dismissed) state.dismissed = new Set();
    wire(ui.results);
    current = { ui, groups, state, onChange, broken: 0 };
    const live = liveThumbs();
    const frag = document.createDocumentFragment();
    if (!state.shown || state.shown > groups.length) state.shown = Math.min(groups.length, PAGE);
    groups.slice(0, state.shown).forEach((g, gi) => {
      const when = g.items[0].ts ? new Date(g.items[0].ts).toLocaleDateString() : 'unknown date';
      if (g.items.every((it) => state.dismissed.has(it.id))) {
        frag.append(
          fill(SKIPPED, { g: gi, when, flag: `${g.items.length} similar photos · skipped`, running: !!state.running }),
        );
        return;
      }
      const box = fill(CARD, { g: gi, when });
      box.querySelector('h4').append(groupActions(g, state));
      const tiles = box.querySelector('.tiles');
      g.items.forEach((it) => {
        const marked = state.toDelete.has(it.id);
        const t = fill(TILE, {
          mode: marked ? 'bin' : 'keeper',
          id: it.id,
          src: live.get(it.id) || it.thumb || '',
          hint: marked ? 'Keep this one instead' : 'Keeping this one',
          icon: marked ? ICON.cross : ICON.check,
          markHint: marked ? 'Going to the bin — click to keep' : 'Keeping — click to send to the bin',
        });
        preview.attachPreview(ui, t.querySelector('img'), it);
        tiles.append(t);
      });
      frag.append(box);
    });

    if (groups.length > state.shown) {
      frag.append(
        fill(MORE, {
          showing: `Showing ${state.shown} of ${groups.length} groups`,
          label: `Show ${Math.min(PAGE, groups.length - state.shown)} more`,
        }),
      );
    }
    ui.results.append(frag);
  }

  window.GPDD.ui.results = { CSS, renderGroups, addSelection, PAGE };
})();
