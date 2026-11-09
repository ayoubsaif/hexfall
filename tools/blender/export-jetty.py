# Join every mesh in the "Harbor" collection, apply transforms and export a Draco-compressed GLB.
# Usage: blender -b <jetty.blend> --python tools/blender/export-jetty.py -- <out.glb>
import bpy, sys
out = sys.argv[sys.argv.index("--") + 1]
col = bpy.data.collections["Harbor"]
objs = [o for o in col.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
j = bpy.context.active_object
j.name = j.data.name = "Jetty"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
mn = [min(v.co[i] for v in j.data.vertices) for i in range(3)]
mx = [max(v.co[i] for v in j.data.vertices) for i in range(3)]
print("LOC", tuple(j.location)); print("BOUNDS", [round(x, 3) for x in mn], [round(x, 3) for x in mx], "TRIS", len(j.data.polygons))
