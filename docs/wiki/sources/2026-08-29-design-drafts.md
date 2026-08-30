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

- Imported rules keep `draft` or `seed` status unless the owner already accepted the same decision.
- Accepted owner decisions take precedence. In particular, `6★ = 99` and `7★ = 999` replace the
  progression source's older `70/99` caps while the old proposal remains documented.
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

## Known convergence decisions

Before initial runtime content IDs are frozen, the owner should resolve:

1. the supplied `Might / Vitality / Agility / Dexterity / Intellect / Spirit` attributes versus the
   current wiki's `Might / Vigor / Agility / Focus / Insight / Presence` vocabulary;
2. Wind as a derived Metal × Wood affinity versus the current base-affinity candidate;
3. kill-only XP versus generic typed progression grants;
4. two consumed Master-10 skill inputs versus the broader two-or-three-input merge target;
5. unlimited passives versus equipped capacity/action-economy limits;
6. Normal-only Living Village summoning versus including Advanced summons and gems;
7. approval or revision of the proposed three-race runtime set, with visual tier kept separate from
   floor-scaled combat stats.

These are design decisions, not reasons to block independent text, art, UI-shell, or contract-fixture
work.
