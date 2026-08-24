# ADR 0006: Visual approvals are append-only hash-bound records

Status: accepted on 2026-08-23.

## Context

Changing a static catalog status cannot preserve who made a visual decision, why they made it, or
which exact pixels they saw. Regenerated art can also retain an asset key while changing content,
making an earlier approval dangerously ambiguous.

## Decision

- Human decisions are stored in `summonlab_visual_asset_reviews`, outside authoritative game state.
- Every record contains an immutable review UUID, asset key, catalog version, exact asset SHA-256,
  `approved` or `revise`, a required note, reviewer label, and server timestamp.
- Reviews append; later decisions supersede earlier ones in the current projection without deleting
  history.
- The development API rejects unknown assets, stale catalog versions, stale hashes, and conflicting
  retries. Reusing a review UUID with the identical body is idempotent.
- Reviewers prefixed `test:` remain queryable for automated proof but are hidden from the default
  human review projection.
- Approval metadata never enters engine commands, events, snapshots, entropy, or replay.

## Consequences

An approval can be traced to exact bytes, stale decisions cannot silently bless regenerated art,
and automated tests do not pollute the visible human gate. Updating static catalog status and
producing optimized bundles remain deliberate follow-up steps after the representative visual set
is accepted.
