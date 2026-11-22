// The M3 vertical: one five-minute night that ends in the Grey Hour. One weapon (the Watch
// Sword), three kinds of enemy, no items, no evolutions, no meta. It exists to answer one
// question before the full build: is the loop fun?
//
// The design's 30:00 night compresses to 5:00. The last minute is the Grey Hour (design 2.1):
// the ash goes pale and the spawn rate triples. Survive it and the line is Held; die in it and
// the line is Held, and fell at first light; die earlier and the line is The dead.

import { TILE, VIEW } from './tuning.js';
import { stepWorld, spawnEnemy } from './world.js';
import { createWeapon, stepWeapon } from './weapon.js';
import {
  createParticles, stepParticles, burst, createLights, TINT, PARTICLE_CAP,
} from './fx.js';
import { resolveWalls } from './collide.js';

export const RUN = Object.freeze({
  length: 300,        // s, the whole slice
  greyAt: 240,        // s, the Grey Hour begins
  hp: 120,
  hurtGrace: 1.0,     // s of grace after a contact hit, however many enemies touch
  slowTime: 1.4,      // s a bloom's grab lasts
  slowScale: 0.55,    // movement multiplier while grabbed
  contactSlack: 3,    // px: bodies separate to exactly r1+r2, so contact needs a little slack
  spawnStart: 1.15,   // s between spawns at 0:00
  spawnEnd: 0.5,      // s between spawns at 4:00, before the Grey Hour multiplier
  greyScale: 3,       // the Grey Hour triples the rate (design 2.1)
  caps: { goblin: 80, bloom: 20, ork: 10 },
  weights: { goblin: 66, bloom: 24, ork: 10 },
});

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Seconds between spawns at run time t. Unchanged by kind: the director picks the kind and the
// cap, so the curve reads as pressure, not as a schedule.
export function spawnInterval(t, grey) {
  const k = Math.min(1, Math.max(0, t) / RUN.greyAt);
  const base = RUN.spawnStart + (RUN.spawnEnd - RUN.spawnStart) * k;
  return grey ? base / RUN.greyScale : base;
}

// The stage 1 script, compressed: goblins first, blooms at 0:45, orks at 1:45.
export function unlockedKinds(t) {
  if (t < 45) return ['goblin'];
  if (t < 105) return ['goblin', 'bloom'];
  return ['goblin', 'bloom', 'ork'];
}

export function createRun(world, opts = {}) {
  const p = world.player;
  p.hp = RUN.hp;
  p.maxHp = RUN.hp;
  p.slowFor = 0;

  const seed = (opts.seed === undefined ? Math.floor(Math.random() * 0xffffffff) : opts.seed) >>> 0;
  const particles = createParticles(PARTICLE_CAP);
  const lights = createLights();
  lights.x[0] = p.x;
  lights.y[0] = p.y;
  lights.radius[0] = 7 * TILE;
  lights.intensity[0] = 0.34;
  lights.r[0] = 0.95;
  lights.g[0] = 0.76;
  lights.b[0] = 0.42;
  world.fx = { particles, lights };

  const run = {
    world,
    t: 0,
    grey: false,
    ended: false,
    result: null,
    kills: 0,
    byKind: { goblin: 0, bloom: 0, ork: 0 },
    damageTaken: 0,
    weapon: createWeapon(),
    particles,
    lights,
    spawnIn: 1.1,
    seed,
    rand: makeRng(seed),
  };

  for (let i = 0; i < 3; i++) spawnOne(run, 'goblin');
  return run;
}

export function stepRun(run, intent, dt) {
  if (run.ended) return;

  const p = run.world.player;
  // A Watch Step breaks a bloom's grab; otherwise the grab scales the intent, not the input.
  if (p.dash.active) p.slowFor = 0;
  const scale = p.slowFor > 0 ? RUN.slowScale : 1;
  stepWorld(run.world, { x: intent.x * scale, y: intent.y * scale }, dt);
  p.slowFor = Math.max(0, p.slowFor - dt);

  // First light is a hard stop: a step that crosses 5:00 ends at 5:00 exactly, so a Held
  // report cannot read 5:01.
  run.t = Math.min(run.t + dt, RUN.length);
  if (!run.grey && run.t >= RUN.greyAt) run.grey = true;

  stepWeapon(run, dt);
  stepContact(run);
  stepDirector(run, dt);
  stepParticles(run.particles, dt);

  run.lights.x[0] = p.x;
  run.lights.y[0] = p.y;

  if (p.hp <= 0) finish(run, run.grey ? 'fell' : 'dead');
  else if (run.t >= RUN.length) finish(run, 'held');
}

// Contact damage applies once per hurt-grace window, however many enemies are touching
// (design 5). Blooms also grab: contact slows until a Watch Step breaks it.
export function stepContact(run) {
  const p = run.world.player;
  let damage = 0;
  let grabbed = false;

  for (const e of run.world.goblins) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > p.radius + e.radius + RUN.contactSlack) continue;
    if (e.damage > damage) damage = e.damage;
    if (e.steering === 'sway') grabbed = true;
  }

  if (grabbed && !p.dash.active) p.slowFor = RUN.slowTime;

  if (damage <= 0 || p.iframes > 0) return;
  p.hp = Math.max(0, p.hp - damage);
  run.damageTaken += damage;
  p.iframes = RUN.hurtGrace;
  run.world.flash = 1;
  burst(run.particles, run.rand, p.x, p.y, 10, 110, TINT.ember, 0.3);
}

function stepDirector(run, dt) {
  run.spawnIn -= dt;
  if (run.spawnIn > 0) return;
  run.spawnIn = spawnInterval(run.t, run.grey) * (0.7 + run.rand() * 0.6);
  const kind = pickKind(run, unlockedKinds(run.t));
  if (kind) spawnOne(run, kind);
}

function pickKind(run, kinds) {
  const counts = { goblin: 0, bloom: 0, ork: 0 };
  for (const e of run.world.goblins) counts[e.kind] += 1;

  const open = [];
  let total = 0;
  for (const kind of kinds) {
    const cap = RUN.caps[kind];
    if (counts[kind] >= cap) continue;
    open.push(kind);
    total += RUN.weights[kind];
  }
  if (open.length === 0) return null;

  let roll = run.rand() * total;
  for (const kind of open) {
    roll -= RUN.weights[kind];
    if (roll <= 0) return kind;
  }
  return open[open.length - 1];
}

function spawnOne(run, kind) {
  const at = spawnPoint(run);
  // The sway phase comes from the run's seed, not Math.random, so a seed replays the horde.
  const e = spawnEnemy(run.world, kind, at.x, at.y, { sway: run.rand() * Math.PI * 2 });
  resolveWalls(e, e.radius, run.world.walls);
  burst(run.particles, run.rand, e.x, e.y, 4, 50, TINT.pale, 0.25);
  return e;
}

// Just outside the 1080p view, clamped into the yard: pressure arrives from the dark rather
// than popping in front of the camera. Near a corner the clamp can leave a spawn on screen,
// which is the honest cost of a walled yard.
function spawnPoint(run) {
  const w = run.world;
  const p = w.player;
  const halfW = VIEW.w / 2 + 3 * TILE;
  const halfH = VIEW.h / 2 + 3 * TILE;
  const edge = Math.floor(run.rand() * 4);
  let x;
  let y;
  if (edge === 0) {
    x = p.x - halfW;
    y = p.y + (run.rand() * 2 - 1) * halfH;
  } else if (edge === 1) {
    x = p.x + halfW;
    y = p.y + (run.rand() * 2 - 1) * halfH;
  } else if (edge === 2) {
    x = p.x + (run.rand() * 2 - 1) * halfW;
    y = p.y - halfH;
  } else {
    x = p.x + (run.rand() * 2 - 1) * halfW;
    y = p.y + halfH;
  }
  const margin = 2 * TILE;
  return {
    x: clamp(x, w.bounds.x0 + margin, w.bounds.x1 - margin),
    y: clamp(y, w.bounds.y0 + margin, w.bounds.y1 - margin),
  };
}

function finish(run, result) {
  run.ended = true;
  run.result = result;
  run.spawnIn = Infinity;
}

function clockText(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

// The playtest's evidence: the four numbers the slice is judged on (time survived, kills by
// kind, damage taken, the phase it ended in), plus the context needed to reproduce the run
// (seed, commit) and to say how close it came (health left). Mirrors the stress capture's
// schema and stamp conventions without the performance payload.
export function buildRunReport(run, meta = {}) {
  const p = run.world.player;
  const seconds = Math.round(run.t * 100) / 100;
  return {
    schema: 'the-tally/vertical-run/1',
    capturedAt: meta.capturedAt || new Date().toISOString(),
    url: meta.url || null,
    commit: meta.commit || null,
    seed: run.seed,
    result: run.result,
    phase: run.grey ? 'grey-hour' : 'night',
    survivedSeconds: seconds,
    survived: clockText(seconds),
    kills: run.kills,
    killsByKind: { goblin: run.byKind.goblin, bloom: run.byKind.bloom, ork: run.byKind.ork },
    damageTaken: run.damageTaken,
    healthLeft: Math.max(0, Math.round(p.hp)),
    healthMax: p.maxHp,
  };
}
