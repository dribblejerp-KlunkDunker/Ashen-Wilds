// The slice's effects: sparks and cut marks in a preallocated pool the M2 renderer already
// knows how to draw. Nothing here allocates after creation. Alpha rides on the instance tint,
// so a particle fades instead of vanishing when its life runs out.

export const TINT = Object.freeze({ ember: 0, pale: 1, teal: 2, bone: 3 });
export const PARTICLE_CAP = 512;

export function createParticles(capacity = PARTICLE_CAP) {
  return {
    capacity,
    count: 0,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    vx: new Float32Array(capacity),
    vy: new Float32Array(capacity),
    size: new Float32Array(capacity),
    life: new Float32Array(capacity),
    maxLife: new Float32Array(capacity),
    alpha: new Float32Array(capacity),
    tint: new Uint8Array(capacity),
  };
}

export function spawnParticle(pool, rand, x, y, vx, vy, size, tint, life) {
  let i;
  if (pool.count < pool.capacity) {
    i = pool.count++;
  } else {
    i = Math.floor(rand() * pool.capacity);   // full: replace a random spark
  }
  pool.x[i] = x;
  pool.y[i] = y;
  pool.vx[i] = vx;
  pool.vy[i] = vy;
  pool.size[i] = size;
  pool.life[i] = life;
  pool.maxLife[i] = life;
  pool.alpha[i] = 1;
  pool.tint[i] = tint;
}

export function burst(pool, rand, x, y, count, speed, tint, life) {
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const s = speed * (0.35 + rand() * 0.65);
    spawnParticle(pool, rand, x, y, Math.cos(angle) * s, Math.sin(angle) * s,
      2 + rand() * 3, tint, life * (0.7 + rand() * 0.6));
  }
}

export function stepParticles(pool, dt) {
  for (let i = pool.count - 1; i >= 0; i--) {
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      const last = --pool.count;
      if (i !== last) {
        pool.x[i] = pool.x[last];
        pool.y[i] = pool.y[last];
        pool.vx[i] = pool.vx[last];
        pool.vy[i] = pool.vy[last];
        pool.size[i] = pool.size[last];
        pool.life[i] = pool.life[last];
        pool.maxLife[i] = pool.maxLife[last];
        pool.alpha[i] = pool.alpha[last];
        pool.tint[i] = pool.tint[last];
      }
      continue;
    }
    pool.x[i] += pool.vx[i] * dt;
    pool.y[i] += pool.vy[i] * dt;
    pool.alpha[i] = Math.min(1, pool.life[i] / (pool.maxLife[i] * 0.6));
  }
}

// One player light: the tallow glow the design gives the player, which the GL path otherwise
// has no source for.
export function createLights(capacity = 1) {
  return {
    capacity,
    count: 1,
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    radius: new Float32Array(capacity),
    intensity: new Float32Array(capacity),
    r: new Float32Array(capacity),
    g: new Float32Array(capacity),
    b: new Float32Array(capacity),
  };
}
