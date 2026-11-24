// node test/account14.test.js --no-browser
// Phase 14, the Account: a promise under a name, a break that is forsworn forever, surety and standing apart,
// three pages, a versioned save, and an overlay that does not stop the world.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const A = require(path.join(ROOT, 'js', 'account14.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the first promise
let c = A.make();
let e = A.add(c, { kind: 'promise', text: A.TX.promiseText, person: 'The deserter', due: 0 });
check(e && e.id === 'a1' && c.entries.length === 1, 'a promise is entered under a name');
check(A.due(c, 0).length === 1 && A.due(c, -1).length === 0, 'a promise falls due on its day, not before');
check(A.mark(c, 0).length === 1 && e.marked === 0, 'the hearth marks what fell due');
check(A.keep(c, e.id) && e.state === 'kept' && !A.forsworn(c, 'The deserter'), 'a kept promise does not make a person forsworn');
check(c.entries.length === 1, 'keeping deletes nothing');

c = A.make();
e = A.add(c, { kind: 'promise', text: A.TX.promiseText, person: 'The deserter', due: 0 });
check(A.break(c, e.id) && e.state === 'broken' && A.forsworn(c, 'The deserter'), 'a break marks the person forsworn');
const round = A.load(JSON.parse(JSON.stringify(c)));
check(A.forsworn(round, 'The deserter') && round.entries[0].state === 'broken', 'the forsworn mark survives a save, and so does the entry');
check(A.due(round, 99).length === 0, 'a broken promise never falls due again');
check(!A.forsworn(round, 'Marget Sayle'), 'only the person whose word broke is forsworn');

// ---- surety and standing apart (ready for Phase 25; not wired)
c = A.make(); e = A.add(c, { kind: 'promise', text: A.TX.promiseText, person: 'The deserter', due: 3 });
check(A.standSurety(c, e.id, 'Marget Sayle') && e.surety.includes('Marget Sayle'), 'a surety is written on the entry');
check(A.standApart(c, e.id, 'Gytha Marrin') && e.apart.includes('Gytha Marrin'), 'standing apart is written too');
check(A.standSurety(c, e.id, 'Marget Sayle') && e.surety.length === 1, 'the same surety is not written twice');
check(!A.standSurety(c, 'missing', 'Marget Sayle'), 'surety needs an entry');

// ---- pages
c = A.make();
A.add(c, { kind: 'owedToUs', text: 'Gytha Marrin owes an answer', person: 'Gytha Marrin' });
A.add(c, { kind: 'owedByUs', text: 'A line of salt to the bothy', person: 'Marget Sayle' });
A.add(c, { kind: 'receipt', text: 'A receipt for the Salt Trace', person: 'Gytha Marrin' });
A.add(c, { kind: 'promise', text: A.TX.promiseText, person: 'The deserter', due: 2 });
const p = A.pages(c);
check(p.owedToUs.length === 1 && p.owedByUs.length === 1 && p.promises.length === 1 && p.receipts.length === 1, 'the three kinds of page hold their own lines');
check(!/sovereign|sov\b|Octave|level|soul|respawn/i.test(JSON.stringify(p)), 'the pages use no Octave or game-outside word');
check(A.pages(A.make()).receipts.length === 0, 'the receipts page is empty until Wexhaven');

// ---- old saves and round trips
const old = A.load(undefined);
check(old.v === 1 && old.entries.length === 0 && Object.keys(old.forsworn).length === 0, 'a save without the Account gets an empty one');
check(A.load({ v: 1, entries: [] }).entries.length === 0, 'an empty versioned book loads');
const bad = A.load({ v: 1, entries: [{ kind: 'nonsense', text: 'x' }] });
check(bad.entries.length === 0, 'an unknown kind is not entered');

// ---- source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'account14.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the Account owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
const q = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
check(q.every((x) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(x)), 'every quoted line is plain ASCII');
check(/G\.state = was === 'play' \? 'play' : was/.test(src), 'the panel keeps the world playing');
check(/la_account/.test(src) && /la_forsworn|forsworn\[e\.person\]/.test(src), 'the book and the forsworn mark are saved');
const book = fs.readFileSync(path.join(ROOT, 'js', 'panel10.js'), 'utf8');
check(/The Account opens with A/.test(book), 'BOOK tells the player how to open the Account');

// ---- in a browser: Marget's promise, the non-pausing book, the hearth. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      loadMap(LEDGE1.BOTHY);
      const m = G.ents.find((e) => e.id === 'la_marget');
      talk(m); askTopic('The south');
      out.choices = (DLG.choices || []).map((q) => q.t);
      DLG.choices[0].f();
      out.entry = ACCOUNT14.state().entries.map((e) => ({ kind: e.kind, person: e.person, state: e.state, due: e.due }));
      // the book opens on A without stopping the clock (A works in play: leave her talk first, as a player does)
      closeModal(); G.state = 'play';
      const tod = G.tod;
      ACCOUNT14.open(); out.open = { state: G.state, panel: G.openPanel };
      advanceTime(2000);
      out.clock = { before: tod, after: G.tod, moved: G.tod !== tod };
      closeModal(); G.state = 'play';
      // the bothy hearth marks the promise
      doRest('lamp');
      await new Promise((r) => setTimeout(r, 400));
      out.hearth = { state: G.state, visible: !document.getElementById('event').classList.contains('hidden'), text: document.getElementById('event-panel').innerText };
      const b = document.querySelector('#event-panel button[data-i="0"]'); if (b) b.click();
      out.kept = ACCOUNT14.state().entries[0].state;
      // a broken word is forsworn, and FOLK shows it
      ACCOUNT14.add(ACCOUNT14.state(), { kind: 'promise', text: 'A second word', person: G.player.name, due: G.day });
      doRest('lamp');
      await new Promise((r) => setTimeout(r, 400));
      const bb = document.querySelector('#event-panel button[data-i="1"]'); if (bb) bb.click();
      out.sworn = ACCOUNT14.state().forsworn;
      G.state = 'panel'; renderLedger(); out.folk = (document.querySelector('#modal-panel') || document.body).innerText;
      return out;
    });
    check(r.choices.join() === 'Give your word.,Not yet.', 'Marget asks with one promise and one refusal');
    check(r.entry.length === 1 && r.entry[0].kind === 'promise' && r.entry[0].person === 'The deserter', 'the promise is under the player\'s name');
    check(r.open.state === 'play' && r.open.panel === 'account', 'the Account is an overlay and the world is still playing');
    check(r.clock.moved, 'the world clock moves while the Account is open');
    check(r.hearth.visible && /word you gave/.test(r.hearth.text), 'the bothy hearth asks about the promise');
    check(r.kept === 'kept', 'the promise is marked kept');
    check(r.sworn && Object.keys(r.sworn).length === 1, 'a broken word marks the person forsworn');
    check(/Forsworn/.test(r.folk), 'FOLK shows the forsworn mark');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
