// Grouping is bucketed by capture day so the pairwise comparison stays tractable
// at ~100k items. The day comes free from the tile's aria-label, no extra fetch.
// Identical hashes are also matched globally, which catches the same file
// re-uploaded years apart (the case day-bucketing would miss).
window.GPDD = window.GPDD || {};

(() => {
  const { hash } = window.GPDD;

  const maxDistance = (similarityPct) => Math.round(((100 - similarityPct) / 100) * 64);

  const degenerate = (hex) => hash.degenerate(hex);

  function group(items, { similarity = 90, includeVideos = false } = {}) {
    const pool = items.filter(
      (i) => i.hash && !degenerate(i.hash) && (includeVideos || i.kind !== 'Video')
    );
    const maxD = maxDistance(similarity);

    const parent = new Map(pool.map((i) => [i.id, i.id]));
    const find = (x) => {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)));
        x = parent.get(x);
      }
      return x;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    // Exact-hash matches, across the whole library.
    const byHash = new Map();
    for (const i of pool) {
      if (!byHash.has(i.hash)) byHash.set(i.hash, []);
      byHash.get(i.hash).push(i);
    }
    for (const list of byHash.values()) {
      for (let k = 1; k < list.length; k++) union(list[0].id, list[k].id);
    }

    // Near matches, within a capture day.
    if (maxD > 0) {
      const byDay = new Map();
      for (const i of pool) {
        if (i.day === 'unknown') continue;
        if (!byDay.has(i.day)) byDay.set(i.day, []);
        byDay.get(i.day).push(i);
      }
      for (const list of byDay.values()) {
        for (let a = 0; a < list.length; a++) {
          for (let b = a + 1; b < list.length; b++) {
            if (hash.hamming(list[a].hash, list[b].hash) <= maxD) union(list[a].id, list[b].id);
          }
        }
      }
    }

    const groups = new Map();
    for (const i of pool) {
      const root = find(i.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(i);
    }

    return [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => {
        const sorted = g.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
        return { keeperId: sorted[0].id, items: sorted };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }

  window.GPDD.grouping = { group, maxDistance };
})();
