import { describe, expect, it } from 'vitest';

import {
	LEGACY_CHARACTER_GENERATION_VERSION,
	canonicalJson,
	chooseFirstDestination,
	generateCharacterDraft,
	hashManifest,
	recipeFromSeed,
	rerollRecipe
} from './index.js';

describe('deterministic character generation', () => {
	it('keeps manifest bytes, hash, mind, and first choice stable for the same recipe', async () => {
		const recipe = recipeFromSeed('ember-01');
		const [left, right] = await Promise.all([
			generateCharacterDraft(recipe),
			generateCharacterDraft(recipe)
		]);

		expect(canonicalJson(left.manifest)).toBe(canonicalJson(right.manifest));
		expect(left.manifestHash).toBe(right.manifestHash);
		expect(left.mind).toEqual(right.mind);
		expect(chooseFirstDestination(left, 'autonomous', '')).toEqual(
			chooseFirstDestination(right, 'autonomous', '')
		);
		expect(await hashManifest(left.manifest)).toBe(left.manifestHash);
	});

	it('keeps human-v1 manifests byte-stable after human-v2 becomes current', async () => {
		const legacy = await generateCharacterDraft(
			recipeFromSeed('ember-01', LEGACY_CHARACTER_GENERATION_VERSION)
		);

		expect(legacy.manifest.generationVersion).toBe('human-v1');
		expect(legacy.manifest.physiology).toBeUndefined();
		expect(legacy.manifestHash).toBe(
			'3bf119dcae88f8c72c8eb2f0223a36ee43c03b054b1a396649f08bd1d09300f9'
		);
	});

	it('makes different seeds meaningfully distinct while keeping every summon adult', async () => {
		const drafts = await Promise.all(
			Array.from({ length: 1_000 }, (_, index) =>
				generateCharacterDraft(recipeFromSeed(`cohort-${index}`))
			)
		);
		const identities = new Set(
			drafts.map((draft) =>
				[
					draft.manifest.displayName,
					draft.manifest.heightCm,
					draft.manifest.phenotype.skinTone,
					draft.manifest.phenotype.hairStyle,
					draft.manifestHash
				].join('|')
			)
		);

		expect(identities.size).toBeGreaterThan(990);
		expect(drafts.every((draft) => draft.manifest.adultAge >= 18)).toBe(true);
		expect(drafts.every((draft) => draft.manifest.adultAge <= 42)).toBe(true);
		expect(new Set(drafts.map((draft) => draft.mind.dailyHabit)).size).toBe(6);
		expect(new Set(drafts.map((draft) => draft.manifest.phenotype.skinTone)).size).toBe(7);
		expect(new Set(drafts.map((draft) => draft.manifest.phenotype.hairTexture)).size).toBe(5);
		expect(new Set(drafts.map((draft) => draft.manifest.genderPresentation)).size).toBe(3);
		expect(drafts.every((draft) => draft.manifest.physiology !== undefined)).toBe(true);
		expect(new Set(drafts.map((draft) => draft.manifest.physiology?.limbProportion)).size).toBe(3);
		expect(Math.min(...drafts.map((draft) => draft.manifest.heightCm))).toBeLessThanOrEqual(156);
		expect(Math.max(...drafts.map((draft) => draft.manifest.heightCm))).toBeGreaterThanOrEqual(198);
		const meanAge =
			drafts.reduce((total, draft) => total + draft.manifest.adultAge, 0) / drafts.length;
		expect(meanAge).toBeGreaterThan(24);
		expect(meanAge).toBeLessThan(29);
		for (const presentation of ['feminine', 'masculine', 'androgynous'] as const) {
			expect(
				drafts.filter((draft) => draft.manifest.genderPresentation === presentation).length
			).toBeGreaterThan(250);
		}
	});

	it('rerolls only unlocked generation channels', async () => {
		const originalRecipe = recipeFromSeed('lock-test');
		const original = await generateCharacterDraft(originalRecipe);
		const rerolled = await generateCharacterDraft(
			rerollRecipe(originalRecipe, new Set(['identity', 'body', 'features', 'styling', 'rarity']))
		);

		expect(rerolled.manifest).toEqual(original.manifest);
		expect(rerolled.manifestHash).toBe(original.manifestHash);
		expect(rerolled.mind).not.toEqual(original.mind);

		const appearanceRerolled = await generateCharacterDraft(
			rerollRecipe(originalRecipe, new Set(['identity', 'body', 'styling', 'mind', 'rarity']))
		);
		expect(appearanceRerolled.mind).toEqual(original.mind);
		expect(appearanceRerolled.manifest.phenotype).not.toEqual(original.manifest.phenotype);
	});

	it('lets an explicit direction influence scripted policy without changing legal options', async () => {
		const draft = await generateCharacterDraft(recipeFromSeed('direction-test'));
		const kitchen = chooseFirstDestination(
			draft,
			'autonomous',
			'Go eat and talk to people in the kitchen.'
		);
		const training = chooseFirstDestination(
			draft,
			'autonomous',
			'Train, exercise, and prepare to fight in the tower.'
		);

		expect(kitchen.destination).toBe('kitchen');
		expect(training.destination).toBe('training-ground');
		expect(kitchen.source).toBe('directed');
	});
});
