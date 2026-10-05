import { $, node, base, picture } from './dom.js';
import { workUrl, workWindow } from './work-links.js';

export function renderHome(works) {
  const gallery = $('#home-gallery'), track = $('#home-track'), viewport = $('.home-viewport');
  const empty = $('#home-empty'), play = $('#home-play');
  const previous = $('#home-previous'), nextButton = $('#home-next');
  if (!works.length) { empty.textContent = '등록된 작품이 없습니다.'; return; }
  empty.hidden = true; gallery.hidden = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, timer, animation, paused = false;
  const canMove = () => works.length > 1;

  function card(index, offscreen) {
    const work = works[index], link = node('a', 'home-work');
    link.href = workUrl(work.id, base);
    link.setAttribute('aria-label', `${work.title} · ${work.year} 상세 보기`);
    const frame = node('div', 'home-work-image'), img = picture(work.image, work.alt || work.title);
    img.loading = 'eager'; frame.append(img);
    link.append(frame);
    if (offscreen) { link.inert = true; link.setAttribute('aria-hidden', 'true'); }
    return link;
  }
  function draw(start = current, backwards = false) {
    track.replaceChildren(...workWindow(works.length, start).map((index, offset) => card(index, backwards ? offset === 0 : offset > 0)));
    play.hidden = previous.hidden = nextButton.hidden = !canMove();
  }
  function schedule() {
    clearTimeout(timer);
    play.textContent = paused ? '자동 넘김 재생' : '자동 넘김 일시정지';
    if (canMove() && !paused && !document.hidden && !viewport.contains(document.activeElement) && !animation) timer = setTimeout(move, 4500);
  }
  function move(direction = 1) {
    if (!canMove() || animation) return;
    clearTimeout(timer);
    const next = (current + direction + works.length) % works.length;
    if (reducedMotion.matches) { current = next; draw(); schedule(); return; }
    if (direction < 0) draw(next, true);
    const step = track.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap);
    animation = track.animate([
      { transform: `translateX(${direction < 0 ? -step : 0}px)` },
      { transform: `translateX(${direction < 0 ? 0 : -step}px)` }
    ], { duration: 800, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
    animation.onfinish = () => { current = next; const finished = animation; animation = null; draw(); finished.cancel(); schedule(); };
  }
  play.onclick = () => { paused = !paused; schedule(); };
  previous.onclick = () => move(-1);
  nextButton.onclick = () => move(1);
  gallery.addEventListener('focusin', schedule);
  gallery.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', schedule);
  function reset() { animation?.cancel(); animation = null; draw(); schedule(); }
  window.addEventListener('resize', reset);
  reducedMotion.addEventListener('change', reset);
  draw(); schedule();
}
