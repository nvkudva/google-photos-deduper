// Panel lives in a shadow root so Google Photos' stylesheet cannot reach it and
// the panel's own styles cannot leak into the grid the scanner is reading.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { CSS, ICON, range, preview } = window.GPDD.ui;

  const HTML = /* html */ `
<div class="panel" data-ref="panel">
  <div class="hd"><b>Photo DeDuper</b><button class="min" data-ref="min" title="Minimise"></button></div>
  <div class="body">
    <div class="controls">
    <div class="warn" data-ref="warn" style="display:none"></div>
    ${range.HTML}
    <div class="fields">
      <label class="field"><span class="lbl">Similarity</span><input type="range" class="sim" data-ref="sim" min="70" max="100" value="92"><b class="simv" data-ref="simv">92%</b></label>
      <label class="field"><span class="lbl">Scan at most</span><input type="number" class="cap" data-ref="cap" value="2000" min="50" step="50"><span class="unit">photos</span></label>
    </div>
    <div class="row actions">
      <button class="act ghost reset" data-ref="reset">Reset</button>
      <button class="act sec stop" data-ref="stop" disabled>Stop</button>
      <button class="act scan" data-ref="scan">Scan</button>
    </div>
    <div class="bar"><i data-ref="bar"></i></div>
    <div class="srow"><span class="spin" aria-hidden="true"></span><div class="status" data-ref="status">Idle.</div><button class="act sec undo" data-ref="undo" type="button" style="display:none">Undo</button></div>
    <div class="log" data-ref="log"></div>
    </div>
    <div class="results" data-ref="results"></div>
  </div>
  <div class="ft">
    <div class="row">
      <span class="hint">Recoverable from the bin.</span>
      <button class="act danger del" data-ref="del" disabled><span class="spin" aria-hidden="true"></span><span class="dellbl" data-ref="dellbl">Move selected to bin</span></button>
    </div>
  </div>
</div>
<div class="scanbar" data-ref="scanbar"><span class="msg" data-ref="scanmsg"></span><button class="act sec scanstop" data-ref="scanstop" type="button">Stop</button></div>
${preview.HTML}
`;

  function mount() {
    const host = document.createElement("div");
    host.id = "gpdd-host";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
    root.append(document.createRange().createContextualFragment(HTML));
    document.documentElement.append(host);

    const $ = (s) => root.querySelector(s);
    // Every handle the panel needs is declared on the element itself, so adding
    // one is a markup change rather than a markup change plus a lookup.
    const ui = { host, root, range: null };
    root.querySelectorAll('[data-ref]').forEach((n) => { ui[n.dataset.ref] = n; });
    ui.range = range.build(ui, $);
    ui.del.insertAdjacentHTML("afterbegin", ICON.bin);

    // The button reflects its state rather than always showing one icon.
    ui.syncChrome = () => {
      const collapsed = ui.panel.classList.contains("collapsed");
      ui.min.innerHTML = collapsed ? ICON.expand : ICON.minimise;
      ui.min.title = collapsed ? "Expand" : "Minimise";
    };
    ui.min.onclick = () => {
      ui.panel.classList.toggle("collapsed");
      ui.syncChrome();
    };
    ui.syncChrome();
    ui.sim.oninput = () => (ui.simv.textContent = ui.sim.value + "%");

    // While a scan runs the panel steps aside for a compact bar.
    ui.setScanning = (on) => {
      ui.panel.style.display = on ? "none" : "";
      ui.scanbar.classList.toggle("on", on);
    };
    ui.setStatus = (t, { keepUndo = false } = {}) => {
      ui.status.textContent = t;
      ui.scanmsg.textContent = t;
      if (!keepUndo) ui.undo.style.display = "none";
    };
    // Offered only after a delete that actually binned something, and withdrawn
    // by the next status line, so it never points at a run that is no longer
    // the last one.
    ui.setUndo = (n) => {
      ui.undo.style.display = n ? "" : "none";
      ui.undo.disabled = false;
      ui.undo.textContent = n ? `Undo ${n}` : "Undo";
      ui.undo.title = n ? `Put ${n} back from the bin` : "";
    };
    // Deleting has no percentage worth showing - it is a handful of requests,
    // not a per-photo walk - so the wheel says "working" and the status line
    // carries the count.
    ui.setBusy = (on) => {
      ui.panel.classList.toggle("busy", on);
      ui.panel.setAttribute("aria-busy", on ? "true" : "false");
    };
    ui.setBar = (pct) => (ui.bar.style.width = Math.max(0, Math.min(100, pct)) + "%");
    ui.addLog = (t) => {
      ui.log.classList.add("on");
      ui.log.textContent += t + "\n";
      ui.log.scrollTop = ui.log.scrollHeight;
    };
    ui.setWarn = (t) => {
      ui.warn.style.display = t ? "block" : "none";
      ui.warn.textContent = t || "";
    };
    ui.toggle = () => (host.style.display = host.style.display === "none" ? "" : "none");
    return ui;
  }

  window.GPDD.ui.mount = mount;
})();
