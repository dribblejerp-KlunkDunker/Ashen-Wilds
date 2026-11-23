// ============================================================
//  kit17 - Phase 17, kit, weight and money.
//
//  What a person can do on a landing is decided by what they carry. This file is the lore's item table (prices in
//  measures of salt, weights as items-and-texts.md gives them), the eight backgrounds' kits, the burden thresholds
//  and the one-light rule. Phase 18 adds the cards' effects; this phase only weighs and prices.
//
//  Pure: no clock and no random number. The wire disables the engine's ranged weapons and field healing on this
//  game's maps, and records the background's kit; the copied inventory panel keeps its own layout.
// ============================================================
'use strict';

const KIT17 = (() => {
  const FREE = 18, LIMIT = 28;
  const ITEM_ROWS = {
    sword: { id: 'sword', name: 'Tarnished Arming Sword', kind: 'weapon', kg: 1.4, price: 20, stack: 1, use: 'weapon', desc: 'Crown issue, Citadel steel, older than the Smothering. The tower number under the cross is all the pay it had.' },
    spear: { id: 'spear', name: 'Boar-Lugged Spear', kind: 'weapon', kg: 2.6, price: 8, stack: 1, use: 'weapon', desc: 'A farm smith\'s boar spear. The lugs stop a charging boar running up the shaft to your hands.' },
    axe: { id: 'axe', name: 'Woodsman\'s Broadaxe', kind: 'weapon', kg: 2.3, price: 10, stack: 1, use: 'weapon', desc: 'A hewing axe for squaring beams, and there are few beams left. Bites deep and is slow to come back.' },
    targe: { id: 'targe', name: 'Wooden Targe', kind: 'shield', kg: 3.5, price: 6, stack: 1, use: 'shield', desc: 'Alder planks under boar rawhide, rimmed with a cut-down cart tyre. Fen-made, and it splinters like it.' },
    torch: { id: 'torch', name: 'Pitch Torch', kind: 'light', kg: 0.8, price: 2, stack: 1, use: 'light', desc: 'Rag wound on a stave and dipped in bog-pine pitch. A light means fuel, not safety. Fire burns spores.' },
    coif: { id: 'coif', name: 'Padded Coif', kind: 'armour', kg: 0.6, price: 3, stack: 1, use: 'head', desc: 'Quilted linen worn under a helmet, kept after the helmet was lost. Turns a glancing blow and little else.' },
    kettle: { id: 'kettle', name: 'Kettle Hat', kind: 'armour', kg: 1.4, price: 12, stack: 1, use: 'head', desc: 'A Watch helmet with a brim, dented and sweated through. The ogre kept it for the smell. Its owner is in the heap.' },
    gambeson: { id: 'gambeson', name: 'Quilted Gambeson', kind: 'armour', kg: 3.2, price: 15, stack: 1, use: 'body', desc: 'Thirty layers of linen, a household\'s winter of stitching. Warm, and it stops a cut from going deep.' },
    mail: { id: 'mail', name: 'Rusted Mail Hauberk', kind: 'armour', kg: 8.5, price: 40, stack: 1, use: 'body', desc: 'Crown mail from the Causeway tower, orange at every ring. Nobody alive can draw the wire to mend it.' },
    leather: { id: 'leather', name: 'Leather Greaves', kind: 'armour', kg: 1.2, price: 5, stack: 1, use: 'legs', desc: 'Boiled leather shaped to the shin, laced at the back. Made for reed-cuts and dog bites. The rats ate the old laces.' },
    splinted: { id: 'splinted', name: 'Splinted Greaves', kind: 'armour', kg: 3.0, price: 9, stack: 1, use: 'legs', desc: 'Watch splints riveted to leather, cut off an ork that had them buckled on anyhow. They clatter on stone.' },
    rag: { id: 'rag', name: 'Clean Rag Bandage', kind: 'consumable', kg: 0.1, price: 1, stack: 10, use: 'bleed', desc: 'Linen boiled clean and rolled tight. Stops bleeding and closes a little. Clean costs fuel: never waste one.' },
    scrap: { id: 'scrap', name: 'Iron Scrap', kind: 'material', kg: 0.6, price: 0.5, stack: 20, use: 'material', desc: 'Bent nails, hinge plates and chain links. Iron is not made in the Blackfen any more, only moved. Keep it from salt.' },
    salt: { id: 'salt', name: 'Salt Ration', kind: 'material', kg: 0.4, price: 1, stack: 20, use: 'money', desc: 'One measure, struck level and sewn in oiled cloth. Keeps meat through the Smothering and pays for nearly everything.' },
    timber: { id: 'timber', name: 'Seasoned Timber', kind: 'material', kg: 1.5, price: 1, stack: 10, use: 'material', desc: 'Dry wood, cut out of a roof somewhere. Nothing dries in the Blackfen now. Burn it or build with it, not both.' },
    oil: { id: 'oil', name: 'Flask of Lamp Oil', kind: 'material', kg: 0.9, price: 3, stack: 5, use: 'fuel', desc: 'Rendered eel and boar fat in an earthen flask. Fills a lantern or soaks a rag for fire. Keep it from the torch.' },
    pot: { id: 'pot', name: 'Cast-Iron Cooking Pot', kind: 'tool', kg: 4.5, price: 30, stack: 1, use: 'tool', desc: 'Cast slag-iron. It holds its heat for hours after the fire is banked. With a pot, a shelter can boil water, rags and stew.' },
    lime: { id: 'lime', name: 'Sack of Lime', kind: 'material', kg: 2.0, price: 2, stack: 5, use: 'throw', desc: 'Burned at the kiln for chimneys and graves. Thrown, it blinds what breathes it and stops spores. Keep out of the cloud yourself.' },
  };
  const KITS = {
    deserter: ['sword', 'targe', 'torch', 'rag', 'rag'],
    factor: ['spear', 'torch', 'rag', 'rag'],
    cleaner: ['targe', 'torch', 'rag', 'rag', 'rag', 'rag'],
    cutter: ['axe', 'torch', 'rag'],
    gutter: ['sword', 'torch', 'rag', 'rag'],
    priest: ['targe', 'torch', 'rag', 'rag', 'rag'],
    healer: ['spear', 'torch', 'rag', 'rag', 'rag', 'rag', 'rag'],
    carter: ['axe', 'targe', 'gambeson', 'torch', 'rag', 'rag'],
  };
  const CAP = { factor: 26, cutter: 23, gutter: 24 };   // [PROPOSED] weak back 4 kg less for the gutter-kin
  const TORCH = { gutter: 90, priest: 360 };
  // The engine's own tables are where the copied inventory, the worn slots and the weapon hand read from. These are
  // the same rows in those tables, under the item ids this phase uses. They are installed when the page loads.
  const ARMOUR_DEFS = {
    targe: { name: 'Wooden Targe', slot: 'shield', ar: 2, noise: 0.2, desc: 'Alder planks under boar rawhide, rimmed with a cut-down cart tyre.' },
    coif: { name: 'Padded Coif', slot: 'head', ar: 1, noise: 0, desc: 'Quilted linen worn under a helmet, kept after the helmet was lost.' },
    kettle: { name: 'Kettle Hat', slot: 'head', ar: 3, noise: 0.3, desc: 'A Watch helmet with a brim, dented and sweated through.' },
    gambeson: { name: 'Quilted Gambeson', slot: 'body', ar: 3, noise: 0, desc: 'Thirty layers of linen, a household\'s winter of stitching.' },
    mail: { name: 'Rusted Mail Hauberk', slot: 'body', ar: 8, noise: 1.0, desc: 'Crown mail from the Causeway tower, orange at every ring.' },
    leather: { name: 'Leather Greaves', slot: 'feet', ar: 1, noise: 0.1, desc: 'Boiled leather shaped to the shin, laced at the back.' },
    splinted: { name: 'Splinted Greaves', slot: 'feet', ar: 3, noise: 0.5, desc: 'Watch splints riveted to leather, cut off an ork.' },
  };
  const PLAIN_DEFS = {
    torch: { name: 'Pitch Torch', sprite: 'loot', use: 'light', stack: 1 },
    rag: { name: 'Clean Rag Bandage', sprite: 'loot', use: 'bleed', stack: 10 },
    scrap: { name: 'Iron Scrap', sprite: 'loot', use: 'material', stack: 20 },
    salt: { name: 'Salt Ration', sprite: 'loot', use: 'money', stack: 20 },
    timber: { name: 'Seasoned Timber', sprite: 'loot', use: 'material', stack: 10 },
    oil: { name: 'Flask of Lamp Oil', sprite: 'loot', use: 'fuel', stack: 5 },
    pot: { name: 'Cast-Iron Cooking Pot', sprite: 'loot', use: 'tool', stack: 1 },
    lime: { name: 'Sack of Lime', sprite: 'loot', use: 'throw', stack: 5 },
  };
  // the kit in the engine's terms: the weapon hand, the worn slots, and the bag
  const WEAPON_KIT = { sword: 'sword', spear: 'spear', axe: 'axe' };
  const ARMOUR_KIT = { targe: 'targe', gambeson: 'gambeson' };
  function gear(bg) {
    const ids = kit(bg), weapons = [], items = [], armor = {};
    for (const id of ids) {
      if (WEAPON_KIT[id]) { if (!weapons.includes(WEAPON_KIT[id])) weapons.push(WEAPON_KIT[id]); continue; }
      if (ARMOUR_KIT[id]) { armor[ARMOUR_DEFS[id].slot] = id; items.push({ id, n: 1 }); continue; }
      const at = items.find((s) => s.id === id); if (at) at.n++; else items.push({ id, n: 1 });
    }
    return { bg, ids, weapons, items, armor, kg: +kitWeight(bg).toFixed(2), fuel: torchFuel(bg) };
  }
  // Put a kit on a plain player object. Pure: no browser, no clock. The wire calls this for creation, succession and a
  // save written before Phase 17.
  function applyTo(p, bg) {
    const g = gear(bg); if (!p) return g;
    p.inv = g.items.map((s) => ({ id: s.id, n: s.n }));
    p.weapons = g.weapons.length ? g.weapons.slice() : ['hands'];
    p.weapon = 0; p.armor = Object.assign({}, g.armor);
    p.pellets = 0; p.bolts = 0;
    return g;
  }
  function installData() {
    // The engine's ITEMS and ARMOR are the top-level lexical tables in js/data.js. The local table is ITEM_ROWS, so
    // these names reach the engine and the kit never overwrites its own weights and prices.
    if (typeof ITEMS === 'undefined' || typeof ARMOR === 'undefined') return false;
    for (const id in ARMOUR_DEFS) { const a = ARMOUR_DEFS[id]; ARMOR[id] = Object.assign({}, a); ITEMS[id] = Object.assign({ sprite: 'gear', armor: true }, a); }
    for (const id in PLAIN_DEFS) ITEMS[id] = Object.assign({}, PLAIN_DEFS[id]);
    return true;
  }
  const item = (id) => ITEM_ROWS[id] || null;
  const kit = (bg) => (KITS[bg] || KITS.deserter).slice();
  const weight = (ids) => (Array.isArray(ids) ? ids : []).reduce((n, id) => n + (ITEM_ROWS[id] ? ITEM_ROWS[id].kg : 0), 0);
  const kitWeight = (bg) => weight(kit(bg));
  const capacity = (bg) => CAP[bg] || LIMIT;
  function burden(kg, bg) {
    const n = Math.max(0, +kg || 0), cap = capacity(bg);
    if (n < FREE) return 'free';
    if (n <= cap) return 'burdened';
    return 'over';
  }
  const pace = (kg, bg) => (burden(kg, bg) === 'free' ? 1 : burden(kg, bg) === 'burdened' ? 0.9 : 0.7);
  const noise = (kg, bg) => (burden(kg, bg) === 'free' ? 0 : burden(kg, bg) === 'burdened' ? 1 : 2);
  const canSprint = (kg, bg) => burden(kg, bg) === 'free';
  const canDodge = (kg, bg) => burden(kg, bg) !== 'over';
  const torchFuel = (bg) => TORCH[bg] || 240;
  const canHold = (a, b) => !(a === 'light' && b === 'light');
  const price = (id) => (ITEM_ROWS[id] ? ITEM_ROWS[id].price : 0);
  const heal = () => false;          // no item in this table restores health
  const ranged = () => false;        // no ranged weapon is readied on this game's maps

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false;
  const here = () => typeof G !== 'undefined' && G && (G.mapId === LEDGE1.LEDGE || G.mapId === LEDGE1.BOTHY);
  const loadKg = () => (G && G.flags && G.flags.la_kit && isFinite(+G.flags.la_kit.kg) ? Math.max(0, +G.flags.la_kit.kg) : 0);
  const loadBg = () => (G && G.flags && BY_ID[G.flags.la_bg] ? G.flags.la_bg : 'deserter');
  const BY_ID = { deserter: 1, factor: 1, cleaner: 1, cutter: 1, gutter: 1, priest: 1, healer: 1, carter: 1 };
  function applyKit(p, bg) {
    const id = BY_ID[bg] ? bg : 'deserter', g = applyTo(p, id);
    if (!G || !G.flags) return g;
    G.flags.la_kit = { bg: id, ids: g.ids, kg: g.kg, fuel: g.fuel };
    // Phase 17 replaces the lantern's thousand-second oil with the kit's torch. It is still one light and one fuel
    // pool, so Phase 7's burn, guttering and the bloom's `lit` rule keep working without a second clock.
    G.flags.la_oil = g.fuel; G.flags.la_flasks = 0;
    try { if (typeof UPG !== 'undefined') UPG.lantern = false; } catch (e) { /* the light starts out */ }
    return g;
  }
  function wire() {
    if (wired || typeof window === 'undefined') return false;
    installData();
    // Creation and succession both go through PANEL10.applyBg. Wrapping it once covers the first card and the next
    // person at the hearth, and leaves the panel's own health figure alone.
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10.applyBg) {
        const _ab = PANEL10.applyBg;
        PANEL10.applyBg = function (id) { const r = _ab.apply(this, arguments); try { applyKit(G.player, id || (G.flags && G.flags.la_bg)); } catch (e) { /* the card stands */ } return r; };
      }
    } catch (e) { /* the panel keeps its kit */ }
    // choose() calls its own closed-over applyBg, so wrapping the exported applyBg alone does not reach creation.
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10.choose) {
        const _ch = PANEL10.choose;
        PANEL10.choose = function (id) { const r = _ch.apply(this, arguments); try { applyKit(G.player, id || (G.flags && G.flags.la_bg)); } catch (e) { /* the card stands */ } return r; };
      }
    } catch (e) { /* the panel keeps its kit */ }
    // The creation screen's own click handler closes over a local choose(), so the chosen card is also read here, after
    // the handler has run. This is the path a person actually takes with the mouse.
    if (typeof document !== 'undefined') document.addEventListener('click', (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest('#la-who [data-bg]') : null;
      if (!el) return;
      const id = el.dataset.bg; setTimeout(() => { try { applyKit(G.player, id); } catch (e) { /* the card stands */ } }, 0);
    }, true);
    // A save written before Phase 17 has no la_kit. Put the card's kit on it once, at load, and give it the torch.
    try {
      const _rg = restoreGame;
      restoreGame = function () {
        const r = _rg.apply(this, arguments);
        try {
          if (G.player && G.map && G.map._la && (!G.flags.la_kit || !G.flags.la_kit.fuel)) applyKit(G.player, G.flags.la_bg || 'deserter');
          else if (G.flags && G.flags.la_kit && G.flags.la_kit.fuel && G.flags.la_oil == null) G.flags.la_oil = G.flags.la_kit.fuel;
        } catch (e) { /* the old save keeps what it had */ }
        return r;
      };
    } catch (e) { /* the old save keeps its own kit */ }
    // Burden: a loaded walk is slower. The camera is the player in playerMove, so only that traveller is scaled.
    try {
      const _pm = playerMove;
      playerMove = function (o, dx, dy) {
        try { if (here() && o === Engine.cam) { const k = pace(loadKg(), loadBg()); return _pm.call(this, o, dx * k, dy * k); } } catch (e) { /* the engine's walk */ }
        return _pm.apply(this, arguments);
      };
    } catch (e) { /* the engine's walk */ }
    // Burden: the pack adds to the noise floor. Armour's own figure is kept and the extra is added after it.
    try {
      const _an = armorNoise;
      armorNoise = function (p) {
        const n = _an.apply(this, arguments);
        try { if (here()) return n + noise(loadKg(), loadBg()); } catch (e) { /* armour alone */ }
        return n;
      };
    } catch (e) { /* armour alone */ }
    // Burden: no sprint at or over the card's capacity. The engine reads Shift and alwaysRun inside update, so both
    // are held off for that one call and put back afterwards.
    try {
      const _up = update;
      update = function (dt) {
        let restore = null;
        try {
          if (here() && !canSprint(loadKg(), loadBg())) {
            restore = { alwaysRun: G.opts.alwaysRun, shift: !!G.keys.shift };
            G.opts.alwaysRun = false; G.keys.shift = false;
          }
        } catch (e) { restore = null; }
        try { return _up.apply(this, arguments); } finally { if (restore) { try { G.opts.alwaysRun = restore.alwaysRun; G.keys.shift = restore.shift; } catch (e) { /* the next key sets it */ } } }
      };
    } catch (e) { /* Shift still runs */ }
    // The torch in the bag is the same hand as U: using it lights or douses the one light.
    try {
      const _ui = useItem;
      useItem = function (slot) {
        try {
          if (slot && ITEM_ROWS[slot.id] && ITEM_ROWS[slot.id].use === 'light' && typeof LANTERN7 !== 'undefined' && LANTERN7.toggle) {
            closeModal(); G.state = 'play'; LANTERN7.toggle(); return;
          }
        } catch (e) { /* the item's own words */ }
        return _ui.apply(this, arguments);
      };
    } catch (e) { /* the item's own words */ }
    try {
      const _at = attack;
      attack = function () {
        if (here()) {
          const w = typeof currentWeapon === 'function' ? currentWeapon() : null;
          if (w && (w.ammo || w.ranged || w.type === 'bolt' || w.type === 'shot')) { msg('No ranged weapon is readied on this road.', '', 2200); return; }
        }
        return _at.apply(this, arguments);
      };
    } catch (e) { /* the engine's attack stands */ }
    wired = true;
    return true;
  }
  return { FREE, LIMIT, ITEMS: ITEM_ROWS, ITEM_ROWS, KITS, CAP, TORCH, ARMOUR_DEFS, PLAIN_DEFS, item, kit, weight, kitWeight, capacity, burden, pace, noise, canSprint, canDodge, torchFuel, canHold, price, heal, ranged, gear, applyTo, applyKit, installData, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KIT17;
if (typeof window !== 'undefined') KIT17.wire();
