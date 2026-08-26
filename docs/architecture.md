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

## Runtime story direction

Sparse story direction uses the same proposal boundary. A `StoryDirector` receives the exact
content-addressed envelope, canonical public history, open slot, actual living cast, holder-owned
evidence, and any scoped player direction. It returns a strict `StoryPatchCandidate`; it never
returns replacement state.

```text
authored envelope + canonical history + eligible living cast
                           │
                           ▼
              StoryPatchCandidate (selection only)
                           │
                           ▼
       17 engine checks: causality · freshness · bounds
       cast · knowledge · laws · objective · arena · rewards
                           │
              accepted ───┴─── rejected
                 │                 │
                 ▼                 ▼
     story.patch.applied      no state change
       + strict replay
```

`engine-v21` stores the accepted candidate, complete validation report, resulting history hash,
and patch hash in one authoritative event. Selection capacity is cumulative across the canonical
history. A role-expression proposal must name a living hero who holds the required evidence;
complications carry no invented role binding. The schema contains no operation for world laws,
primary objectives, arena entities, discoveries, rewards, required anchors, or finale constraints.
This lets a future cheap or strong model replace the scripted director without changing its
authority.

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

`engine-v7` adds the first event-derived social cognition layer. `society-v1` stores direct
observations, holder-specific beliefs with source-event and observation provenance, directed
relationship dimensions, explicit promises, and each hero’s multidimensional view of the Master’s
authority. A newly summoned hero receives only two high-confidence beliefs: that they awakened at
the summoning gate and that an unfamiliar adult was present. The state does not inject tower rules,
Master legitimacy, prior deaths, or knowledge of other heroes.

The First Ember commitment is the first social consequence. Every active hero who participated in
that council receives a direct observation, a belief about the exact facility/rationale, a belief
about the resulting founding promise, and evidence-linked changes to relationship and authority.
Relationship state tracks trust, respect, fear, affection, resentment, and debt. Authority tracks
competence, provision, trust, legitimacy, fear, strength, and consistency; there is deliberately no
scalar obedience score. Immutable v1–v6 streams remain on their original schemas and receive no
retroactive knowledge.

`engine-v8` extends that aggregate as `society-v2` with canonical communicative acts. The first
bounded slice supports Master-to-hero onboarding through `explain`, `tell`, and `ask`. Every act
stores exact text, structured topic, optional tone, private/open delivery, location, intended
audience, actual witnesses, and its source event. Private delivery addresses only the target. Open
delivery adds only active, unoccupied, non-traveling heroes co-located with the Master. Questions
create observations without claims; explanations transfer only one engine-owned structured claim,
so arbitrary prose cannot manufacture world facts. Replay recomputes the entire act → witness
observation → told-belief chain. Immutable v1–v7 streams remain unchanged.

`GET` and `POST /api/runs/:runId/communications` expose a bounded per-hero conversation projection
and commit manual step-timed communication. The summon chamber uses it before the hero’s first route
choice; the replay inspector exposes exact text, witness roles, observation IDs, belief IDs, and
source-event provenance. No model call or hidden relationship adjustment occurs in this slice.

`AGT-003` adds `hero-decision-packet-v1` as a pure projection over an exact `engine-v8` snapshot,
the selected hero, and a full manifest whose canonical hash must match engine state. The context
service rejects stale snapshot hashes, terminal or unavailable heroes, mismatched identities, and
states with no legal hero action. It never queries the network, database, wall clock, or random
source while assembling a packet.

Each packet is bound to the run version, event cursor, state hash, context-policy version, packet
hash, and a separately hashed, sorted legal-action list. It includes implemented self state,
co-located visible people, holder-only beliefs, relevant directed relationship/authority/promise
projections, witnessed active directives, and only the current engine-derived affordances. The
Master appears as an unidentified person until the hero holds the witnessed Master-role claim;
other heroes' manifests, private thoughts, and the run seed are never projected.

`hero-memory-v1` considers only observations owned by the deciding hero. It scores salience,
recency, present-subject overlap, location, and whether exact communication was addressed or
overheard; ties resolve by event time and stable ID. Selection stops at both an item limit and a
character budget. Communication text can enter a memory only when act → witness → observation
provenance resolves for that hero. The summon page exposes a compact **What reaches this hero**
preview, and `GET /api/runs/:runId/decision-context` rebuilds the same current packet after new
speech. Decision jobs, result application, witnessed conversation, and redacted decision inspection
are now implemented.

`AGT-004` adds a separate pure `@summonlab/policies` package. `RandomPolicy` requires an explicit
seed and derives one reproducible unsigned draw from the packet and legal-action hashes.
`ScriptedPolicy` scores only packet-visible action terms against decision kind, current needs,
personality, value, drive, habit, capabilities, holder-owned authority, and witnessed directives.
Both reject a malformed packet, a mismatched legal-action hash, invented targets, or memory IDs
outside retrieval. Each returns `hero-policy-result-v1`, which binds the selected decision and
inspectable trace to the packet, state cursor, and legal boundary with its own result hash.

`GET /api/runs/:runId/decision-preview` evaluates both zero-cost policies against one freshly
assembled packet. The summon inspector displays the two candidate results but does not apply them:
atomic job leasing, stale-result rejection, retry, and application belong to `AGT-006`.

`AGT-005` adds `OpenAIModelPolicy` behind the `@summonlab/policies/openai` server-only subpath. The
root policy export stays free of provider code. Each invocation first verifies the packet, then
submits one foreground Responses request through the official TypeScript SDK with `store: false`,
no conversation or previous response ID, the fixed `hero-model-prompt-v1` instructions, low
verbosity, bounded minimal reasoning, and a strict `summonlab_hero_decision` JSON Schema. The only
dynamic input is canonical packet data; strings inside it are explicitly treated as quoted game
data rather than instructions.

The parsed response passes the normal Zod and legal action/target/memory checks before becoming a
`model-policy-v1` result. Its trace records requested/resolved model, provider response ID, service
tier, prompt/schema versions, usage, request/output hashes, and selected action without storing
private reasoning. Timeout, provider failure, refusal, incomplete output, malformed JSON, schema
failure, and illegal selection are typed but not retried here. `AGT-006` owns retry and fallback.

`POST /api/runs/:runId/model-preview` is a development-only, read-only bench. It requires
`POLICY_MODE=model`, a local API key, explicit per-click cost acknowledgement, and the exact current
packet hash before it spends one call. The summon inspector never calls it automatically and makes
the disabled scripted-mode state visible. A successful preview still cannot apply game state.

`AGT-007` adds `engine-v9` and `society-v3`. `POST /api/runs/:runId/conversations` accepts canonical
free text as `say`, `ask`, or `order`; an order also carries one bounded intent. The engine records
the same co-location and witness chain as onboarding, then resolves an inspectable response from the
hero's social style, personality, values, drive, needs, directed relationship, authority view, and
the player's tone. The result is accepted, negotiated, deferred, or refused. The deterministic
prototype renderer supplies exact reply text; richer model-authored phrasing may later decorate the
same authoritative outcome.

Conversation cannot execute an action. Accepted and negotiated orders are projected into later
decision packets as witnessed preferences with weights 24 and 12. The scripted policy adds that
weight only when intent terms match an already legal action. Refused and deferred orders remain
retrievable memories but contribute no preference. Replay recomputes the act, response, score,
relationship/authority evidence, and `society-v3` bytes; v1–v8 histories remain unchanged.

`AGT-010` adds `engine-v10` and `society-v4`. A general player direction is an authoritative social
record rather than an ephemeral prompt suffix: exact text, priorities, scope, intended recipients,
delivery, actual witness observations, expiry schedule, replacement chain, and terminal event are
all replayed. `POST /api/runs/:runId/directives` issues, replaces, or revokes it. Day directions
expire through the normal scheduled simulation event path; decision directions are consumed by the
first cited applied action; mission directions enter only mission-action packets; until-revoked
directions remain active until an explicit command ends them.

Packet assembly quotes only active records the hero actually witnessed. A direction cannot add a
legal move, disclose omitted state, or bypass policy validation. When a hero action cites a stored
direction, the event records whether the selected legal action advanced it, conflicted with a
better-matching legal alternative, or found no matching affordance. Journal and replay projections
use that event-derived influence instead of assuming compliance. Immutable v1–v9 streams remain on
their original schemas. See ADR 0029.

`AGT-008` adds a historical request and inspection boundary. New `decision-job-v2` rows persist an
exact, credential-free provider request profile when and only when the requested policy is a model.
The profile is created from the same request object the adapter would submit and hash-binds the
packet, prompt, schema, input, instructions, model, output cap, reasoning effort, and provider-safe
settings. Existing `decision-job-v1` rows remain readable and report unavailable historical request
metadata rather than borrowing current configuration.

`decision-inspector-v1` derives a report from the canonical stored job. It retains action IDs,
legal moves, selected evidence provenance and scores, lifecycle, latency, token metadata, validation
outcomes, and engine receipts while replacing private communication, directives, memory summaries,
belief text, social evidence, promise terms, and hero prose with typed length-plus-hash digests. It
also names context that never entered the packet. The report has its own canonical hash and contains
no credential or provider-private reasoning content.

The development-only `/debug/decisions/:jobId` page and `/api/dev/decisions/:jobId` endpoint expose
only that redacted report. Normal browser polling uses a separate minimal client projection with no
packet, provider profile, policy trace, raw result prose, transition details, or provider failure
message. See ADR 0027.

### Implemented mission content boundary

`MIS-001` adds `mission-package-v1` as immutable, hash-verified authored truth. One package declares
deployment and extraction boundaries, objectives, the complete arena graph, observations,
discoveries and their legal affordances, entropy purposes, monster duty slots, environmental
policies, legal tools, retreat nodes, bounded rewards, and a fixed story envelope. Schema refinement
validates every reference and rejects disconnected graphs, concealed topology leaked through open
edges, discoveries with no legal action, required nodes without a default route, reward overspend,
or optional story proposals that bind required beats.

`MissionArenaKnowledge` is a smaller holder-independent projection input containing discovered ids
and actually visited nodes. Initial knowledge exposes only authored public topology; visits reveal
on-entry observations, and discovery records reveal only their declared nodes, edges, observations,
and facts. `planMissionRoute` operates on that projected graph with stable edge-id tie breaking.
Neither projection nor the development-only `/mission-lab` creates run state.

`tower-floor-01-v1` binds Floor 01, **The Unlit Muster**, to a seven-node/eight-edge graph and one
primary recover-and-extract objective. Its four-action default path stays available without a
secret. Inspecting the soot seam at Oath Hall may later create the persisted discovery that exposes
a three-action low-exposure Ash Duct route. Five required story anchors remain immutable; one patch
slot can select one of two cataloged optional expressions but cannot alter world laws, objective,
arena truth, reward budget, or required anchors. See ADR 0030.

### Implemented authoritative mission lifecycle

`engine-v11` adds one hash-bound `MissionRunState` to new runs while leaving v1–v10 schemas and
event bytes unchanged. Bootstrap stores the exact Floor 01 mission id, content version, and SHA-256;
every mission transition resolves that binding against verified content before deriving legal
actions or applying an event. Missing or drifted content is a replay-integrity failure, never a
silent migration.

The lifecycle is `available → preparing → deployed/resolving → extraction → success`, with
pre-deployment cancellation and boundary-only retreat. Preparation creates a deterministic attempt
id and a Master-first party, validates the package's 1–5 member limits, and requires every living
member to be idle at the summoning gate. Prepared/deployed participants lose settlement actions so
offline routines cannot use the same hero concurrently. Revision and cancellation are legal only
before deployment; cancellation and retreat release the party and permit a new numbered attempt.
Success is terminal for this package and therefore cannot be farmed.

Deployment writes every party member's authoritative entry position and the entry visit into
mission knowledge. Extraction and retreat require the whole party at an authored
extraction/retreat boundary. Each transition emits an immutable mission event whose payload the
reducer recomputes and verifies during strict replay. `/mission/:runId` is a renderer and command
surface over this state, not an alternative mission engine. See ADR 0031.

### Implemented autonomous mission turns

`engine-v12` extends only new mission attempts with a bounded `mission-turn-v1` ledger; v1–v11
state and event schemas remain immutable. A deployed round requires exactly one choice for every
party actor. The player supplies the Master's legal action, while each hero receives a fresh,
hash-bound `mission-action` packet containing identity, mind, witnessed memory, applicable
directions, position, visit/discovery knowledge, objective custody, and the engine-owned legal
set. The current runtime uses the zero-cost personality-scripted policy; the recorded packet,
legal-action, policy-result, and public-intent evidence keeps that boundary inspectable and makes a
future model policy swappable.

The engine normalizes choices in Master-first party order, validates their sources and legal sets,
draws one named `initiative-tie-break` value per actor, and applies the ranked actions. Moves can
traverse only projected authored edges. Inspections can reveal only legal package discoveries.
Objective recovery creates explicit custody, and the carrier physically delivers the First Ember
by returning to the threshold. Extraction opens automatically only when the objective is delivered
and every party member is present. Every third-round package pulse is recorded, and an attempt that
has not returned within 48 rounds fails.

Each `mission.round.resolved` event stores the submitted choices, entropy draws, ranked actions,
knowledge and objective transitions, and resulting status. Strict replay recomputes the entire
round and rejects any drift. The mission page receives only projected arena nodes, edges, and
observations; its code-native tactical board cannot inspect concealed author truth or mutate
positions. See ADR 0032.

### Implemented deterministic monster duties

`engine-v13` extends new attempts with `mission-turn-v2` and a hash-bound `monster-policies-v1`
catalog. Deployment consumes only package-declared monster-count entropy, creates stable goblin
entities at authored duty nodes, and derives their public threat intents. Chain watchers hold or
defend the Chain Court. The Ember hauler protects the cradle, alarms when challenged, and can pursue
a visible carrier along open authored edges without learning concealed topology.

Party and monster actors draw from the same `initiative-tie-break` stream and resolve in one ranked
ledger. The engine owns monster movement, alarm state, vitality, attack armor, party defense, and a
bounded mission-guard buffer. A defeated monster's telegraphed action is retained as superseded;
targets that leave before impact likewise produce an explicit non-effect. Every threat, action,
before/after effect, and next telegraph is persisted and recomputed by strict replay. Injury,
permadeath, and Master game over remain later explicit boundaries rather than implied by exhausted
mission guard.

The same catalog defines the Foundry Warden's furnace-linked armor, furnace surge, and exposed
cooling-control defense. The policy is reusable and Floor 05 now owns its only first-band placement.
The mission page projects active monster tokens, current threat intent, guard, and merged initiative
from authoritative state. See ADR 0033.

### Implemented authored first tower band

`tower-band-01-v1` verifies five consecutive immutable mission packages and every referenced monster
policy before exposing them. Floors 02–05 add formation and protection at the Broken Procession,
injury and retreat pressure at the Red Tithe, one-person separation and relationship evidence at the
Severed Relay, and the Living Foundry payoff. Across the band, 34 observations and 15 discoveries
remain local, visit-bound evidence; every floor retains a default objective route, exact reward
budget, authored retreat boundary, deterministic entropy names, and a fixed five-anchor story
envelope with only one catalog-bounded optional patch slot.

Floor 04 can reveal the canonical intake seam and cooling-loop schematic. Floor 05 declares a
matching maintenance affordance that is not legal without the `relay-route-memory` capability.
`engine-v14` now records the schematic as holder-specific evidence with its source mission binding,
attempt, and round. Only that holder receives the derived route-memory tool on Floor 05. A legal
recall exposes the hidden two-person route and cooling control; legal wheel actions advance the
engine-owned furnace from `lit` to `cooling` to `quenched`, and each state changes the Warden's
armor reduction. The Warden can follow the authored edge to intercept an exposed operator. Every
choice, discovery, arena effect, armor result, and intercept is hash-bound and recomputed by strict
replay. Existing and new normal Floor 01 runs remain on immutable `engine-v13`; the v14 multi-floor
scenario is opt-in until progression unlocks later floors. The Mission Lab remains a non-mutating
content preview rather than a source of retained evidence. See ADRs 0034–0035.

`engine-v15` adds the first executable portal-world boundary. `iron-moon-v1` wraps an immutable
mission package with an eight-round timer, pressure thresholds, finite ore deposits, per-actor cargo
capacity, a four-ore extraction quota, and collapse policy. Mining mutates only the attempt: every
transfer records deposit and cargo before/after values in an append-only ore ledger. Settlement
stock remains unchanged until a separate extraction command reunites the complete party at the
portal scar and atomically converts cargo into an authoritative resource delta. Retreat or timer
collapse writes loss entries and credits nothing. One resolved party round consumes exactly one
timer unit, so wall time, animation time, and model latency cannot change the result. Participating
hero packets include timer, pressure, quota, personal cargo, and finite deposit context. Strict
replay recomputes the complete portal round and extraction payload. See ADR 0036.

`engine-v16` makes mission aftermath authoritative for heroes: an exposed impact changes health,
injury, equipped-item durability, life state, witnessed observation, and relationship evidence in
the same round event. `engine-v17` extends that ledger with a distinct Master-harm record. A fatal
Master consequence simultaneously sets the mission attempt to `death`, the Master to `dead`, and
the run to `game_over`; it clears pending hero activity, travel, routines, and unfinished daily
plans before the resulting state is hashed. Legal-action projection returns an empty set for every
actor, while the append-only event stream remains available for strict replay. Earlier schema
versions retain their original reducers and hashes. See ADRs 0037–0038.

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

`GET /api/runs/:runId/projection` reads the cached `engine-v5` through `engine-v12` snapshot and persisted accelerated
clock after running due catch-up through the normal event path. One pure projection produces game
time/day phase, building power and assignment capacity, physical occupancy, hero pose, activity
label, optional engine-provided route nodes, and the bounded First Ember lifecycle, modifiers, and
immediate reactions. For `engine-v7` through `engine-v9`, the same bounded projection adds each visible hero’s held
belief count, latest direct observation, relationship language, authority standing, and active
promise terms. Raw social dimensions and provenance remain available in the development replay
inspector. `engine-v10` through `engine-v12` additionally expose direction lifecycle and influence in
the replay ledger. The response carries the exact event cursor and state hash that explain the
scene.

The player refreshes this bounded view after each ordered SSE cue and every 15 seconds while the
page is visible. Code-owned scene layers interpolate travel below completion, grade the approved
plate for dawn/day/dusk/night, and animate idle/walk/work/sleep/eat/train states. The browser never
applies an event to engine state; only a later server projection can move a hero's authoritative
node. Reduced-motion rendering freezes movement without hiding the semantic pose or occupancy.

## Policy interface

```ts
interface HeroPolicy {
  readonly policyId: string;
  decide(packet: HeroDecisionPacket): Promise<HeroPolicyResult>;
}
```

`HeroPolicyResult` contains the validated `HeroDecision`, exact packet/legal/state references, a
policy-specific trace, and a canonical result hash. Intent, dialogue, goal proposals, and cited
memory IDs remain presentation or proposals; only the legal action may later reach the engine.

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

### First-band archive boundary

`engine-v23` carries `first-band-archive-v1` with a one-way `sealed → recovered → revealed`
lifecycle. The fragment may become `recovered` only inside the canonical `mission.extracted`
transition for a successful `tower-floor-05` attempt. Its receipt binds the mission attempt,
content hash, surviving hero IDs, completed story-history hash, and the authored
`hearth-relight-core` / `first-hearth-archive-fragment` grants. Defeating the Warden without crossing
the extraction boundary does not grant either record.

Reveal is a separate Master action that selects one living extraction survivor. The engine gives
that hero only the fixed Floor 05 outcome anchor and derives the delivery frame, prefix, and habit
gesture from their stored mind. The exact archive message remains **“Hearth 01 was not the first.”**
and is hash-committed while sealed; neither the reader nor StoryDirector may rewrite it. Reader and
co-located witness IDs become explicit knowledge records, so later clean-slate summons receive no
retroactive knowledge. Both extraction and reveal recompute under strict replay.

### Player campaign boundary

The player-facing campaign shell is replay-adjacent rather than authoritative. Migration
`0011_campaign_experience.sql` registers one campaign seed, three stable hero drafts, onboarding
progress, lifecycle, and restart lineage beside an existing proof/engine run. Sequential onboarding
steps are presentation metadata, while each first conversation and the primary hero's first
destination are ordinary canonical engine commands and events.

`campaign-objectives-v1` derives seven ordered objectives from that campaign record and an exact
`engine-v13` snapshot. The projection records the engine state hash and a deterministic projection
hash; it never stores a second mutable accomplishment ledger. The persistent objective chip follows
updated onboarding projections, and the pause menu may refresh the same projection on demand.

Pause is only an input/modal state in the browser. The simulation clock, catch-up path, and pending
engine work continue on the server. Reading scale, motion, and the player's default Wait/five-second
handoff preference live in versioned local storage because they are interface preferences, not run
history.

Restart bootstraps a new engine run, registers it with `restartedFromRunId`, and supersedes the
prior campaign record without touching its append-only events or snapshots. A same-seed restart
therefore produces the same three generated identities under a new run ID while the old replay
remains independently verifiable. See ADR 0047.

### Sensory and accessibility boundary

`PlayerSensoryLayer` is a browser-only subscriber to route context, local preferences, and typed
interface cue attributes. It owns one procedural Web Audio graph with title, gate, Hearth, tower,
and silence profiles plus short optional action tones. The graph is muted by default, begins only
after a user gesture, never downloads an asset, and has no access to engine commands, campaign
repositories, or event persistence. Its timing is intentionally non-canonical.

Every cue is redundant with visible state and has an optional concise live-region caption. Audio
cannot carry legality, danger, cost, or consequence by itself. Decorative cue flares animate only in
Full/System motion and become brief static emphasis under reduced motion. The System preference
honors `prefers-reduced-motion`; an explicit Full choice is the only override.

Versioned local settings now include Muted/Ambient/Full mix and sound captions. The v2 loader
migrates FIN-003 preferences field by field and applies them in the document head before hydration.
Skip navigation, visible focus, route focus reset, native settings inputs, tab semantics, modal focus
containment, Escape close, and focus restoration define the current keyboard baseline. These are
presentation guarantees, not simulation or replay state. See ADR 0048.

### Phone performance boundary

FIN-005 separates reproducible delivery budgets from browser behavior. `player-visual-exporter-v1`
derives content-addressed 832 px phone and 1681 px desktop title WebPs from the accepted source and
checks both encoded and decoded sizes. The title's responsive source selection keeps the phone from
downloading the desktop candidate. Player Hearth routes resolve approved purpose-sized portrait
assets on the server and otherwise retain code-native rigs; they do not import multi-megabyte source
PNGs into the route graph.

`phone-performance-report-v1` measures one real arrived campaign in Chromium at 390×844/2× with
simulated 4G and 4× CPU slowdown. It covers interactive shell, initial JavaScript, selected title
visual, first-settlement visual payload, local pause response, reconnect, active-scene frame cadence,
and a JavaScript-heap-plus-decoded-images working-set reference. The static validator binds the
report's byte measurements to current build and asset manifests, while hosted browser CI reruns the
volatile timing/frame/memory assertions. `summonlab:player-ready` is a browser performance mark only
and cannot affect engine, campaign, or replay state.

The working-set reference intentionally excludes native browser and GPU allocations. It is a
regression signal under the 300 MB target, not a substitute for the implementation plan's real-device
review. See ADR 0049.

### Consent and playtest analytics boundary

FIN-006 keeps playtest observation outside canonical game truth. An undecided or declined browser
sends no analytics request. An affirmative `playtest-consent-v1` grant creates a random,
30-day consent record and returns a 256-bit device capability; only its SHA-256 hash is persisted.
The capability can submit `playtest-analytics-v1` events, inspect retained counts, or withdraw.
Withdrawal and expiry delete related sessions and events and invalidate the capability.

The analytics contract is a strict seven-event union for player-route views, campaign start, three
onboarding milestones, Hearth entry, pause opening, restart, and reconnect completion. Fields are
bounded to random identifiers, run correlation, coarse viewport/route categories, declared choices,
and timing. Names, seeds, dialogue, hero replies, arbitrary text, IP addresses, and user agents are
not columns or accepted properties. Presentation analytics has no dependency path into engine
commands, campaign progression, authoritative events, or replay.

`/playtest-report` is a development-only aggregate projection for moderated-test preparation. It
returns consent/session/event totals, typed event counts, and a prefix-complete journey funnel—never
individual sessions, event payloads, run IDs, timestamps, or withdrawal capabilities. The local
capability is not identity or authorization for a hosted build; private invite access and owner
scoping remain prerequisites before remote data collection. See ADR 0050.

### Moderated evidence boundary

FIN-007 separates human qualitative evidence from both canonical game state and FIN-006 analytics.
`moderated-playtest-v1` requires five actual adult participants; browser automation, scripted
personas, model simulations, and developer walkthroughs may preflight the protocol but cannot
increment the session gate. The fixed cohort assigns anonymous codes `P01`–`P05`, two phone tracks,
three desktop tracks, and twelve definition-of-done task families across common onboarding plus
settlement, mission, discovery, consequence, and replay observations.

The checked source contains only device/track assignment, build commit, bounded task outcomes,
moderator prompt counts, and redacted paraphrased findings. It rejects identity fields, direct
contact details, untriaged prompted/failed tasks, duplicate participants, and findings without an
observed session. Raw notes, recordings, direct quotes, seeds, run IDs, dialogue, and consent
capabilities remain outside Git. Qualitative note consent is separate from analytics consent and
withdrawal removes retained session evidence.

`phase-7-fin007-moderated-playtest.json` derives coverage, device mix, severity counts, and a release
recommendation from the sanitized source. The report remains honestly `ready` or `in-progress`
without failing CI; only five fully observed tracks can produce `complete`. Any unverified P0/P1
finding produces `hold`, which FIN-008 must clear before packaging. `/playtest-moderation` renders
the same checked evidence for the facilitator. See ADR 0051.

### Development story workshop boundary

FIN-009 adds a proposal pipeline upstream of authored content. `story-workshop-brief-v1` binds one
five-floor band to exact world laws, opening facts, unresolved goals, objective kinds, mechanics,
enemy duties, production limits, reward ceiling, forbidden changes, and an emotional question. A
configured development model receives only that canonical brief and returns two or three strict
`story-arc-proposal-v1` candidates. The provider request uses a versioned prompt, structured output,
`store: false`, a server-held credential, and recorded model/response/hash/token provenance.

The provider schema is only the first boundary. `@summonlab/evaluation` independently checks brief
binding, floor range and rhythm, every catalog reference, unique anchors, reward bounds, and
production counts. Passing all ten checks makes the exact proposal version eligible for human
editorial review. Review covers causality, mechanical fit, emotional arc, autonomous-character
agency, production scope, and envelope compilation; only one exact version may be accepted and
prototype dependencies keep it on hold.

```text
versioned brief → structured candidates → 10 reference/bound checks
                                            │
                              blocked ───────┴────── reviewable
                                                        │
                                   revise/reject ───────┴────── accept
                                                                  │
                                                     later envelope compiler
                                                                  │
                                               versioned authored content only
```

Neither generation nor acceptance mutates a run or creates canonical content. The existing mission
package, band envelope, engine validation, and replay boundaries remain the only route from an
accepted editorial proposal to playable story. The checked scripted fixture proves the workflow
without claiming external model authorship. See ADR 0052.

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

`@summonlab/evaluation` now implements the first credential-free gate as
`agent-evaluation-corpus-v1`. Ten fixed packet fixtures isolate personality, directives, needs,
authority, witnessed memory, and legal secret discovery. Both zero-cost policies are graded on
every packet; a dated `gpt-5-nano` request/cost projection remains `insufficient-evidence` until a
recorded provider run supplies resolved model identity, full-corpus outputs, token usage, and
latency. `pnpm validate:agent-evaluation` rejects drift in the checked-in corpus or report, and the
development-only `/debug/evaluations` route renders the same artifacts without making a provider
call. The opt-in `pnpm record:agent-evaluation` command is excluded from CI, requires a paid-run
acknowledgement, and turns actual full-corpus outputs into measured promotion evidence. See ADR
0028.

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

## Executable strategy evidence

Whole-mission strategy claims use the same command and replay boundaries as live runs. The
`foundry-strategy-report-v1` generator bootstraps a four-hero development company, performs
preparation and every Floor 05 choice through the legal-action surface, extracts, and then rebuilds
the final state from the bootstrap plus append-only events. Its fixed matrix is a regression proof
for known viable paths, not a balance sample. The checked JSON and `/foundry-trials` route consume
the same report schema; neither may invent outcomes or mutate a run.

The matrix can carry a replayed Floor 04 route-memory fixture in its bootstrap event so Floor 05 can
be evaluated in isolation. Actual cross-attempt aftermath remains a versioned lifecycle concern:
v16/v17 consequences have round numbers but no source-attempt identity, so `MIS-010A` must repair
that boundary without rewriting historical streams.

## Human-gated private packaging

FIN-008 consumes the checked FIN-007 moderation report through `playtest-release-report-v1`. The
evaluator reparses the strict report and recomputes its canonical hash before considering cohort
state. Four named checks own evidence integrity, exactly five human sessions, complete assigned task
coverage, and a `candidate` recommendation with no unverified P0/P1. Any failed claim yields a
checked `held` report; build success or an empty finding list cannot override it.

`/playtest-release` is a development-only projection of that report. The operator packaging command
requires explicit private-release acknowledgement and clean tracked inputs before it builds. A
qualified run stages production web/worker/package output, migrations, locked manifests, an
environment example, and the operator runbook while excluding human notes, identifiers, recordings,
quotes, secrets, development evidence, and source artwork. The ignored artifact receipt binds the
archive SHA-256 and byte size to the exact Git commit and release-report hash. Readiness does not
equal packaging: FIN-008 stays open until an archive, receipt, and clean-install smoke test exist.

The same archive core has a non-promotable rehearsal mode. Its distinct archive name and typed
receipt make it impossible to pass a rehearsal receipt off as the canonical package. The rehearsal
uses temporary storage and a fresh temporary PostgreSQL database, production-installs the extracted
workspace from the frozen lockfile, applies the built migration entrypoint, and health-checks the
web and worker against the tested commit. CI runs this after the production build on every `main`
push. Rehearsal proves package mechanics only; it always reports `releaseEligible: false` and cannot
substitute for FIN-007 evidence or the final private-operator smoke test.

Because SvelteKit emits assets for development routes even when production configuration returns a
404 for them, archive staging also prunes PNG/JPEG development artwork and source maps from the
copied web build. A post-tar entry validator requires the web, worker, release metadata, and built
migration entrypoints while rejecting source directories, `node_modules`, `.env`, evidence folders,
source maps, and source-format artwork before a receipt can be written.
