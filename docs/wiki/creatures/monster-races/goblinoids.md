# Goblinoids

Wiki ID: `monster-family.goblinoids`

Design status: **draft family page built from accepted first-wave encounter content**

## Player-facing bestiary entry

Goblinoid warbands are the tower's first coordinated opponents. Their danger comes from readable
roles, communication, formation, and escalating cooperation rather than from an assumption that
every member is physically overwhelming.

Skirmishers teach guard timing. Archers create ranged lanes. Hexweavers create interruptible control.
Chieftains rally formations and force threat-priority decisions. Together they introduce the player
to the idea that a functioning enemy system is more dangerous than four unrelated stat blocks.

## Current classification

| Field | Current answer |
| --- | --- |
| Origin | unresolved |
| Family | `goblinoids` visual/content family |
| Species/race | unresolved; current labels imply goblins plus an “ogoblin” large variant |
| Sapience/personhood | likely sapient from tools, roles, command, and magic; requires explicit canon |
| Faction/duty | tower warband in current encounter content |
| Current archetypes | skirmisher, archer, hexweaver, chieftain |

Until authored otherwise, hostility belongs to the deployed tower warband—not to an assertion that
all goblinoid people are inherently hostile or morally identical.

## Implemented combat grammar

| Archetype | Role | Skills/tells | First teaching goal |
| --- | --- | --- | --- |
| Goblin Skirmisher | mobile melee pressure | knife fighting, feinting, pack movement | guard timing and target focus |
| Goblin Archer | ranged lane control | shortbow, repositioning, marking | cover and closing distance |
| Goblin Hexweaver | telegraphed magical control | ember hex, binding mark, concentration | ward reading and interrupts |
| Goblin Chieftain | formation leader | command, heavy cleave, rally | formation disruption and threat priority |

These descriptions are bound to `packages/content/src/enemy-roster.ts`. The full anatomy, culture,
life cycle, language, and noncombat behavior are not yet canon.

## Affinity profile

No family-wide affinity profile is accepted. “Ember hex” suggests that the Hexweaver may use a
[Fire](../../mechanics/affinities/fire.md)-related skill or effect, but a skill name is not evidence
that all goblinoids possess Fire affinity. Future entries must separate individual profile, learned
skill, equipment, faction practice, and species distribution.

## Visual candidate

![Goblinoid warband review plate](../../../../assets/enemies/review/goblinoids-v1.webp)

- Asset: `goblinoids-v1`
- Status: **candidate**, not approved runtime canon
- Purpose: compare the four initial battlefield duties and family cohesion

The plate can inform a more precise anatomy/culture brief, but details visible only here remain
proposals until described and reviewed in text.

## Visual canon still needed

- shared versus variant anatomy, scale, ears, hands, feet, teeth, skin, hair, and aging;
- equipment manufacture, material access, repair, and faction marks;
- how skirmisher/archer/hexweaver/chieftain remain jobs rather than biological castes;
- individual identity and gender/age variation;
- affinity cues that do not become race-wide full-body color coding;
- noncombat, injured, surrendered, social, and settlement-scale states;
- whether “ogoblin” is a species, evolved form, translation, or unrelated large-threat label.

## Implementation and evidence

- Archetypes and progression use: `packages/content/src/enemy-roster.ts`
- Initial visual plate: `assets/enemies/review/goblinoids-v1.webp`
- Monster duties and mission content: `packages/content/src/monster-policies.ts` and tower-band files
- Runtime identity anchors and animation: not yet implemented

## Open questions

- Are goblins one sapient people, several species, or tower-created replicas?
- Can heroes negotiate, recruit, release, or learn from them?
- What does a goblinoid community look like outside a warband?
- Which affinities are physiological, learned, equipped, or faction-specific?
- Which visible traits must stay stable across future culture/technology packs?
