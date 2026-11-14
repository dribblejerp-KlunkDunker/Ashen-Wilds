// arms12 — Phase 12 "Tools of the trade", team ARMS: shield bash, two-handed weapons, dual-wielding.
//
// Everything is done by wrapping (attack, update, drawHUD, equipArmor, damagePlayer, renderInventory,
// renderAccessibilityMenu); no game file is edited except for the stock/CSS hooks listed in the report.
//
//  * Shield bash   Guard up (F / controller LT) and strike, or the "." key, or the touch Bash button. Needs a shield that is
//                  really on the arm (not stowed behind a two-hander). Knocks a light foe back about a tile, staggers it,
//                  deals 1-3. Heavy foes are only staggered; bosses are not moved at all. Cooldown and fatigue.
//  * Two hands     Melee weapons marked twoHanded (spear, maul and the new p12_ ones) hit harder and reach further, but swing
//                  slower and tire you more. Taking one up puts the shield away (and the off hand); wearing a shield puts
//                  the two-hander away. The picture is centred and heavier.
//  * Dual wield    A light weapon (knife, short sword, dirk, the nib-knife) in the off hand: swings alternate hands, a small
//                  speed gain, off-hand blows hit for less. No shield, no two-hander. A two-weapon block is weaker than a
//                  shield's. The off-hand slot is the flag p12a_off (an index into OFF_IDS), so it is clamped on every read.
//
// Switches (Options, Graphics & access): S.bash, S.two, S.dual (localStorage 'echoes-arms12'). With a switch off the
// matching code path is not entered, so fights and equipment behave exactly as before.
'use strict';

const ARMS12 = (() => {
  // ---- balance: the one table (also copied into the report) ------------------------------------------------------------
  const BAL = {
    bash: {
      key: '.',            // dedicated key; the combo is guard-up + strike (works on mouse, pad LT+RT/B)
      cool: 2.2,           // seconds before the next bash
      whiffCool: 0.9,      // a bash at empty air only costs a short recovery
      cost: 5,             // fatigue per bash (a normal swing costs 1)
      whiffCost: 2,
      minFat: 5,           // too winded below this
      reach: 1.35,         // like a short sword
      cone: 0.6,
      dmg: [1, 3],         // small
      knock: 1.0,          // tiles, light foes only (collision checked every step)
      knockT: 0.18,        // seconds the shove takes
      maxDrop: 0.5,        // never shoved down more than this (enemies only walk down what the game lets them)
      stun: 0.8,           // light foes
      stunHeavy: 0.45,     // heavy foes: no knock-back
      stunBoss: 0,         // bosses: nothing at all (no damage, no move, no stagger)
      dur: 0.32,           // shield-thrust animation, also blocks a second action
      noise: 1.2,
    },
    two: { dmgMul: 1.12, reachAdd: 0.12, speedMul: 1.1, extraFat: 1 },
    dual: { speedMul: 0.8, offDmgMul: 0.7, blockMul: 0.9 },   // blockMul 0.9 x guard's 0.5 = a 0.45 block (shield 0.33, none 0.5)
    heavy: { scale: 1.15, hp: 50 },                           // heavy = big, armoured or 50+ HP
  };
  // off-hand candidates: light, one-handed, melee. Index + 1 is what the flag stores.
  const OFF_IDS = ['knife', 'sword', 'sable_dagger', 'p12_dirk'];

  // ---- new weapons and items (merchant stock; ids prefixed p12_) -------------------------------------------------------
  // numbers are the weapon's own (before the two-hand grip table); the note says how to get each one.
  const NEW_WEAPONS = {
    // [PROPOSED] a quarry sledge: bought from Factor Vosk's company store
    p12_greatmaul: { name: 'Quarry Great-Maul', img: 'fp_maul', dmg: [14, 28], reach: 1.6, noise: 3.8, speed: 1.2, type: 'iron', blunt: true, twoHanded: true, value: 160,
      desc: 'A quarry sledge on an ash haft as long as a man, the head weighted with lead. Cracks bell-plate and golems; swings like a door closing. Two hands, so no shield.' },
    // [PROPOSED] the long glass-edged blade: bought from Captain Vane (off the Kestrel)
    p12_glassblade: { name: 'Long Glass-Edged Blade', img: 'fp_longsword', dmg: [10, 20], reach: 1.9, noise: 1.4, speed: 0.82, type: 'glass', twoHanded: true, value: 210,
      desc: 'A corsair\'s two-handed blade, the edge ground out of salvaged Aether-Glass. It rings through the Cacophony. Two hands, so no shield.' },
    // [PROPOSED] a Compact polearm in bell-bronze: bought from Orrin Pale the sexton, who keeps the chapel's stock (R2: the Church keeps no shop)
    p12_bellglaive: { name: 'Bell-Bronze Glaive', img: 'fp_spear', dmg: [8, 15], reach: 2.2, noise: 2.2, speed: 0.78, type: 'bronze', twoHanded: true, value: 135,
      desc: 'A curved bell-bronze blade on a six-foot shaft, beaten from the scrap the Synod\'s casters threw out when the Reach\'s bells went to the bore. Reaches over a shield rim and past a hound. Two hands, so no shield.' },
    // [PROPOSED] a parrying dirk for the off hand: bought from Abner
    p12_dirk: { name: 'Reed-Guard Dirk', img: 'fp_knife', dmg: [3, 8], reach: 1.15, noise: 0.8, speed: 0.30, type: 'iron', value: 30,
      desc: 'A stiff, basket-hilted dirk for the off hand. Light enough to carry beside a blade. Rust Coast duellists call it the second word.' },
  };
  const STOCK = { vosk: ['p12_greatmaul'], vane: ['p12_glassblade'], orrin: ['p12_bellglaive'], hob: ['p12_dirk'] };

  // ---- settings ---------------------------------------------------------------------------------------------------------
  const KEY = 'echoes-arms12';
  const S = { bash: true, two: true, dual: true };
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') for (const k of Object.keys(S)) if (typeof o[k] === 'boolean') S[k] = o[k];
    } catch (e) { /* storage may be blocked */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  load();

  const st = {
    bashCool: 0, bashT: 0, bashHit: false, bashes: 0, whiffs: 0,
    nextHand: 'main', swingHand: 'main', offSwings: 0, mainSwings: 0,
    knock: [], map: null, notes: 0,
  };

  // ---- catalog ----------------------------------------------------------------------------------------------------------
  Object.assign(WEAPONS, NEW_WEAPONS);
  for (const id in NEW_WEAPONS) {
    ITEMS['w_' + id] = { name: NEW_WEAPONS[id].name, sprite: 'gear', weapon: id, value: NEW_WEAPONS[id].value, desc: NEW_WEAPONS[id].desc };
    try { if (typeof ITEM_WEIGHTS === 'object') ITEM_WEIGHTS['w_' + id] = NEW_WEAPONS[id].twoHanded ? 9 : 1.6; } catch (e) { /* weights are optional */ }
  }
  function stock() {
    for (const npc in STOCK) {
      const n = typeof NPCS === 'object' ? NPCS[npc] : null;
      if (!n || !Array.isArray(n.shop)) continue;
      for (const w of STOCK[npc]) if (!n.shop.some(e => e && e.item === 'w_' + w)) n.shop.push({ item: 'w_' + w });
    }
  }
  stock();

  // ---- helpers ----------------------------------------------------------------------------------------------------------
  const say = (t, cls, ttl) => { try { msg(t, cls || '', ttl || 2400); } catch (e) { /* no HUD yet */ } };
  const inPlay = () => !!(G.player && G.state === 'play' && !G.dead);
  const mainId = () => { const p = G.player; return p && p.weapons ? p.weapons[p.weapon] : null; };
  const isTwo = (w) => !!(w && w.twoHanded && !w.ranged);
  function shieldUsable() {
    try { return !!worn('shield') && !shieldBlocked(); } catch (e) { return false; }
  }
  // the off-hand slot, clamped: an index into OFF_IDS that must be owned, eligible and not stale
  function offEligible(id) {
    const W = WEAPONS[id];
    return !!W && OFF_IDS.indexOf(id) >= 0 && !W.ranged && !W.twoHanded && !W.innate && W.speed <= 0.45 && W.reach <= 1.45;
  }
  function offId() {
    const p = G.player; if (!p || !G.flags) return null;
    const v = G.flags.p12a_off;
    if (v === undefined) return null;
    const id = Number.isInteger(v) && v >= 1 && v <= OFF_IDS.length ? OFF_IDS[v - 1] : null;
    if (!id || !offEligible(id) || !(p.weapons || []).includes(id)) { delete G.flags.p12a_off; return null; }
    return id;
  }
  function clearOff() { if (G.flags) delete G.flags.p12a_off; }
  function mainOk() { const w = currentWeapon(); return !!w && !w.ranged && !w.twoHanded && !w.innate; }
  function dualActive() {
    if (!S.dual || !G.player) return false;
    const o = offId(); if (!o) return false;
    return mainOk() && o !== mainId() && !worn('shield');
  }

  // ---- equipment rules (run every frame, and when the inventory is drawn) --------------------------------------------------
  // "equipping one unequips the other": the thing taken up last wins. Weapon changes are plain assignments to p.weapon
  // (keys, wheel, pad, inventory) so they are caught here; the shield and off-hand actions are caught at their own call.
  function enforce() {
    const p = G.player; if (!p || !p.armor || !G.flags) return false;
    let changed = false;
    const w = currentWeapon();
    if (S.two && isTwo(w)) {
      // the shield stays on and is stowed behind the two-hander, as the base game already does (shieldBlocked())
      if (G.flags.p12a_off !== undefined && offId()) {
        say(`You sheathe the off-hand blade to take the ${w.name} in both hands.`, '', 3000);
        clearOff(); changed = true;
      }
    }
    if (S.dual && G.flags.p12a_off !== undefined && offId() && worn('shield')) {
      // shield and off hand together (a looted shield put itself on, or an edited save): the shield wins
      say('The shield takes your off hand; you sheathe the second blade.', '', 3000);
      clearOff(); changed = true;
    }
    return changed;
  }
  function setOff(id) {
    if (!S.dual || !G.player) return false;
    const i = OFF_IDS.indexOf(id);
    if (i < 0 || !offEligible(id) || !G.player.weapons.includes(id)) return false;
    if (id === mainId()) { say(`The ${WEAPONS[id].name} is already in your main hand.`, '', 2400); return false; }
    if (isTwo(currentWeapon())) { say(`Your hands are full with the ${currentWeapon().name}.`, '', 2400); return false; }
    if (!mainOk()) { say('Fists and a glass arm do not pair with a second blade.', '', 2400); return false; }
    if (worn('shield')) { delete G.player.armor.shield; say('You take the shield off to carry a second blade.', '', 2600); }
    G.flags.p12a_off = i + 1;
    say(`The ${WEAPONS[id].name} goes in your off hand.`, 'good', 2400);
    st.nextHand = 'main';
    return true;
  }
  function stowOff() { if (offId()) { clearOff(); say('You sheathe the off-hand blade.', '', 2000); return true; } return false; }

  // ---- weapon modifiers (temporary edits of the catalog entry, restored in finally: object identity is kept) ------------
  function withMods(wid, m, fn) {
    const W = WEAPONS[wid]; if (!W) return fn();
    const d0 = W.dmg, r0 = W.reach, s0 = W.speed;
    try {
      if (m.dmgMul) W.dmg = [Math.max(1, Math.round(d0[0] * m.dmgMul)), Math.max(1, Math.round(d0[1] * m.dmgMul))];
      if (m.reachAdd) W.reach = r0 + m.reachAdd;
      if (m.speedMul) W.speed = s0 * m.speedMul;
      return fn();
    } finally { W.dmg = d0; W.reach = r0; W.speed = s0; }
  }
  // the numbers a swing will really use, for the table in the inventory and for tests
  function effective(wid, hand) {
    const W = WEAPONS[wid]; if (!W) return null;
    let m = {};
    if (S.two && isTwo(W)) m = { dmgMul: BAL.two.dmgMul, reachAdd: BAL.two.reachAdd, speedMul: BAL.two.speedMul };
    else if (S.dual && dualActive() && !W.ranged) m = hand === 'off' ? { dmgMul: BAL.dual.offDmgMul, speedMul: BAL.dual.speedMul } : { speedMul: BAL.dual.speedMul };
    const dmg = m.dmgMul ? [Math.max(1, Math.round(W.dmg[0] * m.dmgMul)), Math.max(1, Math.round(W.dmg[1] * m.dmgMul))] : W.dmg.slice();
    return { dmg, reach: W.reach + (m.reachAdd || 0), speed: W.speed * (m.speedMul || 1) };
  }

  // ---- the shield bash ----------------------------------------------------------------------------------------------------
  function classify(e) {
    const d = (e && e.def) || {};
    if (d.boss || d.wildsBoss || d.coda || e.boss) return 'boss';
    if ((d.scale || 1) >= BAL.heavy.scale || (d.hp || 0) >= BAL.heavy.hp || d.armored || e.type === 'golem') return 'heavy';
    return 'light';
  }
  function findTarget() {
    const c = Engine.cam, p = G.player; let best = null, bd = 1e9;
    for (const e of G.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden) continue;
      const dx = e.x - c.x, dy = e.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > BAL.bash.reach + (e.radius || 0.3)) continue;
      if (Math.abs(feetOf(e) - feetOf(p)) > MELEE_RISE) continue;
      if (Math.abs(normAng(Math.atan2(dy, dx) - c.dir)) > BAL.bash.cone) continue;
      if (!los(c.x, c.y, e.x, e.y)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // how far a shove really goes: straight away from the player in 0.1 steps, stopping at the first wall, solid thing or drop
  function planKnock(e, want) {
    const c = Engine.cam; let ux = e.x - c.x, uy = e.y - c.y; const len = Math.hypot(ux, uy) || 1; ux /= len; uy /= len;
    const g0 = (G.map.lvls || G.map.smooth) ? G.map.groundAt(e.x, e.y) : 0;
    let ok = 0;
    for (let s = 0.1; s <= want + 1e-6; s += 0.1) {
      const nx = e.x + ux * s, ny = e.y + uy * s;
      if (solidAt(nx, ny, e)) break;
      if ((G.map.lvls || G.map.smooth) && G.map.groundAt(nx, ny) < g0 - BAL.bash.maxDrop) break;   // no yeeting off a gallery
      ok = s;
    }
    return { dist: +ok.toFixed(2), ux, uy };
  }
  function bash(explicit) {
    const p = G.player;
    if (!S.bash || !inPlay()) return false;
    if (!shieldUsable()) { if (explicit) say(worn('shield') ? 'Your two-handed weapon leaves no hand for the shield.' : 'You have no shield on your arm.', '', 1800); return false; }
    if (G.attack.t > 0 || G.song.t > 0 || st.bashT > 0) return false;
    if (st.bashCool > 0) { if (explicit) say('Your shield arm is still numb from the last one.', '', 1400); return false; }
    if (p.fat < BAL.bash.minFat) { if (explicit) say('You are too winded to put your weight behind it.', 'bad', 1600); return false; }
    const e = findTarget();
    if (!e && !explicit) return false;            // the combo falls through to an ordinary strike
    st.bashT = BAL.bash.dur; st.bashHit = !!e;
    if (!e) {
      p.fat = Math.max(0, p.fat - BAL.bash.whiffCost); st.bashCool = BAL.bash.whiffCool; st.whiffs++;
      addNoise(0.4); say('Your shield finds nothing but air.', '', 1200);
      return true;
    }
    p.fat = Math.max(0, p.fat - BAL.bash.cost); st.bashCool = BAL.bash.cool; st.bashes++;
    exposeDisguise('A patrol witnesses your attack.'); addNoise(BAL.bash.noise);
    try { Audio_.sfx.hit(); } catch (er) { /* audio not started */ }
    const d = e.def, cls = classify(e), nm = theName(d.name, false);
    if (e.state === 'idle' || e.state === 'passive' || e.state === 'investigate') { delete e.investigation; e.state = 'chase'; e.alertT = 8; }
    if (cls === 'boss') {
      say(`You drive the shield into ${nm}. It does not so much as shift.`, '', 2000);
      return true;
    }
    const dmg = rndi(BAL.bash.dmg[0], BAL.bash.dmg[1]);
    e.hp -= dmg; e.flash = true; setTimeout(() => { e.flash = false; }, 90);
    try { if (typeof HUD11 === 'object' && HUD11.addNumber) HUD11.addNumber('hit', dmg, e); } catch (er) { /* presentation only */ }
    try { if (typeof FLOURISH11 === 'object' && FLOURISH11.hitstop) FLOURISH11.hitstop.fire(60, 'bash'); } catch (er) { /* presentation only */ }
    if (e.hp <= 0) { say(`Your shield-rim breaks ${nm}.`, '', 1800); killEnemy(e, false); return true; }
    if (cls === 'heavy') {
      e.stun = Math.max(e.stun || 0, BAL.bash.stunHeavy);
      say(`You hit ${nm} with the shield for ${dmg}. It rocks on its heels but holds its ground.`, '', 2200);
    } else {
      const k = planKnock(e, BAL.bash.knock);
      e.stun = Math.max(e.stun || 0, BAL.bash.stun);
      if (k.dist > 0) st.knock.push({ e, ux: k.ux, uy: k.uy, left: k.dist, speed: k.dist / BAL.bash.knockT, map: G.mapId });
      say(k.dist > 0 ? `Your shield slams ${nm} back a stride for ${dmg}.` : `Your shield pins ${nm} against the wall for ${dmg}.`, '', 2200);
    }
    return true;
  }
  function stepKnock(dt) {
    if (!st.knock.length) return;
    for (const k of st.knock) {
      const e = k.e;
      if (k.map !== G.mapId || e.dead || e.hidden || !G.ents.includes(e)) { k.left = 0; continue; }
      const s = Math.min(k.left, k.speed * dt);
      const nx = e.x + k.ux * s, ny = e.y + k.uy * s;
      if (s > 0 && !solidAt(nx, ny, e)) { e.x = nx; e.y = ny; k.left -= s; } else k.left = 0;
    }
    st.knock = st.knock.filter(k => k.left > 1e-6);
  }

  // ---- wiring -------------------------------------------------------------------------------------------------------------
  function wire() {
    if (typeof attack === 'function') {
      const _attack = attack;
      attack = function () {
        if (!G.player || G.state !== 'play' || !(S.bash || S.two || S.dual)) return _attack.apply(this, arguments);
        let hand = 'main';
        try {
          if (st.bashT > 0) return undefined;     // the shield is still out
          if (S.bash && typeof UPG !== 'undefined' && UPG.blocking && UPG.parryCool > 0 && G.attack.t <= 0 && shieldUsable() && bash(false)) return undefined;
        } catch (e) { console.warn('arms12 bash', e); }
        const p = G.player, wid = mainId(), W = WEAPONS[wid], before = G.attack.t;
        let run = () => _attack.apply(this, arguments), two = false, dual = false, w0 = p.weapon;
        try {
          two = S.two && isTwo(W);
          dual = !two && dualActive() && G.attack.t <= 0 && G.song.t <= 0;
          if (two) { const inner = run; run = () => withMods(wid, { dmgMul: BAL.two.dmgMul, reachAdd: BAL.two.reachAdd, speedMul: BAL.two.speedMul }, inner); }
          else if (dual) {
            if (st.nextHand === 'off') {
              hand = 'off'; const oid = offId(), inner = run;
              run = () => { p.weapon = p.weapons.indexOf(oid); return withMods(oid, { dmgMul: BAL.dual.offDmgMul, speedMul: BAL.dual.speedMul }, inner); };
            } else { const inner = run; run = () => withMods(wid, { speedMul: BAL.dual.speedMul }, inner); }
          }
        } catch (e) { console.warn('arms12 attack setup', e); run = () => _attack.apply(this, arguments); two = dual = false; }
        let r;
        try { r = run(); } finally { if (p.weapon !== w0 && dual && hand === 'off') p.weapon = w0; }
        try {
          if (before <= 0 && G.attack.t > 0) {
            if (two) p.fat = Math.max(0, p.fat - BAL.two.extraFat);
            if (dual) { st.swingHand = hand; st.nextHand = hand === 'main' ? 'off' : 'main'; if (hand === 'off') st.offSwings++; else st.mainSwings++; }
          }
        } catch (e) { /* bookkeeping only */ }
        return r;
      };
    }
    if (typeof update === 'function') {
      const _update = update;
      update = function (dt) {
        try {
          if (G.player && G.state !== 'title') {
            if (st.map !== G.player) { st.map = G.player; st.knock.length = 0; st.nextHand = 'main'; st.bashCool = st.bashT = 0; }
            if (dt > 0 && G.state === 'play') {
              if (st.bashCool > 0) st.bashCool = Math.max(0, st.bashCool - dt);
              if (st.bashT > 0) st.bashT = Math.max(0, st.bashT - dt);
              stepKnock(dt);
            }
            if (S.two || S.dual) enforce();
          }
        } catch (e) { console.warn('arms12 update', e); }
        return _update.apply(this, arguments);
      };
    }
    if (typeof equipArmor === 'function') {
      const _eq = equipArmor;
      equipArmor = function (id) {
        const a = ARMOR[id];
        let r;
        if (a && a.slot === 'shield' && G.player && G.has(id)) {
          try {
            const w = currentWeapon();
            // a shield beside a two-hander is simply stowed by the base game (shieldBlocked()); nothing to swap
            if (S.dual && offId()) { clearOff(); r = _eq.apply(this, arguments); say('You sheathe the off-hand blade to take up the shield.', '', 2600); return r; }
          } catch (e) { console.warn('arms12 equip', e); }
        }
        return _eq.apply(this, arguments);
      };
    }
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function (dmg, src) {
        try {
          // two blades are a weaker block than a shield: guard halves a blow, so scale first to land on 0.45
          if (S.dual && typeof GUARD !== 'undefined' && GUARD.state.inMelee && typeof UPG !== 'undefined' && UPG.blocking && UPG.parryCool > 0 && !(UPG.parryWindow > 0) && G.state === 'play' && dualActive()) {
            dmg = Math.max(1, Math.round(dmg * BAL.dual.blockMul));
          }
        } catch (e) { /* never block a hit from landing */ }
        return _dp.call(this, dmg, src);
      };
    }
    if (typeof renderInventory === 'function') {
      const _ri = renderInventory;
      renderInventory = function () {
        try { if (S.two || S.dual) enforce(); } catch (e) { console.warn('arms12 enforce', e); }
        const r = _ri.apply(this, arguments);
        try { decorateInventory(); } catch (e) { console.warn('arms12 inventory', e); }
        return r;
      };
    }
    if (typeof renderAccessibilityMenu === 'function') {
      const _acc = renderAccessibilityMenu;
      renderAccessibilityMenu = function () {
        const r = _acc.apply(this, arguments);
        try { appendRows(); } catch (e) { console.warn('arms12 rows failed', e); }
        return r;
      };
    }
    if (typeof drawHUD === 'function') {
      const _draw = drawHUD;
      drawHUD = function () {
        if (!G.player || !(S.bash || S.two || S.dual)) return _draw.apply(this, arguments);
        let cw = null, two = false, off = false, swapped = false, bob0 = null, att0 = null;
        try {
          cw = currentWeapon(); two = S.two && isTwo(cw) && cw.img !== 'fp_hands';
          off = dualActive() && G.song.t <= 0 && G.songFx <= 0 && !(typeof FPHANDS === 'object' && FPHANDS.st && (FPHANDS.st.lower > 0 || FPHANDS.st.climb > 0));
        } catch (e) { two = off = false; }
        const _cw = currentWeapon;
        if (two) { try { const c = Object.assign({}, cw, { center: true }); currentWeapon = () => c; swapped = true; bob0 = Engine.cam.bob; Engine.cam.bob = (bob0 || 0) * 1.6; } catch (e) { swapped = false; } }
        if (off && st.swingHand === 'off' && G.attack.t > 0) { att0 = G.attack.t; G.attack.t = 0; }   // the main hand stays up while the off hand swings
        let r;
        try { r = _draw.apply(this, arguments); } finally {
          if (swapped) { currentWeapon = _cw; Engine.cam.bob = bob0; }
          if (att0 !== null) G.attack.t = att0;
        }
        try {
          const ctx = Engine.ctx;
          if (off) drawOffHand(ctx);
          if (st.bashT > 0) drawShield(ctx);
        } catch (e) { console.warn('arms12 draw', e); }
        return r;
      };
    }
  }

  // ---- first-person drawing (procedural stand-in art) ---------------------------------------------------------------------
  function drawOffHand(ctx) {
    const oid = offId(), W = WEAPONS[oid], img = W && Engine.images[W.img]; if (!img) return;
    const sc = 0.42, iw = img.width * sc, ih = img.height * sc;
    let ax = 0, ay = 0, rot = 0, zoom = 1;
    if (G.attack.t > 0 && st.swingHand === 'off') {
      const pose = animWeaponPose(W, 1 - G.attack.t / G.attack.dur, G.attack.dirLabel);
      ax = -pose.x; ay = pose.y; rot = -pose.rotation; zoom = pose.scale;
    }
    const bob = (Engine.cam.bob || 0) + (G.attack.t > 0 ? 0 : Math.sin(performance.now() / 900 + 1.7) * 1.4);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.translate(12 + iw * 0.5 + ax, VIEW_H + 14 + ay + bob * 1.5);
    ctx.rotate(rot); ctx.scale(-zoom, zoom);
    ctx.drawImage(img, -iw * 0.5, -ih + 12, iw, ih);
    ctx.restore();
  }
  // a kite/round shield thrust out of the left of the view; with Reduce motion it just flashes up in place
  function drawShield(ctx) {
    const f = 1 - st.bashT / BAL.bash.dur, calm = !!(typeof GFX !== 'undefined' && GFX.reduceMotion);
    const k = calm ? 0.6 : Math.sin(Math.min(1, f) * Math.PI);          // out and back
    const a = worn('shield'), tall = a && /Kite/.test(a.name);
    const cx = 74 + (calm ? 0 : k * 30), cy = VIEW_H - 18 - (calm ? 0 : k * 30), s = 0.8 + (calm ? 0.2 : k * 0.55);
    const w = 44 * s, h = (tall ? 66 : 52) * s;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VIEW_H); ctx.clip();
    ctx.globalAlpha = Math.min(1, 0.35 + k);
    ctx.translate(cx, cy); ctx.rotate(-0.12 * k);
    ctx.fillStyle = '#6d5140'; ctx.strokeStyle = '#b8a16b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h * 0.1); ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, h * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(184,161,107,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -h / 2 + 3); ctx.lineTo(0, h / 2 - 5); ctx.moveTo(-w / 2 + 4, -h * 0.1); ctx.lineTo(w / 2 - 4, -h * 0.1); ctx.stroke();
    ctx.fillStyle = '#b8a16b'; ctx.beginPath(); ctx.arc(0, -h * 0.1, 3.2 * s, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  // ---- inventory: off-hand controls and the grip table -----------------------------------------------------------------
  function decorateInventory() {
    const box = document.querySelector('#modal-panel .weps'); if (!box || box.querySelector('.p12a-off')) return;
    const p = G.player; if (!p) return;
    const wrap = document.createElement('div'); wrap.className = 'p12a-off';
    const note = (t) => { const s = document.createElement('p'); s.className = 'muted small-note'; s.textContent = t; return s; };
    if (S.dual) {
      const cur = offId();
      const hdr = document.createElement('h4'); hdr.textContent = 'Off hand'; wrap.appendChild(hdr);
      const cand = p.weapons.filter(id => offEligible(id));
      if (!cand.length) wrap.appendChild(note('No light blade to carry in the off hand (a knife, short sword or dirk).'));
      else {
        for (const id of cand) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'dfbtn small weprow' + (cur === id ? ' sel' : ''); b.dataset.p12aOff = id;
          const n = document.createElement('b'); n.textContent = (cur === id ? 'Off hand: ' : 'Off hand? ') + WEAPONS[id].name;
          const e = document.createElement('span'); const d = effective(id, 'off') || { dmg: WEAPONS[id].dmg };
          e.textContent = `${Math.max(1, Math.round(WEAPONS[id].dmg[0] * BAL.dual.offDmgMul))}–${Math.max(1, Math.round(WEAPONS[id].dmg[1] * BAL.dual.offDmgMul))} when it swings off-hand`;
          b.appendChild(n); b.appendChild(e);
          b.onclick = () => { if (cur === id) stowOff(); else setOff(id); renderInventory(); };
          wrap.appendChild(b);
        }
        wrap.appendChild(note('Two blades alternate hands and swing a little faster; the off hand hits lighter, and two blades block worse than a shield. No shield, no two-handed weapon.'));
      }
    }
    if (S.two) wrap.appendChild(note('Two-handed weapons hit harder and reach further but swing slower and tire you; taking one up sets the shield aside.'));
    box.appendChild(wrap);
  }

  // ---- Options rows (Graphics & access grid) ------------------------------------------------------------------------------
  const ROWS = [
    ['a12-bash', 'bash', 'Shield bash', 'guard up and strike, or the . key: shoves and staggers a foe'],
    ['a12-two', 'two', 'Two-handed weapons', 'heavy grips hit harder, swing slower, and send the shield away'],
    ['a12-dual', 'dual', 'Dual wielding', 'a light blade in the off hand, from the inventory'],
  ];
  function appendRows() {
    const grid = document.querySelector('#modal-panel .ctl-grid');
    if (!grid || document.getElementById('a12-bash')) return;
    const sync = (b, k) => { b.textContent = S[k] ? 'On' : 'Off'; b.setAttribute('aria-pressed', S[k] ? 'true' : 'false'); b.classList.toggle('sel', !!S[k]); };
    for (const [id, k, label, hint] of ROWS) {
      const lab = document.createElement('span'); lab.className = 'gfx-label'; lab.textContent = label + ' ';
      const sm = document.createElement('small'); sm.className = 'muted'; sm.textContent = hint; lab.appendChild(sm);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dfbtn small'; b.id = id; b.setAttribute('aria-label', label);
      b.onclick = () => { setSwitch(k, !S[k]); sync(b, k); };
      sync(b, k);
      grid.appendChild(lab); grid.appendChild(b);
    }
  }
  function setSwitch(k, v) { if (!(k in S)) return; S[k] = !!v; save(); if (G.player) { try { enforce(); } catch (e) { /* ignore */ } } }

  // ---- keyboard, touch ----------------------------------------------------------------------------------------------------
  function wireInput() {
    window.addEventListener('keydown', (ev) => {
      try {
        if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || !S.bash) return;
        if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
        if (G.state !== 'play' || G.openPanel || G.dead || (typeof UPG !== 'undefined' && UPG.rebinding)) return;
        if (ev.key === BAL.bash.key) { ev.preventDefault(); bash(true); }
      } catch (e) { /* a key press must never throw */ }
    });
    const ui = document.getElementById('touchui');
    if (ui && !document.getElementById('p12a-bash')) {
      const b = document.createElement('button'); b.id = 'p12a-bash'; b.className = 'tb small'; b.hidden = true; b.textContent = 'Bash';
      b.setAttribute('aria-label', 'Shield bash: shove and stagger the foe in front of you');
      ui.insertBefore(b, ui.firstChild);
      if (typeof tbtn === 'function') tbtn('#p12a-bash', null, () => bash(true));
      const css = document.createElement('style'); css.id = 'arms12-style';
      css.textContent = '#touchui:has(#p12a-bash:not([hidden])) { top: 24cqh; } .p12a-off { margin-top: .6cqh; } .p12a-off h4 { margin: .8cqh 0 .4cqh; font-family: var(--font-sc); color: var(--gold); font-weight: normal; }';
      document.head.appendChild(css);
      const sync = () => { try { b.hidden = !(S.bash && G.player && G.state === 'play' && shieldUsable()); } catch (e) { b.hidden = true; } };
      const _u = update; update = function () { const r = _u.apply(this, arguments); sync(); return r; };
    }
  }
  try { wire(); } catch (e) { console.warn('arms12 wiring failed', e); }
  try { wireInput(); } catch (e) { console.warn('arms12 input failed', e); }

  return { BAL, S, st, OFF_IDS, NEW_WEAPONS, STOCK, setSwitch, bash, classify, planKnock, setOff, stowOff, offId, offEligible, dualActive,
    enforce, effective, withMods, shieldUsable, appendRows, decorateInventory, stock, load, save };
})();
if (typeof window !== 'undefined') window.ARMS12 = ARMS12;
