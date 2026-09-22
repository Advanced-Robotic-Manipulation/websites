import { successChart, forceChart, ablationChart } from './charts.js?v=paper-title-2';
import { initRollout } from './rollout.js?v=selected-rollouts-1';
import { initDiagramViewer } from './diagram-viewer.js';

initDiagramViewer();

function bindSelection(attribute, update) {
  const buttons = document.querySelectorAll(`[${attribute}]`);
  buttons.forEach(button => button.addEventListener('click', () => {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    update(button.getAttribute(attribute));
  }));
}
bindSelection('data-result-task', successChart);
bindSelection('data-force-task', forceChart);
bindSelection('data-model', model => {
  const student = model === 'student', node = document.querySelector('#tactile-node');
  node.classList.toggle('omitted', student);
  node.querySelector('span').textContent = student ? 'Not an input to the student' : 'Gel images + mechanics + contact state';
  document.querySelector('#architecture-note').textContent = student
    ? 'Student · 12 latent frames · anticipatory branch only · 26.4 M trainable parameters'
    : 'Teacher · 14 latent frames · anticipatory + reactive branches · 27.9 M trainable parameters';
});
successChart('waffles'); forceChart('waffles'); ablationChart();
window.matchMedia('(max-width:600px)').addEventListener('change', () => {
  successChart(document.querySelector('[data-result-task][aria-pressed="true"]').dataset.resultTask);
  forceChart(document.querySelector('[data-force-task][aria-pressed="true"]').dataset.forceTask);
  ablationChart();
});

// Fetch rollout metadata only when approaching Figure 4.
const explorerObserver = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) { initRollout(); explorerObserver.disconnect(); }
}, { rootMargin: '600px' });
explorerObserver.observe(document.querySelector('#explorer'));

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    document.querySelectorAll('.site-header nav a').forEach(a => {
      const active = a.hash === `#${entry.target.id}`;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -65% 0px' });
document.querySelectorAll('#overview,#method,#contact,#experiments,#resources').forEach(s => sectionObserver.observe(s));

document.querySelector('#copy-citation').addEventListener('click', async () => {
  const text = document.querySelector('#citation').textContent;
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector('#copy-status').textContent = 'BibTeX copied.';
  } catch {
    const selection = window.getSelection(), range = document.createRange();
    range.selectNodeContents(document.querySelector('#citation'));
    selection.removeAllRanges(); selection.addRange(range);
    document.querySelector('#copy-status').textContent = 'Citation selected. Use your browser’s Copy command.';
  }
});

document.querySelectorAll('video').forEach(video => {
  video.addEventListener('play', () => document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); }));
  video.addEventListener('error', () => {
    if (video.parentElement.querySelector('.media-error')) return;
    const note = document.createElement('p'); note.className = 'media-error';
    note.textContent = 'Playback unavailable. Download the recording: ';
    const link = document.createElement('a'); link.href = video.currentSrc || video.querySelector('source')?.src || video.src;
    link.textContent = 'MP4'; note.append(link); video.after(note);
  });
});
