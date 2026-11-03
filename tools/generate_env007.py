"""ENV-007: restore 12 crate and 12 barrel designs from the recorded source.
Imports ENV-001, whose original baseline exports are hash-checked on import.
"""
from pathlib import Path
import math,sys
import numpy as np
from env_variation_common import load,repack,write_batch
STYLES={'crate':['cross_braced','single_brace','iron_bound','vertical_battens','face_patch','cross_plank_lid','cleated_lid','open_top','braced_open','carry_handles','hinged_lid','wide_low'],'barrel':['five_hoops','three_hoops','wide_hoops','stave_repairs','replacement_staves','open_empty','open_crossbar','partial_lid','cleated_lid','bung_head','iron_handles','squat']}
def part(name,v,f,m):return {'name':name,'v':np.asarray(v).tolist(),'f':np.asarray(f).tolist(),'material':int(m)}
def box(name,c,s,m,b=0):return part(name,*load('generate_env001').box(c,s,m,b))
def lathe(name,p,m):return part(name,*load('generate_env001').lathe(p,m))
def radius(y):return load('generate_env001').radius(y)
def beam(name,a,b,width,depth,mat):
 a=np.array(a,dtype=float);b=np.array(b,dtype=float);d=b-a;length=np.linalg.norm(d);d/=length;s=np.cross(d,[0,0,1]);s/=np.linalg.norm(s);basis=np.column_stack([s,d,np.cross(s,d)])
 p=box(name,[0,0,0],[width,length,depth],mat,.002);p['v']=(np.array(p['v'])@basis.T+(a+b)/2).tolist();return p

def base(family):
 m=load('generate_env001')
 if family=='crate':names=(['face_board']*5+['side_board']*4)*2+['corner_post']*4+['lid_'+str(i) for i in range(5)]+['floor']+['face_rail']*4+['old_patch'];source=m.crate
 else:names=['stave_'+str(i) for i in range(16)]+['rim']+['lid_'+str(i) for i in range(5)]+['bottom']+['hoop']*4;source=m.barrel
 if len(names)!=len(source):raise ValueError('Baseline part count changed')
 return [part(name,*p) for name,p in zip(names,source)]
def hoop(center,width=.045):
 lo=center-width/2;hi=center+width/2
 return lathe('hoop',[(radius(y)+off,y) for y,off in [(lo,0),(lo+.003,.004),(hi-.003,.004),(hi,0)]],3)
def interior(p):
 p=[x for x in p if x['name']!='rim'];p.append(lathe('open_rim',[(.27,.9),(.242,.9)],0));ys=[.028]+[y for y,r in load('generate_env001').profile if y>.028]
 p.append(lathe('inside_staves',[(radius(y)-.028,y) for y in reversed(ys)],2));p.append(lathe('inside_floor',[(radius(.028)-.028,.028),(0,.028)],2));return p

def stave_patch(index):
 a=2*math.pi*index/16+.014;b=2*math.pi*(index+1)/16-.014;ys=[.21,.32,.48,.72,.78];v=[];f=[]
 for y in ys:
  for r,angle in [(radius(y)+.018,a),(radius(y)+.018,b),(radius(y)-.004,a),(radius(y)-.004,b)]:v.append([r*math.cos(angle),y,r*math.sin(angle)])
 for j in range(len(ys)-1):
  k=j*4;l=k+4;f.extend([[k,l,l+1],[k,l+1,k+1],[k+2,k+3,l+3],[k+2,l+3,l+2],[k,k+2,l+2],[k,l+2,l],[k+1,l+1,l+3],[k+1,l+3,k+3]])
 f.extend([[0,1,3],[0,3,2]]);k=(len(ys)-1)*4;f.extend([[k,k+2,k+3],[k,k+3,k+1]]);return part('stave_repair',v,f,6)
def handle_ring(sign):
 v=[];f=[];n=12;tube=4
 for i in range(n):
  a=2*math.pi*i/n
  for j in range(tube):
   b=2*math.pi*j/tube;r=.055+.008*math.cos(b);v.append([sign*.35+.008*math.sin(b),.48+r*math.cos(a),r*math.sin(a)])
 for i in range(n):
  for j in range(tube):
   a=i*tube+j;b=((i+1)%n)*tube+j;c=((i+1)%n)*tube+(j+1)%tube;d=i*tube+(j+1)%tube;f.extend([[a,b,c],[a,c,d]])
 return part('iron_ring_handle',v,f,3)

def variant(family,index):
 p=base(family);style=STYLES[family][index]
 if family=='crate':
  if style in ['cross_braced','single_brace','braced_open']:
   if style=='braced_open':p=[x for x in p if not x['name'].startswith('lid_')]
   for z in [-.305,.305]:
    p.append(beam('face_diagonal',[-.28,.16,z],[.28,.44,z],.045,.025,0))
    if style=='cross_braced':p.append(beam('second_diagonal',[-.28,.44,z-.006],[.28,.16,z-.006],.045,.025,5))
  elif style=='iron_bound':
   for x in [-.20,.20]:
    for z in [-.302,.302]:p.append(box('iron_strap',[x,.30,z],[.035,.58,.014],3,.002))
    p.append(box('lid_iron_strap',[x,.595,0],[.035,.01,.618],3));p.append(box('bottom_iron_strap',[x,.005,0],[.035,.01,.618],3))
  elif style=='vertical_battens':
   for x in [-.19,.19]:
    for z in [-.31,.31]:p.append(box('vertical_batten',[x,.30,z],[.055,.46,.025],2,.002))
  elif style=='face_patch':
   for y in [.22,.30,.38]:p.append(box('face_repair',[-.08,y,-.315],[.49,.065,.025],6,.002))
  elif style=='cross_plank_lid':
   p=[x for x in p if not x['name'].startswith('lid_')]
   for z in np.linspace(-.208,.208,6):p.append(box('cross_lid',[0,.565,float(z)],[.68,.05,.077],0))
  elif style=='cleated_lid':
   for z in [-.16,.16]:p.append(box('lid_cleat',[0,.595,z],[.62,.01,.045],2))
  elif style=='open_top':p=[x for x in p if not x['name'].startswith('lid_')]
  elif style=='carry_handles':
   for sign in [-1,1]:
    for x in [-.09,.09]:p.append(box('handle_mount',[x,.34,sign*.2975],[.025,.065,.09],3,.002))
    p.append(box('handle_grip',[0,.34,sign*.345],[.205,.028,.025],0,.002))
  elif style=='hinged_lid':
   for x in [-.22,.22]:p.append(box('hinge_plate',[x,.55,.305],[.06,.08,.015],3,.002));p.append(box('hinge_top',[x,.595,.23],[.06,.01,.16],3))
   p.append(box('front_latch',[0,.49,-.305],[.055,.105,.02],3,.002))
  elif style=='wide_low':
   for item in p:item['v']=(np.array(item['v'])*[1.35,.72,1]).tolist()
 else:
  if style in ['five_hoops','three_hoops','wide_hoops']:
   p=[x for x in p if x['name']!='hoop'];centers=[.08,.24,.45,.67,.84] if style=='five_hoops' else [.12,.47,.82] if style=='three_hoops' else [.10,.31,.70,.84];p.extend(hoop(y,.075 if style=='wide_hoops' else .045) for y in centers)
  elif style=='stave_repairs':p.extend(stave_patch(i) for i in [11,12])
  elif style=='replacement_staves':
   for item in p:
    if item['name'] in ['stave_10','stave_12','stave_14']:
     v=np.array(item['v']);r=np.linalg.norm(v[:,[0,2]],axis=1);v[:,0]*=(r+.006)/r;v[:,2]*=(r+.006)/r;item['v']=v.tolist();item['material']=6
  elif style in ['open_empty','open_crossbar','partial_lid']:
   p=[x for x in p if not x['name'].startswith('lid_') or (style=='partial_lid' and x['name'] in ['lid_0','lid_2','lid_4'])];p=interior(p)
   if style=='open_crossbar':p.append(box('open_crossbar',[0,.887,0],[.55,.026,.055],2,.002))
  elif style=='cleated_lid':
   for z in [-.10,.10]:p.append(box('lid_cleat',[0,.8885,z],[.41,.023,.045],2,.002))
  elif style=='bung_head':
   plug=lathe('raised_bung',[(0,.877),(.024,.877),(.022,.895),(0,.895)],4);v=np.array(plug['v']);v[:,0]+=.10;plug['v']=v.tolist();p.append(plug)
  elif style=='iron_handles':
   for sign in [-1,1]:p.append(box('handle_mount',[sign*.338,.535,0],[.05,.027,.03],3,.002));p.append(handle_ring(sign))
  elif style=='squat':
   for item in p:item['v']=(np.array(item['v'])*[1.12,.72,1.12]).tolist()
 return p,style

def generate(folder):
 m=load('generate_env001');assets={}
 for family in ['crate','barrel']:
  for i in range(12):
   parts,style=variant(family,i);name='env_'+family+'_v'+str(i+1).zfill(2)+'_'+style;assets[name]=(parts,'env_crate_closed_a_r01' if family=='crate' else 'env_barrel_closed_a_opt01',family,style)
 def export(parts,name):return repack(m.export([(p['v'],p['f'],p['material']) for p in parts]),'GrimDark ENV-007 crate and barrel variations')
 return write_batch(folder,'ENV-007',assets,export,24,{'crate':13,'barrel':13})
if __name__=='__main__':
 for r in generate(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'assets/environment/env007'):print(r['id'],r['triangles'],r['sha256'])
