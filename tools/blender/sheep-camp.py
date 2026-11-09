# Sheep camp kit for the pasture hexes (openspec change pasture-meadow-3d), after the owner's
# "sheep camp biome" sheet (style only, nothing traced): a thatched shepherd's hut, a wooden rail
# fence segment, a feed trough and a hay pile. One GLB (models/camp.glb) holding root-level
# meshes named camp_variant_0..3 with their origin at the base centre:
#   0 hut (door faces +X)   1 fence segment (0.16 long along X)   2 feed trough (along X)   3 hay
# The hut stays well under half a settlement's height (0.222) and uses no player colours, so it
# reads as scenery, never as a piece. Game units: 1 unit = hex circumradius, +Z up (exported Y-up).
#
# Usage: blender -b --factory-startup --python tools/blender/sheep-camp.py -- <out.glb> <preview.png> [models dir]
# Also saves tools/blender/source/sheep-camp.blend.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]
MODELS = argv[2] if len(argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(5)

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
    mat("Plaster", "#e2d5b8"),
    mat("Timber", "#5b3f2a"),
    mat("Stone", "#8f877c"),
    mat("Thatch", "#cfa752"),
    mat("ThatchDark", "#a9853f"),
    mat("Wood", "#8a6643"),
    mat("WoodDark", "#654730"),
    mat("Hay", "#dcb95e"),
    mat("Opening", "#33261b"),
]
PLASTER, TIMBER, STONE, THATCH, THATCH_DARK, WOOD, WOOD_DARK, HAY, OPENING = range(len(MATS))


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


col = collection("camp")
kit = []

# --- 0: shepherd's hut -------------------------------------------------------------------------
# Long side along Y with the door on the +X side; gables at +-Y; thatched roof in stepped layers.
bm = bmesh.new()
DX, DY, WH = 0.058, 0.082, 0.032          # wall depth (X), width (Y), height
BASE = 0.007                              # stone footing
box(bm, (DX + 0.006, DY + 0.006, BASE), (0, 0, BASE / 2), STONE, jitter=0.0006)
box(bm, (DX, DY, WH - BASE), (0, 0, BASE + (WH - BASE) / 2), PLASTER)
# Timber frame: corner posts, sill and wall plate on the front and back, a brace either side
# of the door.
T = 0.0045
for sx in (-1, 1):
    for sy in (-1, 1):
        box(bm, (T, T, WH - BASE), (sx * DX / 2, sy * DY / 2, BASE + (WH - BASE) / 2), TIMBER)
    box(bm, (T, DY + T, T), (sx * DX / 2, 0, WH - T / 2), TIMBER)
    box(bm, (T, DY + T, T * 0.9), (sx * DX / 2, 0, BASE + T / 2), TIMBER)
for sy in (-1, 1):
    brace = Matrix.Rotation(sy * 0.75, 3, "X")
    box(bm, (T * 0.8, T * 0.8, 0.03), (DX / 2 + 0.0004, sy * DY * 0.33, BASE + 0.012), TIMBER, brace)
# Door (dark planks in a timber frame) and a small window, both on the front (+X).
box(bm, (0.003, 0.016, 0.022), (DX / 2 + 0.0012, -0.008, BASE + 0.011), WOOD_DARK)
box(bm, (0.0035, 0.02, 0.0035), (DX / 2 + 0.0014, -0.008, BASE + 0.0235), TIMBER)
box(bm, (0.003, 0.012, 0.009), (DX / 2 + 0.0012, 0.022, BASE + 0.015), OPENING)
box(bm, (0.0035, 0.015, 0.0025), (DX / 2 + 0.0014, 0.022, BASE + 0.0095), TIMBER)
# Gable walls (plaster) with a king post.
RH = 0.042                                 # roof rise above the walls
for sy in (-1, 1):
    tmp = bmesh.new()
    w, d = DX / 2, 0.002
    vs = [tmp.verts.new(p) for p in [(-w, -d, 0), (w, -d, 0), (0, -d, RH * 0.92),
                                      (-w, d, 0), (w, d, 0), (0, d, RH * 0.92)]]
    for f in [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]:
        tmp.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
    bmesh.ops.translate(tmp, vec=Vector((0, sy * (DY / 2 - 0.002), WH)), verts=tmp.verts)
    add_part(bm, tmp, PLASTER)
    box(bm, (T * 0.8, T * 0.8, RH * 0.8), (0, sy * (DY / 2 + 0.0005), WH + RH * 0.4), TIMBER)
# Thatch: on each side three overlapping slabs, each lower one sticking out a little further,
# alternating light and dark straw, with a ragged lower edge; ridge along Y.
OVER = 0.012                               # eave overhang past the walls
run = DX / 2 + OVER
slope = math.atan2(RH, DX / 2)
length = math.hypot(run, RH * run / (DX / 2))
for sx in (-1, 1):
    for k in range(3):
        t0 = k / 3.0
        seg = length / 3 + 0.006
        mid = length * (1 - t0 - 1 / 6)    # distance from the ridge along the slope
        cx = sx * math.cos(slope) * mid
        cz = WH + RH - math.sin(slope) * mid + 0.004 + 0.0015 * k
        rot = Matrix.Rotation(sx * slope, 3, "Y")  # +Y rotation tips +X down
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1)
        bmesh.ops.scale(tmp, vec=Vector((seg, DY + 2 * OVER - 0.004 * k, 0.0075)), verts=tmp.verts)
        for v in tmp.verts:  # ragged straw edge
            v.co.z += noise.noise(v.co * 400 + Vector((k, sx, 3))) * 0.0012
        bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=rot)
        bmesh.ops.translate(tmp, vec=Vector((cx, 0, cz)), verts=tmp.verts)
        add_part(bm, tmp, THATCH if k % 2 == 0 else THATCH_DARK)
# Ridge roll and crossed ridge sticks at both gable ends.
box(bm, (0.012, DY + 2 * OVER + 0.002, 0.008), (0, 0, WH + RH + 0.006), THATCH_DARK,
    Matrix.Rotation(math.pi / 4, 3, "Y"))
for sy in (-1, 1):
    for sx in (-1, 1):
        box(bm, (0.026, 0.003, 0.003), (sx * 0.006, sy * (DY / 2 + OVER - 0.001), WH + RH + 0.011),
            TIMBER, Matrix.Rotation(sx * 0.85, 3, "Y"))
kit.append(finish("camp_variant_0", bm, col))

# --- 1: rail fence segment (posts at both ends and the middle, two split rails) ---------------
bm = bmesh.new()
L = 0.16
for i, x in enumerate((-L / 2, 0.0, L / 2)):
    h = 0.04 + random.uniform(-0.003, 0.003)
    box(bm, (0.0075, 0.0075, h), (x, 0, h / 2), WOOD_DARK,
        Matrix.Rotation(random.uniform(-0.06, 0.06), 3, "X"), jitter=0.0004)
for z in (0.014, 0.029):
    box(bm, (L + 0.008, 0.0045, 0.006), (0, 0.004, z), WOOD,
        Matrix.Rotation(random.uniform(-0.03, 0.03), 3, "Y"), jitter=0.0005)
kit.append(finish("camp_variant_1", bm, col))

# --- 2: feed trough on two trestle legs, filled with hay ---------------------------------------
bm = bmesh.new()
TL, TW, TH = 0.06, 0.022, 0.012
TZ = 0.012
box(bm, (TL, TW, 0.003), (0, 0, TZ), WOOD)                         # bottom
for sy in (-1, 1):
    box(bm, (TL, 0.003, TH), (0, sy * TW / 2, TZ + TH / 2), WOOD,
        Matrix.Rotation(sy * 0.25, 3, "X"))
for sx in (-1, 1):
    box(bm, (0.003, TW + 0.004, TH), (sx * TL / 2, 0, TZ + TH / 2), WOOD_DARK)
    for sy in (-1, 1):  # trestle legs
        box(bm, (0.004, 0.004, TZ + 0.004), (sx * (TL / 2 - 0.006), sy * 0.009, TZ / 2), WOOD_DARK,
            Matrix.Rotation(sy * 0.35, 3, "X"))
tmp = bmesh.new()
bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=1)
bmesh.ops.scale(tmp, vec=Vector((TL * 0.46, TW * 0.42, 0.006)), verts=tmp.verts)
bmesh.ops.translate(tmp, vec=Vector((0, 0, TZ + TH * 0.75)), verts=tmp.verts)
add_part(bm, tmp, HAY)
kit.append(finish("camp_variant_2", bm, col))

# --- 3: hay pile ---------------------------------------------------------------------------------
bm = bmesh.new()
tmp = bmesh.new()
bmesh.ops.create_icosphere(tmp, subdivisions=2, radius=1)
for v in tmp.verts:
    v.co *= 1 + 0.12 * noise.noise(v.co * 3 + Vector((1, 2, 3)))
    if v.co.z < -0.2:
        v.co.z = -0.2
bmesh.ops.scale(tmp, vec=Vector((0.028, 0.024, 0.022)), verts=tmp.verts)
bmesh.ops.translate(tmp, vec=Vector((0, 0, 0.0044)), verts=tmp.verts)
tmp.normal_update()
add_part(bm, tmp, HAY)
bm.faces.ensure_lookup_table()
for f in bm.faces:
    if f.normal.z < 0.2:
        f.material_index = THATCH_DARK
kit.append(finish("camp_variant_3", bm, col))

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
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "sheep-camp.blend"))

# --- Preview (not exported): a little camp scene with sheep and a settlement for scale ----------
ctx = collection("Context")


def import_into_ctx(path, at, yaw=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        ctx.objects.link(o)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in new if o.type == "MESH" for v in o.data.vertices]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    for o in new:
        if o.parent is None:
            o.location += Vector((at[0] - cx, at[1] - cy, -min(p.z for p in pts)))
            o.rotation_euler.z += yaw
    return new


kit[0].location = (-0.2, 0.14, 0)
kit[0].rotation_euler = (0, 0, -0.6)
kit[2].location = (-0.06, -0.06, 0)
kit[2].rotation_euler = (0, 0, 0.3)
kit[3].location = (-0.13, 0.27, 0)
for i in range(3):  # a fence run along the back of the pen
    f = kit[1] if i == 0 else kit[1].copy()
    if i:
        ctx.objects.link(f)
    f.location = (0.02 + i * 0.155, 0.3 - i * 0.03, 0)
    f.rotation_euler = (0, 0, -0.2)
if MODELS:
    sheep = os.path.join(MODELS, "sheep.glb")
    if os.path.exists(sheep):
        objs = import_into_ctx(sheep, (0.05, 0.02))
        spots = [(0.05, 0.1), (0.2, 0.16), (0.14, -0.02), (0.3, 0.04)]
        roots = [o for o in objs if o.parent is None]
        for o, p in zip(roots, spots):
            o.location = (p[0], p[1], 0)
            o.rotation_euler.z = random.uniform(0, 6.28)
    st = os.path.join(MODELS, "settlement.glb")
    if os.path.exists(st):
        import_into_ctx(st, (-0.5, 0.45))
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.1, 0))
ground = bpy.context.active_object
ground.scale = (1.4, 1.0, 1)
ground.data.materials.append(mat("GroundM", "#8fb84a"))
for c in ground.users_collection:
    c.objects.unlink(ground)
ctx.objects.link(ground)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 55
scene.collection.objects.link(cam)
cam.location = (0.0, -0.75, 0.5)
look = Vector((0.0, 0.12, 0.02))
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
