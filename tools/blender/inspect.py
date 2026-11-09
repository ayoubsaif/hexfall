# Dump collections and mesh objects (location, rotation, size, materials) of a .blend as JSON.
# Usage: blender -b <file.blend> --python tools/blender/inspect.py -- <out.json>
import bpy, json
out = {"file": bpy.data.filepath, "collections": {}}
for c in bpy.data.collections:
    out["collections"][c.name] = len(c.objects)
objs = {}
for o in bpy.data.objects:
    if o.type != "MESH": continue
    d = o.dimensions
    objs[o.name] = {"col": [c.name for c in o.users_collection], "loc": [round(v, 3) for v in o.location],
                    "rot": [round(v, 2) for v in o.rotation_euler], "dim": [round(v, 3) for v in d],
                    "verts": len(o.data.vertices), "mat": [m.name for m in o.data.materials if m],
                    "mods": [m.type for m in o.modifiers], "parent": o.parent.name if o.parent else None}
out["objects"] = objs
import sys; open(sys.argv[sys.argv.index("--") + 1], "w").write(json.dumps(out))
