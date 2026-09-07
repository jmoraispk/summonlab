#!/usr/bin/env python3
"""Validate one temporary frameless skill-art target and assignment."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

CATALOG_PATH = "assets/wiki/skills/icon-production-v2/catalog.json"
GEOMETRY_GUIDE_PATH = "assets/wiki/skills/icon-production-v2/geometry-guide.png"
GEOMETRY_PURPOSE = "Safe-zone geometry only."
FAMILY_PURPOSE = "Temporary accepted lineage context only; excludes target; never crop."
PARENT_PURPOSE = "Immediate visual parent interior only."
PROMPT_CLAUSE = (
    "Artwork layer only: transparent background; no rarity frame, rank crest, "
    "rank letter, border rails, backing, UI, label, logo, watermark, or text."
)
JOB_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-v[1-9][0-9]*$")
HASH_PATTERN = re.compile(r"^[a-f0-9]{64}$")
FORBIDDEN_PROMPT = re.compile(
    r"\b(?:rarity|rank|frame|border|rail|crest|badge|medallion|backing|ui|label|"
    r"logo|watermark|text|letter|scenery)\b",
    re.IGNORECASE,
)


def load_json(path: Path) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"expected regular JSON file: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def relative_file(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("invalid repository-relative path")
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError(f"path escapes workspace: {value}") from error
    return candidate


def digest(path: Path) -> str:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"expected regular reference: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def expected_job_path(job_id: str, filename: str) -> str:
    return f".skill-icon-work/{job_id}/{filename}"


def validate(
    target_path: Path,
    assignment_path: Path,
    workspace_root: Path,
    *,
    require_outputs_absent: bool = True,
) -> tuple[dict[str, Any], dict[str, Any]]:
    root = workspace_root.resolve()
    target = load_json(target_path)
    assignment = load_json(assignment_path)
    if set(target) != {
        "schemaVersion", "jobId", "targetId", "name", "rarity", "exactPrompt",
        "references", "outputPath"
    } or target.get("schemaVersion") != "summonlab-skill-art-target-v1":
        raise ValueError("invalid frameless skill-art target")
    job_id = target.get("jobId")
    if not isinstance(job_id, str) or not JOB_PATTERN.fullmatch(job_id):
        raise ValueError("invalid jobId")
    target_id = target.get("targetId")
    catalog = load_json(relative_file(root, CATALOG_PATH))
    catalog_records = catalog.get("records", [])
    record = next((item for item in catalog_records if item.get("targetId") == target_id), None)
    if record is None:
        raise ValueError("target is missing from the unified catalog")
    if target.get("name") != record.get("name") or target.get("rarity") != record.get("rarity"):
        raise ValueError("target identity does not match the unified catalog")

    prompt = target.get("exactPrompt")
    if not isinstance(prompt, str) or prompt.count(PROMPT_CLAUSE) != 1:
        raise ValueError("exact prompt must contain the frameless artwork clause exactly once")
    if FORBIDDEN_PROMPT.search(prompt.replace(PROMPT_CLAUSE, "")):
        raise ValueError("exact prompt requests forbidden framing or presentation content")

    lineage_key = record.get("motifFamily")
    accepted_family_members = [] if not lineage_key else [
        item for item in catalog_records
        if item.get("targetId") != target_id
        and item.get("motifFamily") == lineage_key
        and isinstance(item.get("targetId"), str)
        and relative_file(
            root,
            f"assets/wiki/skills/icon-production-v2/interiors/{item['targetId'].replace(':', '-')}.png",
        ).is_file()
    ]
    family_path = expected_job_path(job_id, "family-reference.png")
    parent = record.get("primaryVisualParent")
    expected_references = [{"path": GEOMETRY_GUIDE_PATH, "purpose": GEOMETRY_PURPOSE}]
    if accepted_family_members:
        expected_references.append({"path": family_path, "purpose": FAMILY_PURPOSE})
    if parent:
        expected_references.append({
            "path": f"assets/wiki/skills/icon-production-v2/interiors/{parent.replace(':', '-')}.png",
            "purpose": PARENT_PURPOSE,
        })

    references = target.get("references")
    if not isinstance(references, list) or len(references) < 1:
        raise ValueError("target requires at least the geometry reference")
    reference_paths: list[str] = []
    for index, reference in enumerate(references):
        if not isinstance(reference, dict) or set(reference) != {"path", "purpose", "contentHash"}:
            raise ValueError("invalid reference binding")
        value = reference.get("path")
        expected_hash = reference.get("contentHash")
        if not isinstance(value, str) or not isinstance(reference.get("purpose"), str):
            raise ValueError("invalid reference binding")
        if not isinstance(expected_hash, str) or not HASH_PATTERN.fullmatch(expected_hash):
            raise ValueError("invalid reference hash")
        if "/frames/" in value or value.endswith("/backing.png"):
            raise ValueError("frames and backing are forbidden generation references")
        if digest(relative_file(root, value)) != expected_hash:
            raise ValueError(f"reference hash drift: {value}")
        if index >= len(expected_references) or {
            "path": value,
            "purpose": reference["purpose"],
        } != expected_references[index]:
            raise ValueError("reference paths, purposes, and order do not match the target contract")
        reference_paths.append(value)
    if len(references) != len(expected_references) or len(set(reference_paths)) != len(reference_paths):
        raise ValueError("reference paths, purposes, and order do not match the target contract")

    if set(assignment) != {
        "schemaVersion", "jobId", "targetId", "targetPath", "assignmentPath",
        "candidatePath", "resultPath", "retryCeiling", "selfPromotionForbidden"
    } or assignment.get("schemaVersion") != "summonlab-skill-art-assignment-v1":
        raise ValueError("invalid frameless skill-art assignment")
    if assignment.get("jobId") != job_id or assignment.get("targetId") != target_id:
        raise ValueError("target and assignment identity mismatch")
    expected = {
        "targetPath": expected_job_path(job_id, "target.json"),
        "assignmentPath": expected_job_path(job_id, "assignment.json"),
        "candidatePath": expected_job_path(job_id, "candidate.png"),
        "resultPath": expected_job_path(job_id, "result.json"),
    }
    if any(assignment.get(key) != value for key, value in expected.items()):
        raise ValueError("assignment paths must use the matching temporary job directory")
    if target.get("outputPath") != expected["candidatePath"]:
        raise ValueError("target output path does not match assignment")
    if assignment.get("retryCeiling") not in (0, 1) or assignment.get("selfPromotionForbidden") is not True:
        raise ValueError("invalid assignment limits")
    if target_path.resolve() != relative_file(root, expected["targetPath"]):
        raise ValueError("target argument path does not match packet")
    if assignment_path.resolve() != relative_file(root, expected["assignmentPath"]):
        raise ValueError("assignment argument path does not match packet")
    if require_outputs_absent:
        for key in ("candidatePath", "resultPath"):
            if relative_file(root, expected[key]).exists():
                raise ValueError(f"assigned output already exists: {expected[key]}")
    return target, assignment


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("assignment", type=Path)
    parser.add_argument("workspace_root", type=Path)
    args = parser.parse_args()
    target, _ = validate(args.target, args.assignment, args.workspace_root)
    print(json.dumps({"valid": True, "jobId": target["jobId"], "targetId": target["targetId"]}))


if __name__ == "__main__":
    main()
