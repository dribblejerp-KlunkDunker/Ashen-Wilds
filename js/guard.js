// guard — blocking and parrying that actually work (Phase 10 integration).
// The game has always promised "F to block and parry" (help text, Controls, the Combat roadmap) and has triggerBlock()
// and UPG.parryWindow / UPG.parryCool, but nothing ever counted the timers down or read them when a blow landed.
// This module makes the guard real, with no new state and nothing saved:
//   - F (or the rebound block key, read by motion10.js) raises the guard via the existing triggerBlock();
//   - for the first parryWindow seconds (0.28 s, 0.40 s with the Parry Master perk) a melee blow is turned aside: no damage;
//   - after that, while the guard is still up (until parryCool runs out), a melee blow is blocked: half damage, a third with
//     a shield worn. Crossbow bolts, traps, falls and Songs are never blocked.
// The timers tick here every frame of play; motion10.js only ticks them itself when this module is absent.
'use strict';

const GUARD = (() => {
  const st = { inMelee: false, parried: 0, blocked: 0 };
  function shieldWorn() {
    try { return typeof worn === 'function' && !!worn('shield') && !(typeof shieldBlocked === 'function' && shieldBlocked()); } catch (e) { return false; }
  }
  function wire() {
    if (typeof enemyUpdate === 'function') {
      const _eu = enemyUpdate;
      enemyUpdate = function (e) {
        const melee = !!(e && e.kind === 'enemy' && e.def && !e.def.crossbow);
        const was = st.inMelee; st.inMelee = melee;
        try { return _eu.apply(this, arguments); } finally { st.inMelee = was; }
      };
    }
    if (typeof damagePlayer === 'function') {
      const _dp = damagePlayer;
      damagePlayer = function (dmg, src) {
        if (st.inMelee && typeof UPG !== 'undefined' && UPG.blocking && UPG.parryCool > 0 && G.state === 'play') {
          if (UPG.parryWindow > 0) {
            st.parried++;
            try { msg('You turn the blow aside.', 'good', 1600); Audio_.sfx.swing(); } catch (e) { /* no HUD */ }
            return;
          }
          st.blocked++;
          dmg = Math.max(1, Math.round(dmg * (shieldWorn() ? 0.33 : 0.5)));
        }
        return _dp.call(this, dmg, src);
      };
    }
    if (typeof update === 'function') {
      const _up = update;
      update = function (dt) {
        if (typeof UPG !== 'undefined' && G.state === 'play' && dt > 0) {
          if (UPG.parryWindow > 0) UPG.parryWindow = Math.max(0, UPG.parryWindow - dt);
          if (UPG.parryCool > 0) { UPG.parryCool = Math.max(0, UPG.parryCool - dt); if (UPG.parryCool === 0) UPG.blocking = false; }
        }
        return _up.apply(this, arguments);
      };
    }
  }
  wire();
  return { state: st, shieldWorn };
})();
if (typeof window !== 'undefined') window.GUARD = GUARD;
