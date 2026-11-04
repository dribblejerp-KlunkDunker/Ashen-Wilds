"""ENV-008: 39 UV-textured nature assets and static/decorative wrappers.
Recorded procedural designs; requires NumPy, SciPy, Pillow and existing scene writer.
"""
from pathlib import Path
import numpy as np,math,json,struct,hashlib,io
from PIL import Image
from scipy.spatial import ConvexHull
from env_variation_common import load
PAL=[(69,56,43),(112,89,59),(94,94,85),(91,86,75),(107,101,62),(72,83,48),(86,67,43),(66,53,40)]
TREE=['straight_snag','forked_dead','wind_bent','gnarled','snapped_crown','split_trunk','sparse_leaf','fallen_long','fallen_branched','fallen_short','stump_low','stump_tall','stump_rooted']
ROCK=['small_chip','small_stone','medium_boulder','standing_rock','flat_boulder','pebble_scatter','stone_cluster','large_outcrop','weathered_cluster','masonry_chips','low_masonry_rubble','wallfall_rubble','broken_pillar']
GROUND=['grass_sparse','grass_medium','grass_dense','grass_trampled','sedge_tall','weeds_dry','weeds_broadleaf','leaves_sparse','leaves_dense','twigs_sparse','twigs_dense','roots_thin','roots_spreading']
def atlas():
 rng=np.random.default_rng(8000);image=np.zeros((128,256,3),dtype='uint8');yy,xx=np.mgrid[:64,:64]
 for tile,color in enumerate(PAL):
  pattern=rng.integers(-9,10,size=(64,64)).astype(float)
  if tile in [0,7]:pattern+=10*np.sin(xx*.65+3*np.sin(yy*.05));pattern-=15*((xx+np.floor(2*np.sin(yy*.09)))%13<2)
  elif tile==1:pattern+=12*np.sin(np.sqrt((xx-32)**2+(yy-32)**2)*1.5)
  elif tile in [2,3]:pattern+=6*np.sin(xx*.18+yy*.13);pattern-=12*((xx+2*yy)%29==0)
  else:pattern+=6*np.sin(xx*.55+yy*.4)
  image[tile//4*64:tile//4*64+64,tile%4*64:tile%4*64+64]=np.clip(np.array(color)[None,None,:]+pattern[:,:,None],0,255).astype('uint8')
 buf=io.BytesIO();Image.fromarray(image).save(buf,format='PNG',compress_level=9);return buf.getvalue()
def piece(name,v,f,tile,uv=None,tint=1.,foliage=False):
 v=np.array(v,dtype=float)
 if uv is None:
  axes=np.argsort(np.ptp(v,axis=0))[-2:];q=v[:,axes];uv=(q-q.min(0))/np.maximum(q.max(0)-q.min(0),1e-9)
 uv=.04+.92*np.clip(np.asarray(uv,dtype=float),0,1);uv[:,0]=(tile%4+uv[:,0])/4;uv[:,1]=(tile//4+uv[:,1])/2
 return {'name':name,'v':v.tolist(),'f':np.array(f,dtype=int).tolist(),'uv':uv.tolist(),'tint':float(tint),'foliage':foliage}
def tube(p,name,centers,radii,tile=0,n=7,tint=1.):
 centers=np.array(centers,dtype=float);d=centers[-1]-centers[0];d/=np.linalg.norm(d);ref=[0,0,1] if abs(d[2])<.9 else [1,0,0];x=np.cross(d,ref);x/=np.linalg.norm(x);z=np.cross(x,d);v=[];uv=[];f=[]
 for j,(c,r) in enumerate(zip(centers,radii)):
  for i in range(n):
   a=2*math.pi*i/n;v.append(c+r*(math.cos(a)*x+math.sin(a)*z));uv.append([i/(n-1),j/(len(centers)-1)])
 for j in range(len(centers)-1):
  for i in range(n):
   a=j*n+i;b=j*n+(i+1)%n;c=b+n;e=a+n;f.extend([[a,c,b],[a,e,c]])
 p.append(piece(name,v,f,tile,uv,tint))
 for j in [0,len(centers)-1]:
  vv=np.concatenate([centers[j:j+1],np.array(v[j*n:(j+1)*n])]);ff=[[0,1+i,1+(i+1)%n] if j==0 else [0,1+(i+1)%n,1+i] for i in range(n)];quv=[[.5,.5]]+[[.5+.47*math.cos(2*math.pi*i/n),.5+.47*math.sin(2*math.pi*i/n)] for i in range(n)];p.append(piece(name+'_end',vv,ff,1 if tile==0 else tile,quv,tint))
def hull(name,v,tile,tint=1.):
 v=np.array(v);h=ConvexHull(v);f=[]
 for face,plane in zip(h.simplices,h.equations):
  a,b,c=v[face]
  if np.dot(np.cross(b-a,c-a),plane[:3])<0:face=face[[0,2,1]]
  f.append(face.tolist())
 return piece(name,v,f,tile,tint=tint)
def leaf(p,root,direction,length,width,tile,tint=1.):
 root=np.array(root);d=np.array(direction,dtype=float);d/=np.linalg.norm(d);side=np.cross(d,[0,1,0])
 if np.linalg.norm(side)<.01:side=np.array([1.,0,0])
 side/=np.linalg.norm(side);mid=root+d*length*.55+[0,length*.12,0];tip=root+d*length;v=[root-side*width*.08,root+side*width*.08,mid-side*width*.5,mid+side*width*.5,tip];p.append(piece('leaf',v,[[0,1,3],[0,3,2],[2,3,4]],tile,[[0,0],[1,0],[0,.55],[1,.55],[.5,1]],tint,True))
def proxy(name,parts):
 v=np.concatenate([np.array(p['v']) for p in parts]);lo=v.min(0);hi=v.max(0);return {'name':name,'center':((lo+hi)/2).tolist(),'size':(hi-lo).tolist()}
def trees(i):
 rng=np.random.default_rng(8100+i);p=[];boxes=[]
 if i<7:
  h=[4.6,4.3,4.8,4.1,3.2,4.5,4.4][i];r=[.21,.26,.22,.31,.28,.25,.23][i];bend=[.1,.18,.72,.42,.12,-.24,.16][i];cs=np.array([[0,0,0],[bend*.15,h*.30,.03],[bend*.55,h*.67,-.07],[bend,h,.04]])
  for j in range(3):
   start=len(p);tube(p,'trunk',cs[j:j+2],[r*(1-.24*j),max(.055,r*(1-.24*(j+1)))],0,9,.7 if i==3 else 1);boxes.append(proxy('Trunk'+str(j),p[start:]))
  count=3 if i==4 else 8 if i==3 else 5
  for j in range(count):
   t=.32+.49*j/max(1,count-1);a=float(rng.uniform(0,2*math.pi));start=np.array([np.interp(t,[0,.30,.67,1],cs[:,0]),h*t,np.interp(t,[0,.30,.67,1],cs[:,2])]);length=float(rng.uniform(.55,1.20));d=np.array([math.cos(a),.65+rng.uniform(-.25,.5),math.sin(a)]);end=start+length*d;mid=(start+end)/2+[.06,.10,-.03];br=max(.035,r*(.34-.025*j));tube(p,'branch',[start,mid,end],[br,br*.65,.014],0,6)
   for s in [-1,1]:tube(p,'twig',[end-d*.18,end+[math.cos(a+s*.65)*.36,.28,math.sin(a+s*.65)*.36]],[.017,.006],0,5)
   if i==6:
    for q in range(4):leaf(p,end+rng.uniform(-.12,.12,3),[math.cos(a+q),.25,math.sin(a+q)],.30,.11,5,float(rng.uniform(.8,1.15)))
  if i==1:tube(p,'fork_leader',[cs[1],[-.42,h*.73,.12],[-.65,h*.95,.22]],[r*.7,r*.33,.055],0,8)
  if i==5:tube(p,'split_leader',[cs[1],[.56,h*.67,.1],[.62,h*.89,.12]],[r*.6,r*.32,.038],0,7,.8)
  for a in np.linspace(0,2*math.pi,5,endpoint=False):tube(p,'root',[[0,.12,0],[math.cos(a)*.46,.055,math.sin(a)*.46],[math.cos(a)*.72,.025,math.sin(a)*.72]],[.075,.045,.02],7,6)
  role='standing';blocking=True
 elif i<10:
  length=[2.8,2.4,1.45][i-7];r=[.23,.19,.16][i-7];start=len(p);tube(p,'fallen_trunk',[[-length/2,r,0],[0,r*.95,.06],[length/2,r*.8,.03]],[r,r*.9,r*.67],0,9);boxes=[proxy('Log',p[start:])]
  for j in range(4 if i==8 else 2):
   x=float(rng.uniform(-length*.35,length*.35));a=float(rng.uniform(.2,2.8));tube(p,'broken_limb',[[x,r,.04],[x+.22,r+.28*math.sin(a),.40*math.cos(a)]],[.055,.018],0,6)
  role='fallen';blocking=True
 else:
  h=[.28,.70,.43][i-10];r=[.27,.23,.35][i-10];start=len(p);tube(p,'stump',[[0,0,0],[.025,h*.65,0],[-.02,h,.02]],[r,r*.88,r*.72],0,10);boxes=[proxy('Stump',p[start:])]
  if i==11:
   for a in [0,2,4]:tube(p,'splinter',[[.10*math.cos(a),h*.8,.1*math.sin(a)],[.14*math.cos(a),h+.16,.14*math.sin(a)]],[.045,.008],1,5)
  if i==12:
   for a in np.linspace(0,2*math.pi,6,endpoint=False):tube(p,'exposed_root',[[0,.13,0],[math.cos(a)*.42,.055,math.sin(a)*.42],[math.cos(a)*.74,.025,math.sin(a)*.74]],[.085,.046,.02],7,6)
  role='stump';blocking=i!=10
 return p,boxes if blocking else [],role,blocking
def rock_piece(rng,size,pos=(0,0,0)):
 sx,h,sz=size;v=[]
 for row,y in enumerate([0,.45,.85]):
  for i in range(8):
   a=2*math.pi*i/8+.07*row;factor=float(rng.uniform(.76,1))*(1 if row==1 else .82 if row==0 else .55);v.append([math.cos(a)*sx*.5*factor,y*h+(rng.uniform(-.06,.06)*h if row else 0),math.sin(a)*sz*.5*factor])
 v.append([.05*sx,h,.04*sz]);return hull('rock',np.array(v)+pos,2,float(rng.uniform(.9,1.1)))
def masonry(rng,size,pos):
 half=np.array(size)/2;v=[]
 for axis in range(3):
  for sx in [-1,1]:
   for sy in [-1,1]:
    for sz in [-1,1]:
     signs=np.array([sx,sy,sz]);q=(half-.025)*signs;q[axis]=half[axis]*signs[axis];v.append(q)
 v=np.array(v);a=float(rng.uniform(-math.pi,math.pi));rot=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]]);v=v@rot.T;v[:,1]-=v[:,1].min();return hull('masonry',v+pos,3,float(rng.uniform(.84,1.13)))
def rocks(i):
 rng=np.random.default_rng(8200+i);p=[];boxes=[]
 if i<5:
  p=[rock_piece(rng,[(.28,.09,.22),(.46,.20,.38),(.95,.64,.82),(.78,1.45,.72),(1.65,.48,1.16)][i])];blocking=i>=2;role='individual'
  if blocking:boxes=[proxy('Rock',p)]
 elif i<9:
  j=i-5;count=[8,4,5,4][j];extent=[.70,.85,1.20,.85][j];height=[.13,.55,.92,.48][j]
  for k in range(count):
   a=2*math.pi*k/count+rng.uniform(-.25,.25);distance=extent*float(rng.uniform(.2,.75));s=float(rng.uniform(.60,1.05));p.append(rock_piece(rng,[height*1.3*s,height*s,height*1.1*s],[math.cos(a)*distance,0,math.sin(a)*distance]))
  blocking=i in [6,7,8];role='natural_cluster'
  if blocking:
   ordered=sorted(p,key=lambda q:float(np.prod(np.ptp(np.array(q['v']),axis=0))),reverse=True);boxes=[proxy('Rock'+str(j),[q]) for j,q in enumerate(ordered[:2+(i==7)])]
 else:
  j=i-9
  for k in range([9,7,6,3][j]):
   if i==12:size=[.42,.34,.44];pos=[.035*k,.27*k,.025*k]
   else:
    f=[.20,.36,.48][j];size=[f*rng.uniform(.8,1.6),f*.55,f*rng.uniform(.7,1.2)];pos=[rng.uniform(-.55,.55),0 if k<4 else .08,rng.uniform(-.45,.45)]
    if k==0:pos=[0,0,0]
    if k>=4:pos[0]*=.2;pos[2]*=.2
   q=masonry(rng,size,pos);p.append(q)
   if i>=11 and k<2:boxes.append(proxy('Rubble'+str(k),[q]))
  blocking=bool(boxes);role='masonry'
  if i==12:boxes=[proxy('Pillar',p)]
 return p,boxes,role,blocking
def ground(i):
 rng=np.random.default_rng(8300+i);p=[]
 if i<5:
  count=[14,28,45,24,24][i];h=[.18,.28,.34,.13,.65][i]
  for j in range(count):
   a=float(rng.uniform(0,2*math.pi));r=.38*math.sqrt(float(rng.uniform(0,1)));lean=.8 if i==3 else .30;leaf(p,[math.cos(a)*r,0,math.sin(a)*r*.75],[math.cos(a)*lean,1,math.sin(a)*lean],h*float(rng.uniform(.65,1.25)),.022 if i!=4 else .018,4,float(rng.uniform(.8,1.15)))
  role='grass'
 elif i<7:
  for j in range(5 if i==5 else 4):
   x,z=rng.uniform(-.30,.30,2);h=float(rng.uniform(.24,.44));tube(p,'weed_stem',[[x,0,z],[x+.025,h,z]],[.008,.004],7,5)
   for k in range(5):
    a=k*2.4+j;leaf(p,[x+.025*k/5,h*(.2+.13*k),z],[math.cos(a),.2,math.sin(a)],.10 if i==5 else .17,.016 if i==5 else .065,4 if i==5 else 5)
  role='weeds'
 elif i<9:
  for j in range(18 if i==7 else 40):
   a=float(rng.uniform(0,2*math.pi));r=.45*math.sqrt(float(rng.uniform(0,1)));leaf(p,[math.cos(a)*r,.002,math.sin(a)*r*.75],[math.cos(a+.7),.015,math.sin(a+.7)],float(rng.uniform(.08,.15)),.05,6,float(rng.uniform(.8,1.2)))
  role='leaf_patch'
 elif i<11:
  for j in range(6 if i==9 else 12):
   x,z=rng.uniform(-.35,.35,2);a=float(rng.uniform(0,2*math.pi));length=float(rng.uniform(.18,.43));tube(p,'twig',[[x,.012,z],[x+length*math.cos(a),.025,z+length*math.sin(a)]],[.011,.006],7,5)
  role='twig_patch'
 else:
  for j in range(4 if i==11 else 7):
   a=2*math.pi*j/(4 if i==11 else 7);length=float(rng.uniform(.35,.66));tube(p,'root',[[0,.035,0],[math.cos(a)*length*.55,.07,math.sin(a)*length*.55],[math.cos(a)*length,.018,math.sin(a)*length]],[.027,.020,.008],7,6)
  role='root_patch'
 return p,[],role,False
def finalize(p,boxes,family,role):
 v=np.concatenate([np.array(q['v']) for q in p]);lo=v.min(0);hi=v.max(0);shift=np.array([0.,-lo[1],0.])
 if family!='trees' or role=='fallen':shift[[0,2]]=-(lo[[0,2]]+hi[[0,2]])/2
 for q in p:q['v']=(np.array(q['v'])+shift).tolist()
 for b in boxes:b['center']=(np.array(b['center'])+shift).tolist()
 return p,boxes

def export(parts,png,name):
 binary=bytearray();views=[];acc=[];meshes=[]
 def add(a,kind,component=5126,bounds=False,normalized=False):
  binary.extend(b'\0'*((-len(binary))%4));off=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':component,'count':len(a),'type':kind}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  if normalized:d['normalized']=True
  acc.append(d);return len(acc)-1
 for foliage in [False,True]:
  subset=[p for p in parts if p['foliage']==foliage]
  if not subset:continue
  positions=[];normals=[];uvs=[];colors=[]
  for p in subset:
   tri=np.array(p['v'])[np.array(p['f'])];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(n,axis=1)
   if np.any(length<1e-10):raise ValueError('Degenerate face: '+name)
   n/=length[:,None];positions.extend(tri.reshape(-1,3));normals.extend(np.repeat(n,3,axis=0));uvs.extend(np.array(p['uv'])[np.array(p['f'])].reshape(-1,2));value=int(np.clip(p['tint']*220,0,255));colors.extend([[value,value,value,255]]*len(tri)*3)
  pa=add(np.array(positions,dtype='<f4'),'VEC3',bounds=True);na=add(np.array(normals,dtype='<f4'),'VEC3');ua=add(np.array(uvs,dtype='<f4'),'VEC2');ca=add(np.array(colors,dtype='uint8'),'VEC4',5121,normalized=True);meshes.append({'name':'foliage' if foliage else 'solid','primitives':[{'attributes':{'POSITION':pa,'NORMAL':na,'TEXCOORD_0':ua,'COLOR_0':ca},'material':int(foliage),'mode':4}]})
 binary.extend(b'\0'*((-len(binary))%4));off=len(binary);binary.extend(png);views.append({'buffer':0,'byteOffset':off,'byteLength':len(png)});image_view=len(views)-1
 mats=[{'name':n,'doubleSided':two,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.95}} for n,two in [('atlas_solid',False),('atlas_foliage',True)]]
 doc={'asset':{'version':'2.0','generator':'Ashen ENV-008 nature'},'scene':0,'scenes':[{'name':name,'nodes':list(range(len(meshes)))}],'nodes':[{'mesh':i} for i in range(len(meshes))],'meshes':meshes,'materials':mats,'textures':[{'sampler':0,'source':0}],'samplers':[{'magFilter':9728,'minFilter':9728,'wrapS':33071,'wrapT':33071}],'images':[{'bufferView':image_view,'mimeType':'image/png'}],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':{'units':'meters','up':'Y','status':'draft; no engine validation'}}
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4));return struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def wrapper(name,boxes):
 if boxes:
  items=[{**b,'basis':[1,0,0,0,1,0,0,0,1]} for b in boxes];return load('generate_env007_collisions').scene(name,items,'res://assets/environment/env008')
 return '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="PackedScene" path="res://assets/environment/env008/exports/'+name+'.glb" id="1_visual"]\n\n[node name="'+name+'" type="Node3D"]\n\n[node name="Visual" parent="." instance=ExtResource("1_visual")]\n'
def generate(folder):
 folder=Path(folder);png=atlas();outputs=[(folder/'textures/env008_atlas.png',png)];records=[];geoms=set()
 for family,styles,builder in [('trees',TREE,trees),('rocks',ROCK,rocks),('ground',GROUND,ground)]:
  for i,style in enumerate(styles):
   parts,boxes,role,blocking=builder(i);parts,boxes=finalize(parts,boxes,family,role);name='env_'+family+'_'+str(i+1).zfill(2)+'_'+style;raw=bytes(export(parts,png,name));v=np.concatenate([np.array(p['v']) for p in parts]);geom=hashlib.sha256(json.dumps([(p['v'],p['f']) for p in parts],separators=(',',':')).encode()).hexdigest()
   if geom in geoms or not np.isfinite(v).all() or not np.isclose(v[:,1].min(),0):raise ValueError('Invalid or duplicate geometry')
   geoms.add(geom)
   if family=='ground' and boxes:raise ValueError('Ground dressing must not block')
   records.append({'id':name,'family':family,'style':style,'role':role,'blocking':blocking,'origin':'main trunk ground reference' if family=='trees' and role!='fallen' else 'ground-centered footprint','file':'exports/'+name+'.glb','scene':'scenes/'+name+'.tscn','triangles':sum(len(p['f']) for p in parts),'bounds_min_m':v.min(0).tolist(),'bounds_max_m':v.max(0).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'geometry_sha256':geom,'collision_boxes':boxes,'engine_validated':False})
   outputs.extend([(folder/records[-1]['file'],raw),(folder/records[-1]['scene'],wrapper(name,boxes).encode())])
 if len(records)!=39 or sum(len(r['collision_boxes']) for r in records)!=39 or sum(r['blocking'] for r in records)!=20:raise ValueError('Batch count changed')
 outputs.append((folder/'manifest.json',json.dumps({'batch':'ENV-008','models':39,'units':'meters','up':'Y','atlas_dimensions':[256,128],'atlas_sha256':hashlib.sha256(png).hexdigest(),'status':'draft; engine result is in CI report','assets':records},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 import sys
 for r in generate(Path(sys.argv[1]) if len(sys.argv)>1 else Path('ENV-008')):print(r['id'],r['triangles'],r['sha256'])
