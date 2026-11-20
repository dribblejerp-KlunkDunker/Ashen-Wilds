// Input as named actions (design 23.6): keyboard, gamepad and touch. Mouse aiming arrives with
// Aimed Watch and is not a movement input. Every source ends up as one intent vector in [-1, 1]
// and one dodge press, so the simulation never knows where the input came from.

import { shapeStick } from '../sim/tuning.js';

const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];

function down(keys, list) {
  for (const k of list) if (keys.has(k)) return true;
  return false;
}

export function createInput(host) {
  const keys = new Set();
  const keyHandlers = [];
  let dodgeAt = -1;         // performance.now() of the last dodge press
  let pendingSince = -1;    // performance.now() when movement began from rest
  let wasMoving = false;    // the previous intent, so a latency is only timed on the rising edge
  let padPrevDodge = false;

  const touch = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0, active: false, dodgeId: -1 };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      dodgeAt = performance.now();
    }
    for (const fn of keyHandlers) fn(e.code, e);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
    touch.active = false;
    touch.dx = 0;
    touch.dy = 0;
  }

  // Touch: a floating stick on the left half, a dodge button on the right half.
  function onPointerDown(e) {
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < r.width * 0.5 && !touch.active) {
      touch.id = e.pointerId;
      touch.ox = e.clientX;
      touch.oy = e.clientY;
      touch.dx = 0;
      touch.dy = 0;
      touch.active = true;
      host.setPointerCapture?.(e.pointerId);
    } else if (x >= r.width * 0.5) {
      touch.dodgeId = e.pointerId;
      dodgeAt = performance.now();
    }
  }

  function onPointerMove(e) {
    if (e.pointerId !== touch.id) return;
    const max = 70;
    let dx = e.clientX - touch.ox;
    let dy = e.clientY - touch.oy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    touch.dx = dx / max;
    touch.dy = dy / max;
  }

  function onPointerUp(e) {
    if (e.pointerId === touch.id) {
      touch.id = -1;
      touch.active = false;
      touch.dx = 0;
      touch.dy = 0;
    }
    if (e.pointerId === touch.dodgeId) touch.dodgeId = -1;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerUp);

  function keyboardVector() {
    let x = 0;
    let y = 0;
    if (down(keys, LEFT)) x -= 1;
    if (down(keys, RIGHT)) x += 1;
    if (down(keys, UP)) y -= 1;
    if (down(keys, DOWN)) y += 1;
    const d = Math.hypot(x, y);
    if (d === 0) return { x: 0, y: 0 };
    return { x: x / d, y: y / d };   // diagonals normalised, same top speed
  }

  function padVector() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const mag = Math.hypot(ax, ay);
      const dodgeNow = !!(pad.buttons[0] && pad.buttons[0].pressed);
      if (dodgeNow && !padPrevDodge) dodgeAt = performance.now();
      padPrevDodge = dodgeNow;
      if (mag < 0.08 && !dodgeNow) continue;
      const shaped = shapeStick(mag);
      if (mag === 0 || shaped === 0) return { x: 0, y: 0 };
      return { x: (ax / mag) * shaped, y: (ay / mag) * shaped };
    }
    padPrevDodge = false;
    return null;
  }

  function touchVector() {
    if (!touch.active) return { x: 0, y: 0 };
    const mag = Math.hypot(touch.dx, touch.dy);
    const shaped = shapeStick(mag);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: (touch.dx / mag) * shaped, y: (touch.dy / mag) * shaped };
  }

  return {
    intent() {
      const pad = padVector();
      const kb = keyboardVector();
      let v = { x: 0, y: 0 };
      if (pad && Math.hypot(pad.x, pad.y) > 0.001) v = pad;
      else if (kb.x !== 0 || kb.y !== 0) v = kb;
      else {
        const tv = touchVector();
        if (tv.x !== 0 || tv.y !== 0) v = tv;
      }

      // Time a press only on the edge out of rest. Re-timing every frame would leave a stale
      // stamp behind, and the tail of a deceleration would be charged to it.
      const moving = v.x !== 0 || v.y !== 0;
      if (moving && !wasMoving) pendingSince = performance.now();
      if (!moving) pendingSince = -1;
      wasMoving = moving;
      return v;
    },
    takeDodge() {
      if (dodgeAt < 0) return false;
      dodgeAt = -1;
      return true;
    },
    get pendingSince() { return pendingSince; },
    clearPending() { pendingSince = -1; },
    onKey(fn) { keyHandlers.push(fn); },
    get keys() { return keys; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
