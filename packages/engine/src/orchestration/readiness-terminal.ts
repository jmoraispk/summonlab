import {
	EngineGameStateV26Schema,
	ResourceKeySchema,
	type CombatResult,
	type EngineGameStateV26,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';

import { deterministicUuid } from '../hash.js';
import { advanceUntilReadyCohort } from '../domains/combat/readiness.js';
import {
	createCombatMissionClaimProjection,
	missionAttemptTransitionForCombatResult
} from '../domains/mission/lifecycle.js';
import { createCombatProgressionClaimProjection } from '../domains/progression/claims.js';
import { transitionCombatResultClaims } from './combat-claims.js';

const BASIC_SWORD_SKILL_ID = 'combat-skill-basic-sword-strike';

export function advanceReadinessToTerminal(state: EngineGameStateV26) {
	const attempt = state.mission.attempt;
	if (!attempt || attempt.combatState.modeId !== 'agent-readiness-v1') return null;
	const advanced = advanceUntilReadyCohort(attempt.combatState.readinessState, COMBAT_RULES_V1);
	return advanced.kind === 'combat-result' ? advanced : null;
}

function authorityFor(result: CombatResult) {
	return {
		attemptId: result.attemptId,
		modeId: result.modeId,
		rulesVersion: result.rulesVersion,
		endedAtTick: result.endedAtTick,
		termination:
			result.outcome === 'safety-stop'
				? ({ kind: 'safety-stop', safetyStop: result.safetyStop! } as const)
				: ({ kind: result.outcome } as const),
		partyHeroIds: result.claimEvidence.partyHeroIds,
		engineDamageTakenByHeroId: result.claimEvidence.engineDamageTakenByHeroId,
		finalCombatants: result.finalCombatants,
		resolvedEvents: result.claimEvidence.resolvedEvents,
		engineRecoveredCombatantIds: result.claimEvidence.engineRecoveredCombatantIds,
		securedLoot: result.claimEvidence.securedLoot,
		objectiveStates: result.claimEvidence.objectiveStates,
		decisiveEventIds: result.decisiveEventIds
	};
}

function terminalAttemptPatch(
	state: EngineGameStateV26,
	result: CombatResult,
	completedObjectiveIds: readonly string[]
) {
	if (result.finalCombatants[state.master.masterId]?.downed) {
		return {
			status: 'death' as const,
			outcome: 'death' as const,
			endedAt: state.simulatedAt,
			extractionOpenedAt: null,
			completedObjectiveIds: [...completedObjectiveIds]
		};
	}
	const transition = missionAttemptTransitionForCombatResult(result);
	if (result.outcome === 'victory') {
		return {
			status: 'extraction' as const,
			outcome: null,
			endedAt: null,
			extractionOpenedAt: state.simulatedAt,
			completedObjectiveIds: [...completedObjectiveIds]
		};
	}
	if (result.outcome === 'safety-stop') {
		return {
			status: 'retreat' as const,
			outcome: 'retreat' as const,
			endedAt: state.simulatedAt,
			extractionOpenedAt: null,
			completedObjectiveIds: [...completedObjectiveIds]
		};
	}
	return {
		status: transition.status,
		outcome: transition.outcome,
		endedAt: state.simulatedAt,
		extractionOpenedAt:
			transition.status === 'success'
				? (state.mission.attempt?.extractionOpenedAt ?? state.simulatedAt)
				: null,
		completedObjectiveIds: [...completedObjectiveIds]
	};
}

/** Applies the authenticated combat claim set and outer lifecycle in one V26 snapshot transition. */
export function finalizeReadinessMission(
	state: EngineGameStateV26,
	terminalState: ReadinessCombatStateV1,
	eventId: string
): {
	readonly state: EngineGameStateV26;
	readonly claimCheckpoint: ReturnType<typeof transitionCombatResultClaims>['checkpoint'];
} {
	const attempt = state.mission.attempt;
	const result = terminalState.result;
	if (!attempt || attempt.combatState.modeId !== 'agent-readiness-v1' || !result) {
		throw new Error('Readiness terminal finalization requires a completed active attempt');
	}
	const claimTransition = transitionCombatResultClaims(
		{
			mission: createCombatMissionClaimProjection(
				Object.fromEntries(
					result.claimEvidence.partyHeroIds.map((heroId) => {
						const hero = state.heroes[heroId];
						if (!hero) throw new Error(`Combat result references unknown hero ${heroId}`);
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
			progression: {
				...createCombatProgressionClaimProjection(),
				practiceEvidence: Object.fromEntries(
					result.claimEvidence.partyHeroIds.map((heroId) => [
						heroId,
						{
							[BASIC_SWORD_SKILL_ID]:
								state.heroes[heroId]!.progression.skills.swordFighting.experience
						}
					])
				)
			}
		},
		result,
		authorityFor(result)
	);

	const heroes = { ...state.heroes };
	for (const heroId of result.claimEvidence.partyHeroIds) {
		const hero = heroes[heroId]!;
		const projected = claimTransition.mission.combatants[heroId]!;
		const practice = claimTransition.progression.practiceEvidence[heroId]?.[BASIC_SWORD_SKILL_ID];
		heroes[heroId] = {
			...hero,
			lifeState: projected.lost ? 'dead' : 'active',
			health: projected.health,
			mana: projected.mana,
			currentActivity: projected.lost ? null : hero.currentActivity,
			currentTravel: projected.lost ? null : hero.currentTravel,
			currentRoutine: projected.lost ? null : hero.currentRoutine,
			currentForging: projected.lost ? null : hero.currentForging,
			assignment: projected.lost ? null : hero.assignment,
			progression:
				practice === undefined
					? hero.progression
					: {
							...hero.progression,
							skills: {
								...hero.progression.skills,
								swordFighting: {
									...hero.progression.skills.swordFighting,
									experience: practice
								}
							}
						}
		};
	}

	const resources = { ...state.settlement.resources };
	const resourceLedger = [...state.settlement.resourceLedger];
	let ledgerIndex = 0;
	for (const lootById of Object.values(claimTransition.mission.loot)) {
		for (const [lootId, quantity] of Object.entries(lootById)) {
			const resource = ResourceKeySchema.safeParse(lootId);
			if (!resource.success) continue;
			const before = resources[resource.data];
			const after = before + quantity;
			if (!Number.isSafeInteger(after)) throw new Error('Combat loot resource overflowed');
			resources[resource.data] = after;
			resourceLedger.push({
				entryId: deterministicUuid(`${eventId}:readiness-loot:${ledgerIndex++}`),
				eventId,
				resource: resource.data,
				before,
				after,
				delta: quantity,
				reason: `Combat loot from ${attempt.attemptId}`
			});
		}
	}
	const completedObjectiveIds = [
		...new Set([
			...attempt.completedObjectiveIds,
			...Object.entries(claimTransition.mission.objectives)
				.filter(([, completed]) => completed)
				.map(([objectiveId]) => objectiveId)
		])
	].sort();
	const finalMaster = result.finalCombatants[state.master.masterId];
	const master = finalMaster
		? {
				...state.master,
				lifeState: finalMaster.downed ? ('dead' as const) : state.master.lifeState,
				health: finalMaster.resources.health.current
			}
		: state.master;

	return {
		claimCheckpoint: claimTransition.checkpoint,
		state: EngineGameStateV26Schema.parse({
			...state,
			status: master.lifeState === 'dead' ? 'game_over' : state.status,
			master,
			heroes,
			settlement: { ...state.settlement, resources, resourceLedger },
			mission: {
				...state.mission,
				attempt: {
					...attempt,
					...terminalAttemptPatch(state, result, completedObjectiveIds),
					combatState: { modeId: 'agent-readiness-v1', readinessState: terminalState }
				}
			}
		})
	};
}
