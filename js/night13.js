// ============================================================
//  night13 — Phase 13 (the Hush comes closer): night terrors, and the Unrung Bell.
//
//  1. NIGHT TERRORS. Resting somewhere unsafe, at night, has a small chance of a broken sleep: a short screen with one
//     line of dream (a sound you remember going missing), then you wake either to danger (1-2 ordinary local enemies, already
//     aware, at a fair distance, with a short grace) or to a false alarm (nothing there; the fire has gone out). The time
//     actually slept is shortened and so is what the rest gives back.
//  2. THE UNRUNG BELL. On some nights, in Oakhaven and the outdoor maps outside the Hedge, before the Greening, a bell that
//     has no clapper "rings": a deep thrum where a bell should be (never a strike), the sfx bus dipping out for a beat, the
//     caption "[a bell that does not ring]". Within about a minute the hounds come a little more often until dawn. Next day
//     the townsfolk mention it. It stops for good at the Greening: after that the Deacon himself is in the Deep Woods and the
//     bell is a thing you can hold, not a thing you can hear.
//
//  TABLES (every number lives here; the report quotes them)
//   Terror chance = clamp( (BASE[place] * KIND[kind] + dreadAdd) * product(mods) , 0, 0.30 ), rolled once per rest.
//     BASE   wild (outdoors, danger>0) .12 | open (outdoors, danger 0) .05 | deep (indoors/dungeon, danger>0) .16 | shut (indoors, danger 0) .04
//     KIND   dark (let the dark take the watch) 1.0 | self (hold the line myself) 0.6 | lamp (trust the lamp) 0 = never
//     dreadAdd  +0.10 * Dissonance/100, only while the Dread switch is on
//     mods   a lit fire (campfire/hearth/brazier within 6 tiles) x0.5 | a companion keeping watch x0.6 | the cat of
//            Whisper-Grove with you x0.85 (and she wakes you early) | an omen night (the Bell rings) x1.5
//   SAFE (never a terror): Oakhaven and every room of it, the Boar, any house, the Kestrel, a camp (a use:'campfire' deco
//     within 5 tiles), Whisper-Grove's plazas and the Coda's rooms, the arena, the watch-house, a map with a live boss, the
//     Greening timer, the bore hold, custody.
//   OUTCOME (given a hit): 65% danger, 35% false alarm. Danger: 1 enemy, or 2 (35%). Enemy types come ONLY from the map's own
//     placed, non-boss, non-passive enemies, plus the hound where the map allows hounds (danger>0). None found: a false alarm.
//     Distance at waking: full scares 3.5-5 tiles; gentle (default) 6-8; the cat adds 1.5. Grace: 1.4 s before they act.
//   SLEPT FRACTION of the hours (and of the healing): danger 0.40 | false alarm 0.60. (dark 8 h -> ~3.2 h; self 4 h -> ~1.6 h)
//   SCARES: NERVES13.scaresAllowed() (team NERVES). Absent or anything but true/'full'/'on'/'all' = gentle: slow fade,
//     enemies further away, no sound. Full: quick cut, nearer, one hound call.
//
//   BELL NIGHTS (deterministic from G.day and flags): never after the Greening. The nights of G.day 7..10 (the nights before
//     the Rite, and the Rite's own) always; any other night when omen(day) holds: hash(day) % 100 < 25 (one night in four).
//     The ring comes once, at a fixed hour per night, 21:30 + (hash % 50)/10 h (so between 21:30 and 02:24).
//   SPAWN: from 45 s of play after the ring until dawn, hound spawns (spawnHound) are scaled x1.25 (BELL_SPAWN_MULT), in the
//     style of the calendar's moon scaling: the extra hound comes 2.5 s after the first with chance (mult - 1).
//   DUCK: the sfx bus (Audio_.sfxBus) falls to 0.12 (gentle 0.35) in 0.15 s, holds 1.3 s, comes back in 0.8 s to where it was.
//
//  Saved state: NONE. Everything is derived from G.day, G.tod and G.flags, or lives for the session (the rung night, the
//  spawn window). Spawned enemies are transient. Switches: Options -> Graphics & access, localStorage octave.night13.v1.
//  Wrapped, never edited: doRest, update, spawnHound, talk, renderAccessibilityMenu. Lore: every invented line is [PROPOSED].
// ============================================================
'use strict';

const NIGHT13 = (function () {
  const KEY = 'octave.night13.v1';
  const hasG = () => typeof G !== 'undefined' && G;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ================================================================ the tables
  const BASE = { wild: 0.12, open: 0.05, deep: 0.16, shut: 0.04 };
  const KIND = { dark: 1.0, self: 0.6, lamp: 0 };
  const DREAD_ADD = 0.10, FIRE_MULT = 0.5, COMPANION_MULT = 0.6, CAT_MULT = 0.85, OMEN_MULT = 1.5, CHANCE_MAX = 0.30;
  const P_DANGER = 0.65, P_TWO = 0.35;
  const SLEPT = { danger: 0.40, false: 0.60 };
  const DIST = { full: [3.5, 5], gentle: [6, 8], cat: 1.5 }, GRACE = 1.4;
  const BELL_DAYS = [7, 10], OMEN_PCT = 25, BELL_HOUR0 = 21.5, BELL_SPAN = 5, BELL_SPAWN_MULT = 1.25, BELL_DELAY = 45;
  const DUCK = { full: 0.12, gentle: 0.35, down: 0.15, hold: 1.3, up: 0.8 };
  const SAFE_NIGHT = { whispergrove: 1, mausoleum: 1, belfry: 1, arena: 1, watchhouse: 1 };

  // ---- every sentence this module can show (all [PROPOSED]) ----------------------------------------
  const TX = {
    wakeTitle: 'The sleep breaks',
    wakeBtn: 'Wake',
    dreams: [
      'You dream the Hedge-gate reed. You are waiting for it to sound. It is a long wait, and you are patient, and then you are not asleep.',
      'In the dream the river is talking to itself. Then it is not. You wake with your mouth open on the next word.',
      'A hearth cracks somewhere in the dark. You listen for the next crack, and it does not come, and you wake listening.',
      'Someone is humming in the next room. The hum stops in the middle of a note, as politely as a guest.',
      'You are counting names. You reach the one after yours, and there is nothing there to count.',
      'Rain on the roof. Then rain on no roof. Then you.',
      'Somebody sets a cup down. You never hear it land.',
      'Boots in the grass, coming nearer. Then grass.',
    ],
    danger: 'You are awake before you know why. Something near you is already awake, and has been for a while.',
    fireOut: 'Nothing. The fire has gone out, and the dark has only the ordinary silence of dark.',
    noFire: 'Nothing. Whatever woke you has gone quiet, which is not quite the same as gone.',
    cat: '{0} hisses, low and flat, a breath before you hear it.',
    watch: '{0} is already on their feet. "Easy. Something moved."',
    shortSleep: 'You did not sleep the night through.',
    bellMsg: 'A bell is struck somewhere past the Hedge. The air leans toward the sound, and there is none.',
    bellOut: 'A bell is struck, close. The dark takes the sound before it can be one.',
    bellCap: '[a bell that does not ring]',
    folk: [
      'Did you hear it last night? The bell. The one that does not.',
      'Something rang in the night and nothing came of it. I have stopped trying to say it better.',
      'I counted the gap after the stroke. It was exactly the length of a bell.',
      'My dog went under the bed. He does not do that for weather.',
      'If a bell rings and you cannot hear it, was it a bell? I would sooner not know.',
      'The hounds were bold after. They always are, after.',
    ],
    label: 'Night terrors', hint: 'Sleeping rough at night can be broken. Off: rest works as it did.',
    labelBell: 'The Unrung Bell', hintBell: 'Some nights, a bell that does not ring, and the hounds bolder after. Off: none of it.',
  };

  // ================================================================ settings
  const set = { terrors: true, bell: true };
  function load() {
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') { if (typeof o.terrors === 'boolean') set.terrors = o.terrors; if (typeof o.bell === 'boolean') set.bell = o.bell; } } catch (e) { /* no storage */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ terrors: set.terrors, bell: set.bell })); } catch (e) { /* ignore */ } }

  // ---- a private random stream: never Math.random, so combat rolls and AI cannot shift ----------------
  let rs = (Date.now() ^ 0x2f6e2b1) >>> 0;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  function seed(n) { rs = (n >>> 0) || 1; }

  const stats = { plans: 0, terrors: 0, falseAlarms: 0, rings: 0, extras: 0, captions: [], duck: null, lastPlan: null, lastRing: null };
  const ring = { night: null, since: 0, nightKey: null };   // session only: the night that rang and the play-seconds since

  // ================================================================ the world as the night reads it
  const greened = () => !!(hasG() && G.flags && (G.flags.greening || G.flags.part3 || G.flags.part4));
  const nightHour = () => { const h = G.tod * 24; return h < 7 || h >= 20; };
  // the night belongs to the day it began on: after midnight G.day has already moved on
  const nightDay = () => (G.tod * 24 < 7 ? G.day - 1 : G.day);
  function isSafePlace(id) {
    if (!id) return true;
    if (SAFE_NIGHT[id]) return true;
    if (typeof LAW_MAPS !== 'undefined' && LAW_MAPS.has(id)) return true;
    return id === 'oakhaven' || id === 'tavern' || /house$/.test(id) || /kestrel|ship|deck/.test(id);
  }
  function near(spr, r) {
    if (!hasG() || !G.ents || typeof Engine === 'undefined') return false;
    const c = Engine.cam;
    return G.ents.some((e) => e && e.kind === 'deco' && !e.hidden && spr(e) && ((e.x - c.x) ** 2 + (e.y - c.y) ** 2) < r * r);
  }
  const campNear = () => near((e) => e.use === 'campfire', 5);
  const fireNear = () => near((e) => e.sprite === 'campfire' || e.sprite === 'hearth' || e.sprite === 'brazier', 6);
  function bossHere() {
    if (!hasG() || !G.ents || typeof ENEMIES === 'undefined') return false;
    return G.ents.some((e) => { if (!e || e.kind !== 'enemy' || e.dead) return false; const d = ENEMIES[e.type] || {}; return !!(d.boss || d.wildsBoss || d.deaconAura); });
  }
  function companionName() {
    const P = hasG() && G.party;
    if (!P || !P.id || (P.hp != null && P.hp <= 0) || (P.downed && P.downed[P.id])) return null;
    try { return String(COMPANIONS[P.id].name).split(' ')[0]; } catch (e) { return 'Your companion'; }
  }
  function catHere() {
    try { return typeof TAVERN === 'object' && TAVERN.adopted() && TAVERN.set.cat !== false && G.map && G.map.outdoor; } catch (e) { return false; }
  }
  function catName() { try { return TAVERN.catName(); } catch (e) { return 'The cat'; } }
  const dreadOn = () => { try { return typeof DREAD === 'object' && DREAD.set.on; } catch (e) { return false; } };
  function placeClass(m) { return m.outdoor ? (m.danger > 0 ? 'wild' : 'open') : (m.danger > 0 ? 'deep' : 'shut'); }
  // NERVES13 is built in parallel; until it exists (or says otherwise) every scare is the gentle version
  function scaresFull() {
    try { if (typeof window !== 'undefined' && window.NERVES13 && typeof window.NERVES13.scaresAllowed === 'function') { const v = window.NERVES13.scaresAllowed(); return v === true || v === 'full' || v === 'on' || v === 'all'; } } catch (e) { /* gentle */ }
    return false;
  }

  // ---- why a rest cannot be broken (empty string = it can) ---------------------------------------------
  function blocked() {
    if (!hasG() || !G.map || !G.player) return 'no game';
    if (!nightHour()) return 'daytime';
    if (G.escapeTimer > 0) return 'greening timer';
    if (G.boreHold > 0) return 'bore hold';
    if (G.flags && G.flags.greening && !G.flags.escaped) return 'greening';
    try { if (typeof crimeState === 'function' && crimeState().custody) return 'custody'; } catch (e) { /* none */ }
    if (isSafePlace(G.mapId)) return 'safe place';
    if (campNear()) return 'camp';
    if (bossHere()) return 'boss';
    return '';
  }
  // the enemy types this map already owns (its own placed, ordinary, hostile ones) plus the hound where hounds roam
  function localTypes() {
    const out = [];
    if (!hasG() || !G.map || typeof ENEMIES === 'undefined') return out;
    for (const e of G.map.entities || []) {
      if (!e || e.kind !== 'enemy' || e.transient || e.passive || !ENEMIES[e.type]) continue;
      const d = ENEMIES[e.type];
      if (d.boss || d.wildsBoss || d.deaconAura || d.quiet || out.includes(e.type)) continue;   // never a boss, never a Quiet (the Hush does not attack)
      out.push(e.type);
    }
    if (G.map.danger > 0 && ENEMIES.hound && !out.includes('hound')) out.push('hound');
    return out.sort();
  }
  function chanceFor(kind) {
    const why = blocked();
    const res = { kind, blocked: why, chance: 0, place: null, base: 0, dread: 0, mods: {} };
    if (why || !(kind in KIND)) return res;
    res.place = placeClass(G.map); res.base = BASE[res.place];
    let c = res.base * KIND[kind];
    if (dreadOn()) { res.dread = DREAD_ADD * clamp((+DREAD.D || 0) / 100, 0, 1); c += res.dread; }
    if (KIND[kind] > 0) {
      if (fireNear()) { c *= FIRE_MULT; res.mods.fire = FIRE_MULT; }
      if (companionName()) { c *= COMPANION_MULT; res.mods.companion = COMPANION_MULT; }
      if (catHere()) { c *= CAT_MULT; res.mods.cat = CAT_MULT; }
      if (omen(nightDay())) { c *= OMEN_MULT; res.mods.omen = OMEN_MULT; }
    } else c = 0;
    res.chance = clamp(c, 0, CHANCE_MAX);
    return res;
  }

  // ================================================================ 1. the plan, the screen, the wake
  function planTerror(kind) {
    stats.plans++;
    const ch = chanceFor(kind), plan = Object.assign({ hit: false, outcome: null, count: 0, types: [], dream: 0, frac: 1, roll: null, full: scaresFull() }, ch);
    if (!ch.chance) { stats.lastPlan = plan; return plan; }
    plan.roll = rnd();
    if (plan.roll >= ch.chance) { stats.lastPlan = plan; return plan; }
    plan.hit = true;
    plan.dream = Math.floor(rnd() * TX.dreams.length) % TX.dreams.length;
    plan.types = localTypes();
    const danger = rnd() < P_DANGER && plan.types.length > 0;
    plan.outcome = danger ? 'danger' : 'false';
    if (danger) plan.count = rnd() < P_TWO ? 2 : 1;
    plan.frac = SLEPT[plan.outcome];
    plan.fire = fireNear(); plan.watch = companionName(); plan.cat = catHere();
    stats.lastPlan = plan;
    return plan;
  }
  function solid(x, y) { try { return solidAt(x, y); } catch (e) { return false; } }
  function placeEnemies(plan) {
    const c = Engine.cam, placed = [];
    const rng = plan.full ? DIST.full : DIST.gentle, extra = plan.cat ? DIST.cat : 0;
    for (let n = 0; n < plan.count; n++) {
      const type = plan.types[Math.floor(rnd() * plan.types.length) % plan.types.length];
      for (let i = 0; i < 24; i++) {
        const a = rnd() * 6.2832, d = rng[0] + rnd() * (rng[1] - rng[0]) + extra;
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        if (x < 1 || y < 1 || x >= G.map.w - 1 || y >= G.map.h - 1 || solid(x, y)) continue;
        const e = hydrate({ kind: 'enemy', type, x, y, transient: true });
        e.state = 'chase'; e.cool = GRACE; e._n13 = 1;         // already aware, and a beat before it can act
        G.ents.push(e); placed.push(e); break;
      }
    }
    return placed;
  }
  function say(text, cls, ttl) { try { msg(text, cls || 'warn', ttl || 6500); } catch (e) { /* cosmetic */ } }
  const fmt = (s, a) => s.replace('{0}', a);

  let pending = null;
  function showWake(plan) {
    pending = plan;
    G.state = 'panel';
    openModal(`<div class="p13t-wake"><h2>${TX.wakeTitle}</h2><p class="q p13t-dream">${TX.dreams[plan.dream]}</p><div class="list"><button class="dfbtn" id="p13t-wake" type="button">${TX.wakeBtn}</button></div></div>`, 'p13t-wake');
    const b = document.getElementById('p13t-wake');
    if (b) { b.onclick = finishWake; try { b.focus(); } catch (e) { /* none */ } }
  }
  // the wake: danger or a false alarm. Safe to call with no screen open (tests do).
  function finishWake() {
    const plan = pending; pending = null;
    if (!plan) return null;
    try { closeModal(); } catch (e) { /* not open */ }
    if (G.state === 'panel') G.state = 'play';
    let placed = [];
    if (plan.outcome === 'danger') {
      placed = placeEnemies(plan);
      if (!placed.length) plan.outcome = 'false';
    }
    if (plan.outcome === 'danger') {
      stats.terrors++;
      say(TX.danger, 'bad', 7000);
      if (plan.cat) say(fmt(TX.cat, catName()), 'warn', 6000);
      if (plan.watch) say(fmt(TX.watch, plan.watch), 'voice', 6500);
      if (plan.full) { try { Audio_.sfx.hound(); } catch (e) { /* silent */ } }
    } else {
      stats.falseAlarms++;
      say(plan.fire ? TX.fireOut : TX.noFire, 'warn', 7000);
    }
    say(TX.shortSleep, '', 4200);
    plan.placed = placed;
    return plan;
  }
  // doRest, shortened: the original runs with the hours scaled; what it gave back is scaled by the same fraction
  function runShortened(orig, self, args, plan) {
    const p = G.player, b = { hp: p.hp, voice: p.voice, fat: p.fat, sleep: p.sleep };
    const _ph = passHours, _sh = spawnHound;
    passHours = function (h) { return _ph.call(this, h * plan.frac); };
    spawnHound = function () { /* the broken sleep is the night's visit; no second one on top */ };
    let r;
    try { r = orig.apply(self, args); } finally { passHours = _ph; spawnHound = _sh; }
    const mix = (from, to, max) => clamp(from + (to - from) * plan.frac, 0, max == null ? 1e9 : max);
    p.hp = mix(b.hp, p.hp, p.hpMax); p.voice = mix(b.voice, p.voice, p.voiceMax); p.fat = mix(b.fat, p.fat, p.fatMax);
    if (typeof p.sleep === 'number' && typeof b.sleep === 'number') p.sleep = mix(b.sleep, p.sleep, 100);
    return r;
  }
  function wireRest() {
    if (typeof doRest !== 'function') return;
    const _d = doRest;
    doRest = function (kind) {
      if (!set.terrors) return _d.apply(this, arguments);
      let plan = null;
      try { plan = planTerror(kind); } catch (e) { console.warn('night13: plan failed', e); }
      if (!plan || !plan.hit) return _d.apply(this, arguments);
      let r;
      try { r = runShortened(_d, this, arguments, plan); } catch (e) { console.warn('night13: shortened rest failed', e); return r; }
      try { showWake(plan); } catch (e) { console.warn('night13: wake failed', e); pending = null; }
      return r;
    };
  }

  // ================================================================ 2. the Unrung Bell
  function omen(day) { return hash('omen:' + day) % 100 < OMEN_PCT; }
  function bellNight(day, flags) {
    const f = flags || (hasG() ? G.flags : {}) || {};
    if (f.greening || f.part3 || f.part4 || !set.bell || !(day >= 0)) return false;
    if (day >= BELL_DAYS[0] && day <= BELL_DAYS[1]) return true;
    return omen(day);
  }
  const bellHour = (day) => BELL_HOUR0 + (hash('hour:' + day) % 50) / 10;      // 21.5 .. 26.4 (past 24 = after midnight)
  const BELL_MAPS = (id) => id === 'oakhaven' || id === 'clearing' || /^greenroot/.test(id || '');
  function heardHere() { return !!(hasG() && G.map && G.map.outdoor && BELL_MAPS(G.mapId)); }

  function caption(text) {
    try {
      if (typeof ACCESS === 'undefined' || !ACCESS.settings || !ACCESS.settings.cap) return;
      let b = document.getElementById('ac-captions');
      if (!b) { const g = document.getElementById('game'); if (!g) return; b = document.createElement('div'); b.id = 'ac-captions'; b.setAttribute('role', 'log'); b.setAttribute('aria-live', 'polite'); b.setAttribute('aria-label', 'Sound captions'); g.appendChild(b); }
      const d = document.createElement('div'); d.textContent = text; b.appendChild(d);
      while (b.children.length > 4) b.removeChild(b.firstChild);
      setTimeout(() => { if (d.parentNode) d.remove(); }, 3600);
      stats.captions.push(text); if (stats.captions.length > 20) stats.captions.shift();
    } catch (e) { /* cosmetic */ }
  }
  let duckState = null;
  // the dip: one ramp down, a hold, one ramp back to wherever the bus was (a silence zone may own it, so we read it, not assume 1)
  function duckBus(full) {
    try {
      if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.sfxBus || !Audio_.sfxBus.gain) return;
      const g = Audio_.sfxBus.gain, t = Audio_.ctx.currentTime, depth = full ? DUCK.full : DUCK.gentle;
      const prev = duckState ? duckState.prev : ((typeof KIT12 !== 'undefined' && KIT12 && KIT12.audioMuted) ? g.value : 1);   // the bus rests at 1; a stinger swell (js/nerves13.js) in progress is not a resting level
      if (duckState) clearTimeout(duckState.timer);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(depth, t + DUCK.down);
      g.setValueAtTime(depth, t + DUCK.down + DUCK.hold);
      g.linearRampToValueAtTime(prev, t + DUCK.down + DUCK.hold + DUCK.up);
      const ms = (DUCK.down + DUCK.hold + DUCK.up) * 1000 + 120;
      duckState = { prev, depth, timer: setTimeout(finishDuck, ms) };
      stats.duck = { depth, prev, restored: false };
    } catch (e) { /* no audio */ }
  }
  // belt and braces: whatever the audio clock did, the bus ends where it began
  function finishDuck() {
    if (!duckState) return;
    const d = duckState; duckState = null; clearTimeout(d.timer);
    try { const g = Audio_.sfxBus.gain, t = Audio_.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(d.prev, t); g.value = d.prev; } catch (e) { /* none */ }   // .value too, so the level reads back at once
    if (stats.duck) stats.duck.restored = true;
  }
  // a thrum where a bell should be: two sub-bass sines a beat apart, a slow swell in, a long way out; never a strike
  function thrum(full) {
    try {
      if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.master || Audio_.muted) return;
      const ctx = Audio_.ctx, t = ctx.currentTime, peak = full ? 0.22 : 0.12;
      const out = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 160;
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(peak, t + 0.9); out.gain.setValueAtTime(peak, t + 1.4); out.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
      for (const f of [41, 61.5]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(out); o.start(t); o.stop(t + 4.6); }
      out.connect(lp); lp.connect(Audio_.master);
    } catch (e) { /* no audio */ }
  }
  function ringBell(opts) {
    const full = opts && opts.full != null ? !!opts.full : scaresFull();
    stats.rings++; stats.lastRing = { day: hasG() ? G.day : 0, full };
    say(G.mapId === 'oakhaven' ? TX.bellMsg : TX.bellOut, 'warn', 8000);
    caption(TX.bellCap);
    thrum(full); duckBus(full);
    if (opts && opts.night != null) ring.night = opts.night;
    ring.since = 0;
  }
  const bellActive = () => !!(hasG() && set.bell && !greened() && ring.night !== null && ring.night === nightDay() && nightHour() && ring.since >= BELL_DELAY);
  const spawnMult = () => (bellActive() ? BELL_SPAWN_MULT : 1);

  function tick(dt) {
    if (!hasG() || !G.player || !G.map) return;
    if (ring.night !== null) ring.since += dt;
    if (pending && G.state === 'play' && G.openPanel !== 'p13t-wake') finishWake();   // Escape closed the screen: the night still happened
    if (!set.bell || G.state !== 'play' || greened() || !heardHere() || !nightHour()) return;
    const nd = nightDay();
    if (ring.night === nd || !bellNight(nd)) return;
    let h = G.tod * 24; if (h < 7) h += 24;
    const t0 = bellHour(nd);
    if (h >= t0 && h < t0 + 0.5) { ring.night = nd; ringBell({ night: nd }); }
  }
  function wireTick() {
    if (typeof update !== 'function') return;
    const _u = update;
    update = function (dt) {
      const r = _u.apply(this, arguments);
      try { tick(dt); } catch (e) { console.warn('night13: tick failed', e); }
      return r;
    };
  }
  function wireSpawn() {
    if (typeof spawnHound !== 'function') return;
    const _sh = spawnHound;
    spawnHound = function () {
      const r = _sh.apply(this, arguments);
      try {
        const m = spawnMult();
        if (m > 1 && rnd() < m - 1) { stats.extras++; setTimeout(() => { try { if (spawnMult() > 1) _sh(); } catch (e) { /* cosmetic */ } }, 2500); }
      } catch (e) { /* cosmetic */ }
      return r;
    };
  }
  // the day after: generic townsfolk, Oakhaven, before the Greening
  const folkId = (id) => id === 'townsman' || id === 'townswoman';
  function folkLine(e) {
    if (!set.bell || greened() || !e || !folkId(e.id) || !hasG() || G.mapId !== 'oakhaven' || nightHour()) return null;
    if (!bellNight(G.day - 1)) return null;
    return TX.folk[hash(G.day + ':' + Math.round((e.homeX || 0) * 10) + ':' + Math.round((e.homeY || 0) * 10)) % TX.folk.length];
  }
  function wireTalk() {
    if (typeof talk !== 'function') return;
    const _talk = talk;
    talk = function (e) {
      const r = _talk.apply(this, arguments);
      try {
        const line = folkLine(e);
        if (line && G.state === 'dialogue' && DLG && DLG.ent === e && DLG.log) { DLG.log.push({ who: 'them', t: line }); renderDialogue(DLG.choices ? 'choice' : null); }
      } catch (err) { console.warn('night13: townsfolk line failed', err); }
      return r;
    };
  }

  // ================================================================ options, style, boot
  function row(grid, id, label, hint, get, setter) {
    const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.appendChild(document.createTextNode(label + ' '));
    const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = hint; lab.appendChild(sm);
    const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button';
    const paint = () => { b.textContent = get() ? 'On' : 'Off'; b.setAttribute('aria-pressed', String(!!get())); b.classList.toggle('sel', !!get()); };
    paint(); b.onclick = () => { setter(!get()); paint(); };
    grid.appendChild(lab); grid.appendChild(b);
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('n13-terrors-opt')) return;
    row(grid, 'n13-terrors-opt', TX.label, TX.hint, () => set.terrors, (v) => { set.terrors = v; save(); });
    row(grid, 'n13-bell-opt', TX.labelBell, TX.hintBell, () => set.bell, (v) => { set.bell = v; save(); });
  }
  function wireOptions() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try { appendRows(); } catch (e) { console.warn('night13: options rows failed', e); }
      return r;
    };
  }
  function injectStyle() {
    if (document.getElementById('night13-style')) return;
    const st = document.createElement('style'); st.id = 'night13-style';
    st.textContent = `
.p13t-wake { text-align: center; animation: p13t-in 1.2s ease-out; }
.p13t-wake h2 { margin: 0 0 1.2cqh; }
.p13t-dream { font-size: 2.3cqw; line-height: 1.35; margin: 1.2cqh 1.5cqw 2cqh; font-style: italic; }
@keyframes p13t-in { from { opacity: 0; } to { opacity: 1; } }
html.ac-reduce-motion .p13t-wake { animation: none; }
@media (prefers-reduced-motion: reduce) { .p13t-wake { animation: none; } }
`;
    document.head.appendChild(st);
  }

  load();
  const wire = (name, fn) => { try { fn(); } catch (e) { console.warn('night13: ' + name + ' wiring failed', e); } };
  if (typeof document !== 'undefined') wire('style', injectStyle);
  wire('rest', wireRest); wire('tick', wireTick); wire('spawn', wireSpawn); wire('talk', wireTalk); wire('options', wireOptions);

  return {
    set, save, load, seed, stats, TX, ring,
    BASE, KIND, DREAD_ADD, FIRE_MULT, COMPANION_MULT, CAT_MULT, OMEN_MULT, CHANCE_MAX, P_DANGER, P_TWO, SLEPT, DIST, GRACE,
    BELL_DAYS, OMEN_PCT, BELL_SPAWN_MULT, BELL_DELAY, DUCK,
    blocked, localTypes, chanceFor, planTerror, showWake, finishWake, get pending() { return pending; }, scaresFull, isSafePlace, nightDay,
    omen, bellNight, bellHour, ringBell, finishDuck, bellActive, spawnMult, tick, folkLine, heardHere, rnd,
    catalog() { const out = []; for (const k of Object.keys(TX)) { if (Array.isArray(TX[k])) TX[k].forEach((s, i) => out.push({ key: k + i, en: s })); else out.push({ key: k, en: TX[k] }); } return out; },
  };
})();
if (typeof window !== 'undefined') window.NIGHT13 = NIGHT13;
