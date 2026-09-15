import {
	MissionRunStateV10Schema,
	ReadinessCombatStateV1Schema,
	type CombatAttributes,
	type CombatEquipmentProfile,
	type CombatLegalActionTemplate,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EngineGameStateV27,
	type MissionRunStateV9,
	type MissionRunStateV10,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	AGENT_READINESS_RULES_V2,
	COMBAT_CONTENT_BINDING,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	COMBAT_RULES_V1,
	COMBAT_SKILL_CATALOG,
	COMBAT_SKILL_CONFLICT_POLICIES_V1,
	COMBAT_SKILLS_BY_ID,
	MONSTER_READINESS_DUTY_ACTIONS_V1,
	MONSTER_POLICY_CATALOG,
	PROGRESSION_RULES_V1
} from '@summonlab/content';

import { IllegalActionError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { verifiedMissionContent } from '../../core/content-bindings.js';
import {
	effectiveAttribute,
	intrinsicAttributes,
	maximumHealth,
	maximumMana,
	namedResistanceReduction
} from '../../core/capability.js';
import { resistanceGrantReceiptsFromAuthoredSources } from '../../core/resistance-grants.js';
import {
	canonicalCombatLegalActionTemplates,
	legalCombatSkillActions,
	type LegalCombatSkillAction
} from '../../core/combat-legal-actions.js';
import {
	intrinsicAttributes as progressionIntrinsicAttributes,
	maximumHealth as progressionMaximumHealth
} from '../progression/math.js';

type EngineReadinessState = EngineGameStateV26 | EngineGameStateV27;

function initialOutcomeEvidence(
	attemptId: string,
	combatants: ReadinessCombatStateV1['combatants']
) {
	return {
		evidenceVersion: 'readiness-outcome-evidence-v1' as const,
		attemptId,
		partyHeroes: Object.fromEntries(
			Object.values(combatants)
				.filter((combatant) => combatant.combatantKind === 'hero' && combatant.teamId === 'party')
				.sort((left, right) => left.combatantId.localeCompare(right.combatantId))
				.map((combatant) => [
					combatant.combatantId,
					{
						startingHealth: combatant.resources.health.current,
						startingMana: combatant.resources.mana.current,
						currentHealth: combatant.resources.health.current,
						currentMana: combatant.resources.mana.current,
						damageTaken: 0,
						downed: combatant.downed
					}
				])
		),
		resolvedEvents: [],
		emittedEventIds: [],
		eventsEmitted: 0,
		engineRecoveredCombatantIds: [],
		securedLoot: [],
		objectiveStates: [],
		terminalDirective: null,
		authoredDeadline: null
	};
}

function projectedTurnState(
	state: EngineReadinessState,
	attempt: NonNullable<EngineReadinessState['mission']['attempt']>
) {
	if (attempt.combatState.modeId === 'legacy-auto-v1') return attempt.combatState.turnState;
	const objectiveId = verifiedMissionContent(state.mission.binding.missionId).objectives.find(
		(objective) => objective.primary
	)!.objectiveId;
	return {
		turnVersion: 'mission-turn-v2' as const,
		maximumRounds: 48,
		roundNumber: 0,
		objective: {
			objectiveId,
			status: 'available' as const,
			carrierId: null,
			recoveredOnRound: null,
			deliveredOnRound: null
		},
		policyBinding: {
			contentVersion: MONSTER_POLICY_CATALOG.contentVersion,
			contentHash: MONSTER_POLICY_CATALOG.contentHash
		},
		monsters: {},
		partyGuard: Object.fromEntries(
			attempt.party.memberIds.map((actorId) => [
				actorId,
				{
					actorId,
					guard: 3,
					maximumGuard: 3,
					status: 'ready' as const,
					lastChangedOnRound: 0
				}
			])
		),
		arena: {
			furnaceState: 'absent' as const,
			coolingControlNodeId: null,
			coolingControlExposed: false
		},
		currentThreatIntents: [],
		rounds: []
	};
}

/** A compatibility boundary used only by the frozen legacy-v1 resolver. */
export function projectCurrentStateForLegacyResolver(
	state: EngineReadinessState
): EngineGameStateV25 {
	const prior = state.mission.attempt;
	return {
		...state,
		schemaVersion: 25,
		contentVersion: 'engine-v25',
		heroes: Object.fromEntries(
			Object.entries(state.heroes).map(([heroId, hero]) => [
				heroId,
				Object.fromEntries(Object.entries(hero).filter(([key]) => key !== 'combatTraining'))
			])
		),
		mission: {
			...state.mission,
			attempt: prior
				? {
						...Object.fromEntries(Object.entries(prior).filter(([key]) => key !== 'combatState')),
						turnState: projectedTurnState(state, prior)
					}
				: null
		}
	} as unknown as EngineGameStateV25;
}

export function restoreCurrentLegacyMission(
	state: EngineReadinessState,
	mission: MissionRunStateV9
): MissionRunStateV10 {
	const currentAttempt = state.mission.attempt;
	if (!mission.attempt || !currentAttempt) {
		return MissionRunStateV10Schema.parse({ ...mission, attempt: null });
	}
	if (currentAttempt.combatState.modeId !== 'legacy-auto-v1') {
		throw new IllegalActionError('mission.advance.automatic');
	}
	return MissionRunStateV10Schema.parse({
		...mission,
		attempt: {
			...Object.fromEntries(
				Object.entries(mission.attempt).filter(
					([key]) => key !== 'turnState' && key !== 'combatModeBinding'
				)
			),
			combatModeBinding: currentAttempt.combatModeBinding,
			combatState: { modeId: 'legacy-auto-v1', turnState: mission.attempt.turnState }
		}
	});
}

const GUARD_TEMPLATE = {
	actionId: 'guard',
	actionKind: 'guard',
	skillId: null,
	publicLabel: 'Guard',
	targetContract: { kind: 'self' },
	reactionPriority: 0,
	recoveryTicks: 8,
	manaCost: 0,
	conflictPolicy: {
		invalidTarget: 'cancel',
		occupiedDestination: 'cancel',
		cancellationRefund: { mana: 'full', readiness: 'full' }
	},
	fallbackOptions: [{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' } }],
	resolutionProfile: {
		profileKind: 'non-damaging',
		rulesVersion: 'combat-rules-v1',
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	}
} as const satisfies CombatLegalActionTemplate;

function combatSkillTemplate(
	action: LegalCombatSkillAction,
	enemyIds: readonly string[],
	baseMagnitude = 5
): CombatLegalActionTemplate {
	const skill = COMBAT_SKILLS_BY_ID[action.skillId];
	const conflictPolicy =
		COMBAT_SKILL_CONFLICT_POLICIES_V1[
			action.skillId as keyof typeof COMBAT_SKILL_CONFLICT_POLICIES_V1
		];
	if (!skill || !conflictPolicy || action.kind !== 'attack') {
		throw new Error(`No readiness attack profile for ${action.skillId}`);
	}
	const mastery = skill.masteryProgression.findLast(
		(step) => step.accuracyBasisPoints === action.accuracyBasisPoints
	)!;
	const fallbackTargets =
		enemyIds.length > 1 ? [...enemyIds.slice(1), enemyIds[0]!] : [...enemyIds];
	return {
		actionId: action.skillId,
		actionKind: 'attack',
		skillId: action.skillId,
		publicLabel: action.displayName,
		targetContract: { kind: 'entity', allowedCombatantIds: [...enemyIds] },
		reactionPriority: 0,
		recoveryTicks: 10,
		manaCost: 0,
		conflictPolicy,
		fallbackOptions:
			conflictPolicy.invalidTarget === 'selected-fallback'
				? fallbackTargets.map((combatantId, index) => ({
						fallbackId: `retarget-${String(index + 1).padStart(3, '0')}`,
						publicLabel: `Retarget ${combatantId.slice(0, 8)}`,
						target: { kind: 'entity' as const, combatantId }
					}))
				: [],
		resolutionProfile: {
			profileKind: 'attack',
			rulesVersion: 'combat-rules-v1',
			contentHash: COMBAT_CONTENT_BINDING.contentHash,
			deliveryTag: action.deliveryTag,
			masteryStepMinimum: mastery.minimumMastery,
			skillAccuracyBasisPoints: action.accuracyBasisPoints,
			damage: {
				channel: 'physical',
				tags: skill.damageTags,
				baseMagnitude,
				coefficientBasisPoints: 5_000,
				affinityContributionBasisPoints: 0,
				criticalChanceBasisPoints: 500,
				criticalMultiplierBasisPoints: 15_000,
				penetration: 0,
				status: null
			}
		}
	};
}

type HeroReadinessProjection = Readonly<{
	intrinsic: CombatAttributes;
	attributes: CombatAttributes;
	effectiveLoadStrength: number;
	maximumHealth: number;
	maximumMana: number;
	equipment: readonly Readonly<{
		sourceInstanceId: string;
		profile: CombatEquipmentProfile;
	}>[];
	resistances: Readonly<Record<string, number>>;
}>;

function equippedCombatProfiles(
	state: EngineReadinessState,
	heroId: string
): HeroReadinessProjection['equipment'] {
	const hero = state.heroes[heroId]!;
	return Object.values(hero.equipment)
		.filter((itemId): itemId is string => itemId !== null)
		.map((itemId) => {
			const item = state.items[itemId];
			if (!item || item.equippedById !== heroId) {
				throw new Error(`Readiness loadout item ${itemId} is not equipped by ${heroId}`);
			}
			const profile = COMBAT_EQUIPMENT_PROFILES_BY_ID[item.definitionId];
			if (!profile) throw new Error(`No combat equipment profile for ${item.definitionId}`);
			return { sourceInstanceId: itemId, profile };
		});
}

function heroReadinessProjection(
	state: EngineReadinessState,
	heroId: string
): HeroReadinessProjection {
	const intrinsic =
		state.schemaVersion === 27
			? progressionIntrinsicAttributes(
					state.heroes[heroId]!.capabilityProfile,
					state.heroes[heroId]!.progression.permanentGrowth
				)
			: intrinsicAttributes(
					state.heroes[heroId]!.capabilityProfile,
					state.heroes[heroId]!.progression.attributeGrowthReceipts,
					COMBAT_RULES_V1
				);
	const attributes = {
		strength: effectiveAttribute(intrinsic.strength, [], 'physical-damage', COMBAT_RULES_V1),
		agility: effectiveAttribute(intrinsic.agility, [], 'readiness', COMBAT_RULES_V1),
		vitality: effectiveAttribute(intrinsic.vitality, [], 'maximum-health', COMBAT_RULES_V1),
		magic: effectiveAttribute(intrinsic.magic, [], 'magical-damage', COMBAT_RULES_V1)
	};
	const equipment = equippedCombatProfiles(state, heroId);
	const resistanceReceipts = resistanceGrantReceiptsFromAuthoredSources(
		{ equipment, passiveSkills: [], physiology: [] },
		COMBAT_RULES_V1
	);
	const resistanceTags = [...new Set(resistanceReceipts.map((receipt) => receipt.tag))].sort();
	return {
		intrinsic,
		attributes,
		effectiveLoadStrength: effectiveAttribute(
			intrinsic.strength,
			[],
			'equipment-load',
			COMBAT_RULES_V1
		),
		maximumHealth:
			state.schemaVersion === 27
				? progressionMaximumHealth(
						intrinsic.vitality,
						state.heroes[heroId]!.progression.level,
						PROGRESSION_RULES_V1
					)
				: maximumHealth(attributes.vitality, COMBAT_RULES_V1),
		maximumMana: maximumMana(
			effectiveAttribute(intrinsic.magic, [], 'maximum-mana', COMBAT_RULES_V1),
			COMBAT_RULES_V1
		),
		equipment,
		resistances: Object.fromEntries(
			resistanceTags.map((tag) => [
				tag,
				namedResistanceReduction([tag], resistanceReceipts, COMBAT_RULES_V1)
			])
		)
	};
}

function heroActionCatalog(
	state: EngineReadinessState,
	heroId: string,
	enemyIds: readonly string[]
): readonly CombatLegalActionTemplate[] {
	const hero = state.heroes[heroId]!;
	const projection = heroReadinessProjection(state, heroId);
	const skills = legalCombatSkillActions({
		intrinsicStrength: projection.intrinsic.strength,
		effectiveLoadStrength: projection.effectiveLoadStrength,
		proficiencyTags: hero.combatTraining.proficiencyTags,
		equipment: projection.equipment.map(({ profile }) => profile),
		skills: COMBAT_SKILL_CATALOG.skills,
		learnedSkills: hero.combatTraining.learnedSkills
	});
	return canonicalCombatLegalActionTemplates([
		...skills.map((action) => combatSkillTemplate(action, enemyIds)),
		GUARD_TEMPLATE
	]);
}

function monsterActionCatalog(
	policyId: string,
	enemyIds: readonly string[],
	rulesVersion: string
): readonly CombatLegalActionTemplate[] {
	if (rulesVersion === 'agent-readiness-rules-v1') {
		const authored = MONSTER_READINESS_DUTY_ACTIONS_V1[policyId];
		if (!authored) throw new Error(`No readiness duty action for monster policy ${policyId}`);
		return canonicalCombatLegalActionTemplates([
			{
				...GUARD_TEMPLATE,
				actionId: authored.actionId,
				publicLabel: authored.publicLabel,
				recoveryTicks: authored.recoveryTicks,
				fallbackOptions: [
					{
						fallbackId: authored.fallbackId,
						publicLabel: authored.fallbackLabel,
						target: { kind: 'self' }
					}
				]
			}
		]);
	}
	const authored = AGENT_READINESS_RULES_V2.monsterActions[policyId];
	if (!authored) throw new Error(`No readiness duty action for monster policy ${policyId}`);
	const fallbackTargets = enemyIds.length > 1 ? [...enemyIds.slice(1), enemyIds[0]!] : [];
	const conflictPolicy =
		fallbackTargets.length > 0
			? authored.attack.conflictPolicy
			: { ...authored.attack.conflictPolicy, invalidTarget: 'cancel' as const };
	const attack: CombatLegalActionTemplate = {
		...authored.attack,
		actionKind: 'attack',
		targetContract: { kind: 'entity', allowedCombatantIds: [...enemyIds] },
		conflictPolicy,
		fallbackOptions: fallbackTargets.map((combatantId, index) => ({
			fallbackId: `retarget-${String(index + 1).padStart(3, '0')}`,
			publicLabel: `Retarget ${combatantId.slice(0, 8)}`,
			target: { kind: 'entity' as const, combatantId }
		})),
		resolutionProfile: {
			...authored.attack.resolutionProfile,
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		}
	};
	const actions = canonicalCombatLegalActionTemplates([
		attack,
		{
			...GUARD_TEMPLATE,
			actionId: authored.hold.actionId,
			publicLabel: authored.hold.publicLabel,
			recoveryTicks: authored.hold.recoveryTicks,
			fallbackOptions: [
				{
					fallbackId: authored.hold.fallbackId,
					publicLabel: authored.hold.fallbackLabel,
					target: { kind: 'self' }
				}
			]
		}
	]);
	if (actions[0]?.actionId !== authored.preferredActionId) {
		throw new Error(`Monster readiness preference is not canonical for ${policyId}`);
	}
	return actions;
}

export function createMissionReadinessState(
	state: EngineReadinessState,
	attemptId: string,
	heroIds: readonly string[],
	missionId: string,
	rulesVersion: string = AGENT_READINESS_RULES_V2.rulesVersion
) {
	const mission = verifiedMissionContent(missionId);
	const partyIds = [state.master.masterId, ...heroIds];
	const monsterSeeds = mission.monsterDuties
		.filter((duty) => duty.activation.kind === 'on-deployment')
		.flatMap((duty) =>
			Array.from({ length: duty.count.min }, (_, index) => ({ duty, ordinal: index + 1 }))
		);
	const monsterIds = monsterSeeds.map(({ duty, ordinal }) =>
		deterministicUuid(`${attemptId}:${duty.dutySlotId}:${ordinal}:readiness-monster`)
	);
	const monsterPolicyById = new Map(
		monsterIds.map((monsterId, index) => [monsterId, monsterSeeds[index]!.duty.policyId] as const)
	);
	const combatants = {
		...Object.fromEntries(
			partyIds.map((actorId, index) => {
				const hero = state.heroes[actorId];
				const isMaster = actorId === state.master.masterId;
				const projection = isMaster ? null : heroReadinessProjection(state, actorId);
				const health = isMaster ? state.master.health : hero!.health;
				const healthMaximum = isMaster ? state.master.maxHealth : projection!.maximumHealth;
				const manaMaximum = isMaster ? 1 : projection!.maximumMana;
				return [
					actorId,
					{
						combatantId: actorId,
						combatantKind: isMaster ? ('master' as const) : ('hero' as const),
						teamId: 'party',
						position: { x: index + 1, y: 0 },
						facing: 'south' as const,
						resources: {
							health: { current: Math.min(health, healthMaximum), maximum: healthMaximum },
							mana: {
								current: isMaster ? 1 : Math.min(hero!.mana, manaMaximum),
								maximum: manaMaximum
							}
						},
						lastDamagedAtTick: null,
						attributes: isMaster
							? { strength: 20, agility: 20, vitality: 20, magic: 20 }
							: projection!.attributes,
						armor: 0,
						resistances: projection?.resistances ?? {},
						readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
						conditions: [],
						cooldowns: {},
						downed: false,
						active: true
					}
				];
			})
		),
		...Object.fromEntries(
			monsterSeeds.map(({ duty }, index) => {
				const monsterId = monsterIds[index]!;
				const policy = MONSTER_POLICY_CATALOG.policies.find(
					(candidate) => candidate.policyId === duty.policyId
				)!;
				const health = Math.max(10, policy.maximumVitality * 10);
				return [
					monsterId,
					{
						combatantId: monsterId,
						combatantKind: 'monster' as const,
						teamId: 'enemy',
						position: { x: index + 1, y: 2 },
						facing: 'north' as const,
						resources: {
							health: { current: health, maximum: health },
							mana: { current: 1, maximum: 1 }
						},
						lastDamagedAtTick: null,
						attributes: { strength: 20, agility: 20, vitality: 20, magic: 20 },
						armor: 0,
						resistances: {},
						readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
						conditions: [],
						cooldowns: {},
						downed: false,
						active: true
					}
				];
			})
		)
	};
	const positions = Object.values(combatants).map((combatant) => combatant.position);
	const actorContexts = Object.fromEntries(
		Object.values(combatants).map((combatant) => {
			const enemies = Object.values(combatants)
				.filter((candidate) => candidate.teamId !== combatant.teamId)
				.map((candidate) => candidate.combatantId)
				.sort();
			return [
				combatant.combatantId,
				{
					actorId: combatant.combatantId,
					visibleCombatantIds: Object.keys(combatants)
						.filter((actorId) => actorId !== combatant.combatantId)
						.sort(),
					visibleTelegraphIds: [],
					observableReadinessActorIds: [],
					targetablePositions: positions,
					visibleTerrainFeatureIds: [],
					rememberedContext: [],
					doctrine: [],
					relationships: [],
					masterDirections: [],
					legalActionTemplates:
						combatant.combatantKind === 'master'
							? canonicalCombatLegalActionTemplates([GUARD_TEMPLATE])
							: combatant.combatantKind === 'hero'
								? heroActionCatalog(state, combatant.combatantId, enemies)
								: monsterActionCatalog(
										monsterPolicyById.get(combatant.combatantId)!,
										enemies,
										rulesVersion
									)
				}
			];
		})
	);
	return ReadinessCombatStateV1Schema.parse({
		stateVersion: 'readiness-combat-state-v1',
		seed: hashCanonical({ seed: state.seed, attemptId, purpose: 'readiness-combat-v1' }),
		attemptId,
		tick: 0,
		combatants,
		actorContexts,
		terrain: {
			width: Math.max(partyIds.length, monsterIds.length) + 2,
			height: 3,
			blockedTiles: [],
			features: []
		},
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 0, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: initialOutcomeEvidence(attemptId, combatants),
		status: 'active',
		result: null
	});
}
