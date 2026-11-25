// ============================================================
//  cards18 - Phase 18, the eight cards.
//
//  No classes and no levels. A person is what their card says: a knack and a flaw, with the figures the cards give
//  and a proposed figure wherever the card gives none. This file is the registry of those figures. Phase 17 owns
//  the weight and the kits; this phase owns what the hands, eyes and blood do.
//
//  Pure. The wire records the chosen card's effects, keeps XP and level at zero on this game's maps, and puts the
//  same registry on a successor's card. The numbers marked [PROPOSED] are ours, not the bible's.
// ============================================================
'use strict';

const CARDS18 = (() => {
  const ONE = { blocks: 1, untrained: 1, sworn: false, staminaMax: 1, staminaReturn: 1, bleed: 1, bandageSpeed: 1, bandageAmount: 1, sight: 1, hearing: 1, dodgeCost: 1, sprint: 1, search: 1, packNoise: 0, step: 0 };
  const ROWS = {
    // Drilled: cheaper blocks [PROPOSED 0.75]. Old wound: 90 health is Phase 10's card.
    deserter: { blocks: 0.75 },
    // Packhorse: 26 kg (Phase 17); a full pack clatters less [PROPOSED -1 noise step]. Bad knees: sprint 85%, dodge 30.
    factor: { packNoise: -1, sprint: 0.85, dodgeCost: 30 },
    // Quiet hands: searches a third faster [PROPOSED 0.67]. Untrained: attacks cost a third more, wear twice.
    cleaner: { search: 0.67, untrained: 1.333, wear: 2, step: -0.4 },
    // Strong back: 23 kg (Phase 17), heavy strikes +15%. Winded: 80 stamina, slower return [PROPOSED 0.85].
    cutter: { staminaMax: 0.8, staminaReturn: 0.85, heavy: 1.15 },
    // Soft-footed: steps carry a third less, dodges cost 16, a little further sight [PROPOSED 1.1]. Frail: 75 health,
    // wounds bleed half again as long.
    gutter: { bleed: 1.5, dodgeCost: 16, sight: 1.1, step: -0.34 },
    // Steady: 50 poise, stamina back a quarter faster. Sworn hands: no heavy blow.
    priest: { staminaReturn: 1.25, sworn: true, poise: 50 },
    // Deft: bandaging twice as fast and twice as much. Night-blind: sight at 60%.
    healer: { bandageSpeed: 2, bandageAmount: 2, sight: 0.6 },
    // Hardy: 120 health (Phase 10), wounds bleed a quarter less. One good ear: hearing at 70%.
    carter: { bleed: 0.75, hearing: 0.7 },
  };
  function effects(bg) {
    const row = ROWS[bg] || ROWS.deserter;
    return Object.assign({}, ONE, row);
  }
  const ids = Object.keys(ROWS);
  const stamina = (bg) => Math.round(100 * effects(bg).staminaMax);
  const bleedTime = (bg, base) => +(base * effects(bg).bleed).toFixed(2);
  const bandage = (bg, base) => ({ time: +(base / effects(bg).bandageSpeed).toFixed(2), amount: +(base * effects(bg).bandageAmount).toFixed(2) });
  const sight = (bg) => effects(bg).sight;
  const hearing = (bg) => effects(bg).hearing;
  const dodge = (bg) => effects(bg).dodgeCost;
  const sprint = (bg) => effects(bg).sprint;
  const search = (bg) => effects(bg).search;
  const packNoise = (bg) => effects(bg).packNoise;
  const heavy = (bg) => !effects(bg).sworn;
  const canBlock = (bg) => effects(bg).blocks <= 1;
  const noLevels = () => true;
  // A saved card's stamina runs on the same 100-point scale the cards use, but the engine's fatigue maximum is its
  // own figure (about 40). Scale that figure once, remember the base, and never scale it twice on a reload.
  function applyStats(p, flags, bg) {
    const e = effects(bg), f = flags || (typeof G !== 'undefined' && G && G.flags) || null;
    if (f) f.la_effects = e;
    if (p) {
      const base = f && f.la_fat_base > 0 ? f.la_fat_base : (p.fatMax > 0 ? p.fatMax : 1);
      if (f && !(f.la_fat_base > 0)) f.la_fat_base = base;
      p.fatMax = Math.max(1, Math.round(base * e.staminaMax));
      p.fat = Math.min(p.fat == null ? p.fatMax : p.fat, p.fatMax);
      p.level = 1; p.xp = 0; p.perkPoints = 0;
    }
    return e;
  }
  function fog(base, bg) { return +(Math.max(1, +base || 12) * effects(bg).sight).toFixed(2); }

  // ---------------------------------------------------------------- the wire (browser only)
  let wired = false;
  // Phase 40: any of this game's maps (G.map._la), not only the ledge and the bothy: the company walks on past them
  const here = () => !!(typeof G !== 'undefined' && G && G.map && G.map._la);
  const bgNow = () => (G && G.flags && ROWS[G.flags.la_bg] ? G.flags.la_bg : 'deserter');
  function applyFog(bg) {
    try {
      const m = G && G.map; if (!m || !m._la) return false;
      if (!(m._laFogBase > 0)) m._laFogBase = m.fogDist || 12;
      m.fogDist = fog(m._laFogBase, bg || bgNow()); return true;
    } catch (e) { return false; }
  }
  function applyToPlayer(bg) { if (G && G.player) applyStats(G.player, G.flags, bg); applyFog(bg); }
  function wire() {
    if (wired || typeof window === 'undefined') return false;
    // Creation and succession both pass through PANEL10.applyBg. This is the one card hook, so the first person and
    // the next person at the hearth get the same effects.
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10.applyBg) {
        const _ab = PANEL10.applyBg;
        PANEL10.applyBg = function (id) { const r = _ab.apply(this, arguments); try { applyToPlayer(id || (G.flags && G.flags.la_bg)); } catch (e) { /* the card stands */ } return r; };
      }
    } catch (e) { /* the panel keeps its card */ }
    // choose() has its own closed-over applyBg, so the creation path needs this wrapper too.
    try {
      if (typeof PANEL10 !== 'undefined' && PANEL10.choose) {
        const _ch = PANEL10.choose;
        PANEL10.choose = function (id) { const r = _ch.apply(this, arguments); try { applyToPlayer(id || (G.flags && G.flags.la_bg)); } catch (e) { /* the card stands */ } return r; };
      }
    } catch (e) { /* the panel keeps its card */ }
    // The card the creation screen actually clicked, after its own handler has run.
    if (typeof document !== 'undefined') document.addEventListener('click', (ev) => {
      const el = ev.target && ev.target.closest ? ev.target.closest('#la-who [data-bg]') : null;
      if (!el) return;
      const id = el.dataset.bg; setTimeout(() => { try { applyToPlayer(id); } catch (e) { /* the card stands */ } }, 0);
    }, true);
    try {
      const _xp = questXp;
      questXp = function (n) { if (here()) return; return _xp.apply(this, arguments); };
    } catch (e) { /* no XP on this road */ }
    try {
      const _cl = checkLevel;
      checkLevel = function () {
        if (here()) { if (G.player) { G.player.level = 1; G.player.xp = 0; G.player.perkPoints = 0; } return; }
        return _cl.apply(this, arguments);
      };
    } catch (e) { /* the engine's level path stands */ }
    if (typeof restoreGame === 'function') {
      const _rg = restoreGame;
      restoreGame = function () {
        const r = _rg.apply(this, arguments);
        try { if (G.player) { applyStats(G.player, G.flags, G.flags && G.flags.la_bg); applyFog(G.flags && G.flags.la_bg); } } catch (e) { /* the save keeps its numbers */ }
        return r;
      };
    }
    // Stamina recovery: the engine restores fatigue through needsRecovery() in update and in rest.
    try {
      const _nr = needsRecovery;
      needsRecovery = function () {
        const r = _nr.apply(this, arguments);
        try { if (here()) return r * effects(bgNow()).staminaReturn; } catch (e) { /* the engine's rate */ }
        return r;
      };
    } catch (e) { /* the engine's rate */ }
    // Pack noise and soft feet: the engine's armour noise is the floor the bloom hears.
    try {
      const _an = armorNoise;
      armorNoise = function (p) {
        const n = _an.apply(this, arguments);
        // audit fix: soft feet (e.step) are Phase 10's (P82); adding them here too counted them twice
        try { if (here()) { const e = effects(bgNow()); return n + e.packNoise; } } catch (e) { /* armour alone */ }
        return n;
      };
    } catch (e) { /* armour alone */ }
    // The cards' attack rules that the engine has a place for: Untrained costs more fatigue, Sworn hands refuses the
    // heavy two-handed blow. Wear is not tracked by this engine, so that half stays on the card.
    try {
      const _at = attack;
      attack = function () {
        try {
          if (here()) {
            const e = effects(bgNow()), w = typeof currentWeapon === 'function' ? currentWeapon() : null;
            if (e.sworn && w && w.twoHanded) { msg('Your oath forbids the heavy blow. You keep to the light weapon.', '', 2600); return; }
            const before = G.player.fat;
            const r = _at.apply(this, arguments);
            if (e.untrained > 1) { const spent = Math.max(0, before - G.player.fat); G.player.fat = Math.max(0, G.player.fat - spent * (e.untrained - 1)); }
            return r;
          }
        } catch (e) { /* the engine's swing */ }
        return _at.apply(this, arguments);
      };
    } catch (e) { /* the engine's swing */ }
    // Sight: the fog distance the renderer reads, before the weather multiplies it. Base is kept once per map.
    try {
      if (typeof Engine !== 'undefined' && Engine.setMap) {
        const _sm = Engine.setMap;
        Engine.setMap = function (m) {
          try { if (m && m._la) { if (!(m._laFogBase > 0)) m._laFogBase = m.fogDist || 12; m.fogDist = fog(m._laFogBase, bgNow()); } } catch (e) { /* the map's own fog */ }
          return _sm.apply(this, arguments);
        };
      }
    } catch (e) { /* the map's own fog */ }
    return wired = true;
  }
  return { ONE, ROWS, ids, effects, stamina, bleedTime, bandage, sight, hearing, dodge, sprint, search, packNoise, heavy, canBlock, noLevels, applyStats, fog, wire };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CARDS18;
if (typeof window !== 'undefined') CARDS18.wire();
