// node test/torch38.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/torch38.test.js        with Playwright installed globally
// Phase 38, start with a torch. Without a browser: the bible's torch fuel by background, the torch's words, a new
// traveller, the three kinds of old save, taking and gaining a light, and the pictures. In a browser: you begin with the
// torch in hand at the card's fuel; it lights by U with this game's words, burns, throws a bigger and redder pool than
// the lantern; the HUD's bar and PACK speak of the torch; lamp oil is refused with no lantern; the horn lantern is found
// in the bothy and taken into the hand; the pack swaps the two; the flasks fill the lantern while the torch burns; an old
// save from the #63/#64 build gets its fuel moved and the flasks back; and switched off, the frame is Phase 7's.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'js', 'torch38.js')), K17 = require(path.join(ROOT, 'js', 'kit17.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const items = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'items-and-texts.md'), 'utf8');
const src = fs.readFileSync(path.join(ROOT, 'js', 'torch38.js'), 'utf8');

// ---- the bible's numbers
check(/240 s of fuel by default/.test(items) && /90 s for the Gutter-kin, 360 s\s+for the Hedge-priest/.test(items) && T.fuelOf('deserter') === 240 && T.fuelOf('gutter') === 90 && T.fuelOf('priest') === 360,
  'the torch\'s fuel is the bible\'s: 240 s, the gutter-kin 90, the hedge-priest 360');
check(['deserter', 'factor', 'cleaner', 'cutter', 'gutter', 'priest', 'healer', 'carter'].every((bg) => T.fuelOf(bg) === K17.torchFuel(bg)), 'and it agrees with the kit table (Phase 17) for all eight cards');
check(/1\.2 kg\s*\|\s*A shuttered lantern: less light range than the torch/.test(items) && T.T.lanternKg === 1.2, 'the horn lantern weighs the bible\'s 1.2 kg');
check(T.T.r[1] > 4.2 && T.T.r[0] > 1.7, 'the torch throws more light than the lantern (the bible: the lantern has "less light range than the torch")');
check(T.T.col[0] > T.T.col[1] && T.T.col[1] > T.T.col[2] * 3, 'its light is warm and has little blue, so it reads warm on frost');

// ---- the words
check(T.words(240, 240) === 'fresh' && T.words(120, 240) === 'half burned' && T.words(10, 240) === 'nearly spent' && T.words(0, 240) === 'spent', 'the torch says how much is left in words, never numbers');
check(Object.values(T.TX).every((v) => typeof v !== 'string' || /^[\x20-\x7e]*$/.test(v)) && /^[\x20-\x7e]*$/.test(T.TX.light('fresh') + T.TX.pinch('torch') + T.TX.pinch('lantern')), 'every line is plain ASCII');

// ---- a new traveller, and old saves
{
  const f = T.fresh({}, 'priest');
  check(f.la_light === 'torch' && f.la_torch === 360 && f.la_torch_cap === 360 && f.la_have.torch && !f.la_have.lantern, 'a new hedge-priest holds a 360 s torch and has no lantern');
  const a = { la_kit: { fuel: 240 }, la_oil: 180, la_flasks: 0 };
  check(T.migrate(a, 'deserter') === 'torch-build' && a.la_torch === 180 && a.la_oil === null && a.la_flasks === 2 && a.la_light === 'torch' && !a.la_have.lantern,
    'a save from the #63/#64 build: the "oil" was the torch\'s fuel, so it moves to the torch, and Marget\'s two flasks come back');
  const b = { la_kit: { fuel: 240 }, la_oil: 100, la_flasks: 0, la_told_oil: true };
  check(T.migrate(b, 'deserter') === 'lantern-save' && b.la_oil === 100 && b.la_flasks === 0 && b.la_light === 'lantern' && b.la_have.lantern, 'a lantern save that really poured both flasks keeps its lantern, its oil and its empty corner');
  const c = { la_oil: 900, la_flasks: 1 };
  check(T.migrate(c, 'gutter') === 'lantern-save' && c.la_light === 'lantern' && c.la_torch === 90 && c.la_oil === 900, 'an older lantern save keeps the lantern in hand and gets the card\'s torch in the pack');
  check(T.migrate(T.fresh({}, 'deserter'), 'deserter') === 'current', 'a save written by this phase is left alone');
}
// ---- taking and gaining
{
  const f = T.fresh({}, 'deserter');
  check(T.pure.take(f, 'lantern', false) === 'none' && f.la_light === 'torch', 'you cannot take a lantern you do not have');
  check(T.pure.gain(f, 'lantern') === 'gained' && f.la_light === 'lantern' && f.la_have.lantern && T.pure.gain(f, 'lantern') === 'had', 'a lantern found or bought is yours and goes into the hand, once');
  check(T.pure.take(f, 'torch', true) === 'swapped-lit' && f.la_light === 'torch' && T.pure.take(f, 'torch', false) === 'same', 'the pack swaps the two lights; using the one in hand is not a swap');
}
// ---- the pictures
{
  const u = T.paintTorch(-1), f0 = T.paintTorch(0), f1 = T.paintTorch(1), again = T.paintTorch(0);
  check(u.w === 110 && u.h === 200 && f0.w === 110 && !u.emit && f0.emit && f0.emit.some((v) => v), 'the torch in hand is painted in code at the lantern\'s size; lit, its flame is light, unlit it has none');
  check(f0.data.some((v, i) => v !== f1.data[i]) && f0.data.every((v, i) => v === again.data[i]), 'the flame\'s frames differ from each other, and a frame is the same every time it is painted (no dice)');
  const th = T.paintLanternThing();
  check(th.w === 40 && th.h === 64 && th.data.some((v) => v >>> 24), 'the horn lantern on the floor is painted in code');
  check(!/Math\.random/.test(src), 'nothing uses a random number');
}

// ---- in a browser. Skipped when no Playwright.
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = {}, f = () => G.flags, last = () => { const m = document.getElementById('msgs'); return m ? m.innerText.split('\n').filter(Boolean).slice(-1)[0] || '' : ''; };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const frame = () => { performance.now = () => t0; Date.now = () => d0; const a = ANIM.T; render(); ANIM.T = a; render(); const p = R3D.readPixels(); const h = Engine.ctx.getImageData(0, 0, Engine.ctx.canvas.width, Engine.ctx.canvas.height); performance.now = pn; Date.now = dn; ANIM.T = a; return p.data.length + ':' + fnv(p.data) + ':' + fnv(h.data); };
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      try {
        out.row = (() => { try { renderAccessibilityMenu(); const b = document.getElementById('gfx-latorch'); const t = b ? b.textContent : null; closeModal(); G.state = 'play'; return t; } catch (e) { return String(e); } })();
        out.label = (LEDGE1.SWITCHES.find(([k]) => k === 'laTorch') || [])[1];
        out.start = { light: f().la_light, fuel: f().la_torch, lantern: !!f().la_have.lantern, src: LANTERN7.source().id, frac: LANTERN7.frac(), lit: !!UPG.lantern };
        // lit at night on the ledge, against the lantern at the same share of its fill
        loadMap(LEDGE1.LEDGE, { x: 89.5, y: 40.5, dir: Math.PI }); G.state = 'play'; G.day = 2; G.tod = 0.95; G.keys = {};
        LANTERN7.toggle(); out.lightSaid = last();
        const Lt = LIGHTING.lanternLight(); out.torchLight = Lt && { r: Lt.r, c: [Lt.cr, Lt.cg, Lt.cb] };
        f().la_have.lantern = true; f().la_light = 'lantern'; f().la_oil = 1080; const Ll = LIGHTING.lanternLight(); out.lanternLight = Ll && { r: Ll.r };
        f().la_have.lantern = false; f().la_light = 'torch';
        const before = f().la_torch; G.tod = 0.95; advanceTime(10000); out.burnt = before - f().la_torch;
        renderInventory(); out.pack = (document.querySelector('#modal-panel') || document.body).innerText; closeModal(); G.state = 'play';
        out.bar = LANTERN7.frac();
        // the bothy: oil refused, the lantern found
        loadMap(LEDGE1.BOTHY); G.state = 'play'; advanceTime(100);
        const oil = G.ents.find((e) => e.use === 'la_oil'), lamp = G.ents.find((e) => e.use === 'la_lantern');
        useDeco(oil); out.refused = { said: last(), flasks: f().la_flasks };
        out.deco = lamp ? { hidden: !!lamp.hidden, sprite: lamp.sprite } : null;
        const litBefore = !!UPG.lantern; useDeco(lamp);
        out.found = { litBefore, said: last(), light: f().la_light, have: !!f().la_have.lantern, lit: !!UPG.lantern, inv: G.player.inv.map((q) => q.id), hidden: !!lamp.hidden, src: LANTERN7.source().id };
        // the pack swaps the lights; with the torch lit in hand, the flasks fill the lantern
        useItem(G.player.inv.find((q) => q.id === 'torch')); out.toTorch = { light: f().la_light, said: last() };
        useItem(G.player.inv.find((q) => q.id === 'torch')); out.relit = !!UPG.lantern;
        f().la_oil = 200; useDeco(oil); out.fill = { oil: f().la_oil, flasks: f().la_flasks, torchLit: !!UPG.lantern };
        useItem(G.player.inv.find((q) => q.id === 'lantern')); out.toLantern = { light: f().la_light, lit: !!UPG.lantern, said: last() };
        // switched off: Phase 7's frame (the found lantern hidden, the lantern in hand), equal to this phase taken out
        loadMap(LEDGE1.BOTHY); G.state = 'play'; G.tod = 0.95; f().la_have.lantern = false; f().la_light = 'torch'; UPG.lantern = false; LANTERN7.state().prev = false;
        const lampEnt = G.ents.find((e) => e.use === 'la_lantern'); if (lampEnt) lampEnt.hidden = false;
        GFX.laTorch = false; advanceTime(50); frame(); out.offHidden = lampEnt ? !!lampEnt.hidden : null; out.offSrc = LANTERN7.source().id; out.off = frame();
        const was = G.ents.slice(); G.ents = G.ents.filter((e) => e.use !== 'la_lantern'); LANTERN7.setSource(null); out.bare = frame(); G.ents = was; LANTERN7.setSource(TORCH38.source);
        GFX.laTorch = true; advanceTime(50);
        // an old save from the #63/#64 build
        G.flags = { la_bg: 'deserter', la_kit: { bg: 'deserter', fuel: 240 }, la_oil: 150, la_flasks: 0 };
        if (typeof snapshotGame === 'function') { restoreGame(JSON.parse(JSON.stringify(snapshotGame()))); out.save = { light: G.flags.la_light, torch: G.flags.la_torch, oil: G.flags.la_oil, flasks: G.flags.la_flasks, how: TORCH38.state().migrated }; }
        out.err = TORCH38.state().err || LANTERN7.state().err;
      } catch (e) { out.err = String(e && e.stack || e); }
      return out;
    });
    check(!r.err, 'the played script ran to its end' + (r.err ? ': ' + String(r.err).split('\n').slice(0, 3).join(' | ') : ''));
    check(r.row === 'On' && r.label === 'Start with a torch', 'Options has the switch, on: "' + r.label + '"');
    check(r.start.light === 'torch' && r.start.fuel === 240 && !r.start.lantern && r.start.src === 'torch' && r.start.frac === 1 && !r.start.lit, 'Begin: the deserter holds a fresh 240 s torch, unlit, and has no lantern');
    check(/You light the torch\. It is fresh\./.test(r.lightSaid), 'U lights it, in this game\'s words: "' + r.lightSaid + '"');
    check(r.torchLight && r.lanternLight && r.torchLight.r > r.lanternLight.r && r.torchLight.c[0] > r.torchLight.c[2] * 5, 'its pool is bigger than a full lantern\'s (' + (r.torchLight && r.torchLight.r.toFixed(2)) + ' against ' + (r.lanternLight && r.lanternLight.r.toFixed(2)) + ' cells) and warm');
    check(Math.abs(r.burnt - 10) < 0.6, 'ten seconds in ashfall burn ten seconds of pitch: ' + r.burnt.toFixed(2));
    check(/The torch: (fresh|burning well)\./.test(r.pack) && r.bar > 0.9 && r.bar < 1, 'PACK says how the torch is burning, and the HUD\'s third bar is the torch (' + r.bar.toFixed(3) + ')');
    check(/no lantern to fill/.test(r.refused.said) && r.refused.flasks === 2, 'with no lantern, Marget\'s oil is refused and the flasks stay: "' + r.refused.said + '"');
    check(r.deco && !r.deco.hidden && r.deco.sprite === 'la_hornlamp', 'the horn lantern stands in the bothy');
    check(r.found.litBefore && !r.found.lit && r.found.light === 'lantern' && r.found.have && r.found.src === 'lantern' && r.found.hidden && r.found.inv.includes('lantern') && r.found.inv.includes('torch') && /pinch out the torch and take the horn lantern/.test(r.found.said),
      'taking it: the torch is pinched out and goes to the pack, the lantern is in hand and in the pack, and the floor is bare: "' + r.found.said + '"');
    check(r.toTorch.light === 'torch' && /take the torch/.test(r.toTorch.said) && r.relit, 'the pack takes the torch back into the hand, and using it again lights it');
    check(r.fill.oil === 1080 && r.fill.flasks === 1 && r.fill.torchLit, 'with the torch burning in hand, a flask still fills the lantern in the pack');
    check(r.toLantern.light === 'lantern' && !r.toLantern.lit && /douse|pinch/.test(r.toLantern.said), 'and the pack swaps back to the lantern, putting the torch out: "' + r.toLantern.said + '"');
    check(r.offHidden === true && r.offSrc === 'lantern', 'switched off: the lantern is in hand and the found lantern is gone from the floor');
    check(r.off === r.bare, 'switched off, the frame is exactly Phase 7\'s, with this phase taken out (' + r.off + ')');
    if (r.save) check(r.save.how === 'torch-build' && r.save.light === 'torch' && r.save.torch === 150 && r.save.flasks === 2 && r.save.oil == null, 'a save from the #63/#64 build loads with its fuel in the torch and the two flasks back: ' + JSON.stringify(r.save));
    else check(false, 'the save round-trip ran');
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
