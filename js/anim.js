/* eslint-disable no-func-assign */
// ============================================================
//  ANIMATION: procedural life for every sprite in the world.
//  The engine reads animSY/animSX (squash and stretch), animLift, animSkew (lean),
//  animFlip, animAlpha (dithered fade), animHurt (red flash) and animGlow from each entity.
//  Nothing here is saved; it is all recomputed every frame.
// ============================================================

const ANIM = {
  T: 0, last: 0, ents: null, dirLast: 0,
  quadruped: new Set(['hound', 'cat', 'weaverling', 'broodmother']),
  flutter: new Set(['hushmoth', 'mites']),
  trees: new Set(['oak', 'willow']),
  hanging: new Set(['cloaks', 'web', 'cocoon', 'sign', 'bigbell']),
  fire: new Set(['campfire', 'hearth']),
  lamp: new Set(['lamp']),
};

const ANIM_FRAMES = {};
function animHasFrames(name) { if (ANIM_FRAMES[name] == null) ANIM_FRAMES[name] = !!(Engine.sprites[name + '_w1'] && Engine.sprites[name + '_a2']); return ANIM_FRAMES[name]; }
function animSeed(e) { if (e._seed == null) e._seed = ((e.x * 73.13 + e.y * 37.7) % 6.283 + 6.283) % 6.283; return e._seed; }
function animReset(e) { e.animSY = 1; e.animSX = 1; e.animLift = 0; e.animSkew = 0; e.animHurt = 0; e.animGlow = 0; e.animAlpha = 1; }

// Five canonical views / eight octants. Facing is world-space and remains
// stable when the player circles an idle creature; camera yaw is irrelevant.
function animViewAngle(e, cam = Engine.cam) {
  const heading = Number.isFinite(e.facing) ? e.facing : 0;
  const relative = Math.atan2(cam.y - e.y, cam.x - e.x) - heading;
  const octant = ((Math.round(relative / (Math.PI / 4)) % 8) + 8) % 8;
  return { view: Math.min(octant, 8 - octant), flip: octant > 4 };
}

const PROCTOR_VIEWS = new Map();
// Original pixel illustrations for the pilot. These are intentionally separate
// views, not a squeeze/darken of the front-facing artwork. Action poses retain
// their walk/attack timing; final painted sheets for other species are pending.
function animProctorView(view, pose) {
  const key = view + ':' + pose;
  if (PROCTOR_VIEWS.has(key)) return PROCTOR_VIEWS.get(key);
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 96;
  const c = canvas.getContext('2d');
  const walk = pose === '_w1' ? -3 : pose === '_w2' ? 3 : 0;
  const attack = pose === '_a2' ? 8 : pose === '_a1' ? -4 : 0;
  function poly(color, points) {
    c.fillStyle = color; c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
    c.closePath(); c.fill();
  }
  function rect(color, x, y, w, h) { c.fillStyle = color; c.fillRect(x, y, w, h); }
  // Feet, heavy layered robe and a hood. Side views narrow naturally; back
  // views have no face or hand-press painted over the back of the robe.
  const side = view === 2, rear = view >= 3;
  const left = side ? 24 : 16, right = side ? 43 : 49;
  rect('#171314', left + 3 + walk, 85, 9, 8); rect('#1e1919', right - 12 - walk, 86, 10, 7);
  poly('#29232c', [[left + 7, 29], [right - 7, 29], [right, 87], [left - 3, 87]]);
  poly('#443b49', [[left + 9, 31], [right - 9, 31], [right - 4, 83], [left + 3, 85]]);
  poly('#615468', [[left + 12, 34], [left + 16, 35], [left + 11, 80], [left + 5, 81]]);
  poly('#302b37', [[right - 11, 37], [right - 6, 45], [right - 1, 85], [right - 10, 83]]);
  rect('#a89b79', left + 1, 83, right - left - 1, 2);
  poly('#29232e', [[26, 8], [37, 7], [44, 19], [41, 36], [23, 36], [20, 21]]);
  poly('#524858', [[27, 10], [35, 10], [40, 20], [37, 31], [24, 30], [23, 21]]);
  if (rear) {
    // Folded hood, stitched spine and the Synod's brass seal.
    poly('#37303e', [[24, 20], [39, 18], [37, 33], [31, 39]]);
    rect('#827184', 31, 40, 1, 39); rect('#aa9362', 28, 44, 7, 2); rect('#aa9362', 31, 41, 2, 10);
    if (view === 3) rect('#a1989b', 40, 20, 2, 8);
  } else {
    poly('#b9b5b0', side ? [[36, 17], [42, 20], [45, 25], [39, 29], [35, 26]] : [[30, 16], [39, 17], [42, 25], [35, 30], [28, 25]]);
    rect('#27242b', side ? 40 : 34, 21, side ? 3 : 6, 2);
    rect('#797a7b', 37, 26, 4, 2);
  }
  // The press is held on the forward side, never over the back.
  const armX = rear ? left - 1 : right - 6 + attack;
  poly('#4b4053', [[rear ? left + 6 : right - 8, 35], [armX + 5, 46], [armX + 2, 64], [armX - 6, 59]]);
  rect('#a18b79', armX - 5, 59, 7, 6);
  if (!rear) { rect('#766d58', armX - 5, 61, 10, 12); rect('#c1b38c', armX - 7, 62, 14, 3); rect('#29292b', armX - 3, 68, 6, 3); }
  const data = c.getImageData(0, 0, 64, 96);
  const sprite = { w: 64, h: 96, data: new Uint32Array(data.data.buffer), hs: 1, cx: 0.5, dy: 0 };
  PROCTOR_VIEWS.set(key, sprite);
  return sprite;
}
// Four discrete, cached flame silhouettes from the original painted sprite.
// Only warm flame pixels above the fuel bed move; logs/stone stay anchored.
const FIRE_FRAMES = new WeakMap();
function animFireSprite(source, phase) {
  if (!source) return source;
  let frames = FIRE_FRAMES.get(source);
  if (!frames) { frames = []; FIRE_FRAMES.set(source, frames); }
  const stage = ((phase % 4) + 4) % 4;
  if (frames[stage]) return frames[stage];
  const { w, h } = source, data = new Uint32Array(source.data);
  const flame = [];
  for (let y = 0; y < h * 0.68; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, px = source.data[i];
    const r = px & 255, g = (px >>> 8) & 255, b = (px >>> 16) & 255;
    if ((px >>> 24) > 100 && r > 125 && r > g * 1.15 && g > b * 1.15) {
      flame.push([x, y, px]); data[i] = 0;
    }
  }
  for (const [x, y, px] of flame) {
    const lift = Math.max(0, 1 - y / (h * 0.68));
    const dx = Math.round(x + Math.sin(y * 0.21 + stage * Math.PI / 2) * lift * 3);
    const dy = Math.max(0, Math.round(y - [0, 3, 1, 4][stage] * lift));
    if (dx >= 0 && dx < w) data[dy * w + dx] = px;
  }
  frames[stage] = { ...source, data };
  return frames[stage];
}

// Pure visual choreography: attack() remains the sole owner of hit rolls,
// costs and cooldowns. Wind-up, strike and recovery follow its existing clock.
function animWeaponPose(w, progress, direction) {
  const f = Math.max(0, Math.min(1, progress));
  const thrust = direction === 'thrust' || w.img === 'fp_knife' || w.img === 'fp_spear';
  const overhead = !thrust && (w.blunt || w.img === 'fp_axe' || direction === 'chop down');
  const family = w.ranged ? 'ranged' : thrust ? 'thrust' : overhead ? 'overhead' : 'sweep';
  const tracks = {
    ranged: [[0, 0, 0, 1], [4, 3, 0.02, 1], [10, 15, 0.08, 0.94], [4, 5, 0.02, 0.98], [0, 0, 0, 1]],
    thrust: [[0, 0, 0, 1], [12, 9, 0.1, 0.92], [-30, -26, -0.12, 1.18], [-12, -9, -0.04, 1.06], [0, 0, 0, 1]],
    overhead: [[0, 0, 0, 1], [14, -25, 0.5, 0.95], [-38, 12, -0.55, 1.1], [-18, 8, -0.2, 1.03], [0, 0, 0, 1]],
    sweep: [[0, 0, 0, 1], [18, 5, 0.35, 0.98], [-68, -12, -0.85, 1.06], [-30, -4, -0.4, 1.02], [0, 0, 0, 1]],
  };
  const track = tracks[family], times = [0, 0.24, 0.48, 0.74, 1];
  let i = 0; while (i < 3 && f > times[i + 1]) i++;
  const t = Math.max(0, Math.min(1, (f - times[i]) / (times[i + 1] - times[i])));
  const k = t * t * (3 - 2 * t), a = track[i], b = track[i + 1];
  const mix = n => a[n] + (b[n] - a[n]) * k;
  const mirror = family === 'sweep' && direction === 'slash right' ? -1 : 1;
  return { x: mix(0) * mirror, y: mix(1), rotation: mix(2) * mirror, scale: mix(3), family };
}

function animDirectionalSprite(e) {
  const base = (e.animSprite && Engine.sprites[e.animSprite]) || Engine.sprites[e.sprite];
  if (e.deathArt) return { sprite: animDeathSprite(e), flip: !!e.animFlip };
  if (ANIM.fire.has(e.sprite)) return { sprite: animFireSprite(base, Math.floor(ANIM.T * 7 + animSeed(e)) % 4), flip: false };
  if (e.kind !== 'enemy' || e.sprite !== 'proctor') return { sprite: base, flip: !!e.animFlip };
  const angle = animViewAngle(e), pose = e.animSprite ? e.animSprite.slice(e.sprite.length) : '';
  return { sprite: angle.view === 0 ? base : animProctorView(angle.view, pose), flip: angle.flip };
}

// ---------------------------------------------------------------- creatures
function animCreature(e, dt, T) {
  const s = animSeed(e), d = e.def || {}, isEnemy = e.kind === 'enemy';
  // how far did it move this frame?
  const vx = e._ax == null ? 0 : (e.x - e._ax) / Math.max(dt, 1e-3), vy = e._ay == null ? 0 : (e.y - e._ay) / Math.max(dt, 1e-3);
  e._ax = e.x; e._ay = e.y;
  const spd = Math.min(6, Math.hypot(vx, vy));
  e._spd = (e._spd || 0) * 0.8 + spd * 0.2; // smoothed, so a stop-start chase does not stutter
  const moving = e._spd > 0.25;
  // Derive heading from actual movement (including retreat), or look toward
  // the threat while stationary in combat. Idle guards keep their map heading.
  if (spd > 0.08) e.facing = Math.atan2(vy, vx);
  else if (isEnemy && e.state === 'chase' && !e.stun) e.facing = Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x);
  const hover = (d.yOff || 0) < 0 || ANIM.flutter.has(e.sprite) || d.quiet;
  // idle breathing
  let sy = 1 + 0.018 * Math.sin(T * 2.1 + s), sx = 1 - 0.009 * Math.sin(T * 2.1 + s);
  let lift = 0, skew = 0, alpha = 1, glow = 0;
  if (!isEnemy) { sy = 1 + 0.012 * Math.sin(T * 1.6 + s); sx = 1 - 0.006 * Math.sin(T * 1.6 + s); skew = 0.012 * Math.sin(T * 0.45 + s * 2); }
  // walking, galloping or hovering
  if (hover) {
    lift = 0.05 + 0.045 * Math.sin(T * 2.4 + s);
    skew = 0.025 * Math.sin(T * 1.1 + s);
    if (ANIM.flutter.has(e.sprite)) sx *= 1 + 0.13 * Math.sin(T * 24 + s);
    if (d.quiet) { alpha = 0.62 + 0.22 * Math.sin(T * 1.3 + s); skew = 0.04 * Math.sin(T * 0.8 + s); }
  } else if (moving) {
    e._phase = (e._phase || 0) + e._spd * dt * (ANIM.quadruped.has(e.sprite) ? 5.2 : 4.2);
    const ph = e._phase;
    if (ANIM.quadruped.has(e.sprite)) { lift = Math.abs(Math.sin(ph)) * 0.05 * (e.scale || 1); sx *= 1 + 0.05 * Math.sin(ph * 2); sy *= 1 - 0.04 * Math.sin(ph * 2); }
    else { lift = Math.abs(Math.sin(ph)) * 0.035 * (e.scale || 1); skew = Math.sin(ph) * 0.035; sy *= 1 - Math.abs(Math.cos(ph)) * 0.02; }
  }
  // face the way it is going across the screen
  if (moving && (ANIM.quadruped.has(e.sprite) || ANIM.flutter.has(e.sprite))) {
    const c = Engine.cam, across = vx * -Math.sin(c.dir) + vy * Math.cos(c.dir);
    if (across < -0.35) e.animFlip = true; else if (across > 0.35) e.animFlip = false;
  }
  // attack: a wind-up and lunge, whenever its cooldown resets
  const cool = isEnemy ? e.cool : e.atkT;
  if (cool != null && e._cool != null && cool > e._cool + 0.3) e._atk = 0.42;
  e._cool = cool;
  if (e._atk > 0) {
    e._atk -= dt; const f = 1 - Math.max(0, e._atk) / 0.42;
    const wind = f < 0.35 ? -Math.sin(f / 0.35 * Math.PI / 2) * 0.5 : Math.sin((f - 0.35) / 0.65 * Math.PI);
    sy *= 1 + 0.09 * wind; sx *= 1 + 0.07 * wind; lift += 0.03 * Math.max(0, wind); skew += (s > 3.14 ? 1 : -1) * 0.07 * wind;
  }
  // real frames, where the enemy has them: walk steps, wind-up as the blow comes, strike as it lands
  if (animHasFrames(e.sprite)) {
    const dCam = Math.hypot(Engine.cam.x - e.x, Engine.cam.y - e.y);
    const shot = e.shotT;
    if (shot != null && e._shot != null && shot > e._shot + 0.5) e._strike = 0.4;
    e._shot = shot;
    // the listening-horn: its alarm timer resetting is its "strike"
    const horn = e.hornT;
    if (horn != null && e._horn != null && horn > e._horn + 0.5) e._strike = 0.6;
    e._horn = horn;
    if (e._atk > 0.3) e._strike = Math.max(e._strike || 0, 0.32);
    if (e._strike > 0) e._strike -= dt;
    let pick = null;
    // companions: Kaelen cocks the glass arm and brings it down; Lyra sings
    let comp = null;
    if (e.companion) {
      const cd = G.party && G.party.cd;
      const abil = cd != null && e._fcd != null && cd > e._fcd + 5; e._fcd = cd;
      if (e.sprite === 'kaelen') {
        if (e.atkT != null && e._catk != null && e.atkT > e._catk + 0.5) e._strike = Math.max(e._strike || 0, 0.34);
        const melee = e.atkT != null && e._catk != null && e.atkT < e._catk; e._catk = e.atkT;
        if (abil) e._strike = 0.55;
        comp = e._strike > 0 ? '_a2' : melee && e.atkT < 0.45 ? '_a1' : null;
      } else {
        if (e.healT != null && e._fheal != null && e.healT > e._fheal + 5) e._fsing = 1.4; e._fheal = e.healT;
        if (abil) e._fsong = 1.6;
        if (e._fsong > 0) e._fsong -= dt; if (e._fsing > 0) e._fsing -= dt;
        comp = e._fsong > 0 ? '_a2' : e._fsing > 0 ? '_a1' : null;
      }
    }
    if (comp) pick = comp;
    else if (e.companion && e.sprite === 'lyra') pick = null;
    else if (e._strike > 0) pick = '_a2';
    else if (isEnemy && e.state === 'chase' && !e.stun && ((d.reach && dCam < d.reach + 0.35 && e.cool != null && e.cool < 0.38) || (shot != null && shot < 0.6 && shot > 0))) pick = '_a1';
    else if (d.horn && horn != null && horn > 0 && horn < 1) pick = '_a1';
    else if (d.horn) pick = [null, '_w1', null, '_w2'][Math.floor(((T * 0.45 + s) % 4 + 4) % 4)];
    else if (hover) pick = [null, '_w1', null, '_w2'][Math.floor(((T * 1.4 + s) % 4 + 4) % 4)];
    if (!pick && moving && !hover) {
      const k = Math.floor((e._phase || 0) / (Math.PI / 2));
      pick = ANIM.quadruped.has(e.sprite) ? ['_w1', '_w2'][k & 1] : ['_w1', null, '_w2', null][k & 3];
    }
    e.animSprite = pick ? e.sprite + pick : null;
    // the frames carry the motion now, so the procedural bounce steps back
    if (pick && pick !== '_a1') { skew *= 0.35; lift *= 0.5; sy = 1 + (sy - 1) * 0.4; sx = 1 + (sx - 1) * 0.4; }
  } else e.animSprite = null;
  // hit: a flinch and a red flash
  if (e.hp != null && e._hp != null && e.hp < e._hp - 0.01) e._hurt = 0.3;
  e._hp = e.hp;
  let hurt = 0;
  if (e._hurt > 0) { e._hurt -= dt; hurt = Math.max(0, e._hurt) / 0.3; skew += 0.11 * hurt * Math.sin(T * 45); sx *= 1 - 0.06 * hurt; lift -= 0.015 * hurt; }
  // stunned: a slow drunk wobble
  if (e.stun > 0) { skew += 0.08 * Math.sin(T * 8 + s); sy *= 1 - 0.03 * Math.abs(Math.sin(T * 4)); }
  // talking to you: a little nod with every phrase
  if (typeof DLG !== 'undefined' && DLG.ent === e && G.state === 'dialogue') { sy *= 1 + 0.026 * Math.max(0, Math.sin(T * 9)) * (0.6 + 0.4 * Math.sin(T * 1.7)); lift += 0.006 * Math.sin(T * 9); }
  // companions: Lyra glows while she sings, Kaelen's arm when he swings it
  if (e.companion) {
    if (e.healT != null && e._healT != null && e.healT > e._healT + 5) e._sing = 1.4;
    e._healT = e.healT;
    const cd = G.party && G.party.cd; if (cd != null && e._cd != null && cd > e._cd + 5) e._sing = Math.max(e._sing || 0, 1.0);
    e._cd = cd;
    if (e._sing > 0) { e._sing -= dt; glow = 0.75 + 0.2 * Math.sin(T * 10); sy *= 1 + 0.02 * Math.sin(T * 7); }
  }
  e.animSY = sy; e.animSX = sx; e.animLift = lift; e.animSkew = skew; e.animAlpha = alpha; e.animHurt = hurt; e.animGlow = glow;
}

// ---------------------------------------------------------------- world objects
function animDeco(e, dt, T, outdoor) {
  const s = animSeed(e), sp = e.sprite;
  animReset(e);
  if (e.dying) return animDying(e, dt);
  if (e.corpse) return;
  if (ANIM.trees.has(sp) && outdoor) {
    const gust = 0.7 + 0.3 * Math.sin(T * 0.23 + e.x * 0.05);
    e.animSkew = gust * (0.016 * Math.sin(T * 0.9 + e.x * 0.35 + e.y * 0.2) + 0.006 * Math.sin(T * 2.3 + s));
  } else if (ANIM.hanging.has(sp)) {
    e.animSkew = (sp === 'bigbell' ? 0.012 : 0.03) * Math.sin(T * (sp === 'bigbell' ? 0.7 : 1.3) + s);
  } else if (ANIM.fire.has(sp)) {
    e.animSY = 1 + 0.05 * Math.sin(T * 11 + s) + 0.03 * Math.sin(T * 17.3 + s * 2);
    e.animSX = 1 - 0.03 * Math.sin(T * 13 + s);
    e.animGlow = 0.82 + 0.14 * Math.sin(T * 9.1 + s) + 0.04 * Math.sin(T * 23);
  } else if (ANIM.lamp.has(sp)) {
    e.animGlow = (e.glow || 0.7) * (0.92 + 0.08 * Math.sin(T * 6.3 + s) + 0.04 * Math.sin(T * 15.7));
  } else if (sp === 'cores') {
    e.animLift = 0.03 * Math.sin(T * 1.8 + s);
  }
}

// ---------------------------------------------------------------- deaths
// Cache by source artwork, not by corpse: three collapse or eight special
// poses shared by every death of that species/view. No per-frame canvas work.
const DEATH_FRAMES = new WeakMap();
function animDeathSprite(e) {
  const source = e.deathArt;
  let poses = DEATH_FRAMES.get(source);
  if (!poses) { poses = new Map(); DEATH_FRAMES.set(source, poses); }
  const stage = e.deathStage || 0, key = e.dieStyle + ':' + stage;
  if (poses.has(key)) return poses.get(key);
  const w = source.w, h = source.h, data = new Uint32Array(w * h);
  // Repose the existing pixels into discrete silhouettes. Bespoke painted
  // collapse sheets can replace this pilot without changing the lifecycle.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = source.data[y * w + x]; if ((px >>> 24) < 100) continue;
    let dx = x, dy = y;
    if (e.dieStyle === 'fall') {
      const k = [0.28, 0.64, 1][Math.min(stage, 2)];
      dx = w * 0.5 + (x - w * 0.5) * (1 - k * 0.25) + (h - y) * k * 0.16;
      dy = h - 1 - (h - 1 - y) * (1 - k * 0.78);
    } else if (e.dieStyle === 'sink') dy = y + stage / 7 * h;
    else if (e.dieStyle === 'scatter') {
      // Each tile flies radially, leaving actual gaps rather than scaling
      // the entire swarm. Hash-based directions keep the sequence stable.
      const tileX = x >> 3, tileY = y >> 3;
      const angle = Math.atan2(tileY * 8 + 4 - h / 2, tileX * 8 + 4 - w / 2);
      const travel = stage * (2 + ((tileX * 7 + tileY * 13) % 4));
      dx += Math.cos(angle) * travel; dy += Math.sin(angle) * travel;
    }
    dx = Math.round(dx); dy = Math.round(dy);
    if (dx >= 0 && dy >= 0 && dx < w && dy < h) data[dy * w + dx] = px;
  }
  const frame = { w, h, data, hs: source.hs, cx: source.cx, dy: source.dy };
  poses.set(key, frame); return frame;
}
function animDying(e, dt) {
  e.dieT += dt; const k = Math.min(1, e.dieT / e.dieDur);
  animReset(e);
  e.deathStage = Math.min(e.dieStyle === 'fall' ? 2 : 7, Math.floor(k * (e.dieStyle === 'fall' ? 3 : 8)));
  if (e.dieStyle !== 'fall') {
    e.animAlpha = 1 - k;
    if (e.dieStyle === 'dissolve') { e.animLift = k * 0.25; e.animGlow = 0.6 * (1 - k); }
  }
  if (k >= 1) {
    e.dying = false;
    if (e.dieStyle === 'fall') { e.corpse = true; e.animAlpha = 1; }
    else e.dead = e.hidden = true;
  }
}
function animSpawnDeath(src) {
  if (!src || !src.sprite || !G.ents) return;
  const d = src.def || {}, big = !!d.boss;
  const cell = G.map && G.map.floorCells && G.map.floorCells[(src.y | 0) * G.map.w + (src.x | 0)];
  const floor = cell && G.map.floorTextures ? G.map.floorTextures[cell] : G.map && G.map.floor;
  const water = floor === 't_water' || floor === 't_shallows';
  const style = src.type === 'drowned' && water ? 'sink' : ANIM.flutter.has(src.sprite) ? 'scatter' : (d.cacophony && src.type !== 'drowned') || d.quiet || d.hushkin ? 'dissolve' : 'fall';
  const art = animDirectionalSprite(src);
  const ghost = { kind: 'deco', sprite: src.sprite, x: src.x, y: src.y, scale: src.scale, yOff: src.yOff, dying: true, transient: true, nopick: true, solid: false,
    dieT: 0, dieDur: big ? 1.4 : style === 'sink' ? 1.5 : 0.8, dieStyle: style, deathArt: art.sprite, deathStage: 0, animFlip: art.flip };
  animSeed(ghost); G.ents.push(ghost);
  return ghost;
}

// ---------------------------------------------------------------- particles (screen space, drawn over the view)
const PARTICLES = { list: [], mapId: null };
const PART_STYLE = {
  deepwoods: { n: 28, kind: 'leaf', colors: ['#8a4a1c', '#a8642a', '#6b3a18', '#c08a3a', '#7d5a2a'] },
  oakhaven: { n: 10, kind: 'leaf', colors: ['#6f6a3a', '#8a7a3a', '#5a5030'] },
  clearing: { n: 12, kind: 'leaf', colors: ['#6f6a3a', '#8a7a3a', '#5a5030'] },
  whispergrove: { n: 22, kind: 'mote', colors: ['#d8d2e8', '#bfb6d8', '#e8e0f0'] },
  mausoleum: { n: 16, kind: 'dust', colors: ['#9a8f80', '#b8ab96'] },
  catacombs: { n: 14, kind: 'dust', colors: ['#8a8070', '#a89a86'] },
  belfry: { n: 14, kind: 'dust', colors: ['#9a8f80', '#b8ab96'] },
  cloister: { n: 10, kind: 'dust', colors: ['#a89a86'] },
  malting: { n: 12, kind: 'dust', colors: ['#b8a47a', '#c8b48a'] },
  wickhouse: { n: 8, kind: 'dust', colors: ['#a89a86'] },
};
function partNew(st, anywhere) {
  const p = { x: Math.random() * VW, y: anywhere ? Math.random() * VIEW_H : (st.kind === 'mote' ? VIEW_H + 2 : -2), c: st.colors[(Math.random() * st.colors.length) | 0], ph: Math.random() * 6.28, z: 0.5 + Math.random() * 0.8 };
  if (st.kind === 'leaf') { p.vy = 9 + Math.random() * 9; p.vx = -4 + Math.random() * 8; }
  else if (st.kind === 'mote') { p.vy = -(3 + Math.random() * 4); p.vx = -2 + Math.random() * 4; }
  else { p.vy = -0.6 + Math.random() * 1.6; p.vx = -1.5 + Math.random() * 3; }
  return p;
}
function animParticles(dt, T) {
  const st = PART_STYLE[G.mapId]; const ctx = Engine.ctx;
  if (!st || G.state === 'title') return;
  if (PARTICLES.mapId !== G.mapId) { PARTICLES.mapId = G.mapId; PARTICLES.list = []; for (let i = 0; i < st.n; i++) PARTICLES.list.push(partNew(st, true)); }
  // turning the view slides the particles, so they sit in the world rather than on the glass
  let dd = Engine.cam.dir - ANIM.dirLast; ANIM.dirLast = Engine.cam.dir;
  if (dd > Math.PI) dd -= Math.PI * 2; if (dd < -Math.PI) dd += Math.PI * 2;
  const shift = -dd * 255;
  for (const p of PARTICLES.list) {
    p.ph += dt * (st.kind === 'leaf' ? 3 : 1.2);
    p.x += (p.vx + Math.sin(p.ph) * (st.kind === 'leaf' ? 10 : 2)) * dt * p.z + shift * p.z;
    p.y += p.vy * dt * p.z;
    if (p.x < -4) p.x += VW + 8; if (p.x > VW + 4) p.x -= VW + 8;
    if (p.y > VIEW_H + 3 || p.y < -4) Object.assign(p, partNew(st, false));
    ctx.fillStyle = p.c;
    if (st.kind === 'leaf') { const flat = Math.sin(p.ph * 1.7) > 0; ctx.globalAlpha = 0.85; ctx.fillRect(p.x | 0, p.y | 0, flat ? 2 : 1, flat ? 1 : 2); }
    else if (st.kind === 'mote') { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(p.ph * 2); ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
    else { ctx.globalAlpha = 0.18 + 0.14 * Math.sin(p.ph * 1.5); ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- per frame
function animFrame() {
  const now = performance.now() / 1000; const dt = Math.min(0.1, ANIM.last ? now - ANIM.last : 0.016); ANIM.last = now;
  ANIM.T += dt; ANIM.dt = dt; const T = ANIM.T; Engine.setTime(T);
  if (!G.ents) return;
  if (ANIM.ents !== G.ents) {
    // left a map: tidy away any death animations still playing there
    ANIM.ents = G.ents;
    for (const id in G.maps) { const L = G.maps[id].entities; if (L === G.ents) continue; for (let i = L.length - 1; i >= 0; i--) if (L[i].transient) L.splice(i, 1); }
  }
  const outdoor = G.map && G.map.outdoor;
  for (let i = G.ents.length - 1; i >= 0; i--) {
    const e = G.ents[i];
    if (e.transient && e.dead) { G.ents.splice(i, 1); continue; }
    if (!e.sprite || (e.hidden && !e.dying)) continue;
    if (e.kind === 'enemy' || e.kind === 'npc') animCreature(e, dt, T);
    else if (e.kind === 'deco') animDeco(e, dt, T, outdoor);
  }
}

// ---------------------------------------------------------------- hooks (load order: after game.js and party.js)
(() => {
  const _kill = killEnemy;
  killEnemy = function (e, byGlass) {
    if (!e || e.dead) return;
    const r = _kill(e, byGlass);
    animSpawnDeath(e);
    return r;
  };
  const _loadMap = loadMap;
  loadMap = function (id, pos) {
    if (G.ents) for (let i = G.ents.length - 1; i >= 0; i--) if (G.ents[i].transient) G.ents.splice(i, 1);
    return _loadMap(id, pos);
  };
  const _eRender = Engine.render;
  Engine.render = function (ents, tod, opts) { const r = _eRender(ents, tod, opts); try { animParticles(ANIM.dt || 0.016, ANIM.T); } catch (err) { /* never break a frame */ } return r; };
  const _render = render;
  render = function () { if (G.map) animFrame(); return _render(); };
})();
