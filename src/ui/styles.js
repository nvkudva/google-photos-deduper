// The panel's stylesheet. It lives in a shadow root, so nothing here can reach
// Google Photos' own DOM and nothing of theirs reaches the panel.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

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
  /* Material 3 tertiary and error, read off the page's own resolved dark
     tokens: --gm3-sys-color-tertiary #6dd58c on #072711, --gm3-sys-color-error
     #f2b8b5 on #601410. The old #81c995 / #f28b82 were the Material 2 pair. */
  --keep: #6dd58c; --keep-ink: #072711;
  --gone: #f2b8b5; --gone-ink: #601410; --gone-soft: rgba(242,184,181,.12);
  --note: #fdd663;
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
button.act.danger { background: var(--gone); color: var(--gone-ink); }
button.act.danger:hover:not(:disabled) { background: #f9d2d0; }
button.act:disabled { opacity: .38; cursor: default; }
button.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scan { min-width: 92px; }
.row.actions { justify-content: flex-end; }
.reset { margin-right: auto; }

.bar { height: 3px; background: #303133; border-radius: 999px; overflow: hidden; margin: var(--s4) 0 var(--s2); }
.bar i { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 999px; transition: width .25s ease; }
.status { min-height: 18px; color: var(--fg-2); font-size: var(--t2); line-height: 1.5; }
.note { color: var(--fg-3); font-size: var(--t2); padding: var(--s2) var(--s1) 0; }
.more { display: flex; align-items: center; gap: var(--s3); margin-top: var(--s3);
  padding-top: var(--s3); border-top: 1px solid var(--hair); }
.more span { flex: 1 1 auto; color: var(--fg-3); font-size: var(--t2); }
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
.grp h4 .flag { font-weight: 400; font-size: var(--t1); color: var(--fg-3); }
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
/* A thumbnail that will not load shows as an empty frame rather than the
   browser's broken-image glyph, which reads as a missing photo. */
.tile.gone-thumb { background: var(--sunken); }
.tile.gone-thumb::before { content: '?'; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--fg-3); font: 400 var(--t4)/1 var(--ui); }
.mark { position: absolute; top: 4px; left: 4px; width: 19px; height: 19px; padding: 0;
  -webkit-appearance: none; appearance: none;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  border: 0; cursor: pointer; }
.mark svg { width: 12px; height: 12px; display: block; }
.tile.keeper .mark { background: var(--keep); color: var(--keep-ink); }
.tile.bin .mark { background: var(--gone); color: var(--gone-ink); }
.mark:hover { filter: brightness(1.12); }
.mark:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }

.ft { border-top: 1px solid var(--hair); padding: var(--s3) var(--s4); background: var(--chrome); }
.ft .row { margin: 0; gap: var(--s3); }
.ft .hint { flex: 1 1 auto; color: var(--fg-3); font-size: var(--t1); line-height: 1.4; }
.ft .del { flex: 0 0 auto; min-width: 176px; display: inline-flex; align-items: center;
  justify-content: center; gap: 7px; }
.ft .del svg { flex: 0 0 auto; width: 16px; height: 16px; fill: currentColor; }

.preview { position: fixed; z-index: 2147483646; display: none; pointer-events: none;
  background: var(--bg); border: 1px solid var(--line); border-radius: var(--r2); padding: var(--s2);
  box-shadow: 0 20px 56px rgba(0,0,0,.7); }
.preview.on { display: block; }
.preview img { display: block; border-radius: var(--r1); background: #2a2d31;
  max-width: 100%; max-height: 100%; object-fit: contain; }
.preview b { display: block; margin-top: 6px; font: 400 var(--t1)/1.4 var(--ui);
  color: var(--fg-3); text-align: center; }

/* One wheel, shown wherever the panel needs to say it is working: the footer
   button, the status line, and the card whose own button started the run. */
@keyframes gpdd-spin { to { transform: rotate(360deg); } }
.spin { display: none; flex: 0 0 auto; width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid currentColor; border-top-color: transparent;
  animation: gpdd-spin .7s linear infinite; }
.srow { display: flex; align-items: center; gap: var(--s2); }
.srow .status { flex: 1 1 auto; }
/* Pushed to the right edge by the status line's flex, so the offer sits away
   from the sentence it answers. */
.srow .undo { flex: 0 0 auto; margin-left: auto; }
.panel.busy .srow > .spin, .panel.busy .ft .del .spin { display: block; }
.panel.busy .ft .del svg { display: none; }
.gact button.working .spin { display: block; }

/* Per-group actions: deal with one card without touching the rest of the
   selection. */
.gact { display: flex; align-items: center; gap: var(--s1); margin-left: auto; }
.gact button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; cursor: pointer;
  font: 500 var(--t1)/1.2 var(--ui); background: transparent; color: var(--fg-2); }
.gact button:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.gact .gbin { color: var(--gone); border-color: rgba(242,184,181,.42); }
.gact .gbin:hover:not(:disabled) { background: var(--gone); border-color: var(--gone); color: var(--gone-ink); }
.gact button:disabled { opacity: .38; cursor: default; }
.gact button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.grp.skipped { opacity: .6; }
.grp.skipped h4 { margin-bottom: 0; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
window.GPDD.ui.CSS = CSS;
