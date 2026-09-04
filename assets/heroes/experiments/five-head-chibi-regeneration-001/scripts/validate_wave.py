#!/usr/bin/env python3
"""Validate one five-head production wave against immutable queue and journal evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from contracts import CANVAS_HEIGHT, CANVAS_MIME_TYPE, CANVAS_WIDTH, ContractError, EXPERIMENT_ID, RETRY_CALL_LIMIT
from persist_candidate import load_assignment, load_target, readable_png
from write_result import CALL_KINDS, CALL_SCHEMA, RESULT_SCHEMA


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent


@dataclass(frozen=True)
class WaveValidation:
    wave_id: str
    status: str
    planned: int
    completed: int
    complete: bool
    primary_calls: int
    retry_calls: int


def _load_object(path: Path, label: str) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ContractError(f"{label} must be a regular file: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot read {label}: {error}") from error
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be a JSON object")
    return value


def _canonical_sha(path: Path) -> str:
    if path.is_symlink() or not path.is_file():
        raise ContractError(f"receipt input must be a regular file: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _workspace(root: Path) -> Path:
    root = root.resolve(strict=True)
    if root.name != EXPERIMENT_ID or root.parent.name != "experiments" or root.parent.parent.name != "heroes" or root.parent.parent.parent.name != "assets":
        raise ContractError("validation root is not the five-head experiment root")
    return root.parent.parent.parent.parent


def _validate_plan(root: Path) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    plan = _load_object(root / "production-plan.json", "production plan")
    targets, assignments = plan.get("targets"), plan.get("assignments")
    if plan.get("schemaVersion") != "five-head-chibi-production-plan-v1" or plan.get("experimentId") != EXPERIMENT_ID or not isinstance(targets, list) or not isinstance(assignments, list):
        raise ContractError("production plan has an invalid shape")
    if len(targets) != len(assignments) or not targets:
        raise ContractError("production plan target and assignment counts differ")
    target_ids = [target.get("targetId") for target in targets if isinstance(target, dict)]
    assignment_ids = [assignment.get("assignmentId") for assignment in assignments if isinstance(assignment, dict)]
    paths = [assignment.get(key) for assignment in assignments if isinstance(assignment, dict) for key in ("providerSourcePath", "candidatePath", "resultPath")]
    if len(target_ids) != len(targets) or len(set(target_ids)) != len(targets) or len(assignment_ids) != len(assignments) or len(set(assignment_ids)) != len(assignments):
        raise ContractError("production plan has duplicate or incomplete IDs")
    if len(paths) != len(assignments) * 3 or any(not isinstance(path, str) for path in paths) or len(set(paths)) != len(paths):
        raise ContractError("production plan output paths are not exclusive")
    if [assignment.get("targetId") for assignment in assignments] != target_ids:
        raise ContractError("production plan assignments do not bind to targets")
    return plan, targets, assignments


def _load_journal(root: Path) -> list[dict[str, Any]]:
    path = root / "provenance/production-journal.jsonl"
    if not path.exists():
        return []
    if path.is_symlink() or not path.is_file():
        raise ContractError("production journal must be a regular file")
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            raise ContractError(f"production journal line {line_number} is invalid JSON") from error
        if not isinstance(record, dict):
            raise ContractError(f"production journal line {line_number} must be an object")
        records.append(record)
    if path.stat().st_size and not records:
        raise ContractError("production journal contains no call records")
    return records


def _validate_calls(records: Iterable[dict[str, Any]]) -> None:
    grouped: dict[str, list[dict[str, Any]]] = {}
    retries = 0
    for record in records:
        if record.get("schemaVersion") != CALL_SCHEMA or record.get("experimentId") != EXPERIMENT_ID:
            raise ContractError("journal call has unsupported schema or experiment")
        if record.get("callKind") not in CALL_KINDS:
            raise ContractError("journal callKind is not an allowed enum")
        if not isinstance(record.get("targetId"), str) or not isinstance(record.get("assignmentId"), str) or not isinstance(record.get("waveId"), str):
            raise ContractError("journal call lacks target assignment or wave binding")
        if not isinstance(record.get("callOrdinal"), int) or record["callOrdinal"] < 1:
            raise ContractError("journal callOrdinal must be a positive integer")
        if not isinstance(record.get("outcome"), str) or not isinstance(record.get("startedAt"), str) or not isinstance(record.get("completedAt"), str):
            raise ContractError("journal call lacks outcome or timestamps")
        grouped.setdefault(record["targetId"], []).append(record)
        retries += record["callKind"] == "provider-no-output-retry"
    if retries > RETRY_CALL_LIMIT:
        raise ContractError("global retry ceiling exceeded")
    for target_id, calls in grouped.items():
        primary = [call for call in calls if call["callKind"] == "primary"]
        retry = [call for call in calls if call["callKind"] == "provider-no-output-retry"]
        if len(primary) > 1:
            raise ContractError(f"target {target_id} has duplicate primary calls")
        if len(retry) > 1:
            raise ContractError(f"target {target_id} has more than one retry")
        if retry and (len(primary) != 1 or primary[0]["outcome"] != "provider-no-output"):
            raise ContractError(f"target {target_id} retry lacks a preceding provider no-output primary")


def _validate_declared_files(root: Path, assignments: list[dict[str, Any]]) -> None:
    declared = {path for assignment in assignments for path in (assignment["providerSourcePath"], assignment["candidatePath"], assignment["resultPath"])}
    workspace = _workspace(root)
    for wave_root in (root / "waves").glob("wave-*") if (root / "waves").exists() else ():
        for directory in ("provider-sources", "candidates", "results"):
            location = wave_root / directory
            if not location.exists():
                continue
            if location.is_symlink() or not location.is_dir():
                raise ContractError("output directory is not a real directory")
            for artifact in location.rglob("*"):
                if artifact.is_dir():
                    continue
                if artifact.is_symlink() or not artifact.is_file():
                    raise ContractError("output artifact is not a regular file")
                relative = artifact.relative_to(workspace).as_posix()
                if relative not in declared:
                    raise ContractError("undeclared output path is present")


def _result_for_assignment(root: Path, assignment: dict[str, Any], target: dict[str, Any], target_path: Path, assignment_path: Path, records: list[dict[str, Any]]) -> bool:
    workspace = _workspace(root)
    result_path = workspace / assignment["resultPath"]
    provider_path = workspace / assignment["providerSourcePath"]
    candidate_path = workspace / assignment["candidatePath"]
    existing = [path.exists() or path.is_symlink() for path in (result_path, provider_path, candidate_path)]
    if not any(existing):
        return False
    if not all(existing):
        raise ContractError(f"assignment {assignment['assignmentId']} has incomplete persisted output")
    result = _load_object(result_path, "result")
    if result.get("schemaVersion") != RESULT_SCHEMA:
        raise ContractError("result has unsupported schemaVersion")
    for key in ("experimentId", "assignmentId", "targetId", "waveId"):
        if result.get(key) != assignment.get(key):
            raise ContractError(f"result {key} does not bind to assignment")
    if result.get("targetSha256") != _canonical_sha(target_path) or result.get("assignmentSha256") != _canonical_sha(assignment_path):
        raise ContractError("result target or assignment hash differs")
    prompt = target.get("renderedPrompt")
    if not isinstance(prompt, str) or result.get("renderedPrompt") != prompt or result.get("renderedPromptSha256") != hashlib.sha256(prompt.encode()).hexdigest():
        raise ContractError("result prompt binding differs")
    references = target.get("generationReferences")
    if not isinstance(references, list) or len(references) != 1 or result.get("reference") != references[0]:
        raise ContractError("result reference binding differs")
    if result.get("providerSourcePath") != assignment["providerSourcePath"] or result.get("candidatePath") != assignment["candidatePath"]:
        raise ContractError("result output paths are undeclared or cross-wave")
    if provider_path.is_symlink() or candidate_path.is_symlink() or not provider_path.is_file() or not candidate_path.is_file():
        raise ContractError("result outputs must be regular files")
    provider, candidate = provider_path.read_bytes(), candidate_path.read_bytes()
    if provider != candidate:
        raise ContractError("candidate differs from provider source")
    width, height = readable_png(provider)
    image_hash = hashlib.sha256(provider).hexdigest()
    if (width, height) != (CANVAS_WIDTH, CANVAS_HEIGHT) or result.get("dimensions") != {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT} or result.get("mimeType") != CANVAS_MIME_TYPE:
        raise ContractError("result PNG dimensions or MIME type differs")
    if result.get("providerSourceSha256") != image_hash or result.get("candidateSha256") != image_hash:
        raise ContractError("result output hash differs")
    matching = [call for call in records if call.get("assignmentId") == assignment["assignmentId"] and call.get("targetId") == assignment["targetId"] and call.get("waveId") == assignment["waveId"] and call.get("callOrdinal") == result.get("callOrdinal") and call.get("callKind") == result.get("callKind") and call.get("outcome") == "succeeded"]
    if len(matching) != 1:
        raise ContractError("result requires exactly one corresponding successful journal call")
    call = matching[0]
    if result.get("providerMetadata") != call.get("providerMetadata") or result.get("startedAt") != call.get("startedAt") or result.get("completedAt") != call.get("completedAt"):
        raise ContractError("result journal evidence differs")
    return True


def validate_wave(wave_id: str, *, root: Path = DEFAULT_ROOT) -> WaveValidation:
    """Return planned/complete state, or fail closed if any evidence conflicts."""
    if not isinstance(wave_id, str) or not wave_id.startswith("wave-"):
        raise ContractError("wave must use the wave-NN identifier")
    root = root.resolve(strict=True)
    _workspace(root)
    _, targets, assignments = _validate_plan(root)
    records = _load_journal(root)
    _validate_calls(records)
    _validate_declared_files(root, assignments)
    pairs = [(target, assignment) for target, assignment in zip(targets, assignments) if assignment.get("waveId") == wave_id]
    if not pairs:
        raise ContractError("wave is not declared by the production plan")
    completed = 0
    for target, assignment in pairs:
        assignment_path = root / "waves" / wave_id / "assignments" / f"{assignment['heroId']}.json"
        current_assignment, experiment, _ = load_assignment(assignment_path)
        current_target, target_path = load_target(current_assignment, experiment)
        if current_assignment != assignment or current_target != target:
            raise ContractError("materialized target or assignment differs from production plan")
        completed += _result_for_assignment(root, assignment, target, target_path, assignment_path, records)
    primary = sum(record["callKind"] == "primary" for record in records if record.get("waveId") == wave_id)
    retry = sum(record["callKind"] == "provider-no-output-retry" for record in records if record.get("waveId") == wave_id)
    status = "complete" if completed == len(pairs) else "planned"
    return WaveValidation(wave_id, status, len(pairs), completed, completed == len(pairs), primary, retry)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wave", required=True)
    args = parser.parse_args()
    result = validate_wave(args.wave)
    print(json.dumps({"waveId": result.wave_id, "status": result.status, "planned": result.planned, "completed": result.completed, "complete": result.complete, "primaryCalls": result.primary_calls, "retryCalls": result.retry_calls}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
