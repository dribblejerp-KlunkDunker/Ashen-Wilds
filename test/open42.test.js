// node test/open42.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/open42.test.js     with Playwright installed globally
// Phase 42, one open country: the highland edge (Z1) as one map of 1,536 x 1,536, with no rock between its parts; the
// same ground as Phase 40's maps; made a piece at a time; walked from the ledge to the fork without a seam.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'threshold40.js'));
const O = require(path.join(ROOT, 'js', 'open42.js'));
const noBrowser = process.argv.includes('--no-browser');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// ---- the map is the zone
check(O.ID === 'la_z1' && O.W === 1536 && O.H === 1536 && O.W === T.ZONE.w && O.H === T.ZONE.h, 'one map, la_z1, the whole of Z1: 1,536 x 1,536 cells');
check(O.W * O.H > 65536, 'big enough that the renderer streams it in chunks (Phase 41)');

// ---- the ways, stamped, are the ways asked for cell by cell
const M = O.waysMask();
let wd = 0, wn = 0;
for (let y = 0; y < O.H; y += 3) for (let x = 0; x < O.W; x += 2) { wn++; const w = O.wayAt(x, y); if ((w ? T.WAYS.indexOf(w) + 1 : 0) !== M[y * O.W + x]) wd++; }
check(wd === 0 && wn > 300000, 'the nine ways stamped a segment at a time are the same cells as asked one by one (' + wn + ' cells)');

// ---- the same ground as Phase 40's, without its inner bands
let same = 0, diff = 0, notch = 0, inner = 0;
for (let y = 0; y < O.H; y += 2) for (let x = 0; x < O.W; x += 2) {
  const e = T.edgeOf(x + 0.5, y + 0.5), outer = e.at === 0 || (e.axis === 'x' ? e.at === O.W : e.at === O.H);
  const a = O.cellAt(x, y, M), b = T.cellAt(x, y);
  const ein = Math.min(x + 0.5, y + 0.5, O.W - x - 0.5, O.H - y - 0.5);
  if (!outer && e.d < T.BAND + 8) { if (b.solid === 'band' && a.solid && ein >= T.BAND && a.solid !== 'crag') inner++; continue; }
  if (a.solid === b.solid && a.way === b.way) same++;
  else if (outer && a.way && a.way.name === 'The upper road') notch++;
  else diff++;
}
check(diff === 0 && same > 400000, 'away from Phase 40\'s inner edges, every cell is Phase 40\'s (' + same + ' cells): the same crag, cleft, ways and edge');
check(inner === 0, 'and where Phase 40 stood a band between its maps, there is no rock');
check(notch > 0, 'the only other difference: the upper road\'s notch at the zone\'s south edge');
// walking, as rock allows: one flood from the crag's foot reaches every place on the ways
{
  const solid = new Uint8Array(O.W * O.H);
  for (let y = 0; y < O.H; y++) for (let x = 0; x < O.W; x++) if (O.cellAt(x, y, M).solid || x === 0 || y === 0 || x === O.W - 1 || y === O.H - 1) solid[y * O.W + x] = 1;
  const seen = new Uint8Array(O.W * O.H), q = new Int32Array(O.W * O.H);
  let h = 0, t = 0; const s0 = Math.floor(T.ARRIVE_Z1.y) * O.W + Math.floor(T.ARRIVE_Z1.x);
  q[t++] = s0; seen[s0] = 1;
  while (h < t) {
    const k = q[h++], x = k % O.W, y = (k / O.W) | 0;
    for (const n of [k - 1, k + 1, k - O.W, k + O.W]) { if (n < 0 || n >= solid.length || seen[n] || solid[n]) continue; if ((n % O.W === 0 && x === O.W - 1) || (x === 0 && n % O.W === O.W - 1)) continue; seen[n] = 1; q[t++] = n; }
  }
  const at = (x, y) => seen[Math.floor(y) * O.W + Math.floor(x)] === 1;
  const ends = []; for (const w of T.WAYS) for (const p of w.pts) if (!O.cellAt(Math.floor(p[0]), Math.floor(p[1]), M).solid) ends.push(p);
  const missed = ends.filter((p) => !at(p[0], p[1]));
  check(!solid[s0] && missed.length === 0 && ends.length === 40, 'from the crag\'s foot every point of every way can be walked to, through no cut (' + ends.length + ' points, ' + (t / 1e6).toFixed(2) + 'M cells open)');
  const cl = Math.floor(T.CLEFT.y0 + 1) * O.W + Math.floor(T.CLEFT.x);
  check(seen[cl] === 1, 'and the cleft up to the ledge');
  const n = O.notches();
  check(n.length === 1 && n[0].way.name === 'The upper road' && solid[1534 * O.W + 759] && !solid[1530 * O.W + 759], 'one way leaves the zone, the upper road south; it ends in a notch 3 short of the edge');
}
const ac = O.cellAt(Math.floor(T.ARRIVE_Z1.x), Math.floor(T.ARRIVE_Z1.y), M);
check(!ac.solid && ac.way && ac.way.name === 'The ledge path', 'going down from the ledge, you stand on the ledge path at the crag\'s foot, as in Phase 40');

const src = fs.readFileSync(path.join(ROOT, 'js', 'open42.js'), 'utf8');
check(!/Math\.random|Date\.now/.test(src) && (src.match(/performance\.now/g) || []).length === 2 && /const t0 = performance\.now\(\);/.test(src), 'no dice; the clock is read only to stop a slice of making after 8 ms');
check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'plain ASCII');
check(!src.split('\n').some((l) => /\S.*[;{)]\s*\/\/ /.test(l) && !/['"`].*\/\/.*['"`]/.test(l)), 'no comment after code on a line');

// ---------------------------------------------------------------- the browser half
(async () => {
  if (noBrowser) return;
  const H = require(path.join(__dirname, 'harness.js'));
  const s = await H.open();
  if (!s) { console.log('SKIP the browser half: Playwright not found (NODE_PATH=$(npm root -g))'); return; }
  try {
    await H.begin(s.page);
    await H.autopilot(s.page);
    const ev = (fn, arg) => s.page.evaluate(fn, arg);
    await ev(() => {
      window.__W42 = (x, y, ms) => {
        const c = Engine.cam, from = G.mapId, norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        let i = 0;
        for (; i < (ms || 20000) / 16.7 && G.mapId === from; i++) {
          const diff = norm(Math.atan2(y - c.y, x - c.x) - c.dir);
          if (Math.hypot(x - c.x, y - c.y) < 0.3) break;
          G.keys = { w: Math.abs(diff) < 0.5, arrowleft: diff < -0.06, arrowright: diff > 0.06 };
          update(1 / 60);
        }
        G.keys = {}; for (let k = 0; k < 10; k++) update(1 / 60);
        return { map: G.mapId, x: +c.x.toFixed(2), y: +c.y.toFixed(2), frames: i };
      };
    });

    // ---- 1. made a piece at a time from Begin, and the same as made at once
    const a1 = await ev(() => {
      const m = G.maps.la_z1, was = OPEN42.ready(m), st = Object.assign({}, OPEN42.state());
      const j = OPEN42.create(), t0 = performance.now(); OPEN42.finish(j.m); const ms = performance.now() - t0;
      OPEN42.finish(m);
      let d = 0;
      for (let i = 0; i < m.w * m.h; i++) { const a = m.cells[i], b = j.m.cells[i]; if ((a && a.top) !== (b && b.top) || (a && a.tex) !== (b && b.tex) || m.floorCells[i] !== j.m.floorCells[i] || m.lvls[i] !== j.m.lvls[i]) { d++; break; } }
      for (let i = 0; i < m.verts.length && !d; i++) if (m.verts[i] !== j.m.verts[i]) d++;
      return { was, steps: st.steps, ms: Math.round(ms), d, row: LEDGE1.SWITCHES.some((r) => r[0] === 'laOpenZone'), size: [m.w, m.h], n: OPEN42.ROWS };
    });
    console.log('   at this point after Begin the open map was ' + (a1.was ? 'made' : 'part made (' + a1.steps + ' steps)') + '; made at once it takes ' + a1.ms + ' ms here (software, two slow cores)');
    check(a1.steps > 0 && a1.d === 0 && a1.size.join() === '1536,1536', 'the open map, made a piece at a time from Begin, is cell for cell the map made at once');
    check(a1.row, 'Options has the switch "One open country"');

    // ---- 2. down through the gap, the carter following
    const a2 = await ev(() => {
      const c = Engine.cam; G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 52, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
      const k = CARTER13.state(); k.mode = 'follow'; k.map = 'la_ledge'; k.x = 86; k.y = 50.8; CARTER13.save();
      const w = __W42(86, 60);
      const cz = CARTER13.state(), body = G.ents.find((e) => e.id === 'la_carter');
      render();
      return { w, carter: [cz.map, +cz.x.toFixed(1), +cz.y.toFixed(1)], body: body ? [body.hidden, +Math.hypot(body.x - c.x, body.y - c.y).toFixed(1)] : null, st: R3D.stream() };
    });
    check(a2.w.map === 'la_z1' && Math.abs(a2.w.x - 990.5) < 0.5 && Math.abs(a2.w.y - 145.5) < 1.2, 'walking south through the gap, you come out at the crag\'s foot, in the open map: ' + JSON.stringify(a2.w));
    check(a2.carter[0] === 'la_z1' && a2.body && a2.body[0] === false && a2.body[1] < 3, 'the carter, following, comes down with you: ' + JSON.stringify(a2.carter));
    check(a2.st.on && a2.st.info.streamed, 'the renderer streams it: ' + a2.st.info.chunks + ' chunks, ' + a2.st.info.tris + ' triangles');

    // ---- 3. down the ledge path, past where Phase 40's band stood, to the Greystair fork: one map all the way
    const a3 = await ev(() => {
      const crossed = THRESH40.state().crossed, legs = [];
      for (const [x, y] of [[1000, 250], [960, 380], [930, 450], [900.5, 515.5]]) {
        const w = __W42(x, y, 90000), k = CARTER13.state();
        legs.push([w.map, w.x, w.y, k.map, +Math.hypot(k.x - Engine.cam.x, k.y - Engine.cam.y).toFixed(1)]);
      }
      return { legs, crossed: THRESH40.state().crossed - crossed, map: G.mapId, y: Engine.cam.y };
    });
    check(a3.map === 'la_z1' && a3.y > 500 && a3.crossed === 0 && a3.legs.every((l) => l[0] === 'la_z1'), 'from the crag down the ledge path to the fork, 370 cells, without crossing into another map: ' + JSON.stringify(a3.legs));
    check(a3.legs.every((l) => l[3] === 'la_z1' && l[4] < 8), 'and the carter walked it with you');

    // ---- 4. the same ground as Phase 40's two maps, where they have it
    const a4 = await ev(() => {
      const Z = G.maps.la_z1; let diff = 0, cells = 0;
      for (const id of ['la_z1_2_0', 'la_z1_2_1']) {
        const m = G.maps[id], D = THRESH40.MAPS[id];
        for (let y = 1; y < m.h - 1; y += 2) for (let x = 1; x < m.w - 1; x += 2) {
          const zx = x + D.ox, zy = y + D.oy, e = THRESH40.edgeOf(zx + 0.5, zy + 0.5);
          if (e.d < THRESH40.BAND + 8) continue;
          cells++;
          const a = m.get(x, y), b = Z.get(zx, zy);
          if (!!a !== !!b || (a && b && Math.abs(a.top - b.top) > 1e-6) || Math.abs(m.groundAt(x + 0.5, y + 0.5) - Z.groundAt(zx + 0.5, zy + 0.5)) > 1e-6 || m.floorCells[y * m.w + x] !== Z.floorCells[zy * Z.w + zx]) diff++;
        }
      }
      return { diff, cells };
    });
    check(a4.diff === 0 && a4.cells > 50000, 'the ground, the rock and the floor are Phase 40\'s, cell for cell, wherever its maps have them (' + a4.cells + ' cells)');

    // ---- 5. the upper road's notch at the zone's south edge
    const a5 = await ev(() => {
      G.state = 'paused'; loadMap('la_z1', { x: 760.5, y: 1500.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      document.querySelector('#msgs').innerHTML = '';
      const w = __W42(760.5, 1535, 15000);
      return { w, said: document.querySelector('#msgs').innerText };
    });
    check(a5.w.map === 'la_z1' && a5.w.y > 1528 && a5.w.y < 1534 && /upper road goes on from here\. That country is not built yet\./.test(a5.said), 'the upper road ends in a notch at the zone\'s edge and says so: ' + JSON.stringify([a5.w, a5.said.slice(0, 80)]));

    // ---- 6. the map (M), a cell to a pixel
    const a6 = await ev(() => {
      G.state = 'paused'; loadMap('la_z1', { x: 990.5, y: 150, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      __W42(990.5, 200, 20000);
      renderMap(); const cv = document.getElementById('amap'); const w = cv ? [cv.width, cv.height] : null;
      const d = cv.getContext('2d').getImageData(980, 150, 20, 50).data; let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) lit++;
      closeModal(); G.state = 'play';
      return { w, lit, err: OPEN42.state().err };
    });
    check(a6.w && a6.w.join() === '1536,1536' && a6.lit > 100 && !a6.err, 'the map (M) is a cell to a pixel, and shows what you walked: ' + JSON.stringify(a6));

    // ---- 7. up the cleft, with Marget on your arm; her body goes with her
    const a7 = await ev(() => {
      G.state = 'paused'; loadMap('la_z1', { x: 990.5, y: 150, dir: -Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_marget_out = true; G.flags.la_marget_map = 'la_z1'; G.flags.la_marget_promise = true;
      CARRY15.attachNow();
      const w = __W42(990.5, 128, 20000);
      const her = (id) => G.maps[id].entities.find((e) => e.id === 'la_marget');
      return { w, on: CARRY15.state().on, where: G.flags.la_marget_map, ledge: her('la_ledge').hidden, z: her('la_z1').hidden };
    });
    check(a7.w.map === 'la_ledge' && Math.abs(a7.w.x - 86) < 0.6 && a7.on && a7.where === 'la_ledge' && a7.ledge === false && a7.z === true, 'up the cleft, you are on the ledge with her on your arm; her body below is gone: ' + JSON.stringify(a7));

    // ---- 8. Walk on, on the end card
    const a8 = await ev(async () => {
      G.state = 'paused'; loadMap('la_ledge', { x: 87, y: 41.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_title_seen = true; G.flags.la_prologue_end = false;
      PROLOGUE39.show(); document.getElementById('la-walk-on').click();
      await new Promise((r) => setTimeout(r, 50)); advanceTime(50);
      return { map: G.mapId, x: +Engine.cam.x.toFixed(1), y: +Engine.cam.y.toFixed(1), on: CARRY15.state().on, where: G.flags.la_marget_map };
    });
    check(a8.map === 'la_z1' && a8.on && a8.where === 'la_z1', 'Walk on on the end card takes the company down into the open map, her on your arm: ' + JSON.stringify(a8));

    // ---- 9. a save made there opens there: the map is made at once if it has to be
    const a9 = await ev(() => {
      try { CARRY15.releaseNow(); } catch (e) { /* not carrying */ }
      G.flags.la_marget_out = false;
      const k = CARTER13.state(); k.mode = 'follow'; k.map = 'la_z1'; k.x = 990; k.y = 160; CARTER13.save();
      G.state = 'paused'; loadMap('la_z1', { x: 960.5, y: 380.5, dir: Math.PI / 2 }); G.state = 'play';
      const d = snapshotGame(), at = OPEN42.state().finishedAtOnce;
      restoreGame(JSON.parse(JSON.stringify(d)));
      return { map: G.mapId, x: +Engine.cam.x.toFixed(1), y: +Engine.cam.y.toFixed(1), ready: OPEN42.ready(G.map), atOnce: OPEN42.state().finishedAtOnce - at, carter: CARTER13.state().map, json: JSON.stringify(d).length };
    });
    check(a9.map === 'la_z1' && a9.ready && a9.atOnce === 1 && Math.abs(a9.y - 380.5) < 0.1 && a9.carter === 'la_z1', 'a save made in the open map opens there, the map made at once on loading: ' + JSON.stringify(a9));
    console.log('   a snapshot with the open map in it is ' + Math.round(a9.json / 1024) + ' KB of JSON');

    // ---- 10. the walking bloom follows you down through the gap
    const a10 = await ev(() => {
      G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 55.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      BLOOM4.reset();
      const S = BLOOM4.state(); Object.assign(S, { map: 'la_ledge', x: 86.2, y: 49, state: 'come', tx: 86, ty: 55.5, t: 0, held: false });
      __W42(86, 60);
      const at = G.mapId;
      for (let i = 0; i < 60 * 20 && BLOOM4.state().map === 'la_ledge'; i++) update(1 / 60);
      const out = { at, bloom: BLOOM4.state().map };
      BLOOM4.reset();
      return out;
    });
    check(a10.at === 'la_z1' && a10.bloom === 'la_z1', 'the walking bloom, hunting you, comes down through the gap into the open map: ' + JSON.stringify(a10));

    // ---- 11. the switch: off, the way down is Phase 40's; nothing on the ledge is drawn differently either way (the ledge
    // has ash, smoke and firelight on the engine's clocks, so its frames never hash alike twice: what is drawn is compared)
    const a11 = await ev(async () => {
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const look = () => {
        G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 50, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0; render(); render();
        const m = G.map, me = R3D.mesh() || {};
        return [fnv(new Uint32Array(m.cells.map((c) => (c ? (c.top * 1000) | 0 : 0)))), fnv(m.floorCells), fnv(new Uint8Array(m.verts.buffer)), me.tris || me.triangles || 0].join(':');
      };
      GFX.laOpenZone = true; const on = look();
      GFX.laOpenZone = false; const off = look();
      const w = __W42(86, 60);
      G.state = 'paused'; loadMap('la_ledge', { x: 87, y: 41.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_title_seen = true; G.flags.la_prologue_end = false; PROLOGUE39.show(); document.getElementById('la-walk-on').click();
      await new Promise((r) => setTimeout(r, 50)); advanceTime(50);
      const walk = G.mapId;
      GFX.laOpenZone = true;
      return { on, off, w: w.map, walk };
    });
    check(a11.on === a11.off, 'the ledge is the same map, its rock, floor, ground and mesh, switch on or off: ' + a11.on);
    check(a11.w === 'la_z1_2_0' && a11.walk === 'la_z1_2_0', 'off, the gap and Walk on lead to Phase 40\'s ledge path map, as before: ' + JSON.stringify([a11.w, a11.walk]));

    const err = await ev(() => OPEN42.state().err || THRESH40.state().err);
    check(!err, 'the wire ran without an error' + (err ? ': ' + err : ''));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
