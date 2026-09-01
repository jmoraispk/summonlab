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

_VERSIONED_PATH = re.compile(r"-v[1-4](?:\.[^/]+|/|$)")


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
        ranks = [frame.get("rank") for frame in frames if _is_mapping(frame)] if isinstance(frames, list) else []
        valid_ranks = [rank for rank in ranks if isinstance(rank, int) and not isinstance(rank, bool)]
        if len(valid_ranks) != len(EXPECTED_RANKS) or set(valid_ranks) != set(EXPECTED_RANKS):
            errors.append(f"{family_id} must contain ranks 1 through 7 exactly once")
        if not _is_mapping(family.get("sheet")):
            errors.append(f"{family_id} must contain one sheet record")
        if not isinstance(frames, list):
            errors.append(f"{family_id} must contain frames as a list")

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


def validate_library(root: Path) -> list[str]:
    """Validate a canonical rarity-frame tree and return all violations."""

    errors: list[str] = []
    root = Path(root)
    manifest = _read_json(root / "manifest.json", "manifest.json", errors)
    source_map = _read_json(root / "provenance" / "source-map.json", "provenance/source-map.json", errors)
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

    expected_paths: set[str] = set()
    for path, record, family_id, rank in manifest_images:
        rel = _relative_path(path, root)
        if rel is None:
            errors.append(f"manifest path must be relative: {path}")
            continue
        canonical = rel.as_posix()
        expected_paths.add(canonical)
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
        except (OSError, ValueError) as exc:
            errors.append(f"invalid PNG {path}: {exc}")
            continue
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

    records = _source_records(source_map)
    if len(records) != 48:
        errors.append(f"source map must contain exactly 48 records (found {len(records)})")
    source_canonical_paths: list[str] = []
    source_paths: list[str] = []
    for record in records:
        canonical_path = record.get("canonicalPath")
        if not isinstance(canonical_path, str):
            errors.append("source map record must include canonicalPath")
            continue
        canonical_rel = _relative_path(canonical_path, root)
        canonical = canonical_rel.as_posix() if canonical_rel is not None else canonical_path
        source_canonical_paths.append(canonical)
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
        elif canonical in expected_paths:
            manifest_record = next(
                item[1]
                for item in manifest_images
                if _relative_path(item[0], root) is not None
                and _relative_path(item[0], root).as_posix() == canonical
            )
            if record["canonicalSha256"].lower() != str(manifest_record.get("sha256", "")).lower():
                errors.append(f"source map canonical hash mismatch: {canonical_path}")
        if isinstance(record.get("sourceSha256"), str) and isinstance(record.get("canonicalSha256"), str):
            if record["sourceSha256"].lower() != record["canonicalSha256"].lower():
                errors.append(f"source map source hash mismatch: {canonical_path}")
        if record.get("transformation") != "byte-identical-copy":
            errors.append(f"source map record {canonical_path} must be byte-identical-copy")
        if not isinstance(record.get("promptPath"), str) and not isinstance(record.get("inheritedFrom"), str):
            errors.append(f"source map record {canonical_path} must include promptPath or inheritedFrom")
        path_error = _approved_path_error(canonical_path)
        if path_error:
            errors.append(path_error)
    if len(source_canonical_paths) != len(set(source_canonical_paths)):
        errors.append("source map canonical paths must be unique")
    if len(source_paths) != len(set(source_paths)):
        errors.append("source map source paths must be unique")
    if set(source_canonical_paths) != expected_paths:
        errors.append("source map canonical paths must match manifest image paths")

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
    if checksum_paths != expected_paths:
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
