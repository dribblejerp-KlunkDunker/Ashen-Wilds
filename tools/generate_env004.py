"""ENV-004 plank doorway source. Python + NumPy + SciPy; meters, Y-up.
Reference door reconstructed from recorded ENV-002 geometry, not recovered bytes.
"""
from pathlib import Path
import numpy as np, math, json, struct, hashlib
from scipy.spatial import ConvexHull
MATS=[('wood_old',[.27,.20,.13,1]),('wood_mid',[.285,.215,.145,1]),('wood_dark',[.205,.16,.105,1]),('wood_repair',[.30,.235,.155,1]),('iron_dull',[.13,.14,.125,1])]
OPEN_HALF=.63
OPEN_HEIGHT=2.16
HINGE=np.array([-.47,0,-.095])
HASHES={'env_wall_plank_doorway_a': '07814e6ee95c2212a41e1d9b5ecd954ea1bd79194e333106b63171d216761390', 'doorway_with_reference_door': '99431dafb63b0ff68d67bf9712f94d2dacfc6b849f4117d5d3b61c60583bf238'}
def hull(name,points,mat,group='root'):
 v=np.array(points);h=ConvexHull(v);f=[]
 for face,plane in zip(h.simplices,h.equations):
  a,b,c=v[face]
  if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
  f.append(face.tolist())
 return {'name':name,'v':v.tolist(),'f':f,'material':mat,'group':group}
def box(name,c,size,mat,bevel=0,group='root'):
 half=np.array(size)/2;c=np.array(c)
 if bevel:
  points=[];bevel=min(bevel,float(half.min())*.4)
  for axis in range(3):
   for sx in [-1,1]:
    for sy in [-1,1]:
     for sz in [-1,1]:
      signs=np.array([sx,sy,sz]);p=(half-bevel)*signs;p[axis]=half[axis]*signs[axis];points.append(p+c)
  return hull(name,points,mat,group)
 x,y,z=c;a,b,d=half
 v=[[x-a,y-b,z-d],[x+a,y-b,z-d],[x+a,y+b,z-d],[x-a,y+b,z-d],[x-a,y-b,z+d],[x+a,y-b,z+d],[x+a,y+b,z+d],[x-a,y+b,z+d]]
 f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 return {'name':name,'v':v,'f':f,'material':mat,'group':group}
def doorway():
 rng=np.random.default_rng(3001);p=[]
 for i in range(10):
  width=float(rng.uniform(.181,.187));x=-.9+i*.2;mat=int(rng.choice([0,1,2],p=[.7,.25,.05]));left=x-width/2;right=x+width/2
  for side,(a,b) in enumerate([(left,min(right,-OPEN_HALF)),(max(left,OPEN_HALF),right)]):
   if b-a>.005:p.append(box('side_siding_'+str(i)+'_'+str(side),[(a+b)/2,1.15,.035],[b-a,2.30,.045],mat))
  a=max(left,-OPEN_HALF);b=min(right,OPEN_HALF)
  if b-a>.005:p.append(box('header_infill_'+str(i),[(a+b)/2,(OPEN_HEIGHT+2.30)/2,.035],[b-a,2.30-OPEN_HEIGHT,.045],mat))
 for x in [-.84,.84]:p.append(box('structural_post',[x,1.2,0],[.16,2.4,.16],2,.004))
 p.append(box('structural_header',[0,2.32,0],[2,.16,.16],2,.004))
 for side in [-1,1]:
  center=side*(1+OPEN_HALF)/2
  p.append(box('split_bottom_rail',[center,.08,0],[1-OPEN_HALF,.16,.16],2,.004))
  p.append(box('side_repair_patch',[center,.75,-.095],[.26,.10,.03],3,.003))
 return p

def lathe(name,profile,mat,n=8):
 v=np.array([[r*math.cos(2*math.pi*i/n),y,r*math.sin(2*math.pi*i/n)] for r,y in profile for i in range(n)]);f=[]
 for j in range(len(profile)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n
   for t in [[a,c,b],[a,d,c]]:
    if np.linalg.norm(np.cross(v[t[1]]-v[t[0]],v[t[2]]-v[t[0]]))>1e-12:f.append(t)
 return {'name':name,'v':v.tolist(),'f':f,'material':mat,'group':'root'}
def reference_door():
 p=[box('left_jamb',[-.56,1,0],[.12,2,.16],2,.004),box('right_jamb',[.56,1,0],[.12,2,.16],2,.004),box('header',[0,2.075,0],[1.24,.15,.16],2,.004)]
 for i in range(5):p.append(box('door_board_'+str(i),[-.376+i*.188,.995,0],[.180,1.95,.055],0 if i!=3 else 1,.002,'door_leaf'))
 for y in [.34,1.64]:p.append(box('cross_rail',[0,y,-.039],[.92,.10,.025],2,.003,'door_leaf'))
 p.append(box('repair_patch',[.10,.93,-.041],[.39,.09,.028],1,.003,'door_leaf'));p.append(box('latch',[.34,1.05,-.055],[.08,.05,.027],4,.002,'door_leaf'))
 for y in [.40,1.58]:
  pin=lathe('hinge_pin',[(0,y-.035),(.012,y-.035),(.012,y+.035),(0,y+.035)],4);pin['v']=(np.array(pin['v'])+HINGE).tolist();p.append(pin)
  p.append(box('hinge_strap',[-.335,y,-.050],[.27,.045,.028],4,.002,'door_leaf'))
 return p

def export(parts,hinged=False):
 binary=bytearray();views=[];acc=[];meshes=[];nodes=[{'name':'AssetRoot','children':[]}];groups={}
 if hinged:nodes.append({'name':'DoorLeafHinge','translation':HINGE.tolist(),'children':[]});nodes[0]['children'].append(1)
 for p in parts:
  key=(p['group'],p['material']);g=groups.setdefault(key,{'v':[],'f':[]});v=np.array(p['v'])-(HINGE if p['group']=='door_leaf' else 0);o=len(g['v']);g['v'].extend(v.tolist());g['f'].extend([[i+o for i in f] for f in p['f']])
 def add(a,bounds=False):
  offset=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':5126,'count':len(a),'type':'VEC3'}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  acc.append(d);return len(acc)-1
 for (group,mat),g in groups.items():
  tri=np.array(g['v'])[np.array(g['f'])];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(n,axis=1)
  if np.any(length<1e-10):raise ValueError('Degenerate triangle')
  n/=length[:,None];pa=add(tri.reshape(-1,3).astype('<f4'),True);na=add(np.repeat(n,3,axis=0).astype('<f4'));meshes.append({'name':group+'_'+str(mat),'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'material':mat,'mode':4}]});nodes.append({'name':group+'_material_'+str(mat),'mesh':len(meshes)-1});nodes[1 if group=='door_leaf' else 0]['children'].append(len(nodes)-1)
 doc={'asset':{'version':'2.0','generator':'GrimDark ENV-004 doorway'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':nodes,'meshes':meshes,'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.35 if name=='iron_dull' else 0,'roughnessFactor':.92 if name not in ['iron_dull'] else .9}} for name,color in MATS],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':{'units':'meters','up':'Y','status':'draft; no engine validation'}}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=bytes((-len(binary))%4)
 return struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def generate(folder):
 folder=Path(folder);wall=doorway();door=reference_door();points=np.concatenate([np.array(p['v']) for p in wall])
 if sum(len(p['f']) for p in wall)!=452 or not np.allclose(points.max(0)-points.min(0),[2,2.4,.19]):raise ValueError('Wall dimensions or count changed')
 for p in wall:
  v=np.array(p['v']);lo=v.min(0);hi=v.max(0)
  if not(hi[0]<=-.63+1e-9 or lo[0]>=.63-1e-9 or lo[1]>=2.16-1e-9):raise ValueError('Wall blocks opening')
 leaf=np.concatenate([np.array(p['v']) for p in door if p['group']=='door_leaf']);rel=leaf-HINGE
 if rel[:,0].min()<-1e-12 or rel[:,2].min()<-1e-12:raise ValueError('Invalid hinge-envelope assumptions')
 min_x=float(HINGE[0]+np.minimum(rel[:,0],rel[:,2]).min());max_x=float(HINGE[0]+np.linalg.norm(rel[:,[0,2]],axis=1).max())
 if not(min_x>-.5 and max_x<.5 and leaf[:,1].min()>0 and leaf[:,1].max()<2):raise ValueError('Leaf envelope does not clear frame')
 for angle in range(0,91,5):
  a=math.radians(angle);r=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]]);v=rel@r.T+HINGE
  if not(v[:,0].min()>-.5 and v[:,0].max()<.5):raise ValueError('Sampled door pose failed')
 outputs=[];records=[]
 for name,p,hinged,subdir in [('env_wall_plank_doorway_a',wall,False,'exports'),('doorway_with_reference_door',wall+door,True,'review')]:
  raw=bytes(export(p,hinged));sha=hashlib.sha256(raw).hexdigest()
  if HASHES and sha!=HASHES[name]:raise ValueError('Export hash changed; review versions: '+name)
  outputs.append((folder/subdir/(name+'.glb'),raw));records.append({'id':name,'file':subdir+'/'+name+'.glb','triangles':sum(len(x['f']) for x in p),'sha256':sha})
 outputs.append((folder/'source/env_wall_plank_doorway_a.json',json.dumps({'units':'meters','up':'Y','origin':'ground center','opening_width':1.26,'opening_height':2.16,'parts':wall},indent=2).encode()))
 outputs.append((folder/'generated-assets.json',json.dumps({'status':'draft; no engine validation','assets':records,'hinge':HINGE.tolist(),'continuous_leaf_x_bounds':[min_x,max_x],'sampled_poses':19,'collision_proposals':[{'center':[-.815,1.2,-.015],'size':[.37,2.4,.19]},{'center':[.815,1.2,-.015],'size':[.37,2.4,.19]},{'center':[0,2.28,-.015],'size':[1.26,.24,.19]}]},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing to overwrite changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 for item in generate(Path(__file__).resolve().parents[1]/'assets/environment/env004'):print(item['id'],item['triangles'],item['sha256'])
