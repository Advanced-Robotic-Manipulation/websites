/* -----------------------------------------------------------------------------
 * Animated haptic grid — 10x10 taxel heatmap with Gaussian "touch" events.
 *
 * A persistent background touch slowly shifts (simulating a held grasp), and
 * every couple seconds a transient press ripples out on top. Color map roughly
 * matches the paper's tactile_map.png: deep indigo -> blue -> red-coral -> hot.
 * -------------------------------------------------------------------------- */

(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 10;
  const PAD  = 0.18;           // inter-cell padding as fraction of cell size
  const TOUCH_INTERVAL = 2200; // ms between transient taps
  const BASE_HOLD_LIFETIME = 18000;

  // Color stops — low to high intensity.
  const STOPS = [
    [0.00, [14,  16,  28,  0.10]],   // idle: nearly invisible
    [0.08, [22,  32,  66,  0.75]],   // deep indigo
    [0.30, [56,  92,  210, 1.0]],   // blue
    [0.55, [205, 68,  82,  1.0]],   // red-coral
    [0.80, [255, 82,  56,  1.0]],   // hot red
    [1.00, [255, 220, 180, 1.0]]    // highlight / saturation
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function cmap(v) {
    v = Math.max(0, Math.min(1, v));
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [a, ac] = STOPS[i];
      const [b, bc] = STOPS[i + 1];
      if (v >= a && v <= b) {
        const t = (v - a) / (b - a || 1);
        const r = Math.round(lerp(ac[0], bc[0], t));
        const g = Math.round(lerp(ac[1], bc[1], t));
        const bl = Math.round(lerp(ac[2], bc[2], t));
        const al = lerp(ac[3], bc[3], t);
        return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
      }
    }
    const last = STOPS[STOPS.length - 1][1];
    return `rgba(${last[0]},${last[1]},${last[2]},${last[3]})`;
  }

  class HapticGrid {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.intensity = new Float32Array(COLS * ROWS);
      this.touches = [];
      this.hold = {
        x: 0.5, y: 0.5,
        targetX: 0.5, targetY: 0.5,
        sigma: 0.16,
        amp: 0.55,
        nextShift: 0
      };
      this.lastTap = 0;
      this.running = false;

      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.start();

      // Light interactivity: a pointer tap adds a touch at the cursor.
      canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top)  / rect.height;
        this.addTouch(x, y, 1.0, 1300, 0.12);
      });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.w = rect.width;
      this.h = rect.height;
    }

    addTouch(x, y, peak = 1, duration = 1700, sigma = 0.18) {
      this.touches.push({
        x, y, peak, duration, sigma, t0: performance.now()
      });
    }

    scheduleHoldShift(now) {
      if (now < this.hold.nextShift) return;
      // drift slowly to a new held-grasp center
      this.hold.targetX = 0.28 + Math.random() * 0.44;
      this.hold.targetY = 0.28 + Math.random() * 0.44;
      this.hold.nextShift = now + 4500 + Math.random() * 3500;
    }

    updateHold(dt) {
      // ease current hold toward target
      const k = 1 - Math.exp(-dt / 900); // ~900ms half-life
      this.hold.x += (this.hold.targetX - this.hold.x) * k;
      this.hold.y += (this.hold.targetY - this.hold.y) * k;
      // subtle breath on amplitude
      this.hold.ampBreath = 0.5 + 0.06 * Math.sin(performance.now() / 900);
    }

    addAutoTap(now) {
      if (now - this.lastTap < TOUCH_INTERVAL) return;
      this.lastTap = now;
      // biased near hold center so the "press" looks like a squeeze
      const jx = (Math.random() - 0.5) * 0.22;
      const jy = (Math.random() - 0.5) * 0.22;
      const x = Math.max(0.08, Math.min(0.92, this.hold.x + jx));
      const y = Math.max(0.08, Math.min(0.92, this.hold.y + jy));
      this.addTouch(x, y, 0.85 + Math.random() * 0.2, 1500 + Math.random() * 600, 0.12 + Math.random() * 0.05);
    }

    step(now, prev) {
      const dt = prev ? now - prev : 16;
      this.updateHold(dt);
      this.scheduleHoldShift(now);
      this.addAutoTap(now);
      this.touches = this.touches.filter(t => now - t.t0 < t.duration);

      // reset intensity, start with the persistent hold
      const holdAmp = this.hold.amp * (this.hold.ampBreath || 0.55);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = (c + 0.5) / COLS;
          const cy = (r + 0.5) / ROWS;
          const dx = cx - this.hold.x;
          const dy = cy - this.hold.y;
          const d2 = dx * dx + dy * dy;
          const s2 = 2 * this.hold.sigma * this.hold.sigma;
          this.intensity[r * COLS + c] = holdAmp * Math.exp(-d2 / s2);
        }
      }
      // additive transient taps
      for (const t of this.touches) {
        const age = (now - t.t0) / t.duration;     // 0..1
        let pulse;
        if (age < 0.18) pulse = age / 0.18;         // fast rise
        else            pulse = Math.pow(1 - (age - 0.18) / 0.82, 1.4); // slow fall
        const amp = t.peak * pulse;
        const s2 = 2 * t.sigma * t.sigma;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cx = (c + 0.5) / COLS;
            const cy = (r + 0.5) / ROWS;
            const dx = cx - t.x;
            const dy = cy - t.y;
            const d2 = dx * dx + dy * dy;
            const v = amp * Math.exp(-d2 / s2);
            const idx = r * COLS + c;
            // softly combine rather than add raw — keeps things bounded
            const current = this.intensity[idx];
            this.intensity[idx] = 1 - (1 - current) * (1 - v);
          }
        }
      }

      this.draw();
      requestAnimationFrame((t2) => this.step(t2, now));
    }

    draw() {
      const { ctx, w, h } = this;
      ctx.clearRect(0, 0, w, h);

      // subtle cross-hair reference lines
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.restore();

      const cellW = w / COLS;
      const cellH = h / ROWS;
      const pad   = Math.min(cellW, cellH) * PAD;
      const radius = Math.min(cellW, cellH) * 0.18;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          const v = this.intensity[i];
          const x = c * cellW + pad;
          const y = r * cellH + pad;
          const cw = cellW - 2 * pad;
          const ch = cellH - 2 * pad;

          ctx.fillStyle = cmap(v);
          roundRect(ctx, x, y, cw, ch, Math.min(radius, cw * 0.25, ch * 0.25));
          ctx.fill();

          // glow on hot cells
          if (v > 0.55) {
            ctx.save();
            ctx.shadowBlur = 18 * (v - 0.5) * 2;
            ctx.shadowColor = cmap(Math.min(1, v + 0.15));
            ctx.fillStyle = cmap(v);
            roundRect(ctx, x, y, cw, ch, Math.min(radius, cw * 0.25, ch * 0.25));
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      requestAnimationFrame((t) => this.step(t, null));
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  function init() {
    const canvas = document.getElementById('haptic-grid');
    if (!canvas) return;
    const grid = new HapticGrid(canvas);
    window.__hapticGrid = grid;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* -------------------------------------------------------------------------
 * BibTeX copy helper
 * ------------------------------------------------------------------------- */
(function () {
  function bind() {
    const btn = document.querySelector('.bibtex .copy');
    const code = document.querySelector('.bibtex pre code');
    if (!btn || !code) return;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        const orig = btn.textContent;
        btn.textContent = 'copied';
        btn.classList.add('ok');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('ok'); }, 1600);
      } catch (e) {
        btn.textContent = 'select & copy';
      }
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', bind);
  else
    bind();
})();
