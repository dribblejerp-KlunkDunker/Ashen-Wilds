// ============================================================
//  building8 - Phase 8, "every region builds differently": the highland edge's way of building, honoured by the roof
//  planner. Approved as P16: "field stone laid dry, under turf and heather; one low room, one door, no window on the
//  weather side" (EAVES78.STYLES.la_ledge). Until now the bothy's roof came from the Octave's timber-house planner: a
//  gabled thatch roof, a window and shutters on every side and an attic window in each gable.
//
//  WHAT THE BIBLE SAYS (searched before anything was invented): P16 above; the bothy's door line, "A bothy of field stone
//  under the ledge. Smoke at the hole in the roof. Somebody keeps a fire here." (js/ledge1.js, approved); "The ash comes
//  on the wind, mostly from the north" (the-smothering.md), so the north wall is the weather side; "Thatch rots under a
//  crust of wet ash in a season; slate and stone hold".
//
//  WHAT IT DOES (Options > "Highland building", GFX.laBuild)
//    * THE ROOF. Turf and heather, hipped all round so it sheds the wind, its eaves cut short on the wall heads, and low:
//      the ridge no higher than 2.1. A turf tile painted in code: peat-dark sod, heather in clumps, dead grass, a crust
//      of grey ash in the hollows, frost.
//    * THE HOLE IN THE ROOF. No chimney: a rim of turf on the ridge round a black hole, and the fire's smoke out of it,
//      leaning away from the north wind (the engine's own smoke, js/firesmoke.js, through its spawn()).
//    * ONE WINDOW, ON THE LEE SIDE. Nothing in the north wall, no attic windows, no shutters, no stone footing. One small
//      window in the south wall beside the door, lit by the fire after dusk; inside, the same window in the same wall.
//    * THE STONE. The walls, outside and in, are laid in the owner's own highland drystone (tools/look/highland-materials.js,
//      "irregular fieldstone masses rather than full-width courses"), painted here pixel for pixel as the look test paints
//      it; the test checks every pixel against it.
//  Off, everything is as before this phase: the timber planner's roof, Phase 1's coursed drystone, no hole, no smoke.
//  Nothing here uses a random number; the smoke's jitter is a fixed hash of a counter.
// ============================================================
'use strict';

const BUILD8 = (() => {
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);

  // ---------------------------------------------------------------- the numbers ([PROPOSED] unless the bible gave them; see ROADMAP.md)
  const B = {
    weather: [0, -1],            // the weather side faces north: "The ash comes on the wind, mostly from the north"
    over: 0.08,                  // the turf stops just past the wall head
    maxRidge: 2.1,               // low: no ridge more than 2.1 above the ground it stands on (the timber planner allowed 2.2)
    window: { hw: 0.12, below: 0.62, above: 0.36 },   // one small window, set low in the wall
    hole: { r: 0.17, rim: 0.07 },                      // the smoke hole's rim of turf, on the ridge
    smoke: { perS: 1.1, rise: [0.32, 0.5], drift: 0.14, life: [5.2, 6.8], range: 22 },
  };
  const ID = 'la_ledge', BASE = 'la_ledge_timber';      // the timber planner is run under BASE, then turned into this
  const STONE = 't_house_la_drystone', WIN = 't_house_la_drystone_win';

  // ---------------------------------------------------------------- the owner's highland drystone, pixel for pixel
  // (tools/look/highland-materials.js, "drystone": sixteen irregular stones on a torus, dithered in six steps of cold stone)
  const N = 64, mod = (x, p) => ((x % p) + p) % p, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function hash(x, y, seed) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function noise(x, y, cells, seed) {
    x = mod(x, N) * cells / N; y = mod(y, N) * cells / N;
    const ix = Math.floor(x), iy = Math.floor(y); let u = x - ix, v = y - iy; u *= u * (3 - 2 * u); v *= v * (3 - 2 * v);
    const h = (a, b) => hash(mod(a, cells), mod(b, cells), seed);
    return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function color(p, t, x, y) { const k = clamp(Math.round(t * (p.length - 1) + (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.5) * 0.35), 0, p.length - 1), c = p[k]; return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  const P_STONE = [[11, 12, 13], [22, 24, 26], [34, 37, 40], [47, 51, 54], [61, 65, 67], [76, 79, 79]];
  function stoneAt(x, y) {
    x = mod(Math.floor(x), N); y = mod(Math.floor(y), N);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const cx = (gx + 0.22 + hash(gx, gy, 41) * 0.56) * 16, cy = (gy + 0.24 + hash(gx, gy, 42) * 0.52) * 16;
      const ax = Math.abs(x - cx), ay = Math.abs(y - cy), d = Math.hypot(Math.min(ax, N - ax) * 0.86, Math.min(ay, N - ay) * 1.13);
      if (d < d1) { d2 = d1; d1 = d; id = gx + 4 * gy; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1, grit = (noise(x, y, 16, 75) - 0.5) * 0.12, shoulder = clamp(edge / 3.5, 0, 1), blend = shoulder * shoulder * (3 - 2 * shoulder), body = 0.36 + hash(id, 0, 71) * 0.24 + grit;
    return color(P_STONE, 0.08 + (body - 0.08) * blend, x, y);
  }
  const paint = (f) => { const a = new Uint32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[y * N + x] = f(x, y); return a; };
  const paintStone = () => paint(stoneAt);

  // ---------------------------------------------------------------- the turf roof, painted in code
  const P_SOD = [[9, 8, 6], [16, 14, 10], [24, 21, 14], [33, 29, 19], [43, 38, 25]],
    P_HEATH = [[20, 12, 16], [31, 18, 25], [44, 27, 34], [58, 38, 44]],
    P_GRASS = [[52, 46, 30], [68, 60, 39], [84, 75, 50]],
    P_ASH = [[42, 42, 44], [57, 57, 59], [74, 74, 76]],
    P_FROST = [[66, 77, 87], [89, 102, 113], [115, 130, 141]];
  function turfAt(x, y) {
    x = mod(x, N); y = mod(y, N);
    const wx = (noise(x, y, 2, 801) - 0.5) * 12, wy = (noise(x, y, 2, 802) - 0.5) * 12;
    const lump = noise(x + wx, y + wy, 4, 803), fine = noise(x, y, 16, 804), heath = noise(x + wx * 0.5, y + wy * 0.5, 8, 805), crust = noise(x - wx, y - wy, 4, 806);
    // a crust of wet ash in the hollows, frost on the crust's edge
    if (crust > 0.68 && lump < 0.5) return crust > 0.74 && hash(x, y, 807) > 0.55 ? color(P_FROST, 0.3 + (crust - 0.74) * 4, x, y) : color(P_ASH, 0.25 + (crust - 0.68) * 5 + (fine - 0.5) * 0.3, x, y);
    // heather in clumps: dark purple-brown, tufted
    if (heath > 0.6 && hash(x, y >> 1, 808) > 0.25) return color(P_HEATH, (heath - 0.6) * 2.4 + (fine - 0.5) * 0.5 + (lump - 0.5) * 0.4, x, y);
    // dead grass: short pale strokes down the slope
    if (hash(x, Math.floor((y + hash(x, 0, 809) * 64) / 3), 810) > 0.93) return color(P_GRASS, 0.2 + fine * 0.6, x, y);
    return color(P_SOD, 0.22 + lump * 0.5 + (fine - 0.5) * 0.25, x, y);
  }
  const paintTurf = () => paint(turfAt);

  // ---------------------------------------------------------------- the window, seen from inside: a deep small opening in the stone
  const P_NIGHT = [[5, 6, 10], [9, 11, 17], [15, 17, 24]];
  function paintWindow() {
    const W0 = 25, W1 = 38, H0 = 18, H1 = 31;                                     // the opening, 14 pixels square
    return paint((x, y) => {
      if (x >= W0 && x <= W1 && y >= H0 && y <= H1) {                              // the night outside, and an ash fleck or two
        if (hash(x, y, 820) > 0.94) return color(P_ASH, 0.4, x, y);
        return color(P_NIGHT, 0.3 + (y - H0) / (H1 - H0) * 0.4, x, y);
      }
      const reveal = Math.min(Math.abs(x - (W0 - 0.5)), Math.abs(x - (W1 + 0.5)), Math.abs(y - (H0 - 0.5)), Math.abs(y - (H1 + 0.5)));
      if (x >= W0 - 3 && x <= W1 + 3 && y >= H0 - 3 && y <= H1 + 3 && reveal < 3) return color(P_STONE, 0.18 + reveal * 0.07, x, y);   // the splay: the wall is thick
      if (y >= H0 - 7 && y <= H0 - 4 && x >= W0 - 6 && x <= W1 + 6) return color(P_STONE, y === H0 - 4 ? 0.1 : 0.58 + (noise(x, y, 16, 821) - 0.5) * 0.2, x, y);   // the lintel: one long stone
      if (y >= H1 + 4 && y <= H1 + 5 && x >= W0 - 4 && x <= W1 + 4) return color(P_STONE, 0.5, x, y);                                           // the sill
      return stoneAt(x, y);
    });
  }

  // ---------------------------------------------------------------- the planner (EAVES78.STYLES.la_ledge.plan)
  const sw = () => typeof GFX === 'undefined' || GFX.laBuild !== false;
  // take the timber planner's buildings and build them the highland way
  function highland(p, m) {
    for (const b of p.houses) {
      if (b.stone || b.harbour || b.grove) continue;
      const half = b.half, top = b.top;
      Object.assign(b, { type: 'hip', over: B.over, verge: B.over, roofTex: 'la_turf', ridgeTex: 'la_turf', plinth: [], dormers: [], highland: true });
      // low: as steep as the ridge allows, never above maxRidge
      b.pitch = Math.min(b.pitch, (top - 1 + B.maxRidge - b.zBase) / Math.max(0.5, half));   // top - 1: the ground the walls stand on
      b.ridge = b.zBase + half * b.pitch;
      // no window in the weather wall, none in the roof, no shutters: one small one in the lee wall, beside the door
      b.windows = [];
      const lee = [-B.weather[0], -B.weather[1]], door = b.doors.find((d) => d.nx === lee[0] && d.ny === lee[1]) || b.doors[0];
      const cand = [];
      for (let x = b.x0 + 1; x < b.x1; x++) for (const y of lee[1] > 0 ? [b.y1] : lee[1] < 0 ? [b.y0] : []) cand.push([x, y]);
      for (let y = b.y0 + 1; y < b.y1; y++) for (const x of lee[0] > 0 ? [b.x1] : lee[0] < 0 ? [b.x0] : []) cand.push([x, y]);
      const ok = cand.filter(([x, y]) => { const c = m.cells[y * m.w + x]; return c && !c.door; }).sort((a, q) => (door ? Math.hypot(a[0] - door.x, a[1] - door.y) - Math.hypot(q[0] - door.x, q[1] - door.y) : 0));
      if (ok.length) { const [x, y] = ok[0]; b.windows.push({ cx: x + 0.5 + lee[0] * 0.5, cy: y + 0.5 + lee[1] * 0.5, nx: lee[0], ny: lee[1], z0: top - B.window.below, z1: top - B.window.above, hw: B.window.hw, style: 'attic', lit: true }); b.window = { x, y }; }
      // the hole in the roof: on the ridge, at its middle
      const mid = (b.A0 + b.A1) / 2;
      b.hole = b.axis === 'x' ? { x: mid, y: b.C } : { x: b.C, y: mid };
      b.hole.z = EAVES78.roofZ(b, b.hole.x, b.hole.y);
    }
    return p;
  }
  function planHighland(m) {
    const v = Object.create(m); v.id = BASE;                                        // the timber planner, with Phase 1's style row
    const p = EAVES78.plan(v);
    return sw() ? highland(p, m) : p;
  }
  // the plan is cached against the map's cells array: a new array (same cells) makes the planner look again
  function replan(m) { if (m && m.cells) m.cells = m.cells.slice(); }

  // ---------------------------------------------------------------- the hole, in the mesh
  function mesh(m, h) {
    if (!m || m.id !== ID || !sw() || typeof EAVES78 === 'undefined' || !EAVES78.on()) return 0;
    const Bb = h.B, MAT = h.MAT, Lt = h.tex(Engine.textures.la_turf ? 'la_turf' : 't_stone'), Ld = h.tex(Engine.textures.e78_dark ? 'e78_dark' : 't_stone'); let tris = 0;
    const quad = (p, uv, L, side, n) => { const v = p.map((q, i) => Bb.vert(q[0], q[1], q[2], uv[i][0], uv[i][1], L, -1, MAT.wall, side, n[0], n[1], n[2])); Bb.quad(v[0], v[1], v[2], v[3]); tris += 2; };
    for (const b of EAVES78.planOf(m).houses) {
      if (!b.hole || b.hole.z == null) continue;
      const { x, y } = b.hole, r = B.hole.r, z0 = b.ridge - 0.12, z1 = b.ridge + B.hole.rim, x0 = x - r, x1 = x + r, y0 = y - r, y1 = y + r;
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[0, 0.2], [0.34, 0.2], [0.34, 0], [0, 0]], Lt, 0.8, [0, -1, 0]);
      quad([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [[0, 0.2], [0.34, 0.2], [0.34, 0], [0, 0]], Lt, 0.8, [0, 1, 0]);
      quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [[0, 0.2], [0.34, 0.2], [0.34, 0], [0, 0]], Lt, 1, [-1, 0, 0]);
      quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[0, 0.2], [0.34, 0.2], [0.34, 0], [0, 0]], Lt, 1, [1, 0, 0]);
      const i = 0.06;                                                               // the rim's top, then the black of the hole
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y0 + i, z1], [x0, y0 + i, z1]], [[0, 0], [0.34, 0], [0.34, 0.06], [0, 0.06]], Lt, 1.1, [0, 0, 1]);
      quad([[x0, y1 - i, z1], [x1, y1 - i, z1], [x1, y1, z1], [x0, y1, z1]], [[0, 0], [0.34, 0], [0.34, 0.06], [0, 0.06]], Lt, 1.1, [0, 0, 1]);
      quad([[x0, y0 + i, z1], [x0 + i, y0 + i, z1], [x0 + i, y1 - i, z1], [x0, y1 - i, z1]], [[0, 0], [0.06, 0], [0.06, 0.2], [0, 0.2]], Lt, 1.1, [0, 0, 1]);
      quad([[x1 - i, y0 + i, z1], [x1, y0 + i, z1], [x1, y1 - i, z1], [x1 - i, y1 - i, z1]], [[0, 0], [0.06, 0], [0.06, 0.2], [0, 0.2]], Lt, 1.1, [0, 0, 1]);
      quad([[x0 + i, y0 + i, z1 - 0.004], [x1 - i, y0 + i, z1 - 0.004], [x1 - i, y1 - i, z1 - 0.004], [x0 + i, y1 - i, z1 - 0.004]], [[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2]], Ld, 0.25, [0, 0, 1]);
    }
    return tris;
  }

  // ---------------------------------------------------------------- the smoke, out of the hole
  const ST = { n: 0, acc: 0, err: null, puffs: 0, wasOn: null, stone: null, old: null };
  function smoke(dt) {
    if (!sw() || typeof FIRESMOKE === 'undefined' || !FIRESMOKE.spawn || typeof GFX === 'undefined' || !GFX.smoke) return;
    const m = G.map; if (!m || m.id !== ID || (typeof EAVES78 !== 'undefined' && !EAVES78.on())) return;
    const S = B.smoke, c = Engine.cam;
    for (const b of EAVES78.planOf(m).houses) {
      if (!b.hole || b.hole.z == null || Math.hypot(b.hole.x - c.x, b.hole.y - c.y) > S.range) continue;
      ST.acc += dt * S.perS;
      while (ST.acc >= 1) {
        ST.acc -= 1; const k = ST.n++, j = (s) => hash(k, s, 830) - 0.5;
        const rise = S.rise[0] + (S.rise[1] - S.rise[0]) * (j(1) + 0.5), life = S.life[0] + (S.life[1] - S.life[0]) * (j(2) + 0.5), z = b.ridge + B.hole.rim;
        if (FIRESMOKE.spawn(0, b.hole.x + j(3) * 0.12, b.hole.y + j(4) * 0.12, z, j(5) * 0.04, -B.weather[1] * S.drift + j(6) * 0.04, rise, life, 0.08, 0.5 + (j(7) + 0.5) * 0.25, 0.55, 0, z + 3.2)) ST.puffs++;
      }
    }
  }

  // ---------------------------------------------------------------- the switch: stone, window, roof, all together
  function apply(given) {
    const on = sw(), maps = given || (typeof G !== 'undefined' && G && G.maps);
    if (ST.stone) { Engine.textures[STONE] = on ? ST.stone : ST.old; if (typeof R3D !== 'undefined' && R3D.textureDirty) R3D.textureDirty(STONE); }
    if (maps) {
      const bothy = maps[L1.BOTHY]; if (bothy) { const c = bothy.cells[5 * bothy.w + 4]; if (c && !c.door) c.tex = on ? WIN : STONE; replan(bothy); }
      replan(maps[ID]);
    }
    if (typeof R3D !== 'undefined' && R3D.invalidate) R3D.invalidate();
    ST.wasOn = on;
  }
  let ORIG = null;
  function wire() {
    if (typeof Engine === 'undefined' || typeof EAVES78 === 'undefined' || !L1 || !EAVES78.STYLES[ID]) return false;
    ORIG = EAVES78.STYLES[ID];
    EAVES78.STYLES[BASE] = ORIG;                                                     // Phase 1's row, for the timber planner
    EAVES78.STYLES[ID] = Object.assign({}, ORIG, { builds: 'field stone laid dry, under turf and heather', shutters: 'none', only: ['one low room, one door, no window on the weather side', 'no chimney: smoke at the hole in the roof', 'roofs hipped all round, cut short at the wall head'], plan: planHighland });
    Engine.addTexture('la_turf', paintTurf());
    Engine.addTexture(WIN, paintWindow());
    ST.old = Engine.textures[STONE]; ST.stone = paintStone();
    if (typeof R3D !== 'undefined' && R3D.extendMesh) R3D.extendMesh(mesh);
    const _bm = buildAllMaps; buildAllMaps = function () { const maps = _bm.apply(this, arguments); try { apply(maps); } catch (e) { ST.err = ST.err || String(e && e.message); } return maps; };
    const _up = update; update = function (dt) {
      const r = _up.apply(this, arguments);
      try { if (ST.wasOn !== sw()) apply(); if (G.state === 'play') smoke(dt); } catch (e) { ST.err = ST.err || String(e && e.message); }
      return r;
    };
    L1.SWITCHES.push(['laBuild', 'Highland building', 'The bothy built the highland way: turf and heather roof, smoke from a hole, one window on the lee side, field stone. Off: the timber planner\'s thatch roof and Phase 1\'s stone']);
    return true;
  }
  const wired = typeof window !== 'undefined' ? wire() : false;
  return { B, ID, BASE, STONE, WIN, stoneAt, paintStone, turfAt, paintTurf, paintWindow, highland, planHighland, mesh, apply, state: () => ST, orig: () => ORIG, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BUILD8;
