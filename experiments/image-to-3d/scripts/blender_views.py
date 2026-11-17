"""Render front and side orthographic views of a GLB with a 0.1 grid, normalized to height 1.

Used to place rig landmarks. Usage:
  blender -b -P scripts/blender_views.py -- in.glb out_prefix
"""
import sys
import bpy
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
s = 1.0 / (hi.z - lo.z)
root = bpy.data.objects.new("root", None)
bpy.context.scene.collection.objects.link(root)
for o in meshes:
    if o.parent is None:
        o.parent = root
root.scale = (s, s, s)
root.location = (-(lo.x + hi.x) / 2 * s, -(lo.y + hi.y) / 2 * s, -lo.z * s)
bpy.context.view_layer.update()

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = scene.render.resolution_y = 800
# Grid of thin bars every 0.1 in X/Z (front) and Y/Z (side).
mat = bpy.data.materials.new("grid"); mat.diffuse_color = (1, 0.2, 0.2, 1)
def bar(loc, dims):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    b = bpy.context.object; b.scale = [d / 2 for d in dims]; b.data.materials.append(mat)
    b.display.show_shadows = False
for i in range(-10, 11):
    v = i / 10
    bar((v, 1.5, 0.5), (0.002, 0.002, 1.4)); bar((0, 1.5, v + 0.5), (2.2, 0.002, 0.002))  # behind, for front view
    bar((-1.5, v, 0.5), (0.002, 0.002, 1.4)); bar((-1.5, 0, v + 0.5), (0.002, 2.2, 0.002))  # side view
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 1.6  # 0.1 units = 50 px at 800 px
for name, loc, rot in [("front", (0, -5, 0.5), (1.5708, 0, 0)), ("side", (5, 0, 0.5), (1.5708, 0, 1.5708))]:
    cam.location = loc; cam.rotation_euler = rot
    scene.render.filepath = f"{out}-{name}.png"
    bpy.ops.render.render(write_still=True)
print("extent", tuple(round(x, 3) for x in (hi - lo)))
