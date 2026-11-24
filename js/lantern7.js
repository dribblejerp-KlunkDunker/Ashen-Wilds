// ============================================================
//  lantern7 - Phase 7, "the lantern as the one light". Your lantern, in your left hand, with a supply.
//
//  WHAT THE BIBLE SAYS (searched before anything was invented): "Whoever holds the lantern cannot hold a shield"; the
//  left hand holds a lantern, a torch, a shield or a working; "Four lights, never confused. Yours is tallow yellow and
//  small"; "Light also shows you to everything that sees, while doing nothing about what hears" and "A light means fuel,
//  not safety" (the-smothering.md, bestiary.md). Lamp oil "burns cleaner than pitch and costs more"; the Flask of Lamp
//  Oil "fills a lantern" and must be kept from the flame ("Keep it from the torch"); the price of a night is "oil for
//  one lamp, dusk to dawn". The weather spends a light faster or slower: the torch-burn column of the weather table
//  (Ashfall x1.0, Sleet x1.8). A torch "dims as it runs low and gutters out".
//
//  WHAT IT DOES
//    * THE LANTERN IN THE LEFT HAND. An iron lantern with horn panes, held up by its ring, drawn at the left of the view
//      the way the sword is drawn at the right. Unlit it is a dark thing you carry; lit, the horn glows and the hand
//      above it takes the light.
//    * ITS LIGHT. Tallow yellow and small: a pool about four cells across that lights the ground, the walls and anyone
//      in it. By day out of doors it shows as nothing much.
//    * ITS OIL. U lights it and douses it (the engine's own key). A full lantern burns dusk to dawn in ashfall; sleet
//      spends it 1.8 times as fast. Over its last fifth the flame shrinks, it gutters for its last half minute, and it
//      goes out. Lit, it tells you how full it is in words, never numbers.
//    * THE SUPPLY. Marget Sayle keeps two flasks of lamp oil in the corner of the bothy. Use them and one flask fills
//      the lantern. Not while it burns: douse it first.
//    * WHAT IT COSTS. Lit in the dark out of doors, it shows you: the walking bloom sees you standing still, and from
//      half as far again (BLOOM4.R.litSee). It does nothing about what it hears.
//
//  Switch: Options > "Your lantern" (GFX.laLamp). Off, everything is as before this phase: no picture in the left hand,
//  no oil, and U gives the engine's own lantern. Nothing here uses a random number; the flame's flicker is a sine of the
//  game's anim clock.
// ============================================================
'use strict';

const LANTERN7 = (() => {
  const K = typeof ART2 !== 'undefined' ? ART2.kit : (typeof require !== 'undefined' ? require('./art2.js').kit : null);
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);
  const { sheet, put, at, limb, oval, outline, done, cols, hex, ramp, vnoise, hash, clamp, lerp, SKIN, INK } = K;

  // ---------------------------------------------------------------- the numbers ([PROPOSED] unless the bible gave them; see ROADMAP.md)
  const L = {
    fillS: 1080,                 // one filling burns dusk to dawn in ashfall: the sun is down for half of the 2160 s day
    startS: 540,                 // you come to the ledge with the lantern half full
    flasks: 2,                   // Marget Sayle's flasks of lamp oil
    burn: { ashfall: 1, sleet: 1.8 },   // the bible's torch-burn column, used for the lantern too
    lowAt: 0.2,                  // the flame shrinks over the last fifth of the oil
    lowSay: 0.12,                // and you are told once a filling, here
    gutterS: 30,                 // the last half minute it gutters
    r: [1.7, 4.2],               // the pool's radius in cells, nearly dry to full
    col: [255, 168, 40],          // tallow yellow, out of doors: yellower than the hearth's red (150, 66, 18)
    inK: 0.22,                   // in a room, where the fire is already lit, it adds less
    bodyK: 0.16,                 // and on your own sword arm, which it would otherwise burn white (see bodyPass)
    hand: { fwd: 0.3, left: 0.22 },     // where the flame is, from your eye: a little ahead and to the left
    nightSee: 0.5,               // how dark it must be (0 day, 1 night) before the bloom sees you by it
  };

  // ---------------------------------------------------------------- the rules, pure (Node runs these)
  const burnRate = (k) => L.burn.ashfall + (L.burn.sleet - L.burn.ashfall) * clamp(k || 0, 0, 1);   // k: how far into a spell of sleet, out of doors
  // The lantern's own filling, unless a caller names another. (Audit fix: Phase 17 had this read the kit's torch fuel,
  // which shrank the approved lantern (P59, O10) to a four-minute light. Torch or lantern per kit is for the owner.)
  const cap = (full) => +full > 0 ? +full : L.fillS;
  // how big the flame is, 0..1: full above the last fifth, then down to a third, and out at nothing
  function flame(oil, full) { if (oil <= 0) return 0; const f = oil / (cap(full) * L.lowAt); return f >= 1 ? 1 : 0.32 + 0.68 * f; }
  const radius = (oil, full) => lerp(L.r[0], L.r[1], flame(oil, full));
  // the flicker: a steady flame breathes a little; the last half minute it gutters (a sine of the anim clock, not dice)
  function flicker(oil, t) {
    const breathe = 0.94 + 0.04 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1 + 1.7);
    if (oil > L.gutterS) return breathe;
    const g = 1 - oil / L.gutterS, dip = Math.max(0, Math.sin(t * 5.1) * Math.sin(t * 2.3 + 0.4));
    return breathe * (1 - 0.75 * g * dip * dip);
  }
  function words(oil, full) {
    const f = oil / cap(full);
    return f >= 0.9 ? 'full' : f >= 0.6 ? 'more than half full' : f >= 0.4 ? 'about half full' : f >= L.lowAt ? 'less than half full' : f > 0 ? 'nearly dry' : 'dry';
  }
  // one step of the oil: { oil } burns dt seconds at `rate`. Returns what happened: 'low' once a filling, 'out' at the end.
  function burnStep(st, dt, rate, full) {
    if (!st.lit || st.oil <= 0) return null;
    const was = st.oil; st.oil = Math.max(0, st.oil - dt * rate);
    if (st.oil <= 0) { st.lit = false; return 'out'; }
    const capS = cap(full);
    if (was > capS * L.lowSay && st.oil <= capS * L.lowSay) return 'low';
    return null;
  }
  // a flask into the lantern: refused while it burns, when it is already nearly full, and when there is none
  function pour(st) {
    if (st.lit) return 'lit';
    if (st.oil >= L.fillS * 0.9) return 'full';
    if (st.flasks <= 0) return 'none';
    st.flasks--; st.oil = L.fillS; return 'filled';
  }

  // ---------------------------------------------------------------- the words (plain ASCII; [PROPOSED], see ROADMAP.md)
  const TX = {
    light: (w) => 'You light the lantern. It is ' + w + '.',
    douse: 'You douse the lantern.',
    dry: 'The lantern is dry.',
    low: 'The lantern is burning low.',
    out: 'The lantern gutters and goes out.',
    oil: (n) => (n === 2 ? 'Two flasks of lamp oil, stoppered with wax, in the corner.' : n === 1 ? 'One flask of lamp oil, stoppered with wax, in the corner.' : 'An empty corner where the lamp oil stood.'),
    filled: (n) => 'You fill the lantern from a flask. ' + (n === 1 ? 'One flask is left.' : n === 0 ? 'That was the last of the oil.' : n + ' flasks are left.'),
    notLit: 'Douse the lantern first. Oil is not poured near a flame.',
    full: 'The lantern is full.',
    none: 'There is no oil left.',
    marget: 'Marget Sayle: "That oil came up the road on somebody\'s back. Burn it where it counts."',
  };

  // ---------------------------------------------------------------- the pictures, painted in code
  const IRON = cols('#07080a', '#101215', '#1b1e22', '#272b30', '#363b41', '#4b5158'),
    HORN = cols('#140f0a', '#21180f', '#2f2316', '#3d2e1d', '#4c3a25'),
    LIT = cols('#5a2e0c', '#8a4c14', '#b8741f', '#dca23a', '#f2cd6a', '#fff0b8'),
    SLEEVE = cols('#171a10', '#1e2115', '#292d1d', '#343925', '#40462e'),
    WARM_SKIN = cols('#5a3420', '#8a5530', '#b07848', '#d09a60', '#e8bd80'),
    CLAY = cols('#140c08', '#21160f', '#2e2016', '#3d2b1e', '#4d3727', '#5e4532'), WAX = cols('#5c4e2c', '#857244', '#a8935a'),
    WOOD = cols('#1a120a', '#2a1d11', '#3b2a19', '#4e3822', '#62472b');
  const W_ = 110, H_ = 200;
  // where the lantern hangs in its picture
  const G_ = { fx: 47, fy: 34, cx: 50, cap0: 64, body0: 82, body1: 140, base1: 152, hw: 21 };
  function paintLantern(lit) {
    const s = sheet(W_, H_), g = G_;
    // the forearm, moss wool like the sword arm's, running out through the bottom edge (and off the left of the view)
    limb(s, 6, 222, 40, 54, 16, 9.5, SLEEVE, { fold: 0.3, seed: 70 });
    for (let x = 22; x <= 60; x++) for (let y = 48; y <= 72; y++) if (at(s, x, y) && Math.abs((y - 60) - (x - 41) * 0.36) < 1.5) put(s, x, y, SLEEVE[0]);   // the cuff
    // the bail: an iron wire from the cap's two sides up into the fist
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, a = Math.PI * t, x = g.cx + Math.cos(Math.PI - a) * (g.hw - 4), y = g.cap0 + 6 - Math.sin(a) * (g.cap0 + 6 - g.fy - 4);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) put(s, Math.round(x) + dx, Math.round(y) + dy, ramp(IRON, 0.55 - Math.cos(a) * 0.2, x, y));
    }
    // the cap: a squat iron cone with a chimney and its vent holes
    for (let y = g.cap0 - 8; y <= g.body0; y++) {
      const t = (y - (g.cap0 - 8)) / (g.body0 - g.cap0 + 8), hw = y < g.cap0 ? 4 : lerp(7, g.hw + 3, (y - g.cap0) / (g.body0 - g.cap0));
      for (let x = Math.round(g.cx - hw); x <= Math.round(g.cx + hw); x++) {
        const u = (x - g.cx) / hw; let v = 0.6 - u * 0.3 - t * 0.1;
        if (lit && y > g.body0 - 5) v += 0.25;                                     // the flame lights the cap's rim from below
        put(s, x, y, ramp(IRON, v, x, y));
      }
    }
    for (let k = -1; k <= 1; k++) put(s, g.cx + k * 4, g.cap0 - 3, lit ? LIT[3] : INK);
    // the body: three iron posts seen corner-on, horn panes between them
    const post = (x) => { for (let y = g.body0; y <= g.body1; y++) for (let dx = -1; dx <= 1; dx++) put(s, x + dx, y, ramp(IRON, 0.5 - dx * 0.25 + (lit ? 0.12 : 0), x + dx, y)); };
    for (let y = g.body0; y <= g.body1; y++) for (let x = g.cx - g.hw; x <= g.cx + g.hw; x++) {
      const u = (x - g.cx) / g.hw, side = x < g.cx - 1 ? -1 : 1, n = vnoise(x * 0.4, y * 0.18, 700, 0);
      if (!lit) { put(s, x, y, ramp(HORN, 0.45 - side * 0.15 + (n - 0.5) * 0.35 - Math.abs(u) * 0.1, x, y)); continue; }
      // horn glows from the flame inside: brightest level with the flame and toward the middle, mottled as horn is
      const fy = g.body0 + (g.body1 - g.body0) * 0.58, dy = (y - fy) / (g.body1 - g.body0), d = Math.hypot(u * 0.8, dy * 1.6);
      put(s, x, y, ramp(LIT, 0.78 - d * 0.75 + (n - 0.5) * 0.3 - (side > 0 ? 0.1 : 0), x, y), true);
    }
    if (lit) {                                                                    // the flame itself, a brighter tongue behind the horn
      const fx = g.cx - 2, fy = g.body0 + (g.body1 - g.body0) * 0.6;
      for (let y = Math.round(fy - 14); y <= Math.round(fy + 5); y++) for (let x = fx - 5; x <= fx + 5; x++) {
        const t = (y - (fy - 14)) / 19, hw = 1 + 4 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (t < 0.85 ? 1 : 0.6);
        if (Math.abs(x - fx) <= hw) put(s, x, y, LIT[Math.abs(x - fx) < hw * 0.45 && t > 0.3 ? 5 : 4], true);
      }
    }
    post(g.cx - g.hw); post(g.cx - 1); post(g.cx + g.hw);
    for (const y of [g.body0, g.body0 + 1, g.body1 - 1, g.body1]) for (let x = g.cx - g.hw; x <= g.cx + g.hw; x++) put(s, x, y, ramp(IRON, 0.52 + (lit && y > g.body1 - 2 ? 0.1 : 0), x, y));
    // the base: an iron tray with the oil font in it
    for (let y = g.body1 + 1; y <= g.base1; y++) { const hw = g.hw + 2 - Math.max(0, y - g.base1 + 4); for (let x = Math.round(g.cx - hw); x <= Math.round(g.cx + hw); x++) put(s, x, y, ramp(IRON, 0.42 - (x - g.cx) / hw * 0.25 - (y - g.body1) * 0.02, x, y)); }
    // the fist round the ring, over the bail; lit from below when the lantern burns
    const SK = lit ? WARM_SKIN : SKIN;
    oval(s, g.fx, g.fy, 10.5, 10, SK, { base: lit ? 0.4 : 0.46 });
    for (let i = 0; i < 4; i++) { const y = g.fy - 6 + i * 4.4; limb(s, g.fx - 9, y + 1, g.fx + 8, y, 2.6, 2.6, SK, { base: (lit ? 0.4 + i * 0.09 : 0.56 - i * 0.03) }); for (let x = g.fx - 10; x <= g.fx + 9; x++) if (at(s, x, Math.round(y + 2.8))) put(s, x, Math.round(y + 2.8), SK[0]); }
    limb(s, g.fx + 7, g.fy - 9, g.fx + 12, g.fy - 1, 3.0, 3.2, SK, { base: 0.6 });                   // the thumb
    if (lit) for (let x = g.fx - 11; x <= g.fx + 11; x++) for (let y = g.fy + 5; y <= g.fy + 12; y++) if (at(s, x, y) && SK.includes(at(s, x, y))) put(s, x, y, WARM_SKIN[4 - Math.min(2, (y - g.fy - 5) >> 2)]);   // the underside, toward the flame
    outline(s, INK);
    return done(s);
  }
  // Marget Sayle's oil: n wax-stoppered clay flasks on a low plank in the corner
  function paintOil(n) {
    const s = sheet(70, 64);
    for (let y = 52; y <= 59; y++) for (let x = 4; x <= 65; x++) put(s, x, y, ramp(WOOD, 0.62 - (y - 52) * 0.06 + vnoise(x * 0.2, y, 710, 0) * 0.2 - 0.1, x, y));
    for (const x of [8, 61]) for (let y = 60; y <= 63; y++) for (let dx = -2; dx <= 2; dx++) put(s, x + dx, y, WOOD[1]);
    const spots = [[24, 0.5], [46, 0.5], [35, 0.2]];
    for (let i = 0; i < n && i < spots.length; i++) {
      const [cx] = spots[i], by = 51;
      oval(s, cx, by - 13, 10, 13, CLAY, { base: 0.55 });                           // the belly
      limb(s, cx, by - 25, cx, by - 33, 4, 3.4, CLAY, { base: 0.6 });                // the neck
      oval(s, cx, by - 35, 4.5, 3, WAX, { base: 0.6 });                              // the wax stopper
      for (let x = cx - 9; x <= cx + 9; x++) if (hash(x, i, 711) > 0.55) put(s, x, by - 16 + ((x * 3) % 2), CLAY[1]);   // a cord round the belly
    }
    if (!n) for (let x = 14; x <= 56; x++) if (hash(x, 0, 712) > 0.7) put(s, x, 51, ramp(WAX, 0.3, x, 51));   // drips of old wax where they stood
    outline(s, INK);
    return done(s, { hs: 0.36, cx: 0.5 });
  }

  // ---------------------------------------------------------------- in the game
  const sw = () => typeof GFX === 'undefined' || GFX.laLamp !== false;
  const here = () => typeof G !== 'undefined' && G && G.map && G.map._la;
  const on = () => sw() && here();
  const ST = { lit: false, said: [], err: null, drawn: 0, deco: null, prev: false, pics: null };
  const dayness = (tod) => clamp((Math.cos(((tod == null ? 0.5 : tod) - 0.5) * Math.PI * 2) + 0.3) / 1.3, 0, 1);   // the engine's own curve (js/lighting.js)
  function flags() { if (!G.flags) G.flags = {}; if (G.flags.la_oil == null) G.flags.la_oil = L.startS; if (G.flags.la_flasks == null) G.flags.la_flasks = L.flasks; return G.flags; }
  // ---- the light in the hand. By default this phase's lantern. A later phase may hand it something else (Phase 38's
  // torch) by LANTERN7.setSource(fn): fn() returns { id, capS, r, col, get(), set(v), TX, words(oil), pictures() } or null
  // for the lantern. Unset, everything below is Phase 7 exactly.
  const SRC = { fn: null };
  const LANTERN = { id: 'lantern', capS: L.fillS, r: L.r, col: L.col, get: () => flags().la_oil, set: (v) => { flags().la_oil = v; }, TX, words: (o) => words(o), pictures: () => pictures() };
  function src() { try { const s = SRC.fn && SRC.fn(); if (s) return s; } catch (e) { /* the lantern */ } return LANTERN; }
  const oilNow = () => src().get();
  const lit = () => !!(typeof UPG !== 'undefined' && UPG.lantern) && oilNow() > 0;
  function say(t, cls, ms) { ST.said.push(t); if (ST.said.length > 12) ST.said.shift(); if (typeof msg === 'function') msg(t, cls || '', ms || 3500); }
  function sleetK() {
    try { const m = G.map; if (typeof WEATHER6 === 'undefined' || GFX.laWx === false || !m || m.outdoor === false || m.ceil) return 0; return WEATHER6.sleetAt(Math.max(0, (G.day || 0)), G.tod); } catch (e) { return 0; }
  }
  // how dark it is where you stand, 0 (day out of doors) to 1 (night, or a room)
  const darkNow = () => (G.map && G.map.outdoor !== false && !G.map.ceil ? 1 - dayness(G.tod) : 1);
  // ---- the light
  const light = { x: 0, y: 0, r: 4, cr: 0, cg: 0, cb: 0 };
  function lampLight() {
    if (!lit()) return null;
    if (!ST.bodyPass) ST.bodyPass = bodyPass();
    const c = Engine.cam, oil = oilNow(), out = G.map && G.map.outdoor !== false && !G.map.ceil;
    const k = out ? 0.12 + 0.88 * darkNow() : 1; if (k < 0.15) return null;   // by day out of doors it shows as nothing much
    const S = src(), t = typeof ANIM !== 'undefined' ? ANIM.T : 0, f = flame(oil, S.capS) * flicker(oil, t) * k * (out ? 1 : (S.inK != null ? S.inK : L.inK)), lx = Math.cos(c.dir - Math.PI / 2), ly = Math.sin(c.dir - Math.PI / 2);
    light.x = c.x + Math.cos(c.dir) * L.hand.fwd + lx * L.hand.left; light.y = c.y + Math.sin(c.dir) * L.hand.fwd + ly * L.hand.left;
    light.r = lerp(S.r[0], S.r[1], flame(oil, S.capS)); light.cr = S.col[0] * f; light.cg = S.col[1] * f; light.cb = S.col[2] * f; delete light.vis;
    return light;
  }
  // ---- the picture in the left hand, drawn after the HUD as the sword is
  const STEPS = [1, 0.72, 0.52, 0.38, 0.28];
  function pictures() {
    if (ST.pics) return ST.pics;
    const mk = (p, k) => { const c = document.createElement('canvas'); c.width = p.w; c.height = p.h; const d = new Uint32Array(p.data); if (k < 1) for (let i = 0; i < d.length; i++) { const v = d[i]; if (!(v >>> 24)) continue; const e = p.emit && p.emit[i]; if (e) continue; const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255; d[i] = (v & 0xff000000) | (Math.round(b * k) << 16) | (Math.round(g * k) << 8) | Math.round(r * k); } c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d.buffer), p.w, p.h), 0, 0); return c; };
    const dark = paintLantern(false), glow = paintLantern(true);
    ST.pics = { dark: STEPS.map((k) => mk(dark, k)), glow: STEPS.map((k) => mk(glow, Math.max(k, 0.55))) };
    return ST.pics;
  }
  function drawHand() {
    const ctx = Engine.ctx; if (!ctx || G.state !== 'play' || !G.player || G.dead) return;
    const S = src(), P = S.pictures(), oil = oilNow(), burning = lit(), dk = darkNow(), t = typeof ANIM !== 'undefined' ? ANIM.T : 0;
    // the light on the arm: the scene's (a room has its fire; out of doors, the hour), as one of a few steps
    const amb = G.map.outdoor !== false && !G.map.ceil ? 1 - 0.74 * dk : 0.52, step = STEPS.reduce((b, k, i) => (Math.abs(k - amb) < Math.abs(STEPS[b] - amb) ? i : b), 0);
    const sc = 0.5, iw = W_ * sc, ih = H_ * sc;
    const sway = Math.sin(t / 0.9 + 1.1) * 1.4, bob = Math.round(((Engine.cam.bob || 0) + sway) * 1.5 * 2) / 2;
    const x = -6, y = Math.round(VIEW_H + 20 + bob - ih);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.drawImage(P.dark[step], x, y, iw, ih);
    if (burning) {
      const a = clamp(flame(oil, S.capS) * flicker(oil, t) * (1 - 0.5 * (1 - dk)), 0, 1), glow = P.frames ? P.frames[Math.floor(t * 9) % P.frames.length] : P.glow;   // a torch's flame moves: frames by the anim clock
      // a painted flame keeps its body by day, and fades with its fuel (the review on #66)
      ctx.globalAlpha = P.frames ? Math.max(a, 0.85 * flame(oil, S.capS) * flicker(oil, t)) : a; ctx.drawImage(glow[step], x, y, iw, ih);
    }
    ctx.restore(); ST.drawn++;
  }
  // ---- the key: U lights it and douses it (the engine's own binding), with this game's words
  function toggle() {
    const S = src();
    if (UPG.lantern) { UPG.lantern = false; ST.prev = false; say(S.TX.douse, 'info', 1800); return; }
    if (oilNow() <= 0) { ST.prev = false; say(S.TX.dry, 'warn', 2500); return; }
    UPG.lantern = true; ST.prev = true; say(S.TX.light(S.words(oilNow())), 'info', 2600);
  }
  function tick(dt) {
    if (typeof G === 'undefined' || !G || G.state !== 'play') return;
    if (ST.deco && G.flags) syncOil();
    if (!on()) return;
    flags(); const S = src(), now = !!UPG.lantern, fuel = S.get();
    if (now !== ST.prev) { ST.prev = now; if (now) { if (fuel <= 0) { UPG.lantern = false; ST.prev = false; say(S.TX.dry, 'warn', 2500); } else say(S.TX.light(S.words(fuel)), 'info', 2600); } }   // lit some other way (touch, a menu)
    const st = { lit: !!UPG.lantern, oil: S.get() }, ev = burnStep(st, dt, burnRate(sleetK()), S.capS);
    S.set(st.oil);
    if (ev === 'out') { UPG.lantern = false; ST.prev = false; say(S.TX.out, 'warn', 4000); }
    else if (ev === 'low') say(S.TX.low, 'warn', 3500);
  }
  function syncOil() { const n = clamp(flags().la_flasks, 0, 2); ST.deco.sprite = 'la_oil' + n; ST.deco.label = TX.oil(n); ST.deco.hidden = !sw(); }   // off, the corner is bare as before
  function useOil() {
    const f = flags(), st = { lit: !!UPG.lantern && src().id === 'lantern' && f.la_oil > 0, oil: f.la_oil, flasks: f.la_flasks }, r = pour(st);
    f.la_oil = st.oil; f.la_flasks = st.flasks;
    if (r === 'lit') say(TX.notLit, 'warn', 3500);
    else if (r === 'full') say(TX.full, '', 2500);
    else if (r === 'none') say(TX.none, '', 2500);
    else { say(TX.filled(st.flasks), '', 4000); if (!f.la_told_oil) { f.la_told_oil = true; ST.sayAt = G.time + 2.2; } }
    syncOil();
  }
  // The 3D renderer shades the first-person body (js/body21.js, pass 'body') at a point 0.3 cells in front of your eye,
  // which is where the lantern is: lit at full strength it would burn the sword arm white. For that pass only, the
  // lantern's colour in the lights buffer (R3DLights, binding 1, colours after the 32 positions) is turned down.
  function bodyPass() {
    const P = typeof R3D !== 'undefined' && R3D.getPass && R3D.getPass('body'); if (!P || P._la7) return !!P;
    const draw = P.draw; P._la7 = true;
    const put = (gl, i, k) => { const b = gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 1); if (!b) return; gl.bindBuffer(gl.UNIFORM_BUFFER, b); gl.bufferSubData(gl.UNIFORM_BUFFER, (32 * 4 + i * 4) * 4, new Float32Array([light.cr / 255 * k, light.cg / 255 * k, light.cb / 255 * k])); };
    P.draw = function (gl, F) {
      const Ls = F && F.env && F.env.ptLights, i = Ls ? Ls.indexOf(light) : -1;
      if (i < 0 || i >= 32 || !on()) return draw.apply(this, arguments);
      try { put(gl, i, L.bodyK); } catch (e) { return draw.apply(this, arguments); }
      try { return draw.apply(this, arguments); } finally { try { put(gl, i, 1); } catch (e) { /* the next frame uploads it again */ } }
    };
    return true;
  }
  const ORIG = {};
  function wire() {
    if (typeof Engine === 'undefined' || typeof LIGHTING === 'undefined' || typeof drawHUD !== 'function' || !L1) return false;
    for (let n = 0; n <= 2; n++) { const p = paintOil(n); Engine.addSprite('la_oil' + n, { w: p.w, h: p.h, data: p.data, hs: p.hs, cx: p.cx, dy: p.dy }); }
    // the light: this game's lantern on this game's maps, the engine's anywhere else (and with the switch off)
    ORIG.lanternLight = LIGHTING.lanternLight;
    LIGHTING.lanternLight = function () { try { if (on()) return lampLight(); } catch (e) { ST.err = ST.err || String(e && e.message); return null; } return ORIG.lanternLight.apply(this, arguments); };
    ORIG.drawHUD = drawHUD;
    drawHUD = function () { const r = ORIG.drawHUD.apply(this, arguments); try { if (on()) drawHand(); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    window.addEventListener('keydown', (ev) => {
      try {
        if (!on() || ev.repeat || G.state !== 'play' || G.openPanel || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
        const key = (UPG.keybinds && UPG.keybinds.lantern || 'u').toLowerCase(); if (ev.key.toLowerCase() !== key) return;
        ev.stopImmediatePropagation(); toggle();
      } catch (e) { /* a key press must never throw */ }
    }, true);
    // the oil, in the bothy's corner
    const _bm = buildAllMaps; buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try { const m = maps && maps[L1.BOTHY]; if (m) { ST.deco = m.deco('la_oil2', 1.35, 1.35, { solid: false, scale: 1, use: 'la_oil', label: TX.oil(2) }); ST.deco.hidden = !sw(); } } catch (e) { /* the bothy stands without it */ }
      return maps;
    };
    const _ud = useDeco; useDeco = function (e) { if (e && e.use === 'la_oil' && sw()) { useOil(); return; } return _ud.apply(this, arguments); };
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); if (ST.sayAt && G.time >= ST.sayAt) { ST.sayAt = 0; if (G.mapId === L1.BOTHY) say(TX.marget, '', 6000); } } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    // what it costs: the walking bloom sees a lantern burning in the dark
    if (typeof BLOOM4 !== 'undefined' && BLOOM4.setLight) BLOOM4.setLight((mapId) => (on() && lit() && G.mapId === mapId && G.map.outdoor !== false && !G.map.ceil && darkNow() >= L.nightSee ? 1 : 0));
    ST.bodyPass = bodyPass();
    L1.SWITCHES.push(['laLamp', 'Your lantern', 'The lantern in your left hand: tallow light, oil that runs out (U lights it). Off: the engine\'s own lantern, no oil and no picture']);
    return true;
  }
  const wired = typeof window !== 'undefined' ? wire() : false;
  // what the light in the hand is now: for the HUD, the pack and dread (Phase 38 can make it a torch)
  const now = () => (typeof G !== 'undefined' && G ? src() : LANTERN);
  const frac = () => { const S = now(); return clamp(S.get() / S.capS, 0, 1); };
  const reach = () => { const S = now(); return lerp(S.r[0], S.r[1], flame(S.get(), S.capS)); };
  const flameNow = () => { const S = now(); return flame(S.get(), S.capS); };
  const setSource = (fn) => { SRC.fn = typeof fn === 'function' ? fn : null; };
  return { L, TX, cap, burnRate, flame, radius, flicker, words, burnStep, pour, paintLantern, paintOil, state: () => ST, oil: () => (typeof G !== 'undefined' && G ? oilNow() : null), lit, toggle, lampLight, ORIG, wired, setSource, source: now, frac, reach, flameNow, useOil: () => useOil() };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LANTERN7;
