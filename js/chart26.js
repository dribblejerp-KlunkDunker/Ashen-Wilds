// ============================================================
//  chart26 - Phase 26, the chart from the ledge to Wexhaven.
//
//  Five nodes and six roads. The chart gives the shortest way into Wexhaven in days, the supplies that road
//  spends, and the day count's weather. It refuses a road the company cannot provision; it does not
//  teleport and it does not know a road that is not on the table.
// ============================================================
'use strict';

const CHART26 = (() => {
  const NODES = ['ledge', 'bell_road', 'fen', 'salt_trace', 'wexhaven'];
  const ROADS = [
    { a: 'ledge', b: 'bell_road', days: 1, food: 2, fuel: 1 },
    { a: 'bell_road', b: 'fen', days: 2, food: 3, fuel: 1 },
    { a: 'fen', b: 'salt_trace', days: 2, food: 2, fuel: 1 },
    { a: 'salt_trace', b: 'wexhaven', days: 3, food: 4, fuel: 2 },
    { a: 'ledge', b: 'salt_trace', days: 4, food: 5, fuel: 2 },
    { a: 'bell_road', b: 'wexhaven', days: 5, food: 7, fuel: 3 }
  ];
  const from = 'ledge';

  function roadsAt(node) { return ROADS.filter((r) => r.a === node || r.b === node); }
  function other(r, node) { return r.a === node ? r.b : r.a; }

  function shortest(to) {
    if (!NODES.includes(to) || to === from) return { days: 0, food: 0, fuel: 0, path: [from] };
    const best = {}, prev = {}, seen = {};
    NODES.forEach((n) => { best[n] = Infinity; });
    best[from] = 0;
    for (let k = 0; k < NODES.length; k++) {
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
    let food = 0, fuel = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const r = ROADS.find((x) => (x.a === path[i] && x.b === path[i + 1]) || (x.b === path[i] && x.a === path[i + 1]));
      food += r.food; fuel += r.fuel;
    }
    return { days: best[to], food, fuel, path };
  }

  function canTravel(stores, to) {
    const r = shortest(to);
    return !!r && (+stores.food || 0) >= r.food && (+stores.fuel || 0) >= r.fuel;
  }

  function travel(s, to) {
    const r = shortest(to);
    if (!r || !canTravel(s.stores || {}, to)) return null;
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

  return { NODES, ROADS, from, roadsAt, shortest, canTravel, travel, dateOf, nodeKnown };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CHART26;
