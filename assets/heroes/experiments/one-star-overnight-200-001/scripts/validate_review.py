#!/usr/bin/env python3
"""Validate review pages, derivative hashes, source hashes, and current pair selection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

from build_review import (
    CANVAS,
    EXPERIMENT_ID,
    REVIEW_MANIFEST,
    discover_review_state,
)
from contracts import ContractError, anchored_read, sha256_bytes


def validate_review(workspace: Path, *, allow_absent: bool = False) -> dict[str, int | bool]:
    workspace = workspace.resolve(strict=True)
    manifest_absolute = workspace / REVIEW_MANIFEST
    if not manifest_absolute.exists():
        if allow_absent:
            return {"present": False, "completePairs": 0, "derivatives": 0, "pages": 0}
        raise ContractError("review-manifest.json is absent; run build_review.py first")
    manifest_payload = anchored_read(workspace, REVIEW_MANIFEST)
    try:
        manifest = json.loads(manifest_payload)
    except json.JSONDecodeError as error:
        raise ContractError(f"cannot parse review manifest: {error}") from error
    if manifest.get("schemaVersion") != "hero-one-star-review-manifest-v1" or manifest.get("experimentId") != EXPERIMENT_ID:
        raise ContractError("review manifest identity is invalid")
    if manifest.get("candidateBoundary") != "candidate-only; review derivatives do not imply approval or runtime promotion":
        raise ContractError("review manifest lost its candidate-only boundary")

    derivative_paths: set[str] = set()
    for entry in manifest.get("derivatives", []):
        if not isinstance(entry, dict) or entry.get("path") in derivative_paths:
            raise ContractError("review manifest contains invalid or duplicate derivative records")
        derivative_paths.add(entry["path"])
        payload = anchored_read(workspace, entry["path"])
        if len(payload) != entry["bytes"] or sha256_bytes(payload) != entry["sha256"]:
            raise ContractError(f"review derivative drifted: {entry['path']}")
        source = anchored_read(workspace, entry["sourcePath"], prefix="assets")
        if sha256_bytes(source) != entry["sourceSha256"]:
            raise ContractError(f"review source drifted: {entry['sourcePath']}")
        with Image.open(workspace / entry["path"]) as image:
            if image.format != "WEBP" or image.size != CANVAS:
                raise ContractError(f"review derivative has wrong format or canvas: {entry['path']}")

    page_paths: set[str] = set()
    for entry in manifest.get("pages", []):
        if not isinstance(entry, dict) or entry.get("path") in page_paths:
            raise ContractError("review manifest contains invalid or duplicate page records")
        page_paths.add(entry["path"])
        payload = anchored_read(workspace, entry["path"])
        if len(payload) != entry["bytes"] or sha256_bytes(payload) != entry["sha256"]:
            raise ContractError(f"review page drifted: {entry['path']}")
    required = {
        "assets/heroes/experiments/one-star-overnight-200-001/review/index.html",
        "assets/heroes/experiments/one-star-overnight-200-001/review/quarantine.html",
        "assets/heroes/experiments/one-star-overnight-200-001/review/reference-shelf.html",
    }
    if not required.issubset(page_paths):
        raise ContractError("review manifest is missing required pages")

    roster, activations, artifacts_by_hero, pairs, quarantine = discover_review_state(workspace)
    started = sum(bool(artifacts_by_hero.get(entry["heroId"])) for entry in roster)
    expected = [
        (pair.roster["heroId"], pair.summon.target["targetId"], pair.chibi.target["targetId"])
        for pair in pairs
    ]
    recorded = [
        (entry["heroId"], entry["summonTargetId"], entry["chibiTargetId"])
        for entry in manifest.get("selectedPairs", [])
    ]
    if recorded != expected:
        raise ContractError("review selected-pair state is stale or ambiguous")
    if manifest.get("reserveActivations") != activations:
        raise ContractError("review reserve-activation state is stale")
    counts = manifest.get("counts", {})
    expected_counts = {
        "effectiveRoster": len(roster),
        "startedHeroes": started,
        "pendingHeroes": len(roster) - started,
        "completePairs": len(pairs),
        "quarantineRecords": len(quarantine),
        "derivatives": len(derivative_paths),
        "pages": len(page_paths),
    }
    for key, value in expected_counts.items():
        if counts.get(key) != value:
            raise ContractError(f"review count mismatch for {key}")
    return {"present": True, "completePairs": len(pairs), "derivatives": len(derivative_paths), "pages": len(page_paths)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--allow-absent", action="store_true")
    args = parser.parse_args()
    print(json.dumps(validate_review(args.workspace, allow_absent=args.allow_absent), indent=2))


if __name__ == "__main__":
    main()
