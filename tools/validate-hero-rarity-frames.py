#!/usr/bin/env python3
"""Validate the canonical hero rarity-frame image library.

The validator intentionally has no dependency on the application runtime.  It
checks the small, stable contract that binds the approved visual source tree:
manifest shape, image geometry, hashes, checksums, and provenance.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


FAMILY_ORDER = ("legacy-neutral", "neutral", "fire", "water", "earth", "wind")
EXPECTED_RANKS = tuple(range(1, 8))
EXPECTED_SHEET = (2172, 724, "RGB")
EXPECTED_FRAME = (1024, 1536, "RGB")
WIND_RANK_7_SHA256 = "84c2ff9c3308cc3566b0efba94f20b7db12fb4abc9da3a6f48743d7a2b79c41b"
CANONICAL_PREFIX = "assets/heroes/visuals/rarity-frames/"
SOURCE_PATH_POLICY = "approved-source-paths-are-immutable-until-explicitly-superseded"
WIND_RANK_7_SOURCE_PATH = (
    "assets/heroes/visuals/rarity-frames-v4/candidates/individuals/wind/"
    "wind-rank-7-v2.png"
)
WIND_RANK_7_CANONICAL_PATH = CANONICAL_PREFIX + "families/wind/frames/rank-7.png"

EXPECTED_RELATIVE_PATHS = frozenset(
    [f"families/{family_id}/sheet.png" for family_id in FAMILY_ORDER]
    + [
        f"families/{family_id}/frames/rank-{rank}.png"
        for family_id in FAMILY_ORDER
        for rank in EXPECTED_RANKS
    ]
)
PROVIDER_FAMILIES = ("neutral", "fire", "water", "earth", "wind")
EXPECTED_GEOMETRY_OPENINGS = {
    "neutral": (510, 498, 497, 496, 464, 504, 448),
    "fire": (510, 498, 510, 488, 480, 490, 432),
    "water": (510, 498, 510, 451, 430, 474, 431),
    "earth": (510, 498, 496, 478, 460, 464, 430),
    "wind": (510, 498, 499, 479, 430, 430, 435),
}
EXPECTED_NORMALIZED_RANKS = {
    "neutral": (1,),
    "fire": (1, 3, 7),
    "water": (1, 3, 5, 7),
    "earth": (1, 7),
    "wind": (1, 5, 6),
}
SUPERSEDED_WIND_RANK_7_SHA256 = (
    "14c410353cc93c05d5449558222de5323cd2ea54327a7aef70ef3ae19d571356"
)

_VERSIONED_PATH = re.compile(r"-v[1-4](?:\.[^/]+|/|$)")
_PROVIDER_SOURCE = re.compile(
    r"exec-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png"
)
_SHA256 = re.compile(r"[0-9a-f]{64}")
_CANONICAL_FRAME_PATH = re.compile(r"families/([^/]+)/frames/rank-([1-7])\.png")


def _is_mapping(value: Any) -> bool:
    return isinstance(value, dict)


def validate_manifest_shape(manifest: dict) -> list[str]:
    """Return deterministic violations for the manifest's family contract."""

    errors: list[str] = []
    if not _is_mapping(manifest):
        return ["manifest must be an object"]

    if manifest.get("schema") != "summonlab-hero-rarity-frames":
        errors.append("schema must be summonlab-hero-rarity-frames")
    if manifest.get("status") != "approved-visual-source":
        errors.append("status must be approved-visual-source")
    if manifest.get("runtimeStatus") != "not-runtime-ready":
        errors.append("runtimeStatus must be not-runtime-ready")
    if manifest.get("preferredStartingFamily") != "legacy-neutral":
        errors.append("preferredStartingFamily must be legacy-neutral")
    if manifest.get("assetCount") != 48:
        errors.append("assetCount must be 48")
    if manifest.get("sourcePathPolicy") != SOURCE_PATH_POLICY:
        errors.append(
            "sourcePathPolicy must keep approved source paths immutable until explicitly superseded"
        )
    if manifest.get("activeWindRank7SourcePath") != WIND_RANK_7_SOURCE_PATH:
        errors.append(f"activeWindRank7SourcePath must be {WIND_RANK_7_SOURCE_PATH}")
    if manifest.get("activeWindRank7CanonicalPath") != WIND_RANK_7_CANONICAL_PATH:
        errors.append(f"activeWindRank7CanonicalPath must be {WIND_RANK_7_CANONICAL_PATH}")
    if manifest.get("activeWindRank7Sha256") != WIND_RANK_7_SHA256:
        errors.append(f"activeWindRank7Sha256 must be {WIND_RANK_7_SHA256}")

    family_order = manifest.get("familyOrder")
    if family_order != list(FAMILY_ORDER):
        errors.append("familyOrder must be legacy-neutral, neutral, fire, water, earth, wind")

    families = manifest.get("families")
    if not isinstance(families, list):
        errors.append("families must be a list")
        return errors
    if len(families) != len(FAMILY_ORDER):
        errors.append("families must contain exactly six records")

    ids = [family.get("id") for family in families if _is_mapping(family)]
    if any(ids.count(family_id) > 1 for family_id in ids):
        errors.append("family IDs must be unique")

    by_id: dict[str, dict] = {}
    for family in families:
        if not _is_mapping(family):
            errors.append("each family must be an object")
            continue
        family_id = family.get("id")
        if isinstance(family_id, str) and family_id in FAMILY_ORDER and family_id not in by_id:
            by_id[family_id] = family

    for family_id in FAMILY_ORDER:
        family = by_id.get(family_id)
        if family is None:
            errors.append(f"missing family {family_id}")
            continue

        frames = family.get("frames")
        if not isinstance(frames, list):
            errors.append(f"{family_id} must contain frames as a list")
            ranks = []
        else:
            if len(frames) != len(EXPECTED_RANKS):
                errors.append(f"{family_id} must contain exactly seven frame records")
            ranks = []
            for frame in frames:
                if not _is_mapping(frame):
                    errors.append(f"{family_id} frame entries must be objects")
                    continue
                rank = frame.get("rank")
                if not isinstance(rank, int) or isinstance(rank, bool) or rank not in EXPECTED_RANKS:
                    errors.append(f"{family_id} frame entries must have ranks 1 through 7")
                else:
                    ranks.append(rank)
                if not isinstance(frame.get("path"), str) or not frame.get("path"):
                    errors.append(f"{family_id} frame entries must include path")
                if not isinstance(frame.get("sourcePath"), str) or not frame.get("sourcePath"):
                    errors.append(f"{family_id} rank {rank} must include sourcePath")
                if not isinstance(frame.get("sourcePacket"), str) or not frame.get("sourcePacket"):
                    errors.append(f"{family_id} rank {rank} must include sourcePacket")
        valid_ranks = [rank for rank in ranks if isinstance(rank, int) and not isinstance(rank, bool)]
        if len(valid_ranks) != len(EXPECTED_RANKS) or set(valid_ranks) != set(EXPECTED_RANKS):
            errors.append(f"{family_id} must contain ranks 1 through 7 exactly once")
        sheet = family.get("sheet")
        if not _is_mapping(sheet):
            errors.append(f"{family_id} must contain one sheet record")
        else:
            if not isinstance(sheet.get("path"), str) or not sheet.get("path"):
                errors.append(f"{family_id} sheet must include path")
            if not isinstance(sheet.get("sourcePath"), str) or not sheet.get("sourcePath"):
                errors.append(f"{family_id} sheet must include sourcePath")
            if not isinstance(sheet.get("sourcePacket"), str) or not sheet.get("sourcePacket"):
                errors.append(f"{family_id} sheet must include sourcePacket")

    unknown_ids = sorted({family_id for family_id in ids if isinstance(family_id, str) and family_id not in FAMILY_ORDER})
    for family_id in unknown_ids:
        errors.append(f"unexpected family {family_id}")
    return errors


def _manifest_images(manifest: dict) -> list[tuple[str, dict, str, int | None]]:
    """Collect (path, image-record, family-id, rank) entries in manifest order."""

    result: list[tuple[str, dict, str, int | None]] = []
    families = manifest.get("families", []) if isinstance(manifest, dict) else []
    if not isinstance(families, list):
        return result
    for family in families:
        if not _is_mapping(family):
            continue
        family_id = family.get("id")
        sheet = family.get("sheet")
        if _is_mapping(sheet) and isinstance(sheet.get("path"), str):
            result.append((sheet["path"], sheet, str(family_id), None))
        frames = family.get("frames")
        if isinstance(frames, list):
            for frame in frames:
                if _is_mapping(frame) and isinstance(frame.get("path"), str):
                    rank = frame.get("rank") if isinstance(frame.get("rank"), int) else None
                    result.append((frame["path"], frame, str(family_id), rank))
    return result


def _relative_path(path: str, root: Path) -> Path | None:
    """Resolve either root-relative or repository-relative canonical paths."""

    path = path.replace("\\", "/")
    root_name = "assets/heroes/visuals/rarity-frames/"
    if path.startswith(root_name):
        path = path[len(root_name) :]
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        return None
    return candidate


def _approved_path_error(path: str) -> str | None:
    normalized = path.replace("\\", "/")
    if "/candidates/" in f"/{normalized}/" or normalized.startswith("candidates/"):
        return f"approved path may not contain /candidates/: {path}"
    if _VERSIONED_PATH.search(normalized):
        return f"approved path may not contain version suffix -v1 through -v4: {path}"
    return None


def _read_json(path: Path, label: str, errors: list[str]) -> Any:
    if not path.is_file():
        errors.append(f"missing {label}")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        errors.append(f"invalid {label}: {exc}")
        return None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _source_records(source_map: Any) -> list[dict]:
    if isinstance(source_map, list):
        return [record for record in source_map if isinstance(record, dict)]
    if not isinstance(source_map, dict):
        return []
    for key in ("records", "images", "assets"):
        value = source_map.get(key)
        if isinstance(value, list):
            return [record for record in value if isinstance(record, dict)]
    # Also accept a path-keyed map, while preserving deterministic insertion order.
    values: list[dict] = []
    for key, value in source_map.items():
        if isinstance(value, dict):
            record = dict(value)
            record.setdefault("canonicalPath", key)
            values.append(record)
    return values


def _parse_checksums(path: Path, errors: list[str]) -> dict[str, str]:
    if not path.is_file():
        errors.append("missing checksums.sha256")
        return {}
    checksums: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        errors.append(f"invalid checksums.sha256: {exc}")
        return {}
    for line_number, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = stripped.split(None, 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]):
            errors.append(f"invalid checksum record on line {line_number}")
            continue
        checksum, checksum_path = parts
        checksum_path = checksum_path.lstrip("*")
        if checksum_path in checksums:
            errors.append(f"duplicate checksum path: {checksum_path}")
        checksums[checksum_path] = checksum.lower()
    return checksums


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and _SHA256.fullmatch(value) is not None


def _provider_source_valid(value: Any) -> bool:
    return isinstance(value, str) and _PROVIDER_SOURCE.fullmatch(value) is not None


def _source_suffix(source_path: Any, packet: str) -> str | None:
    if not isinstance(source_path, str):
        return None
    prefix = f"assets/heroes/visuals/{packet}/"
    if not source_path.startswith(prefix):
        return None
    return source_path[len(prefix) :]


def _validate_provider_provenance(
    provider_map: Any,
    source_by_relative_path: dict[str, dict],
) -> list[str]:
    """Validate retained v4 provider identifiers against canonical source records."""

    errors: list[str] = []
    if not _is_mapping(provider_map):
        return ["provenance/provider-source-map.json must be an object"]
    if provider_map.get("status") != "approved-visual-source":
        errors.append("provider provenance status must be approved-visual-source")

    sheet = provider_map.get("sheet")
    neutral_sheet = source_by_relative_path.get("families/neutral/sheet.png")
    if not _is_mapping(sheet):
        errors.append("provider provenance must include sheet")
    else:
        if not _provider_source_valid(sheet.get("provider_source")):
            errors.append("provider sheet must include provider_source")
        retained_path = sheet.get("retained_path")
        if not isinstance(retained_path, str):
            errors.append("provider sheet must include retained_path")
        elif neutral_sheet is not None:
            source_suffix = _source_suffix(neutral_sheet.get("sourcePath"), "rarity-frames-v4")
            if retained_path != source_suffix:
                errors.append("provider sheet retained_path must match the neutral sheet source")
        if not isinstance(sheet.get("exact_prompt"), str):
            errors.append("provider sheet must include exact_prompt")

    individuals = provider_map.get("individuals")
    if not _is_mapping(individuals):
        return errors + ["provider provenance must include individuals"]
    actual_families = {key for key, value in individuals.items() if _is_mapping(value)}
    if actual_families != set(PROVIDER_FAMILIES):
        errors.append("provider provenance must contain neutral, fire, water, earth, and wind")

    for family_id in PROVIDER_FAMILIES:
        family = individuals.get(family_id)
        if not _is_mapping(family):
            continue
        if family_id == "wind" and not isinstance(family.get("runtime_submission_template"), str):
            errors.append("provider wind must include runtime_submission_template")
        for rank in EXPECTED_RANKS:
            entry = family.get(str(rank))
            label = f"provider {family_id} rank {rank}"
            if not _is_mapping(entry):
                errors.append(f"{label} must be an object")
                continue
            canonical = f"families/{family_id}/frames/rank-{rank}.png"
            source = source_by_relative_path.get(canonical)
            if family_id != "neutral" and rank <= 2:
                if entry.get("shared_from") != f"neutral/{rank}":
                    errors.append(f"{label} must share from neutral/{rank}")
                if source is not None and source.get("inheritedFrom") != "neutral":
                    errors.append(f"{label} must match source-map inheritance")
                continue
            if not _provider_source_valid(entry.get("provider_source")):
                errors.append(f"{label} must include provider_source")
            if not isinstance(entry.get("prompt"), str):
                errors.append(f"{label} must include prompt")
            if source is not None and source.get("sourcePacket") != "rarity-frames-v4":
                errors.append(f"{label} must map to a rarity-frames-v4 source")

    wind = individuals.get("wind")
    wind_7 = wind.get("7") if _is_mapping(wind) else None
    wind_source = source_by_relative_path.get("families/wind/frames/rank-7.png")
    if _is_mapping(wind_7):
        if wind_7.get("retained_path") != "candidates/individuals/wind/wind-rank-7-v2.png":
            errors.append("provider wind rank 7 retained_path must select v2")
        if wind_source is not None and wind_7.get("sha256") != wind_source.get("canonicalSha256"):
            errors.append("provider wind rank 7 sha256 must match the canonical source map")
        if not _is_sha256(wind_7.get("prompt_sha256")):
            errors.append("provider wind rank 7 must include prompt_sha256")
        supersedes = wind_7.get("supersedes")
        if not _is_mapping(supersedes):
            errors.append("provider wind rank 7 must include supersedes")
        else:
            if not _provider_source_valid(supersedes.get("provider_source")):
                errors.append("provider wind rank 7 supersedes must include provider_source")
            if not isinstance(supersedes.get("prompt"), str):
                errors.append("provider wind rank 7 supersedes must include prompt")
            if not isinstance(supersedes.get("retained_path"), str):
                errors.append("provider wind rank 7 supersedes must include retained_path")
            reason = supersedes.get("reason")
            if not isinstance(reason, str) or "outward" not in reason:
                errors.append("provider wind rank 7 supersedes must record the outward-facing reason")
    return errors


def _geometry_filename(family_id: str, rank: int) -> str:
    version = 2 if family_id == "wind" and rank == 7 else 1
    return f"{family_id}-rank-{rank}-v{version}.png"


def _validate_geometry_provenance(
    geometry_report: Any,
    source_by_relative_path: dict[str, dict],
) -> list[str]:
    """Validate measured v4 openings and normalization hashes."""

    errors: list[str] = []
    if not _is_mapping(geometry_report):
        return ["provenance/geometry-report.json must be an object"]
    if not isinstance(geometry_report.get("method"), str):
        errors.append("geometry provenance must include method")
    if geometry_report.get("canvas") != "1024x1536 RGB":
        errors.append("geometry provenance canvas must be 1024x1536 RGB")
    if geometry_report.get("allowed_family_ratio") != 1.2:
        errors.append("geometry provenance allowed_family_ratio must be 1.2")
    if geometry_report.get("normalization_band_px") != [430, 510]:
        errors.append("geometry provenance normalization_band_px must be 430 through 510")

    families = geometry_report.get("families")
    if not _is_mapping(families):
        return errors + ["geometry provenance must include families"]
    if set(families) != set(PROVIDER_FAMILIES):
        errors.append("geometry provenance must contain neutral, fire, water, earth, and wind")

    for family_id in PROVIDER_FAMILIES:
        family = families.get(family_id)
        if not _is_mapping(family):
            continue
        expected_openings = {
            _geometry_filename(family_id, rank): width
            for rank, width in zip(EXPECTED_RANKS, EXPECTED_GEOMETRY_OPENINGS[family_id])
        }
        openings = family.get("openings_px")
        if openings != expected_openings:
            errors.append(f"geometry {family_id} openings must match the retained measurements")
        else:
            narrowest = min(expected_openings.values())
            widest = max(expected_openings.values())
            if family.get("narrowest_px") != narrowest:
                errors.append(f"geometry {family_id} narrowest_px must be {narrowest}")
            if family.get("widest_px") != widest:
                errors.append(f"geometry {family_id} widest_px must be {widest}")
            if family.get("ratio") != round(widest / narrowest, 6):
                errors.append(f"geometry {family_id} ratio must match measured openings")
            if family.get("variation_percent") != round((widest / narrowest - 1) * 100, 2):
                errors.append(f"geometry {family_id} variation_percent must match measured openings")
            if family.get("passes_20_percent_cap") is not True:
                errors.append(f"geometry {family_id} must pass the 20 percent cap")

        normalizations = family.get("whole_frame_normalizations")
        if not _is_mapping(normalizations):
            errors.append(f"geometry {family_id} must include whole_frame_normalizations")
            continue
        expected_names = {
            f"{family_id}-rank-{rank}-v1.png"
            for rank in EXPECTED_NORMALIZED_RANKS[family_id]
        }
        if set(normalizations) != expected_names:
            errors.append(f"geometry {family_id} normalization records must match retained history")
        for filename, normalization in normalizations.items():
            match = re.fullmatch(rf"{re.escape(family_id)}-rank-([1-7])-v1\.png", filename)
            if match is None or not _is_mapping(normalization):
                errors.append(f"geometry {family_id} has malformed normalization {filename}")
                continue
            rank = int(match.group(1))
            canonical = f"families/{family_id}/frames/rank-{rank}.png"
            source = source_by_relative_path.get(canonical)
            if not isinstance(normalization.get("provider_source"), str):
                errors.append(f"geometry normalization {filename} must include provider_source")
            if not _is_sha256(normalization.get("provider_sha256")):
                errors.append(f"geometry normalization {filename} must include provider_sha256")
            if not isinstance(normalization.get("scale_x"), (int, float)):
                errors.append(f"geometry normalization {filename} must include scale_x")
            if not isinstance(normalization.get("requested_opening_px"), int):
                errors.append(f"geometry normalization {filename} must include requested_opening_px")
            if not isinstance(normalization.get("before_opening_px"), int):
                errors.append(f"geometry normalization {filename} must include before_opening_px")
            if source is not None and normalization.get("normalized_sha256") != source.get(
                "canonicalSha256"
            ):
                errors.append(f"geometry normalization hash mismatch: {filename}")

    wind = families.get("wind")
    superseded_candidates = wind.get("superseded_candidates") if _is_mapping(wind) else None
    superseded = (
        superseded_candidates.get("wind-rank-7-v1.png")
        if _is_mapping(superseded_candidates)
        else None
    )
    if not _is_mapping(superseded):
        errors.append("geometry wind must retain the superseded rank 7 v1 record")
    else:
        if superseded.get("normalized_sha256") != SUPERSEDED_WIND_RANK_7_SHA256:
            errors.append("geometry wind rank 7 v1 must retain its normalized hash")
        if superseded.get("active_replacement") != (
            "candidates/individuals/wind/wind-rank-7-v2.png"
        ):
            errors.append("geometry wind rank 7 v1 must point to the active v2 replacement")
        reason = superseded.get("reason")
        if not isinstance(reason, str) or "outward" not in reason or "inward" not in reason:
            errors.append("geometry wind rank 7 v1 must retain the facing-direction rationale")
        if not _is_sha256(superseded.get("provider_sha256")):
            errors.append("geometry wind rank 7 v1 must include provider_sha256")
    return errors


def validate_library(root: Path) -> list[str]:
    """Validate a canonical rarity-frame tree and return all violations."""

    errors: list[str] = []
    root = Path(root)
    manifest = _read_json(root / "manifest.json", "manifest.json", errors)
    source_map = _read_json(root / "provenance" / "source-map.json", "provenance/source-map.json", errors)
    provider_map = _read_json(
        root / "provenance" / "provider-source-map.json",
        "provenance/provider-source-map.json",
        errors,
    )
    geometry_report = _read_json(
        root / "provenance" / "geometry-report.json",
        "provenance/geometry-report.json",
        errors,
    )
    checksums = _parse_checksums(root / "checksums.sha256", errors)

    if isinstance(manifest, dict):
        errors.extend(validate_manifest_shape(manifest))
    else:
        # Avoid a long, misleading cascade after a missing or malformed manifest.
        return errors

    manifest_images = _manifest_images(manifest)
    manifest_paths = [path for path, _, _, _ in manifest_images]
    if len(manifest_images) != 48:
        errors.append(f"manifest must contain exactly 48 image paths (found {len(manifest_images)})")
    if len(set(manifest_paths)) != len(manifest_paths):
        errors.append("manifest image paths must be unique")

    manifest_relative_paths: set[str] = set()
    manifest_by_relative_path: dict[str, dict] = {}
    for path, record, family_id, rank in manifest_images:
        rel = _relative_path(path, root)
        if rel is None:
            errors.append(f"manifest path must be relative: {path}")
            continue
        canonical = rel.as_posix()
        manifest_relative_paths.add(canonical)
        manifest_by_relative_path.setdefault(canonical, record)
        path_error = _approved_path_error(path)
        if path_error:
            errors.append(path_error)
        image_path = root / rel
        expected_shape = EXPECTED_SHEET if rank is None else EXPECTED_FRAME
        if not image_path.is_file():
            errors.append(f"missing image: {path}")
            continue
        try:
            with Image.open(image_path) as image:
                image.load()
                actual_shape = (image.width, image.height, image.mode)
                actual_format = image.format
        except (OSError, ValueError) as exc:
            errors.append(f"invalid PNG {path}: {exc}")
            continue
        if actual_format != "PNG":
            errors.append(f"image must use PNG encoding: {path}")
        if actual_shape != expected_shape:
            errors.append(f"{path} must be {expected_shape[0]}x{expected_shape[1]} {expected_shape[2]}")
        for key, expected in zip(("width", "height", "mode"), expected_shape):
            if key not in record:
                errors.append(f"manifest {path} must include {key}")
            elif record.get(key) != expected:
                errors.append(f"manifest {path} {key} must be {expected}")
        try:
            actual_hash = _sha256(image_path)
        except OSError as exc:
            errors.append(f"unable to hash {path}: {exc}")
            continue
        expected_hash = record.get("sha256")
        if not isinstance(expected_hash, str):
            errors.append(f"manifest {path} must include sha256")
        elif expected_hash.lower() != actual_hash:
            errors.append(f"manifest hash mismatch: {path}")
        if family_id == "wind" and rank == 7 and expected_hash != WIND_RANK_7_SHA256:
            errors.append(f"wind rank 7 sha256 must be {WIND_RANK_7_SHA256}")

    if manifest_relative_paths != EXPECTED_RELATIVE_PATHS:
        errors.append("manifest image paths must match exact canonical path set")

    families_root = root / "families"
    if not families_root.is_dir():
        errors.append("missing families directory")
        filesystem_family_ids: set[str] = set()
        filesystem_png_paths: set[str] = set()
    else:
        filesystem_family_ids = {
            path.name for path in families_root.iterdir() if path.is_dir()
        }
        filesystem_png_paths = {
            path.relative_to(root).as_posix()
            for path in families_root.rglob("*.png")
            if path.is_file()
        }
    unexpected_families = sorted(filesystem_family_ids - set(FAMILY_ORDER))
    missing_families = sorted(set(FAMILY_ORDER) - filesystem_family_ids)
    if unexpected_families:
        errors.append(
            "families tree has unexpected family directories: " + ", ".join(unexpected_families)
        )
    if missing_families:
        errors.append("families tree is missing family directories: " + ", ".join(missing_families))
    if filesystem_png_paths != EXPECTED_RELATIVE_PATHS:
        errors.append("families tree PNG paths must match exact canonical path set")

    records = _source_records(source_map)
    if len(records) != 48:
        errors.append(f"source map must contain exactly 48 records (found {len(records)})")
    source_canonical_paths: list[str] = []
    source_paths: list[str] = []
    source_by_relative_path: dict[str, dict] = {}
    for record in records:
        canonical_path = record.get("canonicalPath")
        if not isinstance(canonical_path, str):
            errors.append("source map record must include canonicalPath")
            continue
        canonical_rel = _relative_path(canonical_path, root)
        canonical = canonical_rel.as_posix() if canonical_rel is not None else canonical_path
        source_canonical_paths.append(canonical)
        source_by_relative_path.setdefault(canonical, record)
        source_path = record.get("sourcePath")
        if isinstance(source_path, str):
            source_paths.append(source_path)
        else:
            errors.append(f"source map record {canonical_path} must include sourcePath")
        if not isinstance(record.get("sourcePacket"), str):
            errors.append(f"source map record {canonical_path} must include sourcePacket")
        if not isinstance(record.get("sourceSha256"), str):
            errors.append(f"source map record {canonical_path} must include sourceSha256")
        if not isinstance(record.get("canonicalSha256"), str):
            errors.append(f"source map record {canonical_path} must include canonicalSha256")
        elif canonical in manifest_by_relative_path:
            manifest_record = manifest_by_relative_path[canonical]
            if record["canonicalSha256"].lower() != str(manifest_record.get("sha256", "")).lower():
                errors.append(f"source map canonical hash mismatch: {canonical_path}")
            if (
                record.get("sourcePath") != manifest_record.get("sourcePath")
                or record.get("sourcePacket") != manifest_record.get("sourcePacket")
            ):
                errors.append(f"manifest source identity mismatch: {canonical_path}")
        if isinstance(record.get("sourceSha256"), str) and isinstance(record.get("canonicalSha256"), str):
            if record["sourceSha256"].lower() != record["canonicalSha256"].lower():
                errors.append(f"source map source hash mismatch: {canonical_path}")
        if record.get("transformation") != "byte-identical-copy":
            errors.append(f"source map record {canonical_path} must be byte-identical-copy")
        prompt_path = record.get("promptPath")
        inherited_from = record.get("inheritedFrom")
        if not isinstance(prompt_path, str) and not isinstance(inherited_from, str):
            errors.append(f"source map record {canonical_path} must include promptPath or inheritedFrom")
        if isinstance(prompt_path, str):
            prompt_rel = _relative_path(prompt_path, root)
            if prompt_rel is None or not prompt_rel.as_posix().startswith("provenance/prompts/"):
                errors.append(f"source map prompt must use a canonical prompt path: {prompt_path}")
            elif not (root / prompt_rel).is_file():
                errors.append(f"missing prompt: {prompt_path}")
        path_error = _approved_path_error(canonical_path)
        if path_error:
            errors.append(path_error)

    for canonical, record in source_by_relative_path.items():
        inherited_from = record.get("inheritedFrom")
        if not isinstance(inherited_from, str):
            continue
        match = _CANONICAL_FRAME_PATH.fullmatch(canonical)
        rank = int(match.group(2)) if match is not None else None
        neutral_path = f"families/neutral/frames/rank-{rank}.png" if rank is not None else None
        neutral_record = source_by_relative_path.get(neutral_path) if neutral_path is not None else None
        if inherited_from != "neutral" or neutral_record is None:
            canonical_path = record.get("canonicalPath", canonical)
            errors.append(
                f"inherited source map record must resolve to neutral rank {rank}: {canonical_path}"
            )
            continue
        if (
            record.get("sourceSha256") != neutral_record.get("sourceSha256")
            or record.get("canonicalSha256") != neutral_record.get("canonicalSha256")
        ):
            errors.append(f"inherited source map hash mismatch: {record.get('canonicalPath', canonical)}")

    if len(source_canonical_paths) != len(set(source_canonical_paths)):
        errors.append("source map canonical paths must be unique")
    if len(source_paths) != len(set(source_paths)):
        errors.append("source map source paths must be unique")
    if set(source_canonical_paths) != EXPECTED_RELATIVE_PATHS:
        errors.append("source map canonical paths must match exact canonical path set")
    if set(source_canonical_paths) != manifest_relative_paths:
        errors.append("source map canonical paths must match manifest image paths")

    wind_source = source_by_relative_path.get("families/wind/frames/rank-7.png")
    wind_manifest = manifest_by_relative_path.get("families/wind/frames/rank-7.png")
    if wind_source is None or wind_manifest is None:
        errors.append("active Wind rank 7 must resolve to its canonical record")
    else:
        if wind_source.get("sourcePath") != WIND_RANK_7_SOURCE_PATH:
            errors.append("active Wind rank 7 source map record must select the v2 source")
        if wind_source.get("canonicalSha256") != WIND_RANK_7_SHA256:
            errors.append("active Wind rank 7 source map record must use the approved hash")
        if wind_manifest.get("sha256") != WIND_RANK_7_SHA256:
            errors.append("active Wind rank 7 manifest record must use the approved hash")

    if provider_map is not None:
        errors.extend(_validate_provider_provenance(provider_map, source_by_relative_path))
    if geometry_report is not None:
        errors.extend(_validate_geometry_provenance(geometry_report, source_by_relative_path))

    if len(checksums) != 48:
        errors.append(f"checksums.sha256 must contain exactly 48 unique paths (found {len(checksums)})")
    checksum_paths: set[str] = set()
    for checksum_path, expected_hash in checksums.items():
        rel = _relative_path(checksum_path, root)
        if rel is None:
            errors.append(f"checksum path must be relative: {checksum_path}")
            continue
        canonical = rel.as_posix()
        checksum_paths.add(canonical)
        image_path = root / rel
        if not image_path.is_file():
            errors.append(f"missing checksum image: {checksum_path}")
            continue
        try:
            actual_hash = _sha256(image_path)
        except OSError as exc:
            errors.append(f"unable to hash {checksum_path}: {exc}")
            continue
        if actual_hash != expected_hash:
            errors.append(f"checksum mismatch: {checksum_path}")
    if checksum_paths != EXPECTED_RELATIVE_PATHS:
        errors.append("checksum paths must match exact canonical path set")
    if checksum_paths != manifest_relative_paths:
        errors.append("checksum paths must match manifest image paths")

    return errors


def main(argv: Iterable[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 1:
        print("usage: validate-hero-rarity-frames.py CANONICAL_ROOT")
        return 2
    errors = validate_library(Path(args[0]))
    if errors:
        for error in errors:
            print(error)
        return 1
    print("PASS hero rarity frames: 6 families, 6 sheets, 42 frames, 48 hashes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
