# ADR 0035: Cross-floor secrets are holder-specific engine evidence

Status: accepted

Date: 2026-08-24

## Context

Floor 04 authors a Foundry maintenance schematic and Floor 05 authors a route that requires that
knowledge. A shared UI boolean would let the party know something nobody discovered, lose who held
the memory, and make cooling and Warden armor impossible to verify through replay. The reviewed v1
Floor 02–05 packages also named monster-count entropy differently from their duty slots, so they
could be inspected but not executed by the deterministic spawner.

## Decision

- Keep every reviewed v1 mission package and hash immutable. Executable Floors 02–05 use v2 package
  bindings whose declared entropy includes `<duty-slot-id>-count` for every deployment duty.
- Introduce an opt-in `engine-v14` mission run with an availability list and persistent evidence
  records. Normal Floor 01 bootstraps remain on immutable `engine-v13` until progression owns later
  floor unlocks.
- Create `foundry-maintenance-route` evidence only when an actor legally resolves the Floor 04
  schematic affordance. Persist the holder, source mission version/hash, attempt, and round.
- Derive `relay-route-memory` only for the evidence holder. Matching discovery IDs do not transfer
  knowledge between floors or actors by themselves.
- A legal Floor 05 recall exposes the cooling-control route. Testing and operating the wheel are
  separate legal actions. The arena persists `lit`, `cooling`, and `quenched` furnace states.
- Resolve Warden armor against the arena state at the strike's actual initiative position. An
  exposed control operator gives the Warden an authored intercept intent along the control-to-heart
  edge.
- Persist discoveries and furnace changes in the round ledger and recompute the full payload during
  strict replay.

## Consequences

The route can be missed, and a different party member cannot silently inherit it. Cooling is a real
tactical commitment rather than a story patch, while direct damage remains legal. Old v1–v13 event
streams keep their original schemas and hashes. Later progression work must decide when Floor 04
and Floor 05 enter a normal run's availability list; development scenarios may opt in explicitly
for deterministic proof.
