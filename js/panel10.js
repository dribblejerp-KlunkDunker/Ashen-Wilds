// ============================================================
//  panel10 - Phase 10, "this game's panel words, credits and creation".
//
//  WHAT THE BIBLE SAYS (searched before anything was invented):
//    * docs/worldbuilding/the-round-and-the-long-account.md, *The company*: "There are no classes. What a person does on
//      a landing is decided by what they carry." "A person is four things": a background, a dependant, lungs, a word.
//      "Backgrounds. The eight from Ashen Wilds carry over unchanged." The default pair: "an old Watch deserter with a
//      glim-marked blade, and a young causeway carter". Gytha Marrin "has sent them north".
//    * CANON.md, 20: the eight backgrounds are walks of life the archive already knows. godot-people.md, part 2: each
//      background as a life ("The life."), with its card's knack and flaw. Those cards were written for the Godot game's
//      own survivors, and several put you at the Causeway tower when it fell; the novel's rulings fix the nine who were
//      there, and O11 rules the ledge's deserter is an older Watch man, not one of them. So creation quotes each walk of
//      life and its knack and flaw, word for word, and not the survivor's own past.
//    * The atlas, the wider Round: "Money. Salt in the fen; silver (the mark) on the quays". The fen's tolls are paid in
//      salt, in measures. So on the highland edge you count salt, not the Shattered Octave's sovereigns.
//    * CREDITS.md: this repository's own sources.
//
//  WHAT IT DOES
//    * CREATION. Begin asks who walks north: the eight walks of life, the deserter first (the default pair). The choice
//      names you on the HUD, and takes effect where the card gives a number and the game has the system: health (the
//      deserter's old wound 90, the gutter-kin frail 75, the carter hardy 120, each your health outright; a card that
//      gives no figure is 100) and soft feet (the gutter-kin's steps "carry a third less", 0.8 of a walk's 2.4, the
//      engine's own floor for quiet feet). Every other
//      knack and flaw waits for its system (blocks, carry weight, dodges, sight, hearing, bandaging): the card shows it.
//      Kept in G.flags.la_bg, which is saved with the game.
//    * THE PANEL'S WORDS. The Octave's buttons (CHAR INV SONG LOG MAP REST NAMES HELP MURMUR SAVE WEAPON) become this
//      game's: YOU, PACK, BOOK, MAP, REST, FOLK, HELP, SAVE, LAMP, WEAPON. YOU is your walk of life; PACK what you
//      carry, your salt and the lantern's oil; BOOK the errand, dated by this game's year; FOLK the people you know;
//      HELP this game's keys. The same keys open them (C, I, L, K, H; Tab, once the song-book, opens the pack), N (once
//      the Murmur) and LAMP light and douse the lantern, and the Octave's songs sing nothing here.
//    * THE HUD. Its line counts salt, not levels and sovereigns; its song lines are not drawn; its third bar, once the
//      Octave's Voice, is the lantern's oil, in tallow.
//    * THE CREDITS. The in-game credits table becomes this repository's, as CREDITS.md has it.
//  No engine file is edited. Not a picture effect, so no switch: off would only bring back the Octave's words.
// ============================================================
'use strict';
const PANEL10 = (() => {
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : null;

  // ---------------------------------------------------------------- the eight walks of life (godot-people.md, part 2)
  // life: "The life." word for word (markup dropped). knack and flaw: the card's names, and what the card says they do.
  // call: what the HUD calls you [PROPOSED] P81. hp: the card's health, on the 100 its cards are written on; choose()
  // gives you that figure outright, so the card and the YOU panel agree. step: quieter feet (added to the engine's
  // armour noise, which floors at -0.8).
  const BACKGROUNDS = [
    { id: 'deserter', name: 'Watch Deserter', call: 'The deserter', hp: 0.9, step: 0,
      life: 'The Causeway Watch, left without pay or orders in S.3, kept the road twenty-six years on tolls in salt and food; from S.12 it held only the tower and the toll house. Nothing was issued new after S.3. A Watch sword had always been someone\'s first.',
      knack: { name: 'Drilled', what: 'cheaper blocks' }, flaw: { name: 'Old wound', what: '90 health' },
      kit: 'Arming sword, wooden targe, torch, two rags.' },
    { id: 'factor', name: 'Cinder Factor', call: 'The carrier', hp: 1, step: 0,
      life: 'before the Breaking the Cinder Factors moved slag-iron cinder down from the Citadels. Now the Factor houses send carriers on foot along embankments no cart can use, paid on arrival, never before, with a waybill saying what was carried, by whom, to whom.',
      knack: { name: 'Packhorse', what: '26 kg; a full pack clatters less' }, flaw: { name: 'Bad knees', what: 'sprint at 85%; a dodge costs 30' },
      kit: 'Boar spear, long torch, two rags.' },
    { id: 'cleaner', name: 'Chapel Cleaner', call: 'The cleaner', hp: 1, step: -0.4,   // "quieter steps": the card gives no number; 0.4 is half the gutter-kin's [PROPOSED] P82
      life: 'After the senior clergy sailed, many chapels ran on their cleaners, who knew the order of service, the places of the dead and where the oil was kept.',
      knack: { name: 'Quiet hands', what: 'searches a third faster; quieter steps' }, flaw: { name: 'Untrained', what: 'attacks cost a third more and wear a weapon twice as fast' },
      kit: 'Wooden targe, a long torch, four rags. No weapon.' },
    { id: 'cutter', name: 'Peat-cutter', call: 'The cutter', hp: 1, step: 0,
      life: 'Peat is the Blackfen\'s fuel. Gangs cut banks in the high fen in the grey thaw and stack the turves to dry. The axe is for bog-oak, the drowned roots that stop a slane dead. A cutter\'s arms and back are the fen\'s strongest; a cutter\'s chest is its worst.',
      knack: { name: 'Strong back', what: '23 kg; heavy strikes +15%' }, flaw: { name: 'Winded', what: '80 stamina, slower to return' },
      kit: 'Broadaxe, short torch, one rag.' },
    { id: 'gutter', name: 'Gutter-kin', call: 'The waif', hp: 0.75, step: -0.8,
      life: 'Gutter-kin is an old Causeway word for road waifs: children with no house, no kin but the gutter, who live on what travellers do not watch. In the first winters there were many, and most died. For years the Roofed Mile, the avalanche gallery on the Bell Road, sheltered a gang of them: a roof against the ash, a dry floor between the piers, carts passing slowly enough to rob.',
      knack: { name: 'Soft-footed', what: 'steps carry a third less; dodges cost 16; a little further sight' }, flaw: { name: 'Frail', what: '75 health; wounds bleed half again as long' },
      kit: 'A worn arming sword, short torch, two rags.' },
    { id: 'priest', name: 'Hedge-priest', call: 'The hedge-priest', hp: 1, step: 0,
      life: 'Hedge-priests are the Keeping\'s unlicensed: curates never ordained, penitents who began to preach. They bury the dead the parishes cannot reach, witness oaths no register will hold, and keep a light at night for whoever is on the road. The hierarchy\'s remnant calls them frauds.',
      knack: { name: 'Steady', what: '50 poise; stamina back a quarter faster' }, flaw: { name: 'Sworn hands', what: 'no heavy blows' },
      kit: 'Wooden targe, the longest-burning torch, three rags. No weapon.' },
    { id: 'healer', name: 'Fen Healer', call: 'The healer', hp: 1, step: 0,
      life: 'Fen healers are not physicians and do not claim to be. They set bones, close wounds, deliver children and tell the living which water to boil, paid in food when at all, and they hold opinions the warning book cannot settle (ash-moths carry the spores; ash-rats spread the flux).',
      knack: { name: 'Deft', what: 'bandaging twice as fast, healing twice as much' }, flaw: { name: 'Night-blind', what: 'sight at 60%' },
      kit: 'Boar spear, torch, five rags.' },
    { id: 'carter', name: 'Causeway Carter', call: 'The causeway carter', hp: 1.2, step: 0,
      life: 'Carters own carts and the beasts that pull them, which makes them rich by Blackfen measures and a target on every road. Few draught beasts are left after thirty years; the carters who still have oxen are known along the road by name, and so are the oxen.',
      knack: { name: 'Hardy', what: '120 health, a worn gambeson; wounds bleed a quarter less long' }, flaw: { name: 'One good ear', what: 'hearing at 70%' },
      kit: 'Broadaxe, wooden targe, the gambeson, torch, two rags.' },
  ];
  const DEFAULT = 'deserter';
  const byId = (id) => BACKGROUNDS.find((b) => b.id === id) || null;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------- the panel's buttons, in the engine's own boxes
  const BUTTONS = [
    { x: 48, y: 155, w: 24, h: 11, t: 'YOU', key: 'c', open: 'renderYou' },
    { x: 74, y: 155, w: 24, h: 11, t: 'PACK', key: 'i', open: 'renderPack' },
    { x: 100, y: 155, w: 24, h: 11, t: 'BOOK', key: 'l', open: 'renderBook' },
    { x: 126, y: 155, w: 24, h: 11, t: 'MAP', key: 'm', open: 'renderMap' },
    { x: 48, y: 168, w: 24, h: 11, t: 'REST', key: 'r', open: 'renderRest' },
    { x: 74, y: 168, w: 24, h: 11, t: 'FOLK', key: 'k', open: 'renderFolk' },
    { x: 100, y: 168, w: 24, h: 11, t: 'HELP', key: 'h', open: 'renderHelp' },
    { x: 126, y: 168, w: 24, h: 11, t: 'SAVE', key: 'escape', open: 'renderMenu' },
    { x: 48, y: 181, w: 36, h: 11, t: 'LAMP', key: 'n', open: 'lamp' },
    { x: 86, y: 181, w: 64, h: 11, t: 'WEAPON', key: '1-4', open: 'weapon' },
  ];

  // ---------------------------------------------------------------- the words
  const TX = {
    whoTitle: 'Who walks north',
    whoLead: 'Gytha Marrin sends two north for Marget Sayle: a young carter from the Causeway, and one more. Who are you?',
    whoKnack: 'Knack', whoFlaw: 'Flaw', whoSent: 'the one Gytha sent',
    youSent: 'Sent north by Gytha Marrin for Marget Sayle.',
    youHealth: 'Health',
    packTitle: 'What you carry', packHands: 'In your hands', packWorn: 'Worn', packBag: 'In the pack',
    salt: (n) => (n > 0 ? n + (n === 1 ? ' measure of salt.' : ' measures of salt.') : 'No salt.'),
    lamp: (w) => 'The lantern: ' + (w === 'dry' ? 'dry, no oil' : w + ' of oil') + '.', lampNone: 'No lantern.',
    torch: (w) => 'The torch: ' + w + '.',   // Phase 38's words: fresh, burning well, half burned, burning down, nearly spent, spent
    bookTitle: 'The book',
    bookDate: (day, part) => 'The thaw of S.30, day ' + (day + 1) + ', ' + part + '.',
    bookNone: 'Nothing written yet.',
    folkTitle: 'Who you know',
    carter: 'The carter. Young, from the Causeway. Gytha Marrin sent the two of you north together.',
    helpTitle: 'How to play',
    help: [
      ['Walk', 'W A S D. Shift runs, and running is loud: the walking bloom hears it.'],
      ['Look', 'Click the view to take the mouse, then move it. Esc gives the mouse back. Z levels your gaze.'],
      ['Light', 'U or N lights the lantern and douses it. It burns oil. Fill it from a flask with the lantern dark.'],
      ['Use', 'E or Space: talk, take, open, and set the bar across a door.'],
      ['Strike', 'Left-click. The wheel or 1 to 4 changes what is in your hand.'],
      ['Panels', 'C who you are, I your pack, L the book, K who you know, M the map, R rest, Esc options and saving.'],
      ['Hide', 'Nothing here can be fought for long. Keep quiet, keep the light, and keep the bar across the door.'],
    ],
    creditsLead: 'Everything this game ships with, and where it came from. The same list is in CREDITS.md.',
    hudSalt: (name, n) => name + ' · ' + (n > 0 ? n + ' salt' : 'no salt'),
  };

  // ---------------------------------------------------------------- the credits: this repository's (CREDITS.md)
  const OFL = 'SIL Open Font License 1.1 (text in fonts/)';
  // this repository's own code: a phase is one file js/<feature><phase>.js (CLAUDE.md)
  const PHASE_FILES = ['js/fork0.js', 'js/ledge1.js', 'js/art2.js', 'js/sun3.js', 'js/bloom4.js', 'js/door5.js', 'js/weather6.js', 'js/lantern7.js', 'js/building8.js', 'js/dread9.js', 'js/panel10.js', 'js/opening11.js', 'js/company12.js', 'js/carter13.js', 'js/account14.js', 'js/carry15.js', 'js/book16.js', 'js/kit17.js', 'js/cards18.js', 'js/hearing19.js', 'js/lungs20.js', 'js/weather21.js', 'js/deadcalm22.js', 'js/combat23.js', 'js/bloom24.js', 'js/coop25.js', 'js/chart26.js', 'js/hearth27.js', 'js/people28.js', 'js/workings30.js', 'js/marks31.js', 'js/bestiary32.js', 'js/actone33.js', 'js/acttwo34.js', 'js/sidearcs35.js', 'js/actthree36.js', 'js/endings37.js', 'js/torch38.js', 'js/prologue39.js'];
  const CREDITS = [
    { title: 'The engine', rows: [
      ['Code in js/ (but for this repository\'s phase files, below), css/, schemas/, locales/, sw.js', 'Copied on 2026-11-11 from Echoes of the Shattered Octave (same owner), commit f2b3990, at the owner\'s direction (D14). Written with AI assistance', 'That repository declares no open licence', []],
      ['This game\'s phases', 'Written for this repository, with AI assistance, one file a phase', 'Part of this repository', PHASE_FILES],
    ] },
    { title: 'Art', rows: [
      ['Tiles, people, things, the hand and blade, the mark', 'Painted in code in js/art2.js', 'Part of this repository', ['js/art2.js']],
      ['The land, the Slagcrown, the coal sun, the ash', 'Painted and built in code in js/ledge1.js', 'Part of this repository', ['js/ledge1.js']],
      ['The walking bloom, the lantern, the highland building', 'Modelled and painted in code in js/bloom4.js, js/lantern7.js and js/building8.js', 'Part of this repository', []],
      ['App icons, the title picture, the two portraits', 'Written by tools/icons.js, tools/shots.js and tools/portraits.js from the game itself', 'Part of this repository', ['assets/icons/', 'img/title.png', 'img/p_la_carter.jpg', 'img/p_la_marget.jpg']],
    ] },
    { title: 'Typefaces', rows: [
      ['Cinzel', 'The Cinzel Project Authors (2020)', OFL, ['cinzel-latin-500-normal.woff2', 'cinzel-latin-700-normal.woff2', 'OFL-Cinzel.txt']],
      ['Alegreya', 'The Alegreya Project Authors (2011)', OFL, ['alegreya-latin-*.woff2', 'OFL-Alegreya.txt']],
      ['Alegreya SC', 'The Alegreya Project Authors (2011)', OFL, ['alegreya-sc-latin-*.woff2', 'OFL-AlegreyaSC.txt']],
      ['UnifrakturMaguntia', "j. 'mach' wust (2010) and Peter Wiegel (2009)", OFL, ['UnifrakturMaguntia.woff2', 'OFL-UnifrakturMaguntia.txt']],
    ] },
    { title: 'Sound', rows: [
      ['Every sound', 'Generated live with WebAudio by the engine (js/audio.js, js/voices.js). No sound or music file ships', 'Part of the game source', []],
    ] },
    { title: 'Libraries and tools', rows: [
      ['PeerJS', 'For the two-player link (js/vendor/peerjs.min.js)', 'MIT, per the notice in the file', ['js/vendor/peerjs.min.js']],
      ['Playwright and Chromium', 'Run the tests and write the stills. Not bundled, not needed to play', 'Playwright: Apache-2.0; Chromium: its own licences', []],
    ] },
  ];

  // ---------------------------------------------------------------- the HUD's lines (pure)
  function hudText(s) {
    const m = /^(.*) · Lv \d+ · (\d+) sov\.$/.exec(s);
    if (m) return TX.hudSalt(m[1], +m[2]);
    if (/^fragments \d+/.test(s) || s === 'ROOT NOTE' || s === 'REED' || /^GREENING \d/.test(s) || /^HOLD \d/.test(s)) return null;   // the Octave's songs and greening
    return s;
  }
  function texts() {
    const out = [];
    for (const b of BACKGROUNDS) out.push(b.name, b.call, b.life, b.knack.name, b.knack.what, b.flaw.name, b.flaw.what);
    for (const b of BUTTONS) out.push(b.t);
    for (const k in TX) { const v = TX[k]; if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) for (const r of v) out.push(...r); else out.push(v(2, 'afternoon')); }
    out.push(TX.salt(0), TX.salt(1), TX.lamp('half full'), hudText('The deserter · Lv 1 · 12 sov.'));
    for (const s of CREDITS) { out.push(s.title); for (const r of s.rows) out.push(...r.slice(0, 3)); }
    return out;
  }

  // ---------------------------------------------------------------- in the game
  const ST = { hud: [], bar: null, baseHp: null, err: null, packT: -1 };
  const OIL = '#c8913a', VOICE_BLUE = '#3d6aa8';
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const current = () => (typeof G !== 'undefined' && G && G.flags && byId(G.flags.la_bg)) || byId(DEFAULT);
  const closeBtn = '<button class="dfbtn small close" id="x">Close</button>';
  const wireClose = () => { const x = document.getElementById('x'); if (x) x.onclick = () => { closeModal(); G.state = 'play'; }; };
  const oilFrac = () => { try { return LANTERN7.frac ? LANTERN7.frac() : Math.max(0, Math.min(1, LANTERN7.oil() / LANTERN7.cap())); } catch (e) { return 0; } };   // the light in hand (Phase 38: a torch)

  function renderWho(done) {
    // a card is a button, but reads as prose: the button face is for a name, not a paragraph
    const cards = BACKGROUNDS.map((b) => `<button class="dfbtn la-bg" data-bg="${b.id}" style="display:block;width:100%;text-align:left;margin:.8cqh 0;padding:1cqh 1.6cqw;white-space:normal;letter-spacing:0">
      <b style="font-family:var(--font-display);letter-spacing:.06em;color:var(--gold)">${esc(b.name)}</b>${b.id === DEFAULT ? ' <span style="font-family:var(--font-body);color:var(--parch-dim)">(' + TX.whoSent + ')</span>' : ''}<br>
      <span style="font-family:var(--font-body);color:var(--parch)">${esc(cap(b.life))}</span><br>
      <span style="font-family:var(--font-body);font-size:.85em;color:var(--parch-dim)"><b>${TX.whoKnack}:</b> ${esc(b.knack.name)} (${esc(b.knack.what)}). <b>${TX.whoFlaw}:</b> ${esc(b.flaw.name)} (${esc(b.flaw.what)}).</span></button>`).join('');
    openModal(`<div id="la-who"><h2>${TX.whoTitle}</h2><p class="muted">${esc(TX.whoLead)}</p>${cards}</div>`, 'la-who');
    document.querySelectorAll('#la-who [data-bg]').forEach((el) => { el.onclick = () => { closeModal(); done(el.dataset.bg); }; });
  }
  // Put a card on the traveller in hand. choose() is the creation path; the succession path (js/company12.js) calls this
  // with the next person's card, so the handover gets the same health figure and the same name the creation screen gives.
  function applyBg(id, opts) {
    const b = byId(id) || byId(DEFAULT), p = G.player;
    G.flags.la_bg = b.id;
    // The card's health is the card's own figure, not a share of the engine's class health: as a share, the deserter's
    // card promised 90 and the YOU panel showed 39. A card that gives no figure is 100 (godot-people.md's own scale).
    if (p) { ST.baseHp = p.hpMax; p.hpMax = Math.max(1, Math.round(100 * b.hp)); p.hp = p.hpMax; p.name = b.call; }
    return b;
  }
  function choose(id) { return applyBg(id); }
  // ---------------------------------------------------------------- old saves: the card's figure, not the old share
  // choose() sets the card's figure at creation, but restoreGame() puts the player back exactly as the save stored it.
  // A save written before P86 (or by a window still running that code) carries the engine's 43-scale health: the
  // carter's 120 was stored as 52, the deserter's 90 as 39, so the YOU panel's card line and its Health line disagreed
  // and the HUD's health bar drew the old share. Raise a loaded maximum that sits below the card to the card's figure
  // and scale what is left of the bar with it, so a full bar stays full and a hurt one keeps its share. A levelled or
  // otherwise higher maximum is never lowered.
  function reconcile() {
    try {
      const p = G && G.player; if (!p || !(p.hpMax > 0)) return false;
      const fig = Math.max(1, Math.round(100 * current().hp));
      if (p.hpMax >= fig) return false;
      const f = Math.max(0, Math.min(1, p.hp / p.hpMax));
      p.hpMax = fig;
      if (p.hp > 0) p.hp = Math.max(1, Math.min(fig, Math.round(f * fig)));
      return true;
    } catch (e) { return false; }
  }
  // ---------------------------------------------------------------- co-op: the card's health for the guest too
  // A guest's traveller is made on the host by PARTNER19, which gives it the engine's calling health (about 43) and
  // never sees this game's card. The guest sends the walk of life they chose as an id; the host looks the figure up in
  // its own table (no number off the wire is trusted) and the partner gets the card's health outright, the same reading
  // choose() gives the host (P86). With no id, the default card (the deserter) answers.
  function coop() {
    if (typeof PARTNER19 !== 'object' || !PARTNER19 || !PARTNER19.guest || !PARTNER19.guest.card) return false;
    const g = PARTNER19.guest;
    if (!g.card.laCard10) {
      const _card = g.card;
      g.card = function (src, opts) {
        const c = _card.apply(this, arguments);
        try {
          if (c && !c.error) {
            const fl = src && typeof src === 'object' && src.flags ? src.flags : (typeof G !== 'undefined' && G && G.flags);
            c.laBg = (byId(fl && fl.la_bg) || byId(DEFAULT)).id;
          }
        } catch (e) { /* the card goes without it; the host keeps the engine's health */ }
        return c;
      };
      g.card.laCard10 = true;
    }
    if (!PARTNER19.join || PARTNER19.join.laCard10) return true;
    const _join = PARTNER19.join;
    PARTNER19.join = function (card, opts) {
      const r = _join.apply(this, arguments);
      try {
        const b = byId(card && card.laBg) || byId(DEFAULT), p = PARTNER19.S && PARTNER19.S.pp;
        if (r && r.ok && b && p) {
          const hp = Math.max(1, Math.round(100 * b.hp));
          p.hpMax = hp; p.hp = hp;
          if (r.partner) { r.partner.hpMax = hp; r.partner.hp = hp; }
        }
      } catch (e) { /* the engine's own health stands */ }
      return r;
    };
    PARTNER19.join.laCard10 = true;
    return true;
  }
  function renderYou() {
    reconcile();   // the panel's card line and its Health line can never disagree, however the player was loaded
    const b = current(), p = G.player;
    openModal(`<h2>${esc(p.name)}</h2>${closeBtn}<p><b style="color:var(--gold)">${esc(b.name)}</b></p><p>${esc(cap(b.life))}</p>
      <p><b>${TX.whoKnack}:</b> ${esc(b.knack.name)} (${esc(b.knack.what)}).<br><b>${TX.whoFlaw}:</b> ${esc(b.flaw.name)} (${esc(b.flaw.what)}).</p>
      <p>${TX.youHealth} ${Math.round(p.hp)} / ${p.hpMax}</p><p class="muted">${esc(TX.youSent)}</p>`, 'char');
    wireClose();
  }
  function renderPack() {
    ST.packT = typeof performance !== 'undefined' ? performance.now() : 0;
    ST.packEv = (typeof window !== 'undefined' && window.event) || null;   // the key press that opened it, if any (audit fix)
    const p = G.player, name = (id) => (typeof ITEMS !== 'undefined' && ITEMS[id] && ITEMS[id].name) || (typeof WEAPONS !== 'undefined' && WEAPONS[id] && WEAPONS[id].name) || id;
    const hands = (p.weapons || []).filter(Boolean).map((id) => esc(name(id)));
    const worn = Object.values(p.armor || {}).filter(Boolean).map((id) => esc(name(id)));
    const wornIds = new Set(Object.values(p.armor || {}));
    const bag = (p.inv || []).filter((s) => s && s.n > (wornIds.has(s.id) ? 1 : 0)).map((s) => esc(name(s.id)) + (s.n - (wornIds.has(s.id) ? 1 : 0) > 1 ? ' x' + (s.n - (wornIds.has(s.id) ? 1 : 0)) : ''));
    // the oil is the lantern's (Phase 7); a kit's torch has no fuel of its own yet, so the line names the lantern (audit fix)
    let lamp = TX.lampNone; try { const S = LANTERN7.source ? LANTERN7.source() : null, w = S ? S.words(S.get()) : LANTERN7.words(LANTERN7.oil()); lamp = S && S.id === 'torch' ? TX.torch(w) : TX.lamp(w); } catch (e) { /* no light */ }
    openModal(`<h2>${TX.packTitle}</h2>${closeBtn}
      <p><b>${TX.packHands}:</b> ${hands.join(', ') || '-'}</p><p><b>${TX.packWorn}:</b> ${worn.join(', ') || '-'}</p>
      <p><b>${TX.packBag}:</b> ${bag.join(', ') || '-'}</p><p>${esc(lamp)}</p><p>${esc(TX.salt(p.gold | 0))}</p>`, 'inv');
    wireClose();
  }
  function renderBook(q, openN) {
    const day = Math.max(0, G.day | 0), part = typeof timeName === 'function' ? timeName() : '';
    const errand = (G.journal || []).find((j) => j && j.cat === 'main');
    const B = typeof BOOK16 !== 'undefined' ? BOOK16 : null;
    if (!B) {
      const rows = (G.journal || []).filter((j) => j && j.text).map((j) => `<p>${esc(j.text)}</p>`).join('') || `<p class="muted">${TX.bookNone}</p>`;
      openModal(`<h2>${TX.bookTitle}</h2>${closeBtn}<p class="muted">${esc(TX.bookDate(day, part))}</p><p class="muted">The Account opens with X. It does not stop the world.</p>${rows}`, 'log');
      wireClose(); return;
    }
    if (openN != null) {
      const e = B.byN(openN); if (!e) { renderBook(q, null); return; }
      B.read(e.n);
      openModal(`<h2>${esc(e.title)}</h2>${closeBtn}<p class="muted">Entry ${e.n} of ${B.count}. ${esc(e.witnesses.length >= 2 ? B.TX.two : B.TX.one)}${e.hand ? ' In ' + esc(e.hand) + '\'s hand.' : ''}</p>
        <pre style="white-space:pre-wrap;font-family:var(--font-body);line-height:1.45">${esc(e.text)}</pre>
        <div class="btns"><button class="dfbtn" id="book-back">Back to the book</button></div>`, 'log');
      const back = document.getElementById('book-back'); if (back) back.onclick = () => renderBook('', null);
      wireClose(); return;
    }
    const list = B.find(q);
    const rows = list.map((e) => `<button class="dfbtn" data-book="${e.n}" style="display:block;width:100%;text-align:left;margin:.35cqh 0"><b>${e.n}. ${esc(e.title)}</b> <span class="muted">${B.isRead(e.n) ? 'read' : 'unread'}</span></button>`).join('') || `<p class="muted">${esc(B.TX.none)}</p>`;
    openModal(`<h2>${TX.bookTitle}</h2>${closeBtn}<p class="muted">${esc(TX.bookDate(day, part))}</p><p class="muted">The Account opens with X. It does not stop the world.</p>
      ${errand ? `<p><b>The errand.</b> ${esc(errand.text)}</p>` : ''}
      <p><input id="book-search" class="book-search" type="search" placeholder="${esc(B.TX.search)}" value="${esc(q || '')}"></p>
      <div id="book-list" class="book-list">${rows}</div>`, 'log');
    const bind = () => document.querySelectorAll('[data-book]').forEach((b) => { b.onclick = () => renderBook('', +b.dataset.book); });
    bind();
    const input = document.getElementById('book-search');
    if (input) input.oninput = () => {
      const box = document.getElementById('book-list'), found = B.find(input.value);
      box.innerHTML = found.map((e) => `<button class="dfbtn" data-book="${e.n}" style="display:block;width:100%;text-align:left;margin:.35cqh 0"><b>${e.n}. ${esc(e.title)}</b> <span class="muted">${B.isRead(e.n) ? 'read' : 'unread'}</span></button>`).join('') || `<p class="muted">${esc(B.TX.none)}</p>`;
      bind();
    };
    wireClose();
  }
  function renderFolk() {
    const T = (L1 && L1.TOPICS) || {}, line = (n) => (T[n] && T[n].low) || '';
    const C = typeof COMPANY12 !== 'undefined' ? COMPANY12 : null;
    const roll = C && C.roll ? C.roll(C.state()) : [];   // audit fix: roll() needs the company; called bare it was always empty
    const dead = roll.length && C.TX ? `<h3>${esc(C.TX.deadTitle)}</h3>${roll.map((d) => `<p>${esc(d.named ? C.TX.deadNamed(d.name) : C.TX.deadUnnamed(d.name))}</p>`).join('')}` : '';
    const A = typeof ACCOUNT14 !== 'undefined' && ACCOUNT14.state ? ACCOUNT14.state() : null;
    const fw = A && A.forsworn ? Object.keys(A.forsworn).filter((n) => A.forsworn[n]) : [];
    const sworn = fw.length ? `<h3>Forsworn</h3>${fw.map((n) => `<p>${esc(n)}. Forsworn.</p>`).join('')}` : '';
    openModal(`<h2>${TX.folkTitle}</h2>${closeBtn}
      <p><b>Marget Sayle.</b> ${esc(line('Marget Sayle'))}</p><p><b>Gytha Marrin.</b> ${esc(line('Gytha Marrin'))}</p><p>${esc(TX.carter)}</p>${dead}${sworn}`, 'ledger');
    wireClose();
  }
  function renderHelp10() {
    openModal(`<h2>${TX.helpTitle}</h2>${closeBtn}<table>${TX.help.map(([a, b]) => `<tr><td class="n"><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</table>`, 'help');
    wireClose();
  }
  const lamp = () => { try { LANTERN7.toggle(); } catch (e) { /* no lantern */ } };
  const OURS = { renderYou, renderPack, renderBook, renderFolk, renderHelp: renderHelp10 };

  // a later layer over any drawHUD (exported so an earlier phase's test can peel its own layer and put this one back)
  function wrapHUD(_hud) {
    return function () {
      if (!here() || !G.player) return _hud.apply(this, arguments);
      const ctx = Engine.ctx, p = G.player, keep = [p.voice, p.voiceMax], ft = ctx.fillText;
      const fs = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
      const f = oilFrac(); p.voice = f; p.voiceMax = 1; ST.hud = []; ST.bar = { f, col: OIL };
      ctx.fillText = function (s) { const t = hudText(String(s)); ST.hud.push(t == null ? '' : t); if (t == null) return undefined; arguments[0] = t; return ft.apply(this, arguments); };
      Object.defineProperty(ctx, 'fillStyle', { configurable: true, get() { return fs.get.call(this); }, set(v) { fs.set.call(this, v === VOICE_BLUE ? OIL : v); } });
      try { return _hud.apply(this, arguments); } finally { delete ctx.fillText; delete ctx.fillStyle; p.voice = keep[0]; p.voiceMax = keep[1]; }
    };
  }
  function wire() {
    if (typeof Engine === 'undefined' || typeof HUD_BTNS === 'undefined' || !L1) return false;
    // the buttons, in place (the engine's table is a const array that hudClick reads)
    HUD_BTNS.length = 0;
    for (const b of BUTTONS) {
      const f = b.open === 'lamp' ? () => lamp() : b.open === 'weapon' ? () => cycleWeapon(1)
        : OURS[b.open] ? () => { G.state = 'panel'; OURS[b.open](); } : () => { G.state = 'panel'; window[b.open](); };
      HUD_BTNS.push({ x: b.x, y: b.y, w: b.w, h: b.h, t: b.t, f });
    }
    // the same keys open this game's panels: the engine calls these by name
    const swap = (name, ours) => { const orig = window[name]; if (typeof orig !== 'function') return; window[name] = function () { return here() ? ours.apply(this, arguments) : orig.apply(this, arguments); }; };
    swap('renderCharacter', renderYou); swap('renderInventory', renderPack); swap('renderSongs', renderPack);
    swap('renderLog', renderBook); swap('renderLedger', renderFolk); swap('renderHelp', renderHelp10);
    // the Octave's songs sing nothing here; N, once the Murmur, is the lantern
    swap('castSong', () => false);
    window.addEventListener('keydown', (ev) => {
      try {
        if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || !here() || G.state !== 'play' || G.openPanel) return;
        if ((ev.key || '').toLowerCase() === 'n') { ev.stopImmediatePropagation(); lamp(); }
      } catch (e) { /* a key press must never throw */ }
    }, true);
    // the panels keep the engine's own names (char, inv, log, ledger, help), so a second press of C, I, L, K or H closes
    // them as it always did; Tab, which the engine closes only on its song-book, closes the pack it now opens
    window.addEventListener('keydown', (ev) => {
      try {
        if (ev.repeat || !here() || G.state !== 'panel' || G.openPanel !== 'inv' || (ev.key || '').toLowerCase() !== 'tab') return;
        // the engine's own listener runs first: the press that opened the pack must not close it. Compare the event itself;
        // the time is only a fallback, since two presses inside one millisecond can share a stamp (audit fix)
        if (ST.packEv ? ev === ST.packEv : !(ST.packT < ev.timeStamp)) return;
        ev.preventDefault(); ev.stopImmediatePropagation(); closeModal(); G.state = 'play';
      } catch (e) { /* a key press must never throw */ }
    }, true);
    // soft feet
    swap('armorNoise', function () { const n = ORIG.armorNoise.apply(this, arguments); const b = current(); return b && b.step ? Math.max(-0.8, n + b.step) : n; });
    // the HUD: its words, and its third bar as the lantern's oil
    drawHUD = wrapHUD(drawHUD);
    // a picked-up thing flies to the pack (js/flourish11.js looks for the Octave's INV)
    try {
      if (typeof HUD11 !== 'undefined' && HUD11 && Object.isExtensible(HUD11) && !HUD11.invAnchor) HUD11.invAnchor = () => {
        const cv = document.querySelector('#view'), b = BUTTONS[1]; if (!cv) return null; const r = cv.getBoundingClientRect();
        return { x: r.left + (b.x + b.w / 2) * r.width / 320, y: r.top + (b.y + b.h / 2) * r.height / 200 };
      };
    } catch (e) { /* the flourish aims at its corner */ }
    // the credits, in place (js/voices.js reads this array)
    try { if (typeof VOICES !== 'undefined' && Array.isArray(VOICES.CREDIT_SECTIONS)) { VOICES.CREDIT_SECTIONS.length = 0; for (const s of CREDITS) VOICES.CREDIT_SECTIONS.push(s); } } catch (e) { /* the credits stay */ }
    // the credits' first line names the Octave's ASSETS.md and its "unverified" rows; this repository has neither
    if (ORIG.openModal) window.openModal = function (html, name) { const a = Array.prototype.slice.call(arguments); if (name === 'credits' && typeof html === 'string') a[0] = html.replace(/<p class="muted">Everything the game ships with[^<]*<\/p>/, '<p class="muted">' + TX.creditsLead + '</p>'); return ORIG.openModal.apply(this, a); };
    // Begin asks who walks north first (a capture listener, ahead of the ledge's own)
    window.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('#btn-new') : null;
      if (!t) return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      renderWho((id) => { try { L1.begin(); choose(id); } catch (e) { ST.err = String(e && e.message); } });
    }, true);
    // a load restores the player as the save stored it: an old 43-scale maximum is brought up to the card's figure
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () {
        const r = _rg.apply(this, arguments);
        try { if (here()) reconcile(); } catch (e) { /* the save's own figure stands */ }
        return r;
      };
    }
    // a joining guest's traveller gets the card's health, as the host's own does (P86)
    try { coop(); } catch (e) { /* co-op keeps the engine's health */ }
    return true;
  }
  const ORIG = { armorNoise: typeof armorNoise === 'function' ? armorNoise : null, openModal: typeof openModal === 'function' ? openModal : null };
  const wired = typeof window !== 'undefined' ? wire() : false;
  return { PHASE_FILES, BACKGROUNDS, DEFAULT, byId, BUTTONS, TX, CREDITS, hudText, texts, choose, applyBg, renderWho, state: () => ST, current, ORIG, wrapHUD, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PANEL10;
