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

## Next active phase

Phase 2 — deterministic engine. Begin with the PRNG and entropy cursor, then implement one fully
replayable command/event/reducer path, state hashes, event-store snapshots, and property tests before
adding broader survival systems.
