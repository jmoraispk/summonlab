#!/usr/bin/env python3
"""Coordinator-only materialization of one provider no-output retry envelope."""

from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from contracts import (
    ContractError,
    CreatedFile,
    _anchored_parent,
    anchored_exclusive_create,
    anchored_read,
    assignment_path_for,
    canonical_json,
    candidate_path_for,
    ensure_no_symlink_path,
    result_path_for,
    sha256_bytes,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_result,
    validate_target,
    workspace_relative,
)


NO_OUTPUT_FAILURE_KINDS = {"other", "no-output"}


def _load_anchored_json(
    workspace: Path, relative_path: str
) -> tuple[dict[str, Any], bytes]:
    payload = anchored_read(workspace, relative_path)
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as error:
        raise ContractError(f"invalid JSON: {relative_path}") from error
    if not isinstance(value, dict):
        raise ContractError(f"expected JSON object: {relative_path}")
    return value, payload


def _rollback_created(workspace: Path, created: CreatedFile) -> None:
    """Remove only the exact inode created by this operation."""

    try:
        with _anchored_parent(workspace, created.path, create=False) as (parent, name):
            current = os.stat(name, dir_fd=parent, follow_symlinks=False)
            if (current.st_dev, current.st_ino) == (created.device, created.inode):
                os.unlink(name, dir_fd=parent)
    except OSError:
        # A replaced namespace is deliberately left untouched.
        return


def _assert_true_no_output_failure(result: dict[str, Any]) -> None:
    if result["status"] != "failed" or result["candidate"] is not None:
        raise ContractError(
            "provider retry requires a failed result with no retained candidate"
        )
    attempts = result["attempts"]
    if not attempts:
        raise ContractError("provider retry requires at least one provider attempt")
    for attempt in attempts:
        if attempt["conclusion"] != "provider-failure":
            raise ContractError(
                "provider retry forbids any prior image-returning or producer-inspected attempt"
            )
        if attempt["failureKind"] not in NO_OUTPUT_FAILURE_KINDS:
            raise ContractError(
                "provider retry requires failureKind other or no-output"
            )
        if attempt["sourceOutput"] is not None or attempt["persistence"] is not None:
            raise ContractError(
                "provider retry requires null sourceOutput and persistence on every attempt"
            )


def materialize_provider_retry(
    source_target_path: Path,
    source_assignment_path: Path,
    source_result_path: Path,
    workspace: Path,
    *,
    assigned_at: str,
) -> dict[str, Any]:
    """Create one collision-safe v2 envelope for a true v1 provider no-output failure."""

    if not isinstance(assigned_at, str) or not assigned_at.strip() or len(assigned_at) > 80:
        raise ContractError("assigned_at must be nonempty text of at most 80 characters")

    workspace = workspace.resolve(strict=True)
    target_relative = workspace_relative(workspace, source_target_path)
    assignment_relative = workspace_relative(workspace, source_assignment_path)
    result_relative = workspace_relative(workspace, source_result_path)

    source_target_input, target_payload = _load_anchored_json(
        workspace, target_relative
    )
    source_target = validate_target(
        source_target_input, expected_path=target_relative
    )
    source_assignment_input, assignment_payload = _load_anchored_json(
        workspace, assignment_relative
    )
    source_assignment = validate_assignment(
        source_assignment_input,
        source_target,
        expected_path=assignment_relative,
    )
    source_result_input, result_payload = _load_anchored_json(
        workspace, result_relative
    )
    source_result = validate_result(
        source_result_input, source_target, source_assignment
    )

    if source_target["targetVersion"] != 1 or not source_target["targetId"].endswith("-v1"):
        raise ContractError("provider retry accepts exactly a v1 source target")
    if result_relative != source_target["output"]["resultPath"]:
        raise ContractError("source result path does not match the source target")
    if source_assignment["dryRun"]:
        raise ContractError("provider retry cannot originate from a dry-run assignment")
    _assert_true_no_output_failure(source_result)

    source_candidate_relative = source_target["output"]["candidatePath"]
    source_candidate = ensure_no_symlink_path(
        workspace, source_candidate_relative, allow_missing_leaf=True
    )
    if source_candidate.exists() or source_candidate.is_symlink():
        raise ContractError(
            "provider retry forbids a prior image-returning candidate"
        )

    version = 2
    wave_id = source_target["waveId"]
    hero_id = source_target["heroId"]
    image_kind = source_target["imageKind"]
    target_relative_v2 = target_path_for(wave_id, hero_id, image_kind, version)
    assignment_relative_v2 = assignment_path_for(
        wave_id, hero_id, image_kind, version
    )
    candidate_relative_v2 = candidate_path_for(
        wave_id, hero_id, image_kind, version
    )
    result_relative_v2 = result_path_for(wave_id, hero_id, image_kind, version)
    for owned_path in (
        target_relative_v2,
        assignment_relative_v2,
        candidate_relative_v2,
        result_relative_v2,
    ):
        output = ensure_no_symlink_path(
            workspace, owned_path, allow_missing_leaf=True
        )
        if output.exists() or output.is_symlink():
            raise ContractError(f"provider retry output collision: {owned_path}")

    target_v2 = deepcopy(source_target)
    target_v2["targetId"] = source_target["targetId"][:-3] + "-v2"
    target_v2["targetVersion"] = version
    target_v2["heroSpec"] = deepcopy(source_target["heroSpec"])
    target_v2["presentation"] = deepcopy(source_target["presentation"])
    target_v2["acceptanceCriteria"] = deepcopy(
        source_target["acceptanceCriteria"]
    )
    target_v2["canonicalPrompt"] = deepcopy(source_target["canonicalPrompt"])
    target_v2["references"] = deepcopy(source_target["references"])
    target_v2["correctionSource"] = None
    target_v2["output"] = {
        "candidatePath": candidate_relative_v2,
        "resultPath": result_relative_v2,
    }
    validate_target(target_v2, expected_path=target_relative_v2)

    assignment_v2 = {
        "schemaVersion": source_assignment["schemaVersion"],
        "assignmentId": f"assignment-{target_v2['targetId']}",
        "experimentId": source_assignment["experimentId"],
        "targetId": target_v2["targetId"],
        "targetPath": target_relative_v2,
        "targetSha256": sha256_json(target_v2),
        "producerId": source_assignment["producerId"],
        "assignedAt": assigned_at,
        "dryRun": False,
        "retryCeiling": source_assignment["retryCeiling"],
        "permittedOutputs": deepcopy(target_v2["output"]),
        "forbiddenSharedPaths": deepcopy(source_assignment["forbiddenSharedPaths"]),
        "completionContract": deepcopy(source_assignment["completionContract"]),
    }
    validate_assignment(
        assignment_v2, target_v2, expected_path=assignment_relative_v2
    )

    target_payload_v2 = (canonical_json(target_v2) + "\n").encode("utf-8")
    assignment_payload_v2 = (canonical_json(assignment_v2) + "\n").encode("utf-8")
    created: list[CreatedFile] = []
    try:
        created.append(
            anchored_exclusive_create(workspace, target_relative_v2, target_payload_v2)
        )
        created.append(
            anchored_exclusive_create(
                workspace, assignment_relative_v2, assignment_payload_v2
            )
        )
    except BaseException:
        for artifact in reversed(created):
            _rollback_created(workspace, artifact)
        raise

    if (
        anchored_read(workspace, target_relative) != target_payload
        or anchored_read(workspace, assignment_relative) != assignment_payload
        or anchored_read(workspace, result_relative) != result_payload
    ):
        for artifact in reversed(created):
            _rollback_created(workspace, artifact)
        raise ContractError("source envelope changed during provider retry materialization")

    return {
        "schemaVersion": "hero-one-star-provider-retry-materialization-v1",
        "sourceTargetId": source_target["targetId"],
        "sourceResultPath": result_relative,
        "sourceResultSha256": sha256_json(source_result),
        "targetId": target_v2["targetId"],
        "targetPath": target_relative_v2,
        "targetSha256": sha256_json(target_v2),
        "assignmentPath": assignment_relative_v2,
        "assignmentSha256": sha256_json(assignment_v2),
        "candidatePath": candidate_relative_v2,
        "resultPath": result_relative_v2,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_target", type=Path)
    parser.add_argument("source_assignment", type=Path)
    parser.add_argument("source_result", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--assigned-at", required=True)
    args = parser.parse_args()
    report = materialize_provider_retry(
        args.source_target,
        args.source_assignment,
        args.source_result,
        args.workspace,
        assigned_at=args.assigned_at,
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
