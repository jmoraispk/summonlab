# ADR 0015: Routine life is deterministic and inspectable

Status: accepted on 2026-08-24.

## Context

Heroes need a life between player visits without spending a model call on every meal, stretch, or
shift. Their generated personality must matter, but personality cannot become an invisible excuse
for arbitrary state mutation. Daily life also has to survive offline catch-up and exact replay.
Existing `engine-v1` through `engine-v4` histories must retain their original schemas and hashes.

## Decision

- New runs use `engine-v5` and persist the summoned `CharacterMind` on the engine hero. The stable
  mind owns personality, value, drive, social style, stress response, aptitude, and daily-habit
  identity. A separate `HabitState` owns mutable strength, repetitions, satisfaction, and last-use
  time.
- `hero.plan.day` creates exactly four intentions for the current game day: the hero's habit, an
  assigned duty or self-directed activity, a meal, and sleep. A plan is not movement and does not
  teleport a hero; assignment and location remain independent authoritative facts.
- `hero.start.routine` does not accept a caller-selected action. The engine scores every pending
  intention from current needs, health, injury, assignment, available food, personality, values,
  drives, and habit strength. The event records every score, eligibility result, reason, winner,
  and margin.
- A margin of five or less exposes `decisionRecommended` as a future agent boundary. This slice
  still uses the deterministic score and ID tie-breaker, marks that fallback explicitly, and makes
  no model call. Phase 5 may intercept the boundary without changing the legal-move contract.
- Routine start emits a persisted `hero.routine.complete` schedule. `simulation.advance` resolves
  it through the injected game clock used by travel and activities. Meal resources are reserved at
  start; completion applies bounded health, need, or habit deltas and completes the exact plan
  entry.
- Hero or Master death cancels in-flight routines and resolves unfinished plan entries as skipped.
  No active entry or scheduled event can survive its actor's terminal state.
- The replay lab exposes the stable mind, mutable habit, four-entry plan, active routine, candidate
  score trace, fallback boundary, schedule, deltas, and hash chain. Storage remains generic JSON,
  so no database migration is required.
- Dedicated compatibility tests reconstruct v1, v2, v3, and v4 streams with their original schema
  and content versions.

## Consequences

Routine settlement life now has a zero-model-cost policy that is expressive enough to test habits
and environmental pressure while remaining reproducible. It is intentionally a manual-clock
checkpoint: accelerated real-time mapping, worker leases, and offline catch-up batching remain in
`SET-006`. Agent conversation, directives, social memory, and model-backed close decisions remain
in Phase 5.
