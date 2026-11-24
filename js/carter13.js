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
  // Phase 40 [PROPOSED]: behind by more than CATCH cells, he jogs at JOG cells a second to close up (a walker here goes
  // at about 3.4 on level ground, more than P33's 2.6, so a jog has to be faster than that)
  const CATCH = 5, JOG = 4;
  const TRAIL = [];
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
    // Phase 40: the map he is on, when he has followed you off the ledge (a save from before has none: the ledge)
    if (typeof raw.map === 'string' && raw.map.length <= 48) s.map = raw.map;
    return s;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false, BODY = null, S = null, namedOther = null;   // null: naming() runs once at the start (audit fix: false skipped it, so the roll kept the card name)
  // Phase 40: he can follow you off the ledge (js/threshold40.js), so the map he is on is part of his state, and every
  // map he can be on has a body for him, hidden unless he is there. With no map in his state he is on the ledge.
  const mapOf = (s) => (s && s.map && typeof G !== 'undefined' && G && G.maps && G.maps[s.map] ? s.map : LEDGE1.LEDGE);
  const here = () => typeof G !== 'undefined' && G && G.mapId === mapOf(S);
  function state() {
    if (!S && typeof G !== 'undefined' && G && G.flags) S = load(G.flags.la_carter, { x: 79.9, y: 46.2 });
    return S;
  }
  function save() { if (typeof G !== 'undefined' && G && G.flags) G.flags.la_carter = state(); }
  function body(id) {
    if (!id && BODY && G.maps && G.maps[mapOf(S)] && G.maps[mapOf(S)].entities.includes(BODY)) return BODY;
    let b = null;
    try { const m = G.maps[id || mapOf(S)]; b = m.entities.find((e) => e.id === 'la_carter') || null; } catch (e) { b = null; }
    if (!id) BODY = b;
    return b;
  }
  // every body of his: the ledge's, and one on each map Phase 40 builds
  function bodies() {
    const out = [];
    try { for (const id in G.maps) { const e = G.maps[id].entities.find((q) => q.id === 'la_carter'); if (e) out.push(e); } } catch (e) { /* the ledge's alone */ }
    return out;
  }
  function naming() {
    if (typeof G === 'undefined' || !G || !G.flags || typeof PANEL10 === 'undefined') return;
    const other = G.flags.la_bg === 'carter';
    const name = other ? TX.other : TX.name;
    // the roll's name for him follows the NPC's, whenever the company is (re)made (audit fix)
    try { const c = G.flags.la_company, q = c && c.people && c.people.find((x) => x.id === 'carter'); if (q && q.alive && q.name !== name) q.name = name; } catch (e) { /* the roll keeps its name */ }
    if (other === namedOther) return;
    namedOther = other;
    try { if (typeof NPCS !== 'undefined' && NPCS.la_carter) NPCS.la_carter.name = name; } catch (e) { /* the NPC keeps its name */ }
    try { PANEL10.TX.carter = other ? TX.otherCarter : TX.carterFolk; } catch (e) { /* the panel keeps its line */ }
    for (const q of bodies()) q.name = name;
    try {
      const c = G.flags.la_company, p = c && c.people && c.people.find((q) => q.id === 'carter');
      if (p) p.name = name;
    } catch (e) { /* the roll keeps its name */ }
  }
  function sync() {
    const s = state(), b = body(); if (!b) return;
    for (const q of bodies()) if (q !== b) q.hidden = true;
    b.x = s.x; b.y = s.y; b.hidden = G.mapId !== mapOf(s);
    b.dead = s.mode === 'dead';
    // Audit fix: following at 1.2 cells he stood in your road and pinned you on the ledge; he does not block you while
    // he follows. Held or waiting, he is solid again and can be bumped into.
    b.solid = s.mode !== 'follow';
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
    if (G.mapId !== mapOf(s)) { sync(); TRAIL.length = 0; return; }
    const c = Engine.cam;
    // Phase 40: he walks where you walked (your trail), not straight at you, so a bend in a cut or a turn round a rock
    // does not stop him; and when he has fallen behind, more than CATCH cells back, he goes at a jog to close up.
    const last = TRAIL[TRAIL.length - 1];
    if (!last || Math.hypot(c.x - last.x, c.y - last.y) > 0.5) { TRAIL.push({ x: c.x, y: c.y }); if (TRAIL.length > 240) TRAIL.shift(); }
    const far = Math.hypot(c.x - s.x, c.y - s.y);
    let to = { x: c.x, y: c.y };
    if (far > STOP + 0.4 && TRAIL.length > 2) {
      let j = -1, best = 3;
      for (let i = 0; i < TRAIL.length; i++) { const d = Math.hypot(TRAIL[i].x - s.x, TRAIL[i].y - s.y); if (d < best) { best = d; j = i; } }
      // the first point on your trail past him by more than his stopping distance and a step
      if (j >= 0) for (let i = j; i < TRAIL.length; i++) if (Math.hypot(TRAIL[i].x - s.x, TRAIL[i].y - s.y) > STOP + 1) { to = TRAIL[i]; break; }
    }
    const env = {
      px: to.x, py: to.y, speed: far > CATCH ? JOG : SPEED,
      blocked: (x, y) => { try { return typeof solidAt === 'function' && solidAt(x, y, body()); } catch (e) { return false; } },   // audit fix: pass his own body, or it blocks every step he takes
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
    // only from the ledge: the bothy's door is there
    if (mapOf(s) !== LEDGE1.LEDGE) { sync(); return; }
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
      if (S && S.map && !maps[S.map]) delete S.map;
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
      try { if (id === LEDGE1.BOTHY) enterBothy(); else sync(); } catch (e) { /* the door stays the door */ }
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
    // Phase 40 audit: a save opened reloads him (he kept the last session's state, place and map before)
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () { const r = _rg.apply(this, arguments); try { S = null; BODY = null; TRAIL.length = 0; state(); sync(); } catch (e) { /* he keeps his last place */ } return r; };
    }
    naming();
    wired = true;
    return true;
  }

  // Phase 40: you have gone to another map (js/threshold40.js). Following, alive and near enough to have kept up, he goes
  // with you and comes out behind you; otherwise he stays where he is. Returns whether he came.
  function cross(from, to, at, near) {
    const s = state(); if (!s || mapOf(s) !== from) return false;
    TRAIL.length = 0;
    if (s.mode !== 'follow' || !(Math.hypot(s.x - near.x, s.y - near.y) <= 14)) { sync(); return false; }
    s.map = to; s.x = at.x; s.y = at.y;
    BODY = null; save(); sync();
    return true;
  }
  return { TX, MODES, STOP, SPEED, BLEED, make, order, step, down, hurt, tick, revive, load, wire, state, body, naming, save, cross, mapOf: () => mapOf(state()) };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CARTER13;
if (typeof window !== 'undefined') CARTER13.wire();
