let records;
const state = { task: 'waffles', horizon: 1, finger: 0, channel: 'mask' };
const $ = s => document.querySelector(s);
function color(value, kind = 'pred') {
  const t = Math.max(0, Math.min(1, value));
  const a = [247, 246, 242], b = kind === 'obs' ? [170, 100, 62] : [33, 103, 87];
  return a.map((v, i) => Math.round(v + t * (b[i] - v)));
}
function heatmap(canvas, values, min, max, kind) {
  const h = values.length, w = values[0].length;
  const buffer = document.createElement('canvas'); buffer.width = w; buffer.height = h;
  const ctx = buffer.getContext('2d'), pixels = ctx.createImageData(w, h);
  values.forEach((row, y) => row.forEach((v, x) => {
    const c = color((v - min) / (max - min || 1), kind), offset = (y * w + x) * 4;
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
  heatmap($('#pred-field'), pred, min, max, 'pred'); heatmap($('#obs-field'), obs, min, max, 'obs');
  for (const kind of ['pred', 'obs']) {
    const scale = $(`#${kind}-scale`), ctx = scale.getContext('2d');
    for (let i = 0; i < scale.width; i++) { ctx.fillStyle = `rgb(${color(i / (scale.width - 1), kind).join(',')})`; ctx.fillRect(i, 0, 1, scale.height); }
  }
  const format = n => state.channel === 'mask' ? String(n) : n.toExponential(1);
  document.querySelectorAll('.field-min').forEach(el => { el.textContent = format(min); });
  document.querySelectorAll('.field-max').forEach(el => { el.textContent = format(max); });
  const isMask = state.channel === 'mask';
  $('#field-unit').textContent = isMask ? 'Both scales: 0 = no contact, 1 = contact. Prediction is a soft mask; recorded target is binary.' : 'Both scales: signed normal-force change, in native sensor units—not N. Pale = minimum; dark = maximum, not magnitude. Zero is not necessarily pale.';
  $('#field-selection').textContent = `${state.finger === 0 ? 'Left' : 'Right'} fingertip · +${state.horizon} s · ${isMask ? 'contact mask' : 'normal-force change'}`;
  $('#representation-help').textContent = isMask ? 'Contact mask shows where contact is predicted or recorded on the sensor surface. Compare the position and shape of the green and brown patches—not the camera pixels.' : 'Normal-force change shows the signed change in the sensor’s normal-force field at each location. Compare matching locations using the identical numeric limits below each map.';
  const active = obs.flat().filter(v => v > 0).length, cells = r.shape[0] * r.shape[1];
  $('#recorded-field-note').textContent = isMask
    ? active === 0 ? `No recorded contact: 0 / ${cells.toLocaleString('en-US')} active cells. The blank target is data, not a loading error.`
      : `Recorded contact: ${active} / ${cells.toLocaleString('en-US')} cells (${(active / cells * 100).toFixed(1)}%). Brown may occupy only a small patch; pale cells have no recorded contact.`
    : `Recorded range in this map: ${format(Math.min(...obs.flat()))} to ${format(Math.max(...obs.flat()))}. Numeric limits stay fixed across this episode’s horizons and fingertips.`;
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
  $('#contact-example').addEventListener('click', () => {
    Object.assign(state, { task: 'carton', horizon: 2, finger: 1, channel: 'mask' });
    document.querySelectorAll('[data-contact-task]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.contactTask === state.task)));
    $('#contact-horizon').value = '2'; $('#contact-finger').value = '1'; $('#contact-channel').value = 'mask';
    draw();
  });
}
