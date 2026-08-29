import { describe, expect, it } from 'vitest';

import {
	LEGACY_CHARACTER_GENERATION_VERSION,
	PACK_TWO_CHARACTER_GENERATION_VERSION,
	PACK_TWO_PILOT_SEEDS,
	VISUAL_CHARACTER_GENERATION_VERSION,
	canonicalJson,
	chooseFirstDestination,
	generateCharacterDraft,
	generatePackTwoPilot,
	hashManifest,
	recipeAtMinimumRarity,
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

	it('keeps human-v1 manifests byte-stable after later versions become current', async () => {
		const legacy = await generateCharacterDraft(
			recipeFromSeed('ember-01', LEGACY_CHARACTER_GENERATION_VERSION)
		);

		expect(legacy.manifest.generationVersion).toBe('human-v1');
		expect(legacy.manifest.physiology).toBeUndefined();
		expect(legacy.manifestHash).toBe(
			'3bf119dcae88f8c72c8eb2f0223a36ee43c03b054b1a396649f08bd1d09300f9'
		);
	});

	it('keeps the visual human-v2 manifests byte-stable after name expansion', async () => {
		const [mara, remy] = await Promise.all([
			generateCharacterDraft(recipeFromSeed('ember-01', VISUAL_CHARACTER_GENERATION_VERSION)),
			generateCharacterDraft(recipeFromSeed('hearth-02', VISUAL_CHARACTER_GENERATION_VERSION))
		]);

		expect(mara.manifestHash).toBe(
			'a87292d405df053b8dee55fb4b516519419538e11f90e4e2033017997dfbb212'
		);
		expect(remy.manifestHash).toBe(
			'135bf46fb99b843a74b2e564be4b2eb6d85131cdeab441ea8867cd4b57e574ec'
		);
	});

	it('keeps human-v3 manifests byte-stable after Pack 2 becomes available', async () => {
		const [ember, cohort] = await Promise.all([
			generateCharacterDraft(recipeFromSeed('ember-01')),
			generateCharacterDraft(recipeFromSeed('cohort-0'))
		]);

		expect(ember.manifest.generationVersion).toBe('human-v3');
		expect(ember.manifestHash).toBe(
			'0fb2a131596cf063839bf6946f15844a2b748c5578215c4ffcbc69c8a36c8a0a'
		);
		expect(cohort.manifestHash).toBe(
			'810c16959d6d711c7a211e3d9f94106ee1af38b0997428de10992c0eedc8ef62'
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
		expect(
			new Set(drafts.slice(0, 100).map((draft) => draft.manifest.displayName)).size
		).toBeGreaterThan(90);
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

	it('crosses Pack 2 height, build, proportions, presentation, and visual role independently', async () => {
		const drafts = await Promise.all(
			Array.from({ length: 1_000 }, (_, index) =>
				generateCharacterDraft(
					recipeFromSeed(`pack-two-cohort-${index}`, PACK_TWO_CHARACTER_GENERATION_VERSION)
				)
			)
		);
		const builds = ['wiry', 'lean', 'soft', 'athletic', 'sturdy', 'powerful'] as const;
		const heightBands = ['short', 'medium', 'tall', 'exceptional'] as const;
		const proportionProfiles = ['compact', 'balanced', 'long-limbed', 'long-torso'] as const;
		const presentations = ['feminine', 'masculine', 'androgynous'] as const;

		expect(drafts.every((draft) => draft.manifest.generationVersion === 'human-v4')).toBe(true);
		expect(new Set(drafts.map((draft) => draft.manifest.bodyBuild))).toEqual(new Set(builds));
		expect(new Set(drafts.map((draft) => draft.manifest.physiology?.heightBand))).toEqual(
			new Set(heightBands)
		);
		expect(new Set(drafts.map((draft) => draft.manifest.physiology?.proportions?.profile))).toEqual(
			new Set(proportionProfiles)
		);
		expect(new Set(drafts.map((draft) => draft.manifest.visualRole)).size).toBe(8);
		expect(new Set(drafts.map((draft) => draft.manifest.phenotype.hairSilhouette)).size).toBe(7);
		expect(Math.min(...drafts.map((draft) => draft.manifest.heightCm))).toBe(150);
		expect(Math.max(...drafts.map((draft) => draft.manifest.heightCm))).toBe(205);

		for (const draft of drafts) {
			expect(draft.manifest.apparentAgeBand).toBeDefined();
			expect(draft.manifest.visualRole).toBeDefined();
			expect(draft.manifest.phenotype.hairSilhouette).toBeDefined();
			expect(draft.manifest.phenotype.grooming).toBeDefined();
			expect(draft.manifest.phenotype.facialHair).toBeDefined();
			expect(draft.manifest.physiology?.proportions).toBeDefined();
		}

		for (const presentation of presentations) {
			const cohort = drafts.filter((draft) => draft.manifest.genderPresentation === presentation);
			for (const build of builds) {
				expect(cohort.filter((draft) => draft.manifest.bodyBuild === build).length).toBeGreaterThan(
					30
				);
			}
			for (const band of heightBands) {
				expect(
					cohort.filter((draft) => draft.manifest.physiology?.heightBand === band).length
				).toBeGreaterThan(20);
			}
			expect(
				new Set(cohort.map((draft) => draft.manifest.rarityStars)).size
			).toBeGreaterThanOrEqual(3);
		}

		for (const skinTone of new Set(drafts.map((draft) => draft.manifest.phenotype.skinTone))) {
			expect(
				new Set(
					drafts
						.filter((draft) => draft.manifest.phenotype.skinTone === skinTone)
						.map((draft) => draft.manifest.bodyBuild)
				).size
			).toBe(builds.length);
		}
	});

	it('locks the six-human Pack 2 visual pilot to a deliberate cross-section', async () => {
		const pilot = await generatePackTwoPilot();
		const manifests = pilot.map((draft) => draft.manifest);

		expect(PACK_TWO_PILOT_SEEDS).toHaveLength(6);
		expect(pilot.map((draft) => draft.manifestHash)).toEqual([
			'a956efa2c469631198800eaeb2cd0dd3abfc14b2c1ad14522f39def3de65071a',
			'238108f3c85f44ab008b1d47396e2183972fcfc46d82b076ae035487f9cc8e0d',
			'369bc4ceae6e301cb96ebcb929be298f094c02ba1ba52517ba1d8b05f211f89d',
			'98cda01d112db3888b1ee08bb35989b07d9e4d2026c82f92774056e9bd67804c',
			'7aef986aba4a4d20a5fc7e9e34b01182969a34af9e5e822d54027bdb9cb2a178',
			'7bff542bd71c23cc9e4616d727a9fe29a4ecf98063524d9787dc4c1a1b13c183'
		]);
		expect(manifests.map((manifest) => manifest.genderPresentation).sort()).toEqual([
			'androgynous',
			'androgynous',
			'feminine',
			'feminine',
			'masculine',
			'masculine'
		]);
		expect(manifests.map((manifest) => manifest.physiology?.heightBand).sort()).toEqual([
			'medium',
			'medium',
			'short',
			'short',
			'tall',
			'tall'
		]);
		expect(new Set(manifests.map((manifest) => manifest.bodyBuild)).size).toBeGreaterThanOrEqual(4);
		expect(new Set(manifests.map((manifest) => manifest.physiology?.proportions?.profile))).toEqual(
			new Set(['balanced', 'compact', 'long-limbed', 'long-torso'])
		);
		expect(new Set(manifests.map((manifest) => manifest.phenotype.hairSilhouette)).size).toBe(6);
		expect(new Set(manifests.map((manifest) => manifest.rarityStars))).toEqual(new Set([1, 2, 3]));
		expect(
			manifests.some(
				(manifest) =>
					manifest.genderPresentation === 'feminine' && manifest.bodyBuild === 'powerful'
			)
		).toBe(true);
		expect(manifests.some((manifest) => manifest.bodyBuild === 'soft')).toBe(true);
		expect(new Set(manifests.map((manifest) => manifest.visualRole)).size).toBeGreaterThanOrEqual(
			3
		);
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

	it('qualifies forge recipes without changing non-rarity channels', async () => {
		const base = recipeFromSeed('forge-special-01');
		const qualified = recipeAtMinimumRarity(base, 3);
		const draft = await generateCharacterDraft(qualified);

		expect(draft.manifest.rarityStars).toBeGreaterThanOrEqual(3);
		expect(qualified.seed).toBe(base.seed);
		expect(qualified.generationVersion).toBe(base.generationVersion);
		expect({ ...qualified.cursors, rarity: base.cursors.rarity }).toEqual(base.cursors);
		expect(qualified.cursors.rarity).toBeGreaterThanOrEqual(base.cursors.rarity);
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
