"""Prepare clean image-to-3D inputs: background removal, subject crop, square pad.

Writes to work/sources/<subject>/ (gitignored): original.png, cutout.png (RGBA),
clean.png (RGBA, square, padded) and clean-gray.png (on neutral gray).
Writes small committed previews to previews/sources/<subject>.webp.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

EXP = Path(__file__).resolve().parents[1]
REPO = EXP.parents[1]
SUBJECTS = json.loads((EXP / "subjects.json").read_text())


def largest_component_mask(alpha: np.ndarray, keep: float) -> np.ndarray:
    """Drop small disconnected blobs (debris, splashes) below `keep` of the largest blob."""
    from scipy import ndimage

    labels, n = ndimage.label(alpha > 32)
    if n <= 1:
        return alpha
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1))
    good = {i + 1 for i, s in enumerate(sizes) if s >= keep * sizes.max()}
    return np.where(np.isin(labels, list(good)), alpha, 0)


def main(only: set[str]) -> None:
    session = new_session("birefnet-general")
    for s in SUBJECTS:
        if only and s["id"] not in only:
            continue
        out = EXP / "work" / "sources" / s["id"]
        out.mkdir(parents=True, exist_ok=True)
        src = Image.open(REPO / s["source"]).convert("RGB")
        src.save(out / "original.png")
        cut = remove(src, session=session, post_process_mask=True)
        a = np.asarray(cut).copy()
        a[..., 3] = largest_component_mask(a[..., 3], s.get("keepBlobFraction", 0.02))
        cut = Image.fromarray(a)
        cut.save(out / "cutout.png")
        x0, y0, x1, y1 = cut.getbbox()
        side = int(max(x1 - x0, y1 - y0) * 1.12)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(cut.crop((x0, y0, x1, y1)), ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
        sq = sq.resize((1024, 1024), Image.LANCZOS)
        sq.save(out / "clean.png")
        gray = Image.new("RGBA", sq.size, (128, 128, 128, 255))
        gray.alpha_composite(sq)
        gray.convert("RGB").save(out / "clean-gray.png")
        prev = EXP / "previews" / "sources"
        prev.mkdir(parents=True, exist_ok=True)
        pair = Image.new("RGB", (640, 320), (40, 40, 40))
        o = src.copy(); o.thumbnail((320, 320)); pair.paste(o, ((320 - o.width) // 2, (320 - o.height) // 2))
        g = gray.convert("RGB").resize((320, 320)); pair.paste(g, (320, 0))
        pair.save(prev / f"{s['id']}.webp", quality=82)
        print(s["id"], "bbox", (x0, y0, x1, y1), "->", out / "clean.png")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
