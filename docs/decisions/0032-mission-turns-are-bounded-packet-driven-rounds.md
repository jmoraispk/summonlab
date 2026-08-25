# ADR 0032: Mission turns are bounded packet-driven rounds

Status: accepted on 2026-08-24.

## Context

The Floor 01 lifecycle previously used a development-only system proof to open extraction. It did
not establish where autonomous decisions happen, how the Master and heroes share a turn, how hidden
topology stays hidden, who carries an objective, or what replay must verify. Allowing a hero policy
to submit a state mutation would violate the engine boundary. Letting the browser resolve movement
or initiative would make reconnects and historical playback untrustworthy.

The first playable turn system also needs a hard stop. A policy that repeatedly holds or explores
must not create an unbounded run or cost loop. Monster combat is the next slice, so this decision
must represent its absence honestly rather than inventing placeholder damage.

## Decision

- New runs use `engine-v12`. Every new mission attempt has a `mission-turn-v1` state with a maximum
  of 48 rounds, a contiguous round ledger, and explicit primary-objective availability, carrier,
  recovery round, and delivery round. Existing engine-v1 through engine-v11 schemas and events are
  replayed without migration.
- Each round requires exactly one choice for every Master-first party member. Only the Master may
  use a manual source. A hero must use a named scripted, seeded-random, or model policy and record
  packet, legal-action, and policy-result hashes plus a public intent.
- Every hero decision is a fresh packet assembled from the current canonical snapshot. It includes
  stable identity and mind, bounded witnessed knowledge, applicable directions, current mission
  position, visit/discovery knowledge, objective custody, and only legal engine actions. The current
  runtime selects with `ScriptedPolicy`; no provider key or model call is required.
- The engine derives moves only from knowledge-projected authored edges, derives inspections only
  from legal discovery affordances, and derives recovery only at the authored objective node. A
  policy can select but cannot expand this set.
- The engine draws one named `initiative-tie-break` value per party member and resolves in descending
  total initiative with actor-id tie breaking. It records superseded actions when two actors legally
  selected a single-use interaction before initiative resolved.
- Recovering the First Ember creates a carrier. The carrier must traverse back to the Tower
  Threshold. Extraction opens automatically only after delivery and after all party members return.
  The existing extraction command remains a separate explicit player confirmation.
- Package-defined turn-interval environment events enter the authoritative round ledger. Their
  mechanical effects, goblin duties, and the Foundry Warden begin in `MIS-004`; until then
  `monsterActionIds` is truthfully empty.
- `mission.round.resolved` stores the submitted choices, entropy draws, ranked resolutions, and
  resulting mission state. Strict replay recomputes all of them from the prior state and bound
  content. The client receives only projected arena knowledge and renders a code-native tactical
  board without mutating state.

## Consequences

Floor 01 can now be played from deployment through physical objective recovery and extraction with
independent hero agency, inspectable policy evidence, deterministic initiative, bounded failure,
and exact replay. The development objective-proof control is removed from engine-v12 and the normal
mission UI, while an explicit engine-v11 replay fixture preserves old proof-driven histories.

The current checkpoint has one summoned hero manifest, a zero-cost scripted hero policy, Step-only
Master control, environment notices without effects, and no monster actions. These are visible
limitations rather than client-side substitutes. Later model, timing, direction, and monster modes
can use the same choice and round contracts without receiving state-mutation authority.
