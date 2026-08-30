# Game system index

Wiki ID: `systems.index`

Summonlab is a game about designing interacting systems so people can develop capability, find
purpose, form groups, and pursue difficult goals. No feature is allowed to become a private
minigame with incompatible definitions of heroes, resources, knowledge, or time.

The [shared system map](../../system-architecture/system-map.md) is the engineering ownership
authority. This page is its readable wiki doorway.

## Five player-facing systems

The broad product is grouped into five reviewable domains rather than exposing every engine bounded
context as a separate subsystem.

| System | Includes | Current Living Village boundary |
| --- | --- | --- |
| [Visuals](visuals.md) | heroes, monsters, equipment, skills, Village, tower, UI and effects | realistic identity continuity and a bounded approved asset set |
| [Tower, World, and Story](tower-world-story.md) | tower, encounters, expeditions, destinations, campaign and lore | static Floors 1–10 with no story, navigation, or world simulation |
| [Settlement and Society](settlement-society.md) | facilities, expansion, agency, relationships, institutions and motivation | static Hearth; no society or autonomous behavior |
| [Summoning, Progression, and Combat](summoning-progression-combat.md) | acquisition, heroes' numerical growth, skills, affinities, equipment, training, combat and synthesis | Normal summons, first growth band, small catalogs, deterministic combat |
| [Town Master Operations](town-master-foundation.md) | objectives, assignments, parties, reports, knowledge and automation | only the direct actions required by the core loop |

The same [Town Master and Foundation page](town-master-foundation.md) records the technical spine
that connects the five domains without pretending it is another piece of player content.

The [Living Village milestone](../milestones/living-village.md) is the current delivery authority.
It intentionally activates only a narrow slice of every domain.

## Horizontal capabilities

| Capability | Appears in | Shared rule |
| --- | --- | --- |
| Attributes, affinities, and skills | heroes, monsters, training, equipment, missions, synthesis | One typed mechanical vocabulary for every actor |
| Motivation and purpose | goals, facilities, schedules, mentors, parties, culture | Behavior emerges from systems, not an obedience stat |
| Knowledge and evidence | secrets, reports, dialogue, story, neighbor contact | Truth, Master awareness, and hero belief remain separate |
| Economy and grants | summoning, building, promotion, rewards, ships | One idempotent ledger and receipt boundary |
| Time and scheduling | routines, training, recovery, travel, construction | Server-owned deterministic time and catch-up |
| Identity and visuals | summon, roster, dialogue, base, mission, synthesis, memorial | One manifest and presentation state across every surface |
| Story/content catalogs | tower, creatures, affinities, buildings, neighbors | Reviewed immutable definitions plus validated selection |
| Event/replay/journal | every consequential system | The engine alone commits; every consequence is attributable |
| Wiki and asset pipeline | design, art, implementation, review | Text canon and generated artifacts return to one checked index |

## How the full game composes

One representative causal chain:

```text
Master defines a Floor-45 objective
→ settlement exposes training places, mentors, schedule, and feedback
→ heroes form goals and voluntarily train or raise objections
→ progression records practice and skill growth
→ leader evaluates evidence and petitions the Master
→ party revision and equipment are reserved
→ tower expedition resolves typed actions, affinities, and effects
→ extraction grants resources, experience, knowledge, injuries, and story evidence
→ settlement relationships, motivation, and future plans change
```

The point is not to optimize a single number. The player designs the institutions that make this
chain healthy, resilient, and legible.

## Detailed briefs

- [Story and tower campaign](../../system-architecture/systems/story-and-tower.md)
- [Progression and skills](../../system-architecture/systems/progression-and-skills.md)
- [Heroes and agency](../../system-architecture/systems/heroes-and-agency.md)
- [Settlement and expansion](../../system-architecture/systems/settlement-and-expansion.md)
- [Expeditions and neighbors](../../system-architecture/systems/expeditions-and-neighbors.md)
- [Summoning, synthesis, and economy](../../system-architecture/systems/summoning-synthesis-economy.md)

## Open wiki work

- Bind every accepted page to contracts, content IDs, runtime evidence, and visual galleries.
- Add cross-page dependency generation once the initial taxonomy stabilizes.
- Decide which accepted rules ship publicly and which populate the discoverable compendium.
- Revisit the five-system grouping after the Living Village loop is playable; split a domain only
  when independent ownership cannot remain clear through internal bounded contexts.
