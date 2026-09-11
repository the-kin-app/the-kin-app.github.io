MIN / IDLE CHARACTER
Front is -Y; Z is up. Height approximately 2.3 Blender units.
Select MIN_RIG. Custom properties: blink, happy, squash, stretch, listen, wave_L, wave_R (0–1).
Pose bones: ROOT, Body, Head, Arm.L/R, Foot.L/R, Eye.L/R.
Body is a single closed sculpt mesh with weighted deformation, non-destructive subdivision and morph targets. Eye lenses are separate meshes.
The 96-frame, 24fps idle action includes breathing and one blink. Frame 1 is the neutral idle. Clear or mute the idle action before manually adjusting animated controls.
Color and socket attributes follow the body mesh. The socket darkens the surface; it is not a luminous ring.
The original 2D alpha, pixel blur, and SCREEN material notes are interpreted for 3D lighting, not mapped literally.
Cycles is the authored renderer. The shader uses vertex attributes, subsurface scattering and transmission. Mobile use will require material baking/adaptation and mesh optimization for the target renderer.
Shape controls are designed individually; extreme combinations can require corrective sculpting.

DELIVERABLES
Min_Idle.blend — editable Blender 5.1 project, packed reference, rig, materials, lighting and idle action.
min-idle.png — studio portrait.
min-idle-transparent.png — transparent RGBA portrait.
min-front.png, min-three-quarter.png, min-back.png — inspection views.

ANIMATION NOTES
Enable viewport overlays to see the rig bones. Select MIN_RIG, then use Object Properties > Custom Properties for facial and shape sliders. Pose Mode exposes the bones.
When setting custom properties through Python, call rig.update_tag() and advance/set the frame to refresh drivers.
Eye diameter is 17% of the central body width; center separation is 35%. The face has no mouth or pupils.
Validation: closed manifold body, normalized bone weights by construction, valid morph drivers, blink at frame 60 and neutral pose at frame 1.
This is the Blender animation master, not a performance-budgeted mobile runtime asset.
