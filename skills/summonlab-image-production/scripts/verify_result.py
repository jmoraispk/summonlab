#!/usr/bin/env python3
"""Verify one result against its target, assignment, and retained image."""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from render_prompt import render as render_canonical_prompt
from validate_target import absolute_project_path, load_json, validate

RESULT_VERSION = "image-production-result-v1"
FAILURE_KINDS = {
    "capacity",
    "provider-throttle",
    "timeout",
    "malformed-output",
    "persistence",
    "other",
}


def fail(message: str) -> None:
    raise ValueError(message)


def timestamp(raw: Any, field: str) -> datetime:
    if not isinstance(raw, str):
        fail(f"{field} must be an ISO timestamp")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        fail(f"{field} must be an ISO timestamp: {error}")


def image_dimensions(path: Path, media_type: str) -> tuple[int, int]:
    data = path.read_bytes()
    if media_type == "image/png":
        if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            fail("retained candidate is not a PNG")
        return struct.unpack(">II", data[16:24])
    if media_type == "image/webp":
        if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            fail("retained candidate is not a WebP")
        kind = data[12:16]
        if kind == b"VP8X":
            return (
                1 + int.from_bytes(data[24:27], "little"),
                1 + int.from_bytes(data[27:30], "little"),
            )
        marker = data.find(b"\x9d\x01\x2a")
        if kind == b"VP8 " and marker >= 0 and marker + 7 <= len(data):
            return (
                int.from_bytes(data[marker + 3 : marker + 5], "little") & 0x3FFF,
                int.from_bytes(data[marker + 5 : marker + 7], "little") & 0x3FFF,
            )
        if kind == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
            bits = int.from_bytes(data[21:25], "little")
            return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
        fail("unsupported WebP dimension header")
    fail(f"unsupported media type: {media_type}")


def verify_failure_kind_contract(attempt: dict[str, Any], result_status: str) -> None:
    conclusion = attempt.get("conclusion")
    has_failure_kind = "failureKind" in attempt
    failure_kind = attempt.get("failureKind")
    if conclusion != "provider-failure":
        if has_failure_kind:
            fail("only provider-failure attempts may declare failureKind")
        return
    if has_failure_kind and failure_kind not in FAILURE_KINDS:
        fail("provider-failure attempt failureKind is invalid")
    if result_status == "failed" and not has_failure_kind:
        fail("terminal failed results must classify every provider failure")


def verify_attempts(
    target: dict[str, Any], assignment: dict[str, Any], result: dict[str, Any]
) -> None:
    attempts = result.get("attempts")
    if not isinstance(attempts, list) or not 1 <= len(attempts) <= 1 + assignment["retryCeiling"]:
        fail("attempt count violates the assignment retry ceiling")
    expected_references = [
        {"path": reference["path"], "contentHash": reference["contentHash"]}
        for reference in target["references"]
    ]
    previous_id: str | None = None
    for number, attempt in enumerate(attempts, start=1):
        if not isinstance(attempt, dict) or attempt.get("attemptNumber") != number:
            fail("attempt numbers must be contiguous and one-based")
        attempt_id = attempt.get("attemptId")
        if not isinstance(attempt_id, str) or not attempt_id:
            fail("attemptId is missing")
        if attempt.get("precedingAttemptId") != previous_id:
            fail("attempt linkage is invalid")
        previous_id = attempt_id
        conclusion = attempt.get("conclusion")
        if conclusion not in {
            "accepted-by-producer",
            "rejected-by-producer",
            "provider-failure",
        }:
            fail("attempt conclusion is invalid")
        verify_failure_kind_contract(attempt, result.get("status"))
        prompt = attempt.get("exactPrompt")
        if not isinstance(prompt, str) or not prompt:
            fail("attempt exactPrompt is missing")
        if number == 1 and prompt != render_canonical_prompt(target):
            declared_protocol_failure = (
                result.get("status") == "revise"
                and "protocol-provenance" in result.get("failedCriteria", [])
            )
            if not declared_protocol_failure:
                fail("first attempt exactPrompt does not match the canonical renderer")
        if attempt.get("promptHash") != hashlib.sha256(prompt.encode("utf-8")).hexdigest():
            fail("attempt promptHash does not match exactPrompt")
        if attempt.get("referenceInputs") != expected_references:
            fail("attempt target-reference provenance does not match manifest order and hashes")
        correction_reference = attempt.get("correctionReferenceInput")
        if correction_reference is not None:
            if number == 1:
                fail("the first attempt cannot have a correction reference")
            if (
                not isinstance(correction_reference, dict)
                or not isinstance(correction_reference.get("path"), str)
                or not correction_reference["path"]
                or not isinstance(correction_reference.get("contentHash"), str)
                or len(correction_reference["contentHash"]) != 64
            ):
                fail("correctionReferenceInput is incomplete")
        started = timestamp(attempt.get("requestStartedAt"), "requestStartedAt")
        generated = timestamp(attempt.get("generationCompletedAt"), "generationCompletedAt")
        inspected = timestamp(attempt.get("inspectionCompletedAt"), "inspectionCompletedAt")
        if not started <= generated <= inspected:
            fail("attempt timestamps are not chronological")
        generation_ms = attempt.get("generationDurationMs")
        inspection_ms = attempt.get("inspectionDurationMs")
        total_ms = attempt.get("totalWallTimeMs")
        timings = (generation_ms, inspection_ms, total_ms)
        if not all(isinstance(item, int) and item >= 0 for item in timings):
            fail("attempt timings must be nonnegative integers")
        if abs((generated - started).total_seconds() * 1000 - generation_ms) > 2:
            fail("generationDurationMs does not match timestamps")
        if abs((inspected - generated).total_seconds() * 1000 - inspection_ms) > 2:
            fail("inspectionDurationMs does not match timestamps")
        if total_ms < generation_ms + inspection_ms:
            fail("attempt totalWallTimeMs is too short")
        output = attempt.get("output")
        source = attempt.get("sourceOutputId")
        persistence = attempt.get("persistence")
        if output is not None and (not isinstance(source, str) or not source):
            fail("every returned image requires a sourceOutputId")
        if output is not None and not isinstance(persistence, dict):
            fail("every retained image requires a persistence receipt")
        if output is None and persistence is not None:
            fail("an attempt without an output cannot claim persistence")
        if output is not None and persistence.get("retained") != output:
            fail("persistence.retained must exactly match output")
        if persistence is not None:
            if persistence.get("operation") not in {
                "exclusive-copy",
                "exclusive-normalize-format",
                "exclusive-resize-near-match",
            }:
                fail("persistence operation is invalid")
            if not isinstance(persistence.get("elapsedMs"), int) or persistence["elapsedMs"] <= 0:
                fail("persistence elapsedMs must be a positive integer")
            source_receipt = persistence.get("source")
            if not isinstance(source_receipt, dict) or not source_receipt.get("contentHash"):
                fail("persistence source receipt is incomplete")
        if output is None and conclusion == "accepted-by-producer":
            fail("an accepted attempt requires an output")
        if "retryReason" not in attempt:
            fail("every attempt requires retryReason, using null when no retry is requested")
        retry_reason = attempt["retryReason"]
        if retry_reason is not None and (
            not isinstance(retry_reason, str) or not retry_reason.strip()
        ):
            fail("retryReason must be null or a non-empty string")
        if conclusion == "rejected-by-producer" and retry_reason is None:
            fail("a rejected attempt requires a retryReason")
        findings = attempt.get("findings")
        if not isinstance(findings, list) or not findings:
            fail("every attempt requires criterion-bound findings")
        if any(
            not isinstance(finding, dict)
            or finding.get("outcome") not in {"pass", "concern", "fail", "not-applicable"}
            for finding in findings
        ):
            fail("attempt finding outcome is invalid")


def verify(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    workspace: Path,
) -> dict[str, Any]:
    target_report = validate(target, assignment, workspace, allow_existing_outputs=True)
    expected_result_path = absolute_project_path(workspace, target["output"]["resultPath"])
    if result_path.resolve() != expected_result_path:
        fail("RESULT argument does not match target.output.resultPath")
    if result.get("schemaVersion") != RESULT_VERSION:
        fail("unsupported result schemaVersion")
    if result.get("targetId") != target["targetId"]:
        fail("result targetId does not match target")
    if result.get("assignmentId") != assignment["assignmentId"]:
        fail("result assignmentId does not match assignment")
    if result.get("skillVersion") != assignment["skillVersion"]:
        fail("result skillVersion does not match assignment")
    status = result.get("status")
    if status not in {"candidate", "revise", "failed"}:
        fail("result status is invalid")
    if result.get("noSharedFilesEdited") is not True or result.get("selfPromoted") is not False:
        fail("result ownership attestations are invalid")

    verify_attempts(target, assignment, result)
    attempts: list[dict[str, Any]] = result["attempts"]
    attempt_by_id = {attempt["attemptId"]: attempt for attempt in attempts}
    selected_id = result.get("selectedAttemptId")
    failed_criteria = result.get("failedCriteria")
    if not isinstance(failed_criteria, list):
        fail("failedCriteria must be an array")
    known_criteria = {criterion["criterionId"] for criterion in target["acceptanceCriteria"]}
    if not set(failed_criteria) <= known_criteria:
        fail("failedCriteria contains an undeclared criterion")

    if status == "candidate":
        if selected_id not in attempt_by_id:
            fail("candidate requires a selected attempt")
        selected = attempt_by_id[selected_id]
        if selected["conclusion"] != "accepted-by-producer" or selected["output"] is None:
            fail("selected candidate attempt was not producer-accepted")
        if failed_criteria:
            fail("candidate cannot retain failed criteria")
        if any(finding.get("outcome") == "fail" for finding in selected["findings"]):
            fail("candidate cannot contain a failing selected-attempt finding")
        required_objective = {
            criterion["criterionId"]
            for criterion in target["acceptanceCriteria"]
            if criterion["required"] and criterion["kind"] == "objective"
        }
        passed = {
            finding.get("criterionId")
            for finding in selected["findings"]
            if finding.get("outcome") == "pass"
            and finding.get("evaluator") in {"producer", "automated"}
        }
        if not required_objective <= passed:
            fail("candidate does not pass every required objective criterion")
    elif status == "revise":
        if selected_id is not None or not failed_criteria:
            fail("revise requires no selected attempt and at least one failed criterion")
        if not any(attempt.get("output") is not None for attempt in attempts):
            fail("revise requires a generated review image")
    else:
        if selected_id is not None:
            fail("failed result cannot select an attempt")
        if any(attempt.get("conclusion") != "provider-failure" for attempt in attempts):
            fail("failed result may contain only provider-failure attempts")

    allowed_paths = set(assignment["permittedOutputs"].values())
    written = result.get("writtenOutputPaths")
    if not isinstance(written, list) or target["output"]["resultPath"] not in written:
        fail("writtenOutputPaths must contain the result path")
    if not set(written) <= allowed_paths:
        fail("result reports a write outside its assignment")

    candidate_path = target["output"]["candidatePath"]
    candidate_absolute = absolute_project_path(workspace, candidate_path)
    outputs = [attempt["output"] for attempt in attempts if attempt.get("output") is not None]
    if outputs:
        if candidate_path not in written or not candidate_absolute.is_file():
            fail("retained candidate path is missing")
        data = candidate_absolute.read_bytes()
        expected_canvas = target["presentation"]["canvas"]
        width, height = image_dimensions(candidate_absolute, expected_canvas["mediaType"])
        expected_output = {
            "path": candidate_path,
            "mediaType": expected_canvas["mediaType"],
            "width": width,
            "height": height,
            "bytes": len(data),
            "contentHash": hashlib.sha256(data).hexdigest(),
        }
        if (width, height) != (expected_canvas["width"], expected_canvas["height"]):
            fail("retained candidate dimensions do not match target canvas")
        if not any(output == expected_output for output in outputs):
            fail("no attempt output metadata matches the retained candidate")
    elif candidate_path in written or candidate_absolute.exists():
        fail("result claims no output but a candidate was written")

    started = timestamp(result.get("startedAt"), "startedAt")
    completed = timestamp(result.get("completedAt"), "completedAt")
    total_ms = result.get("totalWallTimeMs")
    if completed < started or not isinstance(total_ms, int) or total_ms < 0:
        fail("result time boundary is invalid")
    if abs((completed - started).total_seconds() * 1000 - total_ms) > 2:
        fail("result totalWallTimeMs does not match timestamps")

    return {
        **target_report,
        "status": status,
        "attempts": len(attempts),
        "selectedAttemptId": selected_id,
        "verification": "pass",
    }


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("usage: verify_result.py TARGET ASSIGNMENT RESULT WORKSPACE_ROOT")
    target_path = Path(sys.argv[1]).resolve()
    assignment_path = Path(sys.argv[2]).resolve()
    result_path = Path(sys.argv[3]).resolve()
    workspace = Path(sys.argv[4]).resolve()
    try:
        report = verify(
            load_json(target_path),
            load_json(assignment_path),
            load_json(result_path),
            result_path,
            workspace,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"result verification failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
