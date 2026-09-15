# Progression open decisions

Wiki ID: `mechanics.progression.open-decisions`

Design status: **current after engine-v27 convergence**. Accepted decisions live in
[ADR 0073](../../../decisions/0073-awakening-and-multi-path-progression.md); this page retains only
unresolved tuning and future-system questions.

## Resolved baseline

- Attributes are Strength, Agility, Vitality, and Magic in sheet order `STR`, `AGI`, `VIT`, `MAG`.
- Levels run `1..999`; awakenings occur at levels 100 through 900.
- Stars are immutable `1★..7★` points-per-level ratings. No star promotion or star-stone system is
  current.
- Combat and completed crafting both award one shared hero XP track. Hero XP and skill practice
  remain different receipts.
- Forging is the first production adapter; cooking may use the same completion evidence contract.
- Affinity-to-attribute relationships are mild, capped, and separable rather than progression
  ownership.

## Calibration still open

- Final XP curve, encounter difficulty factors, objective/first-clear bonuses, and repetition decay.
- Mana-per-Magic progression, safe-rest recovery, and late-tier Health/Mana refill presentation.
- Agility's real-world movement curve, travel pacing, readiness rate, hit contest, and action cap.
- Physical and magical skill coefficients, defense curve constant, armor budgets, criticals, and
  the hero-to-gear power ratio across all ten awakening tiers.
- Exact summon-channel probabilities for immutable star ratings.
- Production difficulty, ingredient-rarity, quality, novelty, and repetition tables for forging,
  cooking, and later crafts.
- When common skills should be superseded, while keeping them useful earlier through cost,
  reliability, compatibility, and utility.

## Separate future systems

- Macro paths below Combat and Crafting, including whether they are generated, chosen, or earned.
- More complete mastery, teaching, skill fusion, stance, and passive-stacking rules.
- Durability/repair, growth gear, item sets, special resources, and deeper material economies.
- Affinity awakening, dual affinities, status interactions, and whether the mild attribute
  association should be weakened or removed.
- Settlement training facilities, schedule/agency rules, and non-combat work beyond production.

Any numerical change to shipped progression publishes a new content-hashed rules table. It must not
rewrite earlier receipts or reinterpret stored attributes.
