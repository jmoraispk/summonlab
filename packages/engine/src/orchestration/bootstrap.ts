import {
	AuthoritativeEventSchema,
	CharacterMindSchema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineSnapshotSchema,
	ResourceKeySchema,
	type RewardDelta
} from '@summonlab/contracts';
import { IRON_MOON_PACKAGE, TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';

import { verifiedMissionBinding, verifiedSettlementContent } from '../core/content-bindings.js';
import { emptyMetadata, systemSource } from '../core/event-metadata.js';
import { hashParsedGameState } from '../core/state.js';
import type { BootstrapEngineInput, BootstrapEngineResult } from '../core/types.js';
import {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	DEFAULT_ACTIVE_SYSTEM_IDS,
	ENGINE_CONTENT_VERSION,
	ENGINE_EPOCH,
	FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION,
	MASTER_FALLBACK_ENGINE_CONTENT_VERSION,
	MASTER_PERMADEATH_ENGINE_CONTENT_VERSION,
	MASTER_TIMING_ENGINE_CONTENT_VERSION,
	MISSION_AFTERMATH_ENGINE_CONTENT_VERSION,
	MISSION_EVIDENCE_ENGINE_CONTENT_VERSION,
	PORTAL_ENGINE_CONTENT_VERSION,
	STORY_PATCH_ENGINE_CONTENT_VERSION,
	SYNTHESIS_ENGINE_CONTENT_VERSION
} from '../core/versions.js';
import { clamp } from '../domains/settlement/routines.js';
import { createBuildingStates } from '../domains/settlement/navigation.js';
import {
	createBootstrapCompanySociety,
	createBootstrapCompanySocietyV5
} from '../domains/settlement/society.js';
import {
	createFirstBandArchiveStoryCheckpoint,
	createSealedFirstBandArchive
} from '../domains/story/archive.js';
import { createStoryPatchCheckpoint } from '../domains/story/runtime.js';
import { deterministicUuid, EMPTY_STATE_HASH } from '../hash.js';

const DEFAULT_CHARACTER_MIND = CharacterMindSchema.parse({
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
	aptitudes: { might: 5, finesse: 5, insight: 5, resolve: 5 }
});

export function createBootstrapEngine(input: BootstrapEngineInput): BootstrapEngineResult {
	const masterId = deterministicUuid(`${input.runId}:master`);
	const commandId = deterministicUuid(`${input.runId}:bootstrap`);
	const eventId = deterministicUuid(`${commandId}:1:run.initialized`);
	const simulatedAt = input.simulatedAt ?? ENGINE_EPOCH;
	const initialResources = { food: 3, 'iron-ore': 2, 'ember-shard': 0 } as const;
	const resourceLedger = ResourceKeySchema.options.map((resource) => ({
		entryId: deterministicUuid(`${eventId}:resource:${resource}`),
		eventId,
		resource,
		before: 0,
		after: initialResources[resource],
		delta: initialResources[resource],
		reason: 'run bootstrap stock'
	}));
	const settlementContent = verifiedSettlementContent();
	const buildingStates = createBuildingStates(settlementContent);
	const developmentMissionScenario = input.developmentMissionScenario;
	if (input.additionalHeroes && developmentMissionScenario?.additionalHeroes) {
		throw new Error('Additional heroes must use one bootstrap boundary');
	}
	const bootstrapHeroInputs = [
		{
			heroId: input.heroId,
			manifestHash: input.manifestHash,
			rarityStars: input.rarityStars,
			mind: input.mind
		},
		...(input.additionalHeroes ?? developmentMissionScenario?.additionalHeroes ?? [])
	];
	if (
		bootstrapHeroInputs.length > 4 ||
		new Set(bootstrapHeroInputs.map((hero) => hero.heroId)).size !== bootstrapHeroInputs.length
	) {
		throw new Error('A development bootstrap supports one to four unique summoned heroes');
	}
	const bootstrapHeroes = bootstrapHeroInputs.map((hero) => {
		const mind = CharacterMindSchema.parse(hero.mind ?? DEFAULT_CHARACTER_MIND);
		return {
			...hero,
			mind,
			bladeId: deterministicUuid(`${input.runId}:${hero.heroId}:practice-blade`),
			bowId: deterministicUuid(`${input.runId}:${hero.heroId}:short-bow`)
		};
	});
	const foundryRouteMemoryHeroId = developmentMissionScenario?.foundryRouteMemoryHeroId;
	if (
		foundryRouteMemoryHeroId &&
		!bootstrapHeroes.some((hero) => hero.heroId === foundryRouteMemoryHeroId)
	) {
		throw new Error('Development route memory must belong to a bootstrapped hero');
	}
	const routeMemoryEvidenceId = foundryRouteMemoryHeroId
		? deterministicUuid(`${input.runId}:${foundryRouteMemoryHeroId}:foundry-route-memory`)
		: null;
	const availableMissionIds = developmentMissionScenario
		? [...developmentMissionScenario.availableMissionIds]
		: [TOWER_FLOOR_01_PACKAGE.missionId];
	const initialMissionId =
		developmentMissionScenario?.initialMissionId ?? TOWER_FLOOR_01_PACKAGE.missionId;
	if (!availableMissionIds.includes(initialMissionId)) {
		throw new Error('The initial development mission must be available');
	}
	const missionBinding = verifiedMissionBinding(initialMissionId);
	const portalDevelopmentScenario = initialMissionId === IRON_MOON_PACKAGE.missionId;
	const aftermathDevelopmentScenario = developmentMissionScenario?.enableMissionAftermath === true;
	const masterPermadeathDevelopmentScenario =
		developmentMissionScenario?.enableMasterPermadeath === true;
	const attemptAftermathDevelopmentScenario =
		developmentMissionScenario?.enableAttemptAftermath === true;
	const masterTimingDevelopmentScenario = developmentMissionScenario?.enableMasterTiming === true;
	const masterFallbackDevelopmentScenario =
		developmentMissionScenario?.enableMasterFallback === true;
	const storyPatchDevelopmentScenario = developmentMissionScenario?.enableStoryPatch === true;
	const synthesisDevelopmentScenario = developmentMissionScenario?.enableSynthesis === true;
	const firstBandArchiveDevelopmentScenario =
		developmentMissionScenario?.enableFirstBandArchive === true;
	const stateSchema = firstBandArchiveDevelopmentScenario
		? EngineGameStateV23Schema
		: synthesisDevelopmentScenario
			? EngineGameStateV22Schema
			: storyPatchDevelopmentScenario
				? EngineGameStateV21Schema
				: masterFallbackDevelopmentScenario
					? EngineGameStateV20Schema
					: masterTimingDevelopmentScenario
						? EngineGameStateV19Schema
						: attemptAftermathDevelopmentScenario
							? EngineGameStateV18Schema
							: masterPermadeathDevelopmentScenario
								? EngineGameStateV17Schema
								: aftermathDevelopmentScenario
									? EngineGameStateV16Schema
									: portalDevelopmentScenario
										? EngineGameStateV15Schema
										: developmentMissionScenario
											? EngineGameStateV14Schema
											: EngineGameStateV13Schema;
	const state = stateSchema.parse({
		schemaVersion: firstBandArchiveDevelopmentScenario
			? 23
			: synthesisDevelopmentScenario
				? 22
				: storyPatchDevelopmentScenario
					? 21
					: masterFallbackDevelopmentScenario
						? 20
						: masterTimingDevelopmentScenario
							? 19
							: attemptAftermathDevelopmentScenario
								? 18
								: masterPermadeathDevelopmentScenario
									? 17
									: aftermathDevelopmentScenario
										? 16
										: portalDevelopmentScenario
											? 15
											: developmentMissionScenario
												? 14
												: 13,
		runId: input.runId,
		seed: input.seed,
		contentVersion: firstBandArchiveDevelopmentScenario
			? FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION
			: synthesisDevelopmentScenario
				? SYNTHESIS_ENGINE_CONTENT_VERSION
				: storyPatchDevelopmentScenario
					? STORY_PATCH_ENGINE_CONTENT_VERSION
					: masterFallbackDevelopmentScenario
						? MASTER_FALLBACK_ENGINE_CONTENT_VERSION
						: masterTimingDevelopmentScenario
							? MASTER_TIMING_ENGINE_CONTENT_VERSION
							: attemptAftermathDevelopmentScenario
								? ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION
								: masterPermadeathDevelopmentScenario
									? MASTER_PERMADEATH_ENGINE_CONTENT_VERSION
									: aftermathDevelopmentScenario
										? MISSION_AFTERMATH_ENGINE_CONTENT_VERSION
										: portalDevelopmentScenario
											? PORTAL_ENGINE_CONTENT_VERSION
											: developmentMissionScenario
												? MISSION_EVIDENCE_ENGINE_CONTENT_VERSION
												: ENGINE_CONTENT_VERSION,
		status: 'active',
		version: 0,
		eventCursor: 1,
		entropyCursor: 0,
		simulatedAt,
		master: {
			masterId,
			lifeState: 'alive',
			location: 'summoning-gate',
			health: 100,
			maxHealth: 100,
			injuries: [],
			gateInspectionCount: 0,
			lastGateResonance: null
		},
		heroes: Object.fromEntries(
			bootstrapHeroes.map((hero) => [
				hero.heroId,
				{
					heroId: hero.heroId,
					lifeState: 'active',
					location: 'summoning-gate',
					locationNodeId: settlementContent.spawnNodeId,
					firstArrivalCompleted: false,
					destination: null,
					health: 100,
					maxHealth: 100,
					manifestHash: hero.manifestHash,
					needs: { hunger: 20, fatigue: 15 },
					injuries: [],
					progression: {
						stars: hero.rarityStars ?? 1,
						level: 1,
						experience: 0,
						skills: { swordFighting: { rank: 0, experience: 0 } }
					},
					equipment: { mainHand: hero.bladeId },
					currentActivity: null,
					currentTravel: null,
					assignment: null,
					mind: hero.mind,
					habit: {
						habit: hero.mind.dailyHabit,
						strength: clamp(Math.round(35 + hero.mind.personality.conscientiousness * 0.55)),
						repetitions: 0,
						satisfaction: 50,
						lastTriggeredAt: null
					},
					dailyPlan: null,
					currentRoutine: null
				}
			])
		),
		settlement: {
			resources: initialResources,
			resourceLedger,
			navigation: {
				settlementId: settlementContent.settlementId,
				contentVersion: settlementContent.contentVersion,
				contentHash: settlementContent.contentHash,
				activeSystemIds: [...DEFAULT_ACTIVE_SYSTEM_IDS]
			},
			poweredBuildingId: null,
			buildings: buildingStates,
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
		items: Object.assign(
			{},
			...bootstrapHeroes.map((hero) => ({
				[hero.bladeId]: {
					itemId: hero.bladeId,
					templateId: 'practice-blade',
					displayName: 'Gatehouse Practice Blade',
					ownerId: hero.heroId,
					slot: 'main-hand',
					equippedById: hero.heroId,
					durability: 6,
					maxDurability: 6
				},
				[hero.bowId]: {
					itemId: hero.bowId,
					templateId: 'short-bow',
					displayName: 'Ash Short Bow',
					ownerId: hero.heroId,
					slot: 'main-hand',
					equippedById: null,
					durability: 4,
					maxDurability: 4
				}
			}))
		),
		society:
			synthesisDevelopmentScenario || firstBandArchiveDevelopmentScenario
				? createBootstrapCompanySocietyV5(
						bootstrapHeroes.map((hero) => hero.heroId),
						masterId,
						eventId,
						simulatedAt
					)
				: createBootstrapCompanySociety(
						bootstrapHeroes.map((hero) => hero.heroId),
						masterId,
						eventId,
						simulatedAt
					),
		mission: {
			binding: missionBinding,
			...(developmentMissionScenario
				? {
						availableMissionIds,
						evidence:
							foundryRouteMemoryHeroId && routeMemoryEvidenceId
								? {
										[routeMemoryEvidenceId]: {
											evidenceId: routeMemoryEvidenceId,
											evidenceKey: 'foundry-maintenance-route',
											holderActorId: foundryRouteMemoryHeroId,
											sourceBinding: verifiedMissionBinding('tower-floor-04'),
											sourceAttemptId: deterministicUuid(`${input.runId}:floor-04-memory-source`),
											discoveredOnRound: 5
										}
									}
								: {}
					}
				: {}),
			...(firstBandArchiveDevelopmentScenario ||
			synthesisDevelopmentScenario ||
			storyPatchDevelopmentScenario ||
			masterFallbackDevelopmentScenario ||
			masterTimingDevelopmentScenario ||
			attemptAftermathDevelopmentScenario
				? {
						aftermath: {
							aftermathVersion: 'mission-aftermath-v3',
							activeAttemptId: null,
							consequences: [],
							archives: []
						}
					}
				: masterPermadeathDevelopmentScenario
					? {
							aftermath: {
								aftermathVersion: 'mission-aftermath-v2',
								consequences: []
							}
						}
					: aftermathDevelopmentScenario
						? {
								aftermath: {
									aftermathVersion: 'mission-aftermath-v1',
									consequences: []
								}
							}
						: {}),
			attemptCount: 0,
			attempt: null
		},
		...(firstBandArchiveDevelopmentScenario ||
		synthesisDevelopmentScenario ||
		storyPatchDevelopmentScenario ||
		masterFallbackDevelopmentScenario
			? {
					masterControl: {
						timing: 'wait',
						countdownSeconds: 5,
						revision: 0,
						decisionOrdinal: 0,
						activeDecision: null,
						lastResolution: null,
						fallback: {
							configurationVersion: 'master-fallback-v1',
							policy: 'directed',
							directionId: deterministicUuid(`${input.runId}:master-fallback-direction:0`),
							directionText: 'Advance the objective while protecting the company.',
							priorities: ['focus-objective', 'protect-self', 'protect-party'],
							protectedHeroId: null,
							safetyStops: {
								beforeIrreversibleAction: true,
								masterHealthThreshold: 35,
								whenUnclassified: true,
								maximumConsecutiveFallbacks: 8
							},
							configuredAt: simulatedAt
						},
						consecutiveFallbacks: 0
					}
				}
			: masterTimingDevelopmentScenario
				? {
						masterControl: {
							timing: 'wait',
							countdownSeconds: 5,
							revision: 0,
							decisionOrdinal: 0,
							activeDecision: null,
							lastResolution: null
						}
					}
				: {}),
		story: { envelopeId: 'first-ember-v1', branch: null },
		...(firstBandArchiveDevelopmentScenario ||
		synthesisDevelopmentScenario ||
		storyPatchDevelopmentScenario
			? {
					bandStory: firstBandArchiveDevelopmentScenario
						? createFirstBandArchiveStoryCheckpoint()
						: createStoryPatchCheckpoint()
				}
			: {}),
		...(synthesisDevelopmentScenario || firstBandArchiveDevelopmentScenario
			? { synthesis: { contentVersion: 'synthesis-v1', receipts: {}, rumors: {} } }
			: {}),
		...(firstBandArchiveDevelopmentScenario
			? { firstBandArchive: createSealedFirstBandArchive() }
			: {})
	});
	const stateHash = hashParsedGameState(state);
	const rewardDeltas = resourceLedger.map((entry): RewardDelta => ({
		ownerId: masterId,
		kind: 'resource',
		key: entry.resource,
		before: entry.before,
		after: entry.after,
		delta: entry.delta
	}));
	const event = AuthoritativeEventSchema.parse({
		eventId,
		runId: input.runId,
		sequence: 1,
		schemaVersion: state.schemaVersion,
		gameTime: state.simulatedAt,
		eventType: 'run.initialized',
		actorId: null,
		commandId,
		causationId: null,
		correlationId: commandId,
		source: systemSource(),
		seedCursor: 0,
		beforeStateHash: EMPTY_STATE_HASH,
		afterStateHash: stateHash,
		contentVersion: state.contentVersion,
		payload: {
			initialState: state,
			...emptyMetadata(
				bootstrapHeroes.length === 1
					? 'The Master awakened beside a stocked gate and one new summon.'
					: `The Master awakened beside a stocked gate and ${bootstrapHeroes.length} new summons.`,
				rewardDeltas
			)
		}
	});
	return { snapshot: EngineSnapshotSchema.parse({ state, stateHash }), event };
}
