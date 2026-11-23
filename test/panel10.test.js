// node test/panel10.test.js               (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/panel10.test.js        with Playwright installed globally
// Phase 10, this game's panel words, credits and creation. Without a browser: the eight backgrounds are the lore's eight,
// each walk of life quoted word for word from godot-people.md, each knack and flaw from its card, and the health and the
// soft feet the cards give in numbers; the panel's buttons are this game's words and fit their boxes; the HUD's line says
// salt, not the Octave's sovereigns; nothing this phase writes uses the Octave's words. In a browser: Begin asks who
// walks north, the choice takes, and every button, key and panel, and the credits, say this game.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const P10 = require(path.join(ROOT, 'js', 'panel10.js'));
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const src = fs.readFileSync(path.join(ROOT, 'js', 'panel10.js'), 'utf8');
const people = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'godot-people.md'), 'utf8');
const canon = fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'CANON.md'), 'utf8');
const plain = (s) => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const P = plain(people);

// ---- the eight, as the lore has them
const B = P10.BACKGROUNDS, names = B.map((b) => b.name);
check(B.length === 8 && ['Watch Deserter', 'Cinder Factor', 'Chapel Cleaner', 'Peat-cutter', 'Gutter-kin', 'Hedge-priest', 'Fen Healer', 'Causeway Carter'].every((n) => names.includes(n)), 'the eight backgrounds are the lore\'s eight: ' + names.join(', '));
check(/eight backgrounds[\s\S]{0,40}walks of life/.test(canon) && /carry over unchanged/.test(fs.readFileSync(path.join(ROOT, 'docs', 'worldbuilding', 'the-round-and-the-long-account.md'), 'utf8')), 'the canon sheet and the design both say they carry over');
for (const b of B) {
  const sec = P.slice(P.indexOf('### ' + b.name), P.indexOf('###', P.indexOf('### ' + b.name) + 4));
  check(sec.includes(plain(b.life).replace(/^Proposed origin for the name: /, '')), b.name + ': its walk of life is quoted word for word from godot-people.md');
  check(sec.includes(b.knack.name + ' (') && sec.includes(b.flaw.name + ' (') && sec.includes(plain(b.kit)), b.name + ': knack (' + b.knack.name + '), flaw (' + b.flaw.name + ') and kit are its card\'s');
}
const hp = (id) => P10.byId(id).hp;
check(hp('deserter') === 0.9 && /Old wound \(90 health\)/.test(P) && hp('gutter') === 0.75 && /Frail \(75 health/.test(P) && hp('carter') === 1.2 && /Hardy \(120 health/.test(P), 'health from the cards, on their 100: the deserter 90, the gutter-kin 75, the carter 120');
check(B.filter((b) => !['deserter', 'gutter', 'carter'].includes(b.id)).every((b) => b.hp === 1), 'every other background keeps its health');
const healthOn = (b) => { const m = /(\d+) health/.exec(b.knack.what + ' ' + b.flaw.what); return m ? +m[1] : 100; };
check(B.every((b) => healthOn(b) === Math.round(100 * b.hp)), 'the figure each card names is the health the game gives it, not a share of the engine\'s: ' + B.map((b) => b.name + ' ' + healthOn(b)).join(', '));
check(P10.byId('gutter').step === -0.8 && /steps carry a third less/.test(P), 'the gutter-kin\'s soft feet: a third less, which is 0.8 of a walk\'s 2.4 (the engine\'s floor for quiet feet)');
check(P10.byId('cleaner').step < 0 && P10.byId('cleaner').step > -0.8 && /quieter steps/.test(P) && /\[PROPOSED\][^\n]*quieter steps|quieter steps[^\n]*\[PROPOSED\]/.test(src), 'the chapel cleaner\'s quieter steps: the card gives no number, so the number is marked [PROPOSED]');
check(P10.DEFAULT === 'deserter' && P10.byId('deserter').call === 'The deserter', 'by default you walk north as the deserter, as the default pair has it (P20)');
check(new Set(B.map((b) => b.call)).size === 8 && B.every((b) => /^The [a-z-]+( [a-z-]+)?$/.test(b.call)), 'each has its own name for the HUD: ' + B.map((b) => b.call).join(', '));

// ---- the panel's words
const btn = P10.BUTTONS, labels = btn.map((b) => b.t);
check(['YOU', 'PACK', 'BOOK', 'MAP', 'REST', 'FOLK', 'HELP', 'SAVE', 'LAMP', 'WEAPON'].every((t) => labels.includes(t)) && btn.length === 10, 'the buttons: ' + labels.join(' '));
check(!labels.some((t) => /SONG|MURMUR|NAMES|CHAR|INV|LOG/.test(t)), 'none of the Octave\'s: no SONG, MURMUR, NAMES, CHAR, INV or LOG');
check(btn.every((b) => b.t.length * 4.8 <= b.w), 'every word fits its box (the engine\'s NAMES needed 24, MURMUR 36)');
check(btn.every((b) => b.x >= 48 && b.x + b.w <= 150 && [155, 168, 181].includes(b.y) && b.h === 11), 'and every box sits where the engine\'s panel draws its buttons');
const overlap = btn.some((a, i) => btn.some((b, j) => j > i && a.y === b.y && a.x < b.x + b.w && b.x < a.x + a.w));
check(!overlap, 'no two boxes overlap');
check(P10.hudText('The deserter · Lv 1 · 12 sov.') === 'The deserter · 12 salt' && P10.hudText('The carrier · Lv 3 · 0 sov.') === 'The carrier · no salt', 'the HUD\'s line counts salt, the fen\'s money, not the Octave\'s sovereigns or levels');
check(P10.hudText('fragments 2') === null && P10.hudText('ROOT NOTE') === null && P10.hudText('REED') === null, 'and its Octave lines (fragments, song effects) are not drawn');
check(P10.hudText('The highland edge · ashfall') === 'The highland edge · ashfall', 'everything else draws as it was');
const T = P10.texts();
const OCTAVE = /Quarry|\bHz\b|sovereign|\bsov\b|Oakhaven|Synod|Carillon|\bHush\b|Cacophony|\bsongs?\b|\bSR\b|\bVoice\b|\blevel\b|\bLv\b|Legionnaire|pickpocket|disguise|Aethelgard|Murmur/i;
check(T.length > 30 && !T.some((s) => OCTAVE.test(s)), 'nothing this phase writes uses the Octave\'s words (' + T.length + ' lines checked)' + (T.find((s) => OCTAVE.test(s)) ? ': ' + T.find((s) => OCTAVE.test(s)) : ''));
check(T.every((s) => !/[^\x09\x0a\x0d\x20-\x7e]/.test(s.replace(/·/g, ''))), 'and all of it is plain ASCII (the HUD\'s middle dot aside, which the engine already draws)');
{ const fs = require('fs'), pth = require('path'), md = fs.readFileSync(pth.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
  const named = [...md.matchAll(/(js\/[a-z]+\d+\.js) +Phase \d+/g)].map((m) => m[1]).sort();
  check(named.length >= 11 && named.join(' ') === P10.PHASE_FILES.slice().sort().join(' ') && P10.PHASE_FILES.every((f) => fs.existsSync(pth.join(__dirname, '..', f))) && /but for this repository/.test(P10.CREDITS[0].rows[0][0]),
    'the credits name every phase file CLAUDE.md lists as this repository\'s own, not the engine\'s: ' + P10.PHASE_FILES.join(' ')); }
check(P10.CREDITS.every((s) => s.rows.every((r) => !/Kokoro|Canva|DreamShaper|music\/|voices\/|39 images|js\/assets\.js\. Origin/.test(r.join(' ')))) && P10.CREDITS.some((s) => s.rows.some((r) => /js\/art2\.js/.test(r.join(' ')))), 'the in-game credits are this repository\'s, as CREDITS.md has them: no Octave music, voices or paintings');
check(!/Math\.random/.test(src), 'nothing in it uses a random number');

// ---- in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    // Begin asks who walks north
    await s.page.evaluate(() => { const b = document.querySelector('#btn-new'); b.click(); });
    await s.page.waitForTimeout(300);
    const who = await s.page.evaluate(() => ({ open: !!document.querySelector('#la-who'), cards: document.querySelectorAll('#la-who [data-bg]').length, text: (document.querySelector('#modal-panel') || {}).innerText || '' }));
    check(who.open && who.cards === 8, 'PLAYED: Begin asks who walks north, with the eight to choose from');
    check(/Gytha Marrin/.test(who.text) && !/Quarry|Hz|class/i.test(who.text), 'in this game\'s words');
    await s.page.evaluate(() => document.querySelector('#la-who [data-bg="gutter"]').click());
    await s.page.waitForTimeout(400);
    await s.page.evaluate(() => { const b = document.querySelector('#btn-intro-skip'); if (b) b.click(); });
    await s.page.waitForFunction(() => typeof G !== 'undefined' && G.state === 'play', null, { timeout: 20000 });
    const r = await s.page.evaluate(() => {
      const out = { err: null }; const p = G.player;
      try {
        out.bg = G.flags.la_bg; out.name = p.name; out.hp = [p.hp, p.hpMax, PANEL10.state().baseHp]; out.an = [armorNoise(), PANEL10.ORIG.armorNoise()];
        out.btns = HUD_BTNS.map((b) => b.t);
        const open = (f) => { G.state = 'panel'; f(); const t = document.querySelector('#modal-panel').innerText; closeModal(); G.state = 'play'; return t; };
        out.panels = {};
        for (const b of HUD_BTNS) if (!['LAMP', 'WEAPON', 'SAVE', 'MAP', 'REST'].includes(b.t)) { G.state = 'play'; b.f(); out.panels[b.t] = document.querySelector('#modal-panel').innerText; closeModal(); G.state = 'play'; }
        out.keys = {};
        out.shut = {};
        const press = (k) => { const key = k === 'tab' ? 'Tab' : k; window.dispatchEvent(new KeyboardEvent('keydown', { key })); window.dispatchEvent(new KeyboardEvent('keyup', { key })); };
        for (const k of ['c', 'i', 'l', 'k', 'h', 'tab']) {
          G.state = 'play'; press(k); out.keys[k] = G.openPanel;
          press(k); out.shut[k] = G.state === 'play' && !G.openPanel;   // the same key again closes it, as in the engine
          if (G.state !== 'play') { closeModal(); G.state = 'play'; }
        }
        // N, once the Murmur, and the LAMP button light the lantern; F1 sings nothing
        G.flags.la_oil = 600; UPG.lantern = false; LANTERN7.state().prev = false;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'n' })); out.lampN = UPG.lantern;
        HUD_BTNS.find((b) => b.t === 'LAMP').f(); out.lampBtn = UPG.lantern;
        const v0 = p.voice; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'F1' })); out.f1 = { voice: [v0, p.voice], murmur: G.murmurT || 0 };
        // the HUD as drawn: its words, and the third bar is your lantern's oil in tallow
        UPG.lantern = true; G.flags.la_oil = 120; render(); out.hud = PANEL10.state().hud.slice(); out.bar = PANEL10.state().bar;
        // the credits
        renderAccessibilityMenu(); VOICES.renderFullCredits(); out.credits = document.querySelector('#modal-panel').innerText; closeModal(); G.state = 'play';
        // saved and loaded, the choice stays
        out.saved = JSON.parse(JSON.stringify(G.flags)).la_bg;
        // the card's figure, the player's health and the YOU panel: one number
        out.hpAll = ['deserter', 'gutter', 'carter'].map((id) => {
          PANEL10.choose(id);
          const t = open(renderCharacter);
          return { id, hp: G.player.hp, hpMax: G.player.hpMax, you: (t.match(/Health \d+ \/ \d+/) || [''])[0] };
        });
        PANEL10.choose('gutter');
        // an old save stored the card's health as the engine's 43-scale share (the carter's 120 as 52, the deserter's
        // 90 as 39). Loading one must bring the card, the player and the YOU panel back to one figure, and so the HUD's
        // health bar (drawn from p.hp / p.hpMax) back to full.
        const oldSave = (id, was, left) => {
          PANEL10.choose(id);
          const d = JSON.parse(JSON.stringify(snapshotGame()));
          d.player.hpMax = was; d.player.hp = left;
          return d;
        };
        const youLine = () => (open(renderCharacter).match(/Health \d+ \/ \d+/) || [''])[0];
        restoreGame(oldSave('carter', 52, 52));
        out.old = { hp: G.player.hp, hpMax: G.player.hpMax, you: youLine(), bar: G.player.hp / G.player.hpMax };
        restoreGame(oldSave('deserter', 39, 13));
        out.oldHurt = { hp: G.player.hp, hpMax: G.player.hpMax, you: youLine(), bar: G.player.hp / G.player.hpMax };
        PANEL10.choose('gutter');
        // co-op: the guest's chosen walk of life travels as an id; the host gives the partner that card's health
        const clone = () => JSON.parse(JSON.stringify(G.player));
        const cLive = PARTNER19.guest.card();
        const cSave = PARTNER19.guest.card({ player: clone(), flags: { la_bg: 'carter' } });
        const j1 = PARTNER19.join(cSave);
        out.coop = { live: cLive && cLive.laBg, save: cSave && cSave.laBg, ok: !!(j1 && j1.ok), hpMax: PARTNER19.S && PARTNER19.S.pp ? PARTNER19.S.pp.hpMax : 0, snap: (PARTNER19.snapshot() || {}).hpMax || 0 };
        try { PARTNER19.leave('silent'); } catch (e) { /* the test's join only */ }
        const cNone = PARTNER19.guest.card({ player: clone(), flags: {} });
        const j2 = PARTNER19.join(cNone);
        out.coop.none = { bg: cNone && cNone.laBg, ok: !!(j2 && j2.ok), hpMax: PARTNER19.S && PARTNER19.S.pp ? PARTNER19.S.pp.hpMax : 0 };
        try { PARTNER19.leave('silent'); } catch (e) { /* the test's join only */ }
      } catch (e) { out.err = String(e && e.stack || e); }
      return out;
    });
    check(r.bg === 'gutter' && r.name === 'The waif', 'the choice takes: you walk as the gutter-kin, called ' + r.name);
    check(r.coop && r.coop.live === 'gutter' && r.coop.save === 'carter' && r.coop.ok && r.coop.hpMax === 120 && r.coop.snap === 120 && r.coop.none.bg === 'deserter' && r.coop.none.ok && r.coop.none.hpMax === 90, 'co-op: the guest brings the walk of life they chose, and the host gives the partner that card\'s health (live ' + (r.coop && r.coop.live) + '; save ' + (r.coop && r.coop.save) + ' at ' + (r.coop && r.coop.hpMax) + '; no card ' + (r.coop && r.coop.none.bg) + ' at ' + (r.coop && r.coop.none.hpMax) + ')');
    check(r.hp[1] === 75 && r.hp[0] === 75, 'with the gutter-kin\'s 75 health, the card\'s figure (the engine\'s base was ' + r.hp[2] + ')');
    check(r.hpAll.map((x) => x.hpMax).join(',') === '90,75,120' && r.hpAll.every((x) => x.hp === x.hpMax && x.you === 'Health ' + x.hpMax + ' / ' + x.hpMax), 'and the card, the player and the YOU panel agree: ' + r.hpAll.map((x) => x.id + ' "' + x.you + '"').join(', '));
    check(r.old && r.old.hpMax === 120 && r.old.hp === 120 && r.old.you === 'Health 120 / 120' && r.old.bar === 1,
      'PLAYED: an old save\'s 43-scale health (the carter\'s 120 stored as 52) is brought up to the card on load, so the card, the YOU panel and the HUD bar agree: ' + JSON.stringify(r.old));
    check(r.oldHurt && r.oldHurt.hpMax === 90 && r.oldHurt.hp === 30 && r.oldHurt.you === 'Health 30 / 90' && Math.abs(r.oldHurt.bar - 1 / 3) < 1e-9,
      'and a hurt old save keeps its share of the bar (13 of 39 becomes 30 of 90), rather than being healed to full: ' + JSON.stringify(r.oldHurt));
    check(Math.abs(r.an[0] - Math.max(-0.8, r.an[1] - 0.8)) < 1e-9 && r.an[0] < r.an[1], 'and soft feet: your steps carry a third less (' + r.an.join(' from ') + ')');
    check(r.btns.join(' ') === P10.BUTTONS.map((b) => b.t).join(' '), 'the HUD\'s buttons are this game\'s: ' + r.btns.join(' '));
    const leak = Object.entries(r.panels).find(([, t]) => OCTAVE.test(t));
    check(Object.keys(r.panels).length === 5 && !leak, 'YOU, PACK, BOOK, FOLK and HELP open this game\'s panels, with none of the Octave\'s words' + (leak ? ': ' + leak[0] + ' says "' + (leak[1].match(OCTAVE) || [])[0] + '"' : ''));
    check(/Gutter-kin/.test(r.panels.YOU) && /Soft-footed/.test(r.panels.YOU) && /Frail/.test(r.panels.YOU), 'YOU shows your walk of life, knack and flaw');
    check(/salt/.test(r.panels.PACK) && /oil/i.test(r.panels.PACK), 'PACK shows what you carry: salt, and the lantern\'s oil');
    check(/S\.30/.test(r.panels.BOOK) && /Gytha Marrin sent us north/.test(r.panels.BOOK), 'BOOK is dated by this game\'s year and holds the errand');
    check(/Marget Sayle/.test(r.panels.FOLK) && /Gytha Marrin/.test(r.panels.FOLK) && /carter/i.test(r.panels.FOLK), 'FOLK is who you know here: Marget Sayle, Gytha Marrin, the carter');
    check(/\bU\b/.test(r.panels.HELP) && /bar/i.test(r.panels.HELP) && /Shift/.test(r.panels.HELP), 'HELP is this game\'s: the lantern on U, the bar on the door, Shift runs and is loud');
    check(r.keys.c === 'char' && r.keys.i === 'inv' && r.keys.l === 'log' && r.keys.k === 'ledger' && r.keys.h === 'help' && r.keys.tab === 'inv', 'and the keys open them, under the engine\'s own panel names: C, I, L, K, H, and Tab (once the song-book) the pack ' + JSON.stringify(r.keys));
    check(Object.keys(r.shut).length === 6 && Object.values(r.shut).every(Boolean), 'and the same key again closes each, as it always did (' + JSON.stringify(r.shut) + ')');
    check(r.lampN === true && r.lampBtn === false, 'N (once the Murmur) lights the lantern, and LAMP douses it');
    check(r.f1.voice[0] === r.f1.voice[1] && !r.f1.murmur, 'F1 sings nothing: the Octave\'s songs are not this game\'s');
    check(r.hud.length > 3 && !r.hud.some((t) => /sov\.|\bLv\b|fragments/.test(t)) && r.hud.some((t) => /The waif · \d+ salt|The waif · no salt/.test(t)), 'the HUD draws "' + (r.hud.find((t) => /The waif/.test(t)) || '') + '", not levels and sovereigns');
    check(r.bar && Math.abs(r.bar.f - 0.5) < 1e-6 && r.bar.col === '#c8913a', 'its third bar is the lantern\'s oil, half full, in tallow (' + JSON.stringify(r.bar) + ')');
    check(/js\/art2\.js/.test(r.credits) && !/Kokoro|Canva|DreamShaper|39 images|ASSETS\.md|Unverified/.test(r.credits), 'the in-game credits are this repository\'s, and so is their first line');
    check(r.saved === 'gutter', 'the choice is kept with the game\'s flags, which are saved');
    check(!r.err, 'nothing threw: ' + (r.err || 'none'));
    check(s.errors.length === 0, 'no page errors: ' + (s.errors[0] || 'none'));
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
