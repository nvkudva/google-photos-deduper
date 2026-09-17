// Two jobs, neither of them work: reload the extension when the page asks
// (a development convenience), and toggle the panel from the toolbar icon.
// Hashing happens in the content script, which fetches each thumbnail with
// the session cookies; nothing is screenshotted.

// --------------------------------------------------------------- messaging ---
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  (async () => {
    try {
      if (msg.type === 'reloadExtension') {
        respond({ ok: true });
        setTimeout(() => chrome.runtime.reload(), 50);
        return;
      }
      respond({ error: 'unknown message ' + msg.type });
    } catch (e) {
      respond({ error: String(e && e.message ? e.message : e) });
    }
  })();
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'togglePanel' }).catch(() => {});
});
