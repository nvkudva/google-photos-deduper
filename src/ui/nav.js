// A "Smart Deduper" entry in Google Photos' own sidebar, above the storage section,
// that shows or hides the panel. It is a clone of the Bin entry with its content swapped,
// so it borrows whatever classes the sidebar is using this week and follows
// it when it collapses to icons.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  // Material "content_copy": two overlapping sheets, the nearest thing the
  // sidebar's own icon set has to "duplicates".
  const GLYPH = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
  const BIN = 'a[role="tab"][href$="trash"]';
  const STORAGE = 'a[href*="one.google.com"], a[href*="quotamanagement"]';

  // The storage section sits outside the scrolling tab list, so an entry
  // beside it stays visible when the list grows a scrollbar. Returns the
  // outermost ancestor of the storage link that does not also hold the tabs.
  function storageSection(bin) {
    const link = document.querySelector(STORAGE);
    if (!link) return null;
    let el = link;
    while (el.parentElement && !el.parentElement.contains(bin)) el = el.parentElement;
    return el.parentElement ? el : null;
  }

  function build(bin, onClick) {
    const a = bin.cloneNode(true);
    // Only the classes are wanted from Google's markup; the rest is their
    // routing and logging hooks, which must not fire for an entry of ours.
    [...a.attributes].forEach((at) => { if (at.name !== 'class') a.removeAttribute(at.name); });
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', 'Smart Deduper');
    a.setAttribute('aria-pressed', 'false');
    a.tabIndex = 0;
    a.dataset.gpdd = 'nav';
    const path = a.querySelector('svg path');
    if (path) path.setAttribute('d', GLYPH);
    // The label is the innermost element that holds the text.
    const label = [...a.querySelectorAll('*')].reverse().find((el) => !el.children.length && el.textContent.trim());
    if (label) label.textContent = 'Smart Deduper';
    // The page delegates clicks at the document, so a click here must stop
    // before it gets there, or the sidebar treats it as a navigation.
    a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    a.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation(); onClick();
    });
    return a;
  }

  // Closing the panel leaves nothing on screen to say it can come back, so a
  // note points at the entry for a few seconds. In its own shadow root, like
  // the panel, so the page cannot style it.
  let note = null;
  function hint(entry) {
    if (!note) {
      note = document.createElement('div');
      const root = note.attachShadow({ mode: 'open' });
      root.innerHTML = /* HTML */ `
        <style>
          .n {
            position: fixed;
            z-index: 2147483647;
            max-width: 240px;
            padding: 10px 12px;
            border-radius: 8px;
            background: #303134;
            color: #e8eaed;
            font: 13px/1.4 Roboto, Arial, sans-serif;
            box-shadow: 0 4px 16px #0009;
            opacity: 0;
            transition: opacity 0.2s;
          }
          .n.on {
            opacity: 1;
          }
        </style>
        <div class="n">Smart Photo Deduper is closed. Open it again from <b>Smart Deduper</b> in the sidebar.</div>
      `;
      document.documentElement.append(note);
    }
    const n = note.shadowRoot.querySelector('.n');
    const r = entry.getBoundingClientRect();
    n.style.left = `${Math.round(r.right + 12)}px`;
    n.style.top = `${Math.round(r.top)}px`;
    n.classList.add('on');
    clearTimeout(hint.t);
    hint.t = setTimeout(() => n.classList.remove('on'), 6000);
  }

  function mount(ui) {
    let entry = null;
    const place = () => {
      if (entry && entry.isConnected) return;
      const bin = document.querySelector(BIN);
      if (!bin) return;
      entry = build(bin, () => ui.toggle());
      const storage = storageSection(bin);
      if (storage) {
        // The tab styles are scoped to the list wrapper, so the entry gets a
        // wrapper of its own with the same classes as the storage tab's.
        const wrap = document.createElement('div');
        wrap.className = document.querySelector(STORAGE).parentElement.className;
        wrap.appendChild(entry);
        storage.before(wrap);
      } else bin.after(entry);
      ui.onVisibility = (on) => {
        entry.setAttribute('aria-pressed', String(on));
        if (!on) hint(entry);
      };
      entry.setAttribute('aria-pressed', String(ui.host.style.display !== 'none'));
    };
    place();
    // Google rebuilds the sidebar on navigation, which drops the entry. The
    // grid mutates constantly while scrolling, so the check is coalesced.
    let pending = 0;
    new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => { pending = 0; place(); }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.GPDD.ui.nav = { mount };
})();
