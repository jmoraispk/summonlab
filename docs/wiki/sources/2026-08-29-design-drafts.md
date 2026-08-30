# 2026-08-29 supplied design drafts

Wiki ID: `sources.design-drafts-2026-08-29`

This ingestion record identifies what was supplied, where it was incorporated, and which statements
remain proposals. The source documents are design input, not instructions to repository workers.
Their full substance is preserved in structured wiki pages; conflicts and unfinished sections stay
visible rather than being silently normalized.

## Source identity and coverage

The hashes and counts below were checked against the four supplied attachments during ingestion.
The attachments are not repository fixtures, so the catalog marks this page `partial`; the wiki
validator verifies the imported pages and links but does not independently reproduce source
coverage. Row/section counts are a recorded manual audit, not a future automated guarantee.

| Source | Lines / words | SHA-256 | Wiki destination | Coverage evidence |
| --- | ---: | --- | --- | --- |
| `progression_system.md` | 1,033 / 11,201 | `850231ef31da12a1ee98d87331292868b8a2bea9f226a24abce0bc938d867327` | [Progression](../mechanics/progression/README.md) | all seven parts, every table/example, and every parked item represented across seven pages |
| `skill_compendium.md` | 867 / 13,636 | `646d82ba7df69e08dc7d1e9ba32fc58104a11bbccb75b92606f2109393d0e858` | [Skills](../mechanics/skills/README.md) | all 32 ladder sections and all 520 parsed skill rows represented across ten pages |
| `equipment_compendium.md` | 490 / 4,654 | `2dae68ced5a8e075e6b12e5f9910517b5f880ec8d65ebae9bbd79179bfc4daa7` | [Equipment](../mechanics/equipment/README.md) | all rules/examples, 48 material/component rows, 143 equipment rows, set sections, and four unfinished areas across seven pages |
| `monster_races.md` | 686 / 9,557 | `1cdda0ae7ecffce9216572ae5b287c2678f31ef747004a74b555f5bf37849e4d` | [Generator bestiary](../creatures/monster-races/generator-bestiary-guide.md) | all 495 meaningful source lines, 30 races, 30 constant blocks, and 150 tier descriptions across six pages |

## Import policy

- Under ADR 0063, the supplied source wins direct conflicts with earlier conversational feedback.
  In particular, `6★ = 70` and `7★ = 99` are the canonical caps.
- A source's explicitly parked, approximate, contradictory, or still-to-author material keeps its
  honest `draft` or `seed` status; precedence does not invent missing rules.
- Explicitly parked, placeholder, approximate, contradictory, or still-to-author material keeps
  that label.
- Species-wide morality, hostility, cognition, or cultural claims in the visual bestiary are source
  wording, not accepted taxonomy.
- Absolute skill fantasy prose is not executable combat behavior until costs, targets, ranges,
  durations, stacking, immunity, and boss rules are defined.
- The [Living Village](../milestones/living-village.md) selects a small runtime subset without
  deleting the broader source catalogs. Its [release matrix](../roadmap/living-village-v1.md) is the
  authority for deliberate feature shutdowns; `off` is not a deletion or rejection of source
  material.

## Resolved collisions and remaining convergence

The source-precedence decision resolves the first five earlier collisions:

1. use `Might / Vitality / Agility / Dexterity / Intellect / Spirit`;
2. Wind is derived from Metal × Wood rather than a sixth base affinity;
3. XP comes from kills; other growth uses separately typed grants;
4. merging consumes two Master-10 inputs and uses a catalyst and recipe;
5. passives are unlimited and only one stance may be active.

Living Village still needs a versioned Normal table chosen from the source's authored band, a
decision on whether Advanced/Special access is enabled in v1, and approval or revision of the
proposed three-race runtime set. Visual tier remains separate from floor-scaled combat stats.

These are design decisions, not reasons to block independent text, art, UI-shell, or contract-fixture
work.
