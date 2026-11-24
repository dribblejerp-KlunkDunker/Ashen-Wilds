// node test/touchlink36.test.js --no-browser
// Phase 36 support: the phone link. It starts touch mode from ?touch / ?mobile or a coarse pointer.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'touchlink36.js'), 'utf8');
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

// Load the file in a sandbox with the globals the page gives it. `calls` records setTouchMode.
function boot(o) {
  o = o || {};
  const calls = [], win = {};
  const sandbox = {
    window: win,
    location: { search: o.search || '' },
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)' ? !!o.coarse : false, media: q }),
    setTouchMode: o.noSet ? undefined : (on) => calls.push(!!on),
    console,
  };
  if (!o.noG) sandbox.G = { opts: { touch: o.touch || 'auto' } };
  vm.runInNewContext(SRC, sandbox, { filename: 'js/touchlink36.js' });
  return { api: win.TOUCHLINK36, calls, sandbox };
}

const a = boot({ search: '?touch=1' });
check(a.api && typeof a.api.fromLink === 'function' && typeof a.api.linkChoice === 'function' &&
  typeof a.api.wanted === 'function' && typeof a.api.apply === 'function', 'the phone-link API is exported');
check(a.api.fromLink('?touch') && a.api.fromLink('?touch=1') && a.api.fromLink('?mobile') &&
  a.api.fromLink('?TOUCH=on') && a.api.fromLink('?touch=1&x=2'), 'touch and mobile links switch the mode on');
check(!a.api.fromLink('?touch=0') && !a.api.fromLink('?touch=off') && !a.api.fromLink('?mobile=no') &&
  !a.api.fromLink('?mobile=false') && !a.api.fromLink('?other=1'), 'off, no and unrelated links do not switch it on');
check(a.api.linkChoice('') === null && a.api.linkChoice('?touch') === true &&
  a.api.linkChoice('?touch=0') === false, 'linkChoice keeps absent, on and off apart');
check(a.api.wanted('', true) && !a.api.wanted('', false), 'a coarse pointer starts touch mode when no link says otherwise');
check(!a.api.wanted('?touch=0', true), 'an explicit off link beats a coarse pointer');
check(a.api.wanted('?touch=1', false), 'an on link works without a coarse pointer');
check(a.api.applied === true && a.calls.length === 1 && a.calls[0] === true, 'the link applies once at load');
check(a.sandbox.G.opts.touch === 'auto', 'the helper does not change the saved touch option');

const coarse = boot({ coarse: true });
check(coarse.api.applied === true && coarse.calls[0] === true, 'a coarse pointer applies at load');
const none = boot({});
check(none.api.applied === false && none.calls.length === 0, 'a mouse and no link leave the controls alone');
const off = boot({ search: '?touch=1', touch: 'off' });
check(off.api.applied === false && off.calls.length === 0, 'Options > Touch controls Off wins');
const noG = boot({ search: '?touch=1', noG: true });
check(noG.api.applied === false && noG.calls.length === 0, 'the helper does nothing before G exists');
const noSet = boot({ search: '?touch=1', noSet: true });
check(noSet.api.applied === false, 'the helper does nothing without the engine setter');

const later = boot({});
check(later.api.apply() === false && later.calls.length === 0, 'apply is safe when there is nothing to switch');
later.sandbox.location.search = '?touch=1';
check(later.api.apply() === true && later.calls.length === 1, 'apply reads the link when it is called later');
later.sandbox.G.opts.touch = 'off';
check(later.api.apply() === false && later.calls.length === 1, 'a later apply still honours Off');
later.sandbox.G.opts.touch = 'auto';
later.sandbox.location.search = '?touch=0';
check(later.api.apply() === false && later.calls.length === 1, 'a later explicit off wins without a coarse pointer');

check(!/Math\.random|Date\.now|performance\.now/.test(SRC) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(SRC),
  'the phone link is plain ASCII and uses no clock or random');

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
