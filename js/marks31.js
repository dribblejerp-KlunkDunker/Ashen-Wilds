// ============================================================
//  marks31 - Phase 31, the five marks on slag-iron.
//
//  Source: the-round-and-the-long-account.md, "Marks" and "Workings and marks in play". Only slag-iron
//  takes a mark; one blade takes one mark; it holds for one landing and is renewed at the hearth fire.
//  The names, effects and catches are the lore's. Damage numbers, where the lore gives none, are absent.
// ============================================================
'use strict';

const MARKS31 = (() => {
  const DURATION = 'one landing';
  const ROWS = [
    { id: 'glim', name: 'Glim', effect: 'the blade is a dim light, freeing the left hand for a shield', catch: 'you are lit whenever it is drawn' },
    { id: 'keen', name: 'Keen', effect: 'ignores part of armour and hide', catch: 'the blade wears twice as fast' },
    { id: 'rime', name: 'Rime', effect: 'a wounded beast moves slower for a few seconds', catch: 'the wielder\'s breath returns slower' },
    { id: 'ember', name: 'Ember', effect: 'sears a bleed shut and burns spores at a touch', catch: 'it glows orange and cannot be sheathed while hot' },
    { id: 'dull-voice', name: 'Dull-voice', effect: 'a wall clang carries half as far', catch: 'the blade lodges more often' }
  ];
  const byId = (id) => ROWS.find((r) => r.id === id) || null;

  function apply(blade, mark, o) {
    o = o || {};
    const m = byId(mark);
    if (!blade || !m || !(o.warmth > 0)) return null;
    blade.mark = mark; blade.markLeft = DURATION;
    return { mark, effect: m.effect, catch: m.catch, left: DURATION };
  }
  function renew(blade, o) {
    o = o || {};
    if (!blade || !blade.mark || !o.fire) return null;
    return apply(blade, blade.mark, { warmth: o.warmth == null ? 1 : o.warmth });
  }
  function endLanding(blade) {
    if (!blade) return null;
    const was = blade.mark || null;
    blade.mark = null; blade.markLeft = 0;
    return was;
  }
  const oneMark = (blade) => !!(blade && blade.mark);
  return { DURATION, ROWS, byId, apply, renew, endLanding, oneMark };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MARKS31;
