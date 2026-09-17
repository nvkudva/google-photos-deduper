// Hashing does not happen here, and nothing is downloaded.
//
// Two dead ends, both verified against the live site:
//   * crossOrigin="anonymous" on the thumbnail loads a transparent placeholder -
//     identical pixels for visibly different photos - because the host sends no
//     Access-Control-Allow-Origin header. Without crossOrigin the canvas taints.
//   * Fetching the thumbnail URL without session cookies returns a ~940KB HTML
//     sign-in page with a 200 status, not an image.
//
// Instead the service worker screenshots the visible tab once and crops each
// tile out of it. No network, no CORS, no auth.
window.GPDD = window.GPDD || {};

(() => {
  const POP = new Uint8Array(256);
  for (let i = 0; i < 256; i++) POP[i] = (i & 1) + POP[i >> 1];

  function hamming(a, b) {
    if (!a || !b || a.length !== b.length) return 64;
    let dist = 0;
    for (let i = 0; i < a.length; i += 2) {
      dist += POP[parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)];
    }
    return dist;
  }

  const ask = (msg) =>
    new Promise((res, rej) => {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
        if (r && r.error) return rej(new Error(r.error));
        res(r);
      });
    });

  // `tiles` are anchors; only ones wholly inside the viewport and clear of the
  // panel can be cropped out of a screenshot.
  function croppable(tiles, blockedRect) {
    const out = [];
    for (const a of tiles) {
      const r = a.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) continue;
      if (r.top < 56 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) continue;
      if (blockedRect &&
          r.right > blockedRect.left && r.left < blockedRect.right &&
          r.bottom > blockedRect.top && r.top < blockedRect.bottom) continue;
      out.push({ a, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
    }
    return out;
  }

  // Resolves to { hashes } or { inactive: true } when the tab is not frontmost.
  const hashRects = (rects) => ask({ type: 'hashRects', rects, viewportWidth: window.innerWidth });

  window.GPDD.hash = { hamming, hashRects, croppable };
})();
