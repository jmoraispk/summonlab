# ADR 0001: Use pg-boss for durable decision jobs

- Status: accepted
- Date: 2026-08-23
- Scope: Phase 0 foundation

## Context

Summonlab needs durable hero-decision jobs with leases, retries, stale-result rejection, crash recovery, scheduling, and observable failure states. PostgreSQL is already authoritative for runs and events. The Phase 0 choice was between maintaining an application-specific leased-job table and adopting pg-boss.

## Decision

Use pg-boss behind the `@summonlab/queue` package. Keep domain job payloads and stale-result rules in Summonlab contracts; do not leak pg-boss types into the engine.

The package uses a dedicated `summonlab_jobs` schema, retry and expiry policies, and PostgreSQL `LISTEN/NOTIFY` with polling as its fallback. A PostgreSQL integration spike claims a job without completing it, stops the claiming process, and verifies that a second worker receives and completes the expired job.

## Why

pg-boss already implements PostgreSQL `SKIP LOCKED` claims, expiry, retry, monitoring, concurrency, and optional notification wakeups. Reimplementing those mechanics would create a second reliability subsystem before game-domain scheduling exists. The official documentation explicitly distinguishes expiration from heartbeat-based crash detection and preserves polling as the delivery backstop.

## Consequences

- PostgreSQL remains the only Phase 0 infrastructure dependency.
- Summonlab still owns idempotency, expected run and hero versions, legal-action hashes, model deadlines, and deterministic fallbacks.
- Queue migrations run separately from domain migrations.
- The CI integration job is required evidence for crash recovery.
- Revisit only if measured contention, hosted-database limitations, or migration control make pg-boss unsuitable.

## Sources

- [pg-boss introduction](https://pgboss.io/introduction)
- [queue expiration and heartbeat behavior](https://pgboss.io/api/queues)
- [worker behavior and polling fallback](https://pgboss.io/api/workers)
