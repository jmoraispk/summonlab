#!/usr/bin/env python3
"""Validate the one-star mass-wave candidate bundle without image dependencies."""

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


assert MANIFEST["schemaVersion"] == "hero-one-star-mass-wave-v1"
assert MANIFEST["status"] == "candidate-review-only"
assert len(MANIFEST["targets"]) == 16
assert sum(target["cohort"] == "returning-progression-favorite" for target in MANIFEST["targets"]) == 4

review = (ROOT / MANIFEST["reviewPage"]).read_text()
provenance = json.loads((ROOT / MANIFEST["provenance"]).read_text())
assert provenance["summonPrompt"] and provenance["combatChibiPrompt"]

for target in MANIFEST["targets"]:
    for field, hash_field in (("summon", "summonSha256"), ("chibi", "chibiSha256")):
        path = ROOT / target[field]
        payload = path.read_bytes()
        actual_hash = hashlib.sha256(payload).hexdigest()
        assert actual_hash == target[hash_field], f"Hash mismatch: {path}"
        width, height, color_type = inspect_png(path)
        assert min(width, height) >= 1000, f"Unexpectedly small candidate: {path}"
        if field == "chibi":
            assert color_type == 2, f"Known checker-background candidate changed format: {path}"
    assert f'"{target["id"]}"' in review, f"Review omits {target['id']}"

assert '../summon/${id}.png' in review
assert '../combat-chibi/${id}.png' in review

for control in ("keep", "pass", "undecided", "download", "reset", "pair", "summon", "chibi"):
    assert control in review, f"Review control missing: {control}"

print("one-star-mass-wave-001 validated: 16 paired candidates, hashes intact, candidate/runtime boundary explicit")
