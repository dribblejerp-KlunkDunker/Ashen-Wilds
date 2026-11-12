// ============================================================
//  props14 — Phase 14 "A world that shows the story", team PROPS.
//
//  1. MIRRORS (switch "Mirrors", GFX.p14pMirrors). Five interior wall faces carry a framed mirror (table MIRRORS): the
//     Wick house, the vestry of the Cloister, the Tarrows' front room and Lyra's house. The reflection is a real, small
//     ray-cast done in a post hook, only into the mirror's rectangle, only for the columns the mirror covers:
//       * the room behind you, seen from the mirror's own plane: for each column the ray is bounced off the mirror, walked
//         across the map grid (a short DDA), and each row is solved for wall / floor / ceiling exactly as the engine does,
//         so the lamps, beds and people of the room are in it too (their sprites are re-projected from the reflected
//         camera, hidden behind anything that stands in front of the mirror, exactly like the engine's depth test);
//       * the player: a small figure painted from what is worn (armour material colours as the paper doll, the readied
//         weapon, a shield, the helm) standing where the reflected eye is. It lifts its arm when you swing.
//     Measured cost: PROPS14.stats.mirrorMs (reported by test/props14.test.js).
//     THE THING BEHIND YOU. Rarely, and only in three haunted rooms (MIRRORS[].haunt), something stands behind you in the
//     reflection that is not there when you turn: a dark shape (soft, no features, never clear) or one lamp missing from
//     the reflected room. It is a drawing in the mirror only: never an entity, never in G.ents, no AI, no collision, no
//     sound, nothing saved. Rules (all deterministic, see decide()):
//       - never when NERVES13.scaresAllowed() === 'off'; slower and fainter on 'gentle' than on 'full'; nothing sudden;
//       - a chance of BAL.baseP once per approach (an approach = a stretch of looking at the mirror from inside BAL.watchR
//         and in front of it for a few seconds), seeded by map + mirror + approach number + day. With Dread on the chance
//         is multiplied by 1 + Dissonance / BAL.dreadK (cap BAL.maxP);
//       - it fades at once (0.35 s) when you turn away, walk off, come within 0.9 of where it stands, or any switch
//         goes off. After it has been seen it is gone for that approach: turning back shows nothing. "The Hush is never
//         shown": it is a missing, not a creature.
//  2. SEALED DOORS SHIMMER (switch "Sealed doors", GFX.p14pShimmer). Doors that story or magic holds shut (table SEALS)
//     carry a thin shimmering membrane drawn onto the door leaf, tinted by kind: glass cyan, song gold, Synod white,
//     Hush grey (the grey one is a dulling, not a glow). It clears when the door is unlocked (a 1.2 s fade) and at once
//     when the leaf starts to open. No flashes: a still tint. Reduce motion: the ripple runs at a quarter speed.
//  3. BREAKABLE BARRELS AND CRATES (switch "Breakables", GFX.p14pBreak). A melee blow smashes the scenery barrels and
//     crates (js/scenery.js props, `_scn` 'barrel'|'crate' ONLY: nothing placed by a story map, no prop with a `use`, a
//     label from a quest or children in it is ever touched). Hits needed = ceil(HP / power) where power is the weapon's
//     average damage + Strength/25 (blunt x1.5, cleaving x1.25) and HP is 7 for a barrel, 9 for a crate: a mace, an axe or
//     a sword breaks a barrel in one; bare hands need three. The prop becomes a few drawn pieces that fall and settle
//     (current visit: leaving the map sweeps them) and a low heap that never blocks (the prop is removed, the pieces
//     are not solid). Noise like a dropped item: addNoise(BAL.noise). Sometimes loot (LOOT): an own seeded stream by
//     map + position, never Math.random, so the same barrel always holds the same thing; small common things only.
//     In town (js/law, lawActive()) a crate is owned: smashing one in view of someone who would report a theft
//     (theftWitness) is a crime like theft: +BAL.fine bounty and one theft on the record.
//     PERSISTENCE: per visit only. Nothing is saved; no p14p_ flag is written; loading a game puts the props back.
//
//  Off = identical frames and play: every hook returns at once when its GFX flag is false (GFX.plain() turns all three
//  off; the Original preset turns them off; the Low preset turns mirrors and shimmer off, being per-frame).
//  Procedural stand-in art: the figure, the shade, the debris and the heaps are drawn in code and cached once.
//  No Math.random anywhere in this file.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  for (const k of ['p14pMirrors', 'p14pShimmer', 'p14pBreak']) {
    if (GFX[k] === undefined) GFX[k] = true;
    if (GFX.FX && !GFX.FX.includes(k)) GFX.FX.push(k);
  }
}

const PROPS14 = (() => {
  // ---- the one balance table --------------------------------------------------------------------------------------
  const BAL = {
    baseP: 0.07,              // chance of the thing in the mirror per approach
    dreadK: 30, maxP: 0.4,    // Dread on: p x (1 + Dissonance / dreadK), capped
    watchR: 6.5, watchCone: 0.5, // cells; radians off the line to the mirror
    delayMin: 2.2, delayMax: 5.0, // seconds of looking before the chance is rolled
    gentle: { rise: 3.2, hold: 2.4, fall: 1.5, max: 0.5 },
    full: { rise: 1.8, hold: 2.2, fall: 1.0, max: 0.72 },
    quickFade: 0.35, nearSpot: 0.9, farEpisode: 8,
    hp: { barrel: 7, crate: 9 },         // wood hit points
    chance: { barrel: 0.30, crate: 0.40 }, // some loot inside
    noise: 1.6, noisePart: 0.9, fine: 20, debris: 5, maxDebris: 60,
    fadeSeal: 1.2,
  };
  // what may be inside (existing items only; never gear, never a quest item): [id, weight, min, max]
  const LOOT = {
    barrel: [['sovereigns', 30, 3, 7], ['tonic', 20], ['honey', 20], ['v_scrap', 10]],
    crate: [['sovereigns', 30, 3, 9], ['v_scrap', 16], ['pellets', 14], ['bolts', 12], ['tonic', 10], ['honey', 8]],
  };
  // the tall glass: wall cell, which way the face looks, whether the thing may stand behind you
  const MIRRORS = [
    { id: 'wick', map: 'wickhouse', cx: 0, cy: 6, face: 'e', haunt: true },
    { id: 'vestry', map: 'cloister', cx: 0, cy: 12, face: 'e', haunt: true },
    { id: 'tarrow', map: 'p13h_tarrow', cx: 1, cy: 7, face: 's', haunt: true },
    { id: 'lyra', map: 'lyra_house', cx: 7, cy: 0, face: 's', haunt: false },
  ];
  // doors that story or magic hold shut (the lock flag in the door's own cell decides when it clears)
  const SEALS = [
    { map: 'catacombs', x: 27, y: 1, kind: 'glass' },          // the prismatic reliquary gate (Light-glass seal)
    { map: 'mausoleum', x: 19, y: 15, kind: 'song' },          // the bronze choir door, four stopped bells
    { map: 'greenroot_crypt', x: 13, y: 18, kind: 'song' },    // the passing gate: rung down in order
    { map: 'whispergrove', x: 32, y: 5, kind: 'synod' },       // the Malting's Office seal
    { map: 'quarry', x: 20, y: 14, kind: 'synod' },            // the shaft gate's seal-lock over the bore
    { map: 'greenroot', x: 30, y: 8, kind: 'hush' },           // the chapel door held shut from inside
  ];
  const KIND_COL = { glass: [70, 220, 210], song: [235, 190, 80], synod: [235, 238, 245], hush: [140, 140, 140] };
  const KEY = 'octave.props14.v1';
  const set = { mirrors: true, shimmer: true, breaks: true };
  const stats = { mirrorMs: 0, mirrorFrames: 0, mirrorPx: 0, shimmerMs: 0, shimmerFrames: 0, traces: 0, shimmerPx: 0, smashed: 0, partial: 0, loot: 0, crimes: 0, shades: 0, errors: 0, captions: 0 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hasG = () => typeof G !== 'undefined' && G && G.map && G.player && typeof Engine !== 'undefined';
  const reduced = () => !!(typeof GFX !== 'undefined' && GFX.reduceMotion);
  const calm = () => !!(typeof GFX !== 'undefined' && GFX.noFlash);
  const scaresLevel = () => { try { if (typeof NERVES13 !== 'undefined' && NERVES13 && typeof NERVES13.scaresAllowed === 'function') return NERVES13.scaresAllowed(); } catch (e) { /* default */ } return 'gentle'; };
  const dreadOn = () => { try { return typeof DREAD !== 'undefined' && DREAD && DREAD.set && !!DREAD.set.on; } catch (e) { return false; } };
  const dissonance = () => { try { return dreadOn() ? clamp(+DREAD.D || 0, 0, 100) : 0; } catch (e) { return 0; } };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function rnd01(seed) { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const rngOf = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ---- text (every player-visible string passes through S so the test and the French file can check it) ------------
  const LIST = [];
  const S = (t) => { LIST.push(t); return t; };
  const TX = {
    optHead: S('Phase 14: props'),
    optMirrors: S('Mirrors'), optMirrorsHint: S('framed glass in a few rooms shows you, your gear and the room behind you'),
    optShimmer: S('Sealed doors'), optShimmerHint: S('doors held shut by story or magic show a thin shimmering skin; No flashes keeps it still, Reduce motion slows it'),
    optBreak: S('Breakables'), optBreakHint: S('barrels and crates can be smashed with a blow; pieces fall, some hold a little loot; owned crates in town are a crime'),
    on: S('On'), off: S('Off'),
    mirror: S('A tall mirror in a plain frame. A traveller looks back out of it, dressed as you are, and the room behind them is the room behind you.'),
    mirrorWick: S('The glass is clear, which is more than anything else in the house is. A traveller looks back out of it, dressed as you are.'),
    barrelCrack: S('The staves crack and hold.'),
    crateCrack: S('The boards split and hold.'),
    barrelSmash: S('The barrel bursts its hoops.'),
    crateSmash: S('The crate splinters.'),
    inside: S('Inside: {0}.'),
    empty: S('Nothing inside but straw and dust.'),
    unseen: S('No one sees you do it.'),
    crime: S('damage to goods'),
    capSmash: S('[Wood splinters]'),
    capCrack: S('[Wood cracks]'),
  };

  // ---- persistence of the three switches ------------------------------------------------------------------------------
  function loadSet() {
    let had = false;
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') for (const k of ['mirrors', 'shimmer', 'breaks']) if (typeof o[k] === 'boolean') { set[k] = o[k]; had = true; }
    } catch (e) { /* storage blocked: defaults */ }
    if (typeof GFX !== 'undefined') {
      if (had) { GFX.p14pMirrors = set.mirrors; GFX.p14pShimmer = set.shimmer; GFX.p14pBreak = set.breaks; }
      else { set.mirrors = !!GFX.p14pMirrors; set.shimmer = !!GFX.p14pShimmer; set.breaks = !!GFX.p14pBreak; }
    }
  }
  function saveSet() { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) { /* optional */ } }
  const mirrorsOn = () => !!(typeof GFX === 'undefined' || GFX.p14pMirrors);
  const shimmerOn = () => !!(typeof GFX === 'undefined' || GFX.p14pShimmer);
  const breaksOn = () => !!(typeof GFX === 'undefined' || GFX.p14pBreak);

  // ================================================================ art (procedural stand-ins, drawn once)
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function toSprite(c, extra) {
    const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height);
    return Object.assign({ w: c.width, h: c.height, data: new Uint32Array(id.data.buffer.slice(0)), hs: 1, cx: 0.5, dy: 0 }, extra || {});
  }
  const MAT_COL = { robe: ['#a9b1af', '#5f6866'], hush: ['#4a6b62', '#223630'], mail: ['#a9b3b6', '#566064'], bell: ['#d8ab5a', '#7a5320'], steel: ['#b3bcbf', '#5a6366'], leather: ['#9a6642', '#4a2c18'], cloth: ['#b8a07a', '#6b5638'], skin: ['#c9a083', '#7b5842'], none: ['#7a6552', '#3a2d22'] };
  const HAIR = ['#46352c', '#2a2420', '#8a6a3a', '#a8a39a', '#5a3524', '#1c1a1d'];
  const WEAPON_COL = { iron: '#c4d1cc', bronze: '#c9984a', glass: '#79e6d8', shot: '#7a5a3a', bolt: '#7a5a3a' };
  function matOf(a) {
    if (!a) return null;
    try { if (typeof ARMOR !== 'undefined' && a === ARMOR.a_synodrobe) return 'robe'; } catch (e) { /* fall through */ }
    const n = a.name || '';
    if (/Hush/.test(n)) return 'hush'; if (/Chain|Mail/.test(n)) return 'mail'; if (/Bell-|Carillon/.test(n)) return 'bell';
    if (/Iron|Brigandine/.test(n)) return 'steel'; if (/Leather/.test(n)) return 'leather';
    return 'cloth';
  }
  const worn = (slot) => { try { const p = G.player, id = p.armor && p.armor[slot]; return id && ARMOR[id] ? ARMOR[id] : null; } catch (e) { return null; } };
  function gearOf() {
    const p = G.player, wid = p.weapons && p.weapons[p.weapon], w = (typeof WEAPONS !== 'undefined' && WEAPONS[wid]) || { type: 'iron', name: '?' };
    const shield = worn('shield');
    const blocked = !!w.twoHanded;
    return { wid: wid || 'hands', w, body: matOf(worn('body')), head: matOf(worn('head')), hands: matOf(worn('hands')), feet: matOf(worn('feet')), shield: shield && !blocked ? matOf(shield) : null, hair: HAIR[((p.face | 0) - 1 + 6) % 6] || HAIR[0] };
  }
  const gearKey = (g) => [g.wid, g.body, g.head, g.hands, g.feet, g.shield, g.hair].join('|');
  // the player's reflection: 24 x 56 px, front view. `swing` lifts the weapon arm.
  const figCache = {};
  function paintFigure(g, swing) {
    const c = mk(24, 56), x = c.getContext('2d');
    const grad = (mat, y0, y1) => { const m = MAT_COL[mat || 'none'], gr = x.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, m[0]); gr.addColorStop(1, m[1]); return gr; };
    const skin = MAT_COL.skin[0];
    // boots and breeches
    x.fillStyle = '#483e38'; x.fillRect(8, 33, 4, 15); x.fillRect(13, 33, 4, 15);
    x.fillStyle = grad(g.feet || 'none', 47, 55); if (!g.feet) x.fillStyle = '#67503c'; x.fillRect(7, 47, 5, 8); x.fillRect(13, 47, 5, 8);
    // torso and arms
    x.fillStyle = grad(g.body, 13, 34);
    if (g.body === 'robe') { x.beginPath(); x.moveTo(6, 13); x.lineTo(18, 13); x.lineTo(21, 50); x.lineTo(3, 50); x.closePath(); x.fill(); } else x.fillRect(7, 13, 11, 20);
    x.fillStyle = grad(g.body, 13, 30); x.fillRect(4, 14, 3, 15); x.fillRect(18, 14, 3, 15);
    x.fillStyle = '#322923'; x.fillRect(7, 31, 11, 2);
    // hands
    x.fillStyle = g.hands ? grad(g.hands, 28, 33) : skin; x.fillRect(3, 28, 4, 4); x.fillRect(18, 28, 4, 4);
    if (g.wid === 'glass') { x.fillStyle = WEAPON_COL.glass; x.fillRect(18, 16, 3, 16); }
    // neck, head, hair, helm
    x.fillStyle = skin; x.fillRect(11, 10, 3, 4);
    x.beginPath(); x.ellipse(12.5, 6.5, 4.6, 5.6, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = g.hair; x.beginPath(); x.ellipse(12.5, 3.6, 5, 3.2, 0, Math.PI, Math.PI * 2); x.fill();
    if (g.head) { x.fillStyle = grad(g.head, 0, 8); x.beginPath(); x.ellipse(12.5, 4.2, 5.6, 4.4, 0, Math.PI, Math.PI * 2); x.fill(); x.fillRect(7, 3, 11, 3); }
    x.fillStyle = '#3a2a22'; x.fillRect(10, 6, 1, 1); x.fillRect(14, 6, 1, 1);
    // shield on the left, weapon on the right
    if (g.shield) { x.fillStyle = grad(g.shield, 17, 30); x.beginPath(); x.ellipse(3, 23, 3.4, 6, 0, 0, Math.PI * 2); x.fill(); }
    const w = g.w, col = WEAPON_COL[w.type] || WEAPON_COL.iron;
    if (g.wid !== 'glass') {
      const ax = swing ? 22 : 21;
      x.strokeStyle = w.ranged ? '#7a5a3a' : w.blunt ? '#77573c' : col; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(ax - 1, 30); x.lineTo(ax + (swing ? 0 : 1), swing ? 6 : 12); x.stroke();
      if (w.blunt || w.type === 'bronze') { x.fillStyle = col; x.fillRect(ax - 3, swing ? 3 : 9, 5, 4); }
      if (w.ranged) { x.strokeStyle = col; x.beginPath(); x.moveTo(ax - 3, 20); x.lineTo(ax + 1, 26); x.stroke(); }
    }
    return toSprite(c);
  }
  function figureFor() {
    const g = gearOf(), key = gearKey(g);
    let f = figCache[key];
    if (!f) {
      f = figCache[key] = { key, gear: g, idle: paintFigure(g, false), swing: paintFigure(g, true),
        colors: { body: g.body, head: g.head, hands: g.hands, feet: g.feet, shield: g.shield, weapon: WEAPON_COL[g.w.type] || WEAPON_COL.iron, weaponId: g.wid } };
      const ks = Object.keys(figCache); if (ks.length > 12) delete figCache[ks[0]];
    }
    return f;
  }
  // a head and shoulders with no features, soft at the edge. Alpha only; it is drawn as a darkening.
  let shadeSprite = null;
  function shadeArt() {
    if (shadeSprite) return shadeSprite;
    const W = 20, H = 58, a = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 9.5) / 4.6, dy = (y - 7) / 6; let v = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const sh = (x - 9.5) / (7 + (y - 16) * 0.12), body = y > 14 ? Math.max(0, 1 - Math.abs(sh)) * Math.min(1, (y - 12) / 6) * (y > 50 ? Math.max(0, (58 - y) / 8) : 1) : 0;
      a[y * W + x] = Math.max(v, body * 0.9);
    }
    const out = new Float32Array(W * H);          // two box-blur passes: it is never clear
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += a[yy * W + xx]; n++; } } out[y * W + x] = s / n; }
      a.set(out);
    }
    const data = new Uint32Array(W * H); for (let i = 0; i < W * H; i++) data[i] = (Math.round(clamp(a[i] * 1.15, 0, 1) * 255) << 24) >>> 0;
    shadeSprite = { w: W, h: H, data, hs: 1, cx: 0.5, dy: 0 };
    return shadeSprite;
  }
  // debris: staves, a hoop, planks, a splinter and two heaps
  const DEB = {};
  function paintDebris() {
    const mkc = (name, w, h, fn) => { const c = mk(w, h), x = c.getContext('2d'); fn(x); const sp = toSprite(c); DEB[name] = sp; if (typeof Engine !== 'undefined' && Engine.addSprite) Engine.addSprite(name, sp); };
    const wood = (x, c1, c2, rx, ry, rw, rh) => { x.fillStyle = c1; x.fillRect(rx, ry, rw, rh); x.fillStyle = c2; x.fillRect(rx, ry + rh - 2, rw, 2); };
    mkc('p14p_stave', 6, 20, (x) => { wood(x, '#7a5530', '#4f351f', 1, 0, 4, 20); x.fillStyle = '#6a5a4a'; x.fillRect(1, 6, 4, 1); });
    mkc('p14p_hoop', 16, 8, (x) => { x.strokeStyle = '#6a5a4a'; x.lineWidth = 2; x.beginPath(); x.ellipse(8, 4, 6.5, 2.8, 0, 0, Math.PI * 2); x.stroke(); });
    mkc('p14p_plank', 20, 6, (x) => { wood(x, '#9a7442', '#6b4c28', 0, 0, 20, 6); x.fillStyle = '#c8b27a'; x.fillRect(3, 2, 1, 1); x.fillRect(16, 2, 1, 1); });
    mkc('p14p_plank2', 14, 5, (x) => { wood(x, '#8a6a3f', '#5e4424', 0, 0, 14, 5); });
    mkc('p14p_splinter', 8, 4, (x) => { x.fillStyle = '#b08a52'; x.beginPath(); x.moveTo(0, 2); x.lineTo(8, 0); x.lineTo(6, 3); x.closePath(); x.fill(); });
    mkc('p14p_heap_b', 30, 10, (x) => { x.fillStyle = '#4f351f'; x.beginPath(); x.ellipse(15, 6, 14, 4, 0, 0, Math.PI * 2); x.fill(); wood(x, '#7a5530', '#4f351f', 5, 2, 8, 3); wood(x, '#7a5530', '#4f351f', 14, 3, 9, 3); x.strokeStyle = '#6a5a4a'; x.lineWidth = 1; x.beginPath(); x.ellipse(12, 5.5, 5, 1.6, 0, 0, Math.PI * 2); x.stroke(); });
    mkc('p14p_heap_c', 30, 10, (x) => { x.fillStyle = '#5e4424'; x.beginPath(); x.ellipse(15, 6, 14, 4, 0, 0, Math.PI * 2); x.fill(); wood(x, '#9a7442', '#6b4c28', 4, 3, 12, 3); wood(x, '#8a6a3f', '#5e4424', 13, 2, 11, 3); });
  }
  try { if (typeof document !== 'undefined') paintDebris(); } catch (e) { console.warn('props14 art failed', e); }

  // ================================================================ 1. MIRRORS
  function geom(m) {
    switch (m.face) {
      case 'e': return { nx: 1, ny: 0, axis: 0, plane: m.cx + 1, lat0: m.cy };
      case 'w': return { nx: -1, ny: 0, axis: 0, plane: m.cx, lat0: m.cy };
      case 's': return { nx: 0, ny: 1, axis: 1, plane: m.cy + 1, lat0: m.cx };
      default: return { nx: 0, ny: -1, axis: 1, plane: m.cy, lat0: m.cx };
    }
  }
  for (const m of MIRRORS) { m.g = geom(m); m.st = { phase: 0, alpha: 0, watch: 0, lost: 0, episode: 0, decided: false, delay: 3, age: 0, spot: null, variant: 'figure', shown: 0, hold: 0, max: 0.5, rise: 3, fall: 1.5, away: 0 }; }
  const mirrorsOf = (id) => MIRRORS.filter((m) => m.map === id);
  // a mirror exists only on a real wall face with open floor in front and nothing solid standing against it
  function mirrorValid(map, m) {
    if (!map || map.id !== m.map || map.relief) return false;
    const c = map.cells[m.cy * map.w + m.cx];
    if (!c || c.door) return false;
    const fx = m.cx + m.g.nx, fy = m.cy + m.g.ny;
    if (fx < 0 || fy < 0 || fx >= map.w || fy >= map.h) return false;
    return !map.cells[fy * map.w + fx];
  }
  const mirrorText = (m) => (m.id === 'wick' ? TX.mirrorWick : TX.mirror);

  // ---- the reflected room: entities projected from the reflected camera
  const sorter = (a, b) => a.trY - b.trY;
  let cands = [], nCand = 0, colList = [];
  function lampTint(F, wx, wy) {
    let cr = 0, cg = 0, cb = 0; const pl = F.ptLights;
    if (pl) for (let i = 0; i < pl.length; i++) {
      const L = pl[i], dx = wx - L.x, dy = wy - L.y, d2 = dx * dx + dy * dy, r2 = L.r * L.r;
      if (d2 < r2) { if (L.vis) { const ii = (wx | 0) - L.vox, jj = (wy | 0) - L.voy; if (!(ii >= 0 && jj >= 0 && ii < L.vd && jj < L.vd && L.vis[jj * L.vd + ii] === 1)) continue; } const k = 1 - d2 / r2, kk = k * k; cr += L.cr * kk; cg += L.cg * kk; cb += L.cb * kk; }
    }
    return [cr > 90 ? 90 : cr, cg > 90 ? 90 : cg, cb > 90 ? 90 : cb];
  }
  const TEXN = 64;
  const WOOD = [0xff2a3f5a, 0xff3f5f84]; // frame wood, ABGR (dark / light)
  function drawMirror(F, m) {
    const g = m.g, st = m.st, map = F.map, cam = F.cam, w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, horizon = F.horizon;
    const nx = g.nx, ny = g.ny, ax = g.axis;
    // the viewer must be on the room side of the plane
    const side = ax === 0 ? (cam.x - g.plane) * nx : (cam.y - g.plane) * ny;
    if (!(side > 0.05)) return 0;
    const tex = Engine.textures, fogMul = 1 / F.fogDist, amb = F.ambient;
    const dirX = F.dirX, dirY = F.dirY, plX = F.planeX, plY = F.planeY;
    // the reflected camera
    const Ex = ax === 0 ? 2 * g.plane - cam.x : cam.x, Ey = ax === 1 ? 2 * g.plane - cam.y : cam.y;
    const dvx = ax === 0 ? -dirX : dirX, dvy = ax === 1 ? -dirY : dirY, pvx = ax === 0 ? -plX : plX, pvy = ax === 1 ? -plY : plY;
    const invDet = 1 / (pvx * dvy - dvx * pvy);
    // the columns the mirror's rectangle can cover: project the face's two ends
    let xa = 0, xb = w - 1;
    {
      const lo = g.lat0, hi = g.lat0 + 1; let minX = 1e9, maxX = -1e9, ok = true;
      for (const lat of [lo, hi]) {
        const px = ax === 0 ? g.plane : lat, py = ax === 0 ? lat : g.plane, sx = px - cam.x, sy = py - cam.y;
        const iD = 1 / (plX * dirY - dirX * plY), trX = iD * (dirY * sx - dirX * sy), trY = iD * (-plY * sx + plX * sy);
        if (trY <= 0.05) { ok = false; break; }
        const scr = (w / 2) * (1 + trX / trY); if (scr < minX) minX = scr; if (scr > maxX) maxX = scr;
      }
      if (ok) { xa = Math.max(0, Math.floor(minX) - 1); xb = Math.min(w - 1, Math.ceil(maxX) + 1); }
      else { // an end is behind the eye: scan the whole width (rare, very close)
        xa = 0; xb = w - 1;
      }
    }
    if (xb < xa) return 0;
    // light, as the engine's own passes give it: the room's point lights (colour) and the dark-interiors factor
    const pl = F.ptLights, dkOn = !F.outdoor && GFX.darkInteriors !== false && !!pl && typeof LIGHTING !== 'undefined';
    const dkFloor = dkOn && LIGHTING.FLOOR != null ? LIGHTING.FLOOR : 0.45;
    const frontX = ax === 0 ? g.plane + nx * 0.3 : g.lat0 + 0.5, frontY = ax === 0 ? g.lat0 + 0.5 : g.plane + ny * 0.3;
    lightAt(pl, dkOn, dkFloor, frontX, frontY); const lfR = LR, lfG = LG, lfB = LB, lfD = LD;
    // ---- who is in the reflected room
    nCand = 0;
    const shadeOn = st.alpha > 0.01 && st.spot && st.phase > 0;
    const floorTex = tex[map.floor] || null, ceilTex = map.ceil ? tex[map.ceil] : null;
    const addCand = (c) => { if (nCand < cands.length) cands[nCand] = c; else cands.push(c); nCand++; };
    const ents = G.ents || map.entities;
    const mcx = ax0(m), mcy = ay0(m);
    const lampOut = shadeOn && st.variant === 'lamp' && st.alpha > 0.3;
    const project = (ex, ey, sp, scale, zBase, dark, light, strength, fig) => {
      const sx = ex - Ex, sy = ey - Ey, trY = invDet * (-pvy * sx + pvx * sy);
      if (trY <= 0.1) return;
      const trX = invDet * (dvy * sx - dvx * sy);
      const Hh = scale * (sp.hs || 1), span = 2 * h * Hh * sp.w / (sp.h * trY * w);
      const cxn = trX / trY, l = cxn - (sp.cx == null ? 0.5 : sp.cx) * span;
      lightAt(pl, dkOn, dkFloor, ex, ey); let lf = LD; if (fig && lf < 0.8) lf = 0.8;
      addCand({ trY, l, r: l + span, span, H: Hh, zb: zBase, sp, dark, light, str: strength, d: Math.sqrt(sx * sx + sy * sy), lf, tr: LR, tg: LG, tb: LB, fig: !!fig });
    };
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e.sprite || e.hidden || e.dead || e.dying) continue;
      const dx = e.x - mcx, dy = e.y - mcy; if (dx * dx + dy * dy > 120) continue;
      // only things on the room side of the mirror's plane can be reflected
      if (((e.x - g.plane) * nx * (ax === 0 ? 1 : 0)) + ((e.y - g.plane) * ny * (ax === 1 ? 1 : 0)) < 0.05) continue;
      if (lampOut && e.sprite === 'lamp') continue;
      const sp = Engine.sprites[e.animSprite || e.sprite]; if (!sp) continue;
      const scale = e.scale || 1;
      let glow = 0; if (e.sprite === 'lamp' || e.sprite === 'hearth' || e.sprite === 'campfire') glow = e.animGlow || e.glow || 0.8; else if (e.glow) glow = e.glow;
      project(e.x, e.y, sp, scale, -(e.yOff || 0) + (e.animLift || 0) - (sp.dy || 0) * scale, false, glow, 0);
    }
    // the player: where the eye is, a figure that faces the glass
    {
      const f = figureFor(), sw = hasG() && G.attack && G.attack.t > 0;
      project(cam.x, cam.y, sw ? f.swing : f.idle, 0.86, 0, false, 0, 0, true);
    }
    if (shadeOn) project(st.spot.x, st.spot.y, shadeArt(), 1.12, 0, true, 0, st.alpha);
    if (nCand > 1) { const part = cands.slice(0, nCand).sort(sorter); for (let i = 0; i < nCand; i++) cands[i] = part[i]; }
    // ---- is last frame's picture still true? (same eye, same room contents, same lights)
    let sig = 0;
    for (let i = 0; i < nCand; i++) { const c = cands[i]; sig += (c.trY * 13.1 + c.l * 7.7 + c.zb * 3.3 + c.H * 5.1 + spriteId(c.sp) * 0.37 + c.str * 2.9 + c.light * 1.7 + c.lf * 0.9) * (1 + i * 0.013); }
    if (pl) for (let i = 0; i < pl.length; i++) sig += pl[i].cr * 0.011 + pl[i].cg * 0.007 + pl[i].r * 0.31;
    const stdim = lampOut ? 1 - 0.3 * st.alpha : 1;
    const KEY = keyArr; KEY[0] = cam.x; KEY[1] = cam.y; KEY[2] = dirX; KEY[3] = dirY; KEY[4] = horizon; KEY[5] = w; KEY[6] = h; KEY[7] = amb; KEY[8] = F.fogDist; KEY[9] = sig; KEY[10] = stdim; KEY[11] = nCand; KEY[12] = plX; KEY[13] = dkOn ? 1 : 0;
    let C = m.cache;
    if (!C || C.w !== w || C.h !== h) C = m.cache = { w, h, buf: new Uint32Array(w * h), tc: new Float32Array(w), key: new Float64Array(16), ya: 0, yb: -1, age: 99 };
    let same = C.age < 8; if (same) for (let i = 0; i < 14; i++) if (C.key[i] !== KEY[i]) { same = false; break; }
    const buf = C.buf, tc = C.tc;
    if (!same) {
      stats.traces++;
      for (let i = 0; i < 14; i++) C.key[i] = KEY[i];
      C.age = 0;
      if (C.yb >= C.ya) buf.fill(0, C.ya * w, (C.yb + 1) * w);
      tc.fill(0);
      traceMirror(F, m, C, xa, xb, cands, nCand, floorTex, ceilTex, stdim, lfR, lfG, lfB, lfD, pl, dkOn, dkFloor);
    } else C.age++;
    // ---- put it on the frame, behind anything that stands in front of the glass
    let painted = 0;
    const ya = C.ya, yb = C.yb;
    for (let x = xa; x <= xb; x++) {
      const t = tc[x]; if (t === 0) continue;
      for (let y = ya; y <= yb; y++) {
        const o = y * w + x, c = buf[o]; if (c === 0) continue;
        if (Math.abs(dbuf[o] - t) > 0.004 || mbuf[o] !== 4) continue;
        fb[o] = c; painted++;
      }
    }
    return painted;
  }
  const keyArr = new Float64Array(16);
  const spriteIds = new WeakMap(); let spriteN = 0;
  const spriteId = (sp) => { let v = spriteIds.get(sp); if (v === undefined) { v = ++spriteN; spriteIds.set(sp, v); } return v; };
  // light at a world point: colour of the room's point lights, and the dark-interiors pass's brightness factor there
  let LR = 0, LG = 0, LB = 0, LD = 1;
  function lightAt(pl, dkOn, dkFloor, wx, wy) {
    let cr = 0, cg = 0, cb = 0, sum = 0;
    if (pl) for (let i = 0; i < pl.length; i++) {
      const L = pl[i], dx = wx - L.x, dy = wy - L.y, d2 = dx * dx + dy * dy, r2 = L.r * L.r;
      if (d2 >= r2) continue;
      if (L.vis) { const ii = (wx | 0) - L.vox, jj = (wy | 0) - L.voy; if (!(ii >= 0 && jj >= 0 && ii < L.vd && jj < L.vd && L.vis[jj * L.vd + ii] === 1)) continue; }
      const k = 1 - d2 / r2, kk = k * k; cr += L.cr * kk; cg += L.cg * kk; cb += L.cb * kk;
      const str = (L.cr + L.cg + L.cb) * 0.01; sum += k * (str > 1 ? 1 : str) * 1.35;
    }
    LR = cr > 90 ? 90 : cr; LG = cg > 90 ? 90 : cg; LB = cb > 90 ? 90 : cb;
    LD = dkOn ? dkFloor + (1 - dkFloor) * (sum > 1 ? 1 : sum) : 1;
  }
  let sR = new Float32Array(160), sG = new Float32Array(160), sB = new Float32Array(160);
  // The reflection: one traced ray per screen column across the glass, a solved colour every R rows down it, rows in between interpolated.
  function traceMirror(F, m, C, xa, xb, cands, nCand, floorTex, ceilTex, stdim, lfR, lfG, lfB, lfD, pl, dkOn, dkFloor) {
    const g = m.g, map = F.map, cam = F.cam, w = F.w, h = F.h, horizon = F.horizon, ax = g.axis, nx = g.nx, ny = g.ny;
    const tex = Engine.textures, fogMul = 1 / F.fogDist, amb = F.ambient, buf = C.buf, tc = C.tc;
    const dirX = F.dirX, dirY = F.dirY, plX = F.planeX, plY = F.planeY;
    const grid = map.cells, mw = map.w, mh = map.h;
    const gu0 = 0.2, gu1 = 0.8, gv0 = 0.17, gv1 = 0.83, fu0 = 0.12, fu1 = 0.88, fv0 = 0.1, fv1 = 0.9;
    const gSpan = 1 / (gu1 - gu0), gvSpan = 1 / (gv1 - gv0);
    const S = F.S || 1, bigR = (h / (Math.abs(g.plane - (ax === 0 ? cam.x : cam.y)) + 0.01)) > 110 * S;
    const R = (bigR ? 4 : 3) * S, invR = 1 / R;
    if (sR.length < ((h / R) | 0) + 4) { const n = ((h / R) | 0) + 8; sR = new Float32Array(n); sG = new Float32Array(n); sB = new Float32Array(n); }
    // per-column state
    let bCamX = 0, bT = 0, bPx = 0, bPy = 0, bRx = 0, bRy = 0, bTw = 0, bW0 = 0, bWtex = null, bWu = 0, nc = 0, wR = 0, wG = 0, wB = 0, wD = 1;
    let yMin = h, yMax = -1;
    const solve = (yy, k) => {
      const kk = (yy - horizon) / h;
      let pr = 0, pg = 0, pb = 0, got = false, darkA = 0;
      for (let i = 0; i < nc; i++) {
        const c = colList[i], z = 0.5 - kk * c.trY;
        if (z < c.zb || z >= c.zb + c.H) continue;
        const sp = c.sp, tx = (((bCamX - c.l) / c.span) * sp.w) | 0, ty = (((c.zb + c.H - z) / c.H) * sp.h) | 0;
        if (tx < 0 || tx >= sp.w || ty < 0 || ty >= sp.h) continue;
        const px = sp.data[ty * sp.w + tx], a = px >>> 24;
        if (c.dark) { const da = (a / 255) * c.str; if (da > darkA) darkA = da; continue; }
        if (a <= 100) continue;
        let f = 1 - c.d * fogMul; if (f < 0) f = 0; f = amb + (1 - amb) * f; if (c.fig && f < 0.72) f = 0.72;
        let dk = c.lf; if (c.light) { if (c.light > f) f = c.light; dk = 1; }
        pr = ((px & 255) * f + c.tr) * dk; pg = (((px >> 8) & 255) * f + c.tg) * dk; pb = (((px >> 16) & 255) * f + c.tb) * dk; got = true; break;
      }
      if (!got) {
        const z = 0.5 - kk * bTw;
        if (bWtex && z >= 0 && z < 1) {
          const px = bWtex[(((1 - z) * TEXN) & 63) * TEXN + bWu];
          pr = ((px & 255) * bW0 + wR) * wD; pg = (((px >> 8) & 255) * bW0 + wG) * wD; pb = (((px >> 16) & 255) * bW0 + wB) * wD;
        } else if (z < 0 && kk > 0) {
          const Tf = 0.5 / kk, d = Tf - bT, fx = bPx + d * bRx, fy = bPy + d * bRy;
          let f = 1 - Tf * fogMul; if (f < 0) f = 0; f = amb + (1 - amb) * f;
          lightAt(pl, dkOn, dkFloor, fx, fy);
          if (floorTex) { const px = floorTex[(((fy * TEXN) | 0) & 63) * TEXN + (((fx * TEXN) | 0) & 63)]; pr = ((px & 255) * f + LR) * LD; pg = (((px >> 8) & 255) * f + LG) * LD; pb = (((px >> 16) & 255) * f + LB) * LD; }
          else { pr = 30 * f * LD; pg = 26 * f * LD; pb = 22 * f * LD; }
        } else if (z >= 1 && kk < 0) {
          const Tc = 0.5 / -kk, d = Tc - bT, fx = bPx + d * bRx, fy = bPy + d * bRy;
          let f = 1 - Tc * fogMul; if (f < 0) f = 0; f = amb + (1 - amb) * f;
          lightAt(pl, dkOn, dkFloor, fx, fy);
          if (ceilTex) { const px = ceilTex[(((fy * TEXN) | 0) & 63) * TEXN + (((fx * TEXN) | 0) & 63)]; pr = ((px & 255) * f + LR) * LD; pg = (((px >> 8) & 255) * f + LG) * LD; pb = (((px >> 16) & 255) * f + LB) * LD; }
          else { pr = 14 * f * LD; pg = 12 * f * LD; pb = 10 * f * LD; }
        } else { pr = F.fogR * 0.5; pg = F.fogG * 0.5; pb = F.fogB * 0.5; }
      }
      if (darkA > 0) { const q = 1 - darkA * 0.92; pr *= q; pg *= q; pb *= q; }
      sR[k] = pr; sG[k] = pg; sB[k] = pb;
    };
    for (let x = xa; x <= xb; x++) {
      const camX = 2 * x / w - 1, rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      const rc = ax === 0 ? rdx : rdy; if (rc * (ax === 0 ? nx : ny) >= 0) continue;
      const t = (g.plane - (ax === 0 ? cam.x : cam.y)) / rc; if (!(t > 0.05)) continue;
      const lat = (ax === 0 ? cam.y + t * rdy : cam.x + t * rdx) - g.lat0; if (lat < fu0 || lat > fu1) continue;
      const lineH = (h / t) | 0; if (lineH < 4) continue;
      const ds = -lineH / 2 + horizon, invL = 1 / lineH;
      const y0 = Math.max(0, Math.ceil(ds + lineH * fv0)), y1 = Math.min(h - 1, Math.floor(ds + lineH * fv1)); if (y1 < y0) continue;
      tc[x] = t; if (y0 < yMin) yMin = y0; if (y1 > yMax) yMax = y1;
      const inGlassU = lat >= gu0 && lat <= gu1;
      const yg0 = inGlassU ? Math.max(y0, Math.ceil(ds + lineH * gv0)) : 1e9, yg1 = inGlassU ? Math.min(y1, Math.floor(ds + lineH * gv1)) : -1;
      // the frame: how it is lit
      let fw = 1 - t * fogMul; if (fw < 0) fw = 0; fw = amb + (1 - amb) * fw; if (ax === 1) fw *= 0.8;
      const edgeU = (lat < gu0 + 0.015 && lat >= gu0 - 0.015) || (lat > gu1 - 0.015 && lat <= gu1 + 0.015), guu = (lat - gu0) * gSpan;
      const woodSide = lat < 0.2;
      for (let y = y0; y <= y1; y++) {
        if (y >= yg0 && y <= yg1) { y = yg1; continue; }      // the glass is filled below
        const v = (y - ds) * invL, o = y * w + x;
        let r, gg, b;
        if (edgeU || (v < gv0 + 0.012 && v >= gv0 - 0.012) || (v > gv1 - 0.012 && v <= gv1 + 0.012)) { r = 190; gg = 150; b = 70; }
        else { const c = (woodSide || v < 0.2) ? WOOD[1] : WOOD[0], grain = ((y * 7 + x * 3) & 7) - 3; r = (c & 255) + grain; gg = ((c >> 8) & 255) + grain; b = ((c >> 16) & 255) + grain; }
        r = (r * fw + lfR) * lfD; gg = (gg * fw + lfG) * lfD; b = (b * fw + lfB) * lfD;
        buf[o] = (255 << 24) | ((b > 255 ? 255 : b | 0) << 16) | ((gg > 255 ? 255 : gg | 0) << 8) | (r > 255 ? 255 : r | 0);
      }
      if (yg1 < yg0) continue;
      // ---- the reflected ray for this column: bounce off the glass, then walk the grid
      bCamX = camX; bT = t;
      const Px = cam.x + t * rdx, Py = cam.y + t * rdy, rx = ax === 0 ? -rdx : rdx, ry = ax === 1 ? -rdy : rdy;
      bPx = Px; bPy = Py; bRx = rx; bRy = ry;
      let mapX = (Px + nx * 0.02) | 0, mapY = (Py + ny * 0.02) | 0;
      const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx), ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      let sdx, sdy, stX, stY;
      if (rx < 0) { stX = -1; sdx = (Px - mapX) * ddx; } else { stX = 1; sdx = (mapX + 1 - Px) * ddx; }
      if (ry < 0) { stY = -1; sdy = (Py - mapY) * ddy; } else { stY = 1; sdy = (mapY + 1 - Py) * ddy; }
      let s = 1e9, wside = 0; bWtex = null; bWu = 0;
      for (let it = 0; it < 48; it++) {
        if (sdx < sdy) { sdx += ddx; mapX += stX; wside = 0; } else { sdy += ddy; mapY += stY; wside = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= mw || mapY >= mh) break;
        const c = grid[mapY * mw + mapX];
        if (c) {
          if (c.door) { const d = map.doors && map.doors[mapY * mw + mapX]; if (d && d.open > 0.5) continue; }
          s = wside === 0 ? sdx - ddx : sdy - ddy;
          const hp = wside === 0 ? Py + s * ry : Px + s * rx; let u = hp - Math.floor(hp);
          if ((wside === 0 && rx > 0) || (wside === 1 && ry < 0)) u = 1 - u;
          bWu = (u * TEXN) | 0; bWtex = tex[c.tex] || tex.t_stone;
          break;
        }
      }
      bTw = t + s;
      { let f = 1 - bTw * fogMul; if (f < 0) f = 0; bW0 = (amb + (1 - amb) * f) * (wside ? 0.8 : 1); }
      if (s < 1e8) { lightAt(pl, dkOn, dkFloor, Px + (s - 0.06) * rx, Py + (s - 0.06) * ry); wR = LR; wG = LG; wB = LB; wD = LD; } else { wR = wG = wB = 0; wD = 1; }
      nc = 0;
      for (let i = 0; i < nCand; i++) { const c = cands[i]; if (camX >= c.l && camX < c.r && c.trY < bTw) { if (nc < colList.length) colList[nc] = c; else colList.push(c); nc++; } }
      // a solved colour every R rows (the last one clamped to the bottom of the glass) ...
      const n = yg1 - yg0, ns = ((n * invR) | 0) + 2;
      for (let k = 0; k < ns; k++) solve(yg0 + k * R, k);
      // ... and the rows between them interpolated, with a gentle silver cast and a soft vignette at the frame
      for (let y = yg0; y <= yg1; y++) {
        const kf = (y - yg0) * invR, k = kf | 0, a = kf - k;
        const rr = sR[k] + (sR[k + 1] - sR[k]) * a, rg = sG[k] + (sG[k + 1] - sG[k]) * a, rb = sB[k] + (sB[k + 1] - sB[k]) * a;
        const v = (y - ds) * invL, gvv = (v - gv0) * gvSpan, q = guu * 0.7 + gvv * 0.9, qf = q - (q | 0);
        const rim = Math.min(guu, 1 - guu, gvv, 1 - gvv), lim = (rim < 0.14 ? 0.8 + rim * 1.43 : 1) * stdim;
        const streak = (qf > 0.275 && qf < 0.34) ? 14 : 0;
        const pr = rr * lim * 0.95 + 3 + streak, pg = rg * lim * 0.98 + 4 + streak, pb = rb * lim + 6 + streak;
        buf[y * w + x] = (255 << 24) | ((pb > 255 ? 255 : pb | 0) << 16) | ((pg > 255 ? 255 : pg | 0) << 8) | (pr > 255 ? 255 : pr | 0);
      }
    }
    C.ya = yMin; C.yb = yMax;
  }

  function mirrorHook(F) {
    if (!mirrorsOn() || !F.map || F.outdoor || F.relief) return;
    const list = mirrorsOf(F.map.id); if (!list.length) return;
    const t0 = performance.now(); let n = 0;
    for (const m of list) { if (!mirrorValid(F.map, m)) continue; try { n += drawMirror(F, m); } catch (e) { stats.errors++; if (!mirrorHook.warned) { mirrorHook.warned = true; console.warn('props14 mirror failed', e); } } }
    stats.mirrorMs += performance.now() - t0; stats.mirrorFrames++; stats.mirrorPx += n;
  }

  // ---- the thing behind you: state kept per mirror, advanced by update()
  // chance of the thing for one approach (pure: the tests read it)
  function chance(D) { const p = BAL.baseP * (dreadOn() || D > 0 ? 1 + clamp(D, 0, 100) / BAL.dreadK : 1); return Math.min(Math.max(BAL.baseP, BAL.maxP), p); }
  function decideRoll(m, episode, day) { return rnd01(hashStr(m.map + '|' + m.id + '|' + episode + '|' + (day | 0)) ^ 0x14BEEF); }
  function viewInfo(m) {
    const c = Engine.cam, g = m.g, map = G.map;
    const mx = ax0(m), my = ay0(m);
    const dx = mx - c.x, dy = my - c.y, d = Math.hypot(dx, dy);
    const room = g.axis === 0 ? (c.x - g.plane) * g.nx > 0.1 : (c.y - g.plane) * g.ny > 0.1;
    let looking = false;
    if (room && d < BAL.watchR && d > 0.8) {
      const ang = Math.abs(normAng(Math.atan2(dy, dx) - c.dir));
      looking = ang < BAL.watchCone;
      if (looking && typeof los === 'function') { try { looking = los(c.x, c.y, mx + g.nx * 0.2, my + g.ny * 0.2); } catch (e) { /* keep */ } }
    }
    void map;
    return { looking, dist: d, room };
  }
  const ax0 = (m) => (m.g.axis === 0 ? m.g.plane : m.g.lat0 + 0.5);
  const ay0 = (m) => (m.g.axis === 0 ? m.g.lat0 + 0.5 : m.g.plane);
  function pickSpot(m, rr) {
    const c = Engine.cam, g = m.g, map = G.map;
    const lat = (rr() < 0.5 ? -1 : 1) * (0.18 + 0.3 * rr());
    for (let d = 2.4; d >= 1.0; d -= 0.2) {
      const px = g.axis === 0 ? c.x + g.nx * d : c.x + lat, py = g.axis === 0 ? c.y + lat : c.y + g.ny * d;
      if (px < 1 || py < 1 || px > map.w - 1 || py > map.h - 1) continue;
      let ok = true;
      for (const [ox, oy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (map.isBlocked && map.isBlocked(Math.floor(px + ox), Math.floor(py + oy))) { ok = false; break; }
      if (!ok) continue;
      if (typeof los === 'function' && !los(c.x, c.y, px, py)) continue;
      for (const e of G.ents) if ((e.solid || e.kind === 'npc') && !e.hidden && !e.dead && Math.hypot(e.x - px, e.y - py) < 0.55) { ok = false; break; }
      if (ok) return { x: px, y: py };
    }
    return null;
  }
  function tickMirror(m, dt) {
    const st = m.st, level = scaresLevel();
    const allowed = mirrorsOn() && level !== 'off' && m.haunt && set.mirrors;
    if (!allowed) { if (st.alpha > 0 || st.phase) { st.alpha = 0; st.phase = 0; st.spot = null; } return; }
    const v = viewInfo(m);
    if (v.looking) { st.lost = 0; } else st.lost += dt;
    // an approach ends when you have walked well away
    if (!v.room || v.dist > BAL.farEpisode) { st.away += dt; if (st.away > 0.5 && (st.decided || st.shown)) { st.episode++; st.decided = false; st.shown = 0; st.watch = 0; } } else st.away = 0;
    if (st.phase === 0) {
      if (v.looking) st.watch += dt; else st.watch = Math.max(0, st.watch - dt * 2);
      if (!st.decided && st.watch >= st.delay) {
        st.decided = true;
        const day = typeof G !== 'undefined' ? G.day : 0, p = chance(dissonance());
        if (decideRoll(m, st.episode, day) < p) startShade(m, level);
        else { const rr = rngOf(hashStr(m.id + st.episode)); st.delay = BAL.delayMin + (BAL.delayMax - BAL.delayMin) * rr(); }
      }
      return;
    }
    // visible: advance
    const c = Engine.cam;
    const near = st.spot && Math.hypot(c.x - st.spot.x, c.y - st.spot.y) < BAL.nearSpot;
    if (st.phase < 3 && (st.lost > 0.2 || near)) st.phase = 3;
    st.age += dt;
    if (st.phase === 1) { st.alpha = Math.min(st.max, st.alpha + st.max * dt / st.rise); if (st.alpha >= st.max - 1e-4) { st.phase = 2; st.hold = 0; } }
    else if (st.phase === 2) { st.hold += dt; const lvl = scaresLevel() === 'full' ? BAL.full : BAL.gentle; if (st.hold >= lvl.hold) st.phase = 4; }
    if (st.phase === 4) { st.alpha -= st.max * dt / st.fall; if (st.alpha <= 0) endShade(m); }
    else if (st.phase === 3) { st.alpha -= st.max * dt / BAL.quickFade; if (st.alpha <= 0) endShade(m); }
  }
  function startShade(m, level) {
    const st = m.st, rr = rngOf(hashStr(m.map + m.id + st.episode + 'spot'));
    const lvl = level === 'full' ? BAL.full : BAL.gentle;
    const lamps = G.ents.some((e) => e.sprite === 'lamp' && !e.hidden && Math.hypot(e.x - ax0(m), e.y - ay0(m)) < 9);
    const variant = lamps && rr() < 0.4 ? 'lamp' : 'figure';
    const spot = pickSpot(m, rr);
    if (variant === 'figure' && !spot) return;
    st.variant = variant; st.spot = spot || { x: ax0(m), y: ay0(m) }; st.phase = 1; st.alpha = 0.001; st.age = 0; st.max = lvl.max; st.rise = lvl.rise; st.fall = lvl.fall; st.hold = 0;
    st.shown++; stats.shades++;
  }
  function endShade(m) { const st = m.st; st.alpha = 0; st.phase = 0; st.spot = null; st.age = 0; }
  function resetMirrors() { for (const m of MIRRORS) { const st = m.st; st.phase = 0; st.alpha = 0; st.watch = 0; st.lost = 0; st.spot = null; st.age = 0; st.decided = false; st.shown = 0; st.away = 0; st.episode++; const rr = rngOf(hashStr(m.id + 'd' + st.episode)); st.delay = BAL.delayMin + (BAL.delayMax - BAL.delayMin) * rr(); } }
  function tickMirrors(dt) {
    const list = mirrorsOf(G.mapId);
    for (const m of list) { try { tickMirror(m, dt); } catch (e) { stats.errors++; } }
    // anything not in this map is gone
    for (const m of MIRRORS) if (m.map !== G.mapId && (m.st.alpha || m.st.phase)) endShade(m);
  }

  // ================================================================ 2. SEALED DOORS
  const noiseTile = (() => { const a = new Float32Array(64 * 64); let s = 0x2f6e2b1; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = s / 4294967296; } const b = new Float32Array(a.length); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { let t = 0; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) t += a[((y + j) & 63) * 64 + ((x + i) & 63)]; b[y * 64 + x] = t / 4; } return b; })();
  const seals = new Map();       // door cell key -> { amt, kind }
  let sealClock = 0, sealLast = -1;
  function sealSealed(c) {
    if (!c || !c.door || !c.locked || c.locked === '__never') return false;
    try { return c.locked === 'pass' ? !G.has('pass') : !G.flags[c.locked]; } catch (e) { return false; }
  }
  function sealsOf(map) { return SEALS.filter((s) => s.map === map.id); }
  function sealState(map, s) {
    const key = map.id + ':' + s.x + ',' + s.y;
    let r = seals.get(key); if (!r) { r = { amt: 0, kind: s.kind, x: s.x, y: s.y, started: false }; seals.set(key, r); }
    return r;
  }
  function sealTarget(map, s) {
    const ci = s.y * map.w + s.x, c = map.cells[ci];
    if (!c || !c.door || !c.locked) return 0;
    const d = map.doors && map.doors[ci];
    if (d && d.open > 0.02) return 0;
    return sealSealed(c) ? 1 : 0;
  }
  function doorAxis(map, x, y) {
    const g = map.cells, w = map.w, n = g[(y - 1) * w + x], so = g[(y + 1) * w + x], we = g[y * w + x - 1], ea = g[y * w + x + 1];
    if (n && so && !(we && ea)) return 0;        // the slab stands in the plane x = cell + 0.5
    if (we && ea && !(n && so)) return 1;        // the plane y = cell + 0.5
    return -1;
  }
  function shimmerHook(F) {
    if (!shimmerOn() || !F.map) return;
    const list = sealsOf(F.map); if (!list.length) return;
    // time: still under No flashes, a quarter speed under Reduce motion
    const now = F.animT || 0; let dt = sealLast < 0 ? 0 : now - sealLast; sealLast = now; if (dt < 0 || dt > 0.5) dt = 0;
    const t0 = performance.now(); let n = 0;
    const phase = calm() ? 0.37 : now * (reduced() ? 0.25 : 1);
    for (const s of list) {
      const st = sealState(F.map, s), tgt = sealTarget(F.map, s);
      if (tgt >= 1) st.amt = Math.min(1, st.amt + dt * 1.5); else if (F.map.doors && F.map.doors[s.y * F.map.w + s.x] && F.map.doors[s.y * F.map.w + s.x].open > 0.02) st.amt = 0; else st.amt = Math.max(0, st.amt - dt / BAL.fadeSeal);
      if (st.amt <= 0.003) continue;
      try { n += drawSeal(F, s, st, phase); } catch (e) { stats.errors++; if (!shimmerHook.warned) { shimmerHook.warned = true; console.warn('props14 shimmer failed', e); } }
    }
    stats.shimmerMs += performance.now() - t0; stats.shimmerFrames++; stats.shimmerPx += n;
  }
  function drawSeal(F, s, st, phase) {
    const map = F.map, cam = F.cam, w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf, horizon = F.horizon;
    const ax = doorAxis(map, s.x, s.y); if (ax < 0) return 0;
    const plane = (ax === 0 ? s.x : s.y) + 0.5, lat0 = ax === 0 ? s.y : s.x;
    const col = KIND_COL[st.kind] || KIND_COL.synod, hush = st.kind === 'hush', amt = st.amt;
    const dx = ax === 0 ? s.x + 0.5 - cam.x : s.y + 0.5 - cam.y; if (Math.abs(dx) < 0.01) return 0;
    // columns: project the slab's two ends
    let minX = 1e9, maxX = -1e9, ok = true;
    for (const lat of [lat0, lat0 + 1]) {
      const px = ax === 0 ? plane : lat, py = ax === 0 ? lat : plane, sx = px - cam.x, sy = py - cam.y;
      const iD = 1 / (F.planeX * F.dirY - F.dirX * F.planeY), trX = iD * (F.dirY * sx - F.dirX * sy), trY = iD * (-F.planeY * sx + F.planeX * sy);
      if (trY <= 0.05) { ok = false; break; }
      const scr = (w / 2) * (1 + trX / trY); if (scr < minX) minX = scr; if (scr > maxX) maxX = scr;
    }
    const xa = ok ? Math.max(0, Math.floor(minX) - 1) : 0, xb = ok ? Math.min(w - 1, Math.ceil(maxX) + 1) : w - 1;
    let painted = 0;
    const kr = col[0], kg = col[1], kb = col[2], kk = st.kind === 'glass' ? 0.55 : 1;   // the glass door is already bright
    for (let x = xa; x <= xb; x++) {
      const camX = 2 * x / w - 1, rdx = F.dirX + F.planeX * camX, rdy = F.dirY + F.planeY * camX;
      const rc = ax === 0 ? rdx : rdy; if (rc === 0) continue;
      const t = (plane - (ax === 0 ? cam.x : cam.y)) / rc; if (!(t > 0.05)) continue;
      const u = (ax === 0 ? cam.y + t * rdy : cam.x + t * rdx) - lat0; if (u < 0 || u > 1) continue;
      let lineH = (h / t) | 0; if (lineH < 3) continue;
      let ds = -lineH / 2 + horizon;
      let y0 = Math.max(0, Math.ceil(ds)), y1 = Math.min(h - 1, Math.floor(ds + lineH - 1));
      if (F.relief) {
        // relief maps: the ground is not at one height, so find the slab in the column from the depth and material buffers
        let a = -1, z = -1; for (let y = 0; y < h; y++) { const o = y * w + x; if (mbuf[o] === 4 && Math.abs(dbuf[o] - t) <= 0.004) { if (a < 0) a = y; z = y; } }
        if (a < 0) continue;
        y0 = a; y1 = z; ds = a; lineH = z - a + 1; if (lineH < 3) continue;
      }
      const eu = Math.min(u, 1 - u);
      for (let y = y0; y <= y1; y++) {
        const o = y * w + x;
        if (Math.abs(dbuf[o] - t) > 0.004 || mbuf[o] !== 4) continue;
        const v = (y - ds) / lineH;
        const n1 = noiseTile[(((v * 18 + phase * 0.9) | 0) & 63) * 64 + ((((u * 9 + phase * 0.4) * 1) | 0) & 63)];
        const band = 0.5 + 0.5 * Math.sin(v * 17 + u * 4 - phase * 1.7);
        const edge = eu < 0.1 ? (1 - eu / 0.1) : 0, top = v < 0.07 ? (1 - v / 0.07) : 0;
        const I = amt * kk * (0.1 + 0.24 * n1 * band + 0.4 * Math.max(edge, top * 0.8));
        const px = fb[o]; let r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
        if (hush) {
          const lum = (r + g + b) * 0.3333, k = clamp(I * 2.4, 0, 0.85);
          r += (lum * 0.78 - r) * k; g += (lum * 0.78 - g) * k; b += (lum * 0.78 - b) * k;
        } else { r += kr * I; g += kg * I; b += kb * I; }
        fb[o] = (255 << 24) | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
        painted++;
      }
    }
    return painted;
  }

  // ================================================================ 3. BREAKABLE BARRELS AND CRATES
  const debris = [];            // pieces still falling
  const sound = (kind) => {
    try {
      if (typeof Audio_ === 'undefined' || !Audio_.ctx || Audio_.muted || !Audio_.sfxBus) return;
      const ctx = Audio_.ctx, t = ctx.currentTime, len = kind === 'smash' ? 0.35 : 0.14;
      const buf = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * len) | 0), ctx.sampleRate), d = buf.getChannelData(0);
      let q = 1; for (let i = 0; i < d.length; i++) { q = (Math.imul(q, 1664525) + 1013904223) | 0; d[i] = ((q >>> 8) / 8388608 - 1) * Math.pow(1 - i / d.length, 2); }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(kind === 'smash' ? 1500 : 900, t); f.frequency.exponentialRampToValueAtTime(380, t + len); f.Q.value = 0.8;
      const gn = ctx.createGain(); gn.gain.value = kind === 'smash' ? 0.5 : 0.28;
      src.connect(f); f.connect(gn); gn.connect(Audio_.sfxBus); src.start(t);
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'smash' ? 130 : 160, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      og.gain.setValueAtTime(0.18, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(og); og.connect(Audio_.sfxBus); o.start(t); o.stop(t + 0.25);
    } catch (e) { /* sound is cosmetic */ }
  };
  function capLine(text) {
    try {
      if (typeof ACCESS === 'undefined' || !ACCESS.settings || !ACCESS.settings.cap || typeof document === 'undefined') return;
      let box = document.getElementById('ac-captions');
      if (!box) { const g = document.getElementById('game'); if (!g) return; box = document.createElement('div'); box.id = 'ac-captions'; box.setAttribute('role', 'log'); box.setAttribute('aria-live', 'polite'); box.setAttribute('aria-label', 'Sound captions'); g.appendChild(box); }
      for (const ch of box.children) if (ch.textContent === text) return;
      const d = document.createElement('div'); d.textContent = text; box.appendChild(d);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => { if (d.parentNode) d.remove(); }, 3200);
      stats.captions++;
    } catch (e) { /* captions are cosmetic */ }
  }
  const say = (t, kind, ms) => { try { if (typeof msg === 'function') msg(t, kind || '', ms || 3500); } catch (e) { /* ignore */ } };
  // story crates are never touched: scenery props only, none with a use, none standing by a placed crate that has one
  function nearStory(e) {
    const L = G.ents || [];
    for (let i = 0; i < L.length; i++) { const o = L[i]; if (o !== e && o.use && !o._scn && (o.sprite === 'crates' || o.sprite === 'cores') && Math.hypot(o.x - e.x, o.y - e.y) < 1.8) return true; }
    return false;
  }
  const isBreakable = (e) => !!(e && (e._scn === 'barrel' || e._scn === 'crate') && !e.hidden && !e.dead && !e._p14gone && !e.use && !e.item && e.kind === 'deco' && !nearStory(e));
  // what is in this one: a pure function of the map and the position (the same barrel always holds the same thing)
  function lootFor(mapId, e) {
    const kind = e._scn === 'crate' ? 'crate' : 'barrel';
    const rng = rngOf(hashStr(mapId + '|' + kind + '|' + Math.round(e.x * 100) + ',' + Math.round(e.y * 100)) ^ 0x14B0A5);
    if (rng() >= BAL.chance[kind]) return null;
    const table = LOOT[kind].filter((r) => typeof ITEMS !== 'undefined' && ITEMS[r[0]] && !ITEMS[r[0]].key);
    let tot = 0; for (const r of table) tot += r[1];
    let pick = rng() * tot, row = table[0];
    for (const r of table) { pick -= r[1]; if (pick <= 0) { row = r; break; } }
    const n = row[2] ? row[2] + Math.floor(rng() * (row[3] - row[2] + 1)) : 1;
    return { id: row[0], n };
  }
  function giveLoot(l) {
    const p = G.player, it = ITEMS[l.id];
    if (l.id === 'sovereigns') { G.gold(l.n); return l.n + ' sovereigns'; }
    if (it.use === 'ammo') { const k = it.ammo || 'pellets'; p[k] = (p[k] || 0) + it.n; return it.name; }
    G.give(l.id); return 'the ' + it.name;
  }
  function weaponPower(w, p) { let v = (w.dmg[0] + w.dmg[1]) / 2 + Math.floor(((p.attrs && p.attrs.Strength) || 0) / 25); if (w.blunt) v *= 1.5; if (w.cleave) v *= 1.25; return v; }
  function hitsNeeded(e, w, p) { return Math.max(1, Math.ceil(BAL.hp[e._scn === 'crate' ? 'crate' : 'barrel'] / weaponPower(w, p))); }
  function addDebris(e, kind, rr) {
    const map = G.map, names = kind === 'crate' ? ['p14p_plank', 'p14p_plank2', 'p14p_plank', 'p14p_splinter', 'p14p_plank2'] : ['p14p_stave', 'p14p_stave', 'p14p_hoop', 'p14p_stave', 'p14p_splinter'];
    const out = [];
    const flat = reduced();
    // the heap first: low, non-solid, there for the rest of the visit
    out.push(Object.assign({ kind: 'deco', sprite: kind === 'crate' ? 'p14p_heap_c' : 'p14p_heap_b', x: e.x, y: e.y, scale: 0.13, radius: 0.1, solid: false, transient: true, nopick: true, _p14d: true, label: kind === 'crate' ? 'Splintered boards.' : 'Broken staves and a rusting hoop.' }));
    const c = Engine.cam, away = Math.atan2(e.y - c.y, e.x - c.x);       // pieces fly away from the blow, not into your face
    for (let i = 0; i < BAL.debris; i++) {
      const a = away + (rr() - 0.5) * 2.4, sp = 0.4 + rr() * 0.8, name = names[i % names.length];
      const piece = { kind: 'deco', sprite: name, x: e.x, y: e.y, scale: name === 'p14p_hoop' ? 0.15 : name === 'p14p_splinter' ? 0.06 : 0.12 + rr() * 0.04, radius: 0.05, solid: false, transient: true, nopick: true, _p14d: true, yOff: -(0.16 + rr() * 0.2),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.6 + rr() * 1.2, label: 'A piece of broken wood.' };
      if (flat) { piece.x += Math.cos(a) * (0.12 + rr() * 0.3); piece.y += Math.sin(a) * (0.12 + rr() * 0.3); piece.yOff = 0.01; piece.vx = piece.vy = piece.vz = 0; }
      out.push(piece);
    }
    for (const d of out) { map.entities.push(d); if (d.vx || d.vz) debris.push(d); }
    // bound the number of pieces lying about on one map
    let n = 0; for (let i = map.entities.length - 1; i >= 0; i--) if (map.entities[i]._p14d && ++n > BAL.maxDebris) map.entities.splice(i, 1);
    return out;
  }
  function tickDebris(dt) {
    if (!debris.length) return;
    const map = G.map;
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      if (!map || !map.entities.includes(d)) { debris.splice(i, 1); continue; }
      let z = -d.yOff + d.vz * dt;
      d.vz -= 7.5 * dt;
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
      if (map.isBlocked && map.isBlocked(Math.floor(nx), Math.floor(ny))) { d.vx = -d.vx * 0.3; d.vy = -d.vy * 0.3; } else { d.x = nx; d.y = ny; }
      if (z <= 0) { z = 0; if (Math.abs(d.vz) > 0.7) { d.vz = -d.vz * 0.32; d.vx *= 0.6; d.vy *= 0.6; } else { d.vx = d.vy = d.vz = 0; d.yOff = 0.01; debris.splice(i, 1); continue; } }
      d.yOff = -z + 0.01;
    }
  }
  function smash(e, w) {
    const map = G.map, p = G.player, kind = e._scn === 'crate' ? 'crate' : 'barrel';
    e._p14gone = true;
    const i = map.entities.indexOf(e); if (i >= 0) map.entities.splice(i, 1);
    if (map._scn) { const j = map._scn.indexOf(e); if (j >= 0) map._scn.splice(j, 1); }
    const rr = rngOf(hashStr(G.mapId + kind + Math.round(e.x * 100) + ',' + Math.round(e.y * 100)) ^ 0x5A5A);
    const pieces = addDebris(e, kind, rr);
    stats.smashed++;
    addNoise(BAL.noise);
    sound('smash'); capLine(TX.capSmash);
    say(kind === 'crate' ? TX.crateSmash : TX.barrelSmash, '', 2200);
    // an owned crate in town, in view of someone who would say so, is a crime like theft
    let crime = false;
    try {
      if (kind === 'crate' && typeof lawActive === 'function' && lawActive()) {
        const wit = typeof theftWitness === 'function' ? theftWitness(null) : null;
        if (wit) { const law = crimeState(); law.thefts = Math.min(9999, law.thefts + 1); reportCrime(TX.crime, BAL.fine); stats.crimes++; crime = true; }
        else say(TX.unseen, 'warn', 2600);
      }
    } catch (err) { stats.errors++; }
    const l = lootFor(G.mapId, e);
    let got = null;
    if (l) { try { got = giveLoot(l); stats.loot++; say(TX.inside.replace('{0}', got), 'good', 4500); } catch (err) { stats.errors++; } }
    return { pieces, loot: l, got, crime };
  }
  // which prop does this swing reach (and is anything else nearer)?
  function target(w) {
    const c = Engine.cam; let best = null, bd = 1e9, foe = 1e9;
    for (const e of G.ents) {
      if (e.hidden || e.dead) continue;
      const dx = e.x - c.x, dy = e.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > w.reach + (e.radius || 0.3)) continue;
      const ang = Math.abs(normAng(Math.atan2(dy, dx) - c.dir));
      if (e.kind === 'enemy' || (e.kind === 'npc' && !e.companion)) { if (ang <= 0.55 && d < foe) foe = d; continue; }
      if (!isBreakable(e)) continue;
      if (ang > 0.55 + Math.atan2(e.radius || 0.3, Math.max(0.2, d))) continue;
      if (typeof los === 'function' && !los(c.x, c.y, e.x, e.y)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best && bd < foe ? best : null;
  }
  function onSwing() {
    if (!breaksOn() || !set.breaks || !hasG()) return null;
    const p = G.player, w = (typeof currentWeapon === 'function') ? currentWeapon() : null;
    if (!w || w.ranged) return null;
    const e = target(w); if (!e) return null;
    const kind = e._scn === 'crate' ? 'crate' : 'barrel';
    e._p14hits = (e._p14hits || 0) + 1;
    const need = hitsNeeded(e, w, p);
    if (e._p14hits >= need) return smash(e, w);
    stats.partial++;
    addNoise(BAL.noisePart); sound('crack'); capLine(TX.capCrack);
    say(kind === 'crate' ? TX.crateCrack : TX.barrelCrack, '', 1800);
    return { partial: true, hits: e._p14hits, need };
  }

  // ================================================================ options
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('p14p-head')) return;
    const el = (tag, props, text) => { const e = document.createElement(tag); if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); } if (text != null) e.textContent = text; return e; };
    grid.appendChild(el('span', { id: 'p14p-head', style: 'grid-column:1/-1;margin-top:1cqh;color:var(--gold);font-family:var(--font-display);letter-spacing:.08em' }, TX.optHead));
    for (const [k, label, hint] of [['mirrors', TX.optMirrors, TX.optMirrorsHint], ['shimmer', TX.optShimmer, TX.optShimmerHint], ['breaks', TX.optBreak, TX.optBreakHint]]) {
      const lab = el('span', { class: 'gfx-label' }, label); lab.appendChild(document.createTextNode(' ')); lab.appendChild(el('small', { class: 'muted' }, hint));
      const b = el('button', { class: 'dfbtn small', id: 'p14p-' + k, type: 'button' }, '');
      const sync = () => { b.textContent = set[k] ? TX.on : TX.off; b.setAttribute('aria-pressed', set[k] ? 'true' : 'false'); b.classList.toggle('sel', set[k]); };
      b.setAttribute('aria-label', label);
      b.onclick = () => { setSwitch(k, !set[k]); sync(); };
      sync(); grid.appendChild(lab); grid.appendChild(b);
    }
  }
  function setSwitch(k, on) {
    if (!(k in set)) return;
    set[k] = !!on; saveSet();
    if (typeof GFX !== 'undefined') {
      if (k === 'mirrors') GFX.p14pMirrors = !!on; if (k === 'shimmer') GFX.p14pShimmer = !!on; if (k === 'breaks') GFX.p14pBreak = !!on;
      if (GFX.changed) { try { GFX.changed(); } catch (e) { /* ignore */ } }
    }
    if (!on && k === 'mirrors') for (const m of MIRRORS) endShade(m);
  }
  function followGfx() {
    if (typeof GFX === 'undefined' || !GFX.onChange) return;
    GFX.onChange(() => { try { set.mirrors = !!GFX.p14pMirrors; set.shimmer = !!GFX.p14pShimmer; set.breaks = !!GFX.p14pBreak; if (!set.mirrors) for (const m of MIRRORS) endShade(m); } catch (e) { /* ignore */ } });
  }

  // ================================================================ wiring
  function wire() {
    if (typeof Engine !== 'undefined' && Engine.addPostHook) {
      Engine.addPostHook(mirrorHook, -4);     // after the dark-interiors pass (-5): the reflection takes the room's light itself, once
      Engine.addPostHook(shimmerHook, -7);
    }
    if (typeof attack === 'function') {
      const _attack = attack;
      attack = function () {
        let was = 0; try { was = G.attack.t; } catch (e) { was = 1; }
        const r = _attack.apply(this, arguments);
        try { if (was <= 0 && G.attack.t > 0) onSwing(); } catch (err) { stats.errors++; console.warn('props14 swing failed', err); }
        return r;
      };
    }
    if (typeof update === 'function') {
      const _up = update;
      update = function (dt) {
        const r = _up.apply(this, arguments);
        try {
          if (dt > 0 && hasG() && G.state === 'play') { tickMirrors(dt); tickDebris(dt); }
        } catch (err) { stats.errors++; }
        return r;
      };
    }
    if (typeof loadMap === 'function') {
      const _lm = loadMap;
      loadMap = function () { try { resetMirrors(); debris.length = 0; } catch (e) { /* nothing */ } return _lm.apply(this, arguments); };
    }
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () { try { resetMirrors(); debris.length = 0; seals.clear(); } catch (e) { /* ignore */ } return _rg.apply(this, arguments); };
    }
    if (typeof wallLabel === 'function') {
      const _wl = wallLabel;
      wallLabel = function (cell) {
        if (mirrorsOn() && hasG()) {
          try {
            const w = Engine.pickWall(2.0);
            if (w && w.cell === cell) for (const m of mirrorsOf(G.mapId)) if (m.cx === w.x && m.cy === w.y && mirrorValid(G.map, m)) return mirrorText(m);
          } catch (e) { /* the wall's own text */ }
        }
        return _wl.apply(this, arguments);
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('props14 rows failed', e); }
        return r;
      };
    }
  }

  loadSet();
  try { wire(); followGfx(); } catch (e) { console.warn('props14 wiring failed', e); }

  return {
    BAL, LOOT, MIRRORS, SEALS, KIND_COL, TX, TEXTS: LIST, set, stats, KEY,
    chance, decideRoll, tickMirror, tickMirrors, startShade, endShade, resetMirrors, mirrorValid, mirrorHook, drawMirror, viewInfo,
    figureFor, gearOf, shadeArt, shimmerHook, sealTarget, sealState, sealSealed, seals, sealsOf, doorAxis,
    isBreakable, lootFor, giveLoot, hitsNeeded, weaponPower, smash, onSwing, target, debris, tickDebris, setSwitch, appendRows, DEB,
    get clock() { return sealClock; },
    audio: 'a private noise burst through Audio_.sfxBus for the smash; mirrors and shimmer are silent',
  };
})();
if (typeof window !== 'undefined') window.PROPS14 = PROPS14;
