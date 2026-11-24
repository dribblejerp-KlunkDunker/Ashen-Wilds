// ============================================================
//  company12 - Phase 12, death and succession.
//
//  The company is two people for the prologue: the traveller and the Causeway carter who came north with them.
//  A death is permanent. The dead person is written into the roll, and the other takes up the load at the last
//  hearth. If both are dead, the run is over. Hardcore still ends at the first death, as the engine's own run does.
//
//  The rules live in this file and are pure: make, kill, successor, takeUp, ended, roll, load. The wire at the
//  bottom wraps the copied engine's die() on this game's maps only, puts the next card on the traveller, moves
//  them to the bothy (or the ledge before the bothy has been entered), and keeps the bloom where it was by never
//  pressing the engine's wake. The company is stored in G.flags.la_company through the engine's save.
//
//  Plain ASCII. No random number and no clock.
// ============================================================
'use strict';

const COMPANY12 = (() => {
  const V = 1;
  const TX = {
    cardTitle: 'The load is taken up.',
    card: (dead, next) => dead + ' is dead. ' + next + ' takes up the load.',
    takeUp: 'You take up the load. The company goes on.',
    endTitle: 'The company ends here.',
    end: 'Both are dead. There is no one left to take up the load.',
    deadTitle: 'The dead',
    deadNamed: (n) => n + '. Named.',
    deadUnnamed: (n) => n + '. Not named.',
    journal: 'The company goes on. The dead are written in the roll.',
  };
  const CARTER = { id: 'carter', bg: 'carter', name: 'The causeway carter', hp: 120, hpMax: 120 };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function person(id, bg, name, hp) {
    const n = Math.max(1, Math.round(hp || 100));
    return { id, bg: bg || id, name: name || 'The traveller', alive: true, hp: n, hpMax: n, named: false };
  }
  function make(opts) {
    const o = opts || {}, bg = o.bg || 'deserter';
    const people = [person('you', bg, o.name, o.hp)];
    if (o.companion !== null) people.push(person(CARTER.id, CARTER.bg, CARTER.name, CARTER.hp));
    return { v: V, active: 'you', people, dead: [] };
  }
  function find(c, id) { return c && Array.isArray(c.people) ? c.people.find((p) => p.id === id) || null : null; }
  function activePerson(c) { return c ? find(c, c.active) || c.people.find((p) => p && p.alive) || null : null; }

  function kill(c, id, cause) {
    const p = find(c, id);
    if (!p || !p.alive) return null;
    p.alive = false; p.hp = 0;
    const e = { id: p.id, name: p.name, cause: String(cause || ''), named: !!p.named };
    c.dead.push(e);
    return e;
  }
  function successor(c) {
    if (!c || !Array.isArray(c.people)) return null;
    return c.people.find((p) => p && p.alive && p.id !== c.active) || c.people.find((p) => p && p.alive) || null;
  }
  function takeUp(c, id) {
    const p = find(c, id || (successor(c) && successor(c).id));
    if (!p || !p.alive) return null;
    c.active = p.id;
    return p;
  }
  const ended = (c) => !c || !Array.isArray(c.people) || !c.people.some((p) => p && p.alive);
  const roll = (c) => (c && Array.isArray(c.dead) ? c.dead.map((d) => ({ name: d.name, named: !!d.named, cause: d.cause || '' })) : []);

  // A save without a company is a one-person company: it cannot invent a companion the old run never had.
  function load(raw, opts) {
    const o = opts || {};
    if (!raw || raw.v !== V || !Array.isArray(raw.people) || !raw.people.length) return make({ bg: o.bg, name: o.name, hp: o.hp, companion: o.companion });
    const people = [];
    for (const p of raw.people) {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string') continue;
      const n = person(p.id, p.bg || (p.id === 'carter' ? 'carter' : o.bg), p.name, p.hpMax || p.hp);
      n.alive = p.alive !== false;
      n.hp = n.alive ? clamp(+p.hp || 0, 0, n.hpMax) : 0;
      n.named = !!p.named;
      people.push(n);
    }
    if (!people.length) return make({ bg: o.bg, name: o.name, hp: o.hp, companion: o.companion });
    const live = people.find((p) => p.alive);
    const active = people.some((p) => p.id === raw.active && p.alive) ? raw.active : (live ? live.id : people[0].id);
    const dead = (Array.isArray(raw.dead) ? raw.dead : []).filter((d) => d && typeof d === 'object')
      .map((d) => ({ id: String(d.id || ''), name: String(d.name || ''), cause: String(d.cause || ''), named: !!d.named }));
    return { v: V, active, people, dead };
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false;
  const here = () => !!(typeof G !== 'undefined' && G && (G.mapId === LEDGE1.LEDGE || G.mapId === LEDGE1.BOTHY));
  function current() { try { return G.flags && G.flags.la_company; } catch (e) { return null; } }
  function ensure() {
    const c = load(current(), { bg: (G.flags && G.flags.la_bg) || 'deserter', name: G.player && G.player.name, hp: G.player && G.player.hpMax, companion: 'carter' });
    if (G.flags) G.flags.la_company = c;
    return c;
  }
  function migrate() {
    if (!G || !G.flags) return null;
    // A save written before this phase has no company. Give it one person, not a companion it never met.
    const c = load(G.flags.la_company, { bg: G.flags.la_bg || 'deserter', name: G.player && G.player.name, hp: G.player && G.player.hpMax, companion: null });
    G.flags.la_company = c;
    return c;
  }
  function showCard(dead, next) {
    if (typeof document === 'undefined') return;
    const t = document.getElementById('death-title'), x = document.getElementById('death-text');
    if (t) t.textContent = TX.cardTitle;
    if (x) x.textContent = TX.card(dead.name, next.name);
    const wake = document.getElementById('btn-wake'); if (wake) wake.hidden = true;
    const hc = document.getElementById('btn-hardcore-title'); if (hc) hc.hidden = true;
    let btn = document.getElementById('btn-company');
    if (!btn) {
      btn = document.createElement('button'); btn.className = 'dfbtn'; btn.id = 'btn-company';
      const host = document.querySelector('#death .death-inner') || (wake && wake.parentNode);
      if (host) host.appendChild(btn);
    }
    btn.hidden = false; btn.textContent = 'Take up the load';
    btn.onclick = () => { takeUpAndGo(next.id); };
    show('#death');
  }
  function takeUpAndGo(id) {
    const c = ensure(), p = takeUp(c, id);
    if (!p) return;
    PANEL10.applyBg(p.bg, { keepPlace: true });
    G.player.hp = p.hp; G.player.hpMax = p.hpMax;
    G.flags.la_company = c;
    hide('#death'); G.dead = false; G.keys = {}; G.noise = 2; G.stillT = 0;
    loadMap(G.flags.la_hearth ? LEDGE1.BOTHY : LEDGE1.LEDGE);
    G.state = 'play';
    journal('side', TX.journal);
    msg(TX.takeUp, 'warn', 6500);
  }
  function endScreen() {
    if (typeof document === 'undefined') return;
    const t = document.getElementById('death-title'), x = document.getElementById('death-text');
    if (t) t.textContent = TX.endTitle;
    if (x) x.textContent = TX.end;
    const wake = document.getElementById('btn-wake'); if (wake) wake.hidden = true;
    const hc = document.getElementById('btn-hardcore-title'); if (hc) hc.hidden = true;
    let btn = document.getElementById('btn-company');
    if (!btn) {
      btn = document.createElement('button'); btn.className = 'dfbtn'; btn.id = 'btn-company';
      const host = document.querySelector('#death .death-inner') || (wake && wake.parentNode);
      if (host) host.appendChild(btn);
    }
    btn.hidden = false; btn.textContent = 'Return to the title';
    btn.onclick = () => {
      hide('#death'); hide('#ending'); hide('#event'); G.dead = false; G.state = 'title';
      $('#view').classList.remove('unwrite'); $('#msgs').innerHTML = ''; show('#title'); Audio_.setScene('title');
    };
    show('#death');
  }
  function pass(src) {
    if (!here() || typeof hardcoreOn === 'function' && hardcoreOn()) return false;
    const c = ensure(), p = activePerson(c);
    if (!p || !p.alive) return false;
    G.dead = true; G.dragBody = null; G.state = 'dead'; G.player.hp = 0;
    const cover = document.getElementById('cover-status'); if (cover) cover.hidden = true;
    const dead = kill(c, p.id, src);
    const next = successor(c);
    G.flags.la_company = c;
    if (!next) { endScreen(); return true; }
    showCard(dead, next);
    return true;
  }
  function wire() {
    if (wired || typeof window === 'undefined' || typeof G === 'undefined' || typeof PANEL10 === 'undefined' || typeof LEDGE1 === 'undefined') return false;
    const _choose = PANEL10.choose;
    PANEL10.choose = function (id) {
      const r = _choose.apply(this, arguments);
      try { if (here() || G.flags) ensure(); } catch (e) { /* the card still works */ }
      return r;
    };
    // Audit fix: the creation screen's click handler calls panel10's own closed-over choose(), so the wrapper above never
    // ran in play and the company (and so the roll) did not exist until a death. Read the chosen card from the click, as
    // js/kit17.js does, after the handler has run.
    if (typeof document !== 'undefined') document.addEventListener('click', (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest('#la-who [data-bg]') : null;
      if (!el) return;
      setTimeout(() => { try { if (G && G.flags) { G.flags.la_company = null; ensure(); } } catch (e) { /* the card still works */ } }, 0);
    }, true);
    const _die = die;
    die = function (src) {
      try { if (pass(src)) return; } catch (e) { /* fall through to the engine's death */ }
      return _die.apply(this, arguments);
    };
    const _lm = loadMap;
    loadMap = function (id, pos) {
      const r = _lm.apply(this, arguments);
      try { if (id === LEDGE1.BOTHY && G.flags) G.flags.la_hearth = true; } catch (e) { /* the hearth stays unknown */ }
      return r;
    };
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () { const r = _rg.apply(this, arguments); try { migrate(); } catch (e) { /* one person stands */ } return r; };
    }
    wired = true;
    return true;
  }

  return { V, TX, make, kill, successor, takeUp, ended, roll, load, activePerson, find, wire, state: current, _pass: pass, CARTER };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = COMPANY12;
if (typeof window !== 'undefined') COMPANY12.wire();
