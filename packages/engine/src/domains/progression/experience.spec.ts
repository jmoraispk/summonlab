import { HeroProgressionV2Schema } from '@summonlab/contracts';
import { PROGRESSION_RULES_V1, PROGRESSION_RULES_V1_BINDING } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { deterministicUuid } from '../../hash.js';
import {
	applyExperienceClaim,
	experienceThresholdForLevel,
	levelForExperience,
	reconcileHealthAfterProgression
} from './experience.js';

const NOW = '2000-01-01T00:00:00.000Z';
const HERO_ID = deterministicUuid('experience-spec-hero');

function progression(input: Partial<ReturnType<typeof HeroProgressionV2Schema.parse>> = {}) {
	return HeroProgressionV2Schema.parse({
		progressionVersion: 'hero-progression-v2',
		stars: 5,
		level: 1,
		experience: 0,
		unallocatedAttributePoints: 0,
		permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
		evidenceCounts: { combat: {}, crafting: {} },
		skills: { swordFighting: { rank: 0, experience: 0 } },
		...input
	});
}

function claim(amount: number) {
	return {
		claimId: deterministicUuid(`experience-spec-claim:${amount}`),
		heroId: HERO_ID,
		sourceEventId: deterministicUuid(`experience-spec-event:${amount}`),
		evidenceKey: 'training:ring',
		amount,
		sourceKind: 'training' as const
	};
}

describe('v27 experience progression', () => {
	it('grants immutable-star points for every crossed level', () => {
		const outcome = applyExperienceClaim({
			progression: progression({ stars: 5, level: 99, experience: 980 }),
			claim: claim(30),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		});

		expect(outcome.progression).toMatchObject({
			level: 102,
			experience: 1_010,
			unallocatedAttributePoints: 15,
			stars: 5
		});
		expect(outcome.receipt).toMatchObject({
			levelsCrossed: [100, 101, 102],
			pointsGranted: 15,
			rules: PROGRESSION_RULES_V1_BINDING
		});
	});

	it.each([
		[0, 1],
		[980, 99],
		[990, 100],
		[1_980, 199],
		[1_990, 200],
		[8_980, 899],
		[8_990, 900],
		[9_980, 999],
		[20_000, 999]
	])('maps %i cumulative XP to level %i', (experience, level) => {
		expect(levelForExperience(experience, PROGRESSION_RULES_V1)).toBe(level);
		expect(experienceThresholdForLevel(level, PROGRESSION_RULES_V1)).toBe((level - 1) * 10);
	});

	it.each([1, 2, 3, 4, 5, 6, 7])('grants exactly %i points per crossed level', (stars) => {
		const outcome = applyExperienceClaim({
			progression: progression({ stars, level: 1, experience: 0 }),
			claim: claim(20 + stars),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		});
		expect(outcome.receipt.pointsGranted).toBe(stars * 2);
		expect(outcome.progression.stars).toBe(stars);
	});

	it('keeps accumulating XP at the level cap without points or star mutation', () => {
		const outcome = applyExperienceClaim({
			progression: progression({ stars: 7, level: 999, experience: 9_980 }),
			claim: claim(100),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		});
		expect(outcome.progression).toMatchObject({ level: 999, experience: 10_080, stars: 7 });
		expect(outcome.receipt).toMatchObject({ levelsCrossed: [], pointsGranted: 0 });
	});

	it('is deterministic and rejects invalid claims', () => {
		const input = {
			progression: progression(),
			claim: claim(10),
			rules: PROGRESSION_RULES_V1,
			rulesBinding: PROGRESSION_RULES_V1_BINDING,
			occurredAt: NOW
		};
		expect(applyExperienceClaim(input)).toStrictEqual(applyExperienceClaim(input));
		expect(() =>
			applyExperienceClaim({ ...input, claim: { ...input.claim, amount: 0 } })
		).toThrow();
	});

	it('does not refill Health when a maximum rises and clamps only when it falls', () => {
		expect(reconcileHealthAfterProgression({ health: 60, oldMaximum: 100, newMaximum: 130 })).toBe(
			60
		);
		expect(reconcileHealthAfterProgression({ health: 90, oldMaximum: 100, newMaximum: 70 })).toBe(
			70
		);
	});
});
