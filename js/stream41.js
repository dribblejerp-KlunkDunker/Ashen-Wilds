// ============================================================
//  stream41 - Phase 41, streaming: one map as big as a zone, drawn a piece at a time.
//
//  O19 wants a zone walked as one open country, with nothing between its squares; O17 measured why one map could not be
//  a square mile (docs/engine-limits.md): the 3D renderer drew the whole map as one mesh every frame, rebuilt all of it
//  for any change, hashed every cell every frame, and cleared and sent a light map of every cell every frame. Phase 41
//  changes the copied renderer itself (js/r3d21.js, and one line of js/light21.js), because none of that can be reached
//  from outside it:
//
//    * a map of more than 65,536 cells is built in chunks of 64 x 64 cells; only the chunks within the fog's reach of
//      the eye (fog distance + 48 cells, at least 96) are built, kept and drawn; the nearest at once, the rest a few
//      milliseconds a frame; a chunk left far behind is let go;
//    * a change rebuilds the chunks it touches, not the map: this file wraps GameMap's own setters so that they list
//      what they change (m._r3dDirty) and count it (m._r3dVer); one built chunk a frame is hashed again besides, for a
//      write that went round the setters;
//    * the point lights' map is cleared and sent only where the lights were and are, not over the whole map;
//    * the sun's heights are rebuilt when the map's count of changes moves, not by hashing it twice a second;
//    * the far plane reaches as far as is drawn.
//
//  A smaller map, and every map with the switch off, is built whole, byte for byte as before (tested).
//  The switch (Options) "Stream large maps": off, every map is built whole, as before this phase.
//
//  Plain ASCII. No random number and no clock.
// ============================================================
'use strict';

const STREAM41 = (() => {
  const TX = {
    switchName: 'Stream large maps',
    switchWhat: 'A big map is drawn a piece at a time, near you first. Off: every map is built whole, as before (slow for a big one)',
  };
  const ST = { marks: 0, wrapped: false };
  // mark a rectangle of cells [x0, x1) x [y0, y1) as changed, on a map the renderer is streaming
  function mark(m, x0, y0, x1, y1) {
    if (!m || !m._r3dStream) return;
    (m._r3dDirty || (m._r3dDirty = [])).push([x0 | 0, y0 | 0, x1 | 0, y1 | 0]);
    m._r3dVer = (m._r3dVer | 0) + 1;
    ST.marks++;
  }
  function wrap() {
    if (ST.wrapped || typeof GameMap === 'undefined') return false;
    const P = GameMap.prototype;
    // set: one cell (block, lowWall, rect, clear and border all come through it)
    const _set = P.set;
    P.set = function (x, y, c) { const r = _set.apply(this, arguments); mark(this, x, y, x + 1, y + 1); return r; };
    const _sf = P.setFloor;
    P.setFloor = function (x, y, idx) { const r = _sf.apply(this, arguments); mark(this, x, y, x + 1, y + 1); return r; };
    // the ground's corners and the cells they slope (hill and ramp come through syncSlopes)
    const _ss = P.syncSlopes;
    P.syncSlopes = function (x0, y0, x1, y1) { const r = _ss.apply(this, arguments); mark(this, x0, y0, x1 + 1, y1 + 1); return r; };
    if (P.setSide) {
      const _sd = P.setSide;
      P.setSide = function (x0, y0, x1, y1) { const r = _sd.apply(this, arguments); mark(this, x0, y0, x1 + 1, y1 + 1); return r; };
    }
    ST.wrapped = true;
    return true;
  }
  function wire() {
    if (typeof window === 'undefined' || typeof LEDGE1 === 'undefined') return false;
    wrap();
    LEDGE1.SWITCHES.push(['laStream', TX.switchName, TX.switchWhat]);
    return true;
  }
  const wired = wire();
  return { TX, mark, wrap, state: () => ST, wired };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = STREAM41;
