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
