// The glue both M1 pages share. The feel gate and the bare page differ only in their options:
// dummies for the gate, chasing goblins and a trickle of embers for the page.

import { createWorld, stepWorld, queueDodge, spawnGoblin, spawnEmber, resetWorld } from './sim/world.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { draw } from './render/draw.js';
import { createPage } from './ui/page.js';
import { softBell } from './core/bell.js';
import { STEP, TILE } from './sim/tuning.js';

export function createGame(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const world = createWorld({
    goblins: opts.goblins === undefined ? 3 : opts.goblins,
    dummies: opts.dummies !== false,
  });
  const input = createInput(canvas);
  const page = createPage(document.getElementById('page'), () => { world.page = false; });

  let latency = -1;
  let perfectUntil = 0;
  let emberTimer = 0;
  let frames = 0;
  let fpsAt = performance.now();
  let fps = 0;

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  }
  fit();
  window.addEventListener('resize', fit);

  // The perfect step's reward, design 3.2. NOTE: the design gives the reward but not the
  // condition, so for now it is fired by hand with F to judge the feel of the reward itself.
  function perfectStep() {
    world.flash = 1;
    perfectUntil = performance.now() + STEP.perfectSlow * 1000;
    softBell();
  }

  input.onKey((code) => {
    if (code === 'KeyR') resetWorld(world);
    if (code === 'KeyF') perfectStep();
  });

  const loop = createLoop({
    step(dt) {
      if (world.page) return;

      if (input.takeDodge()) queueDodge(world);
      const intent = input.intent();

      const before = Math.hypot(world.player.vx, world.player.vy);
      stepWorld(world, intent, dt);
      const after = Math.hypot(world.player.vx, world.player.vy);

      // input to first motion, measured on the step that starts the move from a true rest
      if (before === 0 && after > 0 && input.pendingSince >= 0) {
        latency = performance.now() - input.pendingSince;
        world.stats.latencies.push(latency);
        if (world.stats.latencies.length > 12) world.stats.latencies.shift();
        input.clearPending();
      }

      if (performance.now() < perfectUntil) loop.setTimeScale(STEP.perfectScale);
      else loop.setTimeScale(1);

      if (opts.embers) {
        emberTimer -= dt;
        if (emberTimer <= 0) {
          emberTimer = 0.9;
          const a = Math.random() * Math.PI * 2;
          const r = (2 + Math.random() * 3) * TILE;
          spawnEmber(world, world.player.x + Math.cos(a) * r, world.player.y + Math.sin(a) * r, 1);
        }
      }
    },
    draw(alpha) {
      draw(ctx, canvas, world, alpha);

      frames++;
      const now = performance.now();
      if (now - fpsAt >= 500) {
        fps = (frames * 1000) / (now - fpsAt);
        frames = 0;
        fpsAt = now;
      }

      if (world.page && !page.open) page.show(world.player.level);
      else if (!world.page && page.open) page.hide();

      if (opts.onFrame) opts.onFrame(world, { alpha, latency, fps });
    },
  });

  return {
    world,
    input,
    loop,
    perfectStep,
    start() { loop.start(); },
    stop() { loop.stop(); },
  };
}

export { spawnGoblin };
