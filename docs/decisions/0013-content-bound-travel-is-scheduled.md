# ADR 0013: Content-bound travel is scheduled

Status: accepted on 2026-08-24.

## Context

Hearth 01 already defines a versioned route graph and a separate visual projection, while
`engine-v1` and `engine-v2` histories must keep their original state schemas and hashes. A hero must
be visibly able to move without allowing animation progress, browser timing, or hotspot geometry to
become game truth.

## Decision

- New runs use `engine-v3`; the state binds `hearth-01-v1` by settlement id, content version, and
  SHA-256 content hash. The active-system set is part of state, so the dormant forge remains
  unreachable under reserve power.
- `hero.start.travel` accepts a target node only while the hero is active, idle, and not already in
  transit. The engine resolves the route from the bound graph and active systems; callers cannot
  supply duration, edges, visual coordinates, or arrival state.
- `hero.travel.started` records the exact route, duration, origin, target, destination zone, content
  binding, deterministic travel/schedule ids, start time, and due time. It creates one persisted
  `hero.travel.arrive` schedule.
- Starting travel does not change `location` or `locationNodeId`. `simulation.advance` rejects a
  target earlier than the next due schedule and emits the only event that can commit arrival.
- Activity and travel schedules share the injected game clock and resolve deterministically by due
  time and id. Hero death cancels that hero's pending work and travel; Master death cancels all
  schedules atomically.
- Replay reduces recorded routes and arrival outcomes without consulting mutable visual state. The
  settlement definition is needed to validate a new travel command, not to replay its committed
  event.
- The replay lab exposes route start, pending schedule, unchanged origin, due time, content hash,
  and explicit arrival advancement. The Phase 1 walk remains presentation timed, but its database
  operation persists separate travel-start and clock-advance events.
- The `engine-v1` and `engine-v2` schemas and reducers remain in the discriminated union. No old
  event is rewritten or reinterpreted as an engine-v3 travel.

## Consequences

Pixi or CSS can interpolate along the authored path, pause, reconnect, or skip without affecting
the simulation. Offline catch-up uses the same `simulation.advance` reducer as online play, and
future capacity or occupancy checks can be added at the engine-v3 command boundary.

The first slice resolves the polished opening walk in one database transaction after its visual
timer. The replay lab preserves the two-step pending state for inspection. Worker-driven real-time
catch-up and route capacity are deferred to SET-006 and SET-004 respectively.
