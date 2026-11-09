# Harbor jetty: a stone road leaving the hex edge over a small rock cliff, running out over the
# sea, with dark rocks clustered at the shore. Game units: origin = coast edge midpoint at land
# top (game y=0), +X runs out to sea, land top z=0, sea surface z=-0.14.
# Usage: blender -b --factory-startup --python tools/blender/jetty.py -- <out.glb> <preview.png> \
#          tools/blender/source/harbor-owner-rocks.blend
# Then join + Draco-compress into the theme: blender -b <out.blend> --python tools/blender/export-jetty.py -- \
#          apps/client/public/themes/diorama/models/jetty.glb
import bpy, bmesh, math, random, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]

SEA = -0.14
# Half the v2 length: from x=-0.04 (tucked into the land) to the sea end at 0.35.
X0, X1 = -0.04, 0.35
USER_BLEND = argv[2]  # the owner's edited harbor.blend: its rocks are reused as placed
WIDTH = 0.42
TOP0, TOP1 = 0.0, SEA + 0.07   # deck top at the land end and the sea end
CLIFF_END = 0.30    # rock cliff under the deck up to here; pillars beyond
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("Harbor")
scene.collection.children.link(col)
ctx_col = bpy.data.collections.new("Context")
scene.collection.children.link(ctx_col)


def mat(name, rgb, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


M_SLAB = mat("JettyStone", srgb("#a7a49c"))
M_SLAB2 = mat("JettyStoneWarm", srgb("#b8ab94"))
M_CLIFF = mat("CliffRock", srgb("#7b7468"))
M_ROCK = mat("ShoreRock", srgb("#4a4744"))
M_MOSS = mat("ShoreRockWet", srgb("#3b4a40"))


def top_z(x):
    t = min(1, max(0, (x - X0) / (X1 - X0)))
    # Stays near land height for the first third, then eases down to the sea end.
    s = max(0, (t - 0.25) / 0.75)
    return TOP0 + (TOP1 - TOP0) * (s * s * (3 - 2 * s))


def link(obj, c=col):
    c.objects.link(obj)
    return obj


def mesh_obj(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = False
    return link(bpy.data.objects.new(name, me))


def bevel_box(name, size, loc, rot_z, material, bevel=0.006):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    o = mesh_obj(name, bm, material)
    o.location = loc
    o.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.04, 0.04), rot_z)
    return o


def rock(name, loc, radius, squash, material, seed, detail=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = noise.noise(v.co * 1.6 + off)
        v.co *= 1 + 0.32 * n
        v.co.z *= squash
        if v.co.z < -0.2:  # flat-ish underside
            v.co.z = -0.2 + (v.co.z + 0.2) * 0.3
    bmesh.ops.scale(bm, vec=Vector((radius, radius, radius)), verts=bm.verts)
    o = mesh_obj(name, bm, material)
    o.location = loc
    o.rotation_euler = (0, 0, random.uniform(0, math.tau))
    return o


# --- Deck: stone slabs laid across the road, like the planks in the reference ----------------
n = 6
step = (X1 - X0) / n
for i in range(n):
    x = X0 + step * (i + 0.5)
    th = 0.055
    w = WIDTH * random.uniform(0.92, 1.0)
    bevel_box(
        f"Slab.{i:02d}",
        (step * 0.88, w, th),
        (x, random.uniform(-0.012, 0.012), top_z(x) - th / 2 + random.uniform(-0.003, 0.003)),
        random.uniform(-0.06, 0.06),
        M_SLAB if i % 3 else M_SLAB2,
    )

# Kerb: a few long, uneven stones per side, end to end along the road edge.
for side in (-1, 1):
    x = X0
    j = 0
    while x < X1 - 0.02:
        ln = min(random.uniform(0.17, 0.26), X1 - x)
        mid = x + ln / 2
        z0, z1 = top_z(x), top_z(x + ln)
        o = bevel_box(
            f"Kerb.{'L' if side < 0 else 'R'}{j}",
            (ln - 0.008, random.uniform(0.05, 0.06), random.uniform(0.045, 0.055)),
            (mid, side * (WIDTH / 2 + 0.02), (z0 + z1) / 2 + 0.006),
            random.uniform(-0.03, 0.03),
            M_CLIFF,
            bevel=0.012,
        )
        o.rotation_euler.y = math.atan2(z0 - z1, ln)  # follow the slope
        x += ln
        j += 1

# --- Pillars under the seaward half -----------------------------------------------------------
for t in (0.78,):
    x = X0 + (X1 - X0) * t
    for side in (-1, 1):
        zt = top_z(x) - 0.035
        hgt = zt - (SEA - 0.1)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.045, radius2=0.036, depth=hgt)
        o = mesh_obj(f"Pillar.{t}.{side}", bm, M_CLIFF)
        o.location = (x, side * (WIDTH / 2 - 0.03), zt - hgt / 2)
        o.rotation_euler = (0, 0, random.uniform(0, 1))

# --- Shore rocks: the owner's hand-placed rocks from harbor.blend, pulled in to the half-length
# jetty (x halved), keeping their shape, tilt and height. Materials map back to the shared ones.
with bpy.data.libraries.load(USER_BLEND, link=False) as (src, dst):
    dst.objects = [name for name in src.objects if name.startswith("Rock.")]
shared = {"ShoreRock": M_ROCK, "ShoreRockWet": M_MOSS}
for o in dst.objects:
    o.location.x *= 0.5
    for i, m in enumerate(o.data.materials):
        base = m.name.split(".")[0] if m else "ShoreRock"
        o.data.materials[i] = shared.get(base, M_ROCK)
    link(o)
print("USER_ROCKS", len(dst.objects))

# --- Context (preview only, not exported): land, sand, sea -----------------------------------
def plane(name, size, loc, rgb, alpha=1.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = (*size, 1)
    o.name = name
    m = mat(name + "M", rgb, 0.3 if alpha < 1 else 0.9)
    if alpha < 1:
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    o.data.materials.append(m)
    for c in o.users_collection:
        c.objects.unlink(o)
    ctx_col.objects.link(o)
    return o

bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.6, 0, -0.2))
land = bpy.context.active_object
land.scale = (1.2, 2.4, 0.4)
land.data.materials.append(mat("LandM", srgb("#6f9a4a")))
for c in land.users_collection:
    c.objects.unlink(land)
ctx_col.objects.link(land)
plane("Sand", (0.5, 2.4), (0.05, 0, SEA + 0.02), srgb("#e2c88a"))
plane("Sea", (4, 4), (1.5, 0, SEA), srgb("#2f78c4"), alpha=0.82)
plane("SeaFloor", (4, 4), (1.5, 0, SEA - 0.2), srgb("#1e4e7a"))

# --- Export only the Harbor collection, Y-up glTF --------------------------------------------
bpy.ops.object.select_all(action="DESELECT")
for o in col.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True,
    export_yup=True, export_materials="EXPORT",
)

# --- Preview render ---------------------------------------------------------------------------
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (1.9, -1.7, 1.25)
look = Vector((0.25, 0, -0.08))
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.82, 0.9, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
scene.world = world
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 640
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
for o in list(ctx_col.objects):
    bpy.data.objects.remove(o)
bpy.data.collections.remove(ctx_col)
bpy.ops.wm.save_as_mainfile(filepath=OUT_GLB.replace(".glb", ".blend"))
print("TRIS", sum(len(o.data.polygons) for o in col.objects))
