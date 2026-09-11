Sources for the homepage's night sections. NOT deployed — assets/img/ only
carries the compressed cuts the page loads.

  min-home-night-source.png   the room after dark, 1423x1105
                              → assets/img/min-night-room.webp        (23 KB)
                              → assets/img/min-night-room-mobile.webp (12 KB)

  min-night-{talk,match,hello}.png   Min, 720x720 transparent, rendered from
                              assets/models/min-home.glb (the same mesh the
                              hero's WebGL scene loads, so the stills and the
                              live Min are the same character). Lit to this
                              room: amber key low and left where the light
                              column stands, cool sky filling from the right,
                              his own lamp the warmest note.
                              → assets/img/min-night-*.webp     (~10 KB each)

The three poses are one continuous turn — facing you, turning out into the
room, then leading off. The turn stops short of a profile: Min's nubs stand
out sideways, so past ~60 degrees the near one crosses in front of his face
and the lenses disappear, which reads as a back rather than an invitation.

Re-rendering: the GLB is meshopt-compressed and Blender's importer can't read
that, so decompress first:
  npx @gltf-transform/cli cp assets/models/min-home.glb /tmp/min-plain.glb
then point the render script's import at the decompressed copy.
