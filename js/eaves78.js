// ============================================================
//  eaves78 — Phase 78, "roofs and fronts": buildings get the shape of buildings, region by region (Oakhaven and its Hollow, Port Cantabile, Whisper-Grove).
//
//  Owner, 11 Nov: the sharp-tiles pass changed almost nothing he could see, and he agreed to start with building
//  shapes; on seeing the first roofs: "this looks great ... fix the rain through the buildings and houses. I like the
//  invented details keep them, yes I want the upper storeys and dormers. I want this entire region fleshed out before
//  we move anywhere". Until now a building was a ring of wall blocks one storey high with a stepped flat lid. In the
//  3D renderer (js/r3d21.js) this module adds, over each building's own footprint and without touching the map, its
//  walls or anything the game reads:
//    houses     a pitched roof on the long axis (thatch, slate or the old moss tile: the bibles give Oakhaven "timber
//               and plaster under thatch and slate"), eaves and barge boards, gable ends with an attic window, shuttered
//               windows lit after dusk, a stone footing, door hoods, a brick stack under every smoking chimney;
//    big houses a jettied upper storey with its own windows (the inn, the mill, the dyer's, the tannery, the
//               wool-factor's), a double-pile roof where the house is deep, and dormers;
//    sheds      barns, stores, sheds, the granary and the washhouse stay plain: one storey, boarded hatches, no dormers;
//    the Greenhall   a hipped slate roof and its dome (Vol VIII: "the Greenhall dome");
//    the Chapel      a slate roof round the bell-tower, lancet windows, and on the tower an open, empty bell-frame
//               (Vol VIII: "its belfry open to the weather", "Nothing hangs in the tower. You can see daylight
//               through the frame").
//  Nothing ordinary rises above the mooring mast or the tower: from Hedge Knoll the dome, the mast and the tower still
//  stand over the roofs. Rain and snow stop at the roofs (EAVES78.shelter, read by js/light21.js). The classic
//  renderer draws the old boxes exactly as before.
//
//  Owner, 11 Nov: "each region should have at least something unique about it even from a building and house
//  perspective. Nothing that's over the top" and "the invented details are great keep them coming. Yes lets move to
//  port Cantabile." Every region has an entry in EAVES78.STYLES and may have its own planner:
//    Port Cantabile   (books: the town "climbs its cliff from the Long Mole by the Salt Stair, six wet flights with shops
//               on the landings, and every shroud in the harbour carries a chime"; the counting-house is "square stone, a
//               slate roof, iron shutters"). Lime-wash and ashlar under slate, never thatch or timber. Every house
//               turns its gable to the water; the gable walls stand above the slates and are capped in pale stone, the
//               eaves are clipped short. Hesper's four quay houses have a loft door and a hoist beam hung with three
//               bronze chimes; the Harbour Office ("Dues, bench and bell") a bell-cote; the counting-house a low slate
//               roof and rows of iron shutters that are never lit; the painted houses up the cliff each get an upper
//               wall and a small gable with one window; the shops on the stair landings a slate pentice.
//    Whisper-Grove    (books: "sunk in its marble plazas"; "a square of white marble ... with a colonnade on three sides and
//               the Moot-house on the fourth"; the colonnade "rose out of it like a row of teeth"; "a marble finial";
//               "at dusk the water lit itself: a cold lilac phosphorescence ... the whole square glowed from underneath";
//               the Moot-house has "a gallery of three windows over the plaza"; the Bell Yard has "dry lamps").
//               Marble under lead. The upper storey of every marble building is an open colonnade round a set-back wall,
//               under an entablature and a low roof with a pediment at each end; a pediment over the front and a
//               door-case on every door; marble finials on corners and points; tall dark arched windows. Nothing is lit
//               after dusk but the Moot-house gallery's three windows and a few in the Malting, which is the Office's
//               house: "a long brick range with two kiln-chimneys" (Book One; the owner's ruling), under slate. Where a building stands in the water its columns and the
//               underside of its colonnade take the water's lilac light after dusk. In the Bell Yard and Ashlane the
//               terraces get the same colonnade as a gallery running the length of each lane (dry: no lilac).
//
//  EAVES78.STYLES             one entry per region: what it builds with, and what only it has
//  EAVES78.plan(map)          -> { houses: [building, ...], shops?: [...] }   (every roofed building; .stone, .plain, .storeys, .cliff tell them apart)
//  EAVES78.roofZ(b, x, y)     the new roof's height over a point, or null outside its eaves
//  EAVES78.shelter(map)       -> { sig, k, w, h, data } heights the rain stops at (game units; -1e4 = open sky), or null
//  Switch GFX.eaves (Options -> Graphics & access, "Roofs, windows and eaves"). Nothing is saved; no random numbers.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.eaves === undefined) GFX.eaves = true;
  if (!Array.isArray(GFX.ART)) GFX.ART = [];
  if (!GFX.ART.includes('eaves')) GFX.ART.push('eaves');
}

const EAVES78 = (() => {
  // Every region builds in its own way (owner, 11 Nov: "each region should have at least something unique about it even
  // from a building and house perspective. Nothing that's over the top but enough so that each new area and region is cool
  // and unique enough to want to explore"). A region is an entry here: what it builds with, and the one or two things only
  // it has. Oakhaven is the first; the next region adds an entry and its own rules, it does not borrow Oakhaven's.
  const STYLES = {
    oakhaven: { builds: 'timber and plaster under thatch and slate (the bibles)', shutters: 'green-grey', only: ['jettied upper storeys and double-pile roofs', "the Greenhall's dome", "the Chapel's open bell-frame"] },
    // the Hollow, Oakhaven's low quarter "behind the tannery": the same timber, plaster and thatch, but rows of cottages built
    // back to back, never more than one storey, each row under one long deep roof
    p30_hollow: { builds: 'timber and plaster under thatch', shutters: 'green-grey', only: ['rows of cottages built back to back under one long roof', 'nothing above one storey'], terraces: true, low: true, maxRidge: 3.0, roof: 'e78_thatch' },
    // Port Cantabile "climbs its cliff from the Long Mole by the Salt Stair ... and every shroud in the harbour carries a
    // chime" (Fairweather's Companion); its counting-house is "square stone, a slate roof, iron shutters" (the game's own
    // text). So: lime-washed fronts and ashlar under slate, no thatch and no timber; houses stand gable-end to the water,
    // the gable walls raised above the slates and capped in stone against the wind, the eaves clipped short.
    cantabile_harbour: { builds: 'lime-washed plaster and ashlar under slate', shutters: 'sea-blue; iron on the counting-house', only: ['gables turned to the water, raised and stone-capped', 'a loft door and a hoist beam hung with chimes in each quay gable', "the Harbour Office's bell-cote"], plan: (m) => planHarbour(m) },
    // Whisper-Grove "lay sunk in its marble plazas": "a square of white marble the size of four fields, with a colonnade on
    // three sides and the Moot-house on the fourth", under "a foot of still water" from which "the colonnade rose ... like a
    // row of teeth"; a proctor is killed there "with a marble finial"; the skyline has "the broken colonnade and marble
    // spires" (ruled canon). After the Unnaming nobody in the city lights a lamp: "at dusk the water lit itself". So: marble
    // under lead; the upper storey of every building is an open colonnade under a low pediment, with marble finials on the
    // roofline; the windows are tall, arched and dark. The only lit windows are the three of the Moot-house gallery (Sable's)
    // and the Office's own house, the Malting, which is brick (Book One; the owner's ruling) with no colonnade at all.
    whispergrove: { builds: 'grey-white marble under lead', shutters: 'none: tall dark arched windows', only: ['an open colonnade for an upper storey, under a low pediment', 'marble finials on every roofline', 'no window lit after dusk but the Moot-house gallery and the Malting'], plan: (m) => planGrove(m) },
    // the Bell Yard and Ashlane, the same city's lanes ("swept streets ... dry lamps"): terraces, the gallery running the length of the lane
    // the Malting's own yard, on the Cloister road (Book One: "a long brick range with two kiln-chimneys at the north end")
    p61_yard: { builds: 'brick under slate', shutters: 'grey', only: ['the Malting: the one brick house of a marble city, and its two kiln-chimneys'], plan: (m) => planYard(m) },
    p31_bellyard: { builds: 'grey-white marble under lead', shutters: 'none: tall dark arched windows', only: ['a colonnaded gallery running the length of each lane, over the doors', 'no window lit after dusk'], plan: (m) => planGrove(m) },
  };
  const MAPS = new Set(Object.keys(STYLES));
  const PITCH = 0.85, OVER0 = 0.28, VERGE0 = 0.22, OVER = OVER0, VERGE = VERGE0, LIFT = 0.06, STOREY = 0.6, JETTY = 0.11;
  const RIDGE1 = 2.45, RIDGE2 = 2.7;                             // the highest ridge of a one- and a two-storey house (the mast is 2.8, the tower 3.2)
  const WALL = /^(t_house|t_wood$|t_marble)/, PLAIN = /barn|shed|store|granary|washhouse/i;
  const max = Math.max, min = Math.min, abs = Math.abs, hyp = Math.hypot, PI = Math.PI;
  const on = () => typeof GFX === 'undefined' || GFX.eaves !== false;
  function h2(a, b) { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  // ---------------------------------------------------------------- the roof's height
  // local frame: a runs along the ridge, s across it from the building's middle (b.C)
  function roofZ(b, x, y) {
    const ax = b.axis === 'x', a = ax ? x : y, s = (ax ? y : x) - b.C, as = abs(s);
    const OVER = b.over != null ? b.over : OVER0, VERGE = b.verge != null ? b.verge : VERGE0;
    if (b.type === 'hip') {
      if (a < b.A0 - OVER || a > b.A1 + OVER || as > b.half + OVER) return null;
      return b.zBase + b.pitch * min(a - b.A0, b.A1 - a, b.half - as);
    }
    if (a < b.A0 - VERGE || a > b.A1 + VERGE || as > b.half + OVER) return null;
    return b.zBase + (b.span - (b.ridges === 2 ? abs(as - b.span) : as)) * b.pitch;
  }

  // ---------------------------------------------------------------- which blocks are a building, and what kind
  function plan(m) { const st = m && STYLES[m.id]; return st && st.plan ? st.plan(m) : planTimber(m); }
  function planTimber(m) {
    const W = m.w, H = m.h, g = m.cells, seen = new Uint8Array(W * H), houses = [], st = (m && STYLES[m.id]) || {}, rects = [];
    const cell = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : g[y * W + x];
    const part = (c) => !!c && (c.door ? true : (WALL.test(c.tex || '') || c.tex === 't_roof'));
    const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !cell(x, y);
    for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
      if (seen[sy * W + sx] || !part(cell(sx, sy)) || cell(sx, sy).door) continue;
      let x0 = sx, x1 = sx, y0 = sy, y1 = sy, n = 0; const st = [[sx, sy]]; seen[sy * W + sx] = 1;
      while (st.length) { const [x, y] = st.pop(); n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || seen[Y * W + X] || !part(cell(X, Y))) continue; seen[Y * W + X] = 1; st.push([X, Y]); } }
      { const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w >= 3 && h >= 3 && n === w * h) rects.push([x0, y0, x1, y1]); }   // a plain rectangle
    }
    // rows of houses built into one mass (the Hollow): each strip of lid, with the ring of wall and doors round it, is a row
    if (st.terraces) {
      const isLid = (x, y) => { const c = cell(x, y); return !!c && !c.door && (c.tex === 't_roof' || c.capTex === 't_roof'); }, seenL = new Uint8Array(W * H);
      for (let y0 = 1; y0 < H - 1; y0++) for (let x0 = 1; x0 < W - 1; x0++) {
        if (seenL[y0 * W + x0] || !isLid(x0, y0)) continue;
        let x1 = x0; while (isLid(x1 + 1, y0)) x1++;
        const full = (yy) => { if (isLid(x0 - 1, yy) || isLid(x1 + 1, yy)) return false; for (let X = x0; X <= x1; X++) if (!isLid(X, yy)) return false; return true; };
        let y1 = y0; while (full(y1 + 1)) y1++;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) seenL[y * W + x] = 1;
        if (x0 - 1 < 0 || y0 - 1 < 0 || x1 + 1 > W - 1 || y1 + 1 > H - 1 || rects.some((r) => x0 >= r[0] && x1 <= r[2] && y0 >= r[1] && y1 <= r[3])) continue;
        rects.push([x0 - 1, y0 - 1, x1 + 1, y1 + 1]);
      }
    }
    for (const [x0, y0, x1, y1] of rects) {
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      let lid = 0, wallTex = null, ok = true, label = ''; const doorList = [], towers = [], inner = []; let dome = null;
      for (let y = y0; y <= y1 && ok; y++) for (let x = x0; x <= x1; x++) {
        const c = cell(x, y), edge = x === x0 || x === x1 || y === y0 || y === y1;
        if (edge) {
          if (c.door) { doorList.push({ x, y, nx: y === y0 || y === y1 ? 0 : (x === x0 ? -1 : 1), ny: y === y0 ? -1 : y === y1 ? 1 : 0 }); if (c.label) label += c.label + ' '; }
          else if (!WALL.test(c.tex || '') || (c.top != null && c.top > 1.01)) { ok = false; break; } else if (!wallTex) wallTex = c.tex;
        } else {
          if (c.door) { ok = false; break; }
          if (c.tex === 't_roof' || c.capTex === 't_roof') lid++;
          const t = c.top != null ? c.top : 1;
          if (t > 2.2) towers.push({ x, y, top: t }); else if (t >= 2 && c.capTex === 't_roof') dome = { x, y, top: t }; else inner.push({ x, y, top: t });
        }
      }
      if (!ok || !doorList.length || !lid || !wallTex) continue;
      const stone = /^t_marble/.test(wallTex), plain = !stone && PLAIN.test(label);
      if (!stone && towers.length) continue;                               // a tower in a timber house: not one of ours
      const church = stone && towers.length > 0;                                 // a towered stone hall: a nave, its gable over the door
      const ax = church ? doorList[0].nx !== 0 : w >= h, acrossN = ax ? h : w, storeys = (!stone && !plain && !st.low && w * h >= 25) ? 2 : 1;
      const base = m.lvls ? m.lvls[y0 * W + x0] || 0 : 0, top = base + 1;
      const ext = stone ? 0.3 : (storeys === 2 ? STOREY : 0), jetty = storeys === 2 ? JETTY : 0, wallTop = top + ext;
      const b = { x0, y0, x1, y1, w, h, axis: ax ? 'x' : 'y', stone, church, plain, storeys, label: label.trim(), top, ext, jetty, wallTop, wallTex, towers, dome,
        type: stone && !church ? 'hip' : 'gable', half: acrossN / 2 + jetty, C: ax ? (y0 + y1 + 1) / 2 : (x0 + x1 + 1) / 2, A0: (ax ? x0 : y0) - jetty, A1: (ax ? x1 : y1) + 1 + jetty,
        windows: [], doors: doorList.filter((d) => open(d.x + d.nx, d.y + d.ny)), plinth: [], dormers: [] };
      b.ridges = (b.type === 'gable' && storeys === 2 && acrossN >= 5) ? 2 : 1; b.span = b.half / b.ridges;
      // the pitch: as steep as the skyline allows, and the whole of the old lid stays under the new roof
      const maxRidge = base + (stone ? (towers.length ? min(...towers.map((t) => t.top)) - 0.6 : 2.3) : (storeys === 2 ? RIDGE2 : (st.maxRidge || RIDGE1)));
      b.pitch = min(stone ? 0.6 : PITCH, (maxRidge - wallTop - LIFT) / b.span); b.lift = LIFT;
      for (let it = 0; it < 14; it++) {
        b.zBase = wallTop + LIFT; let need = 0;
        for (const c of inner) for (let k = 0; k < 9; k++) { const fx = (k % 3) / 2, fy = ((k / 3) | 0) / 2, z = roofZ(b, c.x + fx, c.y + fy); if (z != null && base + c.top + 0.04 - z > need) need = base + c.top + 0.04 - z; }
        b.lift = LIFT + need; if (wallTop + b.lift + b.span * b.pitch <= maxRidge + 1e-6 || b.pitch < 0.12) break; b.pitch *= 0.92;
      }
      b.zBase = wallTop + b.lift; b.ridge = b.zBase + b.span * b.pitch;
      const r = h2(x0 * 3 + 1, y0 * 5 + 2);
      b.roofTex = st.roof && !stone ? st.roof : stone ? 'e78_slate' : storeys === 2 ? (r < 0.55 ? 'e78_slate' : 't_roof') : plain ? (r < 0.5 ? 'e78_thatch' : 't_roof') : (r < 0.42 ? 'e78_thatch' : r < 0.7 ? 'e78_slate' : 't_roof');
      // ---- windows: a list of openings on wall planes { cx, cy, nx, ny, z0, z1, hw, style, lit }
      const style0 = stone ? (towers.length ? 'lancet' : 'hall') : plain ? 'hatch' : 'cottage';
      const sides = [[0, -1, 'x', y0], [0, 1, 'x', y1], [-1, 0, 'y', x0], [1, 0, 'y', x1]];
      for (const [nx, ny, along, fixed] of sides) {
        const a0 = along === 'x' ? x0 + 1 : y0 + 1, a1 = along === 'x' ? x1 - 1 : y1 - 1, len = a1 - a0 + 1;
        for (let a = a0 - 1; a <= a1 + 1; a++) { const qx = along === 'x' ? a : fixed, qy = along === 'x' ? fixed : a, qc = cell(qx, qy); if (!stone && qc && !qc.door && open(qx + nx, qy + ny)) b.plinth.push({ x: qx, y: qy, nx, ny }); }
        for (let a = a0; a <= a1; a++) {
          const x = along === 'x' ? a : fixed, y = along === 'x' ? fixed : a, c = cell(x, y), i = a - a0;
          if (len % 2 ? i % 2 !== 0 : i % 2 !== 1) continue;                 // every other cell, so the wall between them reads
          const cx = x + 0.5 + nx * 0.5, cy = y + 0.5 + ny * 0.5, lit = h2(x * 7 + 3, y * 13 + 1);
          if (storeys === 2) b.windows.push({ cx: cx + nx * jetty, cy: cy + ny * jetty, nx, ny, z0: top + 0.17, z1: top + 0.5, hw: 0.19, style: 'cottage', lit: h2(x * 5 + 9, y * 3 + 4) < 0.6 });
          if (!c || c.door || !open(x + nx, y + ny)) continue;
          const px = along === 'x' ? 1 : 0, py = along === 'x' ? 0 : 1, pa = cell(x - px, y - py), pb = cell(x + px, y + py);
          if ((pa && pa.door) || (pb && pb.door) || (m.decals && m.decals[y * W + x])) continue;
          if (plain && i % 4 > 1) continue;
          if (style0 === 'lancet') b.windows.push({ cx, cy, nx, ny, z0: top - 0.74, z1: top + 0.2, hw: 0.17, style: 'lancet', lit: true });
          else if (style0 === 'hall') b.windows.push({ cx, cy, nx, ny, z0: top - 0.7, z1: top + 0.06, hw: 0.2, style: 'hall', lit: lit < 0.3 });
          else b.windows.push({ cx, cy, nx, ny, z0: top - 0.63, z1: top - 0.2, hw: 0.21, style: style0, lit: lit < 0.72 });
        }
      }
      if (b.type === 'gable') {
        const rise = b.span * b.pitch, ends = [[b.A0, -1], [b.A1, 1]], centres = b.ridges === 2 ? [-b.span, b.span] : [0];
        // an attic window in each gable
        if (!plain && rise >= 0.75) for (const [a, na] of ends) for (const cs of centres) {
          const wx = ax ? a : b.C + cs, wy = ax ? b.C + cs : a;
          if (church) b.windows.push({ cx: wx, cy: wy, nx: ax ? na : 0, ny: ax ? 0 : na, z0: b.zBase + 0.06, z1: b.zBase + min(0.8, rise * 0.62), hw: 0.16, style: 'lancet', lit: true });
          else b.windows.push({ cx: wx, cy: wy, nx: ax ? na : 0, ny: ax ? 0 : na, z0: b.zBase + 0.1, z1: b.zBase + min(0.42, rise * 0.42), hw: 0.14, style: 'attic', lit: h2(wx * 11 | 0, wy * 17 | 0) < 0.4 });
        }
        // dormers on the outer slopes
        const L = b.A1 - b.A0, nd = (plain || stone || rise < 0.8 || L < 4.9) ? 0 : L >= 7.4 ? 2 : 1;
        for (let k = 0; k < nd; k++) for (const sg of [-1, 1]) b.dormers.push({ a: b.A0 + L * (k + 1) / (nd + 1) + (sg * 0.35 * (nd === 1 ? 1 : 0)), cs: b.ridges === 2 ? sg * b.span : 0, sg, f: rise >= 1 ? 0.55 : 0.72, lit: h2(x0 * 31 + k * 7 + sg, y0 * 19) < 0.55 });
      }
      houses.push(b);
    }
    return { houses };
  }
  // Port Cantabile. A building is a rectangle of plaster or ashlar with a slate lid and a door; heights here are the map's own
  // (the town stands on a cliff: a wall's top is where the map puts it).
  function planHarbour(m) {
    const W = m.w, H = m.h, g = m.cells, seen = new Uint8Array(W * H), houses = [];
    const cell = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : g[y * W + x];
    const WALLH = /^p17c_(plaster|ashlar|shutter)/, part = (c) => !!c && (c.door ? true : (WALLH.test(c.tex || '') || c.tex === 'p17c_slate'));
    const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !cell(x, y), gnd = (x, y) => (m.lvls && x >= 0 && y >= 0 && x < W && y < H) ? (m.lvls[y * W + x] || 0) : 0;
    for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
      if (seen[sy * W + sx] || !part(cell(sx, sy)) || cell(sx, sy).door) continue;
      let x0 = sx, x1 = sx, y0 = sy, y1 = sy, n = 0; const stk = [[sx, sy]]; seen[sy * W + sx] = 1;
      while (stk.length) { const [x, y] = stk.pop(); n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || seen[Y * W + X] || !part(cell(X, Y))) continue; seen[Y * W + X] = 1; stk.push([X, Y]); } }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w < 3 || h < 3 || n !== w * h) continue;
      let lid = 0, wallTex = null, ok = true, label = '', wallTop = -1e9; const doorList = [], inner = [];
      for (let y = y0; y <= y1 && ok; y++) for (let x = x0; x <= x1; x++) {
        const c = cell(x, y), edge = x === x0 || x === x1 || y === y0 || y === y1, t = c.top != null ? c.top : gnd(x, y) + 1;
        if (edge) {
          if (c.door) { doorList.push({ x, y, nx: y === y0 || y === y1 ? 0 : (x === x0 ? -1 : 1), ny: y === y0 ? -1 : y === y1 ? 1 : 0 }); if (c.label) label += c.label + ' '; }
          else if (!WALLH.test(c.tex || '')) { ok = false; break; } else { if (!wallTex || /shutter/.test(wallTex)) wallTex = c.tex; if (t > wallTop) wallTop = t; }
        } else { if (c.door) { ok = false; break; } if (c.tex === 'p17c_slate' || c.capTex === 'p17c_slate') lid++; inner.push({ x, y, top: t }); }
      }
      if (!ok || !doorList.length || !lid || !wallTex) continue;
      const d0 = doorList[0], base = gnd(d0.x + d0.nx, d0.y + d0.ny), stone = /ashlar/.test(wallTex), office = /OFFICE/i.test(label);
      const ax = d0.nx !== 0, acrossN = ax ? h : w;                         // the ridge runs back from the door: the gable faces the quay
      const b = { x0, y0, x1, y1, w, h, axis: ax ? 'x' : 'y', stone, church: false, plain: false, storeys: 1, label: label.trim(), top: wallTop, ext: 0, jetty: 0, wallTop, wallTex, towers: [], dome: null,
        type: 'gable', ridges: 1, half: acrossN / 2, span: acrossN / 2, C: ax ? (y0 + y1 + 1) / 2 : (x0 + x1 + 1) / 2, A0: ax ? x0 : y0, A1: (ax ? x1 : y1) + 1,
        windows: [], doors: [], plinth: [], dormers: [], stacks: [], extras: [], over: 0.05, verge: 0, parapet: stone ? 0.2 : 0.13, harbour: true, base, roofTex: 'p17c_slate', boardTex: 'e78_cope' };
      b.pitch = stone ? 0.3 : acrossN >= 7 ? 0.42 : 0.6; b.zBase = wallTop + LIFT; let need = 0;
      for (const c of inner) for (let k = 0; k < 9; k++) { const z = roofZ(b, c.x + (k % 3) / 2, c.y + ((k / 3) | 0) / 2); if (z != null && c.top + 0.04 - z > need) need = c.top + 0.04 - z; }
      b.lift = LIFT + need; b.zBase = wallTop + b.lift; b.ridge = b.zBase + b.span * b.pitch;
      const rise = b.span * b.pitch, tall = wallTop - base;
      for (const [nx, ny, along, fixed] of [[0, -1, 'x', y0], [0, 1, 'x', y1], [-1, 0, 'y', x0], [1, 0, 'y', x1]]) {
        const a0 = along === 'x' ? x0 + 1 : y0 + 1, a1 = along === 'x' ? x1 - 1 : y1 - 1, len = a1 - a0 + 1;
        for (let a = a0; a <= a1; a++) {
          const x = along === 'x' ? a : fixed, y = along === 'x' ? fixed : a, c = cell(x, y), i = a - a0;
          if ((len % 2 ? i % 2 !== 0 : i % 2 !== 1) || !c || c.door || !open(x + nx, y + ny) || /shutter/.test(c.tex || '')) continue;
          const px = along === 'x' ? 1 : 0, py = along === 'x' ? 0 : 1, pa = cell(x - px, y - py), pb = cell(x + px, y + py);
          if ((pa && pa.door) || (pb && pb.door) || (m.decals && m.decals[y * W + x])) continue;
          const cx = x + 0.5 + nx * 0.5, cy = y + 0.5 + ny * 0.5, z = gnd(x + nx, y + ny);
          if (stone) { for (let r = 0; r * 1.2 + 1.6 < tall; r++) b.windows.push({ cx, cy, nx, ny, z0: z + 0.85 + r * 1.2, z1: z + 1.5 + r * 1.2, hw: 0.2, style: 'iron', lit: false }); }
          else b.windows.push({ cx, cy, nx, ny, z0: z + 0.37, z1: z + 0.8, hw: 0.21, style: 'cottage', shut: 'blue', lit: h2(x * 7 + 3, y * 13 + 1) < (office ? 0.5 : 0.62) });
        }
      }
      // the gable over the door, and the one behind
      const fa = (ax ? d0.nx : d0.ny) < 0 ? b.A0 : b.A1, fn = fa === b.A0 ? -1 : 1, ra = fa === b.A0 ? b.A1 : b.A0;
      const on2 = (a) => ({ x: ax ? a : b.C, y: ax ? b.C : a }), F = on2(fa), R = on2(ra), nrm = (k) => ({ nx: ax ? k : 0, ny: ax ? 0 : k });
      if (stone) b.windows.push({ cx: F.x, cy: F.y, ...nrm(fn), z0: b.zBase + 0.25, z1: b.zBase + min(0.9, rise * 0.5), hw: 0.2, style: 'iron', lit: false });
      else if (office) {
        b.windows.push({ cx: F.x, cy: F.y, ...nrm(fn), z0: b.zBase + 0.12, z1: b.zBase + min(0.6, rise * 0.4), hw: 0.19, style: 'attic', lit: true });
        b.extras.push({ kind: 'bellcote', x: F.x, y: F.y, ...nrm(fn), z: b.ridge + b.parapet });
      } else {
        const z1 = b.zBase + min(0.66, rise * 0.46);
        b.windows.push({ cx: F.x, cy: F.y, ...nrm(fn), z0: b.zBase + 0.12, z1, hw: 0.17, style: 'loft', lit: false });
        b.extras.push({ kind: 'hoist', x: F.x, y: F.y, ...nrm(fn), z: z1 + 0.1 });
      }
      if (!stone) {
        b.windows.push({ cx: R.x, cy: R.y, ...nrm(-fn), z0: b.zBase + 0.14, z1: b.zBase + min(0.5, rise * 0.36), hw: 0.14, style: 'attic', lit: h2(x0 * 11, y0 * 17) < 0.4 });
        const sa = ra + fn * 0.12, so = (h2(x0 * 5, y0 * 3) < 0.5 ? -1 : 1) * min(0.9, b.span * 0.4);       // a stone stack in the rear gable
        b.stacks.push(ax ? { x: sa, y: b.C + so } : { x: b.C + so, y: sa });
      }
      houses.push(b);
    }
    // the houses up the cliff: a painted front with a block of slate behind it. Each run of fronts is one house; it gets an
    // upper wall to clear its old lid and its own small gable, turned to the water like the ones on the quay.
    const FR = /^p17c_front/, isF = (c) => !!c && FR.test(c.tex || '');
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const c = cell(x, y); if (!isF(c) || isF(cell(x - 1, y))) continue;
      let x1 = x; while (isF(cell(x1 + 1, y))) x1++;
      let ok = true, lid = -1e9, lidLo = 1e9, ft = -1e9;
      for (let X = x; X <= x1; X++) { const sl = cell(X, y - 1), f = cell(X, y); if (!sl || sl.tex !== 'p17c_slate' || sl.top == null || f.top == null) { ok = false; break; } lid = max(lid, sl.top); lidLo = min(lidLo, sl.top); ft = max(ft, f.top); }
      const n = x1 - x + 1; if (!ok || n > 5 || lid - ft > 0.9) continue;
      const v = /front(\d)/.exec(c.tex), wallTex = 'p17c_plaster' + (v ? v[1] : ''), wallTop = lid + 0.04, pitch = n === 1 ? 0.9 : n === 2 ? 0.7 : 0.55;
      const b = { x0: x, y0: y - 1, x1, y1: y, w: n, h: 2, axis: 'y', stone: false, church: false, plain: false, storeys: 1, label: '', top: ft, ext: wallTop - ft, jetty: 0, skin: 0.012, wallTop, wallTex, towers: [], dome: null,
        type: 'gable', ridges: 1, half: n / 2, span: n / 2, C: (x + x1 + 1) / 2, A0: y - 1, A1: y + 1, windows: [], doors: [], plinth: [], dormers: [], stacks: [], extras: [], over: 0.05, verge: 0, parapet: 0.1, harbour: true, cliff: true,
        base: gnd(x, y + 1), roofTex: 'p17c_slate', boardTex: 'e78_cope', pitch, lift: 0.02, zBase: wallTop + 0.02, backFrom: lidLo };
      b.ridge = b.zBase + b.span * pitch;
      if (n >= 2) { const rise = b.span * pitch, hw = n === 2 ? 0.13 : 0.16, z1 = b.zBase + min(0.42, rise * 0.5);
        b.windows.push({ cx: b.C, cy: y + 1, nx: 0, ny: 1, z0: z1 - (n === 2 ? 0.27 : 0.32), z1, hw, style: 'attic', lit: h2(x * 13 + 5, y * 7 + 2) < 0.6 });
        if (h2(x * 3 + 1, y * 11) < 0.7) b.stacks.push({ x: b.C + (h2(x, y) < 0.5 ? -1 : 1) * b.span * 0.45, y: y - 1 + 0.14 }); }
      houses.push(b);
    }
    // the shops on the Salt Stair's landings (and any door let into a plain wall): a slate pentice over the shop-front
    const shops = [], inHouse = (x, y) => houses.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const c = cell(x, y); if (!c || !c.door || inHouse(x, y)) continue;
      for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fa = cell(x - ny, y + nx), fb = cell(x + ny, y - nx);
        if (!open(x + nx, y + ny) || !fa || !fb || !WALLH.test(fa.tex || '') || !WALLH.test(fb.tex || '')) continue;
        shops.push({ cx: x + 0.5 + nx * 0.5, cy: y + 0.5 + ny * 0.5, nx, ny, hw: 1.46, z: fa.top != null ? fa.top : gnd(x - ny, y + nx) + 1 }); break;
      }
    }
    return { houses, shops };
  }
  // Whisper-Grove. The city's buildings are solid blocks of marble one storey high. A block (or each straight-sided part of
  // an L-shaped one) that is at least four cells each way is a building; the wall round the edge of the map is not.
  function planGrove(m) {
    const W = m.w, H = m.h, g = m.cells, seen = new Uint8Array(W * H), houses = [];
    const cell = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : g[y * W + x];
    const MARB = /^t_(greymarble|brick)$/, rim = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1;
    const part = (x, y) => { const c = cell(x, y); return !!c && !rim(x, y) && c.top == null && (c.door ? true : MARB.test(c.tex || '')); };
    const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !cell(x, y);
    // does a building stand in the water? (the lit water is what lights the colonnades after dusk; the lanes are dry)
    const water = (x, y) => open(x, y) && /shallows|water/.test((m.floorTextures && m.floorCells ? m.floorTextures[m.floorCells[y * W + x]] : m.floor) || '');
    const wet = (X0, Y0, X1, Y1) => { let n = 0, k = 0; for (let x = X0; x <= X1; x++) for (const y of [Y0 - 1, Y1 + 1]) if (open(x, y)) { n++; if (water(x, y)) k++; } for (let y = Y0; y <= Y1; y++) for (const x of [X0 - 1, X1 + 1]) if (open(x, y)) { n++; if (water(x, y)) k++; } return n > 0 && k / n >= 0.4; };
    for (let y0 = 1; y0 < H - 1; y0++) for (let x0 = 1; x0 < W - 1; x0++) {
      if (seen[y0 * W + x0] || !part(x0, y0)) continue;
      let x1 = x0; while (part(x1 + 1, y0) && !seen[y0 * W + x1 + 1]) x1++;
      const same = (yy) => { if (part(x0 - 1, yy) || part(x1 + 1, yy)) return false; for (let X = x0; X <= x1; X++) if (!part(X, yy) || seen[yy * W + X]) return false; return true; };
      let y1 = y0; while (y1 + 1 < H - 1 && same(y1 + 1)) y1++;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) seen[y * W + x] = 1;
      const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 4 || h < 4) continue;
      let label = '', wallTex = null; const doorList = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = cell(x, y);
        if (c.door) { const nx = x === x0 && open(x - 1, y) ? -1 : x === x1 && open(x + 1, y) ? 1 : 0, ny = nx ? 0 : y === y0 && open(x, y - 1) ? -1 : y === y1 && open(x, y + 1) ? 1 : 0; if (nx || ny) doorList.push({ x, y, nx, ny }); if (c.label) label += c.label + ' '; }
        else if (!wallTex) wallTex = c.tex; }
      const brick = wallTex === 't_brick', ax = w >= h, across = ax ? h : w, half = across / 2, T = 1;
      const b = { x0, y0, x1, y1, w, h, axis: ax ? 'x' : 'y', stone: false, brick, church: false, plain: brick, storeys: 2, label: label.trim(), top: T, jetty: 0, wallTex, towers: [], dome: null, ridges: 1, half, span: half,
        C: ax ? (y0 + y1 + 1) / 2 : (x0 + x1 + 1) / 2, A0: ax ? x0 : y0, A1: (ax ? x1 : y1) + 1, windows: [], doors: doorList, plinth: [], dormers: [], stacks: [], extras: [], roofTex: 'e78_lead', lift: 0.02 };
      const sides = [[0, -1, 'x', y0], [0, 1, 'x', y1], [-1, 0, 'y', x0], [1, 0, 'y', x1]];
      const each = (fn) => { for (const [nx, ny, along, fixed] of sides) { const a0 = along === 'x' ? x0 + 1 : y0 + 1, a1 = along === 'x' ? x1 - 1 : y1 - 1, len = a1 - a0 + 1;
        for (let a = a0; a <= a1; a++) { const x = along === 'x' ? a : fixed, y = along === 'x' ? fixed : a, c = cell(x, y), i = a - a0, px = along === 'x' ? 1 : 0, py = along === 'x' ? 0 : 1, pa = cell(x - px, y - py), pb = cell(x + px, y + py);
          if ((len % 2 ? i % 2 !== 0 : i % 2 !== 1) || !c || c.door || !open(x + nx, y + ny) || (pa && pa.door) || (pb && pb.door) || (m.decals && m.decals[y * W + x])) continue;
          fn(x, y, nx, ny); } } };
      if (brick) {
        // the Office's house, the Malting (Book One: "a long brick range with two kiln-chimneys at the north end"; the owner's
        // ruling: brick, as the book says). No colonnade: a blind ground floor, a brick upper storey with shuttered windows,
        // some of them lit, one long slate roof, and the two kiln-chimneys at the north of its far end
        Object.assign(b, { type: 'gable', ext: 0.62, wallTop: T + 0.62, over: 0.2, verge: 0.12, parapet: 0, pitch: min(0.36, 1.5 / half), roofTex: 'e78_slate', lift: LIFT });
        { const far = doorList[0] && doorList[0].nx < 0 ? x1 + 1 - 2.2 : doorList[0] && doorList[0].nx > 0 ? x0 + 2.2 : (x0 + x1 + 1) / 2, yk = y0 + 1.5; b.extras.push({ kind: 'kiln', x: far - 1.2, y: yk }, { kind: 'kiln', x: far + 1.2, y: yk }); }
        each((x, y, nx, ny) => b.windows.push({ cx: x + 0.5 + nx * 0.5, cy: y + 0.5 + ny * 0.5, nx, ny, z0: T + 0.14, z1: T + 0.5, hw: 0.17, style: 'cottage', lit: h2(x * 7 + 3, y * 13 + 1) < 0.5 }));   // shuttered (the game: "Grey shutters, an Office seal")
      } else {
        // marble: the ground storey as the map has it, tall arched windows; above it an open colonnade round a set-back
        // wall, carrying an entablature and a low roof with a pediment at each end
        const colH = 0.92, ent = 0.2, rise = min(0.85, half * 0.27);
        Object.assign(b, { type: 'gable', grove: true, ext: 0, colH, ent, inset: 0.55, in: { n: 0.55, s: 0.55, w: 0.55, e: 0.55 }, wallTop: T + 0.04 + colH + ent, over: 0.1, verge: 0.1, parapet: 0, pitch: rise / half, boardTex: 'e78_marble', gableTex: 'e78_marble', ridgeTex: 'e78_marble' });
        each((x, y, nx, ny) => b.windows.push({ cx: x + 0.5 + nx * 0.5, cy: y + 0.5 + ny * 0.5, nx, ny, z0: 0.3, z1: 0.86, hw: 0.17, style: 'arch', lit: false }));
        // the front: the side the door is on; with no door, the long side with open ground that looks to the middle of the map
        { const d0 = doorList[0], cnt = (nx, ny) => { let n = 0; if (nx) { for (let y = y0; y <= y1; y++) if (open(nx < 0 ? x0 - 1 : x1 + 1, y)) n++; } else for (let x = x0; x <= x1; x++) if (open(x, ny < 0 ? y0 - 1 : y1 + 1)) n++; return n; };
          let f = null;
          if (d0) f = { nx: d0.nx, ny: d0.ny, t: d0.nx ? d0.y + 0.5 : d0.x + 0.5 };
          else { const cand = (ax ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]).map(([nx, ny]) => ({ nx, ny, n: cnt(nx, ny), toMid: nx ? nx * (W / 2 - (x0 + x1 + 1) / 2) : ny * (H / 2 - (y0 + y1 + 1) / 2) })).filter((c) => c.n >= (ax ? w : h) * 0.6).sort((a, c) => c.toMid - a.toMid)[0];
            if (cand) f = { nx: cand.nx, ny: cand.ny, t: cand.nx ? (y0 + y1 + 1) / 2 : (x0 + x1 + 1) / 2 }; }
          if (f) { const lo = (f.nx ? y0 : x0) + 1.75, hi = (f.nx ? y1 : x1) + 1 - 1.75; if (hi >= lo) { f.t = min(hi, max(lo, f.t)); b.front = f; } } }
        // the Moot-house: "a gallery of three windows over the plaza" (Book One ch. 14), on the side its door is on
        const d = doorList[0];
        if (/Moot-house/i.test(label) && d) { const tx = -d.ny, ty = d.nx, px = d.nx < 0 ? x0 + b.inset : d.nx > 0 ? x1 + 1 - b.inset : d.x + 0.5, py = d.ny < 0 ? y0 + b.inset : d.ny > 0 ? y1 + 1 - b.inset : d.y + 0.5;
          for (const k of [-1, 0, 1]) b.windows.push({ cx: px + tx * k * 1.05, cy: py + ty * k * 1.05, nx: d.nx, ny: d.ny, z0: T + 0.2, z1: T + 0.62, hw: 0.17, style: 'attic', lit: true, gallery: true }); }
      }
      b.zBase = b.wallTop + b.lift; b.ridge = b.zBase + half * b.pitch; b.wet = wet(x0, y0, x1, y1);
      houses.push(b);
    }
    // the lanes: a terrace is a strip of raised lid with a ring of wall and doors round it. The wall in front of the lid is
    // the floor of a gallery: columns along the lane, the lid's own face for its back wall, one long lead roof over all.
    const lid = (x, y) => { const c = cell(x, y); return !!c && !c.door && c.top != null && !rim(x, y); }, seenL = new Uint8Array(W * H);
    for (let y0 = 1; y0 < H - 1; y0++) for (let x0 = 1; x0 < W - 1; x0++) {
      if (seenL[y0 * W + x0] || !lid(x0, y0)) continue;
      let x1 = x0; while (lid(x1 + 1, y0)) x1++;
      let y1 = y0; const full = (yy) => { if (lid(x0 - 1, yy) || lid(x1 + 1, yy)) return false; for (let X = x0; X <= x1; X++) if (!lid(X, yy)) return false; return true; };
      while (full(y1 + 1)) y1++;
      let lidTop = 0, ring = true; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { seenL[y * W + x] = 1; lidTop = max(lidTop, cell(x, y).top); }
      const X0 = x0 - 1, X1 = x1 + 1, Y0 = y0 - 1, Y1 = y1 + 1, w = X1 - X0 + 1, h = Y1 - Y0 + 1;
      if (X0 < 1 || Y0 < 1 || X1 > W - 2 || Y1 > H - 2 || w < 6 || lidTop > 1.75) continue;
      const doorList = []; let label = '';
      for (let y = Y0; y <= Y1 && ring; y++) for (let x = X0; x <= X1; x++) { if (x > X0 && x < X1 && y > Y0 && y < Y1) continue; const c = cell(x, y); if (!c || (c.top != null && !c.door)) { ring = false; break; }
        if (c.door) { const nx = x === X0 && open(x - 1, y) ? -1 : x === X1 && open(x + 1, y) ? 1 : 0, ny = nx ? 0 : y === Y0 && open(x, y - 1) ? -1 : y === Y1 && open(x, y + 1) ? 1 : 0; if (nx || ny) doorList.push({ x, y, nx, ny }); if (c.label) label += c.label + ' '; } }
      if (!ring) continue;
      const share = (nx, ny) => { let n = 0, len = 0; if (nx) { for (let y = Y0; y <= Y1; y++) { len++; if (open(nx < 0 ? X0 - 1 : X1 + 1, y)) n++; } } else for (let x = X0; x <= X1; x++) { len++; if (open(x, ny < 0 ? Y0 - 1 : Y1 + 1)) n++; } return n / len; };
      const G = 0.988, inn = { n: share(0, -1) >= 0.6 ? G : 0, s: share(0, 1) >= 0.6 ? G : 0, w: share(-1, 0) >= 0.6 ? G : 0, e: share(1, 0) >= 0.6 ? G : 0 };
      const ax = w >= h, across = ax ? h : w, half = across / 2, T = 1, colH = 0.7, ent = 0.2, rise = min(0.85, half * 0.27);
      const b = { x0: X0, y0: Y0, x1: X1, y1: Y1, w, h, axis: ax ? 'x' : 'y', stone: false, church: false, plain: false, storeys: 2, label: label.trim(), top: T, jetty: 0, wallTex: 't_greymarble', towers: [], dome: null, ridges: 1, half, span: half,
        C: ax ? (Y0 + Y1 + 1) / 2 : (X0 + X1 + 1) / 2, A0: ax ? X0 : Y0, A1: (ax ? X1 : Y1) + 1, windows: [], doors: doorList, plinth: [], dormers: [], stacks: [], extras: [], roofTex: 'e78_lead', lift: 0.02,
        type: 'gable', grove: true, lane: true, ext: 0, colH, ent, inset: G, in: inn, wallTop: T + 0.04 + colH + ent, over: 0.1, verge: 0.1, parapet: 0, pitch: rise / half, boardTex: 'e78_marble', gableTex: 'e78_marble', ridgeTex: 'e78_marble' };
      for (const [nx, ny, along, fixed] of [[0, -1, 'x', Y0], [0, 1, 'x', Y1], [-1, 0, 'y', X0], [1, 0, 'y', X1]]) { const a0 = along === 'x' ? X0 + 1 : Y0 + 1, a1 = along === 'x' ? X1 - 1 : Y1 - 1;
        for (let a = a0; a <= a1; a++) { const x = along === 'x' ? a : fixed, y = along === 'x' ? fixed : a, c = cell(x, y), px = along === 'x' ? 1 : 0, py = along === 'x' ? 0 : 1, pa = cell(x - px, y - py), pb = cell(x + px, y + py);
          if ((a - a0) % 2 !== 0 || !c || c.door || !open(x + nx, y + ny) || (pa && pa.door) || (pb && pb.door) || (m.decals && m.decals[y * W + x])) continue;
          b.windows.push({ cx: x + 0.5 + nx * 0.5, cy: y + 0.5 + ny * 0.5, nx, ny, z0: 0.32, z1: 0.84, hw: 0.15, style: 'arch', lit: false }); } }
      b.zBase = b.wallTop + b.lift; b.ridge = b.zBase + half * b.pitch; b.wet = wet(X0, Y0, X1, Y1);
      houses.push(b);
    }
    return { houses };
  }
  // The Malting's queue-yard: the Malting is the brick range along one edge of the map. It gets the same upper storey,
  // slate roof and kiln-chimneys as in the city; only the slope over the yard is ever seen.
  function planYard(m) {
    const W = m.w, H = m.h, g = m.cells; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = g[y * W + x]; if (c && !c.door && c.tex === 't_brick') { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); } }
    if (x1 < 0 || x1 !== W - 1 || x1 - x0 < 1 || y1 - y0 < 3) return { houses: [] };
    const T = 1, w = x1 - x0 + 1, b = { x0, y0, x1, y1, w, h: y1 - y0 + 1, axis: 'y', stone: false, brick: true, church: false, plain: true, storeys: 2, label: 'The Malting', top: T, ext: 0.62, jetty: 0, wallTop: T + 0.62, wallTex: g[y0 * W + x0].tex,
      towers: [], dome: null, type: 'gable', ridges: 1, half: w, span: w, C: x1 + 1, A0: y0, A1: y1 + 1, windows: [], doors: [], plinth: [], dormers: [], stacks: [], extras: [], roofTex: 'e78_slate', lift: LIFT, pitch: 0.5, over: 0.24, verge: 0.1 };
    for (let y = y0 + 1; y < y1; y++) { const c = g[y * W + x0], up = g[(y - 1) * W + x0], dn = g[(y + 1) * W + x0];
      if ((y - y0) % 2 || !c || c.door || (up && up.door) || (dn && dn.door) || g[y * W + x0 - 1]) continue;
      b.windows.push({ cx: x0, cy: y + 0.5, nx: -1, ny: 0, z0: T + 0.14, z1: T + 0.5, hw: 0.17, style: 'cottage', lit: h2(x0 * 7 + 3, y * 13 + 1) < 0.5 }); }
    // its two kiln-chimneys, at the kiln end (the freight door's end of the range, as the yard has it)
    let kd = null; for (let y = y0; y <= y1; y++) { const c = g[y * W + x0]; if (c && c.door && /kiln|freight/i.test(c.label || '')) kd = y; }
    const ke = kd != null && kd < (y0 + y1) / 2 ? y0 + 1.4 : y1 + 1 - 1.4, ks = ke < (y0 + y1) / 2 ? 1 : -1;
    b.extras.push({ kind: 'kiln', x: x0 + 1.6, y: ke }, { kind: 'kiln', x: x0 + 1.6, y: ke + ks * 2.3 });
    b.zBase = b.wallTop + b.lift; b.ridge = b.zBase + b.span * b.pitch;
    return { houses: [b] };
  }
  const plans = new WeakMap();
  function planOf(m) { let p = plans.get(m); if (!p || p.cells !== m.cells) { p = plan(m); p.cells = m.cells; plans.set(m, p); } return p; }
  const night = () => { const t = typeof G !== 'undefined' && G && Number.isFinite(G.tod) ? G.tod : 0.5; return t < 0.27 || t > 0.76; };
  const chimneysOf = (m) => (m && m._fs && m._fs.chimneys) || [];
  function stackTop(b, x, y) { const z = roofZ(b, x, y); return z == null ? null : max(z + 0.45, b.ridge + 0.2); }

  // ---------------------------------------------------------------- where the rain stops
  let shel = null;
  function shelter(m) {
    if (!m || !MAPS.has(m.id) || !on()) return null;
    const p = planOf(m), sig = m.id + '|' + p.houses.length;
    if (shel && shel.map === m && shel.plan === p) return shel;
    const K = 4, W = m.w * K, H = m.h * K, d = new Float32Array(W * H).fill(-1e4);
    for (let cy = 0; cy < m.h; cy++) for (let cx = 0; cx < m.w; cx++) {             // inside any block it does not rain
      const c = m.cells[cy * m.w + cx]; if (!c || c.door) continue; const t = c.top != null && m.lvls ? c.top : (m.lvls ? m.lvls[cy * m.w + cx] || 0 : 0) + (c.top != null ? c.top : 1);
      for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) d[(cy * K + j) * W + cx * K + i] = t;
    }
    for (const b of p.houses) {                                                      // nor under a roof, out to the edge of its eaves
      const o = (b.over != null ? b.over : OVER) + 0.05, X0 = max(0, Math.floor((b.x0 - b.jetty - o) * K)), X1 = min(W - 1, Math.ceil((b.x1 + 1 + b.jetty + o) * K)), Y0 = max(0, Math.floor((b.y0 - b.jetty - o) * K)), Y1 = min(H - 1, Math.ceil((b.y1 + 1 + b.jetty + o) * K));
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const z = roofZ(b, (x + 0.5) / K, (y + 0.5) / K); if (z != null && z > d[y * W + x]) d[y * W + x] = z; }
      if (b.dome) { const r = 1.0 * K; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const i = (Math.floor((b.dome.y + 0.5) * K) + y) * W + Math.floor((b.dome.x + 0.5) * K) + x; if (d[i] < b.ridge + 0.4) d[i] = b.ridge + 0.4; } }
    }
    for (const q of (p.shops || [])) {                                                // nor under a shop's pentice
      const tx = -q.ny, ty = q.nx;
      for (let t = -q.hw; t <= q.hw; t += 0.2) for (let o = 0.05; o <= 0.4; o += 0.15) { const X = Math.floor((q.cx + tx * t + q.nx * o) * K), Y = Math.floor((q.cy + ty * t + q.ny * o) * K); if (X >= 0 && Y >= 0 && X < W && Y < H && d[Y * W + X] < q.z) d[Y * W + X] = q.z; }
    }
    return (shel = { map: m, plan: p, sig, k: K, w: W, h: H, data: d });
  }

  // ---------------------------------------------------------------- the tiles this needs, made from the game's own
  let texDone = false;
  function textures() {
    if (texDone || typeof Engine === 'undefined' || !Engine.textures || !Engine.textures.t_wood || !Engine.textures.t_roof) return texDone;
    const wood = Engine.textures.t_wood, roof = Engine.textures.t_roof, rgb = (r, g, b, a = 255) => ((a << 24) | (min(255, max(0, b)) | 0) << 16 | (min(255, max(0, g)) | 0) << 8 | (min(255, max(0, r)) | 0)) >>> 0;
    const px = (c, k, t) => rgb((c & 255) * k * (t ? t[0] : 1), ((c >>> 8) & 255) * k * (t ? t[1] : 1), ((c >>> 16) & 255) * k * (t ? t[2] : 1));
    const blue = new Uint32Array(4096), bronze = new Uint32Array(4096), dark = new Uint32Array(4096), shut = new Uint32Array(4096), win = new Uint32Array(4096), lit = new Uint32Array(4096), slate = new Uint32Array(4096), thatch = new Uint32Array(4096), lan = new Uint32Array(4096), lanLit = new Uint32Array(4096);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x, w = wood[i], n = h2(x >> 1, y >> 1) - 0.5;
      dark[i] = px(w, 0.5);
      // slate: the roof tile's own courses, in cold blue-grey
      { const c = roof[i], l = 0.3 * (c & 255) + 0.59 * ((c >>> 8) & 255) + 0.11 * ((c >>> 16) & 255), k = (l - 70) * 1.25 + 74 + (h2(x >> 3, y >> 4) - 0.5) * 16; slate[i] = rgb(k * 0.74, k * 0.8, k * 0.93); }
      // thatch: straw combed down the slope, in layers
      { const st = h2(x, y >> 3) * 0.26 + h2(x >> 1, (y >> 4) + 7) * 0.2, band = ((y + ((h2(x >> 3, 11) * 5) | 0)) % 21) < 2 ? 0.68 : ((y + 3) % 21) < 3 ? 1.08 : 1, k = (0.68 + st) * band * (h2(x * 3, y * 5) < 0.04 ? 0.7 : 1); thatch[i] = rgb(156 * k, 132 * k, 86 * k); }
      // a shutter: upright boards, two battens, a dark edge
      const batten = (y > 9 && y < 15) || (y > 48 && y < 54), edge = x < 2 || x > 61 || y < 2 || y > 61, gap = x % 16 === 0;
      shut[i] = px(w, edge ? 0.42 : batten ? 0.62 : gap ? 0.5 : 0.86, [0.78, 0.98, 0.82]);
      { const l = (0.3 * (w & 255) + 0.59 * ((w >>> 8) & 255) + 0.11 * ((w >>> 16) & 255)) * (edge ? 0.5 : batten ? 0.72 : gap ? 0.58 : 1) * (h2(x * 3, y >> 2) < 0.07 ? 0.75 : 1); blue[i] = rgb(l * 0.5 + 12, l * 0.7 + 22, l * 0.88 + 34); }   // sea-blue paint, salt-faded
      { const k = 0.8 + n * 0.25 + (x % 16 < 2 ? -0.2 : 0); bronze[i] = rgb(176 * k, 132 * k, 58 * k); }
      // a lancet: a pointed arch in a stone surround, leaded glass
      { const t = y < 24 ? (24 - y) / 24 : 0, hw = 19 * (1 - Math.pow(t, 1.7)), dx = abs(x - 31.5);
        if (dx > hw || y < 1) { lan[i] = 0; lanLit[i] = 0; }
        else if (dx > hw - 3.2 || y > 60) { const k = 148 + n * 22; lan[i] = rgb(k, k * 0.98, k * 0.93); lanLit[i] = rgb(k * 0.8, k * 0.76, k * 0.68); }
        else { const lead = ((x + y) % 9 === 0) || ((x - y + 64) % 9 === 0) || abs(dx) < 0.8;
          lan[i] = lead ? rgb(22, 24, 30) : rgb(40 + n * 12 + (64 - y) * 0.3, 52 + n * 12 + (64 - y) * 0.4, 70 + n * 14 + (64 - y) * 0.5);
          const core = max(0, 1 - (dx / 19) * (dx / 19) * 0.6 - abs(y - 38) / 70), tint = ((x >> 3) + (y >> 3)) % 3;
          lanLit[i] = lead ? rgb(70, 40, 16) : rgb(188 + 67 * core + (tint === 0 ? 20 : 0), 112 + 90 * core + (tint === 1 ? 14 : 0), 40 + 60 * core + (tint === 2 ? 30 : 0)); }
      }
      // a window: frame, four panes, glazing bars; a sill line at the foot
      const frame = x < 7 || x > 56 || y < 7 || y > 55, bar = abs(x - 31.5) < 2.2 || abs(y - 30.5) < 2.2, innr = x < 9 || x > 54 || y < 9 || y > 53;
      if (frame || bar) { const k = y > 55 ? 0.95 : frame ? 0.7 : 0.6; win[i] = px(w, k); lit[i] = px(w, k * 0.8); continue; }
      const glint = abs((x - y * 0.8) - 6) < 3 || abs((x - y * 0.8) - 20) < 1.4, sh = innr ? 0.7 : 1;
      win[i] = rgb((38 + n * 10 + (glint ? 34 : 0) + (64 - y) * 0.35) * sh, (48 + n * 10 + (glint ? 38 : 0) + (64 - y) * 0.45) * sh, (62 + n * 12 + (glint ? 40 : 0) + (64 - y) * 0.5) * sh);
      const ex = (x - 32) / 26, ey = (y - 34) / 26, core = max(0, 1 - (ex * ex + ey * ey) * 0.55), curtain = (x < 18 || x > 45) && y < 40 ? 0.72 : 1;
      lit[i] = rgb((176 + 79 * core + n * 14) * sh * curtain, (112 + 96 * core + n * 12) * sh * curtain, (38 + 70 * core) * sh * curtain);
    }
    for (const [name, d] of [['e78_shutter_blue', blue], ['e78_bronze', bronze], ['e78_dark', dark], ['e78_shutter', shut], ['e78_win', win], ['e78_winlit', lit], ['e78_slate', slate], ['e78_thatch', thatch], ['e78_lancet', lan], ['e78_lancetlit', lanLit]]) Engine.addTexture(name, d);
    return (texDone = true);
  }

  // Whisper-Grove's: a clean pale marble for the trim, a fluted one for columns, lead for the roofs, a tall arched window
  function groveTextures() {
    if (typeof Engine === 'undefined' || !Engine.textures || Engine.textures.e78_lead || !Engine.textures.t_greymarble) return;
    const rgb = (r, g, b, a = 255) => ((a << 24) | (min(255, max(0, b)) | 0) << 16 | (min(255, max(0, g)) | 0) << 8 | (min(255, max(0, r)) | 0)) >>> 0;
    const src = Engine.textures.t_greymarble, marble = new Uint32Array(4096), flute = new Uint32Array(4096), lead = new Uint32Array(4096), arch = new Uint32Array(4096), lilac = new Uint32Array(4096), fluteLilac = new Uint32Array(4096);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = y * 64 + x, c = src[i], l = 0.3 * (c & 255) + 0.59 * ((c >>> 8) & 255) + 0.11 * ((c >>> 16) & 255), n = h2(x >> 1, y >> 1) - 0.5;
      const vein = h2((x + y * 2) >> 3, (y - x) >> 4) < 0.16 ? -10 : 0, m = min(246, 206 + (l - 110) * 0.4 + n * 10 + vein);                // white marble, faintly veined
      marble[i] = rgb(m * 0.97, m, m * 0.99);
      const fl = 0.78 + 0.22 * Math.cos((x % 8) / 8 * 2 * PI), f = m * fl;                                                                   // eight flutes to the tile
      flute[i] = rgb(f * 0.97, f, f);
      // the same stone after dusk, lit from the water underneath ("the whole square glowed from underneath"): a cold lilac, strongest low down
      { const up = 0.5 + 0.5 * (y / 63), g2 = m / 230; lilac[i] = rgb(74 * g2, 60 * g2, 112 * g2); fluteLilac[i] = rgb(92 * g2 * fl * up, 74 * g2 * fl * up, 138 * g2 * fl * up); }
      const seam = x % 16 === 0 ? 0.62 : x % 16 === 1 ? 1.12 : 1, lap = y % 32 === 0 ? 0.74 : 1, bloom = h2(x >> 3, y >> 3) < 0.22 ? 1 : 0, k = (118 + n * 14) * seam * lap;
      lead[i] = rgb(k * (bloom ? 0.88 : 0.96), k * (bloom ? 1.04 : 1.0), k * (bloom ? 1.0 : 1.05));                                           // lead sheet, standing seams, a green bloom
      // a tall window with a round head: a marble surround, a dark opening, one bar at the springing
      const t = y < 20 ? (20 - y) / 20 : 0, hw = 22 * Math.sqrt(max(0, 1 - t * t)), dx = abs(x - 31.5);
      if (dx > hw || y < 1) arch[i] = 0;
      else if (dx > hw - 4 || y > 59) { const k2 = 208 + n * 16 - (y > 59 ? 26 : 0); arch[i] = rgb(k2 * 0.97, k2, k2); }
      else { const bar = abs(y - 21) < 1.2 || dx < 0.9, sh = (64 - y) * 0.18; arch[i] = bar ? rgb(60, 66, 72) : rgb(14 + n * 6 + sh * 0.5, 20 + n * 6 + sh * 0.7, 30 + n * 8 + sh); }
    }
    for (const [name, d] of [['e78_marble', marble], ['e78_flute', flute], ['e78_lead', lead], ['e78_arch', arch], ['e78_marble_lilac', lilac], ['e78_flute_lilac', fluteLilac]]) Engine.addTexture(name, d);
  }
  // Port Cantabile's: lime-wash without the damp line at its foot (for gables), and a pale coping stone
  function harbourTextures() {
    if (typeof Engine === 'undefined' || !Engine.textures || Engine.textures.e78_cope || !Engine.textures.p17c_plaster) return;
    const rgb = (r, g, b) => ((255 << 24) | (min(255, max(0, b)) | 0) << 16 | (min(255, max(0, g)) | 0) << 8 | (min(255, max(0, r)) | 0)) >>> 0;
    for (const v of ['', '2', '3']) { const src = Engine.textures['p17c_plaster' + v]; if (!src) continue; const d = new Uint32Array(4096);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) d[y * 64 + x] = src[(y < 44 ? y : 87 - y) * 64 + x];      // the foot of the tile mirrors back up: no band, no seam
      Engine.addTexture('e78_lime' + v, d); }
    const cope = new Uint32Array(4096);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const k = (0.9 + (h2(x >> 1, y >> 1) - 0.5) * 0.16 + (h2(x >> 3, y >> 3) - 0.5) * 0.1) * (x % 21 === 0 ? 0.7 : 1) * (h2(x * 5, y * 3) < 0.03 ? 0.82 : 1); cope[y * 64 + x] = rgb(170 * k, 168 * k, 156 * k); }
    Engine.addTexture('e78_cope', cope);
  }

  // ---------------------------------------------------------------- geometry, into the renderer's own mesh
  // h: { B (the mesh builder), tex(name) -> layer, MAT, ZK }. Returns the triangles added.
  function build(m, h) {
    if (!on() || !m || !MAPS.has(m.id) || !textures()) return 0;
    harbourTextures(); groveTextures();
    const B = h.B, MAT = h.MAT, ZK = h.ZK, dusk = night(); let tris = 0;
    const unit = (x, y, z) => { const l = hyp(x, y, z) || 1; return [x / l, y / l, z / l]; };
    // the normal of a plane through three points (in the renderer's space, where heights are scaled), turned to face `toward`
    const planeN = (p, q, r, toward) => { const ux = q[0] - p[0], uy = q[1] - p[1], uz = (q[2] - p[2]) * ZK, vx = r[0] - p[0], vy = r[1] - p[1], vz = (r[2] - p[2]) * ZK; let n = unit(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) n = [-n[0], -n[1], -n[2]]; return n; };
    const quad = (p, uv, L, mat, side, n) => { const v = p.map((q, i) => B.vert(q[0], q[1], q[2], uv[i][0], uv[i][1], L, -1, mat, side, n[0], n[1], n[2])); B.quad(v[0], v[1], v[2], v[3]); tris += 2; };
    const tri = (p, uv, L, mat, side, n) => { const v = p.map((q, i) => B.vert(q[0], q[1], q[2], uv[i][0], uv[i][1], L, -1, mat, side, n[0], n[1], n[2])); B.quad(v[0], v[1], v[2], v[2]); tris += 1; };
    const UP = [0, 0, 1], DN = [0, 0, -1];
    const L_ = (n) => h.tex(Engine.textures[n] ? n : 't_stone');
    const Ldark = L_('e78_dark'), Lshut = L_('e78_shutter'), Lwin = L_('e78_win'), Llit = L_('e78_winlit'), Lstone = L_('t_stone'), Llan = L_('e78_lancet'), LlanLit = L_('e78_lancetlit'), Lbrick = L_('t_house_p20b_2'), Lblue = L_('e78_shutter_blue'), Lbronze = L_('e78_bronze'), Liron = L_(Engine.textures.p17c_shutter ? 'p17c_shutter' : 'e78_dark');
    // a box standing on z0 (four sides and a top)
    const box = (x0, y0, x1, y1, z0, z1, L, Ltop, sideK = 1) => {
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, z1 - z0], [x1, z1 - z0], [x1, 0], [x0, 0]], L, MAT.wall, 0.8 * sideK, [0, -1, 0]);
      quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [[x0, z1 - z0], [x1, z1 - z0], [x1, 0], [x0, 0]], L, MAT.wall, 0.8 * sideK, [0, 1, 0]);
      quad([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [[y0, z1 - z0], [y1, z1 - z0], [y1, 0], [y0, 0]], L, MAT.wall, sideK, [-1, 0, 0]);
      quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[y0, z1 - z0], [y1, z1 - z0], [y1, 0], [y0, 0]], L, MAT.wall, sideK, [1, 0, 0]);
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Ltop, MAT.wall, 1.1 * sideK, UP);
    };
    // an opening on a wall plane
    const opening = (w) => {
      const tx = -w.ny, ty = w.nx, n = [w.nx, w.ny, 0], side = w.nx ? 1 : 0.8, hw = w.hw, z0 = w.z0, z1 = w.z1, glow = dusk && w.lit, stoneSill = w.style === 'hall' || w.style === 'lancet', small = w.style === 'attic' || w.style === 'dormer';
      const at = (t, off, z) => [w.cx + tx * t + w.nx * off, w.cy + ty * t + w.ny * off, z];
      const sill = (d, th) => { quad([at(-hw - 0.04, d, z0 - th), at(hw + 0.04, d, z0 - th), at(hw + 0.04, d, z0), at(-hw - 0.04, d, z0)], [[0, 0.1], [0.6, 0.1], [0.6, 0], [0, 0]], stoneSill ? Lstone : Ldark, MAT.wall, side * 1.25, n);
        quad([at(-hw - 0.04, 0.012, z0), at(hw + 0.04, 0.012, z0), at(hw + 0.04, d, z0), at(-hw - 0.04, d, z0)], [[0, 0], [0.6, 0], [0.6, 0.1], [0, 0.1]], stoneSill ? Lstone : Ldark, MAT.wall, 1.5, UP); };
      if (w.style === 'hatch') {                                 // a boarded hatch: two shutters closed over the opening
        for (const sgn of [-1, 1]) quad([at(sgn * 0.005, 0.016, z0), at(sgn * hw, 0.016, z0), at(sgn * hw, 0.016, z1), at(sgn * 0.005, 0.016, z1)], [[0, 1], [1, 1], [1, 0], [0, 0]], Lshut, MAT.wall, side * 0.92, n);
        sill(0.05, 0.04); return;
      }
      if (w.style === 'iron') { quad([at(-hw, 0.016, z0), at(hw, 0.016, z0), at(hw, 0.016, z1), at(-hw, 0.016, z1)], [[0.1, 0.9], [0.9, 0.9], [0.9, 0.1], [0.1, 0.1]], Liron, MAT.wall, side * 0.95, n);
        quad([at(-hw - 0.04, 0.05, z0 - 0.05), at(hw + 0.04, 0.05, z0 - 0.05), at(hw + 0.04, 0.05, z0), at(-hw - 0.04, 0.05, z0)], [[0, 0.1], [0.6, 0.1], [0.6, 0], [0, 0]], Lstone, MAT.wall, side * 1.2, n);
        quad([at(-hw - 0.04, 0.012, z0), at(hw + 0.04, 0.012, z0), at(hw + 0.04, 0.05, z0), at(-hw - 0.04, 0.05, z0)], [[0, 0], [0.6, 0], [0.6, 0.1], [0, 0.1]], Lstone, MAT.wall, 1.4, UP); return; }
      if (w.style === 'loft') { quad([at(-hw, 0.016, z0), at(hw, 0.016, z0), at(hw, 0.016, z1), at(-hw, 0.016, z1)], [[0, 1], [1, 1], [1, 0], [0, 0]], Lblue, MAT.wall, side * 0.9, n); sill(0.07, 0.04); return; }
      if (w.style === 'arch') { quad([at(-hw, 0.014, z0), at(hw, 0.014, z0), at(hw, 0.014, z1), at(-hw, 0.014, z1)], [[0.02, 1], [0.98, 1], [0.98, 0], [0.02, 0]], L_('e78_arch'), MAT.wall, side + 10, n); return; }
      if (w.style === 'lancet') { quad([at(-hw, 0.014, z0), at(hw, 0.014, z0), at(hw, 0.014, z1), at(-hw, 0.014, z1)], [[0.02, 1], [0.98, 1], [0.98, 0], [0.02, 0]], glow ? LlanLit : Llan, glow ? MAT.glow : MAT.wall, side + 10, n); sill(0.05, 0.05); return; }
      const v1 = w.style === 'hall' ? 2 : 1;
      quad([at(-hw, 0.014, z0), at(hw, 0.014, z0), at(hw, 0.014, z1), at(-hw, 0.014, z1)], [[0, v1], [1, v1], [1, 0], [0, 0]], glow ? Llit : Lwin, glow ? MAT.glow : MAT.wall, side, n);
      sill(small ? 0.035 : 0.06, small ? 0.03 : 0.045);
      if (w.style === 'cottage') for (const sgn of [-1, 1]) { const i0 = sgn * (hw + 0.012), i1 = sgn * (hw + 0.2);      // shutters, standing a little open
        quad([at(i0, 0.02, z0 + 0.01), at(i1, 0.075, z0 + 0.01), at(i1, 0.075, z1 - 0.01), at(i0, 0.02, z1 - 0.01)], [[0, 1], [1, 1], [1, 0], [0, 0]], w.shut === 'blue' ? Lblue : Lshut, MAT.wall, side, unit(w.nx - tx * sgn * 0.28, w.ny - ty * sgn * 0.28, 0)); }
    };

    for (const b of planOf(m).houses) {
      const ax = b.axis === 'x', Lroof = L_(b.roofTex), Lwall = L_(b.wallTex), lime = b.gableTex || (b.harbour && !b.stone ? b.wallTex.replace('p17c_plaster', 'e78_lime') : null), Lgab = lime && Engine.textures[lime] ? L_(lime) : Lwall, Lridge = b.ridgeTex ? L_(b.ridgeTex) : Ldark, Lboard = b.boardTex ? L_(b.boardTex) : b.stone ? Lstone : Ldark, OVER = b.over != null ? b.over : OVER0, VERGE = b.verge != null ? b.verge : VERGE0, par = b.parapet || 0, p = b.pitch, C = b.C, A0 = b.A0, A1 = b.A1, zB = b.zBase, top = b.top, wt = b.wallTop;
      const P = (a, s, z) => ax ? [a, C + s, z] : [C + s, a, z], N = (na, ns) => ax ? [na, ns, 0] : [ns, na, 0];
      // ---- the upper wall: a jettied storey, or a stone hall's cornice
      if (b.ext > 0) {
        const j = b.jetty || b.skin || 0, X0 = b.x0 - j, X1 = b.x1 + 1 + j, Y0 = b.y0 - j, Y1 = b.y1 + 1 + j, e = b.ext;
        quad([[X0, Y0, top], [X1, Y0, top], [X1, Y0, wt], [X0, Y0, wt]], [[X1, e], [X0, e], [X0, 0], [X1, 0]], Lgab, MAT.wall, 0.8, [0, -1, 0]);
        quad([[X0, Y1, top], [X1, Y1, top], [X1, Y1, wt], [X0, Y1, wt]], [[X0, e], [X1, e], [X1, 0], [X0, 0]], Lgab, MAT.wall, 0.8, [0, 1, 0]);
        quad([[X0, Y0, top], [X0, Y1, top], [X0, Y1, wt], [X0, Y0, wt]], [[Y0, e], [Y1, e], [Y1, 0], [Y0, 0]], Lgab, MAT.wall, 1, [-1, 0, 0]);
        quad([[X1, Y0, top], [X1, Y1, top], [X1, Y1, wt], [X1, Y0, wt]], [[Y1, e], [Y0, e], [Y0, 0], [Y1, 0]], Lgab, MAT.wall, 1, [1, 0, 0]);
        const band = (z0, z1, o, L, k) => { quad([[X0 - o, Y0 - o, z0], [X1 + o, Y0 - o, z0], [X1 + o, Y0 - o, z1], [X0 - o, Y0 - o, z1]], [[X0, 0.1], [X1, 0.1], [X1, 0], [X0, 0]], L, MAT.wall, 0.8 * k, [0, -1, 0]);
          quad([[X0 - o, Y1 + o, z0], [X1 + o, Y1 + o, z0], [X1 + o, Y1 + o, z1], [X0 - o, Y1 + o, z1]], [[X0, 0.1], [X1, 0.1], [X1, 0], [X0, 0]], L, MAT.wall, 0.8 * k, [0, 1, 0]);
          quad([[X0 - o, Y0 - o, z0], [X0 - o, Y1 + o, z0], [X0 - o, Y1 + o, z1], [X0 - o, Y0 - o, z1]], [[Y0, 0.1], [Y1, 0.1], [Y1, 0], [Y0, 0]], L, MAT.wall, k, [-1, 0, 0]);
          quad([[X1 + o, Y0 - o, z0], [X1 + o, Y1 + o, z0], [X1 + o, Y1 + o, z1], [X1 + o, Y0 - o, z1]], [[Y0, 0.1], [Y1, 0.1], [Y1, 0], [Y0, 0]], L, MAT.wall, k, [1, 0, 0]); };
        if (b.harbour) { /* plain lime-wash to the eaves */ } else if (j > 0) {                                             // the jetty: its underside and the beam it sits on
          quad([[X0, Y0, top - 0.05], [X1, Y0, top - 0.05], [X1, Y1, top - 0.05], [X0, Y1, top - 0.05]], [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], Ldark, MAT.wall, 0.55, DN);
          band(top - 0.05, top + 0.055, 0.012, Ldark, 0.95);
        } else { band(wt - 0.07, wt + 0.03, 0.03, Lstone, 1.12); quad([[X0 - 0.03, Y0 - 0.03, wt + 0.03], [X1 + 0.03, Y0 - 0.03, wt + 0.03], [X1 + 0.03, Y1 + 0.03, wt + 0.03], [X0 - 0.03, Y1 + 0.03, wt + 0.03]], [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], Lstone, MAT.wall, 1.2, UP); }
      }
      // ---- Whisper-Grove: the upper storey is an open colonnade round a set-back wall, under an entablature
      if (b.grove) {
        const lit = dusk && b.wet, Lm = L_('e78_marble'), Lf = L_(lit ? 'e78_flute_lilac' : 'e78_flute'), Lsof = L_(lit ? 'e78_marble_lilac' : 'e78_marble'), GL = lit ? MAT.glow : MAT.wall, X0 = b.x0, X1 = b.x1 + 1, Y0 = b.y0, Y1 = b.y1 + 1, zs = top + 0.04, zc = zs + b.colH, zt = wt, IN = b.in, CI = 0.17, lg = { n: IN.n > 0.3, s: IN.s > 0.3, w: IN.w > 0.3, e: IN.e > 0.3 };
        box(X0 - 0.035, Y0 - 0.035, X1 + 0.035, Y1 + 0.035, top - 0.05, zs, Lm, Lm, 1.1);                      // the string course, and the colonnade's floor
        box(X0 + IN.w, Y0 + IN.n, X1 - IN.e, Y1 - IN.s, zs, zc, Lwall, Lwall, 0.74);                         // the wall behind the columns, in shadow (flush where there is no colonnade)
        quad([[X0, Y0, zc], [X1, Y0, zc], [X1, Y1, zc], [X0, Y1, zc]], [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], Lsof, GL, lit ? 1 : 0.5, DN);   // the soffit: after dusk it takes the water's light
        box(X0 - 0.03, Y0 - 0.03, X1 + 0.03, Y1 + 0.03, zc, zt - 0.05, Lm, Lm, 1.05);                         // the entablature
        box(X0 - 0.09, Y0 - 0.09, X1 + 0.09, Y1 + 0.09, zt - 0.05, zt, Lm, Lm, 1.18);                         // its cornice
        quad([[X0 - 0.09, Y0 - 0.09, zt - 0.05], [X1 + 0.09, Y0 - 0.09, zt - 0.05], [X1 + 0.09, Y1 + 0.09, zt - 0.05], [X0 - 0.09, Y1 + 0.09, zt - 0.05]], [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], Lm, MAT.wall, 0.62, DN);
        const column = (cx, cy) => { const r0 = 0.092, r1 = 0.077, zb = zs + 0.05, zk = zc - 0.065;
          box(cx - 0.115, cy - 0.115, cx + 0.115, cy + 0.115, zs, zb, Lm, Lm, 1.05);
          for (let i = 0; i < 6; i++) { const t0 = i / 6 * 2 * PI, t1 = (i + 1) / 6 * 2 * PI, c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1), nm = unit(c0 + c1, s0 + s1, 0);
            quad([[cx + c0 * r0, cy + s0 * r0, zb], [cx + c1 * r0, cy + s1 * r0, zb], [cx + c1 * r1, cy + s1 * r1, zk], [cx + c0 * r1, cy + s0 * r1, zk]], [[i * 0.25, 0.98], [(i + 1) * 0.25, 0.98], [(i + 1) * 0.25, 0.02], [i * 0.25, 0.02]], Lf, GL, lit ? 1 : 0.82 + 0.3 * abs(nm[0]), nm); }
          box(cx - 0.12, cy - 0.12, cx + 0.12, cy + 0.12, zk, zc, Lm, Lm, 1.1); };
        const row = (n, f) => { for (let i = 0; i <= n; i++) f(i / n); }, nx_ = max(2, Math.round((X1 - X0 - 2 * CI) / 0.85)), ny_ = max(2, Math.round((Y1 - Y0 - 2 * CI) / 0.85));
        row(nx_, (t) => { const x = X0 + CI + t * (X1 - X0 - 2 * CI); if (lg.n) column(x, Y0 + CI); if (lg.s) column(x, Y1 - CI); });
        for (let i = 0; i <= ny_; i++) { const y = Y0 + CI + i / ny_ * (Y1 - Y0 - 2 * CI), first = i === 0, last = i === ny_;
          if (lg.w && !(first && lg.n) && !(last && lg.s)) column(X0 + CI, y); if (lg.e && !(first && lg.n) && !(last && lg.s)) column(X1 - CI, y); }
        // marble finials: one on each corner of the cornice, one over the point of each pediment
        const finial = (fx, fy, z) => { box(fx - 0.09, fy - 0.09, fx + 0.09, fy + 0.09, z - 0.04, z + 0.12, Lm, Lm, 1.15); box(fx - 0.05, fy - 0.05, fx + 0.05, fy + 0.05, z + 0.12, z + 0.19, Lm, Lm, 1.05);
          const r = 0.085, zb = z + 0.19, zp = z + 0.56, tip = [fx, fy, zp], q = [[fx - r, fy - r, zb], [fx + r, fy - r, zb], [fx + r, fy + r, zb], [fx - r, fy + r, zb]];
          for (let i = 0; i < 4; i++) { const p0 = q[i], p1 = q[(i + 1) % 4], nm = i === 0 ? [0, -1, 0.3] : i === 1 ? [1, 0, 0.3] : i === 2 ? [0, 1, 0.3] : [-1, 0, 0.3]; tri([p0, p1, tip], [[0, 0.3], [0.15, 0.3], [0.075, 0]], Lm, MAT.wall, i % 2 ? 1.25 : 1.05, unit(nm[0], nm[1], nm[2])); } };
        for (const [fx, fy] of [[X0 - 0.02, Y0 - 0.02], [X1 + 0.02, Y0 - 0.02], [X0 - 0.02, Y1 + 0.02], [X1 + 0.02, Y1 + 0.02]]) finial(fx, fy, zt + 0.02);
        for (const a of [A0 - 0.02, A1 + 0.02]) { const q = P(a, 0, b.ridge); finial(q[0], q[1], b.ridge); }
        // the front: a pediment standing on the cornice over the middle of it, its own small roof running back into the main one
        if (b.front) { const f = b.front, tx = -f.ny, ty = f.nx, ex = f.nx < 0 ? X0 : f.nx > 0 ? X1 : f.t, ey = f.ny < 0 ? Y0 : f.ny > 0 ? Y1 : f.t, hw = 1.7, hh = 0.62, side = f.nx ? 1 : 0.8, n = [f.nx, f.ny, 0];
          const at = (t, off, z) => [ex + tx * t + f.nx * off, ey + ty * t + f.ny * off, z], back = min(b.half, (hh - 0.02) / b.pitch + 0.1);
          tri([at(-hw, 0.05, zt), at(hw, 0.05, zt), at(0, 0.05, zt + hh)], [[0, hh], [hw * 2, hh], [hw, 0]], Lm, MAT.wall, side * 1.08, n);
          for (const sgn of [-1, 1]) { const e0 = at(sgn * (hw + 0.08), 0.12, zt - 0.02), e1 = at(0, 0.12, zt + hh + 0.03), e2 = at(0, -back, zt + hh + 0.03), up = planeN(e0, e1, e2, UP);
            tri([e0, e1, e2], [[0, 1.8], [0, 0], [back, 0]], Lroof, MAT.wall, sgn < 0 ? 1 : 0.86, up);
            const r0 = at(sgn * (hw + 0.08), 0.12, zt - 0.02), r1 = at(0, 0.12, zt + hh + 0.03), r2 = at(0, 0.12, zt + hh - 0.06), r3 = at(sgn * (hw + 0.08), 0.12, zt - 0.11);
            quad([r0, r1, r2, r3], [[0, 0], [1.8, 0], [1.8, 0.09], [0, 0.09]], Lm, MAT.wall, side * 1.2, n); }
          const q = at(0, 0.05, 0); finial(q[0], q[1], zt + hh + 0.02); }
        // a door-case: two pilasters and a small pediment standing on the string course
        for (const d of b.doors) { const tx = -d.ny, ty = d.nx, cx = d.x + 0.5 + d.nx * 0.5, cy = d.y + 0.5 + d.ny * 0.5, side = d.nx ? 1 : 0.8, n = [d.nx, d.ny, 0];
          const at = (t, off, z) => [cx + tx * t + d.nx * off, cy + ty * t + d.ny * off, z];
          for (const sgn of [-1, 1]) { const t0 = sgn * 0.55, t1 = sgn * 0.69;
            quad([at(min(t0, t1), 0.07, 0), at(max(t0, t1), 0.07, 0), at(max(t0, t1), 0.07, top - 0.05), at(min(t0, t1), 0.07, top - 0.05)], [[0, 0.95], [0.25, 0.95], [0.25, 0], [0, 0]], Lf, MAT.wall, side * 1.12, n);
            for (const tt of [t0, t1]) quad([at(tt, 0, 0), at(tt, 0.07, 0), at(tt, 0.07, top - 0.05), at(tt, 0, top - 0.05)], [[0, 0.95], [0.07, 0.95], [0.07, 0], [0, 0]], Lm, MAT.wall, side * 0.8, [tx * Math.sign(tt), ty * Math.sign(tt), 0]); }
          quad([at(-0.8, 0.1, zs), at(0.8, 0.1, zs), at(0.8, 0.1, zs + 0.06), at(-0.8, 0.1, zs + 0.06)], [[0, 0.06], [1.6, 0.06], [1.6, 0], [0, 0]], Lm, MAT.wall, side * 1.15, n);
          tri([at(-0.8, 0.1, zs + 0.06), at(0.8, 0.1, zs + 0.06), at(0, 0.1, zs + 0.36)], [[0, 0.3], [1.6, 0.3], [0.8, 0]], Lm, MAT.wall, side * 1.05, n);
          quad([at(-0.8, 0.0, zs), at(0.8, 0.0, zs), at(0.8, 0.1, zs), at(-0.8, 0.1, zs)], [[0, 0], [1.6, 0], [1.6, 0.1], [0, 0.1]], Lm, MAT.wall, 0.6, DN);
          for (const sgn of [-1, 1]) { const e0 = at(sgn * 0.8, 0.1, zs + 0.06), e1 = at(0, 0.1, zs + 0.36), e2 = at(0, -0.04, zs + 0.36), e3 = at(sgn * 0.8, -0.04, zs + 0.06); quad([e0, e1, e2, e3], [[0, 0], [0.85, 0], [0.85, 0.14], [0, 0.14]], Lm, MAT.wall, 1.2, planeN(e0, e1, e2, UP)); } }
      }
      // ---- the roof
      if (b.type === 'gable') {
        const a0 = A0 - VERGE, a1 = A1 + VERGE, span = b.span, centres = b.ridges === 2 ? [-span, span] : [0];
        for (const cs of centres) {
          const zr = zB + span * p;
          for (const sg of [-1, 1]) {
            const inner = b.ridges === 2 && sg * cs < 0, over = inner ? 0 : OVER, se = span + over, ze = zB - over * p, sl = hyp(se, se * p), up = planeN(P(a0, cs + sg * se, ze), P(a1, cs + sg * se, ze), P(a1, cs, zr), UP), side = sg < 0 ? 1 : 0.86;
            quad([P(a0, cs + sg * se, ze), P(a1, cs + sg * se, ze), P(a1, cs, zr), P(a0, cs, zr)], [[a0, sl], [a1, sl], [a1, 0], [a0, 0]], Lroof, MAT.wall, side, up);
            quad([P(a0, cs + sg * se, ze - 0.012), P(a1, cs + sg * se, ze - 0.012), P(a1, cs, zr - 0.012), P(a0, cs, zr - 0.012)], [[a0, sl], [a1, sl], [a1, 0], [a0, 0]], Ldark, MAT.wall, 0.6, [-up[0], -up[1], -up[2]]);
            if (!inner) quad([P(a0, cs + sg * se, ze + 0.012), P(a1, cs + sg * se, ze + 0.012), P(a1, cs + sg * se, ze - 0.075), P(a0, cs + sg * se, ze - 0.075)], [[a0, 0], [a1, 0], [a1, 0.09], [a0, 0.09]], Lboard, MAT.wall, 0.9, N(0, sg));
            if (!par) for (const [a, na] of [[a0, -1], [a1, 1]]) quad([P(a, cs + sg * se, ze + 0.014), P(a, cs, zr + 0.014), P(a, cs, zr - 0.1), P(a, cs + sg * se, ze - 0.1)], [[0, 0], [sl, 0], [sl, 0.11], [0, 0.11]], Lboard, MAT.wall, 0.85, N(na, 0));
            quad([P(a0, cs + sg * 0.07, zr - 0.07 * p + 0.016), P(a1, cs + sg * 0.07, zr - 0.07 * p + 0.016), P(a1, cs, zr + 0.022), P(a0, cs, zr + 0.022)], [[a0, 0.1], [a1, 0.1], [a1, 0], [a0, 0]], Lridge, MAT.wall, sg < 0 ? 1.15 : 1, up);   // the ridge course
          }
          // the gable ends: the wall carried up to the ridge
          for (const [a, na] of [[A0, -1], [A1, 1]]) {
            const u = (s) => (ax ? (na > 0 ? C + s : -(C + s)) : (na > 0 ? -(C + s) : C + s)), sk = ax ? 1 : 0.8;
            if (par) {                                           // a raised gable: the wall stands above the slates, capped in stone
              const ai = a - na * 0.16, hs = span + 0.03, w0 = b.backFrom != null && na < 0 ? b.backFrom : wt, ag = b.backFrom != null && na < 0 ? a - 0.006 : a;
              quad([P(ag, cs - hs, w0), P(ag, cs + hs, w0), P(ag, cs + hs, zB + par), P(ag, cs - hs, zB + par)], [[u(cs - hs), 0], [u(cs + hs), 0], [u(cs + hs), -(zB + par - w0)], [u(cs - hs), -(zB + par - w0)]], Lgab, MAT.wall, sk, N(na, 0));
              tri([P(ag, cs - hs, zB + par), P(ag, cs + hs, zB + par), P(ag, cs, zr + par)], [[u(cs - hs), -(zB + par - w0)], [u(cs + hs), -(zB + par - w0)], [u(cs), -(zr + par - w0)]], Lgab, MAT.wall, sk, N(na, 0));
              for (const sg of [-1, 1]) {
                quad([P(ai, cs + sg * hs, zB - 0.02), P(ai, cs, zr - 0.02), P(ai, cs, zr + par), P(ai, cs + sg * hs, zB + par)], [[0, par], [hs, par], [hs, 0], [0, 0]], Lgab, MAT.wall, sk * 0.85, N(-na, 0));
                const c0 = P(a + na * 0.02, cs + sg * (hs + 0.02), zB + par), c1 = P(a + na * 0.02, cs, zr + par + 0.015), c2 = P(ai - na * 0.02, cs, zr + par + 0.015), c3 = P(ai - na * 0.02, cs + sg * (hs + 0.02), zB + par);
                quad([c0, c1, c2, c3], [[0, 0], [hs, 0], [hs, 0.2], [0, 0.2]], Lboard, MAT.wall, sg < 0 ? 1.25 : 1.1, planeN(c0, c1, c2, UP));
                quad([P(a, cs + sg * hs, zB - 0.05), P(ai, cs + sg * hs, zB - 0.05), P(ai, cs + sg * hs, zB + par), P(a, cs + sg * hs, zB + par)], [[0, 0.2], [0.16, 0.2], [0.16, 0], [0, 0]], Lboard, MAT.wall, 0.95, N(0, sg));
                // the coping seen from the quay: a stone band down the rake, and a kneeler where it lands
                const ao = a + na * 0.03, bw = 0.085;
                quad([P(ao, cs + sg * (hs + 0.03), zB + par - bw), P(ao, cs, zr + par - bw), P(ao, cs, zr + par + 0.015), P(ao, cs + sg * (hs + 0.03), zB + par)], [[0, 0.14], [hs, 0.14], [hs, 0], [0, 0]], Lboard, MAT.wall, 1.2, N(na, 0));
                const k0 = P(ao, cs + sg * (hs + 0.05), zB + par - 0.2), k1 = P(ao, cs + sg * (hs - 0.14), zB + par - 0.2), k2 = P(ao, cs + sg * (hs - 0.14), zB + par + 0.02), k3 = P(ao, cs + sg * (hs + 0.05), zB + par + 0.02);
                quad([k0, k1, k2, k3], [[0, 0.22], [0.2, 0.22], [0.2, 0], [0, 0]], Lboard, MAT.wall, 1.25, N(na, 0));
              }
              continue;
            }
            if (zB > wt + 1e-4) quad([P(a, cs - span, wt), P(a, cs + span, wt), P(a, cs + span, zB), P(a, cs - span, zB)], [[u(cs - span), 0], [u(cs + span), 0], [u(cs + span), -(zB - wt)], [u(cs - span), -(zB - wt)]], Lgab, MAT.wall, sk, N(na, 0));
            tri([P(a, cs - span, zB), P(a, cs + span, zB), P(a, cs, zr - 0.02)], [[u(cs - span), -(zB - wt)], [u(cs + span), -(zB - wt)], [u(cs), -(zr - 0.02 - wt)]], Lgab, MAT.wall, sk, N(na, 0));
          }
        }
        if (b.ridges === 2) quad([P(a0, -0.06, zB + 0.06 * p + 0.01), P(a1, -0.06, zB + 0.06 * p + 0.01), P(a1, 0.06, zB + 0.06 * p + 0.01), P(a0, 0.06, zB + 0.06 * p + 0.01)], [[a0, 0], [a1, 0], [a1, 0.1], [a0, 0.1]], Ldark, MAT.wall, 0.7, UP);   // the lead of the valley
        // dormers
        for (const d of b.dormers) {
          const sA = (dd) => d.cs + d.sg * dd, zR = (dd) => zB + (span - dd) * p, f = (d.f || 0.55) * span, zf = zR(f), dw = 0.27, ze = zf + 0.32, zd = ze + 0.17, de = span - (ze - zB) / p, dr = max(0.03, span - (zd - zB) / p), a = d.a, out = N(0, d.sg);
          quad([P(a - dw, sA(f), zf), P(a + dw, sA(f), zf), P(a + dw, sA(f), ze), P(a - dw, sA(f), ze)], [[0, 0.32], [0.54, 0.32], [0.54, 0], [0, 0]], Lwall, MAT.wall, 0.95, out);
          tri([P(a - dw, sA(f), ze), P(a + dw, sA(f), ze), P(a, sA(f), zd)], [[0, 0], [0.54, 0], [0.27, -0.17]], Lwall, MAT.wall, 0.95, out);
          for (const k of [-1, 1]) {
            tri([P(a + k * dw, sA(f), zf), P(a + k * dw, sA(f), ze), P(a + k * dw, sA(de), ze)], [[0, 0.32], [0, 0], [f - de, 0]], Lwall, MAT.wall, 0.8, N(k, 0));
            const e0 = P(a + k * (dw + 0.07), sA(f + 0.08), ze - 0.04), r0 = P(a, sA(f + 0.08), zd), r1 = P(a, sA(dr), zd), e1 = P(a + k * (dw + 0.07), sA(span - (ze - 0.04 - zB) / p), ze - 0.04);
            quad([e0, r0, r1, e1], [[0, 0.36], [0, 0], [f - dr, 0], [f - de, 0.36]], Lroof, MAT.wall, k < 0 ? 1 : 0.86, planeN(e0, r0, r1, UP));
          }
          const wx = ax ? a : C + sA(f), wy = ax ? C + sA(f) : a;
          opening({ cx: wx, cy: wy, nx: out[0], ny: out[1], z0: zf + 0.07, z1: ze - 0.03, hw: 0.17, style: 'dormer', lit: d.lit });
        }
      } else {
        // a hipped roof: two long slopes and two ends, eaves all round
        const hf = b.half, o = OVER, ze = zB - o * p, zr = zB + hf * p, r0 = A0 + hf, r1 = A1 - hf, sl = hyp(hf + o, (hf + o) * p);
        const E = [P(A0 - o, -hf - o, ze), P(A1 + o, -hf - o, ze), P(A1 + o, hf + o, ze), P(A0 - o, hf + o, ze)], R0 = P(r0, 0, zr), R1 = P(r1, 0, zr), lo = (q) => [q[0], q[1], q[2] - 0.012];
        const faces = [[E[0], E[1], R1, R0, 1, [[A0 - o, sl], [A1 + o, sl], [r1, 0], [r0, 0]]], [E[3], E[2], R1, R0, 0.86, [[A0 - o, sl], [A1 + o, sl], [r1, 0], [r0, 0]]], [E[0], E[3], R0, R0, 0.92, [[-hf - o, sl], [hf + o, sl], [0, 0], [0, 0]]], [E[1], E[2], R1, R1, 0.92, [[-hf - o, sl], [hf + o, sl], [0, 0], [0, 0]]]];
        for (const [q0, q1, q2, q3, sk, uv] of faces) { const up = planeN(q0, q1, q2, UP);
          quad([q0, q1, q2, q3], uv, Lroof, MAT.wall, sk, up); quad([lo(q0), lo(q1), lo(q2), lo(q3)], uv, Ldark, MAT.wall, 0.6, [-up[0], -up[1], -up[2]]); }
        const mx = ax ? (A0 + A1) / 2 : C, my = ax ? C : (A0 + A1) / 2;
        for (let k = 0; k < 4; k++) { const q0 = E[k], q1 = E[(k + 1) % 4], dx = (q0[0] + q1[0]) / 2 - mx, dy = (q0[1] + q1[1]) / 2 - my, nn = abs(q1[0] - q0[0]) < 1e-6 ? [Math.sign(dx), 0, 0] : [0, Math.sign(dy), 0], len = hyp(q1[0] - q0[0], q1[1] - q0[1]);
          quad([[q0[0], q0[1], ze + 0.012], [q1[0], q1[1], ze + 0.012], [q1[0], q1[1], ze - 0.08], [q0[0], q0[1], ze - 0.08]], [[0, 0], [len, 0], [len, 0.09], [0, 0.09]], b.stone ? Lstone : Lboard, MAT.wall, 0.95, nn); }
        // the Greenhall's dome: a drum and a low dome in the old moss tile, a small finial
        if (b.dome) {
          const cx = b.dome.x + 0.5, cy = b.dome.y + 0.5, rad = 0.92, zb = zr + 0.1, hD = 0.62, S = 14, Rn = 5, Ld = L_('t_roof');
          for (let i = 0; i < S; i++) {
            const t0 = i / S * 2 * PI, t1 = (i + 1) / S * 2 * PI, c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1), nm = unit(c0 + c1, s0 + s1, 0), sk = 0.8 + 0.2 * abs(nm[0]);
            quad([[cx + c0 * rad, cy + s0 * rad, zr - 0.5], [cx + c1 * rad, cy + s1 * rad, zr - 0.5], [cx + c1 * rad, cy + s1 * rad, zb], [cx + c0 * rad, cy + s0 * rad, zb]], [[i * 0.4, 0.6], [(i + 1) * 0.4, 0.6], [(i + 1) * 0.4, 0], [i * 0.4, 0]], Lwall, MAT.wall, sk, nm);
            for (let j = 0; j < Rn; j++) {
              const f0 = j / Rn * PI / 2, f1 = (j + 1) / Rn * PI / 2, ra = rad * 1.04 * Math.cos(f0), rb = rad * 1.04 * Math.cos(f1), za = zb + hD * Math.sin(f0), zc = zb + hD * Math.sin(f1);
              const q = [[cx + c0 * ra, cy + s0 * ra, za], [cx + c1 * ra, cy + s1 * ra, za], [cx + c1 * rb, cy + s1 * rb, zc], [cx + c0 * rb, cy + s0 * rb, zc]];
              quad(q, [[i * 0.3, j * 0.24 + 0.24], [(i + 1) * 0.3, j * 0.24 + 0.24], [(i + 1) * 0.3, j * 0.24], [i * 0.3, j * 0.24]], Ld, MAT.wall, sk, planeN(q[0], q[1], j === Rn - 1 ? q[3] : q[2], [nm[0], nm[1], 0.4]));
            }
          }
          box(cx - 0.04, cy - 0.04, cx + 0.04, cy + 0.04, zb + hD - 0.02, zb + hD + 0.22, Ldark, Ldark);
        }
      }
      // ---- the Chapel's tower: an open, empty bell-frame ("Nothing hangs in the tower. You can see daylight through the frame.")
      if (b.towers.length) {
        let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9, T = 0; for (const t of b.towers) { X0 = min(X0, t.x); X1 = max(X1, t.x + 1); Y0 = min(Y0, t.y); Y1 = max(Y1, t.y + 1); T = max(T, t.top); }
        const pw = 0.16, hgt = 0.62, bm = 0.13;
        for (const [px, py] of [[X0, Y0], [X1 - pw, Y0], [X0, Y1 - pw], [X1 - pw, Y1 - pw]]) box(px, py, px + pw, py + pw, T, T + hgt, Ldark, Ldark);
        for (const [x0, y0, x1, y1] of [[X0, Y0, X1, Y0 + pw], [X0, Y1 - pw, X1, Y1], [X0, Y0, X0 + pw, Y1], [X1 - pw, Y0, X1, Y1]]) { box(x0, y0, x1, y1, T + hgt, T + hgt + bm, Ldark, Ldark);
          quad([[x0, y0, T + hgt], [x1, y0, T + hgt], [x1, y1, T + hgt], [x0, y1, T + hgt]], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Ldark, MAT.wall, 0.5, DN); }
      }
      // ---- a stone footing along the foot of every timber wall that meets open ground
      for (const q of b.plinth) {
        const tx = -q.ny, ty = q.nx, cx = q.x + 0.5 + q.nx * 0.5, cy = q.y + 0.5 + q.ny * 0.5, side = q.nx ? 1 : 0.8, zb = top - 1, zt = zb + 0.15, o = 0.03;
        const at = (t, off, z) => [cx + tx * t + q.nx * off, cy + ty * t + q.ny * off, z], u0 = q.nx ? q.y : q.x;
        quad([at(-0.5 - o, o, zb), at(0.5 + o, o, zb), at(0.5 + o, o, zt), at(-0.5 - o, o, zt)], [[u0, 0.15], [u0 + 1, 0.15], [u0 + 1, 0], [u0, 0]], Lstone, MAT.wall, side * 0.92, [q.nx, q.ny, 0]);
        quad([at(-0.5 - o, 0, zt), at(0.5 + o, 0, zt), at(0.5 + o, o, zt), at(-0.5 - o, o, zt)], [[u0, 0], [u0 + 1, 0], [u0 + 1, 0.03], [u0, 0.03]], Lstone, MAT.wall, 1.2, UP);
      }
      // ---- a small tiled hood over a door in a gable end (eaves and jetties already shelter the others)
      if (b.type === 'gable' && b.storeys === 1) for (const d of b.doors) {
        if (ax ? d.nx === 0 : d.ny === 0) continue;
        const tx = -d.ny, ty = d.nx, cx = d.x + 0.5 + d.nx * 0.5, cy = d.y + 0.5 + d.ny * 0.5, side = d.nx ? 1 : 0.8, z1 = top + 0.1, z0 = top - 0.07, out = 0.36, hw = 0.6;
        const at = (t, off, z) => [cx + tx * t + d.nx * off, cy + ty * t + d.ny * off, z], up = planeN(at(-hw, out, z0), at(hw, out, z0), at(hw, 0.01, z1), UP);
        quad([at(-hw, out, z0), at(hw, out, z0), at(hw, 0.01, z1), at(-hw, 0.01, z1)], [[0, 0.4], [1.2, 0.4], [1.2, 0], [0, 0]], Lroof, MAT.wall, side, up);
        quad([at(-hw, out, z0 - 0.012), at(hw, out, z0 - 0.012), at(hw, 0.01, z1 - 0.012), at(-hw, 0.01, z1 - 0.012)], [[0, 0.4], [1.2, 0.4], [1.2, 0], [0, 0]], Ldark, MAT.wall, 0.6, [-up[0], -up[1], -up[2]]);
        quad([at(-hw, out, z0 + 0.012), at(hw, out, z0 + 0.012), at(hw, out, z0 - 0.06), at(-hw, out, z0 - 0.06)], [[0, 0], [1.2, 0], [1.2, 0.07], [0, 0.07]], Ldark, MAT.wall, side * 0.95, [d.nx, d.ny, 0]);
        for (const sgn of [-1, 1]) { const t = sgn * (hw - 0.05);                                                  // a bracket under each end
          for (const k of [1, -1]) quad([at(t, 0.01, z0 - 0.3), at(t, 0.3, z0 - 0.02), at(t, 0.3, z0 - 0.07), at(t, 0.01, z0 - 0.36)], [[0, 0], [0.4, 0], [0.4, 0.06], [0, 0.06]], Ldark, MAT.wall, 0.75, [tx * sgn * k, ty * sgn * k, 0]); }
      }
      // ---- windows
      for (const w of b.windows) opening(w);
      // ---- cold stone stacks (the harbour)
      for (const e of (b.stacks || [])) { const z = roofZ(b, e.x, e.y); if (z == null) continue; const zt = max(z + 0.5, b.ridge + (b.parapet || 0) + 0.18), Ls = L_('e78_cope');
        box(e.x - 0.16, e.y - 0.16, e.x + 0.16, e.y + 0.16, z - 0.3, zt, Ls, Ldark, 0.95); box(e.x - 0.19, e.y - 0.19, e.x + 0.19, e.y + 0.19, zt - 0.06, zt, Ls, Ldark, 1.1); }
      // ---- what only this region has
      for (const e of (b.extras || [])) {
        const tx = -e.ny, ty = e.nx, bx = (t0, t1, o0, o1, z0, z1, L, Lt, k) => { const xa = e.x + tx * t0 + e.nx * o0, xb = e.x + tx * t1 + e.nx * o1, ya = e.y + ty * t0 + e.ny * o0, yb = e.y + ty * t1 + e.ny * o1; box(min(xa, xb), min(ya, yb), max(xa, xb), max(ya, yb), z0, z1, L, Lt || L, k || 1); };
        if (e.kind === 'hoist') {                                // a hoist beam over the loft door, its block, and three chimes ("every shroud in the harbour carries a chime")
          bx(-0.04, 0.04, -0.05, 0.62, e.z, e.z + 0.09, Ldark, Ldark, 1.05);
          bx(-0.05, 0.05, 0.5, 0.6, e.z - 0.12, e.z, Ldark, Ldark, 0.9);
          [[0.16, 0.13], [0.27, 0.2], [0.38, 0.16]].forEach(([o, len]) => bx(-0.017, 0.017, o - 0.017, o + 0.017, e.z - 0.04 - len, e.z - 0.03, Lbronze, Lbronze, 1.25));
        } else if (e.kind === 'kiln') {                          // a kiln-chimney: a square brick stack, drawn in a little, a stone cap, a dark flue. Cold.
          const zr = roofZ(b, e.x, e.y), z0 = (zr == null ? b.zBase : zr) - 0.3, z1 = b.ridge + 1.0, r0 = 0.3, r1 = 0.2, Lb = L_('t_brick');
          [[-1, -1, 1, -1, 0, -1], [1, -1, 1, 1, 1, 0], [1, 1, -1, 1, 0, 1], [-1, 1, -1, -1, -1, 0]].forEach(([ax_, ay_, bx_, by_, nx_, ny_]) =>
            quad([[e.x + ax_ * r0, e.y + ay_ * r0, z0], [e.x + bx_ * r0, e.y + by_ * r0, z0], [e.x + bx_ * r1, e.y + by_ * r1, z1], [e.x + ax_ * r1, e.y + ay_ * r1, z1]], [[0, z1 - z0], [0.6, z1 - z0], [0.5, 0], [0.1, 0]], Lb, MAT.wall, nx_ ? 1 : 0.8, [nx_, ny_, 0]));
          box(e.x - r1 - 0.04, e.y - r1 - 0.04, e.x + r1 + 0.04, e.y + r1 + 0.04, z1 - 0.02, z1 + 0.07, Lstone, Lstone, 1.1);
          box(e.x - 0.11, e.y - 0.11, e.x + 0.11, e.y + 0.11, z1 + 0.07, z1 + 0.13, Ldark, Ldark, 0.6);
        } else if (e.kind === 'bellcote') {                      // the Harbour Office: "Dues, bench and bell"
          const Ls = L_('e78_cope');
          for (const t of [-0.2, 0.2]) bx(t - 0.05, t + 0.05, -0.16, 0.0, e.z - 0.12, e.z + 0.4, Ls, Ls, 1.05);
          bx(-0.3, 0.3, -0.19, 0.03, e.z + 0.4, e.z + 0.48, Ls, Ls, 1.15);
          bx(-0.08, 0.08, -0.15, -0.01, e.z + 0.1, e.z + 0.3, Lbronze, Lbronze, 1.2);
        }
      }
      // ---- a brick stack under every smoking chimney
      for (const e of chimneysOf(m)) {
        if (e.x < b.x0 || e.x > b.x1 + 1 || e.y < b.y0 || e.y > b.y1 + 1) continue;
        const z = roofZ(b, e.x, e.y), zt = stackTop(b, e.x, e.y); if (z == null) continue;
        box(e.x - 0.17, e.y - 0.17, e.x + 0.17, e.y + 0.17, z - 0.25, zt, Lbrick, Ldark, 0.95);
        box(e.x - 0.2, e.y - 0.2, e.x + 0.2, e.y + 0.2, zt - 0.07, zt, Lstone, Ldark, 1.05);
      }
    }
    // ---- the harbour's shop-fronts: a slate pentice on two brackets ("six wet flights with shops on the landings")
    for (const q of (planOf(m).shops || [])) {
      const tx = -q.ny, ty = q.nx, side = q.nx ? 1 : 0.8, hw = q.hw, zf = q.z - 0.07, zb = q.z + 0.26, out = 0.42, back = -0.22, Lsl = L_('p17c_slate'), Lc = L_('e78_cope');
      const at = (t, off, z) => [q.cx + tx * t + q.nx * off, q.cy + ty * t + q.ny * off, z], n = [q.nx, q.ny, 0];
      const up = planeN(at(-hw, out, zf), at(hw, out, zf), at(hw, back, zb), UP), sl = hyp(out - back, zb - zf);
      quad([at(-hw, out, zf), at(hw, out, zf), at(hw, back, zb), at(-hw, back, zb)], [[0, sl], [hw * 2, sl], [hw * 2, 0], [0, 0]], Lsl, MAT.wall, side, up);
      quad([at(-hw, out, zf - 0.012), at(hw, out, zf - 0.012), at(hw, 0.005, zf + (zb - zf) * (out - 0.005) / (out - back) - 0.012), at(-hw, 0.005, zf + (zb - zf) * (out - 0.005) / (out - back) - 0.012)], [[0, 0.4], [hw * 2, 0.4], [hw * 2, 0], [0, 0]], Ldark, MAT.wall, 0.6, [-up[0], -up[1], -up[2]]);
      quad([at(-hw, out, zf + 0.012), at(hw, out, zf + 0.012), at(hw, out, zf - 0.055), at(-hw, out, zf - 0.055)], [[0, 0], [hw * 2, 0], [hw * 2, 0.07], [0, 0.07]], Lc, MAT.wall, side * 1.1, n);
      quad([at(-hw, back, q.z), at(hw, back, q.z), at(hw, back, zb), at(-hw, back, zb)], [[0, 0.26], [hw * 2, 0.26], [hw * 2, 0], [0, 0]], Lc, MAT.wall, side * 0.8, [-q.nx, -q.ny, 0]);
      for (const sgn of [-1, 1]) {
        const t = sgn * hw, zw = zf + (zb - zf) * out / (out - back);        // the cheeks: closed over the wall, open under the eave
        tri([at(t, back, q.z), at(t, 0, q.z), at(t, back, zb)], [[0, 0.26], [0.22, 0.26], [0, 0]], Lc, MAT.wall, 0.9, [tx * sgn, ty * sgn, 0]);
        tri([at(t, 0, q.z), at(t, 0, zw), at(t, back, zb)], [[0.22, 0.26], [0.22, 0.1], [0, 0]], Lc, MAT.wall, 0.9, [tx * sgn, ty * sgn, 0]);
        const tb = sgn * (hw - 0.12);
        for (const k of [1, -1]) quad([at(tb, 0.01, zf - 0.34), at(tb, 0.34, zf - 0.02), at(tb, 0.34, zf - 0.07), at(tb, 0.01, zf - 0.4)], [[0, 0], [0.4, 0], [0.4, 0.06], [0, 0.06]], Ldark, MAT.wall, 0.75, [tx * sgn * k, ty * sgn * k, 0]);
      }
    }
    return tris;
  }

  // ---------------------------------------------------------------- in the game
  let wasLit = null, wasOn = null, wasCh = -1;
  function lift(m, drawing) {                                    // the smoking chimneys stand on the new stacks (only while the 3D renderer draws them)
    if (typeof G === 'undefined' || !G.ents || !m) return;
    const active = drawing && on() && MAPS.has(m.id);
    for (const e of G.ents) {
      if (e._fs !== 'chimney') continue;
      if (active && !e._e78) { const b = planOf(m).houses.find((q) => e.x >= q.x0 && e.x <= q.x1 + 1 && e.y >= q.y0 && e.y <= q.y1 + 1); if (!b) continue; const z = stackTop(b, e.x, e.y); if (z == null) continue; e._e78 = { yOff: e.yOff, top: e._fsTop, scale: e.scale }; e.yOff = -(z - 0.03); e._fsTop = z + 0.28; e.scale = 0.36; }
      else if (!active && e._e78) { e.yOff = e._e78.yOff; e._fsTop = e._e78.top; e.scale = e._e78.scale; e._e78 = null; }
    }
  }
  if (typeof R3D !== 'undefined' && R3D.extendMesh) {
    R3D.extendMesh((m, h) => build(m, h));
    R3D.on('frame', (F) => {
      const m = F && F.map; if (!m) return;
      const l = night(), o = on(), ch = chimneysOf(m).length;
      if (MAPS.has(m.id) && (l !== wasLit || o !== wasOn || ch !== wasCh)) { if (wasLit !== null) R3D.invalidate(); wasLit = l; wasOn = o; wasCh = ch; }
      lift(m, true);
    });
    R3D.on('toggle', (shown) => { try { if (!shown && typeof G !== 'undefined' && G.map) lift(G.map, false); } catch (e) { /* chimneys stay where they were */ } });
  }
  return { MAPS, STYLES, PITCH, OVER, RIDGE1, RIDGE2, plan, planOf, roofZ, shelter, build, on, night, textures };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = EAVES78;
if (typeof window !== 'undefined') window.EAVES78 = EAVES78;

// the Options row
if (typeof renderAccessibilityMenu === 'function' && typeof document !== 'undefined') (() => {
  const _acc = renderAccessibilityMenu;
  renderAccessibilityMenu = function () {
    const r = _acc.apply(this, arguments);
    try {
      const grid = document.querySelector('#modal-panel .ctl-grid');
      if (grid && !document.getElementById('gfx-eaves')) {
        const label = document.createElement('span'); label.className = 'gfx-label'; label.appendChild(document.createTextNode('Roofs, windows and eaves '));
        const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = "Oakhaven's buildings with pitched roofs, upper storeys, dormers, windows lit after dusk, the Greenhall's dome and the Chapel's bell-frame (3D renderer only)"; label.appendChild(sm);
        const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = 'gfx-eaves'; b.type = 'button'; b.setAttribute('aria-label', 'Roofs, windows and eaves');
        const sync = () => { b.textContent = GFX.eaves !== false ? 'On' : 'Off'; b.setAttribute('aria-pressed', GFX.eaves !== false ? 'true' : 'false'); };
        b.onclick = () => { GFX.eaves = GFX.eaves === false; if (typeof GFX.changed === 'function') GFX.changed(); if (typeof R3D !== 'undefined' && R3D.invalidate) R3D.invalidate(); sync(); };
        sync(); grid.appendChild(label); grid.appendChild(b);
      }
    } catch (e) { /* the menu still opens without the row */ }
    return r;
  };
})();
