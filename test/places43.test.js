// node test/places43.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/places43.test.js     with Playwright installed globally
// Phase 43, the places of the highland edge: the zone plan's 56, each where the plan puts it, none on a way, every one
// reachable, found as you come to them, saved, and gone with the switch off.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'threshold40.js'));
const P = require(path.join(ROOT, 'js', 'places43.js'));
const noBrowser = process.argv.includes('--no-browser');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// ---- the 56 are Z1's, as atlas/10-zones.md lists them
const z = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'atlas', '10-zones.md'), 'utf8');
const z1 = z.slice(z.indexOf('## Z1.'), z.indexOf('## Z2.'));
const rows = z1.slice(z1.indexOf('| # | Place | x, y | Kind |')).split('\n').slice(2).filter((l) => /^\| \d/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const md = rows.map((r) => r[0] + '|' + r[1] + '|' + r[2].replace(/\s/g, '') + '|' + r[3]).join('\n');
const js = P.PLACES.map((r) => r[0] + '|' + r[1] + '|' + r[2] + ',' + r[3] + '|' + r[4]).join('\n');
check(rows.length === 56 && md === js, 'the 56 places are Z1\'s, number, name, point and kind, as atlas/10-zones.md lists them');
check(P.PLACES.every((r) => typeof P.RECIPES[r[0]] === 'function'), 'every one has a recipe');
const names = P.PLACES.map((r) => P.nameOf(r[1]));
check(names.every((n) => n && !/[[\]`]/.test(n) && !/[^\x20-\x7e]/.test(n)) && names[0] === 'The ledge' && names[3] === 'Marget\'s peat bank', 'what the game says is the plan\'s name, without its brackets or code, in plain ASCII');
check(Object.values(P.GATE_WAY).every((w) => w === 'Coldbarrow' || T.WAYS.some((q) => q.name === w)), 'a gate says the name of a way Z1 has (or Coldbarrow)');

// ---- built beside its way, never on it, and never far from its own point
let far = 0, onWay = 0;
const anchors = {};
for (const [n, , x, y] of P.PLACES) {
  const clear = [1, 2, 11, 12, 30, 31, 35, 36].includes(n) ? 0 : 3;
  const p = P.beside(n, x + 0.5, y + 0.5, clear);
  anchors[n] = p;
  if (Math.hypot(p[0] - x, p[1] - y) > 24) far++;
  if (clear && P.offWay(p[0], p[1]) < 3) onWay++;
}
check(far === 0 && onWay === 0, 'every place stands within 24 cells of its point, three clear of every way (but the gates and the complexes)');
// O15: something every 30 to 60 seconds of walking: along every way, no stretch of more than 156 cells without a place
// within 70 of it (tools/zones.js's rule, on the places as built)
{
  let worst = 0, where = '';
  for (const w of T.WAYS) {
    let run = 0;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1], L = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let t = 0; t < L; t++) {
        const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L;
        const near = Object.values(anchors).some((p) => Math.hypot(p[0] - x, p[1] - y) < 70);
        run = near ? 0 : run + 1;
        if (run > worst) { worst = run; where = w.name; }
      }
    }
  }
  check(worst <= 156, 'along every way something stands within 70 cells at least every 156 (longest stretch ' + worst + ', ' + where + ')');
}

const src = fs.readFileSync(path.join(ROOT, 'js', 'places43.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'plain ASCII, no clock and no dice');
check(!src.split('\n').some((l) => /\S.*[;{)]\s*\/\/ /.test(l) && !/['"`].*\/\/.*['"`]/.test(l)), 'no comment after code on a line');
check(!/base64|data:image/.test(src) && P.ART.length === 6, 'six things painted here, in code');

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
      window.__W43 = (x, y, ms) => {
        const c = Engine.cam, from = G.mapId, norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        let i = 0;
        for (; i < (ms || 20000) / 16.7 && G.mapId === from; i++) {
          const diff = norm(Math.atan2(y - c.y, x - c.x) - c.dir);
          if (Math.hypot(x - c.x, y - c.y) < 0.4) break;
          G.keys = { w: Math.abs(diff) < 0.5, arrowleft: diff < -0.06, arrowright: diff > 0.06 };
          update(1 / 60);
        }
        G.keys = {}; for (let k = 0; k < 10; k++) update(1 / 60);
        return { map: G.mapId, x: +c.x.toFixed(2), y: +c.y.toFixed(2), frames: i };
      };
      window.__go = (x, y, dir) => { G.state = 'paused'; loadMap('la_z1', { x, y, dir: dir || 0 }); G.state = 'play'; G.fadeT = 0; document.querySelector('#msgs').innerHTML = ''; };
    });

    // ---- 1. up on the open map: every place has its things, each named
    const a1 = await ev(() => {
      OPEN42.finish(G.maps.la_z1); __go(990.5, 150.5, Math.PI / 2);
      const st = PLACES43.state(), rec = st.rec, m = G.map, AT = PLACES43.at();
      const bare = [];
      for (const [n, raw] of PLACES43.PLACES) {
        const name = PLACES43.nameOf(raw);
        const mine = m.entities.filter((e) => e.la43 === n);
        if (!mine.length || !mine.every((e) => e.label === name) || !mine.some((e) => Math.hypot(e.x - AT[n][0], e.y - AT[n][1]) < 12)) bare.push(n);
      }
      return { on: !!st.applied, cells: rec.cells.length, floors: rec.floors.length, ents: rec.ents.length, bare, err: st.err, row: LEDGE1.SWITCHES.some((r) => r[0] === 'laPlaces') };
    });
    check(a1.on && a1.bare.length === 0 && !a1.err, 'all 56 places stand on the open map, each with something there named as the plan names it: ' + a1.cells + ' cells of stone, ' + a1.floors + ' of ground, ' + a1.ents + ' things' + (a1.bare.length ? '; bare: ' + a1.bare.join(', ') : ''));
    check(a1.row, 'Options has the switch "Places of the highland edge"');

    // ---- 2. none blocks a way (but Coldbarrow's shut gate and the gates' posts), and every one can be walked to
    const a2 = await ev(() => {
      const m = G.map, rec = PLACES43.state().rec;
      let onWay = 0;
      for (const [x, y] of rec.cells) { const c = m.get(x, y); if (c && OPEN42.wayAt(x, y) && ![30, 11, 12, 35, 36].includes(c.la43)) onWay++; }
      const W = m.w, seen = new Uint8Array(W * m.h), q = new Int32Array(W * m.h); let h = 0, t = 0; const s0 = 150 * W + 990; q[t++] = s0; seen[s0] = 1;
      while (h < t) { const k = q[h++], x = k % W, y = (k / W) | 0; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue; const n = ny * W + nx; if (seen[n] || m.isBlocked(nx, ny)) continue; seen[n] = 1; q[t++] = n; } }
      const AT = PLACES43.at(), out = [];
      for (const [n] of PLACES43.PLACES) { const [x, y] = AT[n]; let ok = false; for (let dy = -4; dy <= 4 && !ok; dy++) for (let dx = -4; dx <= 4 && !ok; dx++) if (seen[(Math.floor(y) + dy) * W + Math.floor(x) + dx]) ok = true; if (!ok) out.push(n); }
      // and every way's every point is still open, but behind Coldbarrow's gate
      let shut = 0;
      for (const w of THRESH40.WAYS) for (const p of w.pts) { const x = Math.floor(p[0]), y = Math.floor(p[1]); if (y >= 1480 || m.isBlocked(x, y)) continue; if (!seen[y * W + x]) shut++; }
      return { onWay, out, shut, open: t };
    });
    check(a2.onWay === 0, 'no place stands on a way, but Coldbarrow\'s gate, shut across the upper road, and the gates\' posts beside theirs');
    check(a2.out.length === 0 && a2.shut === 0, 'every place, and every point of every way, can be walked to from the crag\'s foot' + (a2.out.length ? ': not ' + a2.out.join(', ') : ''));

    // ---- 3. coming to a place finds it, once; a gate says the country beyond is not built
    const a3 = await ev(() => {
      G.flags.la_found = [];
      const AT = PLACES43.at(), [fx, fy] = AT[5];
      __go(fx, fy + 30, -Math.PI / 2);
      __W43(fx, fy + 10, 20000);
      const said1 = document.querySelector('#msgs').innerText, f1 = G.flags.la_found.slice();
      __W43(fx + 2, fy + 12, 5000);
      const n1 = PLACES43.state().found;
      __W43(fx, fy + 9, 5000);
      const again = PLACES43.state().found - n1;
      const [gx, gy] = AT[35];
      __go(gx - 30, gy + 8, 0);
      __W43(gx - 8, gy + 3, 20000);
      const said2 = document.querySelector('#msgs').innerText;
      return { said1, f1, again, said2, found: G.flags.la_found.slice() };
    });
    check(a3.f1.includes(5) && /The Greystair fork/.test(a3.said1) && a3.again === 0, 'walking up to the Greystair fork finds it, its name said, and once only: ' + JSON.stringify(a3.said1.slice(0, 60)));
    check(a3.found.includes(35) && /The Greystair road goes on from here\. That country is not built yet\./.test(a3.said2), 'Greystair\'s lower gate says the road goes on into country not built yet: ' + JSON.stringify(a3.said2.slice(0, 160)));

    // ---- 4. the map (M) marks what is found
    const a4 = await ev(() => {
      const [x, y] = PLACES43.at()[5];
      G.state = 'panel'; renderMap(); const cv = document.getElementById('amap');
      const d = cv.getContext('2d').getImageData(Math.floor(x) - 8, Math.floor(y) - 8, 16, 16).data; let gold = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 170 && d[i + 2] < 150) gold++;
      closeModal(); G.state = 'play';
      return { gold };
    });
    check(a4.gold > 10, 'the map (M) rings the places found: ' + a4.gold + ' pixels of the ring at the fork');

    // ---- 5. a save keeps what was found and none of the places' things; loading puts them up again
    const a5 = await ev(() => {
      __go(960.5, 400.5, Math.PI / 2);
      const d = snapshotGame(), extra = (d.maps.la_z1.extra || []).length, json = JSON.stringify(d).length;
      restoreGame(JSON.parse(JSON.stringify(d)));
      const st = PLACES43.state();
      return { extra, json, found: G.flags.la_found.slice(), on: !!st.applied && st.applied === G.maps.la_z1, ents: G.ents.filter((e) => e.la43).length, map: G.mapId };
    });
    check(a5.extra === 0 && a5.found.includes(5) && a5.found.includes(35) && a5.on && a5.ents > 100 && a5.map === 'la_z1', 'a save keeps the places found and none of their things; loaded, the places stand again: ' + JSON.stringify(a5));

    // ---- 6. the switch: off, the open map is Phase 42's, cell for cell; on, the places stand again
    const a6 = await ev(() => {
      const m = G.maps.la_z1, j = OPEN42.create(); OPEN42.finish(j.m);
      const diff = () => {
        let d = 0;
        for (let i = 0; i < m.w * m.h; i++) { const a = m.cells[i], b = j.m.cells[i]; if ((a && a.top) !== (b && b.top) || (a && a.tex) !== (b && b.tex) || m.floorCells[i] !== j.m.floorCells[i]) d++; }
        return d;
      };
      const on = diff();
      GFX.laPlaces = false; update(1 / 60);
      const off = diff(), ents = m.entities.filter((e) => e.la43).length;
      GFX.laPlaces = true; update(1 / 60);
      return { on, off, ents, again: m.entities.filter((e) => e.la43).length };
    });
    check(a6.on > 1000 && a6.off === 0 && a6.ents === 0, 'off, the open map is Phase 42\'s, cell for cell, and none of the places\' things is left (' + a6.on + ' cells differ with it on, ' + a6.off + ' off)');
    check(a6.again > 100, 'on again, the places stand again');

    const err = await ev(() => PLACES43.state().err || OPEN42.state().err);
    check(!err, 'the wire ran without an error' + (err ? ': ' + err : ''));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
