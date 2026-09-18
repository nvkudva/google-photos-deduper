// Listing-screenshot helper. Development only: tools/package.sh leaves this
// file out of the zip along with its manifest entry.
//
// Store screenshots have to be taken against a real library, and a real library
// is somebody's family. Loading the page with
//   https://photos.google.com/#gpdd-shot=blur,arm
// blurs every photo on the page and in the panel with CSS before anything is
// captured, and can put the panel into the state the shot needs. Nothing is
// uploaded and nothing is changed - it is a filter over what is already drawn.
//
//   blur  every thumbnail, in the grid and in the panel, plus the few places
//         Google Photos prints a person's name
//   arm   click the delete button once, to show the confirm step (one click
//         only arms it; it never deletes)
(() => {
  const flags = (location.hash.match(/gpdd-shot=([\w,]+)/) || [, ''])[1].split(',');
  if (!flags[0]) return;
  const has = (f) => flags.includes(f);

  const PAGE_CSS = `img, [data-latest-bg], [style*="background-image"] { filter: blur(11px) !important; }`;
  const PANEL_CSS = `.tile img, .preview img { filter: blur(5px); }`;

  function blurNames() {
    // The grid itself never prints a name; the sidebar, the album chips and the
    // memories carousel do. Leaf elements only, so a whole column is not lost
    // to a blur meant for six words.
    for (const el of document.querySelectorAll('span, div, a')) {
      if (el.children.length || el.dataset.gpddBlurred) continue;
      const t = (el.textContent || '').trim();
      if (t && /'s photos|^With |on this day/.test(t)) {
        el.style.filter = 'blur(6px)';
        el.dataset.gpddBlurred = '1';
      }
    }
  }

  function ready() {
    const host = document.getElementById('gpdd-host');
    return host && host.shadowRoot && host.shadowRoot.querySelector('.grp');
  }

  (async () => {
    for (let i = 0; i < 120 && !ready(); i++) await new Promise((r) => setTimeout(r, 500));
    const root = document.getElementById('gpdd-host').shadowRoot;
    if (has('blur')) {
      const s = document.createElement('style');
      s.textContent = PAGE_CSS;
      document.head.append(s);
      const s2 = document.createElement('style');
      s2.textContent = PANEL_CSS;
      root.append(s2);
      blurNames();
      // Google Photos renders as you scroll, so late tiles need the same pass.
      new MutationObserver(blurNames).observe(document.body, { childList: true, subtree: true });
    }
    // The confirm step disarms itself after 15 seconds, which is shorter than
    // it takes to line a shot up, so it is re-armed until the capture happens.
    if (has('arm')) {
      const del = root.querySelector('.del');
      const arm = () => { if (!/confirm/i.test(del.textContent)) del.click(); };
      arm();
      setInterval(arm, 3000);
    }
  })();
})();
