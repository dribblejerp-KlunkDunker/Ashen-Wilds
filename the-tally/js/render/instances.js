// A preallocated instance batch. The hot path writes floats; it never creates an object
// per sprite or per frame (design 23.1). Layout:
// x, y, w, h, frame, r, g, b, a, flash, angle.
export const INSTANCE_FLOATS = 11;
export const INSTANCE_BYTES = INSTANCE_FLOATS * 4;

export function createInstanceBatch(capacity) {
  const data = new Float32Array(capacity * INSTANCE_FLOATS);
  const batch = {
    data,
    capacity,
    count: 0,
    begin() {
      batch.count = 0;
    },
    push(x, y, w, h, frame, r, g, b, a = 1, flash = 0, angle = 0) {
      if (batch.count >= capacity) return false;
      const o = batch.count * INSTANCE_FLOATS;
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = w;
      data[o + 3] = h;
      data[o + 4] = frame;
      data[o + 5] = r;
      data[o + 6] = g;
      data[o + 7] = b;
      data[o + 8] = a;
      data[o + 9] = flash;
      data[o + 10] = angle;
      batch.count++;
      return true;
    },
  };
  return batch;
}
