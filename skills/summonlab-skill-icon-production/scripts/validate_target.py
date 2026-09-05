#!/usr/bin/env python3
"""Validate one skill-icon target and assignment before any generation call."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Callable

PROTOCOLS = {
    (
        "skill-icon-target-v1",
        "skill-icon-assignment-v1",
        "summonlab-skill-icon-production-v1",
    ): "skill-icon-execution-v1",
    (
        "skill-icon-target-v2",
        "skill-icon-assignment-v2",
        "summonlab-skill-icon-production-v2",
    ): "skill-icon-execution-v2",
    (
        "skill-icon-target-v2",
        "skill-icon-assignment-v2",
        "summonlab-skill-icon-production-v3",
    ): "skill-icon-execution-v2",
    (
        "skill-icon-target-v2",
        "skill-icon-assignment-v2",
        "summonlab-skill-icon-production-v4",
    ): "skill-icon-execution-v2",
    (
        "skill-icon-target-v2",
        "skill-icon-assignment-v2",
        "summonlab-skill-icon-production-v5",
    ): "skill-icon-execution-v2",
}
NORMALIZATION_SKILL_VERSIONS = {
    "skill-icon-green-key-role-mask-v1": "summonlab-skill-icon-production-v2",
    "skill-icon-green-key-role-mask-v2": "summonlab-skill-icon-production-v3",
    "skill-icon-green-key-role-mask-v3": "summonlab-skill-icon-production-v4",
    "skill-icon-geometry-role-mask-v1": "summonlab-skill-icon-production-v5",
}
PROFILE_V1 = "skill-icon-green-key-role-mask-v1"
PROFILE_V2 = "skill-icon-green-key-role-mask-v2"
PROFILE_V3 = "skill-icon-green-key-role-mask-v3"
PROFILE_V4 = "skill-icon-geometry-role-mask-v1"
REPROCESS_PACKET_SCHEMA_VERSIONS = frozenset(
    {
        "skill-icon-reprocess-target-v1",
        "skill-icon-reprocess-assignment-v1",
        "skill-icon-reprocess-result-v1",
        "skill-icon-reprocess-execution-v1",
    }
)
GEOMETRY_PATH = "assets/wiki/skills/icon-production-v1/geometry.json"
GEOMETRY_V2_PATH = "assets/wiki/skills/icon-production-v1/geometry-v2.json"
GEOMETRY_HASH = "4a8645adb0f820011b2bf9383710e0161a36905b8e99f1e8d6797b4104d4f7d7"
GEOMETRY_V2_HASH = "6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab"
NORMALIZATION_GEOMETRY_AUTHORITIES = {
    PROFILE_V1: (GEOMETRY_PATH, GEOMETRY_HASH),
    PROFILE_V2: (GEOMETRY_PATH, GEOMETRY_HASH),
    PROFILE_V3: (GEOMETRY_V2_PATH, GEOMETRY_V2_HASH),
    PROFILE_V4: (GEOMETRY_V2_PATH, GEOMETRY_V2_HASH),
}
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
CATALOG_PATH = "assets/wiki/skills/icon-production-v1/catalog.json"
STYLE_AUTHORITY_PATH = (
    "assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png"
)
GEOMETRY_GUIDE_PATH = (
    "assets/wiki/skills/icon-production-v1/references/geometry-guide.png"
)
GEOMETRY_GUIDE_V2_PATH = (
    "assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png"
)
GEOMETRY_GUIDE_V2_HASH = (
    "8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e"
)
STYLE_AUTHORITY_PURPOSE = "Global Painted Emblem style authority."
GEOMETRY_GUIDE_PURPOSE = "Geometry guide for registration and safe zones."
GEOMETRY_GUIDE_V2_PURPOSE = (
    "Provider-space role-mask guide for rarity-frame and backing registration."
)
CALIBRATION_PURPOSE = "Approved motif-family calibration plate."
PRIMARY_PARENT_PURPOSE = "Approved primary-parent master."

_CONTRACT_PROGRAM = r"""
import fs from 'node:fs';
import {
  AnySkillIconAssignmentSchema,
  SkillIconCatalogSchema,
  AnySkillIconExecutionSchema,
  AnySkillIconTargetSchema
} from './packages/contracts/src/index.ts';
import { inspectSkillIconAsset } from './tools/validate-skill-icon-assets.ts';
async function main() {
  const packet = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (packet.kind === 'inputs') {
    AnySkillIconTargetSchema.parse(packet.target);
    AnySkillIconAssignmentSchema.parse(packet.assignment);
    SkillIconCatalogSchema.parse(packet.catalog);
  } else if (packet.kind === 'execution') {
    AnySkillIconExecutionSchema.parse({
      schemaVersion: packet.executionSchemaVersion,
      target: packet.target,
      assignment: packet.assignment,
      result: packet.result
    });
  } else if (packet.kind === 'inspection') {
    const candidateBytes = Buffer.from(packet.candidateBase64, 'base64');
    const inspection = await inspectSkillIconAsset(
      candidateBytes,
      packet.role,
      packet.geometry
    );
    process.stdout.write(JSON.stringify(inspection));
  } else {
    throw new Error('unknown contract packet kind');
  }
}
main().catch((error) => {
  const detail = error && typeof error === 'object' && 'issues' in error
    ? error.issues
    : String(error);
  process.stderr.write(JSON.stringify(detail));
  process.exit(2);
});
"""


def fail(message: str) -> None:
    raise ValueError(message)


def reject_reprocess_packet_schemas(*packets: object) -> None:
    """Keep coordinator-only source reuse out of the dedicated producer."""

    for packet in packets:
        if not isinstance(packet, dict):
            continue
        schema_version = packet.get("schemaVersion")
        if schema_version in REPROCESS_PACKET_SCHEMA_VERSIONS or (
            isinstance(schema_version, str)
            and schema_version.startswith("skill-icon-reprocess-")
        ):
            fail(
                "coordinator-only reprocess packets are not accepted by the "
                "skill-icon production skill"
            )


@dataclass(frozen=True)
class StableFileSnapshot:
    data: bytes
    content_hash: str
    identity: tuple[int, int, int, int, int, int]


AuthoritySnapshot = tuple[Path, StableFileSnapshot, str]


def _file_identity(value: os.stat_result) -> tuple[int, int, int, int, int, int]:
    return (
        value.st_dev,
        value.st_ino,
        value.st_size,
        value.st_nlink,
        value.st_mtime_ns,
        value.st_ctime_ns,
    )


def read_stable_regular_file_snapshot(
    path: Path,
    *,
    max_bytes: int = 64 * 1024 * 1024,
    _after_open: Callable[[], None] | None = None,
) -> StableFileSnapshot:
    """Read one regular file once and bind bytes to its stable pathname identity."""

    # O_NONBLOCK must be present at open time: an attacker can replace a checked
    # regular pathname with a FIFO, and opening a reader-only FIFO would otherwise
    # wait indefinitely before fstat can reject it.
    flags = os.O_RDONLY | os.O_NONBLOCK
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            fail(f"path must be a regular file: {path}")
        if before.st_size < 0 or before.st_size > max_bytes:
            fail(f"file is outside the bounded byte envelope: {path}")
        if _after_open is not None:
            _after_open()
        chunks: list[bytes] = []
        remaining = before.st_size
        while remaining:
            chunk = os.read(descriptor, min(remaining, 1024 * 1024))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        after = os.fstat(descriptor)
        current = path.lstat()
        data = b"".join(chunks)
        if (
            _file_identity(before) != _file_identity(after)
            or _file_identity(before) != _file_identity(current)
            or stat.S_ISLNK(current.st_mode)
            or len(data) != before.st_size
        ):
            fail(f"file changed while it was being read: {path}")
        return StableFileSnapshot(
            data=data,
            content_hash=hashlib.sha256(data).hexdigest(),
            identity=_file_identity(before),
        )
    finally:
        os.close(descriptor)


def reassert_stable_regular_file(
    path: Path, expected: StableFileSnapshot, *, label: str
) -> None:
    current = read_stable_regular_file_snapshot(path)
    if (
        current.identity != expected.identity
        or current.content_hash != expected.content_hash
    ):
        fail(f"{label} changed before verification completed: {path}")


def load_json_snapshot(path: Path) -> tuple[dict[str, Any], StableFileSnapshot]:
    snapshot = read_stable_regular_file_snapshot(path)
    value = json.loads(snapshot.data.decode("utf-8"))
    if not isinstance(value, dict):
        fail(f"{path} must contain a JSON object")
    return value, snapshot


def load_json(path: Path) -> dict[str, Any]:
    return load_json_snapshot(path)[0]


def read_stable_regular_file(path: Path, *, max_bytes: int = 64 * 1024 * 1024) -> bytes:
    return read_stable_regular_file_snapshot(path, max_bytes=max_bytes).data


def project_path(raw: Any) -> PurePosixPath:
    if not isinstance(raw, str) or not raw:
        fail("repository path must be a non-empty string")
    if any(ord(character) <= 31 or ord(character) == 127 for character in raw):
        fail(f"unsafe repository path: {raw!r}")
    path = PurePosixPath(raw)
    if (
        path.is_absolute()
        or "\\" in raw
        or "://" in raw
        or re.match(r"^[A-Za-z]:", raw)
        or any(part in {"", ".", ".."} for part in raw.split("/"))
        or str(path) != raw
    ):
        fail(f"unsafe repository path: {raw}")
    return path


def _workspace_root(workspace: Path) -> Path:
    absolute = workspace.absolute()
    metadata = absolute.lstat()
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        fail("workspace root must be a real directory")
    if absolute.resolve() != absolute:
        fail("workspace root path cannot contain a symbolic link")
    return absolute


def absolute_project_path(
    workspace: Path, raw: Any, *, must_exist: bool = False, regular_file: bool = False
) -> Path:
    root = _workspace_root(workspace)
    relative = project_path(raw)
    cursor = root
    parts = relative.parts
    for index, part in enumerate(parts):
        cursor = cursor / part
        try:
            metadata = cursor.lstat()
        except FileNotFoundError:
            if must_exist or index < len(parts) - 1 and cursor.parent.exists():
                if must_exist:
                    fail(f"path is missing: {raw}")
            break
        if stat.S_ISLNK(metadata.st_mode):
            fail(f"path cannot contain a symbolic link: {raw}")
        if index < len(parts) - 1 and not stat.S_ISDIR(metadata.st_mode):
            fail(f"path ancestor is not a directory: {raw}")
        if index == len(parts) - 1 and regular_file and not stat.S_ISREG(metadata.st_mode):
            fail(f"path must be a regular file: {raw}")
    if must_exist and not cursor.exists():
        fail(f"path is missing: {raw}")
    return root.joinpath(*relative.parts)


def _run_repository_bridge(packet: dict[str, Any], contract_root: Path) -> Any:
    root = _workspace_root(contract_root)
    contract = root / "packages/contracts/src/skill-icon-production.ts"
    if not contract.is_file():
        fail(f"contract validator is missing from workspace: {contract}")
    node = shutil.which("node")
    if node is None:
        nvm_nodes = sorted(
            Path.home().glob(".nvm/versions/node/v24.*/bin/node"), reverse=True
        )
        node = str(nvm_nodes[0]) if nvm_nodes else None
    tsx_cli = root / "node_modules/tsx/dist/cli.mjs"
    if node is not None and tsx_cli.is_file():
        command = [node, str(tsx_cli), "-e", _CONTRACT_PROGRAM]
    else:
        pnpm = shutil.which("pnpm")
        if pnpm is None:
            fail("contract validation requires node_modules/.bin/tsx or pnpm")
        command = [pnpm, "exec", "tsx", "-e", _CONTRACT_PROGRAM]
    completed = subprocess.run(
        command,
        cwd=root,
        input=json.dumps(packet, ensure_ascii=False),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "unknown schema error"
        fail(f"contract validation failed: {detail}")
    output = completed.stdout.strip()
    return json.loads(output) if output else None


def run_contract_validation(
    kind: str,
    target: dict[str, Any],
    assignment: dict[str, Any],
    *,
    contract_root: Path,
    catalog: dict[str, Any] | None = None,
    result: dict[str, Any] | None = None,
) -> None:
    packet: dict[str, Any] = {
        "kind": kind,
        "target": target,
        "assignment": assignment,
    }
    if catalog is not None:
        packet["catalog"] = catalog
    if result is not None:
        packet["result"] = result
    if kind == "execution":
        protocol = (
            target.get("schemaVersion"),
            assignment.get("schemaVersion"),
            assignment.get("skillVersion"),
        )
        packet["executionSchemaVersion"] = PROTOCOLS.get(protocol)
    _run_repository_bridge(packet, contract_root)


def run_asset_inspection(
    candidate_bytes: bytes,
    role: str,
    geometry: dict[str, Any],
    *,
    contract_root: Path,
) -> dict[str, Any]:
    result = _run_repository_bridge(
        {
            "kind": "inspection",
            "candidateBase64": base64.b64encode(candidate_bytes).decode("ascii"),
            "role": role,
            "geometry": geometry,
        },
        contract_root,
    )
    if not isinstance(result, dict):
        fail("repository asset inspector returned an invalid report")
    return result


def _scope_for_role(role: Any) -> str:
    if role == "skill-art":
        return "icons"
    if role == "calibration-plate":
        return "calibration"
    return "references"


def _validate_input_path(
    workspace: Path,
    path: Path | None,
    expected_relative: str,
    label: str,
    expected_value: dict[str, Any],
) -> tuple[Path, StableFileSnapshot] | None:
    if path is None:
        return None
    root = _workspace_root(workspace)
    absolute = path if path.is_absolute() else root / path
    absolute = absolute.absolute()
    try:
        relative = absolute.relative_to(root).as_posix()
    except ValueError:
        fail(f"{label} input file is outside workspace")
    absolute_project_path(root, relative, must_exist=True, regular_file=True)
    if relative != expected_relative:
        fail(f"{label} input path does not match the assignment binding")
    retained, snapshot = load_json_snapshot(absolute)
    if retained != expected_value:
        fail(f"{label} input bytes do not contain the packet being validated")
    return absolute, snapshot


def _required_reference(
    references: list[dict[str, Any]],
    expected_path: str,
    expected_purpose: str,
    label: str,
) -> dict[str, Any]:
    matches = [reference for reference in references if reference.get("path") == expected_path]
    if len(matches) != 1:
        fail(f"individual skill art requires distinct {label}: {expected_path}")
    if matches[0].get("purpose") != expected_purpose:
        fail(
            f"{label} reference must use the exact canonical purpose: "
            f"{expected_purpose!r}"
        )
    return matches[0]


def _require_individual_authorities(
    target: dict[str, Any], catalog: dict[str, Any]
) -> None:
    if target.get("role") != "skill-art":
        return
    references = target["references"]
    records = [
        record
        for record in catalog["records"]
        if record.get("targetId") == target.get("skillTargetId")
    ]
    if len(records) != 1:
        fail("skill-art target must resolve to exactly one canonical catalog record")
    record = records[0]
    _required_reference(
        references,
        STYLE_AUTHORITY_PATH,
        STYLE_AUTHORITY_PURPOSE,
        "global Painted Emblem style authority",
    )
    _required_reference(
        references,
        GEOMETRY_GUIDE_PATH,
        GEOMETRY_GUIDE_PURPOSE,
        "geometry guide",
    )
    motif_family = record.get("motifFamily")
    if motif_family is not None:
        calibration_path = (
            "assets/wiki/skills/icon-production-v1/masters/calibration/"
            f"{str(motif_family).replace('.', '-')}.png"
        )
        _required_reference(
            references,
            calibration_path,
            CALIBRATION_PURPOSE,
            "approved motif-family calibration plate",
        )
    parent_id = record.get("primaryVisualParent")
    if parent_id is not None:
        parent_records = [
            candidate
            for candidate in catalog["records"]
            if candidate.get("targetId") == parent_id
        ]
        if len(parent_records) != 1 or parent_records[0].get("status") != "approved":
            fail("primary visual parent must be approved in the canonical catalog")
        expected_parent_path = (
            "assets/wiki/skills/icon-production-v1/masters/icons/"
            f"{str(parent_id).replace(':', '-')}.png"
        )
        parent_assets = parent_records[0].get("assets")
        approved_master = (
            parent_assets.get("approvedMaster") if isinstance(parent_assets, dict) else None
        )
        if (
            not isinstance(approved_master, dict)
            or approved_master.get("path") != expected_parent_path
        ):
            fail("canonical parent record does not bind its approved primary-parent master")
        parent_reference = _required_reference(
            references,
            expected_parent_path,
            PRIMARY_PARENT_PURPOSE,
            "approved primary-parent master",
        )
        if parent_reference.get("contentHash") != approved_master.get("contentHash"):
            fail("primary-parent reference hash does not match the canonical approved master")


def _require_geometry_v2_guide_authority(target: dict[str, Any]) -> None:
    normalization = target.get("normalization")
    if (
        not isinstance(normalization, dict)
        or normalization.get("profile") not in {PROFILE_V3, PROFILE_V4}
    ):
        return
    matches = [
        reference
        for reference in target["references"]
        if reference.get("path") == GEOMETRY_GUIDE_V2_PATH
    ]
    if len(matches) != 1:
        fail("geometry-v2 profile target requires exactly one canonical geometry-v2 guide")
    guide = matches[0]
    if guide.get("purpose") != GEOMETRY_GUIDE_V2_PURPOSE:
        fail("geometry-v2 profile guide must use its exact canonical purpose")
    if guide.get("contentHash") != GEOMETRY_GUIDE_V2_HASH:
        fail("geometry-v2 profile guide hash does not match its canonical authority")


def validate(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
    allow_existing_outputs: bool = False,
    contract_root: Path | None = None,
    _authority_snapshots: list[AuthoritySnapshot] | None = None,
) -> dict[str, Any]:
    reject_reprocess_packet_schemas(target, assignment)
    root = _workspace_root(workspace)
    catalog_absolute = absolute_project_path(
        root, CATALOG_PATH, must_exist=True, regular_file=True
    )
    catalog, catalog_snapshot = load_json_snapshot(catalog_absolute)
    run_contract_validation(
        "inputs",
        target,
        assignment,
        catalog=catalog,
        contract_root=contract_root or root,
    )
    protocol = (
        target.get("schemaVersion"),
        assignment.get("schemaVersion"),
        assignment.get("skillVersion"),
    )
    execution_version = PROTOCOLS.get(protocol)
    normalization_geometry_snapshot: tuple[Path, StableFileSnapshot] | None = None
    if execution_version is None:
        fail("target, assignment, and skill versions do not form an accepted protocol tuple")
    if execution_version == "skill-icon-execution-v2":
        target_normalization = target.get("normalization")
        assignment_normalization = assignment.get("normalization")
        profile = (
            target_normalization.get("profile")
            if isinstance(target_normalization, dict)
            else None
        )
        if (
            not isinstance(target_normalization, dict)
            or not isinstance(assignment_normalization, dict)
            or profile not in NORMALIZATION_SKILL_VERSIONS
            or assignment_normalization.get("profile") != profile
        ):
            fail("v2 target and assignment must bind the same supported normalization profile")
        if assignment.get("skillVersion") != NORMALIZATION_SKILL_VERSIONS[profile]:
            fail("normalization profile and producer skill version do not match")
        geometry_path, geometry_hash = NORMALIZATION_GEOMETRY_AUTHORITIES[profile]
        geometry = target_normalization.get("geometry")
        if (
            not isinstance(geometry, dict)
            or geometry.get("path") != geometry_path
            or geometry.get("contentHash") != geometry_hash
        ):
            fail(
                "v2 target must bind the exact raw geometry authority for its "
                "normalization profile"
            )
        geometry_file = absolute_project_path(
            root, geometry_path, must_exist=True, regular_file=True
        )
        geometry_snapshot = read_stable_regular_file_snapshot(geometry_file)
        if geometry_snapshot.content_hash != geometry_hash:
            fail("v2 target geometry hash does not match the raw geometry authority bytes")
        normalization_geometry_snapshot = (geometry_file, geometry_snapshot)

    job_id = target["jobId"]
    role = target["role"]
    scope = _scope_for_role(role)
    expected_target_path = (
        f"assets/wiki/skills/icon-production-v1/targets/{scope}/{job_id}.json"
    )
    expected_assignment_path = (
        f"assets/wiki/skills/icon-production-v1/assignments/{scope}/{job_id}.json"
    )
    if target.get("jobId") != assignment.get("jobId"):
        fail("target and assignment job identity mismatch")
    if assignment.get("targetPath") != expected_target_path:
        fail("assignment targetPath does not match the target identity")
    if assignment.get("assignmentPath") != expected_assignment_path:
        fail("assignment assignmentPath does not match the target identity")
    target_snapshot = _validate_input_path(
        root, target_path, expected_target_path, "target", target
    )
    assignment_snapshot = _validate_input_path(
        root, assignment_path, expected_assignment_path, "assignment", assignment
    )

    output = target["output"]
    if assignment.get("permittedOutputs") != output:
        fail("assignment permittedOutputs must exactly match target output")
    for raw in output.values():
        absolute = absolute_project_path(root, raw)
        if not allow_existing_outputs and os.path.lexists(absolute):
            fail(f"pre-existing output collision: {raw}")

    references = target["references"]
    reference_snapshots: list[AuthoritySnapshot] = []
    for reference in references:
        raw = reference["path"]
        expected_hash = reference["contentHash"]
        if not SHA256_PATTERN.fullmatch(expected_hash):
            fail(f"reference hash is invalid: {raw}")
        absolute = absolute_project_path(root, raw, must_exist=True, regular_file=True)
        snapshot = read_stable_regular_file_snapshot(absolute)
        if snapshot.content_hash != expected_hash:
            fail(f"reference hash changed: {raw}")
        reference_snapshots.append((absolute, snapshot, raw))
    _require_individual_authorities(target, catalog)
    _require_geometry_v2_guide_authority(target)

    for absolute, snapshot, raw in reference_snapshots:
        reassert_stable_regular_file(absolute, snapshot, label=f"reference {raw}")
    reassert_stable_regular_file(
        catalog_absolute, catalog_snapshot, label="canonical catalog"
    )
    if normalization_geometry_snapshot is not None:
        reassert_stable_regular_file(
            normalization_geometry_snapshot[0],
            normalization_geometry_snapshot[1],
            label="v2 normalization geometry authority",
        )
    if target_snapshot is not None:
        reassert_stable_regular_file(
            target_snapshot[0], target_snapshot[1], label="target"
        )
    if assignment_snapshot is not None:
        reassert_stable_regular_file(
            assignment_snapshot[0], assignment_snapshot[1], label="assignment"
        )
    if _authority_snapshots is not None:
        _authority_snapshots.append(
            (catalog_absolute, catalog_snapshot, "canonical catalog")
        )
        if normalization_geometry_snapshot is not None:
            _authority_snapshots.append(
                (
                    normalization_geometry_snapshot[0],
                    normalization_geometry_snapshot[1],
                    "v2 normalization geometry authority",
                )
            )
        _authority_snapshots.extend(
            (absolute, snapshot, f"reference {raw}")
            for absolute, snapshot, raw in reference_snapshots
        )
        if target_snapshot is not None:
            _authority_snapshots.append(
                (target_snapshot[0], target_snapshot[1], "target")
            )
        if assignment_snapshot is not None:
            _authority_snapshots.append(
                (assignment_snapshot[0], assignment_snapshot[1], "assignment")
            )

    return {
        "jobId": job_id,
        "assignmentId": assignment["assignmentId"],
        "role": role,
        "candidatePath": output["candidatePath"],
        "resultPath": output["resultPath"],
        "references": len(references),
        "retryCeiling": assignment["retryCeiling"],
        "status": "valid",
        "executionSchemaVersion": execution_version,
    }


def _path_argument(workspace: Path, raw: str, label: str) -> Path:
    root = _workspace_root(workspace)
    candidate = Path(raw)
    absolute = candidate.absolute() if candidate.is_absolute() else (root / candidate).absolute()
    try:
        relative = absolute.relative_to(root).as_posix()
    except ValueError:
        fail(f"{label} input file is outside workspace")
    return absolute_project_path(root, relative, must_exist=True, regular_file=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate one SkillIconTarget and matching SkillIconAssignment."
    )
    parser.add_argument("target", help="target JSON path (absolute or workspace-relative)")
    parser.add_argument("assignment", help="assignment JSON path (absolute or workspace-relative)")
    parser.add_argument("workspace_root", help="Summonlab repository root")
    parser.add_argument(
        "--allow-existing-outputs",
        action="store_true",
        help="allow owned outputs to exist (for post-persistence verification only)",
    )
    args = parser.parse_args()
    try:
        workspace = _workspace_root(Path(args.workspace_root))
        target_path = _path_argument(workspace, args.target, "target")
        assignment_path = _path_argument(workspace, args.assignment, "assignment")
        report = validate(
            load_json(target_path),
            load_json(assignment_path),
            workspace,
            target_path=target_path,
            assignment_path=assignment_path,
            allow_existing_outputs=args.allow_existing_outputs,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"target validation failed: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
