import {
	AuthoritativeEventSchema,
	CharacterCapabilityProfileV1Schema,
	CharacterDraftSchema,
	CharacterDraftV2Schema,
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
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	EngineGameStateV26Schema,
	EngineGameStateV27Schema,
	EngineSnapshotSchema,
	EquipmentMaterialIdSchema,
	ResourceKeySchema,
	type CharacterCapabilityProfileV1,
	type CharacterDraft,
	type CharacterDraftV2,
	type CharacterMind,
	type CharacterMindV2,
	type LearningDomain,
	type RewardDelta
} from '@summonlab/contracts';
import {
	BASIC_SWORD_STRIKE,
	COMBAT_RULES_V1,
	IRON_MOON_PACKAGE,
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING,
	TOWER_FLOOR_01_PACKAGE
} from '@summonlab/content';

import { verifiedMissionBinding, verifiedSettlementContent } from '../core/content-bindings.js';
import { emptyMetadata, systemSource } from '../core/event-metadata.js';
import { hashParsedGameState } from '../core/state.js';
import type { BootstrapEngineInput, BootstrapEngineResult } from '../core/types.js';
import {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	CAPABILITY_ENGINE_CONTENT_VERSION,
	READINESS_COMBAT_ENGINE_CONTENT_VERSION,
	PROGRESSION_ENGINE_CONTENT_VERSION,
	DEFAULT_ACTIVE_SYSTEM_IDS,
	ENGINE_CONTENT_VERSION,
	EQUIPMENT_ENGINE_CONTENT_VERSION,
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
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from '../hash.js';
import { adaptLegacyEquipmentItem } from '../domains/settlement/equipment.js';
import { maximumHealth as legacyMaximumHealth, maximumMana } from '../domains/combat/capability.js';
import { maximumHealth as progressionMaximumHealth } from '../domains/progression/math.js';

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

const CHARACTER_DRAFT_SCHEMA = CharacterDraftSchema.or(CharacterDraftV2Schema);
const LEGACY_LEARNING_HASH_PURPOSES = {
	cognitiveLearningScore: 'legacy-learning.cognitive-v1',
	domainAptitudes: {
		martial: 'legacy-learning.domain.martial-v1',
		magical: 'legacy-learning.domain.magical-v1',
		crafting: 'legacy-learning.domain.crafting-v1',
		survival: 'legacy-learning.domain.survival-v1',
		social: 'legacy-learning.domain.social-v1'
	}
} as const satisfies {
	readonly cognitiveLearningScore: string;
	readonly domainAptitudes: Readonly<Record<LearningDomain, string>>;
};

function legacyLearningScore(mind: CharacterMind, purpose: string): number {
	const learningMind = legacyMindWithoutAptitudes(mind);
	const hash = hashCanonical({ mind: learningMind, purpose });
	return Number(BigInt(`0x${hash.slice(0, 16)}`) % 101n);
}

function legacyMindWithoutAptitudes(mind: CharacterMind): CharacterMindV2 {
	return {
		personality: mind.personality,
		primaryValue: mind.primaryValue,
		primaryDrive: mind.primaryDrive,
		socialStyle: mind.socialStyle,
		stressResponse: mind.stressResponse,
		dailyHabit: mind.dailyHabit
	};
}

function deterministicLegacyLearningProfile(mind: CharacterMind) {
	return {
		cognitiveLearningScore: legacyLearningScore(
			mind,
			LEGACY_LEARNING_HASH_PURPOSES.cognitiveLearningScore
		),
		domainAptitudes: Object.fromEntries(
			Object.entries(LEGACY_LEARNING_HASH_PURPOSES.domainAptitudes).map(([domain, purpose]) => [
				domain,
				legacyLearningScore(mind, purpose)
			])
		) as Record<LearningDomain, number>
	};
}

// Bootstrap compatibility boundary only: never use this to rewrite event history or persisted rows.
export function capabilityProfileFromLegacyMind(
	mindInput: CharacterMind
): CharacterCapabilityProfileV1 {
	const mind = CharacterMindSchema.parse(mindInput);
	return CharacterCapabilityProfileV1Schema.parse({
		profileVersion: 'character-capability-v1',
		attributes: {
			strength: mind.aptitudes.might * 10,
			agility: mind.aptitudes.finesse * 10,
			vitality: mind.aptitudes.resolve * 10,
			magic: mind.aptitudes.insight * 10
		},
		learning: deterministicLegacyLearningProfile(mind)
	});
}

interface BootstrapHero {
	readonly heroId: string;
	readonly manifestHash: string;
	readonly rarityStars?: number;
	readonly mind: CharacterMind | CharacterMindV2;
	readonly capabilityProfile?: CharacterCapabilityProfileV1;
}

type BootstrapHeroInput =
	| { readonly draft: CharacterDraft | CharacterDraftV2 }
	| {
			readonly heroId: string;
			readonly manifestHash: string;
			readonly rarityStars?: number;
			readonly mind?: CharacterMind;
	  };

function normalizeBootstrapHero(
	input: BootstrapHeroInput,
	capabilityEngineState: boolean
): BootstrapHero {
	if ('draft' in input) {
		const draft = CHARACTER_DRAFT_SCHEMA.parse(input.draft);
		if ('capabilityProfile' in draft) {
			if (!capabilityEngineState) {
				throw new Error('V2 drafts require the capability engine bootstrap');
			}
			return {
				heroId: draft.manifest.characterId,
				manifestHash: draft.manifestHash,
				rarityStars: draft.manifest.rarityStars,
				mind: draft.mind,
				capabilityProfile: draft.capabilityProfile
			};
		}
		if (capabilityEngineState) {
			return {
				heroId: draft.manifest.characterId,
				manifestHash: draft.manifestHash,
				rarityStars: draft.manifest.rarityStars,
				mind: legacyMindWithoutAptitudes(draft.mind),
				capabilityProfile: capabilityProfileFromLegacyMind(draft.mind)
			};
		}
		return {
			heroId: draft.manifest.characterId,
			manifestHash: draft.manifestHash,
			rarityStars: draft.manifest.rarityStars,
			mind: draft.mind
		};
	}
	const legacyMind = CharacterMindSchema.parse(input.mind ?? DEFAULT_CHARACTER_MIND);
	if (capabilityEngineState) {
		return {
			...input,
			mind: legacyMindWithoutAptitudes(legacyMind),
			capabilityProfile: capabilityProfileFromLegacyMind(legacyMind)
		};
	}
	return { ...input, mind: legacyMind };
}

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
	const equipmentDevelopmentScenario = input.developmentEquipmentScenario?.enabled === true;
	const capabilityEngineState =
		'draft' in input && !developmentMissionScenario && !equipmentDevelopmentScenario;
	if (input.developmentEngineVersion !== undefined && !capabilityEngineState) {
		throw new Error('Development engine version requires a capability bootstrap');
	}
	const capabilitySchemaVersion = capabilityEngineState
		? (input.developmentEngineVersion ?? 27)
		: null;
	const forgeReady = input.developmentEquipmentScenario?.forgeReady === true;
	if (input.additionalHeroes && developmentMissionScenario?.additionalHeroes) {
		throw new Error('Additional heroes must use one bootstrap boundary');
	}
	const primaryHeroInput: BootstrapHeroInput =
		input.draft !== undefined
			? { draft: input.draft }
			: {
					heroId: input.heroId,
					manifestHash: input.manifestHash,
					...(input.rarityStars === undefined ? {} : { rarityStars: input.rarityStars }),
					...(input.mind === undefined ? {} : { mind: input.mind })
				};
	const bootstrapHeroInputs: readonly BootstrapHeroInput[] = [
		primaryHeroInput,
		...(input.additionalHeroes ?? developmentMissionScenario?.additionalHeroes ?? [])
	];
	const normalizedBootstrapHeroes = bootstrapHeroInputs.map((hero) =>
		normalizeBootstrapHero(hero, capabilityEngineState)
	);
	if (
		normalizedBootstrapHeroes.length > 4 ||
		new Set(normalizedBootstrapHeroes.map((hero) => hero.heroId)).size !==
			normalizedBootstrapHeroes.length
	) {
		throw new Error('A development bootstrap supports one to four unique summoned heroes');
	}
	const bootstrapHeroes = normalizedBootstrapHeroes.map((hero) => {
		return {
			...hero,
			bladeId: deterministicUuid(`${input.runId}:${hero.heroId}:practice-blade`),
			bowId: deterministicUuid(`${input.runId}:${hero.heroId}:short-bow`)
		};
	});
	const forgeReadyHeroId = forgeReady ? bootstrapHeroes[0]!.heroId : null;
	const workshop = buildingStates.workshop;
	if (forgeReady && (!workshop || workshop.systemId !== 'forge-system')) {
		throw new Error('The Equipment fixture requires the authored workshop forge system');
	}
	const settlementBuildingStates =
		forgeReady && workshop
			? {
					...buildingStates,
					workshop: { ...workshop, assignedHeroIds: [forgeReadyHeroId!] }
				}
			: buildingStates;
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
		developmentMissionScenario?.enableFirstBandArchive === true || equipmentDevelopmentScenario;
	const equipmentState = equipmentDevelopmentScenario || capabilityEngineState;
	const firstBandArchiveState = firstBandArchiveDevelopmentScenario || capabilityEngineState;
	const initialMaterialLots = Object.fromEntries(
		EquipmentMaterialIdSchema.options.map((materialId) => [
			materialId,
			input.developmentEquipmentScenario?.materialLots?.[materialId] ?? 0
		])
	);
	const stateSchema =
		capabilitySchemaVersion === 27
			? EngineGameStateV27Schema
			: capabilitySchemaVersion === 26
				? EngineGameStateV26Schema
				: capabilitySchemaVersion === 25
					? EngineGameStateV25Schema
					: firstBandArchiveDevelopmentScenario
						? equipmentDevelopmentScenario
							? EngineGameStateV24Schema
							: EngineGameStateV23Schema
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
		schemaVersion: capabilitySchemaVersion
			? capabilitySchemaVersion
			: equipmentDevelopmentScenario
				? 24
				: firstBandArchiveDevelopmentScenario
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
		contentVersion:
			capabilitySchemaVersion === 27
				? PROGRESSION_ENGINE_CONTENT_VERSION
				: capabilitySchemaVersion === 26
					? READINESS_COMBAT_ENGINE_CONTENT_VERSION
					: capabilitySchemaVersion === 25
						? CAPABILITY_ENGINE_CONTENT_VERSION
						: equipmentDevelopmentScenario
							? EQUIPMENT_ENGINE_CONTENT_VERSION
							: firstBandArchiveDevelopmentScenario
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
			bootstrapHeroes.map((hero) => {
				const capabilityProfile = capabilityEngineState ? hero.capabilityProfile : undefined;
				if (capabilityEngineState && !capabilityProfile) {
					throw new Error('Capability engine heroes require a capability profile');
				}
				const maxHealth = capabilityProfile
					? capabilitySchemaVersion === 27
						? progressionMaximumHealth(
								capabilityProfile.attributes.vitality,
								1,
								PROGRESSION_RULES_V1
							)
						: legacyMaximumHealth(capabilityProfile.attributes.vitality, COMBAT_RULES_V1)
					: 100;
				const maxMana = capabilityProfile
					? maximumMana(capabilityProfile.attributes.magic, COMBAT_RULES_V1)
					: null;
				return [
					hero.heroId,
					{
						heroId: hero.heroId,
						lifeState: 'active',
						location: forgeReadyHeroId === hero.heroId ? 'workshop' : 'summoning-gate',
						locationNodeId:
							forgeReadyHeroId === hero.heroId ? 'workshop-forge' : settlementContent.spawnNodeId,
						firstArrivalCompleted: forgeReadyHeroId === hero.heroId,
						destination: null,
						health: maxHealth,
						maxHealth,
						...(maxMana === null ? {} : { mana: maxMana, maxMana }),
						manifestHash: hero.manifestHash,
						needs: { hunger: 20, fatigue: 15 },
						injuries: [],
						progression:
							capabilitySchemaVersion === 27
								? {
										progressionVersion: 'hero-progression-v2',
										stars: hero.rarityStars ?? 1,
										level: 1,
										experience: 0,
										unallocatedAttributePoints: 0,
										permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
										evidenceCounts: { combat: {}, crafting: {} },
										skills: { swordFighting: { rank: 0, experience: 0 } }
									}
								: capabilityEngineState
									? {
											stars: hero.rarityStars ?? 1,
											level: 1,
											experience: 0,
											unspentAttributePoints: 0,
											attributeGrowthReceipts: [],
											skills: { swordFighting: { rank: 0, experience: 0 } }
										}
									: {
											stars: hero.rarityStars ?? 1,
											level: 1,
											experience: 0,
											skills: { swordFighting: { rank: 0, experience: 0 } }
										},
						...(capabilitySchemaVersion === 26 || capabilitySchemaVersion === 27
							? {
									combatTraining: {
										schemaVersion: 'hero-combat-training-v1',
										proficiencyTags: [],
										learnedSkills: [
											{
												schemaVersion: 'learned-combat-skill-v1',
												skillId: BASIC_SWORD_STRIKE.skillId,
												mastery: 0,
												trainedDeliveryTags: ['one-handed-blade']
											}
										]
									}
								}
							: {}),
						equipment: equipmentState
							? {
									mainHand: hero.bladeId,
									offHand: null,
									head: null,
									torso: null,
									legs: null,
									boots: null
								}
							: { mainHand: hero.bladeId },
						currentActivity: null,
						currentTravel: null,
						assignment:
							forgeReadyHeroId === hero.heroId
								? {
										buildingId: 'workshop',
										nodeId: 'workshop-bench',
										role: 'artisan',
										assignedAt: simulatedAt
									}
								: null,
						mind: hero.mind,
						...(capabilityEngineState ? { capabilityProfile: hero.capabilityProfile } : {}),
						habit: {
							habit: hero.mind.dailyHabit,
							strength: clamp(Math.round(35 + hero.mind.personality.conscientiousness * 0.55)),
							repetitions: 0,
							satisfaction: 50,
							lastTriggeredAt: null
						},
						dailyPlan: null,
						currentRoutine: null,
						...(equipmentState ? { currentForging: null } : {})
					}
				];
			})
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
			buildings: settlementBuildingStates,
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
			},
			...(equipmentState
				? {
						materialLots: initialMaterialLots,
						forgeSystemPower: forgeReady ? 'powered' : 'dormant'
					}
				: {})
		},
		items: Object.assign(
			{},
			...bootstrapHeroes.map((hero) => ({
				[hero.bladeId]: equipmentState
					? adaptLegacyEquipmentItem({
							itemId: hero.bladeId,
							templateId: 'practice-blade',
							ownerId: hero.heroId,
							equippedById: hero.heroId,
							durability: 6,
							maxDurability: 6
						})
					: {
							itemId: hero.bladeId,
							templateId: 'practice-blade',
							displayName: 'Gatehouse Practice Blade',
							ownerId: hero.heroId,
							slot: 'main-hand',
							equippedById: hero.heroId,
							durability: 6,
							maxDurability: 6
						},
				[hero.bowId]: equipmentState
					? adaptLegacyEquipmentItem({
							itemId: hero.bowId,
							templateId: 'short-bow',
							ownerId: hero.heroId,
							equippedById: null,
							durability: 4,
							maxDurability: 4
						})
					: {
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
			synthesisDevelopmentScenario || firstBandArchiveState
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
			...(developmentMissionScenario || equipmentState
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
			...(firstBandArchiveState ||
			synthesisDevelopmentScenario ||
			storyPatchDevelopmentScenario ||
			masterFallbackDevelopmentScenario ||
			masterTimingDevelopmentScenario ||
			attemptAftermathDevelopmentScenario
				? {
						aftermath: {
							aftermathVersion: capabilityEngineState
								? 'mission-aftermath-v4'
								: 'mission-aftermath-v3',
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
		...(firstBandArchiveState ||
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
		...(firstBandArchiveState || synthesisDevelopmentScenario || storyPatchDevelopmentScenario
			? {
					bandStory: firstBandArchiveState
						? createFirstBandArchiveStoryCheckpoint()
						: createStoryPatchCheckpoint()
				}
			: {}),
		...(synthesisDevelopmentScenario || firstBandArchiveState
			? { synthesis: { contentVersion: 'synthesis-v1', receipts: {}, rumors: {} } }
			: {}),
		...(firstBandArchiveState ? { firstBandArchive: createSealedFirstBandArchive() } : {}),
		...(capabilitySchemaVersion === 27 ? { progressionRules: PROGRESSION_RULES_V1_BINDING } : {})
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
