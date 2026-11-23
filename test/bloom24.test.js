// node test/bloom24.test.js --no-browser
// Phase 24: 55 wounds, 1.2 m/3 s per wound, 2.4 m/8 s burst, fire, cinder and the prologue ruling.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'js', 'bloom24.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

const p = B.make();
check(p.invulnerable && B.hit(p, 20).blocked && p.hp === 55, 'the prologue bloom cannot be killed by default');
const b = B.make({ invulnerable: false });
const h = B.hit(b, 2);
check(h.hit && b.hp === 53 && b.cloud.r === 1.2 && b.cloud.t === 3, 'a wound leaves a 1.2 m cloud for 3 s');
check(B.burn(b, { lit: true, dist: 2, dt: 0.1 }) === 2, 'fire within 2 m eats a cloud ten times faster');
check(B.burn(b, { lit: true, dist: 2.01, dt: 1 }) === 2, 'fire beyond 2 m does not reach it');
check(B.life('deadcalm') === 1.6 && B.life('miasma') === 1.3 && B.life('sleet') === 0.6 && B.life('cinder') === 0.4, 'the book\'s six cloud-lives are in the table');
const w = B.make({ invulnerable: false }); B.wound(w);
check(Math.abs(B.burn(w, { lit: true, dist: 1, dt: 0.05, weather: 'cinder' }) - 1.75) < 1e-9, 'a cinder-squall shortens the burn by its 0.4 life');
const dc = B.make({ invulnerable: false }); B.wound(dc);
check(Math.abs(B.burn(dc, { lit: true, dist: 1, dt: 0.1, weather: 'deadcalm' }) - 2.375) < 1e-9, 'the Dead Calm stretches it by 1.6');
const m = B.make({ invulnerable: false }); m.hp = 3;
const d = B.hit(m, 3);
check(d.dead && !m.alive && m.cloud.r === 2.4 && m.cloud.t === 8, 'the last wound bursts into 2.4 m for 8 s');
check(B.HP === 55 && B.WOUND.r === 1.2 && B.BURST.t === 8, 'the table keeps 55, 1.2 and 8');
const src = fs.readFileSync(path.join(ROOT, 'js', 'bloom24.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');

// ---------------------------------------------------------------- the wire
const messages = [], doses = [];
const lungs = { exposure: 0, stage: 'clear', coughIn: 0, dead: false, seen: 'clear' };
let bloom = { map: 'la_ledge', x: 1, y: 0 };
let lamp = false, weatherName = 'ashfall', weatherSpore = 1, swings = 0;
const game = {
  state: 'play', dead: false, mapId: 'la_ledge', map: { _la: true, id: 'la_ledge' }, day: 0, tod: 0,
  flags: {}, player: { hp: 90 }, attack: { t: 0, dur: 0 }, song: { t: 0 },
};
global.window = {};
global.G = game;
global.Engine = { cam: { x: 0, y: 0, dir: 0 } };
global.BLOOM4 = { state: () => bloom };
global.LUNGS20 = { state: () => lungs, chokeTick: (s, o) => { doses.push(o); } };
global.WEATHER21 = { forDay: () => ({ name: weatherName, spore: weatherSpore }) };
global.LANTERN7 = { lit: () => lamp };
global.GFX = { laLungs: true };
global.currentWeapon = () => ({ dmg: [2, 4], reach: 1.5 });
global.los = () => true;
global.msg = (t) => messages.push(t);
global.attack = () => { swings++; game.attack.t = 0.5; game.attack.dur = 0.5; return 'swing'; };
global.update = () => {};

check(B.wire() === true, 'the bloom wire attaches to the fake page');
const st = B.state();
check(st.invulnerable && B.cloudSpot() === null, 'the prologue bloom starts invulnerable and without a cloud');

game.attack.t = 0; swings = 0;
global.attack('slash');
check(swings === 1 && st.hp === 55 && B.cloudSpot() === null, 'an invulnerable prologue hit makes no wound and no cloud');
check(messages.some((m) => /does not bleed/.test(m)), 'the blocked hit says the crust turns the blade');

st.invulnerable = false; game.attack.t = 0;
global.attack('slash');
check(st.hp === 52 && st.cloud && st.cloud.r === 1.2, 'a vulnerable hit takes 3 from the test blade and leaves a wound cloud');
check(B.cloudSpot() && B.cloudSpot().x === 1 && B.cloudSpot().y === 0 && B.cloudSpot().left === 3, 'the cloud stays where the bloom was hit');

Engine.cam.x = 10;
global.update(1);
check(B.cloudSpot() && Math.abs(B.cloudSpot().left - 2) < 1e-9, 'an ashfall cloud loses one second of its three');

Engine.cam.x = 1;
const beforeDose = doses.length;
global.update(0.5);
check(doses.length > beforeDose && Math.abs(doses[doses.length - 1].dt - 0.5) < 1e-9 && doses[doses.length - 1].choke === 1, 'standing in the cloud feeds the lungs a spore dose');
check(doses[doses.length - 1].spore === 1 && doses[doses.length - 1].mask === false, 'the dose carries the weather spore and the mask state');

lamp = true;
const beforeFire = B.cloudSpot().left;
global.update(0.1);
check(B.cloudSpot().left < beforeFire - 0.5, 'a lit lantern within two metres burns the cloud fast');
lamp = false;

weatherName = 'cinder'; Engine.cam.x = 10;
global.update(0.2);
check(B.cloudSpot() === null, 'a cinder squall clears the rest of the cloud quickly');

st.hp = 1; st.alive = true; game.attack.t = 0; Engine.cam.x = 1;
global.attack('slash');
check(!st.alive && st.cloud && st.cloud.r === 2.4 && B.cloudSpot().left === 8, 'the last wound bursts into the 2.4 m cloud');

const old = B.state();
bloom = { map: 'la_ledge', x: 0, y: 0 };
global.update(0);
const fresh = B.state();
check(fresh !== old && fresh.invulnerable && fresh.alive && fresh.hp === 55 && B.cloudSpot() === null, 'a new bloom state starts the next bloom clean and invulnerable');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
