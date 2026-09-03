#!/usr/bin/env python3
"""Validate the second one-star candidate wave without third-party image dependencies."""

from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text())


def inspect_png(path: Path) -> tuple[int, int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RuntimeError(f"Not a PNG: {path}")
    width, height, _depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, color_type


assert MANIFEST["schemaVersion"] == "hero-one-star-mass-wave-v2"
assert MANIFEST["status"] == "candidate-review-only"
assert len(MANIFEST["targets"]) == 16
assert sum("survivor" in target["cohort"] for target in MANIFEST["targets"]) == 4
assert sum(target["cohort"] == "new-painted-identity" for target in MANIFEST["targets"]) == 12
assert MANIFEST["batchRules"]["reviewPresentation"] == "pair-only"

review_evidence = json.loads((ROOT / MANIFEST["inputReviewEvidence"]).read_text())
assert review_evidence["experimentId"] == "one-star-mass-wave-001"
assert sum(decision == "keep" for decision in review_evidence["decisions"].values()) == 4

review = (ROOT / MANIFEST["reviewPage"]).read_text()
provenance = json.loads((ROOT / MANIFEST["provenance"]).read_text())
assert provenance["newSummonPrompt"] and provenance["combatChibiPrompt"]
assert len(provenance["subjectBriefs"]) == 12
assert len(provenance["combatBodyLocks"]) == 12
assert "pair-only" in review or "always judge the pair" in review
assert 'class="view"' not in review

for target in MANIFEST["targets"]:
    for field, hash_field in (("summon", "summonSha256"), ("chibi", "chibiSha256")):
        path = ROOT / target[field]
        payload = path.read_bytes()
        actual_hash = hashlib.sha256(payload).hexdigest()
        assert actual_hash == target[hash_field], f"Hash mismatch: {path}"
        width, height, color_type = inspect_png(path)
        assert min(width, height) >= 895, f"Unexpectedly small candidate: {path}"
        assert color_type == 2, f"Expected current RGB candidate format: {path}"
    assert f'"{target["id"]}"' in review, f"Review omits {target['id']}"

assert '../summon/${id}.png' in review
assert '../combat-chibi/${id}.png' in review

for control in ("keep", "pass", "undecided", "download", "reset"):
    assert control in review, f"Review control missing: {control}"

print(
    "one-star-mass-wave-002 validated: 4 carried survivors + 12 new painted pairs; "
    "hashes intact; pair-only and candidate/runtime boundaries explicit"
)
