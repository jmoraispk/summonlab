# Equipment rarity, craftsmanship, and weight

Wiki ID: `mechanics.equipment.rarity-weight`

Design status: **draft**.

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

Weight is the link between equipment and attributes. A hero's weight tolerance is driven by Might,
supported by Vitality in the source draft.

| Class | Typical wearer | Penalty if over tolerance |
| --- | --- | --- |
| **Light** | Dagger, Robes, Accessory | Rarely an issue |
| **Medium** | One-handed Weapon, Spear, Bow, Light Armour, Shield, Staff, Tool | Movement and evasion loss |
| **Heavy** | Two-handed Sword, Axe, Mace, or Heavy Armour | Movement, evasion, attack speed and initiative loss |
| **Very Heavy** | Exceptional named Equipment only | Severe penalties across all Agility-driven stats |

**Weightless Craft** (Forging, Rare) lowers an item one weight class at the same protection level,
which is one of the main reasons a roster wants a good armoursmith.

## Open implementation questions

- Bind Dexterity, Vitality, and the abbreviated weapon attributes to the supplied shared attribute
  vocabulary.
- Define whether weight is per item, total loadout, carried inventory, or some combination.
- Define exact tolerance, penalty curves, stacking, and how Weightless Craft affects reservations
  and visuals.
- Define the shared item-difficulty and material-difficulty scales, the Forging margins for Fine and
  Masterwork, and the bounded benefit improvement for craftsmanship beyond S.
