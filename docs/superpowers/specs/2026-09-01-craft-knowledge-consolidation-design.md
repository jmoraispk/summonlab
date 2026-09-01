# Craft Knowledge Consolidation Design

**Date:** 2026-09-01
**Status:** Approved for implementation
**Supersedes:** The Craft-family portion of the 2026-08-31 skill-taxonomy consolidation design

## Goal

Make the skill taxonomy structurally symmetric at `Domain → Family → Skill` while preserving the useful creature-oriented mechanics. Craft must expose exactly five families:

1. Forging
2. Alchemy
3. Cooking
4. Gathering
5. Knowledge

The former `Beast` family is removed. The former `Lore` family is renamed `Knowledge`.

## Approved ownership

### Craft / Gathering

Gathering covers acquiring useful material and living resources from the world. It owns ordinary gathering, harvesting, animal handling, taming, and breeding.

The creature progression is:

`Animal Handling → Taming → Greater Taming → Monarch of Beasts`

- `Animal Handling` absorbs `Calm` and `Feed`: animals do not immediately flee or attack, and the hero can calm hostile beasts and build trust by feeding them.
- `Taming` requires mastery of Animal Handling and binds a low-tier creature as a companion.
- `Greater Taming` requires mastery of Taming and extends binding to mid-tier monsters.
- `Monarch of Beasts` remains the high-tier capstone.
- `Breeding` remains in Gathering because it produces living resources and inherited traits.

### Craft / Knowledge

Knowledge covers learned interpretation: literacy, identification, appraisal, mapping, languages, research, teaching, and specialist understanding. `Beast Speech` is removed from the active taxonomy by the approved revision; its immutable legacy row remains auditable through a delete disposition in the migration ledger.

All active requirements and prose use `Knowledge`, never `Lore`.

### Martial / Body

Body covers movement, endurance, awareness, unarmed combat, grappling, mounted movement, and bodily command in combat.

- `Riding` moves to Body.
- `Mounted Combat` moves to Body.
- `Bonded Mount` moves to Body.
- `Pack Bond` moves to Body and becomes the explicit multi-beast combat skill: the hero commands several tamed companions to coordinate attacks on the hero's behalf.

These skills may depend on Gathering skills across domains. `Pack Bond` is deliberately separate from Taming: Taming acquires companions; Pack Bond commands several of them in battle.

## Consolidations and prerequisite repair

- Delete no approved retained skill other than `Beast Speech`; merge `Calm` and `Feed` into `Animal Handling`.
- Replace structural `Beast prerequisite` references with concrete surviving skills.
- Replace structural `Lore prerequisite` references with `Knowledge` or a concrete Knowledge skill.
- `Bind the Beast`, monster crafting, and monster cuisine must point to surviving prerequisites.
- The immutable 520-row legacy inventory remains untouched. The generated migration ledger is the auditable record of every rename, rehome, merge, and deletion.

## Expected migration totals

Starting from the approved 495-row target:

- `Calm` merges into `Animal Handling` (-1).
- `Feed` merges into `Animal Handling` (-1).
- `Beast Speech` is deleted from the active taxonomy (-1).
- All remaining former Beast skills are retained and rehomed.

Expected final target: 492 skills.

| Domain | Expected skills |
| --- | ---: |
| Martial | 258 |
| Magical | 160 |
| Craft | 74 |

Expected Craft family counts:

| Family | Expected skills |
| --- | ---: |
| Forging | 16 |
| Alchemy | 16 |
| Cooking | 12 |
| Gathering | 18 |
| Knowledge | 12 |

## Wiki and interactive behavior

- Canonical mechanics pages, framework prose, progression references, roadmap capability names, fixtures, and the interactive skill tree all use the new five-family model.
- The interactive tree continues to use the established visual system and interaction behavior; this is a taxonomy/content revision, not a redesign.
- Craft expands to exactly five family nodes. `Beast` and `Lore` are absent.
- Body previews the mounted and multi-companion combat skills.
- Gathering previews creature acquisition/progression skills.
- Knowledge previews retained learned and interpretive skills such as Languages and Read the Body.

## Verification contract

- Focused migration tests prove exact mappings, merged effects, repaired prerequisites, domain totals, and family totals.
- Taxonomy and wiki validators pass with no active Beast or Lore family references.
- Interactive unit and browser tests prove the five-family Craft tree and new destinations.
- Full repository tests, web typecheck/lint/build, strict UI audit, and live browser inspection pass before integration.
