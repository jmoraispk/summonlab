# Equipment materials

Wiki ID: `mechanics.equipment.materials`

Design status: **owner-approved canonical ladder; runtime-v1 integrated**.

Each material family has one canonical material at each rank. The material supplies an item's base
rank. Item and material difficulty determine how hard the item is to make, while the smith's
craftsmanship can raise the finished item's rank above that base.

## Runtime-v1 boundary

All 28 materials below are implemented in `equipment-content-v1`, producing exactly 140 legal
material/form definitions. Standard Forging consumes one normalized lot of the definition's single
rank-bearing material. Current runs receive bounded seeded lots; node discovery, harvesting,
conversion, quantities, replenishment, and the broader Gathering economy remain later work.

Fine and Masterwork are preserved design labels, not enabled forge outcomes. Runtime-v1 creates
Standard (`+0`) items only, so material rank and final rank are currently equal.

## Metal line

Used as the rank-bearing material for most Weapons, Heavy Armor, Shield, Accessory, and many Tools.

| R | Material | Character |
| --- | --- | --- |
| F | **Bronze** | Familiar early weapon alloy; easy to cast and work for first-rank equipment. |
| E | **Iron** | The workhorse. Cheap, plentiful, unremarkable. |
| D | **Steel** | Properly worked. The standard for a serious weapon. |
| C | **Blacksteel** | Dense, dark, resists heat. Favors heavy weapons and plate. |
| B | **Skyiron** | Meteoric. Unnaturally light for its strength; holds enchantment readily. |
| A | **Starmetal** | Weightless to the touch. Every property is superlative. |
| S | **Sunsteel** | Exists in fragments. Cannot be worked without Godsmithing. |

## Hide and scale line

Used for medium and light armor. This is where creature materials matter most: scale from a living
thing is the primary route to armor that protects without weighing.

| R | Material | Source |
| --- | --- | --- |
| F | **Coarse Hide** | Common beasts |
| E | **Hard Leather** | Hardened, worked hide; the standard light armor material |
| D | **Beast Scale** | Reptilian monsters; light for its protection |
| C | **Chitin** | Insectoid monsters; very light, poor against blunt |
| B | **Drakescale** | Lesser dragons; heat resistance, near-plate protection at medium weight |
| A | **Wyrmscale** | True dragons; matches plate at light weight |
| S | **Ancient Dragon Scale** | Ancient dragons; legendary protection at light weight |

## Cloth and fiber

Used for robes, padding, and everything a caster wears.

| R | Material | Character |
| --- | --- | --- |
| F | **Hemp Weave** | Coarse, durable, cheap |
| E | **Wool** | Warmth and modest padding |
| D | **Layered Silk** | Surprisingly good against piercing; favored by duelists |
| C | **Spellweave** | Prepared thread woven to receive and hold magic reliably |
| B | **Moonweave** | Faintly luminous; substantial mana regeneration |
| A | **Starcloth** | The best caster material in existence |
| S | **Fateweave** | Legendary thread worked only by the greatest clothiers |

## Wood and haft

Used for bows, spear and axe hafts, staves, and tool handles.

| R | Material | Character |
| --- | --- | --- |
| F | **Ash** | The standard haft wood; flexes rather than snapping |
| E | **Yew** | The classic bow wood; excellent draw |
| D | **Ironwood** | Nearly as strong as steel at half the weight |
| C | **Heartwood** | Cut from a Treant. Slowly self-repairing. |
| B | **Spiritwood** | Naturally resonant timber that carries enchantment without warping |
| A | **Living Branch** | Still growing. Adapts to its wielder over time. |
| S | **Worldtree Limb** | A living fragment of the Worldtree; cannot be worked without Godsmithing |

## Rank-bearing item mapping

Every durable item has exactly one rank-bearing material. Other physical components remain visible
and necessary, but they do not contribute another rank.

| Material family | Rank-bearing item forms | Natural Domains |
| --- | --- | --- |
| **Metal** | Sword, Dagger, Spear, Axe, Mace, Heavy Armor, Shield, Accessory, and most Tools | Martial and Craft |
| **Wood** | Bow, Staff, and some Tools | Martial, Magical, and Craft |
| **Hide or scale** | Light Armor | All three |
| **Cloth or fiber** | Robes and workwear | Magical and Craft |

The mapping is deliberately fixed. A Spear's metal head supplies rank while its wood shaft is
secondary. A Bow or Staff uses wood for rank. Heavy Armor and Shield use metal, Light Armor uses
hide or scale, and Robes use cloth or fiber.

These are natural Domain fits rather than equip restrictions. The material system does not forbid
a Magical hero from wearing Heavy Armor or a Martial hero from wearing Robes.

## Monster materials

Monster materials are a category rather than a tier line. Rarity is a function of the source
creature's tier and affinity.

| Type | Used for |
| --- | --- |
| **Bone and horn** | Hafts, arrowheads, focuses, light armor reinforcement |
| **Sinew** | Bowstrings, bindings, high-tension components |
| **Organs** | Alchemy, enchantment components |
| **Charged remains** | Elementally saturated tissue from a high-tier monster. Among the best catalysts in the game. |
| **Signature components** | The eyes, heart, core horn, or crown of a *named* creature. Drops rarely even from the correct monster and is required for the strongest monster sets. |

## Cross-system questions

- Creature pages must identify which material claims are physiological, which are encounter loot,
  and whether the source is sapient.
- Define how monster tier maps to the equipment rarity bands and how affinity becomes a typed item
  contribution.
- Define whether “Naga,” Treant, dragons, and other potentially sapient sources can be harvested and
  what consent, death, faction, and social rules apply.
- Define actual weight, protection, resistance, enchantment-conduction, and adaptation effects.
