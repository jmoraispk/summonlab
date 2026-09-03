#!/usr/bin/env python3
"""Strict, Heroes-local contracts for the overnight one-star image experiment."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import struct
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterator


EXPERIMENT_ID = "one-star-overnight-200-001"
EXPERIMENT_ROOT = f"assets/heroes/experiments/{EXPERIMENT_ID}"
SCHEMA_TARGET = "hero-one-star-image-target-v1"
SCHEMA_ASSIGNMENT = "hero-one-star-image-assignment-v1"
SCHEMA_RESULT = "hero-one-star-image-result-v1"
IMAGE_KINDS = {"summon", "combat-chibi"}
STATUSES = {"candidate", "revise", "failed"}
FAILURE_KINDS = {
    "capacity",
    "provider-throttle",
    "timeout",
    "malformed-output",
    "persistence",
    "other",
}
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,79}$")
WAVE_RE = re.compile(r"^wave-(0[1-9]|1[0-9]|20)$")

BODY_TYPES = {
    "healthy-slight-lanky",
    "ordinary-average",
    "soft-round",
    "sturdy-stocky",
    "plus-size-heavy",
    "athletic-conditioned",
    "clearly-muscular",
    "extreme-bodybuilder",
}
HEIGHT_BANDS = {"very-short", "short", "medium", "tall", "very-tall"}
HAIR_COLORS = {
    "black",
    "dark-brown",
    "brown-chestnut",
    "blonde-gold",
    "red-copper-auburn",
    "gray-white-silver",
    "blue-teal",
    "violet-plum-pink",
    "multicolor-split-streak",
}
HAIR_SILHOUETTES = {
    "shaved-close-cropped",
    "short-textured-crop",
    "bob-pageboy",
    "medium-loose",
    "long-loose",
    "braids-twists-locs",
    "curls-coils-halo",
    "bun-topknot-wrapped",
    "asymmetric-extreme",
}
WARDROBE_FAMILIES = {
    "layered-wrap",
    "short-jacket-trousers",
    "tailored-longcoat",
    "tunic-tabard",
    "apron-workwear-layers",
    "quilted-outerwear",
    "draped-robe",
    "mantle-short-cape",
    "fitted-vest-system",
    "asymmetric-patchwork",
}
PALETTE_FAMILIES = {
    "ochre-cream",
    "rust-charcoal",
    "teal-brown",
    "indigo-sand",
    "plum-gray",
    "moss-ivory",
    "marigold-green",
    "oxblood-navy",
    "lilac-smoke",
    "terracotta-black",
}
COOLNESS_ANCHORS = {
    "hairstyle-construction",
    "garment-silhouette",
    "color-blocking",
    "textile-detail",
    "body-or-posture",
    "repairs-patina-keepsake",
    "jewelry-hardware",
    "durable-body-marking",
}
REFERENCE_ROLES = {
    "rendering-style",
    "identity-anatomy-authority",
    "correction-source",
}
FINDING_OUTCOMES = {"pass", "concern", "fail", "not-applicable"}
FINDING_EVALUATORS = {"producer", "automated", "inspector"}

REQUIRED_FORBIDDEN_PATHS = {
    f"{EXPERIMENT_ROOT}/roster-plan.json",
    f"{EXPERIMENT_ROOT}/production-report.json",
    f"{EXPERIMENT_ROOT}/provenance/production-journal.jsonl",
    f"{EXPERIMENT_ROOT}/review/index.html",
    f"{EXPERIMENT_ROOT}/review/quarantine.html",
}


class ContractError(ValueError):
    """Raised when an immutable production contract is invalid."""


def _fail(message: str) -> None:
    raise ContractError(message)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"cannot read JSON {path}: {error}") from error


def _object(value: Any, label: str, keys: set[str], optional: set[str] | None = None) -> dict[str, Any]:
    if not isinstance(value, dict):
        _fail(f"{label} must be an object")
    optional = optional or set()
    missing = keys - set(value)
    extra = set(value) - keys - optional
    if missing:
        _fail(f"{label} is missing fields: {', '.join(sorted(missing))}")
    if extra:
        _fail(f"{label} has unknown fields: {', '.join(sorted(extra))}")
    return value


def _string(value: Any, label: str, maximum: int = 4000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        _fail(f"{label} must be nonempty text of at most {maximum} characters")
    return value


def _slug(value: Any, label: str) -> str:
    text = _string(value, label, 80)
    if not SLUG_RE.fullmatch(text):
        _fail(f"{label} must be a lowercase slug")
    return text


def _sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA256_RE.fullmatch(value):
        _fail(f"{label} must be a lowercase SHA-256 digest")
    return value


def _integer(value: Any, label: str, low: int, high: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        _fail(f"{label} must be an integer from {low} through {high}")
    return value


def _enum(value: Any, label: str, choices: set[str]) -> str:
    if value not in choices:
        _fail(f"{label} must be one of: {', '.join(sorted(choices))}")
    return value


def _string_list(value: Any, label: str, minimum: int = 0, maximum: int = 30) -> list[str]:
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        _fail(f"{label} must contain {minimum} through {maximum} entries")
    return [_string(entry, f"{label}[{index}]", 1000) for index, entry in enumerate(value)]


def validate_repo_path(value: Any, label: str, *, prefix: str = EXPERIMENT_ROOT) -> str:
    path = _string(value, label, 500)
    if "\\" in path or path.startswith("/"):
        _fail(f"{label} must be a repository-relative POSIX path")
    parts = PurePosixPath(path).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        _fail(f"{label} is not normalized")
    if path != "/".join(parts) or not path.startswith(f"{prefix}/"):
        _fail(f"{label} must remain beneath {prefix}")
    return path


def target_path_for(wave_id: str, hero_id: str, image_kind: str, version: int) -> str:
    return f"{EXPERIMENT_ROOT}/waves/{wave_id}/targets/{hero_id}/{image_kind}-v{version}.json"


def assignment_path_for(wave_id: str, hero_id: str, image_kind: str, version: int) -> str:
    return f"{EXPERIMENT_ROOT}/waves/{wave_id}/assignments/{hero_id}/{image_kind}-v{version}.json"


def candidate_path_for(wave_id: str, hero_id: str, image_kind: str, version: int) -> str:
    return f"{EXPERIMENT_ROOT}/waves/{wave_id}/candidates/{hero_id}/{image_kind}-v{version}.png"


def result_path_for(wave_id: str, hero_id: str, image_kind: str, version: int) -> str:
    return f"{EXPERIMENT_ROOT}/waves/{wave_id}/results/{hero_id}/{image_kind}-v{version}.json"


def _validate_reference(value: Any, label: str) -> dict[str, Any]:
    reference = _object(value, label, {"path", "sha256", "purpose", "role"})
    validate_repo_path(reference["path"], f"{label}.path", prefix="assets")
    _sha(reference["sha256"], f"{label}.sha256")
    _string(reference["purpose"], f"{label}.purpose", 1000)
    _enum(reference["role"], f"{label}.role", REFERENCE_ROLES)
    return reference


def _validate_source(value: Any, label: str) -> dict[str, Any]:
    source = _object(value, label, {"targetId", "resultPath", "candidatePath", "sha256"})
    _slug(source["targetId"], f"{label}.targetId")
    validate_repo_path(source["resultPath"], f"{label}.resultPath")
    validate_repo_path(source["candidatePath"], f"{label}.candidatePath")
    _sha(source["sha256"], f"{label}.sha256")
    return source


def _validate_hero_spec(value: Any) -> dict[str, Any]:
    spec = _object(
        value,
        "target.heroSpec",
        {"identity", "physique", "hair", "wardrobe", "details", "kernel"},
    )
    identity = _object(
        spec["identity"],
        "target.heroSpec.identity",
        {"displayName", "gender", "age", "skinValueBand", "faceDescription", "identitySignature"},
    )
    _string(identity["displayName"], "target.heroSpec.identity.displayName", 120)
    _enum(identity["gender"], "target.heroSpec.identity.gender", {"man", "woman"})
    _integer(identity["age"], "target.heroSpec.identity.age", 18, 42)
    _integer(identity["skinValueBand"], "target.heroSpec.identity.skinValueBand", 1, 6)
    _string(identity["faceDescription"], "target.heroSpec.identity.faceDescription", 1000)
    _string(identity["identitySignature"], "target.heroSpec.identity.identitySignature", 1000)

    physique = _object(spec["physique"], "target.heroSpec.physique", {"bodyType", "heightBand", "description"})
    _enum(physique["bodyType"], "target.heroSpec.physique.bodyType", BODY_TYPES)
    _enum(physique["heightBand"], "target.heroSpec.physique.heightBand", HEIGHT_BANDS)
    _string(physique["description"], "target.heroSpec.physique.description", 1000)

    hair = _object(spec["hair"], "target.heroSpec.hair", {"colorFamily", "silhouetteFamily", "accent", "chibiReadability"})
    _enum(hair["colorFamily"], "target.heroSpec.hair.colorFamily", HAIR_COLORS)
    _enum(hair["silhouetteFamily"], "target.heroSpec.hair.silhouetteFamily", HAIR_SILHOUETTES)
    if hair["accent"] is not None:
        _string(hair["accent"], "target.heroSpec.hair.accent", 300)
    _string(hair["chibiReadability"], "target.heroSpec.hair.chibiReadability", 1000)

    wardrobe = _object(spec["wardrobe"], "target.heroSpec.wardrobe", {"family", "paletteFamily", "description", "condition"})
    _enum(wardrobe["family"], "target.heroSpec.wardrobe.family", WARDROBE_FAMILIES)
    _enum(wardrobe["paletteFamily"], "target.heroSpec.wardrobe.paletteFamily", PALETTE_FAMILIES)
    _string(wardrobe["description"], "target.heroSpec.wardrobe.description", 1500)
    _string(wardrobe["condition"], "target.heroSpec.wardrobe.condition", 500)

    details = _object(spec["details"], "target.heroSpec.details", {"density", "tattooScope", "anchors", "coolnessAnchor"})
    _integer(details["density"], "target.heroSpec.details.density", 0, 3)
    _enum(details["tattooScope"], "target.heroSpec.details.tattooScope", {"none", "bounded", "extensive"})
    anchors = _string_list(details["anchors"], "target.heroSpec.details.anchors", 0, 3)
    if len(anchors) != details["density"]:
        _fail("target.heroSpec.details.anchors count must equal density")
    _enum(details["coolnessAnchor"], "target.heroSpec.details.coolnessAnchor", COOLNESS_ANCHORS)

    kernel = _object(
        spec["kernel"],
        "target.heroSpec.kernel",
        {
            "dominantTrait", "counterTrait", "tension", "socialPresentation",
            "groomingAttitude", "colorOrnamentTaste", "culturalFragments",
            "lifeEcho", "poseCue", "nonInference",
        },
    )
    for key in {
        "dominantTrait", "counterTrait", "tension", "socialPresentation",
        "groomingAttitude", "colorOrnamentTaste", "lifeEcho", "poseCue", "nonInference",
    }:
        _string(kernel[key], f"target.heroSpec.kernel.{key}", 1000)
    _string_list(kernel["culturalFragments"], "target.heroSpec.kernel.culturalFragments", 2, 2)
    return spec


def validate_target(value: Any, *, expected_path: str | None = None) -> dict[str, Any]:
    target = _object(
        value,
        "target",
        {
            "schemaVersion", "targetId", "targetVersion", "experimentId", "waveId",
            "heroId", "imageKind", "starLevel", "productionState", "heroSpec",
            "references", "canonicalPrompt", "presentation", "acceptanceCriteria",
            "sourceSummon", "correctionSource", "output",
        },
    )
    if target["schemaVersion"] != SCHEMA_TARGET or target["experimentId"] != EXPERIMENT_ID:
        _fail("target schemaVersion or experimentId is invalid")
    _slug(target["targetId"], "target.targetId")
    version = _integer(target["targetVersion"], "target.targetVersion", 1, 99)
    if not isinstance(target["waveId"], str) or not WAVE_RE.fullmatch(target["waveId"]):
        _fail("target.waveId must be wave-01 through wave-20")
    hero_id = _slug(target["heroId"], "target.heroId")
    image_kind = _enum(target["imageKind"], "target.imageKind", IMAGE_KINDS)
    if target["starLevel"] != 1 or target["productionState"] != "candidate-only":
        _fail("target must remain candidate-only at one star")
    _validate_hero_spec(target["heroSpec"])

    references = target["references"]
    if not isinstance(references, list) or not 1 <= len(references) <= 10:
        _fail("target.references must contain 1 through 10 entries")
    for index, reference in enumerate(references):
        _validate_reference(reference, f"target.references[{index}]")
    reference_paths = [entry["path"] for entry in references]
    if len(reference_paths) != len(set(reference_paths)):
        _fail("target reference paths must be unique and ordered")

    prompt = _object(target["canonicalPrompt"], "target.canonicalPrompt", {"text", "sha256"})
    prompt_text = _string(prompt["text"], "target.canonicalPrompt.text", 30000)
    if sha256_bytes(prompt_text.encode("utf-8")) != _sha(prompt["sha256"], "target.canonicalPrompt.sha256"):
        _fail("target canonical prompt hash mismatch")

    presentation = _object(target["presentation"], "target.presentation", {"width", "height", "mediaType", "composition", "negativeConstraints"})
    if presentation["width"] != 1024 or presentation["height"] != 1536 or presentation["mediaType"] != "image/png":
        _fail("target presentation must be exactly 1024x1536 image/png")
    _string(presentation["composition"], "target.presentation.composition", 2000)
    _string_list(presentation["negativeConstraints"], "target.presentation.negativeConstraints", 1, 40)

    criteria = target["acceptanceCriteria"]
    if not isinstance(criteria, list) or not 1 <= len(criteria) <= 40:
        _fail("target.acceptanceCriteria must contain 1 through 40 entries")
    criterion_ids: list[str] = []
    for index, raw in enumerate(criteria):
        criterion = _object(raw, f"target.acceptanceCriteria[{index}]", {"criterionId", "description", "required"})
        criterion_ids.append(_slug(criterion["criterionId"], f"target.acceptanceCriteria[{index}].criterionId"))
        _string(criterion["description"], f"target.acceptanceCriteria[{index}].description", 1000)
        if not isinstance(criterion["required"], bool):
            _fail(f"target.acceptanceCriteria[{index}].required must be boolean")
    if len(criterion_ids) != len(set(criterion_ids)):
        _fail("target acceptance criterion IDs must be unique")

    source_summon = target["sourceSummon"]
    if image_kind == "summon":
        if source_summon is not None:
            _fail("summon targets cannot declare sourceSummon")
    else:
        if source_summon is None:
            _fail("combat-chibi targets require sourceSummon")
        _validate_source(source_summon, "target.sourceSummon")
        matching_identity = [
            entry for entry in references
            if entry["role"] == "identity-anatomy-authority"
            and entry["path"] == source_summon["candidatePath"]
            and entry["sha256"] == source_summon["sha256"]
        ]
        if len(matching_identity) != 1:
            _fail("combat-chibi must bind its exact summon as identity-anatomy authority")

    correction = target["correctionSource"]
    if version == 1 and correction is not None:
        _fail("version-one targets cannot declare correctionSource")
    if version > 1:
        if correction is None:
            _fail("revised targets require correctionSource")
        _validate_source(correction, "target.correctionSource")
        matching_correction = [
            entry for entry in references
            if entry["role"] == "correction-source"
            and entry["path"] == correction["candidatePath"]
            and entry["sha256"] == correction["sha256"]
        ]
        if len(matching_correction) != 1:
            _fail("revised target must bind its exact preceding candidate as correction source")

    output = _object(target["output"], "target.output", {"candidatePath", "resultPath"})
    validate_repo_path(output["candidatePath"], "target.output.candidatePath")
    validate_repo_path(output["resultPath"], "target.output.resultPath")
    expected_candidate = candidate_path_for(target["waveId"], hero_id, image_kind, version)
    expected_result = result_path_for(target["waveId"], hero_id, image_kind, version)
    if output != {"candidatePath": expected_candidate, "resultPath": expected_result}:
        _fail("target output paths do not match the Heroes experiment template")
    expected_target_path = target_path_for(target["waveId"], hero_id, image_kind, version)
    if expected_path is not None and expected_path != expected_target_path:
        _fail(f"target is stored at the wrong path; expected {expected_target_path}")
    return target


def validate_assignment(value: Any, target: dict[str, Any], *, expected_path: str | None = None) -> dict[str, Any]:
    assignment = _object(
        value,
        "assignment",
        {
            "schemaVersion", "assignmentId", "experimentId", "targetId", "targetPath",
            "targetSha256", "producerId", "assignedAt", "dryRun", "retryCeiling",
            "permittedOutputs", "forbiddenSharedPaths", "completionContract",
        },
    )
    if assignment["schemaVersion"] != SCHEMA_ASSIGNMENT or assignment["experimentId"] != EXPERIMENT_ID:
        _fail("assignment schemaVersion or experimentId is invalid")
    _slug(assignment["assignmentId"], "assignment.assignmentId")
    if assignment["targetId"] != target["targetId"]:
        _fail("assignment targetId does not match target")
    target_path = target_path_for(target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"])
    if validate_repo_path(assignment["targetPath"], "assignment.targetPath") != target_path:
        _fail("assignment targetPath does not match target location")
    if _sha(assignment["targetSha256"], "assignment.targetSha256") != sha256_json(target):
        _fail("assignment targetSha256 does not match canonical target")
    _slug(assignment["producerId"], "assignment.producerId")
    _string(assignment["assignedAt"], "assignment.assignedAt", 80)
    if not isinstance(assignment["dryRun"], bool):
        _fail("assignment.dryRun must be boolean")
    _integer(assignment["retryCeiling"], "assignment.retryCeiling", 0, 1)
    if assignment["permittedOutputs"] != target["output"]:
        _fail("assignment permittedOutputs must exactly match target output")
    forbidden = assignment["forbiddenSharedPaths"]
    if not isinstance(forbidden, list):
        _fail("assignment.forbiddenSharedPaths must be an array")
    for index, path in enumerate(forbidden):
        validate_repo_path(path, f"assignment.forbiddenSharedPaths[{index}]")
    if not REQUIRED_FORBIDDEN_PATHS.issubset(set(forbidden)):
        _fail("assignment does not protect every required shared Heroes path")
    if set(target["output"].values()) & set(forbidden):
        _fail("an owned output cannot also be forbidden")
    completion = _object(
        assignment["completionContract"],
        "assignment.completionContract",
        {"oneTargetOneImage", "structuredResultRequired", "sharedFilesMustRemainUntouched", "candidateOnly", "selfPromotionForbidden"},
    )
    if any(value is not True for value in completion.values()):
        _fail("every assignment completion contract flag must be true")
    expected_assignment_path = assignment_path_for(target["waveId"], target["heroId"], target["imageKind"], target["targetVersion"])
    if expected_path is not None and expected_path != expected_assignment_path:
        _fail(f"assignment is stored at the wrong path; expected {expected_assignment_path}")
    return assignment


def _validate_output(value: Any, label: str, expected_path: str) -> dict[str, Any]:
    output = _object(value, label, {"path", "mediaType", "width", "height", "bytes", "sha256"})
    if validate_repo_path(output["path"], f"{label}.path") != expected_path:
        _fail(f"{label}.path does not match the owned candidate")
    if output["mediaType"] != "image/png" or output["width"] != 1024 or output["height"] != 1536:
        _fail(f"{label} must describe a 1024x1536 PNG")
    _integer(output["bytes"], f"{label}.bytes", 1, 1_000_000_000)
    _sha(output["sha256"], f"{label}.sha256")
    return output


def validate_result(value: Any, target: dict[str, Any], assignment: dict[str, Any]) -> dict[str, Any]:
    result = _object(
        value,
        "result",
        {
            "schemaVersion", "resultId", "experimentId", "targetId", "targetSha256",
            "assignmentId", "assignmentSha256", "producerId", "status", "attempts",
            "selectedAttemptId", "failedCriteria", "candidate", "startedAt", "completedAt",
            "totalWallTimeMs", "writtenOutputPaths", "attestations",
        },
    )
    if result["schemaVersion"] != SCHEMA_RESULT or result["experimentId"] != EXPERIMENT_ID:
        _fail("result schemaVersion or experimentId is invalid")
    _slug(result["resultId"], "result.resultId")
    if result["targetId"] != target["targetId"] or result["targetSha256"] != sha256_json(target):
        _fail("result does not bind the canonical target")
    if result["assignmentId"] != assignment["assignmentId"] or result["assignmentSha256"] != sha256_json(assignment):
        _fail("result does not bind the canonical assignment")
    if result["producerId"] != assignment["producerId"]:
        _fail("result producerId differs from assignment")
    status_value = _enum(result["status"], "result.status", STATUSES)
    attempts = result["attempts"]
    if not isinstance(attempts, list) or not 1 <= len(attempts) <= assignment["retryCeiling"] + 1:
        _fail("result attempt count exceeds assignment retry ceiling")
    returned_image_attempts = 0
    attempt_ids: list[str] = []
    criterion_ids = {criterion["criterionId"] for criterion in target["acceptanceCriteria"]}
    for index, raw in enumerate(attempts):
        attempt = _object(
            raw,
            f"result.attempts[{index}]",
            {
                "attemptId", "attemptNumber", "precedingAttemptId", "conclusion", "failureKind",
                "exactPrompt", "promptSha256", "referenceInputs", "requestStartedAt",
                "generationCompletedAt", "inspectionCompletedAt", "generationDurationMs",
                "inspectionDurationMs", "totalWallTimeMs", "sourceOutput", "persistence",
                "findings", "retryReason",
            },
        )
        attempt_id = _slug(attempt["attemptId"], f"result.attempts[{index}].attemptId")
        attempt_ids.append(attempt_id)
        if attempt["attemptNumber"] != index + 1:
            _fail("result attempt numbers must be contiguous")
        expected_preceding = None if index == 0 else attempt_ids[index - 1]
        if attempt["precedingAttemptId"] != expected_preceding:
            _fail("result attempts must link to their immediate predecessor")
        conclusion = _enum(
            attempt["conclusion"],
            f"result.attempts[{index}].conclusion",
            {"accepted-by-producer", "rejected-by-producer", "provider-failure"},
        )
        if conclusion == "provider-failure":
            _enum(attempt["failureKind"], f"result.attempts[{index}].failureKind", FAILURE_KINDS)
        elif attempt["failureKind"] is not None:
            _fail("only provider-failure attempts may declare failureKind")
        prompt = _string(attempt["exactPrompt"], f"result.attempts[{index}].exactPrompt", 30000)
        if sha256_bytes(prompt.encode("utf-8")) != _sha(attempt["promptSha256"], f"result.attempts[{index}].promptSha256"):
            _fail("attempt prompt hash mismatch")
        if prompt != target["canonicalPrompt"]["text"] or attempt["promptSha256"] != target["canonicalPrompt"]["sha256"]:
            _fail("attempt prompt differs from the immutable target prompt")
        expected_refs = [{"path": entry["path"], "sha256": entry["sha256"]} for entry in target["references"]]
        if attempt["referenceInputs"] != expected_refs:
            _fail("attempt references must match target references in manifest order")
        for key in {"requestStartedAt", "generationCompletedAt", "inspectionCompletedAt"}:
            _string(attempt[key], f"result.attempts[{index}].{key}", 80)
        for key in {"generationDurationMs", "inspectionDurationMs", "totalWallTimeMs"}:
            _integer(attempt[key], f"result.attempts[{index}].{key}", 0, 86_400_000)
        if attempt["totalWallTimeMs"] < attempt["generationDurationMs"] + attempt["inspectionDurationMs"]:
            _fail("attempt wall time is shorter than generation plus inspection")
        source_output = attempt["sourceOutput"]
        persistence = attempt["persistence"]
        if conclusion == "provider-failure":
            if source_output is not None or persistence is not None:
                _fail("provider failures cannot claim image output or persistence")
        else:
            if source_output is None or persistence is None:
                _fail("an image-returning attempt requires source output and persistence")
            returned_image_attempts += 1
            source = _object(source_output, f"result.attempts[{index}].sourceOutput", {"outputId", "path", "mediaType", "width", "height", "bytes", "sha256"})
            _string(source["outputId"], f"result.attempts[{index}].sourceOutput.outputId", 300)
            source_path = _string(source["path"], f"result.attempts[{index}].sourceOutput.path", 1000)
            if not os.path.isabs(source_path):
                _fail("sourceOutput.path must be the exact absolute provider path")
            if source["mediaType"] != "image/png" or source["width"] != 1024 or source["height"] != 1536:
                _fail("sourceOutput must describe a 1024x1536 PNG")
            _integer(source["bytes"], f"result.attempts[{index}].sourceOutput.bytes", 1, 1_000_000_000)
            _sha(source["sha256"], f"result.attempts[{index}].sourceOutput.sha256")
            receipt = _object(persistence, f"result.attempts[{index}].persistence", {"operation", "source", "retained"})
            if receipt["operation"] != "anchored-exclusive-copy":
                _fail("Heroes persistence must retain exact source bytes")
            if receipt["source"] != source_output:
                _fail("persistence source must exactly equal sourceOutput")
            retained = _validate_output(receipt["retained"], f"result.attempts[{index}].persistence.retained", target["output"]["candidatePath"])
            for key in {"mediaType", "width", "height", "bytes", "sha256"}:
                if retained[key] != source_output[key]:
                    _fail("exact-copy persistence metadata must equal source output metadata")
        findings = attempt["findings"]
        if not isinstance(findings, list) or not findings:
            _fail("every attempt requires inspection findings")
        for finding_index, raw_finding in enumerate(findings):
            finding = _object(raw_finding, f"result.attempts[{index}].findings[{finding_index}]", {"criterionId", "evaluator", "outcome", "observation"})
            if finding["criterionId"] not in criterion_ids:
                _fail("attempt finding names an unknown acceptance criterion")
            _enum(finding["evaluator"], "finding.evaluator", FINDING_EVALUATORS)
            _enum(finding["outcome"], "finding.outcome", FINDING_OUTCOMES)
            _string(finding["observation"], "finding.observation", 1000)
        if conclusion == "rejected-by-producer" and attempt["retryReason"] is None:
            _fail("rejected image attempts require retryReason")
        if conclusion != "rejected-by-producer" and attempt["retryReason"] is not None:
            _fail("only rejected image attempts may declare retryReason")
    if len(attempt_ids) != len(set(attempt_ids)):
        _fail("result attempt IDs must be unique")
    if returned_image_attempts > 1:
        _fail("an assignment may return at most one image; visual corrections require a new target version")

    failed = result["failedCriteria"]
    if not isinstance(failed, list) or any(item not in criterion_ids for item in failed) or len(failed) != len(set(failed)):
        _fail("result.failedCriteria must contain unique target criterion IDs")
    candidate = result["candidate"]
    selected = result["selectedAttemptId"]
    if status_value == "candidate":
        if candidate is None or selected not in attempt_ids or failed:
            _fail("candidate result requires a selected attempt, candidate metadata, and no failed criteria")
        _validate_output(candidate, "result.candidate", target["output"]["candidatePath"])
        selected_attempt = attempts[attempt_ids.index(selected)]
        if selected_attempt["conclusion"] != "accepted-by-producer":
            _fail("selected candidate attempt must be accepted by producer")
        if candidate != selected_attempt["persistence"]["retained"]:
            _fail("candidate metadata must equal the selected persistence receipt")
        finding_map = {(finding["criterionId"], finding["outcome"]) for finding in selected_attempt["findings"]}
        for criterion in target["acceptanceCriteria"]:
            if criterion["required"] and (criterion["criterionId"], "pass") not in finding_map:
                _fail(f"candidate did not pass required criterion {criterion['criterionId']}")
    elif status_value == "revise":
        if candidate is None or selected is not None or not failed:
            _fail("revise result requires retained candidate metadata, failures, and no selected attempt")
        _validate_output(candidate, "result.candidate", target["output"]["candidatePath"])
        returned = next((attempt for attempt in attempts if attempt["persistence"] is not None), None)
        if returned is None or candidate != returned["persistence"]["retained"]:
            _fail("revise candidate metadata must equal its persistence receipt")
    else:
        if candidate is not None or selected is not None or not failed:
            _fail("failed result requires no candidate, no selected attempt, and failed criteria")

    for key in {"startedAt", "completedAt"}:
        _string(result[key], f"result.{key}", 80)
    _integer(result["totalWallTimeMs"], "result.totalWallTimeMs", 0, 172_800_000)
    expected_written = [target["output"]["resultPath"]]
    if candidate is not None:
        expected_written.insert(0, target["output"]["candidatePath"])
    if result["writtenOutputPaths"] != expected_written:
        _fail("result.writtenOutputPaths does not match owned outputs")
    attestations = _object(result["attestations"], "result.attestations", {"noSharedFilesEdited", "selfPromoted", "candidateOnly"})
    if attestations != {"noSharedFilesEdited": True, "selfPromoted": False, "candidateOnly": True}:
        _fail("result attestations violate candidate-only ownership")
    return result


def workspace_relative(workspace: Path, path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(workspace.resolve(strict=True)).as_posix()
    except ValueError as error:
        raise ContractError(f"path is outside workspace: {path}") from error


def ensure_no_symlink_path(
    workspace: Path,
    relative_path: str,
    *,
    allow_missing_leaf: bool,
    prefix: str = EXPERIMENT_ROOT,
) -> Path:
    validate_repo_path(relative_path, "repository path", prefix=prefix)
    if workspace.is_symlink() or not workspace.is_dir():
        _fail("workspace root must be a real directory")
    cursor = workspace
    parts = PurePosixPath(relative_path).parts
    for index, component in enumerate(parts):
        cursor = cursor / component
        try:
            metadata = cursor.lstat()
        except FileNotFoundError:
            if allow_missing_leaf or index < len(parts) - 1:
                continue
            raise
        if stat.S_ISLNK(metadata.st_mode):
            _fail(f"path traverses a symbolic link: {relative_path}")
        if index < len(parts) - 1 and not stat.S_ISDIR(metadata.st_mode):
            _fail(f"path parent is not a directory: {relative_path}")
    return cursor


def png_dimensions(payload: bytes) -> tuple[int, int]:
    if len(payload) < 33 or payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
        _fail("source is not a structurally recognizable PNG")
    width, height = struct.unpack(">II", payload[16:24])
    return width, height


@dataclass(frozen=True)
class CreatedFile:
    path: str
    bytes: int
    sha256: str
    device: int
    inode: int


@contextmanager
def _anchored_parent(
    workspace: Path,
    relative_path: str,
    *,
    create: bool,
    prefix: str = EXPERIMENT_ROOT,
) -> Iterator[tuple[int, str]]:
    validate_repo_path(relative_path, "repository path", prefix=prefix)
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    descriptors: list[int] = []
    current = os.open(workspace, flags)
    descriptors.append(current)
    try:
        parts = list(PurePosixPath(relative_path).parts)
        for component in parts[:-1]:
            try:
                child = os.open(component, flags, dir_fd=current)
            except FileNotFoundError:
                if not create:
                    raise
                os.mkdir(component, mode=0o755, dir_fd=current)
                child = os.open(component, flags, dir_fd=current)
            descriptors.append(child)
            current = child
        yield current, parts[-1]
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def anchored_read(workspace: Path, relative_path: str, *, prefix: str = EXPERIMENT_ROOT) -> bytes:
    with _anchored_parent(workspace, relative_path, create=False, prefix=prefix) as (parent, name):
        descriptor = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent)
        try:
            metadata = os.fstat(descriptor)
            if not stat.S_ISREG(metadata.st_mode):
                _fail(f"expected regular file: {relative_path}")
            chunks: list[bytes] = []
            while True:
                chunk = os.read(descriptor, 1024 * 1024)
                if not chunk:
                    break
                chunks.append(chunk)
            return b"".join(chunks)
        finally:
            os.close(descriptor)


def anchored_exclusive_create(workspace: Path, relative_path: str, payload: bytes) -> CreatedFile:
    with _anchored_parent(workspace, relative_path, create=True) as (parent, name):
        descriptor = os.open(
            name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o644,
            dir_fd=parent,
        )
        created_metadata = os.fstat(descriptor)

        def cleanup_owned_inode() -> None:
            try:
                current = os.stat(name, dir_fd=parent, follow_symlinks=False)
                if (current.st_dev, current.st_ino) == (
                    created_metadata.st_dev,
                    created_metadata.st_ino,
                ):
                    os.unlink(name, dir_fd=parent)
            except OSError:
                pass

        try:
            view = memoryview(payload)
            while view:
                written = os.write(descriptor, view)
                view = view[written:]
            os.fsync(descriptor)
        except BaseException:
            cleanup_owned_inode()
            raise
        finally:
            os.close(descriptor)

        try:
            with _anchored_parent(workspace, relative_path, create=False) as (
                rebound_parent,
                rebound_name,
            ):
                held_parent_metadata = os.fstat(parent)
                rebound_parent_metadata = os.fstat(rebound_parent)
                if (held_parent_metadata.st_dev, held_parent_metadata.st_ino) != (
                    rebound_parent_metadata.st_dev,
                    rebound_parent_metadata.st_ino,
                ):
                    _fail(f"created parent was replaced during verification: {relative_path}")
                visible = os.open(
                    rebound_name,
                    os.O_RDONLY | os.O_NOFOLLOW,
                    dir_fd=rebound_parent,
                )
                try:
                    visible_metadata = os.fstat(visible)
                    if (visible_metadata.st_dev, visible_metadata.st_ino) != (
                        created_metadata.st_dev,
                        created_metadata.st_ino,
                    ):
                        _fail(f"created path was replaced during verification: {relative_path}")
                    chunks: list[bytes] = []
                    while True:
                        chunk = os.read(visible, 1024 * 1024)
                        if not chunk:
                            break
                        chunks.append(chunk)
                    if b"".join(chunks) != payload:
                        _fail(f"created bytes changed during verification: {relative_path}")
                finally:
                    os.close(visible)
        except BaseException:
            cleanup_owned_inode()
            raise
        return CreatedFile(
            path=relative_path,
            bytes=len(payload),
            sha256=sha256_bytes(payload),
            device=created_metadata.st_dev,
            inode=created_metadata.st_ino,
        )
