# Forest trees for the forest hexes (openspec change forest-woods-and-trees), in the spirit of the
# low-poly forest packs the owner pointed at (style only, nothing downloaded or traced): faceted
# spruces in drooping tiers, white birches and a round broadleaf tree. One GLB (models/tree.glb)
# holding root-level meshes named tree_variant_0..4, origin at the trunk base:
#   0 tall spruce   1 spruce   2 young spruce   3 birch   4 broadleaf
# The tallest stays under a city piece (0.368). Game units: 1 unit = hex circumradius, +Z up
# (exported Y-up).
#
# Usage: blender -b --factory-startup --python tools/blender/forest-trees.py -- <out.glb> <preview.png> [models dir]
# Also saves tools/blender/source/forest-trees.blend.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]
MODELS = argv[2] if len(argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(23)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def mat(name, hexrgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hexrgb), 1)
    b.inputs["Roughness"].default_value = rough
    return m


MATS = [
    mat("Bark", "#5b3e29"),
    mat("Needles", "#2e5a35"),
    mat("NeedlesLight", "#3f7040"),
    mat("NeedlesDark", "#22442a"),
    mat("BirchBark", "#e6e1d3"),
    mat("BirchMark", "#2e2a26"),
    mat("BirchLeaf", "#9cb944"),
    mat("BirchLeafLight", "#b8cf5a"),
    mat("Leaf", "#5d8a33"),
    mat("LeafLight", "#78a43d"),
    mat("LeafDark", "#466f28"),
]
(BARK, NEEDLES, NEEDLES_LIGHT, NEEDLES_DARK, BIRCH, BIRCH_MARK, BIRCH_LEAF, BIRCH_LEAF_LIGHT,
 LEAF, LEAF_LIGHT, LEAF_DARK) = range(len(MATS))


def add_part(bm, tmp, index):
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    n0 = len(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bm.faces.ensure_lookup_table()
    for f in bm.faces[n0:]:
        f.material_index = index
    return list(bm.faces[n0:])


def trunk(bm, r0, r1, h, index, base=(0, 0, 0), lean=(0.0, 0.0), sides=6):
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=sides, radius1=r0, radius2=r1, depth=h)
    bmesh.ops.translate(tmp, vec=Vector((0, 0, h / 2)), verts=tmp.verts)
    for v in tmp.verts:  # lean the top
        t = v.co.z / h
        v.co.x += lean[0] * t
        v.co.y += lean[1] * t
    bmesh.ops.translate(tmp, vec=Vector(base), verts=tmp.verts)
    return add_part(bm, tmp, index)


def tier(bm, radius, height, z, index, seed, segs=9, droop=0.25):
    """One spruce tier: a faceted cone whose rim zig-zags (branch tips droop) and whose
    vertices are jittered."""
    tmp = bmesh.new()
    rim = []
    for s in range(segs):
        a = 2 * math.pi * s / segs + seed
        r = radius * (1.0 if s % 2 == 0 else 0.78) * random.uniform(0.92, 1.06)
        dz = -height * droop * (1 if s % 2 == 0 else 0.2)
        rim.append(tmp.verts.new((math.cos(a) * r, math.sin(a) * r, dz)))
    inner = []
    for s in range(segs):
        a = 2 * math.pi * (s + 0.5) / segs + seed
        r = radius * 0.45
        inner.append(tmp.verts.new((math.cos(a) * r, math.sin(a) * r, height * 0.42)))
    top = tmp.verts.new((random.uniform(-1, 1) * radius * 0.04, random.uniform(-1, 1) * radius * 0.04, height))
    bottom = tmp.verts.new((0, 0, height * 0.05))
    for s in range(segs):
        a, b = rim[s], rim[(s + 1) % segs]
        i0, i1 = inner[s], inner[(s + 1) % segs]
        prev = inner[(s - 1) % segs]
        tmp.faces.new((a, b, i0))
        tmp.faces.new((a, i0, prev))
    for s in range(segs):
        tmp.faces.new((inner[s], inner[(s + 1) % segs], top))
    for s in range(segs):
        tmp.faces.new((rim[(s + 1) % segs], rim[s], bottom))
    bmesh.ops.remove_doubles(tmp, verts=tmp.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    for v in tmp.verts:
        v.co += Vector((noise.noise(v.co * 60 + Vector((seed, 0, 0))),
                        noise.noise(v.co * 60 + Vector((0, seed, 0))), 0)) * radius * 0.08
    bmesh.ops.translate(tmp, vec=Vector((0, 0, z)), verts=tmp.verts)
    tmp.normal_update()
    faces = add_part(bm, tmp, index)
    for f in faces:  # light tops, dark undersides
        if f.normal.z < -0.2:
            f.material_index = NEEDLES_DARK
        elif f.normal.z > 0.75 and random.random() < 0.6:
            f.material_index = NEEDLES_LIGHT
    return faces


def spruce(bm, height, width, tiers):
    trunk(bm, width * 0.11, width * 0.06, height * 0.35, BARK)
    z = height * 0.12
    span = height - z
    for k in range(tiers):
        t = k / tiers
        r = width * (1 - t * 0.82)
        h = span / tiers * 1.75
        tier(bm, r, h, z + span * t * 0.9, NEEDLES, random.random() * 6, droop=0.22)


def blob(bm, radius, at, index, light, dark, squash=0.85, seed=0.0):
    """A faceted leafy clump: a jittered icosphere, lit on top and dark underneath."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=radius)
    for v in tmp.verts:
        v.co *= 1 + 0.16 * noise.noise(v.co * 30 / radius * 0.03 + Vector((seed, seed, 0)))
        v.co.z *= squash
    bmesh.ops.translate(tmp, vec=Vector(at), verts=tmp.verts)
    tmp.normal_update()
    faces = add_part(bm, tmp, index)
    for f in faces:
        if f.normal.z > 0.55 and random.random() < 0.7:
            f.material_index = light
        elif f.normal.z < -0.35:
            f.material_index = dark


def branch(bm, start, end, r, index):
    d = Vector(end) - Vector(start)
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=5, radius1=r, radius2=r * 0.6, depth=d.length)
    bmesh.ops.translate(tmp, vec=Vector((0, 0, d.length / 2)), verts=tmp.verts)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=rot)
    bmesh.ops.translate(tmp, vec=Vector(start), verts=tmp.verts)
    add_part(bm, tmp, index)


def finish(name, bm, col):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in MATS:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


col = bpy.data.collections.new("trees")
scene.collection.children.link(col)
kit = []

# --- 0..2: spruces --------------------------------------------------------------------------
for name, (h, w, n) in zip(("tree_variant_0", "tree_variant_1", "tree_variant_2"),
                           ((0.3, 0.075, 5), (0.24, 0.066, 4), (0.15, 0.05, 3))):
    bm = bmesh.new()
    spruce(bm, h, w, n)
    kit.append(finish(name, bm, col))

# --- 3: birch: slim white trunk with dark marks, a light airy crown of small clumps -----------
bm = bmesh.new()
H3 = 0.25
lean = (0.008, -0.004)
trunk(bm, 0.008, 0.005, H3 * 0.8, BIRCH, lean=lean)
for k in range(5):  # dark bark marks
    z = 0.025 + k * 0.035 + random.uniform(-0.006, 0.006)
    a = random.uniform(0, 6.28)
    t = z / (H3 * 0.8)
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1)
    bmesh.ops.scale(tmp, vec=Vector((0.0055, 0.011, 0.003)), verts=tmp.verts)
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=Matrix.Rotation(a, 3, "Z"))
    bmesh.ops.translate(tmp, vec=Vector((lean[0] * t + math.cos(a) * 0.005, lean[1] * t + math.sin(a) * 0.005, z)), verts=tmp.verts)
    add_part(bm, tmp, BIRCH_MARK)
branch(bm, (lean[0] * 0.6, lean[1] * 0.6, H3 * 0.5), (0.03, 0.01, H3 * 0.68), 0.003, BIRCH)
branch(bm, (lean[0] * 0.7, lean[1] * 0.7, H3 * 0.58), (-0.025, -0.015, H3 * 0.74), 0.0028, BIRCH)
for (x, y, z, r) in ((0.008, 0, 0.2, 0.038), (0.03, 0.012, 0.17, 0.028), (-0.022, -0.012, 0.18, 0.03),
                     (0.004, 0.018, 0.155, 0.026), (0.0, -0.02, 0.15, 0.024), (0.012, 0.0, 0.232, 0.025)):
    blob(bm, r, (x, y, z), BIRCH_LEAF, BIRCH_LEAF_LIGHT, LEAF, squash=1.1, seed=random.random() * 9)
kit.append(finish("tree_variant_3", bm, col))

# --- 4: broadleaf: sturdy trunk forking into a round crown of clumps ------------------------
bm = bmesh.new()
trunk(bm, 0.014, 0.009, 0.1, BARK, sides=7)
branch(bm, (0, 0, 0.085), (0.035, 0.01, 0.135), 0.006, BARK)
branch(bm, (0, 0, 0.085), (-0.03, -0.015, 0.14), 0.006, BARK)
branch(bm, (0, 0, 0.09), (0.0, 0.03, 0.15), 0.005, BARK)
for (x, y, z, r) in ((0, 0, 0.175, 0.055), (0.045, 0.012, 0.15, 0.04), (-0.042, -0.015, 0.152, 0.042),
                     (0.006, 0.042, 0.148, 0.038), (-0.008, -0.04, 0.146, 0.036), (0.02, -0.01, 0.205, 0.035)):
    blob(bm, r, (x, y, z), LEAF, LEAF_LIGHT, LEAF_DARK, squash=0.85, seed=random.random() * 9)
kit.append(finish("tree_variant_4", bm, col))

# --- Export ----------------------------------------------------------------------------------
os.makedirs(os.path.dirname(os.path.abspath(OUT_GLB)), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for o in kit:
    o.select_set(True)
bpy.context.view_layer.objects.active = kit[0]
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
for o in kit:
    vs = o.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    print("VARIANT", o.name, "TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons),
          "SIZE", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3),
          "H", round(max(zs), 3), "ZMIN", round(min(zs), 3))
print("GLB", os.path.getsize(OUT_GLB))
os.makedirs(os.path.join(HERE, "source"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "forest-trees.blend"))

# --- Preview (not exported): a little grove with a settlement for scale ------------------------
ctx = bpy.data.collections.new("Context")
scene.collection.children.link(ctx)
spots = [(-0.3, 0.1, 0), (-0.15, 0.22, 1), (0.0, 0.05, 3), (0.15, 0.2, 0), (0.3, 0.02, 4),
         (-0.05, 0.3, 1), (0.25, 0.32, 2), (-0.25, -0.06, 2), (0.1, -0.06, 2)]
for i, (x, y, v) in enumerate(spots):
    src = kit[v]
    o = src if not any(s[2] == v for s in spots[:i]) else src.copy()
    if o is not src:
        ctx.objects.link(o)
    o.location = (x, y, 0)
    o.rotation_euler = (0, 0, random.uniform(0, 6.28))
for v in range(5):
    if not any(s[2] == v for s in spots):
        kit[v].location = (0.45 + v * 0.1, 0.4, 0)
if MODELS:
    st = os.path.join(MODELS, "settlement.glb")
    if os.path.exists(st):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=st)
        for o in bpy.data.objects:
            if o not in before and o.parent is None:
                o.location = (-0.42, -0.12, 0)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.12, 0))
ground = bpy.context.active_object
ground.scale = (1.3, 0.9, 1)
ground.data.materials.append(mat("GroundM", "#557a2f"))

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 50
scene.collection.objects.link(cam)
cam.location = (0.0, -0.85, 0.5)
look = Vector((0.0, 0.12, 0.08))
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.2
sun.data.color = srgb("#ffe2b8")
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#bfd3dc"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
scene.world = world
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 760
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT_PNG)
