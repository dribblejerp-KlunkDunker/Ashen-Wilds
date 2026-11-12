// node test/sun3.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/sun3.test.js        with Playwright installed globally
// Phase 3, the sun's day: the sun crosses the sky and has three faces (coal, pale coin, a clear noon). This checks the
// arc, the run of days, what each face does to the light, that the written world says so, and, in a browser, that
// noon is three different pictures on three kinds of day and that the switch puts the fixed coal sun back.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'sun3.js')), L = require(path.join(ROOT, 'js', 'ledge1.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const deg = (r) => r * 180 / Math.PI, near = (a, b, e) => Math.abs(a - b) <= e;

// ---- the arc
const dawn = S.at(0.25), noon = S.at(0.5), dusk = S.at(0.75), night = S.at(0.0);
check(near(deg(dawn.az), 0, 0.01) && near(dawn.el, 0, 1e-9), 'the sun rises due east');
check(near(deg(noon.az), 90, 0.01) && near(deg(noon.el), 66.6, 0.1), 'stands in the south at noon, about 67 degrees up');
check(near(deg(dusk.az), 180, 0.01) && near(dusk.el, 0, 1e-9), 'and sets due west, behind the Slagcrown');
check(night.el < -1 && near(S.at(0.4).el, S.at(0.6).el, 1e-9), 'it is under the world at midnight, and the afternoon mirrors the morning');
const eng = fs.readFileSync(path.join(ROOT, 'js', 'light21.js'), 'utf8');
check(/const sunA = \(tod - 0\.25\) \* TAU, elev = Math\.cos\(\(tod - 0\.5\) \* TAU\);/.test(eng) && /const sunEl = Math\.asin\(clamp\(elev, -1, 1\)\) \* 0\.74;/.test(eng), 'this is the arc the engine lights and shadows by, so shadows fall away from the disc');
const st = S.at(S.START_TOD), half = Math.atan2(11, L.PLATEAU.x0 - L.CIT.x);
check(Math.abs(st.az - Math.PI) < half && st.el - L.SUN.r > 0 && st.el < 0.25, 'the prologue opens with the whole disc above the horizon and over the Slagcrown (' + deg(st.az).toFixed(1) + ' degrees round, ' + deg(st.el).toFixed(1) + ' up)');

// ---- the run of days
check(S.kind(0) === 'coal', 'the prologue\'s day is a coal day');
const n = { coal: 0, coin: 0, clear: 0 }; for (let d = 1; d <= 400; d++) n[S.kind(d)]++;
check(n.coin > n.coal && n.coin > n.clear && n.coal >= 60 && n.clear >= 60, 'after it most days are coin days, and both others come: ' + JSON.stringify(n) + ' of 400');
check(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(S.kind)).size === 3, 'all three kinds fall within the first ten days: ' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(S.kind).join(' '));
check([1, 2, 3, 50, 399].every((d) => S.kind(d) === S.kind(d)) && !/Math\.random|Date\.now|performance\.now/.test(fs.readFileSync(path.join(ROOT, 'js', 'sun3.js'), 'utf8')), 'which day is which never changes: a hash of the day\'s number, no dice, no clock');
const dayOf = (k) => { for (let d = 1; d < 100; d++) if (S.kind(d) === k) return d; };
const COAL = dayOf('coal'), COIN = dayOf('coin'), CLEAR = dayOf('clear');

// ---- the faces
check([0.3, 0.5, 0.7].every((t) => S.face(COAL, t).coal === 1 && S.face(COAL, t).clear === 0), 'on a coal day the sun is the coal at every hour');
check(S.face(COIN, 0.5).coal === 0 && S.face(COIN, 0.5).clear === 0, 'on a coin day at noon it is the pale coin');
check(S.face(CLEAR, 0.5).clear > 0.99 && S.face(CLEAR, 0.36).clear === 0 && S.face(CLEAR, 0.66).clear === 0, 'on a clear day it burns through about noon and not in the morning or the late afternoon');
check([COAL, COIN, CLEAR].every((d) => S.face(d, 0.745).coal === 1 && S.face(d, 0.255).coal === 1), 'at the horizon every sun is the coal: every dusk and dawn is red');
const lc = S.face(COAL, 0.5), li = S.face(COIN, 0.5), ll = S.face(CLEAR, 0.5);
check(lc.shadows < 0.2 && li.shadows < 0.4 && ll.shadows > 0.85 && lc.shadows < li.shadows, 'direct light at noon: a clear day throws shadows (' + ll.shadows.toFixed(2) + '), a coin day hardly (' + li.shadows.toFixed(2) + '), a coal day none to speak of (' + lc.shadows.toFixed(2) + ')');
const open = S.face(0, S.START_TOD);
check(open.cloud === 0 && open.dark === 0 && open.coal === 1, 'the red dusk the prologue opens in is lit as Phase 1 lit it: the pall adds nothing that low');
check([0, 0.2, 0.5, 0.74, 0.9].every((t) => { const f = S.face(CLEAR, t); return f.cloud >= 0 && f.cloud <= 1 && f.dark >= 0 && f.dark <= 0.6 && f.up >= 0 && f.up <= 1; }), 'every term stays inside what the engine accepts');

// ---- the written world says so
const bible = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-smothering.md'), 'utf8') + fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8');
check(/a pale coin behind the ash/.test(bible) && /throws a shadow at noon now, on some days/.test(bible) && /On the worst days over Orlen the sun is a dark disc with a red edge/.test(bible), 'the pale coin, the shadow at noon on some days, and the coal sun on the worst days are all written in the world bible');

// ---- in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(([COAL, COIN, CLEAR]) => {
      const out = { tod0: G.tod, day0: G.day, row: null };
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-laday'); out.row = b ? b.textContent : null; if (typeof closeModal === 'function') closeModal(); } catch (e) { out.row = String(e); }
      G.state = 'play'; Weather.hold('clear'); const box = document.querySelector('#msgs'); if (box) box.innerHTML = '';
      loadMap(LEDGE1.LEDGE, { x: 78.35, y: 49.2, dir: Math.PI }); if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.05);
      const pn = performance.now.bind(performance), t0 = pn();
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const shot = (day, tod) => {
        performance.now = pn; G.day = day; G.tod = tod; G.fadeT = 0; advanceTime(700); G.tod = tod; advanceTime(34); G.tod = tod; G.state = 'play';
        performance.now = () => t0; render(); render(); const p = R3D.readPixels(); performance.now = pn;
        let land = 0, ln = 0, sr = 0, sb = 0, sn = 0;
        for (let y = 0; y < p.h; y += 3) for (let x = 0; x < p.w; x += 3) { const i = (y * p.w + x) * 4, v = p.data[i] + p.data[i + 1] + p.data[i + 2]; if (y > p.h * 0.36 && y < p.h * 0.52) { land += v; ln++; } if (y > p.h * 0.8) { sr += p.data[i]; sb += p.data[i + 2]; sn++; } }
        return { hash: fnv(p.data), land: land / ln, skyR: sr / sn, skyB: sb / sn };
      };
      out.coal = shot(COAL, 0.5); out.coin = shot(COIN, 0.5); out.clear = shot(CLEAR, 0.5);
      out.wx = [COAL, COIN, CLEAR].map((d) => SUN3.face(d, 0.5).cloud.toFixed(2));
      GFX.laDay = false; out.offCoal = shot(COAL, 0.5); out.offClear = shot(CLEAR, 0.5); out.offDusk = shot(0, 0.735); GFX.laDay = true;
      out.onDusk = shot(0, 0.735);
      loadMap(LEDGE1.BOTHY); out.inCoal = shot(COAL, 0.5); out.inCoal2 = shot(COAL, 0.5); out.inClear = shot(CLEAR, 0.5); out.hereInside = SUN3.here(); out.passes = R3D.passes().map((p) => p.name);
      return out;
    }, [COAL, COIN, CLEAR]);
    check(Math.abs(r.tod0 - S.START_TOD) < 0.004 && r.day0 === 0, 'Begin opens on day 0 at the hour the sun stands over the Slagcrown');
    check(r.row === 'On', 'Options has a row for the sun\'s day');
    check(new Set([r.coal.hash, r.coin.hash, r.clear.hash]).size === 3, 'noon is three different pictures on a coal day, a coin day and a clear day');
    check(r.clear.land > r.coin.land * 1.1 && r.coin.land > r.coal.land * 1.1, 'and the land is brightest under the clear sun, dimmest under the coal (' + [r.clear.land, r.coin.land, r.coal.land].map((v) => v.toFixed(0)).join(' > ') + ')');
    check(r.coal.skyR > r.coal.skyB * 1.5 && r.coin.skyR < r.coin.skyB * 1.5 && r.clear.skyB > r.coin.skyB, 'the coal day\'s sky is red; the coin day\'s is ash-grey; the clear day\'s is paler still');
    // (the ash and the smoke drift between two stills, so these compare what a still measures, not its hash)
    const same = (a, b) => Math.abs(a.land - b.land) <= Math.max(1.5, a.land * 0.02) && Math.abs(a.skyR - b.skyR) <= Math.max(1.5, a.skyR * 0.03) && Math.abs(a.skyB - b.skyB) <= Math.max(1.5, a.skyB * 0.03);
    check(same(r.offCoal, r.offClear) && !same(r.offCoal, r.clear) && r.offCoal.skyR > r.offCoal.skyB * 1.5, 'switched off, the kind of day changes nothing: the red sky hangs as Phase 1 hung it (land ' + r.offCoal.land.toFixed(1) + ' and ' + r.offClear.land.toFixed(1) + ')');
    check(r.offDusk.hash !== r.onDusk.hash && Math.abs(r.offDusk.land - r.onDusk.land) < Math.max(3, r.offDusk.land * 0.15), 'at dusk on the first day, on and off light the land alike; only the disc stands elsewhere (land ' + r.offDusk.land.toFixed(1) + ' off, ' + r.onDusk.land.toFixed(1) + ' on)');
    const flick = Math.abs(r.inCoal.land - r.inCoal2.land), diff = Math.abs(r.inCoal.land - r.inClear.land);
    check(r.hereInside === false && diff <= Math.max(flick * 2.5, r.inCoal.land * 0.1), 'indoors the sun\'s day is not applied; two stills differ only as the fire flickers (' + diff.toFixed(1) + ' between kinds of day, ' + flick.toFixed(1) + ' between two of the same)');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
