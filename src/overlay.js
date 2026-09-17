// Panel lives in a shadow root so Google Photos' stylesheet cannot reach it and
// the panel's own styles cannot leak into the grid the scanner is reading.
window.GPDD = window.GPDD || {};

(() => {
  const CSS = `
:host { all: initial; }
.panel { position: fixed; right: 16px; bottom: 16px; width: 380px; max-height: 78vh;
  display: flex; flex-direction: column; z-index: 2147483647;
  font: 13px/1.45 'Google Sans', Roboto, system-ui, sans-serif;
  color: #e8eaed; background: #202124; border: 1px solid #3c4043; border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.55); overflow: hidden; }
.hd { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #282a2d; cursor: default; }
.hd b { font-weight: 500; font-size: 14px; flex: 1; }
.hd button { background: none; border: 0; color: #9aa0a6; font-size: 16px; cursor: pointer; padding: 2px 6px; }
.body { padding: 12px 14px; overflow: auto; }
.collapsed .body, .collapsed .ft { display: none; }
label { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 0; color: #bdc1c6; }
input[type=range] { flex: 1; accent-color: #8ab4f8; }
input[type=number] { width: 84px; background: #303134; color: #e8eaed; border: 1px solid #5f6368; border-radius: 4px; padding: 4px 6px; }
input[type=checkbox] { accent-color: #8ab4f8; }
.row { display: flex; gap: 8px; margin-top: 12px; }
button.act { flex: 1; padding: 9px 10px; border-radius: 18px; border: 0; cursor: pointer;
  background: #8ab4f8; color: #202124; font-weight: 500; font-size: 13px; }
button.act.sec { background: transparent; color: #8ab4f8; border: 1px solid #5f6368; }
button.act.danger { background: #f28b82; color: #202124; }
.ft button.act { min-width: 152px; white-space: nowrap; }
button.act:disabled { opacity: .45; cursor: default; }
.bar { height: 4px; background: #3c4043; border-radius: 2px; overflow: hidden; margin: 10px 0 4px; }
.bar i { display: block; height: 100%; background: #8ab4f8; width: 0; transition: width .2s; }
.status { color: #9aa0a6; font-size: 12px; min-height: 16px; }
.log { margin-top: 8px; max-height: 88px; overflow: auto; font: 11px/1.5 ui-monospace, monospace; color: #9aa0a6;
  background: #17181a; border-radius: 6px; padding: 6px 8px; white-space: pre-wrap; display: none; }
.log.on { display: block; }
.grp { border-top: 1px solid #3c4043; padding: 10px 0; }
.grp h4 { margin: 0 0 6px; font-size: 12px; font-weight: 500; color: #bdc1c6; }
.tiles { display: flex; gap: 6px; flex-wrap: wrap; }
.tile { position: relative; width: 66px; }
.tile img { width: 66px; height: 66px; object-fit: cover; border-radius: 6px; display: block;
  border: 2px solid transparent; background: #303134; }
.tile.keep img { border-color: #81c995; }
.tile.del img { border-color: #f28b82; opacity: .55; }
.tile span { display: block; text-align: center; font-size: 10px; margin-top: 2px; color: #9aa0a6; cursor: pointer; }
.warn { background: #3b2f1c; color: #fdd663; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; }
.ft { border-top: 1px solid #3c4043; padding: 10px 14px; background: #282a2d; }
`;

  const HTML = `
<div class="panel">
  <div class="hd"><b>Google Photos DeDuper</b><button class="min">–</button></div>
  <div class="body">
    <div class="warn" style="display:none"></div>
    <label>Similarity <input type="range" class="sim" min="70" max="100" value="92"><b class="simv">92%</b></label>
    <label>Scan at most <input type="number" class="cap" value="2000" min="50" step="50"></label>
    <label>Include videos <input type="checkbox" class="vid"></label>
    <div class="row">
      <button class="act scan">Scan</button>
      <button class="act sec stop" disabled>Stop</button>
      <button class="act sec reset">Reset</button>
    </div>
    <div class="bar"><i></i></div>
    <div class="status">Idle.</div>
    <div class="log"></div>
    <div class="results"></div>
  </div>
  <div class="ft">
    <div class="row" style="margin:0">
      <button class="act sec dry" disabled>Dry run</button>
      <button class="act danger del" disabled>Move selected to bin</button>
    </div>
  </div>
</div>`;

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
    };

    ui.min.onclick = () => ui.panel.classList.toggle('collapsed');
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

  // Each group renders with one keeper (green) and the rest marked for deletion
  // (red). Clicking a thumbnail promotes it to keeper; clicking the caption
  // toggles whether that single item is deleted.
  function renderGroups(ui, groups, state, onChange) {
    ui.results.textContent = '';
    if (!groups.length) {
      ui.results.textContent = '';
      return;
    }
    const frag = document.createDocumentFragment();
    groups.slice(0, 200).forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'grp';
      const h = document.createElement('h4');
      const when = g.items[0].ts ? new Date(g.items[0].ts).toLocaleDateString() : 'unknown date';
      h.textContent = `${g.items.length} similar · ${when}`;
      box.append(h);
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      g.items.forEach((it) => {
        const t = document.createElement('div');
        const marked = state.toDelete.has(it.id);
        t.className = 'tile ' + (marked ? 'del' : 'keep');
        const img = document.createElement('img');
        img.src = it.thumb || '';
        img.loading = 'lazy';
        img.title = it.id;
        img.onclick = () => {
          g.items.forEach((o) => state.toDelete.add(o.id));
          state.toDelete.delete(it.id);
          onChange();
        };
        const cap = document.createElement('span');
        cap.textContent = marked ? 'delete' : 'keep';
        cap.onclick = () => {
          if (state.toDelete.has(it.id)) state.toDelete.delete(it.id);
          else state.toDelete.add(it.id);
          onChange();
        };
        t.append(img, cap);
        tiles.append(t);
      });
      box.append(tiles);
      frag.append(box);
      if (gi === 199) {
        const more = document.createElement('div');
        more.className = 'status';
        more.textContent = `…and ${groups.length - 200} more groups (all of them are included in a delete run).`;
        frag.append(more);
      }
    });
    ui.results.append(frag);
  }

  window.GPDD.overlay = { mount, renderGroups };
})();
