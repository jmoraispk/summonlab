#!/usr/bin/env python3
"""Persist one family candidate with Linux directory-handle anchored ownership."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from anchored_io import (
    AnchoredCreateHooks,
    anchored_exclusive_create,
    read_regular_source_no_follow,
)
from validate_target import load_json, run_mandatory_family_dispatch_gate, validate


def persist_family_candidate(
    source_path: Path,
    target_path: Path,
    assignment_path: Path,
    workspace: Path,
    *,
    hooks: AnchoredCreateHooks | None = None,
) -> dict[str, object]:
    workspace = workspace.resolve()
    target_path = target_path.resolve()
    assignment_path = assignment_path.resolve()
    run_mandatory_family_dispatch_gate(
        target_path, assignment_path, workspace, phase="candidate"
    )
    target = load_json(target_path)
    assignment = load_json(assignment_path)
    report = validate(
        target,
        assignment,
        workspace,
        target_path=target_path,
        assignment_path=assignment_path,
    )
    if report.get("profile") != "image-production-family-target-v1":
        raise ValueError("family candidate persistence requires the v3 family profile")
    source_bytes = read_regular_source_no_follow(source_path)
    if not source_bytes:
        raise ValueError("family candidate source is empty")
    persistence = anchored_exclusive_create(
        workspace,
        target["ownedPaths"]["candidate"],
        source_bytes,
        hooks=hooks,
    )
    return {
        **persistence,
        "operation": "anchored-exclusive-copy",
        "sourcePath": str(source_path),
        "sourceBytes": len(source_bytes),
        "sourceSha256": persistence["contentHash"],
    }


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: persist_family_candidate.py SOURCE TARGET ASSIGNMENT WORKSPACE_ROOT"
        )
    source_path = Path(sys.argv[1]).absolute()
    target_path = Path(sys.argv[2]).resolve()
    assignment_path = Path(sys.argv[3]).resolve()
    workspace = Path(sys.argv[4]).resolve()
    try:
        report = persist_family_candidate(
            source_path,
            target_path,
            assignment_path,
            workspace,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"family candidate persistence failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
