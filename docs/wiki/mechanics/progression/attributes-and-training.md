# Attributes and training

Wiki ID: `mechanics.progression.attributes-training`

Design status: **implemented for `engine-v27`**.

## The four attributes

| Sheet | Full name | Primary territory |
| --- | --- | --- |
| `STR` | **Strength** | Physical power, carrying/load tolerance, and explicit heavy-item requirements |
| `AGI` | **Agility** | Readiness, movement, evasion, and bounded relative speed |
| `VIT` | **Vitality** | Maximum Health and modest natural Health recovery |
| `MAG` | **Magic** | Magical power, maximum Mana, and modest saturating Mana recovery |

This order is canonical on character sheets: `STR`, `AGI`, `VIT`, `MAG`. Full names remain normal
prose. Dexterity is not a fifth primary attribute, and Spirit is not the magic attribute. There is
no Body/Mind grouping.

Attributes describe broad capability. Skill mastery describes learned execution. Personality,
knowledge, morality, relationships, decision quality, and the hidden bounded learning profile stay
separate.

## Intrinsic growth

```text
generated capability + typed permanent growth = intrinsic attribute
intrinsic attribute + valid scoped modifiers = effective attribute
```

Each gained level grants exactly the hero's immutable star rating in unallocated points. Direct
growth can also come from typed allocation, training, achievement, consumable, or cultivation
claims. All mutations are receipt-backed. An equipment-load modifier cannot silently change damage,
and an effective modifier cannot satisfy an intrinsic requirement unless its scope explicitly says
so.

## Awakening conversions

Awakening tier is `floor(level / 100)`, bounded to tiers 0–9. The current tier applies to the full
applicable attribute value, including old allocations and non-level growth.

| Levels | Tier | Power per STR/MAG | Health per VIT | Relative power |
| ---: | ---: | ---: | ---: | ---: |
| 1–99 | 0 | 1.0 | 5 | ×1.0 |
| 100–199 | 1 | 1.2 | 6 | ×1.2 |
| 200–299 | 2 | 1.4 | 7 | ×1.4 |
| 300–399 | 3 | 1.8 | 9 | ×1.8 |
| 400–499 | 4 | 2.2 | 11 | ×2.2 |
| 500–599 | 5 | 2.6 | 13 | ×2.6 |
| 600–699 | 6 | 3.2 | 16 | ×3.2 |
| 700–799 | 7 | 3.8 | 19 | ×3.8 |
| 800–899 | 8 | 4.4 | 22 | ×4.4 |
| 900–999 | 9 | 5.0 | 25 | ×5.0 |

```text
physical attribute power = effective STR × current power rate
magical attribute power  = effective MAG × current power rate
maximum Health           = capacity-scoped effective VIT × current Health rate
```

An awakening recomputes maximum Health without refilling current Health. Armour, resistance,
accuracy, evasion, critical chance, action cadence, movement ceilings, flat equipment power, skill
mastery, affinity ratios, and explicitly flat skill effects do not receive this multiplier.

These numbers are versioned balance data. They can be reduced later by publishing a new table and
rules hash; the stored attributes and progression schema do not change.

## Training and learning

Training produces typed direct-growth or skill-practice evidence rather than pretending to be a
level. The hidden learning profile remains bounded and separate from visible attributes. It can
modestly affect validated comprehension-heavy practice but never intelligence, worth, access, or
decision quality, and player projections omit it.

## References

- [Attributes](../attributes.md)
- [Experience and levels](experience-and-levels.md)
- [Stars](stars.md)
- [ADR 0073](../../../decisions/0073-awakening-and-multi-path-progression.md)
