import type { ProgressionRulesV1 } from '@summonlab/content';
import { awakeningTier } from '@summonlab/engine';

type AttributeValues = Readonly<{
	strength: number;
	agility: number;
	vitality: number;
	magic: number;
}>;

export type HeroProgressionPresentationSource = Readonly<{
	capabilityProfile: Readonly<{ attributes: AttributeValues }>;
	progression: Readonly<{
		stars: number;
		level: number;
		experience: number;
		unallocatedAttributePoints: number;
		permanentGrowth: AttributeValues;
	}>;
}>;

export type HeroProgressionPresentation = Readonly<{
	level: number;
	stars: number;
	experience: number;
	awakeningTier: number;
	unallocatedAttributePoints: number;
	attributes: readonly [
		{ key: 'strength'; abbreviation: 'STR'; fullName: 'Strength'; value: number },
		{ key: 'agility'; abbreviation: 'AGI'; fullName: 'Agility'; value: number },
		{ key: 'vitality'; abbreviation: 'VIT'; fullName: 'Vitality'; value: number },
		{ key: 'magic'; abbreviation: 'MAG'; fullName: 'Magic'; value: number }
	];
	powerPerStrengthMilli: number;
	powerPerMagicMilli: number;
	healthPerVitality: number;
}>;

export function presentHeroProgression(
	hero: HeroProgressionPresentationSource,
	rules: ProgressionRulesV1
): HeroProgressionPresentation {
	const tier = awakeningTier(hero.progression.level);
	const value = (key: keyof AttributeValues) =>
		hero.capabilityProfile.attributes[key] + hero.progression.permanentGrowth[key];
	const powerPerAttributeMilli = rules.powerPerAttributeMilli[tier]!;

	return {
		level: hero.progression.level,
		stars: hero.progression.stars,
		experience: hero.progression.experience,
		awakeningTier: tier,
		unallocatedAttributePoints: hero.progression.unallocatedAttributePoints,
		attributes: [
			{ key: 'strength', abbreviation: 'STR', fullName: 'Strength', value: value('strength') },
			{ key: 'agility', abbreviation: 'AGI', fullName: 'Agility', value: value('agility') },
			{ key: 'vitality', abbreviation: 'VIT', fullName: 'Vitality', value: value('vitality') },
			{ key: 'magic', abbreviation: 'MAG', fullName: 'Magic', value: value('magic') }
		],
		powerPerStrengthMilli: powerPerAttributeMilli,
		powerPerMagicMilli: powerPerAttributeMilli,
		healthPerVitality: rules.healthPerVitality[tier]!
	};
}
