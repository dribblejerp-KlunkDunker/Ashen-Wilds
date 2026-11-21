// The M2 capture checker: `node tools/check-captures.js run1.json run2.json run3.json`.
//
// A capture's own `gates.passed` is necessary but not sufficient for the merge gate: it scores the
// timing gates and the clean/complete pair only. It never looks at the machine, the scene
// composition or the run config, so a horde run at half the load, or one taken with a pinned
// buffer, can print a green summary. This re-derives every gate from the report's own numbers and
// rejects a capture that was not taken on the Chromebook at the documented defaults.
//
// It reads only the files it is given. It cannot tell whether the named commit is the one that
// merges, only that all three runs name the same commit.

import { readFileSync } from 'node:fs';
import { TARGET } from '../tests/scene.js';

const SCHEMA = 'the-tally/stress-capture/2';
const RUNS = 3;
// Keep in step with tests/stress.js: GATES, DEFAULT_COUNT and the readNumber defaults.
const GATES = {
  frameP95: 16.7,
  over20Pct: 1,
  meanFps: 59,
  simP95: 4,
  simRate: 119,
  submitP95: 6,
  gpuP95: 16.7,
};
const RUN = { count: 1500, sampleSeconds: 60, warmupSeconds: 5, dprCap: 2 };
const DRAW_CALLS_MAX = 6;
const COMPLETE_SHARE = 0.95;   // the harness accepts 57 s of a 60 s sample
const SCENE_KEYS = ['goblins', 'playerShots', 'enemyShots', 'particles', 'embers', 'lights'];
// A gate run leaves the harness on its defaults; only the commit label may ride in the URL.
const DEFAULT_PARAMS = { mode: 'full', renderer: 'webgl', n: '1500', sample: '60', warmup: '5', dpr: '2' };

function read(report, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), report);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function urlProblems(raw) {
  if (typeof raw !== 'string' || raw === '') return ['url is missing'];
  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    return ['url is unreadable'];
  }
  const problems = [];
  for (const [key, want] of Object.entries(DEFAULT_PARAMS)) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== want) problems.push('url sets ' + key + '=' + value);
  }
  if (url.searchParams.has('quality')) {
    problems.push('url pins quality; the stepper must be free');
  }
  return problems;
}

function inspect(report) {
  const fails = [];
  const fail = (label, detail) => fails.push(label + ' - ' + detail);
  const field = (path) => read(report, path);
  const atMost = (label, value, limit) => {
    if (!isNumber(value)) fail(label, 'is not a number');
    else if (value > limit) fail(label, value.toFixed(2) + ' > ' + limit);
  };
  const atLeast = (label, value, limit) => {
    if (!isNumber(value)) fail(label, 'is not a number');
    else if (value < limit) fail(label, value.toFixed(2) + ' < ' + limit);
  };

  if (field('schema') !== SCHEMA) fail('schema', 'is ' + JSON.stringify(field('schema')) + ', expected ' + SCHEMA);

  // The machine is the point of the gate, and "passed" says nothing about it.
  if (field('environment.chromeOS') !== true) fail('machine', 'environment.chromeOS is not true');
  if (!/CrOS/.test(String(field('environment.userAgent') || ''))) fail('machine', 'userAgent is not Chrome OS');

  // The run config, from the report and from the URL it was taken on.
  if (field('count') !== RUN.count) fail('config', 'count is ' + field('count') + ', expected ' + RUN.count);
  if (field('scene.mode') !== 'full') fail('config', 'scene is ' + field('scene.mode') + ', expected full');
  if (field('renderer.requested') !== 'webgl') fail('config', 'renderer is ' + field('renderer.requested') + ', expected webgl');
  if (field('sample.sampleSeconds') !== RUN.sampleSeconds) fail('config', 'sample is ' + field('sample.sampleSeconds') + ' s, expected ' + RUN.sampleSeconds);
  if (field('sample.warmupSeconds') !== RUN.warmupSeconds) fail('config', 'warmup is ' + field('sample.warmupSeconds') + ' s, expected ' + RUN.warmupSeconds);
  if (field('environment.dprCap') !== RUN.dprCap) fail('config', 'dpr cap is ' + field('environment.dprCap') + ', expected ' + RUN.dprCap);
  for (const problem of urlProblems(field('url'))) fail('config', problem);

  // The scene the gate names: 1,500 goblins and the 23.4 load around them.
  for (const key of SCENE_KEYS) {
    if (field('scene.' + key) !== TARGET[key]) {
      fail('scene', key + ' is ' + field('scene.' + key) + ', expected ' + TARGET[key]);
    }
  }

  const peak = field('renderer.drawCallsMax');
  if (!isNumber(peak)) fail('draws', 'renderer.drawCallsMax is not a number');
  else if (peak > DRAW_CALLS_MAX) fail('draws', 'peak is ' + peak + ', limit ' + DRAW_CALLS_MAX);
  const last = field('renderer.drawCalls');
  if (!isNumber(last)) fail('draws', 'renderer.drawCalls is not a number');
  else if (isNumber(peak) && last > peak) fail('draws', 'last frame ' + last + ' exceeds peak ' + peak);

  // Every timing gate, from the raw samples rather than the report's own booleans.
  atMost('frame p95', field('frame.p95Ms'), GATES.frameP95);
  const over20 = field('frame.over20Pct');
  if (!isNumber(over20)) fail('frames over 20 ms', 'is not a number');
  else if (!(over20 < GATES.over20Pct)) fail('frames over 20 ms', over20.toFixed(2) + '% >= ' + GATES.over20Pct + '%');
  atLeast('mean frame rate', field('frame.fpsMean'), GATES.meanFps);
  atMost('step p95', field('sim.p95Ms'), GATES.simP95);
  atLeast('sim rate', field('sample.stepRateHz'), GATES.simRate);
  atMost('CPU submit p95', field('render.submit.p95Ms'), GATES.submitP95);
  if (field('render.gpu.measured') === true) {
    atMost('GPU p95', field('render.gpu.p95Ms'), GATES.gpuP95);
  } else if (field('render.gpu.measured') !== false) {
    fail('GPU p95', 'the report does not say whether the timer measured');
  }
  // The render gate is GPU p95 when the timer measured it, the frame p95 otherwise; both are above.
  // A report whose thresholds differ means this checker is stale, not that the run is good.
  const thresholds = field('gates.thresholds') || {};
  for (const [key, want] of Object.entries(GATES)) {
    if (thresholds[key] !== want) {
      fail('thresholds', key + ' is ' + JSON.stringify(thresholds[key]) + ', checker expects ' + want);
    }
  }

  // A clean, complete capture: focused for the whole sample, no context loss, at least 57 s.
  if (field('visibility.hiddenDuring') !== false) fail('clean', 'the tab was hidden during the capture');
  if (field('renderer.contextLost') !== false) fail('clean', 'the WebGL context was lost');
  const actual = field('sample.actualSeconds');
  const wanted = field('sample.sampleSeconds');
  if (!isNumber(actual) || !isNumber(wanted)) fail('clean', 'the sampled duration is not a number');
  else if (actual < wanted * COMPLETE_SHARE) fail('clean', 'only ' + actual.toFixed(1) + ' s of ' + wanted + ' s sampled');
  if (!(field('sample.frameCount') > 0)) fail('clean', 'no frames sampled');
  if (!(field('sample.stepCount') > 0)) fail('clean', 'no steps sampled');

  // The harness has to call it a pass too; a false here with clean numbers means a harness bug.
  if (field('gates.passed') !== true) fail('report', 'gates.passed is not true');

  const commit = field('commit');
  if (typeof commit !== 'string' || !/^[0-9a-f]{7,40}$/i.test(commit)) {
    fail('commit', 'is ' + JSON.stringify(commit) + ', expected the sha from ?commit=');
  }

  return fails;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node the-tally/tools/check-captures.js <capture.json> [capture.json ...]');
  process.exit(2);
}

const results = files.map((file) => {
  let report;
  try {
    report = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return { file, report: null, fails: ['json - ' + err.message] };
  }
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    return { file, report: null, fails: ['json - not a capture object'] };
  }
  return { file, report, fails: inspect(report) };
});

const width = Math.max(...results.map((result) => result.file.length));
for (const result of results) {
  const name = result.file.padEnd(width);
  if (result.fails.length === 0) {
    const report = result.report;
    console.log('  ok   ' + name + '  ' + (report.commit || 'no commit')
      + '  ' + report.renderer.drawCallsMax + ' draws'
      + '  p95 ' + report.frame.p95Ms.toFixed(1) + ' ms'
      + '  ' + report.frame.fpsMean.toFixed(1) + ' fps');
  } else {
    console.log('  FAIL ' + name);
    for (const message of result.fails) console.log('       ' + message);
  }
}

// The gate is three separate runs of one commit.
const gate = [];
if (results.length !== RUNS) gate.push('the gate needs ' + RUNS + ' captures, got ' + results.length);
const commits = [];
for (const result of results) {
  const commit = result.report && typeof result.report.commit === 'string' ? result.report.commit.toLowerCase() : null;
  if (commit && !commits.includes(commit)) commits.push(commit);
}
if (commits.length > 1) gate.push('the captures name different commits: ' + commits.join(', '));
const starts = results.map((result) => (result.report ? result.report.startedAt : null)).filter(Boolean);
if (starts.length > 1 && new Set(starts).size !== starts.length) {
  gate.push('two captures share a start time; they are not three separate runs');
}
for (const problem of gate) console.log('  gate ' + problem);

const failed = results.filter((result) => result.fails.length > 0).length;
const ok = failed === 0 && gate.length === 0;
const commitLabel = commits.length === 1 ? ', commit ' + commits[0] : '';
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed, ' + results.length
  + ' capture' + (results.length === 1 ? '' : 's') + commitLabel);
if (!ok) console.log('The gate is not met.');
process.exitCode = ok ? 0 : 1;
