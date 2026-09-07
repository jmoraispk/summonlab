# Attributes and training

Wiki ID: `mechanics.progression.attributes-training`

Design status: **four-attribute foundation implemented; idle schedules and broader training loops
remain separate design work**.

## Four combat-first attributes

New characters use Might, Vitality, Agility, and Spirit on a `1..100` intrinsic scale.

| Attribute | Primary territory | Failure without it |
| --- | --- | --- |
| **Might** | physical magnitude, carrying, equipment-load tolerance, explicit heavy-item requirements | a technique connects but lacks force or the loadout is unusable |
| **Vitality** | maximum Health and modest natural Health recovery | mistakes consume a smaller Health reserve and take longer to recover from |
| **Agility** | readiness, movement, evasion, bounded relative speed in hit contests | repositioning and avoidance are weaker |
| **Spirit** | magical magnitude, maximum Mana, modest saturating Mana recovery | magical output and available technique resource are lower |

Attributes describe broad combat capability. Skill mastery describes learned execution. Personality,
history, relationships, knowledge, morale, motivation, and current condition remain separate systems.
The retired Dexterity/Intellect proposal is not used for new state. Universal poise, attribute-based
mitigation, Spirit-based morale/control/learning, and Vitality armour requirements are also removed.

## Intrinsic growth and scoped modifiers

```text
generated capability + validated permanent receipts = intrinsic attribute
intrinsic attribute + valid action-scoped modifiers = effective attribute
```

Every permanent change is append-only evidence. New `engine-v25` heroes begin at level 1 with zero
unspent points. A transition from level `L` to `L+n` grants exactly `n` points. Allocation spends one
point on one named attribute and records the hero, before/after intrinsic values, source level,
command, rules version, and game time. It never rewrites the generated character profile.

The initial rule is therefore **one freely allocated attribute point per level gained**. It is not a
copy of an old six-stat budget. Each receipt must continue the prior intrinsic value exactly, and
intrinsic attributes cannot exceed 100.

Equipment, food, enchantments, conditions, statuses, skills, and physiology use a different typed
modifier contract. Each modifier names its scope and duration. An equipment-load Might modifier,
for example, can change load tolerance but cannot satisfy an item's intrinsic-Might requirement or
increase physical damage.

## Health and Mana

Health and Mana are the only universal bars. `combat-rules-v1` currently derives:

```text
maximum Health = 100 + 4 × Vitality
maximum Mana   = 40 + 2 × Spirit
```

Allocating Vitality or Spirit raises only the corresponding maximum; it does not heal or refill the
current resource.

Natural Health recovery is deliberately modest:

- safe-rest recovery is `2 + floor(Vitality / 10)` per recovery application;
- combat recovery is one fifth of that safe-rest amount;
- combat recovery pauses for 50 ticks after damage;
- natural recovery is zero while Downed and cannot revive a hero;
- it cannot repair an injury;
- healing skills, consumables, and safe rest remain stronger recovery sources.

Mana recovery receives a small Spirit bonus that saturates rather than growing without bound.
Combat Mana recovery is half the safe-rest value. It is also zero while Downed or when resolving
injury repair. Equipment, stances, passives, and skill effects remain the stronger specialization
levers.

The committed balance evidence compares recovery and peer damage on a common candidate timeline.
That harness is a promotion gate, not a claim that its attack cadence is already production combat.

## Damage, defence, and accuracy

- Might alone supplies base-attribute scaling for physical magnitude.
- Spirit alone supplies base-attribute scaling for magical magnitude.
- Armour supplies general reduction after penetration. The curve is monotonic and
  `combat-rules-v1` caps it at 7,499 basis points, so armour alone never reaches 75% reduction.
- Authored `cut`, `pierce`, `impact`, `burn`, `frost`, `shock`, and `arcane` resistance receipts
  stack additively up to the 7,500-basis-point global cap.
- Skill mastery owns authored accuracy and reliability steps. Agility's future relative-speed term
  is bounded and secondary; the current harness formula remains a benchmark candidate until the
  readiness combat plan ships it.
- Critical chance is never derived from a base attribute.

There is no universal poise. A boss, shield, stance, or skill may explicitly own a visible Break
meter without creating a hidden resource on every combatant.

## Learning profile

The learning profile is generated independently from combat attributes and is hidden by default. It
contains:

- a bounded cognitive-learning score;
- martial, magical, crafting, survival, and social domain aptitudes.

For comprehension-heavy evidence only, the cognitive score maps to a `0.90..1.10` factor. Ordinary
practice uses a neutral `1.00` cognitive factor. Domain aptitude maps separately to `0.80..1.20`,
then teaching quality, facility quality, motivation, condition, variety, and repetition decay are
applied before one final deterministic rounding step.

This preserves a small, real general learning difference without pretending it is decision quality.
The player sees outcomes and mentor observations, not an IQ number. Public character/proof
projections omit the full learning profile, and future player-facing learning receipts must also
redact the invertible cognitive factor.

## Practice and idle progression

The capability contract permits permanent-training receipts, but this foundation does not decide
how heroes schedule their days, how much they are willing to practise, or what they accomplish while
the player is away. Those “human” idle-gain rules require their own design: time, motivation,
relationships, needs, facilities, teaching, variety, fatigue, and personal choice should matter
without turning one hidden number into destiny.

Until that design lands, do not treat a theoretical twelve-hour training assignment, passive slot,
or repetition-yield curve as canonical runtime behavior.

## References

- [Attributes](../attributes.md)
- [Affinities](affinities.md)
- [Skill framework](../skills/framework.md)
- [Equipment rarity and weight](../equipment/rarity-and-weight.md)
- [Four-attribute implementation plan](../../../superpowers/plans/2026-09-06-four-attribute-legacy-combat.md)
