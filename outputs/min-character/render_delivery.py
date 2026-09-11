import bpy, os
from mathutils import Vector
s=bpy.context.scene
out='/Users/nao/Desktop/kin-site/outputs/min-character'
s.render.resolution_x=640;s.render.resolution_y=640;s.cycles.samples=32
cam=s.camera
for name,location in [('front',(0,-8,1.3)),('three-quarter',(4,-7,2.5)),('back',(0,8,1.8))]:
 cam.location=location;cam.rotation_euler=(Vector((0,0,1.12))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=out+'/min-'+name+'.png';bpy.ops.render.render(write_still=True)
cam.location=(0,-7.5,2.65);cam.rotation_euler=(Vector((0,0,1.12))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.data.objects['Studio | charcoal floor'].hide_render=True
s.render.film_transparent=True;s.render.image_settings.color_mode='RGBA';s.render.resolution_x=1000;s.render.resolution_y=1000;s.cycles.samples=64;s.render.filepath=out+'/min-idle-transparent.png';bpy.ops.render.render(write_still=True)
