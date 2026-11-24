// ============================================================
//  open42 - Phase 42, the highland edge as one open country.
//
//  O19 wants a zone walked as one open world, with no ridge between its parts; Phase 41 made the renderer able to draw
//  a map that big a piece at a time. So this phase builds Z1 as one map, la_z1, 1,536 x 1,536 cells, the whole zone of
//  atlas/10-zones.md in the zone's own coordinates (a cell of la_z1 is the same cell of the zone):
//
//    * the ground is Phase 40's, from the same function of zone coordinates (THRESH40.H), with the same frost, scorch
//      and rock, the same nine ways and the same crag round the ledge with its cleft;
//    * the rock bands Phase 40 stood between its maps are gone. Only the zone's own edge is still rock, 11 deep (the
//      foot of the rim to the north, the high ground on the other sides), until the zones beyond it are built; a way
//      that runs into it (the upper road, south to Coldbarrow) ends in a notch, and says so;
//    * the ledge's gap leads down into it, and its cleft back up, as Phase 40's did;
//    * a map this big is not made at once: from Begin the page builds it sixteen rows at a time, 8 ms at most at a go,
//      while it is idle (about 0.8 s of work in all here), and finishes it at once only if you go down before it is
//      done, or load a save made in it;
//    * the map (M) on a map this big is drawn a cell to a pixel, not four.
//
//  The switch (Options) "One open country": off, the ledge's way down leads to Phase 40's two maps, with the rock
//  between them, exactly as before this phase. The open map is built either way.
//
//  Plain ASCII. No random number, and no clock in what is made: every shape comes from a fixed hash of position (the
//  page's idle time says only when a row is made, never what).
// ============================================================
'use strict';

const OPEN42 = (() => {
  const T = typeof THRESH40 !== 'undefined' ? THRESH40 : (typeof require === 'function' ? require('./threshold40.js') : null);
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require === 'function' ? require('./ledge1.js') : null);
  const TX = {
    name: 'The highland edge',
    switchName: 'One open country',
    switchWhat: 'The highland edge is one map, walked with nothing between its parts. Off: it is two maps with rock between them, as before',
  };
  const ID = 'la_z1';
  const W = T.ZONE.w, H = T.ZONE.h, BAND = T.BAND;
  // rows built in one step between frames, and ways' half-widths (Phase 40's)
  const ROWS = 16;
  const HALF = { road: 1.5, track: 1.0 };

  // ---------------------------------------------------------------- shapes (pure, zone coordinates)
  // which way, if any, runs through each cell: the first of Z1's ways (in the atlas's order) within its half-width of
  // the cell's middle, as THRESH40.cellAt finds it, but stamped one segment at a time instead of asked cell by cell
  function waysMask(M, only) {
    M = M || new Uint8Array(W * H);
    T.WAYS.forEach((w, wi) => {
      if (only != null && wi !== only) return;
      const r = HALF[w.kind] || 1.0;
      for (let i = 0; i + 1 < w.pts.length; i++) {
        const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1];
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r + 1));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + r + 1));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const k = y * W + x;
          if (!M[k] && T.segDist(x + 0.5, y + 0.5, ax, ay, bx, by) < r) M[k] = wi + 1;
        }
      }
    });
    return M;
  }
  // the same, asked of one cell (for tests and for a cell outside a mask)
  function wayAt(zx, zy) {
    const cx = zx + 0.5, cy = zy + 0.5;
    for (const w of T.WAYS) if (T.lineDist(cx, cy, w.pts) < (HALF[w.kind] || 1.0)) return w;
    return null;
  }
  // how far a cell's middle is inside the zone's own edge
  const edgeIn = (cx, cy) => Math.min(cx, cy, W - cx, H - cy);
  // what stands at a cell of the open zone: 'band' rock at the zone's edge, 'crag' rock, or nothing; and the way there.
  // Away from Phase 40's inner edges it is exactly THRESH40.cellAt (tested).
  function cellAt(zx, zy, mask) {
    const cx = zx + 0.5, cy = zy + 0.5, C = T.CRAG, CL = T.CLEFT;
    let solid = null;
    const dc = Math.hypot((cx - C.x) / 1.15, cy - C.y);
    const rr = C.r + (T.vnoise(Math.atan2(cy - C.y, cx - C.x) * 3 + 10, 0.5, 31) - 0.5) * 9;
    if (dc < rr) solid = 'crag';
    const ein = edgeIn(cx, cy);
    if (ein < BAND) solid = 'band';
    let way = mask ? (mask[zy * W + zx] ? T.WAYS[mask[zy * W + zx] - 1] : null) : wayAt(zx, zy);
    // the zone's edge: a way that runs into it goes on 8 cells and stops 3 short of the edge, a notch
    if (solid === 'band') { if (way && ein >= 3) solid = null; else way = null; }
    if (solid === 'crag' && Math.abs(cx - CL.x) < 1.25 && cy >= CL.y0 && cy <= CL.y1 + 6) { solid = null; way = T.WAYS[3]; }
    if (!solid && !way && Math.abs(cx - CL.x) < 1.0 && cy > CL.y1 && cy <= 150) way = T.WAYS[3];
    return { solid, way };
  }
  // the notches at the zone's edge: where each way meets it
  function notches() {
    const out = [];
    for (const w of T.WAYS) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) {
      if (edgeIn(p[0], p[1]) < BAND) out.push({ way: w, x: p[0], y: p[1] });
    }
    return out;
  }

  // ---------------------------------------------------------------- building it, a piece at a time
  // A job is the map and how far its making has got: the ways' mask, then the heights row by row, then the cells row
  // by row (a cell's row needs the heights of the row below it). step() does ROWS rows and returns true when done.
  function create() {
    const FL = L1.FL, A = T.ARRIVE_Z1;
    const m = new GameMap(ID, TX.name, W, H, {
      outdoor: true, floor: 't_la_frost', floorTextures: ['t_la_scorch', 't_la_rock', 't_la_rock', 't_la_frost', 't_la_ember', 't_la_bloom', 't_la_slag', 't_la_frost2'],
      fogDist: 120, fogColor: [46, 20, 16], ambient: 0.16, music: 'wild', danger: 0,
      spawn: { x: A.x, y: A.y, dir: A.dir },
    });
    m._la = true; m._z42 = { ox: 0, oy: 0, w: W, h: H };
    m.ensureVerts(); m.ensureLvls(); m.smooth.fill(1);
    const sp = m.spawn;
    try { if (typeof NPCS !== 'undefined' && NPCS.la_carter) m.npc('la_carter', sp.x, sp.y - 1.2, { name: 'The carter', wander: false, hidden: true }); } catch (e) { /* no carter here */ }
    try { if (typeof NPCS !== 'undefined' && NPCS.la_marget) m.npc('la_marget', sp.x, sp.y - 0.8, { name: L1.TX.marget, wander: false, requires: 'la_marget_out', hidden: true }); } catch (e) { /* no Marget here */ }
    m.baseCount = m.entities.length;
    const job = { m, mask: null, wi: 0, vy: 0, cy: 0, done: false, FL };
    m._z42job = job;
    return job;
  }
  function step(job) {
    if (job.done) return true;
    const m = job.m, V = m.verts, W1 = W + 1, FL = job.FL;
    // the ways one at a time, in the atlas's order, so the first way through a cell keeps it
    if (job.wi < T.WAYS.length) { job.mask = waysMask(job.mask, job.wi); job.wi++; return false; }
    if (job.vy <= H) {
      const y1 = Math.min(H + 1, job.vy + ROWS);
      for (let vy = job.vy; vy < y1; vy++) for (let vx = 0; vx <= W; vx++) V[vy * W1 + vx] = T.H(vx, vy);
      job.vy = y1;
      return false;
    }
    if (job.cy < H) {
      const y0 = job.cy, y1 = Math.min(H, y0 + ROWS);
      m.syncSlopes(0, y0, W - 1, y1 - 1);
      for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
        const c = cellAt(x, y, job.mask), g = m.groundAt(x + 0.5, y + 0.5);
        const a = V[y * W1 + x], b = V[y * W1 + x + 1], cc = V[(y + 1) * W1 + x], d = V[(y + 1) * W1 + x + 1];
        let f = T.hash(x, y, 41) > 0.5 ? FL.FROST2 : FL.FROST;
        if (T.fbm(x / 30, y / 30, 43) < 0.36) f = FL.SCORCH;
        if (Math.max(a, b, cc, d) - Math.min(a, b, cc, d) > 1.2) f = FL.ROCK;
        if (c.way) f = FL.ROCK;
        m.setFloor(x, y, f);
        if (c.solid === 'band') m.block(x, y, 't_la_rock', g + 3.4 + T.hash(x, y, 44) * 1.4, { capTex: 't_la_frost' });
        else if (c.solid === 'crag') m.block(x, y, 't_la_rock', g + 9.5 + T.hash(x >> 1, y >> 1, 45) * 2.5, { capTex: 't_la_frost' });
      }
      job.cy = y1;
      if (job.cy < H) return false;
    }
    m.border('t_la_rock');
    job.mask = null; job.done = true; delete m._z42job;
    ST.built++;
    return true;
  }
  function finish(m) {
    const job = m && m._z42job; if (!job) return false;
    let n = 0; while (!step(job)) n++;
    ST.finishedAtOnce++;
    return n;
  }
  const ready = (m) => !!m && !m._z42job;

  // ---------------------------------------------------------------- the wire (browser only)
  const ST = { built: 0, steps: 0, finishedAtOnce: 0, crossed: 0, said: {}, err: null };
  const sw = () => typeof GFX === 'undefined' || GFX.laOpenZone !== false;
  const open = () => sw() && T.on();
  let bg = null;
  // The making goes on while the page is idle, ROWS rows a step, on the map the game holds or else the newest made:
  // steps for up to BUDGET ms at a time, when the browser is idle or at least every 50 ms however busy it is.
  const BUDGET = 8;
  const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 50 }) : setTimeout(fn, 0));
  function pump() {
    bg = null;
    const m = typeof G !== 'undefined' && G && G.maps ? G.maps[ID] : null;
    const job = (m && m._z42job) || PENDING;
    if (!job || job.done) return;
    try {
      const t0 = performance.now();
      do { step(job); ST.steps++; } while (!job.done && performance.now() - t0 < BUDGET);
    } catch (e) { ST.err = ST.err || String(e && e.message); return; }
    if (!job.done || (G.maps && G.maps[ID] && G.maps[ID]._z42job)) bg = idle(pump);
  }
  let PENDING = null;
  function thresholds() {
    const TH = T.thresholds();
    const ld = TH.find((q) => q.id === 'ledge-down'), lu = TH.find((q) => q.id === 'ledge-up');
    if (!ld || !lu || TH.some((q) => q.id === 'open-down')) return TH;
    const A = T.ARRIVE_Z1, CL = T.CLEFT, cl = { x: CL.x + 0.5, y: CL.y0 + 2.2 };
    ld.when = () => !open();
    TH.push(Object.assign({}, ld, { id: 'open-down', to: ID, arrive: () => ({ x: A.x, y: A.y }), out: { x: A.x, y: A.y - 0.5, yaw: A.dir }, when: open }));
    TH.push(Object.assign({}, lu, { id: 'open-up', from: ID, test: (x, y) => Math.abs(x - cl.x) < 1.3 && y < cl.y && y > cl.y - 6, door: { x: cl.x, y: cl.y + 0.3 } }));
    return TH;
  }
  function tick() {
    if (typeof G === 'undefined' || !G || G.state !== 'play' || G.mapId !== ID) return;
    const c = Engine.cam;
    for (const n of notches()) {
      if (Math.hypot(c.x - n.x, c.y - n.y) < BAND + 3) {
        const key = n.way.name;
        if (!ST.said[key] || G.time - ST.said[key] > 20) { ST.said[key] = G.time; msg(T.TX.notBuilt(n.way.name), '', 4500); }
      }
    }
  }
  // the map (M), a cell to a pixel on a map this big
  function drawMap() {
    const m = G.map, cw = 1;
    const html = `<h2>${m.name}</h2><button class="dfbtn small close" id="x">Close</button><p class="muted">What you have walked. North is up.</p><canvas id="amap" width="${m.w}" height="${m.h}" style="width:min(100%, 768px);image-rendering:pixelated"></canvas>`;
    openModal(html, 'map'); $('#x').onclick = () => { closeModal(); G.state = 'play'; };
    const cv = $('#amap'), cx = cv.getContext('2d');
    const img = cx.createImageData(m.w, m.h), px = new Uint32Array(img.data.buffer);
    for (let i = 0; i < m.w * m.h; i++) {
      if (!m.visited[i]) continue;
      const c = m.cells[i], fl = m.floorCells ? m.floorCells[i] : 0;
      // rock dark, ways pale, the ground by its floor (little-endian ABGR)
      px[i] = c ? 0xff36424e : fl === L1.FL.ROCK ? 0xff78889a : fl === L1.FL.SCORCH ? 0xff30384a : 0xff505a62;
    }
    cx.putImageData(img, 0, 0);
    // you: drawn large, since the canvas is shown at half size or less
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(Engine.cam.x * cw, Engine.cam.y * cw, 9, 0, 7); cx.fill();
    cx.strokeStyle = '#fff'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(Engine.cam.x, Engine.cam.y); cx.lineTo(Engine.cam.x + Math.cos(Engine.cam.dir) * 26, Engine.cam.y + Math.sin(Engine.cam.dir) * 26); cx.stroke();
  }
  function wire() {
    if (typeof window === 'undefined' || typeof G === 'undefined' || typeof GameMap === 'undefined' || !T || !L1) return false;
    const _bm = buildAllMaps;
    buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try {
        const job = create(); maps[ID] = job.m; PENDING = job;
        if (typeof BLOOM4 !== 'undefined' && BLOOM4.addMap) BLOOM4.addMap(job.m);
        if (!bg) bg = idle(pump);
      } catch (e) { ST.err = ST.err || String(e && e.message); }
      return maps;
    };
    if (!T.MORE.includes(ID)) T.MORE.push(ID);
    const TH = thresholds();
    if (typeof BLOOM4 !== 'undefined' && BLOOM4.DOORS) {
      const d40 = BLOOM4.DOORS.find((d) => d.z40 === 'ledge-down');
      if (d40) { const b = d40.barred; d40.barred = () => b() || open(); }
      for (const t of TH.filter((q) => q.id === 'open-down' || q.id === 'open-up')) {
        BLOOM4.DOORS.push({ from: t.from, at: t.door, to: t.to, out: t.out, barred: () => !open(), waitAt: t.door, pause: 0, home: t.home, z40: t.id });
      }
    }
    const _lm = loadMap;
    loadMap = function (id) {
      if (id === ID) { try { finish(G.maps && G.maps[ID]); } catch (e) { ST.err = ST.err || String(e && e.message); } }
      return _lm.apply(this, arguments);
    };
    const _up = update;
    update = function () { const r = _up.apply(this, arguments); try { tick(); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    if (typeof renderMap === 'function') {
      const _rm = renderMap;
      renderMap = function () { if (G.map && G.mapId === ID) { try { return drawMap(); } catch (e) { ST.err = ST.err || String(e && e.message); } } return _rm.apply(this, arguments); };
    }
    L1.SWITCHES.push(['laOpenZone', TX.switchName, TX.switchWhat]);
    return true;
  }
  const wired = wire();
  return { TX, ID, W, H, ROWS, waysMask, wayAt, cellAt, notches, create, step, finish, ready, open: () => open(), state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OPEN42;
