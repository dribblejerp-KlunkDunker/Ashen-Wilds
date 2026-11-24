// Usage: NODE_PATH=$(npm root -g) node tools/limits.js [out.json] [--sizes 96,160,256,384,512] [--frames 20]
// How big can one map be? (for CANON O15: one dense walkable zone of about a square mile per region)
// For each size, a fresh headless Chromium (test/harness.js) opens the game, presses Begin, then builds a test map of
// N x N cells shaped like the ledge (every vertex a height, every cell sloped, cracks, frost on the heights, a rock
// border), with a place to see, find or fight about every 80 to 150 cells (a hut and its keeper, a cairn with a fire,
// a patch of bloom caps, each with its own light) and decos scattered between them. It loads the map with the game's
// own loadMap and records: the time to build and load it, the R3D static mesh (build time, vertices, triangles), the
// frame time under software rendering (SwiftShader), the JS heap, and the size of snapshotGame() and of a save code.
// A size that takes more than three minutes is stopped and reported as far as it got.
// Software rendering measures the CPU side and a pessimistic GPU; it says nothing exact about a real graphics card.
// No game code is changed: the test map lives only in the page the tool opens.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const SIZES = String(flag('--sizes', '96,160,256,384,512')).split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 16);
const FRAMES = parseInt(flag('--frames', '20'), 10);
const OUT = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : path.join(__dirname, '..', 'docs', 'engine-limits.json');
const LIMIT_MS = 3 * 60 * 1000;

// ---------------------------------------------------------------- in the page: build the test map
// Runs inside the browser. Returns what it built; the map is kept on window.__lim.
function buildInPage(N) {
  const t0 = performance.now();
  function hash(x, y, s) { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function vnoise(x, y, s) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, s) { let t = 0, a = 0.5, k = 1; for (let o = 0; o < 4; o++) { t += vnoise(x * k, y * k, s + o * 17) * a; a *= 0.5; k *= 2; } return t; }
  // the ledge's own recipe (js/ledge1.js landH), stretched: rolling scorch, a rim at the edge, cracks that drop to embers
  function landH(x, y) {
    const edge = Math.min(x, y, N - x, N - y);
    let h = 0.5 + fbm(x / 13, y / 13, 1) * 2.4 + fbm(x / 70, y / 70, 9) * 5;
    h += smooth(9, 2, edge) * 7;
    const crack = smooth(0.085, 0.03, Math.abs(vnoise(x / 8.5, y / 8.5, 3) - 0.5)) * smooth(4, 12, edge);
    return lerp(h, -2.4, crack);
  }
  const id = 'la_limits_' + N;
  const m = new GameMap(id, 'Limits ' + N, N, N, {
    outdoor: true, floor: 't_la_scorch', floorTextures: ['t_la_scorch', 't_la_rock', 't_la_rock', 't_la_frost', 't_la_ember', 't_la_bloom', 't_la_slag', 't_la_frost2'],
    fogDist: 120, fogColor: [46, 20, 16], ambient: 0.16, music: 'wild', danger: 0, spawn: { x: N / 2 + 0.5, y: N / 2 + 0.5, dir: 0 },
  });
  m._la = true;
  const V = m.ensureVerts(), W1 = N + 1;
  for (let vy = 0; vy <= N; vy++) for (let vx = 0; vx <= N; vx++) V[vy * W1 + vx] = landH(vx, vy);
  // the places: one every SPACING cells on a jittered grid (O15: something every 30 to 60 s of walking, P33: 2.6 cells/s)
  const SPACING = 115, places = [];
  for (let gy = SPACING / 2; gy < N; gy += SPACING) for (let gx = SPACING / 2; gx < N; gx += SPACING) {
    const x = Math.round(clamp(gx + (hash(gx, gy, 11) - 0.5) * 40, 12, N - 14)), y = Math.round(clamp(gy + (hash(gx, gy, 12) - 0.5) * 40, 12, N - 14));
    places.push({ x, y, kind: places.length % 3 });
  }
  // a hut stands on flat ground: level a pad round it
  for (const p of places) if (p.kind === 0) {
    const h0 = V[p.y * W1 + p.x];
    for (let vy = p.y - 3; vy <= p.y + 7; vy++) for (let vx = p.x - 3; vx <= p.x + 7; vx++) V[vy * W1 + vx] = h0;
  }
  m.smooth.fill(1); m.syncSlopes(0, 0, N - 1, N - 1);
  const FL = { SCORCH: 0, ROCK: 1, DROP: 2, FROST: 3, EMBER: 4, BLOOM: 5, SLAG: 6, FROST2: 7 };
  const g = (x, y) => m.groundAt(x + 0.5, y + 0.5);
  const grade = (x, y) => { const a = V[y * W1 + x], b = V[y * W1 + x + 1], c = V[(y + 1) * W1 + x], d = V[(y + 1) * W1 + x + 1]; return Math.max(a, b, c, d) - Math.min(a, b, c, d); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = g(x, y);
    let f = FL.SCORCH;
    if (h < -1.5 && grade(x, y) < 0.7) f = FL.EMBER;
    else if (grade(x, y) > 1.2 || h < -1.5) f = FL.ROCK;
    else if (h > 5.5) f = hash(x, y, 98) > 0.5 ? FL.FROST2 : FL.FROST;
    else if (hash(x >> 3, y >> 3, 97) > 0.85) f = FL.SLAG;
    m.setFloor(x, y, f);
  }
  m.border('t_la_rock');
  // sprites the game has painted; whichever of these exist
  const SPR = ['la_ember', 'la_caps', 'la_mark', 'la_table'].filter((s) => Engine.sprites && Engine.sprites[s]);
  const npcOk = typeof NPCS !== 'undefined' && NPCS.la_carter;
  let lights = 0, npcs = 0, blocks = 0;
  for (const p of places) {
    const { x, y } = p;
    if (p.kind === 0) {
      // a hut of four cells by three, dry-stone, a roof the planner finds, a door to the south, its keeper at the door
      for (let yy = y; yy <= y + 2; yy++) for (let xx = x; xx <= x + 3; xx++) { m.set(xx, yy, WALL(xx > x && xx < x + 3 && yy === y + 1 ? 't_roof' : 't_house_la_drystone')); blocks++; }
      m.set(x + 1, y + 2, DOOR({ label: 'A door' }));
      if (npcOk) { m.npc('la_carter', x + 1.5, y + 4.2, { name: 'Keeper', wander: false, dir: -Math.PI / 2 }); npcs++; }
      m.deco('la_ember', x + 3.5, y + 4.5, { solid: false, scale: 1, glow: 1, lightCol: [120, 40, 8], label: 'A fire' }); lights++;
    } else if (p.kind === 1) {
      // a cairn: a ring of standing rock and a fire in it
      for (let k = 0; k < 6; k++) { const a = k * 1.047, bx = Math.round(x + Math.cos(a) * 3), by = Math.round(y + Math.sin(a) * 3); m.block(bx, by, 't_la_rock', g(bx, by) + 1 + hash(bx, by, 7) * 2, { capTex: 't_la_frost' }); blocks++; }
      m.deco('la_ember', x + 0.5, y + 0.5, { solid: false, scale: 1, glow: 1, lightCol: [120, 40, 8], label: 'A fire' }); lights++;
    } else {
      // a patch of bloom caps, teal
      for (const [dx, dy] of [[0, 0], [-3, 2], [3, -2], [1, 4], [-2, -3], [4, 2]]) m.deco('la_caps', x + dx + 0.5, y + dy + 0.5, { solid: false, scale: 1, glow: 1, lightCol: [14, 74, 64], label: 'Bloom' });
      lights += 6;
    }
    for (let k = 0; k < 3; k++) m.deco(SPR[k % SPR.length], x + 6.5 + k, y - 2.5 + k * 2, { solid: false, scale: 0.8, label: 'Something' });
  }
  // and between the places, scattered things: one in about every 120 cells of open ground
  let scattered = 0;
  for (let y = 2; y < N - 2; y++) for (let x = 2; x < N - 2; x++) {
    if (hash(x, y, 55) > 1 / 120 || m.get(x, y)) continue;
    const f = m.floorCells[y * N + x]; if (f === FL.DROP || f === FL.ROCK) continue;
    m.deco(SPR[Math.floor(hash(x, y, 56) * SPR.length)], x + 0.5, y + 0.5, { solid: false, scale: 0.6 + hash(x, y, 57) * 0.4 });
    scattered++;
  }
  m.baseCount = m.entities.length;
  window.__lim = { m, id, places };
  return { id, genMs: performance.now() - t0, places: places.length, lights, npcs, blocks, scattered, entities: m.entities.length };
}

// Runs inside the browser: load the map and draw its first frame (that frame builds the static mesh).
function loadInPage() {
  const { m, id } = window.__lim;
  G.maps[id] = m;
  const t0 = performance.now();
  G.state = 'paused';
  loadMap(id, { x: m.w / 2 + 0.5, y: m.h / 2 + 0.5, dir: 0 });
  G.state = 'play'; G.fadeT = 0; G.tod = 0.5;
  const t1 = performance.now();
  render();
  const gl = R3D.gl && R3D.gl(); if (gl) gl.finish();
  const t2 = performance.now();
  const info = (R3D.mesh && R3D.mesh()) || R3D.stats.lastMesh || {};
  return { loadMapMs: t1 - t0, firstFrameMs: t2 - t1, mesh: info, stream: R3D.stream ? R3D.stream() : null, r3dActive: !!(R3D.active && R3D.active()), software: R3D.st && R3D.st.software, renderer: R3D.st && R3D.st.renderer };
}

// Runs inside the browser: time update() and render() + gl.finish() from two views.
function framesInPage(frames) {
  const { m } = window.__lim;
  const gl = R3D.gl && R3D.gl();
  const med = (a) => { const b = a.slice().sort((x, y) => x - y), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };
  const p95 = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * 0.95))]; };
  // the middle of the map looking east, and a quarter in looking across the whole of it
  const views = [{ x: m.w / 2 + 0.5, y: m.h / 2 + 0.5, dir: 0 }, { x: m.w * 0.25 + 0.5, y: m.h * 0.25 + 0.5, dir: Math.PI / 4 }];
  const out = { views: [] };
  for (const v of views) {
    Engine.cam.x = v.x; Engine.cam.y = v.y; Engine.cam.dir = v.dir; settleFeet(); G.keys = {};
    for (let i = 0; i < 3; i++) render();
    // Phase 41: on a streamed map, let the chunks the eye needs be built before timing (a few a frame)
    const sw = () => (R3D.stream ? R3D.stream() : null);
    let warm = 0;
    for (; warm < 400 && sw() && sw().on && sw().info && sw().info.chunks < sw().info.need; warm++) render();
    if (gl) gl.finish();
    const r = [], u = [], cpu = [], builds0 = R3D.stats.meshBuilds;
    for (let i = 0; i < frames; i++) {
      const a = performance.now(); update(1 / 60); const b = performance.now();
      render(); if (gl) gl.finish(); const c = performance.now();
      u.push(b - a); r.push(c - b); cpu.push(R3D.stats.cpuLast || 0);
    }
    const si = sw() && sw().on ? sw().info : null;
    out.views.push({ update: med(u), render: med(r), renderP95: p95(r), r3dCpu: med(cpu), meshRebuilds: R3D.stats.meshBuilds - builds0, all: r.map((x) => Math.round(x)), warm, stream: si ? { chunks: si.chunks, verts: si.verts, tris: si.tris } : null });
  }
  // the change check R3D runs on every frame (js/r3d21.js cellSig, copied here only to time it): it reads every cell
  const strHash = new Map();
  function hs(s) { if (!s) return 0; let h = strHash.get(s); if (h === undefined) { h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; strHash.set(s, h); } return h; }
  function cellSig(mm) {
    let h = 0x9e3779b9 | 0; const g = mm.cells;
    for (let i = 0; i < g.length; i++) {
      const c = g[i]; let v = 0;
      if (c) v = (hs(c.tex) ^ (c.top != null ? ((c.top * 4096) | 0) * 31 : 7) ^ (c.door ? 0x55 : 0) ^ hs(c.capTex) * 3) | 0;
      h = Math.imul(h ^ v, 0x01000193) + i | 0;
    }
    return h;
  }
  const sig = [];
  for (let i = 0; i < 7; i++) { const a = performance.now(); cellSig(m); sig.push(performance.now() - a); }
  out.cellSigMs = med(sig);
  // and the per-cell arrays it reads twice a second (arrSig over lvls, verts, floorCells, ceilCells and sideTex)
  function arrSig(a) { if (!a) return 0; let h = 0x811c9dc5 | 0; for (let i = 0; i < a.length; i++) { const v = a[i]; h = Math.imul(h ^ (typeof v === 'number' ? (v * 4096) | 0 : hs(v)), 16777619) | 0; } return h; }
  const arr = [];
  for (let i = 0; i < 5; i++) { const a = performance.now(); arrSig(m.lvls); arrSig(m.verts); arrSig(m.floorCells); arrSig(m.ceilCells); arrSig(m.sideTex); arr.push(performance.now() - a); }
  out.arrSigMs = med(arr);
  // and the light map R3D clears and uploads on every frame (js/r3d21.js frameLights): one 32-bit texel per cell.
  // Timed in a WebGL2 context of its own, so the game's GL state is left alone.
  try {
    const g2 = document.createElement('canvas').getContext('webgl2');
    const tx = g2.createTexture(); g2.bindTexture(g2.TEXTURE_2D, tx); g2.texStorage2D(g2.TEXTURE_2D, 1, g2.R32UI, m.w, m.h);
    const buf = new Uint32Array(m.w * m.h), up = [];
    for (let i = 0; i < 5; i++) { const a = performance.now(); buf.fill(0); g2.texSubImage2D(g2.TEXTURE_2D, 0, 0, 0, m.w, m.h, g2.RED_INTEGER, g2.UNSIGNED_INT, buf); g2.finish(); up.push(performance.now() - a); }
    out.lightMapMs = med(up); out.lightMapMB = buf.byteLength / 1048576;
    g2.deleteTexture(tx); const lose = g2.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  } catch (e) { out.lightMapMs = null; }
  return out;
}

// Runs inside the browser: the save. Once as loaded, once with the places explored (visited marks round each).
async function saveInPage() {
  const { m, id, places } = window.__lim;
  const measure = async () => {
    const a = performance.now(); const s = snapshotGame(); const b = performance.now();
    const json = JSON.stringify(s), mapJson = JSON.stringify(s.maps[id] || {});
    let code = '';
    try { code = await encodeSave(s); } catch (e) { code = ''; }
    return { snapMs: b - a, jsonBytes: json.length, mapBytes: mapJson.length, codeBytes: code.length };
  };
  const fresh = await measure();
  for (const p of places) for (let y = p.y - 24; y <= p.y + 24; y++) for (let x = p.x - 24; x <= p.x + 24; x++) {
    if (x >= 0 && y >= 0 && x < m.w && y < m.h && (x - p.x) ** 2 + (y - p.y) ** 2 <= 576) m.visited[y * m.w + x] = 1;
  }
  const explored = await measure();
  return { fresh, explored };
}

// ---------------------------------------------------------------- in Node
// The JS heap leaves out typed arrays' memory (ArrayBuffer backing stores), and under software rendering the GPU's
// buffers live in the GPU process; so also add up the resident memory of every process below this one (Linux /proc only).
function treeRSS(rootPid) {
  if (!rootPid || !fs.existsSync('/proc/' + rootPid)) return null;
  const kids = {};
  for (const d of fs.readdirSync('/proc')) {
    if (!/^[0-9]+$/.test(d)) continue;
    try { const st = fs.readFileSync('/proc/' + d + '/stat', 'utf8'); const ppid = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; (kids[ppid] = kids[ppid] || []).push(+d); } catch (e) { void e; }
  }
  let kbTotal = 0;
  const walk = (pid) => {
    try { const m = /VmRSS:\s+([0-9]+)/.exec(fs.readFileSync('/proc/' + pid + '/status', 'utf8')); if (m) kbTotal += +m[1]; } catch (e) { void e; }
    for (const k of kids[pid] || []) walk(k);
  };
  for (const k of kids[rootPid] || []) walk(k);
  return kbTotal / 1024;
}
async function heap(cdp, pid) {
  try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) { void e; }
  const r = await cdp.send('Performance.getMetrics');
  const k = (n) => { const x = r.metrics.find((q) => q.name === n); return x ? x.value : null; };
  let backing = null;
  try { const u = await cdp.send('Runtime.getHeapUsage'); if (u.backingStorageSize != null) backing = u.backingStorageSize; } catch (e) { void e; }
  return { used: k('JSHeapUsedSize'), total: k('JSHeapTotalSize'), backing, rssMB: treeRSS(pid) };
}
async function runSize(N) {
  const res = { size: N, cells: N * N, step: 'open' };
  const T0 = Date.now();
  let s = null, timer = null;
  const work = (async () => {
    s = await H.open();
    if (!s) throw new Error('Playwright not found: run with NODE_PATH=$(npm root -g)');
    await H.begin(s.page);
    res.gameLoadMs = Date.now() - T0;
    // the real ledge's mesh, for comparison with the test map of the same size
    res.ledgeMesh = await s.page.evaluate(() => (R3D.mesh && R3D.mesh()) || null);
    const cdp = await s.page.context().newCDPSession(s.page);
    await cdp.send('Performance.enable');
    // Chromium runs as children of this Node process: add up everything below it, not counting Node itself
    const pid = process.pid;
    const h0 = await heap(cdp, pid);
    res.step = 'build';
    res.build = await s.page.evaluate(buildInPage, N);
    res.step = 'load';
    res.load = await s.page.evaluate(loadInPage);
    res.step = 'heap';
    const h1 = await heap(cdp, pid);
    const MB = 1048576;
    res.heap = { baseMB: h0.used / MB, withMapMB: h1.used / MB, mapMB: (h1.used - h0.used) / MB,
      backingMapMB: h0.backing != null && h1.backing != null ? (h1.backing - h0.backing) / MB : null,
      rssBaseMB: h0.rssMB, rssWithMapMB: h1.rssMB, rssMapMB: h0.rssMB != null && h1.rssMB != null ? h1.rssMB - h0.rssMB : null };
    res.step = 'frames';
    res.frames = await s.page.evaluate(framesInPage, FRAMES);
    res.step = 'save';
    res.save = await s.page.evaluate(saveInPage);
    res.errors = s.errors.slice(0, 5);
    res.step = 'done';
  })();
  const timeout = new Promise((r) => { timer = setTimeout(() => r('timeout'), LIMIT_MS); });
  const how = await Promise.race([work.then(() => 'ok', (e) => { res.error = String(e && e.message || e).slice(0, 300); return 'error'; }), timeout]);
  clearTimeout(timer);
  if (how === 'timeout') res.stopped = 'over 3 minutes, stopped at step ' + res.step;
  res.wallMs = Date.now() - T0;
  if (s) await s.close().catch(() => {});
  await work.catch(() => {});
  return res;
}

const f1 = (v) => v == null || !isFinite(v) ? '-' : (Math.round(v * 10) / 10).toString();
const kb = (v) => v == null ? '-' : Math.round(v / 1024) + ' KB';
function table(rows) {
  const out = [];
  out.push('| Map | Cells | Entities | Lights | Build map (ms) | Mesh build (ms) | Vertices | Triangles | GPU buffers (MB) | First frame (ms) | Frame, middle (ms) | Frame, across (ms) | update() (ms) | Change check, every frame (ms) | Array check, twice a second (ms) | Light map upload, every frame (ms) | JS heap for the map (MB) | Chromium memory for the map (MB) | Snapshot JSON | Map in it | Save code | Save code, explored |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (!r.load) { out.push('| ' + r.size + ' x ' + r.size + ' | ' + r.cells + ' | ' + (r.stopped || r.error || 'did not load') + ' |'); continue; }
    const me = r.load.mesh || {}, fv = (r.frames && r.frames.views) || [], sv = r.save || {};
    const gpuMB = me.verts != null ? (me.verts * 48 + me.tris * 12) / 1048576 : null;
    out.push('| ' + [r.size + ' x ' + r.size, r.cells, r.build.entities, r.build.lights, f1(r.build.genMs), f1(me.ms), me.verts, me.tris, f1(gpuMB), f1(r.load.firstFrameMs),
      fv[0] ? f1(fv[0].render) : '-', fv[1] ? f1(fv[1].render) : '-', fv[0] ? f1(fv[0].update) : '-', r.frames ? f1(r.frames.cellSigMs) : '-', r.frames ? f1(r.frames.arrSigMs) : '-', r.frames ? f1(r.frames.lightMapMs) : '-', r.heap ? f1(r.heap.mapMB) : '-', r.heap ? f1(r.heap.rssMapMB) : '-',
      sv.fresh ? kb(sv.fresh.jsonBytes) : '-', sv.fresh ? kb(sv.fresh.mapBytes) : '-', sv.fresh ? kb(sv.fresh.codeBytes) : '-', sv.explored ? kb(sv.explored.codeBytes) : '-'].join(' | ') + ' |' + (r.stopped ? ' ' + r.stopped : ''));
  }
  return out.join('\n');
}

module.exports = { buildInPage, loadInPage, framesInPage, saveInPage, runSize, table };
if (require.main === module) (async () => {
  if (!H.playwright()) { console.log('Playwright not found: run with NODE_PATH=$(npm root -g)'); process.exit(1); }
  const rows = [];
  for (const N of SIZES) {
    console.log('== ' + N + ' x ' + N);
    const r = await runSize(N);
    rows.push(r);
    console.log(JSON.stringify(r));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), frames: FRAMES, renderer: 'headless Chromium, SwiftShader (software)', rows }, null, 1) + '\n');
  }
  console.log('\n' + table(rows));
  console.log('\nwrote ' + path.relative(process.cwd(), OUT));
})().catch((e) => { console.error(e); process.exit(1); });
