// Development convenience, left out of the packaged build by tools/package.sh:
// unpacked extensions only pick up edited files after a reload on
// chrome://extensions, which nothing on the page can reach. This lets the page
// ask for that reload instead:
//   document.dispatchEvent(new Event('gpdd-reload'))
// It only restarts this extension - it exposes no data and no other action.
// It is a separate file because a page-triggerable reload has no business in a
// published extension, and a build that strips a whole file cannot strip half
// of one by accident.
document.addEventListener('gpdd-reload', () => {
  chrome.runtime.sendMessage({ type: 'reloadExtension' }, () => void chrome.runtime.lastError);
});

// With tools/dev-serve.py running, poll its file stamp and, when an edit
// lands, restart the extension and then reload this tab. A server that is
// not there ends the polling after the first miss.
(async () => {
  const URL = 'http://127.0.0.1:7331/stamp';
  const read = () => fetch(URL, { cache: 'no-store' }).then((r) => r.text());
  let seen;
  try { seen = await read(); } catch { return; }
  const tick = async () => {
    let now;
    try { now = await read(); } catch { return; }
    if (now !== seen) {
      document.dispatchEvent(new Event('gpdd-reload'));
      setTimeout(() => location.reload(), 1000);
      return;
    }
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
})();

