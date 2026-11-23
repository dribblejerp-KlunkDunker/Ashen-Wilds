// node test/hearing19.test.js --no-browser
// Phase 19, noise and the hearing table: the engine's noise inputs, the company's metres, stone, surfaces,
// the clang, the loudest member, and the two wires (a human listener turns; a sweep on stone clangs).
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const H = require(path.join(ROOT, 'js', 'hearing19.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

check(H.CLANG === 16 && H.STONE === 0.5, 'the clang is 16 m and stone halves a noise');
check(H.noiseOf({ state: 'stand' }) === 1 && H.noiseOf({ state: 'walk' }) === 2.4 && H.noiseOf({ state: 'sprint' }) === 4.2, 'the engine floors are the inputs');
check(H.noiseOf({ state: 'walk', gear: 1 }) === 3.4, 'gear adds to the step');
check(H.heardAt(1) === 3 && H.heardAt(2.4) === 6 && H.heardAt(4.2) === 14 && H.heardAt(16) === 16, 'stand 3, walk 6, sprint 14, clang 16 metres');
check(H.heardAt(2.4, 'stone') === 3 && H.heardAt(4.2, 'stone') === 7 && H.heardAt(16, 'stone') === 8, 'stone halves walk, sprint and clang');
check(H.heardAt(2.4, 'frost') === 6, 'frost does not muffle');
check(H.surfaceAt('la_bothy', 3, 2) === 'stone' && H.surfaceAt('la_ledge', 89.5, 40.5) === 'stone' && H.surfaceAt('la_ledge', 89.5, 48.5) === 'frost', 'bothy and ledge rock are stone; the lower ledge is frost');
check(H.surfaceAt('elsewhere') === 'frost', 'unknown ground is not stone');
check(H.companyNoise([1, 4.2, 2.4]) === 4.2 && H.companyNoise([]) === 0, 'the company is as loud as its loudest member');
check(H.clangNoise() === 16 && H.surfaceMul('stone') === 0.5 && H.surfaceMul('frost') === 1, 'a wall clang is 16, halved through stone');
check(H.reading({ noise: 2.4, surface: 'stone', hearing: 0.7 }).metres === 2.1, 'the HUD reading applies stone and One good ear');
check(H.reading({ noise: 16, surface: 'frost' }).metres === 16, 'the HUD reading shows the clang at 16 m');

// ---------------------------------------------------------------- who listens
check(H.isHumanNpc({ kind: 'npc', id: 'la_marget' }) && !H.isHumanNpc({ kind: 'npc', id: 'cat' }) && !H.isHumanNpc({ kind: 'npc', id: 'la_carter', companion: true }) && !H.isHumanNpc({ kind: 'npc', id: 'hollow', loop: true }) && !H.isHumanNpc({ kind: 'npc', id: 'fig', p19fig: 'guest' }) && !H.isHumanNpc({ kind: 'enemy', id: 'hound' }),
  'human listeners are people, not the cat, a Hollow, a companion, a co-op figure or a beast');
check(H.isHumanNpc({ kind: 'npc', id: 'la_marget' }) && !H.isHumanNpc({ kind: 'npc', id: 'la_marget', dead: true }) && !H.isHumanNpc({ kind: 'npc', id: 'la_marget', hidden: true }), 'the dead and the hidden do not listen');

// ---------------------------------------------------------------- what rings
check(H.sweepClangs('slash right') && H.sweepClangs('slash left') && H.sweepClangs('cut up') && !H.sweepClangs('thrust') && !H.sweepClangs('chop down'),
  'slashes and rising cuts ring; thrusts and chops do not');
check(H.stoneWall({ tex: 't_house_la_drystone' }) && H.stoneWall({ tex: 't_la_rock' }) && H.stoneWall({ tex: 't_marble' }) && !H.stoneWall({ tex: 't_hedge' }) && !H.stoneWall({ tex: 't_wood' }) && !H.stoneWall({ tex: 't_door' }),
  'stone faces ring; hedge, wood and doors do not');
check(H.clangOf('slash right', { tex: 't_la_rock' }) === 16 && H.clangOf('thrust', { tex: 't_la_rock' }) === 0 && H.clangOf('slash right', { tex: 't_hedge' }) === 0,
  'a clang is 16 only for a sweep on stone');

// ---------------------------------------------------------------- a human's ears
const near = { kind: 'npc', id: 'la_marget', x: 82, y: 48.5, facing: 0 };
const far = { kind: 'npc', id: 'la_marget', x: 95, y: 48.5, facing: 0 };
const stoneEdge = { kind: 'npc', id: 'la_carter', x: 83.5, y: 48.5, facing: 0 };
check(H.heardBy(near, { x: 80, y: 48, noise: 2.4, surface: 'frost' }) === true, 'a walk carries 6 m on frost');
check(H.heardBy(far, { x: 80, y: 48, noise: 2.4, surface: 'frost' }) === false, 'a listener beyond 6 m does not hear a walk');
check(H.heardBy(stoneEdge, { x: 80, y: 48, noise: 2.4, surface: 'stone' }) === false && H.heardBy(stoneEdge, { x: 80, y: 48, noise: 2.4, surface: 'frost' }) === true,
  'stone halves the reach: 3.5 m is too far on stone, not on frost');
check(H.heardBy({ kind: 'npc', id: 'cat', x: 80.5, y: 48.5 }, { x: 80, y: 48, noise: 4.2, surface: 'frost' }) === false, 'the cat is not a listener');

const mem = new Map();
const a = { kind: 'npc', id: 'la_marget', x: 82, y: 48.5, facing: 0 };
const b = { kind: 'npc', id: 'la_carter', x: 95, y: 48.5, facing: 0 };
const c = { kind: 'npc', id: 'cat', x: 81, y: 48.5, facing: 0 };
const d = { kind: 'npc', id: 'hollow', loop: true, x: 81, y: 48.5, facing: 0 };
const e = { kind: 'npc', id: 'guard', x: 81.5, y: 48.5, facing: 0.4, state: 'chase' };
const changed = H.perceive([a, b, c, d, e], { x: 80, y: 48, noise: 4.2, surface: 'frost' }, mem, 10);
check(changed === 1 && Math.abs(a.facing - Math.atan2(-0.5, -2)) < 1e-9, 'a sprint turns the one human listener toward it');
check(b.facing === 0 && c.facing === 0 && d.facing === 0 && e.facing === 0.4, 'the far, the cat, the Hollow and a chasing guard are left alone');
check(H.release(mem, 11) === 0 && Math.abs(a.facing - Math.atan2(-0.5, -2)) < 1e-9, 'the facing holds inside the listening spell');
check(H.release(mem, 11.25) === 1 && a.facing === 0, 'and is put back after it');
const noFace = { kind: 'npc', id: 'la_carter', x: 82, y: 48.5 };
const mem2 = new Map();
H.perceive([noFace], { x: 80, y: 48, noise: 4.2, surface: 'frost' }, mem2, 0);
H.release(mem2, 2);
check(!('facing' in noFace), 'a listener that had no facing gets none back');
const held = { kind: 'npc', id: 'la_marget', x: 82, y: 48.5, facing: 0 };
const mem3 = new Map();
H.perceive([held], { x: 80, y: 48, noise: 16, surface: 'frost', hold: 2.4 }, mem3, 0);
H.perceive([held], { x: 80, y: 48, noise: 16, surface: 'frost' }, mem3, 0.5);
check(H.release(mem3, 1.5) === 0, 'a later short listen does not cut a clang hold short');
check(H.release(mem3, 2.5) === 1 && held.facing === 0, 'the clang hold still ends on time');

// ---------------------------------------------------------------- the wire, against a fake page
const game = {
  state: 'play', map: { _la: true, id: 'la_ledge' }, mapId: 'la_ledge', noise: 4.2, time: 10,
  flags: { la_bg: 'deserter' }, player: { fat: 20, hp: 90, weapons: ['sword'], weapon: 0 },
  attack: { t: 0, dur: 0, dirLabel: '' }, song: { t: 0 }, dead: false,
  ents: [
    { kind: 'npc', id: 'la_marget', x: 82, y: 48.5, facing: 0 },
    { kind: 'npc', id: 'cat', x: 80.5, y: 48.5, facing: 0 },
    { kind: 'npc', id: 'la_carter', x: 95, y: 48.5, facing: 0 },
    { kind: 'npc', id: 'hollow', loop: true, x: 81, y: 48.5, facing: 0 },
    { kind: 'npc', id: 'guard', x: 81.5, y: 48.5, facing: 0.4, state: 'chase' },
  ],
};
const noises = [];
let wallCell = { tex: 't_la_rock' };
const fakeEngine = { ctx: {}, cam: { x: 80, y: 48 }, pickWall: () => ({ x: 80, y: 47, cell: wallCell }), pick: () => null };
function drawBase() { return 0; }
function updateBase(dt) { game.time += Math.max(0, +dt || 0); if (game.attack.t > 0) game.attack.t = Math.max(0, game.attack.t - Math.max(0, +dt || 0)); }
function attackBase(label) { game.attack.t = 0.42; game.attack.dur = 0.42; game.attack.dirLabel = label; game.player.fat--; return 'swing'; }
global.window = {};
global.G = game;
global.Engine = fakeEngine;
global.GFX = {};
global.LEDGE1 = { SWITCHES: [] };
global.CARDS18 = { hearing: () => 1 };
global.drawHUD = drawBase;
global.update = updateBase;
global.attack = attackBase;
global.currentWeapon = () => ({ name: 'Short Sword', reach: 1.4, ranged: false, type: 'iron' });
global.WEAPONS = { hands: { name: 'Bare Hands' }, sword: { name: 'Short Sword' } };
global.addNoise = (n) => { noises.push(n); game.noise = Math.min(10, game.noise + n); };
check(H.wire() === true, 'the hearing wire attaches to the fake page');

game.noise = 4.2; game.time = 10; game.ents[0].facing = 0;
global.update(0.1);
check(Math.abs(game.ents[0].facing - Math.atan2(48 - 48.5, 80 - 82)) < 1e-9, 'the tick turns Marget toward a sprint');
check(game.ents[1].facing === 0 && game.ents[2].facing === 0 && game.ents[3].facing === 0 && game.ents[4].facing === 0.4, 'and leaves the cat, the far carter, the Hollow and the chasing guard alone');

game.noise = 0; game.time = 10.2;
global.update(1.3);
check(game.ents[0].facing === 0, 'when the noise has passed, Marget faces back');

noises.length = 0; game.noise = 1; game.time = 20; game.attack.t = 0; game.ents[0].facing = 0;
global.attack('slash right');
check(noises.includes(16), 'a slash into the fake stone wall adds the 16 m clang');
check(game.noise === 10, 'the engine noise rises to its cap for the hounds and the gauge');
check(Math.abs(game.ents[0].facing - Math.atan2(47.5 - 48.5, 80.5 - 82)) < 1e-9, 'the clang turns Marget toward the wall');

noises.length = 0; game.attack.t = 0; game.noise = 1;
global.attack('thrust');
check(!noises.includes(16), 'a thrust never clangs');
game.attack.t = 0;
wallCell = { tex: 't_hedge' };
global.attack('slash right');
check(!noises.includes(16), 'a slash into a hedge does not clang');
game.attack.t = 0;
wallCell = { tex: 't_la_rock' };
fakeEngine.pick = () => ({ kind: 'enemy', x: 80.5, y: 47.5 });
global.attack('slash right');
check(!noises.includes(16), 'a body in the way takes the blow; the wall behind it does not ring');
fakeEngine.pick = () => null;
game.attack.t = 0; game.state = 'panel';
global.attack('slash right');
check(!noises.includes(16), 'no clang while a panel is open');
game.state = 'play';

game.map._la = false; game.noise = 4.2; game.ents[0].facing = 0;
global.update(0.05);
check(game.ents[0].facing === 0, 'a town map does not run the ledge listener');
noises.length = 0; game.attack.t = 0; game.noise = 1;
global.attack('slash right');
check(!noises.includes(16), 'a town wall does not ring the ledge clang');
game.map._la = true;

const src = fs.readFileSync(path.join(ROOT, 'js', 'hearing19.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now|document\.|getContext/i.test(src), 'the table owns no random number, clock or DOM');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'the file is plain ASCII');
check(/\[PROPOSED\]/.test(src), 'the numbers the lore does not give are marked proposed');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
