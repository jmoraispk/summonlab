import {
	AttributeModifierSchema,
	CharacterCapabilityProfileV1Schema,
	LearningContextSchema,
	LearningEvidenceSchema,
	LearningGainReceiptSchema,
	RegenerationContextSchema,
	ResistanceGrantReceiptSchema,
	type AttributeModifier,
	type AttributeModifierScope,
	type CharacterCapabilityProfileV1,
	type CombatAttributes,
	type CombatRulesV1,
	type DamageChannel,
	type DamageTag,
	type LearningContext,
	type LearningEvidence,
	type LearningGainReceipt,
	type RegenerationContext,
	type ResistanceGrantReceipt
} from '@summonlab/contracts';

export { intrinsicAttributes, maximumHealth, maximumMana } from '../../core/capability.js';

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

function assertNonnegativeInteger(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0)
		throw new Error(`${label} must be a nonnegative integer`);
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function divideHalfUp(numerator: bigint, denominator: bigint): number {
	return Number((numerator + denominator / 2n) / denominator);
}

function scaleByBasisPoints(value: number, basisPoints: number): number {
	assertNonnegativeInteger(value, 'Basis-point value');
	assertNonnegativeInteger(basisPoints, 'Basis-point factor');
	return divideHalfUp(BigInt(value) * BigInt(basisPoints), BigInt(BASIS_POINTS));
}

function interpolateFactor(score: number, minimum: number, maximum: number): number {
	return minimum + divideHalfUp(BigInt(score) * BigInt(maximum - minimum), 100n);
}

export function effectiveAttribute(
	intrinsic: number,
	modifierInputs: readonly AttributeModifier[],
	scope: AttributeModifierScope,
	rules: CombatRulesV1
): number {
	assertNonnegativeInteger(intrinsic, 'Intrinsic attribute');
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

export function attributeScaledMagnitude(
	baseMagnitude: number,
	channel: DamageChannel,
	attributes: CombatAttributes,
	rules: CombatRulesV1
): number {
	assertNonnegativeInteger(baseMagnitude, 'Base magnitude');
	const contribution =
		channel === 'physical'
			? attributes.might * rules.damage.physicalBasisPointsPerMight
			: attributes.spirit * rules.damage.magicalBasisPointsPerSpirit;
	return scaleByBasisPoints(baseMagnitude, BASIS_POINTS + contribution);
}

export function healthRegeneration(
	vitality: number,
	contextInput: RegenerationContext,
	rules: CombatRulesV1
): number {
	assertNonnegativeInteger(vitality, 'Vitality');
	const context = RegenerationContextSchema.parse(contextInput);
	if (context.downed || context.injuryRepair) return 0;
	if (
		context.mode === 'combat' &&
		context.ticksSinceDamage !== null &&
		context.ticksSinceDamage < rules.health.combatRegenerationDelayTicks
	) {
		return 0;
	}
	const safeRestRecovery =
		rules.health.safeRestRegenerationBase +
		Math.floor(vitality / rules.health.safeRestRegenerationVitalityDivisor);
	return context.mode === 'combat'
		? scaleByBasisPoints(safeRestRecovery, rules.health.combatRecoveryBasisPoints)
		: safeRestRecovery;
}

export function manaRegeneration(
	spirit: number,
	contextInput: RegenerationContext,
	rules: CombatRulesV1
): number {
	assertNonnegativeInteger(spirit, 'Spirit');
	const context = RegenerationContextSchema.parse(contextInput);
	if (context.downed || context.injuryRepair) return 0;
	const spiritBonus = divideHalfUp(
		BigInt(rules.mana.regenerationSpiritBonus) * BigInt(spirit),
		BigInt(spirit + rules.mana.regenerationSaturationConstant)
	);
	const recovery = rules.mana.regenerationBase + spiritBonus;
	return context.mode === 'combat'
		? scaleByBasisPoints(recovery, rules.mana.combatRecoveryBasisPoints)
		: recovery;
}

export function armourReduction(armour: number, penetration: number, rules: CombatRulesV1): number {
	assertNonnegativeInteger(armour, 'Armour');
	assertNonnegativeInteger(penetration, 'Penetration');
	const effectiveArmour = Math.max(0, armour - penetration);
	if (effectiveArmour === 0) return 0;
	return divideHalfUp(
		BigInt(effectiveArmour) * BigInt(BASIS_POINTS),
		BigInt(effectiveArmour + rules.armour.curveConstant)
	);
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

export function learningGain(
	evidenceInput: LearningEvidence,
	profileInput: CharacterCapabilityProfileV1,
	contextInput: LearningContext,
	rules: CombatRulesV1
): LearningGainReceipt {
	const evidence = LearningEvidenceSchema.parse(evidenceInput);
	const profile = CharacterCapabilityProfileV1Schema.parse(profileInput);
	const context = LearningContextSchema.parse(contextInput);
	const cognitiveFactorBasisPoints = evidence.comprehensionHeavy
		? interpolateFactor(
				profile.learning.cognitiveLearningScore,
				rules.learning.cognitiveMinimumBasisPoints,
				rules.learning.cognitiveMaximumBasisPoints
			)
		: BASIS_POINTS;
	const domainAptitudeFactorBasisPoints = interpolateFactor(
		profile.learning.domainAptitudes[evidence.domain],
		rules.learning.domainMinimumBasisPoints,
		rules.learning.domainMaximumBasisPoints
	);
	const factors = [
		cognitiveFactorBasisPoints,
		domainAptitudeFactorBasisPoints,
		context.teachingQualityBasisPoints,
		context.facilityQualityBasisPoints,
		context.motivationBasisPoints,
		context.conditionBasisPoints,
		context.varietyBasisPoints,
		context.repetitionDecayBasisPoints
	];
	const numerator = factors.reduce(
		(product, factor) => product * BigInt(factor),
		BigInt(evidence.basePractice)
	);
	const denominator = BigInt(BASIS_POINTS) ** BigInt(factors.length);
	return LearningGainReceiptSchema.parse({
		evidenceId: evidence.evidenceId,
		domain: evidence.domain,
		basePractice: evidence.basePractice,
		comprehensionHeavy: evidence.comprehensionHeavy,
		cognitiveFactorBasisPoints,
		domainAptitudeFactorBasisPoints,
		context,
		gainedPractice: divideHalfUp(numerator, denominator),
		rulesVersion: rules.rulesVersion
	});
}
