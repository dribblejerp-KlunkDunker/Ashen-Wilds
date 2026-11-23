// node test/bestiary32.test.js --no-browser
// Phase 32 against the book's seventeen entries, senses and exact distances, and its page in the warning book.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'js', 'bestiary32.js'));
let fails = 0; const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const names = B.ROWS.map((r) => r.name).join(', ');
check(B.ROWS.length === 17 && new Set(B.ROWS.map((r) => r.id)).size === 17, 'seventeen distinct entries');
check(names === 'Goblin, Ork, Blackfen Ogre, Blind Quarry-Troll, The Roofed Mile animal (the gallery-crawler), Greymaw, Peat-boar, Gallows Heron, Harrow eel, Bloodwick, Ash-rat, Rustling, Ash-moth, The Ashbound, Corpse-cap, Walking bloom (Ash-Spore Husk), What the orks fled', 'the book\'s seventeen, in its order');
check(B.byId('quarry_troll').hearing === 'acute' && B.trollHearing().includes('walk 6 m') && B.trollHearing().includes('clang 16 m') && B.trollHearing().includes('stone about half'), 'the troll keeps the exact noise table');
check(B.byId('walking_bloom').sight === 'poor' && B.bloomHearing().includes('about 8 m') && B.bloomHearing().includes('fire burns spores'), 'the bloom sees 8 m and hears a sprint or swing at 8 m');
check(B.byId('goblin').hearing === 'keen' && B.byId('ogre').hearing === 'fair' && B.byId('bloodwick').hearing === 'poor', 'the other entries keep their ratings, not invented distances');
check(B.byId('what_orks_fled').hearing === 'said to be acute' && B.byId('corpse_cap').hearing === '-', 'the unknown and the growth say so');
check(!B.byId('unnamed') && !B.byId('hulk_conger'), 'the Unnamed and the wider-world hulk-conger are not among the seventeen');
const src = fs.readFileSync(path.join(ROOT, 'js', 'bestiary32.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');

// ---- the page in the warning book
const pageHtml = B.page();
check((pageHtml.match(/data-beast=/g) || []).length === 17 && B.ROWS.every((r) => pageHtml.includes(r.name)), 'the page lists all seventeen, in the book order');
check(pageHtml.includes('walk 6 m') && pageHtml.includes('about 8 m') && pageHtml.includes('bestiary-back') && pageHtml.includes('bestiary-close'), 'the page carries the troll and bloom distances and both ways back');
check(/renderLog/.test(src) && /bestiary-open/.test(src) && /data-beast/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(pageHtml), 'the page is wired into the warning book and plain ASCII');

// ---- in a browser: the book offers The beasts, the page opens, and Back returns. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      G.state = 'play'; renderLog();
      out.book = { rows: document.querySelectorAll('[data-book]').length, open: !!document.getElementById('bestiary-open') };
      document.getElementById('bestiary-open').click();
      out.page = { rows: document.querySelectorAll('[data-beast]').length, text: document.querySelector('#modal-panel').textContent, back: !!document.getElementById('bestiary-back'), close: !!document.getElementById('bestiary-close') };
      document.getElementById('bestiary-back').click();
      out.back = { rows: document.querySelectorAll('[data-book]').length, search: !!document.getElementById('book-search'), open: !!document.getElementById('bestiary-open') };
      return out;
    });
    check(r.book.rows === 30 && r.book.open, 'the warning book offers The beasts');
    check(r.page.rows === 17 && /Walking bloom/.test(r.page.text) && /about 8 m/.test(r.page.text) && /walk 6 m/.test(r.page.text) && r.page.back && r.page.close, 'the page lists all seventeen and the exact troll and bloom distances');
    check(r.back.rows === 30 && r.back.search && r.back.open, 'Back returns to the warning book');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
