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
| `POL-002` | Historical prototype: one original Mara Vey anchor plus a manifest-driven layered SVG renderer; the renderer was retired by ADR 0065 | `assets/heroes/ember-01-anchor-v1.*`, ADR 0065 |
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
| `ART-003` | Visual profiles retain identity locks and authored-state metadata; procedural character presentation was retired by ADR 0065 | `CharacterVisualProfileSchema`, asset catalog, and ADR 0065 |
| `ART-004` | Historical: the superseded visual-review and contact-sheet labs were retired after the approved 200-hero roster replaced their experiment outputs | ADR 0006 and Git history |
| `ART-005` | Two of twelve representative original humans: Mara Vey and Remy Nahl | Anchor and continuity assets under `assets/heroes/visuals` |
| `ART-006` | Historical: the experimental summon-card generator was retired with the Forge packs | ADR 0007 and Git history |
| `ART-007` | Superseded hero runtime bundles were retired; the canonical 200-hero runtime export remains checked | [Budget report](evidence/phase-3-runtime-budget.json), ADR 0008 |
| `ART-008` | Historical recognition-audit evidence remains described by its decisions; the generated audit artifact was retired | ADRs 0009–0010 and 0065 |

The image-generation skill produced the five new approval candidates through the built-in path. The
catalog stores the final normalized prompt set, input references, dimensions, bytes, content hashes,
and production notes. Generated art never updates the deterministic manifest. Source PNGs remain
unoptimized until the visual gate accepts them.

### Reproduce the checkpoint

```powershell
pnpm validate:repository-assets
pnpm validate:summonable-hero-runtime
```

The retired Forge and Visual Lab surfaces remain recoverable from Git history. Current hero review
uses the approved roster and wiki.

## Next active slice

Collect feedback on specificity, cross-view identity, rendering style, settlement character scale,
summon-card composition/prompt, and compressed runtime fidelity using authored images in the visual
lab. Do not promote Remy, manufacture a machine approval, or generate the remaining ten
representative humans before the human visual gate.

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
| `SET-007` | Complete: transaction-bound PostgreSQL notifications wake bounded cursor reads; SSE resumes from `Last-Event-ID`, detects gaps, and never projects client state; exact full-range recap totals and deltas feed six diverse cursor-linked highlights; acknowledgment survives reload correctly | [Return recap evidence](evidence/phase-4-return-recap.png), recap unit tests, notification/database integration, SSE protocol and return browser tests, ADR 0017 |
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

Status: **complete** on 2026-08-25. `MIS-001` through `MIS-015` are complete. The first five
floors now have versioned content packages; Floor 01 has an authoritative run lifecycle, bounded
autonomous turns, and deterministic monster duties. Authored truth remains distinct from
visited/discovered knowledge; the browser can reserve a real party,
cross the threshold, retreat, retry, choose only the Master's action, watch each hero choose from
an independent packet, recover and physically return the First Ember, and extract without becoming
a state authority.

| Task | Result | Evidence |
| --- | --- | --- |
| `MIS-001` | Complete: `mission-package-v1` validates deployment/extraction roles, exactly one primary objective, the complete connected arena graph, observations, legal discovery affordances, deterministic entropy names, monster/environment declarations, retreat, reward budget, and bounded story patches; `tower-floor-01-v1` projects five initially known nodes from seven authored nodes, keeps on-entry evidence visit-bound, reveals a three-action low-exposure Ash Duct alternative only through the Oath Hall affordance, and preserves a four-action default objective route | [Mission package evidence](evidence/phase-6-mission-package.png), contract/content/browser tests, `pnpm validate:mission-content`, 41.0 KB measured mission-lab JavaScript, ADR 0030 |
| `MIS-002` | Complete: `engine-v11` binds every new run to the exact `tower-floor-01-v1` SHA-256, owns Master-first 1–5 member parties, rejects unavailable/busy heroes, reserves participants during preparation and deployment, supports party revision/cancellation, commits deployment positions plus visit-bounded knowledge, allows retreat only at an authored boundary, opens extraction only after a system-proven primary objective, prevents success farming, and creates new IDs for legal retries while leaving v1–v10 replay byte-compatible | [Mission lifecycle evidence](evidence/phase-6-mission-lifecycle.png), engine/property/database/browser tests, 43.0 KB measured mission-route JavaScript, ADR 0031 |
| `MIS-003` | Complete: `engine-v12` owns a maximum 48-round ledger, per-actor projected legal moves, exact one-choice-per-party validation, seeded initiative, moves and legal discoveries, explicit First Ember custody/delivery, third-round environment pulses, automatic objective-gated extraction, policy evidence hashes, and strict round recomputation while preserving immutable v11 proof-driven streams; `/mission/:runId` now exposes a knowledge-bounded tactical board where the player chooses the Master and the personality-scripted hero acts independently | [Mission turn evidence](evidence/phase-6-mission-turns.png), engine/policy/database/browser tests, 44.5 KB measured mission-route JavaScript, ADR 0032 |
| `MIS-004` | Complete: `engine-v13` binds `monster-policies-v1`, spawns stable Floor 01 goblins from declared count entropy, derives visible Chain Court and Ember Vault duty intents, resolves party and monsters in one initiative order, and persists alarm, movement, vitality, mission guard, defense, environment damage, and superseded actions under strict replay; the Foundry Warden's furnace armor and cooling-control policy are versioned without placing it before Floor 05; the mission board exposes active monsters, threat telegraphs, guard, and the merged resolution ledger | [Monster duty evidence](evidence/phase-6-monster-duties.png), contract/content/engine/database/browser tests, 44.0 KB measured mission-route JavaScript, ADR 0033 |
| `MIS-005` | Complete: immutable `tower-floor-02-v1` through `tower-floor-05-v1` packages establish formation/protection, hazardous retreat pressure, one-person relay separation, retained Foundry-route knowledge, and the Living Foundry payoff; the verified first-band catalog contains 34 bounded observations, 15 legal discoveries, five fixed five-anchor envelopes, exact reward budgets totaling 1,010 points, and one Floor 05 Warden placement; the lab switches across all floors and demonstrates that Floor 05's maintenance action is absent without Floor 04 route memory while preserving a direct assault | [First-band evidence](evidence/phase-6-first-band.png), content/browser tests, `pnpm validate:mission-content`, 41.0 KB measured mission-lab JavaScript, ADR 0034 |
| `MIS-006` | Complete: immutable runtime v2 bindings repair complete deterministic duty-count entropy without changing reviewed v1 packages; opt-in `engine-v14` retains the Floor 04 schematic under the discovering actor and its exact source, derives the Floor 05 memory capability only for that holder, owns maintenance-route exposure and `lit → cooling → quenched` furnace state, applies Warden armor and control interception in initiative order, and strictly replays the complete cross-floor event stream while normal Floor 01 runs remain byte-compatible on v13 | Engine/content/contract tests, focused cross-floor replay proof, ADR 0035 |
| `MIS-007` | Complete: immutable `iron-moon-v1` binds an eight-round portal and three finite deposits; opt-in `engine-v15` decrements one deterministic timer unit per party round, exposes stable/warning/critical/collapsed pressure, transfers mined ore into bounded per-actor cargo, opens extraction only after the four-ore quota and complete return, credits settlement stock only on crossing, records collapse/retreat losses, gives every hero the authoritative portal context, and strictly replays persisted event-store runs; `/iron-moon` launches the complete local browser checkpoint | [Iron Moon evidence](evidence/phase-6-iron-moon.png), contract/content/context/engine/database/browser tests, `pnpm validate:mission-content`, ADR 0036 |
| `MIS-008` | Complete: opt-in `engine-v16` turns guard-breaking and exposed impacts into persistent health loss, injuries, equipped-item wear, and permanent hero death; records exact source, location, physical deltas, and surviving co-located witnesses; derives evidence-backed mission memories and Master-relationship changes only for those witnesses; includes the memories in later holder-owned context; ends fatal attempts explicitly; and strictly replays the physical and social aftermath; `/aftermath` launches The Red Tithe database checkpoint | [Mission aftermath evidence](evidence/phase-6-mission-aftermath.png), contract/context/engine/database/browser tests, 47.0 KB measured mission-route JavaScript, ADR 0037 |
| `MIS-009` | Complete: opt-in `engine-v17` makes the manually controlled Master physically vulnerable inside mission rounds; records exposed harm in `mission-aftermath-v2` with exact source, location, health, injury, and co-located witness evidence; atomically commits Master death, attempt death, and whole-run game over; cancels unfinished hero activity, travel, routines, and daily plans; removes every actor's legal actions while retaining strict replay; and telegraphs Red Slag before commitment; `/last-command` launches the database-backed terminal checkpoint | [Master game-over evidence](evidence/phase-6-master-game-over.png), contract/context/engine/database/browser tests, 47.7 KB measured mission-route JavaScript, ADR 0038 |
| `MIS-010` | Complete: the credential-free Foundry matrix prepares four rank-10 heroes, executes Hammer Line, Split Cooling, and Full Quench only through legal engine commands, and proves eight successful fixed regression seeds per doctrine; all 24 companies survive and extract, all 24 event streams strictly replay, and the intended lit/cooling/quenched Warden state is explicit; `/foundry-trials` compares route topology, combat cost, health floor, and representative checkpoints while stating that the matrix is not a win-rate estimate | [Foundry strategy evidence](evidence/phase-6-foundry-strategies.png), [machine-readable report](evidence/phase-6-foundry-strategies.json), evaluation/browser tests, ADR 0039 |
| `MIS-010A` | Complete: opt-in `engine-v18` / `mission-aftermath-v3` binds every consequence to one source attempt; keeps the active ledger exclusive to the current attempt; archives the prior terminal attempt with its mission binding, outcome, final round, timestamps, and consequences; rejects cross-attempt leakage and false provenance; permits a later mission after a v18 success or retreat; strictly replays the real Floor 04 wound → retreat → Floor 05 preparation boundary while preserving v16/v17 dispatch; `/attempt-aftermath` visualizes the checked proof | [Visual attempt proof](evidence/phase-6-attempt-aftermath.png), [machine-readable report](evidence/phase-6-attempt-aftermath.json), engine/evaluation/database/browser tests, `pnpm validate:attempt-aftermath`, ADR 0040 |
| `MIS-011` | Complete: `tower-band-01-story-v1` binds the five runtime floor packages into one content-addressed envelope with five immutable laws, opening state, 35 beats, a causal 25-beat default route, 25 anchors, ten optional proposals, five bounded patch slots, five expression hooks, three finale constraints, mission-scoped catalogs, and an exact 1,010-point budget; deterministic eligibility rejects impossible history and over-selection; only living holders may voice an anchor, and personality changes frame, prefix, and habit gesture without changing its fact; `/story-envelope` compares two reproducible summons | [Visual story proof](evidence/phase-6-story-envelope.png), [machine-readable report](evidence/phase-6-story-envelope.json), contract/content/evaluation/browser tests, `pnpm validate:story-envelope`, ADR 0041 |
| `MIS-012` | Complete: opt-in `engine-v19` stores Master timing separately from fallback selection; every mission decision has a stable ID, ordinal, opening, optional authoritative deadline, source, resolved action, and expiry outcome; Wait accepts manual input indefinitely, Countdown accepts takeover only before its persisted deadline, Step resolves one fallback then returns to Wait, and Continuous opens another fallback window until paused or terminal; mode changes visibly pause an active decision, injected wall time preserves engine purity, strict replay recomputes all timing state, and the mission UI exposes countdown, pause/takeover, source, expiry, and logs; the provisional hash-bound baseline prefers hold until MIS-013 | [Machine-readable four-mode report](evidence/phase-6-master-timing.json), engine/evaluation/database/browser tests, `pnpm validate:master-timing`, ADR 0042 |
| `MIS-013` | Complete: opt-in `engine-v20` captures an immutable policy/direction/safety snapshot into each Master decision; directed scoring and seeded-random selection choose only from engine-owned legal actions and persist packet, legal, tie-break, source, classification, score, explanation, and result hashes; unsupported intent stays explicit; health-with-retreat, unclassified intent, irreversible tags, and a fallback streak can force a replayable Wait boundary; policy changes pause/reopen active windows; `/master-fallback` exposes doctrine editing, takeover, safety state, and evidence without changing independent hero policy | [Visual fallback proof](evidence/phase-6-master-fallback.png), [machine-readable report](evidence/phase-6-master-fallback.json), engine/evaluation/browser tests, `pnpm validate:master-fallback`, ADR 0043 |
| `MIS-014` | Complete: `player-journal-v1` projects every v1–v20 history without mutating engine state; binds readable entries to exact cursors and resulting state hashes; exposes action and control source, before/after reward/XP/level deltas, cumulative party progress, direction outcomes, story changes, and failures; supports day, mission, floor, hero, event-type, source, and semantic-facet lenses over one hash-bound report; `/player-journal` creates a real trained/prepared checkpoint and the mission page replaces its hash-only log with the full ledger | [Visual journal proof](evidence/phase-6-player-journal.png), [machine-readable report](evidence/phase-6-player-journal.json), engine/evaluation/database/browser tests, `pnpm validate:player-journal`, ADR 0044 |
| `MIS-015` | Complete: opt-in `engine-v21` binds a canonical runtime story history to the content-addressed first-band envelope; strict `StoryPatchCandidate` selects only cataloged optional beats and binds role expression only to a living evidence holder; 17 engine checks reject stale history, closed/unknown/overfilled slots, foreign or repeated proposals, invalid/dead/uninformed cast, and every authority expansion; `story.patch.applied` stores the validation, resulting history, patch, and state hashes and strictly revalidates on replay; `/story-patch` commits one real Floor 04 choice | [Visual runtime proof](evidence/phase-6-runtime-story-patch.png), [machine-readable report](evidence/phase-6-runtime-story-patch.json), engine/evaluation/database/browser tests, `pnpm validate:story-patch`, ADR 0045 |

### Reproduce the checkpoint

```powershell
pnpm dev
```

Open `http://localhost:5173/mission-lab` at desktop or phone width. Move across the five-floor band
rail and compare each objective, topology, observations, fixed story anchors, monster duties, and
reward ledger. On Floor 01, confirm **Hero knowledge** shows five nodes while **Author truth** shows
all seven, then inspect the Oath Hall soot seam to change the Ember Vault route from four exposed
actions to three low-exposure actions. On Floor 05, select **Ash Intake** and confirm no maintenance
discovery is legal. Enable **Preview retained memory**, match the seam to the relay schematic, and
confirm the Maintenance Seam and Cooling Control enter knowledge while the direct Warden route
remains authored. The page is a content/knowledge inspector and must not create a run.

Create a fresh `Wait` run in `http://localhost:5173/forge`, open its summoning chamber, and choose
**Floor 01** in the top navigation. On `/mission/<runId>`, keep or remove the hero roster card,
lock the threshold roster, deploy, and retreat. Retry to confirm the attempt number advances. Deploy
again and choose the Master's route one round at a time. Watch the summoned hero choose separately,
read all declared goblin intents before committing, and compare the shared party/monster initiative
ledger. Enter the Chain Court, choose a named goblin strike, and confirm vitality and mission guard
effects are explicit. Recover the First Ember, return every member to the threshold, and extract.
Reload and open the replay inspector to confirm all nine round events and their exact hashes survive.

Open `http://localhost:5173/iron-moon` and choose **Open the silver scar**. Remove the hero from the
roster for the shortest manual proof, deploy, then take **Windward Shelf → Crater Heart**, mine twice,
and return **Crater Heart → Windward Shelf → Portal Scar**. Confirm the clock falls from eight to two,
the four carried ore does not change the initial two settlement iron, and extraction atomically
raises settlement stock to six. Reload to confirm the ore ledger and success survive. To test the
failure branch instead, carry ore and hold until zero; the cargo becomes explicit `lost` entries and
settlement stock remains two.

Open `http://localhost:5173/aftermath`, edit the direction if desired, and descend to Floor 03. Lock
the two-person party, enter, and move the Master to **Cut Stair → Red Gallery → Tithe Pit → Red
Gallery** while the hero follows their own legal policy. Hold through the declared threats until the
hero's guard breaks. Confirm the aftermath ledger records persistent health and gear deltas plus one
surviving witness. Continue until death, then reload and inspect replay: the hero remains dead, has
no legal action, and every consequence retains its source event and hash.

Open `http://localhost:5173/last-command`, edit the hero's initial direction, and enter as the
Master. Lock and deploy the two-person roster, then move **Cut Stair → Red Gallery → Tithe Pit → Red
Gallery**. Read the Red Slag warning before each even round and choose the Master's action manually;
the hero continues to choose independently. When the Master reaches zero health, confirm the page
shows **Game Over**, removes the turn controls, marks the surviving hero **SEALED**, and records the
fatal source and health delta. Reload, open the sealed replay, and confirm it remains verified.

Run `pnpm validate:foundry-strategies`, start `pnpm dev:app`, and open
`http://localhost:5173/foundry-trials`. Switch among **Hammer Line**, **Split Cooling**, and **Full
Quench**. Confirm the map highlights the direct or retained-memory route, the Warden state changes
between lit/cooling/quenched, and the action log and strike range change with it. The header must
remain **24 / 24**, with zero replay mismatches and deaths; interpret that as fixed viable-path
regression evidence, not a sampled win rate.

Run `pnpm validate:attempt-aftermath`, keep `pnpm dev:app` running, and open
`http://localhost:5173/attempt-aftermath`. Confirm Floor 04 retains the real `100 → 75 HP` Master
wound under attempt 1, Floor 05 is attempt 2 with zero inherited active records, the source attempt
IDs differ, and the page reports 13 strictly replayed events with zero mismatches. The wound must
remain persistent on the body while its mission-event provenance remains inside the Floor 04
archive.

Run `pnpm validate:story-envelope`, keep `pnpm dev:app` running, and open
`http://localhost:5173/story-envelope`. Select all five floors and confirm each keeps five required
beats, two optional beats, one bounded slot, and a distinct narrative/mechanical job. Switch among
the four eligibility checkpoints; the Floor 04 checkpoint must expose exactly one activated optional
beat without displacing the required confrontation. Compare Noa Quill and Rian Vey: their frames,
prefixes, and habit gestures differ, while both lines end with the exact Signal Dais fact. The
knowledge gate must remain a pass and the fixed reward ledger must show zero drift.

Run `pnpm validate:master-timing`, start `pnpm dev`, and open
`http://localhost:5173/master-timing`. Create a run, prepare and deploy the party, then manually
commit a Wait action. Select Countdown and either take over before zero or let the persisted
five-second deadline resolve the baseline. Select Step and confirm exactly one fallback occurs
before the control returns to Wait. Select Continuous, allow at least two rounds, then press
**Pause / Wait**; reload and confirm the active decision, last source, expiry outcome, event cursor,
and replay hashes remain unchanged. The `master-timing-baseline-v1` selector intentionally
preserves the historical hold-first proof; use the `engine-v20` checkpoint below for directed
and seeded-random doctrine behavior.

Run `pnpm validate:master-fallback`, start `pnpm dev`, and open
`http://localhost:5173/master-fallback`. Create a run, prepare and deploy the party, edit the
direction and ordered priorities, then compare Directed with Seeded random under Step. Confirm the
same decision repeats the same result hash after reload. Set the health threshold to 100 and choose
Continuous to trigger a visible `master-health` safety stop at the threshold; the control must force
Wait while retaining the blocked action and explanation. Disable that stop to observe uninterrupted
autonomy, then press **Pause / Wait** and confirm the event cursor and strict replay remain stable.

Run `pnpm validate:player-journal`, keep `pnpm dev` running, and open
`http://localhost:5173/player-journal`. Create the prepared company and scroll to **The company
remembers**. Confirm the summary shows `+16 XP`, `+1 level`, and one attempt; select **Growth** to
isolate both training completions, **Direction** to inspect the exact fallback doctrine and outcome,
and **Party** to inspect preparation. Clear the filters, deploy, and confirm the deployment delta
appears without changing earlier cursors or totals. Use day, mission, floor, hero, event, and source
selectors together, then reload and confirm the report hash, entry cursors, and state hashes remain
stable.

Run `pnpm validate:story-patch`, keep `pnpm dev` running, and open
`http://localhost:5173/story-patch`. Create the prepared Floor 04 company and confirm exactly two
cataloged choices appear. **A maintenance schematic** must bind only to the ROUTEBEARER, while
**Which voice crosses the bridge** has no role binding. Commit either choice, confirm all 17 checks
remain visible, the aperture seals, the cursor advances to 2, and the fixed ledger remains five
world laws, 25 anchors, `1010/1010` rewards, and three finale constraints. Reload and confirm the
patch and `REPLAY-BOUND` state survive.

Run `pnpm validate:first-band-archive`, start `pnpm dev`, and open
`http://localhost:5173/first-band-archive`. Create the prepared company and confirm the causal rail
reads **Warden defeated → Party extracted → 2 canonical rewards → Archive recovered**, with all five
required Floor 05 beats complete. Choose each survivor and compare the predicted delivery frame;
then ask one to read. The revealed record must say **“Hearth 01 was not the first.”** exactly, while
the survivor's spoken line and habit gesture remain personality-shaped. Confirm one reader plus
three witnesses hold the knowledge, then reload and verify the reveal, extraction event, content
version, message commitment, and replay hash remain unchanged.

## Cross-phase attribute and combat-mode integration checkpoint

Status: **implementation and readiness V2 mechanical qualification integrated on 2026-09-07;
final repository validation and owner review remain in progress**.

This checkpoint records the current code boundary without promoting readiness or changing the beta
default. Full detail is in the
[attribute and combat modes integration report](superpowers/reports/2026-09-07-attribute-combat-modes-integration.md).

| Area | Integrated result | Remaining gate |
| --- | --- | --- |
| V26 capability | Growth receipts determine intrinsic mission attributes; effective scopes remain typed; V26 persists proficiency tags and per-skill mastery | idle scheduling and broader training design remain separate |
| Readiness combat | One-tick frozen cohorts, deterministic collision arbitration, purpose-keyed resolution, equipment/loadout legality, named resistances, mastery practice, and executable damaging V2 hostile strikes | broader hostile tactics and full product balance remain unfinished |
| Durable intent | Full-cohort combat windows plus one `decision-job-v3` per actor bind attempt/tick/snapshot/view/legal hashes; exact fallbacks, leases, atomic stale attempt-ledger terminalization, and compare-and-swap application are database-owned | final repository validation remains with the coordinator |
| Common outcome | Readiness and V26 legacy terminal paths emit exact-bound `combat-result-v1`, including `death`; V26 legacy records its cross-owner claim checkpoint atomically | no product promotion is implied |
| Release ownership | `legacy-auto-v1` remains the operator-only beta default; readiness V2 is available only as an operator-selected evaluation mode; no player selector exists | explicit owner review and operator configuration change are required for promotion |

The checked readiness evidence now binds `agent-readiness-rules-v2` and aggregate content hash
`e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e`. Its SHA-256 is
`6cf931fb87e8e986a18c7572b9d3399be0632cf5b11dc2d861978d95ca72a452`; 10,000 seeded trials,
20,000 modeled provider failures, 40,000 applied fallback selections, and 400 complete encounters
pass with zero safety/no-progress/regeneration-stalemate stops, nondeterminism, or unclassified
cancellations. This is mechanical qualification for operator evaluation, not product promotion or
proof of complete hostile balance. The legacy beta default remains unchanged.

## Phase 7 — synthesis, story, and vertical-slice finish

Status: **in progress**. `FIN-001` through `FIN-006` and `FIN-009` are complete as of 2026-08-25;
the broader vertical-slice finish remains active because `FIN-007` and `FIN-008` are not complete.

| Task | Result | Evidence |
| --- | --- | --- |
| `FIN-001` | Complete: `engine-v22` commits irreversible synthesis with bounded growth, identity non-transfer, witnessed social fallout, and replay-safe rumor propagation | [Synthesis evidence](evidence/phase-7-synthesis.png), machine-readable synthesis report, engine/database/browser tests |
| `FIN-002` | Complete: `engine-v23` binds the Floor 05 relight core and sealed archive to successful extraction, preserves one fixed message, and gives only the selected surviving reader and actual witnesses explicit knowledge | First-band archive browser checkpoint, strict replay validation, ADR 0046 |
| `FIN-003` | Complete: the original summoning image now leads a player-facing title; a seed creates exactly three stable adult human strangers; sequential first-person onboarding records one canonical answer per hero and the first autonomous destination; seven objectives derive from campaign plus engine state and bind the snapshot hash; pause is interface-only; large text, reduced motion, and Wait/five-second timing persist locally; same-seed restart creates a new run while the superseded replay remains verified | [Title evidence](evidence/phase-7-campaign-title.png), [company evidence](evidence/phase-7-campaign-company.png), [pause evidence](evidence/phase-7-campaign-pause.png), [mobile company](evidence/phase-7-campaign-mobile-company.png), [mobile Hearth](evidence/phase-7-campaign-mobile-hearth.png), campaign engine/database/browser tests, ADR 0047 |
| `FIN-004` | Complete: a muted-by-default procedural soundscape supplies route ambience and optional full interface cues without assets or canonical writes; every cue is redundant and captioned; v1 local settings migrate before hydration; System motion honors the OS while Reduced removes long movement; skip navigation, visible focus, native settings inputs, arrow-key hero tabs, route focus, and modal containment/restoration form the keyboard baseline | [Desktop settings](evidence/phase-7-fin004-desktop-settings.png), [desktop company](evidence/phase-7-fin004-desktop-company.png), [phone settings](evidence/phase-7-fin004-phone-settings.png), [phone company](evidence/phase-7-fin004-phone-company.png), [phone Hearth](evidence/phase-7-fin004-phone-hearth.png), settings/audio unit tests, accessibility and campaign browser tests, ADR 0048 |
| `FIN-005` | Complete: content-addressed 832 px/1681 px title WebPs replace the 2.19 MB source PNG on player routes; approved runtime portraits replace source imports where available; exact build, title, and settlement bytes bind a versioned phone report; a real arrived campaign at 390×844/2×, 150 ms/1.6 Mbps simulated 4G, and 4× CPU enforces shell, reconnect, response, frame, and working-set targets in hosted browser CI | [Optimized phone title](evidence/phase-7-fin005-phone-title.png), [arrived phone settlement](evidence/phase-7-fin005-phone-settlement.png), [machine-readable phone report](evidence/phase-7-fin005-phone-performance.json), player-visual/build validators, contract/browser tests, ADR 0049 |
| `FIN-006` | Complete: undecided and declined browsers send no analytics; affirmative adult consent creates a hashed 30-day device capability; seven strict event types reject raw or unknown properties; names, seeds, dialogue, IPs, user agents, cookies, and third parties stay outside the store; withdrawal/expiry deletes retained sessions/events; the development report exposes aggregate typed counts and a prefix-complete funnel only | [Desktop consent](evidence/phase-7-fin006-desktop-consent.png), [phone consent](evidence/phase-7-fin006-phone-consent.png), [desktop aggregate report](evidence/phase-7-fin006-desktop-aggregate-report.png), [phone aggregate report](evidence/phase-7-fin006-phone-aggregate-report.png), consent/database/browser tests, ADR 0050 |
| `FIN-007` | In progress: the first owner playthrough is now recorded honestly as stopped, 1/1 reviewed, and 7/8 checkpoints reached. Four P1 findings hold the experience: realistic identity continuity, opening clarity, contextual autonomy, and an explained Floor 01/First Ember return. ADR 0055 preserves the gate-centered redesign; default-company portrait anchors and a clearer explicit first direction form the first corrective slice | [Corrected summoning desktop](evidence/phase-7-fin007-owner-summoning-desktop.png), [corrected summoning phone](evidence/phase-7-fin007-owner-summoning-phone.png), [machine-readable gate](evidence/phase-7-fin007-moderated-playtest.json), [protocol](playtest-protocol.md), owner evidence, schema/generator/browser tests, ADRs 0054 and 0055 |
| `FIN-008` | In progress: the hash-bound readiness report independently verifies FIN-007 integrity, the one reviewed owner playthrough, all eight required checkpoints, and zero unverified P0/P1; the acknowledged packaging command refuses held or dirty inputs. The shared archive core deterministically stages built-only workspace output, rewrites runtime exports, and issues typed receipts; its non-promotable rehearsal production-installs an extraction, migrates a fresh temporary database, and passes web/worker health before deleting all rehearsal state. The current checked state honestly remains `held`, so no canonical archive exists yet | [Desktop release gate](evidence/phase-7-fin008-release-gate-desktop.png), [phone release gate](evidence/phase-7-fin008-release-gate-phone.png), [machine-readable gate](evidence/phase-7-fin008-playtest-release.json), [release/rehearsal procedure](private-playtest-release.md), archive-core/release/browser tests, hosted rehearsal, ADRs 0053 and 0054 |
| `FIN-009` | Complete: an exact Band 02 brief binds world laws, opening facts, mechanics, Hollow Bellkeeper duties, objective/reward/production bounds, and one emotional question; a real opt-in structured-output adapter plus an honestly labeled scripted fixture generate versioned five-floor alternatives; ten machine checks precede a six-part human rubric, only one exact version may be accepted, prototype dependencies hold compilation, and no proposal can mutate runtime or become canonical without later strict envelope compilation | [Desktop workshop](evidence/phase-7-fin009-story-workshop-desktop.png), [phone workshop](evidence/phase-7-fin009-story-workshop-phone.png), [machine-readable report](evidence/phase-7-fin009-story-workshop.json), [review protocol](story-workshop.md), contracts/provider/evaluation/browser tests, ADR 0052 |

### Owner-directed Forge component checkpoint

Status: **ready for owner review** on 2026-08-28.

The development Forge now compares Normal `1★+`, Advanced `2★+`, and Special `3★+` using three
fixed deterministic realistic cohorts. It explains resonance, level cap, personality, and aptitude
without starting or mutating a campaign. A linked enemy lab presents sixteen photorealistic review
archetypes in four families and a checked Floor 1–20 progression contract with one level range,
skill test, enemy combination, and new pressure on every floor. Prices, final odds, pity, variable
pulls, on-demand art generation, and production enemy rigs remain explicitly held for review.

Run `pnpm dev:app`; review `/forge/enemies`. The checked historical browser evidence includes
[desktop summons](evidence/phase-7-forge-summons-desktop.png),
[phone summons](evidence/phase-7-forge-summons-phone.png), and the
[enemy/progression lab](evidence/phase-7-forge-enemies-desktop.png). ADR 0056 records why this
component checkpoint temporarily precedes broader FIN-007 campaign retesting.

### Reproduce the FIN-003 checkpoint

Run `pnpm dev`, open `http://localhost:5173`, and begin a new seed. Follow the reserve bell, spend
the reserve, inspect all three dossiers, and ask each hero one question. Enter Hearth 01 and confirm
the first summon chooses the preparation destination before the route opens. Press Escape to review
all seven objectives and the continuing server-clock notice. In Settings, choose **Large**,
**Reduced**, and **5-second handoff**, reload, and confirm all three remain selected. Choose
**Restart same seed**, confirm the new run ID and identical three heroes, then open the prior run at
`/replay/<oldRunId>` and confirm **Verified** plus **snapshot agrees**.

### Reproduce the FIN-004 checkpoint

Run `pnpm dev`, open `http://localhost:5173`, and open **Settings**. Compare Muted, Ambient, and
Full mix; confirm captions describe the reserve bell, gate, first voice, and Hearth threshold without
carrying unique game information. Reload with Full mix selected and use **Start sound** to satisfy
the browser gesture boundary. With OS motion reduction enabled, compare System with explicit Full,
then choose Reduced and verify gate rings, scene travel, and cue emphasis retain readable static
states.

Using only the keyboard, follow **Skip to main content**, open and close Settings with Escape, move
through the three summoned heroes with arrow keys, and open the pause menu with Escape. Focus must
remain inside each modal and return to its trigger on close. Repeat at 390×844 with Large text and
confirm settings scroll, sound controls do not cover the live badge, and captions do not cover the
objective control.

### Reproduce the FIN-005 checkpoint

Run `pnpm measure:web-build-budget`, `pnpm validate:player-visuals`, and
`pnpm validate:phone-performance`. The checked report must bind 47.9 KB initial JavaScript, the
47.3 KB selected phone title, and the 296.2 KB first Hearth visual to current artifacts. Then run
`pnpm --filter @summonlab/web exec playwright test src/routes/performance.e2e.ts`; the test creates
and completes a real campaign before applying the target 390×844/2× simulated-4G/4×-CPU profile.

On a physical mid-range phone over Wi-Fi or a shaped 4G connection, open the title, enter an arrived
Hearth, open/close the pause menu five times, and scroll the living scene. Compare perceived shell
and reconnect delay, touch response, animation stability, image sharpness, and device warmth against
the emulated report. Native/GPU memory and thermal behavior remain a real-device gate rather than an
emulation claim.

### Reproduce the FIN-006 checkpoint

Run `pnpm db:migrate`, start `pnpm dev:app`, and open `http://localhost:5173`. On the title, choose
**Play without sharing**, begin a chronicle, and confirm the journey is unchanged and the consent
panel continues to say **Sharing off**. Return to the title, choose **I’m 18+ · share playtest
data**, complete onboarding, enter Hearth, and open Pause. Visit `http://localhost:5173/playtest-report`
to inspect aggregate-only route, campaign, onboarding, Hearth, and pause counts.

In Pause → Settings, review the exact shared/not-shared disclosure, then choose **Withdraw and
delete**. The panel must report the number of deleted typed events and return to **Sharing off**;
the old capability must no longer read or submit data. Run
`pnpm --filter @summonlab/web exec playwright test src/routes/playtest-analytics.e2e.ts` to prove the
zero-request decline, strict-property rejection, consented funnel, and deletion path together.

### Reproduce the FIN-007 readiness checkpoint

Run `pnpm validate:moderated-playtest`, start `pnpm dev:app`, and open
`http://localhost:5173/playtest-moderation`. The internal dashboard must now show **1 / 1**,
**In progress**, **7 / 8**, and four open blockers; the stopped owner journey and all eight triaged
findings must be visible, and it must not claim a release candidate.

For the actual test, the owner opens `http://localhost:5173`, optionally enables background
statistics once, plays from title through Hearth, the First Ember choice, and the pause menu, and
sends normal comments to Codex.
Codex—not the owner—updates the structured evidence, runs the exporters, and triages friction.
FIN-007 remains incomplete until the checked report contains the reviewed owner journey and says
`playtestStatus: complete`.

### Reproduce the FIN-008 readiness checkpoint

Run `pnpm validate:playtest-release`, start `pnpm dev:app`, and open
`http://localhost:5173/playtest-release`. The current dashboard must show **held**, four gate claims,
three active blockers (incomplete status, 7/8 coverage, and four open P1 findings), and **No package
has been produced**. Run
`pnpm package:playtest --acknowledge-private-release`; it must refuse before building or writing an
archive while FIN-007 remains incomplete.

Run `pnpm rehearse:playtest-package`. It must report `releaseEligible: false`, source status `held`,
and passing production-build, deterministic-archive, frozen-install, clean-migration, web-health,
player-title, development-route-boundary, and worker-health checks. Confirm the archive name contains
`package-rehearsal`, then confirm no rehearsal archive or database remains after the command exits.

After the owner playthrough and verified P0/P1 fixes, follow `docs/private-playtest-release.md`. The
decision to test then is whether the generated archive installs, migrates, starts both processes,
and preserves the private/privacy boundary from a clean extraction. Until the SHA-256 receipt and
that smoke test exist, FIN-008 remains in progress.

### Reproduce the FIN-009 checkpoint

Run `pnpm validate:story-workshop`, start `pnpm dev:app`, and open
`http://localhost:5173/story-workshop`. Compare **The Names We Carry** and **The Counted Silence**
across floors 06–10. Each must pass ten brief/catalog/bound checks, expose an exact semantic version
and proposal hash, and remain `pending` with zero candidates ready for compilation. The second
candidate must visibly retain production holds for `protect-objective` and `split-party-relay`.

Read `docs/story-workshop.md` before recording a review or optional provider generation. Confirm the
six editorial criteria stay human-owned, the scripted fixture claims no provider provenance, and
acceptance authorizes only later envelope compilation—not canonical content or runtime mutation.

## Next active engineering slice

Collect owner judgment on the isolated Forge: summon-channel clarity, reveal rhythm, portrait
realism, enemy family direction, and the first twenty floors' pressure curve. Revise those components
before reintegrating the accepted result into the corrective `FIN-007` gate-to-Hearth route. Resolve
and verify every P0/P1 before FIN-008 packages the private build. Automated sessions cannot replace
that owner judgment. A friends round is optional later. FIN-009 is independently complete but its
proposals remain pending human editorial review.
