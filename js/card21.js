// ============================================================
//  card21 — Phase 21 "Wow", team CARD: the character card, one likeness for every figure of the player.
//
//  WHAT IT DOES
//   * THE CARD. The inventory's paper doll and the Character panel show a large pixel-art figure of the traveller
//     (176 x 352, about three times the old doll's detail) built in layers from what is worn and held: the calling's
//     clothes and cloak, the face chosen at creation (sampled from the portrait itself), hair, the glass arm (and how
//     far the glass has climbed), every head, body, hands, feet and shield piece in js/data.js, the readied weapon in the
//     hand (two-handers in both hands, the shield on the off-arm, or slung on the back when a two-hander leaves no hand
//     for it), an off-hand blade when dual-wielding. Shaded per pixel (light from the upper left, soft occlusion where
//     parts meet), cloth folds and weave, quilting, leather grain and stitching, mail rings, metal highlights, ink
//     lines between parts and a coloured outline. A rotate button (and drag) turns the figure through eight views
//     (front, side, back...); it breathes at rest (still under reduced motion); equipping anything repaints it at once.
//   * ONE LIKENESS. lookOf(player) reads the gear into a LOOK (catalog ids only, validated); paint(look, view) is a pure
//     function of it. The same painter dresses the co-op partner's figure (js/partner19.js asks partnerFrame) and the
//     ghost (js/ghost18.js asks ghostFrame), so the brother sees your real gear, and the ghost is your own figure made
//     pale. Gear descriptions come from js/gearlook21.js (team BODY's table, GEARLOOK21) when it is loaded, else from
//     the local table below (the same shape), so the card, the first-person body and the partner agree.
//   * Art is procedural (canvas pixels painted by this module), cached per look and view, never per frame.
//
//  SWITCH: GFX.card21 ("Character card: Detailed / Simple" in Options, Graphics & access). It is an ART flag (on in
//  every preset, like the item icons); GFX.plain() turns it off and the Phase 5 painted doll comes back exactly.
//  Security: the card's markup is built from constants only; names and gear go through catalog lookups (ARMOR/WEAPONS
//  own properties); nothing from a save or the network is ever put into HTML.
//
//  CONTRACT (for BODY, SPRITES and the co-op modules)
//   CARD21.lookOf(player?)          -> LOOK  { v:1, cls, ci, face, glass, head, body, hands, feet, shield, stowed, weapon, off }
//   CARD21.lookFromCompact(c)       -> LOOK  from the ghost/partner compact look { cls, face, wpn, arm } (+ c.gear if valid)
//   CARD21.cleanGear(o)             -> a validated gear object or null (for anything that crosses the network)
//   CARD21.sig(look)                -> string, equal looks give equal strings
//   CARD21.paint(look, opts)        -> { w, h, data: Uint32Array ABGR, top, bot, left, right }   opts: { view 0-7, size:
//                                      'card'|'partner'|'ghost', act, ph, loco, breath 0-1, display }
//   CARD21.partnerFrame(b, loco, act, ph, look)  -> the partner's solid figure (80 x 192), as js/partner19.js expects
//   CARD21.ghostFrame(b, loco, act, ph, look)    -> the ghost's pale figure (80 x 192), as js/ghost18.js expects
//   CARD21.gear()                   -> the gear appearance table in use (GEARLOOK21 or the local one)
// ============================================================
'use strict';

const CARD21 = (() => {
  const has = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const warned = new Set();
  const warnOnce = (k, e) => { if (warned.has(k)) return; warned.add(k); try { console.warn('card21: ' + k, e); } catch (x) { /* none */ } };

  // ================================================================ settings
  const KEY = 'octave.card21.v1';
  try { if (typeof GFX !== 'undefined') { if (GFX.card21 === undefined) GFX.card21 = true; if (GFX.FX && !GFX.FX.includes('card21')) GFX.FX.push('card21'); if (!Array.isArray(GFX.ART)) GFX.ART = []; if (!GFX.ART.includes('card21')) GFX.ART.push('card21'); } } catch (e) { /* GFX optional */ }
  const cfg = { override: null };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o.on === 'boolean') { cfg.override = o.on; if (typeof GFX !== 'undefined') GFX.card21 = o.on; } } catch (e) { /* storage blocked */ }
  const on = () => typeof GFX !== 'undefined' && GFX.card21 !== false;

  // ================================================================ THE GEAR TABLE (what each catalog id looks like)
  // Colours are [r,g,b]. kind names the shape the painter builds; mat names the surface (shading and texture).
  // This is the local copy of the shared table's shape (BODY's js/gearlook21.js); unknown ids fall back by slot and name.
  const C = {
    linen: [196, 182, 150], wool: [92, 84, 72], hush: [64, 80, 72], leather: [120, 76, 46], dleather: [74, 48, 32],
    steel: [150, 158, 162], iron: [104, 108, 112], bronze: [168, 116, 56], brass: [196, 156, 76], wood: [112, 78, 48],
    oil: [122, 128, 126], silver: [210, 214, 216], canvas: [128, 70, 52], felt: [104, 96, 88], glass: [96, 200, 210],
    lilac: [190, 150, 220], ivory: [226, 216, 190], lead: [92, 96, 104], navy: [44, 52, 78], paint: [70, 86, 110],
  };
  const LOCAL = {
    v: 1,
    armor: {
      a_cap: { slot: 'head', kind: 'cap', mat: 'leather', col: [124, 82, 48], trim: [70, 46, 28] },
      a_hood: { slot: 'head', kind: 'hood', mat: 'wool', col: C.hush, soft: true },
      a_kettle: { slot: 'head', kind: 'kettle', mat: 'metal', col: C.iron },
      a_bellhelm: { slot: 'head', kind: 'bellhelm', mat: 'metal', col: C.bronze, full: true },
      a_synodrobe: { slot: 'body', kind: 'robe', mat: 'oil', col: C.oil, trim: C.silver, hem: 3, sleeves: 'wide' },
      a_gambeson: { slot: 'body', kind: 'gambeson', mat: 'quilt', col: C.linen, hem: 19, sleeves: 'long', bulk: 0.55 },
      a_jerkin: { slot: 'body', kind: 'jerkin', mat: 'leather', col: C.leather, hem: 22.5, sleeves: 'none', bulk: 0.3 },
      a_hushcoat: { slot: 'body', kind: 'coat', mat: 'wool', col: C.hush, hem: 6, sleeves: 'long', collar: true, bulk: 0.35 },
      a_p22_shroud: { slot: 'body', kind: 'coat', mat: 'wool', col: [106, 102, 94], hem: 4, sleeves: 'long', collar: true, bulk: 0.45 },   // Phase 22b
      a_p22_barrowhelm: { slot: 'head', kind: 'kettle', mat: 'metal', col: C.bronze },   // Phase 22b
      a_p22_droverboots: { slot: 'feet', kind: 'hobnail', mat: 'leather', col: [60, 44, 30], top: 12 },   // Phase 22b
      a_p22_mantle: { slot: 'body', kind: 'coat', mat: 'wool', col: [206, 198, 174], hem: 12, sleeves: 'long', collar: true, bulk: 0.4 },   // Phase 22: Farrant fleece
      a_brig: { slot: 'body', kind: 'brig', mat: 'canvas', col: C.canvas, trim: C.brass, hem: 22, sleeves: 'none', bulk: 0.5 },
      a_chain: { slot: 'body', kind: 'mail', mat: 'mail', col: C.steel, hem: 19.5, sleeves: 'elbow', bulk: 0.3 },
      a_plate: { slot: 'body', kind: 'plate', mat: 'metal', col: C.bronze, under: 'mail', hem: 21, sleeves: 'pauldron', bulk: 0.7 },
      a_gloves: { slot: 'hands', kind: 'gloves', mat: 'leather', col: [112, 72, 44] },
      a_gauntlets: { slot: 'hands', kind: 'gauntlets', mat: 'mail', col: C.steel, palm: C.dleather },
      a_softboots: { slot: 'feet', kind: 'soft', mat: 'felt', col: C.felt, top: 10 },
      a_hobnails: { slot: 'feet', kind: 'hobnail', mat: 'leather', col: [64, 44, 32], top: 9, studs: true },
      a_greaves: { slot: 'feet', kind: 'greaves', mat: 'metal', col: C.steel, boot: [70, 50, 36], top: 15 },
      a_buckler: { slot: 'shield', kind: 'buckler', mat: 'metal', col: C.steel, face: [96, 70, 48], r: 3.1 },
      a_kite: { slot: 'shield', kind: 'kite', mat: 'paint', col: C.paint, rim: C.brass, emblem: [214, 206, 188], h: 15 },
    },
    weapons: {
      hands: { kind: 'fists' },
      glass: { kind: 'glassarm' },
      sword: { kind: 'blade', len: 13, wid: 1.0, blade: 'steel', guard: 'cross', grip: 'leather', pommel: 'iron' },
      longsword: { kind: 'blade', len: 17, wid: 1.05, blade: 'steel', guard: 'wide', grip: 'leather', pommel: 'iron', gripLen: 4.4 },
      tobin_blade: { kind: 'blade', len: 17, wid: 1.0, blade: 'bronze', guard: 'ring', grip: 'wood', pommel: 'brass', gripLen: 4, engraved: true },
      knife: { kind: 'blade', len: 6, wid: 0.75, blade: 'steel', guard: 'none', grip: 'wood', pommel: 'none' },
      throwknife: { kind: 'blade', len: 5.5, wid: 0.7, blade: 'steel', guard: 'none', grip: 'leather', pommel: 'ring', spare: 3 },
      sable_dagger: { kind: 'blade', len: 7, wid: 0.6, blade: 'lilac', guard: 'none', grip: 'ivory', pommel: 'ivory' },
      p22_crook: { kind: 'glaive', len: 30, head: 'bronze', haft: 'ash', two: true },   // Phase 22b
      p22_shears: { kind: 'blade', len: 6, wid: 0.8, blade: 'steel', guard: 'none', grip: 'wood', pommel: 'ring' },
      p22_leafblade: { kind: 'blade', len: 14, wid: 1.15, blade: 'bronze', guard: 'none', grip: 'wood', pommel: 'brass' },
      p12_dirk: { kind: 'blade', len: 7.5, wid: 0.8, blade: 'steel', guard: 'basket', grip: 'leather', pommel: 'iron' },
      p12_glassblade: { kind: 'blade', len: 22, wid: 1.25, blade: 'glass', guard: 'wide', grip: 'leather', pommel: 'brass', gripLen: 6, two: true },
      axe: { kind: 'axe', len: 14, head: 'steel', haft: 'wood', beard: true, spike: true },
      vesper_hook: { kind: 'axe', len: 15, head: 'dsteel', haft: 'dwood', beard: true, spike: true, big: true },
      mace: { kind: 'mace', len: 12, head: 'bronze', haft: 'wood' },
      tollhammer: { kind: 'hammer', len: 13, head: 'bronze', haft: 'wood' },
      spear: { kind: 'fork', len: 30, head: 'bronze', haft: 'ash', two: true },
      p12_bellglaive: { kind: 'glaive', len: 32, head: 'bronze', haft: 'ash', two: true },
      maul: { kind: 'maul', len: 17, head: 'iron', haft: 'wood', gauge: true, two: true },
      p12_greatmaul: { kind: 'maul', len: 22, head: 'lead', haft: 'ash', big: true, two: true },
      pistol: { kind: 'pistol', len: 7.5, body: 'wood', metal: 'brass' },
      crossbow: { kind: 'crossbow', len: 11, body: 'wood', metal: 'iron', two: true },
    },
    // the callings' own clothes: coat/tunic, trousers, cloak (accent), robe skirt for the robed callings
    calling: {
      blade: { coat: [96, 70, 50], shirt: [150, 132, 104], trousers: [62, 56, 50], cloak: [104, 46, 38], coatKind: 'jerkin' },
      cantor: { coat: [86, 66, 92], shirt: [176, 160, 130], trousers: [58, 50, 58], cloak: [112, 84, 118], robe: true, sash: [176, 140, 70] },
      corsair: { coat: [52, 64, 88], shirt: [196, 186, 164], trousers: [70, 60, 48], cloak: [128, 48, 40], sash: [150, 44, 36], coatKind: 'longcoat' },
      archivist: { coat: [80, 82, 58], shirt: [170, 160, 132], trousers: [56, 54, 44], cloak: [72, 76, 52], robe: true, sash: [120, 98, 150] },
      penitent: { coat: [104, 100, 94], shirt: [160, 150, 136], trousers: [62, 58, 54], cloak: [126, 120, 110], robe: true, sash: [176, 96, 40] },
      quarry: { coat: [124, 98, 64], shirt: [150, 130, 100], trousers: [66, 58, 46], cloak: [90, 66, 46], coatKind: 'canvas', rolled: true },
    },
    // the six faces: skin, hair and its style, default headwear (as in the portrait), and where the face sits in it
    faces: {
      1: { skin: [184, 136, 104], hair: [56, 44, 36], style: 'short', wear: 'hood', wearCol: [74, 70, 62], stubble: true, eyeY: 48, chinY: 80 },
      2: { skin: [214, 160, 126], hair: [156, 64, 34], style: 'braids', eyeY: 44, chinY: 76 },
      3: { skin: [188, 128, 92], hair: [210, 206, 196], style: 'short', wear: 'captain', beard: [214, 210, 200], eyeY: 48, chinY: 86 },
      4: { skin: [224, 186, 166], hair: [28, 24, 30], style: 'fringe', wear: 'hood', wearCol: [42, 46, 64], eyeY: 41, chinY: 80 },
      5: { skin: [172, 120, 90], hair: null, style: 'bald', scar: true, eyeY: 50, chinY: 75 },
      6: { skin: [226, 192, 174], hair: [198, 202, 208], style: 'long', streak: true, eyeY: 45, chinY: 80 },
    },
  };
  // BODY's shared table (js/gearlook21.js, GEARLOOK21) is the source of truth for what each piece IS (shape, material,
  // colours, lengths); this painter's own table only adds how to BUILD it (hem heights in body units, poses). Shared
  // entries are translated into the local shape once and cached; anything the shared table lacks falls back to LOCAL.
  const HW = 3;   // one hand-width (about 9 cm) in body units (a body is about 57 units, 175 cm)
  const SH_KIND = { cap: 'cap', hood: 'hood', kettle: 'kettle', bellhelm: 'bellhelm', robe: 'robe', gambeson: 'gambeson', jerkin: 'jerkin', longcoat: 'coat', brigandine: 'brig', hauberk: 'mail', cuirass: 'plate', shirt: null,
    gloves: 'gloves', gauntlets: 'gauntlets', softboots: 'soft', hobnails: 'hobnail', greaves: 'greaves', shoes: null, buckler: 'buckler', kite: 'kite' };
  const MAT_KIND = { leather: 'leather', hushwool: 'wool', iron: 'metal', bellbronze: 'metal', steel: 'metal', oilcloth: 'oil', quilt: 'quilt', canvas: 'canvas', mail: 'mail', felt: 'felt', wood: 'wood', linen: 'cloth', skin: 'skin', glass: 'glass' };
  const WK_KIND = { fists: 'fists', glassarm: 'glassarm', sword: 'blade', longsword: 'blade', greatsword: 'blade', knife: 'blade', dirk: 'blade', throwing: 'blade', axe: 'axe', mace: 'mace', hammer: 'hammer', maul: 'maul', spear: 'fork', glaive: 'glaive', pistol: 'pistol', crossbow: 'crossbow' };
  let adapted = null, adaptedFrom = null;
  function adaptArmor(e, loc) {
    const kind = SH_KIND[e.shape]; if (!kind) return loc || null;
    const col = e.col && e.col.base ? e.col.base : (loc && loc.col) || C.linen;
    const o = Object.assign({}, loc || {}, { slot: e.slot, kind, mat: MAT_KIND[e.material] || (loc && loc.mat) || 'cloth', col, shared: true });
    if (e.col && e.col.trim) o.trim = e.col.trim;
    if (e.slot === 'body') {
      if (Number.isFinite(e.len)) o.hem = clamp(27.5 - e.len * 25.5, 2.5, 26);
      const sl = e.sleeve || null;
      if (sl) {
        o.sleeveMat = MAT_KIND[sl.material] || 'cloth'; o.sleeveCol = sl.col || col; o.rolled = !!sl.rolled; o.cuff = sl.cuff || null;
        o.sleeves = sl.wide ? 'wide' : kind === 'plate' ? 'pauldron' : 'long';
        if (sl.bracer) o.bracer = { col: sl.plated ? col : kind === 'jerkin' ? col : (e.col.shade || col), mat: sl.plated ? 'metal' : MAT_KIND[e.material] === 'metal' ? 'metal' : 'leather' };
      }
      if (kind === 'mail' && o.bulk == null) o.bulk = 0.3;
    }
    if (e.slot === 'hands' && e.col && e.col.trim) o.palm = e.col.trim;
    if (e.slot === 'feet') { o.top = kind === 'soft' ? 6 : kind === 'hobnail' ? 10 : kind === 'greaves' ? 15 : (o.top || 9); if (kind === 'greaves' && e.col.trim) o.boot = e.col.trim; if (kind === 'hobnail') o.studs = true; }
    if (e.slot === 'shield') {
      const f = e.face || {};
      // sizes as the shared table gives them (cm when present: one body unit is about 3 cm), no clamps of our own
      const CM = 1 / 3, cm = e.cm && Number.isFinite(e.cm.w) && Number.isFinite(e.cm.h) ? e.cm : null;
      if (kind === 'buckler') { o.r = cm ? cm.w / 2 * CM : (e.radius || 1.4) * HW; o.face = f.field || o.face; o.band = f.figure || null; o.col = f.rim || col; o.boss = f.boss || null; }
      else { o.h = cm ? cm.h * CM : (e.height || 6) * HW; o.wTop = cm ? cm.w / 2 * CM : (e.width || 4) * HW / 2; o.col = f.field || col; o.emblem = f.figure || o.emblem; o.rim = f.rim || o.rim; o.boss = f.boss || null; }
    }
    return o;
  }
  function adaptWeapon(e, loc) {
    const kind = WK_KIND[e.kind] || 'blade', c = e.col || {};
    const o = Object.assign({}, loc || {}, { kind, shared: true, id: e.id });
    const total = (e.len || 8) * HW;
    if (kind === 'blade') {
      o.len = clamp(total * 0.76, 5, 30); o.wid = e.kind === 'greatsword' ? 1.3 : e.kind === 'longsword' ? 1.05 : e.kind === 'sword' ? 1.0 : 0.72;
      o.gripLen = e.kind === 'greatsword' ? 6 : e.kind === 'longsword' ? 4.4 : total > 14 ? 3.4 : 2.4;
      o.two = e.grip === 'two';
      if (e.kind === 'dirk') o.guard = 'basket'; else if (e.kind === 'knife' || e.kind === 'throwing') o.guard = o.guard || 'none'; else if (!o.guard) o.guard = 'cross';
      if (e.material === 'glass') o.blade = (c.edge && c.edge[0] > c.edge[2]) ? 'glass' : (o.blade === 'lilac' ? 'lilac' : 'glass');
    } else if (kind === 'fork' || kind === 'glaive') o.len = clamp(total, 20, 34);
    else if (kind === 'maul' || kind === 'axe' || kind === 'mace' || kind === 'hammer') o.len = clamp(total * 0.85, 10, 24);
    else if (kind === 'crossbow') o.len = clamp(total * 0.5, 9, 14);
    else if (kind === 'pistol') o.len = clamp(total * 0.5, 6, 9);
    o.cols = { blade: c.blade || null, edge: c.edge || null, grip: c.grip || null, guard: c.guard || null, head: c.head || c.blade || null };
    o.two = o.two || e.grip === 'two';
    return o;
  }
  function gear() {
    let S = null;
    try { if (typeof GEARLOOK21 === 'object' && GEARLOOK21 && GEARLOOK21.ARMOR && GEARLOOK21.WEAPONS) S = GEARLOOK21; } catch (e) { S = null; }
    if (!S) return LOCAL;
    if (adapted && adaptedFrom === S) return adapted;
    const A = { v: 1, shared: true, armor: {}, weapons: {}, calling: {}, faces: {} };
    try {
      for (const id of Object.keys(S.ARMOR)) { const o = adaptArmor(S.ARMOR[id], LOCAL.armor[id]); if (o) A.armor[id] = o; }
      for (const id of Object.keys(S.WEAPONS)) A.weapons[id] = adaptWeapon(S.WEAPONS[id], LOCAL.weapons[id]);
      for (const id of Object.keys(LOCAL.calling)) { const c = S.CALLINGS && S.CALLINGS[id]; A.calling[id] = Object.assign({}, LOCAL.calling[id], c ? { coat: c.coat, cloak: c.accent } : {}); }
      for (const n of [1, 2, 3, 4, 5, 6]) {
        const f = S.FACES && S.FACES[n], lf = LOCAL.faces[n];
        A.faces[n] = Object.assign({}, lf, f ? { skin: f.skin, hair: lf.hair ? f.hair : null } : {});
      }
      if (S.GLASS && S.GLASS.base) A.glass = S.GLASS.base;
    } catch (e) { warnOnce('shared table', e); return LOCAL; }
    adapted = A; adaptedFrom = S;
    return A;
  }
  function gearEntry(kind, id) {
    const T = gear(), L = LOCAL[kind] || {};
    const a = T[kind] && has(T[kind], id) ? T[kind][id] : null, b = has(L, id) ? L[id] : null;
    return a || b;
  }
  // an armour id with no table entry: guessed from its slot and name, as the Phase 5 doll did
  function armorLook(id) {
    const e = gearEntry('armor', id); if (e) return e;
    if (!has(typeof ARMOR === 'object' ? ARMOR : null, id)) return null;
    const a = ARMOR[id], n = String(a.name || ''), slot = a.slot;
    const mat = /Hush/.test(n) ? 'wool' : /Chain|Mail/.test(n) ? 'mail' : /Bell-|Carillon|Bronze/.test(n) ? 'metal' : /Iron|Steel|Plate|Brigandine/.test(n) ? 'metal' : /Leather/.test(n) ? 'leather' : 'cloth';
    const col = mat === 'metal' ? (/Bell-|Carillon|Bronze/.test(n) ? C.bronze : C.steel) : mat === 'mail' ? C.steel : mat === 'leather' ? C.leather : mat === 'wool' ? C.hush : C.linen;
    if (slot === 'head') return { slot, kind: mat === 'metal' ? 'kettle' : mat === 'wool' || mat === 'cloth' ? 'hood' : 'cap', mat, col };
    if (slot === 'body') return { slot, kind: mat === 'mail' ? 'mail' : mat === 'metal' ? 'plate' : mat === 'leather' ? 'jerkin' : 'gambeson', mat: mat === 'cloth' ? 'quilt' : mat, col, hem: 20, sleeves: mat === 'leather' ? 'none' : 'long', bulk: 0.4 };
    if (slot === 'hands') return { slot, kind: mat === 'mail' || mat === 'metal' ? 'gauntlets' : 'gloves', mat: mat === 'metal' ? 'mail' : mat, col, palm: C.dleather };
    if (slot === 'feet') return { slot, kind: mat === 'metal' ? 'greaves' : 'hobnail', mat: mat === 'metal' ? 'metal' : 'leather', col: mat === 'metal' ? C.steel : [70, 50, 36], top: 10, boot: [70, 50, 36] };
    if (slot === 'shield') return { slot, kind: /Kite|Tower/.test(n) ? 'kite' : 'buckler', mat: 'metal', col: C.steel, face: [96, 70, 48], rim: C.brass, emblem: [214, 206, 188], r: 3.1, h: 15 };
    return null;
  }
  function weaponLook(wid) {
    const e = gearEntry('weapons', wid); if (e) return e;
    const W = typeof WEAPONS === 'object' && has(WEAPONS, wid) ? WEAPONS[wid] : null;
    if (!W) return LOCAL.weapons.hands;
    const blade = W.type === 'glass' ? 'glass' : W.type === 'bronze' ? 'bronze' : 'steel';
    if (W.ranged) return W.twoHanded || W.ammo === 'bolts' ? Object.assign({}, LOCAL.weapons.crossbow) : W.ammo === 'tknives' ? Object.assign({}, LOCAL.weapons.throwknife) : Object.assign({}, LOCAL.weapons.pistol);
    if (W.blunt) return W.twoHanded ? { kind: 'maul', len: 18, head: 'iron', haft: 'wood', two: true } : { kind: 'mace', len: 12, head: blade === 'bronze' ? 'bronze' : 'iron', haft: 'wood' };
    if (W.cleave) return { kind: 'axe', len: 14, head: 'steel', haft: 'wood', beard: true };
    if (W.reach >= 2) return { kind: 'fork', len: 30, head: blade === 'glass' ? 'glass' : 'bronze', haft: 'ash', two: true };
    return { kind: 'blade', len: clamp((W.reach || 1.3) * 10, 5, 22), wid: 1, blade, guard: 'cross', grip: 'leather', pommel: 'iron', two: !!W.twoHanded };
  }

  // ================================================================ THE DEAD QUEEN (the Synod Kite Shield's emblem, shared)
  // A crowned ivory head in profile, facing right (forehead, nose, lips, chin, neck, a bust), after FOLK's Synod Kite Shield
  // icon (js/icons.js PIX.a_kite). One small bitmap for every painter of the shield: the card, the partner and ghost, and
  // BODY's first-person shield. Cells: '.' the red field (transparent here), g crown gold, G crown jewel shade, i ivory,
  // s ivory shade (hair, the back of the head, the neck), k the eye and the parted lips. [PROPOSED] the exact drawing.
  const QUEEN = Object.freeze({ w: 16, h: 23, rows: Object.freeze([
    '....g..g..g.....',
    '....gggggggg....',
    '....gGgGgGgG....',
    '....gggggggg....',
    '....siiiiii.....',
    '...siiiiiiii....',
    '...siiiiiiiii...',
    '..ssiiiiiiiii...',
    '..ssiiiiiissi...',
    '..sssiiiiiikii..',
    '..sssiiiiiiiiii.',
    '..sssiiiiiiiisii',
    '...ssiiiiiiiii..',
    '...ssiiiiiiiii..',
    '...ssiiiiiiik...',
    '...ssiiiiiiiii..',
    '.....siiiiiii...',
    '......sisssi....',
    '......ssii......',
    '......ssii......',
    '......ssii......',
    '...siiiiiiiiii..',
    '..siiiiiiiiiiii.',
  ]),
    pal: Object.freeze({ g: [214, 170, 80], G: [150, 104, 40], i: [226, 214, 186], s: [170, 152, 124], k: [50, 36, 40] }) });
  const queenCell = (cx, cy) => (cx < 0 || cy < 0 || cx >= QUEEN.w || cy >= QUEEN.h ? '.' : QUEEN.rows[cy][cx]);
  // the emblem as pixels: { w, h, data: Uint32Array (ABGR, transparent field), cells } at an integer scale (default 1)
  const queenCache = new Map();
  function queenEmblem(scale, pal) {
    const k = Math.max(1, Math.min(16, scale | 0 || 1)), P = Object.assign({}, QUEEN.pal, pal || {}), key = k + JSON.stringify(pal || 0);
    if (queenCache.has(key)) return queenCache.get(key);
    const w = QUEEN.w * k, h = QUEEN.h * k, data = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = queenCell((x / k) | 0, (y / k) | 0), col = P[c]; if (col) data[y * w + x] = ((255 << 24) | (col[2] << 16) | (col[1] << 8) | col[0]) >>> 0; }
    const out = { w, h, data, cells: QUEEN }; queenCache.set(key, out); return out;
  }

  // ================================================================ THE LOOK (validated catalog ids only)
  const CLS_IDS = ['blade', 'cantor', 'corsair', 'archivist', 'penitent', 'quarry'];
  const SLOTS = ['head', 'body', 'hands', 'feet', 'shield'];
  const armorOk = (id, slot) => typeof id === 'string' && id.length < 40 && typeof ARMOR === 'object' && has(ARMOR, id) && ARMOR[id].slot === slot;
  const weaponOk = (id) => typeof id === 'string' && id.length < 40 && typeof WEAPONS === 'object' && has(WEAPONS, id);
  function offHand(p) {
    try {
      if (typeof ARMS12 !== 'object' || !ARMS12.offId || !G || G.player !== p) return null;
      if (typeof ARMS12.dualActive === 'function' ? !ARMS12.dualActive() : !(ARMS12.S && ARMS12.S.dual)) return null;
      const id = ARMS12.offId(); return weaponOk(id) && id !== (p.weapons || [])[p.weapon] ? id : null;
    } catch (e) { return null; }
  }
  function lookOf(p) {
    p = p || (typeof G !== 'undefined' ? G.player : null);
    const L = { v: 1, cls: 'blade', ci: 0, face: 1, glass: 0, head: null, body: null, hands: null, feet: null, shield: null, stowed: false, weapon: 'hands', off: null };
    if (!p || typeof p !== 'object') return L;
    const cid = p.cls && typeof p.cls === 'object' ? p.cls.id : p.cls;
    const ci = CLS_IDS.indexOf(cid); L.ci = ci >= 0 ? ci : 0; L.cls = CLS_IDS[L.ci];
    L.face = [1, 2, 3, 4, 5, 6].includes(p.face) ? p.face : 1;
    const glassed = !!p.glassed;   // as js/gearlook21.js reads it (the Dissonant Blade's left arm)
    L.glass = glassed ? clamp(Math.round(Number.isFinite(p.glass) ? p.glass : 0), 0, 100) : -1;
    const ar = p.armor && typeof p.armor === 'object' ? p.armor : {};
    for (const s of SLOTS) L[s] = armorOk(ar[s], s) ? ar[s] : null;
    const ws = Array.isArray(p.weapons) ? p.weapons : [];
    const w = ws[p.weapon | 0];
    L.weapon = weaponOk(w) ? w : 'hands';
    const two = !!(WEAPONS[L.weapon] && WEAPONS[L.weapon].twoHanded) || !!(weaponLook(L.weapon).two);
    L.stowed = !!(L.shield && two);
    L.off = two || L.shield ? null : offHand(p);
    return L;
  }
  // validate a gear object that came from elsewhere (a save, the network): only catalog ids survive
  function cleanGear(o) {
    if (!o || typeof o !== 'object') return null;
    const L = { v: 1, cls: 'blade', ci: 0, face: 1, glass: -1, head: null, body: null, hands: null, feet: null, shield: null, stowed: false, weapon: 'hands', off: null };
    const ci = CLS_IDS.indexOf(o.cls); L.ci = ci >= 0 ? ci : clamp(o.ci | 0, 0, 5); L.cls = CLS_IDS[L.ci];
    L.face = [1, 2, 3, 4, 5, 6].includes(o.face) ? o.face : 1;
    L.glass = Number.isFinite(o.glass) && o.glass >= 0 ? clamp(Math.round(o.glass), 0, 100) : -1;
    for (const s of SLOTS) L[s] = armorOk(o[s], s) ? o[s] : null;
    L.weapon = weaponOk(o.weapon) ? o.weapon : 'hands';
    const two = !!(WEAPONS[L.weapon] && WEAPONS[L.weapon].twoHanded);
    L.stowed = !!(L.shield && two);
    L.off = !two && !L.shield && weaponOk(o.off) && !(WEAPONS[o.off].twoHanded) && !WEAPONS[o.off].ranged ? o.off : null;
    return L;
  }
  const sig = (L) => [L.ci, L.face, L.glass, L.head, L.body, L.hands, L.feet, L.shield, L.stowed ? 1 : 0, L.weapon, L.off].join('|');
  // the ghost painter's compact look -> the nearest LOOK; a remembered full look for this compact one wins (your own
  // ghosts wear what you wore), else the bits are read as gear
  const WK_IDS = ['hands', 'sword', 'knife', 'longsword', 'axe', 'mace', 'spear', 'pistol', 'crossbow', 'glass'];
  const remembered = new Map();
  const REM_KEY = 'octave.card21.looks';
  try { const o = JSON.parse(localStorage.getItem(REM_KEY) || 'null'); if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, 48)) { const g = cleanGear(o[k]); if (g && /^\d+,\d+,\d+,\d+$/.test(k)) remembered.set(k, g); } } catch (e) { /* none */ }
  const compactKey = (c) => [c.cls | 0, c.face | 0, c.wpn | 0, c.arm | 0].join(',');
  let bumpRem = () => {};
  function remember(c, L) {
    try {
      const k = compactKey(c), old = remembered.get(k); if (old && sig(old) === sig(L)) return;
      remembered.delete(k); remembered.set(k, L); while (remembered.size > 48) remembered.delete(remembered.keys().next().value); bumpRem();
      const o = {}; for (const [kk, v] of remembered) o[kk] = v; localStorage.setItem(REM_KEY, JSON.stringify(o));
    } catch (e) { /* storage blocked: fine */ }
  }
  function lookFromCompact(c) {
    if (!c || typeof c !== 'object') return lookOf(null);
    if (c.gear) { const g = cleanGear(c.gear); if (g) return g; }
    const r = remembered.get(compactKey(c)); if (r) return r;
    const arm = c.arm | 0, hk = arm & 3, bk = (arm >> 2) & 3;
    const L = cleanGear({ ci: clamp(c.cls | 0, 0, 5), face: c.face, glass: (c.cls | 0) === 0 ? 20 : -1, weapon: WK_IDS[c.wpn | 0] || 'sword',
      head: [null, 'a_cap', 'a_hood', 'a_kettle'][hk], body: [null, 'a_gambeson', 'a_jerkin', null][bk], hands: arm & 32 ? 'a_gloves' : null, shield: arm & 16 ? 'a_buckler' : null });
    L.cls = CLS_IDS[L.ci];
    return L;
  }

  // ================================================================ COLOUR RAMPS (pixel-art: hue-shifted shades)
  const N_TONE = 8;
  const SH_COOL = [46, 38, 70], HI_WARM = [255, 240, 196];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rampCache = new Map();
  // 8 tones, darkest first: shadows lean cool and violet, lights lean warm; metal ramps are wider and end near white
  function ramp(c, kind) {
    const k = c.join(',') + kind; let r = rampCache.get(k); if (r) return r;
    r = [];
    const metal = kind === 'metal' || kind === 'mail' || kind === 'glass';
    const F = metal ? [0.24, 0.4, 0.56, 0.74, 0.92, 1.1, 1.32, 1.6] : kind === 'skin' ? [0.42, 0.56, 0.68, 0.8, 0.92, 1.03, 1.13, 1.22] : [0.3, 0.44, 0.58, 0.72, 0.86, 1.0, 1.14, 1.3];
    for (let i = 0; i < N_TONE; i++) {
      const f = F[i];
      let col = [c[0] * f, c[1] * f, c[2] * f];
      if (f < 1) col = mixc(col, mixc(SH_COOL, c, 0.35), (1 - f) * (kind === 'skin' ? 0.28 : 0.42));
      else col = mixc(col, HI_WARM, (f - 1) * (metal ? 0.55 : 0.35));
      r.push([clamp(Math.round(col[0]), 0, 255), clamp(Math.round(col[1]), 0, 255), clamp(Math.round(col[2]), 0, 255)]);
    }
    rampCache.set(k, r);
    return r;
  }

  // ================================================================ THE RASTERIZER
  // An orthographic figure: body units (f forward, r the figure's right, z up; a body is about 57 units tall) seen from
  // the view angle psi (0 = front). Spheres, capsules (spheres swept along a segment), elliptic sections (stacked
  // ellipses: torso, skirts, head, helms) and slabs (flat shapes with a thickness: blades, shields, plates) write depth,
  // a view-space normal, a material, a part id and texture coordinates into buffers; a shading pass turns those into
  // pixels. Pure: the same look and view always give the same pixels (no Math.random anywhere).
  const TILT = 0.14;
  function makeCtx(W, H, K, psi, FOOT) {
    const N = W * H;
    const u = Math.cos(psi), sn = Math.sin(psi);
    return {
      W, H, K, FOOT, CX: W / 2, u, sn, psi,
      z: new Float32Array(N).fill(-1e9), m: new Uint8Array(N), part: new Uint16Array(N),
      nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N), tu: new Float32Array(N), tv: new Float32Array(N),
      pid: 0, mats: [null],
    };
  }
  // world (f, r, z) -> [screen x, screen y, depth (units, toward the camera)]
  function proj(X, p) { const d = p[0] * X.u + p[1] * X.sn; return [X.CX + X.K * (p[0] * X.sn - p[1] * X.u), X.FOOT - X.K * (p[2] - TILT * d), d]; }
  // world vector -> view vector (x right, y up, z toward the camera)
  function vview(X, v) { return [v[0] * X.sn - v[1] * X.u, v[2], v[0] * X.u + v[1] * X.sn]; }
  function write(X, i, d, nx, ny, nz, m, tu, tv) {
    if (d <= X.z[i]) return;
    X.z[i] = d; X.m[i] = m; X.part[i] = X.pid; X.nx[i] = nx; X.ny[i] = ny; X.nz[i] = nz; X.tu[i] = tu; X.tv[i] = tv;
  }
  // Paints can run in slices (js/card21.js's scheduler): while X.q is set, each primitive queues small pieces of work
  // (a sphere, a few rows of a section or slab) instead of drawing, each remembering its part id.
  function sphere(X, c, rad, m, tu0, tv0, axisV) {
    if (X.q) {
      const pid = X.pid, R = rad * X.K;
      if (R <= 5) { X.q.push(() => { X.pid = pid; sphereNow(X, c, rad, m, tu0, tv0, axisV, -1e9, 1e9); }); return; }
      const sy = proj(X, c)[1];
      for (let ya = Math.floor(sy - R); ya <= sy + R; ya += 5) { const yb = ya + 4; X.q.push(() => { X.pid = pid; sphereNow(X, c, rad, m, tu0, tv0, axisV, ya, yb); }); }
      return;
    }
    sphereNow(X, c, rad, m, tu0, tv0, axisV, -1e9, 1e9);
  }
  function sphereNow(X, c, rad, m, tu0, tv0, axisV, ya, yb) {
    const [sx, sy, sd] = proj(X, c), R = rad * X.K; if (R < 0.35) return;
    const x0 = Math.max(0, Math.floor(sx - R)), x1 = Math.min(X.W - 1, Math.ceil(sx + R)), y0 = Math.max(0, ya, Math.floor(sy - R)), y1 = Math.min(X.H - 1, yb, Math.ceil(sy + R));
    const D = sd * X.K;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - sy) / R;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - sx) / R, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
        const dz = Math.sqrt(1 - d2);
        // texture: around the axis (the view-space axis of a capsule, when given) and along it
        let tu = tu0 || 0, tv = tv0 || 0;
        if (axisV) { const along = dx * axisV[0] - dy * axisV[1]; tv += along * rad; tu += Math.atan2(dx * axisV[1] + dy * axisV[0], dz) * rad; }
        else { tu += Math.atan2(dx, dz) * rad; tv += -dy * rad; }
        write(X, y * X.W + x, D + R * dz, dx, -dy, dz, m, tu, tv);
      }
    }
  }
  // a tapered capsule from a to b, radius r0 to r1 (units)
  function capsule(X, a, b, r0, r1, m) {
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(v[0], v[1], v[2]) || 1e-6;
    const av = vview(X, [v[0] / L, v[1] / L, v[2] / L]), al = Math.hypot(av[0], av[1]) || 1;
    const axis = [av[0] / al, av[1] / al];
    const step = Math.max(0.12, Math.min(r0, r1) * 0.3), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      sphere(X, [a[0] + v[0] * t, a[1] + v[1] * t, a[2] + v[2] * t], r0 + (r1 - r0) * t, m, 0, t * L, axis);
    }
  }
  // stacked ellipses from z0 to z1: centre c(z) = [f, r], half-width a(z) along r, half-depth b(z) along f.
  // opt.back: only the back half (f < centre) exists (a cloak); opt.arc: the half-angle (radians) of the front opening
  function section(X, z0, z1, cfn, afn, bfn, m, opt) {
    if (!X.q) { sectionNow(X, z0, z1, cfn, afn, bfn, m, opt, 0, Infinity); return; }
    const pid = X.pid, n = Math.ceil((z1 - z0) / (0.5 / X.K)) + 1;
    for (let k = 0; k < n; k += 4) { const k0 = k, k1 = k + 3; X.q.push(() => { X.pid = pid; sectionNow(X, z0, z1, cfn, afn, bfn, m, opt, k0, k1); }); }
  }
  function sectionNow(X, z0, z1, cfn, afn, bfn, m, opt, k0, k1) {
    opt = opt || {};
    const dz = 0.5 / X.K, K = X.K, u = X.u, sn = X.sn;
    for (let k = k0, z = z0 + k0 * dz; k <= k1 && z <= z1 + 1e-6; k++, z = z0 + k * dz) {
      const c = cfn(z), a = afn(z), b = bfn(z); if (a <= 0.02 || b <= 0.02) continue;
      const da = (afn(Math.min(z1, z + 0.25)) - afn(Math.max(z0, z - 0.25))) / 0.5, db = (bfn(Math.min(z1, z + 0.25)) - bfn(Math.max(z0, z - 0.25))) / 0.5;
      const [scx, scy, sd] = proj(X, [c[0], c[1], z]);
      const y = Math.round(scy); if (y < 0 || y >= X.H) continue;
      const px0 = b * sn, py0 = -a * u, q0 = b * u, q1 = a * sn, Lp = Math.hypot(px0, py0);
      if (Lp < 1e-6) continue;
      const ph0 = px0 / Lp, ph1 = py0 / Lp, pp0 = -ph1, pp1 = ph0;
      const x0 = Math.max(0, Math.floor(scx - Lp * K)), x1 = Math.min(X.W - 1, Math.ceil(scx + Lp * K));
      for (let x = x0; x <= x1; x++) {
        const al = ((x + 0.5 - scx) / K) / Lp; if (al < -1 || al > 1) continue;
        const be = Math.sqrt(1 - al * al);
        let e0 = al * ph0 + be * pp0, e1 = al * ph1 + be * pp1;
        const f0 = al * ph0 - be * pp0, f1 = al * ph1 - be * pp1;
        // the nearer of the two solutions, or the far one where the near one is cut away
        let near = e0 * q0 + e1 * q1 >= f0 * q0 + f1 * q1;
        if (!near) { const t0 = e0, t1 = e1; e0 = f0; e1 = f1; }
        let ang = Math.atan2(e1, e0);   // 0 = straight forward (the figure's front), +pi/2 = its right
        if ((opt.back && Math.abs(ang) < Math.PI / 2) || (opt.arc && Math.abs(ang) < opt.arc)) {
          // the near surface is cut away: show the inside of the far half (darker), if it is there
          e0 = al * ph0 - be * pp0; e1 = al * ph1 - be * pp1;
          const tmp = e0 * q0 + e1 * q1, other = (al * ph0 + be * pp0) * q0 + (al * ph1 + be * pp1) * q1;
          if (tmp > other) { e0 = al * ph0 + be * pp0; e1 = al * ph1 + be * pp1; }
          ang = Math.atan2(e1, e0);
          if ((opt.back && Math.abs(ang) < Math.PI / 2) || (opt.arc && Math.abs(ang) < opt.arc)) continue;
          const d = (sd + e0 * q0 + e1 * q1) * K;
          let hf = e0 / b, hr = e1 / a; const hl = Math.hypot(hf, hr) || 1; hf /= hl; hr /= hl;
          const v = vview(X, [-hf, -hr, 0]);
          write(X, y * X.W + x, d, v[0] * 0.6, 0.2, v[2] * 0.6 + 0.2, opt.inner || m, ang * (a + b) / 2, z);
          continue;
        }
        const d = (sd + e0 * q0 + e1 * q1) * K;
        let hf = e0 / b, hr = e1 / a; const hl = Math.hypot(hf, hr) || 1; hf /= hl; hr /= hl;
        const slope = da * e1 * e1 + db * e0 * e0;
        const v = vview(X, [hf, hr, -slope]); const vl = Math.hypot(v[0], v[1], v[2]) || 1;
        write(X, y * X.W + x, d, v[0] / vl, v[1] / vl, v[2] / vl, m, ang * (a + b) / 2, z);
      }
    }
  }
  // a flat shape with thickness: centre C, in-plane axes U (length) and V (width), normal W, half-thickness T;
  // mask(u, v) says what is inside; ext = [u0, u1, v0, v1]; bulge(u, v) -> [dh/du, dh/dv] tilts the face (domes)
  // mBack (optional): the material of the face that points away from Wn (a shield's plain back)
  function slab(X, Cc, U, V, Wn, T, ext, mask, m, bulge, mBack) {
    if (!X.q) { slabNow(X, Cc, U, V, Wn, T, ext, mask, m, bulge, 0, X.H - 1, mBack); return; }
    const pid = X.pid;
    for (let ya = 0; ya < X.H; ya += 4) { const yb = ya + 3; X.q.push(() => { X.pid = pid; slabNow(X, Cc, U, V, Wn, T, ext, mask, m, bulge, ya, yb, mBack); }); }
  }
  function slabNow(X, Cc, U, V, Wn, T, ext, mask, m, bulge, ya, yb, mBack) {
    const pts = [];
    for (const uu of [ext[0], ext[1]]) for (const vv of [ext[2], ext[3]]) for (const ww of [-T, T]) pts.push(proj(X, [Cc[0] + U[0] * uu + V[0] * vv + Wn[0] * ww, Cc[1] + U[1] * uu + V[1] * vv + Wn[1] * ww, Cc[2] + U[2] * uu + V[2] * vv + Wn[2] * ww]));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    x0 = Math.max(0, Math.floor(x0) - 1); x1 = Math.min(X.W - 1, Math.ceil(x1) + 1); y0 = Math.max(ya, 0, Math.floor(y0) - 1); y1 = Math.min(yb, X.H - 1, Math.ceil(y1) + 1);
    if (y1 < y0) return;
    const K = X.K, dir = [X.u, X.sn, TILT], dW = dir[0] * Wn[0] + dir[1] * Wn[1] + dir[2] * Wn[2];
    const s = dW >= 0 ? 1 : -1, adW = Math.abs(dW);
    const nW = vview(X, [Wn[0] * s, Wn[1] * s, Wn[2] * s]), vU = vview(X, U), vV = vview(X, V);
    for (let y = y0; y <= y1; y++) {
      const zA = (X.FOOT - (y + 0.5)) / K;
      for (let x = x0; x <= x1; x++) {
        const Xs = (x + 0.5 - X.CX) / K;
        const A0 = Xs * X.sn, A1 = -Xs * X.u, A2 = zA;
        const r0 = Cc[0] - A0, r1 = Cc[1] - A1, r2 = Cc[2] - A2;
        let hit = false, D = 0, uu = 0, vv = 0, rim = false;
        if (adW > 0.04) {
          for (const side of [s, -s]) {
            const D0 = (r0 * Wn[0] + r1 * Wn[1] + r2 * Wn[2] + side * T) / dW;
            const p0 = A0 + dir[0] * D0 - Cc[0], p1 = A1 + dir[1] * D0 - Cc[1], p2 = A2 + dir[2] * D0 - Cc[2];
            const qu = p0 * U[0] + p1 * U[1] + p2 * U[2], qv = p0 * V[0] + p1 * V[1] + p2 * V[2];
            if (mask(qu, qv)) { hit = true; D = D0; uu = qu; vv = qv; rim = side !== s; break; }
          }
        } else {
          // edge-on: march across the thickness
          for (let k = -2; k <= 2 && !hit; k++) {
            const D0 = (r0 * Wn[0] + r1 * Wn[1] + r2 * Wn[2] + k * T / 2) / (dW || 1e-3);
            if (!Number.isFinite(D0) || Math.abs(D0) > 60) continue;
            const p0 = A0 + dir[0] * D0 - Cc[0], p1 = A1 + dir[1] * D0 - Cc[1], p2 = A2 + dir[2] * D0 - Cc[2];
            const qu = p0 * U[0] + p1 * U[1] + p2 * U[2], qv = p0 * V[0] + p1 * V[1] + p2 * V[2];
            if (mask(qu, qv)) { hit = true; D = D0; uu = qu; vv = qv; rim = true; }
          }
        }
        if (!hit) continue;
        let n0, n1, n2;
        if (rim) { const l = Math.hypot(uu, vv) || 1; n0 = (vU[0] * uu + vV[0] * vv) / l; n1 = (vU[1] * uu + vV[1] * vv) / l; n2 = (vU[2] * uu + vV[2] * vv) / l; n2 = Math.max(n2, 0.1); }
        else {
          n0 = nW[0]; n1 = nW[1]; n2 = nW[2];
          if (bulge) { const g = bulge(uu, vv); n0 -= (vU[0] * g[0] + vV[0] * g[1]) * s; n1 -= (vU[1] * g[0] + vV[1] * g[1]) * s; n2 -= (vU[2] * g[0] + vV[2] * g[1]) * s; }
        }
        const nl = Math.hypot(n0, n1, n2) || 1;
        write(X, y * X.W + x, D * K, n0 / nl, n1 / nl, n2 / nl, !rim && s < 0 && mBack ? mBack : m, uu, vv);
      }
    }
  }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b, k) => [a[0] + b[0] * (k == null ? 1 : k), a[1] + b[1] * (k == null ? 1 : k), a[2] + b[2] * (k == null ? 1 : k)];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ================================================================ MATERIALS
  // kind: cloth, wool, quilt, leather, canvas, felt, oil, metal, mail, wood, skin, face, hair, glass, paint, dark, ink
  function mat(X, name, col, kind, o) {
    const key = name + ':' + col.join(',') + ':' + kind;
    X.matIdx = X.matIdx || new Map();
    let i = X.matIdx.get(key); if (i) return i;
    i = X.mats.length; if (i > 250) return 1;
    X.mats.push(Object.assign({ name, kind, col, ramp: ramp(col, kind === 'mail' ? 'mail' : kind === 'metal' || kind === 'glass' ? kind : kind === 'skin' || kind === 'face' ? 'skin' : 'cloth') }, o || {}));
    X.matIdx.set(key, i);
    return i;
  }

  // ================================================================ POSES (joint positions in body units)
  // act / ph / loco follow js/ghost18.js: act 0 idle, 1-5 strikes, 6 shot, 7 song, 8 hurt, 9 block; ph 0-3 the phase;
  // loco 0 standing, 1 and 2 the two walking steps. display = the card's standing pose (weapon shown off).
  const KF = {   // [hand0, dir0, hand1, dir1] (ghost18's swings)
    1: [[0.4, 8.4, 46], [0.2, 0.9, 0.7], [3.0, -1.7, 35], [0.7, -0.8, -0.3]],
    2: [[0.5, 1.7, 46], [0.4, -0.8, 0.8], [3.0, 9.5, 35], [0.6, 0.9, -0.3]],
    3: [[0.2, 6.2, 55], [0.1, 0, 1], [3.4, 3.9, 37], [0.95, 0, -0.45]],
    4: [[2.4, 5.0, 28], [0.9, 0, -0.5], [1.7, 5.0, 49], [0.3, 0, 1]],
    5: [[0.2, 6.2, 38], [1, 0, 0.1], [5.2, 3.9, 38.5], [1, 0, 0.05]],
  };
  function pose(L, W, o) {
    const act = o.act | 0, ph = o.ph | 0, loco = o.loco | 0, br = o.breath || 0, disp = !!o.display;
    const st = loco === 0 ? 0 : loco === 1 ? 1 : -1;
    const lean = act === 8 ? -2.4 : 0, up = act === 7 ? 1.2 : 0;
    const kind = W.kind, two = !!W.two;
    const P = { st, lean, up, br, act, ph };
    // shoulders, neck and head rise a little with each breath
    const lift = br * 0.32;
    P.shR = [lean * 0.4, 6.0 + br * 0.08, 42.4 + lift]; P.shL = [lean * 0.4, -6.0 - br * 0.08, 42.4 + lift];
    P.head = [0.3 + lean * 0.5, 0, 51.4 + up * 0.6 + lift * 0.8];
    P.hipR = [lean * 0.4 * 0.3, 2.6, 27.5]; P.hipL = [lean * 0.4 * 0.3, -2.6, 27.5];
    // legs: standing a little apart (a slight stagger shows both legs in profile); walking, one leads
    for (const side of [1, -1]) {
      const lead = st * side;
      const ff = st ? lead * 3.4 : side * (disp ? 0.5 : 0.9), fr = side * (st ? 2.7 : disp ? 3.4 : 3.3);
      const ank = [ff, fr, st && lead < 0 ? 2.6 : 1.7];
      const hip = side > 0 ? P.hipR : P.hipL;
      const knee = [(hip[0] + ank[0]) / 2 + (st ? 1.0 : 0.35) + (lead < 0 ? 0.6 : 0), side * (st ? 2.6 : 3.0), 14.5];
      const toe = [ank[0] + 2.9, ank[1] + side * (disp ? 0.5 : 0), st && lead < 0 ? 0.75 : 0.7], heel = [ank[0] - 0.7, ank[1], st && lead < 0 ? 2.4 : 0.7];
      P[side > 0 ? 'legR' : 'legL'] = { hip, knee, ank, toe, heel };
    }
    // hands: the weapon hand (right) and the off hand (left)
    const armR = disp ? 9.0 : 10.2;   // in the world the arms hang clear of the body and cloak (readable at a distance)
    const swing = st * 2.6;
    let wH = [(st ? 0.4 : -0.4) - swing, armR, 25.5], wV = (kind === 'axe' || kind === 'mace' || kind === 'hammer' || kind === 'fork' || kind === 'glaive' || kind === 'maul') ? [0.35, 0.1, 0.93] : [0.5, 0.12, -0.86];
    let offH = [(st ? 0.4 : 1.4) + swing, -armR, 25.5], offV = [0.5, -0.12, -0.86], block = false, twoGrip = null;
    if (disp && act === 0) {
      // the card's pose: each kind of weapon shown off, both hands on a two-hander
      if (kind === 'blade' && !two) { wH = [2.8, 8.8, 27.5]; wV = norm([0.3, 0.42, 0.86]); }
      else if (kind === 'blade' && two) { wH = [3.6, 0.6, 31.5]; wV = [0.04, 0, -1]; twoGrip = [3.6, -0.6, 30.0]; }
      else if (kind === 'axe' || kind === 'mace' || kind === 'hammer') { wH = [2.6, 8.8, 27]; wV = norm([0.25, 0.32, 0.92]); }
      else if (kind === 'fork' || kind === 'glaive') { wH = [2.4, 8.2, 29]; wV = [0, 0.02, 1]; twoGrip = [2.6, 8.2, 41]; }
      else if (kind === 'maul') { wH = [4.2, 1.2, 31.5]; wV = norm([0.06, 0.12, -1]); twoGrip = [4.2, -0.6, 30.2]; }
      else if (kind === 'pistol') { wH = [3.4, 8.4, 33]; wV = norm([0.25, 0.35, 0.9]); }
      else if (kind === 'crossbow') { wH = [3.6, 4.6, 28.5]; wV = norm([0.32, -0.22, 0.92]); twoGrip = [4.6, 1.6, 34.5]; }
      else if (kind === 'fists') { wH = [4.6, 6.0, 37]; wV = [1, 0, 0]; offH = [5.2, -5.4, 38.5]; }
      else if (kind === 'glassarm') { wH = [1.2, 8.8, 25.5]; wV = [0.5, 0.12, -0.86]; offH = [5.2, -5.8, 37.5]; }
      if (kind !== 'fists' && kind !== 'glassarm' && !twoGrip) {
        if (L.shield && !L.stowed) { offH = [3.6, -7.6, 31]; }
        else if (L.off) { offH = [2.8, -8.8, 27.5]; offV = norm([0.3, -0.42, 0.86]); }
        else offH = [1.0, -8.9, 25.6];
      }
    } else if (act >= 1 && act <= 5) {
      const k = KF[act], t = [0, 0.5, 1, 1.12][ph];
      wH = [0, 1, 2].map((i) => k[0][i] + (k[2][i] - k[0][i]) * t); wV = norm([0, 1, 2].map((i) => k[1][i] + (k[3][i] - k[1][i]) * t));
      offH = [1.2, -8.2, 30];
      if (two && kind !== 'crossbow') twoGrip = add(wH, wV, -3.2);
    } else if (act === 6) { wH = [ph === 2 ? 4.2 : 5.2, 3.6, 42]; wV = [1, 0, 0.02]; offH = [4.2, -1.4, 41]; if (kind === 'crossbow') twoGrip = [7.2, 1.0, 42.4]; }
    else if (act === 7) { wH = [1.4, 8.6, 53 + up]; wV = [0, 0.4, 1]; offH = [1.4, -8.6, 53 + up]; }
    else if (act === 8) { wH = [-1.5, 9.2, 37]; wV = norm([-0.4, 0.3, 0.7]); offH = [-1.5, -9.2, 37]; }
    else if (act === 9) { wH = [4.0, 3.0, 39]; wV = [0.15, 0, 1]; offH = [3.8, -3.2, 37]; block = true; }
    // standing or walking in the world, a two-hander is carried in the weapon hand at the side (a haft upright, a blade
    // or a crossbow pointing down), so the figure's arms stay clear of its body at a distance, as the ghost painter did
    if (twoGrip) offH = twoGrip;
    // in the world a kite shield is carried before the body (a sprite one tile wide must hold all of it)
    if (!disp && act <= 5 && L.shield && !L.stowed && !twoGrip && offH[1] < -7.6) offH = [offH[0] + 0.8, -6.8, offH[2] + (act ? 0 : 2)];
    const wpt = (h) => [h[0] + lean * 0.3, h[1], h[2] + lift * 0.5];
    P.wH = wpt(wH); P.wV = wV; P.offH = wpt(offH); P.offV = offV; P.block = block; P.twoGrip = !!twoGrip; P.display = disp;
    // elbows: two-bone reach with the elbow pushed out and back
    const elbow = (sh, hand, side) => {
      const v = [hand[0] - sh[0], hand[1] - sh[1], hand[2] - sh[2]], d = Math.hypot(v[0], v[1], v[2]);
      const L1 = 8.6, L2 = 8.2, dd = clamp(d, 2, L1 + L2 - 0.05);
      const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const dir = [v[0] / (d || 1), v[1] / (d || 1), v[2] / (d || 1)];
      let pole = [-0.75, side * 0.65, -0.2];
      const pd = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
      pole = norm([pole[0] - dir[0] * pd, pole[1] - dir[1] * pd, pole[2] - dir[2] * pd]);
      return [sh[0] + dir[0] * a + pole[0] * h, sh[1] + dir[1] * a + pole[1] * h, sh[2] + dir[2] * a + pole[2] * h];
    };
    P.elR = elbow(P.shR, P.wH, 1); P.elL = elbow(P.shL, P.offH, -1);
    return P;
  }

  // ================================================================ THE FIGURE (layers from the look)
  const SIZES = { card: { W: 176, H: 352, K: 5.2, FOOT: 336 }, partner: { W: 80, H: 192, K: 3.2, FOOT: 188 }, ghost: { W: 80, H: 192, K: 3.2, FOOT: 188 } };
  function build(X, L, o) {
    const T = gear(), cal = (T.calling && T.calling[L.cls]) || LOCAL.calling[L.cls] || LOCAL.calling.blade;
    const fc = (T.faces && T.faces[L.face]) || LOCAL.faces[L.face] || LOCAL.faces[1];
    const head = L.head ? armorLook(L.head) : null, body = L.body ? armorLook(L.body) : null;
    const hands = L.hands ? armorLook(L.hands) : null, feet = L.feet ? armorLook(L.feet) : null, shield = L.shield ? armorLook(L.shield) : null;
    const W = weaponLook(L.weapon), OW = L.off ? weaponLook(L.off) : null;
    const P = pose(L, W, o);
    const br = P.br;
    const M = (name, col, kind, op) => mat(X, name, col, kind, op);
    const next = () => { X.pid++; };
    // ---- materials of this look
    const mSkin = M('skin', fc.skin, 'skin');
    const robeCalling = !!cal.robe;
    const mShirt = M('shirt', cal.shirt, 'cloth');
    const mTrous = M('trousers', cal.trousers, 'cloth', { fold: 0.5 });
    const mCoat = M('coat', cal.coat, cal.coatKind === 'jerkin' ? 'leather' : cal.coatKind === 'canvas' ? 'canvas' : 'cloth', { fold: 0.6 });
    const mCloak = M('cloak', cal.cloak, 'wool', { fold: 1 });
    const mCloakIn = M('cloakin', mixc(cal.cloak, [20, 16, 18], 0.45), 'wool');
    const mBelt = M('belt', [62, 40, 26], 'leather');
    const mBrass = M('brass', C.brass, 'metal', { spec: 1 });
    const glassOn = L.glass >= 0;
    const mGlass = M('glass', T.glass || C.glass, 'glass', { spec: 1.2, glow: 0.35 + clamp(L.glass, 0, 100) / 400 });
    const bodyMat = (b) => {
      if (!b) return robeCalling ? M('robe', cal.coat, 'cloth', { fold: 1.2 }) : mCoat;
      const k = b.mat === 'metal' ? 'metal' : b.mat === 'mail' ? 'mail' : b.mat === 'quilt' ? 'quilt' : b.mat === 'leather' ? 'leather' : b.mat === 'canvas' ? 'canvas' : b.mat === 'oil' ? 'oil' : b.mat === 'wool' ? 'wool' : 'cloth';
      return M('body:' + b.kind, b.col, k, { spec: k === 'metal' ? 1.1 : k === 'mail' ? 0.6 : k === 'oil' ? 0.35 : 0, fold: k === 'wool' || k === 'oil' || k === 'cloth' ? 1 : 0, kind2: b.kind, trim: b.trim });
    };
    const mBody = bodyMat(body);
    const mUnderMail = body && body.under === 'mail' ? M('undermail', C.steel, 'mail', { spec: 0.6 }) : null;
    // ---- what each arm segment wears
    let upperM = mShirt, foreM = mShirt;
    if (body) {
      const sl = body.sleeves;
      if (sl === 'long' || sl === 'wide') { upperM = mBody; foreM = mBody; }
      else if (sl === 'elbow') { upperM = mBody; foreM = mShirt; }
      else if (sl === 'pauldron') { upperM = mUnderMail || mBody; foreM = mShirt; }
      else { upperM = robeCalling ? M('robe', cal.coat, 'cloth', { fold: 1.2 }) : cal.coatKind === 'longcoat' ? mCoat : mShirt; foreM = upperM; }
    } else if (cal.coatKind === 'longcoat' || robeCalling) { upperM = robeCalling ? M('robe', cal.coat, 'cloth', { fold: 1.2 }) : mCoat; foreM = upperM; }
    else if (cal.coatKind === 'jerkin') { upperM = mShirt; foreM = mShirt; }
    if (cal.rolled && foreM === mShirt) foreM = mSkin;
    // the shared table says exactly what the sleeves are (material, colour, rolled up, a bracer over the forearm)
    let bracerM = null;
    if (body && body.sleeveMat) {
      const sk = body.sleeveMat;
      const sm = sk === body.mat && sk !== 'cloth' ? mBody : M('sleeve:' + sk, body.sleeveCol || body.col, sk === 'metal' ? 'metal' : sk, { spec: sk === 'mail' ? 0.6 : sk === 'metal' ? 1.1 : 0, fold: sk === 'cloth' || sk === 'wool' ? 0.6 : 0 });
      upperM = body.kind === 'plate' ? (mUnderMail || sm) : sm; foreM = body.rolled ? mSkin : sm;
      if (body.kind === 'jerkin' && !robeCalling) upperM = sm;
      if (body.bracer) bracerM = M('bracer:' + body.kind, body.bracer.col, body.bracer.mat === 'metal' ? 'metal' : 'leather', { spec: body.bracer.mat === 'metal' ? 1.1 : 0.2 });
    }
    const handM = hands ? M('hands:' + hands.kind, hands.col, hands.mat === 'mail' ? 'mail' : 'leather', { spec: hands.mat === 'mail' ? 0.6 : 0 }) : mSkin;
    // ---- feet and legs
    const bootTop = feet ? (feet.top || 9) : 5.5;
    const bootM = feet ? (feet.kind === 'greaves' ? M('boot', feet.boot || [70, 50, 36], 'leather') : M('boot:' + feet.kind, feet.col, feet.mat === 'felt' ? 'felt' : 'leather', { studs: !!feet.studs })) : M('shoe', [72, 52, 38], 'leather');
    const greaveM = feet && feet.kind === 'greaves' ? M('greave', feet.col, 'metal', { spec: 1.1 }) : null;
    const leg = (Lg, side) => {
      next(); capsule(X, Lg.hip, Lg.knee, 2.6, 2.05, mTrous); capsule(X, Lg.knee, Lg.ank, 2.0, 1.45, mTrous);
      next();
      // the boot: a shaft up the shin, the foot, a sole
      const kT = clamp((bootTop - Lg.ank[2]) / Math.max(1, Lg.knee[2] - Lg.ank[2]), 0, 1), top = lerp3(Lg.ank, Lg.knee, kT);
      const loose = feet && feet.kind === 'soft' ? 0.18 : 0;
      capsule(X, Lg.ank, top, 1.62 + loose, 1.85 + loose, bootM);
      capsule(X, Lg.heel, Lg.toe, 1.3, 1.1, bootM);
      capsule(X, [Lg.ank[0], Lg.ank[1], Lg.ank[2] + 0.4], lerp3(Lg.heel, Lg.toe, 0.55), 1.45, 1.25, bootM);
      if (!feet || feet.kind !== 'soft') { next(); capsule(X, [Lg.heel[0], Lg.heel[1], 0.42], [Lg.toe[0] + 0.15, Lg.toe[1], 0.36], 0.55, 0.5, M('sole', feet && feet.studs ? [58, 54, 52] : [40, 30, 24], feet && feet.studs ? 'metal' : 'leather', { studs: !!(feet && feet.studs), spec: 0.5 })); }
      if (greaveM) {
        next();
        const g0 = lerp3(Lg.ank, Lg.knee, 0.08), g1 = lerp3(Lg.ank, Lg.knee, 0.92);
        capsule(X, add(g0, [0.45, 0, 0]), add(g1, [0.45, 0, 0]), 1.75, 2.05, greaveM);
        sphere(X, add(Lg.knee, [0.9, 0, 0.3]), 1.65, greaveM);
      }
    };
    // ---- the cloak (behind), the shield slung on the back
    const cloak = () => {
      next();
      const robeLong = robeCalling || (body && (body.kind === 'coat' || body.kind === 'robe'));
      const z0 = robeLong ? 9 : 15;
      const sw = (z) => (P.st ? P.st * (44 - z) * 0.035 : 0);
      section(X, z0, 45.5 + br * 0.3, (z) => [-3.6 - (45 - z) * 0.035 + P.lean * (z / 44) + sw(z) * 0.2, 0], (z) => (o.display ? 6.5 + (45 - z) * 0.07 : 5.4 + (45 - z) * 0.03) - (z > 43 ? (z - 43) * 0.6 : 0), (z) => 1.6 + (45 - z) * 0.03, mCloak, { back: true, inner: mCloakIn });
    };
    const slung = () => {
      if (!shield || !L.stowed) return;
      next();
      shieldShape(shield, [-5.2, 0.6, 35], norm([-1, 0, 0.05]), [0, 0, 1], true);
    };
    // ---- the torso and the body armour
    const torso = () => {
      next();
      const lean = P.lean, br2 = br;
      const fAt = (z) => [lean * (z - 26) / 17, 0];
      const hw = (z) => (z >= 43 ? 6.4 - (z - 43) * 0.62 : z >= 36 ? 5.5 + (z - 36) * 0.129 : z >= 30 ? 4.6 + (z - 30) * 0.15 : 4.75 - (z - 26) * 0.04) + (z > 33 ? br2 * 0.18 : 0);
      const hd = (z) => (z >= 36 ? 3.5 + br2 * 0.3 * clamp((z - 34) / 6, 0, 1) : z >= 30 ? 3.2 : 3.05) - (z > 43.5 ? (z - 43.5) * 0.5 : 0);
      // the shirt or the calling's coat under everything
      const baseM = robeCalling ? M('robe', cal.coat, 'cloth', { fold: 1.2 }) : cal.coatKind === 'longcoat' || cal.coatKind === 'jerkin' || cal.coatKind === 'canvas' ? mCoat : mShirt;
      section(X, 24, 45.2, fAt, hw, hd, baseM);
      if (robeCalling && (!body || (body.kind !== 'robe' && body.kind !== 'coat'))) {
        next();   // the robe's skirt to the shins, swinging with the stride
        const swing = (z) => (P.st ? P.st * (26 - z) * 0.06 : 0);
        section(X, 5.2, 27, (z) => [swing(z), 0], (z) => 4.8 + (27 - z) * 0.135, (z) => 3.2 + (27 - z) * 0.075, M('robe', cal.coat, 'cloth', { fold: 1.2 }));
      } else if (!body && cal.coatKind === 'longcoat') {
        next();
        const swing = (z) => (P.st ? P.st * (26 - z) * 0.05 : 0);
        section(X, 12, 27, (z) => [swing(z) - 0.2, 0], (z) => 4.9 + (27 - z) * 0.11, (z) => 3.25 + (27 - z) * 0.05, mCoat, { arc: 0.32, inner: M('lining', mixc(cal.coat, [30, 20, 18], 0.5), 'cloth') });
      } else if (!body) {
        next();   // the coat's hem over the tops of the thighs
        section(X, 21, 26.5, fAt, (z) => 4.95 + (26.5 - z) * 0.09, () => 3.2, baseM);
      }
      if (body) {
        next();
        const bulk = body.bulk || 0.3, hem = body.hem == null ? 20 : body.hem, k = body.kind;
        const bw = (z) => hw(z) + bulk, bd = (z) => hd(z) + bulk * 0.8;
        if (mUnderMail) { section(X, Math.min(hem, 21), 44.2, fAt, (z) => hw(z) + 0.18 + (z < 27 ? (27 - z) * 0.12 : 0), (z) => hd(z) + 0.16 + (z < 27 ? (27 - z) * 0.05 : 0), mUnderMail); next(); }
        if (k === 'plate') {
          // a bell-cast cuirass: a rounded breast, a waist, flared lames over the hips like a bell's lip
          section(X, 27.2, 44.4, fAt, (z) => bw(z) + (z > 35 && z < 41 ? 0.25 : 0), (z) => bd(z) + (z > 34 && z < 41 ? 0.55 * Math.sin((z - 34) / 7 * Math.PI) : 0), mBody);
          next(); section(X, hem, 27.6, fAt, (z) => 5.0 + (27.6 - z) * 0.26, (z) => 3.5 + (27.6 - z) * 0.14, M('lames', body.col, 'metal', { spec: 1.1, lames: true }));
          for (const s of [1, -1]) { next(); const sh = s > 0 ? P.shR : P.shL; sphere(X, add(sh, [0, -s * 0.2, 0.2]), 2.75, mBody); sphere(X, add(sh, [0, s * 0.75, -1.6]), 2.25, mBody); }
        } else if (k === 'robe') {
          const swing = (z) => (P.st ? P.st * (26 - z) * 0.06 : 0);
          section(X, 24, 45.4, fAt, (z) => bw(z) + 0.1, (z) => bd(z) + 0.1, mBody);
          next(); section(X, hem, 27, (z) => [swing(z), 0], (z) => 4.95 + (27 - z) * 0.14, (z) => 3.35 + (27 - z) * 0.08, mBody);
        } else if (k === 'coat') {
          const swing = (z) => (P.st ? P.st * (26 - z) * 0.05 : 0);
          section(X, 24, 45.3, fAt, bw, bd, mBody);
          next(); section(X, hem, 27, (z) => [swing(z) - 0.15, 0], (z) => 5.0 + (27 - z) * 0.12, (z) => 3.4 + (27 - z) * 0.06, mBody, { arc: 0.22, inner: M('lining', mixc(body.col, [20, 18, 16], 0.55), 'wool') });
        } else {
          const top = k === 'jerkin' || k === 'brig' ? 44.0 : 44.6;
          section(X, Math.max(hem, 21), top, fAt, (z) => bw(z) + (z < 27 ? (27 - z) * (k === 'mail' || k === 'gambeson' ? 0.12 : 0.06) : 0), (z) => bd(z) + (z < 27 ? (27 - z) * 0.05 : 0), mBody);
        }
        if (body.collar) { next(); section(X, 44, 47.2, (z) => [P.lean * 0.45 - 0.3, 0], (z) => 2.6 + (47.2 - z) * 0.35, (z) => 2.3 + (47.2 - z) * 0.25, mBody); }
      }
      // belt and buckle (over a short body; a long coat or robe gets a cord)
      next();
      const beltM = body && (body.kind === 'robe') ? M('cord', body.trim || C.silver, 'metal', { spec: 0.5 }) : mBelt;
      const bz = body && body.kind === 'plate' ? 27.2 : 26.2;
      section(X, bz - 0.7, bz + 0.7, fAt, (z) => hw(z) + (body ? (body.bulk || 0.3) + 0.12 : 0.18), (z) => hd(z) + (body ? (body.bulk || 0.3) * 0.8 + 0.1 : 0.15), beltM);
      next();
      const bk = [hd(bz) + (body ? (body.bulk || 0.3) * 0.8 + 0.25 : 0.35) + P.lean * (bz - 26) / 17, 0, bz];
      slab(X, bk, [0, 0, 1], [0, 1, 0], [1, 0, 0], 0.18, [-0.75, 0.75, -0.8, 0.8], (a, b) => Math.abs(a) < 0.75 && Math.abs(b) < 0.8 && !(Math.abs(a) < 0.35 && Math.abs(b) < 0.4), mBrass);
      if (cal.sash && !body) {
        next();   // a sash knotted at the hip
        const sm = M('sash', cal.sash, 'cloth', { fold: 0.8 });
        capsule(X, [hd(26) + 0.1, -2.6, 25.5], [hd(26) - 0.3, -3.6, 19], 0.75, 0.55, sm);
      }
      // the Synod stole: two silver bands down the front
      if (body && body.kind === 'robe' && body.trim) {
        next();
        const stM = M('stole', body.trim, 'metal', { spec: 0.8 });
        for (const s of [1, -1]) section(X, 10, 44.8, (z) => [(z > 27 ? hd(z) + 0.5 : 3.35 + (27 - z) * 0.08) + 0.14 + P.lean * (z - 26) / 17, s * 1.9], () => 0.85, () => 0.35, stM);
      }
      // the neck
      next();
      capsule(X, [P.lean * 0.45, 0, 44.4 + br * 0.3], [P.lean * 0.45 + 0.1, 0, 47.6 + br * 0.3], 1.55, 1.45, mSkin);
    };
    // ---- head: the face, hair, headwear
    const headPart = () => {
      next();
      const hc = P.head, cz = hc[2];
      const RX = 3.65, RD = 3.85, RZ = 4.75;
      const prof = (z) => { const t = (z - cz) / RZ; if (t <= -1 || t >= 1) return 0; return Math.sqrt(1 - t * t) * (t < -0.25 ? 1 - (-0.25 - t) * 0.38 : 1); };
      const faceM = M('face', fc.skin, 'face', { face: L.face });
      const closed = !!(head && head.full);   // a closed helm: no face, no skin from any side (only its dark sight-slit)
      if (!closed) {
        section(X, cz - RZ, cz + RZ, (z) => [hc[0] + (z < cz - 1 ? (cz - 1 - z) * 0.06 : 0), 0], (z) => RX * prof(z), (z) => RD * prof(z), faceM);
        // ears and nose
        if (!(head && head.kind === 'hood')) { next(); for (const s of [1, -1]) sphere(X, [hc[0] - 0.35, s * (RX - 0.1), cz - 0.4], 0.75, mSkin); }
        next(); capsule(X, [hc[0] + RD - 0.7, 0, cz - 0.2], [hc[0] + RD - 0.05, 0, cz - 1.3], 0.34, 0.42, faceM);
      }
      const hair = fc.hair ? M('hair', fc.hair, 'hair') : null;
      const wear = head ? head.kind : fc.wear || null;
      X.brim = wear === 'kettle' || wear === 'cap' || wear === 'captain' || wear === 'hood';
      const hidden = head && head.full;
      // hair under and around everything but a full helm
      if (hair && !hidden) {
        next();
        if ((fc.style === 'long' && wear !== 'hood') || fc.style === 'braids') {
          section(X, cz - (fc.style === 'long' ? 9.5 : 3), cz + 2, (z) => [hc[0] - 1.2, 0], (z) => (RX + 0.6) * (z > cz ? prof(z) * 1.02 + 0.05 : 1) + (z < cz - 4 ? (cz - 4 - z) * 0.1 : 0), (z) => (RD - 0.2) * (z > cz ? prof(z) : 1), hair, { arc: 1.05 });
        }
        if (wear !== 'hood' && wear !== 'bellhelm') {
          next();
          section(X, cz + 1.7, cz + RZ + 0.45, (z) => [hc[0] - 0.3, 0], (z) => (RX + 0.4) * Math.sqrt(Math.max(0, 1 - ((z - cz) / (RZ + 0.45)) ** 2)), (z) => (RD + 0.36) * Math.sqrt(Math.max(0, 1 - ((z - cz) / (RZ + 0.45)) ** 2)), hair);
          if (fc.style !== 'bald') section(X, cz - 2.6, cz + 1.9, (z) => [hc[0] - 0.45, 0], (z) => (RX + 0.32) * Math.max(0.6, prof(z)), (z) => (RD + 0.25) * Math.max(0.6, prof(z)), hair, { arc: 1.2 });
        }
        if (fc.style === 'braids') {
          for (const s of [1, -1]) {
            next();
            const a = [hc[0] - 0.2, s * (RX + 0.2), cz - 1.5], b = [hc[0] + 1.6 + P.lean * 0.3, s * 4.2, cz - 13.5];
            const n = 9; for (let i = 0; i < n - 1; i++) { const t0 = i / (n - 1), t1 = (i + 1) / (n - 1); capsule(X, add(lerp3(a, b, t0), [0, s * (i & 1 ? 0.25 : -0.25), 0]), lerp3(a, b, t1), 0.9 - t0 * 0.3, 0.6 - t0 * 0.2, hair); }
            sphere(X, add(b, [0, 0, -0.6]), 0.55, M('braidtie', [70, 44, 28], 'leather'));
          }
        }
        if ((fc.style === 'fringe' || fc.style === 'long') && !head && wear !== 'hood') {   // a fringe only under the bare sky (never through a helm)
          next();
          section(X, cz + 1.4, cz + 3.4, (z) => [hc[0] + 0.55, 0], (z) => RX * 0.95, (z) => RD * 0.92, hair, { back: false });
        }
      }
      if (fc.beard && !hidden) {
        next();
        const bm = M('beard', fc.beard, 'hair');
        section(X, cz - RZ - 1.6, cz - 0.6, (z) => [hc[0] + 0.75 + (cz - z) * 0.08, 0], (z) => (RX + 0.2) * (z > cz - 2.2 ? 1 : 1 - (cz - 2.2 - z) * 0.17), (z) => (RD - 0.35) * (z > cz - 2.2 ? 1 : 1 - (cz - 2.2 - z) * 0.12), bm, { arc: X.smooth ? 0 : 0.85 });
      }
      // headwear
      if (wear === 'hood') {
        next();
        const hm = head ? M('hood', head.col, 'wool', { fold: 0.8 }) : M('hood0', fc.wearCol || cal.cloak, 'wool', { fold: 0.8 });
        const hin = M('hoodin', mixc(head ? head.col : fc.wearCol || cal.cloak, [10, 8, 10], 0.65), 'wool');
        section(X, cz - 3.4, cz + RZ + 1.25, (z) => [hc[0] - 0.65, 0], (z) => (RX + 1.25) * Math.sqrt(Math.max(0, 1 - ((z - cz - 0.4) / (RZ + 1.1)) ** 2)) + 0.3, (z) => (RD + 1.2) * Math.sqrt(Math.max(0, 1 - ((z - cz - 0.4) / (RZ + 1.1)) ** 2)) + 0.25, hm, { arc: 0.62, inner: hin });
        next(); section(X, 42.6 + br * 0.3, cz - 3.0, (z) => [hc[0] - 0.9, 0], (z) => 5.7 - (z - 42.6) * 0.38, (z) => 4.1 - (z - 42.6) * 0.12, hm, { arc: 0.45, inner: hin });
      } else if (wear === 'captain') {
        next();
        const top = M('captop', [222, 214, 196], 'cloth'), band = M('capband', C.navy, 'cloth'), peak = M('cappeak', [24, 22, 26], 'leather', { spec: 0.6 });
        section(X, cz + 2.6, cz + 4.6, (z) => [hc[0] - 0.3, 0], (z) => RX + 0.75 + (z - cz - 2.6) * 0.42 - (z > cz + 4.1 ? (z - cz - 4.1) * 2.2 : 0), (z) => RD + 0.7 + (z - cz - 2.6) * 0.5 - (z > cz + 4.1 ? (z - cz - 4.1) * 2.2 : 0), top);
        next(); section(X, cz + 1.8, cz + 3.1, (z) => [hc[0] - 0.1, 0], () => RX + 0.62, () => RD + 0.58, band);
        next(); slab(X, [hc[0] + RD + 0.9, 0, cz + 1.75], [1, 0, -0.32], [0, 1, 0], norm([0.3, 0, 1]), 0.14, [-1.6, 1.2, -2.8, 2.8], (a, b) => (a / 1.3) ** 2 + (b / 2.8) ** 2 < 1 && a > -1.2, peak);
        next(); sphere(X, [hc[0] + RD + 0.85, 0, cz + 2.55], 0.42, mBrass);
      } else if (wear === 'cap') {
        next();
        const cm = M('cap', head.col, 'leather', { spec: 0.35 }), tm = M('captrim', head.trim || head.col, 'leather');
        section(X, cz + 1.2, cz + RZ + 0.75, (z) => [hc[0] - 0.25, 0], (z) => (RX + 0.6) * Math.sqrt(Math.max(0, 1 - ((z - cz - 0.6) / (RZ + 0.25)) ** 2)), (z) => (RD + 0.55) * Math.sqrt(Math.max(0, 1 - ((z - cz - 0.6) / (RZ + 0.25)) ** 2)), cm);
        next(); section(X, cz + 1.0, cz + 1.9, (z) => [hc[0] - 0.25, 0], () => RX + 0.78, () => RD + 0.72, tm);
      } else if (wear === 'kettle') {
        next();
        const km = M('kettle', head.col, 'metal', { spec: 1.2 });
        section(X, cz + 1.2, cz + RZ + 1.4, (z) => [hc[0] - 0.2, 0], (z) => (RX + 0.75) * Math.sqrt(Math.max(0, 1 - ((z - cz - 1.0) / (RZ + 0.4)) ** 2)), (z) => (RD + 0.7) * Math.sqrt(Math.max(0, 1 - ((z - cz - 1.0) / (RZ + 0.4)) ** 2)), km);
        next(); section(X, cz + 1.05, cz + 1.65, (z) => [hc[0] - 0.2, 0], (z) => RX + 3.0 - (z - cz - 1.05) * 1.4, (z) => RD + 2.9 - (z - cz - 1.05) * 1.4, km);
        next(); sphere(X, [hc[0] - 0.2, 0, cz + RZ + 1.35], 0.55, km);
      } else if (wear === 'bellhelm') {
        next();
        const bm = M('bellhelm', head.col, 'metal', { spec: 1.3, slit: cz + 0.2 });
        // the whole head in a bell: crown, waist, flared lip at the jaw; a dark sight-slit; a crown ring
        const bp = (z) => { const t = (z - (cz - 5.4)) / 11.2; return t < 0.12 ? 4.55 - t * 3 : t < 0.7 ? 4.2 - (t - 0.12) * 0.7 : 3.8 * Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.32) ** 2)) + 0.05; };
        section(X, cz - 5.4, cz + 5.7, (z) => [hc[0] - 0.1, 0], (z) => bp(z), (z) => bp(z) * 1.04, bm);
        next(); section(X, cz + 3.3, cz + 3.9, (z) => [hc[0] - 0.1, 0], (z) => bp(cz + 3.6) + 0.2, (z) => bp(cz + 3.6) * 1.04 + 0.2, mBrass);
        next(); sphere(X, [hc[0] - 0.1, 0, cz + 6.0], 0.65, mBrass);
      }
    };
    // ---- arms, hands, the weapon and the shield
    const handBall = (h, m, fist) => { sphere(X, h, fist ? 1.3 : 1.2, m); };
    const arm = (side) => {
      const sh = side > 0 ? P.shR : P.shL, el = side > 0 ? P.elR : P.elL, hd = side > 0 ? P.wH : P.offH;
      const glassArm = glassOn && side < 0;
      const gl = clamp(L.glass, 0, 100);
      // how far the glass has climbed: the hand first, the forearm by 15, the whole arm by 40
      const gHand = glassArm, gFore = glassArm && gl >= 15, gUpper = glassArm && gl >= 40;
      next();
      capsule(X, sh, el, 2.3, 1.8, gUpper ? mGlass : upperM);
      if (body && body.sleeves === 'wide') { next(); capsule(X, lerp3(el, hd, 0.25), lerp3(el, hd, 0.75), 1.75, 2.15, foreM); }
      next();
      const wrist = lerp3(el, hd, 0.86);
      capsule(X, el, wrist, 1.8, 1.35, gFore ? mGlass : foreM);
      if (glassArm && !gFore) capsule(X, lerp3(el, wrist, 0.7), wrist, 1.3, 1.3, mGlass);
      // gloves and gauntlets: a cuff, and the hand
      next();
      const hm = gHand ? mGlass : handM;
      if (bracerM && !gFore) { capsule(X, lerp3(el, wrist, 0.18), lerp3(el, wrist, 0.92), 1.92, 1.55, bracerM); next(); }
      if (hands && !gHand) { capsule(X, lerp3(el, hd, 0.6), wrist, hands.kind === 'gauntlets' ? 1.62 : 1.42, hands.kind === 'gauntlets' ? 1.72 : 1.45, handM); }
      handBall(hd, hm, true);
      if (glassArm) {
        next();   // facets of glass where it climbs out of the sleeve
        const s0 = gUpper ? lerp3(sh, el, 0.15) : gFore ? lerp3(el, wrist, 0.05) : lerp3(el, wrist, 0.7);
        for (let i = 0; i < 3; i++) { const p = add(s0, [0.6 - i * 0.6, side * (0.9 + i * 0.2), 0.4 - i * 0.5]); sphere(X, p, 0.55 - i * 0.1, mGlass); }
      }
      if (hands && hands.kind === 'gauntlets' && !gHand) { next(); sphere(X, add(hd, [0.25, side * 0.35, 0.45]), 1.0, M('gauntplate', C.steel, 'metal', { spec: 1.1 })); }
    };
    // a weapon at a grip point g with direction d (unit, from the hand toward the business end)
    const metalMat = (name) => {
      if (name === 'bronze') return M('w:bronze', C.bronze, 'metal', { spec: 1.3 });
      if (name === 'glass') return M('w:glass', [110, 214, 222], 'glass', { spec: 1.4, glow: 0.45 });
      if (name === 'lilac') return M('w:lilac', C.lilac, 'glass', { spec: 1.3, glow: 0.35 });
      if (name === 'iron') return M('w:iron', C.iron, 'metal', { spec: 0.9 });
      if (name === 'lead') return M('w:lead', C.lead, 'metal', { spec: 0.6 });
      if (name === 'dsteel') return M('w:dsteel', [118, 124, 132], 'metal', { spec: 1.1 });
      if (name === 'brass') return mBrass;
      if (name === 'ivory') return M('w:ivory', C.ivory, 'cloth');
      return M('w:steel', [176, 184, 190], 'metal', { spec: 1.3 });
    };
    const woodMat = (name) => name === 'ash' ? M('w:ash', [150, 116, 74], 'wood') : name === 'dwood' ? M('w:dwood', [74, 50, 34], 'wood') : name === 'leather' ? M('w:grip', [70, 44, 28], 'leather') : name === 'ivory' ? M('w:ivory', C.ivory, 'cloth') : M('w:wood', C.wood, 'wood');
    // a plane for a flat thing along d: its width axis is the one most across the view
    const flatAxes = (d) => {
      const view = [X.u, X.sn, 0];
      let v = cross(d, view); if (Math.hypot(v[0], v[1], v[2]) < 0.2) v = cross(d, [0, 0, 1]); if (Math.hypot(v[0], v[1], v[2]) < 0.2) v = cross(d, [1, 0, 0]);
      v = norm(v); const w = norm(cross(d, v));
      return [v, w];
    };
    const weapon = (g, d, Wl, side) => {
      next();
      const k = Wl.kind;
      if (k === 'fists' || k === 'glassarm') return;
      const cols = Wl.cols || {};
      const colMat = (key, fallback, glassy) => cols[key] ? M('wc:' + key + ':' + (Wl.id || k), cols[key], glassy ? 'glass' : key === 'grip' ? 'leather' : 'metal', glassy ? { spec: 1.4, glow: 0.4 } : { spec: key === 'grip' ? 0.2 : 1.25 }) : fallback;
      if (k === 'blade') {
        const glassy = Wl.blade === 'glass' || Wl.blade === 'lilac';
        const bm = colMat('blade', metalMat(Wl.blade), glassy), gm = colMat('grip', woodMat(Wl.grip || 'leather')), pm = Wl.pommel === 'none' ? null : Wl.pommel === 'ivory' ? woodMat('ivory') : colMat('guard', metalMat(Wl.pommel || 'iron'));
        const gl = Wl.gripLen || (Wl.len > 9 ? 3.4 : 2.4);
        const back = add(g, d, -gl * 0.55), guardP = add(g, d, gl * 0.45 + 0.1);
        capsule(X, back, guardP, 0.5, 0.48, gm);
        if (pm) { next(); sphere(X, add(back, d, -0.35), Wl.pommel === 'ring' ? 0.55 : 0.68, pm); }
        const [v, w] = flatAxes(d);
        if (Wl.guard && Wl.guard !== 'none') {
          next();
          const gw = Wl.guard === 'wide' ? 3.0 : Wl.guard === 'ring' ? 1.9 : Wl.guard === 'basket' ? 1.3 : 2.3;
          if (Wl.guard === 'basket') sphere(X, add(guardP, d, -0.6), 1.25, metalMat('iron'));
          else capsule(X, add(guardP, v, -gw), add(guardP, v, gw), 0.36, 0.36, Wl.guard === 'ring' ? mBrass : colMat('guard', metalMat('iron')));
          if (Wl.guard === 'ring') { sphere(X, add(guardP, v, -gw), 0.5, mBrass); sphere(X, add(guardP, v, gw), 0.5, mBrass); }
        }
        next();
        const len = Wl.len, wid = Wl.wid || 1, c = add(guardP, d, len / 2 + 0.1);
        slab(X, c, d, v, w, 0.16, [-len / 2, len / 2, -wid, wid], (a, b) => { const t = (a + len / 2) / len; const hw = wid * (t < 0.82 ? 1 - t * 0.18 : (1 - t) / 0.18 * 0.85); return Math.abs(b) < hw; }, bm,
          (a, b) => [0, (Math.abs(b) < wid * 0.18 && Wl.len > 8 ? -0.25 : b > 0 ? 0.55 : -0.55)]);
        if (Wl.engraved || Wl.blade === 'glass') { next(); capsule(X, add(guardP, d, 0.6), add(guardP, d, len * 0.7), 0.16, 0.12, Wl.blade === 'glass' ? metalMat('steel') : mBrass); }
        if (Wl.spare && side > 0) { next(); for (let i = 0; i < Wl.spare; i++) { const p = [0.8 + i * 1.2, 4.5 - i * 0.7, 30.5 - i * 0.2]; capsule(X, p, add(p, [0.1, 0.2, -2.2]), 0.28, 0.2, metalMat('steel')); } }
        return;
      }
      if (k === 'axe' || k === 'mace' || k === 'hammer') {
        const hm = colMat('grip', woodMat(Wl.haft || 'wood')), mm = colMat('head', metalMat(Wl.head || 'steel'));
        const len = Wl.len, base = add(g, d, -2.4), top = add(g, d, len - 2.4);
        capsule(X, base, top, 0.5, 0.45, hm);
        const [v, w] = flatAxes(d);
        // the head sits across the haft, toward the side most visible
        const out = v;
        next();
        if (k === 'axe') {
          const big = Wl.big ? 1.18 : 1;
          const c = add(add(top, d, -1.6), out, 2.3 * big);
          slab(X, c, d, out, w, 0.28, [-3.6 * big, 3.0 * big, -2.6 * big, 2.4 * big], (a, b) => {
            const bb = b + 2.3 * big;   // distance out from the haft
            if (bb < 0) return false;
            const edge = 4.4 * big;
            const lo = -1.0 * big - (Wl.beard ? Math.max(0, bb - 1.2 * big) * 0.9 : 0), hi = 1.1 * big + Math.max(0, bb - 2.4 * big) * 0.35;
            return bb < edge - Math.abs(a - (hi + lo) / 2) * 0.12 && a > lo && a < hi;
          }, mm, (a, b) => [0, b > 1.4 ? 0.35 : 0]);
          if (Wl.spike) { next(); capsule(X, add(add(top, d, -1.6), out, -0.6), add(add(top, d, -1.4), out, -2.6), 0.42, 0.1, mm); }
          next(); sphere(X, add(top, d, 0.15), 0.52, mm);
        } else if (k === 'mace') {
          const c = add(top, d, -0.4);
          sphere(X, c, 1.25, mm);
          next(); for (const s of [1, -1]) for (const ax of [v, w]) capsule(X, add(add(c, ax, s * 1.15), d, -0.9), add(add(c, ax, s * 1.35), d, 0.7), 0.55, 0.35, mm);
          next(); sphere(X, add(c, d, 1.35), 0.5, mm);
        } else {
          const c = add(top, d, -0.9);
          capsule(X, add(c, out, -1.0), add(c, out, 2.4), 1.05, 0.95, mm);
          next(); capsule(X, add(c, out, -1.0), add(c, out, -2.6), 0.6, 0.12, mm);
          next(); sphere(X, add(c, out, 2.6), 0.9, mBrass);
        }
        return;
      }
      if (k === 'fork' || k === 'glaive') {
        const hm = colMat('grip', woodMat(Wl.haft || 'ash')), mm = colMat('head', metalMat(Wl.head || 'bronze'));
        const len = Wl.len, base = add(g, d, -(len * 0.36)), top = add(g, d, len * 0.64);
        capsule(X, base, top, 0.48, 0.42, hm);
        next(); capsule(X, add(base, d, -0.4), add(base, d, 0.6), 0.55, 0.55, mBrass);
        const [v, w] = flatAxes(d);
        next();
        if (k === 'fork') {
          // the tuning fork: a collar, a yoke, two long tines
          sphere(X, add(top, d, 0.2), 0.75, mm);
          capsule(X, add(add(top, d, 1.0), v, -1.1), add(add(top, d, 1.0), v, 1.1), 0.42, 0.42, mm);
          for (const s of [1, -1]) capsule(X, add(add(top, d, 1.0), v, s * 1.1), add(add(top, d, 6.6), v, s * 0.95), 0.4, 0.28, mm);
        } else {
          sphere(X, add(top, d, 0.2), 0.6, mm);
          const c = add(add(top, d, 3.4), v, 0.6);
          slab(X, c, d, v, w, 0.2, [-3.6, 4.2, -1.8, 2.2], (a, b) => { const t = (a + 3.6) / 7.8; const curve = Math.sin(t * Math.PI) * 0.9; const lo = -0.6 + curve - (t > 0.75 ? (t - 0.75) * 4 : 0), hi = 1.4 + curve * 0.6 - (t > 0.6 ? (t - 0.6) * 4.6 : 0); return b > lo && b < hi; }, mm, (a, b) => [0, b > 0.8 ? 0.4 : -0.3]);
        }
        return;
      }
      if (k === 'maul') {
        const hm = colMat('grip', woodMat(Wl.haft || 'wood')), mm = colMat('head', metalMat(Wl.head || 'iron'));
        const len = Wl.len, back = add(g, d, -1.6), headC = add(g, d, len - 1.6);
        capsule(X, back, headC, 0.55, 0.5, hm);
        const [v] = flatAxes(d);
        next();
        const big = Wl.big ? 1.25 : 1;
        capsule(X, add(headC, v, -2.6 * big), add(headC, v, 2.6 * big), 1.7 * big, 1.7 * big, mm);
        next(); for (const s of [1, -1]) capsule(X, add(headC, v, s * 2.0 * big), add(headC, v, s * 2.9 * big), 1.85 * big, 1.85 * big, metalMat(Wl.big ? 'iron' : 'dsteel'));
        if (Wl.gauge) { next(); const gp = add(add(headC, d, -1.75), v, 0.7); capsule(X, add(headC, d, -1.2), gp, 0.3, 0.3, mBrass); sphere(X, gp, 0.85, mBrass); sphere(X, add(gp, [0.5, 0, 0]), 0.55, M('gaugeface', [230, 222, 196], 'cloth')); }
        return;
      }
      if (k === 'pistol') {
        const wm = colMat('grip', woodMat(Wl.body || 'wood')), mm = colMat('guard', metalMat(Wl.metal || 'brass'));
        const [v] = flatAxes(d);
        // the grip in the hand, the barrel along d from above the hand
        const gripTop = add(g, [0, 0, 0.6]);
        capsule(X, add(g, d, -0.8), add(gripTop, d, 0.6), 0.75, 0.65, wm);
        next(); capsule(X, add(gripTop, d, 0.2), add(gripTop, d, Wl.len), 0.52, 0.48, metalMat('iron'));
        next(); capsule(X, add(gripTop, d, 0.6), add(gripTop, d, 2.6), 0.62, 0.62, mm); sphere(X, add(gripTop, d, Wl.len + 0.1), 0.42, mm);
        next(); sphere(X, add(add(gripTop, d, 1.3), [0, 0, 0.7]), 0.42, M('w:pellet', C.glass, 'glass', { spec: 1.2, glow: 0.4 }));
        return;
      }
      if (k === 'crossbow') {
        const wm = colMat('grip', woodMat(Wl.body || 'wood')), mm = colMat('blade', metalMat(Wl.metal || 'iron'));
        const len = Wl.len, back = add(g, d, -2.6), front = add(g, d, len - 2.6);
        capsule(X, back, front, 0.75, 0.62, wm);
        const [v, w] = flatAxes(d);
        const side2 = norm(cross(d, [0, 0, 1]));
        next();
        // the prod: an iron bow across the front, bent back
        const pts = []; for (let i = -4; i <= 4; i++) { const t = i / 4; pts.push(add(add(front, side2, t * 5.2), d, -Math.abs(t) * 1.6 * Math.abs(t))); }
        for (let i = 0; i < pts.length - 1; i++) capsule(X, pts[i], pts[i + 1], 0.42, 0.42, mm);
        next(); const sm = M('string', [214, 204, 176], 'cloth'); capsule(X, pts[0], add(front, d, -3.6), 0.12, 0.12, sm); capsule(X, pts[pts.length - 1], add(front, d, -3.6), 0.12, 0.12, sm);
        next(); capsule(X, add(front, d, -3.4), add(front, d, 0.9), 0.2, 0.2, metalMat('iron')); sphere(X, add(front, d, 1.0), 0.32, metalMat('steel'));
        return;
      }
    };
    // a shield: centre c, facing n (unit), up u
    const shieldShape = (S, c, n, upv, onBack, arm) => {
      const v = norm(cross(upv, n)), U2 = norm(cross(n, v));
      if (S.kind === 'kite') {
        const h = S.h || 15, top = h * 0.36, wTop = S.wTop || 4.7;
        const inside = (a, b) => { if (a > top || a < top - h) return false; const t = (top - a) / h; const half = t < 0.28 ? wTop * (0.9 + 0.1 * Math.sin(t / 0.28 * Math.PI / 2)) : wTop * Math.pow(Math.max(0, 1 - (t - 0.28) / 0.72), 0.85); return Math.abs(b) < half - (a > top - 0.6 ? (a - (top - 0.6)) * 0.0 : 0); };
        const rimW = 0.55;
        // v runs across the shield; seen from the front of the figure, the queen faces the viewer's right
        const face = v[1] >= 0 ? -1 : 1;   // fixed on the shield (painted once), so it does not flip as the figure turns
        const rimM = M('kiterim', S.rim || C.brass, 'metal', { spec: 1.1 }), faceM = M('kiteface:' + face, S.col, 'paint', { emblem: S.emblem || [214, 206, 188], kite: { top, h, wTop, face } });
        const backM = M('kiteback', [92, 66, 44], 'wood');   // the back is bare boards: the painted queen is on the front only
        slab(X, c, U2, v, n, 0.45, [top - h - 0.2, top + 0.2, -wTop - 0.2, wTop + 0.2], (a, b) => inside(a, b), faceM, (a, b) => [a * 0.0, b * 0.05], backM);
        next();
        slab(X, add(c, n, 0.12), U2, v, n, 0.45, [top - h - 0.2, top + 0.2, -wTop - 0.2, wTop + 0.2], (a, b) => inside(a, b) && !(inside(a + rimW, b) && inside(a - rimW, b) && inside(a, b + rimW) && inside(a, b - rimW)), rimM, (a, b) => [0, b * 0.05]);
        if (!onBack && arm) {
          // the enarmes: two leather straps from the forearm to the shield's back (seen from behind and the side)
          next();
          const sm = M('strap', [70, 46, 28], 'leather');
          for (const t of [0.25, 0.9]) { const p0 = lerp3(arm[0], arm[1], t), d = (c[0] - p0[0]) * n[0] + (c[1] - p0[1]) * n[1] + (c[2] - p0[2]) * n[2] - 0.45 - 0.45; if (d > 0.2) capsule(X, p0, add(p0, n, d), 0.42, 0.42, sm); }
        }
      } else {
        const r = S.r || 3.1;
        const faceM = M('bucklerface', S.face || [96, 70, 48], 'wood', S.band ? { band: S.band } : null), rimM = M('bucklerrim', S.col || C.steel, 'metal', { spec: 1.2 });
        slab(X, c, U2, v, n, 0.32, [-r, r, -r, r], (a, b) => a * a + b * b < r * r, faceM, (a, b) => [a * 0.12, b * 0.12], M('bucklerback', [84, 60, 40], 'wood'));
        next(); slab(X, add(c, n, 0.08), U2, v, n, 0.34, [-r, r, -r, r], (a, b) => { const q = a * a + b * b; return q < r * r && q > (r - 0.65) * (r - 0.65); }, rimM, (a, b) => [a * 0.15, b * 0.15]);
        next(); sphere(X, add(c, n, r * 0.26 - 0.25), r * 0.26, S.boss ? M('bucklerboss', S.boss, 'metal', { spec: 1.3 }) : rimM);
      }
    };
    const shieldOnArm = () => {
      if (!shield || L.stowed) return;
      next();
      const fore = norm([P.offH[0] - P.elL[0], P.offH[1] - P.elL[1], P.offH[2] - P.elL[2]]);
      let n, c, upv;
      if (shield.kind === 'kite') {
        // held on its straps: the face stands clear in front of the whole forearm and hand (so the hand never shows
        // through the painted face); on the card it is turned about 36 degrees aside so the armour shows
        n = P.block ? norm([1, 0.15, 0.05]) : norm([0.8, -0.59, 0.05]);   // also in the world: a sprite one tile wide keeps the whole shield
        const mid = lerp3(P.elL, P.offH, 0.55);
        let lift = 0; for (const q of [P.elL, P.offH]) lift = Math.max(lift, (q[0] - mid[0]) * n[0] + (q[1] - mid[1]) * n[1] + (q[2] - mid[2]) * n[2]);
        const gap = lift + 2.1;
        c = add(mid, n, gap);
        if (!P.block) { const o2 = P.display ? [-0.6, 0.6, 0] : [0, 3.4, 0], k = o2[0] * n[0] + o2[1] * n[1]; c = add(c, [o2[0] - n[0] * k, o2[1] - n[1] * k, 0]); }   // kept inside the frame, never nearer the arm
        upv = P.block ? [0, 0, 1] : norm(add([0, 0, 1], fore, 0.15));
        shieldShape(shield, c, n, upv, false, [P.elL, P.offH, gap]);
        return;
      } else {
        n = P.block ? [1, 0, 0] : norm([0.9, -0.42, 0.1]);
        c = add(P.offH, n, 1.1);
        upv = [0, 0, 1];
      }
      shieldShape(shield, c, n, upv, false);
    };

    // ---- compose (the z-buffer sorts the parts; the order only matters for part ids)
    cloak();
    slung();
    leg(P.legL, -1); leg(P.legR, 1);
    torso();
    headPart();
    arm(-1); arm(1);
    weapon(P.wH, P.wV, W, 1);
    if (OW) weapon(P.offH, P.offV, OW, -1);
    shieldOnArm();
    return P;
  }

  // ================================================================ SHADING
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const LX = -0.52, LY = 0.6, LZ = 0.6;   // light from the upper left, a little in front
  const HXl = Math.hypot(LX, LY, LZ + 1), HX = LX / HXl, HY = LY / HXl, HZ = (LZ + 1) / HXl;
  // the portrait textures (read once from img/face_N.jpg; until they load the face is painted procedurally)
  const portraits = {}, porRefs = {}; let portraitGen = 0;
  function loadPortrait(n) {
    if (portraits[n] !== undefined || typeof Image === 'undefined' || typeof document === 'undefined') return;
    portraits[n] = null;
    try {
      const im = new Image();
      im.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
          const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, 128, 128);
          const d = cx.getImageData(0, 0, 128, 128).data;
          // the cheeks' mean brightness: the portrait is scaled to the skin ramp by it
          const fcN = (gear().faces && gear().faces[n]) || LOCAL.faces[n];
          let sum = 0, cnt = 0;
          for (let y = fcN.eyeY + 6; y < fcN.eyeY + 16; y++) for (const x of [48, 50, 52, 54, 74, 76, 78, 80]) { const q = (y * 128 + x) * 4; sum += 0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2]; cnt++; }
          porRefs[n] = Math.max(40, sum / cnt);
          portraits[n] = d; portraitGen++; changed();
        } catch (e) { warnOnce('portrait', e); }
      };
      im.src = 'img/face_' + n + '.jpg';
    } catch (e) { warnOnce('portrait', e); }
  }
  // the shading pass as a job of rows (occlusion, colour, ink, outline), so a paint can stop between rows
  function shadeJob(X, L) {
    const { W, H } = X, N = W * H, out = new Uint32Array(N), idx = new Int8Array(N).fill(-1);
    const fc = (gear().faces && gear().faces[L.face]) || LOCAL.faces[L.face];
    const por = portraits[L.face]; X.porRef = porRefs[L.face];
    const K = X.K;
    // soft occlusion: how much nearer stuff crowds each pixel
    const ao = new Float32Array(N);
    const R1 = Math.max(2, Math.round(K * 0.55)), R2 = Math.max(3, Math.round(K * 1.2));
    const OFF = [[R1, 0], [-R1, 0], [0, R1], [0, -R1], [R2, R2], [-R2, R2], [R2, -R2], [-R2, -R2], [R2, 0], [-R2, 0], [0, R2], [0, -R2]];
    const aoRow = (y) => { for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!X.m[i]) continue;
      const d = X.z[i]; let occ = 0;
      for (const [dx, dy] of OFF) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!X.m[j]) continue;
        const dd = X.z[j] - d; if (dd > 0.4 * K) occ += Math.min(1, dd / (3 * K));
      }
      ao[i] = occ / OFF.length;
    } };
    const colRow = (y) => { for (let x = 0; x < W; x++) {
      const i = y * W + x, mi = X.m[i]; if (!mi) continue;
      const Mt = X.mats[mi]; if (!Mt) continue;
      let nx = X.nx[i], ny = X.ny[i], nz = X.nz[i];
      const tu = X.tu[i], tv = X.tv[i], kind = Mt.kind;
      // cloth folds: the normal swings across vertical folds (more toward a hem)
      if (Mt.fold) { const f = Math.sin(tu * 1.9 + Math.sin(tv * 0.45) * 0.8) * 0.32 * Mt.fold; nx += f * 0.9; nz -= Math.abs(f) * 0.2; }
      if (kind === 'quilt') { const q = 1.6, a = ((tu + tv) / q) % 1, b = ((tu - tv) / q) % 1; const pa = a < 0 ? a + 1 : a, pb = b < 0 ? b + 1 : b; nx += (pa - 0.5) * 0.35; ny += (pb - 0.5) * 0.35; }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const lam = Math.max(0, nx * LX + ny * LY + nz * LZ) / Math.hypot(LX, LY, LZ);
      const amb = kind === 'glass' ? 0.38 : kind === 'face' || kind === 'skin' ? 0.3 : 0.22;
      let v = kind === 'metal' || kind === 'mail' ? 0.12 + 0.6 * lam : amb + (1 - amb) * lam;
      v *= 1 - 0.55 * ao[i];
      // a cool rim from behind on the right: separates the figure from a dark ground
      const rim = Math.max(0, nx * 0.75 - nz * 0.3) * (1 - nz) * 0.18;
      v += rim;
      // texture by material
      const hx = hash2(x, y), hb = hash2(x >> 1, y >> 1);
      let tex = 0;
      switch (kind) {
        case 'cloth': case 'robe': tex = (hb - 0.5) * 0.06 + (((x + y) & 1) ? 0.012 : -0.012); break;
        case 'wool': tex = (hb - 0.5) * 0.1 + (hx - 0.5) * 0.04; break;
        case 'felt': tex = (hb - 0.5) * 0.12; break;
        case 'quilt': { const q = 1.6, a = Math.abs((((tu + tv) / q) % 1 + 1) % 1 - 0.5), b = Math.abs((((tu - tv) / q) % 1 + 1) % 1 - 0.5); tex = (a > 0.43 || b > 0.43) ? -0.16 : 0.03; tex += (hb - 0.5) * 0.04; break; }
        case 'leather': {
          tex = (hb - 0.5) * 0.09 + (hx - 0.5) * 0.03;
          if (Mt.kind2 === 'jerkin' && Math.abs(tu) < 0.35 && tv > 28 && tv < 43.5) tex -= 0.22;   // the front lacing
          if (Mt.kind2 === 'jerkin' && Math.abs(Math.abs(tu) - 0.9) < 0.18 && ((Math.floor(tv * 1.3)) & 1)) tex += 0.18;   // stitches beside it
          if (Mt.studs && ((x + (y >> 1)) % 3 === 0) && ((y & 1) === 0)) tex += 0.35;
          break;
        }
        case 'canvas': {
          tex = (((x + y) & 1) ? 0.03 : -0.03) + (hb - 0.5) * 0.05;
          if (Mt.kind2 === 'brig') { const a = ((tu / 1.15) % 1 + 1) % 1, b = ((tv / 1.3) % 1 + 1) % 1; if (Math.abs(a - 0.5) < 0.16 && Math.abs(b - 0.5) < 0.16) tex += 0.42; else if (Math.abs(b - 0.08) < 0.06) tex -= 0.08; }
          break;
        }
        case 'oil': tex = (hb - 0.5) * 0.03; break;
        case 'mail': {
          // rings: rows offset by half a ring; the top of each ring catches the light
          const rx = (x + ((y >> 1) & 1)) % 2, ry = y & 1;
          tex = ry === 0 ? (rx ? 0.18 : -0.05) : (rx ? -0.16 : 0.02);
          break;
        }
        case 'metal': {
          tex = (hb - 0.5) * 0.04;
          if (Mt.lames) { const b = ((tv / 1.35) % 1 + 1) % 1; if (b < 0.16) tex -= 0.3; }
          if (Mt.kind2 === 'plate') { const b = ((tv - 27.2) / 17); if (Math.abs(tu) < 0.3 && b > 0.2 && b < 0.95) tex += 0.1; }
          if (Mt.studs && (x % 3 === 0) && (y & 1)) tex += 0.4;
          break;
        }
        case 'wood': tex = Math.sin(tu * 6 + hash2(Math.floor(tu * 3), 7) * 6) * 0.05 + (hb - 0.5) * 0.06; break;
        case 'hair': tex = (hash2(x, (y / 3) | 0) - 0.5) * 0.26 + Math.sin(tu * 3.1) * 0.05; break;
        case 'glass': tex = (hb - 0.5) * 0.18 + Math.max(0, Math.sin((x - y) * 0.7)) * 0.08; break;
        case 'paint': break;
        default: break;
      }
      v += tex;
      // specular highlight on metal and glass
      if (Mt.spec) { const hh = Math.max(0, nx * HX + ny * HY + nz * HZ); v += Math.pow(hh, kind === 'mail' ? 10 : 22) * 0.75 * Mt.spec; }
      if (X.smooth && (kind === 'face' || kind === 'skin')) { v = Math.min(v, 0.78); if (X.brim && X.headC && tv - X.headC[2] > 0.6 && tv - X.headC[2] < 3.2) v -= 0.16; }
      let colour = null, rp = Mt.ramp;
      // the face: the portrait chosen at creation, brought to this skin ramp's brightness and lit like the rest
      let faceMix = null;
      if (kind === 'face' && X.headC) {
        const hc = X.headC;
        const wn = [nx * X.sn + nz * X.u, -nx * X.u + nz * X.sn];   // the view normal back in (f, r): which way the face turns here
        const lon = Math.atan2(wn[1], wn[0]), zz = tv - hc[2];
        const wgt = clamp((1.05 - Math.abs(lon)) / 0.3, 0, 1) * clamp((3.4 - zz) / 0.6, 0, 1) * clamp((zz + 4.9) / 0.6, 0, 1);
        if (wgt > 0) {
          if (por && !X.smooth) {
            const eyeZ = 0.15, chinZ = -4.15;
            const py = fc.eyeY + (eyeZ - zz) / (eyeZ - chinZ) * (fc.chinY - fc.eyeY);
            const px = 64 + Math.sin(lon) / Math.sin(1.0) * 21;
            const sx = clamp(Math.round(px), 0, 127), sy = clamp(Math.round(py), 0, 127), q = (sy * 128 + sx) * 4;
            faceMix = [[por[q], por[q + 1], por[q + 2]], wgt];
          } else {
            // the world figures (partner, ghost) and the face before its portrait loads: built from the skin ramp, not
            // sampled (a portrait's warm light turns into hot blobs at sprite size): dark eyes, brows in the hair's
            // colour, a mouth one shade down; features at least a pixel wide whatever the size
            const ax = Math.sin(lon) * 3.6, px = 1 / X.K;
            const eye = Math.abs(zz - 0.1) < Math.max(0.42, 0.75 * px) && Math.abs(Math.abs(ax) - 1.25) < Math.max(0.42, 0.85 * px);
            const brow = Math.abs(zz - 0.95) < Math.max(0.3, 0.6 * px) && Math.abs(Math.abs(ax) - 1.25) < 0.75;
            const mouth = Math.abs(zz + 2.55) < Math.max(0.25, 0.6 * px) && Math.abs(ax) < 0.85;
            if (eye) colour = [34, 26, 28]; else if (brow) colour = fc.hair ? mixc(fc.hair, [30, 24, 20], 0.45) : rp[1]; else if (mouth) colour = rp[1];
          }
        }
      }
      if (!colour) {
        if (kind === 'paint' && Mt.kite) {
          // the Synod's dead queen (QUEEN, the shared bitmap): a crowned ivory head in profile on the red field
          const kt = Mt.kite, cell = (kt.wTop || 4.7) * 1.1 / QUEEN.w, ac = kt.top - kt.h * 0.3;
          const cx = Math.floor((tv * kt.face) / cell + QUEEN.w / 2), cyy = Math.floor((ac - tu) / cell + QUEEN.h / 2);
          const c = queenCell(cx, cyy);
          if (c === 'i' || c === 's') { rp = ramp(Mt.emblem, 'cloth'); if (c === 's') v -= 0.22; }
          else if (c === 'g' || c === 'G') { rp = ramp(C.brass, 'metal'); if (c === 'G') v -= 0.3; else v += 0.08; }
          else if (c === 'k') rp = ramp([60, 44, 46], 'cloth');
        }
        if (kind === 'skin' && fc.scar && X.headC && Math.abs(tv - X.headC[2] - 1.8) < 1.8 && tu < -1.5 && tu > -2.6) v -= 0.18;
        if (kind === 'skin' && fc.streak && X.headC && tv - X.headC[2] < 0 && tv - X.headC[2] > -2.2 && tu > 1.2 && tu < 2.1) rp = ramp(C.glass, 'glass');
        if (kind === 'dark') rp = ramp([26, 20, 20], 'cloth');
        if (Mt.slit != null) {
          const wn0 = nx * X.sn + nz * X.u, wn1 = -nx * X.u + nz * X.sn, lon = Math.atan2(wn1, wn0);
          if (nz > 0.45 && Math.abs(lon) < 0.62 && Math.abs(tv - Mt.slit) < 0.45 - Math.abs(lon) * 0.3) { rp = ramp([26, 20, 20], 'cloth'); v = 0.1; }
        }
        if (kind === 'wood' && Mt.band && Math.abs(tv) < 0.55) rp = ramp(Mt.band, 'cloth');
        // glass glows: it never sinks into the dark tones
        if (Mt.glow) v = v * (1 - Mt.glow * 0.5) + Mt.glow * 0.7;
        const t = clamp(v * 0.94 + BAYER[(y & 3) * 4 + (x & 3)] * (kind === 'metal' || kind === 'mail' || kind === 'glass' ? 0.05 : 0.11), 0, 1.199) * (N_TONE - 1) / 1.2 * 1.2;
        const ti = clamp(Math.round(t), 0, N_TONE - 1);
        idx[i] = ti;
        colour = rp[ti];
        if (X.smooth) {
          // the small world figures blend between tones (no dither): a sprite one tile tall reads better soft
          const tt = clamp(v * 0.94, 0, 1.199) * (N_TONE - 1) / 1.2 * 1.2, t0 = clamp(Math.floor(tt), 0, N_TONE - 1), t1 = Math.min(N_TONE - 1, t0 + 1), fr = clamp(tt - t0, 0, 1);
          const c0 = rp[t0], c1 = rp[t1]; colour = [Math.round(c0[0] + (c1[0] - c0[0]) * fr), Math.round(c0[1] + (c1[1] - c0[1]) * fr), Math.round(c0[2] + (c1[2] - c0[2]) * fr)];
        }
        if (faceMix) {
          // the portrait's own colours, scaled so its cheeks match this tone of the skin ramp
          // the portrait's detail (its brightness) carried on this skin ramp's own colour, with only a third of the
          // portrait's hue: its warm studio light must not turn into hot orange patches; highlights are capped
          const pc = faceMix[0], ref = X.porRef || 120, base = colour, tl = 0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2];
          const pl = 0.3 * pc[0] + 0.59 * pc[1] + 0.11 * pc[2], k = tl / ref, w = faceMix[1];
          const r = Math.min(1.12, Math.max(0.25, pl / ref));
          const mixq = (c, b0) => { const lumC = b0 * r, hueC = c * k; return lumC * 0.68 + hueC * 0.32; };
          const Q = (c, b0) => clamp(Math.round((b0 + (Math.min(mixq(c, b0), b0 * 1.15 + 6) - b0) * w) / 8) * 8, 0, 255);
          colour = [Q(pc[0], base[0]), Q(pc[1], base[1]), Q(pc[2], base[2])];
        }
      } else idx[i] = 4;
      out[i] = ((255 << 24) | (colour[2] << 16) | (colour[1] << 8) | colour[0]) >>> 0;
    } };
    // ink: where a nearer part crosses a farther one, the farther pixel darkens (a hand-drawn line, not a black one)
    const ink = new Uint8Array(N);
    const jump = K * 0.9;
    const inkRow = (y) => { for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!X.m[i]) continue;
      for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < H ? i + W : -1, x > 0 ? i - 1 : -1, y > 0 ? i - W : -1]) {
        if (j < 0 || !X.m[j]) continue;
        if (X.part[j] !== X.part[i] && X.z[j] - X.z[i] > jump) { ink[i] = 1; break; }
      }
    } };
    const inkApply = () => { for (let i = 0; i < N; i++) if (ink[i]) { const Mt = X.mats[X.m[i]]; const c = Mt.ramp[Math.max(0, Math.min(idx[i] < 0 ? 1 : idx[i] - 3, 1))]; out[i] = ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; } };
    // the outline: the darkest tone of the part it rings, darker still (a coloured "sel-out", not flat black)
    let res = null;
    const outRow = (y) => { for (let x = 0; x < W; x++) {
      const i = y * W + x; if (X.m[i]) continue;
      let best = -1, bz = -1e9;
      for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < H ? i + W : -1, x > 0 ? i - 1 : -1, y > 0 ? i - W : -1]) if (j >= 0 && X.m[j] && X.z[j] > bz) { bz = X.z[j]; best = j; }
      if (best < 0) continue;
      const c = X.mats[X.m[best]].ramp[0], k = 0.62;
      res[i] = ((255 << 24) | ((c[2] * k) << 16) | ((c[1] * k) << 8) | (c[0] * k)) >>> 0;
    } };
    const rows = [aoRow, colRow, inkRow, outRow];
    const job = { done: false, result: null, stage: 0, y: 0 };
    job.step = (deadline) => {
      while (!job.done) {
        if (job.stage === 3 && job.y === 0 && !res) { inkApply(); res = new Uint32Array(out); }
        const ti = trace ? now() : 0; rows[job.stage](job.y); if (trace && now() - ti > 6) trace.push(['row', job.stage, job.y, +(now() - ti).toFixed(1)]);
        if (++job.y >= H) { job.y = 0; job.stage++; if (job.stage > 3) { job.done = true; job.result = res; break; } }
        if (now() > deadline) return false;
      }
      return true;
    };
    return job;
  }
  function shade(X, L) { const j = shadeJob(X, L); j.step(Infinity); return j.result; }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ================================================================ PAINT (cached; whole, or in slices)
  // Card frames and world frames (partner, ghost) have separate caches so the many co-op poses never push the card out.
  const cache = new Map(), wcache = new Map();
  const CACHE_MAX = { card: 48, world: 420 };
  let stats = { paints: 0, ms: 0, last: 0, worst: 0, sliceWorst: 0, slices: 0, asyncDone: 0 };
  function norm0(L, o) {
    o = o || {};
    const size = SIZES[o.size] ? o.size : 'card';
    const view = ((o.view | 0) % 8 + 8) % 8;
    const br = Math.round(clamp(o.breath || 0, 0, 1) * 4) / 4;
    const act = clamp(o.act | 0, 0, 9), loco = clamp(o.loco | 0, 0, 2);
    // only the strikes (1-5) change with their phase; the shot only at its phase 2; the rest are one picture
    const ph = act >= 1 && act <= 5 ? clamp(o.ph | 0, 0, 3) : act === 6 && (o.ph | 0) === 2 ? 2 : 0;
    const key = [size, view, act, ph, loco, br, o.display ? 1 : 0, sig(L), por(L)].join(';');
    return { size, view, br, key, act, ph, loco, display: !!o.display };
  }
  const cacheOf = (size) => (size === 'card' ? cache : wcache);
  function remember3(n, f) { const c = cacheOf(n.size); c.set(n.key, f); while (c.size > (n.size === 'card' ? CACHE_MAX.card : CACHE_MAX.world)) c.delete(c.keys().next().value); }
  // a paint as a job: build (queue the primitives), draw them, shade, finish; step(deadline) works until the deadline
  function paintJob(L, n) {
    const S = SIZES[n.size];
    loadPortrait(L.face);
    const X = makeCtx(S.W, S.H, S.K, n.view * Math.PI / 4, S.FOOT); X.smooth = n.size !== 'card';
    X.q = [];
    const P = build(X, L, { act: n.act, ph: n.ph, loco: n.loco, breath: n.br, display: n.display });
    X.headC = P.head;
    const q = X.q; X.q = null;
    let qi = 0, sh = null;
    const job = { n, L, done: false, frame: null, ms: 0 };
    job.step = (deadline) => {
      const t0 = now();
      while (qi < q.length) { const ti = now(); q[qi++](); const te = now(); if (trace && te - ti > 6) trace.push(['item', qi - 1, +(te - ti).toFixed(1)]); if (te > deadline) { job.ms += te - t0; return false; } }
      if (!sh) sh = shadeJob(X, L);
      if (!sh.step(deadline)) { job.ms += now() - t0; return false; }
      const data = sh.result;
      let top = S.H, bot = -1, left = S.W, right = -1;
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (data[y * S.W + x]) { if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x; }
      job.frame = { w: S.W, h: S.H, data, top, bot, left, right, foot: S.FOOT, K: S.K, key: n.key };
      remember3(n, job.frame);
      job.done = true; job.ms += now() - t0;
      stats.paints++; stats.ms += job.ms; stats.last = job.ms;
      return true;
    };
    return job;
  }
  function peek(L, o) { const n = norm0(L, o), c = cacheOf(n.size), f = c.get(n.key); if (f) { c.delete(n.key); c.set(n.key, f); } return f || null; }
  // the whole paint now (what the card's tests and the old synchronous callers get)
  function paint(L, o) {
    const n = norm0(L, o), hit = cacheOf(n.size).get(n.key);
    if (hit) { cacheOf(n.size).delete(n.key); cacheOf(n.size).set(n.key, hit); return hit; }
    let j = jobs.get(n.key);
    if (!j || !j.step) j = paintJob(L, n);
    jobs.delete(n.key);   // a queued request for it is answered from the cache on the scheduler's next slice
    const t0 = now(); j.step(Infinity); const ms = now() - t0;
    if (ms > stats.worst) stats.worst = ms;
    return j.frame;
  }
  // ---- the scheduler: paints in slices of at most SLICE ms, highest priority first, between the browser's frames
  const SLICE = 8;
  let trace = null;   // tests and measurements: CARD21.traceOn() records any piece of work over 6 ms
  const jobs = new Map();             // key -> job (waiting or running)
  const waiting = [];                 // [{ key, pri, seq, cb: [] }]
  let seq = 0, timer = 0, idleWaiters = [];
  function request(L, o, pri, cb) {
    const n = norm0(L, o), hit = cacheOf(n.size).get(n.key);
    if (hit) return null;   // already painted: the caller reads it with peek() (no callback, so no re-entry)
    let w = waiting.find((x) => x.key === n.key);
    if (!w) { w = { key: n.key, size: n.size, pri: pri || 0, seq: ++seq, cb: [] }; waiting.push(w); jobs.set(n.key, { lazy: true, L, n }); }
    else if ((pri || 0) > w.pri) w.pri = pri;
    if (cb) w.cb.push(cb);
    kick();
    return n.key;
  }
  // between slices the page yields (a message-channel task: input and the browser's frames go first, but no 4 ms
  // timer clamp wastes the gaps), so the paints keep moving even while the game draws every frame
  let chan = null;
  try { if (typeof MessageChannel === 'function') { chan = new MessageChannel(); chan.port1.onmessage = () => tick(); } } catch (e) { chan = null; }
  // wanted-now paints (the card, a pose on screen) go on at once; the pre-paint (priority 2 or less) only in the
  // browser's idle time, so it never competes with the game's own frames
  const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : null;
  function later() {
    timer = 1;
    let top = 0; for (const w of waiting) if (w.pri > top) top = w.pri;
    if (top <= 2) { timer = 2; if (ric) ric((d) => tick(d), { timeout: 1000 }); else setTimeout(tick, 40); return; }
    if (chan) chan.port2.postMessage(0); else setTimeout(tick, 0);
  }
  // timer: 0 none, 1 a slice is coming now, 2 only an idle-time slice is coming (a wanted-now paint must not wait for it)
  function kick() {
    if (!waiting.length) return;
    let top = 0; for (const w of waiting) if (w.pri > top) top = w.pri;
    if (!timer || (timer === 2 && top > 2)) { try { later(); } catch (e) { timer = 0; } }
  }
  function tick(idleDeadline) {
    timer = 0;
    const t0 = now();
    let deadline = t0 + SLICE - 3;
    if (idleDeadline && typeof idleDeadline.timeRemaining === 'function' && !idleDeadline.didTimeout) deadline = t0 + Math.max(1, Math.min(SLICE - 3, idleDeadline.timeRemaining() - 1));
    while (waiting.length && now() < deadline) {
      waiting.sort((a, b) => b.pri - a.pri || a.seq - b.seq);
      const w = waiting[0];
      let j = jobs.get(w.key);
      const hit = cacheOf(w.size).get(w.key) || null;
      if (hit || !j) { waiting.shift(); jobs.delete(w.key); for (const cb of w.cb) { try { cb(hit); } catch (e) { warnOnce('cb', e); } } continue; }
      if (j.lazy) { j = paintJob(j.L, j.n); jobs.set(w.key, j); }
      if (j.step(deadline)) { waiting.shift(); jobs.delete(w.key); stats.asyncDone++; for (const cb of w.cb) { try { cb(j.frame); } catch (e) { warnOnce('cb', e); } } }
    }
    const used = now() - t0; stats.slices++; if (used > stats.sliceWorst) stats.sliceWorst = used;
    if (trace) { (stats.sliceLog || (stats.sliceLog = [])).push(used); if (stats.sliceLog.length > 4000) stats.sliceLog.shift(); }
    if (waiting.length) { try { later(); } catch (e) { timer = 0; } }
    else { const w = idleWaiters; idleWaiters = []; for (const fn of w) { try { fn(); } catch (e) { /* ignore */ } } }
  }
  // a promise that settles when every queued paint is done (tests; the card's swap)
  function idle() { return new Promise((res) => { if (!waiting.length) res(); else idleWaiters.push(res); }); }
  const por = (L) => (portraits[L.face] ? 'p' + portraitGen : 'n');

  // change listeners (the card repaints when a portrait arrives)
  const subs = [];
  function changed() { for (const fn of subs) { try { fn(); } catch (e) { warnOnce('sub', e); } } }


  // ================================================================ PARTNER AND GHOST (the same likeness in the world)
  // js/partner19.js: a solid figure, 80 x 192, one tile tall like a standing townsperson; drawn by the engine's sprite
  // pass so the scene's light and fog apply. js/ghost18.js: the same figure made pale and translucent, with each column's
  // painted rows (top/bot) so its draw loop skips the air. Both take the ghost painter's (b, loco, act, ph, look).
  // the figure painters ask for the same look every frame: the validated LOOK is memoised per input
  const lookMemo = new Map(); let remGen = 0; bumpRem = () => { remGen++; };
  function lookFor(look) {
    if (!look || typeof look !== 'object') return lookOf(null);
    let k;
    try { k = remGen + '|' + (look.v === 1 && look.weapon ? 'L' + sig(look) : compactKey(look) + (look.gear ? '|' + (typeof look.gear === 'object' ? sig(look.gear) : '') : '')); } catch (e) { k = null; }
    if (k && lookMemo.has(k)) return lookMemo.get(k);
    const L = look.v === 1 && look.weapon ? cleanGear(look) : lookFromCompact(look);
    if (k) { lookMemo.set(k, L); if (lookMemo.size > 64) lookMemo.delete(lookMemo.keys().next().value); }
    return L;
  }
  // every pose a fight needs, most likely first: standing and walking in each view, then block, the strikes, hurt, the
  // shot, the song; strikes in all four phases
  const POSES = (() => {
    const o = [];
    for (let b = 0; b <= 4; b++) for (let l = 0; l <= 2; l++) o.push([b, l, 0, 0]);
    for (const act of [9, 1, 2, 3, 8, 4, 5, 6, 7]) for (let b = 0; b <= 4; b++) for (const ph of (act <= 5 ? [0, 1, 2, 3] : act === 6 ? [0, 2] : [0])) o.push([b, 0, act, ph]);
    return o;
  })();
  const warmed = new Set();
  // paint every pose of this look ahead, in slices of at most SLICE ms (once per look and size)
  function prewarm(size, L, look) {
    const k = size + '|' + sig(L) + '|' + por(L); if (warmed.has(k)) return; warmed.add(k);
    if (warmed.size > 24) warmed.delete(warmed.values().next().value);
    for (const [b, loco, act, ph] of POSES) request(L, { size, view: b, loco, act, ph }, 1, size === 'ghost' ? (f) => { if (f) ghostConvert(f); } : null);
  }
  function worldFrame(size, b, loco, act, ph, look, opt) {
    const L = lookFor(look), o = { size, view: clamp(b | 0, 0, 4), loco, act, ph };
    if (on()) prewarm(size, L, look);
    if (!opt || opt.now !== false) return { f: paint(L, o), exact: true };
    const f = peek(L, o); if (f) return { f, exact: true };
    request(L, o, 5);   // the pose that is wanted now goes before the rest of the prewarm
    for (const alt of [{ loco: 0 }, { act: 0, ph: 0 }, { loco: 0, act: 0, ph: 0 }, { view: 0, loco: 0, act: 0, ph: 0 }]) { const g = peek(L, Object.assign({}, o, alt)); if (g) return { f: g, exact: false }; }
    return null;
  }
  // opt.now === false: never paint on the spot; returns the pose (exact: true), the nearest painted one (exact: false)
  // or null while nothing of this look is painted yet; the missing pose is painted in slices
  function partnerFrame(b, loco, act, ph, look, opt) {
    const r = worldFrame('partner', b, loco, act, ph, look, opt); if (!r) return null;
    const f = r.f;
    return { w: f.w, h: f.h, data: f.data, top: f.top, bot: f.bot, left: f.left, right: f.right, key: f.key, exact: r.exact };
  }
  const ghostCache = new Map();
  const GH_DARK = [64, 92, 136], GH_LIGHT = [226, 242, 255];
  function ghostFrame(b, loco, act, ph, look, opt) {
    const r = worldFrame('ghost', b, loco, act, ph, look, opt); if (!r) return null;
    const g = ghostConvert(r.f);
    return r.exact ? g : Object.assign({}, g, { exact: false });
  }
  function ghostConvert(f) {
    let g = ghostCache.get(f.key); if (g) return g;
    const { w, h } = f, src = f.data, data = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, p = src[i]; if (!p) continue;
      const r = p & 255, gg = (p >>> 8) & 255, bb = (p >>> 16) & 255;
      const lum = clamp((0.3 * r + 0.59 * gg + 0.11 * bb) / 200, 0, 1);
      const edge = !(x > 0 && src[i - 1]) || !(x < w - 1 && src[i + 1]) || !(y > 0 && src[i - w]) || !(y < h - 1 && src[i + w]);
      // pale blue by brightness, a quarter of the gear's own hue kept so the gear still reads
      let c = mixc(GH_DARK, GH_LIGHT, Math.pow(lum, 0.8)); c = mixc(c, [r, gg, bb], 0.24);
      let a = edge ? 236 : 150 + lum * 70;
      if (edge) c = mixc(c, GH_LIGHT, 0.6);
      const fade = y > f.foot - 12 ? clamp(1 - 0.45 * (y - (f.foot - 12)) / 14, 0.55, 1) : 1;
      a = Math.round(a * fade);
      data[i] = ((a << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
    }
    const top = new Int16Array(w).fill(h), bot = new Int16Array(w).fill(-1);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (data[y * w + x]) { if (top[x] === h) top[x] = y; bot[x] = y; }
    g = { w, h, data, top, bot, key: f.key, exact: true };
    ghostCache.set(f.key, g); while (ghostCache.size > 420) ghostCache.delete(ghostCache.keys().next().value);
    return g;
  }
  // the ghost painter's look gains the full gear (ignored by its codes, which stay compact), so the co-op partner and
  // the host's figure on the guest's screen wear the real kit; the compact look is remembered with the full one
  function wrapGhostLook() {
    if (typeof GHOST18 !== 'object' || !GHOST18 || typeof GHOST18.lookNow !== 'function' || GHOST18.lookNow.c21) return;
    const _ln = GHOST18.lookNow;
    const ln = function () {
      const r = _ln.apply(this, arguments);
      try { if (r && typeof r === 'object' && typeof G !== 'undefined' && G.player) { const L = lookOf(G.player); r.gear = L; if (G.player === homePlayer()) remember({ cls: r.cls, face: r.face, wpn: r.wpn, arm: r.arm }, L); } } catch (e) { warnOnce('lookNow', e); }
      return r;
    };
    ln.c21 = true; GHOST18.lookNow = ln;
  }
  // a co-op figure seen for the first time costs a few dozen milliseconds per pose: paint the standing and walking
  // poses of every view ahead, one per idle slice, as soon as a partner (or, on the guest, the host) is in the world
  function prewarmCoop() {
    let look = null;
    try { if (typeof PARTNER19 === 'object' && PARTNER19 && PARTNER19.active && PARTNER19.active() && PARTNER19.S) look = PARTNER19.S.look; } catch (e) { look = null; }
    try { if (!look && typeof SYNC19 === 'object' && SYNC19 && SYNC19.hostLook) look = SYNC19.hostLook(); } catch (e) { look = null; }
    if (!look || !on()) return;
    prewarm('partner', lookFor(look), look);
  }
  // the player whose likeness is "mine" (not a co-op partner standing in for G.player for a moment)
  const homePlayer = () => {
    if (typeof G === 'undefined' || !G.player) return null;
    try { if (typeof PARTNER19 === 'object' && PARTNER19 && PARTNER19.S && PARTNER19.S.pp === G.player) return null; } catch (e) { /* none */ }
    try { if (typeof EXTRAS17 === 'object' && EXTRAS17 && typeof EXTRAS17.inExtra === 'function' && EXTRAS17.inExtra()) return null; } catch (e) { /* none */ }   // an extra's own hero is not "me"; the extra stores nothing
    return G.player;
  };
  // remember what the compact ghost look of my current kit stands for (so my ghosts wear it after a reload)
  function rememberMine() { try { if (typeof GHOST18 === 'object' && GHOST18 && GHOST18.lookNow && homePlayer()) GHOST18.lookNow(); } catch (e) { /* none */ } }

  // ================================================================ THE CARD (DOM)
  const VIEW_NAMES = ['Front', 'Front right', 'Right side', 'Back right', 'Back', 'Back left', 'Left side', 'Front left'];
  const ui = { view: 0, raf: 0, t0: 0, cards: new Set(), lastSig: '' };
  const reduce = () => typeof GFX !== 'undefined' && !!GFX.reduceMotion;
  // the backdrop: a dark painted niche, a little stone plinth and the figure's shadow (procedural stand-in)
  const backdrops = new Map();
  function backdrop(L) {
    const key = L.cls; let cv = backdrops.get(key); if (cv) return cv;
    const S = SIZES.card;
    cv = document.createElement('canvas'); cv.width = S.W; cv.height = S.H;
    const cx = cv.getContext('2d'), img = cx.createImageData(S.W, S.H), d = img.data;
    const cal = (gear().calling && gear().calling[L.cls]) || LOCAL.calling[L.cls] || LOCAL.calling.blade;
    const tint = mixc([40, 32, 26], cal.cloak, 0.18);
    for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
      const dx = (x - S.W / 2) / (S.W * 0.62), dy = (y - S.H * 0.42) / (S.H * 0.62), r = Math.sqrt(dx * dx + dy * dy);
      let k = clamp(1.05 - r * 0.95, 0.18, 1) + BAYER[(y & 3) * 4 + (x & 3)] * 0.07;
      k = Math.round(k * 7) / 7;
      let c = [Math.max(25, tint[0] * k), Math.max(21, tint[1] * k), Math.max(16, tint[2] * k)];
      // the plinth: a worn stone disc under the feet
      const py = (y - (S.FOOT + 3)) / 9, px = (x - S.W / 2) / 52;
      if (px * px + py * py < 1) { const top = py < 0.15; const s = top ? 0.75 + 0.25 * (1 - px * px) : 0.42; c = [92 * s, 84 * s, 76 * s]; if (hash2(x >> 1, y >> 1) > 0.86) c = mixc(c, [30, 26, 24], 0.4); if (Math.abs(py - 0.15) < 0.12) c = [50, 44, 40]; }
      const i = (y * S.W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    // the shadow on the plinth
    cx.fillStyle = 'rgba(8,6,6,.55)'; cx.beginPath(); cx.ellipse(S.W / 2 + 4, S.FOOT + 1, 30, 5, 0, 0, Math.PI * 2); cx.fill();
    backdrops.set(key, cv);
    return cv;
  }
  const scratch = { cv: null };
  // draws the frame if it is painted; otherwise asks the scheduler for it (in slices, so the panel never freezes) and
  // meanwhile shows the nearest painted frame of this look, or leaves the old doll showing; true when exact
  function drawCard(cv, L, view, breath) {
    const cx = cv.getContext('2d'); if (!cx) return true;
    const o = { size: 'card', view, breath, display: true };
    let f = peek(L, o), exact = !!f;
    if (!f) {
      const later = () => setTimeout(() => paintAll(true), 0);   // repaint after the scheduler's slice, not inside it
      request(L, Object.assign({}, o, { breath: 0 }), 9, later);
      if (breath) request(L, o, 4, later);
      f = peek(L, Object.assign({}, o, { breath: 0 }));
      if (!f) {
        // nothing of this look yet: keep what is on the canvas; a fresh canvas outside the doll's svg gets the backdrop
        if (!cv._c21f && !cv.closest('svg')) { cx.imageSmoothingEnabled = false; cx.drawImage(backdrop(L), 0, 0); }
        return false;
      }
    }
    if (!scratch.cv) { scratch.cv = document.createElement('canvas'); scratch.cv.width = f.w; scratch.cv.height = f.h; }
    const sc = scratch.cv.getContext('2d');
    sc.putImageData(new ImageData(new Uint8ClampedArray(f.data.buffer.slice(0)), f.w, f.h), 0, 0);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(backdrop(L), 0, 0);
    cx.drawImage(scratch.cv, 0, 0);
    cv._c21f = f; cv._c21view = view;
    cv.dataset.c21sig = sig(L) + '#' + view;
    const svg = cv.closest('svg'); if (svg) svg.classList.add('c21-ready');
    // the breaths of this view, painted ahead at a low priority
    if (exact && !breath) for (const b2 of [0.25, 0.5, 0.75, 1]) request(L, Object.assign({}, o, { breath: b2 }), 2);
    return exact;
  }
  function breathNow(t) { return reduce() ? 0 : 0.5 - 0.5 * Math.cos(t / 1000 * Math.PI * 2 / 3.8); }
  function paintAll(force) {
    if (!on()) return;
    const L = lookOf(homePlayer());
    const s = sig(L);
    const t = typeof performance !== 'undefined' ? performance.now() : 0;
    const br = Math.round(breathNow(t) * 4) / 4;
    for (const cv of Array.from(document.querySelectorAll('canvas.c21-cv'))) {
      const v = ui.view;
      const want = s + '#' + v + '#' + br;
      if (!force && cv.dataset.c21want === want) continue;
      let ok = true;
      try { ok = drawCard(cv, L, v, br); } catch (e) { warnOnce('draw', e); }
      // not painted yet: try again when the scheduler answers (its callback repaints)
      cv.dataset.c21want = ok ? want : '';
      const lab = cv.closest('.c21-wrap') && cv.closest('.c21-wrap').querySelector('.c21-view');
      if (lab && lab.textContent !== VIEW_NAMES[v]) lab.textContent = VIEW_NAMES[v];
    }
  }
  function loop() {
    ui.raf = 0;
    if (!document.querySelector('canvas.c21-cv')) return;
    paintAll(false);
    ui.raf = requestAnimationFrame(loop);
  }
  function startLoop() { paintAll(true); if (!ui.raf) { try { ui.raf = requestAnimationFrame(loop); } catch (e) { ui.raf = 0; } } }
  function turn(d) { ui.view = ((ui.view + d) % 8 + 8) % 8; paintAll(true); }
  // controls: buttons, keys on the focused card, drag on the figure
  function wire(root) {
    root.querySelectorAll('[data-c21rot]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); turn(b.dataset.c21rot === '-1' ? -1 : 1); }; });
    root.querySelectorAll('canvas.c21-cv').forEach((cv) => {
      let drag = null;
      cv.onpointerdown = (ev) => { drag = { x: ev.clientX, acc: 0 }; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } };
      cv.onpointermove = (ev) => { if (!drag) return; drag.acc += ev.clientX - drag.x; drag.x = ev.clientX; const step = Math.max(18, cv.getBoundingClientRect().width / 6); while (Math.abs(drag.acc) > step) { turn(drag.acc > 0 ? -1 : 1); drag.acc -= Math.sign(drag.acc) * step; } };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
    });
  }
  const S0 = SIZES.card;
  const CTL = '<div class="c21-ctl"><button type="button" class="dfbtn small c21-rot" data-c21rot="-1" aria-label="Turn the figure left">&#9664;</button>'
    + '<span class="c21-view" aria-live="polite">Front</span><button type="button" class="dfbtn small c21-rot" data-c21rot="1" aria-label="Turn the figure right">&#9654;</button></div>';
  const CANVAS = '<canvas class="c21-cv" width="' + S0.W + '" height="' + S0.H + '" aria-hidden="true"></canvas>';
  // the inventory's doll: same figure element, heading, <title> and caption; the svg now holds the painted figure
  // (a canvas in a foreignObject) and, with item icons on, the readied weapon's and shield's icons as corner badges
  function dollHtml(html, p) {
    const t = /<title>[^<]*<\/title>/.exec(html), a = html.indexOf('<svg'), b = html.indexOf('</svg>');
    if (!t || a < 0 || b < 0) return html;
    let badges = '';
    try {
      if (typeof ICONS === 'object' && ICONS && (typeof GFX === 'undefined' || GFX.itemIcons !== false)) {
        const L = lookOf(p);
        const wu = ICONS.weaponUrl(L.weapon);
        const su = L.shield ? ICONS.url(L.shield) : null;
        if (wu && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(wu)) badges += '<image class="c21-badge" href="' + wu + '" x="4" y="' + (S0.H - 36) + '" width="30" height="30"/>';
        if (su && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(su)) badges += '<image class="c21-badge" href="' + su + '" x="' + (S0.W - 34) + '" y="' + (S0.H - 36) + '" width="30" height="30"' + (L.stowed ? ' opacity=".45"' : '') + '/>';
      }
    } catch (e) { warnOnce('badges', e); }
    // the Phase 5 doll stays underneath (its own markup, built from the catalog), so the panel shows a figure at once;
    // the painted card covers it the moment its first frame is ready
    let under = '';
    try { const inner = html.slice(html.indexOf('>', a) + 1, b).replace(/<title>[^<]*<\/title>/, ''); under = '<g class="c21-under" transform="translate(4 ' + Math.round((S0.H - 196) / 2 + 40) + ') scale(.94)">' + inner + '</g>'; } catch (e) { under = ''; }
    const svg = '<svg class="c21-svg" viewBox="0 0 ' + S0.W + ' ' + S0.H + '" role="img" aria-label="Equipment paper doll">' + t[0] + under
      + '<foreignObject x="0" y="0" width="' + S0.W + '" height="' + S0.H + '">' + CANVAS + '</foreignObject>' + badges + '</svg>';
    return html.slice(0, a).replace('class="paper-doll"', 'class="paper-doll c21-wrap"') + svg + CTL + html.slice(b + 6);
  }
  function charFigure() {
    const pn = document.querySelector('#modal-panel'); if (!pn) return;
    const col = pn.querySelector('.row > .col'); if (!col || col.querySelector('.c21-cv')) return;
    const img = col.querySelector('img');
    const box = document.createElement('div'); box.className = 'c21-char c21-wrap';
    box.innerHTML = CANVAS + CTL;   // constants only
    if (img) { img.classList.add('c21-face'); img.alt = 'Chosen character portrait'; box.appendChild(img); }
    col.insertBefore(box, col.firstChild);
    col.classList.add('c21-charcol');
    wire(box);
  }
  const STYLE = `
.paper-doll.c21-wrap svg.c21-svg { width: auto; height: 46cqh; max-height: none; max-width: 100%; aspect-ratio: ${S0.W} / ${S0.H}; }
.c21-wrap canvas.c21-cv { display: block; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; cursor: grab; touch-action: pan-y; }
.c21-wrap svg image.c21-badge { filter: drop-shadow(0 0 2px #000); }
.c21-wrap svg.c21-ready .c21-under { display: none; }
.c21-ctl { display: flex; align-items: center; justify-content: center; gap: .8cqw; margin: .5cqh 0; }
.c21-ctl .c21-view { min-width: 11cqw; font-family: var(--font-sc, serif); font-size: 1.6cqw; color: var(--parch-dim, #b9a888); text-align: center; }
.c21-ctl .dfbtn.small { padding: .2cqh 1cqw; min-width: 0; }
.c21-charcol { flex: 0 0 24cqw !important; }
.c21-char { position: relative; border: 3px ridge #967647; background: #191510; box-shadow: inset 0 0 25px #090706; padding: .4cqw; margin-bottom: .6cqh; }
.c21-char canvas.c21-cv { width: auto; height: 44cqh; aspect-ratio: ${S0.W} / ${S0.H}; margin: auto; }
.c21-char img.c21-face { position: absolute; left: .6cqw; top: .6cqw; width: 6.5cqw !important; height: 6.5cqw !important; border: 2px solid #0b0806 !important; box-shadow: 0 0 6px #000; }
.c21-char .c21-ctl { margin: .3cqh 0 0; }
`;
  function injectStyle() {
    if (typeof document === 'undefined' || !document.head || document.getElementById('card21-style')) return;
    const st = document.createElement('style'); st.id = 'card21-style'; st.textContent = STYLE; document.head.appendChild(st);
  }
  // Options: one row in Graphics & access
  function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify({ on: cfg.override })); } catch (e) { /* ignore */ } }
  function setOn(v) { cfg.override = !!v; if (typeof GFX !== 'undefined') { GFX.card21 = !!v; try { if (typeof GFX.changed === 'function') GFX.changed(); } catch (e) { /* ignore */ } } saveCfg(); }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('c21-opt')) return;
    const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.textContent = 'Character card ';
    const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = 'the figure in the inventory and Character panel: detailed pixel art built from your gear, or the simple painted doll';
    lab.appendChild(sm);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dfbtn small'; b.id = 'c21-opt';
    const sync = () => { b.textContent = on() ? 'Detailed' : 'Simple'; b.setAttribute('aria-pressed', on() ? 'true' : 'false'); b.classList.toggle('sel', on()); };
    b.onclick = () => { setOn(!on()); sync(); };
    sync();
    grid.appendChild(lab); grid.appendChild(b);
  }
  function install() {
    injectStyle();
    wrapGhostLook();
    if (typeof inventoryDoll === 'function') {
      const _doll = inventoryDoll;
      inventoryDoll = function (p) {
        const html = _doll.apply(this, arguments);
        if (!on()) return html;
        try { return dollHtml(html, p || G.player); } catch (e) { warnOnce('doll', e); return html; }
      };
    }
    if (typeof renderInventory === 'function') {
      const _inv = renderInventory;
      renderInventory = function () {
        const r = _inv.apply(this, arguments);
        try { if (on()) { const pn = document.querySelector('#modal-panel'); if (pn) wire(pn); startLoop(); rememberMine(); } } catch (e) { warnOnce('inv', e); }
        return r;
      };
    }
    if (typeof renderCharacter === 'function') {
      const _ch = renderCharacter;
      renderCharacter = function () {
        const r = _ch.apply(this, arguments);
        try { if (on()) { charFigure(); startLoop(); } } catch (e) { warnOnce('char', e); }
        return r;
      };
    }
    // equipping anything repaints a card that is showing, at once (even with no animation frame to come)
    for (const fn of ['equipArmor', 'removeArmor', 'useItem']) {
      if (typeof window[fn] !== 'function') continue;
      const _f = window[fn];
      window[fn] = function () { const r = _f.apply(this, arguments); try { if (on() && document.querySelector('canvas.c21-cv')) paintAll(false); } catch (e) { warnOnce(fn, e); } return r; };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () { const r = _acc.apply(this, arguments); try { appendRows(); } catch (e) { warnOnce('rows', e); } return r; };
    }
    subs.push(() => { try { if (document.querySelector('canvas.c21-cv')) paintAll(true); } catch (e) { /* ignore */ } });
    try { setInterval(() => { rememberMine(); prewarmCoop(); }, 5000); } catch (e) { /* none */ }
    try { if (typeof GFX !== 'undefined' && GFX.onChange) GFX.onChange(() => { if (cfg.override !== null && GFX.card21 !== cfg.override && GFX.preset !== 'plain') GFX.card21 = cfg.override; }); } catch (e) { /* ignore */ }
  }
  try { if (typeof document !== 'undefined') install(); } catch (e) { warnOnce('install', e); }

  return {
    LOCAL, gear, armorLook, weaponLook, lookOf, cleanGear, lookFromCompact, sig, remember, paint, ramp, pose, SIZES, stats: () => stats,
    on, cfg, KEY, onChange: (fn) => subs.push(fn), cacheSize: () => cache.size, clearCache: () => cache.clear(),
    QUEEN, queenEmblem, partnerFrame, ghostFrame, lookFor, idle, request, peek, prewarm, POSES, SLICE, traceOn: () => (trace = []), traceGet: () => trace, pending: () => waiting.map((w) => w.key + " p" + w.pri), paintAll, turn, setOn, appendRows, ui, VIEW_NAMES, drawCard,
    _internal: { makeCtx, build, shade, portraits, paintJob, norm0 },
  };
})();
if (typeof window !== 'undefined') window.CARD21 = CARD21;
