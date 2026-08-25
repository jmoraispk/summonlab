# ADR 0045: Runtime story patches select authored truth

Status: accepted

Date: 2026-08-25

## Context

The first-band story envelope already separates 25 required beats from ten optional proposals and
places one bounded aperture on each floor. That content model did not yet answer the runtime
question: how can a StoryDirector react to the actual cast and player behavior without acquiring
authority over causality, mission geometry, rewards, or game state?

A free-form model response is not a safe command. Even a catalogued proposal becomes unsafe when
it was assembled against stale history, exceeds the slot maximum, assigns knowledge to the wrong
hero, or arrives after the closing anchor. A readable narrative choice also needs the same
append-only event and strict replay guarantees as combat and progression.

## Decision

- Add opt-in `engine-v21` state that binds `runtime-band-story-v1` to the exact
  `tower-band-01-story-v1` content hash. Historical engine versions remain immutable.
- Treat `StoryPatchCandidate` as a strict selection contract, not generated world state. It may
  name one or more catalogued proposals within a slot, bind a role-expression proposal to a hero,
  and carry public intent. Unknown fields are rejected.
- Validate 17 explicit boundaries against the current canonical history and cast: envelope,
  causal history, freshness, known/open slot, cumulative selection maximum, proposal catalog and
  dormancy, role shape, living cast, holder-owned knowledge, world laws, primary objective, arena
  truth, reward budget, required anchors, and finale constraints.
- Count already activated proposals against the slot maximum. A later candidate cannot fill the
  same aperture merely because it selects only one proposal itself.
- Derive role eligibility from engine-owned evidence held by a living hero. At the Floor 04 proof
  point, only the holder of `foundry-maintenance-route` may carry **A maintenance schematic**;
  **Which voice crosses the bridge** needs no knowledge role.
- Accept only a current, validated candidate through `story.apply.patch`. The engine emits
  `story.patch.applied` with the candidate, validation report, resulting history, patch hash, and
  ordinary before/after state hashes. Replay revalidates and recomputes the complete patch.
- Keep the StoryDirector outside the reducer. It may be scripted today or model-backed later; both
  use the same candidate schema and authority boundary.
- Expose the real database-backed checkpoint at `/story-patch`, plus checked deterministic and
  adversarial evidence. The prepared Floor 04 history is development-only; the committed patch is
  an actual authoritative event.

## Consequences

The cast can now alter which optional authored beat becomes canonical without authoring a new
fact. A player can inspect why the choice is valid, commit it once, reload it, find it in the
company journal, and rebuild the identical state from two events. Stale or authority-expanding
outputs fail before mutation, and a model provider can later replace the scripted director without
changing the engine contract.

This slice deliberately does not generate prose, arcs, missions, rewards, or geometry at runtime.
Future story work may expand the proposal catalog or add sparse director checkpoints, but every
new operation requires an explicit schema and engine validator rather than prompt-only policy.
