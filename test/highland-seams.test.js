#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const crypto=require('crypto');
const M=require('../tools/look/highland-materials.js');
const unchanged={rock:'c90704adf5f41b9f595c17f97f5ab5de276d68ba345d96b3c8521e6d357bf9cc',frost:'1cbb41f42bcddfe932f4439c6df6099439a57a1f81d3d142c326aadd2cce0101',frost2:'6b60479e6165dd91c292d96ade04184ad48a3befb554e6af992bd6d9ee5ca657',flags:'18b7b8a99c47b93cdd31e5196a323ad0809434fe1e4bd0459e7d895e58e8409f',planks:'c9047c8b1892fc4744ff857ee57318b59b5b025029afb9781cd7d0d2bf2d0175'};
const digest=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
for(const name of M.names){
 const a=M.paint(name);assert.equal(a.length,4096);assert.equal(digest(a),digest(M.paint(name)));
 for(const p of a)assert.equal(p>>>24,255);
 if(unchanged[name])assert.equal(digest(a),unchanged[name],name+' must remain unchanged');
 for(let y=-8;y<72;y++)for(let x=-8;x<72;x++){
  assert.equal(M.sample(name,x,y),M.sample(name,x+64,y));
  assert.equal(M.sample(name,x,y),M.sample(name,x,y+64));
 }
}
const a=M.paint('drystone');
const l=Array.from(a,p=>((p&255)+((p>>>8)&255)+((p>>>16)&255))/3);
let sx=0,sy=0;
for(let i=0;i<64;i++){sx+=Math.abs(l[i*64]-l[i*64+63]);sy+=Math.abs(l[i]-l[4032+i]);}
sx/=64;sy/=64;
// Regression bounds for this draft, NOT universal visual-quality thresholds.
// The committed original reports 12.9323 and 17.5677, and must fail these.
assert(sx<=9,'dry-stone horizontal boundary regression');
assert(sy<=14,'dry-stone vertical boundary regression');
assert(new Set(a).size>=4);
assert.throws(()=>M.paint('missing'));
console.log(JSON.stringify({status:'PASS',seamX:sx,seamY:sy,scope:'Painter regression only. No game, browser, or visual-quality approval.'},null,2));
