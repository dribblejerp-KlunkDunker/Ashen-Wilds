// Canvas 2D drawing for M1 only: the real renderer is WebGL2 instanced, one batched draw call per
// layer (design 23.2), and arrives in M2. Everything here is throwaway except the camera and the
// colour values, which come from the design's art direction (section 20).

import { TILE, VIEW, MAX_SPEED_PX } from '../sim/tuning.js';

const COL = {
  ground: '#14120f',
  groundLine: '#1d1a15',
  wall: '#2b2620',
  wallLip: '#3a332a',
  ember: '#e8b169',
  emberHot: '#ffe0a8',
  goblin: '#6f7d52',
  goblinDark: '#3f4a2e',
  player: '#d9d2c2',
  playerDark: '#6b655a',
  dash: '#8fb6c9',
};

function lerp(a, b, t) { return a + (b - a) * t; }

export function createDraw(canvas, world) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const cam = { x: world.cam.x, y: world.cam.y };
  const view = { w: VIEW.w, h: VIEW.h };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // Cover the screen: the whole reference view is always visible, never letterboxed.
    const s = Math.max(w / VIEW.w, h / VIEW.h);
    view.w = w / s;
    view.h = h / s;
    ctx.setTransform(s, 0, 0, s, w / 2 - (cam.x * s), h / 2 - (cam.y * s));
    return { s, w, h };
  }

  function applyCamera(alpha) {
    const camX = lerp(world.cam.x - world.cam.vx / 120, world.cam.x, alpha);
    const camY = lerp(world.cam.y - world.cam.vy / 120, world.cam.y, alpha);
    cam.x = camX;
    cam.y = camY;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    const w = canvas.width;
    const h = canvas.height;
    const s = Math.max(w / VIEW.w, h / VIEW.h);
    ctx.setTransform(s, 0, 0, s, w / 2 - camX * s, h / 2 - camY * s);
    void r;
    void dpr;
  }

  function draw(alpha) {
    resize();
    applyCamera(alpha);
    const halfW = (canvas.width / Math.max(canvas.width / VIEW.w, canvas.height / VIEW.h)) / 2;
    const halfH = (canvas.height / Math.max(canvas.width / VIEW.w, canvas.height / VIEW.h)) / 2;
    const x0 = cam.x - halfW - TILE;
    const y0 = cam.y - halfH - TILE;
    const x1 = cam.x + halfW + TILE;
    const y1 = cam.y + halfH + TILE;

    ctx.fillStyle = COL.ground;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Tile grid: the ground has a grain so movement can be read by eye.
    ctx.strokeStyle = COL.groundLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(x0 / TILE) * TILE; x < x1; x += TILE) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (let y = Math.floor(y0 / TILE) * TILE; y < y1; y += TILE) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();

    // Walls.
    for (const w of world.walls) {
      const wx = Math.min(w.x1, w.x2);
      const wy = Math.min(w.y1, w.y2);
      const ww = Math.abs(w.x2 - w.x1) || 6;
      const wh = Math.abs(w.y2 - w.y1) || 6;
      ctx.fillStyle = COL.wall;
      ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      ctx.fillStyle = COL.wallLip;
      ctx.fillRect(wx - 3, wy - 3, ww + 6, 3);
    }

    // Embers.
    for (const e of world.embers) {
      const ex = lerp(e.px ?? e.x, e.x, alpha);
      const ey = lerp(e.py ?? e.y, e.y, alpha);
      ctx.beginPath();
      ctx.fillStyle = COL.ember;
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = COL.emberHot;
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Goblins: a body, a darker hood, and a facing notch where the nose goes.
    for (const g of world.goblins) {
      const gx = lerp(g.px ?? g.x, g.x, alpha);
      const gy = lerp(g.py ?? g.y, g.y, alpha);
      ctx.beginPath();
      ctx.fillStyle = COL.goblinDark;
      ctx.arc(gx, gy, g.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = COL.goblin;
      ctx.arc(gx, gy, g.radius, 0, Math.PI * 2);
      ctx.fill();
      const v = Math.hypot(g.vx, g.vy) || 1;
      ctx.beginPath();
      ctx.fillStyle = COL.goblinDark;
      ctx.arc(gx + (g.vx / v) * g.radius * 0.55, gy + (g.vy / v) * g.radius * 0.55, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player: a disc, a faint outer glow, and a lingering trail from a Watch Step.
    const p = world.player;
    const px = lerp(p.px ?? p.x, p.x, alpha);
    const py = lerp(p.py ?? p.y, p.y, alpha);
    const speed = Math.hypot(p.vx, p.vy);

    if (p.dash.active || p.cooldown > 0) {
      const a = p.dash.active ? 0.28 : 0.12 * (p.cooldown / 2.4);
      const dist = p.dash.active ? Math.hypot(px - p.dash.fromX, py - p.dash.fromY) : 0;
      if (dist > 1) {
        ctx.strokeStyle = `rgba(143, 182, 201, ${a})`;
        ctx.lineWidth = p.radius * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.dash.fromX, p.dash.fromY);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }

    const glow = 10 + 6 * Math.min(1, speed / MAX_SPEED_PX);
    const grad = ctx.createRadialGradient(px, py, p.radius * 0.4, px, py, p.radius + glow);
    grad.addColorStop(0, 'rgba(217, 210, 194, 0.22)');
    grad.addColorStop(1, 'rgba(217, 210, 194, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, p.radius + glow, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = p.iframes > 0 ? COL.dash : COL.player;
    ctx.arc(px, py, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = COL.playerDark;
    ctx.arc(px + p.facing.x * 5, py + p.facing.y * 5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // A white edge when the page opens: the game is holding, not running.
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.10 * world.flash})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  return { draw, resize };
}
