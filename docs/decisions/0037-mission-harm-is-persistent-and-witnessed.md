# ADR 0037: Mission harm is persistent and witnessed

Status: accepted

Date: 2026-08-25

## Context

Mission guard already made danger legible, but an exposed hero could leave combat with unchanged
health, equipment, memory, and relationships. Applying those consequences later as prose would make
the browser or model—not the engine—the source of truth. Giving every resident knowledge of a wound
would also violate the social system's established witness boundary.

## Decision

- Add opt-in `engine-v16` without changing the bytes or replay rules of v1–v15 histories.
- Treat mission guard as the first protective layer. The impact that reduces guard to zero, and
  each later impact while it remains zero, applies persistent bodily harm.
- Derive damage, injury severity, equipped-main-hand durability loss, and permanent death inside the
  same deterministic round transition as the guard impact.
- Keep every consequence in an attempt-level aftermath ledger linked to the exact round event,
  source, target, location, health delta, item delta, and witness records.
- Give knowledge only to surviving, co-located summoned heroes. A wounded survivor witnesses their
  own injury; a dead hero cannot witness their death. Every witness receives an evidence-backed
  observation and a directed relationship change toward the Master.
- Make fatal hero harm end the attempt with the explicit `death` outcome, clear the dead hero's
  scheduled activity, and remove all future legal actions for that hero. The record remains after
  reload and under strict replay.
- Include witnessed mission injuries and deaths as high-salience memories in later hero decision
  packets. The model receives selected consequences through engine-owned context rather than a
  provider-owned conversation history.
- Use Floor 03's Red Tithe as the database-backed browser proof. Damage numbers and social deltas are
  provisional balance values; their event shape and witness semantics are the stable contract.
- Leave Master bodily harm and atomic run-ending game over to `MIS-009`.

## Consequences

Combat can now change who a hero is after the mission, not merely whether an objective succeeds.
The player can trace a wound from impact through damaged equipment, memory, and distrust without
granting magical knowledge to absent heroes. Permadeath is authoritative and replayable, while the
separate Master-death slice can reuse the same causal ledger without weakening its atomic game-over
requirements.
