import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
try {
  await writeFile(new URL('../.env', import.meta.url), `# Local-only password. Replace with your own 16+ character password if desired.\n# Ignored by Git; never copied to dist/.\nADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\nADMIN_API_URL=\n`, { flag: 'wx', mode: 0o600 });
  console.log('Created private .env with a random local admin password. Open .env to view or change it.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; your settings were preserved.');
}
