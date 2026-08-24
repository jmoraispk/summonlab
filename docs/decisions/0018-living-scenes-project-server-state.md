# ADR 0018: Living scenes project server state

Status: accepted on 2026-08-24.

## Context

Hearth 01 needs continuous day/night ambience, visible occupants, and distinct work, sleep, eat,
train, walk, and idle motion. Those effects must remain responsive between commits without creating
a second simulation in the browser. In particular, a moving marker cannot arrive early, an animation
cannot begin an activity, and wall-clock rendering cannot resolve scheduled work.

## Decision

- `SettlementPresentationSchema` is a bounded view contract. It contains the engine
  version/cursor/hash, projected game time and day phase, building power/rosters/physical occupancy,
  and one presentation pose per non-synthesized hero.
- `projectSettlementPresentation(snapshot, definition, projectedGameTime)` is a pure engine
  projection. It accepts the cached authoritative `engine-v5` snapshot, hash-bound settlement
  content, and persisted clock projection. It does not read wall time, mutate state, or emit events.
- Day phases use fixed UTC game-time windows: dawn 05:00–07:59, day 08:00–17:59, dusk
  18:00–20:59, and night otherwise.
- Pose precedence is terminal state, critical health, travel, explicit activity, routine, then idle.
  Activities and routines map to the small visual vocabulary without changing their domain kind.
- A traveling hero remains physically attributed to the authoritative origin building. The view may
  interpolate along the engine-provided node route, but progress is capped below one until the
  arrival event removes `currentTravel` and commits the destination node.
- `GET /api/runs/:runId/projection` catches up due work through the existing lease/event path, reads
  the latest cached snapshot and persisted clock, and returns only the parsed presentation view.
- The player refreshes that view after ordered SSE events and every 15 seconds while visible. SSE
  event payloads are animation cues, never reducer input. Cursor gaps still discard the view and
  reload the server snapshot.
- The painted `hearth-01-scene-v1` plate remains the base. Code-owned lighting, mist, building
  status, hero rig, activity effects, and occupancy ledger implement the living layers. Reduced
  motion freezes ambient and pose animation while preserving every state label.

## Consequences

The settlement can feel continuous while preserving replay authority and offline equivalence. The
same state hash explains the visible time, occupancy, and activity, and an SSE integration test proves
that a committed event refreshes the view cursor. The v1 scene supports only `engine-v5` runs; an
older run must use its compatible historical renderer rather than receiving invented defaults.

The current visual route has one approved identity rig and one settlement plate. Additional hero
anchors, collision-aware marker placement, interiors, and richer social clustering remain later
visual work; none requires a new state-mutation boundary.
