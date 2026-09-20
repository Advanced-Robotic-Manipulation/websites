// The paper figures remain unaltered; the viewer only changes display scale.
export function initDiagramViewer() {
  const dialog = document.querySelector('#diagram-viewer');
  const image = document.querySelector('#diagram-viewer-image');
  const scroll = dialog.querySelector('.viewer-scroll');
  const zoom = document.querySelector('#diagram-zoom');
  let trigger;
  function resize() {
    const style = getComputedStyle(scroll);
    const width = scroll.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    image.style.width = `${width * Number(zoom.value) / 100}px`;
    document.querySelector('#diagram-zoom-value').textContent = `${zoom.value}%`;
  }
  document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
    trigger = button;
    const original = document.getElementById(button.dataset.enlarge);
    image.src = original.src;
    image.alt = original.alt;
    document.querySelector('#diagram-viewer-title').textContent = button.closest('figure').querySelector('h3').textContent;
    zoom.value = '100';
    dialog.showModal();
    document.body.classList.add('diagram-open');
    resize();
    scroll.scrollTo(0, 0);
  }));
  zoom.addEventListener('input', resize);
  window.addEventListener('resize', () => { if (dialog.open) resize(); });
  document.querySelector('#diagram-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('diagram-open');
    trigger?.focus({ preventScroll: true });
  });
}
