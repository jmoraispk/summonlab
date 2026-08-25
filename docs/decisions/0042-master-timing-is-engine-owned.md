# ADR 0042: Master timing is engine-owned

Status: accepted

Date: 2026-08-25

## Context

The opening proof exposed autonomy labels and a browser countdown, but mission commands always
resolved as manual `Step` input. A tab timer could therefore suggest that an action expired without
creating any authoritative deadline, decision identity, source, or replay evidence. It also mixed
two separate questions: when unattended control resolves and which policy selects the action.

The engine intentionally has no wall-clock access. Older event streams through `engine-v18` are
immutable replay evidence.

## Decision

- Add opt-in `engine-v19` with a `MasterControlState`: timing, configurable countdown duration,
  revision, decision ordinal, one active decision window, and the last resolution.
- Persist `Wait`, `Countdown`, `Step`, and `Continuous` independently from fallback selection.
  `Wait` accepts only a legal manual action; `Countdown` accepts manual input strictly before its
  deadline and fallback at or after it; `Step` permits exactly one immediate fallback and then
  changes to `Wait`; `Continuous` opens another fallback window while the mission continues.
- Inject observed ISO timestamps through commands. The engine derives deadlines and validates
  expiry without reading wall time. Those timestamps, sources, action evidence, outcomes, and
  resulting control state are committed in events and strictly recomputed during replay.
- Treat a mode change during an active decision as a visible pause of that exact decision, then
  open a replacement window at the same observed boundary. Committed mission rounds remain atomic.
- Open the first decision after deployment and the next decision after every nonterminal round.
  Mission extraction, retreat, failure, death, and game over close any remaining window.
- Use `master-timing-baseline-v1` as an explicitly provisional deterministic action selector for
  this slice. It prefers `mission.hold`, otherwise the lexicographically first legal action, and
  records hash-bound policy evidence. `MIS-013` owns directed/random selection and safety stops.
- Keep all pre-v19 schemas, payloads, reducers, hashes, and replay dispatch unchanged.

## Consequences

The UI may animate a countdown, but the persisted deadline is authoritative. A reload preserves
the same decision rather than restarting five seconds. Logs can distinguish manual takeover,
countdown expiry, one-shot Step, Continuous fallback, pause, and mission termination. Continuous
mode currently runs until paused or the mission ends; health-aware stops and richer fallback intent
must be added before it is considered a player-safe default.
