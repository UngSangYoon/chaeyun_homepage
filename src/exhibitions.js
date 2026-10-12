export const EXHIBITION_TYPES = [['solo', '개인전'], ['group', '단체전']];
export const MAX_EXHIBITION_PHOTOS = 50;

export function exhibitionUrl(id, base) {
  const url = new URL('exhibition.html', base); url.searchParams.set('id', id); return url.href;
}

export function exhibitionPhotos(exhibition, works = []) {
  if (Array.isArray(exhibition.photos)) return exhibition.photos.map(photo => {
    const work = photo.useWorkImage && works.find(work => work.id === photo.workId);
    return work ? { ...photo, image: work.image } : photo;
  });
  return exhibition.image ? [{ id: 'legacy-cover', image: exhibition.image, alt: '', workId: '' }] : [];
}

export function exhibitionCover(exhibition, works = []) {
  const photos = exhibitionPhotos(exhibition, works);
  return photos.find(photo => photo.id === exhibition.coverPhotoId) || photos[0];
}

export function syncExhibitionGallery(exhibition, works = []) {
  exhibition.photos = exhibitionPhotos(exhibition, works);
  const cover = exhibitionCover(exhibition);
  exhibition.coverPhotoId = cover?.id || '';
  exhibition.image = cover?.image || '';
}

export function removeExhibitionPhoto(exhibition, id) {
  exhibition.photos = exhibitionPhotos(exhibition).filter(photo => photo.id !== id);
  syncExhibitionGallery(exhibition);
}

export function unlinkExhibitionWork(exhibitions, workId, works = []) {
  for (const exhibition of exhibitions) {
    syncExhibitionGallery(exhibition, works);
    for (const photo of exhibition.photos) if (photo.workId === workId) {
      photo.workId = '';
      delete photo.useWorkImage;
    }
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
