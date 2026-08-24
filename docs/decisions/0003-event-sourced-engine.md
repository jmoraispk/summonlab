# ADR 0003: Canonical event-sourced engine with optimistic commands

**Status:** accepted for the Phase 2 engine foundation on 2026-08-23.

## Context

Heroes, policies, browser controls, scheduled work, and later model jobs can all propose actions at
nearly the same time. None may mutate game state directly. A run must be recoverable after a crash,
inspectable when a surprising choice occurs, and exactly replayable even when a phone was absent.
The Phase 1 journal is useful to a player but intentionally omits the full reducer state and cannot
be the authoritative log.

## Decision

The engine is a pure package. It receives a parsed state and a typed command, checks actor-specific
legal actions and expected run version, emits authoritative events, and reduces those events into a
new parsed state. Entropy is an immutable `{ seed, cursor }` value; every stochastic decision names
its purpose and records the draw in the event. The engine imports no database, network, browser,
wall-clock, or model SDK code.

PostgreSQL stores accepted commands, an append-only event stream, and a snapshot after each event.
Each event records the SHA-256 hash of the state immediately before and after reduction. Commands
carry a stable UUID for idempotency and an `expectedVersion` for optimistic concurrency. A row lock
serializes competing transactions; after the first command commits, another command aimed at the
old version receives a typed stale-state response with the latest version, cursor, and hash.

The readable Phase 1 journal remains a projection. Destination and arrival changes write the
canonical engine stream and that projection in the same transaction. Development-only routes can
rebuild the full run and submit diagnostic commands; they default off in production.

## Consequences

- An action log plus the initialization event is sufficient to rebuild and verify current state.
- Duplicate delivery returns the original accepted commit without consuming entropy twice.
- Late model or browser responses cannot silently overwrite a newer decision.
- Policies may choose only from engine-owned legal actions and never invent rewards or state.
- Schema/content migrations must preserve or explicitly version reducer behavior.
- Per-event snapshots are intentionally simple for the prototype and may later be compacted while
  the append-only event stream remains authoritative.
