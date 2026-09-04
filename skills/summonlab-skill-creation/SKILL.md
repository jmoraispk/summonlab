---
name: summonlab-skill-creation
description: Use when a Summonlab request introduces or revises a canonical skill or Domain → Family → Skill branch and the result must remain consistent with the repository's mechanics and skill-icon catalog.
---

# Summonlab skill creation

Mechanic, taxonomy, motif lineage, visual specification, icon candidate, and production evidence
must describe the same skill.

Before editing, read [repository-workflow.md](references/repository-workflow.md). Choose its
**existing-family** or **new-family** route.

## Authoring contract

Resolve and record this brief before implementation:

| Field      | Required decision                                                    |
| ---------- | -------------------------------------------------------------------- |
| Identity   | Domain, family, unique name, stable target ID                        |
| Mechanics  | rarity, type, requirements, effect                                   |
| Labels     | optional `Equipment` or `Element`, never another hierarchy level     |
| Lineage    | motif family, position, immediate visual parent or standalone status |
| Art        | concrete subject, supporting cue, palette, exclusions                |
| Production | additive run revision, references, outputs, validation               |

Use current repository files as authority; never copy catalog totals from this skill. Preserve
`Domain → Family → Skill`; equipment and element metadata remain optional skill labels.

## Completion sequence

1. Author the canonical mechanic and honest provenance first. A net-new skill is not a legacy row.
2. Reconcile wiki navigation and the interactive tree when the family or visible catalog changes.
3. Place every skill in exactly one motif lineage and author its visual specification.
4. Export a versioned derived icon inventory; do not hand-author catalog or motif-map JSON.
5. Create a new additive authority/run revision. Never mutate a completed run or its frozen inputs.
6. Save the affected family sheet, then independently generate each new skill at full resolution
   through the assigned manifest-bound workflow. Do not revise accepted siblings unless requested.
7. Validate mechanics, wiki, catalog, new-run evidence, raster geometry, types, and tests.
8. Leave generated art as a review candidate. Promotion and owner approval are separate actions.

## Stop conditions

Stop on missing authoring authority. Never invent provenance, overwrite historical evidence, reuse
a sibling icon, enlarge a family-sheet cell, or call a candidate approved. If schemas accept only
migrated legacy rows, extend and test explicit net-new provenance; never falsify legacy inventory.

## Quick reference

| Request                      | Family sheet                                        | Individual generation        |
| ---------------------------- | --------------------------------------------------- | ---------------------------- |
| Add to existing motif family | New revision containing the complete revised family | New skill only               |
| Add standalone skill         | New singleton sheet                                 | New skill                    |
| Add new motif family         | New sheet containing every new member               | Every new member             |
| Revise mechanics only        | Only if art identity or lineage changes             | Only if art identity changes |

## Common mistakes

- Editing derived JSON before the canonical wiki source.
- Treating dated plans or a completed run manifest as mutable live inventory.
- Generating a new icon without its motif-family reference sheet and immediate-parent authority.
- Using a successful historical-run check as evidence that the new revision is complete.
