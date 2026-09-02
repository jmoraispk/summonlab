#!/usr/bin/env python3
"""Validate common Summonlab image target and assignment invariants."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

TARGET_VERSIONS = {"image-production-target-v1", "image-production-target-v2"}
ASSIGNMENT_VERSION = "image-production-assignment-v1"
FAMILY_TARGET_VERSION = "family-affinity-target-v1"
FAMILY_ASSIGNMENT_VERSION = "family-affinity-assignment-v1"
FAMILY_PROFILE = "image-production-family-target-v1"
FAMILY_ROOT = "assets/enemies/experiments/family-affinity-v1"
FAMILY_AFFINITIES = ("normal", "fire", "earth", "wind", "water")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{1,79}$")
SHA_PATTERN = re.compile(r"^[a-f0-9]{64}$")


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


def canonical_json(value: Any) -> str:
    """Match the repository's stableFamilyAffinityJson byte contract."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    missing = expected - set(value)
    unexpected = set(value) - expected
    if missing:
        fail(f"{label} is missing fields: {', '.join(sorted(missing))}")
    if unexpected:
        fail(f"{label} has unexpected fields: {', '.join(sorted(unexpected))}")


def require_sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA_PATTERN.fullmatch(value):
        fail(f"{label} must be a lowercase SHA-256")
    return value


def ensure_owned_path_has_no_symlink(workspace: Path, raw: str) -> Path:
    relative = project_path(raw)
    current = workspace
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            fail(f"owned path traverses a symlink: {raw}")
    return absolute_project_path(workspace, raw)


def family_paths(target: dict[str, Any]) -> dict[str, str]:
    version = target["version"]
    affinity = target["affinity"]
    if target["namespace"] == "canonical":
        stem = f'{target["familyId"]}/{target["formId"]}/{affinity}'
        review_stem = stem
        return {
            "target": f"{FAMILY_ROOT}/targets/{stem}/target-v{version}.json",
            "assignment": f"{FAMILY_ROOT}/assignments/{stem}/assignment-v{version}.json",
            "candidate": f"{FAMILY_ROOT}/candidates/{stem}-v{version}.png",
            "result": f"{FAMILY_ROOT}/results/{stem}-v{version}.json",
            "decision": (
                f"{FAMILY_ROOT}/review/decisions/{review_stem}/"
                f"candidate-v{version}-review-v{version}.json"
            ),
            "blindReview": (
                f"{FAMILY_ROOT}/review/blind/{review_stem}/"
                f"candidate-v{version}-blind-v{version}.json"
            ),
        }
    current_class = target["currentClassId"]
    stem = f"{current_class}/{affinity}"
    return {
        "target": f"{FAMILY_ROOT}/bridge/targets/{stem}/target-v{version}.json",
        "assignment": f"{FAMILY_ROOT}/bridge/assignments/{stem}/assignment-v{version}.json",
        "candidate": f"{FAMILY_ROOT}/bridge/candidates/{stem}-v{version}.png",
        "result": f"{FAMILY_ROOT}/bridge/results/{stem}-v{version}.json",
        "decision": (
            f"{FAMILY_ROOT}/review/bridge/decisions/{stem}/"
            f"candidate-v{version}-review-v{version}.json"
        ),
        "blindReview": (
            f"{FAMILY_ROOT}/review/bridge/blind/{stem}/"
            f"candidate-v{version}-blind-v{version}.json"
        ),
    }


def validate_family(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    allow_existing_outputs: bool = False,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
) -> dict[str, Any]:
    target_keys = {
        "schemaVersion", "namespace", "coordinateId", "targetId", "familyId", "formId",
        "currentClassId", "affinity", "tier", "primaryArchetype", "battlefieldDuty",
        "identityInvariants", "anatomyInvariants", "constructionDimensions", "telegraph",
        "counterplay", "forbiddenTreatments", "sources", "presentationContract",
        "acceptanceCriteria", "ownedPaths", "anchor", "precedingAttempt", "version", "status",
        "promotionCeiling", "runtimeCatalogMutationForbidden",
    }
    if "canonicalCoordinateId" in target:
        target_keys.add("canonicalCoordinateId")
    require_exact_keys(target, target_keys, "family target")
    require_exact_keys(
        assignment,
        {
            "schemaVersion", "assignmentId", "targetId", "targetSha256", "coordinateId",
            "namespace", "version", "producerRole", "allowedOutputs", "retryCeiling",
            "dispatchStatus", "selfPromotionForbidden", "runtimeCatalogMutationForbidden",
        },
        "family assignment",
    )
    if target.get("schemaVersion") != FAMILY_TARGET_VERSION:
        fail("unsupported family target schemaVersion")
    if assignment.get("schemaVersion") != FAMILY_ASSIGNMENT_VERSION:
        fail("unsupported family assignment schemaVersion")
    namespace = target.get("namespace")
    if namespace not in {"canonical", "bridge"}:
        fail("family namespace must be canonical or bridge")
    affinity = target.get("affinity")
    if affinity not in FAMILY_AFFINITIES:
        fail("family affinity must be exactly normal, fire, earth, wind, or water")
    family_id = require_id(target, "familyId")
    form_id = require_id(target, "formId")
    current_class = target.get("currentClassId")
    if namespace == "canonical" and current_class is not None:
        fail("canonical family targets cannot carry currentClassId")
    if namespace == "bridge":
        if not isinstance(current_class, str) or not ID_PATTERN.fullmatch(current_class):
            fail("bridge family targets require a stable currentClassId")
    version = target.get("version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        fail("family target version must be a positive integer")
    coordinate = (
        f"{family_id}/{form_id}/{affinity}"
        if namespace == "canonical"
        else f"{current_class}/{family_id}/{form_id}/{affinity}"
    )
    if target.get("coordinateId") != coordinate:
        fail("family target coordinate fields do not match coordinateId")
    target_id = f"{namespace}/{coordinate}/v{version}"
    if target.get("targetId") != target_id:
        fail("family targetId must bind namespace, coordinate, and version")
    tier = target.get("tier")
    canonical_coordinate = target.get("canonicalCoordinateId")
    if namespace == "canonical" and tier not in {"T1", "T2", "T3", "T4", "T5"}:
        fail("canonical family target tier is invalid")
    if namespace == "canonical" and canonical_coordinate is not None:
        fail("canonical targets cannot carry canonicalCoordinateId")
    if namespace == "bridge" and canonical_coordinate is None and tier != "bridge-only":
        fail("bridge-only targets must remain outside family tiers")
    if namespace == "bridge" and canonical_coordinate is not None:
        expected_canonical = f"{family_id}/{form_id}/earth"
        if (
            affinity != "earth"
            or canonical_coordinate != expected_canonical
            or tier not in {"T1", "T2", "T3", "T4", "T5"}
        ):
            fail("mapped-primary bridge target has an invalid canonical Earth reference")
    for field, minimum in (
        ("identityInvariants", 1), ("anatomyInvariants", 1),
        ("constructionDimensions", 2), ("forbiddenTreatments", 1),
        ("acceptanceCriteria", 8),
    ):
        values = target.get(field)
        if not isinstance(values, list) or len(values) < minimum or not all(
            isinstance(item, str) and item.strip() for item in values
        ):
            fail(f"family target {field} is incomplete")
    for field in ("primaryArchetype", "battlefieldDuty", "telegraph", "counterplay"):
        require_string(target, field)
    presentation = target.get("presentationContract")
    if presentation != {
        "framing": "full-body-readable",
        "background": "cinematic-neutral-environment",
        "featuredSubjects": 1,
        "textAllowed": False,
        "watermarkAllowed": False,
    }:
        fail("family presentationContract is invalid")
    if target.get("precedingAttempt") is not None:
        preceding = target["precedingAttempt"]
        require_exact_keys(
            preceding,
            {
                "targetId", "targetSha256", "candidatePath", "candidateSha256", "resultPath",
                "resultSha256", "reviewPath", "reviewSha256",
            },
            "precedingAttempt",
        )
        for field in ("targetSha256", "candidateSha256", "resultSha256", "reviewSha256"):
            require_sha(preceding.get(field), f"precedingAttempt.{field}")
    if target.get("promotionCeiling") != "approved-review":
        fail("family target promotion ceiling is invalid")
    if target.get("runtimeCatalogMutationForbidden") is not True:
        fail("family target must forbid runtime mutation")

    sources = target.get("sources")
    if not isinstance(sources, dict):
        fail("family target sources must be an object")
    source_keys = {
        "familyPacketPath", "familyPacketSha256", "sourcePage", "sourceReferences", "mappingPath"
    }
    packet_kind = sources.get("packetKind", "canonical-family")
    if "packetKind" in sources:
        source_keys.add("packetKind")
    require_exact_keys(sources, source_keys, "family target sources")
    if packet_kind not in {"canonical-family", "bridge-identity"}:
        fail("family target source packet kind is invalid")
    if namespace == "canonical" and packet_kind != "canonical-family":
        fail("canonical targets require canonical family sources")
    if namespace == "bridge" and canonical_coordinate is not None and packet_kind != "canonical-family":
        fail("mapped-primary bridge targets require canonical family sources")
    if namespace == "bridge" and canonical_coordinate is None and packet_kind != "bridge-identity":
        fail("bridge-only targets require bridge identity sources")
    packet_path = sources.get("familyPacketPath")
    expected_canonical_packet = re.fullmatch(
        rf"{re.escape(FAMILY_ROOT)}/families/[0-9]{{2}}-{re.escape(family_id)}\.json",
        packet_path if isinstance(packet_path, str) else "",
    )
    expected_bridge_packet = (
        f"{FAMILY_ROOT}/bridge/identities/{current_class}.json"
        if namespace == "bridge" else None
    )
    if packet_kind == "canonical-family" and not expected_canonical_packet:
        fail("canonical family packet path does not match the target family")
    if packet_kind == "bridge-identity" and packet_path != expected_bridge_packet:
        fail("bridge identity packet path does not match currentClassId")
    packet_absolute = absolute_project_path(workspace, packet_path)
    if not packet_absolute.is_file():
        fail("family packet source is missing")
    packet = load_json(packet_absolute)
    if packet_kind == "canonical-family":
        if packet.get("schemaVersion") != "family-packet-v1" or packet.get("familyId") != family_id:
            fail("family packet source does not match the target")
    elif (
        packet.get("schemaVersion") != "bridge-identity-packet-v1"
        or packet.get("currentClassId") != current_class
        or packet.get("bridgeFamilyId") != family_id
        or packet.get("bridgeFormId") != form_id
        or packet.get("status") != "bridge-only"
        or packet.get("inferredTier") is not None
        or packet.get("runtimeCatalogMutationForbidden") is not True
    ):
        fail("bridge identity packet source does not match the target")
    if canonical_sha256(packet) != require_sha(
        sources.get("familyPacketSha256"), "sources.familyPacketSha256"
    ):
        fail("family packet source hash changed")
    if sources.get("mappingPath") != f"{FAMILY_ROOT}/current-class-mapping.json":
        fail("family mapping path is invalid")
    mapping_absolute = absolute_project_path(workspace, sources["mappingPath"])
    if not mapping_absolute.is_file():
        fail("family mapping source is missing")
    require_string(sources, "sourcePage")
    source_references = sources.get("sourceReferences")
    if not isinstance(source_references, list) or not source_references or not all(
        isinstance(item, str) and item.strip() for item in source_references
    ):
        fail("family sourceReferences are incomplete")

    expected = family_paths(target)
    owned = target.get("ownedPaths")
    if not isinstance(owned, dict):
        fail("family ownedPaths must be an object")
    require_exact_keys(owned, {"candidate", "result", "decision", "blindReview"}, "ownedPaths")
    if owned != {key: expected[key] for key in ("candidate", "result", "decision", "blindReview")}:
        fail("family owned paths do not match exact versioned templates")
    candidate_absolute = ensure_owned_path_has_no_symlink(workspace, owned["candidate"])
    result_absolute = ensure_owned_path_has_no_symlink(workspace, owned["result"])
    if target_path is not None and target_path.resolve() != (workspace / expected["target"]).resolve():
        fail("TARGET argument does not match the exact family target path")
    if assignment_path is not None and assignment_path.resolve() != (
        workspace / expected["assignment"]
    ).resolve():
        fail("ASSIGNMENT argument does not match the exact family assignment path")
    if not allow_existing_outputs:
        collisions = [
            path for path, absolute in ((owned["candidate"], candidate_absolute), (owned["result"], result_absolute))
            if absolute.exists()
        ]
        if collisions:
            fail(f"pre-existing output collision: {', '.join(collisions)}")

    anchor = target.get("anchor")
    if not isinstance(anchor, dict) or not isinstance(anchor.get("kind"), str):
        fail("family target anchor is invalid")
    status = target.get("status")
    if affinity == "normal":
        if anchor != {"kind": "normal-self"} or status != "planned":
            fail("Normal family targets require planned normal-self dispatch")
    elif anchor.get("kind") == "earth-bridge-provisional":
        require_exact_keys(
            anchor,
            {"kind", "normalCandidatePath", "normalCandidateSha256"},
            "earth bridge anchor",
        )
        if namespace != "bridge" or affinity != "earth" or status != "earth-bridge-provisional":
            fail("provisional Earth dispatch is only valid for bridge Earth")
        normal_path = anchor.get("normalCandidatePath")
        if not isinstance(normal_path, str) or not re.fullmatch(
            r"assets/enemies/experiments/(?:affinity-workflow-v1|affinity-expansion-v1)/"
            rf"candidates/{re.escape(current_class)}/normal-v[1-9][0-9]*\.png",
            normal_path,
        ):
            fail("provisional Earth Normal candidate path is invalid")
        normal_absolute = absolute_project_path(workspace, normal_path)
        if not normal_absolute.is_file() or hashlib.sha256(normal_absolute.read_bytes()).hexdigest() != require_sha(
            anchor.get("normalCandidateSha256"), "anchor.normalCandidateSha256"
        ):
            fail("provisional Earth Normal candidate evidence is stale")
    elif anchor.get("kind") == "normal-approved-review":
        require_exact_keys(
            anchor,
            {
                "kind", "normalCoordinateId", "normalVersion", "normalTargetPath",
                "normalTargetSha256", "reviewReceiptPath", "reviewReceiptSha256",
                "normalCandidatePath", "normalCandidateSha256", "normalResultPath",
                "normalResultSha256",
            },
            "Normal approved-review anchor",
        )
        if namespace != "canonical":
            fail("bridge targets cannot use canonical Normal approval dispatch")
        normal_version = anchor.get("normalVersion")
        if not isinstance(normal_version, int) or isinstance(normal_version, bool) or normal_version < 1:
            fail("Normal anchor version must be a positive integer")
        expected_normal_coordinate = f"{family_id}/{form_id}/normal"
        expected_normal_target = (
            f"{FAMILY_ROOT}/targets/{family_id}/{form_id}/normal/target-v{normal_version}.json"
        )
        expected_normal_candidate = (
            f"{FAMILY_ROOT}/candidates/{family_id}/{form_id}/normal-v{normal_version}.png"
        )
        expected_normal_result = (
            f"{FAMILY_ROOT}/results/{family_id}/{form_id}/normal-v{normal_version}.json"
        )
        expected_normal_review = (
            f"{FAMILY_ROOT}/review/decisions/{family_id}/{form_id}/normal/"
            f"candidate-v{normal_version}-review-v{normal_version}.json"
        )
        if (
            anchor.get("normalCoordinateId") != expected_normal_coordinate
            or anchor.get("normalTargetPath") != expected_normal_target
            or anchor.get("reviewReceiptPath") != expected_normal_review
            or (
                anchor.get("normalCandidatePath") is not None
                and anchor.get("normalCandidatePath") != expected_normal_candidate
            )
            or (
                anchor.get("normalResultPath") is not None
                and anchor.get("normalResultPath") != expected_normal_result
            )
        ):
            fail("Elemental anchor must use the exact Normal evidence for the same family and form")
        if status == "blocked-on-anchor":
            fail("family target is blocked-on-anchor and cannot be dispatched")
        if status != "planned":
            fail("canonical elemental family dispatch status is invalid")
        evidence_fields = (
            "reviewReceiptSha256", "normalCandidatePath", "normalCandidateSha256",
            "normalResultPath", "normalResultSha256",
        )
        if any(anchor.get(field) is None for field in evidence_fields):
            fail("planned elemental family target lacks complete Normal approval evidence")
        for field in ("normalTargetSha256", "reviewReceiptSha256", "normalCandidateSha256", "normalResultSha256"):
            require_sha(anchor.get(field), f"anchor.{field}")
        normal_target_absolute = absolute_project_path(workspace, anchor.get("normalTargetPath"))
        review_absolute = absolute_project_path(workspace, anchor.get("reviewReceiptPath"))
        normal_candidate_absolute = absolute_project_path(workspace, anchor.get("normalCandidatePath"))
        normal_result_absolute = absolute_project_path(workspace, anchor.get("normalResultPath"))
        if not all(path.is_file() for path in (
            normal_target_absolute, review_absolute, normal_candidate_absolute, normal_result_absolute
        )):
            fail("planned elemental family target has missing Normal approval evidence")
        normal_target = load_json(normal_target_absolute)
        if (
            canonical_sha256(normal_target) != anchor["normalTargetSha256"]
            or normal_target.get("targetId")
            != f"canonical/{expected_normal_coordinate}/v{normal_version}"
            or normal_target.get("coordinateId") != expected_normal_coordinate
            or normal_target.get("familyId") != family_id
            or normal_target.get("formId") != form_id
            or normal_target.get("affinity") != "normal"
        ):
            fail("Normal target hash changed")
        if hashlib.sha256(review_absolute.read_bytes()).hexdigest() != anchor["reviewReceiptSha256"]:
            fail("Normal review receipt hash changed")
        if hashlib.sha256(normal_candidate_absolute.read_bytes()).hexdigest() != anchor["normalCandidateSha256"]:
            fail("Normal candidate hash changed")
        if hashlib.sha256(normal_result_absolute.read_bytes()).hexdigest() != anchor["normalResultSha256"]:
            fail("Normal result hash changed")
        review = load_json(review_absolute)
        if (
            review.get("decision") != "approved-review"
            or review.get("targetId") != normal_target.get("targetId")
            or review.get("targetSha256") != anchor["normalTargetSha256"]
            or review.get("candidatePath") != expected_normal_candidate
            or review.get("candidateSha256") != anchor["normalCandidateSha256"]
            or review.get("resultPath") != expected_normal_result
            or review.get("resultSha256") != anchor["normalResultSha256"]
        ):
            fail("Normal approved-review receipt is stale or mismatched")
    else:
        fail("elemental family target anchor is invalid")

    if assignment.get("assignmentId") != f"{target_id}/assignment":
        fail("family assignmentId does not bind targetId")
    if assignment.get("targetId") != target_id or assignment.get("coordinateId") != coordinate:
        fail("family assignment target identity is cross-bound")
    if assignment.get("namespace") != namespace or assignment.get("version") != version:
        fail("family assignment namespace/version is cross-bound")
    if assignment.get("targetSha256") != canonical_sha256(target):
        fail("family assignment target hash is stale or forged")
    if assignment.get("producerRole") != "image-producer":
        fail("family assignment producerRole is not allowlisted")
    if assignment.get("allowedOutputs") != {
        "candidate": owned["candidate"], "result": owned["result"]
    }:
        fail("family assignment outputs do not match target ownership")
    if assignment.get("retryCeiling") not in {0, 1}:
        fail("family assignment retry ceiling must be zero or one")
    if assignment.get("dispatchStatus") != status:
        fail("family assignment dispatch status is stale")
    if assignment.get("selfPromotionForbidden") is not True:
        fail("family assignment must forbid self-promotion")
    if assignment.get("runtimeCatalogMutationForbidden") is not True:
        fail("family assignment must forbid runtime mutation")

    return {
        "profile": FAMILY_PROFILE,
        "targetId": target_id,
        "assignmentId": assignment["assignmentId"],
        "candidatePath": owned["candidate"],
        "resultPath": owned["result"],
        "references": 1,
        "retryCeiling": assignment["retryCeiling"],
        "dryRun": False,
        "status": status,
        "promotionCeiling": "candidate-only",
    }


def validate_legacy(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    allow_existing_outputs: bool = False,
) -> dict[str, Any]:
    if target.get("schemaVersion") not in TARGET_VERSIONS:
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


def validate(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    allow_existing_outputs: bool = False,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
) -> dict[str, Any]:
    if target.get("schemaVersion") == FAMILY_TARGET_VERSION:
        return validate_family(
            target,
            assignment,
            workspace,
            allow_existing_outputs=allow_existing_outputs,
            target_path=target_path,
            assignment_path=assignment_path,
        )
    return validate_legacy(
        target,
        assignment,
        workspace,
        allow_existing_outputs=allow_existing_outputs,
    )


def run_mandatory_family_dispatch_gate(
    target_path: Path,
    assignment_path: Path,
    workspace: Path,
    *,
    phase: str,
    result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if phase not in {"candidate", "result"}:
        raise ValueError("mandatory family dispatch phase must be candidate or result")
    target_path = target_path.resolve()
    assignment_path = assignment_path.resolve()
    workspace = workspace.resolve()
    if workspace not in target_path.parents or workspace not in assignment_path.parents:
        raise ValueError("mandatory family dispatch inputs are outside the repository")
    if phase == "candidate" and result is not None:
        raise ValueError("candidate dispatch cannot accept result material")
    if phase == "result" and result is None:
        raise ValueError("result dispatch requires exact in-memory result material")
    skill_root = Path(__file__).resolve().parents[1]
    contract_path = skill_root / "references/contract-v3.json"
    if contract_path.is_symlink() or not stat.S_ISREG(contract_path.lstat().st_mode):
        raise ValueError("installed v3 contract is not a real regular file")
    contract_bytes = contract_path.read_bytes()
    contract = json.loads(contract_bytes)
    receipt_path = workspace / FAMILY_ROOT / "production-compatibility.json"
    cursor = workspace
    for part in PurePosixPath(
        f"{FAMILY_ROOT}/production-compatibility.json"
    ).parts:
        cursor /= part
        metadata = cursor.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("family production compatibility receipt path is symlinked")
    if not stat.S_ISREG(receipt_path.lstat().st_mode):
        raise ValueError("family production compatibility receipt is not a regular file")
    receipt = json.loads(receipt_path.read_bytes())
    if receipt.get("skillContractSha256") != hashlib.sha256(contract_bytes).hexdigest():
        raise ValueError("installed v3 contract is not bound by the repository approval receipt")
    launcher = contract.get("sealedLauncher")
    if launcher != receipt.get("sealedLauncher") or not isinstance(launcher, dict):
        raise ValueError("sealed family dispatch launcher drifted from repository approval")
    dispatch = contract.get("repositoryDispatch")
    if not isinstance(dispatch, dict) or set(dispatch) != {"path", "sha256"}:
        raise ValueError("installed v3 contract has no repository dispatch binding")
    if dispatch.get("path") != "tools/check-family-affinity-production-dispatch.ts":
        raise ValueError("installed v3 contract has the wrong repository dispatch path")
    entrypoint = workspace / dispatch["path"]
    cursor = workspace
    for part in PurePosixPath(dispatch["path"]).parts:
        cursor /= part
        metadata = cursor.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("repository dispatch entrypoint path is symlinked")
    if not entrypoint.is_file():
        raise ValueError("repository dispatch entrypoint is not a regular file")
    if hashlib.sha256(entrypoint.read_bytes()).hexdigest() != dispatch.get("sha256"):
        raise ValueError("repository dispatch entrypoint drifted from the sealed contract")
    node = launcher.get("node")
    bundle = launcher.get("bundle")
    environment = launcher.get("environment")
    if (
        not isinstance(node, dict)
        or set(node) != {"path", "sha256"}
        or not isinstance(bundle, dict)
        or set(bundle) != {"path", "sha256"}
        or environment != {"LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC"}
    ):
        raise ValueError("installed v3 contract has no valid sealed launcher")
    node_path = Path(node["path"])
    if not node_path.is_absolute() or node_path != Path(
        "/home/joao/.nvm/versions/node/v24.14.1/bin/node"
    ):
        raise ValueError("approved Node runtime path is invalid for this production host")
    node_cursor = Path(node_path.anchor)
    for part in node_path.parts[1:]:
        node_cursor /= part
        metadata = node_cursor.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("approved Node runtime path is symlinked")
    if bundle.get("path") != "scripts/family_dispatch_gate.mjs":
        raise ValueError("sealed family dispatch bundle path is invalid")
    bundle_path = skill_root / bundle["path"]
    bundle_cursor = skill_root
    for part in PurePosixPath(bundle["path"]).parts:
        bundle_cursor /= part
        metadata = bundle_cursor.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError("sealed family dispatch bundle path is symlinked")
    if not Path("/proc/self/fd").is_dir():
        raise ValueError("sealed family dispatch requires Linux procfs; no fallback is allowed")
    node_fd = -1
    bundle_fd = -1
    try:
        node_fd = os.open(node_path, os.O_RDONLY | os.O_NOFOLLOW)
        bundle_fd = os.open(bundle_path, os.O_RDONLY | os.O_NOFOLLOW)
        if not stat.S_ISREG(os.fstat(node_fd).st_mode) or not stat.S_ISREG(
            os.fstat(bundle_fd).st_mode
        ):
            raise ValueError("sealed launcher components must be regular files")

        def descriptor_sha256(descriptor: int) -> str:
            digest = hashlib.sha256()
            os.lseek(descriptor, 0, os.SEEK_SET)
            while chunk := os.read(descriptor, 1024 * 1024):
                digest.update(chunk)
            os.lseek(descriptor, 0, os.SEEK_SET)
            return digest.hexdigest()

        if descriptor_sha256(node_fd) != node.get("sha256"):
            raise ValueError("approved Node runtime bytes drifted from repository approval")
        if descriptor_sha256(bundle_fd) != bundle.get("sha256"):
            raise ValueError("sealed family dispatch bundle bytes drifted from approval")
        command = [
            f"/proc/self/fd/{node_fd}",
            f"/proc/self/fd/{bundle_fd}",
            target_path.relative_to(workspace).as_posix(),
            assignment_path.relative_to(workspace).as_posix(),
            str(workspace),
            "--phase",
            phase,
            "--installed-skill-root",
            str(skill_root),
        ]
        gate = subprocess.run(
            command,
            cwd=workspace,
            check=False,
            capture_output=True,
            text=True,
            input=canonical_json(result) if result is not None else None,
            env=environment,
            close_fds=True,
            pass_fds=(node_fd, bundle_fd),
        )
    finally:
        if bundle_fd >= 0:
            os.close(bundle_fd)
        if node_fd >= 0:
            os.close(node_fd)
    if gate.returncode != 0:
        detail = gate.stderr.strip() or gate.stdout.strip() or "unknown gate failure"
        raise ValueError(f"mandatory repository dispatch gate rejected target: {detail}")
    try:
        report = json.loads(gate.stdout)
    except json.JSONDecodeError as error:
        raise ValueError("mandatory repository dispatch gate returned invalid JSON") from error
    if (
        not isinstance(report, dict)
        or report.get("dispatchable") is not True
        or report.get("phase") != phase
    ):
        raise ValueError("mandatory repository dispatch gate returned no phase-bound approval")
    return report


def main() -> None:
    allow_existing_outputs = len(sys.argv) == 5 and sys.argv[4] == "--allow-existing-outputs"
    if len(sys.argv) not in {4, 5} or (len(sys.argv) == 5 and not allow_existing_outputs):
        raise SystemExit(
            "usage: validate_target.py TARGET ASSIGNMENT WORKSPACE_ROOT "
            "[--allow-existing-outputs]"
        )
    target_path = Path(sys.argv[1]).resolve()
    assignment_path = Path(sys.argv[2]).resolve()
    workspace = Path(sys.argv[3]).resolve()
    if workspace not in target_path.parents or workspace not in assignment_path.parents:
        raise SystemExit("target validation failed: input file is outside workspace")
    try:
        target = load_json(target_path)
        assignment = load_json(assignment_path)
        if target.get("schemaVersion") == FAMILY_TARGET_VERSION:
            run_mandatory_family_dispatch_gate(
                target_path, assignment_path, workspace, phase="candidate"
            )
        report = validate(
            target,
            assignment,
            workspace,
            allow_existing_outputs=allow_existing_outputs,
            target_path=target_path,
            assignment_path=assignment_path,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"target validation failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
