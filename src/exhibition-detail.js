import { $, node, base, picture, paragraphs } from './dom.js';
import { EXHIBITION_TYPES, exhibitionPhotos, exhibitionCover } from './exhibitions.js';
import { workUrl } from './work-links.js';

export function renderExhibitionDetail(site) {
  $('#exhibition-loading').hidden = true;
  const id = new URL(location.href).searchParams.get('id');
  const exhibition = site.exhibitions.find(item => item.id === id);
  if (!exhibition) {
    $('#load-error').hidden = false;
    $('#load-error').textContent = '전시를 찾을 수 없습니다. 전시 목록에서 다른 전시를 선택해 주세요.';
    return;
  }
  const listUrl = new URL('news.html', base);
  listUrl.searchParams.set('type', exhibition.type || 'unclassified');
  $('#exhibition-close').href = listUrl.href;
  const title = `${exhibition.title} · ${site.profile.englishName}`;
  document.title = title; $('meta[property="og:title"]').content = title;
  $('#exhibition-title').textContent = exhibition.title;
  $('#exhibition-type').textContent = EXHIBITION_TYPES.find(([type]) => type === exhibition.type)?.[1] || '전시';
  for (const field of ['period', 'location']) {
    const element = $(`#exhibition-${field}`); element.textContent = exhibition[field] || ''; element.hidden = !exhibition[field];
  }
  const info = $('#exhibition-info-dialog');
  $('#exhibition-info-title').textContent = exhibition.title;
  paragraphs($('#exhibition-info-body'), exhibition.description);
  $('#exhibition-info-open').hidden = !exhibition.description;
  $('#exhibition-info-open').onclick = () => { info.showModal(); document.body.classList.add('dialog-open'); };
  $('#exhibition-info-close').onclick = () => info.close();
  info.addEventListener('close', () => document.body.classList.remove('dialog-open'));

  const photos = exhibitionPhotos(exhibition), cover = exhibitionCover(exhibition);
  let current = Math.max(0, photos.findIndex(photo => photo.id === cover?.id));
  const thumbnails = $('#exhibition-thumbnails'), stage = $('#exhibition-large-image');
  const previous = $('#exhibition-photo-previous'), next = $('#exhibition-photo-next');
  const thumbButtons = photos.map((photo, index) => {
    const button = node('button', 'exhibition-thumbnail'); button.type = 'button';
    button.setAttribute('aria-label', `${index + 1}번 전시 사진 보기`);
    button.setAttribute('aria-controls', 'exhibition-large-image');
    button.append(picture(photo.image, photo.alt || `${exhibition.title} 사진 ${index + 1}`));
    button.onclick = () => show(index); thumbnails.append(button); return button;
  });
  function show(index) {
    if (!photos.length) return;
    current = (index + photos.length) % photos.length;
    const photo = photos[current], work = site.works.find(item => item.id === photo.workId);
    const image = picture(photo.image, photo.alt || `${exhibition.title} 사진 ${current + 1}`); image.loading = 'eager';
    stage.replaceChildren();
    const linked = $('#exhibition-linked-work'); linked.hidden = !work; linked.removeAttribute('href');
    if (work) {
      const link = node('a', 'exhibition-art-link'); link.href = workUrl(work.id, base);
      link.setAttribute('aria-label', `${work.title} 작품 상세 보기`); link.append(image); stage.append(link);
      linked.href = link.href;
    } else stage.append(image);
    thumbButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    $('#exhibition-photo-count').textContent = `${current + 1} / ${photos.length}`;
  }
  previous.hidden = next.hidden = photos.length < 2;
  previous.onclick = () => show(current - 1); next.onclick = () => show(current + 1);
  const arrowKeys = event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  };
  $('#exhibition-gallery').addEventListener('keydown', arrowKeys);
  thumbnails.addEventListener('keydown', arrowKeys);
  if (photos.length) show(current);
  else stage.append(node('p', 'empty-state', '등록된 전시 사진이 없습니다.'));
  $('#exhibition-detail').hidden = false;
}
