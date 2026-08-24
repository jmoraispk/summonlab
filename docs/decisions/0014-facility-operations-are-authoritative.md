# ADR 0014: Facility operations are authoritative

Status: accepted on 2026-08-24.

## Context

Hearth 01 already has hash-bound buildings, node and edge capacities, reserve systems, and a
dormant forge. Assignments and power cannot remain interface labels: later routines, catch-up, and
social consequences need one replayable answer to who works where and which systems are available.
Existing `engine-v1` through `engine-v3` histories must retain their original schemas and hashes.

## Decision

- New runs use `engine-v4`. Each building records its system, assignment station, role, capacity,
  sorted hero roster, baseline power state, and current power state. Each hero records the exact
  reciprocal assignment or `null`; schema validation rejects divergent rosters and terminal heroes
  with assignments.
- `settlement.assign.hero` and `settlement.unassign.hero` are Master commands. They emit
  `hero.assignment.changed`, preserve the previous assignment in the event payload, and update both
  sides of the relation atomically. Assignment is a duty roster in this slice, not implicit travel;
  the hero's physical node remains authoritative and separate.
- Assignment capacity comes from the authored station node. Full buildings expose no assign action,
  and command validation rejects over-capacity writes even if a caller constructs one directly.
- One reversible development power slot may be routed to any non-gate building through
  `settlement.allocate.power`. The resulting `settlement.power.allocated` event records every power
  transition and the complete sorted active-system projection. Reserve buildings fall back to
  reserve; the workshop falls back to unpowered.
- This slot proves the mechanics only. It does not spend or permanently bind the First Ember core.
  The irreversible story choice and its social consequences remain deferred to `SET-009`.
- A new v4 travel command reserves its target node and every route edge against other in-flight
  heroes. Node or edge saturation makes the command illegal; visual animation never owns
  occupancy.
- Hero death, including death during scheduled work, atomically removes the hero from the building
  roster and clears the assignment. Dead or synthesized heroes cannot be assigned or act.
- Powering the workshop adds `forge-system` to the authoritative active-system set, making the
  authored forge edge reachable. Reallocating power removes that access again without changing the
  settlement content hash.
- The replay lab exposes roster counts, roles, current power, assignment controls, the forge route,
  and the resulting hash-verified events. Database storage remains generic event/snapshot JSON, so
  no persistence migration is required.
- The `engine-v1`, `engine-v2`, and `engine-v3` schemas and reducers remain in the discriminated
  union. Dedicated tests rebuild immutable v2 and scheduled-travel v3 streams under their original
  hashes.

## Consequences

Settlement jobs and system access now have one deterministic source of truth that later habit and
offline-catch-up slices can consume. The current assignment does not yet generate work, needs, or
relationships; those effects belong to `SET-005`. Capacity is enforced for new travel reservations,
but multi-hero movement and release-on-arrival pressure need broader party fixtures in later slices.
