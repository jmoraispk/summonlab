# 0044 — Player journal is a hash-bound event projection

## Status

Accepted — 2026-08-25

## Context

The canonical event log already contains the actions, sources, numerical deltas, mission state,
directions, and story changes needed for a player-readable history. Copying those facts into new
mutable state would create a second source of truth and would make old engine histories depend on a
new reducer. Generated prose also cannot be trusted to supply experience, rewards, levels, or
progress totals.

## Decision

- Project `player-journal-v1` from one contiguous authoritative event stream. Do not add a new
  engine version or mutate any replayed state.
- Give every entry the exact event type, replay cursor, resulting state hash, game day, action
  source, participants, mission/floor/attempt/round context, and typed facets.
- Derive reward, experience, level, skill, and other numerical changes only from validated
  `rewardDeltas`. Display their explicit before, after, and delta values; narration may summarize
  an event but never supplies a number.
- Derive cumulative party progress from mission transitions: roster size, attempts, deployments,
  rounds, objectives, discoveries, defeated threats, extractions, retreats, and casualties.
- Preserve manual, Countdown, Step, Continuous, directed, random, scripted, model, habit, and
  system sources. Record scoped directive outcomes and fallback doctrine changes or resolutions
  without repeating an unchanged doctrine on unrelated events.
- Derive story changes from authoritative branch, First Ember, mission, objective, discovery,
  holder-evidence, and validated-patch payloads.
- Hash the source event stream and the complete journal report separately. Filtering is a
  presentation lens over the full hash-bound report; it never rewrites totals or cursor identity.
- Expose the projection through replay, `GET /api/runs/:runId/journal`, and the mission UI. Support
  day, mission, floor, hero, event type, control source, and semantic-facet filters.

## Consequences

Existing v1–v20 histories gain a richer readable view without changing their bytes or hashes. The
UI can explain company growth, control, direction, story, and loss while always linking back to the
exact replay position. Projection changes remain versioned and independently testable; a future
projection revision cannot silently reinterpret `player-journal-v1`.

`/player-journal` creates a local prepared checkpoint with two real training completions, one
fallback doctrine, and Floor 01 preparation. The checked JSON evidence independently rebuilds the
same categories and proves exact strict replay. Runtime story mutation remains `MIS-015`.
