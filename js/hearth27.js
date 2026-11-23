// ============================================================
//  hearth27 - Phase 27, the hearth and the names.
//
//  A hearth rests the company, keeps the store, names the dead and records promises. It does not generate
//  food, heal a lung or return the dead. Roster names stay caller-supplied until the owner rules on them.
// ============================================================
'use strict';

const HEARTH27 = (() => {
  function make(node) { return { node: node || 'la_bothy', day: 0, food: 0, fuel: 0, roster: [], dead: [], promises: [] }; }

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

  return { make, rest, mend, nameDead, promise, store, join, names, deadNames };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HEARTH27;
