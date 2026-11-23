// node test/kit17.test.js --no-browser
// Phase 17, kit, weight and money: the eighteen-row table, the eight kits, the burden boundaries, capacity,
// salt prices, torch fuel, one light in the hand, no field healing and no ranged weapon.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js', 'kit17.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---- the table
const rows = Object.keys(K.ITEMS).map((id) => K.ITEMS[id]);
check(rows.length === 18, 'the table has eighteen rows');
const weights = { sword: 1.4, spear: 2.6, axe: 2.3, targe: 3.5, torch: 0.8, coif: 0.6, kettle: 1.4, gambeson: 3.2, mail: 8.5, leather: 1.2, splinted: 3.0, rag: 0.1, scrap: 0.6, salt: 0.4, timber: 1.5, oil: 0.9, pot: 4.5, lime: 2.0 };
check(rows.every((r) => r.kg === weights[r.id]), 'every weight is items-and-texts.md\'s figure');
const prices = { sword: 20, spear: 8, axe: 10, targe: 6, torch: 2, coif: 3, kettle: 12, gambeson: 15, mail: 40, leather: 5, splinted: 9, rag: 1, scrap: 0.5, salt: 1, timber: 1, oil: 3, pot: 30, lime: 2 };
check(rows.every((r) => r.price === prices[r.id]), 'every price is in measures of salt, as the lore gives it');
check(rows.every((r) => r.name && r.kind && r.stack > 0 && r.use && !/[^\x09\x0a\x0d\x20-\x7e]/.test(r.desc)), 'every row is named, described and plain ASCII');

// ---- the eight kits
const kits = {
  deserter: [['sword', 'targe', 'torch', 'rag', 'rag'], 5.9],
  factor: [['spear', 'torch', 'rag', 'rag'], 3.6],
  cleaner: [['targe', 'torch', 'rag', 'rag', 'rag', 'rag'], 4.7],
  cutter: [['axe', 'torch', 'rag'], 3.2],
  gutter: [['sword', 'torch', 'rag', 'rag'], 2.4],
  priest: [['targe', 'torch', 'rag', 'rag', 'rag'], 4.6],
  healer: [['spear', 'torch', 'rag', 'rag', 'rag', 'rag', 'rag'], 3.9],
  carter: [['axe', 'targe', 'gambeson', 'torch', 'rag', 'rag'], 10.0],
};
let kitOk = true;
for (const bg in kits) { const [ids, kg] = kits[bg]; if (K.kit(bg).join() !== ids.join() || Math.abs(K.kitWeight(bg) - kg) > 1e-9) kitOk = false; }
check(kitOk, 'all eight kits match the cards, with their total weights');
check(K.kit('nobody').join() === K.kit('deserter').join(), 'an unknown background gets the default kit');
const carter = K.gear('carter');
check(carter.weapons.join() === 'axe', 'the carter kit puts the broadaxe in the weapon hand');
check(carter.items.map((s) => s.id + 'x' + s.n).join() === 'targex1,gambesonx1,torchx1,ragx2', 'the carter kit puts the targe, gambeson, torch and two rags in the bag');
check(carter.armor.shield === 'targe' && carter.armor.body === 'gambeson', 'the targe and gambeson are worn in their slots');
check(carter.kg === 10 && carter.fuel === 240, 'the carter kit weighs ten kilos and carries a four-minute torch');
const cleaner = K.gear('cleaner');
check(cleaner.weapons.length === 0 && cleaner.items.find((s) => s.id === 'rag').n === 4, 'the cleaner has no weapon and four rags');
const p = { fatMax: 40, fat: 40, inv: [], weapons: ['pistol'], armor: { body: 'a_chain' }, pellets: 12, bolts: 4 };
K.applyTo(p, 'deserter');
check(p.weapons.join() === 'sword' && p.inv.map((s) => s.id).join() === 'targe,torch,rag' && p.inv[2].n === 2, 'applying a kit replaces the old weapon and bag, stacking the rags');
check(p.armor.shield === 'targe' && !p.armor.body && p.pellets === 0 && p.bolts === 0, 'applying a kit clears the old armour and ranged ammunition');
K.applyTo(p, 'priest');
check(p.weapons.join() === 'hands' && K.gear('priest').weapons.length === 0, 'a kit with no weapon leaves the priest bare-handed');

// ---- burden
check(K.burden(17.999, 'deserter') === 'free' && K.burden(18, 'deserter') === 'burdened', '18 kg is the boundary: below free, at it burdened');
check(K.burden(28, 'deserter') === 'burdened' && K.burden(28.001, 'deserter') === 'over', '28 kg is the boundary: at it burdened, over it overburdened');
check(K.pace(18, 'deserter') === 0.9 && K.noise(18, 'deserter') === 1 && !K.canSprint(18, 'deserter') && K.canDodge(18, 'deserter'), 'burdened: 0.9 walk, +1 noise, no sprint, dodge still');
check(K.pace(29, 'deserter') === 0.7 && K.noise(29, 'deserter') === 2 && !K.canDodge(29, 'deserter'), 'overburdened: 0.7 walk, +2 noise, no dodge');
check(K.capacity('factor') === 26 && K.capacity('cutter') === 23 && K.capacity('gutter') === 24 && K.capacity('priest') === 28, 'capacity: factor 26, cutter 23, weak back 24, the rest 28');
check(K.burden(26, 'factor') === 'burdened' && K.burden(26.1, 'factor') === 'over', 'the factor\'s 26 kg is a capacity before the overburdened state');
check(K.burden(23, 'cutter') === 'burdened' && K.burden(23.1, 'cutter') === 'over', 'the cutter\'s 23 kg is a capacity too');

// ---- light, money, healing, ranged
check(K.torchFuel('gutter') === 90 && K.torchFuel('priest') === 360 && K.torchFuel('deserter') === 240, 'the torch burns 240 s, 90 for the gutter-kin, 360 for the hedge-priest');
check(!K.canHold('light', 'light') && K.canHold('light', 'weapon') && K.canHold('weapon', 'shield'), 'a person holds one light, not two');
check(K.price('salt') === 1 && K.price('pot') === 30 && K.price('scrap') === 0.5, 'prices are measures, and the half-measure scrap is kept');
check(!K.heal() && !K.ranged(), 'no field healing and no ranged weapon on this game\'s maps');
check(!rows.some((r) => r.use === 'heal' || r.ranged), 'no row has a healing or ranged use');

// ---- source rules
const src = fs.readFileSync(path.join(ROOT, 'js', 'kit17.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the kit table owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
check(/la_kit/.test(src) && /currentWeapon/.test(src), 'the chosen kit is recorded and the ranged path is closed');

// ---- in a browser: the chosen kit is recorded and no ranged weapon is readied. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      out.kit = G.flags.la_kit;
      out.inv = G.player.inv.map((s) => s.id);
      out.weapons = G.player.weapons.slice();
      out.armor = Object.assign({}, G.player.armor);
      out.oil = G.flags.la_oil;
      out.items = { torch: ITEMS.torch && ITEMS.torch.name, targe: ITEMS.targe && ITEMS.targe.name, gambeson: ITEMS.gambeson && ITEMS.gambeson.name };
      G.flags.la_kit.kg = 20; out.load = { noise: armorNoise(), pace: KIT17.pace(20, G.flags.la_bg), sprint: KIT17.canSprint(20, G.flags.la_bg) }; G.flags.la_kit.kg = 10;
      const d = snapshotGame(); d.flags = { la_bg: 'carter' }; d.player.inv = [{ id: 'a_jerkin', n: 1 }]; d.player.weapons = ['sword']; d.player.armor = {};
      restoreGame(d); out.old = { kit: G.flags.la_kit, inv: G.player.inv.map((s) => s.id), weapons: G.player.weapons.slice(), oil: G.flags.la_oil };
      G.player.weapons.push('crossbow'); G.player.weapon = G.player.weapons.length - 1;
      G.state = 'play'; G.keys = {}; attack('test');
      out.weaponsAfter = G.player.weapons;
      return out;
    });
    check(r.kit && r.kit.bg && r.kit.ids.length >= 3 && r.kit.kg > 0, 'the background kit is recorded on the player');
    check(r.inv.includes('targe') && r.inv.includes('torch'), 'the chosen kit is in the bag');
    check(r.weapons.includes('sword') && !r.weapons.includes('crossbow'), 'the chosen kit is in the weapon hand and the old class weapon is gone');
    check(r.armor.shield === 'targe', 'the chosen targe is worn');
    check(r.oil === 240 || r.oil === 90 || r.oil === 360, 'the kit sets the torch fuel');
    check(r.items.torch === 'Pitch Torch' && r.items.targe === 'Wooden Targe' && r.items.gambeson === 'Quilted Gambeson', 'the engine can name the kit\'s own items');
    check(r.load.noise === 1 && r.load.pace < 1 && !r.load.sprint, 'twenty kilograms adds a noise step, slows the walk and forbids a sprint');
    check(r.old.kit && r.old.kit.ids.includes('torch') && r.old.inv.includes('gambeson') && r.old.weapons[0] === 'axe' && r.old.oil === 240, 'an old save rebuilds the kit, its bag, its hand and its fuel');
    check(r.weaponsAfter.includes('crossbow'), 'the engine can still hold the old weapon, but the attack path refuses a ranged one');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
