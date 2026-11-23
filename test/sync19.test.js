// node test/sync19.test.js
// NODE_PATH=$(npm root -g) node test/sync19.test.js        with Playwright installed globally
// Phase 19, the co-op cut, played in a real browser with two tabs over BroadcastChannel: a cut is the
// guest's to pay for. The guest spends the committed 8 stamina, the host receives exactly one action,
// and the host's own fatigue is not charged (PARTNER19's partner pays its own 1 in the host's world).
// Without a browser the test is skipped; it needs Playwright and two pages in one browser context.
'use strict';
const path = require('path'), ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (cond, label) => { if (cond) console.log('PASS ' + label); else { fails++; console.log('FAIL ' + label); } };

(async () => {
  const HN = require('./harness.js');
  if (process.argv.includes('--no-browser') || !HN.playwright()) {
    console.log('SKIPPED the two-tab co-op cut (no Playwright: set PLAYWRIGHT_MODULE or NODE_PATH)');
    console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
    process.exit(fails ? 1 : 0);
  }
  const pw = HN.playwright();
  const server = await HN.serve();
  // A background tab must keep ticking: the host has to hear the guest's action while the guest's
  // tab is in front (and the guest has to finish its handshake while the host's tab is in front).
  const browser = await pw.chromium.launch({
    args: HN.ARGS.concat([
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ]),
  });
  const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const errors = [];
  const IGNORE = /404|Failed to load resource|GPU stall|swiftshader|WebGL-.*fallback|READ-usage/i;

  async function openTab() {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e.message).slice(0, 240)));
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('CONSOLE ' + m.text().slice(0, 240)); });
    await page.addInitScript(() => { window.__r3d21 = { automation: true }; });
    await page.goto(server.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof G !== 'undefined' && typeof LEDGE1 !== 'undefined' && !(document.querySelector('#loading') && document.querySelector('#loading').classList.contains('on')), null, { timeout: 60000 });
    await HN.begin(page);
    // Two software-rendered 3D views starve this box's two cores; the co-op wire does not read the
    // renderer, so turn the picture off once the page is in play and leave the 2D game running.
    await page.evaluate(() => { if (typeof R3D !== 'undefined') R3D.setMode('off'); G.opts.captureMouse = false; });
    return page;
  }

  try {
    const host = await openTab();
    const guest = await openTab();

    // ---------------------------------------------------------------- host and guest, two real tabs
    const code = await host.evaluate(() => NET19.host({ transport: 'bc', name: 'Host' }).then((r) => r.code));
    check(typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code), 'the host opens a six-letter code over BroadcastChannel');

    await guest.evaluate((c) => NET19.join(c, { transport: 'bc', name: 'Guest' }), code);
    await host.waitForFunction(() => SYNC19.isHost() && PARTNER19.active(), null, { timeout: 20000 });
    await guest.waitForFunction(() => SYNC19.isGuest() && G.state === 'play', null, { timeout: 20000 });
    await guest.waitForFunction((m) => G.mapId === m, await host.evaluate(() => G.mapId), { timeout: 10000 });
    check(true, 'the guest joins the host\'s world, with PARTNER19\'s partner live on the host');

    // ---------------------------------------------------------------- controlled baselines
    const hostBefore = await host.evaluate(() => {
      G.player.fat = G.player.fatMax;   // recovery cannot raise it past this, so any charge would show
      SYNC19.resetStats();
      return { fat: G.player.fat, fatMax: G.player.fatMax, map: G.mapId };
    });
    const guestBefore = await guest.evaluate(() => {
      if (G.flags) G.flags.la_combat = undefined;
      G.attack.t = 0; G.song.t = 0;
      G.player.fat = Math.min(100, G.player.fatMax);
      return { fat: G.player.fat, fatMax: G.player.fatMax, map: G.mapId, state: G.state };
    });
    check(hostBefore.fat === hostBefore.fatMax && guestBefore.fat > 8 && guestBefore.state === 'play' && guestBefore.map === hostBefore.map,
      'both baselines are set in the host\'s map (host at its ' + hostBefore.fatMax + ' maximum, guest at ' + guestBefore.fat + ')');

    // ---------------------------------------------------------------- the guest's real cut
    // A left button held and dragged right is the engine's 'slash right' (a cut, 8), not the zero-drag
    // thrust (6). The mouse handlers are the live ones in js/game.js.
    const cut = await guest.evaluate(() => {
      const c = Engine.canvas, r = c.getBoundingClientRect();
      const x = r.left + r.width * 0.5, y = r.top + r.height * 0.3;
      const before = G.player.fat;
      c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0, clientX: x + r.width * 0.2, clientY: y, bubbles: true }));
      const after = G.player.fat, clock = (G.flags && G.flags.la_combat) || {};
      return { before, after, label: G.attack.dirLabel, cost: clock.cost, kind: clock.kind, attackT: G.attack.t };
    });
    check(cut.label === 'slash right' && cut.kind === 'cut' && cut.cost === 8, 'the guest\'s drag is a cut, committed at 8');
    check(cut.before - cut.after === 8, 'the guest pays exactly 8 fatigue (' + cut.before + ' -> ' + cut.after + ')');
    check(cut.attackT > 0, 'the guest\'s own swing clock is running');

    // ---------------------------------------------------------------- what the host got
    await host.waitForFunction(() => SYNC19.stats().acts >= 1, null, { timeout: 10000 });
    await host.waitForTimeout(250);   // a second delivery would show here
    const hostAfter = await host.evaluate(() => ({
      fat: G.player.fat, fatMax: G.player.fatMax,
      acts: SYNC19.stats().acts, rejected: SYNC19.stats().rejected, inputs: SYNC19.stats().inputs,
    }));
    check(hostAfter.acts === 1, 'the host receives exactly one action (acts ' + hostAfter.acts + ', inputs ' + hostAfter.inputs + ')');
    check(hostAfter.fat === hostBefore.fat, 'the host\'s own fatigue is not charged for it (' + hostBefore.fat + ' -> ' + hostAfter.fat + ')');
    check(!Object.keys(hostAfter.rejected).length, 'the host rejected no frame: ' + JSON.stringify(hostAfter.rejected));

    check(errors.length === 0, 'no page errors: ' + (errors[0] || 'none'));
  } catch (e) {
    fails++;
    console.log('FAIL the two-tab test stopped: ' + String(e && e.message).split('\n')[0]);
  } finally {
    await browser.close();
    server.srv.close();
  }
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
