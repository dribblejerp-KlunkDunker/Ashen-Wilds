// The Watch Sword (design 7): a fast crescent cut, alternating sides. Aiming uses the nearest
// enemy first (design 3.5), so the cut follows the horde while movement keeps its own facing.
//
// The ork shield dulls a cut from its front, so the answer to an ork is positional: circle
// faster than the shield turns, then cut its side. Everything else dies in one or two cuts.

import { TILE } from './tuning.js';
import { spawnParticle, burst, TINT } from './fx.js';

export const SWORD = Object.freeze({
  cooldown: 0.52,        // s between cuts
  range: 2.6 * TILE,
  arc: Math.PI * 0.72,   // the cut's width, 130 degrees
  damage: 16,
  knockback: 320,        // px/s impulse at the light weight
  lean: 0.18,            // radians each cut leans off the aim, alternating sides
});

export function createWeapon() {
  return { cooldown: 0.25, side: 1 };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestTarget(run, p) {
  let best = null;
  let bd = Infinity;
  for (const e of run.world.goblins) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
    if (d <= SWORD.range && d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function stepWeapon(run, dt) {
  const w = run.weapon;
  w.cooldown = Math.max(0, w.cooldown - dt);
  if (w.cooldown > 0) return;

  const p = run.world.player;
  const target = nearestTarget(run, p);
  if (!target) return;

  const aim = Math.atan2(target.y - p.y, target.x - p.x) + w.side * SWORD.lean;
  w.side = -w.side;
  w.cooldown = SWORD.cooldown;

  const hits = [];
  for (const e of run.world.goblins) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (Math.hypot(dx, dy) > SWORD.range + e.radius) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), aim)) > SWORD.arc * 0.5) continue;
    hits.push(e);
  }
  for (const e of hits) hurt(run, e, aim);

  // The cut itself: a short arc of bone-white sparks, brighter in the middle of the swing.
  for (let i = 0; i < 7; i++) {
    const a = aim + (i / 6 - 0.5) * SWORD.arc * 0.84;
    const r = SWORD.range * (0.5 + 0.4 * Math.sin((i / 6) * Math.PI));
    spawnParticle(run.particles, run.rand,
      p.x + Math.cos(a) * r, p.y + Math.sin(a) * r,
      Math.cos(a) * 40, Math.sin(a) * 40, 4 + (i % 3), TINT.bone, 0.11);
  }
}

function hurt(run, e, aim) {
  const p = run.world.player;
  let damage = SWORD.damage;
  let blocked = false;

  if (e.steering === 'shield') {
    const fromFront = Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim));
    if (fromFront < e.blockArc * 0.5) {
      damage *= e.blockScale;
      blocked = true;
    }
  }

  e.hp -= damage;
  e.flash = 1;

  const weight = e.weight === 'heavy' ? 0.3 : e.weight === 'medium' ? 0.6 : 1;
  e.kx += Math.cos(aim) * SWORD.knockback * weight;
  e.ky += Math.sin(aim) * SWORD.knockback * weight;

  burst(run.particles, run.rand, e.x, e.y, blocked ? 3 : 4, 80,
    blocked ? TINT.pale : TINT.ember, 0.22);

  if (e.hp <= 0) kill(run, e);
}

function kill(run, e) {
  const i = run.world.goblins.indexOf(e);
  if (i >= 0) run.world.goblins.splice(i, 1);
  run.kills += 1;
  run.byKind[e.kind] += 1;
  const tint = e.kind === 'bloom' ? TINT.teal : e.kind === 'ork' ? TINT.pale : TINT.ember;
  burst(run.particles, run.rand, e.x, e.y, e.kind === 'bloom' ? 14 : 8, 140, tint, 0.4);
}
