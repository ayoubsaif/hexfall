# Mountain kit for the mountain hexes (openspec change owner-mountain-centre-peak):
#  peak.glb: the owner-supplied CC0 low-poly twin-peak mountain ("Mountain Lowpoly.fbx", kept in
#  the git-ignored assets/mountain/, never shipped), fitted to one whole hexagon:
#   - centred, rotated so its highest summit stands on the back half (away from the camera),
#     scaled over the hex and stretched to `peakHeight`;
#   - a height mask fades it to the ground along the rim (corners, edges), carves one clearing for
#     the number chip and the robber, and caps the camera side so nothing in front of the chip,
#     the robber or a corner piece rises into the 55-degree line of sight;
#   - it follows the domed mountain tile (same dome as the client), sinking 5 mm below the ground
#     wherever the mask is zero, so the chip and robber stand on the normal ground;
#   - cropped to the hex, skirted, decimated to about 2k triangles, flat shaded, coloured with
#     the model's own rock and snow plus scree grey on the low foothills.
#  Variant 0 is as supplied, variant 1 mirrored on X (summits stay at the back).
#  All numbers come from tools/blender/mountain-mask.json, which the client test reads too.
#  Also writes tools/blender/mountain-heights.json: a 33x33 height grid per variant (test only).
# Game units: 1 unit = hex circumradius, +Z up in Blender (exported Y-up), land top z=0.
# Blender y = -game z, so the default camera (game +z) looks from Blender -Y.
#
# Usage: blender -b --factory-startup --python tools/blender/mountain-kit.py -- "<Mountain Lowpoly.fbx>" <models dir> <preview.png>
# Also saves tools/blender/source/mountain-kit.blend.
import bpy, bmesh, json, math, os, sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
FBX, OUT_DIR, OUT_PNG = argv[0], argv[1], argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(FBX):
    sys.exit(f"Missing source model: {FBX} (copy the owner's Mountain Lowpoly.fbx to assets/mountain/)")
with open(os.path.join(HERE, "mountain-mask.json")) as f:
    M = json.load(f)

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


ROCK, SNOW, SCREE = range(3)
MATS = [mat("Rock", "#8d9196"), mat("Snow", "#f1f3f5", 0.85), mat("Scree", "#a3a29c")]


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def dome(rho):
    d = M["dome"]
    if rho >= d["radius"]:
        return 0.0
    u = 1 - (rho / d["radius"]) ** 2
    return d["amplitude"] * u * u


def hex_dist(x, z):
    """1 on the edges of a pointy-top hex of circumradius 1 (edge midpoints at 0, 60, ... deg)."""
    s = math.sqrt(3) / 2
    return max(abs(x), abs(x / 2 + z * s), abs(x / 2 - z * s)) / s


TAN = math.tan(math.radians(M["cameraDeg"]))
CORNERS = [(math.cos(math.radians(90 + 60 * k)), math.sin(math.radians(90 + 60 * k))) for k in range(6)]
# Things that must stay visible: (x, z, radius, top above the land).
TARGETS = [
    (M["chip"]["x"], M["chip"]["z"], M["chip"]["radius"], dome(0) + M["chip"]["top"]),
    (M["robber"]["x"], M["robber"]["z"], M["robber"]["radius"],
     dome(math.hypot(M["robber"]["x"], M["robber"]["z"])) + M["robber"]["top"]),
] + [(x, z, 0.12, M["cityTop"]) for x, z in CORNERS]


def clearing(x, z):
    """Distance from (x, z) to the chip-robber axis, and the clearing radius at that point."""
    c, b = M["chip"], M["robber"]
    ax, az = b["x"] - c["x"], b["z"] - c["z"]
    t = max(0.0, min(1.0, ((x - c["x"]) * ax + (z - c["z"]) * az) / (ax * ax + az * az)))
    d = math.hypot(x - c["x"] - ax * t, z - c["z"] - az * t)
    r = (c["radius"] + c["gap"]) * (1 - t) + (b["radius"] + b["gap"]) * t
    return d, r


def mask(x, z):
    """Mountain height multiplier at game (x, z): rim fade, the clearing and the front slope."""
    a, b = M["rimFade"]
    m = 1 - smooth(a, b, math.hypot(x, z))
    # One clearing for the chip and the robber (owner feedback): a capsule from the chip to the
    # robber spot, its radius narrowing from the chip's to the robber's.
    d, r = clearing(x, z)
    m *= smooth(r, r + M["clearBlend"], d)
    # The camera side becomes foothills, so the summits read as a backdrop behind the chip.
    z0, z1, low = M["frontSlope"]
    return m * (1 - (1 - low) * smooth(z0, z1, z))


def cap(x, z):
    """Highest absolute height at (x, z) that hides none of TARGETS from the default camera.
    A point d in front of a target (towards +z) blocks it above top + d * tan(55 deg)."""
    best = 9.0
    for tx, tz, r, top in TARGETS:
        d = z - (tz + r)
        if d < 0:
            continue
        band = 1 - smooth(r, r + M["capBand"], abs(x - tx))
        if band <= 0:
            continue
        lim = top + d * TAN - M["capMargin"]
        best = min(best, lim + (1 - band) * 9.0)
    return best


def height(x, z, h0):
    """Absolute height of a mountain vertex at game (x, z) with normalised source height h0."""
    g = dome(math.hypot(x, z))
    m = mask(x, z) * h0 * M["peakHeight"]
    m = min(m, max(0.0, cap(x, z) - g))
    return g + m if m > 0.002 else g - 0.005, m


# --- Source mountain -----------------------------------------------------------------------------
bpy.ops.import_scene.fbx(filepath=FBX)
src = bpy.data.objects.get("Mountain")
if src is None:
    sys.exit("No object named 'Mountain' in the FBX")
bm0 = bmesh.new()
bm0.from_mesh(src.data)
bm0.transform(src.matrix_world)
src_mats = [s.material.name if s.material else "" for s in src.material_slots]  # A = rock, B = snow
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

xs = [v.co.x for v in bm0.verts]
ys = [v.co.y for v in bm0.verts]
zs = [v.co.z for v in bm0.verts]
cx, cy, z0, z1 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs), max(zs)
half = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
top = max(bm0.verts, key=lambda v: v.co.z).co
# Rotate so the highest summit points to summitAngleDeg (game x/z angle; -90 = straight back).
summit_now = math.atan2(-(top.y - cy), top.x - cx)  # angle in game (x, z)
turn = math.radians(M["summitAngleDeg"]) - summit_now
for v in bm0.verts:
    x, z = (v.co.x - cx) / half * M["fit"], -(v.co.y - cy) / half * M["fit"]
    x, z = x * math.cos(turn) - z * math.sin(turn), x * math.sin(turn) + z * math.cos(turn)
    z -= M["offsetBack"]
    v.co = Vector((x, -z, (v.co.z - z0) / (z1 - z0)))  # z holds h0 for now
# Finer mesh so the clearing and the rim follow the mask, then decimated back down.
bmesh.ops.subdivide_edges(bm0, edges=bm0.edges[:], cuts=1, use_grid_fill=True)
bmesh.ops.triangulate(bm0, faces=bm0.faces[:])
print("SOURCE TRIS", len(bm0.faces), "TURN", round(math.degrees(turn), 1))

kit = []
heights = {}
col = collection("peak")
for variant in (0, 1):
    bm = bm0.copy()
    if variant == 1:
        for v in bm.verts:
            v.co.x = -v.co.x
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if hex_dist(v.co.x, -v.co.y) > M["hexCrop"]],
                     context="VERTS")
    bm.verts.index_update()
    low = {}
    for v in bm.verts:
        z_abs, m = height(v.co.x, -v.co.y, v.co.z)
        v.co.z = z_abs
        low[v.index] = m
    # Foothills: faces whose corners all sit low take the scree grey, the rest keep rock/snow.
    for f in bm.faces:
        src_name = src_mats[f.material_index] if f.material_index < len(src_mats) else ""
        if all(low[v.index] < M["lowScree"] for v in f.verts):
            f.material_index = SCREE
        else:
            f.material_index = SNOW if src_name == "B" else ROCK
    edges = [e for e in bm.edges if e.is_boundary]
    ext = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
        v.co.z = -0.03
    me = bpy.data.meshes.new(f"peak_variant_{variant}")
    bm.to_mesh(me)
    bm.free()
    for m_ in MATS:
        me.materials.append(m_)
    o = bpy.data.objects.new(me.name, me)
    col.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    dec = o.modifiers.new("dec", "DECIMATE")
    dec.ratio = min(1.0, M["targetTris"] / max(1, len(me.polygons)))
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
    for p in me.polygons:
        p.use_smooth = False
    o.select_set(False)
    kit.append(o)
    # Height grid in game coordinates (x, z from -1 to 1), for the client line-of-sight test.
    me.calc_loop_triangles()
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [t.vertices for t in me.loop_triangles])
    n = 33
    grid = []
    for j in range(n):
        row = []
        gz = -1 + 2 * j / (n - 1)
        for i in range(n):
            gx = -1 + 2 * i / (n - 1)
            hit = tree.ray_cast(Vector((gx, -gz, 5)), Vector((0, 0, -1)))
            row.append(round(hit[0].z, 4) if hit[0] is not None else 0.0)
        grid.append(row)
    heights[f"variant{variant}"] = grid

# --- Export ----------------------------------------------------------------------------------
os.makedirs(OUT_DIR, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
for o in kit:
    o.select_set(True)
bpy.context.view_layer.objects.active = kit[0]
path = os.path.join(OUT_DIR, "peak.glb")
bpy.ops.export_scene.gltf(
    filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
)
for o in kit:
    vs = o.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    print("VARIANT", o.name, "TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons),
          "SIZE", round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3),
          "H", round(max(zs), 3), "ZMIN", round(min(zs), 3))
print("GLB peak", os.path.getsize(path))
with open(os.path.join(HERE, "mountain-heights.json"), "w") as f:
    json.dump({"_comment": "Generated by mountain-kit.py; game (x, z) grid from -1 to 1, rows by z, absolute heights.",
               "n": 33, **heights}, f, separators=(",", ":"))
os.makedirs(os.path.join(HERE, "source"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source", "mountain-kit.blend"))

# --- Preview (not exported): the mountain on a domed hex with the chip, the robber at its spot
# and a settlement on every corner, from the default camera angle --
ctx = collection("Context")
kit[1].hide_render = True


def link_ctx(o):
    for c in o.users_collection:
        c.objects.unlink(o)
    ctx.objects.link(o)


bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=60, y_segments=60, size=1.0)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if hex_dist(v.co.x, -v.co.y) > 1.0], context="VERTS")
for v in bm.verts:
    v.co.z = dome(math.hypot(v.co.x, v.co.y))
ground = bpy.data.meshes.new("Ground")
bm.to_mesh(ground)
bm.free()
ground.materials.append(mat("GroundMat", "#9a9890"))
ctx.objects.link(bpy.data.objects.new("Ground", ground))
bpy.ops.mesh.primitive_cylinder_add(radius=M["chip"]["radius"], depth=0.04, location=(0, 0, dome(0) + 0.02))
chip = bpy.context.active_object
chip.data.materials.append(mat("Chip", "#efe3c4"))
link_ctx(chip)
rx, rz = M["robber"]["x"], M["robber"]["z"]
bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.06, depth=M["robber"]["top"],
                                location=(rx, -rz, dome(math.hypot(rx, rz)) + M["robber"]["top"] / 2))
robber = bpy.context.active_object
robber.data.materials.append(mat("Robber", "#3a3a40"))
link_ctx(robber)
st = os.path.join(HERE, "..", "..", "apps", "client", "public", "themes", "diorama", "models", "settlement.glb")
for x, z in CORNERS:
    if os.path.exists(st):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=st)
        for o in [o for o in bpy.data.objects if o not in before]:
            if o.parent is None:
                o.location = (x, -z, 0)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.lens = 40
scene.collection.objects.link(cam)
dist = 3.4
a = math.radians(M["cameraDeg"])
cam.location = (0.0, -dist * math.cos(a), dist * math.sin(a))
cam.rotation_euler = (Vector((0, 0, 0.1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.4
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
scene.render.resolution_y = 800
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("PREVIEW", OUT_PNG)
