# ADR 0038: Master mission death seals the run

Status: accepted

Date: 2026-08-25

## Context

The Master could already choose movement, inspection, defense, and attacks inside authoritative
mission rounds, but mission impacts stopped at guard. The same character could die in settlement
simulation and atomically end the run, so keeping the Master invulnerable in the tower contradicted
both the game design and the shared terminal-state invariant.

## Decision

- Add opt-in `engine-v17` and `mission-aftermath-v2` without changing v1–v16 event bytes or replay
  rules.
- Treat the Master as an embodied party actor. The player chooses one legal Master action each round;
  summoned heroes continue to choose independently from their own packets.
- Apply exposed monster and environmental harm to canonical Master health and injuries in the same
  deterministic round that changes mission guard.
- Record Master harm with its source event, source actor or hazard, round, location, health delta,
  injury, fatality, and co-located hero witnesses. Only actual witnesses receive observations and
  relationship evidence.
- When Master health reaches zero, set Master life state to `dead`, the attempt to `death`, and the
  top-level run to `game_over` in one `mission.round.resolved` event. Clear every hero activity,
  travel, and routine; mark unfinished daily-plan entries skipped; and expose no further legal
  actions to any actor.
- Keep the terminal chronicle and strict replay readable after death. A game-over run cannot retry a
  mission; starting again requires a new run.
- Telegraph the Red Gallery's periodic slag hazard before the player commits the affected round.
  Exact damage and relationship deltas remain provisional balance values; atomicity and event shape
  are stable.
- Use `/last-command` as the database-backed browser proof. Leave decision timing and unattended
  fallback selection to `MIS-012` and `MIS-013`.

## Consequences

The player's battlefield decisions now carry the same physical stakes as the heroes' choices. A
fatal action produces one causal record from threat through body, witness memory, canceled life, and
terminal run status, and a forged partial outcome fails strict replay. The current checkpoint is
deliberately manual and severe; later control modes may warn or pause, but they cannot undo a
committed death.
