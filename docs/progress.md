# Implementation progress

This is the durable execution ledger for the [full implementation plan](implementation-plan.md). Design decisions remain in the plan; this file records completed engineering evidence and the next active phase.

## Phase 0 — foundation and contracts

Status: **complete** on 2026-08-23.

| Task | Result | Evidence |
| --- | --- | --- |
| `FND-001` | pnpm TypeScript workspace pinned to Node 24.14.1 and pnpm 10.33.0 | Root scripts, lockfile, strict shared TypeScript, ESLint, Prettier, Vitest |
| `FND-002` | SvelteKit web and separate Node worker health processes | `/`, `/health`, and worker `:4174/health`; `pnpm smoke:dev` verifies both |
| `FND-003` | PostgreSQL 17.6 local service and validated configuration parser | Docker Compose, native/WSL Docker launcher, `.env.example`, migration integration test |
| `FND-004` | Initial run, adult character manifest, and legal-action schemas | `@summonlab/contracts` tests |
| `FND-005` | Frozen-install CI quality gates with real PostgreSQL and Playwright | `.github/workflows/ci.yml` |
| `FND-006` | Redacting structured JSON logs and request correlation | `@summonlab/observability` plus web/worker health tests |
| `FND-007` | pg-boss selected through an expiry/redelivery crash-recovery spike | [ADR 0001](decisions/0001-postgres-job-queue.md) and PostgreSQL integration test |
| `FND-008` | Original interactive prototype preserved in the app | `/design-reference` and Playwright assertion |
| `FND-009` | Event, decision-source, directive, reward-delta, and journal contracts | `@summonlab/contracts` schemas and arithmetic tests |

### Reproduce the checkpoint

```powershell
pnpm install
pnpm check
pnpm db:start
pnpm db:migrate
$env:TEST_DATABASE_URL = 'postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'
pnpm test:integration
pnpm smoke:dev
pnpm test:e2e
pnpm db:stop
```

The rendered checkpoint is captured in [phase-0-foundation.png](evidence/phase-0-foundation.png). Docker is launched natively where available and through WSL on Windows when only the WSL daemon is present.

## Phase 1 — summon-to-choice proof of life

Status: **complete** on 2026-08-23.

| Task | Result | Evidence |
| --- | --- | --- |
| `POL-001` | Versioned generator with separate identity, body, features, styling, mind, and rarity cursors; canonical JSON and SHA-256 manifest hash | `@summonlab/characters` deterministic and 100-seed tests |
| `POL-002` | One original Mara Vey anchor plus a manifest-driven layered SVG rig with walking motion | `assets/heroes/ember-01-anchor-v1.*`, `HeroRig.svelte` |
| `POL-003` | `/forge` cohort grid, custom seed, six lock channels, reroll counters, adult physicality, personality, habit, and provenance | [Forge evidence](evidence/phase-1-forge.png) |
| `POL-004` | Full-screen first-person gate, staged seal/reveal/manifest beat, clean-slate observation, and original hero close-up | [Summon evidence](evidence/phase-1-summon.png) |
| `POL-005` | Trait-scored scripted policy, directive influence, seeded-random policy, and four orchestration modes | Unit and browser replay tests |
| `POL-006` | PostgreSQL run stores recipe, manifest, mind, hash, first observation, first line, destination, story branch, and arrival | `0002_summon_proof.sql` and database integration test |
| `POL-007` | Same manifest-driven hero walks from the summoning hall to kitchen or training ground and records arrival | [Settlement evidence](evidence/phase-1-play.png) |
| `POL-008` | Same recipe reproduces manifest bytes, hash, mind, destination, and branch; appearance/mind rerolls remain isolated | Unit, integration, and Playwright tests |

The proof also records `hero.summoned`, `hero.observed`, `hero.destination.selected`,
`story.branch.opened`, and `hero.arrived` as readable, hashed, append-only events. The fixed
`first-ember-v1` story envelope and the hero-selected route are visible together. No model key or
model call is used.

### Reproduce the checkpoint

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:5173/forge`, choose a hero and decision mode, then follow the gate through
the selected destination. `pnpm dev` now starts PostgreSQL and applies pending migrations before
starting the web and worker processes.

Validation:

```powershell
pnpm check
$env:TEST_DATABASE_URL = 'postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'
pnpm test:integration
pnpm test:e2e
```

The high-fidelity anchor and the settlement rig intentionally share manifest identity rather than
pixel fidelity. Phase 3 must close that recognition gap with approved expression, limb, equipment,
and camera assets before expanding the roster.

## Phase 2 — deterministic engine

Status: **complete** on 2026-08-23.

| Task | Result | Evidence |
| --- | --- | --- |
| `ENG-001` | Immutable seeded entropy cursor with named draws and an exact fixture (`gate.resonance[0] = 7`) | Engine unit tests |
| `ENG-002` | Pure command → event → reducer path for destination, arrival, and Master gate inspection; engine imports no DB, network, model SDK, browser, or wall clock | `@summonlab/engine` contracts and invariant tests |
| `ENG-003` | Canonical append-only commands/events plus per-event snapshots, SHA-256 before/after state hashes, exact rebuild, idempotency, and optimistic concurrency | `0003_engine_event_store.sql`, database integration test, [ADR 0003](decisions/0003-event-sourced-engine.md) |
| `ENG-004` | Master/hero identity, health, location, life state, permanent hero death, and atomic Master game over | Engine schema, unit/integration/browser terminal-state tests |
| `ENG-005` | Nonnegative resource ledger, owned inventory, main-hand equipment, and deterministic durability | Engine schema/reducer and [survival evidence](evidence/phase-2-survival-state.png) |
| `ENG-006` | Hunger, fatigue, scheduled training/eating/rest/repair, deterministic injury, death, and game over | Unit, integration, and browser tests |
| `ENG-007` | Persisted scheduled events and an explicit fake clock shared by online and offline-style resolution | `0004_engine_schedule.sql` and [ADR 0004](decisions/0004-versioned-survival-engine.md) |
| `ENG-008` | Fast-check legal-path property suite and standalone survival simulation CLI | `pnpm simulate:engine` |
| `ENG-009` | 10,000 generated survival histories / 48,341 accepted commands, including 12,500 schedules, 589 hero deaths, and 323 game-over transitions, replay with zero invariant failures | [Simulation report](evidence/phase-2-simulation.json) |
| `ENG-010` | Readable journal projects authoritative resource, XP, level, skill, needs, health, and durability deltas with source and replay cursor | Replay inspector and database integration test |

The Phase 1 readable journal remains a projection. Choice, arrival, routine work, resource costs,
progression, damage, death, and game over now commit through the canonical engine, so the polished
screen and development replay inspector describe one history. A development-only command endpoint
demonstrates named entropy and returns `409 STALE_RUN_VERSION` when two browser commands target the
same version. Production builds keep these inspector routes disabled unless
`ENABLE_DEV_ROUTES=true` is explicit. Version-one histories remain byte-stable and replayable; new
runs use `engine-v2` rather than silently changing old hashes.

### Reproduce the checkpoint

```powershell
pnpm install
pnpm db:start
pnpm db:migrate
$env:TEST_DATABASE_URL = 'postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab'
pnpm test:integration
pnpm simulate:engine
pnpm check
pnpm test:e2e
```

Run `pnpm dev`, complete a summon, then open **Replay** from the settlement. Train and advance the
clock, repair the practice blade, inspect numerical deltas, then use the terminal-state proof. The
active and terminal checkpoints are captured in
[phase-2-survival-state.png](evidence/phase-2-survival-state.png) and
[phase-2-game-over.png](evidence/phase-2-game-over.png).

## Phase 3 — Character Forge and visual system

Status: **in progress**. The first visual approval checkpoint completed on 2026-08-23.

| Task | Result | Evidence |
| --- | --- | --- |
| `ART-001` | Production art bible fixes palette, line/value/material rules, camera tiers, continuity contract, motion, and approval rubric | [Art bible](art-bible.md) |
| `ART-002` | `human-v2` preserves `human-v1` bytes while adding deterministic physiology; `human-v3` preserves both older versions while expanding names through an isolated stream; 1,000-seed diversity and 100-seed visible cohort coverage | Character generator, unit tests, and [contact sheet evidence](evidence/phase-3-contact-sheet.png) |
| `ART-003` | Separate visual profiles drive identity locks, expression states, normalized equipment/injury anchors, and base/night/injured palette swaps in the code-native runtime rig | `CharacterVisualProfileSchema`, asset catalog, and `HeroRig.svelte` |
| `ART-004` | Complete: `/visual-lab` compares assets and records append-only accept/revise notes against exact hashes; `/forge/contact-sheet` prints or downloads a deterministic 100-seed audit; CI verifies source bytes and stale-hash rejection | [Visual lab evidence](evidence/phase-3-visual-lab.png), [contact sheet evidence](evidence/phase-3-contact-sheet.png), ADR 0006 |
| `ART-005` | Two of twelve representative original humans: Mara Vey and Remy Nahl | Anchor and continuity assets under `assets/heroes/visuals` |
| `ART-006` | Complete: `/visual-lab/summon-card` previews a deterministic manifest-authored image-edit request; paid execution is development-only, one-candidate, cost-acknowledged, no-retry, hash-verified, ephemeral, and non-canonical | [Summon-card lab evidence](evidence/phase-3-summon-card-lab.png), ADR 0007, provider-mock and browser tests |
| `ART-007` | Complete: approved source assets export as purpose-sized, content-addressed WebP files plus a PixiJS v8 manifest; exact re-encoding and asset/build budgets run in `pnpm check`, while five candidates remain deferred | [Runtime bundle evidence](evidence/phase-3-runtime-bundles.png), [budget report](evidence/phase-3-runtime-budget.json), ADR 0008 |
| `ART-008` | In progress: a hash-bound seven-case audit covers every approved Mara expression, all five camera tiers, equipment, gait, injury, and a 390×844/2× phone profile; an append-only review console records every claimed cue against the exact audit while keeping recognition separate from asset approval | [Mobile recognition evidence](evidence/phase-3-recognition-mobile.png), [recognition audit](../assets/heroes/visuals/recognition-audit.json), ADRs 0009–0010 |

The image-generation skill produced the five new approval candidates through the built-in path. The
catalog stores the final normalized prompt set, input references, dimensions, bytes, content hashes,
and production notes. Generated art never updates the deterministic manifest. Source PNGs remain
unoptimized until the visual gate accepts them.

### Reproduce the checkpoint

```powershell
pnpm validate:visual-assets
pnpm validate:recognition-audit
pnpm dev
```

Open `http://localhost:5173/visual-lab`. Switch between Mara and Remy, compare their continuity
sheets, inspect the settlement-scale recognition limit, and record an accept/revise note. Open
`http://localhost:5173/forge/contact-sheet` to inspect all 100 manifests, save a PDF, or download the
hash-bearing JSON audit. Open `http://localhost:5173/visual-lab/summon-card`, switch the identity
anchor, add optional direction, and rebuild the outbound request without making a provider call.
Paid execution remains disabled until a local developer explicitly enables it and supplies a key.
Open `http://localhost:5173/visual-lab/runtime-bundles` to compare the approved Mara anchor at
summon, dialogue, and roster sizes and verify that PixiJS loads it through the checked-in alias.
Open `http://localhost:5173/visual-lab/recognition` at desktop or phone width, switch all seven
cases, mark every required cue pass or fail at its actual CSS scale, add a short observation, and
record the hash-bound case verdict. The page preserves append-only review history and reports live
frame/input observations while keeping recognition evidence separate from asset approval.

## Next active slice

Collect feedback on specificity, cross-view identity, rendering style, settlement character scale,
summon-card composition/prompt, and compressed runtime fidelity. Record all seven Mara case reviews
in the recognition console. Do not promote Remy, manufacture a machine approval, or generate the
remaining ten representative humans before the human visual gate.

## Phase 4 — living settlement

Status: **complete**. One online or offline settlement day, the living projection, and the
permanent First Ember decision were completed on 2026-08-24 while Phase 3 remains at its separate
human character-visual gate.

| Task | Result | Evidence |
| --- | --- | --- |
| `SET-001` | Complete: `hearth-01-v1` defines exactly five buildings/interiors, 18 connected nodes, 17 authored paths, travel duration, capacity, interaction/effect declarations, and explicit system access; deterministic route planning never lets the renderer commit arrival | [Mobile route-lab evidence](evidence/phase-4-settlement-route-lab-mobile.png), `pnpm validate:settlement-content`, ADR 0011 |
| `SET-002` | Complete as a human-pending candidate: `hearth-01-scene-v1` binds a hero-free 1536×1024 plate to the exact topology; a content-addressed 296.2 KB WebP sits beneath atmosphere, light, route, activity, and interface layers; five hotspots and 18 node projections remain visual-only; the combined phone route is 41.8 KB gzip | [Isolated phone scene](evidence/phase-4-settlement-layered-scene-mobile.png), [full phone lab](evidence/phase-4-settlement-layered-mobile.png), `pnpm validate:settlement-scene`, ADR 0012 |
| `SET-003` | Complete: `engine-v3` validates `hero.start.travel` against the hash-bound Hearth graph, persists the exact route and due arrival, leaves location unchanged in transit, and lets only `simulation.advance` commit arrival; death cancels travel and v1/v2 replay schemas remain intact | [Authoritative travel evidence](evidence/phase-4-authoritative-travel.png), engine/property/integration tests, replay travel lab, ADR 0013 |
| `SET-004` | Complete: `engine-v4` owns reciprocal facility assignments, station-derived capacity, one reversible development power slot, active-system projection, power-gated forge access, route reservation checks, and assignment cleanup on death while preserving v1/v2/v3 replay schemas | [Facility operations evidence](evidence/phase-4-facility-operations.png), engine/property/integration/browser tests, replay operations lab, ADR 0014 |
| `SET-005` | Complete: `engine-v5` persists the summoned mind, owns mutable habits and four-entry daily plans, records inspectable routine scores and close-decision boundaries, schedules zero-model-cost outcomes, resolves needs and habit deltas on the injected clock, and preserves v1–v4 replay schemas | [Daily routine evidence](evidence/phase-4-daily-routine.png), engine/property/integration/browser tests, replay routine lab, ADR 0015 |
| `SET-006` | Complete: each run owns a configurable `4×` anchored clock; one deterministic policy resolves online and offline routines byte-for-byte; renewable leases, expiry recovery, one-day/128-command safety bounds, due-only worker polling, reconnect catch-up, and explicit clock-sync events preserve exact replay | [Offline catch-up evidence](evidence/phase-4-offline-catch-up.png), engine equivalence/property tests, database lease integration, worker/browser tests, ADR 0016 |
| `SET-007` | Complete: transaction-bound PostgreSQL notifications wake bounded cursor reads; SSE resumes from `Last-Event-ID`, detects gaps, and never projects client state; exact full-range recap totals and deltas feed six diverse cursor-linked highlights; acknowledgement survives reload correctly | [Return recap evidence](evidence/phase-4-return-recap.png), recap unit tests, notification/database integration, SSE protocol and return browser tests, ADR 0017 |
| `SET-008` | Complete: a pure `engine-v5` presentation projection binds day phase, physical occupancy, building power/rosters, route progress, and idle/walk/work/sleep/eat/train/downed/dead poses to a cursor and state hash; the painted play scene refreshes from ordered SSE and visible-page clock reads, with reduced-motion semantics intact | [Living settlement evidence](evidence/phase-4-living-settlement.png), projection unit tests, SSE-to-scene browser test, full proof journey, ADR 0018 |
| `SET-009` | Complete: `engine-v6` recovers the Floor 01 core, exposes exactly kitchen/dormitory/training, commits once with the Master’s rationale, records deterministic mind-and-needs-aware hero responses, and persists replay-stable meal/rest/training advantages; v1–v5 histories remain byte-compatible | [First Ember council evidence](evidence/phase-4-first-ember.png), player/replay browser journey, three-facility outcome tests, database replay integration, ADR 0019 |

### Reproduce the checkpoint

```powershell
pnpm validate:settlement-content
pnpm validate:settlement-scene
pnpm dev
```

Open `http://localhost:5173/settlement-lab`. Select every building in the painted scene, choose
interior stations, compare Reserve with All systems, and confirm that the forge is visibly present
but unreachable while its system is dormant. This route is a development inspector; it does not
mutate a run. Complete a summon, open its **Replay** view, choose another Hearth destination under
**Verified Hearth routes**, confirm that the displayed authoritative node remains at the origin,
then choose **Advance to outcome** and verify the arrival event and resolved schedule. On the play
screen, choose **Return from Floor 01**, compare all three First Ember promises, select a facility,
choose the Master’s explanation, and verify the permanent effect and hero response. In the replay
view, confirm that recovery and commitment are in the verified hash chain and that no second
commitment is legal. Assign the hero to a facility, then choose **Plan day**, inspect the
habit/duty/meal/sleep intentions, choose **Follow next intention**, compare the candidate scores, and
advance the routine schedule to its verified outcome.

Use **Simulate 6h away** in the replay clock panel to resolve one complete game day, verify that Day
2 begins with one pending routine, and inspect the intervening plan, routine, need, and clock-sync
events in the same hash chain. Choose **Return to settlement**, inspect the cursor-bounded recap and
net changes, reload before acknowledging it to verify that it remains unread, then choose
**Continue to settlement** and confirm the live cursor indicator reconnects.

Return while a training activity or routine is active and confirm that the painted Hearth scene
shows the authoritative building occupancy, activity pose, game time/day phase, cursor, and state
hash. Leave the page open while visible to watch the server-owned clock update; use reduced motion
to confirm animation freezes without losing the activity label.

## Phase 5 — agency, conversation, and memory

Status: **complete**. `AGT-001` through `AGT-010` were completed on 2026-08-24. Canonical
witnessed onboarding now feeds deterministic, inspectable hero context, two packet-bound zero-cost
policies, one opt-in strict OpenAI policy preview, and a PostgreSQL-authoritative stale-safe job
lifecycle that can atomically apply a legal choice. Free conversation now records exact witnessed
turns, distinct hero replies, explicit order outcomes, and later decision preferences. The
development-only redacted inspector now audits exactly supplied and omitted context, provider-safe
request settings, token metadata, validation boundaries, and application evidence. Ten fixed
packet trials now separate structural safety from useful behavior and block live-model promotion
until recorded quality, token, and latency evidence exists. General directions are now witnessed,
scoped, replayed, expired or revoked explicitly, and tied to inspectable action influence.

| Task | Result | Evidence |
| --- | --- | --- |
| `AGT-001` | Complete: `engine-v7` adds direct observations, holder-specific beliefs with event provenance, directed relationship dimensions, active promises, and seven evidence-backed authority dimensions; awakening remains a clean slate, First Ember creates the first durable social consequence, normal play uses relationship language, replay exposes raw evidence, and v1–v6 histories remain unmodified | [Social cognition evidence](evidence/phase-5-social-cognition.png), engine/property/integration/browser tests, replay cognition ledger, ADR 0020 |
| `AGT-002` | Complete: `engine-v8` / `society-v2` records exact Master-to-hero explanations, statements, and questions; computes private/open witnesses from co-location and availability; creates observations for actual witnesses; transfers only topic-bound told beliefs; exposes normal-play onboarding and replay witness chains; and preserves v1–v7 histories | [Communication evidence](evidence/phase-5-communication.png), engine/integration/browser tests, summon onboarding, replay witness ledger, ADR 0021 |
| `AGT-003` | Complete: `hero-decision-packet-v1` hash-binds the exact engine-v8 cursor, state, identity, context policy, and sorted legal actions; projects only visible environment and holder-owned cognition; retrieves direct memories with deterministic relevance scores, stable ties, item/character budgets, and witnessed exact speech; rejects stale/mismatched inputs; and exposes the live boundary before the first choice | [Decision context evidence](evidence/phase-5-decision-context.png), contract/engine/browser tests, current-context API, summon packet preview, ADR 0022 |
| `AGT-004` | Complete: `@summonlab/policies` implements one explicit-seed random policy and one personality/value/drive/habit/needs-aware scripted policy across all four decision kinds; both accept only canonical packet actions/targets/memories, return packet/legal/state-bound `hero-policy-result-v1` records with deterministic traces and result hashes, and remain zero-cost baselines rather than direct state mutators | [Policy baseline evidence](evidence/phase-5-policy-baselines.png), policy/contract/browser tests, current-preview API, summon side-by-side baseline cards, ADR 0023 |
| `AGT-005` | Complete: `OpenAIModelPolicy` submits one official-SDK foreground Responses request containing only the verified canonical packet; disables provider storage and conversation chaining; uses low verbosity, bounded minimal reasoning, and strict `summonlab_hero_decision` Structured Outputs; revalidates schema plus legal actions/targets/memories; returns provider/model/token/request/output/result trace; classifies timeout, provider error, refusal, incomplete, malformed, invalid, and illegal outputs; and remains a manual development-only preview with mode/key/cost/stale-packet gates | [Model adapter evidence](evidence/phase-5-model-adapter.png), fake-transport policy tests, no-key browser journey, model-preview API, ADR 0024 |
| `AGT-006` | Complete: `decision-job-v1` persists the exact packet and run/legal hashes, attempts, leases, transitions, failures, replacement links, result, and application receipt; pg-boss carries only the job ID; pre-policy and transaction-locked pre-application guards reject stale work; model calls receive one bounded retry then deterministic scripted fallback; expired leases and completed-but-unapplied results recover without repeating provider work; fresh replans are linked and capped; and a validated policy result becomes one idempotent engine command with strict replay | [Decision job evidence](evidence/phase-5-decision-jobs.png), contract/engine/database/queue/worker/browser tests, decision-job APIs, summon lifecycle inspector, ADR 0025 |
| `AGT-007` | Complete: `engine-v9` / `society-v3` records exact witnessed say/ask/order turns; derives social-style replies and accepted/negotiated/deferred/refused outcomes from six inspectable score groups; leaves action execution entirely inside the normal engine boundary; projects accepted/negotiated orders into later packet preferences of 24/12; exposes reply, score, influence, and replay evidence in normal play; and preserves v1–v8 histories | [Conversation and order evidence](evidence/phase-5-conversation-orders.png), contract/engine/policy/database/browser tests, conversation API and summon/replay inspectors, ADR 0026 |
| `AGT-008` | Complete: `decision-job-v2` persists an exact credential-free, packet-bound provider request profile for model jobs while retaining v1 compatibility; `decision-inspector-v1` derives a hash-bound report with sensitive prose replaced by typed digests; supplied/omitted context, evidence scores, legal choices, provider settings and usage, retries/fallback, validation boundaries, and engine receipts remain auditable; normal polling receives a packet-free client projection | [Redacted decision inspector evidence](evidence/phase-5-decision-inspector.png), contract/redaction/provider/database/worker/browser tests, dev API and inspector page, ADR 0027 |
| `AGT-009` | Complete: `agent-evaluation-corpus-v1` exports ten credential-free, hash-bound packets across six agency dimensions; scripted and seeded-random policies receive deterministic integrity, legality, target, memory, expected-fit, knowledge-boundary, contrast, and repetition grades; a dated `gpt-5-nano` request/cost projection remains explicitly unapproved with zero fabricated latency or provider results | [Agency evaluation bench](evidence/phase-5-agent-evaluation.png), [machine-readable report](evidence/phase-5-agent-evaluation.json), `pnpm validate:agent-evaluation`, package/browser tests, ADR 0028 |
| `AGT-010` | Complete: `engine-v10` / `society-v4` persists exact witnessed direction delivery; supports decision, mission, day, and until-revoked scopes; schedules day expiry; preserves replacement/revocation chains; selects only applicable packet records; and records advanced/conflicted/unavailable action influence without expanding engine legality | [Scoped direction evidence](evidence/phase-5-scoped-directives.png), engine/context/database/browser tests, directive API, summon control, replay and journal ledgers, ADR 0029 |

### Reproduce the checkpoint

```powershell
pnpm dev
```

Complete a summon in **Wait for step** mode and break the seal. Before allowing the first choice,
select an onboarding topic, edit the exact words, choose private/open delivery, and press **Speak**.
Confirm the witness proof reports one intended witness and one learned claim; asking about hero
memory should instead report no learned claim. Open **What reaches this hero** and confirm there are
exactly two legal route choices, the latest exact words have event → observation provenance, and the
packet/state hashes are visible. Compare **Personality script** with **Seeded random**: both must
choose one of those exact actions, show `0 model calls`, and carry a different result hash bound to
the same packet. In **Hero agency**, choose **Order → Train**, edit the free text, and send it. Check
the exact hero reply, accepted/negotiated/deferred/refused badge, six score contributions, and
preference weight. Open **What reaches this hero** again: an accepted or negotiated order must show
its witnessed text and `conversation-weight-24` or `conversation-weight-12`; a refused/deferred
order must remain a memory without a preference. The **Live model bench** must report **adapter ready** and **No provider request is
sent in scripted mode**. Press **Queue scripted + apply** and confirm the observed lifecycle ends
at **applied**, shows exactly one attempt, and displays the selected action plus cursor/version.
As soon as a job exists, press **Open redacted decision trace**. Confirm the privacy boundary shows
zero credentials, raw private text, and private reasoning; the supplied-context counts and evidence
scores are present; scripted mode says no external model was requested; validation shows the exact
boundaries reached; and opening the redacted JSON never reveals the conversation or order text.
The answer panel and authoritative journal must reflect the same choice, and replay must remain
verified. Speak again on a fresh run and confirm the packet and both preview results refresh. To perform one
optional paid preview, stop the app, set `POLICY_MODE=model` and `OPENAI_API_KEY` in local `.env`,
restart, reopen the same inspector, and press **Ask gpt-5-nano once**. Confirm the result displays a
legal action, public intent, tokens, provider response ID, and result hash but does not move the
hero. **Queue model + apply** is a separate acknowledged durable job: it may retry once, then uses
the scripted result if the provider remains unavailable. Continue to Hearth 01,
recover the Floor 01 core, and
bind the First Ember. The hero should now have the two awakening beliefs, the onboarding claim, and
the two First Ember beliefs. Open **Replay**, inspect **Communicative acts · witness chains**, and
trace exact text through the source event, observation, and optional belief while replay remains
verified.

For the agency gate, run `pnpm validate:agent-evaluation`, start `pnpm dev`, and open
`http://localhost:5173/debug/evaluations`. Compare the 100% scripted fit with the structurally safe
random negative control, inspect all ten fixed choices, and confirm the live candidate still says
**Evidence required**, `0/10 recorded`, and `unmeasured · 0 samples`. A deliberate paid recording
can later use `pnpm record:agent-evaluation` after setting `OPENAI_API_KEY`; it writes ignored local
artifacts and cannot promote a partial corpus run.

## Phase 6 — tower and portal mission loop

Status: **in progress**. `MIS-001` through `MIS-003` were completed on 2026-08-24. Floor 01 now has
a versioned content package, authoritative run lifecycle, and bounded autonomous turns. Authored
truth remains distinct from visited/discovered knowledge; the browser can reserve a real party,
cross the threshold, retreat, retry, choose only the Master's action, watch each hero choose from
an independent packet, recover and physically return the First Ember, and extract without becoming
a state authority.

| Task | Result | Evidence |
| --- | --- | --- |
| `MIS-001` | Complete: `mission-package-v1` validates deployment/extraction roles, exactly one primary objective, the complete connected arena graph, observations, legal discovery affordances, deterministic entropy names, monster/environment declarations, retreat, reward budget, and bounded story patches; `tower-floor-01-v1` projects five initially known nodes from seven authored nodes, keeps on-entry evidence visit-bound, reveals a three-action low-exposure Ash Duct alternative only through the Oath Hall affordance, and preserves a four-action default objective route | [Mission package evidence](evidence/phase-6-mission-package.png), contract/content/browser tests, `pnpm validate:mission-content`, 41.0 KB measured mission-lab JavaScript, ADR 0030 |
| `MIS-002` | Complete: `engine-v11` binds every new run to the exact `tower-floor-01-v1` SHA-256, owns Master-first 1–5 member parties, rejects unavailable/busy heroes, reserves participants during preparation and deployment, supports party revision/cancellation, commits deployment positions plus visit-bounded knowledge, allows retreat only at an authored boundary, opens extraction only after a system-proven primary objective, prevents success farming, and creates new IDs for legal retries while leaving v1–v10 replay byte-compatible | [Mission lifecycle evidence](evidence/phase-6-mission-lifecycle.png), engine/property/database/browser tests, 43.0 KB measured mission-route JavaScript, ADR 0031 |
| `MIS-003` | Complete: `engine-v12` owns a maximum 48-round ledger, per-actor projected legal moves, exact one-choice-per-party validation, seeded initiative, moves and legal discoveries, explicit First Ember custody/delivery, third-round environment pulses, automatic objective-gated extraction, policy evidence hashes, and strict round recomputation while preserving immutable v11 proof-driven streams; `/mission/:runId` now exposes a knowledge-bounded tactical board where the player chooses the Master and the personality-scripted hero acts independently | [Mission turn evidence](evidence/phase-6-mission-turns.png), engine/policy/database/browser tests, 44.5 KB measured mission-route JavaScript, ADR 0032 |

### Reproduce the checkpoint

```powershell
pnpm dev
```

Open `http://localhost:5173/mission-lab` at desktop or phone width. Confirm **Hero knowledge** shows
five nodes while **Author truth** shows all seven without converting concealed truth into witnessed
evidence. Select **Oath Hall**, inspect its on-entry soot trace, then choose **Inspect the warm soot
seam**. The Ash Duct and two edges should enter knowledge, and the Ember Vault route should change
from four actions with exposed maximum exposure to three actions with low maximum exposure. Select
**Shattered Gallery** and test the bell chain to reveal the second optional route. Inspect the story
line: its five numbered anchors are fixed, while the agent patch slot can choose only one of two
cataloged optional beats. The page is a content/knowledge inspector and must not create a run.

Create a fresh `Wait` run in `http://localhost:5173/forge`, open its summoning chamber, and choose
**Floor 01** in the top navigation. On `/mission/<runId>`, keep or remove the hero roster card,
lock the threshold roster, deploy, and retreat. Retry to confirm the attempt number advances. Deploy
again and choose the Master's route one round at a time. Watch the summoned hero choose separately,
compare both initiative scores, recover the First Ember, return every member to the threshold, and
extract. Reload and open the replay inspector to confirm all nine round events and their exact
hashes survive.

## Next active engineering slice

Begin `MIS-004`: execute the package's deterministic goblin duty policies and Foundry Warden inside
the same initiative ledger, then expose threat intent and resolved effects on the tactical board.
Phase 3 cohort expansion remains behind its separate human visual gate. Master control is Step-only
in the current mission page; Countdown, Continuous, directed fallback, and seeded-random modes remain
`MIS-012` and `MIS-013`.
