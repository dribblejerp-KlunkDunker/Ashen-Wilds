#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const M=require('../tools/look/highland-materials.js');
const hash=a=>require('crypto').createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const results=[];
for(const name of M.names){
 const a=M.paint(name),b=M.paint(name);
 assert.equal(a.length,4096);assert.equal(hash(a),hash(b));
 assert(new Set(a).size>=4);assert(new Set(a).size <= (name.startsWith('frost') ? 11 : 6));
 for(const p of a)assert.equal(p>>>24,255);
 for(let y=-8;y<72;y++)for(let x=-8;x<72;x++){
  assert.equal(M.sample(name,x,y),M.sample(name,x+64,y));
  assert.equal(M.sample(name,x,y),M.sample(name,x,y+64));
 }
 let sx=0,sy=0,ix=0,iy=0;
 const lum=p=>((p&255)+((p>>>8)&255)+((p>>>16)&255))/3;
 for(let i=0;i<64;i++){sx+=Math.abs(lum(a[i*64])-lum(a[i*64+63]));sy+=Math.abs(lum(a[i])-lum(a[63*64+i]));}
 for(let y=0;y<64;y++)for(let x=0;x<63;x++)ix+=Math.abs(lum(a[y*64+x+1])-lum(a[y*64+x]));
 for(let y=0;y<63;y++)for(let x=0;x<64;x++)iy+=Math.abs(lum(a[(y+1)*64+x])-lum(a[y*64+x]));
 results.push({name,sha256:hash(a),colors:new Set(a).size,seamX:sx/64,seamY:sy/64,internalX:ix/(64*63),internalY:iy/(64*63)});
}
assert.throws(()=>M.paint('missing'));
console.log(JSON.stringify({status:'PASS',scope:'Pure painter tests only; no browser or game integration',materials:results},null,2));
