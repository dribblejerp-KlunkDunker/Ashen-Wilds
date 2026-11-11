"""ENV-002: five reproducible draft assets. Python + NumPy + SciPy.
Meters, Y-up. Source reconstruction from recorded batch; no Godot certification.
"""
from pathlib import Path
import numpy as np, math, json, struct, hashlib
from scipy.spatial import ConvexHull
MATS=[('stone_gray',[.29,.30,.265,1]),('stone_light',[.37,.375,.33,1]),('stone_dark',[.235,.25,.225,1]),('stone_warm',[.32,.30,.26,1]),('mortar',[.18,.19,.165,1]),('wood_old',[.27,.20,.13,1]),('wood_mid',[.285,.215,.145,1]),('wood_dark',[.205,.16,.105,1]),('iron_dull',[.13,.14,.125,1]),('wood_cut',[.37,.29,.195,1]),('rope',[.30,.265,.18,1])]
PIVOT=np.array([-.47,0,-.095])
def part(name,v,f,mat,group='root'):
 return {'name':name,'v':np.asarray(v).tolist(),'f':np.asarray(f).tolist(),'material':mat,'group':group}
def hullpart(name,points,mat,group='root'):
 v=np.array(points);h=ConvexHull(v);faces=[]
 for face,plane in zip(h.simplices,h.equations):
  a,b,c=v[face]
  if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
  faces.append(face)
 return part(name,v,faces,mat,group)
def box(name,c,s,mat,bevel=.008,group='root'):
 h=np.array(s)/2;bevel=min(bevel,float(h.min())*.4);points=[]
 for axis in range(3):
  for sx in [-1,1]:
   for sy in [-1,1]:
    for sz in [-1,1]:
     signs=np.array([sx,sy,sz]);p=(h-bevel)*signs;p[axis]=h[axis]*signs[axis];points.append(p+np.array(c))
 return hullpart(name,points,mat,group)
def stone(name,c,s,rng):
 p=box(name,[0,0,0],s,int(rng.choice([0,1,2,3],p=[.45,.12,.22,.21])),float(rng.uniform(.009,.017)))
 v=np.array(p['v']);half=np.array(s)/2;v[:,2]*=rng.uniform(.96,1,len(v));v=np.clip(v,-half,half)+np.array(c)
 return hullpart(name,v,p['material'])
def lcore():
 footprint=np.array([[-.18,-.18],[.988,-.18],[.988,.18],[.18,.18],[.18,.988],[-.18,.988]])
 v=[[x,y,z] for y in [0,2.24] for x,z in footprint];f=[]
 for i in range(6):
  j=(i+1)%6;f.extend([[i,j,j+6],[i,j+6,i+6]])
 for k in range(1,5):f.extend([[0,k+1,k],[6,6+k,6+k+1]])
 return part('L_mortar_core',v,[[a,c,b] for a,b,c in f],4)
def corner():
 rng=np.random.default_rng(2001);hr=np.random.default_rng(1002);heights=hr.uniform(.27,.33,8);heights=heights/heights.sum()*2.4;y=0;parts=[lcore()]
 for row,h in enumerate(heights):
  drop=float(rng.uniform(.006,.025)) if row==7 else .007;height=float(h-(0 if row==0 else .007)-drop);cy=y+(0 if row==0 else .007)+height/2
  parts.append(stone('corner_quoin_'+str(row),[0,cy,0],[.386,height,.386],rng));split=.60 if row%2 else .52
  for j,(a,b) in enumerate([(.2,split),(split,1)]):
   parts.append(stone('x_arm_'+str(row)+'_'+str(j),[(a+b)/2,cy,0],[b-a-.014,height,.386],rng))
   parts.append(stone('z_arm_'+str(row)+'_'+str(j),[0,cy,(a+b)/2],[.386,height,b-a-.014],rng))
  y+=h
 return parts

def lowwall():
 rng=np.random.default_rng(2002);parts=[];tops=[.96,.78,.54,.72,1.02]
 for row in range(4):
  edges=[-1,-.5,0,.5,1] if row%2==0 else [-1,-.75,-.25,.25,.75,1]
  for col,(a,b) in enumerate(zip(edges[:-1],edges[1:])):
   cx=(a+b)/2;top=float(np.interp(cx,[-.8,-.4,0,.4,.8],tops));bottom=row*.25;height=min(.25,top-bottom)-(.007 if row else 0)
   if height<.055:continue
   cy=bottom+(0 if row==0 else .007)+height/2;parts.append(stone('broken_stone_'+str(row)+'_'+str(col),[cx,cy,0],[b-a-.014,height,.386],rng))
 for i in range(16):
  x=-1+(i+.5)*.125;top=max([max(v[1] for v in p['v']) for p in parts if min(v[0] for v in p['v'])<=x<=max(v[0] for v in p['v'])]+[.45])-.035
  parts.append(box('recessed_backing_'+str(i),[x,top/2,0],[.125,top,.30],4,0))
 return parts

def lathe(name,profile,mat,n=12,group='root'):
 v=np.array([[r*math.cos(2*math.pi*i/n),y,r*math.sin(2*math.pi*i/n)] for r,y in profile for i in range(n)]);f=[]
 for j in range(len(profile)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n
   for face in [[a,c,b],[a,d,c]]:
    if np.linalg.norm(np.cross(v[face[1]]-v[face[0]],v[face[2]]-v[face[0]]))>1e-12:f.append(face)
 return part(name,v,f,mat,group)
def door():
 p=[box('left_jamb',[-.56,1,0],[.12,2,.16],7,.004),box('right_jamb',[.56,1,0],[.12,2,.16],7,.004),box('header',[0,2.075,0],[1.24,.15,.16],7,.004)]
 for i in range(5):p.append(box('door_board_'+str(i),[-.376+i*.188,.995,0],[.180,1.95,.055],5 if i!=3 else 6,.002,'door_leaf'))
 for y in [.34,1.64]:p.append(box('cross_rail',[0,y,-.039],[.92,.10,.025],7,.003,'door_leaf'))
 p.append(box('repair_patch',[.10,.93,-.041],[.39,.09,.028],6,.003,'door_leaf'));p.append(box('latch',[.34,1.05,-.055],[.08,.05,.027],8,.002,'door_leaf'))
 for y in [.40,1.58]:
  pin=lathe('hinge_pin',[(0,y-.035),(.012,y-.035),(.012,y+.035),(0,y+.035)],8,8);pin['v']=(np.array(pin['v'])+PIVOT).tolist();p.append(pin)
  p.append(box('hinge_strap',[-.335,y,-.050],[.27,.045,.028],8,.002,'door_leaf'))
 return p

def firewood():
 p=[];specs=[(-.13,.065,.065,.78),(0,.063,.063,.80),(.13,.068,.068,.76),(-.065,.167,.061,.72),(.065,.169,.060,.75)]
 for idx,(z,y,r,length) in enumerate(specs):
  n=10;v=[];f=[]
  for x in [-length/2,length/2]:
   for i in range(n):v.append([x,y+r*math.cos(2*math.pi*i/n),z+r*math.sin(2*math.pi*i/n)])
  for i in range(n):
   j=(i+1)%n;f.extend([[i,j,j+n],[i,j+n,i+n]])
  p.append(part('log_bark_'+str(idx),v,f,7 if idx%2 else 5))
  for end,x in enumerate([-length/2,length/2]):
   vv=[[x,y,z]]+[[x,y+r*math.cos(2*math.pi*i/n),z+r*math.sin(2*math.pi*i/n)] for i in range(n)];ff=[]
   for i in range(n):
    face=[0,i+1,(i+1)%n+1]
    if end==0:face=[face[0],face[2],face[1]]
    ff.append(face)
   p.append(part('cut_end_'+str(idx)+'_'+str(end),vv,ff,9))
 for x in [-.24,.24]:
  vv=[];ff=[];n=16;m=6
  for i in range(n):
   t=2*math.pi*i/n;normal=np.array([0,math.cos(t),math.sin(t)]);center=np.array([x,.127+.119*math.cos(t),.205*math.sin(t)])
   for j in range(m):
    a=2*math.pi*j/m;vv.append(center+.008*(math.cos(a)*np.array([1,0,0])+math.sin(a)*normal))
  for i in range(n):
   for j in range(m):
    a=i*m+j;b=i*m+(j+1)%m;c=((i+1)%n)*m+(j+1)%m;d=((i+1)%n)*m+j;ff.extend([[a,b,c],[a,c,d]])
  p.append(part('rope_tie',vv,ff,10))
 return p

def rubble():
 rng=np.random.default_rng(2005);p=[]
 for i in range(10):
  if i==0:c=np.array([-.08,0,.02]);size=np.array([.40,.25,.30])
  else:
   a=2*math.pi*(i-1)/9;c=np.array([.43*math.cos(a),0,.24*math.sin(a)]);size=rng.uniform([.13,.09,.12],[.25,.20,.22])
  piece=stone('fragment_'+str(i),[0,0,0],size,rng);v=np.array(piece['v']);a=float(rng.uniform(-math.pi,math.pi));rot=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]]);v=v@rot.T;v[:,1]-=v[:,1].min();v+=c;piece['v']=v.tolist();p.append(piece)
 return p

def export(parts,door_asset=False):
 binary=bytearray();views=[];acc=[];meshes=[];nodes=[{'name':'AssetRoot','children':[]}];groups={}
 if door_asset:nodes.append({'name':'DoorLeafHinge','translation':PIVOT.tolist(),'children':[]});nodes[0]['children'].append(1)
 for p in parts:
  key=(p['group'],p['material']);g=groups.setdefault(key,{'v':[],'f':[]});v=np.array(p['v'])-(PIVOT if p['group']=='door_leaf' else 0);o=len(g['v']);g['v'].extend(v.tolist());g['f'].extend([[i+o for i in face] for face in p['f']])
 def add(a,bounds=False):
  offset=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':5126,'count':len(a),'type':'VEC3'}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  acc.append(d);return len(acc)-1
 for (group,mat),g in groups.items():
  tri=np.array(g['v'])[np.array(g['f'])];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(n,axis=1)
  if np.any(length<1e-10):raise ValueError('Degenerate triangle')
  n/=length[:,None];pa=add(tri.reshape(-1,3).astype('<f4'),True);na=add(np.repeat(n,3,axis=0).astype('<f4'));meshes.append({'name':group+'_'+str(mat),'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'material':mat,'mode':4}]});nodes.append({'name':group+'_material_'+str(mat),'mesh':len(meshes)-1});nodes[1 if group=='door_leaf' else 0]['children'].append(len(nodes)-1)
 doc={'asset':{'version':'2.0','generator':'GrimDark five-piece Python environment batch'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':meshes,'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.35 if name=='iron_dull' else 0,'roughnessFactor':.9}} for name,color in MATS],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':{'units':'meters','up':'Y','status':'draft; no engine verification'}}
 text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4);binary+=bytes((-len(binary))%4)
 return struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(binary),b'BIN\0')+binary

BUILDERS={'env_stone_wall_corner_a':corner,'env_stone_wall_low_broken_a':lowwall,'env_door_patched_a':door,'env_firewood_bundle_a':firewood,'env_rubble_stone_small_a':rubble}
EXPECTED=[1780,896,680,584,440]
HASHES={'env_stone_wall_corner_a': '1d1e1f35aece0d341158c9da31fa64a6ba6933e71b745e5e6b410ee1b9761952', 'env_stone_wall_low_broken_a': 'b61421c878db22ef3a19223669fa487dc63f9f3ec36f2eed487d4d33a86ce758', 'env_door_patched_a': '7e5c4571b75f38b615318ce63b2f68bf580e9a9cfe702f41fdc347e0776b14fe', 'env_firewood_bundle_a': 'c52fbb62487604e5337e86421ac1140585165173250d81e448f6de382e41f58a', 'env_rubble_stone_small_a': '3755524e346044cc41c8fa51b070baf232fe17bd34781d970f7efca386e5ff3e'}
def generate(folder):
 folder=Path(folder);outputs=[];records=[]
 for (name,builder),expected in zip(BUILDERS.items(),EXPECTED):
  p=builder();raw=export(p,name=='env_door_patched_a');v=np.concatenate([np.array(x['v']) for x in p]);count=sum(len(x['f']) for x in p)
  if count!=expected or not np.isfinite(v).all() or abs(v[:,1].min())>1e-8:raise ValueError('Geometry validation failed: '+name)
  if hashlib.sha256(raw).hexdigest()!=HASHES[name]:raise ValueError('Export hash changed; review tool versions: '+name)
  outputs.append((folder/'exports'/(name+'.glb'),raw));outputs.append((folder/'source'/(name+'.json'),json.dumps({'units':'meters','up':'Y','door_hinge':PIVOT.tolist() if name=='env_door_patched_a' else None,'parts':p},indent=2).encode()))
  records.append({'id':name,'file':'exports/'+name+'.glb','triangles':count,'dimensions_m':(v.max(0)-v.min(0)).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'status':'draft; no engine verification'})
 leaf=np.concatenate([np.array(p['v']) for p in door() if p['group']=='door_leaf'])
 for degrees in range(0,91,5):
  a=math.radians(degrees);r=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]]);v=(leaf-PIVOT)@r.T+PIVOT
  if not(v[:,0].min()>-.5 and v[:,0].max()<.5 and v[:,1].min()>0 and v[:,1].max()<2):raise ValueError('Door clear-opening check failed')
 outputs.append((folder/'generated-assets.json',json.dumps(records,indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing to overwrite changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 result=generate(Path(__file__).resolve().parents[1]/'assets/environment/env002')
 for item in result:print(item['id'],item['triangles'],item['sha256'])
