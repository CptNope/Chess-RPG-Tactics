// Post-build smoke test: every asset referenced by dist/index.html must exist.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
if (refs.length === 0) {
  console.error('No ./assets references found in dist/index.html');
  process.exit(1);
}
const missing = refs.filter((r) => !fs.existsSync(path.join(dist, r)));
if (missing.length) {
  console.error('Missing build assets:', missing);
  process.exit(1);
}
console.log(`dist OK: ${refs.length} assets referenced and present.`);

// The offline service worker must list only files that exist in this build
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const pre = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const gone = pre.filter((f) => f !== './' && !fs.existsSync(path.join(dist, f)));
if (gone.length) {
  console.error('sw.js precaches missing files:', gone);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
const icons = manifest.icons.filter((i) => !fs.existsSync(path.join(dist, i.src)));
if (icons.length) {
  console.error('manifest icons missing:', icons.map((i) => i.src));
  process.exit(1);
}
console.log(`sw OK: ${pre.length} files precached; manifest OK: ${manifest.icons.length} icons.`);
