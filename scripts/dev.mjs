import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import worker from '../server/worker.js';
import { database, localRepository } from './local-adapters.mjs';
import { publicRootFiles } from './public-pages.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), port = 4173;
await mkdir(resolve(root, '.local'), { recursive: true });
const db = database(resolve(root, '.local/auth.sqlite'));
const origin = `http://127.0.0.1:${port}`;
const env = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, SITE_ORIGIN: origin, DB: db, LOCAL_REPOSITORY: localRepository(root) };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403); res.end('Use 127.0.0.1:4173'); return; }
    const url = new URL(req.url, origin);
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      // Never trust an incoming IP header in the local adapter.
      headers.set('CF-Connecting-IP', '127.0.0.1');
      const request = new Request(url, { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      const response = await worker.fetch(request, env); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let path = decodeURIComponent(url.pathname);
    if (path === '/admin') { res.writeHead(302, { Location: '/admin/' }); res.end(); return; }
    if (path.endsWith('/')) path += 'index.html';
    let target;
    if (publicRootFiles.has(path.slice(1)) || path === '/admin/index.html' || /^\/src\/[a-z.-]+\.(js|css)$/.test(path)) target = resolve(root, `.${path}`);
    else target = resolve(root, 'public', `.${path}`);
    const actual = await realpath(target);
    const publicRoot = resolve(root, 'public') + sep;
    const allowed = actual.startsWith(publicRoot) || [...publicRootFiles].some(file => actual === resolve(root, file)) || actual === resolve(root, 'admin/index.html') || actual.startsWith(resolve(root, 'src') + sep);
    if (!allowed || path.split('/').some(p => p.startsWith('.') && p !== '.nojekyll') || !(await stat(actual)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[extname(actual)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(actual));
  } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end('Unable to serve request'); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Local: ${origin}/`); console.log(`Admin: ${origin}/admin/`);
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16) console.log('Set ADMIN_PASSWORD (16+ characters) in .env, then restart to enable login.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
