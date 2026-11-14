// ============================================================
//  fork0 - Phase 0, "the fork": what the engine still asks of story files this game does not carry.
//
//  The Long Account runs on the engine of Echoes of the Shattered Octave (copied at that repository's commit
//  f2b3990, branch phase-75-pixel-folk). The engine's core files (js/game.js, js/data.js, js/maps.js and a few
//  others) call a handful of functions that lived in that game's story modules (js/grove.js, js/coda.js,
//  js/wilds.js). Those modules are not in this repository. Each name below answers the way the original does
//  when its story is not running: nothing happens, nothing is handled, damage passes through unchanged.
//
//  Loaded just before js/game.js. No state, no saves, no random numbers.
// ============================================================
'use strict';

// js/grove.js
function startPart3() {}
function wgTick() {}
function chordBlast() {}
function aegisDestroyed() {}
function talkCat() {}
function talkLamplighter() {}
function talkBettis() {}
function wgPickUp() { return false; }
function bookOneEnd1() {}
function drownedShriek() {}
function enemyHitFx() {}
function enemyExtra() { return false; }
function wgBossDown() { return false; }
function wgUse() { return false; }
function wgTrigger() { return false; }
// js/coda.js
const RING = { cx: 0, cy: 0, r: 0, bx: 0, by: 0, lamps: 0, parts: 0, strike: 0 };
function placeSet() { return null; }
function codaTick() {}
function codaHitFx() {}
function codaShield(e, dmg) { return dmg; }
function codaBossDown() { return false; }
function codaCheckHerald() { return false; }
function codaUse() { return false; }
function codaCutter() {}
function codaTrigger() { return false; }
function ringPos() { return { x: 0, y: 0 }; }
function ringLyraHidden() { return false; }
function ringSync() {}
function ringPlan() { return []; }
function codaHerald() {}
// js/wilds.js
function wildsTick() {}
function wildsSilenced() { return false; }
function wildsBossDown() { return false; }
function wildsDispatch() {}
function wildsPartyCome() {}
function wildsTalk() { return false; }
function wildsCantQuiz() {}
function wildsUse() { return false; }
function wildsTrigger() { return false; }
