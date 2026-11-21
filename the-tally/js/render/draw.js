// The Canvas 2D baseline. The feel gate uses it, and the stress page can run it with
// ?renderer=canvas as the before-WebGL reference; the M2 path is render/gl.js.
// Draw order follows design 4: ground, ground effects, pickups, enemies, player, UI.

import { TILE, VIEW, MOVE, EMBER, MAX_SPEED_PX } from '../sim/tuning.js';

const COL = {
  ground: '#0b0e0c',
  grid: '#141a15',
  wall: '#31382f',
  ember: '#c05a30',
  emberHot: '#e2a452',
  goblin: '#46583a',
  goblinDark: '#2c3826',
  eye: '#cfc39c',
  player: '#e9e1c9',
  ring: '#a9a48d',
  glow: 'rgba(242, 194, 107, 0.16)',
  iframe: 'rgba(233, 225, 201, 0.55)',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function draw(ctx, canvas, world, alpha) {
  const camX = world.cam.x;
  const camY = world.cam.y;
  const s = Math.max(canvas.width / VIEW.w, canvas.height / VIEW.h);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COL.ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(s, 0, 0, s, canvas.width / 2 - camX * s, canvas.height / 2 - camY * s);

  drawGround(ctx, canvas, s, camX, camY);
  drawParticles(ctx, world);
  drawWalls(ctx, world);
  drawEmbers(ctx, world, alpha);

  const p = world.player;
  const px = lerp(p.px, p.x, alpha);
  const py = lerp(p.py, p.y, alpha);

  for (const g of world.goblins) {
    drawGoblin(ctx, lerp(g.px, g.x, alpha), lerp(g.py, g.y, alpha), g, px, py);
  }
  drawPlayer(ctx, p, px, py);
  drawShots(ctx, world.fx);
  drawLights(ctx, world.fx);

  if (world.flash > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, world.flash) * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawGround(ctx, canvas, s, camX, camY) {
  const halfW = canvas.width / (2 * s);
  const halfH = canvas.height / (2 * s);
  const x0 = Math.floor((camX - halfW) / TILE) * TILE;
  const x1 = Math.ceil((camX + halfW) / TILE) * TILE;
  const y0 = Math.floor((camY - halfH) / TILE) * TILE;
  const y1 = Math.ceil((camY + halfH) / TILE) * TILE;
  ctx.strokeStyle = COL.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += TILE) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  for (let y = y0; y <= y1; y += TILE) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
}

function drawWalls(ctx, world) {
  ctx.strokeStyle = COL.wall;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const w of world.walls) {
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
  }
  ctx.stroke();
}

function drawEmbers(ctx, world, alpha) {
  for (const e of world.embers) {
    const x = lerp(e.px, e.x, alpha);
    const y = lerp(e.py, e.y, alpha);
    const hot = e.value >= 25;
    ctx.fillStyle = hot ? COL.emberHot : COL.ember;
    ctx.beginPath();
    ctx.arc(x, y, hot ? EMBER.radius : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const fx = world.fx;
  if (!fx || !fx.embers) return;
  const pool = fx.embers;
  ctx.fillStyle = COL.ember;
  for (let i = 0; i < pool.count; i++) {
    ctx.beginPath();
    ctx.arc(pool.x[i], pool.y[i], 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The stress scene's ground effects. Flat squares on purpose: the Canvas path is the reference,
// not the picture, and per-particle gradients would measure the wrong thing.
function drawParticles(ctx, world) {
  const fx = world.fx;
  if (!fx || !fx.particles) return;
  const pool = fx.particles;
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < pool.count; i++) {
    const tint = pool.tint[i];
    ctx.fillStyle = tint === 0 ? COL.ember : tint === 1 ? '#b9c3a8' : '#7fa3a0';
    const size = pool.size[i];
    ctx.fillRect(pool.x[i] - size, pool.y[i] - size, size * 2, size * 2);
  }
  ctx.globalAlpha = 1;
}

function drawShots(ctx, fx) {
  if (!fx || !fx.shots) return;
  const shots = fx.shots;
  for (let i = 0; i < shots.count; i++) {
    const player = shots.kind[i] === 0;
    ctx.fillStyle = player ? '#f2c26b' : '#9ec9d8';
    ctx.beginPath();
    ctx.arc(shots.x[i], shots.y[i], player ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The light pass, additively. Thirty radial gradients is what the Canvas reference costs; the
// WebGL path draws the same falloff from one atlas frame.
function drawLights(ctx, fx) {
  if (!fx || !fx.lights) return;
  const lights = fx.lights;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < lights.count; i++) {
    const x = lights.x[i];
    const y = lights.y[i];
    const r = lights.radius[i];
    const tint = 'rgba(' + Math.round(lights.r[i] * 255) + ',' + Math.round(lights.g[i] * 255)
      + ',' + Math.round(lights.b[i] * 255) + ',';
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, tint + lights.intensity[i].toFixed(3) + ')');
    glow.addColorStop(1, tint + '0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGoblin(ctx, x, y, g, px, py) {
  ctx.fillStyle = COL.goblin;
  ctx.strokeStyle = COL.goblinDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, g.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (g.dummy) {
    ctx.strokeStyle = 'rgba(207, 195, 156, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, g.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const dx = px - x;
  const dy = py - y;
  const d = Math.hypot(dx, dy) || 1;
  const ex = (dx / d) * 4;
  const ey = (dy / d) * 4;
  ctx.fillStyle = COL.eye;
  ctx.beginPath();
  ctx.arc(x - 4 + ex, y - 2 + ey, 1.6, 0, Math.PI * 2);
  ctx.arc(x + 4 + ex, y - 2 + ey, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, p, x, y) {
  // The player's own light is tallow yellow and small (design 4).
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 150);
  glow.addColorStop(0, COL.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 150, 0, Math.PI * 2);
  ctx.fill();

  if (p.dash.active) {
    const back = MOVE.hurtRadius * 2.2;
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.06 * i;
      ctx.fillStyle = COL.player;
      ctx.beginPath();
      ctx.arc(x - p.dash.dirX * back * i, y - p.dash.dirY * back * i, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = p.iframes > 0 ? COL.iframe : COL.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, MOVE.hurtRadius + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = COL.player;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COL.player;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + p.facing.x * 15, y + p.facing.y * 15);
  ctx.stroke();
}
