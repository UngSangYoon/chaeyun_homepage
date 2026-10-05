import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for (const dir of ['src', 'server', 'scripts']) {
  for (const file of await readdir(new URL(`../${dir}/`, import.meta.url))) if (/\.(js|mjs)$/.test(file)) execFileSync(process.execPath, ['--check', `${dir}/${file}`], { stdio: 'inherit' });
}
console.log('JavaScript syntax checked.');
