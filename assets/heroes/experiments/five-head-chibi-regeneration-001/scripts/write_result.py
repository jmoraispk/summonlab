#!/usr/bin/env python3
"""Write an exclusive, provenance-complete receipt for one provider call."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from contracts import CANVAS_HEIGHT, CANVAS_MIME_TYPE, CANVAS_WIDTH, ContractError, EXPERIMENT_ID, confine_relative, exclusive_write, sha256_file
from persist_candidate import load_assignment, load_target, readable_png


RESULT_SCHEMA = "five-head-chibi-result-v1"
CALL_SCHEMA = "five-head-chibi-provider-call-v1"
CALL_KINDS = frozenset({"primary", "provider-no-output-retry"})
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def _canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def _load_call(path: Path, assignment: dict[str, Any]) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ContractError("call record must be a regular file")
    try:
        call = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot read call record: {error}") from error
    if not isinstance(call, dict) or call.get("schemaVersion") != CALL_SCHEMA:
        raise ContractError("call record has an unsupported schemaVersion")
    for key in ("experimentId", "assignmentId", "targetId", "waveId"):
        if call.get(key) != assignment.get(key):
            raise ContractError(f"call record {key} does not bind to assignment")
    if call.get("callKind") not in CALL_KINDS:
        raise ContractError("call record callKind is not an allowed enum")
    if not isinstance(call.get("callOrdinal"), int) or call["callOrdinal"] < 1:
        raise ContractError("call record callOrdinal must be a positive integer")
    if call.get("outcome") != "succeeded":
        raise ContractError("only successful provider calls can write a result")
    metadata = call.get("providerMetadata")
    if not isinstance(metadata, dict) or not metadata.get("provider"):
        raise ContractError("call record lacks provider metadata")
    if not isinstance(call.get("returnedProviderArtifact"), str) or not call["returnedProviderArtifact"]:
        raise ContractError("successful call record lacks returned provider artifact")
    if not isinstance(metadata.get("externalArtifactSha256"), str) or SHA256_RE.fullmatch(metadata["externalArtifactSha256"]) is None:
        raise ContractError("successful call record lacks provider artifact digest")
    if not isinstance(call.get("startedAt"), str) or not isinstance(call.get("completedAt"), str):
        raise ContractError("call record lacks timestamps")
    return call


def write_result(assignment_path: Path, call_record_path: Path) -> Path:
    """Create the assignment's declared receipt, accepting only identical resumption."""
    assignment, experiment, workspace = load_assignment(assignment_path)
    target, target_path = load_target(assignment, experiment)
    call = _load_call(call_record_path, assignment)
    references = target.get("generationReferences")
    output = target.get("output")
    if not isinstance(references, list) or len(references) != 1 or not isinstance(references[0], dict) or references[0].get("role") != "sole-summon-authority":
        raise ContractError("target must declare exactly one sole summon reference")
    if not isinstance(output, dict) or output != {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT, "mimeType": CANVAS_MIME_TYPE}:
        raise ContractError("target output does not match the frozen PNG contract")
    prompt = target.get("renderedPrompt")
    if not isinstance(prompt, str) or target.get("renderedPromptSha256") != hashlib.sha256(prompt.encode()).hexdigest():
        raise ContractError("target rendered prompt hash is stale")
    provider_path = confine_relative(workspace, assignment["providerSourcePath"])
    candidate_path = confine_relative(workspace, assignment["candidatePath"])
    if provider_path.is_symlink() or candidate_path.is_symlink() or not provider_path.is_file() or not candidate_path.is_file():
        raise ContractError("persisted provider source and candidate are required")
    provider_bytes, candidate_bytes = provider_path.read_bytes(), candidate_path.read_bytes()
    if provider_bytes != candidate_bytes:
        raise ContractError("candidate bytes differ from retained provider source")
    width, height = readable_png(provider_bytes)
    if (width, height) != (CANVAS_WIDTH, CANVAS_HEIGHT):
        raise ContractError("persisted candidate dimensions differ from frozen contract")
    image_hash = hashlib.sha256(provider_bytes).hexdigest()
    if call["providerMetadata"]["externalArtifactSha256"] != image_hash:
        raise ContractError("provider artifact digest differs from retained provider source")
    result = {
        "schemaVersion": RESULT_SCHEMA, "experimentId": EXPERIMENT_ID,
        "assignmentId": assignment["assignmentId"], "targetId": target["targetId"], "waveId": assignment["waveId"],
        "targetSha256": sha256_file(target_path), "assignmentSha256": sha256_file(assignment_path),
        "renderedPrompt": prompt, "renderedPromptSha256": target["renderedPromptSha256"], "reference": references[0],
        "providerSourcePath": assignment["providerSourcePath"], "providerSourceSha256": image_hash,
        "candidatePath": assignment["candidatePath"], "candidateSha256": image_hash,
        "dimensions": {"width": width, "height": height}, "mimeType": CANVAS_MIME_TYPE,
        "providerMetadata": call["providerMetadata"], "callOrdinal": call["callOrdinal"], "callKind": call["callKind"],
        "startedAt": call["startedAt"], "completedAt": call["completedAt"],
        # Tie receipt publication to the immutable provider completion record so a
        # crash-resume produces identical receipt bytes rather than a new timestamp.
        "resultWrittenAt": call["completedAt"],
    }
    result_path = confine_relative(workspace, assignment["resultPath"])
    exclusive_write(result_path, _canonical(result))
    return result_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assignment", required=True, type=Path)
    parser.add_argument("--call-record", required=True, type=Path)
    args = parser.parse_args()
    print(write_result(args.assignment, args.call_record_path if hasattr(args, "call_record_path") else args.call_record))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
