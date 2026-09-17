// dHash (9x8 grey, 64 bits) of a thumbnail blob. The thumbnails come from a
// credentialed fetch in the content script: the host answers that with real
// bytes, while crossOrigin="anonymous" (no cookies) gets a transparent
// placeholder and a cookieless service-worker fetch gets a sign-in page.
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

  // A hash with almost no bits set (or almost all) came from a flat crop - a
  // tile captured before its thumbnail painted. It carries no information and
  // sits within threshold of every other flat crop, which chains them into one
  // enormous bogus group. Such rows are purged and re-hashed, not kept.
  // Byte at a time off the same table hamming() uses. The per-character
  // parseInt/toString/regex version cost 750ms over 200k rows in degenerate().
  const popcount = (hex) => {
    let n = 0;
    for (let i = 0; i < hex.length; i += 2) n += POP[parseInt(hex.slice(i, i + 2), 16)];
    return n;
  };
  const degenerate = (hex) => {
    if (!hex || hex.length !== 16) return true;
    const n = popcount(hex);
    if (n < 6 || n > 58) return true;
    // The eight rows of a dHash are computed independently, so a real photo
    // practically never repeats one. Two distinct rows or fewer means the crop
    // had no vertical structure at all - flat scans hashed to 0101010101010101,
    // which has a healthy popcount of 8 and so passed the count test, then
    // matched every other such scan at distance 0.
    // Counts distinct rows without allocating a Set per call - this runs once
    // per row over the whole store every time the results are regrouped.
    let a = -1;
    let b = -1;
    let seen = 0;
    for (let i = 0; i < 16; i += 2) {
      const v = parseInt(hex.slice(i, i + 2), 16);
      if (v === a || v === b) continue;
      if (seen === 0) { a = v; seen = 1; continue; }
      if (seen === 1) { b = v; seen = 2; continue; }
      return false; // a third distinct row is enough structure
    }
    return true;
  };

  const W = 9, H = 8;
  let ctx = null;
  async function dhashBlob(blob) {
    if (!ctx) ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    const bmp = await createImageBitmap(blob);
    try {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bmp, 0, 0, W, H);
    } finally { bmp.close(); }
    const d = ctx.getImageData(0, 0, W, H).data;
    const grey = new Float32Array(W * H);
    let sum = 0;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      grey[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
      sum += grey[i];
    }
    // A flat image carries no signal and would sit within threshold of every
    // other flat one; it gets no hash rather than a bogus one.
    const mean = sum / (W * H);
    let varSum = 0;
    for (let i = 0; i < W * H; i++) varSum += (grey[i] - mean) ** 2;
    if (Math.sqrt(varSum / (W * H)) < 5) return null;
    let bits = '';
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W - 1; x++) bits += grey[y * W + x] < grey[y * W + x + 1] ? '1' : '0';
    let hex = '';
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  }

  window.GPDD.hash = { hamming, degenerate, popcount, dhashBlob };
})();
