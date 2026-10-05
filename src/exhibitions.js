export const EXHIBITION_TYPES = [['solo', '개인전'], ['group', '단체전']];
export const MAX_EXHIBITION_PHOTOS = 50;

export function exhibitionUrl(id, base) {
  const url = new URL('exhibition.html', base); url.searchParams.set('id', id); return url.href;
}

export function exhibitionPhotos(exhibition) {
  if (Array.isArray(exhibition.photos)) return exhibition.photos;
  return exhibition.image ? [{ id: 'legacy-cover', image: exhibition.image, alt: '', workId: '' }] : [];
}

export function exhibitionCover(exhibition) {
  const photos = exhibitionPhotos(exhibition);
  return photos.find(photo => photo.id === exhibition.coverPhotoId) || photos[0];
}

export function syncExhibitionGallery(exhibition) {
  exhibition.photos = exhibitionPhotos(exhibition);
  const cover = exhibitionCover(exhibition);
  exhibition.coverPhotoId = cover?.id || '';
  exhibition.image = cover?.image || '';
}

export function removeExhibitionPhoto(exhibition, id) {
  exhibition.photos = exhibitionPhotos(exhibition).filter(photo => photo.id !== id);
  syncExhibitionGallery(exhibition);
}

export function unlinkExhibitionWork(exhibitions, workId) {
  for (const exhibition of exhibitions) for (const photo of exhibitionPhotos(exhibition)) {
    if (photo.workId === workId) photo.workId = '';
  }
}

export function formatExhibitionTitle(title) {
  const text = title.trim().replace(/^《/, '').replace(/》$/, '').trim();
  return text ? `《${text}》` : '';
}

export function groupExhibitions(exhibitions, type) {
  const years = new Map();
  for (const exhibition of exhibitions) {
    // Preserve older entries without guessing whether they were solo or group shows.
    if ((exhibition.type || 'unclassified') !== type) continue;
    if (!years.has(exhibition.year)) years.set(exhibition.year, []);
    years.get(exhibition.year).push(exhibition);
  }
  return [...years].sort(([a], [b]) => Number(b) - Number(a)).map(([year, items]) => ({ year, items }));
}
