import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { HttpError } from '../server/validation.js';
import { isAssetPath } from '../src/media.js';

export function database(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL('../migrations/0001_auth.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_public_content.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      return { bind(...args) { return { first: async () => statement.get(...args), run: async () => statement.run(...args) }; } };
    },
    close: () => db.close()
  };
}
export function localRepository(root) {
  const path = resolve(root, 'public/content/site.json');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  return {
    async get() { const bytes = readFileSync(path); return { data: JSON.parse(bytes), sha: sha(bytes) }; },
    async save(data, previous) {
      // Synchronous read/check/rename keeps local writes atomic within this process.
      const bytes = readFileSync(path);
      if (sha(bytes) !== previous) throw new HttpError(409, '다른 변경사항과 충돌했습니다. 작성한 내용을 따로 보관한 뒤 새로고침해 주세요.');
      const text = JSON.stringify(data, null, 2) + '\n'; writeFileSync(`${path}.tmp`, text); renameSync(`${path}.tmp`, path); return { sha: sha(text) };
    },
    async upload(assetPath, bytes) {
      if (!isAssetPath(assetPath) && !isAssetPath(assetPath, true)) throw new HttpError(400, '파일 경로가 올바르지 않습니다.');
      const target = resolve(root, 'public', assetPath); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: 'wx' });
    }
  };
}
