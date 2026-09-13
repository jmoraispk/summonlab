# Affinities

Wiki ID: `mechanics.progression.affinities`

Affinities are elemental identities and skill-expression inputs, not attribute classes. The four
base affinities are Fire, Earth, Wind, and Water; Unaligned means no affinity. Dual-affinity content
may combine base elements under its own authored rules.

| Affinity | Mild thematic association |
| --- | --- |
| Fire | Strength |
| Wind | Agility |
| Earth | Vitality |
| Water | Magic |

The relationship is intentionally mild. `combat-rules-v1` caps a matching-affinity nudge at 10% of
the matching attribute contribution, not 10% of final damage or another total. Attributes do not
grant affinities, affinities do not grant automatic attribute points, and a hero is never locked out
of an off-association build. Later rules can weaken, replace, or remove these pairings without a hero
state migration.

An affinity belongs to the hero. A skill may provide an authored slot through which the affinity is
expressed, including elemental rider, status, environmental, or cycle behavior. Skill mastery and
affinity rank remain separate progression tracks.

Affinity awakening is not tied to mutable stars because stars are immutable. Exact acquisition,
rank growth, dual-affinity rarity, and awakening triggers remain separate authored decisions.

## 2.2 The four affinities

These canonical identities and statuses remain future combat content; the table is not an attribute
conversion table.

| Affinity | Colour | Character | Status | Behaviour |
| --- | --- | --- | --- | --- |
| **Fire** | Vermilion | Expansion, aggression, consumption | **Burn** | Damage over time; intensity stacks rather than duration |
| **Earth** | Ochre-brown | Stability, endurance, weight | **Weight** | Slows actions and supports authored stagger or Break effects |
| **Wind** | Pale green-grey | Motion, severance, displacement | **Lacerate** | Cutting damage scaling with target movement |
| **Water** | Deep blue | Flow, depth, patience | **Chill** | Reduces action speed and Mana recovery; may escalate toward torpor |

## 2.4 The overcoming cycle

**Overcoming: Earth → Water → Fire → Wind → Earth.**

An overcoming relationship may later modify elemental damage, proc chance, or status duration. It
does not change attribute ownership or the awakening conversion table. Neutral, same-affinity,
unaligned, and off-cycle behavior still requires versioned combat rules before it becomes runtime
canon.

![Affinity overcoming cycle: Earth → Water → Fire → Wind → Earth.](../../../../assets/enemies/wiki/affinities/reference/element-cycle-v2.svg)

## 2.10 Dual affinities

The closed six-pair vocabulary remains accepted design direction. Exact acquisition, stability,
rank, and combat strength are deferred.

| Dual | From | Colour | Character | Status |
| --- | --- | --- | --- | --- |
| **Mist** | Water × Fire | Near-white grey | Vapour and concealment | **Shroud** — accuracy loss and broken target lock |
| **Lightning** | Fire × Wind | Gold-violet | Discharge and instantaneity | **Shock** — cast interruption and nearby chaining |
| **Sand** | Wind × Earth | Tan-ochre | Erosion and abrasion | **Abrade** — armour shred and blind |
| **Rot** | Earth × Water | Sickly green | Decay and waterlogged ground | **Decay** — stacking degeneration that ignores armour |
| **Magma** | Fire × Earth | Molten red-black | Liquid stone and burning crust | **Melt** — armour destruction and ground denial |
| **Ice** | Water × Wind | Pale cyan | Contraction and brittleness | **Freeze** — hard stop and increased stagger taken |

![Affinity pairing matrix for four bases and six duals.](../../../../assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg)

## References

- [Attributes](../attributes.md)
- [Progression](README.md)
- [ADR 0073](../../../decisions/0073-awakening-and-multi-path-progression.md)
