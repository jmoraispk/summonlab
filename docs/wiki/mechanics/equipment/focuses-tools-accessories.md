# Staffs, tools, and accessories

Wiki ID: `mechanics.equipment.focuses-tools-accessories`

Design status: **owner-approved taxonomy; Staff integrated, Tool and Accessory deferred**.

## Staff

Staff is the single canonical Magical focus. It occupies both hands and uses wood as its
rank-bearing material. Magical school, affinity, enchantment, named provenance, and visual form may
change its properties without creating Wand, Orb, Talisman, Prayer Beads, Censer, or Elemental Core
classes.

A hero does not require a Staff to use Magical skills. The Staff improves magical capability once
the shared Magical and equipment contracts define that benefit.

## Tool

Tool is one equipment class with a Craft-family tag. The tag says which work it enables; it does
not create a new top-level item class.

| Craft tag | Typical presentation |
| --- | --- |
| **Forging** | Hammer and smithing implements |
| **Alchemy** | Mortar, vessels, and reagent implements |
| **Cooking** | Knife, pot, and hearth implements |
| **Gathering** | Pick, sickle, harvesting, and animal-handling implements |
| **Knowledge** | Reading, writing, surveying, and appraisal implements |

A Tool has one rank-bearing material chosen by its dominant working component. Other handles,
bindings, containers, and fittings are required visual construction but do not add another rank.
Tool remains a documented future Equipment class: the runtime-v1 catalog implements Staff but does
not yet define or export Tool or Accessory items.

## Accessory

Accessory is one equipment class. Ring, amulet, and bracelet are presentation forms, not separate
mechanical classes. The standard model needs one Accessory slot; a later balance pass may justify a
second without adding more Accessory types.

Storage objects, affinity sigils, teacher tokens, and bound relics are special rewards or authored
properties on an Accessory. They are not core craftable item classes.

## Rank

The item design and selected material set the combined crafting difficulty. The material supplies
base rank, and Forging craftsmanship adds `+0`, `+1`, or `+2`, capped at S, as defined in
[Equipment rarity and craftsmanship](rarity-and-weight.md).

## Open implementation questions

- Define the single Staff benefit without duplicating Magical skill effects.
- Define which material is rank-bearing for each Craft-tagged Tool presentation.
- Define the bounded property budget for Accessory rank and special rewards.
