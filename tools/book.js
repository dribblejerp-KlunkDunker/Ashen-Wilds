// node tools/book.js --write   parse docs/worldbuilding/the-warning-book-s30.md into js/book16.js
// node tools/book.js --check   exit non-zero if the generated file has drifted from the Markdown
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MD = path.join(ROOT, 'docs', 'worldbuilding', 'the-warning-book-s30.md');
const OUT = path.join(ROOT, 'js', 'book16.js');

function parse(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let cur = null, fenced = false, block = [];
  const flush = () => {
    if (!cur) return;
    cur.text = block.join('\n').replace(/[ \t]+$/gm, '').trim();
    entries.push(cur); cur = null; block = [];
  };
  for (const line of lines) {
    const h = /^### (\d+)\. (.+)$/.exec(line);
    if (h) { flush(); cur = { n: +h[1], title: h[2].trim(), text: '', witnesses: [] }; continue; }
    if (!cur) continue;
    if (line === '```text') { fenced = true; continue; }
    if (fenced && line === '```') { fenced = false; continue; }
    if (fenced) block.push(line);
  }
  flush();
  const last = entries.find((e) => e.n === 30);
  if (last && /R\. Sedley/.test(last.text)) last.hand = 'Rafe Sedley';
  return entries.sort((a, b) => a.n - b.n);
}
function source(entries) {
  return `// ============================================================\n` +
    `//  book16 - Phase 16, the warning book (winter of S.30), GENERATED from\n` +
    `//  docs/worldbuilding/the-warning-book-s30.md by tools/book.js. Do not edit by hand.\n` +
    `//  Thirty entries, plain ASCII, each with an empty witness list for Phase 25.\n` +
    `// ============================================================\n` +
    `'use strict';\n\nconst BOOK16 = (() => {\n` +
    `  const ENTRIES = ${JSON.stringify(entries, null, 2)};\n` +
    `  const TX = { title: 'The warning book', one: 'One witness. A rumour.', two: 'Two witnesses. An entry.', none: 'The book is blank.', search: 'Search the book' };\n` +
    `  const byN = (n) => ENTRIES.find((e) => e.n === n) || null;\n` +
    `  const find = (q) => { const s = String(q || '').toLowerCase().trim(); return !s ? ENTRIES.slice() : ENTRIES.filter((e) => (e.title + ' ' + e.text).toLowerCase().includes(s)); };\n` +
    `  const read = (n) => { try { if (typeof G === 'undefined' || !G || !G.flags) return false; const r = G.flags.la_book_read || (G.flags.la_book_read = {}); r[n] = true; return true; } catch (e) { return false; } };\n` +
    `  const isRead = (n) => { try { return !!(G && G.flags && G.flags.la_book_read && G.flags.la_book_read[n]); } catch (e) { return false; } };\n` +
    `  return { ENTRIES, TX, byN, find, read, isRead, count: ENTRIES.length };\n` +
    `})();\n` +
    `if (typeof module !== 'undefined' && module.exports) module.exports = BOOK16;\n`;
}
function build() { return source(parse(fs.readFileSync(MD, 'utf8'))); }
if (require.main === module) {
  const check = process.argv.includes('--check');
  const text = build();
  if (check) {
    let old = ''; try { old = fs.readFileSync(OUT, 'utf8'); } catch (e) { console.error('book16.js is missing: run node tools/book.js --write'); process.exit(1); }
    if (old !== text) { console.error('book16.js is out of date: run node tools/book.js --write'); process.exit(1); }
    console.log('book16.js is current (' + parse(fs.readFileSync(MD, 'utf8')).length + ' entries)');
  } else if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT, text);
    console.log('wrote js/book16.js (' + parse(fs.readFileSync(MD, 'utf8')).length + ' entries)');
  } else {
    console.log('usage: node tools/book.js --write | --check');
    process.exit(1);
  }
}
module.exports = { parse, source, build };
