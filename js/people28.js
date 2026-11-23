// ============================================================
//  people28 - Phase 28, people remember.
//
//  A person is morale, memory and a name. Help raises morale; robbing lowers it; a spare is remembered; a
//  killing ends the person. Dialogue text is caller-supplied until the owner rules on the gated script.
// ============================================================
'use strict';

const PEOPLE28 = (() => {
  const make = (name) => ({ name: String(name || 'a walker'), morale: 5, memory: [], dead: false, gone: false });

  function act(p, what) {
    if (!p || p.dead) return false;
    what = String(what || '');
    if (what === 'help') { p.morale = Math.min(10, p.morale + 1); p.memory.push('helped'); }
    else if (what === 'rob') { p.morale = Math.max(0, p.morale - 3); p.memory.push('robbed'); }
    else if (what === 'spare') { p.morale = Math.min(10, p.morale + 2); p.memory.push('spared'); }
    else if (what === 'threaten') { p.morale = Math.max(0, p.morale - 1); p.memory.push('threatened'); }
    else if (what === 'kill') { p.morale = 0; p.dead = true; p.memory.push('killed'); }
    else if (what === 'leave') { p.gone = true; p.memory.push('left'); }
    else return false;
    return true;
  }

  const trusts = (p) => !!p && !p.dead && !p.gone && p.morale >= 5;
  const fears = (p) => !!p && !p.dead && p.morale <= 2;
  const remembers = (p, what) => !!p && p.memory.includes(what);
  const accountLine = (p) => p.name + ': ' + (p.dead ? 'dead' : p.gone ? 'gone' : 'morale ' + p.morale) +
    (p.memory.length ? ' (' + p.memory.join(', ') + ')' : '');
  const meetsAgain = (p) => !!p && !p.dead && !p.gone && (remembers(p, 'spared') || remembers(p, 'helped'));

  return { make, act, trusts, fears, remembers, accountLine, meetsAgain };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PEOPLE28;
