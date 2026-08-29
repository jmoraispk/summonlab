# Affinities

Wiki ID: `mechanics.affinities`

Design status: **draft**. The shared concept is accepted; the exact roster, values, interactions, and
proc formulas remain open for simulation and review.

Affinities describe how a hero, monster, skill, item, or environment resonates with a family of
mechanical expressions. Heroes and monsters use the same affinity definitions. An affinity can
influence derived attributes, unlock or strengthen skill behavior, interact with environments, and
contribute a bounded chance to typed effects such as burning, cutting, or slowing.

An affinity is not:

- a personality, moral alignment, culture, race, or measure of worth;
- a complete skill that acts without an action or trigger;
- a damage color whose only purpose is a weakness chart;
- permission for generated prose to create an unregistered status effect.

## Initial pages

- [Fire](fire.md) — candidate burn application and heat/force/control expression.
- [Wind](wind.md) — candidate cutting application and speed/precision expression.
- [Wood](wood.md) — candidate slowing/binding application and growth/endurance expression.

These examples capture the current brainstorming direction. Their exact attribute matches and
numbers are proposals, not accepted balance.

## Domain model

```text
AffinityDefinition (immutable content)
  affinityId · version · tags · verbs · visual language
  allowed attribute contributions · allowed effect contributions
  environment interactions · counters · incompatibilities · caps

AffinityProfile (actor/item/environment state)
  sourceId · affinityId · resonance band/value · provenance
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

Affinities modify a derived action rather than silently rewriting base attributes. A matching
affinity may contribute to:

- force or penetration;
- speed, initiative, or precision;
- stamina, recovery, or resistance;
- concentration, duration, or area control;
- learning rate or fusion compatibility for matching skills.

Each definition must name which expressions are allowed, their context, scaling source, cap, and
tradeoff. Possessing more affinities must not grant free universal stats.

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

“Burn,” “cut,” and “slow” are candidate typed statuses. Their formulas are intentionally absent
until the combat/action economy is defined.

## Race, culture, and individuality

A monster species may have a typical affinity distribution because of physiology, origin, or
environment. That is content, not a universal personality or morality rule. Individuals and
variants may differ. Hero affinities remain independent of ethnicity, gender, body, culture,
personality, intelligence, rarity, and obedience.

## Skill fusion

Affinities are aspects in the
[skill lattice](../../../system-architecture/systems/progression-and-skills.md).
Fusion may preserve, combine, suppress, or transform registered aspects, but it cannot mint effect
budget. A Fire + Wind recipe might qualify for an authored combustion or cutting-flame definition;
if no definition/template passes validation, the combination is unavailable rather than improvised.

## Visual direction

Affinity art should communicate material behavior and motion—embers, pressure, leaves, fibers,
condensation, distortion, residue—not cover every character in a colored glow. Visual intensity
reflects the current action/effect state, not moral worth or rarity.

## Open questions

- What is the complete affinity roster and its taxonomy?
- Are resonance values continuous, banded, or both?
- Can affinities be learned, only awakened, or changed through evolution/synthesis?
- Should opposing affinities cancel, transform, or coexist?
- Which effects belong to affinities versus skills, weapons, or environments?
- What proc frequency keeps effects meaningful without dominating every action?
