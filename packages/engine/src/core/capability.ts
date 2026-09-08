import {
	AttributeGrowthReceiptSchema,
	AttributeModifierSchema,
	CharacterCapabilityProfileV1Schema,
	PermanentAttributeReceiptSchema,
	ResistanceGrantReceiptSchema,
	type AttributeGrowthReceipt,
	type AttributeModifier,
	type AttributeModifierScope,
	type CharacterCapabilityProfileV1,
	type CombatAttributes,
	type CombatRulesV1,
	type DamageTag,
	type PermanentAttributeReceipt,
	type ResistanceGrantReceipt
} from '@summonlab/contracts';

const BASIS_POINTS = 10_000;

const SCOPE_ATTRIBUTE = {
	'physical-damage': 'might',
	'magical-damage': 'spirit',
	'maximum-health': 'vitality',
	'health-regeneration': 'vitality',
	'maximum-mana': 'spirit',
	'mana-regeneration': 'spirit',
	'equipment-load': 'might',
	readiness: 'agility',
	movement: 'agility',
	evasion: 'agility'
} as const satisfies Readonly<Record<AttributeModifierScope, keyof CombatAttributes>>;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function divideHalfUp(numerator: bigint, denominator: bigint): number {
	return Number((numerator + denominator / 2n) / denominator);
}

export function scaleByBasisPoints(value: number, basisPoints: number): number {
	if (!Number.isInteger(value) || value < 0 || !Number.isInteger(basisPoints) || basisPoints < 0) {
		throw new Error('Basis-point scaling requires nonnegative integers');
	}
	return divideHalfUp(BigInt(value) * BigInt(basisPoints), BigInt(BASIS_POINTS));
}

export function effectiveAttribute(
	intrinsic: number,
	modifierInputs: readonly AttributeModifier[],
	scope: AttributeModifierScope,
	rules: CombatRulesV1
): number {
	if (!Number.isInteger(intrinsic) || intrinsic < 0)
		throw new Error('Intrinsic attribute must be a nonnegative integer');
	const attribute = SCOPE_ATTRIBUTE[scope];
	const modifiers = modifierInputs
		.map((modifier) => AttributeModifierSchema.parse(modifier))
		.filter((modifier) => modifier.scope === scope && modifier.attribute === attribute);
	const flat = modifiers
		.filter((modifier) => modifier.stackingRule === 'additive-flat')
		.reduce((total, modifier) => total + modifier.value, 0);
	const basisPoints = modifiers
		.filter((modifier) => modifier.stackingRule === 'additive-basis-points')
		.reduce((total, modifier) => total + modifier.value, 0);
	let effective = intrinsic;
	for (const stackingRule of rules.attributes.modifierStackingOrder) {
		effective =
			stackingRule === 'additive-flat'
				? effective + flat
				: scaleByBasisPoints(effective, Math.max(0, BASIS_POINTS + basisPoints));
		effective = clamp(
			effective,
			rules.attributes.effectiveMinimum,
			rules.attributes.effectiveMaximum
		);
	}
	return effective;
}

export function namedResistanceReduction(
	tags: readonly DamageTag[],
	grantInputs: readonly ResistanceGrantReceipt[],
	rules: CombatRulesV1
): number {
	const namedTags = new Set(tags.filter((tag) => tag !== 'physical' && tag !== 'magical'));
	const total = grantInputs
		.map((grant) => ResistanceGrantReceiptSchema.parse(grant))
		.filter((grant) => namedTags.has(grant.tag))
		.reduce((sum, grant) => sum + grant.basisPoints, 0);
	return Math.min(total, rules.resistance.capBasisPoints);
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
