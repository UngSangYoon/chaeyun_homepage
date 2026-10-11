// LittleCMS 2.16 / lcms-wasm 1.0.5; licenses are included in ../vendor/.
import { instantiate, TYPE_RGBA_8, TYPE_RGB_8, TYPE_CMYK_8, TYPE_GRAY_8, INTENT_RELATIVE_COLORIMETRIC, cmsFLAGS_COPY_ALPHA } from '../vendor/lcms.js';

export async function applyTiffProfile(image) {
  if (!image.icc?.length) return image;
  const cms = await instantiate({ locateFile: name => new URL(`../vendor/${name}`, import.meta.url).href });
  let input, output, transform;
  try {
    input = cms.cmsOpenProfileFromMem(image.icc, image.icc.length);
    if (!input) throw new Error('TIFF 색상 프로파일을 읽을 수 없습니다. sRGB로 변환한 PNG 또는 JPG를 사용해 주세요.');
    const space = cms.cmsGetColorSpaceASCII(input);
    if (space !== image.colorModel || !['RGB', 'GRAY', 'CMYK'].includes(space)) throw new Error('TIFF 픽셀과 색상 프로파일이 맞지 않습니다. sRGB로 변환한 PNG 또는 JPG를 사용해 주세요.');
    output = cms.cmsCreate_sRGBProfile();
    transform = cms.cmsCreateTransform(input, space === 'RGB' ? TYPE_RGBA_8 : space === 'GRAY' ? TYPE_GRAY_8 : TYPE_CMYK_8, output, space === 'RGB' ? TYPE_RGBA_8 : TYPE_RGB_8, INTENT_RELATIVE_COLORIMETRIC, space === 'RGB' ? cmsFLAGS_COPY_ALPHA : 0);
    if (!transform) throw new Error('TIFF 색상 변환에 실패했습니다. sRGB로 변환한 PNG 또는 JPG를 사용해 주세요.');
    // Bound WASM memory use rather than copying the entire original into its heap.
    for (let start = 0; start < image.width * image.height; start += 65536) {
      const count = Math.min(65536, image.width * image.height - start);
      let pixels = image.rgba.subarray(start * 4, (start + count) * 4);
      if (space !== 'RGB') {
        pixels = new Uint8Array(count * (space === 'CMYK' ? 4 : 1));
        for (let i = 0; i < count; i++) {
          if (space === 'GRAY') pixels[i] = image.rgba[(start + i) * 4];
          else pixels.set(image.cmyk.subarray((start + i) * image.samples, (start + i) * image.samples + 4), i * 4);
        }
      }
      const converted = cms.cmsDoTransform(transform, pixels, count);
      if (space === 'RGB') image.rgba.set(converted, start * 4);
      else for (let i = 0; i < count; i++) image.rgba.set(converted.subarray(i * 3, i * 3 + 3), (start + i) * 4);
    }
    delete image.icc; delete image.cmyk; delete image.samples; delete image.colorModel;
    return image;
  } finally {
    if (transform) cms.cmsDeleteTransform(transform);
    if (output) cms.cmsCloseProfile(output);
    if (input) cms.cmsCloseProfile(input);
  }
}
