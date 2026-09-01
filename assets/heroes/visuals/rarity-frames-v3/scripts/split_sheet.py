#!/usr/bin/env python3
"""Split a seven-column comparison sheet into collision-safe reference crops."""

from pathlib import Path
import sys

from PIL import Image


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: split_sheet.py SHEET OUTPUT_DIRECTORY")

    source = Path(sys.argv[1]).resolve()
    output_directory = Path(sys.argv[2]).resolve()
    if not source.is_file():
        raise SystemExit(f"missing sheet: {source}")

    output_directory.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.width % 7 != 2:
            raise SystemExit(
                f"unexpected seven-column geometry: {image.width}x{image.height}"
            )

        crop_top = round(image.height * 0.17)
        crop_bottom = round(image.height * 0.91)
        for index in range(7):
            cell_left = round(index * image.width / 7)
            cell_right = round((index + 1) * image.width / 7)
            inset = round((cell_right - cell_left) * 0.035)
            left = cell_left + inset
            right = cell_right - inset
            destination = output_directory / f"neutral-v4-rank-{index + 1}-crop-v2.png"
            if destination.exists():
                raise SystemExit(f"refusing existing crop: {destination}")
            image.crop((left, crop_top, right, crop_bottom)).save(destination)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
