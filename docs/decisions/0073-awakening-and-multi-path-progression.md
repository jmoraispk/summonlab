# 0073 — Awakening and multi-path progression

**Status:** Accepted

**Date:** 2026-09-12

## Context

The engine-v25 capability prototype established four combat-first attributes, and engine-v26 added
operator-owned readiness combat. Its temporary progression assumptions—a `1..100` intrinsic band,
one point per level, a level-99 ceiling, and upgradeable stars—cannot support the intended long
horizon or heroes who grow through skilled work as well as combat.

Overgeared research supplied a useful pattern: keep derived equations stable while a visible table
changes each attribute point's conversion rate at hundred-level awakenings. Its published constants
are incomplete and revised across chapters, so Summonlab needs its own complete, deterministic
table rather than copying them.

## Decision

New heroes use `hero-progression-v2` under `engine-v27` and a content-hashed
`progression-rules-v1` binding.

- Hero levels are integers `1..999`; awakening tier is `floor(level / 100)`, from 0 through 9.
- A generated `1★..7★` rating is immutable and grants exactly that many unallocated attribute
  points for every crossed level after level 1. Stars never upgrade.
- Direct intrinsic growth may also enter through typed allocation, training, achievement,
  consumable, or cultivation claims. Point vintage never changes its current conversion rate.
- The character-sheet order is `STR`, `AGI`, `VIT`, `MAG`; full names are Strength, Agility,
  Vitality, and Magic. There is no Body/Mind classification.
- Power-per-Strength/Magic rates are
  `[1.0, 1.2, 1.4, 1.8, 2.2, 2.6, 3.2, 3.8, 4.4, 5.0]`.
- Health-per-Vitality rates are `[5, 6, 7, 9, 11, 13, 16, 19, 22, 25]`.
- Fixed-point integers own authoritative calculations. Awakening does not multiply Agility ratios,
  armour, resistance, accuracy, cadence, flat equipment/effect values, skill mastery, XP, craft
  quality, or affinity ratios.
- Combat and Crafting are the first macro-path identifiers, not exclusive classes. Both award one
  shared hero XP track from completed, meaningful evidence. Forging ships first; cooking and other
  production work may use the same completion contract.
- Combat credit is contribution-based rather than last-hit-based. Crafting credit scales from
  difficulty, consumed ingredient rarity, result quality, novelty, and bounded repetition.
- Hero XP and skill practice are separate receipts even when one completed action grants both.

Both the `legacy-auto-v1` and `agent-readiness-v1` engine-v27 adapters submit resolved combat facts
to the shared progression owner. Their historical v25 and v26 states remain frozen and replay under
their original schemas.

## Versioning and balance policy

The current numbers are a testable launch hypothesis, not a timeless promise. A buff or nerf
publishes a new immutable rules table and content hash while preserving the state schema and prior
receipt replay. The checked evidence includes boundary levels, all ten rates, both star extremes,
non-level growth, multi-level receipts, both macro paths, craft monotonicity and repetition floors,
and an alternate data-only rate table.

## Consequences

- One point at levels 900–999 contributes five times the tier-0 power/Health conversion.
- Old allocations and non-level growth step up together at awakening thresholds, producing visible
  power moments without point-vintage bookkeeping.
- High-star heroes accumulate larger level-earned budgets, while every hero can reach level 999
  and can grow through either macro path.
- Final XP pacing, Mana conversion, movement ceilings, affinity effects, equipment budgets, and
  deeper Combat/Crafting subclasses remain separately versioned design work.

## Evidence and related records

- [Progression balance evidence](../evidence/progression-balance-v1.json)
- [Accepted design](../superpowers/specs/2026-09-12-awakening-and-multi-path-progression-design.md)
- [Implementation plan](../superpowers/plans/2026-09-12-awakening-and-multi-path-progression.md)
- [Progression wiki](../wiki/mechanics/progression/README.md)
- [Overgeared research](../wiki/research/attribute-systems/overgeared/README.md)

## Supersession

For new rules, this decision supersedes ADR 0072's `1..100` intrinsic ceiling, one-point-per-level
default, and Might/Spirit labels. The accepted correction is Strength/Magic. It also supersedes
older level-cap and star-promotion proposals. Historical v1–v26 state and replay remain versioned;
no persisted history is rewritten.
