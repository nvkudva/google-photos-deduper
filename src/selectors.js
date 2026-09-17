// Every DOM assumption about photos.google.com lives here.
// Verified against the live UI on 2026-09-17.
window.GPDD = window.GPDD || {};

(() => {
  const S = {
    // Main library tiles are "./photo/<id>"; album, Screenshots and search views
    // are "./documents/<album>/photo/<id>" or "./search/.../photo/<id>". Both
    // contain "/photo/", and everything else about the tile is identical.
    tile: 'a[href*="/photo/"]',
    wrapper: 'div[jsname="NwW5ce"]',
    thumb: '[data-latest-bg]',
    checkbox: '[role="checkbox"]',
    moveToBin: '[aria-label="Move to bin"],[aria-label="Move to trash"],[aria-label="Delete"]',
    clearSelection: '[aria-label="Clear selection"]',
  };

  // Date-header checkboxes ("Select all photos from Yesterday") sit in the same
  // tree as per-tile ones and select a whole day. Never click those.
  const isSelectAll = (el) => /^Select all/i.test(el.getAttribute('aria-label') || '');

  function tileCheckbox(tileAnchor) {
    const w = tileAnchor.closest(S.wrapper) || tileAnchor.parentElement;
    if (!w) return null;
    return [...w.querySelectorAll(S.checkbox)].find((c) => !isSelectAll(c)) || null;
  }

  function thumbUrl(tileAnchor) {
    const t = tileAnchor.querySelector(S.thumb);
    if (!t) return null;
    const m = getComputedStyle(t).backgroundImage.match(/url\("?([^")]+)"?\)/);
    return m ? m[1] : null;
  }

  // aria-label looks like: "Photo – Portrait – 24 Aug 2025, 12:34:56"
  // It is locale-formatted, so a parse failure is "unbucketed", never a throw.
  function parseLabel(label) {
    const out = { kind: 'Photo', ts: null, day: 'unknown' };
    if (!label) return out;
    const parts = label.split(/\s+[–—-]\s+/);
    if (parts[0]) out.kind = parts[0].trim();
    const datePart = parts[parts.length - 1];
    const t = Date.parse(datePart);
    if (!Number.isNaN(t)) {
      out.ts = t;
      out.day = new Date(t).toISOString().slice(0, 10);
    }
    return out;
  }

  const PHOTO_ID = /\/photo\/([^/?#]+)/;

  function readTile(a) {
    const href = a.getAttribute('href') || '';
    const m = href.match(PHOTO_ID);
    const id = m ? m[1] : '';
    if (!id) return null;
    const meta = parseLabel(a.getAttribute('aria-label'));
    return { id, href, kind: meta.kind, ts: meta.ts, day: meta.day, thumb: thumbUrl(a) };
  }

  function liveTiles() {
    return [...document.querySelectorAll(S.tile)];
  }

  // A click is only dispatched when the target is genuinely hit-testable.
  // Recycled tiles keep stale rects (observed at top: -590) and must be skipped.
  function safeRect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ok =
      r.width > 8 &&
      r.height > 8 &&
      r.top > 64 &&
      r.left >= 0 &&
      r.bottom < window.innerHeight - 8 &&
      r.right < window.innerWidth - 8;
    return ok ? r : null;
  }

  // Toolbar and dialog buttons sit in the top bar, which safeRect deliberately
  // excludes. They only need to be on screen and hit-testable.
  function buttonRect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ok =
      r.width > 8 && r.height > 8 &&
      r.top >= 0 && r.left >= 0 &&
      r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    return ok ? r : null;
  }

  function selfCheck() {
    const problems = [];
    const tiles = liveTiles();
    if (!tiles.length) problems.push('no photo tiles matched ' + S.tile);
    else {
      // Thumbnails paint lazily, so ask whether any tile has one rather than
      // insisting the first one does.
      if (!tiles.some((t) => thumbUrl(t))) problems.push('no tile thumbnails have painted yet');
      if (!tileCheckbox(tiles[0])) problems.push('per-tile checkbox not found');
      if (!parseLabel(tiles[0].getAttribute('aria-label')).ts)
        problems.push('could not parse a date out of the tile aria-label');
    }
    return problems;
  }

  window.GPDD.sel = {
    S, tileCheckbox, thumbUrl, parseLabel, readTile, liveTiles,
    safeRect, buttonRect, isSelectAll, selfCheck,
  };
})();
