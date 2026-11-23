// node test/wires19-23.test.js --no-browser
// The browser wires for phases 19, 20 and 23, run against fake G, update, attack and HUD objects. No DOM,
// no canvas and no Playwright: these are the paths the manual browser pass used to cover.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'js', 'hearing19.js'));
const L = require(path.join(ROOT, 'js', 'lungs20.js'));
const C = require(path.join(ROOT, 'js', 'combat23.js'));

let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

// ---------------------------------------------------------------- the fake page
const ctxCalls = [];
const ctx = {
  save() { ctxCalls.push(['save']); },
  restore() { ctxCalls.push(['restore']); },
  fillRect(x, y, w, h) { ctxCalls.push(['fillRect', x, y, w, h]); },
  fillText(text, x, y) { ctxCalls.push(['fillText', text, x, y]); },
};
const game = {
  state: 'play', map: { _la: true, id: 'la_ledge' }, mapId: 'la_ledge', noise: 4.2,
  flags: { la_bg: 'deserter' }, player: { fat: 20, hp: 90 }, attack: { t: 0, dur: 0, pendingHit: null, deferHit: false }, song: { t: 0 },
  dead: false, day: 0,
};
const bloom = { map: 'la_ledge', choke: 0 };
const weather = { spore: 1 };
const panel = {};
let baseHud = 0, baseUpdates = 0, baseSwings = 0, resolvedHits = 0, refusal = '', softDeath = false, noFatigueSwing = false;
const messages = [], noises = [], deaths = [];

function drawBase() { baseHud++; ctxCalls.push(['base']); }
function updateBase(dt) {
  baseUpdates++;
  if (game.attack) game.attack.t = Math.max(0, game.attack.t - Math.max(0, +dt || 0));
  if (game.song) game.song.t = Math.max(0, game.song.t - Math.max(0, +dt || 0));
}
function attackBase() {
  baseSwings++;
  if (refusal) return 'refused:' + refusal;   // the engine or a card stopped before marking a swing
  if (!noFatigueSwing) game.player.fat = Math.max(0, game.player.fat - 1);
  game.attack.t = 0.5; game.attack.dur = 0.5;   // the engine marks a real swing
  if (game.attack.deferHit) { game.attack.pendingHit = () => { resolvedHits++; }; return 'swing'; }
  resolvedHits++;
  return 'swing';
}
function applyBg(id) { game.flags.la_bg = id; return { id }; }
function choose(id) { return applyBg(id); }   // panel10's choose closes over its local applyBg

global.window = {};
global.G = game;
global.Engine = { ctx, cam: { x: 80, y: 48 } };
global.GFX = {};
global.LEDGE1 = { SWITCHES: [] };
global.CARDS18 = { hearing: () => 1 };
global.BLOOM4 = { state: () => bloom };
global.WEATHER21 = { forDay: () => ({ spore: weather.spore }) };
global.PANEL10 = panel; panel.applyBg = applyBg; panel.choose = choose;
global.drawHUD = drawBase;
global.update = updateBase;
global.attack = attackBase;
global.needsRecovery = () => 1;
global.msg = (text) => messages.push(text);
global.addNoise = (n) => noises.push(n);
global.die = (src) => {
  deaths.push(src); game.player.hp = 0;
  if (softDeath) return;   // partner19's hostDown: the host is down, not dead
  game.dead = true; game.state = 'dead';
};

check(H.wire() === true, 'the hearing wire attaches to the fake page');
check(L.wire() === true, 'the lungs wire attaches to the fake page');
check(C.wire() === true, 'the combat wire attaches to the fake page');

// ---------------------------------------------------------------- Options
const keys = global.LEDGE1.SWITCHES.map((s) => s[0]);
check(keys.includes('laHearGauge') && keys.includes('laLungs'), 'both new Options rows are registered');
check(global.LEDGE1.SWITCHES.every((s) => Array.isArray(s) && s.length === 3), 'every registered row is key, name, description');

// ---------------------------------------------------------------- HUD
function setLungs(exposure) {
  game.flags.la_lungs = L.make();
  game.flags.la_lungs.exposure = exposure;
  game.flags.la_lungs.stage = L.stageOf(exposure);
}
setLungs(50);
ctxCalls.length = 0; baseHud = 0;
global.drawHUD();
const hudText = ctxCalls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
check(baseHud === 1, 'the wrapped HUD still calls the base HUD once');
check(hudText.includes('heard 14 m'), 'the gauge reads live noise on frost');
check(ctxCalls.some((c) => c[0] === 'fillRect' && c[1] === 44 && c[2] === 155 && c[3] === 3 && c[4] === 40), 'the grey lungs track is drawn');
check(ctxCalls.some((c) => c[0] === 'fillRect' && c[1] === 44 && c[2] === 175 && c[3] === 3 && c[4] === 20), 'the grey lungs fill follows exposure');

// ---------------------------------------------------------------- combat
setLungs(0); bloom.choke = 0; game.dead = false; game.state = 'play';
game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; game.song.t = 0;
baseSwings = 0; messages.length = 0;
const first = global.attack('slash');
check(first === 'swing' && baseSwings === 1, 'a committed cut reaches the engine once');
check(game.player.fat === 12, 'a cut costs exactly 8 stamina, not the engine\'s one');
check(game.flags.la_combat && game.flags.la_combat.phase === 'windup' && game.flags.la_combat.cost === 8, 'the cut opens the commitment clock');
check(Math.abs(game.attack.t - 0.8) < 1e-9 && Math.abs(game.attack.dur - 0.8) < 1e-9, 'the engine cooldown is the whole cut');
global.attack('slash');
check(baseSwings === 1 && game.player.fat === 12, 'a second cut is refused while the clock is live');
check(messages.some((m) => /still committed/.test(m)), 'the refusal says the last blow still holds');
global.update(0.8);
check(game.flags.la_combat.phase === 'done', 'the wrapped update finishes the clock');
check(game.attack.t === 0, 'the fake engine cooldown also finished');
global.attack('slash');
check(baseSwings === 2 && game.player.fat === 4, 'a cut is allowed again after recovery and costs 8');

game.flags.la_combat = undefined; game.player.fat = 5; game.attack.t = 0; baseSwings = 0; messages.length = 0;
global.attack('slash');
check(baseSwings === 0 && game.player.fat === 5, 'under-cost stamina refuses before the engine swings');
check(messages.some((m) => /no breath/.test(m)), 'the refusal says there is no breath for the blow');

game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; baseSwings = 0;
global.attack('overhead');
check(baseSwings === 1 && game.player.fat === 6 && game.flags.la_combat.cost === 14, 'an overhead takes the heavy cost of 14');

for (const why of ['engine', 'card']) {
  game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; game.attack.dur = 0;
  baseSwings = 0; refusal = why; messages.length = 0;
  global.attack('slash');
  check(baseSwings === 1 && game.player.fat === 20 && game.attack.t === 0 && game.flags.la_combat === undefined, why + ' refusal charges no stamina and starts no clock');
}
refusal = '';

game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; game.attack.dur = 0;
baseSwings = 0; noFatigueSwing = true;   // sync19's co-op swing: it marks the clock without the engine's one fatigue
const coop = global.attack('slash');
check(coop === 'swing' && baseSwings === 1 && game.player.fat === 12 && game.flags.la_combat.cost === 8, 'a co-op swing that spends no engine fatigue still pays the full 8');
noFatigueSwing = false;

// ---------------------------------------------------------------- the active window
// The engine now leaves a pending hit for the phase to call. It must not be called at the swing,
// during windup, or during recovery; exactly one call belongs at the active boundary.
game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; game.attack.pendingHit = null; game.song.t = 0; resolvedHits = 0;
const opened = global.attack('slash');
check(opened === 'swing' && resolvedHits === 0 && game.flags.la_combat.phase === 'windup', 'the swing starts with the blow unresolved');
global.update(0.29);
check(resolvedHits === 0 && game.flags.la_combat.phase === 'windup', 'no blow lands during windup');
global.update(0.02);
check(resolvedHits === 1 && game.flags.la_combat.phase === 'active', 'the blow lands in the active window');
global.update(0.15);
check(resolvedHits === 1 && game.flags.la_combat.phase === 'recovery', 'no second blow lands in recovery');
global.update(0.35);
check(resolvedHits === 1 && game.flags.la_combat.phase === 'done', 'the clock ends with exactly one blow');

game.flags.la_combat = undefined; game.player.fat = 20; game.attack.t = 0; game.attack.pendingHit = null; game.song.t = 0; resolvedHits = 0;
global.attack('slash'); global.update(1);
check(resolvedHits === 1 && game.flags.la_combat.phase === 'done', 'a step across the whole swing still lands once and not in recovery');

// ---------------------------------------------------------------- lungs
setLungs(30); check(global.needsRecovery() === 1, 'cough leaves the ordinary stamina return');
setLungs(50); check(global.needsRecovery() === 0.5, 'crust halves the stamina return');
setLungs(80); check(global.needsRecovery() === 0, 'silence returns no stamina');

setLungs(0); bloom.choke = 2; weather.spore = 1.3; game.dead = false; game.state = 'play';
global.update(1);
check(Math.abs(game.flags.la_lungs.exposure - 2.6) < 1e-9 && game.flags.la_lungs.stage === 'clear', 'one second of choke in miasma adds 2.6 exposure');
setLungs(24); game.flags.la_lungs.seen = 'clear'; bloom.choke = 2; weather.spore = 1.3;
global.update(1);
check(game.flags.la_lungs.stage === 'cough', 'the wired choke crosses 25 into the cough stage');

setLungs(25); game.flags.la_lungs.coughIn = 19; bloom.choke = 0; weather.spore = 1;
noises.length = 0; messages.length = 0;
global.update(1);
check(game.flags.la_lungs.coughIn === 0 && noises.includes(1.5), 'the 20-second cough adds its noise through the wire');

setLungs(99); game.dead = false; game.state = 'play'; game.player.hp = 90; bloom.choke = 2; weather.spore = 1;
deaths.length = 0;
global.update(1);
check(deaths[0] === 'ash-lung' && game.dead === true && game.player.hp === 0, 'bloom calls the engine death path');
check(game.flags.la_lungs.exposure === 0 && game.flags.la_lungs.stage === 'clear' && game.flags.la_lungs.dead === false, 'a lung death clears its dead state for the next life');

softDeath = true;
setLungs(99); game.dead = false; game.state = 'play'; game.player.hp = 90; bloom.choke = 2; weather.spore = 1;
deaths.length = 0;
global.update(1);
check(deaths[0] === 'ash-lung' && game.dead === false, 'a softened lung death leaves the host down, not dead');
check(game.flags.la_lungs.dead === false && game.flags.la_lungs.exposure === 0, 'a softened lung death also clears its state');
game.player.hp = 60;   // the partner lifts the revived host
global.update(1);
check(deaths.length === 1, 'a revived host is not re-downed by the old lung state');
softDeath = false;

// ---------------------------------------------------------------- a new character
game.dead = true; game.state = 'dead'; game.player.hp = 0;
game.flags.la_lungs = { exposure: 80, stage: 'silence', coughIn: 19, dead: true };
panel.applyBg('carter');
check(game.flags.la_bg === 'carter' && game.flags.la_lungs.exposure === 0 && game.flags.la_lungs.stage === 'clear' && game.flags.la_lungs.coughIn === 0 && game.flags.la_lungs.dead === false, 'succession clears even a dead card state');

game.dead = false; game.state = 'play'; game.player.hp = 90;
game.flags.la_lungs = { exposure: 60, stage: 'crust', coughIn: 10, dead: false };
panel.choose('healer');
check(game.flags.la_bg === 'healer' && game.flags.la_lungs.exposure === 0 && game.flags.la_lungs.stage === 'clear', 'creation resets the lungs through choose');

const src = fs.readFileSync(path.join(ROOT, 'js', 'lungs20.js'), 'utf8');
check(/PANEL10\.applyBg/.test(src) && /PANEL10\.choose/.test(src), 'the reset is wired to both panel entry points');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
