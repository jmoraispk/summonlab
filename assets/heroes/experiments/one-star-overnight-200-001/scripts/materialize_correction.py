#!/usr/bin/env python3
"""Coordinator-only materialization of one source-bound visual correction."""

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


def _load_anchored_json(workspace: Path, relative_path: str) -> dict[str, Any]:
    try:
        value = json.loads(anchored_read(workspace, relative_path, prefix="assets"))
    except json.JSONDecodeError as error:
        raise ContractError(f"invalid JSON: {relative_path}") from error
    if not isinstance(value, dict):
        raise ContractError(f"expected JSON object: {relative_path}")
    return value


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


def _correction_prompt(
    original_prompt: str,
    *,
    mode: str,
    defect: str,
    source_path: str,
    source_sha256: str,
) -> str:
    action = (
        "Perform a precise edit of the supplied preceding candidate."
        if mode == "edit"
        else "Perform a complete regeneration using the supplied preceding candidate only as the identity and continuity authority."
    )
    return (
        f"{original_prompt}\n\n"
        "SOURCE-BOUND CORRECTION — this block is part of the immutable canonical prompt.\n"
        f"Correction mode: {mode}. {action}\n"
        f"Exact preceding candidate: {source_path}\n"
        f"Exact preceding candidate SHA-256: {source_sha256}\n"
        f"Correct exactly this blocking defect: {defect}\n"
        "Preserve every passing trait from the preceding candidate and every original invariant: "
        "the same hero identity, face and age cues, body construction, proportions, skin, hair "
        "construction, wardrobe silhouette and palette, accessories, markings, expression restraint, "
        "one-star mortal power ceiling, weaponless presentation, composition, canvas, and negative "
        "constraints. Do not opportunistically redesign any passing feature."
    )


def materialize_correction(
    source_target_path: Path,
    source_assignment_path: Path,
    source_result_path: Path,
    workspace: Path,
    *,
    producer_id: str,
    assigned_at: str,
    defect: str,
    mode: str,
) -> dict[str, Any]:
    if mode not in {"edit", "regeneration"}:
        raise ContractError("correction mode must be edit or regeneration")
    if not defect.strip() or len(defect) > 1000:
        raise ContractError("correction defect must be nonempty text of at most 1000 characters")

    workspace = workspace.resolve(strict=True)
    target_relative = workspace_relative(workspace, source_target_path)
    assignment_relative = workspace_relative(workspace, source_assignment_path)
    result_relative = workspace_relative(workspace, source_result_path)
    source_target = validate_target(
        _load_anchored_json(workspace, target_relative), expected_path=target_relative
    )
    source_assignment = validate_assignment(
        _load_anchored_json(workspace, assignment_relative),
        source_target,
        expected_path=assignment_relative,
    )
    source_result = validate_result(
        _load_anchored_json(workspace, result_relative), source_target, source_assignment
    )
    if source_target["targetVersion"] != 1:
        raise ContractError("this coordinator operation accepts exactly a v1 source target")
    if result_relative != source_target["output"]["resultPath"]:
        raise ContractError("source result path does not match the source target")
    if source_result["status"] != "revise" or source_result["candidate"] is None:
        raise ContractError("correction requires a revise result with a retained candidate")

    candidate_record = source_result["candidate"]
    candidate_path = candidate_record["path"]
    candidate_bytes = anchored_read(workspace, candidate_path)
    if (
        len(candidate_bytes) != candidate_record["bytes"]
        or sha256_bytes(candidate_bytes) != candidate_record["sha256"]
    ):
        raise ContractError("source candidate bytes do not match the revise result")

    version = 2
    wave_id = source_target["waveId"]
    hero_id = source_target["heroId"]
    image_kind = source_target["imageKind"]
    target_relative_v2 = target_path_for(wave_id, hero_id, image_kind, version)
    assignment_relative_v2 = assignment_path_for(wave_id, hero_id, image_kind, version)
    candidate_relative_v2 = candidate_path_for(wave_id, hero_id, image_kind, version)
    result_relative_v2 = result_path_for(wave_id, hero_id, image_kind, version)
    for owned_path in (
        target_relative_v2,
        assignment_relative_v2,
        candidate_relative_v2,
        result_relative_v2,
    ):
        output = ensure_no_symlink_path(workspace, owned_path, allow_missing_leaf=True)
        if output.exists() or output.is_symlink():
            raise ContractError(f"correction output collision: {owned_path}")

    target_v2 = deepcopy(source_target)
    target_v2["targetId"] = (
        source_target["targetId"][:-3] + "-v2"
        if source_target["targetId"].endswith("-v1")
        else f"{source_target['targetId']}-v2"
    )
    target_v2["targetVersion"] = version
    target_v2["correctionSource"] = {
        "targetId": source_target["targetId"],
        "resultPath": result_relative,
        "candidatePath": candidate_path,
        "sha256": candidate_record["sha256"],
    }
    target_v2["references"] = deepcopy(source_target["references"])
    target_v2["references"].append(
        {
            "path": candidate_path,
            "sha256": candidate_record["sha256"],
            "purpose": (
                f"Exact v1 correction source. Fix only: {defect}. Preserve every passing trait."
            ),
            "role": "correction-source",
        }
    )
    prompt_text = _correction_prompt(
        source_target["canonicalPrompt"]["text"],
        mode=mode,
        defect=defect,
        source_path=candidate_path,
        source_sha256=candidate_record["sha256"],
    )
    target_v2["canonicalPrompt"] = {
        "text": prompt_text,
        "sha256": sha256_bytes(prompt_text.encode("utf-8")),
    }
    target_v2["output"] = {
        "candidatePath": candidate_relative_v2,
        "resultPath": result_relative_v2,
    }
    validate_target(target_v2, expected_path=target_relative_v2)

    assignment_v2 = {
        "schemaVersion": "hero-one-star-image-assignment-v1",
        "assignmentId": f"assignment-{target_v2['targetId']}",
        "experimentId": source_assignment["experimentId"],
        "targetId": target_v2["targetId"],
        "targetPath": target_relative_v2,
        "targetSha256": sha256_json(target_v2),
        "producerId": producer_id,
        "assignedAt": assigned_at,
        "dryRun": False,
        "retryCeiling": source_assignment["retryCeiling"],
        "permittedOutputs": deepcopy(target_v2["output"]),
        "forbiddenSharedPaths": deepcopy(source_assignment["forbiddenSharedPaths"]),
        "completionContract": deepcopy(source_assignment["completionContract"]),
    }
    validate_assignment(assignment_v2, target_v2, expected_path=assignment_relative_v2)

    target_payload = (canonical_json(target_v2) + "\n").encode("utf-8")
    assignment_payload = (canonical_json(assignment_v2) + "\n").encode("utf-8")
    created: list[CreatedFile] = []
    try:
        created.append(
            anchored_exclusive_create(workspace, target_relative_v2, target_payload)
        )
        created.append(
            anchored_exclusive_create(workspace, assignment_relative_v2, assignment_payload)
        )
    except BaseException:
        for artifact in reversed(created):
            _rollback_created(workspace, artifact)
        raise

    return {
        "schemaVersion": "hero-one-star-correction-materialization-v1",
        "sourceTargetId": source_target["targetId"],
        "targetId": target_v2["targetId"],
        "mode": mode,
        "defect": defect,
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
    parser.add_argument("--producer-id", required=True)
    parser.add_argument("--assigned-at", required=True)
    parser.add_argument("--defect", required=True)
    parser.add_argument("--mode", choices=("edit", "regeneration"), required=True)
    args = parser.parse_args()
    report = materialize_correction(
        args.source_target,
        args.source_assignment,
        args.source_result,
        args.workspace,
        producer_id=args.producer_id,
        assigned_at=args.assigned_at,
        defect=args.defect,
        mode=args.mode,
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

