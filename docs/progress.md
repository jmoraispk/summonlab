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

## Next active phase

Phase 1 — summon-to-choice proof of life. Begin with the deterministic `CharacterManifest` generator and seed grid, then carry one approved hero identity through the first-person summoning scene, first independent choice, persistence, and destination walk.
