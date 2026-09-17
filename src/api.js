// Deletion goes straight to the RPC Google Photos itself calls when "Move to
// bin" is clicked, instead of driving the page. Everything that made driving
// the page fragile - trusted clicks through the debugger, a tab that has to
// stay visible, a detail view per photo, no receipt for success - goes away:
// one request bins up to 250 photos and the response names each one.
//
// The endpoint is Google's private batchexecute protocol, so this is pinned to
// it. The rpcids have been stable across years of Google builds (the
// userscript xob0t/Google-Photos-Toolkit, MIT, has shipped the same ones since
// 2024 and is where the shapes below come from). If Google changes the shape
// the failure mode is a skipped photo, never a wrongly binned one: a photo is
// only binned by a dedup key that was returned against its own media key, and
// only counted as gone when the response names it back.
//
// The bin works on a different identifier from the URL. /photo/<mediaKey> is
// what the extension knows; the trash RPC takes the photo's dedup key, which
// the media-info RPC returns. That is why capturing traffic keyed on the
// media key never found the trash request.
window.GPDD = window.GPDD || {};

(() => {
  const { store } = window.GPDD;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const RPC_INFO = 'VrseUb'; // [mediaKey] -> [[mediaKey, ..., dedupKey at 3, ...]]
  const RPC_TRASH = 'XwAOJf'; // [null, 1, dedupKeys, 3] bins; [null, 3, dedupKeys, 2] restores
  const INFO_BATCH = 50; // 30 measured at 497ms in one request
  const TRASH_BATCH = 250;
  const MEDIA_KEY = /AF1Qip[A-Za-z0-9_-]{10,}/g;

  // The page's own request context lives in an inline script the content
  // script can read but not execute. The XSRF token (SNlM0e) is used for the
  // request and never logged or stored.
  function globals() {
    const script = [...document.scripts].find((s) => !s.src && s.textContent.includes('WIZ_global_data'));
    const text = script ? script.textContent : '';
    const pick = (k) => {
      const m = text.match(new RegExp('"' + k + '":\\s*"([^"]*)"'));
      return m ? m[1] : null;
    };
    const g = { at: pick('SNlM0e'), sid: pick('FdrFJe'), bl: pick('cfb2h'), path: pick('eptZe') };
    const missing = Object.keys(g).filter((k) => !g[k]);
    if (missing.length) throw new Error(`could not read the page's request context (${missing.join(', ')})`);
    return g;
  }

  // One HTTP request carrying several calls of the same rpc. The response is a
  // stream of "wrb.fr" envelopes, out of order, each tagged with the index it
  // answers, so the result is realigned to the input.
  async function batch(rpcid, argsList) {
    const g = globals();
    const calls = argsList.map((args, i) => [rpcid, JSON.stringify(args), null, String(i + 1)]);
    const params = new URLSearchParams({
      rpcids: rpcid, 'source-path': location.pathname, 'f.sid': g.sid, bl: g.bl, pageId: 'none', rt: 'c',
    });
    const body = `f.req=${encodeURIComponent(JSON.stringify([calls]))}&at=${encodeURIComponent(g.at)}&`;
    const res = await fetch(`https://photos.google.com${g.path}data/batchexecute?${params}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${rpcid}`);
    const out = new Array(argsList.length).fill(null);
    for (const line of (await res.text()).split('\n')) {
      if (!line.startsWith('[["wrb.fr"')) continue;
      let env;
      try { env = JSON.parse(line)[0]; } catch (e) { continue; }
      const i = Number(env[6]) - 1;
      if (env[1] !== rpcid || !(i >= 0 && i < out.length) || !env[2]) continue;
      try { out[i] = JSON.parse(env[2]); } catch (e) { /* left null: treated as unanswered */ }
    }
    return out;
  }

  // mediaKey -> dedupKey, only where the answer echoes the key it was asked for.
  async function dedupKeys(ids) {
    const map = new Map();
    const answers = await batch(RPC_INFO, ids.map((id) => [id, null, null, null, null]));
    answers.forEach((p, i) => {
      const item = p && p[0];
      if (item && item[0] === ids[i] && typeof item[3] === 'string' && item[3]) map.set(ids[i], item[3]);
    });
    return map;
  }

  // A chunk is retried once after a pause: the useful failures are a dropped
  // connection or a momentary 5xx, and a second try a few seconds later is
  // what the page itself does.
  async function twice(fn, log, what) {
    try {
      return await fn();
    } catch (e) {
      log(`${what} failed (${e.message || e}); trying once more`);
      await sleep(3000);
      return fn();
    }
  }

  async function run({ targetIds, shouldStop = () => false, onProgress = () => {} }) {
    const log = (t) => onProgress({ log: t });
    const targets = [...new Set(targetIds)];
    const deleted = [];
    const skipped = [];
    let next = 0;
    let stoppedEarly = false;
    const report = () =>
      onProgress({ deleted: deleted.length, skipped: skipped.length, remaining: targets.length - deleted.length - skipped.length });

    while (next < targets.length) {
      if (shouldStop()) { stoppedEarly = true; break; }
      const chunk = targets.slice(next, next + TRASH_BATCH);
      next += chunk.length;

      const keys = new Map();
      for (let i = 0; i < chunk.length; i += INFO_BATCH) {
        const part = chunk.slice(i, i + INFO_BATCH);
        let m;
        try { m = await twice(() => dedupKeys(part), log, 'looking up photos'); }
        catch (e) { log(`${part.length} skipped: lookup failed (${e.message || e})`); part.forEach((id) => skipped.push(id)); continue; }
        part.forEach((id) => { if (m.has(id)) keys.set(id, m.get(id)); else skipped.push(id); });
      }
      const unresolved = chunk.length - keys.size;
      if (unresolved) log(`${unresolved} skipped: Google returned no key for them`);
      if (!keys.size) { report(); continue; }

      const ids = [...keys.keys()];
      let receipt;
      try {
        receipt = await twice(() => batch(RPC_TRASH, [[null, 1, ids.map((id) => keys.get(id)), 3]]), log, 'move to bin');
      } catch (e) {
        log(`${ids.length} skipped: move to bin failed (${e.message || e})`);
        ids.forEach((id) => skipped.push(id));
        report();
        continue;
      }
      // The response names what it binned, e.g. [[mediaKey, mediaKey]]. Only a
      // photo named back is counted, and only those leave the store.
      const named = new Set(JSON.stringify(receipt[0] || null).match(MEDIA_KEY) || []);
      const done = ids.filter((id) => named.has(id));
      const unnamed = ids.filter((id) => !named.has(id));
      if (unnamed.length) log(`${unnamed.length} skipped: not confirmed by Google's reply`);
      unnamed.forEach((id) => skipped.push(id));
      if (done.length) {
        await store.remove(done);
        done.forEach((id) => deleted.push(id));
      }
      report();
    }

    const finished = new Set([...deleted, ...skipped]);
    return {
      deleted: deleted.length,
      skipped,
      remaining: targets.filter((id) => !finished.has(id)),
      stoppedEarly,
    };
  }

  window.GPDD.api = { run, batch, dedupKeys, RPC_TRASH };
})();
