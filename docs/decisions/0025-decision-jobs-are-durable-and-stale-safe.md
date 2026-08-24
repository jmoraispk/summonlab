# ADR 0025: Decision jobs are durable and stale-safe

Status: accepted on 2026-08-24.

## Context

A policy call can outlive the state that produced its prompt, fail after spending provider tokens,
or disappear with a worker process. A queue delivery alone cannot prove what context was used, how
many calls occurred, why a fallback ran, or whether a result was safe to apply. Summonlab also needs
free deterministic development and replayable engine consequences even when a model is unavailable.

The invariant remains unchanged: a policy chooses from engine-owned legal actions and never mutates
game state. The durable lifecycle must preserve that boundary across retries, crashes, and replans.

## Decision

- PostgreSQL owns every `decision-job-v1` packet, state/legal-action hashes, attempt, transition,
  failure, result, and application receipt. pg-boss carries only the decision job ID and acts as a
  wake-up mechanism.
- The inspectable lifecycle is `created → queued → in_progress → completed → validated → applied`,
  with explicit `retry_wait`, `fallback`, `stale`, `replanned`, and `failed` branches.
- A claim creates a leased attempt. Expired worker leases and stranded queue reservations return to
  an eligible durable state. Provider calls are bounded to two attempts in the prototype; exhaustion
  selects the packet-bound scripted policy once. Scripted failure is terminal.
- A persisted `completed` result is independently resumable, so a worker crash between policy
  completion and engine application does not strand or repeat the provider attempt.
- The worker rejects stale state, cursor, hash, or legal actions before a policy call. Application
  locks the current run, checks the same boundary again, converts the selected action to a typed
  engine command, and commits it atomically. A completion that became stale is never applied.
- Stale jobs assemble a new packet from current state and link a bounded replacement chain. The old
  job becomes `replanned`, retaining the complete audit trail.
- Settlement travel remains generic in the global engine legality path used by simulation. Decision
  packets expand it into exact destination action IDs so a policy cannot smuggle a node ID through
  free-form output.
- The existing First Choice proof projection is updated in the same transaction as its authoritative
  engine command. Engine events and replay remain the source of truth.
- The default runnable path is a zero-cost scripted job. Model jobs require model mode, a local API
  key, and explicit cost acknowledgement; the independent preview from ADR 0024 remains non-applying.

## Consequences

The browser can disappear after queueing without owning progress. Every provider attempt and
fallback is attributable, duplicate queue deliveries cannot duplicate engine consequences, and a
late response cannot overwrite newer play. Local and CI tests exercise the full lifecycle without a
provider key, including timeout fallback, lease recovery, pre-call staleness, post-call staleness,
replacement, application, and strict replay.

The prototype intentionally uses a short fixed retry ladder and deterministic fallback. Adaptive
provider routing, player-facing retry controls, price reporting, and quality thresholds remain later
evaluation work.
