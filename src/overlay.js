// Panel lives in a shadow root so Google Photos' stylesheet cannot reach it and
// the panel's own styles cannot leak into the grid the scanner is reading.
window.GPDD = window.GPDD || {};

(() => {
  // Inline only: the extension must render with no network of any kind.
  const ICON = {
    // Google Photos' own bin glyph, lifted from the sidebar so the button that
    // does the deleting looks like the place the photos end up.
    bin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zM9 8h2v9H9zm4 0h2v9h-2z"/></svg>',
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
  /* Sampled from photos.google.com itself: page #131314, cards #1e1f20, the
     search pill #282a2c, selected nav #004a77 on #c2e7ff. */
  --bg: #1e1f20; --raised: #282a2c; --sunken: #131314; --chrome: #1b1b1b;
  --line: #444746; --hair: #303133;
  --fg: #e3e3e3; --fg-2: #c4c7c5; --fg-3: #8e918f;
  --accent: #a8c7fa; --accent-ink: #062e6f; --accent-soft: rgba(168,199,250,.12);
  --keep: #81c995; --gone: #f28b82; --gone-soft: rgba(242,139,130,.12); --note: #fdd663;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px;
  --r1: 8px; --r2: 12px; --r3: 16px;
  --t1: 11px; --t2: 12px; --t3: 13px; --t4: 15px;
  /* Exactly the stack photos.google.com sets on its own body, so the panel
     renders in the same face as the page it sits on. */
  --ui: 'Google Sans Text', 'Google Sans', Roboto, Arial, sans-serif;
  /* all:initial above resets inheritance, so the face has to be re-stated
     here or anything outside .panel - the scanning bar, the preview - falls
     back to the browser default. */
  font: 400 var(--t3)/1.5 var(--ui);
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
.hd button:hover { background: var(--raised); color: var(--fg); }
.hd button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.body { padding: var(--s4); overflow: auto; overscroll-behavior: contain; }
.collapsed .body, .collapsed .ft { display: none; }

.fields { margin: var(--s4) 0; background: var(--raised); border: 1px solid var(--hair);
  border-radius: var(--r2); padding: 0 var(--s3); }
.field { display: flex; align-items: center; gap: var(--s3); min-height: 40px; color: var(--fg-2); cursor: default; }
.field + .field { border-top: 1px solid var(--hair); }
.field .lbl { flex: 0 0 96px; }
.unit { color: var(--fg-3); font-size: var(--t2); }

.range { background: var(--raised); border: 1px solid var(--hair); border-radius: var(--r2);
  padding: var(--s3); margin-bottom: var(--s3); }
.range .top { display: flex; align-items: center; gap: var(--s2); position: relative; }
.range .top .lbl { flex: 1 1 auto; color: var(--fg-2); font-size: var(--t3); }
.range .top .dash { color: var(--fg-3); font-size: var(--t2); }
button.pill { flex: 0 0 auto; font: 400 var(--t1)/1.45 var(--ui); padding: 4px 9px;
  border-radius: 999px; background: var(--sunken); border: 1px solid var(--hair);
  color: var(--fg); cursor: pointer; font-variant-numeric: tabular-nums; white-space: nowrap; }
button.pill:hover { border-color: var(--line); }
button.pill.open { background: var(--accent-soft); border-color: var(--accent); }
button.pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button.pill i { font-style: normal; color: var(--fg-3); margin-left: 5px; font-size: 10px; }

.pop { position: absolute; top: calc(100% + 6px); z-index: 6; width: 176px; padding: var(--s2);
  background: var(--raised); border: 1px solid var(--line); border-radius: var(--r2);
  box-shadow: 0 10px 26px rgba(0,0,0,.6); display: none; }
.pop.on { display: block; }
.pop .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
.pop .nav b { font: 500 var(--t1)/1.2 var(--ui); color: var(--fg); font-variant-numeric: tabular-nums; }
.pop .nav button { width: 20px; height: 20px; padding: 0; border: 0; border-radius: var(--r1);
  background: transparent; color: var(--fg-3); cursor: pointer; font: 400 10px/1 var(--ui); }
.pop .nav button:hover:not(:disabled) { background: var(--sunken); color: var(--fg); }
.pop .nav button:disabled { opacity: .25; cursor: default; }
.pop .mg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
.pop .mg button { padding: 5px 0; border: 0; border-radius: var(--r1); background: transparent;
  color: var(--fg-2); cursor: pointer; font: 400 10px/1.2 var(--ui); }
.pop .mg button:hover:not(:disabled) { background: var(--sunken); color: var(--fg); }
.pop .mg button.on { background: var(--accent); color: var(--accent-ink); font-weight: 500; }
.pop .mg button:disabled { opacity: .2; cursor: default; }

.scrub { position: relative; height: 44px; margin-top: var(--s2); border-radius: var(--r1);
  background: var(--sunken); overflow: hidden; touch-action: none; }
.scrub .spark { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 1px; padding: 0 1px; }
.scrub .spark b { flex: 1; min-height: 1px; background: #444746; border-radius: 1px 1px 0 0; }
.scrub.cold .spark { display: none; }
.scrub.cold::before { content: ''; position: absolute; inset: 0; opacity: .5;
  background: repeating-linear-gradient(135deg, transparent 0 5px, #303133 5px 6px); }
.sel { position: absolute; top: 0; bottom: 0; background: var(--accent-soft);
  border-left: 2px solid var(--accent); border-right: 2px solid var(--accent); }
.hand { position: absolute; top: 50%; width: 10px; height: 24px; margin-top: -12px;
  background: var(--accent); border-radius: 3px; cursor: ew-resize;
  box-shadow: 0 1px 4px rgba(0,0,0,.5); }
.ticks { display: flex; justify-content: space-between; margin-top: 5px;
  color: var(--fg-3); font: 400 10px/1 var(--ui); font-variant-numeric: tabular-nums; }
.rest { display: flex; align-items: baseline; gap: var(--s2); margin-top: var(--s2); }
.rest .est { flex: 1 1 auto; color: var(--fg-3); font-size: var(--t1); }
.rest .all { border: 0; background: transparent; padding: 0; cursor: pointer;
  color: var(--accent); font: 400 var(--t1)/1.2 var(--ui); }
.rest .all:disabled { color: var(--fg-3); cursor: default; }
.panel.maxed .range { margin: 0; }

/* Shown in place of the panel while a scan runs. The panel used to be hidden
   and restored around every screenshot, which read as a flicker once a second;
   this stays put, and its rect is excluded from hashing instead. */
.scanbar { display: none; position: fixed; right: var(--s4); bottom: var(--s4); z-index: 2147483646;
  align-items: center; gap: var(--s3); max-width: 380px;
  padding: 10px var(--s3) 10px var(--s4); border-radius: 999px;
  background: var(--chrome); border: 1px solid var(--line); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.scanbar.on { display: flex; }
.scanbar .msg { flex: 1 1 auto; color: var(--fg-2); font-size: var(--t2); line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scanbar .act { padding: 5px 13px; font-size: var(--t2); }
.simv { min-width: 34px; text-align: right; font: 500 var(--t3)/1 var(--ui);
  color: var(--fg); font-variant-numeric: tabular-nums; }

input[type=range] { flex: 1; min-width: 60px; height: 18px; margin: 0; cursor: pointer;
  -webkit-appearance: none; appearance: none; background: transparent; }
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: #444746; }
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
button.act:hover:not(:disabled) { background: #c2ddff; }
button.act.sec { background: transparent; color: var(--accent); border-color: var(--line); }
button.act.sec:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
button.act.ghost { background: transparent; color: var(--fg-3); border-color: transparent; padding: 8px 12px; }
button.act.ghost:hover:not(:disabled) { background: var(--gone-soft); color: var(--gone); }
button.act.danger { background: var(--gone); color: #3a1411; }
button.act.danger:hover:not(:disabled) { background: #f5a49d; }
button.act:disabled { opacity: .38; cursor: default; }
button.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scan { min-width: 92px; }
.row.actions { justify-content: flex-end; }
.reset { margin-right: auto; }

.bar { height: 3px; background: #303133; border-radius: 999px; overflow: hidden; margin: var(--s4) 0 var(--s2); }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 999px; transition: width .25s ease; }
.status { min-height: 18px; color: var(--fg-2); font-size: var(--t2); line-height: 1.5; }
.note { color: var(--fg-3); font-size: var(--t2); padding: var(--s2) var(--s1) 0; }
.log { display: none; margin-top: var(--s3); max-height: 96px; overflow: auto;
  font: 400 11px/1.6 var(--ui); color: var(--fg-3);
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
/* Four to a row whatever the panel width, rather than a fixed tile size that
   silently drops to three when the column is a few pixels short. */
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s2); }
.tile { position: relative; aspect-ratio: 1; border-radius: var(--r1); }
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
.ft .row { margin: 0; gap: var(--s3); }
.ft .hint { flex: 1 1 auto; color: var(--fg-3); font-size: var(--t1); line-height: 1.4; }
.ft .del { flex: 0 0 auto; min-width: 176px; display: inline-flex; align-items: center;
  justify-content: center; gap: 7px; }
.ft .del svg { flex: 0 0 auto; width: 16px; height: 16px; fill: currentColor; }

/* Inset from every edge so the maximised state reads as a popup over Google
   Photos rather than a replacement for it. */
.panel.maxed { inset: min(48px, 5vh) min(64px, 5vw); width: auto; max-height: none;
  border: 1px solid var(--hair); border-radius: var(--r2);
  box-shadow: 0 32px 80px rgba(0,0,0,.65); }
.panel.maxed .hd { padding: 12px var(--s3) 12px var(--s5); }
.panel.maxed .body { padding: 0 var(--s5) var(--s5); }
.panel.maxed .controls { position: sticky; top: 0; z-index: 2; background: var(--bg);
  display: flex; flex-direction: column; align-items: center;
  margin: 0 calc(var(--s5) * -1); padding: var(--s4) var(--s5) var(--s3);
  border-bottom: 1px solid var(--hair); }
.panel.maxed .controls > * { width: 100%; max-width: none; }
.panel.maxed .fields { display: flex; align-items: center; margin: var(--s3) 0; padding: var(--s1) var(--s4); }
.panel.maxed .field { min-height: 44px; }
.panel.maxed .field:first-child { flex: 0 1 320px; }
.panel.maxed .field + .field { border-top: 0; border-left: 1px solid var(--hair);
  margin-left: var(--s4); padding-left: var(--s4); }
.panel.maxed .field .lbl { flex: 0 0 auto; }
.panel.maxed .bar { margin-top: var(--s3); }
.panel.maxed .results { max-width: none; }
.panel.maxed .ft .row { width: 100%; max-width: none; }
.panel.maxed .grp { display: flex; align-items: stretch; gap: var(--s4);
  padding: var(--s4); margin-bottom: var(--s3); }
/* The count and date share one cell as the row's first column, so the photos
   get the full remaining width instead of sitting under a heading. */
.panel.maxed .grp h4 { flex: 0 0 132px; display: flex; flex-direction: column;
  align-items: flex-start; justify-content: center; gap: 2px; margin-bottom: 0;
  font-size: var(--t3); padding-right: var(--s4); border-right: 1px solid var(--hair); }
.panel.maxed .grp h4 .when { white-space: nowrap; }
.panel.maxed .tiles { display: flex; flex-wrap: wrap; flex: 1 1 auto; min-width: 0; align-items: flex-start; }
.panel.maxed .tiles { gap: var(--s3); }
.panel.maxed .tile { width: auto; height: 240px; aspect-ratio: auto; }
.panel.maxed .tile img { width: auto; height: 100%; object-fit: cover; background: none; }
.panel.maxed .tiles { align-items: flex-start; }
.panel.maxed .mark { width: 26px; height: 26px; top: -7px; left: -7px; }
.panel.maxed .mark svg { width: 14px; height: 14px; }

/* Must outrank .panel, which the maximised state paints opaque over the whole
   viewport; the scrim sits after it in the DOM so an equal z-index wins. */
.scrim { position: fixed; inset: 0; z-index: 2147483647; display: none;
  background: rgba(0,0,0,.72); align-items: center; justify-content: center; }
.scrim.on { display: flex; }
.modal { background: var(--raised); border: 1px solid var(--hair); border-radius: var(--r2);
  padding: var(--s3); box-shadow: 0 24px 64px rgba(0,0,0,.6); max-width: 88vw; max-height: 88vh;
  display: flex; flex-direction: column; gap: var(--s3); }
.modal img { display: block; border-radius: var(--r1); object-fit: contain;
  max-width: 84vw; max-height: 72vh; background: var(--sunken); }
.modal .mbar { display: flex; align-items: center; gap: var(--s3); }
.nums { display: flex; gap: var(--s1); }
.num { width: 30px; height: 30px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line); background: transparent; color: var(--fg-2);
  font: 500 var(--t2)/1 var(--ui); }
.num:hover { background: var(--chrome); color: var(--fg); }
.num.now { background: var(--fg); border-color: var(--fg); color: var(--bg); }
/* A ring marks whichever photo is currently the keeper, so switching between
   them shows what the decision is without leaving the dialog. */
.num.kept { box-shadow: 0 0 0 2px var(--keep); }
.modal .mcap { flex: 1 1 auto; font-size: var(--t1); color: var(--fg-3); }
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
      <label class="field"><span class="lbl">Include videos</span><input type="checkbox" class="vid"></label>
    </div>
    <div class="row actions">
      <button class="act ghost reset">Reset</button>
      <button class="act sec stop" disabled>Stop</button>
      <button class="act scan">Scan</button>
    </div>
    <div class="bar"><i></i></div>
    <div class="status">Idle.</div>
    <div class="log"></div>
    </div>
    <div class="results"></div>
  </div>
  <div class="ft">
    <div class="row">
      <span class="hint">Recoverable from the bin.</span>
      <button class="act danger del" disabled><span class="dellbl">Move selected to bin</span></button>
    </div>
  </div>
</div>
<div class="scanbar"><span class="msg"></span><button class="act sec scanstop" type="button">Stop</button></div>
<div class="preview"><img alt=""><b></b></div>
<div class="scrim"><div class="modal" role="dialog" aria-modal="true">
  <img alt="">
  <div class="mbar">
    <div class="nums"></div>
    <span class="mcap"></span>
    <button class="act sec mkeep" type="button">Keep this one</button>
    <button class="act sec mclose" type="button">Close</button>
  </div>
</div></div>`;

  // Scan range. The axis runs newest-on-the-left, matching the order Google
  // Photos itself lays the grid out in, so dragging left-to-right reads as
  // walking backwards in time. Months are handled as a single integer
  // (year * 12 + month) throughout; only get() converts back to timestamps.
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BARS = 48;
  const miOfDate = (d) => d.getFullYear() * 12 + d.getMonth();
  const msOfMi = (mi) => new Date(Math.floor(mi / 12), mi % 12, 1).getTime();
  const fmtMi = (mi) => MON[mi % 12] + ' ' + Math.floor(mi / 12);

  function buildRange(ui, $) {
    const els = {
      wrap: $('.range'), top: $('.range .top'),
      pNew: $('.p-new'), pOld: $('.p-old'), popNew: $('.pop-new'), popOld: $('.pop-old'),
      scrub: $('.scrub'), spark: $('.spark'), sel: $('.sel'),
      hNew: $('.h-new'), hOld: $('.h-old'), ticks: $('.ticks'),
      est: $('.rest .est'), all: $('.rest .all'),
    };

    const now = miOfDate(new Date());
    // Until a scan has filled the histogram there is nothing to say where the
    // library starts, so the axis assumes a generous span and the sparkline
    // renders as hatching rather than as a fake distribution.
    const R = { hi: now, lo: now - 20 * 12, from: now - 20 * 12, to: now, hist: new Map(), onchange: null };

    const span = () => R.hi + 1 - R.lo;
    const x = (b) => ((R.hi + 1 - b) / span()) * 100;
    const isFull = () => R.from <= R.lo && R.to >= R.hi;

    let openPop = -1; // 0 = newer pill, 1 = older pill
    const viewY = [0, 0];

    function shut() {
      openPop = -1;
      els.popNew.classList.remove('on'); els.popOld.classList.remove('on');
      els.pNew.classList.remove('open'); els.pOld.classList.remove('open');
    }

    function drawPop(which) {
      const el = which ? els.popOld : els.popNew;
      const val = which ? R.from : R.to;
      const y = viewY[which];
      const loY = Math.floor(R.lo / 12), hiY = Math.floor(R.hi / 12);
      el.textContent = '';
      const nav = document.createElement('div');
      nav.className = 'nav';
      const back = document.createElement('button');
      back.type = 'button'; back.textContent = '◀'; back.disabled = y <= loY;
      const label = document.createElement('b');
      label.textContent = String(y);
      const fwd = document.createElement('button');
      fwd.type = 'button'; fwd.textContent = '▶'; fwd.disabled = y >= hiY;
      back.onclick = (e) => { e.stopPropagation(); viewY[which]--; drawPop(which); };
      fwd.onclick = (e) => { e.stopPropagation(); viewY[which]++; drawPop(which); };
      nav.append(back, label, fwd);
      const mg = document.createElement('div');
      mg.className = 'mg';
      for (let m = 0; m < 12; m++) {
        const mi = y * 12 + m;
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = MON[m];
        b.disabled = mi < R.lo || mi > R.hi;
        if (mi === val) b.classList.add('on');
        b.onclick = (e) => {
          e.stopPropagation();
          if (which) R.from = mi; else R.to = mi;
          shut();
          commit();
        };
        mg.append(b);
      }
      el.append(nav, mg);
    }

    function showPop(which) {
      const was = openPop;
      shut();
      if (was === which) return;
      openPop = which;
      viewY[which] = Math.floor((which ? R.from : R.to) / 12);
      drawPop(which);
      (which ? els.popOld : els.popNew).classList.add('on');
      (which ? els.pOld : els.pNew).classList.add('open');
    }

    function drawSpark() {
      const cold = R.hist.size === 0;
      els.scrub.classList.toggle('cold', cold);
      if (cold) { els.spark.textContent = ''; return; }
      const buckets = new Array(BARS).fill(0);
      R.hist.forEach((n, mi) => {
        if (mi < R.lo || mi > R.hi) return;
        const i = Math.min(BARS - 1, Math.floor(((R.hi - mi) / span()) * BARS));
        buckets[i] += n;
      });
      const peak = Math.max(1, ...buckets);
      els.spark.textContent = '';
      buckets.forEach((n) => {
        const b = document.createElement('b');
        b.style.height = Math.round((n / peak) * 100) + '%';
        els.spark.append(b);
      });
    }

    function drawTicks() {
      els.ticks.textContent = '';
      for (let i = 0; i < 5; i++) {
        const mi = Math.round(R.hi - (i / 4) * (span() - 1));
        const t = document.createElement('span');
        t.textContent = i === 0 ? 'now' : String(Math.floor(mi / 12));
        els.ticks.append(t);
      }
    }

    function draw() {
      if (R.from > R.to) { const t = R.from; R.from = R.to; R.to = t; }
      R.from = Math.max(R.lo, Math.min(R.hi, R.from));
      R.to = Math.max(R.lo, Math.min(R.hi, R.to));
      const left = x(R.to + 1), right = x(R.from);
      els.sel.style.left = left + '%';
      els.sel.style.right = 100 - right + '%';
      // Clamped inside the track: at full range the handles would otherwise sit
      // half outside it and be clipped, leaving nothing to grab.
      const place = (pc) => 'clamp(0px, calc(' + pc + '% - 5px), calc(100% - 10px))';
      els.hNew.style.left = place(left);
      els.hOld.style.left = place(right);
      els.pNew.innerHTML = '';
      els.pNew.append(fmtMi(R.to), Object.assign(document.createElement('i'), { textContent: '▾' }));
      els.pOld.innerHTML = '';
      els.pOld.append(fmtMi(R.from), Object.assign(document.createElement('i'), { textContent: '▾' }));
      els.all.disabled = isFull();

      const months = R.to - R.from + 1;
      let scanned = 0;
      R.hist.forEach((n, mi) => { if (mi >= R.from && mi <= R.to) scanned += n; });
      els.est.textContent = isFull()
        ? (R.hist.size ? scanned.toLocaleString() + ' photos already scanned' : 'Whole library')
        : months + (months === 1 ? ' month' : ' months') +
          (R.hist.size ? ' · ' + scanned.toLocaleString() + ' already scanned' : ' · not scanned yet');
    }

    function commit() { draw(); if (R.onchange) R.onchange(); }

    function drag(el, set) {
      el.onpointerdown = (e) => {
        e.preventDefault();
        shut();
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const r = els.scrub.getBoundingClientRect();
          const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
          set(Math.max(R.lo, Math.min(R.hi, Math.floor(R.hi + 1 - f * span()))));
          draw();
        };
        move(e);
        el.onpointermove = move;
        el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; commit(); };
      };
    }
    drag(els.hNew, (v) => (R.to = v));
    drag(els.hOld, (v) => (R.from = v));

    els.pNew.onclick = (e) => { e.stopPropagation(); showPop(0); };
    els.pOld.onclick = (e) => { e.stopPropagation(); showPop(1); };
    els.all.onclick = () => { R.from = R.lo; R.to = R.hi; commit(); };
    ui.root.addEventListener('click', (e) => { if (!els.top.contains(e.composedPath()[0])) shut(); });
    document.addEventListener('click', shut);

    draw(); drawSpark(); drawTicks();

    return {
      // Counts per month, from whatever is already in the store. Also fixes the
      // left edge of the axis: the library cannot start before its oldest row.
      setHistogram(items) {
        const wasFull = isFull();
        R.hist = new Map();
        let oldest = R.hi;
        items.forEach((i) => {
          if (!i.ts) return;
          const mi = miOfDate(new Date(i.ts));
          R.hist.set(mi, (R.hist.get(mi) || 0) + 1);
          if (mi < oldest) oldest = mi;
        });
        if (R.hist.size) R.lo = Math.min(R.lo, oldest);
        if (wasFull) { R.from = R.lo; R.to = R.hi; }
        draw(); drawSpark(); drawTicks();
      },
      get() {
        return {
          full: isFull(),
          label: fmtMi(R.to) + ' – ' + fmtMi(R.from), // newest first, as the pills read
          fromMs: isFull() ? null : msOfMi(R.from),
          toMs: isFull() ? null : msOfMi(R.to + 1), // exclusive
        };
      },
      set onchange(fn) { R.onchange = fn; },
    };
  }

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
      del: $('.del'), dellbl: $('.dellbl'), min: $('.min'),
      scanbar: $('.scanbar'), scanmsg: $('.scanbar .msg'), scanstop: $('.scanstop'),
      preview: $('.preview'), previewImg: $('.preview img'), previewCap: $('.preview b'),
      scrim: $('.scrim'), modalImg: $('.modal img'), modalCap: $('.mcap'), nums: $('.nums'),
      mkeep: $('.mkeep'), mclose: $('.mclose'),
      max: $('.max'),
      range: null,
    };
    ui.range = buildRange(ui, $);
    ui.del.insertAdjacentHTML('afterbegin', ICON.bin);

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
    ui.closeModal = () => closeModal(ui);
    ui.mclose.onclick = ui.closeModal;
    // Clicking the backdrop dismisses; clicking the dialog itself must not.
    ui.scrim.onclick = (e) => { if (e.target === ui.scrim) ui.closeModal(); };
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (!ui.scrim.classList.contains('on')) return;
      if (e.key === 'Escape') return ui.closeModal();
      if (ui.modalKeys) ui.modalKeys(e);
    }, true);
    ui.syncChrome();
    ui.sim.oninput = () => (ui.simv.textContent = ui.sim.value + '%');

    // While a scan runs the panel steps aside for a compact bar, so the only
    // thing overlapping the grid is something small enough to hash around.
    ui.setScanning = (on) => {
      ui.panel.style.display = on ? 'none' : '';
      ui.scanbar.classList.toggle('on', on);
    };
    ui.blockedRect = () => {
      const el = ui.scanbar.classList.contains('on') ? ui.scanbar : ui.panel;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    ui.setStatus = (t) => {
      ui.status.textContent = t;
      ui.scanmsg.textContent = t;
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

  // Maximised tiles are big enough that a hover preview would be more nuisance
  // than help, so there it is a click instead: a fixed, centred dialog that
  // stays put until dismissed, and carries the keeper action so clicking a
  // photo does not lose the decision it used to make.
  let modalSeq = 0;

  // Takes the whole group, not one photo: numbered buttons switch between the
  // duplicates in place, and "Keep this one" applies to whichever is on screen,
  // so a decision can be made by looking rather than by remembering.
  function openModal(ui, group, startIdx, state, keepItem) {
    let idx = startIdx;

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
        img.src = maxed ? bigUrl(it.thumb || '', 512) : it.thumb || '';
        img.loading = 'lazy';
        img.alt = '';
        img.title = maxed
          ? 'Click to view full size'
          : marked
            ? 'Keep this one instead'
            : 'Keeping this one';
        img.onclick = maxed ? () => openModal(ui, g, idx, state, keepItem) : () => keepItem(it);
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
