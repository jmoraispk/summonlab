import { describe, expect, it } from 'vitest';

import {
	generateCharacterDraft,
	generateLegacySummonableCharacterDraft,
	generateSummonableCharacterDraft,
	generateSummonableCompany,
	listSummonableHeroDrafts,
	recipeFromSeed
} from './index.js';

const capabilityScores = (draft: Awaited<ReturnType<typeof generateSummonableCharacterDraft>>) => [
	...Object.values(draft.capabilityProfile.attributes),
	draft.capabilityProfile.learning.cognitiveLearningScore,
	...Object.values(draft.capabilityProfile.learning.domainAptitudes)
];

describe('approved summonable hero pool', () => {
	it('contains the 200 unique approved native one-star identities', () => {
		const drafts = listSummonableHeroDrafts();

		expect(drafts).toHaveLength(200);
		expect(new Set(drafts.map((draft) => draft.manifest.characterId)).size).toBe(200);
		expect(new Set(drafts.map((draft) => draft.manifest.displayName)).size).toBe(200);
		expect(drafts.filter((draft) => draft.manifest.genderPresentation === 'feminine')).toHaveLength(
			100
		);
		expect(
			drafts.filter((draft) => draft.manifest.genderPresentation === 'masculine')
		).toHaveLength(100);
		expect(drafts.every((draft) => draft.manifest.rarityStars === 1)).toBe(true);
		expect(
			drafts.every((draft) => draft.manifest.assetProvenance === 'approved-generated-roster')
		).toBe(true);
	});

	it('selects a stable literal identity from a player seed', async () => {
		const recipe = recipeFromSeed('campaign-alpha');
		const [left, right] = await Promise.all([
			generateSummonableCharacterDraft(recipe),
			generateSummonableCharacterDraft(recipe)
		]);

		expect(left.manifest.displayName).toBe('Kelu Grelun');
		expect(right).toEqual(left);
	});

	it('generates the same bounded v2 mind and capability profile from the same recipe', async () => {
		const recipe = recipeFromSeed('capability-profile-alpha');
		const [left, right] = await Promise.all([
			generateSummonableCharacterDraft(recipe),
			generateSummonableCharacterDraft(recipe)
		]);

		expect(left.mind).toEqual(right.mind);
		expect(left.capabilityProfile).toEqual(right.capabilityProfile);
		expect(left.mind).not.toHaveProperty('aptitudes');
		expect(Object.keys(left.capabilityProfile.attributes).sort()).toEqual([
			'agility',
			'might',
			'spirit',
			'vitality'
		]);
		expect(
			Object.values(left.capabilityProfile.attributes).every((score) => score >= 1 && score <= 100)
		).toBe(true);
		expect(
			capabilityScores(left)
				.slice(4)
				.every((score) => score >= 0 && score <= 100)
		).toBe(true);
	});

	it('requires private capability entropy to reproduce hidden learning scores', async () => {
		const recipe = recipeFromSeed('public-recipe-cannot-recover-learning');
		const [left, replayed, differentSecret] = await Promise.all([
			generateSummonableCharacterDraft(recipe, {
				capabilityEntropy: 'a'.repeat(64)
			}),
			generateSummonableCharacterDraft(recipe, {
				capabilityEntropy: 'a'.repeat(64)
			}),
			generateSummonableCharacterDraft(recipe, {
				capabilityEntropy: 'b'.repeat(64)
			})
		]);

		expect(replayed).toEqual(left);
		expect(differentSecret.manifest).toEqual(left.manifest);
		expect(differentSecret.manifestHash).toBe(left.manifestHash);
		expect(differentSecret.capabilityProfile).not.toEqual(left.capabilityProfile);
	});

	it('keeps the historical summonable generator available for exact v1 replay', async () => {
		const characters = await import('./index.js');
		expect(characters).toHaveProperty('generateLegacySummonableCharacterDraft');
		const generateLegacy = characters.generateLegacySummonableCharacterDraft;
		expect(generateLegacy).toBeTypeOf('function');
		if (!generateLegacy) throw new Error('Expected the legacy generator export');

		const recipe = recipeFromSeed('campaign-alpha');
		const [legacy, current] = await Promise.all([
			generateLegacy(recipe),
			generateSummonableCharacterDraft(recipe)
		]);
		expect(legacy.manifest.displayName).toBe('Kelu Grelun');
		expect(legacy.mind).toHaveProperty('aptitudes');
		expect(legacy).not.toHaveProperty('capabilityProfile');
		expect(current.manifest).toEqual(legacy.manifest);
		expect(current.manifestHash).toBe(legacy.manifestHash);
	});

	it('selects a deterministic company without replacement', async () => {
		const [left, right] = await Promise.all([
			generateSummonableCompany('hearth-company', 3),
			generateSummonableCompany('hearth-company', 3)
		]);

		expect(left).toEqual(right);
		expect(left).toHaveLength(3);
		expect(new Set(left.map((draft) => draft.manifest.characterId)).size).toBe(3);
	});

	it('replays a stored human-v6 recipe as the same approved identity', async () => {
		const selected = await generateLegacySummonableCharacterDraft(recipeFromSeed('campaign-beta'));
		const replayed = await generateCharacterDraft(selected.recipe);

		expect(selected.manifest.displayName).toBe('Coron Loran');
		expect(replayed).toEqual(selected);
	});
});
