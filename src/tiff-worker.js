import { decodeTiff } from '../lib/tiff-decode.js';
import { applyTiffProfile } from '../lib/tiff-color.js';

self.onmessage = async ({ data }) => {
  try {
    const result = await applyTiffProfile(decodeTiff(data));
    self.postMessage(result, [result.rgba.buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'TIFF 변환에 실패했습니다.' });
  }
};
