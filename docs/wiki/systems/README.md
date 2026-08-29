# Game system index

Wiki ID: `systems.index`

Summonlab is a game about designing interacting systems so autonomous people can find purpose,
develop capability, form groups, and pursue difficult goals. No feature is allowed to become a
private minigame with its own incompatible definitions of heroes, resources, knowledge, or time.

The [shared system map](../../system-architecture/system-map.md) is the engineering ownership
authority. This page is its readable wiki doorway.

## Player-facing systems

| System | Player promise | Primary truth owner | Current target |
| --- | --- | --- | --- |
| Summoning | Meet new people through Normal, Advanced, and Special channels | Summoning + Economy | Production quote/commit/pity loop |
| Heroes | Persistent identity, personality, goals, mood, habits, and history | Character + Society | Shared presentation and motivation state |
| Settlement | Build an environment that changes behavior and capacity | Settlement | Construction, modules, territory sectors |
| Training and skills | Develop capability through practice, teaching, and fusion | Progression + Skill catalog | Progression-v2 and typed skill lattice |
| Parties | Create stable teams with leaders, roles, doctrine, and cohesion | Company/Party | Persistent party revisions and readiness |
| Tower | Climb a variable but coherent one-hundred-floor campaign | Expedition + Campaign story | Masterless party runtime and campaign plan |
| Portal worlds | Run temporary, extraction-bound resource expeditions | Expedition | Reusable portal attempt contract |
| Synthesis | Trade one permanent life for bounded short-term growth | Synthesis + Society | Honest preview, choice, saturation, aftermath |
| Base expansion | Reclaim sectors and add behavioral infrastructure | Settlement | Facility instances and capability unlocks |
| Neighbor exploration | Reach persistent settlements after building an airship | Destinations + Expedition | First ship, route, and neighbor relationship |
| Mounts and vehicles | Extend movement, cargo, rescue, and identity | Assets + Expedition | Ride/carry/evacuate ground-mount slice |

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

## How systems compose

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

- Create dedicated wiki pages for each player-facing system from the shared system-brief template.
- Bind every accepted page to contracts, content IDs, runtime evidence, and visual galleries.
- Add cross-page dependency generation once the initial taxonomy stabilizes.
- Decide which accepted rules ship publicly and which populate the discoverable compendium.
