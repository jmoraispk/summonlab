# ADR 0029: Directions are witnessed engine records

Status: accepted on 2026-08-24.

## Context

Passing a player's free text directly beside a model request makes the instruction disappear after
the call, obscures who actually heard it, and invites prompt text to be mistaken for game authority.
Summonlab needs directions to matter across offline simulation and agent decisions without letting
them create actions, reveal hidden state, or force obedience.

## Decision

- `engine-v10` / `society-v4` stores the original direction text, structured priorities, intended
  recipients, private/open delivery, actual witness observations, and one explicit scope:
  `decision`, `mission`, `day`, or `until_revoked`.
- Issuing or replacing a direction is a manual engine command. Every intended recipient must be an
  active, available, co-located witness. Open delivery may add only equally available bystanders.
  Replacement atomically terminalizes the prior record; revocation preserves its history.
- Day scope schedules expiry at the next game-day boundary through the ordinary schedule table and
  `simulation.advanced` event path. Decision scope is consumed by the first engine-applied hero
  action that cites it. Mission scope is projected only into mission packets; later mission
  lifecycle events will own its terminal boundary.
- Packet assembly quotes only active, witnessed records relevant to the deciding hero and decision
  kind. A direction is data inside the packet, never concatenated system instructions. Policies may
  score it only against the legal-action list already supplied by the engine.
- Applied hero actions produce event-derived `advanced`, `conflicted`, or `unavailable` influence
  records. The journal reads that record instead of assuming every cited direction succeeded.
- `POST /api/runs/:runId/directives` issues, replaces, or revokes records. The summon chamber offers
  the same four lifetimes, and replay exposes delivery, terminal state, schedule, and influence.

## Consequences

Directions survive process restarts, offline catch-up, and strict replay with inspectable provenance.
The player can attempt to influence a hero while refusal, conflicting priorities, and unavailable
affordances remain real outcomes. Exact text can never enlarge the legal move set.

`engine-v1` through `engine-v9` retain their original parsers and bytes. `engine-v9` conversation
preferences remain readable; new general direction lifecycle state exists only in `engine-v10`.
