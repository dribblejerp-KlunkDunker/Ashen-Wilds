// ============================================================
//  kit12 — Phase 12 "Tools of the trade", team KIT: three new throwables built on the Phase 1 distractions.
//
//  They live in the same throw panel (O / the touch Throw button / right-stick click) and are thrown through the
//  game's own throwDistraction(): its aim ray and wall/body collision (distractionImpact), its inventory check and
//  take, its 0.75 s throw gap, its "idle listeners go and look" loop and its disguise exposure are all reused. This
//  module only adds what happens where the thing lands.
//
//  1. OIL FLASK (p12_flask)  Bursts into a patch of fire (radius 1.5 = 3 tiles across, 8 s). Anything that is afraid of
//     fire cannot walk into it and anything standing in it is driven out; it burns what stays in it (5 dps, 24 a
//     flask at most per foe). It is loud (the Narrow jumps, idle listeners come to look, a crackle keeps you audible
//     nearby), lights the place (one point light + the engine's flame emissive), uses firesmoke's smoke, and in
//     Oakhaven a fire seen by a neighbour or a constable is a crime. It never touches the map: no cell changes, no
//     spreading to grass (decided: bounded spread is not worth a way to burn a town), and water puts it out.
//       who burns:  beasts and swarms (hounds, mites, weaverlings, fret-crawlers, Mire-drones) and people (Legion,
//                   Office, outriders...) take full damage AND are scared of it; the Hollows (Drowned, Dirge) burn
//                   but have no will to be afraid; constructs (Steam Golem, Aegis, Listening-Horn, Chord-Warden)
//                   are iron and stone: a quarter damage, not scared; bosses take half, capped at 15% of their
//                   health a flask, and are not scared; the Hush (a Quiet, the Hush-Moths) is untouched: fire
//                   gives it nothing to keep. [PROPOSED lore choice]
//  2. DAMPER JAR (p12_jar)   [PROPOSED name] Wool-fat, wax and powdered lead-salt in a sealed jar: mundane apothecary's
//     craft, not Hush magic. For 6 s, in a 4-tile radius: no sound. Nothing inside is heard (player noise is held
//     under the Narrow's floor, foes inside hear nothing, thrown stones and bottles that land in it call nobody), no
//     Song or Murmur can be cast inside, and the player's sound bus is muted while they stand in it (positional
//     sound and weather beds included, restored on leaving; the score is not diegetic and keeps playing). It does
//     not blind anyone and does not stop a foe already chasing. On a siphoned map the Hush's "too still" clock
//     still runs inside it (silence draws the Hush) but is held at 5.5 s, under the 7 s that unwrites you, so one
//     jar can never kill; with js/dread.js On a still, quiet player at night is still easier prey for the stalker.
//  3. WEIGHTED NET (p12_net) A corsair's boarding net. Thrown along the aim line it pins the first non-boss foe it
//     meets: small things (hp <= 20 or scale <= 0.8) 6 s, ordinary ones 3.5 s, large ones (scale >= 1.15 or hp > 64)
//     are only slowed to 40% for 3 s, bosses and the Hush are immune (not consumed). Pinned foes cannot move or act
//     but can be hit normally. A foe that has just torn free will not take another net for 8 s.
//
//  Where the player gets them: Captain Vane (flask, net), Bettany (jar), the Oakhaven market tinker/oddments/
//  provisioner stalls (js/calendar11.js), strongboxes, Outrider / Cutter-Man / Hushwarden drops, and the Forge's
//  brewing list (flask: reed-pith + empty bottle; net: 2 reed-pith + 2 skipping stones).
//
//  Nothing here is saved: fire, silence and nets are in-memory only (never in G.flags, never in the entity fields the
//  save keeps). Each of the three has its own Options switch (default On, localStorage octave.kit12.v1). Off = the
//  item is gone from the throw panel, shops, loot tables and the brewing list, and the game plays as before.
//  The module never draws on Math.random (its smoke and wisps use a private generator).
//  Procedural stand-in art: flames, the net and the wool tufts are drawn in code.
// ============================================================
'use strict';

const KIT12 = (() => {
  // ---- the one balance table ---------------------------------------------------------------------------------
  const BAL = {
    flask: {
      id: 'p12_flask', name: 'Oil flask', price: 14, weight: 0.6, stack: 8,
      reach: 6, hearing: 10, investigate: 8,           // the throw ray (blocks on walls/bodies like a bottle's), how far idle listeners hear it, how long they look
      minThrow: 1.9,                                   // closer than this and the oil would take you too
      radius: 1.5, duration: 8, fade: 1.5,             // 3 tiles across; the last 1.5 s it shrinks to 0.8
      dps: 5, tick: 0.5, burst: 4, capPerFoe: 24,      // damage per second, per tick, instant splash, most one flask does to one foe
      mult: { beast: 1, person: 1, hollow: 1, construct: 0.25, boss: 0.5, hush: 0 },
      bossCapFrac: 0.15,                               // a flask never takes more than this share of a boss's health
      noiseThrow: 2.2, crackle: 2.8, crackleRange: 7,  // Narrow added on the throw; Narrow floor while you stand near the fire
      cooldown: 2.5, maxFires: 3,                      // between flasks; fires alive on a map (the oldest goes out)
      rain: 0.6, flee: 1.5, crime: 35, light: [96, 48, 10],
    },
    jar: {
      id: 'p12_jar', name: 'Damper jar', price: 24, weight: 0.5, stack: 4,
      reach: 6, radius: 4, duration: 6, cooldown: 9,   // cooldown > duration: it can never be kept up
      stillCap: 5.5, noiseCap: 0.2,
    },
    net: {
      id: 'p12_net', name: 'Weighted net', price: 11, weight: 0.8, stack: 5,
      reach: 6, hit: 0.28,                             // aim ray reach; how far off the ray a foe's edge may be
      pinSmall: 6, pinMedium: 3.5, slowLarge: 3, slowMult: 0.4,
      smallHp: 20, smallScale: 0.8, largeHp: 64, largeScale: 1.15,
      reNet: 8, cooldown: 1.5, noise: 0.4,             // a foe that tore free is immune this long; between nets
    },
  };
  const IDS = { flask: BAL.flask.id, jar: BAL.jar.id, net: BAL.net.id };
  const KEYS = Object.keys(IDS);
  const MINE = new Set(Object.values(IDS));
  const KEY = 'octave.kit12.v1';
  const set = { flask: true, jar: true, net: true };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const stats = { throws: { flask: 0, jar: 0, net: 0 }, burnTicks: 0, kills: 0, crimes: 0, muted: 0, pins: 0, errors: 0 };

  // a private generator (smoke, wisps): the game's Math.random stream is never touched
  let rs = 0x2545F491;
  const prnd = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---- live state (in memory only) ---------------------------------------------------------------------------
  const fires = [];      // { x, y, map, left, r, ents, light, acc, smoke, dealt: Map, crackle }
  const zones = [];      // { x, y, map, left, r, ents }
  const pinned = [];     // enemies currently pinned or slowed (so the tick need not scan every entity)
  let T = 0;             // seconds of play (advances only while G.state === 'play')
  let flaskReady = 0, jarReady = 0, netReady = 0;
  let cur = null;        // the foe whose update is running (for the sounds it makes)
  let audioOn = false, wrappedSfx = false;
  const live = () => fires.length > 0 || zones.length > 0 || pinned.length > 0;
  const hasG = () => typeof G !== 'undefined' && G && G.map && G.player;

  // ---- persistence of the three switches ---------------------------------------------------------------------
  function loadSet() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') for (const k of KEYS) if (typeof o[k] === 'boolean') set[k] = o[k]; } catch (e) { /* storage blocked: defaults */ }
  }
  function saveSet() { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) { /* optional */ } }

  // ---- every sentence this module can show ([PROPOSED], listed in P12-KIT/TEXT.md) --------------------------
  const TXT = {
    flaskName: 'Oil Flask',
    flaskDesc: 'Lamp-oil and a rag wick in a stoppered bottle. Thrown (O opens the throw panel), it bursts into a patch of fire where it lands: a few paces of flame that bar a passage and burn what stays in them. Loud, and bright. Never throw it where a neighbour can see.',
    jarName: 'Damper Jar',
    jarDesc: 'Wool-fat, wax and powdered lead-salt, sealed in a jar. Apothecaries use it on sickrooms. Thrown (O opens the throw panel), it breaks and takes the sound out of the air around it for a few breaths. It is only wax. It is not the Hush, and Bettany asks that you not say it is.',
    netName: 'Weighted Net',
    netDesc: 'Reed-cord knotted around fired-clay weights, the kind a corsair throws across a boarding deck. Thrown (O opens the throw panel) at a foe in front of you, it pins a small or ordinary one for a few seconds. Large things shrug it off, and some things are not there to be caught.',
    flaskHit: 'Oil flask: the glass bursts and the oil takes, {0} paces ahead. A patch of fire holds the floor.',
    flaskWet: 'Oil flask: it bursts on the water, and the oil floats there, and goes out.',
    flaskClose: 'Too close. The oil would take you with it. Aim farther off.',
    flaskWait: 'The last flask is still burning. Give it a moment.',
    flaskSeen: 'Someone sees the fire go up. The watch records it.',
    flaskGone: 'The fire dies down to black stones. The floor is as it was.',
    jarHit: 'Damper jar: it breaks, {0} paces ahead, and the sound goes out of the air around it.',
    jarWait: 'The last jar\'s wax is still settling. Wait a few breaths.',
    jarGone: 'The wax settles. Sound comes back, all at once.',
    songSilenced: 'Your voice goes into the quiet and does not come back. The Song will not carry here.',
    badge: 'Silence {0}',
    badgeAria: 'Silence: no sound carries here',
    fireHush: 'The fire does not seem to reach it.',
    netHit: 'Weighted net: it opens over {0}, and the weights take it down.',
    netBig: 'Weighted net: {0} is too big to pin. The net drags at it, and it slows.',
    netNone: 'There is nothing in the line of the throw to net.',
    netBoss: 'The net would not hold {0}.',
    netHush: 'The net would settle over nothing that holds.',
    netAlready: '{0} is already tangled.',
    netFrayed: 'Frayed rope still hangs on {0}. A second net will not take yet.',
    netFree: '{0} tears free of the net.',
    netWait: 'Let the last throw land before throwing again.',
    packFull: 'You cannot carry more than {0} of those.',
    packFullShort: 'Pack full',
    off: 'You have no use for that now.',
    hintLure: '1 stone · 2 bottle · 3 lure reed · 4 oil flask · 5 damper jar · 6 weighted net · Escape leaves. Controller: A stone, X bottle, Y lure reed, LB flask, RB jar, LT net, B leaves.',
    hintNoLure: '1 stone · 2 bottle · 3 oil flask · 4 damper jar · 5 weighted net · Escape leaves. Controller: A stone, X bottle, LB flask, RB jar, LT net, B leaves.',
    hintGeneric: 'The number on each button throws it. Escape leaves. Controller: A stone, X bottle, LB flask, RB jar, LT net, B leaves.',
    panelDamage: 'stones and bottles never deal damage. A flask burns, a jar silences, a net pins.',
    optHead: 'Tools of the trade',
    optFlask: 'Fire flasks', optFlaskHint: 'a thrown flask of burning oil: bars a passage, burns, lights, is loud',
    optJar: 'Damper jars', optJarHint: 'a thrown jar that takes the sound out of the air for a few breaths',
    optNet: 'Throwing nets', optNetHint: 'a thrown net that pins a small or ordinary foe for a few seconds',
    on: 'On', off2: 'Off',
    brewFlask: 'Oil Flask (Burns Where Thrown)', brewFlaskDesc: 'Pressed reed-seed oil in an empty bottle, a rag for a wick.',
    brewNet: 'Weighted Net (Pins a Foe)', brewNetDesc: 'Reed-cord, knotted, with two stones for weights.',
  };
  const fmt = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => (a[+i] == null ? '' : String(a[+i])));
  function say(text, cls, ttl) { try { if (typeof msg === 'function') msg(text, cls || 'warn', ttl || 4200); } catch (e) { /* cosmetic */ } }
  const theNameOf = (e) => { try { return typeof theName === 'function' ? theName(e.def.name, false) : e.def.name; } catch (err) { return 'it'; } };
  const TheNameOf = (e) => { try { return typeof theName === 'function' ? theName(e.def.name, true) : e.def.name; } catch (err) { return 'It'; } };

  // ---- what a foe is, for fire and nets -----------------------------------------------------------------------
  const CONSTRUCTS = new Set(['golem', 'aegis', 'horn', 'warden']);
  const HOLLOWS = new Set(['drowned', 'dirge']);
  function bossLike(e) { const d = e.def || {}; return !!(d.boss || d.wildsBoss || d.fearless); }
  function classify(e) {
    const d = e && e.def; if (!d) return 'person';
    if (d.quiet || d.hushkin) return 'hush';
    if (bossLike(e)) return 'boss';
    if (CONSTRUCTS.has(e.type) || d.horn || d.toll || d.chord) return 'construct';
    if (HOLLOWS.has(e.type) || d.dirge || d.shriek) return 'hollow';
    if (d.cacophony || d.drone || d.sever || d.web || d.moth) return 'beast';
    return 'person';
  }
  const scared = (e) => { const k = classify(e); return k === 'beast' || k === 'person'; };
  function sizeOf(e) {
    const d = e.def, sc = d.scale || 1, hp = d.hp || 30;
    if (hp <= BAL.net.smallHp || sc <= BAL.net.smallScale) return 'small';
    if (sc >= BAL.net.largeScale || hp > BAL.net.largeHp || d.armored) return 'large';
    return 'medium';
  }
  const alive = (e) => e && e.kind === 'enemy' && e.def && !e.dead && !e.hidden;

  // ---- procedural sprites --------------------------------------------------------------------------------------
  const px = (r, g, b, a) => (((a == null ? 255 : a) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  function canvasSprite(w, h, name, draw) {
    const data = new Uint32Array(w * h);
    const put = (x, y, c) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = c; };
    draw(put);
    Engine.addSprite(name, { w, h, data, hs: 1, cx: 0.5, dy: 0 });
    return data;
  }
  const FLAME = [px(225, 90, 16), px(255, 150, 30), px(255, 205, 80), px(255, 230, 150)];
  function flameBlob(put, cx, top, rows, maxW) {
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1), wdt = Math.max(1, Math.round(maxW * Math.sin(Math.PI * Math.pow(t, 0.8) * 0.92 + 0.12)));
      for (let i = -(wdt >> 1); i < wdt - (wdt >> 1); i++) {
        const edge = Math.abs(i + 0.5 - (wdt & 1 ? 0.5 : 0)) / Math.max(1, wdt / 2);
        const heat = (1 - edge) * (0.45 + 0.7 * t);
        put(cx + i, top + j, heat > 0.78 ? FLAME[3] : heat > 0.5 ? FLAME[2] : heat > 0.25 ? FLAME[1] : FLAME[0]);
      }
    }
  }
  function maskOf(sp) {
    const m = new Uint8Array(sp.w * sp.h);
    let n = 0;
    for (let i = 0; i < m.length; i++) {
      const p = sp.data[i]; if ((p >>> 24) < 160) continue;
      const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255;
      if (r > 175 && r > g * 1.12 && g > b * 1.25 && 0.3 * r + 0.59 * g + 0.11 * b > 135) { m[i] = 1; n++; }
    }
    return n ? m : null;
  }
  function buildSprites() {
    if (typeof Engine === 'undefined' || !Engine.addSprite || (Engine.sprites && Engine.sprites.p12_flames)) return;
    // a low bed of three flames on a scorched patch (procedural stand-in)
    canvasSprite(28, 26, 'p12_flames', (put) => {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 28; x++) {
        const dx = (x - 13.5) / 13.5, dy = (y - 2) / 2.4;
        if (dx * dx + dy * dy <= 1) put(x, 21 + y, (x * 7 + y * 3) % 5 === 0 ? px(168, 62, 28) : px(34, 28, 26));
      }
      flameBlob(put, 7, 8, 14, 8); flameBlob(put, 14, 0, 22, 11); flameBlob(put, 21, 10, 12, 7);
    });
    // the net: a rope lattice in an oval, knotted, with clay weights along the hem (procedural stand-in)
    canvasSprite(32, 40, 'p12_net', (put) => {
      const rope = px(190, 164, 106), dark = px(122, 98, 60), clay = px(150, 82, 52);
      for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) {
        const dx = (x - 15.5) / 15.5, dy = (y - 19.5) / 19.5, d = dx * dx + dy * dy;
        if (d > 1) continue;
        if (d > 0.82) { put(x, y, dark); continue; }
        if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) put(x, y, rope);
      }
      for (let i = 0; i < 7; i++) { const a = 0.5 + i * (Math.PI - 1) / 6, x = 15.5 + Math.cos(a) * 15, y = 19.5 + Math.sin(a) * 19; put(x, y, clay); put(x + 1, y, clay); put(x, y + 1, dark); put(x + 1, y + 1, dark); }
    });
    // a tuft of grey wool-fat, the wisps that mark the edge of the quiet
    canvasSprite(12, 9, 'p12_tuft', (put) => {
      const c = [px(200, 200, 196), px(170, 170, 166), px(132, 132, 130)];
      for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
        const dx = (x - 5.5) / 5.5, dy = (y - 4.5) / 4.2;
        if (dx * dx + dy * dy <= 1) put(x, y, c[dy < -0.2 ? 0 : dy < 0.45 ? 1 : 2]);
      }
    });
    for (const n of ['p12_flames', 'p12_net', 'p12_tuft']) Engine.sprites[n]._kit = true;
    try { Engine.setEmissive('p12_flames', maskOf(Engine.sprites.p12_flames)); } catch (e) { /* no glow */ }
    try { if (typeof ANIM !== 'undefined' && ANIM.fire) ANIM.fire.add('p12_flames'); } catch (e) { /* no sway */ }
  }

  // ---- items, tables ------------------------------------------------------------------------------------------
  function defineItems() {
    if (typeof ITEMS === 'undefined') return;
    const defs = {
      [IDS.flask]: { name: TXT.flaskName, sprite: 'loot', use: 'distraction', value: BAL.flask.price, desc: TXT.flaskDesc },
      [IDS.jar]: { name: TXT.jarName, sprite: 'loot', use: 'distraction', value: BAL.jar.price, desc: TXT.jarDesc },
      [IDS.net]: { name: TXT.netName, sprite: 'loot', use: 'distraction', value: BAL.net.price, desc: TXT.netDesc },
    };
    for (const id in defs) if (!ITEMS[id]) ITEMS[id] = defs[id];
    try { if (typeof ITEM_WEIGHTS !== 'undefined') for (const k of KEYS) ITEM_WEIGHTS[IDS[k]] = BAL[k].weight; } catch (e) { /* weights are optional */ }
    try {
      if (typeof ICONS !== 'undefined' && ICONS.TABLE) {
        ICONS.TABLE[IDS.flask] = ['flask', {}]; ICONS.TABLE[IDS.jar] = ['jar', {}]; ICONS.TABLE[IDS.net] = ['spool', {}];
      }
    } catch (e) { /* the fallback icon will do */ }
  }

  // The three throwables are DISTRACTIONS entries while their switch is on (the panel lists exactly those)
  function syncDistractions() {
    if (typeof DISTRACTIONS === 'undefined') return;
    const spec = {
      flask: { name: BAL.flask.name, reach: BAL.flask.reach, hearing: BAL.flask.hearing, duration: BAL.flask.investigate },
      jar: { name: BAL.jar.name, reach: BAL.jar.reach, hearing: 0, duration: 1 },        // hearing 0: nobody comes to look
      net: { name: BAL.net.name, reach: BAL.net.reach, hearing: 0, duration: 1 },
    };
    // always at the end of the list, in the same order, whatever was switched before
    for (const k of KEYS) { const had = !!DISTRACTIONS[IDS[k]]; if (had) delete DISTRACTIONS[IDS[k]]; }
    for (const k of KEYS) if (set[k]) DISTRACTIONS[IDS[k]] = spec[k];
  }
  function addTo(list, entry, match) { if (!list.some(match)) list.push(entry); }
  function removeFrom(list, match) { for (let i = list.length - 1; i >= 0; i--) if (match(list[i])) list.splice(i, 1); }
  // shops, markets, loot, brewing: added when the switch is on, taken away when it is off
  function syncStock() {
    const sh = (id, price, npc) => (typeof NPCS !== 'undefined' && NPCS[npc] && Array.isArray(NPCS[npc].shop)) ? NPCS[npc].shop : null;
    const stock = [
      ['flask', 'vane', BAL.flask.price], ['net', 'vane', BAL.net.price], ['jar', 'bettany', BAL.jar.price],
    ];
    for (const [k, npc, price] of stock) {
      const list = sh(IDS[k], price, npc); if (!list) continue;
      const m = (s) => s && s.item === IDS[k];
      if (set[k]) addTo(list, { item: IDS[k], price }, m); else removeFrom(list, m);
    }
    // the Oakhaven market (js/calendar11.js): vendors carry a pool; three rotate onto the board
    try {
      if (typeof CALENDAR11 !== 'undefined' && CALENDAR11.VENDORS) {
        const pools = { tinker: ['flask', 'net'], odds: ['jar'], larder: ['flask'] };
        for (const v of CALENDAR11.VENDORS) for (const k of (pools[v.key] || [])) {
          const has = v.pool.includes(IDS[k]);
          if (set[k] && !has) v.pool.push(IDS[k]); else if (!set[k] && has) v.pool.splice(v.pool.indexOf(IDS[k]), 1);
        }
      }
    } catch (e) { console.warn('kit12 market failed', e); }
    // strongboxes and what some foes carry
    try {
      if (typeof CACHE !== 'undefined') {
        const w = { 1: { flask: 4, net: 3, jar: 2 }, 2: { flask: 5, net: 4, jar: 3 }, 3: { flask: 4, net: 3, jar: 5 } };
        for (const t of [1, 2, 3]) for (const k of KEYS) {
          const m = (r) => r[0] === IDS[k];
          if (set[k]) addTo(CACHE[t].table, [IDS[k], w[t][k]], m); else removeFrom(CACHE[t].table, m);
        }
      }
      if (typeof LOOT !== 'undefined') {
        const drops = [['outrider', 'net', 9], ['outrider', 'flask', 6], ['hushwarden', 'jar', 9], ['marine', 'net', 40], ['marine', 'flask', 25]];
        for (const [en, k, w] of drops) {
          const m = (r) => r[0] === IDS[k];
          if (!LOOT[en]) { if (set[k] && en === 'marine') LOOT[en] = { chance: 0.35, table: [['sovereigns', 35]], _kit: true }; else continue; }
          if (set[k]) addTo(LOOT[en].table, [IDS[k], w], m); else removeFrom(LOOT[en].table, m);
          if (LOOT[en]._kit && !LOOT[en].table.some(r => MINE.has(r[0]))) delete LOOT[en];
        }
      }
    } catch (e) { console.warn('kit12 loot failed', e); }
    // the Forge's brewing list (js/upgrades.js ALCHEMY_RECIPES)
    try {
      if (typeof ALCHEMY_RECIPES !== 'undefined') {
        const rec = {
          flask: { id: 'p12_flask', name: TXT.brewFlask, req: [['herb_reed', 1], ['empty_bottle', 1]], out: IDS.flask, desc: TXT.brewFlaskDesc },
          net: { id: 'p12_net', name: TXT.brewNet, req: [['herb_reed', 2], ['pebble', 2]], out: IDS.net, desc: TXT.brewNetDesc },
        };
        for (const k of ['flask', 'net']) {
          const m = (r) => r && r.id === rec[k].id;
          if (set[k]) addTo(ALCHEMY_RECIPES, rec[k], m); else removeFrom(ALCHEMY_RECIPES, m);
        }
      }
    } catch (e) { console.warn('kit12 brewing failed', e); }
  }
  function syncAll() { syncDistractions(); syncStock(); for (const k of KEYS) if (!set[k]) endAll(k); }

  // ---- geometry -----------------------------------------------------------------------------------------------
  const here = () => (typeof G !== 'undefined' ? G.mapId : null);
  function inSilence(x, y) {
    for (let i = 0; i < zones.length; i++) { const z = zones[i]; if (z.map === here() && (x - z.x) * (x - z.x) + (y - z.y) * (y - z.y) <= z.r * z.r) return true; }
    return false;
  }
  const playerSilent = () => zones.length > 0 && typeof Engine !== 'undefined' && inSilence(Engine.cam.x, Engine.cam.y);
  const groundAt = (x, y) => { try { const m = G.map; return (m && (m.lvls || m.smooth)) ? m.groundAt(x, y) : 0; } catch (e) { return 0; } };

  // ---- entities (decos) -----------------------------------------------------------------------------------------
  function deco(sprite, x, y, scale, extra) {
    const e = Object.assign({ kind: 'deco', sprite, x, y, scale, solid: false, nopick: true, transient: true, _kit12: true }, extra || {});
    G.ents.push(e); return e;
  }
  function dropEnts(list) {
    for (const e of list) { const i = G.ents ? G.ents.indexOf(e) : -1; if (i >= 0) G.ents.splice(i, 1); const m = G.map && G.map.entities; if (m && m !== G.ents) { const j = m.indexOf(e); if (j >= 0) m.splice(j, 1); } }
    list.length = 0;
  }

  // ================================================================ 1. FIRE
  function startFire(pt) {
    if (!hasG() || !pt) return null;
    buildSprites();
    // water puts it out
    try { if (typeof waterLvl === 'function' && waterLvl(pt.x, pt.y) > 0.25) { say(TXT.flaskWet, 'warn', 4200); return null; } } catch (e) { /* no water */ }
    const B = BAL.flask;
    let dur = B.duration;
    try { if (G.map.outdoor && typeof Weather !== 'undefined' && (Weather.state === 'rain' || Weather.state === 'storm')) dur *= B.rain; } catch (e) { /* dry */ }
    // the oldest fire on this map goes out when a fourth would start
    const mine = fires.filter(f => f.map === here());
    if (mine.length >= B.maxFires) endFire(mine[0], true);
    const f = { x: pt.x, y: pt.y, map: here(), left: dur, dur, r: B.radius, ents: [], light: null, acc: 0, smoke: 0, tick: B.tick, dealt: new Map(), crackle: 0 };
    const spots = [[0, 0, 0.72], [0.55, 0.15, 0.58], [-0.55, 0.3, 0.56], [0.1, -0.55, 0.52], [-0.15, 0.6, 0.5]];
    for (const [dx, dy, sc] of spots) {
      const e = deco('p12_flames', f.x + dx, f.y + dy, sc, { glow: 0.9, label: 'A patch of burning oil' });
      if (!f.light) { f.light = e; e.lightCol = B.light.slice(); }
      f.ents.push(e);
    }
    fires.push(f);
    // the splash: foes right there are burnt at once
    for (const e of G.ents) if (alive(e) && (e.x - f.x) ** 2 + (e.y - f.y) ** 2 < f.r * f.r) burn(f, e, B.burst);
    return f;
  }
  function endFire(f, quiet) {
    const i = fires.indexOf(f); if (i >= 0) fires.splice(i, 1);
    dropEnts(f.ents);
    if (!quiet && f.map === here()) say(TXT.flaskGone, 'info', 2600);
  }
  // damage to one foe from one fire; fractions accumulate so nothing is lost to rounding
  function burn(f, e, raw) {
    const kind = classify(e), B = BAL.flask, m = B.mult[kind];
    if (kind === 'hush') { if (!f.hushSaid) { f.hushSaid = true; say(TXT.fireHush, 'info', 3000); } return 0; }
    e._p12acc = (e._p12acc || 0) + raw * m;
    let dmg = Math.floor(e._p12acc); if (dmg < 1) return 0;
    e._p12acc -= dmg;
    const done = f.dealt.get(e) || 0;
    const cap = kind === 'boss' ? Math.min(B.capPerFoe, Math.ceil((e.hpMax || e.def.hp) * B.bossCapFrac)) : B.capPerFoe;
    dmg = Math.min(dmg, cap - done); if (dmg <= 0) return 0;
    f.dealt.set(e, done + dmg);
    e.hp -= dmg; stats.burnTicks++;
    try { if (typeof HUD11 !== 'undefined' && HUD11.addNumber) { if (GFX.enemyBars) HUD11.recent.set(e, HUD11.clock + 2.5); HUD11.addNumber('hit', dmg, e); } } catch (err) { /* cosmetic */ }
    // a burnt foe that did not know of you goes to look at the fire, not at you
    if (e.hp > 0 && (e.state === 'idle' || e.state === 'passive') && !e.passive) { e.investigation = { x: f.x, y: f.y, left: 6 }; e.state = 'investigate'; }
    if (e.hp <= 0) { stats.kills++; try { killEnemy(e, false); } catch (err) { console.warn('kit12 kill failed', err); } }
    return dmg;
  }
  function tickFires(dt) {
    const B = BAL.flask;
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      if (f.map !== here()) { endFire(f, true); continue; }
      f.left -= dt;
      if (f.left <= 0) { endFire(f); continue; }
      // the last seconds: it shrinks, the light dims
      const k = f.left < B.fade ? f.left / B.fade : 1;
      f.r = B.radius * (0.53 + 0.47 * k);
      if (f.light) f.light.lightCol = B.light.map(v => Math.round(v * (0.35 + 0.65 * k)));
      for (let j = 0; j < f.ents.length; j++) { const e = f.ents[j]; e.glow = 0.9 * k; e.scale = e._s0 || (e._s0 = e.scale); e.scale = e._s0 * (0.5 + 0.5 * k); }
      // smoke through firesmoke's own particle pool (its generator, gated by its own switch)
      f.smoke += dt * 5;
      while (f.smoke >= 1) {
        f.smoke -= 1;
        try {
          if (typeof FIRESMOKE !== 'undefined' && FIRESMOKE.spawn && GFX.smoke) {
            const g = groundAt(f.x, f.y), a = prnd() * 6.283, d = prnd() * f.r * 0.6;
            FIRESMOKE.spawn(0, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, g + 0.5, 0, 0, 0.8, 2.6, 0.06, 0.3, 0.4, 1, g + 2.6);
          }
        } catch (e) { /* cosmetic */ }
      }
      // burn on the tick
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick += B.tick;
        const raw = B.dps * B.tick;
        for (const e of G.ents) if (alive(e) && (e.x - f.x) ** 2 + (e.y - f.y) ** 2 < f.r * f.r) burn(f, e, raw);
        // the fire is no safer for you: stand in it and you burn too
        if (hasG() && !G.dead && G.state === 'play') {
          const c = Engine.cam;
          if ((c.x - f.x) ** 2 + (c.y - f.y) ** 2 < f.r * f.r) { try { damagePlayer(2, 'The fire'); } catch (e) { /* ignore */ } }
        }
      }
    }
    // crackle: near a fire you are heard (the Narrow's floor rises while you stand by it)
    if (fires.length && hasG()) {
      const c = Engine.cam, R = B.crackleRange;
      for (const f of fires) if (f.map === here() && (c.x - f.x) ** 2 + (c.y - f.y) ** 2 < R * R && !inSilence(f.x, f.y) && !playerSilent()) { G.noise = Math.max(G.noise, B.crackle); break; }
    }
  }
  // a foe that is afraid of fire and stands in it flees outward (the solidAt wrapper lets it move only outward)
  function fleeCheck(e, dt) {
    if (!scared(e)) return false;
    for (const f of fires) {
      if (f.map !== here()) continue;
      const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
      if (d < f.r - 0.02) {
        const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0, sp = (e.def.speed || 1) * BAL.flask.flee * dt;
        if (typeof moveWithSlide === 'function') moveWithSlide(e, nx * sp, ny * sp, e);
        return true;
      }
    }
    return false;
  }

  // ================================================================ 2. SILENCE
  function startZone(pt) {
    if (!hasG() || !pt) return null;
    buildSprites();
    const B = BAL.jar;
    while (zones.length) endZone(zones[0], true);          // one at a time
    const z = { x: pt.x, y: pt.y, map: here(), left: B.duration, r: B.radius, ents: [], was: false };
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + prnd() * 0.2, rr = B.radius * (0.82 + prnd() * 0.1);
      z.ents.push(deco('p12_tuft', z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 0.3 + prnd() * 0.1, { yOff: 0.3, glow: 0.6, label: 'A tuft of grey wool-fat' }));
    }
    zones.push(z);
    wrapSfx();
    return z;
  }
  function endZone(z, quiet) {
    const i = zones.indexOf(z); if (i >= 0) zones.splice(i, 1);
    dropEnts(z.ents);
    if (!quiet && z.map === here()) say(TXT.jarGone, 'info', 2600);
    updateAudio(true);
  }
  function tickZones(dt) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (z.map !== here()) { endZone(z, true); continue; }
      z.left -= dt;
      if (z.left <= 0) { endZone(z); continue; }
    }
    if (zones.length) {
      for (const z of zones) for (const e of z.ents) e.alpha = 1;
      // the player inside: the Narrow is held under its floor and the Hush's clock is capped (it never unwrites you)
      if (playerSilent()) {
        G.noise = Math.min(G.noise, BAL.jar.noiseCap);
        if (G.stillT > BAL.jar.stillCap) G.stillT = BAL.jar.stillCap;
      }
    }
    updateAudio(false);
    updateBadge();
  }
  // the sound bus: muted while you stand in a zone, restored the moment you step out (or it ends)
  function updateAudio(force) {
    const want = playerSilent();
    if (want === audioOn && !force) return;
    audioOn = want;
    try {
      if (typeof Audio_ !== 'undefined' && Audio_.ctx && Audio_.sfxBus && Audio_.sfxBus.gain) {
        const g = Audio_.sfxBus.gain, t = Audio_.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(want ? 0.0001 : 1, t + (want ? 0.12 : 0.25));
      }
    } catch (e) { /* no audio */ }
    if (want) stats.muted++;
  }
  // sounds that have a place in the world are swallowed while you or their maker stand in the quiet. This also keeps
  // the sound ripples and captions honest: they only ever see sounds that were made.
  const SFX_NAMES = ['enemy', 'bell', 'bellDie', 'hound', 'golem', 'press', 'bow', 'shot', 'song', 'crack', 'voice', 'swing', 'hit', 'hurt', 'glasshit', 'fifth', 'murmur', 'quiet', 'bird', 'rat', 'door'];
  function wrapSfx() {
    if (wrappedSfx || typeof Audio_ === 'undefined' || !Audio_.sfx) return;
    wrappedSfx = true;
    for (const name of SFX_NAMES) {
      const orig = Audio_.sfx[name]; if (typeof orig !== 'function') continue;
      Audio_.sfx[name] = function () {
        if (zones.length && (playerSilent() || (cur && inSilence(cur.x, cur.y)))) { stats.muted++; return undefined; }
        return orig.apply(this, arguments);
      };
    }
  }
  // the badge: a small pill so the quiet is visible as well as silent
  let badge = null;
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('kit12-style')) return;
    const st = document.createElement('style'); st.id = 'kit12-style';
    st.textContent = '#p12k-badge{position:absolute;left:50%;top:2.2cqh;transform:translateX(-50%);z-index:30;padding:.35cqh 1.4cqw;border:1px solid rgba(190,190,186,.6);border-radius:2cqh;background:rgba(20,20,22,.72);color:#d8d8d2;font-family:var(--font-sc,serif);font-size:2.6cqh;letter-spacing:.08em;pointer-events:none;display:none}' +
      '#p12k-badge.on{display:block}';
    document.head.appendChild(st);
  }
  function updateBadge() {
    if (typeof document === 'undefined') return;
    if (!badge) { const host = document.getElementById('game'); if (!host) return; injectStyle(); badge = document.createElement('div'); badge.id = 'p12k-badge'; badge.setAttribute('role', 'status'); badge.setAttribute('aria-live', 'polite'); host.appendChild(badge); }
    const z = zones.find(q => q.map === here());
    const show = !!z && playerSilent();
    if (show) { const s = fmt(TXT.badge, Math.ceil(z.left)); if (badge.textContent !== s) badge.textContent = s; badge.setAttribute('aria-label', TXT.badgeAria); }
    badge.classList.toggle('on', show);
  }

  // ================================================================ 3. NETS
  function netTarget() {
    const c = Engine.cam, dx = Math.cos(c.dir), dy = Math.sin(c.dir), B = BAL.net;
    for (let d = 0.3; d <= B.reach; d += 0.1) {
      const x = c.x + dx * d, y = c.y + dy * d;
      if (G.map.isSolidCell(Math.floor(x), Math.floor(y))) return null;
      for (const e of G.ents) if (e.kind === 'enemy' && !e.dead && !e.hidden && e.def && (x - e.x) ** 2 + (y - e.y) ** 2 < ((e.radius || 0.35) + B.hit) ** 2) return { e, d };
    }
    return null;
  }
  function pinFoe(e) {
    const B = BAL.net, size = sizeOf(e);
    if (size === 'large') { e._p12slow = B.slowLarge; if (!pinned.includes(e)) pinned.push(e); return 'slow'; }
    e._p12net = size === 'small' ? B.pinSmall : B.pinMedium;
    e._p12netEnt = deco('p12_net', e.x, e.y, (e.scale || 1) * 0.9, { label: 'A weighted net' });
    if (!pinned.includes(e)) pinned.push(e);
    stats.pins++;
    return 'pin';
  }
  function releaseFoe(e, torn) {
    if (e._p12netEnt) { const i = G.ents ? G.ents.indexOf(e._p12netEnt) : -1; if (i >= 0) G.ents.splice(i, 1); e._p12netEnt = null; }
    if (e._p12net > 0 || torn) { e._p12net = 0; e._p12reNet = T + BAL.net.reNet; if (torn && alive(e) && hasG() && G.mapId === here()) say(fmt(TXT.netFree, TheNameOf(e)), 'info', 2600); }
    e._p12slow = 0;
    const i = pinned.indexOf(e); if (i >= 0) pinned.splice(i, 1);
  }
  function tickPins(dt) {
    for (let i = pinned.length - 1; i >= 0; i--) {
      const e = pinned[i];
      if (!alive(e)) { releaseFoe(e, false); continue; }
      const ne = e._p12netEnt;
      if (e._p12net > 0) {
        e._p12net -= dt;
        if (ne) {
          // the net hangs on the foe, one hand toward you so it draws over it, and shudders as it struggles
          const c = Engine.cam, dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy) || 1, sh = (GFX && GFX.reduceMotion) ? 0 : Math.sin(T * 17 + e.x) * 0.03;
          ne.x = e.x + dx / d * 0.12 + sh; ne.y = e.y + dy / d * 0.12;
        }
        if (e._p12net <= 0) releaseFoe(e, true);
      } else if (e._p12slow > 0) {
        // (the slow itself is applied in the enemyUpdate wrapper, which also counts it down)
      } else releaseFoe(e, false);
    }
  }

  // The net is thrown by this module (it needs a target, not a landing point) but uses the same inventory and
  // throw-gap handling as throwDistraction.
  function throwNet() {
    const B = BAL.net, id = IDS.net;
    if (G.state !== 'play' || G.dead) return false;
    if (!set.net) { say(TXT.off, 'warn', 2400); return false; }
    if (!G.has(id)) { say('You have none of those left.', 'warn'); return false; }
    if (G.time < (G.throwReady || 0) || T < netReady) { say(TXT.netWait, 'warn', 1600); return false; }
    const hit = netTarget();
    if (!hit) { say(TXT.netNone, 'warn', 2600); return false; }
    const e = hit.e, kind = classify(e);
    if (kind === 'hush') { say(TXT.netHush, 'warn', 3200); return false; }
    if (kind === 'boss') { say(fmt(TXT.netBoss, theNameOf(e)), 'warn', 3200); return false; }
    if (e._p12net > 0) { say(fmt(TXT.netAlready, TheNameOf(e)), 'warn', 2600); return false; }
    if ((e._p12reNet || 0) > T) { say(fmt(TXT.netFrayed, theNameOf(e)), 'warn', 3200); return false; }
    if (e._p12slow > 0) { say(fmt(TXT.netAlready, TheNameOf(e)), 'warn', 2600); return false; }
    try { exposeDisguise('A patrol sees you throw a net.'); } catch (err) { /* no disguise */ }
    G.take(id); G.throwReady = G.time + 0.75; netReady = T + B.cooldown;
    if (!playerSilent()) addNoise(B.noise);
    const r = pinFoe(e);
    if (e.state === 'idle' || e.state === 'investigate') { delete e.investigation; e.state = 'chase'; e.alertT = 8; }   // being netted is an attack: it knows you are there
    stats.throws.net++;
    say(fmt(r === 'pin' ? TXT.netHit : TXT.netBig, theNameOf(e)), 'good', 3600);
    try { Audio_.sfx.step('stone'); } catch (err) { /* silent */ }
    return true;
  }

  // ================================================================ the throw wrapper
  const isMine = (id) => MINE.has(id);
  function installThrow() {
    if (typeof throwDistraction !== 'function') return;
    const _t = throwDistraction;
    throwDistraction = function (id) {
      // stones and bottles: listeners standing in a quiet, or a landing inside one, hear nothing
      if (!isMine(id)) {
        if (!zones.length || G.state !== 'play') return _t.apply(this, arguments);
        let pt = null; try { pt = distractionImpact(id); } catch (e) { pt = null; }
        return muteListeners(pt, () => _t.apply(this, arguments));
      }
      if (id === IDS.net) return throwNet();
      const k = id === IDS.flask ? 'flask' : 'jar';
      if (!set[k]) { say(TXT.off, 'warn', 2400); return false; }
      if (G.state !== 'play' || G.dead) return false;
      let pt = null; try { pt = distractionImpact(id); } catch (e) { pt = null; }    // a read-only ray: the same one the throw uses
      if (G.has(id) && G.time >= (G.throwReady || 0) && pt) {
        if (k === 'flask' && T < flaskReady) { say(TXT.flaskWait, 'warn', 1800); return false; }
        if (k === 'jar' && T < jarReady) { say(TXT.jarWait, 'warn', 2200); return false; }
        if (k === 'flask' && pt.distance < BAL.flask.minThrow) { say(TXT.flaskClose, 'warn', 2800); return false; }
      }
      // the original does the rest (checks, take, the gap, the listeners); its sentence is replaced with ours
      const _m = msg; let done = false;
      msg = function (text, cls, ms) {
        if (!done && typeof text === 'string' && text.indexOf(BAL[k].name + ':') === 0) {
          done = true; text = k === 'flask' ? fmt(TXT.flaskHit, pt ? pt.distance.toFixed(1) : '?') : fmt(TXT.jarHit, pt ? pt.distance.toFixed(1) : '?'); ms = 4200;
        }
        return _m.call(this, text, cls, ms);
      };
      const before = G.count(id);
      let r;
      try { r = muteListeners(pt, () => _t.apply(this, arguments)); } finally { msg = _m; }
      if (r && pt && G.count(id) < before) {
        if (k === 'flask') {
          stats.throws.flask++; flaskReady = T + BAL.flask.cooldown;
          const quiet = inSilence(pt.x, pt.y) || playerSilent();
          if (!quiet) { addNoise(BAL.flask.noiseThrow); try { Audio_.sfx.crack(); } catch (e) { /* silent */ } }
          const f = startFire(pt);
          if (f) lawCheck();
        } else {
          stats.throws.jar++; jarReady = T + BAL.jar.cooldown;
          startZone(pt);
        }
      }
      return r;
    };
  }
  // listeners the original loop would wake are set aside for the call when the landing or they are in a quiet
  function muteListeners(pt, fn) {
    if (!zones.length) return fn();
    const set2 = [], landing = pt && inSilence(pt.x, pt.y);
    for (const e of G.ents) if (!e.hidden && (e.kind === 'enemy' || e.lawGuard) && (landing || inSilence(e.x, e.y))) { e.hidden = true; set2.push(e); }
    try { return fn(); } finally { for (const e of set2) e.hidden = false; }
  }
  // fire in the street: a crime if anyone who could report it saw you do it
  function lawCheck() {
    try {
      if (typeof lawActive !== 'function' || !lawActive() || typeof theftWitness !== 'function') return;
      if (theftWitness(null)) { stats.crimes++; reportCrime('a fire set in the street', BAL.flask.crime); say(TXT.flaskSeen, 'bad', 4200); }
    } catch (e) { console.warn('kit12 law failed', e); }
  }

  // ================================================================ wiring
  function wrapGlobals() {
    if (typeof solidAt === 'function') {
      const _s = solidAt;
      solidAt = function (x, y, self) {
        if (fires.length && !(self && self.kind === 'enemy' && !scared(self))) {
          const c = Engine.cam, mine = here();
          for (let i = 0; i < fires.length; i++) {
            const f = fires[i]; if (f.map !== mine) continue;
            const nd2 = (x - f.x) * (x - f.x) + (y - f.y) * (y - f.y);
            if (nd2 < f.r * f.r) {
              const sx = self ? self.x : c.x, sy = self ? self.y : c.y;
              if (nd2 < (sx - f.x) * (sx - f.x) + (sy - f.y) * (sy - f.y) - 1e-6) return true;     // closer to the flames: no
            }
          }
        }
        return _s(x, y, self);
      };
    }
    if (typeof enemyUpdate === 'function') {
      const _eu = enemyUpdate;
      enemyUpdate = function (e, dt) {
        if (!live() || !e || e.dead || e.hidden) return _eu.apply(this, arguments);
        const prev = cur; cur = e;
        try {
          if (e._p12net > 0) return undefined;                               // pinned: the tick counts it down
          let d2 = dt;
          if (e._p12slow > 0) { e._p12slow -= dt; d2 = dt * BAL.net.slowMult; if (e._p12slow <= 0) { e._p12reNet = T + BAL.net.reNet; } }
          if (fires.length && fleeCheck(e, dt)) return undefined;
          if (zones.length && inSilence(e.x, e.y)) {
            // a foe inside the quiet hears nothing: the Narrow is below zero for its update (sight is untouched)
            const n = G.noise; G.noise = -3;
            try { return _eu.call(this, e, d2); } finally { G.noise = n; }
          }
          return _eu.call(this, e, d2);
        } finally { cur = prev; }
      };
    }
    // the Songs: nothing carries inside a quiet (no voice spent, no Dissonance gained, nothing heard)
    if (typeof castSong === 'function') {
      const _cs = castSong;
      castSong = function () { if (zones.length && hasG() && playerSilent()) { stats.muted++; say(TXT.songSilenced, 'warn', 3200); return undefined; } return _cs.apply(this, arguments); };
    }
    if (typeof executeCustomSong === 'function') {
      const _ec = executeCustomSong;
      executeCustomSong = function () { if (zones.length && hasG() && playerSilent()) { stats.muted++; say(TXT.songSilenced, 'warn', 3200); return undefined; } return _ec.apply(this, arguments); };
    }
    // nothing here outlives the map it was made on
    if (typeof loadMap === 'function') {
      const _lm = loadMap;
      loadMap = function () {
        try { endAll(); } catch (e) { /* nothing to clear */ }
        const r = _lm.apply(this, arguments);
        try { updateAudio(true); updateBadge(); } catch (e) { /* cosmetic */ }
        return r;
      };
    }
    if (typeof update === 'function') {
      const _up = update;
      update = function (dt) {
        const r = _up.apply(this, arguments);
        try {
          if (dt > 0 && hasG() && G.state === 'play') {
            T += dt;
            if (fires.length) tickFires(dt);
            if (pinned.length) tickPins(dt);
            if (zones.length || audioOn) tickZones(dt);
          } else if (audioOn && !(hasG() && G.state === 'panel')) { updateAudio(false); }
        } catch (e) { stats.errors++; console.warn('kit12 tick failed', e); }
        return r;
      };
    }
    // the Narrow: inside a quiet it is floored before anything reads it this frame
    if (typeof updateNarrow === 'function') {
      const _un = updateNarrow;
      updateNarrow = function () {
        const r = _un.apply(this, arguments);
        try { if (zones.length && playerSilent()) { G.noise = Math.min(G.noise, BAL.jar.noiseCap); if (G.stillT > BAL.jar.stillCap) G.stillT = BAL.jar.stillCap; } } catch (e) { /* ignore */ }
        return r;
      };
    }
    // a new game / a loaded save: clamp what a hostile save could carry, drop any flags of ours
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () {
        const r = _rg.apply(this, arguments);
        try { sanitize(); } catch (e) { console.warn('kit12 sanitize failed', e); }
        return r;
      };
    }
    // a stack limit for the three (loot and brewing clamp; the shops grey the row)
    if (typeof G !== 'undefined' && typeof G.give === 'function') {
      const _give = G.give;
      G.give = function (id, n) {
        if (!isMine(id)) return _give.apply(this, arguments);
        const cap = capOf(id), have = this.count(id), room = Math.max(0, cap - have);
        const take = Math.min(n || 1, room);
        if (take < (n || 1)) say(fmt(TXT.packFull, cap), 'warn', 3000);
        if (take > 0) return _give.call(this, id, take);
        return undefined;
      };
    }
    // controls: keys 4-9 and the pad's shoulders in the throw panel, and the panel's own hint line
    if (typeof openDistractions === 'function') {
      const _od = openDistractions;
      openDistractions = function () {
        const r = _od.apply(this, arguments);
        try { decoratePanel(); } catch (e) { console.warn('kit12 panel failed', e); }
        return r;
      };
    }
    window.addEventListener('keydown', (ev) => {
      if (typeof G === 'undefined' || G.openPanel !== 'distractions' || ev.repeat) return;
      const n = /^[4-9]$/.test(String(ev.key)) ? +ev.key : 0; if (!n) return;
      const id = Object.keys(DISTRACTIONS)[n - 1];
      if (id && isMine(id)) { const b = document.getElementById('throw-' + id); if (b) { ev.preventDefault(); ev.stopImmediatePropagation(); b.click(); } }
    }, true);
    if (typeof controlsTick === 'function') {
      const _ct = controlsTick;
      const prev = [false, false, false];
      controlsTick = function () {
        const r = _ct.apply(this, arguments);
        try {
          const g = padNow(), btn = (i) => !!(g && g.buttons[i] && g.buttons[i].pressed);
          const now = [btn(4), btn(5), btn(6)], ids = [IDS.flask, IDS.jar, IDS.net];
          for (let i = 0; i < 3; i++) {
            if (now[i] && !prev[i] && G.openPanel === 'distractions') { const b = document.getElementById('throw-' + ids[i]); if (b && !b.disabled) b.click(); }
            prev[i] = now[i];
          }
        } catch (e) { /* no pad */ }
        return r;
      };
    }
    // the shops: a row for something you cannot carry more of is greyed
    if (typeof renderDialogue === 'function') {
      const _rd = renderDialogue;
      renderDialogue = function () {
        const r = _rd.apply(this, arguments);
        try {
          if (DLG && DLG.npc && DLG.npc.shop) document.querySelectorAll('[data-buy]').forEach(b => {
            const e = DLG.npc.shop[+b.dataset.buy];
            if (e && isMine(e.item) && G.count(e.item) >= capOf(e.item)) { b.disabled = true; b.title = fmt(TXT.packFull, capOf(e.item)); const s = b.querySelector('span'); if (s) s.textContent = TXT.packFullShort; }
          });
        } catch (e) { console.warn('kit12 shop failed', e); }
        return r;
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('kit12 rows failed', e); }
        return r;
      };
    }
  }
  function padNow() {
    try { const ps = navigator.getGamepads ? navigator.getGamepads() : null; if (ps) for (const g of ps) if (g && g.connected !== false) return g; } catch (e) { /* no pad */ }
    return null;
  }
  const capOf = (id) => { for (const k of KEYS) if (IDS[k] === id) return BAL[k].stack; return 99; };
  function sanitize() {
    if (typeof G === 'undefined' || !G.player) return;
    if (G.flags && typeof G.flags === 'object') for (const k of Object.keys(G.flags)) if (k.indexOf('p12k_') === 0) delete G.flags[k];
    if (Array.isArray(G.player.inv)) {
      G.player.inv = G.player.inv.filter(s => !(s && isMine(s.id)) || (Number.isFinite(+s.n) && +s.n >= 1));
      for (const s of G.player.inv) if (s && isMine(s.id)) s.n = clamp(Math.floor(+s.n), 1, capOf(s.id));
      // a save can hold several rows of one id; they become one, within the stack limit
      for (const id of MINE) {
        const rows = G.player.inv.filter(s => s && s.id === id);
        if (rows.length > 1) { const total = Math.min(capOf(id), rows.reduce((a, s) => a + s.n, 0)); rows[0].n = total; for (const s of rows.slice(1)) G.player.inv.splice(G.player.inv.indexOf(s), 1); }
      }
    }
  }
  // end everything (all of one kind when a switch goes off, or all of it on a map change)
  function endAll(kind) {
    if (!kind || kind === 'flask') while (fires.length) endFire(fires[0], true);
    if (!kind || kind === 'jar') while (zones.length) endZone(zones[0], true);
    if (!kind || kind === 'net') for (const e of pinned.slice()) releaseFoe(e, false);
    if (!kind) { flaskReady = jarReady = netReady = 0; }
    if (!zones.length) { audioOn = false; updateAudio(true); }
    // anything of ours still left in the entity list (a switch change mid-frame) goes too
    if (typeof G !== 'undefined' && G.ents) for (let i = G.ents.length - 1; i >= 0; i--) if (G.ents[i]._kit12 && (!kind || (kind === 'flask' && G.ents[i].sprite === 'p12_flames') || (kind === 'jar' && G.ents[i].sprite === 'p12_tuft') || (kind === 'net' && G.ents[i].sprite === 'p12_net'))) G.ents.splice(i, 1);
  }

  // ---- the throw panel ------------------------------------------------------------------------------------------
  function decoratePanel() {
    if (G.openPanel !== 'distractions') return;
    const hint = document.querySelector('#modal-panel p.muted:last-of-type');
    const ids = Object.keys(DISTRACTIONS);
    // the panel's own sentence says nothing ever deals damage; a flask does
    if (ids.some(isMine)) { const first = document.querySelector('#modal-panel > p, #modal-panel p'); if (first && first.textContent.indexOf('it never deals damage.') >= 0) first.textContent = first.textContent.replace('it never deals damage.', TXT.panelDamage); }
    // static sentences (so the French catalogue can match them): the full list when all three are on, a generic line otherwise
    const all = KEYS.every(k => set[k]), lure = ids.includes('p9_reed_lure');
    let text = TXT.hintGeneric;
    if (all && lure) text = TXT.hintLure; else if (all && ids.length === 5) text = TXT.hintNoLure;
    if (hint && ids.some(isMine)) hint.textContent = text;
  }

  // ---- Options --------------------------------------------------------------------------------------------------
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('p12k-head')) return;
    const el = (tag, props, text) => { const e = document.createElement(tag); if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); } if (text != null) e.textContent = text; return e; };
    grid.appendChild(el('span', { id: 'p12k-head', style: 'grid-column:1/-1;margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em' }, TXT.optHead));
    const rows = [['flask', TXT.optFlask, TXT.optFlaskHint], ['jar', TXT.optJar, TXT.optJarHint], ['net', TXT.optNet, TXT.optNetHint]];
    for (const [k, label, hintText] of rows) {
      const lab = el('span', { class: 'gfx-label' }, label); lab.appendChild(document.createTextNode(' ')); lab.appendChild(el('small', { class: 'muted' }, hintText));
      const b = el('button', { class: 'dfbtn small', id: 'p12k-' + k, type: 'button' }, '');
      const sync = () => { b.textContent = set[k] ? TXT.on : TXT.off2; b.setAttribute('aria-pressed', set[k] ? 'true' : 'false'); b.classList.toggle('sel', set[k]); };
      b.setAttribute('aria-label', label);
      b.onclick = () => { setSwitch(k, !set[k]); sync(); };
      sync(); grid.appendChild(lab); grid.appendChild(b);
    }
  }
  function setSwitch(k, on) {
    if (!(k in set)) return;
    set[k] = !!on; saveSet();
    syncDistractions(); syncStock();
    if (!on) endAll(k);
  }

  // ---- init -----------------------------------------------------------------------------------------------------
  loadSet();
  try { defineItems(); buildSprites(); syncAll(); } catch (e) { console.warn('kit12 setup failed', e); }
  try { installThrow(); wrapGlobals(); } catch (e) { console.warn('kit12 wiring failed', e); }

  return {
    BAL, IDS, TXT, set, stats, fires, zones, pinned,
    classify, sizeOf, scared, inSilence, playerSilent, setSwitch, syncAll, sanitize, endAll, startFire, startZone, throwNet, burn, capOf,
    get clock() { return T; }, set clock(v) { T = v; },
    get audioMuted() { return audioOn; },
    resetCooldowns() { flaskReady = jarReady = netReady = 0; },
  };
})();
if (typeof window !== 'undefined') window.KIT12 = KIT12;
