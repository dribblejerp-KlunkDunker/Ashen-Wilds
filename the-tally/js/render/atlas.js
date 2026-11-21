// The M2 placeholder atlas. It is generated at runtime, so the first slice needs no binary
// art and no build step. Each cell is white where the tint should show; the dark marks stay
// dark after the tint multiply. The real 8-direction sheets arrive in M3.

export const FRAME_COUNT = 3;
const CELL = 64;
export const FRAMES = {
  goblin: 0,
  player: 1,
  wall: 2,
};

export function createAtlas(gl) {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * FRAME_COUNT;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Goblin: a squat body, two ears and dark eyes. The body is white so the instance tint
  // decides the colour; the eyes and outline stay dark.
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(32, 36, 20, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 26);
  ctx.lineTo(8, 12);
  ctx.lineTo(26, 21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48, 26);
  ctx.lineTo(56, 12);
  ctx.lineTo(38, 21);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.arc(25, 33, 2.5, 0, Math.PI * 2);
  ctx.arc(39, 33, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Player: a bone disc with a dark centre.
  ctx.save();
  ctx.translate(CELL, 0);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(32, 32, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(32, 32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Wall: a plain tile with darker lips. The wall instances stretch it into a bar.
  ctx.save();
  ctx.translate(CELL * 2, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, CELL, 6);
  ctx.fillRect(0, CELL - 6, CELL, 6);
  ctx.restore();

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}
