#!/usr/bin/env python3
"""Authorize one Heroes image job without relying on enemy production contracts."""

from __future__ import annotations

import argparse
import json
import stat
from pathlib import Path
from typing import Any

from contracts import (
    ContractError,
    anchored_read,
    ensure_no_symlink_path,
    sha256_bytes,
    validate_assignment,
    validate_result,
    validate_target,
    workspace_relative,
)


def _regular_file(workspace: Path, relative_path: str) -> bytes:
    path = ensure_no_symlink_path(
        workspace, relative_path, allow_missing_leaf=False, prefix="assets"
    )
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode):
        raise ContractError(f"reference is not a regular file: {relative_path}")
    return anchored_read(workspace, relative_path, prefix="assets")


def _validate_source_chain(
    workspace: Path,
    source: dict[str, Any],
    *,
    expected_kind: str | None = None,
    permitted_statuses: set[str] | None = None,
) -> None:
    candidate = _regular_file(workspace, source["candidatePath"])
    if sha256_bytes(candidate) != source["sha256"]:
        raise ContractError(f"source candidate hash mismatch: {source['candidatePath']}")
    try:
        source_result = json.loads(_regular_file(workspace, source["resultPath"]))
    except json.JSONDecodeError as error:
        raise ContractError("source result is not valid JSON") from error
    if source_result.get("schemaVersion") != "hero-one-star-image-result-v1":
        raise ContractError("source result has the wrong schemaVersion")
    permitted_statuses = permitted_statuses or {"candidate", "revise"}
    if source_result.get("targetId") != source["targetId"] or source_result.get("status") not in permitted_statuses:
        raise ContractError("source result does not authorize the declared source candidate")
    candidate_record = source_result.get("candidate")
    if not isinstance(candidate_record, dict) or candidate_record.get("path") != source["candidatePath"] or candidate_record.get("sha256") != source["sha256"]:
        raise ContractError("source result candidate binding is stale")
    if expected_kind is not None:
        source_target_path = source["candidatePath"].replace("/candidates/", "/targets/")
        source_target_path = source_target_path.removesuffix(".png") + ".json"
        try:
            source_target = json.loads(_regular_file(workspace, source_target_path))
        except json.JSONDecodeError as error:
            raise ContractError("source target is not valid JSON") from error
        validate_target(source_target, expected_path=source_target_path)
        if source_target.get("imageKind") != expected_kind:
            raise ContractError(f"source target must be {expected_kind}")
        if (
            source_target["targetId"] != source["targetId"]
            or source_target["output"]["candidatePath"] != source["candidatePath"]
            or source_target["output"]["resultPath"] != source["resultPath"]
        ):
            raise ContractError("source target paths do not match the declared source")


def validate_preflight(
    target_path: Path,
    assignment_path: Path,
    workspace: Path,
    *,
    phase: str = "candidate",
    result_draft: dict[str, Any] | None = None,
) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    target_relative = workspace_relative(workspace, target_path)
    assignment_relative = workspace_relative(workspace, assignment_path)
    try:
        target = validate_target(
            json.loads(_regular_file(workspace, target_relative)), expected_path=target_relative
        )
    except json.JSONDecodeError as error:
        raise ContractError("target is not valid JSON") from error
    try:
        assignment_input = json.loads(_regular_file(workspace, assignment_relative))
    except json.JSONDecodeError as error:
        raise ContractError("assignment is not valid JSON") from error
    assignment = validate_assignment(
        assignment_input, target, expected_path=assignment_relative
    )

    for reference in target["references"]:
        payload = _regular_file(workspace, reference["path"])
        if sha256_bytes(payload) != reference["sha256"]:
            raise ContractError(f"reference hash mismatch: {reference['path']}")

    if target["sourceSummon"] is not None:
        _validate_source_chain(
            workspace,
            target["sourceSummon"],
            expected_kind="summon",
            permitted_statuses={"candidate"},
        )
    if target["correctionSource"] is not None:
        _validate_source_chain(workspace, target["correctionSource"])

    candidate_path = target["output"]["candidatePath"]
    result_path = target["output"]["resultPath"]
    candidate = ensure_no_symlink_path(workspace, candidate_path, allow_missing_leaf=True)
    result = ensure_no_symlink_path(workspace, result_path, allow_missing_leaf=True)
    if phase == "candidate":
        if result_draft is not None:
            raise ContractError("candidate preflight cannot receive result material")
        if candidate.exists() or candidate.is_symlink() or result.exists() or result.is_symlink():
            raise ContractError("owned output collision")
    elif phase == "result":
        if result_draft is None:
            raise ContractError("result preflight requires exact in-memory result material")
        validate_result(result_draft, target, assignment)
        if result.exists() or result.is_symlink():
            raise ContractError("owned result collision")
        if result_draft["candidate"] is None:
            if candidate.exists() or candidate.is_symlink():
                raise ContractError("failed result cannot leave an unbound candidate")
        else:
            payload = _regular_file(workspace, candidate_path)
            record = result_draft["candidate"]
            if len(payload) != record["bytes"] or sha256_bytes(payload) != record["sha256"]:
                raise ContractError("result candidate metadata does not match retained bytes")
    else:
        raise ContractError("phase must be candidate or result")

    return {
        "dispatchable": True,
        "phase": phase,
        "targetId": target["targetId"],
        "assignmentId": assignment["assignmentId"],
        "candidatePath": candidate_path,
        "resultPath": result_path,
        "dryRun": assignment["dryRun"],
        "retryCeiling": assignment["retryCeiling"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("assignment", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--phase", choices=("candidate", "result"), default="candidate")
    parser.add_argument("--result-draft", type=Path)
    args = parser.parse_args()
    draft = json.loads(args.result_draft.read_text(encoding="utf-8")) if args.result_draft else None
    print(
        json.dumps(
            validate_preflight(
                args.target,
                args.assignment,
                args.workspace,
                phase=args.phase,
                result_draft=draft,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
