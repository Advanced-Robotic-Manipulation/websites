// Display-only zoom: manuscript images are never modified.
export function initDiagramViewer() {
  const dialog = document.querySelector('#diagram-viewer');
  const image = document.querySelector('#diagram-viewer-image');
  const viewport = dialog.querySelector('.viewer-scroll');
  const pointers = new Map();
  let trigger, scale = 1, x = 0, y = 0, width = 0, height = 0, gesture;
  let hovering = false;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function render() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    x = width * scale <= w ? (w - width * scale) / 2 : clamp(x, w - width * scale, 0);
    y = height * scale <= h ? (h - height * scale) / 2 : clamp(y, h - height * scale, 0);
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    viewport.dataset.zoom = scale.toFixed(2);
  }
  function fit() {
    if (!image.naturalWidth) return;
    const ratio = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight);
    width = image.naturalWidth * ratio;
    height = image.naturalHeight * ratio;
    image.style.width = `${width}px`;
    scale = 1; x = 0; y = 0; hovering = false;
    pointers.clear(); gesture = null;
    render();
  }
  function point(event) {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function zoomAt(next, p) {
    next = clamp(next, 1, 6);
    x = p.x - (p.x - x) * next / scale;
    y = p.y - (p.y - y) * next / scale;
    scale = next;
    render();
  }
  function beginGesture() {
    const [a, b] = [...pointers.values()];
    gesture = a ? { x, y, scale, center: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 } : null;
  }
  document.querySelectorAll('[data-enlarge]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger = link;
    const original = document.getElementById(link.dataset.enlarge);
    image.src = original.src;
    image.alt = original.alt;
    document.querySelector('#diagram-viewer-title').textContent = link.closest('figure').querySelector('h3').textContent;
    dialog.showModal();
    document.body.classList.add('diagram-open');
    fit();
  }));
  image.addEventListener('load', fit);
  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, point(event));
    beginGesture();
  });
  viewport.addEventListener('pointermove', event => {
    const p = point(event);
    if (event.pointerType === 'mouse' && !pointers.size) {
      if (!hovering && (p.x < x || p.x > x + width || p.y < y || p.y > y + height)) return;
      hovering = true;
      scale = 2.5;
      x = Math.min(0, viewport.clientWidth - width * scale) * clamp(p.x / viewport.clientWidth, 0, 1);
      y = Math.min(0, viewport.clientHeight - height * scale) * clamp(p.y / viewport.clientHeight, 0, 1);
      render();
      return;
    }
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, p);
    const [a, b] = [...pointers.values()];
    const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    scale = b && gesture.distance ? clamp(gesture.scale * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance, 1, 6) : gesture.scale;
    x = center.x - (gesture.center.x - gesture.x) * scale / gesture.scale;
    y = center.y - (gesture.center.y - gesture.y) * scale / gesture.scale;
    render();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    viewport.addEventListener(type, event => { pointers.delete(event.pointerId); beginGesture(); });
  }
  viewport.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && hovering) fit(); });
  viewport.addEventListener('keydown', event => {
    const center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
    if (event.key === '+' || event.key === '=') zoomAt(scale * 1.4, center);
    if (event.key === '-') zoomAt(scale / 1.4, center);
    if (event.key === '0') fit();
    if (event.key === 'ArrowLeft') x += 60;
    if (event.key === 'ArrowRight') x -= 60;
    if (event.key === 'ArrowUp') y += 60;
    if (event.key === 'ArrowDown') y -= 60;
    render();
  });
  new ResizeObserver(() => { if (dialog.open) fit(); }).observe(viewport);
  document.querySelector('#diagram-reset').addEventListener('click', fit);
  document.querySelector('#diagram-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    pointers.clear(); gesture = null;
    document.body.classList.remove('diagram-open');
    trigger?.focus({ preventScroll: true });
  });
}
