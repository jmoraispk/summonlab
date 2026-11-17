"""Hunyuan3D-2 route: image -> shape (DiT flow matching) -> paint (multiview texture) -> GLB.

Run inside ~/.local/opt/image-to-3d/Hunyuan3D-2/.venv. Writes work/models/hunyuan3d/<subject>/.
"""
import json
import sys
import time
from pathlib import Path

import torch
from PIL import Image

EXP = Path(__file__).resolve().parents[1]
SUBJECTS = json.loads((EXP / "subjects.json").read_text())
PAINT_FACES = 40000  # Hunyuan3D-2's documented reduce-before-paint default


def main(only: set[str]) -> None:
    from hy3dgen.shapegen import (
        DegenerateFaceRemover, FaceReducer, FloaterRemover, Hunyuan3DDiTFlowMatchingPipeline,
    )
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    t = time.time()
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("tencent/Hunyuan3D-2")
    paint = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2")
    load_s = time.time() - t
    for s in SUBJECTS:
        if only and s["id"] not in only:
            continue
        out = EXP / "work" / "models" / "hunyuan3d" / s["id"]
        out.mkdir(parents=True, exist_ok=True)
        image = Image.open(EXP / "work" / "sources" / s["id"] / "clean.png").convert("RGBA")
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        mesh = shape(image=image, num_inference_steps=50, octree_resolution=380,
                     generator=torch.manual_seed(1234))[0]
        t1 = time.time()
        mesh = FloaterRemover()(mesh)
        mesh = DegenerateFaceRemover()(mesh)
        mesh.export(out / "shape-raw.glb")
        shape_faces = len(mesh.faces)
        mesh = FaceReducer()(mesh, max_facenum=PAINT_FACES)
        t2 = time.time()
        textured = paint(mesh, image=image)
        t3 = time.time()
        textured.export(out / "raw.glb")
        meta = {
            "tool": "hunyuan3d-2", "subject": s["id"], "seed": 1234,
            "settings": {"steps": 50, "octree_resolution": 380, "paint_faces": PAINT_FACES},
            "seconds": {"model_load": round(load_s, 1), "shape": round(t1 - t0, 1),
                        "cleanup": round(t2 - t1, 1), "paint": round(t3 - t2, 1),
                        "total": round(t3 - t0, 1)},
            "shape_faces_before_reduce": shape_faces,
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 2**30, 1),
            "gpu": torch.cuda.get_device_name(0),
        }
        (out / "meta.json").write_text(json.dumps(meta, indent=2))
        print(json.dumps(meta))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
