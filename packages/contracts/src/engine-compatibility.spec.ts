import {
	DECISION_INSPECTOR_VERSION,
	DECISION_JOB_CLIENT_VIEW_VERSION,
	DECISION_JOB_VERSION,
	DECISION_PROVIDER_REQUEST_VERSION,
	EngineCommandSchema,
	EngineGameStateSchema,
	HERO_CONTEXT_POLICY_VERSION,
	HERO_DECISION_PACKET_VERSION,
	HERO_DECISION_PREVIEW_VERSION,
	HERO_DECISION_RESPONSE_VERSION,
	HERO_MEMORY_RETRIEVAL_VERSION,
	HERO_MODEL_PROMPT_VERSION,
	HERO_POLICY_RESULT_VERSION,
	LEGACY_DECISION_JOB_VERSION,
	MODEL_POLICY_VERSION
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { ENGINE_CONTRACT_RUNTIME_EXPORTS } from './engine-public-api.snapshot.js';
import * as engineContracts from './engine.js';
const COMPATIBILITY_V13_BOOTSTRAP = {
	schemaVersion: 13,
	runId: '125a33f3-8108-45a4-a7c5-68a7e098d660',
	seed: 'engine-compatibility-seed',
	contentVersion: 'engine-v13',
	status: 'active',
	version: 0,
	eventCursor: 1,
	entropyCursor: 0,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'58977ad6-a738-4346-9c3e-b4e21c969110': {
			heroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '05be08bec60d39d97c3a5f5a3914f2855f3dddf13a7ea0ba8c77c0ae448249e2',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: '963e19a6-8fe9-4fac-a5e2-f39d88f6a983'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: '535886b1-2c36-4403-a796-b2393918b701',
				eventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'ab648a77-bbac-4c59-805e-09b4a7c65036',
				eventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'ab50b3d8-8c9c-4258-87ec-f5bbe799c940',
				eventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'963e19a6-8fe9-4fac-a5e2-f39d88f6a983': {
			itemId: '963e19a6-8fe9-4fac-a5e2-f39d88f6a983',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '58977ad6-a738-4346-9c3e-b4e21c969110',
			slot: 'main-hand',
			equippedById: '58977ad6-a738-4346-9c3e-b4e21c969110',
			durability: 6,
			maxDurability: 6
		},
		'bdeed8e0-d966-4870-969c-2722c3b6d274': {
			itemId: 'bdeed8e0-d966-4870-969c-2722c3b6d274',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '58977ad6-a738-4346-9c3e-b4e21c969110',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'92d2dd64-a519-4dc9-b724-db56c7a2885a': {
				observationId: '92d2dd64-a519-4dc9-b724-db56c7a2885a',
				sourceEventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				observerHeroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['58977ad6-a738-4346-9c3e-b4e21c969110', 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2']
			}
		},
		beliefs: {
			'c0a2f491-b7f0-4230-96b2-bb5547449785': {
				beliefId: 'c0a2f491-b7f0-4230-96b2-bb5547449785',
				holderHeroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				subjectId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
					observationId: '92d2dd64-a519-4dc9-b724-db56c7a2885a',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'1e9b0cc5-c637-4f4d-ae36-ff1001de4a2a': {
				beliefId: '1e9b0cc5-c637-4f4d-ae36-ff1001de4a2a',
				holderHeroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				subjectId: 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
					observationId: '92d2dd64-a519-4dc9-b724-db56c7a2885a',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'cfef9e2e-ed07-49d2-b8f6-110321f4febd': {
				relationshipId: 'cfef9e2e-ed07-49d2-b8f6-110321f4febd',
				fromHeroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				toEntityId: 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'c548a6fa-d99b-495f-be15-bcf11a835264': {
				authorityId: 'c548a6fa-d99b-495f-be15-bcf11a835264',
				observerHeroId: '58977ad6-a738-4346-9c3e-b4e21c969110',
				subjectId: 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'ad8c24a8-73ce-4a2a-9491-ea84dd69a733',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		attemptCount: 0,
		attempt: null
	}
} as const;

type StateFixture = Record<string, unknown>;

function omit(object: StateFixture, keys: readonly string[]): StateFixture {
	return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
}

function compatibilityStateFixtures(): readonly StateFixture[] {
	const v13 = structuredClone(COMPATIBILITY_V13_BOOTSTRAP) as unknown as StateFixture;
	const [heroId, hero] = Object.entries(v13.heroes as StateFixture)[0]!;
	const v1: StateFixture = {
		schemaVersion: 1,
		runId: v13.runId,
		seed: v13.seed,
		contentVersion: 'engine-v1',
		status: v13.status,
		version: v13.version,
		eventCursor: v13.eventCursor,
		entropyCursor: v13.entropyCursor,
		simulatedAt: v13.simulatedAt,
		master: omit(v13.master as StateFixture, ['injuries']),
		heroes: {
			[heroId]: omit(hero as StateFixture, [
				'needs',
				'injuries',
				'progression',
				'equipment',
				'currentActivity',
				'locationNodeId',
				'firstArrivalCompleted',
				'currentTravel',
				'assignment',
				'mind',
				'habit',
				'dailyPlan',
				'currentRoutine'
			])
		},
		story: v13.story
	};
	const modernBase = omit(v13, ['society', 'mission']);
	const v2Hero = omit(hero as StateFixture, [
		'locationNodeId',
		'firstArrivalCompleted',
		'currentTravel',
		'assignment',
		'mind',
		'habit',
		'dailyPlan',
		'currentRoutine'
	]);
	const v2Settlement = omit(v13.settlement as StateFixture, [
		'firstEmber',
		'navigation',
		'poweredBuildingId',
		'buildings'
	]);
	const v2: StateFixture = {
		...modernBase,
		schemaVersion: 2,
		contentVersion: 'engine-v2',
		heroes: { [heroId]: v2Hero },
		settlement: v2Settlement
	};
	const v3: StateFixture = {
		...modernBase,
		schemaVersion: 3,
		contentVersion: 'engine-v3',
		heroes: {
			[heroId]: omit(hero as StateFixture, [
				'assignment',
				'mind',
				'habit',
				'dailyPlan',
				'currentRoutine'
			])
		},
		settlement: omit(v13.settlement as StateFixture, [
			'firstEmber',
			'poweredBuildingId',
			'buildings'
		])
	};
	const v4: StateFixture = {
		...modernBase,
		schemaVersion: 4,
		contentVersion: 'engine-v4',
		heroes: {
			[heroId]: omit(hero as StateFixture, ['mind', 'habit', 'dailyPlan', 'currentRoutine'])
		},
		settlement: omit(v13.settlement as StateFixture, ['firstEmber'])
	};
	const v5: StateFixture = {
		...modernBase,
		schemaVersion: 5,
		contentVersion: 'engine-v5',
		settlement: omit(v13.settlement as StateFixture, ['firstEmber'])
	};
	const v6: StateFixture = { ...modernBase, schemaVersion: 6, contentVersion: 'engine-v6' };
	const society = v13.society as StateFixture;
	const v7: StateFixture = {
		...omit(v13, ['mission']),
		schemaVersion: 7,
		contentVersion: 'engine-v7',
		society: omit({ ...society, contentVersion: 'society-v1' }, [
			'communicativeActs',
			'conversationTurns',
			'directives',
			'directiveInfluences'
		])
	};
	const v8: StateFixture = {
		...omit(v13, ['mission']),
		schemaVersion: 8,
		contentVersion: 'engine-v8',
		society: omit({ ...society, contentVersion: 'society-v2' }, [
			'conversationTurns',
			'directives',
			'directiveInfluences'
		])
	};
	const v9: StateFixture = {
		...omit(v13, ['mission']),
		schemaVersion: 9,
		contentVersion: 'engine-v9',
		society: omit({ ...society, contentVersion: 'society-v3' }, [
			'directives',
			'directiveInfluences'
		])
	};
	const v10: StateFixture = {
		...omit(v13, ['mission']),
		schemaVersion: 10,
		contentVersion: 'engine-v10'
	};
	const v11: StateFixture = {
		...v13,
		schemaVersion: 11,
		contentVersion: 'engine-v11',
		mission: omit(v13.mission as StateFixture, ['availableMissionIds', 'evidence'])
	};
	const v12: StateFixture = { ...v11, schemaVersion: 12, contentVersion: 'engine-v12' };
	const missionEvidence: StateFixture = {
		...(v13.mission as StateFixture),
		availableMissionIds: ['tower-floor-01'],
		evidence: {}
	};
	const v14: StateFixture = {
		...v13,
		schemaVersion: 14,
		contentVersion: 'engine-v14',
		mission: missionEvidence
	};
	const v15: StateFixture = { ...v14, schemaVersion: 15, contentVersion: 'engine-v15' };
	const v16: StateFixture = {
		...v14,
		schemaVersion: 16,
		contentVersion: 'engine-v16',
		mission: {
			...missionEvidence,
			aftermath: { aftermathVersion: 'mission-aftermath-v1', consequences: [] }
		}
	};
	const v17: StateFixture = {
		...v14,
		schemaVersion: 17,
		contentVersion: 'engine-v17',
		mission: {
			...missionEvidence,
			aftermath: { aftermathVersion: 'mission-aftermath-v2', consequences: [] }
		}
	};
	const v18: StateFixture = {
		...v14,
		schemaVersion: 18,
		contentVersion: 'engine-v18',
		mission: {
			...missionEvidence,
			aftermath: {
				aftermathVersion: 'mission-aftermath-v3',
				activeAttemptId: null,
				consequences: [],
				archives: []
			}
		}
	};
	const v19: StateFixture = {
		...v18,
		schemaVersion: 19,
		contentVersion: 'engine-v19',
		masterControl: {
			timing: 'wait',
			countdownSeconds: 5,
			revision: 0,
			decisionOrdinal: 0,
			activeDecision: null,
			lastResolution: null
		}
	};
	const masterControlV2 = {
		...(v19.masterControl as StateFixture),
		fallback: {
			configurationVersion: 'master-fallback-v1',
			policy: 'directed',
			directionId: '3bd4a23f-71ed-47f8-a58b-4e9be3a00f38',
			directionText: 'Advance the objective while protecting the company.',
			priorities: ['focus-objective', 'protect-self', 'protect-party'],
			protectedHeroId: null,
			safetyStops: {
				beforeIrreversibleAction: true,
				masterHealthThreshold: 35,
				whenUnclassified: true,
				maximumConsecutiveFallbacks: 8
			},
			configuredAt: v13.simulatedAt
		},
		consecutiveFallbacks: 0
	};
	const v20: StateFixture = {
		...v18,
		schemaVersion: 20,
		contentVersion: 'engine-v20',
		masterControl: masterControlV2
	};
	const bandStory = {
		storyVersion: 'runtime-band-story-v1',
		envelopeId: 'first-band-unclaimed-authority',
		envelopeContentVersion: 'tower-band-01-story-v1',
		envelopeContentHash: 'e7b59f5c06e4549fb542b40bf0d64f54da87428bbd1fb82b98ebf69dc50b1e6d',
		history: {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 5,
			completedBeatIds: [
				'cross-the-first-threshold',
				'see-the-settlements-need',
				'meet-the-first-duty',
				'lift-the-first-ember',
				'return-as-a-company',
				'floor-two-opening',
				'floor-two-pressure',
				'floor-two-confrontation',
				'floor-two-recovery',
				'floor-two-extraction',
				'floor-three-opening',
				'floor-three-pressure',
				'floor-three-confrontation',
				'floor-three-recovery',
				'floor-three-extraction',
				'floor-four-opening',
				'floor-four-pressure',
				'floor-four-confrontation',
				'floor-four-recovery',
				'floor-four-extraction'
			],
			activatedProposalIds: []
		},
		appliedPatches: []
	};
	const v21: StateFixture = { ...v20, schemaVersion: 21, contentVersion: 'engine-v21', bandStory };
	const v22: StateFixture = {
		...v21,
		schemaVersion: 22,
		contentVersion: 'engine-v22',
		society: { ...society, contentVersion: 'society-v5' },
		synthesis: { contentVersion: 'synthesis-v1', receipts: {}, rumors: {} }
	};
	const v23: StateFixture = {
		...v22,
		schemaVersion: 23,
		contentVersion: 'engine-v23',
		firstBandArchive: {
			archiveVersion: 'first-band-archive-v1',
			status: 'sealed',
			envelopeId: bandStory.envelopeId,
			envelopeContentHash: bandStory.envelopeContentHash,
			canonicalMessageHash: '78a90817e269bd0726f826855c68531f00e8d8676e6fb96885e1af35d60374ce',
			recovery: null,
			reveal: null
		}
	};
	return [
		v1,
		v2,
		v3,
		v4,
		v5,
		v6,
		v7,
		v8,
		v9,
		v10,
		v11,
		v12,
		v13,
		v14,
		v15,
		v16,
		v17,
		v18,
		v19,
		v20,
		v21,
		v22,
		v23
	];
}

describe('engine contracts compatibility', () => {
	it('keeps the engine runtime exports available through the contracts entrypoint', async () => {
		const contracts = await import('@summonlab/contracts');
		const expectedExports = new Set<string>(ENGINE_CONTRACT_RUNTIME_EXPORTS);
		expect(
			Object.keys(contracts)
				.filter((name) => expectedExports.has(name))
				.sort()
		).toEqual(ENGINE_CONTRACT_RUNTIME_EXPORTS);
		expect(Object.keys(engineContracts).sort()).toEqual(ENGINE_CONTRACT_RUNTIME_EXPORTS);
	});

	it('keeps command discriminators and public version constants stable', () => {
		expect(EngineCommandSchema.options.map((option) => option.shape.commandType.value).sort())
			.toMatchInlineSnapshot(`
		[
		  "hero.arrive",
		  "hero.choose.destination",
		  "hero.equip.item",
		  "hero.plan.day",
		  "hero.share.synthesis.rumor",
		  "hero.start.activity",
		  "hero.start.routine",
		  "hero.start.travel",
		  "master.apply.safety-stop",
		  "master.communicate",
		  "master.configure.fallback",
		  "master.configure.timing",
		  "master.converse",
		  "master.inspect.gate",
		  "master.issue.directive",
		  "master.open.decision",
		  "master.replace.directive",
		  "master.revoke.directive",
		  "mission.cancel",
		  "mission.deploy",
		  "mission.extract",
		  "mission.open.extraction",
		  "mission.prepare",
		  "mission.resolve.turn",
		  "mission.retreat",
		  "mission.revise.party",
		  "settlement.allocate.power",
		  "settlement.assign.hero",
		  "settlement.commit.first.ember",
		  "settlement.synthesize.hero",
		  "settlement.unassign.hero",
		  "simulation.advance",
		  "simulation.apply.damage",
		  "simulation.sync.clock",
		  "story.apply.patch",
		  "story.recover.first.ember",
		  "story.reveal.first.archive",
		]
	`);
		expect({
			DECISION_INSPECTOR_VERSION,
			DECISION_JOB_CLIENT_VIEW_VERSION,
			DECISION_JOB_VERSION,
			DECISION_PROVIDER_REQUEST_VERSION,
			HERO_CONTEXT_POLICY_VERSION,
			HERO_DECISION_PACKET_VERSION,
			HERO_DECISION_PREVIEW_VERSION,
			HERO_DECISION_RESPONSE_VERSION,
			HERO_MEMORY_RETRIEVAL_VERSION,
			HERO_MODEL_PROMPT_VERSION,
			HERO_POLICY_RESULT_VERSION,
			LEGACY_DECISION_JOB_VERSION,
			MODEL_POLICY_VERSION
		}).toMatchInlineSnapshot(`
		{
		  "DECISION_INSPECTOR_VERSION": "decision-inspector-v1",
		  "DECISION_JOB_CLIENT_VIEW_VERSION": "decision-job-client-v1",
		  "DECISION_JOB_VERSION": "decision-job-v2",
		  "DECISION_PROVIDER_REQUEST_VERSION": "decision-provider-request-v1",
		  "HERO_CONTEXT_POLICY_VERSION": "hero-context-v1",
		  "HERO_DECISION_PACKET_VERSION": "hero-decision-packet-v1",
		  "HERO_DECISION_PREVIEW_VERSION": "hero-decision-preview-v1",
		  "HERO_DECISION_RESPONSE_VERSION": "hero-decision-v1",
		  "HERO_MEMORY_RETRIEVAL_VERSION": "hero-memory-v1",
		  "HERO_MODEL_PROMPT_VERSION": "hero-model-prompt-v1",
		  "HERO_POLICY_RESULT_VERSION": "hero-policy-result-v1",
		  "LEGACY_DECISION_JOB_VERSION": "decision-job-v1",
		  "MODEL_POLICY_VERSION": "model-policy-v1",
		}
	`);
	});

	it('parses one complete valid state for every supported schema version', () => {
		const fixtures = compatibilityStateFixtures();
		expect(fixtures.map((fixture) => fixture.schemaVersion)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
		]);
		for (const fixture of fixtures) {
			const parsed = EngineGameStateSchema.safeParse(fixture);
			expect(parsed.success, `schema v${fixture.schemaVersion} must parse`).toBe(true);
			if (parsed.success) expect(parsed.data.schemaVersion).toBe(fixture.schemaVersion);
		}
		const unsupported = { ...fixtures.at(-1)!, schemaVersion: 24 };
		expect(EngineGameStateSchema.safeParse(unsupported).success).toBe(false);
	});
});
