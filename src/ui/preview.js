// Hover preview for the tiles: rewrites the thumbnail URL to ask for a larger
// render.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { css } = window.GPDD.ui;
  const HTML = /* HTML */ ` <div class="preview" data-ref="preview">
    <img data-ref="previewImg" alt="" /><b data-ref="previewCap"></b>
  </div>`;

  const CSS = css`
    /* =============================================================== preview == */
    .preview {
      position: fixed;
      z-index: 2147483646;
      display: none;
      pointer-events: none;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--r2);
      padding: var(--s2);
      box-shadow: 0 20px 56px rgba(0, 0, 0, 0.7);
      &.on {
        display: block;
      }
      img {
        display: block;
        border-radius: var(--r1);
        background: var(--thumb);
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      b {
        display: block;
        margin-top: 6px;
        font: 400 var(--t1)/1.4 var(--ui);
        color: var(--fg-3);
        text-align: center;
      }
    }
  `;

  // The grid thumbnail URL carries its size in the last path segment
  // (".../<id>=w144-h193-no?..."), and that segment is rewritable - asking for
  // w1200 returns a genuinely larger image rather than an upscale. Used for the
  // hover preview so a duplicate can be judged before deleting it.
  function bigUrl(thumb, px = 1200) {
    try {
      const u = new URL(thumb);
      const segs = u.pathname.split('/');
      const last = segs[segs.length - 1];
      if (!last.includes('=')) return thumb;
      segs[segs.length - 1] = last.replace(/=.*$/, `=w${px}-h${px}-no`);
      u.pathname = segs.join('/');
      return u.toString();
    } catch (e) {
      return thumb;
    }
  }

  // Bumped on every hover. A large image that finishes loading after the
  // pointer has moved on must not overwrite the newer preview.
  let previewSeq = 0;
  // Shared by every tile: a tile's own timer cannot be cancelled by the next
  // tile's mouseenter, so the pending hide would fire after the swap.
  let previewTimer = null;

  // Sits to the left of the panel, vertically centred on the hovered tile and
  // clamped to the viewport. A short delay keeps it from flashing while the
  // pointer sweeps across a row. One pair of listeners on the results host
  // covers every tile, so a re-render allocates nothing; itemOf(img) resolves
  // the hovered thumbnail to its item.
  function wire(ui, host, itemOf) {
    // Position has to be recomputed once the image lands: before it loads the
    // box has no real height, so a tall photo would be placed off the bottom.
    const place = (img) => {
      const panel = ui.panel.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      const w = ui.preview.offsetWidth;
      const h = ui.preview.offsetHeight;
      ui.preview.style.left = Math.max(12, panel.left - w - 16) + 'px';
      ui.preview.style.top = Math.max(12, Math.min(window.innerHeight - h - 12, r.top + r.height / 2 - h / 2)) + 'px';
    };

    const show = (img, item) => {
      const panel = ui.panel.getBoundingClientRect();
      const maxW = Math.min(620, Math.max(220, panel.left - 32));
      const maxH = Math.round(window.innerHeight * 0.8);
      ui.preview.style.maxWidth = maxW + 'px';
      ui.preview.style.maxHeight = maxH + 'px';
      ui.previewImg.style.maxHeight = maxH - 34 + 'px';
      ui.previewImg.style.maxWidth = maxW - 12 + 'px';

      // The small thumbnail is already in cache, so it paints immediately and
      // is always the right photo. Assigning the large src directly instead
      // would leave the PREVIOUS photo on screen until the new one decoded.
      const seq = ++previewSeq;
      ui.previewImg.src = item.thumb || '';
      ui.previewCap.textContent =
        (item.ts ? new Date(item.ts).toLocaleString() : 'date unknown') +
        (item.kind && item.kind !== 'Photo' ? ` · ${item.kind}` : '');

      const big = new Image();
      big.onload = () => {
        if (seq !== previewSeq) return; // pointer has moved on
        ui.previewImg.src = big.src;
        place(img);
      };
      big.src = bigUrl(item.thumb || '');

      ui.preview.classList.add('on');
      place(img);
    };

    // The thumbnail is a leaf, so over/out on it are its enter/leave.
    const thumb = (e) => (e.target.closest ? e.target.closest('.tile img') : null);
    host.addEventListener('mouseover', (e) => {
      const img = thumb(e);
      if (!img) return;
      const item = itemOf(img);
      if (!item) return;
      clearTimeout(previewTimer);
      // Already open on the previous tile, so swap straight to this one rather
      // than making the pointer wait through the open delay again.
      previewTimer = setTimeout(() => show(img, item), ui.preview.classList.contains('on') ? 0 : 120);
    });
    // Lingers half a second on the way out, so sweeping off a tile does not
    // blink the preview away before the next one is under the pointer.
    host.addEventListener('mouseout', (e) => {
      if (!thumb(e)) return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => ui.preview.classList.remove('on'), 500);
    });
  }

  window.GPDD.ui.preview = { HTML, CSS, bigUrl, wire };
})();
