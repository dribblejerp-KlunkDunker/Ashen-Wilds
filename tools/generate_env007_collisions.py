"""ENV-007 static box colliders, including revision-3 open barrels.
Standard library only. Verify every visual hash before emitting any scenes.
"""
from pathlib import Path
import argparse,hashlib,json,math
I=[1,0,0,0,1,0,0,0,1]
PROFILE=[(0,.26),(.12,.29),(.32,.321),(.48,.325),(.72,.305),(.9,.27)]
OPEN={'open_top','braced_open','open_empty','open_crossbar','partial_lid'}
def box(name,c,s,b=None):return {'name':name,'center':list(c),'size':list(s),'basis':list(b or I)}
def recipe(model):
 family=model['family'];style=model['style'];p=[]
 if family=='crate' and style not in OPEN:
  lo=model['bounds_min_m'];hi=model['bounds_max_m'];p=[box('SolidProxy',[(a+b)/2 for a,b in zip(lo,hi)],[b-a for a,b in zip(lo,hi)])]
 elif family=='crate':
  p.append(box('Floor',[0,.035,0],[.72,.07,.52]))
  for i,sign in enumerate([-1,1]):
   p.append(box('FacePanel'+str(i),[0,.295,sign*.245],[.72,.49,.035]));p.append(box('SidePanel'+str(i),[sign*.345,.295,0],[.035,.49,.52]))
   for j,z in enumerate([-.26,.26]):p.append(box('Corner'+str(i)+'_'+str(j),[sign*.36,.3,z],[.08,.6,.08]))
   for j,y in enumerate([.10,.49]):p.append(box('Rail'+str(i)+'_'+str(j),[0,y,sign*.27],[.72,.065,.055]))
  p.append(box('OldRepair',[.075,.285,-.275],[.36,.075,.026]))
  if style=='braced_open':
   length=math.hypot(.56,.28);basis=[.28/length,-.56/length,0,.56/length,.28/length,0,0,0,1]
   for i,z in enumerate([-.305,.305]):p.append(box('Diagonal'+str(i),[0,.30,z],[.045,length,.025],basis))
 elif family=='barrel' and style not in OPEN:
  sx=1.12 if style=='squat' else 1;sy=.72 if style=='squat' else 1;extra=.018 if style=='stave_repairs' else .006 if style=='replacement_staves' else 0
  for i,((y0,r0),(y1,r1)) in enumerate(zip(PROFILE[:-1],PROFILE[1:])):
   r=(max(r0,r1)+.004+extra)*sx;p.append(box('BodyBand'+str(i),[0,(y0+y1)*sy/2,0],[2*r,(y1-y0)*sy,2*r]))
  if style=='iron_handles':
   for i,sign in enumerate([-1,1]):p.append(box('Handle'+str(i),[sign*.338,.48275,0],[.05,.1315,.126]))
 elif family=='barrel':
  inner=.242*math.cos(math.pi/8);outer=.325*math.cos(math.pi/8);mid=(inner+outer)/2
  for i in range(8):
   a=2*math.pi*(i+.5)/8;c=math.cos(a);s=math.sin(a);p.append(box('Wall'+str(i),[mid*c,.464,mid*s],[2*.325*math.sin(math.pi/8),.872,outer-inner],[-s,0,c,0,1,0,-c,0,-s]))
  r=.242;short=r/math.sqrt(2);p.extend([box('FloorAcrossX',[0,.014,0],[2*r,.028,2*short]),box('FloorAcrossZ',[0,.014,0],[2*short,.028,2*r])])
  if style=='open_crossbar':p.append(box('Crossbar',[0,.887,0],[.55,.026,.055]))
  if style=='partial_lid':
   r=.2415
   for plank in [0,2,4]:
    lo=max(-r,-.245+plank*.098);hi=min(r,-.245+(plank+1)*.098);near=0 if lo<=0<=hi else min(abs(lo),abs(hi));z=math.sqrt(max(0,r*r-near*near));p.append(box('LidPlank'+str(plank),[(lo+hi)/2,.868,0],[hi-lo,.018,2*z]))
 else:raise ValueError('Unsupported family: '+family)
 for b in p:
  if min(b['size'])<=0 or not all(math.isfinite(x) for x in b['size']+b['center']+b['basis']):raise ValueError('Invalid box')
 return p

def scene(name,boxes,res_root):
 def nums(v):return ', '.join(format(x,'.12g') for x in v)
 lines=['[gd_scene load_steps='+str(len(boxes)+2)+' format=3]','', '[ext_resource type="PackedScene" path="'+res_root+'/exports/'+name+'.glb" id="1_visual"]','']
 for i,b in enumerate(boxes):lines+=['[sub_resource type="BoxShape3D" id="Box_'+str(i)+'"]','size = Vector3('+nums(b['size'])+')','']
 lines+=['[node name="'+name+'" type="StaticBody3D"]','collision_layer = 1','collision_mask = 0','metadata/collision_status = "generated; see CI validation report"','', '[node name="Visual" parent="." instance=ExtResource("1_visual")]','']
 for i,b in enumerate(boxes):lines+=['[node name="'+b['name']+'" type="CollisionShape3D" parent="."]','transform = Transform3D('+nums(b['basis']+b['center'])+')','shape = SubResource("Box_'+str(i)+'")','']
 return '\n'.join(lines)

def generate(root,res_root='res://assets/environment/env007',replace=False):
 root=Path(root);models=json.loads((root/'manifest.json').read_text())['assets'];outputs=[];records=[]
 if len(models)!=24 or len({m['id'] for m in models})!=24:raise ValueError('Expected 24 unique visual models')
 for m in models:
  if m['family'] not in ['crate','barrel']:raise ValueError('Unexpected model family')
  visual=root/m['file']
  if visual.resolve().parent!=(root/'exports').resolve():raise ValueError('Unexpected visual path')
  if hashlib.sha256(visual.read_bytes()).hexdigest()!=m['sha256']:raise ValueError('Visual hash mismatch: '+m['id'])
  boxes=recipe(m);name=m['id'];relative='scenes/'+name+'_collision.tscn';outputs.append((root/relative,scene(name,boxes,res_root).encode()))
  records.append({'id':name,'family':m['family'],'style':m['style'],'scene':relative,'height_m':m['bounds_max_m'][1],'shape_count':len(boxes),'open_interior':m['style'] in OPEN,'visual_sha256':m['sha256'],'boxes':boxes})
 if sum(r['shape_count'] for r in records)!=121:raise ValueError('Unexpected total box count')
 outputs.append((root/'collision-manifest.json',json.dumps({'batch':'ENV-007','revision':3,'scene_count':24,'total_shapes':121,'engine_validation':'See CI report; generator does not certify physics','assets':records},indent=2).encode()))
 for path,raw in outputs:
  if path.exists() and path.read_bytes()!=raw and not replace:raise FileExistsError('Review replacement or use --replace-existing: '+str(path))
 for path,raw in outputs:
  path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)
 return records
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('asset_root',type=Path);p.add_argument('--res-root',default='res://assets/environment/env007');p.add_argument('--replace-existing',action='store_true');a=p.parse_args()
 for r in generate(a.asset_root,a.res_root,a.replace_existing):print(r['id'],r['shape_count'])
