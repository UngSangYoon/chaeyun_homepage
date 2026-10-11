import { node } from './dom.js';

export function setupImageViewer() {
  const triggers = document.querySelectorAll('.image-viewer-trigger');
  if (!triggers.length) return;
  const viewer = node('dialog', 'image-viewer');
  viewer.setAttribute('aria-label', '작품 이미지 확대');
  const stage = node('div', 'image-viewer-stage'), image = node('img');
  image.draggable = false; stage.append(image);
  const close = node('button', 'image-viewer-close', 'Close ×');
  close.type = 'button'; close.setAttribute('aria-label', '이미지 확대 닫기');
  const controls = node('div', 'image-viewer-controls');
  controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', '확대 축소');
  let scale = 1, x = 0, y = 0, previousOverflow;
  const pointers = new Map();

  function draw() {
    const limitX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2);
    const limitY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2);
    x = Math.max(-limitX, Math.min(limitX, x));
    y = Math.max(-limitY, Math.min(limitY, y));
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    stage.classList.toggle('zoomed', scale > 1);
  }
  function zoom(next, clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    const anchorX = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const anchorY = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    next = Math.max(1, Math.min(8, next));
    const ratio = next / scale;
    x = anchorX - (anchorX - x) * ratio;
    y = anchorY - (anchorY - y) * ratio;
    scale = next; draw();
  }
  for (const [text, label, action] of [
    ['−', '축소', () => zoom(scale / 1.4)],
    ['↺', '화면에 맞추기', () => { scale = 1; x = y = 0; draw(); }],
    ['+', '확대', () => zoom(scale * 1.4)]
  ]) {
    const button = node('button', '', text); button.type = 'button';
    button.setAttribute('aria-label', label); button.title = label;
    button.onclick = action; controls.append(button);
  }
  viewer.append(stage, close, controls); document.body.append(viewer);
  close.onclick = () => viewer.close();
  viewer.addEventListener('close', () => {
    pointers.clear(); stage.classList.remove('dragging');
    document.body.style.overflow = previousOverflow;
    image.removeAttribute('src');
  });
  triggers.forEach(trigger => trigger.addEventListener('click', () => {
    const source = trigger.querySelector('img');
    if (!source?.src) return;
    scale = 1; x = y = 0; pointers.clear();
    image.alt = source.alt; image.src = source.currentSrc || source.src;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    viewer.showModal(); draw(); close.focus();
  }));
  image.onload = draw;
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(scale * Math.exp(-event.deltaY * .002), event.clientX, event.clientY);
  }, { passive: false });
  stage.addEventListener('dblclick', event => zoom(scale > 1 ? 1 : 2.5, event.clientX, event.clientY));
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture(event.pointerId); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', event => {
    const before = pointers.get(event.pointerId);
    if (!before) return;
    const old = [...pointers.values()];
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = [...pointers.values()];
    if (current.length === 2) {
      const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const oldMid = midpoint(old), newMid = midpoint(current), oldDistance = distance(old);
      if (oldDistance > 0) zoom(scale * distance(current) / oldDistance, oldMid.x, oldMid.y);
      x += newMid.x - oldMid.x; y += newMid.y - oldMid.y;
    } else if (current.length === 1) {
      x += event.clientX - before.x; y += event.clientY - before.y;
    }
    draw();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stage.addEventListener(type, event => {
      pointers.delete(event.pointerId);
      if (!pointers.size) stage.classList.remove('dragging');
    });
  }
  viewer.addEventListener('keydown', event => {
    if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === '+' || event.key === '=') zoom(scale * 1.4);
      if (event.key === '-') zoom(scale / 1.4);
      if (event.key === '0') { scale = 1; x = y = 0; }
      if (event.key === 'ArrowLeft') x += 50;
      if (event.key === 'ArrowRight') x -= 50;
      if (event.key === 'ArrowUp') y += 50;
      if (event.key === 'ArrowDown') y -= 50;
      draw();
    }
  });
  window.addEventListener('resize', () => { if (viewer.open) draw(); });
}
