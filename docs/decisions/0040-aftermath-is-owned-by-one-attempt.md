# ADR 0040: Aftermath is owned by one attempt

Status: accepted

Date: 2026-08-25

## Context

`engine-v16` and `engine-v17` persisted mission consequences in one mission-level array. Every
record carried a round number, but no source attempt identity. The state validator then compared
every old consequence with only the newest attempt's round count. A legitimate Floor 04 retreat
could therefore make a newly prepared Floor 05 state invalid. Relaxing that validator would hide
the ownership ambiguity and leave future journal, recap, and social systems unable to attribute a
consequence correctly.

The serialized v16/v17 event streams are immutable replay evidence and cannot be rewritten.

## Decision

- Add opt-in `engine-v18` with `mission-aftermath-v3`; keep v16/v17 schemas, payload parsers,
  consequence bytes, reducers, and replay dispatch unchanged.
- Require every v3 hero or Master consequence to carry `sourceAttemptId`.
- Keep `aftermath.consequences` exclusive to the active attempt. Its `activeAttemptId` must equal
  the canonical mission attempt ID, and every current consequence must use that ID and a resolved
  round in that attempt.
- On preparation of a later attempt, atomically move the prior terminal attempt's consequences
  into an immutable archive with its binding, ordinal, outcome, timestamps, and final resolved
  round. Reset the active consequence list and bind it to the new attempt ID.
- Validate archived source IDs and round bounds against the archived attempt rather than the new
  attempt. Reject duplicate consequence IDs and duplicate attempt archives across the whole
  aftermath history.
- Permit a new v18 attempt after success as well as cancellation, retreat, failure, or death. Keep
  the previous success-terminal behavior unchanged for older engine versions.
- Publish a checked deterministic report and development-only `/attempt-aftermath` page. The proof
  runs Floor 04, records a real wound, retreats, prepares Floor 05, and strictly replays all 13
  events with one archive and zero active inherited consequences.

## Consequences

Persistent bodies and relationships remain canonical across missions, while event attribution is
attempt-local and unambiguous. Journal and recap work can display old consequences without
polluting current mission validation. The new contract adds an archive copy at each later
preparation; the 100-attempt and 1,000-consequence bounds keep that history finite until a measured
need justifies pagination or a separate chronicle aggregate.
