---
name: summonlab-skill-creation
description: Use when a Summonlab request introduces or revises a canonical skill or Domain → Family → Skill branch and the result must remain consistent with the repository's mechanics and skill-icon catalog.
---

# Summonlab skill creation

Mechanic, taxonomy, motif lineage, visual specification, icon candidate, and production evidence
must describe the same skill.

Before editing, read [repository-workflow.md](references/repository-workflow.md). Choose its
**existing-family** or **new-family** route.

## Minimal invocation and intake

A skill name is a complete invocation; no repository paths or workflow vocabulary are required.

When the request supplies only a name or an incomplete concept, inspect the current repository
read-only and make the strongest coherent initial proposal. The first user-facing response must be
only a compact proposed brief containing:

- skill name;
- Domain and Family;
- rarity and type;
- optional Equipment or Element label when applicable;
- requirements and effect;
- motif family, lineage position, and immediate visual parent or standalone status;
- concrete icon subject, supporting cue, palette, and exclusions.

Derive the stable target ID, provenance route, production revision, file paths, and validation work
without asking the user to remember them. Mark genuinely uncertain product assumptions, offer an
alternative only when two interpretations materially differ, and end with one request to approve or
correct the proposed brief. Do not begin edits or image production before that confirmation. Do not
explain repository procedure in the intake unless a blocking product choice depends on it.

If the request already contains some fields, preserve them and propose only the missing decisions in
the same complete brief. After approval, execute the encoded workflow without asking the user to
restate implementation details.

## Authoring contract

Resolve and record this brief before implementation. The agent proposes it; the user only approves
or corrects product decisions:

| Field      | Required decision                                                    |
| ---------- | -------------------------------------------------------------------- |
| Identity   | Domain, family, unique name, stable target ID                        |
| Mechanics  | rarity, type, requirements, effect                                   |
| Labels     | optional `Equipment` or `Element`, never another hierarchy level     |
| Lineage    | motif family, position, immediate visual parent or standalone status |
| Art        | concrete subject, supporting cue, palette, exclusions                |
| Production | temporary review inputs, canonical interior, runtime validation      |

Use current repository files as authority; never copy catalog totals from this skill. Preserve
`Domain → Family → Skill`; equipment and element metadata remain optional skill labels.

## Completion sequence

1. Author the canonical mechanic and honest provenance first. A net-new skill is not a legacy row.
2. Reconcile wiki navigation and the interactive tree when the family or visible catalog changes.
3. Place every skill in exactly one motif lineage and author its visual specification.
4. Author the unified motif map and visual specification, then export the derived catalog; do not
   hand-author `catalog.json`.
5. Generate a temporary pre-generation family sheet from accepted lineage members only, excluding
   the target. Omit it when no accepted member exists; a complete sheet including the candidate is
   optional after generation for owner review.
6. Independently generate each new skill as one frameless artwork layer through the assigned
   manifest-bound workflow. The coordinator owns deterministic sizing, backing, and final-frame
   assembly; do not revise accepted siblings unless requested.
7. Present the temporary composite for owner review and validate mechanics, wiki, catalog, raster
   geometry, types, and tests.
8. After owner approval, promote the frameless interior into the canonical asset manifest,
   regenerate the wiki runtime, and remove temporary review artifacts. The individual producer
   never promotes shared state.

## Stop conditions

Stop if the user has not confirmed the proposed product brief or if repository authority remains
ambiguous after inspection. Never invent provenance, reuse a sibling icon, enlarge a family-sheet
cell, or call a candidate approved. If schemas accept only migrated
legacy rows, extend and test explicit net-new provenance; never falsify legacy inventory.

## Quick reference

| Request                      | Temporary family sheet            | Canonical interior           |
| ---------------------------- | --------------------------------- | ---------------------------- |
| Add to existing motif family | Accepted members; exclude target  | New skill only               |
| Add standalone skill         | Omit                              | New skill                    |
| Add new motif family         | Accepted members, or omit if none | Every new member             |
| Revise mechanics only        | Only if art identity changes      | Only if art identity changes |

## Common mistakes

- Editing derived JSON before the canonical wiki source.
- Treating a temporary run or family sheet as permanent inventory.
- Omitting the on-demand accepted-member sheet when lineage members exist, or omitting the
  immediate-parent authority when one is declared.
- Including the target or unapproved new members in the pre-generation family sheet. A complete
  framed sheet is optional only after generation and is never individual artwork content.
- Never supply an approved rarity frame as individual generation content.
- Using a successful historical-run check as evidence that the new revision is complete.
