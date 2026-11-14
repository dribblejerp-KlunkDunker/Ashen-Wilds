/* eslint-disable no-func-assign */
// ============================================================
//  COMPANIONS (prototype): Kaelen and Lyra, Part Four only.
//  One at a time. Orders: follow / wait / keep quiet. G cycles orders, X uses their ability.
//  The companion is a runtime entity: saves skip it, and G.party carries its state.
// ============================================================

const COMPANIONS = {
  kaelen: {
    name: 'Kaelen Vance', sprite: 'kaelen', portrait: 'kaelen', camp: 'kaelen_dw', hp: 60, noise: 1.7,
    ability: { name: 'Dissonant Blade', cd: 25 },
    join: '"About time." He flexes the glass hand, and it rings, very faintly. "I go where it\'s loudest and break what\'s about to break. You keep us in the Narrow."',
    leave: 'Kaelen goes back to the fire and sits down with his glass hand in his lap.',
  },
  lyra: {
    name: 'Lyra Ashgrove', sprite: 'lyra', portrait: 'lyra', camp: 'lyra_dw', hp: 40, noise: 2.0,
    // canon: "Lyra cannot sing" until her voice comes back (lyra_voice); before that she whistles the falling fifth (R2)
    ability: { get name() { return (typeof G !== 'undefined' && G.flags && G.flags.lyra_voice) ? 'Calling-Song' : 'Whistled Fifth'; }, cd: 35 },
    join: '"I\'ll hum," she says. "Under the breath, the way the night-hummers do at the crossings. The Hush won\'t get near you while I\'m humming. I can\'t do anything about the hounds."',
    leave: 'Lyra goes back to the fire, humming.',
  },
};
const PARTY_ORDERS = ['follow', 'wait', 'quiet'];
const PARTY_ORDER_NAME = { follow: 'Following', wait: 'Waiting here', quiet: 'Keeping quiet' };
const PARTY_MAPS = ['deepwoods', 'mausoleum', 'belfry'];

// first-sight and first-visit lines
const PARTY_BARKS = {
  kaelen: {
    'map:mausoleum': 'Hear that? The tombs are holding a chord under the floor. Something in here is about to break, and it isn\'t the stone.',
    'map:belfry': 'Old bronze. Cracked at the lip, on the east side. Ring it hard and it\'ll go the rest of the way.',
    quiet: 'Quiet. Glass won\'t ring inside one. Iron, and keep moving.',
    dirge: 'A funeral office with nobody in it. My arm hates it.',
    warden: 'Marble. Hit it where it\'s already cracked: the elbows.',
    horn: 'Office. They hear better than they fight. Kill the horn first.',
    weaverling: 'Static on legs. Cut the threads, not the spider.',
    broodmother: 'That one\'s full. I can hear them in her, waiting to hatch.',
    tongueless: 'They\'re not making a sound. Not breathing, not footfalls. That takes practice.',
    outrider: 'Crossbows. Close the distance, or get a willow between you and them.',
    hushwarden: 'Felted bell. Don\'t let it touch you before you\'ve sung what you need.',
    hound: 'Hounds. They won\'t touch the glass. Stay near me.',
    hurt: 'You\'re bleeding into the moss. Back off and let me take it.',
    rest: 'Wake me if the arm starts ringing. You\'ll hear it before I do.',
    selfhurt: 'I\'m fine. The arm\'s ringing, that\'s all. Give me a minute.',
  },
  lyra: {
    'map:mausoleum': 'The House of the Veil. The scribes kept everyone\'s names in here. I never thought I\'d walk on theirs.',
    'map:belfry': 'Nobody has rung for the dead out here in three years. You can hear it in the woods. They\'re waiting.',
    dirge: 'That\'s the office for the dead, sung wrong. Every third line missing. It makes my teeth ache.',
    quiet: 'I can\'t sing near it. Nothing can. Don\'t let it get between us.',
    tongueless: 'They cut out their own tongues to be holy. I taught children whose parents did that.',
    weaverling: 'They\'re wearing voices. Little ones. Don\'t listen too closely.',
    hound: 'Hounds. Stay low. I\'ll keep us in the Narrow.',
    horn: 'It\'s listening for me. It has been listening for me since Oakhaven.',
    warden: 'Chord-Wardens. They guard the Cantors. Nobody told them there\'s no one left to guard.',
    outrider: 'Grey coats. Keep me behind you.',
    hurt: 'Hold still. I\'ve got you.',
    rest: 'I\'ll take first watch. I\'ll hum. Sleep.',
    selfhurt: 'I\'m not built for this. I\'m a teacher.',
  },
};

// things they say when nothing is trying to kill you
const PARTY_CHAT = {
  kaelen: [
    'I don\'t build things anymore. I just know how they break.',
    'Every willow here has a split about a hand above the root. Damp gets in. Give it ten years.',
    'The glass is louder out here. Like standing next to a bore that\'s still turning.',
    'My father sold the Root to keep the town fed. I keep trying to hate him for it. I keep doing the arithmetic instead.',
    'Lyra taught me the Root note when we were nine. I still hum it when the arm\'s bad. Don\'t tell her.',
    'Hounds won\'t come near the glass. Neither will most people. It\'s restful.',
  ],
  lyra: [
    'I told my father once that a martyr is just a musician who gave up before the coda. He wrote it down.',
    'Feet on the moss, not the twigs. Breathe through your nose. There. That\'s the Narrow. You\'re good at it.',
    'I remember the name of everyone I have sung into the ground. It\'s the only thing I\'m vain about.',
    'Kaelen hums when the arm is bad. He thinks I don\'t know. I\'m the one who taught him that note.',
    'The reed orchards used to sing in a west wind. Whole hillsides of them. You would have liked it.',
    'Don\'t thank me for the healing. Thank me when we\'re all home.',
  ],
};
const PARTY_BOSS = {
  kaelen: ['There. That\'s what it sounds like when something stops.', 'Structural failure. Finally.', 'He flexes the glass hand until it stops ringing. "Next."'],
  lyra: ['Rest now. Whoever you were.', 'She sings two bars of the burial office over it, quietly, out of habit.', '"It\'s over. Breathe. It\'s over."'],
};
function partySay(line) {
  const P = G.party; if (!P || !P.id) return;
  const n = COMPANIONS[P.id].name.split(' ')[0];
  msg(/^(He|She) /.test(line) ? line.replace(/^(He|She) /, n + ' ') : line.startsWith('"') ? `${n}: ${line}` : `${n}: "${line}"`, 'voice', 5500);
}
function partyChat() {
  const P = G.party, pool = PARTY_CHAT[P.id];
  const left = pool.map((l, i) => i).filter(i => !P.said[P.id + ':chat' + 'abcdefghij'[i]]);
  if (!left.length) return;
  const i = left[Math.floor(Math.random() * left.length)];
  P.said[P.id + ':chat' + 'abcdefghij'[i]] = true; partySay(pool[i]);
}

G.party = null;
function partyMax(id) { return COMPANIONS[id].hp + 4 * Math.max(0, ((G.player && G.player.level) || 1) - 1); }

function partyEnt() { for (const id in G.maps) { const e = G.maps[id].entities.find(o => o.companion); if (e) return e; } return null; }
function partyRemoveEnt() { for (const id in G.maps) { const L = G.maps[id].entities; for (let i = L.length - 1; i >= 0; i--) if (L[i].companion) L.splice(i, 1); } }
function partyCampNpcs() {
  // the camp NPC stands in for whoever is not with you
  for (const id in G.maps) for (const e of G.maps[id].entities) {
    if (e.id === 'kaelen_dw') e.hidden = G.party && G.party.id === 'kaelen';
    if (e.id === 'lyra_dw' && id === 'deepwoods') e.hidden = (typeof ringLyraHidden === 'function' ? ringLyraHidden(e) : !!G.flags.coda_go) || (G.party && G.party.id === 'lyra');
  }
}
function partySpawn() {
  partyRemoveEnt(); partyCampNpcs();
  const P = G.party; if (!P || !P.id || !G.map || !G.flags.part4 || !PARTY_MAPS.includes(G.mapId)) return;
  const C = COMPANIONS[P.id];
  if (P.order !== 'wait' || P.map !== G.mapId) {
    if (P.order === 'wait' && P.map !== G.mapId) return; // left behind on another map
    const c = Engine.cam; let x = c.x - Math.cos(c.dir) * 1.2, y = c.y - Math.sin(c.dir) * 1.2;
    if (solidAt(x, y)) { x = c.x; y = c.y; }
    P.x = x; P.y = y; P.map = G.mapId;
  }
  const e = { kind: 'npc', id: 'companion', companion: true, name: C.name, sprite: C.sprite, x: P.x, y: P.y, scale: 1, solid: false, radius: 0.3, facing: 0 };
  hydrate(e); e.solid = false;
  G.map.entities.push(e); P.trail = [];
  partyHud();
}

// ---------------------------------------------------------------- joining and orders
function partyAvailable(id) {
  const f = G.flags;
  if (!f.part4) return false;
  if (id === 'lyra' && f.coda_go) return false;
  return true;
}
function partyJoin(id) {
  const prev = G.party && G.party.id;
  if (prev && prev !== id) msg(COMPANIONS[prev].leave, '', 4000);
  const C = COMPANIONS[id], old = (G.party && G.party.hpById) || {};
  G.party = { id, order: 'follow', hp: old[id] != null ? Math.min(old[id], partyMax(id)) : partyMax(id), hpById: old, cd: 0, said: (G.party && G.party.said) || {}, downed: (G.party && G.party.downed) || {}, map: G.mapId, x: Engine.cam.x, y: Engine.cam.y, trail: [], hurtT: 0 };
  if (!G.flags.party_tip) { G.flags.party_tip = true; setTimeout(() => msg('Companion: G gives orders (follow, wait, keep quiet). X uses their ability. Talk to them for more.', 'good', 8000), 400); }
  partySpawn();
  return C.join;
}
function partyDismiss(silent) {
  const P = G.party; if (!P) return;
  if (!silent) msg(COMPANIONS[P.id].leave, '', 4000);
  const keep = { hpById: Object.assign({}, P.hpById, { [P.id]: P.hp }), said: P.said, downed: P.downed };
  G.party = { id: null, ...keep };
  partyRemoveEnt(); partyCampNpcs(); partyHud();
}
function partyOrder(o) {
  const P = G.party; if (!P || !P.id) return;
  P.order = o || PARTY_ORDERS[(PARTY_ORDERS.indexOf(P.order) + 1) % PARTY_ORDERS.length];
  const e = partyEnt(); if (e) { P.x = e.x; P.y = e.y; P.map = G.mapId; P.trail = []; }
  const n = COMPANIONS[P.id].name.split(' ')[0];
  msg(P.order === 'follow' ? `${n} falls in behind you.` : P.order === 'wait' ? `${n} stops where she is and waits.`.replace('she', P.id === 'kaelen' ? 'he' : 'she') : `${n} nods, and goes as quiet as a held breath. No fighting, no singing.`, '', 2500);
  partyHud();
}
function partyMenu(e) {
  const P = G.party, C = COMPANIONS[P.id], n = C.name.split(' ')[0];
  showEvent(C.name, `${n} is ${PARTY_ORDER_NAME[P.order].toLowerCase()}. Health ${Math.ceil(P.hp)} of ${partyMax(P.id)}. ${C.ability.name}: ${P.cd > 0 ? 'ready in ' + Math.ceil(P.cd) + ' seconds' : 'ready'}.`, [
    { t: '"Follow me."', f: () => partyOrder('follow') },
    { t: '"Wait here."', f: () => partyOrder('wait') },
    { t: '"Keep quiet. Don\'t fight, don\'t sing."', f: () => partyOrder('quiet') },
    { t: '"Go back to the camp."', f: () => partyDismiss(false) },
  ]);
}

// ---------------------------------------------------------------- abilities
function partyAbility() {
  const P = G.party; if (!P || !P.id) return;
  const e = partyEnt(); if (!e || P.map !== G.mapId) { msg('They are not with you.', '', 1500); return; }
  if (P.cd > 0) { msg(`${COMPANIONS[P.id].ability.name} is not ready (${Math.ceil(P.cd)}s).`, '', 1500); return; }
  if (P.order === 'quiet') { msg('You told them to keep quiet.', '', 1500); return; }
  if (P.id === 'kaelen') {
    let best = null, bd = 49;
    for (const o of G.ents) if (o.kind === 'enemy' && !o.dead && !o.hidden && o.state !== 'passive') { const d = dist2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } }
    if (!best) { msg('Kaelen looks round for something to break and finds nothing.', '', 2000); return; }
    P.cd = COMPANIONS.kaelen.ability.cd; addNoise(3); Audio_.sfx.crack();
    e.x = best.x - (best.x - e.x) * 0.25; e.y = best.y - (best.y - e.y) * 0.25;
    partyHit(best, best.def.cacophony ? 40 : 26, true);
    for (const o of G.ents) if (o !== best && o.kind === 'enemy' && !o.dead && !o.hidden && dist2(o.x, o.y, best.x, best.y) < 9) o.stun = Math.max(o.stun || 0, 1.5);
    msg(`Kaelen's glass arm comes down on ${theName(best.def.name, false)} like a struck bell. Everything near it reels.`, 'good', 3000);
  } else {
    if (G.mutedT > 0 || G.ents.some(o => o.kind === 'enemy' && !o.dead && !o.hidden && o.def.quiet && dist2(o.x, o.y, e.x, e.y) < 16)) { msg('Lyra opens her mouth and nothing comes out. Not here.', 'bad', 2000); return; }
    const sung = !!G.flags.lyra_voice;
    P.cd = COMPANIONS.lyra.ability.cd; addNoise(sung ? 3.6 : 3.0); Audio_.sfx.fifth();
    let n = 0; const stopped = [];
    // before her voice returns she whistles it, and a whistle can be aimed: the one you are looking at stops longest (R3)
    let aim = null;
    if (!sung) { const c = Engine.cam; let bd = 144; for (const o of G.ents) { if (o.kind !== 'enemy' || o.dead || o.hidden || !o.def.cacophony) continue; const d = dist2(o.x, o.y, c.x, c.y); if (d >= bd || Math.abs(normAng(Math.atan2(o.y - c.y, o.x - c.x) - c.dir)) > 0.3 || !los(c.x, c.y, o.x, o.y)) continue; bd = d; aim = o; } }
    for (const o of G.ents) if (o.kind === 'enemy' && !o.dead && !o.hidden && o.def.cacophony && (o === aim || dist2(o.x, o.y, e.x, e.y) < 196)) { o.stun = Math.max(o.stun || 0, sung ? 3.5 : aim ? (o === aim ? 4 : 1.5) : 2.5); n++; stopped.push(o); }
    if (typeof NARROW28 !== 'undefined') NARROW28.onFifth(aim ? [aim] : stopped);
    if (aim) msg('Lyra whistles the falling fifth through two fingers, straight at the one you are looking at. It stops dead; the rest falter.', 'good', 3500);
    else msg(sung ? (n ? `Lyra sings the calling-song, all of it, the turn and the falling fifth. ${n === 1 ? 'The Cacophony stops' : 'Every Cacophony in hearing stops'} to listen.` : 'Lyra sings the calling-song into the dark, and nothing out there is listening.') : (n ? `Lyra cannot sing it, so she whistles it through two fingers: the turn and the falling fifth. ${n === 1 ? 'The Cacophony stops' : 'Every Cacophony in hearing stops'} to listen.` : 'Lyra whistles the falling fifth into the dark, and nothing out there is listening.'), n ? 'good' : '', 3500);
  }
  partyHud();
}
function partyHit(o, dmg, big) {
  const d = o.def;
  if (d.quiet || d.hushkin) { dmg = Math.floor(dmg * 0.4); if (!big && Math.random() < 0.3) msg('Kaelen\'s glass cannot ring inside it.', 'warn', 1800); }
  if (o.type === 'wearer_coda' || o.type === 'requiem') dmg = codaShield(o, dmg);
  if (d.cacophony && !big) dmg = Math.floor(dmg * 1.35);
  o.hp -= dmg; o.flash = true;
  if (o.state === 'idle' || o.state === 'passive') o.state = 'chase';
  Audio_.sfx.glasshit();
  if (o.hp <= 0) { killEnemy(o, false); msg(`Kaelen finishes ${theName(d.name, false)}.`, 'good', 2000); }
}

// ---------------------------------------------------------------- per-frame
function partyBark(key) {
  const P = G.party; if (!P || !P.id) return;
  const k = P.id + ':' + key; if (P.said[k]) return;
  const line = PARTY_BARKS[P.id][key]; if (!line) return;
  P.said[k] = true; msg(`${COMPANIONS[P.id].name.split(' ')[0]}: "${line}"`, 'voice', 5500);
}
function partyTick(dt) {
  const P = G.party;
  if (!P || !P.id) return;
  if (!G.flags.part4 || !PARTY_MAPS.includes(G.mapId)) { if (!G.flags.part4) { G.party = null; partyRemoveEnt(); partyHud(); } return; }
  // story: Lyra takes her place in the choir once the coda begins
  if (P.id === 'lyra' && G.flags.coda_go) { msg('Lyra goes ahead of you into the choir, to her place.', 'voice', 4000); partyDismiss(true); return; }
  if (P.cd > 0) { P.cd -= dt; if (P.cd <= 0 && G.ents.some(o => o.kind === 'enemy' && !o.dead && !o.hidden && o.state === 'chase')) { msg(`${COMPANIONS[P.id].name.split(' ')[0]} is ready: X for ${COMPANIONS[P.id].ability.name}.`, 'good', 2200); Audio_.sfx.song(P.id === 'kaelen' ? 660 : 523, 0.25); } }
  const e = partyEnt(); if (!e || P.map !== G.mapId) { partyHud(); return; }
  if (!e.firstMapBark || e.firstMapBark !== G.mapId) { e.firstMapBark = G.mapId; partyBark('map:' + G.mapId); }
  const c = Engine.cam, C = COMPANIONS[P.id];
  const dPlayer = Math.hypot(c.x - e.x, c.y - e.y);
  // the Narrow: a companion is not silent unless told to be
  if (P.order !== 'quiet') { G.noise = Math.max(G.noise, C.noise); }
  // pick a fight
  let foe = null, fd = 49;
  if (P.order !== 'quiet') for (const o of G.ents) {
    if (o.kind !== 'enemy' || o.dead || o.hidden || o.state !== 'chase') continue;
    const d = dist2(o.x, o.y, e.x, e.y); if (d < fd && (P.order === 'follow' || d < 9)) { fd = d; foe = o; }
  }
  if (foe && !P.said[P.id + ':' + foe.type]) partyBark(foe.type);
  let tx = null, ty = null, sp = 2.6;
  const pSpd = 2.6 + ((G.player.attrs && G.player.attrs.Speed) || 40) / 60;
  const pMoving = e.lastCam ? Math.hypot(c.x - e.lastCam[0], c.y - e.lastCam[1]) > 0.002 : false; e.lastCam = [c.x, c.y];
  if (P.id === 'kaelen' && foe) {
    const d = Math.sqrt(fd);
    if (d > 1.0) { tx = foe.x; ty = foe.y; sp = 2.4; }
    else { e.atkT = (e.atkT || 0) - dt; if (e.atkT <= 0) { e.atkT = 1.3; partyHit(foe, rndi(5, 11) + Math.floor((G.player.level || 1) / 2), false); addNoise(0.8); } }
  } else if (P.id === 'lyra' && foe && Math.sqrt(fd) < 2.2) {
    // Lyra is a teacher, not a fighter: she backs away from anything that gets close, towards you
    const ax = e.x - foe.x + (c.x - e.x) * 0.5, ay = e.y - foe.y + (c.y - e.y) * 0.5, al = Math.hypot(ax, ay) || 1;
    tx = e.x + ax / al; ty = e.y + ay / al; sp = pSpd * 1.1;
  } else if (P.order === 'follow') {
    // walk the player's footsteps, at the player's pace
    const last = P.trail[P.trail.length - 1];
    if (!last || Math.hypot(last[0] - c.x, last[1] - c.y) > 0.4) { P.trail.push([c.x, c.y]); if (P.trail.length > 60) P.trail.shift(); }
    while (P.trail.length && Math.hypot(P.trail[0][0] - e.x, P.trail[0][1] - e.y) < 0.35) P.trail.shift();
    if (dPlayer > 2.1) e.walking = true; else if (dPlayer < 1.5) e.walking = false;
    sp = dPlayer > 3.2 ? pSpd * 1.9 : dPlayer > 2.2 ? pSpd * 1.1 : pSpd * 0.85;
    if (e.walking) { if (P.trail.length) [tx, ty] = P.trail[0]; else { tx = c.x; ty = c.y; } }
    // step aside when you walk towards them
    const fwx = Math.cos(c.dir), fwy = Math.sin(c.dir), rx = e.x - c.x, ry = e.y - c.y;
    const ahead = rx * fwx + ry * fwy, side = rx * -fwy + ry * fwx;
    if (!e.walking && dPlayer < 1.5 && ahead > 0 && Math.abs(side) < 0.6 && pMoving) {
      const sgn = side >= 0 ? 1 : -1; tx = e.x - fwy * sgn * 0.8; ty = e.y + fwx * sgn * 0.8; sp = pSpd;
    }
  }
  if (tx != null) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    const moved = moveWithSlide(e, dx / d * Math.min(sp * dt, d), dy / d * Math.min(sp * dt, d), e);
    e.facing = Math.atan2(dy, dx);
    e.stuckT = moved ? 0 : (e.stuckT || 0) + dt;
  }
  // too far behind, or stuck on a willow: catch up the way companions do in old games
  if (P.order === 'follow' && (dPlayer > 9 || (e.stuckT || 0) > 1.2)) {
    const b = P.trail.length > 3 ? P.trail[P.trail.length - 4] : [c.x - Math.cos(c.dir), c.y - Math.sin(c.dir)];
    if (!solidAt(b[0], b[1])) { e.x = b[0]; e.y = b[1]; } e.stuckT = 0; P.trail = [];
  }
  P.x = e.x; P.y = e.y;
  // Lyra: the tending note when you are hurt
  const p = G.player;
  if (P.id === 'lyra' && P.order !== 'quiet' && p.hp < p.hpMax * 0.45 && !G.dead) {
    e.healT = (e.healT || 0) - dt;
    const silenced = G.mutedT > 0 || G.ents.some(o => o.kind === 'enemy' && !o.dead && !o.hidden && o.def.quiet && dist2(o.x, o.y, e.x, e.y) < 16);
    if (e.healT <= 0 && !silenced && dPlayer < 6) {
      e.healT = 18; fx('song', 500);
      if (G.flags.lyra_voice) { p.hp = Math.min(p.hpMax, p.hp + Math.max(14, Math.round(p.hpMax * 0.22))); addNoise(1.8); Audio_.sfx.song(174, 1.2); if (!P.said['lyra:hurt']) partyBark('hurt'); else msg('Lyra sings the tending note under her breath. Something knits.', 'good', 2500); }
      // no voice yet: the tending breath, smaller (R3)
      else { p.hp = Math.min(p.hpMax, p.hp + Math.max(8, Math.round(p.hpMax * 0.12))); addNoise(0.9); Audio_.sfx.song(174, 0.6); msg('Lyra breathes the tending note close to your ear: no voice in it, only breath. Something knits, a little.', 'good', 3000); }
    }
  }
  if (P.id === 'kaelen' && p.hp < p.hpMax * 0.35) partyBark('hurt');
  // taking hits: anything chasing that is closer to them than to you
  e.hurtT = (e.hurtT || 0) - dt;
  if (e.hurtT <= 0) {
    e.hurtT = 1.6;
    for (const o of G.ents) {
      if (o.kind !== 'enemy' || o.dead || o.hidden || o.state !== 'chase' || o.stun > 0) continue;
      const de = Math.hypot(o.x - e.x, o.y - e.y);
      if (de < o.def.reach + 0.3 && de < Math.hypot(o.x - c.x, o.y - c.y) && Math.random() < 0.6) {
        P.hp -= rndi(o.def.dmg[0], o.def.dmg[1]);
        if (P.hp < partyMax(P.id) * 0.35) partyBark('selfhurt');
        if (P.hp <= 0) { partyDowned(); return; }
        break;
      }
    }
  }
  // now and then, out of a fight, they talk
  if (!foe && P.order !== 'quiet') { e.chatT = (e.chatT == null ? rnd(90, 150) : e.chatT) - dt; if (e.chatT <= 0) { e.chatT = rnd(150, 240); partyChat(); } }
  // out of a fight they mend, slowly
  if (!foe && P.hp < partyMax(P.id)) P.hp = Math.min(partyMax(P.id), P.hp + dt * 0.35);
  partyHud();
}
function partyDowned() {
  const P = G.party, n = COMPANIONS[P.id].name.split(' ')[0], id = P.id;
  P.downed[id] = true; P.hp = 1;
  msg(`${n} goes down in the moss. You get ${id === 'kaelen' ? 'him' : 'her'} back to the camp fire, somehow. ${id === 'kaelen' ? 'He' : 'She'} will not be fit to go anywhere until you have both rested.`, 'bad', 7000);
  partyDismiss(true);
}

// ---------------------------------------------------------------- HUD
function partyHud() {
  let el = document.getElementById('party');
  const P = G.party, show = P && P.id && G.state !== 'title' && G.flags.part4;
  if (!show) { if (el) el.classList.add('hidden'); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'party';
    el.innerHTML = '<img class="pp" alt=""><div class="pn"></div><div class="pbar"><i></i></div><button class="po" type="button"></button><button class="pa" type="button"></button>';
    document.getElementById('game').appendChild(el);
    el.querySelector('.po').onclick = (ev) => { ev.stopPropagation(); partyOrder(); };
    el.querySelector('.pa').onclick = (ev) => { ev.stopPropagation(); partyAbility(); };
  }
  const C = COMPANIONS[P.id], mx = partyMax(P.id);
  const sig = [P.id, P.order, Math.ceil(P.hp), mx, Math.ceil(Math.max(0, P.cd)), P.map === G.mapId].join('|');
  if (el.dataset.sig === sig && !el.classList.contains('hidden')) return;
  el.dataset.sig = sig;
  el.classList.remove('hidden');
  el.classList.toggle('low', P.hp < mx * 0.35);
  el.classList.toggle('ready', !(P.cd > 0));
  const img = el.querySelector('.pp'); if (img.dataset.id !== P.id) { img.src = `img/p_${C.portrait}.jpg`; img.dataset.id = P.id; }
  el.querySelector('.pn').textContent = C.name.split(' ')[0] + (P.map !== G.mapId ? ' (elsewhere)' : '');
  el.querySelector('.pbar i').style.width = Math.max(0, Math.min(100, P.hp / mx * 100)) + '%';
  el.querySelector('.po').textContent = 'G · ' + PARTY_ORDER_NAME[P.order];
  el.querySelector('.pa').textContent = 'X · ' + C.ability.name + (P.cd > 0 ? ` ${Math.ceil(P.cd)}s` : '');
  el.querySelector('.pa').classList.toggle('cool', P.cd > 0);
}

// ---------------------------------------------------------------- camp dialogue: "Come with me"
(() => {
  for (const id of ['kaelen', 'lyra']) {
    const npc = NPCS[COMPANIONS[id].camp], q = npc.quest;
    npc.quest = (g) => {
      const r = q ? q(g) : null;
      if ((r && r.choices && r.choices.length) || !partyAvailable(id) || !g.flags.part4) return r;
      const P = g.party || {};
      if (P.downed && P.downed[id]) return { text: (r ? r.text + '<br><br>' : '') + (id === 'kaelen' ? '"Not yet." He doesn\'t get up. "Rest first. Then ask me again."' : '"Not yet," she says. "Let me sit a while. Rest, and ask me again."') };
      return { text: r ? r.text : (id === 'kaelen' ? 'He is sitting by the fire with the glass hand turned to the light, listening to it.' : 'She is by the fire with her slate in her lap, humming under her breath, exactly in the middle of the Narrow.'), choices: [
        { t: '"Come with me."', f: () => partyJoin(id) },
        { t: '"Stay by the fire."', f: () => id === 'kaelen' ? '"Suits me."' : '"I\'ll keep it warm."' },
      ] };
    };
  }
})();

// ---------------------------------------------------------------- wrap the engine (load order: after game.js)
(() => {
  const _loadMap = loadMap;
  loadMap = function (id, pos) { const r = _loadMap(id, pos); if (G.party && G.party.id) partySpawn(); else partyCampNpcs(); return r; };
  const _talk = talk;
  talk = function (e) { if (e && e.companion) { if (G.party && G.party.id) partyMenu(e); return; } return _talk(e); };
  const _rest = doRest;
  doRest = function (kind) {
    const r = _rest(kind);
    if (G.party) { G.party.downed = {}; G.party.hpById = {}; if (G.party.id) { G.party.hp = partyMax(G.party.id); partyBark('rest'); } }
    return r;
  };
  const _snap = snapshotGame;
  snapshotGame = function () {
    const s = _snap(); const P = G.party;
    if (P) s.party = { id: P.id, order: P.order, hp: P.hp, cd: Math.max(0, P.cd || 0), map: P.map, x: P.x, y: P.y, said: P.said, downed: P.downed, hpById: P.hpById };
    return s;
  };
  const _restore = restoreGame;
  restoreGame = function (d) {
    const r = _restore(d);
    G.party = null;
    const s = d && d.party;
    if (s && typeof s === 'object' && G.flags.part4) {
      const id = COMPANIONS[s.id] ? s.id : null;
      const num = (v, lo, hi, def) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : def;
      const flags = (o) => { const out = {}; if (o && typeof o === 'object') for (const k in o) if (/^[a-z]+(:[a-z:_]+)?$/.test(k) && k.length < 40) out[k] = !!o[k]; return out; };
      const hpById = {}; if (s.hpById && typeof s.hpById === 'object') for (const k of Object.keys(COMPANIONS)) if (typeof s.hpById[k] === 'number') hpById[k] = num(s.hpById[k], 1, partyMax(k), partyMax(k));
      G.party = {
        id: id && partyAvailable(id) ? id : null,
        order: PARTY_ORDERS.includes(s.order) ? s.order : 'follow',
        hp: id ? num(s.hp, 1, partyMax(id), partyMax(id)) : 0,
        cd: num(s.cd, 0, 60, 0), map: PARTY_MAPS.includes(s.map) ? s.map : G.mapId,
        x: num(s.x, 0, 100, Engine.cam.x), y: num(s.y, 0, 100, Engine.cam.y),
        said: flags(s.said), downed: flags(s.downed), hpById, trail: [],
      };
      if (G.party.map !== G.mapId && G.party.order !== 'wait') G.party.map = G.mapId;
    }
    if (G.party && G.party.id) partySpawn(); else { partyRemoveEnt(); partyCampNpcs(); }
    partyHud();
    return r;
  };
  window.loadCode = async (c) => restoreGame(await decodeSave(c));
  // keys
  // a companion standing in front of you should not get in the way of the use key
  const _interact = interact;
  interact = function () {
    const first = Engine.pick(G.ents, USE_RANGE);
    if (first && first.companion) {
      first.hidden = true;
      const behind = Engine.pick(G.ents, USE_RANGE);
      const c = Engine.cam, fx0 = Math.cos(c.dir), fy0 = Math.sin(c.dir);
      const near = G.ents.some(o => !o.hidden && !o.dead && (o.kind === 'item' || o.kind === 'npc' || (o.kind === 'deco' && o.use)) && (() => { const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy); return d < 1.7 + (o.radius || 0) && (dx * fx0 + dy * fy0) / (d || 1) > 0.8; })());
      const w = Engine.pickWall(2.0), door = w && w.cell && w.cell.door;
      if (behind || near || door) { try { return _interact(); } finally { first.hidden = false; } }
      first.hidden = false;
    }
    return _interact();
  };
  // they notice when a big one falls
  const _kill = killEnemy;
  killEnemy = function (e, byGlass) {
    const r = _kill(e, byGlass); const P = G.party;
    if (e && e.def && e.def.boss && P && P.id && P.map === G.mapId && P.order !== 'wait') { const L = PARTY_BOSS[P.id]; setTimeout(() => partySay(L[Math.floor(Math.random() * L.length)]), 1400); }
    return r;
  };
  window.addEventListener('keydown', (ev) => {
    if (G.state !== 'play' || ev.repeat) return;
    const k = keyOf(ev);
    if (k === 'g') partyOrder();
    else if (k === 'x') partyAbility();
  });
})();

// a line from whoever is with you, for story scenes
function partyLine(lines) {
  const P = G.party; if (!P || !P.id || P.order === 'wait' || P.map !== G.mapId) return '';
  return lines[P.id] ? '<br><br>' + lines[P.id] : '';
}
