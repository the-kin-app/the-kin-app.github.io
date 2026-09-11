import bpy, math, os
from mathutils import Vector
OUT='/Users/nao/Desktop/kin-site/outputs/min-character'
# Work in a new scene, preserving any existing scene.
scene=bpy.data.scenes.new('MIN • Idle studio')
bpy.context.window.scene=scene

def rgb(h):
    a=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)+(1,)
def sphere(name,loc,scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=40,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return o
body=sphere('Min | continuous soft body',(0,0,1.17),(1,.73,1.13))
# Rounded capsule: gently flatten the lower hemisphere while preserving the dome.
for v in body.data.vertices:
    if v.co.z<0:
        z=v.co.z/1.13
        v.co.z=-1.13*abs(z)**.64
parts=[body]
for side in (-1,1):
    a=sphere('union arm',(side*.98,0,.82),(.235,.29,.43))
    a.rotation_euler.y=side*math.radians(-23)
    parts.append(a)
    parts.append(sphere('union foot',(side*.57,-.13,.16),(.26,.38,.165)))
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
r=body.modifiers.new('Continuous sculpt union','REMESH');r.mode='VOXEL';r.voxel_size=.035;r.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=r.name)
s=body.modifiers.new('Relax silhouette','SMOOTH');s.factor=1.3;s.iterations=8
bpy.ops.object.modifier_apply(modifier=s.name)
for p in body.data.polygons:p.use_smooth=True
# Recess the actual surface under each eye, without joining the two pools.
for v in body.data.vertices:
    x,y,z=v.co
    if y<-.25:
        g=max(math.exp(-(((x-e)/.225)**2+((z-1.19)/.23)**2)*1.9) for e in (-.35,.35))
        v.co.y+=.055*g
# Vertex attributes follow the deformation, including the dark eye sockets.
col=body.data.color_attributes.new(name='Peach_and_socket',type='FLOAT_COLOR',domain='POINT')
glow=body.data.attributes.new(name='Inner_warmth',type='FLOAT',domain='POINT')
for v in body.data.vertices:
    x,y,z=v.co
    front=max(0,min(1,(-y-.20)/.33))
    socket=max(math.exp(-2.0*(((x-e)/.31)**2+((z-1.19)/.30)**2)) for e in (-.35,.35))*front
    pool=math.exp(-((x/.78)**2+((z-1.14)/.91)**2))*front
    t=max(0,min(1,z/2.3))
    c0=rgb('FFF3E6');c1=rgb('EFD3C2')
    c=[c0[i]*(1-t)+c1[i]*t for i in range(3)]
    brown=rgb('6B4D2E');dark=rgb('553B22')
    c=[c[i]*(1-.30*pool)+brown[i]*.30*pool for i in range(3)]
    c=[c[i]*(1-.88*socket)+dark[i]*.88*socket for i in range(3)]
    col.data[v.index].color=(*c,1)
    glow.data[v.index].value=.22+2.0*math.exp(-((z-.12)/.14)**2)
mat=bpy.data.materials.new('Min • peach opal / separate dark sockets');mat.use_nodes=True
n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
a=n.new('ShaderNodeVertexColor');a.layer_name=col.name;l.new(a.outputs['Color'],p.inputs['Base Color'])
p.inputs['Roughness'].default_value=.21;p.inputs['IOR'].default_value=1.42
p.inputs['Subsurface Weight'].default_value=.09;p.inputs['Subsurface Radius'].default_value=(1,.48,.23)
p.inputs['Subsurface Scale'].default_value=.19;p.inputs['Transmission Weight'].default_value=.58
p.inputs['Coat Weight'].default_value=.38;p.inputs['Coat Roughness'].default_value=.20
p.inputs['Emission Color'].default_value=rgb('FFC97A')
a=n.new('ShaderNodeAttribute');a.attribute_name='Inner_warmth';l.new(a.outputs['Fac'],p.inputs['Emission Strength'])
body.data.materials.append(mat)
# Separate light-absorbing socket shader, travelling with the mesh.
attr=body.data.attributes.new(name='Socket_occlusion',type='FLOAT',domain='POINT')
for v in body.data.vertices:
    x,y,z=v.co;front=max(0,min(1,(-y-.2)/.33))
    attr.data[v.index].value=.8*max(math.exp(-1.6*(((x-e)/.29)**2+((z-1.19)/.29)**2)) for e in (-.35,.35))*front
at=n.new('ShaderNodeAttribute');at.attribute_name='Socket_occlusion'
d=n.new('ShaderNodeBsdfDiffuse');d.inputs['Color'].default_value=(.095,.052,.023,1);d.inputs['Roughness'].default_value=.5
mix=n.new('ShaderNodeMixShader');l.new(at.outputs['Fac'],mix.inputs[0]);l.new(p.outputs[0],mix.inputs[1]);l.new(d.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],n.get('Material Output').inputs['Surface'])
# Facial geometry: two small luminous lenses, never light halos.
eyeMat=bpy.data.materials.new('Min • ivory eyes');eyeMat.use_nodes=True
p=eyeMat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgb('FFFEFC');p.inputs['Roughness'].default_value=.25
p.inputs['Emission Color'].default_value=rgb('FFFEFC');p.inputs['Emission Strength'].default_value=12
eyes=[]
for side in (-1,1):
    o=sphere('Eye.'+('L' if side>0 else 'R'),(side*.35,-.699,1.19),(.17,.075,.17))
    o.data.materials.append(eyeMat)
    for p in o.data.polygons:p.use_smooth=True
    eyes.append(o)
# Morphs on a fixed mesh; arms and face retain correspondence.
body.shape_key_add(name='Basis')
for name in ('Squash','Stretch','Listen','Wave.L','Wave.R'):
    key=body.shape_key_add(name=name,from_mix=False)
    for v,k in zip(body.data.shape_keys.key_blocks['Basis'].data,key.data):
        k.co=v.co
        x,y,z=v.co
        if name=='Squash': k.co=(x*1.20,y*1.14,z*.72)
        elif name=='Stretch':k.co=(x*.87,y*.90,z*1.25)
        else:
            w=max(0,min(1,(abs(x)-.74)/.39))
            if name=='Listen' or (name=='Wave.L' and x>0) or (name=='Wave.R' and x<0):
                k.co.z+=w*.64;k.co.x+=math.copysign(w*.035,x)
for o in eyes:
    o.shape_key_add(name='Basis')
    for name,fac in [('Blink',.055),('Happy',.45)]:
        key=o.shape_key_add(name=name)
        for v,k in zip(o.data.shape_keys.key_blocks['Basis'].data,key.data):
            k.co=v.co
            k.co.z=v.co.z*fac
            if name=='Happy': k.co.z+=.05*(1-(v.co.x/.17)**2)
# Armature with weighted body, soft head, limbs, and eye controls.
bpy.ops.object.armature_add(location=(0,0,0));rig=bpy.context.object;rig.name='MIN_RIG • select me';rig.show_in_front=True
bpy.ops.object.mode_set(mode='EDIT');eb=rig.data.edit_bones;eb.remove(eb[0])
def bone(name,head,tail,parent=None):
    b=eb.new(name);b.head=head;b.tail=tail
    if parent:b.parent=eb[parent]
    return b
bone('ROOT',(0,0,0),(0,0,.3))
bone('Body',(0,0,.28),(0,0,1.0),'ROOT')
bone('Head',(0,0,1.0),(0,0,1.95),'Body')
for side,sign in [('L',1),('R',-1)]:
    bone('Arm.'+side,(sign*.76,0,1.03),(sign*1.1,0,.60),'Body')
    bone('Foot.'+side,(sign*.57,0,.28),(sign*.57,-.28,.13),'Body')
    bone('Eye.'+side,(sign*.35,-.64,1.19),(sign*.35,-.92,1.19),'Head')
bpy.ops.object.mode_set(mode='OBJECT')
for name in ['Body','Head','Arm.L','Arm.R','Foot.L','Foot.R']:body.vertex_groups.new(name=name)
for v in body.data.vertices:
    x,y,z=v.co
    arm=max(0,min(1,(abs(x)-.72)/.34))*math.exp(-((z-.81)/.52)**4)
    foot=max(0,min(1,(.34-z)/.20))*math.exp(-((abs(x)-.57)/.35)**4)
    head=max(0,min(.94,(z-.65)/.65))
    w={'Arm.'+('L' if x>0 else 'R'):arm,'Foot.'+('L' if x>0 else 'R'):foot*(1-arm),'Head':head*(1-arm)*(1-foot),'Body':(1-head)*(1-arm)*(1-foot)}
    for name,val in w.items():
        if val>0:body.vertex_groups[name].add([v.index],val,'REPLACE')
mod=body.modifiers.new('Min deformation rig','ARMATURE');mod.object=rig;body.parent=rig
sub=body.modifiers.new('Silky surface','SUBSURF');sub.levels=1;sub.render_levels=2
for o in eyes:
    vg=o.vertex_groups.new(name=o.name);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Face rig','ARMATURE');mod.object=rig;o.parent=rig
# Convenient properties on the armature; drivers work in ordinary Blender playback.
for prop in ['blink','happy','squash','stretch','listen','wave_L','wave_R']:
    rig[prop]=0.0;rig.id_properties_ui(prop).update(min=0,max=1)
def drive(key,prop):
    d=key.driver_add('value').driver;v=d.variables.new();v.name='v';v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]';d.expression='v'
for key,prop in [('Squash','squash'),('Stretch','stretch'),('Listen','listen'),('Wave.L','wave_L'),('Wave.R','wave_R')]:drive(body.data.shape_keys.key_blocks[key],prop)
for o in eyes:
    drive(o.data.shape_keys.key_blocks['Blink'],'blink');drive(o.data.shape_keys.key_blocks['Happy'],'happy')
    # Match eye positions and sizes to squash/stretch body morphs.
    for axis in range(3):
        d=o.driver_add('location',axis).driver
        for prop in ['squash','stretch']:
            v=d.variables.new();v.name=prop;v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]'
        base=o.location[axis];a=[.20,.14,-.28][axis];b=[-.13,-.10,.25][axis]
        d.expression=f'{base}*(1+({a})*squash+({b})*stretch)'
        d=o.driver_add('scale',axis).driver
        for prop in ['squash','stretch']:
            v=d.variables.new();v.name=prop;v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]'
        d.expression=f'1+({a})*squash+({b})*stretch'
# A restrained four-second idle loop; neutral pose at frame 1.
scene.render.fps=24;scene.frame_start=1;scene.frame_end=96
pb=rig.pose.bones['Body']
for f,s in [(1,1),(25,1.014),(49,1),(73,.991),(97,1)]:
    pb.scale=(1/math.sqrt(s),1/math.sqrt(s),s);pb.keyframe_insert('scale',frame=f,group='Breathing')
for f,v in [(1,0),(57,0),(60,1),(63,0),(97,0)]:rig['blink']=v;rig.keyframe_insert(data_path='["blink"]',frame=f,group='Blink')
rig.animation_data.action.name='Min | gentle idle • 4 seconds';rig.animation_data.action.use_fake_user=True
scene.frame_set(1)
# Studio, deliberately distinct from the exportable character.
def material(name,color,rough=0.5):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgb(color);p.inputs['Roughness'].default_value=rough;return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.name='Studio | charcoal floor';floor.data.materials.append(material('Studio • warm charcoal','252321'))
world=bpy.data.worlds.new('Studio | low ambient');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.17,.14,1);world.node_tree.nodes['Background'].inputs[1].default_value=.24;scene.world=world
def area(name,loc,power,color,size,target=(0,0,1)):
    data=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();data.energy=power;data.color=color;data.shape='DISK';data.size=size
area('Studio | large ivory key',(-3,-4,5),150,(1,.88,.75),3)
area('Studio | peach rim',(2,2.5,3.5),480,(1,.68,.40),2.3)
area('Studio | soft fill',(3,-4,2),45,(.83,.9,1),3)
area('Studio | crown',(-1,1,4),110,(1,.93,.83),2)
data=bpy.data.lights.new('Warm contact bounce','POINT');o=bpy.data.objects.new('Warm contact bounce',data);scene.collection.objects.link(o);o.location=(0,-.03,.09);data.energy=20;data.color=(1,.49,.14);data.shadow_soft_size=.38
camdata=bpy.data.cameras.new('Portrait');cam=bpy.data.objects.new('Camera | idle portrait',camdata);scene.collection.objects.link(cam);cam.location=(.0,-7.5,2.65);cam.rotation_euler=(Vector((0,0,1.12))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=3.6;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
# Very restrained optical glow, confined to the bright eye surface.
nt=bpy.data.node_groups.new('Min optical finish','CompositorNodeTree');scene.compositing_node_group=nt;nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');rl=nt.nodes.new('CompositorNodeRLayers');gl=nt.nodes.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='High';gl.inputs['Threshold'].default_value=1.7;gl.inputs['Strength'].default_value=.22;gl.inputs['Size'].default_value=.25
out=nt.nodes.new('NodeGroupOutput');nt.links.new(rl.outputs['Image'],gl.inputs['Image']);nt.links.new(gl.outputs['Image'],out.inputs['Image'])
# Readme is embedded as well as delivered alongside the file.
notes='''MIN / IDLE CHARACTER\nFront is -Y; Z is up. Height approximately 2.3 Blender units.\nSelect MIN_RIG. Custom properties: blink, happy, squash, stretch, listen, wave_L, wave_R (0–1).\nPose bones: ROOT, Body, Head, Arm.L/R, Foot.L/R, Eye.L/R.\nBody is a single closed sculpt mesh with weighted deformation, non-destructive subdivision and morph targets. Eye lenses are separate meshes.\nThe 96-frame, 24fps idle action includes breathing and one blink. Frame 1 is the neutral idle. Clear or mute the idle action before manually adjusting animated controls.\nColor and socket attributes follow the body mesh. The socket darkens the surface; it is not a luminous ring.\nThe original 2D alpha, pixel blur, and SCREEN material notes are interpreted for 3D lighting, not mapped literally.\nCycles is the authored renderer. The shader uses vertex attributes, subsurface scattering and transmission. Mobile use will require material baking/adaptation and mesh optimization for the target renderer.\nShape controls are designed individually; extreme combinations can require corrective sculpting.\n'''
bpy.data.texts.new('START HERE • Min').write(notes)
open(OUT+'/README.txt','w').write(notes)
for name in ['Character','Studio']:
    c=bpy.data.collections.new(name);scene.collection.children.link(c)
for o in list(scene.objects):
    c=bpy.data.collections['Character' if o in [body,rig]+eyes else 'Studio']
    for old in list(o.users_collection):old.objects.unlink(o)
    c.objects.link(o)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.shading.type='MATERIAL'
scene.render.image_settings.file_format='PNG';scene.render.filepath=OUT+'/min-idle.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/Min_Idle.blend')
print('BUILT',len(body.data.vertices),'vertices',len(body.data.polygons),'faces')
