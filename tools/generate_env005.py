"""ENV-005 variations of ENV-003 wall, roof and fence assets.
Meters, Y-up; roof pivot remains the ridge anchor. No engine validation.
"""
from pathlib import Path
import numpy as np, math, json, struct, hashlib
from scipy.spatial import ConvexHull
MATS=[('wood_old',[.27,.20,.13,1]),('wood_mid',[.285,.215,.145,1]),('wood_dark',[.205,.16,.105,1]),('wood_repair',[.30,.235,.155,1]),('shingle_gray',[.235,.225,.19,1]),('shingle_light',[.28,.265,.22,1]),('shingle_dark',[.19,.185,.16,1])]
PITCH=.8/1.4

def part(name,v,f,mat):return {'name':name,'v':np.asarray(v).tolist(),'f':np.asarray(f).tolist(),'material':mat}
def box(name,c,size,mat,bevel=0):
 half=np.array(size)/2;c=np.array(c)
 if bevel:
  points=[];bevel=min(bevel,float(half.min())*.4)
  for axis in range(3):
   for sx in [-1,1]:
    for sy in [-1,1]:
     for sz in [-1,1]:
      signs=np.array([sx,sy,sz]);p=(half-bevel)*signs;p[axis]=half[axis]*signs[axis];points.append(p+c)
  v=np.array(points);h=ConvexHull(v);f=[]
  for face,plane in zip(h.simplices,h.equations):
   a,b,c=v[face]
   if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
   f.append(face.tolist())
  return part(name,v,f,mat)
 x,y,z=c;a,b,d=half
 v=[[x-a,y-b,z-d],[x+a,y-b,z-d],[x+a,y+b,z-d],[x-a,y+b,z-d],[x-a,y-b,z+d],[x+a,y-b,z+d],[x+a,y+b,z+d],[x-a,y+b,z+d]]
 f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 return part(name,v,f,mat)
def beam(name,a,b,width,depth,mat):
 a=np.array(a);b=np.array(b);d=b-a;length=np.linalg.norm(d);d/=length;s=np.cross(d,[0,0,1]);s/=np.linalg.norm(s);basis=np.column_stack([s,d,np.cross(s,d)])
 p=box(name,[0,0,0],[width,length,depth],mat,.003);p['v']=(np.array(p['v'])@basis.T+(a+b)/2).tolist();return p
def slab(name,x0,x1,z0,z1,offset,thickness,mat):
 y0=-PITCH*z0+offset;y1=-PITCH*z1+offset
 v=[[x0,y0-thickness,z0],[x1,y0-thickness,z0],[x1,y0,z0],[x0,y0,z0],[x0,y1-thickness,z1],[x1,y1-thickness,z1],[x1,y1,z1],[x0,y1,z1]]
 f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 return part(name,v,f,mat)
def wall(style):
 rng=np.random.default_rng(3001);p=[]
 for i in range(10):
  width=float(rng.uniform(.181,.187));mat=int(rng.choice([0,1,2],p=[.7,.25,.05]));p.append(box('siding_'+str(i),[-.9+i*.2,1.15,.035],[width,2.30,.045],mat))
 for x in [-.84,.84]:p.append(box('structural_post',[x,1.2,0],[.16,2.4,.16],2,.004))
 for y in [.08,2.32]:p.append(box('crossbeam',[0,y,0],[2,.16,.16],2,.004))
 if style=='crossbraced':
  p.append(beam('brace_up',[-.76,.20,-.072],[.76,2.15,-.072],.10,.075,0))
  p.append(beam('brace_down',[-.76,2.15,-.067],[.76,.20,-.067],.10,.055,1))
  p.append(box('repair_patch',[.20,.72,-.095],[.50,.13,.03],3,.003))
 else:
  p.append(beam('brace_reverse',[-.76,2.15,-.072],[.76,.20,-.072],.10,.075,0))
  for x,y,w in [(-.34,.64,.82),(.25,1.16,.78),(-.12,1.78,.65)]:p.append(box('repair_patch',[x,y,-.095],[w,.13,.03],3,.003))
 return p

def roof(style):
 rng=np.random.default_rng(5003);p=[slab('roof_deck',-1,1,0,1.4,-.015,.065,2)]
 rows=7 if style=='fine' else 5
 for row in range(rows):
  step=1.4/rows;z0=row*step;z1=min(1.4,z0+step+.04)
  if style=='fine':edges=[-1+i*.25 for i in range(9)] if row%2==0 else [-1]+[-.875+i*.25 for i in range(8)]+[1]
  else:edges=[-1,-.6,-.2,.2,.6,1] if row%2==0 else [-1,-.8,-.4,0,.4,.8,1]
  for col,(a,b) in enumerate(zip(edges[:-1],edges[1:])):p.append(slab('shingle_'+str(row)+'_'+str(col),a+.004,b-.004,z0,z1,.03-row*(.024/(rows-1)),.04,int(rng.choice([4,5,6],p=[.65,.2,.15]))))
 for x in [-.84,-.28,.28,.84]:p.append(slab('rafter',x-.045,x+.045,0,1.4,-.08,.12,2))
 if style=='patched':
  for x in [-.20,0,.20]:p.append(slab('timber_roof_patch',x-.094,x+.094,.48,1.4,.065,.07,3))
 return p

def fence(style):
 p=[box('fence_post',[x,.55,0],[.12,1.1,.12],2,.005) for x in [-.9,.9]]
 p.append(box('lower_rail',[0,.40,-.045],[2,.085,.055],0,.003))
 if style=='intact':p.append(box('upper_rail',[0,.83,-.045],[2,.085,.055],0,.003))
 else:
  p.append(box('old_upper_left',[-.56,.83,-.045],[.88,.085,.055],0,.003));p.append(box('old_upper_right',[.69,.82,-.045],[.62,.085,.055],1,.003))
  p.append(box('bridge_patch',[.10,.83,-.085],[.76,.105,.04],3,.003))
  p.append(box('patch_tie',[.10,.70,-.11],[.085,.35,.04],2,.003))
 return p
BUILDERS={'env_wall_plank_crossbraced_b':lambda:wall('crossbraced'),'env_wall_plank_repaired_c':lambda:wall('repaired'),'env_roof_shingle_fine_b':lambda:roof('fine'),'env_roof_shingle_timber_patch_c':lambda:roof('patched'),'env_fence_rail_intact_b':lambda:fence('intact'),'env_fence_rail_repaired_c':lambda:fence('repaired')}

def export(parts):
 groups={}
 for p in parts:
  g=groups.setdefault(p['material'],{'v':[],'f':[]});o=len(g['v']);g['v'].extend(p['v']);g['f'].extend([[i+o for i in face] for face in p['f']])
 binary=bytearray();views=[];acc=[];meshes=[]
 def add(a,bounds=False):
  offset=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':5126,'count':len(a),'type':'VEC3'}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  acc.append(d);return len(acc)-1
 for mat,g in groups.items():
  tri=np.array(g['v'])[np.array(g['f'])];normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(normal,axis=1)
  if np.any(length<1e-10):raise ValueError('Degenerate triangle')
  normal/=length[:,None];normal[np.abs(normal)<1e-12]=0;pa=add(tri.reshape(-1,3).astype('<f4'),True);na=add(np.repeat(normal,3,axis=0).astype('<f4'));meshes.append({'name':'material_'+str(mat),'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'material':mat,'mode':4}]})
 doc={'asset':{'version':'2.0','generator':'GrimDark ENV-005 variations'},'scene':0,'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'mesh':i} for i in range(len(meshes))],'meshes':meshes,'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.92}} for name,color in MATS],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':{'units':'meters','up':'Y','status':'draft; no engine testing'}}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=bytes((-len(binary))%4)
 return struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def generate(folder):
 folder=Path(folder);outputs=[];records=[]
 for name,builder in BUILDERS.items():
  parts=builder();v=np.concatenate([np.array(p['v']) for p in parts]);raw=bytes(export(parts));roof_asset=name.startswith('env_roof');wall_asset=name.startswith('env_wall')
  if not np.isfinite(v).all():raise ValueError('Nonfinite mesh')
  if not roof_asset and not np.isclose(v[:,1].min(),0):raise ValueError('Ground anchor mismatch')
  if wall_asset and not np.allclose(v.max(0)-v.min(0),[2,2.4,.19]):raise ValueError('Wall envelope changed')
  if roof_asset:
   r=np.concatenate([np.array(p['v']) for p in parts if p['name']=='rafter'])
   if not(np.isclose(r[:,1].min(),-1) and np.isclose(v[:,0].min(),-1) and np.isclose(v[:,0].max(),1) and np.isclose(v[:,2].max(),1.4)):raise ValueError('Roof connections changed')
  records.append({'id':name,'file':'exports/'+name+'.glb','bytes':len(raw),'triangles':sum(len(p['f']) for p in parts),'bounds_min_m':v.min(0).tolist(),'bounds_max_m':v.max(0).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'origin':'ridge anchor' if roof_asset else 'ground center','connections':[[-1,0,0],[1,0,0]],'collision':'not provided or tested'})
  outputs.append((folder/'exports'/(name+'.glb'),raw))
 outputs.append((folder/'manifest.json',json.dumps({'batch':'ENV-005','units':'meters','up':'Y','pitch':PITCH,'status':'draft; not engine tested','assets':records},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing to overwrite changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 for r in generate(Path(__file__).resolve().parents[1]/'assets/environment/env005'):print(r['id'],r['triangles'],r['sha256'])
