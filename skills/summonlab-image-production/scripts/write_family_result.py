#!/usr/bin/env python3
"""Validate and immutable-create one strict family-affinity result receipt."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from anchored_io import AnchoredCreateHooks, anchored_exclusive_create
from validate_target import (
    canonical_json,
    load_json,
    run_mandatory_family_dispatch_gate,
)
from verify_result import verify_family_result


def exclusive_create_family_result(
    target_path: Path,
    assignment_path: Path,
    result: dict[str, Any],
    workspace: Path,
    *,
    hooks: AnchoredCreateHooks | None = None,
) -> dict[str, Any]:
    """Validate all bytes before one O_EXCL receipt create; never repair in place."""
    workspace = workspace.resolve()
    target_path = target_path.resolve()
    assignment_path = assignment_path.resolve()
    run_mandatory_family_dispatch_gate(
        target_path,
        assignment_path,
        workspace,
        phase="result",
        result=result,
    )
    target = load_json(target_path)
    assignment = load_json(assignment_path)
    result_path = workspace / target["ownedPaths"]["result"]
    verification = verify_family_result(
        target,
        assignment,
        result,
        result_path,
        workspace,
        require_result_file=False,
    )
    payload = canonical_json(result).encode("utf-8")
    persistence = anchored_exclusive_create(
        workspace, result["resultPath"], payload, hooks=hooks
    )
    return {
        **verification,
        **persistence,
        "operation": "anchored-exclusive-create",
        "resultPath": result["resultPath"],
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
        result = load_json(draft_path)
        report = exclusive_create_family_result(
            target_path, assignment_path, result, workspace
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"family result creation failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
