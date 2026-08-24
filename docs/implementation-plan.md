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
OPENAI_STORY_MODEL         unset until a stronger model passes story evaluation
OPENAI_BACKGROUND_MODE     default false for short routine turns
POLICY_MODE                random | scripted | llm
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
  → outfit fit and rig recipe
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
| `/visual-lab/recognition` | human-gated identity stress matrix and measured 390×844/2× delivery profile |
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
   → layered source → rig/export → asset manifest
   → automated checks → in-game review → approved bundle
```

Source files remain separate from optimized runtime assets. Every runtime asset has source reference, license/provenance, dimensions, color space, compression settings, and manifest hash.

Initial budgets:

- settlement background: layered at design resolution, tiled/segmented for runtime;
- hero rig: head, hair groups, torso, upper/lower limbs, hands, expression overlays, equipment anchors;
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
- `POL-002` build one original modular hero rig;
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

**Status: in progress — SET-001 through SET-008 completed 2026-08-24.** `hearth-01-v1`
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
- `SET-009` implement one-core facility choice and consequences.

**Feedback gate:** leave a run, return to its recap, and judge whether the settlement changed enough without feeling stolen from the player.

**Exit:** one game day resolves online or offline with identical results; routine life requires no model calls.

### Phase 5 — agency, conversation, and memory

Estimated engineering effort: **2 weeks**.

- `AGT-001` implement beliefs, provenance, observations, relationships, promises, and authority;
- `AGT-002` implement communicative acts and witness rules;
- `AGT-003` implement decision packet assembly and deterministic memory retrieval;
- `AGT-004` implement random and scripted policies for every decision kind;
- `AGT-005` implement OpenAI policy adapter with strict Structured Outputs;
- `AGT-006` implement job lifecycle, retry, stale rejection, replan, and fallback;
- `AGT-007` implement free-text conversation UI and order outcomes;
- `AGT-008` implement redacted packet and result inspector;
- `AGT-009` create fixed evaluation corpus and budget report;
- `AGT-010` implement scoped player directives, witnessed delivery, and influence records.

**Feedback gate:** conduct the first real conversations and review whether explanations, refusals, and later behavior feel coherent.

**Exit:** one instruction can produce different inspectable responses across heroes, and conversation changes later legal choices or preferences.

### Phase 6 — tower and portal mission loop

Estimated engineering effort: **2–3 weeks**.

- `MIS-001` implement mission package schema and arena graph;
- `MIS-002` implement party preparation, deployment, extraction, and retreat;
- `MIS-003` implement autonomous initiative and turn resolution;
- `MIS-004` implement goblin duty policies and Foundry Warden;
- `MIS-005` author floors 1–5 and their observations/rewards;
- `MIS-006` implement engine-owned maintenance-route secret;
- `MIS-007` implement Iron Moon timer, extraction, and ore ledger;
- `MIS-008` implement injury, death, equipment, memory, and relationship aftermath;
- `MIS-009` implement Master actions and atomic game over;
- `MIS-010` validate three floor-5 strategies and deterministic replay;
- `MIS-011` implement band story envelopes, beat eligibility, and character-aware expression hooks;
- `MIS-012` implement Wait, Countdown, Step, and Continuous Master decision timing;
- `MIS-013` implement directed and seeded-random fallbacks with pause and safety stops;
- `MIS-014` add the player journal with reward, experience, level, and party-progress deltas;
- `MIS-015` validate one runtime `StoryPatch` against the floors 1–5 envelope.

**Feedback gate:** play two contrasting parties through floor 5 and review tactical readability, autonomy, retreat, and emotional consequence.

**Exit:** the mission loop changes settlement state and future hero behavior; secrets and deaths are causal and replayable.

### Phase 7 — synthesis, story, and vertical-slice finish

Estimated engineering effort: **2 weeks**.

- `FIN-001` implement synthesis flow, confirmation, witness and rumor consequences;
- `FIN-002` implement The First Ember story beats and archive reveal;
- `FIN-003` implement onboarding, objectives, pause, settings, and restart;
- `FIN-004` add soundscape, premium effects, reduced-motion and accessibility pass;
- `FIN-005` tune performance and asset budgets for target phones;
- `FIN-006` add analytics and playtest consent;
- `FIN-007` run five moderated tests and triage findings;
- `FIN-008` fix all release-blocking defects and package the playtest build;
- `FIN-009` add a development-time story workshop that generates reviewable, versioned arc proposals.

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
- Prefer one excellent hero rig over a large inconsistent roster.
- Never solve an agent-quality issue by exposing hidden world truth.
- Never solve latency by letting the client apply speculative game consequences.
- Defer free movement, non-humans, romance, and 100-floor content until the first five floors are fun.

## Next execution slice

The Phase 3 visual approval checkpoint is available at `/visual-lab`. The next repository-changing
turn incorporates feedback where available and continues reversible production infrastructure:

1. accept or revise Mara Vey, Remy Nahl, their roster composition, and settlement scale;
2. review the first approved runtime bundle at summon, dialogue, and roster sizes;
3. run the seven-case recognition audit, explicitly record every claimed cue, and decide whether
   Mara survives expression, state, and actual CSS-scale changes;
4. only after visual acceptance, expand the representative cohort from two toward twelve humans;
5. extend the audit to Remy only after an explicit anchor approval;
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
building state, travel, and work/sleep/eat/train/idle poses from the cached `engine-v5` snapshot and
persisted clock. The painted scene consumes ordered SSE cues and periodic server projections without
running a reducer in the browser. The next engineering slice is `SET-009`: one core facility choice
and its consequences.

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

Phases 0, 1, and 2 are complete; Phase 3 is at its visual approval gate. Later feedback may revise any reversible
implementation choice without discarding these product intentions.
