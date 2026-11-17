"""Write rigging/<tool>--<subject>.json: hand-placed landmarks + shared biped/quadruped clip templates.

Landmarks were read off front/side orthographic grid renders (scripts/blender_views.py) in normalized
space: height 1, feet at Z=0, X/Y centered. This is the manual "marker placement" step that
Mixamo-style auto-riggers ask for; it took ~5 minutes per model.
"""
import json
from pathlib import Path

EXP = Path(__file__).resolve().parents[1]

BIPED_BONES = [
    ["hips", "pelvis_low", "pelvis", None], ["spine", "pelvis", "chest", "hips"],
    ["neck", "chest", "neck", "spine"], ["head", "neck", "head_top", "neck"],
    ["thigh.L", "hip.L", "knee.L", "hips"], ["shin.L", "knee.L", "ankle.L", "thigh.L"], ["foot.L", "ankle.L", "toe.L", "shin.L"],
    ["thigh.R", "hip.R", "knee.R", "hips"], ["shin.R", "knee.R", "ankle.R", "thigh.R"], ["foot.R", "ankle.R", "toe.R", "shin.R"],
    ["upperarm.L", "shoulder.L", "elbow.L", "spine"], ["forearm.L", "elbow.L", "hand.L", "upperarm.L"], ["hand.L", "hand.L", "handtip.L", "forearm.L"],
    ["upperarm.R", "shoulder.R", "elbow.R", "spine"], ["forearm.R", "elbow.R", "hand.R", "upperarm.R"], ["hand.R", "hand.R", "handtip.R", "forearm.R"],
]
QUAD_BONES = [
    ["hips", "pelvis_low", "pelvis", None], ["spine", "pelvis", "withers", "hips"],
    ["neck", "withers", "neck", "spine"], ["head", "neck", "snout", "neck"],
    ["tail", "tail_base", "tail_tip", "hips"],
    ["upperleg.FL", "shoulder.FL", "elbow.FL", "spine"], ["lowerleg.FL", "elbow.FL", "foot.FL", "upperleg.FL"],
    ["upperleg.FR", "shoulder.FR", "elbow.FR", "spine"], ["lowerleg.FR", "elbow.FR", "foot.FR", "upperleg.FR"],
    ["upperleg.HL", "hip.HL", "hock.HL", "hips"], ["lowerleg.HL", "hock.HL", "foot.HL", "upperleg.HL"],
    ["upperleg.HR", "hip.HR", "hock.HR", "hips"], ["lowerleg.HR", "hock.HR", "foot.HR", "upperleg.HR"],
]


def biped_clips(sign):
    """sign flips sagittal rotations for models that face -Y instead of +Y."""
    a = lambda d: (sign * d, 0, 0)  # noqa: E731 - swing about bone-local X
    stride = lambda t: {  # noqa: E731
        "thigh.L": a(25 * t), "thigh.R": a(-25 * t), "shin.L": a(-30 * max(0, -t)), "shin.R": a(-30 * max(0, t)),
        "upperarm.L": a(-15 * t), "upperarm.R": a(15 * t), "spine": (0, 6 * t, 0),
    }
    walk = {"name": "walk", "frames": 32, "keys": [
        {"f": 1, "pose": stride(1)}, {"f": 9, "pose": stride(0)}, {"f": 17, "pose": stride(-1)},
        {"f": 25, "pose": stride(0)}, {"f": 33, "pose": stride(1)}]}
    attack = {"name": "attack", "frames": 24, "keys": [
        {"f": 1, "pose": {}},
        {"f": 9, "pose": {"spine": (sign * -15, -20, 0), "upperarm.R": a(-70), "upperarm.L": a(-55), "forearm.R": a(-30), "head": a(10)}},
        {"f": 14, "pose": {"spine": (sign * 25, 15, 0), "upperarm.R": a(45), "upperarm.L": a(40), "forearm.R": a(10), "thigh.R": a(15)}},
        {"f": 25, "pose": {}}]}
    return [walk, attack]


def quad_clips(sign):
    a = lambda d: (sign * d, 0, 0)  # noqa: E731
    gait = lambda t: {  # diagonal pairs move together (trot)  # noqa: E731
        "upperleg.FL": a(20 * t), "upperleg.HR": a(20 * t), "upperleg.FR": a(-20 * t), "upperleg.HL": a(-20 * t),
        "lowerleg.FL": a(-25 * max(0, -t)), "lowerleg.HR": a(-25 * max(0, -t)),
        "lowerleg.FR": a(-25 * max(0, t)), "lowerleg.HL": a(-25 * max(0, t)),
        "tail": (0, 0, 15 * t), "head": a(4 * t),
    }
    walk = {"name": "walk", "frames": 24, "keys": [
        {"f": 1, "pose": gait(1)}, {"f": 7, "pose": gait(0)}, {"f": 13, "pose": gait(-1)},
        {"f": 19, "pose": gait(0)}, {"f": 25, "pose": gait(1)}]}
    attack = {"name": "attack", "frames": 24, "keys": [
        {"f": 1, "pose": {}},
        {"f": 8, "pose": {"neck": a(25), "head": a(15), "spine": a(-8), "upperleg.FL": a(15), "upperleg.FR": a(15)}},
        {"f": 13, "pose": {"neck": a(-35), "head": a(-25), "spine": a(10), "upperleg.FL": a(-25), "upperleg.FR": a(-25),
                           "upperleg.HL": a(20), "upperleg.HR": a(20)}},
        {"f": 25, "pose": {}}]}
    return [walk, attack]


SPECS = {
    "trellis--goblin-runt": {"kind": "biped", "facing": "+Y", "joints": {
        "pelvis_low": [-0.03, 0.0, 0.40], "pelvis": [-0.03, 0.0, 0.48], "chest": [-0.04, 0.03, 0.67],
        "neck": [0.0, 0.08, 0.79], "head_top": [0.03, 0.15, 1.0],
        "hip.L": [-0.12, -0.02, 0.44], "knee.L": [-0.22, -0.16, 0.28], "ankle.L": [-0.25, -0.2, 0.07], "toe.L": [-0.28, -0.3, 0.02],
        "hip.R": [0.06, 0.03, 0.44], "knee.R": [0.16, 0.18, 0.30], "ankle.R": [0.18, 0.14, 0.07], "toe.R": [0.2, 0.3, 0.02],
        "shoulder.L": [-0.17, -0.06, 0.72], "elbow.L": [-0.1, -0.04, 0.55], "hand.L": [0.15, 0.17, 0.62], "handtip.L": [0.2, 0.22, 0.62],
        "shoulder.R": [0.12, 0.0, 0.75], "elbow.R": [0.22, 0.06, 0.6], "hand.R": [0.24, 0.18, 0.68], "handtip.R": [0.27, 0.23, 0.7]}},
    "trellis--boar-bristle-hog": {"kind": "quadruped", "facing": "-Y", "voxel": 0.025, "joints": {
        "pelvis_low": [0.0, 0.48, 0.5], "pelvis": [0.0, 0.38, 0.55], "withers": [0.0, -0.28, 0.58],
        "neck": [0.0, -0.45, 0.45], "snout": [0.0, -0.66, 0.24],
        "tail_base": [0.0, 0.55, 0.56], "tail_tip": [0.0, 0.72, 0.53],
        "shoulder.FR": [0.14, -0.3, 0.42], "elbow.FR": [0.14, -0.42, 0.22], "foot.FR": [0.14, -0.55, 0.03],
        "shoulder.FL": [-0.14, -0.25, 0.42], "elbow.FL": [-0.15, -0.18, 0.2], "foot.FL": [-0.18, -0.12, 0.04],
        "hip.HR": [0.13, 0.42, 0.42], "hock.HR": [0.13, 0.55, 0.22], "foot.HR": [0.13, 0.62, 0.03],
        "hip.HL": [-0.13, 0.4, 0.42], "hock.HL": [-0.13, 0.25, 0.22], "foot.HL": [-0.13, 0.2, 0.03]}},
    "hunyuan3d--goblin-runt": {"kind": "biped", "facing": "-Y", "joints": {
        "pelvis_low": [0.0, 0.02, 0.40], "pelvis": [0.0, 0.02, 0.48], "chest": [-0.02, 0.0, 0.70],
        "neck": [-0.08, -0.06, 0.80], "head_top": [-0.1, -0.1, 1.0],
        "hip.L": [-0.09, -0.02, 0.44], "knee.L": [-0.2, -0.18, 0.32], "ankle.L": [-0.22, -0.2, 0.08], "toe.L": [-0.26, -0.32, 0.02],
        "hip.R": [0.09, 0.03, 0.44], "knee.R": [0.2, 0.14, 0.27], "ankle.R": [0.18, 0.15, 0.08], "toe.R": [0.22, 0.02, 0.02],
        "shoulder.L": [-0.14, 0.0, 0.73], "elbow.L": [-0.22, -0.1, 0.6], "hand.L": [-0.16, -0.2, 0.62], "handtip.L": [-0.14, -0.24, 0.64],
        "shoulder.R": [0.14, 0.02, 0.78], "elbow.R": [0.26, -0.05, 0.58], "hand.R": [-0.06, -0.2, 0.6], "handtip.R": [-0.1, -0.24, 0.62]}},
    "hunyuan3d--boar-bristle-hog": {"kind": "quadruped", "facing": "-X", "voxel": 0.025, "joints": {
        "pelvis_low": [0.55, 0.0, 0.5], "pelvis": [0.45, 0.0, 0.55], "withers": [-0.25, 0.0, 0.62],
        "neck": [-0.45, 0.0, 0.45], "snout": [-0.76, 0.0, 0.2],
        "tail_base": [0.55, -0.05, 0.6], "tail_tip": [0.76, -0.1, 0.62],
        "shoulder.FL": [-0.25, -0.15, 0.42], "elbow.FL": [-0.4, -0.15, 0.25], "foot.FL": [-0.54, -0.15, 0.03],
        "shoulder.FR": [-0.22, 0.15, 0.42], "elbow.FR": [-0.25, 0.15, 0.22], "foot.FR": [-0.25, 0.15, 0.03],
        "hip.HR": [0.45, 0.15, 0.42], "hock.HR": [0.62, 0.2, 0.22], "foot.HR": [0.7, 0.25, 0.04],
        "hip.HL": [0.42, -0.15, 0.42], "hock.HL": [0.35, -0.15, 0.2], "foot.HL": [0.25, -0.15, 0.03]}},
    "trellis--golem-clay-figure": {"kind": "biped", "facing": "-Y", "joints": {
        "pelvis_low": [0.0, 0.0, 0.40], "pelvis": [0.0, 0.0, 0.50], "chest": [0.0, 0.0, 0.75],
        "neck": [0.0, 0.0, 0.88], "head_top": [0.0, 0.0, 1.0],
        "hip.L": [-0.12, 0.0, 0.45], "knee.L": [-0.2, -0.02, 0.25], "ankle.L": [-0.25, 0.0, 0.06], "toe.L": [-0.27, -0.12, 0.02],
        "hip.R": [0.1, 0.0, 0.45], "knee.R": [0.16, 0.0, 0.25], "ankle.R": [0.2, 0.0, 0.06], "toe.R": [0.22, -0.12, 0.02],
        "shoulder.L": [-0.28, 0.0, 0.8], "elbow.L": [-0.42, -0.02, 0.55], "hand.L": [-0.46, -0.04, 0.32], "handtip.L": [-0.46, -0.04, 0.22],
        "shoulder.R": [0.16, 0.0, 0.82], "elbow.R": [0.32, -0.08, 0.65], "hand.R": [0.44, -0.14, 0.6], "handtip.R": [0.53, -0.16, 0.62]}},
    "hunyuan3d--golem-clay-figure": {"kind": "biped", "facing": "-Y", "joints": {
        "pelvis_low": [0.0, 0.16, 0.40], "pelvis": [0.0, 0.16, 0.50], "chest": [0.0, 0.12, 0.75],
        "neck": [0.0, 0.1, 0.9], "head_top": [0.0, 0.1, 1.0],
        "hip.L": [-0.12, 0.18, 0.45], "knee.L": [-0.18, 0.18, 0.25], "ankle.L": [-0.24, 0.18, 0.06], "toe.L": [-0.26, 0.05, 0.02],
        "hip.R": [0.08, 0.18, 0.45], "knee.R": [0.12, 0.18, 0.25], "ankle.R": [0.15, 0.18, 0.06], "toe.R": [0.17, 0.05, 0.02],
        "shoulder.L": [-0.22, 0.12, 0.84], "elbow.L": [-0.32, 0.08, 0.56], "hand.L": [-0.36, 0.05, 0.34], "handtip.L": [-0.36, 0.05, 0.26],
        "shoulder.R": [0.16, 0.1, 0.85], "elbow.R": [0.27, -0.1, 0.68], "hand.R": [0.32, -0.25, 0.58], "handtip.R": [0.34, -0.32, 0.58]}},
}

if __name__ == "__main__":
    out = EXP / "rigging"
    out.mkdir(exist_ok=True)
    for key, s in SPECS.items():
        sign = 1  # bone rolls follow the facing vector, so clips need no per-model sign
        s["bones"] = BIPED_BONES if s["kind"] == "biped" else QUAD_BONES
        s["clips"] = biped_clips(sign) if s["kind"] == "biped" else quad_clips(sign)
        (out / f"{key}.json").write_text(json.dumps(s, indent=1))
        print("wrote", key)
