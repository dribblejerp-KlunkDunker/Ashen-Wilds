// The engine's table of embedded pictures. It is empty on purpose: this game ships no picture it did not make.
// Every tile, person, thing and hand is painted in code by js/art2.js (and the ledge's own tiles by js/ledge1.js).
// The engine still reads this table at start (Engine.loadAll), finds nothing, and goes on.
'use strict';
const ASSETS = { tex: {}, spr: {}, fp: {}, meta: {} };
