// ============================================================
//  zones - draws the zone sketches of docs/worldbuilding/atlas/10-zones.md
//
//  Docs only: the page never loads this. It reads each zone's Size line, its
//  places table and its ways table, writes one SVG per zone into
//  docs/worldbuilding/atlas/zones/, and measures the 30-to-60-second rule
//  (O15) along every way: the walker covers 2.6 cells a second (P33), so the
//  longest stretch of a way with nothing beside it should be 156 cells or less.
//
//      node tools/zones.js            # write the SVGs and print the gaps
//      node tools/zones.js --check    # fail if an SVG is stale or a gap is too long
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOC = path.join(ROOT, 'docs', 'worldbuilding', 'atlas', '10-zones.md');
const OUT = path.join(ROOT, 'docs', 'worldbuilding', 'atlas', 'zones');
const MAP = 384;
// cells: 60 seconds at 2.6 cells a second, and 30 seconds
const LONGEST = 156;
const SHORTEST = 78;
// a place this close to a way is met on it
const NEAR = 70;

const check = process.argv.includes('--check');

function cells(row) {
  return row.split('|').slice(1, -1).map((c) => c.trim());
}

function parse(md) {
  const zones = [];
  let z = null, table = null;
  md.split('\n').forEach((line) => {
    const h = /^## (Z\w+)\. (.+)$/.exec(line);
    if (h) {
      z = { id: h[1].toLowerCase(), name: h[2], w: 0, h: 0, places: [], ways: [] };
      zones.push(z);
      table = null;
      return;
    }
    if (/^## /.test(line)) { z = null; table = null; return; }
    if (!z) return;
    const s = /^\*\*Size:\*\* (\d+) x (\d+)/.exec(line);
    if (s) { z.w = +s[1]; z.h = +s[2]; return; }
    if (!line.startsWith('|')) { table = null; return; }
    const c = cells(line);
    if (c[0] === '#' && c[2] === 'x, y') { table = 'places'; return; }
    if (c[0] === 'Way' && c[2] === 'Points') { table = 'ways'; return; }
    if (/^-+$/.test(c[0].replace(/:/g, ''))) return;
    if (table === 'places') {
      const xy = c[2].split(',').map(Number);
      z.places.push({ n: c[0], name: c[1].replace(/[*`]/g, '').replace(/ \[PROPOSED\]/, ''), x: xy[0], y: xy[1], kind: c[3] });
    } else if (table === 'ways') {
      const pts = c[2].split(/\s+/).map((p) => p.split(',').map(Number));
      z.ways.push({ name: c[0], kind: c[1], pts });
    }
  });
  return zones;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const WAY = {
  road: 'stroke="#6b5a44" stroke-width="5"',
  track: 'stroke="#8a7a62" stroke-width="3" stroke-dasharray="10 6"',
  water: 'stroke="#4a7a9a" stroke-width="4" stroke-dasharray="4 6"',
  under: 'stroke="#7a6a9a" stroke-width="3" stroke-dasharray="2 5"',
  rope: 'stroke="#9a5a3a" stroke-width="2" stroke-dasharray="1 4"'
};

function svg(z) {
  // drawn at a fixed scale so a zone's sketch shows its real size beside the others
  const k = 900 / Math.max(z.w, z.h);
  const W = Math.round(z.w * k), H = Math.round(z.h * k);
  // room on the right for labels that start near the zone's east edge
  const pad = 30, top = 50, right = 230;
  const X = (x) => (pad + x * k).toFixed(1), Y = (y) => (top + y * k).toFixed(1);
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad + right}" height="${H + top + 120}" viewBox="0 0 ${W + pad + right} ${H + top + 120}" font-family="Georgia, serif">`);
  o.push(`<rect width="100%" height="100%" fill="#f4efe4"/>`);
  o.push(`<text x="${pad}" y="22" font-size="16" fill="#222">${esc(z.id.toUpperCase())}. ${esc(z.name)}</text>`);
  o.push(`<text x="${pad}" y="40" font-size="11" fill="#555">${z.w} x ${z.h} cells (1 cell = 1 m). Dashed squares: maps of ${MAP} x ${MAP}. A sketch, not art. Numbers are the rows of the zone's table.</text>`);
  o.push(`<rect x="${pad}" y="${top}" width="${W}" height="${H}" fill="#e9e2d0" stroke="#333" stroke-width="1.5"/>`);
  for (let x = MAP; x < z.w; x += MAP) o.push(`<line x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${Y(z.h)}" stroke="#b9ae96" stroke-dasharray="3 4"/>`);
  for (let y = MAP; y < z.h; y += MAP) o.push(`<line x1="${X(0)}" y1="${Y(y)}" x2="${X(z.w)}" y2="${Y(y)}" stroke="#b9ae96" stroke-dasharray="3 4"/>`);
  z.ways.forEach((w) => {
    o.push(`<polyline fill="none" stroke-linecap="round" stroke-linejoin="round" ${WAY[w.kind] || WAY.track} points="${w.pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>`);
  });
  // labels are placed in turn, each in the first spot that does not cover one already placed
  const taken = [];
  const free = (b) => taken.every((t) => b.x1 < t.x0 || b.x0 > t.x1 || b.y1 < t.y0 || b.y0 > t.y1);
  function label(x, y, n, words) {
    const tries = [[10, 4], [10, -10], [10, 18], [-10, 4], [-10, -10], [-10, 18], [10, -24], [10, 32]];
    for (const full of [words, n]) {
      const w = full.length * 5.3;
      for (const t of tries) {
        const tx = t[0] < 0 ? x + t[0] - w : x + t[0], ty = y + t[1];
        const b = { x0: tx, x1: tx + w, y0: ty - 9, y1: ty + 2 };
        if (b.x0 >= 2 && free(b)) { taken.push(b); return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="10" fill="#111">${esc(full)}</text>`; }
      }
    }
    return `<text x="${x + 10}" y="${y + 4}" font-size="10" fill="#111">${esc(n)}</text>`;
  }
  z.places.forEach((p) => {
    const x = +X(p.x), y = +Y(p.y);
    taken.push({ x0: x - 9, x1: x + 9, y0: y - 9, y1: y + 9 });
  });
  const labels = [];
  z.places.forEach((p) => {
    const x = +X(p.x), y = +Y(p.y);
    if (p.kind === 'complex') o.push(`<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="#3a3a3a" stroke="#000"/>`);
    else if (p.kind === 'atlas') o.push(`<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="#6b5a44" stroke="#000"/>`);
    else if (p.kind === 'new') o.push(`<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="#fff" stroke="#a33" stroke-width="2"/>`);
    else if (p.kind === 'gate') o.push(`<polygon points="${x},${y - 9} ${x + 9},${y} ${x},${y + 9} ${x - 9},${y}" fill="#d8b04a" stroke="#000"/>`);
    else if (p.kind === 'hunt') o.push(`<circle cx="${x}" cy="${y}" r="6" fill="#a33" stroke="#000"/>`);
    else o.push(`<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#555"/>`);
    // wayside things and hunting grounds are numbered only: their words are in the zone's table
    const words = p.kind === 'way' || p.kind === 'hunt' ? p.n : p.n + ' ' + p.name;
    labels.push([x, y, p.n, words, p.kind === 'way' || p.kind === 'hunt' ? 1 : 0]);
  });
  // named places choose their spots first, numbered ones fill in after
  labels.sort((a, b) => a[4] - b[4]).forEach((l) => o.push(label(l[0], l[1], l[2], l[3])));
  const ly = top + H + 24;
  const legend = [
    ['complex', 'great complex: its own maps, true size'], ['atlas', 'atlas place, built in the zone'],
    ['new', 'new small site [PROPOSED]'], ['gate', 'threshold: another zone, the Chart, or below'],
    ['hunt', 'hunting ground'], ['way', 'wayside find or view']
  ];
  legend.forEach((l, i) => {
    const x = pad + (i % 3) * 300, y = ly + Math.floor(i / 3) * 20;
    const kz = { kind: l[0] };
    if (kz.kind === 'complex') o.push(`<rect x="${x}" y="${y - 9}" width="12" height="12" fill="#3a3a3a"/>`);
    else if (kz.kind === 'atlas') o.push(`<rect x="${x}" y="${y - 9}" width="12" height="12" fill="#6b5a44"/>`);
    else if (kz.kind === 'new') o.push(`<rect x="${x}" y="${y - 9}" width="12" height="12" fill="#fff" stroke="#a33" stroke-width="2"/>`);
    else if (kz.kind === 'gate') o.push(`<polygon points="${x + 6},${y - 10} ${x + 12},${y - 3} ${x + 6},${y + 4} ${x},${y - 3}" fill="#d8b04a"/>`);
    else if (kz.kind === 'hunt') o.push(`<circle cx="${x + 6}" cy="${y - 3}" r="6" fill="#a33"/>`);
    else o.push(`<circle cx="${x + 6}" cy="${y - 3}" r="4" fill="#fff" stroke="#555"/>`);
    o.push(`<text x="${x + 18}" y="${y + 1}" font-size="10" fill="#333">${esc(l[1])}</text>`);
  });
  const wy = ly + 50;
  [['road', 'road'], ['track', 'track or path'], ['water', 'by boat or wading'], ['under', 'under ground or roofed'], ['rope', 'rope, ladder or stakes']].forEach((l, i) => {
    const x = pad + i * 180;
    o.push(`<line x1="${x}" y1="${wy}" x2="${x + 30}" y2="${wy}" ${WAY[l[0]]}/>`);
    o.push(`<text x="${x + 36}" y="${wy + 4}" font-size="10" fill="#333">${l[1]}</text>`);
  });
  o.push('</svg>');
  return o.join('\n') + '\n';
}

// where along a polyline a point falls, and how far off it
function project(pts, p) {
  let best = { d: Infinity, at: 0 }, run = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const t = L ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / (L * L))) : 0;
    const d = Math.hypot(a[0] + t * dx - p.x, a[1] + t * dy - p.y);
    if (d < best.d) best = { d, at: run + t * L };
    run += L;
  }
  return { d: best.d, at: best.at, len: run };
}

// the cell at a distance along a polyline
function pointAt(pts, at) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (at <= L || i + 2 === pts.length) {
      const t = L ? Math.min(1, at / L) : 0;
      return Math.round(a[0] + t * (b[0] - a[0])) + ',' + Math.round(a[1] + t * (b[1] - a[1]));
    }
    at -= L;
  }
  return pts[0].join(',');
}

function gaps(z) {
  let walked = 0, worst = 0, worstAt = '', met = 0;
  z.ways.forEach((w) => {
    const on = [];
    let len = 0;
    z.places.forEach((p) => {
      const r = project(w.pts, p);
      len = r.len;
      if (r.d <= NEAR) on.push(r.at);
    });
    on.sort((a, b) => a - b);
    const stops = [0].concat(on, [len]);
    for (let i = 0; i + 1 < stops.length; i++) {
      const g = stops[i + 1] - stops[i];
      // a way's own two ends are where another way, a gate or the zone's edge meets it
      if (g > worst) { worst = g; worstAt = w.name; }
      if (g > LONGEST && process.argv.includes('--gaps')) console.log(`  ${z.id} ${w.name}: ${Math.round(g)} cells from ${pointAt(w.pts, stops[i])} to ${pointAt(w.pts, stops[i + 1])}`);
    }
    walked += len;
    met += on.length;
  });
  const lonely = z.places.filter((p) => !z.ways.some((w) => project(w.pts, p).d <= NEAR)).map((p) => p.n);
  const outside = z.places.filter((p) => p.x < 0 || p.y < 0 || p.x > z.w || p.y > z.h).map((p) => p.n);
  return { walked: Math.round(walked), places: z.places.length, met, mean: Math.round(walked / Math.max(1, met)), worst: Math.round(worst), worstAt, lonely, outside };
}

const zones = parse(fs.readFileSync(DOC, 'utf8'));
let bad = 0;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
zones.filter((z) => z.w && z.h).forEach((z) => {
  const file = path.join(OUT, z.id + '.svg'), text = svg(z);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.log(`STALE ${file}`); bad++; }
  } else fs.writeFileSync(file, text);
  const g = gaps(z);
  const ok = g.worst <= LONGEST && !g.outside.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${z.id} ${z.w}x${z.h}: ${g.places} places, ${g.walked} cells of ways, ${g.met} meetings on ways, one every ${g.mean} cells on average (30 s is ${SHORTEST}, 60 s is ${LONGEST}), longest empty stretch ${g.worst} (${g.worstAt})` +
    (g.lonely.length ? `; off every way: ${g.lonely.join(' ')}` : '') + (g.outside.length ? `; OUTSIDE: ${g.outside.join(' ')}` : ''));
});
if (!zones.length) { console.log('no zones found'); bad++; }
process.exit(bad ? 1 : 0);
