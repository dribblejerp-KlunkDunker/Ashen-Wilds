// Fixed 120 Hz simulation, rendered with interpolation (design 3.1, 23.1).
// A frame may run several steps; the draw gets alpha so it can lerp between them.

import { SIM_HZ, DT } from '../sim/tuning.js';

export function createLoop({ step, draw, hz = SIM_HZ, maxSteps = 5 }) {
  const dt = 1 / hz;
  let acc = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  let timeScale = 1;
  let alpha = 0;

  function frame(now) {
    if (!running) return;
    if (last === 0) last = now;
    let real = (now - last) / 1000;
    last = now;
    if (real > 0.25) real = 0.25;      // a tab that was away must not fast-forward the night
    acc += real * timeScale;

    let steps = 0;
    while (acc >= dt && steps < maxSteps) {
      step(dt);
      acc -= dt;
      steps++;
    }
    if (steps === maxSteps && acc >= dt) acc = dt;   // drop the debt, never spiral

    alpha = acc / dt;
    draw(alpha);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setTimeScale(s) { timeScale = s; },
    get alpha() { return alpha; },
    get dt() { return dt; },
  };
}

export { DT };
