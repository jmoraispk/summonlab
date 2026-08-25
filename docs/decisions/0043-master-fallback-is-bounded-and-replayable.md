# 0043 — Master fallback is bounded and replayable

## Status

Accepted — 2026-08-25

## Context

Engine v19 made decision timing authoritative but used a provisional hold-first selector. Timing
alone could not express the player's intent, deliberately chaotic play, or the point at which
unattended control must stop. A runtime policy also cannot become a second game engine: it may
choose only from the current legal-action boundary, and replay must be able to reproduce that
choice without a model, browser, or wall clock.

## Decision

- Add opt-in `engine-v20` with a versioned fallback configuration captured into every decision
  window. The captured snapshot contains the policy, direction ID and text, ordered priorities,
  optional protected hero, safety settings, and configuration time.
- Keep timing orthogonal. `DirectedPolicy` deterministically scores engine-owned legal actions from
  ordered priorities and a bounded vocabulary, then uses a seed-bound hash tie-break. Unsupported
  direction is marked `unclassified`; it is never silently interpreted. `RandomPolicy` uses the
  run seed, decision ID, and legal-action hash to select reproducibly.
- Persist packet, legal-action, tie-break, policy-result, direction, classification, selected
  action, score, and explanation evidence on every fallback resolution. Strict replay recomputes
  the selection and rejects altered configuration, source, choice, or evidence.
- A safety stop atomically changes timing to `Wait`, records the blocked choice, and opens a new
  manual window. Configurable triggers cover Master health while retreat is legal, unclassified
  direction, a consecutive-fallback ceiling, and actions tagged irreversible. The player may
  disable each trigger.
- Mode or doctrine changes during an active window visibly pause that window and open a replacement
  with the new immutable snapshot. Manual takeover and already-committed mission actions retain the
  v19 boundary. Summoned heroes continue to choose independently.
- Keep all pre-v20 state, event payload, reducer, and hash dispatch immutable.

## Consequences

The browser can show why an unattended Master action occurred without exposing hidden reasoning,
and the same seed/state/window reproduces both policies byte-for-byte. Continuous mode now has
player-configurable ceilings, while deliberate uninterrupted play remains available. Future legal
actions gain irreversible protection by using the existing action tag; policies still cannot
invent commands or mutate state.

`/master-fallback` is the database-backed review surface. The checked report proves both policies,
all four safety classifications, action-source attribution, and strict replay. A filterable player
journal remains `MIS-014`.
