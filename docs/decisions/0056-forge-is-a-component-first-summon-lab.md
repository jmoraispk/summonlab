# 0056 — Forge is a component-first summon lab

**Status:** Accepted

**Date:** 2026-08-28

## Context

The first owner playthrough integrated summoning, onboarding, settlement, mission return, and the
First Ember before the summoning interaction itself was understandable. Reviewing that whole route
made it difficult to distinguish a weak component from weak connective tissue. The owner proposed
iterating on the Forge first, comparing Normal, Advanced, and Special summons, then expanding the
enemy vocabulary and tower progression.

## Decision

- `/forge` is a development-only summon laboratory. It does not spend resources, persist a pull,
  start onboarding, or claim final economy odds.
- Normal, Advanced, and Special communicate explicit `1★+`, `2★+`, and `3★+` minimums. All heroes
  retain the same eventual `7★` promotion ceiling; rarity changes starting capacity, not human worth.
- Each channel initially exposes one fixed deterministic three-person review cohort. Every visible
  cohort member has a manifest-bound realistic portrait. Replaying the reveal tests timing without
  pretending that unbounded on-demand art generation already exists.
- Personality, rarity, and aptitude remain independent. The Forge labels aptitudes as potential,
  not learned skills, until starting proficiencies become authoritative engine state.
- Enemy art begins with four realistic family plates containing sixteen classic archetypes. Plates
  are approval candidates for anatomy, materials, silhouette, and family cohesion—not production
  combat rigs or proof of individual continuity.
- `tower-progression-preview-v1` gives Floors 1–20 a recommended level range, skill test, enemy
  roster, and new pressure. Later content follows the same per-floor contract and the approximate
  `ceil(floor × 0.7)` route to level 70 at Floor 100.

## Consequences

- The next owner checkpoint can judge summoning without replaying the campaign.
- Prices, final odds, pity configuration, batch variability, and on-demand portrait latency remain
  intentionally unresolved.
- An accepted family plate must still be split into manifest-bound enemy anchors, combat-scale
  silhouettes, states, and animation before runtime use.
- The campaign gate may reuse the accepted component only after its review decisions are recorded;
  this slice does not reopen the broader owner playtest automatically.
