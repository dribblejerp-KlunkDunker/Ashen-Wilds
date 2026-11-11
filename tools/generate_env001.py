from pathlib import Path
import numpy as np,math,json,struct,hashlib
from scipy.spatial import ConvexHull
work=Path(__file__).resolve().parents[1]/'assets/environment/env001/models';work.mkdir(parents=True,exist_ok=True)
M=[('wood_old',[.27,.20,.13,1]),('wood_light',[.34,.265,.18,1]),('wood_dark',[.205,.16,.105,1]),('iron_dull',[.13,.14,.125,1]),('wood_cut',[.37,.29,.195,1]),('wood_mid',[.285,.215,.145,1]),('wood_repair',[.30,.235,.155,1])]
def box(c,s,mat,b=0):
 c=np.array(c);h=np.array(s)/2
 if b:
  v=[]
  for axis in range(3):
   for sx in [-1,1]:
    for sy in [-1,1]:
     for sz in [-1,1]:
      signs=np.array([sx,sy,sz]);p=(h-b)*signs;p[axis]=h[axis]*signs[axis];v.append(p)
  v=np.array(v);hull=ConvexHull(v);f=[]
  for face,plane in zip(hull.simplices,hull.equations):
   a,bb,cc=v[face]
   if np.dot(np.cross(bb-a,cc-a),plane[:3])<0:face=face[[0,2,1]]
   f.append(face.tolist())
  v+=c
 else:
  x,y,z=c;a,bb,cc=h;v=np.array([[x-a,y-bb,z-cc],[x+a,y-bb,z-cc],[x+a,y+bb,z-cc],[x-a,y+bb,z-cc],[x-a,y-bb,z+cc],[x+a,y-bb,z+cc],[x+a,y+bb,z+cc],[x-a,y+bb,z+cc]]);f=[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]
 return (v.tolist(),f,mat)
parts=[];rng=np.random.default_rng(1101)
def wood():return int(rng.choice([0,5,2],p=[.75,.20,.05]))
for side in [-1,1]:
 for i in range(5):parts.append(box((-.288+i*.144,.295,side*.245),(.137,.49,.035),wood()))
 for i in range(4):parts.append(box((side*.345,.295,-.195+i*.13),(.035,.49,.123),wood()))
for x in [-.36,.36]:
 for z in [-.26,.26]:parts.append(box((x,.3,z),(.08,.6,.08),2,.003))
for i in range(5):parts.append(box((-.288+i*.144,.565,0),(float(rng.uniform(.133,.139)),.05,.52),0 if i!=2 else 1))
parts.append(box((0,.035,0),(.72,.07,.52),2))
for z in [-.27,.27]:
 for y in [.10,.49]:parts.append(box((0,y,z),(.72,.065,.055),2,.003))
parts.append(box((.075,.285,-.275),(.36,.075,.026),6));crate=parts
profile=[(0,.26),(.12,.29),(.32,.321),(.48,.325),(.72,.305),(.9,.27)]
def radius(y):return float(np.interp(y,[a for a,b in profile],[b for a,b in profile]))
def lathe(p,mat):
 v=np.array([[r*math.cos(2*math.pi*i/16),y,r*math.sin(2*math.pi*i/16)] for r,y in p for i in range(16)]);f=[]
 for j in range(len(p)-1):
  for i in range(16):
   a=j*16+i;b=j*16+(i+1)%16;c=b+16;d=a+16
   for t in [[a,c,b],[a,d,c]]:
    if np.linalg.norm(np.cross(v[t[1]]-v[t[0]],v[t[2]]-v[t[0]]))>1e-12:f.append(t)
 return v.tolist(),f,mat
barrel=[];rng=np.random.default_rng(1011)
for i in range(16):
 a=2*math.pi*i/16;b=2*math.pi*(i+1)/16;v=[];f=[]
 for y,r in profile:v.extend([[r*math.cos(a),y,r*math.sin(a)],[r*math.cos(b),y,r*math.sin(b)]])
 for j in range(5):f.extend([[2*j,2*j+3,2*j+1],[2*j,2*j+2,2*j+3]])
 barrel.append((v,f,int(rng.choice([0,5,2],p=[.65,.25,.10]))))
barrel.append(lathe([(.27,.9),(.242,.9),(.242,.877)],0))
def clip(p,bound,greater):
 q=[]
 for a,b in zip(p,p[1:]+p[:1]):
  ia=a[0]>=bound if greater else a[0]<=bound;ib=b[0]>=bound if greater else b[0]<=bound
  if ia:q.append(a)
  if ia!=ib:
   t=(bound-a[0])/(b[0]-a[0]);q.append([bound,a[1]+t*(b[1]-a[1])])
 return q
circle=[[.2415*math.cos(2*math.pi*i/16),.2415*math.sin(2*math.pi*i/16)] for i in range(16)]
for i,(left,right) in enumerate(zip(np.linspace(-.245,.245,6)[:-1],np.linspace(-.245,.245,6)[1:])):
 p=clip(clip(circle,float(left),True),float(right),False)
 if len(p)>=3:barrel.append(([[x,.877,z] for x,z in p],[[0,k+1,k] for k in range(1,len(p)-1)],4 if i in [1,3] else 5))
barrel.append(lathe([(0,0),(.26,0)],2))
for center in [.10,.31,.70,.84]:
 lo=center-.0225;hi=center+.0225;barrel.append(lathe([(radius(y)+off,y) for y,off in [(lo,0),(lo+.003,.004),(hi-.003,.004),(hi,0)]],3))
def export(parts):
 groups={}
 for v,f,m in parts:
  g=groups.setdefault(m,{'v':[],'f':[]});off=len(g['v']);g['v'].extend(v);g['f'].extend([[i+off for i in face] for face in f])
 binary=bytearray();views=[];acc=[];meshes=[]
 def add(a,bounds=False):
  off=len(binary);binary.extend(a.tobytes());views.append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes,'target':34962});d={'bufferView':len(views)-1,'componentType':5126,'count':len(a),'type':'VEC3'}
  if bounds:d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  acc.append(d);return len(acc)-1
 for mat,g in groups.items():
  tri=np.array(g['v'])[np.array(g['f'])];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);length=np.linalg.norm(n,axis=1);assert np.all(length>1e-10);n/=length[:,None];pa=add(tri.reshape(-1,3).astype('<f4'),True);na=add(np.repeat(n,3,axis=0).astype('<f4'));meshes.append({'name':'material_'+str(mat),'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'material':mat,'mode':4}]})
 doc={'asset':{'version':'2.0','generator':'GrimDark reconstructed prop candidates'},'scene':0,'scenes':[{'nodes':list(range(len(meshes)))}],'nodes':[{'mesh':i} for i in range(len(meshes))],'meshes':meshes,'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':.35 if i==3 else 0,'roughnessFactor':.9}} for i,(name,color) in enumerate(M)],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc}
 text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4);return struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(binary),b'BIN\0')+binary

expected={"env_crate_closed_a_r01":("9f336bf508f782e517156c77a9f59d3f98454cd7d36e2518a2eceec94a54ce4c",652),"env_barrel_closed_a_opt01":("8c4381bfa2f895dee122b82fddaad4c63492b0e009f2cee40edfce0b886c42c8",646)}
outputs=[]
for name,parts in [("env_crate_closed_a_r01",crate),("env_barrel_closed_a_opt01",barrel)]:
 raw=bytes(export(parts));sha=hashlib.sha256(raw).hexdigest();triangles=sum(len(f) for v,f,m in parts)
 if (sha,triangles)!=expected[name]:raise ValueError("Generator output changed: "+name)
 outputs.append((work/(name+".glb"),raw))
for path,raw in outputs:
 if path.exists() and path.read_bytes()!=raw:raise FileExistsError("Refusing to replace changed model: "+str(path))
for path,raw in outputs:
 temp=path.with_suffix(".glb.tmp");temp.write_bytes(raw);temp.replace(path)
 print("Generated",path.name,hashlib.sha256(raw).hexdigest())
