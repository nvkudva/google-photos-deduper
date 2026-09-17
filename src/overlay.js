// Panel lives in a shadow root so Google Photos' stylesheet cannot reach it and
// the panel's own styles cannot leak into the grid the scanner is reading.
window.GPDD = window.GPDD || {};

(() => {
  // Inline only: the extension must render with no network of any kind.
  const ICON = {
    maximise: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.75 6V2.75H6"/><path d="M10 2.75h3.25V6"/><path d="M13.25 10v3.25H10"/><path d="M6 13.25H2.75V10"/></svg>',
    restore: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.75V6H2.75"/><path d="M10 2.75V6h3.25"/><path d="M10 13.25V10h3.25"/><path d="M6 13.25V10H2.75"/></svg>',
    minimise: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 8h8"/></svg>',
    expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 9.75 8 6.25l3.5 3.5"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4 6.4 11.3 12.5 4.9"/></svg>',
    cross: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4.6 4.6l6.8 6.8"/><path d="M11.4 4.6l-6.8 6.8"/></svg>',
  };

  const CSS = `
:host {
  all: initial;
  color-scheme: dark;
  --bg: #1b1c1e; --raised: #232529; --sunken: #141517; --chrome: #232529;
  --line: #34373c; --hair: #2b2e33;
  --fg: #e8eaed; --fg-2: #a3aab1; --fg-3: #7c838a;
  --accent: #8ab4f8; --accent-ink: #12233a; --accent-soft: rgba(138,180,248,.12);
  --keep: #81c995; --gone: #f28b82; --gone-soft: rgba(242,139,130,.12); --note: #fdd663;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px;
  --r1: 6px; --r2: 10px; --r3: 14px;
  --t1: 11px; --t2: 12px; --t3: 13px; --t4: 15px;
  --ui: 'Google Sans', Roboto, system-ui, -apple-system, sans-serif;
}
.panel { position: fixed; right: var(--s4); bottom: var(--s4); width: 380px; max-height: 78vh;
  display: flex; flex-direction: column; z-index: 2147483647;
  font: 400 var(--t3)/1.5 var(--ui); color: var(--fg);
  background: var(--bg); border: 1px solid var(--line); border-radius: var(--r3);
  box-shadow: 0 18px 48px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.4); overflow: hidden; }

.hd { display: flex; align-items: center; gap: var(--s1); padding: 10px 10px 10px var(--s4);
  background: var(--chrome); border-bottom: 1px solid var(--hair); }
.hd b { flex: 1; font: 500 var(--t4)/1.25 var(--ui); letter-spacing: -.01em; }
.hd button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  padding: 0; background: none; border: 0; border-radius: var(--r1); color: var(--fg-3); cursor: pointer; }
.hd button svg { width: 16px; height: 16px; display: block; }
.hd button:hover { background: #33363b; color: var(--fg); }
.hd button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.body { padding: var(--s4); overflow: auto; overscroll-behavior: contain; }
.collapsed .body, .collapsed .ft { display: none; }

.fields { background: var(--raised); border: 1px solid var(--hair); border-radius: var(--r2); padding: 0 var(--s3); }
.field { display: flex; align-items: center; gap: var(--s3); min-height: 40px; color: var(--fg-2); cursor: default; }
.field + .field { border-top: 1px solid var(--hair); }
.field .lbl { flex: 0 0 96px; }
.unit { color: var(--fg-3); font-size: var(--t2); }
.simv { min-width: 34px; text-align: right; font: 500 var(--t3)/1 var(--ui);
  color: var(--fg); font-variant-numeric: tabular-nums; }

input[type=range] { flex: 1; min-width: 60px; height: 18px; margin: 0; cursor: pointer;
  -webkit-appearance: none; appearance: none; background: transparent; }
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: #3b3e44; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px;
  margin-top: -5px; border: 0; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 0 var(--accent-soft); transition: box-shadow .15s; }
input[type=range]:hover::-webkit-slider-thumb { box-shadow: 0 0 0 6px var(--accent-soft); }
input[type=range]:focus { outline: none; }
input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 6px var(--accent-soft); }

input[type=number] { width: 86px; -webkit-appearance: none; appearance: none; text-align: right;
  background: var(--sunken); color: var(--fg); border: 1px solid var(--line); border-radius: var(--r1);
  padding: 6px 9px; font: 400 var(--t3)/1.2 var(--ui); font-variant-numeric: tabular-nums; }
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
input[type=number]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
input[type=checkbox] { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); cursor: pointer; }

.row { display: flex; align-items: center; gap: var(--s2); margin-top: var(--s3); }
button.act { flex: 0 0 auto; padding: 8px 16px; border: 1px solid transparent; border-radius: 999px;
  cursor: pointer; font: 500 var(--t3)/1.2 var(--ui); background: var(--accent); color: var(--accent-ink); }
button.act:hover:not(:disabled) { background: #a3c5fa; }
button.act.sec { background: transparent; color: var(--accent); border-color: #474b53; }
button.act.sec:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
button.act.ghost { background: transparent; color: var(--fg-3); border-color: transparent; padding: 8px 12px; }
button.act.ghost:hover:not(:disabled) { background: var(--gone-soft); color: var(--gone); }
button.act.danger { background: var(--gone); color: #3a1411; }
button.act.danger:hover:not(:disabled) { background: #f5a49d; }
button.act:disabled { opacity: .38; cursor: default; }
button.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scan { min-width: 92px; }
.reset { margin-left: auto; }

.bar { height: 3px; background: #2c2f34; border-radius: 999px; overflow: hidden; margin: var(--s4) 0 var(--s2); }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 999px; transition: width .25s ease; }
.status { min-height: 18px; color: var(--fg-2); font-size: var(--t2); line-height: 1.5; }
.note { color: var(--fg-3); font-size: var(--t2); padding: var(--s2) var(--s1) 0; }
.log { display: none; margin-top: var(--s3); max-height: 96px; overflow: auto;
  font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg-3);
  background: var(--sunken); border: 1px solid var(--hair); border-radius: var(--r1);
  padding: var(--s2) 10px; white-space: pre-wrap; }
.log.on { display: block; }
.warn { color: var(--note); background: rgba(253,214,99,.08); border: 1px solid rgba(253,214,99,.22);
  border-left: 3px solid var(--note); border-radius: var(--r1);
  padding: var(--s2) 10px; margin-bottom: var(--s3); font-size: var(--t2); }

.results { margin-top: var(--s4); }
.results:empty { margin-top: 0; }
.grp { background: var(--raised); border: 1px solid var(--hair); border-radius: var(--r2);
  padding: var(--s3); margin-bottom: var(--s2); }
.grp h4 { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s3);
  margin: 0 0 10px; font: 500 var(--t2)/1.3 var(--ui); color: var(--fg); }
.grp h4 .when { font-weight: 400; font-size: var(--t1); color: var(--fg-3); white-space: nowrap; }
.tiles { display: flex; flex-wrap: wrap; gap: var(--s2); }
.tile { position: relative; width: 78px; height: 78px; border-radius: var(--r1); }
.tile img { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: inherit;
  background: #2a2d31; cursor: pointer; }
.tile::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 2px transparent; transition: box-shadow .12s; }
.tile.keeper::after { box-shadow: inset 0 0 0 2px var(--keep); }
.tile.bin::after { box-shadow: inset 0 0 0 2px var(--gone); }
.tile.bin img { opacity: .45; }
.mark { position: absolute; top: -5px; left: -5px; width: 22px; height: 22px; padding: 0;
  -webkit-appearance: none; appearance: none;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  border: 2px solid var(--raised); cursor: pointer; color: #15201a; }
.mark svg { width: 12px; height: 12px; display: block; }
.tile.keeper .mark { background: var(--keep); }
.tile.bin .mark { background: var(--gone); color: #3a1411; }
.mark:hover { filter: brightness(1.12); }
.mark:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }

.ft { border-top: 1px solid var(--hair); padding: var(--s3) var(--s4); background: var(--chrome); }
.ft .row { margin: 0; justify-content: flex-end; }
.ft .del { min-width: 176px; }

.panel.maxed { inset: 0; width: auto; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
.panel.maxed .hd { padding: 12px var(--s3) 12px var(--s5); }
.panel.maxed .body { padding: 0 var(--s5) var(--s5); }
.panel.maxed .controls { position: sticky; top: 0; z-index: 2; background: var(--bg);
  display: flex; flex-direction: column; align-items: center;
  margin: 0 calc(var(--s5) * -1); padding: var(--s4) var(--s5) var(--s3);
  border-bottom: 1px solid var(--hair); }
.panel.maxed .controls > * { width: 100%; max-width: 1120px; }
.panel.maxed .fields { display: flex; align-items: center; padding: var(--s1) var(--s4); }
.panel.maxed .field { min-height: 44px; }
.panel.maxed .field:first-child { flex: 0 1 320px; }
.panel.maxed .field + .field { border-top: 0; border-left: 1px solid var(--hair);
  margin-left: var(--s4); padding-left: var(--s4); }
.panel.maxed .field .lbl { flex: 0 0 auto; }
.panel.maxed .bar { margin-top: var(--s3); }
.panel.maxed .results { max-width: 1120px; margin-left: auto; margin-right: auto; }
.panel.maxed .ft .row { width: 100%; max-width: 1120px; margin: 0 auto; }
.panel.maxed .grp { padding: var(--s4); margin-bottom: var(--s3); }
.panel.maxed .grp h4 { font-size: var(--t3); margin-bottom: var(--s3); }
.panel.maxed .tiles { gap: var(--s3); }
.panel.maxed .tile { width: auto; height: 220px; }
.panel.maxed .tile img { width: auto; height: 100%; object-fit: cover; background: none; }
.panel.maxed .tiles { align-items: flex-start; }
.panel.maxed .mark { width: 26px; height: 26px; top: -7px; left: -7px; }
.panel.maxed .mark svg { width: 14px; height: 14px; }

.preview { position: fixed; z-index: 2147483646; display: none; pointer-events: none;
  background: var(--bg); border: 1px solid var(--line); border-radius: var(--r2); padding: var(--s2);
  box-shadow: 0 20px 56px rgba(0,0,0,.7); }
.preview.on { display: block; }
.preview img { display: block; border-radius: var(--r1); background: #2a2d31;
  max-width: 100%; max-height: 100%; object-fit: contain; }
.preview b { display: block; margin-top: 6px; font: 400 var(--t1)/1.4 var(--ui);
  color: var(--fg-3); text-align: center; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

  const HTML = `
<div class="panel">
  <div class="hd"><b>Google Photos DeDuper</b><button class="max" title="Maximise"></button><button class="min" title="Minimise"></button></div>
  <div class="body">
    <div class="controls">
    <div class="warn" style="display:none"></div>
    <div class="fields">
      <label class="field"><span class="lbl">Similarity</span><input type="range" class="sim" min="70" max="100" value="92"><b class="simv">92%</b></label>
      <label class="field"><span class="lbl">Scan at most</span><input type="number" class="cap" value="2000" min="50" step="50"><span class="unit">photos</span></label>
      <label class="field"><span class="lbl">Include videos</span><input type="checkbox" class="vid"></label>
    </div>
    <div class="row">
      <button class="act scan">Scan</button>
      <button class="act sec stop" disabled>Stop</button>
      <button class="act ghost reset">Reset</button>
    </div>
    <div class="bar"><i></i></div>
    <div class="status">Idle.</div>
    <div class="log"></div>
    </div>
    <div class="results"></div>
  </div>
  <div class="ft">
    <div class="row">
      <button class="act sec dry" disabled>Dry run</button>
      <button class="act danger del" disabled>Move selected to bin</button>
    </div>
  </div>
</div>
<div class="preview"><img alt=""><b></b></div>`;

  function mount() {
    const host = document.createElement('div');
    host.id = 'gpdd-host';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.append(style);
    root.append(document.createRange().createContextualFragment(HTML));
    document.documentElement.append(host);

    const $ = (s) => root.querySelector(s);
    const ui = {
      host, root,
      panel: $('.panel'), warn: $('.warn'), sim: $('.sim'), simv: $('.simv'),
      cap: $('.cap'), vid: $('.vid'), scan: $('.scan'), stop: $('.stop'), reset: $('.reset'),
      bar: $('.bar i'), status: $('.status'), log: $('.log'), results: $('.results'),
      dry: $('.dry'), del: $('.del'), min: $('.min'),
      preview: $('.preview'), previewImg: $('.preview img'), previewCap: $('.preview b'),
      max: $('.max'),
    };

    // Both buttons reflect their state rather than always showing one icon.
    ui.syncChrome = () => {
      const collapsed = ui.panel.classList.contains('collapsed');
      const maxed = ui.panel.classList.contains('maxed');
      ui.min.innerHTML = collapsed ? ICON.expand : ICON.minimise;
      ui.min.title = collapsed ? 'Expand' : 'Minimise';
      ui.max.innerHTML = maxed ? ICON.restore : ICON.maximise;
      ui.max.title = maxed ? 'Restore' : 'Maximise';
      ui.min.style.display = maxed ? 'none' : '';
    };
    ui.min.onclick = () => {
      ui.panel.classList.toggle('collapsed');
      ui.syncChrome();
    };
    ui.isMaxed = () => ui.panel.classList.contains('maxed');
    ui.syncChrome();
    ui.sim.oninput = () => (ui.simv.textContent = ui.sim.value + '%');

    ui.setStatus = (t) => (ui.status.textContent = t);
    ui.setBar = (pct) => (ui.bar.style.width = Math.max(0, Math.min(100, pct)) + '%');
    ui.addLog = (t) => {
      ui.log.classList.add('on');
      ui.log.textContent += t + '\n';
      ui.log.scrollTop = ui.log.scrollHeight;
    };
    ui.setWarn = (t) => {
      ui.warn.style.display = t ? 'block' : 'none';
      ui.warn.textContent = t || '';
    };
    ui.toggle = () => (host.style.display = host.style.display === 'none' ? '' : 'none');
    return ui;
  }

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

  // Each group renders with one keeper (green) and the rest marked for deletion
  // (red). Clicking a thumbnail promotes it to keeper; clicking the corner badge
  // toggles whether that single item is deleted.
  function renderGroups(ui, groups, state, onChange) {
    ui.results.textContent = '';
    if (!groups.length) {
      ui.results.textContent = '';
      return;
    }
    // Maximised tiles are 200px, so they need a bigger render than the 144px
    // grid thumbnail, and the hover preview is redundant at that size.
    const maxed = !!(ui.isMaxed && ui.isMaxed());
    const frag = document.createDocumentFragment();
    groups.slice(0, 200).forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'grp';
      const h = document.createElement('h4');
      const when = g.items[0].ts ? new Date(g.items[0].ts).toLocaleDateString() : 'unknown date';
      const title = document.createElement('span');
      title.textContent = `${g.items.length} similar photos`;
      const date = document.createElement('span');
      date.className = 'when';
      date.textContent = when;
      h.append(title, date);
      box.append(h);
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      g.items.forEach((it) => {
        const t = document.createElement('div');
        const marked = state.toDelete.has(it.id);
        t.className = 'tile ' + (marked ? 'bin' : 'keeper');
        t.dataset.id = it.id;
        const img = document.createElement('img');
        img.src = maxed ? bigUrl(it.thumb || '', 512) : it.thumb || '';
        img.loading = 'lazy';
        img.alt = '';
        img.title = marked ? 'Keep this one instead' : 'Keeping this one';
        img.onclick = () => {
          g.items.forEach((o) => state.toDelete.add(o.id));
          state.toDelete.delete(it.id);
          onChange();
        };
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
        if (!maxed) attachPreview(ui, img, it);
        t.append(img, mark);
        tiles.append(t);
      });
      box.append(tiles);
      frag.append(box);
      if (gi === 199) {
        const more = document.createElement('div');
        more.className = 'note';
        more.textContent = `…and ${groups.length - 200} more groups (all of them are included in a delete run).`;
        frag.append(more);
      }
    });
    ui.results.append(frag);
  }

  window.GPDD.overlay = { mount, renderGroups, bigUrl };
})();
