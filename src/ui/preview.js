// Hover preview for the tiles, and the click-to-open dialog behind them. Both
// rewrite the thumbnail URL to ask for a larger render.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
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

  // Sits to the left of the panel, vertically centred on the hovered tile and
  // clamped to the viewport. A short delay keeps it from flashing while the
  // pointer sweeps across a row.
  function attachPreview(ui, img, item) {
    let timer = null;
    // Position has to be recomputed once the image lands: before it loads the
    // box has no real height, so a tall photo would be placed off the bottom.
    const place = () => {
      const panel = ui.panel.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      const w = ui.preview.offsetWidth;
      const h = ui.preview.offsetHeight;
      ui.preview.style.left = Math.max(12, panel.left - w - 16) + 'px';
      ui.preview.style.top =
        Math.max(12, Math.min(window.innerHeight - h - 12, r.top + r.height / 2 - h / 2)) + 'px';
    };

    const show = () => {
      const panel = ui.panel.getBoundingClientRect();
      const maxW = Math.min(620, Math.max(220, panel.left - 32));
      const maxH = Math.round(window.innerHeight * 0.8);
      ui.preview.style.maxWidth = maxW + 'px';
      ui.preview.style.maxHeight = maxH + 'px';
      ui.previewImg.style.maxHeight = (maxH - 34) + 'px';
      ui.previewImg.style.maxWidth = (maxW - 12) + 'px';

      // The small thumbnail is already in cache, so it paints immediately and
      // is always the right photo. Assigning the large src directly instead
      // would leave the PREVIOUS photo on screen until the new one decoded.
      const seq = ++previewSeq;
      ui.previewImg.onload = null;
      ui.previewImg.onerror = null;
      ui.previewImg.src = item.thumb || '';
      ui.previewCap.textContent =
        (item.ts ? new Date(item.ts).toLocaleString() : 'date unknown') +
        (item.kind && item.kind !== 'Photo' ? ` · ${item.kind}` : '');

      const big = new Image();
      big.onload = () => {
        if (seq !== previewSeq) return; // pointer has moved on
        ui.previewImg.src = big.src;
        place();
      };
      big.src = bigUrl(item.thumb || '');

      ui.preview.classList.add('on');
      place();
    };

    img.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      timer = setTimeout(show, 120);
    });
    img.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      ui.preview.classList.remove('on');
    });
  }

  // Hovering shows a photo; clicking commits to looking at it. The dialog is
  // fixed and centred, stays put until dismissed, and carries the keeper action
  // so clicking a photo does not lose the decision it used to make.
  let modalSeq = 0;

  // Takes the whole group, not one photo: numbered buttons switch between the
  // duplicates in place, and "Keep this one" applies to whichever is on screen,
  // so a decision can be made by looking rather than by remembering.
  function openModal(ui, group, startIdx, state, keepItem) {
    let idx = startIdx;
    // Clicking never fires mouseleave, so the hover preview that opened the
    // photo would otherwise sit behind the dialog; bumping the sequence also
    // stops a large image still in flight from putting it back.
    previewSeq++;
    ui.preview.classList.remove('on');

    const draw = () => {
      const item = group.items[idx];
      const seq = ++modalSeq;
      ui.modalImg.onload = null;
      ui.modalImg.src = item.thumb || ''; // cached, so the right photo shows at once
      ui.modalCap.textContent =
        `${idx + 1} of ${group.items.length} \u00b7 ` +
        (item.ts ? new Date(item.ts).toLocaleString() : 'date unknown') +
        (item.kind && item.kind !== 'Photo' ? ` \u00b7 ${item.kind}` : '');
      const big = new Image();
      big.onload = () => {
        if (seq === modalSeq) ui.modalImg.src = big.src;
      };
      big.src = bigUrl(item.thumb || '', 1600);
      [...ui.nums.children].forEach((b, i) => {
        b.classList.toggle('now', i === idx);
        b.classList.toggle('kept', !state.toDelete.has(group.items[i].id));
      });
      ui.mkeep.disabled = !state.toDelete.has(item.id);
      ui.mkeep.textContent = ui.mkeep.disabled ? 'Keeping this one' : 'Keep this one';
    };

    const go = (n) => {
      idx = (n + group.items.length) % group.items.length;
      draw();
    };

    ui.nums.textContent = '';
    group.items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'num';
      b.textContent = String(i + 1);
      b.title = `Show photo ${i + 1}`;
      b.onclick = () => go(i);
      ui.nums.append(b);
    });

    ui.mkeep.onclick = () => {
      keepItem(group.items[idx]);
      closeModal(ui);
    };

    // Arrows step through, number keys jump straight to one.
    ui.modalKeys = (e) => {
      if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= group.items.length) go(Number(e.key) - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };

    ui.scrim.classList.add('on');
    draw();
    ui.mclose.focus();
  }

  function closeModal(ui) {
    modalSeq++;
    ui.modalKeys = null;
    ui.scrim.classList.remove('on');
  }

  window.GPDD.ui.preview = { bigUrl, attachPreview, openModal, closeModal };
})();
