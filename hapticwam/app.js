import { DotScreen } from './dots.js';
import { models as source, tasks, denominators, ablation, wilson } from './data.js';

const ROOT = '';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 640px)');

/* theme ------------------------------------------------------------------ */
{
  const button = $('#theme'), root = document.documentElement;
  const paint = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    button.firstElementChild.textContent = `[${next}]`;
    button.setAttribute('aria-label', `Switch to ${next} theme`);
  };
  button.hidden = false; paint();
  button.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('hapticwam-theme', root.dataset.theme); } catch { /* private mode */ }
    paint();
  });
}

/* data: manuscript values live in data.js, which scripts/verify.mjs checks ------ */
const models = source.map(m => ({ ...m, plain: m.name, me: m.name === 'Student', name: m.name === 'π₀.₅' ? 'π<sub>0.5</sub>' : m.name }));
const taskLabels = { waffles: 'waffles', carton: 'carton', egg: 'egg', pooled: 'all tasks · pooled' };

/* charts: one dot per trial, drawn in HTML so they reflow and stay selectable -- */
const units = (k, n, tone = '') => `<div class="units ${tone}" style="--n:${n}">${'<i class="on"></i>'.repeat(k)}${'<i></i>'.repeat(n - k)}</div>`;
const ticks = (values, unit) => `<div class="axis-row" aria-hidden="true"><span></span><div class="ticks">${values.map((v, i) => `<span style="left:${i / (values.length - 1) * 100}%">${v}${unit}</span>`).join('')}</div><span></span></div>`;

function successChart(task) {
  const i = tasks.indexOf(task), n = i < 0 ? 50 : denominators[i];
  const count = m => i < 0 ? m.counts.reduce((a, b) => a + b, 0) : m.counts[i];
  $('#success-chart').innerHTML = ticks([0, 25, 50, 75, 100], '%') + models.map(m => {
    const k = count(m), [lo, hi] = wilson(k, n), pct = (k / n * 100).toFixed(0);
    const interval = `${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`;
    return `<div class="row${m.me ? ' me' : ''}" title="${m.plain || m.name}: ${k}/${n} (${pct}%); 95% Wilson interval ${interval}">
      <span class="who">${m.name}</span>
      <div class="track">${units(k, n)}<div class="ci" style="--lo:${lo * 100}%;--hi:${hi * 100}%;--p:${k / n * 100}%"><i class="bar"></i><i class="cap lo"></i><i class="cap hi"></i><i class="at"></i></div></div>
      <div class="nums"><span class="val"><b>${k}/${n}</b> · ${pct}%</span><span class="int">95% ci ${interval}</span></div>
    </div>`;
  }).join('');
  const k = count(models[1]), [lo, hi] = wilson(k, n);
  $('#result-task-name').textContent = taskLabels[task];
  $('#result-count').innerHTML = `${k}<small>/${n}</small>`;
  $('#result-interval').textContent = `95% Wilson interval: ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`;
  $('#result-description').textContent = i < 0 ? 'student placements · pooled across 50 starts' : 'student placements';
  const link = $('#watch-task');
  link.dataset.watch = i < 0 ? 'waffles' : task;
  link.textContent = i < 0 ? '[watch the example rollouts]' : '[watch the example rollout]';
}

function forceChart(task) {
  const i = tasks.indexOf(task), scale = 40;
  $('#force-chart').innerHTML = ticks([0, 10, 20, 30, 40], ' N') + models.map(m => {
    const [mean, sd, n] = m.forces[i];
    const marks = mean === null ? '' :
      (sd === null ? '' : `<i class="sd" style="left:${(mean - sd) / scale * 100}%;width:${2 * sd / scale * 100}%"></i>`) +
      `<i class="pt" style="left:${mean / scale * 100}%"></i>`;
    const value = mean === null ? 'no samples' : `${mean.toFixed(1)}${sd === null ? '' : ` ± ${sd.toFixed(1)}`} N`;
    const title = mean === null ? 'no force samples' : `${mean} N${sd === null ? ', SD not reported' : ` ± ${sd} SD`}; n=${n}`;
    return `<div class="row${m.me ? ' me' : ''}" title="${m.plain || m.name}: ${title}">
      <span class="who">${m.name}</span>
      <div class="track ftrack">${marks}</div>
      <div class="nums"><span class="val">${mean === null ? value : `<b>${value}</b>`}</span><span class="int">n = ${n}</span></div>
    </div>`;
  }).join('');
}

function ablationChart() {
  $('#ablation-chart').innerHTML = tasks.map((task, i) => `<div class="grp">
      <span class="who">${taskLabels[task]}</span>
      <div class="pair">
        <div class="cond"><span>intact</span>${units(ablation.intact[i], 10, 's1')}<b>${ablation.intact[i]}/10</b></div>
        <div class="cond"><span>zero contact</span>${units(ablation.zero[i], 10, 's2')}<b>${ablation.zero[i]}/10</b></div>
      </div>
    </div>`).join('');
}

function bindSelection(attribute, update) {
  const buttons = $$(`[${attribute}]`);
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    update(button.getAttribute(attribute));
  }));
}
bindSelection('data-result-task', successChart);
bindSelection('data-force-task', forceChart);
bindSelection('data-model', model => {
  const student = model === 'student', node = $('#tactile-node');
  node.classList.toggle('off', student);
  node.querySelector('span').textContent = student ? 'not an input to the student' : 'gel images + mechanics + contact state';
  $('#arch-note').textContent = student
    ? 'student · 12 latent frames · anticipatory branch only · 26.4 M trainable parameters'
    : 'teacher · 14 latent frames · anticipatory + reactive branches · 27.9 M trainable parameters';
});
successChart('waffles'); forceChart('waffles'); ablationChart();

/* recorded rollouts: shared by the dot screen and the viewer ------------------ */
const archive = fetch(`${ROOT}assets/rollouts.json`).then(response => {
  if (!response.ok) throw new Error('Manifest unavailable');
  return response.json();
});
const pick = (data, task, model) => data.episodes.find(e => e.task === task && e.model === model);
const taskValues = (data, task) => data.episodes.filter(e => e.task === task).flatMap(e => Object.values(e.force).flat().map(s => s[1]));
function nearest(samples, t) {
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid][0] < t) lo = mid; else hi = mid; }
  return Math.abs(samples[lo][0] - t) <= Math.abs(samples[hi][0] - t) ? samples[lo] : samples[hi];
}
const allVideos = () => $$('video');
function exclusive(video) { video.addEventListener('play', () => allVideos().forEach(other => { if (other !== video) other.pause(); })); }

/* fig 1: the dot screen ----------------------------------------------------- */
const hero = (() => {
  const scene = $('.hero .scene'), video = $('#hero-video'), toggle = $('#hero-toggle');
  const state = { task: 'waffles', held: calm || navigator.connection?.saveData === true, episode: null, data: null, onscreen: true };
  const poster = new Image();
  const labels = { scene: $('.lab-scene', scene), left: $('.lab-left', scene), right: $('.lab-right', scene), rec: $('.lab-rec', scene) };

  const screen = new DotScreen($('#dots'), {
    calm,
    onLayout(name, L) {
      scene.dataset.layout = name;
      for (const r of L.regions) {
        labels[r.key].style.left = `${r.x / L.cols * 100}%`;
        labels[r.key].style.top = `${r.y / L.rows * 100}%`;
      }
      const s = L.regions[0];
      labels.rec.style.left = `${s.x / L.cols * 100}%`;
      labels.rec.style.top = `${(s.y + s.h) / L.rows * 100}%`;
    },
    onSeek(fraction) {
      if (!state.episode) return;
      const t = fraction * state.episode.duration;
      if (video.readyState >= 1) video.currentTime = t;
      else {
        // Nothing fetched yet (autoplay was held): load once, then land on the latest requested time.
        if (state.wanted === undefined) {
          video.addEventListener('loadedmetadata', () => { video.currentTime = state.wanted; state.wanted = undefined; }, { once: true });
          video.preload = 'auto'; video.load();
        }
        state.wanted = t;
      }
      screen.invalidate(); readout(t);
    },
    onFrame: t => readout(t),
    onFail() { scene.classList.add('raw'); video.controls = true; video.removeAttribute('aria-hidden'); video.removeAttribute('tabindex'); },
  });
  screen.video = video;
  poster.addEventListener('load', () => { screen.poster = poster; screen.invalidate(); screen.start(); });

  function readout(t) {
    const e = state.episode;
    if (!e) return;
    t = Math.min(t, e.duration);
    const show = (id, samples) => {
      const s = nearest(samples, t);
      $(id).textContent = Math.abs(s[0] - t) <= 0.3 ? `${Math.abs(s[1]).toFixed(2).padStart(5)} N` : '    – N';
    };
    show('#hero-fl', e.force.left); show('#hero-fr', e.force.right);
    $('#hero-t').textContent = `${t.toFixed(1).padStart(4)} / ${e.duration.toFixed(1)} s`;
  }
  const paint = () => {
    const playing = !video.paused && !video.ended;
    toggle.firstElementChild.textContent = playing ? '[pause]' : '[play]';
    toggle.setAttribute('aria-label', playing ? 'Pause the rollout' : 'Play the rollout');
    scene.classList.toggle('live', playing);
  };
  const play = () => video.play().then(() => screen.start()).catch(() => { state.held = true; paint(); });

  function select(task, { autoplay = !state.held } = {}) {
    const e = pick(state.data, task, 'student');
    if (!e) return;
    state.task = task; state.episode = e;
    $$('[data-hero-task]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.heroTask === task)));
    screen.poster = null; poster.src = ROOT + e.poster;
    state.wanted = undefined;
    video.pause(); video.src = ROOT + e.video; video.load();
    screen.setForce(e.force, e.duration, Math.max(...taskValues(state.data, task).map(Math.abs)));
    $('#hero-meta').textContent = `student · seed ${e.seed} · ${e.outcome.toLowerCase()} (operator verdict)`;
    readout(0); paint();
    if (autoplay && state.onscreen) play();
  }

  for (const type of ['play', 'pause', 'ended', 'playing']) video.addEventListener(type, () => { paint(); screen.start(); });
  for (const type of ['seeked', 'loadeddata']) video.addEventListener(type, () => { screen.invalidate(); screen.start(); });
  // The decoder can present one more frame just after a pause; draw the frame the video settled on.
  video.addEventListener('pause', () => setTimeout(() => { screen.invalidate(); screen.start(); }, 160));
  video.addEventListener('error', () => { $('#hero-meta').textContent = 'playback unavailable; the recordings are linked under resources'; });
  toggle.addEventListener('click', () => {
    if (video.paused) { state.held = false; play(); } else { state.held = true; video.pause(); }
  });
  $$('[data-hero-task]').forEach(b => b.addEventListener('click', () => { if (state.data) select(b.dataset.heroTask); }));
  exclusive(video);

  // Stop decoding when the screen is out of view; resume only if the reader had not paused it.
  new IntersectionObserver(entries => {
    state.onscreen = entries[entries.length - 1].isIntersecting;
    if (!state.episode) return;
    if (!state.onscreen) video.pause(); else if (!state.held && video.paused) play();
  }, { threshold: 0.15 }).observe(scene);

  archive.then(data => { state.data = data; select(state.task); }).catch(() => {
    $('#hero-meta').textContent = 'recordings could not be loaded; the original episodes remain available on Hugging Face';
  });
  return { select: task => { if (state.data) { state.held = false; select(task, { autoplay: true }); } }, get task() { return state.task; } };
})();

/* fig 4: synchronized rollout viewer ------------------------------------------ */
const viewer = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const video = $('#rollout-video'), chart = $('#rollout-chart'), timeline = $('#rollout-time'), status = $('#rollout-status');
  const state = { task: 'waffles', model: 'student' };
  let data, episode, limits, width = 800, frame, hoverT = null, wanted;
  const geometry = () => ({ left: narrow.matches ? 52 : 46, right: width - 12, top: 14, bottom: 177 });
  const px = t => { const g = geometry(); return g.left + t / episode.duration * (g.right - g.left); };

  function update() {
    if (!episode) return;
    const t = Math.min(video.currentTime, episode.duration), shown = hoverT ?? t;
    timeline.value = t;
    $('#rollout-clock').textContent = `${t.toFixed(1)} / ${episode.duration.toFixed(1)} s`;
    const cursor = $('#rollout-cursor');
    if (cursor) { cursor.setAttribute('x1', px(t)); cursor.setAttribute('x2', px(t)); }
    for (const side of ['left', 'right']) {
      const s = nearest(episode.force[side], shown);
      $(`#force-${side}`).textContent = Math.abs(s[0] - shown) <= 0.3 ? `${s[1].toFixed(2)} N` : 'no nearby sample';
    }
    $('#force-at').textContent = `at ${shown.toFixed(1)} s${hoverT === null ? '' : ' · hover'}`;
  }
  function drawChart() {
    if (!episode) return;
    width = narrow.matches ? 440 : 800;
    chart.setAttribute('viewBox', `0 0 ${width} 215`);
    chart.replaceChildren();
    const g = geometry();
    const y = v => g.bottom - (v - limits[0]) / (limits[1] - limits[0]) * (g.bottom - g.top);
    for (let i = 0; i <= 4; i++) {
      const value = limits[0] + i / 4 * (limits[1] - limits[0]);
      chart.append(svg('line', { x1: g.left, x2: g.right, y1: y(value), y2: y(value), class: 'grid' }));
      chart.append(svg('text', { x: g.left - 8, y: y(value) + 4, 'text-anchor': 'end', class: 'tick' }, value.toFixed(1)));
      const t = episode.duration * i / 4;
      chart.append(svg('text', { x: px(t), y: 201, 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle', class: 'tick' }, `${t.toFixed(0)} s`));
    }
    chart.append(svg('line', { x1: g.left, x2: g.right, y1: y(0), y2: y(0), class: 'zero' }));
    // One dot per recorded sample: no line, so gaps in the recording stay visible.
    for (const [side, tone] of [['left', 's1'], ['right', 's2']]) {
      const d = episode.force[side].map(([t, value]) => `M${px(t).toFixed(2)},${y(value).toFixed(2)}h0`).join('');
      chart.append(svg('path', { d, class: `pts ${tone}`, 'data-force-trace': side }));
    }
    chart.append(svg('line', { id: 'rollout-hover', x1: 0, x2: 0, y1: g.top, y2: g.bottom, class: 'hover', visibility: 'hidden' }));
    chart.append(svg('line', { id: 'rollout-cursor', x1: g.left, x2: g.left, y1: g.top, y2: g.bottom, class: 'cursor' }));
    update();
  }
  function select() {
    video.pause(); cancelAnimationFrame(frame);
    episode = pick(data, state.task, state.model);
    const values = taskValues(data, state.task);
    const low = Math.min(0, ...values), high = Math.max(0, ...values), pad = Math.max((high - low) * 0.08, 0.1);
    limits = [low - pad, high + pad];
    wanted = undefined;
    video.poster = ROOT + episode.poster; video.preload = 'none'; video.src = ROOT + episode.video; video.load();
    timeline.max = episode.duration; timeline.value = '0';
    $('#rollout-source').href = episode.source;
    $('#rollout-outcome').textContent = `${state.model} · seed ${episode.seed} · ${episode.outcome.toLowerCase()} (operator verdict)`;
    $('#rollout-scope').textContent = state.model === 'student'
      ? 'Student: tactile streams are recorded for inspection, not supplied to the student model. The executor uses tactile feedback; the model retains scene RGB, proprioception and motor-current-derived arm wrench.'
      : 'Teacher: fingertip observations are available to the model. These are heatmaps of recorded sensor deformation and measured wrench signals—not generated contact predictions.';
    const offsets = episode.maxImageOffsetMs;
    $('#rollout-provenance').textContent = `${episode.episode}. Nearest-frame alignment: maximum camera offset ${offsets.camera_scene_color} ms; left field ${offsets.tactile_left_fields_ds} ms; right field ${offsets.tactile_right_fields_ds} ms. Playback is limited to the shared recording interval. Heatmaps use channel 2 (depth) of each recorded 72 × 96 × 8 fields_ds stream, displayed as absolute values without per-frame normalization.`;
    $('#heatmap-max').textContent = episode.heatmap.scale[1].toFixed(1);
    $$('[data-rollout-task]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rolloutTask === state.task)));
    $$('[data-rollout-model]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rolloutModel === state.model)));
    status.textContent = ''; status.hidden = true; hoverT = null;
    drawChart();
  }
  const seek = t => {
    t = Math.max(0, Math.min(episode.duration, t));
    if (video.readyState >= 1) video.currentTime = t;
    else {
      // Nothing fetched yet: load once, then land on the latest requested time.
      if (wanted === undefined) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = wanted; wanted = undefined; }, { once: true });
        video.preload = 'auto'; video.load();
      }
      wanted = t;
    }
    update();
  };
  const timeAt = event => {
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(chart.getScreenCTM().inverse()), g = geometry();
    return Math.max(0, Math.min(episode.duration, (p.x - g.left) / (g.right - g.left) * episode.duration));
  };

  archive.then(json => {
    data = json;
    $('#rollout-content').hidden = false;
    $$('[data-rollout-task],[data-rollout-model]').forEach(b => { b.disabled = false; });
    select();
  }).catch(() => { status.textContent = 'Recordings could not be loaded. The original episodes remain available on Hugging Face.'; });

  $$('[data-rollout-task]').forEach(b => b.addEventListener('click', () => { state.task = b.dataset.rolloutTask; select(); }));
  $$('[data-rollout-model]').forEach(b => b.addEventListener('click', () => { state.model = b.dataset.rolloutModel; select(); }));
  timeline.addEventListener('input', () => seek(Number(timeline.value)));
  chart.addEventListener('click', event => seek(timeAt(event)));
  chart.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !episode) return;
    hoverT = timeAt(event);
    const line = $('#rollout-hover');
    line.setAttribute('x1', px(hoverT)); line.setAttribute('x2', px(hoverT)); line.setAttribute('visibility', 'visible');
    update();
  });
  chart.addEventListener('pointerleave', () => { hoverT = null; $('#rollout-hover')?.setAttribute('visibility', 'hidden'); update(); });
  $('#rollout-peak').addEventListener('click', () => {
    const peak = Object.values(episode.force).flat().reduce((best, s) => Math.abs(s[1]) > Math.abs(best[1]) ? s : best);
    video.pause(); seek(peak[0]);
  });
  const animate = () => { update(); if (!video.paused && !video.ended) frame = requestAnimationFrame(animate); };
  video.addEventListener('play', () => { cancelAnimationFrame(frame); animate(); });
  for (const type of ['timeupdate', 'seeked', 'loadedmetadata', 'pause', 'ended']) video.addEventListener(type, update);
  video.addEventListener('error', () => { status.hidden = false; status.textContent = 'Video playback unavailable. Open the source episode below.'; });
  exclusive(video);
  narrow.addEventListener('change', drawChart);
  return { show(task, model = 'student') { if (data) { state.task = task; state.model = model; select(); } } };
})();

// "inspect" carries the dot screen's task into the viewer; "watch" carries a result's task back up to it.
$('#hero-inspect').addEventListener('click', () => viewer.show(hero.task));
$('#watch-task').addEventListener('click', event => hero.select(event.currentTarget.dataset.watch));

/* figure zoom: the manuscript images are shown unmodified ---------------------- */
{
  const dialog = $('#zoom'), image = $('#zoom-image'), scroll = $('.zoom-scroll', dialog);
  let trigger;
  const reset = () => { scroll.classList.remove('in'); scroll.scrollTo(0, 0); };
  $$('[data-zoom]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault();
    trigger = link;
    const original = $('img', link);
    image.src = link.href; image.alt = original.alt;
    $('#zoom-title').textContent = $('h3', link.closest('figure')).textContent;
    reset(); dialog.showModal();
  }));
  image.addEventListener('click', event => {
    const before = image.getBoundingClientRect();
    const fx = (event.clientX - before.left) / before.width, fy = (event.clientY - before.top) / before.height;
    const zoomed = scroll.classList.toggle('in');
    if (!zoomed) { scroll.scrollTo(0, 0); return; }
    const box = scroll.getBoundingClientRect();
    scroll.scrollTo(fx * image.offsetWidth - (event.clientX - box.left), fy * image.offsetHeight - (event.clientY - box.top));
  });
  $('#zoom-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { reset(); trigger?.focus(); });
}

/* navigation: mark the section being read; keep it in view on the phone strip ---- */
{
  const toc = $('.toc'), links = $$('.toc .secs a');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of links) {
        const active = a.hash === `#${entry.target.id}`;
        if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        if (active && toc.scrollWidth > toc.clientWidth) {
          toc.scrollTo({ left: a.offsetLeft - (toc.clientWidth - a.offsetWidth) / 2, behavior: calm ? 'auto' : 'smooth' });
        }
      }
    }
  }, { rootMargin: '-18% 0px -72% 0px' });
  links.forEach(a => { const target = $(a.hash); if (target) observer.observe(target); });
  // Above the first section nothing is current.
  new IntersectionObserver(([entry]) => { if (entry.isIntersecting) links.forEach(a => a.removeAttribute('aria-current')); }, { rootMargin: '0px 0px -60% 0px' }).observe($('.title'));
}

/* citation --------------------------------------------------------------- */
$('#copy-citation').addEventListener('click', async () => {
  const text = $('#citation').textContent, note = $('#copy-status');
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = 'bibtex copied.';
  } catch {
    const selection = getSelection(), range = document.createRange();
    range.selectNodeContents($('#citation'));
    selection.removeAllRanges(); selection.addRange(range);
    note.textContent = 'citation selected. use your browser’s copy command.';
  }
});
