// ============================================================
//  smalllife — Phase 4 (living world): small creatures, the moored Kestrel, glimmering Light-glass
//  1. CRITTERS. Crows peck and hop on the outdoor maps by day and take wing when you come close
//     (further, and faster, when you run); rats scurry about the cellars, sewers and crypts and
//     bolt for dark corners, never at you. The one real cat (Whisper-Grove) now walks, and darts
//     away from a runner. Crows and rats are transient, non-solid, nopick DECO entities appended
//     after the map is built (never saved, never targeted, never counted by law/bodies/quests).
//     They draw their own random numbers from a private generator so the game's rolls are untouched.
//  2. MOORED KESTREL. Before the Greening (G.flags.greening) the Drift-Kestrel hangs from Oakhaven's
//     mooring mast ("hangs from the mast, her lift-tanks murmuring": game.js, trigger 'mast'). She
//     weathervanes on her line with Weather.wind: slow turn, drift on the rope, a gentle bob.
//     After the Greening the ship has lifted without you (game.js: die('greening')) and Part Three
//     finds her elsewhere, so the condition is: map oakhaven && !flags.greening && !flags.part3.
//  3. LIGHT-GLASS GLIMMER. Shards lying on the floor glint now and then and wear a soft halo, visible
//     from afar. noFlash and reduced motion keep only a steady glow.
//  Art: Phase 20 FOLK pixel art for the crows, rats and the cat's walk (see "pixel-art crows"); the canvas
//  stand-ins below stay as the fallback. The moored Kestrel is still a procedural stand-in.
//  Switches: GFX.critters, GFX.kestrelMoored, GFX.shardGlint (default on, all in GFX.FX so
//  GFX.plain() gives the original frames and game state).
// ============================================================
'use strict';

for (const k of ['critters', 'kestrelMoored', 'shardGlint']) {
  if (GFX[k] === undefined) GFX[k] = true;
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const SMALLLIFE = (() => {
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const stats = { ticks: 0, ms: 0, glints: 0 };
  const reduced = () => !!(GFX.reduceMotion || GFX.reducedMotion);

  // ---------------------------------------------------------------- art (procedural stand-ins)
  function paint(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true }); draw(c);
    const d = c.getImageData(0, 0, w, h);
    return { w, h, data: new Uint32Array(d.data.buffer) };
  }
  function poly(c, col, pts) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function ell(c, col, x, y, rx, ry, rot) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); c.fill(); }
  function line(c, col, x0, y0, x1, y1, w) { c.strokeStyle = col; c.lineWidth = w || 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }

  // crow: 40x32 canvas, feet on the bottom row, facing right. Every frame shares the canvas so
  // the body keeps one size whatever the pose; the margins are transparent.
  function crowFrame(pose) {
    return paint(40, 32, c => {
      const BODY = '#1a1a21', WING = '#272733', SHEEN = '#40465e', BEAK = '#4b4136', EYE = '#d6cfbc';
      const fly = pose.startsWith('fly');
      if (!fly) {
        const peck = pose === 'peck', step = pose === 'w1' ? 1 : pose === 'w2' ? 2 : 0;
        const l1 = step === 1 ? 14 : step === 2 ? 20 : 17, l2 = step === 1 ? 24 : step === 2 ? 20 : 22;
        line(c, '#3a3028', 18, 24, l1, 31, 1.4); line(c, '#3a3028', 22, 24, l2, 31, 1.4);
        poly(c, WING, [[12, 18], [3, 24], [5, 27], [14, 24]]);                     // tail
        ell(c, BODY, 19, peck ? 20 : 19, 9, 6, peck ? 0.32 : 0.1);
        ell(c, WING, 17, peck ? 20 : 19, 6, 3.4, 0.2); ell(c, SHEEN, 20, peck ? 18 : 17, 4, 1.6, 0.1);
        if (peck) {
          line(c, BODY, 25, 18, 29, 22, 3); ell(c, BODY, 30, 23, 4, 3.6, 0);
          poly(c, BEAK, [[33, 22], [37, 29], [32, 26]]); c.fillStyle = EYE; c.fillRect(30, 22, 1, 1);
        } else {
          ell(c, BODY, 28, 13, 4.2, 4, 0);
          poly(c, BEAK, [[31, 11], [38, 14], [31, 16]]); c.fillStyle = EYE; c.fillRect(29, 12, 1, 1);
        }
      } else {
        const up = pose === 'fly1', mid = pose === 'fly2';
        poly(c, WING, [[12, 16], [3, 17], [4, 21], [12, 19]]);
        ell(c, BODY, 20, 16, 8, 4, 0.05);
        ell(c, BODY, 29, 14, 3.4, 3.2, 0); poly(c, BEAK, [[31, 13], [38, 15], [31, 16]]); c.fillStyle = EYE; c.fillRect(29, 13, 1, 1);
        const far = up ? [[17, 13], [10, 1], [24, 4], [26, 13]] : mid ? [[17, 14], [6, 12], [8, 16], [26, 16]] : [[17, 16], [10, 29], [24, 25], [26, 17]];
        const near = up ? [[16, 14], [7, 3], [22, 6], [25, 14]] : mid ? [[16, 15], [3, 14], [5, 18], [25, 17]] : [[16, 17], [7, 30], [22, 27], [25, 17]];
        poly(c, '#1c1c26', far); poly(c, WING, near);
        line(c, SHEEN, near[0][0], near[0][1], near[1][0], near[1][1], 1);
      }
    });
  }
  // rat: 32x16, feet on the bottom row, facing right
  function ratFrame(pose) {
    return paint(32, 16, c => {
      const FUR = '#5b5248', DARK = '#3c352e', PINK = '#a77a78', EAR = '#8b6a66';
      const run = pose === 'run', sniff = pose === 'sniff', step = pose === 'w1' ? 1 : pose === 'w2' ? 2 : 0;
      const lift = sniff ? 3 : 0;
      // tail
      c.strokeStyle = PINK; c.lineWidth = 1; c.beginPath(); c.moveTo(6, 11); c.quadraticCurveTo(run ? 1 : 2, run ? 11 : 14, run ? 0 : 1, run ? 9 : 8); c.stroke();
      // legs
      const f1 = run ? 20 : step === 1 ? 17 : step === 2 ? 21 : 19, f2 = run ? 7 : step === 1 ? 10 : step === 2 ? 7 : 9;
      line(c, DARK, 18, 12, f1, 15, 1.2); line(c, DARK, 20, 12, f1 + 2, 15, 1.2); line(c, DARK, 9, 12, f2, 15, 1.2); line(c, DARK, 11, 12, f2 + 2, 15, 1.2);
      ell(c, FUR, run ? 14 : 13, run ? 10.5 : 10, run ? 9.5 : 8, run ? 3.3 : 4, run ? 0.05 : -0.08);
      poly(c, FUR, [[19, 6 - lift], [28, 10 - lift], [19, 13]]);                    // head and snout
      ell(c, EAR, 18, 6 - lift, 2.2, 2.4, 0); ell(c, DARK, 12, 7.5, 5, 1.6, -0.08);
      c.fillStyle = '#d9d3c8'; c.fillRect(23, 8 - lift, 1, 1);                       // eye glint
      c.fillStyle = PINK; c.fillRect(28, 10 - lift, 1, 1);                          // nose
    });
  }
  // cat walk frames: made from the existing standing cat by raising one forepaw (the bottom of the
  // sprite) and, for the dart, a lower, wider crouch. Final painted sheets replace these.
  function catFrames() {
    const src = Engine.sprites.cat; if (!src) return null;
    const { w, h, data } = src, out = {};
    const paw = (side) => {
      const d = new Uint32Array(w * h), y0 = Math.floor(h * 0.72);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = data[y * w + x]; if (!(px >>> 24)) continue;
        let ty = y; if (y >= y0 && ((side === 1 && x < w * 0.5) || (side === 2 && x >= w * 0.5))) ty = y - 2;
        if (ty >= 0) d[ty * w + x] = px;
      }
      return { w, h, data: d };
    };
    out.cat_w1 = paw(1); out.cat_w2 = paw(2);
    const nw = Math.round(w * 1.2), nh = Math.round(h * 0.88), d = new Uint32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) d[y * nw + x] = data[Math.min(h - 1, (y / nh * h) | 0) * w + Math.min(w - 1, (x / nw * w) | 0)];
    out.cat_run = { w: nw, h: nh, data: d, hs: nh / h };
    return out;
  }
  // moored airship, 144x72, bow to the right. view 0 bow-on .. 2 broadside .. 4 stern-on, 1/3 three-quarter.
  const KV = [{ phi: 90, stern: false }, { phi: 52, stern: false }, { phi: 0, stern: false }, { phi: 52, stern: true }, { phi: 90, stern: true }];
  function kestrelView(i) {
    const { phi, stern } = KV[i], co = Math.cos(phi * Math.PI / 180), si = Math.sin(phi * Math.PI / 180);
    return paint(144, 72, c => {
      const cx = 72, TANK = '#7a6844', BAND = '#b09258', DK = '#3d311f', HULL = '#8a6a3a', HULL2 = '#5a4527', BRASS = '#d1ae62', GLOW = '#f1cd78';
      const L = 130 * co + 26 * si;                                             // projected length of the whole ship
      const x0 = cx - L / 2, x1 = cx + L / 2;                                   // stern end .. bow end on screen
      const bowX = x1, sternX = x0;
      // fins and propeller at the stern (behind the envelope when the bow is toward us)
      const finTop = 14, finBot = 44;
      const finA = Math.max(5, 22 * co + 3);
      if (!(stern === false && phi >= 90)) {
        poly(c, HULL2, [[sternX + finA, finTop + 8], [sternX + 2, finTop - 2], [sternX + 2, finBot - 2], [sternX + finA + 2, finBot]]);
        poly(c, DK, [[sternX + finA, finTop + 12], [sternX + finA * 0.5, finTop + 4], [sternX + finA * 0.5, 40], [sternX + finA, 42]]);
      }
      // three lift-tanks in a row along the keel, end caps rounder when seen end-on
      const tankLen = 38 * co + 22 * si, gap = 3 * co;
      for (let t = 0; t < 3; t++) {
        const tx = sternX + 14 * co + t * (38 * co + gap) + (tankLen - 38 * co) * 0.5;
        const w = Math.max(24, tankLen);
        const px = clamp(tx, 2, 144 - w - 2);
        c.fillStyle = DK; c.beginPath(); c.roundRect(px - 1, 7, w + 2, 30, 13); c.fill();
        c.fillStyle = TANK; c.beginPath(); c.roundRect(px, 8, w, 28, 12); c.fill();
        c.fillStyle = '#9a8656'; c.beginPath(); c.roundRect(px + 2, 10, w - 4, 6, 3); c.fill();
        c.fillStyle = BAND; c.fillRect(px + w * 0.28, 8, 2, 28); c.fillRect(px + w * 0.7, 8, 2, 28);
        c.fillStyle = 'rgba(30,22,10,0.45)'; c.beginPath(); c.roundRect(px + 2, 28, w - 4, 6, 3); c.fill();
      }
      // gondola hull
      const hx0 = sternX + 8 * co, hx1 = bowX - 6 * co, hw = Math.max(26, hx1 - hx0);
      const hl = cx - hw / 2, hr = cx + hw / 2;
      poly(c, HULL, [[hl + 6, 38], [hr - 4, 38], [hr + 4 * co, 46], [hr - 10, 60], [hl + 12, 60], [hl - 2 * co, 48]]);
      poly(c, HULL2, [[hl + 12, 54], [hr - 10, 54], [hr - 12, 60], [hl + 14, 60]]);
      c.fillStyle = BRASS; c.fillRect(hl + 4, 38, hr - hl - 6, 2);
      const ports = Math.max(2, Math.round(hw / 20));
      for (let p = 0; p < ports; p++) { c.fillStyle = GLOW; c.fillRect(hl + 14 + p * ((hw - 30) / Math.max(1, ports - 1)), 45, 3, 3); }
      for (let r = 0; r < 4; r++) line(c, DK, hl + 8 + r * hw / 4, 40, hl + 8 + r * hw / 4, 37, 1); // struts to the tanks
      // propeller disc on the stern
      if (stern || co > 0.2) { c.strokeStyle = 'rgba(200,190,160,0.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(sternX + 2, 46, 2 + 3 * si, 9, 0, 0, TAU); c.stroke(); }
      // bow cone and the mooring line
      if (!stern) {
        poly(c, BRASS, [[bowX - 4, 40], [bowX + 1, 44], [bowX - 4, 48]]);
        line(c, '#cbbf9c', bowX, 44, bowX + (phi >= 90 ? 0 : 3), 33, 1);
        c.fillStyle = BRASS; c.fillRect(bowX - 3, 42, 3, 4);
      }
      if (phi >= 90 && !stern) { ell(c, BRASS, cx, 44, 5, 5, 0); ell(c, DK, cx, 44, 2, 2, 0); }
    });
  }

  const SPR = {};
  function buildSprites() {
    const add = (n, s) => { SPR[n] = Engine.addSprite(n, s); };
    for (const p of ['stand', 'peck', 'w1', 'w2', 'fly1', 'fly2', 'fly3']) add('crow_' + (p.startsWith('fly') ? p : p === 'stand' ? 'stand' : p), crowFrame(p));
    for (const p of ['idle', 'sniff', 'w1', 'w2', 'run']) add('rat_' + p, ratFrame(p === 'idle' ? 'stand' : p));
    for (let i = 0; i < 5; i++) add('kestrel_m' + i, kestrelView(i));
  }
  try { buildSprites(); } catch (err) { console.warn('smalllife sprites failed', err); }
  // the cat's own art arrives with the asset loader, after this script runs: build its walk frames on first need
  let catDone = false;
  function ensureCat() {
    if (catDone || !Engine.sprites.cat) return catDone;
    try { const cf = catFrames(); for (const n in cf) SPR[n] = Engine.addSprite(n, cf[n]); catDone = true; } catch (err) { catDone = true; console.warn('smalllife cat frames failed', err); }
    return catDone;
  }

  // ---------------------------------------------------------------- Phase 20 FOLK: pixel-art crows, rats and the cat's walk
  // Hand-placed pixel shapes run through the icon set's pixel engine (ICONS.pxSprite: five-tone ramps lit from the
  // top-left, ink outline), so the small life shares one look with the item icons. Same canvases, same feet rows and
  // the same frame names as the stand-ins above, so placement, scale and behaviour are unchanged; the stand-ins stay
  // as the fallback if the engine is missing. The cat gets a real side-on walk (it used to walk as its sitting self).
  // Deterministic: no random numbers.
  const PXC = { crow: '#24242e', wing: '#2a2b3c', sheen: '#5d6a98', beak: '#5a4c3c', leg: '#4a3e30', eye: '#e2dccb',
    rat: '#6a5f53', ratDark: '#4a4139', pink: '#b08480', ear: '#9a7470',
    cat: '#7c7466', catDark: '#4a453e', catLight: '#c4bcab', catNose: '#b08a80', catEye: '#c8c060' };
  function pxCrow(pose) {
    return ICONS.pxSprite(40, 32, d => {
      const fly = pose.startsWith('fly');
      if (!fly) {
        const peck = pose === 'peck', st = pose === 'w1' ? 1 : pose === 'w2' ? 2 : 0;
        const l1 = st === 1 ? 14 : st === 2 ? 20 : 17, l2 = st === 1 ? 24 : st === 2 ? 20 : 22;
        const leg = d.layer(PXC.leg, { shade: 'flat' }); leg.line(18, 24, l1, 30).line(22, 24, l2, 30).line(l1 - 1, 31, l1 + 2, 31).line(l2 - 1, 31, l2 + 2, 31);
        d.layer(PXC.wing).poly([13, 17, 3, 22, 4, 26, 15, 23]);
        const by = peck ? 20 : 19;
        d.layer(PXC.crow, { lift: -1 }).ell(19, by, 9.5, 6);
        const w = d.layer(PXC.wing, { lift: -1 }).poly([10, by - 3, 24, by - 4, 26, by, 20, by + 3, 8, by + 2]);
        w.tone(1, 12, by + 1, 15, by + 2, 18, by + 2);
        d.mark(PXC.sheen, 14, by - 3, 15, by - 3, 18, by - 4, 21, by - 4);
        if (peck) {
          d.layer(PXC.crow, { lift: -1 }).thick([25, 19, 29, 22], 2).ell(30.5, 23.5, 3.8, 3.4);
          d.layer(PXC.beak).poly([33, 22, 38, 29, 32, 26]);
          d.mark(PXC.eye, 31, 22);
        } else {
          d.layer(PXC.crow, { lift: -1 }).ell(28.5, 13.5, 4.4, 4.1).thick([25, 16, 27, 15], 2.4);
          d.mark(PXC.sheen, 27, 10, 28, 10);
          d.layer(PXC.beak).poly([31.5, 11.5, 38.5, 14, 31.5, 16]).tone(3, 32, 12, 33, 12);
          d.mark(PXC.eye, 29, 12);
        }
      } else {
        const up = pose === 'fly1', mid = pose === 'fly2';
        d.layer(PXC.wing).poly([13, 15, 3, 16, 4, 21, 13, 19]);
        const far = up ? [17, 13, 10, 1, 24, 4, 26, 13] : mid ? [17, 14, 6, 12, 8, 16, 26, 16] : [17, 16, 10, 29, 24, 25, 26, 17];
        d.layer('#202030').poly(far);
        d.layer(PXC.crow, { lift: -1 }).ell(20, 16, 8.5, 4.2).ell(29, 14, 3.6, 3.3);
        d.layer(PXC.beak).poly([31.5, 12.5, 38.5, 15, 31.5, 16.5]);
        const near = up ? [16, 14, 7, 3, 22, 6, 25, 14] : mid ? [16, 15, 3, 14, 5, 18, 25, 17] : [16, 17, 7, 30, 22, 27, 25, 17];
        const nw = d.layer(PXC.wing, { lift: -1 }).poly(near);
        d.mark(PXC.sheen, near[0] - 1, near[1] - 1, near[0] - 2, near[1] - (up ? 2 : 0));
        // primaries: dark slits along the trailing edge
        if (!mid) for (let i = 0; i < 4; i++) nw.tone(1, near[2] + 2 + i * 3, up ? 5 + i : 28 - i);
        d.mark(PXC.eye, 30, 13);
      }
    });
  }
  function pxRat(pose) {
    return ICONS.pxSprite(32, 16, d => {
      const run = pose === 'run', sniff = pose === 'sniff', st = pose === 'w1' ? 1 : pose === 'w2' ? 2 : 0, lift = sniff ? 3 : 0;
      d.layer(PXC.pink, { shade: 'flat' }).path(run ? [7, 11, 3, 11, 0, 9] : [7, 11, 3, 13, 1, 11, 1, 8]);
      const f1 = run ? 20 : st === 1 ? 17 : st === 2 ? 21 : 19, f2 = run ? 7 : st === 1 ? 10 : st === 2 ? 7 : 9;
      d.layer(PXC.ratDark, { shade: 'flat' }).line(18, 12, f1, 15).line(20, 12, f1 + 2, 15).line(9, 12, f2, 15).line(11, 12, f2 + 2, 15);
      d.layer(PXC.rat, { shiny: 1 }).ell(run ? 14 : 13.5, run ? 10.5 : 10, run ? 9.5 : 8, run ? 3.4 : 4);
      d.layer(PXC.rat, { shiny: 1 }).poly([19, 6 - lift, 28, 10 - lift, 27, 11 - lift, 19, 13]);
      d.layer(PXC.ear).ell(18.5, 6 - lift, 2.2, 2.3);
      d.mark('#e0dad0', 23, 8 - lift).mark(PXC.pink, 28, 10 - lift).mark('#2a2420', 23, 9 - lift);
      d.mark('#8a8074', 11, 7, 14, 7, 16, 7);
    });
  }
  // the cat walking, side on, bow to the right: 92x48 at the sitting cat's own pixel size (hs = 48/70)
  function pxCat(pose) {
    const sp = ICONS.pxSprite(92, 48, d => {
      const run = pose === 'run', st = pose === 'w1' ? 1 : 2;
      const x0 = run ? 24 : 28, x1 = run ? 66 : 62, by = run ? 30 : 29, ry = run ? 8 : 9.5;   // body: hips x0 .. shoulders x1
      const legs = (far) => {
        const L = d.layer(far ? PXC.catDark : PXC.cat, { lift: far ? 0 : 0 });
        const a = (st === 1) !== far ? 1 : -1, o = far ? 2 : 0;
        if (run) {
          L.thick([x0 + 3, by, x0 - 6 - o, by + 8, x0 - 13 - o, 45], t => 3.6 - t * 1.4).thick([x1 - 3, by + 1, x1 + 6 + o, by + 9, x1 + 12 + o, 44], t => 3.2 - t * 1.2);
        } else {
          L.thick([x0 + 4, by, x0 + 4 + a * 3, by + 9, x0 + 4 + a * 6, 45], t => 3.8 - t * 1.6).thick([x1 - 4, by + 1, x1 - 4 - a * 3, by + 9, x1 - 4 - a * 5, 45], t => 3.2 - t * 1.2);
        }
        L.ell(run ? x0 - 13 - o : x0 + 4 + a * 6, 46, 2.4, 1.4).ell(run ? x1 + 12 + o : x1 - 4 - a * 5, 46, 2.2, 1.4);   // paws
      };
      legs(true);
      const tail = d.layer(PXC.cat);
      tail.thick(run ? [x0 + 1, by - 4, x0 - 8, by - 7, x0 - 16, by - 12, x0 - 18, by - 18] : [x0 + 1, by - 4, x0 - 7, by - 6, x0 - 12, by - 13, x0 - 11, by - 21], t => 2.8 - t * 0.9);
      const b = d.layer(PXC.cat, { shiny: 1 }).ell((x0 + x1) / 2, by, (x1 - x0) / 2 + 5, ry).ell(x1 + 2, by - 4, 6, 7);
      legs(false);
      const hx = run ? x1 + 10 : x1 + 8, hy = run ? by - 9 : by - 13;
      const h = d.layer(PXC.cat, { shiny: 1 }).ell(hx, hy, 7.2, 6.6);
      d.layer(PXC.cat).poly([hx - 6, hy - 3, hx - 4.5, hy - 11, hx - 0.5, hy - 5]).poly([hx + 0.5, hy - 5, hx + 3.5, hy - 12, hx + 6, hy - 3]);
      d.layer(PXC.catLight, { sep: false }).ell(hx + 4, hy + 3, 3.6, 2.6);
      // tabby: dark stripes across the back, rings on the tail, an M on the brow
      const on = (L, x, y) => L.m[y * 92 + x];
      for (let x = x0 - 2; x < x1 + 2; x += 5) for (let k = 0; k < 7; k++) { const px = x + (k >> 1), py = Math.round(by - ry) + 1 + k; if (on(b, px, py)) b.tone(1, px, py); }
      for (let y = 0; y < 48; y += 4) for (let x = 0; x < 40; x++) if (on(tail, x, y) && !on(b, x, y)) tail.tone(1, x, y);
      h.tone(1, hx - 3, hy - 4, hx - 2, hy - 5, hx - 1, hy - 4, hx, hy - 5, hx + 1, hy - 4);
      d.mark(PXC.catNose, hx + 7, hy + 1).mark(PXC.catEye, hx + 3, hy - 1).mark('#1a1410', hx + 4, hy - 1).mark('#5a5048', hx + 6, hy + 3, hx + 5, hy + 4);
    });
    sp.hs = 48 / 70;
    return sp;
  }
  let pxDone = false;
  function upgradeArt() {
    if (pxDone || typeof ICONS === 'undefined' || !ICONS.pxSprite || !GFX.critters) return;
    pxDone = true;
    try {
      for (const p of ['stand', 'peck', 'w1', 'w2', 'fly1', 'fly2', 'fly3']) SPR['crow_' + p] = Engine.addSprite('crow_' + p, pxCrow(p));
      for (const p of ['idle', 'sniff', 'w1', 'w2', 'run']) SPR['rat_' + p] = Engine.addSprite('rat_' + p, pxRat(p === 'idle' ? 'stand' : p));
      stats.pixelArt = true;
    } catch (err) { console.warn('smalllife pixel art failed; stand-ins kept', err); }
  }
  // the cat's walk: pixel art when the engine is there, else the Phase 4 stand-in built from the sitting cat
  const _catFrames = catFrames;
  catFrames = function () {
    if (typeof ICONS !== 'undefined' && ICONS.pxSprite) { try { return { cat_w1: pxCat('w1'), cat_w2: pxCat('w2'), cat_run: pxCat('run') }; } catch (err) { console.warn('pixel cat failed', err); } }
    return _catFrames();
  };

  // ---------------------------------------------------------------- private random numbers
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngFor(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------------------------------------------------------------- the player's pace
  // running is not stored: G.vel is the eased velocity; walking tops out at 2.6 + Speed/60
  function playerPace() {
    const v = G.vel ? Math.hypot(G.vel.x, G.vel.y) : 0;
    const base = 2.6 + ((G.player && G.player.attrs && G.player.attrs.Speed) || 0) / 60;
    return { v, moving: v > 0.4, run: v > base * 1.3 };
  }

  // ---------------------------------------------------------------- critters
  const CROWS = { oakhaven: 4, clearing: 3, whispergrove: 2, deepwoods: 3 };
  const RATS = { underhedge: 4, quarry: 4, catacombs: 5, malting: 3, rootvault: 3, mausoleum: 3 };
  const L = { list: [], mapId: null, n: 0, rng: null, visit: 0, lamps: null, t: 0 };
    const density = () => clamp(typeof GFX.particles === 'number' ? GFX.particles : 1, 0, 1.5);
  const crowsAwake = () => G.tod > 0.27 && G.tod < 0.76;
  const enabled = () => !!GFX.critters && !!G.map && G.state !== 'title';

  function openAt(x, y) {
    const m = G.map; if (!m || x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) return false;
    if (m.isBlocked(x | 0, y | 0)) return false;
    if (typeof waterLvl === 'function' && waterLvl(x, y) > 0) return false;
    return !solidAt(x, y, null);
  }
  const wallsAround = (x, y) => { const m = G.map; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.isBlocked((x + dx) | 0, (y + dy) | 0)) n++; return n; };
  function lampsOf(m) {
    const a = [];
    for (const e of m.entities) if (!e.dead && (e.sprite === 'lamp' || e.sprite === 'campfire' || e.sprite === 'hearth' || e.item === 'shard' || e.glassLamp || e.glow > 0.4)) a.push(e);
    return a;
  }
  function darkness(x, y) {
    let d = 8; const a = L.lamps || [];
    for (let i = 0; i < a.length; i++) { const k = Math.hypot(a[i].x - x, a[i].y - y); if (k < d) d = k; }
    return d;                                   // distance to the nearest light: bigger = darker
  }

  function makeCritter(kind, x, y) {
    const crow = kind === 'crow';
    const e = {
      kind: 'deco', sprite: crow ? 'crow_stand' : 'rat_idle', x, y, scale: crow ? 0.36 : 0.2, solid: false, radius: 0.1,
      nopick: true, transient: true, _decor: true, label: crow ? 'A crow' : 'A rat',
      _sl: { kind, st: crow ? 'peck' : 'idle', t: 1 + L.rng() * 3, ph: L.rng() * 6, tx: x, ty: y, lift: 0, flip: false, face: 1, vx: 0, vy: 0, fp: 0, stuck: 0, home: [x, y] },
    };
    return e;
  }
  function clearCritters() {
    for (const id in G.maps) { const l = G.maps[id].entities; for (let i = l.length - 1; i >= 0; i--) if (l[i]._sl) l.splice(i, 1); }
    L.list.length = 0;
  }
  function populate() {
    clearCritters(); L.mapId = G.map ? G.mapId : null; L.lamps = null;
    if (!enabled()) return;
    upgradeArt();
    const id = G.mapId, m = G.map, d = density();
    const kind = m.outdoor && CROWS[id] ? 'crow' : RATS[id] ? 'rat' : null;
    if (!kind) return;
    L.visit++; L.rng = rngFor(hashStr(id) + L.visit * 7919 + (G.day | 0));
    const want = Math.round((kind === 'crow' ? CROWS[id] : RATS[id]) * d);
    L.n = want; if (kind === 'rat') L.lamps = lampsOf(m);
    const c = Engine.cam;
    for (let i = 0; i < want; i++) {
      for (let tries = 0; tries < 80; tries++) {
        const x = 1.5 + L.rng() * (m.w - 3), y = 1.5 + L.rng() * (m.h - 3);
        if (!openAt(x, y)) continue;
        if (Math.hypot(x - c.x, y - c.y) < (kind === 'crow' ? 6 : 5)) continue;
        if (kind === 'rat' && wallsAround(x, y) === 0) continue;
        const e = makeCritter(kind, x, y);
        if (kind === 'crow' && !crowsAwake()) { e.hidden = true; e._sl.st = 'gone'; e._sl.t = 5 + L.rng() * 10; }
        L.list.push(e); m.entities.push(e); break;
      }
    }
  }

  function step(e, dx, dy) {            // one walking step; false when something is in the way
    let moved = false;
    if (!solidAt(e.x + dx, e.y, e) && !(typeof waterLvl === 'function' && waterLvl(e.x + dx, e.y) > 1)) { e.x += dx; moved = true; }
    if (!solidAt(e.x, e.y + dy, e) && !(typeof waterLvl === 'function' && waterLvl(e.x, e.y + dy) > 1)) { e.y += dy; moved = true; }
    return moved;
  }
  function face(e, dx) {                // screen-space facing from a world movement
    const c = Engine.cam, across = dx[0] * -Math.sin(c.dir) + dx[1] * Math.cos(c.dir);
    if (across < -0.05) e._sl.flip = true; else if (across > 0.05) e._sl.flip = false;
  }
  const fare = (e) => e._sl;

  // crow landing spot: open ground away from the player, in sight of the take-off point
  function landingSpot(e, away) {
    const r = L.rng, c = Engine.cam;
    for (let k = 0; k < 10; k++) {
      const a = away + (r() - 0.5) * 2.4, d = 7 + r() * 7, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
      if (!openAt(x, y) || Math.hypot(x - c.x, y - c.y) < 5) continue;
      return [x, y];
    }
    return null;
  }
  function spotOutOfSight() {
    const r = L.rng, c = Engine.cam;
    for (let k = 0; k < 30; k++) {
      const x = 1.5 + r() * (G.map.w - 3), y = 1.5 + r() * (G.map.h - 3), d = Math.hypot(x - c.x, y - c.y);
      if (d < 7 || !openAt(x, y)) continue;
      if (d < 14 && los(c.x, c.y, x, y)) continue;
      return [x, y];
    }
    return null;
  }

  function tickCrow(e, dt, pace, dist) {
    const s = fare(e), c = Engine.cam;
    s.t -= dt;
    const awake = crowsAwake();
    const R = pace.run ? 7 : pace.moving ? 3.4 : 2.1;
    if (s.st === 'fly') {
      s.fp += dt / s.dur; s.fl += dt;
      const u = clamp(s.fp, 0, 1);
      e.x = s.x0 + (s.tx - s.x0) * u; e.y = s.y0 + (s.ty - s.y0) * u;
      s.lift = s.alt * Math.pow(Math.sin(Math.PI * u), 0.55);
      face(e, [s.tx - s.x0, s.ty - s.y0]);
      if (s.fp >= 1) {
        if (s.far) { s.st = 'gone'; e.hidden = true; s.t = 6 + L.rng() * 14; s.lift = 0; }
        else { s.st = 'peck'; s.t = 1.5 + L.rng() * 2.5; s.lift = 0; }
      }
      return;
    }
    if (s.st === 'gone') {
      e.hidden = true;
      if (s.t <= 0 && awake) {
        const sp = spotOutOfSight();
        if (sp) { e.x = sp[0]; e.y = sp[1]; e.hidden = false; s.st = 'peck'; s.t = 2 + L.rng() * 2; s.lift = 0; }
        else s.t = 3;
      }
      return;
    }
    // startled, or the day is over: take off
    if (dist < R || !awake) {
      const away = Math.atan2(e.y - c.y, e.x - c.x), r = L.rng;
      let tgt = awake ? landingSpot(e, away) : null, far = false;
      if (!tgt) { far = true; const a = away + (r() - 0.5) * 1.2; tgt = [e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26]; }
      const d = Math.hypot(tgt[0] - e.x, tgt[1] - e.y), sp = pace.run ? 5.6 : 4.2;
      Object.assign(s, { st: 'fly', x0: e.x, y0: e.y, tx: tgt[0], ty: tgt[1], dur: d / sp, fp: 0, fl: 0, alt: 1.5 + r() * 0.7, far });
      if (dist < 9 && Audio_ && Audio_.sfx && Audio_.sfx.bird && !s.mute && L.t > (s.lastCaw || 0) + 4) { s.lastCaw = L.t; try { Audio_.sfx.bird(); } catch (err) { /* sound is optional */ } }
      return;
    }
    if (s.st === 'peck') {
      s.ph += dt * 5;
      if (s.t <= 0) { s.st = 'hop'; s.t = 0.7 + L.rng() * 1.1; const a = L.rng() * TAU; s.vx = Math.cos(a); s.vy = Math.sin(a); s.ph = 0; }
    } else if (s.st === 'hop') {
      s.ph += dt * 7;
      if (!step(e, s.vx * 0.85 * dt, s.vy * 0.85 * dt)) s.t = 0; else face(e, [s.vx, s.vy]);
      if (s.t <= 0) { s.st = L.rng() < 0.55 ? 'peck' : 'look'; s.t = 1.2 + L.rng() * 2.6; }
    } else if (s.st === 'look') {          // head up, still
      if (s.t <= 0) { s.st = 'peck'; s.t = 1.5 + L.rng() * 2.5; }
    }
  }

  // best dark corner within reach, not toward the player
  function pickCorner(e, c) {
    const r = L.rng, away = Math.atan2(e.y - c.y, e.x - c.x), dp = Math.hypot(e.x - c.x, e.y - c.y);
    let best = null, bs = -1e9;
    for (let k = 0; k < 14; k++) {
      const a = away + (r() - 0.5) * 3.0, d = 2.2 + r() * 5, x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
      if (!openAt(x, y) || !los(e.x, e.y, x, y)) continue;
      const far = Math.hypot(x - c.x, y - c.y);
      if (far < dp + 0.8) continue;                            // never a spot nearer the player than here
      const score = darkness(x, y) * 1.0 + wallsAround(x, y) * 1.6 + far * 0.35 - d * 0.15;
      if (score > bs) { bs = score; best = [x, y]; }
    }
    return best;
  }
  function tickRat(e, dt, pace, dist) {
    const s = fare(e), c = Engine.cam;
    s.t -= dt;
    const R = pace.run ? 5 : pace.moving ? 2.7 : 1.5;
    if (dist < R && s.st !== 'flee' && s.st !== 'cower') {
      const t = pickCorner(e, c);
      if (t) { s.st = 'flee'; s.tx = t[0]; s.ty = t[1]; s.run = pace.run; s.stuck = 0; s.t = 4; if (dist < 6 && L.t > (s.lastSq || 0) + 5) { s.lastSq = L.t; try { Audio_.sfx.rat(); } catch (err) { /* optional */ } } }
      else { s.st = 'cower'; s.t = 1.2; }                       // nowhere to go but at you: stay put
    }
    if (s.st === 'flee') {
      const dx = s.tx - e.x, dy = s.ty - e.y, d = Math.hypot(dx, dy);
      const sp = (s.run || pace.run ? 4.4 : 3.0), mv = Math.min(d, sp * dt);
      if (d < 0.2 || s.t <= 0) { s.st = 'hide'; s.t = 2 + L.rng() * 3; }
      else {
        const ok = step(e, dx / d * mv, dy / d * mv);
        if (ok) { s.ph += dt * 16; face(e, [dx, dy]); s.stuck = 0; } else if ((s.stuck += dt) > 0.4) { s.st = 'hide'; s.t = 1.5; }
      }
      s.speed = sp;
    } else if (s.st === 'cower') {
      if (s.t <= 0 || dist > R + 1) { s.st = 'hide'; s.t = 1.5; }
    } else if (s.st === 'hide' || s.st === 'idle') {
      s.ph += dt * 5;
      if (s.t <= 0) {
        if (L.rng() < 0.6) { const a = L.rng() * TAU; s.st = 'scurry'; s.tx = e.x + Math.cos(a) * (0.8 + L.rng() * 1.8); s.ty = e.y + Math.sin(a) * (0.8 + L.rng() * 1.8); s.t = 1.6; s.stuck = 0; }
        else { s.st = 'idle'; s.t = 1.5 + L.rng() * 3; }
      }
    } else if (s.st === 'scurry') {
      const dx = s.tx - e.x, dy = s.ty - e.y, d = Math.hypot(dx, dy), mv = Math.min(d, 1.4 * dt);
      if (d < 0.1 || s.t <= 0) { s.st = 'idle'; s.t = 1 + L.rng() * 3; }
      else if (step(e, dx / d * mv, dy / d * mv)) { s.ph += dt * 9; face(e, [dx, dy]); } else { s.st = 'idle'; s.t = 1; }
    }
  }

  // ---------------------------------------------------------------- the cat
  function theCat() { if (!G.ents) return null; for (let i = 0; i < G.ents.length; i++) { const e = G.ents[i]; if (e.kind === 'npc' && e.id === 'cat' && !e.dead) return e; } return null; }
  function tickCat(e, dt, pace) {
    ensureCat();
    if (e._slCalm > 0) e._slCalm -= dt;
    const c = Engine.cam, dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
    // a runner puts it to flight at a distance; a walker only if he bears straight down on it, so petting still works
    const R = pace.run ? 5.2 : pace.moving ? 1.15 : 0;
    const home = Math.hypot(e.x - e.homeX, e.y - e.homeY);
    if (!(e._slCalm > 0) && d < R && home < 6.5 && G.state === 'play') {
      const base = Math.atan2(dy, dx), sp = pace.run ? 3.4 : 2.0;
      for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
        const a = base + off;
        if (step(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt)) { e._slFlee = 0.5; break; }
      }
      e.moving = false; e.wanderT = Math.max(e.wanderT || 0, 0.4);
    } else if (e._slFlee > 0) e._slFlee -= dt;
  }

  // ---------------------------------------------------------------- tick and animation wrappers
  function tick(dt) {
    L.t += dt;
    const pace = playerPace();
    const cat = theCat(); if (cat && GFX.critters) tickCat(cat, dt, pace);
    if (!enabled()) { if (L.list.length) clearCritters(); return; }
    if (L.mapId !== G.mapId && G.maps[G.mapId] === G.map) populate();
    const c = Engine.cam;
    for (let i = 0; i < L.list.length; i++) {
      const e = L.list[i];
      if (G.ents.indexOf(e) < 0) { G.ents.push(e); }       // another module swept transients: put it back
      const dist = Math.hypot(e.x - c.x, e.y - c.y);
      if (e._sl.kind === 'crow') tickCrow(e, dt, pace, dist); else tickRat(e, dt, pace, dist);
      look(e);
    }
  }
  // choose the frame for the entity's state
  function look(e) {
    const s = e._sl;
    e.animFlip = s.flip;
    if (s.kind === 'crow') {
      if (s.st === 'fly') e.animSprite = ['crow_fly1', 'crow_fly2', 'crow_fly3', 'crow_fly2'][((s.fl * (reduced() ? 4 : 9)) | 0) & 3];
      else if (s.st === 'peck') e.animSprite = (Math.sin(s.ph) > 0.15 && !reduced()) || (reduced() && s.t > 1) ? 'crow_peck' : 'crow_stand';
      else if (s.st === 'hop') e.animSprite = ((s.ph | 0) & 1) ? 'crow_w1' : 'crow_w2';
      else e.animSprite = 'crow_stand';
    } else {
      if (s.st === 'flee') e.animSprite = (s.speed > 3.5 ? ['rat_run', 'rat_w1', 'rat_run', 'rat_w2'] : ['rat_w1', 'rat_w2'])[((s.ph) | 0) % (s.speed > 3.5 ? 4 : 2)];
      else if (s.st === 'scurry') e.animSprite = ((s.ph | 0) & 1) ? 'rat_w1' : 'rat_w2';
      else if (s.st === 'idle') e.animSprite = (Math.sin(s.ph) > 0.4 && !reduced()) ? 'rat_sniff' : 'rat_idle';
      else e.animSprite = 'rat_idle';
    }
  }

  // ---------------------------------------------------------------- the moored Kestrel
  const MAST = { x: 37, y: 20, top: 2.8 };
  const SHIP = { scale: 1.7, half: 1.85, lift: 1.2, h0: -Math.PI / 2 - 0.2 };
  const wind01 = () => clamp(typeof Weather !== 'undefined' && typeof Weather.wind === 'number' ? Weather.wind : 0.15, 0, 1.1);
  const isMoored = () => !!GFX.kestrelMoored && !!G.map && G.mapId === 'oakhaven' && !!G.flags && !G.flags.greening && !G.flags.part3;
  // pure function of the animation clock and the wind: heading, rope-swing position and bob
  function shipPose(T, wind) {
    const w = wind == null ? wind01() : wind;
    const calm = reduced();
    const A = calm ? 0 : 0.5 + 0.8 * clamp(w, 0, 1);
    const h = SHIP.h0 + A * (0.62 * Math.sin(0.11 * T + 1.3) + 0.38 * Math.sin(0.047 * T + 0.4));
    const bob = calm ? 0 : (0.035 + 0.05 * w) * Math.sin(0.7 * T) + 0.02 * Math.sin(1.9 * T + 1);
    return {
      h, x: MAST.x - Math.cos(h) * SHIP.half, y: MAST.y - Math.sin(h) * SHIP.half, lift: SHIP.lift + bob,
      skew: calm ? 0 : 0.012 * Math.sin(0.5 * T + 2) * (0.5 + w), nose: { x: MAST.x, y: MAST.y },
    };
  }
  const ship = { e: null };
  function syncShip() {
    // only ever created while playing: some tests (and tools) build their own map and expect nothing appended at load
    const want = isMoored() && (G.state === 'play' || G.state === 'dialogue') && G.maps[G.mapId] === G.map, l = G.ents;
    if (!l) return;
    if (want) {
      if (!ship.e || l.indexOf(ship.e) < 0) {
        for (const id in G.maps) { const q = G.maps[id].entities; for (let i = q.length - 1; i >= 0; i--) if (q[i]._slShip) q.splice(i, 1); }
        const p = shipPose(0);
        ship.e = { kind: 'deco', sprite: 'kestrel_m2', x: p.x, y: p.y, scale: SHIP.scale, solid: false, radius: 0.1, nopick: true, transient: true, _decor: true, _slShip: true, label: 'The Drift-Kestrel, moored at the mast' };
        l.push(ship.e);
      }
    } else if (ship.e) {
      for (const id in G.maps) { const q = G.maps[id].entities; const i = q.indexOf(ship.e); if (i >= 0) q.splice(i, 1); }
      ship.e = null;
    }
  }
  // octant of the camera relative to the ship's bow: 0 bow-on .. 4 stern-on, flipped past 4 (as anim.js does for the proctor)
  function shipView(h, x, y) {
    const c = Engine.cam, rel = Math.atan2(c.y - y, c.x - x) - h;
    const o = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
    return { view: Math.min(o, 8 - o), flip: o > 4 };
  }
  function animShip(e, T) {
    const p = shipPose(T);
    e.x = p.x; e.y = p.y; e.animLift = p.lift; e.animSkew = p.skew;
    const v = shipView(p.h, p.x, p.y);
    e.animSprite = 'kestrel_m' + v.view; e.animFlip = v.flip;
  }

  // ---------------------------------------------------------------- hooks
  const _loadMap = loadMap;
  loadMap = function (id, pos) {
    const r = _loadMap(id, pos);
    try { ship.e = null; clearCritters(); L.mapId = null; } catch (err) { console.warn('smalllife loadMap', err); }
    return r;
  };
  const _update = update;
  update = function (dt) {
    const r = _update(dt);
    if (G.state === 'play' || G.state === 'dialogue') {
      const t0 = SMALLLIFE.timing ? performance.now() : 0;
      try { syncShip(); if (G.state === 'play') tick(Math.min(dt, 0.1)); } catch (err) { /* never break a tick */ }
      if (t0) { stats.ms += performance.now() - t0; stats.ticks++; }
    }
    return r;
  };
  const _render = render;
  render = function () { try { syncShip(); } catch (err) { /* never break a frame */ } return _render(); };
  const _animDeco = animDeco;
  animDeco = function (e, dt, T, outdoor) {
    _animDeco(e, dt, T, outdoor);
    try {
      if (e._slShip) animShip(e, T);
      else if (e._sl) { e.animLift = e._sl.lift; if (e._sl.st === 'fly') e.animSkew = (e._sl.fl % 0.3 < 0.15 ? 1 : -1) * 0.02; }
    } catch (err) { /* never break a frame */ }
  };
  // the cat: walk frames from its own movement; flee posture
  const _animCreature = animCreature;
  animCreature = function (e, dt, T) {
    _animCreature(e, dt, T);
    try {
      if (!GFX.critters || e.id !== 'cat' || e.kind !== 'npc') return;
      if (e._spd > 0.25 && ensureCat()) {
        const k = Math.floor((e._phase || 0) / (Math.PI / 2));
        e.animSprite = e._slFlee > 0 ? 'cat_run' : ((k & 1) ? 'cat_w2' : 'cat_w1');
        if (e._slFlee > 0) { e.animSX *= 1.04; e.animSY *= 0.97; }
      }
    } catch (err) { /* never break a frame */ }
  };
  const _talkCat = talkCat;
  talkCat = function (e) { if (e) e._slCalm = 4; return _talkCat.apply(this, arguments); };
  GFX.onChange(() => { try { if (G.map) { if (G.state === 'play' || G.state === 'dialogue') populate(); else { clearCritters(); L.mapId = null; } syncShip(); if (!GFX.critters) { const c = theCat(); if (c) { c.animSprite = null; c._slFlee = 0; } } } } catch (err) { console.warn('smalllife change', err); } });

  // ---------------------------------------------------------------- rendering: mooring line and shard glimmer
  const mix = (fb, o, r, g, b, a) => { const px = fb[o]; fb[o] = (255 << 24) | (((px >> 16 & 255) + (b - (px >> 16 & 255)) * a) << 16) | (((px >> 8 & 255) + (g - (px >> 8 & 255)) * a) << 8) | ((px & 255) + (r - (px & 255)) * a); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function project(F, x, y, z, out) {
    const sx = x - F.cam.x, sy = y - F.cam.y, inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY);
    const trX = inv * (F.dirY * sx - F.dirX * sy), trY = inv * (-F.planeY * sx + F.planeX * sy);
    if (trY <= 0.1) return false;
    out.x = (F.w / 2) * (1 + trX / trY); out.y = F.horizon + (F.cam.z - z) * F.h / trY; out.z = trY; return true;
  }
  const pa = { x: 0, y: 0, z: 0 }, pb = { x: 0, y: 0, z: 0 };
  function rope(F) {
    if (!ship.e || !isMoored() || !F.outdoor) return;
    const p = shipPose(F.animT), e = ship.e;
    if (!project(F, MAST.x, MAST.y, MAST.top - 0.05, pa)) return;
    // the bow cone sits about 0.9 above the hull's keel on the sprite
    if (!project(F, p.x + Math.cos(p.h) * SHIP.half * 0.97, p.y + Math.sin(p.h) * SHIP.half * 0.97, p.lift + SHIP.scale * 0.43, pb)) return;
    const n = Math.max(2, Math.min(80, Math.hypot(pb.x - pa.x, pb.y - pa.y) | 0)), db = F.dbuf, fb = F.fb;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = pa.x + (pb.x - pa.x) * u, y = pa.y + (pb.y - pa.y) * u + Math.sin(u * Math.PI) * 1.5 * F.S, z = pa.z + (pb.z - pa.z) * u;
      const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= F.w || yi >= F.h) continue;
      const o = yi * F.w + xi; if (db && db[o] < z - 0.1) continue;
      mix(fb, o, 150, 138, 108, 0.75);
    }
  }
  const SEED = e => ((e.x * 12.9898 + e.y * 78.233) % 1 + 1) % 1;
  function glimmer(F) {
    const l = G.ents; if (!l || !GFX.shardGlint) return;
    const still = GFX.noFlash || reduced();
    const W = F.w, H = F.h, S = F.S, fb = F.fb, db = F.dbuf, mb = F.mbuf, T = F.animT;
    const sky = F.outdoor ? 0.55 + 0.45 * (1 - clamp(F.skyDay == null ? 0 : F.skyDay, 0, 1)) : 1;
    for (let i = 0; i < l.length; i++) {
      const e = l[i];
      if (e.item !== 'shard' || e.hidden || e.dead || !e._screen) continue;
      const s = e._screen, x0 = s.x0 * S, x1 = s.x1 * S, y0 = s.y0 * S, y1 = s.y1 * S, wpx = x1 - x0, hpx = y1 - y0;
      const cx = (x0 + x1) / 2, cy = y0 + hpx * 0.42, z = s.z, sd = SEED(e);
      // steady halo: dithered, so it never washes the floor out
      const rad = clamp(hpx * 0.8, 2.2 * S, 15 * S);
      const breath = still ? 1 : 0.88 + 0.12 * Math.sin(T * 1.7 + sd * TAU);
      const ha = 0.26 * sky * breath;
      for (let y = Math.max(0, (cy - rad) | 0), ye = Math.min(H - 1, (cy + rad) | 0); y <= ye; y++) {
        for (let x = Math.max(0, (cx - rad) | 0), xe = Math.min(W - 1, (cx + rad) | 0); x <= xe; x++) {
          const q = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (rad * rad); if (q >= 1) continue;
          const a = (1 - q) * ha; if (BAYER[((y & 3) << 2) | (x & 3)] >= a * 16 * 2.2) continue;
          const o = y * W + x; if (db && db[o] < z - 0.05) continue;
          mix(fb, o, 150, 255, 214, 0.55);
        }
      }
      if (still) continue;
      // the glint: a short four-point star at a wandering spot on the glass, every few seconds
      const P = 2.4 + sd * 2.6, ph = (T + sd * 17) % P, cyc = Math.floor((T + sd * 17) / P);
      if (ph > 0.6) continue;
      const u = ph / 0.6, k = Math.sin(Math.PI * u), k2 = k * k;
      const r1 = ((Math.sin(cyc * 12.9898 + sd * 78.233) * 43758.5453) % 1 + 1) % 1, r2 = ((Math.sin(cyc * 39.346 + sd * 11.135) * 24634.6345) % 1 + 1) % 1;
      const gx = (cx + (r1 - 0.5) * wpx * 0.7) | 0, gy = (y0 + hpx * (0.15 + 0.6 * r2)) | 0;
      const arm = Math.round((1 + 2.4 * Math.min(1, s.dist / 8)) * k2 * (S > 1 ? 1.5 : 1)) | 0;
      stats.glints++;
      for (let d = -arm; d <= arm; d++) {
        const a = 1 - Math.abs(d) / (arm + 1);
        for (let t = 0; t < 2; t++) {
          const x = t ? gx : gx + d, y = t ? gy + d : gy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const o = y * W + x; if (db && db[o] < z - 0.05) continue;
          mix(fb, o, 235, 255, 245, clamp(a * k2 * 1.1, 0, 1)); mb[o] = 8;
        }
      }
    }
  }
  const warned = { v: false };
  if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook(F => { try { rope(F); glimmer(F); } catch (err) { if (!warned.v) { warned.v = true; console.warn('smalllife render failed', err); } } }, 27);

  return { stats, timing: false, CROWS, RATS, L, SPR, tick, populate, upgradeArt, pxCat, ensure() { syncShip(); if (L.mapId !== G.mapId) populate(); }, theCat, tickCat, shipPose, shipView, isMoored, syncShip, ship, playerPace, glimmer, rope, rngFor, hashStr, crowsAwake, MAST, SHIP,
    get critters() { return L.list; } };
})();
if (typeof window !== 'undefined') window.SMALLLIFE = SMALLLIFE;
