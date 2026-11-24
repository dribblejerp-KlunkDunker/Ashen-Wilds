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
    handsFull: 'Both your hands are full.',
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
    // Phase 39 fix: on your arm she is not solid. Solid, she could be put where you stand (below), and then neither of
    // you could move again: the carry locked on the ramp. Let go of, she is solid again, as every person is.
    if (b) b.solid = !s.on;
    if (!s.on) { if (b && s.x && s.y) { b.x = s.x; b.y = s.y; } return; }
    // Where she can stand is judged from where you stand, at your height: she is on your arm, not walking on her own.
    // (Judged from her own last place, as the engine judges a walker, a place 0.8 ahead up the ramp was a step too high
    // whenever you turned, and she was left behind on the slope for good.) Walls, cliffs and other solid things still hold.
    const feet = G.player && typeof G.player.feet === 'number' ? G.player.feet : 0;
    const up = typeof STEP_UP === 'number' ? STEP_UP : 0.36, steep = typeof MAX_GRADE === 'number' ? MAX_GRADE : 1.1;
    const blocked = (x, y) => {
      try {
        const m = G.map, r = 0.2;
        if (m.lvls || m.smooth) {
          const g = m.groundAt(x, y);
          if (Math.abs(g - feet) > up + 0.5) return true;
          if (m.smooth && g > feet + 0.02 && m.gradeAt(x, y) > steep) return true;
        }
        for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (m.isBlocked((x + dx) | 0, (y + dy) | 0)) return true;
        for (const e of G.ents) { if (e === b || !e.solid || e.hidden || e.dead) continue; const rr = (e.radius || 0.3) + 0.2; if ((x - e.x) * (x - e.x) + (y - e.y) * (y - e.y) < rr * rr) return true; }
        return false;
      } catch (e) { return false; }
    };
    step(s, { px: c.x, py: c.y, dir: c.dir, side: 0.32, fwd: 0.8, blocked }, 0);
    // Phase 39 fix: coming out of the bothy's door with her, her place ahead and to the side was blocked (the carter
    // stands there), so she kept her place from inside the bothy, which on the ledge is a far corner of the map. When the
    // usual place is blocked and she is not beside you, she takes the next free place: the other side, then beside you,
    // then behind; failing all of them, where you stand.
    if (Math.hypot(s.x - c.x, s.y - c.y) > 1.6) {
      const tries = [[0.8, -0.32], [0, 0.45], [0, -0.45], [-0.6, 0.2], [-0.6, -0.2]];
      let put = false;
      for (const [f, sd] of tries) {
        const nx = c.x + Math.cos(c.dir) * f - Math.sin(c.dir) * sd, ny = c.y + Math.sin(c.dir) * f + Math.cos(c.dir) * sd;
        if (!blocked(nx, ny)) { s.x = nx; s.y = ny; put = true; break; }
      }
      if (!put) { s.x = c.x; s.y = c.y; }
    }
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
    if (b) b.solid = true;
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
  // What E is aimed at while she is on your arm, looking past her: { talk }, { use }, { item }, { door }, or null.
  function aimed() {
    const her = body(), others = G.ents.filter((e) => e !== her);
    const e = Engine.pick(others, typeof USE_RANGE === 'number' ? USE_RANGE : 2.6);
    if (e && !e.dead && !e.hidden) {
      if (e.kind === 'npc') return { talk: e };
      if (e.kind === 'deco' && e.use) return { use: e };
      if (e.kind === 'item') return { item: e };
    }
    if (typeof DOOR5 !== 'undefined' && DOOR5.doorway && DOOR5.doorway()) return { door: true };
    const w = Engine.pickWall(2.0);
    if (w && w.cell && w.cell.door) return { door: true };
    return null;
  }
  // The top of the ramp: where the shelf's ramp comes up onto the ledge (LEDGE1.RAMP's columns, at the ledge's own
  // edge). Phase 39 fix: the look back used to fire at (87.5, 33.2), the ramp's foot on the shelf, the moment you came
  // out of the bothy's door with her; the bible's beat is "At the top she turns".
  function atTop(x, y) {
    const R = LEDGE1.RAMP;
    return x >= R.x0 - 0.5 && x <= R.x1 + 0.5 && y >= R.y1 + 0.2 && y <= R.y1 + 2.5;
  }
  function tick(dt) {
    if (typeof G === 'undefined' || !G || G.state !== 'play') return;
    const s = state(); if (!s || !s.on) return;
    place(); save();
    if (G.mapId === LEDGE1.LEDGE && !G.flags.la_title_seen) {
      const c = Engine.cam;
      if (atTop(c.x, c.y)) startTitle();
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
    // Phase 39 fix: E with her on your arm used to let her go whatever was in front of you, so the bothy's door could not
    // be opened (nor its bar lifted) with her on your arm, and the carter could not be spoken to: the prologue could not
    // be finished. Now E does what it would do for what is in front of you (a door, the bar, another person), and lets
    // her go only when she or nothing is there. Things on the ground stay where they are: both hands are full.
    const _int = interact;
    interact = function () {
      const s = state();
      if (s && s.on) {
        const t = aimed();
        if (!t) { releaseNow(); return; }
        if (t.item) { msg(TX.handsFull, '', 1800); return; }
        if (t.talk) { talk(t.talk); return; }
        if (t.use) { useDeco(t.use); return; }
        // a door: the doors' own rules run (the bar, a lock, the way through), as if she were not in the line of sight
        const her = body(), was = her ? her.hidden : null;
        if (her) her.hidden = true;
        try { return _int.apply(this, arguments); } finally { if (her && G.ents.includes(her)) her.hidden = was; }
      }
      return _int.apply(this, arguments);
    };
    const _pm = playerMove;
    playerMove = function (o, dx, dy) {
      const s = state();
      if (s && s.on && o === Engine.cam) return _pm.call(this, o, dx * PACE, dy * PACE);
      return _pm.apply(this, arguments);
    };
    const _attack = attack;
    attack = function () { const s = state(); if (s && s.on) { msg(TX.handsFull, '', 1800); return; } return _attack.apply(this, arguments); };
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
  return { TX, PACE, NOISE, make, attach, detach, pace, handsFree, canAttack, noise, step, load, wire, state, save, attachNow, releaseNow, startTitle, atTop, aimed };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CARRY15;
if (typeof window !== 'undefined') CARRY15.wire();
