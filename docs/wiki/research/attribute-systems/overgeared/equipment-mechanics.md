# Overgeared equipment mechanics

Wiki ID: `research.attribute-systems.overgeared.equipment-mechanics`

The useful model is a layered item sheet. Rating supplies a budget; flat attack/defense, durability,
attributes, derived values, percentage modifiers, weight, and requirements make the load-bearing
numeric layer. Granted skills, procs, drawbacks, sets, growth, and non-combat effects create item
identity.

## Reusable lessons

| Pattern | Design value |
| --- | --- |
| Level + attribute + mastery requirements | Equipment can express build identity without requiring a hard class tag |
| Real drawbacks on high-tier gear | Higher rarity can mean more consequential properties rather than strictly better numbers |
| Attack-speed effects on gear | Throughput stays a separately priced multiplier rather than leaking into every damage term |
| Set and growth properties | Completion and long-term attachment can coexist with ordinary item replacement |
| Flat or ranged weapon power | Gear remains legible in the additive layer before skill multipliers |
| Meta properties | Crafting or mastery value can compete with immediate combat value for the same slot |

For Summonlab, Strength owns load tolerance and explicit heavy-item requirements, but equipment
power remains separate from awakened attribute power. High-tier items should earn identity through
conditionals, tradeoffs, and granted capabilities rather than simply multiplying every number.

Source: user-supplied `overgeared_equipment_mechanics.md`, received 2026-09-12.
