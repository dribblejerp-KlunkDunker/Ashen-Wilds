// node test/dread9.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/dread9.test.js        with Playwright installed globally
// Phase 9, dread as a value that changes the picture. Without a browser: what raises dread and what lowers it (the dark,
// your lantern, the walking bloom where you can see or hear it and nowhere else, sleet, wounds, a barred room, a partner
// beside you), that it rises quicker than it falls, that a claw sends it up at once, and that the picture's measures are
// nothing at nought and grow with it. In a browser: the picture closes in at the edges, the colour drains from the world
// but not from the four lights, the far country goes to shapes, nothing is drawn at nought, the switch off draws exactly
// as before, and the Shattered Octave's own dread is gone from this game.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const D9 = require(path.join(ROOT, 'js', 'dread9.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'dread9.js'), 'utf8');
const round = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8');
const D = D9.D, T = D9.target, near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

// ---- what it stands on
check(/Dread as a value that changes the picture/.test(round) && /The worst thing is never on screen/.test(round) && /Four lights, never confused/.test(round), 'the design names the phase, the rules of dread and the four lights this is built against');

// ---- what raises it, and what does not
const base = { dark: 0, lamp: 0, room: false, barred: false, sleet: 0, hurt: 0, bloom: null, partner: Infinity };
const env = (o) => Object.assign({}, base, o);
check(T(env()) === 0, 'by day out of doors, with nothing near, there is no dread');
check(near(T(env({ dark: 1 })), D.night), 'night out of doors, with no light: ' + D.night);
check(T(env({ dark: 1, lamp: 1 })) < T(env({ dark: 1 })) * 0.5 && T(env({ dark: 1, lamp: 1 })) > 0, 'your lantern lit holds most of the dark off, not all of it (' + T(env({ dark: 1, lamp: 1 })).toFixed(2) + ')');
check(T(env({ dark: 0.5 })) < T(env({ dark: 1 })) && T(env({ dark: 0.5 })) > 0, 'dusk is between');
const ahead = (d, coming) => ({ d, coming: !!coming, ahead: true }), behind = (d, coming) => ({ d, coming: !!coming, ahead: false });
check(T(env({ bloom: ahead(3, true) })) >= 0.7, 'the walking bloom coming at you, three paces off where you can see it: ' + T(env({ bloom: ahead(3, true) })).toFixed(2));
check(T(env({ bloom: ahead(3, false) })) < T(env({ bloom: ahead(3, true) })) && T(env({ bloom: ahead(3, false) })) > 0, 'standing at its post in front of you, less (' + T(env({ bloom: ahead(3, false) })).toFixed(2) + ')');
check(T(env({ bloom: ahead(20, true) })) === 0, 'far off, nothing');
check(T(env({ bloom: ahead(6, true) })) > T(env({ bloom: ahead(10, true) })), 'nearer is worse');
check(T(env({ bloom: behind(8, true) })) === 0, 'NOT A RADAR: behind you and out of hearing, coming or not, it adds nothing ("The worst thing is never on screen" works both ways: what you cannot see or hear is not told to you)');
check(T(env({ bloom: behind(D.hearClose - 0.5, true) })) > 0, 'behind you but close enough to hear its shuffle (' + D.hearClose + ' cells), it counts');
check(T(env({ sleet: 1 })) > 0 && T(env({ sleet: 1 })) < D.night, 'sleet out of doors adds a little (' + T(env({ sleet: 1 })).toFixed(2) + ')');
check(T(env({ hurt: 0.2 })) === 0 && T(env({ hurt: 0.8 })) > 0.1, 'a scratch is nothing; a bad wound is felt (' + T(env({ hurt: 0.8 })).toFixed(2) + ')');
check(T(env({ dark: 1, bloom: ahead(2, true), hurt: 1, sleet: 1 })) === 1, 'it never passes 1');

// ---- what lowers it
const bad = { dark: 1, sleet: 1, hurt: 0.8 };
check(T(env(Object.assign({ room: true }, bad))) < T(env(bad)) * 0.5, 'under Marget Sayle\'s roof it falls to ' + T(env(Object.assign({ room: true }, bad))).toFixed(2));
check(T(env(Object.assign({ room: true, barred: true }, bad))) < T(env(Object.assign({ room: true }, bad))) && T(env(Object.assign({ room: true, barred: true }, bad))) <= 0.1, 'and with the bar across the door, lower still (' + T(env(Object.assign({ room: true, barred: true }, bad))).toFixed(2) + '): the one safe room');
check(T(env(Object.assign({ partner: 3 }, bad))) < T(env(bad)) && T(env(Object.assign({ partner: 30 }, bad))) === T(env(bad)), 'a partner beside you lowers it; one far off does not ("the only warmth is people")');

// ---- how it moves
const S = D9.fresh();
let t = 0; while (S.d < 0.95 && t < 60) { D9.step(S, env({ dark: 1, bloom: ahead(2, true) }), 0.1); t += 0.1; }
const up = t;
t = 0; while (S.d > 0.05 && t < 120) { D9.step(S, env(), 0.1); t += 0.1; }
const down = t;
check(up >= 3 && up <= 8 && down > up * 2.5, 'PLAYED in Node: it builds in ' + up.toFixed(1) + ' s and takes ' + down.toFixed(1) + ' s to leave you: it rises quicker than it falls');
const S2 = D9.fresh(); D9.step(S2, env({ clawed: 0 }), 0.1); const before = S2.d;
D9.step(S2, env({ clawed: 1 }), 0.1);
check(before === 0 && S2.d >= D.claw, 'a claw sends it up at once (to ' + S2.d.toFixed(2) + '): the one thing that jumps');
S2.d = 0.2; D9.step(S2, env({ clawed: 1 }), 0.1);
check(S2.d <= 0.2, 'the same claw does not do it twice (' + S2.d.toFixed(2) + ')');
D9.step(S2, env({ clawed: 2 }), 0.1);
check(S2.d >= D.claw, 'a second claw does');
const S3 = D9.fresh(); S3.d = 0.5; D9.step(S3, env({ dark: 1 }), 0); check(S3.d === 0.5, 'no time, no change');
const a1 = D9.fresh(), a2 = D9.fresh(); for (let i = 0; i < 50; i++) { D9.step(a1, env({ dark: 1, sleet: i / 50 }), 0.13); D9.step(a2, env({ dark: 1, sleet: i / 50 }), 0.13); }
check(a1.d === a2.d, 'the same steps give the same dread, every time');

// ---- the picture's measures
const L0 = D9.look(0, {}), L1 = D9.look(1, {}), Lh = D9.look(0.5, {});
check(['drain', 'close', 'crush', 'far', 'breathe'].every((k) => L0[k] === 0), 'at nought it changes nothing');
check(L1.drain > Lh.drain && Lh.drain > 0 && L1.close > Lh.close && L1.far > Lh.far && L1.crush > Lh.crush, 'every measure grows with it');
check(L1.drain <= 0.7 && L1.close <= 0.85 && L1.far <= 0.75 && L1.crush <= 0.4, 'and none of them blacks the view out: at its worst you can still see where you are going');
check(L1.inner < Lh.inner && Lh.inner < L0.inner, 'the edges close in as it rises');
check(L1.breathe > 0 && D9.look(1, { still: true }).breathe === 0 && D9.look(0.4, {}).breathe === 0, 'only at its height does the closing breathe, and never with Reduce motion or No flashes');
check(D9.look(1, {}).farFrom < D9.look(0.3, {}).farFrom, 'the far country goes to shapes from nearer and nearer');

// ---- the four lights: a twin of the shader's rule, kept with it
const keep = D9.keep;
check(keep(1.0, 0.66, 0.16) > 0.9, 'tallow yellow keeps its colour');
check(keep(0.9, 0.35, 0.18) > 0.9, 'ember red keeps its colour');
check(keep(0.13, 0.27, 0.27) > 0.6, 'bloom teal keeps its colour');
check(keep(0.55, 0.65, 0.95) > 0.6, 'pale blue, a working, keeps its colour');
check(keep(0.29, 0.29, 0.29) === 0 && keep(0.35, 0.27, 0.24) < 0.2 && keep(0.6, 0.55, 0.52) < 0.2, 'grey rock, scorched earth and frost drain');
check(keep(0.02, 0.01, 0.0) < 0.05, 'near-black stays black');

// ---- the rules of the repository
check(!/Math\.random/.test(src), 'nothing in it uses a random number; the breath is a sine of the anim clock');
check(/[\x80-￿]/.test((src.match(/'[^'\n]*'/g) || []).filter((s) => /^'[A-Z]/.test(s)).join('')) === false, 'its words are plain ASCII');
check(/\[PROPOSED\]/.test(src), 'its invented numbers are marked [PROPOSED]');
check(/laDread/.test(src) && /SWITCHES\.push\(\['laDread'/.test(src), 'it has an Options switch');

// ---- in a browser: the same things, played. Skipped (and said so) when no Playwright can be found.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(async () => {
      const out = { err: null }, c = Engine.cam;
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const A0 = 12.5;   // the anim clock held at one moment (the breath and the ash move with it), the same on every machine
      const frame = () => { performance.now = () => t0; Date.now = () => d0; if (typeof ANIM !== 'undefined') ANIM.T = A0; render(); render(); return R3D.readPixels(); };
      try {
        // the Octave's own dread is not this game's
        out.octave = { on: typeof DREAD !== 'undefined' ? DREAD.set.on : null };
        renderAccessibilityMenu();
        out.octave.row = !!document.getElementById('dread-on'); out.row = (document.getElementById('gfx-ladread') || {}).textContent || null;
        if (typeof closeModal === 'function') closeModal();
        // night, on the ledge, looking out at the burning country, the lantern dark
        G.state = 'play'; UPG.lantern = false; const box = document.querySelector('#msgs'); if (box) box.innerHTML = '';
        loadMap(LEDGE1.LEDGE, { x: 80.5, y: 49.2, dir: Math.PI }); G.tod = 0.02; G.fadeT = 0; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.12); advanceTime(300);
        // PLAYED: standing out in the night with no light, dread builds of itself
        DREAD9.state().d = 0; G.tod = 0.02; advanceTime(8000); out.night = DREAD9.state().d;
        G.tod = 0.5; for (let i = 0; i < 40; i++) advanceTime(500); out.dayAfter = DREAD9.state().d;
        // the picture, by hand: nought, half, full
        // (measured at noon: at night the frame is too near black to show what is taken from it; the first frame after a
        // change is thrown away while the sky settles)
        G.tod = 0.5; advanceTime(300);
        const hold = (v) => { DREAD9.state().d = v; DREAD9.state().hold = true; };
        hold(0); frame(); const p0 = frame(); out.h0 = fnv(p0.data);
        GFX.laDread = false; const pOff = frame(); out.hOff = fnv(pOff.data);
        const P = R3D.getPass('la-dread'); R3D.removePass('la-dread'); const pBare = frame(); out.hBare = fnv(pBare.data); R3D.addPass(P);
        GFX.laDread = true;
        hold(1); const p1 = frame(); out.h1 = fnv(p1.data);
        // measures: corners against the middle, and how much colour is left, on the lit land
        const lum = (p, x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = Math.round(p.h * y0); y < Math.round(p.h * y1); y += 2) for (let x = Math.round(p.w * x0); x < Math.round(p.w * x1); x += 2) { const i = (y * p.w + x) * 4; s += p.data[i] * 0.3 + p.data[i + 1] * 0.59 + p.data[i + 2] * 0.11; n++; } return s / n; };
        const sat = (p, x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = Math.round(p.h * y0); y < Math.round(p.h * y1); y += 2) for (let x = Math.round(p.w * x0); x < Math.round(p.w * x1); x += 2) { const i = (y * p.w + x) * 4, r = p.data[i], g = p.data[i + 1], b = p.data[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx > 8) { s += (mx - mn) / mx; n++; } } return n ? s / n : 0; };
        // readPixels rows run bottom up; the view is the upper part of the frame (the panel is below it)
        out.mid = [lum(p0, 0.4, 0.55, 0.6, 0.75), lum(p1, 0.4, 0.55, 0.6, 0.75)];
        out.corner = [lum(p0, 0.0, 0.85, 0.12, 0.98), lum(p1, 0.0, 0.85, 0.12, 0.98)];
        out.sat = [sat(p0, 0.1, 0.4, 0.9, 0.95), sat(p1, 0.1, 0.4, 0.9, 0.95)];
        // the four lights hold: at night, the warmest pixels in the view (the burning country) are as warm at full dread
        G.tod = 0.02; advanceTime(300); hold(0); frame(); const n0 = frame(); hold(1); const n1 = frame();
        const warm = (p) => { let best = 0; for (let y = Math.round(p.h * 0.4); y < p.h; y += 1) for (let x = 0; x < p.w; x += 1) { const i = (y * p.w + x) * 4, r = p.data[i], b = p.data[i + 2]; if (r > 60) best = Math.max(best, (r - b) / r); } return best; };
        out.warm = [warm(n0), warm(n1)];
        // your own light: the lantern lit at night, looking down at the pool at your feet; its warmth (red over blue) holds
        UPG.lantern = true; LANTERN7.state().prev = true; G.flags.la_oil = 1080; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.45); advanceTime(300);
        const pool = (p) => { let r = 0, b = 0, n = 0; for (let y = Math.round(p.h * 0.45); y < Math.round(p.h * 0.7); y += 2) for (let x = Math.round(p.w * 0.3); x < Math.round(p.w * 0.7); x += 2) { const i = (y * p.w + x) * 4; r += p.data[i]; b += p.data[i + 2]; n++; } return (r - b) / n; };
        hold(0); frame(); const l0 = frame(); hold(1); const l1 = frame(); out.pool = [pool(l0), pool(l1)];
        UPG.lantern = false; LANTERN7.state().prev = false; if (R3D.camera && R3D.camera.setAngle) R3D.camera.setAngle(-0.12);
        // cost
        const ms = []; hold(1); for (let i = 0; i < 12; i++) { const a = pn(); render(); ms.push(pn() - a); } hold(0); const ms0 = []; for (let i = 0; i < 12; i++) { const a = pn(); render(); ms0.push(pn() - a); }
        ms.sort((a, b) => a - b); ms0.sort((a, b) => a - b); out.ms = [ms0[6], ms[6]];
        DREAD9.state().hold = false;
        // PLAYED: in the bothy with the bar across, it leaves you
        DREAD9.state().d = 0.9; G.flags.la_barred = true; loadMap(LEDGE1.BOTHY); advanceTime(300);
        for (let i = 0; i < 60; i++) advanceTime(500); out.bothy = DREAD9.state().d; G.flags.la_barred = false;
        out.err = DREAD9.state().err;
      } catch (e) { out.err = String(e && e.message); }
      performance.now = pn; Date.now = dn;
      return out;
    });
    check(r.octave.on === false && r.octave.row === false, 'the Shattered Octave\'s own dread (its songs\' Dissonance and its stalker) is off here, and its row is gone from Options');
    check(r.row === 'On', 'Options has this game\'s row: Dread, on');
    check(r.night > 0.3 && r.night <= 0.45, 'PLAYED: eight seconds out in the night with no light, dread builds of itself to ' + (r.night || 0).toFixed(2));
    check(r.dayAfter < r.night * 0.6, 'and in daylight it slowly lets go (' + (r.dayAfter || 0).toFixed(2) + ' after twenty seconds)');
    check(r.h0 === r.hOff && r.hOff === r.hBare, 'at nought it draws nothing: the frame is the frame with the switch off, and the frame with the pass taken out (' + r.hBare + ')');
    check(r.h1 !== r.h0, 'at full dread the picture changes');
    check(r.corner[1] < r.corner[0] * 0.6 && r.mid[1] > r.mid[0] * 0.45, 'the edges close in (a corner ' + r.corner[0].toFixed(1) + ' to ' + r.corner[1].toFixed(1) + ') while the middle stays readable (' + r.mid[0].toFixed(1) + ' to ' + r.mid[1].toFixed(1) + ')');
    check(r.sat[1] < r.sat[0] * 0.85, 'the colour drains from the world (' + r.sat[0].toFixed(3) + ' to ' + r.sat[1].toFixed(3) + ')');
    check(r.warm[1] >= r.warm[0] * 0.92, 'but not from the burning country: the warmest light is as warm (' + r.warm[0].toFixed(2) + ', ' + r.warm[1].toFixed(2) + ')');
    check(r.pool[0] > 4 && r.pool[1] >= r.pool[0] * 0.8, 'and not from your own light: the lantern\'s pool at your feet stays tallow-warm (red over blue ' + r.pool[0].toFixed(1) + ', ' + r.pool[1].toFixed(1) + ')');
    check(r.bothy < 0.35, 'PLAYED: in the bothy with the bar across, it leaves you (0.90 to ' + (r.bothy || 0).toFixed(2) + ' in thirty seconds)');
    console.log('NOTE a frame takes ' + r.ms[0].toFixed(2) + ' ms at nought and ' + r.ms[1].toFixed(2) + ' ms at full dread under software rendering; that cannot say what a real graphics card does');
    check(!r.err, 'nothing threw: ' + (r.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
