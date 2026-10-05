// Shared by browser code, server validation and the local repository adapter.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isAssetPath(value, pdf = false) {
  return typeof value === 'string' && (pdf
    ? /^uploads\/[\w-]+\.pdf$/.test(value)
    : /^uploads\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(value));
}
