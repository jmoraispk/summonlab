# Attributes

Wiki ID: `mechanics.attributes`

Design status: **implemented for new `character-v2` characters; `engine-v26` consumes their
intrinsic growth and combat training while historical schemas remain replayable**.

Attributes are visible, combat-first capabilities used by heroes and mechanically comparable
creatures. They do not determine intelligence, morality, obedience, social worth, personality, or
the value of a life.

## Canonical vocabulary

New characters have four intrinsic attributes, each represented by an integer from 1 through 100:

| Attribute | Owns | Does not own |
| --- | --- | --- |
| **Might** | physical magnitude, carrying capacity, equipment-load tolerance, explicit heavy-equipment requirements | accuracy, critical rate, general mitigation, action cadence |
| **Vitality** | maximum Health and modest natural Health regeneration | armour mitigation, named resistance, status immunity, equipment eligibility |
| **Agility** | readiness, movement, evasion, and a bounded relative-speed term in hit contests | learned accuracy, critical rate, unrestricted extra actions |
| **Spirit** | magical magnitude, maximum Mana, and modest saturating Mana regeneration | morale, learning rate, control duration, mental resistance, decision quality |

The former six-stat proposal is retired for new mechanics: Dexterity and Intellect are not
attributes, universal poise does not exist, and base attributes do not grant general mitigation.
Spirit is the combat-magic attribute rather than a container for morale, control, or learning.
Historical state may still contain its original fields, which remain readable only under the
ruleset that created it.

## Intrinsic and effective values

Persistent capability and situational effects are separate:

```text
generated base + append-only permanent growth receipts = intrinsic attribute

intrinsic attribute + modifiers valid for this check = effective attribute
```

Level allocation changes intrinsic values through typed receipts. Equipment,
enchantments, food, conditions, statuses, skills, and physiology may provide effective modifiers.
Each modifier names one scope—such as physical damage, magical damage, Health regeneration,
equipment load, movement, or evasion—plus its source, stacking rule, cap, duration, and rules
version. A bonus for one scope never silently modifies every formula that uses the same attribute.

Progression requirements and history consume intrinsic values. Resolution consumes the effective
value for the current action. Effective values currently clamp to the versioned `1..200` band;
intrinsic values remain `1..100`.

## Combat ownership

- Might scales physical magnitude; Spirit scales magical magnitude.
- Vitality sets maximum Health and contributes modestly to natural recovery.
- Spirit sets maximum Mana and contributes modestly, with saturation, to Mana recovery.
- Agility drives readiness accumulation and contributes a bounded relative-speed term to the
  production `agent-readiness-v1` hit contest.
- General mitigation comes from armour after explicit penetration and is capped below 75% by
  `combat-rules-v1`.
- `cut`, `pierce`, `impact`, `burn`, `frost`, `shock`, and `arcane` resistances come from authored
  equipment, passive skills, or physiology. They are additive typed receipts capped at 75%.
- Accuracy and reliability belong to each skill's authored mastery progression; the current
  readiness resolver consumes the accuracy step, while reliability remains reserved. Critical
  opportunity belongs to skills, target state, positioning, and explicit bonuses.

Health and Mana are the only universal resource bars. There is no stamina or universal poise bar;
particular content may own a visible Break meter explicitly.

## Learning is separate

Learning is not a fifth visible attribute. New character manifests hold a hidden bounded cognitive
learning score and separate domain aptitudes for martial, magical, crafting, survival, and social
practice. The cognitive factor affects only evidence marked comprehension-heavy and can alter that
practice gain by at most ten percent in either direction. Domain aptitude, teaching, facilities,
motivation, condition, variety, and repetition decay then contribute independently.

The player sees evidence from practice and mentors rather than an IQ number. The hidden score never
changes model reasoning, legal-action quality, decision quality, human worth, or eventual access.
Player-facing projections omit both the learning profile and the invertible cognitive factor in its
internal receipts.

## Affinity interaction

The four base affinities retain one thematic association: Fire/Might, Earth/Vitality,
Wind/Agility, and Water/Spirit. `combat-rules-v1` caps a matching-affinity nudge at 10% of the
matching attribute's contribution—not 10% of final damage, durability, or another outcome. The
current balance harness treats the action formula and off-affinity matchups as promotion candidates;
it does not invent an automatic level-up grant. See [Affinities](progression/affinities.md).

## Compatibility

New `character-v2` records persist the capability profile separately from personality and history.
`engine-v26` derives current intrinsic attributes from that generated profile plus its verified
growth-receipt chain; it never treats the generated numbers as if later allocations had not
happened. When a new character enters `legacy-auto-v1`, that mode alone projects the four
attributes onto the old aptitude shape. Old events, state hashes, and replays are never rewritten.

## References

- [Attributes and training](progression/attributes-and-training.md)
- [Skill framework](skills/framework.md)
- [Equipment](equipment/README.md)
- [ADR 0072](../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
- [Progression and skills architecture](../../system-architecture/systems/progression-and-skills.md)
