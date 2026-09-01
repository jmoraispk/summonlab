# Equipment rarity, craftsmanship, and weight

Wiki ID: `mechanics.equipment.rarity-weight`

Design status: **draft**.

## Material band plus craftsmanship

Material rarity and item rarity are related but not identical. A material sets the band an item is
likely to land in. The smith's craftsmanship moves it within and beyond that band.

| Craft quality | Result | Driven by |
| --- | --- | --- |
| **Crude** | One tier *below* the material band | Low Forging mastery, poor fuel, improvised tools |
| **Standard** | The material band | Ordinary competent work |
| **Fine** | One tier above | High Forging mastery, Tempering, good fuel |
| **Masterwork** | Two tiers above | Master-tier Forging, high Dexterity, Master's Mark, excellent tools |

A masterwork copper blade is described in the source as genuinely Uncommon, and an exceptional one
as able to reach Rare. A crude steel blade is merely Uncommon. This is why a settlement with a
great smith and poor mines can still outfit a party well, and why raw material access is not the
whole story.

The stated ceiling is material band plus two, capped at S. Copper tops out at Rare no matter who
forges it. Reaching Legendary requires both Legendary-adjacent material and Godsmithing.

Once forged, the item's rarity is fixed forever. Nothing raises it.

> Draft conflict: the table's Masterwork `+2` rule would make F-band Copper into D-band Rare, not
> Uncommon. “Exceptional” is not one of the four listed craft qualities. This needs an explicit
> correction before implementation.

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
| **Light** | Dagger, Bow, Body-compatible unarmed equipment, casters | Rarely an issue |
| **Medium** | Sword, Spear, Crossbow, Shield | Movement and evasion loss |
| **Heavy** | Greatsword, Halberd, Polehammer, Tower Shield | Movement, evasion, attack speed and initiative loss |
| **Very Heavy** | Bulwark builds only | Severe penalties across all Agility-driven stats |

**Weightless Craft** (Forging, Rare) lowers an item one weight class at the same protection level,
which is one of the main reasons a roster wants a good armoursmith.

## Open implementation questions

- Bind Dexterity, Vitality, and the abbreviated weapon attributes to the supplied shared attribute
  vocabulary.
- Define whether weight is per item, total loadout, carried inventory, or some combination.
- Define exact tolerance, penalty curves, stacking, and how Weightless Craft affects reservations
  and visuals.
- Define the exact meaning of `F+`, `E+`, and the other minimum-band notation.
