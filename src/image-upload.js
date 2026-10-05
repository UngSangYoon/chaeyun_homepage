export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/tiff,image/x-tiff,.tif,.tiff';
export const IMAGE_HINT = 'JPG, PNG, WebP, TIF, TIFF · 긴 변 2,400px로 자동 최적화 · TIFF는 첫 페이지 사용';
export const isTiff = file => /\.tiff?$/i.test(file.name || '') || ['image/tiff', 'image/x-tiff'].includes(file.type);

export function imageGeometry(width, height, orientation = 1) {
  const rotated = orientation >= 5;
  const orientedWidth = rotated ? height : width, orientedHeight = rotated ? width : height;
  const scale = Math.min(1, 2400 / Math.max(orientedWidth, orientedHeight));
  const transforms = {
    1: [1, 0, 0, 1, 0, 0], 2: [-1, 0, 0, 1, width, 0],
    3: [-1, 0, 0, -1, width, height], 4: [1, 0, 0, -1, 0, height],
    5: [0, 1, 1, 0, 0, 0], 6: [0, 1, -1, 0, height, 0],
    7: [0, -1, -1, 0, height, width], 8: [0, -1, 1, 0, 0, width]
  };
  return { width: Math.max(1, Math.round(orientedWidth * scale)), height: Math.max(1, Math.round(orientedHeight * scale)), orientedWidth, orientedHeight, transform: transforms[orientation] };
}

async function readTiff(file) {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./tiff-worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => { clearTimeout(timeout); worker.terminate(); error ? reject(error) : resolve(result); };
    const timeout = setTimeout(() => finish(new Error('TIFF 변환 시간이 초과되었습니다. 이미지 크기를 줄여 다시 시도해 주세요.')), 30000);
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data);
    worker.onerror = event => { event.preventDefault(); finish(new Error('TIFF 변환에 실패했습니다. 파일 형식을 확인해 주세요.')); };
    worker.postMessage(buffer, [buffer]);
  });
}

export async function optimizedImage(file) {
  const tiff = isTiff(file);
  if (!tiff && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WebP, TIF, TIFF 이미지를 선택해 주세요.');
  let source, orientation = 1, output;
  try {
    if (tiff) {
      const decoded = await readTiff(file);
      source = document.createElement('canvas'); source.width = decoded.width; source.height = decoded.height;
      source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(decoded.rgba.buffer), decoded.width, decoded.height), 0, 0);
      orientation = decoded.orientation;
    } else source = await createImageBitmap(file);
    const geometry = imageGeometry(source.width, source.height, orientation);
    output = document.createElement('canvas'); output.width = geometry.width; output.height = geometry.height;
    const ctx = output.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(output.width / geometry.orientedWidth, output.height / geometry.orientedHeight);
    ctx.transform(...geometry.transform);
    ctx.drawImage(source, 0, 0);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/webp', .9));
    if (!blob) throw new Error('이미지 변환에 실패했습니다. 다른 이미지를 선택해 주세요.');
    return blob;
  } finally {
    if (source?.close) source.close();
    else if (source) source.width = source.height = 0;
    if (output) output.width = output.height = 0;
  }
}
