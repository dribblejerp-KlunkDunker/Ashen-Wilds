// node test/hearth27.test.js --no-browser
// Phase 27: hearth rest, the store, names for the dead, promises, and the bothy REST panel.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'js', 'hearth27.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

const s = H.make();
check(H.rest(s, 3) === 3 && s.day === 3, 'three days at the hearth');
const p = { name: 'Marget', tired: 5, wounds: 2, frost: 2, lungs: 60 };
H.mend(p, 6);
check(p.tired === 0 && p.wounds === 0 && p.frost === 0 && p.lungs === 60, 'wounds and frost mend; the lung does not');
check(H.join(s, 'Marget') && !H.join(s, 'Marget'), 'a name joins once');
check(H.store(s, { food: 4, fuel: 2 }).food === 4, 'the store takes what is carried in');
const row = H.nameDead(s, 'Marget', 'the bloom');
check(row && row.day === 3 && row.cause === 'the bloom' && H.names(s).length === 0 && H.deadNames(s)[0] === 'Marget', 'the dead are named and leave the roster');
check(!H.join(s, 'Marget'), 'the dead do not rejoin');
const pr = H.promise(s, 'I will bring the salt back', 'Carter');
check(pr && pr.day === 3 && s.promises.length === 1, 'a promise keeps its day and person');
check(H.mend({ name: 'x', dead: true, tired: 9 }, 9).tired === 9, 'the hearth does not mend the dead');
const loaded = H.load(JSON.parse(JSON.stringify(s)), 'la_ledge');
check(loaded.v === 1 && loaded.node === 'la_ledge' && loaded.day === 3 && loaded.promises.length === 1, 'a hearth state round-trips through a save');
const bad = H.load({ food: -2, fuel: 'x', roster: ['Marget', 'Marget'], dead: [{ name: 'Marget', cause: 'the bloom' }] });
check(bad.food === 0 && bad.fuel === 0 && bad.roster.length === 0 && bad.dead.length === 1, 'a damaged hearth state is kept sane');
const src = fs.readFileSync(path.join(ROOT, 'js', 'hearth27.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');

// ---------------------------------------------------------------- the wire against fake G
const messages = [], journals = [];
let ui = null, originalRests = 0;
const rested = [];
global.LEDGE1 = { BOTHY: 'la_bothy', LEDGE: 'la_ledge' };
global.G = {
  state: 'play', mapId: 'la_bothy', day: 3, tod: 0.5,
  map: { _la: true, entities: [{ kind: 'deco', sprite: 'la_hearth', glow: 1 }] }, ents: [],
  player: { name: 'The deserter', fat: 10, fatMax: 100, inv: [{ id: 'oil', n: 1 }, { id: 'flume_eel', n: 1 }] },
  flags: {
    la_company: {
      v: 1, active: 'you',
      people: [{ id: 'you', name: 'The deserter', alive: true }, { id: 'carter', name: 'The carter', alive: false, hp: 0 }],
      dead: [{ id: 'carter', name: 'The carter', cause: 'the bloom', named: false }]
    },
    la_account: {
      v: 1, entries: [{ id: 'a1', kind: 'promise', text: 'Bring the salt back', person: 'The deserter', state: 'open' }]
    }
  },
  give(id) {
    const slot = this.player.inv.find((x) => x && x.id === id);
    if (slot) slot.n = (+slot.n || 1) + 1; else this.player.inv.push({ id, n: 1 });
  }
};
global.ACCOUNT14 = { state: () => G.flags.la_account };
global.openModal = (html, name) => { ui = { html, name }; G.openPanel = name; };
global.closeModal = () => { ui = null; G.openPanel = null; };
global.msg = (t) => messages.push(t);
global.journal = (c, t) => journals.push(t);
global.timeName = () => 'afternoon';
global.renderRest = () => { originalRests++; };
global.doRest = (kind) => { rested.push(kind); G.day++; G.player.fat = G.player.fatMax; };

check(H.wire() && H.wire(), 'the hearth wire installs once');
check(H.state().day === 3 && H.state().roster.includes('The deserter'), 'the hearth reads the company and the day');
check(H.state().promises.length === 1 && H.state().promises[0].text === 'Bring the salt back', 'the Account promise is written at the hearth');
check(H.hasFire(), 'the bothy fire is a lit hearth');
global.Engine = { cam: { x: 3.5, y: 4.4 } };
G.ents = [{ kind: 'enemy', state: 'chase', x: 4, y: 4, dead: false, hidden: false }];
check(!H.canRest(), 'a hunter in reach stops a hearth rest');
G.ents = [];
check(H.canRest(), 'the hearth is safe again with no hunter near');
check(H.open() && ui && ui.name === 'rest' && G.state === 'panel', 'REST opens the hearth panel at the bothy');
check(/The hearth/.test(ui.html) && /The carter/.test(ui.html) && /Not named/.test(ui.html) && /Rest eight hours/.test(ui.html) && /The bothy store/.test(ui.html), 'the panel shows the company, the unnamed dead, rest and the store');
check(/Bring the salt back/.test(ui.html), 'the panel shows the Account promise');

const named = H.nameTheDead('The carter');
check(named && G.flags.la_company.dead[0].named && H.deadNames(H.state()).includes('The carter') && journals.length === 1, 'naming the dead changes the company roll and the hearth record');
check(H.open() && /Named\./.test(ui.html) && !/data-name="The carter"/.test(ui.html), 'the named dead are not offered a second naming');

check(H.storeItem('fuel-in') && H.state().fuel === 1 && G.player.inv.some((x) => x.id === 'oil') === false, 'oil can be left in the bothy store');
check(H.storeItem('food-in') && H.state().food === 1 && G.player.inv.some((x) => x.id === 'flume_eel') === false, 'a smoked eel can be left in the bothy store');
check(H.storeItem('fuel-out') && H.state().fuel === 0 && G.player.inv.some((x) => x.id === 'oil'), 'oil can be taken back out of the store');
check(H.storeItem('food-out') && H.state().food === 0 && G.player.inv.some((x) => x.id === 'flume_eel'), 'food can be taken back out of the store');
check(!H.storeItem('nothing'), 'an unknown store action changes nothing');

check(H.restAtHearth('lamp') && rested[0] === 'lamp' && G.day === 4 && H.state().day === 4 && G.player.fat === G.player.fatMax, 'eight hours at the hearth advances the day and restores fatigue');
check(messages.some((m) => /rest at the hearth/.test(m)) && G.state === 'play', 'the rest closes the panel and says so');
check(JSON.parse(JSON.stringify(G.flags.la_hearth27)).day === 4, 'the hearth state is in the save');

G.mapId = 'la_ledge';
check(H.open() === false && H.restAtHearth('lamp') === false, 'the hearth is only at the bothy');
global.renderRest();
check(originalRests === 1, 'REST off the bothy falls through to the engine');
G.mapId = 'la_bothy'; G.map.entities = [];
global.renderRest();
check(originalRests === 2 && H.open() === false, 'a cold hearth falls through too');

// ---------------------------------------------------------------- in a browser: the panel, a rest, a name and the store
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  let browser = null;
  try {
    browser = await HN.open();
    if (!browser) { console.log('SKIPPED the browser half of this test (no browser could open)'); return; }
    await HN.begin(browser.page);
    const r = await browser.page.evaluate(() => {
      const out = {};
      loadMap(LEDGE1.BOTHY);
      G.state = 'play';
      const c = G.flags.la_company || (G.flags.la_company = COMPANY12.make({ bg: G.flags.la_bg, name: G.player.name }));
      const carter = c.people.find((p) => p.id === 'carter');
      if (carter) { carter.alive = false; carter.hp = 0; }
      if (!c.dead.some((d) => d.name === 'The carter')) c.dead.push({ id: 'carter', name: 'The carter', cause: 'the bloom', named: false });
      G.flags.la_company = c;
      G.flags.la_hearth27 = undefined;
      G.tod = 0.95; G.escapeTimer = 0; G.boreHold = 0;
      renderRest();
      out.open = {
        panel: G.openPanel,
        text: (document.querySelector('#modal-panel') || {}).innerText || '',
        rest: !!document.querySelector('[data-hrest="lamp"]'),
        name: !!document.querySelector('[data-name="The carter"]')
      };
      const before = G.day;
      document.querySelector('[data-hrest="lamp"]').click();
      out.rest = {
        before, after: G.day, state: G.state,
        day: (G.flags.la_hearth27 || {}).day,
        closed: !document.getElementById('modal') || document.getElementById('modal').classList.contains('hidden')
      };
      G.state = 'play'; renderRest();
      const nb = document.querySelector('[data-name="The carter"]'); if (nb) nb.click();
      out.named = {
        named: !!(c.dead.find((d) => d.name === 'The carter') || {}).named,
        text: (document.querySelector('#modal-panel') || {}).innerText || ''
      };
      G.give('oil'); G.give('flume_eel');
      G.state = 'panel'; renderRest();
      document.querySelector('[data-store="fuel-in"]').click();
      out.store = { fuelIn: (G.flags.la_hearth27 || {}).fuel, oilIn: G.count('oil') };
      document.querySelector('[data-store="food-in"]').click();
      out.store.foodIn = (G.flags.la_hearth27 || {}).food;
      document.querySelector('[data-store="fuel-out"]').click();
      out.store.fuelOut = (G.flags.la_hearth27 || {}).fuel;
      out.store.oilOut = G.count('oil');
      return out;
    });
    check(r.open.panel === 'rest' && /The hearth/.test(r.open.text) && /The carter/.test(r.open.text) && /Not named/.test(r.open.text) && r.open.rest && r.open.name, 'the bothy REST button opens the hearth with the company, dead and rest');
    check(r.rest.after > r.rest.before && r.rest.state === 'play' && r.rest.day === r.rest.after && r.rest.closed, 'resting advances the day, closes the panel and returns to play');
    check(r.named.named && /Named\./.test(r.named.text), 'naming the dead is shown in the reopened panel');
    check(r.store.fuelIn === 1 && r.store.foodIn === 1 && r.store.fuelOut === 0 && r.store.oilIn === 0 && r.store.oilOut === 1, 'the store takes and gives back oil and food');
    check(browser.errors.length === 0, 'no page errors: ' + (browser.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  finally { if (browser) await browser.close(); }
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
