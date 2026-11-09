# Forest trees (models/tree.glb) for the forest hexes (openspec change forest-woods-and-trees): a
# mix of the original faceted trees from forest-trees.py and the 8 background trees of
# "Low Poly Forest Tree Pack" by 99.Miles (CC BY 4.0, downloaded by the project owner from
# https://sketchfab.com/3d-models/low-poly-forest-tree-pack-5ff5a51e74324845a4e4905f182dfb2b).
# The pack trees are rescaled to board units, their origin moved to the trunk base, crowns
# widened a little so they read from above, and their atlas (diffuse + opacity, 2K PNGs) baked
# into one 768 px RGBA texture with alpha clipping, exported as WebP.
#
# Root meshes in the GLB:
#   tree_variant_0..4   faceted: tall spruce, spruce, young spruce, birch, broadleaf
#   tree_variant_5..12  pack: Background_Tree_Atlas, .001 ... .007 (sorted by name)
#
# Usage:
#   blender -b --factory-startup --disable-autoexec --python tools/blender/tree-pack.py -- \
#     <out.glb> <preview.png> <faceted.glb> [pack .blend]
# The pack .blend defaults to tools/blender/source/tree-pack-source.blend (the owner's download
# with its textures packed in). Give the extracted Tree_Pack.blend once to create that file; its
# textures are found next to it or in a TEXTURES/textures folder above it.
import bpy, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG, FACETED = argv[0], argv[1], argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
PACK_SOURCE = os.path.join(HERE, "source", "tree-pack-source.blend")
PACK = argv[3] if len(argv) > 3 else PACK_SOURCE

TALLEST = 0.32       # board height of the tallest pack tree
CROWN_WIDEN = 1.3    # extra width so the slim trees cover some ground seen from above
ATLAS_SIZE = 768
N_FACETED = 5

bpy.ops.wm.open_mainfile(filepath=PACK, load_ui=False)
scene = bpy.context.scene
if PACK != PACK_SOURCE:
    d = os.path.dirname(os.path.abspath(PACK))
    for cand in (d, os.path.join(d, "..", "TEXTURES"), os.path.join(d, "..", "textures"),
                 os.path.join(d, "..", "..", "..", "textures")):
        if os.path.isdir(cand):
            bpy.ops.file.find_missing_files(directory=cand)
    bpy.ops.file.pack_all()
    os.makedirs(os.path.dirname(PACK_SOURCE), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=PACK_SOURCE, compress=True)

# --- Keep the background trees, drop everything else -------------------------------------------
trees = sorted((o for o in bpy.data.objects
                if o.type == "MESH" and o.name.startswith("Background_Tree_Atlas") and o.dimensions.z > 10),
               key=lambda o: o.name)
assert len(trees) == 8, [o.name for o in trees]
for o in list(bpy.data.objects):
    if o not in trees:
        bpy.data.objects.remove(o)

# --- Bake the atlas: diffuse RGB + opacity -> one RGBA image at ATLAS_SIZE --------------------
def find_image(word):
    for im in bpy.data.images:
        if "Background_Tree_Atlas" in im.name and word in im.name.lower():
            return im
    raise RuntimeError("missing atlas image: " + word)


diffuse, opacity = find_image("diffuse"), find_image("opacity")
w, h = diffuse.size
px = np.empty(w * h * 4, dtype=np.float32)
diffuse.pixels.foreach_get(px)
op = np.empty(opacity.size[0] * opacity.size[1] * 4, dtype=np.float32)
opacity.pixels.foreach_get(op)
assert opacity.size[0] == w
px = px.reshape(-1, 4)
px[:, 3] = op.reshape(-1, 4)[:, 0]
atlas = bpy.data.images.new("tree_pack_atlas", w, h, alpha=True)
atlas.pixels.foreach_set(px.ravel())
atlas.scale(ATLAS_SIZE, ATLAS_SIZE)
atlas.pack()

leaf = bpy.data.materials.new("TreePackLeaves")
leaf.use_nodes = True
nt = leaf.node_tree
bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = atlas
cut = nt.nodes.new("ShaderNodeMath")
cut.operation = "ROUND"  # the glTF exporter writes alphaMode MASK (cutoff 0.5) for this
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Alpha"], cut.inputs[0])
nt.links.new(cut.outputs[0], bsdf.inputs["Alpha"])
bsdf.inputs["Roughness"].default_value = 0.9
leaf.use_backface_culling = False

# --- Rescale, re-anchor and rename the pack trees ----------------------------------------------
tallest = max(o.dimensions.z for o in trees)
s = TALLEST / tallest
for i, o in enumerate(trees):
    o.data.materials.clear()
    o.data.materials.append(leaf)
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    for v in o.data.vertices:
        v.co = mw @ v.co
    o.matrix_world = o.matrix_world.Identity(4)
    zmin = min(v.co.z for v in o.data.vertices)
    base = [v.co for v in o.data.vertices if v.co.z < zmin + 1.0]
    cx = sum(p.x for p in base) / len(base)
    cy = sum(p.y for p in base) / len(base)
    for v in o.data.vertices:
        v.co = Vector(((v.co.x - cx) * s * CROWN_WIDEN, (v.co.y - cy) * s * CROWN_WIDEN, (v.co.z - zmin) * s))
    o.data.update()
    o.name = o.data.name = f"tree_variant_{N_FACETED + i}"

# --- Bring in the faceted trees as variants 0..4 -------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=FACETED)
faceted = sorted((o for o in bpy.data.objects if o not in before and o.parent is None), key=lambda o: o.name)
assert len(faceted) == N_FACETED, [o.name for o in faceted]
kit = faceted + trees
for k, o in enumerate(kit):
    o.location = (0, 0, 0)

# --- Export ----------------------------------------------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
for o in kit:
    o.select_set(True)
bpy.context.view_layer.objects.active = kit[0]
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_image_format="WEBP", export_image_quality=70,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
)
for o in kit:
    vs = o.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    print("VARIANT", o.name, "TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons),
          "SIZE", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), "H", round(max(zs), 3))
print("GLB", os.path.getsize(OUT_GLB))

# --- Preview: the 13 trees in two rows on forest-green ground -----------------------------------
for k, o in enumerate(kit):
    row = 0 if k < N_FACETED else 1
    col = k if row == 0 else k - N_FACETED
    o.location = (-0.5 + col * (0.25 if row == 0 else 0.15), -0.15 + row * 0.3, 0)
bpy.ops.mesh.primitive_plane_add(size=3)
g = bpy.context.active_object
gm = bpy.data.materials.new("G")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.09, 0.19, 0.03, 1)
g.data.materials.append(gm)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
cam.data.lens = 45
cam.location = (0, -1.5, 1.0)
cam.rotation_euler = (Vector((0, 0.05, 0.1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3
sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.6, 0.65, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
scene.world = world
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = 0
scene.view_settings.look = "None"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 800
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT_PNG)
