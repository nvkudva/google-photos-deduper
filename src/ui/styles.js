// The panel's stylesheet. It lives in a shadow root, so nothing here can reach
// Google Photos' own DOM and nothing of theirs reaches the panel.
//
// This file holds the tokens and the parts every module shares: the panel
// chrome, the form controls, the buttons, the status row and the footer. The
// range scrubber, the hover preview and the results list each carry their own
// CSS next to their markup, and panel.js concatenates the four at mount.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

// A no-op tag. Prettier formats the CSS inside a template tagged `css`, and
// the string highlighters key off the same name, so the stylesheets are tagged
// rather than commented.
window.GPDD.ui.css = (s, ...v) => s.map((c, i) => (i ? v[i - 1] : '') + c).join('');
const css = window.GPDD.ui.css;

const CSS = css`
  /* ================================================================ tokens == */
  :host {
    all: initial;
    color-scheme: dark;
    /* Sampled from photos.google.com itself: page #131314, cards #1e1f20, the
     search pill #282a2c, selected nav #004a77 on #c2e7ff. */
    --bg: #1e1f20;
    --raised: #282a2c;
    --sunken: #131314;
    --chrome: #1b1b1b;
    --thumb: #2a2d31;
    --line: #444746;
    --hair: #303133;
    --fg: #e3e3e3;
    --fg-2: #c4c7c5;
    --fg-3: #8e918f;
    --accent: #a8c7fa;
    --accent-ink: #062e6f;
    --accent-soft: rgba(168, 199, 250, 0.12);
    --accent-hover: #c2ddff;
    /* Material 3 tertiary and error, read off the page's own resolved dark
     tokens: --gm3-sys-color-tertiary #6dd58c on #072711, --gm3-sys-color-error
     #f2b8b5 on #601410. The old #81c995 / #f28b82 were the Material 2 pair. */
    --keep: #6dd58c;
    --keep-ink: #072711;
    --gone: #f2b8b5;
    --gone-ink: #601410;
    --gone-soft: rgba(242, 184, 181, 0.12);
    --gone-hover: #f9d2d0;
    --note: #fdd663;
    --s1: 4px;
    --s2: 8px;
    --s3: 12px;
    --s4: 16px;
    --s5: 24px;
    --r1: 8px;
    --r2: 12px;
    --r3: 16px;
    --t1: 11px;
    --t2: 12px;
    --t3: 13px;
    --t4: 15px;
    /* Exactly the stack photos.google.com sets on its own body, so the panel
     renders in the same face as the page it sits on. */
    --ui: 'Google Sans Text', 'Google Sans', Roboto, Arial, sans-serif;
    /* all:initial above resets inheritance, so the face has to be re-stated
     here or anything outside .panel - the scanning bar, the preview - falls
     back to the browser default. */
    font: 400 var(--t3)/1.5 var(--ui);
  }

  /* ================================================================= panel == */
  .panel {
    position: fixed;
    right: var(--s4);
    bottom: var(--s4);
    width: 380px;
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    z-index: 2147483647;
    font: 400 var(--t3)/1.5 var(--ui);
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r3);
    box-shadow:
      0 18px 48px rgba(0, 0, 0, 0.55),
      0 2px 6px rgba(0, 0, 0, 0.4);
    overflow: hidden;

    /* One wheel, shown wherever the panel needs to say it is working: the
     footer button and the status line here, the card whose own button
     started the run in results.js. */
    &.busy {
      .srow > .spin,
      .ft .del .spin {
        display: block;
      }
      .ft .del svg {
        display: none;
      }
    }
  }
  .hd {
    display: flex;
    align-items: center;
    gap: var(--s1);
    padding: 10px 10px 10px var(--s4);
    background: var(--chrome);
    border-bottom: 1px solid var(--hair);
    b {
      flex: 1;
      font: 500 var(--t4)/1.25 var(--ui);
      letter-spacing: -0.01em;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: none;
      border: 0;
      border-radius: var(--r1);
      color: var(--fg-3);
      cursor: pointer;
      svg {
        width: 16px;
        height: 16px;
        display: block;
      }
      &:hover {
        background: var(--raised);
        color: var(--fg);
      }
      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
    }
  }
  .body {
    padding: var(--s4);
    overflow: auto;
    overscroll-behavior: contain;
  }
  .collapsed .body,
  .collapsed .ft {
    display: none;
  }

  /* ================================================================ fields == */
  .fields {
    margin: var(--s4) 0;
    background: var(--raised);
    border: 1px solid var(--hair);
    border-radius: var(--r2);
    padding: 0 var(--s3);
  }
  .field {
    display: flex;
    align-items: center;
    gap: var(--s3);
    min-height: 40px;
    color: var(--fg-2);
    cursor: default;
    & + & {
      border-top: 1px solid var(--hair);
    }
    .lbl {
      flex: 0 0 96px;
    }
  }
  .unit {
    color: var(--fg-3);
    font-size: var(--t2);
  }
  .simv {
    min-width: 34px;
    text-align: right;
    font: 500 var(--t3)/1 var(--ui);
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    flex: 1;
    min-width: 60px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: var(--line);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0 var(--accent-soft);
    transition: box-shadow 0.15s;
  }
  input[type='range']:hover::-webkit-slider-thumb {
    box-shadow: 0 0 0 6px var(--accent-soft);
  }
  input[type='range']:focus {
    outline: none;
  }
  input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 6px var(--accent-soft);
  }

  input[type='number'] {
    width: 86px;
    -webkit-appearance: none;
    appearance: none;
    text-align: right;
    background: var(--sunken);
    color: var(--fg);
    border: 1px solid var(--line);
    border-radius: var(--r1);
    padding: 6px 9px;
    font: 400 var(--t3)/1.2 var(--ui);
    font-variant-numeric: tabular-nums;
  }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  input[type='number']:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  /* =============================================================== buttons == */
  .row {
    display: flex;
    align-items: center;
    gap: var(--s2);
    margin-top: var(--s3);
    &.actions {
      justify-content: flex-end;
    }
  }
  button.act {
    flex: 0 0 auto;
    padding: 8px 16px;
    border: 1px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    font: 500 var(--t3)/1.2 var(--ui);
    background: var(--accent);
    color: var(--accent-ink);
    &:hover:not(:disabled) {
      background: var(--accent-hover);
    }
    &.sec {
      background: transparent;
      color: var(--accent);
      border-color: var(--line);
      &:hover:not(:disabled) {
        background: var(--accent-soft);
        border-color: var(--accent);
      }
    }
    &.ghost {
      background: transparent;
      color: var(--fg-3);
      border-color: transparent;
      padding: 8px 12px;
      &:hover:not(:disabled) {
        background: var(--gone-soft);
        color: var(--gone);
      }
    }
    &.danger {
      background: var(--gone);
      color: var(--gone-ink);
      &:hover:not(:disabled) {
        background: var(--gone-hover);
      }
    }
  }
  .scan {
    min-width: 92px;
  }
  .reset {
    margin-right: auto;
  }
  /* The same ring and the same dimming on every button family. The header
   button keeps a tighter ring above, and the tile badge a white one in
   results.js. */
  :is(button.act, button.pill, .gact button):focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  :is(button.act, .gact button):disabled {
    opacity: 0.38;
    cursor: default;
  }

  /* ================================================================ status == */
  .bar {
    height: 3px;
    background: var(--hair);
    border-radius: 999px;
    overflow: hidden;
    margin: var(--s4) 0 var(--s2);
    i {
      display: block;
      height: 100%;
      width: 0;
      background: var(--accent);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
  }
  .status {
    min-height: 18px;
    color: var(--fg-2);
    font-size: var(--t2);
    line-height: 1.5;
  }
  .srow {
    display: flex;
    align-items: center;
    gap: var(--s2);
    .status {
      flex: 1 1 auto;
    }
    /* Pushed to the right edge by the status line's flex, so the offer sits away
     from the sentence it answers. */
    .undo {
      flex: 0 0 auto;
      margin-left: auto;
    }
  }
  @keyframes gpdd-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .spin {
    display: none;
    flex: 0 0 auto;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: gpdd-spin 0.7s linear infinite;
  }
  .log {
    display: none;
    margin-top: var(--s3);
    max-height: 96px;
    overflow: auto;
    font: 400 11px/1.6 var(--ui);
    color: var(--fg-3);
    background: var(--sunken);
    border: 1px solid var(--hair);
    border-radius: var(--r1);
    padding: var(--s2) 10px;
    white-space: pre-wrap;
    &.on {
      display: block;
    }
  }
  .warn {
    color: var(--note);
    background: rgba(253, 214, 99, 0.08);
    border: 1px solid rgba(253, 214, 99, 0.22);
    border-left: 3px solid var(--note);
    border-radius: var(--r1);
    padding: var(--s2) 10px;
    margin-bottom: var(--s3);
    font-size: var(--t2);
  }

  /* Shown in place of the panel while a scan runs. The panel used to be hidden
   and restored around every screenshot, which read as a flicker once a second;
   this stays put, and its rect is excluded from hashing instead. */
  .scanbar {
    display: none;
    position: fixed;
    right: var(--s4);
    bottom: var(--s4);
    z-index: 2147483646;
    align-items: center;
    gap: var(--s3);
    max-width: 380px;
    padding: 10px var(--s3) 10px var(--s4);
    border-radius: 999px;
    background: var(--chrome);
    border: 1px solid var(--line);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    &.on {
      display: flex;
    }
    .msg {
      flex: 1 1 auto;
      color: var(--fg-2);
      font-size: var(--t2);
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .act {
      padding: 5px 13px;
      font-size: var(--t2);
    }
  }

  /* ================================================================ footer == */
  .ft {
    border-top: 1px solid var(--hair);
    padding: var(--s3) var(--s4);
    background: var(--chrome);
    .row {
      margin: 0;
      gap: var(--s3);
    }
    .hint {
      flex: 1 1 auto;
      color: var(--fg-3);
      font-size: var(--t1);
      line-height: 1.4;
    }
    .del {
      flex: 0 0 auto;
      min-width: 176px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      svg {
        flex: 0 0 auto;
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
`;
window.GPDD.ui.CSS = CSS;
