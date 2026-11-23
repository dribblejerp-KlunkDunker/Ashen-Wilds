// node test/people28.test.js --no-browser
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'people28.js'));
let fails = 0; const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };
const p = P.make('Marget');
check(p.morale === 5 && P.trusts(p), 'a person starts at five and can be trusted');
P.act(p, 'help'); check(p.morale === 6 && P.remembers(p, 'helped') && P.meetsAgain(p), 'help is raised and remembered');
P.act(p, 'rob'); P.act(p, 'rob'); check(p.morale === 0 && P.fears(p), 'two robberies make fear');
check(P.act(p, 'kill') && p.dead && !P.trusts(p) && /dead/.test(P.accountLine(p)), 'killing ends the person');
check(!P.act(p, 'help'), 'the dead cannot be helped');
const q = P.make('Carter'); P.act(q, 'spare'); P.act(q, 'leave');
check(q.gone && !P.meetsAgain(q) && /gone/.test(P.accountLine(q)), 'leaving closes the meeting');
const src = fs.readFileSync(path.join(ROOT, 'js', 'people28.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now/.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no clock');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed'); process.exit(fails ? 1 : 0);
