// A live dot-matrix screen: redraws a recorded rollout video as a grid of dots,
// with a fingertip-force strip along the bottom and a gel-like response to the pointer.
// Nothing here invents data: every dot is a downsampled pixel of the recording, and the
// strip is the recorded |Fz|. The pointer response is a display effect only.

const GROUND = 'rgb(7,10,16)';
const INK = 'rgb(232,236,241)';
const SERIES = [[31, 168, 152], [224, 108, 50]]; // left, right: the page's two series colors on a dark ground
const GRID = 'rgb(38,46,58)';

// The source video is 960x480: scene camera (640x480) beside the two stacked deformation maps (320x240).
// Each layout places those three regions, plus the force strip, on one grid of square cells.
export const LAYOUTS = {
  wide: {
    cols: 193, rows: 109,
    regions: [
      { key: 'scene', src: [0, 0, 640, 480], x: 0, y: 0, w: 128, h: 96 },
      { key: 'left', src: [640, 0, 320, 240], x: 130, y: 0, w: 63, h: 47 },
      { key: 'right', src: [640, 240, 320, 240], x: 130, y: 49, w: 63, h: 47 },
    ],
    band: { x: 0, y: 97, w: 193, h: 12 },
  },
  tall: {
    cols: 96, rows: 122,
    regions: [
      { key: 'scene', src: [0, 0, 640, 480], x: 0, y: 0, w: 96, h: 72 },
      { key: 'left', src: [640, 0, 320, 240], x: 0, y: 74, w: 47, h: 35 },
      { key: 'right', src: [640, 240, 320, 240], x: 49, y: 74, w: 47, h: 35 },
    ],
    band: { x: 0, y: 110, w: 96, h: 12 },
  },
};

const colorCache = new Array(32768);
function rgb(r, g, b) {
  r = r > 255 ? 255 : r < 0 ? 0 : r | 0; g = g > 255 ? 255 : g < 0 ? 0 : g | 0; b = b > 255 ? 255 : b < 0 ? 0 : b | 0;
  const key = (r >> 3 << 10) | (g >> 3 << 5) | (b >> 3);
  return colorCache[key] || (colorCache[key] = `rgb(${r & 248 | 4},${g & 248 | 4},${b & 248 | 4})`);
}

export class DotScreen {
  constructor(canvas, { onLayout, onSeek, onFrame, onFail, calm = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sampler = document.createElement('canvas');
    this.sctx = this.sampler.getContext('2d', { willReadFrequently: true });
    this.onLayout = onLayout; this.onSeek = onSeek; this.onFrame = onFrame; this.onFail = onFail;
    this.calm = calm;                       // reduced motion: no pointer response
    this.video = null; this.poster = null;  // sources: the playing video, or its poster until frames arrive
    this.pixels = null; this.failed = false;
    this.force = null; this.bins = null;
    this.pointer = { x: 0, y: 0, s: 0, target: 0 };
    this.ripples = [];
    this.scrubbing = false; this.visible = true;
    this.dirty = true; this.resample = true; this.lastTime = -1; this.lastDraw = 0; this.prev = 0;
    this.layout = null; this.name = '';
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    new IntersectionObserver(entries => {
      this.visible = entries[entries.length - 1].isIntersecting;
      if (this.visible) { this.dirty = true; this.start(); }
    }, { rootMargin: '100px' }).observe(canvas);
    this.bindPointer();
    this.start();
  }

  resize() {
    const width = this.canvas.parentElement.clientWidth;
    if (!width) return;
    const name = width < 560 ? 'tall' : 'wide';
    if (name !== this.name) {
      this.name = name; this.layout = LAYOUTS[name];
      this.sampler.width = this.layout.cols; this.sampler.height = this.layout.rows;
      this.canvas.style.aspectRatio = `${this.layout.cols} / ${this.layout.rows}`;
      this.pixels = null; this.resample = true;
      this.rebin();
      this.onLayout?.(name, this.layout);
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr), h = Math.round(w * this.layout.rows / this.layout.cols);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cell = w / this.layout.cols;
    this.dirty = true;
  }

  // Recorded force: { left: [[t, Fz], ...], right: [...] }, a duration in seconds, and the |Fz| that fills the strip.
  setForce(force, duration, max) { this.force = { ...force, duration, max }; this.rebin(); this.dirty = true; }
  rebin() {
    if (!this.force || !this.layout) return;
    const n = this.layout.band.w, { duration, max } = this.force;
    this.bins = ['left', 'right'].map(side => {
      const sum = new Float32Array(n), count = new Uint16Array(n), out = new Float32Array(n);
      for (const [t, v] of this.force[side]) {
        const i = Math.min(n - 1, Math.max(0, Math.floor(t / duration * n)));
        sum[i] += Math.abs(v); count[i]++;
      }
      let last = 0;
      for (let i = 0; i < n; i++) { if (count[i]) last = sum[i] / count[i] / max; out[i] = Math.min(1, last); }
      return out;
    });
  }

  invalidate() { this.resample = true; this.dirty = true; }
  start() { if (!this.raf) this.raf = requestAnimationFrame(t => this.tick(t)); }

  progress() {
    const v = this.video;
    if (!v || !this.force) return 0;
    return Math.max(0, Math.min(1, v.currentTime / this.force.duration));
  }

  bindPointer() {
    const c = this.canvas, P = this.pointer;
    const at = e => {
      const r = c.getBoundingClientRect(), k = c.width / r.width;
      return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
    };
    const inBand = y => y >= this.layout.band.y * this.cell;
    const seek = x => this.onSeek?.(Math.max(0, Math.min(1, x / c.width)));
    c.addEventListener('pointerdown', e => {
      const [x, y] = at(e);
      if (inBand(y)) { this.scrubbing = true; c.setPointerCapture(e.pointerId); seek(x); e.preventDefault(); }
      else if (!this.calm) { P.x = x; P.y = y; P.target = 1; this.ripples.push({ x, y, t0: performance.now() }); if (this.ripples.length > 4) this.ripples.shift(); }
      this.start();
    });
    c.addEventListener('pointermove', e => {
      const [x, y] = at(e);
      if (this.scrubbing) { seek(x); return; }
      c.style.cursor = inBand(y) ? 'ew-resize' : 'crosshair';
      if (this.calm) return;
      P.x = x; P.y = y;
      if (e.pointerType === 'mouse' || e.buttons) P.target = inBand(y) ? 0 : 1;
      this.start();
    });
    const release = () => { this.scrubbing = false; P.target = 0; this.start(); };
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) c.addEventListener(type, release);
  }

  sample() {
    // A video that has not played yet may have no decoded frame to draw: show its poster until it moves.
    const v = this.video, live = v && v.readyState >= 2 && (v.currentTime > 0 || !v.paused);
    const el = live ? v : this.poster;
    if (!el || this.failed) return;
    const sw = el.videoWidth || el.naturalWidth, sh = el.videoHeight || el.naturalHeight;
    if (!sw) return;
    const kx = sw / 960, ky = sh / 480, L = this.layout;
    try {
      for (const r of L.regions) this.sctx.drawImage(el, r.src[0] * kx, r.src[1] * ky, r.src[2] * kx, r.src[3] * ky, r.x, r.y, r.w, r.h);
      this.pixels = this.sctx.getImageData(0, 0, L.cols, L.rows).data;
    } catch { this.failed = true; this.onFail?.(); }
  }

  tick(now) {
    this.raf = 0;
    if (!this.visible) return;
    const dt = Math.min(64, now - (this.prev || now)); this.prev = now;
    const v = this.video, P = this.pointer;
    // A frame is due when the video clock has moved since the last one sampled (or a resample was asked for).
    const fresh = this.resample || !!(v && v.readyState >= 2 && v.currentTime !== this.lastTime);
    P.s += (P.target - P.s) * (1 - Math.exp(-dt / 110));
    if (Math.abs(P.target - P.s) < 0.004) P.s = P.target;
    this.ripples = this.ripples.filter(r => now - r.t0 < 900);
    const moving = P.s !== P.target || P.s > 0 || this.ripples.length > 0 || this.scrubbing;
    if (this.moved && !moving) this.dirty = true;   // one clean frame once the field has settled
    this.moved = moving;
    const playing = v && !v.paused && !v.ended;
    let drawn = false;
    // The recording is 15 fps, so playback alone redraws at about that rate; a moving pointer gets 30.
    if ((fresh || moving || this.dirty) && (this.dirty || now - this.lastDraw >= (moving ? 30 : 60))) {
      if (fresh) { this.sample(); this.resample = false; if (v) this.lastTime = v.currentTime; }
      this.draw(now); this.lastDraw = now; this.dirty = false; drawn = true;
      this.onFrame?.(v ? v.currentTime : 0);
    }
    if (playing || moving || this.resample || (fresh && !drawn)) this.start();
  }

  draw(now) {
    const { ctx, canvas, cell: c, layout: L, pixels: px, pointer: P } = this;
    ctx.fillStyle = GROUND; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const press = P.s, R = 12 * c, R2 = R * R, TAU = 6.2832;
    const rings = this.ripples.map(r => { const age = (now - r.t0) / 900; return { x: r.x, y: r.y, rr: age * 30 * c, a: (1 - age) * (1 - age) }; });
    const ringW = 3.5 * c;

    const dot = (x, y, rad, style) => {
      if (press > 0) {
        const dx = x - P.x, dy = y - P.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / R, ff = f * f * press;
          x += dx / d * ff * c * 2.4; y += dy / d * ff * c * 2.4; rad *= 1 + ff * 0.85;
        }
      }
      for (const g of rings) {
        const dx = x - g.x, dy = y - g.y, d = Math.sqrt(dx * dx + dy * dy) || 1, q = (d - g.rr) / ringW;
        if (q > -1 && q < 1) { const w = (1 - q * q) * g.a; x += dx / d * w * c * 1.5; y += dy / d * w * c * 1.5; rad *= 1 + w * 0.7; }
      }
      ctx.fillStyle = style;
      if (rad < 1.7) ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);   // too small to read as round, and far cheaper
      else { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
    };

    for (const r of L.regions) {
      const scene = r.key === 'scene';
      for (let j = 0; j < r.h; j++) {
        const gy = r.y + j, row = gy * L.cols;
        for (let i = 0; i < r.w; i++) {
          const gx = r.x + i;
          let red = 0, green = 0, blue = 0;
          if (px) { const o = (row + gx) * 4; red = px[o]; green = px[o + 1]; blue = px[o + 2]; }
          const luma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
          let v, style;
          if (scene) {
            // Camera: the workspace recedes; the arm, the bin and the object carry the picture.
            const mx = Math.max(red, green, blue), mn = Math.min(red, green, blue);
            const sat = mx ? (mx - mn) / mx : 0, keep = Math.min(1, sat * 2.2);
            v = (luma - 0.2) / 0.62; v = v < 0 ? 0 : v > 1 ? 1 : v; v = v * v * (3 - 2 * v);
            if (keep > 0.5) v = Math.max(v, 0.3 + 0.35 * luma);
            const cool = 30 + 205 * v;                         // neutral pixels: a cool grey-blue ramp
            const k = mx ? (105 + 150 * v) / mx : 0;           // saturated pixels: their own hue, lit by v
            style = rgb(
              cool * 0.86 * (1 - keep) + red * k * keep,
              cool * 0.98 * (1 - keep) + green * k * keep,
              cool * 1.1 * (1 - keep) + blue * k * keep);
          } else {
            // Deformation map: the recording's own colour scale, with dot size following its lightness.
            v = (luma - 0.06) / 0.78; v = v < 0 ? 0 : v > 1 ? 1 : v;
            style = rgb(red * 1.12 + 10, green * 1.12 + 4, blue * 1.12 + 14);
          }
          dot((gx + 0.5) * c, (gy + 0.5) * c, c * (0.11 + 0.32 * Math.pow(v, 0.8)), style);
        }
      }
    }

    // Force strip: two rows of columns, left fingertip above right, lit up to the playhead.
    if (this.bins) {
      const b = L.band, half = b.h / 2, head = Math.min(b.w - 1, Math.floor(this.progress() * b.w));
      for (let side = 0; side < 2; side++) {
        const s = SERIES[side], lit = `rgb(${s[0]},${s[1]},${s[2]})`, dim = `rgb(${s[0] * 0.36 | 0},${s[1] * 0.36 | 0},${s[2] * 0.36 | 0})`;
        for (let i = 0; i < b.w; i++) {
          const level = this.bins[side][i] * (half - 1);
          for (let k = 0; k < half - 1; k++) {
            const gy = b.y + (side + 1) * half - 1 - k, on = Math.max(0, Math.min(1, level - k + 0.35));
            const x = (b.x + i + 0.5) * c, y = (gy + 0.5) * c;
            if (i === head) dot(x, y, c * 0.34, INK);
            else if (on > 0) dot(x, y, c * (0.16 + 0.3 * on), i < head ? lit : dim);
            else dot(x, y, c * 0.1, GRID);
          }
        }
      }
    }
  }
}
