#!/usr/bin/env python3
"""Verify one temporary frameless skill-art result."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path

from validate_target import HASH_PATTERN, digest, load_json, relative_file, validate


def paeth(left: int, above: int, upper_left: int) -> int:
    estimate = left + above - upper_left
    left_distance = abs(estimate - left)
    above_distance = abs(estimate - above)
    diagonal_distance = abs(estimate - upper_left)
    if left_distance <= above_distance and left_distance <= diagonal_distance:
        return left
    if above_distance <= diagonal_distance:
        return above
    return upper_left


def png_geometry_and_alpha(path: Path) -> tuple[int, int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("candidate is not a PNG")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    if (bit_depth, color_type, compression, filtering, interlace) != (8, 6, 0, 0, 0):
        raise ValueError("candidate must be non-interlaced 8-bit RGBA PNG")

    chunks: list[bytes] = []
    offset = 8
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : offset + 8 + length]
        if kind == b"IDAT":
            chunks.append(payload)
        offset += 12 + length
    scanlines = zlib.decompress(b"".join(chunks))
    stride = width * 4
    if len(scanlines) != height * (stride + 1):
        raise ValueError("candidate has invalid RGBA scanline data")
    previous = bytearray(stride)
    any_visible = False
    for y in range(height):
        start = y * (stride + 1)
        filter_type = scanlines[start]
        encoded = scanlines[start + 1 : start + 1 + stride]
        decoded = bytearray(stride)
        for index, value in enumerate(encoded):
            left = decoded[index - 4] if index >= 4 else 0
            above = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                predictor = paeth(left, above, upper_left)
            else:
                raise ValueError("candidate uses an unsupported PNG filter")
            decoded[index] = (value + predictor) & 0xFF
        alphas = decoded[3::4]
        any_visible = any_visible or any(alpha > 0 for alpha in alphas)
        if y in (0, height - 1) and any(alpha != 0 for alpha in alphas):
            raise ValueError("candidate canvas boundary must be transparent")
        if alphas[0] != 0 or alphas[-1] != 0:
            raise ValueError("candidate canvas boundary must be transparent")
        previous = decoded
    if not any_visible:
        raise ValueError("candidate must contain visible artwork")
    return width, height, color_type


def verify(
    target_path: Path,
    assignment_path: Path,
    result_path: Path,
    workspace_root: Path,
    attempt_count: int,
) -> None:
    target, assignment = validate(
        target_path, assignment_path, workspace_root, require_outputs_absent=False
    )
    root = workspace_root.resolve()
    result = load_json(result_path)
    required = {
        "schemaVersion", "jobId", "targetId", "status", "promptHash", "referenceInputs",
        "candidate", "findings", "attemptCount", "noSharedFilesEdited", "selfPromoted"
    }
    if set(result) != required or result.get("schemaVersion") != "summonlab-skill-art-result-v1":
        raise ValueError("invalid frameless skill-art result")
    if result.get("jobId") != target["jobId"] or result.get("targetId") != target["targetId"]:
        raise ValueError("result identity mismatch")
    expected_prompt_hash = hashlib.sha256(target["exactPrompt"].encode("utf-8")).hexdigest()
    if result.get("promptHash") != expected_prompt_hash:
        raise ValueError("prompt hash mismatch")
    expected_references = [
        {"path": item["path"], "contentHash": item["contentHash"]}
        for item in target["references"]
    ]
    if result.get("referenceInputs") != expected_references:
        raise ValueError("reference inputs mismatch")
    if result.get("attemptCount") != attempt_count or not 1 <= attempt_count <= assignment["retryCeiling"] + 1:
        raise ValueError("attempt count exceeds assignment")
    if result.get("noSharedFilesEdited") is not True or result.get("selfPromoted") is not False:
        raise ValueError("result cannot claim shared edits or promotion")
    findings = result.get("findings")
    if not isinstance(findings, dict) or set(findings) != {"fullSize", "recognition96"}:
        raise ValueError("missing full-size or recognition findings")
    for finding in findings.values():
        if not isinstance(finding, dict) or finding.get("outcome") not in ("pass", "fail") or not finding.get("observation"):
            raise ValueError("invalid review finding")

    status = result.get("status")
    candidate = result.get("candidate")
    if status == "failed":
        if candidate is not None:
            raise ValueError("failed result cannot retain a candidate")
        return
    if status != "candidate" or not isinstance(candidate, dict):
        raise ValueError("invalid result status")
    if any(finding["outcome"] != "pass" for finding in findings.values()):
        raise ValueError("candidate requires passing findings")
    expected_path = assignment["candidatePath"]
    if candidate.get("path") != expected_path or candidate.get("alphaMode") != "rgba":
        raise ValueError("invalid candidate binding")
    candidate_path = relative_file(root, expected_path)
    width, height, _ = png_geometry_and_alpha(candidate_path)
    if width != 1024 or height != 1024 or candidate.get("width") != width or candidate.get("height") != height:
        raise ValueError("candidate must be 1024x1024")
    content_hash = candidate.get("contentHash")
    if not isinstance(content_hash, str) or not HASH_PATTERN.fullmatch(content_hash) or digest(candidate_path) != content_hash:
        raise ValueError("candidate hash mismatch")
    if candidate.get("bytes") != candidate_path.stat().st_size:
        raise ValueError("candidate byte count mismatch")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("assignment", type=Path)
    parser.add_argument("result", type=Path)
    parser.add_argument("workspace_root", type=Path)
    parser.add_argument("--attempt-count", required=True, type=int)
    args = parser.parse_args()
    verify(args.target, args.assignment, args.result, args.workspace_root, args.attempt_count)
    print(json.dumps({"valid": True}))


if __name__ == "__main__":
    main()
