// ============================================================
//  door5 - Phase 5, "the door that holds". The slice's one safe room made real: Marget Sayle's door has a bar,
//  and the safe room is only safe when the bar is across.
//
//  WHAT THE BIBLE SAYS (searched before anything was invented): the design's work list asks for "a door that holds,
//  and what the hunter does at it". Of the walking bloom, that it hunts by sound and barely sees (the-smothering.md).
//  Its rules of dread: "The worst thing is never on screen" and "One knock, once. No scare is ever repeated." The
//  bothy's own lines (Phase 1): she sleeps facing the door; "Shut the door. The fire is not for the hill."
//
//  WHAT IT DOES
//    * THE BAR. A bar of heavy timber leans by the door inside. Use it and it drops across the door; use it again and
//      it stands back by the door. From outside, a barred door does not open: "The door is barred from inside."
//    * THE BLOOM AT THE DOOR. If it was coming for you when you went in, it follows to the door. Barred, the door holds:
//      it leans on it once and waits a while outside, then goes back to its post. Not barred, it comes in after you,
//      and the room is as dangerous as the shelf. It goes back out the way it came when it has nothing to hunt.
//    * ONE KNOCK, ONCE. The first time it leans on a barred door with you inside, you hear it and are told so, and
//      Marget Sayle says one thing. After that it leans in silence. Nothing on screen: you never see it at the door.
//    * Marget tells you, the first time you come in, to put the bar across.
//
//  Nothing here draws a new effect; the bar is a painted thing like the table and the bed, and the bloom inside is
//  drawn by Phase 4's pass and switch ("Modelled bodies"). Nothing uses a random number.
// ============================================================
'use strict';

const DOOR5 = (() => {
  const K = typeof ART2 !== 'undefined' ? ART2.kit : (typeof require !== 'undefined' ? require('./art2.js').kit : null);
  const L1 = typeof LEDGE1 !== 'undefined' ? LEDGE1 : (typeof require !== 'undefined' ? require('./ledge1.js') : null);
  const { sheet, put, ramp, vnoise, outline, done, cols, hash, INK } = K;

  // ---------------------------------------------------------------- where things are (the bothy is cells 82..85 x 27..29 on the ledge; its door at 83, 29)
  const PLACE = {
    outside: { x: 83.5, y: 30.6 },              // where the bloom stands to try the door, and where a player comes out
    outsideIn: { x: 3.5, y: 4.15, yaw: -Math.PI / 2 },   // where it comes in: just inside the door, facing the room
    inside: { x: 3.5, y: 4.4 },                 // where it stands to go out
    outsideOut: { x: 83.5, y: 30.9, yaw: Math.PI / 2 },  // where it comes out, facing down the shelf
    waitOut: { x: 85.3, y: 31.5 },              // where it waits off the door (Phase 4's waiting place)
    waitIn: { x: 3.5, y: 3.6 },                 // shut in with you, it cannot lift a bar: it stands back from the door
    barLean: { x: 4.62, y: 4.5 },               // the bar, leaning by the door
    barSet: { x: 3.5, y: 4.9 },                 // the bar, across the door's inner face
  };
  const MARGET_LINE_DELAY = 2.5;                // seconds between the knock and what she says of it

  // ---------------------------------------------------------------- the words (plain ASCII; [PROPOSED], see ROADMAP.md)
  const TX = {
    barLean: 'A bar of heavy timber, iron at both ends, leaning by the door. It goes across the door on two hooks.',
    barSet: 'The bar is across the door.',
    drop: 'You drop the bar across the door. It sits in its hooks with a sound like a dropped plank.',
    lift: 'You lift the bar out of its hooks and stand it by the door.',
    barredOut: 'The door is barred from inside.',
    barredIn: 'The bar is across the door. Lift it first.',
    knock: 'Something leans on the door from outside, once. The bar takes it.',
    margetBar: 'Marget Sayle, without looking up: "Put the bar across. They come to a door."',
    margetAfter: 'Marget Sayle: "It will go. They do not stay where it is quiet."',
  };

  // ---------------------------------------------------------------- the bar, painted (64 x 64 tiles aside, things are paintings like the table)
  const WOOD = cols('#24180d', '#36261a', '#4a3421', '#604429', '#7a5833', '#94703f'), IRON = cols('#0e0f10', '#1d2023', '#2e3236', '#43484d', '#5d6369');
  function beamPx(s, x, y, t, k) { put(s, x, y, ramp(WOOD, t + vnoise(x * 0.09 + k, y * 0.7, 541, 0) * 0.35 - 0.12, x, y)); }
  function paintBarSet() {
    // across the door at waist height: 120 x 80, drawn 0.8 of a wall wide; the beam 0.42 above the floor
    const s = sheet(120, 80);
    for (let y = 9; y <= 25; y++) for (let x = 3; x <= 116; x++) beamPx(s, x, y, y <= 10 ? 0.95 : 0.7 - (y - 10) * 0.035, 0);
    for (let x = 3; x <= 116; x++) if (hash(x, 0, 542) > 0.86) put(s, x, 17 + (x % 3) - 1, WOOD[0]);   // the grain, and old dents
    for (const cx of [11, 108]) {                                            // two iron hooks on the frame, the bar in them
      for (let y = 3; y <= 32; y++) for (let x = cx - 5; x <= cx + 5; x++) { const edge = y < 8 || y > 26; if (edge || (x <= cx - 4 || x >= cx + 4)) put(s, x, y, ramp(IRON, 0.7 - (y - 3) * 0.012, x, y)); }
      put(s, cx, 5, IRON[4]); put(s, cx, 30, IRON[4]);
    }
    outline(s, INK);
    return done(s, { hs: 0.533, cx: 0.5 });
  }
  function paintBarLean() {
    // leaning against the wall by the door: 40 x 150, drawn 0.95 of a wall high
    const s = sheet(40, 150), x0 = 9, x1 = 28, y0 = 148, y1 = 4;
    for (let y = y1; y <= y0; y++) {
      const t = (y - y1) / (y0 - y1), c = x1 + (x0 - x1) * t;
      for (let x = Math.round(c - 6); x <= Math.round(c + 6); x++) {
        const u = (x - c) / 6, cap = y < y1 + 9 || y > y0 - 9;
        put(s, x, y, cap ? ramp(IRON, 0.65 - u * 0.25, x, y) : ramp(WOOD, 0.68 - u * 0.3 + vnoise(x * 0.5, y * 0.08, 543, 0) * 0.3 - 0.15, x, y));
      }
    }
    outline(s, INK);
    return done(s, { hs: 0.95, cx: 0.5 });
  }

  // ---------------------------------------------------------------- the knock: a heavy shoulder against oak, and the bar creaking in its hooks
  function knockSound() {
    try {
      const A = typeof Audio_ !== 'undefined' ? Audio_ : null, ctx = A && A.ctx; if (!ctx || A.muted) return false;
      const out = A.sfxBus || A.master, t = ctx.currentTime, n = Math.floor(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (hash(i, 7, 551) * 2 - 1) * Math.pow(1 - i / n, 3);   // fixed noise, not dice
      const src = ctx.createBufferSource(); src.buffer = buf; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.connect(lp).connect(g).connect(out); src.start(t);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35); const og = ctx.createGain(); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(og).connect(out); o.start(t); o.stop(t + 0.45);
      const c = ctx.createOscillator(); c.type = 'sawtooth'; c.frequency.setValueAtTime(150, t + 0.18); c.frequency.exponentialRampToValueAtTime(118, t + 0.6); const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 600; cf.Q.value = 4; const cg = ctx.createGain(); cg.gain.setValueAtTime(0.0001, t); cg.gain.setValueAtTime(0.0001, t + 0.18); cg.gain.exponentialRampToValueAtTime(0.05, t + 0.24); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.62); c.connect(cf).connect(cg).connect(out); c.start(t + 0.18); c.stop(t + 0.65);
      return true;
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- in the game
  const ST = { bar: null, sayAt: 0, knocks: 0, leans: 0, sounded: 0 };
  const barred = () => typeof G !== 'undefined' && !!(G.flags && G.flags.la_barred);
  function setBar(on) {
    if (!G.flags) G.flags = {};
    G.flags.la_barred = !!on;
    msg(on ? TX.drop : TX.lift, '', 3500);
    if (on && typeof addNoise === 'function') addNoise(1.2);       // a bar dropping into iron is not silent
    if (typeof Audio_ !== 'undefined' && Audio_.sfx && Audio_.sfx.door) try { Audio_.sfx.door(); } catch (e) { /* no sound is fine */ }
    syncBar();
  }
  function syncBar() {
    const b = ST.bar; if (!b) return;
    const on = barred(), p = on ? PLACE.barSet : PLACE.barLean;
    b.sprite = on ? 'la_bar_set' : 'la_bar_lean'; b.x = p.x; b.y = p.y; b.label = on ? TX.barSet : TX.barLean;
  }
  // the bloom finds the door shut
  function onBarred() {
    ST.leans++;
    const inside = typeof G !== 'undefined' && G.mapId === L1.BOTHY;
    if (inside && !G.flags.la_knocked) {                                     // one knock, once
      G.flags.la_knocked = true; ST.knocks++;
      if (knockSound()) ST.sounded++;
      msg(TX.knock, 'bad', 5000);
      ST.sayAt = G.time + MARGET_LINE_DELAY;
    }
  }
  function tick() {
    if (typeof G === 'undefined' || !G || G.state !== 'play') return;
    syncBar();
    if (G.mapId === L1.BOTHY && !G.flags.la_told_bar) { G.flags.la_told_bar = true; msg(TX.margetBar, '', 6500); }
    if (ST.sayAt && G.time >= ST.sayAt) { ST.sayAt = 0; if (G.mapId === L1.BOTHY) msg(TX.margetAfter, '', 6000); }
  }
  function wire() {
    if (typeof Engine === 'undefined' || typeof BLOOM4 === 'undefined' || !L1) return false;
    const set = paintBarSet(), lean = paintBarLean();
    Engine.addSprite('la_bar_set', { w: set.w, h: set.h, data: set.data, hs: set.hs, cx: set.cx, dy: set.dy });
    Engine.addSprite('la_bar_lean', { w: lean.w, h: lean.h, data: lean.data, hs: lean.hs, cx: lean.cx, dy: lean.dy });
    // the two ways through Marget Sayle's door, for the bloom
    BLOOM4.DOORS.push(
      { from: L1.LEDGE, at: PLACE.outside, to: L1.BOTHY, out: PLACE.outsideIn, barred, onBarred, waitAt: PLACE.waitOut },
      { from: L1.BOTHY, at: PLACE.inside, to: L1.LEDGE, out: PLACE.outsideOut, barred, waitAt: PLACE.waitIn },
    );
    // the bar in the bothy, and the bloom's place in it (hidden until it comes in)
    const _bm = buildAllMaps; buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try { const m = maps && maps[L1.BOTHY]; if (m) { ST.bar = m.deco('la_bar_lean', PLACE.barLean.x, PLACE.barLean.y, { solid: false, scale: 1, use: 'la_bar', label: TX.barLean }); BLOOM4.addMap(m); syncBar(); } } catch (e) { /* the bothy stands without it */ }
      return maps;
    };
    const _ud = useDeco; useDeco = function (e) { if (e && e.use === 'la_bar') { setBar(!barred()); return; } return _ud.apply(this, arguments); };
    // a barred door does not open, from either side
    const _tr = transfer; transfer = function (portal) {
      if (portal && barred() && ((portal.map === L1.BOTHY && G.mapId === L1.LEDGE) || (portal.map === L1.LEDGE && G.mapId === L1.BOTHY))) { msg(G.mapId === L1.BOTHY ? TX.barredIn : TX.barredOut, 'warn', 3500); return; }
      return _tr.apply(this, arguments);
    };
    const _up = update; update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { ST.err = ST.err || String(e && e.message); } return r; };
    return true;
  }
  const wired = wire();
  return { PLACE, TX, paintBarSet, paintBarLean, barred, setBar, state: () => ST, knockSound, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DOOR5;
