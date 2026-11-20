// Glue: input, fixed-step simulation, drawing and the page. This is the M1 feel rig; it carries
// no stage, no roster and no Tally Room, because those are M3 and M4.

import { DT, MAX_SPEED_PX, STEP } from './sim/tuning.js';
import { createWorld, stepWorld, queueDodge, spawnGoblin, spawnEmber, resetWorld } from './sim/world.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createDraw } from './render/draw.js';
import { createPage } from './ui/page.js';
import { softBell } from './core/bell.js';

function readNumber(el, attr, fallback) {
  if (!el) return fallback;
  const v = el.getAttribute(attr);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function createGame(canvas, opts = {}) {
  const host = canvas.parentElement || document.body;
  const world = createWorld({
    goblins: readNumber(canvas, 'data-goblins', opts.goblins ?? 0),
    dummies: canvas.hasAttribute('data-dummies') || !!opts.dummies,
  });
  for (let i = 0; i < (opts.embers ?? 0); i++) {
    spawnEmber(world, 17 * 64 + (i % 6) * 80, 9 * 64 + Math.floor(i / 6) * 80, 1);
  }

  const input = createInput(host);
  const view = createDraw(canvas, world);
  const pageEl = document.getElementById('page');
  const page = pageEl ? createPage(pageEl) : null;
  const loop = createLoop({ step, draw });

  let slow = 0;          // seconds left of the perfect-step slow motion
  let wasDashing = false;
  let lastPerfect = false;

  if (page) pageEl.addEventListener('transitionend', () => {});

  input.onKey((code) => {
    if (code === 'KeyR') resetWorld(world);
    if (code === 'KeyF') togglePerfect();
  });

  // F is a reward-only debug flag: the design does not define the perfect-step condition yet.
  let perfectOnly = false;
  function togglePerfect() { perfectOnly = !perfectOnly; }

  function step(dt) {
    if (world.page) {
      world.flash = Math.min(1, world.flash + dt * 6);
      return;
    }
    const intent = input.intent();
    if (input.takeDodge()) queueDodge(world);

    const p = world.player;
    const before = Math.hypot(p.vx, p.vy);
    stepWorld(world, intent, dt);
    const after = Math.hypot(p.vx, p.vy);

    // input to first motion, measured on the step that starts the move from a true rest
    if (before === 0 && after > 0 && input.pendingSince >= 0) {
      world.stats.latencies.push(performance.now() - input.pendingSince);
      if (world.stats.latencies.length > 6) world.stats.latencies.shift();
      input.clearPending();
    }

    // A perfect step: a Watch Step started within 40 ms of the press. Reward only, for now.
    if (p.dash.active && !wasDashing) {
      lastPerfect = perfectOnly || world.player.perfectStep === true;
      if (lastPerfect) {
        slow = STEP.perfectSlow;
        softBell();
        world.flash = Math.min(1, world.flash + 0.35);
      }
    }
    wasDashing = p.dash.active;

    if (slow > 0) {
      slow -= dt;
      loop.setTimeScale(STEP.perfectScale);
    } else {
      loop.setTimeScale(1);
    }

    // The bare page holds the game; xp is what opens it.
    if (world.page && page) {
      page.show();
      if (opts.onPage) opts.onPage(world);
    }

    if (opts.onFrame) opts.onFrame(world, dt);
  }

  function draw(alpha) {
    view.draw(alpha);
    if (page && !world.page && page.open) page.hide();
  }

  return {
    world,
    input,
    loop,
    start() { loop.start(); },
    stop() { loop.stop(); input.dispose(); },
    spawnGoblin: (x, y, o) => spawnGoblin(world, x, y, o),
    spawnEmber: (x, y, v) => spawnEmber(world, x, y, v),
    reset: () => resetWorld(world),
    get perfectOnly() { return perfectOnly; },
    get lastPerfect() { return lastPerfect; },
    get maxSpeedPx() { return MAX_SPEED_PX; },
    get dt() { return DT; },
  };
}
