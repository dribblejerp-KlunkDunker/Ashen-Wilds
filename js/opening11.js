// ============================================================
//  opening11 - Phase 11, the opening look.
//
//  The prologue opens on the ledge facing west. The Slagcrown and the coal sun are in front of you, and the
//  errand is not given until you have actually looked at them: the great tower held near the middle of the
//  view for about two seconds, counted up across glances rather than demanded in one unbroken stare (O11).
//
//  This file is only the rule. It knows nothing about maps, cameras or saves; js/ledge1.js feeds it the
//  camera's bearing once a frame and gives the journal line when the rule says the look is done. Keeping it
//  separate is what lets the same rule be tested without a browser, and lets a second player's look be added
//  with combine() when the co-op phase is wired.
//
//  Plain ASCII. No clock and no random number: the caller supplies the time.
// ============================================================
'use strict';

const OPENING11 = (() => {
  const HOLD = 2.0;                 // seconds of looking, added up
  const CONE = Math.PI / 12;        // 15 degrees either side of the middle

  const TAU = Math.PI * 2;
  function norm(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  const bearing = (x, y, tx, ty) => Math.atan2(ty - y, tx - x);

  function make() { return { t: 0, seen: false }; }

  // Add this frame's time if the bearing is inside the cone. Looking away does not erase what was counted.
  function step(s, yaw, target, dt) {
    if (!s || typeof s !== 'object') s = make();
    if (s.seen || !(dt > 0) || !isFinite(dt) || !isFinite(yaw) || !isFinite(target)) return s;
    if (Math.abs(norm(yaw - target)) <= CONE + 1e-12) {
      s.t = Math.min(HOLD, s.t + dt);
      if (s.t >= HOLD) s.seen = true;
    }
    return s;
  }

  const progress = (s) => (s && s.seen ? 1 : s ? Math.min(1, s.t / HOLD) : 0);
  const seen = (s) => !!(s && s.seen);

  // Every watcher must have looked. The slowest one sets the progress; an empty list has looked at nothing.
  function combine(list) {
    const all = Array.isArray(list) ? list : Array.prototype.slice.call(arguments);
    if (!all.length) return make();
    let t = HOLD, done = true;
    for (const s of all) { t = Math.min(t, s ? s.t : 0); done = done && seen(s); }
    return { t: done ? HOLD : t, seen: done };
  }

  return { HOLD, CONE, make, step, progress, seen, combine, bearing, norm };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OPENING11;
