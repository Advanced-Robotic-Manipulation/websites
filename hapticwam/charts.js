import { models, tasks, taskLabels, denominators, ablation, wilson } from './data.js';
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function draw(svg, tag, attrs, text) { const node = el(tag, attrs, text); svg.append(node); return node; }
function interval(svg, x1, x2, y, color) {
  draw(svg, 'line', { x1, x2, y1: y, y2: y, stroke: color, 'stroke-width': 2 });
  for (const x of [x1, x2]) draw(svg, 'line', { x1: x, x2: x, y1: y - 5, y2: y + 5, stroke: color });
}
export function successChart(task) {
  const svg = document.querySelector('#success-chart'); svg.replaceChildren();
  const mobile = window.matchMedia('(max-width:600px)').matches;
  svg.setAttribute('viewBox', mobile ? '0 0 358 340' : '0 0 720 310');
  const i = tasks.indexOf(task), n = i < 0 ? 50 : denominators[i];
  const x = v => mobile ? 16 + v * 324 : 156 + v * 430;
  draw(svg, 'title', {}, `Placement success: ${taskLabels[task]}`);
  draw(svg, 'rect', { x: 0, y: mobile ? 87 : 94, width: mobile ? 358 : 716, height: mobile ? 70 : 52, rx: 2, class: 'student-row' });
  for (const v of [0, .25, .5, .75, 1]) {
    draw(svg, 'line', { x1: x(v), x2: x(v), y1: mobile ? 40 : 24, y2: mobile ? 294 : 254, class: 'axis' });
    draw(svg, 'text', { x: x(v), y: mobile ? 321 : 279, 'text-anchor': 'middle', class: 'tick' }, `${v * 100}%`);
  }
  models.forEach((m, idx) => {
    const k = i < 0 ? m.counts.reduce((a, b) => a + b, 0) : m.counts[i];
    const [lo, hi] = wilson(k, n), y = mobile ? 65 + idx * 75 : 60 + idx * 60;
    draw(svg, 'text', { x: 12, y: mobile ? y - 24 : y + 4, class: 'model-label' }, m.name);
    interval(svg, x(lo), x(hi), y, m.color);
    const point = draw(svg, 'circle', { cx: x(k / n), cy: y, r: 5, fill: m.color });
    point.append(el('title', {}, `${m.name}: ${k}/${n} (${(k / n * 100).toFixed(0)}%); 95% Wilson interval ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`));
    draw(svg, 'text', { x: mobile ? 346 : 705, y: mobile ? y - 24 : y + 4, 'text-anchor': 'end', class: 'value' }, `${k}/${n} · ${(k / n * 100).toFixed(0)}%`);
  });
  const student = models[1], k = i < 0 ? 41 : student.counts[i], [lo, hi] = wilson(k, n);
  document.querySelector('#result-task-name').textContent = taskLabels[task];
  document.querySelector('#result-count').innerHTML = `${k}<span>/${n}</span>`;
  document.querySelector('#result-interval').textContent = `95% Wilson interval: ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`;
  document.querySelector('#result-description').textContent = i < 0 ? 'Student placements · pooled across 50 starts' : 'Student placements';
  const link = document.querySelector('#watch-task');
  link.href = i < 0 ? '#top' : `#video-${task}`;
  link.innerHTML = `${i < 0 ? 'Watch the example trials' : 'Watch the example trial'} <svg class="ui-icon" aria-hidden="true" focusable="false"><use href="assets/icons-v2.svg#up"></use></svg>`;
}
export function forceChart(task) {
  const svg = document.querySelector('#force-chart'); svg.replaceChildren();
  const mobile = window.matchMedia('(max-width:600px)').matches;
  svg.setAttribute('viewBox', mobile ? '0 0 358 340' : '0 0 960 310');
  const i = tasks.indexOf(task), x = v => mobile ? 16 + v / 40 * 324 : 175 + v / 40 * 600;
  draw(svg, 'title', {}, `Pinch force at sensor-defined placements: ${taskLabels[task]}`);
  draw(svg, 'rect', { x: 0, y: mobile ? 87 : 89, width: mobile ? 358 : 952, height: mobile ? 70 : 50, rx: 2, class: 'student-row' });
  for (const v of [0, 10, 20, 30, 40]) {
    draw(svg, 'line', { x1: x(v), x2: x(v), y1: mobile ? 40 : 23, y2: mobile ? 294 : 250, class: 'axis' });
    draw(svg, 'text', { x: x(v), y: mobile ? 321 : 275, 'text-anchor': 'middle', class: 'tick' }, `${v} N`);
  }
  models.forEach((m, idx) => {
    const [mean, sd, n] = m.forces[i], y = mobile ? 65 + idx * 75 : 54 + idx * 60;
    draw(svg, 'text', { x: 12, y: mobile ? y - 24 : y + 4, class: 'model-label' }, m.name);
    if (mean !== null) {
      if (sd !== null) interval(svg, x(mean - sd), x(mean + sd), y, m.color);
      const point = draw(svg, 'circle', { cx: x(mean), cy: y, r: 5, fill: m.color });
      point.append(el('title', {}, `${m.name}: ${mean} N${sd === null ? ', SD not reported' : ` ± ${sd} SD`}; n=${n}`));
    }
    draw(svg, 'text', { x: mobile ? 346 : 944, y: mobile ? y - 24 : y + 4, 'text-anchor': 'end', class: 'value' }, mean === null ? 'No samples · n=0' : `${mean.toFixed(1)}${sd === null ? '' : ` ± ${sd.toFixed(1)}`} · n=${n}`);
  });
  // Readable viewBox on narrow screens; values remain in the scientific chart.
}
export function ablationChart() {
  const svg = document.querySelector('#ablation-chart'); svg.replaceChildren();
  const mobile = window.matchMedia('(max-width:600px)').matches;
  svg.setAttribute('viewBox', mobile ? '0 0 358 270' : '0 0 960 245');
  draw(svg, 'title', {}, 'Contact-imagination intervention: placements out of 10');
  const x = n => mobile ? 16 + n / 10 * 324 : 180 + n / 10 * 650;
  for (const n of [0, 2, 4, 6, 8, 10]) {
    draw(svg, 'line', { x1: x(n), x2: x(n), y1: mobile ? 40 : 20, y2: mobile ? 220 : 191, class: 'axis' });
    draw(svg, 'text', { x: x(n), y: mobile ? 250 : 220, 'text-anchor': 'middle', class: 'tick' }, `${n}/10`);
  }
  tasks.forEach((task, i) => {
    const y = mobile ? 65 + i * 75 : 47 + i * 62, a = ablation.intact[i], b = ablation.zero[i];
    draw(svg, 'text', { x: 12, y: mobile ? y - 30 : y + 4, class: 'model-label' }, taskLabels[task]);
    draw(svg, 'line', { x1: x(b), x2: x(a), y1: y, y2: y, stroke: '#bbc2b3', 'stroke-width': 2 });
    for (const [n, color] of [[a, '#27695f'], [b, '#aa643e']]) {
      draw(svg, 'circle', { cx: x(n), cy: y, r: 6, fill: color });
      draw(svg, 'text', { x: x(n), y: y - 12, 'text-anchor': 'middle', class: 'value' }, n);
    }
  });
}
