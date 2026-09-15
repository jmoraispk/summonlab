# Exploration Combat Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind the existing autonomous PixiJS rat encounter to a strict, bounded `ExplorationEncounterRequest` and return one idempotent `ExplorationCombatReceipt` without splitting combat resolution from its presentation.

**Architecture:** Add strict shared request, receipt, replay, claim, and rejection schemas, then project the existing rat fixture into those inputs. A single `CombatSession` continues to own mechanics, fixed-step advancement, Pixi presentation lifecycle, bounded trace capture, terminal resolution, claims, and replay verification; a small in-memory registry gives the lab idempotent entry semantics. Exploration remains outside the slice and receives only the terminal receipt.

**Tech Stack:** TypeScript 6, Zod 4, Vitest 4, Svelte 5, PixiJS 8.20.0, Playwright 1.60, `@summonlab/engine` canonical SHA-256 helpers, pnpm 10.33.0, Node 24.14.1.

**Spec:** `docs/superpowers/specs/2026-09-07-exploration-combat-contract-design.md`

## Global Constraints

- Preserve one unified combat runtime. Do not add a presentation adapter or a detached pure resolver.
- Combat owns autonomous choices, movement, attacks, resources, animation, effects, terminal resolution, trace capture, and receipt finalization.
- `ExplorationEncounterRequest` is immutable and contains no exploration coordinates, fog cells, tile mutations, loot-cache state, reward balance, or writable aggregate handles.
- Combat returns claims but does not commit progression, inventory, currency, unlock, first-clear, floor, or loot-cache changes.
- Outcomes are only `victory` or `defeat`; invalid requests are rejections, and asset/WebGL failures are unavailable states with no receipt.
- Requests contain 1–8 heroes, 1–40 enemies, at most 48 declared combatants, at most 216,000 fixed 60 Hz ticks, and at most 10,000 trace events.
- The trace-event capacity reserves its final slot for `encounter-ended`; reaching either declared bound creates `encounter-limit-reached` defeat without truncation.
- Production heroes require canonical hero identity, approved raster combat-chibi binding, and approved authored motion-pack binding. Fixture bindings are accepted only for the local rat conformance encounter.
- Asha, Toma, Nessa, Rat Brute, and the four plague rats retain their current approved/provenance-bound raster and motion assets. Do not regenerate, overwrite, or promote artwork.
- Pause, reduced motion, presentation-lens changes, render-frame deltas, unmount, and replay must not change or duplicate the authoritative receipt.
- Leave Tower combat, mission combat, exploration persistence, and canonical production hero motion-pack generation unchanged.

---

## File map

- `packages/contracts/src/exploration-combat.ts`: strict public schemas and inferred types for requests, participants, traces, claims, receipts, replays, and rejections.
- `packages/contracts/src/exploration-combat.spec.ts`: schema invariants, ownership exclusions, and representative request/receipt/replay fixtures.
- `packages/contracts/src/index.ts`: public export for the combat contract.
- `apps/web/src/lib/components/living-village/realtime-combat/combat-hash.ts`: canonical request/trace/state/receipt hashes and deterministic IDs, using the existing engine helpers.
- `apps/web/src/lib/components/living-village/realtime-combat/rat-encounter-fixture.ts`: exact Asha/Toma/Nessa-versus-rats request, fixture content/claim policy, and asset bindings.
- `apps/web/src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts`: fixture contract, asset inventory, and hash tests.
- `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.ts`: actor state and mechanics initialized entirely from a request.
- `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts`: request projection and mechanics regression tests.
- `apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts`: lifecycle, bounds, trace, receipt, idempotency registry, completion subscriptions, and replay verification.
- `apps/web/src/lib/components/living-village/realtime-combat/combat-session.spec.ts`: deterministic session, claims, limits, duplicate entry, callback, pause-independent, and replay tests.
- `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`: existing Pixi scene that accepts a request, owns its unified `CombatSession`, and loads request-owned assets.
- `apps/web/src/routes/living-village-lab/realtime-combat/+page.svelte`: rat fixture entry, terminal/rejection/unavailable UI, and non-claiming replay.
- `apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts`: presentation continuity, terminal receipt, replay, reduced-motion, mobile, and failed-asset coverage.

---

### Task 1: Define the strict exploration-combat contract

**Files:**

- Create: `packages/contracts/src/exploration-combat.ts`
- Create: `packages/contracts/src/exploration-combat.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: `StateHashSchema`, `ContentVersionSchema`, and `IsoDateTimeSchema` from `packages/contracts/src/shared.ts`.
- Produces: `ExplorationEncounterRequestSchema`, `ExplorationCombatReceiptSchema`, `ExplorationCombatReplayRefSchema`, `ExplorationCombatRejectionSchema`, all nested schemas, and their inferred TypeScript types.

- [ ] **Step 1: Write the failing minimum-request and ownership-boundary tests**

Create a local `validRequest()` builder whose IDs, hashes, one hero, one required enemy, battlefield, bounds, and presentation bindings satisfy the exact public shape. Start with these assertions:

```ts
import { describe, expect, it } from 'vitest';

import {
	ExplorationCombatReceiptSchema,
	ExplorationCombatReplayRefSchema,
	ExplorationEncounterRequestSchema
} from './exploration-combat.js';

describe('exploration combat contracts', () => {
	it('accepts one frozen bounded encounter request', () => {
		const parsed = ExplorationEncounterRequestSchema.parse(validRequest());
		expect(parsed.bounds).toEqual({
			maximumCombatants: 2,
			maximumSimulationTicks: 3_600,
			maximumTraceEvents: 500
		});
	});

	it.each(['explorationPosition', 'fog', 'tileInteractions', 'lootCache', 'rewardBalance'])(
		'rejects the foreign ownership field %s',
		(field) => {
			expect(() =>
				ExplorationEncounterRequestSchema.parse({ ...validRequest(), [field]: {} })
			).toThrow();
		}
	);

	it('rejects duplicate units, invalid resources, absent required enemies, and unused headroom', () => {
		const request = validRequest();
		expect(() =>
			ExplorationEncounterRequestSchema.parse({
				...request,
				party: [request.party[0], request.party[0]]
			})
		).toThrow(/unique/i);
		expect(() =>
			ExplorationEncounterRequestSchema.parse({
				...request,
				party: [{ ...request.party[0], resources: { health: 101, maximumHealth: 100, mana: 0, maximumMana: 0 } }]
			})
		).toThrow(/health/i);
		expect(() =>
			ExplorationEncounterRequestSchema.parse({
				...request,
				enemies: request.enemies.map((enemy) => ({ ...enemy, requiredForVictory: false }))
			})
		).toThrow(/required/i);
		expect(() =>
			ExplorationEncounterRequestSchema.parse({
				...request,
				bounds: { ...request.bounds, maximumCombatants: 3 }
			})
		).toThrow(/maximumCombatants/i);
	});
});
```

- [ ] **Step 2: Run the focused contract test and verify the missing-module failure**

Run:

```bash
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
```

Expected: FAIL because `./exploration-combat.js` does not exist.

- [ ] **Step 3: Implement the nested schemas and request invariants**

Use strict objects throughout. Keep URL-bearing fixture bindings relative to the web origin, and bind both spritesheet JSON and atlas-image hashes:

```ts
const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{2,119}$/u);
const UnitIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,119}$/u);
const AssetStatusSchema = z.enum(['production', 'fixture']);

export const CombatRasterBindingSchema = z.object({
	assetKey: SlugSchema,
	source: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.(?:png|webp)$/u),
	contentHash: StateHashSchema,
	status: AssetStatusSchema,
	approvalId: SlugSchema
}).strict();

export const CombatMotionPackBindingSchema = z.object({
	motionPackId: SlugSchema,
	source: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.json$/u),
	atlasImageSource: z.string().regex(/^\/runtime\/[a-z0-9./-]+\.(?:png|webp)$/u),
	version: z.number().int().positive(),
	contentHash: StateHashSchema,
	atlasImageHash: StateHashSchema,
	status: AssetStatusSchema,
	approvalId: SlugSchema
}).strict();

const CombatResourcesSchema = z.object({
	health: z.number().int().nonnegative(),
	maximumHealth: z.number().int().positive(),
	mana: z.number().int().nonnegative(),
	maximumMana: z.number().int().nonnegative()
}).strict().superRefine((resources, context) => {
	if (resources.health > resources.maximumHealth) {
		context.addIssue({ code: 'custom', path: ['health'], message: 'Health exceeds maximumHealth' });
	}
	if (resources.mana > resources.maximumMana) {
		context.addIssue({ code: 'custom', path: ['mana'], message: 'Mana exceeds maximumMana' });
	}
});

const CombatProfileSchema = z.object({
	movementUnitsPerSecond: z.number().finite().positive().max(4),
	attackRange: z.number().finite().positive().max(2),
	attackPower: z.number().int().positive().max(100_000),
	armour: z.number().int().nonnegative().max(100_000),
	attackIntervalTicks: z.number().int().positive().max(36_000)
}).strict();

const DeploymentSchema = z.object({
	x: z.number().finite().min(0).max(1),
	y: z.number().finite().min(0).max(1)
}).strict();

const CombatPresentationBindingSchema = z.object({
	combatAssetBinding: CombatRasterBindingSchema,
	motionPackBinding: CombatMotionPackBindingSchema,
	visualTuning: z.object({
		bodyOffsetY: z.number().finite().min(-200).max(200),
		shadowRadiusX: z.number().finite().positive().max(400),
		shadowRadiusY: z.number().finite().positive().max(200),
		displaySize: z.number().finite().positive().max(600)
	}).strict()
}).strict();

export const ExplorationCombatHeroSchema = z.object({
	heroRef: z.object({
		heroId: UnitIdSchema,
		characterManifestHash: StateHashSchema,
		lifeState: z.literal('combat-capable'),
		availabilityRevision: z.number().int().nonnegative(),
		rulesetVersion: ContentVersionSchema
	}).strict(),
	displayName: z.string().min(1).max(80),
	resources: CombatResourcesSchema,
	capability: z.object({
		capabilitySnapshotHash: StateHashSchema,
		loadoutHash: StateHashSchema,
		actionDefinitionRefs: z.array(SlugSchema).min(1).max(20),
		combatRole: z.enum(['brawler', 'guardian', 'archer'])
	}).strict(),
	combatProfile: CombatProfileSchema,
	deployment: DeploymentSchema,
	presentation: CombatPresentationBindingSchema
}).strict();

export const ExplorationCombatEnemySchema = z.object({
	enemyInstanceId: UnitIdSchema,
	displayName: z.string().min(1).max(80),
	definitionRef: z.object({
		enemyDefinitionId: SlugSchema,
		definitionVersion: ContentVersionSchema,
		contentHash: StateHashSchema
	}).strict(),
	resources: CombatResourcesSchema,
	combatRole: z.enum(['brute', 'swarm']),
	actionDefinitionRefs: z.array(SlugSchema).min(1).max(20),
	combatProfile: CombatProfileSchema,
	deployment: DeploymentSchema,
	requiredForVictory: z.boolean(),
	presentation: CombatPresentationBindingSchema
}).strict();

export const CombatContentBindingSchema = z.object({
	kind: z.enum(['ruleset', 'action', 'enemy', 'claim-policy', 'battlefield']),
	contentId: SlugSchema,
	version: ContentVersionSchema,
	contentHash: StateHashSchema
}).strict();

export const ExplorationEncounterRequestSchema = z.object({
	schemaVersion: z.literal('exploration-encounter-request-v1'),
	requestId: z.string().uuid(),
	idempotencyKey: SlugSchema,
	runId: z.string().uuid(),
	correlationId: z.string().uuid(),
	causationId: z.string().uuid().optional(),
	encounterId: SlugSchema,
	explorationAttemptId: z.string().uuid(),
	observedGameTime: IsoDateTimeSchema,
	expectedExplorationStateHash: StateHashSchema,
	rulesetVersion: ContentVersionSchema,
	contentBindings: z.array(CombatContentBindingSchema).min(1).max(100),
	seed: z.string().min(1).max(200),
	entropyCursor: z.number().int().nonnegative(),
	visualStatus: AssetStatusSchema,
	party: z.array(ExplorationCombatHeroSchema).min(1).max(8),
	enemies: z.array(ExplorationCombatEnemySchema).min(1).max(40),
	battlefieldBinding: z.object({
		battlefieldId: SlugSchema,
		version: ContentVersionSchema,
		contentHash: StateHashSchema,
		environmentAssetBinding: CombatRasterBindingSchema,
		occluderAssetBindings: z.array(CombatRasterBindingSchema).max(20)
	}).strict(),
	bounds: z.object({
		maximumCombatants: z.number().int().min(2).max(48),
		maximumSimulationTicks: z.number().int().positive().max(216_000),
		maximumTraceEvents: z.number().int().min(2).max(10_000)
	}).strict(),
	requestHash: StateHashSchema
}).strict().superRefine(validateEncounterRequest);
```

Add uniqueness refinements for each action-reference array and each content binding's `(kind, contentId, version)` tuple. Export every schema above plus inferred `ExplorationCombatHero`, `ExplorationCombatEnemy`, `CombatContentBinding`, and `ExplorationEncounterRequest` types.

Apply one request-level `superRefine` that enforces:

```ts
const allUnitIds = [
	...request.party.map((hero) => hero.heroRef.heroId),
	...request.enemies.map((enemy) => enemy.enemyInstanceId)
];
if (new Set(allUnitIds).size !== allUnitIds.length) issue('Participant IDs must be unique');
if (!request.enemies.some((enemy) => enemy.requiredForVictory)) issue('At least one enemy is required for victory');
if (request.bounds.maximumCombatants !== allUnitIds.length) issue('maximumCombatants must equal declared participants');
if (request.visualStatus === 'production' && [...request.party, ...request.enemies].some(hasFixtureBinding)) {
	issue('Production encounters require production-approved raster and motion bindings');
}
```

The request limits are encoded in the schema: party `.min(1).max(8)`, enemies `.min(1).max(40)`, total participants at most 48, simulation ticks `.max(216_000)`, and trace events `.max(10_000)`.

- [ ] **Step 4: Add failing receipt, claims, replay, and rejection tests**

Test representative victory and defeat receipts plus the relational failures:

```ts
it('accepts a victory receipt with final resources, claims, and a replay reference', () => {
	const receipt = validVictoryReceipt();
	expect(ExplorationCombatReceiptSchema.parse(receipt).outcome).toBe('victory');
	expect(receipt.ownership).toEqual({
		explorationMutated: false,
		progressionCommitted: false,
		inventoryCommitted: false,
		lootCacheMutated: false
	});
});

it('rejects contradictory terminal evidence and claims without source events', () => {
	const receipt = validVictoryReceipt();
	expect(() => ExplorationCombatReceiptSchema.parse({
		...receipt,
		finalEnemies: receipt.finalEnemies.map((enemy) => ({ ...enemy, health: 1, combatState: 'combat-capable' }))
	})).toThrow(/victory/i);
	expect(() => ExplorationCombatReceiptSchema.parse({
		...receipt,
		claims: [{ ...receipt.claims[0], sourceEventIds: ['missing-event'] }]
	})).toThrow(/source event/i);
});

it('rejects a replay reference whose receipt identity is absent', () => {
	const replay = validVictoryReceipt().replayRef;
	expect(() => ExplorationCombatReplayRefSchema.parse({ ...replay, receiptId: '' })).toThrow();
});
```

- [ ] **Step 5: Implement trace, claim, receipt, replay, and rejection schemas**

Use these public discriminants and terminal shapes:

```ts
export const ExplorationCombatEventKindSchema = z.enum([
	'encounter-started', 'intent-selected', 'movement-committed', 'action-started',
	'action-resolved', 'resource-changed', 'unit-defeated', 'encounter-ended'
]);

export const ExplorationCombatEventSchema = z.object({
	eventId: z.string().uuid(),
	sequence: z.number().int().nonnegative(),
	simulationTick: z.number().int().nonnegative(),
	kind: ExplorationCombatEventKindSchema,
	actorId: UnitIdSchema,
	targetIds: z.array(UnitIdSchema),
	actionId: SlugSchema.optional(),
	healthDeltas: z.array(z.object({ unitId: UnitIdSchema, amount: z.number().int() }).strict()),
	manaDeltas: z.array(z.object({ unitId: UnitIdSchema, amount: z.number().int() }).strict()),
	claimSourceRefs: z.array(SlugSchema),
	publicSummary: z.string().min(1).max(300)
}).strict();

const ClaimBaseSchema = z.object({
	claimId: z.string().uuid(),
	definitionRef: z.object({
		definitionId: SlugSchema,
		version: ContentVersionSchema,
		contentHash: StateHashSchema
	}).strict(),
	quantity: z.number().int().positive(),
	sourceEventIds: z.array(z.string().uuid()).min(1)
});

const ProgressionXpClaimSchema = ClaimBaseSchema.extend({
	kind: z.literal('progression-xp'),
	heroId: UnitIdSchema
}).strict();

const SkillPracticeClaimSchema = ClaimBaseSchema.extend({
	kind: z.literal('skill-practice'),
	heroId: UnitIdSchema,
	actionDefinitionId: SlugSchema
}).strict();

const MaterialClaimSchema = ClaimBaseSchema.extend({
	kind: z.literal('material'),
	sourceEnemyInstanceId: UnitIdSchema,
	materialDefinitionId: SlugSchema
}).strict();

export const ExplorationCombatClaimSchema = z.discriminatedUnion('kind', [
	ProgressionXpClaimSchema,
	SkillPracticeClaimSchema,
	MaterialClaimSchema
]);

const FinalCombatHeroSchema = z.object({
	heroId: UnitIdSchema,
	health: z.number().int().nonnegative(),
	maximumHealth: z.number().int().positive(),
	mana: z.number().int().nonnegative(),
	maximumMana: z.number().int().nonnegative(),
	combatState: z.enum(['combat-capable', 'defeated'])
}).strict();

const FinalCombatEnemySchema = z.object({
	enemyInstanceId: UnitIdSchema,
	health: z.number().int().nonnegative(),
	maximumHealth: z.number().int().positive(),
	mana: z.number().int().nonnegative(),
	maximumMana: z.number().int().nonnegative(),
	combatState: z.enum(['combat-capable', 'defeated']),
	requiredForVictory: z.boolean()
}).strict();

const ExplorationCombatDecisiveCauseSchema = z.object({
	code: z.enum(['enemies-defeated', 'heroes-defeated', 'encounter-limit-reached']),
	summary: z.string().min(1).max(300),
	supportingEventIds: z.array(z.string().uuid()).min(1)
}).strict();

export const ExplorationCombatReplayRefSchema = z.object({
	replayVersion: z.literal('exploration-combat-replay-v1'),
	requestId: z.string().uuid(),
	requestHash: StateHashSchema,
	receiptId: z.string().uuid(),
	traceHash: StateHashSchema,
	rulesetVersion: ContentVersionSchema,
	seed: z.string().min(1).max(200),
	entropyCursor: z.number().int().nonnegative(),
	battlefieldBindingHash: StateHashSchema,
	participantPresentationBindingsHash: StateHashSchema
}).strict();

export const ExplorationCombatReceiptSchema = z.object({
	schemaVersion: z.literal('exploration-combat-receipt-v1'),
	receiptId: z.string().uuid(),
	requestId: z.string().uuid(),
	idempotencyKey: SlugSchema,
	requestHash: StateHashSchema,
	runId: z.string().uuid(),
	correlationId: z.string().uuid(),
	encounterId: SlugSchema,
	explorationAttemptId: z.string().uuid(),
	rulesetVersion: ContentVersionSchema,
	contentBindings: z.array(CombatContentBindingSchema).min(1),
	startedAtTick: z.number().int().nonnegative(),
	endedAtTick: z.number().int().nonnegative(),
	outcome: z.enum(['victory', 'defeat']),
	decisiveCause: ExplorationCombatDecisiveCauseSchema,
	finalHeroes: z.array(FinalCombatHeroSchema).min(1).max(8),
	finalEnemies: z.array(FinalCombatEnemySchema).min(1).max(40),
	defeatedEnemyIds: z.array(UnitIdSchema),
	events: z.array(ExplorationCombatEventSchema).min(2).max(10_000),
	claims: z.array(ExplorationCombatClaimSchema),
	inputStateHash: StateHashSchema,
	outputStateHash: StateHashSchema,
	traceHash: StateHashSchema,
	replayRef: ExplorationCombatReplayRefSchema,
	ownership: z.object({
		explorationMutated: z.literal(false),
		progressionCommitted: z.literal(false),
		inventoryCommitted: z.literal(false),
		lootCacheMutated: z.literal(false)
	}).strict()
}).strict().superRefine(validateTerminalReceipt);
```

`validateTerminalReceipt` checks increasing contiguous event sequence, unique event/claim IDs, terminal event last, claim source IDs present, hero/enemy uniqueness, defeated-enemy agreement, victory requiring all required enemies defeated, hero defeat requiring all heroes defeated, encounter-limit defeat accepting surviving units, and replay/request/receipt hash references agreeing.

Define the rejection without outcome or claims:

```ts
export const ExplorationCombatRejectionSchema = z.object({
	schemaVersion: z.literal('exploration-combat-rejection-v1'),
	requestId: z.string().uuid().optional(),
	code: z.enum([
		'invalid-request', 'request-hash-mismatch', 'idempotency-conflict',
		'unsupported-ruleset', 'stale-content-binding', 'invalid-party',
		'invalid-enemy-set', 'invalid-bounds', 'unapproved-character-art'
	]),
	summary: z.string().min(1).max(300),
	fieldPaths: z.array(z.string().min(1).max(200))
}).strict();
```

- [ ] **Step 6: Export the contract and run the focused package checks**

Add:

```ts
export * from './exploration-combat.js';
```

Run:

```bash
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/contracts lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the shared contract**

```bash
git add packages/contracts/src/exploration-combat.ts packages/contracts/src/exploration-combat.spec.ts packages/contracts/src/index.ts
git commit -m "feat(combat): define exploration encounter contracts"
```

---

### Task 2: Express the rat study as a valid request and initialize mechanics from it

**Files:**

- Create: `apps/web/src/lib/components/living-village/realtime-combat/combat-hash.ts`
- Create: `apps/web/src/lib/components/living-village/realtime-combat/rat-encounter-fixture.ts`
- Create: `apps/web/src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts`

**Interfaces:**

- Consumes: `ExplorationEncounterRequest` and nested participant types from Task 1; `hashCanonical` and `deterministicUuid` from `@summonlab/engine`.
- Produces: `RAT_ENCOUNTER_REQUEST`, versioned `RAT_ENCOUNTER_CLAIM_POLICY` data, `combatFixtureAssetBindings()`, `combatRequestHash()`, `combatDeterministicId()`, `createRealtimeCombat(request)`, and `stepRealtimeCombat(state, 1 / 60)` returning mechanics events with the next state.

- [ ] **Step 1: Write failing hash and fixture-contract tests**

```ts
import { ExplorationEncounterRequestSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { combatRequestHash } from './combat-hash';
import { RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';

it('is a valid, self-hashed eight-actor fixture request', () => {
	const parsed = ExplorationEncounterRequestSchema.parse(RAT_ENCOUNTER_REQUEST);
	expect(parsed.party.map((hero) => hero.heroRef.heroId)).toEqual([
		'saffron-braid', 'iron-guardian', 'moss-archer'
	]);
	expect(parsed.enemies).toHaveLength(5);
	expect(parsed.bounds.maximumCombatants).toBe(8);
	expect(combatRequestHash(parsed)).toBe(parsed.requestHash);
});

it('binds every current raster and motion source by SHA-256', () => {
	const sources = combatFixtureAssetBindings(RAT_ENCOUNTER_REQUEST);
	expect(sources).toHaveLength(17);
	expect(new Set(sources.map((asset) => asset.contentHash)).size).toBe(17);
	expect(sources.every((asset) => asset.status === 'fixture')).toBe(true);
});
```

The 17 bound files are the environment, well occluder, five ready images, five spritesheet JSON files, and five atlas PNG files. Use the actual hashes recorded during design inspection; do not use repeated dummy hashes.

- [ ] **Step 2: Run the fixture test and verify the missing-module failure**

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts
```

Expected: FAIL because `combat-hash.ts` and `rat-encounter-fixture.ts` do not exist.

- [ ] **Step 3: Implement canonical combat hashing**

```ts
import type { ExplorationEncounterRequest } from '@summonlab/contracts';
import { deterministicUuid, hashCanonical } from '@summonlab/engine';

export function combatRequestHash(request: ExplorationEncounterRequest): string {
	const { requestHash: _requestHash, ...body } = request;
	return hashCanonical(body);
}

export function combatDeterministicId(namespace: string, value: unknown): string {
	return deterministicUuid(`${namespace}:${hashCanonical(value)}`);
}

export function combatValueHash(value: unknown): string {
	return hashCanonical(value);
}
```

This reuses the repository's browser-safe `@noble/hashes` implementation transitively through the already-declared web dependency on `@summonlab/engine`; do not introduce Node `crypto` into the client bundle.

- [ ] **Step 4: Create the exact rat request and content policy**

Build a request body, calculate its hash once, parse it through the shared schema, and freeze it:

```ts
const RAT_REQUEST_BODY = {
	schemaVersion: 'exploration-encounter-request-v1',
	requestId: '79fd92ca-7f3f-4c32-91ef-4a5953832f51',
	idempotencyKey: 'rat-study-field-test-01',
	runId: 'a51a5e3b-f026-41e6-91b6-4ce4d13ba36a',
	correlationId: 'be3471d3-f0fd-4c50-98e6-fc1f82e4d9f7',
	encounterId: 'ruined-threshold-rat-pack-01',
	explorationAttemptId: '6b348baf-af20-4cf3-bba2-2c365ddcccf0',
	observedGameTime: '2026-09-07T12:00:00.000-07:00',
	expectedExplorationStateHash: 'd'.repeat(64),
	rulesetVersion: 'realtime-rat-combat-v1',
	seed: 'rat-study-seed-v1',
	entropyCursor: 0,
	visualStatus: 'fixture',
	party: [asha, toma, nessa],
	enemies: [ratBrute, ...lesserRats],
	battlefieldBinding: ruinedThreshold,
	contentBindings: RAT_CONTENT_BINDINGS,
	bounds: { maximumCombatants: 8, maximumSimulationTicks: 3_600, maximumTraceEvents: 2_000 }
} satisfies Omit<ExplorationEncounterRequest, 'requestHash'>;

export const RAT_ENCOUNTER_REQUEST = deepFreeze(
	ExplorationEncounterRequestSchema.parse({
		...RAT_REQUEST_BODY,
		requestHash: hashCanonical(RAT_REQUEST_BODY)
	})
);
```

Preserve the effective fixed-step mechanics exactly: Asha `168/0`, speed `0.082`, range `0.075`, power `19`, interval `47` ticks; Toma `238/0`, `0.063`, `0.08`, `14`, `57`; Nessa `126/40`, `0.071`, `0.25`, `17`, `65`; Rat Brute `242/0`, `0.052`, `0.09`, `18`, `72`; each lesser rat `58/0`, `0.092`, `0.062`, `9`, and intervals `56`, `58`, `60`, `63`. These integer intervals are the ceiling of the current seconds at 60 Hz. Use deployments already present in `createRealtimeCombat()`.

Bind the current files and exact inspected hashes, including:

```ts
const FIXTURE_HASHES = {
	environment: 'cb6db22b2c162f090cfdc3c4ca7be9eb44a7bcc635437ec42679a33e66640063',
	well: '3daa98cddde1994dc3b76bbdc7fa18e6b495a2d80eeccbad62f230b4fad0e129',
	ashaReady: '9f6704c825a642c1664cc34573a2e2264a9d3d2f0cf85c5f65ee6c09f4bb5a2b',
	tomaReady: '66b7017812f2bd218a221d5f19b26b861951350293e6b7692bc055d0c46ec114',
	nessaReady: '9c94401448f51dc6521c7aae3d00fa15e47bc4b27c452b666023f1d5fcd5bb36',
	ratBruteReady: 'd7850557ee7c04fd088ec4b48cf3dfe2db098887c7ab0205b0eea8e47b3876b2',
	lesserRatReady: '2715adb8ecf78a93ccccaabd55272046206bb489ad1c897aef7b87fff3db4860'
} as const;
```

Record the JSON and atlas hashes for Asha v2, Toma v5, Nessa v4, Rat Brute v1, and Lesser Rat v2 in the corresponding motion bindings. `RAT_ENCOUNTER_CLAIM_POLICY` is a versioned fixture policy descriptor, not reward balance inside the request:

```ts
const FIXTURE_MOTION_HASHES = {
	asha: {
		json: '6584b2642f98eb907ca2bae317016ed030f14d92aa4490af5aa09ef4be3e2308',
		atlas: '11d40da687b1795f8a8797ba09c348f332100a8d0b1d6420544d19830a82f996'
	},
	'iron-guardian': {
		json: '8d949316d0e09b4f87965bf772dace215b1a194e647befe47f857d56f34a717f',
		atlas: '7570e5324e42b3d0c8403990f25ea525b4e7231c67d2b52ae01156853aa7858a'
	},
	'moss-archer': {
		json: '0f304fbca4cabf8487db72a7b8dbef9c558d615219cce5281de385a1dbb1aeab',
		atlas: '33e8e9eb65e84e23d84cdb56fd8f14a633624fc5e3809ebc4853f38a92ae77f5'
	},
	'rat-brute': {
		json: '735767a1122eca708c8c4602e8adac06cf0faf84626778fd0ab187ce5d5cb1fe',
		atlas: '4b6960602cd66044659b23f3bc4b6757ad0f19a18db7dcedc164d7e5baa5e7cc'
	},
	'lesser-rat': {
		json: '5c56e9d0d3d2e508dbb58f2f4fc3bfec86cbd6a4c29340af6b9c2bb5391c7148',
		atlas: '56a3338099ac3d71238d3c0406a91d6519b5246771f0cdde63bf3fcf0019ce0b'
	}
} as const;

const RAT_CLAIM_VALUES = {
	xpPerDefeatedEnemy: 4,
	practicePerAction: 1,
	materialByEnemyDefinitionId: {
		'rat-brute': { materialDefinitionId: 'plague-rat-tail', quantity: 1 },
		'plague-rat': { materialDefinitionId: 'plague-rat-tail', quantity: 1 }
	}
} as const;

export const RAT_ENCOUNTER_CLAIM_POLICY = {
	contentId: 'rat-study-claims',
	version: 'rat-study-claims-v1',
	contentHash: combatValueHash(RAT_CLAIM_VALUES),
	...RAT_CLAIM_VALUES
} as const;
```

- [ ] **Step 5: Write failing request-projection and mechanics-event tests**

Replace zero-argument construction in `realtime-combat.spec.ts` and add explicit event assertions:

```ts
it('projects every actor and resource from the encounter request', () => {
	const state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
	expect(state.actors.map((actor) => actor.id)).toEqual([
		'saffron-braid', 'iron-guardian', 'moss-archer', 'rat-brute',
		'plague-rat-1', 'plague-rat-2', 'plague-rat-3', 'plague-rat-4'
	]);
	expect(state.actors.find((actor) => actor.id === 'moss-archer')).toMatchObject({
		health: 126, mana: 40, x: 0.66, y: 0.88
	});
});

it('emits authoritative action and resource events without presentation frames', () => {
	let state = createRealtimeCombat(RAT_ENCOUNTER_REQUEST);
	let actionEvents = [];
	for (let tick = 0; tick < 600 && actionEvents.length === 0; tick += 1) {
		const stepped = stepRealtimeCombat(state, 1 / 60);
		state = stepped.state;
		actionEvents = stepped.events.filter((event) => event.kind === 'action-resolved');
	}
	expect(actionEvents[0]).toMatchObject({ actorId: expect.any(String), targetIds: [expect.any(String)] });
});
```

- [ ] **Step 6: Refactor mechanics to consume the request**

Extend `RealtimeActor` with `sourceKind`, `mana`, `maximumMana`, `actionDefinitionRefs`, `requiredForVictory`, and `presentation`. Replace the hard-coded actor array with request projection:

```ts
export function createRealtimeCombat(request: ExplorationEncounterRequest): RealtimeCombatState {
	return {
		elapsedSeconds: 0,
		phase: 'running',
		defeatedEnemies: 0,
		lastEvent: 'The rat pack breaks from the ruined gate.',
		actors: [
			...request.party.map((hero) => actorFromHero(hero)),
			...request.enemies.map((enemy) => actorFromEnemy(enemy))
		]
	};
}

export type RealtimeMechanicsEvent = Readonly<{
	kind: 'intent-selected' | 'movement-committed' | 'action-started' | 'action-resolved' | 'resource-changed' | 'unit-defeated';
	actorId: string;
	targetIds: readonly string[];
	actionId?: string;
	healthDeltas: readonly { unitId: string; amount: number }[];
	manaDeltas: readonly { unitId: string; amount: number }[];
	publicSummary: string;
}>;

export function stepRealtimeCombat(
	previous: RealtimeCombatState,
	deltaSeconds: number
): { state: RealtimeCombatState; events: RealtimeMechanicsEvent[] };
```

Victory checks only living enemies whose request entry has `requiredForVictory`. Rename rat-specific counters to `defeatedEnemies`. Preserve Saffron Arc by checking the bound action ID `saffron-arc-v1`, not Asha's actor ID. Record state changes needed by animation (`actionRevision`, `hitRevision`, `defeatRevision`) exactly as before.

Update `runRealtimeCombat(request, seconds, step)` to consume `.state` from each mechanics step. Update all existing mechanics tests to pass `RAT_ENCOUNTER_REQUEST` and preserve the deterministic victory, well collision, target commitment, engagement lock, and arena-margin assertions.

- [ ] **Step 7: Make motion diagnostics consume request bindings**

Keep `createMotionPack()` for validation, but replace the hard-coded `REALTIME_COMBAT_MOTION` public dependency with:

```ts
export function motionPackVersionDiagnostic(
	bindings: readonly { motionPackId: string; version: number }[]
): string {
	return bindings.map((binding) => `${binding.motionPackId}:${binding.version}`).join(',');
}
```

The rat fixture must still produce `asha:2,iron-guardian:5,moss-archer:4,rat-brute:1,lesser-rat:2` after de-duplicating shared lesser-rat bindings in actor order.

- [ ] **Step 8: Run the complete fixture/mechanics regression set**

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts \
  src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: all commands exit 0 and the rat fixture still ends in deterministic victory.

- [ ] **Step 9: Commit the request-driven fixture and mechanics**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat
git commit -m "feat(combat): drive rat encounter from contract"
```

---

### Task 3: Build the bounded unified combat session and terminal receipt

**Files:**

- Create: `apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts`
- Create: `apps/web/src/lib/components/living-village/realtime-combat/combat-session.spec.ts`

**Interfaces:**

- Consumes: request/receipt/event/claim schemas from Task 1; request projection and mechanics events from Task 2; the versioned rat claim-policy data supplied as a dependency.
- Produces: `createCombatSession()`, `CombatSession`, `CombatSessionSnapshot`, `CombatUnavailableState`, and `CombatClaimPolicy`.

- [ ] **Step 1: Write failing lifecycle, immutability, fixed-step, and terminal tests**

```ts
import { describe, expect, it, vi } from 'vitest';

import { RAT_ENCOUNTER_CLAIM_POLICY, RAT_ENCOUNTER_REQUEST } from './rat-encounter-fixture';
import { createCombatSession } from './combat-session';

const dependencies = {
	claimPolicy: RAT_ENCOUNTER_CLAIM_POLICY,
	fixtureRequestHash: RAT_ENCOUNTER_REQUEST.requestHash
};

function runToTerminal(session: CombatSession) {
	session.markAssetsReady();
	while (session.status === 'running') session.advanceFixedStep();
	return session.receipt!;
}

it('does not mutate the deeply frozen request', () => {
	const before = structuredClone(RAT_ENCOUNTER_REQUEST);
	const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
	runToTerminal(session);
	expect(RAT_ENCOUNTER_REQUEST).toEqual(before);
});

it('produces byte-identical victory receipts from identical requests', () => {
	const first = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
	const second = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
	expect(second).toEqual(first);
	expect(first.outcome).toBe('victory');
	expect(first.finalHeroes).toHaveLength(3);
	expect(first.finalEnemies.every((enemy) => enemy.health === 0)).toBe(true);
});

it('reserves one event for bounded terminal defeat', () => {
	const request = withRehashedRequest(RAT_ENCOUNTER_REQUEST, {
		bounds: { maximumCombatants: 8, maximumSimulationTicks: 3_600, maximumTraceEvents: 2 }
	});
	const receipt = runToTerminal(createCombatSession(request, dependencies));
	expect(receipt).toMatchObject({ outcome: 'defeat', decisiveCause: { code: 'encounter-limit-reached' } });
	expect(receipt.events).toHaveLength(2);
	expect(receipt.events.at(-1)?.kind).toBe('encounter-ended');
});
```

Add distinct tests for all-heroes-defeated, trace-limit defeat, request-hash mismatch, unsupported rules/content bindings, production request with fixture art, and `markUnavailable()` producing no receipt.

- [ ] **Step 2: Run the session test and verify the missing-module failure**

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
```

Expected: FAIL because `combat-session.ts` does not exist.

- [ ] **Step 3: Implement validation and the explicit lifecycle**

```ts
export type CombatSessionStatus =
	| 'loading' | 'ready' | 'running' | 'victory' | 'defeat' | 'rejected' | 'unavailable';

export type CombatUnavailableState = Readonly<{
	code: 'asset-load-failed' | 'renderer-initialization-failed';
	message: string;
}>;

export interface CombatSession {
	readonly request: ExplorationEncounterRequest;
	readonly status: CombatSessionStatus;
	readonly combat: RealtimeCombatState;
	readonly receipt?: ExplorationCombatReceipt;
	readonly rejection?: ExplorationCombatRejection;
	readonly unavailable?: CombatUnavailableState;
	markAssetsReady(): void;
	markUnavailable(state: CombatUnavailableState): void;
	advanceFixedStep(): CombatSessionSnapshot;
	subscribe(listener: CombatSessionListener): () => void;
}

export type CombatSessionDependencies = Readonly<{
	claimPolicy: CombatClaimPolicy;
	fixtureRequestHash?: string;
}>;

export function createCombatSession(
	input: ExplorationEncounterRequest,
	dependencies: CombatSessionDependencies
): CombatSession;
```

Construction parses the strict schema, recomputes `combatRequestHash`, checks `rulesetVersion`, verifies every declared content binding against the supplied claim policy, rejects production/fixture art mismatches, copies the frozen projection into `RealtimeCombatState`, and emits sequence `0` `encounter-started`. A fixture request is accepted only when `dependencies.fixtureRequestHash === request.requestHash`; production integrations omit this exemption. Validation failures set `rejected` before any asset load or simulation.

`markAssetsReady()` performs `loading -> ready -> running`. Calls from another state are idempotent no-ops. `markUnavailable()` is valid only during loading/ready and stores no gameplay outcome.

- [ ] **Step 4: Implement bounded event capture and fixed-step advancement**

Use integer `simulationTick` as authority and `1 / 60` only at the mechanics boundary. Accept a mechanics step atomically: if all of its events do not fit before the reserved terminal slot, retain the prior combat state and end at the trace bound instead of partially applying an untraceable step.

```ts
function advanceFixedStep(): CombatSessionSnapshot {
	if (status !== 'running') return snapshot();
	if (simulationTick >= request.bounds.maximumSimulationTicks) {
		finish('defeat', 'encounter-limit-reached');
		return snapshot();
	}
	const stepped = stepRealtimeCombat(combat, 1 / 60);
	if (trace.length + stepped.events.length > request.bounds.maximumTraceEvents - 1) {
		finish('defeat', 'encounter-limit-reached');
		return snapshot();
	}
	combat = stepped.state;
	simulationTick += 1;
	for (const event of stepped.events) {
		trace.push(toContractEvent(event, simulationTick, trace.length));
	}
	if (status === 'running' && combat.phase === 'victory') finish('victory', 'enemies-defeated');
	if (status === 'running' && combat.phase === 'defeat') finish('defeat', 'heroes-defeated');
	return snapshot();
}
```

Do not record camera, fog, particles, interpolation, sprite frames, pause, or lens switches. Collapse repeated per-tick movement into a `movement-committed` event only when an actor selects a new goal or crosses a meaningful movement segment boundary, so the normal encounter stays well below 2,000 trace events.

- [ ] **Step 5: Implement deterministic fixture claims and receipt hashing**

Define the generic policy interface and let the rat fixture policy values drive claims:

```ts
export type CombatClaimPolicy = Readonly<{
	readonly contentId: string;
	readonly version: string;
	readonly contentHash: string;
	readonly xpPerDefeatedEnemy: number;
	readonly practicePerAction: number;
	readonly materialByEnemyDefinitionId: Readonly<Record<string, Readonly<{
		materialDefinitionId: string;
		quantity: number;
	}>>>;
}>;
```

The session interprets only this bounded policy shape. For the rat fixture, emit one XP claim per hero from the terminal event (`defeated enemy count × 4`), one aggregated skill-practice claim per hero/action from its `action-resolved` event IDs, and one rat-tail material claim per defeated enemy from that enemy's `unit-defeated` event (`quantity: 1`). Claims remain uncommitted and are sorted by `claimId` before hashing.

Receipt assembly order is fixed:

1. Append the reserved `encounter-ended` event.
2. Project every requested hero and enemy to final Health/Mana/combat state.
3. Build and sort claims.
4. Compute `inputStateHash`, `traceHash`, and `outputStateHash` with `combatValueHash`.
5. Derive `receiptId` with `combatDeterministicId('exploration-combat-receipt-v1', { requestHash, traceHash })`.
6. Build `replayRef` from the exact request/receipt/rules/seed/battlefield/presentation hashes.
7. Parse through `ExplorationCombatReceiptSchema`, deep-freeze once, set terminal status, then notify listeners once.

`inputStateHash` covers the initial resources, combat profiles, actions, deployments, seed/cursor, rules/content bindings, bounds, and battlefield; it deliberately excludes `expectedExplorationStateHash`. `finish()` also sets `combat.phase` to the terminal outcome so the existing HUD snapshot and the receipt cannot disagree.

- [ ] **Step 6: Test render-delta independence and pause/reduced-motion exclusion**

The session accepts only fixed steps; test two render accumulator schedules outside it:

```ts
function runWithFrames(frameSeconds: readonly number[]) {
	const session = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
	session.markAssetsReady();
	let accumulator = 0;
	for (let frame = 0; session.status === 'running'; frame += 1) {
		accumulator += frameSeconds[frame % frameSeconds.length]!;
		while (accumulator >= 1 / 60 && session.status === 'running') {
			session.advanceFixedStep();
			accumulator -= 1 / 60;
		}
	}
	return session.receipt;
}

expect(runWithFrames([1 / 60])).toEqual(runWithFrames([1 / 30, 1 / 120, 1 / 120]));
```

Also subscribe the same completion listener twice, unsubscribe one, and prove the remaining listener receives exactly one frozen receipt. Do not put `paused`, `reducedMotion`, or presentation mode into `CombatSession`.

- [ ] **Step 7: Run session and contract verification**

```bash
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/combat-session.spec.ts \
  src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: all commands exit 0; the two render schedules produce identical receipt objects.

- [ ] **Step 8: Commit the bounded session**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts apps/web/src/lib/components/living-village/realtime-combat/combat-session.spec.ts
git commit -m "feat(combat): produce bounded encounter receipts"
```

---

### Task 4: Add idempotent entry and self-verifying replay

**Files:**

- Modify: `apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/combat-session.spec.ts`

**Interfaces:**

- Consumes: `createCombatSession()` and immutable receipts from Task 3.
- Produces: `CombatSessionRegistry`, `enterCombatSession()`, `createReplayCombatSession()`, and `CombatReplayVerification`.

- [ ] **Step 1: Write failing duplicate-entry and conflict tests**

```ts
it('shares an active session and returns its frozen completed receipt', () => {
	const registry = new CombatSessionRegistry();
	const first = enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
	const duplicate = enterCombatSession(structuredClone(RAT_ENCOUNTER_REQUEST), dependencies, registry);
	expect(first.kind).toBe('session');
	expect(duplicate).toEqual(first);
	const receipt = runToTerminal(first.session);
	expect(enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry)).toEqual({
		kind: 'completed', receipt
	});
});

it('rejects one idempotency key with a different request hash', () => {
	const registry = new CombatSessionRegistry();
	enterCombatSession(RAT_ENCOUNTER_REQUEST, dependencies, registry);
	const collision = withRehashedRequest(RAT_ENCOUNTER_REQUEST, { seed: 'different-seed' });
	expect(enterCombatSession(collision, dependencies, registry)).toMatchObject({
		kind: 'rejected', rejection: { code: 'idempotency-conflict' }
	});
});
```

Add a re-entrant listener test: the completion callback calls `enterCombatSession()` with the same request and must receive `completed`, not create another session or claim set.

- [ ] **Step 2: Implement the registry transition before notification**

```ts
type RegistryEntry =
	| { status: 'active'; requestHash: string; session: CombatSession }
	| { status: 'completed'; requestHash: string; receipt: ExplorationCombatReceipt }
	| { status: 'rejected'; requestHash: string; rejection: ExplorationCombatRejection };

export class CombatSessionRegistry {
	readonly #entries = new Map<string, RegistryEntry>();
	get(idempotencyKey: string): RegistryEntry | undefined;
	setActive(request: ExplorationEncounterRequest, session: CombatSession): void;
	setCompleted(request: ExplorationEncounterRequest, receipt: ExplorationCombatReceipt): void;
	setRejected(request: ExplorationEncounterRequest, rejection: ExplorationCombatRejection): void;
	removeUnavailable(request: ExplorationEncounterRequest, session: CombatSession): void;
}
```

`enterCombatSession()` parses and hashes before registry lookup. For an identical active entry, return the same session object. For a completed or rejected entry, return the exact frozen terminal object. For a different hash, return a typed conflict rejection. Store deterministic post-parse rejections before returning them. Register an internal completion subscriber that calls `registry.setCompleted()` before user subscribers run. Remove unavailable sessions so the same request may retry; do not treat unmount as completion.

Use this exact entry boundary so invalid unknown input never reaches Pixi:

```ts
export type CombatSessionEntry =
	| { kind: 'session'; session: CombatSession }
	| { kind: 'completed'; receipt: ExplorationCombatReceipt }
	| { kind: 'rejected'; rejection: ExplorationCombatRejection };

export function enterCombatSession(
	input: unknown,
	dependencies: CombatSessionDependencies,
	registry: CombatSessionRegistry
): CombatSessionEntry;
```

- [ ] **Step 3: Write failing replay success and tamper tests**

```ts
it('replays deterministically without completion or claim publication', () => {
	const live = createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies);
	const receipt = runToTerminal(live);
	const onComplete = vi.fn();
	const replay = createReplayCombatSession(RAT_ENCOUNTER_REQUEST, receipt, dependencies);
	replay.subscribe({ onComplete });
	const verification = runReplayToTerminal(replay);
	expect(verification).toEqual({ kind: 'verified', receiptId: receipt.receiptId });
	expect(onComplete).not.toHaveBeenCalled();
});

it.each(['traceHash', 'outputStateHash'] as const)('fails closed when %s is changed', (field) => {
	const receipt = runToTerminal(createCombatSession(RAT_ENCOUNTER_REQUEST, dependencies));
	const tampered = { ...receipt, [field]: 'f'.repeat(64) };
	expect(runReplayToTerminal(createReplayCombatSession(RAT_ENCOUNTER_REQUEST, tampered, dependencies))).toMatchObject({
		kind: 'mismatch', field
	});
});
```

- [ ] **Step 4: Implement replay as the normal unified session in non-publishing mode**

```ts
export type CombatReplayVerification =
	| { kind: 'pending' }
	| { kind: 'verified'; receiptId: string }
	| { kind: 'mismatch'; field: 'requestHash' | 'traceHash' | 'outputStateHash' | 'receiptId' | 'rulesetVersion' | 'presentationBindings' };

export function createReplayCombatSession(
	request: ExplorationEncounterRequest,
	expectedReceipt: ExplorationCombatReceipt,
	dependencies: CombatSessionDependencies
): CombatSession;
```

Replay bypasses the idempotency registry, initializes the same mechanics and presentation bindings, advances the same fixed steps, reproduces claims internally for candidate-hash verification, and compares request, trace, output, receipt, rules, and presentation hashes. It exposes verification after terminal state but never publishes those claims and never emits `onComplete`.

- [ ] **Step 5: Run idempotency and replay tests**

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/combat-session.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: all duplicate, re-entrant, conflict, unavailable retry, verified replay, and tamper cases pass.

- [ ] **Step 6: Commit idempotent entry and replay**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/combat-session.ts apps/web/src/lib/components/living-village/realtime-combat/combat-session.spec.ts
git commit -m "feat(combat): make encounter entry idempotent"
```

---

### Task 5: Let the existing PixiJS presentation own the request-bound combat session

**Files:**

- Modify: `apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.ts`
- Modify: `apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts`

**Interfaces:**

- Consumes: one `ExplorationEncounterRequest`, a claim policy, the lab registry, and an optional expected receipt for replay. The stage enters or replays its own unified `CombatSession`; the request declares every raster/motion source.
- Produces: the same Pixi battlefield and animation presentation plus `onSnapshot`, `onComplete`, `onRejected`, `onUnavailable`, and replay-verification callbacks. It no longer creates hard-coded combat state, owns hard-coded art tables, or accepts `restartKey`.

- [ ] **Step 1: Add a failing request-owned visual registration test**

Extend registration so fixture-specific offsets are carried by the participant presentation binding instead of actor IDs:

```ts
it('uses request visual tuning without recognizing fixture identities', () => {
	const registration = actorVisualRegistration({
		role: 'guardian',
		clip: 'idle',
		visualTuning: { bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 }
	});
	expect(registration).toEqual({ bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 });
});
```

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
```

Expected: FAIL because the current function accepts `actorId`, `role`, and `clip` separately.

- [ ] **Step 2: Change the stage props and remove local simulation construction**

Use this prop boundary:

```ts
let {
	request,
	claimPolicy,
	registry,
	replayOf,
	mode,
	paused,
	reducedMotion,
	onSnapshot,
	onComplete,
	onRejected,
	onUnavailable,
	onReplayVerified
}: {
	request: ExplorationEncounterRequest;
	claimPolicy: CombatClaimPolicy;
	registry: CombatSessionRegistry;
	replayOf?: ExplorationCombatReceipt;
	mode: CombatPresentationMode;
	paused: boolean;
	reducedMotion: boolean;
	onSnapshot: (snapshot: RealtimeCombatState) => void;
	onComplete: (receipt: ExplorationCombatReceipt) => void;
	onRejected: (rejection: ExplorationCombatRejection) => void;
	onUnavailable: (state: CombatUnavailableState) => void;
	onReplayVerified: (verification: CombatReplayVerification) => void;
} = $props();
```

Delete imports and calls to zero-argument `createRealtimeCombat()`, the `restartKey` effect, `ART`, `REALTIME_COMBAT_MOTION`, and local hard-coded `motionSheets`. During component initialization, call `createReplayCombatSession(request, replayOf, dependencies)` when `replayOf` exists; otherwise call `enterCombatSession(request, dependencies, registry)`. Forward a rejection immediately, forward a completed registry receipt once, or retain the returned active session. A completed or rejected entry exits before `onMount` initializes Pixi. Set `simulation = session.combat`, and let the page wrap the component in a keyed block when changing live/replay instances.

- [ ] **Step 3: Load exact request-owned Pixi assets and map them by binding**

Derive a stable de-duplicated source list:

```ts
const rasterBindings = combatRasterBindings(request);
const motionBindings = combatMotionBindings(request);
const sources = [...rasterBindings.map((binding) => binding.source), ...motionBindings.map((binding) => binding.source)];
const textures = await Promise.all(sources.map((source) => Assets.load(source)));
const assetBySource = new Map(sources.map((source, index) => [source, textures[index]!]));
```

The five motion JSON sources load their declared atlas PNG dependencies; `atlasImageSource` and `atlasImageHash` remain part of the verified binding even though Pixi resolves the image through the spritesheet loader. Use `request.battlefieldBinding.environmentAssetBinding` for the backdrop, the declared well occluder binding for the current occluder sprite, and each actor's `presentation.combatAssetBinding`/`motionPackBinding` for body and animation sheet. `motionPackVersionDiagnostic()` reads the request bindings. Preserve the current authored clips, layers, mask, fog, motes, depth sorting, well projection, health bars, hit tint, lunge, shadow, camera movement, three presentation lenses, and teardown.

If any `Assets.load()` or `app.init()` call rejects, catch it and call:

```ts
const unavailable = {
	code: failedDuringInit ? 'renderer-initialization-failed' : 'asset-load-failed',
	message: 'Combat presentation could not be loaded.'
} as const;
session.markUnavailable(unavailable);
onUnavailable(unavailable);
```

Do not construct a defeat receipt for this path.

- [ ] **Step 4: Advance the session in the existing Pixi ticker**

Retain the accumulator but delegate authority to the session:

```ts
app.ticker.add((ticker) => {
	const frameSeconds = Math.min(ticker.deltaMS / 1000, 0.1);
	if (!paused && session.status === 'running') {
		accumulator += frameSeconds;
		while (accumulator >= 1 / 60 && session.status === 'running') {
			session.advanceFixedStep();
			accumulator -= 1 / 60;
		}
	}
	simulation = session.combat;
	if (!paused) updateAnimations(simulation, frameSeconds);
	renderSimulation?.(simulation);
	publishSnapshotWhenDue(simulation, frameSeconds);
});
```

Call `session.markAssetsReady()` only after Pixi, every declared texture, every motion pack, and the scene are ready. For live entry, subscribe `onComplete`; for replay, subscribe only to verification and forward it without calling the live completion path. Unsubscribe and unload exactly the derived request sources on teardown. Unmount does not call `markUnavailable()` and does not finish the encounter.

- [ ] **Step 5: Run Pixi-adjacent regression checks**

```bash
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/depth-projection.spec.ts \
  src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts \
  src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts
pnpm --filter @summonlab/web typecheck
```

Expected: all tests pass and Svelte reports 0 errors and 0 warnings.

- [ ] **Step 6: Commit the session-driven Pixi stage**

```bash
git add apps/web/src/lib/components/living-village/realtime-combat/RealtimeCombatStage.svelte apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.ts apps/web/src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts
git commit -m "feat(combat): bind Pixi stage to combat session"
```

---

### Task 6: Wire the rat route, receipt UI, unavailable state, and replay

**Files:**

- Modify: `apps/web/src/routes/living-village-lab/realtime-combat/+page.svelte`
- Modify: `apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts`

**Interfaces:**

- Consumes: `RAT_ENCOUNTER_REQUEST`, fixture claim policy, a component-local lab `CombatSessionRegistry`, and the request-driven stage.
- Produces: one live fixture launch, one receipt display, explicit rejection/unavailable states, and a replay path that verifies but never republishes claims.

- [ ] **Step 1: Extend Playwright coverage before route changes**

Keep the two current tests and add:

```ts
test('returns one bounded receipt and replays without a second completion', async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-resolution')).toBeVisible({ timeout: 45_000 });
	await expect(page.getByTestId('combat-receipt')).toContainText('Victory');
	await expect(page.getByTestId('combat-receipt')).toContainText('3 heroes · 5 enemies');
	await expect(page.getByTestId('combat-completion-count')).toHaveText('1');
	const receiptId = await page.getByTestId('combat-receipt-id').textContent();

	await page.getByRole('button', { name: 'Replay verified fight' }).click();
	await expect(page.getByTestId('combat-replay-status')).toHaveText('Replay verified', { timeout: 45_000 });
	await expect(page.getByTestId('combat-completion-count')).toHaveText('1');
	await expect(page.getByTestId('combat-receipt-id')).toHaveText(receiptId!);
});

test('reports an unavailable presentation without a defeat receipt', async ({ page }) => {
	await page.route('**/rat-brute-motion-v1.json', (route) => route.abort());
	await page.goto(combatUrl);
	await expect(page.getByTestId('combat-unavailable')).toContainText('could not be loaded');
	await expect(page.getByTestId('combat-receipt')).toHaveCount(0);
	await expect(page.getByText('Party overwhelmed')).toHaveCount(0);
});
```

- [ ] **Step 2: Run focused E2E and verify the new expectations fail**

```bash
pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
```

Expected: the existing presentation/mobile cases pass; the new receipt and unavailable-state cases fail because the route lacks those states.

- [ ] **Step 3: Enter the fixture once and subscribe to one completion**

Create the lab registry once per page component and pass the frozen fixture request into the stage. Keep the mounted live stage stable across lens, pause, and reduced-motion changes:

```ts
const registry = new CombatSessionRegistry();
const dependencies = {
	claimPolicy: RAT_ENCOUNTER_CLAIM_POLICY,
	fixtureRequestHash: RAT_ENCOUNTER_REQUEST.requestHash
};
let stageKey = $state(0);
let replayOf = $state<ExplorationCombatReceipt>();
let receipt = $state<ExplorationCombatReceipt>();
let rejection = $state<ExplorationCombatRejection>();
let unavailable = $state<CombatUnavailableState>();
let replayVerification = $state<CombatReplayVerification>({ kind: 'pending' });
let completionCount = $state(0);

function acceptCompletion(next: ExplorationCombatReceipt): void {
	if (receipt) return;
	receipt = next;
	completionCount += 1;
}
```

Use `{#key stageKey}` around `RealtimeCombatStage`. Pass `request={RAT_ENCOUNTER_REQUEST}`, `claimPolicy={dependencies.claimPolicy}`, `{registry}`, `{replayOf}`, `onComplete={acceptCompletion}`, and the rejection/unavailable/replay callbacks. Do not increment `stageKey` or re-enter live combat when changing mode, pausing, or updating player motion settings.

- [ ] **Step 4: Render receipt, rejection, unavailable, and verified replay states**

On terminal live combat, show outcome, final hero Health/Mana, claim count, receipt ID, and replay reference without applying claims:

```svelte
{#if receipt}
	<section data-testid="combat-receipt">
		<strong>{receipt.outcome === 'victory' ? 'Victory' : 'Defeat'}</strong>
		<span>{receipt.finalHeroes.length} heroes · {receipt.finalEnemies.length} enemies</span>
		<code data-testid="combat-receipt-id">{receipt.receiptId}</code>
		<span>{receipt.claims.length} uncommitted claims</span>
		<span class="sr-only" data-testid="combat-completion-count">{completionCount}</span>
		<button type="button" onclick={replay}>Replay verified fight</button>
	</section>
{:else if rejection}
	<section data-testid="combat-rejection">Encounter rejected: {rejection.summary}</section>
{:else if unavailable}
	<section data-testid="combat-unavailable">Combat presentation could not be loaded.</section>
{/if}
```

`replay()` requires the live receipt, assigns it to `replayOf`, increments `stageKey`, clears only replay presentation state, and never clears or increments the original receipt/completion count. The newly keyed stage sees `replayOf` and creates the non-publishing replay session internally. Render `Replay verified` only from `{ kind: 'verified' }`; render a closed failure message for mismatch.

- [ ] **Step 5: Run focused unit, type, E2E, lint, and build checks**

```bash
pnpm --filter @summonlab/contracts test -- exploration-combat.spec.ts
pnpm --filter @summonlab/contracts typecheck
pnpm --filter @summonlab/web test:unit -- \
  src/lib/components/living-village/realtime-combat/rat-encounter-fixture.spec.ts \
  src/lib/components/living-village/realtime-combat/combat-session.spec.ts \
  src/lib/components/living-village/realtime-combat/realtime-combat.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-animator.spec.ts \
  src/lib/components/living-village/realtime-combat/actor-visual-registration.spec.ts \
  src/lib/components/living-village/realtime-combat/motion-pack-config.spec.ts \
  src/lib/components/living-village/realtime-combat/combat-spatial.spec.ts \
  src/lib/components/living-village/realtime-combat/depth-projection.spec.ts \
  src/lib/components/living-village/realtime-combat/health-bar-layout.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web test:e2e -- src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
pnpm --filter @summonlab/web build
```

Expected: every command exits 0; typecheck has 0 errors and 0 warnings; all four focused Playwright cases pass.

- [ ] **Step 6: Run the visual/playtest checkpoint**

```bash
pnpm --filter @summonlab/web dev --host 0.0.0.0 --port 5173
```

Open `http://10.110.24.122:5173/living-village-lab/realtime-combat` and verify:

1. Let the fight finish; confirm the current autonomous timing and animation still read as the same encounter, and inspect all three heroes' final Health/Mana in the receipt.
2. Pause mid-fight, switch through 2D, 2.5D, and 2.5D V2, then resume; confirm combat time and target decisions did not restart.
3. Replay the terminal fight; confirm the same visible result and `Replay verified`, with completion count and uncommitted claims unchanged.

This checkpoint decides whether request-driven asset sizing/offsets preserved the accepted composition and whether the receipt panel exposes enough evidence without obscuring combat.

- [ ] **Step 7: Commit the completed runnable slice**

```bash
git add apps/web/src/routes/living-village-lab/realtime-combat/+page.svelte apps/web/src/routes/living-village-lab/realtime-combat/realtime-combat.e2e.ts
git commit -m "feat(combat): expose rat encounter receipt and replay"
```

- [ ] **Step 8: Verify scope, push, and record the handoff**

```bash
git diff --check origin/main...HEAD
git status --short
git log --oneline origin/main..HEAD
git push -u origin codex/exploration-combat-contract
git status --short --branch
```

Expected: diff check exits 0; only the approved contract/session/rat-route slice appears in the branch history; push succeeds; the final status has no modified or untracked files and tracks `origin/codex/exploration-combat-contract`.

Do not claim the deferred exploration caller, durable idempotency, production motion packs, progression/inventory consumers, Tower migration, or mission-combat migration as part of this completion.
