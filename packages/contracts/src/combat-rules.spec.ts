import { describe, expect, it } from 'vitest';

import {
	AttributeModifierSchema,
	CombatRulesV1Schema,
	DamageTagSchema,
	LearningContextSchema,
	LearningEvidenceSchema,
	PermanentAttributeReceiptSchema,
	ResistanceGrantReceiptSchema,
	ResistanceTagSchema
} from './combat-rules.js';

const SOURCE_RECEIPT = {
	receiptId: '10000000-0000-4000-8000-000000000001',
	sourceKind: 'equipment' as const,
	sourceId: 'item:ember-ring'
};

function validRules() {
	return {
		rulesVersion: 'combat-rules-v1' as const,
		attributes: {
			intrinsicMinimum: 1,
			intrinsicMaximum: 100,
			effectiveMinimum: 1,
			effectiveMaximum: 200,
			modifierStackingOrder: ['additive-flat', 'additive-basis-points'] as const
		},
		damage: {
			physicalBasisPointsPerMight: 100,
			magicalBasisPointsPerSpirit: 100
		},
		health: {
			baseMaximum: 100,
			perVitality: 4,
			safeRestRegenerationBase: 2,
			safeRestRegenerationVitalityDivisor: 10,
			combatRegenerationDelayTicks: 50,
			combatRecoveryBasisPoints: 2_000
		},
		mana: {
			baseMaximum: 40,
			perSpirit: 2,
			regenerationBase: 2,
			regenerationSpiritBonus: 8,
			regenerationSaturationConstant: 50,
			combatRecoveryBasisPoints: 5_000
		},
		armour: { curveConstant: 100, maximumGeneralReductionBasisPoints: 7_499 },
		resistance: { capBasisPoints: 7_500 },
		learning: {
			cognitiveMinimumBasisPoints: 9_000,
			cognitiveMaximumBasisPoints: 11_000,
			domainMinimumBasisPoints: 8_000,
			domainMaximumBasisPoints: 12_000
		},
		affinity: { contributionNudgeCapBasisPoints: 1_000 }
	};
}

describe('combat rules contracts', () => {
	it('requires every scoped modifier to carry typed source, stacking, cap, duration, and rules evidence', () => {
		const parsed = AttributeModifierSchema.parse({
			modifierId: '10000000-0000-4000-8000-000000000002',
			attribute: 'might',
			scope: 'physical-damage',
			stackingRule: 'additive-flat',
			value: 5,
			cap: 5,
			duration: { kind: 'action' },
			source: SOURCE_RECEIPT,
			rulesVersion: 'combat-rules-v1'
		});

		expect(parsed.scope).toBe('physical-damage');
		expect(parsed.source).toStrictEqual(SOURCE_RECEIPT);
		expect(
			AttributeModifierSchema.safeParse({ ...parsed, scope: 'all-attribute-uses' }).success
		).toBe(false);
		expect(AttributeModifierSchema.safeParse({ ...parsed, value: 6 }).success).toBe(false);
		expect(
			AttributeModifierSchema.safeParse({
				...parsed,
				duration: { kind: 'until-tick', expiresAtTick: -1 }
			}).success
		).toBe(false);
	});

	it('keeps permanent intrinsic growth distinct from temporary modifier receipts', () => {
		const parsed = PermanentAttributeReceiptSchema.parse({
			receiptId: '10000000-0000-4000-8000-000000000003',
			sourceKind: 'level-allocation',
			sourceId: 'level:2',
			attribute: 'vitality',
			points: 1,
			rulesVersion: 'combat-rules-v1'
		});

		expect(parsed).toMatchObject({ attribute: 'vitality', points: 1 });
		expect(
			PermanentAttributeReceiptSchema.safeParse({ ...parsed, sourceKind: 'food' }).success
		).toBe(false);
		expect(PermanentAttributeReceiptSchema.safeParse({ ...parsed, points: 0 }).success).toBe(false);
	});

	it('types named damage and resistance tags without a blanket physical or mental resistance', () => {
		expect(ResistanceTagSchema.options).toStrictEqual([
			'cut',
			'pierce',
			'impact',
			'burn',
			'frost',
			'shock',
			'arcane'
		]);
		expect(DamageTagSchema.safeParse('physical').success).toBe(true);
		expect(DamageTagSchema.safeParse('burn').success).toBe(true);
		expect(ResistanceTagSchema.safeParse('physical').success).toBe(false);
		expect(ResistanceTagSchema.safeParse('mental').success).toBe(false);

		const grant = ResistanceGrantReceiptSchema.parse({
			grantId: '10000000-0000-4000-8000-000000000004',
			tag: 'burn',
			basisPoints: 1_500,
			stackingRule: 'additive',
			capBasisPoints: 2_000,
			source: SOURCE_RECEIPT,
			rulesVersion: 'combat-rules-v1'
		});
		expect(grant.tag).toBe('burn');
		expect(ResistanceGrantReceiptSchema.safeParse({ ...grant, basisPoints: 2_001 }).success).toBe(
			false
		);
	});

	it('validates integer authoritative rules and ordered balance bands', () => {
		expect(CombatRulesV1Schema.parse(validRules())).toStrictEqual(validRules());
		expect(
			CombatRulesV1Schema.safeParse({
				...validRules(),
				attributes: {
					...validRules().attributes,
					modifierStackingOrder: ['additive-flat', 'additive-flat']
				}
			}).success
		).toBe(false);
		expect(
			CombatRulesV1Schema.safeParse({
				...validRules(),
				armour: { ...validRules().armour, maximumGeneralReductionBasisPoints: 7_500 }
			}).success
		).toBe(false);
		expect(
			CombatRulesV1Schema.safeParse({
				...validRules(),
				health: { ...validRules().health, perVitality: 4.5 }
			}).success
		).toBe(false);
		expect(
			CombatRulesV1Schema.safeParse({
				...validRules(),
				learning: {
					...validRules().learning,
					cognitiveMinimumBasisPoints: 11_001
				}
			}).success
		).toBe(false);
		expect(
			CombatRulesV1Schema.safeParse({
				...validRules(),
				affinity: { contributionNudgeCapBasisPoints: 1_001 }
			}).success
		).toBe(false);
	});

	it('validates learning evidence and explicit context factors without placing IQ in action quality', () => {
		expect(
			LearningEvidenceSchema.parse({
				evidenceId: '10000000-0000-4000-8000-000000000005',
				domain: 'crafting',
				basePractice: 20,
				comprehensionHeavy: true
			})
		).toMatchObject({ domain: 'crafting', basePractice: 20 });
		expect(
			LearningContextSchema.parse({
				teachingQualityBasisPoints: 10_000,
				facilityQualityBasisPoints: 10_000,
				motivationBasisPoints: 10_000,
				conditionBasisPoints: 10_000,
				varietyBasisPoints: 10_000,
				repetitionDecayBasisPoints: 10_000
			})
		).not.toHaveProperty('decisionQuality');
	});
});
