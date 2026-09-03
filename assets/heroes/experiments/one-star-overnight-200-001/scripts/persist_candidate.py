#!/usr/bin/env python3
"""Persist exactly one returned Heroes image through an anchored exclusive create."""

from __future__ import annotations

import argparse
import json
import os
import stat
from pathlib import Path
from typing import Any

from contracts import (
    ContractError,
    anchored_read,
    anchored_exclusive_create,
    png_dimensions,
    sha256_bytes,
    validate_assignment,
    validate_target,
    workspace_relative,
)
from validate_preflight import validate_preflight


def _read_source_exact(source_path: Path) -> bytes:
    descriptor = os.open(source_path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise ContractError("provider source must be a regular non-symlink file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        os.close(descriptor)


def persist_candidate(
    source_path: Path,
    target_path: Path,
    assignment_path: Path,
    workspace: Path,
    *,
    source_output_id: str,
) -> dict[str, Any]:
    preflight = validate_preflight(target_path, assignment_path, workspace, phase="candidate")
    if preflight["dryRun"]:
        raise ContractError("dry-run assignment cannot persist a candidate")
    workspace = workspace.resolve(strict=True)
    target_relative = workspace_relative(workspace, target_path)
    assignment_relative = workspace_relative(workspace, assignment_path)
    target = validate_target(
        json.loads(anchored_read(workspace, target_relative, prefix="assets")),
        expected_path=target_relative,
    )
    validate_assignment(
        json.loads(anchored_read(workspace, assignment_relative, prefix="assets")),
        target,
        expected_path=assignment_relative,
    )
    payload = _read_source_exact(source_path)
    width, height = png_dimensions(payload)
    if (width, height) != (1024, 1536):
        raise ContractError(f"provider source must be exactly 1024x1536, found {width}x{height}")
    created = anchored_exclusive_create(
        workspace, target["output"]["candidatePath"], payload
    )
    source = {
        "outputId": source_output_id,
        "path": str(source_path.resolve(strict=True)),
        "mediaType": "image/png",
        "width": width,
        "height": height,
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
    }
    return {
        "operation": "anchored-exclusive-copy",
        "source": source,
        "retained": {
            "path": created.path,
            "mediaType": "image/png",
            "width": width,
            "height": height,
            "bytes": created.bytes,
            "sha256": created.sha256,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("assignment", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--source-output-id", required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            persist_candidate(
                args.source,
                args.target,
                args.assignment,
                args.workspace,
                source_output_id=args.source_output_id,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
