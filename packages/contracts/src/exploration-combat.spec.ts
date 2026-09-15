import { describe, expect, it } from 'vitest';

import {
	ExplorationCombatReceiptSchema,
	ExplorationCombatRejectionSchema,
	ExplorationCombatReplayRefSchema,
	ExplorationEncounterRequestSchema,
	type ExplorationCombatHero
} from './exploration-combat.js';

const hash = 'a'.repeat(64);
const alternateHash = 'b'.repeat(64);
const ids = {
	request: '11111111-1111-4111-8111-111111111111',
	run: '22222222-2222-4222-8222-222222222222',
	correlation: '33333333-3333-4333-8333-333333333333',
	attempt: '44444444-4444-4444-8444-444444444444',
	receipt: '55555555-5555-4555-8555-555555555555',
	start: '66666666-6666-4666-8666-666666666666',
	action: '99999999-9999-4999-8999-999999999999',
	defeat: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	end: '77777777-7777-4777-8777-777777777777',
	claim: '88888888-8888-4888-8888-888888888888'
} as const;

type SafeParseResult = { success: boolean; data?: unknown };
type SafeSchema = { safeParse: (input: unknown) => SafeParseResult };

const contract = {
	ExplorationCombatReceiptSchema,
	ExplorationCombatRejectionSchema,
	ExplorationCombatReplayRefSchema,
	ExplorationEncounterRequestSchema
} satisfies Record<string, SafeSchema>;

function parse(schemaName: keyof typeof contract, input: unknown) {
	return contract[schemaName].safeParse(input);
}

function validPresentation(
	approvalStatus: 'approved' | 'fixture-only' = 'approved'
): ExplorationCombatHero['presentation'] {
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
			{ kind: 'enemy' as const, contentId: 'sewer-rat', version: 'v1', contentHash: alternateHash },
			{ kind: 'claim-policy' as const, contentId: 'rat-xp', version: 'v1', contentHash: hash }
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
					armor: 4,
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
					armor: 0,
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
				eventId: ids.action,
				sequence: 1,
				simulationTick: 24,
				kind: 'action-resolved' as const,
				actorId: 'hero-a',
				targetIds: ['enemy-rat'],
				actionId: 'hero-strike',
				healthDeltas: [{ unitId: 'enemy-rat', amount: -10 }],
				manaDeltas: [],
				claimSourceRefs: ['hero-strike'],
				publicSummary: 'Asha struck the Tunnel Rat.'
			},
			{
				eventId: ids.defeat,
				sequence: 2,
				simulationTick: 42,
				kind: 'unit-defeated' as const,
				actorId: 'hero-a',
				targetIds: ['enemy-rat'],
				healthDeltas: [{ unitId: 'enemy-rat', amount: -20 }],
				manaDeltas: [],
				claimSourceRefs: ['enemy-rat'],
				publicSummary: 'The Tunnel Rat was defeated.'
			},
			{
				eventId: ids.end,
				sequence: 3,
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
			},
			{
				claimId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
				kind: 'skill-practice' as const,
				definitionRef: { definitionId: 'rat-xp', version: 'v1', contentHash: hash },
				quantity: 1,
				sourceEventIds: [ids.action],
				heroId: 'hero-a',
				actionDefinitionId: 'hero-strike'
			},
			{
				claimId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
				kind: 'material' as const,
				definitionRef: { definitionId: 'rat-xp', version: 'v1', contentHash: hash },
				quantity: 1,
				sourceEventIds: [ids.defeat],
				sourceEnemyInstanceId: 'enemy-rat',
				materialDefinitionId: 'rat-tail'
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

describe('exploration combat contracts', () => {
	it('accepts the campaign UUID as the authoritative combat hero id', () => {
		const request = validRequest();
		request.party[0]!.heroRef.heroId = '704e4a8e-714e-4c21-ae4e-47686f4e48fb';

		expect(ExplorationEncounterRequestSchema.safeParse(request).success).toBe(true);
	});

	it('accepts one frozen bounded encounter request', () => {
		const parsed = parse('ExplorationEncounterRequestSchema', validRequest());

		expect(parsed?.success).toBe(true);
		expect((parsed?.data as { bounds?: unknown } | undefined)?.bounds).toEqual({
			maximumCombatants: 2,
			maximumSimulationTicks: 3_600,
			maximumTraceEvents: 500
		});
	});

	it('allows an approved combat raster without a motion pack', () => {
		const request = validRequest();
		request.party[0]!.presentation.motionPackBinding = null;

		expect(parse('ExplorationEncounterRequestSchema', request)?.success).toBe(true);
	});

	it.each(['explorationPosition', 'fog', 'tileInteractions', 'lootCache', 'rewardBalance'])(
		'rejects the foreign ownership field %s',
		(field) => {
			expect(
				parse('ExplorationEncounterRequestSchema', { ...validRequest(), [field]: {} })?.success
			).toBe(false);
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

	it('rejects victory receipts with no required enemy', () => {
		const receipt = validVictoryReceipt();

		expect(
			parse('ExplorationCombatReceiptSchema', {
				...receipt,
				finalEnemies: receipt.finalEnemies.map((enemy) => ({ ...enemy, requiredForVictory: false }))
			}).success
		).toBe(false);
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

	it('rejects unbound claims and claims whose sources do not prove their declared semantics', () => {
		const receipt = validVictoryReceipt();
		const [progressionClaim, practiceClaim, materialClaim] = receipt.claims;

		const invalidReceipts = [
			{
				...receipt,
				claims: [
					{
						...progressionClaim,
						definitionRef: { definitionId: 'unbound-claim', version: 'v1', contentHash: hash }
					},
					practiceClaim,
					materialClaim
				]
			},
			{
				...receipt,
				claims: [
					progressionClaim,
					{ ...practiceClaim, sourceEventIds: [ids.defeat] },
					materialClaim
				]
			},
			{
				...receipt,
				events: receipt.events.map((event) =>
					event.eventId === ids.action ? { ...event, actorId: 'hero-b' } : event
				)
			},
			{
				...receipt,
				events: receipt.events.map((event) =>
					event.eventId === ids.action ? { ...event, actionId: 'other-action' } : event
				)
			},
			{
				...receipt,
				claims: [
					progressionClaim,
					practiceClaim,
					{ ...materialClaim, sourceEventIds: [ids.action] }
				]
			},
			{
				...receipt,
				events: receipt.events.map((event) =>
					event.eventId === ids.defeat ? { ...event, targetIds: ['other-enemy'] } : event
				)
			},
			{
				...receipt,
				finalEnemies: [
					...receipt.finalEnemies,
					{
						enemyInstanceId: 'other-enemy',
						health: 10,
						maximumHealth: 10,
						mana: 0,
						maximumMana: 0,
						combatState: 'combat-capable' as const,
						requiredForVictory: false
					}
				],
				events: receipt.events.map((event) =>
					event.eventId === ids.defeat ? { ...event, targetIds: ['other-enemy'] } : event
				),
				claims: [
					progressionClaim,
					practiceClaim,
					{ ...materialClaim, sourceEnemyInstanceId: 'other-enemy' }
				]
			},
			{
				...receipt,
				claims: [
					{ ...progressionClaim, sourceEventIds: [ids.action] },
					practiceClaim,
					materialClaim
				]
			}
		];

		for (const invalidReceipt of invalidReceipts) {
			expect(parse('ExplorationCombatReceiptSchema', invalidReceipt)?.success).toBe(false);
		}
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
					index === receipt.events.length - 1 ? { ...event, kind: 'unit-defeated' as const } : event
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
