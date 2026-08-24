# ADR 0004: Preserve replay schemas across survival-state evolution

Status: accepted on 2026-08-23.

## Context

Phase 2 adds needs, activities, schedules, resources, inventory, durability, progression, injury,
death, and game over to the authoritative state. Silently adding defaults to an existing replay
would change its canonical JSON and therefore every stored state hash.

## Decision

- Persisted `engine-v1` state and event payloads remain immutable and replay through the original
  reducer and schemas.
- New runs initialize as `engine-v2` and include the survival-state model.
- Commands are dispatched by state schema version. Unsupported survival commands are never exposed
  as legal actions for a v1 run.
- Scheduled work is persisted separately for efficient due-work lookup, but its creation,
  resolution, and cancellation are derived only from authoritative events.
- The engine accepts explicit simulated timestamps. Wall time and offline catch-up orchestration
  stay outside the pure reducer.

## Consequences

Earlier runs keep byte-stable hashes and remain inspectable. New mechanics can evolve behind a new
content/state version without a covert migration. A future explicit upgrade path, if worthwhile,
must itself be a versioned event and cannot rewrite prior history.
