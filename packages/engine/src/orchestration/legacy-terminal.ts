import type {
	CombatResult,
	EngineGameStateV26,
	ReadinessCombatStateV1
} from '@summonlab/contracts';

import { createCombatMissionClaimProjection } from '../domains/mission/lifecycle.js';
import type { CurrentLegacyAutoV1CombatResolution } from '../domains/mission/mission-mode-runner.js';
import { createCombatProgressionClaimProjection } from '../domains/progression/claims.js';
import { adaptV26LegacyCombatOutcome, transitionCombatResultClaims } from './combat-claims.js';

function finalCombatants(
	state: EngineGameStateV26,
	resolution: CurrentLegacyAutoV1CombatResolution
): ReadinessCombatStateV1['combatants'] {
	const attempt = state.mission.attempt!;
	const party = Object.fromEntries(
		attempt.party.memberIds.map((combatantId, index) => {
			const hero = resolution.heroes[combatantId];
			const isMaster = combatantId === state.master.masterId;
			const health = isMaster ? resolution.master.health : hero!.health;
			const maximumHealth = isMaster ? resolution.master.maxHealth : hero!.maxHealth;
			const mana = isMaster ? 1 : hero!.mana;
			const maximumMana = isMaster ? 1 : hero!.maxMana;
			const downed = health === 0;
			return [
				combatantId,
				{
					combatantId,
					combatantKind: isMaster ? ('master' as const) : ('hero' as const),
					teamId: 'party',
					position: { x: index, y: 0 },
					facing: 'south' as const,
					resources: {
						health: { current: health, maximum: maximumHealth },
						mana: { current: mana, maximum: maximumMana }
					},
					lastDamagedAtTick: downed ? resolution.round.roundNumber : null,
					attributes: isMaster
						? { strength: 20, agility: 20, vitality: 20, magic: 20 }
						: hero!.capabilityProfile.attributes,
					armour: 0,
					resistances: {},
					readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
					conditions: [],
					cooldowns: {},
					downed,
					active: !downed
				}
			];
		})
	);
	const resolvedAttempt = resolution.mission.attempt;
	const turnState =
		resolvedAttempt?.combatState.modeId === 'legacy-auto-v1'
			? resolvedAttempt.combatState.turnState
			: attempt.combatState.modeId === 'legacy-auto-v1'
				? attempt.combatState.turnState
				: null;
	const monsters = Object.fromEntries(
		Object.values(turnState?.monsters ?? {})
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
			.map((monster, index) => {
				const downed = monster.status === 'defeated' || monster.vitality === 0;
				return [
					monster.monsterId,
					{
						combatantId: monster.monsterId,
						combatantKind: 'monster' as const,
						teamId: 'enemy',
						position: { x: attempt.party.memberIds.length + index, y: 1 },
						facing: 'north' as const,
						resources: {
							health: { current: monster.vitality, maximum: monster.maximumVitality },
							mana: { current: 1, maximum: 1 }
						},
						lastDamagedAtTick:
							monster.vitality < monster.maximumVitality ? resolution.round.roundNumber : null,
						attributes: { strength: 20, agility: 20, vitality: 20, magic: 20 },
						armour: 0,
						resistances: {},
						readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
						conditions: [],
						cooldowns: {},
						downed,
						active: !downed
					}
				];
			})
	);
	return { ...party, ...monsters };
}

function terminalOutcome(
	state: EngineGameStateV26,
	resolution: CurrentLegacyAutoV1CombatResolution
): Exclude<CombatResult['outcome'], 'safety-stop'> | null {
	const attempt = resolution.mission.attempt;
	if (!attempt || ['deployed', 'resolving'].includes(attempt.status)) return null;
	if (
		resolution.master.lifeState === 'dead' ||
		state.mission.attempt!.party.heroIds.some(
			(heroId) => resolution.heroes[heroId]?.lifeState === 'dead'
		) ||
		resolution.consequences.some((consequence) => consequence.fatal)
	) {
		return 'death';
	}
	if (attempt.status === 'extraction') return 'victory';
	return 'deadline';
}

/** Authenticates a terminal frozen legacy round without changing its resolver-owned side effects. */
export function finalizeV26LegacyRound(
	state: EngineGameStateV26,
	resolution: CurrentLegacyAutoV1CombatResolution
) {
	const attempt = state.mission.attempt;
	if (!attempt || attempt.combatState.modeId !== 'legacy-auto-v1') {
		throw new Error('V26 legacy finalization requires an active legacy attempt');
	}
	const outcome = terminalOutcome(state, resolution);
	if (outcome === null) return { terminalResult: null, claimCheckpoint: null } as const;
	const combatants = finalCombatants(state, resolution);
	const damageByHeroId = Object.fromEntries(
		attempt.party.heroIds.map((heroId) => [
			heroId,
			resolution.consequences
				.filter(
					(consequence) => 'targetHeroId' in consequence && consequence.targetHeroId === heroId
				)
				.reduce((total, consequence) => total + consequence.damage, 0)
		])
	);
	const authority = {
		attemptId: attempt.attemptId,
		combatModeBinding: {
			modeId: attempt.combatModeBinding.modeId,
			rulesVersion: attempt.combatModeBinding.rulesVersion,
			contentHash: attempt.combatModeBinding.contentHash
		},
		endedAtTick: resolution.round.roundNumber,
		termination: { kind: outcome },
		partyHeroIds: attempt.party.heroIds,
		engineDamageTakenByHeroId: damageByHeroId,
		finalCombatants: combatants,
		resolvedEvents: [],
		engineRecoveredCombatantIds: [],
		securedLoot: [],
		objectiveStates: (
			resolution.mission.attempt?.completedObjectiveIds ?? attempt.completedObjectiveIds
		).map((objectiveId) => ({
			objectiveId,
			completed: true
		})),
		decisiveEventIds: resolution.consequences
			.filter((consequence) => consequence.fatal)
			.map((consequence) => consequence.consequenceId)
	};
	const terminalResult = adaptV26LegacyCombatOutcome({
		...authority,
		combatModeBinding: attempt.combatModeBinding
	});
	const transition = transitionCombatResultClaims(
		{
			mission: createCombatMissionClaimProjection(
				Object.fromEntries(
					attempt.party.heroIds.map((heroId) => {
						const hero = state.heroes[heroId]!;
						return [
							heroId,
							{
								health: hero.health,
								mana: hero.mana,
								maximumHealth: hero.maxHealth,
								maximumMana: hero.maxMana,
								downed: hero.health === 0,
								lost: hero.lifeState !== 'active',
								injuryIds: hero.injuries.map((injury) => injury.injuryId)
							}
						];
					})
				)
			),
			progression: createCombatProgressionClaimProjection()
		},
		terminalResult,
		authority,
		attempt.combatModeBinding
	);
	for (const heroId of attempt.party.heroIds) {
		const projected = transition.mission.combatants[heroId]!;
		const resolved = resolution.heroes[heroId]!;
		if (
			projected.health !== resolved.health ||
			projected.mana !== resolved.mana ||
			projected.lost !== (resolved.lifeState !== 'active')
		) {
			throw new Error(`Legacy common claims diverged from frozen side effects for ${heroId}`);
		}
	}
	return { terminalResult, claimCheckpoint: transition.checkpoint } as const;
}
