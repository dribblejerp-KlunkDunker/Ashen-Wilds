// The Tally - every number the movement comes from, in one place.
// Source: design.md section 3 (movement) and section 6 (growth). The step code reads these;
// it never hard-codes a number. Units are tiles and seconds for design values, pixels for the
// simulation (1 tile = 64 px at the 1920x1080 reference view).

export const TILE = 64;
export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;
export const VIEW = { w: 1920, h: 1080 };

export const MOVE = {
  maxSpeed: 4.0,       // tiles/s, base top speed; characters vary +/-15% later
  accelTime: 0.070,    // s, rest to top
  decelTime: 0.055,    // s, top to zero
  reverseTime: 0.090,  // s, full reverse, no slowdown arc
  deadZone: 0.18,      // stick radial dead zone
  outer: 0.95,         // stick outer edge
  exponent: 1.4,       // stick response exponent
  hurtRadius: 14,      // px, circle hurtbox on a 64 px sprite
  leadTiles: 1.5,      // camera lead in the direction of travel
  cameraOmega: 14,     // camera: critically damped, no overshoot
};

export const STEP = {
  distance: 3.0,       // tiles in 0.18 s
  duration: 0.18,      // s
  iframes: 0.22,       // s from the dash start; the window is longer than the move
  cooldown: 2.4,       // s from the dash start, one charge
  buffer: 0.120,       // s a press is remembered
  perfectSlow: 0.040,  // s of slow motion on a perfect step
  perfectScale: 0.25,  // time scale during it
};

export const GOBLIN = {
  speed: 1.55,          // tiles/s
  radius: 12,           // px
  separationRange: 1.1, // tiles
  separationPush: 26,   // px/s at contact
  maxNeighbours: 8,     // from the spatial hash
  bodyPush: 0.35,       // share of a player-goblin overlap the player takes
  hashCell: 2,          // tiles, the spatial hash cell (design 23.1)
};

export const EMBER = {
  reach: 1.5,  // tiles. PLACEHOLDER: the Reach stat has no default in the design yet.
  snap: 0.5,   // tiles: they snap at the last half tile
  radius: 6,
  cap: 400,    // above this on the ground, new embers merge into the nearest
};

export const MAX_SPEED_PX = MOVE.maxSpeed * TILE;
export const ACCEL_PX = MAX_SPEED_PX / MOVE.accelTime;
export const DECEL_PX = MAX_SPEED_PX / MOVE.decelTime;
// A full reverse is +S to -S, so the distance in velocity space is twice the top speed.
export const REVERSE_PX = (2 * MAX_SPEED_PX) / MOVE.reverseTime;
export const DASH_PX = (STEP.distance * TILE) / STEP.duration;

// Growth inside a run, design 6: 5 + 10*L below 20, then +13 a level, then +16 from 40.
export function xpNeed(level) {
  if (level < 20) return 5 + 10 * level;
  if (level < 40) return 195 + 13 * (level - 19);
  return 455 + 16 * (level - 39);
}

// Levels 20 and 40 give a one-time +100% Growth for that level only: the second wind.
export function isSecondWind(level) {
  return level === 20 || level === 40;
}

// Stick shaping: radial dead zone, outer edge, response exponent 1.4 (design 3.1).
export function shapeStick(magnitude) {
  const m = (magnitude - MOVE.deadZone) / (MOVE.outer - MOVE.deadZone);
  const c = Math.min(1, Math.max(0, m));
  return Math.pow(c, MOVE.exponent);
}
