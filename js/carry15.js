// ============================================================
//  carry15 - Phase 15, the carry and the title.
//
//  Marget Sayle cannot manage the ledge path. Taking her arm is the first two-person load: both hands are full,
//  the pace is hers (0.65 of a walk), there is no sprint and no attack, and the step is one louder. She stands at
//  the carrier's side on the ramp; released, she stands and waits. At the top, with her, the look back starts once:
//  the camera turns to the Slagcrown, she turns once and says nothing, and THE LONG ACCOUNT comes up.
//
//  The rules are pure. The wire gives her the arm, scales the walk, holds the hands, places her, fires the ascent
//  trigger and runs the three-second title. The state is stored in G.flags.la_carry.
//
//  Plain ASCII. No random number and no clock in the rule.
// ============================================================
'use strict';

const CARRY15 = (() => {
  const TX = {
    takeArm: 'Take her arm.',
    askHer: 'Ask her about the country.',
    notYet: 'Not yet.',
    takeLead: 'She takes your arm. The path is narrower now, and slower.',
    release: 'You let her go. She stands where you left her.',
    attached: 'You are carrying Marget Sayle. Both hands are full.',
    title: 'THE LONG ACCOUNT',
    titleLine: 'At the top she turns and looks at the Slagcrown once, and says nothing.',
    atTop: 'The top of the ramp. The country opens west.',
    attachPrompt: 'She cannot manage the ledge path. Take her arm?',
  };
  const PACE = 0.65, NOISE = 3.4;
  const make = () => ({ v: 1, on: false, carrier: 'you', carried: 'marget', item: 'arm', x: 0, y: 0 });
  function attach(carrier, carried, item) {
    const S = make();
    S.on = true; S.carrier = carrier || 'you'; S.carried = carried || 'marget'; S.item = item || 'arm';
    return S;
  }
  function detach(S) { if (S) S.on = false; return S; }
  const pace = (S) => (S && S.on ? PACE : 1);
  const handsFree = (S) => !(S && S.on);
  const canAttack = (S) => !(S && S.on);
  const noise = (S) => (S && S.on ? NOISE : 0);
  // Put the carried person at the carrier's side. A blocked cell leaves the pair where they are.
  function step(S, env, dt) {
    if (!S || !S.on) return S;
    const px = env && isFinite(env.px) ? env.px : S.x, py = env && isFinite(env.py) ? env.py : S.y;
    const side = env && isFinite(env.side) ? env.side : 0.55;
    // The wire gives the camera's facing, so she stands at the carrier's side and a little ahead, not under the
    // next step and not lost at ninety degrees. Without a facing the pure rule keeps its old +x placement, which
    // its test pins.
    const fwd = env && isFinite(env.fwd) ? env.fwd : 0;
    const nx = env && isFinite(env.dir) ? px + Math.cos(env.dir) * fwd - Math.sin(env.dir) * side : px + side;
    const ny = env && isFinite(env.dir) ? py + Math.sin(env.dir) * fwd + Math.cos(env.dir) * side : py;
    if (env && env.blocked && env.blocked(nx, ny)) return S;
    S.x = nx; S.y = ny;
    return S;
  }
  function load(raw) {
    const S = make();
    if (!raw || typeof raw !== 'object') return S;
    S.on = !!raw.on; S.carrier = String(raw.carrier || 'you'); S.carried = String(raw.carried || 'marget');
    S.item = String(raw.item || 'arm'); S.x = +raw.x || 0; S.y = +raw.y || 0;
    return S;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false, S = null, TITLE = null, WAS = null;
  const here = () => typeof G !== 'undefined' && G && (G.mapId === LEDGE1.LEDGE || G.mapId === LEDGE1.BOTHY);
  function state() {
    if (!S && typeof G !== 'undefined' && G && G.flags) S = load(G.flags.la_carry);
    return S;
  }
  function save() { if (typeof G !== 'undefined' && G && G.flags) G.flags.la_carry = state(); }
  function body() {
    try { return G.ents.find((e) => e.id === 'la_marget') || null; } catch (e) { return null; }
  }
  function place() {
    const s = state(), b = body(), c = Engine.cam;
    if (!s.on) { if (b && s.x && s.y) { b.x = s.x; b.y = s.y; } return; }
    step(s, { px: c.x, py: c.y, dir: c.dir, side: 0.32, fwd: 0.8, blocked: (x, y) => { try { return typeof solidAt === 'function' && solidAt(x, y, body()); } catch (e) { return false; } } }, 0);
    const bb = body(); if (bb) { bb.x = s.x; bb.y = s.y; bb.hidden = false; }
  }
  function attachNow() {
    const s = attach('you', 'marget', 'arm'), b = body(), c = Engine.cam;
    s.x = c.x + 0.55; s.y = c.y;
    S = s; if (G.flags) { G.flags.la_carry = s; G.flags.la_marget_out = true; }
    if (b) { b.x = s.x; b.y = s.y; b.hidden = false; }
    msg(TX.takeLead, 'warn', 6500);
  }
  function releaseNow() {
    const s = state(); if (!s.on) return;
    const b = body();
    if (b) { s.x = b.x; s.y = b.y; }
    detach(s); save();
    msg(TX.release, '', 5000);
  }
  function startTitle() {
    if (TITLE || !G || G.flags.la_title_seen) return;
    G.flags.la_title_seen = true;
    TITLE = { done: false };
    WAS = { dir: Engine.cam.dir, pitch: Engine.cam.pitch, state: G.state };
    const cit = LEDGE1.CIT;
    Engine.cam.dir = Math.atan2(cit.y - Engine.cam.y, cit.x - Engine.cam.x);
    Engine.cam.pitch = 0;
    G.state = 'event'; G.keys = {};
    const b = body(); if (b) b.facing = Math.PI;
    openModal(`<div style="text-align:center"><h2 style="font-family:var(--font-display);letter-spacing:.18em">${TX.title}</h2><p class="muted">${TX.titleLine}</p></div>`, 'la-title');
    const finish = () => {
      if (!TITLE || TITLE.done) return;
      TITLE.done = true; clearTimeout(TITLE.timer);
      closeModal();
      if (WAS) { Engine.cam.dir = WAS.dir; Engine.cam.pitch = WAS.pitch; G.state = WAS.state === 'play' ? 'play' : 'play'; }
      TITLE = null;
      msg(TX.atTop, '', 4500);
    };
    TITLE.finish = finish;
    TITLE.timer = setTimeout(finish, 3000);
    window.addEventListener('keydown', (ev) => {
      if (TITLE && !TITLE.done && String(ev.key).toLowerCase() === 'escape') { ev.preventDefault(); ev.stopImmediatePropagation(); TITLE.finish(); }
    }, true);
  }
  function tick(dt) {
    if (typeof G === 'undefined' || !G || G.state !== 'play') return;
    const s = state(); if (!s || !s.on) return;
    place(); save();
    if (G.mapId === LEDGE1.LEDGE && !G.flags.la_title_seen) {
      const c = Engine.cam;
      if (Math.hypot(c.x - 87.5, c.y - 33.2) < 1.1) startTitle();
    }
  }
  function wire() {
    if (wired || typeof window === 'undefined' || typeof G === 'undefined' || typeof LEDGE1 === 'undefined') return false;
    // her body on the ledge, as well as the one in the bothy
    const _bm = buildAllMaps;
    buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try {
        // Audit fix: the ledge's body stays hidden until she has been taken by the arm (G.flags.la_marget_out), so the
        // ledge does not show a second Marget Sayle outside her own door before you arrive. Once she is out, the
        // bothy's body is hidden instead (the engine's requires/until, read at every loadMap).
        const m = maps[LEDGE1.LEDGE];
        if (m && !m.entities.some((e) => e.id === 'la_marget')) m.npc('la_marget', 83.5, 31.4, { name: LEDGE1.TX.marget, wander: false, requires: 'la_marget_out', hidden: true });
        const b = maps[LEDGE1.BOTHY], home = b && b.entities.find((e) => e.id === 'la_marget');
        if (home) home.until = 'la_marget_out';
      } catch (e) { /* the ledge has no second body */ }
      if (!S) S = load(G.flags && G.flags.la_carry);
      return maps;
    };
    const _talk = talk;
    talk = function (e) {
      const s = state();
      if (e && e.id === 'la_marget' && G.flags && G.flags.la_marget_promise && !s.on) {
        showEvent(LEDGE1.TX.marget, TX.attachPrompt, [
          { t: TX.takeArm, f: attachNow },
          { t: TX.askHer, f: () => _talk.apply(this, arguments) },
          { t: TX.notYet, f: null },
        ]);
        return;
      }
      return _talk.apply(this, arguments);
    };
    const _int = interact;
    interact = function () {
      const s = state();
      if (s && s.on) { releaseNow(); return; }
      return _int.apply(this, arguments);
    };
    const _pm = playerMove;
    playerMove = function (o, dx, dy) {
      const s = state();
      if (s && s.on && o === Engine.cam) return _pm.call(this, o, dx * PACE, dy * PACE);
      return _pm.apply(this, arguments);
    };
    const _attack = attack;
    attack = function () { const s = state(); if (s && s.on) { msg('Both your hands are full.', '', 1800); return; } return _attack.apply(this, arguments); };
    const _look = look;
    look = function (mx, my) { const s = state(); return s && s.on ? _look.call(this, mx * PACE, my * PACE) : _look.apply(this, arguments); };
    const _un = updateNarrow;
    updateNarrow = function (dt, moving, running) {
      const s = state();
      const r = _un.call(this, dt, moving, s && s.on ? false : running);
      if (s && s.on && moving) G.noise = Math.max(G.noise, NOISE);
      return r;
    };
    const _up = update;
    update = function (dt) { const r = _up.apply(this, arguments); try { tick(dt); } catch (e) { /* the load keeps its place */ } return r; };
    const _lm = loadMap;
    loadMap = function () { const r = _lm.apply(this, arguments); try { place(); } catch (e) { /* she stays */ } return r; };
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () { const r = _rg.apply(this, arguments); try { S = load(G.flags && G.flags.la_carry); place(); } catch (e) { /* the load starts released */ } return r; };
    }
    wired = true;
    return true;
  }
  return { TX, PACE, NOISE, make, attach, detach, pace, handsFree, canAttack, noise, step, load, wire, state, save, attachNow, releaseNow, startTitle };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CARRY15;
if (typeof window !== 'undefined') CARRY15.wire();
