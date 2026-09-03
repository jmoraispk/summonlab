#!/usr/bin/env python3
"""Validate complete result bytes in memory and exclusively create the owned receipt."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from contracts import anchored_exclusive_create, canonical_json
from validate_preflight import validate_preflight


def write_result(
    target_path: Path,
    assignment_path: Path,
    result_draft: dict[str, Any],
    workspace: Path,
) -> dict[str, Any]:
    report = validate_preflight(
        target_path,
        assignment_path,
        workspace,
        phase="result",
        result_draft=result_draft,
    )
    payload = (canonical_json(result_draft) + "\n").encode("utf-8")
    created = anchored_exclusive_create(workspace.resolve(strict=True), report["resultPath"], payload)
    return {
        "operation": "anchored-exclusive-create",
        "path": created.path,
        "bytes": created.bytes,
        "sha256": created.sha256,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("assignment", type=Path)
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    draft = json.load(sys.stdin)
    print(json.dumps(write_result(args.target, args.assignment, draft, args.workspace), indent=2))


if __name__ == "__main__":
    main()

