# Full implementation plan

## Charter

Deliver a browser-playable vertical slice of Summonlab that proves four things together:

1. generated heroes remain visually and psychologically coherent;
2. heroes make autonomous choices that are surprising but inspectable;
3. the settlement continues meaningfully while the player is away;
4. floors 1–5 create a story through preparation, relationships, hidden information, and permanent consequences.

This document turns the [capable prototype plan](prototype-plan.md) into an engineering program. It is the execution source of truth; game-design intent remains in [game design](game-design.md), and technical invariants remain in [architecture](architecture.md).

## Definition of done

The vertical slice is complete when a new player can:

- start a seeded run without developer tools;
- experience the first-person summoning introduction;
- meet three visually distinct, stable adult heroes;
- speak freely with each hero and give constrained orders;
- inspect what each hero knows, needs, wants, and habitually does without seeing hidden reasoning;
- leave and return to a causally correct settlement recap;
- use the kitchen, dormitory, training ground, workshop, and summoning gate;
- choose a facility to power with the first ember core;
- run one Iron Moon resource mission;
- prepare for and attempt tower floors 1–5;
- discover or miss the maintenance route through valid actions;
- retreat, lose a hero permanently, synthesize a hero, or lose the entire run through Master death;
- replay the run from its seed and action log;
- understand why the run changed through readable events and social reactions.

The build must also pass the automated quality gates in this document and a moderated five-player test.

## Delivery model

### Expected scale

This is approximately **12–16 engineering weeks** for one continuous lead-engineering stream, excluding prolonged art review, account provisioning, and user-feedback pauses. The work should run as an iterative execution loop rather than a single unattended task.

Recommended cadence:

- every turn: report what changed and ask at least one focused feedback question;
- every 2–5 engineering days: provide something visible, runnable, or measurable;
- every milestone: stop for a playtest or explicit design review;
- every accepted decision: update this plan or the appropriate design document;
- every repository-changing turn: validate, commit, and push.

The first playable proof should arrive much earlier than the complete slice. Milestone 1 is intentionally a narrow summon-to-choice scene.

### Feedback packet

Every reviewable slice should include:

1. the behavior or visual being evaluated;
2. exact local URL or command;
3. two or three test actions;
4. known limitations;
5. focused questions whose answers affect the next slice;
6. captured screenshots, replay IDs, or evaluation results where useful.

Feedback is recorded as one of:

- **accepted:** becomes the new default;
- **revise:** change before continuing on the dependent path;
- **experiment:** preserve both variants until measured;
- **deferred:** record but do not block the current milestone.

## Locked defaults and reversible choices

These are lead-engineering defaults, not irreversible product decrees.

| Area | Default | Revisit trigger |
| --- | --- | --- |
| View | 2.5D settlement plus staged third-person missions | Courtyard experiment materially improves presence |
| Runtime | Browser and installable PWA | Mobile browser blocks a required interaction |
| Front end | SvelteKit | Rendering integration becomes substantially harder than an alternative |
| Renderer | PixiJS v8 | Rig or shader requirements exceed its practical envelope |
| Server | SvelteKit Node server plus separate worker | Load or deployment needs independently scalable services |
| Playtest access | Local machine and private LAN URL | Remote collaborators need access |
| Database | PostgreSQL | None anticipated for the prototype |
| Queue | PostgreSQL-backed jobs | Contention or throughput requires a dedicated queue |
| Contracts | Zod schemas plus inferred TypeScript types | JSON Schema generation proves incomplete |
| Agent state | Fresh independent Responses request per decision | A measured use case benefits from provider conversation state |
| Routine model | `gpt-5-nano` through `OPENAI_POLICY_MODEL` | Evaluation shows insufficient character consistency |
| Escalation model | None automatically; evaluate `gpt-5.6-luna` for authored story work | Approved quality test justifies additional cost |
| Art truth | Deterministic physical manifest and approved reference pack | Never delegated to runtime generation |
| Character scope | Adult humans, ages 18–42 | Human pipeline passes diversity and identity tests |
| Reference art | May guide original/generated development art; never ships as game content | Rights or intended use changes |
| Master timing | `Wait` by default; `Countdown`, `Step`, and `Continuous` available | Playtests show fewer modes are clearer |
| Master fallback | Directed deterministic policy by default; seeded random available | An evaluated delegated policy adds value |
| Story authority | Fixed story envelope plus engine-validated runtime patches | Dynamic patches harm coherence or replayability |
| Synthesis warning | Short irreversible-action warning | Testers misunderstand the consequence |
| Visual order | Summoning, settlement, then dialogue close-up | A dependency makes another order cheaper |
| Multiplayer | None | Single-player loop is already compelling |

## System topology

```text
                         ┌──────────────────────────┐
                         │       SvelteKit web      │
                         │ UI, routes, commands, SSE│
                         └────────────┬─────────────┘
                                      │ validated commands
                                      ▼
┌─────────────────┐        ┌──────────────────────────┐
│ PixiJS renderer │◀───────│ application service      │
│ scenes and rigs │ events │ auth, versions, snapshots│
└─────────────────┘        └────────────┬─────────────┘
                                       │ transaction
                                       ▼
                          ┌──────────────────────────┐
                          │ deterministic TS engine  │
                          │ (state, command, seed)    │
                          └────────────┬─────────────┘
                                       │ events / due jobs
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
         ┌─────────────────────┐              ┌─────────────────────┐
         │ PostgreSQL          │              │ simulation worker   │
         │ state, events, jobs │◀────────────▶│ catch-up and policy │
         └─────────────────────┘              └──────────┬──────────┘
                                                        │ fresh packet
                                                        ▼
                                             ┌─────────────────────┐
                                             │ policy gateway      │
                                             │ random/scripted/LLM │
                                             └─────────────────────┘
```

The renderer never advances authoritative state. It displays snapshots and events, predicts only cosmetic motion, and sends commands. The worker is the only component allowed to advance a closed or inactive run.

## Repository target

```text
apps/
  web/
    src/lib/components/       Svelte interface
    src/lib/game/             PixiJS bridge and scene lifecycle
    src/routes/               play, forge, replay, API, health
    static/                   development-safe assets
  worker/
    src/jobs/                 clock, decision, recap, asset jobs
    src/main.ts
packages/
  contracts/                  Zod schemas and serialized types
  engine/                     pure reducer, PRNG, legal actions
  characters/                 physical manifests and minds
  content/                    buildings, encounters, story beats
  policies/                   random, scripted, OpenAI policies
  persistence/                schema, migrations, repositories
  rendering/                  scene graph, rigs, cameras, effects
  observability/              logs, traces, replay and cost records
  testkit/                    builders, seeds, fixtures, fake clock
tooling/
  eslint/
  typescript/
  scripts/
assets-source/
  art-bible/
  characters/
  settlement/
  tower/
  audio/
docs/
prototype/                    preserved static design prototype
```

Use `pnpm` workspaces without a task orchestrator initially. Add an orchestrator only if build caching or dependency scheduling becomes a measured bottleneck.

## Technology baseline

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript, strict mode | No implicit `any`; serialized boundaries validated |
| Runtime | Node.js Active LTS pinned in repository | Web and worker use the same version |
| Package manager | pnpm with locked version | Commit lockfile and package-manager field |
| Web framework | SvelteKit with Node adapter | SSR for shell; game canvas initializes client-side |
| 2D renderer | PixiJS v8 | WebGL/WebGPU renderer, asset bundles, pointer interaction |
| Database | PostgreSQL | Local Docker service; hosted provider later |
| SQL layer | Drizzle ORM and explicit migrations | SQL remains inspectable |
| Job queue | pg-boss or a minimal leased-job repository | Decide through a foundation spike |
| Schemas | Zod | Runtime validation and TypeScript inference |
| Model API | Official OpenAI TypeScript SDK, Responses API | Independent structured decisions |
| Unit tests | Vitest | Fake clock and deterministic seeds |
| Property tests | fast-check | Invariants across generated actions and state |
| Browser tests | Playwright | Desktop, mobile, screenshot and reconnect paths |
| Formatting | Prettier with Svelte support | One formatting command |
| Linting | ESLint with TypeScript and Svelte rules | Ban nondeterministic engine APIs |
| Logging | Pino-compatible structured JSON | Redact model key and private dialogue by default |
| Local environment | Docker Compose for Postgres | Web and worker run locally for fast reload |

PixiJS v8 provides asynchronous application initialization, scene objects, pointer events, and cached asset bundles, which matches the authored 2D scene plan. See the official [PixiJS application](https://pixijs.com/8.x/guides/components/application) and [asset](https://pixijs.com/8.x/guides/components/assets) guides.

## Environment and configuration

Commit `.env.example`, never `.env`. Configuration is parsed once at process startup and fails fast on invalid production values.

Required groups:

```text
APP_ENV
APP_ORIGIN
DATABASE_URL
RUN_ENCRYPTION_KEY
OPENAI_API_KEY             optional until LLM policy is enabled
OPENAI_POLICY_MODEL        default gpt-5-nano when LLM policy is enabled
OPENAI_POLICY_TIMEOUT_MS   default 30000
OPENAI_POLICY_MAX_OUTPUT_TOKENS default 800
OPENAI_POLICY_REASONING_EFFORT  default minimal
OPENAI_STORY_MODEL         unset until a stronger model passes story evaluation
OPENAI_BACKGROUND_MODE     default false for short routine turns
POLICY_MODE                random | scripted | model
SIMULATION_SPEED           default 4
MAX_DECISIONS_PER_RUN_DAY
MAX_TOKENS_PER_RUN_DAY
ASSET_STORAGE_MODE         local | s3
ASSET_STORAGE_BUCKET
LOG_LEVEL
```

Feature flags are typed configuration stored with the run. A replay uses the feature and content versions that created it.

## Domain boundaries

### Canonical aggregates

| Aggregate | Owns | Does not own |
| --- | --- | --- |
| Run | seed, clock, status, Master, progression, resource ledger | browser session |
| Hero | physical manifest, mind, needs, habits, goals, skills, inventory | unrestricted world mutation |
| Settlement | buildings, assignments, storage, routes, available actions | hero intentions |
| Mission | floor/world state, party, objective, legal actions, encounter seed | model context |
| Society | relationships, witnessed events, beliefs, rumors, authority | omniscient truth |
| Decision job | context hash, legal actions, policy, response, usage, status | permanent game truth until applied |

### Core invariants

- No engine code calls `Math.random`, wall-clock time, network APIs, or database APIs.
- Every mutation results from a validated command and produces immutable domain events.
- Resources use a ledger; balances cannot become negative.
- A dead or synthesized hero cannot act, be assigned, or return.
- Master death atomically ends the run.
- Only legal actions included in a decision packet may be applied.
- A decision result applies only to the state version and legal-action hash that produced it.
- Knowledge and belief remain distinct from world truth.
- Physical manifest fields cannot change outside injury, aging, equipment, or explicit evolution events.
- Every catch-up batch is replay-equivalent to resolving the same due events online.

## Engine contract

```ts
type ApplyResult = {
  state: GameState;
  events: DomainEvent[];
  scheduled: ScheduledEvent[];
  decisionRequests: DecisionRequest[];
};

function applyCommand(
  state: Readonly<GameState>,
  command: GameCommand,
  entropy: EntropyCursor,
): ApplyResult;
```

`EntropyCursor` is initialized from the run seed and event sequence. Each random draw has a named purpose and advances the cursor. Replay asserts the resulting state hash after every event.

### Command flow

```text
client/worker command
        │
        ▼
schema validation
        │
        ▼
load state + expected version
        │
        ▼
derive legal commands
        │
        ▼
pure engine apply
        │
        ▼
transaction: events + snapshot + jobs
        │
        ▼
publish event cursor to connected clients
```

Use optimistic concurrency on `run.version`. A stale client receives the latest cursor and a typed conflict response rather than silently overwriting state.

## Simulation clock

The clock is event-driven, not a per-frame simulation.

### Scheduled event classes

- need threshold reached;
- activity completed;
- habit cue became eligible;
- daily plan boundary;
- mission turn ready;
- injury or status tick;
- portal opened or expired;
- building work completed;
- promise, goal, or rumor review due.
- Master decision countdown expired.

### Online resolution

The server resolves due deterministic events immediately and queues decisions only at genuine choice boundaries. The UI receives a snapshot plus ordered events through server-sent events. Cosmetic interpolation is client-side.

### Catch-up resolution

On reconnect or worker wake:

1. acquire a lease on the run;
2. load the last resolved simulated time;
3. resolve deterministic and habit events in chronological order;
4. stop at unresolved agent decisions or safety limits;
5. queue decision jobs;
6. continue when results arrive;
7. materialize a concise recap from domain events;
8. release the lease and notify clients.

Safety limits cap events, simulated duration, and decisions per batch. Extremely old runs enter a summarized stasis policy rather than creating an unbounded bill.

## Hero model

### Physical manifest

`CharacterManifest` is generated once from `appearanceSeed` and versioned content tables. It includes adult age, proportions, phenotype parameters, hair, eyes, distinguishing marks, voice range, posture, handedness, family anchors, and rig attachment points.

Generation order is deterministic:

```text
appearance seed
  → adult age
  → physiological frame
  → height and body composition
  → face and phenotype ranges
  → hair, eyes, marks, voice, posture
  → outfit fit and approved presentation recipe
  → stable manifest hash
```

Culture, name, temperament, values, intelligence, rarity, and skill affinity use separate entropy streams. Automated tests reject accidental correlations between protected appearance fields and personality, morality, intelligence, obedience, or rarity.

### Mind state

```ts
type HeroMind = {
  temperament: TemperamentVector;
  values: ValueWeight[];
  drives: Drive[];
  goals: Goal[];
  habits: Habit[];
  needs: NeedState;
  beliefs: Belief[];
  episodicMemory: EpisodeSummary[];
  relationships: RelationshipEdge[];
  promises: PromiseRecord[];
  authority: AuthorityModel;
  currentPlan: DailyPlan | null;
};
```

Static prompts never substitute for mutable state. The prompt describes how to use the packet; the packet contains the current person.

### Habit resolver

Habits have cue predicates, candidate actions, strength, recency, context tags, satisfaction history, and inhibition rules. The deterministic resolver ranks eligible habits against needs, orders, goals, availability, and interruption pressure. It emits an ordinary action unless the top candidates are close, socially costly, novel, or blocked; those cases create a decision job.

## Agent decision pipeline

### Decision packet

Every model turn is independently assembled and includes only:

- hero identity and stable behavioral dimensions;
- current needs, injury, affect, goals, and habits;
- location and observable environment;
- relevant known beliefs with provenance;
- recent remembered events selected by deterministic retrieval;
- relationships relevant to present actors;
- player communication exactly as witnessed;
- active player directives relevant to this hero, with author, scope, and expiry;
- legal action IDs with descriptions, targets, costs, and likely immediate affordances;
- a compact response schema.

Do not send authoritative hidden state, undiscovered secrets, other heroes' private thoughts, future events, or the entire run log.

### Response schema

```ts
const HeroDecision = z.object({
  actionId: z.string(),
  targetIds: z.array(z.string()).max(4),
  publicIntent: z.string().max(240),
  spokenText: z.string().max(600).nullable(),
  goalProposal: GoalProposal.nullable(),
  memoryCandidateIds: z.array(z.string()).max(6),
});
```

The model chooses; the engine resolves. `publicIntent` is inspectable characterization, not hidden chain-of-thought.

Player directions are stored as data, not concatenated into system instructions. A `PlayerDirective` keeps its original text, scope (`decision`, `mission`, `day`, or `until_revoked`), intended recipients, witnessed delivery, optional structured priorities, and expiry. The original direction is quoted in every relevant decision packet. It influences best-effort selection but cannot expand legal moves, reveal hidden information, force obedience, or override safety and engine rules. The journal records whether a chosen action advanced, conflicted with, or could not satisfy the direction.

The official OpenAI documentation states that Structured Outputs enforce schema adherence, unlike basic JSON mode. Routine decision calls use a strict JSON Schema through the Responses API. See [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

The initial routine candidate is `gpt-5-nano`, which the official model page describes as the fastest, cheapest GPT-5 variant and lists as supporting the Responses API and Structured Outputs. Cost is not enough to pass evaluation: if it cannot maintain goals, personality, or knowledge boundaries, test `gpt-5.6-luna` before any larger model. See [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) and the current [model comparison](https://developers.openai.com/api/docs/models/compare).

### Job state machine

```text
created → submitted → queued → in_progress → completed → validated → applied
    │          │           │          │            │           │
    └──────────┴───────────┴──────────┴────────────┴──→ failed/fallback
                                      └───────────────→ stale/replan
```

Each job records run version, simulated time, hero ID, decision kind, context hash, legal-action hash, prompt version, policy, provider response ID, latency, tokens, estimated cost, parsed result, validation errors, and terminal disposition.

Use ordinary foreground calls for short turns. Background mode is available for unusually long narrative or planning work and can be polled asynchronously, but Summonlab's queue remains authoritative. Official OpenAI documentation describes background execution and status polling in the [background mode guide](https://developers.openai.com/api/docs/guides/background).

### Fallback ladder

1. validate strict structured response;
2. retry once for provider or transient parse failure if budget allows;
3. use deterministic habit policy when context is ordinary;
4. use scripted safety policy for emergencies;
5. idle safely only when no meaningful action can be chosen.

No fallback may invent a legal action, bypass a resource cost, or resurrect stale state.

### Evaluation suite

Before enabling a model by default, replay a fixed corpus of decision packets and score:

- legal-action selection rate;
- schema validity;
- personality and value consistency;
- use of known versus unknown information;
- order obedience diversity without randomness for its own sake;
- goal continuity;
- repetitive language;
- unsafe disclosure of hidden state;
- latency, tokens, and cost;
- divergence from scripted safety expectations.

Store packet fixtures without private API credentials. Model snapshots and prompt versions are explicit evaluation dimensions.

## Persistence design

### Primary tables

| Table | Purpose |
| --- | --- |
| `runs` | run metadata, seed, simulated time, version, status, state hash |
| `run_snapshots` | compressed materialized state at event cursor |
| `run_events` | append-only domain events and payload versions |
| `scheduled_events` | due simulation work and lease state |
| `heroes` | stable identity, life state, rarity, progression |
| `character_manifests` | physical manifest, content version, manifest hash |
| `hero_minds` | materialized needs, affect, plan, goals, habits |
| `beliefs` | subject, claim, confidence, provenance, visibility |
| `relationships` | directed social edge dimensions and history cursor |
| `settlements` | settlement state and powered systems |
| `buildings` | construction, capacity, assignments, upgrades |
| `missions` | floor/world state, objective, party, outcome |
| `items` | equipment, resources, ownership and durability |
| `resource_ledger` | all resource debits and credits |
| `decision_jobs` | complete policy lifecycle and usage |
| `communications` | spoken/typed acts, audience, channel and context |
| `asset_records` | source manifest, prompt, model, references, approval |
| `content_versions` | immutable rules and story package identifiers |

### Event evolution

Every event has `eventType`, `schemaVersion`, `sequence`, `simulatedAt`, `actorId`, `causationId`, and `correlationId`. Upcasters convert older event payloads during replay. Never edit historical events in place.

Snapshots are disposable caches. A development command must rebuild a run from events and compare the final hash.

## API surface

### Player API

```text
POST   /api/runs                         create a seeded run
GET    /api/runs/:runId                  snapshot and event cursor
POST   /api/runs/:runId/commands         validated player command
GET    /api/runs/:runId/events           SSE after cursor
POST   /api/runs/:runId/conversations    player communication act
PATCH  /api/runs/:runId/control          decision timing and fallback policy
POST   /api/runs/:runId/directives       create, replace, or revoke direction
POST   /api/runs/:runId/catch-up          request/resume catch-up
GET    /api/runs/:runId/recap             readable return summary
GET    /api/runs/:runId/journal           filterable player chronicle
```

### Development API

```text
POST   /api/dev/characters/generate      deterministic manifest batch
POST   /api/dev/simulate                 run policy simulations
GET    /api/dev/replays/:runId           event and state-hash inspector
POST   /api/dev/decisions/replay         evaluate one saved packet
GET    /api/dev/costs                    token and latency summary
```

Development routes are unavailable in production builds unless explicitly secured.

### Response conventions

- success returns payload plus run version and event cursor;
- conflicts return typed `STALE_RUN_VERSION` with latest cursor;
- illegal commands return `ILLEGAL_ACTION` with safe player-facing reason;
- validation errors use field paths but never echo secrets;
- idempotency keys protect command retries;
- request correlation IDs connect browser, engine, database, and worker logs.

## Client implementation

### Route map

| Route | Purpose |
| --- | --- |
| `/` | title, run creation, continue, settings |
| `/play/[runId]` | settlement, tower, portals, conversations |
| `/summon/[runId]` | focused summon sequence and first meeting |
| `/forge` | development Character Forge |
| `/forge/contact-sheet` | printable and JSON-exportable deterministic 100-seed cohort audit |
| `/visual-lab` | hash-bound asset comparison and append-only human review gate |
| `/visual-lab/summon-card` | development-only, hash-bound summon-card request preview and one-shot execution gate |
| `/visual-lab/runtime-bundles` | approved-only WebP budget ledger and live PixiJS bundle proof |
| `/replay/[runId]` | event timeline and deterministic replay |
| `/debug/decisions/[jobId]` | redacted packet/result inspector |

### UI layers

1. PixiJS canvas for settlement and mission space.
2. Svelte semantic UI for navigation, cards, dialogue, commands, recaps, and accessibility.
3. Cinematic overlay for summon, promotion, death, and synthesis.
4. Debug overlay for hit regions, routes, state version, FPS, and event cursor.

Do not render critical text only into canvas. Dialogue, buttons, costs, death confirmation, and event history remain accessible DOM elements.

### Scene lifecycle

Each scene implements `load`, `enter`, `applyEvent`, `resize`, `pause`, and `destroy`. Assets load by named bundles. Scene state is derived from server snapshots and events, never kept as a second game simulation.

### Connectivity

- command optimism is limited to button state and cosmetic anticipation;
- authoritative results arrive over SSE;
- reconnect requests events after the last cursor;
- gaps trigger a snapshot refresh;
- offline player commands are not queued blindly because legality may change;
- installed PWA shows the last snapshot read-only while disconnected.

## Character Forge implementation

### Forge panels

- seed and manifest version;
- front, profile, three-quarter, full-body, and settlement-scale views;
- age, height, frame, face, phenotype, hair, eyes, voice, posture, and marks;
- lock/reroll controls per field group;
- expression and mouth-shape grid;
- outfit and equipment fitting;
- injury and promotion overlays;
- 100-seed diversity contact sheet;
- prompt/reference history for generated assets;
- approval and rejection notes.

### Identity tests

- same seed and content version yields byte-equal manifest JSON;
- manifest hash is embedded in every asset record;
- reference views pass landmark consistency checks;
- six expressions remain recognizable in blind human review;
- body proportions remain stable across outfits;
- settlement and mission rigs share palette and attachment IDs;
- generated images cannot silently overwrite approved references.

The first art spike uses abstract original assets. User-provided references can guide the art bible once their intended usage and rights are clear.

## Settlement implementation

### Spatial model

The prototype settlement is a small route graph, not free continuous navigation. Nodes represent gates, building entrances, rooms, stations, beds, tables, and social spots. Edges have travel time, access rules, capacity, and visual paths.

PixiJS animates movement along the authored paths. The engine schedules arrival from route duration; visual position never determines authoritative arrival.

### Building slice

| Building | Required interactions | Required simulation effect |
| --- | --- | --- |
| Summoning gate | summon, inspect, first meeting | roster and clean-slate onboarding |
| Kitchen | assign, cook, eat, shared meal | hunger, social contact, food ledger |
| Dormitory | sleep, rest, privacy | fatigue, recovery, roommate contact |
| Training ground | practice, teach, spar | skill progress, injury risk, habits |
| Workshop | repair, craft, inspect | equipment durability and upgrades |

Powering one building after floor 1 changes availability and becomes the first authority test.

## Conversation and authority

Player input is stored as a communicative act with speaker, intended audience, witnesses, location, tone metadata inferred only when needed, and exact text. The model may interpret it, but the source text remains canonical.

Order handling produces one of:

- accept;
- accept with concern;
- negotiate conditions;
- ask for context;
- delay;
- refuse;
- misunderstand based on available knowledge.

Authority is multi-dimensional: competence, provision, trust, legitimacy, fear, strength, and consistency. No single scalar determines obedience. The UI shows evidence and relationship language rather than a hidden “obedience score.”

## Mission implementation

### Master control modes

The Master is the player's embodied character. Control uses two orthogonal settings so pacing and choice policy do not become a confusing matrix of bespoke modes.

**Decision timing** determines when unattended choices resolve:

| Timing | Behavior |
| --- | --- |
| `Wait` | Pause indefinitely for a legal player choice; this is the default. |
| `Countdown` | Show a visible five-second timer; accept player input until resolution begins, then use the fallback. The duration is configurable. |
| `Step` | Use the fallback for exactly one Master decision, then return to `Wait`. |
| `Continuous` | Use the fallback for each Master decision until paused, the mission ends, or a configured safety stop fires. |

**Fallback selection** determines how an unattended choice is made:

- `DirectedPolicy` scores legal actions against structured priorities such as protect self, protect a named hero, retreat below a health threshold, conserve consumables, seek secrets, or focus the objective. A scoped free-text direction accompanies those priorities. The first slice uses deterministic scoring and a seeded tie-breaker; unsupported intent is shown rather than silently invented.
- `RandomPolicy` makes a seeded random legal choice. It is useful for simulation, experimentation, and deliberately chaotic play.

The interface always exposes pause/takeover during `Countdown` and `Continuous`; already committed engine actions remain atomic. Mode, timer, fallback, direction snapshot, action source, and expiry outcome are logged for replay. Configurable safety stops can force `Wait` before irreversible choices, imminent Master death when a retreat option exists, or any state the policy cannot classify. The player can deliberately disable those stops for a genuinely uninterrupted autonomous run.

Autopilot exists for observation, accessibility, and faster repeated testing. It must not erase the player's physical stake in Master death. Summoned heroes remain autonomous in every Master mode.

### Mission state machine

```text
available → preparing → deployed → resolving → extraction
                  │           │           │
                  └→ canceled ├→ retreat  └→ success/failure/death
                              └→ game_over if Master dies
```

### Turn structure

1. engine advances environmental events;
2. deterministic monsters select duty actions;
3. each eligible hero receives legal actions;
4. routine actions resolve by policy; meaningful choices create jobs;
5. validated actions apply in initiative order;
6. consequences, observations, and memories emit;
7. victory, retreat, or next turn is evaluated.

### Floors 1–5 content contract

Each floor package defines objective, arena graph, encounter seed rules, monster duties, environmental events, legal tools, retreat conditions, secrets, observation rules, rewards, and story hooks. Content never embeds arbitrary state mutations; it emits commands through engine interfaces.

The floor-5 Foundry Warden must support at least:

- direct damage with sufficient preparation;
- furnace control through the discovered route;
- retreat with surviving consequences.

### Floor story architecture

Every five-floor band has an authored **story spine**. Individual floors provide different mission shapes, but together they perform a small arc:

| Floor in band | Narrative job | Mechanical job |
| --- | --- | --- |
| 1 | Establish a need, place, or question | Introduce the band's rule |
| 2 | Complicate the obvious interpretation | Require a second capability |
| 3 | Divide priorities or relationships | Apply injury, scarcity, or separation pressure |
| 4 | Reveal the cost of earlier behavior | Test preparation and information |
| 5 | Pay off the conflict and leave a consequence | Boss, band test, or irreversible choice |

The runtime engine owns a **story envelope** for each band: world laws, opening state, required anchors, finale constraints, content catalog, reward budget, and forbidden changes. The envelope compiles to a beat graph with an authored default route and explicit patch points.

At a patch point, a `StoryDirector` receives the envelope, current canonical state, relevant public history, unresolved goals, actual cast, and active player direction. It may propose a strict `StoryPatch` that can:

- activate, skip, or reorder optional eligible beats;
- bind an authored story role to an existing living character;
- select an objective, location, enemy, discovery, or complication from the envelope's catalog;
- carry a validated consequence or relationship conflict into a later eligible beat;
- choose the character-aware expression of an established fact.

The engine rejects patches that violate causality, use unknown information, require unavailable assets, exceed reward bounds, revive the dead, modify world laws, or directly mutate state. Accepted patches emit ordinary commands and domain events, enter replay, and become canonical for that run. Rejection, timeout, or model failure follows the authored default edge.

Agent assistance happens at three levels:

1. **Development-time story workshop:** a stronger configured model can propose five-floor arcs from the world bible, mechanics, enemy family, and target emotional question. A developer reviews the proposal and compiles accepted beats into versioned content.
2. **Runtime story direction:** a separately budgeted call may choose an engine-valid patch at sparse band checkpoints, allowing the cast and player behavior to alter the route without generating the whole game.
3. **Runtime character adaptation:** the cheap routine model can express accepted facts through the actual heroes' knowledge, relationships, habits, and goals.

This hybrid keeps the tower coherent and testable while allowing the cast to make each run personal. Floors 1–5 remain predominantly predesigned but include one optional runtime patch point to prove the integration before expanding toward all twenty bands.

## Art production pipeline

```text
art brief → original concept → approved reference sheet
   → layered source → runtime export → asset manifest
   → automated checks → in-game review → approved bundle
```

Source files remain separate from optimized runtime assets. Every runtime asset has source reference, license/provenance, dimensions, color space, compression settings, and manifest hash.

Initial budgets:

- settlement background: layered at design resolution, tiled/segmented for runtime;
- hero art: approved summon, dialogue, roster, and settlement-scale authored exports;
- portraits: fixed aspect ratios for roster, dialogue, summon card, and memorial;
- animation: idle, walk, work, speak, react, hurt, downed, and dead before role-specific combat;
- effects: summon gate, ember power, portal, hidden-route reveal, hit, heal, death, synthesis.

## Audio plan

P0 uses authored ambient loops and event sounds. Voice remains text-first; short generated or recorded barks are P1 and never block comprehension.

Required layers:

- settlement day/night ambience;
- tower mechanical ambience;
- Iron Moon wind and mineral resonance;
- gate, portal, UI, footsteps, work, weapons, injury, and silence after death;
- adaptive intensity for mission pressure.

All audio controls include mute, independent volume groups, and reduced-stimulation support.

## Security, privacy, and cost

- API keys stay server-side and are never serialized to the client.
- Dialogue and decision packets are treated as potentially sensitive player content.
- Logs store IDs and redacted summaries by default, not raw conversation text.
- Raw decision packets have a development retention window and explicit deletion path.
- Webhook signatures are verified if webhooks are enabled.
- Rate limits apply per account, run, IP, and decision kind.
- Model budgets exist per real day and per run day.
- Provider timeouts never hold database transactions open.
- Model failures degrade to safe policies and visible status, not broken state.
- Generated asset provenance is stored for review and future licensing decisions.

### Identity and access

Local development starts with one seeded development user and no external account dependency. A hosted playtest must add private invite access before accepting player data. The initial hosted choice can be Supabase Auth or another managed magic-link provider, isolated behind an application identity interface so game aggregates never depend on vendor-specific user objects.

Administrative and development routes require a separate role and are disabled by default. Run IDs are not authorization. Every run query is scoped through the authenticated owner or an explicit playtest share grant.

### Initial performance budgets

| Metric | Desktop target | Mid-range phone target |
| --- | ---: | ---: |
| Interactive application shell | under 2 seconds on warm connection | under 4 seconds on simulated 4G |
| Initial JavaScript, compressed | under 700 KB | under 700 KB |
| First settlement asset bundle, compressed | under 12 MB | under 8 MB |
| Active scene frame rate | 60 FPS | stable 30 FPS minimum |
| UI response before server result | under 100 ms | under 150 ms |
| Reconnect to current snapshot | under 2 seconds | under 4 seconds |
| Active renderer memory | under 500 MB | under 300 MB |

Premium scenes load as separate bundles. Reduced-motion mode removes nonessential particles and parallax. Automated performance collection runs on representative desktop and mobile emulation; real-device review remains a milestone gate.

## Observability

### Event log, player journal, and decision trace

The implementation keeps three related records with different audiences:

1. **Authoritative event log:** append-only commands and domain events with sequence, simulated time, actor, action source, seed cursor, before/after state hashes, and content version. Reward, experience, level, skill, inventory, relationship, death, synthesis, control-mode, directive, and story-patch changes are first-class events.
2. **Player journal:** a projection of those events into a readable turn timeline. It supports day, mission, floor, hero, and event-type filters; shows numerical before/after deltas; and links each entry to the exact replay cursor. Generated narration may decorate an entry but never supplies its numbers.
3. **Decision trace:** development-only prompt version, redacted packet and output, policy/model identifier, latency, token estimate, validation result, retries, fallback, directive influence, and accepted story patch. It stores inspectable intent summaries, never hidden chain-of-thought.

Every Master decision records whether it was manual, Countdown fallback, Step, Continuous, directed, or random. Every active direction records its scope and whether the result advanced, conflicted with, or could not satisfy it. This makes both progression auditing and emergent-behavior debugging possible from the same run history.

### Required dashboards or reports

- active runs and catch-up backlog;
- decision-job status, latency, retries, stale rate, and fallback rate;
- tokens and estimated cost by decision kind;
- average agent decisions per hero per game day;
- engine command failures and illegal-action attempts;
- replay hash mismatches;
- client FPS, memory, load time, and asset-bundle size;
- deaths, retreats, synthesis, hidden-route discovery, and floor-5 outcomes;
- conversation-to-behavior influence traces.

Every emergent-behavior bug report should be resolvable from run ID, event cursor, state hash, decision packet, prompt version, and model snapshot.

## Testing strategy

### Unit tests

- schemas and migrations;
- PRNG fixtures;
- needs, habits, goals, skills, injuries, death, and synthesis;
- legal-action derivation;
- resource ledger;
- authority and belief updates;
- time and route calculations;
- prompt packet selection and redaction.

### Property tests

- no legal action produces negative resources;
- no dead hero acts;
- all command sequences preserve schema validity;
- replay reaches identical state hashes;
- catch-up equals online resolution;
- stale decisions never apply;
- secret knowledge cannot appear without an observation path;
- character generation preserves independence constraints.

### Integration tests

- command transaction and optimistic concurrency;
- snapshot rebuild from events;
- worker leases and crash recovery;
- database job retries and idempotency;
- fake OpenAI structured response, timeout, refusal, malformed output, and stale completion;
- SSE reconnect and cursor gaps;
- asset manifest loading.

### Browser tests

- create and continue run;
- complete summoning with keyboard and touch;
- click buildings and select heroes;
- talk, order, and inspect results;
- close/reopen catch-up;
- launch, retreat, and complete a mission;
- responsive phone and desktop layouts;
- reduced-motion mode;
- screenshot baselines for each premium scene.

### Quality gates for every merge

```text
format
lint
typecheck
unit + property tests
integration tests affected by diff
production build
Playwright smoke test
git diff --check
```

Main remains releasable. Feature flags protect incomplete vertical paths.

## CI and delivery

Pull-request CI installs from the frozen lockfile, validates migrations, runs quality gates, and uploads Playwright artifacts on failure. Main builds immutable web and worker images tagged with commit hash.

Environments:

1. **local:** Docker Postgres, random/scripted policies, local assets;
2. **preview:** disposable database, fake or tightly budgeted model calls;
3. **playtest:** persistent database, selected model, private access;
4. **production:** deferred until the slice passes playtesting.

Database migrations use expand/contract patterns once persistent playtest data exists. Backups and restore verification are required before inviting external testers.

## Work breakdown

### Phase 0 — foundation and contracts

Estimated engineering effort: **1 week**.

**Status: complete — 2026-08-23.** Evidence and commands are recorded in [implementation progress](progress.md).

- `FND-001` scaffold pnpm workspace, Node pin, TypeScript, lint, formatting, and scripts;
- `FND-002` create web and worker processes with health endpoints;
- `FND-003` add Docker Postgres and configuration parser;
- `FND-004` define contracts package and initial run/hero/action schemas;
- `FND-005` add CI quality gates;
- `FND-006` establish structured logging and correlation IDs;
- `FND-007` decide pg-boss versus leased jobs through a crash-recovery spike;
- `FND-008` preserve the static prototype under a design-reference route or documentation link;
- `FND-009` define authoritative event, decision-source, directive, reward-delta, and journal-entry contracts.

**Exit:** one command starts database, web, and worker; CI passes; a typed health page shows version and policy mode.

### Phase 1 — summon-to-choice proof of life

Estimated engineering effort: **1–2 weeks**.

**Status: complete — 2026-08-23.** Evidence and commands are recorded in [implementation
progress](progress.md).

- `POL-001` implement deterministic manifest generator and hash;
- `POL-002` build one original premium hero identity packet;
- `POL-003` build minimal `/forge` seed grid and lock/reroll controls;
- `POL-004` implement summon scene and first-person camera beat;
- `POL-005` implement one scripted and one random first-choice policy;
- `POL-006` persist hero, first observation, and selected destination;
- `POL-007` animate the same hero walking to kitchen or training ground;
- `POL-008` add identity and deterministic replay tests.

**Feedback gate:** review the art direction, summon pacing, body variation, first line, and whether the hero already feels present.

**Exit:** same seed preserves identity and choice; different seeds feel meaningfully distinct; no model key is required.

### Phase 2 — deterministic engine

Estimated engineering effort: **2 weeks**.

**Status: complete — 2026-08-23.** All `ENG-001` through `ENG-010` tasks have unit,
integration, generated-history, and browser evidence. New runs use `engine-v2`; immutable
`engine-v1` histories retain their original replay hashes. See [implementation progress](progress.md).

- `ENG-001` implement PRNG and entropy cursor;
- `ENG-002` implement command/event/reducer contract;
- `ENG-003` implement event store, snapshots, state hashes, and replay;
- `ENG-004` implement Master and hero life states;
- `ENG-005` implement resources, inventory, equipment, and durability;
- `ENG-006` implement needs, activities, injuries, death, and game over;
- `ENG-007` implement scheduled events and fake clock;
- `ENG-008` implement property-test harness and simulation CLI;
- `ENG-009` run 10,000 random command sequences without invariant failure;
- `ENG-010` project rewards, experience, levels, skills, and inventory deltas from domain events.

**Exit:** every supported transition is deterministic, replayable, and independent of UI/database/network code.

### Phase 3 — Character Forge and visual system

Estimated engineering effort: **2–3 weeks**, partially parallel with Phase 2.

**Status: in progress — visual approval checkpoint completed 2026-08-23.** `ART-001`, the
`human-v2` physiology and `human-v3` naming portions of `ART-002`, `ART-003`, `ART-004`, `ART-006`,
and `ART-007` now have runnable evidence. Two of twelve `ART-005` humans and a deterministic
seven-case `ART-008` audit with durable, cue-level human reviews for the first approved identity
remain at the human feedback gate. Cohort expansion remains behind that gate.

- `ART-001` approve art bible, palette, line/value rules, and camera compositions;
- `ART-002` expand manifest generator and diversity test suite;
- `ART-003` implement rig schema, expression layers, equipment anchors, and palette swaps;
- `ART-004` implement Forge comparison, contact sheet, approval, and asset records;
- `ART-005` create twelve representative original humans;
- `ART-006` complete: preview and test reference-driven summon-card generation behind a development
  flag, exact hashes, one-candidate cost acknowledgement, and an ephemeral non-canonical boundary;
- `ART-007` complete: export approved sources into content-addressed, budgeted WebP variants and a
  validated PixiJS manifest while deferring every candidate source;
- `ART-008` in progress: the first approved identity has a hash-bound, human-gated audit across all
  five camera tiers, five expressions, equipment, gait, injury, and a measured phone profile;
  append-only cue reviews are now durable and exact-audit-bound, while human verdicts and later
  approved identities remain.

**Feedback gate:** approve a representative male hero, female hero, roster group, and settlement-scale appearance before expanding assets.

**Exit:** approved characters remain recognizable across Forge, roster, dialogue, settlement, equipment, and injury states.

### Phase 4 — living settlement

Estimated engineering effort: **2 weeks**.

**Status: complete — SET-001 through SET-009 completed 2026-08-24.** `hearth-01-v1`
defines five interiors, a connected 18-node/17-edge route graph, travel time, capacity, authored
visual paths, interaction/effect declarations, and explicit system access. The development-only
`/settlement-lab` inspects that hash-bound content without changing existing engine histories or
claiming authoritative arrival. `hearth-01-scene-v1` adds a topology-aligned hero-free plate, six
ordered presentation layers, five hotspots, and all 18 visual node projections. It remains an
approval candidate while topology and composition feedback are pending. `engine-v3` now binds that
topology by hash, schedules exact routes without changing location, and commits arrival only through
the injected game clock; existing v1/v2 streams retain their original schemas.

- `SET-001` complete: implement route graph and five building nodes/interiors;
- `SET-002` complete as a human-pending candidate: create the layered Hearth 01 settlement scene;
- `SET-003` complete: implement content-bound hero travel and authoritative scheduled arrival;
- `SET-004` complete: implement building capacity, assignments, and powered state;
- `SET-005` complete: implement needs, activities, daily plan, and habit resolution;
- `SET-006` complete: implement accelerated clock and worker catch-up;
- `SET-007` complete: implement SSE events, reconnect, and recap;
- `SET-008` complete: add day/night, occupancy, work, sleep, eat, train, and idle animations;
- `SET-009` complete: recover the First Ember from Floor 01, permanently bind it to kitchen,
  dormitory, or training ground, persist rationale-aware hero reactions, and apply replay-stable
  facility advantages.

**Feedback gate:** leave a run, return to its recap, and judge whether the settlement changed enough without feeling stolen from the player.

**Exit:** one game day resolves online or offline with identical results; routine life requires no model calls.

### Phase 5 — agency, conversation, and memory

Estimated engineering effort: **2 weeks**.

**Status: complete — AGT-001 through AGT-010 completed 2026-08-24.** Holder-owned cognition,
witnessed communication, hash-bound decision packets, deterministic zero-cost policy baselines,
an opt-in strict OpenAI Responses policy, and the durable stale-safe application lifecycle are
runnable. Free conversation now produces witnessed hero replies and explicit order outcomes, and a
hash-bound redacted inspector audits supplied/omitted context plus provider and validation
boundaries. A fixed credential-free corpus now grades deterministic baselines and exposes an honest
model quality/token/cost gate. Scoped witnessed directions now persist through replay, expiry,
replacement, revocation, packet selection, action influence, and journal projection.

- `AGT-001` complete: implement direct observations, provenance-linked beliefs, directed
  relationships, founding promises, and multidimensional authority under `engine-v7`;
- `AGT-002` complete: implement canonical communicative acts, private/open delivery, co-location and
  availability witness rules, and direct told-belief provenance under `engine-v8`;
- `AGT-003` complete: implement hash-bound decision packet assembly, holder-only context selection,
  deterministic scored/budgeted memory retrieval, and an inspectable first-choice preview;
- `AGT-004` complete: implement packet-bound random and personality-scripted policies for every
  decision kind, with deterministic traces and hash-bound results;
- `AGT-005` complete: implement an official-SDK OpenAI Responses policy adapter with an
  independent packet-only request, strict Structured Outputs, bounded output/reasoning, typed
  failure taxonomy, legal-boundary revalidation, provider/token/hash trace, and a manual
  development preview that never applies state;
- `AGT-006` complete: persist packet-bound decision jobs, queue leases, classified attempts and
  transitions; reject stale work before provider spend and before application; bound model retry,
  deterministic fallback, and replan chains; and atomically apply validated engine commands;
- `AGT-007` complete: implement canonical free-text say/ask/order turns, personality/needs/
  relationship/authority-aware responses, explicit accepted/negotiated/deferred/refused outcomes,
  replay-safe social evidence, and witnessed order preferences that affect only later legal-action
  scoring;
- `AGT-008` complete: persist a credential-free exact provider request profile, preserve legacy
  jobs, derive hash-bound redacted packet/result reports, expose supplied and omitted context,
  evidence selection, tokens, lifecycle and validation boundaries, and keep raw packets out of
  normal browser polling;
- `AGT-009` complete: export ten hash-bound decision-packet cases across personality, directives,
  needs, authority, witnessed memory, and secret discovery; grade scripted/random policies with
  deterministic safety and behavior checks; record versioned request hashes and a dated conservative
  `gpt-5-nano` cost projection; and keep model quality, resolved identity, tokens, and latency
  explicitly unmeasured until an opt-in, hash-bound full recorded-provider run exists;
- `AGT-010` complete: implement `engine-v10` / `society-v4` scoped player directives with exact
  witnessed delivery, decision/mission/day/until-revoked lifetimes, scheduled day expiry,
  replacement and revocation, packet-kind filtering, event-derived influence records, journal
  outcomes, directive API, and summon/replay controls while preserving v1–v9 replay.

**Feedback gate:** conduct the first real conversations and review whether explanations, refusals, and later behavior feel coherent.

**Exit:** one instruction can produce different inspectable responses across heroes, and conversation changes later legal choices or preferences.

### Phase 6 — tower and portal mission loop

Estimated engineering effort: **2–3 weeks**.

- `MIS-001` complete: add the content-addressed `mission-package-v1` contract, structurally
  validated authored arena truth, visit/discovery-bounded knowledge projection, deterministic route
  planning, Floor 01 deployment/objective/encounter/reward declarations, and a fixed five-anchor
  story spine with one catalog-bounded optional patch slot;
- `MIS-002` complete: bind `engine-v11` runs to the exact Floor 01 package hash; implement
  Master-led party preparation/revision/cancellation, deployment, objective-gated extraction,
  retreat, retry, participant reservation, immutable lifecycle events, strict replay, and the
  `/mission/:runId` threshold interface;
- `MIS-003` complete: add `engine-v12` bounded 48-round mission state; derive each actor's legal
  actions from visited/discovered arena knowledge; assemble an independent hash-bound packet for
  each hero; resolve one manual Master choice plus autonomous hero choices through seeded
  initiative; persist moves, discoveries, objective custody, policy evidence, environment pulses,
  and the complete round ledger; automatically open extraction only after the First Ember and all
  survivors return to the threshold; remove the development objective-proof control while keeping
  immutable engine-v11 mission streams replayable;
- `MIS-004` complete: add the SHA-bound `monster-policies-v1` catalog; spawn stable Floor 01
  goblins from declared entropy purposes; derive Chain Court guard and Ember Vault protection
  duties without hidden-route knowledge; expose threat intent before commitment; rank monsters and
  party members in one initiative ledger; resolve alarms, movement, attacks, defense, vitality,
  mission guard, and superseded actions; define the reusable furnace-linked Foundry Warden policy
  without placing it before Floor 05; render threats and resolved effects on the tactical board;
- `MIS-005` complete: author immutable Floor 02–05 packages and a verified first-band catalog with
  formation/protection, injury/retreat pressure, relay separation and trust, 34 total bounded
  observations, 15 legal discoveries, exact per-floor reward budgets, five-anchor story envelopes,
  retained Floor 04 Foundry-route evidence, a direct Floor 05 assault, a gated cooling route, and the
  single placement of the versioned Foundry Warden;
- `MIS-006` complete: preserve the reviewed Floor 02–05 v1 packages while binding executable v2
  revisions to complete duty-count entropy; add opt-in `engine-v14` multi-floor evidence state;
  retain the Floor 04 schematic under the discovering actor; derive the Floor 05 memory tool only
  for that holder; expose the maintenance route and cooling control through legal actions; advance
  the furnace from lit to cooling to quenched; apply the current furnace state to Warden armor and
  control interception; and recompute the entire cross-floor event stream under strict replay;
- `MIS-007` complete: author and hash-bind the Iron Moon portal package; add an opt-in `engine-v15`
  eight-round extraction clock with stable/warning/critical/collapsed pressure; finite deposits,
  bounded per-actor attempt cargo, quota progress, and an append-only ore ledger; credit settlement
  iron only in the separate extraction event; lose cargo explicitly on retreat or collapse; include
  portal pressure and resources in each hero packet; strictly replay the whole transition; and ship
  a database-backed `/iron-moon` browser checkpoint;
- `MIS-008` complete: add opt-in `engine-v16` persistent mission consequences; spill exposed guard
  impacts into health and equipped-item durability; derive nonfatal injuries and permanent hero
  death in the authoritative round; store source-, location-, and witness-complete aftermath records;
  give only surviving co-located heroes evidence-backed memories and relationship changes; include
  those memories in future engine-owned decision context; strictly replay every physical and social
  mutation; and ship the database-backed `/aftermath` Red Tithe browser checkpoint;
- `MIS-009` complete: add opt-in `engine-v17` / `mission-aftermath-v2`; apply exposed mission harm
  to canonical Master health; preserve source-, location-, and witness-complete consequences; let
  co-located heroes remember only what they see; atomically set attempt death, Master death, and
  top-level game over in one round; cancel every unfinished hero activity, travel, routine, and
  daily-plan entry; remove all actor legality while retaining strict replay; telegraph the Red Slag
  hazard before commitment; and ship the database-backed `/last-command` browser checkpoint;
- `MIS-010` complete: execute Hammer Line, Split Cooling, and Full Quench across eight fixed
  successful regression seeds each; require legal engine commands, intended furnace state,
  survival, extraction, and exact strict replay; export the hash-bound report and ship the
  development-only `/foundry-trials` comparison page;
- `MIS-010A` complete: add opt-in `engine-v18` / `mission-aftermath-v3`; give every consequence an
  explicit source attempt; atomically archive the prior terminal attempt, binding, outcome, final
  round, and consequences when a later attempt is prepared; keep the active consequence ledger
  exclusive to the new attempt; reject leaked or misattributed records; persist and strictly replay
  the Floor 04 retreat → Floor 05 preparation boundary; preserve v16/v17 payload dispatch; export a
  checked deterministic report; and ship the development-only `/attempt-aftermath` proof page;
- `MIS-011` complete: compile the five runtime mission bindings into the content-addressed
  `tower-band-01-story-v1` envelope with fixed world laws, opening state, 35 beats, a causal
  25-beat default route, immutable anchors, mission-scoped catalogs, bounded patch slots, finale
  constraints, and exact reward budget; derive deterministic eligibility from validated history;
  bind expression only to living holders of a fact; preserve that fact verbatim while personality,
  values, drives, social style, and habits select its frame; export checked two-summon evidence and
  ship the development-only `/story-envelope` inspector;
- `MIS-012` complete: add opt-in `engine-v19` Master control state with authoritative decision
  identities, configurable deadlines, injected observed time, persisted pause/expiry/source
  outcomes, strict replay, and independent Wait, Countdown, one-shot Step, and Continuous timing;
  open decision windows at deployment and after active rounds; use a clearly provisional
  hash-bound hold-first baseline until MIS-013; expose takeover/pause and the live countdown in the
  database-backed mission UI; and export a checked four-mode deterministic report;
- `MIS-013` complete: add opt-in `engine-v20` with immutable per-window fallback snapshots;
  deterministic directed scoring plus seeded tie-breaks; reproducible seeded-random selection;
  hash-bound packet, legal-action, direction, classification, score, source, and result evidence;
  explicit unsupported-intent reporting; manual pause/takeover; configurable health, ambiguity,
  irreversible-action, and fallback-streak stops that force a replayable Wait boundary; expose the
  doctrine editor and evidence in the database-backed mission UI; and export a checked report;
- `MIS-014` complete: project a versioned, hash-bound player journal from canonical events; expose
  exact action/source, reward, experience, level, party-progress, direction, story, failure, state
  hash, and replay-cursor evidence; support day, mission, floor, hero, event-type, control-source,
  and semantic-facet filters without changing engine state; ship the database-backed mission
  ledger, `/player-journal` prepared checkpoint, public run-journal endpoint, and checked strict
  replay report;
- `MIS-015` complete: add opt-in `engine-v21` canonical band-story state and a strict
  `StoryPatchCandidate`; validate exact envelope/history freshness, causal and cumulative slot
  bounds, catalog/dormancy, living cast and holder-owned knowledge, and the fixed law/objective/
  arena/reward/anchor/finale surface through 17 explicit checks; commit `story.patch.applied` with
  validation/history/patch hashes; revalidate under strict replay; journal the change; ship a real
  database-backed Floor 04 `/story-patch` checkpoint and deterministic report that blocks 11
  adversarial cases;

**Feedback gate:** play two contrasting parties through floor 5 and review tactical readability, autonomy, retreat, and emotional consequence.

**Exit:** the mission loop changes settlement state and future hero behavior; secrets and deaths are causal and replayable.

### Phase 7 — synthesis, story, and vertical-slice finish

Estimated engineering effort: **2 weeks**.

- `FIN-001` **complete** — implement synthesis flow, confirmation, witness and rumor consequences;
- `FIN-002` **complete** — bind the authored Floor 05 finale, first-band rewards, and archive
  recovery to successful extraction; preserve the sealed/recovered/revealed lifecycle, let a chosen
  surviving hero's mind shape delivery without changing the fixed truth, retain explicit knowledge
  holders, and ship strict replay evidence plus the database-backed `/first-band-archive` checkpoint;
- `FIN-003` **complete** — implement the player-facing title and four-beat onboarding; bind three
  stable adult human heroes to the campaign seed; derive seven hash-bound objectives; add an
  interface-only pause menu, device-local reading/motion/timing settings, and replay-preserving
  same-seed restart; validate the complete journey at desktop and phone widths;
- `FIN-004` **complete** — add a muted-by-default procedural soundscape with Ambient/Full mix,
  optional readable cue captions, route-specific cinematic emphasis, pre-hydration settings
  migration, system-aware reduced motion, skip/focus navigation, native preference controls,
  keyboard hero tabs, and contained/restored modal focus; validate desktop and 390×844 phone paths;
- `FIN-005` **complete** — replace player-route source PNG delivery with content-addressed,
  purpose-sized title variants and approved runtime portraits; bind byte evidence to the current
  build and manifests; and enforce the 390×844/2× simulated-4G shell, reconnect, interface-response,
  frame-rate, and working-set budgets in the real campaign browser path;
- `FIN-006` **complete** — require affirmative versioned adult playtest consent before any
  analytics request; keep decline device-local; accept only seven strict first-party journey event
  types without raw text, seeds, names, IPs, or user agents; bind grants to hashed 30-day device
  capabilities; delete retained sessions/events on withdrawal or expiry; and expose only an
  aggregate development report for moderated-test triage;
- `FIN-007` **in progress** — use the `owner-playtest-v1` conversational loop: one real owner
  playthrough on phone or desktop, eight natural journey checkpoints, automatic consented background
  statistics, Codex-maintained evidence, mandatory friction findings, and P0–P3 release triage; the
  first stopped owner run is recorded at 1/1 reviewed and 7/8 reached, with four P1 corrections now
  driving the gate-centered redesign in ADR 0055;
- `FIN-008` **in progress** — a hash-bound, fail-closed release report and acknowledged packaging
  command now refuses the incomplete owner journey and four open P1 findings; a non-promotable rehearsal proves deterministic
  assembly, frozen production install, clean migration, and web/worker health from an extracted
  archive; after the owner playthrough, fix and verify every P0/P1, assemble the commit-bound private
  archive and SHA-256 receipt, then perform the final private-operator smoke test;
- `FIN-009` **complete** — add a development-time story workshop with an exact versioned brief,
  optional structured model generation, independently validated five-floor proposals, explicit
  six-part human review, retained revision identity, prototype-production holds, checked evidence,
  and a development comparison desk; proposals and acceptance remain non-canonical until a later
  strict envelope compilation.

**Exit:** definition of done is met and the next investment decision can be based on observed play rather than speculation.

## Critical path

```text
foundation
   → deterministic manifest → proof of life → visual approval
   → engine → settlement clock → decision jobs → conversations
   → mission engine → floors 1–5 → synthesis/story polish → playtest
```

Art-system work and engine work may overlap after schemas stabilize. Mission content should not begin before engine replay and settlement aftermath exist; otherwise it will create throwaway combat code.

## Scope-control rules

- No feature enters P0 without removing or delaying comparable effort.
- A visual prototype may fake data; a gameplay milestone may not fake state transitions.
- Prefer one deep building over five shallow buildings during implementation, then expand after the pattern is stable.
- Prefer one excellent premium hero identity packet over a large inconsistent roster.
- Never solve an agent-quality issue by exposing hidden world truth.
- Never solve latency by letting the client apply speculative game consequences.
- Defer free movement, non-humans, romance, and 100-floor content until the first five floors are fun.

## Next execution slice

The Phase 3 visual approval checkpoint is available at `/visual-lab`. The next repository-changing
turn incorporates feedback where available and continues reversible production infrastructure:

1. accept or revise Mara Vey, Remy Nahl, their roster composition, and settlement scale;
2. review the first approved runtime bundle at summon, dialogue, and roster sizes;
3. review Mara's authored anchor, continuity, and settlement-scale images and explicitly record
   which identity cues survive each approved presentation;
4. only after visual acceptance, expand the representative cohort from two toward twelve humans;
5. extend authored continuity and scale review to Remy only after an explicit anchor approval;
6. rerun visual, accessibility, performance, browser, and deterministic manifest gates;
7. commit and push each reviewable checkpoint.

The unoptimized source PNGs remain deliberate approval artifacts. The runtime exporter processes
only static-catalog `approved` sources; candidates are recorded as deferred and produce no runtime
file.

In parallel with the human character-art gate, `SET-001` and the `SET-002` scene candidate are
available at `/settlement-lab`. Their next review asks whether the five-building arrangement,
painted spatial clarity, travel scale, interior focal stations, and reserve-versus-powered access
boundary form a clear foundation. After feedback, the scene can be accepted or revised while
`SET-003` added the versioned authoritative travel path without changing `engine-v1` or `engine-v2`
replay schemas. `SET-004` added reciprocal facility rosters, capacity checks, one reversible power
slot, power-gated forge access, and v3 preservation under `engine-v4`. `SET-005` persisted each
summoned mind, added mutable habits and four-part daily plans, scheduled
zero-model-cost routine outcomes, exposed close-score decision boundaries, and preserved v1–v4
replay schemas under `engine-v5`. `SET-006` persisted the configurable `4×` wall-to-game-time projection, added a
renewable crash-recoverable run lease, proved byte-equal online/offline resolution, bounded each
batch, and connected due schedules to the worker and reconnect API. `SET-007` added
transaction-bound PostgreSQL event notifications, bounded cursor pages, resumable SSE with typed
gap recovery, browser-local acknowledgement cursors, and deterministic full-range return recap
totals with cursor-linked highlights. `SET-008` now projects day phase, exact physical occupancy,
building state, travel, and work/sleep/eat/train/idle poses from the cached `engine-v5` through
`engine-v8` snapshot and persisted clock. The painted scene consumes ordered SSE cues and periodic
server projections without running a reducer in the browser. `SET-009` replaces the reversible
development power control on new runs with an `engine-v6` First Ember lifecycle. Floor 01 recovery
makes exactly three commitments legal; one player choice permanently records a rationale,
mind-and-needs-aware hero responses, and the exact kitchen, dormitory, or training modifiers used by
replay. `AGT-001` adds `society-v1` under `engine-v7`: awakening grants only direct sensory
knowledge and neutral social priors, while the existing First Ember commitment produces witnessed
observations, provenance-linked beliefs, an active founding promise, and evidence-backed directed
relationship and authority changes. Immutable v1–v6 histories receive no social backfill.
`AGT-002` adds `society-v2` under `engine-v8`: exact Master onboarding, bounded private/open
witnesses, direct communication observations, and topic-owned told beliefs. Immutable v1–v7
histories receive no communication backfill. `AGT-003` through `AGT-005` add holder-owned decision
packets, deterministic baselines, and the independent strict model adapter. `AGT-006` adds the
PostgreSQL-authoritative decision lifecycle, crash leases, bounded retry/fallback, two stale guards,
replacement packets, and atomic engine application. `AGT-007` adds `engine-v9` / `society-v3`,
canonical free-text turns, explicit hero replies and order outcomes, and weighted witnessed
preferences that cannot create or execute actions. `AGT-008` adds versioned provider request
profiles plus a redacted, hash-bound decision inspector. `AGT-009` adds a fixed packet corpus,
deterministic baseline graders, a checked-in quality/token/cost report, and an explicit
recorded-evidence gate for live models. Phase 6 is complete through `MIS-015`. `FIN-001` adds the
versioned `engine-v22` synthesis transaction: a short explicit confirmation, Master-only legality,
permanent source termination, bounded recipient experience with no identity transfer, private/open
witness rules, relationship fallout, provenance-bound hero rumor relay, canonical database
persistence, strict replay, and a playable `/synthesis` chamber. `FIN-002` adds `engine-v23` and a
one-way first-band archive lifecycle. The Floor 05 Warden must fall, the party must successfully
extract, and only that `mission.extracted` event can recover the authored relight core and sealed
fragment. A selected surviving hero then reveals the fixed message through a deterministic delivery
frame derived from personality, values, drive, social style, and habit. Explicit reader/witness
knowledge, story history, reward grant IDs, event sources, database persistence, adversarial replay
checks, and `/first-band-archive` keep the finale causal and inspectable. `FIN-003` adds the
replay-adjacent player campaign shell: three stable seed-bound strangers, sequential onboarding with
canonical conversations and first destination, seven snapshot-bound derived objectives,
interface-only pause, device-local presentation settings, and restart lineage that supersedes but
never rewrites the prior verified chronicle. `FIN-004` adds the local sensory/accessibility boundary
in ADR 0048: procedural route soundscapes, redundant captions and visual cues, pre-hydration
preference migration, system-aware motion, keyboard-first navigation, and modal focus containment.
`FIN-005` adds the split performance evidence boundary in ADR 0049: reproducible player visual and
build artifacts are exact, while a fresh throttled Chromium campaign enforces the phone shell,
reconnect, interface, frame, and working-set targets. `FIN-006` adds the revocable, data-minimized observation boundary in
ADR 0050: decline is a verified zero-request path; a 30-day capability gates seven strict event
types; withdrawal/expiry deletes the retained journey; and the development report exposes aggregate
signal only. The first FIN-007 owner playthrough is recorded and triaged; the next execution slice
implements and retests the gate-to-Hearth correction defined by ADR 0055.

## Accepted product decisions — 2026-08-23

- Initial playtesting remains local and private. The web server may expose a LAN-accessible URL from the development machine.
- User-provided manhwa references may guide original and generated development art, but reference images do not ship.
- Master decision timing supports Wait, five-second Countdown, Step, and Continuous. The unattended fallback can follow a scoped player direction and priorities or make a seeded random legal choice. Summoned heroes remain autonomous in every mode.
- The entire first vertical slice uses adult summons only.
- Synthesis is experimental and uses a short irreversible-action warning rather than an unusually severe interstitial.
- Agent calls begin with the cheapest suitable model and escalate only after evaluation demonstrates a quality need.
- Premium visual work is attempted in this order: summoning, living settlement, dialogue close-up. All three remain in vertical-slice scope.
- Floor stories use fixed, authored envelopes with agent-assisted development and engine-validated runtime patches. Agents may alter the route and character-aware expression but cannot bypass world rules, causality, content, or reward bounds.
- The player journal must expose actions, rewards, experience, levels, party progression, control source, directions, and story changes from authoritative events.

Phases 0, 1, 2, and 4 are complete; Phase 3 is at its visual approval gate. Later feedback may revise any reversible
implementation choice without discarding these product intentions.
