import {
	AttributeModifierSchema,
	PermanentAttributeReceiptSchema,
	ResistanceGrantReceiptSchema,
	type CharacterCapabilityProfileV1
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	armourReduction,
	attributeScaledMagnitude,
	effectiveAttribute,
	healthRegeneration,
	intrinsicAttributes,
	learningGain,
	manaRegeneration,
	maximumHealth,
	maximumMana,
	namedResistanceReduction
} from './capability.js';

const PROFILE: CharacterCapabilityProfileV1 = {
	profileVersion: 'character-capability-v1',
	attributes: { strength: 20, agility: 40, vitality: 30, magic: 50 },
	learning: {
		cognitiveLearningScore: 100,
		domainAptitudes: { martial: 25, magical: 50, crafting: 75, survival: 40, social: 60 }
	}
};

const NEUTRAL_LEARNING_CONTEXT = {
	teachingQualityBasisPoints: 10_000,
	facilityQualityBasisPoints: 10_000,
	motivationBasisPoints: 10_000,
	conditionBasisPoints: 10_000,
	varietyBasisPoints: 10_000,
	repetitionDecayBasisPoints: 10_000
} as const;

function modifier(
	modifierId: string,
	attribute: 'strength' | 'vitality' | 'agility' | 'magic',
	scope: 'physical-damage' | 'magical-damage',
	stackingRule: 'additive-flat' | 'additive-basis-points',
	value: number
) {
	return AttributeModifierSchema.parse({
		modifierId,
		attribute,
		scope,
		stackingRule,
		value,
		cap: Math.abs(value),
		duration: { kind: 'action' },
		source: {
			receiptId: modifierId,
			sourceKind: 'skill',
			sourceId: `skill:${modifierId}`
		},
		rulesVersion: 'combat-rules-v1'
	});
}

function resistance(grantId: string, tag: 'cut' | 'burn' | 'shock', basisPoints: number) {
	return ResistanceGrantReceiptSchema.parse({
		grantId,
		tag,
		basisPoints,
		stackingRule: 'additive',
		capBasisPoints: basisPoints,
		source: {
			receiptId: grantId,
			sourceKind: 'equipment',
			sourceId: `item:${grantId}`
		},
		rulesVersion: 'combat-rules-v1'
	});
}

describe('four-attribute combat capability math', () => {
	it('applies permanent receipts to intrinsic attributes without mutating the profile', () => {
		const receipts = [
			PermanentAttributeReceiptSchema.parse({
				receiptId: '20000000-0000-4000-8000-000000000001',
				sourceKind: 'level-allocation',
				sourceId: 'level:2',
				attribute: 'strength',
				points: 3,
				rulesVersion: 'combat-rules-v1'
			}),
			PermanentAttributeReceiptSchema.parse({
				receiptId: '20000000-0000-4000-8000-000000000002',
				sourceKind: 'permanent-training',
				sourceId: 'training:vitality',
				attribute: 'vitality',
				points: 5,
				rulesVersion: 'combat-rules-v1'
			})
		];

		expect(intrinsicAttributes(PROFILE, receipts, COMBAT_RULES_V1)).toStrictEqual({
			strength: 23,
			vitality: 35,
			agility: 40,
			magic: 50
		});
		expect(PROFILE.attributes).toStrictEqual({
			strength: 20,
			vitality: 30,
			agility: 40,
			magic: 50
		});
	});

	it('filters modifiers by both typed scope and owning attribute, then stacks flat before basis points', () => {
		const modifiers = [
			modifier(
				'20000000-0000-4000-8000-000000000003',
				'strength',
				'physical-damage',
				'additive-basis-points',
				2_000
			),
			modifier(
				'20000000-0000-4000-8000-000000000004',
				'strength',
				'physical-damage',
				'additive-flat',
				5
			),
			modifier(
				'20000000-0000-4000-8000-000000000005',
				'magic',
				'physical-damage',
				'additive-flat',
				100
			),
			modifier(
				'20000000-0000-4000-8000-000000000006',
				'strength',
				'magical-damage',
				'additive-flat',
				100
			)
		];

		expect(effectiveAttribute(20, modifiers, 'physical-damage', COMBAT_RULES_V1)).toBe(30);
		expect(
			effectiveAttribute(20, modifiers, 'physical-damage', {
				...COMBAT_RULES_V1,
				attributes: {
					...COMBAT_RULES_V1.attributes,
					modifierStackingOrder: ['additive-basis-points', 'additive-flat']
				}
			})
		).toBe(29);
	});

	it('uses Strength only for physical magnitude and Magic only for magical magnitude', () => {
		expect(attributeScaledMagnitude(100, 'physical', PROFILE.attributes, COMBAT_RULES_V1)).toBe(
			120
		);
		expect(
			attributeScaledMagnitude(
				100,
				'physical',
				{ ...PROFILE.attributes, agility: 100, magic: 100 },
				COMBAT_RULES_V1
			)
		).toBe(120);
		expect(attributeScaledMagnitude(100, 'magical', PROFILE.attributes, COMBAT_RULES_V1)).toBe(150);
		expect(
			attributeScaledMagnitude(
				100,
				'magical',
				{ ...PROFILE.attributes, strength: 100, vitality: 100 },
				COMBAT_RULES_V1
			)
		).toBe(150);
	});

	it('derives Health only from Vitality and blocks unsafe natural regeneration', () => {
		expect(maximumHealth(30, COMBAT_RULES_V1)).toBe(220);
		expect(
			healthRegeneration(
				30,
				{ mode: 'safe-rest', downed: false, ticksSinceDamage: 0, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBe(5);
		expect(
			healthRegeneration(
				30,
				{ mode: 'combat', downed: false, ticksSinceDamage: 50, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBe(1);
		for (const unsafe of [
			{ mode: 'combat' as const, downed: false, ticksSinceDamage: 49, injuryRepair: false },
			{ mode: 'combat' as const, downed: true, ticksSinceDamage: 50, injuryRepair: false },
			{ mode: 'safe-rest' as const, downed: false, ticksSinceDamage: null, injuryRepair: true }
		]) {
			expect(healthRegeneration(100, unsafe, COMBAT_RULES_V1)).toBe(0);
		}
	});

	it('derives Mana and modest saturating regeneration only from Magic', () => {
		expect(maximumMana(50, COMBAT_RULES_V1)).toBe(140);
		expect(
			manaRegeneration(
				50,
				{ mode: 'safe-rest', downed: false, ticksSinceDamage: 0, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBe(6);
		expect(
			manaRegeneration(
				50,
				{ mode: 'combat', downed: false, ticksSinceDamage: 0, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBe(3);
		expect(
			manaRegeneration(
				100,
				{ mode: 'safe-rest', downed: false, ticksSinceDamage: 0, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBeLessThan(10);
	});

	it('makes armour and penetration the only inputs to general mitigation', () => {
		expect(armourReduction(100, 0, COMBAT_RULES_V1)).toBe(5_000);
		expect(armourReduction(100, 25, COMBAT_RULES_V1)).toBe(4_286);
		expect(armourReduction(50, 100, COMBAT_RULES_V1)).toBe(0);
		expect(armourReduction(1_000_000, 0, COMBAT_RULES_V1)).toBe(7_499);

		let previous = -1;
		for (let armour = 0; armour <= 10_000; armour += 1) {
			const reduction = armourReduction(armour, 0, COMBAT_RULES_V1);
			expect(reduction).toBeGreaterThanOrEqual(previous);
			expect(reduction).toBeLessThan(7_500);
			previous = reduction;
		}
	});

	it('adds only matching named resistances and caps their combined reduction', () => {
		const grants = [
			resistance('20000000-0000-4000-8000-000000000007', 'cut', 3_000),
			resistance('20000000-0000-4000-8000-000000000008', 'cut', 3_000),
			resistance('20000000-0000-4000-8000-000000000009', 'burn', 2_000),
			resistance('20000000-0000-4000-8000-000000000010', 'shock', 5_000)
		];

		expect(namedResistanceReduction(['physical', 'cut', 'burn'], grants, COMBAT_RULES_V1)).toBe(
			7_500
		);
		expect(namedResistanceReduction(['physical'], grants, COMBAT_RULES_V1)).toBe(0);
	});

	it('applies bounded cognition only to comprehension-heavy learning evidence', () => {
		const comprehension = learningGain(
			{
				evidenceId: '20000000-0000-4000-8000-000000000011',
				domain: 'crafting',
				basePractice: 100,
				comprehensionHeavy: true
			},
			PROFILE,
			NEUTRAL_LEARNING_CONTEXT,
			COMBAT_RULES_V1
		);
		const repetition = learningGain(
			{
				evidenceId: '20000000-0000-4000-8000-000000000012',
				domain: 'crafting',
				basePractice: 100,
				comprehensionHeavy: false
			},
			PROFILE,
			NEUTRAL_LEARNING_CONTEXT,
			COMBAT_RULES_V1
		);
		const lowCognitionRepetition = learningGain(
			{
				evidenceId: '20000000-0000-4000-8000-000000000013',
				domain: 'crafting',
				basePractice: 100,
				comprehensionHeavy: false
			},
			{
				...PROFILE,
				learning: { ...PROFILE.learning, cognitiveLearningScore: 0 }
			},
			NEUTRAL_LEARNING_CONTEXT,
			COMBAT_RULES_V1
		);

		expect(comprehension).toMatchObject({
			cognitiveFactorBasisPoints: 11_000,
			domainAptitudeFactorBasisPoints: 11_000,
			gainedPractice: 121
		});
		expect(repetition).toMatchObject({
			cognitiveFactorBasisPoints: 10_000,
			gainedPractice: 110
		});
		expect(lowCognitionRepetition.gainedPractice).toBe(110);
		expect(comprehension).not.toHaveProperty('cognitiveLearningScore');
	});
});
