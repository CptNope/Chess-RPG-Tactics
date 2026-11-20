// Packages dist/ as an itch.io HTML5 upload: release/chess-rpg-tactics-<version>-html5.zip
// with index.html at the root. Checks the things that break games inside itch's iframe first.
import { readFileSync, readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html is missing: run `npm run build` first.');
  process.exit(1);
}
walk(dist);

// itch.io limits: 1,000 files and 500 MB extracted (per HTML5 upload); single file names must be ASCII
const total = files.reduce((n, f) => n + statSync(f).size, 0);
if (files.length > 1000) problems.push(`${files.length} files (itch allows 1000)`);
if (total > 500 * 1024 * 1024) problems.push(`${(total / 1048576).toFixed(1)} MB (itch allows 500 MB)`);
for (const f of files) if (/[^\x20-\x7e]/.test(relative(dist, f))) problems.push(`non-ASCII file name: ${relative(dist, f)}`);

// Absolute paths ("/assets/...") break on itch's per-upload subfolder; remote fonts and scripts
// fail offline and in the itch app
const html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const url = m[1];
  if (url.startsWith('/') && !url.startsWith('//')) problems.push(`absolute path in index.html: ${url}`);
  if (/^(https?:)?\/\//.test(url) && !/<a\b[^>]*href="[^"]*$/.test(html.slice(0, m.index + m[0].length))) {
    // links (<a href>) to other sites are fine; anything the page loads is not
    const tag = html.lastIndexOf('<', m.index);
    if (!html.slice(tag, tag + 3).startsWith('<a')) problems.push(`external resource in index.html: ${url}`);
  }
}
for (const f of files.filter((f) => f.endsWith('.css'))) {
  if (/url\((["']?)(https?:)?\/\//.test(readFileSync(f, 'utf8'))) problems.push(`external url() in ${relative(dist, f)}`);
}

if (problems.length) {
  console.error('Not packaged:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const zip = join(outDir, `chess-rpg-tactics-${version}-html5.zip`);
rmSync(zip, { force: true });
// -X: no extra file attributes, -r: recurse; run inside dist so index.html is at the zip root
execFileSync('zip', ['-qrX', zip, '.'], { cwd: dist });
console.log(`${relative(root, zip)}: ${files.length} files, ${(total / 1024).toFixed(0)} KB unpacked, ${(statSync(zip).size / 1024).toFixed(0)} KB zipped`);
