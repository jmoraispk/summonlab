#!/usr/bin/env python3
"""Materialize one immutable supplemental reserve identity packet.

This coordinator-only escape hatch is intentionally narrower than roster generation: it creates
one hash-bound reserve record and no production target, assignment, candidate, or result files.
The frozen roster remains byte-immutable and the activation chain remains the sole authority for
the effective 200-slot selection.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterable

from build_roster_plan import (
    ACTIVE_COUNT,
    RESERVE_COUNT,
    STYLE_REFERENCE,
    _allocation_at,
    build_reserve_allocations,
    collect_existing_identity_keys,
    generate_names,
    make_packet,
    normalize_name,
    wave_paths,
)
from contracts import (
    ContractError,
    EXPERIMENT_ID,
    EXPERIMENT_ROOT,
    anchored_exclusive_create,
    anchored_read,
    ensure_no_symlink_path,
    sha256_bytes,
    sha256_json,
    validate_assignment,
    validate_target,
    workspace_relative,
)


SUPPLEMENTAL_SCHEMA = "hero-one-star-supplemental-reserve-v1"
SUPPLEMENTAL_ROOT = f"{EXPERIMENT_ROOT}/supplemental-reserves"
ROSTER_PATH = f"{EXPERIMENT_ROOT}/roster-plan.json"
SHA_RE = re.compile(r"^[a-f0-9]{64}$")
SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,79}$")


def supplemental_path(sequence: int, hero_id: str) -> str:
    return f"{SUPPLEMENTAL_ROOT}/supplemental-reserve-{sequence:04d}-{hero_id}.json"


def _read_json(workspace: Path, relative: str, *, prefix: str = "assets") -> dict[str, Any]:
    try:
        value = json.loads(anchored_read(workspace, relative, prefix=prefix))
    except json.JSONDecodeError as error:
        raise ContractError(f"invalid JSON: {relative}") from error
    if not isinstance(value, dict):
        raise ContractError(f"expected JSON object: {relative}")
    return value


def validate_frozen_roster(roster: dict[str, Any]) -> None:
    if (
        roster.get("schemaVersion") != "hero-one-star-roster-plan-v1"
        or roster.get("experimentId") != EXPERIMENT_ID
        or roster.get("state") != "frozen-preproduction"
    ):
        raise ContractError("supplemental reserve requires the frozen Heroes roster")
    embedded = roster.get("planContentSha256")
    without_hash = {key: value for key, value in roster.items() if key != "planContentSha256"}
    if not isinstance(embedded, str) or embedded != sha256_json(without_hash):
        raise ContractError("frozen roster content hash is invalid")
    if len(roster.get("active", [])) != ACTIVE_COUNT or len(roster.get("reserves", [])) != RESERVE_COUNT:
        raise ContractError("frozen roster must contain 200 active and 20 reserve packets")


def _supplemental_files(workspace: Path) -> list[str]:
    root = workspace / SUPPLEMENTAL_ROOT
    if not root.exists():
        return []
    if root.is_symlink() or not root.is_dir():
        raise ContractError("supplemental reserve root must be a real directory")
    paths: list[str] = []
    for path in sorted(root.glob("supplemental-reserve-*.json")):
        relative = path.relative_to(workspace).as_posix()
        ensure_no_symlink_path(workspace, relative, allow_missing_leaf=False)
        paths.append(relative)
    return paths


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


def _validate_packet(packet: Any, style_reference: dict[str, str]) -> dict[str, Any]:
    if not isinstance(packet, dict):
        raise ContractError("supplemental reserve packet must be an object")
    hero_id = packet.get("heroId")
    display_name = packet.get("displayName")
    signature = packet.get("identitySignature")
    if not isinstance(hero_id, str) or not SLUG_RE.fullmatch(hero_id):
        raise ContractError("supplemental reserve heroId is invalid")
    if not isinstance(display_name, str) or not display_name.strip():
        raise ContractError("supplemental reserve displayName is invalid")
    if not isinstance(signature, str) or not SHA_RE.fullmatch(signature):
        raise ContractError("supplemental reserve identitySignature is invalid")
    if packet.get("rosterStatus") != "reserve" or packet.get("waveId") != "wave-11":
        raise ContractError("supplemental packet must remain an unactivated wave-11 reserve")
    physical = packet.get("physicalManifest")
    quota = packet.get("quotaCoordinates")
    if not isinstance(physical, dict) or not isinstance(quota, dict):
        raise ContractError("supplemental reserve lacks physical or quota metadata")
    if physical.get("rosterRole") != "reserve" or physical.get("genderPresentation") != "woman":
        raise ContractError("supplemental reserve must be a newly frozen woman identity")
    if quota.get("gender") != "woman":
        raise ContractError("supplemental reserve gender quota coordinate is invalid")
    target_path = packet.get("summonTargetPath")
    assignment_path = packet.get("summonAssignmentPath")
    if not isinstance(target_path, str) or not isinstance(assignment_path, str):
        raise ContractError("supplemental reserve production paths are invalid")
    expected_paths = wave_paths(hero_id, "wave-11")
    if packet.get("pathPlan") != expected_paths:
        raise ContractError("supplemental reserve path plan drifted")
    if target_path != expected_paths["target"] or assignment_path != expected_paths["assignment"]:
        raise ContractError("supplemental reserve target or assignment path drifted")
    target = validate_target(packet.get("summonTarget"), expected_path=target_path)
    assignment = validate_assignment(
        packet.get("summonAssignment"), target, expected_path=assignment_path
    )
    if target["heroId"] != hero_id or target["waveId"] != "wave-11":
        raise ContractError("supplemental embedded target identity is invalid")
    if target["heroSpec"]["identity"]["displayName"] != display_name:
        raise ContractError("supplemental target displayName drifted")
    if target["heroSpec"]["identity"]["identitySignature"] != signature:
        raise ContractError("supplemental target identity signature drifted")
    expected_reference = {
        "path": style_reference["path"],
        "sha256": style_reference["sha256"],
    }
    references = target["references"]
    if len(references) != 1 or references[0]["role"] != "rendering-style":
        raise ContractError("supplemental target requires exactly one rendering-style reference")
    if {key: references[0][key] for key in expected_reference} != expected_reference:
        raise ContractError("supplemental target rendering reference drifted")
    if assignment["targetSha256"] != sha256_json(target):
        raise ContractError("supplemental assignment target hash is stale")
    return packet


def validate_supplemental_record(
    record: Any,
    *,
    expected_path: str,
    roster: dict[str, Any],
) -> dict[str, Any]:
    required = {
        "schemaVersion",
        "supplementalReserveId",
        "sequence",
        "experimentId",
        "createdAt",
        "reason",
        "rosterPlanPath",
        "rosterPlanSha256",
        "styleReference",
        "exclusionEvidence",
        "reservePacket",
        "candidateOnly",
        "contentSha256",
    }
    if not isinstance(record, dict) or set(record) != required:
        raise ContractError("supplemental reserve record has missing or unknown fields")
    sequence = record["sequence"]
    if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 1:
        raise ContractError("supplemental reserve sequence is invalid")
    if record["schemaVersion"] != SUPPLEMENTAL_SCHEMA or record["experimentId"] != EXPERIMENT_ID:
        raise ContractError("supplemental reserve schema or experiment is invalid")
    if record["candidateOnly"] is not True:
        raise ContractError("supplemental reserve must remain candidate-only")
    if not isinstance(record["createdAt"], str) or not record["createdAt"].strip():
        raise ContractError("supplemental reserve createdAt is required")
    if not isinstance(record["reason"], str) or not record["reason"].strip() or len(record["reason"]) > 1000:
        raise ContractError("supplemental reserve reason must be nonempty and at most 1000 characters")
    if record["rosterPlanPath"] != ROSTER_PATH or record["rosterPlanSha256"] != sha256_json(roster):
        raise ContractError("supplemental reserve does not bind the frozen roster")
    if record["styleReference"] != roster.get("styleReference"):
        raise ContractError("supplemental reserve style reference differs from the frozen roster")
    evidence = record["exclusionEvidence"]
    evidence_keys = {
        "scope",
        "excludedIdCount",
        "excludedNormalizedDisplayNameCount",
        "excludedIdentitySignatureCount",
        "excludedIdsSha256",
        "excludedNormalizedDisplayNamesSha256",
        "excludedIdentitySignaturesSha256",
    }
    if not isinstance(evidence, dict) or set(evidence) != evidence_keys:
        raise ContractError("supplemental reserve exclusion evidence is invalid")
    for key in ("excludedIdCount", "excludedNormalizedDisplayNameCount", "excludedIdentitySignatureCount"):
        if isinstance(evidence[key], bool) or not isinstance(evidence[key], int) or evidence[key] < 0:
            raise ContractError("supplemental reserve exclusion counts are invalid")
    for key in ("excludedIdsSha256", "excludedNormalizedDisplayNamesSha256", "excludedIdentitySignaturesSha256"):
        if not isinstance(evidence[key], str) or not SHA_RE.fullmatch(evidence[key]):
            raise ContractError("supplemental reserve exclusion hash is invalid")
    packet = _validate_packet(record["reservePacket"], record["styleReference"])
    expected_id = f"supplemental-reserve-{sequence:04d}-{packet['heroId']}"
    if record["supplementalReserveId"] != expected_id:
        raise ContractError("supplemental reserve ID is invalid")
    if expected_path != supplemental_path(sequence, packet["heroId"]):
        raise ContractError("supplemental reserve path does not match its identity")
    content = {key: value for key, value in record.items() if key != "contentSha256"}
    if record["contentSha256"] != sha256_json(content):
        raise ContractError("supplemental reserve content hash drifted")
    return record


def load_supplemental_reserves(
    workspace: Path, roster: dict[str, Any]
) -> list[tuple[str, dict[str, Any]]]:
    """Load the contiguous immutable supplement ledger and reject identity collisions."""

    validate_frozen_roster(roster)
    frozen_packets = list(roster["active"]) + list(roster["reserves"])
    ids = {packet["heroId"].casefold() for packet in frozen_packets}
    names = {normalize_name(packet["displayName"]) for packet in frozen_packets}
    signatures = {packet["identitySignature"] for packet in frozen_packets}
    loaded: list[tuple[str, dict[str, Any]]] = []
    for sequence, relative in enumerate(_supplemental_files(workspace), start=1):
        record = validate_supplemental_record(
            _read_json(workspace, relative), expected_path=relative, roster=roster
        )
        if record["sequence"] != sequence:
            raise ContractError("supplemental reserve sequences must be contiguous")
        packet = record["reservePacket"]
        hero_id = packet["heroId"].casefold()
        display_name = normalize_name(packet["displayName"])
        signature = packet["identitySignature"]
        if hero_id in ids or display_name in names or signature in signatures:
            raise ContractError("supplemental reserve duplicates a frozen or prior supplemental identity")
        ids.add(hero_id)
        names.add(display_name)
        signatures.add(signature)
        loaded.append((relative, record))
    return loaded


def _identity_exclusions(
    workspace: Path,
    roster: dict[str, Any],
    supplemental: Iterable[tuple[str, dict[str, Any]]],
) -> tuple[set[str], set[str], set[str]]:
    experiments_root = workspace / "assets/heroes/experiments"
    other_ids, other_names = collect_existing_identity_keys(experiments_root)
    ids = {value.casefold() for value in other_ids}
    names = set(other_names)
    signatures: set[str] = set()
    for packet in list(roster["active"]) + list(roster["reserves"]):
        ids.add(packet["heroId"].casefold())
        names.add(normalize_name(packet["displayName"]))
        signatures.add(packet["identitySignature"])
    for _relative, record in supplemental:
        packet = record["reservePacket"]
        ids.add(packet["heroId"].casefold())
        names.add(normalize_name(packet["displayName"]))
        signatures.add(packet["identitySignature"])
    previous_hash: str | None = None
    for sequence, relative in enumerate(_activation_files(workspace), start=1):
        record = _read_json(workspace, relative)
        if record.get("sequence") != sequence or record.get("previousActivationSha256") != previous_hash:
            raise ContractError("activation chain is not contiguous while collecting exclusions")
        identity = record.get("preservedReserveIdentity")
        if not isinstance(identity, dict):
            raise ContractError("activation identity evidence is invalid")
        reserve_id = record.get("reserveHeroId")
        if isinstance(reserve_id, str):
            ids.add(reserve_id.casefold())
        display_name = identity.get("displayName")
        if isinstance(display_name, str):
            names.add(normalize_name(display_name))
        for key in ("frozenIdentitySignature", "activatedIdentitySignature"):
            signature = identity.get(key)
            if isinstance(signature, str) and SHA_RE.fullmatch(signature):
                signatures.add(signature)
        previous_hash = sha256_json(record)
    return ids, names, signatures


def materialize_supplemental_reserve(
    roster_plan_path: Path,
    workspace: Path,
    *,
    created_at: str,
    reason: str,
) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    roster_relative = workspace_relative(workspace, roster_plan_path)
    if roster_relative != ROSTER_PATH:
        raise ContractError("supplemental materialization requires the frozen roster-plan.json")
    roster_payload = anchored_read(workspace, roster_relative)
    roster = json.loads(roster_payload)
    validate_frozen_roster(roster)
    if not isinstance(created_at, str) or not created_at.strip():
        raise ContractError("created-at is required")
    if not isinstance(reason, str) or not reason.strip() or len(reason) > 1000:
        raise ContractError("reason must be nonempty and at most 1000 characters")

    style = roster["styleReference"]
    style_payload = anchored_read(workspace, style["path"], prefix="assets")
    if sha256_bytes(style_payload) != style["sha256"] or style["path"] != STYLE_REFERENCE.as_posix():
        raise ContractError("frozen rendering reference bytes drifted")

    supplemental = load_supplemental_reserves(workspace, roster)
    sequence = len(supplemental) + 1
    ids, names, signatures = _identity_exclusions(workspace, roster, supplemental)
    candidate_names = generate_names(32, ids, names)
    allocations = build_reserve_allocations()
    woman_indices = [
        index for index, gender in enumerate(allocations["gender"]) if gender == "woman"
    ]
    allocation = _allocation_at(allocations, woman_indices[(sequence - 1) % len(woman_indices)])
    ordinal = ACTIVE_COUNT + RESERVE_COUNT + sequence - 1
    packet: dict[str, Any] | None = None
    for hero_id, display_name in candidate_names:
        candidate = make_packet(
            hero_id, display_name, allocation, False, ordinal, style["sha256"]
        )
        if candidate["identitySignature"] not in signatures:
            packet = candidate
            break
    if packet is None:
        raise ContractError("could not derive a collision-free supplemental identity signature")
    _validate_packet(packet, style)

    evidence = {
        "scope": "every frozen packet, prior supplemental packet, and append-only activation identity",
        "excludedIdCount": len(ids),
        "excludedNormalizedDisplayNameCount": len(names),
        "excludedIdentitySignatureCount": len(signatures),
        "excludedIdsSha256": sha256_json(sorted(ids)),
        "excludedNormalizedDisplayNamesSha256": sha256_json(sorted(names)),
        "excludedIdentitySignaturesSha256": sha256_json(sorted(signatures)),
    }
    record = {
        "schemaVersion": SUPPLEMENTAL_SCHEMA,
        "supplementalReserveId": f"supplemental-reserve-{sequence:04d}-{packet['heroId']}",
        "sequence": sequence,
        "experimentId": EXPERIMENT_ID,
        "createdAt": created_at,
        "reason": reason,
        "rosterPlanPath": roster_relative,
        "rosterPlanSha256": sha256_json(roster),
        "styleReference": style,
        "exclusionEvidence": evidence,
        "reservePacket": packet,
        "candidateOnly": True,
    }
    record["contentSha256"] = sha256_json(record)
    relative = supplemental_path(sequence, packet["heroId"])
    validate_supplemental_record(record, expected_path=relative, roster=roster)
    for reserved in packet["pathPlan"].values():
        absolute = ensure_no_symlink_path(workspace, reserved, allow_missing_leaf=True)
        if absolute.exists() or absolute.is_symlink():
            raise ContractError(f"supplemental reserve production path collision: {reserved}")
    payload = (json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    created = anchored_exclusive_create(workspace, relative, payload)
    return {
        "schemaVersion": "hero-one-star-supplemental-reserve-receipt-v1",
        "path": created.path,
        "sha256": sha256_json(record),
        "contentSha256": record["contentSha256"],
        "heroId": packet["heroId"],
        "displayName": packet["displayName"],
        "identitySignature": packet["identitySignature"],
        "gender": packet["physicalManifest"]["genderPresentation"],
        "targetCreated": False,
        "assignmentCreated": False,
        "candidateCreated": False,
        "resultCreated": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("roster_plan", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--reason", required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            materialize_supplemental_reserve(
                args.roster_plan,
                args.workspace,
                created_at=args.created_at,
                reason=args.reason,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
