# Equipment sets, enchantment, and binding

Wiki ID: `mechanics.equipment.sets`

Design status: **draft**.

The source describes three independent axes, while presenting four categories below. A hero's gear
at any point is usually a mix of all three; the exact axes therefore need clarification before a
typed item schema is accepted.

## Material sets

Material sets are the same familiar designs reproduced in ascending materials. They are predictable
by design: the floor a player can always work toward through Gathering and Forging, requiring no
luck.

A full material set grants a modest cohesion bonus: reduced weight and a small mitigation increase.

## Monster sets

Monster sets are built from the remains of a specific named creature. A monster set sits at the
rarity its source materials carry, and its set bonus is thematically tied to that creature. A set
from a Chill-aligned leviathan, for example, resists Chill and inflicts it.

These are the interesting middle of the equipment game. They are not strictly better than the
material tier at the same rarity, but differently shaped, and create a reason to hunt one
particular thing repeatedly.

| Set element | Effect |
| --- | --- |
| Two pieces | The creature's elemental resistance |
| Four pieces | The creature's signature status effect on the wearer's attacks |
| Full set | A distinctive property drawn from the creature itself |
| Full set **with signature component** | The property is substantially stronger, and the set gains an attribute bonus |

Signature components—the eyes, heart, core horn, or crown—drop rarely even from the correct
monster. Perfect Cut (Gathering, Rare) improves the odds considerably.

## Enchanted equipment

Any item with an open slot may be enchanted. Enchantment adds properties without changing rarity:
an enchanted Common sword is still a Common sword and still capped like one.

This gives low-tier gear a real, bounded upgrade path, and it makes an enchanter valuable to a
roster that has not yet reached high material tiers.

## Forged and bound equipment

At the top of the Forging ladder, items acquire properties no material or monster supplies:

| Source skill | Property |
| --- | --- |
| **Master's Mark** | A permanent bonus to whoever wields it, and the smith's name attached |
| **Living Metal** | The item grows with its wielder rather than staying static |
| **Monster Craft** | Proper monster sets with affinity-matched bonuses |
| **Soul Forging** | Bound permanently to one hero; grants an active skill |
| **Godsmithing** | A Legendary item. Once, ever, per smith. |

These are always the work of a named craftsman, which means the best equipment in the world has a
person's name on it.

## Still to author

- Potion recipes and Food recipes need their own listings in the Alchemy and Cooking pages. Recipe
  differences do not create additional item classes.
- Bow ammunition is implicit in ordinary use. A later named property may alter an attack without
  creating ammunition inventory classes.
- Durability and repair, if adopted.
- Per-item stat values, once the attribute numerics pass is done.

## Open implementation questions

- Clarify the claimed three axes and whether material/monster is one source axis while enchantment
  and binding are separate overlays.
- Define what counts as a full set across the canonical Weapon, Armour, Shield, Staff, Tool, and
  Accessory forms without multiplying slots or item classes.
- Define set-piece uniqueness, duplicate behavior, signature-component consumption, extraction,
  crafting provenance, and anti-farming constraints.
- Reconcile fixed item rarity with enchantment, Living Metal growth, granted skills, and the claim
  that Common gear remains capped.
- Named-creature farming and remains from sapient beings require explicit ethical, social, and
  encounter rules.
