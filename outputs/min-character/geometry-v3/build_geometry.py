import bpy, bmesh, math, os, json
from mathutils import Vector
OUT='/Users/nao/Desktop/kin-site/outputs/min-character/geometry-v3'
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
source_scene=bpy.context.scene
scene=bpy.data.scenes.new('MIN • Idle geometry v3');bpy.context.window.scene=scene
character=bpy.data.collections.new('MIN v3 • export meshes');scene.collection.children.link(character)
studio=bpy.data.collections.new('MIN v3 • review studio');scene.collection.children.link(studio)
def move_collection(o,c):
 for old in list(o.users_collection):old.objects.unlink(o)
 c.objects.link(o)
def sphere(name,loc,scale):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64,location=loc)
 o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
# Broad dome and upright lower walls. No facial recesses.
bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64)
body=bpy.context.object;body.name='Min v3 | continuous idle body'
for v in body.data.vertices:
 x,y,z=v.co;phi=math.asin(max(-1,min(1,z)));theta=math.atan2(y,x)
 if phi>=0:r=math.cos(phi)**.90;zz=1.04+1.10*math.sin(phi)**.95
 else:r=math.cos(phi)**.55;zz=1.04-.995*(-math.sin(phi))**.65
 v.co=(r*math.cos(theta),.86*r*math.sin(theta),zz)
parts=[body]
for sign in (-1,1):
 arm=sphere('Integrated idle nibble',(sign*.97,0,.73),(.145,.24,.28))
 arm.rotation_euler.y=-sign*math.radians(19);parts.append(arm)
 parts.append(sphere('Rounded foot mass',(sign*.57,-.20,.21),(.33,.43,.27)))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
rem=body.modifiers.new('Blend into one continuous volume','REMESH');rem.mode='VOXEL';rem.voxel_size=.025;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
sm=body.modifiers.new('Soft uninterrupted transitions','SMOOTH');sm.factor=1.1;sm.iterations=9;bpy.ops.object.modifier_apply(modifier=sm.name)
# Even, lightweight quads to allow later broad morphs and armature skinning.
body.data.use_mirror_x=True
bpy.ops.object.quadriflow_remesh(use_mesh_symmetry=True,use_preserve_sharp=False,use_preserve_boundary=False,target_faces=4200,seed=7)
bm=bmesh.new();bm.from_mesh(body.data)
seam={v for e in bm.edges if e.is_boundary for v in e.verts}
for v in seam:v.co.x=0
bmesh.ops.remove_doubles(bm,verts=list(seam),dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
sm=body.modifiers.new('Relax retopology','SMOOTH');sm.factor=.32;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
lowest=min(v.co.z for v in body.data.vertices)
for v in body.data.vertices:v.co.z-=lowest
for p in body.data.polygons:p.use_smooth=True
move_collection(body,character)
sub=body.modifiers.new('Preview subdivision • export base mesh','SUBSURF');sub.levels=1;sub.render_levels=2
# UV unwrap stays with topology through future morphs.
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
def mat(name,c,rough=.7,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission;m.diffuse_color=(*c,1);return m
clay=mat('Min v3 • neutral clay',(0.36,.40,.43),.76)
body.data.materials.clear();body.data.materials.append(clay)
white=mat('Min v3 • flat luminous eyes',(.96,.96,.94),.6,.7)
white.use_backface_culling=True
# One-sided surface patches, no thickness, lens, sockets or rim geometry.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps)
eyes=[]
for sign,side in [(-1,'R'),(1,'L')]:
 verts=[];faces=[]
 def project(x,z):
  hit,loc,norm,idx=evaluated.ray_cast(Vector((x,-4,z)),Vector((0,1,0)))
  if not hit:raise RuntimeError('Eye projection missed body')
  return tuple(loc+norm*.0018)
 verts.append(project(sign*.345,1.14))
 for ring in range(1,7):
  rr=ring/6
  for j in range(48):
   t=2*math.pi*j/48;verts.append(project(sign*.345+.155*rr*math.cos(t),1.14+.169*rr*math.sin(t)))
 for j in range(48):faces.append((0,1+j,1+(j+1)%48))
 for ring in range(5):
  a=1+ring*48;b=a+48
  for j in range(48):faces.append((a+j,b+j,b+(j+1)%48,a+(j+1)%48))
 me=bpy.data.meshes.new('Eye '+side+' | surface patch topology');me.from_pydata(verts,[],faces);me.update()
 o=bpy.data.objects.new('Min v3 | eye.'+side,me);character.objects.link(o);o.data.materials.append(white)
 for p in me.polygons:p.use_smooth=True
 eyes.append(o)
# Make export vertices and body easier to identify without imposing a rig yet.
body['design']='Idle only. Broad dome, upright lower walls, continuous nibbles, two integrated rounded feet. No sockets.'
body['future_animation']='Topology is fixed; rig and expression morphs to be authored after silhouette approval.'
body['front_axis']='-Y; Z up'
for o in eyes:o['construction']='Single-sided projected patch; 0 solid thickness. Tiny offset only prevents z-fighting.'
# Neutral studio: clear form without transmission or bloom.
floor_mat=mat('Review floor',(.13,.145,.16),.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.name='Review floor';floor.data.materials.append(floor_mat);move_collection(floor,studio)
def light(name,loc,energy,size):
 d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();d.energy=energy;d.shape='DISK';d.size=size
light('Review key',(-3.5,-4,5),350,4);light('Review fill',(3,-2,2),120,3);light('Review rim',(1,3,4),280,3)
world=bpy.data.worlds.new('Review ambient');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.33,.36,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
for name,loc in [('Front',(0,-8,1.12)),('Right',(8,0,1.12)),('Three-quarter',(4.6,-7,3.0)),('Back',(0,8,1.12)),('Top',(0,0,8))]:
 d=bpy.data.cameras.new(name+' orthographic');o=bpy.data.objects.new('Review camera | '+name,d);studio.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.12))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=3.0
scene.camera=bpy.data.objects['Review camera | Front'];scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=OUT+'/min-v3-clay-front.png';scene.view_settings.view_transform='AgX'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.shading.type='SOLID';a.spaces.active.shading.light='STUDIO';a.spaces.active.shading.color_type='MATERIAL';a.spaces.active.overlay.show_overlays=True;a.spaces.active.region_3d.view_perspective='CAMERA'
# Keep old scenes in this working file for comparison, never overwrite previous deliveries.
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/Min_Idle_Geometry_v3.blend')
print('Body:',len(body.data.vertices),'vertices',len(body.data.polygons),'faces')
print('Bounds:',tuple(round(x,3) for x in body.dimensions))
