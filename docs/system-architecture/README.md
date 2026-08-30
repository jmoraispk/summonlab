# Summonlab shared system architecture

Status: **working product architecture**

Audience: subsystem owners, integrators, designers, and implementation agents

Last consolidated: 2026-08-29

This folder is the coordination layer for building Summonlab through parallel workstreams. It does
not replace the replay evidence, accepted ADRs, or detailed implementation history. It states the
target product shape, assigns ownership, defines the seams between systems, and records where the
new direction intentionally requires a versioned migration from the current prototype.

For product planning, the many engineering contexts roll up into five domains: Visuals; Tower,
World, and Story; Settlement and Society; Summoning, Progression, and Combat; and Town Master
Operations. A shared Foundation connects them. See the [system map](system-map.md) for the exact
mapping; do not confuse a bounded state owner with another top-level game subsystem.

## Start here

1. The [Summonlab Wiki](../wiki/README.md) is the readable rulebook, world bible, bestiary, and
   visual artifact index shared across workstreams.
2. [Vision and product rules](vision.md) defines the player role and the non-negotiable design
   properties.
3. [System map](system-map.md) defines vertical workstreams, horizontal capabilities, ownership,
   and dependencies.
4. [Integration contracts](integration-contracts.md) defines how systems exchange commands,
   events, receipts, evidence, and projections.
5. [Parallel roadmap](roadmap.md) defines the convergence work, independent lanes, integration
   slices, and per-system sequencing.
6. The [system briefs](systems/) hold each workstream's current model, interfaces, roadmap, open
   questions, and accepted feedback.

## Current product decisions

These statements reflect the latest owner direction. Where they conflict with old code or accepted
ADRs, old event streams remain immutable and a new ruleset or contract version must implement the
change.

- The player is the **town Master**, a nonphysical entity representing the player through the game,
  not a hero, resident, or ordinary party member. The Master can communicate with every owned hero
  and can inspect or listen to every canonical event in the owned town and connected expeditions.
  Heroes retain holder-specific knowledge and never become omniscient because the player is.
- Summonlab is a leadership game about acquiring people, building a home, forming parties, and
  deciding when they are ready to climb a randomized one-hundred-floor tower.
- Multiple persistent parties and concurrent expeditions are target architecture, even when early
  slices run only one party.
- Hero identity has separate layers: body and appearance belong to the visual manifest; stable
  personality, mutable affect, goals, habits, knowledge, and relationships belong to cognition and
  society.
- Player-facing portraits and conversations use realistic, identity-locked art. Code-native rigs
  remain useful for small settlement and tactical figures.
- The requested star caps are `10, 20, 30, 40, 50, 99, 999` for `1★` through `7★`. The large
  6★/7★ ranges require a new progression curve and cannot be dropped into the existing level-70
  balance unchanged.
- Tower difficulty rises smoothly around readiness anchors rather than discrete level walls. A
  4★ hero near level 40 should be credible around Floors 40–45, level 99 around Floors 85–90, and
  levels above 99 are mainly for the final push to Floor 100 and postgame.
- Skills form a discoverable graph and can be combined. Mechanical effects come from versioned,
  validated definitions; prose or a runtime model cannot invent an effect.
- Synthesis is irreversible and socially legible. It provides short-term compression but is never
  required for promotion. Keeping a hero is deliberately the stronger long-horizon strategy,
  although the game teaches that through consequences rather than a tutorial declaration.
- Gems are premium currency and can fund advanced summons. Currency, odds, pity, generation, and
  receipt changes are one atomic server-owned transaction.
- The settlement expands through discrete authored sectors and modules. A flying ship later unlocks
  persistent neighbor exploration, distinct from temporary portal-resource missions.
- The architecture must support up to 1,000 individually persistent heroes without simulating or
  calling a model for every hero every minute or every game day.
- The deepest player skill is designing behavior-motivating systems. Facilities, schedules, party
  goals, leadership, mentorship, feedback, rewards, and social norms should make purposeful
  training attractive; boredom, idleness, and loss of purpose remain real systemic outcomes.
- The checked wiki is both a session input and output. Accepted prose becomes a bounded mechanics or
  art brief; generated assets, implementation links, and evidence return to the same page with
  honest status.
- Every person has intrinsic dignity and potential contribution independent of starting talent or
  rarity. Systems may allocate scarce expertise and routine work, but roles remain revisable paths
  to mastery rather than measures of human worth.

## Resolved product pivots

The latest owner direction resolves the two initial architecture questions:

1. The Master is nonphysical and cannot be modeled through hero health, location, or ordinary
   mission eligibility. A future run-ending condition must describe loss of the town/campaign, not
   death of the player entity.
2. Level 99 targets roughly Floor 85–90. Levels above 99 support the final approach to Floor 100 and
   postgame; difficulty must interpolate smoothly rather than introduce a sudden promotion wall.

Omniscient observation does not change a hero's belief, nor does the Master's awareness
automatically become admissible evidence in a hero decision packet. Existing embodied and mortal
Master histories remain replayable under their original rules.

The exact per-floor curve remains tuning, not architecture. Floors consume an effective-power and
preparedness projection rather than treating raw level as a gate, so better player-designed systems
can let a prepared party outperform the anchor and a purposeless or badly composed party can
underperform it.

## Precedence and change control

Use this precedence when documents disagree:

1. Latest explicit owner feedback recorded in the relevant system brief.
2. Accepted ADRs for behavior already implemented and replayed.
3. This folder's cross-system contracts and ownership rules.
4. Older product prose in `game-design.md`, `architecture.md`, and `implementation-plan.md`.
5. Workstream proposals and tuning hypotheses.

New direction never edits the meaning of an old event stream. A conflict becomes a new ADR,
ruleset version, schema version, or content version. Tuning values may be provisional; ownership and
authority boundaries may not be bypassed to make a slice faster.

## Workstream protocol

Each subsystem has one primary brief under `systems/`. A worker assigned to that system should:

1. Read this README, the system map, integration contracts, roadmap, and its own brief.
2. Read the ADRs and contracts named in that brief.
3. Record new owner feedback in the brief's **Feedback ledger** before or with implementation.
4. Mark feedback as `accepted`, `experiment`, `deferred`, or `superseded`.
5. Propose a shared-contract change before depending on another subsystem's internal state.
6. Add or update a contract fixture before implementing both sides of a new integration.
7. Keep content, tuning, and presentation replaceable behind the authoritative contract.
8. Deliver a replayable vertical proof and update the per-system roadmap status.

A workstream owns its state and invariants. It may publish events and projections; it may not edit
another workstream's aggregate or import another workstream's reducer internals.

## Definition of an integration-ready slice

A slice is ready to combine when it has:

- a named owner and versioned input/output contract;
- declared commands, events, failure states, idempotency, and stale-state behavior;
- deterministic fixtures for success, rejection, replay, and at least one cross-system consequence;
- a bounded player-facing projection with no hidden authority;
- migration behavior for old histories when the schema changes;
- a runnable checkpoint and updated decision/feedback record.

## System briefs

- [Story and tower campaign](systems/story-and-tower.md)
- [Progression, skills, and promotion](systems/progression-and-skills.md)
- [Heroes, personality, society, and visuals](systems/heroes-and-agency.md)
- [Settlement and base expansion](systems/settlement-and-expansion.md)
- [Parties, missions, portals, and neighbors](systems/expeditions-and-neighbors.md)
- [Summoning, synthesis, and economy](systems/summoning-synthesis-economy.md)
