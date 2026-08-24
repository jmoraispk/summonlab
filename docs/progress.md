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

Status: **in progress**. Topology, the layered environment candidate, and authoritative travel were
completed on 2026-08-24 while Phase 3 remains at its separate human character-visual gate.

| Task | Result | Evidence |
| --- | --- | --- |
| `SET-001` | Complete: `hearth-01-v1` defines exactly five buildings/interiors, 18 connected nodes, 17 authored paths, travel duration, capacity, interaction/effect declarations, and explicit system access; deterministic route planning never lets the renderer commit arrival | [Mobile route-lab evidence](evidence/phase-4-settlement-route-lab-mobile.png), `pnpm validate:settlement-content`, ADR 0011 |
| `SET-002` | Complete as a human-pending candidate: `hearth-01-scene-v1` binds a hero-free 1536×1024 plate to the exact topology; a content-addressed 296.2 KB WebP sits beneath atmosphere, light, route, activity, and interface layers; five hotspots and 18 node projections remain visual-only; the combined phone route is 41.8 KB gzip | [Isolated phone scene](evidence/phase-4-settlement-layered-scene-mobile.png), [full phone lab](evidence/phase-4-settlement-layered-mobile.png), `pnpm validate:settlement-scene`, ADR 0012 |
| `SET-003` | Complete: `engine-v3` validates `hero.start.travel` against the hash-bound Hearth graph, persists the exact route and due arrival, leaves location unchanged in transit, and lets only `simulation.advance` commit arrival; death cancels travel and v1/v2 replay schemas remain intact | [Authoritative travel evidence](evidence/phase-4-authoritative-travel.png), engine/property/integration tests, replay travel lab, ADR 0013 |

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
then choose **Advance to outcome** and verify the arrival event and resolved schedule.

## Next active engineering slice

Collect topology, layered-scene, and travel-lab feedback, then implement capacity, assignments, and
powered state in SET-004. Phase 3 cohort expansion remains behind its separate human visual gate.
