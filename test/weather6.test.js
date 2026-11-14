// node test/weather6.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/weather6.test.js        with Playwright installed globally
// Phase 6, Sleet and Ashfall, stopped by the bothy's roof. This checks the weathers against the bible's numbers, the
// spells and banners without a browser, and in a browser: the ash and sleet are drawn and stop where a roof is, sleet
// darkens the light and closes the fog, the walking bloom hears and sees less in it, you walk at 85%, the bible's
// banners are shown, and the switch puts back Phase 1's ash with no weather.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'js', 'weather6.js')), S3 = require(path.join(ROOT, 'js', 'sun3.js')), L = require(path.join(ROOT, 'js', 'ledge1.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'weather6.js'), 'utf8');
const bible = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-smothering.md'), 'utf8');

// ---- the bible's numbers, and that the rules carry them
check(/\| Sleet \| 14 \| x0\.85 \| x1\.8 \| x0\.75 \| 85% \| x0\.6 \|/.test(bible) && /\| Ashfall \| 24 \| x1\.0 \|/.test(bible), 'the bible: sleet sees 14 m against ashfall\'s 24, hears x0.85, footing 85%');
const fs_ = W.W.FX.sleet;
check(Math.abs(fs_.sight - 14 / 24) < 1e-9 && fs_.hear === 0.85 && fs_.footing === 0.85, 'and the rules carry exactly those numbers');
check(/compresses a spell to 70 to 130\s+seconds, with an 8 second blend/.test(bible) && W.W.blendS === 8 && W.W.spellS[0] === 70 && W.W.spellS[1] === 130, 'spells of 70 to 130 seconds, blended over 8, as the bible gives them');
const f5 = W.fx(0.5);
check(Math.abs(f5.hear - 0.925) < 1e-9 && W.fx(0).footing === 1 && W.fx(1).footing === 0.85, 'half way through the blend, half the change');

// ---- the spells
let overlap = 0, short = 0, clearWet = 0, counts = { clear: [], coin: [], coal: [] };
for (let d = 1; d <= 120; d++) {
  const sp = W.spells(d), k = S3.kind(d); counts[k].push(sp.length);
  for (const [a, b] of sp) { const s = (b - a) * W.DAY_S; if (s < 70 - 1e-6 || s > 130 + 1e-6 || a < 0 || b > 1) short++; }
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1]) overlap++;
  if (k === 'clear' && sp.length) clearWet++;
}
check(short === 0 && overlap === 0, 'over 120 days every spell lasts 70 to 130 seconds, inside the day, and none overlaps another');
check(clearWet === 0 && counts.coin.every((n) => n === 1) && counts.coal.every((n) => n === 2), 'a clear day stays dry; a coin day has one spell, a coal day two');
check(JSON.stringify(W.spells(7)) === JSON.stringify(W.spells(7)) && W.sleetAt(7, 0.5) === W.sleetAt(7, 0.5), 'the same day always has the same weather');
const first = W.spells(0)[0], wait = (first[0] - L.START.tod) * W.DAY_S;
check(wait > 90 && wait < 240, 'the first spell comes ' + Math.round(wait) + ' s after the prologue opens: time to reach the shelf or the door');
const b8 = 8 / W.DAY_S;
check(W.sleetAt(0, first[0] - 1e-6) === 0 && Math.abs(W.sleetAt(0, first[0] + b8 / 2) - 0.5) < 1e-6 && W.sleetAt(0, first[0] + b8 * 1.01) === 1, 'it blends in over 8 seconds');
check(W.kindAt(0, (first[0] + first[1]) / 2) === 'sleet' && W.kindAt(0, 0.5) === 'ashfall', 'between spells it is ashfall, the ordinary');

// ---- the words
const shipped = ['Ash falls, as it always does.', 'Sleet. The torch gutters, and the ground turns to grease.'];
check(W.BANNERS.ashfall[0] === shipped[0] && W.BANNERS.sleet[0] === shipped[1], 'the bible\'s shipped banners come first');
check([...W.BANNERS.ashfall, ...W.BANNERS.sleet].every((t) => bible.includes(t) && t.length < 90), 'every banner is the bible\'s own, word for word, under 90 characters');
check(Object.values(W.TX).concat(W.BANNERS.ashfall, W.BANNERS.sleet).every((t) => !/[^\x20-\x7e]/.test(t)), 'all of it plain ASCII (canon rule)');
check(W.banner('sleet', 5, 2) === W.banner('sleet', 5, 2), 'which banner is a fixed hash of the day, not a dice roll');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'nothing in it is random or read off a clock');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/js\/door5\.js\?v=\d+"><\/script>\s*<script src="js\/weather6\.js\?v=\d+"><\/script>/.test(html) && /js\/weather6\.js\?v=\d+/.test(sw), 'index.html loads weather6.js straight after door5.js, and the offline list carries it');

// ---- the played half, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = {}, c = Engine.cam, SLEET = 0.82, DRY = 0.786;
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-lawx'); out.row = b ? b.textContent : null; if (typeof closeModal === 'function') closeModal(); } catch (e) { out.row = String(e); }
      const at = (map, x, y, dir, tod, on) => { BLOOM4.reset(); G.flags = { la_told_bar: true }; GFX.laWx = on; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 0; G.tod = tod; G.fadeT = 0; G.keys = {}; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.06); advanceTime(300); G.tod = tod; };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const frame = () => { performance.now = () => t0; Date.now = () => d0; render(); render(); const p = R3D.readPixels(); performance.now = pn; Date.now = dn; return p; };
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      let seen = null; R3D.on('frame', (F) => { if (F && F.env && F.map) seen = { fogDist: F.env.fogDist, fog: [F.env.fogR, F.env.fogG, F.env.fogB] }; });
      const red = (p) => { let t = 0, n = 0; for (let y = 0; y < p.h * 0.5; y += 2) for (let x = 0; x < p.w; x += 2) { const i = (y * p.w + x) * 4; t += p.data[i] - p.data[i + 2]; n++; } return t / n; };
      const lum = (p) => { let t = 0, n = 0; for (let i = 0; i < p.data.length; i += 64) { t += p.data[i] + p.data[i + 1] + p.data[i + 2]; n++; } return t / n / 3; };
      const greys = (p) => { let n = 0, all = 0; for (let y = 0; y < p.h * 0.45; y += 1) for (let x = 0; x < p.w; x += 1) { const i = (y * p.w + x) * 4, r = p.data[i], g = p.data[i + 1], b = p.data[i + 2]; all++; if (Math.abs(r - g) < 14 && Math.abs(g - b) < 18 && r > 40) n++; } return n / all; };
      out.passes = R3D.passes().map((p) => p.name); out.failed = WEATHER6.gl().failed;
      const ash = R3D.getPass('la-ash'), wx = WEATHER6.pass;
      // drawn: the same view and hour, sleet on and the switch off
      const drawn = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 12) n++; return n / (a.data.length / 4); };
      const bare = () => { R3D.removePass('la-weather'); R3D.invalidate(); const p = frame(); R3D.addPass(wx); R3D.invalidate(); return p; };
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, SLEET, true); const Fon = { map: G.map, outdoor: true }; out.en = { wx: wx.enabled(Object.assign({}, Fon)), ash: ash.enabled(Object.assign({}, Fon)) };
      const pOn = frame(), fogOn = seen, pOnBare = bare(); out.sleet = { fog: fogOn, red: red(pOnBare), greys: drawn(pOn, pOnBare), k: WEATHER6.state().k };
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, DRY, true); GFX.laAsh = false; out.ashSwitch = { dry: wx.enabled(Object.assign({}, Fon)) }; G.tod = SLEET; out.ashSwitch.wet = wx.enabled(Object.assign({}, Fon)); GFX.laAsh = true;
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, SLEET, false); out.enOff = { wx: wx.enabled(Object.assign({}, Fon)), ash: ash.enabled(Object.assign({}, Fon)) };
      const pOff = frame(); out.off = { fog: seen, red: red(pOff), greys: greys(pOff), hash: fnv(pOff.data) };
      R3D.removePass('la-weather'); R3D.invalidate(); out.off.without = fnv(frame().data); R3D.addPass(wx);
      // by day: the second day's spell, the same hour with the switch on and off
      const dayAt = (on) => { BLOOM4.reset(); GFX.laWx = on; loadMap(LEDGE1.LEDGE, { x: 89.5, y: 48.5, dir: Math.PI }); G.state = 'play'; G.day = 1; const t = (WEATHER6.spells(1)[0][0] + WEATHER6.spells(1)[0][1]) / 2; G.tod = t; advanceTime(300); G.tod = t; R3D.removePass('la-weather'); R3D.invalidate(); const p = frame(); R3D.addPass(wx); R3D.invalidate(); return lum(p); };
      out.day = { wet: dayAt(true), dry: dayAt(false) };
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, DRY, true); const pDry = frame(); out.dry = { greys: drawn(pDry, bare()) };
      // where a roof is, nothing falls: roof the whole map and the weather goes
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, SLEET, true); const sh = EAVES78.shelter;
      const mw = G.maps.la_ledge.w, mh = G.maps.la_ledge.h, roofed = { k: 1, w: mw, h: mh, data: new Float32Array(mw * mh).fill(1e4) }; EAVES78.shelter = () => roofed; const pRoof = frame(), pRoofBare = bare(); EAVES78.shelter = sh;
      out.roof = { greys: drawn(pRoof, pRoofBare) };
      const S = EAVES78.shelter(G.maps.la_ledge); let over = 0, bothy = 0; if (S) for (let cy = 27; cy <= 29; cy++) for (let cx = 82; cx <= 85; cx++) { bothy++; if (S.data[(cy * S.k + 2) * S.w + cx * S.k + 2] > G.maps.la_ledge.groundAt(cx + 0.5, cy + 0.5) + 0.5) over++; }
      out.bothyRoof = { over, bothy };
      // inside the bothy, the pass does not draw at all
      at(LEDGE1.BOTHY, 3.5, 3.6, -Math.PI / 2, SLEET, true); out.inside = wx.enabled({ map: G.map, outdoor: false });
      // footing: two seconds' walk on the open plateau, ashfall and sleet
      const walk = (tod, on = true) => { at(LEDGE1.LEDGE, 84.5, 45.5, 0, tod, on); const x0 = c.x; for (let i = 0; i < 20; i++) { G.tod = tod; G.keys = { w: true }; c.dir = 0; advanceTime(100); } G.keys = {}; return c.x - x0; };
      out.walk = { dry: walk(DRY), wet: walk(SLEET) };
      // the bloom: a loud noise 7.4 m away is heard in ashfall and not in sleet (8 m x 0.85 = 6.8)
      const listen = (tod, on = true) => { at(LEDGE1.LEDGE, 89.0, 33.0, 0, tod, on); BLOOM4.reset(); const P = BLOOM4.R.post; c.x = P.x + 7.4 * Math.cos(1.9); c.y = P.y + 7.4 * Math.sin(1.9); if (G.maps.la_ledge.isBlocked(Math.floor(c.x), Math.floor(c.y))) { c.x = P.x - 7.4; c.y = P.y; } let heard = 0; for (let i = 0; i < 10; i++) { G.tod = tod; G.noise = 4.2; advanceTime(50); heard = Math.max(heard, BLOOM4.state().heard); } return { heard, d: Math.hypot(c.x - P.x, c.y - P.y) }; };
      out.ear = { dry: listen(DRY), wet: listen(SLEET) };
      // the words: let a spell come in while you stand on the ledge, and while you sit in the bothy
      const said = () => WEATHER6.state().said.join(' | ');
      at(LEDGE1.LEDGE, 89.5, 48.5, Math.PI, 0.79, true); WEATHER6.state().said.length = 0; for (let i = 0; i < 200 && G.tod < 0.8; i++) advanceTime(100); out.saidOut = said(); out.sleetBanner = WEATHER6.BANNERS.sleet.some((b) => out.saidOut.includes(b));
      at(LEDGE1.BOTHY, 3.5, 3.6, -Math.PI / 2, 0.79, true); WEATHER6.state().said.length = 0; WEATHER6.state().kind = 'ashfall'; for (let i = 0; i < 200 && G.tod < 0.8; i++) advanceTime(100); out.saidIn = said();
      // off: no weather at all in play
      out.walk.off = walk(SLEET, false); out.ear.off = listen(SLEET, false); GFX.laWx = true;
      out.err = WEATHER6.state().err || BLOOM4.gl().tickErr || DOOR5.state().err || null;
      return out;
    });
    check(r.row === 'On', 'Options has a row for ashfall and sleet');
    check(r.passes.includes('la-weather') && !r.failed, 'its pass is in the renderer and compiled (' + (r.failed || 'no failure') + ')');
    check(r.en.wx && !r.en.ash && !r.enOff.wx && r.enOff.ash, 'on, it draws the weather and Phase 1\'s ash across the view stands aside; off, the other way round');
    check(r.ashSwitch.dry === false && r.ashSwitch.wet === true, 'Phase 1\'s "Ash and embers" switch still rules the ash: off and dry, nothing is drawn; off in sleet, only the sleet');
    check(r.sleet.k === 1 && r.sleet.greys > 0.01 && r.sleet.greys > r.dry.greys * 1.5, 'in sleet the view fills with streaks (' + (r.sleet.greys * 100).toFixed(1) + '% of the view drawn by the weather, ' + (r.dry.greys * 100).toFixed(1) + '% in ashfall)');
    check(Math.abs(r.sleet.fog.fogDist / r.off.fog.fogDist - 14 / 24) < 0.01, 'the fog closes in to 14/24 of its distance (' + r.sleet.fog.fogDist.toFixed(1) + ' against ' + r.off.fog.fogDist.toFixed(1) + ')');
    const sat = (f) => Math.max(...f) - Math.min(...f);
    check(sat(r.sleet.fog.fog) < sat(r.off.fog.fog) * 0.3, 'and it is wet grey air, not the land\'s red (fog ' + r.sleet.fog.fog.map((v) => v.toFixed(0)).join('/') + ' against ' + r.off.fog.fog.map((v) => v.toFixed(0)).join('/') + ')');
    console.log('NOTE the light under sleet: by day the land measures ' + r.day.wet.toFixed(1) + ' against ' + r.day.dry.toFixed(1) + ' dry; the sun is dimmed through the weather terms, but the change is small on a day the sun is already behind the ash');
    check(r.roof.greys < r.sleet.greys * 0.05, 'where a roof is overhead nothing falls: under a roof over everything, the weather draws ' + (r.roof.greys * 100).toFixed(2) + '% of the view');
    check(r.bothyRoof.bothy === 12 && r.bothyRoof.over === 12, 'and the roof planner puts the bothy\'s roof over every one of its cells');
    check(r.inside === false, 'inside the bothy nothing is drawn at all');
    const ratio = r.walk.wet / r.walk.dry;
    check(Math.abs(ratio - 0.85) < 0.03, 'PLAYED: in sleet you walk at ' + (ratio * 100).toFixed(0) + '% (85% in the bible)');
    check(r.ear.dry.heard >= 1 && r.ear.wet.heard === 0, 'PLAYED: a run ' + r.ear.dry.d.toFixed(1) + ' m from the walking bloom is heard in ashfall and lost in the sleet');
    check(/The ash is coming down wet/.test(r.saidOut) && r.sleetBanner, 'outside, the cue and then one of the bible\'s sleet banners: "' + r.saidOut + '"');
    check(/Sleet rattles on the roof/.test(r.saidIn), 'inside, you hear it on the roof: "' + r.saidIn + '"');
    check(Math.abs(r.walk.off / r.walk.dry - 1) < 0.03 && r.ear.off.heard >= 1, 'switched off, sleet does nothing to walking or hearing');
    check(r.off.hash === r.off.without, 'switched off, the frame is exactly the frame with the weather pass taken out (hash ' + r.off.hash + ')');
    check(!r.err, 'nothing threw: ' + (r.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
