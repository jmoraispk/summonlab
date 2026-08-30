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
	MasterControlStateSchema as PublicMasterControlStateSchema,
	MasterControlStateV2Schema as PublicMasterControlStateV2Schema,
	MasterDecisionWindowSchema as PublicMasterDecisionWindowSchema,
	MasterFallbackConfigurationSchema as PublicMasterFallbackConfigurationSchema,
	MissionRunStateSchema as PublicMissionRunStateSchema,
	MissionRunStateV2Schema as PublicMissionRunStateV2Schema,
	MissionRunStateV3Schema as PublicMissionRunStateV3Schema,
	MissionRunStateV4Schema as PublicMissionRunStateV4Schema,
	MissionRunStateV5Schema as PublicMissionRunStateV5Schema,
	MissionRunStateV6Schema as PublicMissionRunStateV6Schema,
	MissionRunStateV7Schema as PublicMissionRunStateV7Schema,
	MissionRunStateV8Schema as PublicMissionRunStateV8Schema,
	MODEL_POLICY_VERSION
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	EngineHeroStateV2Schema,
	EngineItemStateSchema,
	EngineMasterStateV2Schema,
	EngineStoryStateSchema
} from './engine/base-state.js';
import {
	EngineHeroStateV5Schema,
	EngineSettlementStateSchema,
	EngineSettlementStateV6Schema
} from './engine/settlement-state.js';
import {
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionWindowSchema,
	MasterFallbackConfigurationSchema
} from './engine/master-control.js';
import {
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema
} from './engine/mission-state.js';
import { ENGINE_CONTRACT_RUNTIME_EXPORTS } from './engine-public-api.snapshot.js';
import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from './engine-compatibility-states.snapshot.js';
import * as engineContracts from './engine.js';
import { SocietyStateV4Schema } from './social.js';

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
			DECISION_INSPECTOR_VERSION, DECISION_JOB_CLIENT_VIEW_VERSION, DECISION_JOB_VERSION,
			DECISION_PROVIDER_REQUEST_VERSION, HERO_CONTEXT_POLICY_VERSION, HERO_DECISION_PACKET_VERSION,
			HERO_DECISION_PREVIEW_VERSION, HERO_DECISION_RESPONSE_VERSION, HERO_MEMORY_RETRIEVAL_VERSION,
			HERO_MODEL_PROMPT_VERSION, HERO_POLICY_RESULT_VERSION, LEGACY_DECISION_JOB_VERSION,
			MODEL_POLICY_VERSION
	}).toEqual({
			DECISION_INSPECTOR_VERSION: 'decision-inspector-v1',
			DECISION_JOB_CLIENT_VIEW_VERSION: 'decision-job-client-v1',
			DECISION_JOB_VERSION: 'decision-job-v2',
			DECISION_PROVIDER_REQUEST_VERSION: 'decision-provider-request-v1',
			HERO_CONTEXT_POLICY_VERSION: 'hero-context-v1',
			HERO_DECISION_PACKET_VERSION: 'hero-decision-packet-v1',
			HERO_DECISION_PREVIEW_VERSION: 'hero-decision-preview-v1',
			HERO_DECISION_RESPONSE_VERSION: 'hero-decision-v1',
			HERO_MEMORY_RETRIEVAL_VERSION: 'hero-memory-v1',
			HERO_MODEL_PROMPT_VERSION: 'hero-model-prompt-v1',
			HERO_POLICY_RESULT_VERSION: 'hero-policy-result-v1',
			LEGACY_DECISION_JOB_VERSION: 'decision-job-v1',
			MODEL_POLICY_VERSION: 'model-policy-v1'
		});
	});

	it('parses the checked-in replay and development-bootstrap states', () => {
		expect(ENGINE_COMPATIBILITY_STATE_FIXTURES.map((fixture) => fixture.schemaVersion)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
			22, 23
		]);
		for (const fixture of ENGINE_COMPATIBILITY_STATE_FIXTURES) {
			expect(EngineGameStateSchema.parse(fixture).schemaVersion).toBe(fixture.schemaVersion);
		}
		expect(
			EngineGameStateSchema.safeParse({
				...ENGINE_COMPATIBILITY_STATE_FIXTURES.at(-1)!,
				schemaVersion: 24
			}).success
		).toBe(false);
	});

	it('parses base and settlement society state identically through leaf and composed schemas', () => {
		const baseFixture = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 2
		)!;
		const composedBaseState = EngineGameStateSchema.parse(baseFixture);
		if (composedBaseState.schemaVersion !== 2) {
			throw new Error('Expected the base compatibility fixture to parse as schema version 2');
		}
		const leafBaseState = {
			master: EngineMasterStateV2Schema.parse(baseFixture.master),
			heroes: Object.fromEntries(
				Object.entries(baseFixture.heroes).map(([heroId, hero]) => [
					heroId,
					EngineHeroStateV2Schema.parse(hero)
				])
			),
			settlement: EngineSettlementStateSchema.parse(baseFixture.settlement),
			items: Object.fromEntries(
				Object.entries(baseFixture.items).map(([itemId, item]) => [
					itemId,
					EngineItemStateSchema.parse(item)
				])
			),
			story: EngineStoryStateSchema.parse(baseFixture.story)
		};
		expect(leafBaseState).toStrictEqual({
			master: composedBaseState.master,
			heroes: composedBaseState.heroes,
			settlement: composedBaseState.settlement,
			items: composedBaseState.items,
			story: composedBaseState.story
		});

		const baseSettlementSocietyFixture = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 10
		)!;
		const baseSettlementHero = Object.values(baseSettlementSocietyFixture.heroes)[0]!;
		const activityHeroId = '10000000-0000-4000-8000-000000000001';
		const travelHeroId = '10000000-0000-4000-8000-000000000002';
		const routineHeroId = '10000000-0000-4000-8000-000000000003';
		const communicationEventId = '10000000-0000-4000-8000-000000000004';
		const communicationActId = '10000000-0000-4000-8000-000000000005';
		const communicationObservationId = '10000000-0000-4000-8000-000000000006';
		const conversationTurnId = '10000000-0000-4000-8000-000000000007';
		const directiveId = '10000000-0000-4000-8000-000000000008';
		const directiveInfluenceId = '10000000-0000-4000-8000-000000000009';
		const planId = '10000000-0000-4000-8000-000000000010';
		const activePlanEntryId = '10000000-0000-4000-8000-000000000011';
		const settlementSocietyFixture = {
			...baseSettlementSocietyFixture,
			heroes: {
				...baseSettlementSocietyFixture.heroes,
				[activityHeroId]: {
					...baseSettlementHero,
					heroId: activityHeroId,
					equipment: { mainHand: null },
					currentActivity: {
						activityId: '10000000-0000-4000-8000-000000000012',
						scheduledEventId: '10000000-0000-4000-8000-000000000013',
						kind: 'train',
						startedAt: '2000-01-01T00:00:00.000Z',
						completesAt: '2000-01-01T00:05:00.000Z'
					}
				},
				[travelHeroId]: {
					...baseSettlementHero,
					heroId: travelHeroId,
					equipment: { mainHand: null },
					currentTravel: {
						travelId: '10000000-0000-4000-8000-000000000014',
						scheduledEventId: '10000000-0000-4000-8000-000000000015',
						fromNodeId: 'gate-dais',
						toNodeId: 'kitchen-hearth',
						destinationZone: 'kitchen',
						route: {
							fromNodeId: 'gate-dais',
							toNodeId: 'kitchen-hearth',
							nodeIds: ['gate-dais', 'kitchen-hearth'],
							steps: [
								{
									edgeId: 'gate-to-kitchen',
									fromNodeId: 'gate-dais',
									toNodeId: 'kitchen-hearth',
									travelGameSeconds: 60
								}
							],
							totalTravelGameSeconds: 60,
							bottleneckCapacity: 4
						},
						settlementContentVersion:
							baseSettlementSocietyFixture.settlement.navigation.contentVersion,
						settlementContentHash:
							baseSettlementSocietyFixture.settlement.navigation.contentHash,
						startedAt: '2000-01-01T00:00:00.000Z',
						arrivesAt: '2000-01-01T00:01:00.000Z'
					}
				},
				[routineHeroId]: {
					...baseSettlementHero,
					heroId: routineHeroId,
					equipment: { mainHand: null },
					assignment: {
						buildingId: 'kitchen',
						nodeId: 'kitchen-hearth',
						role: 'cook',
						assignedAt: '2000-01-01T00:00:00.000Z'
					},
					dailyPlan: {
						planId,
						dayIndex: 0,
						createdAt: '2000-01-01T00:00:00.000Z',
						entries: [
							{
								planEntryId: activePlanEntryId,
								period: 'dawn',
								kind: 'meal',
								buildingId: 'kitchen',
								status: 'active',
								startedAt: '2000-01-01T00:00:00.000Z',
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000016',
								period: 'day',
								kind: 'assigned-duty',
								buildingId: 'kitchen',
								status: 'pending',
								startedAt: null,
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000017',
								period: 'evening',
								kind: 'self-directed',
								buildingId: null,
								status: 'pending',
								startedAt: null,
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000018',
								period: 'night',
								kind: 'sleep',
								buildingId: 'dormitory',
								status: 'pending',
								startedAt: null,
								completedAt: null
							}
						]
					},
					currentRoutine: {
						routineId: '10000000-0000-4000-8000-000000000019',
						scheduledEventId: '10000000-0000-4000-8000-000000000020',
						planId,
						planEntryId: activePlanEntryId,
						kind: 'meal',
						resolution: {
							selectedPlanEntryId: activePlanEntryId,
							selectedKind: 'meal',
							candidateScores: [
								{
									planEntryId: activePlanEntryId,
									kind: 'meal',
									score: 80,
									eligible: true,
									reasons: ['Breakfast is due.']
								}
							],
							margin: 20,
							decisionRecommended: false,
							fallbackUsed: false,
							summary: 'The assigned cook begins breakfast.'
						},
						startedAt: '2000-01-01T00:00:00.000Z',
						completesAt: '2000-01-01T00:10:00.000Z'
					}
				}
			},
			settlement: {
				...baseSettlementSocietyFixture.settlement,
				poweredBuildingId: 'kitchen',
				buildings: {
					...baseSettlementSocietyFixture.settlement.buildings,
					kitchen: {
						...baseSettlementSocietyFixture.settlement.buildings.kitchen,
						assignedHeroIds: [routineHeroId],
						powerState: 'powered'
					}
				},
				firstEmber: {
					coreId: 'first-ember-core',
					status: 'committed',
					recoveredFrom: 'tower-floor-01',
					recoveredAt: '2000-01-01T00:00:00.000Z',
					committedAt: '2000-01-01T00:01:00.000Z',
					buildingId: 'kitchen',
					rationale: 'feed-everyone',
					modifiers: [{ key: 'hunger-recovery', amount: 10 }],
					reactions: [
						{
							heroId: baseSettlementHero.heroId,
							stance: 'support',
							score: 75,
							summary: 'A warm kitchen will sustain the settlement.',
							factors: ['Food is scarce.', 'Everyone needs a shared meal.']
						}
					]
				}
			},
			society: {
				...baseSettlementSocietyFixture.society,
				observations: {
					...baseSettlementSocietyFixture.society.observations,
					[communicationObservationId]: {
						observationId: communicationObservationId,
						sourceEventId: communicationEventId,
						observerHeroId: baseSettlementHero.heroId,
						observedAt: '2000-01-01T00:02:00.000Z',
						kind: 'communication',
						communicationActId,
						summary: 'The Master assigns the first daily priority.',
						subjectIds: [
							baseSettlementSocietyFixture.master.masterId,
							baseSettlementHero.heroId
						]
					}
				},
				communicativeActs: {
					[communicationActId]: {
						actId: communicationActId,
						sourceEventId: communicationEventId,
						speakerId: baseSettlementSocietyFixture.master.masterId,
						intendedAudienceIds: [baseSettlementHero.heroId],
						kind: 'tell',
						topic: 'open-conversation',
						exactText: 'Keep the hearth supplied before training begins.',
						tone: 'firm',
						delivery: 'open',
						location: 'summoning-gate',
						occurredAt: '2000-01-01T00:02:00.000Z',
						claim: null,
						witnesses: [
							{
								heroId: baseSettlementHero.heroId,
								role: 'intended',
								perception: 'addressed',
								observationId: communicationObservationId,
								beliefId: null
							}
						]
					}
				},
				conversationTurns: {
					[conversationTurnId]: {
						turnId: conversationTurnId,
						sourceEventId: communicationEventId,
						communicationActId,
						masterId: baseSettlementSocietyFixture.master.masterId,
						heroId: baseSettlementHero.heroId,
						kind: 'say',
						orderIntent: null,
						response: {
							exactText: 'I will make sure the hearth is ready.',
							publicReason: 'The settlement needs food before drills.',
							orderOutcome: null,
							orderScore: null,
							preferenceWeight: 0
						},
						occurredAt: '2000-01-01T00:02:00.000Z'
					}
				},
				directives: {
					[directiveId]: {
						directiveId,
						runId: baseSettlementSocietyFixture.runId,
						authorId: baseSettlementSocietyFixture.master.masterId,
						text: 'Keep the hearth supplied before training begins.',
						scope: 'until_revoked',
						recipientIds: [baseSettlementHero.heroId],
						witnessEventId: communicationEventId,
						priorities: ['supply-hearth'],
						createdAt: '2000-01-01T00:02:00.000Z',
						expiresAt: null,
						revokedAt: null,
						delivery: 'open',
						status: 'active',
						witnessObservationIds: [communicationObservationId],
						expiryScheduledEventId: null,
						replacesDirectiveId: null,
						replacedByDirectiveId: null,
						terminalAt: null,
						terminalEventId: null
					}
				},
				directiveInfluences: {
					[directiveInfluenceId]: {
						influenceId: directiveInfluenceId,
						directiveId,
						heroId: baseSettlementHero.heroId,
						sourceEventId: communicationEventId,
						decisionJobId: null,
						actionId: 'hero.start.routine',
						outcome: 'advanced',
						rationale: 'The hearth priority supports the planned meal.',
						evaluatedAt: '2000-01-01T00:03:00.000Z'
					}
				}
			}
		} as const;
		const settlementHeroes = Object.values(settlementSocietyFixture.heroes);
		expect({
			currentActivity: settlementHeroes.some((hero) => hero.currentActivity !== null),
			currentTravel: settlementHeroes.some((hero) => hero.currentTravel !== null),
			assignment: settlementHeroes.some((hero) => hero.assignment !== null),
			dailyPlan: settlementHeroes.some((hero) => hero.dailyPlan !== null),
			currentRoutine: settlementHeroes.some((hero) => hero.currentRoutine !== null),
			firstEmberModifiers: settlementSocietyFixture.settlement.firstEmber.modifiers.length > 0,
			firstEmberReactions: settlementSocietyFixture.settlement.firstEmber.reactions.length > 0,
			communicativeActs:
				Object.keys(settlementSocietyFixture.society.communicativeActs).length > 0,
			conversationTurns:
				Object.keys(settlementSocietyFixture.society.conversationTurns).length > 0,
			directives: Object.keys(settlementSocietyFixture.society.directives).length > 0,
			directiveInfluences:
				Object.keys(settlementSocietyFixture.society.directiveInfluences).length > 0
		}).toStrictEqual({
			currentActivity: true,
			currentTravel: true,
			assignment: true,
			dailyPlan: true,
			currentRoutine: true,
			firstEmberModifiers: true,
			firstEmberReactions: true,
			communicativeActs: true,
			conversationTurns: true,
			directives: true,
			directiveInfluences: true
		});
		const composedSettlementSocietyState = EngineGameStateSchema.parse(
			settlementSocietyFixture
		);
		if (composedSettlementSocietyState.schemaVersion !== 10) {
			throw new Error(
				'Expected the settlement society compatibility fixture to parse as schema version 10'
			);
		}
		const leafSettlementSocietyState = {
			heroes: Object.fromEntries(
				Object.entries(settlementSocietyFixture.heroes).map(([heroId, hero]) => [
					heroId,
					EngineHeroStateV5Schema.parse(hero)
				])
			),
			settlement: EngineSettlementStateV6Schema.parse(settlementSocietyFixture.settlement),
			society: SocietyStateV4Schema.parse(settlementSocietyFixture.society)
		};
		expect(leafSettlementSocietyState).toStrictEqual({
			heroes: composedSettlementSocietyState.heroes,
			settlement: composedSettlementSocietyState.settlement,
			society: composedSettlementSocietyState.society
		});
	});

	it('parses every historical mission state identically and preserves its run refinement', () => {
		const cases = [
			{
				label: 'v1', schemaVersion: 11, leaf: MissionRunStateSchema,
				publicSchema: PublicMissionRunStateSchema,
				expectedReason: 'Mission attempt count is inconsistent'
			},
			{
				label: 'v2', schemaVersion: 12, leaf: MissionRunStateV2Schema,
				publicSchema: PublicMissionRunStateV2Schema,
				expectedReason: 'Mission attempt count is inconsistent'
			},
			{
				label: 'v3', schemaVersion: 13, leaf: MissionRunStateV3Schema,
				publicSchema: PublicMissionRunStateV3Schema,
				expectedReason: 'Mission combat attempt count is inconsistent'
			},
			{
				label: 'v4', schemaVersion: 14, leaf: MissionRunStateV4Schema,
				publicSchema: PublicMissionRunStateV4Schema,
				expectedReason: 'Mission evidence attempt count is inconsistent'
			},
			{
				label: 'v5', schemaVersion: 15, leaf: MissionRunStateV5Schema,
				publicSchema: PublicMissionRunStateV5Schema,
				expectedReason: 'Portal mission attempt count is inconsistent'
			},
			{
				label: 'v6', schemaVersion: 16, leaf: MissionRunStateV6Schema,
				publicSchema: PublicMissionRunStateV6Schema,
				expectedReason: 'Mission aftermath lifecycle is inconsistent'
			},
			{
				label: 'v7', schemaVersion: 17, leaf: MissionRunStateV7Schema,
				publicSchema: PublicMissionRunStateV7Schema,
				expectedReason: 'Mission Master aftermath lifecycle is inconsistent'
			},
			{
				label: 'v8', schemaVersion: 18, leaf: MissionRunStateV8Schema,
				publicSchema: PublicMissionRunStateV8Schema,
				expectedReason: 'Mission attempt aftermath lifecycle is inconsistent'
			}
		] as const;

		for (const missionCase of cases) {
			const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
				(fixture) => fixture.schemaVersion === missionCase.schemaVersion
			);
			if (!state || !('mission' in state)) {
				throw new Error(`Missing mission compatibility fixture for ${missionCase.label}`);
			}

			expect(missionCase.leaf.parse(state.mission)).toStrictEqual(
				missionCase.publicSchema.parse(state.mission)
			);

			const invalidMission = { ...state.mission, attemptCount: 1 };
			for (const schema of [missionCase.leaf, missionCase.publicSchema]) {
				const result = schema.safeParse(invalidMission);
				expect(result.success, `${missionCase.label} must reject an inconsistent count`).toBe(false);
				if (result.success) {
					throw new Error(`${missionCase.label} unexpectedly accepted an inconsistent count`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					missionCase.expectedReason
				);
			}
		}
	});

	it('parses every Master timing variant identically and preserves deadline refinements', () => {
		const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 19
		);
		if (!state || !('masterControl' in state)) {
			throw new Error('Missing Master-control v1 compatibility fixture');
		}
		const decisionId = '10000000-0000-4000-8000-000000000019';
		const openedAt = '2000-01-01T00:00:00.000Z';
		const timingCases = [
			{ timing: 'wait', expiresAt: null, invalidExpiresAt: '2000-01-01T00:01:00.000Z' },
			{
				timing: 'countdown',
				expiresAt: '2000-01-01T00:01:00.000Z',
				invalidExpiresAt: null
			},
			{ timing: 'step', expiresAt: null, invalidExpiresAt: '2000-01-01T00:01:00.000Z' },
			{
				timing: 'continuous', expiresAt: null,
				invalidExpiresAt: '2000-01-01T00:01:00.000Z'
			}
		] as const;

		for (const timingCase of timingCases) {
			const control = { ...state.masterControl, timing: timingCase.timing };
			expect(MasterControlStateSchema.parse(control)).toStrictEqual(
				PublicMasterControlStateSchema.parse(control)
			);

			const window = {
				decisionId,
				ordinal: 1,
				timing: timingCase.timing,
				openedAt,
				expiresAt: timingCase.expiresAt
			};
			expect(MasterDecisionWindowSchema.parse(window)).toStrictEqual(
				PublicMasterDecisionWindowSchema.parse(window)
			);

			const invalidWindow = { ...window, expiresAt: timingCase.invalidExpiresAt };
			for (const schema of [MasterDecisionWindowSchema, PublicMasterDecisionWindowSchema]) {
				const result = schema.safeParse(invalidWindow);
				expect(result.success, `${timingCase.timing} must enforce deadline presence`).toBe(false);
				if (result.success) {
					throw new Error(`${timingCase.timing} unexpectedly accepted its invalid deadline`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					'Only Countdown decisions have a deadline'
				);
			}
		}
	});

	it('parses every Master fallback variant identically and preserves priority refinements', () => {
		const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 20
		);
		if (!state || !('masterControl' in state)) {
			throw new Error('Missing Master-control v2 compatibility fixture');
		}

		for (const policy of ['directed', 'random'] as const) {
			const fallback = { ...state.masterControl.fallback, policy };
			const control = { ...state.masterControl, fallback };
			expect(MasterControlStateV2Schema.parse(control)).toStrictEqual(
				PublicMasterControlStateV2Schema.parse(control)
			);
			expect(MasterFallbackConfigurationSchema.parse(fallback)).toStrictEqual(
				PublicMasterFallbackConfigurationSchema.parse(fallback)
			);

			const invalidFallback = {
				...fallback,
				priorities: ['focus-objective', 'focus-objective']
			};
			for (const schema of [
				MasterFallbackConfigurationSchema,
				PublicMasterFallbackConfigurationSchema
			]) {
				const result = schema.safeParse(invalidFallback);
				expect(result.success, `${policy} must reject duplicate priorities`).toBe(false);
				if (result.success) {
					throw new Error(`${policy} unexpectedly accepted duplicate priorities`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					'Fallback priorities must be unique'
				);
			}
		}
	});
});
