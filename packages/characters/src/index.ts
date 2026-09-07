import {
	CharacterDraftSchema,
	CharacterGenerationRecipeSchema,
	CharacterManifestSchema,
	CharacterMindSchema,
	type CharacterDraft,
	type CharacterDraftV2,
	type CharacterGenerationCursors,
	type CharacterGenerationRecipe,
	type CharacterManifest,
	type CharacterMind,
	type FirstDestination,
	type ProofControlMode
} from '@summonlab/contracts';

import { resolveCanonicalSummonableDraft } from './summonable.js';

export {
	SUMMONABLE_HERO_GENERATION_VERSION,
	canonicalCharacterRecipeKey,
	deriveCharacterCapabilityProfile,
	derivePrivateEngineSeed,
	generateLegacySummonableCharacterDraft,
	generateSummonableCharacterDraft,
	generateSummonableCompany,
	listSummonableHeroDrafts,
	parseCapabilityEntropy
} from './summonable.js';

export const LEGACY_CHARACTER_GENERATION_VERSION = 'human-v1';
export const VISUAL_CHARACTER_GENERATION_VERSION = 'human-v2';
export const CHARACTER_GENERATION_VERSION = 'human-v3';
export const PACK_TWO_CHARACTER_GENERATION_VERSION = 'human-v4';
export const PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION = 'human-v5';

export const PACK_TWO_PILOT_SEEDS = [
	'pack-two-cohort-264',
	'pack-two-cohort-28',
	'pack-two-cohort-339',
	'pack-two-cohort-55',
	'pack-two-cohort-144',
	'pack-two-cohort-134'
] as const;

export const PACK_TWO_EXPANSION_SEEDS = [
	'pack-two-cohort-51',
	'pack-two-cohort-631',
	'pack-two-cohort-110',
	'pack-two-cohort-168',
	'pack-two-cohort-228',
	'pack-two-cohort-240',
	'pack-two-cohort-374',
	'pack-two-cohort-295',
	'pack-two-cohort-7',
	'pack-two-cohort-100',
	'pack-two-cohort-131',
	'pack-two-cohort-40'
] as const;

export const PACK_TWO_COHORT_SEEDS = [
	...PACK_TWO_PILOT_SEEDS,
	...PACK_TWO_EXPANSION_SEEDS
] as const;

export const ZERO_GENERATION_CURSORS: CharacterGenerationCursors = Object.freeze({
	identity: 0,
	body: 0,
	features: 0,
	styling: 0,
	mind: 0,
	rarity: 0
});

type Stream = () => number;
type RerollChannel = keyof CharacterGenerationCursors;

const names = [
	['Mara', 'Vey'],
	['Tarin', 'Sol'],
	['Edda', 'Ro'],
	['Noa', 'Kest'],
	['Iven', 'Mora'],
	['Sumi', 'Vale'],
	['Orin', 'Dae'],
	['Kira', 'Senn'],
	['Lio', 'Aster'],
	['Aven', 'Rook'],
	['Dara', 'Quill'],
	['Remy', 'Nahl']
] as const;

const givenNames = [
	'Mara',
	'Tarin',
	'Edda',
	'Noa',
	'Iven',
	'Sumi',
	'Orin',
	'Kira',
	'Lio',
	'Aven',
	'Dara',
	'Remy',
	'Amari',
	'Bryn',
	'Cael',
	'Devin',
	'Elian',
	'Fara',
	'Galen',
	'Hana',
	'Isen',
	'Jori',
	'Kavi',
	'Lin',
	'Miro',
	'Neri',
	'Osei',
	'Pema',
	'Rian',
	'Sena',
	'Tavi',
	'Zuri'
] as const;

const familyNames = [
	'Vey',
	'Sol',
	'Ro',
	'Kest',
	'Mora',
	'Vale',
	'Dae',
	'Senn',
	'Aster',
	'Rook',
	'Quill',
	'Nahl',
	'Arden',
	'Belen',
	'Corin',
	'Daro',
	'Esen',
	'Fenn',
	'Garo',
	'Hale',
	'Ilyan',
	'Juno',
	'Kade',
	'Lumen',
	'Marin',
	'Nor',
	'Orra',
	'Pell',
	'Ravel',
	'Saye',
	'Toren',
	'Zev'
] as const;

const skinTones = [
	['porcelain', '#f0cfb8'],
	['warm ivory', '#e7bf9e'],
	['golden tan', '#c58f66'],
	['warm olive', '#a97755'],
	['copper brown', '#925e43'],
	['deep umber', '#633b2d'],
	['rich ebony', '#3f2824']
] as const;

const hairColors = [
	['ink black', '#17151b'],
	['soft black', '#28232a'],
	['dark brown', '#3a2825'],
	['chestnut', '#643d32'],
	['auburn', '#7c3f32'],
	['ash brown', '#625952'],
	['silver', '#a7a7ad']
] as const;

const clothPalettes = [
	['#272932', '#d49b47'],
	['#243338', '#68b8ad'],
	['#352a38', '#d5a46d'],
	['#323128', '#a7b866'],
	['#292b3a', '#8aa7dd'],
	['#342929', '#c56f61']
] as const;

const packTwoBodyBuilds = ['wiry', 'lean', 'soft', 'athletic', 'sturdy', 'powerful'] as const;
const packTwoHeightBands = [
	'short',
	'short',
	'medium',
	'medium',
	'medium',
	'medium',
	'tall',
	'tall',
	'tall',
	'exceptional'
] as const;
const packTwoProportionProfiles = ['compact', 'balanced', 'long-limbed', 'long-torso'] as const;
const packTwoVisualRoles = [
	'guard',
	'hunter',
	'healer',
	'smith',
	'scribe',
	'traveler',
	'court',
	'mage'
] as const;
const packTwoHairStyles = [
	['shaved', 'close'],
	['cropped coils', 'close'],
	['close curls', 'close'],
	['jaw-length', 'jaw'],
	['loose shoulder-length', 'shoulder'],
	['long braid', 'long'],
	['high knot', 'raised'],
	['braided crown', 'crown'],
	['wrapped braids', 'wrapped']
] as const;

export const PACK_TWO_ATTIRE_OPTIONS = {
	footwear: [
		'turnshoes',
		'ankle-boots',
		'riding-boots',
		'hobnailed-boots',
		'wrapped-sandals',
		'fur-lined-boots',
		'soft-leather-shoes',
		'riding-greaves',
		'sabatons',
		'moccasin-boots'
	],
	legwear: [
		'fitted-hose',
		'split-hose-and-breeches',
		'loose-linen-trousers',
		'wool-trousers',
		'quilted-chausses',
		'leather-riding-trousers',
		'wrap-skirt-over-leggings',
		'divided-skirt-trousers',
		'mail-chausses',
		'work-breeches'
	],
	torso: [
		'linen-tunic',
		'belted-wool-tunic',
		'leather-jerkin',
		'quilted-gambeson',
		'mail-shirt',
		'brigandine-vest',
		'scholar-robe',
		'apron-over-tunic',
		'hooded-surcoat',
		'fitted-doublet'
	],
	arms: [
		'sleeveless',
		'rolled-sleeves',
		'full-linen-sleeves',
		'quilted-sleeves',
		'split-sleeves',
		'mail-sleeves',
		'leather-vambraces',
		'wrapped-forearms',
		'bell-cuffs',
		'fitted-cuffs'
	],
	headwear: [
		'none',
		'linen-coif',
		'wool-hood',
		'broad-hat',
		'felt-cap',
		'mail-coif',
		'kettle-hat',
		'nasal-helm',
		'turban-wrap',
		'circlet'
	]
} as const;

const packTwoFaceShapes = [
	'round',
	'oval',
	'angular oval',
	'long',
	'heart-shaped',
	'square',
	'diamond',
	'broad',
	'tapered',
	'oblong'
] as const;
const packTwoNoseProfiles = [
	'fine straight',
	'broad straight',
	'soft convex',
	'short rounded',
	'aquiline',
	'low bridge',
	'high bridge',
	'wide rounded',
	'narrow hooked',
	'prominent straight'
] as const;
const packTwoEyeShapes = [
	'almond',
	'round',
	'deep-set',
	'hooded',
	'upturned',
	'downturned',
	'narrow',
	'wide'
] as const;
const packTwoEyeSpacings = ['close-set', 'balanced', 'wide-set'] as const;
const packTwoBrowShapes = [
	'straight',
	'arched',
	'angular',
	'soft',
	'heavy',
	'fine',
	'low',
	'high'
] as const;
const packTwoCheekStructures = ['flat', 'rounded', 'high', 'broad', 'hollow', 'soft'] as const;
const packTwoJawShapes = [
	'narrow',
	'tapered',
	'rounded',
	'square',
	'broad',
	'angular',
	'soft'
] as const;
const packTwoChinShapes = ['small', 'rounded', 'square', 'pointed', 'cleft'] as const;
const packTwoMouthShapes = [
	'narrow',
	'wide',
	'bowed',
	'full',
	'thin',
	'asymmetric',
	'downturned'
] as const;

type PackTwoVisualRole = (typeof packTwoVisualRoles)[number];
type AttireSlot = keyof typeof PACK_TWO_ATTIRE_OPTIONS;
type AttireChoice<Slot extends AttireSlot> = (typeof PACK_TWO_ATTIRE_OPTIONS)[Slot][number];

const roleAttirePools: Record<
	PackTwoVisualRole,
	{ [Slot in AttireSlot]: readonly AttireChoice<Slot>[] }
> = {
	guard: {
		footwear: ['hobnailed-boots', 'riding-greaves', 'sabatons', 'ankle-boots'],
		legwear: ['quilted-chausses', 'leather-riding-trousers', 'mail-chausses', 'wool-trousers'],
		torso: ['quilted-gambeson', 'mail-shirt', 'brigandine-vest', 'hooded-surcoat'],
		arms: ['quilted-sleeves', 'mail-sleeves', 'leather-vambraces', 'wrapped-forearms'],
		headwear: ['none', 'mail-coif', 'kettle-hat', 'nasal-helm']
	},
	hunter: {
		footwear: ['ankle-boots', 'riding-boots', 'moccasin-boots', 'fur-lined-boots'],
		legwear: ['fitted-hose', 'wool-trousers', 'leather-riding-trousers', 'work-breeches'],
		torso: ['linen-tunic', 'belted-wool-tunic', 'leather-jerkin', 'hooded-surcoat'],
		arms: ['sleeveless', 'rolled-sleeves', 'leather-vambraces', 'wrapped-forearms'],
		headwear: ['none', 'wool-hood', 'broad-hat', 'felt-cap']
	},
	healer: {
		footwear: ['turnshoes', 'soft-leather-shoes', 'wrapped-sandals', 'ankle-boots'],
		legwear: ['fitted-hose', 'loose-linen-trousers', 'wrap-skirt-over-leggings', 'wool-trousers'],
		torso: ['linen-tunic', 'belted-wool-tunic', 'scholar-robe', 'apron-over-tunic'],
		arms: ['rolled-sleeves', 'full-linen-sleeves', 'bell-cuffs', 'fitted-cuffs'],
		headwear: ['none', 'linen-coif', 'wool-hood', 'turban-wrap']
	},
	smith: {
		footwear: ['hobnailed-boots', 'ankle-boots', 'moccasin-boots', 'soft-leather-shoes'],
		legwear: ['loose-linen-trousers', 'wool-trousers', 'leather-riding-trousers', 'work-breeches'],
		torso: ['linen-tunic', 'leather-jerkin', 'apron-over-tunic', 'quilted-gambeson'],
		arms: ['sleeveless', 'rolled-sleeves', 'leather-vambraces', 'wrapped-forearms'],
		headwear: ['none', 'linen-coif', 'wool-hood', 'felt-cap']
	},
	scribe: {
		footwear: ['turnshoes', 'soft-leather-shoes', 'wrapped-sandals', 'ankle-boots'],
		legwear: [
			'fitted-hose',
			'split-hose-and-breeches',
			'loose-linen-trousers',
			'divided-skirt-trousers'
		],
		torso: ['linen-tunic', 'scholar-robe', 'fitted-doublet', 'belted-wool-tunic'],
		arms: ['rolled-sleeves', 'full-linen-sleeves', 'bell-cuffs', 'fitted-cuffs'],
		headwear: ['none', 'linen-coif', 'broad-hat', 'felt-cap']
	},
	traveler: {
		footwear: ['riding-boots', 'fur-lined-boots', 'moccasin-boots', 'turnshoes'],
		legwear: [
			'split-hose-and-breeches',
			'wool-trousers',
			'wrap-skirt-over-leggings',
			'divided-skirt-trousers'
		],
		torso: ['belted-wool-tunic', 'leather-jerkin', 'hooded-surcoat', 'linen-tunic'],
		arms: ['full-linen-sleeves', 'split-sleeves', 'wrapped-forearms', 'fitted-cuffs'],
		headwear: ['none', 'wool-hood', 'broad-hat', 'turban-wrap']
	},
	court: {
		footwear: ['turnshoes', 'soft-leather-shoes', 'riding-boots', 'wrapped-sandals'],
		legwear: [
			'fitted-hose',
			'split-hose-and-breeches',
			'wrap-skirt-over-leggings',
			'divided-skirt-trousers'
		],
		torso: ['fitted-doublet', 'scholar-robe', 'hooded-surcoat', 'belted-wool-tunic'],
		arms: ['full-linen-sleeves', 'split-sleeves', 'bell-cuffs', 'fitted-cuffs'],
		headwear: ['none', 'broad-hat', 'felt-cap', 'circlet']
	},
	mage: {
		footwear: ['turnshoes', 'soft-leather-shoes', 'wrapped-sandals', 'fur-lined-boots'],
		legwear: [
			'loose-linen-trousers',
			'wrap-skirt-over-leggings',
			'divided-skirt-trousers',
			'fitted-hose'
		],
		torso: ['scholar-robe', 'hooded-surcoat', 'linen-tunic', 'fitted-doublet'],
		arms: ['full-linen-sleeves', 'split-sleeves', 'bell-cuffs', 'fitted-cuffs'],
		headwear: ['none', 'wool-hood', 'turban-wrap', 'circlet']
	}
};

const coveredHairStyles = new Set([
	'linen-coif',
	'wool-hood',
	'mail-coif',
	'kettle-hat',
	'nasal-helm'
]);

const torsoArmCompatibility: Record<AttireChoice<'torso'>, readonly AttireChoice<'arms'>[]> = {
	'linen-tunic': ['sleeveless', 'rolled-sleeves', 'full-linen-sleeves', 'wrapped-forearms'],
	'belted-wool-tunic': ['rolled-sleeves', 'full-linen-sleeves', 'split-sleeves', 'fitted-cuffs'],
	'leather-jerkin': ['sleeveless', 'rolled-sleeves', 'leather-vambraces', 'wrapped-forearms'],
	'quilted-gambeson': ['quilted-sleeves', 'leather-vambraces', 'wrapped-forearms'],
	'mail-shirt': ['mail-sleeves', 'leather-vambraces'],
	'brigandine-vest': ['quilted-sleeves', 'mail-sleeves', 'leather-vambraces'],
	'scholar-robe': ['full-linen-sleeves', 'split-sleeves', 'bell-cuffs', 'fitted-cuffs'],
	'apron-over-tunic': ['sleeveless', 'rolled-sleeves', 'wrapped-forearms'],
	'hooded-surcoat': ['full-linen-sleeves', 'quilted-sleeves', 'mail-sleeves', 'split-sleeves'],
	'fitted-doublet': ['split-sleeves', 'bell-cuffs', 'fitted-cuffs']
};

const torsoMaterial: Record<
	AttireChoice<'torso'>,
	'linen' | 'wool' | 'leather' | 'mail' | 'plate' | 'mixed'
> = {
	'linen-tunic': 'linen',
	'belted-wool-tunic': 'wool',
	'leather-jerkin': 'leather',
	'quilted-gambeson': 'mixed',
	'mail-shirt': 'mail',
	'brigandine-vest': 'mixed',
	'scholar-robe': 'wool',
	'apron-over-tunic': 'leather',
	'hooded-surcoat': 'mixed',
	'fitted-doublet': 'wool'
};

const packTwoHeightRanges = {
	short: [150, 162],
	medium: [163, 178],
	tall: [179, 192],
	exceptional: [193, 205]
} as const;

const packTwoBuildComposition = {
	wiry: { bmi: 19, muscle: 5, bodyFat: 3, stance: 0.92 },
	lean: { bmi: 21, muscle: 4, bodyFat: 4, stance: 0.95 },
	soft: { bmi: 27, muscle: 4, bodyFat: 7, stance: 1.03 },
	athletic: { bmi: 24, muscle: 7, bodyFat: 4, stance: 1 },
	solid: { bmi: 29, muscle: 6, bodyFat: 6, stance: 1.1 },
	sturdy: { bmi: 29, muscle: 6, bodyFat: 6, stance: 1.1 },
	powerful: { bmi: 31, muscle: 9, bodyFat: 5, stance: 1.14 }
} as const;

const packTwoProportions = {
	compact: {
		torsoRatio: 1.08,
		armRatio: 0.93,
		legRatio: 0.9,
		weightDistribution: 'grounded'
	},
	balanced: {
		torsoRatio: 1,
		armRatio: 1,
		legRatio: 1,
		weightDistribution: 'centered'
	},
	'long-limbed': {
		torsoRatio: 0.93,
		armRatio: 1.1,
		legRatio: 1.1,
		weightDistribution: 'light'
	},
	'long-torso': {
		torsoRatio: 1.12,
		armRatio: 1.03,
		legRatio: 0.89,
		weightDistribution: 'forward'
	}
} as const;

function hash32(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function streamFor(recipe: CharacterGenerationRecipe, channel: RerollChannel): Stream {
	const compatibleVersion =
		recipe.generationVersion === VISUAL_CHARACTER_GENERATION_VERSION ||
		recipe.generationVersion === CHARACTER_GENERATION_VERSION
			? LEGACY_CHARACTER_GENERATION_VERSION
			: recipe.generationVersion;
	let state = hash32(
		`${compatibleVersion}\u0000${recipe.seed}\u0000${channel}\u0000${recipe.cursors[channel]}`
	);
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function auxiliaryStreamFor(
	recipe: CharacterGenerationRecipe,
	channel: RerollChannel,
	purpose: string
): Stream {
	let state = hash32(
		`${recipe.generationVersion}\u0000${recipe.seed}\u0000${channel}\u0000${recipe.cursors[channel]}\u0000${purpose}`
	);
	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function choose<const Values extends readonly unknown[]>(
	stream: Stream,
	values: Values
): Values[number] {
	const value = values[Math.floor(stream() * values.length)];
	if (value === undefined) throw new Error('Cannot choose from an empty collection');
	return value;
}

function between(stream: Stream, minimum: number, maximum: number): number {
	return minimum + Math.floor(stream() * (maximum - minimum + 1));
}

function bounded(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function fixed3(value: number): number {
	return Number(value.toFixed(3));
}

function deterministicUuid(value: string): string {
	const chunks = [0, 1, 2, 3].map((index) =>
		hash32(`${value}\u0000${index}`).toString(16).padStart(8, '0')
	);
	const hex = chunks.join('').split('');
	hex[12] = '4';
	hex[16] = 'a';
	const joined = hex.join('');
	return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function sha256(value: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashManifest(manifest: CharacterManifest): Promise<string> {
	return sha256(canonicalJson(manifest));
}

export function recipeFromSeed(
	seed: string,
	generationVersion = CHARACTER_GENERATION_VERSION
): CharacterGenerationRecipe {
	return CharacterGenerationRecipeSchema.parse({
		seed,
		generationVersion,
		cursors: { ...ZERO_GENERATION_CURSORS }
	});
}

export function rerollRecipe(
	recipe: CharacterGenerationRecipe,
	lockedChannels: ReadonlySet<RerollChannel>
): CharacterGenerationRecipe {
	const cursors = { ...recipe.cursors };
	for (const channel of Object.keys(cursors) as RerollChannel[]) {
		if (!lockedChannels.has(channel)) cursors[channel] += 1;
	}
	return CharacterGenerationRecipeSchema.parse({ ...recipe, cursors });
}

function visualAnchorKey(recipe: CharacterGenerationRecipe): string | null {
	const baseRecipe =
		recipe.cursors.identity === 0 &&
		recipe.cursors.body === 0 &&
		recipe.cursors.features === 0 &&
		recipe.cursors.styling === 0;
	if (!baseRecipe) return null;
	if (
		recipe.seed === 'ember-01' &&
		(recipe.generationVersion === LEGACY_CHARACTER_GENERATION_VERSION ||
			recipe.generationVersion === VISUAL_CHARACTER_GENERATION_VERSION)
	) {
		return 'ember-01-anchor-v1';
	}
	if (
		recipe.seed === 'hearth-02' &&
		recipe.generationVersion === VISUAL_CHARACTER_GENERATION_VERSION
	) {
		return 'hearth-02-anchor-v1';
	}
	return null;
}

function generateManifest(recipe: CharacterGenerationRecipe): CharacterManifest {
	const identity = streamFor(recipe, 'identity');
	const body = streamFor(recipe, 'body');
	const features = streamFor(recipe, 'features');
	const styling = streamFor(recipe, 'styling');
	const rarity = streamFor(recipe, 'rarity');
	const packTwoVariation =
		recipe.generationVersion === PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION;
	const packTwo =
		recipe.generationVersion === PACK_TWO_CHARACTER_GENERATION_VERSION || packTwoVariation;
	const packTwoFrame = auxiliaryStreamFor(recipe, 'body', 'pack-two-frame-v1');
	const packTwoBuild = auxiliaryStreamFor(recipe, 'body', 'pack-two-build-v1');
	const packTwoHeight = auxiliaryStreamFor(recipe, 'body', 'pack-two-height-v1');
	const packTwoAge = auxiliaryStreamFor(recipe, 'body', 'pack-two-age-v1');
	const packTwoComposition = auxiliaryStreamFor(recipe, 'body', 'pack-two-composition-v1');
	const packTwoProportion = auxiliaryStreamFor(recipe, 'body', 'pack-two-proportion-v1');
	const packTwoRig = auxiliaryStreamFor(recipe, 'body', 'pack-two-rig-v1');
	const packTwoHair = auxiliaryStreamFor(recipe, 'features', 'pack-two-hair-v1');
	const packTwoGrooming = auxiliaryStreamFor(recipe, 'features', 'pack-two-grooming-v1');
	const packTwoRole = auxiliaryStreamFor(recipe, 'styling', 'pack-two-role-v1');
	const packTwoHandedness = auxiliaryStreamFor(recipe, 'body', 'pack-two-handedness-v1');
	const variationFace = auxiliaryStreamFor(recipe, 'features', 'pack-two-face-v2');
	const variationHair = auxiliaryStreamFor(recipe, 'features', 'pack-two-hair-v2');
	const variationAttire = auxiliaryStreamFor(recipe, 'styling', 'pack-two-attire-v2');
	const anchorKey = visualAnchorKey(recipe);
	const maraAnchor = anchorKey === 'ember-01-anchor-v1';
	const legacyName = maraAnchor ? names[0] : choose(identity, names);
	const expandedName = auxiliaryStreamFor(recipe, 'identity', 'expanded-name-v1');
	const [firstName, lastName] =
		recipe.generationVersion === CHARACTER_GENERATION_VERSION || packTwo
			? [choose(expandedName, givenNames), choose(expandedName, familyNames)]
			: legacyName;
	const presentation = maraAnchor
		? ('feminine' as const)
		: choose(identity, ['feminine', 'masculine', 'androgynous'] as const);
	const pronouns =
		presentation === 'feminine' ? 'she/her' : presentation === 'masculine' ? 'he/him' : 'they/them';
	const skin = maraAnchor ? skinTones[5] : choose(features, skinTones);
	const hair = maraAnchor ? hairColors[0] : choose(features, hairColors);
	const cloth = maraAnchor ? (['#242126', '#d2a04d'] as const) : choose(styling, clothPalettes);
	const rarityRoll = rarity();
	const rarityStars = rarityRoll < 0.78 ? 1 : rarityRoll < 0.98 ? 2 : rarityRoll < 0.999 ? 3 : 4;
	const bodyFrame = maraAnchor
		? ('balanced' as const)
		: packTwo
			? choose(packTwoFrame, ['slight', 'balanced', 'broad'] as const)
			: choose(body, ['slight', 'balanced', 'broad'] as const);
	const bodyBuild = maraAnchor
		? ('athletic' as const)
		: packTwo
			? choose(packTwoBuild, packTwoBodyBuilds)
			: choose(body, ['wiry', 'soft', 'athletic', 'solid'] as const);
	const heightBand = packTwo ? choose(packTwoHeight, packTwoHeightBands) : null;
	const heightRange = heightBand ? packTwoHeightRanges[heightBand] : null;
	const legacyHeightBase =
		presentation === 'masculine' ? 162 : presentation === 'feminine' ? 154 : 158;
	const legacyHeightRange =
		presentation === 'masculine' ? 37 : presentation === 'feminine' ? 34 : 36;
	const heightCm = maraAnchor
		? 178
		: heightRange
			? between(packTwoHeight, heightRange[0], heightRange[1])
			: legacyHeightBase + Math.floor(body() * legacyHeightRange);
	const ageSampleA = Math.max(packTwo ? packTwoAge() : body(), Number.EPSILON);
	const ageSampleB = packTwo ? packTwoAge() : body();
	const ageNormal = Math.sqrt(-2 * Math.log(ageSampleA)) * Math.cos(2 * Math.PI * ageSampleB);
	const age = maraAnchor ? 27 : Math.max(18, Math.min(42, Math.round(26 + ageNormal * 4.5)));
	const compatibleHairColors = age >= 35 ? hairColors : hairColors.slice(0, -1);
	const variationHairColor = packTwoVariation ? choose(variationHair, compatibleHairColors) : hair;
	const posture = maraAnchor
		? ('guarded' as const)
		: choose(styling, ['guarded', 'open', 'restless', 'grounded', 'formal'] as const);
	const visualTraits = maraAnchor
		? ['high coiled knot', 'ember clasp', 'angular brows']
		: [
				choose(features, [
					'freckled cheeks',
					'notched right brow',
					'fine jaw scar',
					'wide-set eyes',
					'callused hands',
					'dimpled chin'
				] as const),
				choose(styling, [
					'weathered cloak',
					'copper clasp',
					'wrapped forearms',
					'braided cord belt',
					'patched shoulder',
					'ink-blue scarf'
				] as const)
			];

	const physiology = auxiliaryStreamFor(recipe, 'body', 'physiology-v1');
	const buildMass = {
		wiry: -7,
		lean: -3,
		soft: 3,
		athletic: 2,
		solid: 10,
		sturdy: 10,
		powerful: 14
	}[bodyBuild];
	const frameMass = { slight: -4, balanced: 0, broad: 6 }[bodyFrame];
	const proportionProfile = packTwo ? choose(packTwoProportion, packTwoProportionProfiles) : null;
	const proportionBase = proportionProfile ? packTwoProportions[proportionProfile] : null;
	const composition = packTwo ? packTwoBuildComposition[bodyBuild] : null;
	const proportionJitter = () => Number(((packTwoProportion() - 0.5) * 0.04).toFixed(3));
	const torsoRatio = proportionBase
		? Number((proportionBase.torsoRatio + proportionJitter()).toFixed(3))
		: null;
	const armRatio = proportionBase
		? Number((proportionBase.armRatio + proportionJitter()).toFixed(3))
		: null;
	const legRatio = proportionBase
		? Number((proportionBase.legRatio + proportionJitter()).toFixed(3))
		: null;
	const visualRole = packTwo ? choose(packTwoRole, packTwoVisualRoles) : null;
	const attirePools = packTwoVariation && visualRole ? roleAttirePools[visualRole] : null;
	const attireHeadwear = attirePools ? choose(variationAttire, attirePools.headwear) : null;
	const variationHairTexture = packTwoVariation
		? choose(variationHair, ['straight', 'wavy', 'curly', 'coiled', 'tightly coiled'] as const)
		: null;
	const compatibleHairStyles = packTwoHairStyles.filter(([style, silhouette]) => {
		if (attireHeadwear && coveredHairStyles.has(attireHeadwear) && silhouette !== 'close')
			return false;
		if (variationHairTexture === 'straight' || variationHairTexture === 'wavy') {
			return !['cropped coils', 'close curls', 'wrapped braids'].includes(style);
		}
		if (variationHairTexture === 'curly') {
			return !['cropped coils', 'long braid', 'braided crown', 'wrapped braids'].includes(style);
		}
		return !['jaw-length', 'loose shoulder-length', 'long braid'].includes(style);
	});
	const packTwoHairStyle = packTwo
		? packTwoVariation
			? choose(variationHair, compatibleHairStyles)
			: choose(packTwoHair, packTwoHairStyles)
		: null;
	const packTwoGroomingValue = packTwo
		? choose(packTwoGrooming, ['clean', 'neat', 'weathered'] as const)
		: null;
	const packTwoFacialHair = packTwo
		? choose(packTwoGrooming, [
				'none',
				'none',
				'none',
				'stubble',
				'moustache',
				'short-beard',
				'full-beard'
			] as const)
		: null;
	const attireTorso = attirePools ? choose(variationAttire, attirePools.torso) : null;
	const compatibleArms =
		attirePools && attireTorso
			? attirePools.arms.filter((arms) => torsoArmCompatibility[attireTorso].includes(arms))
			: [];
	const attire =
		attirePools && attireTorso
			? {
					footwear: choose(variationAttire, attirePools.footwear),
					legwear: choose(variationAttire, attirePools.legwear),
					torso: attireTorso,
					arms: choose(
						variationAttire,
						compatibleArms.length > 0 ? compatibleArms : attirePools.arms
					),
					headwear: attireHeadwear!,
					material: torsoMaterial[attireTorso],
					condition: choose(variationAttire, [
						'mended',
						'maintained',
						'weathered',
						'fine'
					] as const),
					layering: ['mail-shirt', 'brigandine-vest'].includes(attireTorso)
						? ('armored' as const)
						: ['quilted-gambeson', 'hooded-surcoat'].includes(attireTorso)
							? ('layered' as const)
							: ['linen-tunic', 'scholar-robe'].includes(attireTorso)
								? ('light' as const)
								: ('standard' as const)
				}
			: null;
	const apparentAgeBand = age <= 24 ? 'young-adult' : age <= 34 ? 'adult' : 'mature-adult';
	const packTwoMassKg = composition
		? Math.round(
				composition.bmi * (heightCm / 100) ** 2 + frameMass + (packTwoComposition() - 0.5) * 4
			)
		: null;
	const packTwoMuscleTone = composition
		? Math.round(composition.muscle + (packTwoComposition() - 0.5) * 2)
		: null;
	const packTwoBodyFat = composition
		? Math.round(composition.bodyFat + (packTwoComposition() - 0.5) * 2)
		: null;
	const packTwoStanceWidth = composition
		? fixed3(composition.stance + (packTwoProportion() - 0.5) * 0.04)
		: null;
	const packTwoFrameWidth = { slight: 0.86, balanced: 1, broad: 1.14 }[bodyFrame];
	const packTwoShoulderBuild = {
		wiry: -0.04,
		lean: -0.02,
		soft: 0.01,
		athletic: 0.03,
		solid: 0.04,
		sturdy: 0.05,
		powerful: 0.08
	}[bodyBuild];
	const packTwoHipBuild = {
		wiry: -0.04,
		lean: -0.02,
		soft: 0.06,
		athletic: 0.01,
		solid: 0.05,
		sturdy: 0.07,
		powerful: 0.06
	}[bodyBuild];
	return CharacterManifestSchema.parse({
		characterId: deterministicUuid(
			canonicalJson({
				seed: recipe.seed,
				generationVersion: recipe.generationVersion,
				cursors: {
					identity: recipe.cursors.identity,
					body: recipe.cursors.body,
					features: recipe.cursors.features,
					styling: recipe.cursors.styling,
					rarity: recipe.cursors.rarity
				}
			})
		),
		displayName: `${firstName} ${lastName}`,
		appearanceSeed: recipe.seed,
		generationVersion: recipe.generationVersion,
		rarityStars,
		adultAge: age,
		...(packTwo ? { apparentAgeBand } : {}),
		genderPresentation: presentation,
		pronouns,
		bodyFrame,
		bodyBuild,
		heightCm,
		...(recipe.generationVersion === VISUAL_CHARACTER_GENERATION_VERSION ||
		recipe.generationVersion === CHARACTER_GENERATION_VERSION ||
		packTwo
			? {
					physiology: {
						massKg: packTwoMassKg
							? bounded(packTwoMassKg, 40, 160)
							: bounded(Math.round((heightCm - 100) * 0.82 + buildMass + frameMass), 40, 160),
						muscleTone: packTwoMuscleTone
							? bounded(packTwoMuscleTone, 1, 10)
							: bounded(
									Math.round(
										(bodyBuild === 'athletic' ? 7 : bodyBuild === 'solid' ? 6 : 4) +
											(physiology() - 0.5) * 3
									),
									1,
									10
								),
						bodyFat: packTwoBodyFat
							? bounded(packTwoBodyFat, 1, 10)
							: bounded(
									Math.round(
										(bodyBuild === 'soft' ? 7 : bodyBuild === 'wiry' ? 3 : 4) +
											(physiology() - 0.5) * 3
									),
									1,
									10
								),
						limbProportion: proportionProfile
							? proportionProfile === 'long-limbed'
								? 'long'
								: proportionProfile === 'balanced'
									? 'balanced'
									: 'short'
							: choose(physiology, ['short', 'balanced', 'balanced', 'long'] as const),
						handScale: packTwo
							? fixed3(0.88 + packTwoRig() * 0.24)
							: Number((0.86 + physiology() * 0.28).toFixed(3)),
						...(heightBand &&
						proportionProfile &&
						torsoRatio &&
						armRatio &&
						legRatio &&
						packTwoStanceWidth &&
						proportionBase
							? {
									heightBand,
									proportions: {
										profile: proportionProfile,
										torsoRatio,
										armRatio,
										legRatio,
										stanceWidth: bounded(packTwoStanceWidth, 0.8, 1.2),
										weightDistribution: proportionBase.weightDistribution
									}
								}
							: {})
					}
				}
			: {}),
		phenotype: {
			skinTone: skin[0],
			faceShape: maraAnchor
				? 'angular oval'
				: packTwoVariation
					? choose(variationFace, packTwoFaceShapes)
					: choose(features, ['round', 'oval', 'angular oval', 'long', 'heart-shaped'] as const),
			noseProfile: maraAnchor
				? 'broad straight'
				: packTwoVariation
					? choose(variationFace, packTwoNoseProfiles)
					: choose(features, [
							'fine straight',
							'broad straight',
							'soft convex',
							'short rounded'
						] as const),
			hairTexture: maraAnchor
				? 'tightly coiled'
				: (variationHairTexture ??
					choose(features, ['straight', 'wavy', 'curly', 'coiled', 'tightly coiled'] as const)),
			hairColor: variationHairColor[0],
			hairStyle: maraAnchor
				? 'high coiled knot'
				: packTwoHairStyle
					? packTwoHairStyle[0]
					: choose(styling, [
							'cropped',
							'jaw-length',
							'loose shoulder-length',
							'high knot',
							'braided crown'
						] as const),
			eyeColor: maraAnchor
				? 'dark brown'
				: choose(features, [
						'dark brown',
						'warm brown',
						'hazel',
						'grey',
						'green',
						'amber'
					] as const),
			...(packTwoHairStyle && packTwoGroomingValue && packTwoFacialHair
				? {
						hairSilhouette: packTwoHairStyle[1],
						grooming: packTwoGroomingValue,
						facialHair: packTwoFacialHair,
						...(packTwoVariation
							? {
									facialStructure: {
										eyeShape: choose(variationFace, packTwoEyeShapes),
										eyeSpacing: choose(variationFace, packTwoEyeSpacings),
										browShape: choose(variationFace, packTwoBrowShapes),
										cheekStructure: choose(variationFace, packTwoCheekStructures),
										jawShape: choose(variationFace, packTwoJawShapes),
										chinShape: choose(variationFace, packTwoChinShapes),
										mouthShape: choose(variationFace, packTwoMouthShapes)
									}
								}
							: {})
					}
				: {})
		},
		voice: {
			register: choose(identity, ['low', 'mid', 'high'] as const),
			texture: choose(identity, ['clear', 'rough', 'warm', 'breathy'] as const),
			cadence: choose(identity, ['measured', 'quick', 'deliberate', 'lilting'] as const)
		},
		posture,
		handedness: packTwo
			? choose(packTwoHandedness, ['right', 'right', 'right', 'left', 'ambidextrous'] as const)
			: choose(body, ['right', 'right', 'right', 'left', 'ambidextrous'] as const),
		visualTraits,
		...(visualRole ? { visualRole } : {}),
		...(attire ? { attire } : {}),
		palette: { skin: skin[1], hair: variationHairColor[1], cloth: cloth[0], accent: cloth[1] },
		rig: {
			headScale: packTwo
				? bounded(
						fixed3(
							(heightBand === 'short'
								? 1.03
								: heightBand === 'medium'
									? 0.99
									: heightBand === 'tall'
										? 0.95
										: 0.92) +
								(packTwoRig() - 0.5) * 0.04
						),
						0.8,
						1.2
					)
				: Number((0.9 + body() * 0.18).toFixed(3)),
			shoulderWidth: packTwo
				? bounded(
						fixed3(packTwoFrameWidth + packTwoShoulderBuild + (packTwoRig() - 0.5) * 0.04),
						0.75,
						1.3
					)
				: Number((0.84 + body() * 0.32).toFixed(3)),
			hipWidth: packTwo
				? bounded(
						fixed3(packTwoFrameWidth + packTwoHipBuild + (packTwoRig() - 0.5) * 0.04),
						0.75,
						1.3
					)
				: Number((0.84 + body() * 0.28).toFixed(3)),
			legRatio: legRatio ?? Number((0.88 + body() * 0.24).toFixed(3)),
			anchors: {
				head: [50, 17],
				leftHand: [27, armRatio ? fixed3(56 * armRatio) : 56],
				rightHand: [73, armRatio ? fixed3(56 * armRatio) : 56],
				back: [50, 36]
			}
		},
		artKey: anchorKey,
		assetProvenance: anchorKey ? 'original-generated-anchor' : 'procedural'
	});
}

function generateMind(recipe: CharacterGenerationRecipe): CharacterMind {
	const mind = streamFor(recipe, 'mind');
	return CharacterMindSchema.parse({
		personality: {
			openness: between(mind, 20, 95),
			conscientiousness: between(mind, 20, 95),
			extraversion: between(mind, 10, 90),
			agreeableness: between(mind, 15, 95),
			emotionalVolatility: between(mind, 10, 90)
		},
		primaryValue: choose(mind, [
			'duty',
			'freedom',
			'knowledge',
			'belonging',
			'mastery',
			'mercy'
		] as const),
		primaryDrive: choose(mind, [
			'understand',
			'protect',
			'prove',
			'connect',
			'create',
			'survive'
		] as const),
		socialStyle: choose(mind, [
			'reserved',
			'direct',
			'warm',
			'wry',
			'formal',
			'inquisitive'
		] as const),
		stressResponse: choose(mind, [
			'observe',
			'prepare',
			'confront',
			'withdraw',
			'seek-allies'
		] as const),
		dailyHabit: choose(mind, [
			'checks-exits',
			'stretches-at-dawn',
			'shares-breakfast',
			'catalogues-tools',
			'walks-the-walls',
			'practises-knots'
		] as const),
		aptitudes: {
			might: between(mind, 2, 9),
			finesse: between(mind, 2, 9),
			insight: between(mind, 2, 9),
			resolve: between(mind, 2, 9)
		}
	});
}

export function recipeAtMinimumRarity(
	input: CharacterGenerationRecipe,
	minimumStars: 1 | 2 | 3 | 4
): CharacterGenerationRecipe {
	const recipe = CharacterGenerationRecipeSchema.parse(input);
	if (minimumStars === 1) return recipe;
	for (let offset = 0; offset < 10_000; offset += 1) {
		const candidate = CharacterGenerationRecipeSchema.parse({
			...recipe,
			cursors: { ...recipe.cursors, rarity: recipe.cursors.rarity + offset }
		});
		if (generateManifest(candidate).rarityStars >= minimumStars) return candidate;
	}
	throw new Error(`No ${minimumStars}-star recipe could be resolved for ${recipe.seed}`);
}

export async function generateCharacterDraft(
	input: CharacterGenerationRecipe
): Promise<CharacterDraft> {
	const recipe = CharacterGenerationRecipeSchema.parse(input);
	const approved = resolveCanonicalSummonableDraft(recipe);
	if (approved) return approved;
	const manifest = generateManifest(recipe);
	const mind = generateMind(recipe);
	return CharacterDraftSchema.parse({
		recipe,
		manifest,
		mind,
		manifestHash: await hashManifest(manifest)
	});
}

export async function generatePackTwoPilot(): Promise<readonly CharacterDraft[]> {
	return Promise.all(
		PACK_TWO_PILOT_SEEDS.map((seed) =>
			generateCharacterDraft(recipeFromSeed(seed, PACK_TWO_CHARACTER_GENERATION_VERSION))
		)
	);
}

export async function generatePackTwoCohort(): Promise<readonly CharacterDraft[]> {
	return Promise.all(
		PACK_TWO_COHORT_SEEDS.map((seed) =>
			generateCharacterDraft(recipeFromSeed(seed, PACK_TWO_CHARACTER_GENERATION_VERSION))
		)
	);
}

export async function generatePackTwoVariationCohort(): Promise<readonly CharacterDraft[]> {
	return Promise.all(
		PACK_TWO_COHORT_SEEDS.map((seed) =>
			generateCharacterDraft(recipeFromSeed(seed, PACK_TWO_VARIATION_CHARACTER_GENERATION_VERSION))
		)
	);
}

export const FIRST_OBSERVATION =
	'A circular gate cools behind the summoned hero. A stranger waits beyond a waist-high rail; two marked doors lead toward voices and ringing steel.';

export interface FirstChoice {
	readonly destination: FirstDestination;
	readonly source: 'random' | 'scripted' | 'directed';
	readonly firstLine: string;
	readonly storyBranch: string;
	readonly score: Readonly<{ kitchen: number; trainingGround: number }>;
}

function directiveScores(directive: string): { kitchen: number; trainingGround: number } {
	const normalized = directive.toLowerCase();
	const kitchenWords = ['food', 'eat', 'kitchen', 'people', 'talk', 'community', 'rest', 'recover'];
	const trainingWords = [
		'train',
		'strong',
		'weapon',
		'tower',
		'fight',
		'prepare',
		'exercise',
		'practice'
	];
	return {
		kitchen: kitchenWords.filter((word) => normalized.includes(word)).length * 18,
		trainingGround: trainingWords.filter((word) => normalized.includes(word)).length * 18
	};
}

type GeneratedCharacterDraft = CharacterDraft | CharacterDraftV2;

function scriptedScores(draft: GeneratedCharacterDraft, directive: string) {
	const { mind } = draft;
	let might: number;
	let resolve: number;
	if ('capabilityProfile' in draft) {
		might = Math.ceil(draft.capabilityProfile.attributes.might / 10);
		resolve = Math.ceil(draft.capabilityProfile.attributes.vitality / 10);
	} else {
		might = draft.mind.aptitudes.might;
		resolve = draft.mind.aptitudes.resolve;
	}
	let kitchen = Math.round((mind.personality.agreeableness + mind.personality.extraversion) / 12);
	let trainingGround = Math.round(
		(mind.personality.conscientiousness + might * 8 + resolve * 7) / 16
	);
	if (['belonging', 'mercy'].includes(mind.primaryValue)) kitchen += 14;
	if (['connect', 'protect'].includes(mind.primaryDrive)) kitchen += 10;
	if (mind.dailyHabit === 'shares-breakfast') kitchen += 18;
	if (['mastery', 'duty'].includes(mind.primaryValue)) trainingGround += 14;
	if (['prove', 'survive'].includes(mind.primaryDrive)) trainingGround += 10;
	if (['stretches-at-dawn', 'walks-the-walls'].includes(mind.dailyHabit)) trainingGround += 18;
	const direction = directiveScores(directive);
	return {
		kitchen: kitchen + direction.kitchen,
		trainingGround: trainingGround + direction.trainingGround
	};
}

function openingLine(draft: GeneratedCharacterDraft, destination: FirstDestination): string {
	if (draft.manifest.artKey === 'ember-01-anchor-v1') {
		return destination === 'training-ground'
			? "I don't know you, and I don't know this place. Show me somewhere I can test what this body remembers."
			: "I don't know you, and I don't know this place. Start with names—and somewhere people gather.";
	}
	const prefix =
		draft.mind.socialStyle === 'direct'
			? 'Answers can wait.'
			: draft.mind.socialStyle === 'inquisitive'
				? 'You brought me here for a reason.'
				: draft.mind.socialStyle === 'warm'
					? 'I can see you are waiting for trust.'
					: 'I remember no road into this room.';
	return destination === 'training-ground'
		? `${prefix} Let me learn what I can do before you tell me what I am.`
		: `${prefix} Take me where people gather; context begins with names.`;
}

export function chooseFirstDestination(
	draft: GeneratedCharacterDraft,
	controlMode: ProofControlMode,
	directive: string
): FirstChoice {
	if (controlMode === 'random') {
		const random = streamFor(draft.recipe, 'mind')();
		const destination = random < 0.5 ? 'kitchen' : 'training-ground';
		return {
			destination,
			source: 'random',
			firstLine: openingLine(draft, destination),
			storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust',
			score: { kitchen: random < 0.5 ? 1 : 0, trainingGround: random < 0.5 ? 0 : 1 }
		};
	}

	const score = scriptedScores(draft, directive);
	const destination = score.trainingGround > score.kitchen ? 'training-ground' : 'kitchen';
	return {
		destination,
		source: directive.trim() ? 'directed' : 'scripted',
		firstLine: openingLine(draft, destination),
		storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust',
		score: score
	};
}
