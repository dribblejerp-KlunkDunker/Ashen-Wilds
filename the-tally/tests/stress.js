// The M2 capture harness behind tests/stress.html: a deterministic horde, a warm-up, one timed
// sample, gate evaluation and a JSON report. The page stays markup; this is the measurement, so
// it can be checked with node --check without opening a browser.

import { createGame } from '../js/game.js';
import { spawnGoblin } from '../js/sim/world.js';
import { DT, TILE } from '../js/sim/tuning.js';
import { createScene } from './scene.js';

const GOLDEN = 2.399963229728653;
const DEFAULT_COUNT = 1500;
const MAX_COUNT = 4000;
const GRAPH_POINTS = 180;
const LIVE_WINDOW = 300;   // the HUD reads a rolling window, so a long sample never costs a big sort
const GATES = {
  frameP95: 16.7,
  over20Pct: 1,
  meanFps: 59,
  simP95: 4,
  simRate: 119,            // 120 Hz less a rounding step
  submitP95: 6,
  gpuP95: 16.7,
};

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function readNumber(name, fallback, min, max) {
  const raw = Number.parseFloat(params.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

const count = Math.round(readNumber('n', DEFAULT_COUNT, 0, MAX_COUNT));
const seed = Math.trunc(readNumber('seed', 1337, -2147483648, 2147483647));
const warmupSeconds = readNumber('warmup', 5, 0, 60);
const sampleSeconds = readNumber('sample', 60, 1, 180);
const dpr = readNumber('dpr', 2, 1, 2);
const qualityParam = Number.parseFloat(params.get('quality'));
const quality = Number.isFinite(qualityParam) ? Math.max(0.4, Math.min(1, qualityParam)) : undefined;
const rendererMode = params.get('renderer') === 'canvas' ? 'canvas' : 'webgl';
const sceneMode = params.get('mode') === 'horde' ? 'horde' : 'full';
const drawTarget = sceneMode === 'full' ? 6 : 2;
const warmupMs = warmupSeconds * 1000;
const sampleMs = sampleSeconds * 1000;

const canvas = $('game');
const graph = $('graph');
const gctx = graph.getContext('2d');

const state = {
  phase: 'boot',
  lastFrame: 0,
  warmupStart: 0,
  sampleStart: 0,
  finishedAt: 0,
  lastHud: 0,
  graphTimes: [],
  frameTimes: [],
  simTimes: [],
  submitTimes: [],
  gpuTimes: [],
  minQuality: 1,
  maxDrawCalls: 0,
  maxInstances: 0,
  hiddenDuring: document.hidden,
  startedAt: new Date().toISOString(),
  report: null,
};

let game = null;
let scene = null;

$('count').textContent = String(count);
$('seed').textContent = String(seed);
$('mode').textContent = (rendererMode === 'webgl' ? 'webgl2' : 'canvas2d') + ' / ' + sceneMode;
$('m-draws-target').textContent = '<= ' + drawTarget;
$('m-scene-target').textContent = sceneMode === 'full' ? 'full 23.4' : 'horde baseline';

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function makeRng(seedValue) {
  let a = seedValue >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setPhase(text) {
  $('phase').textContent = text;
}

function setProgress(value) {
  const pct = clamp(value, 0, 1) * 100;
  $('fill').style.width = pct.toFixed(1) + '%';
}

function row(id, text, ok) {
  const cell = $(id);
  cell.textContent = text;
  const tr = cell.parentElement;
  tr.classList.toggle('good', ok === true);
  tr.classList.toggle('bad', ok === false);
}

function statsOf(values) {
  const n = values.length;
  if (!n) return { n: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += values[i];
  function at(q) {
    const pos = (n - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  return {
    n,
    mean: sum / n,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: sorted[n - 1],
  };
}

function recent(values) {
  return values.length > LIVE_WINDOW ? values.slice(-LIVE_WINDOW) : values;
}

function frameSummary(values) {
  const base = statsOf(values);
  let over20 = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 20) over20++;
  }
  return {
    ...base,
    fpsMean: base.mean > 0 ? 1000 / base.mean : 0,
    over20Pct: base.n > 0 ? (over20 / base.n) * 100 : 0,
  };
}

function sampleSecondsSoFar() {
  if (!state.sampleStart) return 0;
  const end = state.finishedAt || performance.now();
  return Math.max(0, (end - state.sampleStart) / 1000);
}

// One place for every statistic and gate, so the HUD, the summary and the JSON cannot disagree.
function summarize(live) {
  const frame = frameSummary(live ? recent(state.frameTimes) : state.frameTimes);
  const sim = statsOf(live ? recent(state.simTimes) : state.simTimes);
  const submit = statsOf(live ? recent(state.submitTimes) : state.submitTimes);
  const gpu = statsOf(live ? recent(state.gpuTimes) : state.gpuTimes);
  const timing = game && game.renderer.gpuTiming;
  const gpuSupported = !!(timing && timing.supported);
  const gpuMeasured = gpuSupported && gpu.n >= 30 && gpu.n >= frame.n * 0.25;
  const renderBudgetP95 = gpuMeasured ? gpu.p95 : frame.p95;
  const seconds = sampleSecondsSoFar();
  // The rate is always the whole sample, never the HUD's rolling window: a window divided by the
  // full duration would read a fraction of the real rate.
  const stepRateHz = seconds > 0 ? state.simTimes.length / seconds : 0;

  const gates = {
    frameP95: frame.n > 0 && frame.p95 <= GATES.frameP95,
    over20: frame.n > 0 && frame.over20Pct < GATES.over20Pct,
    meanFps: frame.n > 0 && frame.fpsMean >= GATES.meanFps,
    simP95: sim.n > 0 && sim.p95 <= GATES.simP95,
    simRate: sim.n > 0 && stepRateHz >= GATES.simRate,
    submitP95: submit.n > 0 && submit.p95 <= GATES.submitP95,
    gpuP95: gpuMeasured && gpu.p95 <= GATES.gpuP95,
    renderBudget: frame.n > 0 && renderBudgetP95 <= GATES.frameP95,
  };
  // The sim-rate gate matters because the loop runs at most five 120 Hz steps per frame:
  // below about 24 fps the simulation itself slows, and its step times are no longer real-time.
  const allTargets = gates.frameP95 && gates.over20 && gates.meanFps && gates.simP95
    && gates.simRate && gates.submitP95 && gates.renderBudget;

  return { frame, sim, submit, gpu, gpuSupported, gpuMeasured, renderBudgetP95, stepRateHz, gates, allTargets };
}

function updateLive() {
  const done = state.phase === 'done';
  const s = summarize(!done);   // at the end the HUD must agree with the report
  const haveFrame = s.frame.n > 0;
  const haveSim = s.sim.n > 0;
  const haveSubmit = s.submit.n > 0;
  const haveGpu = s.gpuSupported && s.gpu.n > 0;

  row('m-mean', haveFrame ? s.frame.mean.toFixed(2) + ' ms' : '--', null);
  row('m-p95', haveFrame ? s.frame.p95.toFixed(2) + ' ms' : '--', done ? s.gates.frameP95 : null);
  row('m-over', haveFrame ? s.frame.over20Pct.toFixed(2) + '%' : '--', done ? s.gates.over20 : null);
  row('m-fps', haveFrame ? s.frame.fpsMean.toFixed(1) + ' fps' : '--', done ? s.gates.meanFps : null);
  row('m-sim', haveSim ? s.sim.p95.toFixed(2) + ' ms' : '--', done ? s.gates.simP95 : null);
  row('m-rate', haveSim ? s.stepRateHz.toFixed(0) + ' /s' : '--', done ? s.gates.simRate : null);
  row('m-gpu', haveGpu ? s.gpu.p95.toFixed(2) + ' ms' : (s.gpuSupported ? 'waiting' : 'n/a'),
    done && haveGpu ? s.gates.gpuP95 : null);
  row('m-submit', haveSubmit ? s.submit.p95.toFixed(2) + ' ms' : '--', done ? s.gates.submitP95 : null);

  const stats = game && game.renderer.stats;
  if (stats) {
    $('m-draws').textContent = stats.drawCalls == null ? 'n/a' : String(stats.drawCalls);
    $('m-instances').textContent = stats.instances === undefined ? 'n/a' : String(stats.instances);
    if (scene) {
      $('m-scene').textContent = scene.mode === 'full'
        ? scene.counts.playerShots + '+' + scene.counts.enemyShots + ' / '
          + scene.counts.particles + ' / ' + scene.counts.lights
        : 'goblins only';
    }
    // The scale is the buffer against the client, budget and stepper together; quality alone hides
    // the 1080p cap on a high-DPI panel.
    const scale = stats.scale === undefined ? 1 : stats.scale;
    $('m-scale').textContent = scale.toFixed(2) + ' (' + canvas.width + 'x' + canvas.height + ')';
  }
}

function drawGraph() {
  const w = graph.width;
  const h = graph.height;
  gctx.clearRect(0, 0, w, h);
  gctx.fillStyle = '#080b09';
  gctx.fillRect(0, 0, w, h);

  gctx.font = '10px ui-monospace, monospace';
  gctx.textAlign = 'left';
  gctx.textBaseline = 'alphabetic';
  for (const ms of [16.7, 33.3, 50]) {
    const y = h - Math.min(1, ms / 50) * (h - 6) - 3;
    gctx.strokeStyle = ms === 16.7 ? 'rgba(169, 214, 154, 0.35)' : 'rgba(233, 225, 201, 0.14)';
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(0, y);
    gctx.lineTo(w, y);
    gctx.stroke();
    gctx.fillStyle = 'rgba(141, 138, 124, 0.7)';
    gctx.fillText(ms.toFixed(1), 4, Math.max(9, y - 2));
  }

  gctx.textAlign = 'right';
  gctx.fillStyle = 'rgba(141, 138, 124, 0.7)';
  gctx.fillText('frame ms', w - 5, 11);
  gctx.textAlign = 'left';

  const data = state.graphTimes;
  if (data.length < 2) return;
  gctx.strokeStyle = '#f2c26b';
  gctx.lineWidth = 1.5;
  gctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h - Math.min(1, data[i] / 50) * (h - 6) - 3;
    if (i === 0) gctx.moveTo(x, y);
    else gctx.lineTo(x, y);
  }
  gctx.stroke();
}

function downloadReport() {
  if (!state.report) return;
  const text = JSON.stringify(state.report, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'the-tally-stress-' + state.report.count + '-' + rendererMode + '-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function gateLine(label, value, ok) {
  const line = document.createElement('div');
  line.className = ok ? 'ok' : 'bad';
  line.textContent = (ok ? 'PASS ' : 'FAIL ') + label + ' - ' + value;
  return line;
}

function showResult(report) {
  $('result').hidden = false;
  const where = report.environment.chromeOS ? 'ChromeOS machine' : 'non-ChromeOS machine (smoke test only)';
  $('summary').textContent = (report.passed ? 'All proposed targets met' : 'One or more targets missed') + ' - ' + where + '.';

  const lines = [
    gateLine('frame budget p95', report.frame.p95Ms.toFixed(2) + ' ms (target <= ' + GATES.frameP95 + ')', report.gates.frameP95),
    gateLine('frames over 20 ms', report.frame.over20Pct.toFixed(2) + '% (target < ' + GATES.over20Pct + '%)', report.gates.over20),
    gateLine('mean frame rate', report.frame.fpsMean.toFixed(1) + ' fps (target >= ' + GATES.meanFps + ')', report.gates.meanFps),
    gateLine('step p95', report.sim.p95Ms.toFixed(2) + ' ms (target <= ' + GATES.simP95 + ')', report.gates.simP95),
    gateLine('sim rate', report.sample.stepRateHz.toFixed(1) + ' steps/s (target >= ' + GATES.simRate + ')', report.gates.simRate),
    gateLine('CPU submit p95', report.render.submit.p95Ms.toFixed(2) + ' ms (target <= ' + GATES.submitP95 + ')', report.gates.submitP95),
  ];

  if (report.render.gpu.supported && report.render.gpu.measured) {
    lines.push(gateLine('GPU p95', report.render.gpu.p95Ms.toFixed(2) + ' ms (target <= ' + GATES.gpuP95 + ')', report.gates.gpuP95));
  } else {
    const fallback = document.createElement('div');
    fallback.textContent = report.render.gpu.supported
      ? 'GPU timer gave too few samples - the frame budget above is the render gate.'
      : 'GPU timer unavailable - the frame budget above is the render gate.';
    lines.push(fallback);
  }

  const extra = document.createElement('div');
  if (report.visibility.hiddenDuring) {
    extra.className = 'bad';
    extra.textContent = 'INVALID - the tab was hidden during the capture. Rerun with it focused.';
  } else if (report.renderer.contextLost) {
    extra.className = 'bad';
    extra.textContent = 'INVALID - the WebGL context was lost. Rerun on the target machine.';
  } else {
    extra.className = 'ok';
    extra.textContent = 'Clean capture - ' + report.sample.actualSeconds.toFixed(1) + ' s, '
      + report.sample.frameCount + ' frames, ' + report.sample.stepCount + ' steps, '
      + report.sample.stepRateHz.toFixed(1) + ' steps/s, buffer '
      + report.resolution.scale.toFixed(2) + 'x (' + report.environment.viewport.bufferWidth
      + 'x' + report.environment.viewport.bufferHeight + ').';
  }

  const load = document.createElement('div');
  load.textContent = report.scene.mode === 'full'
    ? 'Scene: the 23.4 target load - 1,500 goblins, 600+200 projectiles, 3,000 particles, 400 embers, 30 lights.'
    : 'Scene: the horde baseline - 1,500 goblins, no projectiles, particles, embers or lights.';

  const gpu = document.createElement('div');
  gpu.textContent = 'GPU: ' + (report.renderer.gpu || report.renderer.context);

  $('gates').textContent = '';
  $('gates').append(...lines, extra, load, gpu);
}

function buildReport() {
  const s = summarize(false);
  const world = game.world;
  const stats = game.renderer.stats;
  const timing = game.renderer.gpuTiming || { dropped: 0, skipped: 0 };

  let info = {};
  try {
    info = game.renderer.info() || {};
  } catch (err) {
    info = { error: String(err) };
  }

  const contextLost = !!stats.contextLost;
  const actualSeconds = sampleSecondsSoFar();
  const clean = !state.hiddenDuring && !contextLost;
  const complete = actualSeconds >= sampleSeconds * 0.95 && s.frame.n > 0;
  const chromeOS = /CrOS/.test(navigator.userAgent);

  return {
    schema: 'the-tally/stress-capture/2',
    capturedAt: new Date().toISOString(),
    startedAt: state.startedAt,
    url: location.href,
    count,
    seed,
    method: 'RAF-to-RAF wall time; stepWorld and CPU render submission wrapped in performance.now; '
      + 'GPU time from EXT_disjoint_timer_query_webgl2 when exposed. The render gate is the 16.7 ms '
      + 'frame budget; GPU p95 is the measured breakdown only when the timer supplies it. A run below '
      + '119 steps/s fails: the loop runs at most five 120 Hz steps per frame, so below about 24 fps '
      + 'the simulation slows and its step times are not real-time evidence. The drawing buffer is '
      + 'capped by a pixel budget and may shrink before the sample to hold the frame; `resolution` '
      + 'records what the run actually drew. Percentiles by linear interpolation.',
    renderer: {
      requested: rendererMode,
      context: info.context || 'unknown',
      gpu: info.renderer || null,
      vendor: info.vendor || null,
      version: info.version || null,
      shading: info.shading || null,
      drawCalls: stats.drawCalls,
      drawCallsMax: stats.drawCalls == null ? null : state.maxDrawCalls,
      instances: stats.instances,
      instancesMax: state.maxInstances,
      culled: stats.culled || 0,
      contextLost,
    },
    resolution: {
      maxPixels: stats.maxPixels === undefined ? null : stats.maxPixels,
      quality: stats.quality === undefined ? 1 : stats.quality,
      minQuality: state.minQuality,
      budgetScale: stats.budgetScale === undefined ? 1 : stats.budgetScale,
      scale: stats.scale === undefined ? 1 : stats.scale,
      dpr: stats.dpr === undefined ? window.devicePixelRatio || 1 : stats.dpr,
    },
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform,
      chromeOS,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      dpr: window.devicePixelRatio || 1,
      dprCap: dpr,
      screen: { width: screen.width, height: screen.height },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
      },
    },
    sample: {
      warmupSeconds,
      sampleSeconds,
      actualSeconds,
      frameCount: s.frame.n,
      stepCount: s.sim.n,
      gpuCount: s.gpu.n,
      stepRateHz: s.stepRateHz,
    },
    visibility: {
      hiddenDuring: state.hiddenDuring,
      state: document.visibilityState,
    },
    frame: {
      meanMs: s.frame.mean,
      p50Ms: s.frame.p50,
      p95Ms: s.frame.p95,
      p99Ms: s.frame.p99,
      maxMs: s.frame.max,
      fpsMean: s.frame.fpsMean,
      over20Pct: s.frame.over20Pct,
    },
    sim: {
      meanMs: s.sim.mean,
      p95Ms: s.sim.p95,
      maxMs: s.sim.max,
    },
    render: {
      submit: {
        meanMs: s.submit.mean,
        p95Ms: s.submit.p95,
        maxMs: s.submit.max,
      },
      gpu: s.gpuSupported
        ? {
          supported: true,
          measured: s.gpuMeasured,
          samples: s.gpu.n,
          meanMs: s.gpu.mean,
          p95Ms: s.gpu.p95,
          maxMs: s.gpu.max,
          dropped: timing.dropped || 0,
          skipped: timing.skipped || 0,
        }
        : { supported: false, measured: false, samples: 0 },
    },
    scene: {
      mode: sceneMode,
      goblins: world.goblins.length,
      walls: world.walls.length,
      playerShots: scene ? scene.counts.playerShots : 0,
      enemyShots: scene ? scene.counts.enemyShots : 0,
      particles: scene ? scene.counts.particles : 0,
      embers: scene ? scene.counts.embers : 0,
      lights: scene ? scene.counts.lights : 0,
      drawTarget,
    },
    gates: {
      thresholds: GATES,
      ...s.gates,
      allTargets: s.allTargets,
      clean,
      complete,
      passed: s.allTargets && clean && complete,
      chromeOS,
    },
    samplesMs: {
      frame: state.frameTimes.map(round3),
      sim: state.simTimes.map(round3),
      submit: state.submitTimes.map(round3),
      gpu: state.gpuTimes.map(round3),
    },
  };
}

function finish() {
  if (state.phase !== 'sample') return;
  state.phase = 'done';
  state.finishedAt = performance.now();
  setProgress(1);
  setPhase('complete');
  game.stop();

  state.report = buildReport();
  window.tallyReport = state.report;
  $('download').disabled = false;
  updateLive();
  showResult(state.report);
  drawGraph();

  setTimeout(() => {
    if (state.phase === 'done') downloadReport();
  }, 600);
}

function startSample(now) {
  state.phase = 'sample';
  state.sampleStart = now;
  state.frameTimes.length = 0;
  state.simTimes.length = 0;
  state.submitTimes.length = 0;
  state.gpuTimes.length = 0;
  state.minQuality = game && game.renderer.stats.quality !== undefined ? game.renderer.stats.quality : 1;
  state.maxDrawCalls = 0;
  state.maxInstances = 0;
  state.lastHud = 0;
  setPhase('sampling ' + sampleSeconds.toFixed(0) + ' s');
  setProgress(0);
}

function onFrame(world, info) {
  const now = performance.now();

  if (!state.lastFrame) {
    state.lastFrame = now;
    state.warmupStart = now;
    if (warmupSeconds === 0) {
      startSample(now);
    } else {
      state.phase = 'warmup';
      setPhase('warming up ' + warmupSeconds.toFixed(0) + ' s');
    }
    updateLive();
    drawGraph();
    return;
  }

  const delta = now - state.lastFrame;
  state.lastFrame = now;
  if (delta > 0) {
    state.graphTimes.push(delta);
    if (state.graphTimes.length > GRAPH_POINTS) state.graphTimes.shift();
  }

  if (state.phase === 'warmup') {
    const elapsed = now - state.warmupStart;
    setProgress(warmupMs > 0 ? elapsed / warmupMs : 1);
    if (now - state.lastHud >= 250) {
      updateLive();
      drawGraph();
      state.lastHud = now;
    }
    if (elapsed >= warmupMs) startSample(now);
    return;
  }

  if (state.phase !== 'sample') return;

  if (delta > 0) state.frameTimes.push(delta);
  state.submitTimes.push(info.submitMs);
  if (info.gpuMs != null) state.gpuTimes.push(info.gpuMs);
  if (info.stats.quality !== undefined && info.stats.quality < state.minQuality) {
    state.minQuality = info.stats.quality;
  }
  // Walls leave the view as the camera circles, so the peak is the honest draw-call count.
  if (info.stats.drawCalls != null && info.stats.drawCalls > state.maxDrawCalls) {
    state.maxDrawCalls = info.stats.drawCalls;
  }
  if (info.stats.instances !== undefined && info.stats.instances > state.maxInstances) {
    state.maxInstances = info.stats.instances;
  }

  const elapsed = now - state.sampleStart;
  setProgress(elapsed / sampleMs);
  if (now - state.lastHud >= 250) {
    updateLive();
    drawGraph();
    state.lastHud = now;
  }
  if (elapsed >= sampleMs) finish();
}

function makeControl() {
  const center = { x: 20 * TILE, y: 12 * TILE };
  let t = 0;
  let dodgeIn = 1.2;
  return {
    takeDodge(world) {
      if (dodgeIn > 0 || world.player.cooldown > 0) return false;
      dodgeIn = 2.4;
      return true;
    },
    intent(world, dt) {
      t += dt;
      if (dodgeIn > 0) dodgeIn = Math.max(0, dodgeIn - dt);
      const angle = t * 0.55;
      const tx = center.x + Math.cos(angle) * 7 * TILE;
      const ty = center.y + Math.sin(angle) * 7 * TILE;
      const dx = tx - world.player.x;
      const dy = ty - world.player.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    },
  };
}

function placeHorde(world) {
  const center = { x: 20 * TILE, y: 12 * TILE };
  const inner = {
    x0: TILE + 20,
    y0: TILE + 20,
    x1: 39 * TILE - 20,
    y1: 23 * TILE - 20,
  };
  const rand = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const angle = i * GOLDEN + (rand() - 0.5) * 0.7;
    const spread = Math.sqrt((i + 0.5) / Math.max(1, count));
    const rx = (2.5 + 15.0 * spread + (rand() - 0.5) * 0.7) * TILE;
    const ry = (2.0 + 8.5 * spread + (rand() - 0.5) * 0.7) * TILE;
    const x = clamp(center.x + Math.cos(angle) * rx, inner.x0, inner.x1);
    const y = clamp(center.y + Math.sin(angle) * ry, inner.y0, inner.y1);
    spawnGoblin(world, x, y);
  }
}

function describeRenderer(renderer) {
  try {
    const info = renderer.info();
    return info.renderer || info.context || 'unknown';
  } catch (err) {
    return 'unknown';
  }
}

function showError(err) {
  state.phase = 'error';
  setPhase('error');
  setProgress(0);
  $('error').hidden = false;
  $('error-text').textContent = err && err.message ? err.message : String(err);
  const next = new URLSearchParams(params);
  next.set('renderer', 'canvas');
  $('canvas-link').href = '?' + next.toString();
  $('canvas-link').hidden = rendererMode === 'canvas';
  $('download').disabled = true;
}

try {
  game = createGame(canvas, {
    renderer: rendererMode,
    goblins: 0,
    dummies: false,
    embers: false,
    dpr,
    quality,
    control: makeControl(),
    // The extra scene steps inside the timed step, so the sim gate covers the whole load.
    stepExtras(world, dt) {
      if (scene) scene.step(dt);
    },
    onStep(stepMs) {
      if (state.phase === 'sample') state.simTimes.push(stepMs);
    },
    onFrame,
  });
} catch (err) {
  showError(err);
}

if (game) {
  placeHorde(game.world);
  scene = createScene(game.world, { mode: sceneMode, seed });
  $('gpu').textContent = 'GPU: ' + describeRenderer(game.renderer);
  game.start();
  window.tally = game;
  window.tallyStress = { state };
}

$('download').addEventListener('click', downloadReport);
$('rerun').addEventListener('click', () => location.reload());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state.phase === 'warmup' || state.phase === 'sample')) {
    state.hiddenDuring = true;
  }
});
