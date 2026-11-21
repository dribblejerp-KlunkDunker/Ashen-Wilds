// node test/lantern7.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/lantern7.test.js        with Playwright installed globally
// Phase 7, the lantern as the one light. This checks the oil's rules against the bible without a browser (dusk to dawn
// on one filling, sleet's x1.8, the flame shrinking and guttering, a flask refused near a flame), and in a browser: U
// lights it with this game's words, its light is tallow yellow and small and warms the ground, the left hand shows it,
// it burns out, sleet spends it faster, Marget Sayle's flasks fill it, the walking bloom sees it, and the switch puts
// back the engine's own lantern.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const LA = require(path.join(ROOT, 'js', 'lantern7.js')), W6 = require(path.join(ROOT, 'js', 'weather6.js')), B4 = require(path.join(ROOT, 'js', 'bloom4.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'lantern7.js'), 'utf8');
const bible = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-smothering.md'), 'utf8');
const round = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8');
const L = LA.L;

// ---- the bible's numbers, and that the rules carry them
check(/oil for one lamp, dusk to dawn/.test(round) && L.fillS === W6.DAY_S / 2, 'one filling burns dusk to dawn: the bible prices a night as "oil for one lamp, dusk to dawn", and the sun is down for half of the ' + W6.DAY_S + ' s day');
check(/\| Sleet \| 14 \| x0\.85 \| x1\.8 \|/.test(bible) && /\| Ashfall \| 24 \| x1\.0 \| x1\.0 \|/.test(bible) && L.burn.sleet === 1.8 && L.burn.ashfall === 1, 'the weather spends it by the bible\'s torch-burn column: ashfall x1.0, sleet x1.8');
check(LA.burnRate(0) === 1 && LA.burnRate(1) === 1.8 && Math.abs(LA.burnRate(0.5) - 1.4) < 1e-9, 'and half way into a spell of sleet, half the change');
const burnFor = (oil, rate) => { const st = { lit: true, oil }; let t = 0, low = 0, out = 0; while (st.lit && t < 5000) { const e = LA.burnStep(st, 0.5, rate); t += 0.5; if (e === 'low') low++; if (e === 'out') out++; } return { t, low, out, st }; };
const dry = burnFor(L.fillS, 1), wet = burnFor(L.fillS, 1.8);
check(Math.abs(dry.t - L.fillS) <= 0.5 && Math.abs(wet.t - L.fillS / 1.8) <= 0.5, 'PLAYED in Node: a full lantern lasts ' + dry.t + ' s in ashfall and ' + wet.t + ' s in sleet');
check(dry.low === 1 && dry.out === 1 && dry.st.lit === false && dry.st.oil === 0, 'it says it is burning low once, then goes out and stays out');
check(LA.burnStep({ lit: false, oil: 100 }, 1, 1) === null, 'unlit, it burns nothing');
check(LA.flame(L.fillS) === 1 && LA.flame(L.fillS * L.lowAt) === 1 && LA.flame(L.fillS * L.lowAt / 2) < 1 && LA.flame(1) > 0.3 && LA.flame(0) === 0, 'the flame is full until the last fifth, then shrinks, and is gone at nothing (the bible: "it dims as it runs low and gutters out")');
check(LA.radius(L.fillS) === L.r[1] && LA.radius(1) < L.r[1] * 0.6 && L.r[1] <= 4.5, 'its pool is small: ' + L.r[1] + ' cells full, ' + LA.radius(1).toFixed(1) + ' nearly dry');
let calm = 1, gut = 1; for (let t = 0; t < 20; t += 0.05) { calm = Math.min(calm, LA.flicker(L.fillS, t)); gut = Math.min(gut, LA.flicker(2, t)); }
check(calm > 0.85 && gut < 0.5 && LA.flicker(10, 3.3) === LA.flicker(10, 3.3), 'a steady flame breathes a little (no lower than ' + calm.toFixed(2) + '); its last half minute gutters (down to ' + gut.toFixed(2) + '); the same moment always flickers the same');
const st = (o) => Object.assign({ lit: false, oil: 100, flasks: 2 }, o);
let a = st({ lit: true }); check(LA.pour(a) === 'lit' && a.flasks === 2, 'a flask is not poured near a flame (the bible: "Keep it from the torch")');
a = st({ oil: L.fillS }); check(LA.pour(a) === 'full' && a.flasks === 2, 'nor into a full lantern');
a = st({ flasks: 0 }); check(LA.pour(a) === 'none', 'nor when there is none');
a = st(); check(LA.pour(a) === 'filled' && a.flasks === 1 && a.oil === L.fillS, 'otherwise one flask fills it');
check(L.flasks === 2 && L.startS === L.fillS / 2, 'you come with it half full, and Marget Sayle has two flasks');

// ---- the light's colours: the four lights, never confused
const [r, g, b] = L.col, hearth = [150, 66, 18];
check(r > g && g > b && g / r > 0.55 && g / r > hearth[1] / hearth[0] + 0.15, 'tallow yellow: yellower than the hearth\'s red (green ' + (g / r).toFixed(2) + ' of red, the hearth ' + (hearth[1] / hearth[0]).toFixed(2) + '), with no teal or blue in it');

// ---- what it costs: the bloom sees a lit lantern
const S = B4.fresh(), ahead = (d) => ({ x: S.x + Math.cos(S.yaw) * d, y: S.y + Math.sin(S.yaw) * d });
const p11 = ahead(11), p7 = ahead(7), p13 = ahead(13);
check(!B4.sees(S, p7.x, p7.y, false, 1, 0) && B4.sees(S, p7.x, p7.y, false, 1, 1), 'standing still 7 m in front of the walking bloom, you are not seen; with the lantern lit, you are');
check(!B4.sees(S, p11.x, p11.y, true, 1, 0) && B4.sees(S, p11.x, p11.y, true, 1, 1) && !B4.sees(S, p13.x, p13.y, false, 1, 1), 'it sees a lantern 11 m off (8 m without), and not at 13 (R.litSee ' + B4.R.litSee + ')');
check(B4.sees(S, p11.x, p11.y, false, 14 / 24, 1) === false, 'and sleet shortens that sight as it shortens the rest');

// ---- the pictures
const dark = LA.paintLantern(false), lit = LA.paintLantern(true);
let bottom = 0; for (let x = 0; x < dark.w; x++) if (dark.data[(dark.h - 1) * dark.w + x] >>> 24) bottom++;
check(dark.w === 110 && dark.h === 200 && bottom > 10, 'the arm leaves the picture through its bottom edge (' + bottom + ' pixels of sleeve on the last row)');
check(!dark.emit && lit.emit && lit.emit.reduce((s, v) => s + v, 0) > 600, 'unlit, nothing in it glows; lit, the horn and the flame do');
const oil = [0, 1, 2].map((n) => LA.paintOil(n)); check(oil.every((p) => p.w === 70 && p.h === 64) && oil[2].data.some((v, i) => v !== oil[0].data[i]), 'Marget Sayle\'s flasks, painted in code, two, one and none');

// ---- the words and the rules of the house
const allTx = [LA.TX.light('about half full'), LA.TX.douse, LA.TX.dry, LA.TX.low, LA.TX.out, LA.TX.oil(2), LA.TX.oil(1), LA.TX.oil(0), LA.TX.filled(1), LA.TX.filled(0), LA.TX.notLit, LA.TX.full, LA.TX.none, LA.TX.marget, ...[L.fillS, 700, 500, 300, 50, 0].map(LA.words)];
check(allTx.every((t) => !/[^\x20-\x7e]/.test(t)), 'all of it plain ASCII (canon rule)');
check(!/\d/.test([L.fillS, 700, 500, 300, 50].map((o) => LA.TX.light(LA.words(o))).join(' ')), 'it tells you how full it is in words, not numbers: "' + LA.TX.light(LA.words(500)) + '"');
check(!/Math\.random|Date\.now|performance\.now/.test(src), 'nothing in it is random or read off a clock');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/js\/weather6\.js\?v=\d+"><\/script>\s*<script src="js\/lantern7\.js\?v=\d+"><\/script>/.test(html) && /js\/lantern7\.js\?v=\d+/.test(sw), 'index.html loads lantern7.js straight after weather6.js, and the offline list carries it');

// ---- the played half, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const NIGHT = 0.95;
    // stand somewhere, at an hour, with this much oil, lit or not
    await s.page.evaluate(() => {
      window.__at = (map, x, y, dir, tod, oil, lit, on = true, pitch = -0.06) => {
        BLOOM4.reset(); G.flags = { la_told_bar: true, la_oil: oil }; GFX.laLamp = on; GFX.laWx = true; loadMap(map, { x, y, dir }); G.state = 'play'; G.day = 2; G.tod = tod; G.fadeT = 0; G.keys = {};
        UPG.lantern = lit; LANTERN7.state().prev = lit; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(pitch); advanceTime(300); G.tod = tod; G.flags.la_oil = oil; LANTERN7.state().said.length = 0;
      };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      window.__frame = () => { performance.now = () => t0; Date.now = () => d0; render(); render(); const p = R3D.readPixels(); const h = Engine.ctx.getImageData(0, 0, Engine.ctx.canvas.width, Engine.ctx.canvas.height); performance.now = pn; Date.now = dn; return { p, h }; };
      window.__fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
    });
    const r = await s.page.evaluate((NIGHT) => {
      const out = {};
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-lalamp'); out.row = b ? b.textContent : null; if (typeof closeModal === 'function') closeModal(); } catch (e) { out.row = String(e); }
      // the light: lit at night, half full
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, true);
      const Lt = LIGHTING.lanternLight(); out.light = Lt ? { r: Lt.r, c: [Lt.cr, Lt.cg, Lt.cb], d: Math.hypot(Lt.x - Engine.cam.x, Lt.y - Engine.cam.y) } : null;
      // the pool, looking down: lit against unlit
      const reg = (p) => { let r = 0, g = 0, b = 0, n = 0; for (let y = 0; y < p.h * 0.75; y += 2) for (let x = Math.floor(p.w * 0.25); x < p.w * 0.75; x += 2) { const i = (y * p.w + x) * 4; r += p.data[i]; g += p.data[i + 1]; b += p.data[i + 2]; n++; } return [r / n, g / n, b / n]; };
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, false, true, -0.45); const fOff = __frame();
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, true, true, -0.45); const fOn = __frame();
      out.pool = { off: reg(fOff.p), on: reg(fOn.p) };
      // the left hand: warm pixels in the lantern's corner of the HUD
      const warm = (h) => { let n = 0; const w = h.width, H = Math.floor(h.height * 150 / 200); for (let y = Math.floor(H * 0.4); y < H; y++) for (let x = 0; x < Math.floor(w * 0.12); x++) { const i = (y * w + x) * 4; if (h.data[i + 3] > 200 && h.data[i] > 150 && h.data[i] - h.data[i + 2] > 70) n++; } return n; };
      const any = (h) => { let n = 0; const w = h.width, H = Math.floor(h.height * 150 / 200); for (let y = Math.floor(H * 0.4); y < H; y++) for (let x = 0; x < Math.floor(w * 0.12); x++) if (h.data[(y * w + x) * 4 + 3] > 200) n++; return n; };
      out.hand = { lit: warm(fOn.h), unlit: warm(fOff.h), drawn: any(fOff.h) };
      // the body pass: the sword arm is not burnt white (mean of the right-hand bottom corner)
      // (readPixels rows run bottom up: the sword arm is the view's lower right, rows 25% to 44% of the frame from the bottom)
      const corner = (p) => { let s = 0, n = 0; for (let y = Math.floor(p.h * 0.25); y < p.h * 0.44; y += 2) for (let x = Math.floor(p.w * 0.86); x < p.w * 0.97; x += 2) { const i = (y * p.w + x) * 4; s += (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3; n++; } return s / n; };
      const k0 = LANTERN7.L.bodyK; LANTERN7.L.bodyK = 1; const fBurn = __frame(); LANTERN7.L.bodyK = k0;
      out.arm = { on: corner(fOn.p), off: corner(fOff.p), burnt: corner(fBurn.p), wrapped: !!R3D.getPass('body') && !!R3D.getPass('body')._la7 };
      // by day out of doors it shows as nothing much
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, 0.5, 540, true); out.day = LIGHTING.lanternLight();
      // the key: U lights it with this game's words, and douses it; dry, it stays dark
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, false);
      return out;
    }, NIGHT);
    await s.page.keyboard.press('u');
    const k1 = await s.page.evaluate(() => ({ lit: UPG.lantern, said: LANTERN7.state().said.slice() }));
    await s.page.keyboard.press('u');
    const k2 = await s.page.evaluate(() => { const o = { lit: UPG.lantern, said: LANTERN7.state().said.slice() }; G.flags.la_oil = 0; LANTERN7.state().said.length = 0; return o; });
    await s.page.keyboard.press('u');
    const k3 = await s.page.evaluate(() => ({ lit: UPG.lantern, said: LANTERN7.state().said.slice() }));
    const r2 = await s.page.evaluate((NIGHT) => {
      const out = {}, said = () => LANTERN7.state().said.join(' | ');
      // it burns out: three seconds of oil, five seconds lit
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 3, true); for (let i = 0; i < 20; i++) { G.tod = NIGHT; advanceTime(250); }
      out.out = { lit: UPG.lantern, oil: G.flags.la_oil, said: said(), light: LIGHTING.lanternLight() };
      // sleet spends it faster: ten seconds in ashfall and ten in sleet, on the ledge on the first night
      const spend = (tod) => { __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, tod, 540, true); G.day = 0; for (let i = 0; i < 40; i++) { G.tod = tod; advanceTime(250); } return 540 - G.flags.la_oil; };
      const sp = WEATHER6.spells(0)[0]; out.spend = { dry: spend(0.786), wet: spend((sp[0] + sp[1]) / 2), inside: 0 };
      __at(LEDGE1.BOTHY, 3.5, 3.6, -Math.PI / 2, (sp[0] + sp[1]) / 2, 540, true); G.day = 0; for (let i = 0; i < 40; i++) { G.tod = (sp[0] + sp[1]) / 2; advanceTime(250); } out.spend.inside = 540 - G.flags.la_oil;
      // Marget Sayle's flasks
      __at(LEDGE1.BOTHY, 1.6, 2.4, -Math.PI / 2, NIGHT, 100, true);
      const e = G.map.entities.find((x) => x.use === 'la_oil'); out.oil = { found: !!e, sprite: e && e.sprite, hidden: e && e.hidden };
      useDeco(e); out.oil.lit = { oil: G.flags.la_oil, flasks: G.flags.la_flasks, said: said() };
      UPG.lantern = false; LANTERN7.state().said.length = 0; useDeco(e); for (let i = 0; i < 12; i++) advanceTime(250);
      out.oil.filled = { oil: G.flags.la_oil, flasks: G.flags.la_flasks, said: said(), sprite: e.sprite };
      LANTERN7.state().said.length = 0; useDeco(e); out.oil.full = said();
      G.flags.la_oil = 10; LANTERN7.state().said.length = 0; useDeco(e); useDeco(e); G.flags.la_oil = 10; LANTERN7.state().said.length = 0; useDeco(e); advanceTime(50); out.oil.none = { said: said(), sprite: e.sprite, flasks: G.flags.la_flasks };
      // the walking bloom sees a lit lantern: stand still in front of it, 10 m off, at night
      const look = (lit) => {
        __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, lit); const P = BLOOM4.R.post, c = Engine.cam;
        let spot = null; for (const d of [10, 9.5, 10.5, 9, 11]) for (const da of [0, 0.2, -0.2, 0.4, -0.4]) { const a = P.yaw + da, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d; if (!spot && !G.map.isBlocked(Math.floor(x), Math.floor(y))) spot = { x, y, d }; }
        if (!spot) return { none: true };
        c.x = spot.x; c.y = spot.y; BLOOM4.reset(); let st = 'post';
        for (let i = 0; i < 20; i++) { G.tod = NIGHT; G.keys = {}; advanceTime(50); st = BLOOM4.state().state; if (st !== 'post') break; }
        return { state: st, d: spot.d };
      };
      out.bloom = { dark: look(false), lit: look(true) };
      // switched off: the engine's own lantern, no oil spent, no picture, no flasks
      __at(LEDGE1.LEDGE, 89.5, 40.5, Math.PI, NIGHT, 540, true, false); for (let i = 0; i < 8; i++) { G.tod = NIGHT; advanceTime(250); }
      const eng = LANTERN7.ORIG.lanternLight(); const Lo = LIGHTING.lanternLight();
      out.off = { oil: G.flags.la_oil, same: !!Lo && !!eng && Lo.cr === eng.cr && Lo.r === eng.r, notOurs: Lo !== LANTERN7.lampLight() };
      const fOff = __frame(); out.off.hash = __fnv(fOff.p.data) + ':' + __fnv(fOff.h.data);
      const lg = LIGHTING.lanternLight, dh = drawHUD; LIGHTING.lanternLight = LANTERN7.ORIG.lanternLight; drawHUD = typeof PANEL10 !== 'undefined' ? PANEL10.wrapHUD(LANTERN7.ORIG.drawHUD) : LANTERN7.ORIG.drawHUD;   // a later phase's layer (Phase 10's words) stays on
      const fBare = __frame(); out.off.bare = __fnv(fBare.p.data) + ':' + __fnv(fBare.h.data); LIGHTING.lanternLight = lg; drawHUD = dh;
      __at(LEDGE1.BOTHY, 1.6, 2.4, -Math.PI / 2, NIGHT, 540, false, false); advanceTime(50); const e2 = G.map.entities.find((x) => x.use === 'la_oil'); out.off.flasksHidden = e2 && e2.hidden;
      GFX.laLamp = true;
      out.err = LANTERN7.state().err || WEATHER6.state().err || BLOOM4.gl().tickErr || null;
      return out;
    }, NIGHT);
    check(r.row === 'On', 'Options has a row for the lantern');
    check(r.light && r.light.r === 4.2 && r.light.c[0] > r.light.c[1] && r.light.c[1] > r.light.c[2] && r.light.d < 0.45, 'lit at night, it is a tallow light ' + (r.light ? r.light.r : '?') + ' cells round, in your hand (' + (r.light ? r.light.c.map((v) => v.toFixed(0)).join('/') : 'none') + ')');
    const dR = r.pool.on[0] - r.pool.off[0], dB = r.pool.on[2] - r.pool.off[2];
    check(dR > 12 && dR > dB * 2, 'PLAYED: looking down, it warms the ground at your feet (red +' + dR.toFixed(1) + ', blue +' + dB.toFixed(1) + ')');
    check(r.hand.drawn > 2000 && r.hand.lit > 300 && r.hand.unlit < r.hand.lit / 10, 'the lantern is in your left hand: dark unlit, its horn glowing lit (' + r.hand.lit + ' warm pixels against ' + r.hand.unlit + ')');
    check(r.arm.wrapped && r.arm.on > r.arm.off && r.arm.burnt > r.arm.on + 15, 'and it warms your sword arm without burning it white (the arm\'s corner ' + r.arm.off.toFixed(0) + ' unlit, ' + r.arm.on.toFixed(0) + ' lit, ' + r.arm.burnt.toFixed(0) + ' if the body pass took the full light)');
    check(r.day === null, 'by day out of doors its light adds nothing');
    check(k1.lit === true && /You light the lantern\. It is about half full\./.test(k1.said.join('|')), 'PLAYED: U lights it and tells you how full it is: "' + k1.said.join(' | ') + '"');
    check(k2.lit === false && /You douse the lantern/.test(k2.said.join('|')), 'and U again douses it');
    check(k3.lit === false && /The lantern is dry/.test(k3.said.join('|')), 'dry, it will not light: "' + k3.said.join(' | ') + '"');
    check(r2.out.lit === false && r2.out.oil === 0 && /gutters and goes out/.test(r2.out.said) && r2.out.light === null, 'PLAYED: it burns its oil and goes out: "' + r2.out.said + '"');
    const ratio = r2.spend.wet / r2.spend.dry;
    check(Math.abs(r2.spend.dry - 10) < 0.6 && Math.abs(ratio - 1.8) < 0.08, 'PLAYED: ten seconds burn ' + r2.spend.dry.toFixed(1) + ' s of oil in ashfall and ' + r2.spend.wet.toFixed(1) + ' in sleet (x' + ratio.toFixed(2) + ')');
    check(Math.abs(r2.spend.inside - r2.spend.dry) < 0.6, 'under a roof, sleet spends nothing extra (' + r2.spend.inside.toFixed(1) + ' s)');
    check(r2.oil.found && r2.oil.sprite === 'la_oil2' && !r2.oil.hidden, 'Marget Sayle\'s two flasks stand in the bothy\'s corner');
    check(r2.oil.lit.oil === 100 && r2.oil.lit.flasks === 2 && /Douse the lantern first/.test(r2.oil.lit.said), 'not with the lantern lit: "' + r2.oil.lit.said + '"');
    check(r2.oil.filled.oil === L.fillS && r2.oil.filled.flasks === 1 && r2.oil.filled.sprite === 'la_oil1' && /One flask is left/.test(r2.oil.filled.said) && /Marget Sayle: "/.test(r2.oil.filled.said), 'PLAYED: doused, a flask fills it; one is left; Marget says one thing: "' + r2.oil.filled.said + '"');
    check(/The lantern is full/.test(r2.oil.full), 'a full lantern takes no more');
    check(r2.oil.none.flasks === 0 && r2.oil.none.sprite === 'la_oil0' && /There is no oil left/.test(r2.oil.none.said), 'and when both are poured, there is none: "' + r2.oil.none.said + '"');
    check(r2.bloom.dark.state === 'post' && r2.bloom.lit.state !== 'post' && !r2.bloom.lit.none, 'PLAYED: standing still ' + (r2.bloom.lit.d || '?') + ' m in front of the walking bloom at night, it does not see you in the dark; with the lantern lit it does (' + r2.bloom.lit.state + ')');
    check(r2.off.oil === 540 && r2.off.same && r2.off.notOurs && r2.off.flasksHidden === true, 'switched off: the engine\'s own lantern, no oil spent, and no flasks in the corner');
    check(r2.off.hash === r2.off.bare, 'switched off, the frame (scene and HUD) is exactly the frame with this phase\'s wrappers taken out (' + r2.off.hash + ')');
    check(!r2.err, 'nothing threw: ' + (r2.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
