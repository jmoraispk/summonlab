import {
	CharacterCapabilityProfileV1Schema,
	PermanentAttributeGrowthSchema,
	type CharacterCapabilityProfileV1,
	type CombatAttributes,
	type PermanentAttributeGrowth
} from '@summonlab/contracts';
import type { CraftQuality, ProgressionRulesV1 } from '@summonlab/content';

const BASIS_POINTS = 10_000;

export type CraftExperienceInput = Readonly<{
	difficultyBand: number;
	ingredientRarityBand: number;
	quality: CraftQuality;
	firstSuccess: boolean;
	priorCompletions: number;
}>;

export type CombatExperienceInput = Readonly<{
	difficultyBand: number;
	objectiveCompleted: boolean;
	firstClear: boolean;
	priorCompletions: number;
}>;

function assertNonnegativeInteger(value: number, label: string): void {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${label} must be a nonnegative safe integer`);
	}
}

function bandIndex(value: number, label: string): number {
	if (!Number.isInteger(value) || value < 1 || value > 7) {
		throw new RangeError(`${label} must be an integer from 1 through 7`);
	}
	return value - 1;
}

function repetitionFactor(priorCompletions: number, factors: readonly number[]): number {
	assertNonnegativeInteger(priorCompletions, 'priorCompletions');
	return factors[Math.min(priorCompletions, factors.length - 1)]!;
}

export function multiplyBasisPoints(value: number, basisPoints: number): number {
	assertNonnegativeInteger(value, 'value');
	assertNonnegativeInteger(basisPoints, 'basisPoints');
	const result = Number(
		(BigInt(value) * BigInt(basisPoints) + BigInt(BASIS_POINTS / 2)) / BigInt(BASIS_POINTS)
	);
	if (!Number.isSafeInteger(result))
		throw new RangeError('basis-point result exceeds safe integers');
	return result;
}

export function awakeningTier(level: number): number {
	if (!Number.isInteger(level) || level < 1 || level > 999) throw new RangeError('level');
	return Math.floor(level / 100);
}

export function intrinsicAttributes(
	profileInput: CharacterCapabilityProfileV1,
	growthInput: PermanentAttributeGrowth
): CombatAttributes {
	const profile = CharacterCapabilityProfileV1Schema.parse(profileInput);
	const growth = PermanentAttributeGrowthSchema.parse(growthInput);
	return {
		strength: profile.attributes.strength + growth.strength,
		agility: profile.attributes.agility + growth.agility,
		vitality: profile.attributes.vitality + growth.vitality,
		magic: profile.attributes.magic + growth.magic
	};
}

export function attributePowerMilli(
	attribute: number,
	level: number,
	rules: ProgressionRulesV1
): number {
	assertNonnegativeInteger(attribute, 'attribute');
	const result = attribute * rules.powerPerAttributeMilli[awakeningTier(level)]!;
	if (!Number.isSafeInteger(result)) throw new RangeError('attribute power exceeds safe integers');
	return result;
}

export function maximumHealth(vitality: number, level: number, rules: ProgressionRulesV1): number {
	assertNonnegativeInteger(vitality, 'vitality');
	const result = vitality * rules.healthPerVitality[awakeningTier(level)]!;
	if (!Number.isSafeInteger(result)) throw new RangeError('maximum Health exceeds safe integers');
	return result;
}

export function craftExperience(input: CraftExperienceInput, rules: ProgressionRulesV1): number {
	const difficultyIndex = bandIndex(input.difficultyBand, 'difficultyBand');
	const rarityIndex = bandIndex(input.ingredientRarityBand, 'ingredientRarityBand');
	const qualityBasisPoints = rules.crafting.qualityBps[input.quality];
	if (qualityBasisPoints === undefined) throw new RangeError('quality');
	let experience = rules.crafting.difficultyExperience[difficultyIndex]!;
	experience = multiplyBasisPoints(experience, rules.crafting.ingredientRarityBps[rarityIndex]!);
	experience = multiplyBasisPoints(experience, qualityBasisPoints);
	if (input.firstSuccess) {
		experience = multiplyBasisPoints(experience, rules.crafting.firstSuccessBps);
	}
	experience = multiplyBasisPoints(
		experience,
		repetitionFactor(input.priorCompletions, rules.crafting.repetitionBps)
	);
	return Math.max(rules.crafting.minimumExperience, experience);
}

export function combatExperience(input: CombatExperienceInput, rules: ProgressionRulesV1): number {
	const difficultyIndex = bandIndex(input.difficultyBand, 'difficultyBand');
	let experience =
		rules.combat.difficultyExperience[difficultyIndex]! +
		(input.objectiveCompleted ? rules.combat.objectiveBonus[difficultyIndex]! : 0);
	if (input.firstClear) experience = multiplyBasisPoints(experience, rules.combat.firstClearBps);
	experience = multiplyBasisPoints(
		experience,
		repetitionFactor(input.priorCompletions, rules.combat.repetitionBps)
	);
	return Math.max(rules.combat.minimumExperience, experience);
}
