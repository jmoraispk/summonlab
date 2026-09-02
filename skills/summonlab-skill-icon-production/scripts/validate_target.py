#!/usr/bin/env python3
"""Validate one skill-icon target and assignment before any generation call."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

SKILL_VERSION = "summonlab-skill-icon-production-v1"
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")

_CONTRACT_PROGRAM = r"""
import fs from 'node:fs';
import {
  SkillIconAssignmentSchema,
  SkillIconExecutionSchema,
  SkillIconTargetSchema
} from './packages/contracts/src/index.ts';
const packet = JSON.parse(fs.readFileSync(0, 'utf8'));
try {
  if (packet.kind === 'inputs') {
    SkillIconTargetSchema.parse(packet.target);
    SkillIconAssignmentSchema.parse(packet.assignment);
  } else if (packet.kind === 'execution') {
    SkillIconExecutionSchema.parse({
      schemaVersion: 'skill-icon-execution-v1',
      target: packet.target,
      assignment: packet.assignment,
      result: packet.result
    });
  } else {
    throw new Error('unknown contract packet kind');
  }
} catch (error) {
  const detail = error && typeof error === 'object' && 'issues' in error
    ? error.issues
    : String(error);
  process.stderr.write(JSON.stringify(detail));
  process.exit(2);
}
"""


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        fail(f"{path} must contain a JSON object")
    return value


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


def run_contract_validation(
    kind: str,
    target: dict[str, Any],
    assignment: dict[str, Any],
    *,
    contract_root: Path,
    result: dict[str, Any] | None = None,
) -> None:
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
    packet: dict[str, Any] = {
        "kind": kind,
        "target": target,
        "assignment": assignment,
    }
    if result is not None:
        packet["result"] = result
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


def _scope_for_role(role: Any) -> str:
    if role == "skill-art":
        return "icons"
    if role == "calibration-plate":
        return "calibration"
    return "references"


def _validate_input_path(
    workspace: Path, path: Path | None, expected_relative: str, label: str
) -> None:
    if path is None:
        return
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


def _require_individual_authorities(target: dict[str, Any]) -> None:
    if target.get("role") != "skill-art":
        return
    references = target.get("references", [])
    descriptions = [
        f"{reference.get('path', '')} {reference.get('purpose', '')}".lower()
        for reference in references
        if isinstance(reference, dict)
    ]
    if not any("painted emblem" in description for description in descriptions):
        fail("individual skill art requires the global Painted Emblem authority")
    if not any("geometry" in description and "guide" in description for description in descriptions):
        fail("individual skill art requires the geometry guide")
    # Family calibration and an approved immediate-parent master are conditional inputs. If the
    # coordinator declares either purpose, require an image bound to that exact declaration.
    for marker, label in (
        ("family calibration", "family calibration plate"),
        ("primary parent", "approved primary-parent master"),
    ):
        applicable = [description for description in descriptions if marker in description]
        if applicable and not any(
            marker in description and ("calibration" in description or "master" in description)
            for description in applicable
        ):
            fail(f"individual skill art requires the {label} when applicable")


def validate(
    target: dict[str, Any],
    assignment: dict[str, Any],
    workspace: Path,
    *,
    target_path: Path | None = None,
    assignment_path: Path | None = None,
    allow_existing_outputs: bool = False,
    contract_root: Path | None = None,
) -> dict[str, Any]:
    root = _workspace_root(workspace)
    run_contract_validation(
        "inputs", target, assignment, contract_root=contract_root or root
    )
    if assignment.get("skillVersion") != SKILL_VERSION:
        fail(f"assignment skillVersion must be {SKILL_VERSION}")

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
    _validate_input_path(root, target_path, expected_target_path, "target")
    _validate_input_path(root, assignment_path, expected_assignment_path, "assignment")

    output = target["output"]
    if assignment.get("permittedOutputs") != output:
        fail("assignment permittedOutputs must exactly match target output")
    for raw in output.values():
        absolute = absolute_project_path(root, raw)
        if not allow_existing_outputs and os.path.lexists(absolute):
            fail(f"pre-existing output collision: {raw}")

    references = target["references"]
    for reference in references:
        raw = reference["path"]
        expected_hash = reference["contentHash"]
        if not SHA256_PATTERN.fullmatch(expected_hash):
            fail(f"reference hash is invalid: {raw}")
        absolute = absolute_project_path(root, raw, must_exist=True, regular_file=True)
        actual_hash = hashlib.sha256(absolute.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            fail(f"reference hash changed: {raw}")
    _require_individual_authorities(target)

    return {
        "jobId": job_id,
        "assignmentId": assignment["assignmentId"],
        "role": role,
        "candidatePath": output["candidatePath"],
        "resultPath": output["resultPath"],
        "references": len(references),
        "retryCeiling": assignment["retryCeiling"],
        "status": "valid",
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
