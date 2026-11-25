// ============================================================
//  chart26 - Phase 26, the chart from the ledge to Wexhaven.
//
//  The walk south, on the atlas's legs (O18, LP5): seven places and six roads, 315 miles and 28 days, as
//  docs/worldbuilding/atlas/1-scale-and-distances.md ("The walk south") gives them and atlas/10-zones.md ("How the
//  zones join") splits them. The chart gives the shortest way in days, the food and fuel that way spends for the
//  company, and the day count. It refuses a road the company cannot provision; it does not teleport and it does not
//  know a road that is not on the table.
//
//  Units (atlas/10-zones.md, approved as O16): food is one ration a traveller a day; fuel one a traveller a night
//  not spent at a hearth. The two Chart legs (C1, C2) carry the zone plan's own figures. The four walked seams carry
//  one fuel a night for every day, because no hearth on them is recorded yet [PROPOSED].
// ============================================================
'use strict';

const CHART26 = (() => {
  const NODES = ['ledge', 'coldbarrow', 'watchhouse', 'brackenreach', 'southern_reach', 'whitlow_grange', 'wexhaven'];
  const NAMES = {
    ledge: 'The ledge', coldbarrow: 'Coldbarrow', watchhouse: "The Wayfarer's Watchhouse", brackenreach: 'Brackenreach',
    southern_reach: "The fen's southern reach", whitlow_grange: 'Whitlow Grange', wexhaven: 'Wexhaven',
  };
  // food and fuel are a traveller's; `walked` is a seam walked inside the zones, `chart` a leg travelled on the Chart
  const ROADS = [
    { id: 'Z1', a: 'ledge', b: 'coldbarrow', via: 'the upper road', miles: 18, days: 2, food: 2, fuel: 2, kind: 'walked' },
    { id: 'Z2', a: 'coldbarrow', b: 'watchhouse', via: 'the Bell Road', miles: 80, days: 7, food: 7, fuel: 7, kind: 'walked' },
    { id: 'Z3', a: 'watchhouse', b: 'brackenreach', via: 'the Old Causeway', miles: 60, days: 5, food: 5, fuel: 5, kind: 'walked' },
    { id: 'C1', a: 'brackenreach', b: 'southern_reach', via: 'the Salt Trace', miles: 36, days: 4, food: 4, fuel: 3, kind: 'chart' },
    { id: 'Z5', a: 'southern_reach', b: 'whitlow_grange', via: "the Salt Trace's Downs stretch", miles: 61, days: 5, food: 5, fuel: 5, kind: 'walked' },
    { id: 'C2', a: 'whitlow_grange', b: 'wexhaven', via: 'across the Downs', miles: 60, days: 5, food: 5, fuel: 4, kind: 'chart' },
  ];
  const from = 'ledge';
  // the company of two (Phase 12) unless the caller says otherwise
  const TRAVELLERS = 2;

  function roadsAt(node) { return ROADS.filter((r) => r.a === node || r.b === node); }
  function other(r, node) { return r.a === node ? r.b : r.a; }
  const count = (n) => Math.max(1, Math.floor(+n || TRAVELLERS));

  function shortest(to, travellers) {
    const k = count(travellers);
    if (!NODES.includes(to) || to === from) return { days: 0, miles: 0, food: 0, fuel: 0, path: [from], legs: [] };
    const best = {}, prev = {}, seen = {};
    NODES.forEach((n) => { best[n] = Infinity; });
    best[from] = 0;
    for (let i = 0; i < NODES.length; i++) {
      let at = null;
      NODES.forEach((n) => { if (!seen[n] && (at === null || best[n] < best[at])) at = n; });
      if (at === null || best[at] === Infinity) break;
      seen[at] = true;
      roadsAt(at).forEach((r) => {
        const n = other(r, at), d = best[at] + r.days;
        if (d < best[n]) { best[n] = d; prev[n] = at; }
      });
    }
    if (best[to] === Infinity) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    let food = 0, fuel = 0, miles = 0;
    const legs = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const r = ROADS.find((x) => (x.a === path[i] && x.b === path[i + 1]) || (x.b === path[i] && x.a === path[i + 1]));
      food += r.food * k; fuel += r.fuel * k; miles += r.miles; legs.push(r.id);
    }
    return { days: best[to], miles, food, fuel, path, legs };
  }

  function canTravel(stores, to, travellers) {
    const r = shortest(to, travellers);
    return !!r && (+stores.food || 0) >= r.food && (+stores.fuel || 0) >= r.fuel;
  }

  function travel(s, to) {
    const r = shortest(to, s.travellers);
    if (!r || !canTravel(s.stores || {}, to, s.travellers)) return null;
    s.stores.food -= r.food; s.stores.fuel -= r.fuel;
    s.day = (+s.day || 0) + r.days;
    s.node = to;
    return r;
  }

  const dateOf = (day) => {
    const d = Math.max(0, Math.floor(+day || 0));
    return { day: (d % 30) + 1, month: Math.floor(d / 30) + 1 };
  };
  const nodeKnown = (n) => NODES.includes(n);

  return { NODES, NAMES, ROADS, from, TRAVELLERS, roadsAt, shortest, canTravel, travel, dateOf, nodeKnown };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CHART26;
