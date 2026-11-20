// One goblin type: seek the player, separate softly from up to 8 neighbours from the spatial
// hash, and slide along walls (design 3.3, 13.1). Dummies stand still, for the feel gate.

import { TILE, MOVE, GOBLIN } from './tuning.js';
import { ENEMIES } from '../../data/enemies.js';
import { resolveWalls, separate } from './collide.js';

const CELL = GOBLIN.hashCell * TILE;

export function makeGoblin(x, y, opts = {}) {
  const data = ENEMIES.goblin;
  return {
    type: data.id,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    radius: data.radius,
    speed: data.speed,
    dummy: !!opts.dummy,
  };
}

// Cell -> list of goblins. Rebuilt every step; M2 replaces it with the pooled version.
export function buildHash(goblins) {
  const map = new Map();
  for (const g of goblins) {
    const key = `${Math.floor(g.x / CELL)},${Math.floor(g.y / CELL)}`;
    let list = map.get(key);
    if (!list) { list = []; map.set(key, list); }
    list.push(g);
  }
  return map;
}

function neighbours(hash, g) {
  const cx = Math.floor(g.x / CELL);
  const cy = Math.floor(g.y / CELL);
  const out = [];
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      const list = hash.get(`${x},${y}`);
      if (list) for (const o of list) out.push(o);
    }
  }
  return out;
}

export function stepGoblins(world, dt) {
  const hash = buildHash(world.goblins);
  const player = world.player;
  const pushPx = GOBLIN.separationPush;
  const range = GOBLIN.separationRange * TILE;

  for (const g of world.goblins) {
    g.px = g.x;
    g.py = g.y;

    let vx = 0;
    let vy = 0;
    if (!g.dummy) {
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * g.speed * TILE;
      vy = (dy / d) * g.speed * TILE;
    }

    let seen = 0;
    for (const o of neighbours(hash, g)) {
      if (o === g || seen >= GOBLIN.maxNeighbours) continue;
      let sx = g.x - o.x;
      let sy = g.y - o.y;
      const sd = Math.hypot(sx, sy);
      if (sd === 0 || sd > range) continue;
      const w = (1 - sd / range) * pushPx;
      sx /= sd;
      sy /= sd;
      vx += sx * w;
      vy += sy * w;
      seen++;
    }

    const v = Math.hypot(vx, vy);
    const cap = g.speed * TILE * 1.6;
    if (v > cap) { vx = (vx / v) * cap; vy = (vy / v) * cap; }
    g.vx = vx;
    g.vy = vy;
    g.x += vx * dt;
    g.y += vy * dt;
    resolveWalls(g, g.radius, world.walls);
  }

  // Soft bodies: the goblin takes most of a goblin-player overlap, the player very little.
  for (const g of world.goblins) {
    separate(g, g.radius, player, MOVE.hurtRadius, 1 - GOBLIN.bodyPush);
  }
}
