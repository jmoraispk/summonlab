import {
	CharacterCapabilityProfileV1Schema,
	LearningContextSchema,
	LearningEvidenceSchema,
	LearningGainReceiptSchema,
	RegenerationContextSchema,
	type CharacterCapabilityProfileV1,
	type CombatAttributes,
	type CombatRulesV1,
	type DamageChannel,
	type LearningContext,
	type LearningEvidence,
	type LearningGainReceipt,
	type RegenerationContext
} from '@summonlab/contracts';

import { divideHalfUp, scaleByBasisPoints } from '../../core/capability.js';

export {
	effectiveAttribute,
	intrinsicAttributes,
	maximumHealth,
	maximumMana,
	namedResistanceReduction
} from '../../core/capability.js';

const BASIS_POINTS = 10_000;

function assertNonnegativeInteger(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0)
		throw new Error(`${label} must be a nonnegative integer`);
}

function interpolateFactor(score: number, minimum: number, maximum: number): number {
	return minimum + divideHalfUp(BigInt(score) * BigInt(maximum - minimum), 100n);
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
			? attributes.strength * rules.damage.physicalBasisPointsPerStrength
			: attributes.magic * rules.damage.magicalBasisPointsPerMagic;
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
	magic: number,
	contextInput: RegenerationContext,
	rules: CombatRulesV1
): number {
	assertNonnegativeInteger(magic, 'Magic');
	const context = RegenerationContextSchema.parse(contextInput);
	if (context.downed || context.injuryRepair) return 0;
	const magicBonus = divideHalfUp(
		BigInt(rules.mana.regenerationMagicBonus) * BigInt(magic),
		BigInt(magic + rules.mana.regenerationSaturationConstant)
	);
	const recovery = rules.mana.regenerationBase + magicBonus;
	return context.mode === 'combat'
		? scaleByBasisPoints(recovery, rules.mana.combatRecoveryBasisPoints)
		: recovery;
}

export function armourReduction(armour: number, penetration: number, rules: CombatRulesV1): number {
	assertNonnegativeInteger(armour, 'Armour');
	assertNonnegativeInteger(penetration, 'Penetration');
	const effectiveArmour = Math.max(0, armour - penetration);
	if (effectiveArmour === 0) return 0;
	return Math.min(
		rules.armour.maximumGeneralReductionBasisPoints,
		divideHalfUp(
			BigInt(effectiveArmour) * BigInt(BASIS_POINTS),
			BigInt(effectiveArmour + rules.armour.curveConstant)
		)
	);
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
