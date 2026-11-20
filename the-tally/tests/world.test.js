// design.md sections 3.3, 6, 13 and 4: collision, embers, the level curve and the camera.
// Every number here comes from a section; the comments say which.

import { test, assert, near } from './harness.js';
import { TILE, DT, MOVE, EMBER, MAX_SPEED_PX, xpNeed, isSecondWind } from '../js/sim/tuning.js';
import { createWorld, stepWorld, addXp, spawnEmber, queueDodge } from '../js/sim/world.js';
import { rectWalls } from '../js/sim/collide.js';

const NONE = { x: 0, y: 0 };
const RIGHT = { x: 1, y: 0 };
const DOWN = { x: 0, y: 1 };

function boxWalls(x, y, w, h) {
  return rectWalls(x, y, w, h);
}

test('the player cannot walk through a wall', () => {
  // A room 10 tiles wide; walk right for two seconds and stop at the wall, not in it.
  const walls = boxWalls(0, 0, 10 * TILE, 10 * TILE);
  const w = createWorld({ walls, start: { x: 5 * TILE, y: 5 * TILE } });
  for (let i = 0; i < 240; i++) stepWorld(w, RIGHT, DT);
  const p = w.player;
  assert(p.x <= 10 * TILE - p.radius + 1e-6, `the player is inside the wall at x=${p.x}`);
  assert(p.x > 9 * TILE, 'the player did not reach the wall');
});

test('a wall stops one axis and leaves the other free', () => {
  // Walk right into a wall, then down: the slide must keep working on the free axis.
  const walls = boxWalls(0, 0, 10 * TILE, 10 * TILE);
  const w = createWorld({ walls, start: { x: 9 * TILE, y: 5 * TILE } });
  for (let i = 0; i < 60; i++) stepWorld(w, RIGHT, DT);
  const y0 = w.player.y;
  for (let i = 0; i < 60; i++) stepWorld(w, DOWN, DT);
  assert(w.player.y > y0 + TILE, 'the player stuck instead of sliding down the wall');
  assert(w.player.x <= 10 * TILE - w.player.radius + 1e-6, 'the slide pushed the player into the wall');
});

test('goblins separate instead of stacking', () => {
  // design 3.3: soft bodies, the goblin takes most of the overlap. Two goblins on one spot.
  const w = createWorld({ walls: [], start: { x: 5 * TILE, y: 5 * TILE } });
  w.goblins.push({ type: 'goblin', x: 5 * TILE, y: 5 * TILE, px: 0, py: 0, vx: 0, vy: 0, radius: 12, speed: 1.55 });
  w.goblins.push({ type: 'goblin', x: 5 * TILE, y: 5 * TILE, px: 0, py: 0, vx: 0, vy: 0, radius: 12, speed: 1.55 });
  for (let i = 0; i < 60; i++) stepWorld(w, NONE, DT);
  const a = w.goblins[0];
  const b = w.goblins[1];
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  assert(d > 4, `the two goblins are still stacked (${d} px apart)`);
});

test('embers snap in at half a tile and count toward xp', () => {
  // design 6: the last half tile snaps; an ember inside the hum is picked up.
  const w = createWorld({ walls: [], start: { x: 5 * TILE, y: 5 * TILE } });
  const e = spawnEmber(w, 5 * TILE + 0.6 * TILE, 5 * TILE, 1);
  const xp0 = w.player.xp;
  for (let i = 0; i < 30; i++) stepWorld(w, NONE, DT);
  assert(!w.embers.includes(e), 'the ember was not collected');
  assert(w.player.xp === xp0 + 1, `xp was ${w.player.xp}, expected ${xp0 + 1}`);
});

test('past the cap a new ember merges into the nearest', () => {
  // design 6: above the on-ground cap, embers merge rather than accumulate.
  const w = createWorld({ walls: [], start: { x: 5 * TILE, y: 5 * TILE } });
  for (let i = 0; i < EMBER.cap; i++) {
    spawnEmber(w, 40 * TILE + (i % 20) * 20, 40 * TILE + Math.floor(i / 20) * 20, 1);
  }
  assert(w.embers.length === EMBER.cap, 'the cap did not fill');
  const merged = spawnEmber(w, 40 * TILE + 2, 40 * TILE + 2, 1);
  assert(w.embers.length === EMBER.cap, 'the cap was exceeded');
  assert(merged.value === 2, `the merged ember holds ${merged.value}, expected 2`);
});

test('a level opens the bare page and carries the remainder', () => {
  // design 3.1: a page opens, the game holds, the remainder of the xp carries over.
  const w = createWorld({ walls: [], start: { x: 5 * TILE, y: 5 * TILE } });
  const need = xpNeed(1);
  addXp(w, need + 3);
  assert(w.page === true, 'the page did not open');
  assert(w.player.level === 2, `level is ${w.player.level}, expected 2`);
  assert(w.player.xp === 3, `the remainder is ${w.player.xp}, expected 3`);
});

test('the level curve is the design curve', () => {
  // design 6: 5 + 10L below 20, then +13 a level, then +16 from 40.
  assert(xpNeed(1) === 15, `level 1 needs ${xpNeed(1)}`);
  assert(xpNeed(2) === 25, `level 2 needs ${xpNeed(2)}`);
  assert(xpNeed(19) === 195, `level 19 needs ${xpNeed(19)}`);
  assert(xpNeed(20) === 208, `level 20 needs ${xpNeed(20)}`);
  assert(xpNeed(39) === 455, `level 39 needs ${xpNeed(39)}`);
  assert(xpNeed(40) === 471, `level 40 needs ${xpNeed(40)}`);
  assert(isSecondWind(20) && isSecondWind(40), 'the second wind is at 20 and 40');
  assert(!isSecondWind(21), 'the second wind is one level only');
});

test('the second wind doubles growth at that level only', () => {
  const w = createWorld({ walls: [], start: { x: 5 * TILE, y: 5 * TILE } });
  w.player.level = 20;
  addXp(w, 5);
  assert(w.player.xp === 10, `growth at 20 was ${w.player.xp}, expected 10`);
  w.player.level = 21;
  w.player.xp = 0;
  addXp(w, 5);
  assert(w.player.xp === 5, `growth at 21 was ${w.player.xp}, expected 5`);
});

test('the camera does not lag during a Watch Step', () => {
  // design 4: the camera does not lag during a Watch Step.
  const w = createWorld({ walls: [], start: { x: 20 * TILE, y: 12 * TILE } });
  queueDodge(w);
  stepWorld(w, RIGHT, DT);
  const p = w.player;
  while (p.dash.active) {
    stepWorld(w, NONE, DT);
    const dx = Math.abs(w.cam.x - (p.x + Math.min(1, p.vx / MAX_SPEED_PX) * MOVE.leadTiles * TILE));
    const dy = Math.abs(w.cam.y - (p.y + Math.min(1, p.vy / MAX_SPEED_PX) * MOVE.leadTiles * TILE));
    assert(dx < 1e-6 && dy < 1e-6, `the camera lagged by ${dx}, ${dy} px during the step`);
  }
});

test('a running camera lags behind the lead, never ahead of it', () => {
  // A critically damped camera approaches the lead from behind and does not overshoot it.
  const w = createWorld({ walls: [], start: { x: 20 * TILE, y: 12 * TILE } });
  for (let i = 0; i < 120; i++) stepWorld(w, RIGHT, DT);
  const p = w.player;
  const lead = MOVE.leadTiles * TILE;
  assert(w.cam.x <= p.x + lead + 1e-6, 'the camera ran ahead of the lead');
  near(w.cam.x, p.x + lead, 4, 'the camera settles on the lead');
});
