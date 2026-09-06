#!/usr/bin/env python3
"""Validate that a Village hero cutout is a usable transparent PNG."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


class CutoutValidationError(ValueError):
    """Raised when an image cannot be used as a Village cutout."""


def validate_village_cutout(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        if image.format != "PNG" or image.size != (1024, 1536):
            raise CutoutValidationError("Village cutout must be a 1024x1536 PNG")
        if image.mode not in {"RGBA", "LA"}:
            raise CutoutValidationError(
                "Village cutout must contain true alpha, not an opaque portrait plate"
            )

        alpha = image.getchannel("A")
        extrema = alpha.getextrema()
        if extrema is None or extrema[0] > 8 or extrema[1] <= 8:
            raise CutoutValidationError(
                "Village cutout must contain both true alpha and visible character pixels"
            )

        width, height = image.size
        edges = (
            alpha.crop((0, 0, width, 1)),
            alpha.crop((0, height - 1, width, height)),
            alpha.crop((0, 0, 1, height)),
            alpha.crop((width - 1, 0, width, height)),
        )
        if any(edge.getextrema()[1] > 8 for edge in edges):
            raise CutoutValidationError("Village cutout character must not touch a canvas edge")

        histogram = alpha.histogram()
        visible_pixels = sum(histogram[9:])
        visible_fraction = visible_pixels / (width * height)
        if not 0.02 <= visible_fraction <= 0.60:
            raise CutoutValidationError(
                "Village cutout visible area must be a bounded character silhouette"
            )

        return {
            "height": height,
            "path": str(path),
            "status": "valid",
            "visibleFraction": round(visible_fraction, 6),
            "width": width,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    arguments = parser.parse_args()
    try:
        result = validate_village_cutout(arguments.source.resolve(strict=True))
    except (CutoutValidationError, FileNotFoundError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
