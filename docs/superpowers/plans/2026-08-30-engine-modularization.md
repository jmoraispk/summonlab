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
- Checkout topology, sparse checkout, worktree lifecycle, asset storage, and Git LFS are outside this
  implementation. Do not add, remove, or reconfigure them while executing engine tasks.
- Never edit an old reducer branch to resemble a newer schema. Move each historical branch intact and
  keep its original payload parser.
- Keep `engine.ts` import-free from internal production code: after Task 12, no non-test module under
  `packages/engine/src/**` may import `./engine.js`, `../engine.js`, or `../../engine.js`.
  `catch-up.ts`, `context.ts`, and `simulation.ts` are recorded temporary exceptions until their
  direct orchestration imports land. Dedicated facade compatibility tests may import it as their
  subject.
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

## Task 0: Establish the execution baseline — completed

The implementation branch and pinned Node/pnpm dependencies were prepared before Task 1. This
historical task has no remaining action. Checkout topology, storage optimization, assets, and Git
LFS are intentionally excluded from the engine plan; later workers begin with the current branch and
verify only `git status --short --branch`, Node `v24.14.1`, and pnpm `10.33.0` before code work.

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

## Remaining execution baseline

Tasks 0–9A are complete. Commit cda462e68e57587ef47aa6390d952415a9bc0f75 is the frozen behavioral
code baseline; the plan-only scope revision follows it in history. Remaining tasks are code-only: do
not spend task time on checkout topology, sparse checkout, worktree management, assets, or Git LFS.

The dependency chain is strict:

1. Task 9B establishes mission command/event ownership.
2. Task 10 composes all domain owners in registries.
3. Task 11 extracts ordered action and policy orchestration.
4. Task 12 extracts bootstrap/apply/replay and finishes the facade.
5. Task 13 publishes already-tested capability predicates to consumers.
6. Task 14 records the resulting source ownership.
7. Task 15 verifies and integrates the code branch.

Tasks 9B–12 all edit packages/engine/src/engine.ts and must execute serially. Tasks 13 and 14 may be
implemented independently only after Task 12, but merge and review them one at a time so the public
API snapshot and architecture documentation remain attributable.

---

## Task 9B: Extract mission command and reducer dispatch

**Outcome:** Mission and Master-control commands/events have one domain owner. The first-band
mission/story seam is coordinated by orchestration without a mission-to-story import.

**Files:**

- Create: packages/engine/src/domains/mission/commands.ts
- Create: packages/engine/src/domains/mission/reducer.ts
- Create: packages/engine/src/orchestration/first-band-mission-reducer.ts
- Modify: packages/engine/src/engine.ts
- Modify: packages/engine/src/domains/mission/mission-runtime.spec.ts
- Read only: packages/engine/src/domains/story/reducer.ts
- Test: packages/engine/src/engine.spec.ts
- Test: packages/engine/src/compatibility/replay-vectors.spec.ts
- Test: packages/engine/src/module-boundaries.spec.ts

**Interfaces:**

- commands.ts exports MISSION_COMMAND_TYPES and missionCommandHandler.
- MISSION_COMMAND_TYPES contains exactly these twelve discriminators in source order:
  master.configure.timing, master.configure.fallback, master.apply.safety-stop,
  master.open.decision, mission.prepare, mission.revise.party, mission.cancel, mission.deploy,
  mission.resolve.turn, mission.open.extraction, mission.extract, mission.retreat.
- reducer.ts exports reduceMissionEvent(state, event), reduceFirstBandMissionTransition(state, event,
  reduceConsequences), MISSION_EVENT_TYPES, and missionEventReducer.
- MISSION_EVENT_TYPES contains only master.timing.changed, master.fallback.changed,
  master.safety.stopped, master.decision.opened, mission.round.resolved, and
  mission.extraction.opened.
- first-band-mission-reducer.ts exports FIRST_BAND_MISSION_EVENT_TYPES and
  firstBandMissionEventReducer. Its six owned transition discriminators are
  mission.preparation.started, mission.party.revised, mission.preparation.canceled,
  mission.deployed, mission.extracted, and mission.retreated.
- reduceConsequences has this local callback shape and introduces no story import in the mission
  domain:

~~~ts
type ReduceFirstBandMissionConsequences = (
  state: EngineGameStateV23,
  consequence: {
    readonly eventId: string;
    readonly sequence: number;
    readonly transition: 'prepare' | 'revise-party' | 'cancel' | 'deploy' | 'extract' | 'retreat';
    readonly mission: MissionRunStateV8;
    readonly bandStory: EngineGameStateV23['bandStory'];
    readonly firstBandArchive: EngineGameStateV23['firstBandArchive'];
  }
) => EngineGameStateV23;
~~~

- Global run-ID mismatch and stale-version checks remain outside missionCommandHandler so the existing
  IllegalActionError-before-StaleStateVersionError precedence remains unchanged.
- For v23 transition events, reduceFirstBandMissionTransition calls the consequence callback at the
  same point as the baseline: after parsing/precondition/version/type checks and expected mission
  derivation, but before mission-payload and entropy divergence checks.

- [ ] **Step 1: Add structural ownership tests that fail before extraction**

In mission-runtime.spec.ts, import the three new modules and assert the exact command/event arrays,
owner IDs mission and first-band-mission, and the absence of all six first-band transition types from
missionEventReducer.eventTypes. Add a duplicate-ownership union assertion:

~~~ts
expect([
  ...missionEventReducer.eventTypes,
  ...firstBandMissionEventReducer.eventTypes
]).toEqual([
  'master.timing.changed',
  'master.fallback.changed',
  'master.safety.stopped',
  'master.decision.opened',
  'mission.round.resolved',
  'mission.extraction.opened',
  'mission.preparation.started',
  'mission.party.revised',
  'mission.preparation.canceled',
  'mission.deployed',
  'mission.extracted',
  'mission.retreated'
]);
~~~

Run:

~~~bash
corepack pnpm --filter @summonlab/engine test --   src/domains/mission/mission-runtime.spec.ts
~~~

Expected: FAIL because commands.ts, reducer.ts, and first-band-mission-reducer.ts do not exist.

- [ ] **Step 2: Move mission-specific legality and event construction intact**

Move the four Master-control and eight mission domain preconditions plus their event-construction
branches from assertCommandIsLegal and buildV2Event into commands.ts. Reuse existing mission leaf
functions; do not copy their bodies. Keep global run/stale checks and complete ordered-action
authorization in the facade: EngineCommandHandler does not receive the cross-domain action list, and
the mission domain must not import orchestration to compute it. Preserve command branch order,
payload schema, eventBase inputs, deterministic IDs, entropy purposes, draw order, metadata, and exact
IllegalActionError calls. Export missionCommandHandler using EngineCommandHandler from core/types.ts.

- [ ] **Step 3: Move event reduction intact and introduce the callback seam**

Move Master-control and mission reducer branches from reduceV2Event into reducer.ts. Keep every
schema-version branch and payload parser visibly separate. Export reduceMissionEvent for composite
delegation. Move the six transition discriminators behind firstBandMissionEventReducer: it delegates
v2–v22 state to reduceMissionEvent and calls reduceFirstBandMissionTransition with
reduceFirstBandMissionConsequences for v23. No file under domains/mission may import domains/story.

- [ ] **Step 4: Freeze command, reducer, and v23 composite behavior**

Extend mission-runtime.spec.ts with fixed pre-cda462e fixtures for:

- all twelve command-to-event discriminators;
- reducer equality for every mission-capable version 11–20 and 23;
- complete v23 prepare, revise-party, cancel, deploy, retreat, and extraction state hashes;
- archive recovery/no-op assertions for every one of those six transitions;
- a tampered first-band story/archive consequence;
- a tampered mission payload;
- dual-tampered story/mission events for all six transitions proving story consequence divergence
  still wins before mission-payload or entropy divergence;
- immutable command, state, and event inputs.

Expected errors must assert class, message, sequence, and code where the class exposes a code. Reuse
the existing complete combat/portal fixtures; do not duplicate their 5,000-line leaf oracle.

- [ ] **Step 5: Route the facade through the new owners**

Replace only the extracted command/event branches in engine.ts with the new handlers. Leave global
run/stale checks, legacy-v1 reduction, registry construction, ordered legal actions, bootstrap,
apply, and replay in engine.ts for their owning later tasks.

- [ ] **Step 6: Run Task 9B gates**

~~~bash
corepack pnpm --filter @summonlab/engine test -- \
  src/domains/mission/mission-control.spec.ts \
  src/domains/mission/mission-runtime.spec.ts \
  src/engine.spec.ts src/objectives.spec.ts src/property.spec.ts \
  src/compatibility/replay-vectors.spec.ts src/module-boundaries.spec.ts
corepack pnpm --filter @summonlab/evaluation test -- \
  src/evaluation.spec.ts src/moderated-playtest.spec.ts
corepack pnpm validate:attempt-aftermath
corepack pnpm validate:foundry-strategies
corepack pnpm --filter @summonlab/engine lint
corepack pnpm --filter @summonlab/engine typecheck
~~~

Expected: all frozen events, state hashes, action order, proof artifacts, and 250/10,000 property
counts remain unchanged.

- [ ] **Step 7: Commit and push**

~~~bash
git add packages/engine/src/domains/mission \
  packages/engine/src/orchestration/first-band-mission-reducer.ts \
  packages/engine/src/engine.ts packages/engine/src/engine.spec.ts
git commit -m "refactor(engine): extract mission dispatch"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 10: Introduce validated command and event registries

**Outcome:** The engine has an executable, total, unique ownership map for every modern command and
event discriminator.

**Files:**

- Create: packages/engine/src/orchestration/command-registry.ts
- Create: packages/engine/src/orchestration/event-registry.ts
- Create: packages/engine/src/orchestration/registries.spec.ts
- Modify: packages/engine/src/engine.ts
- Read only unless a type-only correction is required:
  packages/engine/src/domains/{settlement,mission,story,synthesis}/{commands,reducer}.ts
- Test: packages/engine/src/compatibility/public-api.spec.ts
- Test: packages/engine/src/compatibility/replay-vectors.spec.ts
- Test: packages/engine/src/module-boundaries.spec.ts

**Interfaces:**

~~~ts
export interface EngineCommandRegistry {
  readonly ownerIds: readonly string[];
  readonly commandTypes: readonly EngineCommand['commandType'][];
  handlerFor(commandType: EngineCommand['commandType']): EngineCommandHandler;
}

export function createCommandRegistry(
  handlers: readonly EngineCommandHandler[]
): EngineCommandRegistry;

export interface EngineEventRegistry {
  readonly ownerIds: readonly string[];
  readonly eventTypes: readonly string[];
  reducerFor(eventType: string): EngineEventReducer | undefined;
}

export function createEventRegistry(
  reducers: readonly EngineEventReducer[]
): EngineEventRegistry;
~~~

Registry maps are private. Object.freeze(new Map()) is forbidden because it does not prevent set().
Construction rejects an empty discriminator array and duplicate discriminators. Duplicate errors
name the discriminator plus both conflicting ownerId values deterministically.

Composition order is explicit:

- Commands: settlement, mission, story, synthesis.
- Events: settlement, mission, first-band-mission, story, synthesis.
- run.initialized remains the only discriminator absent from the modern event registry.
- State schema v1 selects the legacy reducer before registry lookup. The three LEGACY_EVENT_TYPES
  intentionally overlap modern settlement-owned strings and therefore remain in MODERN_EVENT_TYPES.

- [ ] **Step 1: Write failing registry-construction tests**

Create registries.spec.ts. Assert private lookup behavior, source-order ownerIds, empty-list errors,
and exact duplicate messages such as:

~~~ts
expect(() => createEventRegistry([
  fakeReducer('alpha', ['mission.deployed']),
  fakeReducer('beta', ['mission.deployed'])
])).toThrow(
  'Event discriminator mission.deployed is owned by both alpha and beta'
);
~~~

Run the spec and expect module-not-found RED.

- [ ] **Step 2: Implement immutable lookup-only registries**

Build each private Map once inside its factory, expose frozen arrays copied from inputs, and expose
only handlerFor or reducerFor. handlerFor may throw only for a schema-valid command discriminator
missing from construction; reducerFor returns undefined so reduceParsedEvent can preserve the
existing unsupported-event wording and sequence.

- [ ] **Step 3: Add exhaustive ownership tests**

Derive command types from EngineCommandSchema. Compare event ownership exactly to
MODERN_EVENT_TYPES. Assert every modern discriminator appears exactly once, no registry extras exist,
run.initialized is absent, and all three known legacy strings are present under the settlement owner.
Do not require LEGACY_EVENT_TYPES to be disjoint and do not derive the expected inventory from replay
fixtures.

- [ ] **Step 4: Replace modern facade switches with registry lookup**

Construct the registries in explicit source order. Route event building and modern event reduction
through lookup. The existing orchestration authorization adapter may use registry lookup to select a
domain validator, but it retains command-specific placement of full ordered-action checks. Keep these
outside the registries:

- run-ID mismatch and stale-version checks;
- settlement's injected complete action IDs, first-band archive availability, Master-control action
  authorization, and mission-reservation/action precedence;
- the legacy-v1 event reducer and legacy event construction;
- run.initialized replay bootstrap handling;
- the exact unsupported-command/event error adapters;
- legal-action ordering and directive influence attachment.

- [ ] **Step 5: Prove behavior and boundaries**

~~~bash
corepack pnpm --filter @summonlab/engine test -- \
  src/orchestration/registries.spec.ts src/engine.spec.ts src/property.spec.ts \
  src/compatibility/public-api.spec.ts src/compatibility/replay-vectors.spec.ts \
  src/module-boundaries.spec.ts
corepack pnpm --filter @summonlab/engine lint
corepack pnpm --filter @summonlab/engine typecheck
corepack pnpm --filter @summonlab/contracts typecheck
git diff --check
~~~

Expected: registry ownership is total/unique; public exports, replay vectors, errors, and hashes are
unchanged; no domain imports orchestration or another domain.

- [ ] **Step 6: Commit and push**

~~~bash
git add packages/engine/src/orchestration   packages/engine/src/engine.ts packages/engine/src/domains
git commit -m "refactor(engine): add typed dispatch registries"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 11: Extract ordered legal actions and policy translation

**Outcome:** Cross-domain action ordering and policy-result translation are orchestration-owned, and
context.ts no longer imports the engine facade.

**Files:**

- Create: packages/engine/src/orchestration/legal-actions.ts
- Create: packages/engine/src/orchestration/command-authorization.ts
- Create: packages/engine/src/orchestration/policy-commands.ts
- Create: packages/engine/src/orchestration/actions.spec.ts
- Modify: packages/engine/src/context.ts
- Modify: packages/engine/src/engine.ts
- Test: packages/engine/src/context.spec.ts
- Test: packages/engine/src/compatibility/public-api.spec.ts
- Test: packages/engine/src/compatibility/replay-vectors.spec.ts

**Interfaces:**

~~~ts
export function legalActionsForParsedState(
  state: EngineGameState,
  actorId: string
): readonly LegalAction[];

export function legalActions(
  stateInput: EngineGameState,
  actorId: string
): readonly LegalAction[];

export function decisionLegalActions(
  stateInput: EngineGameState,
  actorId: string
): readonly LegalAction[];

export function assertCommandIsLegal(
  state: EngineGameState,
  command: EngineCommand
): void;

export function commandFromHeroPolicyResult(input: {
  readonly state: EngineGameState;
  readonly packet: HeroDecisionPacket;
  readonly result: HeroPolicyResult;
  readonly decisionJobId: string;
}): EngineCommand;
~~~

missionTurnLegalActions already belongs to domains/mission/actions.ts and is not moved again.
Action composition preserves the existing branch-sensitive ordering and early returns; it must not
deduplicate or sort with a Set or Map.

command-authorization.ts is the compatibility adapter between global ordered actions and domain
handlers. It owns envelope precedence and the points at which complete action IDs are checked; domain
handlers own their state-specific command rules and never import legal-actions.ts.

- [ ] **Step 1: Write independent action-array and policy RED tests**

In actions.spec.ts, use Checkpoint A states for all versions 1–23 and compare complete LegalAction
objects, not only IDs. Include Master, active hero, terminal hero, mission-reserved hero, v21 story,
v22 synthesis rumor, and v23 first-band archive cases. Add fixed invalid policy cases for packet hash,
result hash, stale world binding, stale legal-action hash, missing action, and invalid targets; assert
the existing error messages and IllegalActionError fields. Add direct authorization cases proving:

- wrong run ID wins over a stale expected version;
- settlement receives the complete composed action IDs rather than settlement-only actions;
- a mission-reserved actor cannot use a suppressed settlement action;
- Master-control commands retain their current action/source/error precedence;
- story.reveal.first.archive still requires both story-domain validity and complete-composer
  availability.

Run the spec and expect module-not-found RED.

- [ ] **Step 2: Move legal action composition intact**

Move action(), masterActionsV2(), heroActionsV2(), legalActionsForParsedState(), legalActions(), and
decisionLegalActions() plus orchestration-only private helpers to legal-actions.ts. Import domain
action providers; do not move domain rules into orchestration. Preserve Master-first dispatch,
mission reservation suppression, story/synthesis short-circuits, settlement tail ordering, and
expanded travel replacement order.

- [ ] **Step 3: Move orchestration command authorization intact**

Move requiredAction() and assertCommandIsLegal() to command-authorization.ts after legal-actions.ts
exists. Keep the current command-specific ordering rather than replacing it with a generic
handler.assertLegal followed by one membership check. In particular, inject complete action IDs into
assertSettlementCommandLegalWithActionIds, retain the first-band archive check after story-domain
validation, and preserve the early-return behavior of synthesis and mission/Master-control branches.
Use the command registry only to locate the owning domain handler; do not change the
EngineCommandHandler signature or make a domain import orchestration.

- [ ] **Step 4: Move policy translation intact**

Move boundedDecisionText(), commandFromHeroPolicyResult(), and its private validated translation
helpers to policy-commands.ts. Preserve validation order:

1. parse state, packet, and result;
2. validate packet/result hashes and current-state bindings;
3. validate the current legal-action hash;
4. locate the selected action and validate targets;
5. derive deterministic command/correlation IDs;
6. translate the selected action without broadening the legal set.

- [ ] **Step 5: Remove the context facade import**

Change context.ts to import decisionLegalActions from orchestration/legal-actions.ts and continue
importing hashGameState from core/state.ts. Engine.ts re-exports the public functions without wrapping
or changing their signatures.

- [ ] **Step 6: Run action and direct-consumer gates**

~~~bash
corepack pnpm --filter @summonlab/engine test -- \
  src/orchestration/actions.spec.ts src/engine.spec.ts src/context.spec.ts \
  src/compatibility/public-api.spec.ts src/compatibility/replay-vectors.spec.ts
corepack pnpm --filter @summonlab/policies test
corepack pnpm --filter @summonlab/observability test
corepack pnpm --filter @summonlab/worker test
corepack pnpm --filter @summonlab/engine lint
corepack pnpm --filter @summonlab/engine typecheck
git diff --check
~~~

Expected: all action arrays, decision packets, policy errors, and public exports remain unchanged;
context.ts has no engine.js import.

- [ ] **Step 7: Commit and push**

~~~bash
git add packages/engine/src/orchestration packages/engine/src/context.ts \
  packages/engine/src/engine.ts packages/engine/src/engine.spec.ts
git commit -m "refactor(engine): extract actions and policy commands"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 12: Extract bootstrap, apply, event outputs, and replay

**Outcome:** packages/engine/src/engine.ts becomes an export-only compatibility facade of at most 250
lines, and no internal production module imports it.

**Files:**

- Create: packages/engine/src/orchestration/bootstrap.ts
- Create: packages/engine/src/orchestration/apply-command.ts
- Create: packages/engine/src/orchestration/event-outputs.ts
- Create: packages/engine/src/orchestration/reduction.ts
- Create: packages/engine/src/orchestration/replay.ts
- Create: packages/engine/src/orchestration/orchestration.spec.ts
- Modify: packages/engine/src/catch-up.ts
- Modify: packages/engine/src/simulation.ts
- Replace contents: packages/engine/src/engine.ts
- Test: packages/engine/src/engine.spec.ts
- Test: packages/engine/src/module-boundaries.spec.ts
- Test: packages/engine/src/compatibility/public-api.spec.ts
- Test: packages/engine/src/compatibility/replay-vectors.spec.ts

**Interfaces:**

~~~ts
export function createBootstrapEngine(
  input: BootstrapEngineInput
): BootstrapEngineResult;

export function applyCommand(
  stateInput: EngineGameState,
  commandInput: EngineCommand
): EngineApplyResult;

export function scheduledEventsFromEvent(
  event: AuthoritativeEvent
): readonly ScheduledEvent[];

export function resolvedScheduledEventIdsFromEvent(
  event: AuthoritativeEvent
): readonly string[];

export function canceledScheduledEventIdsFromEvent(
  event: AuthoritativeEvent
): readonly string[];

export function reduceEvent(
  stateInput: EngineGameState,
  eventInput: AuthoritativeEvent
): EngineGameState;

export function replayEvents(
  eventInputs: readonly AuthoritativeEvent[]
): ReplayResult;

export function replayEventsStrict(
  eventInputs: readonly AuthoritativeEvent[]
): ReplayResult;
~~~

event-outputs.ts only decodes event payload/metadata. Domain code continues to create schedule IDs and
own due/cancel semantics; Task 12 must not centralize those rules.

- [ ] **Step 1: Write orchestration transaction RED tests**

Create orchestration.spec.ts with fixed expected bootstrap snapshot/event hashes and a complete
successful apply result. Add cases for directive influence attachment, scheduled/resolved/canceled
outputs, illegal action, stale version, reducer tamper, replay hash tamper, and frozen inputs. Add one
command with both a wrong runId and stale expectedVersion and assert IllegalActionError wins.

Run the spec and expect the five new orchestration modules to be missing.

- [ ] **Step 2: Move bootstrap without reconstructing objects**

Move bootstrap state/event composition to bootstrap.ts. Preserve schema selection, content
verification, defaults, object-key insertion order, initial schedule creation, EMPTY_STATE_HASH,
initial version/event cursor, entropy cursor, and final schema parsing. Compare the complete snapshot
and bootstrap event to the frozen test before deleting the originals.

- [ ] **Step 3: Move event-output decoding**

Move scheduledEventsFromEvent, resolvedScheduledEventIdsFromEvent, and
canceledScheduledEventIdsFromEvent to event-outputs.ts. Do not move settlement/directive schedule ID
construction, earliest-due selection, or cancellation policy out of their domains.

- [ ] **Step 4: Move applyCommand in exact transaction order**

Implement apply-command.ts by moving, not rewriting, the transaction. The order is contractual:

1. parse state;
2. parse command;
3. call command-authorization.ts, which checks run-ID mismatch, then stale version, then the existing
   domain/action authorization sequence;
4. select legacy construction or the command registry owner;
5. attach directive influences;
6. reduce the draft through legacy reduction or the event registry;
7. hash the parsed next state;
8. parse the final AuthoritativeEvent with afterStateHash;
9. decode scheduled/resolved/canceled outputs;
10. calculate final legal actions for the command actor.

Do not catch, wrap, or relabel errors.

- [ ] **Step 5: Move reduction and replay while preserving report shapes**

Move legacy reduction, modern registry dispatch, directive-influence reduction, and the public
reduceEvent wrapper to reduction.ts. Move replayCheck(), replayEvents(), and replayEventsStrict() to
replay.ts. Preserve bootstrap sequence/type validation, EMPTY_STATE_HASH handling, event order,
before/after state hashes, entropy/delta summaries, ReplayIntegrityError messages and sequences, and
the strict function's first-failed-check behavior. apply-command.ts and replay.ts both call the same
reduction owner; neither copies legacy or modern reducer dispatch.

- [ ] **Step 6: Finish the facade and direct internal imports**

Replace engine.ts with the explicit compatibility export map below. Do not use broad export-star
statements from internal owner modules because those could expose private helpers or version arrays.

- From core/versions.ts: every existing named content-version constant plus ENGINE_EPOCH and
  ENGINE_INVARIANTS; Task 13 adds only the eight capability predicates.
- From core/state.ts: hashGameState.
- From core/types.ts: BootstrapAdditionalHeroInput, BootstrapEngineInput, BootstrapEngineResult,
  EngineApplyResult, ReplayCheck, and ReplayResult as types.
- From domains/story/runtime.ts: storyPatchCastForState and validateStoryPatchForState.
- From domains/settlement/routines.ts: resolveDailyRoutine.
- From domains/mission/actions.ts: missionTurnLegalActions.
- From domains/mission/master-control.ts: isIrreversibleMasterAction, masterFallbackActionSource,
  masterFallbackMissionChoice, masterFallbackSafetySource, and selectMasterFallback.
- From domains/mission/monster-policy.ts: monsterArmorReduction, resolveMonsterPolicyIntent, and the
  MonsterIntentScenario type.
- From orchestration/legal-actions.ts: legalActions and decisionLegalActions.
- From orchestration/policy-commands.ts: commandFromHeroPolicyResult.
- From orchestration/bootstrap.ts: createBootstrapEngine.
- From orchestration/apply-command.ts: applyCommand.
- From orchestration/reduction.ts: reduceEvent.
- From orchestration/event-outputs.ts: scheduledEventsFromEvent,
  resolvedScheduledEventIdsFromEvent, and canceledScheduledEventIdsFromEvent.
- From orchestration/replay.ts: replayEvents and replayEventsStrict.

The compatibility runtime snapshot and compatibility/public-types.ts are the acceptance authority;
every pre-Task-13 name/type remains present and no unapproved internal symbol becomes public. Update:

- catch-up.ts to import applyCommand and legalActions from their orchestration owners;
- simulation.ts to import createBootstrapEngine, applyCommand, legalActions, and replayEventsStrict
  from their orchestration owners.

Remove all temporary facade-import exceptions from module-boundaries.spec.ts.

- [ ] **Step 7: Run structural and consumer gates**

~~~bash
test "$(wc -l < packages/engine/src/engine.ts)" -le 250
! rg -n "from ['\"].*engine\.js['\"]"   packages/engine/src --glob '!*.spec.ts' --glob '!engine.ts' --glob '!index.ts'
corepack pnpm --filter @summonlab/engine lint
corepack pnpm --filter @summonlab/engine typecheck
corepack pnpm --filter @summonlab/engine test
corepack pnpm --filter @summonlab/engine build
corepack pnpm --filter @summonlab/database test
corepack pnpm --filter @summonlab/worker test
corepack pnpm --filter @summonlab/policies test
corepack pnpm --filter @summonlab/observability test
git diff --check
~~~

Expected: facade at most 250 lines, no internal facade imports, public API/replay snapshots unchanged,
and engine plus hermetic consumers pass.

- [ ] **Step 8: Commit and push**

~~~bash
git add packages/engine/src/orchestration packages/engine/src/engine.ts \
  packages/engine/src/catch-up.ts packages/engine/src/simulation.ts \
  packages/engine/src/module-boundaries.spec.ts
git commit -m "refactor(engine): complete orchestration facade"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 13: Publish capability predicates and remove exact consumer duplicates

**Outcome:** Service-version membership has one tested owner without moving distinct migration or
product policies into the engine.

**Files:**

- Modify: packages/engine/src/engine.ts
- Modify: packages/engine/src/compatibility/public-api.snapshot.ts
- Test: packages/engine/src/core/core.spec.ts
- Modify: packages/database/src/catch-up.ts
- Modify: apps/web/src/routes/api/runs/[runId]/communications/+server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/conversations/+server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/directives/+server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/mission/+server.ts
- Modify: apps/web/src/routes/mission/[runId]/+page.server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/story-patch/+server.ts
- Modify: apps/web/src/routes/story-patch/[runId]/+page.server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/synthesis/+server.ts
- Modify: apps/web/src/routes/synthesis/[runId]/+page.server.ts
- Modify: apps/web/src/routes/api/runs/[runId]/first-band-archive/+server.ts
- Modify: apps/web/src/routes/first-band-archive/[runId]/+page.server.ts

**Public additive exports:**

- supportsCatchUp
- supportsCommunicationApi
- supportsConversationApi
- supportsDirectivesApi
- supportsMissionApi
- supportsStoryPatchApi
- supportsSynthesisApi
- supportsFirstBandArchiveApi

The arrays behind these predicates remain internal to core/versions.ts. Predicates accept a parsed
EngineGameState and remain exhaustive type guards. First Ember checks, v13 campaign projection,
database proof/migration lists, Master timing subfeatures, and post-commit schema assertions remain
local because they express different policies.

- [ ] **Step 1: Add the approved public API RED**

Add the eight names to ENGINE_PUBLIC_RUNTIME_EXPORTS in public-api.snapshot.ts before exporting them.
Keep core.spec.ts's all-versions 1–23 membership table as the authoritative behavior test.

Run:

~~~bash
corepack pnpm --filter @summonlab/engine test --   src/core/core.spec.ts src/compatibility/public-api.spec.ts
~~~

Expected: FAIL because the facade does not yet export the eight predicates.

- [ ] **Step 2: Export only the predicates**

Re-export the eight predicate functions through engine.ts and update the frozen runtime API snapshot.
Do not export the version arrays or includesVersion helper.

- [ ] **Step 3: Replace exact duplicate consumer checks**

In each listed database/web file, call the matching predicate only after the snapshot state has been
parsed as EngineGameState. Replace complete service-membership guards, not schema-specific branches
that narrow fields or select behavior. Preserve HTTP status codes, response bodies, logging, fallback
selection, and post-commit assertions.

- [ ] **Step 4: Prove no intended duplicate membership list remains**

Run the focused search and manually classify every remaining match:

~~~bash
rg -n "schemaVersion.*(?:===|!==|includes)|\[(?:[0-9]+,?\s*){2,}\]"   packages/database/src apps/web/src
~~~

Expected remaining categories: migrations/proofs, v13 campaign projection, First Ember, Master
timing/fallback subfeatures, test fixtures, and unrelated numeric arrays.

- [ ] **Step 5: Run engine and consumer gates**

~~~bash
corepack pnpm --filter @summonlab/engine test
corepack pnpm --filter @summonlab/database lint
corepack pnpm --filter @summonlab/database typecheck
corepack pnpm --filter @summonlab/database test
corepack pnpm --filter @summonlab/web lint
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web test
git diff --check
~~~

Expected: only the eight predicate names are added to the public API; version membership and consumer
status/error payloads are unchanged.

- [ ] **Step 6: Commit and push**

~~~bash
git add packages/engine packages/database/src/catch-up.ts apps/web/src
git commit -m "refactor(engine): centralize version capabilities"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 14: Record technical module ownership

**Outcome:** Future code changes can be assigned by source boundary without documenting checkout or
agent-process mechanics.

**Files:**

- Modify: docs/system-architecture/system-map.md
- Create: docs/system-architecture/engine-module-ownership.md
- Modify: docs/superpowers/specs/2026-08-30-engine-modularization-design.md

**Required ownership sections:**

- contracts/engine: schemas, state unions, command/runtime contracts, compatibility facade;
- engine/core: deterministic state/hash/event metadata, type ports, capability predicates;
- engine/domains/settlement;
- engine/domains/mission, with separate combat/portal and lifecycle/Master-control subsections;
- engine/domains/story;
- engine/domains/synthesis;
- engine/orchestration: registries, composite seams, actions/policy, bootstrap/apply/replay;
- public facade and direct consumers.

For each top-level boundary, document owned commands/events/state, allowed imports, forbidden
imports, primary focused tests, and integration consumers. Registries are the executable
discriminator authority; do not duplicate exhaustive per-file inventories in prose.

- [ ] **Step 1: Replace stale monolith documentation**

Update system-map.md to describe contracts → core → domains → orchestration → facade/consumers and
link engine-module-ownership.md. Replace old 13,000/4,500-line metrics with the final measured values.

- [ ] **Step 2: Write the ownership document**

Document the required sections and these coordination rules:

- kernel changes coordinate schema, discriminator, registry, apply, or replay changes;
- a domain change stays inside its domain unless it changes a public contract;
- combat changes use mission combat/monster-policy/portal tests and coordinate lifecycle changes;
- frontend consumes @summonlab/engine and never imports package-internal engine paths;
- every handoff states behavior changed or unchanged, tests run, golden hashes changed, and migration
  needs.

Do not mention sparse checkout, worktree creation/removal, asset storage, Git LFS, or branch choreography.

- [ ] **Step 3: Mark the design implemented**

Update the design spec status only after Tasks 9B–13 gates have passed. Record the final facade sizes
and link the ownership document. Keep checkout/storage concerns explicitly out of scope.

- [ ] **Step 4: Validate documentation and source boundaries**

~~~bash
test -f docs/system-architecture/engine-module-ownership.md
rg -n "engine-module-ownership\.md" docs/system-architecture/system-map.md
rg -n "contracts|core|domains|orchestration"   docs/system-architecture/engine-module-ownership.md
! rg -ni "sparse checkout|git lfs|worktree"   docs/system-architecture/engine-module-ownership.md
corepack pnpm --filter @summonlab/engine test -- src/module-boundaries.spec.ts
git diff --check
~~~

Expected: the architecture link and four layers exist, process/storage topics are absent, and source
boundaries pass.

- [ ] **Step 5: Commit and push**

~~~bash
git add docs/system-architecture docs/superpowers/specs
git commit -m "docs(engine): record modular ownership"
git push origin HEAD:codex/engine-modularization
~~~

---

## Task 15: Run the code-focused final gate and prepare integration

**Outcome:** The feature branch is compatibility-clean, consumer-tested, current with main, pushed,
and ready for the repository's normal review/merge path.

**Files:**

- No planned source changes.
- If a gate exposes drift, fix the smallest owning module, add a regression test, commit that fix, and
  repeat the complete affected gate before continuing.

- [ ] **Step 1: Confirm structural acceptance**

~~~bash
test "$(wc -l < packages/engine/src/engine.ts)" -le 250
test "$(wc -l < packages/contracts/src/engine.ts)" -le 5
! rg -n "from ['\"].*engine\.js['\"]"   packages/engine/src --glob '!*.spec.ts' --glob '!engine.ts' --glob '!index.ts'
corepack pnpm --filter @summonlab/engine test -- \
  src/orchestration/registries.spec.ts \
  src/orchestration/actions.spec.ts \
  src/orchestration/orchestration.spec.ts \
  src/module-boundaries.spec.ts \
  src/compatibility/public-api.spec.ts \
  src/compatibility/replay-vectors.spec.ts
~~~

Expected: both facades meet limits, no internal facade import remains, registry ownership is total,
and compatibility tests pass.

- [ ] **Step 2: Run all hermetic engine and direct-consumer gates**

~~~bash
corepack pnpm --filter @summonlab/contracts lint
corepack pnpm --filter @summonlab/contracts typecheck
corepack pnpm --filter @summonlab/contracts test
corepack pnpm --filter @summonlab/contracts build
corepack pnpm --filter @summonlab/engine lint
corepack pnpm --filter @summonlab/engine typecheck
corepack pnpm --filter @summonlab/engine test
corepack pnpm --filter @summonlab/engine build
corepack pnpm --filter @summonlab/evaluation lint
corepack pnpm --filter @summonlab/evaluation typecheck
corepack pnpm --filter @summonlab/evaluation test
corepack pnpm --filter @summonlab/database lint
corepack pnpm --filter @summonlab/database typecheck
corepack pnpm --filter @summonlab/database test
corepack pnpm --filter @summonlab/database build
corepack pnpm --filter @summonlab/worker lint
corepack pnpm --filter @summonlab/worker typecheck
corepack pnpm --filter @summonlab/worker test
corepack pnpm --filter @summonlab/worker build
corepack pnpm --filter @summonlab/web lint
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web test
corepack pnpm --filter @summonlab/policies test
corepack pnpm --filter @summonlab/observability test
corepack pnpm validate:attempt-aftermath
corepack pnpm validate:foundry-strategies
git diff --check
~~~

Expected: every code package directly affected by engine public behavior passes. Root asset/visual
validators and unrelated browser suites are not part of this engine refactor.

- [ ] **Step 3: Run database-backed gates when the repository test database is available**

Do not add or modify infrastructure in this task. If TEST_DATABASE_URL is configured, run:

~~~bash
corepack pnpm --filter @summonlab/database test:integration
corepack pnpm --filter @summonlab/worker test:integration
~~~

If no test database is available, record both commands as environmental pending in the final handoff;
do not report them as passing and do not block completion of the hermetic code gate.

- [ ] **Step 4: Rebase on the current integration baseline**

~~~bash
git status --short
git fetch origin main
git rebase origin/main
git diff --check origin/main...HEAD
~~~

Expected: the tree is clean and the rebase completes. Resolve conflicts only in files owned by this
plan, then rerun Steps 1–3.

- [ ] **Step 5: Push the reviewed branch**

~~~bash
git push --force-with-lease origin HEAD:codex/engine-modularization
git status --short --branch
git rev-parse HEAD
git rev-parse origin/codex/engine-modularization
~~~

Expected: local and remote hashes match and the working tree is clean. Integration into main happens
through the repository's normal review/merge path; this plan performs no checkout cleanup, asset
migration, storage migration, or branch deletion.
