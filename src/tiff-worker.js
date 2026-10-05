import { decodeTiff } from '../lib/tiff-decode.js';

self.onmessage = ({ data }) => {
  try {
    const result = decodeTiff(data);
    self.postMessage(result, [result.rgba.buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'TIFF 변환에 실패했습니다.' });
  }
};
