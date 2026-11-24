// node test/threshold40.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/threshold40.test.js     with Playwright installed globally
// Phase 40, walking from one map into the next: the first two maps of the highland edge (Z1), the cut between them, the
// gap in the ledge's boulders, and who and what comes with you.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'threshold40.js'));
const L = require(path.join(ROOT, 'js', 'ledge1.js'));
const noBrowser = process.argv.includes('--no-browser');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// ---- the ways are the zone plan's
const z = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'atlas', '10-zones.md'), 'utf8');
const z1 = z.slice(z.indexOf('## Z1.'), z.indexOf('## Z2.'));
const rows = z1.slice(z1.indexOf('| Way | Kind | Points |')).split('\n').slice(2).filter((l) => /^\|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const md = rows.map((r) => r[0] + '|' + r[1] + '|' + r[2]).join('\n');
const js = T.WAYS.map((w) => w.name + '|' + w.kind + '|' + w.pts.map((p) => p.join(',')).join(' ')).join('\n');
check(rows.length === 9 && md === js, 'the nine ways are Z1\'s, as atlas/10-zones.md draws them');
const gate = /\| 1 \| The ledge \(`la_ledge`\) \| 990, 140 \| complex \|/.test(z1);
check(gate && T.CRAG.x === 990 && T.CLEFT.y1 <= 142, 'the ledge\'s gate is where Z1 puts it (990, 140)');

// ---- the maps: no bigger than O17 allows, the zone's own grid
const M = T.MAPS;
check(Object.keys(M).join() === 'la_z1_2_0,la_z1_2_1', 'two maps: la_z1_2_0 and la_z1_2_1');
check(Object.values(M).every((m) => m.w === T.TILE && m.h === T.TILE + T.MARGIN && m.w * m.h <= 512 * 512 && m.ox === m.col * T.TILE), 'each is its 384 square of the zone, and 20 cells of its neighbour (O17: under 512)');
check(M.la_z1_2_0.oy === 0 && M.la_z1_2_1.oy === T.TILE - T.MARGIN, 'they overlap by 20 cells at their seam (zone y 364 to 404)');

// ---- what crosses which edge
const P = T.plan();
check(P.cuts.length === 1 && P.cuts[0].crossing.way.name === 'The ledge path' && P.cuts[0].from === 'la_z1_2_0' && P.cuts[0].to === 'la_z1_2_1', 'one cut between built maps: the ledge path at zone y 384');
check(P.notches.length === 4 && P.notches.every((n) => n.inside === 'la_z1_2_1') && P.notches.map((n) => n.crossing.way.name).sort().join() === ["The Greystair road", "The last climb", "The upper road", "Wilmot's path"].join(), 'four ways leave the fork for country not built yet, each into a notch');

// ---- the band, the cut and the notches, cell by cell (zone coordinates)
const solid = (x, y) => !!T.cellAt(Math.floor(x), Math.floor(y)).solid;
// the band along the seam lets nobody through but by the cut: from the north side, with the cut's cells shut, nothing
// on the south side of the band can be reached
{
  const cutCell = (x, y) => T.inCut(P.cuts[0], x + 0.5, y + 0.5);
  const seen0 = new Set(), q0 = [];
  for (let x = 770; x < 1150; x++) q0.push([x, 366]);
  let through = 0;
  while (q0.length) {
    const [x, y] = q0.pop(), k = x + ',' + y;
    if (seen0.has(k) || x < 768 || x >= 1152 || y < 364 || y > 404 || solid(x, y) || cutCell(x, y)) continue;
    seen0.add(k); if (y >= 384 + T.BAND) through++;
    q0.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  check(through === 0 && seen0.size > 1000, 'the band along the seam lets nothing through but the cut');
}
// the cut can be walked from one map into the other: a chain of open cells from one end to the other
const cut = P.cuts[0], a = cut.pts[0], b = cut.pts[cut.pts.length - 1];
const seen = new Set(), q = [[Math.floor(a[0]), Math.floor(a[1])]];
while (q.length) { const [x, y] = q.pop(); const k = x + ',' + y; if (seen.has(k) || solid(x, y) || Math.hypot(x - 958, y - 384) > 30) continue; seen.add(k); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
check(seen.has(Math.floor(b[0]) + ',' + Math.floor(b[1])), 'the cut is open from one map\'s side of the band to the other');
// no straight look out of a map: every ray from an open cell north of the seam that reaches past the far side of the
// band meets rock first (and the same from the south)
let leaks = 0, rays = 0;
for (const k of seen) {
  const [cx, cy] = k.split(',').map(Number);
  const side = cy + 0.5 < 384 ? -1 : 1;
  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
    if (dy * side >= -0.05) continue;
    rays++;
    for (let t = 0.5; t < 60; t += 0.25) {
      const x = cx + 0.5 + dx * t, y = cy + 0.5 + dy * t;
      if (solid(x, y) && !(Math.floor(x) === cx && Math.floor(y) === cy)) break;
      if ((y - 384) * -side > T.BAND + 0.5 && (y - 384) * -side < T.MARGIN + 0.5 && Math.floor(y) !== cy) { leaks++; break; }
    }
  }
}
check(rays > 1000 && leaks === 0, 'no line of sight runs out through the cut into the other map\'s far edge (' + rays + ' rays, ' + leaks + ' out)');
const notchShut = P.notches.every((n) => { const c = n.crossing; const at = c.axis === 'x' ? [c.at - 0.5 * Math.sign(c.at - 958), c.y] : [c.x, c.at - 0.5]; return solid(at[0], at[1]); });
check(notchShut, 'a notch stops short of its edge: rock between it and country not built');
const notchOpen = P.notches.every((n) => {
  const c = n.crossing, lower = n.inside === (c.a[0] === 2 && c.a[1] === 1 ? 'la_z1_2_1' : null) ? -1 : 1, s = c.at + lower * 6;
  for (let l = -8; l <= 8; l += 0.5) { const at = c.axis === 'x' ? [s, c.y + l] : [c.x + l, s]; if (!solid(at[0], at[1]) && T.lineDist(at[0], at[1], c.way.pts) < 1.5) return true; }
  return false;
});
check(notchOpen, 'and is open six cells into the band, so you can walk into it');
// the ground is one function of zone coordinates, so the overlap is the same in both maps; the cut is gentle enough to walk
let steep = 0;
for (let i = 0; i + 1 < cut.pts.length; i++) for (let t = 0; t < 1; t += 0.05) { const x = cut.pts[i][0] + (cut.pts[i + 1][0] - cut.pts[i][0]) * t, y = cut.pts[i][1] + (cut.pts[i + 1][1] - cut.pts[i][1]) * t; if (Math.abs(T.H(x + 0.5, y) - T.H(x, y)) * 2 > 1.1 || Math.abs(T.H(x, y + 0.5) - T.H(x, y)) * 2 > 1.1) steep++; }
check(steep === 0, 'the cut\'s floor is never steeper than a walker climbs (1.1)');

// ---- the ledge's gap and where you come out
check(T.GAP.y === L.PLATEAU.y1 && T.GAP.x0 > L.PLATEAU.x0 && T.GAP.x1 < L.PLATEAU.x1 && T.GAP.x1 - T.GAP.x0 === 1, 'the gap is two of the boulders along the ledge\'s south end (the ramp is at its north end)');
check(L.landH(T.ARRIVE_LEDGE.x, T.ARRIVE_LEDGE.y) === L.PLATEAU.h, 'coming up, you stand on the ledge\'s top');
const ac = T.cellAt(Math.floor(T.ARRIVE_Z1.x), Math.floor(T.ARRIVE_Z1.y));
check(!ac.solid && ac.way && ac.way.name === 'The ledge path', 'going down, you stand on the ledge path at the crag\'s foot');
check(!T.cellAt(990, 135).solid && T.cellAt(986, 125).solid, 'a cleft goes up into the crag, and the crag is rock round it');

const src = fs.readFileSync(path.join(ROOT, 'js', 'threshold40.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure shapes, plain ASCII, no clock and no dice');
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
    // a walker that stops when the map changes
    await ev(() => {
      window.__W40 = (x, y, ms) => {
        const c = Engine.cam, from = G.mapId, norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        let i = 0;
        for (; i < (ms || 20000) / 16.7 && G.mapId === from; i++) {
          const diff = norm(Math.atan2(y - c.y, x - c.x) - c.dir);
          if (Math.hypot(x - c.x, y - c.y) < 0.3) break;
          G.keys = { w: Math.abs(diff) < 0.5, arrowleft: diff < -0.06, arrowright: diff > 0.06 };
          update(1 / 60);
        }
        G.keys = {}; for (let k = 0; k < 10; k++) update(1 / 60);
        return { map: G.mapId, x: +c.x.toFixed(2), y: +c.y.toFixed(2), dir: +c.dir.toFixed(2), frames: i };
      };
    });

    // ---- 1. the maps, the gap and the switch
    const a1 = await ev(() => {
      const t0 = performance.now(); buildAllMaps(); const ms = performance.now() - t0;
      const m = G.maps.la_ledge;
      return { maps: Object.keys(G.maps).sort(), ms: Math.round(ms), gap: [m.get(85, 58), m.get(86, 58)], drop: [m.floorCells[59 * m.w + 85], m.floorCells[59 * m.w + 86]], row: LEDGE1.SWITCHES.some((r) => r[0] === 'laThresholds'), err: THRESH40.state().err };
    });
    check(a1.maps.join() === 'la_bothy,la_ledge,la_z1_2_0,la_z1_2_1', 'the game has its four maps: ' + a1.maps.join(', '));
    console.log('   building every map takes ' + a1.ms + ' ms here (software, two slow cores)');
    check(a1.gap[0] === null && a1.gap[1] === null && a1.drop[0] === 2 && a1.drop[1] === 2, 'two of the ledge\'s south boulders are gone, and the drop below them holds');
    check(a1.row, 'Options has the switch "Ways between maps"');

    // ---- 2. down through the gap, the carter following
    const a2 = await ev(() => {
      const c = Engine.cam; G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 52, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      BLOOM4.pose({ map: 'la_bothy', x: 3.5, y: 2.5, state: 'wait' });
      const k = CARTER13.state(); k.mode = 'follow'; k.map = 'la_ledge'; k.x = 86; k.y = 50.8; CARTER13.save();
      const w = __W40(86, 60);
      const cz = CARTER13.state(), body = G.ents.find((e) => e.id === 'la_carter');
      return { w, carter: [cz.map, +cz.x.toFixed(1), +cz.y.toFixed(1)], body: body ? [body.hidden, +Math.hypot(body.x - c.x, body.y - c.y).toFixed(1)] : null, ledgeBody: G.maps.la_ledge.entities.find((e) => e.id === 'la_carter').hidden };
    });
    check(a2.w.map === 'la_z1_2_0' && Math.abs(a2.w.x - 222.5) < 0.5 && Math.abs(a2.w.y - 145.5) < 1.2, 'walking south through the gap, you come out on the ledge path at the crag\'s foot: ' + JSON.stringify(a2.w));
    check(a2.carter[0] === 'la_z1_2_0' && a2.body && a2.body[0] === false && a2.body[1] < 3 && a2.ledgeBody === true, 'the carter, following, comes down with you: ' + JSON.stringify(a2));

    // ---- 3. down the ledge path, through the cut, onto the fork's map; and back
    const a3 = await ev(() => {
      const D = THRESH40.MAPS.la_z1_2_0, cut = THRESH40.plan().cuts[0].pts;
      const out = { legs: [] };
      // the ledge path from the crag to the cut's mouth, then the cut's bends, in this map's cells
      const way = [[1000, 250], [962.4, 372], cut[1], cut[2], cut[3]];
      for (const [zx, zy] of way) {
        const before = G.mapId, D2 = THRESH40.MAPS[G.mapId];
        const w = __W40(zx - D2.ox, zy - D2.oy, 60000);
        const k = CARTER13.state();
        out.legs.push([before, w.map, w.x, w.y, k.map, +k.x.toFixed(1), +k.y.toFixed(1), k.mode]);
      }
      out.map = G.mapId; out.zone = [Engine.cam.x + THRESH40.MAPS[G.mapId].ox, Engine.cam.y + THRESH40.MAPS[G.mapId].oy].map((v) => +v.toFixed(1));
      out.fade = G.fadeT; out.carter = CARTER13.state().map;
      // and back north: to the first bend, on the other side
      const D1 = THRESH40.MAPS[G.mapId];
      __W40(cut[2][0] - D1.ox, cut[2][1] - D1.oy, 30000);
      const back = __W40(cut[1][0] - D1.ox, cut[1][1] - D1.oy, 30000);
      out.back = [back.map, +(back.y + THRESH40.MAPS[back.map].oy).toFixed(1)];
      out.err = THRESH40.state().err;
      return out;
    });
    check(a3.map === 'la_z1_2_1' && a3.zone[1] > 384, 'down the ledge path and through the cut, you are on the Greystair fork\'s map: ' + JSON.stringify(a3.legs));
    check(a3.fade === 0, 'a seam is crossed without the fade a door has');
    check(a3.carter === 'la_z1_2_1', 'and the carter came through the cut too: ' + JSON.stringify(a3.legs));
    check(a3.back[0] === 'la_z1_2_0' && a3.back[1] < 384, 'walking back north through the cut, you are on the ledge path\'s map again: ' + JSON.stringify(a3.back));

    // ---- 4. the same place on both sides of the seam
    const a4 = await ev(() => {
      const A = G.maps.la_z1_2_0, B = G.maps.la_z1_2_1, dA = THRESH40.MAPS.la_z1_2_0, dB = THRESH40.MAPS.la_z1_2_1;
      let diff = 0, cells = 0;
      // every cell both maps have, but their own outermost rows (each map's border)
      for (let zy = dB.oy + 1; zy < dA.oy + dA.h - 1; zy++) for (let zx = dA.ox + 1; zx < dA.ox + dA.w - 1; zx += 3) {
        const ca = A.get(zx - dA.ox, zy - dA.oy), cb = B.get(zx - dB.ox, zy - dB.oy);
        const ga = A.groundAt(zx - dA.ox + 0.5, zy - dA.oy + 0.5), gb = B.groundAt(zx - dB.ox + 0.5, zy - dB.oy + 0.5);
        cells++;
        if (!!ca !== !!cb || (ca && cb && Math.abs((ca.top || 0) - (cb.top || 0)) > 1e-6) || Math.abs(ga - gb) > 1e-6) diff++;
      }
      return { diff, cells };
    });
    check(a4.diff === 0 && a4.cells > 1000, 'in the 20 cells the maps share, the ground and the rock are the same on both (' + a4.cells + ' cells)');

    // ---- 5. a notch: the way into country not built yet
    const a5 = await ev(() => {
      const n = THRESH40.plan().notches.find((q) => q.crossing.way.name === 'The Greystair road'), c = n.crossing, D = THRESH40.MAPS.la_z1_2_1;
      G.state = 'paused'; loadMap('la_z1_2_1', { x: c.x - 16 - D.ox, y: c.y + 5 - D.oy, dir: 0 }); G.state = 'play'; G.fadeT = 0;
      document.querySelector('#msgs').innerHTML = '';
      const w = __W40(c.at - 1 - D.ox, c.y - D.oy, 15000);
      return { w, said: document.querySelector('#msgs').innerText };
    });
    check(a5.w.map === 'la_z1_2_1' && /Greystair road goes on from here\. That country is not built yet\./.test(a5.said), 'the Greystair road ends in a notch and says so: ' + JSON.stringify(a5.said.slice(0, 120)));

    // ---- 6. up the cleft, with Marget on your arm; her body goes with her
    const a6 = await ev(() => {
      const D = THRESH40.MAPS.la_z1_2_0;
      G.state = 'paused'; loadMap('la_z1_2_0', { x: 222.5, y: 150, dir: -Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_marget_out = true; G.flags.la_marget_map = 'la_z1_2_0'; G.flags.la_marget_promise = true;
      CARRY15.attachNow();
      const w = __W40(222.5, 128, 20000);
      const her = (id) => G.maps[id].entities.find((e) => e.id === 'la_marget');
      return { w, on: CARRY15.state().on, where: G.flags.la_marget_map, ledge: her('la_ledge').hidden, z: her('la_z1_2_0').hidden, near: +Math.hypot(her('la_ledge').x - Engine.cam.x, her('la_ledge').y - Engine.cam.y).toFixed(2) };
    });
    check(a6.w.map === 'la_ledge' && Math.abs(a6.w.x - 86) < 0.6 && Math.abs(a6.w.y - 56.9) < 1, 'up the cleft in the crag, you come out on the ledge by its gap: ' + JSON.stringify(a6.w));
    check(a6.on && a6.where === 'la_ledge' && a6.ledge === false && a6.z === true && a6.near < 1.6, 'Marget Sayle is still on your arm, on the ledge; her body below is gone: ' + JSON.stringify(a6));

    // ---- 7. Walk on, on the end card
    const a7 = await ev(async () => {
      G.state = 'paused'; loadMap('la_ledge', { x: 87, y: 41.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_title_seen = true; G.flags.la_prologue_end = false;
      PROLOGUE39.show();
      document.getElementById('la-walk-on').click();
      await new Promise((r) => setTimeout(r, 50));
      advanceTime(50);
      return { map: G.mapId, x: +Engine.cam.x.toFixed(1), y: +Engine.cam.y.toFixed(1), on: CARRY15.state().on, where: G.flags.la_marget_map, walkOn: THRESH40.state().walkOn, panel: G.openPanel };
    });
    check(a7.map === 'la_z1_2_0' && a7.on && a7.where === 'la_z1_2_0' && !a7.panel, 'Walk on on the end card takes the company down the ledge path, her on your arm: ' + JSON.stringify(a7));

    // ---- 8. a save on the highland edge opens there, with the carter where he was
    const a8 = await ev(() => {
      const k = CARTER13.state(); k.map = 'la_z1_2_0'; k.x = 223; k.y = 148; CARTER13.save();
      const d = snapshotGame(); const json = JSON.stringify(d).length;
      restoreGame(JSON.parse(JSON.stringify(d)));
      return { map: G.mapId, carter: CARTER13.state().map, json, body: (G.ents.find((e) => e.id === 'la_carter') || {}).hidden };
    });
    check(a8.map === 'la_z1_2_0' && a8.carter === 'la_z1_2_0' && a8.body === false, 'a save made below the ledge opens below the ledge, the carter with you: ' + JSON.stringify(a8));

    // ---- 9. the walking bloom follows you through the gap it heard you take
    const a9 = await ev(() => {
      G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 55.5, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      G.flags.la_marget_out = false; try { CARRY15.releaseNow(); } catch (e) { /* not carrying */ }
      BLOOM4.reset();
      const S = BLOOM4.state(); Object.assign(S, { map: 'la_ledge', x: 86.2, y: 49, state: 'come', tx: 86, ty: 55.5, t: 0, held: false });
      __W40(86, 60);
      const at = G.mapId;
      for (let i = 0; i < 60 * 20 && BLOOM4.state().map === 'la_ledge'; i++) update(1 / 60);
      return { at, bloom: BLOOM4.state().map, state: BLOOM4.state().state };
    });
    check(a9.at === 'la_z1_2_0' && a9.bloom === 'la_z1_2_0', 'the walking bloom, hunting you, comes down through the gap after you: ' + JSON.stringify(a9));

    // ---- 10. the switch: off, the boulders stand whole as Phase 1 laid them, and Walk on stays on the ledge
    const a10 = await ev(async () => {
      BLOOM4.reset();
      const fresh = LEDGE1.buildLedge(), m = G.maps.la_ledge;
      G.state = 'paused'; loadMap('la_ledge', { x: 86, y: 52, dir: Math.PI / 2 }); G.state = 'play'; G.fadeT = 0;
      GFX.laThresholds = false; advanceTime(50);
      const same = [85, 86].every((x) => { const a = m.get(x, 58), b = fresh.get(x, 58); return a && b && a.tex === b.tex && a.top === b.top && m.floorCells[59 * m.w + x] === fresh.floorCells[59 * m.w + x]; });
      const w = __W40(86, 60, 5000);
      G.flags.la_title_seen = true; G.flags.la_prologue_end = false; PROLOGUE39.show(); document.getElementById('la-walk-on').click();
      await new Promise((r) => setTimeout(r, 50)); advanceTime(50);
      const stay = G.mapId;
      GFX.laThresholds = true; advanceTime(50);
      return { same, w, stay, back: m.get(85, 58) === null };
    });
    check(a10.same, 'off, the two boulders are back exactly as Phase 1 laid them');
    check(a10.w.map === 'la_ledge' && a10.w.y < 58.7 && a10.stay === 'la_ledge', 'off, the ledge holds at its south end and Walk on stays: ' + JSON.stringify([a10.w, a10.stay]));
    check(a10.back, 'on again, the gap is open');

    const err = await ev(() => THRESH40.state().err);
    check(!err, 'the wire ran without an error' + (err ? ': ' + err : ''));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
