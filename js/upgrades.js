/* eslint-disable no-func-assign */
// ============================================================
//  UPGRADES — Echoes of the Shattered Octave: Master Expansion
//  Implements the Roadmap upgrades:
//  - Spellmaking for Songs (combine notes, intervals, dynamics)
//  - Coloured dynamic lighting, lantern toggle & distant landmarks
//  - Difficulty, Accessibility, Subtitles, CRT/Dither/Pixel & Key Rebinding
//  - Directional Melee modifiers, Blocking & Parrying, Weak Points,
//    Stealth Backstabs, Throwing Knives, Status Effects, Morale & Surrender,
//    Boss Phases, Elite Enemies & Trial of the Narrow Arena
// ============================================================
'use strict';

const UPG = {
  // Settings & Accessibility
  difficulty: 'standard', // 'narrative' | 'standard' | 'narrow'
  subtitles: true,
  tts: false,
  colorblind: false,
  crt: false,
  dither: false,
  pixelScale: 1,
  minimap: true,
  questMarkers: true,
  lantern: false,
  tutorial: true,
  keybinds: {
    forward: 'w', back: 's', left: 'a', right: 'd',
    interact: 'e', block: 'f', songs: 'tab', map: 'm',
    travel: 't', codex: 'j', lantern: 'u',
  },
  rebinding: null,

  // Combat & Status state
  blocking: false,
  parryWindow: 0,
  parryCool: 0,
  status: { bleed: 0, deaf: 0, hushed: 0, fear: 0 },
  hitSparks: [],

  // World & Weather state
  weather: 'clear', // 'clear' | 'rain' | 'fog' | 'snow'
  weatherT: 45,
  swimDepth: 0,
  breath: 10,

  // Bestiary, Codex & Achievements
  bestiary: {},
  codexRead: {},
  achievements: {},
  autosaveSlot: null,
};

// ============================================================
//  1. SPELLMAKING FOR SONGS (Daggerfall Spellmaker for the Octave)
// ============================================================
const SONG_NOTES = [
  { id: 'n174', hz: '174', freq: 174, name: '174 Hz · Root Foundation', effect: 'heal', power: 12, cost: 6, noise: 1.4, desc: 'Mends flesh and steadies the Narrow.' },
  { id: 'n285', hz: '285', freq: 285, name: '285 Hz · Flambeau Ward', effect: 'ward', power: 8, cost: 7, noise: 1.6, desc: 'Hardens skin and turns aside blows (+4 AR for 18s).' },
  { id: 'n396', hz: '396', freq: 396, name: '396 Hz · Quarry-Breaker', effect: 'shatter', power: 16, cost: 9, noise: 2.5, desc: 'Resonant shockwave that cracks stone, bronze and armour.' },
  { id: 'n528', hz: '528', freq: 528, name: '528 Hz · Sun-Glass', effect: 'sear', power: 20, cost: 11, noise: 2.8, desc: 'Harmonic burst that sears Cacophony and lights the dark.' },
  { id: 'n639', hz: '639', freq: 639, name: '639 Hz · Drift-Wind', effect: 'haste', power: 14, cost: 8, noise: 1.2, desc: 'Restores fatigue and quickens your step for 15s.' },
  { id: 'n741', hz: '741', freq: 741, name: '741 Hz · Catalogue Unnaming', effect: 'stun_core', power: 18, cost: 10, noise: 1.8, desc: 'Disrupts glass cores, Proctors and Legionnaires.' },
];

const SONG_CADENCES = [
  { id: 'unison', name: 'Pure Unison', multCost: 1.0, multPower: 1.0, multNoise: 0.9, target: 'self', desc: 'Focused inward or on a single point.' },
  { id: 'fifth', name: 'Falling Fifth', multCost: 1.25, multPower: 1.15, multNoise: 1.3, stun: 2.5, target: 'aoe', desc: 'Spreads outward; stuns nearby Cacophony.' },
  { id: 'third', name: 'Minor Third', multCost: 0.9, multPower: 0.95, multNoise: 0.65, mendFat: 10, target: 'cone', desc: 'Sung under the breath; gentle on the Narrow.' },
  { id: 'seventh', name: 'Dissonant Seventh', multCost: 1.35, multPower: 1.45, multNoise: 1.5, bleed: 4, target: 'cone', desc: 'Jagged interval that tears static and flesh alike.' },
  { id: 'octave', name: 'Full Octave', multCost: 1.6, multPower: 1.75, multNoise: 1.8, target: 'aoe', desc: 'Commands the whole room; loud enough to wake hounds.' },
];

const SONG_DYNAMICS = [
  { id: 'whisper', name: 'Sotto Voce (Whisper)', costMod: 0.75, powerMod: 0.75, noiseMod: 0.45, desc: 'Barely above a murmur; safe in hound country.' },
  { id: 'narrow', name: 'Mezzo (In the Narrow)', costMod: 1.0, powerMod: 1.0, noiseMod: 1.0, desc: 'Balanced projection.' },
  { id: 'forte', name: 'Pieno (Full Voice)', costMod: 1.35, powerMod: 1.5, noiseMod: 1.65, desc: 'Maximum resonance; dangerously loud.' },
];

const SM_STATE = { note: 0, note2: -1, cadence: 0, dyn: 1, name: 'Custom Canticle' };

function computeCustomSong(st) {
  const n1 = SONG_NOTES[st.note] || SONG_NOTES[0];
  const n2 = st.note2 >= 0 ? SONG_NOTES[st.note2] : null;
  const cad = SONG_CADENCES[st.cadence] || SONG_CADENCES[0];
  const dyn = SONG_DYNAMICS[st.dyn] || SONG_DYNAMICS[1];
  const rawCost = (n1.cost + (n2 ? n2.cost * 0.7 : 0)) * cad.multCost * dyn.costMod;
  const skillDiscount = G.player && G.player.skills ? Math.min(0.35, (G.player.skills['Law-Song'] || 0) * 0.004) : 0;
  const cost = Math.max(2, Math.round(rawCost * (1 - skillDiscount)));
  const power = Math.round((n1.power + (n2 ? n2.power * 0.65 : 0)) * cad.multPower * dyn.powerMod);
  const noise = +(Math.max(0.4, (n1.noise + (n2 ? n2.noise * 0.4 : 0)) * cad.multNoise * dyn.noiseMod)).toFixed(1);
  const hz = n2 ? `${n1.hz}→${n2.hz}` : n1.hz;
  const effects = [n1.effect];
  if (n2 && n2.effect !== n1.effect) effects.push(n2.effect);
  return {
    name: cleanName(st.name || 'Custom Canticle'),
    hz, freq: n1.freq, freq2: n2 ? n2.freq : null,
    cost, power, noise, effects,
    cadence: cad.id, dyn: dyn.id, stun: cad.stun || 0, bleed: cad.bleed || 0, mendFat: cad.mendFat || 0,
    custom: true,
    desc: `${cad.name} (${dyn.name}): ${n1.desc}${n2 ? ' + ' + n2.desc : ''}`,
  };
}

function executeCustomSong(s) {
  const p = G.player, c = Engine.cam;
  if (s.noise >= 2.5 || (s.effects || []).some(ef => ['shatter', 'sear', 'stun_core'].includes(ef))) exposeDisguise('A patrol witnesses your resonant Song.');
  Audio_.sfx.song(s.freq || 174, 1.3);
  if (s.freq2) setTimeout(() => Audio_.sfx.song(s.freq2, 0.9), 360);
  gainSkill('Law-Song', 2);
  const notes = [];
  if (s.mendFat) p.fat = Math.min(p.fatMax, p.fat + s.mendFat);
  for (const ef of (s.effects || [])) {
    if (ef === 'heal') {
      p.hp = Math.min(p.hpMax, p.hp + s.power);
      if (UPG.status.bleed > 0) { UPG.status.bleed = 0; notes.push('staunches bleeding'); }
      notes.push(`heals ${s.power}`);
    } else if (ef === 'ward') {
      G.songWardT = 18; G.songWardAR = Math.max(3, Math.round(s.power / 2));
      notes.push(`+${G.songWardAR} AR ward`);
    } else if (ef === 'haste') {
      p.fat = Math.min(p.fatMax, p.fat + s.power * 2);
      G.hasteT = 15;
      notes.push('quickens step');
    } else if (ef === 'shatter' || ef === 'sear' || ef === 'stun_core') {
      let hitN = 0;
      for (const e of G.ents) {
        if ((e.kind !== 'enemy' && !(lawActive() && e.kind === 'npc' && !e.companion && e.id !== 'cat')) || e.dead || e.hidden) continue;
        const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
        if (d > (s.cadence === 'aoe' || s.cadence === 'fifth' || s.cadence === 'octave' ? 8.5 : 5.5)) continue;
        if (s.cadence === 'cone' && Math.abs(normAng(Math.atan2(dy, dx) - c.dir)) > 0.75) continue;
        if (e.kind === 'npc') { if (los(c.x, c.y, e.x, e.y)) assaultCivilian(e); continue; }
        let dmg = s.power;
        if (ef === 'sear' && e.def.cacophony) dmg = Math.round(dmg * 1.5);
        if (ef === 'shatter' && (e.def.armored || e.def.core)) dmg = Math.round(dmg * 1.45);
        if (ef === 'stun_core' && e.def.core) { e.stun = Math.max(e.stun || 0, 4.0); dmg = Math.round(dmg * 1.3); }
        if (e.def.quiet) dmg = Math.round(dmg * 0.35);
        if (e.def.coda) dmg = codaShield(e, dmg);
        e.hp -= dmg; e.flash = true; setTimeout(() => { e.flash = false; }, 110);
        if (s.stun && e.def.cacophony) e.stun = Math.max(e.stun || 0, s.stun);
        if (s.bleed) e.bleed = (e.bleed || 0) + s.bleed;
        if (e.state === 'idle' || e.state === 'passive' || e.state === 'investigate') { delete e.investigation; e.state = 'chase'; e.alertT = 8; }
        spawnHitParticles(e, 'glass');
        if (e.hp <= 0) killEnemy(e, true);
        hitN++;
      }
      // Check resonant secret walls in front of player
      if (ef === 'shatter' || s.freq === 396) checkResonantWall(s.freq);
      notes.push(hitN ? `strikes ${hitN} foe${hitN > 1 ? 's' : ''}` : 'rings into the room');
    }
  }
  if (s.stun) {
    for (const e of G.ents) {
      if (e.kind === 'enemy' && !e.dead && !e.hidden && e.def.cacophony && dist2(e.x, e.y, c.x, c.y) < 64) {
        e.stun = Math.max(e.stun || 0, s.stun);
      }
    }
  }
  unlockAchievement('composer', 'Composer of the Octave', 'Composed and sang a custom Song.');
  msg(`You sing ${s.name} (${s.hz} Hz): ${notes.join(', ')}.`, 'good', 3500);
}

function renderSpellmaker() {
  const preview = computeCustomSong(SM_STATE);
  const html = `<h2>Compose a Song · The Octave</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted">Combine a Root Note, an optional harmonic partner, a Cadence, and a Dynamic toinscribe a custom Song into your Song-book.</p>
  <div class="row" style="margin-top:1cqh">
    <div class="col">
      <h3>1. Primary Note</h3>
      <div class="list">${SONG_NOTES.map((n, i) => `<button class="dfbtn small ${SM_STATE.note === i ? 'sel' : ''}" data-n1="${i}"><b>${n.name}</b><br><small class="muted">${n.desc}</small></button>`).join('')}</div>
      <h3>2. Harmonic Over-Note (Optional)</h3>
      <div class="btns">
        <button class="dfbtn small ${SM_STATE.note2 === -1 ? 'sel' : ''}" data-n2="-1">None</button>
        ${SONG_NOTES.map((n, i) => `<button class="dfbtn small ${SM_STATE.note2 === i ? 'sel' : ''}" data-n2="${i}">${n.hz} Hz</button>`).join('')}
      </div>
    </div>
    <div class="col">
      <h3>3. Cadence & Interval</h3>
      <div class="list">${SONG_CADENCES.map((c, i) => `<button class="dfbtn small ${SM_STATE.cadence === i ? 'sel' : ''}" data-cad="${i}"><b>${c.name}</b> — <small class="muted">${c.desc}</small></button>`).join('')}</div>
      <h3>4. Dynamic</h3>
      <div class="btns">${SONG_DYNAMICS.map((d, i) => `<button class="dfbtn small ${SM_STATE.dyn === i ? 'sel' : ''}" data-dyn="${i}">${d.name}</button>`).join('')}</div>
      <h3>5. Inscription</h3>
      <p><input type="text" id="sm-name" maxlength="24" value="${preview.name}" style="width:100%"></p>
      <div class="slot" style="display:block;padding:.8cqh 1cqw">
        <b style="color:var(--gold)">${preview.name} (${preview.hz} Hz)</b><br>
        <span>Cost: <b>${preview.cost} Voice</b> · Magnitude: <b>${preview.power}</b> · Noise: <b>${preview.noise} (${'♪'.repeat(Math.min(6, Math.ceil(preview.noise)))})</b></span><br>
        <small class="muted">${preview.desc}</small>
      </div>
      <div class="btns">
        <button class="dfbtn" id="sm-save">Inscribe into Song-book</button>
        <button class="dfbtn small" id="sm-test">Test Tone</button>
        <button class="dfbtn small" id="sm-back">Back to Song-book</button>
      </div>
    </div>
  </div>`;
  openModal(html, 'spellmaker');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#sm-back').onclick = () => renderSongs();
  $('#sm-name').oninput = (ev) => { SM_STATE.name = ev.target.value; };
  document.querySelectorAll('[data-n1]').forEach(b => b.onclick = () => { SM_STATE.note = +b.dataset.n1; Audio_.sfx.song(SONG_NOTES[SM_STATE.note].freq, 0.35); renderSpellmaker(); });
  document.querySelectorAll('[data-n2]').forEach(b => b.onclick = () => { SM_STATE.note2 = +b.dataset.n2; if (SM_STATE.note2 >= 0) Audio_.sfx.song(SONG_NOTES[SM_STATE.note2].freq, 0.35); renderSpellmaker(); });
  document.querySelectorAll('[data-cad]').forEach(b => b.onclick = () => { SM_STATE.cadence = +b.dataset.cad; renderSpellmaker(); });
  document.querySelectorAll('[data-dyn]').forEach(b => b.onclick = () => { SM_STATE.dyn = +b.dataset.dyn; renderSpellmaker(); });
  $('#sm-test').onclick = () => { Audio_.sfx.song(preview.freq, 0.6); if (preview.freq2) setTimeout(() => Audio_.sfx.song(preview.freq2, 0.6), 280); };
  $('#sm-save').onclick = () => {
    SM_STATE.name = $('#sm-name').value || 'Custom Canticle';
    const built = computeCustomSong(SM_STATE);
    const id = 'custom_' + Date.now().toString(36);
    SONGS[id] = built;
    G.player.customSongs = G.player.customSongs || {};
    G.player.customSongs[id] = built;
    if (!G.player.songs.includes(id)) G.player.songs.push(id);
    Audio_.sfx.pickup();
    msg(`Inscribed "${built.name}" (${built.hz} Hz) into your Song-book.`, 'good', 3500);
    renderSongs();
  };
}

// ============================================================
//  2. COMBAT UPGRADES: Directional Melee, Blocking/Parrying,
//     Weak Points, Status Effects, Stealth Backstabs, Morale & Phases
// ============================================================

// Add Throwing Knives & Rare Named Weapons to WEAPONS & ITEMS
Object.assign(WEAPONS, {
  throwknife: {
    name: 'Throwing Knives', img: 'fp_knife', dmg: [5, 11], reach: 7.5, noise: 0.5, speed: 0.32,
    type: 'iron', ranged: true, ammo: 'tknives', value: 22,
    desc: 'Balanced carder\'s blades for silent ranged work. Recuperable and deadly from behind.',
  },
  tobin_blade: {
    name: 'Tobin\'s Tuning-Blade', img: 'fp_longsword', dmg: [9, 17], reach: 1.65, noise: 1.2, speed: 0.44,
    type: 'bronze', value: 140, rare: true,
    desc: 'Forged in 415 for Cantor Tobin Ashgrove. Ground to ring at 174 Hz; it hurts the Cacophony and calms the Hush.',
  },
  vesper_hook: {
    name: 'Vesper\'s Boarding Axe', img: 'fp_axe', dmg: [10, 19], reach: 1.45, noise: 1.8, speed: 0.52,
    type: 'iron', cleave: true, value: 135, rare: true,
    desc: 'First mate Vesper\'s deck-axe from the Wave-Cutter. Its bearded edge splits bell-plate.',
  },
  sable_dagger: {
    name: 'Sable\'s Ivory Nib-Knife', img: 'fp_knife', dmg: [6, 13], reach: 1.25, noise: 0.4, speed: 0.25,
    type: 'glass', value: 125, rare: true,
    desc: 'A Veil scribe\'s stylus-knife tipped with lilac glass. Nearly silent; devastating from behind.',
  },
});

Object.assign(ITEMS, {
  tknives: { name: 'Throwing Knives (×5)', sprite: 'gear', desc: 'Balanced throwing blades. Silent and quick.', use: 'ammo', ammo: 'tknives', n: 5, value: 8 },
  w_throwknife: { name: 'Throwing Knives', sprite: 'gear', weapon: 'throwknife', value: 22, desc: WEAPONS.throwknife.desc },
  w_tobin_blade: { name: 'Tobin\'s Tuning-Blade', sprite: 'gear', weapon: 'tobin_blade', value: 140, desc: WEAPONS.tobin_blade.desc },
  w_vesper_hook: { name: 'Vesper\'s Boarding Axe', sprite: 'gear', weapon: 'vesper_hook', value: 135, desc: WEAPONS.vesper_hook.desc },
  w_sable_dagger: { name: 'Sable\'s Ivory Nib-Knife', sprite: 'gear', weapon: 'sable_dagger', value: 125, desc: WEAPONS.sable_dagger.desc },
  pebble: { name: 'Skipping Stone', sprite: 'loot', desc: 'A loose throwing stone. Clatters where it lands, drawing idle listeners. O opens the throw panel.', use: 'distraction', value: 1 },
  empty_bottle: { name: 'Empty Glass Bottle', sprite: 'loot', desc: 'An empty bottle, not a Vox-Bottle. Shatters farther away and draws more listeners. O opens the throw panel.', use: 'distraction', value: 1 },
  bandage: { name: 'Clean Linen Bandage', sprite: 'loot', desc: 'Stops bleeding and restores 6 health.', use: 'bandage', n: 6, value: 4 },
  whetstone: { name: 'Quarry Whetstone', sprite: 'loot', desc: 'Restores 35% condition to your readied weapon.', use: 'whetstone', n: 35, value: 7 },
  shard: { name: 'Light-Glass Shard', sprite: 'coil', desc: 'A raw green-gold shard harvested from a root-vein. Used to enchant weapons at a forge or Song-book.', use: 'enchant', value: 24 },
  herb_willow: { name: 'Silver Willow-Bark', sprite: 'loot', desc: 'Foraged bark. Steeped with reed-pith, it brews a tonic.', herb: true, value: 3 },
  herb_reed: { name: 'Sweet Reed-Pith', sprite: 'loot', desc: 'Pith from the Flume banks. Soothes the voice and steadies the Narrow.', herb: true, value: 3 },
  herb_moss: { name: 'Lilac Moon-Moss', sprite: 'loot', desc: 'Luminescent moss from drowned stone. Clears deafening and hush-frost.', herb: true, value: 5 },
  flume_eel: { name: 'Smoked Flume-Eel', sprite: 'loot', desc: 'Caught in the Chlorophyll Flume and boiled twice. Restores 10 health and 25 fatigue.', use: 'food', n: 10, value: 4 },
});

function spawnHitParticles(e, style) {
  if (!e || !e._screen) return;
  const s = e._screen;
  const cx = ((s.x0 + s.x1) / 2) | 0, cy = ((s.y0 + s.y1) / 2) | 0;
  const cols = style === 'glass' ? ['#8ff8ff', '#ffe082', '#d2b8ff']
    : style === 'spark' ? ['#ffe082', '#ffab40', '#ffffff']
    : ['#d32f2f', '#8b1a1a', '#ff6659'];
  for (let i = 0; i < 8; i++) {
    UPG.hitSparks.push({
      x: cx + rndi(-6, 6), y: cy + rndi(-6, 6),
      vx: rnd(-38, 38), vy: rnd(-42, 18),
      c: cols[i % cols.length], t: 0.32 + Math.random() * 0.18,
    });
  }
}

function triggerBlock() {
  if (G.state !== 'play' || G.dead) return;
  if (UPG.parryCool > 0) return;
  UPG.blocking = true;
  UPG.parryWindow = 0.28 + (G.player && G.player.perks && G.player.perks.parry ? 0.12 : 0);
  UPG.parryCool = 0.55;
  Audio_.sfx.swing();
}

// ============================================================
//  3. SKILLS, BACKGROUNDS, CUSTOM CLASS BUILDER, PERKS, TITLES & FACTIONS
// ============================================================
const SKILL_LIST = [
  'Blade', 'Blunt', 'Firearms', 'Law-Song', 'Stealth',
  'Climbing', 'Mercantile', 'Glasswork', 'Lore', 'Physician', 'Lockpicking',
];

const BACKGROUNDS = [
  { id: 'hedge', name: 'Hedge-Born', desc: 'Raised inside Oakhaven\'s thorn-wall. +10 Stealth, +5 Hedge Folk standing, quieter footsteps.', mod: { Agility: 5, Willpower: 5 }, skills: { Stealth: 10 }, rep: { hedge: 15 } },
  { id: 'synod', name: 'Synod Orphan', desc: 'Ward of a choir-school before the bells were taken. +10 Law-Song, +10 Lore, +10 Synod standing.', mod: { Intelligence: 5, Willpower: 5 }, skills: { 'Law-Song': 10, Lore: 10 }, rep: { synod: 15 } },
  { id: 'deserter', name: 'Office Deserter', desc: 'Walked out of a Catalogue registry with a clean coat. +10 Firearms, +10 Mercantile, starts with 5 Throwing Knives.', mod: { Agility: 5, Intelligence: 5 }, skills: { Firearms: 10, Mercantile: 10 }, rep: { office: -15, hedge: 10 }, tknives: 5 },
  { id: 'drifter', name: 'Rust Coast Drifter', desc: 'Deck-hand off the western islands. +10 Blade, +10 Climbing, +15 Free Captains standing.', mod: { Strength: 5, Speed: 5 }, skills: { Blade: 10, Climbing: 10 }, rep: { captains: 15 } },
  { id: 'dawning', name: 'Dawning Survivor', desc: 'Stood near the Spire in 412 when the light turned. +15 Glasswork, +10 Physician, resistant to glass-lock.', mod: { Endurance: 5, Willpower: 5 }, skills: { Glasswork: 15, Physician: 10 }, rep: { synod: -10, hedge: 10 } },
];

const CLASS_ADVANTAGES = [
  { id: 'pitch', name: 'Pitch-Perfect', cost: 1, desc: 'Songs cost 20% less Voice and never misfire.' },
  { id: 'hedgestep', name: 'Hedge-Step', cost: 1, desc: 'Movement generates 25% less noise in the Narrow.' },
  { id: 'ironlungs', name: 'Iron Lungs', cost: 1, desc: '+25 Max Fatigue and double breath underwater.' },
  { id: 'backstabber', name: 'Shadow of the Culvert', cost: 1, desc: 'Stealth strikes from behind deal 4× damage instead of 3×.' },
  { id: 'smith', name: 'Bore-Smith\'s Hand', cost: 1, desc: 'Weapons wear down 50% slower and gain +2 damage.' },
];

const CLASS_DISADVANTAGES = [
  { id: 'glass_sens', name: 'Glass-Sensitive', bonus: 1, desc: 'Proctor hand-presses and bronze chords lock you 3s longer.' },
  { id: 'heavy_foot', name: 'Heavy Footfalls', bonus: 1, desc: 'Running adds +0.8 more noise.' },
  { id: 'frail_voice', name: 'Scarred Throat', bonus: 1, desc: '-8 Max Voice.' },
  { id: 'wanted', name: 'On the Registrar\'s List', bonus: 1, desc: 'Office Proctors spot you from further away (-20 Office standing).' },
];

const PERK_LIST = [
  { id: 'bellbreaker', name: 'Bell-Breaker', desc: '+25% damage against Legionnaires, Wardens, Golems and armoured foes.' },
  { id: 'silentstep', name: 'Keeper of the Narrow', desc: 'Your resting noise floor stays safely at 2.0; Unwriting takes twice as long.' },
  { id: 'parry', name: 'Riposte of Fortis', desc: 'Parry window is 40% wider and a successful parry restores 8 Fatigue and stuns for 2.5s.' },
  { id: 'resonant_lung', name: 'Cantor\'s Lung', desc: '+15 Max Voice and Voice regenerates twice as fast.' },
  { id: 'glass_drinker', name: 'Heartglass Temper', desc: 'Glass kills heal +8 HP and reduce your glassing tideline by 2%.' },
  { id: 'surgeon', name: 'Grafter\'s Anatomy', desc: 'Tonics and bandages heal +50% more and critical hits cause Bleeding.' },
];

const FACTIONS = {
  hedge: { name: 'The Hedge Folk of Oakhaven', desc: 'Orchard-folk, carders, tanners and night-hummers.' },
  synod: { name: 'The Choir-Church & Iron Synod', desc: 'Flambeaux, Consortium factors and garrison officers.' },
  office: { name: 'The Office of the Catalogue', desc: 'Registrar Quist\'s clerks, proctors and press-crews.' },
  captains: { name: 'The Free Captains', desc: 'Captain Vane, Mags, and the air-crews of the Rust Coast.' },
};

// Save codes and files are untrusted input: custom song definitions coming
// from an imported player must be strictly validated before they reach SONGS
// or any innerHTML sink (Song-book, spellmaker previews).
function sanitizeCustomSong(id, s) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_ -]{1,32}$/.test(id) || !s || typeof s !== 'object') return null;
  const num = (v, lo, hi, dflt) => (isFinite(+v) ? clamp(+v, lo, hi) : dflt);
  return {
    name: cleanName(s.name),
    hz: (typeof s.hz === 'string' && /^[0-9→\s]{1,12}$/.test(s.hz)) ? s.hz : num(s.hz, 0, 20000, 174),
    freq: num(s.freq, 20, 20000, 174),
    freq2: s.freq2 == null ? null : num(s.freq2, 20, 20000, 174),
    cost: num(s.cost, 0, 40, 3),
    power: num(s.power, 0, 20, 2),
    noise: num(s.noise, 0, 12, 1),
    effects: (Array.isArray(s.effects) ? s.effects : []).filter(e => SONG_NOTES.some(n => n.effect === e)).slice(0, 4),
    cadence: SONG_CADENCES.some(c => c.id === s.cadence) ? s.cadence : SONG_CADENCES[0].id,
    dyn: SONG_DYNAMICS.some(d => d.id === s.dyn) ? s.dyn : SONG_DYNAMICS[1].id,
    stun: num(s.stun, 0, 10, 0),
    bleed: num(s.bleed, 0, 10, 0),
    mendFat: num(s.mendFat, 0, 20, 0),
    custom: true,
    desc: cleanText(typeof s.desc === 'string' ? s.desc : '', 160),
  };
}

function ensurePlayerUpgrades(p) {
  if (!p) return;
  if (!p.skills) {
    p.skills = { Blade: 20, Blunt: 15, Firearms: 20, 'Law-Song': 20, Stealth: 15, Climbing: 15, Mercantile: 15, Glasswork: p.glassed ? 30 : 10, Lore: 20, Physician: 15 };
    if (p.cls && p.cls.id === 'blade') { p.skills.Blade += 15; p.skills.Glasswork += 15; }
    if (p.cls && p.cls.id === 'cantor') { p.skills['Law-Song'] += 20; p.skills.Physician += 10; }
    if (p.cls && p.cls.id === 'corsair') { p.skills.Blade += 10; p.skills.Firearms += 15; p.skills.Climbing += 10; }
    if (p.cls && p.cls.id === 'archivist') { p.skills.Lore += 20; p.skills['Law-Song'] += 10; }
    if (p.cls && p.cls.id === 'penitent') { p.skills.Blunt += 15; p.skills['Law-Song'] += 10; }
    if (p.cls && p.cls.id === 'quarry') { p.skills.Blunt += 15; p.skills.Climbing += 15; }
  }
  p.skills.Lockpicking = clamp(Number(p.skills.Lockpicking) || 15, 1, 100);
  if (!p.skillProg || typeof p.skillProg !== 'object') p.skillProg = {};
  if (!p.perks || typeof p.perks !== 'object') p.perks = {};
  if (p.perkPoints == null || !isFinite(+p.perkPoints)) p.perkPoints = 0; else p.perkPoints = clamp(p.perkPoints | 0, 0, 99);
  if (!Array.isArray(p.injuries)) p.injuries = [];
  else p.injuries = p.injuries.filter(x => typeof x === 'string').map(x => cleanName(x)).slice(0, 12);
  if (!Array.isArray(p.titles) || !p.titles.length) p.titles = ['Traveler on the Greenroot Road'];
  else p.titles = p.titles.filter(x => typeof x === 'string').map(x => cleanText(x, 48).replace(/["'\\]/g, '')).filter(Boolean).slice(0, 32);
  if (!p.titles.length) p.titles = ['Traveler on the Greenroot Road'];
  if (typeof p.activeTitle !== 'string' || !p.titles.includes(p.activeTitle)) p.activeTitle = p.titles[0];
  if (p.background != null) p.background = cleanText(p.background, 48);
  if (!p.factions || typeof p.factions !== 'object') p.factions = { hedge: 10, synod: 0, office: -5, captains: 5 };
  for (const fk of ['hedge', 'synod', 'office', 'captains']) p.factions[fk] = isFinite(+p.factions[fk]) ? clamp(Math.round(+p.factions[fk]), -100, 100) : 0;
  if (!p.weapCond || typeof p.weapCond !== 'object') p.weapCond = {};
  if (!p.weapEnch || typeof p.weapEnch !== 'object') p.weapEnch = {};
  if (!p.customSongs || typeof p.customSongs !== 'object') p.customSongs = {};
  if (p.tknives == null || !isFinite(+p.tknives)) p.tknives = 3; else p.tknives = clamp(p.tknives | 0, 0, 999);
  if (!Array.isArray(p.houseStorage)) p.houseStorage = [];
  if (!p.houseDecor) p.houseDecor = {};
  // imported saves are untrusted: validate songs and storage before use
  for (const id in p.customSongs) {
    const def = sanitizeCustomSong(id, p.customSongs[id]);
    if (!def) { delete p.customSongs[id]; continue; }
    p.customSongs[id] = def;
    SONGS[id] = def;
  }
  p.houseStorage = p.houseStorage.filter(s => s && ITEMS[s.id] && isFinite(+s.n) && +s.n > 0).map(s => ({ id: s.id, n: clamp(Math.round(+s.n), 1, 999) }));
  p.songs = (Array.isArray(p.songs) ? p.songs : []).filter(s => typeof s === 'string' && SONGS[s]);
}

function gainSkill(name, amt) {
  const p = G.player; if (!p) return;
  ensurePlayerUpgrades(p);
  p.skillProg[name] = (p.skillProg[name] || 0) + (amt || 1);
  const cur = p.skills[name] || 15;
  const need = Math.max(4, Math.floor(cur / 4));
  if (p.skillProg[name] >= need && cur < 100) {
    p.skillProg[name] -= need;
    p.skills[name] = cur + 1;
    msg(`Your ${name} skill has increased to ${p.skills[name]}.`, 'good', 2600);
  }
}

function changeRep(fac, delta) {
  const p = G.player; if (!p) return;
  ensurePlayerUpgrades(p);
  p.factions[fac] = clamp((p.factions[fac] || 0) + delta, -100, 100);
  if (p.factions.hedge >= 35 && !p.titles.includes('Friend of the Hedge')) {
    earnTitle('Friend of the Hedge');
  }
  if (p.factions.office <= -35 && !p.titles.includes('Bane of the Catalogue')) {
    earnTitle('Bane of the Catalogue');
  }
}

function earnTitle(title) {
  const p = G.player; if (!p) return;
  ensurePlayerUpgrades(p);
  if (!p.titles.includes(title)) {
    p.titles.push(title);
    p.activeTitle = title;
    msg(`You are now known as "${title}".`, 'good', 4500);
    unlockAchievement('title_' + title, title, `Earned the reputation title "${title}".`);
  }
}

function unlockAchievement(id, name, desc) {
  if (UPG.achievements[id]) return;
  UPG.achievements[id] = { name, desc, day: G.day };
  msg(`Achievement unlocked: ${name}`, 'good', 4000);
}

// Directional Melee & Enhanced Attack Logic
const DIR_MODS = {
  'thrust': { dmg: 1.0, hit: 0.12, ap: 0.5, label: 'thrust' },
  'slash left': { dmg: 1.12, hit: 0.04, cleave: true, label: 'slash left' },
  'slash right': { dmg: 1.12, hit: 0.04, cleave: true, label: 'slash right' },
  'chop down': { dmg: 1.32, hit: -0.08, stagger: 0.35, label: 'overhead chop' },
  'cut up': { dmg: 1.18, hit: 0.0, weak: 0.25, label: 'rising cut' },
};

function recordBestiary(type, killed) {
  if (!type || !ENEMIES[type]) return;
  if (!UPG.bestiary[type]) {
    UPG.bestiary[type] = { seen: true, kills: 0, name: ENEMIES[type].name };
  }
  if (killed) {
    UPG.bestiary[type].kills++;
    const totalTypes = Object.keys(UPG.bestiary).length;
    if (totalTypes >= 10) unlockAchievement('naturalist', 'Chronicler of the Narrow', 'Recorded 10 creature types in the Bestiary.');
  }
}

// ============================================================
//  4. ITEMS, ECONOMY, FORGES, ALCHEMY, ENCUMBRANCE & PLAYER HOUSE
// ============================================================
const ITEM_WEIGHTS = {
  pellets: 0.2, bolts: 0.3, tknives: 0.4, tonic: 0.5, honey: 0.5, bandage: 0.2,
  pebble: 0.3, empty_bottle: 0.4,
  whetstone: 0.6, shard: 0.4, whistle: 0.2, bottle: 0.6, flume_eel: 0.4,
  herb_willow: 0.1, herb_reed: 0.1, herb_moss: 0.1,
  a_cap: 1.5, a_hood: 1.0, a_kettle: 3.5, a_bellhelm: 5.0,
  a_synodrobe: 2.0, a_gambeson: 4.0, a_jerkin: 5.5, a_hushcoat: 3.0, a_brig: 9.0, a_chain: 12.0, a_plate: 16.0,
  a_gloves: 1.0, a_gauntlets: 2.5, a_softboots: 1.2, a_hobnails: 2.5, a_greaves: 4.0,
  a_buckler: 2.5, a_kite: 6.0,
  w_sword: 2.5, w_knife: 1.0, w_longsword: 3.8, w_axe: 3.5, w_mace: 4.0,
  w_spear: 4.2, w_maul: 8.5, w_crossbow: 4.5, w_pistol: 2.2, w_throwknife: 1.2,
  w_tobin_blade: 3.2, w_vesper_hook: 3.6, w_sable_dagger: 0.9,
};

function calcCarryWeight(p = G.player) {
  if (!p) return 0;
  let w = 0;
  for (const sl of (p.inv || [])) {
    const iw = ITEM_WEIGHTS[sl.id] || (ITEMS[sl.id] && ITEMS[sl.id].key ? 0 : 0.4);
    w += iw * (sl.n || 1);
  }
  for (const wk of (p.weapons || [])) {
    if (!WEAPONS[wk] || WEAPONS[wk].innate) continue;
    w += ITEM_WEIGHTS['w_' + wk] || 2.5;
  }
  return +w.toFixed(1);
}

function maxCarryWeight(p = G.player) {
  if (!p || !p.attrs) return 60;
  return Math.round(35 + p.attrs.Strength * 0.85 + (p.perks && p.perks.ironlungs ? 15 : 0));
}

function getWeaponCond(wKey) {
  const p = G.player; if (!p) return 100;
  ensurePlayerUpgrades(p);
  if (WEAPONS[wKey] && WEAPONS[wKey].innate) return 100;
  if (p.weapCond[wKey] == null) p.weapCond[wKey] = 100;
  return p.weapCond[wKey];
}

const ENCHANTMENTS = [
  { id: 'mending', name: '174 Hz · Root-Harmonic', hz: 174, desc: '+3 damage vs Cacophony; each strike restores 1 HP.' },
  { id: 'sun', name: '528 Hz · Sun-Glass Edge', hz: 528, desc: '+4 harmonic damage and illuminates dark corridors.' },
  { id: 'unname', name: '741 Hz · Scribe\'s Chill', hz: 741, desc: '+4 damage vs Legion/Office cores and 25% chance to stun.' },
];

const ALCHEMY_RECIPES = [
  { id: 'tonic', name: 'Bettany\'s Tonic (+12 HP)', req: [['herb_willow', 1], ['herb_reed', 1]], out: 'tonic', desc: 'Steeped willow-bark and sweet reed-pith.' },
  { id: 'honey', name: 'Oiled Honey (+15 Voice)', req: [['herb_reed', 2]], out: 'honey', desc: 'Pressed reed-pith boiled down for the throat.' },
  { id: 'bandage', name: 'Medicated Bandage (Stops Bleed)', req: [['herb_willow', 1], ['herb_moss', 1]], out: 'bandage', desc: 'Moon-moss poultice bound in clean bark-fibre.' },
  { id: 'whistle', name: 'Hush-Whistle (Wards the Hush)', req: [['herb_reed', 1], ['herb_moss', 1]], out: 'whistle', desc: 'A tuned reed that keeps siphoned air from unwriting you.' },
];

function renderCrafting(mode) {
  const p = G.player; ensurePlayerUpgrades(p);
  const wKey = p.weapons[p.weapon] || 'sword';
  const W = WEAPONS[wKey];
  const cond = getWeaponCond(wKey);
  const ench = p.weapEnch[wKey];
  const repairCost = Math.max(2, Math.round((100 - cond) * 0.25));
  const shards = G.count('shard');
  const html = `<h2>Forge, Enchanting & Brewing</h2><button class="dfbtn small close" id="x">Close</button>
  <div class="row">
    <div class="col">
      <h3>Smithing & Weapon Care</h3>
      <div class="slot" style="display:block;padding:.7cqh .9cqw">
        <b style="color:var(--gold)">${W.name}</b> ${ench ? `<span class="tag">${ench.name}</span>` : ''}<br>
        <span>Condition: <b>${Math.round(cond)}%</b> · Weight: ${ITEM_WEIGHTS['w_' + wKey] || 2} st</span><br>
        <div class="btns">
          <button class="dfbtn small" id="cr-rep" ${cond >= 100 || p.gold < repairCost ? 'disabled' : ''}>Forge Repair (${repairCost} sov)</button>
          <button class="dfbtn small" id="cr-whet" ${cond >= 100 || !G.has('whetstone') ? 'disabled' : ''}>Use Whetstone (${G.count('whetstone')})</button>
        </div>
      </div>
      <h3>Light-Glass Enchanting (${shards} Shard${shards === 1 ? '' : 's'})</h3>
      <div class="list">${ENCHANTMENTS.map((e, i) => `<button class="dfbtn small" data-ench="${i}" ${shards < 1 || W.innate ? 'disabled' : ''}><b>${e.name}</b><br><small class="muted">${e.desc}</small></button>`).join('')}</div>
    </div>
    <div class="col">
      <h3>Herb Brewing (Physician ${p.skills.Physician || 15})</h3>
      <p class="muted">Carried herbs: Willow-Bark ×${G.count('herb_willow')} · Reed-Pith ×${G.count('herb_reed')} · Moon-Moss ×${G.count('herb_moss')}</p>
      <div class="list">${ALCHEMY_RECIPES.map((r, i) => {
        const ok = r.req.every(([id, n]) => G.count(id) >= n);
        return `<button class="dfbtn small" data-brew="${i}" ${ok ? '' : 'disabled'}><b>${r.name}</b> (${r.req.map(([id, n]) => `${ITEMS[id].name.split(' ').pop()} ×${n}`).join(' + ')})<br><small class="muted">${r.desc}</small></button>`;
      }).join('')}</div>
      <div class="btns"><button class="dfbtn small" id="cr-inv">Back to Inventory</button></div>
    </div>
  </div>`;
  openModal(html, 'craft');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#cr-inv').onclick = () => renderInventory();
  const repBtn = $('#cr-rep');
  if (repBtn) repBtn.onclick = () => {
    if (p.gold < repairCost) return;
    p.gold -= repairCost; p.weapCond[wKey] = 100;
    Audio_.sfx.hit(); gainSkill('Glasswork', 1);
    msg(`You temper and hone the ${W.name} back to 100%.`, 'good', 2500);
    renderCrafting(mode);
  };
  const whetBtn = $('#cr-whet');
  if (whetBtn) whetBtn.onclick = () => {
    if (!G.has('whetstone')) return;
    G.take('whetstone'); p.weapCond[wKey] = Math.min(100, cond + 35);
    Audio_.sfx.swing();
    msg(`You draw the quarry whetstone along the ${W.name}.`, 'good', 2200);
    renderCrafting(mode);
  };
  document.querySelectorAll('[data-ench]').forEach(b => b.onclick = () => {
    if (shards < 1 || W.innate) return;
    const e = ENCHANTMENTS[+b.dataset.ench];
    G.take('shard');
    p.weapEnch[wKey] = e;
    Audio_.sfx.glasshit(); gainSkill('Glasswork', 3);
    unlockAchievement('enchanter', 'Light-Glass Artificer', 'Imbued a weapon with a Light-glass shard.');
    msg(`You set a Light-glass shard into the ${W.name}, tuning it to ${e.name}.`, 'good', 3500);
    renderCrafting(mode);
  });
  document.querySelectorAll('[data-brew]').forEach(b => b.onclick = () => {
    const r = ALCHEMY_RECIPES[+b.dataset.brew];
    if (!r.req.every(([id, n]) => G.count(id) >= n)) return;
    for (const [id, n] of r.req) for (let k = 0; k < n; k++) G.take(id);
    G.give(r.out, 1);
    if ((p.skills.Physician || 15) >= 35 && Math.random() < 0.35) {
      G.give(r.out, 1);
      msg(`Your Physician skill yields an extra ${ITEMS[r.out].name}!`, 'good', 3000);
    } else {
      msg(`You brew ${ITEMS[r.out].name}.`, 'good', 2500);
    }
    Audio_.sfx.pickup(); gainSkill('Physician', 2);
    renderCrafting(mode);
  });
}

// ============================================================
//  5. PROCEDURAL DUNGEONS (Generated Catacombs & Root-Vaults)
// ============================================================
function generateProceduralDungeon(depth) {
  depth = Math.max(1, depth || (G.procDepth || 0) + 1);
  G.procDepth = depth;
  const W = 34, H = 30;
  const seed = (Date.now() ^ (depth * 7919)) >>> 0;
  const rng = mulberry32(seed);
  const isRoot = depth % 2 === 1;
  const m = new GameMap('procdungeon', `${isRoot ? 'The Deep Root-Vaults' : 'The Sunken Ossuary'} · Depth ${depth}`, W, H, {
    floor: isRoot ? 't_moss' : 't_flag',
    floorTextures: [isRoot ? 't_moss' : 't_flag', 't_shallows', 't_water'],
    ceil: 't_stone',
    fogDist: 11, ambient: 0.12,
    fogColor: isRoot ? [14, 24, 18] : [18, 12, 28],
    siphoned: depth >= 2,
    music: isRoot ? 'root' : 'dungeon',
    danger: 1 + Math.min(2, depth >> 1),
    spawn: { x: 4.5, y: 4.5, dir: 0 },
  });
  const wallTex = isRoot ? 't_glassrock' : 't_catacomb';
  m.rect(0, 0, W - 1, H - 1, wallTex);

  // Carve 7 connected rooms
  const rooms = [];
  for (let i = 0; i < 7; i++) {
    const rw = 4 + ((rng() * 3) | 0), rh = 4 + ((rng() * 3) | 0);
    const rx = i === 0 ? 2 : 2 + ((rng() * (W - rw - 4)) | 0);
    const ry = i === 0 ? 2 : 2 + ((rng() * (H - rh - 4)) | 0);
    m.clear(rx, ry, rx + rw, ry + rh);
    const cx = (rx + (rw >> 1)) | 0, cy = (ry + (rh >> 1)) | 0;
    if (rooms.length > 0) {
      const prev = rooms[rooms.length - 1];
      let x = prev.cx, y = prev.cy;
      while (x !== cx) { m.set(x, y, null); x += x < cx ? 1 : -1; }
      while (y !== cy) { m.set(x, y, null); y += y < cy ? 1 : -1; }
    }
    rooms.push({ rx, ry, rw, rh, cx, cy });
  }
  const r0 = rooms[0], rLast = rooms[rooms.length - 1], rMid = rooms[Math.floor(rooms.length / 2)];
  m.spawn = { x: r0.cx + 0.5, y: r0.cy + 0.5, dir: 0 };

  // Exit door back to surface/hub
  const retMap = G.flags.part4 ? 'deepwoods' : G.flags.part3 ? 'whispergrove' : 'oakhaven';
  m.set(r0.rx, r0.cy, DOOR({ portal: { map: retMap, useSpawn: true }, label: `Stair up to ${G.maps[retMap] ? G.maps[retMap].name : 'the surface'}` }));

  // Lever in middle room to unlock the deeper vault door
  const leverFlag = `proc_lever_${depth}`;
  G.flags[leverFlag] = false;
  m.deco('lever', rMid.cx + 0.5, rMid.cy + 0.5, {
    radius: 0.35, scale: 0.9, use: 'proc_lever', leverFlag,
    label: 'A bronze counter-weight lever set into the stone',
  });

  // Deeper stair in last room
  m.deco('ladder', rLast.cx + 0.5, rLast.cy + 0.5, {
    radius: 0.35, scale: 1.4, use: 'proc_deeper',
    label: `Iron rung-way down to Depth ${depth + 1} (Requires lever)`,
  });

  // Secret Resonant Wall with hidden cache behind it
  if (rLast.rx + rLast.rw + 2 < W - 1) {
    const sx = rLast.rx + rLast.rw + 1, sy = rLast.cy;
    m.set(sx + 1, sy, null);
    m.set(sx, sy, { tex: 't_glassrock', resonant: true, label: 'A resonant seam in the stone (396 Hz or a heavy blow will crack it)' });
    m.add({ kind: 'item', item: 'cache', tier: 3, x: sx + 1.5, y: sy + 0.5, sprite: 'chest', scale: 0.5, solid: false, label: 'An ancient Cantor\'s strongbox' });
    m.item('shard', sx + 1.5, sy + 0.2);
  }

  // Populate rooms with lamps, enemies, herbs, and loot
  const foePool = depth === 1 ? ['hound', 'mites', 'proctor', 'legionnaire']
    : depth === 2 ? ['legionnaire', 'weaverling', 'drowned', 'golem', 'quiet']
    : ['warden', 'hushwarden', 'outrider', 'dirge', 'golem', 'quiet'];
  for (let i = 1; i < rooms.length; i++) {
    const rm = rooms[i];
    m.deco('lamp', rm.rx + 0.5, rm.ry + 0.5, { radius: 0.12, scale: 0.65, glow: 0.55 });
    const fType = foePool[(rng() * foePool.length) | 0];
    const e = m.enemy(fType, rm.cx + 0.5, rm.cy + 0.5);
    if (i === rooms.length - 1 || rng() < 0.28) {
      e.elite = true;
      e.eliteTitle = ['The Unslaked', 'Bell-Sworn', 'Of the Ninth Choir', 'Ash-Tongue', 'First-Pressed'][(rng() * 5) | 0];
    }
    if (rng() < 0.65) {
      const it = ['tonic', 'pellets', 'bolts', 'shard', 'herb_moss', 'herb_willow', 'sovereigns'][(rng() * 7) | 0];
      m.item(it, rm.rx + rm.rw - 0.5, rm.ry + rm.rh - 0.5);
    }
  }
  m.baseCount = m.entities.length;
  G.maps.procdungeon = m;
  loadMap('procdungeon', m.spawn);
  unlockAchievement('delver', 'Delver of the Root-Vaults', 'Entered a procedural Root-Vault or Sunken Ossuary.');
}

function checkResonantWall(freq) {
  const w = Engine.pickWall(2.4);
  if (w && w.cell && (w.cell.resonant || w.cell.tex === 't_glassrock')) {
    if (w.cell.resonant || freq === 396) {
      G.map.set(w.x, w.y, null);
      Audio_.sfx.crack();
      msg('The resonant stone splits along its harmonic seam, revealing a hidden chamber!', 'good', 4500);
      unlockAchievement('secret_wall', 'Stone-Tuner', 'Opened a secret resonant wall.');
      return true;
    }
  }
  return false;
}

// ============================================================
//  6. WORLD EXPANSION: Player House, Baker/Chandler, Lore Bookshelves,
//     Bounty Boards, Tobin's 417 Shrine & Trial of the Narrow Arena
// ============================================================
const LORE_BOOKS = [
  {
    id: 'bk_octave', title: 'On the Eight Anchors of the Long Octave',
    body: '<i>From the Conservatory of Bores, 389 SR:</i><br><br>Eight Anchors pin the continent to the world, each with its own law and its own note: Growth in the Reach (174 Hz), Heat in the Caldera (285 Hz), Mass in the Iron Peaks (396 Hz), Time in the Shifting Dunes (417 Hz), Light at the Dawning Heights (528 Hz), Velocity in the Tempest Archipelago (639 Hz), Memory in the Spectral Woods (741 Hz), and Decay at the Gate (852 Hz), which keeps the rest between the notes.<br><br>An Anchor is only stone and bronze where it breaks the ground. What lives under it is a Chorister, and the Conservatory does not advise drilling into a thing that sings.',
  },
  {
    id: 'bk_417', title: 'Parish Register: The Year 417 & Cantor Tobin',
    body: '<i>In the hand of Cantor Tobin Ashgrove, spring 417 SR:</i><br><br>The Pellow child is going too still in her cot, and the Hush has her by the ankles. A murmur is not enough. If she slips further I will sing the calling-song at full voice—the turn and the falling fifth—and the hounds will hear it from the quarry to the Flume.<br><br>So I will go out by the kitchen door and keep singing across the yard, that they look at me and not at the cradle. If this is the last line in my hand, the child was worth it. Tell Lyra she was right: a martyr is just a musician who gave up before the coda. I am not giving up. I am finishing the piece.',
  },
  {
    id: 'bk_glass', title: 'Treatise on Aether-Glass & the Four Stages',
    body: '<i>Surgeon-Grafter\'s Manual, Fortis printing:</i><br><br>Raw Aether-Glass is set song. When it enters living tissue it does not poison; it tunes. Stage One is <b>Ringing</b> (tinnitus at 174 or 528 Hz). Stage Two is <b>Frost</b> (translucent veining; Cacophony hounds refuse to bite). Stage Three is <b>Set</b> (the limb is glass to the bone; strikes ring like bronze). Stage Four is <b>Heartglass</b>: the subject stands very still, forever, humming the Chorister\'s lullaby, alive and aware.',
  },
  {
    id: 'bk_veil', title: 'The Folding of the Silent Veil (c. 300 SR)',
    body: '<i>Private memorandum, Office of the Catalogue, copied fair:</i><br><br>The Order of the Silent Veil is folded into the Synod as the Office of the Catalogue. Its House in the Woods stays open under the Office\'s seal, and its scribes keep their desks. The Registrar-General has taken a close interest in the order\'s methods of recording a name, and is satisfied that they have uses beyond the keeping of the dead.<br><br>The scribes who objected have been reassigned to field ledgers in the Woods. They are not to be told what the ledgers are for. Their objections are filed.',
  },
  {
    id: 'bk_narrow', title: 'Rhymes of the Hedge-Nursery',
    body: '<i>Voice at the hedge, voice at the door,<br>answer it once and you\'ll answer no more.<br>Too loud brings the hounds, too still brings the Hush,<br>so murmur, my lamb, in the Narrow. Hush.</i><br><br>Oakhaven skipping rhyme, as the children of the Hedge-nursery skip it, two ends of a rope and nobody counting aloud.',
  },
];

function readLoreBook(idx) {
  const b = LORE_BOOKS[idx % LORE_BOOKS.length];
  UPG.codexRead[b.id] = true;
  gainSkill('Lore', 2);
  if (Object.keys(UPG.codexRead).length >= LORE_BOOKS.length) {
    unlockAchievement('scholar', 'Archivist of the Reach', 'Read every lore volume in Book One.');
  }
  showEvent(b.title, b.body, [{ t: 'Close the volume.', f: () => { questXp(15); } }]);
}

function buildCoopersHouse() {
  const m = interior('cooper_house', 'Your House on Cooper\'s Row', 12, 9, 't_house', { x: 6, y: 8, sx: 6.5, sy: 6.5, sdir: -Math.PI / 2, ox: 16.5, oy: 29.5, odir: 0 }, (m) => {
    m.deco('hearth', 1.3, 4.5, { radius: 0.3, scale: 0.9, glow: 0.85, use: 'house_forge', label: 'Your hearth & tempering brazier (Craft, Repair & Brew)' });
    m.deco('bed', 9.5, 2.0, { radius: 0.5, scale: 0.65, use: 'house_bed', label: 'Your bed, under a whistling hush-lamp (Safe full rest)' });
    m.deco('lamp', 8.2, 2.0, { radius: 0.12, scale: 0.75, glow: 0.8 });
    m.deco('shelf', 4.0, 1.3, { radius: 0.25, scale: 0.9, use: 'lore_shelf', bookIdx: 0, label: 'Your bookshelf of Reach & Synod volumes' });
    m.deco('table', 6.0, 4.2, { radius: 0.5, scale: 0.7, use: 'house_forge', label: 'An alchemy & tuning workbench' });
    m.add({ kind: 'deco', sprite: 'chest', x: 2.2, y: 2.0, solid: true, radius: 0.35, scale: 0.65, use: 'house_chest', label: 'Your personal strongbox (Store & retrieve gear)' });
    m.deco('cloaks', 10.4, 5.5, { radius: 0.3, scale: 0.85, use: 'house_trophy', label: 'Wall pegs & trophy rack' });
  });
  return m;
}

function buildArenaMap() {
  const W = 18, H = 18;
  const m = new GameMap('arena', 'The Trial of the Narrow (Under-Pit)', W, H, {
    floor: 't_flag', floorTextures: ['t_flag', 't_shallows', 't_water'], ceil: 't_stone',
    fogDist: 14, ambient: 0.22, fogColor: [24, 14, 12], music: 'combat', danger: 0,
    spawn: { x: 9.0, y: 15.0, dir: -Math.PI / 2 },
  });
  m.border('t_stone');
  [[4, 4], [13, 4], [4, 13], [13, 13]].forEach(([x, y]) => m.set(x, y, WALL('t_marble')));
  [[2.5, 2.5], [15.5, 2.5], [2.5, 15.5], [15.5, 15.5]].forEach(([x, y]) => m.deco('lamp', x, y, { radius: 0.15, scale: 0.75, glow: 0.75 }));
  const retMap = G.flags.part4 ? 'deepwoods' : G.flags.part3 ? 'whispergrove' : 'oakhaven';
  m.set(9, 17, DOOR({ portal: { map: retMap, useSpawn: true }, label: 'Back to the surface' }));
  m.deco('bigbell', 9.0, 2.2, { radius: 0.5, scale: 1.1, use: 'arena_bell', label: 'The Challenger\'s Bell — strike to summon the next Trial wave' });
  m.baseCount = m.entities.length;
  return m;
}

function startArenaWave() {
  if (G.ents.some(e => e.kind === 'enemy' && !e.dead && !e.hidden)) {
    msg('Finish the current wave in the pit first!', 'warn', 2500);
    return;
  }
  const wave = (G.flags.arena_wave || 0) + 1;
  G.flags.arena_wave = wave;
  Audio_.sfx.bell();
  const waves = [
    [['hound', 5.5, 6.5], ['hound', 12.5, 6.5]],
    [['legionnaire', 6.0, 6.0], ['proctor', 12.0, 6.0], ['mites', 9.0, 5.0]],
    [['golem', 9.0, 5.5], ['weaverling', 5.5, 8.0], ['weaverling', 12.5, 8.0]],
    [['warden', 6.5, 5.5], ['hushwarden', 11.5, 5.5], ['outrider', 9.0, 4.5]],
    [['wearer', 9.0, 5.0]],
  ];
  const spec = waves[Math.min(waves.length - 1, wave - 1)];
  for (const [t, x, y] of spec) {
    const e = hydrate({ kind: 'enemy', type: t, x, y });
    e.state = 'chase'; e.alertT = 20;
    if (wave >= 3) { e.elite = true; e.hp = Math.round(e.hp * 1.25); e.hpMax = e.hp; }
    e.onDeath = () => {
      setTimeout(() => {
        if (G.mapId === 'arena' && !G.ents.some(o => o.kind === 'enemy' && !o.dead && !o.hidden)) {
          const prize = 25 * wave;
          G.gold(prize); questXp(45 * wave);
          msg(`Trial Wave ${wave} cleared! You claim ${prize} sovereigns.`, 'good', 5000);
          if (wave === 3 && !G.player.weapons.includes('vesper_hook')) {
            G.player.weapons.push('vesper_hook');
            msg('Champion\'s Prize: You claim Vesper\'s Boarding Axe!', 'good', 6000);
          }
          if (wave >= 5) {
            earnTitle('Champion of the Narrow');
            G.give('shard', 2);
          }
        }
      }, 200);
    };
    G.ents.push(e);
  }
  msg(`The Challenger's Bell tolls: Trial Wave ${wave} begins!`, 'bad', 3500);
}

function renderHouseChest() {
  const p = G.player; ensurePlayerUpgrades(p);
  const storeRows = p.houseStorage.map((sl, i) => `<tr><td><b>${ITEMS[sl.id].name}</b>${sl.n > 1 ? ` ×${sl.n}` : ''}</td><td class="n"><button class="dfbtn small" data-take="${i}">Take</button></td></tr>`).join('');
  const carryRows = p.inv.filter(sl => ITEMS[sl.id] && !ITEMS[sl.id].key && !isWorn(sl.id)).map((sl, i) => `<tr><td><b>${ITEMS[sl.id].name}</b>${sl.n > 1 ? ` ×${sl.n}` : ''}</td><td class="n"><button class="dfbtn small" data-put="${sl.id}">Store</button></td></tr>`).join('');
  const html = `<h2>Cooper's Row Strongbox</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted">Carry Weight: <b>${calcCarryWeight(p)} / ${maxCarryWeight(p)} st</b>. Items stored here weigh nothing on the road.</p>
  <div class="row">
    <div class="col"><h3>In Strongbox</h3><table>${storeRows || '<tr><td class="muted">Empty.</td></tr>'}</table></div>
    <div class="col"><h3>In Pack</h3><table>${carryRows || '<tr><td class="muted">Nothing storable.</td></tr>'}</table></div>
  </div>`;
  openModal(html, 'house_chest');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('[data-put]').forEach(b => b.onclick = () => {
    const id = b.dataset.put;
    G.take(id);
    const ex = p.houseStorage.find(s => s.id === id);
    if (ex) ex.n++; else p.houseStorage.push({ id, n: 1 });
    Audio_.sfx.ui(); renderHouseChest();
  });
  document.querySelectorAll('[data-take]').forEach(b => b.onclick = () => {
    const i = +b.dataset.take, sl = p.houseStorage[i];
    if (!sl) return;
    G.give(sl.id, 1); sl.n--;
    if (sl.n <= 0) p.houseStorage.splice(i, 1);
    Audio_.sfx.pickup(); renderHouseChest();
  });
}

// The house is in Oakhaven, and Oakhaven is behind you once the Greening comes or Part Three begins: the house's
// only door opens onto it, and its mast would replay the Part Two ending (R1).
function houseLeft() { const f = G.flags; return !!(f.greening || f.escaped || f.part3 || f.part4); }
function renderBountyBoard() {
  const f = G.flags, p = G.player; ensurePlayerUpgrades(p);
  const b1 = f.bounty_1_done ? 'Completed' : `${(p.kills || 0)} / 4 slain`;
  const b2 = f.bounty_2_done ? 'Completed' : `${G.ledger.length} / 3 names`;
  const html = `<h2>Parish & Guild Noticeboard</h2><button class="dfbtn small close" id="x">Close</button>
  <p class="muted">Posted writs, guild bounties, and entrances to the deep vaults.</p>
  <div class="list">
    <button class="dfbtn" id="bb-b1" ${f.bounty_1_done ? 'disabled' : ''}><b>Writ of Clearing: Cull the Pack</b> — Clear 4 beasts off the roads (${b1}) · Reward: 35 sov & +10 Hedge Standing</button>
    <button class="dfbtn" id="bb-b2" ${f.bounty_2_done ? 'disabled' : ''}><b>Scribe's Commission: Three Surrendered Names</b> — Record 3 names in your Ledger (${b2}) · Reward: 45 sov & Light-Glass Shard</button>
    <button class="dfbtn" id="bb-tobin" ${f.tobin_417_done ? 'disabled' : ''}><b>417 Investigation: Cantor Tobin's Last Stand</b> — ${f.tobin_417_started ? 'Inspect the memorial cairn under the western oaks, outside the Hedge' : 'Take up the search for Tobin Ashgrove\'s tuning-blade (417 SR)'}</button>
    ${houseLeft() ? `<button class="dfbtn" id="bb-house" disabled><b>Your House on Cooper\'s Row</b> — Left behind in Oakhaven</button>` : `<button class="dfbtn" id="bb-house" ${f.house_bought ? '' : (p.gold < 60 ? 'disabled' : '')}><b>${f.house_bought ? 'Enter Your House on Cooper\'s Row' : 'Deed of Sale: Cooper\'s Row House (60 sovereigns)'}</b> — Safe bed, storage chest, and tempering hearth</button>`}
    <button class="dfbtn" id="bb-proc"><b>Descend into the Procedural Root-Vaults (Depth ${(G.procDepth || 0) + 1})</b> — Generated catacombs with keys, levers, resonant walls & rare loot</button>
    <button class="dfbtn" id="bb-arena"><b>Enter the Trial of the Narrow (Arena Pit)</b> — Test your mettle against waves of enemies for unique weapons & titles</button>
  </div>`;
  openModal(html, 'bounty');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#bb-b1').onclick = () => {
    if ((p.kills || 0) >= 4 && !f.bounty_1_done) {
      f.bounty_1_done = true; G.gold(35); changeRep('hedge', 10); questXp(50); Audio_.sfx.pickup();
      msg('You claim 35 sovereigns for clearing the roads.', 'good', 3500);
      renderBountyBoard();
    } else msg('Clear at least 4 beasts off the roads first, then come back for the writ.', 'warn', 2500);
  };
  $('#bb-b2').onclick = () => {
    if (G.ledger.length >= 3 && !f.bounty_2_done) {
      f.bounty_2_done = true; G.gold(45); G.give('shard', 1); changeRep('hedge', 10); questXp(60); Audio_.sfx.pickup();
      earnTitle('Keeper of Names');
      msg('You claim 45 sovereigns and a Light-Glass Shard.', 'good', 3500);
      renderBountyBoard();
    } else msg('Record 3 surrendered names in your Ledger (K) first.', 'warn', 2500);
  };
  $('#bb-tobin').onclick = () => {
    if (!f.tobin_417_started) {
      f.tobin_417_started = true;
      journal('side', 'The Year 417: I took up the inquiry into Cantor Tobin Ashgrove\'s disappearance in 417. At the Pellow farm, out past where the Hedge runs now, he sang a fevered child back at full voice and walked out into the yard so the hounds would follow him and not the house. His tuning-blade may still lie near the western oaks outside the Hedge.');
      msg('Logbook updated: Search the western trees outside the Hedge for Tobin\'s cairn.', 'good', 4000);
      renderBountyBoard();
    } else {
      closeModal(); G.state = 'play';
      msg('Look near the western trees outside the Hedge (the Clearing) for Tobin\'s 417 cairn.', '', 3500);
    }
  };
  $('#bb-house').onclick = () => {
    if (houseLeft()) return;
    if (!f.house_bought) {
      if (p.gold < 60) return;
      p.gold -= 60; f.house_bought = true;
      if (!G.maps.cooper_house) G.maps.cooper_house = buildCoopersHouse();
      // Unlock Cooper's Row door in Oakhaven
      if (G.maps.oakhaven) {
        syncHouseDoor();
      }
      Audio_.sfx.pickup();
      unlockAchievement('homeowner', 'Householder of Cooper\'s Row', 'Purchased and furnished your own house in Oakhaven.');
      journal('side', 'I bought the deed to 4 Cooper\'s Row in Oakhaven. The door is unbarred now; inside are a safe bed, a personal storage strongbox, and a tempering hearth.');
      msg('You have bought the house on Cooper\'s Row! Stepping inside now.', 'good', 4000);
    }
    if (!G.maps.cooper_house) G.maps.cooper_house = buildCoopersHouse();
    closeModal(); G.state = 'play';
    loadMap('cooper_house', G.maps.cooper_house.spawn);
  };
  $('#bb-proc').onclick = () => { closeModal(); G.state = 'play'; generateProceduralDungeon((G.procDepth || 0) + 1); };
  $('#bb-arena').onclick = () => {
    if (!G.maps.arena) G.maps.arena = buildArenaMap();
    closeModal(); G.state = 'play';
    loadMap('arena', G.maps.arena.spawn);
  };
}

// ============================================================
//  7. COMPANION EXPANSION: Sable Recruitment, Approval, Banter,
//     Camp Scenes & Resonant Combo Attacks
// ============================================================
if (typeof COMPANIONS !== 'undefined') {
  COMPANIONS.sable = {
    name: 'Sable, Archivist', sprite: 'sable', portrait: 'sable', camp: 'sable_dw', hp: 46, noise: 1.3,
    ability: { name: 'Read the Ledger', cd: 30 },
    join: '"Entry: I am walking with you. Keep the lantern steady; if we meet a bell, I will read it its own name."',
    leave: 'Sable closes the Bound Ledger, tucks it under her coat, and returns to the fire.',
  };
}
if (typeof PARTY_BARKS !== 'undefined') {
  PARTY_BARKS.sable = {
    'map:mausoleum': 'Every Cantor of the Memory Anchor is filed in this stone. Do not let the Wardens strike the ledger.',
    'map:belfry': 'A death-bell. Three strokes is the Reach form. Even the Office did not change that.',
    quiet: 'A Quiet. It digests names first. Keep steel in your hand.',
    dirge: 'An unfiled burial office. It is repeating because nobody signed the close.',
    warden: 'Marble and bronze. Strike the joints.',
    horn: 'An Office listening-horn. Model four. Silence it before the cylinder turns.',
    weaverling: 'They are carrying stolen syllables in the silk.',
    broodmother: 'She has eaten half a parish register.',
    tongueless: 'The Quiet Faith. They think an empty page is mercy.',
    outrider: 'Arbiterium outriders. Crossbow discipline.',
    hushwarden: 'Felted bell. I wrote the requisition for those in 415. Kill him.',
    hound: 'Cacophony. Do not speak your own name near it.',
    hurt: 'You are losing blood on my pages. Drink a tonic.',
    rest: 'I will recite my remaining fragments while you sleep, so I know if one is missing in the morning.',
    selfhurt: 'My coat took the worst of it. Do not let them touch the book.',
  };
  PARTY_CHAT.sable = [
    'Every ledger page holds forty names. When I was fourteen, a crooked line meant ruling the whole sheet again.',
    'Kaelen keeps looking at my ink-bottle as if it were a gauge. We are both people who counted for the Synod.',
    'Lyra asked me whether a name read aloud still belongs to the person. I told her it belongs to whoever answers.',
    'If we ever reach the Organum, the Hall of Carriage keeps a clerk on the third floor. I know his handwriting.',
  ];
  PARTY_BOSS.sable = [
    'Sable writes a single line in the margin of the Ledger and shuts the clasp. "Filed."',
    '"Entry closed."',
    'She blows the dust off the onion-skin page. "That one will not repeat itself again."',
  ];
}

const BANTER_LINES = [
  ['Kaelen: "Your father\'s tuning-fork was flat by two cents, Lyra. Always was."', 'Lyra: "And every door in Oakhaven still opened to it, Kaelen. Unlike yours."'],
  ['Sable: "Engineer Vance. Your signature is on forty-two requisitions in my third volume."', 'Kaelen: "Burn the page, Archivist." — Sable: "I do not burn pages. That is the whole difference between us."'],
  ['Lyra: "Keep your boots on the moss, both of you. You sound like a cart."', 'Kaelen: "Some of us weigh more than a slate and a hymn-book."'],
];

function partyApproval(delta, reason) {
  const P = G.party; if (!P || !P.id) return;
  P.approval = clamp((P.approval == null ? 50 : P.approval) + delta, 0, 100);
  const nm = COMPANIONS[P.id].name.split(' ')[0];
  if (delta > 0) msg(`${nm} approves (+${delta}${reason ? ': ' + reason : ''}).`, 'good', 2500);
  else if (delta < 0) msg(`${nm} disapproves (${delta}${reason ? ': ' + reason : ''}).`, 'warn', 2500);
}

// ============================================================
//  8. BESTIARY, LORE CODEX, ACHIEVEMENTS & SETTINGS / ACCESSIBILITY UI
// ============================================================
function renderCodexModal(tab) {
  tab = tab || 'bestiary';
  const p = G.player; ensurePlayerUpgrades(p);
  let body = '';
  if (tab === 'bestiary') {
    const allKeys = Object.keys(ENEMIES);
    const seenKeys = allKeys.filter(k => UPG.bestiary[k]);
    body = `<p class="muted">Encountered ${seenKeys.length} of ${allKeys.length} creature types. All 26 enemy types feature hand-drawn animated frames (walk, wind-up, and strike).</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6cqw;max-height:56cqh;overflow-y:auto">
      ${allKeys.map(k => {
        const d = ENEMIES[k], rec = UPG.bestiary[k];
        if (!rec) return `<div class="slot" style="opacity:.45"><b>??? (${k})</b><small class="muted">Not yet encountered in the field.</small></div>`;
        const wk = d.cacophony ? 'Weak to Glass, Bronze & Falling Fifth' : d.quiet || d.hushkin ? 'Weak to Iron & Bolts (immune to Glass Shot)' : d.armored ? 'Weak to Blunt, Maul & 396 Hz Shatter' : d.core ? 'Weak to Cleave, 741 Hz & Read the Name' : 'Standard steel & shot';
        return `<div class="slot" style="display:flex;gap:.8cqw;align-items:center">
          <canvas class="bestiary-spr" data-spr="${d.sprite}" width="40" height="40" style="width:4.5cqw;height:4.5cqw;background:#0e0a07;border:1px solid #5a4530;image-rendering:pixelated"></canvas>
          <div><b style="color:var(--gold)">${d.name}</b> <small class="muted">HP ${d.hp} · Slain: ${rec.kills}</small><br><small>${d.desc}</small><br><small style="color:#a9e07a">${wk}</small></div>
        </div>`;
      }).join('')}
    </div>`;
  } else if (tab === 'codex') {
    body = `<p class="muted">Series Bible Lore & Volumes (${Object.keys(UPG.codexRead).length}/${LORE_BOOKS.length} books read, ${TOPIC_KEYS.length} topics).</p>
    <div style="max-height:56cqh;overflow-y:auto">
      <h3>Collected Volumes</h3>
      ${LORE_BOOKS.map((b, i) => `<div class="slot" style="display:block;margin-bottom:.5cqh"><b style="color:var(--gold)">${b.title}</b> ${UPG.codexRead[b.id] ? '<span class="tag">Read</span>' : ''}<br><small>${b.body}</small></div>`).join('')}
      <h3>Encyclopedia of the Silenced Province</h3>
      ${TOPIC_KEYS.slice(0, 14).map(t => `<div class="slot" style="display:block;margin-bottom:.4cqh"><b style="color:var(--gold)">${t}</b><br><small>${TOPICS[t].high}</small></div>`).join('')}
    </div>`;
  } else if (tab === 'factions') {
    body = `<div class="row"><div class="col">
      <h3>Faction Standing</h3>
      ${Object.entries(FACTIONS).map(([k, f]) => {
        const val = p.factions[k] || 0;
        const rank = val >= 40 ? 'Revered Ally' : val >= 15 ? 'Trusted Friend' : val <= -40 ? 'Hunted Enemy' : val <= -15 ? 'Suspect' : 'Neutral';
        return `<div class="slot" style="display:block;margin-bottom:.5cqh"><b style="color:var(--gold)">${f.name}</b> — <b>${rank}</b><br><small class="muted">${f.desc}</small></div>`;
      }).join('')}
      <h3>Reputation Titles (Click to wear)</h3>
      <div class="btns">${p.titles.map(t => `<button class="dfbtn small ${p.activeTitle === t ? 'sel' : ''}" data-title="${t}">${t}</button>`).join('')}</div>
    </div>
    <div class="col">
      <h3>Skills (Improve with use)</h3>
      <div class="attrs">${SKILL_LIST.map(s => `<div><span>${s}</span><b>${p.skills[s] || 15}</b></div>`).join('')}</div>
      <h3>Perks (${p.perkPoints || 0} available)</h3>
      <div class="list">${PERK_LIST.map(pk => `<button class="dfbtn small ${p.perks[pk.id] ? 'sel' : ''}" data-perk="${pk.id}" ${p.perks[pk.id] || (p.perkPoints || 0) <= 0 ? 'disabled' : ''}><b>${pk.name}</b> ${p.perks[pk.id] ? '✓' : ''}<br><small class="muted">${pk.desc}</small></button>`).join('')}</div>
    </div></div>`;
  } else if (tab === 'ach') {
    const achs = Object.values(UPG.achievements);
    body = `<p class="muted">Unlocked ${achs.length} Achievement${achs.length === 1 ? '' : 's'} in this session.</p>
    <div style="max-height:56cqh;overflow-y:auto">
      ${achs.length ? achs.map(a => `<div class="slot" style="display:block"><b style="color:var(--gold)">★ ${a.name}</b> <small class="muted">(Day ${a.day})</small><br><small>${a.desc}</small></div>`).join('') : '<p class="muted">Explore Oakhaven, compose a Song, enchant a weapon, or delve into a vault to unlock achievements.</p>'}
    </div>`;
  }
  const html = `<h2>Codex, Bestiary & Standing (J)</h2><button class="dfbtn small close" id="x">Close</button>
  <div class="btns" style="margin-bottom:1cqh">
    <button class="dfbtn small ${tab === 'bestiary' ? 'sel' : ''}" data-tab="bestiary">Bestiary (26)</button>
    <button class="dfbtn small ${tab === 'factions' ? 'sel' : ''}" data-tab="factions">Skills, Perks & Factions</button>
    <button class="dfbtn small ${tab === 'codex' ? 'sel' : ''}" data-tab="codex">Lore Codex</button>
    <button class="dfbtn small ${tab === 'ach' ? 'sel' : ''}" data-tab="ach">Achievements (${Object.keys(UPG.achievements).length})</button>
  </div>${body}`;
  openModal(html, 'codex');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => renderCodexModal(b.dataset.tab));
  document.querySelectorAll('[data-title]').forEach(b => b.onclick = () => { p.activeTitle = b.dataset.title; renderCodexModal('factions'); });
  document.querySelectorAll('[data-perk]').forEach(b => b.onclick = () => {
    const id = b.dataset.perk;
    if ((p.perkPoints || 0) <= 0 || p.perks[id]) return;
    p.perkPoints--; p.perks[id] = true;
    if (id === 'resonant_lung') { p.voiceMax += 15; p.voice += 15; }
    Audio_.sfx.pickup();
    msg(`Perk learned: ${PERK_LIST.find(x => x.id === id).name}!`, 'good', 3500);
    renderCodexModal('factions');
  });
  // Draw bestiary sprite previews
  document.querySelectorAll('canvas.bestiary-spr').forEach(cv => {
    const spName = cv.dataset.spr;
    const sp = Engine.sprites[spName];
    if (sp && sp.img) {
      const cx = cv.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(sp.img, 0, 0, 40, 40);
    }
  });
}

function applyVisualSettings() {
  const gEl = $('#game'), vEl = $('#view');
  if (gEl) {
    gEl.classList.toggle('crt-on', !!UPG.crt);
    gEl.classList.toggle('cb-on', !!UPG.colorblind);
  }
  if (vEl && UPG.pixelScale) {
    const w = UPG.pixelScale === 2 ? 640 : 320;
    const h = UPG.pixelScale === 2 ? 400 : 200;
    // the canvas size belongs to the engine now (Engine.setScale renders the view at 1x or 2x)
    vEl.style.filter = UPG.crt ? 'contrast(1.08) brightness(1.04)' : '';
  }
}

function speakLine(text, who) {
  if (!UPG.tts || typeof window.speechSynthesis === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
    const clean = String(text || '').replace(/<[^>]+>/g, '').slice(0, 220);
    const u = new SpeechSynthesisUtterance(clean);
    u.volume = 0.65;
    if (/kaelen/i.test(who)) { u.pitch = 0.78; u.rate = 0.92; }
    else if (/lyra|sable/i.test(who)) { u.pitch = 1.18; u.rate = 0.96; }
    else if (/wearer|requiem|deacon|aegis/i.test(who)) { u.pitch = 0.55; u.rate = 0.85; }
    else { u.pitch = 0.92; u.rate = 0.95; }
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech optional */ }
}

function renderAccessibilityMenu() {
  const o = G.opts;
  const html = `<h2>Difficulty, Visuals & Accessibility</h2><button class="dfbtn small close" id="x">Close</button>
  <div class="ctl-grid" style="max-height:66cqh;overflow-y:auto;padding-right:.6cqw">
    <span>Difficulty <small class="muted">Narrative (forgiving Narrow & damage) · Standard · Narrow-Master (deadly)</small></span>
    <button class="dfbtn small" id="ac-diff">${UPG.difficulty.toUpperCase()}</button>
    <span>CRT Scanlines & Curvature</span>
    <button class="dfbtn small" id="ac-crt">${UPG.crt ? 'On' : 'Off'}</button>
    <span>Bayer Dithering Shader</span>
    <button class="dfbtn small" id="ac-dith">${UPG.dither ? 'On' : 'Off'}</button>
    <span>Colourblind-Safe Markers & Bars</span>
    <button class="dfbtn small" id="ac-cb">${UPG.colorblind ? 'On' : 'Off'}</button>
    <span>Subtitles & Audio Captions</span>
    <button class="dfbtn small" id="ac-sub">${(typeof ACCESS !== 'undefined' ? ACCESS.settings.cap : UPG.subtitles) ? 'On' : 'Off'}</button>
    <span>Voiced Key Lines (TTS Synthesis)</span>
    <button class="dfbtn small" id="ac-tts">${UPG.tts ? 'On' : 'Off'}</button>
    <span>Corner Minimap Overlay</span>
    <button class="dfbtn small" id="ac-mm">${UPG.minimap ? 'On' : 'Off'}</button>
    <span>Map Objective Markers</span>
    <button class="dfbtn small" id="ac-qm">${UPG.questMarkers ? 'On' : 'Off'}</button>
    <span>Tutorial Tips <small class="muted">Contextual hints on first encounters</small></span>
    <button class="dfbtn small" id="ac-tut">${UPG.tutorial === false ? 'Off' : 'On'}</button>
    <span>Free Look & Mouse Sensitivity (${o.sens})</span>
    <span class="ctl-step"><button class="dfbtn small" id="c-sdn">−</button><b>${o.sens}</b><button class="dfbtn small" id="c-sup">+</button></span>
    <span>Key Rebinding <small class="muted">Block/Parry: <b>${UPG.keybinds.block.toUpperCase()}</b> · Lantern: <b>${UPG.keybinds.lantern.toUpperCase()}</b> · Codex: <b>${UPG.keybinds.codex.toUpperCase()}</b></small></span>
    <button class="dfbtn small" id="ac-keys">Rebind Keys…</button>
  </div>
  <div class="btns"><button class="dfbtn small" id="ac-back">Back to Options</button></div>`;
  openModal(html, 'controls');
  $('#x').onclick = () => { closeModal(); G.state = 'play'; };
  $('#ac-back').onclick = () => renderMenu();
  $('#ac-tut').onclick = () => { UPG.tutorial = UPG.tutorial === false; renderAccessibilityMenu(); };
  $('#ac-diff').onclick = () => {
    UPG.difficulty = UPG.difficulty === 'standard' ? 'narrow' : UPG.difficulty === 'narrow' ? 'narrative' : 'standard';
    renderAccessibilityMenu();
  };
  $('#ac-crt').onclick = () => { UPG.crt = !UPG.crt; applyVisualSettings(); renderAccessibilityMenu(); };
  $('#ac-dith').onclick = () => { UPG.dither = !UPG.dither; renderAccessibilityMenu(); };
  $('#ac-cb').onclick = () => { UPG.colorblind = !UPG.colorblind; applyVisualSettings(); renderAccessibilityMenu(); };
  $('#ac-sub').onclick = () => { if (typeof ACCESS !== 'undefined') { ACCESS.setCaptions(!ACCESS.settings.cap); UPG.subtitles = ACCESS.settings.cap; } else UPG.subtitles = !UPG.subtitles; renderAccessibilityMenu(); };   // the sound captions live in js/access.js
  $('#ac-tts').onclick = () => { UPG.tts = !UPG.tts; if (UPG.tts) speakLine('The Octave is tuned.', 'lyra'); renderAccessibilityMenu(); };
  $('#ac-mm').onclick = () => { UPG.minimap = !UPG.minimap; renderAccessibilityMenu(); };
  $('#ac-qm').onclick = () => { UPG.questMarkers = !UPG.questMarkers; renderAccessibilityMenu(); };
  $('#c-sdn').onclick = () => { o.sens = Math.max(1, o.sens - 1); renderAccessibilityMenu(); };
  $('#c-sup').onclick = () => { o.sens = Math.min(10, o.sens + 1); renderAccessibilityMenu(); };
  $('#ac-keys').onclick = () => renderKeyRebindMenu();
}

function renderKeyRebindMenu() {
  const kb = UPG.keybinds;
  const rows = Object.entries(kb).map(([act, key]) => `
    <span>${act.toUpperCase()}</span>
    <button class="dfbtn small" data-rebind="${act}">${UPG.rebinding === act ? 'Press any key…' : key.toUpperCase()}</button>
  `).join('');
  openModal(`<h2>Key Rebinding</h2><button class="dfbtn small close" id="x">Close</button>
    <p class="muted">Click an action, then press the new key on your keyboard.</p>
    <div class="ctl-grid">${rows}</div>
    <div class="btns"><button class="dfbtn small" id="kb-reset">Reset Defaults</button><button class="dfbtn small" id="kb-back">Back</button></div>`, 'rebind');
  $('#x').onclick = () => { UPG.rebinding = null; closeModal(); G.state = 'play'; };
  $('#kb-back').onclick = () => { UPG.rebinding = null; renderAccessibilityMenu(); };
  $('#kb-reset').onclick = () => {
    UPG.keybinds = { forward: 'w', back: 's', left: 'a', right: 'd', interact: 'e', block: 'f', songs: 'tab', map: 'm', travel: 't', codex: 'j', lantern: 'u' };
    UPG.rebinding = null; renderKeyRebindMenu();
  };
  document.querySelectorAll('[data-rebind]').forEach(b => b.onclick = () => {
    UPG.rebinding = b.dataset.rebind;
    renderKeyRebindMenu();
  });
}

// ============================================================
//  9. HOOKS & ENGINE WRAPPERS (Load order: last script in index.html)
// ============================================================
(() => {
  // 1) Extend Character Creation with Custom Class Builder & Backgrounds
  CREATE.bg = 0; CREATE.adv = {}; CREATE.dis = {};
  const _renderCreate = renderCreate;
  renderCreate = function () {
    const s = CREATE.step;
    if (s === 1) {
      _renderCreate();
      const p = $('#create-panel');
      const btns = p.querySelector('.btns');
      if (btns && !$('#c-custom-btn')) {
        const b = document.createElement('button');
        b.className = 'dfbtn small'; b.id = 'c-custom-btn';
        b.textContent = 'Custom Calling & Background…';
        b.onclick = () => renderCustomClassStep();
        btns.insertBefore(b, btns.firstChild);
      }
      return;
    }
    return _renderCreate();
  };

  function renderCustomClassStep() {
    if (CREATE.cls == null) CREATE.cls = 0;
    const p = $('#create-panel');
    const bg = BACKGROUNDS[CREATE.bg || 0];
    p.innerHTML = `<h2>Origin & Custom Calling</h2>
      <p class="muted">Select your upbringing in the Silenced Province and optional traits.</p>
      <div class="row">
        <div class="col">
          <h3>Background Origin</h3>
          <div class="list">${BACKGROUNDS.map((b, i) => `<button class="dfbtn small ${(CREATE.bg || 0) === i ? 'sel' : ''}" data-bg="${i}"><b>${b.name}</b><br><small class="muted">${b.desc}</small></button>`).join('')}</div>
        </div>
        <div class="col">
          <h3>Advantages (Pick up to 2)</h3>
          <div class="list">${CLASS_ADVANTAGES.map(a => `<button class="dfbtn small ${CREATE.adv[a.id] ? 'sel' : ''}" data-adv="${a.id}"><b>${a.name}</b> — <small class="muted">${a.desc}</small></button>`).join('')}</div>
          <h3>Disadvantages (Optional)</h3>
          <div class="list">${CLASS_DISADVANTAGES.map(d => `<button class="dfbtn small ${CREATE.dis[d.id] ? 'sel' : ''}" data-dis="${d.id}"><b>${d.name}</b> — <small class="muted">${d.desc}</small></button>`).join('')}</div>
        </div>
      </div>
      <div class="btns"><button class="dfbtn" id="cc-done">Confirm & Choose Face</button><button class="dfbtn" id="cc-back">Back</button></div>`;
    p.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => { CREATE.bg = +b.dataset.bg; renderCustomClassStep(); });
    p.querySelectorAll('[data-adv]').forEach(b => b.onclick = () => {
      const id = b.dataset.adv;
      if (CREATE.adv[id]) delete CREATE.adv[id];
      else if (Object.keys(CREATE.adv).length < 2) CREATE.adv[id] = true;
      renderCustomClassStep();
    });
    p.querySelectorAll('[data-dis]').forEach(b => b.onclick = () => {
      const id = b.dataset.dis;
      if (CREATE.dis[id]) delete CREATE.dis[id]; else CREATE.dis[id] = true;
      renderCustomClassStep();
    });
    $('#cc-done').onclick = () => { CREATE.step = 2; renderCreate(); };
    $('#cc-back').onclick = () => { CREATE.step = 1; renderCreate(); };
  }

  const _newPlayer = newPlayer;
  newPlayer = function () {
    const p = _newPlayer();
    ensurePlayerUpgrades(p);
    p.inv.push({ id: 'pebble', n: 3 }, { id: 'empty_bottle', n: 2 });
    const bg = BACKGROUNDS[CREATE.bg || 0];
    if (bg) {
      p.background = bg.name;
      for (const k in (bg.mod || {})) p.attrs[k] = (p.attrs[k] || 40) + bg.mod[k];
      for (const k in (bg.skills || {})) p.skills[k] = (p.skills[k] || 15) + bg.skills[k];
      for (const k in (bg.rep || {})) p.factions[k] = (p.factions[k] || 0) + bg.rep[k];
      if (bg.tknives) { p.tknives = (p.tknives || 0) + bg.tknives; if (!p.weapons.includes('throwknife')) p.weapons.push('throwknife'); }
    }
    p.advantages = Object.assign({}, CREATE.adv);
    p.disadvantages = Object.assign({}, CREATE.dis);
    if (p.advantages.ironlungs) { p.fatMax += 25; p.fat = p.fatMax; }
    if (p.disadvantages.frail_voice) { p.voiceMax = Math.max(6, p.voiceMax - 8); p.voice = p.voiceMax; }
    if (p.disadvantages.wanted) p.factions.office -= 20;
    if (!p.weapons.includes('throwknife')) p.weapons.push('throwknife');
    return p;
  };

  // 2) Extend Map Building with Noticeboards, Forges, Lore Bookshelves, Herbs & 417 Cairn
  const _buildAllMaps = buildAllMaps;
  buildAllMaps = function () {
    const maps = _buildAllMaps();
    // Oakhaven additions: Parish Noticeboard, Forge Anvil, Herbs, Fishing spot, Baker's & Chandler's bookshelves
    if (maps.oakhaven) {
      const oh = maps.oakhaven;
      oh.deco('sign', 25.2, 17.5, { radius: 0.25, scale: 0.9, use: 'bounty_board', label: 'The Oakhaven Parish & Guild Noticeboard' });
      oh.deco('pump', 14.2, 54.5, { radius: 0.35, scale: 0.85, use: 'house_forge', label: 'Abner\'s Tempering Brazier & Anvil (Repair, Enchant & Brew)' });
      oh.deco('crates', 52.5, 48.2, { radius: 0.3, scale: 0.65, use: 'fish_spot', label: 'A reed-basket fishing line in the Chlorophyll Flume' });
      oh.item('herb_willow', 49.5, 33.5); oh.item('herb_reed', 56.5, 48.2); oh.item('whetstone', 50.5, 16.5);
    }
    if (maps.clearing) {
      const cl = maps.clearing;
      cl.deco('grave', 7.5, 22.5, { radius: 0.35, scale: 0.85, use: 'tobin_cairn', label: 'A moss-grown cairn by the old stile: T. ASHGROVE, 417. They buried his lyre here.' });
      cl.item('herb_willow', 14.5, 12.5); cl.item('herb_moss', 31.5, 20.5);
    }
    if (maps.whispergrove) {
      const wg = maps.whispergrove;
      wg.deco('sign', 26.2, 43.2, { radius: 0.25, scale: 0.85, use: 'bounty_board', label: 'Sunken Court Way-Board & Vault Entrance' });
      wg.item('herb_moss', 17.5, 17.5); wg.item('shard', 11.5, 21.5);
    }
    if (maps.deepwoods) {
      const dw = maps.deepwoods;
      dw.deco('sign', 26.2, 39.5, { radius: 0.25, scale: 0.85, use: 'bounty_board', label: 'Expedition Notice-Stake & Deep Vault Entrance' });
      dw.item('herb_willow', 22.5, 39.5); dw.item('herb_moss', 17.5, 29.5); dw.item('shard', 9.5, 6.5);
    }
    // Add readable lore bookshelves to existing interiors
    const bookRooms = ['tavern', 'lyra_house', 'greenhall', 'surgery', 'mill', 'chapel', 'malting', 'cloister'];
    bookRooms.forEach((id, idx) => {
      const m = maps[id]; if (!m) return;
      for (const e of m.entities) {
        if (e.sprite === 'shelf' && !e.use) {
          e.use = 'lore_shelf'; e.bookIdx = idx % LORE_BOOKS.length;
          e.label = `Bookshelf: "${LORE_BOOKS[e.bookIdx].title}"`;
        }
      }
    });
    maps.cooper_house = buildCoopersHouse();
    maps.arena = buildArenaMap();
    for (const k in maps) maps[k].baseCount = maps[k].entities.length;
    return maps;
  };

  // 3) Extend useDeco & useItem
  const _useDeco = useDeco;
  useDeco = function (e) {
    if (!e) return;
    if (e.use === 'bounty_board') { renderBountyBoard(); return; }
    if (e.use === 'house_forge') { G.state = 'panel'; renderCrafting(); return; }
    if (e.use === 'house_chest') { G.state = 'panel'; renderHouseChest(); return; }
    if (e.use === 'house_bed') {
      const p = G.player; ensurePlayerUpgrades(p);
      passHours(8); p.hp = p.hpMax; p.voice = p.voiceMax; p.fat = p.fatMax;
      UPG.status.bleed = 0; UPG.status.deaf = 0; UPG.status.hushed = 0; UPG.status.fear = 0;
      p.injuries = [];
      Audio_.sfx.song(174, 1.0);
      msg('You sleep eight hours in your own bed on Cooper\'s Row under a steady hush-lamp. Your wounds and injuries mend.', 'good', 5000);
      return;
    }
    if (e.use === 'house_trophy') {
      const p = G.player; ensurePlayerUpgrades(p);
      msg(`Wall rack: ${p.kills} foes vanquished, ${G.ledger.length} names preserved, ${Object.keys(UPG.achievements).length} achievements earned.`, 'good', 4000);
      return;
    }
    if (e.use === 'lore_shelf') { readLoreBook(e.bookIdx || 0); return; }
    if (e.use === 'fish_spot') {
      if (e._fished && G.time - e._fished < 45) { msg('The Flume water is disturbed. Give the eels a moment to return.', '', 2500); return; }
      e._fished = G.time;
      G.give('flume_eel', 1); Audio_.sfx.pickup();
      msg('You haul up the reed-line and take a Smoked Flume-Eel.', 'good', 3000);
      return;
    }
    if (e.use === 'tobin_cairn') {
      if (G.flags.tobin_417_done) { msg('Cantor Tobin Ashgrove\'s cairn (417 SR). You carry his Tuning-Blade.', '', 3000); return; }
      G.flags.tobin_417_done = true;
      if (!G.player.weapons.includes('tobin_blade')) G.player.weapons.push('tobin_blade');
      questXp(90); Audio_.sfx.fifth();
      earnTitle('Heir of 417');
      journal('side', 'The Year 417: The moss cairn by the old stile is where Oakhaven buried Cantor Tobin Ashgrove\'s lyre, the only thing of him they found. Under a flat stone at its foot I found his Tuning-Blade, still humming at 174 Hz where he laid it down on his way up to the Pellow farm.');
      showEvent('The Cairn of 417', 'The cairn stands by the old stile, where they found his lyre in the morning. It was all there was to bury. At its foot, under a flat stone the cairn\'s builders never lifted, lies an oilskin bundle. Inside is a long blade of bell-bronze ground to ring at 174 Hz, and a slate with one line scratched on it:<br><br><i>If Lyra finds this: I am going up to the Pellows\'. Their girl is cooling. If I have to sing, I will go out into the yard, so the house is further away. Keep your voice in your chest, lark.</i><br><br><b>(You ready Tobin\'s Tuning-Blade!)</b>', [{ t: 'Take up the blade.', f: null }]);
      return;
    }
    if (e.use === 'proc_lever') {
      G.flags[e.leverFlag] = true;
      Audio_.sfx.door();
      msg('You haul the bronze counter-weight lever down. Deep in the vault, an iron grate grinds open!', 'good', 4000);
      return;
    }
    if (e.use === 'proc_deeper') {
      const lFlag = `proc_lever_${G.procDepth || 1}`;
      if (!G.flags[lFlag]) { msg('The iron rung-way is barred by a counter-weight grate. Find the bronze lever on this floor first.', 'warn', 3500); return; }
      generateProceduralDungeon((G.procDepth || 1) + 1);
      return;
    }
    if (e.use === 'arena_bell') { startArenaWave(); return; }
    return _useDeco(e);
  };

  const _useItem = useItem;
  useItem = function (slot) {
    if (!slot) return;
    const it = ITEMS[slot.id], p = G.player;
    ensurePlayerUpgrades(p);
    const mult = p.perks && p.perks.surgeon ? 1.5 : 1;
    if (it && it.use === 'bandage') {
      UPG.status.bleed = 0;
      p.hp = Math.min(p.hpMax, p.hp + Math.round(it.n * mult));
      G.take(slot.id);
      msg('You bind the wound with clean linen. The bleeding stops.', 'good', 2500);
      renderInventory();
      return;
    }
    if (it && it.use === 'food') {
      p.hp = Math.min(p.hpMax, p.hp + it.n);
      p.fat = Math.min(p.fatMax, p.fat + 25);
      G.take(slot.id);
      msg('You eat the smoked Flume-eel. Warmth returns to your limbs.', 'good', 2500);
      renderInventory();
      return;
    }
    if (it && it.use === 'whetstone') {
      const wKey = p.weapons[p.weapon] || 'sword';
      p.weapCond[wKey] = Math.min(100, getWeaponCond(wKey) + 35);
      G.take(slot.id);
      Audio_.sfx.swing();
      msg(`You hone your ${WEAPONS[wKey].name} (+35% condition).`, 'good', 2500);
      renderInventory();
      return;
    }
    if (it && (it.use === 'enchant' || it.herb)) {
      renderCrafting();
      return;
    }
    return _useItem(slot);
  };
})();

// ============================================================
//  10. WORLD SIMULATION & QoL — weather, swimming & climbing,
//      ambient life & landmarks, footsteps & reverb wiring,
//      enemy sound families, boss autosave, gamepad, tutorial
// ============================================================

// -- Cooper's Row house door: re-applied after any map rebuild ------
function syncHouseDoor(m) {
  const oh = m || (G.maps && G.maps.oakhaven);
  if (!oh || !G.flags) return;
  const bought = !!G.flags.house_bought;
  if (bought) {
    if (G.maps && !G.maps.cooper_house) G.maps.cooper_house = buildCoopersHouse();
    oh.set(15, 29, DOOR({ portal: { map: 'cooper_house', x: 6.5, y: 6.5, dir: -Math.PI / 2 }, label: 'Your House on Cooper\'s Row' }));
  } else {
    const d = DOOR({ label: 'Cooper\'s Row' });
    d.locked = '__never'; d.lockMsg = 'Cooper\'s Row. The door is barred from within, and somebody inside is humming.';
    oh.set(15, 29, d);
  }
}

// -- distant landmarks: horizon silhouettes seen from outdoor maps --
// a = bearing, aw = angular width, h = share of the view it may take, p = peakiness,
// ridge = lumpiness along the crest, seed = where that lumpiness starts, cap/capH = a
// paler top for snow. Time and weather mix every ridge toward the fog colour, so the
// same country greys out in mist, flushes at dusk and goes black under a storm.
const LANDMARKS = {
  _default: [{ a: -Math.PI / 2, aw: Math.PI, h: 0.10, p: 0.8, c: [30, 30, 40] }],
  oakhaven: [
    { a: -Math.PI / 2, aw: 2.6, h: 0.30, p: 1.5, ridge: 0.45, seed: 1.3, far: 0.85, cap: [152, 158, 178], capH: 0.26, c: [40, 42, 58] }, // the Grey Teeth, north beyond the Hedge
    { a: 2.1, aw: 0.9, h: 0.26, p: 1.35, ridge: 0.35, seed: 5.7, far: 0.15, c: [46, 44, 52] },                                             // chalk cliff shoulder over the water-meadow
    { a: -2.2, aw: 1.1, h: 0.17, p: 1.1, ridge: 0.6, seed: 3.1, far: 0.5, c: [38, 40, 50] },                                               // downs to the east
    { a: 0.3, aw: 0.6, h: 0.24, p: 1.7, ridge: 0.8, seed: 2.3, far: 0.3, c: [34, 28, 44] },                                                                     // the quarry head
    { a: 2.6, aw: 0.7, h: 0.16, p: 1.1, far: 0.45, c: [26, 30, 36] },
  ],
  clearing: [
    { a: -1.1, aw: 1.0, h: 0.24, p: 1.25, ridge: 0.5, seed: 2.2, far: 0.7, cap: [142, 150, 170], capH: 0.22, c: [34, 36, 50] },
    { a: 0, aw: 1.6, h: 0.17, p: 1.0, ridge: 0.4, seed: 8.4, far: 0.3, c: [26, 32, 30] },
    { a: 0.35, aw: 0.14, h: 0.30, p: 2.6, far: 0.35, c: [32, 28, 42] },
    { a: 2.4, aw: 1.2, h: 0.20, p: 1.2, ridge: 0.45, seed: 4.4, far: 0.55, c: [30, 34, 40] },
  ],
  whispergrove: [
    { a: -Math.PI / 2, aw: Math.PI, h: 0.08, p: 0.8, far: 0.6, c: [40, 34, 56] },
    { a: -1.55, aw: 0.2, h: 0.36, p: 2.4, far: 0.25, c: [46, 38, 62] },
    { a: -0.9, aw: 0.6, h: 0.24, p: 1.4, ridge: 0.4, seed: 6.1, far: 0.45, c: [42, 36, 58] },
    { a: 0.9, aw: 1.0, h: 0.18, p: 1.2, ridge: 0.5, seed: 1.9, far: 0.5, c: [38, 34, 54] },
  ],
  deepwoods: [
    { a: -1.2, aw: 1.1, h: 0.26, p: 1.3, ridge: 0.5, seed: 7.3, far: 0.75, cap: [130, 140, 162], capH: 0.24, c: [34, 36, 50] },
    { a: 0, aw: 1.8, h: 0.10, p: 0.9, ridge: 0.5, seed: 3.7, far: 0.3, c: [30, 32, 40] },
    { a: 1.6, aw: 0.6, h: 0.16, p: 1.3, far: 0.5, c: [32, 32, 42] },
  ],
};
// The Chapel's spire-line over Oakhaven and the Mausoleum's tower over the
// Deep Woods used to be painted silhouettes at a fixed bearing. They are real
// blocks now (see shapeOakhaven / addReliefWorld), seen from wherever you stand.

// -- ground surface under the player (footstep synthesis) -----------
function stepSurface() {
  const m = G.map; if (!m) return 'stone';
  const ix = Engine.cam.x | 0, iy = Engine.cam.y | 0;
  if (!m.floorCells || ix < 0 || iy < 0 || ix >= m.w || iy >= m.h) return 'stone';
  const tex = (m.floorTextures ? m.floorTextures[m.floorCells[iy * m.w + ix]] : null) || m.floor || '';
  if (tex === 't_water' || tex === 't_shallows') return 'water';
  if (tex === 't_wood') return 'wood';
  if (tex.startsWith('t_grass') || tex.startsWith('t_moss') || tex === 't_hedge') return 'grass';   // painted20's variants keep the family name
  return 'stone';
}

function waterLvl(x, y) {
  const m = G.map; if (!m || !m.floorCells) return 0;
  const ix = x | 0, iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= m.w || iy >= m.h) return 0;
  const tex = (m.floorTextures ? m.floorTextures[m.floorCells[iy * m.w + ix]] : null) || m.floor || '';
  return tex === 't_water' ? 2 : tex === 't_shallows' ? 1 : 0;
}

function climbRank() {
  const p = G.player; if (!p) return 0;
  return ((p.skills && p.skills.Climbing) || 0) / 10 + ((p.cls && /Climbing/.test(p.cls.skills)) ? 1 : 0);
}

function doClimb(e) {
  const p = G.player; if (!p) return;
  const cost = Math.max(2, 9 - climbRank() * 1.5);
  if (p.fat < cost) { msg('You are too tired to make that climb. Rest first.', 'warn', 3500); return; }
  p.fat -= cost;
  Engine.cam.x = e.to.x; Engine.cam.y = e.to.y; if (e.to.dir != null) Engine.cam.dir = e.to.dir;
  G.noise = Math.min(20, G.noise + 1.2);
  Audio_.sfx.step('stone');
  msg(e.msg || 'You climb.', '', 3000);
}

function lesson(id, text) {
  if (UPG.tutorial === false || !G.player) return;
  if (!UPG.lessons) UPG.lessons = {};
  if (UPG.lessons[id]) return;
  UPG.lessons[id] = true;
  msg(text, 'voice', 9500);
}

(() => {
  // -- world ticks ---------------------------------------------------
  const WFX = { clear: { sight: 1, hear: 1 }, rain: { sight: 0.85, hear: 0.6 }, fog: { sight: 0.55, hear: 0.85 }, snow: { sight: 0.8, hear: 1.35 } };
  // Dynamic weather lives in js/weather.js now. This adapter keeps the old call
  // site, the old four-state names and UPG.weather/weatherFx in step, so anything
  // that still sets UPG.weather by hand (captures, tests) still gets its sky.
  const LEGACY_WEATHER = { fog: 'mist', rain: 'rain', snow: 'snow', clear: 'clear' };
  function tickWeather(dt) {
    if (typeof Weather !== 'undefined' && Weather.tick) {
      if (UPG.weather && LEGACY_WEATHER[UPG.weather] && UPG.weather !== Weather.state) UPG.weather = LEGACY_WEATHER[UPG.weather];
      Weather.tick(dt);
      if (UPG.weather !== Weather.state) { UPG.weather = Weather.state; UPG.weatherT = Weather.left * 3600; }
      UPG.weatherFx = { sight: Weather.STATES[Weather.state].sight, hear: Weather.STATES[Weather.state].hear };
      return;
    }
    if (!G.map) return;
    if (UPG.weather == null) UPG.weather = 'clear';
    if (!(UPG.weatherT > 0)) UPG.weatherT = 45;
    UPG.weatherFx = WFX[UPG.weather] || WFX.clear;
    if (!G.map.outdoor) return;
    UPG.weatherT -= dt;
    if (UPG.weatherT <= 0) {
      const r = Math.random();
      const next = r < 0.46 ? 'clear' : r < 0.72 ? 'rain' : r < 0.89 ? 'fog' : 'snow';
      UPG.weatherT = 55 + Math.random() * 80;
      if (next !== UPG.weather) {
        UPG.weather = next;
        msg(next === 'rain' ? 'Rain comes in over the Reach, soft on the oaks. Sound will not carry.' : next === 'fog' ? 'A sea-fog walks up the river and sits down in the streets. They will not see you coming.' : next === 'snow' ? 'The first snow comes sideways off the water. It will crunch, and they will hear it.' : 'The weather clears. Sound carries again.', 'warn', 5000);
      }
    }
    UPG.weatherFx = WFX[UPG.weather] || WFX.clear;
    if (UPG.weather === 'rain') { UPG._rainT = (UPG._rainT || 0) - dt; if (UPG._rainT <= 0) { UPG._rainT = 2.2 + Math.random() * 1.5; Audio_.sfx.rain(); } }
  }

  function tickSwim(dt) {
    const p = G.player; if (!p || !Engine.cam || G.state !== 'play' || G.dead) return;
    if (!(UPG.swimDepth >= 0)) UPG.swimDepth = 0;
    const c = Engine.cam;
    const lvl = waterLvl(c.x, c.y);
    UPG.swimDepth = lvl === 2 ? Math.min(1, UPG.swimDepth + dt * 3) : Math.max(0, UPG.swimDepth - dt * 2);
    if (lvl === 2) {
      const drain = Math.max(0.7, 1.7 - climbRank() * 0.25) * (UPG.weather === 'rain' ? 1.15 : 1);
      p.fat = Math.max(0, p.fat - drain * dt);
      UPG._splashT = (UPG._splashT || 0) - dt;
      if (UPG._splashT <= 0 && (G.vel.x || G.vel.y)) { UPG._splashT = 0.55; Audio_.sfx.step('water'); addNoise(0.4); }
      if (p.fat <= 0) {
        p.hp -= 2.2 * dt;
        if (!UPG._drownT || performance.now() - UPG._drownT > 6000) { UPG._drownT = performance.now(); msg('Your arms give out. The water closes over your head.', 'bad', 4200); }
        if (p.hp <= 0 && !G.dead) die('The deep water');
      }
    }
  }

  function tickAmbient(dt) {
    if (!G.map) return;
    for (const e of G.ents) if (e.nightWatch) {
      const night = G.tod < 0.22 || G.tod > 0.78;
      e.hidden = !night; e.glow = night ? 0.5 : 0;
    }
    const out = G.map.outdoor;
    if (!out && G.map.music !== 'dungeon' && G.map.music !== 'root' && G.map.music !== 'mausoleum') return;
    UPG._ambT = (UPG._ambT || 4) - dt;
    if (UPG._ambT > 0) return;
    UPG._ambT = 5 + Math.random() * 8;
    if (out && G.tod > 0.28 && G.tod < 0.75 && UPG.weather !== 'rain') Audio_.sfx.bird();
    else if (Math.random() < 0.65) Audio_.sfx.rat();
  }

  const BOSS_TYPES = ['aegis', 'weaver', 'pressman', 'broodmother', 'bosun', 'horn', 'requiem', 'wearer_coda', 'wearer'];
  function tickBossSave() {
    if (!G.map || G.state !== 'play' || G.dead) return;
    if (hardcoreOn()) return; // a hardcore run gets no save to rewind to
    for (const e of G.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden || e.state !== 'chase') continue;
      const d = e.def; if (!d || !(d.boss || d.wildsBoss || BOSS_TYPES.indexOf(e.type) >= 0)) continue;
      const key = G.mapId + ':' + (e.type || d.name);
      if (UPG._bossSaved === key) break;
      UPG._bossSaved = key;
      try { UPG.autosaveSlot = snapshotGame(); UPG.autosaveWhen = G.map.name + ' (day ' + (G.day | 0) + ')'; } catch (err) { /* saving must never break the fight */ }
      msg('You steel yourself. Autosaved before the fight - the slot is in Load game.', 'warn', 5000);
      break;
    }
  }

  function tickTutorial(dt) {
    const p = G.player; if (!p || G.state !== 'play') return;
    if (G.vel && (G.vel.x || G.vel.y)) UPG._walked = (UPG._walked || 0) + dt * 3;
    if (UPG._walked > 3) lesson('move', 'W A S D to move, the mouse to look, Shift to run. E to talk to people and touch the world.');
    if (G.noise > 5) lesson('noise', 'The Narrow carries sound. What you do, they hear - walk softly, or be ready.');
    for (const e of G.ents) {
      if (e.kind === 'enemy' && !e.dead && !e.hidden && e.state === 'chase' && dist2(e.x, e.y, Engine.cam.x, Engine.cam.y) < 100) {
        lesson('fight', 'Mouse to strike, ' + (UPG.keybinds && UPG.keybinds.block ? UPG.keybinds.block.toUpperCase() : 'F') + ' to block and parry. Iron rings loud; glass is quiet.');
        break;
      }
    }
    if (UPG.swimDepth > 0.4) lesson('swim', 'Deep water. Swimming burns fatigue - when it runs out you drown. Climbing skill helps.');
    if (G.song && G.song.t > 0) lesson('song', 'Songs cost voice, and the Narrow hears every one of them.');
    if (p.level >= 2) lesson('perk', 'Level two. Open Character (C) to spend perk points.');
  }

  // -- weather overlay on the 3D view (drawn under the HUD) ----------
  function drawWeatherOverlay() {
    if (typeof Weather !== 'undefined' && Weather.drawOverlay) { Weather.drawOverlay(); return; }
    if (!G.map || !G.map.outdoor) return;
    const wtr = UPG.weather; if (!wtr || wtr === 'clear') return;
    const ctx = Engine.ctx; if (!ctx) return;
    const w = Engine.VW || 320, h = Engine.VIEW_H || 150, now = performance.now() / 1000;
    if (wtr === 'fog') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(196,200,214,0.14)'); g.addColorStop(0.55, 'rgba(196,200,214,0.28)'); g.addColorStop(1, 'rgba(196,200,214,0.08)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    } else if (wtr === 'rain') {
      ctx.strokeStyle = 'rgba(170,182,205,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
      const nRain = Math.round(60 * (typeof GFX !== 'undefined' ? GFX.particles : 1));
      for (let i = 0; i < nRain; i++) {
        const x = ((i * 53.7 + now * 240) % (w + 40)) - 20;
        const y = ((i * 97.3 + now * 500) % (h + 40)) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,130,160,0.08)'; ctx.fillRect(0, 0, w, h);
    } else if (wtr === 'snow') {
      ctx.fillStyle = 'rgba(225,230,240,0.7)';
      const nSnow = Math.round(55 * (typeof GFX !== 'undefined' ? GFX.particles : 1));
      for (let i = 0; i < nSnow; i++) {
        const x = ((i * 61.9 + Math.sin(now * 0.8 + i) * 12 + now * 14) % (w + 16)) - 8;
        const y = ((i * 88.1 + now * (26 + (i % 5) * 7)) % (h + 16)) - 8;
        ctx.fillRect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
    }
  }

  // -- gamepad -------------------------------------------------------
  const GBTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, lstick: 10, rstick: 11, dup: 12, ddown: 13, dleft: 14, dright: 15 };
  function gamepadTick() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    let gp = null;
    if (pads) for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    const prev = gamepadTick.prev || (gamepadTick.prev = []);
    if (!gp) {
      if (gamepadTick.had) { G.touch.fx = 0; G.touch.fy = 0; G.touch.run = false; gamepadTick.had = false; }
      for (let i = 0; i < 32; i++) prev[i] = false;
      return;
    }
    gamepadTick.had = true;
    const dz = (v) => Math.abs(v) < 0.18 ? 0 : v;
    const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0);
    G.touch.fx = ax; G.touch.fy = ay;
    G.touch.run = Math.abs(ax) + Math.abs(ay) > 1.25;
    const now = performance.now();
    if (gamepadTick.t == null) gamepadTick.t = now;
    const gdt = Math.min(0.1, (now - gamepadTick.t) / 1000); gamepadTick.t = now;
    const rx = dz(gp.axes[2] || 0);
    if (rx && G.state === 'play') { Engine.cam.dir += rx * 2.6 * gdt; Engine.turnV = 0; }
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = (i) => btn(i) && !prev[i];
    const play = G.state === 'play' && !G.dead;
    if (['arrest', 'prison', 'wanted', 'theft', 'stable'].includes(G.openPanel)) {
      const actions = { arrest: ['crime-pay', 'crime-flee', 'crime-jail', 'crime-bribe', 'crime-threat'], prison: ['prison-serve', 'law-leave', 'prison-pay'], wanted: ['law-leave', 'law-leave', 'law-leave'], theft: ['crime-take', 'crime-leave', 'crime-leave'], stable: ['stable-rent', 'stable-leave', 'stable-return'] }[G.openPanel];
      if (edge(GBTN.a)) $('#' + actions[0])?.click();
      else if (edge(GBTN.b) || edge(GBTN.start)) $('#' + actions[1])?.click();
      else if (edge(GBTN.x)) $('#' + actions[2])?.click();
      else if (actions[3] && edge(GBTN.y)) $('#' + actions[3])?.click();
      else if (actions[4] && edge(GBTN.back)) $('#' + actions[4])?.click();
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'disguise') {
      if (edge(GBTN.a)) $('#cover-wear').click();
      else if (edge(GBTN.b) || edge(GBTN.back) || edge(GBTN.start)) $('#cover-leave').click();
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'body') {
      if (edge(GBTN.a)) $('#body-drag').click();
      else if (edge(GBTN.x)) $('#body-hide').click();
      else if (edge(GBTN.b) || edge(GBTN.start)) $('#body-leave').click();
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'distractions') {
      if (edge(GBTN.a)) $('#throw-pebble').click();
      else if (edge(GBTN.x)) $('#throw-empty_bottle').click();
      else if (edge(GBTN.b) || edge(GBTN.start)) $('#throw-leave').click();
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'pickpocket') {
      if (edge(GBTN.a)) pickpocketInput('take');
      if (edge(GBTN.b) || edge(GBTN.start)) pickpocketInput('leave');
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'notelock') {
      if (edge(GBTN.dleft)) noteLockInput('left');
      if (edge(GBTN.dright)) noteLockInput('right');
      if (edge(GBTN.a)) noteLockInput('play');
      if (edge(GBTN.x)) noteLockInput('listen');
      if (edge(GBTN.b) || edge(GBTN.start)) noteLockInput('leave');
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'pressureplate') {
      if (edge(GBTN.a)) pressurePlateInput('toggle');
      if (edge(GBTN.b) || edge(GBTN.start)) pressurePlateInput('leave');
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'mirror') {
      if (edge(GBTN.dleft)) turningMirrorInput('left');
      if (edge(GBTN.dright)) turningMirrorInput('right');
      if (edge(GBTN.a)) turningMirrorInput('rotate');
      if (edge(GBTN.x)) turningMirrorInput('reset');
      if (edge(GBTN.b) || edge(GBTN.start)) turningMirrorInput('leave');
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0; return;
    }
    if (G.openPanel === 'lockpick') {
      if (edge(GBTN.dleft)) lockpickInput('left');
      if (edge(GBTN.dright)) lockpickInput('right');
      if (edge(GBTN.a)) lockpickInput('lift');
      if (edge(GBTN.b) || edge(GBTN.start)) lockpickInput('cancel');
      for (let i = 0; i < 32; i++) prev[i] = btn(i);
      G.touch.fx = G.touch.fy = 0;
      return;
    }
    if (play) {
      if (edge(GBTN.a)) interact();
      if (edge(GBTN.b)) attack('swing');
      if (edge(GBTN.x)) castSong('murmur');
      if (edge(GBTN.y)) {
        if (pickpocketTarget()) openPickpocket();
        else { G.state = 'panel'; renderSongs(); }
      }
      if (edge(GBTN.lb)) cycleWeapon(-1);
      if (edge(GBTN.rb)) cycleWeapon(1);
      if (edge(GBTN.back)) openDisguise();
      if (edge(GBTN.lstick)) openBody();
      if (edge(GBTN.rstick)) openDistractions();
      if (btn(GBTN.lt)) triggerBlock();
      if (edge(GBTN.rt)) attack('thrust');
      if (edge(GBTN.dup)) castSong('tending');
      if (edge(GBTN.ddown)) castSong('root');
      if (edge(GBTN.dleft)) cycleWeapon(-1);
      if (edge(GBTN.dright)) cycleWeapon(1);
    }
    if (edge(GBTN.start) && (G.state === 'play' || G.state === 'panel')) renderMenu();
    for (let i = 0; i < 32; i++) prev[i] = btn(i);
  }

  // -- world extras: climb ledges & the night watch ------------------
  function addWorldExtras(maps) {
    const clear = (m, x, y) => {
      for (const e of m.entities) if (e.kind === 'deco' && e.solid && !e.use && Math.abs(e.x - x) < 1.4 && Math.abs(e.y - y) < 1.4) { e.hidden = true; e.dead = true; }
    };
    const climb = (m, x, y, to, msgTxt, label) => {
      m.deco('crates', x, y, { radius: 0.35, scale: 1.1, use: 'climb', to, msg: msgTxt, label });
      clear(m, x, y); clear(m, to.x, to.y);
    };
    if (maps.whispergrove) {
      climb(maps.whispergrove, 15.5, 36.4, { x: 15.5, y: 32.4, dir: -Math.PI / 2 }, 'You climb the fallen colonnade over the drowned pool.', 'Fallen blocks of the drowned colonnade, stacked over the glowing pool. Climbing gets you across without getting wet.');
    }
    if (maps.deepwoods) {
      climb(maps.deepwoods, 17.0, 32.4, { x: 17.0, y: 27.9, dir: 0 }, 'You climb the raft of dead roots over the pool.', 'A raft of dead roots over the glowing pool. Climbing gets you across.');
      climb(maps.deepwoods, 9.0, 8.4, { x: 9.0, y: 5.2, dir: 0 }, 'You climb the raft of dead roots over the pool.', 'A raft of dead roots over the glowing pool. Climbing gets you across.');
    }
    if (maps.oakhaven) {
      maps.oakhaven.npc('townsman', 23.5, 20.5, { wander: true, nightWatch: true });
      maps.oakhaven.npc('townswoman', 23.5, 44.5, { wander: true, nightWatch: true });
      // Append after all historical baseline extras: saves map entities by index.
      if (maps.oakhaven.danger === 0) {
        maps.oakhaven.npc('townsman', 52.5, 20.5, { lawGuard: true, wander: true, name: 'Oakhaven watch constable' });
        Object.assign(maps.oakhaven.item('honey', 51.5, 19.2), { owner: 'market', label: 'Bettany’s honey — taking it is theft' });
      }
      // Static metadata only; preserve all historical entity indexes and quest data.
      maps.oakhaven.entities.forEach((e, index) => {
        if (e.kind !== 'npc' || e.lawGuard || e.nightWatch || !['bettany', 'tam', 'hob', 'townsman', 'townswoman'].includes(e.id)) return;
        e.pocketId = e.id + ':' + index;
        e.pocketGold = ['bettany', 'tam', 'hob'].includes(e.id) ? 8 : 4;
      });
      // Append supplies after historical entities so old entity-index saves still align.
      for (let i = 0; i < 3; i++) maps.oakhaven.item('pebble', 24.8 + i * 0.2, 26.5);
      maps.oakhaven.item('empty_bottle', 34.8, 18.5);
      maps.oakhaven.item('empty_bottle', 35.2, 18.5);
      maps.oakhaven.baseCount = maps.oakhaven.entities.length;
    }
    // Append after historical entities; flags hold trap state, not entity indexes.
    const cat = maps.catacombs;
    if (cat) {
      for (const [type, id, x, y] of [['tripwire', 'charnel-cord', 6.5, 6.5], ['net', 'chapel-net', 7.5, 24.5], ['alarm', 'gallery-bell', 24.5, 3.5]]) {
        cat.deco(TRAP_TYPES[type].sprite, x, y, { solid: false, scale: type === 'alarm' ? 0.35 : 0.45, use: 'trap', trapType: type, trapId: id, label: TRAP_TYPES[type].name + ' — inspect to disarm', glow: 0.35 });
      }
      // Optional drowned chapel counter-weight niche & pressure plate
      cat.clear(10, 26, 11, 26);
      cat.setFloor(10, 26, 1); cat.setFloor(11, 26, 1);
      cat.set(10, 26, DOOR({ locked: PLATE_FLAG, lockMsg: 'A counter-weight grate bars the west chapel niche. A sunken pressure plate in the drowned chapel floor is linked to its chain.', label: 'Counter-weight niche grate' }));
      cat.deco('grate', 4.5, 25.5, { solid: false, scale: 0.5, use: 'pressure_plate', plateId: 'chapel_plate', label: 'Sunken pressure plate — stand on it or inspect to place a ballast stone', glow: 0.35 });
      cat.deco('chest', 11.5, 26.5, { solid: false, scale: 0.45, label: 'Opened counter-weight reliquary niche', glow: 0.5 });
      // Optional niche gallery turning mirrors & eastern prismatic reliquary
      cat.clear(27, 1, 28, 1);
      cat.set(27, 1, DOOR({ locked: MIRROR_FLAG, lockMsg: 'A prismatic seal bars the eastern gallery niche. Angle the three brass mirrors in the gallery so the lantern beam reaches the lens.', label: 'Prismatic reliquary gate' }));
      cat.deco('lamp', 14.5, 4.5, { solid: false, scale: 0.55, use: 'mirror_lantern', label: 'Green-gold emitter lantern (shines North) — inspect to align mirrors', glow: 0.85, glassLamp: true });
      for (const [id, x, y, def] of [['m1', 14.5, 2.5, 1], ['m2', 22.5, 2.5, 1], ['m3', 22.5, 1.5, 0]]) {
        cat.deco('lever', x, y, { solid: false, scale: 0.5, use: 'turning_mirror', mirrorId: id, defaultAngle: def, label: `Turning brass mirror (${MIRROR_ANGLES[def]}) — inspect to rotate`, glow: 0.55 });
      }
      cat.deco('cores', 26.2, 1.5, { solid: false, scale: 0.45, use: 'mirror_lantern', label: 'Prismatic lock lens — receives an East-bound beam along row 1.5', glow: 0.75, glassLamp: true });
      for (const [seg, x, y] of [[1, 14.5, 3.5], [2, 18.5, 2.5], [3, 22.5, 2.0], [4, 24.5, 1.5]]) {
        cat.deco('lamp', x, y, { solid: false, nopick: true, scale: 0.25, yOff: -0.18, glow: 0.95, beamSeg: seg, hidden: seg > 1, label: 'Reflected green-gold light beam' });
      }
      cat.deco('chest', 28.5, 1.5, { solid: false, scale: 0.45, label: 'Opened prismatic reliquary niche', glow: 0.5 });
      cat.baseCount = cat.entities.length;
    }
    if (maps.cloister) {
      maps.cloister.deco('chest', 16.5, 12.5, { solid: false, scale: 0.55, use: 'note_reliquary', label: 'Three-voice reliquary — Root, Fifth, Third' });
      maps.cloister.baseCount = maps.cloister.entities.length;
    }
    // Nonblocking concealment points append last: never reorder saved entities.
    for (const id of ['oakhaven', 'quarry', 'cloister']) {
      const m = maps[id]; if (!m || (id === 'oakhaven' && m.danger > 0)) continue;
      const anchor = id === 'oakhaven' ? { x: 25, y: 28 } : { x: m.spawn.x + 4, y: m.spawn.y };
      const spots = [];
      for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
        if (m.isBlocked(x, y) || m.get(x, y) || dist2(x + 0.5, y + 0.5, m.spawn.x, m.spawn.y) < 9) continue;
        if (m.entities.some(e => !e.hidden && !e.dead && dist2(x + 0.5, y + 0.5, e.x, e.y) < 2.25)) continue;
        if (m.triggers.some(t => dist2(x + 0.5, y + 0.5, t.x, t.y) < (t.r + 1) ** 2)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.get(x + dx, y + dy)?.door)) continue;
        spots.push({ x: x + 0.5, y: y + 0.5 });
      }
      spots.sort((a, b) => dist2(a.x, a.y, anchor.x, anchor.y) - dist2(b.x, b.y, anchor.x, anchor.y));
      const spot = spots[0];
      if (!spot) throw new Error('No safe body recess in ' + id);
      m.deco('crates', spot.x, spot.y, { solid: false, scale: 0.65, bodyCover: true, use: 'body_cover', label: 'Shrouded body recess — G to conceal nearby remains', glow: 0.25 });
      m.baseCount = m.entities.length;
    }
  }

  // -- engine & game hooks -------------------------------------------
  const _restoreGame = restoreGame;
  restoreGame = function (d) { const r = _restoreGame(d); syncHouseDoor(); syncCatacombsPuzzles(); return r; };

  const _buildOakhaven = buildOakhaven;
  buildOakhaven = function (g) { const m = _buildOakhaven(g); syncHouseDoor(m); return m; };

  const _buildAllMaps = buildAllMaps;
  buildAllMaps = function () { const maps = _buildAllMaps(); addWorldExtras(maps); addLawWorld(maps); addReliefWorld(maps); syncCatacombsPuzzles(); return maps; };

  const _stepSfx = Audio_.sfx.step;
  Audio_.sfx.step = (surface) => _stepSfx(surface || stepSurface());

  const _engRender = Engine.render;
  Engine.render = function (ents, tod, opts) { _engRender.call(this, ents, tod, opts); drawWeatherOverlay(); };

  const _useDeco = useDeco;
  useDeco = function (e) { if (e && e.use === 'climb') { doClimb(e); return; } return _useDeco(e); };

  const _killEnemy = killEnemy;
  killEnemy = function (e, byGlass) { try { Audio_.sfx.enemy(e.def, 'death'); } catch (err) { } return _killEnemy(e, byGlass); };

  const _die = die;
  die = function (src) {
    _die(src);
    if (hardcoreOn()) return;
    if (!UPG.autosaveSlot) return;
    const old = $('#btn-auto-load'); if (old) old.remove();
    const wake = $('#btn-wake'); if (!wake || !wake.parentNode) return;
    const btn = document.createElement('button');
    btn.className = 'dfbtn'; btn.id = 'btn-auto-load'; btn.textContent = 'Load the pre-boss autosave';
    btn.onclick = () => { hide('#death'); G.dead = false; G.state = 'play'; try { restoreGame(JSON.parse(JSON.stringify(UPG.autosaveSlot))); } catch (e) { msg('The autosave did not read.', 'bad'); } };
    wake.parentNode.insertBefore(btn, wake.nextSibling);
  };

  const _playerMove = playerMove;
  playerMove = function (o, dx, dy) {
    G._swimCtx = true;
    try {
      const ahead = waterLvl(o.x + dx, o.y + dy);
      const k = ahead === 2 ? 0.55 : ahead === 1 ? 0.82 : 1;
      return _playerMove(o, dx * k, dy * k);
    } finally { G._swimCtx = false; }
  };

  if (GameMap.prototype && GameMap.prototype.isBlocked) {
    const _isBlocked = GameMap.prototype.isBlocked;
    GameMap.prototype.isBlocked = function (x, y) {
      if (G._swimCtx && this.floorCells && x >= 0 && y >= 0 && x < this.w && y < this.h && this.floorCells[y * this.w + x] === 2) return false;
      return _isBlocked.call(this, x, y);
    };
  }

  const _update = update;
  update = function (dt) {
    _update(dt);
    if (!G.map) return;
    tickWeather(dt);
    tickSwim(dt);
    tickAmbient(dt);
    tickBossSave();
    tickTutorial(dt);
  };

  const _controlsTick = controlsTick;
  controlsTick = function () { gamepadTick(); _controlsTick(); };
})();





