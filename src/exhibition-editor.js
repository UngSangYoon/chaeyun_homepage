import { node, picture } from './dom.js';
import { IMAGE_ACCEPT, IMAGE_HINT } from './image-upload.js';
import { MAX_EXHIBITION_PHOTOS, syncExhibitionGallery, removeExhibitionPhoto } from './exhibitions.js';

export function exhibitionGalleryEditor(exhibition, { works, upload, changed, confirm, previews, setBusy, status }) {
  syncExhibitionGallery(exhibition);
  const root = node('div', 'field wide exhibition-photo-editor');
  function draw() {
    root.replaceChildren(node('span', '', '전시 사진 · 대표 이미지 필수 *'));
    const label = node('label', 'exhibition-photo-upload', '사진 여러 장 추가');
    const input = node('input'); input.type = 'file'; input.accept = IMAGE_ACCEPT; input.multiple = true;
    label.append(input); root.append(label, node('small', '', `${IMAGE_HINT} · 전시당 최대 ${MAX_EXHIBITION_PHOTOS}장`));
    root.append(node('small', '', '사진을 한 장 이상 등록해야 게시할 수 있습니다. 첫 사진이 자동으로 대표가 되며, 다른 사진을 대표로 선택할 수도 있습니다. 대표 사진은 전시 목록과 상세 페이지의 첫 화면에 표시됩니다. 작품을 연결한 사진은 클릭하면 해당 Works 작품으로 이동합니다.'));
    const list = node('div', 'exhibition-photo-list');
    exhibition.photos.forEach((photo, index) => {
      const card = node('div', 'exhibition-photo-record');
      const image = picture(photo.image, photo.alt || `전시 사진 ${index + 1}`, 'upload-preview');
      if (previews.has(photo.image)) image.src = previews.get(photo.image);
      card.append(image);
      const controls = node('div', 'exhibition-photo-actions');
      const cover = node('button', 'secondary', photo.id === exhibition.coverPhotoId ? '대표 사진 ✓' : '대표 사진으로 설정'); cover.type = 'button';
      cover.setAttribute('aria-pressed', String(photo.id === exhibition.coverPhotoId));
      cover.onclick = () => { exhibition.coverPhotoId = photo.id; syncExhibitionGallery(exhibition); changed(); draw(); };
      controls.append(cover);
      for (const [direction, text] of [[-1, '↑'], [1, '↓']]) {
        const move = node('button', 'secondary', text); move.type = 'button'; move.setAttribute('aria-label', `${index + 1}번 사진 ${direction < 0 ? '앞으로' : '뒤로'} 이동`);
        move.disabled = index + direction < 0 || index + direction >= exhibition.photos.length; move.dataset.locked = String(move.disabled);
        move.onclick = () => { const photos = exhibition.photos; [photos[index], photos[index + direction]] = [photos[index + direction], photos[index]]; changed(); draw(); };
        controls.append(move);
      }
      const remove = node('button', 'danger', '사진 삭제'); remove.type = 'button';
      remove.onclick = async () => {
        if (await confirm('전시 사진을 삭제할까요?', '이 전시의 사진 목록에서 제거합니다. 연결된 Works 작품은 삭제되지 않습니다.')) {
          removeExhibitionPhoto(exhibition, photo.id); changed(); draw();
        }
      };
      controls.append(remove); card.append(controls);
      const altLabel = node('label', 'field', '사진 설명');
      const alt = node('input'); alt.value = photo.alt || ''; alt.maxLength = 300;
      alt.oninput = () => { photo.alt = alt.value; changed(); }; altLabel.append(alt); card.append(altLabel);
      const workLabel = node('label', 'field', '연결할 Works 작품');
      const select = node('select'), none = node('option', '', '연결 안 함'); none.value = ''; select.append(none);
      for (const work of works) { const option = node('option', '', `${work.title} (${work.year})`); option.value = work.id; select.append(option); }
      select.value = photo.workId || '';
      select.onchange = () => { photo.workId = select.value; changed(); };
      workLabel.append(select); card.append(workLabel); list.append(card);
    });
    if (!exhibition.photos.length) list.append(node('p', 'list-empty', '등록된 전시 사진이 없습니다.'));
    root.append(list);
    input.onchange = async () => {
      const files = [...input.files]; if (!files.length) return;
      if (exhibition.photos.length + files.length > MAX_EXHIBITION_PHOTOS) { status(`전시 사진은 최대 ${MAX_EXHIBITION_PHOTOS}장까지 등록할 수 있습니다.`, true); input.value = ''; return; }
      setBusy(true); let completed = 0;
      try {
        for (const file of files) {
          status(`전시 사진을 준비하고 있습니다… ${completed + 1} / ${files.length}`);
          const image = await upload(file);
          exhibition.photos.push({ id: crypto.randomUUID(), image, alt: '', workId: '' });
          syncExhibitionGallery(exhibition); changed(); completed++;
        }
        status(`${completed}장 업로드 완료. 대표 사진과 작품 연결을 설정한 뒤 변경사항 게시를 눌러 주세요.`);
      } catch (error) {
        status(`${completed}장 업로드 완료. ${error.message} 완료된 사진은 유지됩니다. 나머지 사진을 다시 선택해 주세요.`, true);
      } finally { draw(); setBusy(false); }
    };
  }
  draw(); return root;
}
