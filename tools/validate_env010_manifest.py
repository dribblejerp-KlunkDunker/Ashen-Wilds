"""Static ENV-010 manifest checks; no engine or traversal certification."""
from pathlib import Path
import argparse,json,math,re,struct

def validate(manifest,project_root,skip_resources=False):
 d=json.loads(Path(manifest).read_text());rows=d['instances'];resources=d['resources'];ids=[r[0] for r in rows]
 if len(rows)!=79 or len(set(ids))!=79 or len(resources)!=34:raise ValueError('Approved counts changed')
 if d['scale_default']!=[1,1,1] or len(d['fixtures'])!=2:raise ValueError('Approved defaults changed')
 if any(len(r)!=5 or not re.fullmatch(r'[a-z0-9_]+',r[0]) or len(r[2])!=3 or not all(math.isfinite(float(x)) for x in r[2]+[r[3]]) for r in rows):raise ValueError('Invalid placement row')
 if any(r[1] not in resources and r[1] not in d['fixtures'] for r in rows):raise ValueError('Unknown resource')
 if any(r[4]=='dressing' and (resources[r[1]][1]!='nonblocking' or abs(r[2][0])<=.75) for r in rows):raise ValueError('Dressing policy changed')
 if any(k not in ids for k in d['overrides']):raise ValueError('Unknown override ID')
 world_ids=[x['world_object_id'] for x in d['overrides'].values() if 'world_object_id' in x]
 if world_ids!=['watchhouse/env010/supply-crate-01']:raise ValueError('Supply target identity changed')
 if not skip_resources:
  root=Path(project_root).resolve()
  for relative,mode in resources.values():
   path=root/'assets/environment'/relative
   path.resolve().relative_to(root)
   if not path.is_file():raise ValueError('Missing resource: '+str(path))
   if path.suffix=='.glb':
    raw=path.read_bytes()
    if len(raw)<12 or struct.unpack_from('<4sII',raw)!=(b'glTF',2,len(raw)):raise ValueError('Bad GLB: '+str(path))
   else:
    for dependency in re.findall(r'path="(res://[^"]+)"',path.read_text()):
     if not (root/dependency[6:]).is_file():raise ValueError('Missing dependency: '+dependency)
 return {'placements':len(rows),'resource_types':len(resources),'resource_files_checked':not skip_resources,'engine_validated':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--manifest',default='assets/environment/env010/layout_manifest.json');p.add_argument('--project-root',default='.');p.add_argument('--skip-resources',action='store_true');a=p.parse_args()
 print(json.dumps(validate(a.manifest,a.project_root,a.skip_resources),indent=2))
