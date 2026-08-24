# ADR 0019: The First Ember is an irreversible engine choice

Status: accepted on 2026-08-24.

## Context

Floor 01 is meant to return one scarce ember core to Hearth 01. The settlement has three immediate
needs—food, recovery, and preparation—and the Master’s first allocation should create a legible
identity for the run. `engine-v4` proved building power and route access with a reversible
development control, but using that control for the story reward would make the decision cosmetic
and would let later balance changes rewrite old outcomes.

Heroes also need to respond as people. Their response cannot come from hidden model sentiment or a
fresh random roll: it must follow from the mind, needs, health, and explanation that existed when the
Master made the choice.

## Decision

- New runs use `engine-v6`. Immutable v1–v5 histories continue through their original schemas and
  reducers.
- The First Ember has three engine-owned lifecycle states: `unrecovered`, `available`, and
  `committed`. A system command records recovery from `tower-floor-01`; a player command may then
  commit the core exactly once.
- The only targets are kitchen, dormitory, and training ground. The workshop is intentionally not a
  First Ember option.
- The command records both facility and the Master’s stated rationale: feed everyone, protect
  recovery, or prepare for the tower. A mismatched explanation is legal but affects reception.
- Each active hero receives a deterministic immediate response derived from observable needs,
  injury, stored values, drive, agreeableness, and rationale fit. The event persists stance, score,
  summary, and inspectable factors. Durable beliefs and relationship changes remain Phase 5 work.
- The event persists the exact balance modifiers used by the run:
  - kitchen adds 15 hunger recovery to meals;
  - dormitory adds 20 fatigue and 5 health recovery to rest;
  - training adds 4 hero XP and 3 sword XP while reducing the injury threshold by 7 points.
- Commitment owns the settlement power slot and recomputes active systems. `engine-v6` exposes no
  reversible development-power command.
- The server presentation includes the bounded First Ember state. The normal player route offers a
  temporary Floor 01 story bridge, a three-option council, a light irreversible warning, the
  Master’s explanation, mechanical effects, and hero responses. Replay exposes the same event path
  as a development instrument.

## Consequences

The settlement now changes permanently in a way that is useful the following day and readable at
the moment of choice. Different minds can receive the same facility decision differently without a
model call, while exact replay recomputes and verifies every response and modifier.

The current recovery button stands in for the not-yet-built Floor 01 mission. Phase 6 must issue the
same system command from the authoritative mission reward rather than inventing a second core path.
Phase 5 may turn the recorded response into beliefs, conversation, and relationship effects, but it
must treat this event as provenance and must not recalculate the historical reaction.
