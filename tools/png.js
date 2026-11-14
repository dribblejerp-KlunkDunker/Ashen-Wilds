// A PNG writer in a few lines (Node's own zlib; no dependency). Pixels are the engine's: Uint32, ABGR little-endian.
'use strict';
const zlib = require('zlib');
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
// encode(w, h, Uint32Array) -> Buffer; `scale` repeats every pixel (nearest), `bg` (a Uint32) is put behind clear pixels
function encode(w, h, data, opts) {
  const o = opts || {}, k = o.scale || 1, W = w * k, H = h * k, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1); raw[row] = 0;
    for (let x = 0; x < W; x++) {
      let v = data[((y / k) | 0) * w + ((x / k) | 0)]; if ((v >>> 24) < 128 && o.bg != null) v = o.bg;
      const i = row + 1 + x * 4; raw[i] = v & 255; raw[i + 1] = (v >> 8) & 255; raw[i + 2] = (v >> 16) & 255; raw[i + 3] = v >>> 24;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { encode };
