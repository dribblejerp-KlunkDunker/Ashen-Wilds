/* Highland material look test. Not loaded by index.html; no runtime changes. */
'use strict';
const HighlandMaterials = (() => {
  const N = 64;
  const mod = (x, p) => ((x % p) + p) % p;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function hash(x, y, seed) {
    let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, y, cells, seed) {
    x = mod(x, N) * cells / N; y = mod(y, N) * cells / N;
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy; u *= u * (3 - 2 * u); v *= v * (3 - 2 * v);
    const h = (a, b) => hash(mod(a, cells), mod(b, cells), seed);
    return (h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - v) +
      (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * v;
  }
  const palettes = {
    rock: [[10,11,13],[18,20,23],[28,31,35],[40,44,49],[55,60,65],[70,75,79]],
    frost: [[45,53,60],[66,77,87],[89,102,113],[115,130,141],[143,157,167]],
    stone: [[11,12,13],[22,24,26],[34,37,40],[47,51,54],[61,65,67],[76,79,79]],
    flags: [[12,11,10],[24,22,19],[37,34,29],[50,46,39],[64,59,50],[78,72,61]],
    wood: [[10,8,6],[22,16,11],[34,25,16],[47,35,23],[61,46,30],[75,57,38]]
  };
  const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  function color(p, t, x, y) {
    const k = clamp(Math.round(t * (p.length - 1) + (bayer[(x & 3) + (y & 3) * 4] / 16 - .5) * .35), 0, p.length - 1);
    const c = p[k]; return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }
  function mineral(x, y, seed) {
    const warpX = (noise(x,y,2,seed+1)-.5)*10;
    const warpY = (noise(x,y,2,seed+2)-.5)*10;
    const a = noise(x+warpX,y+warpY,4,seed+3);
    const b = noise(x,y,16,seed+4);
    const crack = Math.abs(noise(x+warpX,y+warpY,8,seed+5)-.5);
    return .30 + a*.48 + (b-.5)*.14 - Math.max(0,.035-crack)*5;
  }
  function sample(name, x, y) {
    x = mod(Math.floor(x),N); y = mod(Math.floor(y),N);
    if (name === 'rock') return color(palettes.rock,mineral(x,y,731),x,y);
    if (name === 'frost' || name === 'frost2') {
      const seed = name === 'frost' ? 812 : 940;
      const wx=(noise(x,y,2,seed)-.5)*14, wy=(noise(x,y,2,seed+1)-.5)*14;
      const f=noise(x+wx,y+wy,4,seed+2)*.6+noise(x,y,8,seed+3)*.4;
      return f>.54 ? color(palettes.frost,.16+(f-.54)*1.8,x,y) : color(palettes.rock,mineral(x,y,731),x,y);
    }
    if (name === 'drystone') {
      // Measure the 16 unique stones on a torus, not translated copies.
      let d1=1e9,d2=1e9,id=0;
      for(let gy=0;gy<4;gy++) for(let gx=0;gx<4;gx++) {
        const cx=(gx+.22+hash(gx,gy,41)*.56)*16;
        const cy=(gy+.24+hash(gx,gy,42)*.52)*16;
        const ax=Math.abs(x-cx), ay=Math.abs(y-cy);
        const d=Math.hypot(Math.min(ax,N-ax)*.86,Math.min(ay,N-ay)*1.13);
        if(d<d1){d2=d1;d1=d;id=gx+4*gy;}else if(d<d2)d2=d;
      }
      const edge=d2-d1;
      const grit=(noise(x,y,16,75)-.5)*.12;
      const shoulder=clamp(edge/3.5,0,1);
      const blend=shoulder*shoulder*(3-2*shoulder);
      const body=.36+hash(id,0,71)*.24+grit;
      return color(palettes.stone,.08+(body-.08)*blend,x,y);
    }
    if(name==='flags') {
      const row=y>>5, sx=mod(x+row*13,64), bx=sx%32, by=y%32;
      const edge=Math.min(bx,31-bx,by,31-by);
      return color(palettes.flags,edge<1?.03:.38+noise(x,y,8,53)*.23+hash(sx>>5,row,54)*.1,x,y);
    }
    if(name==='planks') {
      const plank=x>>4, bx=x%16;
      const grain=noise(plank*16,y,16,92)*.20;
      const wave=Math.sin(2*Math.PI*(x*8/64+noise(x,y,4,93)*.1));
      return color(palettes.wood,bx===15?.03:.22+hash(plank,0,91)*.25+grain+wave*.05,x,y);
    }
    throw new Error('Unknown material: '+name);
  }
  const names=Object.freeze(['rock','frost','frost2','drystone','flags','planks']);
  function paint(name){if(!names.includes(name))throw new Error('Unknown material: '+name);const a=new Uint32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++)a[y*N+x]=sample(name,x,y);return a;}
  return Object.freeze({N,names,paint,sample});
})();
if(typeof module!=='undefined' && module.exports)module.exports=HighlandMaterials;
