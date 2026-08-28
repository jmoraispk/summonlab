import {
	VISUAL_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeAtMinimumRarity,
	recipeFromSeed
} from '@summonlab/characters';

import type { PageServerLoad } from './$types';

const channelSpecs = [
	{
		id: 'normal',
		label: 'Normal summon',
		minimumStars: 1 as const,
		resonance: 'One ring',
		cost: '1 gate charge',
		detail: 'The broadest starting pool. Every hero can still promote to 7★.',
		heroes: [
			{ recipe: recipeFromSeed('hearth-01:ember'), portraitKey: 'jori-daro' },
			{
				recipe: recipeFromSeed('ember-01', VISUAL_CHARACTER_GENERATION_VERSION),
				portraitKey: 'mara-vey'
			},
			{
				recipe: recipeFromSeed('hearth-02', VISUAL_CHARACTER_GENERATION_VERSION),
				portraitKey: 'remy-nahl'
			}
		]
	},
	{
		id: 'advanced',
		label: 'Advanced summon',
		minimumStars: 2 as const,
		resonance: 'Two rings',
		cost: 'Prototype · cost unset',
		detail: 'Every arrival begins at 2★ or higher, with a level cap of at least 20.',
		heroes: [
			{ recipe: recipeFromSeed('hearth-01:vow'), portraitKey: 'dara-zev' },
			{ recipe: recipeFromSeed('hearth-01:lark'), portraitKey: 'elian-ro' },
			{
				recipe: recipeAtMinimumRarity(recipeFromSeed('forge-advanced-01'), 2),
				portraitKey: 'kavi-nor'
			}
		]
	},
	{
		id: 'special',
		label: 'Special summon',
		minimumStars: 3 as const,
		resonance: 'Three rings',
		cost: 'Prototype · access unset',
		detail: 'Every arrival begins at 3★ or higher. Natural 4★ remains anomalous.',
		heroes: [
			{
				recipe: recipeAtMinimumRarity(recipeFromSeed('forge-special-04'), 3),
				portraitKey: 'kavi-garo'
			},
			{
				recipe: recipeAtMinimumRarity(recipeFromSeed('forge-special-06'), 3),
				portraitKey: 'lio-senn'
			},
			{
				recipe: recipeAtMinimumRarity(recipeFromSeed('forge-special-10'), 3),
				portraitKey: 'noa-kest'
			}
		]
	}
] as const;

export const load: PageServerLoad = async () => ({
	channels: await Promise.all(
		channelSpecs.map(async (channel) => ({
			...channel,
			heroes: await Promise.all(
				channel.heroes.map(async (hero) => ({
					portraitKey: hero.portraitKey,
					draft: await generateCharacterDraft(hero.recipe)
				}))
			)
		}))
	)
});
