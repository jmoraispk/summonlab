# ADR 0010: Recognition reviews are audit-bound evidence

Status: accepted on 2026-08-24.

> **Historical implementation:** ADR 0065 retires the procedural renderer and interactive route
> described here. Existing hash-bound evidence is preserved but is not a live approval surface.

## Context

ADR 0009 defines a repeatable human recognition audit but originally left its seven case decisions
outside the system. A screenshot cannot preserve which cues passed, which case needs revision, who
made the judgment, or whether the underlying catalog, manifest, source art, or runtime derivatives
changed afterward. Reusing the asset-approval verdict would also collapse two different questions:
whether one controlled state remains recognizable and whether source art is ready for production.

## Decision

- Recognition reviews are append-only PostgreSQL records in
  `summonlab_visual_recognition_reviews`, outside authoritative game state.
- Every record binds a UUID, catalog version, character, case, and complete cue outcome set to the
  exact recognition-audit SHA-256. It also stores an overall `pass` or `revise`, required note,
  reviewer label, and server timestamp.
- The development API accepts only the current checked-in audit and requires its exact cue set for
  the selected case. Stale hashes, unknown cases, missing cues, extra cues, and conflicting retries
  are rejected. Identical UUID retries are idempotent.
- Every claimed cue must receive an explicit `pass` or `fail`. An overall pass cannot contain a
  failed cue; a reviewer may still request revision when all individual cues pass for a qualitative
  issue captured in the note.
- Later records supersede earlier records only in the current per-case projection. History is never
  rewritten or deleted.
- Reviewers prefixed `test:` remain queryable for automated proof but are hidden from the default
  human projection.
- A complete set of passing recognition reviews is evidence, not asset approval. It cannot update
  catalog status, export a candidate, mutate a character manifest, or enter engine replay.

## Consequences

`/visual-lab/recognition` now shows durable progress across all seven cases, restores the latest
case judgment, and records cue-level evidence against the exact audit a human saw. Contract,
PostgreSQL, API, and phone-browser tests cover uniqueness, pass/fail consistency, append-only
history, idempotency, stale hashes, and exact cue sets.

Mara's audit remains human-pending until a reviewer evaluates every case. Even then, approving or
revising the source asset remains a separate deliberate decision in `/visual-lab`.
