// The M3 vertical: three kinds, one weapon, contact damage, a five-minute clock and the Grey
// Hour. These are the browserless half; whether it is fun is the play page's question.

import { test, assert, near } from './harness.js';
import { createWorld, spawnEnemy } from '../js/sim/world.js';
import { DT, TILE } from '../js/sim/tuning.js';
import { ENEMIES } from '../data/enemies.js';
import {
  createRun, stepRun, stepContact, buildRunReport, spawnInterval, unlockedKinds, RUN,
} from '../js/sim/run.js';
import { stepWeapon, SWORD } from '../js/sim/weapon.js';

const REST = { x: 0, y: 0 };

function advance(run, seconds, intent = REST) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepRun(run, intent, DT);
}

// For seed tests: keep the player alive so the sample reaches the blooms, without changing
// anything the director or the horde reads.
function advanceAlive(run, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    run.world.player.hp = RUN.hp;
    stepRun(run, REST, DT);
  }
}

test('the slice ships three data-driven kinds', () => {
  for (const kind of ['goblin', 'bloom', 'ork']) {
    const data = ENEMIES[kind];
    assert(data && data.id === kind, kind + ' is missing from the data');
    assert(data.health > 0 && data.speed > 0 && data.damage > 0, kind + ' cannot be played');
  }
  assert(ENEMIES.goblin.health < ENEMIES.bloom.health, 'blooms must be tougher than goblins');
  assert(ENEMIES.bloom.health < ENEMIES.ork.health, 'orks must be tougher than blooms');
});

test('the sword kills a goblin in one cut and a bloom in more than one', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 7 });
  const p = world.player;
  world.goblins.length = 0;                 // no opening spawns in the way

  const goblin = spawnEnemy(world, 'goblin', p.x + TILE, p.y);
  run.weapon.cooldown = 0;                  // the weapon opens with a short wind-up
  stepWeapon(run, DT);
  assert(goblin.hp <= 0, 'one cut should kill a goblin');
  assert(run.kills === 1, 'the kill did not count');
  assert(run.byKind.goblin === 1, 'the kill was not counted by kind');

  const bloom = spawnEnemy(world, 'bloom', p.x - TILE, p.y);
  const before = bloom.hp;
  run.weapon.cooldown = 0;
  stepWeapon(run, DT);
  assert(bloom.hp < before, 'the cut missed the bloom');
  assert(bloom.hp > 0, 'a bloom should survive one cut');
});

test('the ork shield dulls a cut from the front and not from the side', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 11 });
  const p = world.player;
  world.goblins.length = 0;

  const front = spawnEnemy(world, 'ork', p.x + 2 * TILE, p.y);
  front.aim = Math.PI;                      // facing west, straight at the player
  run.weapon.cooldown = 0;
  stepWeapon(run, DT);
  const frontLoss = front.maxHp - front.hp;
  assert(frontLoss > 0 && frontLoss < SWORD.damage,
    `the front lost ${frontLoss.toFixed(1)}, expected less than ${SWORD.damage}`);

  const side = spawnEnemy(world, 'ork', p.x, p.y - 2 * TILE);
  side.aim = 0;                             // facing east, the player is to its south
  world.goblins.splice(world.goblins.indexOf(front), 1);
  run.weapon.cooldown = 0;
  stepWeapon(run, DT);
  near(side.maxHp - side.hp, SWORD.damage, 1e-6, 'the side should take the full cut');
});

test('an ork arrives with its shield toward the player', () => {
  const world = createWorld({ goblins: 0 });
  const p = world.player;
  const east = spawnEnemy(world, 'ork', p.x + 3 * TILE, p.y);
  near(east.aim, Math.PI, 1e-9, 'a shield from the east should face west');
  const north = spawnEnemy(world, 'ork', p.x, p.y - 3 * TILE);
  near(north.aim, Math.PI * 0.5, 1e-9, 'a shield from the north should face south');
});

test('contact damage applies once per grace window', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 3 });
  const p = world.player;
  world.goblins.length = 0;
  spawnEnemy(world, 'goblin', p.x, p.y);

  const before = p.hp;
  stepContact(run);
  assert(p.hp === before - ENEMIES.goblin.damage, 'the touch did not hurt');
  assert(run.damageTaken === ENEMIES.goblin.damage, 'damage taken did not record the hit');
  stepContact(run);
  assert(p.hp === before - ENEMIES.goblin.damage, 'the grace window did not hold');
  p.iframes = 0;
  stepContact(run);
  assert(p.hp === before - 2 * ENEMIES.goblin.damage, 'the next window did not hurt');
  assert(run.damageTaken === 2 * ENEMIES.goblin.damage, 'damage taken did not record the second hit');
});

test('a bloom grabs until a Watch Step breaks it', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 5 });
  const p = world.player;
  world.goblins.length = 0;
  spawnEnemy(world, 'bloom', p.x, p.y);

  stepContact(run);
  assert(p.slowFor > 0, 'the bloom did not grab');

  p.dash.active = true;
  stepRun(run, REST, DT);
  assert(p.slowFor === 0, 'the Watch Step did not break the grab');
});

test('the Grey Hour triples the spawn rate at 4:00', () => {
  near(spawnInterval(0, false), RUN.spawnStart, 1e-9, 'the night starts at the slow rate');
  near(spawnInterval(RUN.greyAt, false), RUN.spawnEnd, 1e-9, 'the night ends at the fast rate');
  near(spawnInterval(RUN.greyAt, true), RUN.spawnEnd / RUN.greyScale, 1e-9, 'the Grey Hour rate');
  assert(unlockedKinds(0).length === 1, 'only goblins at the start');
  assert(unlockedKinds(60).length === 2, 'blooms join at 0:45');
  assert(unlockedKinds(120).length === 3, 'orks join at 1:45');
});

test('the run ends Held at 5:00, or The dead, or fell in the Grey Hour', () => {
  const held = createRun(createWorld({ goblins: 0 }), { seed: 9 });
  held.world.goblins.length = 0;
  held.t = RUN.length - DT * 0.5;          // the last step crosses 5:00
  stepRun(held, REST, DT);
  assert(held.ended, 'the clock did not end the run');
  assert(held.result === 'held', 'surviving the night should be Held');
  assert(held.t === RUN.length, 'the clock should stop at 5:00, got ' + held.t);
  assert(buildRunReport(held).survived === '5:00', 'a held run should report 5:00');

  const dead = createRun(createWorld({ goblins: 0 }), { seed: 10 });
  dead.world.player.hp = 0;
  stepRun(dead, REST, DT);
  assert(dead.result === 'dead', 'an early death should be The dead');

  const fell = createRun(createWorld({ goblins: 0 }), { seed: 12 });
  fell.t = RUN.greyAt + 30;
  fell.grey = true;
  fell.world.player.hp = 0;
  stepRun(fell, REST, DT);
  assert(fell.result === 'fell', 'dying in the Grey Hour is Held, and fell at first light');
});

test('the end-of-run report carries the four playtest numbers', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 77 });
  run.kills = 5;
  run.byKind = { goblin: 3, bloom: 1, ork: 1 };
  run.damageTaken = 42;
  run.t = 123.4;
  run.grey = true;
  run.ended = true;
  run.result = 'fell';

  const report = buildRunReport(run, {
    capturedAt: '2026-11-21T00:00:00.000Z',
    url: 'http://example/the-tally/run.html',
    commit: 'abc123',
  });

  assert(report.schema === 'the-tally/vertical-run/1', 'the schema changed');
  assert(report.result === 'fell', 'the result is missing');
  assert(report.phase === 'grey-hour', 'the ending phase is missing');
  near(report.survivedSeconds, 123.4, 1e-9, 'time survived');
  assert(report.survived === '2:04', 'the clock text is ' + report.survived);
  assert(report.kills === 5, 'kills');
  assert(report.killsByKind.goblin === 3 && report.killsByKind.bloom === 1
    && report.killsByKind.ork === 1, 'kills by kind');
  assert(report.damageTaken === 42, 'damage taken');
  assert(report.seed === 77 && report.commit === 'abc123', 'the run context is missing');
  assert(report.capturedAt === '2026-11-21T00:00:00.000Z', 'the capture time is missing');

  const early = createRun(createWorld({ goblins: 0 }), { seed: 5 });
  early.result = 'dead';
  early.t = 61;
  assert(buildRunReport(early).phase === 'night', 'an early death ends in the night');
});

test('all three kinds step for two seconds without leaving the world', () => {
  const world = createWorld({ goblins: 0 });
  const run = createRun(world, { seed: 21 });
  world.goblins.length = 0;
  spawnEnemy(world, 'goblin', 10 * TILE, 10 * TILE);
  spawnEnemy(world, 'bloom', 12 * TILE, 12 * TILE);
  spawnEnemy(world, 'ork', 14 * TILE, 10 * TILE);

  advance(run, 2);

  for (const e of world.goblins) {
    assert(Number.isFinite(e.x) && Number.isFinite(e.y), 'an enemy left the world');
    assert(e.hp > 0, 'an enemy died without a killing blow');
  }
  assert(run.t > 1.9, 'the clock did not run');
});

test('the same seed replays the same horde, blooms included', () => {
  const a = createRun(createWorld({ goblins: 0 }), { seed: 33 });
  const b = createRun(createWorld({ goblins: 0 }), { seed: 33 });
  advanceAlive(a, 60);
  advanceAlive(b, 60);

  assert(a.world.goblins.some((e) => e.kind === 'bloom'), 'the sample reached no bloom');
  assert(a.world.goblins.length === b.world.goblins.length, 'the horde count diverged');
  for (let i = 0; i < a.world.goblins.length; i++) {
    const ea = a.world.goblins[i];
    const eb = b.world.goblins[i];
    assert(ea.kind === eb.kind, 'the horde order diverged at ' + i);
    near(ea.x, eb.x, 1e-9, 'x diverged at ' + i);
    near(ea.y, eb.y, 1e-9, 'y diverged at ' + i);
  }
});
