# Progression system

Wiki ID: `mechanics.progression`

Design status: **authoritative for retained progression rules with explicit parked areas**. This
section preserves progression mechanics supplied across `progression_system.md` and the later
affinity revision except where a newer decision supersedes them. Under ADR 0063, supplied source
wins direct conflicts with earlier drafts;
[ADR 0072](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md) is the current
authority for combat attributes, hidden learning profiles, and level-allocation mechanics.

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
future cap table; four starting combat attributes, a separate hidden learning profile, skills, and
equipment; one versioned Normal summoning channel; one training route; a small set of combat skills;
explicit Unaligned affinity state; basic drops and inventory. Because the playable heroes remain
1★, hero affinity awakening is outside this slice. Advanced summoning and gems, affinity awakening
and ranks, dual affinities, full skill ladders, teaching, epiphanies, merging, star-stone fusion,
crafting, food, dimensional inventory, and late-game equipment remain documented but deferred rather
than deleted.

## Progression tracks

| Track | Current meaning | Current advancement |
| --- | --- | --- |
| Combat attributes | Broad physical and magical combat capability | One freely allocated intrinsic point per gained level plus typed permanent-training receipts |
| Skills | What a hero can do | Repetition, quality, and variety of practice |
| Hidden learning profile | Rate modifiers for validated practice; never decision quality or access | Generated independently from combat attributes and stars; no current star-awakening rule |
| Affinities | Which element a hero embodies | Affinity rank through use and aligned training |
| Stars | Starting endowment, level cap, and how far a hero has been nurtured | Born with it; raised with star stones; does not grant learning bundles or change point rate |
| Levels | Accumulated life-energy of what the hero has killed | Experience, proposed as kills only |

Affinities comprise four base affinities—Fire, Earth, Wind, and Water—and six rare dual
affinities, for ten total. Unaligned is the absence of affinity, not an eleventh affinity.

The current ownership boundaries are:

| Influence | Current mechanism |
| --- | --- |
| Combat attributes → actions | Might scales physical magnitude; Spirit scales magical magnitude; Vitality and Agility own their documented combat scopes |
| Combat attributes → learning | No gate or practice-rate effect |
| Hidden learning profile → practice | One bounded cognitive factor for comprehension-heavy evidence plus independent martial, magical, crafting, survival, and social domain scores |
| Affinity → attributes | No automatic point per level; a matching contribution nudge is capped at 10% and remains formula-specific |
| Affinity → combat | The bearer's element may affect damage, cycle relations, and status procs when the owning combat version implements them |
| Skills ↔ Affinity | Grade B+ skills carry additive affinity slots filled from affinities the hero holds |
| Stars → attributes/learning | No star-based attribute budget, multi-point package, aptitude count, or learning-profile awakening |
| Levels → attributes | Each gained level grants exactly one freely allocated intrinsic combat-attribute point |

An affinity belongs to the hero, while a skill supplies the slot through which that affinity is
expressed. Infusion adds elemental rider damage, rank-gated status and environmental behavior, and
cycle position without replacing the skill's base behavior. A hero cannot fill a slot with an
affinity they do not hold.

## Draft design principles

- Skills are intended to be the largest capability lever; attributes widen or narrow their output.
- Levels are permission more than power: each gained level grants one intrinsic combat-attribute
  point, not learned competence by itself.
- Skill, material, and equipment rarity is fixed. Hero star rank alone can rise.
- Stars measure starting endowment, level cap, and later nurture, not learning rate, skill ceiling,
  or human worth.
- Practice records repetition, quality, and variety instead of assuming growth.
- No progression route is absolutely closed: weak routes remain possible at sharply diminished
  returns.

These principles are expanded in:

- [Attributes and training](attributes-and-training.md)
- [Affinities](affinities.md)
- [Skills, mastery, ladders, and merging](skills-and-ladders.md)
- [Heroes, stars, levels, learning profiles, and summoning](heroes-stars-and-summoning.md)
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
