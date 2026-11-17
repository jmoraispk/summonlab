"""Rig a generated GLB from landmark joints and add procedural walk + attack clips.

  blender -b -P scripts/blender_rig.py -- in.glb rigging/<subject>.json out.glb report.json

Landmarks are in normalized model space (height 1, X/Y centered, feet at Z=0; Blender axes:
X = character's left/right, -Y = forward, Z = up). Weights use Blender's automatic bone-heat
weighting; envelope weights are the fallback when bone heat fails.
"""
import json
import math
import sys

import bpy
from mathutils import Vector

src, spec_path, out, report_path = sys.argv[sys.argv.index("--") + 1:][:4]
spec = json.load(open(spec_path))
report = {"spec": spec_path, "notes": []}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
# Bake the normalization into the mesh so bone coordinates match the landmark file.
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
pts = [Vector(v.co) for v in mesh.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
K = 10.0  # bone heat fails to converge on ~1-unit meshes; rig at 10x scale
s = K / (hi.z - lo.z)
mesh.location = (-(lo.x + hi.x) / 2 * s, -(lo.y + hi.y) / 2 * s, -lo.z * s)
mesh.scale = (s, s, s)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
# Weld by position and drop imported custom normals; otherwise the exporter writes one vertex per
# triangle corner and downstream simplification cannot reduce the mesh.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
if mesh.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.shade_smooth()
for o in list(bpy.context.scene.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o)
report["vertices"] = len(mesh.data.vertices)
report["triangles"] = sum(len(p.vertices) - 2 for p in mesh.data.polygons)

# Mesh health: bone heat needs a reasonably closed, single-shell mesh.
import bmesh
bm = bmesh.new(); bm.from_mesh(mesh.data)
report["non_manifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold)
bm.verts.ensure_lookup_table()
seen, shells = set(), 0
for v in bm.verts:
    if v.index in seen:
        continue
    shells += 1
    stack = [v]
    while stack:
        x = stack.pop()
        if x.index in seen:
            continue
        seen.add(x.index)
        stack.extend(e.other_vert(x) for e in x.link_edges)
report["shells"] = shells
bm.free()

# Armature from landmarks: bones = [name, head_joint, tail_joint, parent].
AXES = {"+X": (1, 0, 0), "-X": (-1, 0, 0), "+Y": (0, 1, 0), "-Y": (0, -1, 0)}
FACING, UP = Vector(AXES[spec["facing"]]), Vector((0, 0, 1))
J = {k: Vector(v) * K for k, v in spec["joints"].items()}
arm_data = bpy.data.armatures.new("rig")
arm = bpy.data.objects.new("rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t, parent in spec["bones"]:
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = J[h], J[t]
    if (b.tail - b.head).length < 1e-4:
        b.tail = b.head + Vector((0, 0, 0.03 * K))
    # Roll local Z toward the facing direction (or up, for bones that run along it) so that a positive
    # rotation about local X always swings a limb forward / pitches a spine up, whatever the model's facing.
    d = (b.tail - b.head).normalized()
    b.align_roll(UP if abs(d.dot(FACING)) > 0.85 else FACING)
    if parent:
        b.parent = arm_data.edit_bones[parent]
        b.use_connect = (arm_data.edit_bones[parent].tail - b.head).length < 1e-4
bpy.ops.object.mode_set(mode="OBJECT")

# Skin. Generated meshes are split into hundreds of shells at UV seams, which defeats bone heat.
# Weight a watertight voxel-remeshed proxy instead, then transfer its weights onto the textured mesh.
import io, contextlib


def auto_weight(target):
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    log = io.StringIO()
    with contextlib.redirect_stdout(log):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    return sum(1 for v in target.data.vertices if not any(g.weight > 0.01 for g in v.groups))


direct_unweighted = None
if spec.get("try_direct", True):
    direct_unweighted = auto_weight(mesh)
report["direct_bone_heat_unweighted"] = direct_unweighted
if direct_unweighted is None or direct_unweighted > 0.02 * len(mesh.data.vertices):
    for g in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(g)
    mesh.modifiers.clear(); mesh.parent = None
    proxy = mesh.copy(); proxy.data = mesh.data.copy(); proxy.name = "weight-proxy"
    bpy.context.scene.collection.objects.link(proxy)
    rm = proxy.modifiers.new("remesh", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = spec.get("voxel", 0.008) * K
    bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.modifier_apply(modifier="remesh")
    report["proxy_vertices"] = len(proxy.data.vertices)
    report["proxy_unweighted"] = auto_weight(proxy)
    for b in arm_data.bones:
        mesh.vertex_groups.new(name=b.name)
    dt = mesh.modifiers.new("transfer", "DATA_TRANSFER")
    dt.object = proxy; dt.use_vert_data = True; dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"; dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.modifier_apply(modifier="transfer")
    bpy.data.objects.remove(proxy)
    mod = mesh.modifiers.new("rig", "ARMATURE"); mod.object = arm
    mesh.parent = arm
    report["weighting"] = "bone-heat on voxel proxy, transferred"
else:
    report["weighting"] = "bone-heat direct"
report["unweighted_vertices"] = sum(1 for v in mesh.data.vertices if not any(g.weight > 0.01 for g in v.groups))

# Procedural clips. Each key: frame -> {bone: (rx, ry, rz) degrees in bone-local space} and optional root offset.
FPS = 30
bpy.context.scene.render.fps = FPS


def clip(name, length, keys):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    for frame, pose in keys:
        for pb in arm.pose.bones:
            r = pose.get(pb.name, (0, 0, 0))
            pb.rotation_euler = [math.radians(a) for a in r]
            pb.keyframe_insert("rotation_euler", frame=frame)
            loc = pose.get("@" + pb.name, (0, 0, 0))
            pb.location = loc
            pb.keyframe_insert("location", frame=frame)
    act.use_fake_user = True
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, act)
    arm.animation_data.action = None


for c in spec["clips"]:
    clip(c["name"], c["frames"], [(k["f"], k["pose"]) for k in c["keys"]])

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_image_format="WEBP")
report["clips"] = [c["name"] for c in spec["clips"]]
json.dump(report, open(report_path, "w"), indent=2)
print("RIG", json.dumps(report))
