// design.md section 3: the movement numbers, and the Watch Step. No browser, no DOM: the
// simulation takes an intent object and a fixed dt, so a test can hold a key down for as long as
// it likes. Tolerance is one simulation step (8.33 ms) unless a number is exact by construction.

import { test, assert, near } from './harness.js';
import { TILE, DT, MOVE, STEP, MAX_SPEED_PX, shapeStick } from '../js/sim/tuning.js';
import { createWorld, stepWorld, queueDodge } from '../js/sim/world.js';

const RIGHT = { x: 1, y: 0 };
const LEFT = { x: -1, y: 0 };
const DOWN = { x: 0, y: 1 };
const NONE = { x: 0, y: 0 };
const ONE_STEP_MS = DT * 1000;

function speed(world) {
  const p = world.player;
  return Math.hypot(p.vx, p.vy);
}

function run(world, intent, until) {
  let guard = 0;
  while (!until(world)) {
    stepWorld(world, intent, DT);
    if (++guard > 2000) throw new Error('the simulation did not reach the condition');
  }
  return world.t;
}

function freshBox() {
  // A 400 x 400 px arena: enough room for a step, no wall in reach of the numbers.
  const walls = [];
  return createWorld({ walls, start: { x: 200, y: 200 } });
}

test('top speed is 4.0 tiles/s', () => {
  const w = freshBox();
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 1e-6);
  near(speed(w) / TILE, MOVE.maxSpeed, 1e-9, 'top speed');
});

test('acceleration reaches top in 70 ms', () => {
  const w = freshBox();
  const t = run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 1e-6);
  near(t * 1000, MOVE.accelTime * 1000, ONE_STEP_MS, 'acceleration time');
});

test('deceleration stops in 55 ms', () => {
  const w = freshBox();
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 1e-6);
  const t = run(w, NONE, (w) => speed(w) === 0);
  near(t * 1000, MOVE.decelTime * 1000, ONE_STEP_MS, 'deceleration time');
});

test('a full reverse takes 90 ms', () => {
  const w = freshBox();
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 1e-6);
  const p = w.player;
  // Time from the first step after the reversal until the velocity has crossed zero and then
  // reached the top speed the other way.
  let t = 0;
  let guard = 0;
  while (!(p.vx < 0 && Math.abs(p.vx) >= MAX_SPEED_PX - 1e-6)) {
    stepWorld(w, LEFT, DT);
    t += DT;
    if (++guard > 400) throw new Error('the reverse never reached the opposite top speed');
  }
  near(t * 1000, MOVE.reverseTime * 1000, ONE_STEP_MS, 'reverse time');
});

test('a reversal has no slowdown arc', () => {
  // One continuous ramp, not decelerate-then-accelerate, so it spends no time sitting still:
  // at most the single step whose velocity spans zero.
  const w = freshBox();
  run(w, RIGHT, (w) => speed(w) >= MAX_SPEED_PX - 0.01);
  let slowSteps = 0;
  for (let i = 0; i < 12; i++) {
    stepWorld(w, LEFT, DT);
    if (speed(w) < 5) slowSteps++;
  }
  assert(slowSteps <= 1, `spent ${slowSteps} steps at a standstill`);
});

test('diagonals are normalised to the same top speed', () => {
  const w = freshBox();
  const diag = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  run(w, diag, (w) => speed(w) >= MAX_SPEED_PX - 1e-6);
  near(speed(w) / TILE, MOVE.maxSpeed, 1e-9, 'diagonal top speed');
});

test('the Watch Step covers exactly 3 tiles', () => {
  const w = freshBox();
  const startX = w.player.x;
  queueDodge(w);
  stepWorld(w, RIGHT, DT);
  const t = run(w, NONE, (w) => !w.player.dash.active);
  void t;
  near((w.player.x - startX) / TILE, STEP.distance, 1e-6, 'step distance');
});

test('the Watch Step takes 180 ms', () => {
  const w = freshBox();
  queueDodge(w);
  stepWorld(w, RIGHT, DT);
  const t = run(w, NONE, (w) => !w.player.dash.active);
  near(t * 1000, STEP.duration * 1000, ONE_STEP_MS, 'step duration');
});

test('a step grants 220 ms of i-frames and costs 2.4 s', () => {
  const w = freshBox();
  queueDodge(w);
  stepWorld(w, RIGHT, DT);
  const p = w.player;
  assert(p.iframes > STEP.iframes - 2 * DT, `i-frames were ${p.iframes}`);
  near(p.cooldown, STEP.cooldown, 1e-6, 'cooldown at the start');
  run(w, NONE, (w) => !w.player.dash.active);
  assert(p.dash.active === false, 'the step did not end');
  // The i-frame window is longer than the move; it is counted from the start of the step.
  near(p.iframes, STEP.iframes - STEP.duration, 2 * DT, 'i-frames left after the move');
});

test('a press up to 120 ms early still fires', () => {
  const w = freshBox();
  queueDodge(w);
  for (let i = 0; i < 13; i++) stepWorld(w, NONE, DT);   // ~108 ms of buffer
  assert(w.player.dash.active === false, 'the step must wait for its moment');
  stepWorld(w, NONE, DT);
});

test('a press older than 120 ms is forgotten', () => {
  const w = freshBox();
  queueDodge(w);
  for (let i = 0; i < 16; i++) stepWorld(w, NONE, DT);   // ~133 ms
  assert(w.player.dodgeBuffer === 0, 'the buffer should have run out');
  assert(w.player.cooldown === 0, 'no step should have been spent');
});

test('the stick curve is dead, shaped, and full at the outer edge', () => {
  assert(shapeStick(MOVE.deadZone) === 0, 'the dead zone must be zero');
  assert(shapeStick(MOVE.outer) === 1, 'the outer edge must be full');
  assert(shapeStick(0.5) > 0 && shapeStick(0.5) < 1, 'inside the range is shaped, not linear');
  // Exponent 1.4: the midpoint of the live band is 0.5^1.4, about 0.379.
  near(shapeStick((MOVE.deadZone + MOVE.outer) / 2), Math.pow(0.5, MOVE.exponent), 1e-9, 'midpoint');
});

// The collision helper is in world.test.js; DOWN is used by the wall test there.
void DOWN;
