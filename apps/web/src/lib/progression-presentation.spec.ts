import { PROGRESSION_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { presentHeroProgression } from './progression-presentation.js';

function heroAt(level: number) {
	return {
		capabilityProfile: {
			attributes: { strength: 11, agility: 12, vitality: 13, magic: 14 }
		},
		progression: {
			stars: 4,
			level,
			experience: 321,
			unallocatedAttributePoints: 7,
			permanentGrowth: { strength: 10, agility: 20, vitality: 30, magic: 40 }
		}
	};
}

describe('hero progression presentation', () => {
	it('projects the canonical sheet order, full names, and complete intrinsic values', () => {
		const presentation = presentHeroProgression(heroAt(100), PROGRESSION_RULES_V1);

		expect(presentation.attributes.map(({ abbreviation }) => abbreviation)).toEqual([
			'STR',
			'AGI',
			'VIT',
			'MAG'
		]);
		expect(presentation.attributes.map(({ fullName }) => fullName)).toEqual([
			'Strength',
			'Agility',
			'Vitality',
			'Magic'
		]);
		expect(presentation.attributes.map(({ value }) => value)).toEqual([21, 32, 43, 54]);
		expect(presentation).toMatchObject({
			level: 100,
			stars: 4,
			experience: 321,
			awakeningTier: 1,
			unallocatedAttributePoints: 7,
			powerPerStrengthMilli: 1_200,
			powerPerMagicMilli: 1_200,
			healthPerVitality: 6
		});
	});

	it('labels the 99/100 boundary and reaches a five-times tier without promotion state', () => {
		const before = presentHeroProgression(heroAt(99), PROGRESSION_RULES_V1);
		const awakened = presentHeroProgression(heroAt(100), PROGRESSION_RULES_V1);
		const apex = presentHeroProgression(heroAt(900), PROGRESSION_RULES_V1);

		expect(before).toMatchObject({ awakeningTier: 0, powerPerStrengthMilli: 1_000 });
		expect(awakened).toMatchObject({ awakeningTier: 1, powerPerStrengthMilli: 1_200 });
		expect(apex).toMatchObject({ awakeningTier: 9, powerPerStrengthMilli: 5_000 });
		expect(JSON.stringify(apex).toLowerCase()).not.toMatch(/currentstars|promotion|body|mind/u);
	});
});
