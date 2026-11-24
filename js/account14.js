// ============================================================
//  account14 - Phase 14, the Account.
//
//  One book every player can open, in three kinds of page: what is owed to us, what is owed by us, and the
//  receipts. A promise is entered under the person's name; others may stand surety or stand apart; a broken
//  word is forsworn permanently. Nothing is deleted. Nobody votes; the book writes down every disagreement.
//
//  The rules are pure (js/account14.js). The wire gives the book to A as an overlay that does NOT set
//  G.state = 'panel', so the world keeps its clock; puts the first promise in Marget's mouth; marks promises at
//  the bothy's rest; and keeps the ledger in G.flags.la_account through the engine's save.
//
//  Plain ASCII. No random number and no clock. Salt, not sovereigns.
// ============================================================
'use strict';

const ACCOUNT14 = (() => {
  const V = 1;
  const TX = {
    title: 'The Account',
    owedToUs: 'Owed to us',
    owedByUs: 'Owed by us',
    promises: 'Promises',
    receipts: 'The receipts',
    empty: 'Nothing written here yet.',
    forswornTitle: 'Forsworn',
    open: 'Open',
    kept: 'Kept',
    broken: 'Broken',
    forsworn: 'Forsworn',
    salt: (n) => n + (n === 1 ? ' measure of salt' : ' measures of salt'),
    bookLine: 'The Account opens with X. It does not stop the world.',
    promise: 'We will bring you to whoever answers for the Crown, and bring back their answer.',
    promiseText: 'Bring Marget Sayle to whoever answers for the Crown, and bring back their answer.',
    promiseTaken: 'You give your word. The Account writes it under your name.',
    promiseRefused: 'You say nothing. She nods once, as if she expected it.',
    giveWord: 'Give your word.',
    notYet: 'Not yet.',
    hearthKept: (t) => 'Kept: ' + t,
    hearthBroken: (t) => 'Broken: ' + t,
    hearthAsk: (t) => 'At the hearth, the word you gave: ' + t,
    noPromise: 'No promise falls due at this hearth.',
    forswornLine: (n) => n + ' is forsworn.',
  };
  const KINDS = ['owedToUs', 'owedByUs', 'promise', 'receipt'];
  const STATES = ['open', 'kept', 'broken'];
  const clean = (s, n) => String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, '').slice(0, n || 300);
  function line(e) {
    const state = e.state === 'kept' ? TX.kept : e.state === 'broken' ? TX.broken : TX.open;
    return e.text + ' (' + e.person + '; ' + state + ')';
  }
  function make() { return { v: V, entries: [], forsworn: {}, next: 1 }; }
  function add(c, e) {
    if (!c || !e || !KINDS.includes(e.kind) || !e.text) return null;
    const entry = {
      id: clean(e.id || ('a' + (c.next || 1)), 40), kind: e.kind, text: clean(e.text, 300),
      person: clean(e.person || 'the company', 80), due: Number.isFinite(+e.due) ? +e.due : null,
      state: STATES.includes(e.state) ? e.state : 'open', surety: [], apart: [],
    };
    if (Array.isArray(e.surety)) entry.surety = e.surety.map((s) => clean(s, 80)).filter(Boolean);
    if (Array.isArray(e.apart)) entry.apart = e.apart.map((s) => clean(s, 80)).filter(Boolean);
    if (!e.id) c.next = (c.next || 1) + 1;
    c.entries.push(entry);
    return entry;
  }
  const byId = (c, id) => c && Array.isArray(c.entries) ? c.entries.find((e) => e.id === id) || null : null;
  // Promises whose day has come. mark() records that the hearth saw them; it does not decide the verdict.
  function due(c, day) {
    return (c && Array.isArray(c.entries) ? c.entries : []).filter((e) => e.kind === 'promise' && e.state === 'open' && e.due != null && e.due <= day);
  }
  function mark(c, day) { const list = due(c, day); for (const e of list) e.marked = day; return list; }
  function keep(c, id) { const e = byId(c, id); if (!e) return false; e.state = 'kept'; return true; }
  function breakWord(c, id) {
    const e = byId(c, id); if (!e) return false;
    e.state = 'broken'; c.forsworn[e.person] = true;
    return true;
  }
  function standSurety(c, id, person) {
    const e = byId(c, id), n = clean(person, 80); if (!e || !n) return false;
    if (!e.surety.includes(n)) e.surety.push(n);
    return true;
  }
  function standApart(c, id, person) {
    const e = byId(c, id), n = clean(person, 80); if (!e || !n) return false;
    if (!e.apart.includes(n)) e.apart.push(n);
    return true;
  }
  const forsworn = (c, person) => !!(c && c.forsworn && c.forsworn[clean(person, 80)]);
  function pages(c) {
    const all = c && Array.isArray(c.entries) ? c.entries : [];
    const out = { owedToUs: [], owedByUs: [], promises: [], receipts: [], forsworn: [] };
    for (const e of all) (out[e.kind === 'promise' ? 'promises' : e.kind === 'receipt' ? 'receipts' : e.kind === 'owedByUs' ? 'owedByUs' : 'owedToUs']).push(line(e));
    if (c && c.forsworn) for (const n in c.forsworn) if (c.forsworn[n]) out.forsworn.push(TX.forswornLine(n));
    return out;
  }
  function load(raw) {
    if (!raw || raw.v !== V || !Array.isArray(raw.entries)) return make();
    const c = make();
    c.next = Math.max(1, raw.next | 0);
    for (const e of raw.entries) {
      if (!e || !KINDS.includes(e.kind) || !e.text) continue;
      const entry = add(c, e); if (entry && e.id) entry.id = clean(e.id, 40);
    }
    if (raw.forsworn && typeof raw.forsworn === 'object') for (const k in raw.forsworn) if (raw.forsworn[k]) c.forsworn[clean(k, 80)] = true;
    return c;
  }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false, OPEN = false;
  const KEY = 'x';
  const bound = (k) => { try { return typeof UPG !== 'undefined' && !!UPG.keybinds && Object.values(UPG.keybinds).includes(k); } catch (e) { return false; } };
  const here = () => typeof G !== 'undefined' && G && (G.mapId === LEDGE1.LEDGE || G.mapId === LEDGE1.BOTHY);
  function current() { try { return G.flags && G.flags.la_account; } catch (e) { return null; } }
  function ensure() {
    const c = load(current());
    if (G.flags) G.flags.la_account = c;
    return c;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x])); }
  function section(title, rows) {
    return `<h3>${esc(title)}</h3>${rows.length ? rows.map((r) => `<p>${esc(r)}</p>`).join('') : `<p class="muted">${esc(TX.empty)}</p>`}`;
  }
  function open() {
    if (typeof document === 'undefined' || !here()) return false;
    const c = ensure(), p = pages(c);
    const was = G.state;
    openModal(`<h2>${TX.title}</h2><button class="dfbtn small close" id="x">Close</button>
      ${section(TX.owedToUs, p.owedToUs)}${section(TX.owedByUs, p.owedByUs)}
      ${section(TX.promises, p.promises)}${section(TX.receipts, p.receipts)}${section(TX.forswornTitle, p.forsworn)}
      <p class="muted">${esc(TX.bookLine)}</p>`, 'account');
    G.state = was === 'play' ? 'play' : was;   // the book is an overlay, not a pause
    const x = document.getElementById('x'); if (x) x.onclick = () => close();
    OPEN = true;
    return true;
  }
  function close() { OPEN = false; closeModal(); if (G.state !== 'play' && G.state !== 'dead' && G.state !== 'event') G.state = 'play'; }
  function promise() {
    const c = ensure();
    if (c.entries.some((e) => e.kind === 'promise' && e.person === G.player.name)) return false;
    add(c, { kind: 'promise', text: TX.promiseText, person: G.player.name, due: G.day, state: 'open' });
    G.flags.la_marget_promise = true;
    journal('side', TX.promiseTaken);
    msg(TX.promiseTaken, 'good', 6500);
    return true;
  }
  function askPromise() {
    if (!here() || !G || !G.player) return;
    // Marget asks after the player has heard her say what the south is doing.
    if (!G.flags.la_marget_south || G.flags.la_marget_promise) return;
    const e = G.ents.find((q) => q.id === 'la_marget'); if (!e) return;
    showEvent('Marget Sayle', TX.promise, [
      { t: TX.giveWord, f: () => promise() },
      { t: TX.notYet, f: () => { msg(TX.promiseRefused, '', 3500); } },
    ]);
  }
  function hearth() {
    const c = ensure(), list = due(c, G.day);
    if (!list.length) { msg(TX.noPromise, '', 2500); return; }
    const e = list[0];
    showEvent('The hearth', TX.hearthAsk(e.text), [
      { t: 'It was kept.', f: () => { keep(c, e.id); msg(TX.hearthKept(e.text), 'good', 5500); } },
      { t: 'It was broken.', f: () => { breakWord(c, e.id); msg(TX.hearthBroken(e.text), 'bad', 6500); } },
    ]);
  }
  function wire() {
    if (wired || typeof window === 'undefined' || typeof G === 'undefined' || typeof LEDGE1 === 'undefined') return false;
    const c = ensure();
    const _ask = askTopic;
    askTopic = function (t) {
      const r = _ask.apply(this, arguments);
      try {
        if (t === 'The south' && DLG.npc && DLG.npc.name === LEDGE1.TX.marget) {
          G.flags.la_marget_south = true;
          if (!G.flags.la_marget_promise && !c.entries.some((e) => e.kind === 'promise' && e.person === G.player.name)) {
            DLG.choices = [
              { t: TX.giveWord, f: () => { promise(); return TX.promiseTaken; } },
              { t: TX.notYet, f: () => { msg(TX.promiseRefused, '', 3000); return TX.promiseRefused; } },
            ];
          }
        }
      } catch (e) { /* the topic still answers */ }
      return r;
    };
    const _rest = doRest;
    doRest = function (kind) {
      const r = _rest.apply(this, arguments);
      try { if (G.mapId === LEDGE1.BOTHY) setTimeout(hearth, 300); } catch (e) { /* the rest stands */ }
      return r;
    };
    window.addEventListener('keydown', (ev) => {
      if (G.state !== 'play') return;
      const k = String(ev.key || '').toLowerCase();
      // Phase 39 fix: the Account was on A, and this listener ran first and swallowed the key, so A never walked left.
      // It is on X now [PROPOSED], and it gives way to any key the player has bound to walking or anything else.
      if (k === KEY && !bound(k) && !ev.repeat && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); ev.stopImmediatePropagation(); open(); }
      else if (k === 'escape' && OPEN) { ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
    }, true);
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () { const r = _rg.apply(this, arguments); try { ensure(); } catch (e) { /* the old save gets a new book */ } return r; };
    }
    wired = true;
    return true;
  }
  return { V, TX, KEY, KINDS, make, add, due, mark, keep, break: breakWord, standSurety, standApart, forsworn, pages, load, wire, open, close, promise, hearth, state: current };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ACCOUNT14;
if (typeof window !== 'undefined') ACCOUNT14.wire();
