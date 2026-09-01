# Armour and shields

Wiki ID: `mechanics.equipment.armour-shields`

Design status: **draft**.

Armour is split into three classes. Class is determined by material, not by slot: plate requires
metal, and light protection at low weight requires creature scale or fine cloth.

## Heavy — metal required

Requires the metal line. High mitigation and poise, high weight. Commonly paired with Shield,
Polehammer, or Greatsword equipment.

| Armour | R band | Weight | Material required | Notes |
| --- | --- | --- | --- | --- |
| **Mail** | F+ | Medium | Any metal | Rings. Good against cuts, poor against blunt. |
| **Scale Mail** | E+ | Medium | Any metal | Metal scales on backing; better against thrusts |
| **Brigandine** | E+ | Medium | Metal + leather | Plates riveted inside cloth. The practical middle. |
| **Half Plate** | D+ | Heavy | Steel or better | Torso and limbs; joints left in mail |
| **Full Plate** | C+ | Heavy | Blacksteel or better | Complete coverage. The highest mitigation available. |
| **Great Plate** | B+ | Very Heavy | Skyiron or better | Effectively a walking fortification |

## Medium — creature scale and hide

Requires the hide and scale line. The best protection-to-weight ratio in the game, and the reason
monster hunting matters. Commonly paired with Sword, Spear, Dagger, and Body-compatible unarmed
equipment.

| Armour | R band | Weight | Material required | Notes |
| --- | --- | --- | --- | --- |
| **Hide Armour** | F+ | Light | Coarse hide | Barely protective, weighs nothing |
| **Boiled Leather** | E+ | Light | Boiled leather | The baseline for anyone who moves |
| **Studded Leather** | E+ | Medium | Hide + metal studs | Hybrid; some blunt protection |
| **Scale Harness** | D+ | Medium | Beast scale | Approaches mail at lower weight |
| **Chitin Plate** | C+ | Light | Chitin | Very light, strong against cuts, weak to blunt |
| **Lamellar** | C+ | Medium | Beast scale or metal | Laced plates; flexible and quiet |
| **Drakescale Coat** | B+ | Medium | Drakescale | Near-plate mitigation with heat resistance |
| **Wyrmscale** | A+ | Light | Wyrmscale | Plate-tier protection at light weight. The best armour in the game. |

## Light — cloth and fibre

Requires the cloth line. Minimal mitigation, substantial magical benefit. Worn by every caster in
the source draft.

| Armour | R band | Weight | Material required | Notes |
| --- | --- | --- | --- | --- |
| **Padded Coat** | F+ | Light | Hemp weave | Token protection; worn under everything else |
| **Travelling Robes** | F+ | Light | Hemp or wool | No protection, no penalty |
| **Silk Weave** | D+ | Light | Layered silk | Resists piercing far better than it should |
| **Warded Robes** | C+ | Light | Spellweave | Standing magical resistance |
| **Spellweave Mantle** | C+ | Light | Spellweave | Light, tough, holds two enchantments |
| **Moonweave Vestments** | B+ | Light | Moonweave | Substantial mana pool and regeneration |
| **Starcloth Raiment** | A+ | Light | Starcloth | Every caster stat, and a granted skill |

## Armour slots

| Slot | Notes |
| --- | --- |
| Head | Helm, hood, circlet. Heavy helms reduce peripheral awareness. |
| Chest | The main mitigation piece; determines armour class |
| Arms | Bracers, sleeves, pauldrons |
| Hands | Gloves and gauntlets—may overlap with Body-compatible unarmed equipment |
| Legs | Greaves, trousers |
| Feet | Boots. The main movement-speed slot. |
| Cloak | Weather, concealment, small resistances |
| Belt | Carry capacity and quick-access slots |

## Shields

Shields occupy the off-hand and are the only equipment described as protecting other people.

| Shield | R band | Weight | Notes |
| --- | --- | --- | --- |
| **Buckler** | F+ | Light | Fist-sized. Parry aid rather than a wall. Does not block projectiles. |
| **Round Shield** | F+ | Medium | The baseline. Balanced. |
| **Heater Shield** | E+ | Medium | Better coverage; standard for a mounted hero |
| **Kite Shield** | D+ | Medium | Covers the leg; excellent for a formation line |
| **Tower Shield** | C+ | Heavy | Full-body coverage; enables Tower Form and Wall Stance |
| **Pavise** | C+ | Very Heavy | Plantable; provides cover to allies behind it |
| **Aegis** | B+ | Heavy | Enchantment-woven; supports Aegis and Phalanx at full strength |

## Open implementation questions

- Decide whether armour is a single design instance or eight independently equipped pieces; the
  catalog currently describes both whole designs and slots.
- Define material/design rarity interaction, mixed materials, underlayers, and whether changing one
  slot changes the armour class.
- Define mitigation, poise, damage-type resistance, coverage, awareness, movement, magic, mana,
  concealment, carry capacity, and quick-access mechanics.
- Define protection of allies through guard geometry/formations without allowing presentation to
  invent collision or cover.
- Resolve hand armour and unarmed-equipment overlap and off-hand/two-handed conflicts.
