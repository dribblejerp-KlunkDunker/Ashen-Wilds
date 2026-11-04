"""ENV-009 original ruined masonry. 39 textured GLBs and static box wrappers.
Meters, Y-up. Validation results are produced separately by Godot CI.
"""
from pathlib import Path
import numpy as np,math,json,hashlib,struct,io
from PIL import Image
from scipy.spatial import ConvexHull
WALL=['low_wall','half_wall','ragged_tall','stepped_left','stepped_right','open_breach','window_remnant','short_return','corner_ruin','buttressed','collapsed_end','ground_course','jagged_breach']
PILLAR=['square_tall','square_half','square_stump','chipped_cap','stepped_base','octagonal','round_broken','split_square','leaning_remnant','fallen_column','segmented_fallen','gatepost_left','gatepost_right']
FLOOR=['paving_narrow','paving_wide','paving_broken','courtyard_corner','worn_threshold','broad_threshold','split_threshold','low_step','two_steps','three_steps','damaged_steps','cobbled_strip','raised_plinth']
PAL=[(95,91,80),(74,76,66),(111,105,91),(81,75,62)]
def atlas():
 rng=np.random.default_rng(9000);a=np.zeros((128,128,3),dtype='uint8');yy,xx=np.mgrid[:64,:64]
 for tile,color in enumerate(PAL):
  p=rng.integers(-9,10,(64,64)).astype(float)+5*np.sin(xx*.17+yy*.11);p-=14*((xx+2*yy+tile*3)%37<1);p-=8*((2*xx-yy)%53<1);a[tile//2*64:tile//2*64+64,tile%2*64:tile%2*64+64]=np.clip(np.array(color)[None,None,:]+p[:,:,None],0,255).astype('uint8')
 b=io.BytesIO();Image.fromarray(a).save(b,format='PNG',compress_level=9);return b.getvalue()
def hull(name,v,tile,tint):
 v=np.array(v);h=ConvexHull(v);f=[]
 for face,plane in zip(h.simplices,h.equations):
  a,b,c=v[face]
  if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
  f.append(face.tolist())
 return {'name':name,'v':v.tolist(),'f':f,'tile':tile,'tint':float(tint)}
def stone(rng,name,c,size,tile=0,yaw=0,chipped=True):
 half=np.array(size)/2;bevel=min(.018,float(half.min())*.30);v=[]
 for axis in range(3):
  for sx in [-1,1]:
   for sy in [-1,1]:
    for sz in [-1,1]:
     signs=np.array([sx,sy,sz]);b=bevel*float(rng.uniform(.65,1.35)) if chipped else bevel;q=(half-b)*signs;q[axis]=half[axis]*signs[axis];v.append(q)
 rot=np.array([[math.cos(yaw),0,math.sin(yaw)],[0,1,0],[-math.sin(yaw),0,math.cos(yaw)]]);return hull(name,np.array(v)@rot.T+np.array(c),tile,float(rng.uniform(.84,1.10)))
def box(name,c,size):return {'name':name,'center':list(c),'size':list(size),'basis':[1,0,0,0,1,0,0,0,1]}
def bounds_box(name,p):
 v=np.concatenate([q['v'] for q in p]);lo=v.min(0);hi=v.max(0);return box(name,((lo+hi)/2).tolist(),(hi-lo).tolist())
def transform(p,boxes,translation,yaw):
 rot=np.array([[math.cos(yaw),0,math.sin(yaw)],[0,1,0],[-math.sin(yaw),0,math.cos(yaw)]])
 for q in p:q['v']=(np.array(q['v'])@rot.T+translation).tolist()
 for b in boxes:b['center']=(np.array(b['center'])@rot.T+translation).tolist();old=np.array(b['basis']).reshape(3,3).T;b['basis']=(rot@old).T.reshape(-1).tolist()
 return p,boxes

def courses(rng,profile,depth=.32,width=2.,window=False):
 p=[];boxes=[];cell=width/len(profile)
 for row in range(max(profile)):
  active=[row<h and not(window and 3<=row<6 and 2<=i<6) for i,h in enumerate(profile)];runs=[];start=None
  for i,value in enumerate(active+[False]):
   if value and start is None:start=i
   if not value and start is not None:runs.append((start,i));start=None
  for run,(a,b) in enumerate(runs):
   left=-width/2+a*cell;right=-width/2+b*cell;edges=sorted(set([left]+[float(x) for x in np.arange(-width/2+(.2 if row%2 else .4),width/2,.4) if left+1e-6<x<right-1e-6]+[right]))
   if window and row==6 and left<-.5 and right>.5:edges=[left,-.65,.65,right]
   for x0,x1 in zip(edges[:-1],edges[1:]):
    d=depth*float(rng.uniform(.94,1.02));p.append(stone(rng,'wall_stone',[(x0+x1)/2,row*.3+.146,0],[max(.02,x1-x0-.008),.292,d],int(rng.choice([0,1],p=[.85,.15]))))
   boxes.append(box('Course'+str(row)+'Run'+str(run),[(left+right)/2,row*.3+.15,0],[right-left,.3,depth*1.03]))
 return p,boxes

def walls(i):
 rng=np.random.default_rng(9100+i);profiles=[[2]*8,[4]*8,[7,8,7,6,5,6,7,7],[8,7,6,5,4,3,2,1],[1,2,3,4,5,6,7,8],[6,5,0,0,0,0,5,6],[7]*8,[4]*8,[6,5,5,4,4,4,5,6],[6]*8,[6,6,5,4,3,2,1,1],[1]*8,[7,6,0,0,0,0,4,5]]
 p,boxes=courses(rng,profiles[i],window=i==6);role='window' if i==6 else 'breach' if i in [5,12] else 'fragment'
 if i in [7,8]:
  leg,bb=courses(rng,[3]*4 if i==7 else [6,6,5,5,4,4,3,3],width=1 if i==7 else 2);length=1 if i==7 else 2;leg,bb=transform(leg,bb,[-.84,0,length/2],-math.pi/2);p+=leg;boxes+=bb;role='corner'
 if i==9:
  support=[stone(rng,'buttress',[-.65,j*.5+.25,-.26],[w,.5,d],1) for j,(w,d) in enumerate([(.65,.8),(.55,.65),(.44,.50)])];p+=support;boxes.append(bounds_box('Buttress',support));role='buttress'
 info={'nominal_main_width_m':2.,'course_height_m':.3}
 if i in [5,12]:info['clear_breach']={'x_min':-.5,'x_max':.5,'no_overhead_lintel':True}
 if i==6:info['window_opening']={'x_min':-.5,'x_max':.5,'y_min':.9,'y_max':1.8,'not_walkable_doorway':True}
 return p,boxes,role,info

def column(rng,height,radius,sides=8):
 v=[]
 for j,y in enumerate([0,height*.52,height]):
  for i in range(sides):
   a=2*math.pi*i/sides;r=radius*(1-.09*j)*float(rng.uniform(.96,1.03));v.append([r*math.cos(a),y,r*math.sin(a)])
 return hull('column',v,0,float(rng.uniform(.9,1.05)))
def pillars(i):
 rng=np.random.default_rng(9200+i);p=[];role='upright'
 if i in [5,6]:
  h=2.1 if i==5 else 1.45;p=[stone(rng,'foot',[0,.12,0],[.65,.24,.65],2),column(rng,h,.24,8 if i==5 else 12)];p[1]['v']=(np.array(p[1]['v'])+[0,.20,0]).tolist()
 elif i in [9,10]:
  for j in range(5 if i==9 else 4):p.append(stone(rng,'fallen_segment',[-.85+j*.40,.20+(.025 if j%2 else 0),.035*math.sin(j)],[.39,.40,.43],0,yaw=.035*math.sin(j)))
  role='fallen'
 else:
  height=[2.4,1.2,.44,1.8,1.6,0,0,2.0,1.65,0,0,2.4,2.4][i]
  if i==4:p+=[stone(rng,'foot',[0,.10,0],[.85,.2,.80],2),stone(rng,'foot_step',[0,.27,0],[.65,.14,.62],2)]
  else:p.append(stone(rng,'foot',[0,.10,0],[.62,.20,.60],2))
  base=.34 if i==4 else .20;count=max(1,int(math.ceil((height-base)/.34)));step=(height-base)/count
  for j in range(count):
   w=.40*(1-.06*j/count)
   if i==7:
    for sign in [-1,1]:p.append(stone(rng,'split_shaft',[sign*.11,base+step*(j+.5),0],[.20,step-.006,.41],0))
   else:p.append(stone(rng,'shaft',[.018*math.sin(j+i),base+step*(j+.5),.012*math.cos(j)],[w,step-.006,.41],0))
  if i in [3,11,12]:p.append(stone(rng,'cap',[0,height+.06,0],[.68,.12,.62],2,yaw=.07 if i==3 else 0))
  if i in [11,12]:p.append(stone(rng,'gate_socket',[(-1 if i==11 else 1)*.27,height*.70,0],[.18,.25,.32],1))
  if i==8:
   a=.18;rot=np.array([[math.cos(a),-math.sin(a),0],[math.sin(a),math.cos(a),0],[0,0,1]])
   for q in p:q['v']=(np.array(q['v'])@rot.T).tolist()
   role='leaning'
 boxes=[bounds_box('PillarProxy',p)] if role!='fallen' else [bounds_box('Segment'+str(j),[q]) for j,q in enumerate(p)]
 return p,boxes,role,{'decorative_cracks_not_enterable':i==7}

def floors(i):
 rng=np.random.default_rng(9300+i);p=[];boxes=[];info={};role='paving'
 if i in [0,1,2,3,11]:
  width=.9 if i in [0,11] else 1.8;length=2.;nx=3 if width<1 else 5;nz=5 if i!=11 else 8;dx=width/nx;dz=length/nz
  for z in range(nz):
   for x in range(nx):
    if i==2 and (x,z) in [(0,0),(4,4),(2,2),(3,1)]:continue
    if i==3 and x>=2 and z>=2:continue
    h=.105 if i!=11 else float(rng.uniform(.075,.11));p.append(stone(rng,'paver',[-width/2+dx*(x+.5),h/2,-length/2+dz*(z+.5)],[dx-.014,h,dz-.014],2 if i!=11 else 0))
  boxes=[box('PavingLegX',[0,.055,-.60],[width,.11,.8]),box('PavingLegZ',[-.54,.055,.40],[.72,.11,1.2])] if i==3 else [box('PavingProxy',[0,.055,0],[width,.11,length])]
  info={'surface_height_m':.11,'missing_tile_holes_simplified':i==2,'L_shaped_footprint':i==3}
 elif i in [4,5,6]:
  width=[.95,1.4,1.2][i-4];depth=.40 if i==4 else .50
  if i==6:
   for sign in [-1,1]:p.append(stone(rng,'threshold_half',[sign*width*.25,.075,0],[width*.5-.015,.15,depth],2))
  else:p.append(stone(rng,'threshold',[0,.075,0],[width,.15,depth],2))
  boxes=[box('Threshold',[0,.075,0],[width,.15,depth])];role='threshold';info={'surface_height_m':.15,'decorative_crack_simplified':i==6}
 elif i in [7,8,9,10]:
  count=1 if i==7 else 2 if i==8 else 3;run=.34;rise=.15
  for j in range(count):
   z=-count*run/2+run*(j+.5);p.append(stone(rng,'tread',[0,rise*(j+1)/2,z],[1.192,rise*(j+1),run-.008],2));boxes.append(box('Tread'+str(j),[0,rise*(j+1)/2,z],[1.2,rise*(j+1),run]))
   if i==10 and j==2:p[-1]['v']=(np.array(p[-1]['v'])*[.86,1,1]+[.07,0,0]).tolist();boxes[-1]['size'][0]=1.04;boxes[-1]['center'][0]=.07
  role='stairs';info={'tread_count':count,'rise_m':rise,'run_m':run,'ascending_local_direction':'+Z','player_step_behavior_not_tested':True}
 else:
  p=[stone(rng,'plinth',[0,.10,0],[1.5,.2,1.1],0),stone(rng,'plinth_top',[0,.25,0],[1.35,.1,.95],2)];boxes=[bounds_box('Plinth',p)];role='plinth';info={'surface_height_m':.30}
 return p,boxes,role,info

def finalize(p,boxes):
 v=np.concatenate([q['v'] for q in p]);lo=v.min(0);hi=v.max(0);offset=np.array([-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2])
 for q in p:q['v']=(np.array(q['v'])+offset).tolist()
 for b in boxes:b['center']=(np.array(b['center'])+offset).tolist()
 return p,boxes,offset

def export(parts,png,name):
 vertices=[];normals=[];uvs=[];colors=[]
 for p in parts:
  v=np.array(p['v']);tri=v[np.array(p['f'])];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(n,axis=1)
  if np.any(length<1e-10):raise ValueError('Degenerate faces')
  n/=length[:,None];lo=v.min(0);span=np.maximum(v.max(0)-lo,1e-9)
  for t,normal in zip(tri,n):
   axes=[j for j in range(3) if j!=int(np.argmax(np.abs(normal)))];uv=.04+.92*np.clip((t[:,axes]-lo[axes])/span[axes],0,1);uv[:,0]=(p['tile']%2+uv[:,0])/2;uv[:,1]=(p['tile']//2+uv[:,1])/2;uvs.extend(uv)
  vertices.extend(tri.reshape(-1,3));normals.extend(np.repeat(n,3,axis=0));c=int(np.clip(p['tint']*220,0,255));colors.extend([[c,c,c,255]]*(len(tri)*3))
 binary=bytearray();views=[];access=[]
 def add(a,kind,component=5126,bounds=False):
  binary.extend(b'\0'*((-len(binary))%4));off=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':component,'count':len(a),'type':kind}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  if component==5121:d['normalized']=True
  access.append(d);return len(access)-1
 pa=add(np.array(vertices,dtype='<f4'),'VEC3',bounds=True);na=add(np.array(normals,dtype='<f4'),'VEC3');ua=add(np.array(uvs,dtype='<f4'),'VEC2');ca=add(np.array(colors,dtype='uint8'),'VEC4',5121);binary.extend(b'\0'*((-len(binary))%4));off=len(binary);binary.extend(png);views.append({'buffer':0,'byteOffset':off,'byteLength':len(png)})
 doc={'asset':{'version':'2.0','generator':'Ashen ENV-009 ruined masonry'},'scene':0,'scenes':[{'name':name,'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na,'TEXCOORD_0':ua,'COLOR_0':ca},'material':0}]}],'materials':[{'name':'weathered_masonry','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.98}}],'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9728,'minFilter':9728,'wrapS':33071,'wrapT':33071}],'images':[{'mimeType':'image/png','bufferView':len(views)-1}],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':access,'extras':{'units':'meters','up':'Y','engine_validated':False}}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4));return struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def scene(name,boxes):
 def nums(v):return ', '.join(format(x,'.12g') for x in v)
 lines=['[gd_scene load_steps='+str(len(boxes)+2)+' format=3]','', '[ext_resource type="PackedScene" path="res://assets/environment/env009/exports/'+name+'.glb" id="1_visual"]','']
 for j,b in enumerate(boxes):lines+=['[sub_resource type="BoxShape3D" id="Box_'+str(j)+'"]','size = Vector3('+nums(b['size'])+')','']
 lines+=['[node name="'+name+'" type="StaticBody3D"]','collision_layer = 1','collision_mask = 0','metadata/engine_validated = false','', '[node name="Visual" parent="." instance=ExtResource("1_visual")]','']
 for j,b in enumerate(boxes):lines+=['[node name="Proxy'+str(j)+'" type="CollisionShape3D" parent="."]','transform = Transform3D('+nums(b['basis']+b['center'])+')','shape = SubResource("Box_'+str(j)+'")','']
 return '\n'.join(lines)

def generate(folder):
 folder=Path(folder);png=atlas();outputs=[(folder/'textures/env009_atlas.png',png)];records=[];geoms=set()
 for family,names,builder in [('walls',WALL,walls),('pillars',PILLAR,pillars),('surfaces',FLOOR,floors)]:
  for i,style in enumerate(names):
   p,boxes,role,info=builder(i);p,boxes,offset=finalize(p,boxes);name='env_ruin_'+family+'_'+str(i+1).zfill(2)+'_'+style;raw=bytes(export(p,png,name));v=np.concatenate([q['v'] for q in p]);geom=hashlib.sha256(json.dumps([(q['v'],q['f']) for q in p],separators=(',',':')).encode()).hexdigest()
   if geom in geoms or not np.isfinite(v).all() or not np.isclose(v[:,1].min(),0):raise ValueError('Geometry check failed')
   geoms.add(geom)
   for b in boxes:
    if min(b['size'])<=0:raise ValueError('Invalid proxy')
   r={'id':name,'family':family,'style':style,'role':role,'file':'exports/'+name+'.glb','scene':'scenes/'+name+'.tscn','origin':'ground-centered footprint','triangles':sum(len(q['f']) for q in p),'bounds_min_m':v.min(0).tolist(),'bounds_max_m':v.max(0).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'geometry_sha256':geom,'reference_offset_m':offset.tolist(),'placement':info,'collision_boxes':boxes,'engine_validated':False};records.append(r);outputs.extend([(folder/r['file'],raw),(folder/r['scene'],scene(name,boxes).encode())])
 if len(records)!=39 or sum(len(r['collision_boxes']) for r in records)!=140:raise ValueError('Batch counts changed')
 outputs.append((folder/'manifest.json',json.dumps({'batch':'ENV-009','models':39,'units':'meters','up':'Y','atlas_dimensions':[128,128],'atlas_sha256':hashlib.sha256(png).hexdigest(),'status':'draft; engine validation pending','assets':records},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_bytes(raw);tmp.replace(path)
 return records
if __name__=='__main__':
 import sys
 for r in generate(Path(sys.argv[1]) if len(sys.argv)>1 else Path('ENV-009')):print(r['id'],r['triangles'],r['sha256'])
