// The drawing-buffer budget. The scene is a 2D horde drawn with overdraw, so on a Chromebook it is
// fill-bound long before the simulation is: a 4K or 2x panel can cost four times the pixels for a
// picture that is already soft. The buffer is capped at 1080p worth of pixels and the compositor
// stretches it back to the panel; DOM text is not in the buffer, so the UI stays crisp.
//
// The stepper is the second half: if even the budgeted buffer misses the frame, the scene gives up
// resolution in steps and takes it back only after a long clean stretch. It never touches the
// simulation, so the gate still measures the same world.

export const MAX_PIXELS = 1920 * 1080;
export const MIN_QUALITY = 0.6;

// The same 20 ms a capture counts as a missed frame (design 23.4), so the stepper and the gate
// agree on what "slow" means.
const SLOW_MS = 20;
const SLOW_FRAMES = 30;     // about half a second of missed frames before giving ground
const FAST_FRAMES = 240;    // about four seconds of clean frames before taking any back
const DROP = 0.88;
const RISE = 1.06;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// The share of device pixels that fits the budget. 1 means the panel's own buffer is small enough;
// below 1 the buffer is smaller than the panel and is drawn stretched.
export function budgetScale(clientWidth, clientHeight, dpr, maxPixels = MAX_PIXELS) {
  const pixels = Math.max(1, clientWidth) * Math.max(1, clientHeight) * dpr * dpr;
  if (pixels <= maxPixels) return 1;
  return Math.sqrt(maxPixels / pixels);
}

export function createQualityStepper(minQuality = MIN_QUALITY) {
  const min = clamp(minQuality, 0.4, 1);
  let slow = 0;
  let fast = 0;
  let ceiling = 1;

  return {
    // One call per rendered frame, with the interval since the previous draw.
    sample(frameMs, quality) {
      if (!(frameMs > 0)) return quality;

      if (frameMs > SLOW_MS) {
        slow++;
        fast = 0;
      } else {
        // Every frame that is not a miss counts toward recovery. A band between "a full frame"
        // and "1.4 frames" left a 50 Hz panel, or a scale given up for a one-off stall, stuck
        // below full resolution for the rest of the session.
        fast++;
        slow = 0;
      }

      if (slow >= SLOW_FRAMES) {
        slow = 0;
        if (quality > min) {
          // Remember that this scale was too much: recovery stops just below it instead of
          // climbing back to the same failure.
          ceiling = quality * 0.95;
          return Math.max(min, quality * DROP);
        }
        return quality;
      }

      if (fast >= FAST_FRAMES) {
        fast = 0;
        if (quality < ceiling) return Math.min(ceiling, quality * RISE);
      }
      return quality;
    },
    // A resize is a new workload: forget the failure and let the scene try full quality again.
    reset() {
      slow = 0;
      fast = 0;
      ceiling = 1;
    },
  };
}
