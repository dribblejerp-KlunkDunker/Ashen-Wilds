// ============================================================
//  GAME — Echoes of the Shattered Octave: The Silenced Province
// ============================================================
'use strict';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const normAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

const G = {
  state: 'loading', maps: null, map: null, mapId: null, ents: [],
  player: null, flags: {}, journal: [], ledger: [], runs: 0,
  tod: 0.78, day: 0, hour: 18, time: 0,
  keys: {}, mouse: { down: false, rdown: false, x: 0, y: 0, sx: 0, sy: 0, t: 0 },
  attack: { t: 0, dur: 0, dirLabel: '' }, song: { t: 0 },
  noise: 2, stillT: 0, unwriting: false, rootWard: 0, glassLock: 0, murmurT: 0, whistleT: 0,
  escapeTimer: 0, hurtT: 0, songFx: 0, msgQueue: [], dead: false,
  fadeT: 0, bobPhase: 0, lastStep: 0, hint: '', openPanel: null,
  vel: { x: 0, y: 0 }, turnV: 0, touch: { fx: 0, fy: 0, run: false }, touchMode: false,
  give(id, n) { const it = ITEMS[id]; const slot = this.player.inv.find(s => s.id === id); if (slot && !it.key) slot.n += (n || 1); else this.player.inv.push({ id, n: n || 1 }); },
  has(id) { return this.player.inv.some(s => s.id === id); },
  count(id) { return this.player.inv.filter(s => s.id === id).reduce((a, s) => a + (s.n || 1), 0); },
  take(id) { const i = this.player.inv.findIndex(s => s.id === id); if (i >= 0) { this.player.inv[i].n--; if (this.player.inv[i].n <= 0) this.player.inv.splice(i, 1); } },
  gold(n) { this.player.gold += n; },
};

// ---------------------------------------------------------------- UI helpers
// enemy names in sentences: 'A Quiet' -> 'the Quiet', 'The Brood-Mother' stays
function theName(n, cap) { const b = /^(A|An|The) /.test(n) ? n.replace(/^(A|An|The) /, '') : n; return (cap ? 'The ' : 'the ') + b; }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function msg(text, cls, ttl) {
  const box = $('#msgs'); const el = document.createElement('div'); el.className = 'm' + (cls ? ' ' + cls : ''); el.textContent = text; box.appendChild(el);
  while (box.children.length > 5) box.removeChild(box.firstChild);
  setTimeout(() => el.classList.add('fade'), ttl || 5200); setTimeout(() => el.remove(), (ttl || 5200) + 700);
}
function journal(cat, text) { G.journal.unshift({ cat, text, day: G.day }); msg('Your logbook has been updated.', 'warn', 2500); Audio_.sfx.ui(); }
function openModal(html, name) { try { releaseMouse(); } catch (e) { /* not ready yet */ } G.panelToken = (G.panelToken || 0) + 1; $('#modal-panel').innerHTML = html; show('#modal'); G.openPanel = name; G.keys = {}; }
function closeModal() { hide('#modal'); G.openPanel = null; }
function fx(cls, ms) { const f = $('#fx'); f.className = cls; clearTimeout(f._t); f._t = setTimeout(() => { if (f.className === cls) f.className = ''; }, ms || 200); }

// ---------------------------------------------------------------- character creation
const CREATE = { step: 0, name: '', auto: '', cls: null, face: 1, bio: [], mods: {}, loreFrom: 0 };
function loreButton() { return '<button class="dfbtn small" id="c-lore">The world in 419 SR</button>'; }
function openLore() { if (CREATE.step === 0) { const n = $('#cname'); if (n) CREATE.name = cleanName(n.value); } CREATE.loreFrom = CREATE.step >= 0 ? CREATE.step : 0; CREATE.step = -1; renderCreate(); $('#create-panel').scrollTop = 0; }
// The traveller whole: the character card (js/card21.js) paints the chosen face in the calling's kit, head to boots.
// The portrait stays underneath for the simple card (Options > Graphics & access) or any page without the painter.
// head gear stays off the creation figure: a hood or a kettle helm would hide the very face being chosen
function creationArmor() { const armor = {}, c = CLASSES[CREATE.cls == null ? 0 : CREATE.cls]; for (const id of (CLASS_KIT[c.id] || [])) { const a = ARMOR[id]; if (a && a.slot && a.slot !== 'head') armor[a.slot] = id; } return armor; }
function creationLook() { const c = CLASSES[CREATE.cls == null ? 0 : CREATE.cls], i = Math.max(0, c.weapons.findIndex(w => w !== 'hands')); return { cls: c.id, face: CREATE.face, glassed: !!c.glass, glass: c.glass ? 42 : 0, armor: creationArmor(), weapons: c.weapons.slice(), weapon: i, attrs: {} }; }
function paintCreateFigure(root) {
  const wraps = (root || document).querySelectorAll ? (root || document).querySelectorAll('.fbfig') : [];
  for (const wrap of wraps) {
    const cv = wrap.querySelector('canvas'); if (!cv) continue;
    let ok = false;
    try {
      if (typeof CARD21 === 'object' && CARD21 && typeof CARD21.lookOf === 'function' && typeof CARD21.on === 'function' && CARD21.on()) {
        const L = CARD21.lookOf(creationLook());
        if (typeof CARD21.paint === 'function') CARD21.paint(L, { size: 'card', view: 0, display: true, breath: 0 });   // the whole paint, at once: the panel is about to be read
        if (typeof CARD21.drawCard === 'function') ok = CARD21.drawCard(cv, L, 0, 0) !== false;
      }
    } catch (e) { ok = false; }
    wrap.classList.toggle('fig-ok', ok);
  }
}
function renderCreate() {
  const p = $('#create-panel'); const s = CREATE.step;
  const wireLore = () => { const b = $('#c-lore'); if (b) b.onclick = openLore; };
  if (s === -1) {
    p.innerHTML = `<h2>The world in 419 SR</h2><button class="dfbtn small close" id="c-lore-top">Back</button><p class="muted">Autumn, 419 SR. The Reach is orchard country, and Oakhaven is a town inside a wall of thorn. Here is what a traveller is expected to know.</p>
    <div class="lorelist">${CREATION_LORE.map(e => `<section><h3>${e.title}</h3><p>${e.text}</p></section>`).join('')}</div>
    <div class="btns"><button class="dfbtn" id="c-lore-back">Back to creation</button></div>`;
    const leaveLore = () => { CREATE.step = CREATE.loreFrom >= 0 ? CREATE.loreFrom : 0; renderCreate(); };
    $('#c-lore-back').onclick = leaveLore;
    $('#c-lore-top').onclick = leaveLore;
    return;
  }
  if (s === 0) {
    // the likeness is a person with a name already: start from it, and let the traveller write over it
    const start = CREATION_FACES[CREATE.face - 1] || CREATION_FACES[0];
    if (!CREATE.name) { CREATE.name = start.name; CREATE.auto = start.name; }
    p.innerHTML = `<h2>Who are you, in the Narrow?</h2><p class="muted">Every soul in the Reach keeps its name close. The Catalogue would like to know yours.</p>
    <p><input id="cname" type="text" maxlength="24" placeholder="Your name" value="${CREATE.name}"></p>
    <div class="btns"><button class="dfbtn" id="c-next">Continue</button>${loreButton()}<button class="dfbtn" id="c-back">Back to title</button></div>`;
    $('#cname').focus();
    $('#c-next').onclick = () => { CREATE.name = cleanName($('#cname').value); CREATE.step = 1; renderCreate(); };
    $('#c-back').onclick = () => { hide('#create'); show('#title'); };
    $('#cname').onkeydown = (e) => { if (e.key === 'Enter') $('#c-next').click(); e.stopPropagation(); };
    wireLore();
  } else if (s === 1) {
    p.innerHTML = `<h2>Choose your calling</h2><div class="classpick"><div class="classlist">${CLASSES.map((c, i) => `<button class="dfbtn ${CREATE.cls === i ? 'sel' : ''}" data-i="${i}">${c.name}<small>${c.hz} · ${c.skills}</small></button>`).join('')}</div>
    <div id="cdesc" class="classdesc"></div></div><div class="btns classbtns"><button class="dfbtn" id="c-next" ${CREATE.cls == null ? 'disabled' : ''}>Continue</button><button class="dfbtn" id="c-back">Back</button></div>`;
    const descr = () => {
      if (CREATE.cls == null) { $('#cdesc').innerHTML = '<p class="muted">Pick a calling to read of it.</p><div class="classlore">' + loreButton() + '</div>'; return; }
      const c = CLASSES[CREATE.cls];
      $('#cdesc').innerHTML = `<div class="classdetail"><div><h3>Biography</h3><p>${c.bio}</p></div><div><h3>Summary</h3><p>${c.summary}</p><p class="muted">Health ${c.hp} · Voice ${c.voice} · Glass shot ×${c.pellets} · Songs: ${c.songs.map(s => SONGS[s].name).join(', ')}<br>Skills: ${c.skills}</p></div></div><div class="classlore">${loreButton()}</div>`;
    };
    descr();
    p.querySelectorAll('.classlist button').forEach(b => b.onclick = () => { CREATE.cls = +b.dataset.i; renderCreate(); Audio_.sfx.ui(); });
    $('#c-next').onclick = () => { CREATE.step = 2; renderCreate(); };
    $('#c-back').onclick = () => { CREATE.step = 0; renderCreate(); };
    wireLore();
  } else if (s === 2) {
    const f = CREATION_FACES[CREATE.face - 1] || CREATION_FACES[0];
    // the name follows the likeness while it is still the one the likeness gave: a written name is kept
    if (!CREATE.name || CREATE.name === 'Nameless' || CREATE.name === CREATE.auto) CREATE.name = f.name;
    CREATE.auto = f.name;
    p.innerHTML = `<h2>Choose your likeness</h2><p class="muted">The Catalogue keeps a traveller whole, boots to face.</p>
    <div class="faces">${CREATION_FACES.map(f => `<img src="img/face_${f.n}.jpg" data-i="${f.n}" class="${CREATE.face === f.n ? 'sel' : ''}" alt="${f.name}" title="${f.name}">`).join('')}</div>
    <div id="cfacebio" class="facebody">
      <div class="fbfig"><div class="fb-frame"><img src="img/face_${f.n}.jpg" alt="${f.name}"><canvas class="fb-canvas" width="176" height="352" role="img" aria-label="${f.name}, full figure"></canvas></div><p class="fb-name">${f.name}</p></div>
      <div class="fbtext"><p class="fb-sketch">${f.sketch}</p>
        <dl class="fb-facts">${f.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}<div class="wide"><dt>Says</dt><dd class="fb-says">${f.says}</dd></div></dl>
        <h3>History</h3><p>${f.history}</p><p>${f.detail}</p></div>
    </div>
    <div class="btns stick"><button class="dfbtn" id="c-next">Continue</button><button class="dfbtn" id="c-back">Back</button></div>`;
    paintCreateFigure(p);
    p.querySelectorAll('.faces img').forEach(im => im.onclick = () => { CREATE.face = +im.dataset.i; renderCreate(); Audio_.sfx.ui(); });
    $('#c-next').onclick = () => { CREATE.step = 3; CREATE.bio = []; renderCreate(); };
    $('#c-back').onclick = () => { CREATE.step = 1; renderCreate(); };
  } else if (s === 3) {
    const qi = CREATE.bio.length; const q = BIOGRAPHY[qi];
    p.innerHTML = `<h2>Biography · ${qi + 1} of ${BIOGRAPHY.length}</h2><p class="q">${q.q}</p><div class="list" style="margin-top:1cqh">${q.a.map((a, i) => `<button class="dfbtn" data-i="${i}">${a.t}</button>`).join('')}</div>`;
    p.querySelectorAll('.list button').forEach(b => b.onclick = () => { CREATE.bio.push(+b.dataset.i); Audio_.sfx.ui(); if (CREATE.bio.length >= BIOGRAPHY.length) { CREATE.step = 4; } renderCreate(); });
  } else {
    const c = CLASSES[CREATE.cls]; const attrs = Object.assign({}, c.attrs);
    const f = CREATION_FACES[CREATE.face - 1] || CREATION_FACES[0];
    for (let i = 0; i < CREATE.bio.length; i++) { const a = BIOGRAPHY[i].a[CREATE.bio[i]]; for (const k in a.mod) attrs[k] += a.mod[k]; }
    p.innerHTML = `<h2>${CREATE.name}, ${c.name}</h2><div class="row"><div class="col"><div class="fbfig tight"><div class="fb-frame"><img src="img/face_${CREATE.face}.jpg" alt="${f.name}"><canvas class="fb-canvas" width="176" height="352" role="img" aria-label="${f.name}, full figure"></canvas></div><p class="fb-name">${f.name}</p></div><p class="muted">${c.hz} · Level 1</p></div>
    <div class="col"><div class="attrs">${ATTRS.map(a => `<div><span>${a}</span><b>${attrs[a]}</b></div>`).join('')}</div>
    <p style="margin-top:1cqh">Health <b style="color:var(--gold)">${c.hp + Math.floor(attrs.Endurance / 10)}</b> · Voice <b style="color:var(--gold)">${c.voice + Math.floor(attrs.Willpower / 10)}</b> · Fatigue <b style="color:var(--gold)">${attrs.Strength + attrs.Endurance}</b></p>
    <p class="muted">${c.summary}</p></div></div>
    <div class="btns"><button class="dfbtn" id="c-go">Go up the Greenroot road</button><button class="dfbtn" id="c-back">Back</button></div>`;
    paintCreateFigure(p);
    $('#c-go').onclick = () => { CREATE.attrs = attrs; startGame(); };
    $('#c-back').onclick = () => { CREATE.step = 3; CREATE.bio = []; renderCreate(); };
  }
}

// ---------------------------------------------------------------- new game
function newPlayer() {
  const c = CLASSES[CREATE.cls]; const a = CREATE.attrs;
  const hpMax = c.hp + Math.floor(a.Endurance / 10), voiceMax = c.voice + Math.floor(a.Willpower / 10), fatMax = a.Strength + a.Endurance;
  return { name: CREATE.name, cls: c, face: CREATE.face, attrs: a, hp: hpMax, hpMax, voice: voiceMax, voiceMax, fat: fatMax, fatMax, gold: 12, pellets: c.pellets,
    inv: [], weapons: c.weapons.slice(), weapon: 0, songs: c.songs.slice(), glass: c.glass ? 42 : 0, glassed: c.glass, fragments: c.id === 'archivist' ? 3 : 0, xp: 0, level: 1, kills: 0,
    armor: {}, bolts: 0, horseUntil: 0, needs: false, hunger: 100, sleep: 100, hardcore: false };
}
// what each calling walks out of the door wearing
const CLASS_KIT = { blade: ['a_jerkin', 'a_gloves'], cantor: ['a_gambeson', 'a_softboots'], corsair: ['a_jerkin', 'a_buckler', 'a_hobnails'], archivist: ['a_hood', 'a_gambeson'], penitent: ['a_gambeson', 'a_kettle'], quarry: ['a_jerkin', 'a_hobnails', 'a_gloves'] };
function giveKit(p) { for (const id of (CLASS_KIT[p.cls.id] || [])) { p.inv.push({ id, n: 1 }); p.armor[ARMOR[id].slot] = id; } }
function startGame() {
  hide('#create'); G.player = newPlayer(); giveKit(G.player); G.flags = {}; G.journal = []; G.ledger = []; G.tod = 0.74; G.day = 0; G.escapeTimer = 0; G.dead = false; G.noise = 2;
  G.boreHold = 0; G.boreGolems = 0; G.glassLock = 0; G.webT = 0; G.rootWard = 0; G.murmurT = 0; G.whistleT = 0; G.stillT = 0; G.unwriting = false; G.hurtT = 0; G.songFx = 0; G.attack.t = 0; G.song.t = 0; G.keys = {};
  $('#msgs').innerHTML = ''; $('#view').classList.remove('unwrite'); ['#death', '#ending', '#event'].forEach(hide); closeModal();
  for (let i = 0; i < CREATE.bio.length; i++) G.flags[BIOGRAPHY[i].a[CREATE.bio[i]].flag] = true;
  G.throwReady = 0; G.dragBody = null; G.bodyScanT = 0; G.coverSuspicion = 0;
  G.lawGrace = 0;
  G.maps = buildAllMaps();
  journal('main', 'I came up the Greenroot road to Oakhaven on Nullday, autumn, 419 SR. The gate-warden will know where the Cantor lives.');
  // intro
  show('#intro'); const it = $('#intro-text'); it.innerHTML = '';
  INTRO.forEach((line, i) => { const pEl = document.createElement('p'); pEl.textContent = line; pEl.style.animationDelay = (i * 1.1) + 's'; it.appendChild(pEl); });
  G.state = 'intro';
  const go = () => { if (G.state !== 'intro') return; Audio_.music.preload(['combat', 'town']); hide('#intro'); loadMap('oakhaven'); G.state = 'play'; Audio_.setScene('town'); msg('Nullday. Dusk. Oakhaven, inside the Hedge.', 'warn', 6000); msg('Press H for help at any time.', '', 7000); if (!G.touchMode && G.opts.captureMouse) msg('Click the view to capture the mouse; Esc gives it back. Alt+Enter: full screen.', '', 9000); };
  $('#btn-intro-skip').onclick = (ev) => { ev.stopPropagation(); go(); };
  $('#intro').onclick = go;
}

// ---------------------------------------------------------------- maps
function hydrate(e) {
  varyNpcHeight(e);
  if (e._h) return e; e._h = true;
  if (e.kind === 'enemy') {
    const d = ENEMIES[e.type]; e.def = d; e.hp = d.hp; e.hpMax = d.hp; e.sprite = d.sprite; e.scale = d.scale || 1; e.yOff = d.yOff || 0; e.state = e.passive ? 'passive' : 'idle'; e.solid = true; e.radius = 0.35;
    e.homeX = e.x; e.homeY = e.y; e.cool = 0; e.stun = 0; e.fifthN = 0; e.wanderT = 0; e.name = e.name || (d.core ? NAMES_POOL[rndi(0, NAMES_POOL.length - 1)] : null); e.alertT = 0;
  }
  if (e.kind === 'npc') { e.homeX = e.x; e.homeY = e.y; e.wanderT = rnd(0, 3); e.dir = rnd(0, 6.28); }
  return e;
}
function loadMap(id, pos) {
  G.dragBody = null; G.bodyScanT = 0; G.coverSuspicion = 0;
  if (G.map) {
    for (const e of G.map.entities) if (e.investigation) { delete e.investigation; if (e.state === 'investigate') e.state = 'idle'; }
    for (let i = G.map.entities.length - 1; i >= 0; i--) if (G.map.entities[i].distractionT != null) G.map.entities.splice(i, 1);
  }
  syncWantedPosters();
  const m = G.maps[id]; G.map = m; G.mapId = id; G.ents = m.entities; m.entities.forEach(hydrate);
  for (const e of m.entities) { if (e.requires && !e.dead) e.hidden = !G.flags[e.requires]; if (e.until && G.flags[e.until]) e.hidden = true; if (e.drylamp) e.glow = G.flags.lamps_lit ? 0.65 : 0; if (e.id === 'halder' && G.flags.halder_rest) e.loop = false; }
  if (id === 'deepwoods' && typeof ringSync === 'function') { if (G.flags.coda_done && G.flags.ring_go && !G.flags.ring_fight) G.flags.ring_back = true; ringSync(); }
  Engine.setMap(m);
  const p = pos || m.spawn; Engine.cam.x = p.x; Engine.cam.y = p.y; Engine.cam.dir = p.dir || 0; Engine.cam.pitch = 0;
  settleFeet();
  G.stillT = 0; G.unwriting = false; $('#view').classList.remove('unwrite');
  Audio_.setScene(m.music);
  msg(m.name, 'warn', 3500);
  if (id === 'lyra_house' && G.flags.rite_started && !G.flags.lyra_taken_seen) { G.flags.lyra_taken_seen = true; msg('The hearth is cold. A proctor\'s seal is pasted over the shutter. They have taken her into the Church\'s protection.', 'bad', 8000); }
  if (id === 'catacombs') syncCatacombsPuzzles();
  G.fadeT = 0.5;
}
// The point of no return (R1): going down the shaft starts the Rite, closes the heists and, with the Greening, Oakhaven.
// Only threads the player has begun and not finished are listed; nothing here changes a flag.
function riteOpenThreads() {
  const f = G.flags, left = [];
  if (f.tam_met && !f.tam_told && !f.tam_left) left.push('Old Tam is still waiting for an honest answer by the Flume.');
  if (f.twins_found && !f.twins_named) left.push('The Fenning twins are not yet in your ledger.');
  if (typeof G.has === 'function' && G.has('boots') && !f.boots_delivered) left.push('Orla Hale\'s boots are still in your pack.');
  if (f.crates_heard && !f.vane_told) left.push('Vane has not been made to hear what is in his own hold.');
  if (f.p12f_q === 1) left.push('The Last Sheaf is still to be cut in the dead hour.');
  return left;
}
function riteWarning(portal) {
  const left = riteOpenThreads();
  showEvent('The shaft', 'The cage hangs over the dark, and the Pure Note comes up out of it. This is the Rite. Oakhaven will not be the same after tonight: the heists close, and when the Greening comes, the town goes with it.' + (left.length ? '<br><br>Still open:<br>' + left.join('<br>') : ''), [
    { t: 'Go down.', f: () => { G.riteOk = true; transfer(portal); } },
    { t: 'Not yet.', f: null },
  ]);
}
function transfer(portal) {
  if (G.mapId === 'watchhouse' && portal.map === 'oakhaven') { leaveWatchhouse(); return; }
  let pos = null; const target = G.maps[portal.map];
  if (portal.useSpawn === 'shaft' && target.shaftReturn) pos = target.shaftReturn;
  else if (portal.useSpawn === 'shaft' && target.named && target.named.shaft) { const s = target.named.shaft; pos = { x: s.cx + 0.5, y: s.cy + 1.2, dir: Math.PI / 2 }; }
  else if (portal.useSpawn) pos = target.spawn; else pos = { x: portal.x, y: portal.y, dir: portal.dir };
  // the Rite begins when you take the shaft down with the pass: say so first, once per attempt, and list what is still open
  if (portal.map === 'rootvault' && !G.flags.rite_started && !G.riteOk && typeof showEvent === 'function') { riteWarning(portal); return; }
  G.riteOk = false;
  if (portal.map === 'rootvault' && !G.flags.rite_started) { G.flags.rite_started = true; G.day = 10; G.tod = 0.42; journal('main', 'Hearthday. The Church holds the Pure Note over Oakhaven; the town hums the Root note under it, too quietly to punish. They have walked Lyra down in white. I go down by the shaft with the coil.'); }
  loadMap(portal.map, pos);
}

// ---------------------------------------------------------------- elevation
// The player's feet rest on the floor of whatever cell they are in, and the
// eye rides 0.88 above them: the standing eye of a one-tile person (the crown
// sits at 0.98). Flat maps keep feet at 0, exactly as before.
function settleFeet() {
  const c = Engine.cam, p = G.player;
  const feet = (G.map.lvls || G.map.smooth) ? G.map.groundAt(c.x, c.y) : 0;
  if (p) { p.feet = feet; p.fallV = 0; p.fallFrom = null; p.tumble = false; }
  c.z = feet + 0.88;
}

// ---------------------------------------------------------------- collision
function solidAt(x, y, self) {
  const m = G.map; const r = 0.24;
  // a rise taller than a step is a cliff face, not floor you can walk onto
  if (m.lvls || m.smooth) {
    const feet = self ? (typeof self.feet === 'number' ? self.feet : m.groundAt(self.x, self.y)) : (G.player && typeof G.player.feet === 'number' ? G.player.feet : 0);
    const g = m.groundAt(x, y);
    if (g - feet > STEP_UP) return true;
    // a slope steeper than a walker can climb is a cliff face going up;
    // going down it is allowed, and that is how you tumble off a crag
    if (m.smooth && g > feet + 0.02 && m.gradeAt(x, y) > MAX_GRADE) return true;
  }
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (m.isBlocked((x + dx) | 0, (y + dy) | 0)) return true;
  if (self && dist2(x, y, Engine.cam.x, Engine.cam.y) < 0.4) return true;
  for (const e of G.ents) { if (e === self || !e.solid || e.hidden || e.dead) continue; const rr = (e.radius || 0.3) + 0.22; if (dist2(x, y, e.x, e.y) < rr * rr) return true; }
  return false;
}
// the player's own mover: slides along walls, closes the gap to them, and eases around door-frame corners
function approachWall(o, dx, dy) { let lo = 0, hi = 1; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (solidAt(o.x + dx * m, o.y + dy * m, null)) hi = m; else lo = m; } return lo; }
function cornerAssist(o, perp, sign, step) {
  for (const off of [0.08, 0.16, 0.24, 0.32]) for (const sd of [-1, 1]) {
    const px = perp === 'x' ? o.x + sd * off : o.x, py = perp === 'y' ? o.y + sd * off : o.y;
    const fx = perp === 'y' ? px + sign * 0.12 : px, fy = perp === 'x' ? py + sign * 0.12 : py;
    if (!solidAt(px, py, null) && !solidAt(fx, fy, null)) {
      const n = Math.min(off, step * 0.9) * sd;
      if (perp === 'x') { if (!solidAt(o.x + n, o.y, null)) o.x += n; } else if (!solidAt(o.x, o.y + n, null)) o.y += n;
      return true;
    }
  }
  return false;
}
function playerMove(o, dx, dy) {
  let bx = false, by = false;
  if (dx) { if (!solidAt(o.x + dx, o.y, null)) o.x += dx; else { bx = true; o.x += dx * approachWall(o, dx, 0); } }
  if (dy) { if (!solidAt(o.x, o.y + dy, null)) o.y += dy; else { by = true; o.y += dy * approachWall(o, 0, dy); } }
  if (bx && !by && Math.abs(dx) > Math.abs(dy) * 1.5 && cornerAssist(o, 'y', Math.sign(dx), Math.abs(dx))) bx = false;
  else if (by && !bx && Math.abs(dy) > Math.abs(dx) * 1.5 && cornerAssist(o, 'x', Math.sign(dy), Math.abs(dy))) by = false;
  return { bx, by };
}
function moveWithSlide(o, dx, dy, self) {
  let moved = false;
  if (!solidAt(o.x + dx, o.y, self)) { o.x += dx; moved = true; }
  if (!solidAt(o.x, o.y + dy, self)) { o.y += dy; moved = true; }
  return moved;
}
// Feet height of an entity or the player on raised and sloped ground (0 on flat maps).
function feetOf(e) {
  const m = G.map; if (!m || (!m.lvls && !m.smooth)) return 0;
  if (e === G.player || e === Engine.cam) return G.player && typeof G.player.feet === 'number' ? G.player.feet : m.groundAt(Engine.cam.x, Engine.cam.y);
  return m.groundAt(e.x, e.y);
}
// Melee needs both fighters on roughly the same level: nobody swings a sword up a 1.8 gallery.
const MELEE_RISE = 0.7;
function los(ax, ay, bx, by) {
  const d = Math.sqrt(dist2(ax, ay, bx, by)); const n = Math.ceil(d / 0.2); const sx = (bx - ax) / n, sy = (by - ay) / n;
  const m = G.map, raised = !!(m.lvls || m.smooth);
  // eye heights at both ends: a knee-high wall or railing below both of them does not block sight
  const eyeLo = raised ? Math.min(m.groundAt(ax, ay), m.groundAt(bx, by)) + 0.88 : 0.88;   // the standing eye
  let x = ax, y = ay;
  for (let i = 0; i < n; i++) {
    x += sx; y += sy;
    if (!m.isSolidCell(x | 0, y | 0)) continue;
    const c = m.get(x | 0, y | 0);
    if (c && !c.door && c.top != null && c.top < eyeLo - 0.05) continue;
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- noise / the Narrow
function addNoise(n) { G.noise = clamp(G.noise + n, 0, 10); }
function updateNarrow(dt, moving, running) {
  const p = G.player;
  const an = armorNoise();
  let floor = moving ? (running ? 4.2 + an * 1.3 : 2.4 + an) : 1.0;
  if (G.murmurT > 0) { floor = Math.max(floor, 2.6); G.murmurT -= dt; }
  if (G.whistleT > 0) { floor = Math.max(floor, 2.2); G.whistleT -= dt; }
  // decay toward floor
  if (G.noise > floor) G.noise = Math.max(floor, G.noise - dt * 1.4); else G.noise = Math.min(floor, G.noise + dt * 3);
  // the Hush
  if (G.map.siphoned && G.noise < 1.5 && G.whistleT <= 0 && !(G.boreHold > 0) && !G.escapeTimer) { G.stillT += dt; } else { G.stillT = Math.max(0, G.stillT - dt * 2); }
  const was = G.unwriting; G.unwriting = G.stillT > 7;
  if (G.unwriting && !was) msg('You are too still. Something leans in. Your fingertips are going cold. Move, or murmur (N).', 'bad');
  if (G.unwriting) { p.hp -= dt * 0.8; $('#view').classList.add('unwrite'); if (p.hp <= 0) die('unwrite'); }
  else if (was) $('#view').classList.remove('unwrite');
  // the hounds
  if (G.map.danger > 0 && G.noise > 7 && Math.random() < dt * 0.35 * G.map.danger) spawnHound();
}
function spawnHound() {
  const alive = G.ents.filter(e => e.kind === 'enemy' && e.type === 'hound' && !e.dead).length; if (alive >= 5) return;
  const c = Engine.cam;
  for (let i = 0; i < 20; i++) {
    const a = rnd(0, 6.28), d = rnd(5, 9); const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (x < 1 || y < 1 || x >= G.map.w - 1 || y >= G.map.h - 1 || solidAt(x, y)) continue;
    const base = G.map.baseCount != null ? G.map.baseCount : G.ents.length; for (let j = G.ents.length - 1; j >= base; j--) if (G.ents[j].dead && G.ents[j].type === 'hound') G.ents.splice(j, 1);
    const e = hydrate({ kind: 'enemy', type: 'hound', x, y }); e.state = 'chase'; G.ents.push(e); msg('Something has heard you. A jitter in the air, like heat-haze with teeth.', 'bad'); Audio_.sfx.hound(); return;
  }
}

// ---------------------------------------------------------------- throwable distractions
const DISTRACTIONS = {
  pebble: { name: 'Skipping stone', reach: 5, hearing: 7, duration: 6 },
  empty_bottle: { name: 'Empty glass bottle', reach: 7, hearing: 11, duration: 9 },
};
function distractionImpact(id) {
  const spec = DISTRACTIONS[id]; if (!spec || !G.map) return null;
  const c = Engine.cam, dx = Math.cos(c.dir), dy = Math.sin(c.dir);
  let point = null;
  for (let d = 0.3; d <= spec.reach; d += 0.1) {
    const x = c.x + dx * d, y = c.y + dy * d;
    if (G.map.isSolidCell(Math.floor(x), Math.floor(y)) || G.ents.some(e => e.solid && !e.dead && !e.hidden && dist2(x, y, e.x, e.y) < (e.radius || 0.3) ** 2)) break;
    point = { x, y, distance: d };
  }
  return point && point.distance >= 0.7 ? point : null;
}
function updateInvestigation(e, dt) {
  const target = e.investigation;
  if (!target || e.state !== 'investigate') return false;
  target.left -= dt;
  const dx = target.x - e.x, dy = target.y - e.y, distance = Math.hypot(dx, dy);
  if (target.left <= 0) { delete e.investigation; e.state = 'idle'; return false; }
  if (distance > 0.6) {
    e.facing = Math.atan2(dy, dx);
    moveWithSlide(e, dx / distance * (e.lawGuard ? 1.6 : e.def.speed) * dt, dy / distance * (e.lawGuard ? 1.6 : e.def.speed) * dt, e);
  }
  return true;
}
function throwDistraction(id) {
  if (G.state !== 'play' || G.dead || !DISTRACTIONS[id]) return false;
  if (!G.has(id)) { msg('You have none of those left. Find loose stones or empty bottles.', 'warn'); return false; }
  if (G.time < (G.throwReady || 0)) { msg('Let the last throw land before throwing again.', 'warn', 1600); return false; }
  const point = distractionImpact(id), spec = DISTRACTIONS[id];
  if (!point) { msg('Not enough room to throw. Aim away from the nearby wall or person.', 'warn'); return false; }
  exposeDisguise('A patrol sees you throw a distraction.');
  G.take(id); G.throwReady = G.time + 0.75;
  let heard = 0;
  for (const e of G.ents) {
    const enemy = e.kind === 'enemy' && e.def && !e.def.boss && !e.def.wildsBoss && !['wearer', 'weaver', 'pressman', 'aegis', 'horn'].includes(e.type);
    if ((!e.lawGuard && !enemy) || e.dead || e.hidden || e.passive || e.state === 'passive' || e.state === 'chase' || e.investigation?.source === 'body' || e.stun > 0) continue;
    if (e.lawGuard && crimeState().bounty && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 196 && los(e.x, e.y, Engine.cam.x, Engine.cam.y)) continue;
    const range = spec.hearing * (los(e.x, e.y, point.x, point.y) ? 1 : 0.35);
    if (dist2(e.x, e.y, point.x, point.y) > range * range) continue;
    e.investigation = { x: point.x, y: point.y, left: spec.duration };
    e.state = 'investigate'; heard++;
  }
  G.ents.push({ kind: 'deco', sprite: 'loot', x: point.x, y: point.y, scale: 0.18, glow: 0.85, solid: false, nopick: true, transient: true, distractionT: 1.2 });
  // Impact sound does not raise noise at the thrower's location or deal damage.
  if (id === 'empty_bottle') Audio_.sfx.crack(); else Audio_.sfx.step('stone');
  msg(`${spec.name}: ${id === 'empty_bottle' ? 'glass breaks' : 'stone clatters'} ${point.distance.toFixed(1)} paces ahead. ${heard ? 'Nearby listeners turn toward the impact.' : 'No idle listener reacts.'}`, 'warn', 4000);
  return true;
}
function openDistractions() {
  if (G.state !== 'play' || G.dead) return;
  const map = G.map; G.state = 'panel'; G.touch.fx = G.touch.fy = 0;
  openModal(`<h2>A noise elsewhere</h2><p>Throw along your current aim. Walls and solid bodies stop the throw; it never deals damage. Bottles carry farther than stones. Idle guards and ordinary enemies investigate for a few seconds, but visible threats, active combat and bosses take priority.</p>
  <p class="muted">Empty bottles are separate from Vox-Bottles. Aim before opening; inspection costs nothing.</p>
  <div class="btns">${Object.entries(DISTRACTIONS).map(([id, spec], i) => `<button class="dfbtn" id="throw-${id}" ${!G.has(id) ? 'disabled' : ''}>${i + 1}. ${spec.name} (${G.count(id)})</button>`).join('')}<button class="dfbtn" id="throw-leave">Keep them</button></div><p class="muted">1 stone · 2 bottle · Escape leaves. Controller: A stone, X bottle, B leaves.</p>`, 'distractions');
  const leave = () => { closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0; if (!G.dead) G.state = 'play'; };
  $('#throw-leave').onclick = leave;
  for (const id of Object.keys(DISTRACTIONS)) $('#throw-' + id).onclick = () => {
    if (G.openPanel !== 'distractions') return;
    const valid = G.map === map && !G.dead; leave(); if (valid) throwDistraction(id);
  };
}
function tickDistractions(dt) {
  for (let i = G.ents.length - 1; i >= 0; i--) if (G.ents[i].distractionT != null) {
    G.ents[i].distractionT -= dt;
    if (G.ents[i].distractionT <= 0) G.ents.splice(i, 1);
  }
}

// ---------------------------------------------------------------- bodies (current-visit visuals, never saved as loot or enemies)
function bodyReachable(body) {
  const c = Engine.cam;
  return !!(body && body.corpse && !body.dead && (!body.hidden || body.stashedIn) && G.ents.includes(body) &&
    dist2(c.x, c.y, body.x, body.y) <= 1.8 ** 2 && los(c.x, c.y, body.x, body.y));
}
function bodyTarget() {
  if (bodyReachable(G.dragBody)) return G.dragBody;
  const c = Engine.cam;
  let best = null, distance = Infinity;
  for (const body of G.ents) {
    const d = dist2(c.x, c.y, body.x, body.y);
    if (d < distance && bodyReachable(body) && Math.abs(normAng(Math.atan2(body.y - c.y, body.x - c.x) - c.dir)) < 0.85) { best = body; distance = d; }
  }
  return best;
}
function bodyCover(body) {
  return G.ents.find(e => e.bodyCover && !e.dead && !e.hidden &&
    dist2(e.x, e.y, body.x, body.y) <= 1.5 ** 2 && los(body.x, body.y, e.x, e.y) &&
    dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) <= 2.2 ** 2 && los(Engine.cam.x, Engine.cam.y, e.x, e.y));
}
function openBody() {
  if (G.state !== 'play' || G.dead) return;
  const body = bodyTarget();
  if (!body) { msg('Face a settled body within reach. Only physical remains can be moved.', 'warn'); return; }
  const map = G.map, cover = bodyCover(body), carried = G.dragBody === body;
  G.state = 'panel'; G.touch.fx = G.touch.fy = 0;
  openModal(`<h2>What the patrol will find</h2><div class="body-study"><b>${body.stashedIn ? 'CONCEALED' : carried ? 'DRAGGING' : body.bodyFound ? 'DISCOVERED' : 'EXPOSED'}</b><p role="status">${body.stashedIn ? 'The shroud hides this body from patrols. Recovering it leaves it exposed again.' : carried ? 'You move at half walking speed, without sprinting. Walls, water and solid bodies stop the drag.' : 'A visible body can raise one local alarm. Loot has already fallen separately; moving it grants no reward.'}</p></div>
  <p>${cover ? 'A shrouded recess is close enough to conceal the body.' : 'Drag toward a marked shrouded recess, then conceal it there. Distractions can buy time.'}</p>
  <div class="btns"><button class="dfbtn" id="body-drag">${body.stashedIn ? 'Recover and drag' : carried ? 'Drop body' : 'Drag body'}</button><button class="dfbtn" id="body-hide" ${body.stashedIn || !cover ? 'disabled' : ''}>Conceal in recess</button><button class="dfbtn" id="body-leave">Leave unchanged</button></div><p class="muted">Enter / controller A: drag or drop · H / controller X: conceal · Escape / B: leave. G / touch Body / left-stick click reopens. Remains and alarms last only for this area visit.</p>`, 'body');
  const leave = () => { closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0; if (!G.dead) G.state = 'play'; };
  const valid = () => G.openPanel === 'body' && G.map === map && !G.dead && bodyReachable(body);
  $('#body-leave').onclick = leave;
  $('#body-drag').onclick = () => {
    if (!valid()) return;
    if (carried) G.dragBody = null;
    else { body.hidden = false; delete body.stashedIn; G.dragBody = body; }
    G.vel.x = G.vel.y = 0; leave();
    msg(carried ? 'You let the body rest. It is exposed.' : 'You take hold. Walk slowly; G opens drop and conceal actions.', 'warn');
  };
  $('#body-hide').onclick = () => {
    if (!valid() || body.stashedIn) return;
    const recess = bodyCover(body); if (!recess) return;
    body.x = recess.x; body.y = recess.y; body.hidden = true; body.stashedIn = recess;
    G.dragBody = null; leave(); msg('You draw the shroud over the body. Patrols cannot see it here.', 'good');
  };
}
function bodyPatrol(e) {
  return !e.dead && !e.hidden && !e.passive && e.state !== 'passive' && !(e.stun > 0) &&
    (e.lawGuard || (e.kind === 'enemy' && e.def && !e.def.boss && !e.def.wildsBoss && (e.def.core || ['marine', 'outrider', 'warden', 'captain', 'deacon'].includes(e.type))));
}
function tickBodies(dt) {
  const body = G.dragBody, c = Engine.cam;
  if (body) {
    if (!bodyReachable(body) || body.hidden) G.dragBody = null;
    else {
      // Keep the body on its side of obstacles, including closed doors and water.
      const distance = Math.hypot(c.x - body.x, c.y - body.y), travel = Math.max(0, distance - 0.8);
      if (travel > 0) {
        const nx = (c.x - body.x) / distance, ny = (c.y - body.y) / distance;
        for (let moved = 0; moved < travel; moved += 0.1) {
          const step = Math.min(0.1, travel - moved), x = body.x + nx * step, y = body.y + ny * step;
          if (solidAt(x, y, null)) break;
          body.x = x; body.y = y;
        }
      }
    }
  }
  G.bodyScanT = (G.bodyScanT || 0) - dt; if (G.bodyScanT > 0) return; G.bodyScanT = 0.25;
  const bodies = G.ents.filter(e => e.corpse && !e.dead && !e.hidden);
  if (!bodies.length) return;
  const patrols = G.ents.filter(bodyPatrol);
  for (const remains of bodies) {
    const witness = patrols.find(e => dist2(e.x, e.y, remains.x, remains.y) < 36 && los(e.x, e.y, remains.x, remains.y));
    if (!witness) continue;
    if (G.dragBody === remains && !remains.dragReported && G.mapId === 'oakhaven' && !G.flags.greening &&
      patrols.some(e => e.lawGuard && dist2(e.x, e.y, c.x, c.y) < 36 && los(e.x, e.y, remains.x, remains.y) && los(e.x, e.y, c.x, c.y))) {
      remains.dragReported = true;
      reportCrime('dragging a body', 20);
      msg('The constable sees you dragging a body. +20 Oakhaven bounty.', 'bad', 5000);
    }
    if (remains.bodyFound) continue;
    remains.bodyFound = true;
    for (const e of patrols) {
      if (e.state === 'chase' || dist2(e.x, e.y, witness.x, witness.y) > 100 || !los(e.x, e.y, witness.x, witness.y)) continue;
      e.investigation = { x: remains.x, y: remains.y, left: 12, source: 'body' }; e.state = 'investigate';
    }
    Audio_.sfx.bell(); msg('A patrol finds a body and sounds the alarm. Nearby idle patrols search the discovery site.', 'bad', 5500);
  }
}

// ---------------------------------------------------------------- Synod cover: ordinary clothing, not faction immunity
function synodInspector(e) {
  return e.kind === 'enemy' && ['proctor', 'legionnaire'].includes(e.type) && e.def && !e.def.boss && !e.def.wildsBoss && !e.dead && !e.hidden && !e.passive && e.state !== 'passive' && !(e.stun > 0);
}
function wearingDisguise() { return isWorn('a_synodrobe') && G.has('a_synodrobe'); }
function disguiseKey() { return 'disguise:exposed:' + G.mapId; }
function disguiseExposed() { return G.flags[disguiseKey()] === true; }
function disguiseWitness() {
  const c = Engine.cam;
  return G.ents.some(e => (synodInspector(e) || (e.lawGuard && !e.dead && !e.hidden)) &&
    dist2(e.x, e.y, c.x, c.y) < 49 && los(e.x, e.y, c.x, c.y));
}
function exposeDisguise(reason, force = false) {
  if (!wearingDisguise() || disguiseExposed() || (!force && !disguiseWitness())) return;
  G.flags[disguiseKey()] = true; G.coverSuspicion = 3;
  for (const e of G.ents) if (synodInspector(e) && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 49 && los(e.x, e.y, Engine.cam.x, Engine.cam.y)) {
    delete e.investigation; e.state = 'chase'; e.alertT = 8;
  }
  msg(reason + ' Your cover is exposed in this area, even after changing clothes or reloading.', 'bad', 6000);
}
function tickDisguise(dt) {
  if (!wearingDisguise() || disguiseExposed()) { if (!wearingDisguise()) G.coverSuspicion = 0; return; }
  const close = G.ents.some(e => synodInspector(e) && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 2.4 ** 2 && los(e.x, e.y, Engine.cam.x, Engine.cam.y));
  G.coverSuspicion = clamp((G.coverSuspicion || 0) + (close ? dt * (G.noise >= 4 ? 2 : 1) : -dt * 0.75), 0, 3);
  if (G.dragBody) exposeDisguise('A patrol sees you dragging a body.');
  if (G.coverSuspicion >= 3) exposeDisguise('The clerk cannot answer the inspection. The patrol recognizes an intruder.', true);
}
function disguiseProtects(e) {
  return wearingDisguise() && !disguiseExposed() && synodInspector(e) && e.state !== 'chase' && e.investigation?.source !== 'body';
}
function disguiseStatus() {
  if (!wearingDisguise()) return 'No cover · wear Synod Clerk Robes';
  if (disguiseExposed()) return 'EXPOSED · patrols know you in this area';
  const suspicion = Math.ceil((G.coverSuspicion || 0) / 3 * 100);
  return suspicion ? `INSPECTION ${suspicion}% · back away to lower suspicion` : 'COVERED · distant Synod patrols accept the robes';
}
function openDisguise() {
  if (G.state !== 'play' || G.dead) return;
  const map = G.map; G.state = 'panel'; G.touch.fx = G.touch.fy = 0;
  openModal(`<h2>The borrowed registry</h2><div class="cover-study"><b>${disguiseStatus()}</b><p>Ordinary Proctors and Legionnaires accept the robes at a distance. Within 2.4 paces of clear sight they inspect you: three seconds exposes you, faster at noise 4+. Back away or break sight to lower suspicion.</p></div>
  <p>Witnessed attacks, loud or offensive Songs, throws, dragging bodies or putting on the robes break cover for this area. Exposure is saved; changing clothes cannot erase it. Monsters, bosses, active combat, body-alarm searches, story locks and watch bounties are not fooled.</p>
  <p class="muted">Buy robes from Abner Fenning. Only the body slot changes; your other gear stays on.</p><div class="btns"><button class="dfbtn" id="cover-wear" ${!G.has('a_synodrobe') ? 'disabled' : ''}>${wearingDisguise() ? 'Remove robes' : 'Wear robes'}</button><button class="dfbtn" id="cover-leave">Keep current clothes</button></div><p class="muted">Enter / Space / controller A: wear or remove · Escape / B: leave. Inspection pauses while panels are open.</p>`, 'disguise');
  const leave = () => { closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0; if (!G.dead) G.state = 'play'; };
  $('#cover-leave').onclick = leave;
  $('#cover-wear').onclick = () => {
    if (G.openPanel !== 'disguise' || G.map !== map || G.dead || !G.has('a_synodrobe')) return;
    if (wearingDisguise()) removeArmor('body'); else equipArmor('a_synodrobe');
    leave();
  };
}

// ---------------------------------------------------------------- enemies
function enemyUpdate(e, dt) {
  const p = G.player, c = Engine.cam, d = e.def;
  if (e.dead || e.hidden) return;
  if (e.stun > 0) { e.stun -= dt; e.flash = (e.stun % 0.3) < 0.1; return; } else e.flash = false;
  if (e.state === 'passive') return;
  const dx = c.x - e.x, dy = c.y - e.y, dist = Math.sqrt(dx * dx + dy * dy);
  if (disguiseProtects(e)) {
    if (e.state === 'investigate') updateInvestigation(e, dt);
    return;
  }
  const canSee = dist < 7 * (UPG.weatherFx ? UPG.weatherFx.sight : 1) && los(e.x, e.y, c.x, c.y);
  const hearRange = (1.5 + G.noise * (d.noiseLure ? 1.4 : 0.8) + (G.flags.thread_kept && d.cacophony ? 0.8 : 0)) * (UPG.weatherFx ? UPG.weatherFx.hear : 1);
  if (e.state === 'investigate') {
    if ((canSee && dist < 5) || dist < hearRange) { delete e.investigation; e.state = 'idle'; }
    else if (updateInvestigation(e, dt)) return;
  }
  if (e.state === 'idle') {
    if ((canSee && dist < 5) || (dist < hearRange && !e.guard) || (e.guard && canSee && dist < 4)) { e.state = 'chase'; if (d.shriek) drownedShriek(e); Audio_.sfx.enemy(d, 'alert'); }
    else if (!e.guard) { e.wanderT -= dt; if (e.wanderT <= 0) { e.wanderT = rnd(1, 4); e.wdir = rnd(0, 6.28); } if (dist2(e.x, e.y, e.homeX, e.homeY) < 9 && e.wanderT > 1.5) moveWithSlide(e, Math.cos(e.wdir) * d.speed * 0.3 * dt, Math.sin(e.wdir) * d.speed * 0.3 * dt, e); }
    return;
  }
  // chase
  if (e.state === 'chase') {
    e.alertT = canSee ? 8 : e.alertT - dt;
    if (e.alertT <= 0 && dist > 9) { e.state = 'idle'; return; }
    // hounds will not touch the glassed; Root Note wards them
    if (d.mimic || d.summon || d.horn || d.grapnel || d.dirge || d.wilds) enemyExtra(e, dt, dist, canSee);
    const glassFear = d.cacophony && !d.fearless && ((p.glassed && G.glassLock <= 0) || G.rootWard > 0);
    if (glassFear) { if (dist < 3.5) { moveWithSlide(e, -dx / dist * d.speed * dt, -dy / dist * d.speed * dt, e); } return; }
    // a foe on a gallery above or a pit below cannot be struck: close in (pathing finds the stair) instead
    const outOfLevel = Math.abs(feetOf(e) - feetOf(p)) > MELEE_RISE;
    if (dist > d.reach || outOfLevel) {
      // telegraph for golem
      let sp = d.speed; if (e.type === 'golem' && e.cool > 0) sp *= 0.3; if (e.slowed) sp *= 0.6;
      const nx = dx / dist, ny = dy / dist;
      if (!moveWithSlide(e, nx * sp * dt, ny * sp * dt, e) || (!canSee && e.alertT < 7)) {
        // try sidestep
        const side = Math.random() < 0.5 ? 1 : -1; moveWithSlide(e, -ny * side * sp * dt, nx * side * sp * dt, e);
      }
    } else {
      e.cool -= dt;
      if (e.cool <= 0) {
        e.cool = e.type === 'golem' ? 2.2 : (d.cacophony ? 1.1 : 1.5);
        // hit roll vs agility
        const AR = armorRating();
        const dodge = p.attrs.Agility / 400 + (p.cls.id === 'corsair' ? 0.08 : 0) + AR * (d.cacophony ? 0.003 : 0.008);
        if (Math.random() > dodge) {
          let dmg = rndi(d.dmg[0], d.dmg[1]);
          const soak = Math.floor(AR / (d.cacophony ? 9 : 4) * (0.6 + Math.random() * 0.4)); // static goes through steel; steel stops steel
          if (soak > 0) dmg = Math.max(1, dmg - soak);
          if (d.press && p.glassed) { G.glassLock = 8; msg('The proctor strikes your glass with a hand-press tuned to 741. Your arm locks rigid, ringing flat.', 'bad'); Audio_.sfx.press(); }
          Audio_.sfx.enemy(d, 'attack');
          damagePlayer(dmg, d.name);
          if (d.chord && !G.dead && Math.random() < 0.45) chordBlast(e);
          if (!G.dead && (d.web || d.forget || d.toll || d.mute || d.moth)) enemyHitFx(e, d);
        } else msg(AR >= 6 && Math.random() < 0.5 ? `${theName(d.name, true)}'s blow skids off your armour.` : `You slip ${theName(d.name, false)}'s blow.`, '', 1800);
        if (d.quiet) Audio_.sfx.quiet();
        if (d.cacophony) addNoise(0.8);
      }
    }
  }
}
function damagePlayer(dmg, src) {
  const p = G.player; p.hp -= dmg; G.hurtT = 0.25; fx('hurt', 220); Audio_.sfx.hurt();
  msg(`${src} hits you for ${dmg}.`, 'bad', 2200);
  if (p.hp <= 0) die(src);
}
function killEnemy(e, byGlass) {
  e.dead = true; e.solid = false; e.hidden = true; G.player.kills++; G.player.xp += e.def.xp;
  if (e.def.core && e.name) {
    Audio_.sfx.bellDie();
    G.ledger.push({ name: e.name, where: G.map.name, day: G.day });
    msg(`The bell goes still. Inside it, a voice says: "${e.name}." Three times. Then nothing.`, 'voice', 7000);
    if (!G.has('core') && e.name === 'Tamsin Reed') { G.give('core'); msg('You take the cracked lilac core.', 'good'); }
  } else if (e.def.cacophony) { msg(`${theName(e.def.name, true)} bursts, and everything it ever ate comes out at once.`, 'good', 4000); }
  else msg(`${theName(e.def.name, true)} is destroyed.`, 'good', 3000);
  if (byGlass && e.def.cacophony) { const p = G.player; p.hp = Math.min(p.hpMax, p.hp + 4); p.glass = Math.min(100, p.glass + 3); fx('glass', 400); msg('The glass drinks what it broke. The ring is fuller. The tideline climbs.', 'warn'); if (p.glass >= 100) die('heartglass'); }
  dropLoot(e);
  if (e.type === 'aegis') aegisDestroyed(e);
  if (e.type === 'weaver' || e.type === 'pressman') wgBossDown(e);
  if (e.type === 'bosun' || e.type === 'horn' || e.type === 'requiem' || e.type === 'wearer_coda' || e.type === 'broodmother') codaBossDown(e);
  if (e.def.wildsBoss) wildsBossDown(e);
  if (e.type === 'wearer') G.flags.wearer_dead = true;
  if (e.onDeath) e.onDeath();
  checkLevel();
}
function checkLevel() {
  const p = G.player; const need = Math.floor(60 * Math.pow(p.level, 1.5));
  if (p.xp >= need) { p.level++; p.xp -= need; const h = 4 + Math.floor(p.attrs.Endurance / 20), v = 2 + Math.floor(p.attrs.Willpower / 20);  p.hpMax += h; p.hp += h; p.voiceMax += v; p.voice += v; msg(`You have learned enough from your travels to reach level ${p.level}.`, 'good', 6000); Audio_.sfx.pickup();
    ensurePlayerUpgrades(p);
    if (p.level % 2 === 0) { p.perkPoints++; msg(`You have grown quiet enough to fast on the root for a moment. Perk point earned (${p.perkPoints} available).`, 'good', 6000); }
    if (UPG.difficulty === 'narrative') { p.hp = Math.min(p.hpMax, p.hp + 12); p.voice = Math.min(p.voiceMax, p.voice + 8); }
  }
}

function questXp(n) { G.player.xp += n; checkLevel(); }
// Sable reads a Hollow's name back out of the Bound Ledger. It costs her a fragment.
function sableReturn(g, accused) {
  const f = g.flags; f.sable_done = true; f.sable_returned = true; if (accused) f.sable_accused = true;
  const q = g.maps && g.maps.quarry; if (q) for (const e of q.entities) if (e.restore === 'hew') { e.name = 'Hew Callan, pump-man'; }
  questXp(80);
  journal('side', "Umber read a name back out of the Veil's Loose Leaves: Hew Callan, pump-man of Depot Two, the Hollow at the pumps in the quarry. It cost her the scriptorium bell. I should go and find him.");
  return (accused ? "\"Yes,\" she says. Only that. She does not argue, which is worse. " : '') + "She opens the leaves. The pages are thin as onion-skin and every line is a name. She finds the place without looking. \"Leaf nine thousand and six. Hew Callan. Pump-man, Depot Two. Thirty-one. Married to nobody. Owes Mags Harker four sovereigns and a Dawnday supper.\" She reads it aloud, all of it, and somewhere under your feet, far down, a pump changes its rhythm. Then she sits very still. \"A bell,\" she says, after a while. \"Small, and cracked, rung over fourteen desks at the hour before matins. I am told it was. I no longer know what that means.\" She closes the leaves. \"Two left. Go and tell him. Somebody should be there when he finds out what year it is.\"";
}
function talkHew(e) {
  const f = G.flags;
  if (f.hew_thanked) { msg('Hew Callan sits by the pumps, saying his own name under his breath, to keep it.', 'voice', 5000); return; }
  f.hew_thanked = true; G.state = 'event';
  showEvent('Hew Callan', "The Hollow at the pumps has stopped counting. He is looking at his hands as if somebody has just handed them to him. \"Hew,\" he says. \"Hew Callan. Pump-man. Depot Two.\" His voice is rusty, as if it has not been his for a long time. \"I told Mags I'd be home by Dawnday. What day is it?\" You tell him the year as well. He takes that the way a man takes a blow he saw coming. Then he digs in his coat and presses something into your hand: his pump-shift purse, and a brass gear off the old engine. \"For the lamp-money. And for the scribe, if you see her. Tell her — no. I'll tell her. I owe her a name.\"", [
    { t: 'Take it, and tell him where Mags will be.', f: () => { G.player.gold += 20; gainItem('v_gear'); questXp(40); Audio_.sfx.pickup(); msg('You take 20 sovereigns and a Brass Governor-Gear.', 'good', 4000); journal('side', "Hew Callan is himself again, at the pumps in the quarry. He gave me his shift purse and a brass gear, and asked after Mags."); } },
    { t: 'Keep your purse. Go home to her.', f: () => { f.hew_home = true; questXp(60); msg('Hew Callan nods, once, and keeps his purse.', 'good', 4000); journal('side', "Hew Callan is himself again. I told him to keep his purse and go home to Mags. He says he will, once the shift is done. Old habits."); } },
  ]);
}

// ---------------------------------------------------------------- combat
function currentWeapon() { return WEAPONS[G.player.weapons[G.player.weapon]] || WEAPONS.hands; }
// ---------------------------------------------------------------- armour & gear
function worn(slot, p = G.player) { const id = p.armor && p.armor[slot]; return id && ARMOR[id] ? ARMOR[id] : null; }
function shieldBlocked() { return !!currentWeapon().twoHanded; }
function armorRating(p = G.player) { let ar = 0; for (const [slot] of ARMOR_SLOTS) { const a = worn(slot, p); if (a && !(slot === 'shield' && shieldBlocked())) ar += a.ar; } return ar; }
function armorNoise(p = G.player) { let n = 0; for (const [slot] of ARMOR_SLOTS) { const a = worn(slot, p); if (a) n += a.noise; } return Math.max(-0.8, n); }
function isWorn(id) { const a = ARMOR[id]; return !!(a && G.player.armor[a.slot] === id); }
function spareCount(id) { const s = G.player.inv.find(x => x.id === id); return s ? s.n - (isWorn(id) ? 1 : 0) : 0; }
function equipArmor(id) { const a = ARMOR[id]; if (!a || !G.has(id)) return; G.player.armor[a.slot] = id; if (id === 'a_synodrobe') exposeDisguise('A patrol watches you put on the borrowed robes.'); Audio_.sfx.pickup(); msg(`You put on the ${a.name}.` + (a.slot === 'shield' && shieldBlocked() ? ' (Your two-handed weapon leaves no hand for it.)' : ''), '', 2200); }
function removeArmor(slot) { const a = worn(slot); if (!a) return; delete G.player.armor[slot]; msg(`You take off the ${a.name}.`, '', 1600); }
// take something into your keeping; returns a phrase for the message
function gainItem(id) {
  const it = ITEMS[id], p = G.player; if (!it) return '';
  if (id === 'sovereigns') { const n = rndi(4, 14); G.gold(n); return `${n} sovereigns`; }
  if (it.use === 'ammo') { const k = it.ammo || 'pellets'; p[k] = (p[k] || 0) + it.n; return it.name; }
  if (it.weapon) {
    if (!p.weapons.includes(it.weapon)) { p.weapons.push(it.weapon); return `the ${it.name} (readied — key ${Math.min(9, p.weapons.length)} or the wheel)`; }
    G.give(id); return `a spare ${it.name}, worth selling`;
  }
  G.give(id);
  if (it.armor && !p.armor[it.slot]) { p.armor[it.slot] = id; if (id === 'a_synodrobe') exposeDisguise('A patrol watches you put on the borrowed robes.'); return `the ${it.name}, and put it on`; }
  return `the ${it.name}`;
}
function pickWeighted(table) { let t = 0; for (const [, w] of table) t += w; let r = Math.random() * t; for (const [id, w] of table) { r -= w; if (r <= 0) return id; } return table[0][0]; }
// leave something on the floor where a thing fell
function dropLoot(e) {
  const L = LOOT[e.type]; if (!L || Math.random() > L.chance + G.player.attrs.Luck / 1000) return;
  const id = pickWeighted(L.table), it = ITEMS[id];
  let x = e.x, y = e.y; for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, rr = 0.25 + Math.random() * 0.3; if (!G.map.isBlocked((e.x + Math.cos(a) * rr) | 0, (e.y + Math.sin(a) * rr) | 0)) { x = e.x + Math.cos(a) * rr; y = e.y + Math.sin(a) * rr; break; } }
  G.ents.push(hydrate({ kind: 'item', item: id, sprite: it.sprite || 'gear', x, y, scale: 0.35, yOff: 0, solid: false }));
  msg(`Something falls from ${theName(e.def.name, false)}.`, '', 2200);
}
function openCache(e) {
  const T = CACHE[e.tier || 1]; const n = rndi(T.gold[0], T.gold[1]); G.gold(n);
  const got = [`${n} sovereigns`];
  const rolls = 1 + (Math.random() < 0.35 + G.player.attrs.Luck / 400 ? 1 : 0);
  for (let i = 0; i < rolls; i++) got.push(gainItem(pickWeighted(T.table)));
  msg(`You force the strongbox. Inside: ${got.join('; ')}.`, 'good', 6000);
}
function attack(dirLabel) {
  const p = G.player; const w = currentWeapon(); if (G.attack.t > 0 || G.song.t > 0) return;
  if (w.type === 'glass' && G.glassLock > 0) { msg('Your glass arm is locked rigid, ringing flat.', 'bad', 1500); return; }
  if (w.ammo) {
    const k = w.ammo; if (!((p[k] || 0) > 0)) { msg(k === 'bolts' ? 'No bolts. Captain Vane sells them at the Boar & Dulcimer.' : 'No glass shot. A sovereign a pellet, and you have none loaded.', 'bad'); return; }
    p[k]--; if (k === 'bolts') Audio_.sfx.bow(); else Audio_.sfx.shot();
  }
  else Audio_.sfx.swing();
  exposeDisguise('A patrol witnesses your attack.');
  G.attack.t = w.speed; G.attack.dur = w.speed; G.attack.dirLabel = dirLabel; addNoise(w.noise);
  p.fat = Math.max(0, p.fat - 1);
  // find target
  const c = Engine.cam; let best = null, bd = 1e9;
  for (const e of G.ents) {
    if ((e.kind !== 'enemy' && !(lawActive() && e.kind === 'npc' && !e.companion && e.id !== 'cat')) || e.dead || e.hidden) continue;
    const dx = e.x - c.x, dy = e.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > w.reach + (e.radius || 0.3)) continue;
    if (!w.ranged && Math.abs(feetOf(e) - feetOf(p)) > MELEE_RISE) continue;   // out of reach above or below
    const ang = Math.abs(normAng(Math.atan2(dy, dx) - c.dir));
    const cone = w.ranged ? 0.14 + 0.25 / Math.max(1, d) : 0.55;
    if (ang > cone) continue;
    if (!los(c.x, c.y, e.x, e.y)) continue;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) { if (!w.ranged) msg(`Your ${dirLabel || 'swing'} finds nothing but air.`, '', 1200); return; }
  const e = best, d = e.def;
  if (e.kind === 'npc') { assaultCivilian(e); return; }
  // hit chance
  const hitChance = 0.55 + p.attrs.Agility / 250 + p.attrs.Luck / 600 + (w.ranged ? 0.15 : 0);
  if (Math.random() > hitChance) { msg(`You miss ${theName(d.name, false)}.`, '', 1500); return; }
  let dmg = rndi(w.dmg[0], w.dmg[1]) + Math.floor(p.attrs.Strength / 25);
  if (w.type === 'shot') { if (d.cacophony) dmg *= 2; if (d.quiet || d.hushkin) { dmg = 0; msg('The pellet cannot ring inside the quiet. It drops like a dropped coat.', 'warn'); } }
  if (w.type === 'iron' && d.quiet) dmg = Math.floor(dmg * 1.5);
  if (w.type === 'glass') { if (d.cacophony) dmg = Math.floor(dmg * 1.6); p.glass = Math.min(100, p.glass + 0.4); }
  if (w.type === 'iron' && d.cacophony && w !== WEAPONS.hands) dmg = Math.floor(dmg * 0.6);
  if (w.type === 'bronze') { if (d.cacophony) dmg = Math.floor(dmg * 1.35); if (d.quiet) dmg = Math.floor(dmg * 0.5); }
  if (w.type === 'bolt') { if (d.quiet) dmg = Math.floor(dmg * 1.4); if (d.cacophony) dmg = Math.floor(dmg * 0.5); }
  if (w.cleave && d.core) dmg = Math.floor(dmg * 1.2);
  if (d.armored && w.blunt) dmg = Math.floor(dmg * 1.5);
  else if (d.armored && w.type !== 'glass') dmg = Math.max(1, dmg - 3);
  if (d.coda) dmg = codaShield(e, dmg);
  e.hp -= dmg; e.flash = true; setTimeout(() => e.flash = false, 90);
  if (w.type === 'glass') Audio_.sfx.glasshit(); else if (w.type === 'bronze') { Audio_.sfx.hit(); Audio_.sfx.bell(); } else Audio_.sfx.hit();
  Audio_.sfx.enemy(d, 'hurt');
  if (e.state === 'idle' || e.state === 'passive' || e.state === 'investigate') { delete e.investigation; e.state = 'chase'; e.alertT = 8; }
  if (dmg > 0) msg(w.type === 'bolt' ? `Your bolt takes ${theName(d.name, false)} for ${dmg}.` : w.type === 'shot' ? `Your shot breaks on ${theName(d.name, false)} for ${dmg}.` : `Your ${dirLabel || 'blow'} lands on ${theName(d.name, false)} for ${dmg}.`, '', 1800);
  if (e.hp <= 0) killEnemy(e, w.type === 'glass');
}

// ---------------------------------------------------------------- songs
function castSong(id) {
  const p = G.player, s = SONGS[id]; if (!s || G.song.t > 0 || G.attack.t > 0) return;
  // a quiet eats the air
  for (const e of G.ents) if (e.kind === 'enemy' && !e.dead && !e.hidden && e.def.quiet && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 16) { msg('You open your mouth and nothing comes out. The air here cannot carry it.', 'bad'); return; }
  if (wildsSilenced()) return;
  if (id === 'murmur') { G.murmurT = 4; addNoise(s.noise); Audio_.sfx.murmur(); msg('You murmur, low, inside the Narrow.', '', 1500); return; }
  if (p.voice < s.cost) { msg('Your voice is torn. There is nothing left in it.', 'bad'); return; }
  if (s.noise >= 2.5 || id === 'name') exposeDisguise('A patrol hears your forbidden Song.');
  p.voice -= s.cost; addNoise(s.noise); G.song.t = 0.7; fx('song', 600); G.songFx = 0.6;
  if (id === 'tending') { p.hp = Math.min(p.hpMax, p.hp + 14); Audio_.sfx.song(174, 1.4); msg('You sing the tending note, low. Something knits.', 'good'); }
  else if (id === 'root') { G.rootWard = 12; Audio_.sfx.song(174, 2.0); msg('You sing the Root note, the one it keeps losing. The hounds will not come to you, for a little while.', 'good'); }
  else if (id === 'fifth') {
    Audio_.sfx.fifth(); let n = 0;
    for (const e of G.ents) { if (e.kind !== 'enemy' || e.dead || e.hidden || !e.def.cacophony) continue; if (dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) > 100) continue; if (e.def.boss && e.fifthN > 0) { msg('The Wearer whistles the falling fifth back at you, exactly right. It has learned it.', 'bad'); continue; } const st = [4.5, 2.5, 1.2, 0.5][Math.min(3, e.fifthN)]; e.stun = st; e.fifthN++; n++; }
    msg(n ? `You sing the falling fifth at full voice. ${n === 1 ? 'The thing' : n + ' of them'} stop${n === 1 ? 's' : ''} for a breath.` : 'You sing the falling fifth. Nothing here is listening. Something further off may be.', n ? 'good' : 'warn');
    if (G.map.danger > 0 && Math.random() < 0.5) setTimeout(spawnHound, 2500);
  }
  else if (id === 'name') {
    if (p.fragments <= 0) { msg('You reach for the Ledger and find nothing left to pay with.', 'bad'); p.voice += s.cost; return; }
    const c = Engine.cam; let best = null, bd = 1e9;
    for (const e of G.ents) { if (e.kind !== 'enemy' || e.dead || e.hidden || !e.def.core) continue; const d = Math.sqrt(dist2(e.x, e.y, c.x, c.y)); if (d > 4) continue; const ang = Math.abs(normAng(Math.atan2(e.y - c.y, e.x - c.x) - c.dir)); if (ang < 0.5 && d < bd) { bd = d; best = e; } }
    if (!best) { msg('There is no one here whose name you hold.', 'warn'); p.voice += s.cost; return; }
    p.fragments--; Audio_.sfx.song(741, 1.2);
    msg(`You read it its own surrendered name. "${best.name}." It stops. You have forgotten something small to pay for it; you cannot tell what.`, 'voice', 7000);
    killEnemy(best, false);
  }
  else if (s.custom && typeof executeCustomSong === 'function') executeCustomSong(s);   // composed Songs (Spellmaker) were paid for but never sung
}

// ---------------------------------------------------------------- Oakhaven law (player data is included in existing saves)
const LAW_MAPS = new Set(['oakhaven', 'tavern', 'greenhall', 'surgery', 'mill', 'chapel', 'orla_house', 'lyra_house', 'tannery', 'watchhouse']);
const PRISON_CELL_KEY = 'picked:watchhouse:door:5:4';
const EVIDENCE_KEY = 'picked:watchhouse:evidence';
const SAFE_WEAPONS = new Set(['tobin_blade', 'vesper_hook', 'sable_dagger']);
const lawNumber = (v, max = 9999) => typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), 0, max) : 0;
function lawActive() { return LAW_MAPS.has(G.mapId) && !G.flags.greening && !G.flags.part3; }
function safeWeapon(id) { return !!(WEAPONS[id] && (WEAPONS[id].innate || SAFE_WEAPONS.has(id))); }
function crimeState() {
  const p = G.player;
  const raw = p.crime && typeof p.crime === 'object' ? p.crime : {};
  for (const key of ['bounty', 'thefts', 'assaults', 'escapes', 'jailHours']) raw[key] = lawNumber(raw[key], key === 'jailHours' ? 99999 : 9999);
  raw.resisting = raw.resisting === true && raw.bounty > 0;   // refused arrest: the watch comes with cudgels, not a panel
  p.crime = raw; return raw;
}
// Only whitelisted item/weapon IDs and bounded numeric counts enter saved escrow.
function normalizeCrime() {
  const law = crimeState(), raw = law.evidence;
  law.custody = law.custody && typeof law.custody.remaining === 'number' && Number.isFinite(law.custody.remaining) ? { remaining: clamp(law.custody.remaining, 0, 6) } : null;
  law.evidence = null;
  if (raw && typeof raw === 'object') {
    const inv = (Array.isArray(raw.inv) ? raw.inv : []).slice(0, 256).filter(s => s && Object.hasOwn(ITEMS, s.id) && !ITEMS[s.id].key && lawNumber(s.n) > 0).map(s => ({ id: s.id, n: lawNumber(s.n) }));
    const weapons = [...new Set((Array.isArray(raw.weapons) ? raw.weapons : []).filter(id => Object.hasOwn(WEAPONS, id) && !safeWeapon(id)))];
    const armor = {};
    for (const [slot] of ARMOR_SLOTS) if (raw.armor && Object.hasOwn(ARMOR, raw.armor[slot]) && ARMOR[raw.armor[slot]].slot === slot && inv.some(s => s.id === raw.armor[slot])) armor[slot] = raw.armor[slot];
    law.evidence = { inv, weapons, armor, selected: Object.hasOwn(WEAPONS, raw.selected) ? raw.selected : weapons[0], pellets: lawNumber(raw.pellets), bolts: lawNumber(raw.bolts), tknives: lawNumber(raw.tknives) };
  }
}
function reportCrime(type, amount) {
  const law = crimeState();
  law.bounty = Math.min(9999, law.bounty + amount);
  syncWantedPosters();
  msg(`The watch records ${type}. +${amount} Oakhaven bounty (total ${law.bounty}).`, 'bad', 5000);
}
function syncWantedPosters() {
  if (!G.maps) return;
  const wanted = crimeState().bounty >= 40 && !G.flags.greening && !G.flags.part3;
  for (const m of Object.values(G.maps)) for (const e of m.entities) if (e.wantedPoster) {
    e.hidden = !wanted; e.dead = false;
  }
}
function renderWantedPoster() {
  const law = crimeState(); G.state = 'panel';
  openModal(`<h2>By order of the Oakhaven watch</h2><div class="wanted-sheet"><p class="muted">WARRANT OF APPREHENSION</p><h3>${cleanName(G.player.name)}</h3><strong>${law.bounty} sovereigns</strong><p>${law.bounty >= 40 ? 'Wanted for questioning. Constables are to bring this traveller to the watch-house.' : 'This warrant has been withdrawn. No public notice is outstanding.'}</p></div><p>Reported offences: ${law.thefts} theft attempts · ${law.assaults} assaults · ${law.escapes} escapes. Payment or completed sentence withdraws the notice. Tearing down paper does not erase the registry.</p><div class="btns"><button class="dfbtn" id="law-leave">Leave notice</button></div><p class="muted">Enter / Escape / controller A or B: leave</p>`, 'wanted');
  $('#law-leave').onclick = () => { closeModal(); G.state = 'play'; };
}
function assaultCivilian(e) {
  // Nonlethal: quest-givers/children/companions never lose health or dialogue.
  if (!lawActive() || G.mapId === 'watchhouse' || !e || e.kind !== 'npc' || !G.ents.includes(e) || e.companion || e.dead || e.hidden || e.id === 'cat') return;
  if ((e.assaultUntil || 0) > G.time) return;
  e.assaultUntil = G.time + 4;
  const law = crimeState(); law.assaults = Math.min(9999, law.assaults + 1);
  reportCrime('an assault', 40);
  e.facing = Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x);
  if (e.lawGuard && law.resisting) { e.stun = 1.2; msg('The constable reels back, then comes on again.', 'warn', 3000); return; }
  msg('They recoil and call the watch. The blow is nonlethal; their story and services remain available.', 'warn', 4500);
}
function confiscateGear() {
  const p = G.player, law = crimeState();
  const fresh = { inv: p.inv.filter(s => !ITEMS[s.id].key).map(s => ({ id: s.id, n: s.n })), weapons: p.weapons.filter(id => !safeWeapon(id)), armor: { ...p.armor }, selected: p.weapons[p.weapon], pellets: p.pellets, bolts: p.bolts, tknives: p.tknives };
  // Re-arrest never overwrites property still waiting in evidence.
  if (law.evidence) {
    fresh.inv.unshift(...law.evidence.inv); fresh.weapons = [...new Set([...law.evidence.weapons, ...fresh.weapons])];
    fresh.armor = { ...law.evidence.armor, ...fresh.armor };
    for (const key of ['pellets', 'bolts', 'tknives']) fresh[key] = lawNumber(fresh[key]) + law.evidence[key];
  }
  law.evidence = fresh; normalizeCrime();
  p.inv = p.inv.filter(s => ITEMS[s.id].key); p.armor = {};
  p.weapons = p.weapons.filter(safeWeapon); if (!p.weapons.length) p.weapons = ['hands'];
  p.weapon = 0; p.pellets = p.bolts = p.tknives = 0;
}
function returnEvidence() {
  const p = G.player, law = crimeState(), evidence = law.evidence;
  if (!evidence) return;
  law.evidence = null; // consume before rewards: stale callbacks cannot duplicate gear
  for (const s of evidence.inv) G.give(s.id, s.n);
  for (const id of evidence.weapons) if (!p.weapons.includes(id)) p.weapons.push(id);
  if (evidence.weapons.length && p.weapons.length > 1 && evidence.selected !== 'hands') p.weapons = p.weapons.filter(id => id !== 'hands');
  for (const [slot, id] of Object.entries(evidence.armor)) if (!p.armor[slot] && G.has(id)) p.armor[slot] = id;
  for (const key of ['pellets', 'bolts', 'tknives']) p[key] = lawNumber(p[key]) + evidence[key];
  const selected = p.weapons.indexOf(evidence.selected); if (selected >= 0) p.weapon = selected;
}
function enterPrison() {
  const law = crimeState(); if (!lawActive() || law.custody || !law.bounty) return;
  confiscateGear(); crimeState().custody = { remaining: 6 }; crimeState().resisting = false;
  delete G.flags[PRISON_CELL_KEY]; delete G.flags[EVIDENCE_KEY];
  const m = G.maps.watchhouse; for (const d of Object.values(m.doors)) d.open = d.target = 0;
  closeModal(); G.state = 'play'; loadMap('watchhouse'); G.lawGrace = 0;
  G.vel.x = G.vel.y = 0; G.touch.fx = G.touch.fy = 0;
  msg('Six hours in custody. Your quest possessions are safe; other gear is held in evidence. Use the bunk to serve/pay, or pick the cell lock to escape.', 'warn', 8500);
}
function releasePrison(paid = false) {
  const law = crimeState(); if (!law.custody || G.mapId !== 'watchhouse') return;
  if (paid) { if (!Number.isFinite(G.player.gold) || G.player.gold < law.bounty) return; G.player.gold -= law.bounty; }
  else if (law.custody.remaining > 0.00001) return;
  law.bounty = 0; law.custody = null; returnEvidence(); syncWantedPosters();
  closeModal(); G.state = 'play'; loadMap('oakhaven', { x: 39.5, y: 6.5, dir: Math.PI / 2 }); G.lawGrace = 5;
  msg('The watch releases you, returns your remaining evidence and withdraws the warrant.', 'good', 5500);
}
function tickCustody(hours) {
  const law = crimeState(); if (!law.custody || G.mapId !== 'watchhouse') return;
  const served = Math.min(hours, law.custody.remaining);
  law.custody.remaining = Math.max(0, law.custody.remaining - served);
  // Fractional progress stays in remaining; completed sentences count six hours.
  if (law.custody.remaining <= 0.00001) { law.jailHours = Math.min(99999, law.jailHours + 6); releasePrison(); }
}
function renderPrison() {
  const law = crimeState(); if (!law.custody || G.mapId !== 'watchhouse') return;
  G.state = 'panel';
  openModal(`<h2>The watch-house cell</h2><p role="status">${Math.ceil(law.custody.remaining * 60)} minutes left · Outstanding fine ${law.bounty} sovereigns</p><p>Quest possessions stay with you. Other gear is in the evidence chest beyond the cell. Serve the remaining sentence or pay for immediate release and return of evidence. To escape, pick the cell lock, recover evidence if you can, then use the street door; escape adds 60 bounty.</p><div class="btns"><button class="dfbtn" id="prison-serve">Serve remaining sentence</button><button class="dfbtn" id="prison-pay" ${G.player.gold < law.bounty ? 'disabled' : ''}>Pay fine</button><button class="dfbtn" id="law-leave">Return to cell</button></div><p class="muted">1 / Enter / A: serve · 2 / X: pay · Escape / B: return</p>`, 'prison');
  const token = G.panelToken;
  const valid = () => G.panelToken === token && G.openPanel === 'prison' && G.state === 'panel' && G.mapId === 'watchhouse' && !G.dead && crimeState().custody;
  $('#prison-serve').onclick = () => { if (valid()) passHours(crimeState().custody.remaining); };
  $('#prison-pay').onclick = () => { if (valid()) releasePrison(true); };
  $('#law-leave').onclick = () => { if (valid()) { closeModal(); G.state = 'play'; } };
}
function useLawDeco(e) {
  if (e.wantedPoster) { renderWantedPoster(); return true; }
  if (G.mapId !== 'watchhouse') return false;
  if (e.use === 'prison_bunk') { if (crimeState().custody) renderPrison(); else msg('A watch-house bunk. You are not serving a sentence.', '', 3000); return true; }
  if (e.use === 'prison_evidence') {
    if (!crimeState().evidence) msg('The evidence chest is empty.', '', 2500);
    else if (crimeState().custody && !G.flags[EVIDENCE_KEY]) beginLockpick(e, EVIDENCE_KEY, 2, () => { if (G.mapId === 'watchhouse' && !G.dead) { returnEvidence(); msg('You recover your confiscated belongings.', 'good'); } });
    else { returnEvidence(); msg('You recover your confiscated belongings.', 'good'); }
    return true;
  }
  return false;
}
function leaveWatchhouse() {
  const law = crimeState();
  if (law.custody) { law.custody = null; law.escapes = Math.min(9999, law.escapes + 1); reportCrime('a prison escape', 60); }
  closeModal(); G.state = 'play'; loadMap('oakhaven', { x: 39.5, y: 6.5, dir: Math.PI / 2 }); G.lawGrace = 5;
}
function theftWitness(target) {
  const c = Engine.cam;
  return G.ents.find(e => e.kind === 'npc' && e !== target && !e.companion && !e.dead && !e.hidden && !(e.stun > 0) &&
    dist2(e.x, e.y, c.x, c.y) < 64 && los(e.x, e.y, c.x, c.y) &&
    (e.lawGuard || Math.abs(normAng(Math.atan2(c.y - e.y, c.x - e.x) - (Number.isFinite(e.facing) ? e.facing : e.dir || 0))) < Math.PI * 0.65));
}
function confirmTheft(e) {
  G.state = 'panel';
  openModal(`<h2>Not yours to take</h2><p>This ${ITEMS[e.item].name} belongs to ${e.owner === 'market' ? 'Bettany’s market stall' : 'the local household or business'}. Taking it is theft. A witness can report you to the watch.</p><div class="btns"><button class="dfbtn" id="crime-take">Take it anyway</button><button class="dfbtn" id="crime-leave">Leave it</button></div>`, 'theft');
  $('#crime-leave').onclick = () => { if (G.openPanel === 'theft') { closeModal(); G.state = 'play'; } };
  const map = G.map, token = G.panelToken;
  $('#crime-take').onclick = () => {
    if (G.panelToken !== token || G.openPanel !== 'theft' || G.state !== 'panel' || G.dead || G.map !== map || !G.ents.includes(e) || e.dead || e.hidden) return;
    closeModal(); G.state = 'play';
    const law = crimeState(), witness = theftWitness(e);
    law.thefts = Math.min(9999, law.thefts + 1);
    if (witness) reportCrime('a theft', 20);
    else msg('No one sees you take it.', 'warn', 3000);
    pickUp(e, true);
  };
}
// Social pressure at the watch: Personality buys silence, Strength buys seconds.
const BRIBE_FLOOR = 5;
const THREAT_GRACE = 12;
let ARREST_NOTE = '';
function socialOdds(attr, bounty, shift = 0) {
  const a = clamp(Number(attr) || 0, 1, 100);
  const b = clamp(Number(bounty) || 0, 0, 9999);
  return Math.round(clamp(45 + (a - 45) - Math.min(20, b * 0.2) + shift, 10, 90));
}
function bribeTerms(law = crimeState()) {
  const bounty = clamp(Number(law.bounty) || 0, 0, 9999);
  return { cost: Math.max(BRIBE_FLOOR, Math.round(bounty * 0.6)), chance: socialOdds(G.player.attrs.Personality, bounty) };
}
function threatTerms(law = crimeState()) {
  return { chance: socialOdds(G.player.attrs.Strength, law.bounty, -5), grace: THREAT_GRACE };
}
function renderArrest() {
  const law = crimeState(); if (!lawActive() || !law.bounty || law.custody || G.dead) return;
  const map = G.map;
  // A refusal keeps its line across the re-render; a fresh confrontation starts clean.
  if (G.openPanel !== 'arrest') ARREST_NOTE = '';
  const valid = () => G.panelToken === token && G.openPanel === 'arrest' && G.state === 'panel' && G.map === map && !G.dead && crimeState().bounty > 0 && !crimeState().custody;
  const watch = G.ents.find(e => e.lawGuard && !e.dead && !e.hidden);
  const phase1Bribe = window.OctaveBribesThreats && window.OctaveBribesThreats.getBribeQuote(G, watch);
  const phase1Threat = window.OctaveBribesThreats && window.OctaveBribesThreats.getThreatOdds(G, watch);
  const bribe = phase1Bribe ? { cost: phase1Bribe.cost, chance: phase1Bribe.odds } : bribeTerms(law);
  const threat = phase1Threat ? { chance: phase1Threat.odds, grace: phase1Threat.grace } : threatTerms(law);
  const canBribe = Number.isFinite(G.player.gold) && G.player.gold >= bribe.cost;
  G.state = 'panel';
  openModal(`<h2>The Oakhaven watch</h2><p>The watch has your description. Outstanding fine: <b>${law.bounty} sovereigns</b>.</p><p class="muted">Pay exactly the fine, or enter the watch-house for a six-hour sentence. Non-quest gear is held in evidence until release or recovery; quest possessions remain safe. Refusing leaves the bounty outstanding.</p>
  <div class="watch-social"><div><b>Bribe</b><span>${bribe.cost} sovereigns · Personality ${Math.round(G.player.attrs.Personality)} · ${bribe.chance}%</span></div><div><b>Lean on him</b><span>Strength ${Math.round(G.player.attrs.Strength)} · ${threat.chance}% · ${threat.grace} seconds to go</span></div></div>
  <p class="muted">A bribe is cheaper than the fine but may insult him; a threat wins no clemency, only room to run. Offering coin and reaching for steel are separate offences.</p>
  <p id="arrest-note" role="status" aria-live="polite">${ARREST_NOTE || 'The constable waits with his hand near the whistle.'}</p>
  <div class="btns"><button class="dfbtn" id="crime-pay" ${G.player.gold < law.bounty ? 'disabled' : ''}>Pay fine</button><button class="dfbtn" id="crime-jail">Enter prison</button><button class="dfbtn" id="crime-bribe" ${canBribe ? '' : 'disabled'}>Offer a bribe</button><button class="dfbtn" id="crime-threat">Lean on him</button><button class="dfbtn" id="crime-flee">Refuse and run</button></div><p class="muted">1 / A: pay · 2 / X: prison · 3 / Y: bribe · 4 / Back: threaten · 5 / Escape / B: refuse</p>`, 'arrest');
  const token = G.panelToken;
  $('#crime-pay').onclick = () => {
    if (!valid()) return;
    const current = crimeState(); if (!Number.isFinite(G.player.gold) || G.player.gold < current.bounty) return;
    G.player.gold -= current.bounty; current.bounty = 0; returnEvidence(); syncWantedPosters();
    closeModal(); G.state = 'play'; msg('The watch marks the fine paid and returns any remaining evidence. You are free to go.', 'good');
  };
  $('#crime-jail').onclick = () => { if (valid()) enterPrison(); };
  $('#crime-bribe').onclick = () => {
    if (!valid()) return;
    const terms = bribeTerms(), p = G.player;
    if (!Number.isFinite(p.gold) || p.gold < terms.cost) { ARREST_NOTE = 'You cannot raise even a token purse.'; renderArrest(); return; }
    if (Math.random() * 100 < terms.chance) {
      const held = !!crimeState().evidence;
      p.gold -= terms.cost; crimeState().bounty = 0; returnEvidence(); syncWantedPosters();
      closeModal(); G.state = 'play'; G.lawGrace = 5; Audio_.sfx.pickup();
      msg(`You fold ${terms.cost} sovereigns under his thumb. The constable studies the rain, then his boots, and the warrant is quietly forgotten.${held ? ' Your held gear comes back with it.' : ''}`, 'good', 7000);
    } else {
      ARREST_NOTE = '“Coin for a watchman.” He does not take it, and he writes a longer line than before.';
      reportCrime('an attempted bribe', 15); renderArrest();
    }
  };
  $('#crime-threat').onclick = () => {
    if (!valid()) return;
    const terms = threatTerms();
    if (Math.random() * 100 < terms.chance) {
      for (const e of G.ents) if (e.lawGuard && !e.dead && !e.hidden) { delete e.investigation; e.state = 'idle'; }
      resistArrest(null, terms.grace, true); Audio_.sfx.ui();
      msg(`You set your hand on the hilt and let him measure you. He takes a step back and reaches for the whistle anyway: ${terms.grace} seconds before the next patrol.`, 'warn', 7000);
      return true;
    } else {
      ARREST_NOTE = '“Threaten me, then.” The whistle is already at his lips.';
      reportCrime('threatening a constable', 20); renderArrest();
      return false;
    }
  };
  $('#crime-flee').onclick = () => { if (valid()) resistArrest('You break away. Behind you the whistle shrills: the watch will take you by force now.'); };
}
// Refusing arrest (running, or a threat that only buys a head start) is resisting: the charge goes on the warrant and
// every constable who sees you from then on closes in and strikes, until you pay, serve, or give yourself up by
// speaking to one. Beaten down, you are not killed: you wake in the watch-house.
const RESIST_SPEED = 3.4, RESIST_REACH = 1.35, RESIST_COOL = 1.4, RESIST_DMG = [5, 9];
function resistArrest(note, grace = 2, quiet = false) {
  const law = crimeState(); if (!law.bounty) return;
  if (!law.resisting) { law.resisting = true; if (!quiet) reportCrime('resisting arrest', 20); }
  G.lawGrace = grace; closeModal(); G.state = 'play';
  if (note) msg(note, 'bad', 6000);
  msg('Constables who see you will attack. Speak to one to give yourself up.', 'warn', 6000);
}
function constableStrike(e) {
  const p = G.player, dmg = rndi(RESIST_DMG[0], RESIST_DMG[1]) + Math.floor(G.player.level / 3);
  e.lawCool = RESIST_COOL; e.atkT = 0.3; e._strike = 0.25;
  try { Audio_.sfx.swing(); Audio_.sfx.hit(); } catch (err) { /* silent */ }
  if (p.hp - dmg <= Math.max(1, Math.ceil(p.hpMax * 0.15))) {
    // the watch takes you alive
    p.hp = Math.max(1, Math.ceil(p.hpMax * 0.15)); G.hurtT = 0.4; fx('hurt', 400);
    msg('A cudgel takes your legs and the cobbles come up to meet you. You wake in the watch-house.', 'bad', 7000);
    enterPrison(); return;
  }
  damagePlayer(dmg, e.name || 'The constable');
}
function tickLaw(dt) {
  G.lawGrace = Math.max(0, (G.lawGrace || 0) - dt);
  if (!lawActive() || crimeState().custody) return;
  const c = Engine.cam, wanted = crimeState().bounty > 0, resisting = wanted && crimeState().resisting;
  for (const e of G.ents) {
    if (!e.lawGuard || e.hidden || e.dead) continue;
    if (e.lawCool > 0) e.lawCool -= dt;
    if (e._strike > 0) e._strike -= dt;
    if (e.stun > 0) { e.stun -= dt; e.flash = (e.stun % 0.3) < 0.1; continue; } else e.flash = false;
    const dx = c.x - e.x, dy = c.y - e.y, distance = Math.hypot(dx, dy);
    if (!wanted) { if (e.investigation?.source === 'crime') { delete e.investigation; e.state = 'idle'; } updateInvestigation(e, dt); continue; }
    if (distance > 14 || !los(e.x, e.y, c.x, c.y)) { updateInvestigation(e, dt); continue; }
    e.investigation = { x: c.x, y: c.y, left: 10, source: 'crime' }; e.state = 'investigate';
    e.facing = Math.atan2(dy, dx);
    if (resisting) {
      // no more talk: run you down and strike
      if (distance > RESIST_REACH * 0.8) moveWithSlide(e, dx / distance * RESIST_SPEED * dt, dy / distance * RESIST_SPEED * dt, e);
      if (distance < RESIST_REACH && !G.lawGrace && !(e.lawCool > 0) && G.state === 'play') { constableStrike(e); if (crimeState().custody) return; }
      continue;
    }
    if (distance < 1.8 && !G.lawGrace) { renderArrest(); return; }
    if (distance > 1.2) moveWithSlide(e, dx / distance * 1.6 * dt, dy / distance * 1.6 * dt, e);
  }
}

// ---------------------------------------------------------------- Oakhaven pickpocketing
// Explicit purses only: no shop stock, quest items, children, or companions.
const PICKPOCKET_RANGE = 1.65;
let PICKPOCKET = null;
function canPickpocket(e) {
  return !!(e && G.mapId === 'oakhaven' && !G.flags.greening && e.kind === 'npc' &&
    e.pocketId && !e.companion && !e.lawGuard && !e.dead && !e.hidden && G.ents.includes(e));
}
function pocketKey(e) { return 'pocket:oakhaven:' + e.pocketId; }
function pocketReachable(e) {
  const c = Engine.cam;
  return canPickpocket(e) && dist2(c.x, c.y, e.x, e.y) <= PICKPOCKET_RANGE ** 2 &&
    Math.abs(normAng(Math.atan2(e.y - c.y, e.x - c.x) - c.dir)) < 0.7 && los(c.x, c.y, e.x, e.y);
}
function pickpocketTarget() {
  let target = null, best = Infinity;
  for (const e of G.ents) if (pocketReachable(e)) {
    const d = dist2(e.x, e.y, Engine.cam.x, Engine.cam.y);
    if (d < best) { target = e; best = d; }
  }
  return target;
}
function pocketRisk(e) {
  const heading = Number.isFinite(e.facing) ? e.facing : (Number.isFinite(e.dir) ? e.dir : 0);
  const angle = Math.abs(normAng(Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x) - heading));
  const position = angle > Math.PI * 2 / 3 ? 'Behind' : angle < Math.PI / 3 ? 'In front' : 'Beside';
  const noise = clamp(Number(G.noise) || 0, 0, 10);
  const skill = clamp(Number(G.player.skills && G.player.skills.Stealth) || 15, 1, 100);
  const attention = position === 'In front' ? 'Watching you' : noise >= 4 ? 'Listening for you' : 'Unaware of your hand';
  const chance = Math.round(clamp(40 + skill * 0.4 + (position === 'Behind' ? 25 : position === 'In front' ? -30 : 0) - noise * 3, 5, 90));
  return { position, attention, chance };
}
function openPickpocket() {
  if (G.state !== 'play' || G.dead) return;
  const target = pickpocketTarget();
  if (!target) { msg('Face an Oakhaven adult within arm’s reach to inspect their purse. Walls block your reach.', 'warn', 3000); return; }
  PICKPOCKET = { target, map: G.map };
  G.state = 'panel'; G.vel.x = G.vel.y = 0; G.touch.fx = G.touch.fy = 0;
  renderPickpocket();
}
function pickpocketInput(action) {
  const p = PICKPOCKET;
  if (!p || G.openPanel !== 'pickpocket' || G.state !== 'panel') return;
  if (action === 'leave' || G.dead || p.map !== G.map || !pocketReachable(p.target)) {
    PICKPOCKET = null; closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0;
    if (!G.dead) G.state = 'play'; return;
  }
  const e = p.target, key = pocketKey(e);
  if (action === 'take' && !G.flags[key]) {
    const risk = pocketRisk(e), witness = theftWitness(e), law = crimeState();
    const success = Math.random() * 100 < risk.chance;
    // Consume the opportunity before rewards/callbacks; neither outcome can be farmed.
    G.flags[key] = success ? 'taken' : 'caught';
    law.thefts = Math.min(9999, law.thefts + 1);
    if (!success || witness) {
      reportCrime('a purse theft', 20);
      e.facing = Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x);
    }
    if (success) { G.gold(e.pocketGold); gainSkill('Stealth', 2); Audio_.sfx.pickup(); }
    else { addNoise(1); Audio_.sfx.ui(); }
    p.message = success ? `You lift ${e.pocketGold} sovereigns.${witness ? ' A witness reports you: +20 Oakhaven bounty.' : ' No one notices.'}` :
      'Their hand closes over yours. No coin taken; +20 Oakhaven bounty. They will guard their purse from you now.';
  }
  renderPickpocket();
}
function renderPickpocket() {
  const p = PICKPOCKET; if (!p) return;
  const e = p.target, risk = pocketRisk(e), state = G.flags[pocketKey(e)];
  // NPC names may come from imported saves; escape for a text-only HTML sink.
  const name = String(e.name || (NPCS[e.id] && NPCS[e.id].name) || 'Townsperson').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  openModal(`<h2>A hand near the purse</h2><p>${name}</p>
    <p class="muted">Optional theft · quest items and shop stock are never taken</p>
    <div class="pocket-study"><b>${risk.position}</b><span>${risk.attention}</span><strong>${risk.chance}%</strong><span>Chance to lift unseen by the owner · Stealth ${Math.round(Number(G.player.skills && G.player.skills.Stealth) || 15)}</span></div>
    <p>Approach from behind and let your noise settle. Nearby witnesses can report even a successful lift. Getting caught adds 20 sovereigns to your bounty.</p>
    <p role="status" aria-live="polite">${p.message || (state === 'taken' ? 'This purse is empty. You already took its loose coin.' : state ? 'They are guarding their purse. You cannot try them again.' : `Purse: ${e.pocketGold} sovereigns. Inspection and leaving are free; each person allows one attempt per saved game.`)}</p>
    <p class="muted">Enter / Space attempts; Escape leaves. Controller: A attempts, B leaves.</p>
    <div class="btns"><button class="dfbtn" id="pocket-take" ${state ? 'disabled' : ''}>Lift purse (theft)</button><button class="dfbtn" id="pocket-leave">Leave untouched</button></div>`, 'pickpocket');
  $('#pocket-take').onclick = () => pickpocketInput('take');
  $('#pocket-leave').onclick = () => pickpocketInput('leave');
}

// ---------------------------------------------------------------- optional Cloister note-lock
const RELIQUARY_NOTES = [
  { name: 'Root', hz: 174, mark: 'I' },
  { name: 'Third', hz: 220, mark: 'III' },
  { name: 'Fifth', hz: 261, mark: 'V' },
];
const RELIQUARY_PHRASE = [0, 2, 1];
const RELIQUARY_FLAG = 'cloister_note_reliquary';
let NOTELOCK = null;
function openNoteLock(e) {
  if (G.mapId !== 'cloister' || e.use !== 'note_reliquary' || G.dead) return;
  NOTELOCK = { map: G.map, entered: [], selected: 0, message: 'The brass inscription reads: root, fifth, third. Repeat the phrase to release the lid.' };
  G.state = 'panel'; renderNoteLock();
}
function noteLockInput(action) {
  const n = NOTELOCK; if (!n || G.openPanel !== 'notelock') return;
  if (action === 'leave' || n.map !== G.map || G.dead) {
    NOTELOCK = null; closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0;
    if (!G.dead) G.state = 'play'; return;
  }
  if (action === 'left' || action === 'right') n.selected = (n.selected + (action === 'left' ? 2 : 1)) % 3;
  if (action === 'listen') {
    // Audio is an optional clue: the full phrase is also written in the UI.
    RELIQUARY_PHRASE.forEach((index, beat) => setTimeout(() => {
      if (NOTELOCK === n && G.openPanel === 'notelock' && G.map === n.map) Audio_.sfx.song(RELIQUARY_NOTES[index].hz, 0.3);
    }, beat * 430));
    n.message = 'The lid sings: Root (174 Hz), Fifth (261 Hz), Third (220 Hz).';
  }
  if (action === 'play') action = n.selected;
  if (Number.isInteger(action) && action >= 0 && action < 3 && !G.flags[RELIQUARY_FLAG]) {
    n.selected = action; Audio_.sfx.song(RELIQUARY_NOTES[action].hz, 0.25);
    n.entered.push(action);
    if (action !== RELIQUARY_PHRASE[n.entered.length - 1]) {
      n.entered = []; n.message = 'The brass answers flat. The pins reset; try the phrase again. Nothing is lost.';
    } else if (n.entered.length === 3) {
      G.flags[RELIQUARY_FLAG] = true; // claim before awarding; reopening cannot duplicate loot
      G.give('shard'); gainSkill('Lore', 2);
      n.message = 'The lid opens. You take one Light-Glass Shard. Inside: “A choir is not one voice made louder. It is room left for the next voice.”';
    } else n.message = 'The note holds. Continue the phrase.';
  }
  renderNoteLock();
}
function renderNoteLock() {
  const n = NOTELOCK; if (!n) return;
  const solved = !!G.flags[RELIQUARY_FLAG];
  openModal(`<h2>The three-voice reliquary</h2><p class="muted">Optional Cloister puzzle · no Voice cost · no story-door changes</p>
  <p>The inscription: <b>Root → Fifth → Third</b>. Labels and numbers provide the same clue as the sound.</p>
  <div class="note-keys">${RELIQUARY_NOTES.map((note, i) => `<button class="dfbtn ${n.selected === i ? 'sel' : ''}" id="note-${i}" ${solved ? 'disabled' : ''} aria-pressed="${n.selected === i}"><strong>${note.mark}</strong><span>${i + 1}. ${note.name}</span><small>${note.hz} Hz</small></button>`).join('')}</div>
  <p role="status" aria-live="polite">${solved && n.entered.length !== 3 ? 'The reliquary is empty. Its inscription remains; the shard has already been claimed.' : n.message}</p>
  <p class="muted">Matched notes: ${solved ? 3 : n.entered.length}/3. Keys 1–3 play; arrows select, Enter plays; L listens; Escape leaves. Controller: D-pad, A plays, X listens, B leaves.</p>
  <div class="btns"><button class="dfbtn" id="note-listen">Listen to phrase</button><button class="dfbtn" id="note-leave">Leave reliquary</button></div>`, 'notelock');
  for (let i = 0; i < 3; i++) $('#note-' + i).onclick = () => noteLockInput(i);
  $('#note-listen').onclick = () => noteLockInput('listen');
  $('#note-leave').onclick = () => noteLockInput('leave');
}

// ---------------------------------------------------------------- optional Catacombs physical puzzles
const PLATE_FLAG = 'catacombs_plate_vault';
const PLATE_ANCHOR_FLAG = 'catacombs_plate_anchored';
const MIRROR_FLAG = 'catacombs_mirror_vault';
const MIRROR_DIRS = ['North', 'East', 'South', 'West'];
const MIRROR_ANGLES = ['/', '\\']; // 0: N<->E, S<->W ; 1: N<->W, S<->E
let MIRROR_PUZZLE = null;
function mirrorKey(id) { return 'mirror:catacombs:' + id; }
function getMirrorAngle(id, defAngle = 0) {
  const v = G.flags && G.flags[mirrorKey(id)];
  return v === 0 || v === 1 ? v : (defAngle ? 1 : 0);
}
function traceCatacombsBeam() {
  const m1 = getMirrorAngle('m1', 1); // starts \ (1), needs / (0): S -> E
  const m2 = getMirrorAngle('m2', 1); // starts \ (1), needs / (0): E -> N
  const m3 = getMirrorAngle('m3', 0); // starts / (0), needs \ (1): N -> E
  const path = [{ node: 'Lantern (14.5, 4.5)', dir: 'North', x: 14.5, y: 4.5 }];
  const d1 = m1 === 0 ? 'East' : 'West';
  path.push({ node: `West mirror [1] (${MIRROR_ANGLES[m1]})`, dir: d1, x: 14.5, y: 2.5 });
  if (d1 !== 'East') return { hit: false, path, summary: 'The beam turns west into the niche wall at Mirror 1.' };
  const d2 = m2 === 0 ? 'North' : 'South';
  path.push({ node: `Center mirror [2] (${MIRROR_ANGLES[m2]})`, dir: d2, x: 22.5, y: 2.5 });
  if (d2 !== 'North') return { hit: false, path, summary: 'The beam turns south into the gallery floor at Mirror 2.' };
  const d3 = m3 === 1 ? 'East' : 'West';
  path.push({ node: `North-east mirror [3] (${MIRROR_ANGLES[m3]})`, dir: d3, x: 22.5, y: 1.5 });
  if (d3 !== 'East') return { hit: false, path, summary: 'The beam turns west away from the lens at Mirror 3.' };
  path.push({ node: 'Prismatic Lens (26.0, 1.5)', dir: 'Lock lit', x: 26.0, y: 1.5 });
  return { hit: true, path, summary: 'A green-gold beam links all three mirrors and fills the eastern prismatic lens.' };
}
function syncCatacombsPuzzles() {
  const m = G.maps && G.maps.catacombs; if (!m || !G.flags) return;
  const plateDoor = m.doors[26 * m.w + 10];
  const plateHeld = !!G.flags[PLATE_ANCHOR_FLAG] || !!G.flags[PLATE_FLAG] ||
    (G.map === m && G.ents.some(e => e.use === 'pressure_plate' && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 0.42));
  if (plateHeld && !G.flags[PLATE_FLAG]) {
    G.flags[PLATE_FLAG] = true; // claim before reward so reload/re-entry cannot duplicate
    G.give('shard'); gainSkill('Lore', 2); Audio_.sfx.door();
    msg('The drowned flagstones sink under the weight. In the west wall of the chapel, a counter-weight niche grinds open (1 Light-Glass Shard).', 'good', 4500);
  }
  if (plateDoor) plateDoor.target = (plateHeld || G.flags[PLATE_FLAG]) ? 1 : 0;
  for (const e of m.entities) {
    if (e.use === 'pressure_plate') {
      const anchored = !!G.flags[PLATE_ANCHOR_FLAG];
      e.glow = (anchored || G.flags[PLATE_FLAG]) ? 0.75 : 0.35;
      e.label = anchored ? 'Weighted pressure plate — anchored with a ballast block (niche open)' : 'Sunken pressure plate — stand on it or inspect to place a ballast stone';
    } else if (e.use === 'turning_mirror') {
      const ang = getMirrorAngle(e.mirrorId, e.defaultAngle);
      e.label = `Turning brass mirror (${MIRROR_ANGLES[ang]}) — inspect to rotate`;
    }
  }
  const trace = traceCatacombsBeam();
  if (trace.hit && !G.flags[MIRROR_FLAG]) {
    G.flags[MIRROR_FLAG] = true; // claim before reward so re-opening cannot duplicate
    G.give('shard'); gainSkill('Lore', 2); Audio_.sfx.door();
    msg('The green-gold beam strikes the eastern lens. The gallery reliquary gate unlatches (1 Light-Glass Shard)!', 'good', 4500);
  }
  const mirrorDoor = m.doors[1 * m.w + 27];
  if (mirrorDoor) mirrorDoor.target = G.flags[MIRROR_FLAG] ? 1 : 0;
  for (const e of m.entities) if (e.beamSeg) {
    if (e.beamSeg === 1) e.hidden = false;
    else if (e.beamSeg === 2) e.hidden = getMirrorAngle('m1', 1) !== 0;
    else if (e.beamSeg === 3) e.hidden = !(getMirrorAngle('m1', 1) === 0 && getMirrorAngle('m2', 1) === 0);
    else if (e.beamSeg === 4) e.hidden = !trace.hit;
  }
}
function tickCatacombsPuzzles() {
  if (G.mapId !== 'catacombs' || G.dead) return;
  syncCatacombsPuzzles();
}
function openPressurePlate(e) {
  if (G.mapId !== 'catacombs' || e.use !== 'pressure_plate' || G.dead) return;
  MIRROR_PUZZLE = { kind: 'plate', entity: e, map: G.map };
  G.state = 'panel'; renderPressurePlate();
}
function pressurePlateInput(action) {
  const p = MIRROR_PUZZLE; if (!p || p.kind !== 'plate' || G.openPanel !== 'pressureplate') return;
  if (action === 'leave' || p.map !== G.map || G.dead) {
    MIRROR_PUZZLE = null; closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0;
    if (!G.dead) G.state = 'play'; return;
  }
  if (action === 'toggle') {
    G.flags[PLATE_ANCHOR_FLAG] = !G.flags[PLATE_ANCHOR_FLAG];
    Audio_.sfx.door(); syncCatacombsPuzzles();
  }
  renderPressurePlate();
}
function renderPressurePlate() {
  const p = MIRROR_PUZZLE; if (!p || p.kind !== 'plate') return;
  const anchored = !!G.flags[PLATE_ANCHOR_FLAG], solved = !!G.flags[PLATE_FLAG];
  openModal(`<h2>Drowned Chapel Pressure Plate</h2><p class="muted">Optional Catacombs mechanism · no Voice or Fatigue cost · no story-door changes</p>
  <p>A square of counter-weighted flagstone set into the flooded floor. Stepping onto the plate or resting a fallen masonry block on its frame draws back the iron bolt on the west niche (10, 26).</p>
  <p role="status" aria-live="polite">${anchored ? 'A fallen masonry block holds the plate depressed; the west counter-weight grate stands open.' : (solved ? 'The west counter-weight niche has been unlatched. You can still weight or release the plate.' : 'The plate is raised. Step onto it in the chapel or slide the fallen ballast block onto it to unlatch the west niche.')}</p>
  <p class="muted">Enter or Space toggles the ballast stone; Escape leaves. Controller: A toggles, B leaves.</p>
  <div class="btns"><button class="dfbtn" id="plate-toggle">${anchored ? 'Remove ballast block' : 'Slide ballast block onto plate'}</button><button class="dfbtn" id="plate-leave">Step back</button></div>`, 'pressureplate');
  $('#plate-toggle').onclick = () => pressurePlateInput('toggle');
  $('#plate-leave').onclick = () => pressurePlateInput('leave');
}
function openTurningMirror(e) {
  if (G.mapId !== 'catacombs' || (e.use !== 'turning_mirror' && e.use !== 'mirror_lantern') || G.dead) return;
  const idx = e.mirrorId === 'm2' ? 1 : e.mirrorId === 'm3' ? 2 : 0;
  MIRROR_PUZZLE = { kind: 'mirror', map: G.map, selected: idx };
  G.state = 'panel'; renderTurningMirror();
}
function turningMirrorInput(action) {
  const m = MIRROR_PUZZLE; if (!m || m.kind !== 'mirror' || G.openPanel !== 'mirror') return;
  if (action === 'leave' || m.map !== G.map || G.dead) {
    MIRROR_PUZZLE = null; closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0;
    if (!G.dead) G.state = 'play'; return;
  }
  const defs = [{ id: 'm1', def: 1 }, { id: 'm2', def: 1 }, { id: 'm3', def: 0 }];
  if (action === 'left' || action === 'right') m.selected = (m.selected + (action === 'left' ? 2 : 1)) % 3;
  else if (action === 'rotate') {
    const cur = defs[m.selected];
    G.flags[mirrorKey(cur.id)] = getMirrorAngle(cur.id, cur.def) ? 0 : 1;
    Audio_.sfx.ui(); syncCatacombsPuzzles();
  } else if (action === 'reset') {
    for (const d of defs) G.flags[mirrorKey(d.id)] = d.def;
    Audio_.sfx.ui(); syncCatacombsPuzzles();
  } else if (Number.isInteger(action) && action >= 0 && action < 3) {
    m.selected = action;
    const cur = defs[action];
    G.flags[mirrorKey(cur.id)] = getMirrorAngle(cur.id, cur.def) ? 0 : 1;
    Audio_.sfx.ui(); syncCatacombsPuzzles();
  }
  renderTurningMirror();
}
function renderTurningMirror() {
  const m = MIRROR_PUZZLE; if (!m || m.kind !== 'mirror') return;
  const specs = [
    { id: 'm1', name: '1. West Stand', pos: '14.5, 2.5', def: 1, hint: 'Turns North beam → East (/)' },
    { id: 'm2', name: '2. Center Stand', pos: '22.5, 2.5', def: 1, hint: 'Turns East beam → North (/)' },
    { id: 'm3', name: '3. North-East Stand', pos: '22.5, 1.5', def: 0, hint: 'Turns North beam → East (\\)' },
  ];
  const trace = traceCatacombsBeam();
  const solved = !!G.flags[MIRROR_FLAG];
  openModal(`<h2>Niche Gallery Turning Mirrors</h2><p class="muted">Optional Catacombs puzzle · written beam path matches 3D light · no resource cost</p>
  <p>A green-gold lantern at (14.5, 4.5) shines <b>North</b>. Angle the three turntable mirrors between <b>/</b> (N↔E, S↔W) and <b>\\</b> (N↔W, S↔E) so the beam strikes the eastern prismatic lens at (26.0, 1.5).</p>
  <div class="note-keys">${specs.map((s, i) => {
    const ang = getMirrorAngle(s.id, s.def);
    return `<button class="dfbtn ${m.selected === i ? 'sel' : ''}" id="mirror-${i}" aria-pressed="${m.selected === i}"><strong>${MIRROR_ANGLES[ang]}</strong><span>${s.name}</span><small>${ang === 0 ? 'Slash / (N↔E)' : 'Backslash \\ (N↔W)'}</small></button>`;
  }).join('')}</div>
  <p role="status" aria-live="polite">${trace.summary}${solved ? ' The eastern reliquary niche (27, 1) stands open.' : ''}</p>
  <p class="muted">Path: ${trace.path.map(p => `${p.node} → ${p.dir}`).join(' · ')}. Keys 1–3 rotate a stand; arrows select, Enter/Space rotates; R resets; Escape leaves. Controller: D-pad, A rotates, X resets, B leaves.</p>
  <div class="btns"><button class="dfbtn" id="mirror-rotate">Rotate selected</button><button class="dfbtn" id="mirror-reset">Reset angles</button><button class="dfbtn" id="mirror-leave">Leave stand</button></div>`, 'mirror');
  for (let i = 0; i < 3; i++) $('#mirror-' + i).onclick = () => turningMirrorInput(i);
  $('#mirror-rotate').onclick = () => turningMirrorInput('rotate');
  $('#mirror-reset').onclick = () => turningMirrorInput('reset');
  $('#mirror-leave').onclick = () => turningMirrorInput('leave');
}

// ---------------------------------------------------------------- dungeon mechanisms
const TRAP_TYPES = {
  tripwire: { name: 'Barbed tripwire', effect: 'A spring lashes a barbed cord across your shins (5 damage).', sprite: 'grate' },
  net: { name: 'Suspended snare net', effect: 'A weighted net falls: movement slows for eight seconds.', sprite: 'web' },
  alarm: { name: 'Alarm-bell wire', effect: 'A bronze bell rings and nearby enemies investigate.', sprite: 'bigbell' },
};
function trapKey(e) { return 'trap:' + G.mapId + ':' + e.trapId; }
function triggerTrap(e) {
  if (!TRAP_TYPES[e.trapType] || G.flags[trapKey(e)] || e.hidden || e.dead) return;
  G.flags[trapKey(e)] = 'triggered'; // consume before damage/death callbacks
  const type = TRAP_TYPES[e.trapType];
  msg(type.effect, 'bad', 4500);
  if (e.trapType === 'tripwire') damagePlayer(5, 'The barbed tripwire');
  else if (e.trapType === 'net') { G.webT = Math.max(G.webT || 0, 8); addNoise(1); }
  else {
    addNoise(5); Audio_.sfx.song(392, 0.7);
    for (const enemy of G.ents) if (enemy.kind === 'enemy' && !enemy.dead && !enemy.hidden && !enemy.passive && dist2(enemy.x, enemy.y, e.x, e.y) < 100) { enemy.state = 'chase'; enemy.alertT = 8; }
  }
}
function tickTraps() {
  for (const e of G.ents) if (e.trapType && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 0.36) {
    triggerTrap(e); if (G.dead) return;
  }
}
function inspectTrap(e) {
  const type = TRAP_TYPES[e.trapType]; if (!type) return;
  const map = G.map, key = trapKey(e), state = G.flags[key];
  G.state = 'panel';
  openModal(`<h2>${type.name}</h2><p>${state ? (state === 'disarmed' ? 'The mechanism is safely disarmed.' : 'The spent mechanism cannot fire again.') : type.effect}</p>
  <p class="muted">Keep clear of the marked mechanism. Disarming uses three tumblers and your Lockpicking skill; three slips leave the trap armed. Leaving does not trigger it.</p>
  <div class="btns">${state ? '' : '<button class="dfbtn" id="trap-disarm">Disarm mechanism</button>'}<button class="dfbtn" id="trap-leave">Step back</button></div>`, 'trap');
  $('#trap-leave').onclick = () => { closeModal(); G.state = 'play'; };
  if (!state) $('#trap-disarm').onclick = () => {
    if (G.map !== map || G.flags[key]) return;
    beginLockpick(e, key, 2, () => { G.flags[key] = 'disarmed'; msg('You uncouple the trigger. The mechanism is safe.', 'good', 3500); });
  };
}

// ---------------------------------------------------------------- optional mechanical locks
// Only explicitly marked mechanical locks are pickable. Story seals always
// use cell.locked and are never bypassed by these saved unlock flags.
let LOCKPICK = null;
function mechanicalLockKey(target, x, y) {
  return 'picked:' + G.mapId + ':' + (target.kind === 'item' ? 'chest:' + target.x + ':' + target.y : 'door:' + x + ':' + y);
}
function beginLockpick(target, key, difficulty, onOpen) {
  if (target.locked || G.flags[key] || G.dead) return false;
  ensurePlayerUpgrades(G.player);
  const rank = Number(G.player.skills.Lockpicking) || 15;
  let seed = 0; for (const char of key) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
  LOCKPICK = { target, key, map: G.map, onOpen, pin: 0, position: 50, misses: 0,
    centers: [0, 1, 2].map(i => 20 + ((seed >>> (i * 6)) % 13) * 5),
    tolerance: clamp(15 + rank * 0.12 - clamp(difficulty, 1, 3) * 3, 6, 22), status: 'Find the soft spot, then lift the pin.' };
  G.state = 'panel'; renderLockpick(); return true;
}
function cancelLockpick() { LOCKPICK = null; closeModal(); G.keys = {}; G.touch.fx = G.touch.fy = 0; G.state = 'play'; }
function lockpickInput(action) {
  const l = LOCKPICK; if (!l || G.openPanel !== 'lockpick') return;
  if (l.map !== G.map || G.dead) { cancelLockpick(); return; }
  if (action === 'cancel') { cancelLockpick(); return; }
  if (action === 'left' || action === 'right') l.position = clamp(l.position + (action === 'left' ? -5 : 5), 0, 100);
  if (action === 'lift') {
    if (Math.abs(l.position - l.centers[l.pin]) <= l.tolerance) {
      l.pin++; l.status = 'The pin catches. Feel for the next tumbler.';
      if (l.pin === 3) {
        G.flags[l.key] = true; gainSkill('Lockpicking', 2);
        const open = l.onOpen; cancelLockpick(); Audio_.sfx.door();
        msg('The final tumbler turns. The lock opens.', 'good', 3000); open(); return;
      }
    } else {
      l.misses++; l.pin = 0; G.player.fat = Math.max(0, G.player.fat - 1); addNoise(0.4);
      l.status = 'The pick slips. The pins fall; you lose 1 Fatigue.';
      if (l.misses >= 3) { cancelLockpick(); msg('The mechanism binds. You withdraw the pick; you may try again.', 'warn', 3500); return; }
    }
  }
  renderLockpick();
}
function renderLockpick() {
  const l = LOCKPICK; if (!l) return;
  openModal(`<h2>The brass tumblers</h2><p class="muted">Lockpicking ${Math.round(Number(G.player.skills.Lockpicking) || 15)} · Pin ${l.pin + 1}/3 · Slips ${l.misses}/3</p>
  <div class="lock-study" role="img" aria-label="Pin ${l.pin + 1}; soft spot at ${l.centers[l.pin]} percent; pick at ${l.position} percent">
  <div class="lock-band" style="left:${l.centers[l.pin] - l.tolerance}%;width:${l.tolerance * 2}%"></div><div class="lock-pick" style="left:${l.position}%"></div></div>
  <p role="status" aria-live="polite">${l.status}</p><p class="muted">Left/right arrows to feel along the lock; Space or Enter to lift. Escape to leave. Controller: D-pad, A, B.</p>
  <div class="btns"><button class="dfbtn" id="lp-left" aria-label="Move pick left">← Left</button><button class="dfbtn" id="lp-lift">Lift pin</button><button class="dfbtn" id="lp-right" aria-label="Move pick right">Right →</button><button class="dfbtn" id="lp-cancel">Leave lock</button></div>`, 'lockpick');
  for (const action of ['left', 'right', 'lift', 'cancel']) $('#lp-' + action).onclick = () => lockpickInput(action);
}

// ---------------------------------------------------------------- interaction
const USE_RANGE = 2.6;
function interact() {
  const c = Engine.cam;
  const e = Engine.pick(G.ents, USE_RANGE);
  if (e && !e.dead) {
    if (e.kind === 'npc') { talk(e); return; }
    if (e.kind === 'item') { pickUp(e); return; }
    if (e.kind === 'deco' && e.use) { useDeco(e); return; }
    if (e.kind === 'enemy') { if (e.def.core) msg(`Stand close, and you can hear someone murmuring inside the bell: "${coreMurmur(e)}"`, 'voice'); else msg(e.def.desc, ''); return; }
    if (e.kind === 'deco') { msg(decoLabel(e), '', 2500); return; }
  }
  // proximity fallback: items and usable things just in front of you
  let best = null, bd = 1e9;
  for (const o of G.ents) { if (o.hidden || o.dead || (o.kind !== 'item' && !(o.kind === 'deco' && o.use) && o.kind !== 'npc')) continue; const d = Math.sqrt(dist2(o.x, o.y, c.x, c.y)); if (d > 1.6 + (o.radius || 0)) continue; const ang = Math.abs(normAng(Math.atan2(o.y - c.y, o.x - c.x) - c.dir)); if (ang < 0.8 && d < bd) { bd = d; best = o; } }
  if (best) { if (best.kind === 'item') pickUp(best); else if (best.kind === 'npc') talk(best); else useDeco(best); return; }
  const w = Engine.pickWall(2.0);
  if (w && w.cell.door) {
    const cell = w.cell, key = w.y * G.map.w + w.x;
    if (cell.locked) {
      const ok = cell.locked === 'pass' ? G.has('pass') : (cell.locked === '__never' ? false : !!G.flags[cell.locked]);
      if (!ok) { msg(cell.lockMsg || 'It is locked.', 'warn', 4500); return; }
    }
    if (cell.lockDifficulty && !cell.locked) {
      const lockKey = mechanicalLockKey(cell, w.x, w.y);
      if (!G.flags[lockKey] && beginLockpick(cell, lockKey, cell.lockDifficulty, () => { G.map.doors[key].target = 1; })) return;
    }
    if (cell.portal) { Audio_.sfx.door(); transfer(cell.portal); return; }
    const d = G.map.doors[key]; d.target = d.target > 0.5 ? 0 : 1; Audio_.sfx.door(); addNoise(0.8); return;
  }
  if (w) msg(wallLabel(w.cell), '', 1800);
}
function decoLabel(e) { return e.label || ({ oak: 'An iron-bark oak. When the wind moves it, it rings like bronze.', lamp: 'A hush-lamp. Its reed-whistle never lets the street go silent.', crates: 'Crates, iron-banded.', bones: 'Bones, and a torn cloth. A hound\'s bed: no sound carries here.', pump: 'A steam pump. Hollows work these.', bed: 'A straw bed.', table: 'A table.', shelf: 'Shelves of ledgers and jars.', hearth: 'A hearth, kept low.', chair: 'A chair with a sap-mark chalked on it.', sign: 'A signpost. The boards have been scraped blank.', grate: 'The tannery culvert. Beyond it, the Hedge. At the dead hour, it speaks.', lever: 'A sluice lever. It is chained.', bore: 'The bore.', cores: 'Crates of glass cores.', burlsick: 'One of the burl-sick. Roots in the skin. They do not see you.' })[e.sprite] || 'Something.'; }
function wallLabel(cell) { return ({ t_hedge: 'The Hedge. Three men deep of thorn and packed wool.', t_glassrock: 'Rock veined with green-gold glass. It is faintly warm, and it hums.', t_marble: 'Old marble.', t_greymarble: 'Drowned marble, grey-white, furred with lilac lichen to the waterline.', t_catacomb: 'Burial niches, five deep. Somebody has strung lilac thread across the skulls.', t_mausoleum: 'Violet marble, carved with staves of music from floor to vault. Put your ear to it and it hums.', t_deepwood: 'Silver willow, trunk against trunk, too thick to pass. The fronds move when nothing else does.', t_brass: 'Riveted brass. Verdigris.', t_house: 'Plaster and oak timber.', t_wood: 'Old planks.', t_stone: 'Cold stone.', t_door: 'A door.' })[cell.tex] || 'A wall.'; }
function pickUp(e, theftConfirmed = false) {
  if (e.dead || e.hidden) return;
  if (e.owner && lawActive() && !ITEMS[e.item].key && !theftConfirmed) { confirmTheft(e); return; }
  if (e.item === 'cache' && e.tier >= 2) {
    const key = mechanicalLockKey(e);
    if (!G.flags[key] && beginLockpick(e, key, Math.min(3, e.tier), () => pickUp(e))) return;
  }
  const it = ITEMS[e.item]; e.hidden = true; e.dead = true; Audio_.sfx.pickup();
  if (e.item === 'cache') { openCache(e); return; }
  if (e.item === 'sovereigns') { const n = rndi(4, 14); G.gold(n); msg(`You find ${n} sovereigns.`, 'good'); return; }
  if (e.item === 'pellets') { G.player.pellets += 3; msg('You find three pellets of glass shot.', 'good'); return; }
  if (it.armor || it.weapon || it.valuable || it.use === 'ammo') { msg(`You take ${gainItem(e.item)}.`, 'good', 3500); return; }
  G.give(e.item); msg(`You take the ${it.name}.`, 'good');
  wgPickUp(e);
  if (e.item === 'coil') journal('main', 'I have the reverse-phase coil from Depot Three. Kaelen wants it brought to his hut outside the Hedge.');
}
function useItem(slot) {
  const it = ITEMS[slot.id], p = G.player;
  if (it.use === 'distraction') { closeModal(); G.state = 'play'; throwDistraction(slot.id); return; }
  if (it.use === 'heal') { p.hp = Math.min(p.hpMax, p.hp + it.n); G.take(slot.id); if (needsOn()) { p.hunger = clamp(p.hunger + 35, 0, 100); msg('Honey, raw egg and willow-bark. You feel a little less like dying, and less empty.', 'good'); } else msg('Honey, raw egg and willow-bark. You feel a little less like dying.', 'good'); }
  else if (it.use === 'voice') { p.voice = Math.min(p.voiceMax, p.voice + it.n); G.take(slot.id); if (needsOn()) { p.hunger = clamp(p.hunger + 35, 0, 100); msg('The honey eases your throat, and the hollow under your ribs.', 'good'); } else msg('The honey eases your throat.', 'good'); }
  else if (it.use === 'ammo') { const k = it.ammo || 'pellets'; p[k] = (p[k] || 0) + it.n; G.take(slot.id); msg(k === 'bolts' ? 'You fill your quiver.' : 'You load three pellets.', 'good'); }
  else if (it.armor) { if (isWorn(slot.id)) removeArmor(it.slot); else equipArmor(slot.id); }
  else if (it.weapon) { G.take(slot.id); if (!p.weapons.includes(it.weapon)) { p.weapons.push(it.weapon); msg(`You ready the ${it.name}.`, 'good'); } else { G.give(slot.id); msg('You already carry one of those. Sell the spare.', '', 2500); } }
  else if (it.use === 'whistle') { G.whistleT = 25; G.stillT = 0; msg('You blow the reed-whistle. A thin, steady note the hounds do not care for and the Hush cannot get past.', 'good'); Audio_.sfx.song(1760, 0.6); }
  else if (it.use === 'bottle') { G.take(slot.id); closeModal(); G.state = 'play'; msg('You unstop the bottle. A woman\'s voice says, very clearly, "Tell Merret the tide\'s wrong." Then the hounds come.', 'bad', 7000); Audio_.sfx.voice(); addNoise(6); setTimeout(spawnHound, 800); setTimeout(spawnHound, 1600); return; }
  else msg(it.desc, '', 6000);
  renderInventory();
}
function useDeco(e) {
  if (useLawDeco(e)) return;
  if (e.use === 'stable') { openStable(); return; }
  if (e.bodyCover) { msg('A shrouded body recess. Drag a body within reach, then G / touch Body / controller left stick to conceal it. Hidden remains can be recovered here during this visit.', 'warn', 6500); return; }
  if (e.use === 'note_reliquary') { openNoteLock(e); return; }
  if (e.use === 'pressure_plate') { openPressurePlate(e); return; }
  if (e.use === 'turning_mirror' || e.use === 'mirror_lantern') { openTurningMirror(e); return; }
  if (e.trapType) { inspectTrap(e); return; }
  if (wildsUse(e) || codaUse(e) || wgUse(e)) return;
  if (e.use === 'crates') {
    if (G.flags.greening || G.flags.part3 || G.flags.part4) { msg('The mast-ladder sways over the square. Not now.', '', 3000); return; }
    if (!G.flags.crates_heard) { G.flags.crates_heard = true; ['Annet Sowerby', 'Corwin Aye', 'Mirren Salk'].forEach(n => G.ledger.push({ name: n, where: 'the Kestrel\'s hold', day: G.day })); }
    showEvent('The crates in the hold', 'You go up the mast-ladder and down through the open hatch into the Kestrel\'s hold: twelve crates, lashed, stencilled for the quarry garrison. You put your ear to the wood. Thirty-six lilac spheres, you would guess by the weight, each in its straw. For a long moment nothing. Then, very small, through the side of the crate: <i>"Is somebody there? I\'m Annet. Annet Sowerby. I\'m six. What\'s your name?"</i><br><br>You do not answer. You have learned that much. From further in, two more voices, each saying only a name, over and over, the way a person says a thing they are afraid of losing: Corwin Aye. Mirren Salk.', [{ t: 'Step away from the crates', f: () => { if (G.flags.crates_logged) return; G.flags.crates_logged = true; journal('side', 'The crates in the corsair\'s hold are full of glass cores. One of them is a six-year-old called Annet Sowerby. I wrote the names in my ledger.'); } }]);
    Audio_.sfx.voice();
  } else if (e.use === 'plinth') {
    showEvent('The empty bell-frame', 'An oak frame built for four bells, and four hooks, and nothing on them. Somebody has chalked on the crossbeam, in a careful hand: <i>TAKEN FOR BORE-TEETH, 417 SR. THEY RANG IN E.</i> Under it, smaller and newer: <i>the Hedge can whistle. who taught it.</i>' + (G.flags.rite_ready ? '<br><br>The Flambeau\'s people have hung a glass-fire lamp where the tenor bell was. It is singing one note, very quietly, and your teeth ache with it.' : ''), [{ t: 'Step back', f: () => { if (!G.flags.plinth_read) { G.flags.plinth_read = true; journal('side', 'The chapel\'s bells were taken for bore-teeth in 417. They rang in E. Somebody has asked, in chalk, who taught the Hedge to whistle.'); } } }]);
  } else if (e.use === 'tanner_key') {
    if (G.flags.culvert_open) { msg('The nail is empty. You have the key.', '', 2500); return; }
    G.flags.culvert_open = true; Audio_.sfx.pickup(); msg('You take the culvert key off its nail. It is cold, and there is a tag on it in a child\'s hand: JOSS + WYN DO NOT.', 'good', 7000);
    journal('side', 'I took the culvert key from the tannery. The grate in the south hedge, by the Flume, can be opened now. The Fenning twins went down it after their dog and did not come up.');
  } else if (e.use === 'twins') {
    if (!G.flags.twins_found) G.flags.twins_found = true;
    showEvent('Two small coats', 'Two coats, a child\'s and a child\'s, folded square on the crate the way you fold a coat when you mean to come back for it. Beside them, a dog\'s collar, and the leather of it has been chewed through from the inside.<br><br>There is nothing else of them here. Whatever came up the culvert for the dog did not leave bones. It left the coats, because coats do not sing.', [
      { t: 'Write their names in your ledger: Ned and Wyn.', f: () => { if (!G.flags.twins_named) { G.flags.twins_named = true; G.ledger.push({ name: 'Ned Fenning', where: 'the Under-hedge', day: G.day }); G.ledger.push({ name: 'Wyn Fenning', where: 'the Under-hedge', day: G.day }); journal('side', 'I found the Fenning twins\' coats folded in the Under-hedge. I wrote Ned and Wyn in my ledger. Abner Fenning should be told.'); } } },
      { t: 'Leave them folded.', f: () => { if (G.flags.twins_logged || G.flags.twins_named) return; G.flags.twins_logged = true; journal('side', 'I found the Fenning twins\' coats folded in the Under-hedge. There was nothing else. Abner Fenning should be told.'); } },
    ]);
  } else if (e.use === 'bore') {
    if (G.flags.bore_broken) { msg('The bit is snapped. The Root is drinking the reservoir, and growing.', 'warn'); return; }
    if (G.flags.bore_seated) { msg('The coil is seated. Hold the room until the lock throws.', 'warn'); return; }
    if (!G.has('coil')) { msg('The casing has a lock, a brass socket the size of a fist, that wants a coil you do not have.', 'warn', 5000); return; }
    G.flags.bore_seated = true; G.take('coil'); Audio_.sfx.song(174, 3);
    showEvent('The Siphon Casing', 'You seat the reverse-phase coil in the lock. For three seconds nothing happens, and in those three seconds you hear, under the grinding, what is under the grinding: five notes, a Cantor\'s lullaby, held by something so tired it keeps losing the tune.<br><br>Then the lock throws. The whole casing drops a quarter-tone. Somewhere above, a woman in white begins to sing the falling fifth against the bore, and the Root turns toward her voice like a face.<br><br>From the boiler galleries, steam. The golems are coming to the noise.', [{ t: 'Hold the room', f: () => { startBoreFight(); } }]);
  }
}
function startBoreFight() {
  const cs = G.map.casingRoom; const spots = [[cs.x + 0.8, cs.y + 0.8], [cs.x + cs.w - 0.8, cs.y + cs.h - 0.8], [cs.x + 0.8, cs.y + cs.h - 0.8]];
  G.boreGolems = 0; G.boreHold = 75;
  for (const [x, y] of spots.slice(0, 2)) { const e = hydrate({ kind: 'enemy', type: 'golem', x, y }); e.state = 'chase'; e.onDeath = () => { G.boreGolems--; if (G.boreGolems <= 0) finishBore(); }; G.boreGolems++; G.ents.push(e); }
  Audio_.sfx.golem(); journal('main', 'The coil is seated and the lock has thrown. Steam Golems have come to the casing. I must hold the room until the bit snaps.');
}
function finishBore() {
  if (G.flags.bore_broken) return; G.boreHold = 0;
  G.flags.bore_broken = true; G.flags.greening = true; Audio_.sfx.crack(); fx('green', 2500);
  G.maps.oakhaven = buildOakhaven(true);
  if (G.mapId === 'oakhaven') { const c = Engine.cam; loadMap('oakhaven', { x: c.x, y: c.y, dir: c.dir }); }
  G.escapeTimer = 300;
  showEvent('The Greening', 'The bit snaps. You hear it go, a sound like a bell dropped down a well.<br><br>Then, from a speaking-tube on the wall, the Governor\'s voice, small and tinny from four hundred feet above: <i>"Sixty seconds on the reservoir gates. Anyone below, get to the cage."</i> And then, not raised, because it has not risen in years: <i>"Get to the cage. I\'m counting. Forty-one. Forty."</i> The reservoir dumps forty thousand gallons into an open wound. The Root drinks it. And screams. And cracks. And begins to grow.<br><br>Leaves are coming up the shaft behind you. The oaks in the town above are doubling and ringing. The Drift-Kestrel is at the mooring mast, and she takes children first, four to a line.', [{ t: 'Get out', f: () => { journal('main', 'The bit is snapped and the Root is Greening. Oakhaven is going under in an hour. I must climb — the shaft, the headframe, the North Gate — and reach the mooring mast on the east side of the square before the oaks close over it.'); msg('GET OUT. Up the shaft, up the headframe, through the gate, to the mooring mast.', 'bad', 9000); } }]);
}

// ---------------------------------------------------------------- events & triggers
function showEvent(title, html, choices) { try { releaseMouse(); } catch (e) { /* not ready yet */ }
  G.state = 'event'; const p = $('#event-panel');
  p.innerHTML = `<h2>${title}</h2><p>${html}</p><div class="list" style="margin-top:1cqh">${choices.map((c, i) => `<button class="dfbtn" data-i="${i}">${c.t}</button>`).join('')}</div>`;
  show('#event');
  p.querySelectorAll('button').forEach(b => b.onclick = () => { hide('#event'); G.state = 'play'; G.keys = {}; const ch = choices[+b.dataset.i]; if (ch.f) ch.f(); });
}
function checkTriggers() {
  const c = Engine.cam;
  for (const t of G.map.triggers) {
    if (dist2(c.x, c.y, t.x, t.y) > t.r * t.r) { t.inside = false; continue; }
    if (t.inside) continue; t.inside = true;
    if (wildsTrigger(t) || codaTrigger(t) || wgTrigger(t)) continue;
    if (t.id === 'hound_bed' && !t.done) { t.done = true; msg('A hound\'s bed: a patch of ground a little longer than a big dog, where the dew has not formed. No sound carries over it for a day. Your own footsteps arrive by bone.', 'warn', 6000); }
    if (t.id === 'hedge_voice' && !t.done) {
      t.done = true; Audio_.sfx.voice();
      const who = G.flags.bio_brother ? 'your brother\'s' : (G.flags.bio_coast ? 'a first mate you once left in the water' : 'someone you buried');
      showEvent('A voice beyond the Hedge', `From the culvert, from the far side of three men\'s depth of thorn and wool, a voice you know says your name. <i>"${G.player.name}."</i> It is ${who} voice. It gets it exactly right, the way it used to say it when you were in trouble.<br><br><i>"There\'s a way through. I can show you. Just say you\'re there."</i>`, [
        { t: 'Say nothing. Never answer a voice you cannot see.', f: () => { G.flags.hedge_silent = true; msg('You say nothing. After a while it tries Lyra\'s voice, and then a child\'s, and then it stops.', 'warn', 7000); journal('side', 'Something in the Hedge by the tannery culvert spoke to me in a voice I knew. I did not answer.'); } },
        { t: 'Answer it. Just once.', f: () => { G.flags.hedge_answered = true; addNoise(5); msg('"I\'m here," you say. The voice laughs, warmly, and says it again — in your voice, this time. Something has learned you.', 'bad', 8000); journal('side', 'I answered the voice in the Hedge. It said my name back to me in my own voice. It knows me now, and it can follow a voice anywhere.'); setTimeout(() => { for (let i = 0; i < 3; i++) spawnHound(); }, 1200); } },
        { t: 'Stand and listen, and say nothing.', f: () => { G.flags.hedge_listened = true; msg('You listen. Under the voice, if you hold very still, there is a second sound: a great many people, very far down, all saying different things at once.', 'voice', 8000); } },
      ]);
    }
    if (t.id === 'mast') {
      if (G.flags.part3 || G.flags.part4) continue;   // Part Two's ending happens once; later parts never replay it
      if (!G.flags.greening) { if (!t.said) { t.said = true; msg('The Drift-Kestrel hangs from the mast, her lift-tanks murmuring. Six feet of rope coil on the deck. Nobody is aboard who will talk to you yet.', '', 6000); } continue; }
      // the thing that learned your voice at the Hedge does not come where people are (Book One ch. 23); it sends the hounds in your voice
      if (G.flags.hedge_answered && !G.flags.mast_voice) {
        G.flags.mast_voice = true; Audio_.sfx.voice(); addNoise(4);
        for (let i = 0; i < 3; i++) spawnHound();
        msg('From the thorn behind the mast, something that sounds exactly like you says: "Grab the line." It followed your voice here, and it will not come into the light where the town is. The hounds will.', 'bad', 8000);
        continue;
      }
      if (G.flags.hedge_answered && G.ents.some(o => o.kind === 'enemy' && o.type === 'hound' && !o.dead && !o.hidden && dist2(o.x, o.y, c.x, c.y) < 144)) continue;
      ending();
    }
  }
}

// ---------------------------------------------------------------- death & ending
function die(src) {
  if (G.dead) return; G.dragBody = null; G.dead = true; $('#cover-status').hidden = true; G.state = 'dead'; G.player.hp = 0;
  const t = $('#death-title'), x = $('#death-text');
  if (src === 'heartglass') { t.textContent = 'Heartglass.'; x.textContent = 'The glass reaches your heart. You hear the Chorister clearly now, every note of its lullaby, and you understand that it has been singing to you the whole time. You stand very still. You will stand there a long time, humming, alive and aware.'; }
  else if (src === 'unwrite') { t.textContent = 'Too still.'; x.textContent = 'You lost warmth first, then your name, then your outline. Something leaned in through the thin place and took you the way it takes everything: slowly, consciously, without end.'; }
  else if (src === 'greening') { t.textContent = 'The oaks close over.'; x.textContent = 'You hear the ship lift without you. Three hundred and eighty people stand in the mud and wave it away, and you are one of them, and then you are a tree.'; }
  else { t.textContent = 'You have been found.'; x.textContent = `${src} has you. The last thing you hear is your own voice, coming from somewhere else, saying your name.`; }
  if (hardcoreOn()) {
    // Permadeath: the run's only save is destroyed before the screen is drawn, and
    // the lamp that drags ordinary travellers back is taken away for this one.
    HARDCORE.save = null;
    const stale = $('#btn-auto-load'); if (stale) stale.remove();
    x.textContent += ' Hardcore: the one copy of this run is gone with you. There is nothing to go back to.';
    const wake = document.getElementById('btn-wake'); if (wake) wake.hidden = true;
    let btn = document.getElementById('btn-hardcore-title');
    if (!btn) {
      btn = document.createElement('button'); btn.className = 'dfbtn'; btn.id = 'btn-hardcore-title';
      const host = document.querySelector('#death .death-inner') || (wake && wake.parentNode);
      if (host) host.appendChild(btn);
    }
    btn.textContent = 'The run ends here';
    btn.onclick = () => {
      G.player.hardcore = false; hide('#death'); G.dead = false; G.keys = {}; closeModal();
      G.state = 'title'; $('#view').classList.remove('unwrite'); $('#msgs').innerHTML = ''; show('#title'); Audio_.setScene('title');
    };
  } else {
    const wake = document.getElementById('btn-wake'); if (wake) wake.hidden = false;
    const hc = document.getElementById('btn-hardcore-title'); if (hc) hc.hidden = true;
  }
  show('#death');
}
$('#btn-wake').onclick = () => {
  if (hardcoreOn()) return; // a hardcore run does not wake by the lamp
  hide('#death'); G.dead = false; G.state = 'play'; const p = G.player; p.hp = Math.ceil(p.hpMax * 0.6); p.voice = Math.ceil(p.voiceMax * 0.5); p.gold = Math.max(0, p.gold - 5);
  if (p.glass >= 100) p.glass = 85;
  for (const e of G.ents) if (e.kind === 'enemy' && !e.dead && e.state === 'chase') { e.state = 'idle'; e.x = e.homeX; e.y = e.homeY; }
  if (G.flags.greening && !G.flags.escaped) G.escapeTimer = Math.max(G.escapeTimer, 150);
  const s = G.map.spawn; Engine.cam.x = s.x; Engine.cam.y = s.y; Engine.cam.dir = s.dir; G.stillT = 0; G.noise = 2;
  msg('You wake by the lamp. Somebody dragged you. Nobody will say who.', 'warn', 6000);
};
function ending() {
  if (G.state === 'ending') return; G.state = 'ending'; G.runs = (G.runs || 0) + 1; G.flags.escaped = true; G.escapeTimer = 0; G.boreHold = 0; G.dead = false; hide('#death'); hide('#event'); closeModal();
  const p = G.player, f = G.flags; const names = G.ledger.length;
  const lines = [];
  const rope = typeof ROPE45 !== 'undefined' ? (() => { try { return ROPE45.endLines(); } catch (e) { return []; } })() : [];
  if (rope.length) lines.push(...rope);
  else {
    lines.push(`The mooring mast is taken by a tree. Mags cuts you free. Vane turns the Kestrel toward the town instead of away, and the children come up the rope four to a line${f.vane_told ? ', because you made him hear what was in his hold, and a man who has heard it does not fly away from children' : ''}.`);
    lines.push(`On the last load the Governor is at the bottom, because he has been loading his town onto that rope for twenty minutes. The line snags in a crown. Vane counts to ten. Aldric Vance looks up and waves you on. "Do it," says Kaelen. Six feet of cut rope will hang from the drum for four days.`);
  }
  if (f.hedge_answered) lines.push(`Behind you, where the thing that wore your voice burst, there is a patch of ground where no sound will carry for a day. You will hear your own name in the wrong mouth for the rest of your life, and you will know it is your fault, and you will be right.`);
  else if (f.hedge_silent && !((f.g44 | 0) >= 5 && (f.g44_gate | 0) >= 3)) lines.push(`At the Hedge, as the ship lifts, something speaks to the town in the voices of its dead and offers a way through. You said nothing when it spoke to you. You wonder, every night after, who answered.`);
  if (f.pim_safe) lines.push(`The Carders came up the rope first, because a boy whose hands have been hummed clean once already knows how to hold a line${f.pim_tended ? ', and because he asked for the stranger who did it different from Lyra, and would not go up until you nodded' : ''}. Nell Carder has his coat pockets full of mill-flour. It is the only Oakhaven anyone will carry away.`);
  const tamWalked = typeof MEADOW49 !== 'undefined' ? MEADOW49.endLine() : null;   // he walked out on Massday (js/meadow49.js)
  if (tamWalked) lines.push(tamWalked);
  else if (f.tam_told) lines.push(`When the oaks began to ring, Old Tam walked out into the water-meadow singing The Miller\'s Daughter, all the verses, at the top of a voice he had been saving. The hounds went to him and not to the rope. He knew the whole song. It had only ever known the second verse.`);
  else if (f.tam_left) lines.push(`Old Tam was not at the rope. Afterward somebody said they had heard him at the Flume crossing, singing the second verse with somebody, in a voice that was not quite his.`);
  if (f.twins_named) lines.push(`Ned and Wyn Fenning are in your ledger. Abner Fenning put out the lamp in their window before he climbed, which is the first thing he has been able to do for them in a month.`);
  if (typeof GREEN44 !== 'undefined') { try { lines.push(...GREEN44.endLines()); } catch (e) { /* the walk is optional */ } }
  if (f.boots_delivered && !f.g44_orla) lines.push(`Lyra sang Orla Hale down proper, all the lines, even the fourth, while the tree closed over her. The boots were on the chair. You put them there.`);
  if (G.has('charts')) lines.push(`Tobiah Marsh's charts are in your shirt, with Revision Seven and the margin: on failure of the hold, slippage is to be absorbed by the source. Kaelen reads it twice and says nothing for an hour. Then he starts a list of names on a deck-beam.`);
  if (f.sable_returned) lines.push(`Umber does not come to the rope. She stands in the mist outside the Hedge with the Veil's leaves under her coat and two fragments left, the taste of the Veil's bread and a name she will not say${f.sable_accused ? '; you told her she owed it, and she paid, and she does not hold it against you, which is somehow harder' : ''}, and watches the ship go, and writes it down. Hew Callan comes up the rope behind the Carders, saying his own name${f.hew_home ? ', with Mags Harker\'s hand in his' : ''}.`);
  else if (f.sable_kept) lines.push(`Umber keeps all three of her fragments and every name you gave her, and watches the Reach go from the mist, and says, to nobody: "Entry. The stranger asked me to keep myself. I did. I am not yet certain it was right." Somewhere under the quarry, a Hollow at the pumps is still counting.`);
  else if (f.sable_met) lines.push(`Somewhere in the mist outside the Hedge, a runaway of the Veil who asked you for three names is still waiting by a hush-lamp, and writing down that you did not come.`);
  if (names > 0) lines.push(`You have ${names} name${names === 1 ? '' : 's'} in your ledger${names >= 6 ? ', which is more than most people carry out of the Reach alive' : ''}. ${names >= 3 ? 'Annet Sowerby, six years old, is in the hold, in a crate, in her straw, and she is not lost. She is filed. There is a scribe at Whisper-Grove who knows how to read a name back.' : 'Everyone who ever kept such a list before you was the Catalogue. You intend to be something else.'}`);
  if (p.glassed) lines.push(`Your tideline is ${p.glass >= 70 ? 'past the collarbone, three inches from the throat' : 'four and a half fingers from the shoulder'}. ${p.glass >= 70 ? 'Six weeks, at the current rate.' : 'Eight weeks of slack, perhaps.'} Somewhere in the glass a hundred-and-forty-year-old man is listening to everything you say, and tonight, for the first time, his argument sounds to you like mercy.`);
  lines.push(`Three hundred and eighty people stand in the mud and wave the ship away. The Kestrel leaps a hundred and fifty feet, and from four miles back a whole voice sings the calling-song after you. The course is set for Whisper-Grove${f.sable_met ? ', because a runaway of the Veil in the mist said the order\'s last archivist is still in the drowned city, reading names to the forgotten' : ', where a Veil scribe is said to read names to the forgotten'}.`);
  lines.push(`<span class="muted">Here ends Part Two of The Silenced Province. ${G.runs > 1 ? `The Tide-Weaver notes that this is the ${['second', 'third', 'fourth', 'fifth'][Math.min(3, G.runs - 2)]} thread he has watched you walk. "It is still kind," he says.` : 'The Tide-Weaver has watched this thread before. He does not say so.'}</span>`);
  $('#ending-title').textContent = 'Grab the Line';
  $('#ending-text').innerHTML = lines.map(l => `<p>${l}</p>`).join('');
  $('#btn-part3').classList.toggle('hidden', !!f.part3);
  show('#ending'); Audio_.setScene('inside');
}
$('#btn-part3').onclick = () => startPart3();
$('#btn-again').onclick = () => { hide('#ending'); show('#title'); G.state = 'title'; };

// ---------------------------------------------------------------- dialogue
const DLG = { npc: null, tone: 'normal', log: [] };
// What a bell murmurs: its own last things, never another core's. The blue jug is Tamsin Reed's (Book One ch. 2, 5).
const CORE_MURMURS = [
  '...{first}... home by dark, I said I would be home by dark...',
  '...{first}... the key is under the step, under the step...',
  '...{first}... did somebody feed the hens... somebody feed the hens...',
  '...{first}... it is my turn at the well, it is my turn...',
  '...{first}... tell them I was not late, I was on my way...',
  '...{first}... the good knife is in the drawer, not the other...',
];
function coreMurmur(e) {
  const name = e && e.name ? String(e.name) : '';
  if (name === 'Tamsin Reed') return '...the blue jug, Mam. Not the white. The blue one...';
  const first = name ? name.split(' ')[0].toLowerCase() : 'home';
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return CORE_MURMURS[Math.abs(h) % CORE_MURMURS.length].replace('{first}', first);
}
function talk(e) {
  if (canPickpocket(e)) e.facing = Math.atan2(Engine.cam.y - e.y, Engine.cam.x - e.x);
  if (e.lawGuard && lawActive() && crimeState().bounty) { renderArrest(); return; }
  if (wildsTalk(e)) return;
  if (e.id === 'hollow' && e.restore === 'hew' && G.flags.sable_returned) { talkHew(e); return; }
  if (e.id === 'cat') { talkCat(e); return; }
  if (e.id === 'lamplighter') { talkLamplighter(e); return; }
  if (e.id === 'bettis') { talkBettis(e); return; }
  if (e.id === 'hollow') { msg(`The Hollow repeats, to no one: "${e.lines[rndi(0, e.lines.length - 1)]}"`, 'voice', 5000); return; }
  const n = NPCS[e.id]; if (!n) return;
  DLG.npc = n; DLG.ent = e; DLG.log = []; G.state = 'dialogue'; Audio_.sfx.ui();
  const q = n.quest ? n.quest(G) : null; DLG.choices = null;
  if (q) { DLG.log.push({ who: 'them', t: q.text }); if (q.journal) journal(q.journal[0], q.journal[1]); if (q.choices) DLG.choices = q.choices; }
  else DLG.log.push({ who: 'them', t: n.greet[DLG.tone] });
  renderDialogue(DLG.choices ? 'choice' : null);
}
// ---------------------------------------------------------------- trade
const TYPE_NAME = { iron: 'iron', glass: 'glass', shot: 'glass shot', bronze: 'bell-bronze, rings', bolt: 'iron bolts' };
function itemStats(id) {
  const it = ITEMS[id]; if (!it) return '';
  if (it.armor) { const cur = worn(it.slot); const diff = cur ? it.ar - cur.ar : it.ar;
    return `${ARMOR_SLOTS.find(x => x[0] === it.slot)[1]} · AR ${it.ar}${cur && cur !== ARMOR[id] ? ` (${diff >= 0 ? '+' : ''}${diff})` : ''} · ${it.noise > 0 ? `noise +${it.noise}` : it.noise < 0 ? `hushes ${it.noise}` : 'silent'}`; }
  if (it.weapon) { const w = WEAPONS[it.weapon]; return `${w.dmg[0]}–${w.dmg[1]} · reach ${w.reach} · ${TYPE_NAME[w.type]}${w.twoHanded ? ' · two hands' : ''}${w.ammo ? ` · uses ${w.ammo}` : ''}`; }
  if (it.valuable) return 'valuable';
  if (it.use === 'ammo') return `${it.n} ${it.ammo || 'pellets'}`;
  return it.use === 'heal' ? `+${it.n} health` : it.use === 'voice' ? `+${it.n} voice` : '';
}
function buyPrice(n, e) { if (e.price) return e.price; const v = ITEMS[e.item].value || 1; return Math.max(1, Math.round(v * (n.markup || 1) * (1.12 - G.player.attrs.Personality / 400))); }
function sellPrice(id) { const it = ITEMS[id], v = it.value || 0; return Math.max(1, Math.floor(v * ((it.valuable ? 0.7 : 0.33) + G.player.attrs.Personality / 600))); }
function itemCat(id) { const it = ITEMS[id]; return it.armor ? 'armor' : it.weapon ? 'weapon' : it.valuable ? 'valuable' : (it.use && !it.key && it.value) ? 'consumable' : null; }
function sellables(n) {
  const buys = (n.shopTalk && n.shopTalk.buys) || ['valuable'], p = G.player, out = [];
  for (const sl of p.inv) { const it = ITEMS[sl.id]; if (!it || it.key || !it.value || !buys.includes(itemCat(sl.id))) continue; const k = spareCount(sl.id); if (k > 0) out.push({ id: sl.id, n: k }); }
  if (buys.includes('weapon')) for (const w of p.weapons) if (!WEAPONS[w].innate && WEAPONS[w].value && ITEMS['w_' + w]) out.push({ id: 'w_' + w, readied: w });
  return out;
}
function shopRows(n) {
  return n.shop.map((e, i) => { const it = ITEMS[e.item], owned = it.weapon && G.player.weapons.includes(it.weapon), price = buyPrice(n, e);
    return `<button class="dfbtn small shoprow${owned ? ' owned' : ''}${price > G.player.gold ? ' dear' : ''}" data-buy="${i}" title="${it.desc.replace(/"/g, '&quot;')}"><b>${it.name}</b><span>${itemStats(e.item)}${owned ? ' · carried' : isWorn(e.item) ? ' · worn' : ''}</span><em>${price}</em></button>`; }).join('');
}
function sellRows(n) {
  const L = sellables(n);
  if (!L.length) return '<span class="muted" style="align-self:center">Nothing you carry interests them. (Worn armour and your last weapon stay with you.)</span>';
  return L.map((e, i) => `<button class="dfbtn small shoprow" data-sell="${i}" title="${ITEMS[e.id].desc.replace(/"/g, '&quot;')}"><b>${ITEMS[e.id].name}${e.n > 1 ? ` ×${e.n}` : ''}</b><span>${itemStats(e.id)}${e.readied ? ' · readied' : ''}</span><em>${sellPrice(e.id)}</em></button>`).join('');
}
function renderDialogue(mode) {
  const n = DLG.npc;
  const html = `<h2>${n.name.split(',')[0]}</h2><div class="dlg"><div class="port"><img src="img/p_${n.portrait}.jpg" alt=""><div class="name">${n.name}</div></div>
  <div class="col"><div class="log" id="dlg-log">${DLG.log.map(l => `<div class="${l.who}">${l.who === 'you' ? '— ' : ''}${l.t}</div>`).join('')}</div>
  <div class="btns"><button class="dfbtn small ${mode === 'tell' ? 'sel' : ''}" id="d-tell">Tell me about…</button><button class="dfbtn small ${mode === 'where' ? 'sel' : ''}" id="d-where">Where is…</button>${n.shop ? `<button class="dfbtn small ${mode === 'buy' ? 'sel' : ''}" id="d-buy">Buy…</button><button class="dfbtn small ${mode === 'sell' ? 'sel' : ''}" id="d-sell">Sell…</button>` : ''}${DLG.choices ? `<button class="dfbtn small ${mode === 'choice' ? 'sel' : ''}" id="d-answer">Answer…</button>` : ''}
  <span class="tone">${['polite', 'normal', 'blunt'].map(t => `<button class="dfbtn small ${DLG.tone === t ? 'sel' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</span>
  <button class="dfbtn small" id="d-bye">Goodbye</button></div>
  <div class="topics${mode === 'choice' ? ' wide' : ''}${mode === 'buy' || mode === 'sell' ? ' shop' : ''}${mode === 'tell' || mode === 'where' ? ' pick' : ''}" id="d-topics">${mode === 'tell' ? TOPIC_KEYS.map(t => `<button class="dfbtn small" data-topic="${t}">${t}</button>`).join('') : mode === 'where' ? Object.keys(placeSet() ? placeSet().list : PLACES).map(t => `<button class="dfbtn small" data-place="${t}">${t}</button>`).join('') : (mode === 'buy' || mode === 'sell') && n.shop ? `<div class="purse">You have <b>${G.player.gold}</b> sovereigns · prices in sovereigns${mode === 'sell' ? ' · they pay' : ''}</div>` + (mode === 'buy' ? shopRows(n) : sellRows(n)) : mode === 'choice' && DLG.choices ? DLG.choices.map((c, i) => `<button class="dfbtn small" data-choice="${i}">${c.t}</button>`).join('') : ''}</div></div></div>`;
  openModal(html, 'dialogue');
  const log = $('#dlg-log'); log.scrollTop = log.scrollHeight;
  $('#d-tell').onclick = () => renderDialogue(mode === 'tell' ? null : 'tell');
  $('#d-where').onclick = () => renderDialogue(mode === 'where' ? null : 'where');
  $('#d-bye').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('.tone button').forEach(b => b.onclick = () => { DLG.tone = b.dataset.t; renderDialogue(mode); });
  document.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { askTopic(b.dataset.topic); renderDialogue('tell'); });
  document.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { askPlace(b.dataset.place); renderDialogue('where'); });
  const st = n.shopTalk || {};
  const bb = $('#d-buy'); if (bb) bb.onclick = () => { if (mode !== 'buy' && st.hello && !DLG.helloSaid) { DLG.helloSaid = true; DLG.log.push({ who: 'them', t: st.hello }); } renderDialogue(mode === 'buy' ? null : 'buy'); };
  const sb = $('#d-sell'); if (sb) sb.onclick = () => renderDialogue(mode === 'sell' ? null : 'sell');
  document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
    const e = sellables(n)[+b.dataset.sell]; if (!e) return; const p = G.player, price = sellPrice(e.id);
    if (e.readied) {
      const i = p.weapons.indexOf(e.readied); const cur = p.weapons[p.weapon];
      p.weapons.splice(i, 1); if (!p.weapons.length) p.weapons.push('hands');
      p.weapon = Math.max(0, p.weapons.indexOf(cur)); if (p.weapons[p.weapon] !== cur) p.weapon = 0;
    } else G.take(e.id);
    p.gold += price; Audio_.sfx.pickup();
    DLG.log.push({ who: 'you', t: `The ${ITEMS[e.id].name}. ${price} sovereigns?` }); DLG.log.push({ who: 'them', t: ['Done.', 'Fair. Near enough.', 'I\'ll find a use for it.', 'Hm. Done.'][rndi(0, 3)] });
    renderDialogue('sell');
  });
  const ab = $('#d-answer'); if (ab) ab.onclick = () => renderDialogue(mode === 'choice' ? null : 'choice');
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const e = n.shop[+b.dataset.buy]; const p = G.player, I = ITEMS[e.item], price = buyPrice(n, e);
    if (I.weapon && p.weapons.includes(I.weapon)) { DLG.log.push({ who: 'them', t: 'You\'ve one of those already. One will do.' }); renderDialogue('buy'); return; }
    if (p.gold < price) { DLG.log.push({ who: 'them', t: st.broke || 'Not for what you have in your purse, love.' }); renderDialogue('buy'); return; }
    p.gold -= price; const got = gainItem(e.item); Audio_.sfx.pickup();
    const thanks = st.thanks || ['There. Keep it wrapped.', 'Softly with the coin; it rings.', 'Blessings of the Narrow.'];
    DLG.log.push({ who: 'you', t: `I\'ll take the ${I.name}.` }); DLG.log.push({ who: 'them', t: thanks[rndi(0, thanks.length - 1)] + (/put it on/.test(got) ? ' (You put it on.)' : '') }); renderDialogue('buy');
  });
  document.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => {
    const ch = DLG.choices[+b.dataset.choice]; DLG.log.push({ who: 'you', t: ch.t }); DLG.choices = null; Audio_.sfx.ui();
    const reply = ch.f ? ch.f(G) : null; if (reply) DLG.log.push({ who: 'them', t: reply });
    renderDialogue();
  });
}
function askTopic(t) {
  const n = DLG.npc, p = G.player; DLG.log.push({ who: 'you', t: `Tell me about ${t}.` });
  const pers = p.attrs.Personality;
  if (DLG.tone === 'blunt' && Math.random() < 0.45 - pers / 300) { DLG.log.push({ who: 'them', t: ['Lower your voice and ask me again like a person.', 'I have nothing to say to that tone.', 'No.'][rndi(0, 2)] }); return; }
  let ans = n.topics[t];
  if (!ans) {
    const tier = (n.tier === 'high' || (DLG.tone === 'polite' && pers >= 55 && Math.random() < 0.6)) ? 'high' : 'low';
    ans = TOPICS[t][tier];
    if (n.rumour && Math.random() < 0.35) ans = 'I couldn\'t say. But I\'ll tell you what I heard: ' + RUMOURS[rndi(0, RUMOURS.length - 1)];
  }
  if (DLG.tone === 'polite' && Math.random() < 0.3) ans += ' ' + ['Blessings of the Narrow on you.', 'Keep your voice low, friend.', 'Mind how you go.'][rndi(0, 2)];
  DLG.log.push({ who: 'them', t: ans });
  // quest-relevant tells
  if (t === 'Kaelen Vance' && !G.flags.need_gate && G.flags.lyra_met) { G.flags.need_gate = true; }
}
const PLACE_POS = { tavern: [29.5, 17.5], lyra_house: [21.5, 29.5], greenhall: [30.5, 9.5], surgery: [17.5, 15.5], gate: [23.5, 1.5], mast: [36.5, 22.5], orla_house: [29.5, 40.5], culvert: [23.5, 60.5], market: [52.5, 17.5], mill: [57.5, 9.5], chapel: [48.5, 10.5], flume: [53.5, 47.5], tannery: [15.5, 56.5] };
function askPlace(place) {
  const ps = placeSet(), wg = !!ps, hub = ps ? ps.hub : 'oakhaven';
  const pos = ps ? ps.list[place] : PLACE_POS[PLACES[place]]; if (!pos) return; const [tx, ty] = pos; DLG.log.push({ who: 'you', t: `Where is ${place}?` });
  let from = [Engine.cam.x, Engine.cam.y], pre = '';
  if (G.mapId !== hub) {
    const oh = G.maps[hub]; const idx = G.mapId === 'underhedge' ? -1 : oh.cells.findIndex(c => c && c.portal && c.portal.map === G.mapId);
    if (idx >= 0) { from = [idx % oh.w + 0.5, (idx / oh.w | 0) + 0.5]; pre = 'Out the door, then '; }
    else { DLG.log.push({ who: 'them', t: wg ? (G.mapId === 'belfry' ? (/bell-tower/.test(place) ? 'You are standing in it.' : `That is in ${ps.name}. Down the tower stair, west through the hall of tombs, and out of the Mausoleum's front door.`) : `That is in ${ps.name}, back the way you came.`) : 'That is in Oakhaven. You are a long way from Oakhaven.' }); return; }
  }
  const dx = tx - from[0], dy = ty - from[1]; const d = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx); const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const dname = dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  const paces = Math.round(d * 6);
  const t = d < 2 ? `You are standing at it.` : `${pre}${dname}${pre ? '' : ' of here'}, about ${paces} paces. ${d > 12 ? (G.flags.part4 ? 'Keep to the open moss between the willows, and if anything sings to you out of the trees, do not answer it.' : G.flags.part3 ? 'Wade; keep to the dry marble where you can, and walk round the Hollows, not through them.' : 'Follow the cobbles; keep your voice down past the oaks.') : 'You cannot miss it.'}`;
  DLG.log.push({ who: 'them', t: t.charAt(0).toUpperCase() + t.slice(1) });
}

// ---------------------------------------------------------------- panels
// Catalog-only SVG layers: imported save text never becomes SVG markup.
function inventoryDoll(p = G.player) {
  const equipped = slot => worn(slot, p);
  const body = equipped('body'), head = equipped('head'), hands = equipped('hands'), feet = equipped('feet');
  const metal = a => a && /Mail|Iron|Bell-|Brigandine/.test(a.name);
  const color = a => !a ? '#665343' : a === ARMOR.a_synodrobe ? '#8a9290' : /Hush/.test(a.name) ? '#354f49' : metal(a) ? '#849094' : /Leather/.test(a.name) ? '#805437' : '#9b805b';
  const weapon = WEAPONS[p.weapons[p.weapon]] || WEAPONS.sword;
  const shield = equipped('shield'), blocked = !!weapon.twoHanded;
  const weaponId = p.weapons[p.weapon];
  let weaponArt;
  if (weapon.ranged) weaponArt = '<path d="M44 94L62 59L69 62L53 99Z" fill="#71513a"/><path d="M39 62Q58 42 78 66L61 62Z" fill="#a7aaa2"/><path d="M39 62L78 66" stroke="#dfcca0"/>';
  else if (weapon.blunt) weaponArt = '<path d="M48 99L36 43" stroke="#77573c" stroke-width="5"/><path d="M25 39L42 35L47 50L29 55Z" fill="#b29b69"/>';
  else if (weaponId === 'axe') weaponArt = '<path d="M48 99L38 39" stroke="#77573c" stroke-width="5"/><path d="M36 41Q16 30 22 60L40 53Z" fill="#a7b1af"/>';
  else weaponArt = `<path d="M47 96L${weaponId === 'dagger' ? '39 66L34 59L33 69' : '30 29L26 20L26 31'}Z" fill="#c4d1cc" stroke="#777f80"/><path d="M35 82L49 78M43 82L48 99" stroke="#c2a369" stroke-width="4"/>`;
  const labels = ARMOR_SLOTS.map(([slot, label]) => { const a = equipped(slot); return `${label}: ${a ? a.name : 'none'}${slot === 'shield' && a && blocked ? ' (stowed; two-handed weapon)' : ''}`; });
  return `<figure class="paper-doll"><div class="doll-heading">THE TRAVELLER <span>Equipment study · I</span></div>
  <svg viewBox="0 0 180 200" role="img" aria-label="Equipment paper doll"><title>${labels.join('; ')}; Weapon: ${weapon.name}</title>
  <defs><radialGradient id="doll-light"><stop stop-color="#6a5840"/><stop offset="1" stop-color="#211b17"/></radialGradient><pattern id="doll-mail" width="5" height="4" patternUnits="userSpaceOnUse"><path d="M0 1L2 3L5 1" fill="none" stroke="#c3c9c2" stroke-width=".7"/></pattern></defs>
  <rect x="5" y="5" width="170" height="190" rx="70" fill="url(#doll-light)" stroke="#8d744a"/><path d="M90 12V186M15 100H165" stroke="#c0a36b" opacity=".12"/>
  <ellipse cx="90" cy="180" rx="40" ry="7" fill="#110e0d"/>
  <g stroke="#221c1a" stroke-width="2" stroke-linejoin="round">
  <path d="M73 111L87 113L85 169L72 169ZM94 113L108 111L109 169L96 169Z" fill="#483e38"/>
  <path d="M67 64L54 72L44 111L54 116L69 88M112 64L125 73L136 111L126 116L111 88" fill="${color(body)}"/>
  <path d="M71 60L108 60L117 118L65 118Z" fill="${color(body)}"/>
  ${body && metal(body) ? `<path d="M74 65L105 65L111 109L70 109Z" fill="${/Chain/.test(body.name) ? 'url(#doll-mail)' : '#9aa4a2'}"/><path d="M78 68V106M102 68V106" stroke="#c6c3a8"/>` : '<path d="M78 66L75 110M86 66V111M97 66L101 110" stroke="#af9469" opacity=".5"/>'}
  ${body === ARMOR.a_synodrobe ? '<path d="M67 109L113 109L123 166H58Z" fill="#8a9290"/><path d="M81 63V143L90 152L100 143V63" fill="none" stroke="#c8c9b2" stroke-width="5"/><path d="M90 81V104M83 92H97" stroke="#514c39"/>' : ''}
  <path d="M67 110H115V118H67Z" fill="#322923"/><rect x="85" y="110" width="10" height="8" fill="#c5a866"/>
  <path d="M83 51V63L90 68L98 61V50" fill="#ae8063"/>
  <ellipse cx="90" cy="39" rx="15" ry="20" fill="#b99070"/>
  ${head ? `<path d="M73 40Q69 14 90 15Q112 15 107 41L101 47L101 30H79V47Z" fill="${color(head)}"/>${metal(head) ? '<path d="M67 32Q90 24 113 32L110 37H70Z" fill="#a9b1aa"/>' : ''}` : '<path d="M75 35Q69 14 90 17Q110 14 106 36L100 26L80 28Z" fill="#46352c"/>'}
  <path d="M81 39H85M96 39H100M86 50Q91 53 96 49" fill="none" stroke="#594438"/>
  <path d="M45 107L55 111L54 125L44 122ZM126 111L136 107L138 122L128 125Z" fill="${hands ? color(hands) : '#b99070'}"/>
  <path d="M72 152H85V176L65 178L65 170L72 168ZM96 152H109V168L117 171V178L96 176Z" fill="${feet ? color(feet) : '#67503c'}"/>
  ${feet && metal(feet) ? '<path d="M75 155V170M100 155V170" stroke="#d1d1bc"/>' : ''}
  ${weaponArt}
  ${shield && !blocked ? `<path d="M120 86L145 91L142 119L130 ${shield.name.includes('Kite') ? '145' : '128'}L117 118Z" fill="#6d5140" stroke="#b8a16b" stroke-width="3"/><path d="M130 95L130 123M122 106H139" stroke="#b8a16b"/>` : ''}
  </g></svg><figcaption><img src="img/face_${[1, 2, 3, 4, 5, 6].includes(p.face) ? p.face : 1}.jpg" alt="Chosen character portrait" width="28" height="28"> ${weapon.name}${shield && blocked ? ' · shield stowed' : ''}</figcaption></figure>`;
}
function renderInventory() {
  const p = G.player, AR = armorRating(), AN = armorNoise();
  const slots = ARMOR_SLOTS.map(([slot, label]) => { const a = worn(slot), off = slot === 'shield' && a && shieldBlocked();
    return `<div class="slot${a ? '' : ' empty'}${off ? ' off' : ''}"><span class="sl">${label}</span><span class="nm"><b>${a ? a.name : '—'}</b><small>${a ? `AR ${a.ar}${a.noise ? ` · ${a.noise > 0 ? '+' : ''}${a.noise} noise` : ''}${off ? ' · no free hand' : ''}` : ''}</small></span>${a ? `<button class="dfbtn small" data-off="${slot}">Off</button>` : '<span></span>'}</div>`; }).join('');
  const weps = p.weapons.map((w, i) => { const W = WEAPONS[w];
    return `<button class="dfbtn small weprow ${i === p.weapon ? 'sel' : ''}" data-w="${i}"><b>${i < 9 ? i + 1 + '. ' : ''}${W.name}</b><span>${W.dmg[0]}–${W.dmg[1]} · reach ${W.reach} · ${TYPE_NAME[W.type]}${W.twoHanded ? ' · two hands' : ''}${W.ammo ? ` · ${p[W.ammo] || 0} ${W.ammo}` : ''}</span></button>`; }).join('');
  const rows = p.inv.map((sl, i) => { const it = ITEMS[sl.id]; const wornIt = isWorn(sl.id);
    const act = it.armor ? `<button class="dfbtn small" data-use="${i}">${wornIt ? 'Remove' : 'Wear'}</button>` : it.weapon ? `<button class="dfbtn small" data-use="${i}">${p.weapons.includes(it.weapon) ? 'Spare' : 'Ready'}</button>` : it.use && it.use !== 'cache' ? `<button class="dfbtn small" data-use="${i}">${(it.use === 'moor_book' || it.use === 'lib_book') ? 'Read' : 'Use'}</button>` : '';
    const st = [itemStats(sl.id), it.value && !it.key ? `worth ~${sellPrice(sl.id)}` : ''].filter(Boolean).join(' · ');
    return `<tr class="${wornIt ? 'worn' : ''}"><td><span class="nm">${it.name}${sl.n > 1 ? ` ×${sl.n}` : ''}</span>${wornIt ? '<span class="tag">worn</span>' : ''}${st ? `<span class="muted st">${st}</span>` : ''}<span class="muted ds">${it.desc}</span></td><td class="n">${act}</td></tr>`; }).join('');
  openModal(`<h2>Inventory</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted cover-note">${disguiseStatus()} · Y opens cover details</p>
  <p class="muted invtop">${p.gold} sovereigns · ${p.pellets} glass pellets${p.bolts ? ` · ${p.bolts} bolts` : ''} · Fatigue ${Math.round(p.fat)}/${p.fatMax}</p>
  <div class="invgrid"><div>${inventoryDoll(p)}<h3>Worn — Armour Rating ${AR}</h3><div class="slots">${slots}</div>
  <p class="muted small-note">${AN > 0.05 ? `Your armour adds ${AN.toFixed(1)} to the noise you make while you move (more when you run).` : AN < -0.05 ? `Your clothes hush you: ${AN.toFixed(1)} to the noise you make while you move.` : 'Your armour is quiet.'} Steel turns blades and fists well, and the Cacophony's static poorly.</p>
  <h3>Weapons</h3><div class="weps">${weps}</div></div>
  <div><h3>Carried</h3><div class="carry"><table>${rows || '<tr><td class="muted">Nothing but the clothes you came in.</td></tr>'}</table></div></div></div>`, 'inv');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('[data-use]').forEach(b => b.onclick = () => useItem(p.inv[+b.dataset.use]));
  document.querySelectorAll('[data-off]').forEach(b => b.onclick = () => { removeArmor(b.dataset.off); renderInventory(); });
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { p.weapon = +b.dataset.w; renderInventory(); });
}
function renderCharacter() {
  const p = G.player; const stage = p.glass >= 100 ? 'Heartglass' : p.glass >= 40 ? 'Set' : p.glass >= 15 ? 'Frost' : p.glass > 0 ? 'Ringing' : 'Unglassed';
  openModal(`<h2>${p.name}</h2><button class="dfbtn small close" id="x">Close</button><div class="row"><div class="col" style="flex:0 0 18cqw"><img src="img/face_${[1, 2, 3, 4, 5, 6].includes(p.face) ? p.face : 1}.jpg" style="width:16cqw;height:16cqw;border:2px solid #0b0806"><p class="muted">${p.cls.name}<br>Level ${p.level} · ${p.xp} xp<br>${p.cls.hz}</p></div>
  <div class="col"><div class="attrs">${ATTRS.map(a => `<div><span>${a}</span><b>${p.attrs[a]}</b></div>`).join('')}</div>
  <h3>Vitals</h3><div>Health ${Math.ceil(p.hp)} / ${p.hpMax}</div><div class="bar-h"><i style="width:${100 * p.hp / p.hpMax}%;background:var(--red)"></i></div>
  <div>Fatigue ${Math.round(p.fat)} / ${p.fatMax}</div><div class="bar-h"><i style="width:${100 * p.fat / p.fatMax}%;background:var(--green)"></i></div>
  <div>Voice ${Math.round(p.voice)} / ${p.voiceMax}</div><div class="bar-h"><i style="width:${100 * p.voice / p.voiceMax}%;background:var(--blue)"></i></div>
  ${p.glassed ? `<div>Glassing — ${stage} (${Math.round(p.glass)}%)</div><div class="bar-h"><i style="width:${p.glass}%;background:#6fd6e0"></i></div>` : ''}
  ${p.fragments ? `<div>Identity fragments left: ${p.fragments}</div>` : ''}
  <div>Armour Rating ${armorRating()} · armour noise ${armorNoise() > 0 ? '+' : ''}${armorNoise().toFixed(1)} · ${currentWeapon().name}</div>
  <p class="muted">${disguiseStatus()}</p>
  ${needsLine() ? `<p class="muted">${needsLine()}</p>` : ''}
  ${typeof Weather !== 'undefined' && Weather.state !== 'clear' ? `<p class="muted">Sky: ${weatherLine()} · ${Math.max(1, Math.round(Weather.left * 60))} minutes of it left${Weather.state === 'storm' || Weather.state === 'rain' ? ', and the road is slow and loud' : ''}</p>` : ''}
  <p class="muted">Kills ${p.kills} · Names kept ${G.ledger.length} · ${p.gold} sovereigns<br>Oakhaven bounty ${crimeState().bounty} · Assaults ${crimeState().assaults} · Escapes ${crimeState().escapes}<br>Jail served ${crimeState().jailHours} hours${crimeState().custody ? ' · In custody' : ''}${crimeState().evidence ? ' · Gear held in watch-house evidence' : ''}</p></div></div>`, 'char');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
}
function renderLog() {
  const main = G.journal.filter(j => j.cat === 'main'), side = G.journal.filter(j => j.cat === 'side');
  // journal text is plain prose: strip angle brackets here too, not only when a save is loaded
  const fmt = (j) => `<p><span class="muted">${DAYS[(j.day | 0) % 8] || DAYS[0]} —</span> ${String(j.text == null ? '' : j.text).replace(/[<>]/g, '')}</p>`;
  openModal(`<h2>Logbook</h2><button class="dfbtn small close" id="x">Close</button><p class="muted">${DAYS[G.day % 8]}, autumn, 419 SR · ${timeName()}</p><h3>The Rite</h3>${main.map(fmt).join('')}<h3>Other matters</h3>${side.map(fmt).join('') || '<p class="muted">Nothing yet.</p>'}`, 'log');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
}
function renderLedger() {
  openModal(`<h2>The Ledger</h2><button class="dfbtn small close" id="x">Close</button><p class="muted">Every Carillon Legionnaire dies saying a name. Whoever keeps the list, keeps them.</p>
  <table>${G.ledger.map((l, i) => `<tr><td class="n">Entry ${i + 1}</td><td>${l.name}</td><td class="muted">${l.where}, ${DAYS[l.day % 8]}</td></tr>`).join('') || '<tr><td class="muted">No entries. You have not yet been close enough to a bell when it stopped.</td></tr>'}</table>`, 'ledger');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
}
function renderSongs() {
  const p = G.player;
  openModal(`<h2>Song-book</h2><button class="dfbtn small close" id="x">Close</button><p class="muted">Voice ${Math.round(p.voice)} / ${p.voiceMax}. Every song is sound, and sound is the predator's sense. Cast with F1–F${p.songs.length}.</p>
  <table>${p.songs.map((s, i) => `<tr><td class="n">F${i + 1}</td><td><b style="color:var(--gold)">${SONGS[s].name}</b> <span class="muted">${SONGS[s].hz ? SONGS[s].hz + ' Hz' : 'under the breath'}</span><br><span class="muted">${SONGS[s].desc}</span></td><td class="n">${SONGS[s].cost} voice<br>${'♪'.repeat(Math.ceil(SONGS[s].noise))}<br><button class="dfbtn small" data-s="${s}">Sing</button></td></tr>`).join('')}</table>`, 'songs');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { closeModal(); G.state = 'play'; castSong(b.dataset.s); });
}
function renderRest() {
  if (G.mapId === 'watchhouse' && crimeState().custody) { renderPrison(); return; }
  if (G.escapeTimer > 0 || G.boreHold > 0) { G.state = 'play'; msg('There is no time to rest. Not now.', 'bad', 2500); return; }
  if (G.ents.some(e => e.kind === 'enemy' && !e.dead && !e.hidden && e.state === 'chase' && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 144)) { G.state = 'play'; msg('You cannot rest with enemies nearby.', 'bad', 2500); return; }
  const lampNear = G.ents.some(e => e.sprite === 'lamp' && !e.hidden && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 12) || G.mapId.includes('house') || G.mapId === 'tavern';
  openModal(`<h2>Rest</h2><button class="dfbtn small close" id="x">Close</button><p class="q">Every rest asks who holds the line tonight.</p><p class="muted">${G.map.siphoned ? 'This is siphoned country. A sleeper who goes truly silent is a door left open.' : lampNear ? 'There is a hush-lamp burning. Its reed will not let the room go silent.' : 'No lamp near. The night will be very quiet.'}</p>
  <div class="list"><button class="dfbtn" data-r="self">I hold the line myself <small class="muted">— half rest. If something comes, you hear it.</small></button>
  <button class="dfbtn" data-r="lamp" ${lampNear ? '' : 'disabled'}>Trust the lamp <small class="muted">— full rest, if a lamp is near.</small></button>
  <button class="dfbtn" data-r="dark">Let the dark take the watch <small class="muted">— full rest. ${G.map.siphoned ? 'Something will lean in, and take a little.' : 'You will sleep deeply, and loudly.'}</small></button></div>`, 'rest');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { closeModal(); G.state = 'play'; doRest(b.dataset.r); });
}
function doRest(kind) {
  const p = G.player; const hours = kind === 'self' ? 4 : 8;
  passHours(hours);
  // A meal and a sleep are what a long road actually costs; hunger limits how much rest gives back.
  const gain = needsRecovery(), cap = fatCap();
  if (needsOn()) { p.sleep = 100; p.hunger = clamp(p.hunger + hours * 2, 0, 100); }
  if (kind === 'self') { p.hp = Math.min(p.hpMax, p.hp + (p.hpMax - p.hp) * 0.5 * gain); p.voice = Math.min(p.voiceMax, p.voice + (p.voiceMax - p.voice) * 0.5 * gain); p.fat = Math.min(cap, Math.max(p.fat, p.fatMax)); msg(`You rest four hours with your back to the wall and your hand on your weapon.`, 'good'); if (G.map.danger > 0 && Math.random() < 0.35) { msg('Something came to the fire while you dozed.', 'bad'); spawnHound(); spawnHound(); } }
  else if (kind === 'lamp') { p.hp = Math.min(p.hpMax, p.hp + (p.hpMax - p.hp) * gain); p.voice = Math.min(p.voiceMax, p.voice + (p.voiceMax - p.voice) * gain); p.fat = cap; msg('You sleep eight hours under the reed-whistle. Nothing comes.', 'good'); }
  else { p.hp = Math.min(p.hpMax, p.hp + (p.hpMax - p.hp) * gain); p.voice = Math.min(p.voiceMax, p.voice + (p.voiceMax - p.voice) * gain); p.fat = cap; if (G.map.siphoned) { p.hpMax = Math.max(8, p.hpMax - 3); p.hp = p.hpMax; msg('You slept like the dead, and the dead do not keep the Narrow. Something leaned in and took a little. You are a little less than you were.', 'bad', 8000); } else { msg('You sleep deeply, and snore, and in the morning the hush-lamp has burned out and nobody will say what they heard.', 'warn'); if (G.map.danger > 0) { spawnHound(); } } }
  G.noise = 2; G.stillT = 0;
}
// ---------------------------------------------------------------- optional journey needs
// Off by default. When enabled, time on the road costs food and sleep; hunger and
// sleeplessness scale fatigue recovery rather than adding hidden combat penalties.
function needsOn() { return !!(G.player && G.player.needs === true); }
function needsWarned() { return needsOn() && (G.player.hunger < 20 || G.player.sleep < 20); }
function needsSpent() { return needsOn() && (G.player.hunger <= 0 || G.player.sleep <= 0); }
function needsRecovery() { return needsWarned() ? 0.5 : 1; }
function fatCap() { const p = G.player; return needsSpent() ? p.fatMax * 0.5 : p.fatMax; }
function needsLine() {
  if (!needsOn()) return '';
  const p = G.player, h = Math.round(p.hunger), sl = Math.round(p.sleep);
  const word = p.hunger <= 0 ? 'famished' : p.hunger < 20 ? 'hungry' : p.hunger < 50 ? 'peckish' : 'fed';
  const rest = p.sleep <= 0 ? 'exhausted' : p.sleep < 20 ? 'weary' : p.sleep < 50 ? 'tired' : 'rested';
  return `Hunger ${h}/100 (${word}) · Sleep ${sl}/100 (${rest})`;
}
function drainNeeds(hours) {
  if (!needsOn() || !(hours > 0)) return;
  const p = G.player, mounted = typeof horseActive === 'function' && horseActive();
  const wasHungry = p.hunger < 20, wasWeary = p.sleep < 20;
  // Walking into weather costs more than walking in still air.
  const wx = (typeof Weather !== 'undefined' && G.map && G.map.outdoor) ? Weather.exposure() : 1;
  p.hunger = clamp(p.hunger - hours * (mounted ? 1 : 2) * wx, 0, 100);
  p.sleep = clamp(p.sleep - hours * 1.4, 0, 100);
  if (!wasHungry && p.hunger < 20) msg('Your stomach has been empty a while. You are hungry.', 'warn', 4200);
  if (!wasWeary && p.sleep < 20) msg('You have been awake too long. Your eyes keep closing.', 'warn', 4200);
  if (needsSpent()) p.fat = Math.min(p.fat, fatCap());
}
function passHours(hours) { G.tod += hours / 24; while (G.tod >= 1) { G.tod -= 1; G.day++; } tickCustody(hours); drainNeeds(hours); if (typeof Weather !== 'undefined') Weather.advance(hours); }
function timeName() { const h = G.tod * 24; return h < 5 ? 'the dead hour' : h < 7 ? 'before dawn' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 20 ? 'dusk' : 'night'; }
function renderMap() {
  const m = G.map; const cw = 4; const html = `<h2>${m.name}</h2><button class="dfbtn small close" id="x">Close</button><p class="muted">What you have walked. ${m.outdoor ? 'North is up.' : 'The automap remembers where the lamps were.'}</p><canvas id="amap" width="${m.w * cw}" height="${m.h * cw}" style="width:100%;max-height:70cqh;object-fit:contain;image-rendering:pixelated;background:#0a0806;border:2px solid #0b0806"></canvas>`;
  openModal(html, 'map'); $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  const cv = $('#amap'), cx = cv.getContext('2d');
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!m.visited[y * m.w + x]) continue;
    const c = m.cells[y * m.w + x];
    const fl = m.floorCells ? m.floorCells[y * m.w + x] : 0;
    const gz = (m.lvls || m.smooth) ? m.groundAt(x + 0.5, y + 0.5) : 0;
    const low = c && !c.door && c.top != null && c.top < gz + 0.9, tall = c && !c.door && c.top != null && c.top > gz + 1.3;
    cx.fillStyle = c ? (c.door ? '#d9a441' : low ? '#a89878' : tall ? '#4e4236' : (c.tex === 't_hedge' ? '#2f4a22' : '#7a6a58')) : (fl === 2 ? '#2f7a64' : fl === 1 ? '#4a3e30' : '#2a2219');
    cx.fillRect(x * cw, y * cw, cw, cw);
    // raised and sloped ground: lighter the higher it stands, hatched where too steep to climb
    if (!c && gz > 0.05) { cx.fillStyle = `rgba(232,214,160,${Math.min(0.42, gz * 0.16).toFixed(3)})`; cx.fillRect(x * cw, y * cw, cw, cw); }
    if (!c && m.smooth && m.gradeAt(x + 0.5, y + 0.5) > MAX_GRADE) { cx.fillStyle = '#7a3a28'; cx.fillRect(x * cw, y * cw + 1, cw, 1); cx.fillRect(x * cw, y * cw + 3, cw, 1); }
  }
  for (const e of G.ents) { if (e.hidden || e.dead) continue; if (!m.visited[(e.y | 0) * m.w + (e.x | 0)]) continue; cx.fillStyle = e.kind === 'npc' ? '#6fa0e0' : e.kind === 'enemy' ? '#d04030' : e.kind === 'item' ? '#e0d060' : null; if (cx.fillStyle && e.kind !== 'deco') cx.fillRect(e.x * cw - 1, e.y * cw - 1, 3, 3); }
  if (G.mapId === 'oakhaven') { cx.font = '7px "Alegreya SC", serif'; cx.textAlign = 'center'; cx.fillStyle = '#f0d890'; for (const [lbl, [px, py]] of Object.entries({ 'Gate': [23.5, 3], 'Boar': [29.5, 16.6], 'Greenhall': [30.5, 8.4], 'Lyra': [21.5, 31.6], 'Rooke': [17.5, 14.4], 'Mast': [36.5, 18.4], 'Market': [52.5, 15.2], 'Mill': [62, 8.6], 'Chapel': [49, 6.8], 'Tannery': [15.5, 59.4], 'Flume': [36, 50.4], 'Culvert': [23.5, 60.6], 'Orchard': [56, 31] })) { const i = ((py | 0) * m.w + (px | 0)); if (m.visited[i]) cx.fillText(lbl, px * cw, py * cw); } cx.textAlign = 'left'; }
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(Engine.cam.x * cw, Engine.cam.y * cw, 2.5, 0, 7); cx.fill();
  cx.strokeStyle = '#fff'; cx.beginPath(); cx.moveTo(Engine.cam.x * cw, Engine.cam.y * cw); cx.lineTo(Engine.cam.x * cw + Math.cos(Engine.cam.dir) * 7, Engine.cam.y * cw + Math.sin(Engine.cam.dir) * 7); cx.stroke();
}
function renderHelp() {
  openModal(`<h2>How to play</h2><button class="dfbtn small close" id="x">Close</button><pre class="help">${HELP_TEXT}</pre><h3>The Narrow</h3><p>This world has two predators and you live in the band between them. The amber bar on the HUD is how loud you are. Running, fighting, firing glass shot and singing push it up; above the upper mark, hounds come. Standing still in siphoned country (the quarry, the Root-vault) lets it fall; below the lower mark, the Hush begins to unwrite you. Murmur (<span class="kbd">N</span>) when you need to stand still.</p><p>Never answer a voice you cannot see. Glass shot breaks the Cacophony and does nothing to a quiet. A hound has to be hit with something that rings. Every Legionnaire dies saying a name; keep it.</p>`, 'help');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
}

// ---------------------------------------------------------------- input
const canvas = $('#view');
canvas.style.touchAction = 'none';
// control options (held for this session)
G.opts = { mouseLook: true, sens: 5, invertY: false, alwaysRun: false, touch: 'auto', captureMouse: true };
function saveOpts() { /* options live in memory for the session */ }
const sensK = () => 0.35 + clamp(G.opts.sens, 1, 10) * 0.13;
function canvasPos(ev) { const r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * VW, y: (ev.clientY - r.top) / r.height * VH }; }
// physical keys, so WASD works on any keyboard layout and Shift doesn't change the number keys
function keyOf(ev) {
  const c = ev.code || '';
  if (c.length === 4 && c.startsWith('Key')) return c[3].toLowerCase();
  if (c.startsWith('Digit')) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return c.slice(6);
  if (c === 'ShiftLeft' || c === 'ShiftRight') return 'shift';
  if (c === 'Space') return ' ';
  return (ev.key || '').toLowerCase();
}
function look(mx, my) { const k = sensK(); Engine.cam.dir += mx * 0.0032 * k; Engine.cam.pitch = clamp(Engine.cam.pitch - my * 0.16 * k * (G.opts.invertY ? -1 : 1), -40, 40); }
function cycleWeapon(d) { const p = G.player; if (!p || !p.weapons.length) return; p.weapon = (p.weapon + d + p.weapons.length) % p.weapons.length; msg(`${currentWeapon().name}.`, '', 1200); }
function swingLabel(dx, dy, th) { const len = Math.hypot(dx, dy); if (len <= th) return 'thrust'; if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'slash right' : 'slash left'; return dy > 0 ? 'chop down' : 'cut up'; }

// free look: moving the mouse over the view turns you; resting it near a side edge keeps turning.
// The preview frame can't capture the mouse, so this works with the cursor free (and right-drag works too).
const freeLook = () => G.opts.mouseLook && !G.touchMode;
let edgeTurn = 0;
// Captured mouse (Pointer Lock): one click on the view captures the mouse, so looking keeps working however far it
// moves and it can never wander off the window. Esc (or opening any panel) gives it back.
const mouseLocked = () => typeof document !== 'undefined' && document.pointerLockElement === canvas;
function captureMouse() {
  if (!canvas.requestPointerLock || mouseLocked()) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed here: free look still works */ }
}
function releaseMouse() { if (mouseLocked() && document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } } }
document.addEventListener('pointerlockchange', () => { edgeTurn = 0; G.mouse.down = false; G.mouse.rdown = false; $('#game').classList.toggle('mouse-locked', mouseLocked()); });
setInterval(() => { if (mouseLocked() && (G.state !== 'play' || G.openPanel || !G.opts.captureMouse)) releaseMouse(); }, 150);
// Full screen for the whole page (the game fits the screen it is given); Alt+Enter toggles it too.
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  try {
    if (isFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { const r = req.call(el); if (r && r.catch) r.catch(() => msg('Full screen is not available here.', 'warn', 3000)); }
  } catch (e) { msg('Full screen is not available here.', 'warn', 3000); }
}
window.addEventListener('keydown', (ev) => { if (ev.altKey && ev.key === 'Enter') { ev.preventDefault(); toggleFullscreen(); } });
canvas.addEventListener('mouseleave', () => { edgeTurn = 0; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  Audio_.init(); Audio_.resume();
  if (G.state !== 'play' || G.touchMode) return;
  const p = canvasPos(ev);
  if (ev.button === 2 || ev.button === 1) { G.mouse.rdown = true; ev.preventDefault(); return; }
  const locked = mouseLocked();
  if (!locked && p.y >= VIEW_H) { hudClick(p.x, p.y); return; }
  // the first click on the view only captures the mouse (no swing), so capturing never costs you a blow
  if (!locked && ev.button === 0 && freeLook() && G.opts.captureMouse && canvas.requestPointerLock) { captureMouse(); return; }
  G.mouse.down = true; G.mouse.sx = p.x; G.mouse.sy = p.y; G.mouse.ax = 0; G.mouse.ay = 0; G.mouse.t = performance.now();
});
window.addEventListener('mouseup', (ev) => {
  if (ev.button === 2 || ev.button === 1) { G.mouse.rdown = false; return; }
  if (!G.mouse.down) return; G.mouse.down = false;
  if (G.state !== 'play') return;
  let dx, dy, th;
  if (mouseLocked()) { const r = canvas.getBoundingClientRect(); dx = G.mouse.ax * VW / Math.max(1, r.width); dy = G.mouse.ay * VH / Math.max(1, r.height); th = 12; }
  else { const p = canvasPos(ev); dx = p.x - G.mouse.sx; dy = p.y - G.mouse.sy; th = 12; }
  const label = swingLabel(dx, dy, th);
  if (G.hintKind && label === 'thrust') { interact(); return; }
  attack(label);
});
window.addEventListener('mousemove', (ev) => {
  const p = canvasPos(ev); G.mouse.x = p.x; G.mouse.y = p.y;
  if (G.state !== 'play') return;
  const mx = ev.movementX || 0, my = ev.movementY || 0;
  const inView = p.y < VIEW_H && p.x >= 0 && p.x <= VW && p.y >= 0;
  const spike = Math.abs(mx) > 300 || Math.abs(my) > 300; // ignore the odd jump (window refocus, cursor warp)
  if (mouseLocked()) {
    edgeTurn = 0; if (spike) return;
    if (G.mouse.down) { G.mouse.ax += mx; G.mouse.ay += my; return; }   // holding the button: the movement is the swing
    look(mx, G.mouse.rdown ? my * 1.25 : my * 0.5); return;
  }
  if (G.mouse.rdown) { if (!spike) look(mx * 1.25, my * 1.25); edgeTurn = 0; return; }
  if (!freeLook() || G.mouse.down || !inView) { edgeTurn = 0; return; } // holding the left button: the drag becomes the swing, as in 1996; over the HUD: leave the view alone
  if (!spike) look(mx, my * 0.5);
  const e = p.x < VW * 0.07 ? -(1 - p.x / (VW * 0.07)) : p.x > VW * 0.93 ? (p.x - VW * 0.93) / (VW * 0.07) : 0;
  edgeTurn = clamp(e, -1, 1);
});
canvas.addEventListener('wheel', (ev) => {
  if (G.state !== 'play') return; ev.preventDefault();
  const now = performance.now(); if (now - (G.wheelT || 0) < 180) return; G.wheelT = now; cycleWeapon(ev.deltaY > 0 ? 1 : -1);
}, { passive: false });

// touch: left thumb is a floating stick, right thumb drags to look, tap to use or strike
const TS = { stick: null, sx: 0, sy: 0, lookId: null, lx: 0, ly: 0, lt: 0, travel: 0 };
const STICK_R = 20; // in 320x200 canvas pixels
function setTouchMode(on) {
  on = !!on; if (G.touchMode === on) return;
  G.touchMode = on; $('#game').classList.toggle('touchmode', on);
  if (on) edgeTurn = 0;
}
function stickShow(x, y) { const st = $('#t-stick'); st.style.left = (x / VW * 100) + '%'; st.style.top = (y / VH * 100) + '%'; st.classList.add('on'); $('#t-knob').style.left = '50%'; $('#t-knob').style.top = '50%'; }
function stickHide() { $('#t-stick').classList.remove('on'); G.touch.fx = 0; G.touch.fy = 0; }
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType !== 'touch') return;
  ev.preventDefault(); Audio_.init(); Audio_.resume();
  if (G.opts.touch !== 'off') setTouchMode(true);
  if (G.state !== 'play' || !G.touchMode) return;
  const p = canvasPos(ev);
  if (p.y >= VIEW_H) { hudClick(p.x, p.y); return; }
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
  if (p.x < VW * 0.45 && TS.stick === null) { TS.stick = ev.pointerId; TS.sx = p.x; TS.sy = p.y; stickShow(p.x, p.y); }
  else if (TS.lookId === null) { TS.lookId = ev.pointerId; TS.lx = ev.clientX; TS.ly = ev.clientY; TS.lt = performance.now(); TS.travel = 0; }
});
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'touch' || !G.touchMode) return;
  if (ev.pointerId === TS.stick) {
    const p = canvasPos(ev); let dx = p.x - TS.sx, dy = p.y - TS.sy; const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    const n = Math.min(1, d / STICK_R), dead = 0.18, k = n < dead ? 0 : (n - dead) / (1 - dead) / Math.max(n, 1e-6);
    G.touch.fx = dx / STICK_R * k; G.touch.fy = -dy / STICK_R * k;
    const kn = $('#t-knob').style; kn.left = (50 + dx / STICK_R * 50) + '%'; kn.top = (50 + dy / STICK_R * 50) + '%';
  } else if (ev.pointerId === TS.lookId) {
    const dx = ev.clientX - TS.lx, dy = ev.clientY - TS.ly; TS.lx = ev.clientX; TS.ly = ev.clientY; TS.travel += Math.abs(dx) + Math.abs(dy);
    const r = canvas.getBoundingClientRect(), scale = 900 / Math.max(300, r.width); // same feel on phone and tablet
    if (G.state === 'play') look(dx * 1.3 * scale, dy * 1.3 * scale);
  }
});
function touchEnd(ev) {
  if (ev.pointerType !== 'touch') return;
  if (ev.pointerId === TS.stick) { TS.stick = null; stickHide(); }
  else if (ev.pointerId === TS.lookId) {
    TS.lookId = null;
    if (ev.type === 'pointerup' && G.state === 'play' && TS.travel < 10 && performance.now() - TS.lt < 300) { if (G.hintKind) interact(); else attack('thrust'); }
  }
}
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);
// on-screen buttons. Swipe across STRIKE to slash, tap to thrust.
function tbtn(id, down, up) {
  const el = $(id); let sx = 0, sy = 0;
  el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); Audio_.init(); Audio_.resume(); sx = ev.clientX; sy = ev.clientY; el.classList.add('held'); try { el.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ } if (down) down(); });
  const end = (ev) => { if (!el.classList.contains('held')) return; el.classList.remove('held'); if (up && ev.type === 'pointerup' && G.state === 'play') up(ev.clientX - sx, ev.clientY - sy); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
tbtn('#t-atk', null, (dx, dy) => { const r = canvas.getBoundingClientRect(); attack(swingLabel(dx / r.width * VW, dy / r.height * VH, 6)); });
tbtn('#t-use', null, () => interact());
tbtn('#t-pocket', null, () => openPickpocket());
tbtn('#t-throw', null, () => openDistractions());
tbtn('#t-body', null, () => openBody());
tbtn('#t-cover', null, () => openDisguise());
tbtn('#t-run', () => { G.touch.run = !G.touch.run; $('#t-run').classList.toggle('lit', G.touch.run); });
tbtn('#t-song', () => { if (G.state === 'play') { G.state = 'panel'; renderSongs(); } });
// per-frame housekeeping for the control layer
function controlsTick() {
  if (G.state !== 'play') { edgeTurn = 0; if (TS.stick !== null) { TS.stick = null; stickHide(); } TS.lookId = null; }
  if (G.opts.touch === 'on' && !G.touchMode) setTouchMode(true);
  if (G.opts.touch === 'off' && G.touchMode) setTouchMode(false);
  if (G.state === 'play' && G.playStart == null) G.playStart = G.time;
  const showLock = G.state === 'play' && !G.touchMode && G.time > (G.playStart || 0) + 1.5 && G.time - (G.playStart || 0) < 45;
  if (showLock !== G._lockHint) { G._lockHint = showLock; $('#lockhint').classList.toggle('on', showLock); }
  $('#t-pocket').hidden = !G.touchMode || G.state !== 'play' || !pickpocketTarget();
  $('#t-body').hidden = !G.touchMode || G.state !== 'play' || !bodyTarget();
  $('#t-cover').hidden = !G.touchMode || G.state !== 'play' || !G.has('a_synodrobe');
  if (G.state !== 'play') $('#cover-status').hidden = true;
  const showTouch = G.state === 'play' && G.touchMode;
  if (showTouch !== G._touchUi) { G._touchUi = showTouch; $('#touchui').classList.toggle('on', showTouch); }
}
// a real mouse moving again hands control back from touch
window.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' && G.touchMode && G.opts.touch === 'auto' && (Math.abs(ev.movementX) + Math.abs(ev.movementY) > 6)) setTouchMode(false); });

window.addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  const k = keyOf(ev);
  if (['arrest', 'prison', 'wanted', 'theft'].includes(G.openPanel)) {
    const actions = { arrest: { '1': 'crime-pay', '2': 'crime-jail', '3': 'crime-bribe', '4': 'crime-threat', '5': 'crime-flee', escape: 'crime-flee' }, prison: { '1': 'prison-serve', enter: 'prison-serve', '2': 'prison-pay', escape: 'law-leave' }, wanted: { enter: 'law-leave', escape: 'law-leave' }, theft: { enter: 'crime-take', ' ': 'crime-take', escape: 'crime-leave' } };
    const id = actions[G.openPanel][k];
    if (id) { ev.preventDefault(); if (!ev.repeat) $('#' + id)?.click(); }
    return;
  }
  if (G.openPanel === 'disguise') {
    const id = { enter: 'cover-wear', ' ': 'cover-wear', escape: 'cover-leave' }[k];
    if (id) { ev.preventDefault(); if (!ev.repeat) $('#' + id).click(); }
    return;
  }
  if (G.openPanel === 'body') {
    const id = { enter: 'body-drag', ' ': 'body-drag', h: 'body-hide', escape: 'body-leave' }[k];
    if (id) { ev.preventDefault(); if (!ev.repeat) $('#' + id).click(); }
    return;
  }
  if (G.openPanel === 'distractions') {
    const id = { '1': 'throw-pebble', '2': 'throw-empty_bottle', escape: 'throw-leave' }[k];
    if (id) { ev.preventDefault(); if (!ev.repeat) $('#' + id).click(); }
    return;
  }
  if (G.openPanel === 'pickpocket') {
    const action = { enter: 'take', ' ': 'take', escape: 'leave' }[k];
    if (action) { ev.preventDefault(); if (!ev.repeat) pickpocketInput(action); }
    return;
  }
  if (G.openPanel === 'notelock') {
    const action = { arrowleft: 'left', arrowright: 'right', enter: 'play', ' ': 'play', l: 'listen', escape: 'leave' }[k];
    ev.preventDefault();
    if (!ev.repeat) { if (action) noteLockInput(action); else if (['1', '2', '3'].includes(k)) noteLockInput(Number(k) - 1); }
    return;
  }
  if (G.openPanel === 'pressureplate') {
    const action = { enter: 'toggle', ' ': 'toggle', escape: 'leave' }[k];
    ev.preventDefault();
    if (!ev.repeat && action) pressurePlateInput(action);
    return;
  }
  if (G.openPanel === 'mirror') {
    const action = { arrowleft: 'left', arrowright: 'right', enter: 'rotate', ' ': 'rotate', r: 'reset', escape: 'leave' }[k];
    ev.preventDefault();
    if (!ev.repeat) { if (action) turningMirrorInput(action); else if (['1', '2', '3'].includes(k)) turningMirrorInput(Number(k) - 1); }
    return;
  }
  if (G.openPanel === 'lockpick') {
    const action = { arrowleft: 'left', arrowright: 'right', ' ': 'lift', enter: 'lift', escape: 'cancel' }[k];
    if (action) { ev.preventDefault(); if (!ev.repeat || action === 'left' || action === 'right') lockpickInput(action); }
    return;
  }
  G.keys[k] = true;
  if (ev.repeat && !['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'shift'].includes(k)) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab', 'f1', 'f2', 'f3', 'f4', 'f5'].includes(k)) ev.preventDefault();
  if (G.state === 'play') {
    if (k === 'y') openDisguise();
    else if (k === 'g') openBody();
    else if (k === 'o') openDistractions();
    else if (k === 'p') openPickpocket();
    else if (k === 'e' || k === ' ') interact();
    else if (k === 'i') { G.state = 'panel'; renderInventory(); }
    else if (k === 'c') { G.state = 'panel'; renderCharacter(); }
    else if (k === 'l') { G.state = 'panel'; renderLog(); }
    else if (k === 'm') { G.state = 'panel'; renderMap(); }
    else if (k === 'r') { G.state = 'panel'; renderRest(); }
    else if (k === 'k') { G.state = 'panel'; renderLedger(); }
    else if (k === 'tab') { G.state = 'panel'; renderSongs(); }
    else if (k === 'h' || k === '?') { G.state = 'panel'; renderHelp(); }
    else if (k === 'n') castSong('murmur');
    else if (k === 'v') { const m = Audio_.toggleMute(); msg(m ? 'Sound off.' : 'Sound on.', '', 1200); }
    else if (k === 'b') { Audio_.music.enabled = !Audio_.music.enabled; msg(Audio_.music.enabled ? 'Music on.' : 'Music off.', '', 1200); }
    else if (k >= '1' && k <= '9' && k.length === 1) { const i = +k - 1; if (G.player.weapons[i]) { G.player.weapon = i; msg(`${WEAPONS[G.player.weapons[i]].name}.`, '', 1200); } }
    else if (k === 'capslock') { G.opts.alwaysRun = !G.opts.alwaysRun; saveOpts(); msg(G.opts.alwaysRun ? 'Always run: on (hold Shift to walk).' : 'Always run: off.', '', 1600); }
    else if (k === 'home' || k === 'z') { Engine.cam.pitch = 0; }
    else if (k.startsWith('f') && k.length === 2 && +k[1] >= 1) { const s = G.player.songs[+k[1] - 1]; if (s) castSong(s); }
    else if (k === 'escape') { G.state = 'panel'; renderMenu(); }
    else if (k === '`') { const d = $('#debug'); d.style.display = d.style.display === 'none' || !d.style.display ? 'block' : 'none'; }
  } else if (G.state === 'panel' || G.state === 'dialogue') {
    if (k === 'escape' || (G.state === 'panel' && (k === 'i' && G.openPanel === 'inv' || k === 'c' && G.openPanel === 'char' || k === 'l' && G.openPanel === 'log' || k === 'm' && G.openPanel === 'map' || k === 'k' && G.openPanel === 'ledger' || k === 'tab' && G.openPanel === 'songs' || k === 'h' && G.openPanel === 'help' || k === 'r' && G.openPanel === 'rest'))) { if (G.openPanel === 'loadtitle') { closeModal(); G.state = 'title'; show('#title'); } else { closeModal(); G.state = 'play'; } }
  } else if (G.state === 'intro') {
    if (k === 'enter' || k === ' ' || k === 'escape') { ev.preventDefault(); $('#btn-intro-skip').click(); }
  } else if (G.state === 'title') {
    const open = !$('#modal').classList.contains('hidden');
    if (open && (k === 'escape' || k === 'h')) closeModal(); else if (!open && k === 'enter' && !$('#title').classList.contains('hidden')) $('#btn-new').click();
  }
});
window.addEventListener('keyup', (ev) => { G.keys[keyOf(ev)] = false; });
window.addEventListener('blur', () => { G.keys = {}; G.mouse.down = false; G.mouse.rdown = false; G.turnV = 0; });

// HUD buttons (canvas coords)
const HUD_BTNS = [
  { x: 48, y: 155, w: 24, h: 11, t: 'CHAR', f: () => { G.state = 'panel'; renderCharacter(); } },
  { x: 74, y: 155, w: 24, h: 11, t: 'INV', f: () => { G.state = 'panel'; renderInventory(); } },
  { x: 100, y: 155, w: 24, h: 11, t: 'SONG', f: () => { G.state = 'panel'; renderSongs(); } },
  { x: 126, y: 155, w: 24, h: 11, t: 'LOG', f: () => { G.state = 'panel'; renderLog(); } },
  { x: 48, y: 168, w: 24, h: 11, t: 'MAP', f: () => { G.state = 'panel'; renderMap(); } },
  { x: 74, y: 168, w: 24, h: 11, t: 'REST', f: () => { G.state = 'panel'; renderRest(); } },
  { x: 100, y: 168, w: 24, h: 11, t: 'NAMES', f: () => { G.state = 'panel'; renderLedger(); } },
  { x: 126, y: 168, w: 24, h: 11, t: 'HELP', f: () => { G.state = 'panel'; renderHelp(); } },
  { x: 48, y: 181, w: 36, h: 11, t: 'MURMUR', f: () => castSong('murmur') },
  { x: 86, y: 181, w: 28, h: 11, t: 'SAVE', f: () => { G.state = 'panel'; renderMenu(); } },
  { x: 116, y: 181, w: 34, h: 11, t: 'WEAPON', f: () => cycleWeapon(1) },
];
function hudClick(x, y) { for (const b of HUD_BTNS) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { Audio_.sfx.ui(); b.f(); return; } }

// ---------------------------------------------------------------- update
function update(dt) {
  G.time += dt;
  if (G.state !== 'play') return;
  const p = G.player, c = Engine.cam, k = G.keys;
  const priorMap = G.map;
  tickLaw(dt); if (G.state !== 'play') return;
  // time of day: one game hour per 90 real seconds
  G.tod += dt / (90 * 24); if (G.tod >= 1) { G.tod -= 1; G.day++; }
  tickCustody(dt / 90); if (G.map !== priorMap) return;
  if (G.fadeT > 0) G.fadeT -= dt;
  // movement: a short ramp up and down so steps feel weighted rather than twitchy
  const runHeld = (G.opts.alwaysRun ? !k.shift : !!k.shift) || G.touch.run;
  const running = runHeld && p.fat > 0 && !G.dragBody;
  const spd = (2.6 + p.attrs.Speed / 60) * (running ? 1.7 : 1) * (G.webT > 0 ? 0.55 : 1) * (G.dragBody ? 0.5 : 1);
  let fwd = G.touch.fy, str = G.touch.fx;
  if (k.w || k.arrowup) fwd += 1;
  if (k.s || k.arrowdown) fwd -= 1;
  // swimming itself lives in upgrades.js (tickSwim + water-aware playerMove)
  if (k.d) str += 1;
  if (k.a) str -= 1;
  let mag = Math.hypot(fwd, str); if (mag > 1) { fwd /= mag; str /= mag; mag = 1; }
  const cs = Math.cos(c.dir), sn = Math.sin(c.dir);
  const wx = (cs * fwd - sn * str) * spd, wy = (sn * fwd + cs * str) * spd;
  const vel = G.vel, blend = 1 - Math.exp(-(mag > 0.05 ? 15 : 22) * dt);
  vel.x += (wx - vel.x) * blend; vel.y += (wy - vel.y) * blend;
  if (mag <= 0.05 && Math.hypot(vel.x, vel.y) < 0.03) { vel.x = 0; vel.y = 0; }
  if (vel.x || vel.y) { const r = playerMove(c, vel.x * dt, vel.y * dt); if (r.bx) vel.x = 0; if (r.by) vel.y = 0; }
  // --- elevation: climb steps and ramps, fall off ledges ------------------
  const ground = (G.map.lvls || G.map.smooth) ? G.map.groundAt(c.x, c.y) : 0;
  if (typeof p.feet !== 'number') p.feet = ground;
  if (ground > p.feet + 0.001) {
    // a slope carries you with it; a stair eases the eye up
    p.feet = ground - p.feet < 0.12 ? ground : Math.min(ground, p.feet + 3.2 * dt); p.fallV = 0; p.fallFrom = null;
  } else if (ground < p.feet - 0.001 && p.fallFrom == null && G.map.smooth && G.map.smooth[(c.y | 0) * G.map.w + (c.x | 0)] && p.feet - ground < SNAP_DOWN && G.map.gradeAt(c.x, c.y) <= MAX_GRADE) {
    p.feet = ground;   // walking down a hillside, not falling off it
  } else if (ground < p.feet - 0.001) {
    if (p.fallFrom == null) { p.fallFrom = p.feet; p.fallV = 0; }
    p.fallV = (p.fallV || 0) + 7 * dt;
    p.feet -= p.fallV * dt;
    // coming down over a rock face (not off a sheer edge) is a tumble
    if (G.map.smooth && G.map.gradeAt(c.x, c.y) > MAX_GRADE) p.tumble = true;
    if (p.feet <= ground && G.map.smooth && G.map.gradeAt(c.x, c.y) > MAX_GRADE) {
      // still on a face too steep to stand on: you tumble down it, and the
      // whole way down counts when you come to rest on ground you can stand on
      p.feet = ground; p.fallV = Math.min(p.fallV, 2.5); p.tumble = true;
    } else if (p.feet <= ground) {
      const drop = p.fallFrom - ground, tumbled = !!p.tumble; p.tumble = false;
      p.feet = ground; p.fallV = 0; p.fallFrom = null;
      if (drop > FALL_SAFE) {
        // a sheer drop hits hard; tumbling down a rock face is bruising, not a plunge
        const dmg = Math.max(1, Math.round((drop - FALL_SAFE) * (tumbled ? 12 : 26)));
        p.hp -= dmg; G.hurtT = 0.25; fx('hurt', 200); Audio_.sfx.hurt();
        msg(tumbled ? 'You tumble down the rock face \u2014 ' + dmg + ' damage.' : 'You come down hard off the edge \u2014 ' + dmg + ' damage.', 'bad', 2800);
        if (p.hp <= 0) { die('the fall'); return; }
      } else if (drop > 0.25) Audio_.sfx.step('stone');
    }
  }
  c.z = p.feet + 0.88;
  // keyboard turning eases in and out
  let tin = clamp(edgeTurn * 0.9, -1, 1); if (k.q || k.arrowleft) tin -= 1; if (k.arrowright) tin += 1; tin = clamp(tin, -1, 1);
  G.turnV += (tin * 2.4 - G.turnV) * (1 - Math.exp(-(tin ? 11 : 18) * dt));
  if (!tin && Math.abs(G.turnV) < 0.02) G.turnV = 0;
  c.dir += G.turnV * dt;
  const moving = mag > 0.05;
  if (moving) {
    const pace = Math.min(1, Math.hypot(vel.x, vel.y) / Math.max(0.1, spd * Math.max(mag, 0.3)));
    G.bobPhase += dt * (running ? 13 : 9) * pace; c.bob = Math.sin(G.bobPhase) * 2 * pace;
    if (running) p.fat = Math.max(0, p.fat - dt * 3 * ((typeof Weather !== 'undefined' && G.map.outdoor) ? Weather.exposure() : 1));
    if (G.time - G.lastStep > (running ? 0.28 : 0.45) / Math.max(0.5, mag)) { G.lastStep = G.time; Audio_.sfx.step(); }
  } else { c.bob *= Math.exp(-13 * dt); p.fat = Math.min(fatCap(), p.fat + dt * 2 * needsRecovery()); }
  G.map.visited[(c.y | 0) * G.map.w + (c.x | 0)] = 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = (c.x | 0) + dx, yy = (c.y | 0) + dy; if (xx >= 0 && yy >= 0 && xx < G.map.w && yy < G.map.h) G.map.visited[yy * G.map.w + xx] = 1; }
  // doors animate
  for (const key in G.map.doors) { const d = G.map.doors[key]; if (d.open !== d.target) d.open = d.target > d.open ? Math.min(d.target, d.open + dt * 1.6) : Math.max(d.target, d.open - dt * 1.6); }
  // timers
  if (G.attack.t > 0) G.attack.t -= dt;
  if (G.song.t > 0) G.song.t -= dt;
  if (G.rootWard > 0) G.rootWard -= dt;
  if (G.glassLock > 0) G.glassLock -= dt;
  if (G.webT > 0) G.webT -= dt;
  if (G.hurtT > 0) G.hurtT -= dt;
  if (G.songFx > 0) G.songFx -= dt;
  p.voice = Math.min(p.voiceMax, p.voice + dt * 0.08);
  updateNarrow(dt, moving, running);
  tickTraps(); if (G.dead) return;
  tickCatacombsPuzzles();
  tickDisguise(dt);
  tickDistractions(dt);
  tickBodies(dt);
  if (G.dragBody && moving) addNoise(dt * 1.5);
  // entities
  for (const e of G.ents) {
    varyNpcHeight(e);
    if (e.kind === 'enemy') enemyUpdate(e, dt);
    else if ((e.kind === 'npc' && e.wander) || (e.kind === 'deco' && e.wander)) {
      e.wanderT -= dt; if (e.wanderT <= 0) { e.wanderT = rnd(2, 6); e.dir = rnd(0, 6.28); e.moving = Math.random() < 0.6; }
      if (e.lawGuard && (e.state === 'investigate' || (lawActive() && crimeState().bounty))) continue;
      if (e.moving && dist2(e.x, e.y, e.homeX, e.homeY) < 20) { if (!moveWithSlide(e, Math.cos(e.dir) * 0.6 * dt, Math.sin(e.dir) * 0.6 * dt, e)) e.dir += 1.5; } else if (e.moving) { e.dir = Math.atan2(e.homeY - e.y, e.homeX - e.x); moveWithSlide(e, Math.cos(e.dir) * 0.6 * dt, Math.sin(e.dir) * 0.6 * dt, e); }
    } else if (e.kind === 'npc' && e.loop) {
      e.loopT = (e.loopT || 0) + dt; moveWithSlide(e, Math.cos(e.loopT * 0.7) * 0.5 * dt * 1.2, 0, e);
      if (Math.random() < dt * 0.08 && dist2(e.x, e.y, c.x, c.y) < 30) msg(`A Hollow, to no one: "${e.lines[rndi(0, e.lines.length - 1)]}"`, 'voice', 4000);
    }
  }
  checkTriggers();
  wgTick(dt); codaTick(dt); wildsTick(dt); partyTick(dt);
  if (G.boreHold > 0) { G.boreHold -= dt; if (G.boreHold <= 0) { G.boreHold = 0; if (!G.flags.bore_broken) finishBore(); } }
  // greening clock
  if (G.escapeTimer > 0) { G.escapeTimer -= dt; if (G.escapeTimer <= 0) { G.escapeTimer = 0; die('greening'); } }
  // flicker
  Engine.setFlicker(G.map.outdoor ? 1 : 0.92 + Math.sin(G.time * 11) * 0.03 + Math.sin(G.time * 23.7) * 0.03 + (G.flags.greening && G.mapId === 'rootvault' ? Math.sin(G.time * 3) * 0.1 : 0));
  // hint under crosshair
  const h = Engine.pick(G.ents, 3.2); let hint = '';
  if (h && !h.dead) hint = h.kind === 'npc' ? (NPCS[h.id] ? NPCS[h.id].name : h.name) : h.kind === 'enemy' ? (h.def.name + (h.name && h.def.core ? '' : '')) : h.kind === 'item' ? ITEMS[h.item].name : (h.label || (h.sprite === 'oak' ? 'Iron-bark oak' : h.sprite === 'lamp' ? 'Hush-lamp' : ''));
  else { const w = Engine.pickWall(2.0); if (w && w.cell.door) hint = w.cell.label || (w.cell.portal ? 'A door' : (G.map.doors[w.y * G.map.w + w.x].open > 0.5 ? 'An open door' : 'A closed door')); }
  const usable = h && !h.dead && (h.kind === 'npc' || h.kind === 'item' || (h.kind === 'deco' && h.use));
  const inReach = usable && h._screen && h._screen.dist <= USE_RANGE;
  G.hintKind = inReach ? h.kind : (!h && hint ? 'door' : '');
  const pocket = pickpocketTarget();
  if (pocket) hint += `${hint ? ' · ' : ''}P: inspect purse · controller Y`;
  const body = bodyTarget();
  if (body) hint += `${hint ? ' · ' : ''}G: ${body.stashedIn ? 'recover body' : G.dragBody ? 'drop / conceal body' : 'drag body'} · controller left stick`;
  const coverText = wearingDisguise() ? disguiseStatus() + ' · Y / Cover / controller Back' : '';
  if ($('#cover-status').textContent !== coverText) $('#cover-status').textContent = coverText;
  $('#cover-status').hidden = !coverText;
  if (hint !== G.hint) { G.hint = hint; $('#hint').textContent = hint; }
  const far = !!usable && !inReach; if (far !== G.hintFar) { G.hintFar = far; $('#hint').classList.toggle('far', far); }
}

// ---------------------------------------------------------------- HUD
function drawHUD() {
  const ctx = Engine.ctx, p = G.player; if (!p) return;
  const y0 = VIEW_H;
  // weapon overlay
  const w = currentWeapon(); const img = Engine.images[G.song.t > 0 || G.songFx > 0 ? 'fp_hands' : w.img];
  if (img) {
    const sc = 0.5; const iw = img.width * sc, ih = img.height * sc;
    let ax = 0, ay = 0, rotation = 0, zoom = 1;
    if (G.attack.t > 0 && G.song.t <= 0 && G.songFx <= 0) {
      const pose = animWeaponPose(w, 1 - G.attack.t / G.attack.dur, G.attack.dirLabel);
      ax = pose.x; ay = pose.y; rotation = pose.rotation; zoom = pose.scale;
    }
    if (G.song.t > 0) { ay = -Math.sin((1 - G.song.t / 0.7) * Math.PI) * 30; }
    const bob = (Engine.cam.bob || 0) + (G.attack.t > 0 ? 0 : Math.sin(performance.now() / 900) * 1.4);
    const bx = w.img === 'fp_hands' || G.song.t > 0 || G.songFx > 0 ? VW / 2 - iw / 2 : w.center ? VW / 2 - iw / 2 + 22 : VW - iw - 10;
    // Clip to the world viewport so overhead swings cannot cover HUD/menu
    // borders; rotate around the grip instead of the artwork's centre.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.translate(bx + ax + iw * 0.5, VIEW_H + 12 + ay + bob * 1.5);
    ctx.rotate(rotation); ctx.scale(zoom, zoom);
    ctx.drawImage(img, -iw * 0.5, -ih + 12, iw, ih);
    ctx.restore();
    if (G.glassLock > 0 && w.type === 'glass') { ctx.fillStyle = 'rgba(80,200,220,0.25)'; ctx.fillRect(bx + ax, VIEW_H - ih + 24 + ay, iw, ih); }
  }
  // crosshair
  // the crosshair is the centre of the view: a pitched look aims up or down with it
  ctx.fillStyle = 'rgba(255,240,200,0.7)'; ctx.fillRect(VW / 2 - 1, VIEW_H / 2 - 1, 2, 2);
  // hurt / hush vignette are CSS; damage flash on canvas edge
  // bar
  ctx.fillStyle = '#2a2018'; ctx.fillRect(0, y0, VW, VH - y0);
  ctx.fillStyle = '#5a4530'; ctx.fillRect(0, y0, VW, 1); ctx.fillStyle = '#0b0806'; ctx.fillRect(0, y0 + 1, VW, 1);
  // stone texture dots
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 37) % VW, y0 + 4 + (i * 13) % 44, 2, 1);
  // vital bars
  const bars = [[6, p.hp / p.hpMax, '#b23a2a', 'H'], [14, p.fat / p.fatMax, '#4e8a3a', 'F'], [22, p.voice / p.voiceMax, '#3d6aa8', 'V']];
  for (const [x, f, col] of bars) { ctx.fillStyle = '#000'; ctx.fillRect(x, y0 + 5, 6, 40); ctx.fillStyle = col; const hh = Math.round(40 * clamp(f, 0, 1)); ctx.fillRect(x, y0 + 45 - hh, 6, hh); ctx.fillStyle = '#5a4530'; ctx.fillRect(x - 1, y0 + 4, 8, 1); ctx.fillRect(x - 1, y0 + 45, 8, 1); }
  // the Narrow (noise) bar
  ctx.fillStyle = '#000'; ctx.fillRect(32, y0 + 5, 8, 40);
  const nh = Math.round(40 * G.noise / 10); ctx.fillStyle = G.noise > 7 ? '#e0442a' : G.noise < 1.5 ? '#9aa0b0' : '#d98b2a'; ctx.fillRect(32, y0 + 45 - nh, 8, nh);
  ctx.fillStyle = '#ff6a40'; ctx.fillRect(30, y0 + 45 - 28, 12, 1); // hound mark at 7
  ctx.fillStyle = '#c0c8e0'; ctx.fillRect(30, y0 + 45 - 6, 12, 1); // hush mark at 1.5
  if (p.glassed) { ctx.fillStyle = '#000'; ctx.fillRect(2, y0 + 5, 2, 40); ctx.fillStyle = '#6fd6e0'; const gh = Math.round(40 * p.glass / 100); ctx.fillRect(2, y0 + 45 - gh, 2, gh); }
  // buttons
  ctx.font = '7px "Alegreya SC", serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const b of HUD_BTNS) { ctx.fillStyle = '#1a130d'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = '#5a4530'; ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y, 1, b.h); ctx.fillStyle = '#0b0806'; ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h); ctx.fillStyle = '#d9a441'; ctx.fillText(b.t, b.x + b.w / 2, b.y + b.h / 2 + 0.5); }
  // centre: status words
  ctx.fillStyle = '#0e0a07'; ctx.fillRect(156, y0 + 5, 64, 40); ctx.fillStyle = '#5a4530'; ctx.fillRect(156, y0 + 5, 64, 1); ctx.fillRect(156, y0 + 5, 1, 40);
  ctx.font = '8px "Alegreya SC", serif'; ctx.fillStyle = '#d9a441'; ctx.textAlign = 'center';
  const narrow = G.unwriting ? 'UNWRITING' : G.noise > 7 ? 'TOO LOUD' : G.noise < 1.5 ? (G.map.siphoned ? 'TOO STILL' : 'STILL') : G.noise > 4.5 ? 'LOUD' : 'THE NARROW';
  ctx.fillStyle = G.unwriting ? '#c0c8e0' : G.noise > 7 ? '#ff6a40' : '#d9a441'; ctx.fillText(narrow, 188, y0 + 12);
  ctx.fillStyle = '#b8a883'; ctx.font = '7px "Alegreya", serif'; ctx.fillText(w.name + (w.ammo ? ` · ${p[w.ammo] || 0}` : ''), 188, y0 + 23);
  ctx.fillText(`${DAYS[G.day % 8]} · ${timeName()}`, 188, y0 + 33);
  if (G.escapeTimer > 0) { ctx.fillStyle = '#7fe060'; ctx.font = '8px "Alegreya SC", serif'; ctx.fillText(`GREENING ${Math.floor(G.escapeTimer / 60)}:${String(Math.floor(G.escapeTimer % 60)).padStart(2, '0')}`, 188, y0 + 42); }
  else if (G.boreHold > 0) { ctx.fillStyle = '#7fe060'; ctx.font = '8px "Alegreya SC", serif'; ctx.fillText(`HOLD ${Math.floor(G.boreHold / 60)}:${String(Math.floor(G.boreHold % 60)).padStart(2, '0')}`, 188, y0 + 42); }
  else if (G.rootWard > 0) { ctx.fillStyle = '#a9e07a'; ctx.fillText('ROOT NOTE', 188, y0 + 42); }
  else if (G.whistleT > 0) { ctx.fillStyle = '#a9e07a'; ctx.fillText('REED', 188, y0 + 42); }
  // compass strip
  const cx0 = 228, cw = 86; ctx.fillStyle = '#0e0a07'; ctx.fillRect(cx0, y0 + 5, cw, 14); ctx.fillStyle = '#5a4530'; ctx.fillRect(cx0, y0 + 5, cw, 1);
  const heading = Engine.cam.dir + Math.PI / 2; // 0 = north
  ctx.save(); ctx.beginPath(); ctx.rect(cx0, y0 + 5, cw, 14); ctx.clip(); ctx.font = '8px "Alegreya SC", serif';
  const pts = [['N', 0], ['NE', 0.785], ['E', 1.571], ['SE', 2.356], ['S', 3.142], ['SW', 3.927], ['W', 4.712], ['NW', 5.498]];
  for (const [lab, a] of pts) { let rel = normAng(a - heading); if (Math.abs(rel) > 1.6) continue; const x = cx0 + cw / 2 + rel / 1.6 * (cw / 2); ctx.fillStyle = lab.length === 1 ? '#d9a441' : '#7a6a58'; ctx.fillText(lab, x, y0 + 12); for (let t = 1; t < 4; t++) { ctx.fillStyle = '#4a3a2a'; const rx = cx0 + cw / 2 + (rel + t * 0.196) / 1.6 * (cw / 2); ctx.fillRect(rx, y0 + 16, 1, 2); } }
  ctx.restore(); ctx.fillStyle = '#fff1c8'; ctx.fillRect(cx0 + cw / 2, y0 + 5, 1, 14);
  // right-bottom: map name & level
  ctx.textAlign = 'right'; ctx.fillStyle = '#b8a883'; ctx.font = '7px "Alegreya", serif'; ctx.fillText(G.map.name + (G.map.outdoor && typeof Weather !== 'undefined' ? ' · ' + weatherLine() : ''), 314, y0 + 27, 86);   // maxWidth: long place names squeeze instead of running into the clock panel
  ctx.fillText(`${p.name} · Lv ${p.level} · ${p.gold} sov.`, 314, y0 + 37, 86);
  if (p.fragments) ctx.fillText(`fragments ${p.fragments}`, 314, y0 + 46, 86);
  ctx.textAlign = 'left';
  // fade-in on map load
  if (G.fadeT > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(G.fadeT * 2, 0, 1)})`; ctx.fillRect(0, 0, VW, VIEW_H); }
}

// ---------------------------------------------------------------- loop
let last = performance.now(), fpsN = 0, fpsT = 0, fps = 0;
// what the score should be playing right now
let combatT = 0;
function musicDirector(dt) {
  const M = Audio_.music; if (!M) return;
  const st = G.state;
  if (st === 'loading') return M.request(null);
  if (st === 'title' || st === 'create' || st === 'intro' || (st === 'panel' && G.openPanel === 'loadtitle') || !G.map || !G.player) return M.request('title');
  if (st === 'ending') return M.request('ending');
  const duck = st === 'dead' ? 0.3 : 1;
  if (G.escapeTimer > 0) return M.request('greening', duck);
  const c = Engine.cam;
  const fighting = G.boreHold > 0 || G.ents.some(e => e.kind === 'enemy' && !e.dead && !e.hidden && e.state === 'chase' && dist2(e.x, e.y, c.x, c.y) < 196);
  combatT = fighting ? 5 : Math.max(0, combatT - dt);
  if (combatT > 0) return M.request('combat', duck);
  const mu = G.map.music;
  if (G.mapId === 'tavern') return M.request('tavern', duck);
  if (mu === 'inside') return M.request('town', 0.42 * duck);
  if (mu === 'town') return M.request('town', duck);
  if (mu === 'wild') return M.request('wild', duck);
  if (mu === 'grove') return M.request('grove', duck);
  if (mu === 'coda') return M.request('coda', duck);
  if (mu === 'mausoleum') return M.request('coda', 0.55 * duck, 0.9);
  if (mu === 'cloister') return M.request('grove', 0.5 * duck, 0.94);
  if (mu === 'root') return M.request('dungeon', 0.9 * duck, 0.9);
  return M.request('dungeon', duck);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  musicDirector(dt); if (Audio_.music) Audio_.music.tick(dt);
  for (let rem = dt; rem > 1e-5;) { const st = Math.min(rem, 1 / 60); update(st); rem -= st; }
  controlsTick();
  render();
  fpsN++; fpsT += dt; if (fpsT >= 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
}
function render() {
  if (!G.map) return;
  Engine.render(G.ents, G.tod);
  drawHUD();
  const d = $('#debug'); if (d.style.display === 'block') d.textContent = `FPS ${fps.toFixed(0)} | ${G.mapId} ${Engine.cam.x.toFixed(1)},${Engine.cam.y.toFixed(1)} dir ${Engine.cam.dir.toFixed(2)} | noise ${G.noise.toFixed(1)} still ${G.stillT.toFixed(1)} | ents ${G.ents.length}`;
}
window.advanceTime = (ms) => { const steps = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < steps; i++) update(1 / 60); render(); };
// ---------------------------------------------------------------- saving & loading
// The preview sandbox has no persistent storage, so saves are a portable code / file plus in-session slots.
const SAVE_VERSION = 1;
const SLOTS = [null, null, null];
// ---------------------------------------------------------------- hardcore runs
// Opt-in single-save permadeath. A hardcore run exists in exactly one place: the
// in-page save below. It is never written to a code or a file, ordinary saves can
// never open it, and it is destroyed the moment the traveller dies.
const HARDCORE = { save: null };
function hardcoreOn() { return !!(G.player && G.player.hardcore === true); }
function hardcorePayload(d) { return !!(d && d.player && typeof d.player === 'object' && d.player.hardcore === true); }
function setHardcoreRun() {
  const p = G.player; p.hardcore = true; HARDCORE.save = null;
  if (typeof UPG === 'object' && UPG) { UPG.autosaveSlot = null; UPG.autosaveWhen = ''; }
  const old = $('#btn-auto-load'); if (old) old.remove();
  renderMenu();
  msg('Hardcore on: one save for this run, no codes, and death is final.', 'warn', 7000);
}
function renderHardcoreConfirm() {
  openModal(`<h2>Make this run hardcore?</h2>
  <p>Hardcore keeps <b>one save</b> for this run: no session slots, no save codes, no downloads and no pre-boss autosaves. Death destroys that save and ends the run; there is no waking by the lamp.</p>
  <p class="muted">Ordinary saves are untouched by this, and a hardcore run can never be opened by one.</p>
  <div class="btns"><button class="dfbtn" id="hc-yes">Turn hardcore on</button><button class="dfbtn" id="hc-no">Not yet</button></div>`, 'hardcore');
  $('#hc-yes').onclick = () => setHardcoreRun();
  $('#hc-no').onclick = () => renderMenu();
}
function renderHardcoreSave() {
  const d = snapshotGame(); d.mapName = G.map.name;
  const html = `<h2>Save game</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted">${slotSummary(d)}</p>
  <p><b style="color:var(--gold)">Hardcore</b> — this run keeps one save, and only one. Writing it again replaces it.</p>
  <div class="slot"><span class="meta">${HARDCORE.save ? slotSummary(HARDCORE.save) : 'The run’s save — empty'}</span><button class="dfbtn small" id="hc-save">${HARDCORE.save ? 'Overwrite' : 'Save the run'}</button></div>
  <p class="muted">Save codes, downloads, session slots and pre-boss autosaves are closed to a hardcore run. Death destroys this save.</p>
  <div class="btns"><button class="dfbtn small" id="sv-back">Back</button></div>`;
  openModal(html, 'save');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#sv-back').onclick = () => renderMenu();
  $('#hc-save').onclick = () => { HARDCORE.save = d; Audio_.sfx.ui(); msg('The run is written down. There is still only one copy of it.', 'good', 4000); renderSave(); };
}
function renderHardcoreLoad(fromTitle) {
  const html = `<h2>Load game</h2><button class="dfbtn small close" id="x">Close</button>
  <p><b style="color:var(--gold)">Hardcore</b> — the run keeps one save, and this is it.</p>
  ${HARDCORE.save ? `<div class="slot"><span class="meta">${slotSummary(HARDCORE.save)}</span><button class="dfbtn small" id="hc-load">Load</button></div>` : `<p class="muted">There is no hardcore save in this page. Death leaves none.</p>`}
  <p class="muted">Session slots, save codes and downloaded files cannot open a hardcore run, and a hardcore run cannot be carried out as one.</p>
  <div class="btns"><button class="dfbtn small" id="ld-back">Back</button></div>
  <p class="muted" id="ld-err"></p>`;
  openModal(html, fromTitle ? 'loadtitle' : 'load');
  const back = () => { if (fromTitle) { closeModal(); G.state = 'title'; show('#title'); } else renderMenu(); };
  $('#x').onclick = () => { if (fromTitle) back(); else { closeModal(); G.state = 'play'; } };
  $('#ld-back').onclick = back;
  const btn = $('#hc-load');
  if (btn) btn.onclick = () => { try { restoreGame(JSON.parse(JSON.stringify(HARDCORE.save))); } catch (e) { $('#ld-err').textContent = 'That did not read as a hardcore save. ' + (e && e.message ? e.message : ''); } };
}
const ENT_FIELDS = ['x', 'y', 'hp', 'dead', 'hidden', 'state', 'name', 'solid', 'homeX', 'homeY', 'passive'];
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const b = atob(str); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function rleEncode(u8) { const out = []; let i = 0; while (i < u8.length) { const v = u8[i]; let n = 1; while (i + n < u8.length && u8[i + n] === v && n < 255) n++; out.push(v, n); i += n; } return b64(new Uint8Array(out)); }
function rleDecode(str, len) { const src = unb64(str); const out = new Uint8Array(len); let o = 0; for (let i = 0; i + 1 < src.length; i += 2) { const v = src[i], n = src[i + 1]; for (let k = 0; k < n && o < len; k++) out[o++] = v; } return out; }
function snapshotGame() {
  const p = G.player, c = Engine.cam;
  const maps = {};
  for (const id in G.maps) {
    const m = G.maps[id]; const base = m.baseCount != null ? m.baseCount : m.entities.length;
    const ents = m.entities.slice(0, base).map(e => { const o = {}; for (const k of ENT_FIELDS) if (e[k] !== undefined) o[k] = e[k]; return o; });
    const extra = m.entities.slice(base).filter(e => !e.transient).map(e => { const o = { kind: e.kind, type: e.type, sprite: e.sprite, item: e.item, id: e.id }; for (const k of ENT_FIELDS) if (e[k] !== undefined) o[k] = e[k]; return o; });
    const doors = {}; for (const k in m.doors) if (m.doors[k].open > 0 || m.doors[k].target > 0) doors[k] = [m.doors[k].open, m.doors[k].target];
    maps[id] = { ents, extra, doors, visited: rleEncode(m.visited), triggers: m.triggers.map(t => ({ done: !!t.done, said: !!t.said })) };
  }
  const snap = {
    v: SAVE_VERSION, when: Date.now(),
    player: Object.assign({}, p, { cls: p.cls.id }),
    flags: G.flags, journal: G.journal, ledger: G.ledger, runs: G.runs,
    tod: G.tod, day: G.day, mapId: G.mapId, cam: { x: c.x, y: c.y, dir: c.dir },
    noise: G.noise, escapeTimer: G.escapeTimer, boreHold: G.boreHold || 0, boreGolems: G.boreGolems || 0, glassLock: G.glassLock, rootWard: G.rootWard,
    weather: typeof Weather !== 'undefined' ? Weather.save() : null,
    maps,
  };
  // A snapshot is a copy, not a view: session slots and the boss autosave keep these objects, and play after saving
  // must not reach back into them (flags, journal, ledger and the player's arrays were live references before Phase 17).
  // The JSON round-trip is exactly what a save code stores, so nothing a save can hold is lost.
  return JSON.parse(JSON.stringify(snap));
}
function restoreGame(d) {
  if (!d || typeof d !== 'object' || !d.player || !d.maps || typeof d.mapId !== 'string') throw new Error('Not an Octave save.');
  // Hardcore runs and ordinary saves never open each other, in either direction.
  const mine = hardcoreOn(), theirs = hardcorePayload(d);
  if (mine !== theirs) throw new Error(theirs ? 'That is a hardcore run. It only opens inside a hardcore run.' : 'A hardcore run does not open ordinary saves.');
  const custody = d.player.crime && d.player.crime.custody;
  if (custody && typeof custody.remaining === 'number' && Number.isFinite(custody.remaining) && d.mapId !== 'watchhouse') throw new Error('A custody save must be inside the watch-house.');
  const probe = buildAllMaps(); if (!probe[d.mapId] || !d.cam || !isFinite(d.cam.x) || !isFinite(d.cam.y)) throw new Error('That save points somewhere that does not exist.');
  if (!Array.isArray(d.player.inv) || !d.player.attrs) throw new Error('That save is damaged.');
  const cls = CLASSES.find(c => c.id === d.player.cls) || CLASSES[0];
  G.player = Object.assign({ armor: {}, bolts: 0 }, d.player, { cls });
  G.player.name = cleanName(G.player.name); G.player.level = Math.max(1, G.player.level | 0);
  G.player.weapons = (G.player.weapons || []).filter(w => WEAPONS[w]); if (!G.player.weapons.length) G.player.weapons = ['hands']; G.player.weapon = clamp(G.player.weapon | 0, 0, G.player.weapons.length - 1);
  G.player.inv = G.player.inv.filter(s => s && ITEMS[s.id]); for (const k in G.player.armor) if (!ARMOR[G.player.armor[k]] || !G.player.inv.some(s => s.id === G.player.armor[k])) delete G.player.armor[k];
  normalizeCrime();
  ensurePlayerUpgrades(G.player); // imported saves are untrusted: validate custom songs, house storage and the song list before any render path
  G.flags = d.flags || {}; G.runs = d.runs | 0;
  G.journal = (Array.isArray(d.journal) ? d.journal : []).filter(j => j && typeof j === 'object').map(j => Object.assign({}, j, { text: cleanText(j.text), cat: cleanText(j.cat, 20), day: j.day | 0 }));
  G.ledger = (Array.isArray(d.ledger) ? d.ledger : []).filter(l => l && typeof l === 'object').map(l => Object.assign({}, l, { name: cleanText(l.name, 60), where: cleanText(l.where, 80), day: l.day | 0 }));
  G.tod = isFinite(+d.tod) ? ((+d.tod % 1) + 1) % 1 : 0.5;
  G.day = Math.max(0, d.day | 0);
  G.noise = isFinite(+d.noise) ? clamp(+d.noise, 0, 10) : 2;
  G.escapeTimer = isFinite(+d.escapeTimer) ? Math.max(0, +d.escapeTimer) : 0;
  G.boreHold = isFinite(+d.boreHold) ? Math.max(0, +d.boreHold) : 0;
  G.boreGolems = Math.max(0, d.boreGolems | 0);
  G.glassLock = isFinite(+d.glassLock) ? Math.max(0, +d.glassLock) : 0;
  G.rootWard = isFinite(+d.rootWard) ? Math.max(0, +d.rootWard) : 0;
  // Imported hire terms are untrusted numbers: clamp to at most two days from the loaded clock.
  const clockNow = G.day * 24 + G.tod * 24;
  const horseRaw = isFinite(+G.player.horseUntil) ? Math.max(0, +G.player.horseUntil) : 0;
  G.player.horseUntil = Math.min(horseRaw, clockNow + 48);
  G.player.needs = G.player.needs === true;
  G.player.hunger = isFinite(+G.player.hunger) ? clamp(+G.player.hunger, 0, 100) : 100;
  G.player.sleep = isFinite(+G.player.sleep) ? clamp(+G.player.sleep, 0, 100) : 100;
  // Imported skies are untrusted: only known states, only sane hour counts.
  if (typeof Weather !== 'undefined') Weather.load(d.weather);
  G.throwReady = 0; G.dragBody = null; G.bodyScanT = 0; G.coverSuspicion = 0; G.lawGrace = 0;
  G.dead = false; G.stillT = 0; G.unwriting = false; G.murmurT = 0; G.whistleT = 0; G.attack.t = 0; G.song.t = 0; G.keys = {}; $('#msgs').innerHTML = '';
  G.maps = probe; if (G.flags.greening) G.maps.oakhaven = buildOakhaven(true);
  for (const id in G.maps) {
    const m = G.maps[id], sm = d.maps[id]; if (!sm || !Array.isArray(sm.ents)) continue;
    m.entities.forEach(hydrate);
    sm.ents.forEach((o, i) => { const e = m.entities[i]; if (e && o && typeof o === 'object') Object.assign(e, pickEnt(o)); });
    for (const o of (sm.extra || [])) { if (!o || !((o.kind === 'enemy' && ENEMIES[o.type]) || (o.kind === 'item' && ITEMS[o.item]))) continue; const e = hydrate({ kind: o.kind, type: o.type, sprite: o.sprite, item: o.item, id: o.id, x: o.x, y: o.y }); if (o.item) { e.scale = 0.35; e.solid = false; } Object.assign(e, pickEnt(o)); m.entities.push(e); }
    for (const k in sm.doors) if (m.doors[k]) { m.doors[k].open = sm.doors[k][0]; m.doors[k].target = sm.doors[k][1]; }
    if (sm.visited) m.visited = rleDecode(sm.visited, m.w * m.h);
    (sm.triggers || []).forEach((t, i) => { if (m.triggers[i]) { m.triggers[i].done = t.done; m.triggers[i].said = t.said; } });
  }
  // re-attach the hooks that closures carried
  const rv = G.maps.rootvault; if (G.boreHold > 0 && rv) for (const e of rv.entities) if (e.kind === 'enemy' && e.type === 'golem' && !e.dead && e.state === 'chase') e.onDeath = () => { G.boreGolems--; if (G.boreGolems <= 0) finishBore(); };
  const oh = G.maps.oakhaven; if (oh) for (const e of oh.entities) if (e.kind === 'enemy' && e.type === 'wearer' && !e.dead) e.onDeath = () => { G.flags.wearer_dead = true; msg('It bursts, and everything it ever ate comes out at once.', 'voice', 9000); setTimeout(ending, 2500); };
  ['#title', '#create', '#intro', '#death', '#ending', '#event'].forEach(hide); closeModal();
  loadMap(d.mapId, d.cam); G.state = 'play';
  if (G.mapId === 'watchhouse' && crimeState().custody) {
    // A saved open door is not authority to bypass a fresh locked cell.
    if (!G.flags[PRISON_CELL_KEY]) { const door = G.map.doors[4 * G.map.w + 5]; door.open = door.target = 0; }
    if (crimeState().custody.remaining <= 0.00001) tickCustody(0);
  }
  msg('The thread is picked up where you left it.', 'warn', 5000);
}
async function encodeSave(d) {
  if (hardcorePayload(d)) throw new Error('A hardcore run cannot be written out as a save code.');
  const json = JSON.stringify(d); const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes).catch(() => { }); w.close().catch(() => { }); const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer()); return 'OCTZ1.' + b64(buf); } catch (e) { /* fall through */ }
  }
  return 'OCTJ1.' + b64(bytes);
}
async function decodeSave(code) {
  code = (code || '').trim().replace(/\s+/g, '');
  if (!code) throw new Error('The box is empty. Paste a save code first.');
  if (code.startsWith('{')) return JSON.parse(code);
  const dot = code.indexOf('.'); if (dot < 0) throw new Error('Not an Octave save.'); const tag = code.slice(0, dot), body = code.slice(dot + 1);
  let bytes; try { bytes = unb64(body); } catch (e) { throw new Error('Not an Octave save.'); }
  if (tag === 'OCTZ1') { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes).catch(() => { }); w.close().catch(() => { }); try {
      // read the inflated save in chunks and stop at a sane size, so a tiny code cannot inflate into gigabytes
      const rd = ds.readable.getReader(), parts = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > 8 * 1024 * 1024) { try { rd.cancel(); } catch (x) { /* already closed */ } throw new Error('too big'); } parts.push(value); }
      bytes = new Uint8Array(n); let o = 0; for (const p of parts) { bytes.set(p, o); o += p.length; }
    } catch (e) { throw new Error(e && e.message === 'too big' ? 'That save is far too large to be a real one.' : 'The code is damaged or incomplete.'); } }
  else if (tag !== 'OCTJ1') throw new Error('Not an Octave save.');
  let d; try { d = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('The code is damaged or incomplete.'); } if (!d || d.v !== SAVE_VERSION || !d.player || !d.maps) throw new Error('Not an Octave save.');
  if (hardcorePayload(d)) throw new Error('That is a hardcore run. Hardcore runs never travel as codes.');
  return d;
}
// player-typed or save-derived text is stripped of markup characters before it can reach innerHTML
function cleanName(s) { return String(s == null ? '' : s).replace(/[<>&"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Nameless'; }
function pickEnt(o) { const r = {}; for (const k of ENT_FIELDS) if (o[k] !== undefined) r[k] = o[k]; if (r.state === 'investigate') r.state = 'idle'; if (r.name != null) r.name = cleanText(r.name, 60); for (const k of ['x', 'y', 'hp', 'homeX', 'homeY']) if (r[k] != null && !isFinite(r[k])) delete r[k]; return r; }
function cleanText(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n || 2000); }
function slotSummary(d) { const p = d.player; return `${cleanName(p.name)}, ${CLASSES.find(c => c.id === p.cls)?.name || ''} · Lv ${p.level} · ${DAYS[(d.day | 0) % DAYS.length]} · ${cleanText(d.mapName || d.mapId, 60)}`; }
function renderMenu() {
  const html = `<h2>Options</h2><button class="dfbtn small close" id="x">Close</button>
  <div class="menu-list" style="margin-top:1cqh">
    <button class="dfbtn" id="mn-save">Save game</button>
    <button class="dfbtn" id="mn-load">Load game</button>
    <button class="dfbtn" id="mn-help">How to play</button>
    <button class="dfbtn" id="mn-ctl">Controls</button>
    <button class="dfbtn" id="mn-mute">${Audio_.muted ? 'Sound on' : 'Sound off'}</button>
    <button class="dfbtn" id="mn-music">${Audio_.music.enabled ? 'Music off' : 'Music on'}</button>
    <button class="dfbtn" id="mn-needs">Journey needs (hunger and sleep): ${G.player.needs ? 'On' : 'Off'}</button>
    <button class="dfbtn" id="mn-hardcore"${G.player.hardcore ? ' disabled' : ''}>Hardcore run (one save, death is final): ${G.player.hardcore ? 'On — this run cannot turn it off' : 'Off'}</button>
    <button class="dfbtn" id="mn-title">Return to title</button>
    <button class="dfbtn" id="mn-back">Continue</button>
  </div><p class="muted" style="margin-top:1cqh">${DAYS[G.day % DAYS.length]} · ${G.map.name} · ${G.player.name}, level ${G.player.level}</p>`;
  openModal(html, 'menu');
  $('#x').onclick = $('#mn-back').onclick = () => { closeModal(); G.state = 'play'; };
  $('#mn-save').onclick = () => renderSave(); $('#mn-load').onclick = () => renderLoad(false); $('#mn-help').onclick = () => renderHelp(); $('#mn-ctl').onclick = () => renderControls();
  $('#mn-mute').onclick = () => { Audio_.toggleMute(); renderMenu(); };
  $('#mn-music').onclick = () => { Audio_.music.enabled = !Audio_.music.enabled; renderMenu(); };
  $('#mn-needs').onclick = () => {
    const p = G.player; p.needs = p.needs !== true;
    if (p.needs) { p.hunger = 100; p.sleep = 100; }
    renderMenu();
    msg(p.needs ? 'Journey needs on: food and sleep now matter on the road. Honey feeds you; rest sleeps you.' : 'Journey needs off: hunger and sleep no longer change anything.', '', 5000);
  };
  $('#mn-hardcore').onclick = () => {
    if (G.player.hardcore) { msg('This run is already hardcore. Only a new traveller can start without it.', 'warn', 5000); return; }
    renderHardcoreConfirm();
  };
  $('#mn-title').onclick = () => { closeModal(); G.state = 'title'; G.keys = {}; $('#view').classList.remove('unwrite'); $('#msgs').innerHTML = ''; show('#title'); Audio_.setScene('title'); };
}
function renderControls() {
  const o = G.opts, onoff = v => v ? 'On' : 'Off';
  const html = `<h2>Controls</h2><button class="dfbtn small close" id="x">Close</button>
  <div class="ctl-grid">
    <span>Free look <small class="muted">move the mouse over the view to look · rest it at a side edge to keep turning · when off, hold the right button and drag</small></span><button class="dfbtn small" id="c-ml">${onoff(o.mouseLook)}</button>
    <span>Capture mouse <small class="muted">click the view to capture it, so it never wanders off the window · Esc gives it back</small></span><button class="dfbtn small" id="c-cap">${onoff(o.captureMouse)}</button>
    <span>Full screen <small class="muted">Alt+Enter</small></span><button class="dfbtn small" id="c-fs">${isFullscreen() ? 'On' : 'Off'}</button>
    <span>Look sensitivity</span><span class="ctl-step"><button class="dfbtn small" id="c-sdn">−</button><b>${o.sens}</b><button class="dfbtn small" id="c-sup">+</button></span>
    <span>Invert up and down look</span><button class="dfbtn small" id="c-inv">${onoff(o.invertY)}</button>
    <span>Always run <small class="muted">Shift walks instead · Caps Lock toggles</small></span><button class="dfbtn small" id="c-run">${onoff(o.alwaysRun)}</button>
    <span>Touch controls <small class="muted">auto turns on when you touch the screen</small></span><button class="dfbtn small" id="c-touch">${o.touch === 'auto' ? 'Auto' : o.touch === 'on' ? 'On' : 'Off'}</button>
  </div>
  <div class="btns"><button class="dfbtn small" id="c-back">Back</button></div>`;
  openModal(html, 'controls');
  const re = () => { saveOpts(); renderControls(); };
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#c-back').onclick = () => renderMenu();
  $('#c-ml').onclick = () => { o.mouseLook = !o.mouseLook; re(); };
  $('#c-cap').onclick = () => { o.captureMouse = !o.captureMouse; re(); };
  $('#c-fs').onclick = () => { toggleFullscreen(); setTimeout(() => { if (G.openPanel === 'controls') re(); }, 300); };
  $('#c-sdn').onclick = () => { o.sens = Math.max(1, o.sens - 1); re(); };
  $('#c-sup').onclick = () => { o.sens = Math.min(10, o.sens + 1); re(); };
  $('#c-inv').onclick = () => { o.invertY = !o.invertY; re(); };
  $('#c-run').onclick = () => { o.alwaysRun = !o.alwaysRun; re(); };
  $('#c-touch').onclick = () => { o.touch = o.touch === 'auto' ? 'on' : o.touch === 'on' ? 'off' : 'auto'; if (o.touch === 'auto') setTouchMode(false); re(); };
}
async function renderSave() {
  if (hardcoreOn()) { renderHardcoreSave(); return; }
  const d = snapshotGame(); d.mapName = G.map.name; const code = await encodeSave(d);
  const html = `<h2>Save game</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted">${slotSummary(d)}</p>
  <p><b style="color:var(--gold)">Session slots</b> — quick saves that last until you leave the page.</p>
  ${[0, 1, 2].map(i => `<div class="slot"><span class="meta">${SLOTS[i] ? slotSummary(SLOTS[i]) : `Slot ${i + 1} — empty`}</span><button class="dfbtn small" data-slot="${i}">Save here</button></div>`).join('')}
  <p style="margin-top:1cqh"><b style="color:var(--gold)">Save code</b> — copy it somewhere safe (or download it). Paste it under <i>Load game</i>, now or on another day.</p>
  <textarea id="savecode" readonly>${code}</textarea>
  <div class="btns"><button class="dfbtn small" id="sv-copy">Copy code</button><button class="dfbtn small" id="sv-dl">Download file</button><button class="dfbtn small" id="sv-back">Back</button></div>`;
  openModal(html, 'save');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; }; $('#sv-back').onclick = () => renderMenu();
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { SLOTS[+b.dataset.slot] = d; Audio_.sfx.ui(); msg(`Saved to slot ${+b.dataset.slot + 1}.`, 'good', 2500); renderSave(); });
  const ta = $('#savecode');
  $('#sv-copy').onclick = async () => { ta.select(); let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { } } msg(ok ? 'Save code copied.' : 'Select the code and copy it by hand.', ok ? 'good' : 'warn', 3000); };
  $('#sv-dl').onclick = () => { try { const blob = new Blob([code], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `octave-${G.player.name.replace(/\W+/g, '_')}-${DAYS[G.day % DAYS.length]}.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); msg('If the download was blocked, copy the code instead.', '', 4000); } catch (e) { msg('Download blocked here. Copy the code instead.', 'warn', 4000); } };
}
function renderLoad(fromTitle) {
  if (hardcoreOn()) { renderHardcoreLoad(fromTitle); return; }
  const html = `<h2>Load game</h2><button class="dfbtn small close" id="x">Close</button>
  <p><b style="color:var(--gold)">Session slots</b></p>
  ${[0, 1, 2].map(i => `<div class="slot"><span class="meta">${SLOTS[i] ? slotSummary(SLOTS[i]) : `Slot ${i + 1} — empty`}</span><button class="dfbtn small" data-slot="${i}" ${SLOTS[i] ? '' : 'disabled'}>Load</button></div>`).join('')}
  ${UPG.autosaveSlot ? `<div class="slot"><span class="meta">Boss autosave (before the fight) - ${cleanText(UPG.autosaveWhen || '', 60)}</span><button class="dfbtn small" id="ld-auto">Load</button></div>` : ''}
  <p style="margin-top:1cqh"><b style="color:var(--gold)">Save code or file</b></p>
  <textarea id="savecode" placeholder="Paste a save code here…"></textarea>
  <div class="btns"><button class="dfbtn small" id="ld-code">Load code</button><label class="dfbtn small" for="ld-file" style="cursor:pointer">Load file…</label><input type="file" id="ld-file" accept=".txt,.json,text/plain" style="display:none"><button class="dfbtn small" id="ld-back">Back</button></div>
  <p class="muted" id="ld-err"></p>`;
  openModal(html, fromTitle ? 'loadtitle' : 'load');
  const back = () => { if (fromTitle) { closeModal(); G.state = 'title'; show('#title'); } else renderMenu(); };
  $('#x').onclick = () => { if (fromTitle) back(); else { closeModal(); G.state = 'play'; } }; $('#ld-back').onclick = back;
  const fail = (e) => { $('#ld-err').textContent = 'That did not read as a save. ' + (e && e.message ? e.message : ''); };
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { try { restoreGame(JSON.parse(JSON.stringify(SLOTS[+b.dataset.slot]))); } catch (e) { fail(e); } });
  $('#ld-code').onclick = async () => { try { restoreGame(await decodeSave($('#savecode').value)); } catch (e) { fail(e); } };
  $('#ld-file').onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return; try { restoreGame(await decodeSave(await f.text())); } catch (e) { fail(e); } };
  const auto = $('#ld-auto'); if (auto) auto.onclick = () => { try { restoreGame(JSON.parse(JSON.stringify(UPG.autosaveSlot))); } catch (e) { fail(e); } };
}
$('#btn-load').onclick = () => { Audio_.init(); Audio_.resume(); hide('#title'); G.state = 'panel'; renderLoad(true); };
window.saveCode = async () => encodeSave(snapshotGame());
window.loadCode = async (c) => restoreGame(await decodeSave(c));

window.render_game_to_text = () => {
  const c = Engine.cam, p = G.player;
  return JSON.stringify({ state: G.state, panel: G.openPanel, map: G.mapId, note: 'grid units, x east, y south, dir radians (0=east, +=clockwise)', player: p ? { x: +c.x.toFixed(2), y: +c.y.toFixed(2), dir: +c.dir.toFixed(2), hp: Math.round(p.hp), hpMax: p.hpMax, voice: Math.round(p.voice), noise: +G.noise.toFixed(1), weapon: currentWeapon().name, pellets: p.pellets, gold: p.gold, inv: p.inv.map(s => s.id), glass: p.glass } : null, flags: G.flags, escape: Math.round(G.escapeTimer), ledger: G.ledger.length, hint: G.hint,
    near: G.ents.filter(e => !e.hidden && !e.dead && dist2(e.x, e.y, c.x, c.y) < 64).map(e => ({ k: e.kind, id: e.id || e.type || e.item || e.sprite, x: +e.x.toFixed(1), y: +e.y.toFixed(1), hp: e.hp, st: e.state })).slice(0, 25) });
};

// ---------------------------------------------------------------- boot
(async function boot() {
  await Engine.loadAll((f) => { $('#load-fill').style.width = (f * 100) + '%'; });
  try { await Promise.all(['8px "Alegreya SC"', '8px "Alegreya"', '700 20px "Cinzel"', '20px "UnifrakturMaguntia"'].map(f => document.fonts.load(f))); await document.fonts.ready; } catch (e) { }
  hide('#loading'); G.state = 'title';
  $('#btn-new').onclick = () => { Audio_.init(); Audio_.resume(); hide('#title'); show('#create'); CREATE.step = 0; renderCreate(); G.state = 'create'; };
  $('#btn-help').onclick = () => { $('#modal-panel').innerHTML = `<h2>How to play</h2><button class="dfbtn small close" id="x">Close</button><pre class="help">${HELP_TEXT}</pre>`; show('#modal'); $('#x').onclick = closeModal; };
  document.addEventListener('click', () => { Audio_.init(); Audio_.resume(); }, { once: true });
  requestAnimationFrame(frame);
})();
