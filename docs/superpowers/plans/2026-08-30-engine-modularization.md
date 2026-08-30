# Engine Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the deterministic engine and its engine contracts into explicitly owned modules while
preserving every existing schema, command, event, state transition, hash, replay result, legal-action
order, error, and package import.

**Architecture:** Keep `packages/engine/src/engine.ts` and `packages/contracts/src/engine.ts` as
compatibility facades. Move schemas into composable contract modules; move runtime behavior through
one-way layers—core, domain leaves, orchestration—and compose command/event ownership with validated
static registries. Characterization fixtures and package-wide gates make each move reversible.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, fast-check, pnpm workspaces, tsup, SvelteKit, PostgreSQL
integration tests.

**Spec:** `docs/superpowers/specs/2026-08-30-engine-modularization-design.md`

## Global Constraints

- This is a behavior-preserving refactor. Do not add a schema/content version, command, event, game
  rule, database migration, or asset change.
- Preserve the bytes and order of canonical JSON, state hashes, event hashes, entropy purpose strings,
  schedules, event metadata, legal actions, projections, errors, and replay reports.
- Preserve all exports from `@summonlab/engine` and `@summonlab/contracts`. Capability predicates are
  the only additive public exports in this plan.
- Never edit an old reducer branch to resemble a newer schema. Move each historical branch intact and
  keep its original payload parser.
- Keep `engine.ts` import-free from internal production code: no non-test module under
  `packages/engine/src/**` may import `./engine.js`, `../engine.js`, or `../../engine.js` after Task 5.
  Dedicated facade compatibility tests may import it as their subject.
- Move code and its focused tests in the same commit. Avoid formatting unrelated lines while moving
  code so diffs remain reviewable.
- One agent owns the monolith-removal step at a time. Parallel agents may prepare tests or review an
  already extracted domain, but they must not concurrently edit `packages/engine/src/engine.ts` or
  `packages/contracts/src/engine.ts`.
- At each checkpoint, compare the compatibility manifest and replay fixtures with Checkpoint A. Any
  unexplained change blocks the next task.
- Each task ends with its named commit only after its verification commands pass.

## Baseline extraction map

All ranges below refer to baseline commit `a9f2335e4a195cd2a0f48feba0ee8b477f000075` and are used to
recover the original code after later tasks shorten the monolith:

- `packages/engine/src/engine.ts`: versions/payloads/timing 193–1539; bootstrap 1548–2093;
  story/archive 2098–2438; society 2740–3474; navigation 3475–3825; mission lifecycle 3826–4413;
  monster/combat 4413–6284; portal 6296–6645; routines 6646–6841; legal actions/policy translation
  6843–7838; command legality 7914–8486; event building 8487–10659; reduction 10660–13132;
  scheduling/apply/replay 13133–13451.
- `packages/contracts/src/engine.ts`: v1–v7/base/settlement 46–1328; mission schemas 1329–2558;
  Master control 2608–2918; story/synthesis/archive 2926–3411; composed v8–v23 states 3412–3851;
  state union 3852–3880; commands/requests 3881–4387; runtime/snapshot/replay contracts 4388–4556.

Use `git show a9f2335:packages/engine/src/engine.ts` or the contracts equivalent when reviewing an
extraction against the untouched baseline; do not copy code from a newer historical schema branch.

---

## Task 0: Create the engine execution worktree

**Files:**

- No repository files change.
- Worktree: `../summonlab-worktrees/engine`
- Branch: `codex/engine-modularization`

- [ ] Confirm the integration worktree is clean and current:

  ```bash
  git status --short
  git fetch origin main
  git rev-list --left-right --count main...origin/main
  ```

  Expected: no status output and `0 0` from `rev-list`.

- [ ] Create one sparse engine worktree from the reviewed baseline:

  ```bash
  mkdir -p ../summonlab-worktrees
  git worktree add --no-checkout -b codex/engine-modularization \
    ../summonlab-worktrees/engine origin/main
  git -C ../summonlab-worktrees/engine sparse-checkout set \
    --cone --sparse-index \
    apps/worker apps/web packages tools docs/system-architecture \
    docs/decisions docs/superpowers docs/evidence docs/wiki docs/benchmarks
  git -C ../summonlab-worktrees/engine checkout
  ```

  Cone mode also materializes repository-root files such as `package.json`, `pnpm-lock.yaml`, and
  workspace configuration. It excludes the large asset trees while retaining every engine consumer
  and integration test.

- [ ] Verify the worktree and sparse rules:

  ```bash
  git worktree list
  git -C ../summonlab-worktrees/engine status --short --branch
  git -C ../summonlab-worktrees/engine sparse-checkout list
  du -sh ../summonlab-worktrees/engine
  ```

  Expected: the new branch is clean, the listed paths match the command above, and the checkout does
  not contain `assets/`.

- [ ] Prepare the pinned toolchain and install this worktree's dependencies:

  ```bash
  node --version
  corepack enable
  corepack prepare pnpm@10.33.0 --activate
  pnpm --version
  pnpm install --frozen-lockfile
  ```

  Expected: Node reports `v24.14.1`, pnpm reports `10.33.0`, and the lockfile remains unchanged. A
  linked worktree shares Git objects, not `node_modules`; do not rely on the primary worktree's install.

- [ ] Start the repository PostgreSQL service before the first integration gate and export the same
  URLs used by the local compose file:

  ```bash
  pnpm db:start
  export DATABASE_URL=postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab
  export TEST_DATABASE_URL=postgresql://summonlab:summonlab@127.0.0.1:54329/summonlab
  pnpm db:migrate
  ```

  Expected: Docker reports the database healthy and migrations complete. Keep these variables in the
  execution shell for Tasks 1–15; run `pnpm db:stop` after final validation.

- [ ] Use the sparse worktree for Tasks 1–15. Keep the original full worktree clean for checkpoint
  integration and final repository validation. Do not start Git LFS migration on either branch until
  this refactor merges.

---

## Task 1: Freeze the public surface and discriminator inventory

**Files:**

- Create: `packages/contracts/src/engine-compatibility.spec.ts`
- Create: `packages/contracts/src/engine-public-api.snapshot.ts`
- Create: `packages/contracts/src/engine-public-types.ts`
- Create: `packages/engine/src/compatibility/public-api.spec.ts`
- Create: `packages/engine/src/compatibility/public-api.snapshot.ts`
- Create: `packages/engine/src/compatibility/public-types.ts`
- Create: `packages/engine/src/compatibility/event-discriminators.ts`
- Modify: `packages/engine/src/engine.spec.ts`

- [ ] Add a contracts characterization table containing one complete valid state object for each
  schema version 1–23. Reuse initial states from the existing v1–v12 replay fixtures, use the default
  bootstrap for v13, and parse the existing development bootstraps down to v14–v23. Assert every
  object parses through `EngineGameStateSchema`, then clone the v23 object with `schemaVersion: 24`
  and assert rejection. Snapshot the sorted
  `EngineCommandSchema.options.map(option => option.shape.commandType.value)` list and the exported
  version constants by their existing names and values.

- [ ] Add the contracts equivalent of the engine API evidence: an alphabetized runtime-export array
  in `engine-public-api.snapshot.ts` and explicit compile-only type imports in
  `engine-public-types.ts`. Cover every engine schema/type re-exported by `packages/contracts/src/index.ts`.

- [ ] Add `public-api.snapshot.ts` with a checked-in, alphabetically sorted readonly array of every
  current runtime export from `packages/engine/src/index.ts` and its re-exported modules. Add
  `public-types.ts` with explicit `import type` statements and compile-only assignments for every
  public engine type used by another workspace package. Both files are explicit review artifacts,
  not generated at test runtime.

- [ ] Add `public-api.spec.ts` that imports `* as engine` from `../index.js`, compares
  `Object.keys(engine).sort()` with the checked-in array, and checks constructor identity plus exact
  instance fields: `IllegalActionError` and `StaleStateVersionError` include their existing `code`
  values; `ReplayIntegrityError` includes `sequence` and intentionally has no `code`.

- [ ] Add `event-discriminators.ts` with three manually audited readonly arrays:
  `RUN_INITIALIZATION_EVENT_TYPES`, `LEGACY_EVENT_TYPES`, and `MODERN_EVENT_TYPES`. Inventory every
  literal accepted by `reduceLegacyEvent` and `reduceV2Event`, including mission transition strings
  constructed through their transition map. Add a source characterization assertion that the union
  equals every event type produced by existing builders/fixtures; later registry tests use this
  checked-in list as the exhaustive ownership contract.

- [ ] Extend `engine.spec.ts` with a table that records the exact, ordered legal-action IDs for one
  representative state at every decision boundary currently covered by the suite: bootstrap,
  settlement idle, travel, communication, conversation, directive, mission preparation, mission
  deployment, mission turn, aftermath, story patch, synthesis, and first-band archive.

- [ ] Run the new tests and inspect the first characterization output before accepting it:

  ```bash
  pnpm --filter @summonlab/contracts test -- src/engine-compatibility.spec.ts
  pnpm --filter @summonlab/engine test -- \
    src/compatibility/public-api.spec.ts src/engine.spec.ts
  ```

  Expected: both commands pass; the state/command/event discriminators, engine and contract exports,
  errors, and action order reflect the pre-refactor implementation.

- [ ] Commit Checkpoint A inventory:

  ```bash
  git add packages/contracts/src/engine-compatibility.spec.ts \
    packages/engine/src/compatibility packages/engine/src/engine.spec.ts
  git commit -m "test(engine): freeze compatibility surface"
  ```

---

## Task 2: Add strict replay vectors for uncovered version families

**Files:**

- Create: `packages/engine/src/compatibility/replay-vectors.ts`
- Create: `packages/engine/src/compatibility/replay-vectors.spec.ts`
- Read for source evidence: `packages/engine/src/engine.spec.ts`
- Read for source evidence: `packages/evaluation/src/evaluation.spec.ts`
- Read for source evidence: `packages/evaluation/src/first-band-archive.spec.ts`
- Read for source evidence: `packages/evaluation/src/story-patch.spec.ts`
- Read for source evidence: `packages/evaluation/src/synthesis.spec.ts`

- [ ] Define the fixture shape without importing engine internals:

  ```ts
  export interface EngineReplayVector {
    readonly id: string;
    readonly schemaVersion: number;
    readonly events: readonly AuthoritativeEvent[];
    readonly expectedEventTypes: readonly string[];
    readonly expectedBeforeHashes: readonly string[];
    readonly expectedAfterHashes: readonly string[];
    readonly expectedFinalStateHash: string;
    readonly expectedLegalActionIds: readonly string[];
    readonly expectedScheduledEventIds: readonly string[];
    readonly expectedResolvedScheduledEventIds: readonly string[];
    readonly expectedCanceledScheduledEventIds: readonly string[];
  }
  ```

  Construct every stream as `[bootstrap.event, ...applyResult.events]` through the current public
  bootstrap/apply APIs, then commit the exact expected values. The first event must be
  `run.initialized` at sequence 1. Do not hand-author hashes.

- [ ] Add one minimal vector for each currently uncovered compatibility family:

  - v5: routine/activity resolution;
  - v8: communication;
  - v14: mission evidence and arena knowledge;
  - v15: Iron Moon portal pressure, cargo, and extraction;
  - v16: persistent mission aftermath;
  - v17: Master permadeath;
  - v18: attempt aftermath;
  - v19: Master timing and timed mission turn;
  - v20: Master fallback and safety stop;
  - v21: story patch;
  - v22: synthesis;
  - v23: first-band archive.

  Reuse the deterministic content IDs, clocks, entropy seeds, commands, and policy results already
  present in the named engine/evaluation tests. Keep each stream to the shortest prefix that enters
  and exits the version-specific reducer branch.

- [ ] In `replay-vectors.spec.ts`, assert for every vector:

  1. recorded event types equal `expectedEventTypes` in order;
  2. every event's before/after hash equals the checked-in arrays;
  3. `replayEventsStrict(events)` returns the exact final state produced by the last apply result;
  4. `hashGameState(finalState)` equals `expectedFinalStateHash`;
  5. `legalActions(finalState).map(action => action.actionId)` equals the checked-in ordered IDs;
  6. flattened schedule IDs from every apply result equal the three checked-in schedule arrays;
  7. changing one payload scalar causes strict replay to reject the stream without mutating input.

- [ ] Run the compatibility and property gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/compatibility/replay-vectors.spec.ts src/engine.spec.ts src/property.spec.ts
  pnpm --filter @summonlab/evaluation test -- \
    src/evaluation.spec.ts src/first-band-archive.spec.ts \
    src/story-patch.spec.ts src/synthesis.spec.ts
  ```

  Expected: all vectors pass strict replay, tampering is rejected, and existing proof hashes remain
  unchanged. This completes Checkpoint A.

- [ ] Commit the replay baseline:

  ```bash
  git add packages/engine/src/compatibility
  git commit -m "test(engine): cover versioned replay branches"
  ```

---

## Task 3: Split leaf and settlement contract schemas

**Files:**

- Create: `packages/contracts/src/engine/base-state.ts`
- Create: `packages/contracts/src/engine/settlement-state.ts`
- Modify: `packages/contracts/src/engine.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`

- [ ] In `base-state.ts`, move—not recreate—the v1 primitives for actors, needs, resources, clocks,
  locations, activities, and their inferred TypeScript types. Preserve schema construction order,
  `.default()`, `.optional()`, `.strict()`, refinements, descriptions, and exported names.

- [ ] In `settlement-state.ts`, move travel, route, facility, capacity, routine, activity outcome,
  First Ember, communication, conversation, directive, and society-binding schemas and types. Import
  their leaf schemas from `base-state.js`; do not import the compatibility barrel.

- [ ] Change `packages/contracts/src/engine.ts` to import the moved leaf schemas from
  `./engine/base-state.js` and `./engine/settlement-state.js`, re-export their public names, and retain
  the not-yet-moved definitions locally. Do not create `engine/index.ts` yet: the compatibility file
  still owns composed schemas, so a reverse re-export would introduce a cycle.

- [ ] Extend the compatibility test to parse a representative base state and a fully populated
  settlement/society state through both the leaf schemas and `EngineGameStateSchema`, then compare
  the parsed values with `toStrictEqual`.

- [ ] Verify the contract package and downstream type consumers:

  ```bash
  pnpm --filter @summonlab/contracts lint
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/contracts test
  pnpm --filter @summonlab/engine typecheck
  ```

  Expected: no public snapshot difference and no generated declaration difference other than source
  module paths.

- [ ] Commit the leaf contract split:

  ```bash
  git add packages/contracts/src/engine.ts packages/contracts/src/engine \
    packages/contracts/src/engine-compatibility.spec.ts
  git commit -m "refactor(contracts): split settlement engine schemas"
  ```

---

## Task 4A: Split mission and Master-control contracts

**Files:**

- Create: `packages/contracts/src/engine/mission-state.ts`
- Create: `packages/contracts/src/engine/master-control.ts`
- Modify: `packages/contracts/src/engine.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`

**Interfaces:** Preserve every existing exported schema/type name. `mission-state.ts` exports the
mission binding/run/attempt/party/turn/combat/portal/cargo/aftermath schemas. `master-control.ts`
exports timing, fallback, active-decision, resolution, safety-stop, and action-source schemas.

- [ ] Move mission preparation, attempt, deployment, turn, combat, portal, cargo, aftermath, and
  extraction schemas/types from the mission block of `packages/contracts/src/engine.ts` into
  `mission-state.ts`. Preserve each historical `MissionRunStateV1` through `V8` shape and payload
  schema separately, including refinement order and error messages.

- [ ] Move Master timing, fallback configuration, active decision, resolution, safety stop, and
  related request/result schemas/types into `master-control.ts` without changing defaults or unions.

- [ ] Import/re-export the moved symbols from the compatibility file. Add direct leaf tests for one
  valid and one refinement-invalid value per historical mission shape, plus every Master-control
  timing/fallback variant. Compare leaf parsing with the public package schema using `toStrictEqual`.

- [ ] Run and commit this leaf split:

  ```bash
  pnpm --filter @summonlab/contracts lint
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/contracts test
  pnpm --filter @summonlab/engine typecheck
  git add packages/contracts/src/engine.ts packages/contracts/src/engine \
    packages/contracts/src/engine-compatibility.spec.ts
  git commit -m "refactor(contracts): split mission control schemas"
  ```

  Expected: contract/runtime API snapshots and all parsed values are unchanged.

---

## Task 4B: Split story and synthesis contracts

**Files:**

- Create: `packages/contracts/src/engine/story-synthesis-state.ts`
- Modify: `packages/contracts/src/engine.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`

**Interfaces:** Preserve the existing story patch/cast/archive and synthesis
receipt/consequence/rumor schema and type export names.

- [ ] Move story envelope, cast, patch, first-band story/archive, synthesis receipt, relationship
  consequence, and rumor schemas/types into `story-synthesis-state.ts`. Preserve all literal version
  fields, maximum lengths, refinements, and nested schema identity used by consumers.

- [ ] Import/re-export the moved symbols from the compatibility file. Add direct leaf tests for a
  story patch, first-band archive, synthesis receipt, and synthesis rumor; compare success and exact
  validation failures with the public package schemas.

- [ ] Run and commit this leaf split:

  ```bash
  pnpm --filter @summonlab/contracts lint
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/contracts test
  pnpm --filter @summonlab/engine typecheck
  git add packages/contracts/src/engine.ts packages/contracts/src/engine \
    packages/contracts/src/engine-compatibility.spec.ts
  git commit -m "refactor(contracts): split story synthesis schemas"
  ```

  Expected: contract/runtime API snapshots and all parsed values are unchanged.

---

## Task 4C: Compose game-state, command, and runtime contract facades

**Files:**

- Create: `packages/contracts/src/engine/game-state.ts`
- Create: `packages/contracts/src/engine/commands.ts`
- Create: `packages/contracts/src/engine/runtime.ts`
- Create: `packages/contracts/src/engine/index.ts`
- Replace contents: `packages/contracts/src/engine.ts`
- Modify: `packages/contracts/src/engine-compatibility.spec.ts`

**Interfaces:** `game-state.ts` owns `EngineGameStateV1Schema` through
`EngineGameStateV23Schema` and their discriminated union; `commands.ts` owns every engine command and
request schema; `runtime.ts` owns entropy, clock, schedule, snapshot, commit, and replay contracts.

- [ ] Move state composition to `game-state.ts`, importing leaf modules only. Preserve version order,
  object spreading order, refinements, and inferred type names.

- [ ] Move every engine command/request schema and `EngineCommandSchema` to `commands.ts`, preserving
  union order and discriminator literals. Move runtime schemas/types to `runtime.ts`.

- [ ] Make `engine/index.ts` re-export all contract owner modules. Replace
  `packages/contracts/src/engine.ts` with:

  ```ts
  export * from './engine/index.js';
  ```

- [ ] Extend compatibility tests to parse every state/command discriminator and a strict replay
  report through both leaf and public imports. Re-run the runtime/type export snapshots.

- [ ] Run the complete contract and dependent compilation gate:

  ```bash
  pnpm --filter @summonlab/contracts lint
  pnpm --filter @summonlab/contracts typecheck
  pnpm --filter @summonlab/contracts test
  pnpm --filter @summonlab/contracts build
  pnpm --filter @summonlab/engine typecheck
  pnpm --filter @summonlab/database typecheck
  pnpm --filter @summonlab/web typecheck
  ```

  Expected: all commands pass, both API snapshots are unchanged, and the compatibility file contains
  only the re-export.

- [ ] Commit the contract facade:

  ```bash
  git add packages/contracts/src/engine.ts packages/contracts/src/engine \
    packages/contracts/src/engine-compatibility.spec.ts
  git commit -m "refactor(contracts): compose engine contract facade"
  ```

---

## Task 5: Extract runtime core roots and enforce boundaries

**Files:**

- Create: `packages/engine/src/core/versions.ts`
- Create: `packages/engine/src/core/types.ts`
- Create: `packages/engine/src/core/state.ts`
- Create: `packages/engine/src/core/content-bindings.ts`
- Create: `packages/engine/src/core/event-metadata.ts`
- Create: `packages/engine/src/core/core.spec.ts`
- Create: `packages/engine/src/module-boundaries.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/context.ts`
- Modify: `packages/engine/src/catch-up.ts`
- Modify: `packages/engine/src/simulation.ts`

- [ ] Move all engine/content version constants and invariant constants into `core/versions.ts`.
  Add exhaustive structural type guards for navigation (v3–v23), facilities (v4–v23), routines
  (v5–v23), First Ember (v6–v23), society (v7–v23), communication (v8–v23), conversation (v9–v23),
  directives (v10–v23), missions (v11–v23), and mission turns (v12–v20 plus v23). Each return type is
  `state is Extract<EngineGameState, { schemaVersion: ... }>` rather than a boolean over `Pick`.

- [ ] Add service-availability predicates backed by exported readonly version arrays with these exact
  memberships:

  ```ts
  supportsCatchUp(state)             // 5,6,7,8,9,10,11,12,13
  supportsCommunicationApi(state)    // 8,9,10,11,12,13
  supportsConversationApi(state)     // 9,10,11,12,13
  supportsDirectivesApi(state)       // 10,11,12,13,16,17,18
  supportsMissionApi(state)          // 13,15,16,17,18,19,20
  supportsStoryPatchApi(state)       // 21
  supportsSynthesisApi(state)        // 22
  supportsFirstBandArchiveApi(state) // 23
  ```

  Give each function an explicit type-guard return type. These lists describe existing service
  support, not every structurally compatible engine state.

- [ ] Move cross-domain runtime interfaces and narrowing helpers to `core/types.ts`. Define
  `EngineCommandHandler` and `EngineEventReducer` there with the exact interfaces from the design
  spec, including stable `ownerId`, so domains can implement the ports without importing orchestration.
  Keep this module free of domain and orchestration imports.

- [ ] Move state parsing/narrowing and `hashGameState` to `core/state.ts`; it must continue using the
  same public schema and existing canonical hashing helper.

- [ ] Move verified immutable content lookup/binding helpers to `core/content-bindings.ts`. Move the
  common event envelope, `systemSource`, empty metadata, and shared reward parsing helpers to
  `core/event-metadata.ts`.

- [ ] Change `context.ts`, `catch-up.ts`, and `simulation.ts` to import extracted owners directly
  whenever an import from `./engine.js` would create a future cycle. Preserve their own public exports.

- [ ] Add `core.spec.ts` that evaluates every structural guard and service predicate against the full
  1–23 state table from Checkpoint A and compares the accepted versions with the exact arrays above.
  Also hash representative v1/v23 states exactly as Checkpoint A and reject content-version mismatches
  exactly as before.

- [ ] Add `module-boundaries.spec.ts`. Recursively enumerate non-test TypeScript sources and fail on:

  - any internal import whose resolved basename is `engine.js`;
  - a `core/**` import of `domains/**` or `orchestration/**`;
  - a `domains/**` import of `orchestration/**`;
  - a `domains/<name>/**` import of a different `domains/<other-name>/**`;
  - any engine source import from database, worker, web, policies, or evaluation.

  Normalize path separators before applying rules so the test behaves on Windows and Linux.

- [ ] Run core, compatibility, context, replay, and property gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/core/core.spec.ts src/module-boundaries.spec.ts src/context.spec.ts \
    src/compatibility/public-api.spec.ts src/compatibility/replay-vectors.spec.ts \
    src/property.spec.ts
  pnpm --filter @summonlab/engine lint
  pnpm --filter @summonlab/engine typecheck
  ```

  Expected: all tests pass and the boundary test reports no forbidden imports. This completes
  Checkpoint B.

- [ ] Commit the core extraction:

  ```bash
  git add packages/engine/src/core packages/engine/src/module-boundaries.spec.ts \
    packages/engine/src/engine.ts packages/engine/src/context.ts \
    packages/engine/src/catch-up.ts packages/engine/src/simulation.ts
  git commit -m "refactor(engine): extract deterministic core"
  ```

---

## Task 6A: Extract the story and archive domain

**Files:**

- Create: `packages/engine/src/domains/story/runtime.ts`
- Create: `packages/engine/src/domains/story/archive.ts`
- Create: `packages/engine/src/domains/story/commands.ts`
- Create: `packages/engine/src/domains/story/reducer.ts`
- Create: `packages/engine/src/domains/story/story-domain.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/story.spec.ts`

**Interfaces:** Preserve the public signatures of `storyPatchCastForState` and
`validateStoryPatchForState`. Export typed `storyCommandHandler`, `storyEventReducer`, and the pure
`reduceFirstBandMissionConsequences(v23State, event)` seam used by Task 9.

- [ ] Move story cast collection, patch validation/application, archive extraction, reveal, and
  first-band binding helpers intact. Export narrow domain functions whose inputs are state/content and
  whose outputs are values or state patches; do not import orchestration.

- [ ] Move story/story-archive command legality and event-building branches to `commands.ts`. Export a
  `storyCommandHandler` whose discriminator list is explicit and ordered.

- [ ] Move v21 and v23 story reducer branches to `reducer.ts`. Export `storyEventReducer` with an
  explicit event-type list; retain the exact historical payload schema used by each branch. Keep the
  v23 mission-extraction consequence as the pure seam named above rather than registering the shared
  mission discriminator here.

- [ ] Move focused assertions from the old broad tests into the domain spec. For every command,
  compare the extracted event with the Checkpoint A event using `toStrictEqual`; for every reducer,
  compare state and hash; assert illegal commands preserve the input state.

- [ ] Run story/archive compatibility and evaluation gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/story/story-domain.spec.ts \
    src/story.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  pnpm --filter @summonlab/evaluation test -- \
    src/story-patch.spec.ts src/story-workshop.spec.ts src/first-band-archive.spec.ts
  ```

  Expected: exact events/states/hashes match and evaluation fixtures do not change.

- [ ] Commit the story domain:

  ```bash
  git add packages/engine/src/domains/story packages/engine/src/engine.ts \
    packages/engine/src/story.spec.ts
  git commit -m "refactor(engine): extract story archive domain"
  ```

---

## Task 6B: Extract the synthesis domain

**Files:**

- Create: `packages/engine/src/domains/synthesis/runtime.ts`
- Create: `packages/engine/src/domains/synthesis/commands.ts`
- Create: `packages/engine/src/domains/synthesis/reducer.ts`
- Create: `packages/engine/src/domains/synthesis/synthesis-domain.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/synthesis.spec.ts`

**Interfaces:** Export `synthesisCommandHandler` for synthesis commit/rumor commands and
`synthesisEventReducer` for v22 synthesis/rumor events. Runtime helpers accept parsed v22 state and
return receipts, consequences, rumors, or state patches without orchestration imports.

- [ ] Move receipt experience, relationship consequence, rumor derivation, validation, and state
  patch helpers to `runtime.ts`; preserve deterministic IDs, ordering, and provenance.

- [ ] Move v22 command legality/event construction to `commands.ts` and event reduction to
  `reducer.ts`, keeping the exact payload parsers and existing error precedence.

- [ ] In the domain spec, compare both command events and reduced states/hashes with Checkpoint A;
  cover private/open synthesis, rumor success, rumor illegality, and tamper rejection.

- [ ] Run and commit the synthesis extraction:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/synthesis/synthesis-domain.spec.ts src/synthesis.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  pnpm --filter @summonlab/evaluation test -- src/synthesis.spec.ts
  git add packages/engine/src/domains/synthesis packages/engine/src/engine.ts \
    packages/engine/src/synthesis.spec.ts
  git commit -m "refactor(engine): extract synthesis domain"
  ```

  Expected: synthesis events, provenance, state hashes, and evaluation artifact remain unchanged.

---

## Task 7A: Extract settlement leaf behavior

**Files:**

- Create: `packages/engine/src/domains/settlement/navigation.ts`
- Create: `packages/engine/src/domains/settlement/routines.ts`
- Create: `packages/engine/src/domains/settlement/society.ts`
- Create: `packages/engine/src/domains/settlement/settlement-leaves.spec.ts`
- Modify: `packages/engine/src/engine.ts`

**Interfaces:** `navigation.ts` owns route lookup, current travel, occupancy, and capacity calculations;
`routines.ts` owns daily-plan, routine, and activity outcome derivation; `society.ts` owns First Ember,
communication, conversation, and directive consequence helpers. Inputs are parsed state/command/event
values and outputs are deterministic values or state patches.

- [ ] Move route/travel/occupancy/facility-capacity helpers to `navigation.ts` without changing route
  sorting, duration, scheduled IDs, or capacity errors. Replace their monolith bodies with imports so
  compilation proves every caller has moved.

- [ ] Move routine/activity planning and outcome helpers to `routines.ts`; preserve plan/action order,
  entropy consumption, schedule timestamps, and reward calculations.

- [ ] Move communication/conversation/directive/First Ember society consequence helpers to
  `society.ts`; preserve witness order, deterministic observation/belief/relationship IDs, confidence,
  and provenance.

- [ ] Add leaf tests for route completion, full facility rejection, routine resolution, First Ember,
  communication, conversation, and directive consequences. Compare return values and hashes with
  values captured before moving each function.

- [ ] Run and commit the leaf extraction:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/settlement/settlement-leaves.spec.ts \
    src/engine.spec.ts src/context.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  git add packages/engine/src/domains/settlement packages/engine/src/engine.ts
  git commit -m "refactor(engine): extract settlement leaves"
  ```

  Expected: leaf values and replay hashes are unchanged.

---

## Task 7B: Extract settlement actions and dispatch

**Files:**

- Create: `packages/engine/src/domains/settlement/actions.ts`
- Create: `packages/engine/src/domains/settlement/commands.ts`
- Create: `packages/engine/src/domains/settlement/reducer.ts`
- Create: `packages/engine/src/domains/settlement/settlement-domain.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/engine.spec.ts`
- Modify: `packages/engine/src/property.spec.ts`

**Interfaces:** Export ordered `settlementLegalActions(state, actorId)`, typed
`settlementCommandHandler`, and typed `settlementEventReducer`. The two handlers declare stable
`ownerId` and exact discriminator arrays.

- [ ] Export `settlementLegalActions(state)` from `actions.ts`. Preserve the exact order produced by
  the monolith and return an array rather than a set or map.

- [ ] Move settlement command legality and event construction into `commands.ts`; export
  `settlementCommandHandler` with exact command discriminators. Move matching historical event
  branches into `reducer.ts`; export `settlementEventReducer` with exact event discriminators.

- [ ] In `settlement-domain.spec.ts`, cover at least one command/event for navigation, activity,
  routine, facility, First Ember, communication, conversation, and directive families. Assert event
  equality, state equality, hash equality, legal-action order, and immutable rejection.

- [ ] Retain the 250 randomized command paths and 10,000 survival histories in `property.spec.ts`.
  Change imports only; do not reduce run counts or relax invariants.

- [ ] Run settlement, replay, context, and property gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/settlement/settlement-domain.spec.ts \
    src/engine.spec.ts src/context.spec.ts src/property.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  pnpm --filter @summonlab/evaluation test -- src/evaluation.spec.ts
  ```

  Expected: all action ordering and Checkpoint A hashes remain exact.

- [ ] Commit the settlement extraction:

  ```bash
  git add packages/engine/src/domains/settlement packages/engine/src/engine.ts \
    packages/engine/src/engine.spec.ts packages/engine/src/property.spec.ts
  git commit -m "refactor(engine): extract settlement domain"
  ```

---

## Task 8: Extract Master control and mission lifecycle

**Files:**

- Create: `packages/engine/src/domains/mission/master-control.ts`
- Create: `packages/engine/src/domains/mission/lifecycle.ts`
- Create: `packages/engine/src/domains/mission/actions.ts`
- Create: `packages/engine/src/domains/mission/mission-control.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/context.ts`
- Modify: `packages/engine/src/engine.spec.ts`

**Interfaces:** `master-control.ts` exports pure timing/fallback/source selectors;
`lifecycle.ts` exports preparation/deployment/retreat/extraction validators and state derivations;
`actions.ts` exports ordered `missionLegalActions(state, actorId)` and
`missionTurnLegalActions(state, actorId)` with the existing public signature.

- [ ] Move Master timing thresholds, decision-window calculation, fallback validation/selection, and
  safety-stop helpers to `master-control.ts`. Keep embodied-Master and Town-Master paths distinct.

- [ ] Move mission prepare/revise/deploy/retreat/extract validation and state-derivation helpers to
  `lifecycle.ts`. Pass time, content, and entropy as explicit arguments already available to the
  caller; do not read ambient clock or randomness.

- [ ] Move mission-specific ordered legal-action generation to `actions.ts`, including normalized
  choices for preparation, deployment, turn, aftermath, retreat, and extraction.

- [ ] Update `context.ts` to import legal-action and timing owners directly. Confirm decision-context
  hashing and insertion-order normalization stay byte-identical.

- [ ] In `mission-control.spec.ts`, characterize both Master modes, boundary timestamps on every
  timeout, every fallback selection, safety-stop behavior, prepare/revise/deploy transitions, and
  exact action order. Reuse fixed clocks from existing engine/evaluation tests.

- [ ] Run timing/fallback, context, replay, and property gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/mission/mission-control.spec.ts src/context.spec.ts \
    src/engine.spec.ts src/property.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  pnpm --filter @summonlab/evaluation test -- \
    src/evaluation.spec.ts src/moderated-playtest.spec.ts
  pnpm validate:master-timing
  pnpm validate:master-fallback
  ```

  Expected: timing/fallback artifacts report no drift and all deterministic tests pass.

- [ ] Commit mission control and lifecycle:

  ```bash
  git add packages/engine/src/domains/mission packages/engine/src/engine.ts \
    packages/engine/src/context.ts packages/engine/src/engine.spec.ts
  git commit -m "refactor(engine): extract mission control"
  ```

---

## Task 9A: Extract mission combat and portal leaves

**Files:**

- Create: `packages/engine/src/domains/mission/monster-policy.ts`
- Create: `packages/engine/src/domains/mission/combat.ts`
- Create: `packages/engine/src/domains/mission/portal.ts`
- Create: `packages/engine/src/domains/mission/mission-runtime.spec.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/engine.spec.ts`
- Modify: `packages/engine/src/objectives.spec.ts`

**Interfaces:** `monster-policy.ts` exports deterministic intent/armor selectors; `combat.ts` exports
initiative and round-receipt derivation; `portal.ts` exports pressure/cargo/loss/aftermath/extraction
derivation. Inputs are parsed mission state plus explicit entropy draws; outputs are receipts or state
patches and never mutate inputs.

- [ ] Move monster intent/policy and armor calculation to `monster-policy.ts`; move initiative,
  targeting, attack, status, objective, and deterministic combat receipts to `combat.ts`; move Iron
  Moon pressure, portal condition, cargo, loss, aftermath, and extraction logic to `portal.ts`.

- [ ] In `mission-runtime.spec.ts`, cover initiative ties, armor, each attack target, monster action,
  objective completion/failure, portal pressure boundaries, cargo loss, party defeat, retreat,
  extraction, and aftermath. Compare full receipts, entropy traces, and state patches with pre-move
  characterization values.

- [ ] Run and commit the mission leaves:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/mission/mission-control.spec.ts \
    src/domains/mission/mission-runtime.spec.ts \
    src/engine.spec.ts src/objectives.spec.ts src/property.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  git add packages/engine/src/domains/mission packages/engine/src/engine.ts \
    packages/engine/src/engine.spec.ts packages/engine/src/objectives.spec.ts
  git commit -m "refactor(engine): extract mission combat leaves"
  ```

  Expected: all pure receipts, entropy traces, and replay hashes are unchanged.

---

## Task 9B: Extract mission command and reducer dispatch

**Files:**

- Create: `packages/engine/src/domains/mission/commands.ts`
- Create: `packages/engine/src/domains/mission/reducer.ts`
- Create: `packages/engine/src/orchestration/first-band-mission-reducer.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/engine.spec.ts`

**Interfaces:** Export typed `missionCommandHandler` and `missionEventReducer`, each with stable
`ownerId` and exact discriminator arrays. Export one orchestration-owned v23 composite reducer for
the mission/story extraction discriminator.

- [ ] Move all mission command legality/event construction to `commands.ts` and export
  `missionCommandHandler`. Preserve entropy-purpose strings and the order in which entropy values are
  requested.

- [ ] Move mission event reduction to `reducer.ts` and export `missionEventReducer`. Keep v11–v23
  branches visibly separated and parsed with their original payload schemas. Do not consolidate old
  branch bodies merely because their outputs currently agree.

- [ ] Preserve the v23 cross-domain extraction seam without a domain-to-domain import. Export the
  mission-state portion of the v23 extraction transition from `mission/reducer.ts` and the first-band
  story/archive consequence from `story/reducer.ts`. In `first-band-mission-reducer.ts`, apply those
  functions in their current order and expose one `EngineEventReducer`; it is the sole registry owner
  of the shared v23 event discriminator.

- [ ] Extend `mission-runtime.spec.ts` to assert command event equality, v11–v23 reduction equality,
  final hashes/action order, composite v23 extraction, and tamper rejection.

- [ ] Run the high-risk mission gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/domains/mission/mission-control.spec.ts \
    src/domains/mission/mission-runtime.spec.ts \
    src/engine.spec.ts src/objectives.spec.ts src/property.spec.ts \
    src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
  pnpm --filter @summonlab/evaluation test -- \
    src/evaluation.spec.ts src/moderated-playtest.spec.ts
  pnpm validate:attempt-aftermath
  pnpm validate:foundry-strategies
  ```

  Expected: v11–v23 vectors and all mission proof artifacts remain byte-identical. This completes
  Checkpoint C.

- [ ] Commit mission combat and reducers:

  ```bash
  git add packages/engine/src/domains/mission \
    packages/engine/src/orchestration/first-band-mission-reducer.ts \
    packages/engine/src/engine.ts packages/engine/src/engine.spec.ts
  git commit -m "refactor(engine): extract mission dispatch"
  ```

---

## Task 10: Introduce validated command and event registries

**Files:**

- Create: `packages/engine/src/orchestration/command-registry.ts`
- Create: `packages/engine/src/orchestration/event-registry.ts`
- Create: `packages/engine/src/orchestration/registries.spec.ts`
- Modify: `packages/engine/src/domains/settlement/commands.ts`
- Modify: `packages/engine/src/domains/settlement/reducer.ts`
- Modify: `packages/engine/src/domains/mission/commands.ts`
- Modify: `packages/engine/src/domains/mission/reducer.ts`
- Modify: `packages/engine/src/domains/story/commands.ts`
- Modify: `packages/engine/src/domains/story/reducer.ts`
- Modify: `packages/engine/src/domains/synthesis/commands.ts`
- Modify: `packages/engine/src/domains/synthesis/reducer.ts`
- Modify: `packages/engine/src/engine.ts`

- [ ] Import and use the interfaces defined in `core/types.ts`:

  ```ts
  export interface EngineCommandHandler<C extends EngineCommand = EngineCommand> {
    readonly ownerId: string;
    readonly commandTypes: readonly C['commandType'][];
    assertLegal(state: EngineGameState, command: C): void;
    buildEvent(state: EngineGameState, command: C): AuthoritativeEvent;
  }

  export interface EngineEventReducer {
    readonly ownerId: string;
    readonly eventTypes: readonly string[];
    reduce(state: EngineGameState, event: AuthoritativeEvent): EngineGameState;
  }
  ```

- [ ] Implement `createCommandRegistry(handlers)` and `createEventRegistry(reducers)` as ordered,
  immutable maps. Throw during construction on an empty discriminator list or duplicate owner and
  name both conflicting owners in the error. Compose the four domain command handlers, four domain
  reducers, and the v23 composite mission/story reducer in explicit source order.

- [ ] Add registry coverage tests that derive command discriminators from `EngineCommandSchema` and
  compare event ownership with the complete checked-in `MODERN_EVENT_TYPES` inventory from Task 1.
  Assert exactly one owner for every discriminator, no extra owner, and deterministic duplicate errors
  naming both `ownerId` values. Treat `run.initialized` and the three legacy-v1 events as explicit
  non-registry exceptions.

- [ ] Route modern command validation/event building and modern event reduction through registry
  lookup. Keep the v1 reducer as an explicit legacy path outside the modern registry. Preserve the
  exact unsupported-command and unsupported-event errors.

- [ ] Run registry, compatibility, engine, and database integration gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/orchestration/registries.spec.ts src/engine.spec.ts src/property.spec.ts \
    src/compatibility/public-api.spec.ts src/compatibility/replay-vectors.spec.ts \
    src/module-boundaries.spec.ts
  pnpm --filter @summonlab/database test
  pnpm --filter @summonlab/database test:integration
  ```

  Expected: ownership is total and unique, legacy replay still passes, and committed events are
  unchanged.

- [ ] Commit static dispatch:

  ```bash
  git add packages/engine/src/orchestration packages/engine/src/domains \
    packages/engine/src/engine.ts
  git commit -m "refactor(engine): add typed dispatch registries"
  ```

---

## Task 11: Extract ordered legal actions and policy translation

**Files:**

- Create: `packages/engine/src/orchestration/legal-actions.ts`
- Create: `packages/engine/src/orchestration/policy-commands.ts`
- Create: `packages/engine/src/orchestration/actions.spec.ts`
- Modify: `packages/engine/src/context.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/engine.spec.ts`

- [ ] Implement `legalActions(state)` as an explicit ordered composition of core, settlement,
  mission, story, and synthesis action arrays. Do not deduplicate through a map or set. Preserve
  `decisionLegalActions` filtering/order exactly.

- [ ] Move `missionTurnLegalActions` to the mission action owner and re-export it through
  orchestration/public facade. Preserve its public signature.

- [ ] Move `commandFromHeroPolicyResult` and related validated policy-result translation to
  `policy-commands.ts`. Keep schema parsing, selected-action lookup, and failure order intact.

- [ ] Update `context.ts` to import `decisionLegalActions` directly from orchestration and
  `hashGameState` directly from core, eliminating the facade cycle.

- [ ] In `actions.spec.ts`, use the Checkpoint A state table to compare entire action arrays, not only
  IDs. Cover a valid and invalid policy translation at every policy-controlled decision family and
  assert the exact existing error.

- [ ] Run action, context, policy, and observability gates:

  ```bash
  pnpm --filter @summonlab/engine test -- \
    src/orchestration/actions.spec.ts src/engine.spec.ts src/context.spec.ts \
    src/compatibility/public-api.spec.ts src/compatibility/replay-vectors.spec.ts
  pnpm --filter @summonlab/policies test
  pnpm --filter @summonlab/observability test
  pnpm --filter @summonlab/worker test
  ```

  Expected: action arrays and decision-context hashes are unchanged in every consumer.

- [ ] Commit action composition and policy translation:

  ```bash
  git add packages/engine/src/orchestration packages/engine/src/context.ts \
    packages/engine/src/engine.ts packages/engine/src/engine.spec.ts
  git commit -m "refactor(engine): extract actions and policy commands"
  ```

---

## Task 12: Extract bootstrap, apply, scheduling, and replay

**Files:**

- Create: `packages/engine/src/orchestration/bootstrap.ts`
- Create: `packages/engine/src/orchestration/apply-command.ts`
- Create: `packages/engine/src/orchestration/scheduling.ts`
- Create: `packages/engine/src/orchestration/replay.ts`
- Create: `packages/engine/src/orchestration/orchestration.spec.ts`
- Modify: `packages/engine/src/catch-up.ts`
- Modify: `packages/engine/src/simulation.ts`
- Replace contents: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] Move bootstrap state composition to `bootstrap.ts` and preserve content verification, default
  insertion, object-key construction order, initial version/hash, and initial schedule creation.

- [ ] Move schedule derivation, due/resolved/canceled selection, and schedule ID creation to
  `scheduling.ts`. Preserve ordering and ID/hash inputs.

- [ ] Move the command transaction to `apply-command.ts` in its exact current order: parse state,
  parse command, run `assertCommandIsLegal` (run-ID mismatch before stale version), select legacy or
  modern event construction, attach directive influences, reduce the draft, hash the parsed next
  state, parse the final `AuthoritativeEvent` with `afterStateHash`, then derive scheduled/resolved/
  canceled IDs and final legal actions. Do not catch/relabel existing errors.

- [ ] Move `replayEvents` and `replayEventsStrict` to `replay.ts`, retaining event order, hash-chain
  checks, schedule checks, and report/error shapes. Route reduction through the event registry.

- [ ] Update `catch-up.ts` and `simulation.ts` to import their direct orchestration owners.

- [ ] Replace `packages/engine/src/engine.ts` with an export-only compatibility facade re-exporting
  the public owners. Keep it at or below 250 lines. Keep `packages/engine/src/index.ts` exports stable.

- [ ] In `orchestration.spec.ts`, assert bootstrap equality, one successful command transaction,
  directive influence attachment, stale rejection, illegal rejection, reducer rejection, schedule
  creation/cancelation, final legal actions, byte replay, strict replay, and tampered replay. Add a
  command with both a wrong `runId` and stale `expectedVersion` and prove `IllegalActionError` still
  wins. Deep-freeze inputs to prove rejected operations do not mutate them.

- [ ] Run all engine and integration consumers:

  ```bash
  pnpm --filter @summonlab/engine lint
  pnpm --filter @summonlab/engine typecheck
  pnpm --filter @summonlab/engine test
  pnpm --filter @summonlab/engine build
  pnpm --filter @summonlab/database test
  pnpm --filter @summonlab/database test:integration
  pnpm --filter @summonlab/worker test
  pnpm --filter @summonlab/worker test:integration
  ```

  Expected: the entire engine suite and persistence/worker integration suite pass; public API snapshot
  is unchanged; facade is export-only. This completes Checkpoint D.

- [ ] Commit the orchestration facade:

  ```bash
  git add packages/engine/src/orchestration packages/engine/src/engine.ts \
    packages/engine/src/index.ts packages/engine/src/catch-up.ts \
    packages/engine/src/simulation.ts
  git commit -m "refactor(engine): complete orchestration facade"
  ```

---

## Task 13: Export capability predicates and remove duplicated version lists

**Files:**

- Modify: `packages/engine/src/core/versions.ts`
- Modify: `packages/engine/src/engine.ts`
- Modify: `packages/engine/src/compatibility/public-api.snapshot.ts`
- Modify: `packages/database/src/catch-up.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/communications/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/conversations/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/directives/+server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/mission/+server.ts`
- Modify: `apps/web/src/routes/mission/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/story-patch/+server.ts`
- Modify: `apps/web/src/routes/story-patch/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/synthesis/+server.ts`
- Modify: `apps/web/src/routes/synthesis/[runId]/+page.server.ts`
- Modify: `apps/web/src/routes/api/runs/[runId]/first-band-archive/+server.ts`
- Modify: `apps/web/src/routes/first-band-archive/[runId]/+page.server.ts`

- [ ] Find every duplicated engine-version list and classify it by capability:

  ```bash
  rg -n "schemaVersion.*(?:===|!==|includes)|\[(?:[0-9]+,?\s*){2,}\]" \
    packages/database apps/web
  ```

  Replace only lists that exactly equal one of the service predicates defined in Task 5. Leave true
  migration/schema handling and distinct product policies local. In particular,
  `packages/database/src/proof.ts` lists and the v13-only campaign projection guard do not match a
  service predicate and must remain local.

- [ ] Export the predicates through `@summonlab/engine` and add their names to the public API snapshot
  as the approved additive change.

- [ ] Replace exact duplicated checks in database catch-up and the listed web communication,
  conversation, directive, mission, story-patch, synthesis, and first-band archive routes. Call the
  predicate with the parsed state; do not pass an unvalidated database JSON value.

- [ ] Add or extend consumer tests so every predicate is evaluated against all schema versions 1–23,
  and each endpoint/service preserves its existing accepted membership and status/error payload.
  This explicitly tests the holes in directive and mission service support.

- [ ] Run engine, database, and web gates:

  ```bash
  pnpm --filter @summonlab/engine test
  pnpm --filter @summonlab/database lint
  pnpm --filter @summonlab/database typecheck
  pnpm --filter @summonlab/database test
  pnpm --filter @summonlab/database test:integration
  pnpm --filter @summonlab/web lint
  pnpm --filter @summonlab/web typecheck
  pnpm --filter @summonlab/web test
  ```

  Expected: only predicate names are added to the API snapshot; consumer responses and supported
  versions do not change. This completes Checkpoint E.

- [ ] Commit capability ownership:

  ```bash
  git add packages/engine packages/database/src apps/web/src
  git commit -m "refactor(engine): centralize version capabilities"
  ```

---

## Task 14: Update architecture ownership and agent handoffs

**Files:**

- Modify: `docs/system-architecture/system-map.md`
- Create: `docs/system-architecture/engine-module-ownership.md`
- Modify: `docs/superpowers/specs/2026-08-30-engine-modularization-design.md`

- [ ] Replace monolith debt notes in `system-map.md` with the new dependency layers and link the
  detailed ownership document.

- [ ] In `engine-module-ownership.md`, record for every module: owned state/commands/events, allowed
  imports, primary tests, and integration consumers. Include these future-agent handoff boundaries:

  - Engine kernel owner: contracts, core, registries, apply/replay; coordinates any schema/event change.
  - Settlement owner: `domains/settlement/**`; does not edit mission or orchestration.
  - Combat owner: mission monster policy/combat/portal plus mission-focused tests; requests shared
    lifecycle changes from the mission owner.
  - Mission lifecycle owner: lifecycle/actions/Master control; coordinates discriminator changes with
    the kernel owner.
  - Story owner: `domains/story/**` and story evaluation fixtures.
  - Synthesis owner: `domains/synthesis/**` and synthesis evaluation fixtures.
  - Frontend owner: web projections/components/routes; consumes engine APIs and never imports internal
    engine paths.

- [ ] Record the merge contract for every domain agent: baseline commit, files owned, public behavior
  changed or explicitly unchanged, tests run, golden hashes affected, migration needs, and follow-up
  risks. Require domain agents to rebase after kernel changes before editing commands/events.

- [ ] Mark the design spec implemented only after all prior checkpoint commands have passed.

- [ ] Validate documentation and source boundaries:

  ```bash
  pnpm validate:wiki
  test -f docs/system-architecture/system-map.md
  test -f docs/system-architecture/engine-module-ownership.md
  rg -n "engine-module-ownership\.md" docs/system-architecture/system-map.md
  rg -n "contracts|core|domains|orchestration" \
    docs/system-architecture/engine-module-ownership.md
  pnpm --filter @summonlab/engine test -- src/module-boundaries.spec.ts
  git diff --check
  ```

  Expected: the wiki validator passes, the new architecture files/link/module sections exist, the
  source boundary test passes, and Git reports no whitespace errors. `validate:wiki` validates
  `docs/wiki/**`; the explicit shell checks cover the new system-architecture document.

- [ ] Commit ownership documentation:

  ```bash
  git add docs/system-architecture docs/superpowers/specs
  git commit -m "docs(engine): record modular ownership"
  ```

---

## Task 15: Run the final repository gate and integrate

**Files:**

- No planned source changes. If a gate exposes refactor drift, fix it in the owning task's files and
  commit the smallest behavior-preserving correction before continuing.

- [ ] Confirm structural acceptance criteria:

  ```bash
  test "$(wc -l < packages/engine/src/engine.ts)" -le 250
  test "$(wc -l < packages/contracts/src/engine.ts)" -le 5
  ! rg -n "from ['\"].*engine\.js['\"]" \
    packages/engine/src --glob '!*.spec.ts' --glob '!engine.ts' --glob '!index.ts'
  pnpm --filter @summonlab/engine test -- \
    src/module-boundaries.spec.ts src/compatibility/public-api.spec.ts \
    src/compatibility/replay-vectors.spec.ts
  ```

  Expected: both facades meet their size limits, no internal facade imports exist, and all
  compatibility/boundary tests pass.

- [ ] Rebase on the latest integration baseline while the checkout is still sparse, then rerun the
  conflict-sensitive gates:

  ```bash
  git fetch origin main
  git rebase origin/main
  pnpm --filter @summonlab/contracts test
  pnpm --filter @summonlab/engine test
  pnpm --filter @summonlab/database test:integration
  pnpm --filter @summonlab/worker test:integration
  pnpm --filter @summonlab/web test
  git diff --check origin/main...HEAD
  ```

  Expected: rebase is clean and every engine consumer passes on the final history.

- [ ] After the focused sparse-checkout gates pass, materialize the full tree in the same feature
  worktree for asset-bound validators and final integration. This creates one temporary copy of the
  tracked assets, not one copy per agent:

  ```bash
  git sparse-checkout disable
  test -d assets
  git status --short
  ```

  Expected: `assets/` exists and the working tree remains clean.

- [ ] Run the complete repository gate in the now-full feature worktree:

  ```bash
  pnpm check
  pnpm test:integration
  pnpm test:e2e
  ```

  Expected: formatting, validators, lint, typecheck, unit/property/integration tests, builds, and
  browser tests all pass against the exact feature commit.

- [ ] Push the implementation branch and integrate it through the repository's normal review path:

  ```bash
  git push -u origin codex/engine-modularization
  ```

- [ ] After merge, use the full integration worktree to verify `main`, then remove only the completed
  sparse worktree:

  ```bash
  git -C /home/joao/Documents/summonlab pull --ff-only origin main
  git -C /home/joao/Documents/summonlab status --short
  pnpm db:stop
  git worktree remove ../summonlab-worktrees/engine
  git branch -d codex/engine-modularization
  ```

  Expected: `main` is clean at the merged commit and `git worktree list` shows only intentional
  worktrees. Do not remove the branch or worktree before the merge is confirmed.

---

## Git LFS follow-up boundary

Plan and execute Git LFS after this branch merges. The LFS migration should inventory tracked binary
extensions and CI/deployment support, choose pointer rules, migrate history only with explicit team
approval, and prove that a fresh clone plus sparse worktree can build the engine without downloading
unneeded assets. Keeping it separate prevents a storage/history rewrite from obscuring deterministic
engine diffs or invalidating the refactor's baseline hashes.
