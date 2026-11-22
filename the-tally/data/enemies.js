// Enemy data, design 13: "built from data". M1 shipped one type; the M3 vertical adds two of
// the sixteen kinds so the slice can test whether three answers in the horde is fun: the goblin
// scavenger (the surf), the walking bloom (a slow wall that grabs) and the ork shield (the line:
// hit it from the side, not the front). Health and damage are slice numbers to tune, not design
// values; speed and radius agree with the movement the feel gate already measures.

export const ENEMIES = {
  goblin: {
    id: 'goblin',
    name: 'Goblin scavenger',
    radius: 12,        // px
    speed: 1.55,       // tiles/s
    weight: 'light',   // feather | light | medium | heavy | immovable
    damage: 4,
    health: 10,
    // Steering is seek plus separation; the arc comes from the separation, not from a wander.
    steering: 'seek',
  },
  bloom: {
    id: 'bloom',
    name: 'Walking bloom',
    radius: 16,
    speed: 0.55,
    weight: 'medium',
    damage: 6,
    health: 34,
    // A slow sway toward the player; contact grabs and slows until a Watch Step breaks it.
    steering: 'sway',
    swayAmp: 0.55,     // radians of lateral sway
    swayRate: 1.7,     // rad/s
  },
  ork: {
    id: 'ork',
    name: 'Ork shield',
    radius: 18,
    speed: 0.8,
    weight: 'heavy',
    damage: 9,
    health: 88,
    // Advances behind a shield that turns slowly: front cuts are dulled, side cuts are not.
    steering: 'shield',
    turnRate: 1.1,     // rad/s the shield can turn
    blockArc: 2.2,     // radians of the front it covers
    blockScale: 0.35,  // damage multiplier from the front
  },
};
