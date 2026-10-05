import { MAX_EXHIBITION_PHOTOS, exhibitionCover } from '../src/exhibitions.js';
import { isAssetPath } from '../src/media.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function assert(condition, message) { if (!condition) throw new HttpError(400, message); }
function object(value, label) { assert(value && typeof value === 'object' && !Array.isArray(value), `${label} 형식이 올바르지 않습니다.`); }
function string(value, label, max = 300, required = false) {
  assert(typeof value === 'string' && value.length <= max && (!required || value.trim()), `${label}: ${required ? '필수 항목이며 ' : ''}${max}자 이내로 입력해 주세요.`);
}
export function validateContent(data, { requireExhibitionCovers = false } = {}) {
  object(data, '내용'); assert(data.version === 1, '지원하지 않는 문서 버전입니다.'); object(data.profile, '프로필');
  const p = data.profile;
  for (const key of ['name', 'englishName', 'discipline', 'portrait', 'cvFile', 'email', 'instagram']) string(p[key], key, 300, ['name', 'englishName'].includes(key));
  for (const key of ['intro', 'statement']) string(p[key], key, 20000);
  assert((p.portrait === '' || isAssetPath(p.portrait)) && (p.cvFile === '' || isAssetPath(p.cvFile, true)), '프로필 파일 경로가 올바르지 않습니다.');
  assert(!p.email || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.email), '이메일 형식을 확인해 주세요.');
  assert(!p.instagram || /^[A-Za-z0-9._]{1,30}$/.test(p.instagram), 'Instagram은 @ 없이 사용자 이름만 입력해 주세요.');
  const fields = {
    works: { title: true, year: true, medium: false, size: false, image: true, alt: false, description: false },
    cv: { category: true, period: false, detail: true },
    exhibitions: { type: false, title: true, year: true, location: false, description: false, image: false, period: false, coverPhotoId: false },
    news: { title: true, date: true, body: true }
  };
  for (const [key, schema] of Object.entries(fields)) {
    assert(Array.isArray(data[key]) && data[key].length <= 300, `${key}: 최대 300개까지 등록할 수 있습니다.`);
    const ids = new Set();
    for (const item of data[key]) {
      object(item, key); string(item.id, '항목 ID', 100, true); assert(/^[\w-]+$/.test(item.id) && !ids.has(item.id), '항목 ID가 중복되거나 올바르지 않습니다.'); ids.add(item.id);
      for (const [field, required] of Object.entries(schema)) {
        if (key === 'exhibitions' && ['type', 'image', 'period', 'coverPhotoId'].includes(field) && item[field] === undefined) continue;
        string(item[field], `${key} · ${field}`, ['description', 'body'].includes(field) ? 20000 : 300, required);
      }
      if (key === 'works') assert(isAssetPath(item.image) && /^\d{4}$/.test(item.year), '작품 이미지와 4자리 제작 연도를 확인해 주세요.');
      if (key === 'exhibitions') {
        assert(/^\d{4}$/.test(item.year), '전시 연도는 4자리로 입력해 주세요.');
        assert(item.type === undefined || ['solo', 'group'].includes(item.type), '전시 구분을 개인전 또는 단체전으로 선택해 주세요.');
        assert(item.image === undefined || item.image === '' || isAssetPath(item.image), '전시 대표 사진 경로가 올바르지 않습니다.');
        if (item.photos !== undefined) {
          assert(Array.isArray(item.photos) && item.photos.length <= MAX_EXHIBITION_PHOTOS, `전시 사진은 최대 ${MAX_EXHIBITION_PHOTOS}장까지 등록할 수 있습니다.`);
          const photoIds = new Set(), workIds = new Set(data.works.map(work => work.id));
          for (const photo of item.photos) {
            object(photo, '전시 사진'); string(photo.id, '전시 사진 ID', 100, true);
            assert(/^[\w-]+$/.test(photo.id) && !photoIds.has(photo.id), '전시 사진 ID가 중복되거나 올바르지 않습니다.'); photoIds.add(photo.id);
            string(photo.image, '전시 사진 경로', 300, true); assert(isAssetPath(photo.image), '전시 사진 경로가 올바르지 않습니다.');
            if (photo.alt !== undefined) string(photo.alt, '전시 사진 설명', 300);
            if (photo.workId !== undefined) {
              string(photo.workId, '연결 작품 ID', 100);
              assert(!photo.workId || workIds.has(photo.workId), '전시 사진에 연결할 작품을 다시 선택해 주세요.');
            }
          }
          assert(!item.coverPhotoId || photoIds.has(item.coverPhotoId), '대표 사진은 이 전시에 등록된 사진에서 선택해 주세요.');
        } else assert(!item.coverPhotoId, '대표 사진을 선택하려면 전시 사진을 먼저 등록해 주세요.');
        // Legacy content remains readable/buildable; every newly published document needs covers.
        if (requireExhibitionCovers) assert(exhibitionCover(item), `${item.title}: 전시 대표 이미지를 등록해 주세요.`);
      }
      if (key === 'news') assert(/^\d{4}-\d{2}-\d{2}$/.test(item.date) && !Number.isNaN(Date.parse(item.date)) && new Date(item.date).toISOString().slice(0, 10) === item.date, '소식 날짜를 확인해 주세요.');
    }
  }
  assert(new TextEncoder().encode(JSON.stringify(data)).length <= 800000, '전체 내용은 800KB 이내여야 합니다.');
  // Whitelist fields so unrecognized keys never become public content.
  const profile = Object.fromEntries(['name', 'englishName', 'discipline', 'portrait', 'cvFile', 'email', 'instagram', 'intro', 'statement'].map(k => [k, p[k]]));
  return { version: 1, profile, ...Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, data[key].map(item => {
    const result = Object.fromEntries(['id', ...Object.keys(schema)].map(k => [k, item[k]]));
    if (key === 'exhibitions' && item.photos !== undefined) {
      result.photos = item.photos.map(photo => ({ id: photo.id, image: photo.image, alt: photo.alt || '', workId: photo.workId || '' }));
      const cover = result.photos.find(photo => photo.id === item.coverPhotoId) || result.photos[0];
      result.coverPhotoId = cover?.id || ''; result.image = cover?.image || '';
    }
    return result;
  })])) };
}
export function identifyUpload(bytes, type) {
  const match = (...values) => values.every((v, i) => bytes[i] === v);
  if (type === 'image/jpeg' && match(255, 216, 255)) return 'jpg';
  if (type === 'image/png' && match(137, 80, 78, 71, 13, 10, 26, 10)) return 'png';
  if (type === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'webp';
  if (type === 'application/pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return 'pdf';
  throw new HttpError(400, '파일 형식이 올바르지 않습니다. JPG, PNG, WebP 또는 PDF만 업로드할 수 있습니다.');
}
