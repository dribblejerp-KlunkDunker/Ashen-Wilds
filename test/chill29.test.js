// node test/chill29.test.js --no-browser
// Phase 29: the warmth pool, its stages, the visible cold, the lit hearth and the fake-G wire.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'chill29.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const close = (a, b) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------- the pure pool
check(C.MIN === 0 && C.MAX === 100 && C.FIRE_RADIUS === 2.5, 'the pool is 0 to 100 and the hearth reaches 2.5 m');
check(C.stageOf(100) === 'warm' && C.stageOf(50) === 'warm' && C.stageOf(49) === 'chilled', 'warm from 50');
check(C.stageOf(25) === 'chilled' && C.stageOf(24) === 'freezing' && C.stageOf(1) === 'freezing' && C.stageOf(0) === 'the chill', 'chilled 25, freezing 1, the chill 0');

const s = C.make();
check(s.warmth === 100 && C.stageOf(s.warmth) === 'warm', 'a new body starts warm');
check(Object.keys(s).join(',') === 'warmth', 'the saved state is the pool alone');
C.step(s, { dt: 10, outdoor: true, sleet: 0, night: false });
check(close(s.warmth, 99.2), 'ten seconds of day ashfall costs 0.8');
C.step(s, { dt: 10, outdoor: true, sleet: 1, night: false });
check(close(s.warmth, 96.2), 'ten seconds of sleet costs 3');
C.step(s, { dt: 10, outdoor: true, sleet: 1, night: true });
check(close(s.warmth, 92), 'ten seconds of night sleet costs 4.2');
const held = C.make(); held.warmth = 80;
C.step(held, { dt: 10, outdoor: false, sleet: 1, night: true });
check(held.warmth === 80, 'indoors away from the fire holds the pool');
C.step(held, { dt: 10, outdoor: true, sleet: 1, night: true, fire: true });
check(held.warmth === 90, 'the lit hearth adds 1 a second and wins over the cold');
const full = C.make(); C.step(full, { dt: 1000, outdoor: true, sleet: 1, night: true, fire: true });
check(full.warmth === 100, 'the pool never passes 100');
const empty = C.make(); C.step(empty, { dt: 1000, outdoor: true, sleet: 1, night: true });
check(empty.warmth === 0 && C.stageOf(empty.warmth) === 'the chill', 'the pool stops at zero and the chill');

check(C.staminaReturn({ warmth: 100 }) === 1 && C.staminaReturn({ warmth: 30 }) === 0.75 && C.staminaReturn({ warmth: 10 }) === 0.5 && C.staminaReturn({ warmth: 0 }) === 0, 'stamina return falls with each stage');
check(!('warmth' in C) && !('spend' in C), 'no future-workings API is exposed');

const fire = [{ kind: 'deco', sprite: 'la_hearth', x: 3.5, y: 1.4, glow: 1 }];
const lamp = [{ kind: 'deco', sprite: 'lamp', x: 3.5, y: 1.4, glow: 1 }];
const coldHearth = [{ kind: 'deco', sprite: 'la_hearth', x: 3.5, y: 1.4, glow: 0.3 }];
check(C.nearFire(fire, 3.5, 3.0) && !C.nearFire(fire, 3.5, 5.0), 'a lit hearth warms inside 2.5 m and not outside');
check(!C.nearFire(lamp, 3.5, 3.0) && !C.nearFire(coldHearth, 3.5, 3.0), 'a lamp and a cold hearth are not fires');

const src = fs.readFileSync(path.join(ROOT, 'js', 'chill29.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');

// ---------------------------------------------------------------- the wire against fake G
const messages = [], rects = [];
global.G = {
  flags: {}, state: 'play', dead: false, day: 0, tod: 0.5,
  map: { _la: true, outdoor: true, entities: [] },
  player: { fat: 100, hp: 100 }
};
global.Engine = { cam: { x: 50, y: 50 }, ctx: { save() {}, restore() {}, fillRect(x, y, w, h) { rects.push([x, y, w, h]); }, fillStyle: '' } };
global.WEATHER6 = { sleetAt: () => 0 };
global.LEDGE1 = { SWITCHES: [] };
global.PANEL10 = { applyBg() { return true; }, choose() { return true; } };
global.GFX = { laChill: true };
global.msg = (t) => messages.push(t);
global.update = () => true;
global.drawHUD = () => true;
global.needsRecovery = () => 1;

check(C.wire() && C.wire(), 'the wire installs once');
G.flags.la_chill = undefined;
check(C.state().warmth === 100 && Object.keys(C.state()).join(',') === 'warmth', 'an empty save starts full and stores no stage');
G.flags.la_chill = { warmth: 37 };
const reloaded = JSON.parse(JSON.stringify({ la_chill: G.flags.la_chill }));
G.flags.la_chill = reloaded.la_chill;
check(C.state().warmth === 37 && C.stageOf(C.state().warmth) === 'chilled', 'a saved warmth reloads and derives its stage');
G.flags.la_chill = undefined;
global.update(10);
check(close(C.state().warmth, 99.2), 'the wire ticks the day ashfall outside');
G.tod = 0.9; global.WEATHER6.sleetAt = () => 1; global.update(10);
check(close(C.state().warmth, 95), 'the wire ticks the night sleet');
G.map.outdoor = false; global.update(10);
check(close(C.state().warmth, 95), 'the bothy holds the pool away from the fire');
G.map.entities = [{ kind: 'deco', sprite: 'la_hearth', x: 50, y: 50, glow: 1 }]; global.update(10);
check(close(C.state().warmth, 100), 'the bothy hearth warms the pool back to full');
G.map.entities = [{ kind: 'deco', sprite: 'lamp', x: 50, y: 50, glow: 1 }]; G.map.outdoor = true; G.flags.la_chill = C.make(); G.flags.la_chill.warmth = 1; messages.length = 0; G.player.fat = 100; G.player.hp = 100; global.update(10);
check(C.state().warmth === 0 && C.stageOf(C.state().warmth) === 'the chill', 'a cold tick can reach the chill');
check(G.player.hp === 100, 'the chill at zero is non-lethal');
check(messages.some((m) => m === 'The chill has you. You cannot run.'), 'the chill says its word on the crossing');
messages.length = 0; global.update(0.01);
check(messages.length === 0, 'the stage word is not repeated while the stage holds');
check(G.player.fat === 0 && global.needsRecovery() === 0, 'the chill holds fatigue at zero and returns no stamina');
G.flags.la_chill = C.make(); G.flags.la_chill.warmth = 12;
global.PANEL10.applyBg();
check(C.state().warmth === 100, 'a new card through applyBg resets the pool');
G.flags.la_chill.warmth = 12;
global.PANEL10.choose();
check(C.state().warmth === 100, 'a new card through choose resets the pool');
check(LEDGE1.SWITCHES.filter((row) => row[0] === 'laChill').length === 1, 'Options > The chill is registered once');
G.flags.la_chill = C.make(); G.flags.la_chill.warmth = 50;
GFX.laChill = false; global.update(10);
check(C.state().warmth === 50, 'the Options switch stops the cold');
GFX.laChill = true;
G.map.outdoor = false; G.state = 'play'; G.flags.la_chill.warmth = 50; rects.length = 0;
global.drawHUD();
check(rects.some((r) => r[0] === 40 && r[2] === 3), 'the HUD draws the warmth bar below full');
G.flags.la_chill.warmth = 100; rects.length = 0; global.drawHUD();
check(!rects.some((r) => r[0] === 40), 'the HUD hides the bar at full');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
