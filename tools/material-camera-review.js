/* Actual-engine review runner; texture substitutions exist only in this browser test. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const H=require('../test/harness');
const M=require('./look/highland-materials');
const out=path.resolve(process.argv[2]||'camera-review');
const mappings={t_la_rock:'rock',t_la_frost:'frost',t_la_frost2:'frost2',t_house_la_drystone:'drystone',t_flag:'flags',t_wood:'planks'};
const replacements=Object.fromEntries(Object.entries(mappings).map(([slot,name])=>[slot,Array.from(M.paint(name))]));
const views=[
 {name:'ledge',map:'ledge',x:78.35,y:49.2,deg:178,look:-.2},
 {name:'bothy-exterior',map:'ledge',x:87.6,y:33.4,deg:224,look:.04},
 {name:'bothy-entry',map:'bothy',look:0},
 {name:'bothy-corner',map:'bothy',x:3.5,y:4.4,deg:225,look:0},
 {name:'bothy-floor',map:'bothy',x:3.5,y:4.4,deg:270,look:-.35}
];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const pw=H.playwright();assert(pw,'Playwright is required');
 const server=await H.serve();let browser;
 const report={scope:'Actual engine, test-only registration substitution; not production integration',views,variants:[],complete:false};
 try{
  browser=await pw.chromium.launch({args:H.ARGS});
  for(const variant of ['original','revised']){
   const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.__r3d21={automation:true};});
   if(variant==='revised')await page.route('**/js/engine.js*',async route=>{
    const response=await route.fetch();assert(response.ok(),'engine.js fetch failed');
    const injection='\n;(()=>{const replacements='+JSON.stringify(replacements)+';const old=Engine.addTexture;window.__materialReviewHits={};Engine.addTexture=function(name,data,...rest){if(Object.prototype.hasOwnProperty.call(replacements,name)){window.__materialReviewHits[name]=(window.__materialReviewHits[name]||0)+1;data=new Uint32Array(replacements[name]);}return old.call(this,name,data,...rest);};})();\n';
    await route.fulfill({response,body:await response.text()+injection});
   });
   await page.goto(server.url,{waitUntil:'load'});
   await page.waitForFunction(()=>typeof Engine!=='undefined'&&typeof G!=='undefined'&&typeof LEDGE1!=='undefined'&&!document.querySelector('#loading')?.classList.contains('on'),null,{timeout:60000});
   await H.begin(page);
   assert(await page.evaluate(()=>typeof R3D!=='undefined'&&R3D.active()),'WebGL renderer is not active');
   const hits=await page.evaluate(()=>window.__materialReviewHits||{});
   if(variant==='revised')for(const slot of Object.keys(mappings))assert(hits[slot]>0,'Texture registration was not replaced: '+slot);
   const captures=[];
   for(const view of views){
    await page.evaluate(v=>{
     const map=v.map==='bothy'?LEDGE1.BOTHY:LEDGE1.LEDGE;
     if(v.x==null)loadMap(map);else loadMap(map,{x:v.x,y:v.y,dir:v.deg*Math.PI/180});
     G.state='play';G.tod=.735;G.fadeT=0;G.keys={};if(G.vel)G.vel.x=G.vel.y=0;
     if(R3D.camera&&R3D.camera.setAngle)R3D.camera.setAngle(v.look||0);
     for(const selector of ['#msgs','#hint']){const e=document.querySelector(selector);if(e)e.textContent='';}
     document.querySelector('#lockhint')?.classList.remove('on');
    },view);
    await page.waitForTimeout(1800);
    const state=await page.evaluate(()=>({state:G.state,map:G.map&&G.map.id,webgl:R3D.active(),cam:{x:Engine.cam.x,y:Engine.cam.y,z:Engine.cam.z}}));
    assert.equal(state.state,'play');assert(state.webgl,'Renderer stopped');
    assert.equal(state.map,view.map==='bothy'?'la_bothy':'la_ledge');
    const file=variant+'-'+view.name+'.png';await page.screenshot({path:path.join(out,file)});captures.push({file,...state});
   }
   report.variants.push({variant,hits,errors,captures});
   assert.equal(errors.length,0,'Browser page errors: '+errors.join('; '));
   await context.close();
  }
  assert.equal(report.variants.length,2);report.complete=true;
 }catch(e){report.failure=String(e.stack||e);throw e;}
 finally{
  report.missing=[...server.missing];
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();await new Promise(resolve=>server.srv.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
