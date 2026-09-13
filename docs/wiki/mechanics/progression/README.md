# Progression system

Wiki ID: `mechanics.progression`

Design status: **implemented for `engine-v27`**. Historical states and replays retain the rules that
created them.

## Player model

Every current hero has four visible attributes in character-sheet order:
`STR` Strength, `AGI` Agility, `VIT` Vitality, and `MAG` Magic. The full names remain the canonical
names; abbreviations exist only where a compact sheet benefits from them. Attributes have no
Body/Mind classification.

Hero progression is one shared level track with two initial macro paths:

| Path | Valid experience evidence |
| --- | --- |
| Combat | Applied damage, protection/recovery, or objective contribution in a resolved encounter |
| Crafting | A completed item or food result, scaled by difficulty, ingredients, quality, novelty, and repetition |

Combat and Crafting describe starting competency and evidence sources, not permanent classes. A
smith may fight; a fighter may learn to cook. Forging or cooking a new result can level a hero just
as combat can. Merely starting a craft, reserving ingredients, joining a fight, narrating an intent,
or landing the final hit without meaningful contribution does not receive special XP.

## Levels, stars, and awakenings

- Levels run from `1` through `999`.
- An awakening occurs at every hundredth level from 100 through 900.
- A hero's immutable `1★..7★` rating equals the number of unallocated attribute points received for
  each crossed level.
- Stars never upgrade. There are no current stars, star stones, fusion odds, or promotion command.
- Attributes may also grow through typed training, achievement, consumable, cultivation, or other
  authored evidence.
- Every applicable point uses the hero's current awakening conversion rate, regardless of when or
  how the point was earned.

See [Experience and levels](experience-and-levels.md), [Stars](stars.md), and
[Attributes and training](attributes-and-training.md).

## Versioned tuning

The conversion ladder and XP factors are authored tables. They are intentionally easy to rebalance
or nerf later. A changed table receives a new rules version and hash; it does not require a new hero
state shape, and historical receipts remain bound to their original rules.

The checked evidence is [progression-balance-v1](../../../evidence/progression-balance-v1.json).

## Related pages

- [Affinities](affinities.md) — a mild, separable relationship rather than attribute ownership
- [Skills and ladders](skills-and-ladders.md) — learned execution remains distinct from raw attributes
- [Equipment, materials, food, and inventory](equipment-materials-and-inventory.md)
- [Overgeared research](../../research/attribute-systems/overgeared/README.md)
- [ADR 0073](../../../decisions/0073-awakening-and-multi-path-progression.md)
