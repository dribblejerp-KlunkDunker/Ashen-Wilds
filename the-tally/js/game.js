// The glue every page shares. The feel gate, the bare page and the M2 stress harness differ only
// in their options and their renderer.

import { createWorld, stepWorld, queueDodge, spawnEmber, resetWorld } from './sim/world.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { draw as drawCanvas } from './render/draw.js';
import { createGlRenderer } from './render/gl.js';
import { createPage } from './ui/page.js';
import { budgetScale, createQualityStepper, MAX_PIXELS } from './render/resolution.js';
import { softBell } from './core/bell.js';
import { STEP, TILE } from './sim/tuning.js';

function makeRenderer(canvas, mode) {
  if (mode === 'webgl') return createGlRenderer(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  const stats = { instances: 0, drawCalls: null, culled: 0, contextLost: false };
  return {
    stats,
    gpuTiming: { supported: false, samples: 0, dropped: 0, skipped: 0 },
    pollGpu() { return null; },
    draw(world, alpha) {
      drawCanvas(ctx, canvas, world, alpha);
      const fx = world.fx;
      // The reference path draws the same scene, so its count has to match what it drew.
      stats.instances = world.goblins.length + 1
        + (fx ? fx.shots.count + fx.particles.count + fx.embers.count + fx.lights.count : 0);
    },
    info() { return { context: 'canvas2d' }; },
  };
}

export function createGame(canvas, opts = {}) {
  const renderer = makeRenderer(canvas, opts.renderer);
  const control = opts.control;
  const world = createWorld({
    goblins: opts.goblins === undefined ? 3 : opts.goblins,
    dummies: opts.dummies !== false,
  });
  if (opts.onWorld) opts.onWorld(world);
  const input = createInput(canvas);
  const page = createPage(document.getElementById('page'), () => { world.page = false; });

  let latency = -1;
  let perfectUntil = 0;
  let emberTimer = 0;
  let frames = 0;
  let fpsAt = performance.now();
  let fps = 0;
  const frameInfo = {
    latency: -1,
    fps: 0,
    submitMs: 0,
    gpuMs: null,
    stats: renderer.stats,
  };

  // The drawing buffer is the scene's main cost on a Chromebook: a 4K or 2x panel would otherwise
  // shade four times the pixels for the same picture. The budget caps it at 1080p worth, and the
  // stepper gives up to 40% more back when even that misses the frame.
  const dprCap = opts.dpr ? Math.min(2, Math.max(0.5, opts.dpr)) : 2;
  const maxPixels = opts.maxPixels === undefined ? MAX_PIXELS : opts.maxPixels;
  const pinnedQuality = opts.quality === undefined ? null : Math.min(1, Math.max(0.4, opts.quality));
  const qualityStepper = pinnedQuality === null ? createQualityStepper(opts.minQuality) : null;
  let quality = pinnedQuality === null ? 1 : pinnedQuality;
  let lastDrawAt = 0;

  function fit() {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const budget = budgetScale(width, height, dpr, maxPixels);
    const scale = budget * quality;
    canvas.width = Math.max(1, Math.round(width * dpr * scale));
    canvas.height = Math.max(1, Math.round(height * dpr * scale));
    const stats = renderer.stats;
    stats.dpr = dpr;
    stats.budgetScale = budget;
    stats.scale = scale;
    stats.quality = quality;
    stats.maxPixels = maxPixels;
  }
  fit();
  window.addEventListener('resize', () => {
    if (qualityStepper) qualityStepper.reset();
    fit();
  });

  // The perfect step's reward, design 3.2. NOTE: the design gives the reward but not the
  // condition, so for now it is fired by hand with F to judge the feel of the reward itself.
  function perfectStep() {
    world.flash = 1;
    perfectUntil = performance.now() + STEP.perfectSlow * 1000;
    softBell();
  }

  input.onKey((code) => {
    if (code === 'KeyR' && opts.reset !== false) resetWorld(world);
    // The feel pages fire the perfect step by hand; a page with no condition for it opts out,
    // so an accidental F cannot slow the run.
    if (code === 'KeyF' && opts.perfect !== false) perfectStep();
  });

  const loop = createLoop({
    step(dt) {
      if (world.page) return;

      if (control ? control.takeDodge(world) : input.takeDodge()) queueDodge(world);
      const intent = control ? control.intent(world, dt) : input.intent();

      const before = Math.hypot(world.player.vx, world.player.vy);
      const stepStart = performance.now();
      // The page may own the step (the M3 vertical adds combat and a director around it); the
      // default is still the bare M1/M2 world.
      if (opts.stepSim) opts.stepSim(world, intent, dt);
      else stepWorld(world, intent, dt);
      // Extra load steps inside the timed region, so the simulation gate measures it too.
      if (opts.stepExtras) opts.stepExtras(world, dt);
      const stepMs = performance.now() - stepStart;
      if (opts.onStep) opts.onStep(stepMs);
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
      const renderStart = performance.now();
      if (qualityStepper && lastDrawAt > 0) {
        const next = qualityStepper.sample(renderStart - lastDrawAt, quality);
        if (next !== quality) {
          quality = next;
          fit();
        }
      }
      lastDrawAt = renderStart;
      renderer.draw(world, alpha);
      const submitMs = performance.now() - renderStart;
      const gpuMs = renderer.pollGpu ? renderer.pollGpu() : null;

      frames++;
      const now = performance.now();
      if (now - fpsAt >= 500) {
        fps = (frames * 1000) / (now - fpsAt);
        frames = 0;
        fpsAt = now;
      }

      if (world.page && !page.open) page.show(world.player.level);
      else if (!world.page && page.open) page.hide();

      if (opts.onFrame) {
        frameInfo.latency = latency;
        frameInfo.fps = fps;
        frameInfo.submitMs = submitMs;
        frameInfo.gpuMs = gpuMs;
        frameInfo.stats = renderer.stats;
        opts.onFrame(world, frameInfo);
      }
    },
  });

  return {
    world,
    input,
    loop,
    renderer,
    perfectStep,
    start() { loop.start(); },
    stop() { loop.stop(); },
  };
}
