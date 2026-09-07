# Exploration Combat Contract Design

**Status:** Approved in conversation on 2026-09-07

## Purpose

Turn the existing autonomous PixiJS rat-combat study into the first contract-bound combat entry
without replacing its presentation or separating resolution from rendering. Exploration submits one
frozen, bounded encounter request. Combat owns the resulting session: it initializes actors, runs
decisions and mechanics, renders the fight, records its trace, and returns one idempotent terminal
receipt.

The Asha, Toma, and Nessa versus rat-pack encounter remains the executable reference fixture. It
proves the contract and session lifecycle, but its prototype identities do not become the canonical
player roster. Production requests use canonical hero references and approved raster combat
bindings.

## Existing state

Three distinct combat-shaped implementations currently exist:

- `packages/engine/src/domains/mission/combat.ts` resolves turn-based mission combat against engine
  state and can return changes across mission, heroes, items, society, the Master, and status. That
  ownership is broader than the exploration handoff and is not the implementation base for this
  contract.
- `apps/web/src/lib/components/living-village/tower/tower-combat.ts` runs a deterministic,
  mathematical hunt fixture. It already demonstrates encounter caps, final Health and Mana,
  proposed claims, and receipt hashes, but its types and math are explicitly proposal-grade and
  local to the web application.
- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte` owns the
  target experience. Its PixiJS ticker advances `RealtimeCombatState`, updates authored animation
  clips, renders actors and effects, and publishes snapshots. Its actors and assets are currently
  hard-coded for the rat study.

No `ExplorationEncounterRequest` or `ExplorationCombatReceipt` contract exists today. Neither the
Tower fixture nor the real-time rat study consumes the canonical hero visual manifest.

## Accepted decisions

- Preserve one unified combat runtime. Do not add a presentation adapter and do not extract a pure
  resolver in front of the existing combat presentation.
- Combat owns autonomous decisions, target selection, movement, attacks, resource changes,
  animation, effects, terminal resolution, trace capture, and receipt finalization for the active
  encounter.
- Exploration owns encounter selection and all exploration state. Combat must not modify position,
  fog, tile interactions, loot-cache state, or any other exploration aggregate field.
- Combat reports claims. It does not commit XP, skill practice, items, materials, currency,
  unlocks, inventory changes, or loot-cache changes.
- Production participants are canonical `HeroRef`-backed heroes with approved raster combat
  bindings. Asha, Toma, and Nessa remain fixture identities used by the existing visual study.
- The existing rat-combat presentation is retained. The contract supplies its actors and encounter
  configuration; it does not replace the battlefield or animation system.
- A combat receipt has only `victory` or `defeat` outcomes. Invalid requests and load failures are
  rejections, not fabricated defeat receipts.
- The first terminal rules are fixed rather than user-authored: defeat all required enemies for
  victory, lose every combat-capable hero for defeat, or reach a declared simulation or trace limit
  for a bounded defeat.

## Ownership boundary

```text
Exploration
  creates and freezes ExplorationEncounterRequest
                  |
                  v
Combat encounter session
  validates request and assets
  initializes authoritative combat state
  advances autonomous mechanics in the PixiJS fixed-step loop
  renders the existing presentation and authored animation
  records bounded events, claims, and terminal evidence
                  |
                  v
ExplorationCombatReceipt
  victory or defeat
  final Health and Mana
  uncommitted claims
  replay reference
                  |
                  v
Exploration and owning domains independently consume accepted consequences
```

The request is an immutable input boundary, not a mutable view into exploration. The receipt is an
immutable output boundary, not permission for combat to update another aggregate. The web stage may
publish non-authoritative snapshots for its HUD while running, but only the final receipt crosses
the gameplay boundary.

## Shared contract

The shared schemas live in `packages/contracts/src/exploration-combat.ts` and are exported through
`packages/contracts/src/index.ts`. All objects are strict Zod schemas. Hashes use the repository's
64-character SHA-256 `StateHashSchema`; time and shared content versions use the existing shared
schemas where applicable.

### Hero combat snapshot

Each party entry freezes the state combat may read:

```text
heroRef
  heroId
  characterManifestHash
  lifeState
  availabilityRevision
  rulesetVersion

resources
  health · maximumHealth
  mana · maximumMana

capability
  capabilitySnapshotHash
  loadoutHash
  actionDefinitionRefs[]
  combatRole

combatProfile
  movementUnitsPerSecond
  attackRange
  attackPower
  armour
  attackIntervalTicks

presentation
  visualProfileVersion
  combatAssetBinding
  motionPackBinding
```

`lifeState` must be combat-capable, Health and Mana must be within their maxima, action references
must be unique, and all combat-profile values must be finite and within the contract's declared
ranges. The visual bindings must identify approved raster assets for production requests. The
request carries a complete frozen combat projection plus hashes and versioned references rather
than mutable character, progression, or inventory records.

### Enemy combat snapshot

Each enemy entry contains:

```text
enemyInstanceId
definitionRef
  enemyDefinitionId · definitionVersion · contentHash
resources
  health · maximumHealth
  mana · maximumMana
combatRole
actionDefinitionRefs[]
combatProfile
  movementUnitsPerSecond
  attackRange
  attackPower
  armour
  attackIntervalTicks
requiredForVictory
presentation
  combatAssetBinding · motionPackBinding
```

Enemy instance IDs are unique within a request. The first contract allows no mid-session spawn that
was not declared in the request. Every active enemy therefore counts toward the request's explicit
combatant bound, and victory depends only on entries marked `requiredForVictory`.

### `ExplorationEncounterRequest`

The request contains:

```text
schemaVersion: exploration-encounter-request-v1
requestId · idempotencyKey
runId · correlationId · causationId?
encounterId · explorationAttemptId
observedGameTime
expectedExplorationStateHash
rulesetVersion
contentBindings[]
seed
entropyCursor
party[]
enemies[]
battlefieldBinding
  battlefieldId · version · contentHash · environmentAssetBinding
bounds
  maximumCombatants · maximumSimulationTicks · maximumTraceEvents
requestHash
```

The first version requires one to eight heroes, one to forty enemies, no more than forty-eight total
combatants, and a positive tick limit no greater than 216,000 fixed 60 Hz ticks, or one simulated
hour. `maximumTraceEvents` is positive and no greater than 10,000. `maximumCombatants` must equal
the total declared participant count rather than act as unused headroom. The exact initial rat
fixture chooses much smaller tick and trace limits based on its measured duration.

`requestHash` is the SHA-256 hash of the canonical request body excluding `requestHash` itself. It
binds the frozen inputs, rules, visuals, battlefield, seed, and bounds. Combat validates this hash
before loading assets or creating a session.

The request deliberately contains no exploration coordinates, fog cells, tile mutations, loot
cache, reward balance, or writable aggregate handle.

### Combat trace

The session records only meaningful deterministic events rather than one event per render frame:

```text
eventId · sequence · simulationTick
kind
  encounter-started | intent-selected | movement-committed
  | action-started | action-resolved | resource-changed
  | unit-defeated | encounter-ended
actorId · targetIds[]
actionId?
healthDeltas[] · manaDeltas[]
claimSourceRefs[]
publicSummary
```

The trace is capped by the request and can never exceed 10,000 events. Reaching the declared trace
limit before victory or party defeat terminates the encounter as a bounded defeat with
`encounter-limit-reached`; the terminal event is reserved within the declared capacity. The session
never silently truncates replay evidence. Presentation-only frame state such as fog drift,
particles, camera motion, and interpolated sprite transforms is not part of the authoritative trace.

### Claims

Claims are a discriminated union with stable claim IDs and source event references:

- progression XP claim;
- skill-practice claim;
- material claim.

Each claim names its recipient or source unit, definition/version reference, quantity, and source
combat event. A receipt never contains a claim for a type not enabled by the request's content
bindings. Combat creates no first-clear, floor-unlock, exploration, or loot-cache mutation claim;
those remain decisions of the relevant owning domain after it consumes the receipt.

### `ExplorationCombatReceipt`

The terminal receipt contains:

```text
schemaVersion: exploration-combat-receipt-v1
receiptId
requestId · idempotencyKey · requestHash
runId · correlationId · encounterId · explorationAttemptId
rulesetVersion · contentBindings[]
startedAtTick · endedAtTick
outcome: victory | defeat
decisiveCause
  enemies-defeated | heroes-defeated | encounter-limit-reached
  summary · supportingEventIds[]
finalHeroes[]
  heroId · health · maximumHealth · mana · maximumMana · combatState
finalEnemies[]
  enemyInstanceId · health · maximumHealth · mana · maximumMana · combatState
defeatedEnemyIds[]
events[]
claims[]
inputStateHash · outputStateHash · traceHash
replayRef
ownership
  explorationMutated: false
  progressionCommitted: false
  inventoryCommitted: false
  lootCacheMutated: false
```

`combatState` is `combat-capable` or `defeated`. The receipt contains final Health and Mana for
every requested hero even when the encounter ends early. It also contains every declared enemy so
consumers can distinguish defeated, optional surviving, and required surviving enemies.

`receiptId` is derived from the request hash and trace hash. `outputStateHash` binds final resources,
outcome, decisive cause, and claims. Arrays with set semantics are sorted before hashing; the event
array preserves sequence order. `inputStateHash` binds the combat-owned initial resources, frozen
profiles, rules, seed, bounds, and battlefield configuration; it is distinct from
`expectedExplorationStateHash`, which is an integration precondition owned by exploration.

### Replay reference

The first replay reference is self-verifying rather than a database locator:

```text
replayVersion: exploration-combat-replay-v1
requestId · requestHash
receiptId · traceHash
rulesetVersion
seed · entropyCursor
battlefieldBinding
participantPresentationBindings[]
```

Reopening a replay provides the original request and receipt to the combat session in replay mode.
Replay mode reinitializes and deterministically reruns the unified combat session, including its
normal movement and animation, then verifies the reproduced request, trace, output, and receipt
hashes. It does not emit claims or call the normal completion handler. A replay whose request,
receipt, ruleset, trace, or visual hash does not match its reference fails closed.

## Unified combat session

`combat-session.ts` owns the lifecycle around the current real-time mechanics. It does not own a
second renderer or a detached headless resolver.

The session states are:

```text
validating -> loading -> ready -> running -> victory | defeat
          \-> rejected
                    loading -> unavailable
```

- `validating` parses the request, verifies its canonical hash, checks content/rules versions,
  validates participants and bounds, and resolves idempotency.
- `loading` fetches the exact battlefield and participant raster assets declared by the request.
- `ready` has a complete combat state and PixiJS scene but has not advanced simulation.
- `running` advances one authoritative fixed simulation step for each accumulated 1/60 second.
  Rendering and animation remain in the same stage and may interpolate or reduce motion without
  changing the number or order of authoritative steps.
- `victory` and `defeat` are terminal. Entry constructs and freezes the receipt once, then invokes
  `onComplete(receipt)` once.
- `rejected` is a deterministic contract rejection before combat starts.
- `unavailable` is a runtime presentation failure, such as an asset failing to load. It creates no
  gameplay receipt.

Pause stops simulation advancement. It does not change combat state, hashes, or receipt identity.
Unmounting disposes PixiJS resources and leaves the request unresolved; it cannot manufacture a
receipt. Reduced motion changes only animation and camera presentation, not the fixed-step session.

## Idempotency and concurrency

`idempotencyKey` identifies the caller's intended encounter resolution. The combat session registry
tracks it with `requestHash` and one of `active`, `completed`, or `rejected`:

- the first valid request creates the active session;
- an identical request while active observes the same session and cannot create another one;
- an identical request after completion receives the already frozen receipt;
- the same key with a different request hash receives `idempotency-conflict`;
- completion changes the registry to `completed` before notifying the caller, so re-entrant entry
  cannot duplicate completion or claims.

The browser implementation supplies an in-memory registry for the isolated lab. The contract and
session interface do not claim durable cross-process idempotency. The exploration integration must
persist the request/receipt pair in its application transaction before production use; that
integration is outside this slice because exploration persistence does not yet call combat.

## Rejections and unavailable states

`ExplorationCombatRejection` is a strict sibling contract rather than a combat receipt. Its codes
are:

- `invalid-request`;
- `request-hash-mismatch`;
- `idempotency-conflict`;
- `unsupported-ruleset`;
- `stale-content-binding`;
- `invalid-party`;
- `invalid-enemy-set`;
- `invalid-bounds`;
- `unapproved-character-art`;

Every rejection binds `requestId` when available, its code, a safe summary, and structured field
paths. Rejections occur before the running state and contain no outcome or claims.

Asset decoding, WebGL initialization, and GPU failures happen after contract validation and are
reported as a local `CombatUnavailableState`, not an `ExplorationCombatRejection`, because they do
not prove that the request itself is invalid. The player sees a clear unavailable-combat message;
the session remains unresolved and may be retried with the same request.

## Hero and artwork integration

Player-facing combatants always use approved raster artwork. A production hero binding must agree
with the canonical hero ID and character manifest hash, identify a `combat-chibi` source with
`status: approved`, and bind an authored motion pack derived from that approved source. No CSS,
SVG, canvas vector, emoji, or typographic character stand-in is allowed.

The current summonable roster proves approved static combat-chibi availability but does not provide
full motion packs for every hero. The first contract slice therefore supports two explicit visual
statuses:

- `production`: canonical hero plus approved combat chibi and approved motion pack;
- `fixture`: the existing provenance-bound Asha/Toma/Nessa rat-study assets, accepted only by the
  local conformance fixture.

The local fixture exemption cannot be selected by a production request. A canonical hero without
an approved motion pack receives `unapproved-character-art`; combat does not silently substitute a
rat-study hero or static silhouette.

## Rat encounter conformance fixture

`rat-encounter-fixture.ts` moves the existing hard-coded encounter declaration out of
`createRealtimeCombat()` and expresses it as one valid `ExplorationEncounterRequest`:

- fixture heroes: Asha (`saffron-braid`), Toma (`iron-guardian`), and Nessa (`moss-archer`);
- enemies: one Rat Brute and four lesser plague rats;
- existing ruined-threshold battlefield and well occluder;
- existing versioned motion packs for all eight actors;
- current roles, starting positions, resources, movement, range, damage, and attack intervals;
- fixed victory, defeat, and tick-limit conditions;
- fixture-only content bindings and a reproducible request hash.

`createRealtimeCombat(request)` derives its actors from the request instead of constructing those
eight actors internally. The existing `/living-village-lab/realtime-combat` route starts this
request through the same session entry future exploration will call. The 2D, 2.5D, and 2.5D V2
lenses remain presentation choices over the same running session.

No existing rat or hero raster is regenerated, overwritten, promoted, or treated as canonical by
this contract work.

## File responsibilities

- `packages/contracts/src/exploration-combat.ts` owns request, participant, trace, claim, receipt,
  replay, and rejection schemas and inferred TypeScript types.
- `packages/contracts/src/exploration-combat.spec.ts` owns schema invariants and shared minimum,
  success, rejection, duplicate, and replay fixtures.
- `packages/contracts/src/index.ts` exports the new contract surface.
- `apps/web/src/lib/components/living-village/realtime-combat/rat-encounter-fixture.ts` owns the
  existing study's exact request and fixture-only visual bindings.
- `apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts` owns lifecycle,
  idempotency, fixed-step advancement, bounded trace collection, terminal detection, and receipt
  finalization.
- `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.ts` owns combat state
  and mechanics initialized from a request. It no longer owns fixture identities or asset paths.
- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte` continues
  to own the PixiJS application, assets, simulation loop, rendering, animation, pause, reduced
  motion, teardown, and HUD snapshots. Its gameplay boundary becomes `request`, `onComplete`, and
  `onRejected`.
- `apps/web/src/routes/living-village-lab/realtime-combat/+page.svelte` supplies the rat fixture,
  shows terminal or unavailable state, and keeps replay explicitly non-claiming.

The Tower fixture and mission combat engine remain unchanged in this slice. They are evidence and
future integration inputs, not migration targets.

## Verification strategy

### Shared contract tests

- Accept the minimum valid bounded request and representative victory and defeat receipts.
- Reject duplicate participant IDs, resource values outside maxima, missing required enemies,
  unsupported visual status, invalid content hashes, bounds over their maxima, and a mismatched
  request hash.
- Reject receipts whose terminal cause contradicts final participant state.
- Reject claims without source events or with disabled claim definitions.
- Reject replay references whose request, receipt, trace, ruleset, or presentation binding differs.
- Assert strict schemas reject exploration position, fog, tile interaction, loot-cache mutation,
  and committed reward fields.

### Session tests

- Deep-freeze a request and prove initialization, stepping, completion, and replay do not mutate it.
- Run the rat fixture twice and assert byte-identical receipts, events, claims, final resources, and
  hashes.
- Advance the same request with different render-frame deltas and assert the fixed-step receipt is
  identical.
- Prove victory, heroes-defeated, and tick-limit terminal paths.
- Prove one completion callback, including re-entrant and repeated entry.
- Prove an active duplicate shares one session, a completed duplicate returns the prior receipt,
  and an idempotency collision is rejected.
- Prove pause and reduced motion cannot change the receipt.
- Prove replay does not invoke completion or emit claims.
- Prove no trace exceeds 10,000 events and reaching the declared trace bound produces one terminal
  `encounter-limit-reached` defeat without silent truncation.

### PixiJS and route verification

- Preserve existing animator, motion-pack, spatial, depth, health-bar, and deterministic combat
  tests.
- Assert all eight rat-fixture actors load authored motion packs and transition through idle,
  advance, attack, hit, and down clips where reached.
- Assert the route passes one request into the stage and receives one terminal receipt.
- Exercise pause/resume and all three presentation lenses without restarting the session.
- Exercise a reduced-motion run and confirm the same receipt as full motion.
- Exercise replay and confirm no second claim-producing completion.
- Display an explicit unavailable state when one declared asset cannot load.

## Acceptance criteria

- The existing rat encounter starts from a valid `ExplorationEncounterRequest` and retains its
  current PixiJS presentation and autonomous behavior.
- Combat resolution and presentation remain one runtime session.
- One terminal session produces one valid `ExplorationCombatReceipt` with victory or defeat, final
  hero Health and Mana, claims, hashes, decisive cause, and replay reference.
- Identical requests produce the same receipt and cannot duplicate completion or claims.
- Every encounter is bounded by declared participants, fixed terminal rules, simulation ticks, and
  trace capacity.
- Invalid input and unavailable presentation paths never create fake gameplay outcomes.
- The request and receipt expose no authority to modify exploration, progression, inventory, or
  loot-cache state.
- Production hero input requires canonical identity references and approved raster combat and
  motion bindings; fixture identities remain isolated to the rat study.
- The Tower fixture, mission engine, and existing raster assets remain unchanged.

## Deferred integration

This design establishes the combat-owned contract seam and executable conformance fixture. It does
not yet add an exploration caller, durable cross-process idempotency store, canonical hero motion
packs, progression claim consumer, inventory claim consumer, loot-cache consumer, or migration of
the Tower and mission combat implementations. Those integrations require their owning systems to
adopt the contract in separate approved slices.
