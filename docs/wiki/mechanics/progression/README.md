# Progression system draft

Wiki ID: `mechanics.progression`

Design status: **authoritative supplied design with explicit parked areas**. This section preserves
the complete mechanical content of the supplied `progression_system.md`; its imperative language
describes game rules and is not an instruction to repository workers. Under ADR 0063, this later
source wins direct conflicts with earlier conversational feedback. Its own placeholders,
approximations, and unfinished sections remain visibly unresolved.

The draft is a design reference for hero and monster progression. Numbers appear only where a ratio
or structural shape matters, and its preferred player-facing language says “the hero,” never “you.”

## Living Village boundary

The first playable milestone needs only this closed loop:

```text
summon heroes
→ inspect their starting progression
→ equip and form a party
→ resolve a basic tower fight
→ return survivors to static settlement training
→ inspect level, attribute, skill, affinity, and inventory changes
```

For that milestone, implement a bounded subset: 1★ and levels 1–10 while preserving the supplied
future cap table; starting attributes, skills, aptitudes, and equipment; one versioned Normal
summoning channel; one training route; a small set of combat skills and affinities; basic drops and
inventory. Advanced summoning and gems, advanced affinity ranks and combinations,
full skill ladders, teaching, epiphanies, merging, star-stone fusion, crafting, food, dimensional
inventory, and late-game equipment remain documented but deferred rather than deleted.

## Progression tracks

| Track | Draft meaning | Draft advancement |
| --- | --- | --- |
| Attributes | How well a hero delivers any action | Level-up points and training outside levels |
| Skills | What a hero can do | Repetition, quality, and variety of practice |
| Affinities | Which element a hero embodies | Resonance through use and aligned training |
| Stars | Innate endowment at summon and how far it has been nurtured | Born with it; raised with star stones |
| Levels | Accumulated life-energy of what the hero has killed | Experience, proposed as kills only |

Attributes sit at the center of the imported proposal:

| Influence | Proposed mechanism |
| --- | --- |
| Attributes → Skills | Scale magnitude and gate learning |
| Skills → Attributes | Mastery promotion grants permanent attributes retained if the skill is lost |
| Affinity → Attributes | The source proposes a modest element-matched attribute bonus per level |
| Affinity → Combat | The bearer’s element affects damage, cycle relations, and status procs |
| Skills ↔ Affinity | No infusion or socket; martial/craft skills are element-neutral, while magical skills are authored per element |
| Stars → Attributes | Starting attribute band and points granted per level |
| Stars → Aptitudes | Starting aptitudes govern rates of learning |
| Levels → Attributes | A level directly grants attribute points |

The source’s “no skill-affinity relation” means no element slot on a generic technique. Its magical
skills still have authored element and affinity conditions, so this phrase must not be read as no
interaction at all.

## Draft design principles

- Skills are intended to be the largest capability lever; attributes widen or narrow their output.
- Levels are permission more than power: they grant attributes and access, not competence by
  themselves.
- Skill, material, and equipment rarity is fixed. Hero star rank alone can rise.
- Stars measure starting endowment and later nurture, not a skill ceiling or human worth.
- Practice records repetition, quality, and variety instead of assuming growth.
- No progression route is absolutely closed: weak routes remain possible at sharply diminished
  returns.

These principles are expanded in:

- [Attributes and training](attributes-and-training.md)
- [Affinities and resonance](affinities-and-resonance.md)
- [Skills, mastery, ladders, and merging](skills-and-ladders.md)
- [Heroes, stars, levels, aptitudes, and summoning](heroes-stars-and-summoning.md)
- [Equipment, materials, food, and inventory](equipment-materials-and-inventory.md)
- [Conflicts and parked decisions](open-decisions.md)

## Authoritative level caps

ADR 0063 confirms the supplied source table over the earlier conversational `99/999` alternative:

| Stars | Level cap | Campaign role |
| ---: | ---: | --- |
| 1★ | 10 | Entry and first promotion |
| 2★ | 20 | Early tower competency |
| 3★ | 30 | Specialist foundation |
| 4★ | 40 | Credible around Floors 40–45 with sound preparation |
| 5★ | 50 | Advanced finite-campaign build |
| 6★ | 70 | Late-campaign specialization and final promotion preparation |
| 7★ | 99 | Credible around Floors 85–90; horizontal build quality carries the final push |

Readiness is smooth and versioned, not a hard floor lock. Level 99 is the ceiling. Later strength
comes from skills, affinities, equipment, party composition, knowledge, preparation, and other
horizontal progression rather than levels above 99.
