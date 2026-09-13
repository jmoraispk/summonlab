# Overgeared combat math and stat awakenings

Wiki ID: `research.attribute-systems.overgeared.combat-math`

The source never publishes one complete damage formula. This page preserves the reconstructed
shape, its known evidence, and the conclusions useful to Summonlab; exact constants are illustrative
or source-dependent.

## Published conversion evidence

| Stat | Documented per-point progression | Important caveat |
| --- | --- | --- |
| Strength | Attack power `0.1 → 0.2 → 0.3 → 0.7 → 0.8`; Health `3 → 5 → 5 → 7 → 9` through level 400 | Some chapters revise the third/fourth awakening values |
| Stamina | Later tiers reach `20/25/30` Health and `0.2/0.9/1.2` defense per point | Basic and early rows are incomplete; stat and expendable resource share a translated name |
| Agility | Every 1,000 points changes attack speed by `0.1`; 3,000 raises maximum movement speed | No complete awakening ladder is published |
| Intelligence | Published rows include `0.5`, `2.0`, then `1.2` magic power and a `6` Mana plateau | The apparent backwards step is explicitly unresolved |

This uneven record is why Summonlab adopts the table-driven mechanism but not these numbers. Our
ten authored rows are complete up front, reach exactly `5×` power and Health conversion at levels
900–999, and are content-hashed so later nerfs create a new replayable rules table.

## Reconstructed equation shape

```text
attribute power = primary attribute × current conversion rate
base power      = attribute power + special-stat power + flat gear power
total power     = base power × authored power modifiers
raw damage      = total power × skill coefficient + post-multiplier flat damage
final damage    = raw damage × defense mitigation × critical modifier
DPS             = final damage ÷ attack interval
```

The useful separation is between additive attribute/special/gear power, multiplicative skill or
buff terms, target mitigation, and throughput. Overgeared also demonstrates why post-multiplier
flat damage and attack-speed gear require their own budgets: their value changes mainly with hit
frequency.

## Summonlab decision

- Strength and Magic share the versioned power-rate table; Vitality uses its own Health table.
- Agility owns readiness, movement, evasion, and bounded relative speed, not generic physical power.
- Armour, resistance, accuracy, critical chance, cadence, flat equipment power, and skill mastery
  are not awakened.
- Low-grade fixed effects may remain useful through reliability, cost, compatibility, or utility,
  but can be superseded over the very long progression horizon.
- Overland movement retains an explicit `1.4 m/s` floor; no equation multiplies that baseline down.

See [Summonlab attributes](../../../mechanics/progression/attributes-and-training.md) and the checked
[balance evidence](../../../../evidence/progression-balance-v1.json).

## Sources

- [Strength](https://overgeared.fandom.com/wiki/Strength)
- [Agility](https://overgeared.fandom.com/wiki/Agility)
- [Stamina (Stat)](https://overgeared.fandom.com/wiki/Stamina_\(Stat\))
- [Intelligence](https://overgeared.fandom.com/wiki/Intelligence)
- User-supplied research component: `combat_math_reference (1).md`, received 2026-09-12
