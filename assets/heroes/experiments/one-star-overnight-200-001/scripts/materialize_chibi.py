#!/usr/bin/env python3
"""Coordinator-only creation of a source-bound combat-chibi envelope."""

from __future__ import annotations

import argparse
import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

import activate_reserve as reserve_activation
from contracts import (
    ContractError,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    REQUIRED_FORBIDDEN_PATHS,
    CreatedFile,
    anchored_exclusive_create,
    anchored_read,
    assignment_path_for,
    candidate_path_for,
    canonical_json,
    ensure_no_symlink_path,
    png_dimensions,
    result_path_for,
    sha256_bytes,
    sha256_json,
    target_path_for,
    validate_assignment,
    validate_result,
    validate_target,
)


SCRIPT_PATH = Path(__file__).resolve()
WORKSPACE_ROOT = SCRIPT_PATH.parents[5]
ROSTER_PATH = f"{EXPERIMENT_ROOT}/roster-plan.json"

CHIBI_CRITERIA = (
    ("identity-continuity", "The adult face, skin, age cues, and identity remain unmistakably the summon hero."),
    ("body-continuity", "Height language, shoulder width, torso width, mass, softness, and musculature match the summon."),
    ("arm-hand-continuity", "Upper arms, forearms, wrists, and hands preserve source proportions without generic chibi inflation."),
    ("hair-continuity", "Hair color, front and side silhouette, parting, gathered mass, shaved areas, and accents match the summon."),
    ("wardrobe-continuity", "Garment construction, palette, repairs, accessories, tattoos, and personal anchors match the summon."),
    (
        "chibi-ratio",
        "The adult combat chibi is 2.75 through 3.1 heads tall: the complete head-and-hair unit occupies about 32 through 36 percent of standing height, never 3.5 or 4 heads tall.",
    ),
    ("complete-full-body", "Exactly one full-body subject has the entire head, both hands, and both feet inside safe margins."),
    ("combat-readability", "A grounded ready-idle silhouette reads clearly at combat-icon scale without a weapon."),
    ("one-star-ceiling", "No magic, affinity cue, aura, elite armor, frame, star, UI, text, or supernatural effect is present."),
)


def _read_json_anchored(workspace: Path, relative_path: str) -> dict[str, Any]:
    try:
        value = json.loads(anchored_read(workspace, relative_path).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ContractError(f"invalid JSON at {relative_path}: {error}") from error
    if not isinstance(value, dict):
        raise ContractError(f"expected a JSON object at {relative_path}")
    return value


def _verify_roster(plan: Mapping[str, Any]) -> None:
    if plan.get("experimentId") != EXPERIMENT_ID:
        raise ContractError("roster belongs to a different experiment")
    expected_hash = plan.get("planContentSha256")
    unsigned = {key: value for key, value in plan.items() if key != "planContentSha256"}
    if expected_hash != sha256_json(unsigned):
        raise ContractError("roster plan content hash is stale")


def _find_frozen_packet(plan: Mapping[str, Any], hero_id: str) -> dict[str, Any]:
    matches = [
        packet
        for packet in list(plan.get("active", [])) + list(plan.get("reserves", []))
        if isinstance(packet, dict)
        and packet.get("heroId") == hero_id
    ]
    if len(matches) != 1:
        raise ContractError(
            f"expected exactly one frozen roster packet for {hero_id}, found {len(matches)}"
        )
    return matches[0]


def _effective_activated_packet(
    workspace: Path,
    plan: Mapping[str, Any],
    record: Mapping[str, Any],
) -> dict[str, Any]:
    """Reconstruct one selected reserve packet from its immutable activation event."""

    hero_id = record["reserveHeroId"]
    wave_id = record["destinationWave"]
    reserve_packet = _find_frozen_packet(plan, hero_id)
    failed_packet = _find_frozen_packet(plan, record["failedActiveHeroId"])
    if record["slotQuotaCoordinates"] != failed_packet["quotaCoordinates"]:
        raise ContractError("activation quota coordinates differ from the frozen failed slot")
    expected_manifest = reserve_activation._activation_manifest(
        failed_packet, reserve_packet
    )
    if record["physicalManifest"] != expected_manifest:
        raise ContractError("activation physical manifest is stale for its quota slot and reserve face")
    identity = record["preservedReserveIdentity"]
    if (
        identity["heroId"] != hero_id
        or identity["displayName"] != reserve_packet["displayName"]
        or identity["frozenIdentitySignature"] != reserve_packet["identitySignature"]
        or identity["characterKernel"] != reserve_packet["characterKernel"]
        or identity["characterKernelSha256"] != sha256_json(reserve_packet["characterKernel"])
    ):
        raise ContractError("activation does not preserve the frozen reserve identity/kernel")

    materialized = record["materialized"]
    expected_target_path = target_path_for(wave_id, hero_id, "summon", 1)
    expected_assignment_path = assignment_path_for(wave_id, hero_id, "summon", 1)
    if materialized.get("targetPath") != expected_target_path:
        raise ContractError("activation materialized summon target path is stale")
    if materialized.get("assignmentPath") != expected_assignment_path:
        raise ContractError("activation materialized summon assignment path is stale")
    target = _read_json_anchored(workspace, expected_target_path)
    assignment = _read_json_anchored(workspace, expected_assignment_path)
    validate_target(target, expected_path=expected_target_path)
    validate_assignment(assignment, target, expected_path=expected_assignment_path)
    if materialized.get("targetSha256") != sha256_json(target):
        raise ContractError("activation materialized summon target hash is stale")
    if materialized.get("assignmentSha256") != sha256_json(assignment):
        raise ContractError("activation materialized summon assignment hash is stale")
    if {
        "candidatePath": materialized.get("candidatePath"),
        "resultPath": materialized.get("resultPath"),
    } != target["output"]:
        raise ContractError("activation materialized summon output paths are stale")
    expected_spec = reserve_activation._activation_hero_spec(
        reserve_packet["displayName"],
        expected_manifest,
        reserve_packet,
        identity["activatedIdentitySignature"],
    )
    if target["heroSpec"] != expected_spec:
        raise ContractError("activated summon target spec is stale for its quota and identity")
    if target["heroSpec"]["identity"]["faceDescription"] != identity["faceDescription"]:
        raise ContractError("activated summon target lost the reserve face description")

    packet = copy.deepcopy(reserve_packet)
    packet["waveId"] = wave_id
    packet["identitySignature"] = identity["activatedIdentitySignature"]
    packet["physicalManifest"] = copy.deepcopy(record["physicalManifest"])
    packet["quotaCoordinates"] = copy.deepcopy(record["slotQuotaCoordinates"])
    packet["summonTargetPath"] = expected_target_path
    packet["summonAssignmentPath"] = expected_assignment_path
    packet["summonTarget"] = target
    packet["summonAssignment"] = assignment
    return packet


def _find_packet(
    workspace: Path,
    plan: Mapping[str, Any],
    hero_id: str,
    wave_id: str,
) -> dict[str, Any]:
    """Resolve the effective selected packet, including append-only activations."""

    selection, _, _, _, activation_count = reserve_activation._current_selection(
        workspace, dict(plan)
    )
    if activation_count == 0:
        packet = _find_frozen_packet(plan, hero_id)
        if packet.get("waveId") != wave_id:
            raise ContractError(f"frozen roster packet {hero_id} is not assigned to {wave_id}")
        return packet

    selected_by_slot = {
        item["slotHeroId"]: item["selectedHeroId"] for item in selection
    }
    if hero_id not in selected_by_slot.values():
        raise ContractError(f"hero {hero_id} is not selected by the effective active roster")
    if hero_id in selected_by_slot and selected_by_slot[hero_id] == hero_id:
        packet = _find_frozen_packet(plan, hero_id)
        if packet.get("waveId") != wave_id:
            raise ContractError(f"selected roster packet {hero_id} is not assigned to {wave_id}")
        return packet

    matching_records: list[dict[str, Any]] = []
    for relative_path in reserve_activation._activation_files(workspace):
        record = _read_json_anchored(workspace, relative_path)
        if record.get("reserveHeroId") == hero_id:
            matching_records.append(record)
    if len(matching_records) != 1:
        raise ContractError(
            f"expected exactly one activation event for selected reserve {hero_id}, found {len(matching_records)}"
        )
    record = matching_records[0]
    if record["destinationWave"] != wave_id:
        raise ContractError(f"activated reserve {hero_id} is not assigned to {wave_id}")
    return _effective_activated_packet(workspace, plan, record)


def _verify_candidate_bytes(
    workspace: Path,
    target: Mapping[str, Any],
    result: Mapping[str, Any],
    *,
    accepted_statuses: set[str],
) -> bytes:
    if result["status"] not in accepted_statuses or result["candidate"] is None:
        expected = " or ".join(sorted(accepted_statuses))
        raise ContractError(f"summon result must be {expected} with a retained candidate")
    candidate_path = target["output"]["candidatePath"]
    candidate_bytes = anchored_read(workspace, candidate_path)
    candidate_record = result["candidate"]
    actual_hash = sha256_bytes(candidate_bytes)
    if candidate_record["path"] != candidate_path:
        raise ContractError("summon result candidate path differs from its target")
    if candidate_record["sha256"] != actual_hash or candidate_record["bytes"] != len(candidate_bytes):
        raise ContractError("summon result candidate hash or byte count is stale")
    if png_dimensions(candidate_bytes) != (1024, 1536):
        raise ContractError("summon candidate must be exactly 1024x1536")
    return candidate_bytes


def _load_summon_envelope(
    workspace: Path,
    wave_id: str,
    hero_id: str,
    version: int,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    target_path = target_path_for(wave_id, hero_id, "summon", version)
    assignment_path = assignment_path_for(wave_id, hero_id, "summon", version)
    target = _read_json_anchored(workspace, target_path)
    assignment = _read_json_anchored(workspace, assignment_path)
    validate_target(target, expected_path=target_path)
    validate_assignment(assignment, target, expected_path=assignment_path)
    if (
        target.get("imageKind") != "summon"
        or target.get("targetVersion") != version
        or target.get("waveId") != wave_id
        or target.get("heroId") != hero_id
    ):
        raise ContractError("source target is not a summon")
    result_path = target["output"]["resultPath"]
    result = _read_json_anchored(workspace, result_path)
    validate_result(result, target, assignment)
    return target, assignment, result


def _verify_correction_chain(
    workspace: Path,
    target: Mapping[str, Any],
) -> None:
    version = target["targetVersion"]
    if version == 1:
        if target["correctionSource"] is not None:
            raise ContractError("version-one summon cannot have a correction source")
        return
    source = target["correctionSource"]
    if source is None:
        raise ContractError("corrected summon lacks its correction source")
    prior_target, prior_assignment, prior_result = _load_summon_envelope(
        workspace,
        target["waveId"],
        target["heroId"],
        version - 1,
    )
    _verify_candidate_bytes(
        workspace,
        prior_target,
        prior_result,
        accepted_statuses={"candidate", "revise"},
    )
    expected_source = {
        "targetId": prior_target["targetId"],
        "resultPath": prior_target["output"]["resultPath"],
        "candidatePath": prior_target["output"]["candidatePath"],
        "sha256": prior_result["candidate"]["sha256"],
    }
    if source != expected_source:
        raise ContractError("corrected summon has a stale or non-immediate correctionSource binding")
    # Validation above binds the prior assignment and result; recurse so v3+
    # cannot conceal a broken earlier link.
    _verify_correction_chain(workspace, prior_target)


def _verify_summon_chain(
    workspace: Path,
    packet: Mapping[str, Any],
    summon_version: int,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], bytes]:
    if not 1 <= summon_version <= 99:
        raise ContractError("summon version must be from 1 through 99")
    wave_id = packet["waveId"]
    hero_id = packet["heroId"]
    target, assignment, result = _load_summon_envelope(
        workspace, wave_id, hero_id, summon_version
    )
    if summon_version == 1:
        if target != packet.get("summonTarget") or assignment != packet.get("summonAssignment"):
            raise ContractError("materialized summon v1 envelope differs from the frozen roster packet")
    else:
        _verify_correction_chain(workspace, target)
    if result["status"] != "candidate" or result["candidate"] is None:
        raise ContractError(
            "combat chibi requires a verified candidate summon result; explicitly select a completed correction version"
        )
    candidate_bytes = _verify_candidate_bytes(
        workspace,
        target,
        result,
        accepted_statuses={"candidate"},
    )
    return target, assignment, result, candidate_bytes


def _render_chibi_prompt(
    target: Mapping[str, Any], result: Mapping[str, Any]
) -> str:
    spec = target["heroSpec"]
    identity = spec["identity"]
    physique = spec["physique"]
    hair = spec["hair"]
    wardrobe = spec["wardrobe"]
    details = spec["details"]
    anchors = "; ".join(details["anchors"]) if details["anchors"] else "no accessory or tattoo"
    return (
        "Create exactly one full-body Summonlab combat chibi derived only from the supplied verified summon portrait. "
        "Canvas 1024 x 1536. Keep the character an adult and unmistakably the exact same person; simplify shapes for a "
        "clean painterly combat-game chibi. PROPORTION LOCK: the complete head-and-hair unit occupies 32 to 36 percent of the "
        "standing figure height, producing 2.75 to 3.1 heads total. Use a clearly oversized adult head, compact torso, and "
        "shortened legs; never render a 3.5-head, 4-head, or tall-miniature figure. Preserve relative body widths without generic "
        "inflation of the body. Use a grounded ready-idle three-quarter pose, both empty hands and both feet completely visible, "
        "with a generous safe margin and a warm pale parchment studio wash.\n\n"
        f"Identity continuity: {identity['displayName']}, age {identity['age']}, gender presentation {identity['gender']}, "
        f"skin-value band {identity['skinValueBand']}; {identity['faceDescription']} Preserve adult age cues, face geometry, "
        "skin, and expression; use a calm closed mouth with no smile or theatrical acting. Enlarge the cranium for chibi scale "
        "without replacing the source eye shape, eye spacing, brow structure, nose, mouth, jaw, or cheek planes with a shared "
        "generic doll-face template; the roster must retain visibly different adult faces at combat scale. "
        f"Body continuity: {physique['bodyType']}, {physique['heightBand']}; {physique['description']} Preserve shoulder and torso "
        "width, mass, softness, muscle distribution, upper-arm and forearm girth, wrist scale, hand size, leg mass, and posture. "
        "Do not make the arms, hands, shoulders, torso, or body fatter or bulkier merely because this is chibi. Tall or slight "
        "identity must read through shape and posture without shrinking the head below the required chibi ratio.\n\n"
        f"Hair continuity: {hair['colorFamily']} {hair['silhouetteFamily']}; accent: {hair['accent'] or 'none'}. "
        f"{hair['chibiReadability']} Wardrobe continuity: {wardrobe['family']} in {wardrobe['paletteFamily']}; "
        f"{wardrobe['description']} Condition: {wardrobe['condition']}. Preserve every visible seam, repair, closure, accessory, "
        f"tattoo, marking, and palette relationship that survives at chibi scale. Personal anchors: {anchors}. Add nothing new.\n\n"
        f"The sole reference is the exact candidate authorized by summon target {target['targetId']} and verified result "
        f"{result['resultId']} at {target['output']['resultPath']}; these identifiers are provenance only and must not appear "
        "in the image. No other identity, anatomy, wardrobe, or style reference is authorized. No weapon, attack, armor upgrade, "
        "magic, aura, glow, affinity cue, elemental gem, floating, frame, star, number, UI, text, label, logo, watermark, extra "
        "person, duplicate anatomy, cropped extremity, baby proportions, photographic finish, plastic 3D, or published-character resemblance."
    )


def _build_chibi_target(
    packet: Mapping[str, Any], summon_target: Mapping[str, Any], summon_result: Mapping[str, Any]
) -> dict[str, Any]:
    hero_id = packet["heroId"]
    wave_id = packet["waveId"]
    candidate = summon_result["candidate"]
    source = {
        "targetId": summon_target["targetId"],
        "resultPath": summon_target["output"]["resultPath"],
        "candidatePath": summon_target["output"]["candidatePath"],
        "sha256": candidate["sha256"],
    }
    prompt = _render_chibi_prompt(summon_target, summon_result)
    return {
        "schemaVersion": "hero-one-star-image-target-v1",
        "targetId": f"{hero_id}-combat-chibi-v1",
        "targetVersion": 1,
        "experimentId": EXPERIMENT_ID,
        "waveId": wave_id,
        "heroId": hero_id,
        "imageKind": "combat-chibi",
        "starLevel": 1,
        "productionState": "candidate-only",
        "heroSpec": copy.deepcopy(summon_target["heroSpec"]),
        "references": [
            {
                "path": source["candidatePath"],
                "sha256": source["sha256"],
                "purpose": (
                    f"Sole identity, anatomy, age, body, arm, hand, hair, wardrobe, palette, accessory, and marking "
                    f"authority from verified summon target {source['targetId']} and result {summon_result['resultId']} "
                    f"at {source['resultPath']}."
                ),
                "role": "identity-anatomy-authority",
            }
        ],
        "canonicalPrompt": {"text": prompt, "sha256": sha256_bytes(prompt.encode("utf-8"))},
        "presentation": {
            "width": 1024,
            "height": 1536,
            "mediaType": "image/png",
            "composition": (
                "One adult combat chibi, 2.75-3.1 heads tall with head-and-hair occupying 32-36% of standing height, grounded three-quarter ready-idle, "
                "both empty hands and both feet visible inside generous safe margins."
            ),
            "negativeConstraints": [
                "no body, shoulder, arm, forearm, wrist, hand, or body-fat inflation",
                "no identity, age, hair, wardrobe, palette, accessory, tattoo, or marking drift",
                "no weapon, armor upgrade, magic, aura, glow, affinity cue, gem, or floating",
                "no frame, star, number, UI, text, logo, watermark, extra person, crop, or duplicate anatomy",
                "no baby proportions, photography, plastic 3D, or published-character resemblance",
            ],
        },
        "acceptanceCriteria": [
            {"criterionId": criterion_id, "description": description, "required": True}
            for criterion_id, description in CHIBI_CRITERIA
        ],
        "sourceSummon": source,
        "correctionSource": None,
        "output": {
            "candidatePath": candidate_path_for(wave_id, hero_id, "combat-chibi", 1),
            "resultPath": result_path_for(wave_id, hero_id, "combat-chibi", 1),
        },
    }


def _build_chibi_assignment(
    target: Mapping[str, Any], producer_id: str, assigned_at: str
) -> dict[str, Any]:
    return {
        "schemaVersion": "hero-one-star-image-assignment-v1",
        "assignmentId": f"{target['heroId']}-combat-chibi-v1-assignment",
        "experimentId": EXPERIMENT_ID,
        "targetId": target["targetId"],
        "targetPath": target_path_for(target["waveId"], target["heroId"], "combat-chibi", 1),
        "targetSha256": sha256_json(target),
        "producerId": producer_id,
        "assignedAt": assigned_at,
        "dryRun": False,
        "retryCeiling": 1,
        "permittedOutputs": target["output"],
        "forbiddenSharedPaths": sorted(REQUIRED_FORBIDDEN_PATHS),
        "completionContract": {
            "oneTargetOneImage": True,
            "structuredResultRequired": True,
            "sharedFilesMustRemainUntouched": True,
            "candidateOnly": True,
            "selfPromotionForbidden": True,
        },
    }


def _preflight_absent(workspace: Path, paths: Sequence[str]) -> None:
    if len(paths) != len(set(paths)):
        raise ContractError("chibi target, assignment, candidate, and result paths must be unique")
    for relative_path in paths:
        location = ensure_no_symlink_path(workspace, relative_path, allow_missing_leaf=True)
        if location.exists() or location.is_symlink():
            raise ContractError(f"chibi materialization collision: {relative_path}")


def _unlink_created(workspace: Path, created: CreatedFile) -> None:
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    descriptors: list[int] = []
    current = os.open(workspace, flags)
    descriptors.append(current)
    try:
        parts = PurePosixPath(created.path).parts
        for component in parts[:-1]:
            child = os.open(component, flags, dir_fd=current)
            descriptors.append(child)
            current = child
        try:
            visible = os.stat(parts[-1], dir_fd=current, follow_symlinks=False)
        except FileNotFoundError:
            return
        if (visible.st_dev, visible.st_ino) == (created.device, created.inode):
            os.unlink(parts[-1], dir_fd=current)
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def materialize_chibi(
    hero_id: str,
    wave_id: str,
    workspace: Path = WORKSPACE_ROOT,
    *,
    summon_version: int = 1,
    producer_id: str | None = None,
    assigned_at: str | None = None,
) -> dict[str, Any]:
    """Validate one summon chain and atomically create its chibi envelope."""

    workspace = workspace.resolve(strict=True)
    plan = _read_json_anchored(workspace, ROSTER_PATH)
    _verify_roster(plan)
    packet = _find_packet(workspace, plan, hero_id, wave_id)
    summon_target, summon_assignment, summon_result, _ = _verify_summon_chain(
        workspace, packet, summon_version
    )
    target = _build_chibi_target(packet, summon_target, summon_result)
    assignment = _build_chibi_assignment(
        target,
        producer_id or summon_assignment["producerId"],
        assigned_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )
    target_path = assignment["targetPath"]
    assignment_path = assignment_path_for(wave_id, hero_id, "combat-chibi", 1)
    validate_target(target, expected_path=target_path)
    validate_assignment(assignment, target, expected_path=assignment_path)
    _preflight_absent(
        workspace,
        [target_path, assignment_path, target["output"]["candidatePath"], target["output"]["resultPath"]],
    )

    target_payload = (canonical_json(target) + "\n").encode("utf-8")
    assignment_payload = (canonical_json(assignment) + "\n").encode("utf-8")
    created: list[CreatedFile] = []
    try:
        created.append(anchored_exclusive_create(workspace, target_path, target_payload))
        created.append(anchored_exclusive_create(workspace, assignment_path, assignment_payload))
    except BaseException:
        for record in reversed(created):
            try:
                _unlink_created(workspace, record)
            except OSError:
                pass
        raise
    return {
        "materialized": True,
        "heroId": hero_id,
        "waveId": wave_id,
        "summonVersion": summon_version,
        "summonTargetId": summon_target["targetId"],
        "summonResultId": summon_result["resultId"],
        "summonCandidatePath": target["sourceSummon"]["candidatePath"],
        "summonCandidateSha256": target["sourceSummon"]["sha256"],
        "targetId": target["targetId"],
        "targetPath": target_path,
        "targetSha256": assignment["targetSha256"],
        "assignmentId": assignment["assignmentId"],
        "assignmentPath": assignment_path,
        "candidatePath": target["output"]["candidatePath"],
        "resultPath": target["output"]["resultPath"],
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hero_id")
    parser.add_argument("wave_id")
    parser.add_argument("--workspace", type=Path, default=WORKSPACE_ROOT)
    parser.add_argument("--producer-id")
    parser.add_argument("--assigned-at")
    parser.add_argument("--summon-version", type=int, default=1)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    report = materialize_chibi(
        args.hero_id,
        args.wave_id,
        args.workspace,
        summon_version=args.summon_version,
        producer_id=args.producer_id,
        assigned_at=args.assigned_at,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
