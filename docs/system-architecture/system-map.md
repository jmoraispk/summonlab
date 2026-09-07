# System map and ownership

## The architectural spine

The existing spine remains the contract for every new system:

```text
content catalogs + canonical state + due schedule
                         │
                         ▼
             legal actions / typed proposals
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
 deterministic policy         independent agent job
             └───────────┬───────────┘
                         ▼
               validated typed command
                         ▼
             pure versioned engine reducer
                         ▼
       append-only events + state/evidence receipts
                         ▼
        projections: player UI, journal, context, art
```

Only the engine commits consequences. Policies choose among legal options. Content declares truth.
Projections make truth legible for a specific audience.

## Product domains versus bounded contexts

Workers and wiki reviewers use five broad player-facing domains. Engineering retains smaller bounded
contexts underneath them so state ownership stays unambiguous.

| Product domain | Internal contexts it coordinates |
| --- | --- |
| Visuals | Presentation plus character, creature, environment, equipment, skill-effect, UI and audio asset manifests |
| Tower, World, and Story | Expedition, destinations, floor/encounter content, campaign story and party-attempt integration |
| Settlement and Society | Settlement, affect/goals/motivation, society, hero initiative, institutions and later expansion |
| Summoning, Progression, and Combat | Summoning, progression, skill catalog, equipment/inventory, combat, reward orchestration, economy and synthesis |
| Town Master Operations | objectives, assignments, party preparation, reports, knowledge views, policies and later automation |

The Foundation—shared kernel, event/replay, time, identity references, content versions, ledgers,
reservations, wiki/asset pipeline, accessibility, performance and observability—connects every domain
without becoming a sixth player-facing minigame.

The current [Living Village](../wiki/milestones/living-village.md) activates only the smallest
deterministic slice of these domains. Its [release matrix](../wiki/roadmap/living-village-v1.md)
controls availability without narrowing or deleting the broader target map.

## Engine runtime ownership

The repository proves many advanced components independently, but the ordinary player campaign is
still hard-bound to an earlier engine generation while synthesis and later story/finale proofs use
newer opt-in engines. “Complete” currently means a replayable subsystem checkpoint, not that every
checkpoint composes in one run. The first architecture milestone therefore needs one integrated
version manifest and an end-to-end campaign baseline.

The engine modularization is implemented. Its compatibility facades are deliberately small:
`packages/engine/src/engine.ts` is 71 lines and `packages/contracts/src/engine.ts` is 1 line
(measured 2026-08-31). Runtime ownership now flows in one direction:

```text
contracts/engine
      │ schemas, discriminated state and command/runtime contracts
      ▼
engine/core
      │ deterministic state/hash helpers, content bindings, capability predicates, ports
      ▼
engine/domains
      │ settlement · mission · story · synthesis
      ▼
engine/orchestration
      │ registries, composition seams, action policy, bootstrap, apply, reduction, replay
      ▼
public facade and consumers
      │ @summonlab/engine → database, worker, web, policies, evaluation, observability
```

The [engine module ownership guide](engine-module-ownership.md) is the assignment and handoff
reference for this boundary. It names the source owners, import directions, focused tests, and
consumer seams; the registries remain the executable authority for exact command and event
discriminators.

### Equipment runtime integration

Engine-v24 adds definition-backed Equipment without changing v1–v23 state or replay contracts. The
authoritative split is:

```text
approved PNG sources (161: 140 items + 21 set references)
  → Equipment-only lazy runtime manifest (140 bundles / 280 WebPs)
  → equipment-content-v1 (140 legal material/form definitions)
  → shared item factory
      ├─ Standard workshop Forging from one normalized material lot
      └─ bounded authored mission drop
  → company inventory and six-slot loadout
```

Candidate art, approved masters, runtime derivatives, definitions, and item instances remain
separate states. The 21 full Armor-set images are visual continuity evidence, not inventory items.
Fine/Masterwork resolution, complete Gathering, broad random loot, and monster-derived Equipment
remain outside engine-v24.

## Bounded contexts

| Context | Owns | Publishes | Must not own |
| --- | --- | --- | --- |
| Shared kernel | IDs, time, entropy, command/event envelope, versions, hashes, idempotency | accepted/rejected command receipts | Feature rules |
| Character | immutable manifest, stable mind traits, life state, durable body marks | identity/lifecycle facts | XP, relationships, summon price |
| Affect, goals, and motivation | mutable mood, concern, durable goal lifecycle, purpose/challenge/feedback state | affect/goal events, motivation projection, and presentation input | Personality generation, legal actions |
| Progression | XP, level, attributes, learned/mastered skills, active stance, promotion | capability and effective-power projections | Mission result, resource ledger |
| Skill catalog | definitions, tags, tier budgets, fusion rules, recipe hashes | resolvable skill IDs and recipes | Runtime prose, hero ownership |
| Society | observations, beliefs, provenance, relationships, promises, authority, speech | holder-owned context and evidence refs | World truth, full-state access |
| Hero initiative | petitions, recommendations, warnings, reports, response lifecycle | ranked Master inbox and linked requests | Direct mission/construction mutation |
| Company and party | persistent party membership, leadership, doctrine, formation, cohesion | party revision and readiness projection | Attempt-local positions and rewards |
| Settlement | sectors, facility instances, assignments, construction, capacity, power, routes | capabilities, occupancy, affordances | Hero intent, currency ownership |
| Expedition | tower/portal/neighbor attempts, reservations, positions, objectives, harm, extraction | outcomes, discoveries, typed reward claims | Permanent progression/economy mutation |
| Campaign story | campaign plan, envelopes, eligible beats, cast bindings, patch history | validated story selections and fact refs | Geometry, rewards, hero knowledge |
| Summoning | channels, odds, pity/anomaly, draw and creation receipt | new hero identity reference | Premium ledger, visual rendering |
| Synthesis | irreversible transaction, source valuation, output choice and receipt | lifecycle and typed grant request | Memory/personality transfer |
| Reward orchestration | reward definitions, eligibility, cadence, repeat rules, and claim request | typed reward claims and engagement projection | Balances, progression mutation, or narrative outcomes |
| Economy | resources, gems, definition-backed items, material lots, atomic reserve/debit/credit/grant receipts | ledger and equipment projection | Odds, narrative, hero valuation |
| Destinations | known signals, persistent routes, neighbor relations, vehicle travel state | destination capabilities and itinerary | Neighbor's internal aggregate |
| Presentation | audience-specific UI/art/audio projections | render state | Canonical mutation |

## Vertical workstreams

These lanes produce player-visible loops and can each be assigned to a worker:

1. **Summoning and roster acquisition** — channels, gems, pity, reveal, clean-slate onboarding.
2. **Hero growth** — experience, levels, skills, fusion, training, teaching, promotion.
3. **Hero life and agency** — affect, goals, habits, relationships, petitions, conversations.
4. **Settlement growth** — facilities, construction, modules, territory, population capacity.
5. **Tower campaign** — one-hundred-floor plan, five-floor bands, combat, secrets, rewards.
6. **Expeditions** — persistent parties, portal missions, concurrent attempts, extraction.
7. **Synthesis** — preview, irreversible commit, bounded transfer, social aftermath.
8. **Neighbor exploration** — airship, routes, persistent settlements, trade/diplomacy encounters.
9. **Mounts and vehicles** — animal identity/needs, rider bond, equipment, travel/combat capability.

Each vertical lane depends on horizontal capabilities instead of recreating them.

## Horizontal capabilities

| Capability | Consumers | Why it is horizontal |
| --- | --- | --- |
| Event/replay/versioning | every system | Every consequence needs the same authority and migration rule. |
| Time/scheduling/leases | settlement, training, travel, affect, construction, jobs | These systems advance while the client is absent. |
| Identity/presentation | summon, roster, dialogue, base, mission, training, synthesis, memorials | One person must remain recognizable everywhere. |
| Knowledge/evidence | story, party advice, secrets, synthesis, neighbors, conversation | Knowing is different from truth in every loop. |
| Motivation/feedback | training, work, parties, facilities, leadership, petitions | Purposeful behavior emerges from several systems, not one obedience score. |
| Policy/context jobs | habits, petitions, party choices, story selection, dialogue | Models remain independent, stale-safe proposal sources. |
| Progression checks | training, missions, buildings, synthesis, teaching | Capability has one definition and many consumers. |
| Ledger/grants | summoning, construction, mission rewards, promotion, ship, mounts | No feature keeps a private currency balance. |
| Rewards/engagement | daily return, summon access, missions, training, progression, milestones | Eligibility and benefit cadence cross every core loop while each grant remains domain-owned. |
| Party reservation | tower, portals, neighbors, vehicles | One hero cannot be in two active places. |
| Content/version catalogs | skills, floors, buildings, cultures, enemies, mounts | Runtime state binds immutable reviewed definitions. |
| Journal/observability | every player-facing loop | Cross-system causality must remain explainable. |
| Wiki/canon/artifacts | every content and implementation workstream | Text briefs, images, code bindings, and evidence return to one checked index. |
| Accessibility/performance | every visual surface | Phone budgets and redundant cues are product rules. |

## Dependency graph

```text
Shared kernel / event envelope / content bindings
  ├─ Character identity ─────────────┬─ Hero presentation (horizontal)
  │                                 ├─ Affect, goals, society
  │                                 └─ Progression and skill ownership
  ├─ Economy ledger ────────────────┬─ Summoning
  │                                 ├─ Construction / promotion
  │                                 └─ Synthesis grants
  ├─ Party + reservation ───────────┬─ Tower expedition
  │                                 ├─ Portal expedition
  │                                 └─ Airship / neighbor expedition
  ├─ Evidence + witness references ─┬─ Hero context and petitions
  │                                 ├─ Secrets and story casting
  │                                 └─ Social aftermath
  └─ Capability registry ───────────┬─ Settlement modules
                                    ├─ Expedition eligibility
                                    └─ Airship neighbor unlock
```

The blocking convergence work is small but real: Master ruleset, progression-v2 cap/effective
power, party/reservation, scalable evidence references, generic ledger/grant receipts, capability
registry, and campaign story plan.

## Overlap matrix

`O` means one system owns the truth; `C` means the other consumes a contract; `P` means presentation
only. Two systems should never both be `O` for the same row.

| Shared concept | Character | Progression | Society | Party | Settlement | Expedition | Story | Economy | Presentation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero identity/life | O | C | C | C | C | C | C | C | P |
| Skill ownership/mastery | C | O | C | C | C | C | C | C | P |
| Belief/relationship | C | C | O | C | C | C | C | — | P |
| Membership/leadership | C | C | C | O | C | C | C | — | P |
| Facility/capacity | C | C | C | C | O | C | C | C | P |
| Attempt truth/harm | C | C | C | C | C | O | C | C | P |
| Beat eligibility/casting | C | C | C | C | C | C | O | — | P |
| Currency/item balance | C | C | — | C | C | C | — | O | P |

## Parallelization answer

Yes, the systems can progress in parallel after the shared contracts above are written as RFCs or
schemas. Content-heavy work can begin even earlier against fixtures:

- realistic hero identity and cultural visual packs;
- skill definitions and fusion rule catalogs;
- additional tower envelopes, enemies, and story candidates;
- building classes, modules, and sector layouts;
- mount manifests and presentation studies;
- progression and economy simulation tools.

Implementation work that must coordinate first:

- removing the Master from ordinary mission deployment;
- changing one mission singleton into a registry that can reserve several parties;
- evolving level caps and replacing raw-level comparisons;
- replacing whole-run, per-event growth assumptions for 1,000 heroes;
- defining shared evidence/witness-set and ledger/grant receipts.

## Scale model for 1,000 heroes

Every hero remains individually persistent. Resolution fidelity changes according to attention:

| Temperature | Examples | Resolution |
| --- | --- | --- |
| Hot | selected party, direct conversation, urgent petitioner, local crisis | full legal-action boundary; sparse independent agent calls |
| Warm | visible workers, active trainers, social clusters, scheduled leaders | deterministic plan/habit blocks; model only on novelty/conflict |
| Cold | off-screen stable residents and reserves | analytical catch-up; no routine model call; bounded notable events |

Promotion from cold/warm to hot first resolves deterministic catch-up, then builds current context.
Required platform evolution includes sparse relationship adjacency, holder-indexed evidence,
partitioned snapshots/projections, deterministic batch events with per-hero receipts, and witness-set
references rather than fixed inline arrays.

A scale gate must simulate seven game days for 1,000 heroes, at least ten concurrent parties,
offline catch-up, and sparse social contact with zero provider calls; replay/root hashes, database
growth, queue depth, and latency must stay within declared budgets. Only then should a measured
fraction of salient agent jobs be added.
