# Awakening and Multi-Path Progression Design

Status: **owner-approved direction; written-spec review pending**

Date: 2026-09-12

Related design:

- [Four-Attribute and Versioned Combat Modes](2026-09-06-attributes-and-combat-modes-design.md)

## Purpose

Extend the accepted four-attribute model with a long progression horizon, level-based attribute
awakenings, immutable hero stars, and experience sources for both combat and crafting. This design
replaces the earlier level-99, star-promotion, kill-only-XP, and one-point-per-level proposals for
new rules versions. Historical state and replay continue under their original rules.

## Player promise

A hero can grow through fighting or through making useful things. Stars describe the hero's
immutable rate of level-earned attribute growth rather than a rank the player upgrades. Every one
hundred levels creates a legible power step by increasing the conversion rate of all attribute
points the hero has earned, regardless of their source.

The arithmetic stays visible. A character sheet can explain the current awakening tier and print
the exact per-point conversions without requiring the player to reconstruct a hidden curve.

## Goals

1. Support hero levels `1..999`, with awakenings at levels 100 through 900.
2. Make immutable stars equal the number of allocatable attribute points earned per level.
3. Allow direct attribute growth outside leveling through typed progression sources.
4. Award shared hero experience for meaningful combat and completed crafting.
5. Establish Combat and Crafting as the two initial macro paths without forbidding later crossover.
6. Use one clean additive awakening ladder for physical power, magical power, and Health.
7. Keep ratio statistics and flat equipment values outside the awakening multiplier.
8. Preserve deterministic progression receipts and historical replay.

## Non-goals

- Final experience quantities, ingredient-rarity factors, difficulty factors, or repetition-decay
  constants.
- A complete subclass taxonomy below Combat and Crafting.
- A final Mana-per-Magic awakening table.
- Final equipment budgets or the exact hero-to-gear power ratio at every awakening.
- Retrofitting historical characters, events, or replays with new levels, stars, or conversions.
- Implementing the design before a separate implementation plan is reviewed.

## Levels and immutable stars

Every new-rules hero has a level from 1 through 999 and one immutable star rating. Existing
one-through-seven-star vocabulary remains the representable range. Which summoning channels can
produce each native rating remains a content decision; no progression command changes a hero's
stars after summoning.

When a hero advances from one level to the next, they gain exactly `stars` unallocated attribute
points:

```text
points_granted_for_level = immutable_stars
```

A 1-star hero gains one point per level and a 5-star hero gains five. Reaching multiple levels in
one progression receipt grants the sum of each crossed level. Level 1 is the generated starting
state and does not itself issue a level-up grant.

Stars do not determine dignity, intelligence, skill ceilings, equipment rarity, or which activities
a hero may attempt. They do create a permanent difference in level-earned raw attribute budget.
There is no star upgrading, star promotion, current-star field, star-stone economy, or
promotion-triggered affinity or aptitude roll in the new rules.

### Attribute growth outside levels

Level allocation is not the only source of attributes. Training, authored achievements,
consumables, cultivation events, and other typed mechanics may grant direct intrinsic attribute
growth. Every grant records its source, rules version, attribute, before/after values, and any cap
or eligibility rule.

Awakening conversions apply to the hero's complete applicable attribute value. A point earned by
training converts at the same rate as a point allocated after leveling; the engine never tracks
different conversion rates for point vintages.

## Awakening ladder

Awakening tier is derived only from current hero level:

```text
awakening_tier = floor(level / 100)
```

The level maximum bounds the tier to `0..9`. Crossing levels 100, 200, 300, 400, 500, 600, 700,
800, or 900 increases the conversion rate. The table is the authored rules artifact; its additive
shape is also validated by formula so a mistyped row cannot silently alter one tier.

| Level | Tier | Power per STR/MAG | Health per VIT | Relative rate |
| ---: | ---: | ---: | ---: | ---: |
| 1–99 | 0 | 1.0 | 5 | ×1.0 |
| 100–199 | 1 | 1.2 | 6 | ×1.2 |
| 200–299 | 2 | 1.4 | 7 | ×1.4 |
| 300–399 | 3 | 1.6 | 8 | ×1.6 |
| 400–499 | 4 | 1.8 | 9 | ×1.8 |
| 500–599 | 5 | 2.0 | 10 | ×2.0 |
| 600–699 | 6 | 2.2 | 11 | ×2.2 |
| 700–799 | 7 | 2.4 | 12 | ×2.4 |
| 800–899 | 8 | 2.6 | 13 | ×2.6 |
| 900–999 | 9 | 2.8 | 14 | ×2.8 |

Equivalent validation formulas:

```text
power_rate(tier)  = 1.0 + 0.2 × tier
health_rate(tier) = 5.0 + 1.0 × tier
```

The earlier provisional `0.8 power / 4 Health` constants had the same 1:5 relationship. Moving to
`1 power / 5 Health` preserves that relationship while making each awakening a literal additive
20 percent of the base rate and keeping the table easy to read.

### Derived magnitude

For one action or capacity projection:

```text
physical_attribute_power = effective_STR × power_rate(awakening_tier)
magical_attribute_power  = effective_MAG × power_rate(awakening_tier)
maximum_Health            = capacity_scoped_effective_VIT × health_rate(awakening_tier)
```

`effective_STR`, `effective_MAG`, and capacity-scoped `effective_VIT` follow the accepted typed
modifier rules. A modifier applies only when its declared scope matches the derived value being
calculated.

An awakening recomputes maximum Health but does not refill current Health. Current Health remains
unchanged unless it exceeds the new maximum, in which case ordinary clamping applies. The same
no-free-refill rule will apply to Mana after its table is accepted.

### What awakening does not multiply

The awakening table does not multiply:

- armour or other flat equipment power;
- mitigation, evasion, hit probability, critical probability, or proc probability;
- action-rate or movement-speed ceilings;
- skill mastery, ingredient rarity, crafting quality, or experience rewards;
- flat authored damage and healing that explicitly bypass attribute scaling.

These are bounded ratios, separate progression systems, or authored flat terms. Applying the
awakening multiplier to them would double-count progression and make the tier harder to explain.

## Shared leveling through two macro paths

Hero level and experience are shared progression concepts. Combat and Crafting are the two initial
macro paths, not separate level tracks. A hero's initial path describes their starting competency
package and likely work; it does not prevent learning skills or earning valid experience across the
other path.

Later differentiation comes from practiced skill families and authored specializations. Combat may
separate into martial, magical, defensive, or other roles. Crafting may separate into forging,
cooking, alchemy, enchanting, gathering, or other production families. Those specializations are
not encoded into the two-value macro-path field prematurely.

### Combat experience

Combat experience may be awarded for:

- contributing to the defeat of a mechanically relevant enemy;
- completing an encounter or combat objective;
- authored first-clear, boss, or challenge evidence.

The system does not award all experience to the actor who lands the last hit. A deterministic
participation rule identifies eligible contributors. Threat, encounter difficulty, novelty, and
authored reward rules may scale the grant. Trivial or repeatedly farmed encounters receive bounded
or decaying rewards.

### Crafting experience

Crafting experience is awarded when a valid item or food result is completed, not when an attempt
starts or ingredients are merely reserved. The content definition supplies a base difficulty. The
receipt records the consumed ingredient rarities, completed result, quality, novelty, and
repetition state.

The eventual tuning function has these explicit inputs:

```text
craft_experience = f(
  recipe_difficulty,
  consumed_ingredient_rarity,
  result_quality,
  first_success_or_novelty,
  repetition_decay
)
```

Higher recipe difficulty and rarer consumed ingredients increase experience. A first successful
creation receives a discovery bonus. Repeated production of an easy known recipe decays toward a
small floor so useful routine work is acknowledged without becoming the dominant leveling exploit.
Failed attempts may produce skill-practice evidence, but they do not grant completed-result hero
experience.

Cooking follows the same contract as forging: a completed new food instance is a crafting result,
and the first successful recipe result may receive the novelty bonus. Skill mastery remains a
separate progression track from hero level.

## Interaction between XP, stars, and awakenings

The progression sequence is deterministic:

1. An activity emits typed combat or crafting evidence.
2. The progression owner validates and grants hero experience.
3. Experience may cross one or more level boundaries, up to level 999.
4. Each crossed level grants the immutable star count in unallocated attribute points.
5. Crossing a hundred-level boundary changes the derived awakening tier.
6. Derived attribute conversions use the new tier on subsequent resolution.

An experience source never writes attributes, stars, awakening tier, Health, or combat state
directly. Attribute training may separately emit a typed direct-growth claim, but that claim does
not pretend to be level experience.

## Balance consequences

The additive ladder reaches ×2.8 at level 900. It is intentionally much gentler and more regular
than Overgeared's documented Strength attack ladder, which reaches ×8 by the fourth awakening and
uses different irregular ladders for different outputs.

Because all existing applicable points receive the current rate, an awakening rewards attributes
earned through training as well as points earned from levels. Immutable stars already create a
linear difference in level-earned point budgets, so the awakening ladder remains additive rather
than compounding.

Physical and magical attribute power share one rate. Health keeps the same 1:5 rate relationship
at every tier. Matched-tier peer pacing therefore remains understandable before equipment, action
cadence, skills, accuracy, criticals, mitigation, and resistances are applied.

Flat equipment does not awaken with the hero. Equipment content must therefore be benchmarked at
every awakening if the intended hero-to-gear power contribution is to remain within a target band.
The design does not assume a fixed 65:35 ratio without those tables.

## Compatibility and convergence

This design supersedes these earlier new-content proposals:

- star-dependent level caps of `10, 20, 30, 40, 50, 70, 99`;
- star promotion and star stones;
- separate native-star and current-star progression state;
- kill-only hero experience;
- one level-earned attribute point for every hero;
- attribute schemas capped at 100;
- progression benchmarks that stop at level 99.

Historical contracts and replay snapshots retain their original fields and meanings. Migration
creates a new rules version and compatibility projections; it does not rewrite stored history.

The implementation plan must reconcile the progression wiki, affinity awakening rules, summon
bands, hero visual-evolution language, milestone fixtures, contracts, engine progression, reward
claims, and presentation. Until that plan lands, current runtime caps and promotion behavior remain
prototype behavior rather than evidence that this design was implemented.

## Verification requirements

Before promotion, automated tests and a balance harness must prove:

- exact tier boundaries at levels 99/100 through 899/900 and the level-999 ceiling;
- exact power and Health rates in all ten table rows;
- identical conversion for level-allocated, trained, and otherwise granted attribute points;
- no awakening multiplication of ratio stats or flat equipment values;
- exactly N points for each crossed level on an immutable N-star hero;
- absence of any command or reward that changes hero stars;
- deterministic combat and crafting XP receipts, including multi-level gains;
- no XP on reserved ingredients, canceled craft attempts, or invalid combat evidence;
- higher difficulty and ingredient rarity never reduce an otherwise identical craft reward;
- repetition decay cannot become negative and routine crafting retains its authored floor;
- historical replay and schemas remain unchanged.

Simulation fixtures must include Combat and Crafting heroes at levels 1, 99, 100, 199, 200, 499,
500, 899, 900, and 999, across low and high immutable star ratings and with substantial
non-level-earned attributes.

## Deferred companion decisions

The following are intentionally separate design slices rather than unspecified implementation
choices:

- the exact Mana-per-Magic table and combat/out-of-combat refill rhythm;
- whether selected awakenings also unlock skill grades or other qualitative capabilities;
- final XP constants, contribution weights, and anti-farming decay values;
- summon-channel odds for immutable 1-star through 7-star heroes;
- whether the macro path is selected, generated, or inferred from the initial skill package;
- replacement visual evolution triggers now that stars cannot change;
- equipment budgets and target hero-to-gear contribution at each awakening.
