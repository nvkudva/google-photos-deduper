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
