import { DEFAULT_BRUSH_COLOR, readBrushSettings, createBrushTools, brushCursor } from './brush-tools.js';

export const INK_COLOR = DEFAULT_BRUSH_COLOR;
export const INK_LIFETIME = 2200;
export const MAX_DABS = 600;

// Keep only short-lived marks, independently of pointer event frequency.
export class BrushInk {
  dabs = [];
  last = null;
  distance = 0;

  breakStroke() { this.last = null; this.distance = 0; }
  clear() { this.dabs = []; this.breakStroke(); }
  prune(now) { this.dabs = this.dabs.filter(dab => now - dab.time < INK_LIFETIME); }
  add(x, y, now) {
    if (![x, y, now].every(Number.isFinite)) return;
    const previous = this.last;
    this.last = { x, y, time: now };
    if (!previous) return;
    const dx = x - previous.x, dy = y - previous.y, length = Math.hypot(dx, dy);
    // Do not join strokes across a window re-entry, a long pause or a cursor jump.
    if (now - previous.time > 180 || length > 240) { this.distance = 0; return; }
    if (length < 1) { this.last = previous; return; }
    const angle = Math.atan2(dy, dx);
    const speed = length / Math.max(8, now - previous.time);
    const pressure = Math.max(8, 24 - speed * 4);
    const steps = Math.ceil(length / 4);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const entrance = Math.min(1, (this.distance + length * t) / 24);
      this.dabs.push({ x: previous.x + dx * t, y: previous.y + dy * t, angle, width: pressure * (.4 + .6 * entrance), time: now });
    }
    this.distance += length;
    this.prune(now);
    if (this.dabs.length > MAX_DABS) this.dabs.splice(0, this.dabs.length - MAX_DABS);
  }
}

function brushTexture() {
  const texture = document.createElement('canvas');
  texture.width = 96; texture.height = 64;
  const ctx = texture.getContext('2d');
  if (!ctx) return null;
  // Parallel broken bristles leave paper-colored gaps, like a dry ink brush.
  ctx.strokeStyle = INK_COLOR; ctx.lineCap = 'round';
  for (let i = 0; i < 42; i++) {
    const y = 3 + i * 1.4;
    const edge = Math.abs((y - 32) / 32);
    const inset = edge * edge * 26;
    ctx.globalAlpha = .35 + Math.random() * .6;
    ctx.lineWidth = .5 + Math.random() * 1.7;
    ctx.beginPath();
    ctx.moveTo(4 + inset + Math.random() * 12, y);
    ctx.lineTo(92 - inset - Math.random() * 18, y + (Math.random() - .5) * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 100; i++) {
    ctx.globalAlpha = .3 + Math.random() * .7;
    ctx.fillRect(Math.random() * 96, Math.random() * 64, 2 + Math.random() * 12, .4 + Math.random());
  }
  return texture;
}

export function startBrushTrail() {
  const finePointer = matchMedia('(any-pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const texture = ctx && brushTexture();
  if (!ctx || !texture) return;
  canvas.className = 'brush-trail'; canvas.setAttribute('aria-hidden', 'true');
  const ink = new BrushInk();
  let settings = readBrushSettings();
  const rootStyle = document.documentElement.style;
  let frame = 0, width = 0, height = 0, enabled = false;
  document.body.append(canvas);

  function applySettings(next) {
    settings = next; clear();
    const tint = texture.getContext('2d');
    tint.globalAlpha = 1; tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = settings.color; tint.fillRect(0, 0, texture.width, texture.height);
    tint.globalCompositeOperation = 'source-over';
    rootStyle.setProperty('--cursor-brush', brushCursor(settings.color, settings.washed));
  }

  function clear() {
    cancelAnimationFrame(frame); frame = 0;
    ink.clear(); ctx.clearRect(0, 0, width, height);
  }
  function resize() {
    clear();
    width = window.innerWidth; height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / Math.max(1, width * height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function configure() {
    enabled = finePointer.matches && !reducedMotion.matches;
    canvas.hidden = !enabled;
    resize();
  }
  function paint(now) {
    frame = 0; ink.prune(now); ctx.clearRect(0, 0, width, height);
    for (const dab of ink.dabs) {
      const fade = Math.max(0, 1 - Math.max(0, now - dab.time - 450) / (INK_LIFETIME - 450));
      ctx.save();
      ctx.globalAlpha = .65 * fade * fade;
      ctx.translate(dab.x, dab.y); ctx.rotate(dab.angle);
      ctx.drawImage(texture, -dab.width * .7, -dab.width / 2, dab.width * 1.4, dab.width);
      ctx.restore();
    }
    if (ink.dabs.length) frame = requestAnimationFrame(paint);
  }
  function move(event) {
    if (!enabled || settings.washed || document.hidden || event.pointerType !== 'mouse') return;
    if (event.target?.closest?.('.brush-tools, input, textarea, select, [contenteditable="true"], dialog[open]')) { ink.breakStroke(); return; }
    ink.add(event.clientX, event.clientY, performance.now());
    if (!frame && ink.dabs.length) frame = requestAnimationFrame(paint);
  }
  const options = { passive: true };
  window.addEventListener('pointermove', move, options);
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) ink.breakStroke(); }, options);
  window.addEventListener('blur', clear, options);
  window.addEventListener('scroll', clear, { ...options, capture: true });
  window.addEventListener('resize', resize, options);
  document.addEventListener('visibilitychange', clear, options);
  finePointer.addEventListener('change', configure, options);
  reducedMotion.addEventListener('change', configure, options);
  configure();
  applySettings(settings);
  createBrushTools(settings, applySettings);
}
