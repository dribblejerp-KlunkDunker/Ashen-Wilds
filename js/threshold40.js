// ============================================================
//  threshold40 - Phase 40, walking from one map into the next.
//
//  O17 rules that a region is built, for now, as connected maps of at most 384 x 384, and the zone plan (atlas/10-zones.md,
//  O16, rule Z-R2) says where a way crosses a map's edge, the edge is put on a threshold the land already has. This phase
//  builds the first two maps of the highland edge (Z1) and the thresholds between them and the ledge:
//
//    * la_z1_2_0, "The ledge path": Z1's grid square from 768 to 1152 east and 0 to 384 south, holding the outside of
//      the ledge's crag (a great complex is its own map behind its gate, Z-R3), the ramp foot, and the ledge path down.
//    * la_z1_2_1, "The Greystair fork": the square south of it, where the ledge path meets the upper road, the last
//      climb, the Greystair road and Wilmot's path.
//
//  Every map edge is a band of rock. A way that crosses into a built map goes through a cut with a bend in it, so no
//  line of sight runs out of one map; a way that crosses into a map not built yet ends in a notch, and says so. The two
//  maps overlap by 20 cells at their seam and draw the overlap from one function of zone coordinates, so what you see
//  in the cut before you cross is what you walk into after. The ledge (la_ledge) gets one gap in the boulders at the
//  south end of its top: the way down. "Walk on" on the prologue's end card takes the company down it.
//
//  What crosses with you: Marget Sayle on your arm (js/carry15.js), the carter when he is following and near
//  (js/carter13.js), a co-op partner (the engine's own map sync), and the walking bloom when it is hunting you
//  (js/bloom4.js's doors, which a map may now have more than one of).
//
//  Only the ground and the ways are built here. The zone's places, its things and what hunts in it are Phase 41.
//  The switch (Options) "Ways between maps": off, the ledge's boulders stand whole and the end card's Walk on stays where
//  it is, exactly as before this phase. The two maps are built either way.
//
//  Plain ASCII. No random number and no clock: every shape comes from a fixed hash of position.
// ============================================================
'use strict';

const THRESH40 = (() => {
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require === 'function' ? require('./ledge1.js') : null);
  const TX = {
    path: 'The ledge path',
    fork: 'The Greystair fork',
    notBuilt: (way) => way + ' goes on from here. That country is not built yet.',
    gapLabel: 'The way down from the ledge',
    cleftLabel: 'The way up to the ledge',
    switchName: 'Ways between maps',
    switchWhat: 'A gap in the ledge\'s boulders, and Walk on, lead down to the highland edge. Off: the ledge stands closed, as before',
  };
  // ---------------------------------------------------------------- the zone and its maps
  const TILE = 384, BAND = 11, MARGIN = 20;
  const ZONE = { id: 'Z1', w: 1536, h: 1536 };
  const MAPS = {
    la_z1_2_0: { col: 2, row: 0, ox: 768, oy: 0, w: 384, h: 384 + MARGIN, name: TX.path },
    la_z1_2_1: { col: 2, row: 1, ox: 768, oy: 384 - MARGIN, w: 384, h: 384 + MARGIN, name: TX.fork },
  };
  const BUILT = { '2,0': 'la_z1_2_0', '2,1': 'la_z1_2_1' };
  const builtAt = (col, row) => BUILT[col + ',' + row] || null;
  // Z1's ways, copied from atlas/10-zones.md ("Ways"); test/threshold40.test.js reads the table and checks they match.
  const WAYS = [
    { name: 'The upper road', kind: 'road', pts: [[760, 1536], [760, 1450], [700, 1380], [830, 1290], [690, 1190], [810, 1090], [720, 960], [770, 830], [700, 700], [900, 520]] },
    { name: 'The last climb', kind: 'track', pts: [[900, 520], [760, 380], [650, 320], [570, 350], [470, 240], [380, 150], [260, 60]] },
    { name: 'The Greystair road', kind: 'road', pts: [[900, 520], [1100, 450], [1300, 380], [1500, 300]] },
    { name: 'The ledge path', kind: 'track', pts: [[900, 520], [960, 380], [1000, 250], [990, 150]] },
    { name: 'The slope path', kind: 'track', pts: [[700, 700], [560, 610], [410, 560], [330, 420], [300, 260], [160, 90]] },
    { name: 'The shieling path', kind: 'track', pts: [[410, 560], [380, 760]] },
    { name: 'The den path', kind: 'track', pts: [[810, 1090], [1050, 1000], [1200, 1060]] },
    { name: 'Wilmot\'s path', kind: 'track', pts: [[1100, 450], [1350, 560], [1320, 780]] },
    { name: 'To the Iron Stair', kind: 'track', pts: [[1500, 300], [1490, 100]] },
  ];
  // the ledge's gate in the zone (atlas/10-zones.md, Z1 place 1, "The ledge (la_ledge)", at 990, 140)
  const CRAG = { x: 990, y: 118, r: 23 };
  const CLEFT = { x: 990, y0: 133, y1: 142 };
  // where you come out, in zone coordinates and on the ledge
  const ARRIVE_Z1 = { x: 990.5, y: 145.5, dir: Math.PI / 2 };
  const GAP = { x0: 85, x1: 86, y: 58 };
  const ARRIVE_LEDGE = { x: 86.0, y: 56.9, dir: -Math.PI / 2 };

  // ---------------------------------------------------------------- shapes (pure, zone coordinates)
  function hash(x, y, s) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function vnoise(x, y, s) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(x0, y0, s), hash(x0 + 1, y0, s), u), lerp(hash(x0, y0 + 1, s), hash(x0 + 1, y0 + 1, s), u), v);
  }
  function fbm(x, y, s) { let t = 0, a = 0.5, k = 1; for (let o = 0; o < 4; o++) { t += vnoise(x * k, y * k, s + o * 17) * a; a *= 0.5; k *= 2; } return t; }
  // The upland under the scarp: falling gently south from the rim toward Coldbarrow, rolled by the ground's own swell.
  // Heights are game units (a cell is a metre; eye height 0.88).
  function H(zx, zy) {
    return 7.5 - zy / 100 + (fbm(zx / 45, zy / 45, 21) - 0.5) * 4 + (vnoise(zx / 9, zy / 9, 22) - 0.5) * 0.9;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  function lineDist(px, py, pts) { let d = 1e9; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
  // The tile edges: every multiple of TILE, east-west and north-south, the zone's own bounds included.
  // distance from (zx, zy) to the nearest tile edge line, and which
  function edgeOf(zx, zy) {
    const ex = Math.round(zx / TILE) * TILE, ey = Math.round(zy / TILE) * TILE;
    const dx = Math.abs(zx - ex), dy = Math.abs(zy - ey);
    return dx < dy ? { axis: 'x', at: ex, d: dx } : { axis: 'y', at: ey, d: dy };
  }
  // where a way crosses tile edges: [{ way, axis, at, x, y, from: [col,row], to: [col,row] }]
  function crossings() {
    const out = [];
    for (const w of WAYS) {
      for (let i = 0; i + 1 < w.pts.length; i++) {
        const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
        for (const axis of ['x', 'y']) {
          const a = axis === 'x' ? ax : ay, b = axis === 'x' ? bx : by;
          for (let k = Math.ceil(Math.min(a, b) / TILE); k * TILE <= Math.max(a, b); k++) {
            const at = k * TILE; if (a === b) continue;
            const t = (at - a) / (b - a); if (t <= 0 || t >= 1) continue;
            const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            if (at <= 0 || (axis === 'x' ? at >= ZONE.w : at >= ZONE.h)) continue;
            const c0 = axis === 'x' ? [k - 1, Math.floor(y / TILE)] : [Math.floor(x / TILE), k - 1];
            const c1 = axis === 'x' ? [k, Math.floor(y / TILE)] : [Math.floor(x / TILE), k];
            out.push({ way: w, axis, at, x, y, a: c0, b: c1, seg: i });
          }
        }
      }
    }
    return out;
  }
  // a point on a way where it is `s` off an edge line, along the normal
  function wayAt(w, axis, s) {
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
      const a = axis === 'x' ? ax : ay, b = axis === 'x' ? bx : by;
      if ((s - a) * (s - b) <= 0 && a !== b) { const t = (s - a) / (b - a); return [ax + (bx - ax) * t, ay + (by - ay) * t]; }
    }
    return null;
  }
  // A cut through a band where a way passes between two built maps: from the way BAND+4 short of the edge, a bend one
  // way 5 short of it, across the edge on a slant, a bend back 5 past it, and onto the way BAND+4 past it. The bends sit
  // well inside the band, so a look along any straight run ends in rock: no line of sight runs from one map out of it.
  function cutOf(c) {
    const n = c.axis === 'x' ? [1, 0] : [0, 1], e = c.axis === 'x' ? [0, 1] : [1, 0];
    const s0 = c.at - (BAND + 4), s1 = c.at + (BAND + 4);
    const w0 = wayAt(c.way, c.axis, s0), w1 = wayAt(c.way, c.axis, s1);
    if (!w0 || !w1) return null;
    // the way's own drift across the band, and a bend against it either side
    const drift = (w1[0] - w0[0]) * e[0] + (w1[1] - w0[1]) * e[1], k = drift > 0 ? -6 : 6;
    const X = [c.x, c.y];
    const B = [X[0] - n[0] * 5 + e[0] * k, X[1] - n[1] * 5 + e[1] * k];
    const C = [X[0] + n[0] * 5 - e[0] * k, X[1] + n[1] * 5 - e[1] * k];
    return { pts: [w0, B, C, w1], crossing: c };
  }
  let CACHE = null;
  function plan() {
    if (CACHE) return CACHE;
    const cuts = [], notches = [];
    for (const c of crossings()) {
      const A = builtAt(c.a[0], c.a[1]), B = builtAt(c.b[0], c.b[1]);
      if (A && B) { const k = cutOf(c); if (k) cuts.push(Object.assign(k, { from: A, to: B })); }
      else if (A || B) notches.push({ crossing: c, inside: A || B, outside: A ? c.b : c.a });
    }
    CACHE = { cuts, notches };
    return CACHE;
  }
  // a notch: the way runs into the band from the built side and stops 3 cells short of the edge
  function inNotch(n, zx, zy) {
    const c = n.crossing, s = c.axis === 'x' ? zx : zy;
    // how far in from the edge, on the built side (the built tile is on the lower side of the edge when it is tile a)
    const side = (n.inside === builtAt(c.a[0], c.a[1])) ? -1 : 1;
    const depth = (s - c.at) * side;
    return depth >= 3 && depth <= BAND + 1 && lineDist(zx, zy, c.way.pts) < 1.45;
  }
  function inCut(k, zx, zy) { return lineDist(zx, zy, k.pts) < 1.4; }
  // what stands at a cell of the zone: 'band' rock, 'crag' rock, or nothing; and whether a way runs there
  function cellAt(zx, zy) {
    const cx = zx + 0.5, cy = zy + 0.5, P = plan();
    const e = edgeOf(cx, cy);
    let solid = null;
    const dc = Math.hypot((cx - CRAG.x) / 1.15, cy - CRAG.y);
    const rr = CRAG.r + (vnoise(Math.atan2(cy - CRAG.y, cx - CRAG.x) * 3 + 10, 0.5, 31) - 0.5) * 9;
    if (dc < rr) solid = 'crag';
    if (e.d < BAND) solid = 'band';
    let way = null;
    for (const w of WAYS) if (lineDist(cx, cy, w.pts) < (w.kind === 'road' ? 1.5 : 1.0)) { way = w; break; }
    if (solid === 'band') {
      way = null;
      for (const k of P.cuts) if (inCut(k, cx, cy)) { solid = null; way = k.crossing.way; break; }
      if (solid) for (const n of P.notches) if (inNotch(n, cx, cy)) { solid = null; way = n.crossing.way; break; }
    }
    // the cleft up into the crag, where the ledge path ends, and the path's last steps up to it from 990, 150
    if (solid === 'crag' && Math.abs(cx - CLEFT.x) < 1.25 && cy >= CLEFT.y0 && cy <= CLEFT.y1 + 6) { solid = null; way = WAYS[3]; }
    if (!solid && !way && Math.abs(cx - CLEFT.x) < 1.0 && cy > CLEFT.y1 && cy <= 150) way = WAYS[3];
    return { solid, way };
  }

  // ---------------------------------------------------------------- building a map
  function build(id) {
    const D = MAPS[id];
    const FL = L1.FL;
    const m = new GameMap(id, D.name, D.w, D.h, {
      outdoor: true, floor: 't_la_frost', floorTextures: ['t_la_scorch', 't_la_rock', 't_la_rock', 't_la_frost', 't_la_ember', 't_la_bloom', 't_la_slag', 't_la_frost2'],
      fogDist: 120, fogColor: [46, 20, 16], ambient: 0.16, music: 'wild', danger: 0,
      spawn: id === 'la_z1_2_0' ? { x: ARRIVE_Z1.x - D.ox, y: ARRIVE_Z1.y - D.oy, dir: ARRIVE_Z1.dir } : { x: 900.5 - D.ox, y: 515.5 - D.oy, dir: Math.PI / 2 },
    });
    m._la = true; m._z40 = D;
    const V = m.ensureVerts(), W1 = D.w + 1;
    for (let vy = 0; vy <= D.h; vy++) for (let vx = 0; vx <= D.w; vx++) V[vy * W1 + vx] = H(vx + D.ox, vy + D.oy);
    m.smooth.fill(1); m.syncSlopes(0, 0, D.w - 1, D.h - 1);
    const grade = (x, y) => { const a = V[y * W1 + x], b = V[y * W1 + x + 1], c = V[(y + 1) * W1 + x], d = V[(y + 1) * W1 + x + 1]; return Math.max(a, b, c, d) - Math.min(a, b, c, d); };
    for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) {
      const zx = x + D.ox, zy = y + D.oy, c = cellAt(zx, zy), g = m.groundAt(x + 0.5, y + 0.5);
      let f = hash(zx, zy, 41) > 0.5 ? FL.FROST2 : FL.FROST;
      if (fbm(zx / 30, zy / 30, 43) < 0.36) f = FL.SCORCH;
      if (grade(x, y) > 1.2) f = FL.ROCK;
      if (c.way) f = FL.ROCK;
      m.setFloor(x, y, f);
      if (c.solid === 'band') m.block(x, y, 't_la_rock', g + 3.4 + hash(zx, zy, 44) * 1.4, { capTex: 't_la_frost' });
      else if (c.solid === 'crag') m.block(x, y, 't_la_rock', g + 9.5 + hash(zx >> 1, zy >> 1, 45) * 2.5, { capTex: 't_la_frost' });
    }
    m.border('t_la_rock');
    // the people who can come with you: hidden until they do (js/carter13.js, js/carry15.js)
    const sp = m.spawn;
    try { if (typeof NPCS !== 'undefined' && NPCS.la_carter) m.npc('la_carter', sp.x, sp.y - 1.2, { name: 'The carter', wander: false, hidden: true }); } catch (e) { /* no carter here */ }
    try { if (typeof NPCS !== 'undefined' && NPCS.la_marget) m.npc('la_marget', sp.x, sp.y - 0.8, { name: L1.TX.marget, wander: false, requires: 'la_marget_out', hidden: true }); } catch (e) { /* no Marget here */ }
    m.baseCount = m.entities.length;
    return m;
  }

  // ---------------------------------------------------------------- thresholds
  // { id, from, to, kind, test(lx, ly) on the from map, arrive(lx, ly) -> { x, y } on the to map, dir, door (where the
  // bloom stands to use it), home (it leads toward the ledge) }
  const toLocal = (id, zx, zy) => ({ x: zx - MAPS[id].ox, y: zy - MAPS[id].oy });
  function thresholds() {
    const T = [];
    const z = 'la_z1_2_0', a1 = toLocal(z, ARRIVE_Z1.x, ARRIVE_Z1.y), cl = toLocal(z, CLEFT.x + 0.5, CLEFT.y0 + 2.2);
    T.push({ id: 'ledge-down', from: L1.LEDGE, to: z, kind: 'gate', test: (x, y) => x >= GAP.x0 && x < GAP.x1 + 1 && y > GAP.y + 0.5 && gapOn(),
      arrive: () => ({ x: a1.x, y: a1.y }), dir: ARRIVE_Z1.dir, door: { x: GAP.x0 + 1, y: GAP.y + 0.4 }, out: { x: a1.x, y: a1.y - 0.5, yaw: ARRIVE_Z1.dir }, home: false });
    T.push({ id: 'ledge-up', from: z, to: L1.LEDGE, kind: 'gate', test: (x, y) => Math.abs(x - cl.x) < 1.3 && y < cl.y && y > cl.y - 6,
      arrive: () => ({ x: ARRIVE_LEDGE.x, y: ARRIVE_LEDGE.y }), dir: ARRIVE_LEDGE.dir, door: { x: cl.x, y: cl.y + 0.3 }, out: { x: ARRIVE_LEDGE.x, y: ARRIVE_LEDGE.y + 0.4, yaw: ARRIVE_LEDGE.dir }, home: true });
    for (const k of plan().cuts) {
      const c = k.crossing, A = k.from, B = k.to;
      // the edge line; crossing it by 0.3 takes you over (0.6 apart each way, so a step back does not bounce you)
      const s = (id, lx, ly) => (c.axis === 'x' ? lx + MAPS[id].ox : ly + MAPS[id].oy) - c.at;
      const near = (id, lx, ly) => inCut(k, lx + MAPS[id].ox + 0.0, ly + MAPS[id].oy + 0.0) || lineDist(lx + MAPS[id].ox, ly + MAPS[id].oy, k.pts) < 2;
      const pt = (id, off) => { const p = c.axis === 'x' ? [c.at + off, c.y] : [c.x, c.at + off]; const q = nearestOn(k.pts, p); return toLocal(id, q[0], q[1]); };
      T.push({ id: 'seam-' + A + '-' + B, from: A, to: B, kind: 'seam', test: (x, y) => s(A, x, y) > 0.3 && near(A, x, y),
        arrive: (x, y) => toLocal(B, x + MAPS[A].ox, y + MAPS[A].oy), door: pt(A, -0.6), out: pt(B, 0.8), home: false, way: c.way.name });
      T.push({ id: 'seam-' + B + '-' + A, from: B, to: A, kind: 'seam', test: (x, y) => s(B, x, y) < -0.3 && near(B, x, y),
        arrive: (x, y) => toLocal(A, x + MAPS[B].ox, y + MAPS[B].oy), door: pt(B, 0.6), out: pt(A, -0.8), home: true, way: c.way.name });
    }
    return T;
  }
  function nearestOn(pts, p) {
    let best = null, bd = 1e9;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? clamp(((p[0] - ax) * dx + (p[1] - ay) * dy) / l2, 0, 1) : 0, q = [ax + dx * t, ay + dy * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  const ST = { crossed: 0, last: null, err: null, said: {}, gap: null, walkOn: 0 };
  const sw = () => typeof GFX === 'undefined' || GFX.laThresholds !== false;
  let gapState = null;
  const gapOn = () => gapState === true;
  let TH = [];
  // the ledge's gap: two of the south boulders taken out, and the cliff below them made to hold
  function setGap(on) {
    const m = typeof G !== 'undefined' && G && G.maps ? G.maps[L1.LEDGE] : null; if (!m) return;
    if (!ST.gap || ST.gap.m !== m) {
      const keep = [];
      for (let x = GAP.x0; x <= GAP.x1; x++) keep.push({ x, cell: m.get(x, GAP.y), floor: m.floorCells ? m.floorCells[(GAP.y + 1) * m.w + x] : 0 });
      ST.gap = { m, keep };
    }
    for (const k of ST.gap.keep) {
      if (on) { m.set(k.x, GAP.y, null); m.setFloor(k.x, GAP.y + 1, L1.FL.DROP); }
      else { m.set(k.x, GAP.y, k.cell); m.setFloor(k.x, GAP.y + 1, k.floor); }
    }
    gapState = !!on;
    if (typeof R3D !== 'undefined' && R3D.invalidate) R3D.invalidate();
  }
  function hideMarget() {
    if (typeof G === 'undefined' || !G || !G.flags || !G.maps) return;
    const where = G.flags.la_marget_map && G.maps[G.flags.la_marget_map] ? G.flags.la_marget_map : L1.LEDGE;
    for (const id of [L1.LEDGE].concat(Object.keys(MAPS))) {
      const m = G.maps[id]; if (!m) continue;
      const e = m.entities.find((q) => q.id === 'la_marget'); if (!e) continue;
      e.hidden = !(G.flags.la_marget_out && where === id);
    }
  }
  function cross(t) {
    const from = G.mapId, c = Engine.cam, was = { x: c.x, y: c.y };
    const at = t.arrive(c.x, c.y);
    const dir = t.dir == null ? c.dir : t.dir;
    const carrying = typeof CARRY15 !== 'undefined' && CARRY15.state && CARRY15.state() && CARRY15.state().on;
    ST.crossed++; ST.last = t.id;
    transfer({ map: t.to, x: at.x, y: at.y, dir });
    if (G.mapId !== t.to) return false;
    if (t.kind === 'seam') { G.fadeT = 0; }
    if (carrying) { G.flags.la_marget_map = t.to; if (CARRY15.save) CARRY15.save(); }
    hideMarget();
    try {
      if (typeof CARTER13 !== 'undefined' && CARTER13.cross) {
        const back = { x: at.x - Math.cos(dir) * 1.3, y: at.y - Math.sin(dir) * 1.3 };
        const p = G.map.isBlocked(Math.floor(back.x), Math.floor(back.y)) ? { x: at.x, y: at.y } : back;
        CARTER13.cross(from, t.to, p, was);
      }
    } catch (e) { ST.err = ST.err || String(e && e.message); }
    return true;
  }
  function walkOn() {
    if (!sw() || typeof G === 'undefined' || !G || G.mapId !== L1.LEDGE) return false;
    const t = TH.find((q) => q.id === 'ledge-down'); if (!t) return false;
    ST.walkOn++;
    return cross(t);
  }
  function tick() {
    if (typeof G === 'undefined' || !G || G.state !== 'play' || !G.map || !G.maps) return;
    if (G.mapId === L1.LEDGE && gapState !== sw()) setGap(sw());
    const c = Engine.cam;
    for (const t of TH) if (t.from === G.mapId && t.test(c.x, c.y)) { cross(t); return; }
    // a way into country not built yet
    const D = MAPS[G.mapId]; if (!D) return;
    const zx = c.x + D.ox, zy = c.y + D.oy;
    for (const n of plan().notches) {
      if (n.inside !== G.mapId) continue;
      const c0 = n.crossing, s = (c0.axis === 'x' ? zx : zy) - c0.at;
      if (Math.abs(s) < BAND + 1 && lineDist(zx, zy, c0.way.pts) < 2) {
        const key = c0.way.name + c0.at;
        if (!ST.said[key] || G.time - ST.said[key] > 20) { ST.said[key] = G.time; msg(TX.notBuilt(c0.way.name), '', 4500); }
      }
    }
  }
  function wire() {
    if (typeof window === 'undefined' || typeof G === 'undefined' || typeof GameMap === 'undefined' || !L1) return false;
    const _bm = buildAllMaps;
    buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try {
        for (const id in MAPS) {
          const m = build(id); maps[id] = m;
          if (typeof BLOOM4 !== 'undefined' && BLOOM4.addMap) BLOOM4.addMap(m);
        }
        ST.gap = null; gapState = null;
      } catch (e) { ST.err = ST.err || String(e && e.message); }
      return maps;
    };
    TH = thresholds();
    // the walking bloom's ways through: it follows you through the one you took, and goes home toward the ledge
    if (typeof BLOOM4 !== 'undefined' && BLOOM4.DOORS) {
      for (const t of TH) BLOOM4.DOORS.push({ from: t.from, at: t.door, to: t.to, out: t.out, barred: () => !sw(), waitAt: t.door, pause: 0, home: t.home, z40: t.id });
    }
    const _up = update;
    update = function () { const r = _up.apply(this, arguments); try { tick(); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    const _lm = loadMap;
    loadMap = function (id) {
      const r = _lm.apply(this, arguments);
      try { if (id === L1.LEDGE) setGap(sw()); hideMarget(); } catch (e) { ST.err = ST.err || String(e && e.message); }
      return r;
    };
    if (typeof document !== 'undefined') {
      // the end card's Walk on (js/prologue39.js) closes the card; then, with this switch on, the company goes down
      document.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('#la-walk-on') : null;
        if (b) setTimeout(() => { try { walkOn(); } catch (e) { ST.err = ST.err || String(e && e.message); } }, 0);
      }, true);
    }
    L1.SWITCHES.push(['laThresholds', TX.switchName, TX.switchWhat]);
    return true;
  }
  const wired = wire();
  return { TX, TILE, BAND, MARGIN, ZONE, MAPS, WAYS, CRAG, CLEFT, GAP, ARRIVE_Z1, ARRIVE_LEDGE, H, edgeOf, crossings, plan, cellAt, inCut, lineDist, build, thresholds: () => TH.length ? TH : thresholds(), cross, walkOn, setGap, state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = THRESH40;
