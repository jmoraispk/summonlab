import {
	AttributeGrowthReceiptSchema,
	CharacterCapabilityProfileV1Schema,
	PermanentAttributeReceiptSchema,
	type AttributeGrowthReceipt,
	type CharacterCapabilityProfileV1,
	type CombatAttributes,
	type CombatRulesV1,
	type PermanentAttributeReceipt
} from '@summonlab/contracts';

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function intrinsicAttributes(
	profileInput: CharacterCapabilityProfileV1,
	receiptInputs: readonly (PermanentAttributeReceipt | AttributeGrowthReceipt)[],
	rules: CombatRulesV1
): CombatAttributes {
	const profile = CharacterCapabilityProfileV1Schema.parse(profileInput);
	const attributes = { ...profile.attributes };
	for (const receiptInput of receiptInputs) {
		const permanentReceipt = PermanentAttributeReceiptSchema.safeParse(receiptInput);
		if (permanentReceipt.success) {
			const receipt = permanentReceipt.data;
			attributes[receipt.attribute] = clamp(
				attributes[receipt.attribute] + receipt.points,
				rules.attributes.intrinsicMinimum,
				rules.attributes.intrinsicMaximum
			);
			continue;
		}

		const receipt = AttributeGrowthReceiptSchema.parse(receiptInput);
		const before = attributes[receipt.attribute];
		const after = clamp(
			before + receipt.spentPoints,
			rules.attributes.intrinsicMinimum,
			rules.attributes.intrinsicMaximum
		);
		if (receipt.beforeIntrinsicValue !== before || receipt.afterIntrinsicValue !== after) {
			throw new Error('Attribute growth receipt diverged from canonical intrinsic attributes');
		}
		attributes[receipt.attribute] = after;
	}
	return attributes;
}

export function maximumHealth(vitality: number, rules: CombatRulesV1): number {
	if (!Number.isInteger(vitality) || vitality < 0)
		throw new Error('Vitality must be a nonnegative integer');
	return rules.health.baseMaximum + vitality * rules.health.perVitality;
}

export function maximumMana(spirit: number, rules: CombatRulesV1): number {
	if (!Number.isInteger(spirit) || spirit < 0)
		throw new Error('Spirit must be a nonnegative integer');
	return rules.mana.baseMaximum + spirit * rules.mana.perSpirit;
}
