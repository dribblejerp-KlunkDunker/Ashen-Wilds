// Phase 36: the phone link. Opening the game with ?touch (or ?mobile) in the address, or on a device whose main pointer is
// a finger, starts the touch controls from the first frame: the thumb stick and buttons are there when play begins, and the
// opening "click the view to capture the mouse" line is not shown. Before this, touch mode waited for the first touch on the
// view. Options -> Controls -> Touch controls still rules: Off wins, and on Auto a real mouse moving hands control back.
// The README's "Play on your phone" button and QR code use the ?touch=1 link. Nothing here touches saves or gameplay.
(function () {
  'use strict';
  // ?touch, ?touch=1, ?mobile ... switch on; ?touch=0 / off / no / false switch nothing on
  function fromLink(search) {
    const m = /[?&](touch|mobile)(?:=([^&#]*))?(?:&|#|$)/i.exec(String(search || ''));
    if (!m) return false;
    return !/^(0|off|no|false)$/i.test(decodeURIComponent(m[2] || ''));
  }
  function fingerFirst() {
    try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
  }
  function wanted(search, coarse) { return fromLink(search) || !!coarse; }
  function apply() {
    if (typeof G === 'undefined' || typeof setTouchMode !== 'function' || !G.opts) return false;
    if (G.opts.touch === 'off') return false;
    let search = '';
    try { search = location.search; } catch (e) { /* file: */ }
    if (!wanted(search, fingerFirst())) return false;
    setTouchMode(true);
    return true;
  }
  window.TOUCHLINK36 = { fromLink, wanted, apply, applied: apply() };
})();
