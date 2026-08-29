import {
	PACK_TWO_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';

import type { CharacterDraft } from '@summonlab/contracts';

import type { PageServerLoad } from './$types';

function counts(values: string[]): Record<string, number> {
	return Object.fromEntries(
		[...new Set(values)]
			.sort()
			.map((value) => [value, values.filter((item) => item === value).length])
	);
}

function matrix(
	drafts: CharacterDraft[],
	rowValues: readonly string[],
	columnValues: readonly string[],
	row: (draft: CharacterDraft) => string | undefined,
	column: (draft: CharacterDraft) => string | undefined
): Record<string, Record<string, number>> {
	return Object.fromEntries(
		rowValues.map((rowValue) => [
			rowValue,
			Object.fromEntries(
				columnValues.map((columnValue) => [
					columnValue,
					drafts.filter((draft) => row(draft) === rowValue && column(draft) === columnValue).length
				])
			)
		])
	);
}

const presentations = ['feminine', 'masculine', 'androgynous'] as const;
const builds = ['wiry', 'lean', 'soft', 'athletic', 'sturdy', 'powerful'] as const;
const heightBands = ['short', 'medium', 'tall', 'exceptional'] as const;

export const load: PageServerLoad = async () => {
	const auditDrafts = await Promise.all(
		Array.from({ length: 1_000 }, (_, index) =>
			generateCharacterDraft(
				recipeFromSeed(`pack-two-cohort-${index}`, PACK_TWO_CHARACTER_GENERATION_VERSION)
			)
		)
	);
	const drafts = auditDrafts.slice(0, 100);
	const presentationByBuild = matrix(
		auditDrafts,
		presentations,
		builds,
		(draft) => draft.manifest.genderPresentation,
		(draft) => draft.manifest.bodyBuild
	);
	const presentationByHeight = matrix(
		auditDrafts,
		presentations,
		heightBands,
		(draft) => draft.manifest.genderPresentation,
		(draft) => draft.manifest.physiology?.heightBand
	);
	const presentationByRarity = matrix(
		auditDrafts,
		presentations,
		['1', '2', '3', '4'],
		(draft) => draft.manifest.genderPresentation,
		(draft) => String(draft.manifest.rarityStars)
	);
	const skinToneBuildCoverage = Object.fromEntries(
		Object.keys(counts(auditDrafts.map((draft) => draft.manifest.phenotype.skinTone))).map(
			(skinTone) => [
				skinTone,
				new Set(
					auditDrafts
						.filter((draft) => draft.manifest.phenotype.skinTone === skinTone)
						.map((draft) => draft.manifest.bodyBuild)
				).size
			]
		)
	);
	const visualTraitCounts = counts(auditDrafts.flatMap((draft) => draft.manifest.visualTraits));
	const repeatedTraits = Object.entries(visualTraitCounts)
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, 6);
	const independenceChecks = [
		{
			id: 'presentation-build-cross',
			label: 'Every presentation crosses every build',
			passed: Object.values(presentationByBuild).every((columns) =>
				Object.values(columns).every((value) => value > 0)
			)
		},
		{
			id: 'presentation-height-cross',
			label: 'Every presentation crosses every height band',
			passed: Object.values(presentationByHeight).every((columns) =>
				Object.values(columns).every((value) => value > 0)
			)
		},
		{
			id: 'phenotype-build-care',
			label: 'Every skin-tone range receives all six builds',
			passed: Object.values(skinToneBuildCoverage).every((value) => value === builds.length)
		},
		{
			id: 'presentation-rarity-cross',
			label: 'Every presentation spans at least three natural star results',
			passed: Object.values(presentationByRarity).every(
				(columns) => Object.values(columns).filter((value) => value > 0).length >= 3
			)
		}
	];
	return {
		generationVersion: PACK_TWO_CHARACTER_GENERATION_VERSION,
		auditSize: auditDrafts.length,
		displaySize: drafts.length,
		drafts,
		auditDrafts,
		summary: {
			meanAge: Number(
				(
					auditDrafts.reduce((total, draft) => total + draft.manifest.adultAge, 0) /
					auditDrafts.length
				).toFixed(1)
			),
			meanHeightCm: Number(
				(
					auditDrafts.reduce((total, draft) => total + draft.manifest.heightCm, 0) /
					auditDrafts.length
				).toFixed(1)
			),
			minimumHeightCm: Math.min(...auditDrafts.map((draft) => draft.manifest.heightCm)),
			maximumHeightCm: Math.max(...auditDrafts.map((draft) => draft.manifest.heightCm)),
			uniqueNames: new Set(auditDrafts.map((draft) => draft.manifest.displayName)).size,
			presentations: counts(auditDrafts.map((draft) => draft.manifest.genderPresentation)),
			builds: counts(auditDrafts.map((draft) => draft.manifest.bodyBuild)),
			frames: counts(auditDrafts.map((draft) => draft.manifest.bodyFrame)),
			heightBands: counts(
				auditDrafts.map((draft) => draft.manifest.physiology?.heightBand ?? 'legacy')
			),
			proportionProfiles: counts(
				auditDrafts.map((draft) => draft.manifest.physiology?.proportions?.profile ?? 'legacy')
			),
			visualRoles: counts(auditDrafts.map((draft) => draft.manifest.visualRole ?? 'unset')),
			skinTones: counts(auditDrafts.map((draft) => draft.manifest.phenotype.skinTone)),
			hairTextures: counts(auditDrafts.map((draft) => draft.manifest.phenotype.hairTexture)),
			hairSilhouettes: counts(
				auditDrafts.map((draft) => draft.manifest.phenotype.hairSilhouette ?? 'legacy')
			),
			limbProportions: counts(
				auditDrafts.map((draft) => draft.manifest.physiology?.limbProportion ?? 'legacy')
			),
			muscleTones: counts(
				auditDrafts.map((draft) => String(draft.manifest.physiology?.muscleTone ?? 'legacy'))
			),
			bodyFatBands: counts(
				auditDrafts.map((draft) => String(draft.manifest.physiology?.bodyFat ?? 'legacy'))
			),
			presentationByBuild,
			presentationByHeight,
			presentationByRarity,
			skinToneBuildCoverage,
			repeatedTraits,
			independenceChecks
		},
		lineup: heightBands.flatMap((band) =>
			auditDrafts.filter((draft) => draft.manifest.physiology?.heightBand === band).slice(0, 3)
		)
	};
};
