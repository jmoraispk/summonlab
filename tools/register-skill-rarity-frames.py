#!/usr/bin/env python3
"""Register accepted rarity-frame artwork to the shared geometry-v2 canvas."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


RANKS = ("f", "e", "d", "c", "b", "a", "s")
ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/wiki/skills/rarity-frame-v2/review/individuals"
OUTPUT_ROOT = ROOT / "assets/wiki/skills/rarity-frame-v3"
GEOMETRY_PATH = ROOT / "assets/wiki/skills/icon-production-v1/geometry-v2.json"


def transparent_component_bbox(alpha: Image.Image) -> tuple[int, int, int, int]:
	width, height = alpha.size
	pixels = alpha.load()
	start = (width // 2, height // 2)
	if pixels[start] > 8:
		raise ValueError("Canvas center is not transparent")
	seen = bytearray(width * height)
	queue = deque([start])
	seen[start[1] * width + start[0]] = 1
	minimum_x = maximum_x = start[0]
	minimum_y = maximum_y = start[1]
	touches_edge = False
	while queue:
		x, y = queue.popleft()
		minimum_x = min(minimum_x, x)
		maximum_x = max(maximum_x, x)
		minimum_y = min(minimum_y, y)
		maximum_y = max(maximum_y, y)
		if x == 0 or y == 0 or x == width - 1 or y == height - 1:
			touches_edge = True
		for adjacent_x, adjacent_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
			if not (0 <= adjacent_x < width and 0 <= adjacent_y < height):
				continue
			index = adjacent_y * width + adjacent_x
			if seen[index] or pixels[adjacent_x, adjacent_y] > 8:
				continue
			seen[index] = 1
			queue.append((adjacent_x, adjacent_y))
	if touches_edge:
		raise ValueError("Frame is not closed around its central aperture")
	return minimum_x, minimum_y, maximum_x + 1, maximum_y + 1


def scaled_polygon(
	points: list[list[float]], width: int, height: int
) -> list[tuple[float, float]]:
	return [(x * width, y * height) for x, y in points]


def inset_polygon(
	points: list[tuple[float, float]], center: tuple[float, float], scale: float
) -> list[tuple[float, float]]:
	center_x, center_y = center
	return [
		(center_x + (x - center_x) * scale, center_y + (y - center_y) * scale)
		for x, y in points
	]


def point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
	inside = False
	previous = len(polygon) - 1
	for index in range(len(polygon)):
		x_i, y_i = polygon[index]
		x_j, y_j = polygon[previous]
		if y_i != y_j and (y_i > y) != (y_j > y):
			if x < ((x_j - x_i) * (y - y_i)) / (y_j - y_i) + x_i:
				inside = not inside
		previous = index
	return inside


def role_mask(
	geometry: dict[str, object], width: int, height: int
) -> tuple[Image.Image, list[tuple[float, float]], list[tuple[float, float]]]:
	outer = scaled_polygon(geometry["outerEnvelopePoints"], width, height)  # type: ignore[arg-type]
	aperture = scaled_polygon(geometry["aperturePoints"], width, height)  # type: ignore[arg-type]
	center_data = geometry["center"]  # type: ignore[assignment]
	center = (float(center_data["x"]), float(center_data["y"]))  # type: ignore[index]
	inner = inset_polygon(aperture, center, float(geometry["innerApertureScale"]))
	medallion = scaled_polygon(geometry["rarityMedallionExclusion"], width, height)  # type: ignore[arg-type]
	mask_data = bytearray(width * height)
	for y in range(height):
		pixel_y = y + 0.5
		for x in range(width):
			pixel_x = x + 0.5
			in_exclusion = point_in_polygon(pixel_x, pixel_y, medallion)
			allowed = in_exclusion or (
				point_in_polygon(pixel_x, pixel_y, outer)
				and not point_in_polygon(pixel_x, pixel_y, inner)
			)
			if allowed:
				mask_data[y * width + x] = 255
	mask = Image.frombytes("L", (width, height), bytes(mask_data))
	return mask, inner, outer


def extend_frame_outward(
	frame: Image.Image,
	outer: list[tuple[float, float]],
	center: tuple[float, float],
	distance: int = 18,
) -> Image.Image:
	"""Extrude each hex edge radially beneath the original to meet the outer envelope."""
	extended = Image.new("RGBA", frame.size, (0, 0, 0, 0))
	for edge in range(len(outer)):
		start = outer[edge]
		end = outer[(edge + 1) % len(outer)]
		sector_mask = Image.new("L", frame.size, 0)
		ImageDraw.Draw(sector_mask).polygon((center, start, end), fill=255)
		sector = Image.new("RGBA", frame.size, (0, 0, 0, 0))
		sector.paste(frame, (0, 0), sector_mask)
		midpoint_x = (start[0] + end[0]) / 2
		midpoint_y = (start[1] + end[1]) / 2
		direction_x = midpoint_x - center[0]
		direction_y = midpoint_y - center[1]
		length = (direction_x * direction_x + direction_y * direction_y) ** 0.5
		for step in range(1, distance + 1):
			offset_x = round(direction_x / length * step)
			offset_y = round(direction_y / length * step)
			shifted = Image.new("RGBA", frame.size, (0, 0, 0, 0))
			shifted.alpha_composite(sector, (offset_x, offset_y))
			extended.alpha_composite(shifted)
	extended.alpha_composite(frame)
	return extended


def register_frame(
	source: Image.Image,
	target_inner: list[tuple[float, float]],
	target_outer: list[tuple[float, float]],
	mask: Image.Image,
) -> tuple[Image.Image, tuple[int, int, int, int]]:
	source = source.convert("RGBA")
	source_aperture = transparent_component_bbox(source.getchannel("A"))
	source_left, source_top, source_right, source_bottom = source_aperture
	target_left = min(x for x, _ in target_inner)
	target_top = min(y for _, y in target_inner)
	target_right = max(x for x, _ in target_inner)
	target_bottom = max(y for _, y in target_inner)
	scale_x = (target_right - target_left) / (source_right - source_left)
	scale_y = (target_bottom - target_top) / (source_bottom - source_top)
	transform = (
		1 / scale_x,
		0,
		source_left - target_left / scale_x,
		0,
		1 / scale_y,
		source_top - target_top / scale_y,
	)
	registered = source.transform(
		source.size,
		Image.Transform.AFFINE,
		transform,
		resample=Image.Resampling.BICUBIC,
	)
	registered = extend_frame_outward(registered, target_outer, (512, 512))
	alpha = registered.getchannel("A")
	alpha = Image.composite(alpha, Image.new("L", alpha.size, 0), mask)
	registered.putalpha(alpha)
	return registered, source_aperture


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
	path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
	return ImageFont.truetype(path, size) if path.is_file() else ImageFont.load_default()


def checker(size: tuple[int, int], cell: int = 24) -> Image.Image:
	image = Image.new("RGBA", size, (37, 37, 37, 255))
	draw = ImageDraw.Draw(image)
	for y in range(0, size[1], cell):
		for x in range(0, size[0], cell):
			if (x // cell + y // cell) % 2:
				draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(24, 24, 24, 255))
	return image


def contact_sheet(frames: dict[str, Image.Image], destination: Path) -> None:
	cell = 430
	header = 90
	label = 54
	canvas = Image.new("RGBA", (cell * 4, header + (cell + label) * 2), (6, 6, 6, 255))
	draw = ImageDraw.Draw(canvas)
	draw.text((24, 18), "Registered rarity frames — geometry-v2 candidates", font=font(36), fill=(236, 226, 210, 255))
	for index, rank in enumerate(RANKS):
		column = index % 4
		row = index // 4
		x = column * cell
		y = header + row * (cell + label)
		background = checker((cell, cell), 20)
		frame = frames[rank].resize((cell, cell), Image.Resampling.LANCZOS)
		background.alpha_composite(frame)
		canvas.alpha_composite(background, (x, y))
		draw.text((x + 18, y + cell + 3), rank.upper(), font=font(38), fill=(239, 229, 211, 255))
	canvas.save(destination, optimize=True)


def overlay_sheet(frames: dict[str, Image.Image], destination: Path) -> None:
	colors = {
		"f": (255, 255, 255, 82),
		"e": (255, 126, 44, 82),
		"d": (58, 147, 255, 82),
		"c": (176, 235, 255, 82),
		"b": (191, 80, 255, 82),
		"a": (255, 236, 174, 82),
		"s": (255, 191, 0, 82),
	}
	canvas = checker((1024, 1024), 32)
	for rank, frame in frames.items():
		alpha = frame.getchannel("A")
		tint = Image.new("RGBA", frame.size, colors[rank])
		tint.putalpha(alpha.point(lambda value: min(82, value)))
		canvas.alpha_composite(tint)
	canvas.save(destination, optimize=True)


def recognition_sheet(frames: dict[str, Image.Image], destination: Path) -> None:
	cell = 128
	canvas = checker((cell * len(RANKS), cell), 8)
	for index, rank in enumerate(RANKS):
		frame = frames[rank].resize((96, 96), Image.Resampling.LANCZOS)
		canvas.alpha_composite(frame, (index * cell + 16, 16))
	canvas.save(destination, optimize=True)


def sha256(path: Path) -> str:
	return hashlib.sha256(path.read_bytes()).hexdigest()


def build(write: bool) -> None:
	geometry = json.loads(GEOMETRY_PATH.read_text())
	width = int(geometry["canvas"]["width"])
	height = int(geometry["canvas"]["height"])
	mask, target_inner, target_outer = role_mask(geometry, width, height)
	frames: dict[str, Image.Image] = {}
	records = []
	individuals = OUTPUT_ROOT / "candidates/individuals"
	review = OUTPUT_ROOT / "review"
	if write:
		individuals.mkdir(parents=True, exist_ok=True)
		review.mkdir(parents=True, exist_ok=True)
	for rank in RANKS:
		source_path = SOURCE_DIR / f"{rank}.png"
		registered, source_aperture = register_frame(
			Image.open(source_path), target_inner, target_outer, mask
		)
		frames[rank] = registered
		output_path = individuals / f"{rank}.png"
		if write:
			registered.save(output_path, optimize=True)
		else:
			if not output_path.is_file():
				raise FileNotFoundError(f"Missing registered frame: {output_path}")
			actual = Image.open(output_path).convert("RGBA")
			if actual.size != (width, height):
				raise ValueError(f"{rank.upper()} frame has the wrong canvas: {actual.size}")
			if ImageChops.difference(actual, registered).getbbox() is not None:
				raise ValueError(f"{rank.upper()} frame differs from deterministic registration")
		records.append(
			{
				"rank": rank.upper(),
				"source": str(source_path.relative_to(ROOT)),
				"sourceContentHash": sha256(source_path),
				"sourceApertureBounds": list(source_aperture),
				"output": str(output_path.relative_to(ROOT)),
			}
		)
	if not write:
		manifest_path = OUTPUT_ROOT / "manifest.json"
		manifest = json.loads(manifest_path.read_text())
		if manifest["geometryContentHash"] != sha256(GEOMETRY_PATH):
			raise ValueError("Registration manifest geometry hash is stale")
		for record in manifest["records"]:
			if record["sourceContentHash"] != sha256(ROOT / record["source"]):
				raise ValueError(f"{record['rank']} source hash is stale")
			if record["outputContentHash"] != sha256(ROOT / record["output"]):
				raise ValueError(f"{record['rank']} output hash is stale")
		for name in ("contact-sheet.png", "alpha-overlay.png", "recognition-96.png"):
			if not (review / name).is_file():
				raise FileNotFoundError(f"Missing review artifact: {review / name}")
		print("seven deterministic frame registrations and review artifacts pass")
		return
	for record in records:
		path = ROOT / record["output"]
		record["outputContentHash"] = sha256(path)
	contact_sheet(frames, review / "contact-sheet.png")
	overlay_sheet(frames, review / "alpha-overlay.png")
	recognition_sheet(frames, review / "recognition-96.png")
	manifest = {
		"schemaVersion": "skill-rarity-frame-registration-v1",
		"status": "candidate",
		"geometry": str(GEOMETRY_PATH.relative_to(ROOT)),
		"geometryContentHash": sha256(GEOMETRY_PATH),
		"canvas": {"width": width, "height": height, "mode": "RGBA"},
		"records": records,
	}
	(OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, indent="\t") + "\n")


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--write", action="store_true")
	parser.add_argument("--check", action="store_true")
	arguments = parser.parse_args()
	if arguments.write and arguments.check:
		parser.error("choose either --write or --check")
	build(arguments.write)


if __name__ == "__main__":
	main()
