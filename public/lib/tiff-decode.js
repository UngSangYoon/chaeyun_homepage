import UTIF from '../vendor/utif.js';

export const MAX_TIFF_PIXELS = 40_000_000;
const unsupported = '지원하지 않는 TIFF 저장 형식입니다. RGB TIFF 또는 PNG로 다시 저장해 주세요.';

export function decodeTiff(buffer) {
  const bytes = new Uint8Array(buffer);
  const little = bytes[0] === 73 && bytes[1] === 73;
  const big = bytes[0] === 77 && bytes[1] === 77;
  if (bytes.length < 8 || (!little && !big)) throw new Error('올바른 TIFF 파일이 아닙니다.');
  const header = new DataView(buffer);
  if (header.getUint16(2, little) !== 42) throw new Error('BigTIFF는 지원하지 않습니다. 일반 TIFF 또는 PNG로 저장해 주세요.');
  const firstOffset = header.getUint32(4, little);
  if (firstOffset < 8 || firstOffset + 2 > bytes.length) throw new Error('TIFF 파일이 손상되었습니다.');
  const pages = UTIF.decode(buffer), page = pages[0];
  const width = page?.t256?.[0], height = page?.t257?.[0];
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('TIFF 이미지 크기를 읽을 수 없습니다.');
  if (width * height > MAX_TIFF_PIXELS || width > 16384 || height > 16384) throw new Error('TIFF는 4천만 화소, 한 변 16,384px 이하로 줄여 주세요.');
  const photo = page.t262?.[0] ?? 2;
  const bits = page.t258 || [1], bps = bits[0];
  const samples = page.t277?.[0] ?? bits.length;
  if (bits.some(bit => bit !== bps) || page.t339?.some(format => format !== 1) || (page.t284?.[0] ?? 1) !== 1) throw new Error(unsupported);
  const supported = (photo === 0 && samples === 1 && [1, 4, 8, 16].includes(bps))
    || (photo === 1 && samples === 1 && [1, 2, 8, 16].includes(bps))
    || (photo === 2 && [3, 4].includes(samples) && [8, 16].includes(bps))
    || (photo === 3 && samples === 1 && bps === 8 && page.t320?.length >= 768)
    || (photo === 5 && [4, 5].includes(samples) && bps === 8)
    || (photo === 6 && samples === 3 && bps === 8 && [6, 7].includes(page.t259?.[0]));
  if (!supported) throw new Error(unsupported);
  const compression = page.t259?.[0] ?? 1;
  if (![1, 3, 4, 5, 6, 7, 8, 32946, 32773, 32809].includes(compression)) throw new Error(unsupported);
  // Adobe's legacy Deflate tag uses the same decoder as compression 8.
  if (compression === 32946) page.t259 = [8];
  const offsets = page.t273 || page.t324, counts = page.t279 || page.t325;
  if (!offsets?.length || !counts || offsets.length !== counts.length || offsets.some((offset, i) => offset < 0 || counts[i] < 1 || offset + counts[i] > bytes.length)) throw new Error('TIFF 이미지 데이터가 누락되거나 손상되었습니다.');
  const tileWidth = page.t322?.[0], tileHeight = page.t323?.[0];
  if (tileWidth && (!tileHeight || tileWidth * tileHeight > MAX_TIFF_PIXELS)) throw new Error('TIFF 타일 크기가 너무 큽니다.');
  UTIF.decodeImage(buffer, page, pages);
  if (!page.data?.length) throw new Error('TIFF 이미지를 해석하지 못했습니다.');
  let rgba;
  if (photo === 0 && bps === 16) {
    rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) { const value = 255 - page.data[i * 2 + 1]; rgba.set([value, value, value, 255], i * 4); }
  } else rgba = UTIF.toRGBA8(page);
  const orientation = page.t274?.[0] ?? 1;
  if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) throw new Error('TIFF 방향 정보가 올바르지 않습니다.');
  return { width, height, rgba, orientation, pageCount: pages.length };
}
