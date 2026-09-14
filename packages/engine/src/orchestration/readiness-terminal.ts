import {
	EngineGameStateV26Schema,
	EngineGameStateV27Schema,
	ResourceKeySchema,
	type CombatResult,
	type EngineGameStateV26,
	type EngineGameStateV27,
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
import type { EmitCombatOutcomeInput } from '../domains/combat/outcome.js';

const BASIC_SWORD_SKILL_ID = 'combat-skill-basic-sword-strike';

type EngineReadinessState = EngineGameStateV26 | EngineGameStateV27;

export function advanceReadinessToTerminal(state: EngineReadinessState) {
	const attempt = state.mission.attempt;
	if (!attempt || attempt.combatState.modeId !== 'agent-readiness-v1') return null;
	const advanced = advanceUntilReadyCohort(
		attempt.combatState.readinessState,
		COMBAT_RULES_V1,
		attempt.combatModeBinding
	);
	return advanced.kind === 'combat-result' ? advanced : null;
}

function terminalAttemptPatch(
	state: EngineReadinessState,
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

/** Applies the authenticated combat claim set and outer lifecycle in one snapshot transition. */
export function finalizeReadinessMission(
	state: EngineReadinessState,
	terminalState: ReadinessCombatStateV1,
	eventId: string,
	authority: EmitCombatOutcomeInput
): {
	readonly state: EngineReadinessState;
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
						Object.fromEntries(
							state.heroes[heroId]!.combatTraining.learnedSkills.map((skill) => [
								skill.skillId,
								skill.mastery
							])
						)
					])
				)
			}
		},
		result,
		authority,
		attempt.combatModeBinding
	);

	const heroes: Record<string, EngineReadinessState['heroes'][string]> = { ...state.heroes };
	for (const heroId of result.claimEvidence.partyHeroIds) {
		const hero = heroes[heroId]!;
		const projected = claimTransition.mission.combatants[heroId]!;
		const practiceBySkill = claimTransition.progression.practiceEvidence[heroId] ?? {};
		const basicSwordPractice = result.claims.find(
			(claim) =>
				claim.claimType === 'skill-practice' &&
				claim.heroId === heroId &&
				claim.skillId === BASIC_SWORD_SKILL_ID
		);
		const basicSwordPracticeAmount =
			basicSwordPractice?.claimType === 'skill-practice'
				? basicSwordPractice.practiceEvidence
				: null;
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
			combatTraining: {
				...hero.combatTraining,
				learnedSkills: hero.combatTraining.learnedSkills.map((skill) => ({
					...skill,
					mastery: Math.min(100, practiceBySkill[skill.skillId] ?? skill.mastery)
				}))
			},
			progression:
				basicSwordPracticeAmount === null
					? hero.progression
					: {
							...hero.progression,
							skills: {
								...hero.progression.skills,
								swordFighting: {
									...hero.progression.skills.swordFighting,
									experience:
										hero.progression.skills.swordFighting.experience + basicSwordPracticeAmount
								}
							}
						}
		} as EngineReadinessState['heroes'][string];
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
		state: (state.schemaVersion === 27 ? EngineGameStateV27Schema : EngineGameStateV26Schema).parse(
			{
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
			}
		)
	};
}
