# Task 8 implementation report

## Outcome

- Added operator-owned `COMBAT_MODE`, defaulting to and accepting only `legacy-auto-v1` in this release phase.
- Added immutable attempt-time combat bindings with mode ID, rules version, Task 7's aggregate `COMBAT_CONTENT_BINDING.contentHash`, and bound timestamp. The existing mission/equipment content binding is not overwritten.
- Replaced V25 player action selection with one legal in-combat action, **Continue battle**. The player route accepts only `advance-automatic-combat`; it exposes no mode, actor, action, target, or policy selection.
- Added a deterministic no-provider legacy runner. It projects `{ Might, Agility, Spirit, Vitality }` onto legacy `{ might, finesse, insight, resolve }` with exact integer half-up `1..10` scaling, selects one legal action for every party actor using the run seed, and records policy/packet/legal-action/result hashes.
- Added real `MissionAttemptV9` / `MissionRunStateV9` reachability for V25 and a V25-only aftermath/harm schema that permits capability Health above 100 without widening V1-V24.
- Preserved existing sequential combat entropy and the 48-round terminal boundary. V1-V24 resolver behavior, event bytes, frozen fixtures, and replay hashes remain unchanged.

## RED evidence

1. The config suite initially failed two assertions because `combatMode` and `COMBAT_MODE` did not exist.
2. The first legacy automatic suite failed at module load because `combat-mode.ts` did not exist.
3. After the initial contracts/runner slice, two full-flow tests failed with `Mission transition precondition failed`, proving V25 events were not reachable through the reducer.
4. The new web boundary suite failed both preparation and automatic advance with HTTP 500 before the route bound the operator mode and dispatched the internal automatic command.
5. The first full engine run failed five integration inventories: V25 equipment fixture aftermath, public exports, mission command ownership/event mapping, and mission service-version availability.
6. Tightening the V25 legal-action assertion failed because retreat was still exposed alongside Continue battle. Removing it made the carried “Continue only” ruling executable rather than merely visual.

## GREEN evidence

- `pnpm --filter @summonlab/config test -- --maxWorkers=1`: 1 file, 7 tests passed.
- `pnpm --filter @summonlab/contracts test -- --maxWorkers=1`: 14 files, 119 tests passed.
- `pnpm --filter @summonlab/engine test -- --maxWorkers=1`: 29 files, 314 tests passed.
- `pnpm --filter @summonlab/engine exec vitest run src/domains/mission/legacy-auto.spec.ts src/compatibility/replay-vectors.spec.ts src/domains/mission/mission-runtime.spec.ts --maxWorkers=1`: 3 files, 43 tests passed.
- `pnpm --filter @summonlab/web exec vitest run 'src/routes/api/runs/[runId]/mission/server.spec.ts' --maxWorkers=1`: 1 file, 3 tests passed.
- Contracts, engine, and web typechecks passed; Svelte reported zero errors and zero warnings.
- Config, engine, and web package lint passed. Prettier check and `git diff --check` passed for all touched files.

## Compatibility and replay audit

- `legacy-auto-v1` uses `combat-content-binding-v1` aggregate hash `1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7`.
- The new automatic command has pinned event hash `9994fc615be60d141d372ce27b59a977ca800a9072a0ff58c30d3ed345c22a54` in the ownership suite.
- Existing command event hashes in the same inventory did not change.
- The frozen V24 replay final state remains `be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20`.
- V25 replay recomputes automatic choices from the stored attempt binding and rejects a payload whose binding is changed to `agent-readiness-v1`.
- Changing the current operator default while advancing does not rebind an existing attempt; only preparation reads the configured default.
- The automatic runner calls no hero model and makes no provider request. Its per-round provider cost is zero; the route performs the existing single authoritative command commit.

## Exact file seams

Planned implementation files changed:

- `packages/config/src/index.ts`, `packages/config/src/config.spec.ts`
- `packages/contracts/src/engine/mission-state.ts`, `packages/contracts/src/engine/commands.ts`
- `packages/engine/src/domains/mission/combat-mode.ts`, `packages/engine/src/domains/mission/legacy-auto.ts`, `packages/engine/src/domains/mission/legacy-auto.spec.ts`
- `packages/engine/src/domains/mission/actions.ts`, `packages/engine/src/domains/mission/commands.ts`, `packages/engine/src/domains/mission/reducer.ts`
- `apps/web/src/routes/api/runs/[runId]/mission/+server.ts`, `apps/web/src/routes/api/runs/[runId]/mission/server.spec.ts`
- `apps/web/src/routes/mission/[runId]/+page.server.ts`, `apps/web/src/routes/mission/[runId]/+page.svelte`

Authorized V25 reachability and compatibility seams changed:

- `packages/contracts/src/capability.spec.ts`, `packages/contracts/src/engine-compatibility.spec.ts`, `packages/contracts/src/engine-public-api.snapshot.ts`, `packages/contracts/src/engine-public-types.ts`, `packages/contracts/src/engine/game-state.ts`, `packages/contracts/src/engine/index.ts`
- `packages/engine/src/compatibility/public-api.snapshot.ts`, `packages/engine/src/core/core.spec.ts`, `packages/engine/src/core/versions.ts`, `packages/engine/src/domains/mission/combat.ts`, `packages/engine/src/domains/mission/lifecycle.ts`, `packages/engine/src/domains/mission/mission-runtime.spec.ts`, `packages/engine/src/domains/mission/monster-policy.ts`, `packages/engine/src/domains/settlement/equipment.spec.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/orchestration/bootstrap.ts`, `packages/engine/src/orchestration/command-authorization.ts`

No production diff was needed in `packages/contracts/src/proof.ts` or `apps/web/src/routes/api/runs/+server.ts`: the existing `ProofRunCreateRequestSchema` is strict and the run route parses it before persistence. Regression coverage now proves a player-supplied `combatMode` is rejected.

## Self-review

- `agent-readiness-v1` exists only as a reserved contract ID. Config and the V25 runner reject it; no player can select either mode.
- The legacy projection is used only by the V25 compatibility path. Historical minds retain and consume their stored aptitudes unchanged.
- The V25 consequence schema widens hero Health/damage bounds only. Historical harm/result schemas and Master Health remain unchanged.
- Preparation, party revision, deployment, resolution, extraction, retreat internals, and aftermath archival preserve the stored binding. Public V25 combat legality exposes only automatic advance while combat is active.
- The Task 4 premature V25 mission alias was replaced by actual `MissionRunStateV9` schema/export/lifecycle/reducer support.

## Known pre-existing validation issue

- Full contracts lint still reports the three pre-existing unused destructuring bindings in `packages/contracts/src/capability.spec.ts` (lines 122, 147, and 176). This is the same unrelated lint debt recorded by Task 7; no new lint error was introduced.
