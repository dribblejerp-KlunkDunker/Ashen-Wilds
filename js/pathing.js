// ============================================================
//  pathing — slope-aware enemy route-finding (Phase 2)
//  Enemies already obey the climb limits through solidAt(), but they only
//  ever walk straight at the player, so a crag, a terrace or a wall stalls
//  them. When a chasing enemy's straight step is blocked, this module finds a
//  walkable route on the cell grid (A*, bounded, cached) and steers the
//  game's own chase code along it. Nothing changes while the straight line is
//  clear, so flat maps and open ground behave exactly as before.
// ============================================================
'use strict';

const PATHING = (() => {
  const MAX_NODES = 600;     // expansion budget per search
  const MAX_DROP = 0.9;      // a drop an enemy will walk down (FALL_SAFE)
  const RECHECK = 0.6;       // seconds a route is trusted before it is recomputed
  const SAMPLE = 0.3;        // spacing of the walkability samples along a segment (a rise or a wall cell is never thinner)
  const R = 0.24;            // body radius used by solidAt
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const stepUp = () => (typeof STEP_UP === 'number' ? STEP_UP : 0.36);
  const maxGrade = () => (typeof MAX_GRADE === 'number' ? MAX_GRADE : 1.1);
  const hasRelief = (m) => !!(m && (m.lvls || m.smooth));
  const ground = (m, x, y) => (m.lvls || m.smooth) ? m.groundAt(x, y) : 0;

  // the body fits here: no wall, closed door or water under any corner (as solidAt, minus entities)
  function free(m, x, y) {
    if (x < 0.5 || y < 0.5 || x > m.w - 0.5 || y > m.h - 0.5) return false;
    return !(m.isBlocked((x - R) | 0, (y - R) | 0) || m.isBlocked((x + R) | 0, (y - R) | 0) || m.isBlocked((x - R) | 0, (y + R) | 0) || m.isBlocked((x + R) | 0, (y + R) | 0));
  }
  // one small step from a to b obeys the climb limits solidAt enforces, plus a
  // limit on how far down an enemy will walk
  function stepOk(m, ax, ay, bx, by, o) {
    if (!free(m, bx, by)) return false;
    if (!hasRelief(m)) return true;
    const g0 = ground(m, ax, ay), g1 = ground(m, bx, by);
    if (g1 - g0 > o.stepUp) return false;
    if (m.smooth && g1 > g0 + 0.02 && m.gradeAt(bx, by) > o.maxGrade) return false;
    if (g0 - g1 > o.maxDrop) return false;
    return true;
  }
  function segmentOk(m, ax, ay, bx, by, o) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / SAMPLE));
    let px = ax, py = ay;
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      if (!stepOk(m, px, py, x, y, o)) return false;
      px = x; py = y;
    }
    return true;
  }
  const norm = (opts) => {
    opts = opts || {};
    return {
      stepUp: opts.stepUp != null ? opts.stepUp : stepUp(),
      maxGrade: opts.maxGrade != null ? opts.maxGrade : maxGrade(),
      maxDrop: opts.maxDrop != null ? opts.maxDrop : MAX_DROP,
      maxNodes: opts.maxNodes != null ? Math.min(opts.maxNodes, MAX_NODES) : MAX_NODES,
      partial: !!opts.partial,
    };
  };

  // Route from (fromX, fromY) to (toX, toY) on the map's cell grid. Returns an
  // array of waypoints {x, y} (not including the start; the last is the target
  // when it is reachable) or null. With opts.partial the route to the explored
  // cell nearest the target is returned when the target itself is out of reach.
  function path(map, fromX, fromY, toX, toY, opts) {
    if (!map || !isFinite(fromX + fromY + toX + toY)) return null;
    const o = norm(opts), m = map, w = m.w, h = m.h;
    const sx = Math.floor(fromX), sy = Math.floor(fromY);
    let gx = Math.floor(toX), gy = Math.floor(toY);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    if (segmentOk(m, fromX, fromY, toX, toY, o)) return [{ x: toX, y: toY }];
    // binary heap over f-scores
    const g = new Float32Array(w * h).fill(1e9), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
    const heap = [];
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; const t = heap[s]; heap[s] = heap[i]; heap[i] = t; i = s; } } return top; };
    const key = (x, y) => y * w + x;
    // whether the body fits at each cell centre, computed once per search
    const seen = new Int8Array(w * h);
    const cellFree = (x, y) => { const k = y * w + x; if (!seen[k]) seen[k] = free(m, x + 0.5, y + 0.5) ? 1 : 2; return seen[k] === 1; };
    const hcost = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const cx = (k) => (k % w) + 0.5, cy = (k) => ((k / w) | 0) + 0.5;
    const sk = key(sx, sy);
    g[sk] = 0; push(sk, hcost(sx, sy));
    let best = sk, bestH = hcost(sx, sy), expanded = 0, goal = -1;
    while (heap.length && expanded < o.maxNodes) {
      const [, k] = pop();
      if (closed[k]) continue;
      closed[k] = 1; expanded++;
      const x = k % w, y = (k / w) | 0;
      if (x === gx && y === gy) { goal = k; break; }
      const hh = hcost(x, y); if (hh < bestH) { bestH = hh; best = k; }
      // the first cell is entered from the real position, later cells from their centres
      const ax = k === sk ? fromX : x + 0.5, ay = k === sk ? fromY : y + 0.5;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = key(nx, ny);
        if (closed[nk]) continue;
        // no cutting a corner: a diagonal needs both orthogonal cells walkable
        if (!cellFree(nx, ny)) continue;
        if (dx && dy && (!cellFree(x + dx, y) || !cellFree(x, y + dy))) continue;
        if (!segmentOk(m, ax, ay, nx + 0.5, ny + 0.5, o)) continue;
        const ng = g[k] + (dx && dy ? 1.414 : 1);
        if (g[nk] <= ng) continue;
        g[nk] = ng; from[nk] = k; push(nk, ng + hcost(nx, ny));
      }
    }
    let end = goal;
    if (end < 0) { if (!o.partial || best === sk) return null; end = best; }
    const cells = [];
    for (let k = end; k !== sk; k = from[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map(k => ({ x: cx(k), y: cy(k) }));
    if (goal >= 0) pts.push({ x: toX, y: toY });
    // string-pull: skip every waypoint a straight, walkable line can pass over
    const out = []; let px = fromX, py = fromY, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !segmentOk(m, px, py, pts[j].x, pts[j].y, o)) j--;
      out.push(pts[j]); px = pts[j].x; py = pts[j].y; i = j + 1;
    }
    return out;
  }

  // ---- steering ------------------------------------------------------
  const routes = new WeakMap();   // enemy -> { pts, i, t, tx, ty, map } (never stored on the entity: saves stay clean)
  let steer = null;               // the enemy whose chase step is being redirected right now
  let failedOnce = false;
  const stats = { searches: 0, routed: 0, errors: 0 };

  const baseUpdate = enemyUpdate;
  const baseMove = moveWithSlide;

  // redirect the one advancing step the original chase code takes this frame
  moveWithSlide = function (o, dx, dy, self) {
    const s = steer;
    if (s && o === s.e) {
      if (s.used) return true;   // the original's sidestep would fight the route
      const mag = Math.hypot(dx, dy);
      if (mag > 0 && dx * s.ux + dy * s.uy > 0.3 * mag) {   // an advance on the player, not a retreat
        s.used = true;
        const wx = s.wx - o.x, wy = s.wy - o.y, wl = Math.hypot(wx, wy);
        if (wl > 1e-4) { dx = wx / wl * mag; dy = wy / wl * mag; }
      }
    }
    return baseMove(o, dx, dy, self);
  };

  // is the straight step toward the player blocked right now, by height, or by a wall out of sight?
  function blockedAhead(e, m, c, dx, dy, dist, dt) {
    const sp = ((e.def && e.def.speed) || 1) * dt;
    const look = Math.max(sp * 2, 0.3), ux = dx / dist, uy = dy / dist;
    const px = e.x + ux * look, py = e.y + uy * look;
    if (hasRelief(m)) {
      const feet = typeof e.feet === 'number' ? e.feet : m.groundAt(e.x, e.y), gnd = m.groundAt(px, py);
      if (gnd - feet > stepUp()) return true;
      if (m.smooth && gnd > feet + 0.02 && m.gradeAt(px, py) > maxGrade()) return true;
    }
    if (!free(m, px, py) && !los(e.x, e.y, c.x, c.y)) return true;
    return false;
  }

  function update(e, dt) {
    if (api.fault) api.fault(e);   // tests set this to prove a failure here never reaches the frame
    const m = G.map, c = Engine.cam, d = e.def;
    if (!m || !d || e.state !== 'chase' || e.dead || e.hidden || e.stun > 0 || !(d.speed > 0)) return null;
    if (d.fly || d.phase || d.ghost) return null;
    const dx = c.x - e.x, dy = c.y - e.y, dist = Math.hypot(dx, dy);
    if (dist <= (d.reach || 1) + 0.2 || dist > 40) { routes.delete(e); return null; }
    const now = G.time || 0;
    let r = routes.get(e);
    if (r && r.map !== m) { routes.delete(e); r = null; }
    if (r && !r.pts) { if (now - r.t < RECHECK) return null; routes.delete(e); r = null; }   // a failed search is remembered briefly too
    if (r) {
      // the way is open again: the plain chase takes over
      if (segmentOk(m, e.x, e.y, c.x, c.y, norm())) { routes.delete(e); return null; }
    } else if (!blockedAhead(e, m, c, dx, dy, dist, dt)) return null;
    const last = r && r.pts[r.pts.length - 1];
    if (!r || now - r.t > RECHECK || Math.hypot(c.x - r.tx, c.y - r.ty) > 2 || (last && Math.hypot(last.x - e.x, last.y - e.y) < 0.35)) {
      stats.searches++;
      const pts = path(m, e.x, e.y, c.x, c.y, { partial: true });
      r = { pts, i: 0, t: now, tx: c.x, ty: c.y, map: m };
      routes.set(e, r);
    }
    if (!r.pts || !r.pts.length) return null;
    while (r.i < r.pts.length - 1 && Math.hypot(r.pts[r.i].x - e.x, r.pts[r.i].y - e.y) < 0.35) r.i++;
    const wp = r.pts[r.i];
    stats.routed++;
    return { e, wx: wp.x, wy: wp.y, ux: dx / dist, uy: dy / dist, used: false };
  }

  enemyUpdate = function (e, dt) {
    let s = null;
    try { s = update(e, dt); } catch (err) { stats.errors++; s = null; if (!failedOnce) { failedOnce = true; try { console.warn('pathing: ' + err.message); } catch (_) { /* no console */ } } }
    if (!s) return baseUpdate(e, dt);
    steer = s;
    try { return baseUpdate(e, dt); } finally { steer = null; }
  };

  const api = { path, segmentOk, stepOk, free, original: baseUpdate, stats, routes, fault: null };
  return api;
})();
