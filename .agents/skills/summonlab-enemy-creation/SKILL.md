---
name: summonlab-enemy-creation
description: Use when adding, consolidating, or revising a Summonlab enemy family, its T1–T5 combat forms, Normal/Fire/Earth/Wind/Water variants, legacy mappings, or collision-safe visual-production plan.
---

# Summonlab enemy creation

Create one coherent enemy family at a time. Combat progression, anatomy, affinity transformation,
production evidence, and wiki documentation must describe the same five forms.

Before editing, read [family-design-contract.md](references/family-design-contract.md) and
[repository-workflow.md](references/repository-workflow.md). Inspect the live repository rather than
copying counts or paths from this skill.

## Intake

A family name can be a complete invocation. Inspect neighboring families and propose the missing
decisions. The brief has this exact shape:

1. family identity, biological boundaries, habitat, and encounter lesson;
2. T1–T5 names, archetypes, battlefield duties, and visual pivots;
3. Normal plus Fire, Earth, Wind, and Water construction themes;
4. legacy identities to retain, remap, or retire;
5. requested phase: design, target materialization, candidate generation, review, or promotion.

If product choices remain open, request one approval of the complete brief before editing. If the
user already approved the family or explicitly requested uninterrupted execution, record that
decision and proceed without repeated checkpoints. Never infer approval of generated art.

## Workflow

1. Establish the current authority, protected programs, ownership boundary, and next collision-safe
   program root.
2. Author or revise the canonical family packet using `FamilyPacketSchema` and the T1–T5 contract.
3. Write affinity themes that alter construction, motion, material response, and silhouette detail;
   a hue shift is not a variant.
4. Reconcile legacy classes without rewriting frozen manifests or regenerating accepted siblings.
5. Update the authored design and wiki sources, then regenerate only derived documentation through
   its exporter.
6. Add or update focused validation for packet shape, counts, state separation, and protected-source
   immutability.
7. If images were requested, materialize manifest-bound targets and assignments first, then use
   `summonlab-image-production` independently for each owned raster.
8. Validate, inspect the scoped diff, commit, and push under the repository instructions.

## State contract

Keep these facts distinct:

| State             | Meaning                                          |
| ----------------- | ------------------------------------------------ |
| Design packet     | Authored intent; no image target exists yet      |
| Target/assignment | A manifest-bound production coordinate and owner |
| Candidate         | Reviewable output with provenance; not accepted  |
| Approved          | Owner-reviewed visual; not automatically runtime |
| Runtime           | Explicitly integrated asset and catalog entry    |

Stop before shared runtime catalog or engine-contract changes unless the root orchestrator has
agreed to that integration. Never call a candidate approved, self-promote produced art, or use a
historical hash ledger as a requirement when the owner has retired it.

## Completion report

Report the family/forms created, exact Normal-plus-affinity coordinate count, production state,
legacy disposition, validation evidence, branch, commit, push destination, clean-tree state, and one
focused review request.

## Common mistakes

- Treating T1–T5 as the same creature scaled larger instead of changing combat function.
- Making T3 a stronger Soldier rather than the qualitative specialist pivot.
- Making T5 a solo spectacle that ignores lower forms.
- Producing palette swaps or turning Earth animals into solid rock statues.
- Mixing candidates, approvals, and runtime files in one directory or status count.
- Editing a completed production root because a new family resembles an old class.
