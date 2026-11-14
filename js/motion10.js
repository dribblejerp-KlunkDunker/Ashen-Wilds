// ============================================================
//  motion10 — Phase 10 (the owner's picks): three pieces of motion.
//  1. ANIMATED TRAVEL. After you press "Begin the journey" on the world map, the journey itself is
//     still worked out by travelGo() in js/travel.js, untouched and in the same order (time cost,
//     weather, the ambush roll, the arrival). Only then does this module show what happened: your
//     party (on the mare, if one is hired) walks the route over the painting with a dotted trail,
//     the map darkens or warms as the hours pass and the clock ticks. If an ambush was spawned, the
//     figure halts short of the mark. At most 3 s; click / any key / tap / controller A skips.
//     Reduced motion draws the finished trail at once for a moment. Presentation only: this code
//     never draws from Math.random and never writes to the game state.
//  2. GUARD LANTERNS. Night patrols (the Oakhaven watch, Office outriders, cutter-men, proctors and
//     legionnaires) and dark interiors: a lantern is drawn in the carrier's hand, swinging with the
//     walk, and a moving warm light goes with it (an entity with .lightCol that is handed to the
//     engine's own coloured-light list, so walls and floor take the glow and the dark-interior pass
//     sees it). At most 4 lights, nearest first, culled by distance. A carrier that dies or is
//     stunned drops the lantern, which gutters out. Nothing reads these lights: the game's stealth
//     is not light-based (it reads noise, line of sight and facing), and this module writes no
//     entity field, so detection and AI are exactly as before.
//  3. PARRY SPARKS. A burst of bright sparks and a sharp metallic tick when a guard turns a blow:
//     a melee strike that was resolved against you while your guard was up and did not land.
//     Material sets the look: iron bright white-gold, bronze warm gold with a ringing tail, glass
//     cyan, wood (bare hands, ranged weapons held up) dull chips and a thud. The game's block key
//     (F, documented in the help) and the timers behind it never ran, so this module binds F to the
//     game's own triggerBlock() and ticks UPG.parryWindow / UPG.parryCool down; nothing else reads them.
//  Settings (Options > Graphics & access): Animated travel, Guard lanterns, Parry sparks. Each is a
//  GFX flag in GFX.FX (so the Original preset turns them off) AND a persisted switch of its own.
//  GFX.reduceMotion: travel is a still frame, lanterns hang steady, no parry shake.
//  GFX.noFlash: smaller, dimmer sparks, no white flash, steady lantern light.
//  Procedural stand-in: all pictures are drawn with canvas / framebuffer pixels here.
// ============================================================
'use strict';
/* eslint-disable no-func-assign */

for (const k of ['travelAnim', 'guardLanterns', 'parrySparks']) {
  if (GFX[k] === undefined) GFX[k] = true;
  if (!GFX.FX.includes(k)) GFX.FX.push(k);
}

const MOTION10 = (() => {
  const KEY = 'octave.motion10.v1';
  const set = { travel: true, lanterns: true, parry: true };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // a private random stream: nothing in this module may draw from Math.random (that would shift the game's rolls)
  let rs = 0x9e3779b1;
  const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return ((rs >>> 0) % 1000003) / 1000003; };
  const strHash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; };
  const dayness = (tod) => clamp((Math.cos((tod - 0.5) * TAU) + 0.3) / 1.3, 0, 1);   // the engine's own day curve

  function save() { try { localStorage.setItem(KEY, JSON.stringify({ t: set.travel ? 1 : 0, l: set.lanterns ? 1 : 0, p: set.parry ? 1 : 0 })); } catch (e) { /* no storage: fine */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o || typeof o !== 'object') return;
      set.travel = o.t !== 0; set.lanterns = o.l !== 0; set.parry = o.p !== 0;
    } catch (e) { /* ignore */ }
  }
  const travelOn = () => set.travel && GFX.travelAnim !== false;
  const lanternsOn = () => set.lanterns && GFX.guardLanterns !== false;
  const parryOn = () => set.parry && GFX.parrySparks !== false;

  // ============================================================
  //  1. ANIMATED TRAVEL
  // ============================================================
  const TV = { anim: null, last: null, stats: { runs: 0, skipped: 0, ambush: 0 } };
  const WALK_MIN = 1.0, WALK_MAX = 2.3, END_HOLD = 0.35, AMBUSH_HOLD = 0.55, STATIC_HOLD = 0.6;   // seconds; the sum stays under 3
  const SKIP_GRACE = 150;   // ms before a key or press can skip: the press that began the journey is still in the air

  // a gentle bend in the road, the same for the same journey
  function routeOf(from, to, seed, W, H) {
    const ax = from[0] * W, ay = from[1] * H, bx = to[0] * W, by = to[1] * H;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const bend = (seed < 0.5 ? -1 : 1) * (0.1 + 0.08 * ((seed * 7) % 1)) * len;
    const cx = mx - dy / len * bend, cy = my + dx / len * bend, N = 48, pts = [], cum = [0];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
      pts.push([a * ax + b * cx + c * bx, a * ay + b * cy + c * by]);
      if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    return { pts, cum, len: cum[N] };
  }
  // the point a fraction s of the way along, with its heading
  function along(route, s) {
    const target = clamp(s, 0, 1) * route.len, c = route.cum;
    let i = 1; while (i < c.length - 1 && c[i] < target) i++;
    const seg = c[i] - c[i - 1] || 1, f = clamp((target - c[i - 1]) / seg, 0, 1), p0 = route.pts[i - 1], p1 = route.pts[i];
    return { x: p0[0] + (p1[0] - p0[0]) * f, y: p0[1] + (p1[1] - p0[1]) * f, ang: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), i, f };
  }
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));

  function clockAt(plan, u) {
    const total = plan.clock1 - plan.clock0, c = plan.clock0 + total * u;
    const day = Math.floor(c / 24), h = c - day * 24;
    return Number.isFinite(c) ? { day, tod: h / 24 } : { day: 0, tod: 0.5 };   // a hostile save must not put "NaN" on the page
  }
  function shade(ctx, W, H, tod, su) {
    const dn = dayness(tod), night = clamp((0.62 - dn) / 0.5, 0, 1);
    if (night > 0.01) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(255 - 105 * night)},${Math.round(255 - 95 * night)},${Math.round(255 - 40 * night)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const warm = Math.max(0, 1 - Math.abs(dn - 0.42) / 0.2) * (tod > 0.2 && tod < 0.8 ? 1 : 0);
    if (warm > 0.01) { ctx.fillStyle = `rgba(255,150,70,${(0.2 * warm).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    // the sun and the moon cross a small arch in the corner
    const ax = 46 * su, ay = 50 * su, rr = 32 * su;
    ctx.lineWidth = 2 * su; ctx.strokeStyle = 'rgba(243,217,140,.55)'; ctx.beginPath(); ctx.arc(ax, ay + 2 * su, rr, Math.PI, TAU); ctx.stroke();
    const sunUp = tod > 0.25 && tod < 0.75, ph = sunUp ? (tod - 0.25) / 0.5 : ((tod + 0.25) % 1) / 0.5;
    const a = Math.PI + clamp(ph, 0, 1) * Math.PI, sx = ax + Math.cos(a) * rr, sy = ay + 2 * su + Math.sin(a) * rr;
    ctx.beginPath(); ctx.arc(sx, sy, 7 * su, 0, TAU); ctx.fillStyle = sunUp ? '#ffe39a' : '#cfd8ee'; ctx.fill(); ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 1.5 * su; ctx.stroke();
    if (!sunUp) { ctx.beginPath(); ctx.arc(sx + 3.2 * su, sy - 1.4 * su, 5.8 * su, 0, TAU); ctx.fillStyle = 'rgba(40,48,90,.9)'; ctx.fill(); }   // a bitten disc: the moon
  }
  function drawFigure(ctx, x, y, su, step, ang, o) {
    const dir = Math.cos(ang) < 0 ? -1 : 1, bob = Math.abs(Math.sin(step)) * 2.2 * su * (o.walking ? 1 : 0);
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(dir * o.k, o.k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 2.4 * su;
    const swing = Math.sin(step) * 4.5 * su;
    if (o.mounted) {
      // the roan mare: a barrel, a neck and head, four legs working
      ctx.fillStyle = '#9a6a48';
      ctx.beginPath(); ctx.ellipse(0, -10 * su, 13 * su, 6.5 * su, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10 * su, -14 * su); ctx.lineTo(17 * su, -22 * su); ctx.lineTo(21 * su, -20 * su); ctx.lineTo(15 * su, -9 * su); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8 * su, -5 * su); ctx.lineTo(-8 * su + swing, 3 * su); ctx.moveTo(-4 * su, -5 * su); ctx.lineTo(-4 * su - swing, 3 * su); ctx.moveTo(6 * su, -5 * su); ctx.lineTo(6 * su - swing, 3 * su); ctx.moveTo(10 * su, -5 * su); ctx.lineTo(10 * su + swing, 3 * su); ctx.stroke();
      ctx.translate(-1 * su, -13 * su);
    } else {
      ctx.beginPath(); ctx.moveTo(-2.5 * su, -7 * su); ctx.lineTo(-2.5 * su + swing, 0); ctx.moveTo(2.5 * su, -7 * su); ctx.lineTo(2.5 * su - swing, 0); ctx.stroke();
    }
    // a hooded traveller: cloak, head, a staff
    ctx.fillStyle = o.cloak;
    ctx.beginPath(); ctx.moveTo(0, -22 * su); ctx.lineTo(6.5 * su, -6 * su); ctx.lineTo(-6.5 * su, -6 * su); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -24.5 * su, 3.6 * su, 0, TAU); ctx.fillStyle = '#f3d9a8'; ctx.fill(); ctx.stroke();
    if (!o.mounted) { ctx.beginPath(); ctx.moveTo(7.5 * su, -24 * su); ctx.lineTo(8.5 * su, 0); ctx.stroke(); }
    ctx.restore();
  }

  // Worked out BEFORE anything is drawn: everything the picture needs, from state travelGo already produced.
  function planTravel(d, snap, after, amb) {
    const R = TRAVEL_REGIONS[snap.region], im = TRAVEL.img[R.img];
    const from = snap.here || [d.fx, d.fy], to = [d.fx, d.fy];
    const seed = strHash01(d.name + '|' + snap.day + '|' + snap.region);
    const W = im.naturalWidth, H = im.naturalHeight;
    const num = (v, d) => (Number.isFinite(+v) ? +v : d);
    snap = Object.assign({}, snap, { day: num(snap.day, 0), tod: num(snap.tod, 0.5) }); after = { day: num(after.day, snap.day), tod: num(after.tod, snap.tod) };
    const hours = (after.day * 24 + after.tod * 24) - (snap.day * 24 + snap.tod * 24);
    const plan = {
      dest: d.name, region: snap.region, img: im, W, H, from, to, seed, route: routeOf(from, to, seed, W, H),
      clock0: snap.day * 24 + snap.tod * 24, clock1: snap.day * 24 + snap.tod * 24 + Math.max(0, hours), mins: snap.mins, hours,
      mounted: snap.mounted, pace: snap.pace, companion: snap.companion,
      ambush: !!(amb && amb.count > 0), stopU: 1,
    };
    if (plan.ambush) plan.stopU = 0.78 + 0.16 * ((seed * 13) % 1);   // halts short of the mark; the hours shown still add up
    const dist = plan.route.len / Math.max(1, W);
    plan.walk = clamp(WALK_MIN + snap.mins / 90, WALK_MIN, WALK_MAX) * (dist < 0.02 ? 0.6 : 1);
    plan.hold = plan.ambush ? AMBUSH_HOLD : END_HOLD;
    plan.total = plan.walk + plan.hold;
    return plan;
  }

  function frameAt(plan, t, reduced) {
    // t = seconds since the picture opened. Returns the progress along the route, the clock and the state of the scene.
    const u = reduced ? 1 : clamp(t / plan.walk, 0, 1), prog = ease(u);
    const s = prog * plan.stopU;
    return { u: prog, s, clock: clockAt(plan, prog), walking: !reduced && u < 1, halted: u >= 1 && plan.ambush, done: reduced ? t >= STATIC_HOLD : t >= plan.total };
  }
  function paint(plan, cv, fr, T) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const su = 0.62 * W / Math.max(1, cv.getBoundingClientRect().width || W);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(plan.img, 0, 0, W, H);
    shade(ctx, W, H, fr.clock.tod, su);
    const pin = (p, col, ring) => {
      const px = p[0] * W, py = p[1] * H;
      ctx.beginPath(); ctx.moveTo(px, py - 8 * su); ctx.lineTo(px + 6.5 * su, py); ctx.lineTo(px, py + 8 * su); ctx.lineTo(px - 6.5 * su, py); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 2 * su; ctx.stroke();
      if (ring) { const q = 0.5 + 0.5 * Math.sin(T * 5); ctx.beginPath(); ctx.arc(px, py, (12 + 7 * q) * su, 0, TAU); ctx.strokeStyle = `rgba(255,228,150,${0.85 - 0.5 * q})`; ctx.lineWidth = 2.6 * su; ctx.stroke(); }
    };
    // the mark we are heading for, and where we set out from
    const ds = 9 * su; ctx.fillStyle = '#e6b04a'; ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 3 * su;
    ctx.fillRect(plan.to[0] * W - ds, plan.to[1] * H - ds, ds * 2, ds * 2); ctx.strokeRect(plan.to[0] * W - ds, plan.to[1] * H - ds, ds * 2, ds * 2);
    pin(plan.from, '#9ff4ff', false);
    // the trail: dotted, drawn only as far as the figure has come
    const r = plan.route, upto = along(r, fr.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trail = () => { ctx.beginPath(); ctx.moveTo(r.pts[0][0], r.pts[0][1]); for (let i = 1; i <= upto.i; i++) ctx.lineTo(r.pts[i][0], r.pts[i][1]); ctx.lineTo(upto.x, upto.y); };
    ctx.setLineDash([]); trail(); ctx.strokeStyle = 'rgba(20,10,4,.55)'; ctx.lineWidth = 6.4 * su; ctx.setLineDash([0.1, 9 * su]); ctx.stroke();
    trail(); ctx.strokeStyle = '#fff1c4'; ctx.lineWidth = 3.8 * su; ctx.setLineDash([0.1, 9 * su]); ctx.stroke(); ctx.setLineDash([]);
    // the party: a companion a few steps behind, the figure itself on top
    const step = (fr.walking ? T * 11 : 0);
    if (plan.companion) { const back = along(r, Math.max(0, fr.s - 22 * su / Math.max(40, r.len))); drawFigure(ctx, back.x, back.y, su, step + 1.7, upto.ang, { k: 1.2, cloak: '#8fc8cf', walking: fr.walking, mounted: false }); }
    drawFigure(ctx, upto.x, upto.y, su, step, upto.ang, { k: 1.5, cloak: '#b0442f', walking: fr.walking, mounted: plan.mounted });
    if (fr.halted) {
      // something has picked up the trail: a red ring and a mark over the halted figure
      const q = 0.5 + 0.5 * Math.sin(T * 14), cx = upto.x, cy = upto.y - 58 * su;
      ctx.beginPath(); ctx.arc(upto.x, upto.y - 20 * su, (25 + 8 * q) * su, 0, TAU); ctx.strokeStyle = `rgba(224,90,60,${0.9 - 0.4 * q})`; ctx.lineWidth = 3 * su; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 8 * su, 0, TAU); ctx.fillStyle = '#d2442c'; ctx.fill(); ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 2 * su; ctx.stroke();
      ctx.fillStyle = '#fff4d8'; ctx.fillRect(cx - 1.2 * su, cy - 4.8 * su, 2.4 * su, 5.6 * su); ctx.fillRect(cx - 1.2 * su, cy + 2.4 * su, 2.4 * su, 2.2 * su);
    }
  }

  // The journey as the game worked it out, then the picture of it.
  function travelGoAnimated(d) {
    if (!travelOn() || G.state !== 'panel' || G.openPanel !== 'travel' || TV.anim) return travelGo(d);
    if (travelBlocked()) return travelGo(d);   // refuses and shows why, as before
    const R = TRAVEL_REGIONS[TRAVEL.region], im = R && TRAVEL.img[R.img];
    if (!im || !im.complete || !im.naturalWidth) return travelGo(d);
    const snap = {
      region: TRAVEL.region, here: TRAVEL.here ? TRAVEL.here.slice() : null, day: G.day, tod: G.tod, mins: travelMinutes(d), pace: TRAVEL.pace,
      mounted: horseActive(), companion: !!(G.party && G.party.id),
    };
    // Run the real thing. Its messages and its ambush sound are held back and replayed when the picture ends,
    // so what you read matches what you have just seen. Nothing else about the call is changed.
    const held = [], realMsg = msg, realPress = Audio_.sfx.press, realAmbush = travelAmbush;
    let amb = null;
    msg = function () { held.push(['msg', arguments]); };
    if (realPress) Audio_.sfx.press = function () { held.push(['press', arguments]); };
    travelAmbush = function () { const n0 = G.ents.length, r = realAmbush.apply(this, arguments); amb = { count: G.ents.length - n0 }; return r; };
    try { travelGo(d); } finally { msg = realMsg; if (realPress) Audio_.sfx.press = realPress; travelAmbush = realAmbush; }
    const replay = () => {
      for (const [what, args] of held) { try { if (what === 'msg') realMsg.apply(null, args); else if (realPress) realPress.apply(Audio_.sfx, args); } catch (e) { /* a late message must never throw */ } }
      held.length = 0;
    };
    // a story event or a panel opened by the arrival has the player's attention already
    if (G.state !== 'play' || G.openPanel || G.dead) { replay(); return; }
    let plan; try { plan = planTravel(d, snap, { day: G.day, tod: G.tod }, amb); } catch (e) { console.warn('motion10 travel plan failed', e); replay(); return; }
    startPicture(plan, replay);
  }

  function startPicture(plan, onDone) {
    const reduced = !!GFX.reduceMotion;
    openModal('<h2 id="tva-title"></h2><button class="dfbtn small close" id="tva-skip" type="button">Skip</button>' +
      '<div class="tv-body"><canvas id="tvmap" width="' + plan.W + '" height="' + plan.H + '" aria-hidden="true"></canvas>' +
      '<div class="tv-side"><div class="tv-info tva-clock" role="status" style="font-size:3cqw"><b id="tva-day"></b> · <span id="tva-time"></span></div>' +
      '<div class="tv-info" id="tva-note"></div><p class="muted" id="tva-hint">Click, press any key or A to skip.</p></div></div>', 'travelanim');
    $('#modal-panel').classList.add('travel');
    G.state = 'panel';
    $('#tva-title').textContent = plan.dest;
    const cv = $('#tvmap'), dayEl = $('#tva-day'), timeEl = $('#tva-time'), noteEl = $('#tva-note'), modal = $('#modal');
    const A = { plan, t0: performance.now(), raf: 0, timer: 0, done: false, skipped: false, shown: '', note: '', padPrev: null, onDone };
    TV.anim = A;
    const pads = () => { try { return navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { return null; } };
    const padDown = () => { const l = pads(); if (l) for (let i = 0; i < l.length; i++) { const p = l[i]; if (p && p.connected && p.buttons && p.buttons[0] && p.buttons[0].pressed) return true; } return false; };
    A.padPrev = padDown();
    const finish = (skipped) => {
      if (A.done) return; A.done = true; A.skipped = !!skipped;
      cancelAnimationFrame(A.raf); clearTimeout(A.timer);
      window.removeEventListener('keydown', onKey, true); modal.removeEventListener('pointerdown', onPress, true); modal.removeEventListener('click', onPress, true);
      TV.anim = null;
      TV.last = { dest: plan.dest, mins: plan.mins, hours: plan.hours, ambush: plan.ambush, stopU: plan.stopU, walk: plan.walk, total: plan.total, skipped: !!skipped, reduced, ms: performance.now() - A.t0 };
      TV.stats.runs++; if (skipped) TV.stats.skipped++; if (plan.ambush) TV.stats.ambush++;
      if (G.openPanel === 'travelanim') { $('#modal-panel').classList.remove('travel'); closeModal(); G.state = 'play'; G.keys = {}; }
      onDone();
    };
    A.finish = finish;
    const skip = () => { if (performance.now() - A.t0 >= SKIP_GRACE) finish(true); };
    const onKey = (ev) => {
      if (ev.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
      ev.preventDefault(); ev.stopImmediatePropagation(); skip();
    };
    const onPress = (ev) => { ev.preventDefault(); ev.stopPropagation(); skip(); };
    window.addEventListener('keydown', onKey, true); modal.addEventListener('pointerdown', onPress, true); modal.addEventListener('click', onPress, true);
    A.pad = () => { const down = padDown(); if (down && !A.padPrev) skip(); A.padPrev = down; };
    const step = () => {
      if (A.done) return;
      if (G.openPanel !== 'travelanim' || G.state !== 'panel') { finish(false); return; }   // something else closed it
      const t = (performance.now() - A.t0) / 1000, fr = frameAt(plan, t, reduced);
      try {
        paint(plan, cv, fr, t);
        const day = DAYS[((fr.clock.day % DAYS.length) + DAYS.length) % DAYS.length] || '', hh = Math.floor(fr.clock.tod * 24), mm = Math.floor((fr.clock.tod * 24 - hh) * 60), tm = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        if (A.shown !== day + tm) { A.shown = day + tm; dayEl.textContent = day; timeEl.textContent = tm; }
        const note = fr.halted ? 'Something has picked up the trail.' : fr.walking ? (plan.mounted ? 'Riding.' : plan.pace === 'cautious' ? 'Walking, keeping to cover.' : 'Walking fast.') : 'Arrived.';
        if (note !== A.note) { A.note = note; noteEl.textContent = note; }
      } catch (e) { console.warn('motion10 travel paint failed', e); finish(false); return; }
      A.pad();
      if (fr.done) { finish(false); return; }
      A.raf = requestAnimationFrame(step);
    };
    step();
    // if animation frames are not delivered (a hidden tab, a test), the picture still ends on time
    if (!A.done) A.timer = setTimeout(() => finish(false), (reduced ? STATIC_HOLD : plan.total) * 1000 + 250);
  }
  // A controller's A also skips, through the same poll the game uses for everything else.
  if (typeof controlsTick === 'function') {
    const _ct = controlsTick;
    controlsTick = function () { try { if (TV.anim) TV.anim.pad(); } catch (e) { /* cosmetic */ } return _ct.apply(this, arguments); };
  }

  // ============================================================
  //  2. GUARD LANTERNS
  // ============================================================
  const MAX_LIGHTS = 4, CULL = 15, GUTTER = 1.8, RELIGHT_DELAY = 0.8, DROP_LIFE = 45;
  const CARRIER_TYPES = new Set(['outrider', 'captain', 'marine', 'proctor', 'legionnaire']);
  const LAN = { recs: new WeakMap(), cands: [], candSrc: null, candLen: -1, candMap: null, drops: [], proxies: [], out: [], buf: [], lit: [], t: 0, last: 0, stats: { frames: 0, maxActive: 0, active: 0, drops: 0, ms: 0 } };

  function isCarrier(e) {
    if (!e || e.companion) return false;
    if (e.kind === 'npc') return !!(e.lawGuard || e.nightWatch);
    return e.kind === 'enemy' && CARRIER_TYPES.has(e.type);
  }
  // how dark it is where the carrier walks: 0 (day, lit rooms) to 1 (night, dark rooms)
  function darkness() {
    const m = typeof G !== 'undefined' && G.map; if (!m) return 0;
    if (m.outdoor) return clamp((0.5 - dayness(G.tod == null ? 0.5 : G.tod)) / 0.3, 0, 1);
    return GFX.darkInteriors && (m.ambient == null ? 1 : m.ambient) <= 0.22 ? 1 : 0;
  }
  function recOf(e) {
    let r = LAN.recs.get(e);
    if (!r) { r = { state: 'off', px: e.x, py: e.y, speed: 0, heading: Number.isFinite(e.facing) ? e.facing : 0, phase: strHash01(String(e.id || e.type) + (e.x * 7 | 0)) * TAU, seed: rnd(), downAt: 0, drop: null }; LAN.recs.set(e, r); }
    return r;
  }
  function refreshCands(ents) {
    const mapId = typeof G !== 'undefined' ? G.mapId : null;
    if (LAN.candSrc === ents && LAN.candLen === ents.length && LAN.candMap === mapId) return;
    LAN.candSrc = ents; LAN.candLen = ents.length; LAN.candMap = mapId;
    LAN.cands.length = 0;
    for (let i = 0; i < ents.length; i++) if (isCarrier(ents[i])) LAN.cands.push(ents[i]);
    // a new map: lanterns left on the floor of the old one are gone
    if (LAN.mapId !== mapId) { LAN.mapId = mapId; LAN.drops.length = 0; }
  }
  function handOf(e, r, T, still) {
    // the hand: to the carrier's right, and the lantern hangs a little behind its swing
    const h = r.heading, fx = Math.cos(h), fy = Math.sin(h), rx = -fy, ry = fx, reduced = !!GFX.reduceMotion;
    const moveK = reduced ? 0 : clamp(r.speed / 1.1, 0, 1);
    const sw = Math.sin(r.phase) * 0.26 * moveK, lag = -Math.cos(r.phase) * 0.09 * moveK;
    const idle = reduced ? 0 : (1 - moveK) * Math.sin(T * 1.7 + r.seed * 9) * 0.04;
    const side = 0.2 * (e.scale || 1);
    const hx = e.x + rx * side + fx * (sw + idle), hy = e.y + ry * side + fy * (sw + idle);
    return { hx, hy, lx: hx + fx * lag, ly: hy + fy * lag, sw, fx, fy, moveK };
  }
  // the entities for this frame: pass them on to the engine along with the real ones
  function lanternFrame(ents, dt) {
    const t0 = performance.now();
    LAN.out.length = 0; LAN.lit.length = 0;
    if (!ents || !G.map || !lanternsOn()) { LAN.stats.active = 0; if (LAN.drops.length) LAN.drops.length = 0; return LAN.out; }
    refreshCands(ents);
    const k = darkness(), cam = Engine.cam, T = (LAN.t += dt);
    // carriers: step each one's walk, notice death and stunning
    for (let i = 0; i < LAN.cands.length; i++) {
      const e = LAN.cands[i], r = recOf(e);
      const dx = e.x - cam.x, dy = e.y - cam.y, d2 = dx * dx + dy * dy;
      if (e.dead && (r.state === 'lit' || r.state === 'down')) {
        if (r.state === 'lit' && d2 < CULL * CULL) dropLantern(e, r, true, T);
        r.state = 'dead'; continue;
      }
      if (e.dead || e.hidden) { if (r.state !== 'dead') r.state = 'off'; r.px = e.x; r.py = e.y; continue; }
      const stunned = e.stun > 0;
      if (k < 0.05) { r.state = 'off'; if (r.drop) { r.drop = null; } r.px = e.x; r.py = e.y; continue; }
      if (d2 > CULL * CULL) { r.px = e.x; r.py = e.y; if (r.state === 'lit') r.state = 'off'; continue; }
      // velocity from where it stood a frame ago, smoothed; a jump (a new map, a teleport) counts as standing still
      const mv = Math.hypot(e.x - r.px, e.y - r.py), v = dt > 0 && mv < 1 ? mv / dt : 0;
      r.speed += (clamp(v, 0, 3) - r.speed) * Math.min(1, dt * 8);
      if (r.speed > 0.25 && mv > 1e-4) { const want = Math.atan2(e.y - r.py, e.x - r.px); let da = want - r.heading; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; r.heading += da * Math.min(1, dt * 7); }
      else if (Number.isFinite(e.facing)) { let da = e.facing - r.heading; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; r.heading += da * Math.min(1, dt * 3); }
      r.phase += r.speed * dt * 4.6; r.px = e.x; r.py = e.y;
      if (stunned) {
        if (r.state === 'lit') dropLantern(e, r, false, T);
        else if (r.state === 'off') { r.state = 'down'; r.drop = null; }
        r.downAt = T; continue;
      }
      if (r.state === 'down') { if (T - r.downAt >= RELIGHT_DELAY) { r.state = 'lit'; r.drop = null; r.flare = T; } else continue; }
      if (r.state === 'off') { r.state = 'lit'; r.flare = T; }
      if (r.state === 'lit') LAN.lit.push({ e, r, d2 });
    }
    // dropped lanterns still glowing count towards the same cap
    const pool = LAN.buf; pool.length = 0;
    for (let i = 0; i < LAN.lit.length; i++) pool.push({ kind: 'hand', d2: LAN.lit[i].d2, c: LAN.lit[i] });
    for (let i = LAN.drops.length - 1; i >= 0; i--) {
      const dr = LAN.drops[i]; dr.age += dt;
      if (dr.age > DROP_LIFE || (dr.rec && dr.rec.state === 'lit')) { LAN.drops.splice(i, 1); continue; }
      const dx = dr.x - cam.x, dy = dr.y - cam.y, d2 = dx * dx + dy * dy;
      if (dr.age < GUTTER && d2 < CULL * CULL) pool.push({ kind: 'drop', d2, c: dr });
    }
    pool.sort((a, b) => a.d2 - b.d2);
    const n = Math.min(MAX_LIGHTS, pool.length);
    for (let i = 0; i < n; i++) {
      const it = pool[i];
      const px = LAN.proxies[i] || (LAN.proxies[i] = { kind: 'light10', x: 0, y: 0, hidden: false, dead: false, solid: false, lightCol: [0, 0, 0], _m10: true });
      let g, x, y;
      if (it.kind === 'hand') {
        const { e, r } = it.c, h = handOf(e, r, T), fl = GFX.noFlash ? 0.04 : 0.1, born = clamp((T - (r.flare || 0)) / 0.5, 0, 1);
        g = (0.9 + fl * Math.sin(T * 9 + r.seed * 20) + 0.5 * fl * Math.sin(T * 23.7 + r.seed * 5)) * k * (0.6 + 0.4 * born);
        x = h.lx; y = h.ly;
        it.c.hand = h; it.c.g = g;
      } else { const dr = it.c; g = gutterK(dr.age) * 0.9; x = dr.x; y = dr.y; }
      px.x = x; px.y = y;
      // the lamp's own warm colour; open air swallows light, so out of doors the lantern burns a little brighter
      const open = G.map.outdoor ? 1.25 : 1;
      px.lightCol[0] = 62 * g * open; px.lightCol[1] = 38 * g * open; px.lightCol[2] = 12 * g * open;
      LAN.out.push(px);
    }
    LAN.stats.active = n; LAN.stats.maxActive = Math.max(LAN.stats.maxActive, n); LAN.stats.frames++;
    LAN.stats.ms += performance.now() - t0;
    return LAN.out;
  }
  const gutterK = (age) => { const f = clamp(1 - age / GUTTER, 0, 1); return f * f * clamp(0.55 + 0.45 * Math.sin(age * 31) + 0.2 * Math.sin(age * 57), 0.05, 1); };
  function dropLantern(e, r, dead, T) {
    const h = handOf(e, r, T), dr = { x: h.lx, y: h.ly, age: 0, rec: dead ? null : r, tilt: (rnd() - 0.5) * 1.2 + 1.2, seed: rnd() };
    LAN.drops.push(dr); r.drop = dr; r.state = dead ? 'dead' : 'down'; r.downAt = T; LAN.stats.drops++;
    // a short thud of tin on the floor, only where one can be heard
    return dr;
  }

  // ---- projection and the pixels of a lantern ----------------------------------
  const PR = { x: 0, y: 0, d: 0, u: 0 };
  function proj(F, wx, wy, wz) {
    const cam = F.cam, inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY), dx = wx - cam.x, dy = wy - cam.y;
    const trX = inv * (F.dirY * dx - F.dirX * dy), trY = inv * (-F.planeY * dx + F.planeX * dy);
    if (trY <= 0.15) return null;
    const m = F.map, floor = m && m.groundAt && (m.lvls || m.smooth) ? m.groundAt(wx, wy) : 0;
    PR.x = (F.w / 2) * (1 + trX / trY); PR.y = F.horizon + (cam.z - floor - wz) * F.h / trY; PR.d = trY; PR.u = F.h / trY;
    return PR;
  }
  function plot(F, x, y, d, r, g, b, a, glow) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
    const o = y * F.w + x, db = F.dbuf; if (db && db[o] < d - 0.3) return;   // something nearer than the lantern hides it
    const px = F.fb[o], pr = px & 255, pg = (px >> 8) & 255, pb = (px >> 16) & 255;
    F.fb[o] = (255 << 24) | ((((pb + (b - pb) * a) | 0) & 255) << 16) | ((((pg + (g - pg) * a) | 0) & 255) << 8) | (((pr + (r - pr) * a) | 0) & 255);
    if (glow && F.mbuf) { F.mbuf[o] = 8; if (db) db[o] = Math.min(db[o], d - 0.02); }
  }
  function add(F, x, y, d, r, g, b) {   // additive: the halo of a flame
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
    const o = y * F.w + x, db = F.dbuf; if (db && db[o] < d - 0.3) return;
    const px = F.fb[o], pr = Math.min(255, (px & 255) + r), pg = Math.min(255, ((px >> 8) & 255) + g), pb = Math.min(255, ((px >> 16) & 255) + b);
    F.fb[o] = (255 << 24) | (pb << 16) | (pg << 8) | pr;
  }
  function drawLanternBody(F, cx, cy, u, d, strength, hang) {
    // a small cage lantern: cap, frame, a glass pane lit from inside. Scales with distance; at a distance it is a warm dot.
    const S = F.S || 1, bw = Math.max(2, Math.round(0.085 * u)), bh = Math.max(2, Math.round(0.12 * u));
    const x0 = Math.round(cx - bw / 2 + hang), y0 = Math.round(cy);
    const s = clamp(strength, 0, 1.3);
    // halo first so the body sits on top of it
    const hr = Math.max(2, Math.round(0.13 * u * (0.7 + 0.3 * s))), hr2 = hr * hr;
    for (let j = -hr; j <= hr; j++) for (let i = -hr; i <= hr; i++) {
      const q = i * i + j * j; if (q > hr2) continue;
      const f = (1 - q / hr2), a = f * f * f * 0.32 * s;
      if (a > 0.015) add(F, x0 + bw / 2 + i, y0 + bh / 2 + j, d, 120 * a, 70 * a, 18 * a);
    }
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const edge = i === 0 || i === bw - 1 || j === 0 || j === bh - 1;
      if (bw >= 4 && bh >= 4 && edge) plot(F, x0 + i, y0 + j, d, 46 * (0.6 + 0.4 * s), 34 * (0.6 + 0.4 * s), 20, 1, false);
      else {
        const core = 1 - (Math.abs(i - (bw - 1) / 2) / Math.max(1, bw / 2)) * 0.5 - (j / bh) * 0.25;
        plot(F, x0 + i, y0 + j, d, 255 * Math.min(1, 0.55 + 0.5 * s * core), 205 * Math.min(1, 0.4 + 0.45 * s * core), 100 * Math.min(1, 0.2 + 0.4 * s), 1, true);
      }
    }
  }
  function lanternDraw(F) {
    if (!lanternsOn() || !(LAN.lit.length || LAN.drops.length)) return;
    const cam = F.cam;
    for (let i = 0; i < LAN.lit.length; i++) {
      const c = LAN.lit[i], h = c.hand; if (!h || c.g == null) continue;
      const e = c.e, hs = (Engine.sprites[e.sprite] && Engine.sprites[e.sprite].hs) || 1, hz = 0.4 * (e.scale || 1) * hs, dx = h.hx - cam.x, dy = h.hy - cam.y;
      if (dx * dx + dy * dy > 15 * 15) continue;
      const pH = proj(F, h.hx, h.hy, hz); if (!pH) continue;
      const hxp = pH.x, hyp = pH.y, dd = pH.d, uu = pH.u;
      const pL = proj(F, h.lx, h.ly, hz - 0.11 * (e.scale || 1)); if (!pL) continue;
      const lx = pL.x, ly = pL.y;
      // the handle: a short line from the hand to the lantern's ring
      const steps = Math.max(2, Math.round(Math.hypot(lx - hxp, ly - hyp)));
      for (let s = 0; s <= steps; s++) plot(F, hxp + (lx - hxp) * s / steps, hyp + (ly - hyp) * s / steps, dd, 40, 30, 22, 0.9, false);
      drawLanternBody(F, lx, ly, pL.u * (e.scale || 1), pL.d, c.g, 0);
    }
    for (let i = 0; i < LAN.drops.length; i++) {
      const dr = LAN.drops[i]; if (dr.age > DROP_LIFE) continue;
      const dx = dr.x - cam.x, dy = dr.y - cam.y; if (dx * dx + dy * dy > 15 * 15) continue;
      const p = proj(F, dr.x, dr.y, 0.04); if (!p) continue;
      const g = dr.age < GUTTER ? gutterK(dr.age) : dr.age < GUTTER + 2.5 ? 0.12 * (1 - (dr.age - GUTTER) / 2.5) : 0;   // a last red ember
      drawLanternBody(F, p.x, p.y - 0.06 * p.u, p.u * 0.8, p.d, g, (dr.tilt > 1.2 ? 1 : -1));
    }
  }

  // ============================================================
  //  3. PARRY SPARKS
  // ============================================================
  const SPK = { list: [], flash: [], max: 120, stats: { fired: 0, parry: 0, block: 0, normalHitsSeen: 0, sounds: 0, lastSound: null, lastShake: 0 }, hurt: 0 };
  const MATS = {
    iron:   { n: 24, v: [55, 150], life: [0.2, 0.46], col: [[255, 252, 232], [255, 214, 112], [255, 140, 50]], tick: [2870, 4310], ring: 0.07, vol: 0.2, noise: 5200 },
    bronze: { n: 19, v: [48, 125], life: [0.22, 0.5], col: [[255, 236, 160], [240, 184, 70], [200, 120, 40]], tick: [1180, 1790, 3250], ring: 0.28, vol: 0.2, noise: 3600 },
    glass:  { n: 17, v: [52, 130], life: [0.2, 0.45], col: [[224, 255, 255], [120, 235, 255], [60, 170, 230]], tick: [3520, 5280], ring: 0.16, vol: 0.17, noise: 7200 },
    wood:   { n: 8, v: [30, 72], life: [0.18, 0.36], col: [[222, 190, 140], [176, 136, 88], [120, 86, 54]], tick: [330, 190], ring: 0.05, vol: 0.2, noise: 900, dull: true },
  };
  function materialOf() {
    let w = null; try { w = currentWeapon(); } catch (e) { w = null; }
    if (!w) return 'wood';
    if (w === WEAPONS.hands || w.ranged || w.type === 'shot' || w.type === 'bolt') return 'wood';   // fists and a held-up crossbow stock
    return MATS[w.type] ? w.type : 'iron';
  }
  // the burst itself; the world point is where the blades meet: a little way out along the line to the foe
  function fireParry(info) {
    if (!parryOn() || !G.map) return null;
    const cam = Engine.cam, ex = info.x == null ? cam.x + Math.cos(cam.dir) : info.x, ey = info.y == null ? cam.y + Math.sin(cam.dir) : info.y;
    const dx = ex - cam.x, dy = ey - cam.y, dist = Math.hypot(dx, dy) || 1, reach = Math.min(0.9, dist * 0.6);
    const kind = info.kind === 'block' ? 'block' : 'parry', matName = MATS[info.mat] ? info.mat : materialOf(), M = MATS[matName];
    const dim = GFX.noFlash ? 0.72 : 1, cnt = GFX.noFlash ? 0.6 : 1, pk = GFX.particles == null ? 1 : GFX.particles, q = (kind === 'parry' ? 1 : 0.7);
    const n = Math.max(3, Math.round(M.n * q * cnt * clamp(pk, 0.35, 1.5)));
    const burst = { x: cam.x + dx / dist * reach, y: cam.y + dy / dist * reach, z: cam.z - 0.1, age: 0, mat: matName, kind, dim, parts: [], star: !GFX.noFlash };
    for (let i = 0; i < n && SPK.list.length + burst.parts.length < SPK.max; i++) {
      const a = rnd() * TAU, v = M.v[0] + (M.v[1] - M.v[0]) * rnd();
      burst.parts.push({ vx: Math.cos(a) * v * 1.15, vy: Math.sin(a) * v * 0.8 - 14 * rnd(), life: M.life[0] + (M.life[1] - M.life[0]) * rnd() * (kind === 'parry' ? 1 : 0.8) });
    }
    SPK.list.push(burst); if (SPK.list.length > 6) SPK.list.shift();
    SPK.stats.fired++; SPK.stats[kind]++;
    parryTick(info, matName, kind);
    // a small knock to the view, never under reduced motion
    if (!GFX.reduceMotion && typeof FEEL !== 'undefined' && FEEL.state) { const s = (kind === 'parry' ? 0.24 : 0.14) * dim; FEEL.state.shake = Math.max(FEEL.state.shake, s); SPK.stats.lastShake = s; }
    else SPK.stats.lastShake = 0;
    return burst;
  }
  function sparksDraw(F, dt) {
    for (let bi = SPK.list.length - 1; bi >= 0; bi--) {
      const b = SPK.list[bi]; b.age += dt;
      let alive = 0;
      const p = proj(F, b.x, b.y, b.z); if (!p) { if (b.age > 0.6) SPK.list.splice(bi, 1); continue; }
      const S = F.S || 1, M = MATS[b.mat], ox = p.x, oy = p.y, d = p.d * 0.9;
      // the strike: a brief cross of light where the blades meet (not under No flashes)
      if (b.star && b.age < 0.09) { const L = (6 + 7 * (1 - b.age / 0.09)) * S; for (let k = -L; k <= L; k++) { const f = 1 - Math.abs(k) / L; plot(F, ox + k, oy, d, 255, 250, 235, 0.9 * f, false); plot(F, ox, oy + k * 0.7, d, 255, 250, 235, 0.8 * f, false); } }
      if (b.kind === 'parry' && b.mat === 'glass' && b.age < 0.3) { const rr = (3 + b.age * 40) * S; for (let a = 0; a < 20; a++) plot(F, ox + Math.cos(a / 20 * TAU) * rr, oy + Math.sin(a / 20 * TAU) * rr * 0.8, d, 150, 235, 255, 0.5 * (1 - b.age / 0.3) * b.dim, false); }
      for (const s of b.parts) {
        const t = b.age; if (t >= s.life) continue; alive++;
        const g = 150, x = ox + s.vx * t * S, y = oy + (s.vy * t + 0.5 * g * t * t) * S, t2 = Math.max(0, t - 0.05), x2 = ox + s.vx * t2 * S, y2 = oy + (s.vy * t2 + 0.5 * g * t2 * t2) * S;
        const f = t / s.life, col = f < 0.35 ? M.col[0] : f < 0.7 ? M.col[1] : M.col[2], a = (1 - f * f) * b.dim * (M.dull ? 0.8 : 1);
        const L = Math.max(1, Math.round(Math.hypot(x - x2, y - y2)));
        for (let k = 0; k <= L; k++) {
          const px = x2 + (x - x2) * k / L, py = y2 + (y - y2) * k / L;
          plot(F, px, py, d, M.dull ? col[0] : Math.min(255, col[0] * (GFX.noFlash ? 0.8 : 1)), col[1], col[2], clamp(a * (0.4 + 0.6 * k / L), 0, 1), false);
          if (!M.dull && !GFX.noFlash && f < 0.4 && k === L) add(F, px + 1, py, d, 70 * a, 50 * a, 20 * a);   // a hot head on each spark
        }
      }
      if (!alive && b.age > 0.1) SPK.list.splice(bi, 1);
    }
  }
  // the sound: a sharp tick of metal (or a dull knock for wood), panned to the foe and quieter with distance
  function parryTick(info, matName, kind) {
    const ctx = Audio_.ctx, bus = Audio_.sfxBus;
    SPK.stats.lastSound = { mat: matName, kind, played: false };
    if (!ctx || !bus || Audio_.muted) return;
    try {
      const M = MATS[matName], cam = Engine.cam, dx = (info.x == null ? cam.x : info.x) - cam.x, dy = (info.y == null ? cam.y : info.y) - cam.y, dist = Math.hypot(dx, dy);
      const pan = clamp(Math.sin(Math.atan2(dy, dx) - cam.dir) * 0.75, -0.75, 0.75) * (dist > 0.3 ? 1 : 0);
      const out = ctx.createGain(), v = M.vol * (kind === 'parry' ? 1 : 0.7) * clamp(1.15 - dist * 0.12, 0.45, 1) * (GFX.noFlash ? 1 : 1);
      out.gain.value = 1;
      let tail = out;
      if (ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.value = pan; out.connect(sp); tail = sp; }
      tail.connect(bus);
      const t = ctx.currentTime;
      // the strike: a very short burst of band-passed noise
      const len = Math.max(64, Math.floor(ctx.sampleRate * 0.03)), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (rnd() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = M.dull ? 'lowpass' : 'highpass'; bp.frequency.value = M.noise;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(v * 1.1, t); ng.gain.exponentialRampToValueAtTime(0.0008, t + 0.03);
      src.connect(bp); bp.connect(ng); ng.connect(out); src.start(t);
      // the ring: inharmonic partials that die quickly (a tick), longer for bronze (a bell)
      M.tick.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * (1 + 0.012 * (rnd() - 0.5)), t);
        const g = ctx.createGain(), dur = (M.dull ? 0.07 : 0.05 + M.ring) * (1 - i * 0.18);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v / (1 + i * 0.7), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
      });
      SPK.stats.sounds++; SPK.stats.lastSound.played = true; SPK.stats.lastSound.pan = pan;
    } catch (e) { /* sound must never break a fight */ }
  }

  // ---- finding the moment: a melee strike resolved against a raised guard that did not land ----
  const guardUp = () => !!(UPG && UPG.blocking && UPG.parryCool > 0);
  function wireParry() {
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function () { SPK.hurt++; return _dp.apply(this, arguments); };
    }
    if (typeof enemyUpdate === 'function') {
      const _eu = enemyUpdate;
      enemyUpdate = function (e, dt) {
        let pre = null;
        if (e && e.kind === 'enemy' && e.state === 'chase' && !e.dead && !e.hidden && !(e.stun > 0) && parryOn() && guardUp() && G.state === 'play') pre = { cool: e.cool, hurt: SPK.hurt, win: UPG.parryWindow > 0 };
        const r = _eu.apply(this, arguments);
        if (pre) {
          try {
            // the foe's swing came up this tick (its cooldown was reset), it was close enough to be a blow, and nothing landed
            if (pre.cool - dt <= 0 && e.cool > 0.4 && SPK.hurt === pre.hurt && !G.dead && e.def && !e.def.crossbow && Math.hypot(e.x - Engine.cam.x, e.y - Engine.cam.y) <= (e.def.reach || 1.2) + 0.6) {
              fireParry({ x: e.x, y: e.y, kind: pre.win ? 'parry' : 'block' });
            }
          } catch (err) { console.warn('motion10 parry check failed', err); }
        } else if (e && e.kind === 'enemy') { /* plain hits and everything else: no sparks */ }
        return r;
      };
    }
    if (typeof update === 'function') {
      const _up = update;
      update = function (dt) {
        if (typeof GUARD === 'undefined' && parryOn() && G.state === 'play') {   // js/guard.js ticks them when present
          // the game's block timers are set when you press block but nothing ever counts them down; do it, so the guard can come up again
          if (UPG.parryWindow > 0) UPG.parryWindow = Math.max(0, UPG.parryWindow - dt);
          if (UPG.parryCool > 0) { UPG.parryCool = Math.max(0, UPG.parryCool - dt); if (UPG.parryCool === 0) UPG.blocking = false; }
        }
        return _up.apply(this, arguments);
      };
    }
    // the documented block key (Options shows "Block/Parry: F"), which the game had no handler for
    window.addEventListener('keydown', (ev) => {
      try {
        if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || !parryOn()) return;
        if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
        if (G.state !== 'play' || G.openPanel || G.dead || UPG.rebinding) return;
        const key = (UPG.keybinds && UPG.keybinds.block || 'f').toLowerCase();
        if (ev.key.toLowerCase() === key && typeof triggerBlock === 'function') triggerBlock();
      } catch (err) { /* a key press must never throw */ }
    });
  }

  // ============================================================
  //  the engine hooks, shared by lanterns and sparks
  // ============================================================
  // the pictures run on the game's own clock (G.time), so two renders of the same moment are identical frames;
  // fixedDt lets tests step them by hand
  let lastNow = 0, fixedDt = null;
  function wireEngine() {
    const _render = Engine.render;
    Engine.render = function (ents, tod, opts) {
      let list = ents;
      try {
        const gt = Number.isFinite(G.time) ? G.time : 0, dt = fixedDt != null ? fixedDt : clamp(gt - lastNow, 0, 0.05); lastNow = gt; SPK.dt = dt;
        const extra = lanternFrame(ents, dt);
        if (extra.length) { const b = LAN.buf2 || (LAN.buf2 = []); b.length = 0; for (let i = 0; i < ents.length; i++) b.push(ents[i]); for (let i = 0; i < extra.length; i++) b.push(extra[i]); list = b; }
      } catch (err) { list = ents; if (!LAN.warned) { LAN.warned = true; console.warn('motion10 lantern frame failed', err); } }
      return _render.call(this, list, tod, opts);
    };
    // after the darkening pass (-5), so the lantern and the sparks are never dimmed; before fog, bloom and grade
    Engine.addPostHook((F) => { try { lanternDraw(F); } catch (err) { if (!LAN.warnedD) { LAN.warnedD = true; console.warn('motion10 lantern draw failed', err); } } }, -4);
    // the sparks last of all, over the grade, so they stay bright
    Engine.addPostHook((F) => { try { if (SPK.list.length) sparksDraw(F, SPK.dt || 0.016); } catch (err) { if (!SPK.warned) { SPK.warned = true; console.warn('motion10 sparks failed', err); } } }, 45);
  }

  // ============================================================
  //  Options rows
  // ============================================================
  const ROWS = [
    ['m10-travel', 'Animated travel', 'a figure walks the route across the map as the hours pass', 'travel'],
    ['m10-lanterns', 'Guard lanterns', 'night patrols carry swinging lights', 'lanterns'],
    ['m10-parry', 'Parry sparks', 'sparks and a metal tick when a guard turns a blow', 'parry'],
  ];
  function syncBtn(b, key) { b.textContent = set[key] ? 'On' : 'Off'; b.setAttribute('aria-pressed', set[key] ? 'true' : 'false'); b.classList.toggle('sel', !!set[key]); }
  function setSwitch(key, v) {
    set[key] = !!v; save();
    if (key === 'lanterns' && !set.lanterns) { LAN.drops.length = 0; LAN.out.length = 0; LAN.stats.active = 0; }
    if (key === 'parry' && !set.parry) SPK.list.length = 0;
    const id = (ROWS.find(r => r[3] === key) || [])[0], b = id && document.getElementById(id); if (b) syncBtn(b, key);
    return set[key];
  }
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('m10-travel')) return;
    let anchor = document.getElementById('rp-toggle') || document.getElementById('ac-cap');
    for (const [id, label, hint, key] of ROWS) {
      const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.id = id + '-label'; lab.textContent = label + ' ';
      const small = document.createElement('small'); small.className = 'muted'; small.textContent = hint; lab.appendChild(small);
      const b = document.createElement('button'); b.className = 'dfbtn small'; b.id = id; b.type = 'button'; b.setAttribute('aria-label', label);
      b.onclick = () => setSwitch(key, !set[key]);
      syncBtn(b, key);
      if (anchor && anchor.parentNode) { anchor.insertAdjacentElement('afterend', b); anchor.insertAdjacentElement('afterend', lab); anchor = b; }
      else { grid.appendChild(lab); grid.appendChild(b); }
    }
  }
  function wireMenu() {
    if (typeof renderAccessibilityMenu !== 'function') return;
    const _acc = renderAccessibilityMenu;
    renderAccessibilityMenu = function () {
      const r = _acc.apply(this, arguments);
      try { appendRows(); } catch (e) { console.warn('motion10 rows failed', e); }
      return r;
    };
  }

  load();
  try { wireEngine(); wireParry(); } catch (e) { console.warn('motion10 wiring failed', e); }
  GFX.onChange(() => { try { if (!lanternsOn()) { LAN.drops.length = 0; LAN.out.length = 0; LAN.stats.active = 0; } if (!parryOn()) SPK.list.length = 0; } catch (e) { /* ignore */ } });
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMenu); else wireMenu();

  return {
    settings: set, setSwitch, stepBy(v) { fixedDt = v == null ? null : +v; }, on: { travel: travelOn, lanterns: lanternsOn, parry: parryOn },
    travel: { go: travelGoAnimated, state: TV, plan: planTravel, frameAt, WALK_MIN, WALK_MAX, END_HOLD, AMBUSH_HOLD, STATIC_HOLD, routeOf, along },
    lanterns: { frame: lanternFrame, state: LAN, isCarrier, darkness, MAX_LIGHTS, CULL, CARRIER_TYPES },
    parry: { fire: fireParry, state: SPK, MATS, materialOf, guardUp },
  };
})();
