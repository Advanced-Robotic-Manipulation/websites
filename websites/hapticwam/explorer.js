let records;
const state = { task: 'waffles', horizon: 1, finger: 0, channel: 'mask' };
const $ = s => document.querySelector(s);
function color(value) {
  const t = Math.max(0, Math.min(1, value));
  const a = [239, 240, 228], b = [33, 103, 87];
  return a.map((v, i) => Math.round(v + t * (b[i] - v)));
}
function heatmap(canvas, values, min, max) {
  const h = values.length, w = values[0].length;
  const buffer = document.createElement('canvas'); buffer.width = w; buffer.height = h;
  const ctx = buffer.getContext('2d'), pixels = ctx.createImageData(w, h);
  values.forEach((row, y) => row.forEach((v, x) => {
    const c = color((v - min) / (max - min || 1)), offset = (y * w + x) * 4;
    pixels.data.set([...c, 255], offset);
  }));
  ctx.putImageData(pixels, 0, 0);
  const target = canvas.getContext('2d'); target.imageSmoothingEnabled = false;
  target.clearRect(0, 0, canvas.width, canvas.height);
  target.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}
function draw() {
  if (!records) return;
  const r = records.find(d => d.task === state.task), j = state.horizon - 1, f = state.finger;
  $('#anchor-frame').src = `assets/${state.task}-contact-0.webp`;
  $('#future-frame').src = `assets/${state.task}-contact-${state.horizon}.webp`;
  $('#future-time').textContent = `t = +${state.horizon} s`;
  $('#horizon-value').textContent = `+${state.horizon} s`;
  const pred = r[`pred_${state.channel}`][j][f], obs = r[`obs_${state.channel}`][j][f];
  // One scale across every horizon and both fingers in this episode.
  const all = [...r[`pred_${state.channel}`].flat(3), ...r[`obs_${state.channel}`].flat(3)];
  const min = state.channel === 'mask' ? 0 : Math.min(...all);
  const max = state.channel === 'mask' ? 1 : Math.max(...all);
  heatmap($('#pred-field'), pred, min, max); heatmap($('#obs-field'), obs, min, max);
  const scale = $('#field-scale'), ctx = scale.getContext('2d');
  for (let i = 0; i < scale.width; i++) { ctx.fillStyle = `rgb(${color(i / (scale.width - 1)).join(',')})`; ctx.fillRect(i, 0, 1, scale.height); }
  const format = n => state.channel === 'mask' ? String(n) : n.toExponential(1);
  $('#scale-min').textContent = format(min); $('#scale-max').textContent = format(max);
  $('#field-unit').textContent = state.channel === 'mask' ? 'Mask value · shared scale across horizons and fingertips' : 'Force change · native sensor units · shared scale across horizons and fingertips';
  const p = r.pred_event[j], best = p.indexOf(Math.max(...p));
  $('#pred-event').textContent = `Predicted event: ${r.events[best]}`;
  $('#obs-event').textContent = `Recorded event: ${r.events[r.obs_event[j]]}`;
  $('#prediction-source').href = r.source;
  $('#prediction-context').textContent = ` Episode: ${r.episode}. Camera offset from the requested future timestamp: ${(r.frameOffsets[state.horizon] * 1000).toFixed(0)} ms.`;
  for (const kind of ['pred', 'obs']) $(`#${kind}-field`).setAttribute('aria-label', `${kind === 'pred' ? 'Predicted' : 'Recorded'} ${state.channel === 'mask' ? 'contact mask' : 'normal-force change'}, ${state.finger === 0 ? 'left' : 'right'} fingertip, ${state.task}, +${state.horizon} seconds. Shared range ${format(min)} to ${format(max)}.`);
}
export async function initExplorer() {
  try {
    const response = await fetch('assets/predictions.json');
    if (!response.ok) throw new Error('Contact arrays could not be loaded.');
    records = await response.json();
    $('#explorer-status').hidden = true; $('.explorer-body').hidden = false;
    $('#contact-horizon').disabled = false;
    draw();
  } catch {
    $('#explorer-status').textContent = 'Contact fields are unavailable. The original arrays remain accessible through the source link below.';
    return;
  }
  document.querySelectorAll('[data-contact-task]').forEach(button => button.addEventListener('click', () => {
    state.task = button.dataset.contactTask;
    document.querySelectorAll('[data-contact-task]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    draw();
  }));
  $('#contact-horizon').addEventListener('input', e => { state.horizon = Number(e.target.value); draw(); });
  $('#contact-finger').addEventListener('change', e => { state.finger = Number(e.target.value); draw(); });
  $('#contact-channel').addEventListener('change', e => { state.channel = e.target.value; draw(); });
}
