# Summoning, Progression, and Combat

Wiki ID: `system.summoning-progression-combat`

This system owns the core capability loop: acquire heroes, develop attributes and skills, prepare
equipment, resolve combat, and translate validated outcomes into growth and motivating rewards. Its
internal bounded contexts stay separate even though the player experiences them as one loop.

## Living Village

- one Normal summoning channel and enough introductory access to form one party;
- 1★ levels 1–10 with the accepted future cap table preserved in schema;
- six attributes and a small affinity subset;
- 8–12 runtime skills from the complete compendium;
- 12–20 runtime equipment definitions across weapon, armour, and accessory;
- direct attribute or owned-skill training;
- a versioned seeded combat request/receipt with explanatory trace;
- reward claims committed by their owning progression, inventory, and floor systems.
- a placeholder engagement table covering daily gems, mission benefits, and progress toward an
  occasional Special summon, with exact values still under review.

The release matrix decides whether the initial gem claim and Special access are active or only
represented by a placeholder. Advanced summoning, pity, promotion, complete mastery ladders,
merging, crafting, item sets, permanent injuries, death, and synthesis remain documented but
inactive.

Detailed source material:

- [Progression](../mechanics/progression/README.md)
- [Skills](../mechanics/skills/README.md)
- [Equipment](../mechanics/equipment/README.md)
- [Attributes](../mechanics/attributes.md)
- [Affinities](../mechanics/affinities/README.md)
- [Rewards and engagement](../mechanics/rewards-and-engagement.md)
- [Living Village release matrix](../roadmap/living-village-v1.md)
