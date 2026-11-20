// Enemy data, design 13: "built from data". M1 ships one type.
// The goblin is a canon Ashbound creature: fast, weak, arrives in arcs, never in a straight line.

export const ENEMIES = {
  goblin: {
    id: 'goblin',
    name: 'Goblin scavenger',
    radius: 12,        // px
    speed: 1.55,       // tiles/s
    weight: 'light',   // feather | light | medium | heavy | immovable
    damage: 4,
    // Steering is seek plus separation; the arc comes from the separation, not from a wander.
    steering: 'seek',
  },
};
