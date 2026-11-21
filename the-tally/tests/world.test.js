// The rest of M1's behaviour: walls, goblin separation, embers, growth and the camera.

import { test, assert, near } from './harness.js';
import {
  createWorld, stepWorld, queueDodge, spawnEmber, addXp, spawnGoblin,
} from '../js/sim/world.js';
import { DT, TILE, MOVE, MAX_SPEED_PX, xpNeed, isSecondWind } from '../js/sim/tuning.js';
import { resolveWalls } from '../js/sim/collide.js';

const REST = { x: 0, y: 0 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

function advance(world, intent, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepWorld(world, intent, DT);
}

test('the player cannot walk through a wall', () => {
  const w = createWorld({ goblins: 0 });
  advance(w, LEFT, 8);                       // 32 tiles of intent against the west wall
  assert(w.player.x >= MOVE.hurtRadius - 0.6, `player ended inside the wall at x=${w.player.x}`);
  assert(w.player.x < MOVE.hurtRadius + 2, 'the player should be resting against the wall');
});

test('a wall stops one axis and leaves the other free', () => {
  const w = createWorld({ goblins: 0 });
  advance(w, { x: -0.7071, y: -0.7071 }, 8);
  assert(w.player.y > 1, 'the player should have slid north while held by the west wall');
});

test('a body centred on a wall is pushed a full radius clear', () => {
  const body = { x: 80, y: 80 };
  resolveWalls(body, 12, [{ x1: 0, y1: 80, x2: 200, y2: 80 }]);
  near(body.y, 68, 1e-9, 'degenerate contact push');
});

test('the player push cannot leave a goblin inside a wall', () => {
  const w = createWorld({ goblins: 0 });
  const g = spawnGoblin(w, 12, 12 * TILE);   // resting on the west wall
  w.player.x = 16;
  w.player.y = g.y;
  stepWorld(w, REST, DT);
  assert(g.x >= 11.5, `the player push left the goblin at x=${g.x.toFixed(2)}`);
});

test('goblins separate instead of stacking', () => {
  const w = createWorld({ goblins: 0 });
  const a = spawnGoblin(w, 12 * TILE, 9 * TILE, { dummy: true });
  const b = spawnGoblin(w, 12 * TILE + 3, 9 * TILE, { dummy: true });
  advance(w, REST, 1);
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  assert(d > a.radius + b.radius - 1, `goblins still overlap at ${d.toFixed(1)} px`);
});

test('embers snap in at half a tile and count toward xp', () => {
  const w = createWorld({ goblins: 0 });
  const before = w.player.xp;
  spawnEmber(w, w.player.x + 0.4 * TILE, w.player.y, 5);
  stepWorld(w, REST, DT);
  assert(w.embers.length === 0, 'the ember was not collected');
  assert(w.player.xp === before + 5, 'the ember did not pay its value');
});

test('past the cap a new ember merges into the nearest', () => {
  const w = createWorld({ goblins: 0 });
  for (let i = 0; i < 400; i++) spawnEmber(w, 1000 + i, 1000, 1);
  const total = w.embers.reduce((s, e) => s + e.value, 0);
  spawnEmber(w, 1010, 1000, 1);
  assert(w.embers.length === 400, 'the cap did not hold');
  assert(w.embers.reduce((s, e) => s + e.value, 0) === total + 1, 'the value was lost');
});

test('a level opens the bare page and carries the remainder', () => {
  const w = createWorld({ goblins: 0 });
  const need = xpNeed(1);
  addXp(w, need + 3);
  assert(w.player.level === 2, 'the level did not rise');
  assert(w.player.xp === 3, 'the remainder was not carried');
  assert(w.page === true, 'the page did not open');
});

test('the level curve is the design curve', () => {
  near(xpNeed(1), 15, 1e-9, 'level 1');
  near(xpNeed(19), 195, 1e-9, 'level 19');
  near(xpNeed(20), 208, 1e-9, 'level 20');
  near(xpNeed(39), 455, 1e-9, 'level 39');
  near(xpNeed(40), 471, 1e-9, 'level 40');
  for (let l = 1; l < 60; l++) {
    assert(xpNeed(l + 1) >= xpNeed(l), 'the curve must not fall');
  }
  assert(isSecondWind(20) && isSecondWind(40) && !isSecondWind(21), 'the second winds are 20 and 40');
});

test('the second wind doubles growth at that level only', () => {
  const w = createWorld({ goblins: 0 });
  w.player.level = 20;
  addXp(w, 10);
  assert(w.player.xp === 20, `expected 20 xp at the second wind, got ${w.player.xp}`);
  w.player.level = 21;
  w.player.xp = 0;
  addXp(w, 10);
  assert(w.player.xp === 10, 'the second wind must not persist');
});

test('the camera does not lag during a Watch Step', () => {
  const w = createWorld({ goblins: 0 });
  queueDodge(w);
  // step until the dash is running
  for (let i = 0; i < 10 && !w.player.dash.active; i++) stepWorld(w, RIGHT, DT);
  assert(w.player.dash.active, 'the step never started');
  near(w.cam.x - w.player.x, MOVE.leadTiles * TILE, 1, 'camera lead during the step');
  near(w.cam.y - w.player.y, 0, 1, 'camera should not offset on the other axis');
});

test('a running camera lags behind the lead, never ahead of it', () => {
  const w = createWorld({ goblins: 0 });
  advance(w, RIGHT, 1.5);
  const lead = w.cam.x - w.player.x;
  assert(lead < MOVE.leadTiles * TILE, 'the camera should still be catching up');
  assert(lead > 0, 'the camera should lead forward, not trail');
});
