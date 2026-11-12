// ============================================================
//  gearlook21 — Phase 21 (team BODY owns this file): ONE source of truth for "what the player looks like in this gear".
//
//  CONTRACT (stable; v1). Read-only data + pure functions. No drawing, no DOM, no G.* writes, no Math.random.
//  Loaded after js/max20.js and before js/body21.js (BODY: first-person arms, hands, weapons, shield, legs and boots) and
//  js/card21.js (CARD: the character card / paper doll, and the likeness offered to js/partner19.js and js/ghost18.js).
//
//    GEARLOOK21.VERSION              1
//    GEARLOOK21.ARMOR[id]            appearance of every armour piece in js/data.js ARMOR (head, body, hands, feet, shield)
//    GEARLOOK21.WEAPONS[id]          appearance of every weapon in WEAPONS (js/data.js, js/upgrades.js, js/arms12.js)
//    GEARLOOK21.BARE[slot]           what shows when a slot is empty (bare head, a linen shirt, bare hands, plain shoes)
//    GEARLOOK21.FACES[1..6]          skin and hair per character-creation face (img/face_N.jpg)
//    GEARLOOK21.CALLINGS[classId]    calling colours: coat (the undershirt/trousers when no armour), accent (cloak, sash)
//    GEARLOOK21.GLASS                the Aether-Glass arm (cyan, faintly warm, faintly wet-looking; Light-glass hums 528)
//    GEARLOOK21.MATERIALS[m]         per material: how it reads (sheen 0..1, pattern, outline colour, sound word)
//    GEARLOOK21.of(player?)          -> LOOK, the resolved likeness of a player (defaults to G.player). Never throws.
//    GEARLOOK21.key(player?)         -> string that changes exactly when the visible likeness changes (cache key)
//    GEARLOOK21.ramp(rgb, n?)        -> n shades dark..light of a colour (pixel-art ramp, hue-shifted: cool shadows, warm lights)
//    GEARLOOK21.css(rgb, a?)         -> 'rgb(...)' / 'rgba(...)'
//    GEARLOOK21.ghostLook(player?)   -> { cls, face, wpn, arm } in js/ghost18.js lookNow()'s encoding (for partner/ghost)
//    GEARLOOK21.all()                -> { armor: [ids], weapons: [ids] } every id this table covers (tests check coverage)
//
//  LOOK (all colours are [r,g,b] 0..255; every sub-object is a frozen table entry or null — never save text):
//    { v: 1, face: 1..6, skin: [rgb], skinShade: [rgb], hair: { col, style }, calling: { id, coat, accent },
//      glassArm: bool,            // the player's LEFT arm is Aether-Glass past the elbow (p.glassed; the Dissonant Blade)
//      head, body, hands, feet,   // ARMOR entries (or the BARE entry for an empty slot; .bare = true)
//      shield,                    // ARMOR entry or null; shieldStowed: true when a two-handed weapon puts it on the back
//      shieldStowed: bool,
//      weapon,                    // WEAPONS entry of the readied weapon (bare hands when none)
//      offhand,                   // WEAPONS entry of the Phase 12 off-hand blade (dual wield) or null
//      twoHanded: bool,           // the readied weapon is held in both hands
//      key: string }              // same as key(player)
//
//  ARMOR entry: { id, slot, name, material, shape, pattern, col: { base, shade, light, dark, trim }, len?, notes }
//    slot      'head' | 'body' | 'hands' | 'feet' | 'shield'
//    material  'leather' | 'hushwool' | 'iron' | 'bellbronze' | 'oilcloth' | 'quilt' | 'canvas' | 'mail' | 'felt' | 'wood' | 'linen' | 'skin'
//    shape     the silhouette, per slot:
//      head:   'bare' | 'cap' (close skullcap) | 'hood' (cowl to the shoulders) | 'kettle' (broad brim) | 'bellhelm' (bell dome, eye slit)
//      body:   'shirt' | 'robe' (to the ankles, wide sleeves, stole) | 'gambeson' (mid-thigh, quilted sleeves) | 'jerkin'
//              (sleeveless leather over a linen shirt, leather bracers) | 'longcoat' (to the calf) | 'brigandine' (riveted
//              canvas, to the hip) | 'hauberk' (mail to the knee and wrist) | 'cuirass' (bell-cast plate over mail sleeves,
//              plated arms: couters and vambraces, tassets over the hips)
//      hands:  'bare' | 'gloves' | 'gauntlets'
//      feet:   'shoes' | 'softboots' (ankle, wrapped) | 'hobnails' (mid-calf, studded soles) | 'greaves' (shin-plates over knee boots)
//      shield: 'buckler' (round, fist-sized, a boss) | 'kite' (long, painted face)
//    pattern   'none' | 'quilt' | 'mail' | 'rivets' | 'plates' | 'weave' | 'studs' | 'stole' | 'grain'
//    len       body only: hem height as a fraction of leg length below the hip (0 = at the hip, 1 = to the ankle)
//    sleeve    body only: { material, col, cuff } what the forearm shows; bracer: true when a bracer/vambrace covers it
//    face      shield only: { field, figure, rim, boss } the painted face colours
//    size      shield only, in hand-widths (1 hand-width ~ 9 cm): buckler `radius` (half its diameter: 1.67 = a 30 cm
//              buckler, "fist-sized"); kite `width` x `height` (6.7 x 10 = about 60 x 90 cm); `cm` gives the same in
//              centimetres { w, h } for both (the buckler's w = h = its diameter)
//  WEAPONS entry: { id, name, kind, grip, material, len, col: { blade, edge, grip, guard, head }, img, notes }
//    kind      'fists' | 'glassarm' | 'sword' | 'longsword' | 'greatsword' | 'knife' | 'dirk' | 'throwing' | 'axe' | 'mace' |
//              'hammer' | 'maul' | 'spear' | 'glaive' | 'pistol' | 'crossbow'
//    grip      'none' | 'one' | 'two' | 'innate'   (two = both hands on the haft or stock)
//    len       overall length in hand-widths (a hand-width ~ 9 cm): knife 3, sword 8, longsword 11, spear 22
//    img       the existing first-person painting in Engine.images (fp_*), so BODY can keep it and CARD can read its tones
//
//  Rules: colours are muted and earthy (the game's palette); metal is never pure grey (iron leans blue, bell-bronze leans
//  gold-green); [PROPOSED] marks a visual detail invented here (not in the bibles). The table only DESCRIBES gear:
//  changing gear stays the game's business (equipArmor, p.weapon). Unknown ids fall back to a neutral entry.
// ============================================================
'use strict';

// the game's catalog, captured before this module's own tables shadow the name
const GAME_WEAPONS_REF = typeof WEAPONS !== 'undefined' ? WEAPONS : null;
const GEARLOOK21 = (() => {
  const F = (o) => Object.freeze(o);
  const GAME_W = GAME_WEAPONS_REF;
  const C = (base, shade, light, dark, trim) => F({ base, shade, light, dark: dark || shade.map((v) => Math.round(v * 0.6)), trim: trim || light });

  // ---- materials: how a surface reads -------------------------------------------------------------------------------
  const MATERIALS = F({
    skin: F({ sheen: 0.15, pattern: 'none', ink: [58, 34, 24] }),
    linen: F({ sheen: 0.05, pattern: 'weave', ink: [46, 36, 26] }),
    quilt: F({ sheen: 0.05, pattern: 'quilt', ink: [50, 38, 26] }),
    leather: F({ sheen: 0.35, pattern: 'grain', ink: [40, 24, 14] }),
    hushwool: F({ sheen: 0.0, pattern: 'weave', ink: [20, 30, 28] }),
    oilcloth: F({ sheen: 0.45, pattern: 'none', ink: [40, 44, 44] }),
    canvas: F({ sheen: 0.1, pattern: 'weave', ink: [40, 34, 24] }),
    felt: F({ sheen: 0.0, pattern: 'none', ink: [36, 28, 22] }),
    mail: F({ sheen: 0.7, pattern: 'mail', ink: [34, 38, 44] }),
    iron: F({ sheen: 0.8, pattern: 'none', ink: [30, 34, 40] }),
    bellbronze: F({ sheen: 0.85, pattern: 'none', ink: [52, 38, 18] }),
    wood: F({ sheen: 0.2, pattern: 'grain', ink: [40, 26, 14] }),
    glass: F({ sheen: 1.0, pattern: 'facets', ink: [24, 86, 98] }),
    steel: F({ sheen: 0.9, pattern: 'none', ink: [30, 34, 40] }),
  });

  // ---- the people: faces (skin, hair) and callings ----------------------------------------------------------------------
  // sampled by eye from img/face_1..6.jpg; hair style names match the portraits
  const FACES = F({
    1: F({ skin: [186, 140, 112], hair: [70, 54, 42], style: 'short' }),     // dark-haired man, often hooded
    2: F({ skin: [214, 160, 128], hair: [150, 64, 34], style: 'braids' }),   // red braids
    3: F({ skin: [178, 128, 96], hair: [212, 206, 196], style: 'beard' }),   // white beard and a sailor's cap
    4: F({ skin: [222, 186, 164], hair: [34, 30, 34], style: 'bob' }),       // black hair, hooded
    5: F({ skin: [176, 124, 94], hair: [60, 44, 36], style: 'bald' }),       // shaved head, a scar
    6: F({ skin: [214, 180, 160], hair: [196, 196, 204], style: 'long' }),   // long silver hair
  });
  // the same calling palettes js/partner19.js paints the co-op traveller with (coat, cloak/robe accent)
  const CALLINGS = F({
    blade: F({ coat: [92, 70, 52], accent: [104, 48, 40] }),       // leather, an oxblood cloak
    cantor: F({ coat: [70, 60, 74], accent: [96, 76, 100] }),      // dusty plum
    corsair: F({ coat: [56, 66, 84], accent: [118, 56, 44] }),     // faded sea coat, red sash
    archivist: F({ coat: [74, 76, 56], accent: [90, 94, 62] }),    // olive
    penitent: F({ coat: [92, 88, 82], accent: [112, 108, 98] }),   // ash grey
    quarry: F({ coat: [116, 92, 62], accent: [86, 64, 46] }),      // ochre canvas, umber
  });
  const CLASS_ORDER = ['blade', 'cantor', 'corsair', 'archivist', 'penitent', 'quarry'];
  // Light-glass: cyan, faintly warm, faintly wet-looking (LORE_P6)
  const GLASS = F({ base: [96, 200, 214], shade: [40, 120, 142], light: [196, 246, 244], dark: [22, 70, 86], glow: [140, 236, 240], hz: 528 });

  // ---- armour -----------------------------------------------------------------------------------------------------------
  const IRON = C([128, 138, 146], [78, 86, 98], [192, 200, 204], [40, 44, 54]);
  const BRONZE = C([170, 132, 70], [112, 84, 44], [226, 196, 128], [62, 44, 22], [92, 128, 104]);   // trim: verdigris
  const MAIL = C([138, 146, 150], [82, 90, 100], [200, 206, 206], [40, 44, 52]);
  const ARM = F({
    // head
    a_cap: F({ id: 'a_cap', slot: 'head', material: 'leather', shape: 'cap', pattern: 'grain', col: C([118, 80, 50], [80, 52, 32], [156, 112, 74]), notes: 'boiled leather skullcap, stitched seam over the crown' }),
    a_hood: F({ id: 'a_hood', slot: 'head', material: 'hushwool', shape: 'hood', pattern: 'weave', col: C([58, 82, 76], [36, 54, 50], [86, 112, 102]), notes: 'packed-wool hood falling onto the shoulders' }),
    a_p22_barrowhelm: F({ id: 'a_p22_barrowhelm', slot: 'head', material: 'bellbronze', shape: 'kettle', pattern: 'none', col: BRONZE, notes: 'a barrow-warden\'s bronze cap with cheek-guards, green with age [PROPOSED] (Phase 22b)' }),
    a_kettle: F({ id: 'a_kettle', slot: 'head', material: 'iron', shape: 'kettle', pattern: 'rivets', col: IRON, notes: 'broad-brimmed infantry helm' }),
    a_bellhelm: F({ id: 'a_bellhelm', slot: 'head', material: 'bellbronze', shape: 'bellhelm', pattern: 'none', col: BRONZE, notes: 'a Legion bell-helm, hollowed: bell dome, eye slit, a verdigris lip [PROPOSED]' }),
    // body
    a_synodrobe: F({ id: 'a_synodrobe', slot: 'body', material: 'oilcloth', shape: 'robe', pattern: 'stole', len: 1.0, col: C([132, 140, 138], [90, 96, 96], [176, 182, 176], null, [206, 206, 186]),
      sleeve: F({ material: 'oilcloth', col: [132, 140, 138], cuff: [206, 206, 186], wide: true }), notes: 'grey oilcloth, a silver registry stole (trim)' }),
    a_gambeson: F({ id: 'a_gambeson', slot: 'body', material: 'quilt', shape: 'gambeson', pattern: 'quilt', len: 0.35, col: C([164, 138, 98], [116, 94, 64], [204, 180, 136]),
      sleeve: F({ material: 'quilt', col: [164, 138, 98], cuff: [116, 94, 64] }), notes: 'quilted linen and wool, diamond stitching' }),
    a_jerkin: F({ id: 'a_jerkin', slot: 'body', material: 'leather', shape: 'jerkin', pattern: 'grain', len: 0.15, col: C([128, 84, 54], [86, 54, 34], [170, 120, 80]),
      sleeve: F({ material: 'linen', col: [176, 160, 132], cuff: [128, 84, 54], bracer: true, rolled: true }), notes: 'oiled leather, sleeveless over a linen shirt; leather bracers' }),
    a_hushcoat: F({ id: 'a_hushcoat', slot: 'body', material: 'hushwool', shape: 'longcoat', pattern: 'weave', len: 0.8, col: C([54, 78, 72], [34, 50, 48], [82, 108, 98]),
      sleeve: F({ material: 'hushwool', col: [54, 78, 72], cuff: [34, 50, 48] }), notes: 'long coat of the Hedge wool, to the calf' }),
    a_p22_shroud: F({ id: 'a_p22_shroud', slot: 'body', material: 'hushwool', shape: 'longcoat', pattern: 'weave', len: 0.9, col: C([106, 102, 94], [70, 66, 60], [140, 136, 126]),
      sleeve: F({ material: 'hushwool', col: [106, 102, 94], cuff: [70, 66, 60] }), notes: 'Hedge-wool torn from the Old Fleece, earth-grey, to the ankle [PROPOSED] (Phase 22b)' }),
    a_p22_mantle: F({ id: 'a_p22_mantle', slot: 'body', material: 'hushwool', shape: 'longcoat', pattern: 'weave', len: 0.6, col: C([206, 198, 174], [150, 142, 120], [232, 226, 206]),
      sleeve: F({ material: 'hushwool', col: [206, 198, 174], cuff: [150, 142, 120] }), notes: 'felted Farrant fleece, the colour of the chalk, to the knee [PROPOSED] (Phase 22)' }),
    a_brig: F({ id: 'a_brig', slot: 'body', material: 'canvas', shape: 'brigandine', pattern: 'rivets', len: 0.25, col: C([104, 92, 70], [70, 60, 44], [140, 126, 96], null, [196, 164, 92]),
      sleeve: F({ material: 'canvas', col: [104, 92, 70], cuff: [196, 164, 92], bracer: true }), notes: 'company canvas over riveted plates, brass rivets (trim), a stencilled serial [PROPOSED]' }),
    a_chain: F({ id: 'a_chain', slot: 'body', material: 'mail', shape: 'hauberk', pattern: 'mail', len: 0.5, col: MAIL,
      sleeve: F({ material: 'mail', col: MAIL.base, cuff: [82, 90, 100] }), notes: 'arsenal mail to the knee and the wrist' }),
    a_plate: F({ id: 'a_plate', slot: 'body', material: 'bellbronze', shape: 'cuirass', pattern: 'plates', len: 0.3, col: BRONZE,
      sleeve: F({ material: 'mail', col: MAIL.base, cuff: BRONZE.base, bracer: true, plated: true }), notes: 'a Legionnaire\'s bell-cast cuirass; couters and vambraces over mail sleeves; tassets' }),
    // hands
    a_gloves: F({ id: 'a_gloves', slot: 'hands', material: 'leather', shape: 'gloves', pattern: 'grain', col: C([112, 74, 46], [74, 46, 28], [150, 106, 70]), notes: 'work gloves, a cuff over the wrist' }),
    a_gauntlets: F({ id: 'a_gauntlets', slot: 'hands', material: 'mail', shape: 'gauntlets', pattern: 'mail', col: C([140, 148, 152], [84, 92, 102], [204, 208, 208], [40, 44, 52], [100, 70, 46]), notes: 'mail backs on leather palms (trim = the palm leather), a flared cuff' }),
    // feet
    a_p22_droverboots: F({ id: 'a_p22_droverboots', slot: 'feet', material: 'leather', shape: 'hobnails', pattern: 'grain', col: C([70, 50, 34], [46, 32, 20], [104, 78, 54]), notes: 'long greased drove-road boots [PROPOSED] (Phase 22b)' }),
    a_softboots: F({ id: 'a_softboots', slot: 'feet', material: 'felt', shape: 'softboots', pattern: 'none', col: C([96, 82, 66], [64, 54, 42], [130, 114, 92]), notes: 'felt-soled, ankle-high, wrapped with a thong' }),
    a_hobnails: F({ id: 'a_hobnails', slot: 'feet', material: 'leather', shape: 'hobnails', pattern: 'studs', col: C([76, 54, 38], [50, 34, 22], [112, 82, 58], null, [176, 176, 168]), notes: 'mid-calf boots, iron studs round the sole (trim)' }),
    a_greaves: F({ id: 'a_greaves', slot: 'feet', material: 'iron', shape: 'greaves', pattern: 'plates', col: C([132, 142, 150], [80, 88, 100], [196, 204, 208], [40, 44, 54], [62, 44, 32]), notes: 'shin-plates over knee-high riding boots (trim = the boot leather)' }),
    // shields
    a_buckler: F({ id: 'a_buckler', slot: 'shield', material: 'iron', shape: 'buckler', pattern: 'none', col: IRON, radius: 1.67, cm: F({ w: 30, h: 30 }),
      face: F({ field: [118, 96, 72], figure: [150, 62, 48], rim: [104, 112, 120], boss: [176, 184, 188] }), notes: 'a fist-sized round deck shield: iron rim and boss on a leather-faced board, a corsair\'s red band [PROPOSED]' }),
    a_kite: F({ id: 'a_kite', slot: 'shield', material: 'wood', shape: 'kite', pattern: 'none', col: C([94, 60, 50], [62, 38, 32], [130, 88, 72]), width: 6.7, height: 10, cm: F({ w: 60, h: 90 }),
      face: F({ field: [94, 60, 50], figure: [210, 196, 166], rim: [176, 150, 98], boss: [200, 164, 80] }), notes: 'long and heavy, painted with the Synod\'s dead queen: a pale crowned figure on an oxblood field [PROPOSED: the colours]' }),
  });
  // empty slots
  const BARE = F({
    head: F({ id: null, bare: true, slot: 'head', material: 'skin', shape: 'bare', pattern: 'none', col: null }),
    body: F({ id: null, bare: true, slot: 'body', material: 'linen', shape: 'shirt', pattern: 'weave', len: 0.1, col: null,   // col: the calling's coat (see of())
      sleeve: F({ material: 'linen', col: null, cuff: null, rolled: true }) }),
    hands: F({ id: null, bare: true, slot: 'hands', material: 'skin', shape: 'bare', pattern: 'none', col: null }),
    feet: F({ id: null, bare: true, slot: 'feet', material: 'leather', shape: 'shoes', pattern: 'none', col: C([66, 50, 38], [44, 32, 24], [96, 74, 56]) }),
  });

  // ---- weapons ----------------------------------------------------------------------------------------------------------
  const W = (id, kind, grip, material, len, col, img, notes) => F({ id, kind, grip, material, len, col: F(col), img, notes: notes || '' });
  const STEEL = { blade: [168, 176, 184], edge: [226, 230, 232], grip: [92, 60, 38], guard: [120, 112, 100] };
  const WEP = F({
    hands: W('hands', 'fists', 'none', 'skin', 0, {}, 'fp_hands', 'bare fists'),
    glass: W('glass', 'glassarm', 'innate', 'glass', 0, { blade: GLASS.base, edge: GLASS.light }, 'fp_glass', 'the arm itself, glassed past the elbow'),
    sword: W('sword', 'sword', 'one', 'steel', 8, STEEL, 'fp_sword', 'Synod iron, a plain cross-guard'),
    knife: W('knife', 'knife', 'one', 'steel', 3.5, { blade: [160, 166, 172], edge: [220, 224, 226], grip: [104, 70, 42], guard: [80, 64, 48] }, 'fp_knife', 'a wool-carder\'s blade'),
    longsword: W('longsword', 'longsword', 'one', 'steel', 11, { blade: [176, 184, 192], edge: [232, 236, 238], grip: [70, 46, 32], guard: [142, 134, 122] }, 'fp_longsword', 'arsenal steel, long cross-guard'),
    axe: W('axe', 'axe', 'one', 'steel', 8, { blade: [150, 156, 160], edge: [214, 218, 220], grip: [110, 74, 44], head: [150, 156, 160] }, 'fp_axe', 'bearded head and a hatch spike'),
    mace: W('mace', 'mace', 'one', 'bellbronze', 7, { blade: [178, 146, 74], edge: [230, 204, 132], grip: [74, 70, 66], head: [178, 146, 74] }, 'fp_mace', 'flanged bell-bronze head on an iron haft'),
    tollhammer: W('tollhammer', 'hammer', 'one', 'bellbronze', 8, { blade: [168, 134, 66], edge: [224, 196, 124], grip: [96, 64, 40], head: [168, 134, 66] }, 'fp_mace', 'a bell-ringer\'s hammer, bell-bronze'),
    spear: W('spear', 'spear', 'two', 'bellbronze', 22, { blade: [176, 142, 72], edge: [228, 202, 130], grip: [124, 92, 58], head: [176, 142, 72] }, 'fp_spear', 'a bronze tuning fork on an ash shaft'),
    maul: W('maul', 'maul', 'two', 'steel', 12, { blade: [120, 126, 130], edge: [190, 194, 196], grip: [88, 92, 96], head: [120, 126, 130], guard: [196, 160, 80] }, 'fp_maul', 'a foundry hammer with a brass pressure gauge (guard)'),
    pistol: W('pistol', 'pistol', 'one', 'wood', 5, { blade: [70, 66, 64], edge: [180, 236, 244], grip: [104, 66, 40], guard: [190, 156, 84] }, 'fp_pistol', 'walnut stock, brass furniture, a glass pellet at the muzzle (edge)'),
    crossbow: W('crossbow', 'crossbow', 'two', 'wood', 9, { blade: [140, 146, 150], edge: [210, 206, 190], grip: [108, 70, 42], guard: [80, 84, 90] }, 'fp_crossbow', 'iron prod (blade), a wooden stock'),
    throwknife: W('throwknife', 'throwing', 'one', 'steel', 3, { blade: [160, 166, 172], edge: [220, 224, 226], grip: [70, 60, 52], guard: [70, 60, 52] }, 'fp_knife', 'balanced carder\'s blades, a fan of them in the off hand [PROPOSED]'),
    tobin_blade: W('tobin_blade', 'longsword', 'one', 'bellbronze', 11, { blade: [190, 156, 88], edge: [240, 220, 160], grip: [60, 44, 34], guard: [176, 140, 70] }, 'fp_longsword', 'Tobin\'s tuning-blade: bronze, ground to ring at 174'),
    vesper_hook: W('vesper_hook', 'axe', 'one', 'steel', 9, { blade: [132, 138, 146], edge: [214, 218, 222], grip: [66, 44, 30], head: [132, 138, 146], guard: [150, 62, 48] }, 'fp_axe', 'Vesper\'s deck-axe, a red-wrapped haft [PROPOSED]'),
    sable_dagger: W('sable_dagger', 'knife', 'one', 'glass', 3.5, { blade: [222, 214, 196], edge: [196, 168, 236], grip: [40, 34, 40], guard: [196, 168, 236] }, 'fp_knife', 'an ivory stylus-knife tipped with lilac glass'),
    p12_greatmaul: W('p12_greatmaul', 'maul', 'two', 'iron', 16, { blade: [106, 110, 116], edge: [170, 176, 180], grip: [150, 120, 84], head: [106, 110, 116], guard: [88, 90, 92] }, 'fp_maul', 'a quarry sledge, lead-weighted, an ash haft as long as a man'),
    p12_glassblade: W('p12_glassblade', 'greatsword', 'two', 'glass', 14, { blade: [150, 214, 222], edge: [214, 250, 248], grip: [58, 46, 40], guard: [130, 134, 140] }, 'fp_longsword', 'a corsair\'s two-handed blade, the edge ground from salvaged Aether-Glass'),
    p12_bellglaive: W('p12_bellglaive', 'glaive', 'two', 'bellbronze', 22, { blade: [180, 146, 76], edge: [232, 206, 134], grip: [120, 88, 56], head: [180, 146, 76] }, 'fp_spear', 'a curved bell-bronze blade on a six-foot shaft'),
    p22_crook: W('p22_crook', 'spear', 'two', 'wood', 22, { blade: [206, 190, 150], edge: [234, 222, 190], grip: [124, 92, 58], head: [206, 190, 150] }, 'fp_spear', 'an ash crook with a horn head [PROPOSED] (Phase 22b)'),
    p22_shears: W('p22_shears', 'knife', 'one', 'steel', 3.5, { blade: [170, 176, 180], edge: [226, 230, 232], grip: [110, 80, 50], guard: [110, 80, 50] }, 'fp_knife', 'sheep-shears, the bow filed sharp [PROPOSED] (Phase 22b)'),
    p22_leafblade: W('p22_leafblade', 'sword', 'one', 'bellbronze', 8, { blade: [186, 150, 80], edge: [236, 210, 140], grip: [90, 64, 40], guard: [160, 124, 60] }, 'fp_sword', 'a leaf-shaped bronze sword from a barrow grave [PROPOSED] (Phase 22b)'),
    p12_dirk: W('p12_dirk', 'dirk', 'one', 'steel', 4, { blade: [164, 170, 176], edge: [224, 228, 230], grip: [80, 56, 36], guard: [126, 118, 104] }, 'fp_knife', 'a stiff dirk with a basket hilt (guard)'),
  });
  const NEUTRAL_W = (id) => F(Object.assign({}, WEP.sword, { id, notes: 'unknown weapon: drawn as a sword' }));

  // ---- helpers ----------------------------------------------------------------------------------------------------------
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
  function css(c, a) { if (!c) return 'transparent'; return a == null ? `rgb(${clamp8(c[0])},${clamp8(c[1])},${clamp8(c[2])})` : `rgba(${clamp8(c[0])},${clamp8(c[1])},${clamp8(c[2])},${a})`; }
  // a pixel-art ramp: shadows drift toward cool violet, lights toward warm cream
  function ramp(c, n) {
    n = n || 5; const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), k = 0.45 + t * 0.85;
      let r = c[0] * k, g = c[1] * k, b = c[2] * k;
      if (t < 0.5) { const s = (0.5 - t) * 2 * 0.18; r = r * (1 - s) + 40 * s; g = g * (1 - s) + 34 * s; b = b * (1 - s) + 58 * s; }
      else { const s = (t - 0.5) * 2 * 0.12; r = r * (1 - s) + 255 * s; g = g * (1 - s) + 236 * s; b = b * (1 - s) + 196 * s; }
      out.push([clamp8(r), clamp8(g), clamp8(b)]);
    }
    return out;
  }
  const mul = (c, k) => [clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k)];

  function playerOf(p) { if (p) return p; try { return typeof G !== 'undefined' && G ? G.player : null; } catch (e) { return null; } }
  function armorId(p, slot) { const id = p && p.armor && p.armor[slot]; return own(ARM, id) && ARM[id].slot === slot ? id : null; }
  function weaponId(p) { const w = p && Array.isArray(p.weapons) ? p.weapons[p.weapon] : null; return typeof w === 'string' ? w : 'hands'; }
  function classId(p) { const c = p && p.cls; const id = c && typeof c === 'object' ? c.id : c; return own(CALLINGS, id) ? id : 'blade'; }
  function faceOf(p) { const f = p && p.face; return [1, 2, 3, 4, 5, 6].includes(f) ? f : 1; }
  function offhandId(p) {
    try {
      if (typeof ARMS12 === 'object' && ARMS12 && typeof ARMS12.dualActive === 'function' && p === (typeof G !== 'undefined' ? G.player : null) && ARMS12.dualActive()) {
        const o = ARMS12.offId(); return own(WEP, o) ? o : null;
      }
    } catch (e) { /* no off hand */ }
    return null;
  }
  function weaponEntry(id) { return own(WEP, id) ? WEP[id] : NEUTRAL_W(String(id).slice(0, 24)); }
  // the game's own catalog decides two-handedness (js/data.js twoHanded, as shieldBlocked() reads it); the table's grip is the fallback
  function twoHandedId(id) { try { const w = GAME_W && own(GAME_W, id) ? GAME_W[id] : null; if (w) return !!w.twoHanded; } catch (e) { /* fall back to the table */ } return own(WEP, id) && WEP[id].grip === 'two'; }

  function key(p) {
    p = playerOf(p); if (!p) return 'none';
    const off = offhandId(p);
    return [classId(p), faceOf(p), p.glassed ? 1 : 0, armorId(p, 'head'), armorId(p, 'body'), armorId(p, 'hands'), armorId(p, 'feet'), armorId(p, 'shield'), weaponId(p), off, twoHandedId(weaponId(p)) ? 2 : 1].join('|');
  }
  function of(p) {
    p = playerOf(p);
    const fc = FACES[faceOf(p)], cid = classId(p), call = CALLINGS[cid];
    const slot = (s) => { const id = armorId(p, s); return id ? ARM[id] : null; };
    let body = slot('body');
    if (!body) {   // the calling's own shirt and coat colours
      const cc = C(call.coat, mul(call.coat, 0.66), mul(call.coat, 1.3));
      body = F(Object.assign({}, BARE.body, { col: cc, sleeve: F({ material: 'linen', col: call.coat, cuff: mul(call.coat, 0.66), rolled: true }) }));
    }
    const wid = weaponId(p), wE = weaponEntry(wid), two = twoHandedId(wid), sh = slot('shield'), off = offhandId(p);
    return {
      v: 1, face: faceOf(p), skin: fc.skin, skinShade: mul(fc.skin, 0.72), hair: { col: fc.hair, style: fc.style },
      calling: { id: cid, coat: call.coat, accent: call.accent },
      glassArm: !!(p && p.glassed),
      head: slot('head') || BARE.head, body, hands: slot('hands') || BARE.hands, feet: slot('feet') || BARE.feet,
      shield: sh, shieldStowed: !!(sh && two),
      weapon: wE, offhand: off ? WEP[off] : null, twoHanded: two,
      key: key(p),
    };
  }
  // js/ghost18.js lookNow()'s compact encoding, from this table (so partner/ghost and the card agree)
  const GH_W = { hands: 0, sword: 1, knife: 2, dirk: 2, throwing: 2, longsword: 3, greatsword: 3, axe: 4, mace: 5, hammer: 5, maul: 5, spear: 6, glaive: 6, pistol: 7, crossbow: 8, glassarm: 9, fists: 0 };
  const GH_HEAD = { cap: 1, hood: 2, kettle: 3, bellhelm: 3 };
  const GH_BODY = { robe: 1, gambeson: 1, longcoat: 1, jerkin: 2, brigandine: 2, hauberk: 2, cuirass: 2 };
  function ghostLook(p) {
    p = playerOf(p); const L = of(p);
    const arm = (GH_HEAD[L.head.shape] || 0) | ((L.body.bare ? 0 : GH_BODY[L.body.shape] || 0) << 2) | ((L.shield && !L.shieldStowed ? 1 : 0) << 4) | ((L.hands.bare ? 0 : 1) << 5);
    return { cls: Math.max(0, CLASS_ORDER.indexOf(L.calling.id)), face: L.face, wpn: GH_W[L.weapon.kind] != null ? GH_W[L.weapon.kind] : 1, arm };
  }
  function all() { return { armor: Object.keys(ARM), weapons: Object.keys(WEP) }; }

  return F({ VERSION: 1, ARMOR: ARM, WEAPONS: WEP, BARE, FACES, CALLINGS, CLASS_ORDER, GLASS, MATERIALS, of, key, ramp, css, ghostLook, all, mul });
})();
if (typeof window !== 'undefined') window.GEARLOOK21 = GEARLOOK21;
