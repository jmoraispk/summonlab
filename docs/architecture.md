# Architecture and platform

## Goals

The architecture exists to maximize character agency without surrendering correctness, cost control, or replayability.

1. The server is authoritative.
2. The engine is deterministic given state, action, and seed.
3. Model requests are independent by default.
4. Summonlab owns context and memory.
5. Agent output is untrusted input until validated.
6. Every important decision is replayable and inspectable.
7. Policies are swappable so most simulation costs no model tokens.

## System boundary

```text
┌──────────────────────── web / PWA ────────────────────────┐
│ render state · submit player intent · stream turn results │
└────────────────────────────┬───────────────────────────────┘
                             │ authenticated API
┌────────────────────────────▼───────────────────────────────┐
│                    authoritative server                    │
│                                                           │
│  command handler ─► deterministic engine ─► event store   │
│         │                    ▲                    │         │
│         │                    │ validated action   │         │
│         ▼                    │                    ▼         │
│  turn orchestrator ─► policy adapter ◄──── context/memory │
│         │                                                 │
│         └──── budgets · timeouts · retries · telemetry    │
└────────────────────────────────────────────────────────────┘
```

The browser never receives a model-provider key and never decides canonical outcomes.

## Suggested repository shape

```text
apps/
  web/                 browser UI and server routes
  worker/              queued agent turns and simulations
packages/
  contracts/           commands, actions, events, and runtime schemas
  engine/              pure state transitions and legal-action generation
  characters/          generation, personality, progression, relationships
  policies/            random, scripted, replay, and model policies
  context/             memory selection and turn-packet assembly
  simulation/          balance runs, fixtures, and evaluation scenarios
  ui/                   shared visual components
docs/
```

A TypeScript monorepo keeps contracts shared between the web client, server, engine, simulations, and tests. The engine package must not import database, network, clock, or model SDK code.

## Deterministic engine

The core transition stays conceptually small:

```ts
type Transition = (
  state: GameState,
  action: ValidatedAction,
  seed: Seed,
) => TransitionResult;
```

`TransitionResult` contains the next state and emitted domain events. Randomness comes only from the supplied seeded generator. Time enters as an explicit command or event, not a call to the system clock inside the engine.

The engine is responsible for:

- legal-action generation;
- target and range validation;
- resource and action costs;
- seeded resolution;
- turn order and status effects;
- settlement rules;
- summon tables and pity transitions;
- emitted events and replay hashes.

## Policy interface

Policies choose; they do not resolve:

```ts
interface HeroPolicy {
  decide(packet: HeroTurnPacket): Promise<HeroDecision>;
}
```

Initial implementations:

- `RandomPolicy` for fuzzing and baselines;
- `ScriptedPolicy` for deterministic fixtures and authored behaviors;
- `ReplayPolicy` for reproducing an action log;
- `ModelPolicy` for personality, memory, dialogue, and improvisation.

The orchestrator validates `HeroDecision` against the packet's legal actions. Invalid, late, or unavailable responses use a deterministic fallback policy and record the failure.

## Independent agent turns

Each model decision should be a fresh request assembled by Summonlab. Do not depend on an opaque provider-side chat history for character continuity.

### Turn packet

```text
identity
  stable personality · values · biography · voice · vocation

current self
  health · needs · emotion · goals · inventory · conditions

social context
  relevant relationships · promises · conflicts · authority

situation
  mission · local world state · visible entities · recent events

recalled memory
  selected episodes · relationship beliefs · compact summaries

decision contract
  mode · legal actions/tools · targets · output schema · deadline
```

The packet should contain only what that hero can know. Hidden game state stays hidden even if including it would make the model more competent.

### Structured decision

```ts
interface HeroDecision {
  actionId: string;
  targetIds: string[];
  intent: string;
  spokenLine?: string;
  memoryCandidates?: MemoryCandidate[];
}
```

`intent` helps explain and evaluate a decision but has no authority. Only the validated action and targets enter the engine.

When OpenAI integration begins, the Responses API can accept explicit instructions and inputs and produce schema-constrained output. Summonlab can keep turns stateless and manually supply the relevant items rather than linking requests into a provider-owned conversation. See the official [Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

## Memory ownership

The canonical event log is not the same as a hero's memory.

| Store | Purpose | Selection |
| --- | --- | --- |
| Event log | Complete objective history and replay | Never summarized away |
| Working memory | Very recent perceived events | Fixed rolling window |
| Episodic memory | Salient personal experiences | Relevance, recency, emotion, novelty |
| Social beliefs | Trust, affection, fear, respect, debts, promises | Relationship-specific |
| Semantic summary | Stable learned facts and ongoing goals | Periodically rebuilt from events |

The policy may suggest what felt memorable, but the memory service decides what persists. It records provenance back to canonical events and can regenerate summaries when prompt formats change.

Context assembly should be deterministic for a given state and context-policy version. Log the selected memory IDs and token counts with every decision.

## Model provider integration

Add a provider adapter only after random and scripted policies can complete the vertical slice.

```ts
interface ModelGateway {
  generateDecision(request: ModelDecisionRequest): Promise<ModelDecisionResponse>;
}
```

Keep provider details outside the engine. Configuration selects the routine model at deployment time. Choose the lowest-cost model that passes scenario evaluations for legality, competence, personality consistency, and latency; do not bake a model name or price into game rules. The current model catalog belongs in configuration and deployment documentation, with the official [OpenAI model guide](https://developers.openai.com/api/docs/models) as the source of truth.

### API key boundary

When an OpenAI key is added:

- store it as the server-side `OPENAI_API_KEY` environment variable;
- never expose it to the browser, mobile wrapper, logs, replays, or database rows;
- never commit `.env` files containing secrets;
- route all requests through the backend or worker;
- apply per-account, per-run, and global spend caps;
- record token usage and latency without recording secrets.

This follows OpenAI's official [API key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety).

### Cost and latency controls

- Call models only for decisions where personality or interpretation matters.
- Resolve pathfinding, damage, routine labor, and status ticks locally.
- Cache immutable character-card fragments and shared world rules.
- Cap input and output tokens per decision mode.
- Set a deadline and deterministic fallback.
- Batch background summaries or evaluations when immediate output is unnecessary.
- Track cost per hero, scene, expedition, and active player.
- Use stronger models only for evaluated cases that benefit from them.

## Persistence model

An initial relational schema needs these conceptual groups:

### Accounts and summoning

- players;
- banner definitions and versions;
- player banner pity counters;
- summon receipts;
- currency ledger.

Pity rows require transactional locking or optimistic version checks. Currency spend, summon result, pity update, and receipt creation commit together or not at all.

### Characters and society

- hero identity and generation seed;
- stable trait vectors and generated character card;
- mutable stats, vocation, conviction, and ascension;
- relationships and remembered commitments;
- settlement membership and current assignment.

### World and replays

- campaigns and settlements;
- world snapshots;
- commands and domain events;
- expedition and combat runs;
- policy decisions and validation results;
- prompt/context versions;
- model usage and latency.

Snapshots speed loading, but the command and event log remains sufficient to audit important state transitions.

## Request and turn flow

1. Client submits an authenticated player command.
2. Server validates authority and expected state version.
3. Engine applies immediate commands or emits a `HeroDecisionRequested` event.
4. Worker leases the pending decision.
5. Context service assembles and stores the turn-packet manifest.
6. Selected policy returns a structured decision.
7. Orchestrator validates it against legal actions and the expected state version.
8. Engine applies the action and emits events.
9. Memory projections and client subscriptions update.
10. Usage, latency, fallback, and replay metadata are recorded.

If state changed while a model was thinking, discard or re-evaluate the stale decision. Never force it onto a different state.

## Platform

Web remains the best first platform:

- model keys and authoritative state already require a server;
- turn-based play tolerates decision latency;
- a responsive UI covers desktop and mobile browsers;
- a PWA can provide installation and notifications later;
- the same web build can be wrapped only if distribution eventually requires it.

The client should stream partial scene status—“considering,” “responding,” “action validated”—without exposing hidden chain-of-thought. Visible intent, spoken dialogue, chosen action, and mechanical result are enough for legibility.

## Testing and evaluation

### Engine tests

- property tests for invariants and legal actions;
- golden seeded replays;
- transactional pity tests;
- serialization and migration tests;
- stale-turn and duplicate-command tests.

### Policy evaluations

- action legality;
- mission competence;
- personality distinguishability;
- memory precision and continuity;
- susceptibility to player prompt injection;
- refusal quality;
- latency and cost distributions;
- fallback frequency.

Run evaluation scenarios against recorded packets so model or prompt changes can be compared without changing the game state around them.

## Implementation order

1. Contracts and seeded engine.
2. Random and scripted policies.
3. Summoning, pity, and character seeds.
4. One expedition and replay viewer.
5. Settlement projection and council interaction.
6. Memory selection and model gateway.
7. Model evaluations and budget controls.
8. Broader content, species, and progression.
