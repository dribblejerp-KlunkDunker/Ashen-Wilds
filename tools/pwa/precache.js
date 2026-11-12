#!/usr/bin/env node
'use strict';
// Phase 18 PWA: derive the offline file lists from what the game really loads, and write them into sw.js.
//   node tools/pwa/precache.js                 rewrite the generated block of sw.js (idempotent)
//   node tools/pwa/precache.js --check         exit 1 if sw.js is out of date (no write)
//   node tools/pwa/precache.js --stage <dir>   copy exactly the served files into <dir> (for GitHub Pages)
//   node tools/pwa/precache.js --list          print the lists
//
// CORE  = everything needed to start and play offline: index.html and every file it references (scripts and styles
//         keep their ?v= tags, so the cached URL is the URL the page asks for), the manifest and icons, every file
//         the stylesheets name (fonts), and the runtime folders img/, fonts/, locales/ (portraits, paintings,
//         translations). Installed with the service worker; the install fails (and the old version keeps running)
//         if any of it cannot be fetched.
// MEDIA = music/ and voices/ (about 53 MB of MP3). Not fetched at install: cached the first time the game plays
//         them, or all at once from Options > "Download the audio for offline play".
// BUILD = a hash over CORE contents and the MEDIA names and sizes. Any change gives sw.js new bytes, which is what
//         makes a browser install the new version.
// No dependencies: node's fs and crypto only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// PRECACHE_ROOT lets the test point the tool at a scratch copy of the site
const ROOT = process.env.PRECACHE_ROOT ? path.resolve(process.env.PRECACHE_ROOT) : path.resolve(__dirname, '..', '..');
const BEGIN = '// <precache:begin>', END = '// <precache:end>';

// What counts as a runtime file in each folder. Anything else (READMEs, licence texts, build scripts, scripts' json,
// .keep) is development material and is not served from the offline cache.
const CORE_DIRS = { img: /\.(jpg|jpeg|png|webp|svg)$/i, fonts: /\.(woff2?|ttf|otf)$/i, locales: /\.json$/i, css: /\.css$/i, js: /\.js$/i, 'assets/icons': /\.(png|svg)$/i };
const MEDIA_DIRS = { music: /\.(mp3|ogg|m4a|wav)$/i, voices: /\.(mp3|ogg|m4a|wav)$/i };
const ROOT_FILES = ['manifest.webmanifest'];
const STAGE_EXTRA = [/^fonts\/OFL-.*\.txt$/, /^\.nojekyll$/];

function walk(dir, re, out) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, re, out);
    else if (e.isFile() && re.test(e.name)) out.push(rel);
  }
  return out;
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isLocal = (u) => u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);

// every local src= / href= in index.html, query kept (this is how the page asks for it)
function indexRefs(html) {
  const refs = [];
  const re = /<(script|link|img|source|audio|video)\b[^>]*?\b(src|href)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(html))) if (isLocal(m[3])) refs.push(m[3]);
  return refs;
}
// url(...) in a stylesheet, resolved against the stylesheet's own folder
function cssRefs(file) {
  const css = fs.readFileSync(path.join(ROOT, file), 'utf8'), out = [];
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let m;
  while ((m = re.exec(css))) if (isLocal(m[1]) && !/^data:/i.test(m[1])) out.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1].split('?')[0].split('#')[0])));
  return out;
}

function buildLists() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const withQuery = new Map();                        // bare path -> the exact string index.html uses
  const problems = [];
  for (const r of indexRefs(html)) withQuery.set(r.split('?')[0].split('#')[0], r);
  for (const [p] of withQuery) if (!fs.existsSync(path.join(ROOT, p))) problems.push('index.html references a missing file: ' + p);

  const core = new Set(['index.html']);
  for (const p of ROOT_FILES) if (fs.existsSync(path.join(ROOT, p))) core.add(p);
  for (const [p] of withQuery) core.add(p);
  for (const p of [...core]) if (p.endsWith('.css')) for (const u of cssRefs(p)) { core.add(u); if (!fs.existsSync(path.join(ROOT, u))) problems.push(p + ' references a missing file: ' + u); }
  for (const [dir, re] of Object.entries(CORE_DIRS)) for (const f of walk(dir, re, [])) core.add(f);
  const media = [];
  for (const [dir, re] of Object.entries(MEDIA_DIRS)) walk(dir, re, media);

  const coreList = [...core].sort().map((p) => withQuery.get(p) || p);
  // index.html first, so the shell is the first thing a half-finished install would have
  coreList.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a < b ? -1 : 1));
  if (problems.length) return { core: coreList, media, build: '', mediaBuild: '', mediaBytes: 0, problems };
  const h = crypto.createHash('sha256');
  for (const e of coreList) h.update(e + '\0').update(sha(fs.readFileSync(path.join(ROOT, e.split('?')[0]))) + '\n');
  const mh = crypto.createHash('sha256');
  for (const f of media) mh.update(f + '\0' + fs.statSync(path.join(ROOT, f)).size + '\n');
  const mediaBytes = media.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
  return { core: coreList, media, build: h.digest('hex').slice(0, 12), mediaBuild: mh.digest('hex').slice(0, 12), mediaBytes, problems };
}

const arr = (a) => '[\n' + a.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]';
function block(L) {
  return [BEGIN,
    '// Generated by tools/pwa/precache.js from index.html and the asset folders. Do not edit by hand; run the tool.',
    'const BUILD = ' + JSON.stringify(L.build) + ';',
    'const MEDIA_BUILD = ' + JSON.stringify(L.mediaBuild) + ';',
    'const MEDIA_BYTES = ' + L.mediaBytes + ';',
    'const CORE = ' + arr(L.core) + ';',
    'const MEDIA = ' + arr(L.media) + ';',
    END].join('\n');
}
function render(src, L) {
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error('sw.js has no generated block markers');
  return src.slice(0, a) + block(L) + src.slice(b + END.length);
}

function stage(L, dest) {
  const out = path.resolve(dest);
  if (out === ROOT || ROOT.startsWith(out + path.sep)) throw new Error('refusing to stage into the repository root or above it');
  fs.rmSync(out, { recursive: true, force: true });
  const files = new Set(['sw.js', ...L.core.map((e) => e.split('?')[0]), ...L.media]);
  for (const re of STAGE_EXTRA) for (const d of ['', 'fonts']) { const dir = path.join(ROOT, d); if (fs.existsSync(dir)) for (const n of fs.readdirSync(dir)) { const rel = d ? d + '/' + n : n; if (re.test(rel) && fs.statSync(path.join(ROOT, rel)).isFile()) files.add(rel); } }
  for (const f of files) { const to = path.join(out, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), to); }
  return files.size;
}

module.exports = { buildLists, render, block, indexRefs, cssRefs, ROOT, CORE_DIRS, MEDIA_DIRS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const L = buildLists();
  if (L.problems.length) { console.error(L.problems.join('\n')); process.exit(2); }
  const swPath = path.join(ROOT, 'sw.js');
  if (args.includes('--list')) { console.log(JSON.stringify({ build: L.build, core: L.core, media: L.media.length }, null, 1)); process.exit(0); }
  const cur = fs.readFileSync(swPath, 'utf8'), next = render(cur, L);
  if (args.includes('--check')) { if (cur !== next) { console.error('sw.js is out of date: run node tools/pwa/precache.js'); process.exit(1); } console.log('sw.js is current (' + L.build + ')'); process.exit(0); }
  if (cur !== next) fs.writeFileSync(swPath, next);
  console.log((cur !== next ? 'wrote' : 'unchanged') + ' sw.js: build ' + L.build + ', ' + L.core.length + ' core files, ' + L.media.length + ' media files (' + Math.round(L.mediaBytes / 1048576) + ' MB)');
  const si = args.indexOf('--stage');
  if (si >= 0) { if (!args[si + 1]) { console.error('--stage needs a folder'); process.exit(2); } console.log('staged ' + stage(L, args[si + 1]) + ' files into ' + args[si + 1]); }
}
