# Progression system draft

Wiki ID: `mechanics.progression`

Design status: **authoritative supplied design with explicit parked areas**. This section preserves
the progression mechanics supplied across `progression_system.md` and the later affinity revision;
their imperative language describes game rules and is not an instruction to repository workers.
Under ADR 0063, the latest supplied source wins direct conflicts with earlier drafts. Explicit
placeholders, approximations, and unfinished sections remain visibly unresolved.

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
summoning channel; one training route; a small set of combat skills; explicit Unaligned affinity
state; basic drops and inventory. Because the playable heroes remain 1★, hero affinity awakening is
outside this slice. Advanced summoning and gems, affinity awakening and ranks, dual affinities, full
skill ladders, teaching, epiphanies, merging, star-stone fusion, crafting, food, dimensional
inventory, and late-game equipment remain documented but deferred rather than deleted.

## Progression tracks

| Track | Draft meaning | Draft advancement |
| --- | --- | --- |
| Attributes | How well a hero delivers any action | Level-up points and training outside levels |
| Skills | What a hero can do | Repetition, quality, and variety of practice |
| Affinities | Which element a hero embodies | Affinity rank through use and aligned training |
| Stars | Innate endowment at summon and how far it has been nurtured | Born with it; raised with star stones |
| Levels | Accumulated life-energy of what the hero has killed | Experience, proposed as kills only |

Affinities comprise four base affinities—Fire, Earth, Wind, and Water—and six rare dual
affinities, for ten total. Unaligned is the absence of affinity, not an eleventh affinity.

Attributes sit at the center of the imported proposal:

| Influence | Proposed mechanism |
| --- | --- |
| Attributes → Skills | Scale magnitude and gate learning |
| Skills → Attributes | Mastery promotion grants permanent attributes retained if the skill is lost |
| Affinity → Attributes | The source proposes a modest element-matched attribute bonus per level |
| Affinity → Combat | The bearer’s element affects damage, cycle relations, and status procs |
| Skills ↔ Affinity | Grade B+ skills carry additive affinity slots filled from affinities the hero holds |
| Stars → Attributes | Starting attribute band and points granted per level |
| Stars → Aptitudes | Starting aptitudes govern rates of learning |
| Levels → Attributes | A level directly grants attribute points |

An affinity belongs to the hero, while a skill supplies the slot through which that affinity is
expressed. Infusion adds elemental rider damage, rank-gated status and environmental behavior, and
cycle position without replacing the skill's base behavior. A hero cannot fill a slot with an
affinity they do not hold.

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
- [Affinities](affinities.md)
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
