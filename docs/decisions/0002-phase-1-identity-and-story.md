# ADR 0002: Independent identity streams and bounded story branches

**Status:** accepted for the Phase 1 proof on 2026-08-23.

## Context

Summonlab needs people who can feel physically and psychologically distinct without treating
appearance, ancestry-coded phenotype, rarity, capability, or morality as proxies for one another.
The player also needs agent decisions to change the story without allowing a policy or model to
invent world state, rewards, or an entirely new campaign contract.

## Decision

Character generation uses a versioned seed plus separate entropy cursors for identity, body,
features, styling, mind, and rarity. Locking or rerolling one channel does not consume entropy from
another. The canonical physical manifest is hashed with SHA-256; the mind, habit, and first policy
choice are deterministic products of the same recipe but are not inferred from phenotype.

The initial story uses the fixed `first-ember-v1` envelope. It requires a summon, an observation,
and a legal first destination before Floor 01 can open. A hero may select the kitchen or training
ground, opening a durable named branch. The choice changes route and later eligible beats while the
fixed campaign goal and causal rules remain intact.

Four orchestration modes are exposed at the same policy boundary:

- Autonomous resolves the scripted policy immediately.
- Seeded random resolves one legal action replayably.
- Wait holds until the player asks the hero to take one step.
- Countdown accepts direction for five seconds and then resolves.

A player direction changes policy scores on a best-effort basis. It never becomes a direct state
mutation or a guarantee that the hero complies.

## Consequences

- Same recipe and content version reproduce the same manifest bytes, hash, mind, and first choice.
- Appearance can evolve independently from personality-system implementation.
- Generated or hand-authored art is an approved view of a manifest, not the authority for identity.
- Runtime story generation must submit bounded patches against an authored envelope.
- A later model policy can replace scripted scoring without changing legal actions, persistence, or
  the event journal.
