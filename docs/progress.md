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

Status: **in progress**. The replay-foundation checkpoint completed on 2026-08-23; survival,
resource, and clock transitions remain.

| Task | Result | Evidence |
| --- | --- | --- |
| `ENG-001` | Immutable seeded entropy cursor with named draws and an exact fixture (`gate.resonance[0] = 7`) | Engine unit tests |
| `ENG-002` | Pure command → event → reducer path for destination, arrival, and Master gate inspection; engine imports no DB, network, model SDK, browser, or wall clock | `@summonlab/engine` contracts and invariant tests |
| `ENG-003` | Canonical append-only commands/events plus per-event snapshots, SHA-256 before/after state hashes, exact rebuild, idempotency, and optimistic concurrency | `0003_engine_event_store.sql`, database integration test, [ADR 0003](decisions/0003-event-sourced-engine.md) |
| `ENG-004` | Master and hero identity, health, location, and life-state foundations exist; injury, terminal transitions, and game over remain | Engine state schema |
| `ENG-008` | Fast-check legal-path property suite and standalone simulation CLI | `pnpm simulate:engine` |
| `ENG-009` | 10,000 generated histories / 35,000 accepted commands replay with zero invariant failures | [Simulation report](evidence/phase-2-simulation.json) |

The Phase 1 readable journal remains a projection. Its choice and arrival now commit through the
canonical engine in the same PostgreSQL transaction, so the polished screen and development replay
inspector describe one history. A development-only command endpoint demonstrates named entropy and
returns `409 STALE_RUN_VERSION` when two browser commands target the same version. Production builds
keep these inspector routes disabled unless `ENABLE_DEV_ROUTES=true` is explicit.

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

Run `pnpm dev`, complete a summon, then open **Replay** from the settlement. Draw a gate resonance
and use **Prove stale guard** to verify that only one of two simultaneous commands is accepted. The
rendered checkpoint is captured in [phase-2-replay-foundation.png](evidence/phase-2-replay-foundation.png).

## Next active slice

Continue Phase 2 with resource/inventory ledgers, equipment durability, needs and scheduled
activities, injury/death/game-over transitions, and reward/experience projections. Extend the same
replay inspector rather than creating a second debug surface.
