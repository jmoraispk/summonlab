# Affinities

Wiki ID: `mechanics.affinities`

Design status: **accepted roster with explicit tuning gaps**. Fire, Earth, Wind, and Water are
the four base affinities. Exact proc rates, combat modifiers, awakening odds, manifestation
thresholds, and Dominion dimensions remain open for simulation and review.

The supplied [progression affinity revision](../progression/affinities.md) replaces the former Wu
Xing roster and retires Resonance as a progression measure. Visual production now targets one
Normal (unaligned) form plus Fire, Earth, Wind, and Water variants for every enemy class. Existing
Wood and Metal studies remain legacy candidates until their review evidence is migrated or retired;
they are not approved affinity variants.

An affinity is a property of a hero or monster's body and spirit. Heroes and monsters use the same
definitions and progress from Rank 0 through V. Skills at grade B and above provide additive slots
that can express an affinity the bearer already holds; skills never lend the bearer an element they
do not possess.

An affinity is not:

- a personality, moral alignment, culture, race, or measure of worth;
- a complete skill that acts without an action or trigger;
- a damage color whose only purpose is a weakness chart;
- permission for generated prose to create an unregistered status effect.

## Supporting pages

- [Fire](fire.md) — Burn, Might nudge, and localized thermal visual language.
- [Wind](wind.md) — Lacerate, Agility nudge, and displacement visual language.
- [Wood](wood.md) — superseded affinity proposal retained as design history; wood remains available
  as a material and visual motif.

The canonical page owns the complete Earth and Water definitions as well as every cycle, rank, dual,
awakening, and manifestation rule.

## Domain model

```text
AffinityDefinition (immutable content)
  affinityId · version · tags · verbs · visual language
  allowed attribute contributions · allowed effect contributions
  environment interactions · counters · incompatibilities · caps

AffinityProfile (actor/item/environment state)
  sourceId · affinityId · rank · rank progress · provenance
  unlocked expressions · temporary modifiers · evolution state

AffinityContribution (one action boundary)
  source profile · action/skill tag · derived attribute contribution
  effect contribution · resistance target · stack/cooldown rule
```

Character/Progression owns a hero's affinity profile and growth. Creature content owns baseline
monster profiles. The affinity catalog owns definitions. Skills, equipment, environments, and
missions consume typed contributions. Presentation consumes visual cues but never infers mechanics
from pixels.

## Deterministic effect resolution

Every affinity-triggered effect follows the same engine path:

1. Resolve a legal action and its skill/equipment tags.
2. Select matching affinity contributions from canonical state.
3. Apply environment and party modifiers.
4. Apply target resistance, immunity, guard, and status rules.
5. Clamp through the definition's chance/effect budget.
6. Make one named seeded draw if chance remains.
7. Emit the applied/resisted event with inputs, result, duration, and source IDs.

No effect occurs because narration said that fire “probably burns.” The resolver records exactly why
it did or did not happen.

## Attribute expression

Affinity has one coupling to base attributes: on level-up, a single affinity nudges its matching
attribute—Fire/Might, Earth/Vitality, Wind/Agility, or Water/Spirit. Dexterity and Intellect remain
outside the elemental system. Dual affinities grant no attribute nudge.

## Status-effect contract

Every status definition needs:

| Field | Purpose |
| --- | --- |
| Status ID/version | Stable executable identity |
| Eligible triggers | Actions that may apply it |
| Chance formula inputs | Affinity, skill, attribute, equipment, environment |
| Resistance/counter | How a target prevents or reduces it |
| Potency/duration | Bounded mechanical consequence |
| Stacking/refresh | Duplicate application behavior |
| Cleansing/decay | How it ends |
| Visual/audio cues | Redundant readable presentation |
| Event payload | Replay and journal evidence |

Burn, Weight, Lacerate, and Chill are the four base typed statuses. Their formulas remain absent
until the combat/action economy is defined; Chill escalates to torpor, while Freeze remains Ice's
dual-affinity signature.

## Race, culture, and individuality

A monster species may have a typical affinity distribution because of physiology, origin, or
environment. That is content, not a universal personality or morality rule. Individuals and
variants may differ. Hero affinities remain independent of ethnicity, gender, body, culture,
personality, intelligence, rarity, and obedience.

## Skill fusion

Affinity slots are authored skill capabilities in the
[progression model](../progression/affinities.md#28-affinity-and-skills). Grade B+ skills may carry
slots, and A/S skills may carry several. When a valid pair is slotted and its dual has been
manifested, the skill may use the dual status and cycle position instead of either parent.

## Visual direction

Affinity art should communicate material behavior and motion—embers, stone stress, displaced dust,
pressure, condensation, flowing water, distortion, and residue—not cover every character in a
colored glow. Visual intensity reflects the current action/effect state, not moral worth or rarity.

## Open questions

- What awakening odds keep single affinities uncommon and dual affinities genuinely rare?
- What manifestation threshold and reaction-stability costs produce a meaningful mastery arc?
- Which proc rates and combat modifiers keep the cycle meaningful without dominating every action?
- What radius and tick rate make Dominion legible without making Rank V arenas unplayable?
