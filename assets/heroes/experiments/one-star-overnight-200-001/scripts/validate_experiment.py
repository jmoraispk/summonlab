#!/usr/bin/env python3
"""Final completion gate for 200 candidate-only one-star hero pairs."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from contracts import ContractError
from validate_wave import validate_wave


EXPECTED_BODY_PER_GENDER = {
    "healthy-slight-lanky": 10,
    "ordinary-average": 10,
    "soft-round": 15,
    "sturdy-stocky": 15,
    "plus-size-heavy": 10,
    "athletic-conditioned": 20,
    "clearly-muscular": 17,
    "extreme-bodybuilder": 3,
}
EXPECTED_HEIGHT_PER_GENDER = {
    "very-short": 5,
    "short": 15,
    "medium": 55,
    "tall": 20,
    "very-tall": 5,
}
EXPECTED_AGE_PER_GENDER = {"18-22": 15, "23-29": 35, "30-36": 30, "37-42": 20}
EXPECTED_HAIR_COLOR = {
    "black": 36, "dark-brown": 30, "brown-chestnut": 24, "blonde-gold": 24,
    "red-copper-auburn": 20, "gray-white-silver": 14, "blue-teal": 18,
    "violet-plum-pink": 16, "multicolor-split-streak": 18,
}
EXPECTED_HAIR_SILHOUETTE = {
    "shaved-close-cropped": 24, "short-textured-crop": 28, "bob-pageboy": 16,
    "medium-loose": 18, "long-loose": 18, "braids-twists-locs": 30,
    "curls-coils-halo": 22, "bun-topknot-wrapped": 20, "asymmetric-extreme": 24,
}
EXPECTED_SKIN = {1: 24, 2: 30, 3: 34, 4: 38, 5: 38, 6: 36}
EXPECTED_WARDROBE = {
    "layered-wrap": 20, "short-jacket-trousers": 20, "tailored-longcoat": 20,
    "tunic-tabard": 20, "apron-workwear-layers": 20, "quilted-outerwear": 20,
    "draped-robe": 20, "mantle-short-cape": 20, "fitted-vest-system": 20,
    "asymmetric-patchwork": 20,
}
EXPECTED_PALETTE = {
    "ochre-cream": 20, "rust-charcoal": 20, "teal-brown": 20, "indigo-sand": 20,
    "plum-gray": 20, "moss-ivory": 20, "marigold-green": 20, "oxblood-navy": 20,
    "lilac-smoke": 20, "terracotta-black": 20,
}
EXPECTED_DENSITY = {0: 50, 1: 70, 2: 55, 3: 25}
EXPECTED_TATTOO = {"none": 150, "bounded": 40, "extensive": 10}
EXPECTED_COOLNESS = {
    "hairstyle-construction": 25, "garment-silhouette": 25, "color-blocking": 25,
    "textile-detail": 25, "body-or-posture": 25, "repairs-patina-keepsake": 25,
    "jewelry-hardware": 25, "durable-body-marking": 25,
}


def _normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _age_band(age: int) -> str:
    if age <= 22:
        return "18-22"
    if age <= 29:
        return "23-29"
    if age <= 36:
        return "30-36"
    return "37-42"


def _assert_counts(label: str, observed: Counter[Any], expected: dict[Any, int]) -> None:
    if dict(observed) != expected:
        raise ContractError(f"{label} quota mismatch: expected {expected}, found {dict(observed)}")


def _reviewed_identity_keys(workspace: Path) -> tuple[set[str], set[str], set[str]]:
    ids: set[str] = set()
    names: set[str] = set()
    signatures: set[str] = set()
    for relative in (
        "assets/heroes/experiments/one-star-mass-wave-001/manifest.json",
        "assets/heroes/experiments/one-star-mass-wave-002/manifest.json",
    ):
        manifest_path = workspace / relative
        if not manifest_path.is_file():
            raise ContractError(f"reviewed identity manifest is missing: {relative}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for target in manifest["targets"]:
            ids.add(_normalized(target["id"]))
            names.add(_normalized(target.get("name", target["id"])))
            if target.get("signature"):
                signatures.add(_normalized(target["signature"]))
    return ids, names, signatures


def validate_experiment(workspace: Path) -> dict[str, Any]:
    workspace = workspace.resolve(strict=True)
    waves = [validate_wave(workspace, f"wave-{index:02d}") for index in range(1, 11)]
    heroes = [entry for wave in waves for entry in wave["completed"]]
    if len(heroes) != 200 or len({entry["heroId"] for entry in heroes}) != 200:
        raise ContractError("final experiment requires exactly 200 unique complete pairs")

    specs = [entry["heroSpec"] for entry in heroes]
    _assert_counts("gender", Counter(spec["identity"]["gender"] for spec in specs), {"man": 100, "woman": 100})
    for gender in ("man", "woman"):
        subset = [spec for spec in specs if spec["identity"]["gender"] == gender]
        _assert_counts(f"{gender} body", Counter(spec["physique"]["bodyType"] for spec in subset), EXPECTED_BODY_PER_GENDER)
        _assert_counts(f"{gender} height", Counter(spec["physique"]["heightBand"] for spec in subset), EXPECTED_HEIGHT_PER_GENDER)
        _assert_counts(f"{gender} age", Counter(_age_band(spec["identity"]["age"]) for spec in subset), EXPECTED_AGE_PER_GENDER)
    _assert_counts("hair color", Counter(spec["hair"]["colorFamily"] for spec in specs), EXPECTED_HAIR_COLOR)
    _assert_counts("hair silhouette", Counter(spec["hair"]["silhouetteFamily"] for spec in specs), EXPECTED_HAIR_SILHOUETTE)
    _assert_counts("skin value", Counter(spec["identity"]["skinValueBand"] for spec in specs), EXPECTED_SKIN)
    _assert_counts("wardrobe", Counter(spec["wardrobe"]["family"] for spec in specs), EXPECTED_WARDROBE)
    _assert_counts("palette", Counter(spec["wardrobe"]["paletteFamily"] for spec in specs), EXPECTED_PALETTE)
    _assert_counts("detail density", Counter(spec["details"]["density"] for spec in specs), EXPECTED_DENSITY)
    _assert_counts("tattoo scope", Counter(spec["details"]["tattooScope"] for spec in specs), EXPECTED_TATTOO)
    _assert_counts("coolness anchor", Counter(spec["details"]["coolnessAnchor"] for spec in specs), EXPECTED_COOLNESS)
    if sum(spec["hair"]["accent"] is not None for spec in specs) < 100:
        raise ContractError("at least 100 completed heroes require a deliberate haircut accent")

    ids, names, signatures = _reviewed_identity_keys(workspace)
    new_ids: set[str] = set()
    new_names: set[str] = set()
    new_signatures: set[str] = set()
    for hero in heroes:
        spec = hero["heroSpec"]
        hero_id = _normalized(hero["heroId"])
        name = _normalized(spec["identity"]["displayName"])
        signature = _normalized(spec["identity"]["identitySignature"])
        if hero_id in ids or name in names or signature in signatures:
            raise ContractError(f"reviewed identity was reused: {hero['heroId']}")
        if hero_id in new_ids or name in new_names or signature in new_signatures:
            raise ContractError(f"duplicate new identity signature: {hero['heroId']}")
        new_ids.add(hero_id)
        new_names.add(name)
        new_signatures.add(signature)

    generation_calls = 0
    correction_targets = 0
    for wave in waves:
        for execution in wave["executions"]:
            generation_calls += len(execution["result"]["attempts"])
            if execution["target"]["targetVersion"] > 1:
                correction_targets += 1
    if generation_calls > 460 or correction_targets > 60:
        raise ContractError(
            f"production budget exceeded: {generation_calls} calls, {correction_targets} correction targets"
        )
    return {
        "schemaVersion": "hero-one-star-experiment-validation-v1",
        "experimentId": "one-star-overnight-200-001",
        "completePairCount": 200,
        "men": 100,
        "women": 100,
        "generationCallCount": generation_calls,
        "correctionTargetCount": correction_targets,
        "candidateOnly": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    print(json.dumps(validate_experiment(args.workspace), indent=2))


if __name__ == "__main__":
    main()
