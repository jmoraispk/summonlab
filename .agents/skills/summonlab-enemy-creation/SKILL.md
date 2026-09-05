---
name: summonlab-enemy-creation
description: Use when adding or revising a Summonlab enemy family, standalone enemy, combat form, affinity variant set, legacy mapping, or enemy visual-production plan.
---

# Summonlab enemy creation

Create one coherent enemy family or standalone enemy at a time. Combat function, anatomy, affinity
transformation, production evidence, and wiki documentation must describe the same identity.

Before editing, read [family-design-contract.md](references/family-design-contract.md) and
[repository-workflow.md](references/repository-workflow.md). Inspect the live repository rather than
copying counts or paths from this skill.

## Minimal invocation contract

A short request is complete. For example:

`Use $summonlab-enemy-creation to add Rodents as a new family.`

The agent—not the user—owns repository discovery, authority selection, stable IDs, source order,
schema details, count updates, file paths, affinity rules, validation, and delivery. Never ask the
user to restate those instructions or paste a workflow checklist.

## Intake and route selection

Resolve the request as one of these routes:

| Route                    | Result                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| New family               | A complete T1–T5 family progression and its five-target variant plan                           |
| Standalone enemy         | One enemy identity with explicit family relationship, combat tier/role, and requested variants |
| Existing-family addition | A new form or secondary archetype reconciled with the current family grammar                   |
| Revision                 | A bounded change to an existing identity without reopening accepted siblings                   |

If the request does not identify the route, ask whether it is a new family, standalone enemy,
existing-family addition, or revision. A named route such as “Rodents as a new family” already
answers that question.

Inspect the repository and infer strong defaults before asking for more. Ask one compact group of
product questions only when the answers materially change the result, choosing from:

- family name or standalone enemy name;
- biological, supernatural, cultural, and anatomy boundaries;
- habitat, tone, encounter purpose, and desired difficulty;
- particular inspirations, required or forbidden features, and any requested long-form description;
- for a standalone enemy, its existing-family relationship, tier/role, and affinity coverage;
- requested production phase: design, target materialization, candidate generation, review, or
  promotion.

Do not ask about repository paths, schemas, totals, validators, provenance format, or production
bookkeeping. Discover those from current sources.

## Proposed brief

Convert the request and repository evidence into this complete brief:

1. family identity, biological boundaries, habitat, and encounter lesson;
2. T1–T5 names, archetypes, battlefield duties, and visual pivots for a family—or identity, family
   relationship, tier, archetype, and duty for a standalone enemy;
3. Normal plus Fire, Earth, Wind, and Water construction themes;
4. legacy identities to retain, remap, or retire;
5. requested phase: design, target materialization, candidate generation, review, or promotion.

Propose names, mechanics, descriptions, and visual details rather than asking the user to invent
them. Mark only material assumptions. If product choices remain open, request one approval of the
complete brief before editing. If the user already approved it or explicitly requested
uninterrupted execution, record that decision and proceed without repeated checkpoints. Never infer
approval of generated art.

## Workflow

1. Establish the current authority, protected programs, ownership boundary, and next collision-safe
   program root.
2. Author or revise the canonical family packet using `FamilyPacketSchema` and the applicable
   family or standalone contract.
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

Report the family/forms or standalone identity created, exact Normal-plus-affinity coordinate count,
production state, legacy disposition, validation evidence, branch, commit, push destination,
clean-tree state, and one focused review request.

## Common mistakes

- Treating T1–T5 as the same creature scaled larger instead of changing combat function.
- Making T3 a stronger Soldier rather than the qualitative specialist pivot.
- Making T5 a solo spectacle that ignores lower forms.
- Producing palette swaps or turning Earth animals into solid rock statues.
- Mixing candidates, approvals, and runtime files in one directory or status count.
- Editing a completed production root because a new family resembles an old class.
- Requiring a detailed user prompt instead of performing repository discovery and proposing the
  missing product design.
