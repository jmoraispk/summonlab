# ADR 0016: Accelerated catch-up is one event path

Status: accepted on 2026-08-24.

## Context

Hearth 01 should continue at four game minutes per real minute while the browser is closed. Wall
time cannot enter the pure engine, and returning later cannot invoke a second, approximate
simulation that diverges from online play. Multiple web or worker processes also need to avoid
resolving the same due work twice.

## Decision

- Every engine run has a persisted clock projection with a configurable `0×`, `1×`, `2×`, `4×`,
  or `8×` speed, a game-time anchor, a real-time anchor, the last catch-up time, and one renewable
  catch-up lease. New local runs use the configured `4×` default.
- Wall time remains an orchestration input. The database and worker project an explicit target game
  time from the two anchors; only that target enters a validated engine command and canonical
  event. The engine still imports no database, network, or wall-clock API.
- `simulation.sync.clock` is a system-only command for advancing through an interval with no due
  work. It is legal only on `engine-v5`, only for the living Master, and only before the earliest
  pending schedule. Due work continues through `simulation.advance`.
- One pure `nextCatchUpCommand(state, target)` policy drives explicit reconnect catch-up and worker
  wakeups. It forms eligible daily plans, follows the deterministic habit policy, advances to each
  due event in order, and finally syncs the empty interval. Command IDs depend on run, version,
  action, and target rather than process or lease identity.
- Resolving a full target interval in one call must be byte-equal to invoking the same policy at
  each due time online. A dedicated engine test compares commands, events, state, and schedule IDs.
- Catch-up claims an expiring run lease, renews it while working, and releases it after reanchoring.
  A concurrent caller receives `lease_busy`; an expired lease is claimable by a replacement
  worker. Optimistic run-version checks still protect every individual command transaction.
- One batch advances at most one game day and 128 commands by default. Larger backlogs return
  `safety_limit` with their unconsumed real-time anchor intact, allowing bounded later batches
  without losing elapsed time.
- Manual time-advancing commands reanchor the persistent clock. Catch-up commands preserve the
  original projection until the batch is complete, preventing elapsed time from being counted
  twice.
- The worker polls only runs whose earliest persisted schedule is due at the projected game time.
  Reopening the play or replay route requests catch-up only after at least one whole game minute of
  backlog. The player API also exposes explicit catch-up and clock reads.
- The development replay lab exposes authoritative/projected times, backlog, next due time, lease
  state, and a six-real-hour/one-game-day proof action. Every resulting plan, routine, delta, and
  clock sync remains visible in the ordinary replay timeline.

## Consequences

The settlement can now progress online, in the background worker, or after reconnect without
changing simulation semantics. Catch-up currently stops at the deterministic habit boundary; real
agent jobs and their stop/resume lifecycle begin in Phase 5. SSE notification and the player-facing
return recap remain `SET-007`.
