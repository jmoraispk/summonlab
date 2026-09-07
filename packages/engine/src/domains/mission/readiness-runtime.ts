import {
	MissionRunStateV10Schema,
	ReadinessCombatStateV1Schema,
	CombatLegalActionTemplateSchema,
	type CombatLegalActionTemplate,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type MissionRunStateV9,
	type MissionRunStateV10,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	BASIC_SWORD_STRIKE,
	COMBAT_CONTENT_BINDING,
	COMBAT_SKILL_CONFLICT_POLICIES_V1,
	MONSTER_POLICY_CATALOG
} from '@summonlab/content';

import { IllegalActionError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { verifiedMissionContent } from '../../core/content-bindings.js';

function canonicalTemplates(templates: readonly CombatLegalActionTemplate[]) {
	return CombatLegalActionTemplateSchema.array().parse(
		[...templates].sort((left, right) => left.actionId.localeCompare(right.actionId))
	);
}

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
	state: EngineGameStateV26,
	attempt: NonNullable<EngineGameStateV26['mission']['attempt']>
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
	state: EngineGameStateV26
): EngineGameStateV25 {
	const prior = state.mission.attempt;
	return {
		...state,
		schemaVersion: 25,
		contentVersion: 'engine-v25',
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
	state: EngineGameStateV26,
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

function actionCatalog(enemyIds: readonly string[]): readonly CombatLegalActionTemplate[] {
	if (enemyIds.length === 0) return canonicalTemplates([GUARD_TEMPLATE]);
	const mastery = BASIC_SWORD_STRIKE.masteryProgression[0]!;
	const conflictPolicy = COMBAT_SKILL_CONFLICT_POLICIES_V1[BASIC_SWORD_STRIKE.skillId]!;
	return canonicalTemplates([
		{
			actionId: BASIC_SWORD_STRIKE.skillId,
			actionKind: 'attack',
			skillId: BASIC_SWORD_STRIKE.skillId,
			publicLabel: BASIC_SWORD_STRIKE.displayName,
			targetContract: { kind: 'entity', allowedCombatantIds: [...enemyIds] },
			reactionPriority: 0,
			recoveryTicks: 10,
			manaCost: 0,
			conflictPolicy,
			fallbackOptions: [
				{ fallbackId: 'guard-instead', publicLabel: 'Guard instead', target: { kind: 'self' } }
			],
			resolutionProfile: {
				profileKind: 'attack',
				rulesVersion: 'combat-rules-v1',
				contentHash: COMBAT_CONTENT_BINDING.contentHash,
				deliveryTag: BASIC_SWORD_STRIKE.deliveryTags[0]!,
				masteryStepMinimum: mastery.minimumMastery,
				skillAccuracyBasisPoints: mastery.accuracyBasisPoints,
				damage: {
					channel: 'physical',
					tags: BASIC_SWORD_STRIKE.damageTags,
					baseMagnitude: 5,
					coefficientBasisPoints: 5_000,
					affinityContributionBasisPoints: 0,
					criticalChanceBasisPoints: 500,
					criticalMultiplierBasisPoints: 15_000,
					penetration: 0,
					status: null
				}
			}
		},
		GUARD_TEMPLATE
	]);
}

export function createMissionReadinessState(
	state: EngineGameStateV26,
	attemptId: string,
	heroIds: readonly string[],
	missionId: string
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
	const combatants = {
		...Object.fromEntries(
			partyIds.map((actorId, index) => {
				const hero = state.heroes[actorId];
				const isMaster = actorId === state.master.masterId;
				const health = isMaster ? state.master.health : hero!.health;
				const maximumHealth = isMaster ? state.master.maxHealth : hero!.maxHealth;
				return [
					actorId,
					{
						combatantId: actorId,
						combatantKind: isMaster ? ('master' as const) : ('hero' as const),
						teamId: 'party',
						position: { x: index + 1, y: 0 },
						facing: 'south' as const,
						resources: {
							health: { current: health, maximum: maximumHealth },
							mana: {
								current: isMaster ? 1 : hero!.mana,
								maximum: isMaster ? 1 : hero!.maxMana
							}
						},
						lastDamagedAtTick: null,
						attributes: isMaster
							? { might: 20, vitality: 20, agility: 20, spirit: 20 }
							: hero!.capabilityProfile.attributes,
						armour: 0,
						resistances: {},
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
						attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
						armour: 0,
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
					legalActionTemplates: actionCatalog(enemies)
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
