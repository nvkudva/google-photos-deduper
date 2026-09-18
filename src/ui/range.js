// Month-range slider with a sparkline of what has already been scanned.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  // Scan range. The axis runs newest-on-the-left, matching the order Google
  // Photos itself lays the grid out in, so dragging left-to-right reads as
  // walking backwards in time. Months are handled as a single integer
  // (year * 12 + month) throughout; only get() converts back to timestamps.
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BARS = 48;
  const miOfDate = (d) => d.getFullYear() * 12 + d.getMonth();
  const msOfMi = (mi) => new Date(Math.floor(mi / 12), mi % 12, 1).getTime();
  const fmtMi = (mi) => MON[mi % 12] + ' ' + Math.floor(mi / 12);

  const HTML = /* html */ `
    <div class="range">
      <div class="top">
        <span class="lbl">Range</span>
        <button class="pill p-new" type="button"></button>
        <span class="dash">&ndash;</span>
        <button class="pill p-old" type="button"></button>
        <div class="pop pop-new"></div>
        <div class="pop pop-old"></div>
      </div>
      <div class="scrub cold">
        <div class="spark"></div>
        <div class="sel"></div>
        <div class="hand h-new"></div>
        <div class="hand h-old"></div>
      </div>
      <div class="ticks"></div>
      <div class="rest"><span class="est"></span><button class="all" type="button">Whole library</button></div>
    </div>`;

  function buildRange(ui, $) {
    const els = {
      wrap: $('.range'), top: $('.range .top'),
      pNew: $('.p-new'), pOld: $('.p-old'), popNew: $('.pop-new'), popOld: $('.pop-old'),
      scrub: $('.scrub'), spark: $('.spark'), sel: $('.sel'),
      hNew: $('.h-new'), hOld: $('.h-old'), ticks: $('.ticks'),
      est: $('.rest .est'), all: $('.rest .all'),
    };

    const now = miOfDate(new Date());
    // Until a scan has filled the histogram there is nothing to say where the
    // library starts, so the axis assumes a generous span and the sparkline
    // renders as hatching rather than as a fake distribution.
    const R = { hi: now, lo: now - 20 * 12, from: now - 20 * 12, to: now, hist: new Map(), onchange: null };

    const span = () => R.hi + 1 - R.lo;
    const x = (b) => ((R.hi + 1 - b) / span()) * 100;
    const isFull = () => R.from <= R.lo && R.to >= R.hi;

    let openPop = -1; // 0 = newer pill, 1 = older pill
    const viewY = [0, 0];

    function shut() {
      openPop = -1;
      els.popNew.classList.remove('on'); els.popOld.classList.remove('on');
      els.pNew.classList.remove('open'); els.pOld.classList.remove('open');
    }

    function drawPop(which) {
      const el = which ? els.popOld : els.popNew;
      const val = which ? R.from : R.to;
      const y = viewY[which];
      const loY = Math.floor(R.lo / 12), hiY = Math.floor(R.hi / 12);
      el.textContent = '';
      const nav = document.createElement('div');
      nav.className = 'nav';
      const back = document.createElement('button');
      back.type = 'button'; back.textContent = '◀'; back.disabled = y <= loY;
      const label = document.createElement('b');
      label.textContent = String(y);
      const fwd = document.createElement('button');
      fwd.type = 'button'; fwd.textContent = '▶'; fwd.disabled = y >= hiY;
      back.onclick = (e) => { e.stopPropagation(); viewY[which]--; drawPop(which); };
      fwd.onclick = (e) => { e.stopPropagation(); viewY[which]++; drawPop(which); };
      nav.append(back, label, fwd);
      const mg = document.createElement('div');
      mg.className = 'mg';
      for (let m = 0; m < 12; m++) {
        const mi = y * 12 + m;
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = MON[m];
        b.disabled = mi < R.lo || mi > R.hi;
        if (mi === val) b.classList.add('on');
        b.onclick = (e) => {
          e.stopPropagation();
          if (which) R.from = mi; else R.to = mi;
          shut();
          commit();
        };
        mg.append(b);
      }
      el.append(nav, mg);
    }

    function showPop(which) {
      const was = openPop;
      shut();
      if (was === which) return;
      openPop = which;
      viewY[which] = Math.floor((which ? R.from : R.to) / 12);
      drawPop(which);
      (which ? els.popOld : els.popNew).classList.add('on');
      (which ? els.pOld : els.pNew).classList.add('open');
    }

    function drawSpark() {
      const cold = R.hist.size === 0;
      els.scrub.classList.toggle('cold', cold);
      if (cold) { els.spark.textContent = ''; return; }
      const buckets = new Array(BARS).fill(0);
      R.hist.forEach((n, mi) => {
        if (mi < R.lo || mi > R.hi) return;
        const i = Math.min(BARS - 1, Math.floor(((R.hi - mi) / span()) * BARS));
        buckets[i] += n;
      });
      const peak = Math.max(1, ...buckets);
      els.spark.textContent = '';
      buckets.forEach((n) => {
        const b = document.createElement('b');
        b.style.height = Math.round((n / peak) * 100) + '%';
        els.spark.append(b);
      });
    }

    function drawTicks() {
      els.ticks.textContent = '';
      for (let i = 0; i < 5; i++) {
        const mi = Math.round(R.hi - (i / 4) * (span() - 1));
        const t = document.createElement('span');
        t.textContent = i === 0 ? 'now' : String(Math.floor(mi / 12));
        els.ticks.append(t);
      }
    }

    function draw() {
      if (R.from > R.to) { const t = R.from; R.from = R.to; R.to = t; }
      R.from = Math.max(R.lo, Math.min(R.hi, R.from));
      R.to = Math.max(R.lo, Math.min(R.hi, R.to));
      const left = x(R.to + 1), right = x(R.from);
      els.sel.style.left = left + '%';
      els.sel.style.right = 100 - right + '%';
      // Clamped inside the track: at full range the handles would otherwise sit
      // half outside it and be clipped, leaving nothing to grab.
      const place = (pc) => 'clamp(0px, calc(' + pc + '% - 5px), calc(100% - 10px))';
      els.hNew.style.left = place(left);
      els.hOld.style.left = place(right);
      els.pNew.innerHTML = '';
      els.pNew.append(fmtMi(R.to), Object.assign(document.createElement('i'), { textContent: '▾' }));
      els.pOld.innerHTML = '';
      els.pOld.append(fmtMi(R.from), Object.assign(document.createElement('i'), { textContent: '▾' }));
      els.all.disabled = isFull();

      const months = R.to - R.from + 1;
      let scanned = 0;
      R.hist.forEach((n, mi) => { if (mi >= R.from && mi <= R.to) scanned += n; });
      els.est.textContent = isFull()
        ? (R.hist.size ? scanned.toLocaleString() + ' photos already scanned' : 'Whole library')
        : months + (months === 1 ? ' month' : ' months') +
          (R.hist.size ? ' · ' + scanned.toLocaleString() + ' already scanned' : ' · not scanned yet');
    }

    function commit() { draw(); if (R.onchange) R.onchange(); }

    function drag(el, set) {
      el.onpointerdown = (e) => {
        e.preventDefault();
        shut();
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const r = els.scrub.getBoundingClientRect();
          const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
          set(Math.max(R.lo, Math.min(R.hi, Math.floor(R.hi + 1 - f * span()))));
          draw();
        };
        move(e);
        el.onpointermove = move;
        el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; commit(); };
      };
    }
    drag(els.hNew, (v) => (R.to = v));
    drag(els.hOld, (v) => (R.from = v));

    els.pNew.onclick = (e) => { e.stopPropagation(); showPop(0); };
    els.pOld.onclick = (e) => { e.stopPropagation(); showPop(1); };
    els.all.onclick = () => { R.from = R.lo; R.to = R.hi; commit(); };
    ui.root.addEventListener('click', (e) => { if (!els.top.contains(e.composedPath()[0])) shut(); });
    document.addEventListener('click', shut);

    draw(); drawSpark(); drawTicks();

    return {
      // Counts per month, from whatever is already in the store. Also fixes the
      // left edge of the axis: the library cannot start before its oldest row.
      setHistogram(items) {
        const wasFull = isFull();
        R.hist = new Map();
        let oldest = R.hi;
        items.forEach((i) => {
          if (!i.ts) return;
          const mi = miOfDate(new Date(i.ts));
          R.hist.set(mi, (R.hist.get(mi) || 0) + 1);
          if (mi < oldest) oldest = mi;
        });
        if (R.hist.size) R.lo = Math.min(R.lo, oldest);
        if (wasFull) { R.from = R.lo; R.to = R.hi; }
        draw(); drawSpark(); drawTicks();
      },
      get() {
        return {
          full: isFull(),
          label: fmtMi(R.to) + ' – ' + fmtMi(R.from), // newest first, as the pills read
          fromMs: isFull() ? null : msOfMi(R.from),
          toMs: isFull() ? null : msOfMi(R.to + 1), // exclusive
        };
      },
      set onchange(fn) { R.onchange = fn; },
    };
  }

  window.GPDD.ui.range = { HTML, build: buildRange };
})();
