// ============================================================
//  carter13 - Phase 13, the carter as a person.
//
//  The young Causeway carter who came north with you is no longer scenery. He follows at a little distance, holds
//  when told, waits at the bothy door when you go in (unless you have told him to follow you through), goes down
//  when the bloom gets him, bleeds, and dies into the company roll. He does not fight: the prologue teaches
//  distance, not fighting.
//
//  The rules are pure: make, order, step, hurt, down, revive, tick, load. The wire drives the la_carter NPC on the
//  ledge, gives his talk menu the two orders, keeps him out of the doorway, and stores him in G.flags.la_carter.
//
//  Plain ASCII. No random number and no clock.
// ============================================================
'use strict';

const CARTER13 = (() => {
  const TX = {
    name: 'The carter',
    other: 'The other carter',
    orderLead: (mode) => mode === 'follow' ? 'He has the spear over one shoulder and is ready to walk.' : mode === 'hold' ? 'He is standing where you left him, watching the country.' : mode === 'wait' ? 'He is waiting where you put him.' : 'He is down.',
    follow: 'Follow me.',
    hold: 'Hold here.',
    followReply: 'He nods and falls in behind you, a little more than a pace back.',
    holdReply: 'He plants the spear butt and stays where he is.',
    down: 'The carter goes down.',
    dead: 'The carter is dead.',
    wait: 'The carter waits outside the door.',
    otherCarter: 'The other carter. Young, from the Causeway. Gytha Marrin sent the two of you north together.',
    carterFolk: 'The carter. Young, from the Causeway. Gytha Marrin sent the two of you north together.',
    journalDead: 'The carter is dead. I wrote him into the roll.',
  };
  const MODES = ['follow', 'hold', 'wait', 'down', 'dead'];
  const STOP = 1.2, SPEED = 2.2, BLEED = 20;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function make(o) {
    const p = o || {}, hp = Math.max(1, Math.round(p.hp || 120));
    return { mode: 'follow', x: isFinite(+p.x) ? +p.x : 79.9, y: isFinite(+p.y) ? +p.y : 46.2, hp, hpMax: Math.max(hp, Math.round(p.hpMax || hp)), bleed: 0, toldFollow: false };
  }
  function order(S, mode) {
    if (!S || !MODES.includes(mode) || S.mode === 'dead') return false;
    S.mode = mode;
    if (mode === 'follow') S.toldFollow = true;
    if (mode === 'hold' || mode === 'wait') S.toldFollow = false;
    if (mode === 'down') S.bleed = BLEED;
    return true;
  }
  function canWalk(env, x, y) {
    if (!env) return true;
    if (env.blocked && env.blocked(x, y)) return false;
    if (env.cliff && env.cliff(x, y)) return false;
    return true;
  }
  // One step. env: { px, py, blocked(x,y), cliff(x,y), speed }. Follow stops at STOP; hold and wait never move.
  function step(S, env, dt) {
    if (!S || S.mode !== 'follow' || !(dt > 0) || !isFinite(dt)) return S;
    const px = env && isFinite(env.px) ? env.px : S.x, py = env && isFinite(env.py) ? env.py : S.y;
    const dx = px - S.x, dy = py - S.y, d = Math.hypot(dx, dy);
    if (d <= STOP || d < 1e-6) return S;
    const move = Math.min((env && env.speed || SPEED) * dt, d - STOP);
    const nx = S.x + dx / d * move, ny = S.y + dy / d * move;
    if (canWalk(env, nx, ny)) { S.x = nx; S.y = ny; }
    else if (canWalk(env, nx, S.y)) S.x = nx;
    else if (canWalk(env, S.x, ny)) S.y = ny;
    return S;
  }
  function down(S) {
    if (!S || S.mode === 'dead' || S.mode === 'down') return false;
    S.mode = 'down'; S.hp = 0; S.bleed = BLEED;
    return true;
  }
  function hurt(S, n) {
    if (!S || S.mode === 'dead' || S.mode === 'down') return false;
    S.hp = Math.max(0, S.hp - Math.max(0, +n || 0));
    if (S.hp <= 0) return down(S);
    return true;
  }
  // Returns 'died' on the step the bleed clock runs out, so the wire writes him into the roll once.
  function tick(S, dt) {
    if (!S || S.mode !== 'down' || !(dt > 0) || !isFinite(dt)) return null;
    S.bleed = Math.max(0, S.bleed - dt);
    if (S.bleed <= 0) { S.mode = 'dead'; S.hp = 0; return 'died'; }
    return null;
  }
  function revive(S, hp) {
    if (!S || S.mode !== 'down') return false;
    S.mode = 'hold'; S.bleed = 0;
    S.hp = clamp(Math.round(hp || S.hpMax * 0.5), 1, S.hpMax);
    return true;
  }
  function load(raw, fallback) {
    const f = make(fallback);
    if (!raw || typeof raw !== 'object') return f;
    const s = make({ x: raw.x, y: raw.y, hp: raw.hpMax, hpMax: raw.hpMax });
    if (MODES.includes(raw.mode)) s.mode = raw.mode;
    s.hp = clamp(+raw.hp || 0, 0, s.hpMax);
    if (s.mode === 'down' || s.mode === 'dead') s.hp = 0;
    s.bleed = Math.max(0, +raw.bleed || 0);
    s.toldFollow = !!raw.toldFollow;
    return s;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false, BODY = null, S = null, namedOther = false;
  const here = () => typeof G !== 'undefined' && G && G.mapId === LEDGE1.LEDGE;
  function state() {
    if (!S && typeof G !== 'undefined' && G && G.flags) S = load(G.flags.la_carter, { x: 79.9, y: 46.2 });
    return S;
  }
  function save() { if (typeof G !== 'undefined' && G && G.flags) G.flags.la_carter = state(); }
  function body() {
    if (BODY) return BODY;
    try { const m = G.maps[LEDGE1.LEDGE]; BODY = m.entities.find((e) => e.id === 'la_carter') || null; } catch (e) { BODY = null; }
    return BODY;
  }
  function naming() {
    if (typeof G === 'undefined' || !G || !G.flags || typeof PANEL10 === 'undefined') return;
    const other = G.flags.la_bg === 'carter';
    if (other === namedOther) return;
    namedOther = other;
    const name = other ? TX.other : TX.name;
    try { if (typeof NPCS !== 'undefined' && NPCS.la_carter) NPCS.la_carter.name = name; } catch (e) { /* the NPC keeps its name */ }
    try { PANEL10.TX.carter = other ? TX.otherCarter : TX.carterFolk; } catch (e) { /* the panel keeps its line */ }
    const b = body(); if (b) b.name = name;
    try {
      const c = G.flags.la_company, p = c && c.people && c.people.find((q) => q.id === 'carter');
      if (p) p.name = name;
    } catch (e) { /* the roll keeps its name */ }
  }
  function sync() {
    const s = state(), b = body(); if (!b) return;
    b.x = s.x; b.y = s.y; b.hidden = G.mapId !== LEDGE1.LEDGE;
    b.dead = s.mode === 'dead';
    b.label = s.mode === 'down' ? TX.down : s.mode === 'dead' ? TX.dead : (b.name || TX.name);
  }
  function tickWire(dt) {
    if (typeof G === 'undefined' || !G || G.state !== 'play') return;
    const s = state(); if (!s) return;
    naming();
    // he bleeds wherever the player is
    const died = tick(s, dt);
    if (died) {
      try { if (typeof COMPANY12 !== 'undefined' && G.flags.la_company) COMPANY12.kill(G.flags.la_company, 'carter', 'the bloom'); } catch (e) { /* the roll keeps its line */ }
      journal('side', TX.journalDead);
      msg(TX.dead, 'bad', 6000);
    }
    if (G.mapId !== LEDGE1.LEDGE) { sync(); return; }
    const c = Engine.cam;
    const env = {
      px: c.x, py: c.y, speed: SPEED,
      blocked: (x, y) => { try { return typeof solidAt === 'function' && solidAt(x, y); } catch (e) { return false; } },
      cliff: (x, y) => { try { const g = G.map.groundAt ? G.map.groundAt(x, y) : 0, h = G.map.groundAt ? G.map.groundAt(S.x, S.y) : 0; return h - g > 0.8; } catch (e) { return false; } },
    };
    // the bloom's claw reaches him if he is beside it; he does not strike back
    s._hurtT = Math.max(0, (s._hurtT || 0) - dt);
    if (s._hurtT <= 0 && s.mode !== 'down' && s.mode !== 'dead' && typeof BLOOM4 !== 'undefined') {
      try {
        const b = BLOOM4.state();
        if (b && b.state === 'claw' && Math.hypot(b.x - s.x, b.y - s.y) < 1.1) { hurt(s, 32); s._hurtT = 2.1; }
      } catch (e) { /* the bloom is elsewhere */ }
    }
    step(s, env, dt);
    sync();
  }
  function enterBothy() {
    const s = state();
    if (s.mode === 'follow' && !s.toldFollow) { s.mode = 'hold'; s.x = 83.5; s.y = 31.4; }
    else if (s.mode === 'hold' && Math.hypot(s.x - 83.5, s.y - 31.4) < 5) { s.x = 83.5; s.y = 31.4; }
    save(); sync();
  }
  function wire() {
    if (wired || typeof window === 'undefined' || typeof G === 'undefined' || typeof LEDGE1 === 'undefined') return false;
    const _bm = buildAllMaps;
    buildAllMaps = function () {
      const maps = _bm.apply(this, arguments);
      try { BODY = maps[LEDGE1.LEDGE].entities.find((e) => e.id === 'la_carter') || null; } catch (e) { BODY = null; }
      if (!S) S = load(G.flags && G.flags.la_carter, { x: 79.9, y: 46.2 });
      if (BODY) { BODY.wander = false; BODY.name = G.flags && G.flags.la_bg === 'carter' ? TX.other : TX.name; }
      sync();
      return maps;
    };
    const _up = update;
    update = function (dt) { const r = _up.apply(this, arguments); try { tickWire(dt); } catch (e) { /* he keeps his last place */ } return r; };
    const _lm = loadMap;
    loadMap = function (id) {
      const r = _lm.apply(this, arguments);
      try { if (id === LEDGE1.BOTHY) enterBothy(); else if (id === LEDGE1.LEDGE) sync(); } catch (e) { /* the door stays the door */ }
      return r;
    };
    // his talk menu is the two orders; the topics remain under "Tell me about"
    try {
      if (typeof NPCS !== 'undefined' && NPCS.la_carter) {
        NPCS.la_carter.quest = function () {
          const s = state();
          return {
            text: TX.orderLead(s.mode),
            choices: [
              { t: TX.follow, f: () => { order(s, 'follow'); save(); naming(); return TX.followReply; } },
              { t: TX.hold, f: () => { order(s, 'hold'); save(); return TX.holdReply; } },
            ],
          };
        };
      }
    } catch (e) { /* the old greeting stands */ }
    naming();
    wired = true;
    return true;
  }

  return { TX, MODES, STOP, SPEED, BLEED, make, order, step, down, hurt, tick, revive, load, wire, state, body, naming, save };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CARTER13;
if (typeof window !== 'undefined') CARTER13.wire();
