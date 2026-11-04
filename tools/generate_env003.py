"""ENV-003 timber and roof source assets. Python + NumPy + SciPy.
Meters, Y-up. Roof origins are ridge anchors, not ground-level pivots.
"""
from pathlib import Path
import numpy as np, math, json, struct, hashlib, copy
from scipy.spatial import ConvexHull
MATS=[('wood_old',[.27,.20,.13,1]),('wood_mid',[.285,.215,.145,1]),('wood_dark',[.205,.16,.105,1]),('wood_repair',[.30,.235,.155,1]),('shingle_gray',[.235,.225,.19,1]),('shingle_light',[.28,.265,.22,1]),('shingle_dark',[.19,.185,.16,1])]
PITCH=.8/1.4
HASHES={'env_wall_plank_a': '854afd02bf98e5c6d1cd38adb987bcc2cb9627c61500e67bd3fbd0abe930a2a1', 'env_post_timber_a': 'bf015de453075e2da47fed8193efc3376706438373ecd7cc56f8075b37589113', 'env_roof_shingle_slope_a': '80ad04ff0e423dd88e93d13352d6e8cfefcef0f8d76f130b8a0d21b72874307d', 'env_roof_ridge_cap_a': 'dac4ab6721f045c4bbfd118d18d5519bdc9f2fc6bb3896d36de28f7d9f0a6d1b', 'env_fence_rail_broken_a': '022312c48cb9ea6e9f9963bff679a2f6ab39c8f0c8b0d15389ba4674007c5581'}
def part(name,v,f,mat):
 return {'name':name,'v':np.asarray(v).tolist(),'f':np.asarray(f).tolist(),'material':mat}
def hull(name,v,mat):
 v=np.array(v);h=ConvexHull(v);f=[]
 for face,plane in zip(h.simplices,h.equations):
  a,b,c=v[face]
  if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
  f.append(face.tolist())
 return part(name,v,f,mat)
def box(name,c,size,mat,bevel=0):
 half=np.array(size)/2;c=np.array(c)
 if bevel:
  points=[];bevel=min(bevel,float(half.min())*.4)
  for axis in range(3):
   for sx in [-1,1]:
    for sy in [-1,1]:
     for sz in [-1,1]:
      signs=np.array([sx,sy,sz]);p=(half-bevel)*signs;p[axis]=half[axis]*signs[axis];points.append(p+c)
  return hull(name,points,mat)
 x,y,z=c;a,b,d=half
 v=[[x-a,y-b,z-d],[x+a,y-b,z-d],[x+a,y+b,z-d],[x-a,y+b,z-d],[x-a,y-b,z+d],[x+a,y-b,z+d],[x+a,y+b,z+d],[x-a,y+b,z+d]]
 f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 return part(name,v,f,mat)
def beam(name,a,b,width,depth,mat,bevel=.003):
 a=np.array(a);b=np.array(b);direction=b-a;length=np.linalg.norm(direction);direction/=length
 side=np.cross(direction,[0,0,1]);side/=np.linalg.norm(side);third=np.cross(side,direction);basis=np.column_stack([side,direction,third])
 p=box(name,[0,0,0],[width,length,depth],mat,bevel);p['v']=(np.array(p['v'])@basis.T+(a+b)/2).tolist();return p

def plank_wall():
 rng=np.random.default_rng(3001);p=[]
 for i in range(10):
  width=float(rng.uniform(.181,.187));x=-.9+i*.2
  p.append(box('siding_'+str(i),[x,1.15,.035],[width,2.30,.045],int(rng.choice([0,1,2],p=[.7,.25,.05]))))
 for x in [-.84,.84]:p.append(box('structural_post',[x,1.2,0],[.16,2.4,.16],2,.004))
 for y in [.08,2.32]:p.append(box('crossbeam',[0,y,0],[2,.16,.16],2,.004))
 p.append(beam('diagonal_brace',[-.76,.20,-.072],[.76,2.15,-.072],.10,.075,0,.003))
 p.append(box('repair_patch',[.20,.72,-.095],[.50,.13,.03],3,.003))
 return p

def support_post():
 p=box('tapered_post',[0,1.2,0],[.18,2.4,.18],0,.004);v=np.array(p['v']);scale=1-.15*(v[:,1]/2.4);v[:,0]*=scale;v[:,2]*=scale
 return [hull('tapered_post',v,0)]

def slope_slab(name,x0,x1,z0,z1,offset,thickness,mat,direction=1):
 z0*=direction;z1*=direction;y0=-PITCH*abs(z0)+offset;y1=-PITCH*abs(z1)+offset
 v=[[x0,y0-thickness,z0],[x1,y0-thickness,z0],[x1,y0,z0],[x0,y0,z0],[x0,y1-thickness,z1],[x1,y1-thickness,z1],[x1,y1,z1],[x0,y1,z1]]
 f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 if direction<0:f=[[a,c,b] for a,b,c in f]
 return part(name,v,f,mat)
def roof_slope():
 rng=np.random.default_rng(3003);p=[slope_slab('roof_deck',-1,1,0,1.4,-.015,.065,2)]
 for row in range(5):
  z0=row*.28;z1=min(1.4,z0+.32);edges=[-1,-.6,-.2,.2,.6,1] if row%2==0 else [-1,-.8,-.4,0,.4,.8,1]
  for col,(a,b) in enumerate(zip(edges[:-1],edges[1:])):
   p.append(slope_slab('shingle_'+str(row)+'_'+str(col),a+.004,b-.004,z0,z1,.03-row*.006,.04,int(rng.choice([4,5,6],p=[.65,.2,.15]))))
 for x in [-.84,-.28,.28,.84]:p.append(slope_slab('rafter',x-.045,x+.045,0,1.4,-.08,.12,2))
 return p

def ridge_cap():
 return [slope_slab('cap_positive',-1,1,0,.22,.04,.035,4),slope_slab('cap_negative',-1,1,0,.22,.04,.035,4,-1)]

def broken_fence():
 p=[]
 for x in [-.9,.9]:p.append(box('fence_post',[x,.55,0],[.12,1.1,.12],2,.005))
 p.append(box('lower_rail',[0,.40,-.045],[2,.085,.055],0,.003))
 p.append(box('broken_upper_left',[-.56,.83,-.045],[.88,.085,.055],0,.003))
 p.append(box('broken_upper_right',[.69,.82,-.045],[.62,.085,.055],1,.003))
 fallen=beam('fallen_rail',[-.16,.06,.19],[.48,.06,.34],.075,.055,1,.003);v=np.array(fallen['v']);v[:,1]-=v[:,1].min();fallen['v']=v.tolist();p.append(fallen)
 return p

BUILDERS={'env_wall_plank_a':plank_wall,'env_post_timber_a':support_post,'env_roof_shingle_slope_a':roof_slope,'env_roof_ridge_cap_a':ridge_cap,'env_fence_rail_broken_a':broken_fence}
EXPECTED=[384,44,384,24,264]
META={
 'env_wall_plank_a':{'origin':'ground center','nominal_module_width':2,'nominal_height':2.4,'connection_points':[[-1,0,0],[1,0,0]]},
 'env_post_timber_a':{'origin':'ground center','connection_points':[[0,0,0],[0,2.4,0]]},
 'env_roof_shingle_slope_a':{'origin':'ridge connection at local zero','nominal_length':2,'run':1.4,'rise':.8,'slope_ratio':PITCH,'ridge_line':[[-1,0,0],[1,0,0]],'eave_surface_line':[[-1,-.8,1.4],[1,-.8,1.4]],'eave_rafter_underside_line':[[-1,-1,1.4],[1,-1,1.4]]},
 'env_roof_ridge_cap_a':{'origin':'ridge connection at local zero','nominal_length':2,'slope_ratio':PITCH},
 'env_fence_rail_broken_a':{'origin':'ground center of standing fence','nominal_module_width':2,'passability':'Unspecified: broken upper rail does not imply a walkable opening'}
}

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
  normal/=length[:,None];pa=add(tri.reshape(-1,3).astype('<f4'),True);na=add(np.repeat(normal,3,axis=0).astype('<f4'));meshes.append({'name':'material_'+str(mat),'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'material':mat,'mode':4}]})
 doc={'asset':{'version':'2.0','generator':'GrimDark ENV-003 Python mesh generator'},'scene':0,'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'mesh':i} for i in range(len(meshes))],'meshes':meshes,'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.92}} for name,color in MATS],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':{'units':'meters','up':'Y','status':'draft; no engine testing'}}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=bytes((-len(binary))%4)
 return struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def placed(assets,name,translation,yaw=0,prefix=''):
 p=copy.deepcopy(assets[name]);a=math.radians(yaw);r=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]])
 for item in p:item['v']=(np.array(item['v'])@r.T+translation).tolist();item['name']=prefix+item['name']
 return p

def generate(folder):
 folder=Path(folder);assets={};records=[];outputs=[]
 for (name,builder),expected in zip(BUILDERS.items(),EXPECTED):
  p=builder();assets[name]=p;raw=bytes(export(p));v=np.concatenate([np.array(item['v']) for item in p]);count=sum(len(item['f']) for item in p)
  if count!=expected or not np.isfinite(v).all():raise ValueError('Geometry validation failed: '+name)
  if 'roof_' not in name and abs(v[:,1].min())>1e-8:raise ValueError('Ground contact failed: '+name)
  if HASHES and hashlib.sha256(raw).hexdigest()!=HASHES[name]:raise ValueError('Export hash changed; review tool versions: '+name)
  outputs.extend([(folder/'exports'/(name+'.glb'),raw),(folder/'source'/(name+'.json'),json.dumps({'units':'meters','up':'Y','metadata':META[name],'parts':p},indent=2).encode())])
  records.append({'id':name,'file':'exports/'+name+'.glb','triangles':count,'dimensions_m':(v.max(0)-v.min(0)).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'placement':META[name],'status':'draft; no engine testing'})
 roof_vertices=np.concatenate([np.array(p['v']) for p in assets['env_roof_shingle_slope_a'] if p['name']=='rafter'])
 post_vertices=np.concatenate([np.array(p['v']) for p in assets['env_post_timber_a']])
 if not np.isclose(3.4+roof_vertices[:,1].min(),post_vertices[:,1].max()):raise ValueError('Eave support alignment failed')
 assembly=placed(assets,'env_wall_plank_a',np.array([0,0,1.4]),0,'back_')
 for x in [-.84,.84]:assembly+=placed(assets,'env_post_timber_a',np.array([x,0,-1.4]),0,'front_post_')
 assembly+=placed(assets,'env_roof_shingle_slope_a',np.array([0,3.4,0]),0,'roof_positive_')
 assembly+=placed(assets,'env_roof_shingle_slope_a',np.array([0,3.4,0]),180,'roof_negative_')
 assembly+=placed(assets,'env_roof_ridge_cap_a',np.array([0,3.4,0]),0,'ridge_')
 assembly+=placed(assets,'env_fence_rail_broken_a',np.array([1.8,0,-.6]),90,'fence_')
 outputs.append((folder/'review/shelter_assembly_reference.glb',bytes(export(assembly))))
 outputs.append((folder/'generated-assets.json',json.dumps(records,indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing to overwrite changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 result=generate(Path(__file__).resolve().parents[1]/'assets/environment/env003')
 for item in result:print(item['id'],item['triangles'],item['sha256'])
