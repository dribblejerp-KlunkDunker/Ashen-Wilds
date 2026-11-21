// The M2 target scene, design 23.4: 1,500 goblins, 600 player projectiles, 200 enemy
// projectiles, 3,000 particles, 400 embers and 30 lights in one frame. The goblins come from the
// simulation; the rest is held here, at a constant count, as the load it will be when M3's
// weapons and M5's effects arrive. `mode: 'horde'` keeps the goblins alone, which is the fast
// baseline the earlier captures used.
//
// Nothing here allocates after createScene: the pools are typed arrays and every motion is a
// function of the fixed step, so a capture repeats from its seed. The load also rides with the
// camera: a fixed patch of a 40 x 24 yard would walk out of the view as the auto-pilot circles,
// and the gate would then measure half a scene.

import { TILE } from '../js/sim/tuning.js';

export const TARGET = Object.freeze({
  goblins: 1500,
  playerShots: 600,
  enemyShots: 200,
  particles: 3000,
  embers: 400,
  lights: 30,
});

const GOLDEN = 2.399963229728653;

// The four lights of design 4, repeated around the ring.
const LIGHT_TINTS = [
  [0.95, 0.76, 0.42],   // tallow
  [0.75, 0.35, 0.19],   // ember
  [0.30, 0.55, 0.50],   // the bloom's teal
  [0.62, 0.79, 0.85],   // a working's pale blue
];

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

// One view of the yard, not all of it: the gate is what is on screen, so the load is placed in
// the area the camera actually draws rather than spread over a yard that is wider than the view.
function viewBox(world) {
  const b = world.bounds;
  return {
    cx: (b.x0 + b.x1) * 0.5,
    cy: (b.y0 + b.y1) * 0.5,
    halfW: Math.min((b.x1 - b.x0) * 0.5 - 2 * TILE, 13 * TILE),
    halfH: Math.min((b.y1 - b.y0) * 0.5 - 2 * TILE, 7.5 * TILE),
  };
}

function wrap(value, min, span) {
  let v = value;
  while (v < min) v += span;
  while (v >= min + span) v -= span;
  return v;
}

function makeShots(playerCount, enemyCount, box, rand) {
  const count = playerCount + enemyCount;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const kind = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const player = i < playerCount;
    const angle = rand() * Math.PI * 2;
    const speed = (player ? 14 + rand() * 8 : 6 + rand() * 5) * TILE;
    x[i] = box.cx + (rand() * 2 - 1) * box.halfW;
    y[i] = box.cy + (rand() * 2 - 1) * box.halfH;
    vx[i] = Math.cos(angle) * speed;
    vy[i] = Math.sin(angle) * speed;
    kind[i] = player ? 0 : 1;
  }
  return { x, y, vx, vy, kind, count };
}

function makeParticles(count, box, rand) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const size = new Float32Array(count);
  const tint = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const speed = (0.3 + rand() * 1.1) * TILE;
    x[i] = box.cx + (rand() * 2 - 1) * box.halfW;
    y[i] = box.cy + (rand() * 2 - 1) * box.halfH;
    vx[i] = Math.cos(angle) * speed;
    vy[i] = Math.sin(angle) * speed;
    size[i] = 1.5 + rand() * 3.5;
    tint[i] = i % 3;
  }
  return { x, y, vx, vy, size, tint, count };
}

function makeEmbers(count, box, rand) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN + (rand() - 0.5) * 0.6;
    const out = Math.sqrt((i + 0.5) / Math.max(1, count));
    x[i] = clamp(box.cx + Math.cos(angle) * out * box.halfW,
      box.cx - box.halfW, box.cx + box.halfW);
    y[i] = clamp(box.cy + Math.sin(angle) * out * box.halfH,
      box.cy - box.halfH, box.cy + box.halfH);
  }
  return { x, y, count };
}

function makeLights(count, box, rand) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const angle = new Float32Array(count);
  const orbitX = new Float32Array(count);
  const orbitY = new Float32Array(count);
  const speed = new Float32Array(count);
  const radius = new Float32Array(count);
  const intensity = new Float32Array(count);
  const r = new Float32Array(count);
  const g = new Float32Array(count);
  const b = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const tint = LIGHT_TINTS[i % LIGHT_TINTS.length];
    angle[i] = rand() * Math.PI * 2;
    orbitX[i] = (1 + rand() * 9) * TILE;
    orbitY[i] = (1 + rand() * 5) * TILE;
    speed[i] = 0.15 + rand() * 0.5;
    radius[i] = (2 + rand() * 2.5) * TILE;
    intensity[i] = 0.18 + rand() * 0.2;
    r[i] = tint[0];
    g[i] = tint[1];
    b[i] = tint[2];
    x[i] = box.cx + Math.cos(angle[i]) * orbitX[i];
    y[i] = box.cy + Math.sin(angle[i]) * orbitY[i];
  }
  return { x, y, angle, orbitX, orbitY, speed, radius, intensity, r, g, b, count };
}

export function createScene(world, opts = {}) {
  const mode = opts.mode === 'horde' ? 'horde' : 'full';
  const full = mode === 'full';
  const rand = makeRng(opts.seed === undefined ? 1337 : opts.seed);
  const box = viewBox(world);

  const counts = {
    playerShots: full ? TARGET.playerShots : 0,
    enemyShots: full ? TARGET.enemyShots : 0,
    particles: full ? TARGET.particles : 0,
    embers: full ? TARGET.embers : 0,
    lights: full ? TARGET.lights : 0,
  };

  const shots = makeShots(counts.playerShots, counts.enemyShots, box, rand);
  const particles = makeParticles(counts.particles, box, rand);
  const embers = makeEmbers(counts.embers, box, rand);
  const lights = makeLights(counts.lights, box, rand);

  const spanX = box.halfW * 2;
  const spanY = box.halfH * 2;
  let lastCamX = world.cam.x;
  let lastCamY = world.cam.y;

  function step(dt) {
    if (!full) return;

    // Carry the whole field with the camera, then let it drift inside that frame.
    const camX = world.cam.x;
    const camY = world.cam.y;
    const dx = camX - lastCamX;
    const dy = camY - lastCamY;
    lastCamX = camX;
    lastCamY = camY;
    const minX = camX - box.halfW;
    const minY = camY - box.halfH;

    for (let i = 0; i < shots.count; i++) {
      shots.x[i] = wrap(shots.x[i] + dx + shots.vx[i] * dt, minX, spanX);
      shots.y[i] = wrap(shots.y[i] + dy + shots.vy[i] * dt, minY, spanY);
    }

    for (let i = 0; i < particles.count; i++) {
      particles.x[i] = wrap(particles.x[i] + dx + particles.vx[i] * dt, minX, spanX);
      particles.y[i] = wrap(particles.y[i] + dy + particles.vy[i] * dt, minY, spanY);
    }

    for (let i = 0; i < embers.count; i++) {
      embers.x[i] = wrap(embers.x[i] + dx, minX, spanX);
      embers.y[i] = wrap(embers.y[i] + dy, minY, spanY);
    }

    for (let i = 0; i < lights.count; i++) {
      lights.angle[i] += lights.speed[i] * dt;
      lights.x[i] = camX + Math.cos(lights.angle[i]) * lights.orbitX[i];
      lights.y[i] = camY + Math.sin(lights.angle[i]) * lights.orbitY[i];
    }
  }

  const scene = { mode, counts, shots, particles, embers, lights, step };
  world.fx = scene;
  return scene;
}
