"""ENV-006: restore 30 designs recorded in the asset-generation conversation.
Reuses ENV-005 primitives and base geometry; five derivatives per parent.
"""
from pathlib import Path
import math,copy,sys
import numpy as np
from env_variation_common import load,repack,write_batch
PARENTS=['env_wall_plank_crossbraced_b','env_wall_plank_repaired_c','env_roof_shingle_fine_b','env_roof_shingle_timber_patch_c','env_fence_rail_intact_b','env_fence_rail_repaired_c']
STYLES={'wall':['strapped','lower_repairs','three_battens','staggered_joints','diagonal_patches'],'roof':['broad_patch','cross_slope_repairs','scattered_repairs','eave_repairs','mixed_shingles'],'fence':['diagonal_stay','three_pickets','five_pickets','chevron_brace','post_collars']}

def variant(parent,index):
 m=load('generate_env005');box=m.box;beam=m.beam;slab=m.slab
 family='wall' if parent.startswith('env_wall') else 'roof' if parent.startswith('env_roof') else 'fence'
 if family=='wall':p=[x for x in m.wall('crossbraced' if 'crossbraced' in parent else 'repaired') if x['name']!='repair_patch']
 elif family=='roof':
  p=m.roof('fine' if 'fine' in parent else 'patched')
  for item in p:
   if item['name']=='timber_roof_patch':item['name']='parent_timber_patch'
 else:p=m.fence('intact' if 'intact' in parent else 'repaired')
 rng=np.random.default_rng(6000+100*PARENTS.index(parent)+index)
 for item in p:
  if item['name'].startswith('siding_') or item['name'].startswith('shingle_'):item['material']=int(rng.choice([0,1,2],p=[.65,.25,.1])) if family=='wall' else int(rng.choice([4,5,6],p=[.6,.25,.15]))
 if family=='wall':
  if index==0:
   for x in [-.55,0,.55]:p.append(box('vertical_strap',[x,1.23,-.10],[.075,1.72,.02],2,.003))
   p.append(box('small_old_patch',[.31,.63,-.095],[.38,.09,.03],0,.003))
  elif index==1:
   for x in [-.51,-.17,.17,.51]:p.append(box('lower_repair',[x,.40,-.095],[.145,.64,.03],3,.003))
  elif index==2:
   for y in [.58,1.15,1.76]:p.append(box('mid_batten',[0,y,-.095],[1.26,.105,.03],3,.003))
  elif index==3:
   rebuilt=[]
   for item in p:
    if not item['name'].startswith('siding_'):rebuilt.append(item);continue
    v=np.array(item['v']);lo=v.min(0);hi=v.max(0);cut=.76+(.30 if int(item['name'].split('_')[-1])%2 else 0)
    for a,b in [(0,cut-.003),(cut+.003,2.30)]:rebuilt.append(box(item['name']+'_joint',[(lo[0]+hi[0])/2,(a+b)/2,.035],[hi[0]-lo[0],b-a,.045],item['material']))
   p=rebuilt;p.append(box('joint_repair',[.21,.76,-.095],[.48,.10,.03],3,.003))
  else:
   p.append(beam('short_repair_left',[-.63,.65,-.095],[-.15,1.11,-.095],.095,.03,3));p.append(beam('short_repair_right',[.15,1.38,-.095],[.63,1.84,-.095],.095,.03,3))
 elif family=='roof':
  if index<4:p=[item for item in p if item['name']!='parent_timber_patch']
  if index==0:
   for x in [-.60,-.40,-.20]:p.append(slab('broad_timber_patch',x-.094,x+.094,.30,1.10,.065,.07,3))
  elif index==1:
   for z in [.32,.82]:p.append(slab('cross_slope_repair',-.86,.86,z,z+.10,.065,.07,3))
  elif index==2:
   for x,z in [(-.65,.34),(.52,.62),(-.42,.98)]:p.append(slab('scattered_repair',x-.13,x+.13,z,min(z+.31,1.4),.065,.07,3))
  elif index==3:
   for x in [-.68,.52]:p.append(slab('eave_repair',x-.22,x+.22,1.03,1.4,.065,.07,3))
  else:
   for item in p:
    if item['name'].startswith('shingle_'):
     _,row,col=item['name'].split('_')
     if int(row)>0 and (int(row)+int(col))%3==0:item['material']=3;v=np.array(item['v']);v[:,1]+=.012;item['v']=v.tolist()
 else:
  if index==0:p.append(beam('diagonal_stay',[-.83,.44,-.09],[.83,.80,-.09],.075,.04,1))
  elif index in [1,2]:
   for x in ([-.5,0,.5] if index==1 else [-.65,-.325,0,.325,.65]):p.append(box('picket',[x,.68,-.12],[.09 if index==1 else .06,.58,.03],0,.003))
  elif index==3:
   for a,b in [([-.84,.44,-.10],[0,.80,-.10]),([0,.80,-.10],[.84,.44,-.10])]:p.append(beam('chevron_brace',a,b,.065,.04,1))
  else:
   for x in [-.9,.9]:
    for y in [.18,.98]:p.append(box('post_collar',[x,y,0],[.16,.12,.16],2,.003))
 return p,family,STYLES[family][index]

def generate(folder):
 m=load('generate_env005');assets={}
 for parent in PARENTS:
  for index in range(5):
   parts,family,style=variant(parent,index);name=parent+'_v'+str(index+1).zfill(2)+'_'+style;assets[name]=(parts,parent,family,style)
 return write_batch(folder,'ENV-006',assets,lambda p,n:repack(m.export(p),'GrimDark ENV-006',n),30,{'wall':13,'roof':13,'fence':13})
if __name__=='__main__':
 for r in generate(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'assets/environment/env006'):print(r['id'],r['triangles'],r['sha256'])
