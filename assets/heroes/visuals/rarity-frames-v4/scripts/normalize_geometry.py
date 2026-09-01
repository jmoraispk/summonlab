#!/usr/bin/env python3
"""Audit and gently normalize complete candidate frames as indivisible images.

This script never identifies, extracts, or moves the integrated stars. When a
candidate falls outside the shared opening-width band, the entire rendered
frame—including tray and stars—is scaled horizontally around the canvas
center. The untouched provider render is retained before any adjustment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import statistics
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "candidates" / "individuals"
RAW = ROOT / "references" / "geometry-raw"
REPORT = ROOT / "geometry-report.json"
FAMILIES = ("neutral", "fire", "water", "earth", "wind")
TARGET_MIN = 430
TARGET_MAX = 510
MAX_RATIO = 1.20


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def opening_width(path: Path) -> int:
    """Median central warm-white run through the hero display region."""
    image = Image.open(path).convert("RGB")
    pixels = image.load()
    widths: list[int] = []
    for y in range(520, 1118, 32):
        runs: list[tuple[int, int]] = []
        start: int | None = None
        for x in range(image.width):
            red, green, blue = pixels[x, y]
            is_opening = min(red, green, blue) > 205 and max(red, green, blue) - min(red, green, blue) < 32
            if is_opening and start is None:
                start = x
            elif not is_opening and start is not None:
                runs.append((start, x - 1))
                start = None
        if start is not None:
            runs.append((start, image.width - 1))
        central = [(left, right) for left, right in runs if left < image.width // 2 < right]
        if central:
            widths.append(max(right - left + 1 for left, right in central))
    if not widths:
        raise RuntimeError(f"No central opening detected in {path}")
    return round(statistics.median(widths))


def normalize(path: Path, measured: int) -> dict[str, object] | None:
    target = max(TARGET_MIN, min(TARGET_MAX, measured))
    if target == measured:
        return None

    raw_dir = RAW / path.parent.name
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"{path.stem}-provider{path.suffix}"
    if raw_path.exists() and sha256(raw_path) != sha256(path):
        raise RuntimeError(f"Collision at retained provider source: {raw_path}")
    if not raw_path.exists():
        shutil.copy2(path, raw_path)

    image = Image.open(path).convert("RGB")
    scale = target / measured
    resized_width = round(image.width * scale)
    resized = image.resize((resized_width, image.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", image.size, image.getpixel((0, 0)))
    if resized_width <= image.width:
        canvas.paste(resized, ((image.width - resized_width) // 2, 0))
    else:
        left = (resized_width - image.width) // 2
        canvas.paste(resized.crop((left, 0, left + image.width, image.height)), (0, 0))
    canvas.save(path, optimize=True)
    return {
        "provider_source": str(raw_path.relative_to(ROOT)),
        "provider_sha256": sha256(raw_path),
        "scale_x": round(scale, 6),
        "requested_opening_px": target,
        "normalized_sha256": sha256(path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply bounded whole-frame normalization")
    args = parser.parse_args()

    report: dict[str, object] = {
        "method": "median central warm-white opening width at y=520..1117; complete-frame horizontal scaling only",
        "canvas": "1024x1536 RGB",
        "allowed_family_ratio": MAX_RATIO,
        "normalization_band_px": [TARGET_MIN, TARGET_MAX],
        "families": {},
    }
    for family in FAMILIES:
        directory = CANDIDATES / family
        files = sorted(directory.glob("*.png"))
        if len(files) != 7:
            raise RuntimeError(f"Expected seven {family} candidates, found {len(files)}")
        changes: dict[str, object] = {}
        if args.apply:
            for path in files:
                before = opening_width(path)
                change = normalize(path, before)
                if change:
                    change["before_opening_px"] = before
                    changes[path.name] = change

        measurements = {path.name: opening_width(path) for path in files}
        widest = max(measurements.values())
        narrowest = min(measurements.values())
        ratio = widest / narrowest
        report["families"][family] = {
            "openings_px": measurements,
            "narrowest_px": narrowest,
            "widest_px": widest,
            "ratio": round(ratio, 6),
            "variation_percent": round((ratio - 1) * 100, 2),
            "passes_20_percent_cap": ratio <= MAX_RATIO,
            "whole_frame_normalizations": changes,
        }

    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not all(item["passes_20_percent_cap"] for item in report["families"].values()):
        raise SystemExit("One or more families exceed the 20% opening-width cap")


if __name__ == "__main__":
    main()
