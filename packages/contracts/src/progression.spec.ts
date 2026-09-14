import { describe, expect, it } from 'vitest';

import {
	AttributeGrowthClaimSchema,
	AttributeGrowthReceiptV2Schema,
	ExperienceClaimSchema,
	ExperienceReceiptSchema,
	HeroProgressionV2Schema,
	ProgressionMacroPathSchema,
	ProgressionRulesBindingSchema
} from './progression.js';

const ID = {
	claim: '10000000-0000-4000-8000-000000000001',
	hero: '10000000-0000-4000-8000-000000000002',
	event: '10000000-0000-4000-8000-000000000003',
	receipt: '10000000-0000-4000-8000-000000000004'
} as const;

const RULES = {
	rulesVersion: 'progression-rules-v1' as const,
	contentHash: 'a'.repeat(64)
};

function progression(level = 999) {
	return {
		progressionVersion: 'hero-progression-v2' as const,
		stars: 7,
		level,
		experience: 9_980,
		unallocatedAttributePoints: 6_986,
		permanentGrowth: { strength: 0, agility: 0, vitality: 0, magic: 0 },
		evidenceCounts: { combat: {}, crafting: {} },
		skills: { swordFighting: { rank: 0, experience: 0 } }
	};
}

function experienceClaim(
	sourceKind: 'combat' | 'crafting' | 'training' | 'synthesis' | 'authored'
) {
	return {
		claimId: ID.claim,
		heroId: ID.hero,
		sourceEventId: ID.event,
		evidenceKey: `${sourceKind}:first-proof`,
		amount: 25,
		sourceKind
	};
}

function growthClaim(
	sourceKind: 'allocation' | 'training' | 'achievement' | 'consumable' | 'cultivation'
) {
	return {
		claimId: ID.claim,
		heroId: ID.hero,
		sourceEventId: ID.event,
		attribute: 'strength' as const,
		amount: 3,
		sourceKind
	};
}

describe('awakening and multi-path progression contracts', () => {
	it('accepts immutable-star v2 progression through level 999', () => {
		const parsed = HeroProgressionV2Schema.parse(progression());
		expect(parsed.level).toBe(999);
		expect(HeroProgressionV2Schema.safeParse(progression(1)).success).toBe(true);
		expect(HeroProgressionV2Schema.safeParse(progression(0)).success).toBe(false);
		expect(HeroProgressionV2Schema.safeParse(progression(1_000)).success).toBe(false);
		expect(HeroProgressionV2Schema.safeParse({ ...progression(), stars: 1 }).success).toBe(true);
		expect(HeroProgressionV2Schema.safeParse({ ...progression(), stars: 8 }).success).toBe(false);
		expect(HeroProgressionV2Schema.safeParse({ ...progression(), awakeningTier: 9 }).success).toBe(
			false
		);
	});

	it('defines the two initial macro paths without binding one to a hero', () => {
		expect(ProgressionMacroPathSchema.options).toStrictEqual(['combat', 'crafting']);
		expect(HeroProgressionV2Schema.keyof().options).not.toContain('macroPath');
	});

	it('accepts every typed positive experience source and rejects loose claims', () => {
		for (const source of ['combat', 'crafting', 'training', 'synthesis', 'authored'] as const) {
			expect(ExperienceClaimSchema.parse(experienceClaim(source)).sourceKind).toBe(source);
		}
		expect(
			ExperienceClaimSchema.safeParse({ ...experienceClaim('combat'), amount: 0 }).success
		).toBe(false);
		expect(
			ExperienceClaimSchema.safeParse({ ...experienceClaim('combat'), extra: true }).success
		).toBe(false);
	});

	it('accepts every typed growth source with only canonical attributes', () => {
		for (const source of [
			'allocation',
			'training',
			'achievement',
			'consumable',
			'cultivation'
		] as const) {
			expect(AttributeGrowthClaimSchema.parse(growthClaim(source)).sourceKind).toBe(source);
		}
		expect(
			AttributeGrowthClaimSchema.safeParse({ ...growthClaim('allocation'), attribute: 'might' })
				.success
		).toBe(false);
		expect(
			AttributeGrowthClaimSchema.safeParse({ ...growthClaim('allocation'), amount: -1 }).success
		).toBe(false);
	});

	it('binds strict replayable receipts to progression rules', () => {
		expect(ProgressionRulesBindingSchema.parse(RULES)).toStrictEqual(RULES);
		const experienceReceipt = {
			receiptVersion: 'experience-receipt-v1' as const,
			receiptId: ID.receipt,
			claim: experienceClaim('crafting'),
			rules: RULES,
			experienceBefore: 90,
			experienceAfter: 15,
			levelBefore: 1,
			levelAfter: 3,
			levelsCrossed: [2, 3],
			pointsGranted: 14,
			occurredAt: '2026-09-12T00:00:00.000Z'
		};
		expect(ExperienceReceiptSchema.parse(experienceReceipt)).toStrictEqual(experienceReceipt);

		const growthReceipt = {
			receiptVersion: 'attribute-growth-receipt-v2' as const,
			receiptId: ID.receipt,
			claim: growthClaim('allocation'),
			rules: RULES,
			intrinsicBefore: 20,
			intrinsicAfter: 23,
			pointsSpent: 3,
			unallocatedBefore: 10,
			unallocatedAfter: 7,
			occurredAt: '2026-09-12T00:00:00.000Z'
		};
		expect(AttributeGrowthReceiptV2Schema.parse(growthReceipt)).toStrictEqual(growthReceipt);
		expect(
			AttributeGrowthReceiptV2Schema.safeParse({ ...growthReceipt, loose: true }).success
		).toBe(false);
	});
});
