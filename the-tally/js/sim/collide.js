// Circle against walls, and circle against circle (design 3.3).
// Position is corrected and velocity is kept, so the player slides along a wall instead of
// sticking to it. Segment ends are handled by the closest-point maths, which is the round corner.

// Push a circle out of a list of wall segments. Returns true if anything was hit.
// This runs for every goblin on every step, so the closest point is computed inline: no point
// object and no hypot per wall.
export function resolveWalls(body, radius, walls) {
  // Where the body was before the step: if a push carried it through an axis-aligned wall, it
  // must go back to that side. Pushing along the closest-point normal would instead eject it
  // out the far side, which is how a goblin ends up outside the yard for good.
  const px = body.px === undefined ? body.x : body.px;
  const py = body.py === undefined ? body.y : body.py;
  let hit = false;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const minX = (w.x1 < w.x2 ? w.x1 : w.x2) - radius;
    const maxX = (w.x1 > w.x2 ? w.x1 : w.x2) + radius;
    const minY = (w.y1 < w.y2 ? w.y1 : w.y2) - radius;
    const maxY = (w.y1 > w.y2 ? w.y1 : w.y2) + radius;

    if (w.x1 === w.x2 && (body.x - w.x1) * (px - w.x1) < 0
      && body.y >= minY && body.y <= maxY) {
      body.x = w.x1 + (px < w.x1 ? -radius : radius);
      hit = true;
      continue;
    }
    if (w.y1 === w.y2 && (body.y - w.y1) * (py - w.y1) < 0
      && body.x >= minX && body.x <= maxX) {
      body.y = w.y1 + (py < w.y1 ? -radius : radius);
      hit = true;
      continue;
    }

    if (body.x < minX || body.x > maxX || body.y < minY || body.y > maxY) continue;

    const sx = w.x2 - w.x1;
    const sy = w.y2 - w.y1;
    const len2 = sx * sx + sy * sy;
    let cx = w.x1;
    let cy = w.y1;
    if (len2 > 0) {
      let t = ((body.x - w.x1) * sx + (body.y - w.y1) * sy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      cx += sx * t;
      cy += sy * t;
    }

    const dx = body.x - cx;
    const dy = body.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius) continue;
    hit = true;
    if (d === 0) {
      // Dead centre: there is no direction, so pick one and push a full radius clear.
      body.x = cx;
      body.y = cy - radius;
      continue;
    }
    const push = radius - d;
    body.x += (dx / d) * push;
    body.y += (dy / d) * push;
  }
  return hit;
}

// Separate two overlapping circles. aShare is the share of the correction `a` takes.
export function separate(a, ra, b, rb, aShare) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = ra + rb;
  if (d >= min) return 0;
  if (d === 0) { dx = 1; dy = 0; d = 1; }
  const push = min - d;
  a.x -= (dx / d) * push * aShare;
  a.y -= (dy / d) * push * aShare;
  b.x += (dx / d) * push * (1 - aShare);
  b.y += (dy / d) * push * (1 - aShare);
  return push;
}

// A rectangle as four wall segments.
export function rectWalls(x, y, w, h) {
  return [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y },
  ];
}
