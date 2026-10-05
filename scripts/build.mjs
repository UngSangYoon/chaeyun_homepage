import { fileURLToPath } from 'node:url';
import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateContent } from '../server/validation.js';
import { publicPages, publicRootFiles } from './public-pages.mjs';
import { exhibitionPhotos } from '../src/exhibitions.js';

const root = fileURLToPath(new URL('..', import.meta.url)), dist = resolve(root, 'dist');
const content = validateContent(JSON.parse(await readFile(resolve(root, 'public/content/site.json'), 'utf8')));
for (const path of [content.profile.portrait, content.profile.cvFile, ...content.works.map(w => w.image), ...content.exhibitions.flatMap(exhibition => exhibitionPhotos(exhibition).map(photo => photo.image))].filter(Boolean)) await readFile(resolve(root, 'public', path));
const apiUrl = process.env.ADMIN_API_URL || '';
if (apiUrl && (!apiUrl.startsWith('https://') || new URL(apiUrl).origin === 'null' || new URL(apiUrl).username || new URL(apiUrl).password || new URL(apiUrl).search || new URL(apiUrl).hash)) throw new Error('ADMIN_API_URL must be a public HTTPS API URL without credentials, query, or fragment.');
await rm(dist, { recursive: true, force: true }); await mkdir(dist);
// Only public files enter the Pages artifact. Server code and .env never do.
await cp(resolve(root, 'public'), dist, { recursive: true, filter: source => !source.split('/').some(part => part.startsWith('.') && part !== '.nojekyll') });
await writeFile(resolve(dist, 'content/site.json'), JSON.stringify(content, null, 2) + '\n');
for (const file of [...publicRootFiles, 'admin', 'src']) await cp(resolve(root, file), resolve(dist, file), { recursive: true });
await writeFile(resolve(dist, 'config.js'), `export const API_URL = ${JSON.stringify(apiUrl)};\n`);
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const [file, label] of Object.entries(publicPages)) {
  const title = escape([label, content.profile.englishName].filter(Boolean).join(' · '));
  let html = await readFile(resolve(dist, file), 'utf8');
  html = html.replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*/, (_, prefix) => `${prefix}${title}`);
  await writeFile(resolve(dist, file), html);
}
console.log('Built dist/ for GitHub Pages. No private environment values are included.');
