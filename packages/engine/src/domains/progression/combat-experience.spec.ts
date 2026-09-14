import { CombatContributionEvidenceV1Schema } from '@summonlab/contracts';
import { PROGRESSION_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { deterministicUuid } from '../../hash.js';
import { experienceClaimsForCombatResult } from './combat-experience.js';

const ATTEMPT_ID = deterministicUuid('combat-xp-attempt');
const TERMINAL_EVENT_ID = deterministicUuid('combat-xp-terminal');

function evidence(hero: string, effects: number, objectives: number, overrides = {}) {
	return CombatContributionEvidenceV1Schema.parse({
		evidenceVersion: 'combat-contribution-v1',
		attemptId: ATTEMPT_ID,
		heroId: deterministicUuid(`combat-xp:${hero}`),
		terminalEventId: TERMINAL_EVENT_ID,
		encounterKey: 'tower-floor-03',
		difficultyBand: 3,
		appliedEffectIds: Array.from({ length: effects }, (_, index) =>
			deterministicUuid(`combat-xp:${hero}:effect:${index}`)
		),
		objectiveEvidenceIds: Array.from({ length: objectives }, (_, index) =>
			deterministicUuid(`combat-xp:${hero}:objective:${index}`)
		),
		firstClear: true,
		priorCompletions: 0,
		...overrides
	});
}

describe('evidence-based combat experience', () => {
	it('rewards damage, protection, and objective contribution without a last-hit bonus', () => {
		const contributors = [
			evidence('damage', 2, 0),
			evidence('protect', 1, 0),
			evidence('objective', 0, 1)
		];
		const claims = experienceClaimsForCombatResult(contributors, PROGRESSION_RULES_V1);
		expect(claims).toHaveLength(3);
		expect(claims.map((claim) => claim.heroId)).toEqual(
			contributors.map((entry) => entry.heroId).sort()
		);
		expect(claims.every((claim) => claim.sourceKind === 'combat')).toBe(true);
		expect(claims.find((claim) => claim.heroId === contributors[0]!.heroId)!.amount).toBe(
			claims.find((claim) => claim.heroId === contributors[1]!.heroId)!.amount
		);
		expect(
			claims.find((claim) => claim.heroId === contributors[2]!.heroId)!.amount
		).toBeGreaterThan(claims.find((claim) => claim.heroId === contributors[0]!.heroId)!.amount);
	});

	it('does not reward idle deployment or narration without resolved evidence', () => {
		expect(experienceClaimsForCombatResult([evidence('idle', 0, 0)], PROGRESSION_RULES_V1)).toEqual(
			[]
		);
	});

	it('supports legitimate failure contribution and bounds exhausted repetition', () => {
		const [claim] = experienceClaimsForCombatResult(
			[evidence('retreat', 1, 0, { firstClear: false, priorCompletions: 999, difficultyBand: 1 })],
			PROGRESSION_RULES_V1
		);
		expect(claim!.amount).toBe(PROGRESSION_RULES_V1.combat.minimumExperience);
	});

	it('rejects duplicate or malformed evidence identities', () => {
		const effectId = deterministicUuid('duplicate-combat-effect');
		expect(() => evidence('bad', 0, 0, { appliedEffectIds: [effectId, effectId] })).toThrow();
	});
});
