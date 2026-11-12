// ============================================================
//  ghost18 — Phase 18 "Technical", team GHOST: ghost replays.
//
//  WHAT IT DOES
//   * Records the player's position, facing and pose (what the hands and voice are doing) at a FIXED tick of 10 Hz of
//     game time during every boss fight and, when asked, during any other run (daily challenges), quantised and
//     size-capped, and keeps the BEST run per key on this device (localStorage 'octave.ghost18.v1').
//   * Replays a kept run as a translucent, pale figure in the player's likeness (the calling, the face, the weapon,
//     the head/body/shield they wore) in later attempts: it fades with distance, never blocks the view, is hidden by
//     walls and bodies in front of it, and respects Reduce motion (no idle drift, nothing animated that is not the
//     run itself) and No flashes (no pulses, no flicker, no flash on a hit).
//   * "Watch" mode: from the hung boss trophy on the pegs of the house on Cooper's Row (an extra choice on the
//     trophy) and from Options -> Ghost codes: a top-down replay of the run with a scrub bar, speed and the
//     boss's health. It changes nothing in the world and nothing in the save.
//   * Exports and imports a ghost as a short code the player copies by hand (no server): "GH1." + base64url.
//
//  IT NEVER AFFECTS GAMEPLAY. The ghost is not an entity: it is not in G.ents, enemies cannot see, hear or hit it,
//  it is not solid, it is not pickable, it makes no sound unless the player turns the faint echo on. Recording only
//  reads state; the figure is drawn by one post hook straight into the frame buffer (after the sprites, before
//  fog); no Math.random is ever called (the module's art is a function of the pose alone), no combat state is
//  written. Off (the Original preset switches it off; Options -> Ghost replays) = the game exactly as before.
//
//  CONTRACT FOR OTHER MODULES (DAILY, js/daily18.js): window.GHOST18
//   GHOST18.enabled()              -> boolean. false when Ghost replays is off (the record/play calls then return false).
//   GHOST18.record(key)            -> boolean. Start recording a run under `key` NOW (tick 0 = this moment). `key` is
//                                     [a-z0-9][a-z0-9:_.-]{0,47}, e.g. 'daily:2026-10-20' or 'daily:practice-4411'.
//                                     The recording follows the player across maps (each tick knows its map id). Call
//                                     it at the moment the run starts. A second record() replaces an unfinished one.
//                                     Boss fights record on their own under 'boss:<enemy type>' ('boss:wearer'...);
//                                     do not call record() for those.
//   GHOST18.stop(result?)          -> { saved, replaced, meta } | null. Ends the manual recording and keeps it if it
//                                     beats the best run for that key. result = { win:boolean, score?:integer }.
//                                     "Better" = a higher `score` when both have one, else a win beats a non-win,
//                                     wins by shorter time, non-wins by the boss/target health left then by the longer
//                                     survival. Pass { win:true, score } for a finished daily run. GHOST18.abort() throws
//                                     the recording away (the player left the run).
//   GHOST18.best(key)              -> meta | null (never the data). meta = { key, source:'mine'|'friend', win, secs,
//                                     score|null, hpEnd, ticks, bytes, when, map, label }. Mine and an imported
//                                     (friend's) ghost are kept separately; best() returns the better of the two.
//   GHOST18.play(key, {source?})   -> boolean. Start replaying the best ghost of `key` now, from its tick 0, as the
//                                     translucent figure. It plays through its recorded maps (it shows only on the map
//                                     it was on at that moment), holds for 1.5 s at its end and fades away. The
//                                     boss-fight ghost does this by itself. GHOST18.stopPlay() ends it early.
//   GHOST18.state()                -> { recording:key|null, playing:key|null, t, bossFight:type|null }
//   GHOST18.watch(key, source?)    -> boolean. Opens the top-down Watch panel on that ghost.
//   GHOST18.exportCode(key, source?) -> 'GH1.…' | null.   GHOST18.importCode(code) -> { ok, key?, reason?, replaced? }
//   GHOST18.list() -> metas.  GHOST18.remove(key, source?) -> boolean.
//   All of it is inert (returns false/null) with Ghost replays off, without a player, or with storage blocked
//   (the ghosts then live for the session in memory).
//
//  FORMAT (all of it in B and CODEC below; sizes are the caps)
//   Tick = 0.1 s of game time (the update loop's dt summed, so a paused game records nothing). One byte per tick when
//   standing still: bits 0-3 pose (0 none, 1 slash right, 2 slash left, 3 chop down, 4 cut up, 5 thrust, 6 shot, 7
//   song, 8 hurt, 9 block), bit 4 "moved" (zigzag-varint dx, dy in 1/8 tile follow), bit 5 "turned" (zigzag dir delta
//   in 1/64 turn), bit 6 "map changed" (map index, then absolute x, y). A boss's health is one byte per second.
//   Blob = version, flags, key, maps, look (calling, face, weapon kind, gear), when (days), time (cs), score,
//   boss health left, tick count, start x, y, dir, ticks, boss health samples, then a 32-bit FNV-1a checksum;
//   the code is that blob in base64url behind "GH1.". A minute of fighting is about 1-3 KB of text, the most it can ever be is under 16 KB.
//   Caps: 2400 ticks (4 min) per ghost, 16000 characters per code, 60 ghosts and 200000 characters in all
//   (oldest daily ghosts, then imported ones, are dropped first; a boss best is never dropped to make room).
//   Import checks: checksum, version, key shape (boss keys must name a boss that exists), map ids, tick count,
//   every position inside 0-512 tiles, no step over 2 tiles between ticks (except at a map change), pose values,
//   the stated time against the tick count, boss health, no trailing bytes. A code that fails any of it is
//   refused with a one-line reason and nothing is stored. (The checksum is not a secret, so it stops accidents and
//   casual edits; the plausibility checks stop the rest that matters: a ghost can only show a run the game could
//   have recorded, and it only ever draws a pale figure.)
//
//  Wrapped, never edited: update, restoreGame, startGame, useDeco, renderAccessibilityMenu. Options rows are
//  appended to Graphics & access (Ghost replays, Ghost echo, Ghost codes). The figure is procedural art
//  (stand-in): painted from the pose, cached, never per frame. All player-visible text is in TX, through S().
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.ghostReplay === undefined) GFX.ghostReplay = true;
  if (GFX.FX && !GFX.FX.includes('ghostReplay')) GFX.FX.push('ghostReplay');   // presets: on from Low up, off in Original
}

const GHOST18 = (function () {
  const KEY = 'octave.ghost18.v1';

  // ---------------------------------------------------------------- balance and caps, one table
  const B = {
    TICK: 0.1,                 // seconds of game time per recorded tick
    POS_Q: 8,                  // position units per tile (1/8 tile)
    DIR_Q: 64,                 // facing steps per turn
    HP_EVERY: 10,              // boss health sampled once per this many ticks (1 s)
    MIN_TICKS: 20,             // a run shorter than 2 s is not kept
    MAX_TICKS: 2400,           // 4 minutes: a longer run stops recording and is not kept
    MAX_CODE: 16000,           // characters in one exported code
    MAX_SLOTS: 60, MAX_TOTAL: 200000,   // ghosts / characters kept in all
    MAX_STEP: 16,              // largest believable move between two ticks (2 tiles) except at a map change
    MAX_POS: 4095,             // 512 tiles
    MAX_MAPS: 8,
    ABANDON: 6,                // seconds a boss may stop chasing before the fight is dropped (not kept)
    HOLD: 1.5, FADE_IN: 0.6, FADE_OUT: 1.0,   // seconds at the end of a replay (Reduce motion: fade in 0.2)
    ALPHA_MAX: 0.66,           // the most opaque the figure gets
    NEAR: [0.55, 1.25],        // the figure vanishes inside 0.55 tiles and is whole at 1.25
    FAR: [0.55, 1.0],          // fraction of the fog distance where it starts to fade and where it is gone
    CATCH: 8,                  // ticks a long frame may catch up in one go
    ECHO_RANGE: 9, ECHO_GAIN: 0.035,
    WALK: 0.35, RUN: 4.4,      // tiles per second: below WALK it stands, above RUN it runs
    STRIDE: 0.42,              // tiles per leg swing
  };
  const SALT = 'GH1ghost18';
  const CODE_RE = /^[A-Za-z0-9_-]+$/;
  const KEY_RE = /^[a-z0-9][a-z0-9:_.-]{0,47}$/;
  const MAP_RE = /^[A-Za-z0-9_:.-]{1,40}$/;

  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const hasG = () => typeof G !== 'undefined' && G && typeof G === 'object';
  const reduced = () => !!(typeof GFX !== 'undefined' && (GFX.reduceMotion || GFX.reducedMotion));
  const fmt = (s, ...a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[+i] == null ? '' : a[+i]));
  const sayMsg = (t, c, ms) => { try { if (typeof msg === 'function') msg(t, c, ms); } catch (e) { /* the message line is cosmetic */ } };
  const el = (tag, props, text) => { const e = document.createElement(tag); if (props) for (const k in props) e.setAttribute(k, props[k]); if (text != null) e.textContent = text; return e; };
  const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the text [PROPOSED] (all of it; see TEXT.md)
  const LIST = [];
  const S = (t) => { LIST.push(t); return t; };
  const TX = {
    opts: {
      ghost: S('Ghost replays'), ghostHint: S('record boss fights and daily runs, keep your best, and replay it as a pale figure beside you. It never changes the fight.'),
      echo: S('Ghost echo'), echoHint: S('a very faint sound when your ghost strikes.'),
      codes: S('Ghost codes'), codesHint: S('watch, copy, import or delete the ghosts kept on this device.'),
      on: S('On'), off: S('Off'), open: S('Open'),
    },
    say: {
      start: S('Your ghost runs the fight against {0} again beside you.'),
      kept: S('New best against {0}: {1}. Your ghost is kept.'),
      keptLoss: S('Your attempt against {0} is kept as a ghost to learn from.'),
      beat: S('You beat your ghost by {0}.'),
      lost: S('Your ghost was {0} quicker.'),
      tie: S('You and your ghost finish together.'),
    },
    panel: {
      title: S('Ghosts'), watchTitle: S('Watch: {0}'),
      empty: S('No ghosts yet. Win a boss fight with Ghost replays on, and your best run is kept here.'),
      mine: S('Yours'), friend: S('Imported'), won: S('Victory'), failed: S('Defeat'),
      line: S('{0} · {1} · {2}'), score: S('{0} points'),
      watch: S('Watch'), copy: S('Copy code'), del: S('Delete'), close: S('Close'), back: S('Back'),
      importHead: S('Import a ghost'), importHint: S('Paste a ghost code here'), importBtn: S('Import'),
      imported: S('Imported: {0}.'), copied: S('Code copied.'), copyFail: S('Could not copy by itself: select the code and copy it by hand.'),
      deleted: S('Ghost deleted.'), kept: S('{0} of {1} ghosts kept on this device.'), codeLabel: S('Ghost code'),
      bad: {
        empty: S('Paste a ghost code first.'), format: S('That is not a ghost code.'), sum: S('That code was changed or cut short.'),
        version: S('That code is from a newer game.'), shape: S('That code does not describe a run this game could record.'),
        key: S('That ghost is for a fight this game does not have.'), size: S('That code is too long to keep.'), full: S('There is no room to keep another ghost.'),
        worse: S('You already have a better one of those; it was not replaced.'),
      },
      play: S('Play'), pause: S('Pause'), restart: S('Restart'), speed: S('Speed {0}x'), time: S('{0} of {1}'), bossHp: S('Boss health {0}%'),
      alt: S('A top-down view of the arena: the pale path the ghost walked, the ghost itself, and a pulse where it struck or sang.'),
      keys: S('Space plays or pauses · Left / Right seek 5 s · Up / Down speed · R restarts · Esc closes · pad: A plays, B closes, D-pad seeks'),
      scrub: S('Position in the run'), noMap: S('The place this ghost ran is not in this game, so only its path is drawn.'),
    },
    peg: { watch: S('Watch your best run.') },
  };

  // ---------------------------------------------------------------- settings
  const cfg = { echo: false, override: null };   // override: a stored choice for ghostReplay over the preset (null = follow it)
  let slots = {};                                 // 'key|m' / 'key|f' -> { code, g (decoded), when }
  let mineChanging = false;
  function loadAll() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        if (typeof o.echo === 'boolean') cfg.echo = o.echo;
        if (typeof o.override === 'boolean') cfg.override = o.override;
        if (o.slots && typeof o.slots === 'object') {
          for (const sk of Object.keys(o.slots).slice(0, 200)) {
            const m = /^(.+)\|([mf])$/.exec(sk); const code = o.slots[sk];
            if (!m || typeof code !== 'string') continue;
            const r = decode(code);
            if (r.ok && r.g.key === m[1]) slots[sk] = { code, g: r.g };   // a hand-edited store drops what fails the same checks as an import
          }
        }
      }
    } catch (e) { /* private window or blocked storage: the defaults stand */ }
    if (cfg.override !== null && typeof GFX !== 'undefined') GFX.ghostReplay = cfg.override;
  }
  function saveAll() {
    try {
      const o = { v: 1, echo: cfg.echo, override: cfg.override, slots: {} };
      for (const sk in slots) o.slots[sk] = slots[sk].code;
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* ghosts then live for the session */ }
  }
  const on = () => typeof GFX !== 'undefined' && !!GFX.ghostReplay;
  function setEnabled(v) {
    mineChanging = true;
    try { GFX.ghostReplay = !!v; cfg.override = !!v; saveAll(); if (typeof GFX.changed === 'function') GFX.changed(); } finally { mineChanging = false; }
    if (!v) shutdown();
  }

  // ---------------------------------------------------------------- the look: what the figure wears
  const WK = { hands: 0, sword: 1, knife: 2, longsword: 3, axe: 4, mace: 5, tollhammer: 5, maul: 5, spear: 6, pistol: 7, crossbow: 8, glass: 9 };
  const HEAD = { a_cap: 1, a_hood: 2, a_kettle: 3, a_bellhelm: 3 };
  const BODY = { a_gambeson: 1, a_hushcoat: 1, a_synodrobe: 1, a_jerkin: 2, a_brig: 2, a_chain: 2, a_plate: 2 };
  function lookNow() {
    const p = hasG() ? G.player : null; if (!p) return { cls: 0, face: 1, wpn: 1, arm: 0 };
    let cls = 0; try { cls = Math.max(0, CLASSES.findIndex((c) => c && p.cls && c.id === p.cls.id)); } catch (e) { cls = 0; }
    const wid = Array.isArray(p.weapons) ? p.weapons[p.weapon] : 'hands';
    const a = p.armor || {}, two = !!(typeof WEAPONS !== 'undefined' && WEAPONS[wid] && WEAPONS[wid].twoHanded);
    const arm = (HEAD[a.head] || 0) | ((BODY[a.body] || 0) << 2) | ((a.shield && !two ? 1 : 0) << 4) | ((a.hands ? 1 : 0) << 5);
    return { cls: clamp(cls | 0, 0, 15), face: [1, 2, 3, 4, 5, 6].includes(p.face) ? p.face : 1, wpn: WK[wid] != null ? WK[wid] : 1, arm };
  }

  // ---------------------------------------------------------------- bosses
  function bossDef(type) { try { return typeof ENEMIES !== 'undefined' && Object.prototype.hasOwnProperty.call(ENEMIES, type) ? ENEMIES[type] : null; } catch (e) { return null; } }
  function isBossDef(d) { return !!(d && (d.boss || d.wildsBoss || d.codaBoss)); }
  // the bosses whose fights have trophies (js/hearth15.js), plus any enemy def flagged boss; ids as in js/data.js
  const BOSS_LIST = ['wearer', 'wearer_coda', 'requiem', 'aegis', 'weaver', 'pressman', 'broodmother', 'bosun', 'horn', 'deacon', 'captain'];
  const isBossType = (t) => typeof t === 'string' && (BOSS_LIST.includes(t) || isBossDef(bossDef(t))) && !!bossDef(t);
  const TROPHY_BOSS = { wearer: 'wearer', coda: 'wearer_coda', requiem: 'requiem', aegis: 'aegis', weaver: 'weaver', mallow: 'pressman', brood: 'broodmother', bosun: 'bosun', horn: 'horn', deacon: 'deacon', captain: 'captain' };
  const bossName = (type) => { const d = bossDef(type); return d && d.name ? String(d.name) : type; };
  const keyName = (key) => /^boss:/.test(key) ? bossName(key.slice(5)) : key.replace(/^daily:/, '');

  // ================================================================ CODEC
  function fnv(bytes, n) {
    let h = 0x811c9dc5;
    for (let i = 0; i < n; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    for (let i = 0; i < SALT.length; i++) { h ^= SALT.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function wVar(a, n) { n = Math.max(0, Math.floor(n)); while (n >= 128) { a.push((n % 128) | 128); n = Math.floor(n / 128); } a.push(n); }
  const zz = (n) => (n >= 0 ? n * 2 : -n * 2 - 1);
  const unzz = (u) => (u % 2 ? -(u + 1) / 2 : u / 2);
  function wStr(a, s) { a.push(s.length); for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 127); }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64enc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0), left = bytes.length - i;
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (left > 1 ? B64[(n >> 6) & 63] : '') + (left > 2 ? B64[n & 63] : '');
    }
    return s;
  }
  function b64dec(s) {
    if (s.length % 4 === 1) return null;
    const out = []; let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64.indexOf(s[i]); if (v < 0) return null;
      acc = (acc << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; }
    }
    return out;
  }
  const daysNow = () => Math.max(0, Math.min(60000, Math.floor((Date.now() - Date.UTC(2020, 0, 1)) / 86400000)));

  // a recording / ghost as plain data -> code
  function encode(g) {
    const a = [1];
    a.push((g.win ? 1 : 0) | (g.hp && g.hp.length ? 2 : 0) | (g.score != null ? 4 : 0));
    wStr(a, g.key);
    a.push(g.maps.length); for (const m of g.maps) wStr(a, m);
    a.push(g.look.cls & 15, g.look.face & 7, g.look.wpn & 15, g.look.arm & 63);
    wVar(a, g.when); wVar(a, g.n * 10); if (g.score != null) wVar(a, zz(g.score));
    a.push(clamp(g.hpEnd | 0, 0, 100));
    wVar(a, g.n); wVar(a, g.X[0]); wVar(a, g.Y[0]); a.push(g.D[0] & 63);
    let px = g.X[0], py = g.Y[0], pd = g.D[0];
    for (let i = 0; i < g.n; i++) {
      let h = g.A[i] & 15, dx = 0, dy = 0, dd = 0;
      const mc = i > 0 && g.M[i] !== g.M[i - 1];
      if (i > 0) { dx = g.X[i] - px; dy = g.Y[i] - py; dd = ((g.D[i] - pd + 96) & 63) - 32; }
      if (mc) h |= 64; else if (dx || dy) h |= 16;
      if (dd) h |= 32;
      a.push(h);
      if (mc) { wVar(a, g.M[i]); wVar(a, g.X[i]); wVar(a, g.Y[i]); } else if (h & 16) { wVar(a, zz(dx)); wVar(a, zz(dy)); }
      if (dd) wVar(a, zz(dd));
      px = g.X[i]; py = g.Y[i]; pd = g.D[i];
    }
    if (g.hp && g.hp.length) for (let i = 0; i < g.hp.length; i++) a.push(clamp(g.hp[i] | 0, 0, 100));
    const h = fnv(a, a.length);
    a.push(h & 255, (h >>> 8) & 255, (h >>> 16) & 255, (h >>> 24) & 255);
    return 'GH1.' + b64enc(a);
  }

  // code -> { ok, g } | { ok:false, reason }  (reason is a key of TX.panel.bad)
  function decode(code) {
    const bad = (reason) => ({ ok: false, reason });
    if (typeof code !== 'string') return bad('format');
    code = code.replace(/\s+/g, '');
    if (!code) return bad('empty');
    if (code.length > B.MAX_CODE) return bad('size');
    if (!/^GH1\./.test(code) || !CODE_RE.test(code.slice(4))) return bad('format');
    const a = b64dec(code.slice(4));
    if (!a || a.length < 24) return bad('format');
    const n4 = a.length - 4, sum = (a[n4] | (a[n4 + 1] << 8) | (a[n4 + 2] << 16) | (a[n4 + 3] << 24)) >>> 0;
    if (fnv(a, n4) !== sum) return bad('sum');
    let p = 0;
    const need = () => { if (p >= n4) throw 0; return a[p++]; };
    const rVar = () => { let v = 0, m = 1; for (let i = 0; i < 5; i++) { const b = need(); v += (b & 127) * m; if (b < 128) return v; m *= 128; } throw 0; };
    const rStr = (max) => { const L = need(); if (L < 1 || L > max) throw 0; let s = ''; for (let i = 0; i < L; i++) { const c = need(); if (c > 126 || c < 32) throw 0; s += String.fromCharCode(c); } return s; };
    try {
      if (need() !== 1) return bad('version');
      const fl = need(); if (fl & ~7) throw 0;
      const key = rStr(48); if (!KEY_RE.test(key)) throw 0;
      const nm = need(); if (nm < 1 || nm > B.MAX_MAPS) throw 0;
      const maps = []; for (let i = 0; i < nm; i++) { const m = rStr(40); if (!MAP_RE.test(m)) throw 0; maps.push(m); }
      const look = { cls: need(), face: need(), wpn: need(), arm: need() };
      if (look.cls > 15 || look.face < 1 || look.face > 6 || look.wpn > 9 || look.arm > 63) throw 0;
      const when = rVar(); if (when > 60000) throw 0;
      const cs = rVar(); const score = fl & 4 ? unzz(rVar()) : null;
      if (score != null && Math.abs(score) > 1e8) throw 0;
      const hpEnd = need(); if (hpEnd > 100) throw 0;
      const n = rVar(); if (n < B.MIN_TICKS || n > B.MAX_TICKS) throw 0;
      if (cs !== n * 10) throw 0;                       // the stated time must agree with the ticks
      const X = new Int16Array(n), Y = new Int16Array(n), D = new Uint8Array(n), A = new Uint8Array(n), M = new Uint8Array(n);
      X[0] = rVar(); Y[0] = rVar(); D[0] = need();
      if (X[0] > B.MAX_POS || Y[0] > B.MAX_POS || D[0] > 63) throw 0;
      let px = X[0], py = Y[0], pd = D[0], pm = 0;
      for (let i = 0; i < n; i++) {
        const h = need(); if (h & 128) throw 0;
        const act = h & 15; if (act > 9) throw 0;
        A[i] = act;
        let x = px, y = py, m = pm;
        if (i > 0) {
          if (h & 64) { m = rVar(); if (m >= nm || m === pm) throw 0; x = rVar(); y = rVar(); if (x > B.MAX_POS || y > B.MAX_POS) throw 0; }
          else if (h & 16) { x = px + unzz(rVar()); y = py + unzz(rVar()); if (x < 0 || y < 0 || x > B.MAX_POS || y > B.MAX_POS) throw 0; if (Math.abs(x - px) > B.MAX_STEP || Math.abs(y - py) > B.MAX_STEP) throw 0; }
        } else if (h & 80) throw 0;
        let d = pd;
        if (h & 32) { const dd = unzz(rVar()); if (dd < -32 || dd > 31 || dd === 0) throw 0; d = (pd + dd + 64) & 63; }
        X[i] = x; Y[i] = y; D[i] = d; M[i] = m; px = x; py = y; pd = d; pm = m;
      }
      let hp = null;
      if (fl & 2) { const c = Math.ceil(n / B.HP_EVERY); hp = new Uint8Array(c); for (let i = 0; i < c; i++) { hp[i] = need(); if (hp[i] > 100) throw 0; } }
      if (p !== n4) throw 0;                            // no trailing bytes
      if (/^boss:/.test(key)) { if (!isBossType(key.slice(5))) return bad('key'); if ((fl & 1) && hpEnd !== 0) throw 0; }
      const g = { key, maps, look, win: !!(fl & 1), score, secs: n * B.TICK, hpEnd, when, n, X, Y, D, A, M, hp };
      prep(g);
      return { ok: true, g };
    } catch (e) { return bad(e === 0 ? 'shape' : 'format'); }
  }
  // per-ghost derived arrays used by the replay: path length so far (for the stride) and the action runs
  function prep(g) {
    const n = g.n; g.cum = new Float32Array(n); g.runS = new Uint16Array(n); g.runL = new Uint16Array(n);
    for (let i = 1; i < n; i++) g.cum[i] = g.cum[i - 1] + (g.M[i] === g.M[i - 1] ? Math.hypot(g.X[i] - g.X[i - 1], g.Y[i] - g.Y[i - 1]) / B.POS_Q : 0);
    for (let i = 0; i < n;) {
      let j = i; while (j < n && g.A[j] === g.A[i]) j++;
      for (let k = i; k < j; k++) { g.runS[k] = i; g.runL[k] = j - i; }
      i = j;
    }
    return g;
  }
  const metaOf = (g, source, code) => ({
    key: g.key, source, win: !!g.win, secs: g.secs, score: g.score, hpEnd: g.hpEnd, ticks: g.n, bytes: code ? code.length : 0, when: g.when, map: g.maps[0],
    label: keyName(g.key),
  });
  // "better": higher score when both have one, a win over a non-win, a quicker win, else the boss lower / the run longer
  function better(a, b) {
    if (a.score != null && b.score != null && a.score !== b.score) return a.score > b.score;
    if (!!a.win !== !!b.win) return !!a.win;
    if (a.win) return a.secs < b.secs;
    if (a.hpEnd !== b.hpEnd) return a.hpEnd < b.hpEnd;
    return a.secs > b.secs;
  }

  // ================================================================ STORE
  const slotKey = (key, src) => key + '|' + (src === 'friend' || src === 'f' ? 'f' : 'm');
  function getSlot(key, source) {
    const m = slots[slotKey(key, 'm')], f = slots[slotKey(key, 'f')];
    if (source === 'mine') return m ? { s: m, source: 'mine' } : null;
    if (source === 'friend') return f ? { s: f, source: 'friend' } : null;
    if (m && f) return better(f.g, m.g) ? { s: f, source: 'friend' } : { s: m, source: 'mine' };
    if (m) return { s: m, source: 'mine' };
    return f ? { s: f, source: 'friend' } : null;
  }
  function best(key, source) {
    const r = getSlot(String(key), source); if (!r) return null;
    return metaOf(r.s.g, r.source, r.s.code);
  }
  function ghostOf(key, source) { const r = getSlot(String(key), source); return r ? r.s.g : null; }
  function list() {
    const out = [];
    for (const sk in slots) { const m = /^(.+)\|([mf])$/.exec(sk); out.push(metaOf(slots[sk].g, m[2] === 'f' ? 'friend' : 'mine', slots[sk].code)); }
    out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.source < b.source ? -1 : 1));
    return out;
  }
  const totalChars = () => { let n = 0; for (const sk in slots) n += slots[sk].code.length; return n; };
  // make room for `need` characters and one slot: oldest daily ghosts first, then imported ones; a boss best never goes
  function makeRoom(need, keep) {
    const droppable = () => Object.keys(slots).filter((sk) => sk !== keep && !/^boss:/.test(slots[sk].g.key)).sort((a, b) => {
      const fa = /\|f$/.test(a) ? 1 : 0, fb = /\|f$/.test(b) ? 1 : 0;
      const da = /^daily:/.test(a) ? 0 : 1, db = /^daily:/.test(b) ? 0 : 1;
      if (da !== db) return da - db; if (fa !== fb) return fb - fa; return slots[a].g.when - slots[b].g.when;
    });
    while ((Object.keys(slots).length >= B.MAX_SLOTS || totalChars() + need > B.MAX_TOTAL)) {
      const d = droppable(); if (!d.length) return false; delete slots[d[0]];
    }
    return true;
  }
  // keep g as `source` if it beats what is there; returns { saved, replaced, meta }
  function keep(g, source) {
    const code = encode(g);
    if (code.length > B.MAX_CODE) return { saved: false, reason: 'size' };
    const sk = slotKey(g.key, source), old = slots[sk];
    if (old && !better(g, old.g)) return { saved: false, reason: 'worse', meta: metaOf(old.g, source === 'friend' ? 'friend' : 'mine', old.code) };
    const r = decode(code); if (!r.ok) return { saved: false, reason: r.reason };   // what we keep passes what an import passes
    if (old) delete slots[sk];
    if (!makeRoom(code.length, sk)) { if (old) slots[sk] = old; return { saved: false, reason: 'full' }; }
    slots[sk] = { code, g: r.g };
    saveAll();
    return { saved: true, replaced: !!old, meta: metaOf(r.g, source === 'friend' ? 'friend' : 'mine', code) };
  }
  function remove(key, source) {
    key = String(key); let any = false;
    for (const s of source ? [source] : ['mine', 'friend']) { const sk = slotKey(key, s); if (slots[sk]) { delete slots[sk]; any = true; } }
    if (any) saveAll();
    return any;
  }
  function exportCode(key, source) { const r = getSlot(String(key), source); return r ? r.s.code : null; }
  function importCode(code) {
    const r = decode(code); if (!r.ok) return { ok: false, reason: r.reason };
    const k = keep(r.g, 'friend');
    if (!k.saved) return { ok: false, reason: k.reason, key: r.g.key };
    return { ok: true, key: r.g.key, replaced: k.replaced, meta: k.meta };
  }

  // ================================================================ RECORDER
  // two independent recorders: `auto` follows a boss fight, `manual` is the caller's (record/stop)
  const recs = { auto: null, manual: null };
  let fight = null;                                   // { type, map, boss, lastChase }
  const mapIdNow = () => (hasG() && typeof G.mapId === 'string' && MAP_RE.test(G.mapId) ? G.mapId : 'unknown');
  function newRec(key, auto, boss) {
    if (!hasG() || !G.player || typeof Engine === 'undefined' || !Engine.cam) return null;
    const r = { key, auto, acc: 0, n: 0, X: [], Y: [], D: [], A: [], M: [], hp: [], maps: [mapIdNow()], look: lookNow(), boss: boss || null, lastBoss: 100, full: false };
    sample(r);
    return r;
  }
  function poseNow() {
    if (!hasG()) return 0;
    try {
      if (G.song && G.song.t > 0) return 7;
      if (G.attack && G.attack.t > 0) {
        const w = typeof currentWeapon === 'function' ? currentWeapon() : null;
        if (w && w.ranged) return 6;
        const L = String(G.attack.dirLabel || '');
        return L === 'slash left' ? 2 : L === 'chop down' ? 3 : L === 'cut up' ? 4 : L === 'thrust' ? 5 : 1;
      }
      if (G.hurtT > 0) return 8;
      if (typeof UPG !== 'undefined' && UPG && UPG.blocking) return 9;
    } catch (e) { /* a missing system is no pose */ }
    return 0;
  }
  function sample(r) {
    if (r.n >= B.MAX_TICKS) { r.full = true; return; }
    const c = Engine.cam;
    let mi = r.maps.indexOf(mapIdNow());
    if (mi < 0) { if (r.maps.length >= B.MAX_MAPS) { r.full = true; return; } r.maps.push(mapIdNow()); mi = r.maps.length - 1; }
    const lim = B.MAX_POS / B.POS_Q;
    r.X.push(Math.round(clamp(c.x, 0, lim) * B.POS_Q)); r.Y.push(Math.round(clamp(c.y, 0, lim) * B.POS_Q));
    let a = Number(c.dir) || 0; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    r.D.push(Math.round(a / (Math.PI * 2) * B.DIR_Q) & 63);
    r.A.push(poseNow()); r.M.push(mi);
    if (r.boss && r.n % B.HP_EVERY === 0) { const b = r.boss; r.lastBoss = clamp(Math.ceil((Math.max(0, b.hp) / Math.max(1, b.hpMax || b.def.hp)) * 100), 0, 100); r.hp.push(r.lastBoss); }
    r.n++;
  }
  function stepRec(r, dt) {
    r.acc += dt; let k = 0;
    while (r.acc >= B.TICK && k < B.CATCH) { r.acc -= B.TICK; k++; sample(r); }
    if (r.acc > B.TICK * B.CATCH) r.acc = 0;
  }
  // the finished recording as a ghost (not yet kept)
  function toGhost(r, res) {
    const n = r.n; if (n < B.MIN_TICKS || n > B.MAX_TICKS) return null;
    const hpEnd = r.boss ? (res.win ? 0 : r.lastBoss) : (res.win ? 0 : 100);
    const hp = r.boss ? r.hp.slice(0, Math.ceil(n / B.HP_EVERY)) : [];
    while (r.boss && hp.length < Math.ceil(n / B.HP_EVERY)) hp.push(res.win ? 0 : r.lastBoss);
    if (r.boss && res.win && hp.length) hp[hp.length - 1] = Math.min(hp[hp.length - 1], 30);
    const g = {
      key: r.key, maps: r.maps.slice(), look: r.look, win: !!res.win, score: Number.isFinite(res.score) ? Math.round(res.score) : null,
      secs: n * B.TICK, hpEnd, when: daysNow(), n, X: Int16Array.from(r.X), Y: Int16Array.from(r.Y), D: Uint8Array.from(r.D), A: Uint8Array.from(r.A), M: Uint8Array.from(r.M),
      hp: hp.length ? Uint8Array.from(hp) : null,
    };
    return g;
  }
  function finishRec(r, res) {
    try {
      if (!r) return null;
      if (r.full) return { saved: false, reason: 'size' };
      sample(r);                                       // the last moment
      const g = toGhost(r, res); if (!g) return { saved: false, reason: 'shape' };
      return keep(g, 'mine');
    } catch (e) { console.warn('ghost18: could not keep a run', e); return null; }
  }

  // ---- manual recording (daily runs and anything else)
  function record(key) {
    key = String(key);
    if (!on() || !KEY_RE.test(key) || /^boss:/.test(key) || !hasG() || !G.player) return false;
    recs.manual = newRec(key, false);
    return !!recs.manual;
  }
  function stop(res) {
    const r = recs.manual; recs.manual = null; if (!r) return null;
    res = res && typeof res === 'object' ? res : {};
    return finishRec(r, { win: !!res.win, score: res.score });
  }
  function abort() { recs.manual = null; }

  // ---- boss fights
  function findBoss() {
    if (!hasG() || !Array.isArray(G.ents)) return null;
    for (const e of G.ents) {
      if (!e || e.kind !== 'enemy' || e.dead || e.hidden || !e.def || e.state !== 'chase') continue;
      if (isBossType(e.type) || (isBossDef(e.def) && KEY_RE.test('boss:' + e.type))) return e;
    }
    return null;
  }
  function endFight(win, discard) {
    const r = recs.auto, f = fight; recs.auto = null; fight = null;
    if (!r || discard) return null;
    const had = pb && pb.auto ? pb : null;
    const out = finishRec(r, { win });
    try {
      if (out && out.saved) sayMsg(win ? fmt(TX.say.kept, bossName(f.type), mmss(out.meta.secs)) : fmt(TX.say.keptLoss, bossName(f.type)), 'good', 6000);
      if (win && had && had.g.win && had.g.key === r.key) {
        const mine = r.n * B.TICK, theirs = had.g.secs, d = Math.abs(theirs - mine);
        sayMsg(d < 0.5 ? TX.say.tie : mine < theirs ? fmt(TX.say.beat, mmss(d)) : fmt(TX.say.lost, mmss(d)), '', 6000);
      }
    } catch (e) { /* cosmetic */ }
    return out;
  }
  function autoTick() {
    if (!on() || !hasG() || !G.player) return;
    if (!recs.auto) {
      const b = G.state === 'play' ? findBoss() : null;
      if (!b) return;
      const key = 'boss:' + b.type;
      const r = newRec(key, true, b); if (!r) return;
      recs.auto = r; fight = { type: b.type, map: mapIdNow(), boss: b, lastChase: 0, t: 0 };
      const gh = ghostOf(key);
      if (gh && gh.maps[0] === fight.map && !pb) { startPlay(gh, key, true); sayMsg(fmt(TX.say.start, bossName(b.type)), '', 4500); }
      return;
    }
    const f = fight, b = f.boss;
    if (mapIdNow() !== f.map) { endFight(false, true); return; }
    if (G.dead || (G.player && G.player.hp <= 0)) { endFight(false, false); return; }
    if (b.dead) { endFight(true, false); return; }
    if (recs.auto.full) { endFight(false, true); return; }
    if (b.state === 'chase' && !b.hidden) f.lastChase = f.t; else if (f.t - f.lastChase > B.ABANDON) { endFight(false, true); }
  }

  // ================================================================ PLAYBACK
  let pb = null;                                      // { g, key, t, hold, vis, auto, mapIdx cache }
  function startPlay(g, key, auto) {
    if (!g) return false;
    pb = { g, key, t: 0, vis: 0, auto: !!auto, ended: 0, lastRun: -1 };
    return true;
  }
  function play(key, opts) {
    key = String(key);
    if (!on() || !hasG() || !G.player) return false;
    const g = ghostOf(key, opts && opts.source);
    return g ? startPlay(g, key, false) : false;
  }
  function stopPlay() { pb = null; }
  function pbPose(P) {
    // position of the replay at time t: interpolated between ticks; map-aware
    const g = P.g, n = g.n;
    let i = Math.floor(P.t / B.TICK); if (i >= n - 1) i = n - 1;
    const f = i >= n - 1 ? 0 : (P.t / B.TICK) - i;
    const j = Math.min(n - 1, i + 1), same = g.M[i] === g.M[j];
    const q = B.POS_Q, x = (g.X[i] + (same ? (g.X[j] - g.X[i]) * f : 0)) / q, y = (g.Y[i] + (same ? (g.Y[j] - g.Y[i]) * f : 0)) / q;
    let dd = ((g.D[j] - g.D[i] + 96) & 63) - 32; if (!same) dd = 0;
    const dir = ((g.D[i] + dd * f) / B.DIR_Q) * Math.PI * 2;
    const stride = g.cum[i] + (same ? (g.cum[j] - g.cum[i]) * f : 0);
    const spd = same && j !== i ? Math.hypot(g.X[j] - g.X[i], g.Y[j] - g.Y[i]) / q / B.TICK : 0;
    const act = g.A[i], ap = act ? clamp((i - g.runS[i] + f) / Math.max(3, g.runL[i]), 0, 1) : 0;
    return { i, x, y, dir, stride, spd, act, ap, map: g.maps[g.M[i]], start: act && i === g.runS[i] };
  }
  function stepPlay(dt) {
    const P = pb; if (!P) return;
    const end = P.g.n * B.TICK;
    P.t += dt;
    const fin = reduced() ? 0.2 : B.FADE_IN;
    if (P.t < end + B.HOLD) P.vis = Math.min(1, P.vis + dt / fin);
    else { P.ended += dt; P.vis = Math.max(0, 1 - P.ended / B.FADE_OUT); if (P.vis <= 0) { pb = null; return; } }
    if (cfg.echo) echoCheck(P);
  }
  function stopAllPlay() { pb = null; }
  function shutdown() { recs.auto = null; recs.manual = null; fight = null; pb = null; }

  // ---------------------------------------------------------------- the faint echo (off by default)
  function echoCheck(P) {
    try {
      const s = pbPose(P); if (!s.start || P.lastRun === s.i) return; P.lastRun = s.i;
      if (s.map !== mapIdNow()) return;
      const c = Engine.cam, d = Math.hypot(s.x - c.x, s.y - c.y); if (d > B.ECHO_RANGE) return;
      if (typeof Audio_ === 'undefined' || !Audio_.ctx || !Audio_.sfxBus || Audio_.muted) return;
      const ctx = Audio_.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
      o.type = 'sine'; o.frequency.value = [0, 330, 311, 294, 349, 392, 220, 262, 0, 0][s.act] || 300;
      fl.type = 'lowpass'; fl.frequency.value = 900;
      const amp = B.ECHO_GAIN * (1 - d / (B.ECHO_RANGE + 1));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(fl); fl.connect(g); g.connect(Audio_.sfxBus); o.start(t); o.stop(t + 0.6);
    } catch (e) { /* a sound is never worth an error */ }
  }

  // ================================================================ THE FIGURE (procedural stand-in art)
  // A translucent echo in the player's likeness: a pale-blue figure of real human build (shoulders, arms held clear of the
  // body, legs apart in stride, a head with hood, hair, cap or helm) painted on a 40x96 grid whose height is one tile, the
  // same height a standing NPC sprite takes. Body parts are painted in depth order as flat tones with an ink line where a
  // nearer part crosses a farther one, shaded from the upper left, and ringed with a slightly brighter rim so the shape
  // holds against fog and grass. 5 views (front .. back, mirrored for the left side) x locomotion x action; the painter is
  // a pure function of its arguments (no random) and its frames are cached.
  const FW = 40, FH = 96, K = 1.6, CX = 20, FOOT = 93;   // K: pixels per body unit (a body is about 57 units tall)
  const TONE = { OUT: 1, DEEP: 2, SHADE: 3, BASE: 4, LIGHT: 5, ACC: 6, ACCS: 7, DARK: 8, GLINT: 9, HAIR: 10, HAIRS: 11, SKIN: 12, SKINS: 13, INK: 14, ACCL: 15, HAIRL: 16 };
  // class accents, folded well toward the ghost's blue: blade amber, cantor lilac, corsair sea, archivist green, penitent ash, quarry ochre
  const CLS_ACC = [[238, 214, 150], [208, 192, 240], [160, 226, 216], [190, 232, 182], [206, 208, 216], [232, 200, 150]];
  const HAIR_FACE = { 1: [92, 100, 118], 2: [240, 178, 150], 3: [226, 232, 240], 4: [60, 68, 92], 5: [0, 0, 0], 6: [244, 248, 255] };
  const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  const GH_BASE = [178, 206, 236];
  function palette(look) {
    const acc = mix(CLS_ACC[look.cls] || [198, 220, 240], GH_BASE, 0.6), hair = mix(HAIR_FACE[look.face] || [200, 210, 224], GH_BASE, 0.5);
    const p = [];
    p[TONE.OUT] = [222, 240, 255, 236];                       // the rim: a little brighter than anything inside it
    p[TONE.INK] = [64, 92, 136, 215];                          // where a nearer part crosses a farther one
    p[TONE.DEEP] = [92, 122, 166, 200]; p[TONE.SHADE] = [140, 172, 212, 178]; p[TONE.BASE] = [180, 208, 238, 166]; p[TONE.LIGHT] = [214, 234, 255, 178];
    p[TONE.ACC] = [...acc, 170]; p[TONE.ACCS] = [...mix(acc, [84, 112, 156], 0.42), 182]; p[TONE.ACCL] = [...mix(acc, [236, 246, 255], 0.4), 176];
    p[TONE.DARK] = [36, 52, 86, 230]; p[TONE.GLINT] = [248, 252, 255, 230];
    p[TONE.HAIR] = [...hair, 178]; p[TONE.HAIRS] = [...mix(hair, [72, 98, 140], 0.4), 188]; p[TONE.HAIRL] = [...mix(hair, [236, 246, 255], 0.4), 180];
    p[TONE.SKIN] = [222, 236, 252, 182]; p[TONE.SKINS] = [168, 194, 226, 180];
    return p;
  }
  // light (upper left) and shade (lower right) of each body tone; the others (blades, ink, eyes) are left as painted
  const LIT = { [TONE.BASE]: TONE.LIGHT, [TONE.SHADE]: TONE.BASE, [TONE.ACC]: TONE.ACCL, [TONE.ACCS]: TONE.ACC, [TONE.HAIR]: TONE.HAIRL, [TONE.HAIRS]: TONE.HAIR, [TONE.SKIN]: TONE.SKIN, [TONE.SKINS]: TONE.SKIN };
  const SHD = { [TONE.BASE]: TONE.SHADE, [TONE.SHADE]: TONE.DEEP, [TONE.ACC]: TONE.ACCS, [TONE.ACCS]: TONE.DEEP, [TONE.ACCL]: TONE.ACC, [TONE.HAIR]: TONE.HAIRS, [TONE.HAIRL]: TONE.HAIR, [TONE.SKIN]: TONE.SKINS, [TONE.LIGHT]: TONE.BASE };
  function paintFigure(b, loco, act, ap, look) {   // ap: the action phase 0-3
    const N = FW * FH, c = new Uint8Array(N), id = new Uint16Array(N);
    let pid = 0;
    const put = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < FW && y >= 0 && y < FH) { c[y * FW + x] = v; id[y * FW + x] = pid; } };
    const psi = b * Math.PI / 4, u = Math.cos(psi), sn = Math.sin(psi), au = Math.abs(u), as = Math.abs(sn);
    // body units (forward, right, up) to grid pixels; nearer the camera sits a little lower (a slight top-down view)
    const P = (f, r, z) => [CX + K * (f * sn - r * u), FOOT - K * (z - 0.3 * (f * u + r * sn))];
    const dep = (f, r) => f * u + r * sn;                       // toward the camera
    const span = (y, x0, x1, v) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) put(x, y, v); };
    const ell = (cx, cy, rx, ry, v) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x - cx) / (rx + 0.01), dy = (y - cy) / (ry + 0.01); if (dx * dx + dy * dy <= 1) put(x, y, v); } };
    // a tapered capsule between two points (pixels), radii in body units
    const limb = (a, bb, r0, r1, v) => {
      const R0 = r0 * K, R1 = r1 * K, x0 = Math.floor(Math.min(a[0], bb[0]) - Math.max(R0, R1) - 1), x1 = Math.ceil(Math.max(a[0], bb[0]) + Math.max(R0, R1) + 1);
      const y0 = Math.floor(Math.min(a[1], bb[1]) - Math.max(R0, R1) - 1), y1 = Math.ceil(Math.max(a[1], bb[1]) + Math.max(R0, R1) + 1);
      const vx = bb[0] - a[0], vy = bb[1] - a[1], L2 = vx * vx + vy * vy || 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / L2, 0, 1), dx = x - (a[0] + vx * t), dy = y - (a[1] + vy * t), R = R0 + (R1 - R0) * t;
        if (dx * dx + dy * dy <= R * R + 0.15) put(x, y, v);
      }
    };
    const stamp = (x, y, w, v) => { const h = Math.floor(w / 2); for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) put(x - h + i, y - h + j, v); };
    const line = (x0, y0, x1, y1, w, v) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let k = 0; k <= n; k++) { const t = k / n; stamp(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, v); } };
    // a body section: rows from z0 up to z1 with a half-width (front, side) that is a function of z
    const section = (z0, z1, fAt, hwAt, toneAt) => {
      for (let z = z0; z <= z1 + 1e-6; z += 0.3) {
        const c0 = P(fAt(z), 0, z), h = hwAt(z), hw = h[0] * au + h[1] * as;
        span(Math.round(c0[1]), c0[0] - hw * K, c0[0] + hw * K, toneAt(z));
      }
    };
    const arm = look.arm, headK = arm & 3, bodyK = (arm >> 2) & 3, shield = !!(arm & 16), gloves = !!(arm & 32);
    const robe = look.cls === 1 || look.cls === 3 || look.cls === 4;
    const plate = bodyK === 2, glassOff = look.cls === 0, W = look.wpn;
    const lean = act === 8 ? -2.4 : 0, up = act === 7 ? 1.2 : 0;
    const st = loco === 0 ? 0 : loco === 1 ? 1 : -1;           // which leg leads
    const face = look.face, hooded = face === 1 || face === 4 || headK === 2, helm = headK === 3, cap = headK === 1;

    // -- poses: hand positions in the ghost's frame (forward, right, up) --------------------------------------------
    const swing = st * 2.6;
    const armR = look.snug ? 8.0 : 9.6;                         // look.snug (Phase 19's solid travellers): arms hang closer
    let offH = [(st ? 0.4 : 1.4) + swing, -armR, 25.5], wH = [(st ? 0.4 : -0.4) - swing, armR, 25.5], wV = (W === 4 || W === 5 || W === 6) ? [0.35, 0.1, 0.93] : [0.5, 0.12, -0.86], blockSh = false;   // at rest a blade hangs point-down, a haft stands
    const KF = { // [hand0, dir0, hand1, dir1]
      1: [[0.4, 8.4, 46], [0.2, 0.9, 0.7], [3.0, -1.7, 35], [0.7, -0.8, -0.3]],
      2: [[0.5, 1.7, 46], [0.4, -0.8, 0.8], [3.0, 9.5, 35], [0.6, 0.9, -0.3]],
      3: [[0.2, 6.2, 55], [0.1, 0, 1], [3.4, 3.9, 37], [0.95, 0, -0.45]],
      4: [[2.4, 5.0, 28], [0.9, 0, -0.5], [1.7, 5.0, 49], [0.3, 0, 1]],
      5: [[0.2, 6.2, 38], [1, 0, 0.1], [5.2, 3.9, 38.5], [1, 0, 0.05]],
    };
    const ph = ap | 0;                                         // action phase 0 wind-up, 1 swing, 2 strike, 3 follow-through
    let arcA = null;
    if (act >= 1 && act <= 5) {
      const k = KF[act], t = [0, 0.5, 1, 1.12][ph];
      wH = [0, 1, 2].map((i) => k[0][i] + (k[2][i] - k[0][i]) * t); wV = [0, 1, 2].map((i) => k[1][i] + (k[3][i] - k[1][i]) * t);
      if (ph === 1 || ph === 2) arcA = k;
      offH = [1.2, -8.2, 30];
    } else if (act === 6) { wH = [ph === 2 ? 4.2 : 5.2, 3.6, 42]; wV = [1, 0, 0.02]; offH = [4.2, -1.4, 41]; }
    else if (act === 7) { wH = [1.4, 8.6, 53 + up]; wV = [0, 0.4, 1]; offH = [1.4, -8.6, 53 + up]; }
    else if (act === 8) { wH = [-1.5, 9.2, 37]; wV = [-0.4, 0.3, 0.7]; offH = [-1.5, -9.2, 37]; }
    else if (act === 9) { wH = [4.0, 3.0, 39]; wV = [0.15, 0, 1]; offH = [3.8, -3.2, 37]; blockSh = shield; }
    const SH = 6.4, SZ = 43;                                   // shoulder joints: half-width and height
    const shW = [lean * 0.4, SH, SZ], shO = [lean * 0.4, -SH, SZ];

    // -- parts ------------------------------------------------------------------------------------------------------
    const legTone = plate ? TONE.SHADE : TONE.SHADE, bootTone = TONE.DEEP;
    const leg = (side) => {
      // side +1 the right leg. Standing: feet a little apart. Walking: one leg leads, the trailing heel lifts.
      const lead = st * side, ff = st ? lead * 3.4 : side * 0.9, fr = side * (st ? 2.7 : 3.3);   // standing: a slight stagger so a profile shows both legs
      const hip = [lean * 0.4, side * 2.5, 27.5], ank = [ff, fr, st && lead < 0 ? 2.6 : 1.6];
      const knee = [(hip[0] + ank[0]) / 2 + (st ? 1.0 : 0.3) + (lead < 0 ? 0.6 : 0), side * (st ? 2.6 : 2.9), 14.5];
      limb(P(...hip), P(...knee), 2.25, 1.75, legTone);
      limb(P(...knee), P(...ank), 1.75, 1.3, legTone);
      const toe = [ank[0] + 2.5, ank[1], st && lead < 0 ? 0.7 : 0.6], heel = [ank[0] - 0.6, ank[1], st && lead < 0 ? 2.4 : 0.6];
      limb(P(...heel), P(...toe), 1.15, 1.0, bootTone);
      limb(P(ank[0], ank[1], ank[2] + 1.6), P(...ank), 1.45, 1.4, bootTone);
    };
    const handDot = (h, tone) => { const p = P(...h); ell(p[0], p[1], 1.25 * K, 1.25 * K, tone); };
    const armPart = (sh, hand, sleeve, glass) => {
      const side = Math.sign(sh[1]) || 1, mid = [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2, (sh[2] + hand[2]) / 2];
      const reach = Math.hypot(hand[0] - sh[0], hand[1] - sh[1], hand[2] - sh[2]), bend = clamp((19 - reach) * 0.25, 0, 2.2);
      const elbow = [mid[0] - bend * 0.6, mid[1] + side * bend * 0.5, mid[2] - bend * 0.4];
      const tone = glass ? TONE.ACC : sleeve;
      limb(P(...sh), P(...elbow), 1.8, 1.45, tone);
      limb(P(...elbow), P(...hand), 1.45, 1.2, gloves ? TONE.DEEP : tone);
      if (glass) { const a = P(...elbow), h = P(...hand); line(a[0], a[1], h[0], h[1], 1, TONE.GLINT); }
    };
    const sleeve = plate ? TONE.SHADE : robe ? TONE.ACC : TONE.BASE;
    const wpt = (h) => [h[0] + lean * 0.3, h[1], h[2]];
    const offArm = () => {
      const h = wpt(offH);
      armPart(shO, h, sleeve, glassOff);
      handDot(h, glassOff ? TONE.LIGHT : gloves ? TONE.DEEP : TONE.SKIN);
      if (shield || blockSh) { const s = P(offH[0] + 1.3, offH[1] - 0.6, offH[2] + (blockSh ? 3 : 0)); ell(s[0], s[1], (3.0 * (0.45 + 0.55 * au) + 1.5 * as) * K, 4.6 * K, TONE.SHADE); ell(s[0], s[1], (1.7 * (0.45 + 0.55 * au) + 0.8 * as) * K, 3.0 * K, TONE.LIGHT); stamp(s[0], s[1], 2, TONE.ACC); }
    };
    const weapon = () => {
      const h = P(...wpt(wH));
      const L = { 1: 14, 2: 8, 3: 19, 4: 13, 5: 11, 6: 27, 7: 6, 8: 8, 9: 9, 0: 0 }[W] || 12;
      const tip = P(wH[0] + wV[0] * L + lean * 0.3, wH[1] + wV[1] * L, wH[2] + wV[2] * L);
      if (W === 7) { line(h[0], h[1], h[0] + (tip[0] - h[0]) * 0.8, h[1] + (tip[1] - h[1]) * 0.8, 3, TONE.DEEP); stamp(h[0], h[1] + 2, 3, TONE.DARK); if (act === 6 && ph !== 3) stamp(tip[0] + 1, tip[1], 4, TONE.LIGHT); }
      else if (W === 8) { line(h[0] - 1, h[1], tip[0], tip[1], 3, TONE.DEEP); const pp = P(wH[0] + wV[0] * 5, wH[1] + wV[1] * 5 + 4, wH[2] + wV[2] * 5), qq = P(wH[0] + wV[0] * 5, wH[1] + wV[1] * 5 - 4, wH[2] + wV[2] * 5); line(pp[0], pp[1], qq[0], qq[1], 2, TONE.LIGHT); }
      else if (W === 9) { line(h[0], h[1], tip[0], tip[1], 3, TONE.ACC); line(h[0], h[1], tip[0], tip[1], 1, TONE.GLINT); }
      else if (W !== 0) {
        const haft = W === 4 || W === 5 || W === 6;
        if (haft) line(h[0], h[1], tip[0], tip[1], 2, TONE.DEEP);
        else { line(h[0], h[1], tip[0], tip[1], 3, TONE.LIGHT); line(h[0], h[1], tip[0], tip[1], 1, TONE.GLINT); }
        if (!haft) { const g0 = P(wH[0] + wV[0] * 2.5, wH[1] + wV[1] * 2.5 + 2.4, wH[2] + wV[2] * 2.5), g1 = P(wH[0] + wV[0] * 2.5, wH[1] + wV[1] * 2.5 - 2.4, wH[2] + wV[2] * 2.5); line(g0[0], g0[1], g1[0], g1[1], 2, TONE.DEEP); }
        if (W === 4) { ell(tip[0], tip[1] + 1, 2.6 * K, 2.4 * K, TONE.LIGHT); ell(tip[0] - 1, tip[1] + 1, 1.4 * K, 1.4 * K, TONE.GLINT); }
        if (W === 5) { ell(tip[0], tip[1], 2.4 * K, 2.4 * K, TONE.SHADE); ell(tip[0] - 1, tip[1] - 1, 1.2 * K, 1.2 * K, TONE.LIGHT); }
        if (W === 6) stamp(tip[0], tip[1], 3, TONE.GLINT);
      }
    };
    const weaponArm = () => {
      const h = wpt(wH), glassW = W === 9;
      armPart(shW, h, sleeve, glassW);
      pid++; weapon(); pid++;
      handDot(h, glassW ? TONE.LIGHT : gloves ? TONE.DEEP : TONE.SKIN);
    };
    const drawArc = () => {                                    // a few pale pixels along the swept path
      if (!arcA) return;
      const k = arcA, L = { 1: 14, 2: 8, 3: 19, 4: 13, 5: 11, 6: 22, 7: 0, 8: 0, 9: 0, 0: 6 }[W] || 12, n = ph === 1 ? 4 : 7;
      if (act === 5) { const a0 = P(wH[0] + 2, wH[1], wH[2]), a1 = P(wH[0] + 7, wH[1], wH[2]); line(a0[0] + 1, a0[1], a1[0] + 2, a1[1], 1, TONE.GLINT); return; }
      for (let i = 0; i <= n; i++) {
        const t = i / 7, h = [0, 1, 2].map((q) => k[0][q] + (k[2][q] - k[0][q]) * t), v = [0, 1, 2].map((q) => k[1][q] + (k[3][q] - k[1][q]) * t);
        const pt = P(h[0] + v[0] * L, h[1] + v[1] * L, h[2] + v[2] * L);
        stamp(pt[0], pt[1], 2, i % 2 ? TONE.LIGHT : TONE.GLINT);
      }
    };
    const cloak = () => {                                      // a short cape behind the back, to the backs of the knees
      const z0 = robe ? 12 : 17;
      section(z0, 44.5, (z) => -2.6 - (44 - z) * 0.03 + lean * (z / 44), (z) => { const k = (44.5 - z) / (44.5 - z0); return [4.9 + 1.4 * k, 1.2]; }, (z) => (z < z0 + 2 ? TONE.ACCS : TONE.ACC));
    };
    const torso = () => {
      const fAt = (z) => lean * (z - 26) / 17;
      // chest to hips: broad at the shoulders, in at the waist
      const hwR = (z) => (z >= 43 ? 6.5 - (z - 43) * 0.55 : z >= 36 ? 5.5 + (z - 36) * 0.143 : z >= 30 ? 4.5 + (z - 30) * 0.167 : 4.7 - (z - 26) * 0.05);
      const hdR = (z) => (z >= 36 ? 3.8 : 3.3);
      const body = plate ? TONE.LIGHT : robe ? TONE.ACC : TONE.BASE;
      section(26, 45, fAt, (z) => [hwR(z), hdR(z)], (z) => (plate && Math.round(z * 2) % 7 === 0 ? TONE.SHADE : (!robe && !plate && z >= 41.5) ? TONE.ACC : body));
      if (robe) {
        // a skirt that flares to the shins; the stride swings the hem
        section(5.5, 26, (z) => (st ? st * (26 - z) * 0.05 : 0), (z) => { const k = (26 - z) / 20.5; return [4.7 + 2.9 * k, 3.0 + 1.6 * k]; }, (z) => (plate ? (Math.round(z) % 4 ? TONE.SHADE : TONE.DEEP) : z < 7 ? TONE.ACCS : TONE.ACC));
        if (au > 0.3) { const a = P(0.5, 0, 24), bt = P(0.5 + st * 1, 0, 7); line(a[0], a[1], bt[0], bt[1], 1, TONE.ACCS); }
      } else {
        // a short coat hem over the tops of the thighs
        section(21, 26, fAt, (z) => [4.9 + (26 - z) * 0.08, 3.1], () => (plate ? TONE.SHADE : TONE.BASE));
      }
      // belt and buckle
      section(25.6, 27, () => 0, () => [4.75, 3.0], (z) => (z < 26.3 ? TONE.DARK : TONE.ACCS));
      if (u > 0.3) { const bk = P(3.2, 0, 26.3); put(bk[0], bk[1], TONE.LIGHT); }
      // neck
      limb(P(lean * 0.45, 0, 44.5), P(lean * 0.45, 0, 47.5), 1.35, 1.35, TONE.SKINS);
      if (face === 5) section(43.5, 45, () => lean * 0.45, () => [4.0, 2.8], (z) => (z < 44.2 ? TONE.SHADE : TONE.LIGHT));
    };
    const head = () => {
      const cz = 51.3 + up * 0.6, hc = P(0.3 + lean * 0.5, 0, cz), hx = hc[0], hy = hc[1];
      const rx = 3.3 * au + 3.6 * as, ry = 4.2;
      if (hooded && !helm) {
        // the cowl: round the head, the face in its opening, falling onto the shoulders
        const ht = face === 4 ? TONE.ACCS : TONE.ACC;
        section(43.5, 47.5, () => -0.8, (z) => [5.8 - (z - 43.5) * 0.5, 3.8], () => ht);
        ell(hx - sn * 0.9 * K, hy - 0.6 * K, (rx + 1.5) * K, (ry + 1.6) * K, ht);
        if (u > -0.35) { const fc = P(1.5 + lean * 0.5, 0, cz - 0.8), frx = Math.max(1.6, 2.7 * au + 1.7 * as) * K; ell(fc[0] + sn * 0.5 * K, fc[1], frx + 0.45 * K, 3.9 * K, TONE.ACCS); ell(fc[0] + sn * 0.7 * K, fc[1] + 0.3 * K, frx, 3.4 * K, TONE.SKIN); }
      } else if (!helm) {
        if (face !== 5) {
          if (u < -0.2 && (face === 2 || face === 6)) section(37.5, 50, () => -1.2, (z) => [3.6 + (50 - z) * 0.03, 2.4], () => TONE.HAIR);
          ell(hx - sn * 0.5 * K, hy - 0.5 * K, (rx + 0.6) * K, (ry + 0.6) * K, TONE.HAIR);
        } else ell(hx, hy, rx * K, ry * K, TONE.SKIN);
        if (u > -0.35) { const fc = P(1.4 + lean * 0.5, 0, cz - 0.9); ell(fc[0] + sn * 0.5 * K, fc[1] + 0.2 * K, Math.max(1.7, 2.9 * au + 2.5 * as) * K, 3.6 * K, TONE.SKIN); }
      } else ell(hx, hy, rx * K, ry * K, TONE.SKIN);
      // the face (not seen from behind)
      if (u > -0.35) {
        if (u > 0.25) { for (const s of [-1, 1]) { const e = P(3.0, s * 1.35, cz - 0.4); put(e[0], e[1], TONE.DARK); } }
        else { const e = P(3.1, 1.4, cz - 0.4); put(e[0] + (sn > 0 ? 1.5 : -1.5), e[1], TONE.DARK); }
        if (act === 7 || act === 8) { const m = P(3.2, 0, cz - 2.8); put(m[0], m[1], TONE.DARK); put(m[0] + (u > 0.25 ? 1 : sn > 0 ? 1 : -1), m[1], TONE.DARK); }
        if (face === 5) { const s0 = P(3.0, 1.8, cz + 0.8), s1 = P(3.0, 2.4, cz - 2.0); line(s0[0], s0[1], s1[0], s1[1], 1, TONE.SKINS); }
        if (face === 3) { const bd = P(1.8 + lean * 0.5, 0, cz - 3.4); ell(bd[0] + sn * 0.8 * K, bd[1], Math.max(1.6, 2.6 * au + 1.8 * as) * K, 2.2 * K, TONE.LIGHT); }
      }
      if ((face === 2 || face === 6) && !hooded && !helm && u > -0.2) {
        for (const side of [-1, 1]) {
          if (as > 0.9 && side * sn < 0) continue;              // in profile only the near lock shows
          const a = P(-0.4, side * (3.6 * au + 0.6), cz - 1), z2 = P(-0.6 + lean * 0.3, side * (4.3 * au + 0.8), face === 2 ? 34 : 38);
          limb(a, z2, 1.1, 0.8, TONE.HAIR);
        }
      }
      if (cap || (face === 3 && !helm && !hooded)) {
        const cc = P(0, 0, cz + 2.8); ell(cc[0] - sn * 0.4 * K, cc[1], (rx + 0.8) * K, 2.6 * K, face === 3 ? TONE.DEEP : TONE.SHADE);
        const br = P(2.2, 0, cz + 0.9), bw = (3.8 * au + 4.4 * as) * K; span(Math.round(br[1]), br[0] - bw, br[0] + bw + (sn > 0 ? 2 : 0), TONE.DARK); span(Math.round(br[1]) + 1, br[0] - bw + 1, br[0] + bw + (sn > 0 ? 1 : 0), TONE.DARK);
        if (face === 3 && u > 0.3) stamp(cc[0], cc[1] - 1, 2, TONE.GLINT);
      }
      if (helm) {
        const hm = P(0, 0, cz + 1.4); ell(hm[0] - sn * 0.3 * K, hm[1], (rx + 1.2) * K, 4.6 * K, TONE.SHADE); ell(hm[0] - sn * 0.5 * K - 2, hm[1] - 2.5, (rx - 0.4) * K, 2.8 * K, TONE.LIGHT);
        const br = P(0.8, 0, cz - 1.9), bw = (5.4 * au + 4.8 * as) * K; span(Math.round(br[1]), br[0] - bw, br[0] + bw, TONE.DEEP); span(Math.round(br[1]) + 1, br[0] - bw, br[0] + bw, TONE.DEEP);
        if (u > -0.35) { for (const s of (u > 0.25 ? [-1, 1] : [1])) { const e = P(3.0, s * 1.35, cz - 2.9); put(e[0] + (u > 0.25 ? 0 : sn > 0 ? 1.5 : -1.5), e[1], TONE.DARK); } }
        if (u > 0.3) { const nasal = P(3.4, 0, cz - 1.6); for (let i = 0; i < 5; i++) put(nasal[0], nasal[1] + i, TONE.SHADE); }
      }
    };

    // -- compose in depth order (farthest first) ---------------------------------------------------------------------
    const parts = [];
    if (u < 0.8) parts.push([u < -0.2 ? 2 : -3, cloak]);
    parts.push([-1.5 + 0.08 * dep(st * 3.4, -2.8), () => leg(-1)], [-1.5 + 0.08 * dep(-st * 3.4, 2.8), () => leg(1)]);
    parts.push([0, torso], [u < -0.2 ? 2.5 : 0.5, head]);
    parts.push([0.4 * dep(offH[0] - 0.4, -SH), offArm], [0.4 * dep(wH[0] - 0.4, SH) + 0.01, () => { weaponArm(); pid++; drawArc(); }]);
    parts.sort((p1, p2) => p1[0] - p2[0]);
    for (const p of parts) { pid++; p[1](); }
    pid++;
    // song: the notes above the head (a fixed pattern: a sung note, a little higher)
    if (act === 7) { const n0 = P(0, 0, 57); const nx = Math.round(n0[0] + 8), ny = Math.max(1, Math.round(n0[1])); for (const [dx, dy] of [[0, 3], [1, 3], [0, 4], [1, 4], [1, 2], [1, 1], [1, 0], [2, 0], [3, 1]]) put(nx + dx, ny + dy, dy === 0 || dx === 3 ? TONE.GLINT : TONE.LIGHT); }

    // -- ink where a nearer part crosses a farther one; shading from the upper left; then the rim ---------------------
    const at = (x, y) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : c[y * FW + x]);
    const idAt = (x, y) => (x < 0 || y < 0 || x >= FW || y >= FH ? 0 : id[y * FW + x]);
    const sh = new Uint8Array(c);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x, v = c[i]; if (!v || (LIT[v] == null && SHD[v] == null)) continue;
      const me = id[i];
      const lower = (xx, yy) => { const o = idAt(xx, yy); return o && o < me && at(xx, yy); };
      if (lower(x - 1, y) || lower(x + 1, y) || lower(x, y - 1) || lower(x, y + 1)) { sh[i] = TONE.INK; continue; }
      if ((!at(x - 1, y) || !at(x, y - 1)) && LIT[v] != null) sh[i] = LIT[v];
      else if ((!at(x + 1, y) || !at(x, y + 1) || !at(x + 2, y)) && SHD[v] != null) sh[i] = SHD[v];
    }
    const out = new Uint8Array(sh);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      if (sh[y * FW + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) out[y * FW + x] = TONE.OUT;
    }
    return out;
  }
  const figCache = new Map();
  // a frame as { w, h, data: Uint32Array (ABGR), hs, cx }
  function figureFrame(b, loco, act, ap, look) {
    // Phase 21: the ghost is the character card's likeness made pale (CARD21), when that module is loaded and on
    const c21 = typeof CARD21 === 'object' && CARD21 && CARD21.on && CARD21.on() && typeof CARD21.ghostFrame === 'function';
    const k = [b, loco, act, ap, look.cls, look.face, look.wpn, look.arm, c21 ? 'c21:' + CARD21.sig(CARD21.lookFor(look)) : ''].join(',');
    let f = figCache.get(k); if (f) return f;
    let kOld = k;
    if (c21) {
      // CARD21 paints new poses in slices (never on the spot) and offers the nearest it has; with none yet, the
      // Phase 18 figure below stands in under its own key until the likeness is ready
      try {
        const r = CARD21.ghostFrame(b, loco, act, ap, look, { now: false });
        if (r) { const kk = r.exact ? k : 'near|' + r.key; f = figCache.get(kk); if (f) return f; if (figCache.size > 360) figCache.delete(figCache.keys().next().value); figCache.set(kk, r); return r; }
      } catch (e) { /* the Phase 18 painter below */ }
      kOld = 'fb|' + [b, loco, act, ap, look.cls, look.face, look.wpn, look.arm].join(',');
      f = figCache.get(kOld); if (f) return f;
    }
    const tones = paintFigure(b, loco, act, ap, look), pal = palette(look), data = new Uint32Array(FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const t = tones[y * FW + x]; if (!t) continue;
      const q = pal[t]; if (!q) continue;
      // the feet thin into the ground a little (never away: a figure without feet reads as a post)
      const fade = y > FOOT - 9 ? clamp(1 - 0.45 * (y - (FOOT - 9)) / 10, 0.55, 1) : 1;
      const a = Math.round(q[3] * fade); if (a < 8) continue;
      data[y * FW + x] = ((a << 24) | (q[2] << 16) | (q[1] << 8) | q[0]) >>> 0;
    }
    // each column's painted rows, so the draw loop never walks the empty air above and below the figure
    const top = new Int16Array(FW).fill(FH), bot = new Int16Array(FW).fill(-1);
    for (let x = 0; x < FW; x++) for (let y = 0; y < FH; y++) if (data[y * FW + x]) { if (top[x] === FH) top[x] = y; bot[x] = y; }
    f = { w: FW, h: FH, data, top, bot };
    if (figCache.size > 360) figCache.delete(figCache.keys().next().value);
    figCache.set(kOld, f);
    return f;
  }
  // the view and frame for a ghost seen from the camera: returns { b, mirror }
  function viewOf(gdir, cdir) {
    const fx = Math.cos(gdir), fy = Math.sin(gdir), Fx = Math.cos(cdir), Fy = Math.sin(cdir);
    const u = -(fx * Fx + fy * Fy), s = fx * -Fy + fy * Fx;            // front-ness, and facing to the screen's right (+) or left (-)
    const ang = Math.atan2(s, u);
    let b = Math.round(ang / (Math.PI / 4));
    const mirror = b < 0; b = Math.abs(b); if (b > 4) b = 4;
    return { b, mirror };
  }
  function frameFor(look, s, cdir) {
    const v = viewOf(s.dir, cdir);
    const loco = s.spd < B.WALK ? 0 : 1 + (Math.floor(s.stride / B.STRIDE) & 1);
    const ph = s.act ? Math.min(3, Math.floor(s.ap * 4)) : 0;
    return { fr: figureFrame(v.b, loco, s.act, ph, look), mirror: v.mirror };
  }

  // ---------------------------------------------------------------- the draw hook
  function ghostAlpha(dist, fogDist, vis) {
    const near = smooth(B.NEAR[0], B.NEAR[1], dist), far = 1 - smooth(B.FAR[0] * fogDist, B.FAR[1] * fogDist, dist);
    return B.ALPHA_MAX * near * far * vis;
  }
  const stats = { drawn: 0, last: null, ms: 0 };
  function drawHook(F) {
    stats.drawn = 0;
    const P = pb; if (!P || !on() || !hasG() || P.vis <= 0) return;
    const s = pbPose(P); if (!F.map || s.map !== F.map.id) return;
    const cam = F.cam, w = F.w, h = F.h, S = F.S || 1, fb = F.fb, dbuf = F.dbuf, mbuf = F.mbuf;
    const dx = s.x - cam.x, dy = s.y - cam.y, d = Math.hypot(dx, dy);
    const al = ghostAlpha(d, F.fogDist || 12, P.vis); if (al < 0.02) return;
    const invDet = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const trX = invDet * (F.dirY * dx - F.dirX * dy), trY = invDet * (-F.planeY * dx + F.planeX * dy);
    if (trY <= 0.08) return;
    const { fr, mirror } = frameFor(P.g.look, s, Math.atan2(F.dirY, F.dirX));
    const screenX = ((w / 2) * (1 + trX / trY)) | 0;
    const sprH = Math.abs(h / trY) | 0; if (sprH < 3) return;
    const sprW = Math.max(1, (sprH * fr.w / fr.h) | 0);
    const map = F.map, scx = Math.min(map.w - 1, Math.max(0, s.x | 0)), scy = Math.min(map.h - 1, Math.max(0, s.y | 0));
    const floor = (map.lvls || map.smooth) && F.gAt ? F.gAt(s.x, s.y, scx, scy) : 0;
    const baseline = F.horizon + (((cam.z - floor) * h / trY) | 0), dsY = baseline - sprH, dsX = screenX - ((0.5 * sprW) | 0);
    const xs = Math.max(0, dsX), xe = Math.min(w - 1, dsX + sprW - 1), ys = Math.max(0, dsY), ye = Math.min(h - 1, baseline - 1);
    if (xe < xs || ye < ys) return;
    const data = fr.data, tw = fr.w, th = fr.h, k255 = al / 255;
    let drawn = 0;
    for (let x = xs; x <= xe; x++) {
      let tx = (((x - dsX) * tw) / sprW) | 0; if (tx < 0 || tx >= tw) continue; if (mirror) tx = tw - 1 - tx;
      const t0 = fr.top ? fr.top[tx] : 0, t1 = fr.bot ? fr.bot[tx] : th - 1; if (t1 < t0) continue;
      const y0 = Math.max(ys, dsY + ((t0 * sprH / th) | 0) - 1), y1 = Math.min(ye, dsY + Math.ceil((t1 + 1) * sprH / th));
      let o = y0 * w + x;
      for (let y = y0; y <= y1; y++, o += w) {
        if (dbuf[o] < trY - 0.02) continue;                          // a wall or body in front
        const ty = (((y - dsY) * th) / sprH) | 0;
        const px = data[ty * tw + tx]; if (!px) continue;
        const a = (px >>> 24) * k255; if (a < 0.02) continue;
        const f0 = fb[o], r0 = f0 & 255, g0 = (f0 >>> 8) & 255, b0 = (f0 >>> 16) & 255;
        const r = r0 + ((px & 255) - r0) * a, g = g0 + (((px >>> 8) & 255) - g0) * a, bl = b0 + (((px >>> 16) & 255) - b0) * a;
        fb[o] = (0xff000000 | (bl << 16) | (g << 8) | r) >>> 0;
        if (a > 0.3) { dbuf[o] = trY; mbuf[o] = 6; }
        drawn++;
      }
    }
    stats.drawn = drawn; stats.last = { x: s.x, y: s.y, dist: d, alpha: al, act: s.act, b: 0 };
  }

  // ================================================================ PANELS (manage + watch)
  let ui = null;
  function closeUi() {
    if (!ui) return;
    const u = ui; ui = null;
    cancelAnimationFrame(u.raf); window.removeEventListener('keydown', u.onKey, true);
    if (hasG() && G.panelToken === u.token && G.openPanel === 'p18g') { try { closeModal(); } catch (e) { /* closed */ } }
    if (hasG() && G.state === 'panel' && !G.openPanel) G.state = 'play';
    try { G.keys = {}; } catch (e) { /* none */ }
  }
  function padNow() {
    try { const ps = navigator.getGamepads ? navigator.getGamepads() : null; if (ps) for (const g of ps) if (g && g.connected !== false) return g; } catch (e) { /* no pad */ }
    return null;
  }
  function openPanelShell(html) {
    if (!hasG() || !G.player) return null;
    closeUi();
    if (G.state === 'play') G.state = 'panel';
    openModal(html, 'p18g');
    ui = { token: G.panelToken, raf: 0, view: 'list', padPrev: {} };
    return ui;
  }
  const typeOf = (m) => (m.win ? TX.panel.won : TX.panel.failed);
  function metaLine(m) {
    const bits = [m.source === 'friend' ? TX.panel.friend : TX.panel.mine, typeOf(m)];
    return fmt(TX.panel.line, bits[0], bits[1], m.score != null ? fmt(TX.panel.score, m.score) : mmss(m.secs));
  }
  function flashSay(msgText) { const s = document.getElementById('p18g-say'); if (s) s.textContent = msgText; }
  function openList(say) {
    const T = TX.panel;
    const sh = openPanelShell(`<h2></h2><div class="p18g"><div class="p18g-list" id="p18g-list" role="list"></div><p class="p18g-say" id="p18g-say" role="status" aria-live="polite"></p>
      <div class="p18g-imp"><label class="muted" for="p18g-in"></label><textarea id="p18g-in" rows="2" spellcheck="false" autocomplete="off"></textarea><button class="dfbtn small" id="p18g-imp" type="button"></button></div>
      <div class="btns p18g-btns"><button class="dfbtn small" id="p18g-close" type="button"></button></div></div>`);
    if (!sh) return false;
    const root = document.querySelector('#modal-panel');
    root.querySelector('h2').textContent = T.title;
    root.querySelector('label').textContent = T.importHead;
    const inp = root.querySelector('#p18g-in'); inp.placeholder = T.importHint; inp.setAttribute('aria-label', T.importHint);
    const impBtn = root.querySelector('#p18g-imp'); impBtn.textContent = T.importBtn;
    const closeBtn = root.querySelector('#p18g-close'); closeBtn.textContent = T.close; closeBtn.onclick = () => closeUi();
    const listEl = root.querySelector('#p18g-list');
    const fill = () => {
      listEl.textContent = '';
      const items = list();
      if (!items.length) listEl.appendChild(el('p', { class: 'muted' }, T.empty));
      for (const m of items) {
        const row = el('div', { class: 'p18g-row', role: 'listitem' });
        const t = el('div', { class: 'p18g-t' }); t.appendChild(el('b', null, m.label)); t.appendChild(el('small', { class: 'muted' }, ' ' + metaLine(m)));
        const bw = el('button', { class: 'dfbtn small', type: 'button' }, T.watch), bc = el('button', { class: 'dfbtn small', type: 'button' }, T.copy), bd = el('button', { class: 'dfbtn small', type: 'button' }, T.del);
        bw.setAttribute('aria-label', T.watch + ': ' + m.label); bc.setAttribute('aria-label', T.copy + ': ' + m.label); bd.setAttribute('aria-label', T.del + ': ' + m.label);
        bw.onclick = () => openWatch(m.key, m.source);
        bc.onclick = () => copyCode(exportCode(m.key, m.source));
        bd.onclick = () => { remove(m.key, m.source); flashSay(T.deleted); fill(); };
        row.append(t, bw, bc, bd); listEl.appendChild(row);
      }
      const n = items.length; const foot = el('p', { class: 'muted p18g-foot' }, fmt(T.kept, n, B.MAX_SLOTS)); listEl.appendChild(foot);
    };
    const copyCode = (code) => {
      if (!code) return;
      inp.value = code;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => flashSay(T.copied), () => { inp.select(); flashSay(T.copyFail); });
        else { inp.select(); flashSay(T.copyFail); }
      } catch (e) { inp.select(); flashSay(T.copyFail); }
    };
    impBtn.onclick = () => {
      const r = importCode(inp.value);
      if (r.ok) { flashSay(fmt(T.imported, keyName(r.key))); inp.value = ''; fill(); }
      else flashSay(T.bad[r.reason] || T.bad.format);
    };
    sh.onKey = (ev) => {
      const k = String(ev.key || '').toLowerCase();
      if (k === 'escape') { ev.stopImmediatePropagation(); ev.preventDefault(); closeUi(); }
    };
    window.addEventListener('keydown', sh.onKey, true);
    fill(); if (say) flashSay(say);
    return true;
  }
  const BAND = '#16121a';
  function openWatch(key, source) {
    key = String(key);
    const g = ghostOf(key, source); if (!g) return false;
    const T = TX.panel;
    const sh = openPanelShell(`<h2></h2><div class="p18g p18w"><canvas id="p18g-cv" width="480" height="270" role="img"></canvas>
      <p class="p18g-say" id="p18g-say" role="status" aria-live="polite"></p>
      <div class="p18g-hp"><span class="muted" id="p18g-hpt"></span><div class="p18g-hpbar"><i id="p18g-hpf"></i></div></div>
      <input type="range" id="p18g-scrub" min="0" step="1" value="0">
      <div class="btns p18g-btns"><button class="dfbtn small" id="p18g-play" type="button"></button><button class="dfbtn small" id="p18g-re" type="button"></button><button class="dfbtn small" id="p18g-sp" type="button"></button><button class="dfbtn small" id="p18g-close" type="button"></button></div>
      <p class="p18g-keys muted" id="p18g-keys"></p></div>`);
    if (!sh) return false;
    const root = document.querySelector('#modal-panel');
    root.querySelector('h2').textContent = fmt(T.watchTitle, keyName(g.key));
    const cv = root.querySelector('#p18g-cv'), ctx = cv.getContext('2d'); cv.setAttribute('aria-label', T.alt);
    const playB = root.querySelector('#p18g-play'), reB = root.querySelector('#p18g-re'), spB = root.querySelector('#p18g-sp'), clB = root.querySelector('#p18g-close');
    const scrub = root.querySelector('#p18g-scrub'), hpT = root.querySelector('#p18g-hpt'), hpF = root.querySelector('#p18g-hpf');
    scrub.max = String(g.n - 1); scrub.setAttribute('aria-label', T.scrub);
    root.querySelector('#p18g-keys').textContent = T.keys;
    reB.textContent = T.restart; clB.textContent = T.close;
    const w = { t: 0, playing: !reduced(), speed: 1, last: performance.now(), mapIdx: -1, layer: null, box: null };
    sh.view = 'watch'; sh.w = w;
    const SPEEDS = [1, 2, 4, 0.5];
    const syncBtns = () => { playB.textContent = w.playing ? T.pause : T.play; spB.textContent = fmt(T.speed, w.speed); };
    const end = g.n * B.TICK;
    // the arena layer for the map the ghost is on, cropped around its path
    const layerFor = (mi) => {
      const name = g.maps[mi], map = hasG() && G.maps ? G.maps[name] : null;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < g.n; i++) if (g.M[i] === mi) { const x = g.X[i] / B.POS_Q, y = g.Y[i] / B.POS_Q; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) { x0 = 0; y0 = 0; x1 = 8; y1 = 8; }
      const pad = 4; x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
      if (map) { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(map.w, x1); y1 = Math.min(map.h, y1); }
      const bw = Math.max(8, x1 - x0), bh = Math.max(6, y1 - y0), cell = Math.max(3, Math.min(22, Math.floor(Math.min(cv.width / bw, cv.height / bh))));
      const L = document.createElement('canvas'); L.width = cv.width; L.height = cv.height; const lc = L.getContext('2d');
      lc.fillStyle = BAND; lc.fillRect(0, 0, L.width, L.height);
      const ox = Math.floor((cv.width - bw * cell) / 2), oy = Math.floor((cv.height - bh * cell) / 2);
      if (map && map.cells) {
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const mx = x0 + x, my = y0 + y; if (mx >= map.w || my >= map.h) continue;
          const v = map.cells[my * map.w + mx];
          lc.fillStyle = v ? ((mx + my) & 1 ? '#4a4f5c' : '#454a56') : ((mx + my) & 1 ? '#231d24' : '#201a21'); lc.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        }
      }
      return { L, x0, y0, cell, ox, oy, known: !!map };
    };
    const toPx = (ly, x, y) => [ly.ox + (x - ly.x0) * ly.cell, ly.oy + (y - ly.y0) * ly.cell];
    const draw = () => {
      const i = Math.min(g.n - 1, Math.floor(w.t / B.TICK)), mi = g.M[i];
      if (mi !== w.mapIdx) { w.mapIdx = mi; w.layer = layerFor(mi); }
      const ly = w.layer; ctx.drawImage(ly.L, 0, 0);
      // the path walked so far
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,220,245,0.55)'; ctx.beginPath(); let pen = false;
      for (let k = 0; k <= i; k++) { if (g.M[k] !== mi) { pen = false; continue; } const p = toPx(ly, g.X[k] / B.POS_Q, g.Y[k] / B.POS_Q); if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]); }
      ctx.stroke();
      const s = pbPose({ g, t: Math.min(w.t, end - B.TICK) });
      const p = toPx(ly, s.x, s.y), r = Math.max(5, ly.cell * 0.55);
      // the start
      const sp = toPx(ly, g.X[0] / B.POS_Q, g.Y[0] / B.POS_Q); if (g.M[0] === mi) { ctx.strokeStyle = 'rgba(240,215,150,0.8)'; ctx.strokeRect(sp[0] - 4, sp[1] - 4, 8, 8); }
      // facing wedge and the figure
      ctx.fillStyle = 'rgba(210,235,255,0.28)'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.arc(p[0], p[1], r * 2.4, s.dir - 0.5, s.dir + 0.5); ctx.closePath(); ctx.fill();
      const fr = figureFrame(2, s.spd < B.WALK ? 0 : 1 + (Math.floor(s.stride / B.STRIDE) & 1), s.act, s.act ? Math.min(3, Math.floor(s.ap * 4)) : 0, g.look);
      const cvf = frameCanvas(fr), fh = Math.max(26, Math.min(44, ly.cell * 3.2)), fw = fh * fr.w / fr.h, mir = Math.cos(s.dir) < 0;
      ctx.save(); ctx.translate(p[0], p[1] - fh * 0.42); if (mir) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.95; ctx.drawImage(cvf, -fw / 2, -fh / 2, fw, fh); ctx.restore();
      if (s.act) {
        const pulse = reduced() ? 1 : 0.4 + s.ap * 0.9; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
        if (s.act === 7) ctx.arc(p[0], p[1], r * (1.2 + pulse), 0, Math.PI * 2); else if (s.act === 6) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + Math.cos(s.dir) * r * 5, p[1] + Math.sin(s.dir) * r * 5); } else if (s.act <= 5) ctx.arc(p[0], p[1], r * 1.9, s.dir - 0.9, s.dir + 0.9); else ctx.arc(p[0], p[1], r * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!ly.known) { ctx.fillStyle = 'rgba(230,225,215,0.7)'; ctx.font = '12px sans-serif'; ctx.fillText(T.noMap, 8, 16); }
      ctx.fillStyle = 'rgba(235,228,215,0.9)'; ctx.font = '13px sans-serif'; ctx.fillText(fmt(T.time, mmss(w.t), mmss(end)), 8, cv.height - 8);
      scrub.value = String(i);
      if (g.hp && g.hp.length) { const hv = g.hp[Math.min(g.hp.length - 1, Math.floor(i / B.HP_EVERY))]; hpT.textContent = fmt(T.bossHp, hv); hpF.style.width = hv + '%'; }
      else { hpT.textContent = ''; hpF.style.width = '0'; }
    };
    const seek = (dt) => { w.t = clamp(w.t + dt, 0, end - B.TICK); draw(); };
    playB.onclick = () => { if (w.t >= end - B.TICK) w.t = 0; w.playing = !w.playing; syncBtns(); };
    reB.onclick = () => { w.t = 0; w.playing = true; syncBtns(); draw(); };
    spB.onclick = () => { w.speed = SPEEDS[(SPEEDS.indexOf(w.speed) + 1) % SPEEDS.length]; syncBtns(); };
    clB.onclick = () => closeUi();
    scrub.oninput = () => { w.t = clamp(+scrub.value * B.TICK, 0, end - B.TICK); draw(); };
    sh.onKey = (ev) => {
      const k = String(ev.key || '').toLowerCase();
      if (!['escape', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'r'].includes(k)) return;
      if (ev.target && ev.target === scrub && (k === 'arrowleft' || k === 'arrowright')) { /* the slider handles its own arrows, a step at a time */ }
      ev.stopImmediatePropagation(); ev.preventDefault();
      if (ev.repeat && k !== 'arrowleft' && k !== 'arrowright') return;
      if (k === 'escape') closeUi();
      else if (k === ' ') playB.click();
      else if (k === 'r') reB.click();
      else if (k === 'arrowleft') seek(-5); else if (k === 'arrowright') seek(5);
      else if (k === 'arrowup') { w.speed = SPEEDS[(SPEEDS.indexOf(w.speed) + 1) % SPEEDS.length]; syncBtns(); } else if (k === 'arrowdown') { w.speed = 1; syncBtns(); }
    };
    window.addEventListener('keydown', sh.onKey, true);
    const loop = (now) => {
      if (ui !== sh) return;
      if (G.panelToken !== sh.token || G.openPanel !== 'p18g') { closeUi(); return; }
      const dt = Math.min(0.05, Math.max(0, (now - w.last) / 1000)); w.last = now;
      try { pad(); } catch (e) { /* no pad */ }
      if (w.playing) { w.t += dt * w.speed; if (w.t >= end - B.TICK) { w.t = end - B.TICK; w.playing = false; syncBtns(); } }
      draw();
      sh.raf = requestAnimationFrame(loop);
    };
    const pad = () => {
      const gp = padNow(); if (!gp) return;
      const edge = (i) => { const n = !!(gp.buttons[i] && gp.buttons[i].pressed), was = sh.padPrev[i]; sh.padPrev[i] = n; return n && !was; };
      if (edge(1)) closeUi(); else if (edge(0)) playB.click(); else if (edge(14)) seek(-5); else if (edge(15)) seek(5); else if (edge(2)) reB.click();
    };
    syncBtns(); draw(); sh.raf = requestAnimationFrame(loop);
    playB.focus({ preventScroll: true });
    return true;
  }
  const frameCvCache = new WeakMap();
  function frameCanvas(fr) {
    let c = frameCvCache.get(fr); if (c) return c;
    c = document.createElement('canvas'); c.width = fr.w; c.height = fr.h;
    const id = c.getContext('2d').createImageData(fr.w, fr.h); new Uint32Array(id.data.buffer).set(fr.data); c.getContext('2d').putImageData(id, 0, 0);
    frameCvCache.set(fr, c); return c;
  }
  function watch(key, source) { return on() ? openWatch(key, source) : false; }

  // ---------------------------------------------------------------- options rows
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('p18g-opt-ghost')) return;
    const O = TX.opts;
    const label = (t, hint) => { const s = el('span', { class: 'gfx-label' }, t + ' '); s.appendChild(el('small', { class: 'muted' }, hint)); return s; };
    const toggle = (id, get, set) => {
      const b = el('button', { class: 'dfbtn small', id, type: 'button' }, '');
      const sync = () => { const v = get(); b.textContent = v ? O.on : O.off; b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.toggle('sel', !!v); };
      b.onclick = () => { set(!get()); sync(); };
      sync(); return b;
    };
    grid.appendChild(label(O.ghost, O.ghostHint)); grid.appendChild(toggle('p18g-opt-ghost', () => on(), (v) => setEnabled(v)));
    grid.appendChild(label(O.echo, O.echoHint)); grid.appendChild(toggle('p18g-opt-echo', () => cfg.echo, (v) => { cfg.echo = v; saveAll(); }));
    grid.appendChild(label(O.codes, O.codesHint));
    const b = el('button', { class: 'dfbtn small', id: 'p18g-opt-codes', type: 'button' }, O.open); b.onclick = () => { try { closeModal(); G.state = 'play'; openList(); } catch (e) { console.warn('ghost18: panel failed', e); } };
    grid.appendChild(b);
  }

  // ---------------------------------------------------------------- the trophy: Watch your best run
  function pegWatch(e, _use) {
    try {
      if (!on() || typeof HEARTH15 === 'undefined' || !e || e.use !== 'p15_peg' || typeof showEvent !== 'function') return false;
      const k = HEARTH15.placedMap().byPeg[e._pi]; if (k == null) return false;
      const t = HEARTH15.TX.trophy.items[k], type = TROPHY_BOSS[t.key]; if (!type) return false;
      const key = 'boss:' + type, m = best(key); if (!m || !m.win) return false;
      const T = HEARTH15.TX.trophy;
      showEvent(t.name, t.desc, [{ t: TX.peg.watch, f: () => { try { openWatch(key); } catch (er) { console.warn('ghost18: watch failed', er); } } }, { t: T.takeDown, f: () => HEARTH15.takeDown(k) }, { t: T.leaveHung, f: null }]);
      return true;
    } catch (er) { console.warn('ghost18: peg failed', er); return false; }
  }

  // ---------------------------------------------------------------- install
  function install() {
    loadAll();
    const css = document.createElement('style'); css.id = 'ghost18-style';
    css.textContent = `#modal-panel:has(.p18g) { width: 84cqw; max-height: 96cqh; }
.p18g canvas { display: block; width: min(100%, 74cqh); height: auto; margin: 0 auto; background: #16121a; border: 2px solid #0b0806; image-rendering: pixelated; }
.p18g-list { display: flex; flex-direction: column; gap: .6cqh; max-height: 46cqh; overflow-y: auto; margin: .3cqh 0; }
.p18g-row { display: flex; gap: .6cqw; align-items: center; flex-wrap: wrap; }
.p18g-t { flex: 1 1 24cqw; font-size: 1.9cqw; min-width: 0; }
.p18g-row .dfbtn small, .p18g .dfbtn.small { font-size: 1.7cqw; }
.p18g-say { min-height: 3.6cqh; margin: .3cqh 0; color: var(--gold); font-family: var(--font-sc); font-size: 1.9cqw; }
.p18g-imp { display: flex; gap: .6cqw; align-items: center; flex-wrap: wrap; }
.p18g-imp label { flex: 1 1 100%; font-size: 1.6cqw; }
.p18g-imp textarea { flex: 1 1 40cqw; font: 1.5cqw/1.3 monospace; background: #120e0b; color: #e8dcc0; border: 2px solid #0b0806; padding: .4cqh .6cqw; resize: none; }
.p18g-btns { display: flex; flex-wrap: wrap; gap: .8cqw; justify-content: center; margin-top: .4cqh; }
.p18g-keys, .p18g-foot { font-size: 1.4cqw; margin: .1cqh 0; }
.p18w h2 { margin: 0; }
.p18g-hp { display: flex; align-items: center; gap: .8cqw; font-size: 1.7cqw; }
.p18g-hpbar { flex: 1; height: 1.2cqh; background: #120e0b; border: 1px solid #0b0806; }
.p18g-hpbar i { display: block; height: 100%; background: #b8d4ea; width: 0; }
#p18g-scrub { width: 100%; margin: .4cqh 0; }
`;
    document.head.appendChild(css);

    if (typeof update === 'function') {
      const _up = update;
      update = function (dt) {
        const r = _up.apply(this, arguments);
        try {
          if (hasG() && G.dead && (recs.auto || recs.manual)) { if (recs.auto) endFight(false, false); }
          if (G.state === 'play' && on()) {
            if (fight) fight.t += dt;
            if (recs.manual) stepRec(recs.manual, dt);
            if (recs.auto) stepRec(recs.auto, dt);
            autoTick();
            if (pb) stepPlay(dt);
          }
        } catch (err) { if (!install.warned) { install.warned = true; console.warn('ghost18: frame hook failed', err); } }
        return r;
      };
    }
    if (typeof restoreGame === 'function') {
      const _rs = restoreGame;
      restoreGame = function () { try { closeUi(); shutdown(); } catch (e) { /* ignore */ } return _rs.apply(this, arguments); };
    }
    if (typeof startGame === 'function') {
      const _sg = startGame;
      startGame = function () { try { closeUi(); shutdown(); } catch (e) { /* ignore */ } return _sg.apply(this, arguments); };
    }
    if (typeof useDeco === 'function') {
      const _use = useDeco;
      useDeco = function (e) {
        try { if (e && e.kind === 'deco' && e.use === 'p15_peg' && pegWatch(e, _use)) return; } catch (err) { console.warn('ghost18: use failed', err); }
        return _use.apply(this, arguments);
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('ghost18: options rows failed', e); }
        return r;
      };
    }
    if (typeof GFX !== 'undefined' && typeof GFX.onChange === 'function') GFX.onChange(() => {
      if (!GFX.ghostReplay) shutdown();
      if (!mineChanging && cfg.override !== null && GFX.ghostReplay !== cfg.override) { cfg.override = null; saveAll(); }   // a preset took over
    });
    if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook((F) => { try { if (!pb) return; const t0 = performance.now(); drawHook(F); stats.ms = performance.now() - t0; } catch (err) { if (!drawHook.warned) { drawHook.warned = true; console.warn('ghost18: draw failed', err); } } }, 9);   // after the sprites and fire smoke (8), before soft fog (10)
  }
  try { install(); } catch (e) { console.warn('ghost18: install failed', e); }

  const api = {
    enabled: on, record, stop, abort, best, play, stopPlay, watch, exportCode, importCode, list, remove,
    state: () => ({ recording: recs.manual ? recs.manual.key : null, playing: pb ? pb.key : null, t: pb ? pb.t : 0, bossFight: fight ? fight.type : null }),
  };
  Object.assign(api, {
    TX, LIST, B, cfg, TONE, BOSS_LIST, TROPHY_BOSS,
    // internals the tests and the report read
    encode, decode, keep, better, fnv, b64enc, b64dec, isBossType, bossName, lookNow, setEnabled, openList, openWatch, closeUi, appendRows, stats,
    paintFigure, figureFrame, frameFor, viewOf, ghostAlpha, drawHook, pbPose, saveAll, loadAll,
    reset() { slots = {}; shutdown(); },
    pegWatch,
  });
  // live views (Object.assign would copy a getter's value once)
  Object.defineProperties(api, {
    slots: { get: () => slots, enumerable: true }, recs: { get: () => recs, enumerable: true }, fight: { get: () => fight, enumerable: true },
    pb: { get: () => pb, enumerable: true }, ui: { get: () => ui, enumerable: true },
  });
  return api;
})();
if (typeof window !== 'undefined') window.GHOST18 = GHOST18;
