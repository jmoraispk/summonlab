import {
	CombatContributionEvidenceV1Schema,
	ExperienceReceiptSchema,
	HeroProgressionV2Schema,
	type EngineGameStateV27,
	type CombatContributionEvidenceV1,
	type ExperienceClaim
} from '@summonlab/contracts';
import {
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING,
	type ProgressionRulesV1
} from '@summonlab/content';
import { z } from 'zod';

import { deterministicUuid } from '../../hash.js';
import { applyExperienceClaim, reconcileHealthAfterProgression } from './experience.js';
import { intrinsicAttributes, maximumHealth } from './math.js';
import { combatExperience } from './math.js';

export function experienceClaimsForCombatResult(
	evidenceInputs: readonly CombatContributionEvidenceV1[],
	rules: ProgressionRulesV1
): readonly ExperienceClaim[] {
	return evidenceInputs
		.map((evidence) => CombatContributionEvidenceV1Schema.parse(evidence))
		.filter(
			(evidence) => evidence.appliedEffectIds.length > 0 || evidence.objectiveEvidenceIds.length > 0
		)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((evidence) => ({
			claimId: deterministicUuid(
				`${evidence.terminalEventId}:${evidence.attemptId}:${evidence.heroId}:combat-xp`
			),
			heroId: evidence.heroId,
			sourceEventId: evidence.terminalEventId,
			evidenceKey: evidence.encounterKey,
			amount: combatExperience(
				{
					difficultyBand: evidence.difficultyBand,
					objectiveCompleted: evidence.objectiveEvidenceIds.length > 0,
					firstClear: evidence.firstClear,
					priorCompletions: evidence.priorCompletions
				},
				rules
			),
			sourceKind: 'combat' as const
		}));
}

export const CombatExperienceOutcomeV1Schema = z
	.object({
		evidence: CombatContributionEvidenceV1Schema,
		receipt: ExperienceReceiptSchema,
		progressionAfter: HeroProgressionV2Schema,
		maxHealthAfter: z.number().int().positive(),
		healthAfter: z.number().int().nonnegative()
	})
	.strict();

export type CombatExperienceOutcomeV1 = z.infer<typeof CombatExperienceOutcomeV1Schema>;

function missionDifficultyBand(missionId: string): number {
	const floor = /(?:^|-)floor-(\d+)$/u.exec(missionId)?.[1];
	return Math.max(1, Math.min(7, floor ? Number(floor) : 1));
}

export function combatContributionEvidenceForTerminal(
	state: EngineGameStateV27,
	terminalEventId: string,
	firstClearEligible: boolean
): readonly CombatContributionEvidenceV1[] {
	const attempt = state.mission.attempt;
	if (!attempt) return [];
	const encounterKey = state.mission.binding.missionId;
	const difficultyBand = missionDifficultyBand(encounterKey);
	const contributions = new Map<string, { effects: Set<string>; objectives: Set<string> }>();
	for (const heroId of attempt.party.heroIds) {
		contributions.set(heroId, { effects: new Set(), objectives: new Set() });
	}
	if (attempt.combatState.modeId === 'legacy-auto-v1') {
		for (const round of attempt.combatState.turnState.rounds) {
			for (const action of round.actions) {
				const contribution = contributions.get(action.actorId);
				if (!contribution || action.actorKind !== 'hero' || action.outcome !== 'applied') continue;
				for (const effectId of action.effectIds) contribution.effects.add(effectId);
				if (action.objectiveTransition) {
					contribution.objectives.add(
						deterministicUuid(
							`${attempt.attemptId}:${round.roundNumber}:${action.actorId}:${action.objectiveTransition}`
						)
					);
				}
			}
		}
	} else {
		for (const event of attempt.combatState.readinessState.outcomeEvidence.resolvedEvents) {
			const contribution = contributions.get(event.actorId);
			if (!contribution || event.finalOutcome !== 'applied' || event.effects.length === 0) continue;
			contribution.effects.add(event.eventId);
		}
	}
	return [...contributions.entries()]
		.map(([heroId, contribution]) => {
			const priorCompletions =
				state.heroes[heroId]?.progression.evidenceCounts.combat[encounterKey] ?? 0;
			return CombatContributionEvidenceV1Schema.parse({
				evidenceVersion: 'combat-contribution-v1',
				attemptId: attempt.attemptId,
				heroId,
				terminalEventId,
				encounterKey,
				difficultyBand,
				appliedEffectIds: [...contribution.effects].sort(),
				objectiveEvidenceIds: [...contribution.objectives].sort(),
				firstClear: firstClearEligible && priorCompletions === 0,
				priorCompletions
			});
		})
		.sort((left, right) => left.heroId.localeCompare(right.heroId));
}

export function buildCombatExperienceOutcomes(
	state: EngineGameStateV27,
	terminalEventId: string,
	firstClearEligible: boolean
): readonly CombatExperienceOutcomeV1[] {
	const evidence = combatContributionEvidenceForTerminal(
		state,
		terminalEventId,
		firstClearEligible
	);
	const claims = experienceClaimsForCombatResult(evidence, PROGRESSION_RULES_V1);
	const evidenceByHeroId = new Map(evidence.map((entry) => [entry.heroId, entry]));
	return claims.map((claim) => {
		const hero = state.heroes[claim.heroId];
		const contribution = evidenceByHeroId.get(claim.heroId);
		if (!hero || !contribution) throw new Error('Combat contribution hero disappeared');
		const experience = applyExperienceClaim({
			progression: hero.progression,
			claim,
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: state.simulatedAt
		});
		const progressionAfter = HeroProgressionV2Schema.parse({
			...experience.progression,
			evidenceCounts: {
				...experience.progression.evidenceCounts,
				combat: {
					...experience.progression.evidenceCounts.combat,
					[contribution.encounterKey]: contribution.priorCompletions + 1
				}
			}
		});
		const maxHealthAfter = maximumHealth(
			intrinsicAttributes(hero.capabilityProfile, progressionAfter.permanentGrowth).vitality,
			progressionAfter.level,
			PROGRESSION_RULES_V1
		);
		return CombatExperienceOutcomeV1Schema.parse({
			evidence: contribution,
			receipt: experience.receipt,
			progressionAfter,
			maxHealthAfter,
			healthAfter: reconcileHealthAfterProgression({
				health: hero.health,
				oldMaximum: hero.maxHealth,
				newMaximum: maxHealthAfter
			})
		});
	});
}
