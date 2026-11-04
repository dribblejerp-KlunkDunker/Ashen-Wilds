"""ENV-006 collider source. Requires existing visual generators and ENV-007 scene writer.
Walls: one box. Roofs: sloped deck plus four rafters. Fences: per-piece boxes.
"""
from pathlib import Path
import argparse,hashlib,json,math
import numpy as np
from env_variation_common import load,repack
PITCH=.8/1.4

def fit(name,points,basis=None):
 v=np.asarray(points,dtype=float);b=np.eye(3) if basis is None else np.asarray(basis,dtype=float);q=v@b;lo=q.min(0);hi=q.max(0);size=hi-lo
 if not np.isfinite(v).all() or min(size)<=0 or not np.allclose(b.T@b,np.eye(3)) or not np.isclose(np.linalg.det(b),1):raise ValueError('Invalid box fit')
 return {'name':name,'center':(((lo+hi)/2)@b.T).tolist(),'size':size.tolist(),'basis':b.T.reshape(-1).tolist()}

def recipe(model,parts):
 family=model['family'];offset=None
 if family=='wall':boxes=[fit('WallProxy',np.concatenate([p['v'] for p in parts]))]
 elif family=='roof':
  angle=math.atan(PITCH);c=math.cos(angle);s=math.sin(angle);b=np.array([[1,0,0],[0,c,-s],[0,s,c]])
  skin=np.concatenate([p['v'] for p in parts if p['name']=='roof_deck' or p['name'].startswith('shingle_')]);boxes=[fit('RoofDeck',skin,b)];offset=float((skin@b)[:,1].max()/c)
  for i,p in enumerate(p for p in parts if p['name']=='rafter'):boxes.append(fit('Rafter'+str(i),p['v'],b))
  if len(boxes)!=5:raise ValueError('Expected four rafters')
 elif family=='fence':
  boxes=[]
  for i,p in enumerate(parts):
   b=np.eye(3)
   if p['name'] in ['diagonal_stay','chevron_brace']:
    v=np.array(p['v']);d=np.linalg.eigh(np.cov(v.T))[1][:,-1];x=np.cross(d,[0,0,1]);x/=np.linalg.norm(x);b=np.column_stack([x,d,np.cross(x,d)])
   boxes.append(fit('FencePart'+str(i),p['v'],b))
 else:raise ValueError('Unsupported family')
 return boxes,offset

def generate(root,res_root='res://assets/environment/env006',replace=False):
 root=Path(root);models=json.loads((root/'manifest.json').read_text())['assets'];builder=load('generate_env006');writer=load('generate_env007_collisions');base=load('generate_env005');outputs=[];records=[]
 if len(models)!=30 or len({m['id'] for m in models})!=30:raise ValueError('Expected 30 unique models')
 for m in models:
  visual=root/m['file']
  if visual.resolve().parent!=(root/'exports').resolve():raise ValueError('Unexpected visual path')
  if hashlib.sha256(visual.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('Visual hash mismatch: '+m['id'])
  index=builder.STYLES[m['family']].index(m['style']);parts,family,style=builder.variant(m['parent'],index)
  raw=repack(base.export(parts),'GrimDark ENV-006',m['id'])
  if family!=m['family'] or style!=m['style'] or hashlib.sha256(raw).hexdigest()!=m['sha256']:raise ValueError('Source/visual mismatch: '+m['id'])
  boxes,offset=recipe(m,parts);relative='scenes/'+m['id']+'_collision.tscn';outputs.append((root/relative,writer.scene(m['id'],boxes,res_root).encode()))
  records.append({'id':m['id'],'family':family,'style':style,'scene':relative,'shape_count':len(boxes),'deck_top_offset_m':offset,'visual_sha256':m['sha256'],'boxes':boxes})
 if {f:sum(r['family']==f for r in records) for f in ['wall','roof','fence']}!={'wall':10,'roof':10,'fence':10}:raise ValueError('Family counts changed')
 if sum(r['shape_count'] for r in records)!=145:raise ValueError('Unexpected box total')
 outputs.append((root/'collision-manifest.json',json.dumps({'batch':'ENV-006','scene_count':30,'total_shapes':145,'engine_validation':'See CI report; generation is not engine certification','assets':records},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw and not replace:raise FileExistsError('Review or use --replace-existing: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('asset_root',type=Path);p.add_argument('--res-root',default='res://assets/environment/env006');p.add_argument('--replace-existing',action='store_true');a=p.parse_args()
 for r in generate(a.asset_root,a.res_root,a.replace_existing):print(r['id'],r['shape_count'])
