# Craft and Life Skills

Wiki ID: `skills.craft-and-life`

Domain: **Craft**

Design status: **draft source import**. These definitions preserve the supplied compendium; exact combat values and Living Village availability require validation.

Supersession note: requirements or effects below that mention retired attributes or poise are
preserved migration prose, not active mechanics. [ADR 0072](../../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
requires learned mastery/evidence in place of precision or comprehension stats and permits only
explicitly authored Break mechanics.

## Forging

Craft and Life. Weapons, armor and tools. Determines what every martial family has to work with.

| # | Skill | Label | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Ore Sense** | — | F | P | None | Identifies raw material quality by eye. **Foundation.** |
| 2 | **Simple Smithing** | — | F | C | Ore Sense Novice, forge access | Produces Common weapons and armor |
| 3 | **Sharpening** | — | F | C | Ore Sense Novice | Restores and slightly improves a weapon's edge |
| 4 | **Fittings** | — | F | C | Simple Smithing Intermediate | Straps, buckles, hafts; reduces an item's weight slightly |
| 5 | **Weaponsmithing** | — | E | C | Simple Smithing Intermediate, 500 items forged | Uncommon weapons; better base stats |
| 6 | **Armorsmithing** | — | E | C | Simple Smithing Intermediate, 500 items forged | Uncommon armor; weight becomes controllable |
| 7 | **Fuel Craft** | — | E | C | Ore Sense Expert, Gathering prerequisite | Better fuel; raises the quality ceiling of every forging skill |
| 8 | **Alloying** | — | D | C | Intellect threshold, either smithing at Expert | Combines materials; unlocks Rare output |
| 9 | **Tempering** | — | D | C | Dexterity threshold, 2,000 items forged | Raises the quality roll on any forged item |
| 10 | **Weightless Craft** | — | D | C | Armorsmithing Master, Fittings Master | Armor at a given protection level weighs substantially less |
| 11 | **Runic Foundation** | — | C | C | Alloying Master, Literacy Expert | Forged items gain enchantment slots |
| 12 | **Master's Mark** | — | C | P | Tempering Master, 10,000 items forged | Items bear the smith's mark; permanent bonus to any wielder |
| 13 | **Living Metal** | — | B | C | Runic Foundation Master, rare material, Rank III | Forged items grow with their wielder rather than staying static |
| 14 | **Monster Craft** | — | B | C | Alloying Master, Animal Handling Expert | Works monster materials into equipment with affinity-matched set bonuses |
| 15 | **Soul Forging** | — | A | C | Living Metal Master, composite condition | Binds an item to one hero permanently; it gains an active skill |
| 16 | **Godsmithing** | — | S | C | Soul Forging Master, composite condition | Produces a Legendary item. Once. |

---

## Alchemy

Craft and Life. Potions, poisons, reagents. Feeds every other domain.

| # | Skill | Label | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Reagent Sense** | — | F | P | None | Identifies herbs, fungi and organs by sight. **Foundation.** |
| 2 | **Simple Brewing** | — | F | C | Reagent Sense Novice | Basic healing and stamina drafts |
| 3 | **Preservation** | — | F | C | Reagent Sense Novice | Materials and food keep far longer |
| 4 | **Extraction** | — | F | C | Simple Brewing Intermediate | Separates a material into its usable components |
| 5 | **Poisoncraft** | — | E | C | Extraction Expert | Weapon coatings; stacking degeneration |
| 6 | **Potion Brewing** | — | E | C | Simple Brewing Master | Attribute and resistance potions with real duration |
| 7 | **Volatiles** | — | E | C | Extraction Expert, Intellect threshold | Throwable flasks — fire, acid, smoke, adhesive |
| 8 | **Antidotes** | — | E | C | Poisoncraft Intermediate | Cures for poison, disease and Blight |
| 9 | **Concentration** | — | D | C | Potion Brewing Master, 2,000 brews | Doubles a potion's potency at reduced duration, or the reverse |
| 10 | **Transmutation** | — | D | C | Extraction Master, Intellect threshold | Converts one material into another of the same rarity |
| 11 | **Elixir Craft** | — | D | C | Concentration Master, Rank II | Potions that grant temporary skills rather than stats |
| 12 | **Deathcap** | — | C | C | Poisoncraft Master, Volatiles Master | Poisons that persist through cleansing and resist antidotes |
| 13 | **Philosopher's Work** | — | C | C | Transmutation Master, Research Expert | Raises a material one rarity tier. Slow, expensive, unreliable. |
| 14 | **Panacea** | — | B | C | Elixir Craft Master, Antidotes Master | Cures any condition, including permanent ones |
| 15 | **Elixir of Years** | — | A | C | Panacea Master, composite condition | Grants a permanent attribute increase. Once per hero, ever. |
| 16 | **Grenade Throw** | — | E | A | Volatiles Novice | Delivers an alchemical flask accurately at range |

---

## Cooking

Craft and Life. Food, duration buffs, morale. Structurally load-bearing — a poorly fed roster underperforms across the board.

| # | Skill | Label | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Cooking** | — | F | P | None | Prepared food removes the unfed penalty. **Foundation.** |
| 2 | **Field Rations** | — | F | C | Cooking Novice | Portable food that keeps on a long mission |
| 3 | **Butchery** | — | F | C | Cooking Novice | Better yield from carcasses; feeds Gathering |
| 4 | **Hearth Meal** | — | E | C | Cooking Intermediate | Small party-wide buff before a mission |
| 5 | **Preserving** | — | E | C | Field Rations Expert, Alchemy prerequisite | Food keeps indefinitely; buffs do not decay |
| 6 | **Seasoning** | — | E | C | Cooking Expert, Dexterity threshold | Raises the potency of every dish the hero makes |
| 7 | **Restorative Broth** | — | D | C | Hearth Meal Master, Restoration prerequisite | Food that heals over time and clears minor conditions |
| 8 | **Monster Cuisine** | — | D | C | Butchery Master, Animal Handling Expert | Cooks monster materials; buffs matched to the creature's affinity |
| 9 | **Feast** | — | D | C | Hearth Meal Master, 2,000 meals cooked | Buffs the entire roster at once, not just the active party |
| 10 | **Comfort** | — | C | P | Feast Master | Well-fed heroes train faster and recover faster between missions |
| 11 | **Banquet of the Five** | — | C | C | Monster Cuisine Master, Feast Master | A dish per affinity; each ally receives the one matching theirs |
| 12 | **The Long Table** | — | B | P | Comfort Master, composite condition | The entire settlement gains a permanent standing bonus while the hero cooks |

---

## Gathering

Craft and Life. Harvesting, mining, foraging, skinning, animal handling, taming, and breeding.
Feeds Forging, Alchemy and Cooking, and makes hauling heroes worth a roster slot.

| # | Skill | Label | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Gathering** | — | F | P | None | Enables harvesting of nodes and carcasses. **Foundation.** |
| 2 | **Mining** | — | F | C | Gathering Novice | Ore, stone and gems |
| 3 | **Foraging** | — | F | C | Gathering Novice | Herbs, fungi, wild food |
| 4 | **Skinning** | — | F | C | Gathering Novice | Hide, scale and bone from felled creatures |
| 5 | **Animal Handling** | — | F | P | None | Animals do not flee or attack on sight; can calm hostile beasts and build trust through feeding. **Foundation.** |
| 6 | **Taming** | — | E | A | Animal Handling Master | Permanently binds a low-tier creature as a companion |
| 7 | **Breeding** | — | D | C | Taming Master, Cultivation or equivalent | Produces creatures with inherited traits |
| 8 | **Careful Harvest** | — | E | P | Any gathering skill at Expert | Nodes yield more and are not exhausted as quickly |
| 9 | **Prospecting** | — | E | P | Mining Expert, Cartography Novice | Reveals nearby nodes and their quality |
| 10 | **Bulk Carry** | — | E | P | Strength threshold, 5,000 gathers | Substantially increased carry capacity for materials |
| 11 | **Deep Vein** | — | D | C | Prospecting Master | Access to Rare and better material nodes |
| 12 | **Perfect Cut** | — | D | P | Skinning Master, Dexterity threshold | Signature components from monsters drop far more often |
| 13 | **Cultivation** | — | D | C | Foraging Master | Grow reagents rather than finding them; a settlement supply |
| 14 | **Leyline Harvest** | — | C | C | Deep Vein Master, Rank III | Extract elementally-charged material from affinity nodes |
| 15 | **Greater Taming** | — | C | A | Taming Master, Rank III | Binds mid-tier monsters, not merely animals |
| 16 | **Nothing Wasted** | — | C | P | Careful Harvest Master, 25,000 gathers | Every harvest yields something usable, including from failures |
| 17 | **Monarch of Beasts** | — | B | P | Greater Taming Master, composite condition | High-tier monsters may be bound; they retain their own affinity rank |
| 18 | **The Earth Provides** | — | B | P | Leyline Harvest Master, composite condition | Nodes in the region replenish permanently and yield a tier higher |

---

## Knowledge

Craft and Life. Literacy, identification, appraisal, cartography, language, research, teaching, and
specialist understanding. The support ladder everything else quietly depends on — and the only route
to revealing another hero's aptitudes.

| # | Skill | Label | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **Literacy** | — | F | P | None | Read manuals, maps and inscriptions. **Foundation.** |
| 2 | **Identify** | — | F | A | Literacy Novice | Reveals an item's rarity and basic properties |
| 3 | **Mapping** | — | F | C | Literacy Novice | Records explored terrain; shared across the roster |
| 4 | **Appraisal** | — | E | A | Identify Expert | Reveals an item's full properties, including hidden ones |
| 5 | **Languages** | — | E | P | Literacy Expert, Intellect threshold | Read and speak languages the hero has not learned |
| 6 | **Research** | — | E | C | Literacy Expert | Extracts skill learn-conditions from recovered texts |
| 7 | **Read the Body** | — | D | A | Appraisal Master, Intellect threshold | **Reveals one hidden aptitude in a hero.** The primary appraisal route. |
| 8 | **Cartography** | — | D | C | Mapping Master | Predicts unexplored terrain; reveals node and boss locations |
| 9 | **Ancient Script** | — | D | P | Languages Master, Research Expert | Reads pre-collapse texts; unlocks high-rarity learn paths |
| 10 | **Deep Appraisal** | — | C | A | Read the Body Master | Reveals a hero's full aptitude set, and a monster's complete profile |
| 11 | **The Archive** | — | C | P | Ancient Script Master, 10,000 texts read | The settlement gains a library; all heroes learn faster |
| 12 | **Recovered Knowledge** | — | B | C | The Archive Master, composite condition | Reconstructs a lost skill from fragments — a route to Fabled techniques |

---
