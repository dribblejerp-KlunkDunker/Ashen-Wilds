// A soft bell for the perfect step (design 3.2). This is a stub on purpose: the real mix is
// `js/audio.js` in The Long Account, and that file is not in this worktree, so it cannot be
// wired yet. When it arrives, this becomes a routed effect through its voice limiter.

let ctx = null;

export function softBell() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.45);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  } catch (err) {
    // No audio yet is not an error the game should stop for.
  }
}
