# ADR 0031: Mission attempts are hash-bound engine state

Status: accepted on 2026-08-24.

## Context

The Floor 01 package defines authoritative geometry and boundaries, but a playable run also needs
to know who is committed, whether they have crossed the threshold, what they have actually visited,
and whether they returned. Letting the client hold that lifecycle would permit duplicate parties,
offline routines during combat, arbitrary objective claims, and reward farming. Backfilling mission
state into old snapshots would also change their canonical bytes and invalidate historical hashes.

## Decision

- New runs use `engine-v11` and store the exact `tower-floor-01-v1` mission id, content version, and
  SHA-256 binding at bootstrap. Existing v1–v10 schemas and reducers remain unchanged.
- A mission attempt owns its deterministic id and ordinal, status, Master-first party, entry and
  extraction boundaries, member positions, visit/discovery knowledge, completed objectives,
  timestamps, and terminal outcome.
- Preparation requires the living Master and every selected living hero to be idle at the summoning
  gate. It enforces the package's 1–5 member limits. Preparation/deployment reserve those actors by
  removing unrelated legal actions; revision or cancellation is allowed only before deployment.
- Deployment places every member at the authored entry and records that visit. Retreat and
  extraction require all members at an authored boundary. Cancellation, retreat, and failure may
  create a fresh numbered retry; success is terminal for the package.
- Objective proof is system authority. The temporary development control may request it, but the
  server supplies the package's complete primary-objective set and a system source. Later mission
  turns will produce the same command without changing the boundary.
- Every lifecycle transition emits an immutable event. Replay recomputes the legal transition from
  prior state and command identity, compares it to the event payload, and then validates the exact
  content binding. Drift is a `ReplayIntegrityError` rather than an implicit migration.
- `/mission/:runId` renders state and submits lifecycle requests. It does not mutate party,
  positions, knowledge, objectives, or outcomes locally.

## Consequences

The prototype can now prepare, deploy, retreat, retry, and extract a party with exact PostgreSQL and
strict-replay evidence. Settlement and mission work cannot consume the same participant at once,
and a successful Floor 01 cannot be replayed as a second reward attempt.

Combat turns, discoveries, rewards, injury, and death remain subsequent tasks. The current
development-only objective proof exists to exercise the lifecycle and must be replaced by
`MIS-003` encounter resolution before it becomes normal gameplay. The threshold uses selectable
roster cards during preparation and scene figures after deployment; that presentation is reversible
pending product feedback.
