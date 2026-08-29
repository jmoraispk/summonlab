#!/usr/bin/env python3
"""Render the canonical image-generation prompt for one validated target manifest."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def bullet_block(label: str, values: list[str]) -> list[str]:
    return [f"{label}:", *(f"- {value}" for value in values), ""]


def compact_value(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(compact_value(item) for item in value)
    if isinstance(value, dict):
        return "; ".join(f"{key}={compact_value(item)}" for key, item in value.items())
    return str(value).rstrip(".")


def render(target: dict[str, Any]) -> str:
    threat = target["threat"]
    affinity_design = target["affinityDesign"]
    presentation = target["presentation"]
    canvas = presentation["canvas"]
    canonical_grade = threat.get("canonicalGrade")
    canonical_grade_text = "not assigned" if canonical_grade is None else str(canonical_grade)

    lines = [
        "Use case: stylized-concept.",
        "",
        (
            "Create one premium realistic painterly raster character concept for the "
            f'manifest-bound target "{target["targetId"]}".'
        ),
        "",
        "Subject and threat:",
        f'- Species: {target["speciesId"]}.',
        (
            f'- Threat presentation tier: {threat["presentationTier"]}; '
            f'reference Grade {threat["referenceGrade"]}; canonical Grade {canonical_grade_text}.'
        ),
        f'- Battlefield duty: {target["battlefieldDutyId"]}.',
        f'- Construction mode: {target["constructionMode"]}.',
    ]
    if target.get("chassisId"):
        lines.append(f'- Fixed chassis: {target["chassisId"]}.')
    lines.append("")
    lines.extend(bullet_block("Identity invariants", target["identityInvariants"]))
    lines.extend(bullet_block("Anatomy invariants", target["anatomyInvariants"]))
    lines.extend(
        [
            f'Affinity: {target["affinity"]}.',
            f'Affinity expression: {affinity_design["expression"]}',
            f'Counterplay cue: {affinity_design["counterplayCue"]}',
            (
                "Altered dimensions: "
                + ("; ".join(affinity_design["alteredDimensions"]) or "none")
                + "."
            ),
            "Permitted transformations: " + "; ".join(target["permittedTransformations"]) + ".",
            "Prohibited traits: " + "; ".join(target["prohibitedTraits"]) + ".",
            "",
        ]
    )
    goblin = target.get("goblinVariation")
    if goblin:
        lines.extend(
            [
                "Goblin compound variation:",
                *(f"- {key}: {compact_value(value)}." for key, value in goblin.items()),
                "",
            ]
        )
    lines.extend(
        [
            "Presentation:",
            f'- Style: {presentation["styleContract"]}',
            f'- Medium: {presentation["medium"]}.',
            f'- Background: {presentation["background"]}.',
            f'- Lighting: {presentation["lighting"]}.',
            f'- Composition: {presentation["composition"]}',
            (
                f'- Canvas: {canvas["width"]} x {canvas["height"]} '
                f'{canvas["mediaType"]} with at least {canvas["safeMarginPercent"]} percent '
                "safe margin around the entire silhouette and all extremities."
            ),
        ]
    )
    if target.get("promptProtocol") in {"safe-frame-v2", "safe-frame-v4"}:
        lines.append(
            "- Framing lock: fit every hard extent—including weapon tip, standard, horns, tail, "
            "and effect wake—inside the central 84 percent of both canvas dimensions; leave a "
            "clearly empty border on all four sides."
        )
    lines.extend(["", "Reference routing, in supplied order:"])
    for index, reference in enumerate(target["references"], start=1):
        lines.append(f'{index}. {reference["path"]} — {reference["purpose"]}.')
    lines.extend(["", "Constraints:", *(f"- {item}" for item in presentation["negativePrompt"])])
    prompt = "\n".join(lines).rstrip()
    return (
        prompt
        if target.get("promptProtocol") in {"safe-frame-v3", "safe-frame-v4"}
        else prompt + "\n"
    )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: render_prompt.py TARGET")
    target = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    sys.stdout.write(render(target))


if __name__ == "__main__":
    main()
