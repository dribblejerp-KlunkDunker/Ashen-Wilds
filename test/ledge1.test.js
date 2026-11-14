// node test/ledge1.test.js            (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/ledge1.test.js     with Playwright installed globally
// Phase 1, the ledge: the shape of the land the prologue stands on, and the words spoken there. No browser.
// What a test like this cannot show: how any of it looks. tools/shots.js writes the stills; a person has to open them.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'js', 'ledge1.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const STEP_UP = 0.36, MAX_GRADE = 1.1;   // the engine's limits (js/engine.js); the test below reads them from the file too
const eng = fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8');
check(/const STEP_UP = 0\.36;/.test(eng) && /const MAX_GRADE = 1\.1;/.test(eng), 'the engine still walks with a step of 0.36 and a grade of 1.1');

const { PLATEAU: P, SHELF: S, RAMP: R, HOLLOW: HO, CIT, CANYON, W, H, landH, citadelTop } = L;

// ---- where you stand
let flat = true; for (let y = P.y0; y <= P.y1 + 1; y++) for (let x = P.x0; x <= P.x1 + 1; x++) if (landH(x, y) !== P.h) flat = false;
check(flat && P.h === 14, 'the ledge is dead flat, fourteen up');
let sflat = true; for (let y = S.y0; y <= S.y1 + 1; y++) for (let x = S.x0; x <= S.x1 + 1; x++) if (!(x >= R.x0 && x <= R.x1 && y > R.y0) && landH(x, y) !== S.h) sflat = false;
check(sflat && S.h < P.h, 'the shelf under it is flat and lower: ' + S.h);
let worst = 0; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x <= R.x1; x++) worst = Math.max(worst, Math.abs(landH(x, y + 1) - landH(x, y)));
check(worst > 0 && worst < MAX_GRADE, 'the ramp between them can be walked (steepest rise per cell ' + worst.toFixed(2) + ', limit ' + MAX_GRADE + ')');
check(landH(R.x0, R.y0) === S.h && landH(R.x0, R.y1) === P.h, 'the ramp meets the shelf at its foot and the ledge at its head');
let side = true; for (let y = R.y0 + 1; y < R.y1; y++) if (landH(R.x0, y) !== landH(R.x1, y)) side = false;
check(side, 'the ramp does not tilt sideways');

// ---- what you look at
let drop = 1e9; for (let y = P.y0; y <= P.y1 + 1; y++) drop = Math.min(drop, P.h - landH(P.x0 - 1, y));
check(drop > 8 && drop > STEP_UP * 10, 'the west edge is a real cliff: at least ' + drop.toFixed(1) + ' down, one cell out');
const distSeg = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };
const distCanyon = (x, y) => { let d = 1e9; for (let i = 0; i + 1 < CANYON.length; i++) d = Math.min(d, distSeg(x, y, CANYON[i][0], CANYON[i][1], CANYON[i + 1][0], CANYON[i + 1][1])); return d; };
let beds = 0, underFoot = 0, low = 1e9, high = -1e9;
for (let y = 10; y < H - 10; y++) for (let x = 12; x < P.x0 - 1; x++) {
  const h = landH(x, y); low = Math.min(low, h); high = Math.max(high, h);
  if (h < -1.5) { beds++; if (x > P.x0 - 4 && y > 20 && y < 64 && distCanyon(x, y) > 5) underFoot++; }
}
check(beds > 60, 'the plain is cracked: ' + beds + ' points lie in the bed of a crack');
check(underFoot === 0, 'no crack opens in the three cells under the cliff foot, except the mouth of the canyon');
check(low >= -2.4 - 1e-9, 'no crack is deeper than its bed (-2.4): ' + low.toFixed(2));
let cany = true; for (const [x, y] of CANYON.slice(0, 3)) if (landH(x, y) > -1.5) cany = false;
check(cany, 'the canyon runs from under the ledge toward the Slagcrown');
let hot = 0, hn = 0; for (let y = HO.y - 5; y <= HO.y + 5; y++) for (let x = HO.x - 5; x <= HO.x + 5; x++) if (Math.hypot(x - HO.x, y - HO.y) <= HO.r * 0.6) { hn++; if (landH(x, y) < -1.5) hot++; }
check(landH(HO.x, HO.y) < 0 && hot === 0, 'the hollow of the bloom is low ground with no fire in it (teal is the bloom\'s own light): middle ' + landH(HO.x, HO.y).toFixed(2) + ', ' + hot + ' of ' + hn + ' points burning');
check(Math.abs(landH(CIT.x, CIT.y) - 3) < 1e-9, 'the Slagcrown stands on a levelled rise, three up');
let rim = 0; for (let y = 2; y < H - 2; y += 4) rim += landH(2, y); rim /= Math.ceil((H - 4) / 4);
check(rim > 6, 'the far rim rises behind it: mean ' + rim.toFixed(1));

// ---- the Slagcrown
let tall = 0, at = null, count = 0, wide = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = citadelTop(x, y); if (t > 0) { count++; wide = Math.max(wide, Math.abs(x - CIT.x), Math.abs(y - CIT.y)); } if (t > tall) { tall = t; at = [x, y]; } }
check(at[0] === CIT.x && at[1] === CIT.y && tall === 16, 'the great tower is the tallest thing, and stands at the middle');
check(count > 150 && wide === 11, 'it is a citadel, not a tower: ' + count + ' blocks, eleven out from the middle');
let sym = 0, all = 0; for (let dy = -11; dy <= 11; dy++) for (let dx = 1; dx <= 11; dx++) { all++; if ((citadelTop(CIT.x + dx, CIT.y + dy) > 0) === (citadelTop(CIT.x - dx, CIT.y + dy) > 0)) sym++; }
check(sym === all, 'its plan is the same east and west (ruin lowers a block, never removes one)');
let ruin = 0; for (let k = -10; k <= 10; k++) if (citadelTop(CIT.x + 10, CIT.y + k) === 2) ruin++;
check(ruin > 0 && ruin < 8, 'the east curtain is breached, not gone: ' + ruin + ' of 21 fallen');
// from the ledge the top of the great tower must sit under the sun, not over it
const eye = P.h + 0.88, top = 3 + 3 + tall, dist = P.x0 - CIT.x, elev = Math.atan2(top - eye, dist);
check(elev < L.SUN.el - L.SUN.r && elev > -0.2, 'seen from the edge, the great tower ends below the sun (tower ' + elev.toFixed(3) + ' rad, sun ' + L.SUN.el + ')');
check(Math.abs(L.SUN.az - Math.PI) < 1e-9, 'the sun hangs due west, over the Slagcrown');

// ---- nothing here rolls dice
const a = [], b = []; for (let i = 0; i < 400; i++) { const x = (i * 37) % W, y = (i * 53) % H; a.push(landH(x, y), citadelTop(x, y)); } for (let i = 0; i < 400; i++) { const x = (i * 37) % W, y = (i * 53) % H; b.push(landH(x, y), citadelTop(x, y)); }
check(a.every((v, i) => v === b[i]), 'the land and the citadel are the same every time they are asked for');
const src = fs.readFileSync(path.join(ROOT, 'js', 'ledge1.js'), 'utf8');
check(!/Math\.random|\brng\(|Date\.now/.test(src), 'the file uses no live random numbers and no clock');
check(L.hash(3, 4, 5) === L.hash(3, 4, 5) && L.hash(3, 4, 5) !== L.hash(4, 3, 5) && L.hash(3, 4, 5) >= 0 && L.hash(3, 4, 5) < 1, 'its hash is fixed and lies in [0, 1)');

// ---- the tiles: 64 x 64, painted in code, and the frost has no bare lane to rule a line from cell to cell
const T = L.tiles(), lum = (v) => (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255);
check(Object.keys(T).length === 9 && Object.values(T).every((d) => d instanceof Uint32Array && d.length === 4096 && d.every((v) => (v >>> 24) === 255)), 'nine tiles, each 64 x 64 and solid: ' + Object.keys(T).join(' '));
for (const k of ['t_la_frost', 't_la_frost2']) {
  let bare = 0, cov = 0;
  for (let a = 0; a < 64; a++) { let r = 0, c = 0; for (let b2 = 0; b2 < 64; b2++) { if (lum(T[k][a * 64 + b2]) > 260) { r++; cov++; } if (lum(T[k][b2 * 64 + a]) > 260) c++; } if (!r) bare++; if (!c) bare++; }
  check(bare === 0 && cov / 4096 > 0.3 && cov / 4096 < 0.7, k + ': no row or column is bare of frost, and frost covers ' + (cov / 40.96).toFixed(0) + '% of it');
}
let same = 0; for (let i = 0; i < 4096; i++) if (T.t_la_frost[i] === T.t_la_frost2[i]) same++;
check(same / 4096 < 0.7, 'the two cuts of frost differ (' + (100 - same / 40.96).toFixed(0) + '% of pixels)');
let dark = 0; for (const k of ['t_la_rock', 't_la_scorch', 't_la_slag', 't_la_turfroof']) { let m = 0; for (const v of T[k]) m += lum(v); if (m / 4096 < 200) dark++; }
check(dark === 4, 'rock, scorch, slag and the bothy\'s roof are dark tiles: black is the base colour');
const a1 = L.tiles(), a2 = L.tiles(); check(Object.keys(a1).every((k) => a1[k].every((v, i) => v === a2[k][i])), 'painted the same every time');

// ---- the words
const strings = []; const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
walk(L.TX); walk(L.TOPICS); Object.keys(L.TOPICS).forEach((k) => strings.push(k));
const said = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
const nonAscii = strings.filter((s) => /[^\x20-\x7e]/.test(s));
check(strings.length > 30 && nonAscii.length === 0, 'every line of in-game text is plain ASCII (canon rule): ' + strings.length + ' lines');
check(said.filter((s) => /[^\x20-\x7e]/.test(s)).length === 0, 'and so is every quoted string in the file');
check(L.TX.intro.length === 5 && /S\.31/.test(L.TX.intro[0]), 'the opening is five lines and names the year S.31');
// canon: these must agree with docs/worldbuilding/CANON.md and the design document
const canon = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'CANON.md'), 'utf8') + fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8');
for (const name of ['Marget Sayle', 'Gytha Marrin', 'Slagcrown', 'Ebba Cray', 'Burned Quay', 'Salt Trace', 'Bell Road', 'Wexhaven', 'Black Seam', 'Receipt-Wife']) {
  check(canon.includes(name), 'the world bible knows the name "' + name + '"');
}
const all2 = strings.join(' ');
check(!/prophe|chosen|destin|fated/i.test(all2), 'nobody speaks of prophecy');
check(!/\belf|\bdwar|orcish folk|goblin folk/i.test(all2), 'only humans are spoken of as people (O1)');


// ---- in a browser: the same things, played. Skipped (and said so) when no Playwright can be found.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = {}, c = Engine.cam;
      const walk = (tx, ty, secs) => { for (let i = 0; i < secs * 10; i++) { c.dir = Math.atan2(ty - c.y, tx - c.x); G.keys = { w: true }; advanceTime(100); if (Math.hypot(tx - c.x, ty - c.y) < 0.35) break; } G.keys = {}; return { x: c.x, y: c.y, feet: G.player.feet || 0, state: G.state }; };
      out.map = G.map.id; out.maps = Object.keys(G.maps).sort(); out.active = R3D.active(); out.failed = LEDGE1.gl().failed;
      out.passes = R3D.passes().map((p) => p.name);
      out.journal = G.journal.map((j) => j.text); out.day = typeof DAYS !== 'undefined' ? DAYS[0] : null; out.tod0 = G.tod;
      out.spawn = { x: c.x, y: c.y, feet: G.player.feet };
      const plan = EAVES78.plan(G.maps.la_ledge); out.houses = plan.houses.map((h) => [h.x0, h.y0, h.x1, h.y1, h.roofTex || '']);
      out.carter = G.ents.filter((e) => e.kind === 'npc').map((e) => e.name);
      out.lights = G.ents.filter((e) => e.lightCol).length;

      // ---- frames, under a stopped clock (the engine's clock moves the ash; nothing here rolls dice)
      G.state = 'play'; const box = document.querySelector('#msgs'); if (box) box.innerHTML = '';
      loadMap(LEDGE1.LEDGE, { x: 78.35, y: 49.2, dir: Math.PI }); G.tod = 0.735; G.fadeT = 0; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.2); advanceTime(500);   // at the lip, looking out and down
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn(); performance.now = () => t0; Date.now = () => d0;
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const frame = () => { render(); render(); const p = R3D.readPixels(); return p; };
      const hash = () => fnv(frame().data);
      const F = {}; F.on = hash(); F.on2 = hash();
      const px = frame(); let red = 0, blue = 0, n = 0, dark = 0;   // the upper middle of the view: sky over the Slagcrown
      for (let y = Math.round(px.h * 0.62); y < Math.round(px.h * 0.9); y += 4) for (let x = Math.round(px.w * 0.3); x < Math.round(px.w * 0.7); x += 4) { const i = (y * px.w + x) * 4; red += px.data[i]; blue += px.data[i + 2]; n++; if (px.data[i] + px.data[i + 1] + px.data[i + 2] < 60) dark++; }
      out.sky = { red: red / n, blue: blue / n, dark: dark / n, w: px.w, h: px.h };
      GFX.laSky = false; F.skyOff = hash(); F.skyOff2 = hash(); GFX.laSky = true;
      GFX.laAsh = false; F.ashOff = hash(); GFX.laAsh = true;
      GFX.laFire = false; R3D.invalidate(); F.fireOff = hash(); GFX.laFire = true; R3D.invalidate(); F.back = hash();
      GFX.laSky = false; GFX.laAsh = false; F.bothOff = hash();
      R3D.removePass('la-coalsun'); R3D.removePass('la-ash'); F.gone = hash();
      out.F = F;
      performance.now = pn; Date.now = dn;
      // (the passes stay removed for the walking below; they draw nothing the rules read)

      // ---- the Options rows
      GFX.laSky = true; GFX.laAsh = true;
      try { renderAccessibilityMenu(); out.rows = LEDGE1.SWITCHES.map(([k]) => { const b = document.getElementById('gfx-' + k.toLowerCase()); return b ? b.textContent : null; }); if (typeof closeModal === 'function') closeModal(); } catch (e) { out.rows = String(e); }
      GFX.laSky = true; GFX.laAsh = true; G.state = 'play'; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(0);
      loadMap(LEDGE1.LEDGE); advanceTime(300);

      // ---- the edge holds, at three places along it
      out.edge = [walk(70, 48.5, 8), walk(77.5, 40.4, 6), walk(77.5, 57.4, 8)];
      // ---- and the way down: along the ledge, down the ramp, across the shelf, to the door
      out.way = [walk(87.5, 41, 10), walk(87.5, 32, 12), walk(83.5, 31.2, 8), walk(83.5, 30.35, 3)];
      c.dir = -Math.PI / 2; interact(); advanceTime(1500);
      out.inside = { map: G.map.id, safe: !!G.map.safe, ceil: G.map.ceil || (G.map.opts && G.map.opts.ceil) || null, people: G.ents.filter((e) => e.kind === 'npc').map((e) => e.name), state: G.state };
      const e = G.ents.find((q) => q.kind === 'npc'); if (e) talk(e);
      const panel = () => (document.querySelector('#modal-panel') || document.body).innerText;
      out.talk = { state: G.state, greet: panel().slice(0, 2000) };
      renderDialogue('tell'); out.talk.topics = [...document.querySelectorAll('[data-topic]')].map((b) => b.dataset.topic);
      out.talk.places = (renderDialogue('where'), [...document.querySelectorAll('[data-place]')].length);
      askTopic('The survey'); renderDialogue('tell'); out.talk.survey = panel().slice(0, 4000);
      return out;
    });
    const TOP = Object.keys(L.TOPICS);
    check(r.map === L.LEDGE && r.maps.join() === [L.BOTHY, L.LEDGE].sort().join(), 'Begin opens on the highland edge, and only this game\'s two maps exist: ' + r.maps.join(', '));
    check(r.active && !r.failed && r.passes.includes('la-coalsun') && r.passes.includes('la-ash'), 'the 3D renderer draws it, with the coal sun and the ash as passes of their own');
    check(r.passes.indexOf('la-coalsun') === r.passes.indexOf('sky') + 1 && r.passes.indexOf('la-ash') > r.passes.indexOf('transparent') && r.passes.indexOf('la-ash') < r.passes.indexOf('post'), 'the sun is painted straight after the engine\'s sky; the ash after the world and before the grade');
    check(r.spawn.feet === 14 && Math.abs(r.spawn.x - 89.5) < 1e-6, 'you begin on the ledge, fourteen up, your back to the rock');
    check(r.journal.length === 1 && r.journal[0] === L.TX.journal && r.day === 'The thaw' && Math.abs(r.tod0 - 0.735) < 0.02, 'the journal holds one line, Gytha Marrin\'s errand; it is the thaw, toward dusk');
    check(r.carter.length === 1 && r.carter[0] === L.TX.carter && r.lights >= 8, 'the carter stands on the ledge; ' + r.lights + ' fires and caps give light on the plain');
    check(r.houses.length === 1 && r.houses[0].slice(0, 4).join() === '82,27,85,29', 'the roof planner finds one building, the bothy: ' + JSON.stringify(r.houses));

    const F = r.F;
    check(F.on === F.on2 && F.skyOff === F.skyOff2, 'a frame is the same twice under a stopped clock (' + F.on + ')');
    check(F.skyOff !== F.on && F.ashOff !== F.on && F.fireOff !== F.on, 'each of the three switches changes the picture when turned off (on ' + F.on + '; sky, ash, fire off ' + [F.skyOff, F.ashOff, F.fireOff].join(', ') + ')');
    check(new Set([F.skyOff, F.ashOff, F.fireOff]).size === 3, 'and each changes it differently');
    check(F.back === F.on, 'turned back on, the picture is the one it was');
    check(F.bothOff === F.gone, 'with the sun and ash switched off the frame is the same as with their passes taken out of the renderer');
    check(r.sky.red > r.sky.blue * 1.5 && r.sky.red > 40, 'the country under the sun is red, not blue (red ' + r.sky.red.toFixed(0) + ', blue ' + r.sky.blue.toFixed(0) + ' of 255)');
    check(Array.isArray(r.rows) && r.rows.length >= 3 && r.rows.every((t) => t === 'On'), 'Options has a row for each: ' + JSON.stringify(r.rows));

    check(r.edge.every((p) => p.x >= P.x0 + 0.2 && p.feet === P.h && p.state === 'play'), 'walking west off the ledge is refused at the lip, three places tried: x = ' + r.edge.map((p) => p.x.toFixed(2)).join(', '));
    const [w1, w2, w3, w4] = r.way;
    check(w1.feet === P.h && Math.abs(w2.feet - S.h) < 1e-6 && w2.y < R.y0 + 0.5 && Math.abs(w4.x - 83.5) < 0.4 && w4.y < 30.8, 'the way down can be walked: ledge, ramp, shelf, door (' + r.way.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' -> ') + ')');
    check(r.inside.map === L.BOTHY && r.inside.safe && r.inside.people.join() === L.TX.marget && r.inside.state === 'play', 'the door opens into the bothy: it is marked safe, and Marget Sayle is in it');
    check(r.talk.state !== 'play' && r.talk.greet.includes(L.TX.marget), 'she can be spoken to');
    check(r.talk.topics.join() === TOP.join() && r.talk.places === 0, 'what she can be asked about is this world\'s and nothing else: ' + r.talk.topics.join(', '));
    check(r.talk.survey.includes('I am one of the four') && !/Oakhaven|Octave|Cantabile|Aegis|Kaelen|Lyra|Legion/i.test(r.talk.survey), 'asked about the survey, she gives her own answer, and stops there');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
    const bad = [...s.missing].filter((p) => /\.(js|css|html|woff2|webmanifest)$/.test(p));
    check(bad.length === 0, 'no script, style or font was asked for and not found: ' + (bad.join(' ') || 'none'));
    const other = [...s.missing].filter((p) => !bad.includes(p));
    console.log('NOTE ' + other.length + ' other files asked for and not found (the engine\'s old pictures and music): ' + other.slice(0, 12).join(' '));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
