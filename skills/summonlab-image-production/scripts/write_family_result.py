#!/usr/bin/env python3
"""Validate and immutable-create one strict family-affinity result receipt."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from validate_target import canonical_json, load_json
from verify_result import verify_family_result


def exclusive_create_family_result(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    workspace: Path,
) -> dict[str, Any]:
    """Validate all bytes before one O_EXCL receipt create; never repair in place."""
    verification = verify_family_result(
        target,
        assignment,
        result,
        result_path,
        workspace,
        require_result_file=False,
    )
    payload = canonical_json(result).encode("utf-8")
    result_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(result_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError as error:
        raise FileExistsError(f"family result collision: {result_path}") from error
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        # A failed first write is not a valid receipt. Remove only the inode created by this call.
        result_path.unlink(missing_ok=True)
        raise
    return {
        **verification,
        "operation": "exclusive-create",
        "bytes": len(payload),
        "resultPath": str(result_path.relative_to(workspace).as_posix()),
    }


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: write_family_result.py TARGET ASSIGNMENT RESULT_DRAFT WORKSPACE_ROOT"
        )
    target_path = Path(sys.argv[1]).resolve()
    assignment_path = Path(sys.argv[2]).resolve()
    draft_path = Path(sys.argv[3]).resolve()
    workspace = Path(sys.argv[4]).resolve()
    try:
        target = load_json(target_path)
        assignment = load_json(assignment_path)
        result = load_json(draft_path)
        result_path = workspace / target["ownedPaths"]["result"]
        report = exclusive_create_family_result(
            target, assignment, result, result_path, workspace
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"family result creation failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
