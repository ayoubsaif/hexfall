# Coast kit for the diorama theme (openspec change coast-kit-and-ambient-look): boulders, cliff
# rocks, a dry-stone wall, pine trees and bushes. One GLB per asset key, each holding root-level
# meshes named <key>_variant_0..n with their origin at the base centre. Game units: 1 unit = hex
# circumradius, +Z up in Blender (exported Y-up), land top z=0, sea surface z=-0.14.
#
# Usage: blender -b --factory-startup --python tools/blender/coast-kit.py -- <models dir> <preview.png> [city.glb]
# Writes <models dir>/{boulder,cliff,wall,tree,bush}.glb and saves tools/blender/source/coast-kit.blend.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_DIR, OUT_PNG = argv[0], argv[1]
CITY_GLB = argv[2] if len(argv) > 2 else None
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


# Material names are part of the contract: the client swaps "Rock" and "Moss" for its textured
# rock material when the CC0 maps are present.
M_ROCK = mat("Rock", "#b8ae9c")
M_ROCK_DARK = mat("RockDark", "#978e81")
M_MOSS = mat("Moss", "#86a650")
M_BARK = mat("Bark", "#5a3f2b")
M_PINE = mat("Pine", "#2f5a32")
M_PINE_LIGHT = mat("PineLight", "#3f7040")
M_LEAF = mat("Leaf", "#6f9e45")
M_LEAF_LIGHT = mat("LeafLight", "#93bb57")
M_GRASS = mat("Grass", "#9bbd55")

kit = {}  # key -> list of variant objects


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def finish(name, bm, materials, col):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def rock_bm(bm, radius, squash, seed, center=(0, 0, 0), detail=2, rough=0.32, moss_up=0.62,
            rock_index=0, moss_index=1, sink=0.25):
    """Adds a lumpy faceted rock to bm. Faces pointing up get the moss material index."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=detail, radius=1)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in tmp.verts:
        n = noise.noise(v.co * 1.5 + off)
        v.co *= 1 + rough * n
        v.co.z *= squash
        if v.co.z < -sink:  # flat-ish underside so it sits on the ground
            v.co.z = -sink + (v.co.z + sink) * 0.25
    bmesh.ops.scale(tmp, vec=Vector((radius, radius * random.uniform(0.75, 1.0), radius)),
                    verts=tmp.verts)
    # Lift so the base rests at z=0, then move into place.
    zmin = min(v.co.z for v in tmp.verts)
    bmesh.ops.translate(tmp, vec=Vector(center) + Vector((0, 0, -zmin * 0.85)), verts=tmp.verts)
    tmp.normal_update()
    for f in tmp.faces:
        f.material_index = moss_index if f.normal.z > moss_up else rock_index
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


# --- Boulders: 5 rounded, mossy rocks of different proportions --------------------------------
KEY = "boulder"
col = collection(KEY)
specs = [(0.11, 0.62), (0.08, 0.8), (0.14, 0.5), (0.06, 0.9), (0.1, 0.7)]
kit["boulder"] = []
for i, (r, sq) in enumerate(specs):
    bm = bmesh.new()
    rock_bm(bm, r, sq, seed=i + 1, detail=3, rough=0.22, moss_up=0.72)
    kit["boulder"].append(finish(f"{KEY}_variant_{i}", bm, [M_ROCK, M_MOSS], col))

# --- Cliff rocks: 3 tall stacks of 2-4 blocky rocks ---------------------------------------------
KEY = "cliff"
col = collection(KEY)
kit["cliff"] = []
for i in range(3):
    bm = bmesh.new()
    parts = 2 + i
    for k in range(parts):
        ang = k * 2.1 + i
        rr = 0.075 + 0.02 * ((k + i) % 3)
        cx, cy = math.cos(ang) * 0.05 * (k > 0), math.sin(ang) * 0.05 * (k > 0)
        rock_bm(bm, rr * 0.92, 1.15 - 0.15 * k, seed=20 + i * 5 + k, center=(cx, cy, 0),
                detail=2, rough=0.2, moss_up=0.86)
    kit["cliff"].append(finish(f"{KEY}_variant_{i}", bm, [M_ROCK_DARK, M_MOSS], col))

# --- Dry-stone wall: a straight 0.3 segment along +X, and an end cap (small stone pile) --------
KEY = "wall"
col = collection(KEY)
kit["wall"] = []


def stone(bm, size, loc, yaw, mat_index=0):
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1)
    bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
    bmesh.ops.bevel(tmp, geom=tmp.edges[:], offset=min(size) * 0.28, segments=1, affect="EDGES")
    for v in tmp.verts:
        v.co += Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * 0.002
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts,
                     matrix=Matrix.Rotation(yaw, 3, "Z"))
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    for f in tmp.faces:
        f.material_index = mat_index
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


LEN, H, W = 0.3, 0.065, 0.05
bm = bmesh.new()
courses = 3
for c in range(courses):
    z0 = c * (H / courses)
    x = -LEN / 2 + (0.02 if c % 2 else 0)
    while x < LEN / 2 - 0.01:
        ln = min(random.uniform(0.035, 0.055), LEN / 2 - x)
        h = H / courses * random.uniform(0.9, 1.15)
        stone(bm, (ln * 0.92, W * random.uniform(0.85, 1.0) * (1 - 0.12 * c), h),
              (x + ln / 2, random.uniform(-0.004, 0.004), z0 + h / 2), random.uniform(-0.12, 0.12),
              mat_index=1 if (c == courses - 1 and random.random() < 0.15) else 0)
        x += ln
kit["wall"].append(finish(f"{KEY}_variant_0", bm, [M_ROCK, M_MOSS], col))
bm = bmesh.new()
for k in range(5):
    s = random.uniform(0.03, 0.045)
    stone(bm, (s, s * 0.9, s * 0.8),
          (random.uniform(-0.025, 0.025), random.uniform(-0.02, 0.02), s * 0.4 + (k > 2) * 0.03),
          random.uniform(0, 3), mat_index=1 if k == 4 else 0)
kit["wall"].append(finish(f"{KEY}_variant_1", bm, [M_ROCK, M_MOSS], col))

# --- Evergreens: a short trunk under a dense crown of small leafy clumps, styled after a Thuja /
# young pine (owner's reference, style only). The crown profile is an ovate cone; clumps spiral up
# it, with darker clumps inside and lighter, smaller ones at the tips. Kept below the city height.
KEY = "tree"
col = collection(KEY)
kit["tree"] = []


def add_part(bm, tmp, index):
    me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free()
    n0 = len(bm.faces)
    bm.from_mesh(me); bpy.data.meshes.remove(me)
    bm.faces.ensure_lookup_table()
    for f in bm.faces[n0:]:
        f.material_index = index


# (height, max crown radius, profile power: <1 = fuller top like a thuja, >1 = pointed pine)
for i, (height, crown_r, power) in enumerate([(0.26, 0.062, 0.75), (0.21, 0.07, 1.25)]):
    bm = bmesh.new()
    trunk_h = height * 0.16
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=6, radius1=0.014, radius2=0.009, depth=trunk_h * 1.6)
    bmesh.ops.translate(tmp, vec=Vector((0, 0, trunk_h * 0.8)), verts=tmp.verts)
    add_part(bm, tmp, 0)
    base, top = trunk_h * 0.7, height
    clumps = 34
    for k in range(clumps):
        t = (k + 0.5) / clumps                      # 0 at the crown base, 1 at the tip
        z = base + (top - base) * t
        # Ovate profile: widest about a quarter of the way up, narrowing to the tip.
        prof = math.sin(math.pi * min(1.0, 0.25 + t * 0.85)) ** power if t < 0.97 else 0.08
        ring = crown_r * prof
        ang = k * 2.39996 + i
        dist = ring * random.uniform(0.45, 0.8)
        cr = max(0.012, ring * random.uniform(0.55, 0.75) + 0.008) * (1 - 0.35 * t)
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=cr)
        for v in tmp.verts:  # jagged, slightly drooping clumps
            v.co *= 1 + 0.28 * noise.noise(v.co * 90 + Vector((k, i, 7)))
            v.co.z *= 0.8
            if v.co.z < 0:
                v.co.z *= 1.25
        bmesh.ops.translate(tmp, vec=Vector((math.cos(ang) * dist, math.sin(ang) * dist, z)),
                            verts=tmp.verts)
        add_part(bm, tmp, 2 if (t > 0.55 or dist > ring * 0.65) else 1)
    # A small leader clump closes the tip.
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=5, radius1=0.012, radius2=0.0, depth=0.04)
    bmesh.ops.translate(tmp, vec=Vector((0, 0, top - 0.01)), verts=tmp.verts)
    add_part(bm, tmp, 2)
    kit["tree"].append(finish(f"{KEY}_variant_{i}", bm, [M_BARK, M_PINE, M_PINE_LIGHT], col))

# --- Bushes: 2 leafy clumps and 1 grass tuft --------------------------------------------------
KEY = "bush"
col = collection(KEY)
kit["bush"] = []
for i in range(2):
    bm = bmesh.new()
    blobs = 4 + i * 2
    for k in range(blobs):
        ang = k * 2.4
        rr = random.uniform(0.028, 0.045) * (1.0 if i == 0 else 0.85)
        dist = 0.0 if k == 0 else random.uniform(0.025, 0.045)
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=rr)
        for v in tmp.verts:
            v.co *= 1 + 0.18 * noise.noise(v.co * 40 + Vector((k, i, 3)))
        bmesh.ops.translate(tmp, vec=Vector((math.cos(ang) * dist, math.sin(ang) * dist,
                                              rr * 0.75 + (0.015 if k == 0 else 0))), verts=tmp.verts)
        me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free()
        n0 = len(bm.faces)
        bm.from_mesh(me); bpy.data.meshes.remove(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[n0:]:
            f.material_index = k % 2
    kit["bush"].append(finish(f"{KEY}_variant_{i}", bm, [M_LEAF, M_LEAF_LIGHT], col))
bm = bmesh.new()
for k in range(11):
    ang = k * 2.39996
    dist = 0.012 * math.sqrt(k)
    h = random.uniform(0.03, 0.055)
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=False, segments=3, radius1=0.006, radius2=0.0, depth=h)
    bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts,
                     matrix=Matrix.Rotation(
                         random.uniform(-0.35, 0.35), 3, Vector((math.sin(ang), -math.cos(ang), 0))))
    bmesh.ops.translate(tmp, vec=Vector((math.cos(ang) * dist, math.sin(ang) * dist, h / 2)),
                        verts=tmp.verts)
    me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
kit["bush"].append(finish(f"{KEY}_variant_2", bm, [M_GRASS], col))

# --- Export: one Draco GLB per key with only that key's variants ------------------------------
os.makedirs(OUT_DIR, exist_ok=True)
for key, objs in kit.items():
    # tree.glb now comes from tools/blender/thuja-reduce.py (the owner-chosen BlendKit Thuja);
    # this script's original evergreens stay in the preview and the saved .blend only.
    if key == "tree":
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT_DIR, f"{key}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
    )
    for o in objs:
        zs = [v.co.z for v in o.data.vertices]
        xs = [v.co.x for v in o.data.vertices]
        ys = [v.co.y for v in o.data.vertices]
        print("VARIANT", key, o.name, "TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons),
              "SIZE", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), "H", round(max(zs), 3),
              "ZMIN", round(min(zs), 3))
    print("GLB", key, os.path.getsize(path))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "coast-kit.blend"))

# --- Preview (not exported): every variant laid out in rows, next to a city for scale -----------
ctx = collection("Context")
row_y = {"boulder": 0.45, "cliff": 0.15, "wall": -0.15, "tree": -0.45, "bush": -0.7}
for key, objs in kit.items():
    for i, o in enumerate(objs):
        o.location = (-0.6 + i * 0.32, row_y[key], 0)
if CITY_GLB and os.path.exists(CITY_GLB):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CITY_GLB)
    city = [o for o in bpy.data.objects if o not in before]
    zmax = 0
    for o in city:
        for c in o.users_collection:
            c.objects.unlink(o)
        ctx.objects.link(o)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in city if o.type == "MESH" for v in o.data.vertices]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    for o in city:
        if o.parent is None:
            o.location += Vector((1.0 - cx, -0.45 - cy, -min(p.z for p in pts)))
    bpy.context.view_layer.update()
    for o in city:
        if o.type == "MESH":
            zmax = max(zmax, max((o.matrix_world @ v.co).z for v in o.data.vertices))
    print("CITY_HEIGHT", round(zmax, 3))
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.3, -0.1, 0))
ground = bpy.context.active_object
ground.scale = (3.4, 2.4, 1)
ground.data.materials.append(mat("GroundM", "#9fb565"))
for c in ground.users_collection:
    c.objects.unlink(ground)
ctx.objects.link(ground)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 50
scene.collection.objects.link(cam)
cam.location = (0.25, -2.9, 2.0)
look = Vector((0.25, -0.12, 0.0))
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.2
sun.data.color = srgb("#ffe2b8")
sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
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
