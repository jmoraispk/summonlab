# Equipment

Wiki ID: `mechanics.equipment`

Design status: **draft imported from the owner's initial equipment compendium**. The catalog is
complete as a design inventory, but numerical combat behavior, acquisition, durability, and the
Living Village shipping selection remain unresolved.

Equipment covers materials, weapons, armour, shields, casting focuses, tools, accessories, and
sets. It is a companion to the progression and skill systems: equipment supplements a build,
enables particular techniques, and exposes tradeoffs without replacing a hero's underlying
capability.

## Reading the catalog

`R` is the rarity band: F Common, E Uncommon, D Rare, C Epic, B Mythic, A Fabled, and S Legendary.
`F+`, `E+`, and similar entries currently mean that the listed band is the item's minimum or
starting band; the exact interpretation is an open rules question. Weight is Light, Medium, Heavy,
or Very Heavy. `Scales` names the attribute a weapon's damage keys off.

## Complete draft

- [Rarity, craftsmanship, and weight](rarity-and-weight.md)
- [Materials](materials.md)
- [Weapons](weapons.md)
- [Armour and shields](armour-and-shields.md)
- [Casting focuses, tools, and accessories](focuses-tools-accessories.md)
- [Sets, enchantment, and bound equipment](sets.md)

Together these pages preserve every rule, table, example, item, and explicitly unfinished area in
the supplied compendium. They should not be read as implemented behavior.

## Candidate Living Village subset

The complete catalog should remain available to content, mechanics, and visual workers, while the
first playable village implements only enough equipment to prove:

```text
acquire or receive an item
→ inspect its readable properties
→ compare it with the current loadout
→ equip it in a legal slot
→ see it on the hero
→ use it in deterministic combat
→ preserve the loadout on return to training
```

### Minimum runtime rules

- stable item-definition and item-instance IDs;
- ownership, inventory, equip, unequip, and party-loadout reservation;
- main-hand, off-hand, two-handed, armour-class, and overlapping-slot legality;
- rarity, material, weight, scaling attribute, damage/protection tags, and explicit special
  properties;
- weight-tolerance penalties through the same combat calculation used by tower encounters;
- one projection shared by roster, equipment, party assembly, combat result, and hero visuals;
- deterministic receipts for item acquisition and loadout changes.

Durability, repair, crafting, enchantment, sets, monster crafting, bound items, storage magic,
field tools, consumables, and ammunition variants are outside the minimum unless another Living
Village rule depends on them.

### Candidate expansion pool

This is a Common/Uncommon expansion pool, not the initial runtime target and not a deletion or
acceptance verdict for the full compendium.

| Need | Candidate items |
| --- | --- |
| Representative equipment for the five Martial families | Shortsword, Knife, Greatblade, War Spear, Glaive, Halberd, Polehammer, Hunting Bow, Light Crossbow, Round Shield, Hand Wraps |
| Basic defensive choices | Buckler, Round Shield, Mail, Hide Armour, Boiled Leather, Padded Coat, Travelling Robes |
| Basic magical choices | Talisman, Wand, Staff |
| Materials sufficient for those items | Copper, Bronze, Iron, Pig Steel, Coarse Hide, Rough Pelt, Boiled Leather, Thick Hide, Rough Cloth, Hemp Weave, Wool, Canvas, Pine, Ash, Oak, Yew |

The first slice should normally use Common and Uncommon instances, with a Rare item only if it is a
deliberate milestone reward. Whether all five Martial families need to ship immediately depends on
which skill families the Living Village hero roster can actually receive.

### Initial runtime selection

Keep the first combat slice within 12–20 equipment definitions and align it to the initial skill
roles:

- weapons/focuses: Arming Sword, Hunting Bow, Wand, and Staff;
- defense: Buckler, Round Shield, Mail, Hide Armour, Boiled Leather, Padded Coat, and Travelling
  Robes;
- accessories: Ring and Amulet;
- materials needed to describe those instances: Copper, Iron, Coarse Hide, Boiled Leather, Rough
  Cloth, and Hemp Weave.

That is thirteen equippable definitions plus six material definitions. Add another weapon family
only when a starter hero can actually use it and combat can explain the difference.

## Ownership and interfaces

- Progression/combat owns derived use of scaling attributes, skill compatibility, and combat
  effects.
- Economy/item ledger owns item instances, ownership, and reservations.
- Presentation consumes equipment references and approved visual bindings.
- Expedition consumes an exact reserved loadout and publishes wear/loss outcomes if those mechanics
  are adopted.
- Settlement capabilities and tools eventually gate crafting, but the first static settlement does
  not need a crafting loop.
- Creature content supplies monster materials and named-creature signature components.

## Source authority and remaining decisions

The supplied vocabulary and rules win earlier conversational alternatives. Genuine internal gaps
remain preserved rather than silently normalized:

- Equipment uses the progression vocabulary for Dexterity, Vitality, Intellect, and affinity rank.
  New runtime IDs must use the same current names.
- The quality table says Masterwork is material band plus two, which makes Masterwork Copper Rare;
  the accompanying example calls it Uncommon and introduces an undefined Exceptional quality for
  Rare.
- Weight tolerance uses Might supported by Vitality as authored.
- An item's rarity is fixed forever, while Living Metal grows with its wielder. Growth can be
  compatible with fixed rarity, but the mutable stats/properties need an explicit boundary.
- The set section says there are three independent axes but presents four subsections: material,
  monster, enchanted, and forged/bound equipment.
- Armour class is determined by material, yet several armour designs accept multiple material
  families or reuse a material name as an item name.
- Accessory slots are not defined beyond two rings; Pocket Space may be an item, capability, or
  progression reward rather than a worn accessory.
- Handedness and slot conflicts are prose-only: two compatible Blade weapons, two-handed
  weapons/foci, shields, Body-compatible unarmed equipment, hand armour, and Iron Sleeves need one
  legality model.
- Damage, mitigation, poise, penetration, bleed, Rend, initiative, evasion, attack speed, mana,
  affinity, and granted-skill effects await the combat and status contracts.
- Monster materials taken from sapient peoples require source, consent, death, personhood, and
  social-consequence rules; a species label must never itself imply a harvestable enemy resource.
- The source does not define acquisition: summon loadouts, tower drops, settlement stock, crafting,
  rewards, and recovery after defeat remain open.

## Change notes

- 2026-08-29 — draft — Imported the complete owner-supplied equipment compendium and identified a
  bounded Living Village candidate subset.
