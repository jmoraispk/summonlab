#!/usr/bin/env python3
"""Persist an image provider return exactly once, without post-processing it."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from contracts import CANVAS_HEIGHT, CANVAS_MIME_TYPE, CANVAS_WIDTH, ContractError, EXPERIMENT_ID, exclusive_write, sha256_file


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
ASSIGNMENT_SCHEMA = "five-head-chibi-assignment-v1"


@dataclass(frozen=True)
class PersistedCandidate:
    provider_source_path: Path
    candidate_path: Path
    sha256: str
    width: int
    height: int
    mime_type: str
    provider_source_status: str
    candidate_status: str


def _load_object(path: Path, label: str) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ContractError(f"{label} must be a regular file: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot read {label}: {error}") from error
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be a JSON object")
    return value


def load_assignment(assignment_path: Path) -> tuple[dict[str, Any], Path, Path]:
    """Load an assignment and derive its immutable experiment and workspace roots."""
    assignment_path = assignment_path.resolve(strict=True)
    assignment = _load_object(assignment_path, "assignment")
    if assignment.get("schemaVersion") != ASSIGNMENT_SCHEMA or assignment.get("experimentId") != EXPERIMENT_ID:
        raise ContractError("assignment has an unsupported schemaVersion or experimentId")
    experiment = next((parent for parent in (assignment_path.parent, *assignment_path.parents) if parent.name == EXPERIMENT_ID), None)
    if experiment is None or experiment.parent.name != "experiments" or experiment.parent.parent.name != "heroes" or experiment.parent.parent.parent.name != "assets":
        raise ContractError("assignment is not inside the experiment root")
    workspace = experiment.parent.parent.parent.parent
    wave_id, hero_id = assignment.get("waveId"), assignment.get("heroId")
    if not isinstance(wave_id, str) or not isinstance(hero_id, str) or not wave_id.startswith("wave-") or not hero_id:
        raise ContractError("assignment lacks waveId or heroId")
    expected_assignment = experiment / "waves" / wave_id / "assignments" / f"{hero_id}.json"
    if assignment_path != expected_assignment:
        raise ContractError("assignment path does not match its wave and hero")
    required = ("assignmentId", "targetId", "exclusiveOwner", "providerSourcePath", "candidatePath", "resultPath")
    if any(not isinstance(assignment.get(key), str) or not assignment[key] for key in required):
        raise ContractError("assignment is incomplete")
    if assignment["exclusiveOwner"] != assignment["assignmentId"]:
        raise ContractError("assignment exclusiveOwner must equal assignmentId")
    expected_prefix = f"assets/heroes/experiments/{EXPERIMENT_ID}/waves/{wave_id}/"
    expected_paths = {
        "providerSourcePath": expected_prefix + f"provider-sources/{hero_id}.png",
        "candidatePath": expected_prefix + f"candidates/{hero_id}.png",
        "resultPath": expected_prefix + f"results/{hero_id}.json",
    }
    if len({assignment[key] for key in expected_paths}) != len(expected_paths):
        raise ContractError("assignment output paths are not exclusive")
    if any(assignment[key] != expected for key, expected in expected_paths.items()):
        raise ContractError("assignment declares undeclared or cross-wave output paths")
    return assignment, experiment, workspace


def load_target(assignment: dict[str, Any], experiment: Path) -> tuple[dict[str, Any], Path]:
    path = experiment / "waves" / assignment["waveId"] / "targets" / f"{assignment['heroId']}.json"
    target = _load_object(path, "target")
    if target.get("schemaVersion") != "five-head-chibi-target-v1" or any(target.get(key) != assignment.get(key) for key in ("experimentId", "targetId", "heroId", "waveId")):
        raise ContractError("target does not bind to assignment")
    return target, path


def readable_png(data: bytes) -> tuple[int, int]:
    """Accept well-formed PNG bytes whose IDAT stream can be decompressed."""
    if not isinstance(data, bytes) or not data.startswith(PNG_SIGNATURE):
        raise ContractError("provider output is not a readable PNG")
    cursor, width, height, seen_ihdr, seen_iend = len(PNG_SIGNATURE), None, None, False, False
    compressed = bytearray()
    try:
        while cursor < len(data):
            if cursor + 12 > len(data):
                raise ValueError("truncated chunk")
            length = struct.unpack(">I", data[cursor:cursor + 4])[0]
            kind = data[cursor + 4:cursor + 8]
            end = cursor + 8 + length
            if end + 4 > len(data):
                raise ValueError("truncated payload")
            payload = data[cursor + 8:end]
            recorded_crc = struct.unpack(">I", data[end:end + 4])[0]
            if zlib.crc32(kind + payload) & 0xffffffff != recorded_crc:
                raise ValueError("bad CRC")
            if kind == b"IHDR":
                if seen_ihdr or length != 13:
                    raise ValueError("bad IHDR")
                width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
                if not width or not height or bit_depth not in (1, 2, 4, 8, 16) or color_type not in (0, 2, 3, 4, 6) or compression or filtering or interlace not in (0, 1):
                    raise ValueError("unsupported IHDR")
                seen_ihdr = True
            elif kind == b"IDAT":
                if not seen_ihdr or seen_iend:
                    raise ValueError("misplaced IDAT")
                compressed.extend(payload)
            elif kind == b"IEND":
                if length != 0:
                    raise ValueError("bad IEND")
                seen_iend = True
                if end + 4 != len(data):
                    raise ValueError("trailing bytes")
            cursor = end + 4
        if not seen_ihdr or not seen_iend or not compressed:
            raise ValueError("missing PNG chunks")
        zlib.decompress(bytes(compressed))
    except (ValueError, struct.error, zlib.error) as error:
        raise ContractError(f"provider output is not a readable PNG: {error}") from error
    assert width is not None and height is not None
    return width, height


def _preflight(path: Path, data: bytes) -> None:
    if path.exists() or path.is_symlink():
        if path.is_symlink() or not path.is_file():
            raise ContractError(f"occupied path is not a regular file: {path}")
        if path.read_bytes() != data:
            raise ContractError(f"occupied path has different bytes: {path}")


def persist_candidate(assignment_path: Path, source_path: Path) -> PersistedCandidate:
    """Copy a provider PNG byte-for-byte to its retained source and candidate paths."""
    assignment, _, workspace = load_assignment(assignment_path)
    if source_path.is_symlink() or not source_path.is_file():
        raise ContractError(f"provider source must be a regular file: {source_path}")
    try:
        payload = source_path.read_bytes()
    except OSError as error:
        raise ContractError(f"cannot read provider source: {error}") from error
    width, height = readable_png(payload)
    if (width, height) != (CANVAS_WIDTH, CANVAS_HEIGHT):
        raise ContractError(f"provider PNG must be exactly {CANVAS_WIDTH}x{CANVAS_HEIGHT}")
    provider_path = workspace / assignment["providerSourcePath"]
    candidate_path = workspace / assignment["candidatePath"]
    _preflight(provider_path, payload)
    _preflight(candidate_path, payload)
    provider_status = exclusive_write(provider_path, payload)
    candidate_status = exclusive_write(candidate_path, payload)
    return PersistedCandidate(provider_path, candidate_path, hashlib.sha256(payload).hexdigest(), width, height, CANVAS_MIME_TYPE, provider_status, candidate_status)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assignment", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    persisted = persist_candidate(args.assignment, args.source)
    print(json.dumps({"providerSourcePath": str(persisted.provider_source_path), "candidatePath": str(persisted.candidate_path), "sha256": persisted.sha256, "width": persisted.width, "height": persisted.height, "mimeType": persisted.mime_type, "providerSourceStatus": persisted.provider_source_status, "candidateStatus": persisted.candidate_status}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
