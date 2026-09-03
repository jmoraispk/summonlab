#!/usr/bin/env python3
"""Activate a frozen reserve identity into one failed active quota slot."""

from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Iterable

from build_roster_plan import quota_summary, render_summon_prompt
from contracts import (
    ContractError,
    CreatedFile,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    REQUIRED_FORBIDDEN_PATHS,
    _anchored_parent,
    anchored_exclusive_create,
    anchored_read,
    assignment_path_for,
    candidate_path_for,
    canonical_json,
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
from validate_preflight import validate_preflight


ACTIVATION_SCHEMA = "hero-one-star-reserve-activation-v1"
CALIBRATION_INSPECTION = f"{EXPERIMENT_ROOT}/review-evidence/calibration-inspection.json"
RESERVE_ANALYSIS = f"{EXPERIMENT_ROOT}/review-evidence/calibration-reserve-analysis.json"
APPROVED_REPLACEMENTS = {
    "fenel-esho": "wenyn-amarun",
    "yasu-coro": "rao-esheth",
}


def activation_path(sequence: int, failed_id: str, reserve_id: str) -> str:
    return (
        f"{EXPERIMENT_ROOT}/activations/"
        f"activation-{sequence:04d}-{failed_id}--{reserve_id}.json"
    )


def _read_json(workspace: Path, relative_path: str) -> dict[str, Any]:
    try:
        value = json.loads(anchored_read(workspace, relative_path, prefix="assets"))
    except json.JSONDecodeError as error:
        raise ContractError(f"invalid JSON: {relative_path}") from error
    if not isinstance(value, dict):
        raise ContractError(f"expected JSON object: {relative_path}")
    return value


def _rollback_created(workspace: Path, created: CreatedFile) -> None:
    """Remove only an inode created by this activation transaction."""

    try:
        with _anchored_parent(workspace, created.path, create=False) as (parent, name):
            current = os.stat(name, dir_fd=parent, follow_symlinks=False)
            if (current.st_dev, current.st_ino) == (created.device, created.inode):
                os.unlink(name, dir_fd=parent)
    except OSError:
        return


def _packet_map(packets: Iterable[dict[str, Any]], label: str) -> dict[str, dict[str, Any]]:
    mapped: dict[str, dict[str, Any]] = {}
    for packet in packets:
        hero_id = packet.get("heroId")
        if not isinstance(hero_id, str) or hero_id in mapped:
            raise ContractError(f"{label} contains a missing or duplicate heroId")
        mapped[hero_id] = packet
    return mapped


def _activation_files(workspace: Path) -> list[str]:
    root = workspace / EXPERIMENT_ROOT / "activations"
    if not root.exists():
        return []
    if root.is_symlink() or not root.is_dir():
        raise ContractError("activation root must be a real directory")
    paths: list[str] = []
    for path in sorted(root.glob("activation-*.json")):
        relative = path.relative_to(workspace).as_posix()
        ensure_no_symlink_path(workspace, relative, allow_missing_leaf=False)
        paths.append(relative)
    return paths


def _validate_activation_record(
    record: dict[str, Any],
    *,
    expected_sequence: int,
    previous_hash: str | None,
    roster_sha256: str,
    expected_summary: dict[str, Any],
) -> None:
    required = {
        "schemaVersion", "activationId", "sequence", "experimentId", "createdAt",
        "reason", "failedActiveHeroId", "reserveHeroId", "destinationWave",
        "rosterPlanPath", "rosterPlanSha256", "previousActivationSha256",
        "decisionEvidence", "failedSlotEvidence", "preservedReserveIdentity",
        "slotQuotaCoordinates", "physicalManifest",
        "activeSelection", "activeSelectedCount", "activeSelectionSha256",
        "activeQuotaSummary", "activeQuotaSummarySha256", "materialized",
        "candidateOnly",
    }
    if set(record) != required:
        raise ContractError("existing activation record has missing or unknown fields")
    if (
        record["schemaVersion"] != ACTIVATION_SCHEMA
        or record["sequence"] != expected_sequence
        or record["experimentId"] != EXPERIMENT_ID
        or record["previousActivationSha256"] != previous_hash
        or record["rosterPlanSha256"] != roster_sha256
        or record["candidateOnly"] is not True
    ):
        raise ContractError("existing activation record has stale chain metadata")
    selection = record["activeSelection"]
    if not isinstance(selection, list) or len(selection) != 200:
        raise ContractError("existing activation selection must contain 200 slots")
    if record["activeSelectedCount"] != 200 or sha256_json(selection) != record["activeSelectionSha256"]:
        raise ContractError("existing activation selection hash is invalid")
    if canonical_json(record["activeQuotaSummary"]) != canonical_json(expected_summary):
        raise ContractError("existing activation changed the frozen active quota summary")
    if record["activeQuotaSummarySha256"] != sha256_json(expected_summary):
        raise ContractError("existing activation quota summary hash is invalid")
    identity = record["preservedReserveIdentity"]
    if not isinstance(identity, dict) or set(identity) != {
        "heroId", "displayName", "frozenIdentitySignature",
        "activatedIdentitySignature", "faceDescription", "characterKernel",
        "characterKernelSha256",
    }:
        raise ContractError("existing activation reserve identity record is invalid")
    if identity["frozenIdentitySignature"] == identity["activatedIdentitySignature"]:
        raise ContractError("activated identity signature must describe the rebuilt phenotype")


def _current_selection(
    workspace: Path,
    roster: dict[str, Any],
) -> tuple[list[dict[str, str]], set[str], set[str], str | None, int]:
    active_ids = [packet["heroId"] for packet in roster["active"]]
    selection = {hero_id: hero_id for hero_id in active_ids}
    used_reserves: set[str] = set()
    used_slots: set[str] = set()
    previous_hash: str | None = None
    files = _activation_files(workspace)
    for sequence, relative in enumerate(files, start=1):
        record = _read_json(workspace, relative)
        _validate_activation_record(
            record,
            expected_sequence=sequence,
            previous_hash=previous_hash,
            roster_sha256=sha256_json(roster),
            expected_summary=roster["activeQuotaSummary"],
        )
        failed_id = record["failedActiveHeroId"]
        reserve_id = record["reserveHeroId"]
        if failed_id not in selection or selection[failed_id] != failed_id:
            raise ContractError("existing activation reuses or does not own its active slot")
        if reserve_id in used_reserves or reserve_id in selection.values():
            raise ContractError("existing activation reuses a reserve identity")
        selection[failed_id] = reserve_id
        used_slots.add(failed_id)
        used_reserves.add(reserve_id)
        expected_selection = [
            {"slotHeroId": hero_id, "selectedHeroId": selection[hero_id]}
            for hero_id in active_ids
        ]
        if record["activeSelection"] != expected_selection:
            raise ContractError("existing activation selection does not match its event chain")
        previous_hash = sha256_json(record)
    return (
        [
            {"slotHeroId": hero_id, "selectedHeroId": selection[hero_id]}
            for hero_id in active_ids
        ],
        used_reserves,
        used_slots,
        previous_hash,
        len(files),
    )


def _activation_manifest(
    failed_packet: dict[str, Any], reserve_packet: dict[str, Any]
) -> dict[str, Any]:
    """Rebuild a coherent phenotype using the failed slot's quota coordinates."""

    manifest = deepcopy(failed_packet["physicalManifest"])
    reserve_manifest = reserve_packet["physicalManifest"]
    low, high = (int(part) for part in manifest["ageBand"].split("-", 1))
    manifest["adultAge"] = min(max(reserve_manifest["adultAge"], low), high)
    manifest["face"] = deepcopy(reserve_manifest["face"])
    manifest["rosterRole"] = "active"
    return manifest


def _activation_hero_spec(
    display_name: str,
    manifest: dict[str, Any],
    reserve_packet: dict[str, Any],
    activated_identity_signature: str,
) -> dict[str, Any]:
    """Derive the live target spec from the rebuilt manifest without stale fields."""

    reserve_spec = reserve_packet["summonTarget"]["heroSpec"]
    face = manifest["face"]
    hair = manifest["hair"]
    wardrobe = manifest["wardrobe"]
    details = manifest["personalDetails"]
    density = {"none": 0, "one": 1, "two": 2, "three": 3}[details["density"]]
    return {
        "identity": {
            "displayName": display_name,
            "gender": manifest["genderPresentation"],
            "age": manifest["adultAge"],
            "skinValueBand": int(manifest["skinValueBand"].split("-")[1]),
            "faceDescription": "; ".join(
                [face["shape"], face["eyesAndBrow"], face["noseAndMouth"], face["durableDetail"]]
            ),
            "identitySignature": activated_identity_signature,
        },
        "physique": {
            "bodyType": manifest["bodyConstruction"],
            "heightBand": manifest["heightBand"],
            "description": f"{manifest['heightCm']} cm; {manifest['bodyDescription']}.",
        },
        "hair": {
            "colorFamily": hair["dominantColor"],
            "silhouetteFamily": hair["primarySilhouette"],
            "accent": None if hair["deliberateAccent"] == "none" else hair["deliberateAccent"],
            "chibiReadability": hair["chibiReadability"],
        },
        "wardrobe": {
            "family": wardrobe["constructionFamily"],
            "paletteFamily": wardrobe["paletteFamily"],
            "description": f"{wardrobe['construction']}; {wardrobe['detailVariation']}.",
            "condition": reserve_spec["kernel"]["groomingAttitude"],
        },
        "details": {
            "density": density,
            "tattooScope": details["tattooLanguage"],
            "anchors": deepcopy(details["visibleAnchors"]),
            "coolnessAnchor": manifest["primaryCoolnessAnchor"],
        },
        "kernel": deepcopy(reserve_spec["kernel"]),
    }


def activate_reserve(
    roster_plan_path: Path,
    workspace: Path,
    *,
    failed_active_hero_id: str,
    reserve_hero_id: str,
    destination_wave: str,
    producer_id: str,
    assigned_at: str,
    created_at: str,
    reason: str,
) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    roster_relative = workspace_relative(workspace, roster_plan_path)
    if roster_relative != f"{EXPERIMENT_ROOT}/roster-plan.json":
        raise ContractError("activation requires the frozen experiment roster-plan.json")
    roster = _read_json(workspace, roster_relative)
    if (
        roster.get("schemaVersion") != "hero-one-star-roster-plan-v1"
        or roster.get("experimentId") != EXPERIMENT_ID
        or roster.get("state") != "frozen-preproduction"
    ):
        raise ContractError("roster plan is not the frozen Heroes roster")
    embedded_hash = roster.get("planContentSha256")
    if not isinstance(embedded_hash, str) or embedded_hash != sha256_json(
        {key: value for key, value in roster.items() if key != "planContentSha256"}
    ):
        raise ContractError("roster plan content hash is invalid")
    if len(roster.get("active", [])) != 200 or len(roster.get("reserves", [])) != 20:
        raise ContractError("frozen roster must contain 200 active and 20 reserve packets")
    if quota_summary(roster["active"]) != roster["activeQuotaSummary"]:
        raise ContractError("frozen roster activeQuotaSummary is stale")

    active = _packet_map(roster["active"], "active roster")
    reserves = _packet_map(roster["reserves"], "reserve roster")
    failed_packet = active.get(failed_active_hero_id)
    reserve_packet = reserves.get(reserve_hero_id)
    if failed_packet is None or reserve_packet is None:
        raise ContractError("failed hero must be active and replacement hero must be reserve")
    if APPROVED_REPLACEMENTS.get(failed_active_hero_id) != reserve_hero_id:
        raise ContractError("reserve activation pair is not one of the documented calibration replacements")
    if failed_packet["waveId"] != destination_wave:
        raise ContractError("destination wave must equal the failed active quota slot wave")
    if not reason.strip() or len(reason) > 1000:
        raise ContractError("activation reason must be nonempty text of at most 1000 characters")

    selection, used_reserves, used_slots, previous_hash, prior_count = _current_selection(
        workspace, roster
    )
    selection_by_slot = {entry["slotHeroId"]: entry["selectedHeroId"] for entry in selection}
    if failed_active_hero_id in used_slots or selection_by_slot[failed_active_hero_id] != failed_active_hero_id:
        raise ContractError("failed active quota slot has already been replaced")
    if reserve_hero_id in used_reserves or reserve_hero_id in selection_by_slot.values():
        raise ContractError("reserve identity has already been activated")

    reserve_analysis = _read_json(workspace, RESERVE_ANALYSIS)
    inspection = _read_json(workspace, CALIBRATION_INSPECTION)
    if (
        reserve_analysis.get("schemaVersion") != "hero-one-star-reserve-analysis-v1"
        or reserve_analysis.get("experimentId") != EXPERIMENT_ID
        or inspection.get("schemaVersion") != "hero-one-star-calibration-inspection-v1"
        or inspection.get("experimentId") != EXPERIMENT_ID
    ):
        raise ContractError("calibration decision evidence is invalid")
    decisions = {
        item.get("failedActiveHeroId"): item.get("reserveIdentityHeroId")
        for item in reserve_analysis.get("quotaSlotActivationDecision", [])
        if isinstance(item, dict)
    }
    if decisions.get(failed_active_hero_id) != reserve_hero_id:
        raise ContractError("reserve pair is not authorized by calibration decision evidence")
    inspection_pair = next(
        (
            item for item in inspection.get("pairs", [])
            if isinstance(item, dict) and item.get("heroId") == failed_active_hero_id
        ),
        None,
    )
    if (
        inspection_pair is None
        or inspection_pair.get("status") != "quarantine-pending-replacement"
        or not inspection_pair.get("blockingDefect")
    ):
        raise ContractError("failed hero is not a documented calibration quarantine")

    source_target_relative = failed_packet["summonTargetPath"]
    source_assignment_relative = failed_packet["summonAssignmentPath"]
    source_target = validate_target(
        _read_json(workspace, source_target_relative), expected_path=source_target_relative
    )
    source_assignment = validate_assignment(
        _read_json(workspace, source_assignment_relative),
        source_target,
        expected_path=source_assignment_relative,
    )
    source_result_relative = source_target["output"]["resultPath"]
    source_result = validate_result(
        _read_json(workspace, source_result_relative), source_target, source_assignment
    )
    if source_result["status"] not in {"candidate", "revise"} or source_result["candidate"] is None:
        raise ContractError("failed calibration slot requires a retained summon candidate")
    physical_manifest = _activation_manifest(failed_packet, reserve_packet)
    quota_coordinates = deepcopy(failed_packet["quotaCoordinates"])
    reserve_kernel = deepcopy(reserve_packet["characterKernel"])
    activated_identity_signature = sha256_json(
        {
            "displayName": reserve_packet["displayName"],
            "physicalManifest": physical_manifest,
            "characterKernel": reserve_kernel,
            "quotaCoordinates": quota_coordinates,
        }
    )
    prompt = render_summon_prompt(
        reserve_packet["displayName"], physical_manifest, reserve_kernel
    )
    prompt += (
        "\n\nRESERVE ACTIVATION: This is a fresh base summon, not an edit or regeneration of "
        "any existing hero. Create the new identity described above using only the authorized "
        "rendering-style reference. Honor the complete activated physical manifest and reserve "
        "character kernel; no failed hero or failed candidate is a visual source."
    )

    version = 1
    target_relative = target_path_for(destination_wave, reserve_hero_id, "summon", version)
    assignment_relative = assignment_path_for(destination_wave, reserve_hero_id, "summon", version)
    candidate_relative = candidate_path_for(destination_wave, reserve_hero_id, "summon", version)
    result_relative = result_path_for(destination_wave, reserve_hero_id, "summon", version)
    sequence = prior_count + 1
    manifest_relative = activation_path(
        sequence, failed_active_hero_id, reserve_hero_id
    )
    for path in (
        manifest_relative,
        target_relative,
        assignment_relative,
        candidate_relative,
        result_relative,
    ):
        absolute = ensure_no_symlink_path(workspace, path, allow_missing_leaf=True)
        if absolute.exists() or absolute.is_symlink():
            raise ContractError(f"reserve activation collision: {path}")

    target = deepcopy(source_target)
    target["targetId"] = f"{reserve_hero_id}-summon-v1"
    target["targetVersion"] = version
    target["waveId"] = destination_wave
    target["heroId"] = reserve_hero_id
    target["heroSpec"] = _activation_hero_spec(
        reserve_packet["displayName"],
        physical_manifest,
        reserve_packet,
        activated_identity_signature,
    )
    target["references"] = [
        deepcopy(reference)
        for reference in reserve_packet["summonTarget"]["references"]
        if reference["role"] == "rendering-style"
    ]
    if len(target["references"]) != 1:
        raise ContractError("fresh reserve summon requires exactly one rendering-style reference")
    target["canonicalPrompt"] = {
        "text": prompt,
        "sha256": sha256_bytes(prompt.encode("utf-8")),
    }
    target["correctionSource"] = None
    target["output"] = {
        "candidatePath": candidate_relative,
        "resultPath": result_relative,
    }
    validate_target(target, expected_path=target_relative)

    assignment = {
        "schemaVersion": "hero-one-star-image-assignment-v1",
        "assignmentId": f"{reserve_hero_id}-summon-v1-assignment",
        "experimentId": EXPERIMENT_ID,
        "targetId": target["targetId"],
        "targetPath": target_relative,
        "targetSha256": sha256_json(target),
        "producerId": producer_id,
        "assignedAt": assigned_at,
        "permittedOutputs": deepcopy(target["output"]),
        "forbiddenSharedPaths": sorted(REQUIRED_FORBIDDEN_PATHS),
        "retryCeiling": 1,
        "dryRun": False,
        "completionContract": {
            "oneTargetOneImage": True,
            "candidateOnly": True,
            "structuredResultRequired": True,
            "sharedFilesMustRemainUntouched": True,
            "selfPromotionForbidden": True,
        },
    }
    validate_assignment(assignment, target, expected_path=assignment_relative)

    selection_by_slot[failed_active_hero_id] = reserve_hero_id
    active_selection = [
        {"slotHeroId": packet["heroId"], "selectedHeroId": selection_by_slot[packet["heroId"]]}
        for packet in roster["active"]
    ]
    if len(active_selection) != 200 or len({entry["selectedHeroId"] for entry in active_selection}) != 200:
        raise ContractError("reserve activation did not preserve 200 unique selected heroes")
    selected_packets: list[dict[str, Any]] = []
    for packet in roster["active"]:
        selected = deepcopy(packet)
        selected_id = selection_by_slot[packet["heroId"]]
        if selected_id != packet["heroId"]:
            selected["heroId"] = selected_id
        selected_packets.append(selected)
    selected_summary = quota_summary(selected_packets)
    if canonical_json(selected_summary) != canonical_json(roster["activeQuotaSummary"]):
        raise ContractError("reserve activation changed the frozen active quota summary")

    activation = {
        "schemaVersion": ACTIVATION_SCHEMA,
        "activationId": f"activation-{sequence:04d}-{failed_active_hero_id}--{reserve_hero_id}",
        "sequence": sequence,
        "experimentId": EXPERIMENT_ID,
        "createdAt": created_at,
        "reason": reason,
        "failedActiveHeroId": failed_active_hero_id,
        "reserveHeroId": reserve_hero_id,
        "destinationWave": destination_wave,
        "rosterPlanPath": roster_relative,
        "rosterPlanSha256": sha256_json(roster),
        "previousActivationSha256": previous_hash,
        "decisionEvidence": {
            "reserveAnalysisPath": RESERVE_ANALYSIS,
            "reserveAnalysisSha256": sha256_json(reserve_analysis),
            "calibrationInspectionPath": CALIBRATION_INSPECTION,
            "calibrationInspectionSha256": sha256_json(inspection),
            "calibrationStatus": inspection_pair["status"],
            "blockingDefect": inspection_pair["blockingDefect"],
        },
        "failedSlotEvidence": {
            "heroId": failed_active_hero_id,
            "targetPath": source_target_relative,
            "targetSha256": sha256_json(source_target),
            "assignmentPath": source_assignment_relative,
            "assignmentSha256": sha256_json(source_assignment),
            "resultPath": source_result_relative,
            "resultSha256": sha256_json(source_result),
            "resultStatus": source_result["status"],
        },
        "preservedReserveIdentity": {
            "heroId": reserve_hero_id,
            "displayName": reserve_packet["displayName"],
            "frozenIdentitySignature": reserve_packet["identitySignature"],
            "activatedIdentitySignature": activated_identity_signature,
            "faceDescription": reserve_packet["summonTarget"]["heroSpec"]["identity"]["faceDescription"],
            "characterKernel": reserve_kernel,
            "characterKernelSha256": sha256_json(reserve_kernel),
        },
        "slotQuotaCoordinates": quota_coordinates,
        "physicalManifest": physical_manifest,
        "activeSelection": active_selection,
        "activeSelectedCount": len(active_selection),
        "activeSelectionSha256": sha256_json(active_selection),
        "activeQuotaSummary": deepcopy(roster["activeQuotaSummary"]),
        "activeQuotaSummarySha256": sha256_json(roster["activeQuotaSummary"]),
        "materialized": {
            "targetPath": target_relative,
            "targetSha256": sha256_json(target),
            "assignmentPath": assignment_relative,
            "assignmentSha256": sha256_json(assignment),
            "candidatePath": candidate_relative,
            "resultPath": result_relative,
        },
        "candidateOnly": True,
    }
    _validate_activation_record(
        activation,
        expected_sequence=sequence,
        previous_hash=previous_hash,
        roster_sha256=sha256_json(roster),
        expected_summary=roster["activeQuotaSummary"],
    )

    artifacts = (
        (target_relative, (canonical_json(target) + "\n").encode("utf-8")),
        (assignment_relative, (canonical_json(assignment) + "\n").encode("utf-8")),
        (manifest_relative, (canonical_json(activation) + "\n").encode("utf-8")),
    )
    created: list[CreatedFile] = []
    try:
        for path, payload in artifacts:
            created.append(anchored_exclusive_create(workspace, path, payload))
        validate_preflight(
            workspace / target_relative,
            workspace / assignment_relative,
            workspace,
            phase="candidate",
        )
    except BaseException:
        for artifact in reversed(created):
            _rollback_created(workspace, artifact)
        raise

    return {
        "schemaVersion": "hero-one-star-reserve-activation-receipt-v1",
        "activationPath": manifest_relative,
        "activationSha256": sha256_json(activation),
        "targetPath": target_relative,
        "targetSha256": sha256_json(target),
        "assignmentPath": assignment_relative,
        "assignmentSha256": sha256_json(assignment),
        "candidatePath": candidate_relative,
        "resultPath": result_relative,
        "activeSelectedCount": 200,
        "activeQuotaSummarySha256": sha256_json(roster["activeQuotaSummary"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("roster_plan", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--failed-active-hero-id", required=True)
    parser.add_argument("--reserve-hero-id", required=True)
    parser.add_argument("--destination-wave", required=True)
    parser.add_argument("--producer-id", required=True)
    parser.add_argument("--assigned-at", required=True)
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--reason", required=True)
    args = parser.parse_args()
    receipt = activate_reserve(
        args.roster_plan,
        args.workspace,
        failed_active_hero_id=args.failed_active_hero_id,
        reserve_hero_id=args.reserve_hero_id,
        destination_wave=args.destination_wave,
        producer_id=args.producer_id,
        assigned_at=args.assigned_at,
        created_at=args.created_at,
        reason=args.reason,
    )
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
