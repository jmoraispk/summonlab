#!/usr/bin/env python3
"""Verify one retained skill-icon candidate and its structured result."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import struct
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from validate_target import (
    _path_argument,
    absolute_project_path,
    fail,
    load_json,
    load_json_snapshot,
    read_stable_regular_file,
    read_stable_regular_file_snapshot,
    reassert_stable_regular_file,
    run_asset_inspection,
    run_contract_validation,
    validate,
)

GEOMETRY_PATH = "assets/wiki/skills/icon-production-v1/geometry.json"
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


def _validate_attempt_count(assignment: dict[str, Any], attempt_count: int) -> None:
    if isinstance(attempt_count, bool) or not isinstance(attempt_count, int):
        fail("attempt count must be an integer")
    if not 1 <= attempt_count <= 1 + assignment["retryCeiling"]:
        fail("attempt count violates the assignment retry ceiling")


def _observed_provider_source(source_path: Path) -> dict[str, Any]:
    absolute = source_path.absolute()
    data = read_stable_regular_file(absolute)
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
    return {
        "mediaType": media_type,
        "width": width,
        "height": height,
        "bytes": len(data),
        "alphaMode": alpha_mode,
        "contentHash": content_hash,
    }


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
) -> dict[str, Any]:
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

    _validate_attempt_count(assignment, attempt_count)

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
    else:
        candidate = absolute_project_path(
            root, candidate_path, must_exist=True, regular_file=True
        )
        geometry_path = absolute_project_path(
            root, GEOMETRY_PATH, must_exist=True, regular_file=True
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
            if (
                not isinstance(normalization, dict)
                or normalization.get("outcome") != "completed"
            ):
                fail("retained v2 candidate requires completed normalization evidence")
            provider_source = normalization.get("providerSource")
            if not isinstance(provider_source, dict) or "path" in provider_source:
                fail("v2 provider source evidence must be pathless")
            if normalization.get("sourceContentHash") != provider_source.get(
                "contentHash"
            ):
                fail("v2 provider source hash binding is invalid")
            if normalization.get("outputContentHash") != inspection["contentHash"]:
                fail("v2 normalized output hash does not bind retained candidate")
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
    root = workspace.absolute()
    validate(
        target,
        assignment,
        root,
        target_path=target_path,
        assignment_path=assignment_path,
        allow_existing_outputs=False,
        contract_root=contract_root or root,
    )
    _validate_attempt_count(assignment, attempt_count)
    if failure_kind not in FAILURE_KINDS:
        fail("failure kind is unsupported")
    if not isinstance(failure_message, str) or not failure_message.strip():
        fail("failure message must be non-empty")
    started_at, completed_at, total_wall_time_ms = _resolve_failure_timing(
        started_at, completed_at, total_wall_time_ms
    )
    dirty = _changed_repository_paths(root)
    if dirty:
        fail(f"cannot persist failure result in a dirty workspace: {sorted(dirty)}")
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
    if is_v2:
        normalization = target["normalization"]
        provider_source = (
            _observed_provider_source(normalization_source)
            if normalization_source is not None
            else None
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
    run_contract_validation(
        "execution",
        target,
        assignment,
        result=result,
        contract_root=contract_root or root,
    )
    result_path = absolute_project_path(root, target["output"]["resultPath"])
    _ensure_safe_parent(root, result_path)
    result_bytes = (json.dumps(result, indent=2, sort_keys=True) + "\n").encode("utf-8")
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
    file_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        file_flags |= os.O_NOFOLLOW
    descriptor: int | None = None
    created = False
    created_metadata: os.stat_result | None = None
    try:
        descriptor = os.open(
            result_path.name,
            file_flags,
            0o644,
            dir_fd=parent_descriptor,
        )
        created = True
        created_metadata = os.fstat(descriptor)
        with os.fdopen(descriptor, "wb", closefd=False) as stream:
            stream.write(result_bytes)
            stream.flush()
            os.fsync(stream.fileno())
        os.close(descriptor)
        descriptor = None
        retained_metadata = os.stat(
            result_path.name, dir_fd=parent_descriptor, follow_symlinks=False
        )
        current_parent = result_path.parent.lstat()
        if (
            not stat.S_ISREG(retained_metadata.st_mode)
            or (retained_metadata.st_dev, retained_metadata.st_ino)
            != (created_metadata.st_dev, created_metadata.st_ino)
            or (current_parent.st_dev, current_parent.st_ino)
            != (parent_metadata.st_dev, parent_metadata.st_ino)
            or result_path.parent.resolve() != parent_real_path
        ):
            fail("result or parent identity changed during exclusive persistence")
        os.fsync(parent_descriptor)
    except Exception:
        if descriptor is not None:
            os.close(descriptor)
        if created:
            try:
                retained_metadata = os.stat(
                    result_path.name, dir_fd=parent_descriptor, follow_symlinks=False
                )
                if created_metadata is not None and (
                    retained_metadata.st_dev,
                    retained_metadata.st_ino,
                ) == (created_metadata.st_dev, created_metadata.st_ino):
                    os.unlink(result_path.name, dir_fd=parent_descriptor)
                    os.fsync(parent_descriptor)
            except FileNotFoundError:
                pass
        raise
    finally:
        os.close(parent_descriptor)
    return verify(
        target,
        assignment,
        result,
        result_path,
        root,
        attempt_count=attempt_count,
        contract_root=contract_root or root,
        target_path=target_path,
        assignment_path=assignment_path,
    )


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
        help="actual image-generation calls, including at most one corrective edit",
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
