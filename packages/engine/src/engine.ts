import {
	AuthoritativeEventSchema,
	CharacterMindSchema,
	EngineCommandSchema,
	EngineGameStateSchema,
	EngineGameStateV1Schema,
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
	EntropyDrawSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	ResourceKeySchema,
	DirectiveRecordSchema,
	DirectiveInfluenceRecordSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type LegalAction,
	type RewardDelta,
	type DirectiveRecord,
	type ScheduledEvent
} from '@summonlab/contracts';
import { IRON_MOON_PACKAGE, TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';
import { z } from 'zod';

import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';
import { eventDeltas, eventSummary } from './journal.js';
import {
	settlementForState,
	verifiedMissionBinding,
	verifiedSettlementContent
} from './core/content-bindings.js';
import {
	RewardDeltasSchema,
	emptyMetadata,
	entropyDrawsFromEvent,
	metadataIds,
	systemSource
} from './core/event-metadata.js';
import { hashParsedGameState, parseModernState } from './core/state.js';
import type {
	BootstrapEngineInput,
	BootstrapEngineResult,
	EngineApplyResult,
	EngineGameStateModern,
	ReplayCheck,
	ReplayResult
} from './core/types.js';
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
	SYNTHESIS_ENGINE_CONTENT_VERSION,
	hasNavigationState,
	isModernState
} from './core/versions.js';
import {
	createFirstBandArchiveStoryCheckpoint,
	createSealedFirstBandArchive
} from './domains/story/archive.js';
import { storyCommandHandler } from './domains/story/commands.js';
import { storyEventReducer } from './domains/story/reducer.js';
import { createStoryPatchCheckpoint } from './domains/story/runtime.js';
import { synthesisCommandHandler } from './domains/synthesis/commands.js';
import { synthesisEventReducer } from './domains/synthesis/reducer.js';
import {
	SETTLEMENT_COMMAND_TYPES,
	assertSettlementCommandLegalWithActionIds,
	requiredSettlementAction,
	settlementCommandHandler,
	type SettlementCommand
} from './domains/settlement/commands.js';
import {
	action,
	settlementLegalActions,
	settlementTravelActions
} from './domains/settlement/actions.js';
import { createBuildingStates, destinationNodeId } from './domains/settlement/navigation.js';
import { clamp } from './domains/settlement/routines.js';
import {
	createBootstrapCompanySociety,
	createBootstrapCompanySocietyV5,
	heroCanHearCommunication
} from './domains/settlement/society.js';
import {
	ActivityStartedPayloadSchema,
	DirectiveChangedPayloadSchema,
	RoutineStartedPayloadSchema,
	SETTLEMENT_EVENT_TYPES,
	TravelStartedPayloadSchema,
	settlementEventReducer
} from './domains/settlement/reducer.js';
import {
	missionLegalActions,
	missionTurnLegalActions,
	supportsMissionActions
} from './domains/mission/actions.js';
import { MISSION_COMMAND_TYPES, type MissionCommand } from './domains/mission/commands.js';
import { missionEventReducer } from './domains/mission/reducer.js';
import { missionPartyIsReserved } from './domains/mission/lifecycle.js';
import {
	isIrreversibleMasterAction,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	selectMasterFallback
} from './domains/mission/master-control.js';
import {
	monsterArmorReduction,
	resolveMonsterPolicyIntent,
	type MonsterIntentScenario
} from './domains/mission/monster-policy.js';
import {
	firstBandMissionCommandHandler,
	firstBandMissionEventReducer
} from './orchestration/first-band-mission-reducer.js';

export { storyPatchCastForState, validateStoryPatchForState } from './domains/story/runtime.js';
export { resolveDailyRoutine } from './domains/settlement/routines.js';
export {
	isIrreversibleMasterAction,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	missionTurnLegalActions,
	monsterArmorReduction,
	resolveMonsterPolicyIntent,
	selectMasterFallback
};

export {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	COMMUNICATION_ENGINE_CONTENT_VERSION,
	CONVERSATION_ENGINE_CONTENT_VERSION,
	DIRECTIVE_ENGINE_CONTENT_VERSION,
	ENGINE_CONTENT_VERSION,
	ENGINE_EPOCH,
	ENGINE_INVARIANTS,
	FACILITY_ENGINE_CONTENT_VERSION,
	FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION,
	FIRST_EMBER_ENGINE_CONTENT_VERSION,
	LEGACY_ENGINE_CONTENT_VERSION,
	MASTER_FALLBACK_ENGINE_CONTENT_VERSION,
	MASTER_PERMADEATH_ENGINE_CONTENT_VERSION,
	MASTER_TIMING_ENGINE_CONTENT_VERSION,
	MISSION_AFTERMATH_ENGINE_CONTENT_VERSION,
	MISSION_COMBAT_ENGINE_CONTENT_VERSION,
	MISSION_ENGINE_CONTENT_VERSION,
	MISSION_EVIDENCE_ENGINE_CONTENT_VERSION,
	MISSION_TURN_ENGINE_CONTENT_VERSION,
	PORTAL_ENGINE_CONTENT_VERSION,
	PREVIOUS_ENGINE_CONTENT_VERSION,
	ROUTINE_ENGINE_CONTENT_VERSION,
	SOCIAL_ENGINE_CONTENT_VERSION,
	STORY_PATCH_ENGINE_CONTENT_VERSION,
	SYNTHESIS_ENGINE_CONTENT_VERSION,
	TRAVEL_ENGINE_CONTENT_VERSION
} from './core/versions.js';
export { hashGameState } from './core/state.js';
export type {
	BootstrapAdditionalHeroInput,
	BootstrapEngineInput,
	BootstrapEngineResult,
	EngineApplyResult,
	ReplayCheck,
	ReplayResult
} from './core/types.js';
export type { MonsterIntentScenario };

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

const InitializedPayloadSchema = z
	.object({
		initialState: EngineGameStateSchema,
		entropyDraws: z.array(EntropyDrawSchema),
		summary: z.string().optional(),
		rewardDeltas: RewardDeltasSchema.optional(),
		resolvedScheduledEventIds: z.array(z.string().uuid()).optional(),
		canceledScheduledEventIds: z.array(z.string().uuid()).optional()
	})
	.strict();

const LegacyChoosePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		firstLine: z.string(),
		storyBranch: z.string(),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const LegacyArrivePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const LegacyInspectPayloadSchema = z
	.object({
		masterId: z.string().uuid(),
		resonance: z.number().int().min(0).max(99),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema).length(1)
	})
	.strict();

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

function masterActionsV2(state: EngineGameStateModern): LegalAction[] {
	const actorId = state.master.masterId;
	const controlActions: LegalAction[] =
		state.schemaVersion === 19 || state.schemaVersion === 20
			? [
					action({
						actionId: 'master.control.configure',
						actorId,
						kind: 'interact',
						label: 'Change Master decision timing',
						description:
							'Persist Wait, Countdown, Step, or Continuous independently from action selection.',
						targetIds: [],
						resourceCosts: {},
						tags: ['master', 'control', 'timing', 'replay']
					}),
					...(state.schemaVersion === 20
						? [
								action({
									actionId: 'master.fallback.configure',
									actorId,
									kind: 'interact',
									label: 'Configure unattended selection',
									description:
										'Persist directed or seeded-random fallback intent and safety stops.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'fallback', 'safety', 'replay']
								}),
								...(state.masterControl.activeDecision !== null &&
								state.masterControl.activeDecision.timing !== 'wait' &&
								selectMasterFallback(state).safetyStopReason
									? [
											action({
												actionId: 'master.safety-stop.apply',
												actorId,
												kind: 'wait',
												label: 'Apply fallback safety stop',
												description:
													'Force Wait at this legal boundary and retain the blocked selection evidence.',
												targetIds: [],
												resourceCosts: {},
												tags: ['master', 'control', 'fallback', 'safety-stop', 'replay']
											})
										]
									: [])
							]
						: []),
					...(state.masterControl.activeDecision === null &&
					state.mission.attempt !== null &&
					['deployed', 'resolving'].includes(state.mission.attempt.status)
						? [
								action({
									actionId: 'master.decision.open',
									actorId,
									kind: 'interact',
									label: 'Open the next Master decision',
									description:
										'Bind one authoritative decision window to the current mission state.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'decision-window', 'replay']
								})
							]
						: [])
				]
			: [];
	const missionActions = missionLegalActions(state, actorId);
	if (
		supportsMissionActions(state) &&
		state.mission.attempt &&
		['preparing', 'deployed', 'resolving', 'extraction'].includes(state.mission.attempt.status)
	) {
		return [...controlActions, ...missionActions];
	}
	const [inspectGate, ...settlementTail] = settlementLegalActions(state, actorId);
	const actions: LegalAction[] = [...controlActions, ...(inspectGate ? [inspectGate] : [])];
	if (state.schemaVersion === 22 || state.schemaVersion === 23) {
		const eligible = Object.values(state.heroes).filter(
			(hero) =>
				hero.lifeState === 'active' &&
				hero.location === 'summoning-gate' &&
				!hero.currentActivity &&
				!hero.currentTravel &&
				!hero.currentRoutine &&
				!hero.assignment
		);
		if (eligible.length >= 2 && !state.mission.attempt) {
			actions.push(
				action({
					actionId: 'settlement.synthesis.commit',
					actorId,
					kind: 'interact',
					label: 'Confirm a synthesis pair',
					description:
						'Permanently consume one ready summon, grant bounded essence to another, and record witness-bounded fallout.',
					targetIds: eligible.map((hero) => hero.heroId),
					resourceCosts: {},
					tags: ['settlement', 'synthesis', 'irreversible', 'social', 'replay']
				})
			);
		}
	}
	if (state.schemaVersion === 23 && state.firstBandArchive.status === 'recovered') {
		actions.push(
			action({
				actionId: 'story.first.archive.reveal',
				actorId,
				kind: 'interact',
				label: 'Open the recovered archive fragment',
				description:
					'Choose one surviving reader; their personality shapes the delivery while the authored fact remains fixed.',
				targetIds: state.firstBandArchive.recovery?.survivingHeroIds ?? [],
				resourceCosts: {},
				tags: ['story', 'archive', 'knowledge', 'replay']
			})
		);
	}
	if (state.schemaVersion === 21 && state.bandStory.appliedPatches.length === 0) {
		actions.push(
			action({
				actionId: 'story.patch.apply',
				actorId,
				kind: 'interact',
				label: 'Commit an engine-validated story patch',
				description:
					'Activate one catalogued optional beat at the open Floor 04 checkpoint without changing fixed story authority.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story', 'patch', 'catalog-bound', 'replay']
			})
		);
	}
	actions.push(...missionActions);
	actions.push(...settlementTail);
	return actions;
}

function heroActionsV2(state: EngineGameStateModern, actorId: string): LegalAction[] {
	if (state.schemaVersion === 22) {
		const speaker = state.heroes[actorId];
		if (speaker?.lifeState === 'active' && heroCanHearCommunication(speaker)) {
			const rumorActions = Object.values(state.synthesis.receipts).flatMap((receipt) => {
				const directlyKnows = receipt.socialConsequences.some(
					(consequence) => consequence.heroId === actorId && consequence.knowledge !== 'absence'
				);
				const learnedRumor = Object.values(state.synthesis.rumors).some(
					(rumor) => rumor.receiptId === receipt.receiptId && rumor.listenerHeroId === actorId
				);
				if (!directlyKnows && !learnedRumor) return [];
				return Object.values(state.heroes)
					.filter((target) => {
						if (
							target.heroId === actorId ||
							target.lifeState !== 'active' ||
							target.location !== speaker.location ||
							target.locationNodeId !== speaker.locationNodeId ||
							!heroCanHearCommunication(target)
						)
							return false;
						return !Object.values(state.society.observations).some(
							(observation) =>
								'synthesisReceiptId' in observation &&
								observation.synthesisReceiptId === receipt.receiptId &&
								observation.observerHeroId === target.heroId &&
								observation.kind !== 'synthesis-absence'
						);
					})
					.sort((left, right) => left.heroId.localeCompare(right.heroId))
					.map((target) =>
						action({
							actionId: `synthesis.rumor.share.${receipt.receiptId.slice(-8)}.${target.heroId.slice(-8)}`,
							actorId,
							kind: 'interact',
							label: `Tell ${target.heroId.slice(0, 8)} what happened`,
							description:
								'Share a sourced synthesis claim; confidence falls as the explicit rumor chain grows.',
							targetIds: [target.heroId],
							resourceCosts: {},
							tags: ['social', 'synthesis', 'rumor', 'provenance']
						})
					);
			});
			if (rumorActions.length > 0) return rumorActions;
		}
	}
	const missionActions = missionLegalActions(state, actorId);
	if (
		missionActions.length > 0 ||
		(supportsMissionActions(state) && missionPartyIsReserved(state, actorId))
	) {
		return [...missionActions];
	}
	return settlementLegalActions(state, actorId);
}

function legalActionsForParsedState(
	state: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId && state.master.lifeState === 'alive') {
		if (isModernState(state)) return masterActionsV2(state);
		return [
			action({
				actionId: 'master.inspect.gate',
				actorId,
				kind: 'interact',
				label: 'Inspect the gate resonance',
				description: 'Draw one named deterministic resonance value without advancing time.',
				targetIds: [],
				resourceCosts: {},
				tags: ['deterministic', 'development-proof']
			})
		];
	}
	return isModernState(state)
		? heroActionsV2(state, actorId)
		: settlementLegalActions(state, actorId);
}

export function legalActions(stateInput: EngineGameState, actorId: string): readonly LegalAction[] {
	return legalActionsForParsedState(EngineGameStateSchema.parse(stateInput), actorId);
}

export function decisionLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	const actions = legalActionsForParsedState(state, actorId);
	if (
		!actions.some((candidate) => candidate.actionId === 'hero.travel') ||
		!hasNavigationState(state)
	) {
		return actions;
	}
	const hero = state.heroes[actorId];
	const targets =
		hero && !hero.firstArrivalCompleted && hero.destination
			? [destinationNodeId(settlementForState(state), hero.destination)]
			: undefined;
	const expandedTravel = settlementTravelActions(state, actorId, targets);
	return actions.flatMap((candidate) =>
		candidate.actionId === 'hero.travel' ? expandedTravel : [candidate]
	);
}

function boundedDecisionText(result: HeroPolicyResult): string {
	const text = result.decision.spokenText ?? result.decision.publicIntent;
	return text.length <= 500 ? text : text.slice(0, 500).trimEnd();
}

export function commandFromHeroPolicyResult(input: {
	readonly state: EngineGameState;
	readonly packet: HeroDecisionPacket;
	readonly result: HeroPolicyResult;
	readonly decisionJobId: string;
}): EngineCommand {
	const state = EngineGameStateSchema.parse(input.state);
	const packet = HeroDecisionPacketSchema.parse(input.packet);
	const result = HeroPolicyResultSchema.parse(input.result);
	const unsignedPacket = { ...packet } as Partial<HeroDecisionPacket>;
	delete unsignedPacket.packetHash;
	const unsignedResult = { ...result } as Partial<HeroPolicyResult>;
	delete unsignedResult.resultHash;
	if (
		hashCanonical(unsignedPacket) !== packet.packetHash ||
		hashCanonical(unsignedResult) !== result.resultHash ||
		packet.runId !== state.runId ||
		packet.heroId !== packet.identity.profile.characterId ||
		packet.world.stateVersion !== state.version ||
		packet.world.eventCursor !== state.eventCursor ||
		packet.world.stateHash !== hashParsedGameState(state) ||
		result.packetId !== packet.packetId ||
		result.packetHash !== packet.packetHash ||
		result.legalActionHash !== packet.legalActionHash ||
		result.world.stateVersion !== packet.world.stateVersion ||
		result.world.eventCursor !== packet.world.eventCursor ||
		result.world.stateHash !== packet.world.stateHash
	) {
		throw new Error('Decision result is not bound to the current engine state');
	}
	const currentActions = [...decisionLegalActions(state, packet.heroId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (hashCanonical(currentActions) !== packet.legalActionHash) {
		throw new Error('Decision legal actions are stale');
	}
	const selectedAction = currentActions.find(
		(candidate) => candidate.actionId === result.decision.actionId
	);
	if (
		!selectedAction ||
		result.decision.targetIds.some((targetId) => !selectedAction.targetIds.includes(targetId))
	) {
		throw new IllegalActionError(
			result.decision.actionId,
			currentActions.map((action) => action.actionId)
		);
	}
	const commandId = deterministicUuid(
		`${input.decisionJobId}:apply:${packet.packetHash}:${result.resultHash}`
	);
	const base = {
		commandId,
		runId: state.runId,
		actorId: packet.heroId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`${input.decisionJobId}:correlation`),
		source: {
			source: result.trace.kind,
			timing: null,
			fallbackPolicy: null,
			directiveIds: packet.activeDirectives.map((directive) => directive.directiveId),
			decisionJobId: input.decisionJobId
		}
	};
	const actionId = result.decision.actionId;
	if (actionId === 'hero.choose.kitchen' || actionId === 'hero.choose.training-ground') {
		const destination = actionId === 'hero.choose.kitchen' ? 'kitchen' : 'training-ground';
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.choose.destination',
			destination,
			firstLine: boundedDecisionText(result),
			storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust'
		});
	}
	if (actionId === 'hero.arrive.destination') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.arrive' });
	}
	if (actionId.startsWith('hero.travel.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.travel',
			targetNodeId: actionId.slice('hero.travel.'.length)
		});
	}
	if (actionId === 'hero.plan.day') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.plan.day' });
	}
	if (actionId === 'hero.follow.plan') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.start.routine' });
	}
	if (
		actionId === 'hero.activity.train' ||
		actionId === 'hero.activity.eat' ||
		actionId === 'hero.activity.rest' ||
		actionId === 'hero.activity.repair'
	) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.activity',
			activity: actionId.slice('hero.activity.'.length)
		});
	}
	if (actionId.startsWith('hero.equip.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.equip.item',
			itemId: actionId.slice('hero.equip.'.length)
		});
	}
	throw new IllegalActionError(
		actionId,
		currentActions.map((action) => action.actionId)
	);
}

function requiredAction(command: EngineCommand): string {
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return requiredSettlementAction(command as SettlementCommand);
	}
	if (command.commandType === 'master.configure.timing') return 'master.control.configure';
	if (command.commandType === 'master.configure.fallback') return 'master.fallback.configure';
	if (command.commandType === 'master.apply.safety-stop') return 'master.safety-stop.apply';
	if (command.commandType === 'master.open.decision') return 'master.decision.open';
	if (command.commandType === 'mission.prepare') return 'mission.prepare';
	if (command.commandType === 'mission.revise.party') return 'mission.revise.party';
	if (command.commandType === 'mission.cancel') return 'mission.cancel';
	if (command.commandType === 'mission.deploy') return 'mission.deploy';
	if (command.commandType === 'mission.resolve.turn') return 'mission.resolve.turn';
	if (command.commandType === 'mission.open.extraction') return 'mission.open.extraction';
	if (command.commandType === 'mission.extract') return 'mission.extract';
	if (command.commandType === 'mission.retreat') return 'mission.retreat';
	if (command.commandType === 'story.apply.patch') return 'story.patch.apply';
	if (command.commandType === 'story.reveal.first.archive') return 'story.first.archive.reveal';
	if (command.commandType === 'settlement.synthesize.hero') return 'settlement.synthesis.commit';
	if (command.commandType === 'hero.share.synthesis.rumor')
		return `synthesis.rumor.share.${command.receiptId.slice(-8)}.${command.targetHeroId.slice(-8)}`;
	throw new Error('Unreachable engine command discriminator');
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	if (
		command.commandType === 'settlement.synthesize.hero' ||
		command.commandType === 'hero.share.synthesis.rumor'
	) {
		synthesisCommandHandler.assertLegal(state, command);
		return;
	}
	if (command.commandType === 'story.reveal.first.archive') {
		storyCommandHandler.assertLegal(state, command);
		if (
			!legalActionsForParsedState(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (MISSION_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		firstBandMissionCommandHandler.assertLegal(state, command as MissionCommand);
		if (
			command.commandType === 'master.configure.timing' ||
			command.commandType === 'master.open.decision' ||
			command.commandType === 'master.configure.fallback' ||
			command.commandType === 'master.apply.safety-stop'
		) {
			if (
				!legalActions(state, command.actorId).some(
					(candidate) => candidate.actionId === requiredAction(command)
				)
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			return;
		}
		if (
			command.commandType === 'mission.open.extraction' ||
			command.commandType === 'mission.resolve.turn'
		) {
			return;
		}
		const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
		const required = requiredAction(command);
		if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
		return;
	}
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		assertSettlementCommandLegalWithActionIds(
			state,
			command as SettlementCommand,
			legalActions(state, command.actorId).map((candidate) => candidate.actionId)
		);
		return;
	}
	if (command.commandType === 'story.apply.patch') {
		storyCommandHandler.assertLegal(state, command);
	}
	const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
}
function buildLegacyEvent(state: EngineGameStateV1, command: EngineCommand): AuthoritativeEvent {
	return settlementCommandHandler.buildEvent(state, command as SettlementCommand);
}

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
	if (
		command.commandType === 'settlement.synthesize.hero' ||
		command.commandType === 'hero.share.synthesis.rumor'
	) {
		return synthesisCommandHandler.buildEvent(state, command);
	}
	if (
		command.commandType === 'story.apply.patch' ||
		command.commandType === 'story.reveal.first.archive'
	) {
		return storyCommandHandler.buildEvent(state, command);
	}
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return settlementCommandHandler.buildEvent(state, command as SettlementCommand);
	}
	if (MISSION_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return firstBandMissionCommandHandler.buildEvent(state, command as MissionCommand);
	}
	throw new IllegalActionError(command.commandType);
}
function reduceLegacyEvent(state: EngineGameStateV1, event: AuthoritativeEvent): EngineGameStateV1 {
	if (event.eventType === 'hero.destination.selected') {
		const payload = LegacyChoosePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError(
				'Destination event references an unknown hero',
				event.sequence
			);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, destination: payload.destination } },
			story: { ...state.story, branch: payload.storyBranch }
		});
	}
	if (event.eventType === 'hero.arrived') {
		const payload = LegacyArrivePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError('Arrival event references an unknown hero', event.sequence);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, location: payload.destination } }
		});
	}
	if (event.eventType === 'master.gate.inspected') {
		const payload = LegacyInspectPayloadSchema.parse(event.payload);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			master: {
				...state.master,
				gateInspectionCount: state.master.gateInspectionCount + 1,
				lastGateResonance: payload.resonance
			}
		});
	}
	throw new ReplayIntegrityError(
		`Unsupported legacy event type: ${event.eventType}`,
		event.sequence
	);
}

function reduceV2Event(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameStateModern {
	if (storyEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return storyEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (synthesisEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return synthesisEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (SETTLEMENT_EVENT_TYPES.some((eventType) => eventType === event.eventType)) {
		return settlementEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (missionEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return missionEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (firstBandMissionEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return firstBandMissionEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}
function reduceParsedEvent(state: EngineGameState, event: AuthoritativeEvent): EngineGameState {
	if (event.runId !== state.runId)
		throw new ReplayIntegrityError('Event run does not match state', event.sequence);
	if (event.sequence !== state.eventCursor + 1)
		throw new ReplayIntegrityError('Event sequence is not contiguous', event.sequence);
	const reduced =
		state.schemaVersion === 1 ? reduceLegacyEvent(state, event) : reduceV2Event(state, event);
	if (
		state.schemaVersion !== 10 &&
		state.schemaVersion !== 11 &&
		state.schemaVersion !== 12 &&
		state.schemaVersion !== 13 &&
		state.schemaVersion !== 16
	)
		return reduced;
	const influences = z
		.array(DirectiveInfluenceRecordSchema)
		.max(16)
		.parse((event.payload as Record<string, unknown>).directiveInfluences ?? []);
	if (influences.length === 0) return reduced;
	if (
		reduced.schemaVersion !== 10 &&
		reduced.schemaVersion !== 11 &&
		reduced.schemaVersion !== 12 &&
		reduced.schemaVersion !== 13 &&
		reduced.schemaVersion !== 16
	) {
		throw new ReplayIntegrityError('Directive influence changed schema version', event.sequence);
	}
	const directives = { ...reduced.society.directives };
	const directiveInfluences = { ...reduced.society.directiveInfluences };
	for (const influence of influences) {
		const directive = state.society.directives[influence.directiveId];
		if (
			!directive ||
			directive.status !== 'active' ||
			influence.heroId !== event.actorId ||
			influence.sourceEventId !== event.eventId ||
			influence.evaluatedAt !== state.simulatedAt ||
			!event.source.directiveIds.includes(influence.directiveId) ||
			influence.decisionJobId !== event.source.decisionJobId
		) {
			throw new ReplayIntegrityError('Directive influence provenance diverged', event.sequence);
		}
		directiveInfluences[influence.influenceId] = influence;
		if (directive.scope === 'decision') {
			directives[directive.directiveId] = DirectiveRecordSchema.parse({
				...directive,
				status: 'consumed',
				terminalAt: event.gameTime,
				terminalEventId: event.eventId
			});
		}
	}
	const next = {
		...reduced,
		society: {
			...reduced.society,
			directives,
			directiveInfluences
		}
	};
	return parseModernState(reduced, next);
}

export function reduceEvent(
	stateInput: EngineGameState,
	eventInput: AuthoritativeEvent
): EngineGameState {
	return reduceParsedEvent(
		EngineGameStateSchema.parse(stateInput),
		AuthoritativeEventSchema.parse(eventInput)
	);
}

export function scheduledEventsFromEvent(event: AuthoritativeEvent): readonly ScheduledEvent[] {
	if (event.eventType === 'hero.activity.started')
		return [ActivityStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.travel.started')
		return [TravelStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.routine.started')
		return [RoutineStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (
		event.eventType === 'social.directive.issued' ||
		event.eventType === 'social.directive.replaced'
	) {
		const scheduledEvent = DirectiveChangedPayloadSchema.parse(event.payload).scheduledEvent;
		return scheduledEvent ? [scheduledEvent] : [];
	}
	return [];
}

export function resolvedScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'resolvedScheduledEventIds');
}

export function canceledScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'canceledScheduledEventIds');
}

const DIRECTIVE_STOP_WORDS = new Set([
	'and',
	'are',
	'before',
	'choose',
	'for',
	'from',
	'that',
	'the',
	'then',
	'this',
	'with',
	'you',
	'your'
]);

function directiveTerms(directive: DirectiveRecord): string[] {
	return [...directive.text.toLowerCase().split(/[^a-z0-9]+/u), ...directive.priorities]
		.map((term) => term.toLowerCase().trim())
		.filter((term) => term.length >= 3 && !DIRECTIVE_STOP_WORDS.has(term));
}

function actionMatchesDirective(action: LegalAction, directive: DirectiveRecord): boolean {
	const searchable = [action.actionId, action.label, action.description, ...action.tags]
		.join(' ')
		.toLowerCase();
	return directiveTerms(directive).some((term) => searchable.includes(term));
}

function attachDirectiveInfluences(
	state: EngineGameState,
	command: EngineCommand,
	event: AuthoritativeEvent
): AuthoritativeEvent {
	if (
		(state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20) ||
		!state.heroes[command.actorId] ||
		command.source.directiveIds.length === 0
	) {
		return event;
	}
	const legal = legalActionsForParsedState(state, command.actorId);
	const actionId = requiredAction(command);
	const selected = legal.find((action) => action.actionId === actionId);
	if (!selected) return event;
	const influences = command.source.directiveIds
		.map((directiveId) => state.society.directives[directiveId])
		.filter((directive): directive is DirectiveRecord =>
			Boolean(
				directive &&
				directive.status === 'active' &&
				directive.recipientIds.includes(command.actorId)
			)
		)
		.map((directive) => {
			const selectedMatches = actionMatchesDirective(selected, directive);
			const alternativeMatches = legal.some(
				(action) => action.actionId !== actionId && actionMatchesDirective(action, directive)
			);
			const outcome = selectedMatches
				? ('advanced' as const)
				: alternativeMatches
					? ('conflicted' as const)
					: ('unavailable' as const);
			return DirectiveInfluenceRecordSchema.parse({
				influenceId: deterministicUuid(`${event.eventId}:${directive.directiveId}:influence`),
				directiveId: directive.directiveId,
				heroId: command.actorId,
				sourceEventId: event.eventId,
				decisionJobId: command.source.decisionJobId,
				actionId,
				outcome,
				rationale:
					outcome === 'advanced'
						? 'The chosen legal action matched the direction text or its structured priorities.'
						: outcome === 'conflicted'
							? 'Another legal action matched the direction more closely than the chosen action.'
							: 'No legal action matched the direction; the direction could not expand the legal set.',
				evaluatedAt: state.simulatedAt
			});
		});
	if (influences.length === 0) return event;
	return AuthoritativeEventSchema.parse({
		...event,
		payload: { ...event.payload, directiveInfluences: influences }
	});
}

export function applyCommand(
	stateInput: EngineGameState,
	commandInput: EngineCommand
): EngineApplyResult {
	const state = EngineGameStateSchema.parse(stateInput);
	const command = EngineCommandSchema.parse(commandInput);
	assertCommandIsLegal(state, command);
	const builtEvent =
		state.schemaVersion === 1 ? buildLegacyEvent(state, command) : buildV2Event(state, command);
	const eventDraft = attachDirectiveInfluences(state, command, builtEvent);
	const nextState = reduceParsedEvent(state, eventDraft);
	const stateHash = hashParsedGameState(nextState);
	const event = AuthoritativeEventSchema.parse({ ...eventDraft, afterStateHash: stateHash });
	return {
		state: nextState,
		stateHash,
		events: [event],
		scheduled: scheduledEventsFromEvent(event),
		resolvedScheduledEventIds: resolvedScheduledEventIdsFromEvent(event),
		canceledScheduledEventIds: canceledScheduledEventIdsFromEvent(event),
		decisionRequests: [],
		legalActions: legalActionsForParsedState(nextState, command.actorId)
	};
}

function replayCheck(
	event: AuthoritativeEvent,
	computedStateHash: string,
	verified: boolean
): ReplayCheck {
	return {
		sequence: event.sequence,
		gameTime: event.gameTime,
		eventType: event.eventType,
		actorId: event.actorId,
		source: event.source,
		summary: eventSummary(event),
		beforeStateHash: event.beforeStateHash,
		afterStateHash: event.afterStateHash,
		computedStateHash,
		verified,
		entropyDraws: entropyDrawsFromEvent(event),
		deltas: eventDeltas(event)
	};
}

export function replayEvents(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	if (eventInputs.length === 0) throw new ReplayIntegrityError('Replay has no bootstrap event', 0);
	const events = eventInputs.map((event) => AuthoritativeEventSchema.parse(event));
	const first = events[0];
	if (!first || first.sequence !== 1 || first.eventType !== 'run.initialized') {
		throw new ReplayIntegrityError(
			'Replay must begin with run.initialized at sequence 1',
			first?.sequence ?? 0
		);
	}
	const initialized = InitializedPayloadSchema.parse(first.payload);
	let state = initialized.initialState;
	let computedHash = hashParsedGameState(state);
	const checks: ReplayCheck[] = [
		replayCheck(
			first,
			computedHash,
			first.beforeStateHash === EMPTY_STATE_HASH && first.afterStateHash === computedHash
		)
	];
	for (const event of events.slice(1)) {
		const beforeHash = hashParsedGameState(state);
		state = reduceParsedEvent(state, event);
		computedHash = hashParsedGameState(state);
		checks.push(
			replayCheck(
				event,
				computedHash,
				event.beforeStateHash === beforeHash && event.afterStateHash === computedHash
			)
		);
	}
	return {
		snapshot: EngineSnapshotSchema.parse({ state, stateHash: computedHash }),
		checks,
		verified: checks.every((check) => check.verified)
	};
}

export function replayEventsStrict(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	const replay = replayEvents(eventInputs);
	const failed = replay.checks.find((check) => !check.verified);
	if (failed) throw new ReplayIntegrityError('Replay state hash mismatch', failed.sequence);
	return replay;
}
