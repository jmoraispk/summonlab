# Imported equipment, materials, food, and inventory proposal

Wiki ID: `mechanics.progression.equipment-materials-inventory`

Design status: **draft sketch**. The source explicitly says materials, equipment tiers, and food
need dedicated passes and that its names are placeholders. The supplied `equipment_compendium.md`
is the companion catalog and should refine this framework without silently promoting it to canon.

## Finished-item rank

Equipment and materials share the skill scale F Common through S Legendary. A material's rank is
fixed. A finished item's rank is its material rank plus the smith's `+0`, `+1`, or `+2`
craftsmanship result, capped at S. Once made, the item's final rank is fixed. Enchantment adds
properties but does not raise it.

The canonical rule and examples live in
[Equipment rarity and craftsmanship](../equipment/rarity-and-weight.md).

## Weight

Every equipment piece has weight, linking gear to attributes. The source drives weight tolerance
with Might, supported by Vitality.

| Load | Proposed effect |
| --- | --- |
| Within tolerance | No penalty |
| Slightly over | Lower movement speed and evasion |
| Substantially over | Also lower attack speed and initiative |
| Far over | Severe penalties across all Agility-derived stats |

This makes heavy armor costly and gives Might value to nonphysical builds. A Spirit caster in plate
is slow while one in robes is not. High Armorsmithing is proposed to reduce weight for equal
protection, giving a settlement a reason to cultivate smiths.

## Equipment properties

| Property | Frequency | Proposed role |
| --- | --- | --- |
| Offensive stats | Common on weapons | Damage, attack speed, penetration |
| Defensive stats | Common on armor | Mitigation, poise, resistances |
| Health bonus | Common on armor | Default defensive benefit |
| Attribute bonus | Rare | Supplement rather than define builds |
| Enchantment slots | Uncommon+ | Filled by Enchantment skills |
| Granted active skill | Very rare/high tier | Usable only while equipped and a major chase reward |
| Set membership | Rare | Matching-piece bonuses |

Armour should reinforce a fighting approach: plate pairs naturally with Shield and Polearm, while
lighter gear supports Body and Ranged practice.

## Materials and sources

| Source | Associated family | Yield |
| --- | --- | --- |
| Monster drops | — | Hide, bone, scale, organs, elementally charged remains |
| Mining | Gathering | Ore, gems, stone, star-stone fragments |
| Foraging | Gathering | Herbs, fungi, reagents, wild food |
| Harvesting | Gathering | Cultivated crops, timber, fiber |
| Skinning | Gathering | Higher-quality hide/material from defeated creatures |

Monster material rarity is proposed as a function of tier and affinity. Charged remains from a
high-tier monster are high-quality catalysts.

Forging and Alchemy are crafting rather than synthesis: they transform materials into items. The
three-to-one star-stone fusion model does not automatically apply to ordinary materials, and whether
general material fusion exists is unresolved.

## Three equipment lines

### Predictable material tiers

Familiar item shapes repeat in ascending materials, giving the player a reliable
Gathering/Forging floor that does not require luck. Metal, hide/scale, cloth/fibre, and wood/haft
each have one canonical material at every rank. The complete ladder lives in
[Equipment materials](../equipment/materials.md) so this progression sketch cannot drift from it.

### Monster sets

A set made from a named creature has the rarity of its source materials and a source-themed bonus.
A Chill leviathan set, for example, may resist and inflict Chill. It should be differently shaped,
not strictly stronger than predictable gear at the same rarity, thereby motivating repeated hunts.

Some sets require a rare signature component such as eyes, heart, or core horn. A version assembled
with that component has a stronger bonus than one without it.

### Enchanted, forged, and bound gear

Any slotted item may receive Enchantment properties without changing rarity, keeping low-tier gear
useful within a firm ceiling and making enchanters valuable early.

At the top of Forging, the draft proposes a named smith’s permanent mark, gear that grows with its
wielder, and eventually hero-bound items granting an active skill. These are the rarest items and
always the work of a named craftsperson.

## Food and upkeep

Heroes require food through roster-wide standing upkeep, not individual hunger bars. Poor feeding
reduces training yield, regeneration, and practice quality.

- Basic cooking removes the underfed penalty.
- Good cooking applies pre-mission duration buffs.
- Feast cooking affects the entire roster.

This makes Cooking, Gathering, and Beast skills structurally useful and pressures a strike team to
grow into a settlement. It is explicitly an unfinished proposal.

## Per-hero inventory

| Type | Form | Capacity | Availability |
| --- | --- | --- | --- |
| Spatial | Backpack, pouch, satchel | Limited by volume and Might-driven carry capacity | Common |
| Dimensional | Ring, bracelet, pocket space | Much larger and weight-independent | Rare reward |

Real per-hero capacity creates legitimate gathering and hauling roles, especially for heroes with
Gathering, high Might, or dimensional storage.

## Living Village subset

Use a small set of pre-authored weapons and armor, one load calculation, simple equipment comparison,
basic monster drops, and settlement storage/hero loadout screens. Defer crafting, durability,
enchantment, sets, signature components, food upkeep, dimensional inventory, binding, and the full
material ladder until the core loop proves that equipment decisions are readable.
