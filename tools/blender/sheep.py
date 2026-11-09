# Sheep for the pasture hexes (openspec change pasture-meadow-3d): an original low-poly sheep with
# a lumpy wool body, a dark face and legs. One GLB (models/sheep.glb) holding root-level meshes
# named sheep_variant_0..3 with their origin at the base centre, facing +X:
#   0 standing, head up   1 grazing, head down   2 lying down   3 lamb (smaller, standing)
# Game units: 1 unit = hex circumradius, +Z up in Blender (exported Y-up), land top z=0.
#
# Usage: blender -b --factory-startup --python tools/blender/sheep.py -- <out.glb> <preview.png> [city.glb] [tree.glb]
# Also saves tools/blender/source/sheep.blend.
import bpy, bmesh, math, os, random, sys
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]
CITY_GLB = argv[2] if len(argv) > 2 else None
TREE_GLB = argv[3] if len(argv) > 3 else None
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def mat(name, hexrgb, rough=0.95):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hexrgb), 1)
    b.inputs["Roughness"].default_value = rough
    return m


M_WOOL = mat("Wool", "#eee8d8")
M_WOOL_SHADE = mat("WoolShade", "#d4cab3")
M_FACE = mat("SheepFace", "#3d332c", 0.8)
M_HOOF = mat("Hoof", "#26201b", 0.8)
MATS = [M_WOOL, M_WOOL_SHADE, M_FACE, M_HOOF]
WOOL, SHADE, FACE, HOOF = range(4)


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


def blob(radius, scale=(1, 1, 1), subdiv=1, rough=0.15, seed=0):
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=subdiv, radius=1)
    off = Vector((seed * 1.9, seed * 2.7, seed * 0.7))
    for v in tmp.verts:
        v.co *= 1 + rough * noise.noise(v.co * 2.2 + off)
    bmesh.ops.scale(tmp, vec=Vector(scale) * radius, verts=tmp.verts)
    return tmp


def moved(tmp, loc, rot=None):
    if rot is not None:
        bmesh.ops.rotate(tmp, cent=Vector(), verts=tmp.verts, matrix=rot)
    bmesh.ops.translate(tmp, vec=Vector(loc), verts=tmp.verts)
    return tmp


def sheep(name, col, size=1.0, pose="stand", seed=0):
    """pose: stand | graze | lie. Body along +X, head at +X."""
    s = size
    bm = bmesh.new()
    leg_h = 0.0 if pose == "lie" else 0.014 * s
    # Body: one round, egg-shaped wool mass with big flat facets (polygon style after the
    # owner's reference, a low-poly sheep on CGTrader; style only, nothing copied). Faces
    # pointing down get the shaded wool.
    bx, by, bz = 0.047 * s, 0.037 * s, 0.034 * s
    cz = leg_h + bz * (0.72 if pose == "lie" else 0.92)
    body = blob(1, (bx, by, bz), 2, 0.07, seed)
    for v in body.verts:  # a little fuller at the rump, narrower toward the chest
        v.co.y *= 1 - 0.1 * (v.co.x / bx)
        v.co.z *= 1 - 0.06 * (v.co.x / bx)
    moved(body, (0, 0, cz))
    body.normal_update()
    n0 = len(bm.faces)
    shade = [f.normal.z < -0.45 for f in body.faces]
    add_part(bm, body, WOOL)
    for f, under in zip(bm.faces[n0:], shade):
        if under:
            f.material_index = SHADE
    # Legs: 4 thin dark posts with a hoof; tucked away when lying.
    if pose != "lie":
        # Short, thin legs tucked in under the middle of the body.
        for lx in (-0.021, 0.021):
            for ly in (-0.0105, 0.0105):
                tmp = bmesh.new()
                bmesh.ops.create_cone(tmp, cap_ends=True, segments=5, radius1=0.0034 * s,
                                      radius2=0.0042 * s, depth=leg_h + bz * 0.5)
                add_part(bm, moved(tmp, (lx * s, ly * s, (leg_h + bz * 0.5) / 2)), FACE)
                tmp = bmesh.new()
                bmesh.ops.create_cone(tmp, cap_ends=True, segments=5, radius1=0.0043 * s,
                                      radius2=0.0037 * s, depth=0.005 * s)
                add_part(bm, moved(tmp, (lx * s, ly * s, 0.0025 * s)), HOOF)
    else:
        for ly in (-1, 1):  # folded front legs poking out
            tmp = bmesh.new()
            bmesh.ops.create_cone(tmp, cap_ends=True, segments=5, radius1=0.005 * s,
                                  radius2=0.005 * s, depth=0.016 * s)
            add_part(bm, moved(tmp, (bx * 0.62, ly * by * 0.45, 0.005 * s),
                               Matrix.Rotation(math.pi / 2, 3, "Y")), FACE)
    # Head: a large, blocky dark head set high on the front of the body and overlapping it,
    # with a flat face, a slightly narrower muzzle and floppy ears sticking out sideways.
    head = bmesh.new()
    face = blob(1, (0.025 * s, 0.016 * s, 0.019 * s), 1, 0.04, seed + 40)
    for v in face.verts:
        if v.co.x > 0.017 * s:  # flat front
            v.co.x = 0.017 * s + (v.co.x - 0.017 * s) * 0.35
        if v.co.x > 0:  # narrower and lower toward the muzzle
            v.co.y *= 1 - 0.3 * (v.co.x / (0.025 * s))
            v.co.z -= 0.003 * s * (v.co.x / (0.025 * s))
    moved(face, (0.01 * s, 0, 0), Matrix.Rotation(0.3, 3, "Y"))
    add_part(head, face, FACE)
    for side in (-1, 1):
        ear = bmesh.new()
        bmesh.ops.create_cone(ear, cap_ends=True, segments=4, radius1=0.0085 * s, radius2=0.002 * s,
                              depth=0.025 * s)
        bmesh.ops.scale(ear, vec=Vector((1, 1, 0.4)), verts=ear.verts)
        # Point sideways and droop a little, from the top back corner of the head.
        moved(ear, (0.0 * s, side * 0.024 * s, 0.008 * s),
              Matrix.Rotation(side * 0.35, 3, "X") @ Matrix.Rotation(side * -math.pi / 2, 3, "X"))
        add_part(head, ear, FACE)
    # Positive pitch lowers the muzzle (rotation about +Y turns +X toward -Z).
    pitch = {"stand": -0.2, "graze": 1.0, "lie": -0.15}[pose]
    yaw = {"stand": 0.0, "graze": 0.0, "lie": 0.35}[pose]
    neck = Vector((bx * 0.78, 0, cz + bz * (0.4 if pose != "graze" else 0.0)))
    bmesh.ops.rotate(head, cent=Vector(), verts=head.verts,
                     matrix=Matrix.Rotation(yaw, 3, "Z") @ Matrix.Rotation(pitch, 3, "Y"))
    bmesh.ops.translate(head, vec=neck, verts=head.verts)
    # Keep a grazing muzzle just above the grass by lifting the head, not the whole sheep.
    hmin = min(v.co.z for v in head.verts)
    if hmin < 0.003 * s:
        bmesh.ops.translate(head, vec=Vector((0, 0, 0.003 * s - hmin)), verts=head.verts)
    me = bpy.data.meshes.new("tmp")
    head.to_mesh(me)
    head.free()
    n0 = len(bm.faces)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
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


col = collection("sheep")
variants = [
    sheep("sheep_variant_0", col, 1.0, "stand", 1),
    sheep("sheep_variant_1", col, 1.0, "graze", 2),
    sheep("sheep_variant_2", col, 1.0, "lie", 3),
    sheep("sheep_variant_3", col, 0.72, "stand", 4),
]

# --- Export ----------------------------------------------------------------------------------
os.makedirs(os.path.dirname(os.path.abspath(OUT_GLB)), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for o in variants:
    o.select_set(True)
bpy.context.view_layer.objects.active = variants[0]
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
for o in variants:
    vs = o.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    print("VARIANT", o.name, "TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons),
          "SIZE", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3),
          "H", round(max(zs), 3), "ZMIN", round(min(zs), 3))
print("GLB", os.path.getsize(OUT_GLB))
os.makedirs(os.path.join(HERE, "source"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "sheep.blend"))

# --- Preview (not exported): the four variants, a tree and a city for scale, on grass ---------
ctx = collection("Context")


def import_into_ctx(path, at):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        ctx.objects.link(o)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in new if o.type == "MESH" for v in o.data.vertices]
    if not pts:
        return 0
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    for o in new:
        if o.parent is None:
            o.location += Vector((at[0] - cx, at[1] - cy, -min(p.z for p in pts)))
    return max(p.z for p in pts) - min(p.z for p in pts)


for i, o in enumerate(variants):
    o.location = (-0.24 + i * 0.13, 0.0, 0)
    o.rotation_euler = (0, 0, -0.5)
if CITY_GLB and os.path.exists(CITY_GLB):
    print("CITY_HEIGHT", round(import_into_ctx(CITY_GLB, (0.55, 0.3)), 3))
if TREE_GLB and os.path.exists(TREE_GLB):
    print("TREE_HEIGHT", round(import_into_ctx(TREE_GLB, (0.33, 0.22)), 3))
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.05, 0.05, 0))
ground = bpy.context.active_object
ground.scale = (1.6, 1.0, 1)
ground.data.materials.append(mat("GroundM", "#9cc25a"))
for c in ground.users_collection:
    c.objects.unlink(ground)
ctx.objects.link(ground)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 60
scene.collection.objects.link(cam)
CLOSE = os.environ.get("SHEEP_CLOSE") == "1"
cam.location = (-0.05, -0.5, 0.26) if CLOSE else (0.12, -1.25, 0.7)
look = Vector((-0.05, 0.0, 0.04)) if CLOSE else Vector((0.12, 0.08, 0.05))
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
scene.render.resolution_y = 700
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT_PNG)
