# Sea gull for the sea birds (asset key `prop.gull`): the owner-supplied "low poly bird
# (animated)" FBX (CC-BY-4.0, see the theme credits), textured, centred, scaled to a wingspan
# of 1 unit and exported as a Draco GLB with its flap animation. The game sizes it with the
# theme `scale`. The bird faces game −Z (Blender +Y), like the procedural fallback.
#
# Usage:
#   blender -b --factory-startup --python tools/blender/gull.py -- <out.glb> <preview-prefix>
# Sources: tools/blender/source/gull/Bird_Asset.fbx and BirdUVTexture.jpeg.
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
OUT = args[0]
PREVIEW = args[1] if len(args) > 1 else None
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source", "gull")
# Turn about Blender Z so the beak points at +Y (game −Z). Set from the preview renders.
YAW_DEG = float(os.environ.get("GULL_YAW", "180"))
TEXTURE_PX = 256

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, "Bird_Asset.fbx"))

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
arm.name = "Gull"
mesh.name = "GullMesh"
# The FBX bird faces Blender −Y; turn it before measuring so the centring stays right.
arm.rotation_euler.z += math.radians(YAW_DEG)
bpy.context.view_layer.update()

# Texture: the FBX points at a path from the author's machine; use the shipped JPEG,
# shrunk to keep the GLB inside the asset budget.
img = bpy.data.images.load(os.path.join(SRC, "BirdUVTexture.jpeg"))
img.scale(TEXTURE_PX, TEXTURE_PX)
img.pack()
mat = bpy.data.materials.new("Gull")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.9
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = img
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
mesh.data.materials.clear()
mesh.data.materials.append(mat)

# Normalize: wingspan (largest horizontal size over the whole flap) = 1, centred on the origin.
scene = bpy.context.scene
action = bpy.data.actions[0]
f0, f1 = (int(x) for x in action.frame_range)
scene.frame_start, scene.frame_end = f0, f1
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for f in range(f0, f1 + 1, 4):
    scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    for v in ev.to_mesh().vertices:
        p = ev.matrix_world @ v.co
        lo = Vector(map(min, lo, p))
        hi = Vector(map(max, hi, p))
    ev.to_mesh_clear()
size = hi - lo
span = max(size.x, size.y)
centre = (lo + hi) / 2
k = 1.0 / span
arm.location = (arm.location - centre) * k
arm.scale = arm.scale * k
print("SPAN", round(span, 4), "SIZE", [round(c, 4) for c in size], "FRAMES", f0, f1)

if PREVIEW:
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "TEXTURE"
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    world = bpy.data.worlds.new("w")
    world.color = (0.55, 0.72, 0.78)
    scene.world = world
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 1.4
    views = {"top": ((0, 0, 3), (0, 0, 0)), "front": ((0, 3, 0.2), (math.radians(90), 0, math.radians(180))), "side": ((3, 0, 0.2), (math.radians(90), 0, math.radians(90)))}
    for name, (loc, rot) in views.items():
        for f in (f0, (f0 + f1) // 4):
            scene.frame_set(f)
            cam.location, cam.rotation_euler = loc, rot
            scene.render.filepath = f"{PREVIEW}-{name}-{f}.png"
            bpy.ops.render.render(write_still=True)

scene.frame_set(f0)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
mesh.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_animations=True,
    export_skins=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_image_format="JPEG",
)
mesh.data.calc_loop_triangles()
print("TRIS", len(mesh.data.loop_triangles), "OUT", OUT, os.path.getsize(OUT))
