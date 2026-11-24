// node test/prologue39.test.js [--no-browser]
// Phase 39, the prologue played through. Nobody had played the prologue's pieces in a row: this test does, in
// headless Chromium, with the inputs a player has. Keys go down through the page's own keyboard (Playwright's
// keyboard, which fires the same keydown and keyup the game listens to) or through G.keys, which is what those
// listeners fill; time goes by advanceTime; buttons are clicked where they are drawn. Nothing below sets a flag the
// game should set for itself. Each beat is checked as it is reached:
//
//    1. Begin, and choose a card (the deserter)                2. the two-second look at the Slagcrown, the errand
//    3. the walk down the ramp to the bothy, the carter behind 4. the door, the bar across and lifted again
//    5. Marget gives you her lantern when you first speak      6. her promise, written in the Account
//    7. her arm, and the carry out at the 0.65 walk            8. the carter told to follow again
//    9. up the ramp: the look back and the title               10. the prologue's end card, with the run's numbers
//
// The no-browser half checks the end card's rule (js/prologue39.js) and the source rules.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const P = require(path.join(ROOT, 'js', 'prologue39.js'));

// ---------------------------------------------------------------- the rule, without a browser
{
  const f = { la_bg: 'deserter', la_light: 'lantern', la_oil: 900, la_torch: 210, la_torch_cap: 240, la_flasks: 2, la_have: { torch: true, lantern: true },
    la_company: { people: [{ id: 'you', name: 'The deserter', alive: true }, { id: 'carter', name: 'The carter', alive: true }] }, la_carter: { mode: 'follow' }, la_marget_out: true, la_carry: { on: true } };
  const n = P.numbers(f, { day: 1, startDay: 1, name: 'The deserter' });
  check(n.days === 1, 'the first day counts as one day on the road: ' + n.days);
  check(n.oil === 900 && n.oilCap === 1080 && n.torch === 210 && n.torchCap === 240, 'oil and pitch are read from the flags as they are: ' + JSON.stringify([n.oil, n.oilCap, n.torch, n.torchCap]));
  check(n.lived.join('|') === 'The deserter|The carter|Marget Sayle', 'who lived: you, the carter and Marget Sayle: ' + n.lived.join(', '));
  check(n.dead.length === 0, 'nobody died');
  const g = JSON.parse(JSON.stringify(f));
  g.la_company.people[1].alive = false; g.la_carter.mode = 'dead'; g.la_have.lantern = false; g.la_light = 'torch'; g.la_oil = null; g.la_torch = 0;
  const m = P.numbers(g, { day: 3, startDay: 1, name: 'The deserter' });
  check(m.days === 3 && m.lived.join('|') === 'The deserter|Marget Sayle' && m.dead.join('|') === 'The carter', 'a dead carter is named with the dead, and two days later is three days: ' + JSON.stringify(m));
  check(m.oil == null && m.torch === 0, 'no lantern means no oil line, and a spent torch is nought');
  const L = P.lines(n);
  check(L.every((s) => !/[^\x20-\x7e]/.test(s)), 'every line of the card is plain ASCII');
  check(L.some((s) => /1 day/.test(s)) && L.some((s) => /oil/i.test(s)) && L.some((s) => /torch/i.test(s)) && L.some((s) => /The carter/.test(s)), 'the card gives the days, the oil, the torch and who lived: ' + L.join(' / '));
  check(P.lines(m).some((s) => /3 days/.test(s)) && P.lines(m).some((s) => /The carter/.test(s) && /dead|died|roll/i.test(s)), 'and a dead carter is written as dead');
  check(P.numbers(null, {}).lived.length === 1 && P.numbers({}, {}).days === 1, 'empty flags give one traveller and one day, not an error');
  const src = fs.readFileSync(path.join(ROOT, 'js', 'prologue39.js'), 'utf8');
  check(!/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'js/prologue39.js is plain ASCII');
  check(!/Math\.random/.test(src), 'and uses no random number');
  check(!src.split('\n').some((l) => /[;{})]\s*\/\/ /.test(l) && !/^\s*\/\//.test(l) && !/'[^']*\/\/[^']*'/.test(l)), 'no comment sits after code on the same line');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check(/js\/prologue39\.js\?v=\d+/.test(html), 'the page loads js/prologue39.js');
}

// ---------------------------------------------------------------- the run, in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  const page = s.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    // The live loop runs on the page's own clock; for a run that is the same every time, the frames are ours
    // (test/harness.js, autopilot: it presses W and the arrow keys as a player would, one frame at a time).
    await HN.autopilot(page);
    const press = async (k) => { await page.keyboard.down(k); await ev(() => advanceTime(50)); await page.keyboard.up(k); await ev(() => advanceTime(50)); };
    const click = async (sel) => { const n = await page.locator(sel).count(); if (!n) return false; await page.locator(sel).first().dispatchEvent('click'); return true; };
    const where = () => ev(() => __P39.where());
    const fail = async (label) => { console.log('   at ' + JSON.stringify(await where())); return label; };

    // ---- 1. Begin, and choose a card
    await click('#btn-new');
    await page.waitForFunction(() => !!document.querySelector('#la-who'), null, { timeout: 20000 });
    const cards = await ev(() => Array.from(document.querySelectorAll('#la-who [data-bg]')).map((b) => b.dataset.bg));
    check(cards.length === 8, 'Begin asks who walks north, with eight cards: ' + cards.join(', '));
    await click('#la-who [data-bg="deserter"]');
    await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
    if (await ev(() => G.state === 'intro')) await click('#btn-intro-skip');
    await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
    await ev(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); render(); render(); });
    const b1 = await ev(() => ({ bg: G.flags.la_bg, name: G.player.name, map: G.mapId, light: G.flags.la_light, torch: G.flags.la_torch, looked: !!G.flags.la_looked, journal: G.journal.length, r3d: typeof R3D !== 'undefined' && R3D.active && R3D.active() }));
    check(b1.bg === 'deserter' && b1.name === 'The deserter' && b1.map === 'la_ledge', 'the deserter stands on the ledge: ' + JSON.stringify(b1));
    check(b1.light === 'torch' && b1.torch === 240, 'with a fresh torch in hand (Phase 38)');
    check(!b1.looked && b1.journal === 0, 'and no errand yet');

    // ---- 2. the two-second look
    const b2 = await ev(() => {
      const c = Engine.cam, out = { dir: c.dir };
      advanceTime(1000); out.early = !!G.flags.la_looked;
      advanceTime(1200); out.looked = !!G.flags.la_looked; out.journal = G.journal.map((j) => j.text);
      return out;
    });
    check(!b2.early && b2.looked && b2.journal.length === 1, 'looking west at the Slagcrown for two seconds gives the errand: "' + (b2.journal[0] || '') + '"');

    // A walks left. (Phase 39 found the Account's key on A, swallowing it: the walk could not strafe left.)
    await page.keyboard.down('a');
    const strafe = await ev(() => { const c = Engine.cam, x = c.x, y = c.y; advanceTime(500); return { d: Math.hypot(c.x - x, c.y - y), dy: c.y - y, panel: G.openPanel }; });
    await page.keyboard.up('a');
    await ev(() => advanceTime(200));
    check(strafe.d > 0.4 && strafe.dy > 0 && !strafe.panel, 'A walks left (facing west, that is south): ' + JSON.stringify(strafe));

    // ---- 3. the walk down to the bothy, the carter behind
    const w1 = await ev(() => __P39.walkTo(87, 41, 0.35));
    const carterTop = await ev(() => ({ s: Object.assign({}, CARTER13.state()), c: __P39.where() }));
    const w2 = await ev(() => __P39.walkTo(87, 34.2, 0.3));
    const w3 = await ev(() => __P39.walkTo(87, 32.2, 0.3));
    const w4 = await ev(() => __P39.walkTo(83.5, 30.8, 0.25));
    await ev(() => advanceTime(1200));
    const b3 = await ev(() => ({ hp: G.player.hp, hpMax: G.player.hpMax, bloom: BLOOM4.state().state, carter: Object.assign({}, CARTER13.state()), c: __P39.where() }));
    check(w1.ok && w2.ok && w3.ok && w4.ok, 'walked from the ledge to the top of the ramp, down it, and along the shelf to the door: ' + JSON.stringify([w1, w2, w3, w4].map((w) => [w.ok, +w.x.toFixed(2), +w.y.toFixed(2), +w.t.toFixed(1), w.why || ''])));
    const cd = Math.hypot(b3.carter.x - b3.c.x, b3.carter.y - b3.c.y);
    check(b3.carter.mode === 'follow' && cd < 2, 'the carter followed, and stands ' + cd.toFixed(2) + ' cells behind (mode ' + b3.carter.mode + ')');
    check(b3.hp === b3.hpMax && b3.bloom === 'post', 'nothing hurt us on the way down, and the bloom stood at its post: ' + b3.hp + '/' + b3.hpMax + ', ' + b3.bloom);

    // ---- 4. the door and its bar
    await ev(() => __P39.face(-Math.PI / 2));
    await press('e');
    const b4a = await ev(() => ({ c: __P39.where(), carter: Object.assign({}, CARTER13.state()), msgs: __P39.msgs() }));
    check(b4a.c.map === 'la_bothy', 'E at the door goes in: ' + JSON.stringify(b4a.c));
    check(b4a.carter.mode === 'hold' && Math.abs(b4a.carter.x - 83.5) < 0.01, 'the carter waits outside: ' + b4a.carter.mode);
    await ev(() => advanceTime(300));
    check(/Put the bar across/.test(await ev(() => __P39.msgs())), 'Marget tells you to put the bar across');
    // the bar leans at the door's right: turn to it and use it
    await ev(() => __P39.faceTo(4.62, 4.5));
    await press('e');
    const b4b = await ev(() => ({ barred: !!G.flags.la_barred, c: __P39.where() }));
    check(b4b.barred, 'E at the bar drops it across the door: ' + JSON.stringify(b4b));

    // ---- 5. Marget gives you her lantern
    const w5 = await ev(() => __P39.walkTo(2.9, 2.9, 0.3));
    await ev(() => __P39.faceTo(2.6, 1.9));
    await press('e');
    const b5 = await ev(() => ({ panel: G.openPanel, state: G.state, light: G.flags.la_light, have: G.flags.la_have, inv: G.player.inv.map((q) => q.id), log: (document.getElementById('dlg-log') || {}).innerText || '', msgs: __P39.msgs() }));
    check(b5.panel === 'dialogue', 'E speaks to Marget Sayle: ' + JSON.stringify({ walk: w5, panel: b5.panel, state: b5.state }));
    check(b5.light === 'lantern' && b5.have && b5.have.lantern && b5.inv.includes('lantern') && b5.inv.includes('torch'), 'the first time, she gives you her lantern; the torch goes to the pack: ' + JSON.stringify({ light: b5.light, inv: b5.inv }));

    // ---- 6. her promise and the Account
    await click('#d-tell');
    const topics = await ev(() => Array.from(document.querySelectorAll('[data-topic]')).map((b) => b.dataset.topic));
    check(topics.includes('The south'), 'she can be asked about the south: ' + topics.join(', '));
    await click('[data-topic="The south"]');
    const hasAnswer = await ev(() => !!document.getElementById('d-answer'));
    check(hasAnswer, 'and after she has told of it, there is something to answer');
    await click('#d-answer');
    const choices = await ev(() => Array.from(document.querySelectorAll('[data-choice]')).map((b) => b.textContent));
    check(choices.length >= 1, 'she asks for a promise: ' + choices.join(' / '));
    await click('[data-choice="0"]');
    const b6 = await ev(() => ({ promise: !!G.flags.la_marget_promise, acct: (G.flags.la_account && G.flags.la_account.entries || []).filter((e) => e.kind === 'promise').map((e) => [e.text, e.person]) }));
    check(b6.promise && b6.acct.length === 1 && b6.acct[0][1] === 'The deserter', 'the promise is the first entry in the Account, with a name on it: ' + JSON.stringify(b6.acct));
    await click('#d-bye');
    // the Account opens with X, shows the promise, and Escape closes it
    await press('x');
    const acct = await ev(() => ({ panel: G.openPanel, state: G.state, text: (document.getElementById('modal') || {}).innerText || '' }));
    await press('Escape');
    const acct2 = await ev(() => ({ panel: G.openPanel, state: G.state }));
    check(acct.panel === 'account' && /Bring Marget Sayle/.test(acct.text) && acct.state === 'play', 'X opens the Account over the world, and the promise is in it: ' + JSON.stringify({ panel: acct.panel, state: acct.state }));
    check(!acct2.panel && acct2.state === 'play', 'Escape closes it again: ' + JSON.stringify(acct2));

    // ---- 7. her arm, and the carry
    await press('e');
    const b7a = await ev(() => ({ state: G.state, text: (document.getElementById('event-panel') || {}).innerText || '' }));
    check(/Take her arm/.test(b7a.text), 'speaking to her again, she offers her arm: ' + JSON.stringify(b7a.text.slice(0, 80)));
    await click('#event-panel button[data-i="0"]');
    const b7b = await ev(() => ({ on: CARRY15.state().on, pace: CARRY15.pace(CARRY15.state()) }));
    check(b7b.on && Math.abs(b7b.pace - 0.65) < 1e-9, 'she takes your arm: both hands full, 0.65 of a walk');
    // to the door; the bar is across, so the first E lifts it and the next goes out
    const w7 = await ev(() => __P39.walkTo(3.5, 4.2, 0.25));
    await ev(() => __P39.face(Math.PI / 2));
    await press('e');
    const b7c = await ev(() => ({ barred: !!G.flags.la_barred, c: __P39.where(), on: CARRY15.state().on }));
    check(!b7c.barred && b7c.c.map === 'la_bothy' && b7c.on, 'at the door, E lifts the bar first, and she is still on your arm: ' + JSON.stringify({ walk: w7, b7c }));
    await press('e');
    const b7d = await ev(() => { const m = G.ents.find((e) => e.id === 'la_marget'); return { c: __P39.where(), on: CARRY15.state().on, marget: m && { x: m.x, y: m.y, hidden: !!m.hidden } }; });
    check(b7d.c.map === 'la_ledge' && b7d.on && b7d.marget && !b7d.marget.hidden, 'and the next takes you both out onto the shelf: ' + JSON.stringify(b7d));
    const md0 = b7d.marget ? Math.hypot(b7d.marget.x - b7d.c.x, b7d.marget.y - b7d.c.y) : 99;
    check(md0 < 1.6, 'out of the door, she is at your side, not where she stood inside: ' + md0.toFixed(2) + ' cells');

    // ---- 8. the carter, told to follow again
    await ev(() => __P39.faceTo(CARTER13.state().x, CARTER13.state().y));
    await press('e');
    const b8a = await ev(() => ({ panel: G.openPanel, on: CARRY15.state().on, choices: Array.from(document.querySelectorAll('[data-choice]')).map((b) => b.textContent) }));
    check(b8a.panel === 'dialogue' && b8a.on, 'E at the carter speaks to him and does not let go of Marget: ' + JSON.stringify(b8a));
    if (b8a.panel === 'dialogue') {
      const i = b8a.choices.findIndex((t) => /Follow/.test(t));
      await click('[data-choice="' + i + '"]');
      await click('#d-bye');
    }
    const b8b = await ev(() => CARTER13.state().mode);
    check(b8b === 'follow', 'Follow me: he falls in behind again: ' + b8b);

    // ---- 9. the carry up the ramp; the look back and the title at the top
    const t0 = await ev(() => G.time);
    const w9a = await ev(() => __P39.walkTo(86.9, 32.4, 0.3));
    const w9b = await ev(() => __P39.walkTo(87, 36, 0.3));
    const b9mid = await ev(() => ({ title: !!G.flags.la_title_seen, c: __P39.where() }));
    const w9c = await ev(() => __P39.walkTo(87, 40.6, 0.35));
    const b9 = await ev(() => { const m = G.ents.find((e) => e.id === 'la_marget'), c = Engine.cam; return { title: !!G.flags.la_title_seen, panel: G.openPanel, state: G.state, c: __P39.where(), hp: G.player.hp, hpMax: G.player.hpMax, bloom: BLOOM4.state().state, md: m ? Math.hypot(m.x - c.x, m.y - c.y) : null, carter: Object.assign({}, CARTER13.state()), modal: (document.getElementById('modal') || {}).innerText || '' }; });
    console.log('   the carry: ' + JSON.stringify({ w9a, w9b, w9c, mid: b9mid }));
    check(w9a.ok && w9b.ok && (w9c.ok || b9.panel === 'la-title'), 'carried her from the door to the ramp and up it');
    check(!b9mid.title, 'the title waits for the top: half way up the ramp it has not come');
    check(b9.title && b9.panel === 'la-title' && /THE LONG ACCOUNT/.test(b9.modal), 'at the top, with her, THE LONG ACCOUNT comes up: ' + JSON.stringify({ title: b9.title, panel: b9.panel, at: b9.c }));
    check(b9.md != null && b9.md < 1.6, 'she is at your side the whole way: ' + (b9.md && b9.md.toFixed(2)) + ' cells');
    check(b9.hp > 0, 'we lived through the carry: ' + b9.hp + '/' + b9.hpMax + ' (the bloom ' + b9.bloom + ')');
    // the title runs its three seconds
    const b9t = await ev(async () => { await new Promise((r) => setTimeout(r, 3300)); advanceTime(100); return { panel: G.openPanel, state: G.state }; });

    // ---- 10. the end card
    const b10 = await ev(async () => {
      for (let i = 0; i < 40 && G.openPanel !== 'la-prologue-end'; i++) { await new Promise((r) => setTimeout(r, 100)); advanceTime(50); }
      return { panel: G.openPanel, state: G.state, text: (document.getElementById('modal') || {}).innerText || '' };
    });
    check(b10.panel === 'la-prologue-end', 'after the title, the prologue\'s end card: ' + JSON.stringify({ title: b9t, end: b10.panel }));
    check(/day/i.test(b10.text) && /oil/i.test(b10.text) && /torch/i.test(b10.text) && /Marget Sayle/.test(b10.text) && /The carter/.test(b10.text), 'it gives the run\'s numbers: ' + b10.text.replace(/\s+/g, ' ').slice(0, 300));
    await click('#la-walk-on');
    const b10b = await ev(() => { advanceTime(100); return { panel: G.openPanel, state: G.state, end: !!G.flags.la_prologue_end, shown: PROLOGUE39.state().shown, map: G.mapId, carry: CARRY15.state().on }; });
    check(!b10b.panel && b10b.state === 'play' && b10b.end && b10b.shown === 1, 'Walk on closes it, and play goes on: ' + JSON.stringify(b10b));
    // Phase 40: Walk on takes the company down from the ledge, Marget still on your arm; walking up the cleft in the crag
    // brings you back onto the ledge, where the rest of this test carries on
    check(b10b.map === 'la_z1_2_0' && b10b.carry, 'Walk on takes you down to the ledge path, with her on your arm (Phase 40): ' + b10b.map);
    const up = await ev(() => {
      const c = Engine.cam, t = THRESH40.thresholds().find((q) => q.id === 'ledge-up'), to = { x: t.door.x, y: t.door.y - 1.2 };
      const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
      for (let i = 0; i < 60 * 30 && G.mapId === 'la_z1_2_0'; i++) {
        const diff = norm(Math.atan2(to.y - c.y, to.x - c.x) - c.dir);
        G.keys = { w: Math.abs(diff) < 0.5, arrowleft: diff < -0.06, arrowright: diff > 0.06 };
        update(1 / 60);
      }
      G.keys = {}; for (let i = 0; i < 20; i++) update(1 / 60);
      return { map: G.mapId, x: +c.x.toFixed(1), y: +c.y.toFixed(1), carry: CARRY15.state().on };
    });
    check(up.map === 'la_ledge' && up.carry, 'and up the cleft in the crag you are back on the ledge with her: ' + JSON.stringify(up));
    // what happens next is not checked, only told: the bloom heard the carry, and it is invulnerable in the prologue
    const after = await ev(() => { const w = __P39.walkTo(84, 50, 0.4, 12000); return { w: [w.ok, +w.x.toFixed(1), +w.y.toFixed(1), w.why || ''], hp: G.player.hp, bloom: BLOOM4.state().state, carry: CARRY15.state().on, card: PROLOGUE39.state().shown }; });
    console.log('   after the card, carrying her west for up to 12 s: ' + JSON.stringify(after));
    check(after.card === 1, 'the card comes once');

    // Turning round on the ramp with her on your arm (the clip's run found the pair locked there: she was left a step
    // below on the slope, then put where you stood, and neither could move). The bloom is held still for this one check,
    // so that only the carry is tested; it is the one place this test sets anything. Since Phase 40 it has followed the
    // company down through the ledge's gap and may be on its way back, in the road: it is held in the bothy, out of it.
    const ramp = await ev(() => {
      BLOOM4.pose({ map: LEDGE1.BOTHY, x: 3.5, y: 2.5, state: 'wait' });
      const out = { go: [] };
      const near = () => { const m = G.ents.find((e) => e.id === 'la_marget'), c = Engine.cam; return m ? +Math.hypot(m.x - c.x, m.y - c.y).toFixed(2) : 99; };
      for (const [x, y] of [[87, 40.6], [87, 36.4]]) { const w = __P39.walkTo(x, y, 0.35, 15000); out.go.push([w.ok, +w.x.toFixed(2), +w.y.toFixed(2), w.why || '']); }
      __P39.face(-Math.PI / 2); out.down = near();
      __P39.face(Math.PI / 2 + 0.6); __P39.face(Math.PI / 2); out.back = near();
      const w = __P39.walkTo(87, 40.6, 0.35, 15000); out.up = [w.ok, +w.x.toFixed(2), +w.y.toFixed(2), w.why || '']; out.top = near();
      out.carry = CARRY15.state().on;
      BLOOM4.state().held = false;
      return out;
    });
    check(ramp.go.every((g) => g[0]) && ramp.up[0] && ramp.carry, 'carrying her, you can turn round on the ramp and still walk up it: ' + JSON.stringify(ramp));
    check(ramp.down < 1.6 && ramp.back < 1.6 && ramp.top < 1.6, 'and she stays at your side through the turn: ' + [ramp.down, ramp.back, ramp.top].join(', ') + ' cells');

    // the switch: an Options row; off, no card; the frame is the same on and off (the card is a page, not a picture)
    const sw = await ev(() => {
      const out = {};
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const frame = () => { performance.now = () => t0; Date.now = () => d0; const a = ANIM.T; render(); ANIM.T = a; render(); const p = R3D.readPixels(); const h = Engine.ctx.getImageData(0, 0, Engine.ctx.canvas.width, Engine.ctx.canvas.height); performance.now = pn; Date.now = dn; ANIM.T = a; return p.data.length + ':' + fnv(p.data) + ':' + fnv(h.data); };
      try { renderAccessibilityMenu(); const b = document.getElementById('gfx-laprologueend'); out.row = b ? b.textContent : null; closeModal(); G.state = 'play'; } catch (e) { out.row = String(e); }
      G.keys = {}; G.flags.la_prologue_end = true;
      GFX.laPrologueEnd = true; frame(); out.on = frame();
      GFX.laPrologueEnd = false; frame(); out.off = frame();
      G.flags.la_prologue_end = false; advanceTime(200); out.offCard = G.openPanel;
      GFX.laPrologueEnd = true; advanceTime(50); out.onCard = G.openPanel; closeModal(); G.state = 'play';
      out.err = PROLOGUE39.state().err;
      return out;
    });
    check(sw.row === 'On', 'Options has the switch "The prologue\'s end", on');
    check(sw.on === sw.off, 'the frame is the same with it on and off: ' + sw.on);
    check(sw.offCard !== 'la-prologue-end' && sw.onCard === 'la-prologue-end', 'off, the title is the end; on, the card comes: ' + JSON.stringify([sw.offCard, sw.onCard]));
    check(!sw.err, 'the wire ran without an error' + (sw.err ? ': ' + sw.err : ''));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
