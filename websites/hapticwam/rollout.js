const $ = selector => document.querySelector(selector);
const NS = 'http://www.w3.org/2000/svg';
const state = { task: 'waffles', model: 'student' };
let archive, episode, frameRequest;
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function initRollout() {
  const video = $('#rollout-video'), chart = $('#rollout-chart'), timeline = $('#rollout-time');
  const status = $('#rollout-status');
  let limits, plotWidth = 800;
  const geometry = () => ({ left: 60, right: plotWidth - 20, top: 20, bottom: 177 });
  const px = t => { const g = geometry(); return g.left + t / episode.duration * (g.right - g.left); };
  function update() {
    if (!episode) return;
    const t = Math.min(video.currentTime, episode.duration);
    timeline.value = t;
    $('#rollout-clock').textContent = `${t.toFixed(1)} / ${episode.duration.toFixed(1)} s`;
    $('#rollout-cursor')?.setAttribute('x1', px(t)); $('#rollout-cursor')?.setAttribute('x2', px(t));
    for (const side of ['left', 'right']) {
      const samples = episode.force[side];
      const closest = samples.reduce((best, sample) => Math.abs(sample[0] - t) < Math.abs(best[0] - t) ? sample : best);
      $(`#force-${side}`).textContent = Math.abs(closest[0] - t) <= .3 ? `${closest[1].toFixed(2)} N` : 'No nearby sample';
    }
  }
  function drawChart() {
    plotWidth = matchMedia('(max-width:600px)').matches ? 440 : 800;
    chart.setAttribute('viewBox', `0 0 ${plotWidth} 215`);
    chart.replaceChildren();
    const g = geometry();
    const y = v => g.bottom - (v - limits[0]) / (limits[1] - limits[0]) * (g.bottom - g.top);
    for (let i = 0; i <= 4; i++) {
      const value = limits[0] + i / 4 * (limits[1] - limits[0]);
      chart.append(svg('line', { x1: g.left, x2: g.right, y1: y(value), y2: y(value), class: 'axis' }));
      chart.append(svg('text', { x: g.left - 9, y: y(value) + 4, 'text-anchor': 'end', class: 'tick' }, value.toFixed(1)));
      const t = episode.duration * i / 4;
      chart.append(svg('text', { x: px(t), y: 201, 'text-anchor': 'middle', class: 'tick' }, `${t.toFixed(0)} s`));
    }
    chart.append(svg('line', { x1: g.left, x2: g.right, y1: y(0), y2: y(0), stroke: '#899181', 'stroke-dasharray': '3 3' }));
    for (const [side, color] of [['left', '#27695f'], ['right', '#aa643e']]) {
      let previous;
      const d = episode.force[side].map(([t, value]) => {
        const command = previous === undefined || t - previous > .5 ? 'M' : 'L'; previous = t;
        return `${command}${px(t).toFixed(2)},${y(value).toFixed(2)}`;
      }).join(' ');
      chart.append(svg('path', { d, stroke: color, 'stroke-width': 1.8, fill: 'none', 'vector-effect': 'non-scaling-stroke', 'data-force-trace': side }));
    }
    chart.append(svg('line', { id: 'rollout-cursor', x1: g.left, x2: g.left, y1: g.top, y2: g.bottom, stroke: '#242b24', 'stroke-width': 1.3 }));
    update();
  }
  function selectEpisode() {
    video.pause(); cancelAnimationFrame(frameRequest);
    episode = archive.episodes.find(e => e.task === state.task && e.model === state.model);
    const values = archive.episodes.filter(e => e.task === state.task).flatMap(e => Object.values(e.force).flat().map(s => s[1]));
    const low = Math.min(0, ...values), high = Math.max(0, ...values), pad = Math.max((high - low) * .08, .1);
    limits = [low - pad, high + pad];
    video.poster = episode.poster; video.src = episode.video; video.load();
    timeline.max = episode.duration; timeline.value = '0';
    $('#rollout-source').href = episode.source;
    $('#rollout-outcome').textContent = `${state.model === 'student' ? 'Student' : 'Teacher'} · seed 101 · ${episode.outcome} (operator verdict)`;
    $('#rollout-scope').textContent = state.model === 'student'
      ? 'Student: tactile streams are recorded for inspection, not supplied to the student model. The executor uses tactile feedback; the model retains scene RGB, proprioception and motor-current-derived arm wrench.'
      : 'Teacher: fingertip observations are available to the model. These are heatmaps of recorded sensor deformation and measured wrench signals—not generated contact predictions.';
    const offsets = episode.maxImageOffsetMs;
    $('#rollout-provenance').textContent = `${episode.episode}. Nearest-frame alignment: maximum camera offset ${offsets.camera_scene_color} ms; left field ${offsets.tactile_left_fields_ds} ms; right field ${offsets.tactile_right_fields_ds} ms. Playback is limited to the shared recording interval. Heatmaps use channel 2 (depth) of each recorded 72 × 96 × 8 fields_ds stream, displayed as absolute values without per-frame normalization.`;
    $('#heatmap-max').textContent = episode.heatmap.scale[1].toFixed(1);
    document.querySelectorAll('[data-rollout-task]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rolloutTask === state.task)));
    document.querySelectorAll('[data-rollout-model]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rolloutModel === state.model)));
    status.textContent = ''; drawChart();
  }
  try {
    const response = await fetch('assets/rollouts.json');
    if (!response.ok) throw new Error('Manifest unavailable');
    archive = await response.json();
    $('#rollout-content').hidden = false;
    document.querySelectorAll('[data-rollout-task],[data-rollout-model]').forEach(b => { b.disabled = false; });
    selectEpisode();
  } catch {
    status.textContent = 'Recordings could not be loaded. The original episodes remain available on Hugging Face.';
    return;
  }
  for (const attribute of ['task', 'model']) document.querySelectorAll(`[data-rollout-${attribute}]`).forEach(b => b.addEventListener('click', () => {
    state[attribute] = b.dataset[attribute === 'task' ? 'rolloutTask' : 'rolloutModel']; selectEpisode();
  }));
  function seek(t) { if (video.readyState >= 1) video.currentTime = Math.max(0, Math.min(episode.duration, t)); update(); }
  timeline.addEventListener('input', () => seek(Number(timeline.value)));
  chart.addEventListener('click', e => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(chart.getScreenCTM().inverse());
    const g = geometry(); seek((p.x - g.left) / (g.right - g.left) * episode.duration);
  });
  $('#rollout-peak').addEventListener('click', () => {
    const peak = Object.values(episode.force).flat().reduce((best, sample) => Math.abs(sample[1]) > Math.abs(best[1]) ? sample : best);
    video.pause(); seek(peak[0]);
  });
  const animate = () => { update(); if (!video.paused && !video.ended) frameRequest = requestAnimationFrame(animate); };
  video.addEventListener('play', () => { cancelAnimationFrame(frameRequest); animate(); });
  for (const event of ['timeupdate', 'seeked', 'loadedmetadata', 'pause', 'ended']) video.addEventListener(event, update);
  video.addEventListener('error', () => { status.textContent = 'Video playback unavailable. Open the source episode below.'; });
  matchMedia('(max-width:600px)').addEventListener('change', drawChart);
}
