// A "Deduper" entry in Google Photos' own sidebar, below Bin, that shows or
// hides the panel. It is a clone of the Bin entry with its content swapped,
// so it borrows whatever classes the sidebar is using this week and follows
// it when it collapses to icons.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  // Material "content_copy": two overlapping sheets, the nearest thing the
  // sidebar's own icon set has to "duplicates".
  const GLYPH = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
  const BIN = 'a[role="tab"][href$="trash"]';

  function build(bin, onClick) {
    const a = bin.cloneNode(true);
    // Only the classes are wanted from Google's markup; the rest is their
    // routing and logging hooks, which must not fire for an entry of ours.
    [...a.attributes].forEach((at) => { if (at.name !== 'class') a.removeAttribute(at.name); });
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', 'Deduper');
    a.setAttribute('aria-pressed', 'false');
    a.tabIndex = 0;
    a.dataset.gpdd = 'nav';
    const path = a.querySelector('svg path');
    if (path) path.setAttribute('d', GLYPH);
    // The label is the innermost element that holds the text.
    const label = [...a.querySelectorAll('*')].reverse().find((el) => !el.children.length && el.textContent.trim());
    if (label) label.textContent = 'Deduper';
    // The page delegates clicks at the document, so a click here must stop
    // before it gets there, or the sidebar treats it as a navigation.
    a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
    a.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation(); onClick();
    });
    return a;
  }

  function mount(ui) {
    let entry = null;
    const place = () => {
      if (entry && entry.isConnected) return;
      const bin = document.querySelector(BIN);
      if (!bin) return;
      entry = build(bin, () => ui.toggle());
      bin.after(entry);
      ui.onVisibility = (on) => entry.setAttribute('aria-pressed', String(on));
      ui.onVisibility(ui.host.style.display !== 'none');
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
