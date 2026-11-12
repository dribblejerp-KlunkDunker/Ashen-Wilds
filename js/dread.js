// ============================================================
//  dread — Phase 10 (the owner's picks): the horror toggle. Off by default; Off = the original game.
//
//  Options > Graphics & access > "Dread" (Off / On, localStorage octave.dread.v1). "Jump scares: none": nothing here
//  ever flashes, shakes, screams or lunges. Everything is slow, quiet and takes one look away to disappear.
//
//  1. DISSONANCE (0..100). Songs are the game's magic, and sound is the predator's sense. Each Song cast raises it by
//     its loudness (SONGS[id].noise x 7; the Falling Fifth and the Root Note, the "settling" Songs, x 0.55), more when
//     the casts are close together (x 1.6 inside 8 s, x 1.25 inside 20 s). It decays slowly (0.45/s; 0.15/s while the
//     Narrow is loud), at 3/s near a hush-lamp, three times faster inside the Hedge, and 14 a game hour of rest.
//     Shown as a thin second band beside the Narrow bar on the HUD (a faint frame always; it trembles one pixel
//     at high Dissonance unless Reduce motion is on). It is a visual: GFX.dreadFx (in GFX.FX) switches it off with
//     the Original preset.
//     At 45+  whispers from BEHIND you (a breathy half-syllable, never a word), positional through the same
//             pan/gain/low-pass maths as js/spatial-audio.js (SPATIAL.mix), caption "[a whisper behind you]"
//     At 60+  a faint second shadow at the very edge of vision. It is anchored to a world bearing: it is only ever
//             drawn in the outer quarter of the screen, so turning toward it removes it (nothing is ever drawn in
//             front of you)
//     At 75+  an occasional false foe: a hound-shape at the far end of a long sight-line, drawn into the frame in a
//             post pass with real depth tests, never an entity (no AI, no collision, never in G.ents, never a
//             witness, never targetable, never saved, no ripple, no caption). It dissolves when it would be in clear
//             view (you come within about 60% of the way) or when you stare at it, and never moves.
//  2. THE STALKER (Dread On only). One presence hunts you across Book One, mostly heard, never seen, never fought. It
//     is of the Hush and obeys the Hush rules (LORE_P6): it is never described, it is kind, it does not attack,
//     nobody screams, it arrives as a quiet. Its whole state is ONE SMALL INTEGER S (0..3) plus a float p behind it;
//     there is no world entity (never in G.ents). Its position for sound is computed relative to you every tick
//     (always somewhere behind your heading, nearer as S rises).
//     Drawn toward: Dissonance, and standing still at night outside the Hedge.
//     Pushed back by: moving on, daylight, a lit lantern, a hush-lamp within 7, noise in moderation, murmur / the
//     reed-whistle, the root-note reed or Root Note Song, a companion speaking (line-talk).
//     S1: the ambient bed dips a little, crows and rats stop: you cannot hear the river / the leaves / the dripping.
//     S2: the beds dip further, every other footstep of yours has no sound, a lamp's hum or your steps' echo is gone.
//     S3: your steps make no sound at all, and your own breathing. If it holds there for four seconds it KEEPS
//         something (below) and withdraws (a rest of 150 s before it can come again).
//     Never: inside the Hedge (Oakhaven and its houses; the Hedge swallows sound), Whisper-Grove's plazas, near a boss,
//     in dialogue / panels / cutscenes / photo mode / after death, while a real foe is chasing you.
//     THE KEEPING: the most recent logbook line goes blank (display only; the text is untouched in G.journal) until
//     the next dawn or until you rest by a hush-lamp, whichever comes first. It is given back with a journal line
//     (everything returned is a gift and a catastrophe).
//  3. Save: nothing in the live G.flags. When Dread is On the snapshot carries p10d_d (Dissonance 0..100), p10d_s (0..3),
//     p10d_kn / p10d_kr (the kept line's place from the oldest end, and its return time in half-hours) and p10d_m
//     (which story lines were told, bits). They are validated integers, read once on load and removed from G.flags.
//     Dread Off writes nothing, reads nothing, makes no audio node, and never touches Math.random (the module has a
//     private generator), so AI traces and rolls are identical to the original game.
//  Procedural stand-in: the whisper is band-passed noise; the shadow and the hound are darkened pixels.
//  Marked [PROPOSED] below: every invented sentence (they are all listed in P10-DREAD/TEXT.md).
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.dreadFx === undefined) GFX.dreadFx = true;                       // the picture half (band, shadow, hound-shape); Original turns it off
  if (GFX.FX && !GFX.FX.includes('dreadFx')) GFX.FX.push('dreadFx');
}

const DREAD = (() => {
  const KEY = 'octave.dread.v1';
  const set = { on: false };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const FLAG_KEYS = ['p10d_d', 'p10d_s', 'p10d_kn', 'p10d_kr', 'p10d_m'];

  // ---- every sentence this module can show (all [PROPOSED]) ------------------------------------
  const TXT = {
    label: 'Dread',
    hint: 'a Dissonance meter, whispers behind you and a stalker in the quiet · Jump scares: none',
    // Dissonance
    d_edge: 'The last Song has not finished leaving. The air keeps a thin edge.',                         // [PROPOSED]
    d_whisper: 'Behind you, the front of a word. Nobody is there.',                                        // [PROPOSED]
    d_settle: 'The edge goes out of the air.',                                                              // [PROPOSED]
    d_rest: 'You wake with your own voice in your head, and no other.',                                     // [PROPOSED]
    // the stalker: what you notice you cannot hear
    c1_river: 'The river has gone quiet. You did not hear it stop.',                                        // [PROPOSED]
    c1_wind: 'The leaves are moving and you cannot hear them.',                                             // [PROPOSED]
    c1_drip: 'The water that was ticking somewhere in the stone has stopped.',                              // [PROPOSED]
    c2_lamp: 'The lamp is still lit. Its hum is gone.',                                                     // [PROPOSED]
    c2_echo: 'Your steps have stopped coming back to you.',                                                 // [PROPOSED]
    c3: 'Your boots come down and make no sound. Neither does your breathing, and it is very gentle about it.', // [PROPOSED]
    relief: 'Sound comes back a little at a time: a bird, your own boots, the water.',                      // [PROPOSED]
    hedge: 'Inside the Hedge, sound dies where it falls. Whatever was behind you does not follow.',         // [PROPOSED]
    keep: 'Nothing touches you. When the sound comes back, the last line in your logbook is empty ruled paper, with its date still at the head.', // [PROPOSED]
    keep_none: 'Something leans close, finds nothing worth keeping, and withdraws.',                         // [PROPOSED]
    back: 'The line is back in your logbook, in your own writing.',                                            // [PROPOSED]
    // story (journal)
    j_dis: 'Songs too close together and the air behind my ears begins to murmur. A Cantor lets each note finish before the next. I will try to do the same.', // [PROPOSED]
    j_quiet: 'Outside the Hedge there is a quiet that keeps a little behind me. It has not touched me. I keep my voice low, I keep walking, and I keep a light.', // [PROPOSED]
    j_back: 'The line I could not read is back, and it is mine, and it is not quite how I wrote it. Everything returned is a gift, and the bill comes with it.', // [PROPOSED]
    // captions (only when Sound captions is on)
    k_whisper: '[a whisper behind you]',
    k_river: '[the river goes quiet]', k_wind: '[the leaves go quiet]', k_drip: '[the dripping stops]',
    k_lamp: '[the lamp\'s hum stops]', k_echo: '[your footsteps lose their echo]', k_steps: '[your footsteps make no sound]',
    k_drain: '[the sound drains away]',
  };

  // ---- the live state (small; nothing here is a world object) ------------------------------------
  const st = {
    D: 0,                  // Dissonance 0..100
    S: 0, p: 0,            // the stalker: S is the whole saved state (0..3); p is the float behind it
    cd: 0, hold: 0,        // rest between visits (s); seconds spent at the top of S3
    keep: { n: 0, ret: 0 },// the kept logbook line: place from the oldest end (1..length), return time in half-hours
    met: 0,                // story lines told (bits 1, 2, 4)
    duck: 0, pos: null,    // ambient dip 0..~0.45; the presence's sound position this tick
    shadow: null, foe: null,
    clock: 0, mapT: 0, lastCast: -99,
  };
  const stats = { casts: 0, whispers: 0, shadows: 0, foes: 0, visits: 0, keeps: 0, nodes: 0, lastWhisper: null, lastInhale: null, captions: [], cues: [], duckTarget: 0, ticks: 0 };
  let flagsRef = null, live = false, ph = 0;
  let wT = 14, sT = 20, fT = 24, hi35 = false, hiSeen = false, cued = [false, false, false, false], lastNote = -99, talkT = 0, stepN = 0;
  let scanT = 0, lamps = [], lampD = 99, boss = false, combat = false, safeStamp = '';
  let lastGain = null, noiseBuf = null;

  // ---- a private random stream: Dread never draws from Math.random, so rolls and AI cannot shift ----
  let rs = (Date.now() ^ 0x5bd1e995) >>> 0;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  function seed(n) { rs = (n >>> 0) || 1; }

  // ---- persistence of the setting ---------------------------------------------------------------
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: set.on ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && (o.on === 0 || o.on === 1)) set.on = o.on === 1; } catch (e) { /* ignore */ } }

  // ---- the world, as Dread reads it ----------------------------------------------------------------
  const EXCLUDED = { whispergrove: 1, mausoleum: 1, belfry: 1 };     // the plazas of Whisper-Grove, and the Coda's rooms
  function isSafe(id) {
    if (typeof LAW_MAPS !== 'undefined' && LAW_MAPS.has(id)) return true;        // Oakhaven and its rooms, inside the Hedge
    return id === 'oakhaven' || id === 'tavern' || /house$/.test(id);
  }
  function zone() {
    const id = (typeof G !== 'undefined' && G.mapId) || '';
    if (EXCLUDED[id] || boss) return 'excluded';
    return isSafe(id) ? 'safe' : 'open';
  }
  const isNight = () => { const h = G.tod * 24; return h < 7 || h >= 20; };
  const speed = () => (G.vel ? Math.hypot(G.vel.x, G.vel.y) : 0);
  const nowDays = () => G.day + G.tod;
  // slow scan of the entity list (twice a second): lamps near, a boss alive, a real foe chasing
  function scan(force) {
    if (!force && st.clock - scanT < 0.5) return;
    scanT = st.clock; lamps = []; boss = false; combat = false; lampD = 99;
    const c = Engine.cam;
    for (const e of G.ents || []) {
      if (!e || e.hidden) continue;
      if (e.sprite === 'lamp' && e.glow !== 0) { lamps.push(e); const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < lampD) lampD = d; }
      if (e.kind === 'enemy' && !e.dead && e.def) {
        const d = e.def;
        if (d.boss || d.wildsBoss || d.codaBoss) boss = true;
        if (e.state === 'chase' && Math.hypot(e.x - c.x, e.y - c.y) < 14) combat = true;
      }
    }
  }
  function lampDistNow() { let m = 99; const c = Engine.cam; for (const e of lamps) { const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < m) m = d; } return m; }

  // ---- messages, captions, the journal -----------------------------------------------------------
  function say(text, cls, ttl) { try { if (typeof msg === 'function') msg(text, cls || 'warn', ttl || 5200); } catch (e) { /* cosmetic */ } }
  function caption(key) {
    // the sound captions box of js/access.js; only when the player has turned captions on
    try {
      const text = TXT[key];
      if (typeof ACCESS === 'undefined' || !ACCESS.settings || !ACCESS.settings.cap || !text) return;
      const now = performance.now();
      if (now - (caption.last[key] || -1e9) < 900) return;
      caption.last[key] = now;
      let b = document.getElementById('ac-captions');
      if (!b) { const g = document.getElementById('game'); if (!g) return; b = document.createElement('div'); b.id = 'ac-captions'; b.setAttribute('role', 'log'); b.setAttribute('aria-live', 'polite'); b.setAttribute('aria-label', 'Sound captions'); g.appendChild(b); }
      const d = document.createElement('div'); d.textContent = text; b.appendChild(d);
      while (b.children.length > 4) b.removeChild(b.firstChild);
      setTimeout(() => { if (d.parentNode) d.remove(); }, 3200);
      stats.captions.push(text); if (stats.captions.length > 40) stats.captions.shift();
    } catch (e) { /* cosmetic */ }
  }
  caption.last = {};
  function story(bit, text) {
    if (st.met & bit) return;
    st.met |= bit;
    try { if (typeof journal === 'function') journal('side', text); } catch (e) { /* cosmetic */ }
  }

  // ---- Dissonance --------------------------------------------------------------------------------
  function addDissonance(n) { st.D = clamp(st.D + n, 0, 100); }
  function onSong(id) {
    const s = typeof SONGS !== 'undefined' ? SONGS[id] : null;
    const loud = clamp(Number(s && s.noise) || 1, 0.5, 6);
    let inc = loud * 7;
    if (id === 'fifth' || id === 'root') inc *= 0.55;                  // the settling Songs sit easier in the air
    const gap = st.clock - st.lastCast;
    inc *= gap < 8 ? 1.6 : gap < 20 ? 1.25 : 1;
    st.lastCast = st.clock; stats.casts++;
    addDissonance(inc);
    return inc;
  }
  function decayRate() {
    let r = G.noise > 6 ? 0.15 : 0.45;
    if (lampDistNow() < 7) r = 3;
    if (zone() === 'safe') r = Math.max(r * 3, 1.5);
    return r;
  }

  // ---- sound: nodes only ever made here, and only when Dread is On and a context exists ----------------
  function audioReady() { return typeof Audio_ !== 'undefined' && !!Audio_.ctx && !!Audio_.sfxBus && !Audio_.muted; }
  function mk(kind) { stats.nodes++; return Audio_.ctx['create' + kind](); }
  function chain(m) {
    const input = mk('Gain'), lp = mk('BiquadFilter'); input.gain.value = m.gain; lp.type = 'lowpass'; lp.frequency.value = m.cutoff; lp.Q.value = 0.5;
    input.connect(lp); let tail = lp, pan = null;
    if (Audio_.ctx.createStereoPanner) { pan = mk('StereoPanner'); pan.pan.value = m.pan; lp.connect(pan); tail = pan; }
    tail.connect(Audio_.sfxBus);
    return { input, lp, pan, tail };
  }
  function release(ch, ms) { setTimeout(() => { try { ch.input.disconnect(); ch.lp.disconnect(); if (ch.pan) ch.pan.disconnect(); } catch (e) { /* gone */ } }, ms); }
  function noise() {
    if (noiseBuf && noiseBuf.sampleRate === Audio_.ctx.sampleRate) return noiseBuf;
    stats.nodes++;
    const b = Audio_.ctx.createBuffer(1, Math.floor(Audio_.ctx.sampleRate * 1.5), Audio_.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    return (noiseBuf = b);
  }
  // where a sound at (x, y) lands for the listener: SPATIAL's own pan / gain / low-pass maths (or a centred fallback)
  function place(x, y) {
    const c = Engine.cam, L = { x: c.x, y: c.y, dir: c.dir };
    let m;
    try {
      if (typeof SPATIAL !== 'undefined' && SPATIAL.mix) m = SPATIAL.mix(L, { x, y }, SPATIAL.wallsBetween ? SPATIAL.wallsBetween(G.map, x, y, L.x, L.y) : 0);
    } catch (e) { m = null; }
    if (!m) m = { pan: 0, gain: 0.6, cutoff: 6000, walls: 0, dist: Math.hypot(x - L.x, y - L.y) };
    let b = Math.atan2(y - L.y, x - L.x) - L.dir; while (b > Math.PI) b -= Math.PI * 2; while (b <= -Math.PI) b += Math.PI * 2;
    return { pan: m.pan, gain: m.gain, cutoff: m.cutoff, walls: m.walls, dist: m.dist, bearing: b, x, y };
  }
  // a breathy half-syllable (never a word): one noise source through two formant filters, cut short
  function whisperVoice(m) {
    const ctx = Audio_.ctx, t0 = ctx.currentTime + 0.02;
    const ch = chain({ pan: m.pan, gain: Math.min(1, m.gain) * 0.9, cutoff: Math.min(m.cutoff, 3400) });
    const src = mk('BufferSource'); src.buffer = noise(); src.loop = true;
    const f1 = mk('BiquadFilter'), f2 = mk('BiquadFilter'), g1 = mk('Gain'), g2 = mk('Gain'), env = mk('Gain');
    f1.type = 'bandpass'; f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    const SYL = [[300, 2300], [700, 1250], [450, 820], [380, 1900], [560, 1500]];
    const n = rnd() < 0.55 ? 1 : 2; let t = t0;
    env.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < n; i++) {
      const [a, b] = SYL[Math.floor(rnd() * SYL.length)], dur = (0.13 + rnd() * 0.12) * (i === n - 1 ? 0.7 : 1);   // the last one is cut short
      f1.frequency.setValueAtTime(a, t); f1.frequency.linearRampToValueAtTime(a * (0.85 + rnd() * 0.3), t + dur);
      f2.frequency.setValueAtTime(b, t); f2.frequency.linearRampToValueAtTime(b * (0.85 + rnd() * 0.3), t + dur);
      env.gain.linearRampToValueAtTime(0.1, t + 0.03); env.gain.linearRampToValueAtTime(0.0001, t + dur);
      t += dur + 0.05;
    }
    g1.gain.value = 1; g2.gain.value = 0.6;
    src.connect(f1); src.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(env); g2.connect(env); env.connect(ch.input);
    src.start(t0); src.stop(t + 0.1);
    release(ch, Math.ceil((t - t0 + 0.6) * 1000));
  }
  // the sound being drawn off: a soft downward sweep of noise, from where the quiet is
  function inhaleVoice(m) {
    const ctx = Audio_.ctx, t0 = ctx.currentTime + 0.02, dur = 1.6;
    const ch = chain({ pan: m.pan, gain: Math.min(1, m.gain) * 0.8, cutoff: Math.min(m.cutoff, 2600) });
    const src = mk('BufferSource'); src.buffer = noise(); src.loop = true;
    const bp = mk('BiquadFilter'), env = mk('Gain'); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(1500, t0); bp.frequency.exponentialRampToValueAtTime(260, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(0.07, t0 + 0.5); env.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(env); env.connect(ch.input); src.start(t0); src.stop(t0 + dur + 0.1);
    release(ch, 2600);
  }
  // the ambient bed dips: Audio_.master is the one gain every bed and the score run through; nothing else sets it but mute
  function applyDuck(dt, target) {
    st.duck += (target - st.duck) * (1 - Math.exp(-dt / 1.2));
    if (st.duck < 0.003 && target === 0) st.duck = 0;
    stats.duckTarget = target;
    if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.master) return;
    if (Audio_.muted) { lastGain = null; return; }
    const g = 0.55 * (1 - st.duck);
    if (st.duck === 0) { if (lastGain !== null) { try { Audio_.master.gain.setTargetAtTime(0.55, Audio_.ctx.currentTime, 0.4); } catch (e) { Audio_.master.gain.value = 0.55; } lastGain = null; } return; }
    if (lastGain !== null && Math.abs(g - lastGain) < 0.004) return;
    try { Audio_.master.gain.setTargetAtTime(g, Audio_.ctx.currentTime, 0.5); } catch (e) { Audio_.master.gain.value = g; }
    lastGain = g;
  }

  // ---- whispers, the shadow, the false foe -----------------------------------------------------
  function whisperSpot() {
    const c = Engine.cam, m = G.map;
    const a = c.dir + Math.PI + (rnd() - 0.5) * 1.1;                  // within about 31 degrees of straight behind
    let r = 2.2 + rnd() * 3;
    for (let i = 0; i < 8; i++, r *= 0.8) {
      const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (x > 0.5 && y > 0.5 && x < m.w - 0.5 && y < m.h - 0.5 && !(m.isSolidCell && m.isSolidCell(x | 0, y | 0))) return { x, y };
    }
    return { x: c.x + Math.cos(a) * 1.2, y: c.y + Math.sin(a) * 1.2 };
  }
  function whisper(force) {
    if (!force && (!set.on || zone() !== 'open')) return null;
    const sp = whisperSpot(), m = place(sp.x, sp.y);
    stats.whispers++; stats.lastWhisper = m;
    if (!(st.met & 8)) { st.met |= 8; say(TXT.d_whisper, 'warn', 4200); }
    caption('k_whisper');
    try { if (audioReady()) whisperVoice(m); } catch (e) { console.warn('dread whisper failed', e); }
    return m;
  }
  const SH = { minF: 0.74, fadeF: 0.84, rise: 0.7, fall: 3, amax: 0.5 };
  function spawnShadow(side) {
    const c = Engine.cam, s = side || (rnd() < 0.5 ? -1 : 1);
    const f0 = 0.86 + rnd() * 0.08, phi = c.dir + s * Math.atan(f0 * 0.66);
    st.shadow = { phi, a: 0, dying: false, t: 0, life: 3.2 + rnd() * 1.8 };
    stats.shadows++; return st.shadow;
  }
  function shadowF(sh, dir) {                                            // where on the screen (-1 left .. +1 right, beyond = off-screen) it stands
    let rel = sh.phi - dir; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) > 1.35) return 9;
    return Math.tan(rel) / 0.66;
  }
  function stepShadow(dt) {
    const sh = st.shadow; if (!sh) return;
    sh.t += dt;
    const f = Math.abs(shadowF(sh, Engine.cam.dir));
    if (f < 0.7) sh.dying = true;                                        // you turned toward it: it is not there
    if (sh.t > sh.life) sh.dying = true;
    const cap = (typeof GFX !== 'undefined' && GFX.noFlash) ? 0.38 : SH.amax;
    if (sh.dying) { sh.a -= SH.fall * dt; if (sh.a <= 0) st.shadow = null; }
    else sh.a = Math.min(cap, sh.a + SH.rise * dt * 0.7);
  }
  // a long sight-line ahead of you: the far end of a corridor, a ride, a hall
  function foeSpot() {
    const c = Engine.cam, m = G.map, fog = Math.max(8, (m.fogDist || 12));   // Phase 14: the view-distance setting is a look, not a rule: where the phantom may stand never depends on it
    let best = null;
    for (let a = -0.42; a <= 0.421; a += 0.14) {
      const ang = c.dir + a, ca = Math.cos(ang), sa = Math.sin(ang);
      let d = 0.6;
      while (d < 26) { const x = c.x + ca * d, y = c.y + sa * d; if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1 || (m.isSolidCell && m.isSolidCell(x | 0, y | 0))) break; d += 0.25; }
      const dd = Math.min(d - 1, fog * 0.88, 17);       // far enough to be a doubt, near enough to be a shape
      if (dd < 8) continue;
      const x = c.x + ca * dd, y = c.y + sa * dd;
      if (m.isBlocked && m.isBlocked(x | 0, y | 0)) continue;
      if (!best || dd > best.d + 0.5 || (Math.abs(dd - best.d) <= 0.5 && rnd() < 0.5)) best = { x, y, d: dd };
    }
    return best;
  }
  function spawnFoe(spot) {
    const s = spot || foeSpot(); if (!s) return null;
    const c = Engine.cam, d = Math.hypot(s.x - c.x, s.y - c.y);
    st.foe = { x: s.x, y: s.y, a: 0, t: 0, dying: false, stare: 0, life: 7 + rnd() * 3, clear: Math.max(5, d * 0.6), mapId: G.mapId };
    stats.foes++; return st.foe;
  }
  function stepFoe(dt) {
    const f = st.foe; if (!f) return;
    f.t += dt;
    const c = Engine.cam, d = Math.hypot(f.x - c.x, f.y - c.y);
    let rel = Math.atan2(f.y - c.y, f.x - c.x) - c.dir; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) < 0.12) f.stare += dt; else f.stare = Math.max(0, f.stare - dt);
    if (d < f.clear || f.stare > 2.2 || f.t > f.life || f.mapId !== G.mapId) f.dying = true;      // in clear view it was never there
    // a scene prop or a tree can stand exactly in front of it: if nothing of it ever reached the screen, let the roll go and try again soon
    if (!f.dying && f.frames > 20 && !f.shown && f.t > 1.2) { f.dying = true; fT = Math.min(fT, 4); }
    const cap = (typeof GFX !== 'undefined' && GFX.noFlash) ? 0.42 : 0.6;
    if (f.dying) { f.a -= 1.1 * dt; if (f.a <= 0) st.foe = null; }
    else f.a = Math.min(cap, f.a + 0.8 * dt);
  }

  // ---- drawing: a post pass into the 3D frame (so nothing is ever a world entity) ---------------------
  const SKIP = () => !set.on || !(typeof GFX === 'undefined' || GFX.dreadFx !== false) || typeof G === 'undefined' || G.state !== 'play';
  function post(F) {
    if ((!st.shadow && !st.foe) || SKIP() || !F || !F.fb) return;
    if (st.shadow) drawShadow(F);
    if (st.foe) drawFoe(F);
  }
  function drawShadow(F) {
    const sh = st.shadow, w = F.w, h = F.h, fb = F.fb;
    const f = shadowF(sh, F.cam.dir), af = Math.abs(f);
    if (af < SH.minF || af > 1.18 || sh.a <= 0.01) return;               // never in the central part of the view
    const edge = clamp((af - SH.minF) / (SH.fadeF - SH.minF), 0, 1), A = sh.a * edge;
    const cx = Math.round(w / 2 * (1 + f)), top = Math.round(F.horizon - 0.34 * h), H = Math.round(0.64 * h);
    const tr = 8, tg = 6, tb = 14;
    for (let j = 0; j < H; j++) {
      const y = top + j; if (y < 0 || y >= h) continue;
      const t = j / H;
      let half;
      if (t < 0.15) half = 0.02 * w * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.075) / 0.075, 2)));          // head
      else if (t < 0.2) half = 0.009 * w;                                                                   // neck
      else if (t < 0.3) half = (0.02 + (t - 0.2) * 0.25) * w;                                               // shoulders
      else half = (0.045 - (t - 0.3) * 0.02) * w;                                                           // body
      if (half < 1) continue;
      const fadeB = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1, row = y * w;
      const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(w - 1, Math.ceil(cx + half));
      for (let x = x0; x <= x1; x++) {
        const k = A * fadeB * Math.min(1, (1 - Math.abs(x - cx) / half) * 2.4);
        if (k <= 0) continue;
        const px = fb[row + x], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
        fb[row + x] = 0xff000000 | (((b + (tb - b) * k) | 0) << 16) | (((g + (tg - g) * k) | 0) << 8) | ((r + (tr - r) * k) | 0);
      }
    }
  }
  function drawFoe(F) {
    const e = st.foe, sp = typeof Engine !== 'undefined' && Engine.sprites ? Engine.sprites.hound : null;
    if (!sp || !F.dbuf || e.a <= 0.01) return;
    const w = F.w, h = F.h, fb = F.fb, dbuf = F.dbuf, cam = F.cam;
    const sx = e.x - cam.x, sy = e.y - cam.y, invDet = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const trX = invDet * (F.dirY * sx - F.dirX * sy), trY = invDet * (-F.planeY * sx + F.planeX * sy);
    if (trY <= 0.5) return;
    const screenX = ((w / 2) * (1 + trX / trY)) | 0;
    const unitH = Math.abs((h / trY) * ((typeof ENEMIES !== 'undefined' && ENEMIES.hound && ENEMIES.hound.scale) || 0.8)), baseH = unitH * (sp.hs || 1), sprH = baseH | 0;
    if (sprH < 2) return;
    e.frames = (e.frames || 0) + 1;
    let floor = 0; try { if (G.map.lvls || G.map.smooth) floor = G.map.groundAt(e.x, e.y); } catch (er) { floor = 0; }
    const baseline = F.horizon + (((cam.z - floor) * h / trY) | 0) + (((sp.dy || 0) * unitH) | 0), dsY = baseline - sprH;
    const sprW = Math.max(1, (baseH * sp.w / sp.h) | 0), dsX = screenX - (((sp.cx == null ? 0.5 : sp.cx) * sprW) | 0);
    const dist = Math.hypot(sx, sy), vis = Math.max(0, 1 - dist / Math.max(6, F.fogDist || 12));
    const A = e.a * (0.5 + 0.5 * vis), dr = 12, dg = 10, db = 18, tw = sp.w, th = sp.h, sdat = sp.data;
    const xs = Math.max(0, dsX), xe = Math.min(w - 1, dsX + sprW - 1), ys = Math.max(0, dsY), ye = Math.min(h - 1, baseline - 1);
    for (let x = xs; x <= xe; x++) {
      const tx = (((x - dsX) * tw) / sprW) | 0; if (tx < 0 || tx >= tw) continue;
      for (let y = ys; y <= ye; y++) {
        const ty = (((y - dsY) * th) / sprH) | 0; if (ty < 0 || ty >= th) continue;
        if ((sdat[ty * tw + tx] >>> 24) <= 100) continue;
        const o = y * w + x; if (dbuf[o] <= trY) continue;                // a wall or a crest in front hides it exactly
        e.shown = true;
        const px = fb[o], r = px & 255, g = (px >> 8) & 255, b = (px >> 16) & 255;
        fb[o] = 0xff000000 | (((b + (db - b) * A) | 0) << 16) | (((g + (dg - g) * A) | 0) << 8) | ((r + (dr - r) * A) | 0);
      }
    }
  }
  // the HUD band: a faint frame beside the Narrow bar, filled by Dissonance, a violet that is not any other gauge's colour
  function drawBand() {
    const ctx = Engine.ctx, y0 = VIEW_H, x = 43, D = st.D;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y0 + 5, 4, 40);
    ctx.fillStyle = '#5a4530'; ctx.fillRect(x, y0 + 4, 4, 1); ctx.fillRect(x, y0 + 45, 4, 1);
    if (D >= 1) {
      const hh = Math.round(40 * clamp(D / 100, 0, 1));
      const sh = (D >= 60 && !(typeof GFX !== 'undefined' && GFX.reduceMotion) && (Math.floor(performance.now() / 120) & 1)) ? 1 : 0;
      ctx.fillStyle = D >= 75 ? '#cdbcff' : D >= 45 ? '#a592e0' : '#7d6cb4';
      ctx.fillRect(x + 1 + sh, y0 + 45 - hh, 2, hh);
    }
    ctx.fillStyle = 'rgba(205,188,255,0.45)';
    for (const m of [45, 60, 75]) ctx.fillRect(x, y0 + 45 - Math.round(40 * m / 100), 1, 1);
  }

  // ---- the stalker -------------------------------------------------------------------------------
  function stalkerPos() {
    if (!st.S) return null;
    const c = Engine.cam, dist = [0, 15, 8, 3.5][st.S];
    const th = c.dir + Math.PI + 0.55 * Math.sin(st.clock * 0.21 + ph);      // always somewhere behind your heading
    return { x: c.x + Math.cos(th) * dist, y: c.y + Math.sin(th) * dist, dist, bearing: Math.PI + 0.55 * Math.sin(st.clock * 0.21 + ph) };
  }
  function cueFor(s) {
    const m = G.map;
    if (s === 1) {
      const water = !!(m.floorTextures && m.floorTextures.includes('t_water'));
      if (water) return ['c1_river', 'k_river'];
      return m.outdoor ? ['c1_wind', 'k_wind'] : ['c1_drip', 'k_drip'];
    }
    if (s === 2) return lamps.length ? ['c2_lamp', 'k_lamp'] : ['c2_echo', 'k_echo'];
    return ['c3', 'k_steps'];
  }
  function setS(n, quiet) {
    const was = st.S; if (n === was) return;
    st.S = n;
    if (n > was) {
      for (let s = was + 1; s <= n; s++) {
        if (cued[s]) continue; cued[s] = true;
        const [k, ck] = cueFor(s);
        if (st.clock - lastNote > 2) { lastNote = st.clock; say(TXT[k], 'warn', 5600); }
        caption(ck);
        stats.cues.push(k); if (stats.cues.length > 30) stats.cues.shift();
        if (s === 1) { stats.visits++; story(1, TXT.j_quiet); }
      }
      st.pos = stalkerPos();
      try {
        if (audioReady() && st.pos) { const m = place(st.pos.x, st.pos.y); stats.lastInhale = m; inhaleVoice(m); caption('k_drain'); }
        else if (st.pos) stats.lastInhale = place(st.pos.x, st.pos.y);
      } catch (e) { console.warn('dread inhale failed', e); }
    } else if (n === 0 && !quiet) {
      say(TXT.relief, 'good', 5200);
    }
    if (n === 0) { cued = [false, false, false, false]; st.pos = null; st.hold = 0; }
  }
  const UP = [0.5, 1.5, 2.5];
  function settle() {
    let s = st.S;
    while (s < 3 && st.p >= UP[s]) s++;
    while (s > 0 && st.p < UP[s - 1] - 0.12) s--;
    setS(s);
  }
  function stalkerStep(dt) {
    if (st.cd > 0) { st.cd -= dt; st.p = 0; if (st.S) setS(0, true); return; }
    const night = isNight(), sp = speed(), breath = G.murmurT > 0 || G.whistleT > 0, still = sp < 0.35 && G.noise < 2.2 && !breath, moving = sp > 0.6;
    let pull = (st.D / 100) * (night ? 1 : 0.6);
    if (night) pull += still ? 0.55 : 0.07;
    let push = 0;
    if (moving) push += 0.3;
    if (!night) push += 0.25;
    if (typeof UPG !== 'undefined' && UPG.lantern) push += 0.35;
    if (lampDistNow() < 7) push += 2.5;
    if (G.noise >= 2.5 && G.noise <= 6.5) push += 0.25;
    if (breath) push += 0.5;                                            // N, murmuring, and the reed-whistle: what the Narrow already teaches
    if ((typeof REEDS !== 'undefined' && REEDS.steady > 0) || G.rootWard > 0) push += 1.2;
    if (talkT > 0) push += 0.9;
    let net = pull - push;
    if (st.mapT < 20 && net > 0) net = 0;                                // a map gets twenty quiet seconds of its own
    if (combat && net > 0) net = 0;
    st.p = clamp(st.p + (net > 0 ? net * 0.04 : net * 0.1) * dt, 0, 3.4);
    settle();
    if (st.S === 3 && st.p >= 3.35) { st.hold += dt; if (st.hold >= 4) applyKeeping(); } else st.hold = 0;
    st.pos = stalkerPos();
  }
  // THE KEEPING. Display only: G.journal is never edited; the kept line is a place counted from the oldest end.
  function applyKeeping() {
    st.p = 0; st.hold = 0; st.cd = 150; stats.keeps++;
    setS(0, true);
    if (st.keep.n === 0 && G.journal && G.journal.length > 0) {
      st.keep.n = G.journal.length;
      const dawnDays = G.tod < 0.25 ? G.day + 0.25 : G.day + 1.25;
      st.keep.ret = Math.round(dawnDays * 48);
      say(TXT.keep, 'warn', 8000);
    } else say(TXT.keep_none, 'warn', 6200);
  }
  function keptIndex() {
    const n = st.keep.n, len = (G.journal && G.journal.length) || 0;
    return n >= 1 && n <= len ? len - n : -1;
  }
  function giveBack(why) {
    if (st.keep.n === 0) return false;
    st.keep.n = 0; st.keep.ret = 0;
    say(TXT.back, 'good', 6200);
    story(4, TXT.j_back);
    stats.lastGiveBack = why || 'dawn';
    return true;
  }

  // ---- the tick ------------------------------------------------------------------------------------
  function goDormant() {
    live = false;
    st.D = 0; st.S = 0; st.p = 0; st.cd = 0; st.hold = 0; st.shadow = null; st.foe = null; st.pos = null; st.duck = 0; cued = [false, false, false, false];
    applyDuck(0.05, 0);
  }
  function resetSession() {
    st.D = 0; st.S = 0; st.p = 0; st.cd = 0; st.hold = 0; st.keep.n = 0; st.keep.ret = 0; st.met = 0; st.shadow = null; st.foe = null; st.pos = null;
    cued = [false, false, false, false]; wT = 10 + rnd() * 6; sT = 12 + rnd() * 8; fT = 14 + rnd() * 10; hi35 = false; hiSeen = false; talkT = 0;
  }
  function tick(dt) {
    stats.ticks++;
    if (!set.on) { if (live) goDormant(); return; }
    if (typeof G === 'undefined' || !G.player || !G.map || typeof Engine === 'undefined') return;
    if (G.flags !== flagsRef) { flagsRef = G.flags; resetSession(); }
    live = true;
    dt = clamp(+dt || 0, 0, 0.25);
    st.clock += dt;
    if (G.state !== 'play' || G.dead) { applyDuck(dt, 0); st.shadow = null; st.foe = null; return; }   // dialogue, panels, cutscenes, photo mode, death: nothing happens and the sound returns
    st.mapT += dt; if (talkT > 0) talkT -= dt;
    scan(false);
    const z = zone();
    // Dissonance decays; the first time it gets loud it says so, once
    st.D = Math.max(0, st.D - decayRate() * dt);
    if (st.D >= 35 && !hi35) { hi35 = true; hiSeen = true; say(TXT.d_edge, 'warn', 4200); }
    if (st.D < 18 && hi35) { hi35 = false; say(TXT.d_settle, 'good', 3200); }
    if (st.D >= 60) story(2, TXT.j_dis);
    // the keeping returns at dawn
    if (st.keep.n > 0 && nowDays() * 48 >= st.keep.ret) giveBack('dawn');
    if (z === 'open') {
      if (st.S < 2 && !combat) {
        // whispers, the second shadow, the false foe: each on its own slow timer, only while the meter is high enough
        if (st.D >= 45) { wT -= dt; if (wT <= 0) { whisper(); wT = (30 - (st.D - 45) / 55 * 22) * (0.7 + 0.6 * rnd()); } } else wT = Math.max(wT, 6 + rnd() * 6);
        if (st.D >= 60 && !st.foe) { sT -= dt; if (sT <= 0) { if (!st.shadow) spawnShadow(); sT = (46 - (st.D - 60) / 40 * 26) * (0.7 + 0.6 * rnd()); } } else sT = Math.max(sT, 8 + rnd() * 8);
        if (st.D >= 75 && !st.shadow && !st.foe) { fT -= dt; if (fT <= 0) { spawnFoe(); fT = (70 - (st.D - 75) / 25 * 35) * (0.7 + 0.6 * rnd()); } } else fT = Math.max(fT, 10 + rnd() * 10);
      }
      stepShadow(dt); stepFoe(dt);
      stalkerStep(dt);
    } else {
      st.shadow = null; st.foe = null;
      if (st.S || st.p) { st.p = 0; setS(0, true); }
    }
    applyDuck(dt, z === 'open' ? [0, 0.12, 0.26, 0.42][st.S] : 0);
  }

  // ---- hooks into the game (every one is a pass-through while Dread is Off) -------------------------
  function onMapChange() {
    st.mapT = 0; st.shadow = null; st.foe = null; scanT = -99;
    if (!set.on || typeof G === 'undefined' || !G.map) return;
    try { scan(true); } catch (e) { /* later */ }
    const z = zone();
    if (z === 'safe') { if (st.S > 0) { say(TXT.hedge, 'good', 6200); } st.p = 0; setS(0, true); st.cd = Math.max(st.cd, 20); }
    else if (z === 'excluded') { st.p = 0; setS(0, true); }
    else st.p *= 0.6;                                                    // moving on loses some of it
  }
  function snapFlags(r) {
    if (!set.on || !r || typeof r !== 'object') return r;
    const f = Object.assign({}, r.flags);
    for (const k of FLAG_KEYS) delete f[k];
    if (st.D >= 1) f.p10d_d = Math.round(clamp(st.D, 0, 100));
    if (st.S > 0) f.p10d_s = st.S;
    if (st.keep.n > 0) { f.p10d_kn = st.keep.n; f.p10d_kr = st.keep.ret; }
    if (st.met) f.p10d_m = st.met;
    r.flags = f; return r;
  }
  const small = (v, a, b) => (typeof v === 'number' && Number.isInteger(v) && v >= a && v <= b) ? v : 0;
  function loadFlags() {
    const f = G.flags;
    flagsRef = f; resetSession(); scanT = -99;
    if (!set.on || !f || typeof f !== 'object') return;
    const own = (k) => Object.prototype.hasOwnProperty.call(f, k) ? f[k] : undefined;
    st.D = small(own('p10d_d'), 0, 100);
    st.S = small(own('p10d_s'), 0, 3); st.p = st.S ? st.S - 0.4 : 0;
    st.met = small(own('p10d_m'), 0, 15);
    const len = (G.journal && G.journal.length) || 0, n = small(own('p10d_kn'), 1, Math.max(1, len)), r = small(own('p10d_kr'), 1, 1e7);
    if (n && n <= len && r) { st.keep.n = n; st.keep.ret = Math.min(r, Math.round((nowDays() + 1.5) * 48)); }   // a doctored return time cannot keep a line forever
    for (const k of FLAG_KEYS) delete f[k];
    if (st.S) cued[1] = cued[2] = cued[3] = true;
  }

  function el(tag, props, text) {
    const e = document.createElement(tag);
    if (props) for (const k in props) { if (k === 'style') e.style.cssText = props[k]; else e.setAttribute(k, props[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('dread-label')) return;
    const lab = el('span', { class: 'gfx-label', id: 'dread-label' }, TXT.label);
    lab.appendChild(document.createTextNode(' ')); lab.appendChild(el('small', { class: 'muted' }, TXT.hint));
    const b = el('button', { class: 'dfbtn small', id: 'dread-on', type: 'button' }, '');
    b.setAttribute('aria-label', TXT.label);
    function sync() { b.textContent = set.on ? 'On' : 'Off'; b.setAttribute('aria-pressed', set.on ? 'true' : 'false'); b.classList.toggle('sel', set.on); }
    b.onclick = () => { setOn(!set.on); sync(); };
    grid.appendChild(lab); grid.appendChild(b);
    sync();
  }
  function setOn(v) {
    v = !!v; if (v === set.on) return set.on;
    set.on = v; save();
    if (!v) goDormant();
    else { flagsRef = null; }
    return set.on;
  }

  function wire() {
    ph = rnd() * 6.28;
    if (typeof update === 'function') {
      const _u = update;
      update = function (dt) {
        const r = _u.apply(this, arguments);
        try { tick(dt); } catch (e) { console.warn('dread tick failed', e); }
        return r;
      };
    }
    if (typeof castSong === 'function') {
      const _c = castSong;
      castSong = function (id) {
        if (!set.on) return _c.apply(this, arguments);
        const p = G.player, pre = { v: p ? p.voice : 0, t: G.song ? G.song.t : 0 };
        const r = _c.apply(this, arguments);
        try { if (id !== 'murmur' && G.player && G.song.t > 0 && pre.t <= 0 && G.player.voice < pre.v) onSong(id); } catch (e) { console.warn('dread song failed', e); }
        return r;
      };
    }
    if (typeof drawHUD === 'function') {
      const _h = drawHUD;
      drawHUD = function () {
        const r = _h.apply(this, arguments);
        try { if (set.on && (typeof GFX === 'undefined' || GFX.dreadFx !== false) && G.player) drawBand(); } catch (e) { console.warn('dread hud failed', e); }
        return r;
      };
    }
    if (typeof renderLog === 'function') {
      const _l = renderLog;
      renderLog = function () {
        // the kept line shows blank for the length of the call; its text is put straight back
        let j = null, text = '';
        try { if (set.on && st.keep.n > 0) { const i = keptIndex(); if (i >= 0) { j = G.journal[i]; text = j.text; j.text = ''; } } } catch (e) { j = null; }
        try { return _l.apply(this, arguments); } finally { if (j) j.text = text; }
      };
    }
    if (typeof snapshotGame === 'function') {
      const _s = snapshotGame;
      snapshotGame = function () { const r = _s.apply(this, arguments); try { return snapFlags(r); } catch (e) { return r; } };
    }
    if (typeof restoreGame === 'function') {
      const _r = restoreGame;
      restoreGame = function () {
        const r = _r.apply(this, arguments);
        try { loadFlags(); } catch (e) { console.warn('dread load failed', e); }
        return r;
      };
    }
    if (typeof loadMap === 'function') {
      const _m = loadMap;
      loadMap = function () { const r = _m.apply(this, arguments); try { onMapChange(); } catch (e) { console.warn('dread map failed', e); } return r; };
    }
    if (typeof passHours === 'function') {
      const _p = passHours;
      passHours = function (hours) { const r = _p.apply(this, arguments); try { if (set.on && hours > 0) st.D = Math.max(0, st.D - hours * 14); } catch (e) { /* cosmetic */ } return r; };
    }
    if (typeof doRest === 'function') {
      const _d = doRest;
      doRest = function (kind) {
        if (!set.on) return _d.apply(this, arguments);
        const hadD = st.D >= 35, lamp = (kind === 'lamp') || lampDistNow() < 7 || (typeof G.mapId === 'string' && isSafe(G.mapId));
        try { scan(true); } catch (e) { /* later */ }
        const r = _d.apply(this, arguments);
        try {
          st.p = 0; st.cd = Math.max(st.cd, 60); setS(0, true);
          if (kind === 'lamp' || lampDistNow() < 7) { st.D = 0; giveBack('lamp'); } else if (lamp && st.keep.n > 0) giveBack('lamp');
          if (hadD && st.D < 20) say(TXT.d_rest, 'good', 5200);
        } catch (e) { console.warn('dread rest failed', e); }
        return r;
      };
    }
    for (const name of ['partySay', 'partyBark']) {
      const f = window[name];
      if (typeof f === 'function') window[name] = function () { try { if (set.on) talkT = 25; } catch (e) { /* cosmetic */ } return f.apply(this, arguments); };
    }
    if (typeof Audio_ !== 'undefined' && Audio_.sfx) {
      const sf = Audio_.sfx;
      const _step = sf.step;
      if (typeof _step === 'function') sf.step = function () {
        if (set.on && st.S >= 2) { stepN++; if (st.S >= 3 || (stepN & 1)) return; }     // you cannot hear your own boots
        return _step.apply(this, arguments);
      };
      for (const nm of ['bird', 'rat']) {
        const f = sf[nm];
        if (typeof f === 'function') sf[nm] = function () { if (set.on && st.S >= 1) return; return f.apply(this, arguments); };   // the crows stop
      }
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _a = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _a.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('dread rows failed', e); }
        return r;
      };
    }
    if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook(post, 110);
  }

  // text for the review file and the French check
  function catalog() {
    const out = [];
    for (const k of Object.keys(TXT)) out.push({ key: k, en: TXT[k] });
    return out;
  }

  load();
  try { wire(); } catch (e) { console.warn('dread wiring failed', e); }
  return {
    set, setOn, save, load, st, stats, TXT, SH, tick, seed, catalog,
    addDissonance, onSong, whisper, spawnShadow, spawnFoe, foeSpot, stepShadow, stepFoe, shadowF, stalkerPos, applyKeeping, giveBack, keptIndex,
    zone, scan, snapFlags, loadFlags, onMapChange, appendRows, drawBand, post, cueFor, resetSession,
    get S() { return st.S; }, get D() { return st.D; },
    get cooldown() { return st.cd; },
    get talk() { return talkT; }, set talk(v) { talkT = +v || 0; },
    audio: 'whispers and the drawn-off breath are band-passed noise through SPATIAL.mix; the ambient dip is Audio_.master',
  };
})();
if (typeof window !== 'undefined') window.DREAD = DREAD;
