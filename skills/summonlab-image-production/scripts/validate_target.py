#!/usr/bin/env python3
"""Validate common Summonlab image target and assignment invariants."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any

TARGET_VERSION = "image-production-target-v1"
ASSIGNMENT_VERSION = "image-production-assignment-v1"
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{1,79}$")


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        fail(f"{path} must contain a JSON object")
    return value


def require_string(value: dict[str, Any], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item.strip():
        fail(f"{key} must be a non-empty string")
    return item


def require_id(value: dict[str, Any], key: str) -> str:
    item = require_string(value, key)
    if not ID_PATTERN.fullmatch(item):
        fail(f"{key} must be a stable lowercase identifier")
    return item


def project_path(raw: str) -> PurePosixPath:
    path = PurePosixPath(raw)
    if path.is_absolute() or ".." in path.parts or "" in path.parts or "\\" in raw:
        fail(f"unsafe repository path: {raw}")
    if str(path) != raw:
        fail(f"non-normalized repository path: {raw}")
    return path


def absolute_project_path(workspace: Path, raw: str) -> Path:
    relative = project_path(raw)
    absolute = (workspace / Path(*relative.parts)).resolve()
    if absolute != workspace and workspace not in absolute.parents:
        fail(f"path escaped workspace through a symlink: {raw}")
    return absolute


def validate(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    allow_existing_outputs: bool = False,
) -> dict[str, Any]:
    if target.get("schemaVersion") != TARGET_VERSION:
        fail("unsupported target schemaVersion")
    if assignment.get("schemaVersion") != ASSIGNMENT_VERSION:
        fail("unsupported assignment schemaVersion")

    target_id = require_id(target, "targetId")
    for key in ("assetId", "experimentId", "packId", "speciesId"):
        require_id(target, key)
    if target.get("promptProtocol") not in {
        "canonical-v1",
        "safe-frame-v2",
        "safe-frame-v3",
        "safe-frame-v4",
    }:
        fail("promptProtocol is unsupported")
    if target.get("authoringProtocol") not in {"basic-v1", "semantic-v2"}:
        fail("authoringProtocol is unsupported")
    require_string(target, "constructionMode")
    for key in ("identityInvariants", "anatomyInvariants"):
        entries = target.get(key)
        if not isinstance(entries, list) or len(entries) < 2:
            fail(f"{key} must contain at least two entries")

    presentation = target.get("presentation")
    if not isinstance(presentation, dict):
        fail("presentation must be an object")
    canvas = presentation.get("canvas")
    if not isinstance(canvas, dict):
        fail("presentation.canvas must be an object")
    for key in ("width", "height"):
        if not isinstance(canvas.get(key), int) or not 512 <= canvas[key] <= 8192:
            fail(f"presentation.canvas.{key} is unsupported")
    if canvas.get("mediaType") not in {"image/png", "image/webp"}:
        fail("presentation.canvas.mediaType is unsupported")
    safe_margin = canvas.get("safeMarginPercent")
    if not isinstance(safe_margin, (int, float)) or not 0 <= safe_margin <= 40:
        fail("presentation.canvas.safeMarginPercent is unsupported")

    criteria = target.get("acceptanceCriteria")
    if not isinstance(criteria, list) or not criteria:
        fail("acceptanceCriteria must be a non-empty array")
    criterion_ids: list[str] = []
    for criterion in criteria:
        if not isinstance(criterion, dict):
            fail("each acceptance criterion must be an object")
        criterion_ids.append(require_id(criterion, "criterionId"))
        if criterion.get("kind") not in {"objective", "human-review"}:
            fail("acceptance criterion kind is invalid")
        require_string(criterion, "description")
        if not isinstance(criterion.get("required"), bool):
            fail("acceptance criterion required must be boolean")
    if len(set(criterion_ids)) != len(criterion_ids):
        fail("acceptance criterion IDs must be unique")

    references = target.get("references")
    if not isinstance(references, list) or not references:
        fail("references must be a non-empty array")
    reference_paths: list[str] = []
    for reference in references:
        if not isinstance(reference, dict):
            fail("each reference must be an object")
        raw_path = require_string(reference, "path")
        reference_paths.append(raw_path)
        absolute = absolute_project_path(workspace, raw_path)
        if not absolute.is_file():
            fail(f"reference is missing: {raw_path}")
        expected_hash = require_string(reference, "contentHash")
        if not re.fullmatch(r"[a-f0-9]{64}", expected_hash):
            fail(f"reference hash is invalid: {raw_path}")
        if hashlib.sha256(absolute.read_bytes()).hexdigest() != expected_hash:
            fail(f"reference hash changed: {raw_path}")
        require_string(reference, "purpose")
    if len(set(reference_paths)) != len(reference_paths):
        fail("reference paths must be unique and ordered")

    output = target.get("output")
    if not isinstance(output, dict):
        fail("output must be an object")
    candidate_path = require_string(output, "candidatePath")
    result_path = require_string(output, "resultPath")
    if candidate_path == result_path:
        fail("candidate and result paths must differ")
    candidate_absolute = absolute_project_path(workspace, candidate_path)
    result_absolute = absolute_project_path(workspace, result_path)
    if not allow_existing_outputs:
        collisions = [
            raw
            for raw, absolute in (
                (candidate_path, candidate_absolute),
                (result_path, result_absolute),
            )
            if absolute.exists()
        ]
        if collisions:
            fail(f"pre-existing output collision: {', '.join(collisions)}")

    assignment_id = require_id(assignment, "assignmentId")
    if assignment.get("targetId") != target_id:
        fail("assignment targetId does not match target")
    require_string(assignment, "skillVersion")
    if assignment.get("retryCeiling") not in {0, 1}:
        fail("this skill version allows a retryCeiling of zero or one")
    if not isinstance(assignment.get("dryRun"), bool):
        fail("assignment dryRun must be boolean")
    if assignment.get("permittedOutputs") != output:
        fail("assignment permittedOutputs must exactly match target output")
    forbidden = assignment.get("forbiddenSharedPaths")
    if not isinstance(forbidden, list) or not forbidden:
        fail("assignment must declare forbidden shared paths")
    normalized_forbidden = [str(project_path(item)) for item in forbidden if isinstance(item, str)]
    if len(normalized_forbidden) != len(forbidden):
        fail("forbiddenSharedPaths must contain strings")
    if set(normalized_forbidden) & {candidate_path, result_path}:
        fail("an owned output is also forbidden")
    if assignment.get("completionContract") != {
        "oneTargetOneImage": True,
        "structuredResultRequired": True,
        "sharedFilesMustRemainUntouched": True,
        "selfPromotionForbidden": True,
    }:
        fail("assignment completionContract is invalid")

    return {
        "targetId": target_id,
        "assignmentId": assignment_id,
        "candidatePath": candidate_path,
        "resultPath": result_path,
        "references": len(references),
        "retryCeiling": assignment["retryCeiling"],
        "dryRun": assignment["dryRun"],
        "status": "valid",
    }


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: validate_target.py TARGET ASSIGNMENT WORKSPACE_ROOT")
    target_path = Path(sys.argv[1]).resolve()
    assignment_path = Path(sys.argv[2]).resolve()
    workspace = Path(sys.argv[3]).resolve()
    if workspace not in target_path.parents or workspace not in assignment_path.parents:
        raise SystemExit("target validation failed: input file is outside workspace")
    try:
        report = validate(load_json(target_path), load_json(assignment_path), workspace)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"target validation failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
