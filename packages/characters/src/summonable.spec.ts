import { describe, expect, it } from 'vitest';

import {
	generateCharacterDraft,
	generateSummonableCharacterDraft,
	generateSummonableCompany,
	listSummonableHeroDrafts,
	recipeFromSeed
} from './index.js';

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
		const selected = await generateSummonableCharacterDraft(recipeFromSeed('campaign-beta'));
		const replayed = await generateCharacterDraft(selected.recipe);

		expect(selected.manifest.displayName).toBe('Coron Loran');
		expect(replayed).toEqual(selected);
	});
});
