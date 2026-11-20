// Circle against walls, and circle against circle (design 3.3).
// Position is corrected and velocity is kept, so the player slides along a wall instead of
// sticking to it. Segment ends are handled by the closest-point maths, which is the round corner.

export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: x1, y: y1, t: 0 };
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + dx * t, y: y1 + dy * t, t };
}

// Push a circle out of a list of wall segments. Returns true if anything was hit.
export function resolveWalls(body, radius, walls) {
  let hit = false;
  for (const w of walls) {
    const c = closestPointOnSegment(body.x, body.y, w.x1, w.y1, w.x2, w.y2);
    let dx = body.x - c.x;
    let dy = body.y - c.y;
    let d = Math.hypot(dx, dy);
    if (d > radius) continue;
    hit = true;
    if (d === 0) { dx = 0; dy = -1; d = 1; }
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
