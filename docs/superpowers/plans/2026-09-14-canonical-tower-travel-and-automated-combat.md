# Canonical Tower Travel and Automated Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canonical `/tower` map destination-clickable and show the current summoned party
visibly travelling and resolving automated combat through the preserved PixiJS runtime.

**Architecture:** The engine plans safe deterministic routes and applies every accepted tile step;
the database commits the route atomically and persists the complete frozen encounter request. The
web projects only server-authorized destinations and paths, renders approved party chibis on the
map, and mounts the existing automated combat session with static-sprite motion fallback when a
participant lacks a motion sheet. Combat submits a validated receipt to settle the same exploration
attempt.

**Tech Stack:** TypeScript, Zod, Svelte 5, SvelteKit, PixiJS v8, PostgreSQL, Vitest, Playwright,
pnpm 10.33.0, Node.js 24.14.1

**Spec:**
`docs/superpowers/specs/2026-09-14-canonical-tower-travel-and-automated-combat-design.md`

## Global Constraints

- `/tower` remains the only player-facing Tower and combat route.
- Do not restore `living-village-lab`, `mission-lab`, or a run-ID combat page.
- Use the current campaign's approved `combat-chibi` raster for each hero; never substitute fixture
  heroes or procedural character art.
- Ordinary travel blocks unresolved encounter tiles and all eight touching tiles; deliberate clicks
  on an encounter permit only its minimum final approach.
- The server computes routes. The client submits only a destination and animates only the accepted
  returned path.
- The persisted complete encounter request is the input to both presentations and survives refresh.
- Use PixiJS v8 `Application.init`, verified `Assets.load`, ticker `deltaMS`, and explicit destroy and
  asset release behavior.
- Follow red-green-refactor for every behavior change and run commands with the repository's exact
  Node.js 24.14.1 binary.

---

### Task 1: Shared travel and optional-motion contracts

**Files:**

- Modify: `packages/contracts/src/exploration.ts`
- Modify: `packages/contracts/src/exploration.spec.ts`
- Modify: `packages/contracts/src/exploration-combat.ts`
- Modify: `packages/contracts/src/exploration-combat.spec.ts`

**Interfaces:**

- Produces: `ExplorationTravelResultSchema` and `ExplorationTravelResult`
- Produces: `CombatPresentationBindingSchema` with `motionPackBinding` nullable
- Consumes: existing exploration tile, state, and combat raster schemas

- [ ] **Step 1: Add failing strict-schema tests**

```ts
it('accepts an authoritative multi-tile travel result', () => {
	const result = ExplorationTravelResultSchema.parse({
		requestedTileId: 'f001-r011-c005',
		destinationTileId: 'f001-r013-c005',
		pathTileIds: ['f001-r015-c005', 'f001-r014-c005', 'f001-r013-c005'],
		stopReason: 'interaction'
	});
	expect(result.pathTileIds).toHaveLength(3);
});

it('allows an approved raster without a motion pack', () => {
	const request = validRequest();
	request.party[0]!.presentation.motionPackBinding = null;
	expect(ExplorationEncounterRequestSchema.parse(rehash(request))).toBeTruthy();
});
```

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/contracts test -- exploration.spec.ts exploration-combat.spec.ts
```

Expected: FAIL because `ExplorationTravelResultSchema` is absent and the presentation schema rejects
`null` motion bindings.

- [ ] **Step 3: Add the schemas and update production visual validation**

```ts
export const ExplorationTravelResultSchema = z
	.object({
		requestedTileId: ExplorationTileIdSchema,
		destinationTileId: ExplorationTileIdSchema,
		pathTileIds: z.array(ExplorationTileIdSchema).min(1),
		stopReason: z.enum(['destination', 'interaction'])
	})
	.strict();

export const CombatPresentationBindingSchema = z
	.object({
		combatAssetBinding: CombatRasterBindingSchema,
		motionPackBinding: CombatMotionPackBindingSchema.nullable(),
		visualTuning: CombatVisualTuningSchema
	})
	.strict();
```

Change fixture-binding validation so it checks the motion approval status only when the binding is
non-null. Export the inferred travel-result type.

- [ ] **Step 4: Run contract tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the contract slice**

```bash
git add packages/contracts/src/exploration.ts packages/contracts/src/exploration.spec.ts \
  packages/contracts/src/exploration-combat.ts packages/contracts/src/exploration-combat.spec.ts
git commit -m "feat(tower): define travel and static combat bindings"
```

### Task 2: Deterministic safe path planning

**Files:**

- Modify: `packages/engine/src/domains/exploration/model.ts`
- Modify: `packages/engine/src/domains/exploration/model.spec.ts`

**Interfaces:**

- Produces: `safeExplorationDestinations(floor, state)`
- Produces: `planExplorationTravel(floor, state, requestedTileId)` with safety and straightness
- Produces: `applyExplorationTravel(floor, state, pathTileIds)`
- Consumes: `ExplorationTravelResult`

- [ ] **Step 1: Add failing route-order and danger-zone tests**

```ts
it('avoids all tiles touching an unresolved encounter for ordinary travel', () => {
	const state = revealWholeFloor(attempt());
	expect(() => planExplorationTravel(floor, state, 'f001-r005-c006')).toThrow(
		'No safe route to this tile'
	);
});

it('allows the minimum final approach when the encounter itself is clicked', () => {
	const state = revealWholeFloor(attempt());
	const plan = planExplorationTravel(floor, state, 'f001-r005-c005');
	expect(plan.destinationTileId).toBe('f001-r005-c005');
	expect(plan.stopReason).toBe('interaction');
});

it('prefers fewer turns after shortest path length', () => {
	const plan = planExplorationTravel(openTestFloor(), openFloorAttempt(), 'f001-r002-c002');
	expect(countTurns(plan.pathTileIds)).toBe(1);
});
```

- [ ] **Step 2: Run the engine model test and verify RED**

Run:

```bash
pnpm --filter @summonlab/engine test -- src/domains/exploration/model.spec.ts
```

Expected: FAIL because current breadth-first travel ignores encounter danger zones and turn count.

- [ ] **Step 3: Implement deterministic path scoring**

Represent a search state as `{ tile, pathTileIds, direction, turns }`. Build unresolved encounter
danger zones from encounter tiles not present in `resolvedInteractionTileIds`. Search orthogonal
revealed walkable neighbors and rank candidates by `[path length, turns, direction ordinal]`. For an
ordinary destination, reject every danger-zone tile. For a requested encounter, allow that
encounter and the shortest required suffix inside only its own danger zone.

- [ ] **Step 4: Add failing interaction-stop and application-equivalence tests**

```ts
it('stops at the first unresolved interaction on an accepted route', () => {
	const result = planExplorationTravel(floor, revealWholeFloor(attempt()), 'f001-r010-c005');
	expect(result.destinationTileId).toBe('f001-r013-c005');
	expect(result.stopReason).toBe('interaction');
});

it('applies a route exactly like repeated legal steps', () => {
	const path = ['f001-r015-c005', 'f001-r014-c005', 'f001-r013-c005'];
	const applied = applyExplorationTravel(floor, attempt(), path);
	const repeated = path.reduce((state, tileId) => stepExploration(floor, state, tileId), attempt());
	expect(applied).toEqual(repeated);
});
```

- [ ] **Step 5: Implement `applyExplorationTravel` and verify GREEN**

The function validates every path member through `stepExploration`, rejects additional tiles after
the first unresolved interaction, and returns the final state. Run the Step 2 command. Expected:
PASS.

- [ ] **Step 6: Commit the engine slice**

```bash
git add packages/engine/src/domains/exploration/model.ts \
  packages/engine/src/domains/exploration/model.spec.ts
git commit -m "feat(tower): plan safe destination travel"
```

### Task 3: Atomic travel and frozen encounter persistence

**Files:**

- Create: `packages/database/migrations/0020_tower_encounter_requests.sql`
- Modify: `packages/database/src/exploration.ts`
- Modify: `packages/database/src/exploration.integration.spec.ts`

**Interfaces:**

- Produces: `commitExplorationTravel(databaseUrl, input)`
- Changes: `ExplorationEncounterBinding` to include `request: ExplorationEncounterRequest`
- Consumes: a route-applied `nextState` whose version advances by the accepted path length

- [ ] **Step 1: Add failing database integration tests**

```ts
it('commits a multi-step route atomically', async () => {
	const next = applyExplorationTravel(floor, created.state, acceptedPath);
	const persisted = await commitExplorationTravel(databaseUrl, {
		attemptId: created.state.attemptId,
		expectedVersion: 0,
		nextState: next,
		pathTileIds: acceptedPath
	});
	expect(persisted.state.version).toBe(acceptedPath.length);
});

it('reloads the exact full active encounter request', async () => {
	const active = await beginExplorationEncounter(databaseUrl, {
		attemptId,
		expectedVersion,
		request: encounterRequest
	});
	expect(active.activeEncounter?.request).toEqual(encounterRequest);
});
```

- [ ] **Step 2: Run migration-backed tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/database test:integration -- exploration.integration.spec.ts
```

Expected: FAIL because the travel commit and JSON request column do not exist.

- [ ] **Step 3: Add the migration**

```sql
alter table summonlab_exploration_attempts
  add column if not exists active_request jsonb;

alter table summonlab_exploration_attempts
  add constraint summonlab_exploration_active_request_complete
  check ((active_request_id is null) = (active_request is null));
```

- [ ] **Step 4: Implement persistence validation**

Parse `active_request` with `ExplorationEncounterRequestSchema`; require its request ID and hash to
match the scalar indexed binding columns. `commitExplorationTravel` must lock the attempt, check the
expected version and immutable bindings, require `next.version === current.version +
pathTileIds.length`, and update state once. Clear `active_request` when the receipt settles.

- [ ] **Step 5: Run the integration test and verify GREEN**

Run the Step 2 command. Expected: PASS, including stale-version rollback and encounter reload.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add packages/database/migrations/0020_tower_encounter_requests.sql \
  packages/database/src/exploration.ts packages/database/src/exploration.integration.spec.ts
git commit -m "feat(tower): persist travel and encounter requests"
```

### Task 4: Canonical encounter request builder

**Files:**

- Create: `apps/web/src/lib/server/tower-encounter-request.ts`
- Create: `apps/web/src/lib/server/tower-encounter-request.spec.ts`
- Create: `apps/web/src/lib/tower-combat-policy.ts`
- Create: `apps/web/src/lib/tower-combat-policy.spec.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.ts`
- Modify: `apps/web/src/lib/server/runtime-portraits.spec.ts`
- Modify: `apps/web/src/lib/server/singleton-village-page.ts`
- Modify: `apps/web/src/lib/city.ts`
- Modify: `apps/web/static/runtime/combat/realtime-study-v1/README.md`
- Modify: `apps/web/static/runtime/combat/observatory-art-pilot-v1/provenance.md`

**Interfaces:**

- Produces: `runtimeCombatBindingFor(manifestHash, artKey)`
- Produces: `buildTowerEncounterRequest(input): ExplorationEncounterRequest`
- Produces: `TOWER_COMBAT_CLAIM_POLICY` and `TOWER_COMBAT_CLAIM_POLICY_BINDING` from a client-safe
  module shared by the request builder and PixiJS stage
- Adds: `combatArt` to the current `CityResidentSource` and `CityResident` projection
- Consumes: campaign hero drafts, active engine hero state, authored Floor One duty, and runtime
  asset manifest

- [ ] **Step 1: Add failing runtime-art and request-builder tests**

```ts
it('resolves the approved combat chibi with its hash and approval identity', () => {
	const binding = runtimeCombatBindingFor(hero.draft.manifestHash, hero.draft.manifest.artKey);
	expect(binding).toMatchObject({ approvalStatus: 'approved' });
	expect(binding?.source).toContain('/combat-chibi.');
});

it('builds a production request for the exact summoned party', () => {
	const request = buildTowerEncounterRequest(canonicalInput());
	expect(request.party.map((hero) => hero.heroRef.heroId)).toEqual(summonedHeroIds);
	expect(request.party.every((hero) => hero.presentation.combatAssetBinding.approvalStatus === 'approved')).toBe(true);
	expect(ExplorationEncounterRequestSchema.parse(request)).toEqual(request);
});

it('binds one canonical claim policy without importing rat fixture defaults', () => {
	expect(TOWER_COMBAT_CLAIM_POLICY_BINDING.contentHash).toBe(
		combatValueHash(TOWER_COMBAT_CLAIM_POLICY)
	);
});
```

- [ ] **Step 2: Run focused web tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/web test -- src/lib/server/runtime-portraits.spec.ts \
  src/lib/server/tower-encounter-request.spec.ts src/lib/tower-combat-policy.spec.ts
```

Expected: FAIL because neither binding resolver nor request builder exists.

- [ ] **Step 3: Implement exact party and encounter projection**

Return raster binding metadata directly from the validated runtime manifest. Build hero resources and
profiles from engine state, use deterministic deployment slots, bind the authored goblin duty and
approved Ruined Threshold battlefield assets, compute the request hash with `combatRequestHash`, and
parse the result through `ExplorationEncounterRequestSchema`. Set `motionPackBinding: null` when no
identity-matching approved sheet exists.

Extract the generic claim values from `rat-encounter-fixture.ts` into the client-safe canonical
policy module with a new `tower-combat-claims-v1` identity. The fixture imports this shared policy;
production code never imports `RAT_ENCOUNTER_REQUEST` or fixture hero defaults.

- [ ] **Step 4: Project combat art into City residents**

Add `combatArt` beside `portrait` and `sceneArt`, populated with `runtimePortraitFor(...,
'combat-chibi')`. Preserve the missing-art state as `null` rather than substituting another hero.

Update the two runtime provenance records with the owner's accepted canonical uses: Ruined
Threshold as the automated battlefield and the existing goblin raster as the initial Floor One
enemy presentation. Record new approval IDs in the request builder while preserving the exact file
hashes. This changes approval metadata only; it does not alter or regenerate either raster.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command plus `pnpm --filter @summonlab/web test -- src/lib/server/city.spec.ts`.
Expected: PASS.

- [ ] **Step 6: Commit the canonical request slice**

```bash
git add apps/web/src/lib/server/tower-encounter-request.ts \
  apps/web/src/lib/server/tower-encounter-request.spec.ts \
  apps/web/src/lib/tower-combat-policy.ts apps/web/src/lib/tower-combat-policy.spec.ts \
  apps/web/src/lib/server/runtime-portraits.ts apps/web/src/lib/server/runtime-portraits.spec.ts \
  apps/web/src/lib/server/singleton-village-page.ts apps/web/src/lib/city.ts \
  apps/web/static/runtime/combat/realtime-study-v1/README.md \
  apps/web/static/runtime/combat/observatory-art-pilot-v1/provenance.md
git commit -m "feat(tower): build encounters from summoned heroes"
```

### Task 5: Destination travel API and Tower projection

**Files:**

- Modify: `apps/web/src/routes/api/runs/[runId]/tower/move/+server.ts`
- Create: `apps/web/src/routes/api/runs/[runId]/tower/move/move.spec.ts`
- Modify: `apps/web/src/lib/server/tower.ts`
- Modify: `apps/web/src/lib/server/tower.spec.ts`
- Modify: `apps/web/src/lib/city.ts`

**Interfaces:**

- Adds: `destinations` to `TowerExplorationView`
- Adds: complete `encounterRequest` to the encounter `TowerView`
- Returns: `{ attempt, travel: ExplorationTravelResult }` from the move endpoint
- Consumes: Task 2 planner, Task 3 persistence, and Task 4 request builder

- [ ] **Step 1: Add failing projection and endpoint tests**

```ts
it('projects every safe revealed destination and intentional encounter', () => {
	const view = projectTowerViewFromState(missions, persistedAttempt);
	expect(view.state).toBe('exploration');
	expect(view.exploration.destinations).toContainEqual(
		expect.objectContaining({ tileId: 'f001-r011-c005', intent: 'travel' })
	);
});

it('returns the authoritative accepted path instead of trusting a client path', async () => {
	const response = await postMove({ destinationTileId: 'f001-r011-c005' });
	expect(response.travel.pathTileIds).toEqual([
		'f001-r015-c005',
		'f001-r014-c005',
		'f001-r013-c005'
	]);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/web test -- src/lib/server/tower.spec.ts \
  'src/routes/api/runs/[runId]/tower/move/move.spec.ts'
```

Expected: FAIL because projection still exposes only adjacent steps and the endpoint returns only the
persisted attempt.

- [ ] **Step 3: Implement the authoritative travel endpoint**

Replace `stepExploration` with `planExplorationTravel` plus `applyExplorationTravel`, commit the
whole accepted path, then create and persist the full encounter request only when the stopping tile
is an unresolved encounter. Never read a client-supplied path.

- [ ] **Step 4: Project destinations and encounter request**

Project `{ tileId, pathTileIds, intent: 'travel' | 'encounter' }` for server-approved revealed
destinations. Encounter state must include the parsed persisted request, not only its ID.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command and `pnpm --filter @summonlab/web typecheck`. Expected: PASS.

- [ ] **Step 6: Commit the API slice**

```bash
git add 'apps/web/src/routes/api/runs/[runId]/tower/move/+server.ts' \
  'apps/web/src/routes/api/runs/[runId]/tower/move/move.spec.ts' \
  apps/web/src/lib/server/tower.ts apps/web/src/lib/server/tower.spec.ts apps/web/src/lib/city.ts
git commit -m "feat(tower): expose destination travel"
```

### Task 6: Clickable grid and party travel animation

**Files:**

- Modify: `apps/web/src/lib/components/tower/TowerExplorationMap.svelte`
- Create: `apps/web/src/lib/components/tower/TowerExplorationMap.spec.ts`
- Modify: `apps/web/src/lib/components/tower/TowerScreen.svelte`
- Modify: `apps/web/src/lib/components/tower/tower-screen.spec.ts`

**Interfaces:**

- `TowerExplorationMap` consumes `party`, `destinations`, and
  `onMove(destinationTileId): Promise<ExplorationTravelResult | null>`
- `TowerScreen.command` returns parsed JSON to the caller before refreshing the City projection

- [ ] **Step 1: Add failing component source and behavior tests**

```ts
it('makes server-approved destinations clickable and renders campaign chibis', () => {
	expect(source).toContain('exploration.destinations');
	expect(source).toContain('resident.combatArt.publicPath');
	expect(source).toContain('data-testid="tower-party-member"');
	expect(source).not.toContain('Choose an adjacent tile');
});
```

Add a browser-component test that clicks a distant destination, resolves `onMove` with a three-tile
path, and asserts that the party marker visits only those returned tile IDs.

- [ ] **Step 2: Run the component tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/web test -- src/lib/components/tower/TowerExplorationMap.spec.ts \
  src/lib/components/tower/tower-screen.spec.ts
```

Expected: FAIL because the grid disables non-adjacent cells and has no party marker.

- [ ] **Step 3: Implement accessible destination clicks**

Build a destination map from `exploration.destinations`; enable only those revealed walkable cells;
label encounter buttons as deliberate engagement; retain visible focus styles; remove the adjacent
direction-button list. Show the named no-safe-route message for revealed walkable cells that are not
server-approved.

- [ ] **Step 4: Implement approved party artwork and accepted-path animation**

Render one `<img>` per party member from `combatArt.publicPath` inside a marker positioned over the
current grid cell. After `onMove` resolves, advance a local visual tile ID through only
`travel.pathTileIds`; use a short CSS transition unless reduced motion is active, then call the
projection refresh. Keep controls busy for the whole accepted animation.

- [ ] **Step 5: Run component tests and verify GREEN**

Run the Step 2 command and web typecheck. Expected: PASS.

- [ ] **Step 6: Commit the exploration UI slice**

```bash
git add apps/web/src/lib/components/tower/TowerExplorationMap.svelte \
  apps/web/src/lib/components/tower/TowerExplorationMap.spec.ts \
  apps/web/src/lib/components/tower/TowerScreen.svelte \
  apps/web/src/lib/components/tower/tower-screen.spec.ts
git commit -m "feat(tower): animate click-to-travel party"
```

### Task 7: Static-raster fallback in the PixiJS automated stage

**Files:**

- Modify: `apps/web/src/lib/components/tower/combat/automated/RealtimeCombatStage.svelte`
- Modify: `apps/web/src/lib/components/tower/combat/automated/RealtimeCombatStage.spec.ts`
- Modify: `apps/web/src/lib/components/tower/combat/automated/stage-asset-integrity.ts`
- Modify: `apps/web/src/lib/components/tower/combat/automated/stage-asset-integrity.spec.ts`
- Modify: `apps/web/src/lib/components/tower/combat/automated/motion-pack-config.ts`
- Modify: `apps/web/src/lib/components/tower/combat/automated/motion-pack-config.spec.ts`

**Interfaces:**

- Consumes: nullable `presentation.motionPackBinding`
- Produces: an actor view backed by `AnimatedSprite` when motion exists or approved `Sprite` when it
  does not
- Preserves: existing `CombatSession`, ticker, receipt, replay, and asset-owner boundaries

- [ ] **Step 1: Read the routed PixiJS application, assets, sprite, container, ticker, and performance
  skills completely**

Confirm v8 constructor, async init, verified blob loading with explicit parser, delta-time units, and
destroy options before editing the stage.

- [ ] **Step 2: Add failing static-fallback tests**

```ts
it('does not require motion bytes for a static-raster participant', () => {
	const request = withoutFirstHeroMotion(RAT_ENCOUNTER_REQUEST);
	expect(requestAssetBindings(request)).not.toContainEqual(
		expect.objectContaining({ source: expect.stringMatching(/motion/u) })
	);
});

it('creates a Sprite fallback without substituting fixture identity art', () => {
	expect(stageSource).toContain('motionBinding ? new AnimatedSprite');
	expect(stageSource).toContain('new Sprite({ texture: rasterTexture');
	expect(stageSource).not.toContain('RAT_ENCOUNTER_REQUEST.party');
});
```

- [ ] **Step 3: Run automated-stage tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/web test -- \
  src/lib/components/tower/combat/automated/RealtimeCombatStage.spec.ts \
  src/lib/components/tower/combat/automated/stage-asset-integrity.spec.ts \
  src/lib/components/tower/combat/automated/motion-pack-config.spec.ts
```

Expected: FAIL because all participants currently require spritesheet bindings and decode.

- [ ] **Step 4: Implement nullable motion loading and whole-sprite cues**

Filter null bindings before byte verification and spritesheet parsing. Create a raster `Sprite` with
the same anchor, display size, depth projection, shadow, health bar, and impact effect. Drive its
container from existing `RealtimeActor` positions; use the actor's action and hit state to apply
small anticipation, lunge, recoil, tint, and down transforms without changing simulation state.

- [ ] **Step 5: Preserve lifecycle and verify GREEN**

Ensure ticker callbacks are detached, decoded textures and sheets are released, object URLs are
revoked, and `app.destroy({ removeView: false, releaseGlobalResources: true }, { children: true })`
runs once. Run the Step 3 command and the full automated combat unit suite. Expected: PASS.

- [ ] **Step 6: Commit the PixiJS slice**

```bash
git add apps/web/src/lib/components/tower/combat/automated
git commit -m "feat(tower): render combatants without motion sheets"
```

### Task 8: Mount automated combat and validate receipts

**Files:**

- Modify: `apps/web/src/lib/components/tower/combat/TowerEncounter.svelte`
- Create: `apps/web/src/lib/components/tower/combat/TowerEncounter.spec.ts`
- Modify: `apps/web/src/lib/components/tower/TowerScreen.svelte`
- Modify: `apps/web/src/routes/api/runs/[runId]/tower/encounter/+server.ts`
- Modify: `apps/web/src/lib/server/tower-encounter.ts`
- Modify: `apps/web/src/lib/server/tower-encounter.spec.ts`

**Interfaces:**

- `TowerEncounter` consumes the persisted `ExplorationEncounterRequest`
- `TowerEncounter` emits `onComplete(receipt: ExplorationCombatReceipt)`
- Encounter endpoint consumes `{ attemptId, expectedVersion, receipt }`
- Produces: request-bound validated settlement with idempotent replay behavior

- [ ] **Step 1: Add failing mounting and receipt-validation tests**

```ts
it('mounts RealtimeCombatStage for automated presentation', () => {
	expect(source).toContain("import RealtimeCombatStage from './automated/RealtimeCombatStage.svelte'");
	expect(source).toContain('<RealtimeCombatStage');
	expect(source).toContain('request={encounterRequest}');
});

it('rejects a receipt that does not match the persisted request', () => {
	expect(() => validateTowerEncounterReceipt(request, mismatchedReceipt)).toThrow(
		'Combat receipt does not match the active encounter'
	);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @summonlab/web test -- \
  src/lib/components/tower/combat/TowerEncounter.spec.ts \
  src/lib/server/tower-encounter.spec.ts
```

Expected: FAIL because the component only swaps CSS backgrounds and the endpoint synthesizes a
receipt.

- [ ] **Step 3: Mount the persisted automated session**

Pass the full request, canonical claim policy, shared registry, player motion preference, pause,
speed, snapshot, unavailable, rejection, and completion callbacks into `RealtimeCombatStage`.
Display loading, active, terminal, and unavailable states without navigating away from `/tower`.

- [ ] **Step 4: Replace synthetic settlement with validated receipt settlement**

Parse `ExplorationCombatReceiptSchema`, require request ID/hash, run ID, encounter ID, attempt ID,
ruleset, participant identities, and terminal hashes to match the persisted request, then persist the
accepted outcome and receipt identity. Preserve idempotent duplicate receipt handling.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command plus all automated combat tests and web typecheck. Expected: PASS.

- [ ] **Step 6: Commit the canonical combat slice**

```bash
git add apps/web/src/lib/components/tower/combat/TowerEncounter.svelte \
  apps/web/src/lib/components/tower/combat/TowerEncounter.spec.ts \
  apps/web/src/lib/components/tower/TowerScreen.svelte \
  'apps/web/src/routes/api/runs/[runId]/tower/encounter/+server.ts' \
  apps/web/src/lib/server/tower-encounter.ts apps/web/src/lib/server/tower-encounter.spec.ts
git commit -m "feat(tower): mount canonical automated combat"
```

### Task 9: Canonical journey acceptance and cleanup

**Files:**

- Modify: `apps/web/src/routes/campaign.e2e.ts`
- Modify: `docs/decisions/2026-09-14-tower-combat-retirement.md`
- Modify: `docs/superpowers/specs/2026-09-14-canonical-tower-travel-and-automated-combat-design.md`
- Delete or modify: `apps/web/src/lib/server/tower-encounter.ts` synthetic resolver only after no
  production import remains

**Interfaces:**

- Consumes: the complete `/village` to `/tower` canonical flow
- Produces: executable evidence that the consolidation has no hidden lab or fixture path

- [ ] **Step 1: Change the E2E test and verify RED before the UI implementation is considered done**

Replace eleven adjacent north-button clicks with one distant map click, assert three party chibis
move, click the first encounter deliberately, choose automated mode, assert the three summoned hero
names or IDs are present in the PixiJS stage metadata, wait for terminal combat, and assert the map
resumes at `f001-r005-c005`.

- [ ] **Step 2: Run the canonical E2E and fix only integration defects**

Run:

```bash
pnpm --filter @summonlab/web exec playwright test src/routes/campaign.e2e.ts
```

Expected after implementation: PASS with the browser remaining on `/tower` throughout travel and
combat.

- [ ] **Step 3: Remove the synthetic result path and update completion records**

Delete the old `resolveTowerEncounter` shortcut if it has no valid non-test consumer. Change the
retirement decision and design status only after the canonical E2E proves the automated renderer is
mounted and receipt-bound.

- [ ] **Step 4: Run repository validation**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:integration
pnpm --filter @summonlab/web exec playwright test src/routes/campaign.e2e.ts \
  src/routes/title-gateway.e2e.ts
pnpm --filter @summonlab/web build
```

Expected: every command exits 0 without errors or warnings attributable to this slice.

- [ ] **Step 5: Commit the accepted canonical journey**

```bash
git add apps/web/src/routes/campaign.e2e.ts docs/decisions/2026-09-14-tower-combat-retirement.md \
  docs/superpowers/specs/2026-09-14-canonical-tower-travel-and-automated-combat-design.md
git add -u apps/web/src/lib/server/tower-encounter.ts
git commit -m "test(tower): prove interactive automated journey"
```

- [ ] **Step 6: Push and serve the review build**

Push `codex/village-threshold-implementation-plan`, start the web app on `0.0.0.0:5173`, verify the
listening interface, and share the full `/tower` URL using the collaborator address required by the
repository instructions.
