// Month-range slider with a sparkline of what has already been scanned.
window.GPDD = window.GPDD || {};
window.GPDD.ui = window.GPDD.ui || {};

(() => {
  const { css } = window.GPDD.ui;
  // Scan range. The axis runs newest-on-the-left, matching the order Google
  // Photos itself lays the grid out in, so dragging left-to-right reads as
  // walking backwards in time. Months are handled as a single integer
  // (year * 12 + month) throughout; only get() converts back to timestamps.
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BARS = 48;
  const miOfDate = (d) => d.getFullYear() * 12 + d.getMonth();
  const msOfMi = (mi) => new Date(Math.floor(mi / 12), mi % 12, 1).getTime();
  const fmtMi = (mi) => MON[mi % 12] + ' ' + Math.floor(mi / 12);

  // A popover is a year stepper over a fixed grid of months; drawPop only
  // flips the disabled/on states, so the markup is static and built once.
  const POP = /* HTML */ `<div class="nav">
      <button type="button" data-nav="-1">◀</button><b></b><button type="button" data-nav="1">▶</button>
    </div>
    <div class="mg">${MON.map((m, i) => `<button type="button" data-m="${i}">${m}</button>`).join('')}</div>`;

  const HTML = /* HTML */ ` <div class="range">
    <div class="top">
      <span class="lbl">Range</span>
      <button class="pill p-new" type="button"></button>
      <span class="dash">&ndash;</span>
      <button class="pill p-old" type="button"></button>
      <div class="pop pop-new">${POP}</div>
      <div class="pop pop-old">${POP}</div>
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

  const CSS = css`
    /* ================================================================= range == */
    .range {
      background: var(--raised);
      border: 1px solid var(--hair);
      border-radius: var(--r2);
      padding: var(--s3);
      margin-bottom: var(--s3);
      .top {
        display: flex;
        align-items: center;
        gap: var(--s2);
        position: relative;
        .lbl {
          flex: 1 1 auto;
          color: var(--fg-2);
          font-size: var(--t3);
        }
        .dash {
          color: var(--fg-3);
          font-size: var(--t2);
        }
      }
    }
    button.pill {
      flex: 0 0 auto;
      font: 400 var(--t1)/1.45 var(--ui);
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--sunken);
      border: 1px solid var(--hair);
      color: var(--fg);
      cursor: pointer;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      &:hover {
        border-color: var(--line);
      }
      &.open {
        background: var(--accent-soft);
        border-color: var(--accent);
      }
      i {
        font-style: normal;
        color: var(--fg-3);
        margin-left: 5px;
        font-size: 10px;
      }
    }

    /* The month picker that drops from a pill: a year nav and a 4x3 month grid. */
    .pop {
      position: absolute;
      top: calc(100% + 6px);
      z-index: 6;
      width: 176px;
      padding: var(--s2);
      background: var(--raised);
      border: 1px solid var(--line);
      border-radius: var(--r2);
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.6);
      display: none;
      &.on {
        display: block;
      }
      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 7px;
        b {
          font: 500 var(--t1)/1.2 var(--ui);
          color: var(--fg);
          font-variant-numeric: tabular-nums;
        }
        button {
          width: 20px;
          height: 20px;
          padding: 0;
          border: 0;
          border-radius: var(--r1);
          background: transparent;
          color: var(--fg-3);
          cursor: pointer;
          font: 400 10px/1 var(--ui);
          &:hover:not(:disabled) {
            background: var(--sunken);
            color: var(--fg);
          }
          &:disabled {
            opacity: 0.25;
            cursor: default;
          }
        }
      }
      .mg {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
        button {
          padding: 5px 0;
          border: 0;
          border-radius: var(--r1);
          background: transparent;
          color: var(--fg-2);
          cursor: pointer;
          font: 400 10px/1.2 var(--ui);
          &:hover:not(:disabled) {
            background: var(--sunken);
            color: var(--fg);
          }
          &.on {
            background: var(--accent);
            color: var(--accent-ink);
            font-weight: 500;
          }
          &:disabled {
            opacity: 0.2;
            cursor: default;
          }
        }
      }
    }

    /* The scrubber: a sparkline of what has been scanned, the selected span, and
   a handle at each end. Cold means nothing has been scanned yet, so hatching
   stands in for the sparkline. */
    .scrub {
      position: relative;
      height: 44px;
      margin-top: var(--s2);
      border-radius: var(--r1);
      background: var(--sunken);
      overflow: hidden;
      touch-action: none;
      .spark {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        gap: 1px;
        padding: 0 1px;
        b {
          flex: 1;
          min-height: 1px;
          background: var(--line);
          border-radius: 1px 1px 0 0;
        }
      }
      &.cold {
        .spark {
          display: none;
        }
        &::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0.5;
          background: repeating-linear-gradient(135deg, transparent 0 5px, var(--hair) 5px 6px);
        }
      }
    }
    .sel {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--accent-soft);
      border-left: 2px solid var(--accent);
      border-right: 2px solid var(--accent);
    }
    .hand {
      position: absolute;
      top: 50%;
      width: 10px;
      height: 24px;
      margin-top: -12px;
      background: var(--accent);
      border-radius: 3px;
      cursor: ew-resize;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    .ticks {
      display: flex;
      justify-content: space-between;
      margin-top: 5px;
      color: var(--fg-3);
      font: 400 10px/1 var(--ui);
      font-variant-numeric: tabular-nums;
    }
    .rest {
      display: flex;
      align-items: baseline;
      gap: var(--s2);
      margin-top: var(--s2);
      .est {
        flex: 1 1 auto;
        color: var(--fg-3);
        font-size: var(--t1);
      }
      .all {
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        color: var(--accent);
        font: 400 var(--t1)/1.2 var(--ui);
        &:disabled {
          color: var(--fg-3);
          cursor: default;
        }
      }
    }
  `;

  function buildRange(ui, $) {
    const els = {
      pNew: $('.p-new'),
      pOld: $('.p-old'),
      popNew: $('.pop-new'),
      popOld: $('.pop-old'),
      scrub: $('.scrub'),
      spark: $('.spark'),
      sel: $('.sel'),
      hNew: $('.h-new'),
      hOld: $('.h-old'),
      ticks: $('.ticks'),
      est: $('.rest .est'),
      all: $('.rest .all'),
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
      els.popNew.classList.remove('on');
      els.popOld.classList.remove('on');
      els.pNew.classList.remove('open');
      els.pOld.classList.remove('open');
    }

    function drawPop(which) {
      const el = which ? els.popOld : els.popNew;
      const val = which ? R.from : R.to;
      const y = viewY[which];
      el.querySelector('[data-nav="-1"]').disabled = y <= Math.floor(R.lo / 12);
      el.querySelector('[data-nav="1"]').disabled = y >= Math.floor(R.hi / 12);
      el.querySelector('.nav b').textContent = String(y);
      el.querySelectorAll('[data-m]').forEach((b) => {
        const mi = y * 12 + Number(b.dataset.m);
        b.disabled = mi < R.lo || mi > R.hi;
        b.classList.toggle('on', mi === val);
      });
    }

    function popClick(which) {
      return (e) => {
        e.stopPropagation();
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.nav) {
          viewY[which] += Number(b.dataset.nav);
          drawPop(which);
          return;
        }
        if (!b.dataset.m) return;
        const mi = viewY[which] * 12 + Number(b.dataset.m);
        if (which) R.from = mi;
        else R.to = mi;
        shut();
        commit();
      };
    }
    els.popNew.onclick = popClick(0);
    els.popOld.onclick = popClick(1);

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
      if (cold) {
        els.spark.textContent = '';
        return;
      }
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

    const pill = (el, mi) => {
      el.textContent = '';
      el.append(fmtMi(mi), Object.assign(document.createElement('i'), { textContent: '▾' }));
    };

    function draw() {
      if (R.from > R.to) {
        const t = R.from;
        R.from = R.to;
        R.to = t;
      }
      R.from = Math.max(R.lo, Math.min(R.hi, R.from));
      R.to = Math.max(R.lo, Math.min(R.hi, R.to));
      const left = x(R.to + 1),
        right = x(R.from);
      els.sel.style.left = left + '%';
      els.sel.style.right = 100 - right + '%';
      // Clamped inside the track: at full range the handles would otherwise sit
      // half outside it and be clipped, leaving nothing to grab.
      const place = (pc) => 'clamp(0px, calc(' + pc + '% - 5px), calc(100% - 10px))';
      els.hNew.style.left = place(left);
      els.hOld.style.left = place(right);
      pill(els.pNew, R.to);
      pill(els.pOld, R.from);
      els.all.disabled = isFull();

      const months = R.to - R.from + 1;
      let scanned = 0;
      R.hist.forEach((n, mi) => {
        if (mi >= R.from && mi <= R.to) scanned += n;
      });
      els.est.textContent = isFull()
        ? R.hist.size
          ? scanned.toLocaleString() + ' photos already scanned'
          : 'Whole library'
        : months +
          (months === 1 ? ' month' : ' months') +
          (R.hist.size ? ' · ' + scanned.toLocaleString() + ' already scanned' : ' · not scanned yet');
    }

    function commit() {
      draw();
      if (R.onchange) R.onchange();
    }

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
        el.onpointerup = () => {
          el.onpointermove = null;
          el.onpointerup = null;
          commit();
        };
      };
    }
    drag(els.hNew, (v) => (R.to = v));
    drag(els.hOld, (v) => (R.from = v));

    els.pNew.onclick = (e) => {
      e.stopPropagation();
      showPop(0);
    };
    els.pOld.onclick = (e) => {
      e.stopPropagation();
      showPop(1);
    };
    els.all.onclick = () => {
      R.from = R.lo;
      R.to = R.hi;
      commit();
    };
    // Click is composed, so this sees clicks inside the panel too; the pills
    // and popovers stop theirs before it gets here.
    document.addEventListener('click', shut);

    draw();
    drawSpark();
    drawTicks();

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
        if (wasFull) {
          R.from = R.lo;
          R.to = R.hi;
        }
        draw();
        drawSpark();
        drawTicks();
      },
      get() {
        return {
          full: isFull(),
          label: fmtMi(R.to) + ' – ' + fmtMi(R.from), // newest first, as the pills read
          fromMs: isFull() ? null : msOfMi(R.from),
          toMs: isFull() ? null : msOfMi(R.to + 1), // exclusive
        };
      },
      set onchange(fn) {
        R.onchange = fn;
      },
    };
  }

  window.GPDD.ui.range = { HTML, CSS, build: buildRange };
})();
