// One goblin type: seek the player, separate softly from up to 8 neighbours from a pooled
// 2-tile spatial hash (design 23.1), and slide along walls (design 3.3, 13.1). Dummies stand
// still, for the feel gate.

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

function clampCell(v, max) {
  return v < 0 ? 0 : v >= max ? max - 1 : v;
}

function createHash(bounds, cellSize, capacity) {
  const cols = Math.max(1, Math.ceil((bounds.x1 - bounds.x0) / cellSize));
  const rows = Math.max(1, Math.ceil((bounds.y1 - bounds.y0) / cellSize));
  const cells = cols * rows;
  return {
    bounds,
    cellSize,
    cols,
    rows,
    capacity,
    starts: new Int32Array(cells + 1),
    cursor: new Int32Array(cells),
    counts: new Int32Array(cells),
    items: new Int32Array(capacity),
    rebuild(goblins) {
      const counts = this.counts;
      counts.fill(0);
      for (let i = 0; i < goblins.length; i++) {
        const g = goblins[i];
        const cx = clampCell(Math.floor((g.x - bounds.x0) / cellSize), cols);
        const cy = clampCell(Math.floor((g.y - bounds.y0) / cellSize), rows);
        counts[cy * cols + cx]++;
      }

      let sum = 0;
      for (let c = 0; c < cells; c++) {
        this.starts[c] = sum;
        sum += counts[c];
        this.cursor[c] = this.starts[c];
      }
      this.starts[cells] = sum;

      for (let i = 0; i < goblins.length; i++) {
        const g = goblins[i];
        const cx = clampCell(Math.floor((g.x - bounds.x0) / cellSize), cols);
        const cy = clampCell(Math.floor((g.y - bounds.y0) / cellSize), rows);
        this.items[this.cursor[cy * cols + cx]++] = i;
      }
    },
  };
}

function ensureHash(world) {
  const goblins = world.goblins;
  let hash = world.goblinHash;
  if (!hash || hash.capacity < goblins.length) {
    hash = createHash(world.bounds, CELL, Math.max(64, goblins.length));
    world.goblinHash = hash;
  }
  return hash;
}

export function stepGoblins(world, dt) {
  const goblins = world.goblins;
  const hash = ensureHash(world);
  hash.rebuild(goblins);

  const player = world.player;
  const pushPx = GOBLIN.separationPush;
  const range = GOBLIN.separationRange * TILE;
  const maxN = GOBLIN.maxNeighbours;
  const cols = hash.cols;
  const rows = hash.rows;
  const cellSize = hash.cellSize;
  const bx = hash.bounds.x0;
  const by = hash.bounds.y0;

  for (let i = 0; i < goblins.length; i++) {
    const g = goblins[i];
    g.px = g.x;
    g.py = g.y;

    let vx = 0;
    let vy = 0;
    if (!g.dummy) {
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      vx = (dx / d) * g.speed * TILE;
      vy = (dy / d) * g.speed * TILE;
    }

    let seen = 0;
    const cx = clampCell(Math.floor((g.x - bx) / cellSize), cols);
    const cy = clampCell(Math.floor((g.y - by) / cellSize), rows);
    for (let yy = cy - 1; yy <= cy + 1 && seen < maxN; yy++) {
      if (yy < 0 || yy >= rows) continue;
      for (let xx = cx - 1; xx <= cx + 1 && seen < maxN; xx++) {
        if (xx < 0 || xx >= cols) continue;
        const cell = yy * cols + xx;
        const start = hash.starts[cell];
        const end = hash.starts[cell + 1];
        for (let k = start; k < end && seen < maxN; k++) {
          const o = goblins[hash.items[k]];
          if (o === g) continue;
          let sx = g.x - o.x;
          let sy = g.y - o.y;
          const sd2 = sx * sx + sy * sy;
          if (sd2 === 0 || sd2 > range * range) continue;
          const sd = Math.sqrt(sd2);
          const w = (1 - sd / range) * pushPx;
          sx /= sd;
          sy /= sd;
          vx += sx * w;
          vy += sy * w;
          seen++;
        }
      }
    }

    const v = Math.sqrt(vx * vx + vy * vy);
    const cap = g.speed * TILE * 1.6;
    if (v > cap) {
      vx = (vx / v) * cap;
      vy = (vy / v) * cap;
    }
    g.vx = vx;
    g.vy = vy;
    g.x += vx * dt;
    g.y += vy * dt;
    // Soft bodies: the goblin takes most of a goblin-player overlap, the player very little.
    // Walls resolve last, so neither the move nor the overlap can leave a goblin inside one.
    separate(g, g.radius, player, MOVE.hurtRadius, 1 - GOBLIN.bodyPush);
    resolveWalls(g, g.radius, world.walls);
  }
}
