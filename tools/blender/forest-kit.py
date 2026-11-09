# Forest kit for the forest hexes (openspec change forest-woods-and-trees), after the owner's
# low-poly forest reference sheet (style only, nothing traced): a small fallen log, a stump, a
# fern, a woodpile of cut logs, and a mushroom cluster. One GLB
# (models/woods.glb) holding root-level meshes named woods_variant_0..4, origin at the base centre:
#   0 fallen log (along X)   1 stump   2 fern   3 woodpile (logs along X)
#   4 mushrooms
# Everything stays low (well under a settlement's 0.222) and uses no player colours, so it reads
# as scenery. Game units: 1 unit = hex circumradius, +Z up (exported Y-up).
#
# Usage: blender -b --factory-startup --python tools/blender/forest-kit.py -- <out.glb> <preview.png> [models dir]
# Also saves tools/blender/source/forest-kit.blend.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]
MODELS = argv[2] if len(argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def mat(name, hexrgb, rough=0.92):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hexrgb), 1)
    b.inputs["Roughness"].default_value = rough
    return m


MATS = [
    mat("Bark", "#5a3d27"),
    mat("BarkDark", "#3f2b1c"),
    mat("Heartwood", "#c19a66"),
    mat("Moss", "#5e7f2e"),
    mat("Plank", "#9a7448"),
    mat("PlankDark", "#6e5133"),
    mat("Cap", "#b8432f"),
    mat("Stem", "#eadfc6"),
    mat("Spot", "#f4efe2"),
    mat("Fern", "#4c7a2c"),
]
BARK, BARK_DARK, HEART, MOSS, PLANK, PLANK_DARK, CAP, STEM, SPOT, FERN = range(len(MATS))


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


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
    return bm.faces[n0:]


def box(bm, size, loc, index, rot=None, jitter=0.0):
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1)
    bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
    if jitter:
        for v in tmp.verts:
            v.co += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * jitter
    if rot is not None:
        bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=rot)
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    add_part(bm, tmp, index)


def log(bm, length, radius, loc, rot, seed, sides=9, broken=(True, True), moss=True):
    """A faceted trunk along local X: bark sides, light heartwood caps, jagged broken ends and
    a mossy top. Returns nothing; adds faces to bm."""
    tmp = bmesh.new()
    rings = 4
    verts = []
    for r in range(rings + 1):
        x = -length / 2 + length * r / rings
        taper = 1.0 - 0.18 * r / rings
        ring = []
        for s in range(sides):
            a = 2 * math.pi * s / sides + seed
            k = taper * (1 + 0.07 * noise.noise(Vector((x * 40, s, seed))))
            ring.append(tmp.verts.new((x, math.cos(a) * radius * k, math.sin(a) * radius * k)))
        verts.append(ring)
    side_faces = []
    for r in range(rings):
        for s in range(sides):
            a, b = verts[r][s], verts[r][(s + 1) % sides]
            c, d = verts[r + 1][(s + 1) % sides], verts[r + 1][s]
            side_faces.append(tmp.faces.new((a, b, c, d)))
    caps = []
    for end, ring in ((0, verts[0]), (1, verts[-1])):
        ring = ring if end == 1 else list(reversed(ring))
        f = tmp.faces.new(ring)
        caps.append((end, f))
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    # Jagged ends: poke the cap and push its centre in or out, offsetting the rim verts along X.
    jag = []
    for end, f in caps:
        if not broken[end]:
            continue
        sign = 1 if end == 1 else -1
        for v in f.verts:
            v.co.x += sign * random.uniform(-0.25, 0.35) * radius
        res = bmesh.ops.poke(tmp, faces=[f])
        for v in res["verts"]:
            v.co.x += sign * radius * 0.55
        jag.extend(res["faces"])
    tmp.normal_update()
    me = bpy.data.meshes.new("tmp")
    for f in tmp.faces:
        f.material_index = BARK
        if f in jag or (abs(f.normal.x) > 0.6):
            f.material_index = HEART
        elif moss and f.normal.z > 0.75 and noise.noise(f.calc_center_median() * 90 + Vector((seed, 0, 0))) > 0.05:
            f.material_index = MOSS
        elif f.normal.z < -0.4:
            f.material_index = BARK_DARK
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=rot)
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def stub(bm, at, direction, length, radius):
    """A short broken-off branch sticking out of a trunk."""
    d = Vector(direction).normalized()
    rot = Vector((1, 0, 0)).rotation_difference(d).to_matrix()
    log(bm, length, radius, Vector(at) + d * length / 2, rot, random.random() * 6, sides=5,
        broken=(False, True), moss=False)


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


col = collection("woods")
kit = []

# --- 0: fallen log ----------------------------------------------------------------------------
bm = bmesh.new()
R0 = 0.01
log(bm, 0.11, R0, (0, 0, R0 * 0.85), Matrix.Rotation(0.03, 3, "Y"), 0.4)
stub(bm, (0.015, 0.0, R0 * 1.5), (0.3, 0.5, 0.8), 0.02, 0.003)
stub(bm, (-0.025, 0.0, R0 * 1.4), (-0.2, -0.7, 0.6), 0.018, 0.0027)

# Root plate at the -X end: a flat, splayed disc of roots standing on edge.
for k in range(6):
    a = k * math.pi / 3 + 0.3
    d = Vector((-0.25, math.cos(a), math.sin(a) * 0.9 + 0.25))
    stub(bm, (-0.054, 0, R0 * 0.9), d, 0.017, 0.003)
kit.append(finish("woods_variant_0", bm, col))

# --- 1: stump ---------------------------------------------------------------------------------
bm = bmesh.new()
H1, R1 = 0.022, 0.017
log(bm, H1, R1, (0, 0, H1 / 2), Matrix.Rotation(-math.pi / 2, 3, "Y"), 1.1, sides=8,
    broken=(False, True), moss=False)
for k in range(5):  # roots
    a = k * 2 * math.pi / 5 + 0.4
    stub(bm, (math.cos(a) * R1 * 0.7, math.sin(a) * R1 * 0.7, 0.004),
         (math.cos(a), math.sin(a), -0.35), 0.016, 0.0045)
kit.append(finish("woods_variant_1", bm, col))

# --- 2: fern: arching fronds fanning out from the middle, each a thin faceted blade -------------
bm = bmesh.new()
N_FROND = 7
for k in range(N_FROND):
    a = k * 2 * math.pi / N_FROND + random.uniform(-0.2, 0.2)
    L = random.uniform(0.04, 0.052)
    tmp = bmesh.new()
    pts = []
    for i in range(5):
        t = i / 4
        r = L * t
        z = 0.004 + L * (1.6 * t - 1.4 * t * t)   # rise then droop
        w = 0.008 * math.sin(math.pi * min(1.0, t * 1.15 + 0.05))
        pts.append((r, z, w))
    left = [tmp.verts.new((r, w, z)) for r, z, w in pts]
    right = [tmp.verts.new((r, -w, z + 0.0008)) for r, z, w in pts]
    mid = [tmp.verts.new((r, 0, z + 0.002)) for r, z, w in pts]
    for i in range(4):
        tmp.faces.new((mid[i], mid[i + 1], left[i + 1], left[i]))
        tmp.faces.new((mid[i], right[i], right[i + 1], mid[i + 1]))
    bmesh.ops.remove_doubles(tmp, verts=tmp.verts, dist=1e-6)
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=Matrix.Rotation(a, 3, "Z"))
    add_part(bm, tmp, MOSS if k % 2 else FERN)
kit.append(finish("woods_variant_2", bm, col))

# --- 3: woodpile: cut logs stacked 3-2-1 with clean sawn ends, ready to carry away -------------
bm = bmesh.new()
RL, LL = 0.0085, 0.065
for row, n in enumerate((3, 2, 1)):
    for i in range(n):
        y = (i - (n - 1) / 2) * RL * 2.05
        z = RL + row * RL * 1.75
        log(bm, LL + random.uniform(-0.006, 0.006), RL * random.uniform(0.92, 1.05),
            (random.uniform(-0.003, 0.003), y, z), Matrix.Rotation(random.uniform(-0.05, 0.05), 3, "Z"),
            random.random() * 6, sides=8, broken=(False, False), moss=False)
# Two stakes holding the bottom row in place.
for sy in (-1, 1):
    box(bm, (0.004, 0.004, 0.034), (0.012 * sy, sy * RL * 3.4, 0.017), PLANK_DARK,
        Matrix.Rotation(sy * 0.12, 3, "X"))
kit.append(finish("woods_variant_3", bm, col))

# --- 4: mushroom cluster ------------------------------------------------------------------------
bm = bmesh.new()
for (mx, my, s) in ((0, 0, 1.0), (0.012, 0.008, 0.7), (-0.009, 0.01, 0.55), (0.004, -0.012, 0.6)):
    h = 0.014 * s
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=6, radius1=0.0022 * s, radius2=0.0018 * s, depth=h)
    bmesh.ops.translate(tmp, vec=Vector((mx, my, h / 2)), verts=tmp.verts)
    add_part(bm, tmp, STEM)
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=7, v_segments=4, radius=0.0065 * s)
    for v in tmp.verts:
        v.co.z = max(v.co.z, -0.0005) * 0.75
    bmesh.ops.translate(tmp, vec=Vector((mx, my, h)), verts=tmp.verts)
    faces = add_part(bm, tmp, CAP)
    for f in faces:
        if f.normal.z > 0.9 and random.random() < 0.5:
            f.material_index = SPOT
kit.append(finish("woods_variant_4", bm, col))

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
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "forest-kit.blend"))

# --- Preview (not exported): the kit with trees and rocks around it -----------------------------
ctx = collection("Context")


def import_into_ctx(path, at, yaw=0.0, scale=1.0, pick=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        ctx.objects.link(o)
    if pick is not None:
        keep = [o for o in new if o.parent is None and o.name.endswith(pick)]
        for o in new:
            if o.parent is None and o not in keep:
                bpy.data.objects.remove(o)
        new = keep
    bpy.context.view_layer.update()
    for o in new:
        if o.parent is None:
            o.location = (at[0], at[1], 0)
            o.rotation_euler.z += yaw
            o.scale = (scale, scale, scale)
    return new


kit[0].location = (0.17, -0.08, 0)
kit[0].rotation_euler = (0, 0, 0.5)
kit[1].location = (-0.16, -0.12, 0)
kit[2].location = (0, 0.05, 0)
kit[3].location = (0.2, 0.2, 0)
kit[3].rotation_euler = (0, 0, -0.4)
kit[4].location = (-0.1, -0.06, 0)
if MODELS:
    tree = os.path.join(MODELS, "tree.glb")
    if os.path.exists(tree):
        for at in ((-0.22, 0.2), (-0.3, -0.02), (0.32, -0.02)):
            import_into_ctx(tree, at, random.uniform(0, 6), 0.95, pick="variant_0")
    boulder = os.path.join(MODELS, "boulder.glb")
    if os.path.exists(boulder):
        for at, s in (((-0.05, 0.12), 0.35), ((0.06, -0.03), 0.3), ((0.09, 0.14), 0.4)):
            import_into_ctx(boulder, at, random.uniform(0, 6), s, pick="variant_0")
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.05, -0.001))
ground = bpy.context.active_object
ground.scale = (1.0, 0.8, 1)
ground.data.materials.append(mat("GroundM", "#557a2f"))
for o in (ground,):
    for c in o.users_collection:
        c.objects.unlink(o)
    ctx.objects.link(o)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 55
scene.collection.objects.link(cam)
cam.location = (0.0, -0.75, 0.5)
look = Vector((0.0, 0.06, 0.02))
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
