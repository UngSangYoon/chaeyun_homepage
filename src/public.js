import { $, node, base, asset, picture, paragraphs } from './dom.js';
import { renderHome } from './home.js';
import { workUrl } from './work-links.js';
import { startBrushTrail } from './brush-trail.js';
import { EXHIBITION_TYPES, groupExhibitions, exhibitionUrl, exhibitionCover } from './exhibitions.js';
import { renderExhibitionDetail } from './exhibition-detail.js';

startBrushTrail();

const view = document.body.dataset.view || 'home';
const pageNames = { home: '', works: 'Works', work: 'Work', texts: 'Texts', news: 'Exhibition', exhibition: 'Exhibition', cv: 'CV' };
let site, visibleWorks = [], current = 0;
const dialog = $('#lightbox');
if ($('#copyright-year')) $('#copyright-year').textContent = new Date().getFullYear();
document.querySelectorAll('.header [data-page]').forEach(link => {
  if (link.dataset.page === (view === 'work' ? 'works' : view === 'exhibition' ? 'news' : view)) link.setAttribute('aria-current', 'page');
});
if (view === 'home') $('.header .logo').setAttribute('aria-current', 'page');

function showWork(index) {
  if (!dialog || !visibleWorks.length) return;
  current = (index + visibleWorks.length) % visibleWorks.length;
  const work = visibleWorks[current];
  $('.lightbox-image').replaceChildren(picture(work.image, work.alt || work.title));
  $('#lightbox-title').textContent = work.title;
  $('#lightbox-meta').textContent = [work.medium, work.size].filter(Boolean).join(' · ');
  $('#lightbox-description').textContent = work.description;
  $('#lightbox-count').textContent = `${current + 1} / ${visibleWorks.length}`;
  $('#previous-work').disabled = $('#next-work').disabled = visibleWorks.length < 2;
  if (!dialog.open) { dialog.showModal(); document.body.classList.add('dialog-open'); }
}
if (dialog) {
  $('.lightbox-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showWork(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showWork(current + 1); }
  });
  $('#previous-work').onclick = () => showWork(current - 1);
  $('#next-work').onclick = () => showWork(current + 1);
}

function renderWorks() {
  // A stable sort keeps the admin's order within each year, including in the lightbox.
  visibleWorks = [...site.works].sort((a, b) => Number(b.year) - Number(a.year));
  const list = $('#works-grid'); list.replaceChildren();
  let year, grid;
  visibleWorks.forEach((work, i) => {
    if (work.year !== year) {
      year = work.year;
      const section = node('section', 'works-year-group');
      const heading = node('h2', 'works-year-heading', year); heading.id = `works-year-${year}`;
      section.setAttribute('aria-labelledby', heading.id);
      grid = node('div', 'works-grid'); section.append(heading, grid); list.append(section);
    }
    const card = node('article', 'work-card');
    const button = node('button', 'work-image');
    button.type = 'button';
    button.setAttribute('aria-label', `${work.title} 확대 보기`);
    button.append(picture(work.image, work.alt || work.title), node('span', 'work-zoom', '↗'));
    button.onclick = () => showWork(i);
    const heading = node('div', 'work-heading');
    heading.append(node('h3', '', work.title));
    card.append(button, heading, node('p', 'work-meta', [work.medium, work.size].filter(Boolean).join(' · ')));
    grid.append(card);
  });
  if (!visibleWorks.length) list.append(node('p', 'empty-state', '등록된 작품이 없습니다.'));
}

function renderWorkDetail() {
  $('#work-loading').hidden = true;
  const id = new URL(location.href).searchParams.get('id');
  const index = site.works.findIndex(work => work.id === id);
  if (index < 0) {
    $('#load-error').hidden = false;
    $('#load-error').textContent = '작품을 찾을 수 없습니다. 전체 작품에서 다른 작품을 선택해 주세요.';
    return;
  }
  const work = site.works[index];
  const title = `${work.title} · ${site.profile.englishName}`;
  document.title = title; $('meta[property="og:title"]').content = title;
  const image = picture(work.image, work.alt || work.title); image.loading = 'eager';
  $('#work-detail-image').replaceChildren(image);
  $('#work-title').textContent = work.title;
  $('#work-meta').textContent = [work.year, work.medium, work.size].filter(Boolean).join(' · ');
  paragraphs($('#work-description'), work.description);
  $('#work-detail').hidden = false;
  if (site.works.length > 1) {
    $('#work-navigation').hidden = false;
    $('#work-previous').href = workUrl(site.works[(index - 1 + site.works.length) % site.works.length].id, base);
    $('#work-next').href = workUrl(site.works[(index + 1) % site.works.length].id, base);
  }
}

function renderTexts() {
  if (site.profile.statement) {
    $('#statement-section').hidden = false;
    paragraphs($('#statement'), site.profile.statement);
  } else $('#texts-empty').hidden = false;
}

function renderNews() {
  $('#news-section').hidden = !site.news.length;
  for (const news of site.news) {
    const article = node('article', 'news-card');
    const date = node('time', '', news.date); date.dateTime = news.date;
    article.append(date, node('h3', '', news.title));
    const body = node('div', 'prose'); paragraphs(body, news.body); article.append(body);
    $('#news-list').append(article);
  }
  $('[data-exhibition-type="unclassified"]').hidden = !site.exhibitions.some(exhibition => !exhibition.type);
  const params = new URL(location.href).searchParams;
  let type = ['solo', 'group', 'unclassified'].includes(params.get('type')) ? params.get('type') : 'solo';
  document.querySelectorAll('[data-exhibition-type]').forEach(button => {
    button.onclick = () => { type = button.dataset.exhibitionType; renderExhibitions(type); };
  });
  renderExhibitions(type);
}

function renderExhibitions(type) {
  document.querySelectorAll('[data-exhibition-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.exhibitionType === type)));
  const list = $('#exhibition-list'); list.replaceChildren();
  const label = EXHIBITION_TYPES.find(([value]) => value === type)?.[1] || '미분류 전시';
  list.setAttribute('aria-label', `${label} 연도별 목록`);
  for (const { year, items } of groupExhibitions(site.exhibitions, type)) {
    const group = node('section', 'works-year-group');
    group.append(node('h2', 'works-year-heading', year));
    const entries = node('div', 'works-grid');
    for (const exhibition of items) {
      const entry = node('article', 'work-card');
      const cover = exhibitionCover(exhibition), href = exhibitionUrl(exhibition.id, base);
      const imageLink = node('a', 'work-image exhibition-cover-link'); imageLink.href = href;
      imageLink.setAttribute('aria-label', `${exhibition.title} 전시 상세 보기`);
      if (cover) imageLink.append(picture(cover.image, cover.alt || `${exhibition.title} 대표 사진`));
      else imageLink.append(node('span', 'empty-state', '대표 이미지 준비 중'));
      const heading = node('div', 'work-heading');
      const title = node('h3'), titleLink = node('a', 'exhibition-title-link', exhibition.title);
      titleLink.href = href; title.append(titleLink); heading.append(title);
      entry.append(imageLink, heading);
      if (exhibition.period) entry.append(node('p', 'work-meta', exhibition.period));
      if (exhibition.location) entry.append(node('p', 'work-meta', exhibition.location));
      entries.append(entry);
    }
    group.append(entries); list.append(group);
  }
  if (!list.children.length) list.append(node('p', 'empty-state', `등록된 ${label} 기록이 없습니다.`));
}

function renderCv() {
  const p = site.profile;
  if (p.intro) { $('#intro-section').hidden = false; paragraphs($('#intro'), p.intro); }
  if (p.portrait) { $('#portrait').hidden = false; $('#portrait').replaceChildren(picture(p.portrait, `${p.name} 작가`)); }
  if (p.cvFile) {
    $('#cv-link').hidden = false; $('#cv-link').href = asset(p.cvFile);
    $('#cv-link').target = '_blank'; $('#cv-link').rel = 'noopener';
  }
  for (const category of [...new Set(site.cv.map(c => c.category))]) {
    const group = node('div', 'cv-group'); group.append(node('h3', '', category));
    const rows = node('div');
    for (const item of site.cv.filter(c => c.category === category)) {
      const row = node('div', 'cv-row'); row.append(node('span', '', item.period), node('p', '', item.detail)); rows.append(row);
    }
    group.append(rows); $('#cv').append(group);
  }
  if (!site.cv.length) $('#cv').append(node('p', 'empty-state', '등록된 약력이 없습니다.'));
  if (p.email || p.instagram) $('#contact').hidden = false;
  if (p.email) {
    const a = node('a', '', p.email); a.href = `mailto:${p.email}`; $('#contact-links').append(a);
  }
  if (p.instagram) {
    const a = node('a', '', 'Instagram ↗'); a.href = `https://www.instagram.com/${encodeURIComponent(p.instagram)}/`;
    a.target = '_blank'; a.rel = 'noopener noreferrer'; $('#contact-links').append(a);
  }
}

function render() {
  const p = site.profile;
  const title = [pageNames[view], p.englishName].filter(Boolean).join(' · ');
  document.title = title;
  $('meta[property="og:title"]').content = title;
  document.querySelectorAll('[data-name]').forEach(el => el.textContent = p.name);
  document.querySelectorAll('[data-english]').forEach(el => el.textContent = p.englishName);
  document.querySelectorAll('[data-discipline]').forEach(el => el.textContent = p.discipline);
  if (view === 'home') renderHome(site.works);
  if (view === 'work') renderWorkDetail();
  if (view === 'exhibition') renderExhibitionDetail(site);
  if (view === 'works') renderWorks();
  if (view === 'texts') renderTexts();
  if (view === 'news') renderNews();
  if (view === 'cv') renderCv();
}
try {
  const response = await fetch(new URL('content/site.json', base), { cache: 'no-cache' });
  if (!response.ok) throw new Error();
  site = await response.json(); render();
} catch {
  if ($('#home-empty')) $('#home-empty').hidden = true;
  if ($('#work-loading')) $('#work-loading').hidden = true;
  if ($('#exhibition-loading')) $('#exhibition-loading').hidden = true;
  if ($('#works-grid')) $('#works-grid').replaceChildren();
  const error = $('#load-error');
  if (error) { error.hidden = false; error.textContent = '내용을 불러오지 못했습니다. 네트워크 연결을 확인하고 새로고침해 주세요.'; }
}
