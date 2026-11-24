// node test/cards18.test.js --no-browser
// Phase 18, the eight cards: exact multipliers, the missing figures marked proposed, stamina, bleeding, bandaging,
// sight and hearing, dodges and sprint, searching and the quiet pack. No levels.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'cards18.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

const ids = ['deserter', 'factor', 'cleaner', 'cutter', 'gutter', 'priest', 'healer', 'carter'];
check(C.ids.join() === ids.join(), 'the registry has the eight cards in order');
check(ids.every((id) => C.effects(id).blocks === 1 || id === 'deserter'), 'block cost is 1 unless Drilled');
check(C.effects('deserter').blocks === 0.75, 'Drilled blocks cost 25 percent less');
check(C.effects('cleaner').untrained === 1.333 && C.effects('cleaner').wear === 2 && C.effects('cleaner').search === 0.67, 'Untrained costs a third more and wears twice; Quiet hands searches a third faster');
check(C.effects('priest').sworn === true && !C.heavy('priest') && C.heavy('deserter'), 'Sworn hands refuses the heavy blow');
check(C.stamina('cutter') === 80 && C.effects('cutter').staminaReturn === 0.85, 'Winded is 80 stamina and slower return');
check(C.effects('priest').staminaReturn === 1.25, 'Steady returns a quarter faster');
check(C.bleedTime('gutter', 10) === 15 && C.bleedTime('carter', 10) === 7.5, 'Frail bleeds half again as long; Hardy a quarter less');
check(C.bandage('healer', 4).time === 2 && C.bandage('healer', 4).amount === 8, 'Deft bandages twice as fast and twice as much');
check(C.sight('healer') === 0.6 && C.hearing('carter') === 0.7 && C.sight('gutter') === 1.1, 'Night-blind, One good ear and Soft-footed sight');
check(C.dodge('factor') === 30 && C.dodge('gutter') === 16, 'Bad knees dodge costs 30; Soft-footed 16');
check(C.sprint('factor') === 0.85 && C.sprint('deserter') === 1, 'Bad knees sprints at 85 percent');
check(C.search('cleaner') === 0.67 && C.packNoise('factor') === -1, 'Quiet hands searches faster; Packhorse is one noise step quieter');
check(C.noLevels(), 'this game has no levels');
const p = { fatMax: 40, fat: 40, level: 7, xp: 500, perkPoints: 3 }, f = {};
C.applyStats(p, f, 'cutter');
check(p.fatMax === 32 && p.fat === 32, 'Winded scales the engine\'s fatigue maximum once, to 80 percent');
C.applyStats(p, f, 'cutter');
check(p.fatMax === 32 && p.fat === 32, 'a reload does not scale the same fatigue maximum twice');
check(p.level === 1 && p.xp === 0 && p.perkPoints === 0, 'applying a card holds level, XP and perks at zero');
check(C.fog(120, 'healer') === 72 && C.fog(120, 'gutter') === 132, 'Night-blind narrows the fog to 60 percent; Soft-footed widens it to 110');
check(C.applyStats({ fatMax: 50, fat: 50 }, {}, 'priest').staminaReturn === 1.25, 'Steady records the faster stamina return');
const all = ids.flatMap((id) => Object.values(C.effects(id)));
check(all.every((v) => typeof v === 'number' || typeof v === 'boolean'), 'every effect is a number or a flag');
check(!/Octave|sovereign|\bsov\b|respawn|soul/i.test(JSON.stringify(C.ROWS)), 'the registry uses no Octave word');

const src = fs.readFileSync(path.join(ROOT, 'js', 'cards18.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'the registry owns no random number and no clock');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
check(/la_effects/.test(src) && /questXp/.test(src) && /checkLevel/.test(src), 'the card is recorded and XP and levels are held at zero');
check(/\[PROPOSED/.test(src), 'the figures the cards do not give are marked proposed');

// ---- in a browser: no level, no XP, the effects on the card. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {};
      G.player.xp = 500; G.player.level = 7; G.player.perkPoints = 3;
      questXp(1000); checkLevel();
      out.held = { xp: G.player.xp, level: G.player.level, perks: G.player.perkPoints };
      out.effects = G.flags.la_effects;
      PANEL10.choose('healer'); out.healer = { fog: G.map.fogDist, effects: G.flags.la_effects };
      PANEL10.choose('cleaner'); G.player.fat = 50; G.state = 'play'; G.keys = {}; attack('test'); out.cleaner = { fat: G.player.fat, effects: G.flags.la_effects, cost: (G.flags.la_combat || {}).cost || 1 };
      PANEL10.choose('deserter'); G.flags.la_combat = null; G.attack.t = 0; G.player.fat = 50; G.state = 'play'; G.keys = {}; attack('test'); out.trained = { fat: G.player.fat, cost: (G.flags.la_combat || {}).cost || 1 };
      return out;
    });
    check(r.held.xp === 0 && r.held.level === 1 && r.held.perks === 0, 'XP, level and perk points stay at zero on this game\'s maps');
    check(r.effects && typeof r.effects.sight === 'number', 'the chosen card\'s effects are recorded');
    check(r.healer.fog === 72 && r.healer.effects.sight === 0.6, 'Night-blind narrows the living map\'s fog to 60 percent');
    // Phase 23 prices a blow by its commitment; the card's Untrained multiplies that price (audit fix)
    check(Math.abs((50 - r.cleaner.fat) - r.cleaner.cost * 1.333) < 0.001 && Math.abs((50 - r.trained.fat) - r.trained.cost) < 0.001 && r.cleaner.effects.untrained > 1, 'Untrained spends a third more fatigue on a swing: ' + (50 - r.cleaner.fat).toFixed(3) + ' against ' + (50 - r.trained.fat).toFixed(3));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
