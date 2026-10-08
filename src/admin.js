import { $, node, base, picture, setAssetBase } from './dom.js';
import { API_URL } from '../config.js';
import { optimizedImage, IMAGE_ACCEPT, IMAGE_HINT } from './image-upload.js';
import { MAX_UPLOAD_BYTES } from './media.js';
import { EXHIBITION_TYPES, formatExhibitionTitle, unlinkExhibitionWork, exhibitionCover } from './exhibitions.js';
import { exhibitionGalleryEditor } from './exhibition-editor.js';

const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
const endpoint = API_URL || (local ? `${location.origin}/api` : '');
if (API_URL) setAssetBase(`${API_URL}/public/`);
let token = '', data, sha, tab = 'works', dirty = false, busy = false;
const previews = new Map();
const labels = { works: 'Works', exhibitions: 'Exhibition', texts: 'Texts', cv: 'CV' };
const recordLabels = { works: '작품', exhibitions: '전시', cv: '약력', news: '소식' };
if (!endpoint) { $('#setup-notice').hidden = false; $('#login-form button').disabled = true; }

function status(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function changed() { dirty = true; $('#dirty-label').textContent = '게시하지 않은 변경사항'; }
function setBusy(value) {
  busy = value;
  $('#editor').querySelectorAll('button,input,textarea,select').forEach(el => { el.disabled = value || el.dataset.locked === 'true'; });
}
async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, { ...options, headers, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      token = ''; $('#editor').hidden = true; $('#login-panel').hidden = false;
      $('#login-error').textContent = '로그인이 만료되었습니다. 다시 로그인하면 작성 중인 내용을 이어서 편집할 수 있습니다.';
    }
    throw new Error(body.error || '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  }
  return body;
}
$('#login-form').onsubmit = async event => {
  event.preventDefault();
  const button = $('#login-form button'); button.disabled = true; $('#login-error').textContent = '';
  try {
    const result = await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#password').value }) });
    token = result.token; $('#password').value = '';
    if (!data) { const result = await request('/content'); data = result.data; sha = result.sha; }
    $('#login-panel').hidden = true; $('#editor').hidden = false; render();
  } catch (error) { $('#login-error').textContent = error.message; }
  finally { button.disabled = false; }
};
async function confirmAction(title, detail) {
  const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('p', dialog).textContent = detail;
  dialog.returnValue = ''; dialog.showModal();
  $('#cancel-delete').onclick = () => dialog.close('cancel');
  $('#confirm-delete').onclick = () => dialog.close('confirm');
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
$('#logout').onclick = async () => {
  if (dirty && !await confirmAction('변경사항을 버리고 로그아웃할까요?', '아직 게시하지 않은 글과 수정사항은 사라집니다.')) return;
  setBusy(true);
  try { await request('/logout', { method: 'POST' }); token = ''; data = undefined; dirty = false; for (const url of previews.values()) URL.revokeObjectURL(url); previews.clear(); $('#dirty-label').textContent = '저장됨'; $('#editor').hidden = true; $('#login-panel').hidden = false; $('#password').focus(); }
  catch (error) { status(error.message, true); }
  finally { setBusy(false); }
};
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; render(); });

function field(object, key, title, options = {}) {
  const label = node('label', `field${options.wide ? ' wide' : ''}`); label.append(node('span', '', title));
  const input = node(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
  if (options.choices) {
    for (const [value, text] of [['', '전시 구분을 선택해 주세요'], ...options.choices]) {
      const option = node('option', '', text); option.value = value; option.disabled = value === ''; input.append(option);
    }
  }
  input.value = object[key] || ''; input.maxLength = options.maxLength ?? (options.multiline ? 20000 : 300);
  if (options.type) input.type = options.type;
  if (options.placeholder) input.placeholder = options.placeholder;
  input.oninput = () => { object[key] = options.format ? options.format(input.value) : input.value; changed(); };
  if (options.format) input.onblur = () => {
    const formatted = options.format(input.value);
    if (object[key] !== formatted) { object[key] = formatted; changed(); }
    input.value = formatted;
  };
  if (options.choices) input.onchange = input.oninput;
  label.append(input);
  if (options.hint) label.append(node('small', '', options.hint));
  return label;
}
function uploadField(object, key, title, pdf = false) {
  const wrap = node('div', 'field wide upload-field'); const label = node('label', '', title);
  const input = node('input'); input.type = 'file'; input.accept = pdf ? 'application/pdf' : IMAGE_ACCEPT; label.append(input); wrap.append(label);
  if (object[key]) {
    if (pdf) wrap.append(node('small', '', 'PDF 파일 등록됨'));
    else {
      const image = picture(object[key], '등록한 이미지', 'upload-preview');
      if (previews.has(object[key])) image.src = previews.get(object[key]);
      image.onerror = () => { image.hidden = true; };
      wrap.append(image);
    }
    const remove = node('button', 'secondary', '파일 연결 해제'); remove.type = 'button';
    remove.onclick = () => { object[key] = ''; changed(); render(); }; wrap.append(remove);
  }
  wrap.append(node('small', '', pdf ? 'PDF · 최대 5MB' : IMAGE_HINT));
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    setBusy(true); status('파일을 준비하고 있습니다…');
    try {
      object[key] = await uploadFile(file, pdf); changed();
      status('파일이 저장되었습니다. 변경사항 게시를 누르면 홈페이지에 반영됩니다.');
      render();
    } catch (error) { status(error.message, true); input.value = ''; }
    finally { setBusy(false); }
  };
  return wrap;
}
function renderProfile(container) {
  const p = data.profile, grid = node('div', 'field-grid');
  grid.append(field(p, 'name', '작가명 *'), field(p, 'englishName', '영문명 *'), field(p, 'discipline', '분야'), field(p, 'email', '문의 이메일', { type: 'email' }), field(p, 'instagram', 'Instagram 사용자 이름', { placeholder: '계정 이름만 입력 (@ 제외)' }), field(p, 'intro', '작가 소개', { multiline: true, wide: true }), uploadField(p, 'portrait', '작가 사진'), uploadField(p, 'cvFile', '약력 PDF', true));
  container.append(grid);
}
async function uploadFile(file, pdf = false) {
  if (pdf && file.type !== 'application/pdf') throw new Error('PDF 파일을 선택해 주세요.');
  const blob = pdf ? file : await optimizedImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('업로드 파일은 5MB 이하여야 합니다.');
  const result = await request('/upload', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
  if (!pdf) previews.set(result.path, URL.createObjectURL(blob));
  return result.path;
}

const definitions = {
  works: [['title', '작품명 *'], ['year', '제작 연도 *', { placeholder: '2026' }], ['medium', '재료 / 기법'], ['size', '크기', { placeholder: '90 × 60 cm' }], ['alt', '이미지 설명', { wide: true, hint: '화면을 볼 수 없는 방문자를 위한 작품의 시각적 설명' }], ['description', '작품 소개', { multiline: true, wide: true }]],
  cv: [['category', '구분 *', { placeholder: '학력 / 개인전 / 단체전 / 수상 / 소장' }], ['period', '연도 / 기간'], ['detail', '내용 *', { wide: true }]],
  exhibitions: [['type', '전시 구분 *', { choices: EXHIBITION_TYPES }], ['title', '전시명 *', { placeholder: '여백의 기록', hint: '제목을 입력하면 《》가 자동으로 붙습니다.', format: formatExhibitionTitle, maxLength: 298 }], ['year', '연도 *', { placeholder: '2026' }], ['period', '전시 기간', { placeholder: '2026. 10. 01 – 10. 31' }], ['location', '장소', { wide: true }], ['description', '전시 소개 (+ Info)', { multiline: true, wide: true }]],
  news: [['title', '제목 *'], ['date', '날짜 *', { type: 'date' }], ['body', '내용 *', { multiline: true, wide: true }]]
};
function renderList(container, key = tab) {
  const list = node('div', 'record-list'), items = data[key];
  if (!items.length) list.append(node('p', 'list-empty', `아직 등록된 ${recordLabels[key]} 항목이 없습니다. 아래 버튼으로 추가해 주세요.`));
  items.forEach((item, index) => {
    const card = node('article', 'record'); const head = node('div', 'record-heading');
    head.append(node('h3', '', `${String(index + 1).padStart(2, '0')} / ${item.title || item.detail || `새 ${recordLabels[key]}`}`));
    const controls = node('div', 'record-controls');
    for (const [direction, text, description] of [[-1, '↑', '위로 이동'], [1, '↓', '아래로 이동']]) {
      const button = node('button', '', text); button.type = 'button'; button.setAttribute('aria-label', `${index + 1}번 항목 ${description}`);
      button.disabled = index + direction < 0 || index + direction >= items.length; button.dataset.locked = String(button.disabled);
      button.onclick = () => { [items[index], items[index + direction]] = [items[index + direction], items[index]]; changed(); render(); }; controls.append(button);
    }
    const remove = node('button', '', '삭제'); remove.type = 'button'; remove.onclick = async () => {
      if (await confirmAction('항목을 삭제할까요?', '변경사항을 게시하면 홈페이지에서도 삭제됩니다. 업로드 파일은 저장소에 보관됩니다.')) {
        if (key === 'works') unlinkExhibitionWork(data.exhibitions, item.id);
        items.splice(index, 1); changed(); render();
      }
    }; controls.append(remove); head.append(controls); card.append(head);
    const grid = node('div', 'field-grid');
    if (key === 'works') grid.append(uploadField(item, 'image', '작품 이미지 *'));
    for (const [fieldKey, title, options] of definitions[key]) grid.append(field(item, fieldKey, title, options));
    if (key === 'exhibitions') grid.append(exhibitionGalleryEditor(item, { works: data.works, upload: uploadFile, changed, confirm: confirmAction, previews, setBusy, status }));
    card.append(grid); list.append(card);
  });
  const add = node('button', 'secondary add-button', `＋ ${recordLabels[key]} 추가`); add.type = 'button';
  add.onclick = () => {
    const item = { id: crypto.randomUUID() }; for (const [fieldKey] of definitions[key]) item[fieldKey] = '';
    if (key === 'works' || key === 'exhibitions') item.image = '';
    if (key === 'exhibitions') { item.photos = []; item.coverPhotoId = ''; }
    if (key === 'news') item.date = new Date().toISOString().slice(0, 10);
    data[key].push(item); changed(); render();
    if (key === 'news') $('.editor-news').open = true;
    const cards = document.querySelectorAll('.record'); cards[cards.length - 1]?.querySelector('input')?.focus();
  };
  container.append(list, add);
}
function render() {
  document.querySelectorAll('[data-tab]').forEach(el => { if (el.dataset.tab === tab) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  const descriptions = {
    works: '홈과 Works에 표시할 작품을 등록합니다. 같은 연도에서는 아래 순서를 따릅니다. * 표시는 필수 항목입니다.',
    exhibitions: 'Exhibition에 표시할 개인전·단체전을 등록합니다. 대표 이미지는 필수이며, 같은 구분·연도에서는 아래 순서를 따릅니다.',
    texts: 'Texts에 표시할 작가 노트와 작업 관련 글을 편집합니다. 빈 줄로 문단을 구분합니다.',
    cv: 'CV에 표시할 작가 소개·사진·연락처·약력을 편집합니다. 빈 항목은 홈페이지에 표시되지 않습니다.'
  };
  const section = node('section', 'editor-section');
  section.append(node('h2', '', labels[tab]), node('p', '', descriptions[tab]));
  const preview = node('a', 'text-link editor-preview', '이 페이지 보기 ↗');
  preview.href = new URL({ works: 'works.html', exhibitions: 'news.html', texts: 'texts.html', cv: 'cv.html' }[tab], base).href;
  preview.target = '_blank'; preview.rel = 'noopener'; section.append(preview);
  if (tab === 'texts') {
    const grid = node('div', 'field-grid');
    grid.append(field(data.profile, 'statement', '작가 노트 / 작업 관련 글', { multiline: true, wide: true, hint: 'Texts 페이지에 표시됩니다. 작가 소개와 약력은 CV에서 편집합니다.' }));
    section.append(grid);
  } else if (tab === 'cv') {
    section.append(node('h3', 'editor-subheading', '작가 소개 · 사진 · 연락처'));
    renderProfile(section);
    section.append(node('h3', 'editor-subheading', '약력'));
    renderList(section, 'cv');
  } else {
    renderList(section);
    if (tab === 'exhibitions') {
      const news = node('details', 'editor-news');
      news.append(node('summary', '', '소식 관리 (Exhibition 하단에 표시)'));
      renderList(news, 'news'); section.append(news);
    }
  }
  $('#editor-content').replaceChildren(section);
}
$('#save').onclick = async () => {
  const missingCover = data.exhibitions.find(exhibition => !exhibitionCover(exhibition));
  if (missingCover) {
    tab = 'exhibitions'; render();
    status(`${missingCover.title || '새 전시'}: 대표 이미지를 등록한 뒤 게시해 주세요.`, true);
    return;
  }
  setBusy(true); status('변경사항을 게시하고 있습니다…');
  try {
    const result = await request('/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sha }) });
    sha = result.sha; dirty = false; $('#dirty-label').textContent = '저장됨';
    status('저장되었습니다. 홈페이지를 새로고침하면 변경사항을 볼 수 있습니다.');
  } catch (error) { status(error.message, true); }
  finally { setBusy(false); }
};
