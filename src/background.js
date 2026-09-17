// Two jobs: own the debugger session (trusted clicks), and hash thumbnails.
//
// Hashing lives here because the thumbnail host sends no CORS headers, so the
// content script can only ever read a placeholder. An extension fetch covered by
// host_permissions is not subject to CORS and gets the real bytes.

// ---------------------------------------------------------------- hashing ---
// Thumbnails cannot be fetched: the host sends no CORS headers (so the page
// can only read a transparent placeholder) and a cookieless fetch from the
// service worker returns a 940KB HTML sign-in page rather than an image
// (verified). Both fetch routes are dead ends.
//
// So nothing is fetched. One screenshot of the visible tab is cropped to each
// tile's rectangle, which costs no network at all and hashes exactly what the
// user is looking at. The tab has to be visible anyway - Google Photos stops
// rendering tiles when it is hidden.
const W = 9, H = 8;
const canvas = new OffscreenCanvas(W, H);
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function dhashFrom(bitmap, sx, sy, sw, sh) {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    grey[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
  }
  let bits = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W - 1; x++) bits += grey[y * W + x] < grey[y * W + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

// captureVisibleTab is rate limited (about two calls a second); the scanner
// pauses between scroll steps anyway, and this retries rather than dropping a
// whole screenful of tiles.
let lastCapture = 0;
async function capture(windowId) {
  const wait = 600 - (Date.now() - lastCapture);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  for (let attempt = 0; ; attempt++) {
    try {
      lastCapture = Date.now();
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 });
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

async function hashRects(tab, rects, viewportWidth) {
  // captureVisibleTab throws on a backgrounded tab. Report that as a pause the
  // scanner can wait out rather than letting it abort the run.
  const [front] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (!front || front.id !== tab.id) return { inactive: true };
  const dataUrl = await capture(tab.windowId);
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  // The capture is the viewport at device pixel ratio; derive the factor from
  // the image rather than trusting a reported devicePixelRatio.
  const k = bmp.width / viewportWidth;
  const out = rects.map((r) => {
    const sx = Math.round(r.x * k), sy = Math.round(r.y * k);
    const sw = Math.round(r.w * k), sh = Math.round(r.h * k);
    if (sw < 8 || sh < 8 || sx < 0 || sy < 0 || sx + sw > bmp.width || sy + sh > bmp.height) return null;
    try { return dhashFrom(bmp, sx, sy, sw, sh); } catch (e) { return null; }
  });
  bmp.close();
  return { hashes: out };
}

// --------------------------------------------------------------- debugger ---
const attached = new Set();

async function attach(tabId) {
  if (attached.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, '1.3');
  attached.add(tabId);
}

async function detach(tabId) {
  if (!attached.has(tabId)) return;
  attached.delete(tabId);
  try { await chrome.debugger.detach({ tabId }); } catch (e) { /* tab may be gone */ }
}

async function click(tabId, x, y) {
  const send = (p) => chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', p);
  await send({ type: 'mouseMoved', x, y, buttons: 0 });
  await send({ type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await send({ type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

// --------------------------------------------------------------- messaging ---
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const tabId = sender.tab && sender.tab.id;
  (async () => {
    try {
      if (msg.type === 'reloadExtension') {
        respond({ ok: true });
        setTimeout(() => chrome.runtime.reload(), 50);
        return;
      }
      if (msg.type === 'hashRects') {
        if (!sender.tab) return respond({ error: 'no tab' });
        return respond(await hashRects(sender.tab, msg.rects, msg.viewportWidth));
      }
      if (!tabId) return respond({ error: 'no tab' });
      if (msg.type === 'attach') { await attach(tabId); return respond({ ok: true }); }
      if (msg.type === 'detach') { await detach(tabId); return respond({ ok: true }); }
      if (msg.type === 'cdpClick') {
        await attach(tabId);
        await click(tabId, msg.x, msg.y);
        return respond({ ok: true });
      }
      respond({ error: 'unknown message ' + msg.type });
    } catch (e) {
      respond({ error: String(e && e.message ? e.message : e) });
    }
  })();
  return true;
});

chrome.debugger.onDetach.addListener((s) => { if (s.tabId) attached.delete(s.tabId); });
chrome.tabs.onRemoved.addListener((id) => attached.delete(id));
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'togglePanel' }).catch(() => {});
});
