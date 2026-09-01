# Casting focuses, tools, and accessories

Wiki ID: `mechanics.equipment.focuses-tools-accessories`

Design status: **draft**.

## Casting focuses

A focus is not required to cast, but it substantially improves magical magnitude and control.

| Focus | R band | Weight | Favours |
| --- | --- | --- | --- |
| **Talisman** | F+ | Light | Any. The cheapest focus; a paper charm. |
| **Wand** | F+ | Light | Elemental. Fast, low magnitude. |
| **Staff** | E+ | Medium | Elemental and Ward. Highest raw magnitude; two-handed. |
| **Orb** | D+ | Light | Ward and Mind. Control duration and stability. |
| **Prayer Beads** | D+ | Light | Restoration. Mana efficiency and healing potency. |
| **Censer** | C+ | Medium | Enchantment. Reduces component consumption. |
| **Elemental Core** | B+ | Light | One affinity only. Raises effective affinity rank while held. |
| **Worldtree Staff** | A+ | Medium | Any. Grants a skill and holds three enchantments. |

## Tools

Tools are required to practise the associated skills, and their quality sets the ceiling on output.

| Domain | Family | Tool | R band | Notes |
| --- | --- | --- | --- | --- |
| **Craft** | **Forging** | Smith's Hammer | F+ | Required for any Forging skill |
| | | Tongs and Anvil | F+ | Workshop fixture; quality gates Tempering |
| | | Bellows | E+ | Gates the temperature ceiling, and therefore the material ceiling |
| | | Whetstone | F+ | Enables Sharpening in the field |
| | | Runic Chisel | C+ | Required for Runic Foundation |
| **Craft** | **Alchemy** | Mortar and Pestle | F+ | Required for any Alchemy skill |
| | | Alembic | E+ | Required for Extraction |
| | | Retort | D+ | Required for Transmutation |
| | | Reagent Case | E+ | Prevents component spoilage in the field |
| | | Philosopher's Vessel | C+ | Required for Philosopher's Work |
| **Craft** | **Cooking** | Field Pot | F+ | Required to cook on a mission |
| | | Chef's Knife | F+ | Quality raises every dish's potency |
| | | Feast Cauldron | D+ | Required for Feast |
| **Craft** | **Gathering** | Pick | F+ | Required for Mining |
| | | Sickle | F+ | Required for Foraging |
| | | Skinning Knife | F+ | Required for Skinning; quality gates Perfect Cut |
| | | Prospector's Lens | E+ | Required for Prospecting |
| | | Leyline Tap | C+ | Required for Leyline Harvest |
| | | Taming Collar | D+ | Required for Taming |
| **Martial** | **Body** | Bridle and Saddle | E+ | Required for Riding |
| | | Beast Whistle | E+ | Required for Pack Bond |
| **Craft** | **Knowledge** | Reading Lens | F+ | Required for Identify |
| | | Scribing Set | E+ | Required for Research and Mapping |
| | | Surveyor's Kit | D+ | Required for Cartography |
| | | Appraiser's Glass | C+ | Required for Read the Body |

## Accessories

Accessories are where attribute bonuses and granted skills concentrate. They are deliberately the
rarest equipment in the game.

| Accessory | R band | Notes |
| --- | --- | --- |
| **Ring** | E+ | Small bonuses. Two may be worn. |
| **Amulet** | E+ | Resistances and affinity support |
| **Bracelet** | D+ | Commonly the enchantment carrier |
| **Storage Ring** | D+ | **Dimensional inventory.** Modest capacity, weight-independent. |
| **Storage Bracelet** | B+ | Far larger dimensional capacity |
| **Pocket Space** | A+ | Effectively unlimited. A meaningful reward on its own. |
| **Affinity Sigil** | C+ | Raises effective affinity rank in one element |
| **Master's Token** | B+ | Granted by a teacher. Raises Guidance yield for the bearer. |
| **Bound Relic** | A+ | Grants an active skill; bound to one hero permanently |

## Open implementation questions

- Bind focus schools, craft families, skills, gates, and granted effects to stable skill IDs.
- Define how temporary effective-rank bonuses interact with unlocks, rank gaps, and Dominion.
- Define tool possession versus facility fixtures, field portability, quality ceilings, and what
  happens when access is lost mid-task.
- Define accessory slots beyond the two-ring limit, and decide whether Pocket Space is wearable.
- Define dimensional capacity, carried-item weight, quick-access, loss on defeat, and reservation.
- Taming Collar and “commands companions” require animal-welfare and agency semantics before
  implementation.
