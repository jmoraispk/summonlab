# Architecture and platform

## Goals

1. Keep the server authoritative while the phone is open or closed.
2. Advance a continuous accelerated world clock deterministically.
3. Give every roster hero meaningful language-model choices without calling a model for every minute of life.
4. Represent habits, environment, knowledge, and social propagation explicitly.
5. Keep every model request independent and context-owned by Summonlab.
6. Make tower, portal, settlement, death, synthesis, and promotion replayable.
7. Cap cost and recover safely from stale, late, invalid, or unavailable model responses.

## System boundary

```text
┌──────────────────────── web / PWA ────────────────────────┐
│ render projections · control Master · talk · issue orders │
└────────────────────────────┬───────────────────────────────┘
                             │ authenticated commands/events
┌────────────────────────────▼───────────────────────────────┐
│                    authoritative backend                   │
│                                                           │
│  simulation clock ─► scheduler ─► decision-job queue      │
│         │               │                 │                │
│         ▼               ▼                 ▼                │
│  deterministic engine ◄──── validated policy response     │
│         │                                  ▲               │
│         ▼                                  │               │
│  event log ─► projections ─► context / memory / habits     │
│                                                           │
│  account limits · leases · retries · usage · replay hashes │
└────────────────────────────────────────────────────────────┘
```

The browser is a renderer and command surface. It does not own the clock, model key, random seed, pity state, mission result, or background simulation.

## Suggested repository shape

```text
apps/
  web/                  responsive game client and server endpoints
  worker/               simulation scheduling and model decision jobs
packages/
  contracts/            commands, actions, events, jobs, runtime schemas
  engine/               pure transitions and legal-action generation
  simulation/           clock, schedules, needs, habits, jobs, catch-up
  characters/           generation, attributes, skills, promotion, death
  society/              relationships, knowledge, rumors, authority
  missions/             tower floors, portal worlds, encounters, secrets
  policies/             habit, random, scripted, replay, and model policies
  context/              memory selection and independent turn packets
  evaluation/           recorded scenarios, graders, cost and latency tests
  ui/                   reusable interface and presentation components
prototype/
docs/
```

TypeScript keeps the engine contracts shared. The engine cannot import database, network, wall-clock, browser, or model SDK code.

## Simulation clock

Store an authoritative run clock:

```ts
interface SimulationClock {
  runId: string;
  gameTime: string;
  speed: 0 | 1 | 2 | 4 | 8;
  anchorGameTime: string;
  anchorRealTime: string;
  lastCatchUpAt: string | null;
}
```

`4×` is the initial default. The two anchors project an explicit target game time without passing
wall time into the engine. A scheduler advances to the next due domain event rather than ticking
every hero every second; intervals without due work use a system-only clock-sync event.

Examples of due events:

- wake or sleep boundary;
- meal or work shift;
- training completion;
- injury recovery checkpoint;
- portal expiration;
- mission turn deadline;
- building completion;
- habit cue window;
- daily planning decision;
- pending social meeting;
- rumor delivery opportunity.

Advancement is deterministic for a given prior state, time interval, and seed.

## Three resolution levels

Not every action deserves a language-model request.

### Level 1: continuous rules

Needs, timers, travel progress, passive recovery, crafting counters, and building progress advance
through deterministic engine rules and server catch-up without a language-model request. A client
may interpolate presentation progress, but it never advances domain state locally.

### Level 2: habit and schedule policy

Familiar actions resolve from the hero's daily plan, habit strengths, environment affordances, needs, and current constraints. This policy is deterministic and explainable.

### Level 3: agent decision

Open a model job when the hero must interpret meaning or make a consequential choice:

- daily intention and schedule formation;
- direct player conversation or order;
- conflict between goals, values, habits, or relationships;
- novel opportunity or blocked plan;
- mission turn with several meaningful legal actions;
- important social approach, refusal, secret, or rumor;
- response to death, synthesis, promotion, or emergency.

This design gives every hero agent-authored choices across the day without paying for “walk to kitchen” one minute at a time.

## Proposed decision cadence

At `4×`, each hero receives at minimum:

| Trigger | Model call | Notes |
| --- | --- | --- |
| Wake / new game day | Yes | Produces daily priorities and conditional plan |
| Routine action under expected conditions | No | Habit policy executes the plan |
| Routine blocked or needs conflict | Sometimes | Threshold decides whether local fallback is sufficient |
| Direct player conversation or meaningful order | Yes | Only when hero is available to perceive it |
| Social contact | Only when salient | Routine small talk can be summarized locally |
| Active tower or portal decision | Yes | One independent call per meaningful hero turn |
| Bedtime reflection | Usually no | Memory service projects the day's events; call only for a major unresolved issue |

One call per hero per game day means four baseline planning calls per hero per real day at `4×`. Additional calls come from player attention, missions, and novelty. Per-run and per-account budgets can degrade excess decisions to habit, scripted, or random policies.

## Daily plan contract

A wake-time request returns bounded intent rather than a minute-by-minute screenplay:

```ts
interface DailyPlanDecision {
  priorities: GoalId[];
  preferredActivities: ActivityPreference[];
  socialIntents: SocialIntent[];
  orderResponses: OrderResponse[];
  conditions: ConditionalChoice[];
  playerFacingIntent: string;
}
```

The schedule service turns this into legal time blocks. Buildings, injuries, jobs, mission reservations, other people's availability, and the Master’s orders can invalidate or reshape it.

## Habit policy

```ts
interface Habit {
  id: string;
  heroId: string;
  cue: HabitCue;
  actionTemplate: ActionTemplate;
  strength: number;
  rewardEstimate: number;
  lastPerformedAt?: string;
  version: number;
}
```

The engine computes legal environment affordances first. A habit policy ranks legal routine actions using cue match, strength, need pressure, daily-plan alignment, personality alignment, social influence, reward history, and friction.

Every automatic choice logs the contributing factors. A player should be able to inspect “trained because the 16:00 practice cue was strong, the training ground was open, and no mission conflicted.”

## Independent model turn packet

Every model request is assembled fresh:

```text
identity
  physiology · temperament · values · drives · voice · current star

learned self
  habits · skills · recent growth · injuries · emotional state

knowledge
  observed facts · claims and sources · uncertainty · authority beliefs

social context
  relevant relationships · promises · fears · rumors · availability

environment
  time · location · buildings · resources · visible entities · affordances

current situation
  daily plan · mission objective · recent events · direct order or dialogue

decision contract
  legal actions · typed targets · output schema · deadline · fallback
```

Clean-slate heroes receive no world lore they have not learned. The context service selects what the hero knows, not everything the database knows.

### Structured response

```ts
interface HeroDecision {
  actionId: string;
  targetIds: string[];
  playerFacingIntent: string;
  spokenLine?: string;
  memoryCandidates?: MemoryCandidate[];
}
```

Intent and dialogue are presentation. Only a validated legal action mutates state.

The OpenAI Responses API supports explicit instructions, structured JSON output, independent inputs, and background execution. Summonlab can submit a background response, store its provider response ID on the decision job, and receive completion through a webhook while its own queue remains authoritative. See the official [Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [background mode guide](https://developers.openai.com/api/docs/guides/background), and [webhook guide](https://developers.openai.com/api/docs/guides/webhooks).

## Offline and phone-off processing

“Offline” means the client is absent, not that model calls run on the phone.

### Normal operation

1. The backend advances the run clock to the next due event.
2. Deterministic and habitual events resolve immediately.
3. Consequential events create leased decision jobs.
4. Workers call the selected policy, possibly in parallel for independent heroes.
5. Responses are validated and applied in game-time order.
6. Client projections update whether or not a device is connected.

### Conflict and staleness

Every job carries:

- expected world version;
- hero version;
- decision game time;
- legal-action hash;
- lease owner and expiry;
- model, prompt, and context-policy versions;
- token and latency budget.

If another action changes the relevant state while a hero is deciding, reject the stale response. Rebuild the packet, choose a deterministic fallback, or cancel the now-irrelevant decision.

### Backend downtime catch-up

If the backend itself stops, reconnect processing should:

1. advance deterministic timers and needs;
2. execute safe habitual actions up to configured limits;
3. identify only salient unresolved decision points;
4. cap model catch-up jobs per hero and real minute;
5. summarize skipped routine periods without fabricating important social scenes;
6. stop catch-up at a death, game-over, resource conflict, or player-required decision.

This prevents a long outage from generating thousands of calls or silently deciding a campaign's most important moment.

## Knowledge, memory, and clean slates

Store facts as beliefs with provenance:

```ts
interface Belief {
  subjectId: string;
  predicate: string;
  object: unknown;
  sourceEventId: string;
  learnedFromId?: string;
  confidence: number;
  learnedAt: string;
}
```

A new hero starts with sensory knowledge, language capability, cultural fragments, and system-safe self-knowledge. They do not know the Master's authority, previous deaths, tower rules, or other heroes until an observation, explanation, record, or rumor teaches them.

Memory layers:

| Store | Purpose |
| --- | --- |
| Canonical event log | Objective replay and state reconstruction |
| Working memory | Very recent perceived events |
| Episodic memory | Salient personal experiences |
| Belief graph | Learned facts, claims, sources, and uncertainty |
| Relationship state | Trust, respect, fear, affection, resentment, debt |
| Habit ledger | Cue-bound learned automaticity |
| Semantic self-summary | Goals, identity, skills, and recurring concerns |

The model can suggest memorable moments; the memory service decides what persists and preserves links to canonical events.

## Social propagation

Conversation and observation transmit knowledge through explicit events. There is no roster-wide telepathy.

For death or synthesis:

1. engine records the terminal event;
2. direct witnesses receive high-confidence beliefs;
3. close contacts receive “missing” observations when expected interactions fail;
4. social encounters can emit tell, ask, conceal, accuse, or investigate actions;
5. rumor beliefs retain source chains and confidence;
6. reactions occur only when knowledge reaches the hero.

This lets a secret remain temporarily secret while making disappearance impossible to treat as an invisible inventory operation.

## Deterministic engine

```ts
type Transition = (
  state: GameState,
  action: ValidatedAction,
  seed: Seed,
) => TransitionResult;
```

The engine owns:

- world and mission time;
- legal actions and targets;
- attributes, skills, needs, injuries, and death;
- tower floors, portal durations, secrets, and rewards;
- monster policies;
- schedules, jobs, buildings, and resources;
- habits and affordances;
- summons, pity, stars, promotion, and synthesis;
- knowledge visibility and social events;
- run-ending Master death;
- emitted events and replay hashes.

### Implemented deterministic survival core

The Phase 2 core implements typed commands, actor-specific legal actions, immutable named entropy,
pure reduction, append-only PostgreSQL events, per-event snapshots, and SHA-256 state-hash
verification. Commands carry an idempotency UUID and expected run version. Concurrent commands are
serialized at the run row; a stale command receives the latest version, cursor, and hash rather than
overwriting state.

`engine-v2` added nonnegative resources, inventory/equipment links, durability, needs, activities,
deterministic injuries, progression, permanent hero death, and atomic Master game over.
Scheduled work is indexed in PostgreSQL, but only events create, resolve, or cancel it. An explicit
game timestamp drives both immediate and offline-style resolution, so the reducer never consults wall
time. The readable journal projects numerical deltas and action source from the authoritative stream.
The `/replay/[runId]` development inspector exercises and rebuilds this full chain, and is disabled in
production unless explicitly enabled.

New runs use `engine-v3`. The state binds the Hearth route graph by id, version, and content hash;
travel commands supply only a target node. The engine derives the access-aware route, persists its
edges and due time, and schedules arrival without changing the hero's authoritative node. Only an
explicit `simulation.advance` event at or after the due game time commits arrival. Visual
interpolation cannot write location, and death cancels pending travel through the same schedule
ledger. Immutable `engine-v1` and `engine-v2` runs keep their original schemas and reducers rather
than receiving hidden defaults.

`engine-v4` added reciprocal facility rosters, station-derived capacity, and one reversible
development-power allocation. `engine-v5` persists the summoned mind, mutable habit, four-part daily
plan, inspectable routine ranking, and zero-model-cost scheduled outcomes. `engine-v6` replaces the
development power control for new runs with the irreversible First Ember lifecycle: Floor 01
recovery, one kitchen/dormitory/training commitment, the Master’s explanation, deterministic hero
responses, and event-persisted facility modifiers. A dual-anchor simulation clock projects
configured wall time into explicit engine targets; renewable database leases and one pure catch-up
policy make online and offline resolution byte-identical.

### Implemented reconnect projection

Every new event schedules a run-specific PostgreSQL notification in its command transaction. The
SSE player endpoint subscribes first, then reads bounded append-only pages after the requested
cursor, which closes the notification race without treating notification payloads as state.
Authoritative event sequences become SSE IDs, `Last-Event-ID` resumes reconnects, and impossible or
missing cursors force a snapshot refresh.

The player keeps a local last-observed cursor for private prototype play. Returning after catch-up
requests a deterministic recap over that exact interval: database aggregates supply complete event,
routine, plan, activity, arrival, failure, and net-delta totals; journal projection supplies a small
diverse set of cursor-linked highlights. Generated narration may decorate this projection later but
cannot provide facts, ordering, rewards, or progression values.

### Implemented living-scene projection

`GET /api/runs/:runId/projection` reads the cached `engine-v5` or `engine-v6` snapshot and persisted accelerated
clock after running due catch-up through the normal event path. One pure projection produces game
time/day phase, building power and assignment capacity, physical occupancy, hero pose, activity
label, optional engine-provided route nodes, and the bounded First Ember lifecycle, modifiers, and
immediate reactions. The response carries the exact event cursor and state hash that explain the
scene.

The player refreshes this bounded view after each ordered SSE cue and every 15 seconds while the
page is visible. Code-owned scene layers interpolate travel below completion, grade the approved
plate for dawn/day/dusk/night, and animate idle/walk/work/sleep/eat/train states. The browser never
applies an event to engine state; only a later server projection can move a hero's authoritative
node. Reduced-motion rendering freezes movement without hiding the semantic pose or occupancy.

## Policy interface

```ts
interface HeroPolicy {
  decide(packet: HeroDecisionPacket): Promise<HeroDecision>;
}
```

Implementations:

- `HabitPolicy` for routine settlement life;
- `RandomPolicy` for fuzzing and baseline simulations;
- `ScriptedPolicy` for fixtures, monsters, and authored cases;
- `ReplayPolicy` for exact action playback;
- `ModelPolicy` for meaningful hero interpretation and choice.

Most monsters use deterministic scripted or utility policies. Intelligent monsters can adopt `ModelPolicy` later without changing engine authority.

## Persistence model

### Run and time

- runs and game-over state;
- simulation clock and speed history;
- due events and scheduled activities;
- decision jobs, leases, attempts, fallbacks, and provider IDs;
- client projection cursors.

### Characters

- Master and hero identities;
- generation and visual seeds;
- physiology, attributes, skills, needs, and injuries;
- temperament, values, drives, social style, and emotion;
- habits and daily plans;
- star rank, level, promotion choices, and synthesis state;
- death records.

### Society

- relationships;
- beliefs with provenance;
- conversations, promises, orders, and authority beliefs;
- rumor transfers and social encounters.

### World and missions

- settlement buildings, jobs, resources, and construction;
- tower seed, floors, hidden triggers, objectives, and clear state;
- portal definitions, expiry, world state, and extraction;
- monster entities and deterministic policies.

### Summoning and economy

- summon channel configurations;
- pity counters and anomaly meters;
- summon receipts;
- resource ledger;
- synthesis receipts.

Currency spend, summon result, pity update, hero creation, and receipt commit in one transaction. Synthesis validates the source hero, recipient, social visibility, and irreversible event in one transaction.

## Platform

Web remains the first platform:

- authoritative simulation and model keys already require a backend;
- the client can reconnect to a continuously advanced run;
- turn-based tower and portal missions tolerate model latency;
- a responsive interface supports desktop and mobile browsers;
- a PWA can install and notify when a mission, conversation, death, or decision needs attention.

The interface should show queued, considering, validated, fallback, and resolved states without exposing hidden chain-of-thought.

## Cost controls

- One baseline daily planning call per hero.
- No model call for normal habit execution.
- Per-hero, per-run, and per-account call and token budgets.
- Model calls only at meaningful mission turns and novel settlement decisions.
- Cached stable prompt prefixes and character-card fragments where supported.
- Output schema and strict output-token caps.
- Deterministic fallback on deadline, invalid output, budget exhaustion, or provider failure.
- Recorded cost per hero, game day, mission, and real day.
- Cheapest model that passes action-legality, competence, habit, continuity, and latency evaluations.

## Testing and evaluation

### Engine and scheduler

- seeded replay and state-hash tests;
- clock multiplier and downtime catch-up tests;
- stale-job, double-lease, and out-of-order completion tests;
- habit cue, reinforcement, interruption, and affordance tests;
- pity, promotion, synthesis, death, and game-over transaction tests;
- floor-secret non-creation and discovery tests.

### Policy evaluations

- legal action selection;
- daily-plan usefulness;
- clean-slate knowledge boundaries;
- habit consistency without rigidity;
- order interpretation and authority response;
- personality distinguishability;
- social rumor provenance;
- tower competence and secret discovery;
- cost and latency distributions;
- fallback frequency.

## Implementation order

1. Contracts, seeded engine, run clock, and event log.
2. Master, heroes, attributes, skills, death, and game over.
3. Settlement needs, schedules, buildings, and habit policy.
4. Tower floors 1–5, deterministic monsters, secrets, and replay.
5. Summoning, pity, stars, promotion, and synthesis.
6. Portal mission and resource extraction.
7. Relationships, beliefs, authority, and rumor propagation.
8. Decision jobs, context assembly, random and scripted policies.
9. Model gateway, background workers, budgets, and evaluations.
10. Responsive client, reconnect, and PWA behavior.
