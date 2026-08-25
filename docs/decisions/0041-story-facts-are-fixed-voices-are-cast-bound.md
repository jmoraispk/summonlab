# ADR 0041: Story facts are fixed and voices are cast-bound

Status: accepted

Date: 2026-08-25

## Context

The five Floor 01–05 packages already contained local beats, required anchors, optional proposals,
and one patch slot each. They did not form one cross-floor graph, so the runtime could not prove
which beat became eligible after a prior floor. The local envelopes also described optional
role-expression proposals without a mechanism for binding them to an actual living, informed
summon.

Allowing a model to infer either causality or speaker knowledge would make a lively line capable of
inventing history. Flattening all content IDs globally would also be unsafe because floor-local
discovery names may intentionally repeat.

## Decision

- Compile the five runtime mission bindings into the content-addressed
  `tower-band-01-story-v1` envelope. It owns five world laws, opening facts, 35 beats, a 25-beat
  required route, 25 immutable anchors, ten optional proposals, five bounded patch slots, five
  character-expression hooks, finale constraints, mission-scoped content bindings, and the exact
  1,010-point reward budget.
- Add a dependency from each later floor opening to the prior floor extraction. Beat eligibility is
  a pure function of the envelope plus a bounded history containing unlocked floor, completed
  beats, and activated authored proposals.
- Reject impossible completed histories, unknown or premature proposals, optional beats without an
  activation, and patch-slot selections over their authored maximum.
- Bind expression only to a living character who knows the selected anchor. Rank an allowed frame
  from that character's personality, value, drive, stress response, aptitude, social style, and
  habit. Stable IDs break ties.
- Keep the immutable fact separate and include it verbatim in every deterministic expression.
  Personality may change the prefix, frame, delivery brief, and physical habit gesture; it cannot
  add an event, grant knowledge, or change causality.
- Scope discoveries and reward grants by mission in the band catalog. Enemy policies remain a
  deduplicated shared catalog.
- Publish a checked report and development-only `/story-envelope` inspector using two real,
  reproducibly generated summons. This slice does not mutate game state. `MIS-015` remains
  responsible for validating, committing, and replaying an actual runtime `StoryPatch`.

## Consequences

Authored story structure is now deterministic and content-addressed across a complete band. A
future director can receive explicit eligible choices instead of free-form authority, and a cheap
character model can receive a knowledge-safe expression hook instead of an invitation to invent
facts. Until `MIS-015`, the optional selection shown by the inspector is evaluation evidence rather
than canonical run history.
