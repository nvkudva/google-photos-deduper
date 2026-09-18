// Panel lives in a shadow root so Google Photos' stylesheet cannot reach it and
// the panel's own styles cannot leak into the grid the scanner is reading.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { CSS, ICON, buildRange } = window.GPDD.ui;

  const HTML = /* html */ `
<div class="panel">
  <div class="hd"><b>Photo DeDuper</b><button class="min" title="Minimise"></button></div>
  <div class="body">
    <div class="controls">
    <div class="warn" style="display:none"></div>
    <div class="range">
      <div class="top">
        <span class="lbl">Range</span>
        <button class="pill p-new" type="button"></button>
        <span class="dash">&ndash;</span>
        <button class="pill p-old" type="button"></button>
        <div class="pop pop-new"></div>
        <div class="pop pop-old"></div>
      </div>
      <div class="scrub cold">
        <div class="spark"></div>
        <div class="sel"></div>
        <div class="hand h-new"></div>
        <div class="hand h-old"></div>
      </div>
      <div class="ticks"></div>
      <div class="rest"><span class="est"></span><button class="all" type="button">Whole library</button></div>
    </div>
    <div class="fields">
      <label class="field"><span class="lbl">Similarity</span><input type="range" class="sim" min="70" max="100" value="92"><b class="simv">92%</b></label>
      <label class="field"><span class="lbl">Scan at most</span><input type="number" class="cap" value="2000" min="50" step="50"><span class="unit">photos</span></label>
    </div>
    <div class="row actions">
      <button class="act ghost reset">Reset</button>
      <button class="act sec stop" disabled>Stop</button>
      <button class="act scan">Scan</button>
    </div>
    <div class="bar"><i></i></div>
    <div class="srow"><span class="spin" aria-hidden="true"></span><div class="status">Idle.</div><button class="act sec undo" type="button" style="display:none">Undo</button></div>
    <div class="log"></div>
    </div>
    <div class="results"></div>
  </div>
  <div class="ft">
    <div class="row">
      <span class="hint">Recoverable from the bin.</span>
      <button class="act danger del" disabled><span class="spin" aria-hidden="true"></span><span class="dellbl">Move selected to bin</span></button>
    </div>
  </div>
</div>
<div class="scanbar"><span class="msg"></span><button class="act sec scanstop" type="button">Stop</button></div>
<div class="preview"><img alt=""><b></b></div>
`;

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
      cap: $('.cap'), scan: $('.scan'), stop: $('.stop'), reset: $('.reset'),
      bar: $('.bar i'), status: $('.status'), log: $('.log'), results: $('.results'),
      undo: $('.undo'),
      del: $('.del'), dellbl: $('.dellbl'), min: $('.min'),
      scanbar: $('.scanbar'), scanmsg: $('.scanbar .msg'), scanstop: $('.scanstop'),
      preview: $('.preview'), previewImg: $('.preview img'), previewCap: $('.preview b'),
      range: null,
    };
    ui.range = buildRange(ui, $);
    ui.del.insertAdjacentHTML('afterbegin', ICON.bin);

    // The button reflects its state rather than always showing one icon.
    ui.syncChrome = () => {
      const collapsed = ui.panel.classList.contains('collapsed');
      ui.min.innerHTML = collapsed ? ICON.expand : ICON.minimise;
      ui.min.title = collapsed ? 'Expand' : 'Minimise';
    };
    ui.min.onclick = () => {
      ui.panel.classList.toggle('collapsed');
      ui.syncChrome();
    };
    ui.syncChrome();
    ui.sim.oninput = () => (ui.simv.textContent = ui.sim.value + '%');

    // While a scan runs the panel steps aside for a compact bar.
    ui.setScanning = (on) => {
      ui.panel.style.display = on ? 'none' : '';
      ui.scanbar.classList.toggle('on', on);
    };
    ui.setStatus = (t, { keepUndo = false } = {}) => {
      ui.status.textContent = t;
      ui.scanmsg.textContent = t;
      if (!keepUndo) ui.undo.style.display = 'none';
    };
    // Offered only after a delete that actually binned something, and withdrawn
    // by the next status line, so it never points at a run that is no longer
    // the last one.
    ui.setUndo = (n) => {
      ui.undo.style.display = n ? '' : 'none';
      ui.undo.disabled = false;
      ui.undo.textContent = n ? `Undo ${n}` : 'Undo';
      ui.undo.title = n ? `Put ${n} back from the bin` : '';
    };
    // Deleting has no percentage worth showing - it is a handful of requests,
    // not a per-photo walk - so the wheel says "working" and the status line
    // carries the count.
    ui.setBusy = (on) => {
      ui.panel.classList.toggle('busy', on);
      ui.panel.setAttribute('aria-busy', on ? 'true' : 'false');
    };
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

  window.GPDD.ui.mount = mount;
})();
