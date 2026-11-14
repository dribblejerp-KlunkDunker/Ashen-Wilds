// ============================================================
//  gates — Phase 4 module: rising portcullises and the Quarry cave-in
//  All art is procedural stand-in work (generated lattice and rubble textures,
//  dust and falling stone drawn from a render hook); painted frames can replace it.
//
//  GATES / PORTCULLISES  (GFX.gateAnims, default on, joins GFX.FX)
//    A "gate" is a door cell whose label or lock message calls it a gate, grate or
//    culvert (North Gate, tannery culvert, quarry and Root-vault shaft gates, the
//    Catacombs grates). Doors in house walls keep swinging (doors.js).
//    - A gate draws as an iron lattice. Closed it is an opaque lattice cell; once it
//      starts to open the engine stops drawing it (Doors.swing says "miss") and a
//      render hook draws the same lattice with real gaps, lifted straight up.
//    - Collision is untouched: the engine's open threshold (> 0.7) still decides
//      passability. The lift is mapped so the bar's lower edge reaches the player's
//      head exactly at that threshold: barBottom(0.7) == HEAD_TOP, anything above
//      clears it. Heights are relative to the cell's own floor.
//    - Portal gates play the opening before the transfer: input is locked, the door
//      rises, then the original transfer runs exactly once (a timeout, a death, a
//      map change or a load cancels cleanly). Saves taken mid-opening record the
//      gate as shut. Locked gates behave as before: the lock check runs first.
//
//  COLLAPSES  (GFX.collapses, default on; changes the world, so not in GFX.FX)
//    Quarry cave-in: once the Siphon bit snaps (G.flags.bore_broken) and the player
//    is back in the Quarry, the shaft room's roof comes down. Stone falls and dust
//    hangs for a few seconds, then some floor cells of the shaft room become rubble.
//    - Which cells: planned once per build from the pristine map, in a fixed order,
//      keeping a lane to the gate, away from every prop, and accepting a cell only
//      if a flood fill still reaches every item, NPC, door and portal that the map
//      could reach before (so no exit or story target is ever cut off).
//    - Saved by G.flags.gates_quarry_cavein only; cells are rebuilt and reapplied in
//      loadMap, so save/load, travel and rest reproduce the same room.
//    - Anyone standing in the rubble (player, companions, NPCs, enemies, loot) is moved
//      to the nearest free reachable spot. The shake goes through FEEL.heavyHit, which
//      already honours reduced motion; with reduced motion the falling stone is replaced
//      by a still dust haze.
// ============================================================
'use strict';

if (GFX.gateAnims === undefined) GFX.gateAnims = true;
if (GFX.collapses === undefined) GFX.collapses = true;
if (GFX.FX && !GFX.FX.includes('gateAnims')) GFX.FX.push('gateAnims');

const GATES = (() => {
  const TEX = 64;
  const THRESH = 0.7;          // maps.js isSolidCell: a door is passable once open > 0.7
  const HEAD_TOP = 0.98;       // eye height 0.88 plus the crown of the head
  const FLAG = 'gates_quarry_cavein';
  const WARN = 2.4, SETTLE = 1.8, GRACE = 1.2, RUBBLE_H = 0.45, MAX_RUBBLE = 9;
  const abgr = (r, g, b, a) => ((a === undefined ? 255 : a) << 24) | (b << 16) | (g << 8) | r;
  // deterministic hash in [0,1): nothing here may touch Math.random (tests freeze it, replays must agree)
  function hash(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

  // ------------------------------------------------------------ art (stand-in)
  // Lattice: six uprights with spiked feet, three cross rails and a heavy top rail.
  function buildBars(closed) {
    const d = new Uint32Array(TEX * TEX);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const px = (x + 3) % 10, upright = px < 4;
      const spike = y > 55 ? (y - 55) : 0;                       // taper to a point over the last rows
      const inUp = upright && (spike === 0 || (px >= 1 + (spike >> 2) && px < 3 - (spike >> 3) + 1 && spike < 8));
      const rail = (y >= 6 && y <= 8) || (y >= 30 && y <= 32) || (y >= 52 && y <= 54) || y <= 3;
      let c = null;
      if (rail || inUp) {
        const edge = rail ? (y % 3) : px, n = hash(x * 131 + y * 17) * 14;
        const lit = rail ? (y <= 3 ? 34 - y * 4 : 20 - (y % 3) * 8) : (px === 0 ? 26 : px === 3 ? -18 : 6);
        c = abgr(Math.max(0, Math.min(255, 78 + lit + n - 6 + (hash(y * 7 + x) > 0.93 ? 18 : 0))), Math.max(0, Math.min(255, 74 + lit + n - 8)), Math.max(0, Math.min(255, 70 + lit + n - 10)));
        void edge;
      }
      if (c !== null) d[y * TEX + x] = c;
      else if (closed) { const g = 16 + (y >> 3) + ((hash(x * 3 + y * 29) * 5) | 0); d[y * TEX + x] = abgr(g, g + 1, g + 3); }   // darkness behind a shut gate
      else d[y * TEX + x] = 0;
    }
    return d;
  }
  // Rubble: cellular blocks of broken stone, darker in the cracks.
  function buildRubble() {
    const N = 46, pts = [];
    for (let i = 0; i < N; i++) pts.push([hash(i * 5 + 1) * TEX, hash(i * 5 + 2) * TEX, 0.55 + hash(i * 5 + 3) * 0.55, hash(i * 5 + 4)]);
    const d = new Uint32Array(TEX * TEX);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      let b1 = 1e9, b2 = 1e9, k = 0;
      for (let i = 0; i < N; i++) {
        let dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]); if (dx > TEX / 2) dx = TEX - dx; if (dy > TEX / 2) dy = TEX - dy;
        const dd = dx * dx + dy * dy; if (dd < b1) { b2 = b1; b1 = dd; k = i; } else if (dd < b2) b2 = dd;
      }
      const edge = Math.sqrt(b2) - Math.sqrt(b1), shade = pts[k][2], warm = pts[k][3];
      const crack = edge < 1.6 ? 0.45 + edge * 0.3 : 1, n = 0.9 + hash(x * 977 + y * 31) * 0.2;
      const v = 120 * shade * crack * n;
      d[y * TEX + x] = abgr(Math.min(255, v * (1 + warm * 0.12)) | 0, Math.min(255, v * 0.95) | 0, Math.min(255, v * (0.86 - warm * 0.06)) | 0);
    }
    return d;
  }
  function registerArt() {
    if (!Engine.textures.gates_bars) Engine.addTexture('gates_bars', buildBars(false));
    if (!Engine.textures.gates_bars_closed) Engine.addTexture('gates_bars_closed', buildBars(true));
    if (!Engine.textures.gates_rubble) Engine.addTexture('gates_rubble', buildRubble());
  }

  // ------------------------------------------------------------ gate cells
  const GATE_RX = /\b(gate|grate|culvert|portcullis)\b/i;
  // cell -> { or } or false; cached on the cell object (cells are rebuilt with the map, never saved)
  function gateInfo(c, grid, mw, mx, my) {
    if (!c || !c.door) return false;
    if (c._gate !== undefined) return c._gate;
    let g = false;
    if (GATE_RX.test((c.label || '') + ' ' + (c.lockMsg || ''))) {
      const or = Doors.orient(null, grid, mw, my * mw + mx);
      g = { or, x: mx, y: my, ci: my * mw + mx };
    }
    return (c._gate = g);
  }
  const cache = new WeakMap();   // map -> [gate info]
  function gatesOf(m) {
    if (!m || !m.cells) return [];
    let l = cache.get(m);
    if (l && l.n === m.cells.length) return l;
    l = []; l.n = m.cells.length;
    for (let i = 0; i < m.cells.length; i++) { const c = m.cells[i]; if (c && c.door) { const g = gateInfo(c, m.cells, m.w, i % m.w, (i / m.w) | 0); if (g) l.push(Object.assign({ cell: c }, g)); } }
    cache.set(m, l);
    return l;
  }
  function gateAt(m, x, y) { return gatesOf(m).find(g => g.x === x && g.y === y) || null; }

  // The bar's lower edge above the cell's floor, for a door that is `open` (0..1) open.
  // Piecewise so the edge reaches the head exactly at the engine's passable threshold.
  function barBottom(open) {
    if (!(open > 0)) return 0; if (open >= 1) return 1;
    return open <= THRESH ? open * (HEAD_TOP / THRESH) : HEAD_TOP + (open - THRESH) * ((1 - HEAD_TOP) / (1 - THRESH));
  }
  const clearsHead = open => barBottom(open) > HEAD_TOP + 1e-9;

  // closed gates wear the lattice texture (cell.tex is only a picture; the original name is kept to restore)
  function syncLook(m) {
    for (const g of gatesOf(m)) {
      const c = g.cell;
      if (c._gtex0 === undefined) c._gtex0 = c.tex;
      const want = GFX.gateAnims && g.or ? 'gates_bars_closed' : c._gtex0;
      if (c.tex !== want) c.tex = want;
    }
  }

  // The engine asks Doors.swing about every opening door; for a gate it must draw nothing
  // (the hook below draws it), so answer "ray misses".
  const _swing = Doors.swing;
  Doors.swing = function (d, mx, my, cx, cy, rdx, rdy, grid, mw) {
    if (GFX.gateAnims) { const c = grid[my * mw + mx], g = c && c.door && gateInfo(c, grid, mw, mx, my); if (g && g.or) return 1; }
    return _swing.apply(this, arguments);
  };

  // ------------------------------------------------------------ projection
  function proj(F, x, y, z, o) {
    const dx = x - F.cam.x, dy = y - F.cam.y, inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const tx = inv * (F.dirY * dx - F.dirX * dy), ty = inv * (-F.planeY * dx + F.planeX * dy);
    o.ty = ty; o.sx = ty > 0.02 ? (F.w / 2) * (1 + tx / ty) : 0; o.sy = ty > 0.02 ? F.horizon + (F.h / ty) * (F.cam.z - z) : 0;
    return ty > 0.02;
  }
  const P1 = { ty: 0, sx: 0, sy: 0 }, P2 = { ty: 0, sx: 0, sy: 0 };

  function shadeFor(F, t) {
    let f = F.light * (1 - t / F.fogDist); if (f < 0) f = 0;
    return F.ambient + (1 - F.ambient) * f;
  }

  // ------------------------------------------------------------ the lifting bars
  const stat = { cols: 0, px: 0, ms: 0, gates: 0 };
  function drawGates(F) {
    if (!GFX.gateAnims || !F.map) return;
    const gl = gatesOf(F.map); if (!gl.length) return;
    const t0 = performance.now(), tex = Engine.textures.gates_bars; if (!tex) return;
    const m = F.map, w = F.w, h = F.h, fb = F.fb, db = F.dbuf, mb = F.mbuf, cam = F.cam, MW = Engine.MAT.wall;
    stat.cols = 0; stat.px = 0; stat.gates = 0;
    for (let gi = 0; gi < gl.length; gi++) {
      const g = gl[gi]; if (!g.or) continue;
      const d = m.doors[g.ci]; if (!d || !(d.open > 0.001) || d.open >= 0.98) continue;
      const or = g.or, mx = g.x, my = g.y;
      // columns this gate can touch
      const a = or === 1 ? proj(F, mx + 0.5, my, 0, P1) : proj(F, mx, my + 0.5, 0, P1), b = or === 1 ? proj(F, mx + 0.5, my + 1, 0, P2) : proj(F, mx + 1, my + 0.5, 0, P2);
      if (!a && !b) continue;
      let x0 = 0, x1 = w - 1;
      if (a && b) { x0 = Math.max(0, Math.floor(Math.min(P1.sx, P2.sx)) - 1); x1 = Math.min(w - 1, Math.ceil(Math.max(P1.sx, P2.sx)) + 1); }
      if (x0 > x1) continue;
      const base = (m.lvls || m.smooth) ? m.groundAt(mx + 0.5, my + 0.5) : 0, bb = barBottom(d.open), zTop = base + 1, zTex = base + bb + 1;
      stat.gates++;
      const side = or === 2 ? 0.8 : 1, outdoor = F.outdoor, fr = F.fogR, fg = F.fogG, fbl = F.fogB, lt = F.light;
      for (let x = x0; x <= x1; x++) {
        const camX = 2 * x / w - 1, rdx = F.dirX + F.planeX * camX, rdy = F.dirY + F.planeY * camX;
        let t, u;
        if (or === 1) { if (rdx > -1e-9 && rdx < 1e-9) continue; t = (mx + 0.5 - cam.x) / rdx; if (t <= 0.02) continue; u = cam.y + t * rdy - my; }
        else { if (rdy > -1e-9 && rdy < 1e-9) continue; t = (my + 0.5 - cam.y) / rdy; if (t <= 0.02) continue; u = cam.x + t * rdx - mx; }
        if (u < 0 || u >= 1) continue;
        const k = h / t;
        let ys = Math.ceil(F.horizon + k * (cam.z - zTop)), ye = Math.floor(F.horizon + k * (cam.z - (base + bb)));
        if (ys < 0) ys = 0; if (ye > h - 1) ye = h - 1;
        if (ye < ys) continue;
        stat.cols++;
        const tx = (u * TEX) | 0, f = shadeFor(F, t) * side;
        if (g.cell.portal) {
          // a portal gate opens onto nothing drawable (the map edge or a niche wall): show a dark passage behind the bars
          let bs = Math.ceil(F.horizon + k * (cam.z - zTop)), be = Math.floor(F.horizon + k * (cam.z - base));
          if (bs < 0) bs = 0; if (be > h - 1) be = h - 1;
          const dk = (255 << 24) | (((14 + 4 * f) | 0) << 16) | (((12 + 3 * f) | 0) << 8) | ((12 + 3 * f) | 0);
          for (let y = bs; y <= be; y++) { const o = y * w + x; if (db[o] > t + 0.2) { fb[o] = dk; db[o] = t + 0.2; mb[o] = MW; } }
        }
        for (let y = ys; y <= ye; y++) {
          const o = y * w + x; if (db[o] < t - 0.002) continue;
          const z = cam.z - (y + 0.5 - F.horizon) / k;
          let ty = ((zTex - z) * TEX) | 0; if (ty < 0) ty = 0; else if (ty > TEX - 1) ty = TEX - 1;
          const px = tex[ty * TEX + tx]; if ((px >>> 24) < 100) continue;
          let r = px & 255, gg = (px >> 8) & 255, bl = (px >> 16) & 255;
          if (outdoor) { r = (r * f + fr * (1 - f)) * lt; gg = (gg * f + fg * (1 - f)) * lt; bl = (bl * f + fbl * (1 - f)) * lt; }
          else { r *= f; gg *= f; bl *= f; }
          fb[o] = (255 << 24) | ((bl > 255 ? 255 : bl | 0) << 16) | ((gg > 255 ? 255 : gg | 0) << 8) | (r > 255 ? 255 : r | 0);
          db[o] = t; mb[o] = MW; stat.px++;
        }
      }
    }
    stat.ms = performance.now() - t0;
  }

  // ------------------------------------------------------------ portal gates: open, then transfer once
  let pending = null;   // { map, ci, portal, t }
  const OPEN_TIMEOUT = 1.6;
  function cancelPending(why) {
    if (!pending) return;
    const p = pending; pending = null;
    const d = p.map.doors[p.ci]; if (d) { d.open = 0; d.target = 0; }
    p.why = why;
  }
  function finishPending() {
    const p = pending; pending = null;
    const d = p.map.doors[p.ci]; if (d) { d.open = 0; d.target = 0; }   // the original never left a portal door open
    stats.transfers++;
    _transfer(p.portal);
  }
  const stats = { transfers: 0, started: 0, cancelled: 0 };
  const _transfer = transfer;
  transfer = function (portal) {
    try {
      if (GFX.gateAnims && !pending && !GFX.reduceMotion && G.map && G.state === 'play' && !G.dead) {
        const w = Engine.pickWall(2.0);
        if (w && w.cell && w.cell.door && w.cell.portal === portal) {
          const g = gateInfo(w.cell, G.map.cells, G.map.w, w.x, w.y), ci = w.y * G.map.w + w.x, d = G.map.doors[ci];
          if (g && g.or && d) {
            pending = { map: G.map, ci, portal, t: 0 }; stats.started++;
            G.vel.x = 0; G.vel.y = 0; d.target = 1;
            return;
          }
        }
      }
    } catch (err) { pending = null; console.warn('gates transfer wrap failed', err); }
    return _transfer.apply(this, arguments);
  };
  const _interact = interact;
  interact = function () { if (pending) return; return _interact.apply(this, arguments); };

  const _snapshot = snapshotGame;
  snapshotGame = function () {
    const p = pending, d = p && p.map.doors[p.ci], keep = d ? [d.open, d.target] : null;
    if (d) { d.open = 0; d.target = 0; }
    try { return _snapshot.apply(this, arguments); } finally { if (d && pending === p) { d.open = keep[0]; d.target = keep[1]; } }
  };

  // ------------------------------------------------------------ collapse: planning
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function cellOpen(m, x, y) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    const c = m.cells[y * m.w + x];
    if (c && !c.door) return false;
    return !(m.floorCells && m.floorCells[y * m.w + x] === 2);
  }
  // may a walker step from cell a to the adjacent cell b? (height rules of solidAt, both directions)
  function stepOk(m, ax, ay, bx, by) {
    if (!cellOpen(m, bx, by) || !cellOpen(m, ax, ay)) return false;
    if (!(m.lvls || m.smooth)) return true;
    const ga = m.groundAt(ax + 0.5, ay + 0.5), gb = m.groundAt(bx + 0.5, by + 0.5);
    for (const [from, to, fx, fy, tx, ty] of [[ga, gb, ax, ay, bx, by], [gb, ga, bx, by, ax, ay]]) {
      if (to - from > STEP_UP) return false;
      if (m.smooth && to > from + 0.02 && m.gradeAt(tx + 0.5, ty + 0.5) > MAX_GRADE) return false;
    }
    return true;
  }
  function flood(m, sx, sy) {
    const seen = new Uint8Array(m.w * m.h), q = [sx, sy]; if (!cellOpen(m, sx, sy)) return seen;
    seen[sy * m.w + sx] = 1;
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1];
      for (const [dx, dy] of NB) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen[ny * m.w + nx]) continue; if (!stepOk(m, x, y, nx, ny)) continue; seen[ny * m.w + nx] = 1; q.push(nx, ny); }
    }
    return seen;
  }
  // the cells a player must be able to reach: every portal and door (by its open side), spawn, items, NPCs, usable props, triggers
  function targets(m) {
    const out = [], add = (x, y) => { x |= 0; y |= 0; if (!out.some(t => t[0] === x && t[1] === y)) out.push([x, y]); };
    add(m.spawn.x, m.spawn.y); if (m.shaftReturn) add(m.shaftReturn.x, m.shaftReturn.y);
    for (let i = 0; i < m.cells.length; i++) {
      const c = m.cells[i]; if (!c || !c.door) continue;
      const x = i % m.w, y = (i / m.w) | 0;
      add(x, y);
      for (const [dx, dy] of NB) if (cellOpen(m, x + dx, y + dy) && !(m.cells[(y + dy) * m.w + x + dx] || {}).door) add(x + dx, y + dy);
    }
    for (const e of m.entities) if (typeof e.x === 'number' && (e.kind === 'item' || e.kind === 'npc' || (e.kind === 'deco' && e.use))) add(Math.floor(e.x), Math.floor(e.y));
    for (const t of m.triggers) add(Math.floor(t.x), Math.floor(t.y));
    return out;
  }
  // every target the map could reach from its spawn is still reached afterwards
  function stillReachable(m, from, tg, base) {
    const seen = flood(m, from[0], from[1]);
    for (let i = 0; i < tg.length; i++) if (base[i] && !seen[tg[i][1] * m.w + tg[i][0]]) return false;
    return true;
  }
  const CAVEINS = [{ id: 'quarry', map: 'quarry', room: 'shaft' }];
  // Choose the rubble cells of a map from its pristine state. Pure: the map is left unchanged.
  function plan(m, spec) {
    const room = m.named && m.named[spec.room]; if (!room) return null;
    const sp = [Math.floor(m.spawn.x), Math.floor(m.spawn.y)], tg = targets(m), seen0 = flood(m, sp[0], sp[1]);
    const base = tg.map(t => !!seen0[t[1] * m.w + t[0]]);
    // the lane: the arrival cell and the cell in front of the gate stay clear, as does anything near a prop or entity
    const keep = new Set();
    if (m.shaftReturn) keep.add(Math.floor(m.shaftReturn.y) * m.w + Math.floor(m.shaftReturn.x));
    for (const t of tg) keep.add(t[1] * m.w + t[0]);
    const cands = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      const ci = y * m.w + x; if (!cellOpen(m, x, y) || keep.has(ci) || m.cells[ci]) continue;
      let near = false;
      for (const e of m.entities) if (typeof e.x === 'number' && Math.abs(e.x - (x + 0.5)) < 0.9 && Math.abs(e.y - (y + 0.5)) < 0.9) { near = true; break; }
      if (!near) cands.push([x, y]);
    }
    const ref = m.shaftReturn || m.spawn;
    cands.sort((a, b) => (Math.hypot(a[0] + 0.5 - ref.x, a[1] + 0.5 - ref.y) - Math.hypot(b[0] + 0.5 - ref.x, b[1] + 0.5 - ref.y)) || (a[1] - b[1]) || (a[0] - b[0]));
    const chosen = [], saved = new Map();
    const probe = { w: m.w, h: m.h, cells: m.cells.slice(), floorCells: m.floorCells, lvls: m.lvls, smooth: m.smooth, groundAt: (x, y) => m.groundAt(x, y), gradeAt: (x, y) => m.gradeAt(x, y) };
    for (const [x, y] of cands) {
      if (chosen.length >= MAX_RUBBLE) break;
      // skip every second diagonal-adjacent pick so the pile is lumpy rather than a solid block
      const ci = y * m.w + x; probe.cells[ci] = { tex: 'gates_rubble' };
      if (stillReachable(probe, sp, tg, base)) { chosen.push([x, y]); saved.set(ci, 1); } else probe.cells[ci] = m.cells[ci];
    }
    return { id: spec.id, map: spec.map, cells: chosen.map(([x, y]) => [x, y, (m.lvls || m.smooth) ? m.groundAt(x + 0.5, y + 0.5) : 0]), targets: tg, baseReach: base, spawn: sp, ceil: m.ceilZ || 2.7 };
  }

  function rubbleCell(ground, grow) {
    return { tex: 'gates_rubble', top: ground + RUBBLE_H * grow, rubble: true, _gground: ground, label: 'Fallen stone from the shaft-room roof.' };
  }
  // put the plan's rubble into the map (idempotent); remembers what was there so it can be undone
  function applyPlan(m, pl, grow) {
    if (!m || !pl) return false;
    if (!m._gRec) m._gRec = [];
    if (m._gRec.length) { for (const r of m._gRec) { const c = m.cells[r.ci]; if (c && c.rubble) c.top = r.ground + RUBBLE_H * (grow == null ? 1 : grow); } return true; }
    for (const [x, y, ground] of pl.cells) { const ci = y * m.w + x; m._gRec.push({ ci, prev: m.cells[ci], ground }); m.cells[ci] = rubbleCell(ground, grow == null ? 1 : grow); }
    Engine.scanRelief(m);
    return true;
  }
  function revertPlan(m) {
    if (!m || !m._gRec || !m._gRec.length) { if (m) m._gRec = null; return false; }
    for (const r of m._gRec) m.cells[r.ci] = r.prev;
    m._gRec = null; Engine.scanRelief(m);
    return true;
  }
  const planOf = m => (m && m._gPlan) || null;

  // ------------------------------------------------------------ collapse: recovery
  function reachFrom(m, pl) { return flood(m, pl.spawn[0], pl.spawn[1]); }
  function overlapsRubble(m, x, y, r) {
    for (const rec of (m._gRec || [])) {
      const cx = rec.ci % m.w, cy = (rec.ci / m.w) | 0;
      const nx = Math.max(cx, Math.min(x, cx + 1)), ny = Math.max(cy, Math.min(y, cy + 1));
      if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
    }
    return false;
  }
  // nearest free, reachable spot for something at (x, y); never inside rubble
  function safeSpot(m, pl, e, x, y, isPlayer, r) {
    const seen = reachFrom(m, pl);
    let best = null, bd = 1e9;
    const R = 9;
    for (let cy = Math.max(0, (y | 0) - R); cy <= Math.min(m.h - 1, (y | 0) + R); cy++) for (let cx = Math.max(0, (x | 0) - R); cx <= Math.min(m.w - 1, (x | 0) + R); cx++) {
      if (!seen[cy * m.w + cx]) continue;
      const px = cx + 0.5, py = cy + 0.5, d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d >= bd) continue;
      if (overlapsRubble(m, px, py, r + 0.05) || solidAt(px, py, isPlayer ? null : e)) continue;
      best = { x: px, y: py }; bd = d;
    }
    if (best) return best;
    return { x: pl.spawn[0] + 0.5, y: pl.spawn[1] + 0.5 };
  }
  const moved = [];   // log of the last recovery (for tests and the report)
  function recover(m, pl) {
    moved.length = 0;
    if (!m._gRec || !m._gRec.length) return 0;
    let n = 0;
    for (const e of m.entities) {
      if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
      const r = Math.min(e.radius || 0.3, 0.35);
      if (!overlapsRubble(m, e.x, e.y, r)) continue;
      const s = safeSpot(m, pl, e, e.x, e.y, false, r);
      moved.push({ what: e.id || e.type || e.sprite || e.kind, from: [e.x, e.y], to: [s.x, s.y] });
      e.x = s.x; e.y = s.y; if (e.homeX !== undefined) { e.homeX = s.x; e.homeY = s.y; } n++;
      if (G.party && G.party.trail) G.party.trail = [];
    }
    if (G.map === m && G.player) {
      const c = Engine.cam;
      if (overlapsRubble(m, c.x, c.y, 0.3)) {
        const s = safeSpot(m, pl, null, c.x, c.y, true, 0.3);
        moved.push({ what: 'player', from: [c.x, c.y], to: [s.x, s.y] });
        c.x = s.x; c.y = s.y; G.vel.x = 0; G.vel.y = 0; settleFeet(); n++;
      }
    }
    return n;
  }

  // ------------------------------------------------------------ collapse: state machine
  const cave = { phase: 'idle', t: 0, map: null, pl: null, grace: 0, hurt: false };
  let puffs = [];            // one-off dust puffs {x,y,z,t,r,life} (resonant wall etc.)
  function caveSpec(m) { return m ? CAVEINS.find(s => s.map === m.id) : null; }
  function stopRumble() { try { Audio_.hum(0, 48, 'gates_cavein'); } catch (e) { /* audio is optional */ } }
  function resetCave() { if (cave.phase !== 'idle') stopRumble(); cave.phase = 'idle'; cave.t = 0; cave.map = null; cave.pl = null; cave.grace = 0; }

  // Used when a map is entered or restored: if the cave-in already happened, the rubble is there at once.
  function ensureApplied(m) {
    if (!m) return;
    const spec = caveSpec(m);
    if (!spec) return;
    const want = GFX.collapses && G.flags && G.flags[FLAG] && planOf(m);
    if (want) applyPlan(m, planOf(m), 1); else if (m._gRec) revertPlan(m);
  }

  function beginWarn(m) {
    const pl = planOf(m); if (!pl || !pl.cells.length) { G.flags[FLAG] = true; return; }   // nothing to bring down
    cave.phase = 'warn'; cave.t = 0; cave.map = m; cave.pl = pl;
    try { msg('Dust sifts from the roof of the shaft room. The rock is groaning.', 'warn', 3500); } catch (e) { /* cosmetic */ }
  }
  function commit() {
    const m = cave.map, pl = cave.pl;
    G.flags[FLAG] = true;   // claim first: a reload mid-effect must not run it twice
    applyPlan(m, pl, 0.05);
    const n = recover(m, pl);
    cave.phase = 'settle'; cave.t = 0;
    try { Audio_.sfx.crack(); } catch (e) { /* audio is optional */ }
    try { if (typeof FEEL !== 'undefined' && FEEL.heavyHit && !GFX.reduceMotion) FEEL.heavyHit(0.3); } catch (e) { /* cosmetic */ }
    try { msg(n ? 'The roof comes down. You scramble clear of the falling stone.' : 'The roof comes down in a roar of stone. The way out is still open.', 'warn', 5000); } catch (e) { /* cosmetic */ }
  }
  function tickCave(dt) {
    if (!GFX.collapses) { if (cave.phase !== 'idle') { revertPlan(cave.map); resetCave(); } return; }
    const m = G.map;
    if (cave.phase !== 'idle' && cave.map !== m) { if (cave.phase === 'warn') { cave.phase = 'idle'; } resetCave(); }
    if (cave.phase === 'idle') {
      const spec = caveSpec(m);
      if (spec && G.flags && G.flags.bore_broken && !G.flags[FLAG] && G.state === 'play') {
        cave.grace += dt;
        if (cave.grace >= GRACE) { cave.grace = 0; beginWarn(m); }
      } else cave.grace = 0;
      return;
    }
    cave.t += dt;
    if (cave.phase === 'warn') {
      try { Audio_.hum(Math.min(0.8, cave.t / WARN), 46 + cave.t * 4, 'gates_cavein'); } catch (e) { /* audio is optional */ }
      if (cave.t >= WARN) commit();
    } else if (cave.phase === 'settle') {
      const k = Math.min(1, cave.t / 0.7), e = k * k * (3 - 2 * k);
      for (const r of (m._gRec || [])) { const c = m.cells[r.ci]; if (c && c.rubble) c.top = r.ground + RUBBLE_H * (0.05 + 0.95 * e); }
      try { Audio_.hum(Math.max(0, 0.8 * (1 - cave.t / SETTLE)), 40, 'gates_cavein'); } catch (e2) { /* audio is optional */ }
      if (cave.t >= SETTLE) { stopRumble(); cave.phase = 'idle'; cave.map = null; cave.pl = null; }
    }
  }

  // ------------------------------------------------------------ collapse: picture
  function dust(F, x, y, z, rad, a, tone) {
    const o = P1; if (!proj(F, x, y, z, o)) return;
    const w = F.w, h = F.h, fb = F.fb, db = F.dbuf, k = h / o.ty, R = Math.min(rad * k, 70 * F.S);
    if (R < 1) return;
    const x0 = Math.max(0, (o.sx - R) | 0), x1 = Math.min(w - 1, Math.ceil(o.sx + R)), y0 = Math.max(0, (o.sy - R) | 0), y1 = Math.min(h - 1, Math.ceil(o.sy + R));
    const f = Math.max(0.35, shadeFor(F, o.ty)) * (F.outdoor ? F.light : 1), cr = tone[0] * f, cg = tone[1] * f, cb = tone[2] * f;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const dx = (xx - o.sx) / R, dy = (yy - o.sy) / R, q = dx * dx + dy * dy; if (q >= 1) continue;
      const al = (1 - q) * a * (0.75 + 0.25 * hash(xx * 73 + yy * 19));
      if (((((yy & 3) << 2) | (xx & 3)) * 0.0625 + 0.03) >= al) continue;
      const oi = yy * w + xx; if (db[oi] < o.ty - rad) continue;
      const p = fb[oi], m2 = 0.6;
      fb[oi] = (255 << 24) | (Math.min(255, ((p >> 16) & 255) * (1 - m2) + cb * m2) << 16) | (Math.min(255, ((p >> 8) & 255) * (1 - m2) + cg * m2) << 8) | Math.min(255, (p & 255) * (1 - m2) + cr * m2);
    }
  }
  function speck(F, x, y, z, size, col) {
    if (!proj(F, x, y, z, P2)) return;
    const w = F.w, h = F.h, fb = F.fb, db = F.dbuf, x0 = P2.sx | 0, y0 = P2.sy | 0, f = Math.max(0.4, shadeFor(F, P2.ty)) * (F.outdoor ? F.light : 1);
    const px = (255 << 24) | ((col[2] * f) << 16) | ((col[1] * f) << 8) | (col[0] * f | 0);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const xx = x0 + i, yy = y0 + j; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const o = yy * w + xx; if (db[o] < P2.ty - 0.08) continue;
      fb[o] = px;
    }
  }
  const DUST = [172, 162, 146], ROCK = [96, 90, 84], G_ACC = 10.2;
  function drawCave(F) {
    if (cave.phase === 'idle' && !puffs.length) return;
    const sc = Math.max(0, GFX.particles === undefined ? 1 : GFX.particles);
    if (sc <= 0) return;
    const calm = GFX.reduceMotion;
    if (cave.phase !== 'idle' && cave.map === F.map && cave.pl) {
      const cells = cave.pl.cells, ceil = cave.pl.ceil, t = cave.t, S = F.S;
      if (cave.phase === 'warn') {
        const ramp = Math.min(1, t / 0.8);
        for (let k = 0; k < cells.length; k++) {
          const cx = cells[k][0], cy = cells[k][1], gr = cells[k][2];
          if (calm) { dust(F, cx + 0.5, cy + 0.5, gr + 0.6, 0.9, 0.5 * ramp, DUST); continue; }
          const N = Math.round(6 * sc * ramp);
          for (let j = 0; j < N; j++) {
            const id = k * 64 + j, per = 0.8 + hash(id * 3 + 1) * 0.8, u = ((t / per) + hash(id * 3 + 2)) % 1;
            speck(F, cx + hash(id * 3 + 3), cy + hash(id * 3 + 4), ceil - u * (ceil - gr), S, DUST);
          }
          const M = Math.round(2 * sc);
          for (let j = 0; j < M; j++) {
            const id = k * 64 + 40 + j, t0 = 0.25 + hash(id * 5 + 1) * (WARN - 1.0), tau = t - t0; if (tau < 0) continue;
            const px = cx + 0.15 + hash(id * 5 + 2) * 0.7, py = cy + 0.15 + hash(id * 5 + 3) * 0.7, top = gr + RUBBLE_H * 0.4, z = ceil - 0.5 * G_ACC * tau * tau, land = Math.sqrt(2 * (ceil - top) / G_ACC);
            if (z > top) speck(F, px, py, z, 2 * S, ROCK);
            else dust(F, px, py, top + 0.1, 0.12 + Math.min(0.4, (tau - land) * 0.6), Math.max(0, 0.7 - (tau - land) * 0.9), DUST);
          }
        }
      } else {
        const p = Math.min(1, t / SETTLE);
        for (let k = 0; k < cells.length; k++) dust(F, cells[k][0] + 0.5, cells[k][1] + 0.5, cells[k][2] + 0.5 + p * 0.4, 0.55 + p * 0.55, (1 - p) * (calm ? 0.55 : 0.85), DUST);
      }
    }
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i]; if (p.map !== F.map) continue;
      const u = p.t / p.life; dust(F, p.x, p.y, p.z + u * 0.3, p.r * (0.5 + u * 0.8), (1 - u) * (calm ? 0.5 : 0.8), DUST);
    }
  }
  function tickPuffs(dt) { for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].t += dt; if (puffs[i].t >= puffs[i].life) puffs.splice(i, 1); } }
  function puff(map, x, y, z, r, life) { if (puffs.length < 24) puffs.push({ map, x, y, z, r: r || 0.7, life: life || 1.6, t: 0 }); }

  // ------------------------------------------------------------ wrapping the game
  const _update = update;
  update = function (dt) {
    let keys = null, tfx = 0, tfy = 0, touch = null;
    // input lock while a gate opens: neutral keys and sticks for this tick only
    if (pending && G.state === 'play') { keys = G.keys; touch = G.touch; tfx = touch.fx; tfy = touch.fy; G.keys = {}; touch.fx = 0; touch.fy = 0; }
    try { _update.apply(this, arguments); } finally { if (keys) { G.keys = keys; touch.fx = tfx; touch.fy = tfy; } }
    try {
      if (pending) {
        if (G.state === 'play' || G.state === 'event') {
          if (G.dead || G.map !== pending.map) { stats.cancelled++; cancelPending('map'); }
          else if (G.state === 'play') {
            pending.t += dt;
            const d = pending.map.doors[pending.ci];
            if (d && d.target < 1) d.target = 1;
            if (!d || d.open >= 0.98 || pending.t >= OPEN_TIMEOUT) finishPending();
          }
        }
      }
      if (G.state === 'play' && G.map) { tickCave(dt); tickPuffs(dt); }
    } catch (err) { console.warn('gates tick failed', err); }
  };
  const _loadMap = loadMap;
  loadMap = function (id, pos) {
    if (pending) { stats.cancelled++; cancelPending('load'); }
    if (cave.phase !== 'idle') resetCave();
    try { const m = G.maps && G.maps[id]; if (m) { ensureApplied(m); syncLook(m); } } catch (err) { console.warn('gates loadMap prep failed', err); }
    const r = _loadMap.apply(this, arguments);
    try {
      const m = G.map;
      if (m && m._gRec && m._gRec.length && planOf(m)) {
        // arriving (shaft return, travel, a save made inside the pile): never inside rubble
        recover(m, planOf(m));
      }
    } catch (err) { console.warn('gates loadMap recover failed', err); }
    return r;
  };
  const _build = buildAllMaps;
  buildAllMaps = function () {
    const maps = _build.apply(this, arguments);
    try { for (const spec of CAVEINS) { const m = maps[spec.map]; if (m) { registerArt(); m._gPlan = plan(m, spec); } } } catch (err) { console.warn('gates plan failed', err); }
    return maps;
  };
  if (typeof wallLabel === 'function') { const _wl = wallLabel; wallLabel = function (cell) { return cell && cell.rubble ? 'Fallen stone from the shaft-room roof. It does not look like it will move.' : _wl.apply(this, arguments); }; }
  // a resonant wall splitting open is a small collapse of its own: dust, nothing else changes
  if (typeof checkResonantWall === 'function') {
    const _crw = checkResonantWall;
    checkResonantWall = function (freq) {
      let w = null; try { if (GFX.collapses) w = Engine.pickWall(2.4); } catch (e) { w = null; }
      const r = _crw.apply(this, arguments);
      try { if (r && w && GFX.collapses) { puff(G.map, w.x + 0.5, w.y + 0.5, 0.5, 0.8, 1.8); puff(G.map, w.x + 0.5, w.y + 0.5, 0.3, 0.5, 1.2); } } catch (e) { /* cosmetic */ }
      return r;
    };
  }
  const _render = Engine.render;
  Engine.render = function () {
    try { if (G.map) syncLook(G.map); if (G.map && !GFX.collapses && G.map._gRec) revertPlan(G.map); } catch (err) { /* never break a frame */ }
    return _render.apply(this, arguments);
  };
  GFX.onChange(() => { try { if (G.maps) for (const id in G.maps) { syncLook(G.maps[id]); if (!GFX.collapses && G.maps[id]._gRec) revertPlan(G.maps[id]); } if (!GFX.gateAnims && pending) { stats.cancelled++; cancelPending('off'); } } catch (e) { /* cosmetic */ } });

  try {
    registerArt();
    Engine.addPostHook(F => { try { drawGates(F); drawCave(F); } catch (err) { if (!drawGates.warned) { drawGates.warned = true; console.warn('gates hook failed', err); } } }, -8);
    // maps that already exist (the module can load after a game is under way)
    if (typeof G !== 'undefined' && G.maps) for (const spec of CAVEINS) { const m = G.maps[spec.map]; if (m && !m._gPlan) m._gPlan = plan(m, spec); }
  } catch (err) { console.warn('gates install failed', err); }

  const api = {
    THRESH, HEAD_TOP, FLAG, WARN, SETTLE, RUBBLE_H, barBottom, clearsHead, gatesOf, gateAt, gateInfo, syncLook,
    plan, planOf, applyPlan, revertPlan, recover, safeSpot, flood, stepOk, targets, cellOpen, overlapsRubble, ensureApplied,
    cave, stats, moved, puff, puffs: () => puffs, hash, proj: (F, x, y, z) => { const o = { ty: 0, sx: 0, sy: 0 }; const ok = proj(F, x, y, z, o); return ok ? o : null; },
    drawGates, drawCave, tickCave, pending: () => pending, cancelPending, CAVEINS, hook: stat,
  };
  return api;
})();
if (typeof window !== 'undefined') window.GATES = GATES;
