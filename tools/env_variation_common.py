"""Shared generation/validation helpers for ENV-006 and ENV-007.
Requires the existing ENV-001/005 sources and pinned NumPy/SciPy versions.
"""
from pathlib import Path
import importlib.util,sys,json,struct,hashlib
import numpy as np

def load(name):
 key='_ashen_'+name
 if key not in sys.modules:
  spec=importlib.util.spec_from_file_location(key,Path(__file__).with_name(name+'.py'))
  module=importlib.util.module_from_spec(spec);sys.modules[key]=module;spec.loader.exec_module(module)
 return sys.modules[key]

def repack(raw,generator,name=None):
 length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);size=struct.unpack_from('<I',raw,20+length)[0];binary=raw[28+length:28+length+size]
 doc['asset']['generator']=generator
 if name is not None:doc['scenes']=[{'name':name,'nodes':doc['scenes'][0]['nodes']}]
 text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
 return struct.pack('<4sII',b'glTF',2,28+len(text)+len(binary))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def write_batch(folder,batch,assets,export,expected,family_totals):
 folder=Path(folder);records=[];outputs=[];fingerprints=set()
 if len(assets)!=expected:raise ValueError('Unexpected asset count')
 for name,(parts,parent,family,style) in assets.items():
  vertices=np.concatenate([np.array(p['v']) for p in parts]);lo=vertices.min(0);hi=vertices.max(0)
  if not np.isfinite(vertices).all():raise ValueError('Nonfinite vertices: '+name)
  for p in parts:
   tri=np.array(p['v'])[np.array(p['f'])]
   if np.any(np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)<1e-10):raise ValueError('Degenerate faces: '+name)
  if family=='wall' and not np.allclose(hi-lo,[2,2.4,.19]):raise ValueError('Wall envelope changed')
  if family=='roof':
   r=np.concatenate([np.array(p['v']) for p in parts if p['name']=='rafter'])
   if not(np.allclose(lo,[-1,-1,0]) and np.allclose(hi,[1,.03,1.4]) and np.isclose(r[:,1].min(),-1)):raise ValueError('Roof connections changed')
  elif not np.isclose(lo[1],0):raise ValueError('Ground anchor changed')
  geom=hashlib.sha256(json.dumps([(p['v'],p['f']) for p in parts],separators=(',',':')).encode()).hexdigest()
  if geom in fingerprints:raise ValueError('Duplicate geometry: '+name)
  fingerprints.add(geom);raw=bytes(export(parts,name));magic,version,length=struct.unpack_from('<4sII',raw)
  if magic!=b'glTF' or version!=2 or length!=len(raw):raise ValueError('Bad GLB header')
  jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen]);bstart=28+jlen
  for a in doc['accessors']:
   view=doc['bufferViews'][a['bufferView']];v=np.frombuffer(raw,dtype='<f4',count=a['count']*3,offset=bstart+view['byteOffset']).reshape(-1,3)
   if not np.isfinite(v).all():raise ValueError('Nonfinite accessor')
   if 'min' not in a and not np.allclose(np.linalg.norm(v,axis=1),1,atol=1e-6):raise ValueError('Nonunit normals')
  records.append({'id':name,'parent':parent,'family':family,'style':style,'file':'exports/'+name+'.glb','bytes':len(raw),'triangles':sum(len(p['f']) for p in parts),'bounds_min_m':lo.tolist(),'bounds_max_m':hi.tolist(),'dimensions_m':(hi-lo).tolist(),'sha256':hashlib.sha256(raw).hexdigest(),'geometry_sha256':geom,'origin':'ridge anchor' if family=='roof' else 'ground center','engine_tested':False})
  outputs.append((folder/'exports'/(name+'.glb'),raw))
 manifest={'batch':batch,'new_models':expected,'units':'meters','up':'Y','family_totals_including_prior_designs':family_totals,'status':'draft; no collision bodies, UVs, textures or engine testing','assets':records}
 outputs.append((folder/'manifest.json',json.dumps(manifest,indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw:raise FileExistsError('Refusing changed output: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
