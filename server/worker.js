import { HttpError, validateContent, identifyUpload } from './validation.js';
import { MAX_UPLOAD_BYTES } from '../src/media.js';

const encoder = new TextEncoder();
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value))].map(n => n.toString(16).padStart(2, '0')).join('');
}
function equal(a, b) { let mismatch = a.length ^ b.length; for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return mismatch === 0; }
export function base64(bytes) { let str = ''; for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(str); }
function unbase64(value) { return Uint8Array.from(atob(value.replace(/\s/g, '')), char => char.charCodeAt(0)); }
async function readBody(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, '요청 크기가 너무 큽니다.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); let length = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw new HttpError(413, '요청 크기가 너무 큽니다.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; } return bytes;
}
async function json(request, limit = 900000) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new HttpError(415, 'JSON 형식으로 요청해 주세요.');
  const bytes = await readBody(request, limit);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new HttpError(400, 'JSON 형식이 올바르지 않습니다.'); }
}
export class GithubRepository {
  constructor(env) { this.env = env; }
  async call(path, options = {}) {
    const env = this.env;
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) throw new HttpError(503, '저장소 연결이 설정되지 않았습니다.');
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${path}${options.method ? '' : `?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'chaeyun-studio', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000)
    });
    if (response.status === 409 || response.status === 422) throw new HttpError(409, '다른 변경사항과 충돌했습니다. 작성한 내용을 따로 보관한 뒤 새로고침하여 최신 내용을 불러와 주세요.');
    if (!response.ok) throw new HttpError(502, 'GitHub 저장에 실패했습니다. 저장소 권한, 토큰 만료, 요청 한도를 확인해 주세요.');
    return response.json();
  }
  async get() {
    const result = await this.call('public/content/site.json');
    return { data: JSON.parse(new TextDecoder().decode(unbase64(result.content))), sha: result.sha };
  }
  async save(data, sha) {
    const result = await this.call('public/content/site.json', { method: 'PUT', body: JSON.stringify({ message: 'content: update artist website', content: base64(encoder.encode(JSON.stringify(data, null, 2) + '\n')), sha, branch: this.env.GITHUB_BRANCH || 'main' }) });
    return { sha: result.content.sha };
  }
  async upload(path, bytes) {
    await this.call(`public/${path}`, { method: 'PUT', body: JSON.stringify({ message: 'media: add artist upload', content: base64(bytes), branch: this.env.GITHUB_BRANCH || 'main' }) });
  }
}
async function rateLimit(env, ip, now) {
  for (const [key, max] of [[await digest(ip), 10], ['global', 60]]) {
    const result = await env.DB.prepare(`INSERT INTO login_attempts (key, count, expires) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires <= ? THEN 1 ELSE count + 1 END,
      expires = CASE WHEN expires <= ? THEN excluded.expires ELSE expires END RETURNING count`).bind(key, now + 900, now, now).first();
    if (result.count > max) throw new HttpError(429, '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
  }
}
async function authorized(request, env, now) {
  const header = request.headers.get('Authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(header)) throw new HttpError(401, '로그인이 필요합니다.');
  const hash = await digest(header.slice(7));
  const row = await env.DB.prepare('SELECT expires, password_version FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!row || row.expires <= now || row.password_version !== await digest(env.ADMIN_PASSWORD)) throw new HttpError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  return hash;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    // Same-origin browser GET requests may omit Origin. They still require a
    // valid Bearer session below; writes and cross-origin reads require Origin.
    const sameOriginRead = origin === null && request.method === 'GET'
      && new URL(request.url).origin === env.SITE_ORIGIN;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (!env.SITE_ORIGIN || (origin !== env.SITE_ORIGIN && !sameOriginRead)) return reply({ error: '허용되지 않은 요청 출처입니다.' }, 403);
    headers['Access-Control-Allow-Origin'] = env.SITE_ORIGIN;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 || !env.DB) throw new HttpError(503, '관리자 비밀번호(16자 이상)와 인증 저장소 설정이 필요합니다.');
      const now = Math.floor(Date.now() / 1000), path = new URL(request.url).pathname.replace(/^\/api/, '');
      if (path === '/login' && request.method === 'POST') {
        await rateLimit(env, request.headers.get('CF-Connecting-IP') || 'local', now);
        const body = await json(request, 2048);
        if (!body || typeof body.password !== 'string' || body.password.length > 256 || !equal(await digest(body.password), await digest(env.ADMIN_PASSWORD))) throw new HttpError(401, '비밀번호가 올바르지 않습니다.');
        const token = base64(crypto.getRandomValues(new Uint8Array(32))); // Only the hash is stored server-side.
        const bearer = await digest(token);
        await env.DB.prepare('DELETE FROM sessions WHERE expires <= ?').bind(now).run();
        await env.DB.prepare('DELETE FROM login_attempts WHERE expires <= ?').bind(now - 86400).run();
        await env.DB.prepare('INSERT INTO sessions (token_hash, expires, password_version) VALUES (?, ?, ?)').bind(await digest(bearer), now + 28800, await digest(env.ADMIN_PASSWORD)).run();
        return reply({ token: bearer, expires: now + 28800 });
      }
      const session = await authorized(request, env, now);
      if (path === '/logout' && request.method === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session).run(); return reply({ ok: true }); }
      const repository = env.LOCAL_REPOSITORY || new GithubRepository(env);
      if (path === '/content' && request.method === 'GET') return reply(await repository.get());
      if (path === '/content' && request.method === 'PUT') {
        const body = await json(request);
        if (!body || typeof body.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(body.sha)) throw new HttpError(400, '문서 버전이 올바르지 않습니다. 새로고침해 주세요.');
        const data = validateContent(body.data, { requireExhibitionCovers: true });
        return reply(await repository.save(data, body.sha));
      }
      if (path === '/upload' && request.method === 'POST') {
        const bytes = await readBody(request, MAX_UPLOAD_BYTES);
        const extension = identifyUpload(bytes, request.headers.get('Content-Type'));
        const path = `uploads/${crypto.randomUUID()}.${extension}`;
        await repository.upload(path, bytes); return reply({ path }, 201);
      }
      throw new HttpError(404, '요청한 기능을 찾을 수 없습니다.');
    } catch (error) {
      return reply({ error: error instanceof HttpError ? error.message : '서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, error instanceof HttpError ? error.status : 500);
    }
  }
};
