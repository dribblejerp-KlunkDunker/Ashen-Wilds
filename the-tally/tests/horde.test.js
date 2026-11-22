// The 1,500-enemy slice: the pooled spatial hash must keep a full horde finite and present.

import { test, assert } from './harness.js';
import { createWorld, stepWorld, spawnGoblin } from '../js/sim/world.js';
import { DT, TILE } from '../js/sim/tuning.js';
import { resolveWalls } from '../js/sim/collide.js';

const REST = { x: 0, y: 0 };

test('1,500 goblins step without NaNs or lost bodies', () => {
  const w = createWorld({ goblins: 0, dummies: false });
  const count = 1500;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653;
    const radius = (3 + 12 * Math.sqrt((i + 0.5) / count)) * TILE;
    const x = Math.max(TILE + 20, Math.min(39 * TILE - 20, w.player.x + Math.cos(angle) * radius));
    const y = Math.max(TILE + 20, Math.min(23 * TILE - 20, w.player.y + Math.sin(angle) * radius));
    spawnGoblin(w, x, y);
  }

  for (let i = 0; i < 10; i++) stepWorld(w, REST, DT);

  assert(w.goblins.length === count, 'the horde lost a goblin');
  let finite = true;
  for (let i = 0; i < w.goblins.length; i++) {
    const g = w.goblins[i];
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y)) {
      finite = false;
      break;
    }
  }
  assert(finite, 'a goblin position is not finite');

  for (let i = 0; i < w.goblins.length; i++) {
    const g = w.goblins[i];
    const probe = { x: g.x, y: g.y };
    resolveWalls(probe, g.radius, w.walls);
    const moved = Math.hypot(probe.x - g.x, probe.y - g.y);
    assert(moved < 0.5, `goblin ${i} ended ${moved.toFixed(2)} px inside a wall`);
  }
});

test('the horde hash rebuilds when goblins are added after a step', () => {
  const w = createWorld({ goblins: 0 });
  stepWorld(w, REST, DT);                 // a hash built for an empty horde
  for (let i = 0; i < 200; i++) {
    spawnGoblin(w, 5 * TILE + (i % 20) * 4, 5 * TILE + Math.floor(i / 20) * 4);
  }
  stepWorld(w, REST, DT);
  assert(w.goblinHash.capacity >= 200, 'the hash did not grow with the horde');
  for (let i = 0; i < w.goblins.length; i++) {
    const g = w.goblins[i];
    assert(Number.isFinite(g.x) && Number.isFinite(g.y), `goblin ${i} is not finite after the rebuild`);
  }
});
