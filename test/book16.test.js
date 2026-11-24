// node test/book16.test.js --no-browser
// Phase 16, the warning book: thirty entries exported from the Markdown, read marks, search, and the witness field.
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process'), ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'js', 'book16.js'));
const T = require(path.join(ROOT, 'tools', 'book.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the data
const md = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-warning-book-s30.md'), 'utf8');
const parsed = T.parse(md);
check(B.count === 30 && B.ENTRIES.length === 30, 'the book has thirty entries');
check(parsed.length === 30 && parsed.every((e, i) => e.n === i + 1), 'the Markdown has thirty numbered sections');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
check(B.ENTRIES.every((e, i) => e.title === parsed[i].title && norm(e.text) === norm(parsed[i].text)), 'every title and body matches the Markdown after whitespace normalisation');
check(B.byN(30) && /R\. Sedley/.test(B.byN(30).text) && B.byN(30).hand === 'Rafe Sedley', 'entry 30 carries Rafe Sedley\'s name');
check(B.ENTRIES.every((e) => Array.isArray(e.witnesses) && e.witnesses.length === 0), 'every entry starts with an empty witness field');
check(B.ENTRIES.every((e) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(e.title + e.text)), 'every entry is plain ASCII');
check(B.ENTRIES.every((e) => !/Octave|sovereign|\bsov\b|respawn|soul|level/i.test(e.title + ' ' + e.text)), 'no entry uses an Octave or game-outside word');

// ---- search and read marks
check(B.find('lime').some((e) => e.n === 10), 'searching for "lime" finds the lime entry');
check(B.find('THAW').some((e) => e.n === 30), 'search is case-insensitive');
check(B.find('').length === 30, 'an empty search shows the whole book');
global.G = { flags: {} };
check(B.read(1) && B.isRead(1) && !B.isRead(2), 'a read entry is marked, an unread one is not');
check(B.read(30) && B.isRead(30), 'the last entry can be read');
delete global.G;

// ---- the exporter
const run = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'book.js'), '--check'], { encoding: 'utf8' });
check(run.status === 0 && /is current/.test(run.stdout), 'node tools/book.js --check is clean');

// ---- the panel
const panel = fs.readFileSync(path.join(ROOT, 'js', 'panel10.js'), 'utf8');
check(/BOOK16/.test(panel) && /book-search/.test(panel) && /data-book/.test(panel), 'BOOK lists the book and has a search field');
check(/The errand\./.test(panel), 'the errand is still reachable above the list');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check(/js\/book16\.js/.test(html) && html.indexOf('js/book16.js') < html.indexOf('js/panel10.js'), 'the page loads the book before the panel');

// ---- in a browser: open entry 1 and 30, search for lime, keep the marks. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      advanceTime(2600);   // Phase 11: the errand is written once the Slagcrown has been looked at for two seconds
      G.state = 'play'; renderLog();
      out.list = { count: document.querySelectorAll('[data-book]').length, errand: document.querySelector('#modal-panel').innerText.includes('The errand.') };
      document.querySelector('[data-book="1"]').click();
      out.one = { text: document.querySelector('#modal-panel').innerText, read: BOOK16.isRead(1) };
      document.getElementById('book-back').click();
      document.querySelector('[data-book="30"]').click();
      out.thirty = document.querySelector('#modal-panel').innerText;
      document.getElementById('book-back').click();
      const input = document.getElementById('book-search'); input.value = 'lime'; input.dispatchEvent(new Event('input'));
      out.search = [...document.querySelectorAll('[data-book]')].map((b) => +b.dataset.book);
      return out;
    });
    check(r.list.count === 30 && r.list.errand, 'BOOK opens on thirty entries and keeps the errand');
    check(/The Outside Fire/.test(r.one.text) && r.one.read, 'entry 1 opens and is marked read');
    check(/The Thaw/.test(r.thirty) && /Rafe Sedley/.test(r.thirty), 'entry 30 opens with Rafe Sedley\'s hand');
    check(r.search.includes(10) && r.search.includes(5), 'the search box filters without losing the book');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
