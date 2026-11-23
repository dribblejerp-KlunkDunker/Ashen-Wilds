// node test/company12.test.js --no-browser
// Phase 12, death and succession: a two-person company, permanent death, the next card, the roll, and old saves.
// The browser half dies on the ledge, takes up the load in the bothy, and checks hardcore and the end of the company.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'company12.js'));
const P = require(path.join(ROOT, 'js', 'panel10.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the company
let c = C.make({ bg: 'deserter', name: 'The deserter', hp: 90 });
check(c.v === 1 && c.people.length === 2 && c.active === 'you', 'a new company is the traveller and the carter');
check(c.people[1].id === 'carter' && c.people[1].hp === 120 && c.people[1].hpMax === 120, 'the carter is 120 health');
check(C.successor(c).id === 'carter', 'while both live, the other is the successor');
const dead = C.kill(c, 'you', 'the bloom');
check(dead && dead.name === 'The deserter' && !c.people[0].alive, 'killing the player writes them into the roll');
check(C.successor(c).id === 'carter' && !C.ended(c), 'the carter is the successor, and the company goes on');
check(C.kill(c, 'you', 'again') === null && c.dead.length === 1, 'a dead person cannot die twice');
const p = C.takeUp(c, 'carter');
check(p && p.id === 'carter' && c.active === 'carter', 'the carter takes up the load');
check(C.kill(c, 'carter', 'the fall') && C.ended(c) && C.successor(c) === null, 'with both dead the run ends and no one succeeds');

// ---- the roll
c = C.make({ bg: 'gutter', name: 'The waif', hp: 75 });
C.kill(c, 'you', 'the bloom'); C.kill(c, 'carter', 'the fall');
const roll = C.roll(c);
check(roll.length === 2 && roll[0].name === 'The waif' && roll[1].name === 'The causeway carter', 'the roll names the dead in the order they died');
check(roll.every((d) => d.named === false), 'and says whether each was named');
check(C.roll(null).length === 0, 'an empty roll is empty');

// ---- old saves and round trips
const one = C.load(undefined, { bg: 'deserter', companion: null });
check(one.people.length === 1 && one.people[0].id === 'you', 'a save without a company gets one person, not a companion it never met');
const bad = C.load({ v: 1, people: [] }, { bg: 'deserter', companion: null });
check(bad.people.length === 1, 'a damaged company falls back to one person');
c = C.make({ bg: 'priest', name: 'The hedge-priest', hp: 100 });
C.kill(c, 'you', 'the bloom');
const round = C.load(JSON.parse(JSON.stringify(c)), {});
check(round.v === 1 && round.people.length === 2 && round.dead.length === 1 && round.people[0].alive === false, 'a company round-trips through JSON');
check(round.dead[0].name === 'The hedge-priest' && round.active === 'carter', 'the roll and the active person survive the round trip');

// ---- the successor's card
check(typeof P.applyBg === 'function' && typeof P.choose === 'function', 'the panel exposes applyBg as well as choose');
check(P.byId('carter').hp === 1.2 && P.byId('carter').call === 'The causeway carter', 'the carter card is 120 health and the HUD name the phase asks for');

// ---- source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'company12.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the company owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
const q = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
check(q.every((s) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(s)), 'every quoted line is plain ASCII');
check(/la_company/.test(src) && /PANEL10\.applyBg/.test(src) && /loadMap = function/.test(src), 'the company is saved, the successor gets a card, and the hearth is recorded');
check(!/respawn|soul|level|Octave/i.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'no respawn, soul, level or Octave wording in the code');
const ledge = fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8');
check(/la_looked/.test(ledge), 'Phase 11 still owns the opening look');

// ---- in a browser: die, see the card, take up the load. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      G.flags.la_hearth = true;                 // the bothy has been entered: that is the last hearth
      const before = { name: G.player.name, hp: G.player.hpMax, map: G.mapId };
      die('the test');
      out.card = { state: G.state, title: document.getElementById('death-title').textContent, text: document.getElementById('death-text').textContent, wake: document.getElementById('btn-wake').hidden, button: !!document.getElementById('btn-company') };
      out.company = JSON.parse(JSON.stringify(G.flags.la_company));
      document.getElementById('btn-company').click();
      advanceTime(300);
      out.after = { name: G.player.name, hp: G.player.hp, hpMax: G.player.hpMax, map: G.mapId, state: G.state, dead: G.dead };
      // the roll is in FOLK
      G.state = 'panel'; renderLedger(); out.folk = (document.querySelector('#modal-panel') || document.body).innerText;
      closeModal(); G.state = 'play';
      // a second death ends the company, with no wake
      die('the second test');
      out.end = { state: G.state, title: document.getElementById('death-title').textContent, wake: document.getElementById('btn-wake').hidden, button: document.getElementById('btn-company').textContent };
      out.before = before;
      return out;
    });
    check(r.card.state === 'dead' && /load is taken up/i.test(r.card.title) && /deserter is dead/i.test(r.card.text), 'a death shows the company card, not the wake');
    check(r.card.wake === false && r.card.button, 'the wake is taken away and the load is offered');
    check(r.company.dead.length === 1 && r.company.people.find((p) => p.id === 'you').alive === false, 'the dead traveller is written into the company');
    check(r.after.name === 'The causeway carter' && r.after.hp === 120 && r.after.hpMax === 120, 'the carter takes up the load at 120 health');
    check(r.after.map === 'la_bothy' && r.after.state === 'play' && !r.after.dead, 'and stands at the bothy hearth, playing');
    check(/The dead/.test(r.folk) && /The deserter, Not named\.|The deserter\. Not named\./.test(r.folk), 'FOLK has the roll and names the dead');
    check(r.end.state === 'dead' && /company ends here/i.test(r.end.title) && r.end.wake === false && /title/i.test(r.end.button), 'a second death ends the company, with no wake and no successor');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
