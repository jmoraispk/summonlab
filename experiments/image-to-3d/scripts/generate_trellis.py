"""TRELLIS route: image -> structured latent -> mesh + gaussians -> baked-texture GLB.

Run with ~/.local/opt/image-to-3d/TRELLIS/.venv/bin/python. Writes work/models/trellis/<subject>/.
"""
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("ATTN_BACKEND", "xformers")  # flash-attn does not support Turing (sm_75)
os.environ.setdefault("SPARSE_ATTN_BACKEND", "xformers")
os.environ.setdefault("SPCONV_ALGO", "native")
TRELLIS_HOME = Path(os.environ.get("IMAGE_TO_3D_HOME", Path.home() / ".local/opt/image-to-3d")) / "TRELLIS"
sys.path.insert(0, str(TRELLIS_HOME))

import torch  # noqa: E402

# torch.hub calls the GitHub API to check DINOv2 is not a fork; that endpoint rate-limits anonymous use.
torch.hub._validate_not_a_forked_repo = lambda *args, **kwargs: None
from PIL import Image  # noqa: E402

EXP = Path(__file__).resolve().parents[1]
SUBJECTS = json.loads((EXP / "subjects.json").read_text())


def main(only: set[str]) -> None:
    from trellis.pipelines import TrellisImageTo3DPipeline
    from trellis.utils import postprocessing_utils

    t = time.time()
    pipe = TrellisImageTo3DPipeline.from_pretrained("microsoft/TRELLIS-image-large")
    pipe.cuda()
    load_s = time.time() - t
    for s in SUBJECTS:
        if only and s["id"] not in only:
            continue
        out = EXP / "work" / "models" / "trellis" / s["id"]
        out.mkdir(parents=True, exist_ok=True)
        image = Image.open(EXP / "work" / "sources" / s["id"] / "clean.png").convert("RGBA")
        torch.cuda.reset_peak_memory_stats()
        t0 = time.time()
        res = pipe.run(image, seed=1234,
                       sparse_structure_sampler_params={"steps": 12, "cfg_strength": 7.5},
                       slat_sampler_params={"steps": 12, "cfg_strength": 3})
        t1 = time.time()
        glb = postprocessing_utils.to_glb(res["gaussian"][0], res["mesh"][0],
                                          simplify=0.95, texture_size=1024, verbose=False)
        t2 = time.time()
        glb.export(out / "raw.glb")
        meta = {
            "tool": "trellis-image-large", "subject": s["id"], "seed": 1234,
            "settings": {"ss_steps": 12, "slat_steps": 12, "simplify": 0.95, "texture_size": 1024},
            "seconds": {"model_load": round(load_s, 1), "generate": round(t1 - t0, 1),
                        "glb_bake": round(t2 - t1, 1), "total": round(t2 - t0, 1)},
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 2**30, 1),
            "gpu": torch.cuda.get_device_name(0),
        }
        (out / "meta.json").write_text(json.dumps(meta, indent=2))
        print(json.dumps(meta), flush=True)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
