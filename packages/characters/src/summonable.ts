import {
	CharacterGenerationRecipeSchema,
	SummonableHeroCatalogSchema,
	type CharacterDraft,
	type CharacterGenerationRecipe
} from '@summonlab/contracts';

import summonableHeroCatalogSource from '../../../assets/heroes/approved/summonable-roster-v1/catalog.json';

export const SUMMONABLE_HERO_GENERATION_VERSION = 'human-v6';

const catalog = SummonableHeroCatalogSchema.parse(summonableHeroCatalogSource);
const entriesByRecipeSeed = new Map(
	catalog.entries.map((entry) => [entry.draft.recipe.seed, entry] as const)
);

function hash32(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function selectionKey(recipe: CharacterGenerationRecipe): string {
	return [
		recipe.generationVersion,
		recipe.seed,
		recipe.cursors.identity,
		recipe.cursors.body,
		recipe.cursors.features,
		recipe.cursors.styling,
		recipe.cursors.mind,
		recipe.cursors.rarity
	].join('\0');
}

function entryAtSelectionKey(key: string) {
	const entry = catalog.entries[hash32(key) % catalog.entries.length];
	if (!entry) throw new Error('The approved summonable hero catalog is empty');
	return entry;
}

export function listSummonableHeroDrafts(): readonly CharacterDraft[] {
	return catalog.entries.map((entry) => entry.draft);
}

export function resolveCanonicalSummonableDraft(
	input: CharacterGenerationRecipe
): CharacterDraft | null {
	const recipe = CharacterGenerationRecipeSchema.parse(input);
	if (recipe.generationVersion !== SUMMONABLE_HERO_GENERATION_VERSION) return null;
	const entry = entriesByRecipeSeed.get(recipe.seed);
	if (!entry) throw new Error(`Unknown approved summonable hero recipe: ${recipe.seed}`);
	if (selectionKey(recipe) !== selectionKey(entry.draft.recipe)) {
		throw new Error(
			`Approved summonable hero recipes do not support reroll cursors: ${recipe.seed}`
		);
	}
	return entry.draft;
}

export async function generateSummonableCharacterDraft(
	input: CharacterGenerationRecipe
): Promise<CharacterDraft> {
	const recipe = CharacterGenerationRecipeSchema.parse(input);
	return entryAtSelectionKey(selectionKey(recipe)).draft;
}

export async function generateSummonableCompany(
	campaignSeed: string,
	count: number
): Promise<readonly CharacterDraft[]> {
	const normalizedSeed = campaignSeed.trim();
	if (!normalizedSeed) throw new Error('A summonable company requires a campaign seed');
	if (!Number.isInteger(count) || count < 1 || count > catalog.entries.length) {
		throw new Error(`Summonable company size must be between 1 and ${catalog.entries.length}`);
	}
	const selected: CharacterDraft[] = [];
	const selectedIds = new Set<string>();
	for (let slot = 0; slot < count; slot += 1) {
		for (let attempt = 0; attempt < catalog.entries.length; attempt += 1) {
			const entry = entryAtSelectionKey(
				['summonable-company-v1', normalizedSeed, slot, attempt].join('\0')
			);
			if (selectedIds.has(entry.heroId)) continue;
			selectedIds.add(entry.heroId);
			selected.push(entry.draft);
			break;
		}
	}
	if (selected.length !== count) throw new Error('Could not select a duplicate-free hero company');
	return selected;
}
