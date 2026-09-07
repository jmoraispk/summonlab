# Equipment rarity, craftsmanship, and weight

Wiki ID: `mechanics.equipment.rarity-weight`

Design status: **runtime-v1 craftsmanship foundation; engine-v25 load profiles and pure eligibility
evaluator implemented; production mission integration pending**.

Runtime-v1 implements only the Standard row: one normalized material lot creates a `+0` item whose
final rank equals its material rank. Fine/Masterwork thresholds, benefits, quality visuals, weight
penalties, and the property table below remain explicit design work rather than active mechanics.
Engine-v25 separately implements integer item load, Might tolerance, and explicit requirements.

## Material rank plus craftsmanship

A material supplies the item's base rank. The item design and material each contribute difficulty;
together they set the Forging level required to make that combination. The smith's Forging level
relative to that difficulty determines craftsmanship.

| Forging result | Craftsmanship | Rank effect |
| --- | --- | ---: |
| Below the combined difficulty | Cannot craft successfully | — |
| Meets the combined difficulty | **Standard** | `+0` |
| Clearly exceeds the combined difficulty | **Fine** | `+1` |
| Greatly exceeds the combined difficulty | **Masterwork** | `+2` |

```text
final item rank = material rank + craftsmanship bonus, capped at S
```

An Iron item begins at E: Standard remains E, Fine becomes D, and Masterwork becomes C. A Fine
Starmetal item rises from A to S. An S-rank material cannot create a rank above S; excess
craftsmanship instead improves its S-rank benefits within the eventual benefit table.

Once made, the item's final rank is fixed. Enchantment and later use may add or change properties,
but they do not recalculate rank.

## What each rarity band grants

| R | Typical properties |
| --- | --- |
| **F** Common | Base stats only |
| **E** Uncommon | Base stats, one minor property, possibly one enchantment slot |
| **D** Rare | Better base stats, one or two properties, one to two slots |
| **C** Epic | Strong base stats, a distinctive property, two slots, possible set membership |
| **B** Mythic | Two to three slots, a rare property, likely set membership, occasional attribute bonus |
| **A** Fabled | Three slots, an attribute bonus, and a real chance of granting an active skill |
| **S** Legendary | Grants an active skill, multiple attribute bonuses, and a property nothing else has |

Attribute bonuses stay rare by design. Most armour gives health and mitigation; gear should
supplement a build, not define one.

## Weight classes

Weight is the link between equipment and attributes. The shipped pure evaluator considers a
loadout eligible only when total equipped load does not exceed effective Might in the
`equipment-load` scope. A permanent item requirement reads intrinsic Might instead. Vitality
contributes to neither check and is never an armour gate.

| Class | Typical equipment | Pure evaluator result if over tolerance |
| --- | --- | --- |
| **Light** | Dagger, Robes, Accessory | Rarely an issue |
| **Medium** | One-handed Weapon, Spear, Bow, Light Armour, Shield, Staff, Tool | loadout is ineligible |
| **Heavy** | Heavy weapons or Heavy Armour | loadout is ineligible |

The combat profile uses explicit per-item load rather than deriving load from the label at runtime:

| Equipment | Load |
| --- | ---: |
| Sword / Dagger / Spear / Bow | `12 / 6 / 16 / 14` |
| Axe / Mace / Shield / Staff | `20 / 20 / 16 / 14` |
| Heavy Armour, Head / Torso / Legs / Boots | `12 / 28 / 22 / 10` |
| Light Armour, Head / Torso / Legs / Boots | `6 / 14 / 11 / 5` |
| Robes, Head / Torso / Legs / Boots | `2 / 4 / 3 / 2` |

Current heavy-weight profiles require intrinsic Might 35; Heavy Armour requires intrinsic Might 45
and `armour-training`. No production profile uses a Vitality requirement. The pure evaluator marks
an over-tolerance loadout ineligible rather than calculating the movement, evasion, or readiness
penalties described by earlier drafts. Production gameplay has not yet integrated this check, so
the current `legacy-auto-v1` runner does not reject a loadout on this basis.

**Weightless Craft** (Forging, Rare) lowers an item one weight class at the same protection level,
which is one of the main reasons a roster wants a good armoursmith.

## Open implementation questions

- Decide whether a later rules version replaces ineligibility with bounded movement, evasion, or
  readiness penalties.
- Define whether carried inventory contributes separately from equipped load.
- Define how Weightless Craft changes explicit profile load, reservations, and visuals.
- Define the shared item-difficulty and material-difficulty scales, the Forging margins for Fine and
  Masterwork, and the bounded benefit improvement for craftsmanship beyond S.
