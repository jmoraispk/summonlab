import {
	AttributeGrowthClaimSchema,
	AttributeGrowthReceiptV2Schema,
	HeroProgressionV2Schema,
	ProgressionRulesBindingSchema,
	type AttributeGrowthClaim,
	type AttributeGrowthReceiptV2,
	type CharacterCapabilityProfileV1,
	type HeroProgressionV2,
	type ProgressionRulesBinding
} from '@summonlab/contracts';
import { COMBAT_RULES_V1, type ProgressionRulesV1 } from '@summonlab/content';

import { maximumMana } from '../combat/capability.js';
import { deterministicUuid } from '../../hash.js';
import { intrinsicAttributes, maximumHealth } from './math.js';

export type ProgressionHero = Readonly<{
	heroId: string;
	lifeState: 'active' | 'dead' | 'synthesized' | 'downed';
	health: number;
	maxHealth: number;
	mana: number;
	maxMana: number;
	capabilityProfile: CharacterCapabilityProfileV1;
	progression: HeroProgressionV2;
}>;

export type ApplyAttributeGrowthClaimInput = Readonly<{
	hero: ProgressionHero;
	claim: AttributeGrowthClaim;
	rules: ProgressionRulesV1;
	rulesBinding: ProgressionRulesBinding;
	occurredAt: string;
}>;

export type AttributeGrowthClaimOutcome = Readonly<{
	hero: ProgressionHero;
	receipt: AttributeGrowthReceiptV2;
}>;

export function applyAttributeGrowthClaim(
	input: ApplyAttributeGrowthClaimInput
): AttributeGrowthClaimOutcome {
	const claim = AttributeGrowthClaimSchema.parse(input.claim);
	const rulesBinding = ProgressionRulesBindingSchema.parse(input.rulesBinding);
	const progression = HeroProgressionV2Schema.parse(input.hero.progression);
	if (rulesBinding.rulesVersion !== input.rules.rulesVersion) {
		throw new Error('Attribute growth rules binding does not match supplied rules');
	}
	if (input.hero.lifeState !== 'active')
		throw new Error('Attribute growth requires an active hero');
	if (claim.heroId !== input.hero.heroId)
		throw new Error('Attribute growth hero does not match claim');
	const pointsSpent = claim.sourceKind === 'allocation' ? claim.amount : 0;
	if (progression.unallocatedAttributePoints < pointsSpent) {
		throw new Error('Attribute allocation exceeds unallocated points');
	}

	const beforeAttributes = intrinsicAttributes(
		input.hero.capabilityProfile,
		progression.permanentGrowth
	);
	const permanentGrowth = {
		...progression.permanentGrowth,
		[claim.attribute]: progression.permanentGrowth[claim.attribute] + claim.amount
	};
	const afterAttributes = intrinsicAttributes(input.hero.capabilityProfile, permanentGrowth);
	const unallocatedAfter = progression.unallocatedAttributePoints - pointsSpent;
	const nextProgression = HeroProgressionV2Schema.parse({
		...progression,
		unallocatedAttributePoints: unallocatedAfter,
		permanentGrowth
	});
	const maxHealth = maximumHealth(afterAttributes.vitality, progression.level, input.rules);
	const maxMana = maximumMana(afterAttributes.magic, COMBAT_RULES_V1);
	const nextHero = Object.freeze({
		...input.hero,
		health: Math.min(input.hero.health, maxHealth),
		maxHealth,
		mana: Math.min(input.hero.mana, maxMana),
		maxMana,
		progression: nextProgression
	});
	const receipt = AttributeGrowthReceiptV2Schema.parse({
		receiptVersion: 'attribute-growth-receipt-v2',
		receiptId: deterministicUuid(`${claim.claimId}:attribute-growth-receipt-v2`),
		claim,
		rules: rulesBinding,
		intrinsicBefore: beforeAttributes[claim.attribute],
		intrinsicAfter: afterAttributes[claim.attribute],
		pointsSpent,
		unallocatedBefore: progression.unallocatedAttributePoints,
		unallocatedAfter,
		occurredAt: input.occurredAt
	});
	return Object.freeze({ hero: nextHero, receipt });
}
