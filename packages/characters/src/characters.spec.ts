import { describe, expect, it } from 'vitest';

import {
	LEGACY_CHARACTER_GENERATION_VERSION,
	PACK_TWO_CHARACTER_GENERATION_VERSION,
	PACK_TWO_COHORT_SEEDS,
	PACK_TWO_EXPANSION_SEEDS,
	PACK_TWO_PILOT_SEEDS,
	PACK_TWO_ATTIRE_OPTIONS,
	PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION,
	VISUAL_CHARACTER_GENERATION_VERSION,
	canonicalJson,
	chooseFirstDestination,
	generateCharacterDraft,
	generatePackTwoCohort,
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
			'77c69da6cd98dc92376e8da91745b5636be5d8459ee197f4b7fcbf8d82dab0de'
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

	it('systematically varies Pack 2 faces and every clothing slot with coherent combinations', async () => {
		const drafts = await Promise.all(
			Array.from({ length: 2_000 }, (_, index) =>
				generateCharacterDraft(
					recipeFromSeed(
						`pack-two-variation-${index}`,
						PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION
					)
				)
			)
		);
		const manifests = drafts.map((draft) => draft.manifest);

		expect(manifests.every((manifest) => manifest.generationVersion === 'human-v5')).toBe(true);
		for (const slot of Object.keys(PACK_TWO_ATTIRE_OPTIONS) as Array<
			keyof typeof PACK_TWO_ATTIRE_OPTIONS
		>) {
			expect(new Set(manifests.map((manifest) => manifest.attire?.[slot]))).toEqual(
				new Set(PACK_TWO_ATTIRE_OPTIONS[slot])
			);
		}

		expect(new Set(manifests.map((manifest) => manifest.phenotype.faceShape)).size).toBe(10);
		expect(new Set(manifests.map((manifest) => manifest.phenotype.noseProfile)).size).toBe(10);
		expect(
			new Set(manifests.map((manifest) => manifest.phenotype.facialStructure?.eyeShape)).size
		).toBe(8);
		expect(
			new Set(manifests.map((manifest) => manifest.phenotype.facialStructure?.jawShape)).size
		).toBe(7);
		const faceSignatures = manifests.map((manifest) =>
			[
				manifest.phenotype.faceShape,
				manifest.phenotype.noseProfile,
				...Object.values(manifest.phenotype.facialStructure ?? {})
			].join('|')
		);
		expect(new Set(faceSignatures).size).toBeGreaterThan(1_950);

		for (const manifest of manifests) {
			expect(manifest.attire).toBeDefined();
			expect(manifest.phenotype.facialStructure).toBeDefined();
			if (manifest.phenotype.hairColor === 'silver')
				expect(manifest.adultAge).toBeGreaterThanOrEqual(35);
			if (
				manifest.attire &&
				['linen-coif', 'wool-hood', 'mail-coif', 'kettle-hat', 'nasal-helm'].includes(
					manifest.attire.headwear
				)
			) {
				expect(manifest.phenotype.hairSilhouette).toBe('close');
			}
			if (manifest.attire?.torso === 'mail-shirt') {
				expect(['mail-sleeves', 'leather-vambraces']).toContain(manifest.attire.arms);
				expect(manifest.attire.material).toBe('mail');
				expect(manifest.attire.layering).toBe('armored');
			}
		}

		for (const skinTone of new Set(manifests.map((manifest) => manifest.phenotype.skinTone))) {
			const signatures = manifests
				.filter((manifest) => manifest.phenotype.skinTone === skinTone)
				.map((manifest) =>
					[
						manifest.phenotype.faceShape,
						manifest.phenotype.noseProfile,
						manifest.phenotype.facialStructure?.eyeShape,
						manifest.phenotype.facialStructure?.jawShape
					].join('|')
				);
			expect(new Set(signatures).size).toBeGreaterThan(180);
		}
	});

	it('locks the six-human Pack 2 visual pilot to a deliberate cross-section', async () => {
		const pilot = await generatePackTwoPilot();
		const manifests = pilot.map((draft) => draft.manifest);

		expect(PACK_TWO_PILOT_SEEDS).toHaveLength(6);
		expect(pilot.map((draft) => draft.manifestHash)).toEqual([
			'a956efa2c469631198800eaeb2cd0dd3abfc14b2c1ad14522f39def3de65071a',
			'238108f3c85f44ab008b1d47396e2183972fcfc46d82b076ae035487f9cc8e0d',
			'1feeac12b948bfa30d91cf8be2ad4eb4f7880bd1510a2ed5f5b05a571a63f74f',
			'd6ad6c862670da42158a4d02fcf6111390667d09c26db147f542c9c0d716c7a3',
			'9fc6e16f0dbc23d9e64681304ff90382dcc1061ff4ede2143f1fa8b209b2f29f',
			'b588607c9f54f675078738401ccbae4f1ae79b9ce119fd6c8b63d91851ced00a'
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

	it('locks the 18-human Pack 2 cohort to deliberately crossed attributes', async () => {
		const cohort = await generatePackTwoCohort();
		const manifests = cohort.map((draft) => draft.manifest);
		const expansion = cohort.slice(PACK_TWO_PILOT_SEEDS.length);

		expect(PACK_TWO_EXPANSION_SEEDS).toHaveLength(12);
		expect(PACK_TWO_COHORT_SEEDS).toHaveLength(18);
		expect(expansion.map((draft) => draft.manifestHash)).toEqual([
			'2f3bfc72e0cf6bbb7a910db8047ffb434ee60a0187c49edf59d383083e2b8ec0',
			'cd52d67613e989749c998b494b5b81db742056334147f277810cd113a5b0ecfe',
			'53c7ca65afaec9304260a92db4faded048043d191d80e0f8b04e4f1a2bd80d18',
			'869dd30ece536159788b1bdf00c5a476714d61f6e1db7e33413b3fbc352665fe',
			'37c7e563ef87630dc50459138760a5b75af5d275c1fd04af03b58dcd9bed479f',
			'99b5f020171014c55c1739b919654e30d2ddfef51996d3cc55759c8bf2ce7fa8',
			'147a67d7a5efc9dff329e8366b8c5719764992d27af9dcfef499d8eec69ecf91',
			'12c6a7d26b12581e53f5939e3249898af5d4f15231af2085cf896168c37aeb4b',
			'8b87697357f60b7a7b26e8a798e64ba8a9fb4a15ee9ccd1eaf08b84b60b0da1f',
			'12eded858cc30e6e354b31e2ec2fefc3d5557aec3e346eef489ce5022ad3c422',
			'bbe88090c9edc4eeebd7f746c73bdca3317d15c3a3fbab292952875950227255',
			'24a9e1f4cd027d548e833b1f45a4f940806758dca30b9eda3844fc2f0a3ae5a6'
		]);

		for (const presentation of ['feminine', 'masculine', 'androgynous'] as const) {
			const presentationCohort = manifests.filter(
				(manifest) => manifest.genderPresentation === presentation
			);
			expect(presentationCohort).toHaveLength(6);
			expect(
				new Set(presentationCohort.map((manifest) => manifest.physiology?.heightBand))
			).toEqual(new Set(['short', 'medium', 'tall', 'exceptional']));
		}

		const feminine = manifests.filter((manifest) => manifest.genderPresentation === 'feminine');
		expect(new Set(feminine.map((manifest) => manifest.bodyBuild))).toEqual(
			new Set(['wiry', 'lean', 'soft', 'athletic', 'sturdy', 'powerful'])
		);
		expect(new Set(manifests.map((manifest) => manifest.bodyFrame))).toEqual(
			new Set(['slight', 'balanced', 'broad'])
		);
		expect(new Set(manifests.map((manifest) => manifest.physiology?.proportions?.profile))).toEqual(
			new Set(['compact', 'balanced', 'long-limbed', 'long-torso'])
		);
		expect(new Set(manifests.map((manifest) => manifest.visualRole)).size).toBeGreaterThanOrEqual(
			7
		);
		expect(new Set(manifests.map((manifest) => manifest.rarityStars))).toEqual(new Set([1, 2, 3]));
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
