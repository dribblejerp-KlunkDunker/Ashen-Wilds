#!/usr/bin/env node
// Writes the app icons in assets/icons/ from the game's own mark, the coal sun (ART2.mark in js/art2.js).
// Every pixel is made in code; each icon is the small picture enlarged a whole number of times.
//   node tools/icons.js            write them        node tools/icons.js --check    fail if any is out of date
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), ART2 = require(path.join(ROOT, 'js', 'art2.js')), PNG = require('./png.js');
const ICONS = [['icon-192.png', 64, 3], ['icon-512.png', 64, 8], ['icon-maskable-512.png', 64, 8], ['apple-touch-icon.png', 60, 3]];
let stale = 0;
for (const [name, n, k] of ICONS) {
  const buf = PNG.encode(n, n, ART2.mark(n), { scale: k }), file = path.join(ROOT, 'assets', 'icons', name);
  if (process.argv.includes('--check')) { if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) { stale++; console.log('out of date: assets/icons/' + name); } }
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); console.log('wrote assets/icons/' + name + ' (' + n * k + ' x ' + n * k + ')'); }
}
if (process.argv.includes('--check')) { console.log(stale ? stale + ' icons out of date: run node tools/icons.js' : 'icons are current'); process.exit(stale ? 1 : 0); }
