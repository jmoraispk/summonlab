# Attributes

Wiki ID: `mechanics.attributes`

Design status: **implemented for `character-v2` and `engine-v27`**. Historical schemas remain
replayable under their original rules.

Attributes are visible combat capabilities. They do not determine intelligence, morality,
obedience, personality, decision quality, social worth, or the value of a life.

## Canonical vocabulary

| Sheet | Full name | Owns | Does not own |
| --- | --- | --- | --- |
| `STR` | **Strength** | Physical power, carrying/load tolerance, explicit heavy requirements | Accuracy, critical rate, mitigation, cadence |
| `AGI` | **Agility** | Readiness, movement, evasion, bounded relative speed | Learned accuracy, unrestricted actions, critical rate |
| `VIT` | **Vitality** | Maximum Health and modest natural recovery | Armour, resistance, immunity, equipment eligibility |
| `MAG` | **Magic** | Magical power, maximum Mana, modest saturating Mana recovery | Morale, learning, control duration, decision quality |

The character-sheet order is `STR`, `AGI`, `VIT`, `MAG`; normal prose uses the full names. There is
no Body/Mind split. Dexterity and Intellect are not primary attributes, and Magic replaces the
earlier Spirit label because it describes the stat's purpose directly.

## Intrinsic, effective, and awakened values

Generated base values plus typed permanent growth form the intrinsic attributes. Only modifiers
whose declared scope matches a calculation can create its effective input. Awakening then converts
the applicable Strength, Magic, or Vitality value through the hero's current level tier.

The ten current Power rates are `1.0, 1.2, 1.4, 1.8, 2.2, 2.6, 3.2, 3.8, 4.4, 5.0`; Health per
Vitality is `5, 6, 7, 9, 11, 13, 16, 19, 22, 25`. See
[Attributes and training](progression/attributes-and-training.md) for the complete table.

Armour, named resistance, accuracy, evasion, critical probability, action cadence, flat equipment,
and skill mastery remain separate. An awakening never refills current Health.

## Affinity interaction

Fire/Strength, Wind/Agility, Earth/Vitality, and Water/Magic are mild thematic associations. They do
not grant attribute ownership or automatic growth. The current matching-affinity nudge is capped at
10% of the matching attribute contribution and is deliberately separable; later rules may weaken or
remove the relationship without changing attribute state.

## Learning and compatibility

The hidden bounded learning profile and domain aptitudes remain separate from visible attributes and
are omitted from player-facing projections. New characters entering `legacy-auto-v1` use a
mode-local compatibility projection; old stored fields and replay hashes are never rewritten.

## References

- [Progression](progression/README.md)
- [ADR 0073](../../decisions/0073-awakening-and-multi-path-progression.md)
- [Overgeared research](../research/attribute-systems/overgeared/README.md)
