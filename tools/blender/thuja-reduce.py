# Reduces BlendKit's "Thuja Occidentalis Lowpoly" (Alexander Novgorodtsev, BlendKit Royalty Free;
# about 3.2M vertices of leaf cards) into the game's `prop.tree`: a low-poly faceted crown shell
# (voxel remesh -> decimate) plus a short trunk, flat Pine/PineLight/Bark materials, 0.24 units
# high (a city is 0.368), two variants named tree_variant_0..1 with their origin at the base.
#
# The source .blend is downloaded by the owner with the BlendKit add-on into the git-ignored
# assets/ folder and is never shipped.
# Usage: blender -b --factory-startup assets/blendkit/thuja.blend --python tools/blender/thuja-reduce.py -- \
#          <out tree.glb> <preview.png> [target tris per variant, default 1500]
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]
TARGET = int(argv[2]) if len(argv) > 2 else 1500
HEIGHT = 0.24
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(5)
scene = bpy.context.scene

src = next(o for o in bpy.data.objects if o.type == "MESH")
print("SOURCE", src.name, len(src.data.vertices), tuple(round(v, 3) for v in src.dimensions))


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def mean_leaf_color():
    """Average colour of the opaque pixels of the leaf texture (linear), or None."""
    for m in src.data.materials:
        if not m or not m.use_nodes or "leaf" not in m.name.lower():
            continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 0:
                img = n.image
                px = list(img.pixels[:])
                step = max(1, (len(px) // 4) // 40000) * 4
                acc = [0.0, 0.0, 0.0]
                cnt = 0
                for i in range(0, len(px), step):
                    if px[i + 3] > 0.5:
                        acc[0] += px[i]; acc[1] += px[i + 1]; acc[2] += px[i + 2]; cnt += 1
                if cnt:
                    return tuple(a / cnt for a in acc), img.name
    return None


leaf = mean_leaf_color()
print("LEAF", leaf)
base = leaf[0] if leaf else srgb("#3d6b35")


def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


# Painterly split: a darker inner/lower green and a lighter upper green from the leaf colour.
M_BARK = mat("Bark", srgb("#6b4a33"))
# The texture's mean is much lighter than the shaded tree reads (leaf cards self-shadow), so use
# fixed greens matched to a render of the original; the mean is only printed for reference.
M_PINE = mat("Pine", srgb("#3f6d3c"))
M_PINE_LIGHT = mat("PineLight", srgb("#6c9a4c"))

# --- Crown shell ---------------------------------------------------------------------------
crown = src.copy()
crown.data = src.data.copy()
scene.collection.objects.link(crown)
bpy.ops.object.select_all(action="DESELECT")
crown.select_set(True)
bpy.context.view_layer.objects.active = crown
# The source sits under an empty; bake its world transform and detach, so copies are free-standing.
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

dims = crown.dimensions.copy()
voxel = dims.z / 46.0  # coarse enough to close the gaps between leaf cards
rm = crown.modifiers.new("Remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = voxel
rm.use_smooth_shade = False
bpy.ops.object.modifier_apply(modifier=rm.name)
print("REMESHED", len(crown.data.polygons))

# Keep only the largest connected piece (drops floating twig islands).
bm = bmesh.new()
bm.from_mesh(crown.data)
bm.verts.ensure_lookup_table()
seen, islands = set(), []
for v in bm.verts:
    if v.index in seen:
        continue
    stack, isl = [v], []
    seen.add(v.index)
    while stack:
        cur = stack.pop()
        isl.append(cur)
        for e in cur.link_edges:
            o = e.other_vert(cur)
            if o.index not in seen:
                seen.add(o.index)
                stack.append(o)
    islands.append(isl)
islands.sort(key=len, reverse=True)
drop = [v for isl in islands[1:] for v in isl if len(isl) < len(islands[0]) * 0.05]
bmesh.ops.delete(bm, geom=drop, context="VERTS")
bm.to_mesh(crown.data)
bm.free()


def finish_variant(obj, name, squash, twist, seed):
    """Decimate, jag, scale to HEIGHT, add a trunk, colour faces; returns the object."""
    o = obj.copy()
    o.data = obj.data.copy()
    o.name = o.data.name = name
    scene.collection.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    dec = o.modifiers.new("Decimate", "DECIMATE")
    dec.ratio = min(1.0, TARGET / max(1, len(o.data.polygons) * 2))
    bpy.ops.object.modifier_apply(modifier=dec.name)

    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    zs = [v.co.z for v in bm.verts]
    zmin, zmax = min(zs), max(zs)
    cx = sum(v.co.x for v in bm.verts) / len(bm.verts)
    cy = sum(v.co.y for v in bm.verts) / len(bm.verts)
    s = HEIGHT / (zmax - zmin)
    off = Vector((seed * 2.3, seed * 1.1, seed * 3.7))
    for v in bm.verts:
        p = Vector((v.co.x - cx, v.co.y - cy, v.co.z - zmin)) * s
        # Jag the silhouette so it reads as foliage, not a smooth blob.
        n = noise.noise(p * 55 + off) * 0.7 + noise.noise(p * 160 + off) * 0.3
        r = Vector((p.x, p.y, 0))
        if r.length > 1e-6:
            p += r.normalized() * n * 0.009 * min(1.0, r.length / 0.02)
        p.z += n * 0.004
        # Variant shaping: squash/stretch and a slight twist with height.
        a = twist * (p.z / HEIGHT)
        p = Vector((p.x * math.cos(a) - p.y * math.sin(a), p.x * math.sin(a) + p.y * math.cos(a), p.z))
        p.x *= 1 / math.sqrt(squash)
        p.y *= 1 / math.sqrt(squash)
        p.z *= squash
        v.co = p
    bm.normal_update()
    zs = [v.co.z for v in bm.verts]
    lo, hi = min(zs), max(zs)
    for f in bm.faces:
        c = f.calc_center_median()
        patch = noise.noise(c * 90 + off) > 0.18
        up = f.normal.z > 0.2 and c.z > lo + (hi - lo) * 0.3
        f.material_index = 2 if (up or (patch and f.normal.z > -0.3)) else 1
        f.smooth = False
    # Trunk under the crown.
    trunk_h = max(0.03, lo + 0.03)
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=True, segments=6, radius1=0.012, radius2=0.008, depth=trunk_h + 0.02)
    bmesh.ops.translate(t, vec=Vector((0, 0, (trunk_h + 0.02) / 2 - 0.005)), verts=t.verts)
    me = bpy.data.meshes.new("trunk")
    t.to_mesh(me)
    t.free()
    n0 = len(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bm.faces.ensure_lookup_table()
    for f in bm.faces[n0:]:
        f.material_index = 0
    o.data.materials.clear()
    for m in (M_BARK, M_PINE, M_PINE_LIGHT):
        o.data.materials.append(m)
    bm.to_mesh(o.data)
    bm.free()
    o.parent = None
    o.matrix_world.identity()
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    print("VARIANT", name, "TRIS", len(o.data.polygons), "H", round(max(zs) - min(zs), 3),
          "W", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3))
    return o


variants = [
    finish_variant(crown, "tree_variant_0", 1.0, 0.0, 1),
    finish_variant(crown, "tree_variant_1", 0.85, 2.2, 2),
]
bpy.data.objects.remove(crown)

kit = bpy.data.collections.new("tree")
scene.collection.children.link(kit)
for o in variants:
    for c in o.users_collection:
        c.objects.unlink(o)
    kit.objects.link(o)

bpy.ops.object.select_all(action="DESELECT")
for o in variants:
    o.select_set(True)
bpy.context.view_layer.objects.active = variants[0]
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
print("GLB", os.path.getsize(OUT_GLB))

# --- Preview: the original (scaled to the same height) beside the two reduced variants ----------
s = HEIGHT / src.dimensions.z
src.scale = (s, s, s)
src.location = (-0.3, 0, -min((src.matrix_world @ v.co).z for v in src.data.vertices[:2000]) * 0)
bpy.context.view_layer.update()
zmin_src = min((src.matrix_world @ Vector(b)).z for b in src.bound_box)
src.location.z -= zmin_src
variants[0].location = (0.0, 0, 0)
variants[1].location = (0.25, 0, 0)
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
ground = bpy.context.active_object
ground.data.materials.append(mat("GroundM", srgb("#9fb565")))
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 60
scene.collection.objects.link(cam)
cam.location = (0.0, -1.25, 0.42)
look = Vector((-0.02, 0, 0.11))
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.2
sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#bfd3dc"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = world
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1000
scene.render.resolution_y = 620
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT_PNG)
