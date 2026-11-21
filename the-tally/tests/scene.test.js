// The M2 target scene's shape: the section 23.4 counts, a layout that repeats from its seed, and
// 4,230 extra bodies that stay finite and alive for a second of fixed steps.

import { test, assert } from './harness.js';
import { createWorld } from '../js/sim/world.js';
import { createScene, TARGET } from './scene.js';
import { DT } from '../js/sim/tuning.js';

function full(seed) {
  const world = createWorld({ goblins: 0 });
  return { world, scene: createScene(world, { mode: 'full', seed }) };
}

test('the full scene carries the section 23.4 counts', () => {
  const { scene } = full(7);
  assert(scene.mode === 'full', 'the full mode did not stick');
  assert(scene.counts.playerShots === TARGET.playerShots, 'player projectiles');
  assert(scene.counts.enemyShots === TARGET.enemyShots, 'enemy projectiles');
  assert(scene.counts.particles === TARGET.particles, 'particles');
  assert(scene.counts.embers === TARGET.embers, 'embers');
  assert(scene.counts.lights === TARGET.lights, 'lights');
  assert(scene.shots.count === 800, 'one shots pool of 600 + 200');
  assert(scene.particles.count === 3000, 'the particles pool');
  assert(scene.embers.count === 400, 'the embers pool');
  assert(scene.lights.count === 30, 'the lights pool');
});

test('the horde baseline carries no extra load', () => {
  const world = createWorld({ goblins: 0 });
  const scene = createScene(world, { mode: 'horde', seed: 7 });
  assert(scene.mode === 'horde', 'the baseline mode did not stick');
  assert(scene.counts.playerShots === 0 && scene.counts.enemyShots === 0,
    'the baseline has no projectiles');
  assert(scene.counts.particles === 0 && scene.counts.embers === 0 && scene.counts.lights === 0,
    'the baseline has no particles, embers or lights');
  assert(scene.shots.count === 0 && scene.particles.count === 0 && scene.lights.count === 0,
    'the baseline pools are empty');
  assert(world.fx === scene, 'the renderer reads the same object the tests step');
});

test('the same seed lays the scene out the same way', () => {
  const a = full(11).scene;
  const b = full(11).scene;
  for (let i = 0; i < 64; i++) {
    assert(a.shots.x[i] === b.shots.x[i], `shot ${i} x`);
    assert(a.shots.y[i] === b.shots.y[i], `shot ${i} y`);
    assert(a.particles.x[i] === b.particles.x[i], `particle ${i} x`);
    assert(a.lights.radius[i] === b.lights.radius[i], `light ${i} radius`);
  }
});

test('the load stays finite and inside the yard for a second of steps', () => {
  const { world, scene } = full(3);
  for (let i = 0; i < 120; i++) scene.step(DT);
  const b = world.bounds;

  function inside(pool, label) {
    for (let i = 0; i < pool.count; i++) {
      const x = pool.x[i];
      const y = pool.y[i];
      assert(Number.isFinite(x) && Number.isFinite(y), `${label} ${i} is not finite`);
      assert(x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1, `${label} ${i} left the yard`);
    }
  }

  inside(scene.shots, 'shot');
  inside(scene.particles, 'particle');
  inside(scene.embers, 'ember');
  inside(scene.lights, 'light');
  assert(scene.shots.count === 800 && scene.particles.count === 3000, 'a pool changed size');
});
