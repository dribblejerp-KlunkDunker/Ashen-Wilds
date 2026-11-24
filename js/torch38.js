// ============================================================
//  torch38 - Phase 38, "start with a torch". The owner's ruling (Q-A1, 2026-11-23): every traveller starts with a torch;
//  a lantern is a thing you find or buy.
//
//  WHAT THE BIBLE SAYS (searched before anything was invented). The Pitch Torch: "Torch, 0.8 kg, 240 s of fuel by
//  default. In every background's kit (90 s for the Gutter-kin, 360 s for the Hedge-priest)"; "A stave with a head of rag
//  wound tight and dipped in pitch", bog-pine pitch; "a light means fuel, not safety"; a torch "dims as it runs low and
//  gutters out"; the weather's torch-burn column (items-and-texts.md, the-smothering.md). The Horn Lantern: "Torch,
//  1.2 kg. A shuttered lantern: less light range than the torch but burns half as fast. Refills from a Flask of Lamp
//  Oil" (items-and-texts.md, item proposal 3). Lanterns are "only mended", never made new, in the Blackfen. Lamp oil:
//  "Keep it from the torch." The lore's proposal put a lantern in the Hedge-priest's kit; the owner's ruling overrides
//  it: every kit starts with the torch.
//
//  WHAT IT DOES
//    * THE TORCH IN THE LEFT HAND. Phase 7 drew the left hand; this phase hands it a pitch torch instead: a stave in the
//      fist, a head of wound rag black with pitch, and a moving flame (four painted frames, picked by the anim clock).
//    * ITS FUEL. The kit's torch fuel (G.flags.la_torch, seconds): 240, the gutter-kin 90, the hedge-priest 360. It
//      burns by Phase 7's rules (U, the weather's burn, the last fifth shrinking, the last half minute guttering), and
//      when it is spent it is spent: lamp oil does not go on a torch.
//    * ITS LIGHT. Bigger than the lantern's and a little redder (pitch, not tallow): the bible's "less light range than
//      the torch" read the other way. The walking bloom sees it as it sees the lantern.
//    * THE LANTERN, GIVEN. Marget Sayle gives you her horn lantern the first time you speak to her (the owner's ruling,
//      2026-11-23: "she will give it to you"). It goes into the left hand (unlit, half full); the torch goes to the pack
//      with what fuel it has. Using either one from the pack takes it into the hand; using the one in hand
//      lights or douses it. Her flasks fill the lantern and nothing else.
//    * THE LANTERN, BOUGHT. The item table gets a Horn Lantern row with a price [PROPOSED], so any trader can sell it;
//      TORCH38.gain('lantern') is the hook a trader calls. No trader exists yet.
//    * OLD SAVES. A save from before this phase carried a lantern, so it keeps one (and gets the kit's torch in the pack).
//      A save written by the build merged in PRs #63/#64 carried the torch's fuel in the lantern's oil and no flasks:
//      that fuel becomes the torch's, and Marget's two flasks are put back.
//
//  Switch: Options > "Start with a torch" (GFX.laTorch). Off, everything is Phase 7 as approved: the lantern in hand
//  from the start, no lantern on the plank. Nothing here uses a random number.
// ============================================================
'use strict';

const TORCH38 = (() => {
  const K = typeof ART2 !== 'undefined' ? ART2.kit : (typeof require !== 'undefined' ? require('./art2.js').kit : null);
  const { sheet, put, at, limb, oval, outline, done, cols, ramp, vnoise, hash, clamp, lerp, SKIN, INK } = K;

  // ---------------------------------------------------------------- the numbers ([PROPOSED] unless the bible gave them; see ROADMAP.md)
  const T = {
    fuel: 240, fuelBy: { gutter: 90, priest: 360 },   // the bible's
    r: [2.2, 5.6],              // the pool's radius in cells, nearly spent to fresh: more than the lantern's 1.7 to 4.2 [PROPOSED]
    col: [255, 140, 30],        // pitch flame: tallow yellow pulled toward red, still "yours" and never the land's ember [PROPOSED]
    inK: 0.15,                  // in a room it adds less than the lantern's 0.22: its pool is bigger, and one fire lights a room [PROPOSED]
    lanternKg: 1.2,             // the bible's
    lanternPrice: 10,           // measures: lanterns are only mended, never made, so dearer than a targe (6) [PROPOSED]
  };
  const fuelOf = (bg) => T.fuelBy[bg] || T.fuel;

  // ---------------------------------------------------------------- the rules, pure (Node runs these)
  // how much of a torch is left, in words (plain ASCII) [PROPOSED]
  function words(fuel, capS) {
    const f = fuel / (capS || T.fuel);
    return f >= 0.9 ? 'fresh' : f >= 0.6 ? 'burning well' : f >= 0.4 ? 'half burned' : f >= 0.2 ? 'burning down' : f > 0 ? 'nearly spent' : 'spent';
  }
  // A new traveller: the torch in hand at the kit's fuel, no lantern.
  function fresh(f, bg) {
    const capS = fuelOf(bg);
    f.la_light = 'torch'; f.la_torch = capS; f.la_torch_cap = capS; f.la_have = { torch: true, lantern: false };
    return f;
  }
  // A save written before this phase. Returns which kind it was.
  function migrate(f, bg) {
    if (f.la_light) return 'current';
    const capS = (f.la_kit && +f.la_kit.fuel) || fuelOf(bg);
    // The build merged in #63/#64 put the torch's fuel in the lantern's oil and emptied Marget's flasks without pouring
    // them (pouring sets la_told_oil). That fuel is the torch's; there is no lantern; the flasks come back.
    if (f.la_kit && f.la_flasks === 0 && !f.la_told_oil && f.la_oil != null && +f.la_oil <= capS) {
      f.la_torch = Math.max(0, +f.la_oil || 0); f.la_torch_cap = capS; f.la_oil = null; f.la_flasks = 2;
      f.la_light = 'torch'; f.la_have = { torch: true, lantern: false };
      return 'torch-build';
    }
    // Any older save carried the lantern: it keeps it, in hand, with its oil, and has the kit's torch in the pack.
    f.la_torch = capS; f.la_torch_cap = capS; f.la_light = 'lantern'; f.la_have = { torch: true, lantern: true };
    return 'lantern-save';
  }
  // Take one of the two lights into the left hand. Returns what happened, for the words.
  function take(f, id, lit) {
    const have = f.la_have || {};
    if (!have[id]) return 'none';
    if (f.la_light === id) return 'same';
    f.la_light = id;
    return lit ? 'swapped-lit' : 'swapped';
  }
  // The lantern, found or bought: yours, in hand. The torch keeps its fuel in the pack.
  function gain(f, id) {
    if (!f.la_have) f.la_have = { torch: true, lantern: false };
    if (f.la_have[id]) return 'had';
    f.la_have[id] = true; f.la_light = id;
    return 'gained';
  }

  // ---------------------------------------------------------------- the words (plain ASCII; [PROPOSED], see ROADMAP.md)
  const TX = {
    light: (w) => 'You light the torch. It is ' + w + '.',
    douse: 'You pinch out the torch.',
    dry: 'The torch is spent.',
    low: 'The torch is burning down to the stave.',
    out: 'The torch gutters and goes out.',
    given: 'Marget Sayle: "Take the lantern. A torch shows you to everything on that shelf." The torch goes into your pack.',
    givenLit: 'Marget Sayle: "Put that out and take the lantern. A torch shows you to everything on that shelf."',
    toLantern: 'You take the lantern in your left hand.',
    toTorch: 'You take the torch in your left hand.',
    pinch: (id) => (id === 'torch' ? 'You douse the lantern and take the torch.' : 'You pinch out the torch and take the lantern.'),
    noLantern: 'You have no lantern to fill. Oil is not for the torch.',
    itemName: 'Horn Lantern',
    itemDesc: 'A shuttered lantern with horn panes. Less light than a torch, but it burns half as fast. Lamp oil fills it.',
  };

  // ---------------------------------------------------------------- the pictures, painted in code
  const PITCH = cols('#050404', '#0b0907', '#14100c', '#1e1811', '#2a2117'),
    STAVE = cols('#140d08', '#21160d', '#302014', '#402c1b', '#523a24'),
    FIRE = cols('#6a1c06', '#a3360a', '#d0601a', '#ec9430', '#f8c560', '#fff0c0'),
    SLEEVE = cols('#171a10', '#1e2115', '#292d1d', '#343925', '#40462e'),
    WARM_SKIN = cols('#5a3420', '#8a5530', '#b07848', '#d09a60', '#e8bd80'),
    IRON = cols('#07080a', '#101215', '#1b1e22', '#272b30', '#363b41', '#4b5158'),
    HORN = cols('#140f0a', '#21180f', '#2f2316', '#3d2e1d', '#4c3a25');
  const W_ = 110, H_ = 200;
  const G_ = { fx: 46, fy: 112, s0: { x: 42, y: 150 }, s1: { x: 54, y: 46 }, head0: 30, head1: 66, hx: 55 };
  // frame: -1 unlit, 0..3 the flame's four shapes
  function paintTorch(frame) {
    const s = sheet(W_, H_), g = G_, lit = frame >= 0;
    // the forearm, moss wool like the lantern's, out through the bottom edge
    limb(s, 4, 230, 38, 124, 16, 10, SLEEVE, { fold: 0.3, seed: 71 });
    for (let x = 20; x <= 58; x++) for (let y = 116; y <= 140; y++) if (at(s, x, y) && Math.abs((y - 128) - (x - 39) * 0.36) < 1.5) put(s, x, y, SLEEVE[0]);   // the cuff
    // the stave, from below the fist up to the head
    limb(s, g.s0.x, g.s0.y, g.s1.x, g.s1.y, 4.6, 3.8, STAVE, { base: lit ? 0.58 : 0.5 });
    // the head: rag wound round the stave's top, black with pitch, a little wider at the middle
    for (let y = g.head0; y <= g.head1; y++) {
      const t = (y - g.head0) / (g.head1 - g.head0), hw = 7.5 + 4.5 * Math.sin(Math.PI * Math.min(1, t * 1.1)), cx = g.hx - (y - g.head0) * 0.08;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / hw, wrap = Math.sin((y + u * 3) * 0.9) * 0.18, n = vnoise(x * 0.5, y * 0.5, 730, 0);
        put(s, x, y, ramp(PITCH, 0.5 - u * 0.35 + wrap + (n - 0.5) * 0.3 + (lit && t < 0.35 ? 0.25 : 0), x, y));
        if (lit && t < 0.55 && hash(x, y, 731 + frame) > 0.86) put(s, x, y, FIRE[2 + ((x + y + frame) % 2)], true);   // the pitch alight in the windings
      }
    }
    if (!lit) for (let x = g.hx - 9; x <= g.hx + 9; x++) if (hash(x, 0, 732) > 0.5) put(s, x, g.head0 - 1, PITCH[0]);   // a charred crown
    if (lit) {
      // the flame: a tongue leaning with the frame, its core near white, drawn as light (not darkened by the scene)
      const lean = [0, 1.6, -0.8, 2.4][frame], tall = [30, 26, 28, 25][frame], base = g.head0 + 5;
      for (let y = base - tall; y <= base; y++) {
        const t = (y - (base - tall)) / tall, cx = g.hx + lean * (1 - t) * (1 - t) * 3 + Math.sin(t * 6 + frame * 1.7) * 0.8;
        const hw = 1 + 10.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95)), 0.9) * (0.75 + 0.25 * t);
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          const d = Math.abs(x - cx) / hw; if (d > 1) continue;
          const v = 1 - d * 0.7 - (1 - t) * 0.45 + hash(x, y, 733 + frame) * 0.1;
          put(s, x, y, FIRE[clamp(Math.round(v * 5), 0, 5)], true);
        }
      }
      for (let i = 0; i < 3; i++) { const sx = g.hx + Math.round((hash(i, frame, 734) - 0.5) * 22), sy = base - tall - 3 - Math.round(hash(i, frame, 735) * 10); put(s, sx, sy, FIRE[4], true); }   // sparks
    }
    // the fist round the stave
    const SK = lit ? WARM_SKIN : SKIN;
    oval(s, g.fx, g.fy, 10.5, 10, SK, { base: lit ? 0.48 : 0.46 });
    for (let i = 0; i < 4; i++) { const y = g.fy - 6 + i * 4.4; limb(s, g.fx - 9, y + 1, g.fx + 8, y, 2.6, 2.6, SK, { base: lit ? 0.62 - i * 0.04 : 0.56 - i * 0.03 }); for (let x = g.fx - 10; x <= g.fx + 9; x++) if (at(s, x, Math.round(y + 2.8))) put(s, x, Math.round(y + 2.8), SK[0]); }
    limb(s, g.fx + 7, g.fy - 9, g.fx + 12, g.fy - 1, 3.0, 3.2, SK, { base: 0.6 });   // the thumb
    if (lit) for (let x = g.fx - 11; x <= g.fx + 11; x++) for (let y = g.fy - 11; y <= g.fy - 5; y++) if (at(s, x, y) && SK.includes(at(s, x, y))) put(s, x, y, WARM_SKIN[4 - Math.min(2, (g.fy - 5 - y) >> 2)]);   // the knuckles, toward the flame
    outline(s, INK);
    return done(s);
  }
  // the horn lantern as a thing standing on the ground: for a trader's table or a find, when there is one (not placed yet)
  function paintLanternThing() {
    const s = sheet(40, 64), cx = 20;
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI * t, x = cx + Math.cos(Math.PI - a) * 9, y = 16 - Math.sin(a) * 12; put(s, Math.round(x), Math.round(y), ramp(IRON, 0.5, x, y)); }   // the bail
    for (let y = 14; y <= 24; y++) { const hw = lerp(4, 12, (y - 14) / 10); for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) put(s, x, y, ramp(IRON, 0.62 - (x - cx) / hw * 0.3, x, y)); }   // the cap
    for (let y = 25; y <= 52; y++) for (let x = cx - 11; x <= cx + 11; x++) { const u = (x - cx) / 11, n = vnoise(x * 0.4, y * 0.2, 740, 0); put(s, x, y, ramp(HORN, 0.5 - u * 0.25 + (n - 0.5) * 0.4, x, y)); }   // horn panes, scratched dull
    for (const px of [cx - 11, cx, cx + 11]) for (let y = 25; y <= 52; y++) for (let dx = -1; dx <= 0; dx++) put(s, px + dx, y, ramp(IRON, 0.45 - dx * 0.2, px, y));   // the posts
    for (let y = 53; y <= 58; y++) for (let x = cx - 13; x <= cx + 13; x++) put(s, x, y, ramp(IRON, 0.4 - (x - cx) / 13 * 0.25, x, y));   // the base
    outline(s, INK);
    return done(s, { hs: 0.3, cx: 0.5 });
  }

  // ---------------------------------------------------------------- in the game
  const sw = () => typeof GFX === 'undefined' || GFX.laTorch !== false;
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const on = () => sw() && here();
  const ST = { pics: null, deco: null, err: null, init: 0 };
  const STEPS = [1, 0.72, 0.52, 0.38, 0.28];   // Phase 7's steps of light on the arm
  function mk(p, k) {
    const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
    const d = new Uint32Array(p.data);
    if (k < 1) for (let i = 0; i < d.length; i++) { const v = d[i]; if (!(v >>> 24) || (p.emit && p.emit[i])) continue; const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255; d[i] = (v & 0xff000000) | (Math.round(b * k) << 16) | (Math.round(g * k) << 8) | Math.round(r * k); }
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.buffer), p.w, p.h), 0, 0);
    return c;
  }
  function pictures() {
    if (ST.pics) return ST.pics;
    const dark = paintTorch(-1);
    ST.pics = { dark: STEPS.map((k) => mk(dark, k)), frames: [0, 1, 2, 3].map((f) => { const p = paintTorch(f); return STEPS.map((k) => mk(p, Math.max(k, 0.55))); }) };
    return ST.pics;
  }
  function flags() {
    if (!G.flags) G.flags = {};
    const f = G.flags;
    if (!f.la_light) { fresh(f, f.la_bg); ST.init++; }
    if (!f.la_have) f.la_have = { torch: true, lantern: f.la_light === 'lantern' };
    if (f.la_torch == null) f.la_torch = fuelOf(f.la_bg);
    return f;
  }
  const capNow = () => { const f = G.flags || {}; return +f.la_torch_cap > 0 ? +f.la_torch_cap : fuelOf(f.la_bg); };
  const TORCH = {
    id: 'torch', r: T.r, col: T.col, inK: T.inK, TX,
    get capS() { return capNow(); },
    get: () => flags().la_torch, set: (v) => { flags().la_torch = v; },
    words: (o) => words(o, capNow()), pictures: () => pictures(),
  };
  // the light in the hand, for Phase 7: the torch, or null for Phase 7's own lantern
  function source() {
    if (!on()) return null;
    const f = flags();
    return f.la_light === 'lantern' && f.la_have.lantern ? null : TORCH;
  }
  function say(t, cls, ms) { if (typeof msg === 'function') msg(t, cls || '', ms || 3500); }
  function giveItem(id) {
    try { const p = G.player; if (p && Array.isArray(p.inv) && !p.inv.some((s) => s && s.id === id)) p.inv.push({ id, n: 1 }); } catch (e) { /* the pack keeps what it had */ }
  }
  function gainNow(id) {
    const f = flags(), wasLit = !!(typeof UPG !== 'undefined' && UPG.lantern), r = gain(f, id);
    if (r === 'had') return r;
    if (typeof UPG !== 'undefined') UPG.lantern = false;
    giveItem(id);
    if (id === 'lantern') say(wasLit ? TX.givenLit : TX.given, '', 6000);
    return r;
  }
  function takeNow(id) {
    const f = flags(), wasLit = !!(typeof UPG !== 'undefined' && UPG.lantern), r = take(f, id, wasLit);
    if (r === 'same') { LANTERN7.toggle(); return r; }
    if (r === 'none') return r;
    if (typeof UPG !== 'undefined') UPG.lantern = false;
    say(wasLit ? TX.pinch(id) : (id === 'lantern' ? TX.toLantern : TX.toTorch), 'info', 2600);
    return r;
  }
  const ORIG = {};
  function wire() {
    if (typeof LANTERN7 === 'undefined' || !LANTERN7.setSource || typeof LEDGE1 === 'undefined' || typeof Engine === 'undefined') return false;
    const L1 = LEDGE1;
    LANTERN7.setSource(source);
    // the lantern as a thing in the world and in the pack; a price, so a trader can sell it
    try { if (typeof ITEMS !== 'undefined') ITEMS.lantern = { name: TX.itemName, sprite: 'loot', use: 'light', stack: 1, desc: TX.itemDesc }; } catch (e) { /* the pack has no row for it */ }
    try { if (typeof KIT17 !== 'undefined' && KIT17.ITEM_ROWS && !KIT17.ITEM_ROWS.lantern) KIT17.ITEM_ROWS.lantern = { id: 'lantern', name: TX.itemName, kind: 'light', kg: T.lanternKg, price: T.lanternPrice, stack: 1, use: 'light', desc: TX.itemDesc }; } catch (e) { /* no price */ }
    // Marget Sayle gives you her lantern the first time you speak to her (after her own words, so her talk runs first)
    ORIG.talk = talk;
    talk = function (e) {
      const r = ORIG.talk.apply(this, arguments);
      try {
        if (e && e.id === 'la_marget' && on()) { const f = flags(); if (!f.la_have.lantern && !f.la_lantern_given) { f.la_lantern_given = true; gainNow('lantern'); } }
      } catch (x) { ST.err = ST.err || String(x && x.message); }
      return r;
    };
    // a new traveller: the torch, at the card's fuel (the creation click calls panel10's own choose, so read the click)
    if (typeof document !== 'undefined') document.addEventListener('click', (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest('#la-who [data-bg]') : null;
      if (!el) return;
      setTimeout(() => { try { if (G && G.flags) { fresh(G.flags, G.flags.la_bg || el.dataset.bg); } } catch (e) { /* the torch stands */ } }, 0);
    }, true);
    // an old save: put it right once, at load
    if (typeof restoreGame === 'function') {
      ORIG.restoreGame = restoreGame;
      restoreGame = function () {
        const r = ORIG.restoreGame.apply(this, arguments);
        try { if (G && G.flags && G.map && G.map._la) { ST.migrated = migrate(G.flags, G.flags.la_bg); if (G.flags.la_have.lantern) giveItem('lantern'); } } catch (e) { ST.err = ST.err || String(e && e.message); }
        return r;
      };
    }
    // the found lantern, and the oil, which is not for a torch
    ORIG.useDeco = useDeco;
    useDeco = function (e) {
      try {
        if (e && e.use === 'la_oil' && on() && !flags().la_have.lantern) { say(TX.noLantern, '', 3000); return; }
      } catch (x) { ST.err = ST.err || String(x && x.message); }
      return ORIG.useDeco.apply(this, arguments);
    };
    // from the pack: the light in hand lights and douses; the other one is taken into the hand
    ORIG.useItem = useItem;
    useItem = function (slot) {
      try {
        if (on() && slot && (slot.id === 'torch' || slot.id === 'lantern')) {
          if (typeof closeModal === 'function') closeModal(); G.state = 'play';
          takeNow(slot.id); return;
        }
      } catch (x) { ST.err = ST.err || String(x && x.message); }
      return ORIG.useItem.apply(this, arguments);
    };
    L1.SWITCHES.push(['laTorch', 'Start with a torch', 'Every traveller starts with a pitch torch; the lantern is found or bought. Off: Phase 7, the lantern in hand from the start']);
    return true;
  }
  const wired = typeof window !== 'undefined' ? wire() : false;
  return { T, TX, fuelOf, words, fresh, migrate, take, gain, paintTorch, paintLanternThing, source, state: () => ST, gain: (id) => gainNow(id), take: (id) => takeNow(id), pure: { take, gain }, ORIG, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TORCH38;
