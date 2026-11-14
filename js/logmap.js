// ============================================================
//  logmap — Phase 5 (illustrated interface): logbook sketches and painted automap stamps.
//
//  1. Logbook: every journal entry is matched (by patterns derived from reading every
//     journal() call in the codebase) to a quest/storyline sketch id. Consecutive entries
//     for the same storyline are grouped and one small ink sketch (procedural stand-in:
//     canvas pen strokes, cross-hatching, sepia wash on parchment) sits beside the group.
//  2. Automap: small painted stamps over #amap for doors, quest givers, shops, dangers,
//     bosses and traps, in visited cells only, plus a legend.
//
//  Security: journal text comes from saves. It is only ever read with textContent and
//  matched against regexes; the sketch id is picked from this file's own table and the
//  markup this module builds is made of constants. No new saved fields: the sketch id is
//  derived at render time. GFX.logSketches / GFX.mapStamps = false restore the originals.
// ============================================================
'use strict';

if (typeof GFX !== 'undefined') {
  if (GFX.logSketches === undefined) GFX.logSketches = true;  // ink sketches beside logbook entries
  if (GFX.mapStamps === undefined) GFX.mapStamps = true;      // painted stamps on the automap
}

const LOGMAP = (function () {
  const on = (k) => typeof GFX === 'undefined' || GFX[k] !== false;

  // ---------------------------------------------------------------- sketch table
  // id -> the subject named in the alt text and the caption.
  const SUBJECTS = {
    gate: 'The North Gate', rite: 'The Rite of Hearthday', coil: 'The reverse-phase coil', bore: 'The quarry bore',
    greening: 'The Root Greening', hedge: 'The Hedge', crates: 'The corsair\'s crates', boots: 'Davin\'s boots',
    twins: 'The Fenning twins\' coats', tam: 'The voice on the Flume', pim: 'Pim\'s rooted hands', bells: 'The bells',
    sable: 'Sable and the Bound Ledger', pumps: 'The pumps at Depot Two', names: 'A page of names',
    press: 'The Office hand-press', kestrel: 'The Drift-Kestrel', tank: 'The Kestrel\'s lift-tank',
    cutterlog: 'The cutter\'s log', sunken: 'The Sunken Court', lamps: 'The dry lamps', pools: 'The reflecting pools',
    table: 'A table for four', aegis: 'The Aegis Sentinel', tapes: 'The choir cloaks', weaver: 'The Phantom Weaver',
    mausoleum: 'The Mausoleum of Chords', grave: 'The sexton\'s grave', hush: 'The Hush-Gift', lantern: 'Lanterns in the mist',
    vox: 'The vox-bottles', tobin: 'Tobin Ashgrove\'s Tuning-Blade', deed: 'The deed to Cooper\'s Row',
    brood: 'The Brood-Mother\'s web', vesper: 'Vane\'s axe and the tow-line', herald: 'The Synod herald',
    folder: 'The grey Arbiterium folder', footprints: 'Scorched footprints on a plank', quill: 'A quill and inkwell',
    reed: 'A cut Flume-reed and a reed-knife', timber: 'A felled iron-bough log, chalk-marked', skep: 'A straw bee-skep',
  };
  // Ordered: the first match wins, so specific storylines come before broad ones. Every journal()
  // string in the codebase is checked against this by test/logmap.test.js. 'quill' is the
  // deliberate generic for anything unforeseen (a future entry, an edited save).
  const PATTERNS = [
    // Phase 9: reed-craft and the Oakhaven side quests (js/reedcraft.js, js/sidequests.js)
    ['reed', /my first reed|wind-reed|flume-reed|joram pellow|ada pellow/], ['timber', /reeds-miner tomas|iron-bough|^tomas /], ['skep', /skeps?\b|telling the bees/],
    ['kestrel', /^part four/], ['sunken', /^part three/], ['tank', /^the lift-tank/],
    ['vox', /^teller's hold|^four hundred and thirty-two/], ['brood', /^the brood-mother/], ['herald', /synod herald/],
    ['footprints', /scorched footprints/], ['hush', /hush-lamp shrine|^the hush-gift|^hand-cant/],
    ['grave', /sexton/], ['bells', /^the tower bell|chapel's bells/], ['cutterlog', /^the cutter's log/],
    ['vesper', /^vesper:/], ['lantern', /^lanterns in the mist/], ['tobin', /^the year 417/],
    ['deed', /deed to 4 cooper/],
    ['folder', /^coda: kaelen|grey arbiterium folder|calibration|tuning room/], ['mausoleum', /^coda:/],
    ['mausoleum', /^the requiem:|^in the choir of the mausoleum/], ['aegis', /the thing at the porch|voice at the door/],
    ['pumps', /hew callan/], ['aegis', /aegis|hymn 9|^the red cloak/], ['table', /table for four|halder/],
    ['lamps', /lamplighter|dry lamps/], ['pools', /reflecting pools/], ['tapes', /name-tapes from (ten|the choir)/],
    ['sunken', /^the office came out/], ['press', /^the pressman's round|hand-press|bettis renn/],
    ['names', /^the missing count/], ['weaver', /\bweaver\b/], ['sable', /sable|umber/],
    ['sunken', /sunken court|whisper-grove|malting/],
    ['crates', /hetty|corsair|glass cores|crates|skyship captain/],
    ['rite', /consortium pass|^lyra asked me|hearthday|ignatius|the rite/],
    ['greening', /bit is snapped|greening/], ['coil', /reverse-phase coil/], ['bore', /coil is seated|tobiah marsh/],
    ['gate', /north gate|gate-warden|harrow/],
    ['boots', /boots|\borla\b/],
    ['twins', /twins|hob wendle|culvert key/], ['hedge', /hedge/], ['tam', /\btam\b|flume/],
    ['pim', /pim carder|\bnell\b|roots in his hands/], ['kestrel', /kestrel|lift-tank|cutter/],
  ];
  function sketchFor(text) {
    const t = String(text == null ? '' : text).trim().toLowerCase().replace(/[‘’]/g, '\'');
    for (let i = 0; i < PATTERNS.length; i++) if (PATTERNS[i][1].test(t)) return PATTERNS[i][0];
    return 'quill';
  }

  // ---------------------------------------------------------------- pen-and-ink painter
  // Procedural stand-in: all drawing is deterministic per sketch id, done once, cached as a data URL.
  const W = 144, H = 108, INK = '#34200f';
  function rngFor(id) {
    let s = 2166136261; for (let i = 0; i < id.length; i++) s = Math.imul(s ^ id.charCodeAt(i), 16777619);
    return function () { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pen(c, r) {
    const P = {
      c, r,
      // a hand-drawn stroke: jittered segments drawn twice at slight offset
      path(pts, w, closed, a) {
        for (let pass = 0; pass < 2; pass++) {
          c.beginPath(); c.lineWidth = pass ? (w || 1.1) * 0.6 : (w || 1.1); c.strokeStyle = INK; c.globalAlpha = pass ? 0.45 : (a || 0.92);
          let first = true;
          const n = pts.length + (closed ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const p = pts[i % pts.length], q = pts[(i + 1) % pts.length];
            if (first) { c.moveTo(p[0] + (r() - 0.5) * 0.9, p[1] + (r() - 0.5) * 0.9); first = false; }
            if (i === n - 1 && !closed) break;
            const tgt = closed || i < pts.length - 1 ? q : p;
            const dx = tgt[0] - p[0], dy = tgt[1] - p[1], len = Math.hypot(dx, dy), seg = Math.max(1, Math.ceil(len / 7));
            for (let k = 1; k <= seg; k++) c.lineTo(p[0] + dx * k / seg + (r() - 0.5) * 0.9, p[1] + dy * k / seg + (r() - 0.5) * 0.9);
          }
          c.stroke();
        }
        c.globalAlpha = 1;
      },
      line(x1, y1, x2, y2, w) { P.path([[x1, y1], [x2, y2]], w); },
      ellipse(cx, cy, rx, ry, a0, a1, w) {
        const n = Math.max(8, Math.ceil(Math.max(rx, ry) * 1.3)), pts = [];
        a0 = a0 || 0; a1 = a1 == null ? Math.PI * 2 : a1;
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
        P.path(pts, w, false);
      },
      rect(x, y, w, h, lw) { P.path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lw, true); },
      // sepia wash under the ink
      wash(pts, a) {
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
        c.fillStyle = 'rgba(96,60,24,' + (a == null ? 0.22 : a) + ')'; c.fill();
      },
      // cross-hatching clipped to a shape
      hatch(pts, ang, gap, a, cross) {
        c.save(); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.clip();
        for (let pass = 0; pass < (cross ? 2 : 1); pass++) {
          const an = ang + pass * 1.2; c.strokeStyle = INK; c.lineWidth = 0.6; c.globalAlpha = a || 0.5;
          const cx = W / 2, cy = H / 2, ca = Math.cos(an), sa = Math.sin(an);
          for (let d = -110; d <= 110; d += gap) {
            c.beginPath(); c.moveTo(cx + ca * -130 - sa * d + (r() - 0.5), cy + sa * -130 + ca * d); c.lineTo(cx + ca * 130 - sa * d + (r() - 0.5), cy + sa * 130 + ca * d); c.stroke();
          }
        }
        c.restore(); c.globalAlpha = 1;
      },
      shape(pts, wash, hatchAng, gap) { if (wash) P.wash(pts, wash); if (hatchAng != null) P.hatch(pts, hatchAng, gap || 3, 0.5, false); P.path(pts, 1.2, true); },
      ground(y) { P.path([[14, y], [50, y + 1], [90, y - 1], [130, y]], 0.9); P.hatch([[20, y], [124, y], [118, y + 7], [26, y + 7]], 0.8, 3.2, 0.35, false); },
      dots(n, x0, y0, x1, y1) { c.fillStyle = INK; c.globalAlpha = 0.6; for (let i = 0; i < n; i++) c.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 1, 1); c.globalAlpha = 1; },
    };
    return P;
  }
  function parchment(c, r) {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ead9ac'); g.addColorStop(1, '#d8c086');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(' + (110 + r() * 40 | 0) + ',' + (80 + r() * 30 | 0) + ',40,' + (0.04 + r() * 0.07).toFixed(3) + ')'; c.fillRect(r() * W, r() * H, 1 + r() * 3, 1); }
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(90,55,20,0)'); v.addColorStop(1, 'rgba(90,55,20,0.5)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- the motifs (all procedural stand-ins)
  const M = {};
  M.gate = (P) => {
    P.shape([[28, 92], [28, 34], [44, 34], [44, 92]], 0.18, 1.2); P.shape([[100, 92], [100, 34], [116, 34], [116, 92]], 0.18, 1.2);
    P.ellipse(72, 52, 44, 26, Math.PI, Math.PI * 2, 1.4); P.ellipse(72, 52, 28, 16, Math.PI, Math.PI * 2, 1);
    for (let x = 50; x < 100; x += 8) P.line(x, 92, x, 52 - Math.sqrt(Math.max(0, 1 - Math.pow((x - 72) / 28, 2))) * 16, 1);
    P.line(44, 72, 100, 72, 1.6); P.line(44, 80, 100, 80, 1); P.ellipse(72, 42, 3, 4, 0, 6.3, 1); P.line(72, 36, 72, 38, 1); P.ground(92);
  };
  M.rite = (P) => {
    for (const rr of [14, 24, 34]) P.ellipse(72, 54, rr, rr * 0.8, 0.2, 5.8, rr === 14 ? 1.3 : 0.9);
    P.line(72, 82, 72, 52, 1.6); P.path([[64, 32], [64, 52], [80, 52], [80, 32]], 1.5); P.line(72, 52, 72, 56, 1.6);
    P.hatch([[64, 32], [64, 52], [80, 52], [80, 32]], 1.3, 3, 0.4, false);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; P.ellipse(72 + Math.cos(a) * 40, 54 + Math.sin(a) * 32, 2, 1.5, 0, 6.3, 1); }
  };
  M.bore = (P) => {
    for (const y of [48, 62, 76, 90]) P.path([[8, y], [40, y + 2], [80, y - 2], [136, y + 1]], 0.8);
    P.hatch([[8, 44], [136, 44], [136, 100], [8, 100]], 0.4, 4, 0.22, true);
    P.shape([[62, 20], [62, 92], [82, 92], [82, 20]], 0.45, 1.5); P.path([[62, 92], [72, 102], [82, 92]], 1.4, false);
    for (let y = 30; y < 90; y += 8) P.line(63, y, 81, y + 5, 0.8);
    P.path([[50, 46], [72, 12], [94, 46]], 1.3); P.line(60, 30, 84, 30, 1);
  };
  M.coil = (P) => {
    for (let i = 0; i < 7; i++) P.ellipse(34 + i * 9, 54, 6, 20, -1.6, 1.6, 1.1);
    for (let i = 0; i < 7; i++) P.ellipse(34 + i * 9, 54, 6, 20, 1.6, 4.7, 0.5);
    P.shape([[100, 34], [128, 34], [128, 78], [100, 78]], 0.25, 1.1); P.ellipse(114, 52, 4, 4, 0, 6.3, 1.1); P.path([[114, 55], [111, 68], [117, 68]], 1.1, true);
    P.line(94, 54, 100, 54, 1.4);
  };
  M.greening = (P) => {
    P.line(72, 100, 72, 50, 2.6); P.hatch([[69, 100], [75, 100], [75, 50], [69, 50]], 1.5, 2, 0.6, false);
    const branch = (x, y, a, len, d) => { if (d > 4 || len < 5) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; P.line(x, y, x2, y2, Math.max(0.6, 2 - d * 0.4)); branch(x2, y2, a - 0.5 - P.r() * 0.3, len * 0.72, d + 1); branch(x2, y2, a + 0.5 + P.r() * 0.3, len * 0.72, d + 1); };
    branch(72, 52, -Math.PI / 2, 22, 0);
    for (let i = 0; i < 5; i++) branch(72, 98, Math.PI / 2 + (i - 2) * 0.55, 10 + P.r() * 4, 2);
    P.path([[8, 96], [30, 96], [36, 86], [46, 86], [46, 96], [136, 96]], 1);
  };
  M.hedge = (P) => {
    const top = []; for (let x = 10; x <= 134; x += 8) top.push([x, 50 + (x / 8 % 2 ? -7 : 0) + (P.r() - 0.5) * 5]);
    const shape = top.concat([[134, 90], [10, 90]]); P.shape(shape, 0.3, 0.9, 2.6);
    for (let i = 0; i < 18; i++) { const x = 14 + P.r() * 116, y = 56 + P.r() * 28; P.line(x, y, x + 3, y - 4, 0.8); P.line(x, y, x - 2, y - 4, 0.8); }
    for (const y of [28, 36, 44]) P.path([[10, y], [50, y - 2], [90, y + 2], [134, y - 1]], 0.5, false, 0.35);
    P.ground(90);
  };
  M.crates = (P) => {
    const box = (x, y, w, h) => { P.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0.2, 0.8, 3); for (let k = 1; k < 4; k++) P.line(x, y + h * k / 4, x + w, y + h * k / 4, 0.7); P.line(x, y, x + w, y + h, 0.6); };
    box(22, 62, 42, 30); box(70, 62, 42, 30); box(44, 32, 42, 30);
    for (let i = 0; i < 3; i++) { P.ellipse(116 + (i % 2) * 6, 40 + i * 12, 4, 4, 0, 6.3, 1); P.ellipse(116 + (i % 2) * 6, 40 + i * 12, 7, 7, -0.6, 0.6, 0.6); }
    P.ground(92);
  };
  M.boots = (P) => {
    const boot = (ox) => { const pts = [[ox, 24], [ox + 16, 24], [ox + 17, 62], [ox + 38, 70], [ox + 38, 86], [ox - 4, 86], [ox - 2, 60]]; P.shape(pts, 0.28, 1.0, 2.8); P.line(ox - 4, 80, ox + 38, 80, 1); P.line(ox + 1, 34, ox + 15, 36, 0.8); P.line(ox + 1, 42, ox + 15, 44, 0.8); };
    boot(30); boot(82); P.ground(88);
  };
  M.twins = (P) => {
    const coat = (ox) => { P.shape([[ox, 30], [ox + 40, 30], [ox + 40, 90], [ox, 90]], 0.22, 0.9, 3); P.shape([[ox - 12, 38], [ox, 38], [ox, 70], [ox - 10, 70]], 0.18, null); P.line(ox + 20, 30, ox + 20, 90, 0.9); for (let y = 44; y < 86; y += 12) P.ellipse(ox + 25, y, 1.6, 1.6, 0, 6.3, 0.9); P.path([[ox + 12, 30], [ox + 20, 40], [ox + 28, 30]], 1); };
    coat(20); coat(82);
  };
  M.tam = (P) => {
    P.path([[10, 60], [50, 40], [100, 40], [136, 24]], 1.4); P.path([[10, 80], [54, 60], [104, 60], [136, 44]], 1.4);
    for (let i = 0; i < 6; i++) P.ellipse(30 + i * 18, 70 - i * 3, 9, 2.5, Math.PI, 6.28, 0.8);
    for (let i = 0; i < 5; i++) { const x = 16 + i * 6; P.line(x, 98, x + (i % 2 ? 2 : -2), 76, 1); }
    P.ellipse(106, 78, 8, 11, 0, 6.3, 1.1); P.ellipse(106, 78, 4, 6, -1, 2, 0.8);
  };
  M.pim = (P) => {
    P.shape([[44, 96], [48, 66], [66, 62], [96, 62], [100, 96]], 0.22, 1.2, 3);
    const tips = [[40, 46], [56, 30], [74, 26], [92, 32], [106, 46]];
    tips.forEach((t, i) => { const bx = 52 + i * 11; P.line(bx, 64, t[0], t[1], 2.2); P.line(t[0], t[1], t[0] + (i - 2) * 4, t[1] - 12, 0.9); P.line(t[0], t[1], t[0] + (i - 2) * 7 + 4, t[1] - 8, 0.8); });
    P.path([[50, 80], [60, 76], [72, 82]], 0.7);
  };
  M.bells = (P) => {
    P.path([[34, 22], [110, 22]], 2); P.line(34, 22, 34, 96, 1.6); P.line(110, 22, 110, 96, 1.6);
    const bell = [[58, 78], [62, 52], [68, 38], [76, 38], [82, 52], [86, 78]]; P.shape([[60, 80]].concat(bell.slice(1), [[88, 80]]), 0.3, 1.0, 2.6);
    P.line(58, 80, 88, 80, 1.6); P.line(72, 22, 72, 38, 1.2); P.ellipse(73, 85, 3, 3, 0, 6.3, 1.1);
    P.ellipse(96, 62, 8, 14, -0.8, 0.8, 0.6); P.ellipse(100, 62, 12, 20, -0.8, 0.8, 0.5);
  };
  M.sable = (P) => {
    P.shape([[24, 50], [70, 58], [70, 92], [24, 84]], 0.2, null); P.shape([[74, 58], [120, 50], [120, 84], [74, 92]], 0.2, null);
    for (let i = 0; i < 6; i++) { P.line(30, 56 + i * 5, 64, 62 + i * 5, 0.6); P.line(80, 62 + i * 5, 114, 56 + i * 5, 0.6); }
    P.line(72, 58, 72, 92, 1.4);
    P.path([[100, 30], [116, 8], [112, 28]], 1); P.line(100, 30, 96, 48, 1.1); P.hatch([[100, 30], [116, 8], [112, 28]], 0.9, 2, 0.6, false);
    for (const [x, y] of [[30, 30], [50, 20], [76, 34], [58, 40]]) { P.line(x - 3, y, x + 3, y, 0.8); P.line(x, y - 3, x, y + 3, 0.8); }
  };
  M.pumps = (P) => {
    P.ellipse(60, 52, 24, 24, 0, 6.3, 1.5); P.ellipse(60, 52, 6, 6, 0, 6.3, 1.2);
    for (let i = 0; i < 8; i++) P.line(60, 52, 60 + Math.cos(i * 0.785) * 24, 52 + Math.sin(i * 0.785) * 24, 0.9);
    P.shape([[84, 70], [124, 70], [124, 82], [84, 82]], 0.25, 1.4, 3); P.shape([[112, 82], [120, 82], [120, 96], [112, 96]], 0.25, null);
    for (let i = 0; i < 3; i++) P.ellipse(116, 100 + i * 2, 2, 3, 0, 6.3, 0.8);
    P.shape([[34, 96], [34, 80], [86, 80], [86, 96]], 0.18, 0.7, 3);
  };
  M.names = (P) => {
    P.shape([[34, 12], [110, 12], [110, 96], [34, 96]], 0.12, null);
    for (let i = 0; i < 10; i++) { const y = 22 + i * 7.4; P.line(42, y, 42 + 24 + P.r() * 30, y, 0.7); if (i < 8) { P.path([[98, y - 1], [100, y + 1], [104, y - 4]], 0.9); } }
  };
  M.press = (P) => {
    P.shape([[34, 96], [34, 20], [46, 20], [46, 96]], 0.25, 1.2, 3); P.shape([[98, 96], [98, 20], [110, 20], [110, 96]], 0.25, 1.2, 3);
    P.shape([[30, 16], [114, 16], [114, 26], [30, 26]], 0.3, 0.8, 3);
    P.line(72, 26, 72, 62, 3); for (let y = 30; y < 62; y += 5) P.line(68, y, 76, y + 3, 0.9);
    P.line(56, 14, 88, 8, 2.2); P.shape([[52, 62], [92, 62], [92, 68], [52, 68]], 0.3, null);
    P.shape([[40, 82], [104, 82], [104, 92], [40, 92]], 0.3, 0.9, 2.6); P.ground(96);
  };
  M.kestrel = (P) => {
    P.ellipse(72, 38, 46, 24, 0, 6.3, 1.4); P.hatch(ellPts(72, 38, 46, 24), 0.9, 3, 0.32, true);
    for (let i = -3; i <= 3; i++) P.path([[72 + i * 14, 15], [72 + i * 6, 38], [72 + i * 14, 62]], 0.6, false, 0.4);
    P.line(52, 60, 56, 78, 0.9); P.line(92, 60, 88, 78, 0.9);
    P.shape([[44, 80], [100, 80], [92, 92], [54, 92]], 0.28, 1.0, 2.6); P.line(72, 80, 72, 70, 1); P.path([[72, 70], [86, 72], [72, 76]], 0.9, true);
    for (let i = 0; i < 3; i++) P.line(112, 32 + i * 8, 134, 30 + i * 8, 0.6);
  };
  M.tank = (P) => {
    P.ellipse(72, 54, 42, 28, 0, 6.3, 1.4); P.hatch(ellPts(72, 54, 42, 28), 0.7, 3.2, 0.26, false);
    P.shape([[58, 44], [84, 44], [84, 64], [58, 64]], 0.34, null); for (let i = 0; i < 6; i++) { P.line(58 + i * 5, 42, 58 + i * 5, 46, 0.8); P.line(58 + i * 5, 62, 58 + i * 5, 66, 0.8); }
    P.line(58, 44, 84, 64, 0.6); P.line(84, 44, 58, 64, 0.6);
    P.shape([[100, 52], [112, 52], [112, 60], [100, 60]], 0.3, null); P.line(112, 56, 126, 56, 1.4); P.ellipse(128, 56, 3, 3, 0, 6.3, 1);
    P.line(46, 80, 56, 94, 1); P.line(98, 80, 88, 94, 1); P.ground(98);
  };
  M.cutterlog = (P) => {
    P.shape([[34, 24], [110, 24], [110, 84], [34, 84]], 0.16, null); P.ellipse(34, 54, 5, 30, Math.PI / 2, Math.PI * 1.5, 1.2); P.ellipse(110, 54, 5, 30, -Math.PI / 2, Math.PI / 2, 1.2);
    for (let i = 0; i < 7; i++) P.line(44, 32 + i * 7, 100 - (i === 6 ? 30 : 0), 32 + i * 7, 0.7);
    P.ellipse(96, 76, 7, 7, 0, 6.3, 1.2); P.ellipse(96, 76, 3, 3, 0, 6.3, 0.8);
  };
  M.sunken = (P) => {
    P.ellipse(72, 82, 46, 10, 0, 6.3, 1.4); P.ellipse(72, 82, 34, 6, 0, 6.3, 0.8);
    P.shape([[66, 82], [66, 50], [78, 50], [78, 82]], 0.25, 1.4, 3); P.ellipse(72, 50, 14, 4, 0, 6.3, 1.1);
    for (const s of [-1, 1]) P.path([[72, 46], [72 + s * 14, 40], [72 + s * 22, 56]], 0.9);
    for (const x of [18, 126]) { P.line(x, 92, x, 30, 1.4); P.shape([[x - 4, 30], [x + 4, 30], [x + 3, 22], [x - 3, 22]], 0.25, null); }
    for (const y of [20, 30]) P.path([[10, y], [50, y - 3], [100, y + 2], [134, y]], 0.5, false, 0.3);
  };
  M.lamps = (P) => {
    const lamp = (x, lit) => { P.line(x, 96, x, 36, 1.8); P.shape([[x - 8, 36], [x + 8, 36], [x + 6, 20], [x - 6, 20]], lit ? 0.4 : 0.15, lit ? 1.0 : null, 2.4); P.path([[x - 7, 20], [x, 12], [x + 7, 20]], 1.2); if (lit) { P.ellipse(x, 28, 3, 4, 0, 6.3, 1); for (let a = 0; a < 6; a++) P.line(x + Math.cos(a) * 11, 28 + Math.sin(a) * 11, x + Math.cos(a) * 16, 28 + Math.sin(a) * 16, 0.6); } };
    lamp(34, false); lamp(72, true); lamp(110, false); P.ground(96);
  };
  M.pools = (P) => {
    [[40, 34], [102, 34], [40, 76], [102, 76]].forEach(([x, y], i) => { P.ellipse(x, y, 24, 11, 0, 6.3, 1.2); P.ellipse(x, y, 16, 6, 0, 6.3, 0.6); P.hatch(ellPts(x, y, 24, 11), 0.3, 2.6, 0.3, false); if (i % 2) P.ellipse(x, y, 8, 3, 0, 6.3, 0.7); });
  };
  M.table = (P) => {
    P.ellipse(72, 54, 38, 22, 0, 6.3, 1.5); P.hatch(ellPts(72, 54, 38, 22), 0.6, 3.6, 0.22, false);
    for (const [x, y, r2] of [[72, 40, 8], [72, 68, 8], [50, 54, 8], [94, 54, 8]]) { P.ellipse(x, y, r2, r2 * 0.6, 0, 6.3, 1.1); P.ellipse(x, y, r2 - 3, (r2 - 3) * 0.6, 0, 6.3, 0.6); }
    P.ellipse(72, 68, 3, 2, 0, 6.3, 1.2);
    for (const [x, y] of [[72, 14], [72, 96], [18, 54], [126, 54]]) P.shape([[x - 6, y - 4], [x + 6, y - 4], [x + 6, y + 4], [x - 6, y + 4]], 0.28, null);
  };
  M.aegis = (P) => {
    P.shape(ellPts(72, 24, 13, 13), 0.35, 1.2, 2.4); P.line(66, 24, 78, 24, 1); P.line(72, 14, 72, 34, 0.8);
    P.shape([[46, 40], [98, 40], [92, 98], [52, 98]], 0.3, 0.9, 2.6); P.shape([[30, 44], [46, 44], [46, 84], [30, 84], [24, 64]], 0.34, 1.2, 2.2);
    P.path([[34, 52], [34, 62], [40, 72], [40, 52]], 0.9, false); P.ellipse(37, 74, 2.2, 2.2, 0, 6.3, 1);
    P.line(98, 46, 120, 30, 2); P.line(98, 52, 112, 60, 1.4);
  };
  M.tapes = (P) => {
    P.line(10, 24, 134, 24, 2);
    for (let i = 0; i < 11; i++) { const x = 18 + i * 11; P.line(x, 24, x, 28, 1.2); const last = i === 10; P.shape([[x - 4, 28], [x + 4, 28], [x + 5, 78], [x - 5, 78]], last ? 0.5 : 0.22, last ? 0.8 : null, 2); P.line(x - 2, 40, x + 2, 40, 0.6); }
  };
  M.weaver = (P) => {
    P.rect(24, 14, 96, 76, 1.8); P.line(24, 52, 120, 52, 1);
    for (let i = 0; i < 12; i++) P.line(30 + i * 8, 14, 30 + i * 8, 90, 0.5);
    for (let i = 0; i < 6; i++) P.line(24, 58 + i * 5, 120, 58 + i * 5, 0.6);
    P.ellipse(72, 38, 9, 7, 0, 6.3, 1.2); P.hatch(ellPts(72, 38, 9, 7), 0.9, 2, 0.6, false);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; P.line(72 + Math.cos(a) * 9, 38 + Math.sin(a) * 7, 72 + Math.cos(a) * 24, 38 + Math.sin(a) * 18, 0.9); }
  };
  M.mausoleum = (P) => {
    P.path([[24, 40], [72, 12], [120, 40]], 1.6, true); P.hatch([[24, 40], [72, 12], [120, 40]], 0.9, 3, 0.4, false);
    P.line(22, 42, 122, 42, 1.6);
    for (const x of [32, 52, 92, 112]) P.shape([[x - 4, 42], [x + 4, 42], [x + 4, 86], [x - 4, 86]], 0.2, 1.4, 3);
    P.shape([[62, 50], [82, 50], [82, 86], [62, 86]], 0.55, null); P.ellipse(72, 50, 10, 6, Math.PI, Math.PI * 2, 1.2);
    for (let i = 0; i < 3; i++) P.line(18 - i * 3, 86 + i * 4, 126 + i * 3, 86 + i * 4, 1.1);
  };
  M.grave = (P) => {
    P.path([[16, 80], [40, 66], [76, 64], [110, 70], [130, 82]], 1.3); P.hatch([[16, 80], [40, 66], [76, 64], [110, 70], [130, 82]], 0.9, 2.6, 0.5, true);
    P.shape([[88, 36], [108, 36], [108, 66], [88, 66]], 0.24, 1.2, 3); P.ellipse(98, 36, 10, 8, Math.PI, Math.PI * 2, 1.4);
    P.line(94, 44, 102, 44, 0.8); P.line(98, 40, 98, 52, 0.8);
    P.line(34, 90, 52, 40, 1.8); P.shape([[46, 40], [58, 36], [60, 46], [50, 50]], 0.3, null); P.ground(92);
  };
  M.hush = (P) => {
    for (let i = 0; i < 9; i++) { const a = i * 0.7, x = 72 + Math.cos(a) * 46, y = 62 + Math.sin(a) * 26; P.line(x, y + 8, x, y - 6, 1.2); P.ellipse(x, y - 8, 2.6, 3, 0, 6.3, 1); if (i === 2) for (let k = 0; k < 6; k++) P.line(x + Math.cos(k) * 5, y - 8 + Math.sin(k) * 5, x + Math.cos(k) * 8, y - 8 + Math.sin(k) * 8, 0.6); }
    P.ellipse(72, 54, 5, 5, 0, 6.3, 1.2); P.shape([[66, 92], [72, 60], [78, 92]], 0.3, 1.0, 2.4); P.path([[62, 46], [58, 40]], 0.8); P.path([[82, 46], [86, 40]], 0.8);
  };
  M.lantern = (P) => {
    P.line(72, 6, 72, 26, 1.2); P.shape([[60, 38], [84, 38], [88, 70], [56, 70]], 0.4, null); P.path([[62, 26], [72, 18], [82, 26], [84, 38], [60, 38]], 1.3, true);
    P.ellipse(72, 54, 6, 8, 0, 6.3, 1.2); P.line(60, 38, 56, 70, 1.2); P.line(84, 38, 88, 70, 1.2); P.line(54, 72, 90, 72, 1.6);
    for (let a = 0; a < 12; a++) P.line(72 + Math.cos(a / 12 * 6.28) * 22, 54 + Math.sin(a / 12 * 6.28) * 26, 72 + Math.cos(a / 12 * 6.28) * 30, 54 + Math.sin(a / 12 * 6.28) * 34, 0.5);
    for (const y of [84, 92, 100]) P.path([[12, y], [48, y - 3], [90, y + 2], [132, y - 2]], 0.6, false, 0.4);
  };
  M.vox = (P) => {
    [[34, 62], [72, 52], [110, 62]].forEach(([x, y], i) => { P.shape([[x - 10, y + 40], [x - 10, y + 6], [x - 4, y - 6], [x - 4, y - 18], [x + 4, y - 18], [x + 4, y - 6], [x + 10, y + 6], [x + 10, y + 40]], 0.24, 1.2, 3); P.shape([[x - 5, y - 18], [x + 5, y - 18], [x + 4, y - 25], [x - 4, y - 25]], 0.4, null); P.ellipse(x, y + 20, 5, 5, 0, 6.3, 0.7); if (i === 1) for (let k = 1; k < 4; k++) P.ellipse(x + 2, y - 28, 5 * k, 3 * k, -2.4, -0.7, 0.6); });
    P.ground(96);
  };
  M.tobin = (P) => {
    const cairn = [[30, 96], [38, 76], [52, 70], [92, 70], [106, 76], [114, 96]]; P.shape(cairn, 0.28, 1.0, 3);
    for (const [x, y, w] of [[42, 84, 14], [62, 80, 16], [84, 84, 14], [54, 74, 12], [76, 74, 14]]) P.ellipse(x, y, w / 2, 4.5, 0, 6.3, 0.9);
    P.shape([[69, 70], [69, 12], [72, 6], [75, 12], [75, 70]], 0.3, 1.2, 2.4); P.line(72, 12, 72, 66, 0.7); P.line(60, 56, 84, 56, 2);
    P.ellipse(72, 36, 14, 22, -0.6, 0.6, 0.6); P.ellipse(72, 36, 20, 30, -0.6, 0.6, 0.5); P.ellipse(72, 36, 14, 22, Math.PI - 0.6, Math.PI + 0.6, 0.6);
  };
  M.deed = (P) => {
    P.shape([[34, 92], [34, 52], [72, 22], [110, 52], [110, 92]], 0.2, 1.0, 3);
    P.shape([[62, 92], [62, 62], [82, 62], [82, 92]], 0.5, null); P.ellipse(78, 78, 1.5, 1.5, 0, 6.3, 1);
    P.shape([[42, 62], [54, 62], [54, 74], [42, 74]], 0.25, null); P.shape([[90, 62], [102, 62], [102, 74], [90, 74]], 0.25, null);
    P.ellipse(122, 28, 6, 6, 0, 6.3, 1.4); P.line(122, 34, 122, 56, 1.6); P.line(122, 50, 128, 50, 1.4); P.line(122, 56, 128, 56, 1.4); P.ground(94);
  };
  M.brood = (P) => {
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; P.line(72, 50, 72 + Math.cos(a) * 60, 50 + Math.sin(a) * 46, 0.7); }
    for (const k of [10, 20, 30, 42]) { const pts = []; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; pts.push([72 + Math.cos(a) * k * 1.4, 50 + Math.sin(a) * k * 1.05]); } P.path(pts, 0.6, true, 0.6); }
    P.shape(ellPts(72, 50, 6, 7), 0.5, 0.8, 1.6); for (let i = 0; i < 4; i++) { P.path([[66, 48 + i * 2], [60 - i * 2, 40 + i * 4], [54 - i * 3, 46 + i * 5]], 0.8); P.path([[78, 48 + i * 2], [84 + i * 2, 40 + i * 4], [90 + i * 3, 46 + i * 5]], 0.8); }
  };
  M.vesper = (P) => {
    P.line(40, 96, 84, 22, 2.4); P.shape([[76, 24], [98, 14], [112, 34], [90, 42]], 0.3, 1.0, 2.4);
    P.path([[10, 80], [30, 72], [50, 84], [70, 76], [96, 90], [134, 78]], 1.2); P.path([[10, 86], [30, 78], [50, 90], [70, 82], [96, 96], [134, 84]], 0.8, false, 0.5);
    P.path([[118, 56], [126, 66], [134, 64]], 0.9);
  };
  M.herald = (P) => {
    P.shape(ellPts(60, 30, 9, 9), 0.3, null); P.shape([[44, 96], [48, 42], [72, 42], [76, 96]], 0.28, 0.9, 2.8);
    P.line(96, 96, 96, 12, 1.8); P.shape([[96, 14], [128, 20], [124, 36], [96, 38]], 0.35, 0.5, 3); P.line(104, 22, 118, 26, 0.8);
    P.path([[72, 50], [90, 42], [104, 44]], 1.2); P.shape([[84, 40], [96, 38], [100, 46], [86, 48]], 0.2, null); P.ground(96);
  };
  M.folder = (P) => {
    P.shape([[30, 34], [70, 34], [76, 26], [114, 26], [114, 92], [30, 92]], 0.2, null); P.shape([[34, 42], [114, 42], [114, 92], [34, 92]], 0.14, null);
    for (let i = 0; i < 5; i++) P.line(46, 52 + i * 7, 96 - (i === 4 ? 24 : 0), 52 + i * 7, 0.6);
    P.ellipse(96, 78, 8, 8, 0, 6.3, 1.4); P.line(92, 74, 100, 82, 1); P.line(100, 74, 92, 82, 1);
    P.path([[60, 42], [60, 92]], 1.4);
  };
  M.footprints = (P) => {
    P.shape([[16, 70], [128, 66], [128, 90], [16, 94]], 0.22, 0.4, 3.4);
    const foot = (x, y) => { P.shape(ellPts(x, y, 6, 11), 0.5, 0.9, 1.6); P.shape(ellPts(x + 1, y - 17, 4, 5), 0.5, null); };
    foot(52, 76); foot(86, 74);
    P.path([[70, 8], [62, 28], [74, 30], [60, 52]], 1.4); P.path([[104, 6], [96, 24], [106, 26], [94, 44]], 1.2);
  };
  M.reed = (P) => {
    for (let i = 0; i < 4; i++) { const x = 34 + i * 12; P.line(x, 96, x + 30 + i * 4, 14 + i * 3, 1.3 - i * 0.15); P.line(x + 16 + i * 2, 56 - i * 2, x + 20 + i * 2, 52 - i * 2, 0.8); }
    P.shape([[96, 80], [132, 72], [134, 78], [98, 86]], 0.5, 0.9, 1.6); P.shape([[80, 84], [98, 80], [98, 88], [82, 92]], 0.25, 0.8, 1.2);
    P.path([[10, 98], [40, 94], [70, 99], [134, 95]], 0.8);
  };
  M.timber = (P) => {
    P.shape(ellPts(30, 66, 14, 20), 0.35, 1.0, 1.8); P.ellipse(30, 66, 8, 12, 0, 6.3, 0.7); P.ellipse(30, 66, 3, 5, 0, 6.3, 0.6);
    P.shape([[30, 46], [126, 50], [128, 84], [30, 86]], 0.25, 0.9, 2.6); P.line(96, 56, 104, 76, 1.6); P.line(104, 56, 96, 76, 1.6);
    P.path([[12, 96], [60, 92], [134, 97]], 0.8);
  };
  M.skep = (P) => {
    P.shape([[44, 92], [44, 60], [56, 34], [72, 26], [88, 34], [100, 60], [100, 92]], 0.3, 1.0, 2.6);
    for (let i = 0; i < 6; i++) P.path([[44 + i * 0, 88 - i * 10], [72, 84 - i * 10], [100, 88 - i * 10]], 0.7, false, 0.6);
    P.shape(ellPts(72, 86, 6, 4), 0.8, null); for (const [x, y] of [[112, 40], [118, 30], [124, 44]]) { P.ellipse(x, y, 2, 1.5, 0, 6.3, 0.8); }
    P.ground(94);
  };
  M.quill = (P) => {
    P.shape([[52, 70], [92, 70], [96, 94], [48, 94]], 0.3, 1.0, 2.8); P.ellipse(72, 70, 20, 5, 0, 6.3, 1.2); P.ellipse(72, 70, 12, 3, 0, 6.3, 0.7);
    P.path([[78, 66], [104, 18], [112, 10], [108, 28], [84, 70]], 1.1, false); P.line(78, 66, 84, 70, 1); P.hatch([[104, 18], [112, 10], [108, 28], [90, 56]], 0.8, 2, 0.5, false);
    P.path([[20, 98], [40, 92], [60, 100], [80, 96]], 0.9);
  };
  function ellPts(cx, cy, rx, ry) { const pts = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return pts; }

  const cache = {};
  // One PNG data URL per sketch id, drawn once.
  function sketchURL(id) {
    if (!M[id]) id = 'quill';
    // Phase 8: a painted sketch when one is already decoded; the drawn one otherwise
    try { if (typeof PAINTED !== 'undefined' && PAINTED.ready('sketch', id)) return PAINTED.url('sketch', id); } catch (e) { /* stand-in */ }
    if (cache[id]) return cache[id];
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), r = rngFor(id);
    parchment(c, r);
    const P = pen(c, r);
    try { M[id](P); } catch (e) { console.warn('logmap: sketch failed', id, e); }
    P.dots(40, 8, 8, W - 8, H - 8);
    c.strokeStyle = 'rgba(70,40,14,.55)'; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2);
    cache[id] = cv.toDataURL('image/png');
    return cache[id];
  }
  function sketchEl(id) {
    const fig = document.createElement('figure'); fig.className = 'lm-sketch'; fig.dataset.sketch = id;
    const img = document.createElement('img'); img.src = sketchURL(id); img.width = W; img.height = H;
    img.alt = 'Ink sketch: ' + (SUBJECTS[id] || SUBJECTS.quill);
    try { // the painting may still be on its way: swap it in when decoded, keep the drawn sketch if it never comes
      if (typeof PAINTED !== 'undefined' && PAINTED.has('sketch', id) && !PAINTED.ready('sketch', id)) {
        PAINTED.load('sketch', id).then((im) => { if (im) img.src = PAINTED.url('sketch', id); });
      }
    } catch (e) { /* stand-in */ }
    const cap = document.createElement('figcaption'); cap.textContent = SUBJECTS[id] || SUBJECTS.quill; cap.setAttribute('aria-hidden', 'true');
    fig.appendChild(img); fig.appendChild(cap);
    return fig;
  }

  // ---------------------------------------------------------------- style
  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('logmap-style')) return;
    const s = document.createElement('style'); s.id = 'logmap-style';
    s.textContent = `
.lm-group { display: flex; gap: 1.4cqw; align-items: flex-start; margin: .7cqh 0; padding-bottom: .5cqh; border-bottom: 1px dotted var(--gold-dim, #6b5430); }
.lm-sketch { flex: none; width: 12cqw; margin: .3cqh 0 0; text-align: center; }
.lm-sketch img { display: block; width: 100%; height: auto; border: 1px solid #5a3f1c; box-shadow: 0 0 0 1px #000, 0 .3cqh .8cqh rgba(0,0,0,.6); transform: rotate(-1.2deg); }
.lm-group:nth-of-type(even) .lm-sketch img { transform: rotate(1deg); }
.lm-sketch figcaption { font-family: var(--font-sc, serif); font-size: 1.55cqw; line-height: 1.15; color: var(--gold-dim, #b89a5a); margin-top: .5cqh; }
.lm-entries { flex: 1; min-width: 0; }
.lm-entries p { margin: .3cqh 0; }
.lm-legend { display: flex; flex-wrap: wrap; gap: .3cqh 1.6cqw; align-items: center; margin-top: .6cqh; font-family: var(--font-sc, serif); font-size: 1.8cqw; color: var(--parch, #e8d8b0); }
.lm-key { display: inline-flex; align-items: center; gap: .5cqw; white-space: nowrap; }
.lm-key canvas { width: 2.6cqw; height: 2.6cqw; image-rendering: auto; }
#modal-panel.lm-map #amap { max-height: 58cqh !important; }
`;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- logbook decoration
  // Group consecutive entry paragraphs (<p> whose first child is the Day span) by sketch id.
  function decorateLog() {
    const panel = document.getElementById('modal-panel') || document.querySelector('#modal-panel');
    if (!panel || panel.querySelector('.lm-group')) return;
    const isEntry = (n) => n && n.nodeType === 1 && n.tagName === 'P' && n.firstElementChild && n.firstElementChild.tagName === 'SPAN' && n.firstElementChild.classList.contains('muted');
    const kids = Array.prototype.slice.call(panel.children);
    let i = 0;
    while (i < kids.length) {
      if (!isEntry(kids[i])) { i++; continue; }
      const lead = kids[i].firstElementChild.textContent;
      const body = kids[i].textContent.slice(lead.length);
      const id = sketchFor(body);
      const run = [kids[i]]; let j = i + 1;
      while (j < kids.length && isEntry(kids[j]) && sketchFor(kids[j].textContent.slice(kids[j].firstElementChild.textContent.length)) === id) { run.push(kids[j]); j++; }
      const group = document.createElement('div'); group.className = 'lm-group';
      const col = document.createElement('div'); col.className = 'lm-entries';
      panel.insertBefore(group, run[0]);
      group.appendChild(sketchEl(id)); group.appendChild(col);
      run.forEach((p) => col.appendChild(p));
      i = j;
    }
  }

  // ---------------------------------------------------------------- automap stamps
  // Static list derived from the story (which NPCs hand out or advance journal entries). quest() is never called.
  const QUEST_GIVERS = ['harrow', 'lyra', 'kaelen', 'hetty', 'vane', 'rooke', 'orla', 'tobiah', 'tam', 'hob', 'nell', 'ignatius', 'sable',
    'sable_wg', 'sable_dw', 'lyra_wg', 'lyra_dw', 'kaelen_wg', 'kaelen_dw', 'vane_wg', 'vane_dw', 'tobiah_dw', 'halder', 'quist', 'lamplighter',
    'aegis_wg', 'aegis_dw', 'sexton', 'herald', 'mags_dw'];
  const BOSS_TYPES = ['weaver', 'pressman', 'requiem', 'wearer_coda'];
  const KINDS = [['door', 'Door'], ['quest', 'Quest giver'], ['shop', 'Shop'], ['danger', 'Danger'], ['boss', 'Boss'], ['trap', 'Trap']];
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  // Painted stamps: a dark outline, a flat colour wash and one glyph, centred on (x, y). Procedural stand-in.
  function stamp(cx, kind, x, y, s) {
    const h = s / 2;
    cx.save(); cx.translate(x, y); cx.lineJoin = 'round'; cx.lineWidth = Math.max(1, s / 8); cx.strokeStyle = '#140d07';
    if (kind === 'door') {
      cx.fillStyle = '#e0b04a'; cx.beginPath(); cx.moveTo(-h * 0.7, h); cx.lineTo(-h * 0.7, -h * 0.2); cx.arc(0, -h * 0.2, h * 0.7, Math.PI, 0); cx.lineTo(h * 0.7, h); cx.closePath(); cx.fill(); cx.stroke();
      cx.fillStyle = '#5a3a14'; cx.fillRect(-h * 0.28, -h * 0.1, h * 0.56, h * 1.1);
    } else if (kind === 'quest') {
      cx.fillStyle = '#efe2b4'; cx.beginPath(); cx.arc(0, 0, h, 0, 7); cx.fill(); cx.stroke();
      cx.fillStyle = '#a02818'; cx.fillRect(-s * 0.07, -h * 0.62, s * 0.14, h * 0.8); cx.beginPath(); cx.arc(0, h * 0.5, s * 0.09, 0, 7); cx.fill();
    } else if (kind === 'shop') {
      cx.fillStyle = '#d6a232'; cx.beginPath(); cx.arc(0, 0, h, 0, 7); cx.fill(); cx.stroke();
      cx.beginPath(); cx.arc(0, 0, h * 0.55, 0, 7); cx.stroke(); cx.fillStyle = '#5a3a14'; cx.fillRect(-s * 0.06, -h * 0.34, s * 0.12, h * 0.68);
    } else if (kind === 'danger') {
      cx.fillStyle = '#c23a28'; cx.beginPath(); cx.moveTo(0, -h); cx.lineTo(h, h * 0.8); cx.lineTo(-h, h * 0.8); cx.closePath(); cx.fill(); cx.stroke();
      cx.fillStyle = '#f2e6c0'; cx.fillRect(-s * 0.06, -h * 0.35, s * 0.12, h * 0.6); cx.fillRect(-s * 0.06, h * 0.4, s * 0.12, s * 0.1);
    } else if (kind === 'boss') {
      cx.fillStyle = '#8a1c22'; cx.beginPath(); cx.arc(0, h * 0.1, h * 0.85, 0, 7); cx.fill(); cx.stroke();
      cx.fillStyle = '#e8d8a0'; cx.beginPath(); cx.moveTo(-h * 0.7, -h * 0.5); cx.lineTo(-h * 0.45, -h * 1.05); cx.lineTo(-h * 0.1, -h * 0.6); cx.lineTo(0, -h * 1.1); cx.lineTo(h * 0.1, -h * 0.6); cx.lineTo(h * 0.45, -h * 1.05); cx.lineTo(h * 0.7, -h * 0.5); cx.closePath(); cx.fill(); cx.stroke();
      cx.fillStyle = '#140d07'; cx.fillRect(-h * 0.5, h * 0.05, h * 0.3, h * 0.3); cx.fillRect(h * 0.2, h * 0.05, h * 0.3, h * 0.3);
    } else {   // trap: a spiked plate
      cx.fillStyle = '#b8782a'; cx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? h * 0.55 : h; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      cx.closePath(); cx.fill(); cx.stroke(); cx.fillStyle = '#140d07'; cx.beginPath(); cx.arc(0, 0, h * 0.25, 0, 7); cx.fill();
    }
    cx.restore();
  }

  // What to stamp for the current map: [{ kind, x, y }] in cell units, visited cells only.
  function collectStamps(m, ents, flags) {
    const out = [];
    if (!m || !m.visited) return out;
    const seen = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !!m.visited[(y | 0) * m.w + (x | 0)];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!m.visited[y * m.w + x]) continue;
      const c = m.cells[y * m.w + x];
      if (c && (c.door || c.portal)) out.push({ kind: 'door', x: x + 0.5, y: y + 0.5 });
    }
    const qm = typeof UPG === 'undefined' || UPG.questMarkers !== false;
    const npcs = typeof NPCS !== 'undefined' ? NPCS : null, enemies = typeof ENEMIES !== 'undefined' ? ENEMIES : null;
    const traps = typeof TRAP_TYPES !== 'undefined' ? TRAP_TYPES : null;
    for (const e of ents || []) {
      if (!e || e.hidden || e.dead || !seen(e.x, e.y)) continue;
      if (e.kind === 'npc' && typeof e.id === 'string') {
        const shop = has(npcs, e.id) && Array.isArray(npcs[e.id].shop), quest = qm && QUEST_GIVERS.indexOf(e.id) >= 0;
        if (shop) out.push({ kind: 'shop', x: e.x - (quest ? 1.1 : 0), y: e.y - 1 });
        if (quest) out.push({ kind: 'quest', x: e.x + (shop ? 1.1 : 0), y: e.y - 1 });
      } else if (e.kind === 'enemy' && typeof e.type === 'string' && !e.passive) {
        const def = has(enemies, e.type) ? enemies[e.type] : null;
        out.push({ kind: def && (def.boss || def.wildsBoss) || BOSS_TYPES.indexOf(e.type) >= 0 ? 'boss' : 'danger', x: e.x, y: e.y - 0.6 });
      } else if (typeof e.trapType === 'string' && has(traps, e.trapType)) {
        if (!(flags && flags['trap:' + (typeof G !== 'undefined' ? G.mapId : '') + ':' + e.trapId])) out.push({ kind: 'trap', x: e.x, y: e.y });
      }
    }
    return out;
  }
  function legendIcon(kind) {
    const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; cv.setAttribute('aria-hidden', 'true');
    stamp(cv.getContext('2d'), kind, 12, 12, 20); return cv;
  }
  function decorateMap() {
    const cv = document.getElementById('amap') || document.querySelector('#amap');
    if (!cv || typeof G === 'undefined' || !G.map || cv.dataset.lmStamps) return;
    cv.dataset.lmStamps = '1';
    const cx = cv.getContext('2d'), cw = 4, list = collectStamps(G.map, G.ents, G.flags);
    // draw the common small marks first so bosses and quest givers sit on top
    const order = { trap: 0, door: 1, danger: 2, shop: 3, quest: 4, boss: 5 };
    list.sort((a, b) => order[a.kind] - order[b.kind]);
    for (const s of list) stamp(cx, s.kind, s.x * cw, s.y * cw, s.kind === 'boss' ? 12 : s.kind === 'door' ? 7 : 9);
    const lg = document.createElement('div'); lg.className = 'lm-legend'; lg.id = 'lm-legend'; lg.setAttribute('role', 'group'); lg.setAttribute('aria-label', 'Map legend');
    for (const [kind, label] of KINDS) {
      if (kind === 'quest' && typeof UPG !== 'undefined' && UPG.questMarkers === false) continue;
      const k = document.createElement('span'); k.className = 'lm-key'; k.dataset.kind = kind;
      k.appendChild(legendIcon(kind)); const t = document.createElement('span'); t.textContent = label; k.appendChild(t); lg.appendChild(k);
    }
    cv.parentNode.insertBefore(lg, cv.nextSibling);
    const panel = document.getElementById('modal-panel'); if (panel) panel.classList.add('lm-map');
  }

  // ---------------------------------------------------------------- wrap the originals
  if (typeof document !== 'undefined') {
    injectStyle();
    if (typeof renderLog === 'function') {
      const _renderLog = renderLog;
      renderLog = function () {
        const r = _renderLog.apply(this, arguments);
        if (on('logSketches')) { try { decorateLog(); } catch (e) { console.warn('logmap: logbook sketches failed', e); } }
        return r;
      };
    }
    if (typeof renderMap === 'function') {
      const _renderMap = renderMap;
      renderMap = function () {
        const r = _renderMap.apply(this, arguments);
        if (on('mapStamps')) { try { decorateMap(); } catch (e) { console.warn('logmap: map stamps failed', e); } }
        return r;
      };
    }
  }

  return { SUBJECTS, PATTERNS, QUEST_GIVERS, BOSS_TYPES, KINDS, sketchFor, sketchURL, sketchEl, decorateLog, decorateMap, collectStamps, stamp, W, H };
})();
