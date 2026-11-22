// The simulation: player movement and the Watch Step to design.md section 3, embers and the
// level curve to section 6, one goblin type to section 13. Everything here is fixed-step and
// takes a plain state object, so a test can step it without a browser.

import {
  TILE, DT, MOVE, STEP, EMBER, MAX_SPEED_PX, ACCEL_PX, DECEL_PX, REVERSE_PX, DASH_PX,
  xpNeed, isSecondWind,
} from './tuning.js';
import { resolveWalls, rectWalls } from './collide.js';
import { makeEnemy, stepGoblins } from './goblin.js';

// The flat yard: a walled rectangle with two blocks to slide around. 40 x 24 tiles.
export function yardWalls() {
  const w = 40 * TILE;
  const h = 24 * TILE;
  return [
    ...rectWalls(0, 0, w, h),
    ...rectWalls(9 * TILE, 5 * TILE, 4 * TILE, 3 * TILE),
    ...rectWalls(24 * TILE, 14 * TILE, 6 * TILE, 2 * TILE),
  ];
}

function boundsOf(walls) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.x1 < x0) x0 = w.x1;
    if (w.y1 < y0) y0 = w.y1;
    if (w.x2 > x1) x1 = w.x2;
    if (w.y2 > y1) y1 = w.y2;
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 40 * TILE, y1: 24 * TILE };
  return { x0, y0, x1, y1 };
}

export function createWorld(opts = {}) {
  const walls = opts.walls || yardWalls();
  const bounds = boundsOf(walls);
  const start = opts.start || { x: 20 * TILE, y: 12 * TILE };
  const world = {
    t: 0,
    walls,
    bounds,
    goblinHash: null,
    player: {
      x: start.x, y: start.y, px: start.x, py: start.y,
      vx: 0, vy: 0,
      facing: { x: 1, y: 0 },
      radius: MOVE.hurtRadius,
      dash: { active: false, elapsed: 0, dirX: 1, dirY: 0, fromX: start.x, fromY: start.y },
      reversing: false,
      cooldown: 0,
      iframes: 0,
      dodgeBuffer: 0,
      level: 1,
      xp: 0,
      kills: 0,
    },
    cam: { x: start.x, y: start.y, vx: 0, vy: 0 },
    goblins: [],
    embers: [],
    page: false,      // the bare muster page is open; the game pauses
    flash: 0,         // white edge flash, seconds
    stats: {
      topSpeedTiles: 0,
      accelMs: -1,
      accelFrom: -1,
      dashTiles: 0,
      dashMs: 0,
      levels: 0,
      latencies: [],
    },
  };
  if (opts.goblins) {
    for (let i = 0; i < opts.goblins; i++) {
      spawnGoblin(world, 10 * TILE + (i % 3) * 3 * TILE, 8 * TILE + Math.floor(i / 3) * 3 * TILE,
        { dummy: !!opts.dummies });
    }
  }
  return world;
}

export function spawnEnemy(world, kind, x, y, opts = {}) {
  const e = makeEnemy(kind, x, y, opts);
  // A shield arrives facing the player. Orks spawned on the far side of the yard would
  // otherwise present their back and be free kills, which the positional puzzle cannot afford.
  if (e.steering === 'shield') e.aim = Math.atan2(world.player.y - y, world.player.x - x);
  world.goblins.push(e);
  return e;
}

export function spawnGoblin(world, x, y, opts = {}) {
  return spawnEnemy(world, 'goblin', x, y, opts);
}

export function resetWorld(world) {
  const p = world.player;
  p.x = 20 * TILE;
  p.y = 12 * TILE;
  p.px = p.x;
  p.py = p.y;
  p.vx = 0;
  p.vy = 0;
  p.dash.active = false;
  p.dash.elapsed = 0;
  p.reversing = false;
  p.cooldown = 0;
  p.iframes = 0;
  p.dodgeBuffer = 0;
  world.cam.x = p.x;
  world.cam.y = p.y;
  world.cam.vx = 0;
  world.cam.vy = 0;
  world.t = 0;
  world.page = false;
  world.stats.topSpeedTiles = 0;
  world.stats.accelMs = -1;
  world.stats.accelFrom = -1;
  world.stats.latencies.length = 0;
}

// A dodge press is remembered for STEP.buffer seconds by the simulation, not by the input.
export function queueDodge(world) {
  world.player.dodgeBuffer = STEP.buffer;
}

export function stepWorld(world, intent, dt = DT) {
  const p = world.player;
  world.t += dt;
  p.px = p.x;
  p.py = p.y;

  p.cooldown = Math.max(0, p.cooldown - dt);
  p.iframes = Math.max(0, p.iframes - dt);
  p.dodgeBuffer = Math.max(0, p.dodgeBuffer - dt);
  world.flash = Math.max(0, world.flash - dt * 3);

  // The Watch Step. A press fires on the first step where the dash is ready, within the buffer.
  if (!p.dash.active && p.cooldown === 0 && p.dodgeBuffer > 0) startDash(p, intent);

  if (p.dash.active) {
    const remain = Math.max(0, STEP.duration - p.dash.elapsed);
    const use = Math.min(dt, remain);
    p.x += p.dash.dirX * DASH_PX * use;
    p.y += p.dash.dirY * DASH_PX * use;
    p.vx = p.dash.dirX * DASH_PX;
    p.vy = p.dash.dirY * DASH_PX;
    p.dash.elapsed += use;
    if (p.dash.elapsed >= STEP.duration - 1e-9) {
      p.dash.active = false;
      p.dash.elapsed = 0;
      // Exit a step at running speed, not at dash speed: the move ends when it ends.
      world.stats.dashTiles = Math.hypot(p.x - p.dash.fromX, p.y - p.dash.fromY) / TILE;
      world.stats.dashMs = STEP.duration * 1000;
      p.vx = p.dash.dirX * MAX_SPEED_PX;
      p.vy = p.dash.dirY * MAX_SPEED_PX;
      const left = dt - use;
      if (left > 0) movePlayer(p, intent, left);
    }
  } else {
    movePlayer(p, intent, dt);
  }

  resolveWalls(p, p.radius, world.walls);
  stepGoblins(world, dt);
  stepEmbers(world, dt);
  stepCamera(world, dt);
  measure(world);
}

// Velocity toward the intent at the design's three accelerations (design 3.1).
// A reversal is one continuous ramp at REVERSE_PX until the new direction is reached: if the
// rate dropped back to the normal acceleration the moment the velocity crossed zero, a full
// reverse would take 117 ms instead of 90.
function movePlayer(p, intent, dt) {
  const mag = Math.hypot(intent.x, intent.y);
  const active = mag > 1e-4;
  let tx = 0;
  let ty = 0;

  if (active) {
    const s = Math.min(1, mag) * MAX_SPEED_PX;
    tx = (intent.x / mag) * s;
    ty = (intent.y / mag) * s;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > MAX_SPEED_PX * 0.05 && p.vx * tx + p.vy * ty < 0) p.reversing = true;
  } else {
    p.reversing = false;
  }

  const dvx = tx - p.vx;
  const dvy = ty - p.vy;
  const d = Math.hypot(dvx, dvy);

  let a = ACCEL_PX;
  if (!active) a = DECEL_PX;
  else if (p.reversing) a = REVERSE_PX;

  const max = a * dt;
  if (d <= max) {
    p.vx = tx;
    p.vy = ty;
    p.reversing = false;
  } else {
    p.vx += (dvx / d) * max;
    p.vy += (dvy / d) * max;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const v = Math.hypot(p.vx, p.vy);
  if (v > 1) {
    p.facing.x = p.vx / v;
    p.facing.y = p.vy / v;
  }
}

function startDash(p, intent) {
  let dx = intent.x;
  let dy = intent.y;
  let m = Math.hypot(dx, dy);
  if (m < 0.2) { dx = p.facing.x; dy = p.facing.y; m = 1; }   // movement direction, else facing
  dx /= m;
  dy /= m;
  p.dash.active = true;
  p.dash.elapsed = 0;
  p.dash.dirX = dx;
  p.dash.dirY = dy;
  p.dash.fromX = p.x;
  p.dash.fromY = p.y;
  p.cooldown = STEP.cooldown;
  p.iframes = STEP.iframes;
  p.dodgeBuffer = 0;
  p.facing.x = dx;
  p.facing.y = dy;
}

// Embers drift in inside Reach and snap at the last half tile (design 6).
function stepEmbers(world, dt) {
  const p = world.player;
  const reach = EMBER.reach * TILE;
  const snap = EMBER.snap * TILE;
  for (let i = world.embers.length - 1; i >= 0; i--) {
    const e = world.embers[i];
    e.px = e.x;
    e.py = e.y;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < reach) {
      const speed = d < snap ? 900 : 320;
      const move = Math.min(d, speed * dt);
      e.x += (dx / (d || 1)) * move;
      e.y += (dy / (d || 1)) * move;
    }
    // Measure again after the drift: an ember that arrives this step is picked up this step.
    const d2 = Math.hypot(p.x - e.x, p.y - e.y);
    if (d2 < p.radius + EMBER.radius) {
      world.embers.splice(i, 1);
      addXp(world, e.value);
    }
  }
}

// Camera: lead up to 1.5 tiles in the direction of travel, critically damped, and no lag at all
// during a Watch Step (design 4).
function stepCamera(world, dt) {
  const p = world.player;
  const lead = MOVE.leadTiles * TILE;
  const vx = Math.max(-1, Math.min(1, p.vx / MAX_SPEED_PX));
  const vy = Math.max(-1, Math.min(1, p.vy / MAX_SPEED_PX));
  const tx = p.x + vx * lead;
  const ty = p.y + vy * lead;
  if (p.dash.active) {
    world.cam.x = tx;
    world.cam.y = ty;
    world.cam.vx = 0;
    world.cam.vy = 0;
    return;
  }
  const w = MOVE.cameraOmega;
  world.cam.vx += (-(world.cam.x - tx) * w * w - 2 * w * world.cam.vx) * dt;
  world.cam.vy += (-(world.cam.y - ty) * w * w - 2 * w * world.cam.vy) * dt;
  world.cam.x += world.cam.vx * dt;
  world.cam.y += world.cam.vy * dt;
}

function measure(world) {
  const p = world.player;
  const v = Math.hypot(p.vx, p.vy) / TILE;
  if (v > world.stats.topSpeedTiles) world.stats.topSpeedTiles = v;
  if (p.dash.active) return;
  if (v >= MAX_SPEED_PX / TILE * 0.99) {
    if (world.stats.accelFrom >= 0) {
      world.stats.accelMs = (world.t - world.stats.accelFrom) * 1000;
      world.stats.accelFrom = -1;
    }
  } else if (v < 0.04 * MOVE.maxSpeed) {
    world.stats.accelFrom = world.t;
  }
}

export function addXp(world, amount) {
  const p = world.player;
  const growth = isSecondWind(p.level) ? 2 : 1;   // the second wind, that level only
  p.xp += amount * growth;
  let need = xpNeed(p.level);
  while (p.xp >= need) {
    p.xp -= need;
    p.level += 1;
    world.stats.levels += 1;
    world.page = true;          // the bare page opens and the game holds
    need = xpNeed(p.level);
  }
}

export function spawnEmber(world, x, y, value = 1) {
  if (world.embers.length >= EMBER.cap) {
    // Above the cap, a new ember merges into the nearest one and raises its value.
    let best = null;
    let bd = Infinity;
    for (const e of world.embers) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { best.value += value; return best; }
  }
  const e = { x, y, px: x, py: y, value };
  world.embers.push(e);
  return e;
}
