// node test/coop25.test.js --no-browser
// Phase 25: co-op parity. One loudest noise, one shared sighting, one fuel pool, one formation rule.
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'coop25.js'));
let fails = 0;
const check = (c, l) => { if (c) console.log('PASS ' + l); else { fails++; console.log('FAIL ' + l); } };

check(C.loudest(2.4, 4.2) === 4.2 && C.loudest(16, 1) === 16, 'the pair is heard at the loudest walker');
check(C.sharedNoise([1, 4.2, 2.4]) === 4.2 && C.sharedNoise([]) === 0, 'company noise is the same maximum as hearing19');
check(C.mergeSeen(['boar', 'eel'], ['eel', 'heron']).length === 3, 'a sighting is shared once, not counted twice');
check(C.witnesses(['b', 'a'], ['a']).join(' ') === 'a b', 'witnesses are the sorted union');
check(C.sharedBar(66, 41) === 41 && C.sharedBar(12, 90) === 12, 'both bars show the worse walker');
check(C.sharedFuel(30, 7) === 7, 'the lantern is one pool');
check(C.canBothSwing(1.7) && !C.canBothSwing(1.69), 'two need 1.7 m to swing together');
check(C.partnerDread(0.2, 0.5) === 0.5, 'dread is shared at the worse reading');
const p = C.parity();
check(p.noise === 'loudest' && p.sight === 'union' && p.bar === 'worse' && p.fuel === 'one pool', 'the parity statement is explicit');
const src = fs.readFileSync(path.join(ROOT, 'js', 'coop25.js'), 'utf8');
check(!/Math\.random|Date\.now|performance\.now|peerjs/i.test(src) && !/[^\x09\x0a\x0d\x20-\x7e]/.test(src), 'pure, plain ASCII, no net19 contract or PeerJS');
console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
