// Every number in design.md section 3, asserted against the simulation at 120 Hz.
// Tolerances are one 120 Hz step (8.33 ms) unless a test says otherwise: a fixed-step
// simulation can only be exact to the step.

import { test, assert, near } from './harness.js';
import { createWorld, stepWorld, queueDodge } from '../js/sim/world.js';
import {
  DT, MOVE, STEP, MAX_SPEED_PX, TILE, DASH_PX, shapeStick,
} from '../js/sim/tuning.js';

const REST = { x: 0, y: 0 };
const RIGHT = { x: 1, y: 0 };
const LEFT = { x: -1, y: 0 };
const DIAG = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const STEP_MS = 1000 / 120;

function speed(world) {
  return Math.hypot(world.player.vx, world.player.vy);
}

function run(world, intent, pred, limit = 1200) {
  for (let i = 0; i < limit; i++) {
    stepWorld(world, intent, DT);
    if (pred(world)) return i + 1;
  }
  return -1;
}

test('top speed is 4.0 tiles/s', () => {
  const w = createWorld({ goblins: 0 });
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  near(speed(w), MAX_SPEED_PX, 0.01, 'top speed');
  near(speed(w) / TILE, MOVE.maxSpeed, 0.001, 'top speed in tiles');
});

test('acceleration reaches top in 70 ms', () => {
  const w = createWorld({ goblins: 0 });
  const n = run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  assert(n > 0, 'never reached top speed');
  near(n * STEP_MS, MOVE.accelTime * 1000, STEP_MS, 'accel time');
});

test('deceleration stops in 55 ms', () => {
  const w = createWorld({ goblins: 0 });
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  const n = run(w, REST, (w) => speed(w) === 0);
  assert(n > 0, 'never stopped');
  near(n * STEP_MS, MOVE.decelTime * 1000, STEP_MS, 'decel time');
});

test('a full reverse takes 90 ms', () => {
  const w = createWorld({ goblins: 0 });
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  const n = run(w, LEFT, (w) => w.player.vx <= -MAX_SPEED_PX + 0.01);
  assert(n > 0, 'never reversed');
  near(n * STEP_MS, MOVE.reverseTime * 1000, STEP_MS, 'reverse time');
});

test('a reversal has no slowdown arc', () => {
  // One continuous ramp, not decelerate-then-accelerate, so it spends no time sitting still:
  // at most the single step whose velocity spans zero.
  const w = createWorld({ goblins: 0 });
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  let slowSteps = 0;
  for (let i = 0; i < 12; i++) {
    stepWorld(w, LEFT, DT);
    if (speed(w) < 5) slowSteps++;
  }
  assert(slowSteps <= 1, `spent ${slowSteps} steps at a standstill`);
});

test('diagonals are normalised to the same top speed', () => {
  const w = createWorld({ goblins: 0 });
  run(w, DIAG, (w) => speed(w) >= MAX_SPEED_PX - 0.5);
  near(speed(w), MAX_SPEED_PX, 0.5, 'diagonal top speed');
});

test('the Watch Step covers exactly 3 tiles', () => {
  const w = createWorld({ goblins: 0 });
  const x0 = w.player.x;
  queueDodge(w);
  const n = run(w, REST, (w) => w.stats.dashTiles > 0);
  assert(n > 0, 'the dash never finished');
  near(w.stats.dashTiles, STEP.distance, 0.001, 'dash distance');
  near((w.player.x - x0) / TILE, STEP.distance, 0.06, 'dash displacement');
});

test('the Watch Step takes 180 ms', () => {
  const w = createWorld({ goblins: 0 });
  queueDodge(w);
  let elapsed = 0;
  let finished = false;
  for (let i = 0; i < 60; i++) {
    stepWorld(w, REST, DT);
    elapsed += DT;
    if (!w.player.dash.active && w.stats.dashTiles > 0) { finished = true; break; }
  }
  assert(finished, 'the dash never finished');
  near(elapsed * 1000, STEP.duration * 1000, STEP_MS, 'dash time');
  near(DASH_PX / TILE, STEP.distance / STEP.duration, 0.001, 'dash speed');
});

test('a step grants 220 ms of i-frames and costs 2.4 s', () => {
  const w = createWorld({ goblins: 0 });
  queueDodge(w);
  stepWorld(w, REST, DT);
  assert(w.player.dash.active, 'the step did not start');
  near(w.player.iframes, STEP.iframes, 0.001, 'i-frames');
  near(w.player.cooldown, STEP.cooldown, 0.001, 'cooldown');
  assert(STEP.iframes > STEP.duration, 'the i-frame window must outlast the move');
});

test('a press up to 120 ms early still fires', () => {
  const w = createWorld({ goblins: 0 });
  queueDodge(w);
  stepWorld(w, REST, DT);                       // dash 1, cooldown 2.4
  for (let t = 0; t < 2.3; t += DT) stepWorld(w, REST, DT);
  assert(!w.player.dash.active, 'the first step should be over');
  assert(w.player.cooldown < STEP.buffer + DT * 2, 'expected the cooldown near zero');

  queueDodge(w);                                // pressed about 100 ms before it reloads
  let fired = false;
  for (let i = 0; i < 30; i++) {
    stepWorld(w, REST, DT);
    if (w.player.dash.active) { fired = true; break; }
  }
  assert(fired, 'a press inside the buffer did not fire');
});

test('a press older than 120 ms is forgotten', () => {
  const w = createWorld({ goblins: 0 });
  queueDodge(w);
  stepWorld(w, REST, DT);
  for (let t = 0; t < 2.1; t += DT) stepWorld(w, REST, DT);   // cooldown about 0.3
  assert(w.player.cooldown > STEP.buffer, 'expected the cooldown still over the buffer');

  queueDodge(w);
  for (let i = 0; i < 60; i++) {
    stepWorld(w, REST, DT);
    if (w.player.dash.active) break;
  }
  assert(!w.player.dash.active, 'a stale press fired');
});

test('the stick curve is dead, shaped, and full at the outer edge', () => {
  near(shapeStick(MOVE.deadZone), 0, 1e-9, 'dead zone');
  near(shapeStick(MOVE.outer), 1, 1e-9, 'outer edge');
  near(shapeStick(1), 1, 1e-9, 'past the outer edge clamps');
  let prev = -1;
  for (let m = 0; m <= 1; m += 0.05) {
    const v = shapeStick(m);
    assert(v >= prev - 1e-9, 'the curve must not go backwards');
    prev = v;
  }
  assert(shapeStick(0.6) < 0.6, 'the 1.4 exponent must bend the low end down');
});
