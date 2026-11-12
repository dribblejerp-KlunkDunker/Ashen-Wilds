#!/usr/bin/env node
// Makes the 96x96 dialogue portraits (img/p_<id>.jpg) for this game's people from the sprite each one wears,
// by running the game and cropping the painting's head and shoulders. Placeholder art until they are painted.
//   node tools/portraits.js            (needs Playwright's Chromium; set PLAYWRIGHT_MODULE if it lives elsewhere)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.join(__dirname, '..');
const WHO = { la_carter: 'townsman', la_marget: 'townswoman' };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); });
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const b = await chromium.launch(), page = await b.newPage();
  await page.goto('http://127.0.0.1:' + srv.address().port + '/', { waitUntil: 'load' });
  await page.waitForFunction((names) => typeof Engine !== 'undefined' && names.every((n) => Engine.sprites[n]), Object.values(WHO), { timeout: 60000 });
  for (const [id, sprite] of Object.entries(WHO)) {
    const url = await page.evaluate((name) => {
      const sp = Engine.sprites[name], src = document.createElement('canvas'); src.width = sp.w; src.height = sp.h;
      const im = new ImageData(new Uint8ClampedArray(sp.data.buffer.slice(0)), sp.w, sp.h); src.getContext('2d').putImageData(im, 0, 0);
      const out = document.createElement('canvas'); out.width = out.height = 96; const x = out.getContext('2d');
      x.fillStyle = '#17110d'; x.fillRect(0, 0, 96, 96); x.imageSmoothingEnabled = false;
      const side = Math.min(sp.w, Math.round(sp.h * 0.36));                    // head and shoulders
      x.drawImage(src, Math.round((sp.w - side) / 2), 0, side, side, 4, 6, 88, 88);
      return out.toDataURL('image/jpeg', 0.9);
    }, sprite);
    fs.writeFileSync(path.join(ROOT, 'img', 'p_' + id + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote img/p_' + id + '.jpg from ' + sprite);
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
