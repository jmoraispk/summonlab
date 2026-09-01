# Equipment

Wiki ID: `mechanics.equipment`

Design status: **owner-revised draft**. The canonical item classes and material relationships are
now intentionally smaller than the imported compendium. Numerical combat behavior, acquisition,
durability, and the Living Village shipping selection remain unresolved.

Equipment covers materials, weapons, armour, shields, casting focuses, tools, accessories, and
sets. It is a companion to the progression and skill systems: equipment supplements a build,
enables particular techniques, and exposes tradeoffs without replacing a hero's underlying
capability.

## Reading the catalog

`R` is rank: F Common, E Uncommon, D Rare, C Epic, B Mythic, A Fabled, and S Legendary. Material
supplies base rank, while craftsmanship may add zero, one, or two ranks, capped at S.

## Complete draft

- [Rarity, craftsmanship, and weight](rarity-and-weight.md)
- [Materials](materials.md)
- [Weapons](weapons.md)
- [Armour and shields](armour-and-shields.md)
- [Staffs, tools, and accessories](focuses-tools-accessories.md)
- [Sets, enchantment, and bound equipment](sets.md)

These owner-revised pages supersede the imported item's breadth while preserving unresolved rules
honestly. They should not be read as implemented behavior.

## Craft output streams

Only three Craft families produce item catalogs:

| Craft family | Single output stream |
| --- | --- |
| **Forging** | Equipment |
| **Alchemy** | Potion |
| **Cooking** | Food |

Forging is deliberately the broad durable-item craft. Alchemy recipes change what a Potion does
without creating coating, bomb, antidote, or elixir item classes. Cooking recipes change what Food
does without creating ration, meal, broth, or feast item classes.

Gathering supplies materials and ingredients, Beast produces companion and handling outcomes, and
Lore produces knowledge. They do not receive item classes merely for symmetry.

The Equipment stream contains thirteen canonical classes:

- six Weapons: Sword, Dagger, Spear, Bow, Axe, and Mace;
- three Armour classes: Heavy Armour, Light Armour, and Robes, each delivered as a four-item set;
- Shield, Staff, Tool, and Accessory.

The four Armour items are Head, Torso, Legs, and Boots. This produces twenty-two concrete
equippable forms across the complete Equipment stream: six Weapons, twelve Armour items, Shield,
Staff, Tool, and Accessory. The current production baseline covers Weapons, Armour, Shield, and
Staff; Tool and Accessory remain documented for later work.

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

Durability, repair, enchantment, sets, monster crafting, bound items, storage magic, field tools,
Potions, and Food are outside the minimum unless another Living Village rule depends on them.

### Candidate expansion pool

This Common/Uncommon pool exercises the current production baseline without adding another class.

| Need | Candidate items |
| --- | --- |
| Weapons | Sword, Dagger, Spear, Bow, Axe, Mace |
| Defence | Head, Torso, Legs, and Boots for each of Heavy Armour, Light Armour, and Robes; Shield |
| Magical equipment | Staff |
| Materials sufficient for those items | Copper, Iron, Coarse Hide, Boiled Leather, Hemp Weave, Wool, Ash, Yew |

The first slice should normally use Common and Uncommon instances, with a Rare item only if it is a
deliberate milestone reward.

### Initial runtime selection

Use at most one starter definition for each selected concrete Equipment form. A smaller runtime
subset may omit Weapons that no starter hero can use, but every included Armour class must retain
all four of its items. It must not replace omitted forms with additional weapon, armour, focus,
tool, or accessory classes.

## Ownership and interfaces

- Progression/combat owns derived use of scaling attributes, skill compatibility, and combat
  effects.
- Economy/item ledger owns item instances, ownership, and reservations.
- Presentation consumes equipment references and approved visual bindings.
- Expedition consumes an exact reserved loadout and publishes wear/loss outcomes if those mechanics
  are adopted.
- The prototype exposes a bounded Forging/Gathering loop without requiring settlement upgrades or
  equippable Tools.
- Creature content supplies monster materials and named-creature signature components.

## Visual-production sequence

Equipment visual work follows this owner-directed sequence:

1. simplify and review the canonical material vocabulary;
2. establish the equipment theory that maps item construction, material, craftsmanship, rarity,
   wear, and role to visible differences;
3. prepare candidate equipment coverage for every retained canonical material;
4. in parallel, let the creature-content owner define candidate item drops for every monster
   without promoting them into the Equipment catalog;
5. after that dependency is reviewed, create Equipment-owned candidates for selected monster-drop
   materials.

Material studies, equipment candidates, approved sources, and runtime exports remain separate.
Creature-drop definitions are an input to later Equipment work, not permission for either owner to
edit the other domain's shared catalogs.

### Material coverage and image budget

The full canonical material ladder has seven materials in each of four families. Every Armour
material requires five images in a fixed sequence: one complete-set consistency image followed by
four separate item images for Head, Torso, Legs, and Boots. The complete set is production evidence;
the four pieces are the item images.

| Material family | Images per material | Materials | Images |
| --- | ---: | ---: | ---: |
| Metal | five Weapons + Shield + five-image Heavy Armour sequence | 7 | 77 |
| Wood | Bow + Staff | 7 | 14 |
| Hide or scale | five-image Light Armour sequence | 7 | 35 |
| Cloth or fibre | five-image Robes sequence | 7 | 35 |
| **Total** |  | **28** | **161** |

Equivalently, each rank contributes 23 images across its four materials, and seven ranks contribute
`23 × 7 = 161` images. The total consists of 140 isolated equipment images and 21 complete-set
consistency images.

This budget assumes one image per Weapon class and material, with no additional image for
craftsmanship grades or one-handed/two-handed use. It excludes Tools, Accessories, named sets, and
monster-derived equipment. A reduced prototype Weapon selection subtracts one image per omitted
Weapon at every included material rank; it does not reduce the five-image requirement for an
included Armour set.

All 161 entries are planned **candidate production targets**, not approved or runtime assets.
Promotion still requires source persistence, review evidence, approval, and a separate runtime
export.

The Equipment-owned
[material production manifest](../../../../assets/equipment/experiments/material-equipment-v1/manifest.json)
expands this budget into explicit, collision-safe targets. Its full-set dependencies enforce the
required sequence, and its candidate, provenance-result, and review paths are reservations rather
than evidence that an image exists. The adjacent
[production notes](../../../../assets/equipment/experiments/material-equipment-v1/README.md) define
the execution boundary and deterministic validation command.

## Source authority and remaining decisions

The supplied vocabulary and rules win earlier conversational alternatives. Genuine internal gaps
remain preserved rather than silently normalized:

- The equipment document's Dexterity, Vitality, Intellect/Intelligence, and Resonance references bind
  to the supplied progression vocabulary. New runtime IDs must migrate away from the old prototype
  names together.
- A material supplies base rank. Item and material difficulty set the required Forging level;
  Standard work keeps the base rank, Fine work adds one rank, and Masterwork adds two, capped at S.
  The exact difficulty values and benefit table remain to be authored.
- Weight tolerance uses Might supported by Vitality as authored.
- An item's rarity is fixed forever, while Living Metal grows with its wielder. Growth can be
  compatible with fixed rarity, but the mutable stats/properties need an explicit boundary.
- Clarify whether material/monster is one source axis while enchantment and binding are independent
  overlays rather than additional item classes.
- Armour uses four items—Head, Torso, Legs, and Boots—authored from one consistent full-set source.
  Accessory begins with one slot. Exact inventory and loadout representation still requires an
  executable contract.
- The six-weapon hand model is accepted in prose: a two-handed item occupies both hands, Shield
  requires one free hand, and Dual Wield permits only one-handed Swords and Daggers. Exact combat
  tradeoffs remain open.
- Damage, mitigation, poise, penetration, bleed, Rend, initiative, evasion, attack speed, mana,
  affinity, and granted-skill effects await the combat and status contracts.
- Monster materials taken from sapient peoples require source, consent, death, personhood, and
  social-consequence rules; a species label must never itself imply a harvestable enemy resource.
- The source does not define acquisition: summon loadouts, tower drops, settlement stock, crafting,
  rewards, and recovery after defeat remain open.

## Change notes

- 2026-09-01 — owner revision — Split each Armour class into Head, Torso, Legs, and Boots; required
  full-set-first visual production; established 161 candidate images across the canonical material
  ladder.
- 2026-09-01 — owner revision — Reduced crafted outputs to Equipment, Potion, and Food; reduced
  Equipment to thirteen classes and Weapons to Sword, Dagger, Spear, Bow, Axe, and Mace.
- 2026-09-01 — owner revision — Simplified each material family to one material per rank and
  accepted material-plus-craftsmanship as the finished-item rank rule.
- 2026-09-01 — owner revision — Removed three rejected metals from the material vocabulary and
  recorded the Equipment visual-production sequence.
- 2026-08-29 — draft — Imported the complete owner-supplied equipment compendium and identified a
  bounded Living Village candidate subset.
