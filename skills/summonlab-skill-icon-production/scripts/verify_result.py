#!/usr/bin/env python3
"""Verify one retained skill-icon candidate and its structured result."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import secrets
import stat
import struct
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from validate_target import (
    AuthoritySnapshot,
    GEOMETRY_PATH,
    PROFILE_V1,
    PROFILE_V2,
    PROFILE_V3,
    PROFILE_V4,
    PROFILE_V5,
    PROFILE_V6,
    StableFileSnapshot,
    _path_argument,
    absolute_project_path,
    fail,
    load_json,
    load_json_snapshot,
    read_stable_regular_file_snapshot,
    reject_reprocess_packet_schemas,
    reassert_stable_regular_file,
    run_asset_inspection,
    run_contract_validation,
    validate,
)

FAILURE_KINDS = {
    "provider-failure",
    "provider-throttle",
    "timeout",
    "malformed-output",
    "persistence",
    "validation",
    "other",
}
ISO_TIMESTAMP_PATTERN = re.compile(
    r"^(?P<seconds>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})"
    r"(?:\.(?P<fraction>\d+))?(?P<zone>Z|[+-]\d{2}:\d{2})$"
)
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
SUPERSESSION_REASON = "unattempted-packet-superseded-by-higher-revision"


def _validate_attempt_count(
    assignment: dict[str, Any], attempt_count: int, *, status: str | None = None
) -> None:
    if isinstance(attempt_count, bool) or not isinstance(attempt_count, int):
        fail("attempt count must be an integer")
    if status == "superseded":
        if attempt_count != 0:
            fail("superseded evidence requires exactly zero provider attempts")
        return
    if not 1 <= attempt_count <= 1 + assignment["retryCeiling"]:
        fail("attempt count violates the assignment retry ceiling")


def _require_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or SHA256_PATTERN.fullmatch(value) is None:
        fail(f"{label} must be a lowercase SHA-256 hash")
    return value


def _validate_profile_normalization_evidence(
    target: dict[str, Any], result: dict[str, Any], output_hash: str | None
) -> None:
    """Check evidence whose meaning depends on the immutable profile literal."""

    target_normalization = target.get("normalization")
    evidence = result.get("normalization")
    if not isinstance(target_normalization, dict) or not isinstance(evidence, dict):
        fail("v2 result requires normalization authority and evidence")
    profile = target_normalization.get("profile")
    if evidence.get("profile") != profile:
        fail("normalization evidence profile does not match target authority")
    provider_source = evidence.get("providerSource")
    if provider_source is not None:
        if not isinstance(provider_source, dict) or "path" in provider_source:
            fail("normalization provider source evidence must be pathless")
        provider_hash = _require_sha256(
            provider_source.get("contentHash"), "original provider content hash"
        )
        if evidence.get("sourceContentHash") != provider_hash:
            fail("normalization source hash must bind the full original provider PNG")
    elif evidence.get("sourceContentHash") is not None:
        fail("normalization source hash requires observed provider evidence")

    outcome = evidence.get("outcome")
    if output_hash is not None and outcome != "completed":
        fail("retained v2 candidate requires completed normalization evidence")
    if outcome == "completed":
        if provider_source is None:
            fail("completed normalization requires full original provider evidence")
        recorded_output_hash = _require_sha256(
            evidence.get("outputContentHash"), "normalized output content hash"
        )
        if output_hash is not None and recorded_output_hash != output_hash:
            fail("normalized output hash does not bind retained candidate")
        if profile in {PROFILE_V2, PROFILE_V3, PROFILE_V4, PROFILE_V5, PROFILE_V6}:
            _require_sha256(
                evidence.get("decoderInputContentHash"),
                "canonical decoder input content hash",
            )
            container_box = evidence.get("containerBox")
            if not isinstance(container_box, dict) or set(container_box) != {
                "chunkType",
                "bytes",
                "contentHash",
            }:
                fail("profile-v2 evidence requires one pathless caBX descriptor")
            if container_box.get("chunkType") != "caBX":
                fail("profile-v2 container evidence must identify caBX")
            container_bytes = container_box.get("bytes")
            if (
                isinstance(container_bytes, bool)
                or not isinstance(container_bytes, int)
                or not 8 <= container_bytes <= 32_768
            ):
                fail("profile-v2 caBX evidence must record its bounded payload byte count")
            _require_sha256(
                container_box.get("contentHash"), "profile-v2 caBX payload content hash"
            )
            if evidence.get("colorSpaceDisposition") != "assigned-srgb":
                fail("profile-v2 evidence must record assigned-srgb")
        elif profile != PROFILE_V1:
            fail("normalization evidence uses an unsupported profile")
    elif profile in {PROFILE_V2, PROFILE_V3, PROFILE_V4, PROFILE_V5, PROFILE_V6}:
        decoder_hash = evidence.get("decoderInputContentHash")
        container_box = evidence.get("containerBox")
        color_disposition = evidence.get("colorSpaceDisposition")
        derived_presence = (
            decoder_hash is not None,
            container_box is not None,
            color_disposition is not None,
        )
        if any(derived_presence) and not all(derived_presence):
            fail("failed profile-v2 derived provenance must be all null or all present")
        if all(derived_presence):
            _require_sha256(decoder_hash, "canonical decoder input content hash")
            if not isinstance(container_box, dict) or set(container_box) != {
                "chunkType",
                "bytes",
                "contentHash",
            }:
                fail("profile-v2 caBX evidence must be pathless and exact")
            if container_box.get("chunkType") != "caBX":
                fail("profile-v2 container evidence must identify caBX")
            container_bytes = container_box.get("bytes")
            if (
                isinstance(container_bytes, bool)
                or not isinstance(container_bytes, int)
                or not 8 <= container_bytes <= 32_768
            ):
                fail("profile-v2 caBX evidence must record its bounded payload byte count")
            _require_sha256(
                container_box.get("contentHash"), "profile-v2 caBX payload content hash"
            )
            if color_disposition != "assigned-srgb":
                fail("profile-v2 color-space evidence must be assigned-srgb")
    elif profile != PROFILE_V1:
        fail("normalization evidence uses an unsupported profile")


def _observed_provider_source(
    source_path: Path,
) -> tuple[dict[str, Any], StableFileSnapshot]:
    absolute = source_path.absolute()
    snapshot = read_stable_regular_file_snapshot(absolute)
    data = snapshot.data
    media_type = "application/octet-stream"
    width: int | None = None
    height: int | None = None
    alpha_mode: str | None = None
    if (
        len(data) >= 26
        and data.startswith(b"\x89PNG\r\n\x1a\n")
        and data[12:16] == b"IHDR"
    ):
        media_type = "image/png"
        width, height = struct.unpack(">II", data[16:24])
        color_type = data[25]
        if color_type == 2:
            alpha_mode = "rgb"
        elif color_type == 6:
            alpha_mode = "rgba"
    elif len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        media_type = "image/webp"
    content_hash = hashlib.sha256(data).hexdigest()
    return (
        {
            "mediaType": media_type,
            "width": width,
            "height": height,
            "bytes": len(data),
            "alphaMode": alpha_mode,
            "contentHash": content_hash,
        },
        snapshot,
    )


def _validate_superseding_authority(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result: dict[str, Any],
    workspace: Path,
    authority_snapshots: list[AuthoritySnapshot],
    *,
    contract_root: Path,
) -> None:
    """Bind coordinator-authored supersession evidence to live higher-revision packets."""

    if result.get("status") != "superseded":
        return
    if result.get("supersessionReason") != SUPERSESSION_REASON:
        fail("superseded evidence has an unsupported reason")
    if result.get("output") is not None or "failureReason" in result:
        fail("superseded evidence cannot retain output or claim a provider failure")
    normalization = result.get("normalization")
    if (
        not isinstance(normalization, dict)
        or normalization.get("outcome") != "not-run"
        or normalization.get("providerSource") is not None
        or normalization.get("sourceContentHash") is not None
        or normalization.get("outputContentHash") is not None
    ):
        fail("superseded evidence requires a pathless not-run normalization outcome")
    authority = result.get("supersedingAuthority")
    if not isinstance(authority, dict):
        fail("superseded evidence requires coordinator authority")
    expected_fields = {
        "targetPath",
        "targetContentHash",
        "assignmentPath",
        "assignmentContentHash",
        "jobId",
        "logicalIdentity",
        "revision",
        "role",
    }
    if set(authority) != expected_fields:
        fail("superseding authority fields are incomplete or unknown")
    target_path = absolute_project_path(
        workspace, authority.get("targetPath"), must_exist=True, regular_file=True
    )
    assignment_path = absolute_project_path(
        workspace, authority.get("assignmentPath"), must_exist=True, regular_file=True
    )
    superseding_target, target_snapshot = load_json_snapshot(target_path)
    superseding_assignment, assignment_snapshot = load_json_snapshot(assignment_path)
    superseding_snapshots: list[AuthoritySnapshot] = []
    validate(
        superseding_target,
        superseding_assignment,
        workspace,
        target_path=target_path,
        assignment_path=assignment_path,
        allow_existing_outputs=True,
        contract_root=contract_root,
        _authority_snapshots=superseding_snapshots,
    )
    # The authority hashes bind the first raw snapshots. `validate` deliberately
    # performs its own stable reads, so also reassert these originals to reject a
    # semantic-equal byte rewrite between the two reads.
    reassert_stable_regular_file(
        target_path, target_snapshot, label="superseding target raw authority"
    )
    reassert_stable_regular_file(
        assignment_path,
        assignment_snapshot,
        label="superseding assignment raw authority",
    )
    if target_snapshot.content_hash != _require_sha256(
        authority.get("targetContentHash"), "superseding target content hash"
    ):
        fail("superseding target hash does not match its exact packet bytes")
    if assignment_snapshot.content_hash != _require_sha256(
        authority.get("assignmentContentHash"), "superseding assignment content hash"
    ):
        fail("superseding assignment hash does not match its exact packet bytes")
    expected_authority = {
        "targetPath": authority["targetPath"],
        "targetContentHash": target_snapshot.content_hash,
        "assignmentPath": authority["assignmentPath"],
        "assignmentContentHash": assignment_snapshot.content_hash,
        "jobId": superseding_target.get("jobId"),
        "logicalIdentity": superseding_target.get("logicalIdentity"),
        "revision": superseding_target.get("revision"),
        "role": superseding_target.get("role"),
    }
    if authority != expected_authority:
        fail("superseding authority metadata does not match its exact target packet")
    if (
        superseding_target.get("schemaVersion") != "skill-icon-target-v2"
        or superseding_assignment.get("schemaVersion") != "skill-icon-assignment-v2"
    ):
        fail("superseding authority must be a normalized structural-v2 packet")
    if (
        superseding_target.get("logicalIdentity") != target.get("logicalIdentity")
        or superseding_target.get("role") != target.get("role")
        or not isinstance(superseding_target.get("revision"), int)
        or superseding_target["revision"] <= target.get("revision", -1)
    ):
        fail("superseding authority must bind the same role and identity at a higher revision")
    if (
        superseding_assignment.get("jobId") != superseding_target.get("jobId")
        or superseding_assignment.get("logicalIdentity")
        != superseding_target.get("logicalIdentity")
        or superseding_assignment.get("revision") != superseding_target.get("revision")
        or superseding_assignment.get("targetPath") != authority["targetPath"]
        or superseding_assignment.get("assignmentPath") != authority["assignmentPath"]
    ):
        fail("superseding assignment does not bind its target and authority paths")
    authority_snapshots.extend(
        [
            (target_path, target_snapshot, "superseding target raw authority"),
            (
                assignment_path,
                assignment_snapshot,
                "superseding assignment raw authority",
            ),
            *superseding_snapshots,
        ]
    )


def _parse_timestamp(raw: Any, label: str) -> tuple[datetime, str, str]:
    if not isinstance(raw, str) or not raw:
        fail(f"{label} timestamp must be a non-empty ISO-8601 string")
    matched = ISO_TIMESTAMP_PATTERN.fullmatch(raw)
    if matched is None:
        fail(f"{label} timestamp must include seconds and a UTC offset")
    zone = matched.group("zone")
    try:
        parsed = datetime.fromisoformat(
            matched.group("seconds") + zone.replace("Z", "+00:00")
        )
    except ValueError as error:
        fail(f"{label} timestamp must be a valid ISO-8601 timestamp: {error}")
    if parsed.utcoffset() is None:
        fail(f"{label} timestamp must include a UTC offset")
    return parsed, matched.group("fraction") or "", zone


def _format_derived_timestamp(started_at: str, total_wall_time_ms: int) -> str:
    started, fraction, zone = _parse_timestamp(started_at, "started-at")
    precision = max(len(fraction), 3)
    scale = 10**precision
    fraction_ticks = int(fraction.ljust(precision, "0") or "0")
    elapsed_ticks = total_wall_time_ms * 10 ** (precision - 3)
    seconds, completed_fraction = divmod(fraction_ticks + elapsed_ticks, scale)
    completed = started + timedelta(seconds=seconds)
    return (
        completed.strftime("%Y-%m-%dT%H:%M:%S")
        + f".{completed_fraction:0{precision}d}"
        + zone
    )


def _elapsed_wall_time_ms(
    started_at: Any, completed_at: Any
) -> tuple[datetime, datetime, int]:
    started, started_fraction, _ = _parse_timestamp(started_at, "started-at")
    completed, completed_fraction, _ = _parse_timestamp(completed_at, "completed-at")
    precision = max(len(started_fraction), len(completed_fraction), 3)
    scale = 10**precision
    elapsed = completed - started
    whole_seconds = elapsed.days * 86_400 + elapsed.seconds
    elapsed_ticks = (
        whole_seconds * scale
        + int(completed_fraction.ljust(precision, "0") or "0")
        - int(started_fraction.ljust(precision, "0") or "0")
    )
    if elapsed_ticks < 0:
        fail("result timing is not chronological")
    ticks_per_millisecond = 10 ** (precision - 3)
    if elapsed_ticks % ticks_per_millisecond != 0:
        fail("result timing duration must resolve to whole milliseconds")
    elapsed_ms = elapsed_ticks // ticks_per_millisecond
    return started, completed, elapsed_ms


def _validate_result_timing(
    started_at: Any, completed_at: Any, total_wall_time_ms: Any
) -> tuple[datetime, datetime, int]:
    if (
        isinstance(total_wall_time_ms, bool)
        or not isinstance(total_wall_time_ms, int)
        or total_wall_time_ms < 0
    ):
        fail("total wall-time duration must be a non-negative integer in milliseconds")
    started, completed, elapsed_ms = _elapsed_wall_time_ms(started_at, completed_at)
    if total_wall_time_ms != elapsed_ms:
        fail("declared total wall-time duration does not match the timestamps")
    return started, completed, elapsed_ms


def _resolve_failure_timing(
    started_at: str,
    completed_at: str | None,
    total_wall_time_ms: int | None,
) -> tuple[str, str, int]:
    _parse_timestamp(started_at, "started-at")
    if total_wall_time_ms is not None and (
        isinstance(total_wall_time_ms, bool)
        or not isinstance(total_wall_time_ms, int)
        or total_wall_time_ms < 0
    ):
        fail("total wall-time duration must be a non-negative integer in milliseconds")
    if completed_at is None and total_wall_time_ms is None:
        fail("failure timing requires completed-at or total wall-time duration")

    if completed_at is not None:
        _, _, elapsed_ms = _elapsed_wall_time_ms(started_at, completed_at)
        if total_wall_time_ms is None:
            total_wall_time_ms = elapsed_ms
    else:
        assert total_wall_time_ms is not None
        completed_at = _format_derived_timestamp(started_at, total_wall_time_ms)
    assert completed_at is not None
    assert total_wall_time_ms is not None
    _validate_result_timing(started_at, completed_at, total_wall_time_ms)
    return started_at, completed_at, total_wall_time_ms


def _changed_repository_paths(workspace: Path) -> set[str]:
    completed = subprocess.run(
        ["git", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=no"],
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        fail(
            "cannot audit changed repository paths: "
            + completed.stderr.decode("utf-8", errors="replace").strip()
        )
    changed: set[str] = set()
    entries = completed.stdout.split(b"\0")
    index = 0
    while index < len(entries):
        entry = entries[index]
        index += 1
        if not entry:
            continue
        if len(entry) < 4:
            fail("cannot parse git status for output ownership audit")
        status_code = entry[:2]
        changed.add(entry[3:].decode("utf-8", errors="strict"))
        if b"R" in status_code or b"C" in status_code:
            if index >= len(entries) or not entries[index]:
                fail("cannot parse renamed path in output ownership audit")
            changed.add(entries[index].decode("utf-8", errors="strict"))
            index += 1
    return changed


def verify(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result: dict[str, Any],
    result_path: Path,
    workspace: Path,
    *,
    attempt_count: int,
    contract_root: Path | None = None,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
    _ignored_changed_paths: set[str] | None = None,
) -> dict[str, Any]:
    reject_reprocess_packet_schemas(target, assignment, result)
    root = workspace.absolute()
    authority_snapshots = []
    target_report = validate(
        target,
        assignment,
        root,
        target_path=target_path,
        assignment_path=assignment_path,
        allow_existing_outputs=True,
        contract_root=contract_root or root,
        _authority_snapshots=authority_snapshots,
    )
    run_contract_validation(
        "execution",
        target,
        assignment,
        result=result,
        contract_root=contract_root or root,
    )
    _validate_result_timing(
        result["startedAt"], result["completedAt"], result["totalWallTimeMs"]
    )

    _validate_attempt_count(assignment, attempt_count, status=result.get("status"))
    _validate_superseding_authority(
        target,
        assignment,
        result,
        root,
        authority_snapshots,
        contract_root=contract_root or root,
    )

    expected_result = absolute_project_path(
        root, target["output"]["resultPath"], must_exist=True, regular_file=True
    )
    supplied_result = result_path.absolute()
    if supplied_result != expected_result:
        fail("RESULT argument does not match target.output.resultPath")
    retained_result, result_snapshot = load_json_snapshot(expected_result)
    if retained_result != result:
        fail("RESULT argument bytes do not contain the result being verified")

    candidate_path = target["output"]["candidatePath"]
    candidate = absolute_project_path(root, candidate_path)
    output = result["output"]
    candidate_snapshot = None
    geometry_snapshot = None
    if output is None:
        if candidate.exists() or candidate.is_symlink():
            fail("result claims no output but a candidate exists")
        if target.get("schemaVersion") == "skill-icon-target-v2":
            _validate_profile_normalization_evidence(target, result, None)
    else:
        candidate = absolute_project_path(
            root, candidate_path, must_exist=True, regular_file=True
        )
        target_normalization = target.get("normalization")
        geometry_authority_path = (
            target_normalization["geometry"]["path"]
            if isinstance(target_normalization, dict)
            else GEOMETRY_PATH
        )
        geometry_path = absolute_project_path(
            root, geometry_authority_path, must_exist=True, regular_file=True
        )
        geometry_snapshot = read_stable_regular_file_snapshot(geometry_path)
        geometry = json.loads(geometry_snapshot.data.decode("utf-8"))
        candidate_snapshot = read_stable_regular_file_snapshot(candidate)
        inspection = run_asset_inspection(
            candidate_snapshot.data,
            target["role"],
            geometry,
            contract_root=contract_root or root,
        )
        if (
            inspection.get("width") != target["canvas"]["width"]
            or inspection.get("height") != target["canvas"]["height"]
            or inspection.get("mediaType") != target["canvas"]["mediaType"]
        ):
            fail("retained candidate does not match the target canvas")
        violations = inspection.get("violations")
        if not isinstance(violations, list):
            fail("repository asset inspector returned invalid violations")
        if violations:
            fail("repository role-aware asset inspection failed: " + "; ".join(violations))
        expected_output = {
            "path": candidate_path,
            "mediaType": inspection["mediaType"],
            "width": inspection["width"],
            "height": inspection["height"],
            "bytes": inspection["bytes"],
            "alphaMode": inspection["alphaMode"],
            "contentHash": inspection["contentHash"],
        }
        if output != expected_output:
            fail("result candidate metadata does not match the exact retained bytes")
        if target.get("schemaVersion") == "skill-icon-target-v2":
            normalization = result.get("normalization")
            _validate_profile_normalization_evidence(
                target, result, inspection["contentHash"]
            )
            assert isinstance(normalization, dict)
            geometry_hash = geometry_snapshot.content_hash
            if normalization.get("geometryHash") != geometry_hash:
                fail("v2 normalization geometry hash does not bind raw authority bytes")
        findings = result["findings"]
        full_size_findings = [
            finding
            for finding in findings
            if finding.get("evaluator") == "automated"
            and finding.get("category")
            in {"geometry", "alpha", "safe-zone", "registration"}
            and finding.get("outcome") != "not-applicable"
        ]
        recognition_findings = [
            finding
            for finding in findings
            if finding.get("evaluator") == "producer"
            and finding.get("category") == "recognition"
            and finding.get("outcome") != "not-applicable"
        ]
        if not full_size_findings or not recognition_findings:
            fail("retained image requires explicit full-size and 96-pixel inspection findings")
        if result["status"] == "candidate":
            if any(
                finding.get("outcome") in {"concern", "fail"} for finding in findings
            ):
                fail("candidate findings must be clean without concerns or failures")
            if any(finding.get("outcome") != "pass" for finding in full_size_findings):
                fail("candidate requires a full-size inspection pass")
            if any(finding.get("outcome") != "pass" for finding in recognition_findings):
                fail("candidate requires a 96-pixel inspection pass")

    written = result["writtenOutputPaths"]
    expected_written = (
        [candidate_path, target["output"]["resultPath"]]
        if output is not None
        else [target["output"]["resultPath"]]
    )
    if written != expected_written:
        fail("written paths are not exactly the owned candidate and result")
    changed = _changed_repository_paths(root)
    if _ignored_changed_paths:
        changed -= _ignored_changed_paths
    if changed != set(expected_written):
        unexpected = sorted(changed - set(expected_written))
        missing = sorted(set(expected_written) - changed)
        fail(
            "unexpected changed repository paths during output ownership audit: "
            f"unexpected={unexpected}, missing={missing}"
        )

    # These are intentionally the final filesystem reads before returning success.
    # Re-reading through O_NOFOLLOW catches same-byte pathname replacement as well as
    # content mutation after the bytes used for inspection were captured.
    if candidate_snapshot is not None:
        reassert_stable_regular_file(
            candidate, candidate_snapshot, label="retained candidate"
        )
    elif os.path.lexists(candidate):
        fail("result claims no output but a candidate appeared during verification")
    if geometry_snapshot is not None:
        reassert_stable_regular_file(
            geometry_path, geometry_snapshot, label="geometry authority"
        )
    for authority_path, authority_snapshot, authority_label in authority_snapshots:
        reassert_stable_regular_file(
            authority_path, authority_snapshot, label=authority_label
        )
    reassert_stable_regular_file(
        expected_result, result_snapshot, label="retained result"
    )

    return {
        **target_report,
        "status": result["status"],
        "attemptCount": attempt_count,
        "writtenOutputPaths": written,
        "verification": "pass",
    }


def _ensure_safe_parent(workspace: Path, destination: Path) -> None:
    relative_parent = destination.parent.relative_to(workspace)
    cursor = workspace
    for part in relative_parent.parts:
        cursor = cursor / part
        try:
            metadata = cursor.lstat()
        except FileNotFoundError:
            try:
                cursor.mkdir(mode=0o755)
            except FileExistsError:
                pass
            metadata = cursor.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            fail(f"result parent is not a safe directory: {cursor}")


def _failed_result_transaction_checkpoint(_phase: str) -> None:
    """Test seam for simulating process death at durable transaction boundaries."""


def _metadata_identity(metadata: os.stat_result) -> tuple[int, int]:
    return metadata.st_dev, metadata.st_ino


def _stat_at(parent_descriptor: int, name: str) -> os.stat_result | None:
    try:
        return os.stat(name, dir_fd=parent_descriptor, follow_symlinks=False)
    except FileNotFoundError:
        return None


def _read_regular_at(
    parent_descriptor: int, name: str, *, max_bytes: int = 1024 * 1024
) -> tuple[bytes, os.stat_result]:
    flags = os.O_RDONLY | os.O_NONBLOCK
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(name, flags, dir_fd=parent_descriptor)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            fail(f"failed-result transaction member must be a regular file: {name}")
        if before.st_size < 0 or before.st_size > max_bytes:
            fail(f"failed-result transaction member is outside the byte envelope: {name}")
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(remaining, 64 * 1024))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        after = os.fstat(descriptor)
        retained = _stat_at(parent_descriptor, name)
        data = b"".join(chunks)
        if (
            retained is None
            or _metadata_identity(before) != _metadata_identity(after)
            or _metadata_identity(before) != _metadata_identity(retained)
            or len(data) != before.st_size
        ):
            fail(f"failed-result transaction member changed while being read: {name}")
        return data, before
    finally:
        os.close(descriptor)


def _open_locked_owner_at(
    parent_descriptor: int, name: str, *, max_bytes: int = 1024 * 1024
) -> tuple[int, bytes, os.stat_result]:
    flags = os.O_RDONLY | os.O_NONBLOCK
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(name, flags, dir_fd=parent_descriptor)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            fail("failed-result transaction owner is locked by another writer")
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            fail("failed-result transaction owner must be a regular file")
        if before.st_size < 0 or before.st_size > max_bytes:
            fail("failed-result transaction owner is outside the byte envelope")
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(remaining, 64 * 1024))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        after = os.fstat(descriptor)
        retained = _stat_at(parent_descriptor, name)
        data = b"".join(chunks)
        if (
            retained is None
            or _metadata_identity(before) != _metadata_identity(after)
            or _metadata_identity(before) != _metadata_identity(retained)
            or len(data) != before.st_size
        ):
            fail("failed-result transaction owner changed while being locked")
        return descriptor, data, before
    except Exception:
        os.close(descriptor)
        raise


def _unlink_owned_at(
    parent_descriptor: int,
    name: str,
    owned_identity: tuple[int, int],
) -> bool:
    retained = _stat_at(parent_descriptor, name)
    if retained is None or _metadata_identity(retained) != owned_identity:
        return False
    os.unlink(name, dir_fd=parent_descriptor)
    return True


def _reassert_authorities(authorities: list[AuthoritySnapshot]) -> None:
    for authority_path, authority_snapshot, authority_label in authorities:
        reassert_stable_regular_file(
            authority_path, authority_snapshot, label=authority_label
        )


def _reassert_provider_source(
    source_path: Path | None, source_snapshot: StableFileSnapshot | None
) -> None:
    if source_path is not None and source_snapshot is not None:
        reassert_stable_regular_file(
            source_path.absolute(), source_snapshot, label="normalization provider source"
        )


def _write_all(descriptor: int, data: memoryview) -> None:
    remaining = data
    while remaining:
        written = os.write(descriptor, remaining)
        if written <= 0:
            fail("failed-result stage write made no progress")
        remaining = remaining[written:]


def _open_fsynced_unnamed_file(
    parent_descriptor: int,
    content: bytes,
    *,
    in_progress_checkpoint: str | None = None,
) -> tuple[int, int]:
    """Return an open, complete, fsynced inode that has never had a pathname."""

    temporary_flag = getattr(os, "O_TMPFILE", None)
    if temporary_flag is None:
        fail("atomic failed-result staging requires O_TMPFILE support")
    try:
        descriptor = os.open(
            ".", os.O_WRONLY | temporary_flag, 0o644, dir_fd=parent_descriptor
        )
    except OSError as error:
        fail(f"cannot create unnamed failed-result stage: {error}")
    try:
        if in_progress_checkpoint is None:
            _write_all(descriptor, memoryview(content))
        else:
            midpoint = max(1, len(content) // 2)
            _write_all(descriptor, memoryview(content)[:midpoint])
            _failed_result_transaction_checkpoint(in_progress_checkpoint)
            _write_all(descriptor, memoryview(content)[midpoint:])
        os.fsync(descriptor)
        staged_metadata = os.fstat(descriptor)
        return descriptor, _metadata_identity(staged_metadata)
    except Exception:
        os.close(descriptor)
        raise


def _link_unnamed_file(
    descriptor: int,
    parent_descriptor: int,
    name: str,
    expected_identity: tuple[int, int],
    *,
    label: str,
) -> None:
    try:
        # O_TMPFILE has no pathname. /proc/self/fd supplies the kernel-owned
        # descriptor link needed to atomically publish it without replacement.
        os.link(
            f"/proc/self/fd/{descriptor}",
            name,
            dst_dir_fd=parent_descriptor,
            follow_symlinks=True,
        )
    except FileExistsError:
        fail(f"pre-existing failed-result transaction {label} collision")
    except OSError as error:
        fail(f"cannot publish failed-result transaction {label}: {error}")
    retained = _stat_at(parent_descriptor, name)
    if retained is None or _metadata_identity(retained) != expected_identity:
        fail(f"failed-result transaction {label} identity changed during persistence")
    os.fsync(parent_descriptor)


def _authority_hashes(
    authorities: list[AuthoritySnapshot],
    provider_source_snapshot: StableFileSnapshot | None,
) -> list[dict[str, str]]:
    retained = [
        {"label": label, "contentHash": snapshot.content_hash}
        for _, snapshot, label in authorities
    ]
    if provider_source_snapshot is not None:
        retained.append(
            {
                "label": "normalization provider source",
                "contentHash": provider_source_snapshot.content_hash,
            }
        )
    return retained


def _failed_result_owner_record(
    target: dict[str, Any],
    assignment: dict[str, Any],
    result_path: str,
    stage_name: str,
    result_bytes: bytes,
    result_identity: tuple[int, int],
    authority_hashes: list[dict[str, str]],
    transaction_token: str,
    owner_pid: int,
    owner_process_epoch: dict[str, str],
) -> dict[str, Any]:
    return {
        "schemaVersion": "skill-icon-failed-result-owner-v1",
        "jobId": target["jobId"],
        "assignmentId": assignment["assignmentId"],
        "resultPath": result_path,
        "stageName": stage_name,
        "resultBytes": len(result_bytes),
        "resultContentHash": hashlib.sha256(result_bytes).hexdigest(),
        "resultIdentity": {
            "device": result_identity[0],
            "inode": result_identity[1],
        },
        "authorityHashes": authority_hashes,
        "transactionToken": transaction_token,
        "ownerPid": owner_pid,
        "ownerProcessEpoch": owner_process_epoch,
    }


def _canonical_json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _create_failed_result_transaction(
    parent_descriptor: int,
    owner_name: str,
    stage_name: str,
    result_bytes: bytes,
    owner_record_factory: Callable[[tuple[int, int]], dict[str, Any]],
    post_owner_publication_check: Callable[[], None],
) -> tuple[tuple[int, int], tuple[int, int], int]:
    result_descriptor, result_identity = _open_fsynced_unnamed_file(
        parent_descriptor,
        result_bytes,
        in_progress_checkpoint="stage-write-in-progress",
    )
    owner_identity: tuple[int, int] | None = None
    owner_descriptor: int | None = None
    retained_owner_descriptor: int | None = None
    try:
        owner_record = owner_record_factory(result_identity)
        owner_bytes = _canonical_json_bytes(owner_record)
        owner_descriptor, owner_identity = _open_fsynced_unnamed_file(
            parent_descriptor, owner_bytes
        )
        fcntl.flock(owner_descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _link_unnamed_file(
            owner_descriptor,
            parent_descriptor,
            owner_name,
            owner_identity,
            label="owner record",
        )
        retained_owner_descriptor = owner_descriptor
        owner_descriptor = None
        _failed_result_transaction_checkpoint("owner-published")
        post_owner_publication_check()
        _link_unnamed_file(
            result_descriptor,
            parent_descriptor,
            stage_name,
            result_identity,
            label="stage",
        )
        _failed_result_transaction_checkpoint("staged")
        return result_identity, owner_identity, retained_owner_descriptor
    except Exception:
        if retained_owner_descriptor is not None:
            os.close(retained_owner_descriptor)
            retained_owner_descriptor = None
        removed = _unlink_owned_at(parent_descriptor, stage_name, result_identity)
        if owner_identity is not None:
            removed = (
                _unlink_owned_at(parent_descriptor, owner_name, owner_identity)
                or removed
            )
        if removed:
            os.fsync(parent_descriptor)
        raise
    finally:
        if owner_descriptor is not None:
            os.close(owner_descriptor)
        os.close(result_descriptor)


def _assert_supersession_intent_absent_at(
    parent_descriptor: int, intent_name: str
) -> None:
    if _stat_at(parent_descriptor, intent_name) is not None:
        fail("coordinator supersession intent blocks producer result persistence")


def _process_start_time_ticks(pid: int) -> str | None:
    try:
        raw = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
    except (FileNotFoundError, ProcessLookupError):
        return None
    except OSError as error:
        fail(f"cannot inspect failed-result transaction owner process: {error}")
    closing_parenthesis = raw.rfind(")")
    fields = raw[closing_parenthesis + 2 :].split() if closing_parenthesis >= 0 else []
    if len(fields) <= 19 or not fields[19].isdigit():
        fail("failed-result transaction owner process has malformed identity data")
    return fields[19]


def _current_process_epoch() -> dict[str, str]:
    try:
        boot_id = Path("/proc/sys/kernel/random/boot_id").read_text(
            encoding="ascii"
        ).strip()
    except OSError as error:
        fail(f"cannot inspect host boot identity for failed-result transaction: {error}")
    start_time = _process_start_time_ticks(os.getpid())
    if not boot_id or start_time is None:
        fail("cannot establish failed-result transaction process epoch")
    return {"bootId": boot_id, "startTimeTicks": start_time}


def _owner_process_is_live(owner_record: dict[str, Any]) -> bool:
    pid = owner_record.get("ownerPid")
    epoch = owner_record.get("ownerProcessEpoch")
    if (
        isinstance(pid, bool)
        or not isinstance(pid, int)
        or pid <= 0
        or not isinstance(epoch, dict)
        or set(epoch) != {"bootId", "startTimeTicks"}
        or not all(isinstance(value, str) and value for value in epoch.values())
    ):
        fail("failed-result transaction owner record has invalid process identity")
    current_epoch = _current_process_epoch()
    if epoch["bootId"] != current_epoch["bootId"]:
        return False
    observed_start_time = _process_start_time_ticks(pid)
    return observed_start_time == epoch["startTimeTicks"]


def _validated_owner_record(
    owner_bytes: bytes,
    target: dict[str, Any],
    assignment: dict[str, Any],
    result_path: str,
    stage_name: str,
    result_bytes: bytes,
    authority_hashes: list[dict[str, str]],
) -> tuple[dict[str, Any], tuple[int, int]]:
    try:
        owner_record = json.loads(owner_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("failed-result transaction owner record is malformed")
    if not isinstance(owner_record, dict):
        fail("failed-result transaction owner record must be an object")
    transaction_token = owner_record.get("transactionToken")
    owner_pid = owner_record.get("ownerPid")
    owner_epoch = owner_record.get("ownerProcessEpoch")
    identity = owner_record.get("resultIdentity")
    if (
        not isinstance(transaction_token, str)
        or re.fullmatch(r"[a-f0-9]{64}", transaction_token) is None
        or isinstance(owner_pid, bool)
        or not isinstance(owner_pid, int)
        or not isinstance(owner_epoch, dict)
        or not isinstance(identity, dict)
        or set(identity) != {"device", "inode"}
        or any(
            isinstance(value, bool) or not isinstance(value, int) or value < 0
            for value in identity.values()
        )
    ):
        fail("failed-result transaction owner record is invalid")
    result_identity = identity["device"], identity["inode"]
    expected_record = _failed_result_owner_record(
        target,
        assignment,
        result_path,
        stage_name,
        result_bytes,
        result_identity,
        authority_hashes,
        transaction_token,
        owner_pid,
        owner_epoch,
    )
    if owner_bytes != _canonical_json_bytes(expected_record):
        fail("failed-result transaction owner record is foreign or incompatible")
    return owner_record, result_identity


def persist_failed_result(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    attempt_count: int,
    failure_kind: str,
    failure_message: str,
    started_at: str,
    completed_at: str | None = None,
    total_wall_time_ms: int | None = None,
    contract_root: Path | None = None,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
    normalization_source: Path | None = None,
) -> dict[str, Any]:
    """Persist and verify one failed execution using a recoverable hard-link transaction.

    The hidden owner record and stage are evidence only while a transaction is incomplete.
    Durable owner removal commits the final before best-effort stage cleanup; a crash can leave a
    harmless no-owner stage beside the committed final, and later calls treat the final as an
    already-complete or foreign collision rather than recovering or deleting either path.
    """

    root = workspace.absolute()
    bound_target_path = target_path or absolute_project_path(
        root, assignment["targetPath"], must_exist=True, regular_file=True
    )
    bound_assignment_path = assignment_path or absolute_project_path(
        root, assignment["assignmentPath"], must_exist=True, regular_file=True
    )
    authority_snapshots: list[AuthoritySnapshot] = []
    validate(
        target,
        assignment,
        root,
        target_path=bound_target_path,
        assignment_path=bound_assignment_path,
        # An interrupted transaction can legitimately leave its result and hidden
        # hard-link stage present. They are admitted here only so the exact owned
        # transaction can be recovered below; every other collision still fails.
        allow_existing_outputs=True,
        contract_root=contract_root or root,
        _authority_snapshots=authority_snapshots,
    )
    _validate_attempt_count(assignment, attempt_count)
    if failure_kind not in FAILURE_KINDS:
        fail("failure kind is unsupported")
    if not isinstance(failure_message, str) or not failure_message.strip():
        fail("failure message must be non-empty")
    started_at, completed_at, total_wall_time_ms = _resolve_failure_timing(
        started_at, completed_at, total_wall_time_ms
    )
    exact_prompt = target["exactPrompt"]
    is_v2 = target.get("schemaVersion") == "skill-icon-target-v2"
    if normalization_source is not None and not is_v2:
        fail("--normalization-source is valid only for v2 normalization failures")
    result = {
        "schemaVersion": (
            "skill-icon-result-v2" if is_v2 else "skill-icon-result-v1"
        ),
        "resultId": f"result-{target['jobId']}",
        "jobId": target["jobId"],
        "assignmentId": assignment["assignmentId"],
        "status": "failed",
        "exactPrompt": exact_prompt,
        "promptHash": hashlib.sha256(exact_prompt.encode("utf-8")).hexdigest(),
        "referenceInputs": [
            {"path": reference["path"], "contentHash": reference["contentHash"]}
            for reference in target["references"]
        ],
        "output": None,
        "resultPath": target["output"]["resultPath"],
        "findings": [
            {
                "category": "other",
                "evaluator": "producer",
                "outcome": "fail",
                "observation": failure_message.strip(),
            }
        ],
        "failureReason": {
            "kind": failure_kind,
            "message": failure_message.strip(),
        },
        "startedAt": started_at,
        "completedAt": completed_at,
        "totalWallTimeMs": total_wall_time_ms,
        "writtenOutputPaths": [target["output"]["resultPath"]],
        "noSharedFilesEdited": True,
        "selfPromoted": False,
    }
    provider_source_snapshot: StableFileSnapshot | None = None
    if is_v2:
        normalization = target["normalization"]
        provider_source = None
        if normalization_source is not None:
            provider_source, provider_source_snapshot = _observed_provider_source(
                normalization_source
            )
        result.update(
            {
                "logicalIdentity": target["logicalIdentity"],
                "revision": target["revision"],
                "normalization": {
                    "profile": normalization["profile"],
                    "outcome": "failed" if provider_source is not None else "not-run",
                    "geometryHash": normalization["geometry"]["contentHash"],
                    "providerSource": provider_source,
                    "sourceContentHash": (
                        provider_source["contentHash"]
                        if provider_source is not None
                        else None
                    ),
                    "outputContentHash": None,
                },
            }
        )
        if normalization["profile"] in {
            PROFILE_V2,
            PROFILE_V3,
            PROFILE_V4,
            PROFILE_V5,
            PROFILE_V6,
        }:
            result["normalization"].update(
                {
                    "decoderInputContentHash": None,
                    "containerBox": None,
                    "colorSpaceDisposition": None,
                }
            )
    run_contract_validation(
        "execution",
        target,
        assignment,
        result=result,
        contract_root=contract_root or root,
    )
    result_path = absolute_project_path(root, target["output"]["resultPath"])
    candidate_path = absolute_project_path(root, target["output"]["candidatePath"])
    if os.path.lexists(candidate_path):
        fail(f"pre-existing output collision: {target['output']['candidatePath']}")
    _ensure_safe_parent(root, result_path)
    result_bytes = (json.dumps(result, indent=2, sort_keys=True) + "\n").encode("utf-8")
    stage_name = f".{result_path.name}.failed-result-stage"
    owner_name = f".{result_path.name}.failed-result-owner.json"
    supersession_intent_name = (
        f".{result_path.name}.skill-icon-supersession-intent.json"
    )
    stage_path = result_path.parent / stage_name
    owner_path = result_path.parent / owner_name
    supersession_intent_path = result_path.parent / supersession_intent_name
    result_relative = result_path.relative_to(root).as_posix()
    stage_relative = stage_path.relative_to(root).as_posix()
    owner_relative = owner_path.relative_to(root).as_posix()
    if os.path.lexists(supersession_intent_path):
        fail("coordinator supersession intent blocks producer result persistence")
    dirty = _changed_repository_paths(root) - {
        result_relative,
        stage_relative,
        owner_relative,
    }
    if dirty:
        fail(f"cannot persist failure result in a dirty workspace: {sorted(dirty)}")
    parent_metadata = result_path.parent.lstat()
    parent_real_path = result_path.parent.resolve()
    if root != parent_real_path and root not in parent_real_path.parents:
        fail("result parent escaped the workspace root")
    directory_flags = os.O_RDONLY | os.O_DIRECTORY
    if hasattr(os, "O_NOFOLLOW"):
        directory_flags |= os.O_NOFOLLOW
    parent_descriptor = os.open(result_path.parent, directory_flags)
    opened_parent = os.fstat(parent_descriptor)
    if (opened_parent.st_dev, opened_parent.st_ino) != (
        parent_metadata.st_dev,
        parent_metadata.st_ino,
    ):
        os.close(parent_descriptor)
        fail("result parent identity changed before exclusive create")
    result_identity: tuple[int, int] | None = None
    owner_identity: tuple[int, int] | None = None
    owner_lock_descriptor: int | None = None
    owns_transaction = False
    transaction_authority_hashes = _authority_hashes(
        authority_snapshots, provider_source_snapshot
    )
    try:
        _assert_supersession_intent_absent_at(
            parent_descriptor, supersession_intent_name
        )
        owner_metadata = _stat_at(parent_descriptor, owner_name)
        stage_metadata = _stat_at(parent_descriptor, stage_name)
        final_metadata = _stat_at(parent_descriptor, result_path.name)
        if owner_metadata is None:
            if final_metadata is not None:
                fail(f"pre-existing output collision: {target['output']['resultPath']}")
            if stage_metadata is not None:
                fail("failed-result transaction stage has no owner record")
        else:
            (
                owner_lock_descriptor,
                owner_bytes,
                stable_owner_metadata,
            ) = _open_locked_owner_at(
                parent_descriptor, owner_name
            )
            owner_record, recorded_result_identity = _validated_owner_record(
                owner_bytes,
                target,
                assignment,
                target["output"]["resultPath"],
                stage_name,
                result_bytes,
                transaction_authority_hashes,
            )
            owner_identity = _metadata_identity(stable_owner_metadata)
            if _owner_process_is_live(owner_record):
                fail("failed-result transaction already has a live owner")
            if stage_metadata is None:
                if final_metadata is not None:
                    fail("dead failed-result owner has a final result but no stage")
                if not _unlink_owned_at(
                    parent_descriptor, owner_name, owner_identity
                ):
                    fail("dead failed-result owner record was replaced during recovery")
                os.fsync(parent_descriptor)
                os.close(owner_lock_descriptor)
                owner_lock_descriptor = None
                owner_identity = None
            else:
                if _metadata_identity(stage_metadata) != recorded_result_identity:
                    fail("failed-result stage inode does not match its owner record")
                if (
                    final_metadata is not None
                    and _metadata_identity(final_metadata) != recorded_result_identity
                ):
                    fail("failed-result final inode does not match its owner record")
                result_identity = recorded_result_identity
                owns_transaction = True

        if result_identity is not None:
            staged_bytes, stable_stage_metadata = _read_regular_at(
                parent_descriptor, stage_name
            )
            if staged_bytes != result_bytes:
                fail("pre-existing failed-result transaction is foreign or incompatible")
            if _metadata_identity(stable_stage_metadata) != result_identity:
                fail("failed-result stage changed during dead-owner recovery")
        else:
            transaction_token = secrets.token_hex(32)
            owner_pid = os.getpid()
            owner_process_epoch = _current_process_epoch()
            (
                result_identity,
                owner_identity,
                owner_lock_descriptor,
            ) = _create_failed_result_transaction(
                parent_descriptor,
                owner_name,
                stage_name,
                result_bytes,
                lambda identity: _failed_result_owner_record(
                    target,
                    assignment,
                    target["output"]["resultPath"],
                    stage_name,
                    result_bytes,
                    identity,
                    transaction_authority_hashes,
                    transaction_token,
                    owner_pid,
                    owner_process_epoch,
                ),
                lambda: _assert_supersession_intent_absent_at(
                    parent_descriptor, supersession_intent_name
                ),
            )
            owns_transaction = True

        assert result_identity is not None
        assert owner_identity is not None
        _assert_supersession_intent_absent_at(
            parent_descriptor, supersession_intent_name
        )
        current_parent = result_path.parent.lstat()
        if (
            _metadata_identity(current_parent) != _metadata_identity(parent_metadata)
            or result_path.parent.resolve() != parent_real_path
        ):
            fail("result parent identity changed during failed-result persistence")
        _reassert_authorities(authority_snapshots)
        _reassert_provider_source(normalization_source, provider_source_snapshot)

        final_metadata = _stat_at(parent_descriptor, result_path.name)
        if final_metadata is None:
            try:
                os.link(
                    stage_name,
                    result_path.name,
                    src_dir_fd=parent_descriptor,
                    dst_dir_fd=parent_descriptor,
                    follow_symlinks=False,
                )
            except FileExistsError:
                fail(
                    f"pre-existing output collision: {target['output']['resultPath']}"
                )
            installed = _stat_at(parent_descriptor, result_path.name)
            if (
                installed is None
                or _metadata_identity(installed) != result_identity
            ):
                fail("atomic failed-result install did not retain the staged inode")
            os.fsync(parent_descriptor)
            _failed_result_transaction_checkpoint("installed")

        report = verify(
            target,
            assignment,
            result,
            result_path,
            root,
            attempt_count=attempt_count,
            contract_root=contract_root or root,
            target_path=bound_target_path,
            assignment_path=bound_assignment_path,
            _ignored_changed_paths={stage_relative, owner_relative},
        )
        _reassert_authorities(authority_snapshots)
        _reassert_provider_source(normalization_source, provider_source_snapshot)
        current_parent = result_path.parent.lstat()
        if (
            _metadata_identity(current_parent) != _metadata_identity(parent_metadata)
            or result_path.parent.resolve() != parent_real_path
        ):
            fail("result parent identity changed before transaction completion")
        retained_final = _stat_at(parent_descriptor, result_path.name)
        retained_stage = _stat_at(parent_descriptor, stage_name)
        retained_owner = _stat_at(parent_descriptor, owner_name)
        if (
            retained_final is None
            or _metadata_identity(retained_final) != result_identity
        ):
            fail("persisted failed result was replaced before transaction completion")
        if (
            retained_stage is None
            or _metadata_identity(retained_stage) != result_identity
        ):
            fail("failed-result transaction ownership stage was replaced")
        if (
            retained_owner is None
            or _metadata_identity(retained_owner) != owner_identity
        ):
            fail("failed-result transaction owner record was replaced")
        if not _unlink_owned_at(parent_descriptor, owner_name, owner_identity):
            fail("failed-result transaction owner record was replaced")
        os.fsync(parent_descriptor)
        # Durable owner removal is the commit point. From here on the final is a
        # completed result, so cleanup may never throw into transaction rollback.
        owns_transaction = False
        _failed_result_transaction_checkpoint("committed")
        try:
            if _unlink_owned_at(parent_descriptor, stage_name, result_identity):
                os.fsync(parent_descriptor)
        except OSError:
            pass
        return report
    except Exception:
        if owns_transaction and result_identity is not None:
            removed = _unlink_owned_at(
                parent_descriptor, result_path.name, result_identity
            )
            removed = (
                _unlink_owned_at(parent_descriptor, stage_name, result_identity)
                or removed
            )
            if owner_identity is not None:
                removed = (
                    _unlink_owned_at(parent_descriptor, owner_name, owner_identity)
                    or removed
                )
            if removed:
                os.fsync(parent_descriptor)
        raise
    finally:
        if owner_lock_descriptor is not None:
            os.close(owner_lock_descriptor)
        os.close(parent_descriptor)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Verify one SkillIconResult, or exclusively persist a result-only provider failure."
        )
    )
    parser.add_argument("target", help="target JSON path")
    parser.add_argument("assignment", help="assignment JSON path")
    parser.add_argument("result", help="result JSON path")
    parser.add_argument("workspace_root", help="Summonlab repository root")
    parser.add_argument(
        "--attempt-count",
        type=int,
        required=True,
        help=(
            "actual image-generation calls, including at most one corrective edit; "
            "use 0 only to verify coordinator-authored superseded evidence"
        ),
    )
    parser.add_argument(
        "--write-failure",
        action="store_true",
        help="exclusive-create and verify a failed result without a candidate",
    )
    parser.add_argument("--failure-kind", choices=sorted(FAILURE_KINDS))
    parser.add_argument("--failure-message")
    parser.add_argument(
        "--normalization-source",
        help="v2 provider source rejected by deterministic normalization; evidence is pathless",
    )
    parser.add_argument(
        "--started-at",
        help="actual ISO-8601 time when the first provider attempt started",
    )
    parser.add_argument(
        "--completed-at",
        help="actual ISO-8601 completion time (or supply --total-wall-time-ms)",
    )
    parser.add_argument(
        "--total-wall-time-ms",
        type=int,
        help="actual elapsed milliseconds (or supply --completed-at)",
    )
    args = parser.parse_args()
    try:
        workspace = Path(args.workspace_root).absolute()
        target_path = _path_argument(workspace, args.target, "target")
        assignment_path = _path_argument(workspace, args.assignment, "assignment")
        target = load_json(target_path)
        assignment = load_json(assignment_path)
        reject_reprocess_packet_schemas(target, assignment)
        declared_result_path = absolute_project_path(
            workspace, target["output"]["resultPath"]
        )
        supplied_result_path = Path(args.result)
        if not supplied_result_path.is_absolute():
            supplied_result_path = workspace / supplied_result_path
        if supplied_result_path.absolute() != declared_result_path:
            fail("RESULT argument does not match target.output.resultPath")
        if args.write_failure:
            if (
                args.failure_kind is None
                or args.failure_message is None
                or args.started_at is None
                or (args.completed_at is None and args.total_wall_time_ms is None)
            ):
                fail(
                    "--write-failure requires --failure-kind, --failure-message, "
                    "--started-at, and either --completed-at or --total-wall-time-ms"
                )
            report = persist_failed_result(
                target,
                assignment,
                workspace,
                attempt_count=args.attempt_count,
                failure_kind=args.failure_kind,
                failure_message=args.failure_message,
                started_at=args.started_at,
                completed_at=args.completed_at,
                total_wall_time_ms=args.total_wall_time_ms,
                target_path=target_path,
                assignment_path=assignment_path,
                normalization_source=(
                    (
                        Path(args.normalization_source)
                        if Path(args.normalization_source).is_absolute()
                        else workspace / args.normalization_source
                    )
                    if args.normalization_source is not None
                    else None
                ),
            )
        else:
            if any(
                option is not None
                for option in (
                    args.failure_kind,
                    args.failure_message,
                    args.started_at,
                    args.completed_at,
                    args.total_wall_time_ms,
                    args.normalization_source,
                )
            ):
                fail("failure options require --write-failure")
            result_path = _path_argument(workspace, args.result, "result")
            report = verify(
                target,
                assignment,
                load_json(result_path),
                result_path,
                workspace,
                attempt_count=args.attempt_count,
                target_path=target_path,
                assignment_path=assignment_path,
            )
    except (
        KeyError,
        OSError,
        TypeError,
        UnicodeDecodeError,
        json.JSONDecodeError,
        ValueError,
    ) as error:
        raise SystemExit(f"result verification failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
