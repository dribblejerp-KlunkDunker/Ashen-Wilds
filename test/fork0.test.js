// node test/fork0.test.js              (add --no-browser to run only the half that needs no browser)
// NODE_PATH=$(npm root -g) node test/fork0.test.js       with Playwright installed globally
// Phase 0, the fork: the Shattered Octave's engine with its story taken out. This checks the page that is left: every
// script it lists exists and is versioned, nothing lies about unloaded, the stubs in js/fork0.js stand in for exactly the
// names the engine still calls, the offline list is current, and the page boots and runs without the story.
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- the page
const html = read('index.html');
const tags = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const files = tags.map((t) => t.split('?')[0]);
check(tags.length > 60 && tags.every((t) => /\?v=\d+$/.test(t) || /vendor\//.test(t)), 'every script the page loads carries a ?v=N: ' + tags.length + ' scripts');
check(files.every((f) => fs.existsSync(path.join(ROOT, f))), 'every one of them exists: ' + (files.filter((f) => !fs.existsSync(path.join(ROOT, f))).join(' ') || 'none missing'));
check(new Set(files).size === files.length, 'none is listed twice');
const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
check(onDisk.every((f) => files.includes(f)), 'no script lies in js/ that the page does not load: ' + (onDisk.filter((f) => !files.includes(f)).join(' ') || 'none'));
const iFork = files.indexOf('js/fork0.js'), iGame = files.indexOf('js/game.js'), iLedge = files.indexOf('js/ledge1.js');
check(iFork >= 0 && iFork < iGame && iLedge === files.length - 1, 'the stubs load before the game; this game\'s first phase loads last');
const seen = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
check(/The Long/.test(seen) && !/Shattered Octave|Echoes of|Oakhaven/i.test(seen), 'the page names this game and not the one the engine came from');
const man = JSON.parse(read('manifest.webmanifest'));
check(man.name === 'The Long Account' && !/Octave/i.test(JSON.stringify(man)), 'so does the install manifest: ' + man.name);
for (const f of files) { try { new vm.Script(read(f), { filename: f }); } catch (e) { check(false, f + ' parses: ' + e.message); } }
check(true, 'every script parses');

// ---- the stubs
const fork = read('js/fork0.js');
const names = [...fork.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]).concat([...fork.matchAll(/^const (\w+) =/gm)].map((m) => m[1]));
const others = files.filter((f) => f !== 'js/fork0.js' && !/vendor\//.test(f)).map((f) => [f, read(f)]);
const unused = names.filter((n) => !others.some(([, src]) => new RegExp('\\b' + n + '\\b').test(src)));
check(names.length > 30 && unused.length === 0, names.length + ' stubs, and the engine still calls every one: ' + (unused.join(' ') || 'none unused'));
const twice = names.filter((n) => others.some(([, src]) => new RegExp('^(?:async )?function ' + n + '\\(|^(?:const|let|var) ' + n + ' =', 'm').test(src)));
check(twice.length === 0, 'none is also defined by a file that was kept: ' + (twice.join(' ') || 'none'));
const box = {}; vm.createContext(box); vm.runInContext(fork + '\n;globalThis.__n = {' + names.map((n) => n + ':' + n).join(',') + '};', box);
check(names.every((n) => n === 'RING' ? typeof box.__n[n] === 'object' : typeof box.__n[n] === 'function'), 'each is a function that does nothing (RING is a table of zeros)');
check(box.__n.codaShield({}, 7) === 7 && box.__n.placeSet() === null && Array.isArray(box.__n.ringPlan()) && box.__n.wildsSilenced() !== true, 'the few with a meaning keep it: a shield passes the blow through, there is no second list of places, nobody is silenced');

// ---- offline
const pre = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'pwa', 'precache.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
check(pre.status === 0, 'the offline list in sw.js is current (node tools/pwa/precache.js --check): ' + String(pre.stdout + pre.stderr).trim().split('\n').pop());
const sw = read('sw.js');
check(files.every((f) => sw.includes(f)) && sw.includes('img/title.png'), 'it holds every script and the title picture');

// ---- in a browser
(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) { console.log('SKIPPED the browser half of this test (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)'); return; }
  const s = await HN.open();
  try {
    const t = await s.page.evaluate(() => ({ h1: (document.querySelector('#title h1') || {}).innerText || '', title: document.title, begin: !!document.getElementById('btn-new'), stubs: typeof wgTick === 'function' && typeof RING === 'object' }));
    check(/The Long\s+Account/.test(t.h1) && t.title === 'The Long Account' && t.begin && t.stubs, 'the title screen reads "' + t.h1.replace(/\s+/g, ' ') + '" and has a way to begin');
    check(s.errors.length === 0, 'the page loads with no errors: ' + (s.errors[0] || 'none'));
    await HN.begin(s.page);
    const r = await s.page.evaluate(() => {
      const out = { maps: Object.keys(G.maps), map: G.map.id, r3d: R3D.active() };
      const pn = performance.now.bind(performance), t0 = pn(), dn = Date.now, d0 = dn();
      const fnv = (d) => { let x = 0x811c9dc5 | 0; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619) | 0; return x >>> 0; };
      const frame = () => { performance.now = () => t0; Date.now = () => d0; render(); render(); const h = fnv(R3D.readPixels().data); performance.now = pn; Date.now = dn; return h; };
      // thirty seconds of standing still: the engine's every per-frame hook runs with the story gone
      G.state = 'play'; const a = G.tod; advanceTime(30000); out.todMoved = G.tod !== a; out.state = G.state; out.hp = G.player.hp;
      // a day and a night
      const at = (tod) => { G.tod = tod; advanceTime(200); G.tod = tod; return frame(); };
      out.noon = at(0.5); out.dusk = at(0.75); out.midnight = at(0.0);
      // the engine's weather: rain can be called for, and it shows
      out.weather = typeof Weather !== 'undefined' ? Object.keys(Weather.STATES || {}) : [];
      G.tod = 0.5; try { Weather.hold('clear'); advanceTime(400); G.tod = 0.5; out.dry = frame(); Weather.hold('rain'); advanceTime(1500); G.tod = 0.5; out.rain = frame(); out.state2 = Weather.state ? (typeof Weather.state === 'function' ? Weather.state() : Weather.state) : null; Weather.hold('clear'); } catch (e) { out.weatherErr = String(e); }
      // the classic renderer still draws the same map
      try { R3D.setMode('off'); advanceTime(300); out.classic = !R3D.active(); const cv = document.getElementById('view'), cx = cv.getContext('2d'); const d = cx.getImageData(0, 0, cv.width, 150).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 24) lit++; out.classicLit = lit / (d.length / 4); R3D.setMode('on'); } catch (e) { out.classicErr = String(e); }
      // saving and loading
      try { out.save = typeof saveGame === 'function' ? JSON.stringify(saveGame()).length : (typeof snapshotGame === 'function' ? JSON.stringify(snapshotGame()).length : -1); } catch (e) { out.saveErr = String(e); }
      return out;
    });
    check(r.maps.length === 2 && r.maps.every((id) => /^la_/.test(id)), 'after Begin, none of the engine\'s old maps is in the world: ' + r.maps.join(', '));
    check(r.r3d && r.state === 'play' && r.hp > 0 && r.todMoved, 'thirty seconds of play run clean, and the clock moves');
    check(new Set([r.noon, r.dusk, r.midnight]).size === 3, 'noon, dusk and midnight are three different pictures');
    check(r.weather.includes('rain') && !r.weatherErr && r.rain !== r.dry, 'the engine\'s rain can be called for on the ledge, and it changes the picture' + (r.weatherErr ? ': ' + r.weatherErr : ''));
    check(r.classic && r.classicLit > 0.05 && !r.classicErr, 'the classic renderer still draws the place (' + (r.classicLit * 100 || 0).toFixed(0) + '% of the view lit)' + (r.classicErr ? ': ' + r.classicErr : ''));
    check(s.errors.length === 0, 'and none of it raised a page error: ' + (s.errors[0] || 'none'));
    if (r.saveErr || r.save < 0) console.log('NOTE saving was not exercised here (' + (r.saveErr || 'no save function found by that name') + ')'); else console.log('NOTE a save of the ledge is ' + r.save + ' bytes; loading it back is not tested yet');
  } catch (e) { fails++; console.log('FAIL the browser half stopped: ' + String(e.message).split('\n')[0]); }
  await s.close();
})().then(() => {
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
});
