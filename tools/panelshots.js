// Usage: NODE_PATH=$(npm root -g) node tools/panelshots.js <outDir> [only]
// Phase 10's stills: who walks north (the creation screen); the HUD with this game's buttons, its salt and its oil
// bar; and each of this game's panels (YOU, PACK, BOOK, FOLK, HELP), and the credits.
'use strict';
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', 'test', 'harness.js'));
const out = path.resolve(process.argv[2] || 'docs/screenshots'), only = process.argv[3];
const want = (n) => !only || n.includes(only);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const s = await H.open(), page = s.page;
  // the creation screen, before the harness picks for us
  await page.locator('#btn-new').first().dispatchEvent('click');
  await page.waitForSelector('#la-who', { timeout: 20000 }); await page.waitForTimeout(500);
  if (want('100_who_walks_north')) { await page.screenshot({ path: path.join(out, '100_who_walks_north.png') }); console.log('wrote 100_who_walks_north.png'); }
  await page.locator('#la-who [data-bg="gutter"]').first().dispatchEvent('click');
  await page.waitForTimeout(800);
  await page.waitForFunction(() => G.state === 'intro' || G.state === 'play', null, { timeout: 20000 });
  if (await page.evaluate(() => G.state === 'intro')) await page.locator('#btn-intro-skip').first().dispatchEvent('click');
  await page.waitForFunction(() => G.state === 'play', null, { timeout: 20000 });
  await page.evaluate(() => { if (typeof R3D !== 'undefined') R3D.setMode('on'); });
  await page.waitForFunction(() => typeof R3D !== 'undefined' && R3D.active && R3D.active(), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const place = () => {
    G.flags.la_told_bar = true; G.flags.la_oil = 540; loadMap('la_ledge', { x: 89.5, y: 40.5, dir: Math.PI }); G.state = 'play'; G.tod = 0.5; G.fadeT = 0; G.keys = {};
    UPG.lantern = true; LANTERN7.state().prev = true; G.player.gold = 12;
    advanceTime(400); G.tod = 0.5; const m = document.querySelector('#msgs'); if (m) m.innerHTML = '';
  };
  await page.evaluate(place); await page.waitForTimeout(600);
  if (want('101_the_hud')) { await page.screenshot({ path: path.join(out, '101_the_hud.png') }); console.log('wrote 101_the_hud.png: ' + JSON.stringify(await page.evaluate(() => PANEL10.state().hud.filter(Boolean)))); }
  const panels = [['102_you', 'c'], ['103_pack', 'i'], ['104_book', 'l'], ['105_folk', 'k'], ['106_help', 'h']];
  for (const [name, key] of panels) {
    if (!want(name)) continue;
    await page.evaluate(() => { if (G.openPanel) closeModal(); G.state = 'play'; });
    await page.keyboard.press(key); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, name + '.png') }); console.log('wrote ' + name + '.png (' + (await page.evaluate(() => G.openPanel)) + ')');
  }
  if (want('107_credits')) {
    await page.evaluate(() => { if (G.openPanel) closeModal(); G.state = 'panel'; VOICES.renderFullCredits(); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, '107_credits.png') }); console.log('wrote 107_credits.png');
  }
  await s.close();
})().catch((e) => { console.error(e); process.exit(1); });
