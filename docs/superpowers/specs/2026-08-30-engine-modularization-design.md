# Engine Modularization Design

Status: **approved for implementation planning**

Date: 2026-08-30

## Purpose

Modularize the existing deterministic engine and its engine-specific contract schemas so several
domain owners can work without converging on `packages/engine/src/engine.ts` and
`packages/contracts/src/engine.ts`.

The refactor is behavior-preserving. It changes ownership and dependency structure, not game rules.
Every existing command, event, state, hash, replay result, legal-action order, projection, error,
and public import must retain its current meaning.

## Current problem

The runtime engine file is approximately 13,450 lines and currently owns all of these concerns:

- engine content versions and invariants;
- bootstrap and content binding;
- settlement travel, facilities, activities, routines, and First Ember behavior;
- communication, conversation, directives, and society consequences;
- mission preparation, deployment, turn resolution, combat, portals, aftermath, and extraction;
- Master timing and fallback policy;
- story patches, synthesis, and the first-band archive;
- legal-action composition and policy-result translation;
- command legality, event construction, event reduction, scheduling, application, and replay.

The engine contract file is approximately 4,550 lines and composes state schemas v1 through v23,
commands, scheduling, snapshots, replay reports, and errors. Both files are identified as current
integration debt in `docs/system-architecture/system-map.md`.

## Goals

1. Preserve byte-stable replay and hash behavior for engine schemas v1 through v23.
2. Preserve the public `@summonlab/engine` and `@summonlab/contracts` entrypoints.
3. Split runtime behavior into kernel, domain, and orchestration modules with one-way dependencies.
4. Split engine-specific schemas into composable contract modules behind the current barrel.
5. Make command and event ownership explicit and reject duplicate handler registration.
6. Centralize engine-version capability knowledge now duplicated in database and web consumers.
7. Leave a small compatibility facade in `packages/engine/src/engine.ts`.
8. Establish merge checkpoints after which settlement, mission/combat, story, synthesis, and
   presentation work can proceed in parallel.

## Non-goals

- No new engine schema or content version.
- No migration of existing state or event streams.
- No change to the embodied-Master versus Town-Master product rules.
- No new combat, progression, party, economy, or Living Village mechanics.
- No database migration.
- No change to policy packet, projection, journal, recap, or error shapes.
- No broad rewrite into classes, dependency injection, ECS, actors, plugins, or microservices.
- No asset, Git LFS, or worktree tooling change in the same implementation branch.

## Frozen compatibility surface

The following behavior is immutable during this refactor:

- `EngineGameStateSchema` accepts exactly schema versions 1 through 23.
- `EngineCommandSchema` accepts the same command discriminators and request shapes.
- All existing event type strings and payload schemas retain their current bytes and semantics.
- `canonicalJson`, `hashCanonical`, `hashGameState`, and entropy purpose strings remain unchanged.
- `applyCommand` retains its exact transaction order: parse state, parse command, run ID/legality and
  stale-version checks in their current precedence, build the versioned event, attach directive
  influences, reduce, hash state, parse the final authoritative event, derive schedule effects, and
  calculate final legal actions.
- `replayEvents` and `replayEventsStrict` retain event order and integrity checks.
- Legal actions retain their current ordering as well as their values; action order participates in
  downstream hashes.
- Existing errors remain instances of the same exported classes with the same codes/messages.
- Existing package exports remain available from the same package entrypoints.

The implementation adds characterization evidence before moving behavior. Missing minimal replay
vectors for v5, v8, v14, and v15 through v23 are added to the compatibility suite before the
relevant reducer branches move.

## Target contract structure

`packages/contracts/src/engine.ts` remains a compatibility barrel. Engine-specific schema ownership
moves under `packages/contracts/src/engine/`:

```text
packages/contracts/src/
  engine.ts                         compatibility re-export
  engine/
    base-state.ts                   v1 actors, needs, resources, activity primitives
    settlement-state.ts             travel, facilities, routines, First Ember, society bindings
    mission-state.ts                mission, combat, portal, aftermath, attempt schemas
    master-control.ts               timing, fallback configuration, decisions, safety stops
    story-synthesis-state.ts        story patch/archive and synthesis state
    game-state.ts                   composed EngineGameStateV1..V23 and discriminated union
    commands.ts                     engine command and request schemas
    runtime.ts                      entropy, schedule, clock, snapshot, commit, replay, errors
    index.ts                        internal engine-contract barrel
```

Existing imports from `@summonlab/contracts` do not change. `packages/contracts/src/engine.ts`
re-exports `./engine/index.js`, and the root contracts barrel continues to re-export
`./engine.js`.

## Target runtime structure

```text
packages/engine/src/
  engine.ts                         public compatibility facade only
  core/
    versions.ts                     versions, invariant constants, capability predicates
    types.ts                        shared runtime and domain-dispatch interfaces
    state.ts                        parsing and state hashing helpers
    content-bindings.ts             verified immutable content lookup
    event-metadata.ts               common event envelope and metadata helpers
  domains/
    settlement/
      navigation.ts                 route, travel, occupancy, facility capacity
      routines.ts                   planning, routine and activity outcomes
      society.ts                    communication, conversation, directives, First Ember society
      actions.ts                    settlement legal actions
      commands.ts                   settlement legality and event creation
      reducer.ts                    settlement event application
    mission/
      lifecycle.ts                  prepare, revise, deploy, retreat, extract
      actions.ts                    mission legal actions and normalized choices
      monster-policy.ts             monster intents and armor calculation
      combat.ts                     initiative and deterministic combat turn receipts
      portal.ts                     Iron Moon pressure, cargo, loss and extraction
      master-control.ts             timing, fallback selection and safety stops
      commands.ts                   mission legality and event creation
      reducer.ts                    mission v11-v23 event application
    story/
      runtime.ts                    patch cast, validation and application support
      archive.ts                    first-band extraction/archive reveal behavior
      commands.ts                   story command legality and event creation
      reducer.ts                    story v21/v23 event application
    synthesis/
      runtime.ts                    receipt, relationship and rumor calculations
      commands.ts                   synthesis legality and event creation
      reducer.ts                    synthesis v22 event application
  orchestration/
    bootstrap.ts                    composes initial versioned state
    legal-actions.ts                preserves ordered action composition
    policy-commands.ts              converts validated policy results to commands
    command-registry.ts             exact commandType-to-handler ownership
    event-registry.ts               exact eventType-to-reducer ownership
    apply-command.ts                public command transaction
    scheduling.ts                   due/resolved/canceled schedule derivation
    replay.ts                       public replay and strict replay
```

Existing `context.ts`, `catch-up.ts`, `simulation.ts`, projections, journal, recap, story validator,
hash, entropy, errors, and time helpers stay in place. Their imports change from the compatibility
facade to the owning internal module when necessary to prevent cycles.

## Dependency rules

```text
contracts + content + hash/entropy/time/errors
                     │
                     ▼
                   core
                     │
                     ▼
             domain leaf modules
                     │
                     ▼
                orchestration
                     │
                     ▼
          public engine compatibility facade
```

- `core/**` must not import from `domains/**`, `orchestration/**`, database, web, worker, policies,
  or evaluation.
- A domain may import `core/**`, existing deterministic helpers, contracts, and content.
- A domain must not import another domain's barrel. Cross-domain facts travel through state and
  explicit helper inputs owned by `core/types.ts`.
- `orchestration/**` may compose domains, but domain modules must not import orchestration.
- `engine.ts` contains exports only and is never imported by internal production modules. Dedicated
  compatibility tests may import the facade as their subject.
- Database, worker, web, policy, and evaluation packages continue importing the public package.

A source-level boundary test enforces these rules without adding a new production dependency.

## Explicit dispatch instead of a plugin framework

The refactor uses typed registries, but it does not introduce runtime plugin discovery. Registries
are statically composed from known domain handlers and validated for duplicate ownership.

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

Command and event lookup tables are built once from ordered static arrays. Registration rejects a
duplicate discriminator. Legacy v1 reduction remains an explicit compatibility path rather than a
domain handler. Version-specific mission reducers remain separated by their historical payload
schemas; newer helpers must never backfill older streams.

The two structural interfaces live in `core/types.ts`, allowing domains to implement them without
importing orchestration. The registry factories own validation and static composition.

Version 23 mission extraction is an explicit cross-domain composition seam. The mission reducer
exports the mission-state transition and the story reducer exports the first-band/archive consequence;
an orchestration-owned composite reducer applies them in the historical order and is the sole
registry owner for the shared event discriminator. Neither domain imports the other.

Legal actions use an ordered composer rather than a set/map registry because existing order is part
of the observable and hash-bound contract.

## Version guards and service capabilities

`core/versions.ts` separates structural state guards from service-availability policy. Structural
guards are exhaustive TypeScript type predicates over the discriminated `EngineGameState` union,
such as `hasRoutineState`, `hasCommunicationState`, and `hasMissionState`. Service predicates use
checked-in exact membership arrays and names that identify the consumer boundary:

```ts
supportsCatchUp(state)               // v5-v13
supportsCommunicationApi(state)      // v8-v13
supportsConversationApi(state)       // v9-v13
supportsDirectivesApi(state)         // v10-v13 and v16-v18
supportsMissionApi(state)            // v13 and v15-v20
supportsStoryPatchApi(state)          // v21
supportsSynthesisApi(state)           // v22
supportsFirstBandArchiveApi(state)    // v23
```

Each function returns an explicit type predicate and is tested against all 23 schema versions. A
single-version check or a list with different semantics remains local; notably, the v13 campaign
projection guard is not rewritten as a broad mission capability. This prevents predicate cleanup
from silently widening an endpoint to structurally compatible but currently unsupported states.

## Compatibility and test strategy

1. Snapshot the public engine and contract runtime exports and compile their public type imports.
2. Snapshot state schema discriminators, command discriminators, version constants, and fixed legal
   action IDs.
3. Check in a complete legacy/modern event-discriminator inventory and add minimal strict-replay
   vectors for version gaps before moving their branches.
4. Move leaf logic and its focused tests together.
5. Run the engine unit/property suite after every extraction commit.
6. Run evaluation proofs after each high-risk mission/story/synthesis checkpoint.
7. Run database integration tests after command/event/reducer dispatch moves.
8. Run the full repository gate after the facade is reduced and consumer predicates are adopted.

Golden fixtures include the bootstrap event and record exact event type, before/after hashes, final
state hash, scheduled/resolved/canceled schedule IDs, and legal action IDs. They do not freeze
irrelevant wall time or database-generated values.

## Merge checkpoints and parallelism

### Checkpoint A — compatibility baseline

Public API snapshots, version/command discriminators, legal-action vectors, and missing replay
fixtures are checked in. No production behavior moves yet.

### Checkpoint B — contract and core roots

Contract schemas are split behind the old barrel. Versions, shared types, state parsing/hashing,
content binding, and event metadata move out of `engine.ts`.

After B, contract/core changes remain single-owner, while domain extraction tasks can be reviewed
independently.

### Checkpoint C — domain extraction

Settlement/society, mission/combat, story/archive, and synthesis own their actions, commands, and
reducers. During extraction, only one task at a time removes code from the old monolith. After a
domain lands, its future feature work can use a separate agent/worktree.

### Checkpoint D — orchestration and facade

Typed registries, ordered legal-action composition, scheduling, apply, replay, and bootstrap are
extracted. `engine.ts` becomes a compatibility facade.

### Checkpoint E — consumer capability cleanup

Database and web consumers use shared capability predicates instead of duplicating schema-version
lists. This is a separate merge checkpoint because it changes multiple packages even though it does
not change behavior.

## Completion criteria

- `packages/engine/src/engine.ts` is an export-only facade no larger than 250 lines.
- `packages/contracts/src/engine.ts` is an export-only compatibility barrel.
- No internal production engine module imports `./engine.js`.
- Registry construction proves unique ownership for every current command discriminator and every
  event type handled by current reducers.
- Public API snapshots are unchanged except for explicitly additive capability predicates.
- All golden replay vectors and existing property tests pass.
- Evaluation reports retain their checked hashes.
- Database integration, worker, policy, observability, web, build, and browser gates pass.
- The architecture and workstream docs name the new module owners and handoff boundary.

## Rollback strategy

Every task is a behavior-preserving move with its own commit and test gate. If a checkpoint changes
an event, hash, projection, or public export unexpectedly, revert that checkpoint rather than adding
a compatibility shim around unreviewed behavior. Old schemas and reducers are never edited to make a
new extraction easier.
