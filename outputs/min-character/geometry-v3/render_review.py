import bpy
OUT='/Users/nao/Desktop/kin-site/outputs/min-character/geometry-v3'
s=bpy.context.scene;s.cycles.samples=32;s.render.resolution_x=720;s.render.resolution_y=720
for name in ['Front','Three-quarter','Right','Back']:
 s.camera=bpy.data.objects['Review camera | '+name];s.render.filepath=OUT+'/min-v3-clay-'+name.lower().replace(' ','-')+'.png';bpy.ops.render.render(write_still=True)
# A darker satin surface exposes bumps or seams that neutral clay can conceal.
b=bpy.data.objects['Min v3 | continuous idle body'];p=b.data.materials[0].node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.065,.105,.125,1);p.inputs['Roughness'].default_value=.28
s.camera=bpy.data.objects['Review camera | Three-quarter'];s.render.filepath=OUT+'/min-v3-satin-three-quarter.png';bpy.ops.render.render(write_still=True)
