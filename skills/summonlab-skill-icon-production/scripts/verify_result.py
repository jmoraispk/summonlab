#!/usr/bin/env python3
"""Verify one retained skill-icon candidate and its structured result."""

from __future__ import annotations

import argparse
import hashlib
import json
import stat
import struct
import subprocess
import zlib
from pathlib import Path
from typing import Any

from validate_target import (
    _path_argument,
    absolute_project_path,
    fail,
    load_json,
    run_contract_validation,
    validate,
)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def inspect_rgba_png(path: Path) -> dict[str, Any]:
    metadata = path.lstat()
    if stat.S_ISLNK(metadata.st_mode):
        fail("candidate path cannot be a symbolic link")
    if not stat.S_ISREG(metadata.st_mode):
        fail("candidate path must be a regular file")
    data = path.read_bytes()
    if len(data) < 57 or not data.startswith(PNG_SIGNATURE):
        fail("retained candidate is not a PNG")
    offset = len(PNG_SIGNATURE)
    ihdr: bytes | None = None
    compressed = bytearray()
    seen_iend = False
    while offset < len(data):
        if offset + 12 > len(data):
            fail("retained candidate has a truncated PNG chunk")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            fail("retained candidate has a truncated PNG payload")
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack(">I", data[offset + 8 + length : end])[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            fail("retained candidate has an invalid PNG checksum")
        if ihdr is None:
            if kind != b"IHDR" or length != 13:
                fail("retained candidate has an invalid PNG header")
            ihdr = payload
        elif kind == b"IHDR":
            fail("retained candidate has multiple PNG headers")
        if kind == b"IDAT":
            compressed.extend(payload)
        if kind == b"IEND":
            if length != 0 or end != len(data):
                fail("retained candidate has an invalid PNG terminator")
            seen_iend = True
            break
        offset = end
    if ihdr is None or not compressed or not seen_iend:
        fail("retained candidate is an incomplete PNG")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", ihdr
    )
    if (width, height) != (1024, 1024):
        fail("retained candidate must be exactly 1024x1024")
    if (
        bit_depth != 8
        or color_type != 6
        or compression != 0
        or filtering != 0
        or interlace != 0
    ):
        fail("retained candidate must be an 8-bit, non-interlaced RGBA PNG")
    expected_raw_bytes = height * (1 + width * 4)
    decompressor = zlib.decompressobj()
    try:
        raw = decompressor.decompress(bytes(compressed), expected_raw_bytes + 1)
        raw += decompressor.flush()
    except zlib.error as error:
        fail(f"retained candidate PNG pixels cannot be decoded: {error}")
    if not decompressor.eof or len(raw) != expected_raw_bytes:
        fail("retained candidate PNG pixel payload has an invalid length")
    if any(raw[row * (1 + width * 4)] > 4 for row in range(height)):
        fail("retained candidate PNG uses an unsupported row filter")
    return {
        "path": path,
        "mediaType": "image/png",
        "width": width,
        "height": height,
        "bytes": len(data),
        "alphaMode": "rgba",
        "contentHash": hashlib.sha256(data).hexdigest(),
    }


def _changed_repository_paths(workspace: Path) -> set[str]:
    completed = subprocess.run(
        ["git", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=no"],
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        fail(
            "cannot audit changed repository paths: "
            + completed.stderr.decode("utf-8", errors="replace").strip()
        )
    changed: set[str] = set()
    entries = completed.stdout.split(b"\0")
    index = 0
    while index < len(entries):
        entry = entries[index]
        index += 1
        if not entry:
            continue
        if len(entry) < 4:
            fail("cannot parse git status for output ownership audit")
        status_code = entry[:2]
        changed.add(entry[3:].decode("utf-8", errors="strict"))
        if b"R" in status_code or b"C" in status_code:
            if index >= len(entries) or not entries[index]:
                fail("cannot parse renamed path in output ownership audit")
            changed.add(entries[index].decode("utf-8", errors="strict"))
            index += 1
    return changed


def verify(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    workspace: Path,
    *,
    attempt_count: int,
    contract_root: Path | None = None,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
) -> dict[str, Any]:
    root = workspace.absolute()
    target_report = validate(
        target,
        assignment,
        root,
        target_path=target_path,
        assignment_path=assignment_path,
        allow_existing_outputs=True,
        contract_root=contract_root or root,
    )
    run_contract_validation(
        "execution",
        target,
        assignment,
        result=result,
        contract_root=contract_root or root,
    )

    if isinstance(attempt_count, bool) or not isinstance(attempt_count, int):
        fail("attempt count must be an integer")
    if not 1 <= attempt_count <= 1 + assignment["retryCeiling"]:
        fail("attempt count violates the assignment retry ceiling")

    expected_result = absolute_project_path(
        root, target["output"]["resultPath"], must_exist=True, regular_file=True
    )
    supplied_result = result_path.absolute()
    if supplied_result != expected_result:
        fail("RESULT argument does not match target.output.resultPath")
    if load_json(expected_result) != result:
        fail("RESULT argument bytes do not contain the result being verified")

    candidate_path = target["output"]["candidatePath"]
    candidate = absolute_project_path(root, candidate_path)
    output = result["output"]
    if output is None:
        if candidate.exists() or candidate.is_symlink():
            fail("result claims no output but a candidate exists")
    else:
        candidate = absolute_project_path(
            root, candidate_path, must_exist=True, regular_file=True
        )
        inspection = inspect_rgba_png(candidate)
        expected_output = {
            "path": candidate_path,
            "mediaType": inspection["mediaType"],
            "width": inspection["width"],
            "height": inspection["height"],
            "bytes": inspection["bytes"],
            "alphaMode": inspection["alphaMode"],
            "contentHash": inspection["contentHash"],
        }
        if output != expected_output:
            fail("result candidate metadata does not match the exact retained bytes")
        if result["status"] == "candidate":
            findings = result["findings"]
            has_full_size_pass = any(
                finding.get("evaluator") == "automated"
                and finding.get("category")
                in {"geometry", "alpha", "safe-zone", "registration"}
                and finding.get("outcome") == "pass"
                for finding in findings
            )
            has_recognition_pass = any(
                finding.get("evaluator") == "producer"
                and finding.get("category") == "recognition"
                and finding.get("outcome") == "pass"
                for finding in findings
            )
            if not has_full_size_pass or not has_recognition_pass:
                fail("candidate requires explicit full-size and 96-pixel inspection passes")

    written = result["writtenOutputPaths"]
    expected_written = (
        [candidate_path, target["output"]["resultPath"]]
        if output is not None
        else [target["output"]["resultPath"]]
    )
    if written != expected_written:
        fail("written paths are not exactly the owned candidate and result")
    changed = _changed_repository_paths(root)
    if changed != set(expected_written):
        unexpected = sorted(changed - set(expected_written))
        missing = sorted(set(expected_written) - changed)
        fail(
            "unexpected changed repository paths during output ownership audit: "
            f"unexpected={unexpected}, missing={missing}"
        )

    return {
        **target_report,
        "status": result["status"],
        "attemptCount": attempt_count,
        "writtenOutputPaths": written,
        "verification": "pass",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify one SkillIconResult and exact retained candidate bytes."
    )
    parser.add_argument("target", help="target JSON path")
    parser.add_argument("assignment", help="assignment JSON path")
    parser.add_argument("result", help="result JSON path")
    parser.add_argument("workspace_root", help="Summonlab repository root")
    parser.add_argument(
        "--attempt-count",
        type=int,
        required=True,
        help="actual image-generation calls, including at most one corrective edit",
    )
    args = parser.parse_args()
    try:
        workspace = Path(args.workspace_root).absolute()
        target_path = _path_argument(workspace, args.target, "target")
        assignment_path = _path_argument(workspace, args.assignment, "assignment")
        result_path = _path_argument(workspace, args.result, "result")
        target = load_json(target_path)
        assignment = load_json(assignment_path)
        report = verify(
            target,
            assignment,
            load_json(result_path),
            result_path,
            workspace,
            attempt_count=args.attempt_count,
            target_path=target_path,
            assignment_path=assignment_path,
        )
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"result verification failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
