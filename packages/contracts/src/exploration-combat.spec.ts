import { beforeAll, describe, expect, it } from 'vitest';

const hash = 'a'.repeat(64);
const alternateHash = 'b'.repeat(64);
const ids = {
	request: '11111111-1111-4111-8111-111111111111',
	run: '22222222-2222-4222-8222-222222222222',
	correlation: '33333333-3333-4333-8333-333333333333',
	attempt: '44444444-4444-4444-8444-444444444444',
	receipt: '55555555-5555-4555-8555-555555555555',
	start: '66666666-6666-4666-8666-666666666666',
	end: '77777777-7777-4777-8777-777777777777',
	claim: '88888888-8888-4888-8888-888888888888'
} as const;

type SafeParseResult = { success: boolean; data?: unknown };
type SafeSchema = { safeParse: (input: unknown) => SafeParseResult };

let contract: Record<string, unknown>;

function parse(schemaName: string, input: unknown) {
	return (contract[schemaName] as SafeSchema | undefined)?.safeParse(input);
}

function validPresentation(approvalStatus: 'approved' | 'fixture-only' = 'approved') {
	return {
		combatAssetBinding: {
			assetKey: 'rat-combat-raster',
			source: '/runtime/combat/rat.png',
			contentHash: hash,
			approvalStatus,
			approvalId: 'rat-combat-approved'
		},
		motionPackBinding: {
			motionPackId: 'rat-combat-motion',
			source: '/runtime/combat/rat-motion.json',
			atlasImageSource: '/runtime/combat/rat-motion-atlas.webp',
			version: 1,
			contentHash: hash,
			atlasImageHash: alternateHash,
			approvalStatus,
			approvalId: 'rat-motion-approved'
		},
		visualTuning: { bodyOffsetY: 0, shadowRadiusX: 24, shadowRadiusY: 10, displaySize: 96 }
	};
}

function validRequest() {
	return {
		schemaVersion: 'exploration-encounter-request-v1' as const,
		requestId: ids.request,
		idempotencyKey: 'exploration-rat-encounter',
		runId: ids.run,
		correlationId: ids.correlation,
		encounterId: 'exploration-rat-encounter',
		explorationAttemptId: ids.attempt,
		observedGameTime: '2026-09-07T15:00:00.000Z',
		expectedExplorationStateHash: hash,
		rulesetVersion: 'combat-rules-v1',
		contentBindings: [
			{ kind: 'ruleset' as const, contentId: 'combat-rules', version: 'v1', contentHash: hash },
			{ kind: 'enemy' as const, contentId: 'sewer-rat', version: 'v1', contentHash: alternateHash }
		],
		seed: 'exploration-rat-seed',
		entropyCursor: 12,
		visualStatus: 'production' as const,
		party: [
			{
				heroRef: {
					heroId: 'hero-a',
					characterManifestHash: hash,
					lifeState: 'combat-capable' as const,
					availabilityRevision: 2,
					rulesetVersion: 'combat-rules-v1'
				},
				displayName: 'Asha',
				resources: { health: 100, maximumHealth: 100, mana: 20, maximumMana: 20 },
				capability: {
					capabilitySnapshotHash: hash,
					loadoutHash: alternateHash,
					actionDefinitionRefs: ['hero-strike'],
					combatRole: 'brawler' as const
				},
				combatProfile: {
					movementUnitsPerSecond: 2,
					attackRange: 1,
					attackPower: 20,
					armour: 4,
					attackIntervalTicks: 30
				},
				deployment: { x: 0.2, y: 0.5 },
				presentation: validPresentation()
			}
		],
		enemies: [
			{
				enemyInstanceId: 'enemy-rat',
				displayName: 'Tunnel Rat',
				definitionRef: {
					enemyDefinitionId: 'sewer-rat',
					definitionVersion: 'v1',
					contentHash: alternateHash
				},
				resources: { health: 30, maximumHealth: 30, mana: 0, maximumMana: 0 },
				combatRole: 'swarm' as const,
				actionDefinitionRefs: ['rat-bite'],
				combatProfile: {
					movementUnitsPerSecond: 2.5,
					attackRange: 0.75,
					attackPower: 5,
					armour: 0,
					attackIntervalTicks: 45
				},
				deployment: { x: 0.8, y: 0.5 },
				requiredForVictory: true,
				presentation: validPresentation()
			}
		],
		battlefieldBinding: {
			battlefieldId: 'sewer-floor',
			version: 'v1',
			contentHash: hash,
			environmentAssetBinding: {
				assetKey: 'sewer-floor-raster',
				source: '/runtime/battlefields/sewer-floor.webp',
				contentHash: hash,
				approvalStatus: 'approved' as const,
				approvalId: 'sewer-floor-approved'
			},
			occluderAssetBindings: []
		},
		bounds: { maximumCombatants: 2, maximumSimulationTicks: 3_600, maximumTraceEvents: 500 },
		requestHash: alternateHash
	};
}

function validVictoryReceipt() {
	const request = validRequest();
	return {
		schemaVersion: 'exploration-combat-receipt-v1' as const,
		receiptId: ids.receipt,
		requestId: request.requestId,
		idempotencyKey: request.idempotencyKey,
		requestHash: request.requestHash,
		runId: request.runId,
		correlationId: request.correlationId,
		encounterId: request.encounterId,
		explorationAttemptId: request.explorationAttemptId,
		rulesetVersion: request.rulesetVersion,
		contentBindings: request.contentBindings,
		startedAtTick: 0,
		endedAtTick: 60,
		outcome: 'victory' as const,
		decisiveCause: {
			code: 'enemies-defeated' as const,
			summary: 'The Tunnel Rat was defeated.',
			supportingEventIds: [ids.end]
		},
		finalHeroes: [
			{
				heroId: 'hero-a',
				health: 75,
				maximumHealth: 100,
				mana: 14,
				maximumMana: 20,
				combatState: 'combat-capable' as const
			}
		],
		finalEnemies: [
			{
				enemyInstanceId: 'enemy-rat',
				health: 0,
				maximumHealth: 30,
				mana: 0,
				maximumMana: 0,
				combatState: 'defeated' as const,
				requiredForVictory: true
			}
		],
		defeatedEnemyIds: ['enemy-rat'],
		events: [
			{
				eventId: ids.start,
				sequence: 0,
				simulationTick: 0,
				kind: 'encounter-started' as const,
				actorId: 'hero-a',
				targetIds: ['enemy-rat'],
				healthDeltas: [],
				manaDeltas: [],
				claimSourceRefs: [],
				publicSummary: 'The encounter began.'
			},
			{
				eventId: ids.end,
				sequence: 1,
				simulationTick: 60,
				kind: 'encounter-ended' as const,
				actorId: 'hero-a',
				targetIds: ['enemy-rat'],
				healthDeltas: [{ unitId: 'enemy-rat', amount: -30 }],
				manaDeltas: [],
				claimSourceRefs: ['rat-defeated'],
				publicSummary: 'The Tunnel Rat was defeated.'
			}
		],
		claims: [
			{
				claimId: ids.claim,
				kind: 'progression-xp' as const,
				definitionRef: { definitionId: 'rat-xp', version: 'v1', contentHash: hash },
				quantity: 10,
				sourceEventIds: [ids.end],
				heroId: 'hero-a'
			}
		],
		inputStateHash: hash,
		outputStateHash: alternateHash,
		traceHash: hash,
		replayRef: {
			replayVersion: 'exploration-combat-replay-v1' as const,
			requestId: request.requestId,
			requestHash: request.requestHash,
			receiptId: ids.receipt,
			traceHash: hash,
			rulesetVersion: request.rulesetVersion,
			seed: request.seed,
			entropyCursor: request.entropyCursor,
			battlefieldBindingHash: hash,
			participantPresentationBindingsHash: alternateHash
		},
		ownership: {
			explorationMutated: false as const,
			progressionCommitted: false as const,
			inventoryCommitted: false as const,
			lootCacheMutated: false as const
		}
	};
}

beforeAll(async () => {
	contract = await import('./exploration-combat.js');
});

describe('exploration combat contracts', () => {
	it('accepts one frozen bounded encounter request', () => {
		const parsed = parse('ExplorationEncounterRequestSchema', validRequest());

		expect(parsed?.success).toBe(true);
		expect((parsed?.data as { bounds?: unknown } | undefined)?.bounds).toEqual({
			maximumCombatants: 2,
			maximumSimulationTicks: 3_600,
			maximumTraceEvents: 500
		});
	});

	it.each(['explorationPosition', 'fog', 'tileInteractions', 'lootCache', 'rewardBalance'])(
		'rejects the foreign ownership field %s',
		(field) => {
			expect(parse('ExplorationEncounterRequestSchema', { ...validRequest(), [field]: {} })?.success).toBe(
				false
			);
		}
	);

	it('rejects duplicate participants, invalid resources, absent required enemies, and unused headroom', () => {
		const request = validRequest();

		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				party: [request.party[0], request.party[0]]
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				party: [
					{
						...request.party[0],
						resources: { health: 101, maximumHealth: 100, mana: 0, maximumMana: 0 }
					}
				]
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				enemies: request.enemies.map((enemy) => ({ ...enemy, requiredForVictory: false }))
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				bounds: { ...request.bounds, maximumCombatants: 3 }
			})?.success
		).toBe(false);
	});

	it('rejects duplicated action references and duplicated content binding tuples', () => {
		const request = validRequest();
		const hero = request.party[0]!;

		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				party: [
					{
						...hero,
						capability: { ...hero.capability, actionDefinitionRefs: ['hero-strike', 'hero-strike'] }
					}
				]
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				contentBindings: [...request.contentBindings, request.contentBindings[0]]
			})?.success
		).toBe(false);
	});

	it('requires approved presentation bindings for production encounters', () => {
		const request = validRequest();
		expect(
			parse('ExplorationEncounterRequestSchema', {
				...request,
				party: [{ ...request.party[0], presentation: validPresentation('fixture-only') }]
			})?.success
		).toBe(false);
	});

	it('accepts a victory receipt with final resources, claims, and a replay reference', () => {
		const receipt = validVictoryReceipt();

		expect(parse('ExplorationCombatReceiptSchema', receipt)?.success).toBe(true);
		expect(receipt.ownership).toEqual({
			explorationMutated: false,
			progressionCommitted: false,
			inventoryCommitted: false,
			lootCacheMutated: false
		});
	});

	it('rejects contradictory terminal evidence and claims without source events', () => {
		const receipt = validVictoryReceipt();

		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				finalEnemies: receipt.finalEnemies.map((enemy) => ({
					...enemy,
					health: 1,
					combatState: 'combat-capable' as const
				}))
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				claims: [{ ...receipt.claims[0], sourceEventIds: [ids.claim] }]
			})?.success
		).toBe(false);
	});

	it('rejects non-contiguous traces, non-terminal last events, duplicate IDs, and defeated-enemy disagreement', () => {
		const receipt = validVictoryReceipt();

		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				events: receipt.events.map((event, index) => ({ ...event, sequence: index * 2 }))
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				events: receipt.events.map((event, index) =>
					index === 1 ? { ...event, kind: 'unit-defeated' as const } : event
				)
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				events: [receipt.events[0], { ...receipt.events[1], eventId: ids.start }]
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', { ...receipt, defeatedEnemyIds: [] })?.success
		).toBe(false);
	});

	it('requires every hero defeated for a heroes-defeated defeat but permits survivors at encounter limit', () => {
		const receipt = validVictoryReceipt();
		const defeat = {
			...receipt,
			outcome: 'defeat' as const,
			decisiveCause: { ...receipt.decisiveCause, code: 'heroes-defeated' as const },
			finalHeroes: [{ ...receipt.finalHeroes[0], health: 0, combatState: 'defeated' as const }]
		};

		expect(parse('ExplorationCombatReceiptSchema', defeat)?.success).toBe(true);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...defeat,
				finalHeroes: receipt.finalHeroes
			})?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				outcome: 'defeat' as const,
				decisiveCause: { ...receipt.decisiveCause, code: 'encounter-limit-reached' as const }
			})?.success
		).toBe(true);
	});

	it('rejects replay references whose receipt identity or hashes do not agree', () => {
		const receipt = validVictoryReceipt();

		expect(
			parse('ExplorationCombatReplayRefSchema', { ...receipt.replayRef, receiptId: '' })?.success
		).toBe(false);
		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				replayRef: { ...receipt.replayRef, traceHash: alternateHash }
			})?.success
		).toBe(false);
	});

	it('models a rejection without an outcome or claims', () => {
		expect(
			parse('ExplorationCombatRejectionSchema', {
				schemaVersion: 'exploration-combat-rejection-v1',
				requestId: ids.request,
				code: 'invalid-party',
				summary: 'The selected hero cannot enter combat.',
				fieldPaths: ['party[0].heroRef.lifeState']
			})?.success
		).toBe(true);
	});
});
