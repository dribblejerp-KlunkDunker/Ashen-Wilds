// ============================================================
//  companions — Phase 4 (living world): Kaelen and Lyra, and the people at the fire
//  Everything here READS game state and nudges anim* fields / draws after the
//  original ran. Nothing changes damage, AI, party timers or barks: the wrapped
//  partyTick only diffs G.party.hp before and after the original (and never
//  calls Math.random), and animCreature is wrapped after the original too.
//  1. Hit reactions, injury stoop and a limp. A companion's health is
//     G.party.hp, not e.hp, so anim.js never flinches them; a hp drop across
//     one partyTick starts a flinch.
//  2. Kaelen's Root-note hum (ROADMAP says it exists; it did not): while he is
//     the companion, in play, and below 35% health he holds his chest in the
//     'kaelen_chest' pose and Audio_.hum(.., 174, 'kaelen-root') rises. One
//     ramp (state.chest) drives both, so pose and hum start and stop together.
//  3. Lyra's singing leaves faint rings in the air (post hook, depth-tested so
//     walls hide them).
//  4. Kaelen sharpens his blade at the camp and the hut (strokes, a tiny spark
//     that No-flash removes); anyone standing by a campfire/hearth leans in
//     with warming hands.
//  Art: Phase 20 FOLK frames (flinch, stoop, two limp steps, Kaelen's chest-hold)
//  re-posed from the companions' own painted sprites (see "the painted frames");
//  the squash/skew above stays on top of them, much smaller.
//  Switch: GFX.companionLife (default true). With it off the module does
//  nothing at all. GFX.reduceMotion calms flinches, limp bobbing, the throb,
//  and the sharpening; GFX.noFlash removes sparks and keeps rings steady;
//  GFX.particles scales rings and sparks.
// ============================================================
'use strict';

if (GFX.companionLife === undefined) GFX.companionLife = true;

const COMPANIONS_FX = (() => {
  const TAU = Math.PI * 2;
  const HIT_T = 0.45;            // flinch length, seconds
  const LOW = 0.35;              // Kaelen hums below this fraction of max health (same as partyBark)
  const HUM_ID = 'kaelen-root', HUM_HZ = 174;
  const state = { chest: 0, hum: 0, hits: 0, last: 0, calls: 0, sparks: 0, rings: 0 };
  const calm = () => !!GFX.reduceMotion;
  const on = () => !!GFX.companionLife;
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  // ---------------------------------------------------------------- Phase 20 FOLK: the painted frames
  // Flinch, stoop, limp (two steps) for Kaelen and Lyra, and Kaelen's chest-hold, built ONCE from their own painted
  // sprites: no new paint is invented for bodies, the existing pixels are re-posed. Stoop/flinch/limp use a smooth
  // displacement field (the torso folds over the waist, the head bows into the collar, the bad leg lifts), so there
  // are no seams or holes; the chest-hold lifts the real glass forearm as one rigid piece, turned about the elbow and
  // foreshortened, and mends the coat behind where it hung. Every frame keeps the size and anchors of the sprite it
  // comes from, so hit boxes and placement are unchanged. Deterministic (no random numbers).
  const isGlass = p => { if ((p >>> 24) < 160) return false; const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255; return g > r + 25 && b > r + 25 && Math.max(g, b) >= 110; };
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  // dest pixel (x, y) takes the source pixel at fn(x, y) (nearest)
  function warp(src, fn) {
    const w = src.w, h = src.h, sd = src.data, d = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const q = fn(x, y), sx = Math.round(q[0]), sy = Math.round(q[1]);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) d[y * w + x] = sd[sy * w + sx];
    }
    return d;
  }
  // body proportions as fractions of the sprite height (both companions are drawn to the same 160px figure)
  const BODY = {
    kaelen: { waist: 0.40, neck: 0.165, shoulder: 0.2, hip: 0.56, knee: 0.78, lean: -1 },
    lyra: { waist: 0.40, neck: 0.17, shoulder: 0.16, hip: 0.56, knee: 0.8, lean: 1 },
  };
  // the field for a pose. drop: how far the top of the figure comes down; bow: extra head drop into the collar;
  // lean: sideways shift at the top (+ = viewer's right); rise: shoulders hunched up; leg: {side, lift, bend}
  function poseField(src, B, o) {
    const w = src.w, h = src.h, W = B.waist * h, N = B.neck * h, SH = B.shoulder * h, HIP = B.hip * h, cx = (src.cx != null ? src.cx : w / 2);
    return (x, y) => {
      let sx = x, sy = y;
      if (y < W + 6) {
        const t = clamp01((W + 6 - y) / (W + 6));
        sy -= (o.drop || 0) * t;
        sx -= (o.lean || 0) * Math.pow(t, 1.4);
        sy -= (o.bow || 0) * smooth(N + 3, N - 5, y);                        // the head sinks into the collar
        sy += (o.rise || 0) * smooth(SH - 10, SH, y) * smooth(SH + 22, SH + 8, y);   // shoulders hunch up
      }
      const L = o.leg;
      if (L && y > HIP - 4) {
        const side = L.side > 0 ? smooth(cx - 3, cx + 3, x) : smooth(cx + 3, cx - 3, x);
        const k = smooth(HIP - 4, h - 1, y) * side;
        sy += (L.lift || 0) * k;                                             // the bad leg drawn up: foot barely down
        sx += (L.in || 0) * k * (L.side > 0 ? 1 : -1);
      }
      if (o.sink) sy -= o.sink * smooth(HIP + 10, HIP - 10, y);              // whole upper body dips onto a leg
      return [sx, sy];
    };
  }
  const POSES = {
    stoop: { drop: 7, bow: 4, lean: 3.5 },
    flinch: { drop: 3, bow: 4, lean: -7, rise: 3 },
    limpA: { drop: 6, bow: 3, lean: -2.5, leg: { side: 1, lift: 7, in: 1.5 } },        // the drag: weight on the good leg
    limpB: { drop: 6, bow: 4, lean: 5.5, sink: 4, leg: { side: 1, lift: 2, in: 0 } },  // the dip onto the bad one
  };
  function addFrame(name, srcName, d) {
    const src = Engine.sprites[srcName];
    const sp = Engine.addSprite(name, { w: src.w, h: src.h, data: d, hs: src.hs, cx: src.cx, dy: src.dy });
    // glowing-glass pixels, as lighting.js marks on the plain sprite
    const mask = new Uint8Array(src.w * src.h); let any = 0;
    for (let i = 0; i < d.length; i++) if (isGlass(d[i])) { mask[i] = 1; any++; }
    sp._mask = any ? mask : null;
    return sp;
  }
  const frames = {};
  // which painted frame stands in for a source frame, per companion and pose
  function poseFrame(who, pose, srcName) {
    const key = who + '|' + pose + '|' + srcName, f = frames[key];
    if (f === null) return null;
    if (f && Engine.sprites[f.name] === f.sp) return f.name;
    const src = Engine.sprites[srcName], B = BODY[who];
    if (!src || !src.data || !B || !POSES[pose]) { frames[key] = null; return null; }
    const P = Object.assign({}, POSES[pose]); P.lean = (P.lean || 0) * B.lean;
    if (P.leg) P.leg = Object.assign({}, P.leg, { side: P.leg.side * B.lean });
    const name = who + '_p20' + pose + (srcName === who ? '' : srcName.slice(who.length));
    const sp = addFrame(name, srcName, warp(src, poseField(src, B, P)));
    frames[key] = { name, sp };
    return name;
  }

  // ---------------------------------------------------------------- the chest-holding sprite
  // Kaelen's own glass forearm, lifted as one piece and turned up across his body so the hand rests on his chest.
  let chestSp = null;
  function buildChest() {
    const src = Engine.sprites.kaelen; if (!src || !src.data) return null;
    const w = src.w, h = src.h, sd = src.data;
    // the forearm: glass pixels below the elbow on the glass side
    const ex = Math.round(w * 0.835), ey = Math.round(h * 0.37);              // elbow (about 50, 59)
    const fore = new Uint8Array(w * h); let fy1 = ey;
    for (let y = ey - 2; y < h * 0.66; y++) for (let x = Math.round(w * 0.7); x < w; x++) { const i = y * w + x; if (isGlass(sd[i])) { fore[i] = 1; fy1 = Math.max(fy1, y); } }
    // the dark rim pixels hugging the forearm go with it
    for (let y = ey; y <= fy1 + 1 && y < h; y++) for (let x = Math.round(w * 0.7); x < w; x++) {
      const i = y * w + x; if (fore[i] || (sd[i] >>> 24) < 160 || x < w * 0.78) continue;
      if ((x > 0 && fore[i - 1] === 1) || (x + 1 < w && fore[i + 1] === 1)) fore[i] = 2;
    }
    // 1. lift it off: clear the piece, then mend the coat behind it from the coat's own pixels to the left
    const d = new Uint32Array(sd);
    for (let y = ey; y < h; y++) {
      let last = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!fore[i]) { if ((sd[i] >>> 24) >= 160 && !isGlass(sd[i])) last = sd[i]; continue; }
        // inside the coat's outline (opaque coat further right too)?  then paint coat; else leave clear
        let coatRight = false; for (let k = x + 1; k < w; k++) { const p = sd[y * w + k]; if (fore[y * w + k]) continue; if ((p >>> 24) >= 160) { coatRight = true; } break; }
        d[i] = coatRight && last ? last : 0;
      }
    }
    // 2. the piece turned about the elbow toward the chest, foreshortened (it comes toward the viewer)
    const hx = w * 0.6, hy = h * 0.26;                                       // where the hand comes to rest
    const ang = Math.atan2(hy - ey, hx - ex) - Math.PI / 2, len = Math.max(1, fy1 - ey), want = Math.hypot(hx - ex, hy - ey);
    const k = want / len, cs = Math.cos(ang), sn = Math.sin(ang);
    const put = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x - ex, v = y - ey;
      const ur = u * cs + v * sn, vr = (-u * sn + v * cs) / k;                 // undo the turn, then the shortening
      const sx = Math.round(ex + ur), sy = Math.round(ey + vr);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h || !fore[sy * w + sx] || vr < -1) continue;
      d[y * w + x] = sd[sy * w + sx]; put[y * w + x] = 1;
    }
    // 3. a dark seam where the arm crosses the coat, so it reads in front of him
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (put[i] || (d[i] >>> 24) < 160) continue;
      if (put[i - 1] || put[i + 1] || put[i - w] || put[i + w]) { const p = d[i]; d[i] = (((p >>> 24) << 24) | ((((p >>> 16) & 255) * 0.45) << 16) | ((((p >>> 8) & 255) * 0.45) << 8) | ((p & 255) * 0.45)) >>> 0; }
    }
    const out = warp({ w, h, data: d }, poseField(src, BODY.kaelen, { drop: 3, bow: 2, lean: 1.5 }));   // and he curls a little round it
    return addFrame('kaelen_chest', 'kaelen', out);
  }
  function chestSprite() {
    if (!chestSp || Engine.sprites.kaelen_chest !== chestSp) chestSp = buildChest();
    if (chestSp) chestSp.emit = GFX.emissive && chestSp._mask ? chestSp._mask : null;
    return chestSp;
  }
  // ---------------------------------------------------------------- party state: hit diff, hum, pose ramp
  function companionEnt() { const L = typeof G !== 'undefined' && G.ents; if (!L) return null; for (let i = 0; i < L.length; i++) if (L[i].companion) return L[i]; return null; }
  function chestWanted() {
    if (!on() || typeof G === 'undefined' || G.state !== 'play' || G.dead) return false;
    const P = G.party; if (!P || P.id !== 'kaelen' || P.map !== G.mapId) return false;
    if (P.downed && P.downed.kaelen) return false;
    const e = companionEnt(); if (!e || e.hidden || e.sprite !== 'kaelen') return false;
    return P.hp > 0 && P.hp < partyMax('kaelen') * LOW;
  }
  // One ramp for pose and hum. Wall-clock based, so it may be called from the
  // party tick, the frame hook and the safety timer without ramping twice.
  function sync(dtOverride) {
    state.calls++;
    const t = nowS(), dt = dtOverride != null ? dtOverride : Math.min(0.25, Math.max(0, t - (state.last || t)));
    state.last = t;
    const want = chestWanted();
    const gone = !companionEnt();                       // map change, dismissed, downed: stop fast
    const rate = want ? 0.9 : gone ? 4 : 1.4;           // rises over about a second, fades a little quicker
    state.chest = clamp01(state.chest + (want ? 1 : -1) * rate * dt);
    if (state.chest < 0.02 && !want) state.chest = 0;
    if (!on() && state.hum === 0) return;
    // the hum breathes with the pose's slow throb
    const pulse = calm() ? 1 : 0.86 + 0.14 * Math.sin(t * TAU / 1.4);
    const lvl = state.chest > 0 ? state.chest * 0.8 * pulse : 0;
    if (lvl !== state.hum) {
      state.hum = lvl;
      if (typeof Audio_ !== 'undefined' && Audio_.hum) { try { Audio_.hum(lvl, HUM_HZ, HUM_ID); } catch (err) { /* sound is optional */ } }
    }
  }

  // ---------------------------------------------------------------- animation (after the original ran)
  function injury(e) {
    const P = G.party; if (!P || P.id == null) return 0;
    const f = P.hp / partyMax(P.id);
    return clamp01((0.6 - f) / 0.35);              // starts at 60% health, full at 25%
  }
  function companionAnim(e, dt, T) {
    const P = G.party, s = e._seed || 0;
    let sy = e.animSY, sx = e.animSX, lift = e.animLift, skew = e.animSkew, hurt = e.animHurt;
    const inj = P && P.id === (e.sprite) ? injury(e) : 0;
    const reduce = calm(), moving = (e._spd || 0) > 0.25;
    // Phase 20: a painted frame carries the pose when one applies (strike and song frames keep priority)
    const who = e.sprite, a0 = e.animSprite, plain = BODY[who] && (!a0 || a0 === who + '_w1' || a0 === who + '_w2');
    let frame = null;
    if (plain) {
      if (e._cHit > HIT_T * 0.3) frame = poseFrame(who, 'flinch', who);
      else if (who === 'kaelen' && state.chest > 0) frame = null;                     // the chest-hold below
      else if (inj > 0.3) {
        if (moving && !reduce) {
          if (a0) frame = poseFrame(who, a0 === who + '_w1' ? 'limpA' : 'limpB', a0);
          else if (who === 'kaelen') frame = poseFrame(who, 'stoop', who);
          else frame = poseFrame(who, ['limpA', 'stoop', 'limpB', 'stoop'][Math.floor((e._phase || 0) / (Math.PI / 2)) & 3], who);
        } else frame = poseFrame(who, 'stoop', who);
      }
      if (frame) { e.animSprite = frame; state.frames = (state.frames || 0) + 1; const fs = Engine.sprites[frame]; if (fs) fs.emit = GFX.emissive && fs._mask ? fs._mask : null; }
    }
    const fk = frame ? 0.3 : 1;                                                        // the frame does most of the work
    // injury: a stoop, and a limp where one step is short and dragged
    if (inj > 0) {
      sy *= 1 - 0.035 * inj * fk; skew -= 0.022 * inj * fk * (e.sprite === 'lyra' ? 1.3 : 1);
      if (moving && !reduce) {
        const ph = e._phase || 0, odd = (Math.floor(ph / Math.PI) & 1) === 1, a = Math.abs(Math.sin(ph));
        lift -= 0.02 * inj * (odd ? 1 : 0.2) * a;                     // the bad leg barely leaves the ground
        skew += (odd ? 0.035 : -0.012) * inj * a;                       // and the body drops onto the good one
        sy *= 1 - 0.015 * inj * (odd ? 1 : 0);
      }
    }
    // hit reaction: one lurch away from the blow, a squash, a red tint
    if (e._cHit > 0) {
      e._cHit -= dt;
      const u = Math.max(0, e._cHit) / HIT_T, amp = reduce ? 0.4 : 1, dir = s > 3.14 ? 1 : -1;
      skew += (dir * 0.09 * u * amp + (reduce ? 0 : 0.03 * u * Math.sin(T * 38))) * fk;
      sy *= 1 - 0.06 * u * amp * fk; sx *= 1 - 0.03 * u * amp * fk; lift -= 0.012 * u * amp * fk;
      if (!GFX.noFlash) hurt = Math.max(hurt, u * (reduce ? 0.5 : 1));
    }
    // Kaelen holds his chest while the Root note hums (frames for strikes keep priority)
    if (e.sprite === 'kaelen' && state.chest > 0) {
      const k = state.chest, a = e.animSprite;
      const sp = !a || a === 'kaelen_w1' || a === 'kaelen_w2' ? chestSprite() : null;
      if (sp) e.animSprite = 'kaelen_chest';
      sy *= 1 - 0.025 * k; skew -= 0.02 * k;
      if (!reduce) { const th = 0.5 + 0.5 * Math.sin(T * TAU / 1.4); sy *= 1 + 0.012 * k * th; lift += 0.004 * k * th; }
    }
    e.animSY = sy; e.animSX = sx; e.animLift = lift; e.animSkew = skew; e.animHurt = hurt;
    // Lyra: how long she has been singing, and when the next ring leaves her
    if (e.sprite === 'lyra') {
      const singing = Math.max(e._fsong || 0, e._fsing || 0, e._sing || 0) > 0;
      if (singing) {
        e._cSingT = (e._cSingT || 0) + dt;
        if (!e._cRings) e._cRings = [];
        if (e._cSingT >= (e._cNext || 0)) { e._cNext = e._cSingT + 0.5; e._cRings.push(0); if (e._cRings.length > 5) e._cRings.shift(); }
      } else { e._cSingT = 0; e._cNext = 0; }
      const R = e._cRings;
      if (R && R.length) { for (let i = R.length - 1; i >= 0; i--) { R[i] += dt; if (R[i] > 1.9) R.splice(i, 1); } }
    }
  }

  // ---------------------------------------------------------------- the camp: sharpening and warming hands
  let fireCache = { ents: null, n: -1, list: [] };
  function fires() {
    const L = G.ents; if (!L) return fireCache.list;
    if (fireCache.ents !== L || fireCache.n !== L.length) {
      fireCache = { ents: L, n: L.length, list: L.filter(o => o.kind === 'deco' && (o.sprite === 'campfire' || o.sprite === 'hearth')) };
    }
    return fireCache.list;
  }
  function inDialogue(e) { return typeof DLG !== 'undefined' && DLG.ent === e && G.state === 'dialogue'; }
  function campAnim(e, dt, T) {
    if ((e._spd || 0) > 0.25 || inDialogue(e) || e.dead || e.stun > 0) return;
    const s = e._seed || 0, reduce = calm();
    let sy = e.animSY, sx = e.animSX, lift = e.animLift, skew = e.animSkew;
    e._cSharp = 0;
    // Kaelen at the camp or in his hut: three strokes of the whetstone, a pause, again
    if (e.sprite === 'kaelen' && !e.companion && (e.id === 'kaelen_dw' || e.id === 'kaelen')) {
      const P = 3.4, t = (T + s) % P, STROKES = 3, SL = 0.5;
      if (t < STROKES * SL) {
        const ph = (t % SL) / SL, stroke = Math.sin(ph * Math.PI), a = reduce ? 0.3 : 1;
        skew += 0.03 * a * Math.sin(ph * TAU) * (1 - 0.15 * Math.floor(t / SL));
        sy *= 1 - 0.012 * a * stroke; lift += 0.004 * a * stroke;
        sx *= 1 + 0.01 * a * stroke;
        e._cSharp = ph > 0.45 && ph < 0.62 ? 1 : 0;       // the blade's tip crosses the stone
        e._cSharpK = (ph - 0.45) / 0.17;
        e._cStroke = Math.floor(t / SL);
      }
      e.animSY = sy; e.animSX = sx; e.animLift = lift; e.animSkew = skew;
      return;
    }
    if (e.kind !== 'npc' || e.companion || e.hidden) return;
    // townsfolk with a work loop (Hetty at the bar, the mill hands) are busy, not warming their hands
    if (typeof TOWNSFOLK !== 'undefined' && TOWNSFOLK.LOOPS && TOWNSFOLK.LOOPS[G.mapId + '|' + e.id]) return;
    const F = fires(); if (!F.length) return;
    let best = null, bd = 2.6 * 2.6;
    for (let i = 0; i < F.length; i++) { const dx = F[i].x - e.x, dy = F[i].y - e.y, d2 = dx * dx + dy * dy; if (d2 < bd && d2 > 0.2) { bd = d2; best = F[i]; } }
    if (!best) return;
    // lean toward the fire as seen from here: sign of its screen position relative to ours
    const c = Engine.cam, fx = best.x - e.x, fy = best.y - e.y;
    const across = fx * -Math.sin(c.dir) + fy * Math.cos(c.dir);   // + : fire is to the viewer's right
    const k = Math.min(1, Math.sqrt(bd) < 0.9 ? 0.5 : 1);
    const lean = Math.max(-1, Math.min(1, across * 1.4));
    skew += 0.028 * k * lean; sy *= 1 - 0.018 * k;
    // hands held out, rubbed now and then (a small quick tremble)
    if (!reduce) { const rub = Math.max(0, Math.sin((T + s) * 0.9)); sy *= 1 + 0.006 * rub * Math.sin(T * 9 + s); skew += 0.004 * rub * Math.sin(T * 7.3 + s); }
    e.animSY = sy; e.animSX = sx; e.animLift = lift; e.animSkew = skew;
  }

  // ---------------------------------------------------------------- post hook: ring and spark drawing
  const mix = (fb, o, r, g, b, a) => {
    const px = fb[o], pr = px & 255, pg = (px >> 8) & 255, pb = (px >> 16) & 255;
    fb[o] = (255 << 24) | (((pb + (b - pb) * a) | 0) << 16) | (((pg + (g - pg) * a) | 0) << 8) | ((pr + (r - pr) * a) | 0);
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function ringAt(F, e, age, strength) {
    // a thin ring around her chest, facing the viewer (a horizontal ring at eye height would collapse to a line).
    // Depth is her own, so her body and anything farther than she is shows it, and a nearer wall or tree hides it per pixel.
    const k = age / 1.9, r = 0.28 + 0.8 * (1 - (1 - k) * (1 - k));
    const fade = (1 - k) * (1 - k) * strength;
    if (fade < 0.02) return;
    const cam = F.cam, inv = 1 / (F.planeX * F.dirY - F.dirX * F.planeY), W = F.w, H = F.h, fb = F.fb, db = F.dbuf;
    const dx = e.x - cam.x, dy = e.y - cam.y;
    const trX = inv * (F.dirY * dx - F.dirX * dy), trY = inv * (-F.planeY * dx + F.planeX * dy);
    if (trY <= 0.2) return;
    const floor = F.map && (F.map.lvls || F.map.smooth) && F.map.groundAt ? F.map.groundAt(e.x, e.y) : 0;
    const hz = 0.55 * (e.scale || 1) + (e.yOff || 0) - (e.animLift || 0);        // chest height above her feet
    const L = Math.hypot(F.planeX, F.planeY) || 1, ppu = (W / 2) / (L * trY);
    const cx = (W / 2) * (1 + trX / trY), cy = F.horizon + ((cam.z - floor - hz) * H / trY);
    const rp = r * ppu; if (rp < 2 || cx + rp < 0 || cx - rp >= W) return;
    const pk = GFX.particles == null ? 1 : GFX.particles;
    const N = Math.max(8, Math.min(160, Math.round(rp * 1.6 * Math.min(1.5, Math.max(0.15, pk)))));
    const tint = GFX.noFlash;                                          // No flash: a cast of colour, never brighter
    const zt = trY - 0.1;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, sx = (cx + Math.cos(a) * rp) | 0, sy = (cy + Math.sin(a) * rp * 0.82) | 0;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      if (BAYER[((sy & 3) << 2) | (sx & 3)] >= 3 + 13 * fade) continue;
      const o = sy * W + sx; if (db && db[o] < zt) continue;            // something nearer hides it
      if (!tint) mix(fb, o, 205, 238, 232, 0.5 * Math.min(1, fade + 0.2));
      else { const px = fb[o], l = 0.3 * (px & 255) + 0.59 * ((px >> 8) & 255) + 0.11 * ((px >> 16) & 255); mix(fb, o, l * 0.8, Math.min(255, l * 1.12), Math.min(255, l * 1.08), 0.4); }   // teal cast at the same brightness
      state.rings++;
    }
  }
  function sparkAt(F, e) {
    const s = e._screen; if (!s) return;
    const S = F.S, W = F.w, H = F.h, fb = F.fb, db = F.dbuf;
    const k = clamp01(e._cSharpK == null ? 0 : e._cSharpK), pk = GFX.particles == null ? 1 : GFX.particles;
    if (pk <= 0.05) return;
    const bx = (s.x0 + (s.x1 - s.x0) * 0.74) * S, by = (s.y0 + (s.y1 - s.y0) * 0.52) * S;   // where blade meets stone, near his glass hand
    const n = Math.max(1, Math.round(3 * pk));
    for (let i = 0; i < n; i++) {
      const ang = -0.6 - i * 0.7 + (e._cStroke || 0) * 0.5, d = (1 + k * 3.2) * S * (0.6 + 0.3 * i);
      const x = (bx + Math.cos(ang) * d) | 0, y = (by + Math.sin(ang) * d + k * k * 2 * S) | 0;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = y * W + x; if (db && db[o] < s.z - 0.04) continue;
      mix(fb, o, 255, 214, 130, 0.9 * (1 - k * 0.6)); state.sparks++;
    }
  }
  function hook(F) {
    if (!on() || !G.ents) return;
    sync();
    const noF = GFX.noFlash, calmed = calm();
    for (let i = 0; i < G.ents.length; i++) {
      const e = G.ents[i];
      if (e.hidden || e.dead) continue;
      if (e.companion && e.sprite === 'lyra' && e._cRings && e._cRings.length && (GFX.particles == null || GFX.particles > 0)) {
        const dx = e.x - F.cam.x, dy = e.y - F.cam.y; if (dx * dx + dy * dy > 144) continue;
        if (calmed) ringAt(F, e, 0.55, 0.45);                             // one steady, faint ring, not expanding
        else for (let j = 0; j < e._cRings.length; j++) ringAt(F, e, e._cRings[j], noF ? 0.8 : 1);
      } else if (e._cSharp && !noF && !calmed && e.sprite === 'kaelen') sparkAt(F, e);
    }
  }

  // ---------------------------------------------------------------- wrap the game (read-only)
  if (typeof partyTick === 'function') {
    const _tick = partyTick;
    partyTick = function (dt) {
      let hp0 = null; const P0 = G.party, e0 = P0 && P0.id ? companionEnt() : null;
      if (P0 && P0.id && e0) hp0 = P0.hp;
      const r = _tick.apply(this, arguments);
      try {
        if (on()) {
          const P = G.party;
          if (hp0 != null && e0 && P && P.id === P0.id && P.hp < hp0 - 0.5) { e0._cHit = HIT_T; state.hits++; }
          sync();
        } else if (state.hum !== 0 || state.chest !== 0) sync();
      } catch (err) { if (!state.warned) { state.warned = true; console.warn('companions tick failed', err); } }
      return r;
    };
  }
  if (typeof animCreature === 'function') {
    const _anim = animCreature;
    animCreature = function (e, dt, T) {
      _anim(e, dt, T);
      if (!on() || e.kind !== 'npc') return;
      try {
        if (e._seed == null && typeof animSeed === 'function') animSeed(e);
        if (e.companion) companionAnim(e, dt, T);
        else campAnim(e, dt, T);
      } catch (err) { if (!state.warned) { state.warned = true; console.warn('companions anim failed', err); } }
    };
  }
  if (typeof Engine !== 'undefined' && Engine.addPostHook) Engine.addPostHook((F) => { try { hook(F); } catch (err) { if (!state.warned) { state.warned = true; console.warn('companions hook failed', err); } } }, 26);
  // paused, dialogue, title: no frames reach the hook, so a slow timer lets the hum die away
  if (typeof setInterval === 'function') setInterval(() => { try { if (state.hum !== 0 || state.chest !== 0) sync(); } catch (err) { /* ignore */ } }, 250);

  return { state, sync, injury, chestSprite, buildChest, poseFrame, POSES, BODY, HIT_T, LOW, HUM_ID, chestWanted };
})();
