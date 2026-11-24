// ============================================================
//  hearth27 - Phase 27, the hearth and the names.
//
//  A hearth rests the company, keeps the store, names the dead and records promises. It does not generate
//  food, heal a lung or return the dead. Roster names stay caller-supplied until the owner rules on them.
//
//  WIRED: at Marget Sayle's bothy, REST opens this hearth instead of the engine's roadside rest. The panel
//  rests four or eight hours, keeps a food/oil store, names an unnamed person in the company roll, and
//  records the promises already in the Account. The state lives in G.flags.la_hearth27 through the engine's
//  save. The pure rules above are unchanged.
//
//  [PROPOSED] The panel's connective wording, the store's starting emptiness and its take/leave labels are
//  proposed defaults; the rest, mend, name, promise and store rules are the phase's. Wounds and frost have
//  no source in the copied engine yet, so the wire keeps mend on a body copy and lets the engine's rest
//  supply fatigue; the two fields stay ready for a future source.
// ============================================================
'use strict';

const HEARTH27 = (() => {
  const V = 1;
  const TX = {
    title: 'The hearth',
    lead: 'The bothy fire is banked. The room is warm at the edge and cold beyond it.', // [PROPOSED]
    company: 'The company',
    dead: 'The dead',
    promises: 'Promises',
    store: 'The bothy store',
    named: 'Named.', // [PROPOSED]
    unnamed: 'Not named.', // [PROPOSED]
    nameThem: 'Name them.', // [PROPOSED]
    noDead: 'No one is written in the roll yet.', // [PROPOSED]
    noPromise: 'No promise is written in the Account.', // [PROPOSED]
    food: (n) => n + (n === 1 ? ' meal' : ' meals'),
    fuel: (n) => n + (n === 1 ? ' flask' : ' flasks'),
    leaveFood: 'Leave a smoked eel', // [PROPOSED]
    takeFood: 'Take a smoked eel', // [PROPOSED]
    leaveFuel: 'Leave a flask of oil', // [PROPOSED]
    takeFuel: 'Take a flask of oil', // [PROPOSED]
    restFour: 'Rest four hours', // [PROPOSED]
    restEight: 'Rest eight hours', // [PROPOSED]
    restFourNote: 'Half rest. If something comes, you hear it.', // [PROPOSED]
    restEightNote: 'Full rest at the hearth.', // [PROPOSED]
    restDone: 'You rest at the hearth.', // [PROPOSED]
    namedDone: (name) => 'At the hearth, you name ' + name + '.', // [PROPOSED]
    close: 'Close',
  };

  function make(node) { return { v: V, node: node || 'la_bothy', day: 0, food: 0, fuel: 0, roster: [], dead: [], promises: [] }; }

  function rest(s, days) {
    const d = Math.max(0, Math.floor(+days || 0));
    s.day = (+s.day || 0) + d;
    return d;
  }

  // Wounds and frost mend at the hearth; exhaustion goes first. Lungs never mend here.
  function mend(p, days) {
    if (!p || p.dead) return p;
    const d = Math.max(0, Math.floor(+days || 0));
    p.tired = Math.max(0, (+p.tired || 0) - d);
    p.wounds = Math.max(0, (+p.wounds || 0) - Math.floor(d / 3));
    p.frost = Math.max(0, (+p.frost || 0) - Math.floor(d / 2));
    return p;
  }

  function nameDead(s, name, cause) {
    if (!s || !name) return null;
    const row = { name: String(name), cause: String(cause || 'unknown'), day: +s.day || 0 };
    s.dead.push(row); s.roster = s.roster.filter((n) => n !== name);
    return row;
  }

  function promise(s, text, person) {
    if (!s || !text) return null;
    const row = { text: String(text), person: person ? String(person) : null, day: +s.day || 0 };
    s.promises.push(row);
    return row;
  }

  function store(s, o) {
    s.food = Math.max(0, (+s.food || 0) + (+o.food || 0));
    s.fuel = Math.max(0, (+s.fuel || 0) + (+o.fuel || 0));
    return { food: s.food, fuel: s.fuel };
  }

  function join(s, name) {
    if (s.roster.includes(name) || s.dead.some((d) => d.name === name)) return false;
    s.roster.push(name); return true;
  }

  const names = (s) => s.roster.slice();
  const deadNames = (s) => s.dead.map((d) => d.name);

  // A save is a copy, not a view: validate the parts this phase owns and keep the pure shape.
  function load(raw, node) {
    const s = make(node || (raw && typeof raw.node === 'string' ? raw.node : null));
    if (!raw || typeof raw !== 'object') return s;
    s.day = Math.max(0, Math.floor(+raw.day || 0));
    s.food = Math.max(0, Math.floor(+raw.food || 0));
    s.fuel = Math.max(0, Math.floor(+raw.fuel || 0));
    if (Array.isArray(raw.roster)) for (const n of raw.roster) if (typeof n === 'string' && n) join(s, n);
    if (Array.isArray(raw.dead)) for (const d of raw.dead) {
      if (!d || typeof d.name !== 'string' || !d.name || s.dead.some((x) => x.name === d.name)) continue;
      s.dead.push({ name: d.name, cause: String(d.cause || 'unknown'), day: Math.max(0, Math.floor(+d.day || 0)) });
      s.roster = s.roster.filter((n) => n !== d.name);
    }
    if (Array.isArray(raw.promises)) for (const p of raw.promises) {
      if (!p || typeof p.text !== 'string' || !p.text) continue;
      if (s.promises.some((x) => x.text === p.text && x.person === (p.person == null ? null : String(p.person)))) continue;
      s.promises.push({ text: p.text, person: p.person == null ? null : String(p.person), day: Math.max(0, Math.floor(+p.day || 0)) });
    }
    return s;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false, ORIG = null;
  const here = () => {
    try { return typeof G !== 'undefined' && G && typeof LEDGE1 !== 'undefined' && G.mapId === LEDGE1.BOTHY; } catch (e) { return false; }
  };
  const save = (s) => { try { if (s && G && G.flags) G.flags.la_hearth27 = s; } catch (e) { /* the panel still reads */ } };
  const company = () => {
    try { const c = G && G.flags && G.flags.la_company; return c && typeof c === 'object' ? c : null; } catch (e) { return null; }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function ensure() {
    if (typeof G === 'undefined' || !G || !G.flags) return make();
    const s = load(G.flags.la_hearth27, G.mapId || 'la_bothy');
    s.node = G.mapId || s.node;
    s.day = Math.max(0, G.day | 0);
    sync(s);
    G.flags.la_hearth27 = s;
    return s;
  }

  function accountPromises() {
    try {
      const A = typeof ACCOUNT14 !== 'undefined' ? ACCOUNT14 : null;
      const c = A && A.state ? A.state() : null;
      return c && Array.isArray(c.entries) ? c.entries.filter((e) => e && e.kind === 'promise') : [];
    } catch (e) { return []; }
  }

  function syncPromises(s) {
    for (const e of accountPromises()) {
      if (!e || !e.text) continue;
      if (!s.promises.some((p) => p.text === e.text && p.person === e.person)) promise(s, e.text, e.person);
    }
  }

  function sync(s) {
    if (!s || !G) return s;
    s.node = G.mapId || s.node;
    s.day = Math.max(0, G.day | 0);
    const c = company();
    if (c && Array.isArray(c.people) && c.people.length) {
      const alive = [];
      for (const p of c.people) if (p && p.alive && p.name) { join(s, p.name); alive.push(p.name); }
      s.roster = s.roster.filter((n) => alive.includes(n));
      for (const d of (Array.isArray(c.dead) ? c.dead : [])) {
        if (!d || !d.name || !d.named || s.dead.some((x) => x.name === d.name)) continue;
        nameDead(s, d.name, d.cause);
      }
    } else if (G.player && G.player.name) join(s, G.player.name);
    syncPromises(s);
    return s;
  }

  function hasFire() {
    try {
      const list = (G && G.map && Array.isArray(G.map.entities) ? G.map.entities : (G && Array.isArray(G.ents) ? G.ents : []));
      return list.some((e) => e && !e.hidden && e.sprite === 'la_hearth' && (+e.glow || 0) >= 0.5);
    } catch (e) { return false; }
  }

  // The engine refuses a rest with a hunter close or a clock running; the hearth keeps that rule.
  function canRest() {
    if (typeof G === 'undefined' || !G) return false;
    if ((+G.escapeTimer || 0) > 0 || (+G.boreHold || 0) > 0) return false;
    try {
      if (typeof Engine === 'undefined' || !Engine || !Engine.cam) return true;
      const x = +Engine.cam.x || 0, y = +Engine.cam.y || 0;
      const list = Array.isArray(G.ents) ? G.ents : [];
      return !list.some((e) => e && e.kind === 'enemy' && !e.dead && !e.hidden && e.state === 'chase' &&
        (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < 144);
    } catch (e) { return true; }
  }

  function countItem(id) {
    try {
      const inv = G && G.player && Array.isArray(G.player.inv) ? G.player.inv : [];
      return inv.reduce((n, s) => n + (s && s.id === id ? (+s.n || 1) : 0), 0);
    } catch (e) { return 0; }
  }

  function takeItem(id) {
    try {
      const inv = G && G.player && Array.isArray(G.player.inv) ? G.player.inv : null;
      if (!inv) return false;
      const i = inv.findIndex((s) => s && s.id === id);
      if (i < 0) return false;
      if ((+inv[i].n || 1) > 1) inv[i].n = (+inv[i].n || 1) - 1; else inv.splice(i, 1);
      return true;
    } catch (e) { return false; }
  }

  function giveItem(id) {
    try { if (G && typeof G.give === 'function') { G.give(id); return true; } } catch (e) { /* use the pack below */ }
    try {
      const inv = G.player.inv || (G.player.inv = []);
      const slot = inv.find((s) => s && s.id === id);
      if (slot) slot.n = (+slot.n || 1) + 1; else inv.push({ id, n: 1 });
      return true;
    } catch (e) { return false; }
  }

  function storeItem(what) {
    if (!here()) return false;
    const s = ensure();
    if (what === 'food-in') {
      if (!takeItem('flume_eel')) return false;
      store(s, { food: 1 });
    } else if (what === 'food-out') {
      if (s.food < 1 || !giveItem('flume_eel')) return false;
      store(s, { food: -1 });
    } else if (what === 'fuel-in') {
      if (!takeItem('oil')) return false;
      store(s, { fuel: 1 });
    } else if (what === 'fuel-out') {
      if (s.fuel < 1 || !giveItem('oil')) return false;
      store(s, { fuel: -1 });
    } else return false;
    save(s);
    return { food: s.food, fuel: s.fuel };
  }

  function nameTheDead(name) {
    if (!here() || !name) return false;
    const c = company(), d = c && Array.isArray(c.dead) ? c.dead.find((x) => x && x.name === name && !x.named) : null;
    if (!d) return false;
    const s = ensure();
    const row = nameDead(s, name, d.cause);
    if (!row) return false;
    d.named = true;
    if (G.flags) G.flags.la_company = c;
    save(s);
    try { if (typeof journal === 'function') journal('side', TX.namedDone(name)); } catch (e) { /* the name stands */ }
    try { if (typeof msg === 'function') msg(TX.namedDone(name), 'good', 3600); } catch (e) { /* the name stands */ }
    return row;
  }

  function restAtHearth(kind) {
    if (!here() || !hasFire() || !canRest() || typeof doRest !== 'function') return false;
    const s = ensure(), p = G && G.player;
    if (!p) return false;
    kind = kind === 'self' ? 'self' : 'lamp';
    const before = G.day | 0;
    const hours = kind === 'self' ? 4 : 8;
    const predicted = Math.floor(((+G.tod || 0) * 24 + hours) / 24);
    const body = { tired: +p.fat || 0, wounds: +p.wounds || 0, frost: +p.frost || 0, lungs: +p.lungs || 0 };
    mend(body, predicted);
    p.fat = Math.max(0, Math.min(+p.fatMax || body.tired, body.tired));
    if (p.wounds != null) p.wounds = body.wounds;
    if (p.frost != null) p.frost = body.frost;
    try { doRest(kind); } catch (e) { return false; }
    const days = Math.max(0, (G.day | 0) - before);
    rest(s, days);
    s.day = Math.max(0, G.day | 0);
    sync(s);
    save(s);
    try { if (typeof closeModal === 'function') closeModal(); } catch (e) { /* the panel closes */ }
    if (G) G.state = 'play';
    try { if (typeof msg === 'function') msg(TX.restDone, 'good', 3200); } catch (e) { /* the rest stands */ }
    return true;
  }

  function open() {
    if (!here() || !hasFire() || typeof openModal !== 'function') return false;
    const s = ensure(), c = company();
    const alive = (c && Array.isArray(c.people) ? c.people.filter((p) => p && p.alive && p.name).map((p) => p.name) : names(s));
    const dead = [];
    for (const d of (c && Array.isArray(c.dead) ? c.dead : [])) if (d && d.name) dead.push({ name: d.name, cause: d.cause || '', named: !!d.named });
    for (const d of s.dead) if (!dead.some((x) => x.name === d.name)) dead.push({ name: d.name, cause: d.cause || '', named: true });
    const promises = accountPromises().map((e) => ({ text: e.text, person: e.person, state: e.state || 'open' }));
    for (const p of s.promises) if (!promises.some((x) => x.text === p.text && x.person === p.person)) promises.push({ text: p.text, person: p.person, state: 'open' });

    const companyHtml = alive.length ? alive.map((n) => `<p>${esc(n)}</p>`).join('') : `<p class="muted">${esc(TX.company)}</p>`;
    const deadHtml = dead.length ? dead.map((d) => `<p>${esc(d.name)}. ${esc(d.named ? TX.named : TX.unnamed)}${d.named ? '' : ` <button class="dfbtn small" data-name="${esc(d.name)}">${esc(TX.nameThem)}</button>`}</p>`).join('') : `<p class="muted">${esc(TX.noDead)}</p>`;
    const promiseHtml = promises.length ? promises.map((p) => `<p>${esc(p.text)} <span class="muted">(${esc(p.person || 'the company')}; ${esc(p.state)})</span></p>`).join('') : `<p class="muted">${esc(TX.noPromise)}</p>`;
    const storeHtml = `<p>${esc(TX.food(s.food))}; ${esc(TX.fuel(s.fuel))}.</p>
      <div class="btns">${countItem('flume_eel') ? `<button class="dfbtn small" data-store="food-in">${esc(TX.leaveFood)}</button>` : ''}${s.food > 0 ? `<button class="dfbtn small" data-store="food-out">${esc(TX.takeFood)}</button>` : ''}
      ${countItem('oil') ? `<button class="dfbtn small" data-store="fuel-in">${esc(TX.leaveFuel)}</button>` : ''}${s.fuel > 0 ? `<button class="dfbtn small" data-store="fuel-out">${esc(TX.takeFuel)}</button>` : ''}</div>`;
    const html = `<h2>${esc(TX.title)}</h2><button class="dfbtn small close" id="x">${esc(TX.close)}</button>
      <p class="q">${esc(TX.lead)}</p>
      <p class="muted">Day ${Math.max(1, (G.day | 0) + 1)}${typeof timeName === 'function' ? ', ' + esc(timeName()) : ''}.</p>
      <h3>${esc(TX.company)}</h3>${companyHtml}
      <h3>${esc(TX.dead)}</h3>${deadHtml}
      <h3>${esc(TX.promises)}</h3>${promiseHtml}
      <h3>${esc(TX.store)}</h3>${storeHtml}
      <h3>${esc(TX.restFour)}</h3>
      <p class="muted">${esc(TX.restFourNote)}</p>
      <div class="btns"><button class="dfbtn" data-hrest="self">${esc(TX.restFour)}</button><button class="dfbtn" data-hrest="lamp">${esc(TX.restEight)}</button></div>
      <p class="muted">${esc(TX.restEightNote)}</p>`;
    openModal(html, 'rest');
    if (G) G.state = 'panel';
    if (typeof document !== 'undefined') {
      const x = document.getElementById('x'); if (x) x.onclick = () => { closeModal(); if (G) G.state = 'play'; };
      document.querySelectorAll('[data-hrest]').forEach((b) => { b.onclick = () => { restAtHearth(b.dataset.hrest); }; });
      document.querySelectorAll('[data-store]').forEach((b) => { b.onclick = () => { if (storeItem(b.dataset.store)) open(); }; });
      document.querySelectorAll('[data-name]').forEach((b) => { b.onclick = () => { if (nameTheDead(b.dataset.name)) open(); }; });
    }
    return true;
  }

  function wire() {
    if (wired) return true;
    if (typeof renderRest !== 'function' || typeof openModal !== 'function' || typeof closeModal !== 'function' || typeof doRest !== 'function') return false;
    ORIG = { renderRest };
    const _renderRest = ORIG.renderRest;
    renderRest = function () {
      try { if (here() && hasFire() && canRest() && open()) return; } catch (e) { /* the engine's rest stands */ }
      return _renderRest.apply(this, arguments);
    };
    wired = true;
    return true;
  }

  return {
    V, TX, make, rest, mend, nameDead, promise, store, join, names, deadNames, load,
    wire, state: () => ensure(), open, restAtHearth, nameTheDead, storeItem, hasFire, canRest, ORIG
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HEARTH27;
if (typeof window !== 'undefined') HEARTH27.wire();
