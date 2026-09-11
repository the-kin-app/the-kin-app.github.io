# Prerender the SHIPPED Min (assets/models/min-home.glb) for the night sections.
# Lighting mirrors min-home-night.png: cool slate ambient, one warm amber key
# from the left where the light column stands, Min's own lamp the warmest note.
import bpy, math, sys
from mathutils import Vector

SP = '/private/tmp/claude-501/-Users-nao-Desktop-kin-site/320309bf-3b95-4819-abda-48518687f7ae/scratchpad'
OUT = '/Users/nao/Desktop/kin-site/assets/img/min-night'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SP + '/min-home-plain.glb')

body = bpy.data.objects['MinBody']
eyes = [bpy.data.objects['Eye.L.001'], bpy.data.objects['Eye.R.001']]

# one parent so a single rotation turns Min as a whole
pivot = bpy.data.objects.new('MIN', None)
bpy.context.scene.collection.objects.link(pivot)
for o in [body] + eyes:
    o.parent = pivot
    o.matrix_parent_inverse = pivot.matrix_world.inverted()

# ---- shell: warm translucent resin with an amber lamp inside ---------------
shell = bpy.data.materials.new('Min shell')
shell.use_nodes = True
nt = shell.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
mix = nt.nodes.new('ShaderNodeMixShader')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
emit = nt.nodes.new('ShaderNodeEmission')
# The lamp is a warm CORE low and central, falling off in every direction —
# the same shape as the web shader's exp(-dot(coreDistance,coreDistance)),
# not a vertical wipe. Generated coords run 0..1 over the bounding box.
tex = nt.nodes.new('ShaderNodeTexCoord')
sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'
sub.inputs[1].default_value = (0.5, 0.5, 0.30)          # core sits low, centred
scl = nt.nodes.new('ShaderNodeVectorMath'); scl.operation = 'MULTIPLY'
scl.inputs[1].default_value = (2.0, 1.4, 2.2)           # tighter vertically
dst = nt.nodes.new('ShaderNodeVectorMath'); dst.operation = 'LENGTH'
fall = nt.nodes.new('ShaderNodeMapRange')
fall.inputs['From Min'].default_value = 0.0
fall.inputs['From Max'].default_value = 1.0
fall.inputs['To Min'].default_value = 1.0
fall.inputs['To Max'].default_value = 0.0
fall.clamp = True
ramp = nt.nodes.new('ShaderNodeValToRGB')
bsdf.inputs['Base Color'].default_value = (0.66, 0.56, 0.47, 1)
bsdf.inputs['Roughness'].default_value = 0.52
bsdf.inputs['Subsurface Weight'].default_value = 0.55
bsdf.inputs['Subsurface Radius'].default_value = (0.55, 0.26, 0.11)
bsdf.inputs['Subsurface Scale'].default_value = 0.42
bsdf.inputs['IOR'].default_value = 1.42
bsdf.inputs['Coat Weight'].default_value = 0.12
bsdf.inputs['Coat Roughness'].default_value = 0.55
emit.inputs['Color'].default_value = (1.0, 0.44, 0.14, 1)
emit.inputs['Strength'].default_value = 3.6
nt.links.new(tex.outputs['Generated'], sub.inputs[0])
nt.links.new(sub.outputs['Vector'], scl.inputs[0])
nt.links.new(scl.outputs['Vector'], dst.inputs[0])
nt.links.new(dst.outputs['Value'], fall.inputs['Value'])
nt.links.new(fall.outputs['Result'], ramp.inputs['Fac'])
# the core never fully takes over the surface — shading has to survive it
ramp.color_ramp.elements[0].position = 0.02
ramp.color_ramp.elements[1].position = 0.95
ramp.color_ramp.elements[1].color = (0.72, 0.72, 0.72, 1)
nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1])
nt.links.new(emit.outputs['Emission'], mix.inputs[2])
nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
body.data.materials.clear(); body.data.materials.append(shell)

# ---- eyes: the two lit lenses --------------------------------------------
lens = bpy.data.materials.new('Min eye')
lens.use_nodes = True
lnt = lens.node_tree; lnt.nodes.clear()
lo = lnt.nodes.new('ShaderNodeOutputMaterial')
le = lnt.nodes.new('ShaderNodeEmission')
le.inputs['Color'].default_value = (1.0, 0.90, 0.72, 1)
le.inputs['Strength'].default_value = 11.0
lnt.links.new(le.outputs['Emission'], lo.inputs['Surface'])
for e in eyes:
    e.data.materials.clear(); e.data.materials.append(lens)

# ---- the night room, as light --------------------------------------------
world = bpy.data.worlds.new('Night'); bpy.context.scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes['Background']
wn.inputs['Color'].default_value = (0.075, 0.098, 0.175, 1)   # the slate sky, saturated
wn.inputs['Strength'].default_value = 0.55

def light(name, kind, loc, energy, color, size=2.0):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    if kind == 'POINT': d.shadow_soft_size = size
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 1.05)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

# The room's one warm source, low and to the left, where the light column
# stands in min-home-night.png — and the cool sky filling the other side.
light('amber key',  'AREA',  (-4.6, -3.2, 2.2), 620, (1.0, 0.74, 0.46), 3.2)
light('sky fill',   'AREA',  ( 5.2, -1.4, 3.4), 820, (0.40, 0.55, 1.00), 6.0)
light('sky rim',    'AREA',  ( 1.2,  4.4, 3.8), 900, (0.52, 0.66, 1.00), 4.0)
# Min's own lamp spilling onto his feet, the way it pools in the hero room
light('lamp spill', 'POINT', ( 0.0, -0.5, 0.28),  34, (1.0, 0.52, 0.18), 0.8)

# ---- camera ---------------------------------------------------------------
cd = bpy.data.cameras.new('Cam'); cd.lens = 85
cam = bpy.data.objects.new('Cam', cd)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = 200
s.cycles.use_denoising = True
s.render.film_transparent = True
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.render.resolution_x = s.render.resolution_y = 720
try:
    s.cycles.device = 'GPU'
    bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'METAL'
    bpy.context.preferences.addons['cycles'].preferences.get_devices()
except Exception as e:
    print('GPU unavailable, CPU:', e)

# name, Min's turn (rad), camera distance, camera height, aim height
SHOTS = [
    # 1 · talk to min — square on, close, wholly attentive to you
    ('talk',  0.00, 9.6, 1.52, 1.10),
    # 2 · min matches you — turning out into the room to look
    ('match', -0.58, 9.8, 1.72, 1.12),
    # 3 · go say hello — committed to that direction, leading off. The turn
    #     stops short of a profile: Min's nubs stand out sideways, so past
    #     ~60° the near one crosses in front of his face and the lenses go.
    ('hello', -1.00, 9.9, 1.44, 1.10),
]
want = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for name, turn, dist, height, aim in SHOTS:
    if want and name not in want: continue
    pivot.rotation_euler = (0, 0, turn)
    cam.location = (0, -dist, height)
    cam.rotation_euler = (Vector((0, 0, aim)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = f'{OUT}-{name}.png'
    bpy.ops.render.render(write_still=True)
    print('WROTE', s.render.filepath)
