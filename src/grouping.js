// Near-duplicate matching is global, not bucketed by capture date. Comparing
// every pair is quadratic, so candidates come from LSH banding: each 64-bit
// dHash is split into its eight rows, photos sharing any whole row are compared
// properly, and the rest are never looked at.
window.GPDD = window.GPDD || {};

(() => {
  const { hash } = window.GPDD;

  const maxDistance = (similarityPct) => Math.round(((100 - similarityPct) / 100) * 64);

  const degenerate = (hex) => hash.degenerate(hex);

  // One band per dHash row: eight bands of eight bits. Two hashes within seven
  // bits of each other must agree on at least one whole row, so at the default
  // 92% (five bits) the banding pass is exhaustive, not approximate. Measured
  // against brute force over 4,965 photos: eight 8-bit bands found all 478 near
  // pairs in 531k comparisons; the four 16-bit bands the design first called for
  // found 460 of them, missing 18 at four and five bits apart.
  const BAND_WIDTH = 2; // hex chars
  const BANDS = 8;
  // A band key is 8 bits, so there are only 256 of them and bucket size grows
  // linearly with the library: the worst bucket is ~6.5k at 200k photos and
  // ~16k at 500k, where one bucket alone would be 130M comparisons. The cap
  // bounds that, and anything it skips is reported rather than dropped quietly.
  const MAX_BUCKET = 20000;
  // Comparisons between yields. Measured over a simulated 200k library: 20e6
  // still blocked the main thread for 221ms at a time, 4e6 holds the worst
  // block to 31ms and costs 23% wall clock (3.9s -> 4.8s). Responsiveness wins;
  // this runs on every nudge of the similarity slider.
  const CHUNK = 4e6;

  const breathe = () => new Promise((r) => setTimeout(r, 0));

  // Async because at 200k photos the banding pass is ~750M comparisons and
  // several seconds; run straight through it would freeze the page on every
  // nudge of the similarity slider.
  async function group(items, { similarity = 90, onProgress = () => {} } = {}) {
    const pool = items.filter(
      // Videos are always out. Their hash comes from the poster frame, so a
      // match says one still looked alike - too little to bin a clip on.
      (i) => i.hash && !degenerate(i.hash) && i.kind !== 'Video'
    );
    const maxD = maxDistance(similarity);
    const n = pool.length;
    let capped = 0;

    // Each hash is packed into two 32-bit halves once. The banding pass runs
    // hundreds of millions of comparisons at 200k photos, and hamming() reparses
    // the hex string on every one of them.
    const hi = new Int32Array(n);
    const lo = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      hi[k] = parseInt(pool[k].hash.slice(0, 8), 16) | 0;
      lo[k] = parseInt(pool[k].hash.slice(8), 16) | 0;
    }
    const pc = (x) => {
      x -= (x >> 1) & 0x55555555;
      x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
      x = (x + (x >> 4)) & 0x0f0f0f0f;
      return (x * 0x01010101) >> 24;
    };
    const dist = (a, b) => pc(hi[a] ^ hi[b]) + pc(lo[a] ^ lo[b]);

    const parent = new Int32Array(n);
    for (let k = 0; k < n; k++) parent[k] = k;
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    let since = 0;
    let done = 0;
    const pairsIn = async (list) => {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          if (dist(list[a], list[b]) <= maxD) union(list[a], list[b]);
        }
        since += list.length - a - 1;
        if (since >= CHUNK) {
          since = 0;
          onProgress({ done });
          await breathe();
        }
      }
    };

    // Identical hashes, across the whole library.
    const byHash = new Map();
    for (let k = 0; k < n; k++) {
      const h = pool[k].hash;
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h).push(k);
    }
    for (const list of byHash.values()) {
      for (let k = 1; k < list.length; k++) union(list[0], list[k]);
    }

    if (maxD > 0) {
      // Near matches across the whole library, by banding. This is what catches
      // the same photo re-uploaded years later: its capture date is different,
      // so nothing day-bucketed would ever compare the two.
      for (let band = 0; band < BANDS; band++) {
        const at = band * BAND_WIDTH;
        const buckets = new Map();
        for (let k = 0; k < n; k++) {
          const key = pool[k].hash.slice(at, at + BAND_WIDTH);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(k);
        }
        for (const list of buckets.values()) {
          if (list.length < 2) continue;
          if (list.length > MAX_BUCKET) { capped++; continue; }
          await pairsIn(list);
        }
        done = band + 1;
        onProgress({ done });
      }

      // Same capture day. Redundant while maxD is 7 or less, but above that the
      // bands stop guaranteeing anything and this is what keeps recall up.
      if (maxD > 7) {
        const byDay = new Map();
        for (let k = 0; k < n; k++) {
          const d = pool[k].day;
          if (d === 'unknown') continue;
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d).push(k);
        }
        for (const list of byDay.values()) await pairsIn(list);
      }
    }

    const merged = new Map();
    for (let k = 0; k < n; k++) {
      const root = find(k);
      if (!merged.has(root)) merged.set(root, []);
      merged.get(root).push(k);
    }

    // Union-find merges transitively, so A~B and B~C put A and C together even
    // when A and C are nothing alike. Each merged set is re-clustered so that
    // every pair inside a group is within maxD - not merely every member and the
    // keeper, which would still allow a group twice as wide as the threshold.
    // Measured on 4,965 photos at 92%: pairwise costs 8 of 404 duplicates and
    // brings the widest group back from 9 bits to 5.
    const tighten = (list) => {
      const rest = list.slice().sort((a, b) => (pool[a].ts || 0) - (pool[b].ts || 0));
      const out = [];
      while (rest.length) {
        const members = [rest.shift()];
        for (let k = rest.length - 1; k >= 0; k--) {
          if (members.every((m) => dist(m, rest[k]) <= maxD)) {
            members.push(rest[k]);
            rest.splice(k, 1);
          }
        }
        out.push(members);
      }
      return out;
    };

    const out = [];
    for (const g of merged.values()) {
      if (g.length < 2) continue;
      for (const c of tighten(g)) {
        if (c.length < 2) continue;
        const sorted = c.map((k) => pool[k]).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        out.push({ keeperId: sorted[0].id, items: sorted });
      }
    }
    out.sort((a, b) => b.items.length - a.items.length);
    return { groups: out, capped };
  }

  window.GPDD.grouping = { group, maxDistance };
})();
