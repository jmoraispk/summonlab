import {
	ImageProductionTargetSchema,
	type ImageProductionReference,
	type ImageProductionTarget
} from '@summonlab/contracts';

export const AFFINITY_WORKFLOW_VERSION = 'affinity-workflow-v1';
export const ELEMENTAL_REGRESSION_VERSION = 'v2';
export const CORRECTION_REGRESSION_VERSION = 'v2';

const IMMUTABLE_SAFE_FRAME_V3_TARGET_IDS = new Set([
	'affinity-workflow-v1-grey-wolf-wood',
	'affinity-workflow-v1-grey-wolf-metal',
	'affinity-workflow-v1-grey-wolf-water',
	'affinity-workflow-v1-grey-wolf-wind',
	'affinity-workflow-v1-cave-bear-normal',
	'affinity-workflow-v1-cave-bear-wood',
	'affinity-workflow-v1-cave-bear-fire'
]);

export const AFFINITY_IDS = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
export type AffinityId = (typeof AFFINITY_IDS)[number];

export const AFFINITY_COHORT_IDS = ['controlled', 'breadth', 'regression'] as const;
export type AffinityCohortId = (typeof AFFINITY_COHORT_IDS)[number];

export const AFFINITY_SPECIES_IDS = [
	'death-knight',
	'elemental',
	'grey-wolf',
	'cave-bear',
	'goblin',
	'tunnel-boar',
	'cave-drake',
	'tower-basilisk'
] as const;
export type AffinitySpeciesId = (typeof AFFINITY_SPECIES_IDS)[number];

export type GoblinAffinityAttributes = Readonly<{
	seed: string;
	duty: (typeof GOBLIN_ATTRIBUTE_OPTIONS.duty)[number];
	stature: (typeof GOBLIN_ATTRIBUTE_OPTIONS.stature)[number];
	build: (typeof GOBLIN_ATTRIBUTE_OPTIONS.build)[number];
	adultAgeBand: (typeof GOBLIN_ATTRIBUTE_OPTIONS.adultAgeBand)[number];
	faceShape: (typeof GOBLIN_ATTRIBUTE_OPTIONS.faceShape)[number];
	nose: (typeof GOBLIN_ATTRIBUTE_OPTIONS.nose)[number];
	jaw: (typeof GOBLIN_ATTRIBUTE_OPTIONS.jaw)[number];
	brow: (typeof GOBLIN_ATTRIBUTE_OPTIONS.brow)[number];
	earShape: (typeof GOBLIN_ATTRIBUTE_OPTIONS.earShape)[number];
	scars: (typeof GOBLIN_ATTRIBUTE_OPTIONS.scars)[number];
	asymmetry: (typeof GOBLIN_ATTRIBUTE_OPTIONS.asymmetry)[number];
	skinPalette: (typeof GOBLIN_ATTRIBUTE_OPTIONS.skinPalette)[number];
	markings: (typeof GOBLIN_ATTRIBUTE_OPTIONS.markings)[number];
	clothingSilhouette: (typeof GOBLIN_ATTRIBUTE_OPTIONS.clothingSilhouette)[number];
	clothingCondition: (typeof GOBLIN_ATTRIBUTE_OPTIONS.clothingCondition)[number];
	footwear: (typeof GOBLIN_ATTRIBUTE_OPTIONS.footwear)[number];
	headwear: (typeof GOBLIN_ATTRIBUTE_OPTIONS.headwear)[number];
	armorCoverage: (typeof GOBLIN_ATTRIBUTE_OPTIONS.armorCoverage)[number];
	handedness: (typeof GOBLIN_ATTRIBUTE_OPTIONS.handedness)[number];
	battlefieldImportance: (typeof GOBLIN_ATTRIBUTE_OPTIONS.battlefieldImportance)[number];
	weaponOrFocus: string;
	clothingLayers: readonly string[];
	equipmentAnchors: readonly string[];
	posture: (typeof GOBLIN_ATTRIBUTE_OPTIONS.posture)[number];
}>;

export type AffinityWorkflowTarget = ImageProductionTarget;

export const AFFINITY_DEFINITIONS = [
	{
		id: 'normal',
		name: 'Normal',
		construction:
			'established species materials, restrained neutral effects, and no unexplained elemental anatomy',
		permittedTransformations: [
			'material wear',
			'duty-readable equipment',
			'restrained neutral wake'
		],
		alteredDimensions: [],
		counterplayCue: 'Preserve the established species weak point without elemental substitution.',
		reject:
			'accidental elemental glow, affinity-coded material substitution, or unexplained magical anatomy'
	},
	{
		id: 'wood',
		name: 'Wood',
		construction:
			'bark grain, load-bearing roots, resin seams, wooden articulation, and purposeful living growth',
		permittedTransformations: ['material', 'localized anatomy', 'equipment', 'counterplay cue'],
		alteredDimensions: ['material', 'anatomy', 'equipment', 'exposed-counterplay'],
		counterplayCue:
			'Resin-bright binding joints or fresh-cut growth expose the interruptible structure.',
		reject: 'a brown recolor, decorative antlers, or foliage pasted over the silhouette'
	},
	{
		id: 'fire',
		name: 'Fire',
		construction:
			'heat-blackened surfaces, internal ember seams, controlled combustion, smoke, and heat distortion',
		permittedTransformations: ['material', 'motion', 'attack telegraph', 'environmental wake'],
		alteredDimensions: ['material', 'motion', 'attack-telegraph', 'environmental-wake'],
		counterplayCue: 'The internal core or heat sink becomes exposed between combustion cycles.',
		reject: 'a uniform orange full-body glow that destroys material and anatomy detail'
	},
	{
		id: 'metal',
		name: 'Metal',
		construction:
			'forged anatomy, articulated load-bearing plates, metallic marrow, and controlled fragments',
		permittedTransformations: ['material', 'articulation', 'equipment', 'exposed weak point'],
		alteredDimensions: ['material', 'anatomy', 'equipment', 'exposed-counterplay'],
		counterplayCue:
			'Articulated joints or the controlling magnetic core remain materially distinct.',
		reject: 'ordinary armor presented as an affinity without transformed construction'
	},
	{
		id: 'water',
		name: 'Water',
		construction:
			'pressurized flow, mist, wet reflection, coherent fluid transitions, and a readable structural core',
		permittedTransformations: ['material', 'motion', 'attack telegraph', 'environmental wake'],
		alteredDimensions: ['material', 'motion', 'attack-telegraph', 'environmental-wake'],
		counterplayCue: 'Pressure loss exposes the coherent binding core after a committed attack.',
		reject: 'a shapeless blue blob or generic blue glow with no readable structure'
	},
	{
		id: 'wind',
		name: 'Wind',
		construction:
			'directional fur or cloth, vapor channels, debris flow, and pressure distortion with visible force',
		permittedTransformations: ['silhouette', 'motion', 'attack telegraph', 'environmental wake'],
		alteredDimensions: ['silhouette', 'motion', 'attack-telegraph', 'environmental-wake'],
		counterplayCue:
			'The still center of the pressure pattern remains visible between directional attacks.',
		reject: 'a pale recolor, transparency alone, or effects with no directional force'
	}
] as const satisfies ReadonlyArray<{
	id: AffinityId;
	name: string;
	construction: string;
	permittedTransformations: readonly string[];
	alteredDimensions: readonly (
		| 'material'
		| 'silhouette'
		| 'motion'
		| 'anatomy'
		| 'equipment'
		| 'attack-telegraph'
		| 'environmental-wake'
		| 'exposed-counterplay'
	)[];
	counterplayCue: string;
	reject: string;
}>;

const REFERENCES = {
	packTwoStyle: {
		path: 'assets/enemies/review/pack-2/monster-grade-escalation-v1.png',
		contentHash: '622a63ea55ab833f0451d29f0967f26f2335c912296ad45537e2a0889c8ecd2e',
		purpose:
			'Pack 2 realistic dark-fantasy finish and neutral presentation only; do not transfer Grade 7 or 10 scale, anatomy, weapons, glow, or the Tower Archmage'
	},
	deathKnight: {
		path: 'assets/enemies/review/pack-2/undead-v1.png',
		contentHash: '42fce852b38fe644311b6ae3cd78e38d880ce2192b6db7b5d19ea08ac61fd0aa',
		purpose:
			'Fourth subject only: Death Knight identity, command silhouette, armor load paths, and restrained necromancy; do not transfer the sentinel, wraith, or bone mage'
	},
	elemental: {
		path: 'assets/enemies/review/pack-2/elementals-v1.png',
		contentHash: '54e0d1eaa6fe6af23fe8ef2e33b1d4f6893f964561502cf47fc43e7013d63786',
		purpose:
			'Elemental material behavior, coherent cores, restrained local emission, floor, and lighting only; do not transfer any one family member’s anatomy or duty'
	},
	elementalChassis: {
		path: 'assets/enemies/review/pack-2/benchmarks/stone-breaker-anchor-v1.png',
		contentHash: '60f46984679fe5f1bb16d2277b1d1aa7c6ca943f810d22e5dfe0ad82717f92c0',
		purpose:
			'Individual bipedal elemental framing, grounded weight, wedge forearms, and readable core only; preserve the new Bound Vanguard proportions rather than copying the Stone Breaker identity'
	},
	elementalNeutralChassis: {
		path: 'assets/enemies/review/pack-2/benchmarks/bound-vanguard-neutral-anchor-v1.png',
		contentHash: 'a934483cc02570e674c16b6c51d0120aeb05029370b8ef0ab0dd9e96727156a1',
		purpose:
			'Exact Bound Vanguard headless shallow-concave chassis, proportions, planted stance, wedge forearms, and pale sternum core only; do not treat its neutral ceramic material as the affinity substance for non-Normal targets'
	},
	greyWolf: {
		path: 'assets/enemies/review/beasts-v1.webp',
		contentHash: 'd15b5b5e714076756e769ecdbb3b10c92bc9abf1e76bbf8094fd32537d47cc33',
		purpose:
			'First subject only: established Grey Wolf anatomy, coat, ground contact, and flanking silhouette; do not transfer the Dire Wolf, Cave Bear, or Tunnel Boar'
	},
	caveBear: {
		path: 'assets/enemies/review/beasts-v1.webp',
		contentHash: 'd15b5b5e714076756e769ecdbb3b10c92bc9abf1e76bbf8094fd32537d47cc33',
		purpose:
			'Third subject only: established Cave Bear anatomy, coat, grounded mass, and shoulder weight; do not transfer either wolf or the Tunnel Boar'
	},
	tunnelBoar: {
		path: 'assets/enemies/review/beasts-v1.webp',
		contentHash: 'd15b5b5e714076756e769ecdbb3b10c92bc9abf1e76bbf8094fd32537d47cc33',
		purpose:
			'Fourth subject only: established Tunnel Boar anatomy, tusks, shoulders, cloven feet, and charge line; do not transfer the wolves or Cave Bear'
	},
	goblins: {
		path: 'assets/enemies/review/goblinoids-v1.webp',
		contentHash: '7ba41d4405a752cbb19fb533a50c8b79b5ae60aa0b2aa8438afca7ce01781a32',
		purpose:
			'Established goblin species scale, adult proportions, material finish, and four canonical duty cues only; explicitly do not copy its repeated face or uniform ragged outfit distribution'
	},
	draconic: {
		path: 'assets/enemies/review/pack-2/draconic-v1.png',
		contentHash: 'b340bb2b59fd697d4de3c49a90724ca43b4e734402510e9a279410baf65b30f9',
		purpose:
			'First subject only: Wingless Cave Drake anatomy, grounded joints, digging forequarters, tunnel-lunge duty, and throat counterplay; do not transfer the wyvern or larger drakes'
	},
	basilisk: {
		path: 'assets/enemies/review/pack-2/dungeon-predators-v1.png',
		contentHash: 'f30b1130a71a00166acc4299b982c9fadf9b143c95741fea5c9e5cef4d3c9d7e',
		purpose:
			'Third subject only: Tower Basilisk low posture, gaze-lane organs, material finish, and blind flank; the ambiguous plate is not evidence for leg count, so follow the target’s textual six-leg invariant'
	}
} as const satisfies Record<string, ImageProductionReference>;

export const AFFINITY_SPECIES = [
	{
		id: 'death-knight',
		name: 'Death Knight',
		cohort: 'controlled',
		constructionMode: 'armored-undead',
		battlefieldDuty: 'formation-commander',
		chassisId: null,
		identityInvariants: [
			'undead armored commander identity',
			'skull or death mask',
			'small command pennant',
			'deliberate sword guard',
			'command seal beneath the gorget',
			'disciplined military posture'
		],
		anatomyInvariants: ['humanoid biped', 'believable armor load paths', 'two arms and two legs'],
		prohibitedTraits: [
			'random giant horns',
			'implausibly oversized sword',
			'full-body colored glow'
		],
		references: [REFERENCES.deathKnight, REFERENCES.packTwoStyle]
	},
	{
		id: 'elemental',
		name: 'Bound Vanguard Elemental',
		cohort: 'controlled',
		constructionMode: 'substance-bodied',
		battlefieldDuty: 'bound-frontline-vanguard',
		chassisId: 'bound-vanguard-elemental',
		identityInvariants: [
			'the same Bound Vanguard Elemental chassis in every affinity',
			'concentrated hexagonal core at the sternum',
			'pale arcane binding lattice that remains locally readable',
			'broad wedge forearms and a low stable torso'
		],
		anatomyInvariants: [
			'two arms and two legs',
			'no head or neck',
			'five major body masses: torso, two wedge arms, and two planted legs',
			'affinity substance changes while chassis proportions remain fixed'
		],
		prohibitedTraits: [
			'extra limbs',
			'humanoid face',
			'floating amorphous blob',
			'changed chassis proportions'
		],
		references: [REFERENCES.elementalChassis, REFERENCES.elemental, REFERENCES.packTwoStyle]
	},
	{
		id: 'grey-wolf',
		name: 'Grey Wolf',
		cohort: 'controlled',
		constructionMode: 'organic-quadruped',
		battlefieldDuty: 'flanking-predator',
		chassisId: null,
		identityInvariants: [
			'recognizable wolf face',
			'fast flanking silhouette',
			'natural predatory posture'
		],
		anatomyInvariants: ['canine anatomy', 'exactly four legs', 'credible ground contact'],
		prohibitedTraits: ['humanoid armor', 'antlers', 'wings', 'dragon anatomy'],
		references: [REFERENCES.greyWolf, REFERENCES.packTwoStyle]
	},
	{
		id: 'cave-bear',
		name: 'Cave Bear',
		cohort: 'controlled',
		constructionMode: 'organic-quadruped',
		battlefieldDuty: 'close-range-bruiser',
		chassisId: null,
		identityInvariants: ['recognizable ursine face', 'heavy shoulder mass', 'powerful forelimbs'],
		anatomyInvariants: ['ursine anatomy', 'exactly four legs', 'four-legged weight distribution'],
		prohibitedTraits: ['wolf proportions', 'humanoid golem anatomy', 'decorative saddle or rider'],
		references: [REFERENCES.caveBear, REFERENCES.packTwoStyle]
	},
	{
		id: 'goblin',
		name: 'Goblin',
		cohort: 'breadth',
		constructionMode: 'humanoid-enemy',
		battlefieldDuty: 'seeded-per-target',
		chassisId: null,
		identityInvariants: ['adult goblin identity', 'individual face', 'duty-readable equipment'],
		anatomyInvariants: ['humanoid biped', 'two arms and two legs', 'goblin-range stature'],
		prohibitedTraits: [
			'childlike proportions',
			'repeated default face',
			'affinity-locked duty or build'
		],
		references: [REFERENCES.goblins, REFERENCES.packTwoStyle]
	},
	{
		id: 'tunnel-boar',
		name: 'Tunnel Boar',
		cohort: 'breadth',
		constructionMode: 'organic-quadruped',
		battlefieldDuty: 'armored-line-breaker',
		chassisId: null,
		identityInvariants: ['low charging body', 'thick neck', 'tusks', 'head-down charge line'],
		anatomyInvariants: [
			'porcine anatomy',
			'exactly four legs',
			'cloven feet',
			'load-bearing shoulders'
		],
		prohibitedTraits: [
			'generic horned beast',
			'upright humanoid posture',
			'obscured head and tusks'
		],
		references: [REFERENCES.tunnelBoar, REFERENCES.packTwoStyle]
	},
	{
		id: 'cave-drake',
		name: 'Cave Drake',
		cohort: 'breadth',
		constructionMode: 'draconic-quadruped',
		battlefieldDuty: 'ambush-brawler',
		chassisId: null,
		identityInvariants: [
			'wingless low dragon',
			'digging shoulders',
			'battering skull',
			'readable throat vulnerability'
		],
		anatomyInvariants: [
			'exactly four legs',
			'large foreclaws',
			'credible draconic joints',
			'tail balance'
		],
		prohibitedTraits: ['wings', 'wyvern anatomy', 'hidden throat counterplay'],
		references: [REFERENCES.draconic, REFERENCES.packTwoStyle]
	},
	{
		id: 'tower-basilisk',
		name: 'Tower Basilisk',
		cohort: 'breadth',
		constructionMode: 'six-legged-reptile',
		battlefieldDuty: 'gaze-lane-controller',
		chassisId: null,
		identityInvariants: [
			'low heavy reptile',
			'rigid group of forward-facing gaze organs',
			'one controlled attack lane',
			'vulnerable blind flank'
		],
		anatomyInvariants: [
			'exactly six grounded legs visible as three coherent pairs',
			'reptilian torso and tail',
			'credible ground contact for all six legs'
		],
		prohibitedTraits: [
			'snake body',
			'ordinary four-legged lizard',
			'eight legs',
			'many-eyed amorphous mass'
		],
		references: [REFERENCES.basilisk, REFERENCES.packTwoStyle]
	}
] as const satisfies ReadonlyArray<{
	id: AffinitySpeciesId;
	name: string;
	cohort: AffinityCohortId;
	constructionMode:
		| 'armored-undead'
		| 'substance-bodied'
		| 'organic-quadruped'
		| 'humanoid-enemy'
		| 'draconic-quadruped'
		| 'six-legged-reptile';
	battlefieldDuty: string;
	chassisId: 'bound-vanguard-elemental' | null;
	identityInvariants: readonly string[];
	anatomyInvariants: readonly string[];
	prohibitedTraits: readonly string[];
	references: readonly ImageProductionReference[];
}>;

export const GOBLIN_ATTRIBUTE_OPTIONS = {
	duty: ['skirmisher', 'archer', 'hexweaver', 'chieftain', 'guard', 'scout'],
	stature: ['short', 'average', 'tall'],
	build: ['wiry', 'lean', 'sturdy', 'broad'],
	adultAgeBand: ['young-adult', 'adult', 'weathered', 'elder'],
	faceShape: [
		'narrow-diamond',
		'long-oval',
		'broad-square',
		'round-heavy',
		'angular-heart',
		'asymmetric-oblong'
	],
	nose: ['short-hooked', 'long-crooked', 'broad-flat', 'broken-bridge', 'upturned', 'sharp-ridged'],
	jaw: ['narrow', 'square', 'underbitten', 'heavy', 'tapered'],
	brow: ['straight-low', 'arched', 'heavy-ridged', 'split-scarred', 'uneven'],
	earShape: ['short-pointed', 'long-swept', 'notched', 'broad-drooping', 'uneven-pair'],
	scars: ['none', 'brow-cut', 'cheek-seam', 'split-lip', 'nose-notch', 'burn-patch'],
	asymmetry: ['subtle-eye-height', 'crooked-smile', 'uneven-ears', 'off-center-nose', 'balanced'],
	skinPalette: [
		'moss-olive',
		'lichen-grey',
		'warm-umber-green',
		'desaturated-jade',
		'ochre-olive',
		'cool-sage'
	],
	markings: ['none', 'freckles', 'ritual-dots', 'mud-stripes', 'ash-smudge', 'pale-mottling'],
	clothingSilhouette: [
		'short-tabard-and-belt',
		'cross-wrapped-tunic',
		'patched-longcoat',
		'split-hide-jerkin',
		'layered-scout-cloak',
		'sleeveless-mail-vest',
		'hooded-work-smock',
		'asymmetric-shoulder-mantle',
		'quilted-guard-coat',
		'ritual-sash-and-robe'
	],
	clothingCondition: ['maintained', 'dusty', 'patched', 'frayed', 'ceremonial'],
	footwear: [
		'bare-wrapped-feet',
		'soft-hide-shoes',
		'ankle-boots',
		'laced-sandals',
		'iron-toe-boots',
		'fur-lined-boots',
		'rope-soled-shoes',
		'shin-high-riding-boots',
		'greaved-boots',
		'mismatched-salvaged-shoes'
	],
	headwear: [
		'none',
		'cloth-hood',
		'leather-cap',
		'iron-skullcap',
		'fur-cowl',
		'wrapped-headscarf',
		'one-sided-scout-hood',
		'patched-kettle-helm',
		'ritual-circlet',
		'cheek-guard-helmet'
	],
	armorCoverage: ['none', 'light', 'asymmetric-medium', 'front-heavy', 'heavy'],
	handedness: ['left', 'right'],
	battlefieldImportance: ['rank-and-file', 'specialist', 'veteran', 'leader'],
	posture: [
		'forward-ready',
		'low-cautious',
		'upright-commanding',
		'side-on-mobile',
		'braced-defensive'
	]
} as const;

const GOBLIN_EQUIPMENT_BY_DUTY = {
	skirmisher: ['short-sword-and-buckler', 'paired-knives', 'hooked-spear'],
	archer: ['shortbow-and-quiver', 'crossbow-and-bolt-case', 'sling-and-side-knife'],
	hexweaver: [
		'bone-focus-and-hex-tags',
		'rune-staff-and-charm-bag',
		'ritual-knife-and-focus-chain'
	],
	chieftain: ['broad-cleaver-and-command-token', 'axe-and-round-shield', 'sabre-and-signal-horn'],
	guard: ['spear-and-tower-shield', 'mace-and-round-shield', 'pole-hook-and-lantern'],
	scout: ['shortbow-and-field-knife', 'javelins-and-map-case', 'hand-axe-and-signal-whistle']
} as const satisfies Record<(typeof GOBLIN_ATTRIBUTE_OPTIONS.duty)[number], readonly string[]>;

function hash32(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function chooseSeeded<const T extends readonly string[]>(
	seed: string,
	purpose: string,
	options: T
): T[number] {
	return options[
		hash32(`${AFFINITY_WORKFLOW_VERSION}\u0000${purpose}\u0000${seed}`) % options.length
	]!;
}

export function createGoblinAffinityAttributes(seed: string): GoblinAffinityAttributes {
	if (seed.trim().length === 0) throw new Error('Goblin attribute seed cannot be empty');
	const duty = chooseSeeded(seed, 'duty', GOBLIN_ATTRIBUTE_OPTIONS.duty);
	const clothingSilhouette = chooseSeeded(
		seed,
		'clothing-silhouette',
		GOBLIN_ATTRIBUTE_OPTIONS.clothingSilhouette
	);
	const clothingCondition = chooseSeeded(
		seed,
		'clothing-condition',
		GOBLIN_ATTRIBUTE_OPTIONS.clothingCondition
	);
	const footwear = chooseSeeded(seed, 'footwear', GOBLIN_ATTRIBUTE_OPTIONS.footwear);
	const headwear = chooseSeeded(seed, 'headwear', GOBLIN_ATTRIBUTE_OPTIONS.headwear);
	const weaponOrFocus = chooseSeeded(seed, 'equipment', GOBLIN_EQUIPMENT_BY_DUTY[duty]);
	return {
		seed,
		duty,
		stature: chooseSeeded(seed, 'stature', GOBLIN_ATTRIBUTE_OPTIONS.stature),
		build: chooseSeeded(seed, 'build', GOBLIN_ATTRIBUTE_OPTIONS.build),
		adultAgeBand: chooseSeeded(seed, 'adult-age-band', GOBLIN_ATTRIBUTE_OPTIONS.adultAgeBand),
		faceShape: chooseSeeded(seed, 'face-shape', GOBLIN_ATTRIBUTE_OPTIONS.faceShape),
		nose: chooseSeeded(seed, 'nose', GOBLIN_ATTRIBUTE_OPTIONS.nose),
		jaw: chooseSeeded(seed, 'jaw', GOBLIN_ATTRIBUTE_OPTIONS.jaw),
		brow: chooseSeeded(seed, 'brow', GOBLIN_ATTRIBUTE_OPTIONS.brow),
		earShape: chooseSeeded(seed, 'ear-shape', GOBLIN_ATTRIBUTE_OPTIONS.earShape),
		scars: chooseSeeded(seed, 'scars', GOBLIN_ATTRIBUTE_OPTIONS.scars),
		asymmetry: chooseSeeded(seed, 'asymmetry', GOBLIN_ATTRIBUTE_OPTIONS.asymmetry),
		skinPalette: chooseSeeded(seed, 'skin-palette', GOBLIN_ATTRIBUTE_OPTIONS.skinPalette),
		markings: chooseSeeded(seed, 'markings', GOBLIN_ATTRIBUTE_OPTIONS.markings),
		clothingSilhouette,
		clothingCondition,
		footwear,
		headwear,
		armorCoverage: chooseSeeded(seed, 'armor-coverage', GOBLIN_ATTRIBUTE_OPTIONS.armorCoverage),
		handedness: chooseSeeded(seed, 'handedness', GOBLIN_ATTRIBUTE_OPTIONS.handedness),
		battlefieldImportance: chooseSeeded(
			seed,
			'battlefield-importance',
			GOBLIN_ATTRIBUTE_OPTIONS.battlefieldImportance
		),
		weaponOrFocus,
		clothingLayers: [clothingSilhouette, `${clothingCondition}-underlayer`],
		equipmentAnchors: [weaponOrFocus, headwear, footwear],
		posture: chooseSeeded(seed, 'posture', GOBLIN_ATTRIBUTE_OPTIONS.posture)
	};
}

const GOBLIN_COHORT_SEEDS = [
	'goblin-affinity-00',
	'goblin-affinity-01',
	'goblin-affinity-02',
	'goblin-affinity-03',
	'goblin-affinity-04',
	'goblin-affinity-05'
] as const;

const SHARED_PRESENTATION = {
	styleContract:
		'Pack 2 premium realistic painterly medieval dark fantasy with coherent materials, controlled linework, grounded anatomy, and restrained local magical emission.',
	medium: 'premium realistic painterly raster character concept',
	lighting: 'controlled neutral key with restrained local affinity emission and readable materials',
	background: 'neutral cracked-stone floor against a charcoal-to-midnight backdrop',
	composition:
		'Exactly one subject; entire creature and every extremity visible, centered with finished detail across the canvas.',
	canvas: {
		width: 1536,
		height: 1024,
		mediaType: 'image/png',
		safeMarginPercent: 8
	},
	negativePrompt: [
		'No labels, text, UI, frame, logo, or watermark.',
		'No extra creature, cropped extremity, blank band, unfinished region, or abrupt canvas cutoff.',
		'No resemblance to a published character or reference person.'
	]
} as const;

export const BREADTH_AFFINITY_RELEASE_GATE = {
	requiresCohort: 'controlled',
	requiredCompletedTargets: 24,
	requiredSpeciesRecognitions: 23,
	requiredAffinityRecognitions: 20,
	requiresWorkflowPass: true
} as const;

function createGoblinVariation(
	attributes: GoblinAffinityAttributes,
	affinity: (typeof AFFINITY_DEFINITIONS)[number]
): NonNullable<ImageProductionTarget['goblinVariation']> {
	return {
		seed: attributes.seed,
		battlefieldDuty: attributes.duty,
		stature: attributes.stature,
		build: attributes.build,
		adultAgeBand: attributes.adultAgeBand,
		face: {
			shape: attributes.faceShape,
			nose: attributes.nose,
			jaw: attributes.jaw,
			brow: attributes.brow,
			ears: attributes.earShape,
			scarsOrAsymmetry: `${attributes.scars}; ${attributes.asymmetry}`
		},
		skinPalette: attributes.skinPalette,
		localizedMarkings: attributes.markings,
		clothingSilhouette: attributes.clothingSilhouette,
		clothingLayers: [...attributes.clothingLayers],
		materialCondition: attributes.clothingCondition,
		footwear: attributes.footwear,
		headwear: attributes.headwear,
		armorCoverage: attributes.armorCoverage,
		handedness: attributes.handedness,
		weaponOrFocus: attributes.weaponOrFocus,
		posture: attributes.posture,
		equipmentAnchors: [...attributes.equipmentAnchors],
		affinityExpression: affinity.construction,
		counterplayCue: affinity.counterplayCue
	};
}

export function createAffinityWorkflowTarget(
	speciesId: AffinitySpeciesId,
	affinityId: AffinityId
): AffinityWorkflowTarget {
	const species = AFFINITY_SPECIES.find((candidate) => candidate.id === speciesId);
	const affinity = AFFINITY_DEFINITIONS.find((candidate) => candidate.id === affinityId);
	if (!species) throw new Error(`Unknown affinity species: ${speciesId}`);
	if (!affinity) throw new Error(`Unknown affinity: ${affinityId}`);
	const targetId = `${AFFINITY_WORKFLOW_VERSION}-${speciesId}-${affinityId}`;
	const goblinIndex = AFFINITY_IDS.indexOf(affinityId);
	const goblinAttributes =
		speciesId === 'goblin'
			? createGoblinAffinityAttributes(GOBLIN_COHORT_SEEDS[goblinIndex]!)
			: null;
	const legacyBasicAuthoring =
		speciesId === 'death-knight' ||
		speciesId === 'elemental' ||
		(speciesId === 'grey-wolf' && affinityId === 'normal');
	const source = {
		schemaVersion: 'image-production-target-v1',
		targetId,
		assetId: targetId,
		packId: 'pack-2',
		experimentId: AFFINITY_WORKFLOW_VERSION,
		promptProtocol:
			speciesId === 'death-knight'
				? 'canonical-v1'
				: speciesId === 'elemental' ||
					  (speciesId === 'grey-wolf' && ['normal', 'fire'].includes(affinityId))
					? 'safe-frame-v2'
					: IMMUTABLE_SAFE_FRAME_V3_TARGET_IDS.has(targetId)
						? 'safe-frame-v3'
						: 'safe-frame-v4',
		authoringProtocol: legacyBasicAuthoring ? 'basic-v1' : 'semantic-v2',
		cohort: species.cohort,
		speciesId,
		...(species.chassisId ? { chassisId: species.chassisId } : {}),
		affinity: affinityId,
		affinityDesign: {
			alteredDimensions: [...affinity.alteredDimensions],
			expression: affinity.construction,
			counterplayCue: affinity.counterplayCue
		},
		threat: {
			presentationTier: 'elite',
			referenceGrade: 4,
			canonicalGrade:
				speciesId === 'death-knight' || speciesId === 'cave-drake' || speciesId === 'tower-basilisk'
					? 4
					: null
		},
		battlefieldDutyId: goblinAttributes?.duty ?? species.battlefieldDuty,
		constructionMode: species.constructionMode,
		identityInvariants: [...species.identityInvariants],
		anatomyInvariants: [...species.anatomyInvariants],
		permittedTransformations: [...affinity.permittedTransformations],
		prohibitedTraits: [...species.prohibitedTraits, affinity.reject],
		...(goblinAttributes
			? { goblinVariation: createGoblinVariation(goblinAttributes, affinity) }
			: {}),
		references: [...species.references],
		presentation: SHARED_PRESENTATION,
		acceptanceCriteria: [
			{
				criterionId: 'complete-safe-frame',
				kind: 'objective',
				description:
					'Entire silhouette and all extremities are complete with at least eight percent safe margin.',
				required: true
			},
			{
				criterionId: 'single-finished-subject',
				kind: 'objective',
				description:
					'Exactly one subject appears and every canvas region is intentionally finished.',
				required: true
			},
			...(!legacyBasicAuthoring
				? [
						{
							criterionId: 'protocol-provenance',
							kind: 'objective' as const,
							description:
								'The first submitted prompt exactly matches the declared canonical renderer and all retained source provenance is complete.',
							required: true
						},
						{
							criterionId: 'manifest-fidelity',
							kind: 'objective' as const,
							description:
								'Every identity, anatomy, duty, equipment, and prohibited-trait invariant is visibly satisfied.',
							required: true
						},
						{
							criterionId:
								affinityId === 'normal'
									? 'normal-unaffiliated-fidelity'
									: 'affinity-construction-fidelity',
							kind: 'objective' as const,
							description:
								affinityId === 'normal'
									? 'The subject reads as explicitly unaffiliated, without accidental elemental materials, glow, anatomy, or wake.'
									: 'The declared affinity visibly changes at least two listed construction dimensions rather than acting as a color or effect overlay.',
							required: true
						},
						...(affinityId !== 'normal'
							? [
									{
										criterionId: 'visible-counterplay-cue',
										kind: 'objective' as const,
										description:
											'The target-declared weak point or counterplay state is visibly readable in this still image.',
										required: true
									}
								]
							: [])
					]
				: []),
			{
				criterionId: 'blind-species-identity',
				kind: 'human-review',
				description: 'A blind reviewer recognizes the species without seeing the target label.',
				required: true
			},
			{
				criterionId: 'blind-affinity-integration',
				kind: 'human-review',
				description:
					affinityId === 'normal'
						? 'A blind reviewer reads the subject as unaffiliated and free of accidental elemental coding.'
						: 'A blind reviewer recognizes the affinity through at least two visual dimensions rather than color alone.',
				required: true
			}
		],
		output: {
			candidatePath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/candidates/${speciesId}/${affinityId}-v1.png`,
			resultPath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/results/${speciesId}-${affinityId}-v1.json`
		}
	};
	return ImageProductionTargetSchema.parse(source);
}

const ELEMENTAL_REGRESSION_DESIGNS = {
	normal: {
		alteredDimensions: [] as const,
		expression:
			'Neutral matte ceramic composite forms every load-bearing body mass, with subtle manufactured seams and no elemental material, glow, weather, or wake.',
		counterplayCue:
			'The invariant pale sternum core is readable inside the shallow concave chest without implying an elemental affinity.',
		bodyCriterionId: 'neutral-composite-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are a coherent neutral ceramic composite with no elemental read.',
		prohibited: [
			'elemental flame, foliage, forged metal, flowing water, ice, wind, vapor, or affinity-colored aura',
			'rock, rubble, crystal, or natural stone anatomy',
			'accidental elemental read of any kind'
		]
	},
	wood: {
		alteredDimensions: ['material', 'anatomy', 'exposed-counterplay'] as const,
		expression:
			'Continuous load-bearing hardwood forms every major body mass through visible grain, growth rings, root-bundled joints, and restrained resin seams; no stone substrate.',
		counterplayCue:
			'Fresh pale growth rings around the invariant sternum core and root joints expose the binding structure.',
		bodyCriterionId: 'declared-substance-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are structurally made from wood grain, growth rings, and roots rather than carrying decorative bark.',
		prohibited: [
			'rock, rubble, crystal, ceramic, or stone anatomy beneath decorative bark',
			'foliage or antlers pasted onto an unchanged body',
			'brown recolor standing in for wood construction'
		]
	},
	fire: {
		alteredDimensions: ['material', 'motion', 'attack-telegraph'] as const,
		expression:
			'Controlled flame and dense plasma form every load-bearing body mass inside the binding lattice, with minimal dark slag confined to planted contact pads.',
		counterplayCue:
			'The pale sternum core and binding lattice become sharply readable between controlled plasma surges.',
		bodyCriterionId: 'declared-substance-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are continuous flame and plasma volumes, with only minimal slag at ground contact.',
		prohibited: [
			'rock, lava-rock, charcoal boulders, or stone anatomy with flames pasted on top',
			'large slag shell obscuring the flame-and-plasma body',
			'uniform orange glow that erases the fixed chassis'
		]
	},
	metal: {
		alteredDimensions: ['material', 'anatomy', 'exposed-counterplay'] as const,
		expression:
			'Forged specular planes, articulated metallic joints, and luminous metal marrow form every load-bearing body mass with no stone substrate.',
		counterplayCue:
			'The pale sternum core and luminous metal marrow remain distinct through the articulated chest and joint gaps.',
		bodyCriterionId: 'declared-substance-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are forged metal anatomy with specular planes, articulated joints, and visible metallic marrow.',
		prohibited: [
			'rock, rubble, ceramic, or stone anatomy wearing ordinary armor',
			'metal plates applied over an unchanged golem body',
			'rusted brown surface that hides forged planes and joints'
		]
	},
	water: {
		alteredDimensions: ['material', 'motion', 'exposed-counterplay'] as const,
		expression:
			'Continuous pressurized liquid forms every load-bearing body mass through coherent flow, transparent depth, wet reflection, and restrained mist; no ice or stone substrate.',
		counterplayCue:
			'The pale sternum core remains visible inside a localized low-pressure pocket in the continuous liquid chest.',
		bodyCriterionId: 'declared-substance-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are continuous coherent liquid volumes rather than a solid body with water effects.',
		prohibited: [
			'ice, snow, frost, rock, rubble, ceramic, or stone anatomy',
			'blue solid golem with splashes applied around it',
			'shapeless blob that loses the fixed chassis'
		]
	},
	wind: {
		alteredDimensions: ['material', 'silhouette', 'motion'] as const,
		expression:
			'Compressed air, directional vapor channels, pressure distortion, and disciplined negative space form every load-bearing body mass with no rock substrate.',
		counterplayCue:
			'The pale sternum core sits in the still low-pressure center of the otherwise directional vapor body.',
		bodyCriterionId: 'declared-substance-body',
		bodyCriterion:
			'Torso, wedge arms, and planted legs are visibly structured from compressed air, vapor, and negative space rather than a transparent solid.',
		prohibited: [
			'rock, rubble, crystal, ceramic, or stone anatomy inside the vapor',
			'pale transparent recolor standing in for wind construction',
			'random fog with no directional pressure or fixed chassis'
		]
	}
} as const satisfies Record<
	AffinityId,
	{
		alteredDimensions: readonly (
			| 'material'
			| 'silhouette'
			| 'motion'
			| 'anatomy'
			| 'equipment'
			| 'attack-telegraph'
			| 'environmental-wake'
			| 'exposed-counterplay'
		)[];
		expression: string;
		counterplayCue: string;
		bodyCriterionId: 'declared-substance-body' | 'neutral-composite-body';
		bodyCriterion: string;
		prohibited: readonly string[];
	}
>;

export function createElementalRegressionTarget(affinityId: AffinityId): AffinityWorkflowTarget {
	const affinity = AFFINITY_DEFINITIONS.find((candidate) => candidate.id === affinityId);
	if (!affinity) throw new Error(`Unknown affinity: ${affinityId}`);
	const design = ELEMENTAL_REGRESSION_DESIGNS[affinityId];
	const targetId = `${AFFINITY_WORKFLOW_VERSION}-elemental-${affinityId}-${ELEMENTAL_REGRESSION_VERSION}`;
	return ImageProductionTargetSchema.parse({
		schemaVersion: 'image-production-target-v1',
		targetId,
		assetId: targetId,
		packId: 'pack-2',
		experimentId: AFFINITY_WORKFLOW_VERSION,
		promptProtocol: 'safe-frame-v3',
		authoringProtocol: 'semantic-v2',
		cohort: 'regression',
		speciesId: 'elemental',
		chassisId: 'bound-vanguard-elemental',
		affinity: affinityId,
		affinityDesign: {
			alteredDimensions: [...design.alteredDimensions],
			expression: design.expression,
			counterplayCue: design.counterplayCue
		},
		threat: {
			presentationTier: 'elite',
			referenceGrade: 4,
			canonicalGrade: null
		},
		battlefieldDutyId: 'bound-frontline-vanguard',
		constructionMode: 'substance-bodied',
		identityInvariants: [
			'exactly the headless Bound Vanguard Elemental shown in the neutral chassis benchmark',
			'fixed broad shallow concave chest with a low stable torso',
			'fixed broad wedge forearms, short planted legs, and benchmark-matched proportions',
			'invariant pale arcane sternum core centered inside the chest concavity',
			'pale binding lattice remains local and does not recolor the full body'
		],
		anatomyInvariants: [
			'exactly two arms and two legs',
			'no head, face, neck, shoulders above the chest, or substitute head-like mass',
			'exactly five major masses: shallow-concave torso, two wedge arms, and two planted legs',
			'the declared substance carries the full torso, arm, and leg loads while chassis proportions remain fixed'
		],
		permittedTransformations: [...affinity.permittedTransformations],
		prohibitedTraits: [
			'extra limbs or detached floating body masses',
			'humanoid head, face, helmet, neck, or shoulder-mounted pseudo-head',
			'domed or convex chest replacing the shallow concavity',
			'dark, affinity-colored, absent, displaced, or oversized sternum core',
			'changed chassis proportions, raised heroic posture, or long humanoid legs',
			...design.prohibited
		],
		references: [
			REFERENCES.elementalNeutralChassis,
			{
				...REFERENCES.elemental,
				purpose:
					'Elementals-v1 plate supplies only the declared substance material behavior, coherent flow, restrained local emission, floor, and lighting; do not transfer any depicted anatomy, pose, proportions, head, duty, or core placement'
			},
			REFERENCES.packTwoStyle
		],
		presentation: SHARED_PRESENTATION,
		acceptanceCriteria: [
			{
				criterionId: 'complete-safe-frame',
				kind: 'objective',
				description:
					'Entire silhouette and all extremities are complete with at least eight percent safe margin.',
				required: true
			},
			{
				criterionId: 'single-finished-subject',
				kind: 'objective',
				description:
					'Exactly one subject appears and every canvas region is intentionally finished.',
				required: true
			},
			{
				criterionId: 'manifest-fidelity',
				kind: 'objective',
				description:
					'Every identity, anatomy, duty, reference-purpose, and prohibited-trait invariant is visibly satisfied.',
				required: true
			},
			{
				criterionId:
					affinityId === 'normal'
						? 'normal-unaffiliated-fidelity'
						: 'affinity-construction-fidelity',
				kind: 'objective',
				description:
					affinityId === 'normal'
						? 'The body reads as explicitly unaffiliated, without accidental elemental materials, glow, anatomy, or wake.'
						: 'The declared affinity visibly changes at least two listed construction dimensions rather than acting as a color or effect overlay.',
				required: true
			},
			...(affinityId === 'normal'
				? []
				: [
						{
							criterionId: 'visible-counterplay-cue',
							kind: 'objective' as const,
							description:
								'The target-declared weak point or counterplay state is visibly readable in this still image.',
							required: true
						}
					]),
			{
				criterionId: 'fixed-chassis-fidelity',
				kind: 'objective',
				description:
					'The subject matches the benchmark headless shallow-concave chassis, proportions, wedge arms, planted legs, and pale sternum core.',
				required: true
			},
			{
				criterionId: design.bodyCriterionId,
				kind: 'objective',
				description: design.bodyCriterion,
				required: true
			},
			{
				criterionId: 'blind-species-identity',
				kind: 'human-review',
				description: 'A blind reviewer recognizes the fixed Bound Vanguard Elemental species.',
				required: true
			},
			{
				criterionId: 'blind-affinity-integration',
				kind: 'human-review',
				description:
					affinityId === 'normal'
						? 'A blind reviewer reads the ceramic composite body as neutral and explicitly unaffiliated.'
						: 'A blind reviewer recognizes the affinity from the load-bearing substance body rather than color or effects alone.',
				required: true
			}
		],
		output: {
			candidatePath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/candidates/regression/elemental/${affinityId}-${ELEMENTAL_REGRESSION_VERSION}.png`,
			resultPath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/results/regression/elemental-${affinityId}-${ELEMENTAL_REGRESSION_VERSION}.json`
		}
	});
}

const CORRECTION_SOURCE_REFERENCES = {
	deathKnightMetalV2: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/regression/death-knight/metal-v2.png',
		contentHash: '24715b4bbb1fa648a547034cc6eec56a29ade33bc093a22f9070a8f4779625bd',
		purpose:
			'Retained Metal v2 candidate supplies the successful forged ribcage, metallic marrow, articulated joints, magnetic core, commander identity, and restrained finish only; shorten and raise the sword so its point clears the bottom safe border'
	},
	deathKnightNormalContrast: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/death-knight/normal-v1.png',
		contentHash: '571a3c96c11e06deea033ad602f74f742b9dcfcdf8004016ff5dc41831675769',
		purpose:
			'Normal Death Knight candidate is a negative contrast reference only: the corrected Metal construction must remain recognizably related while differing through structural forged anatomy, articulation, and metallic marrow'
	},
	greyWolfFire: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/grey-wolf/fire-v1.png',
		contentHash: 'e845d07374a1d7709b520570f84c36cc441170012b57dc4c64808cea9243cfed',
		purpose:
			'Previous Fire Grey Wolf candidate supplies the retained wolf identity, fire integration, stance, and finish; reproduce that design through canonical manifest-bound prompt provenance rather than copying unrelated traits'
	},
	caveBearWood: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/cave-bear/wood-v1.png',
		contentHash: '6acf22b3da726f4f3682841ea36f8f57f7e5e8835227f933f5b399ad1b6fedd8',
		purpose:
			'Previous Wood Cave Bear candidate supplies the retained ursine identity and load-bearing wood design; preserve those cues while changing the stance so all four paws are independently visible'
	},
	caveBearWind: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/cave-bear/wind-v1.png',
		contentHash: '2e259a5dd3cc6a6dcad32b40a5e0b984298edfc1fd573ffe52d3551cf48bb0fc',
		purpose:
			'Previous Wind Cave Bear candidate supplies the retained ursine identity, directional fur, vapor channels, and pressure wake; preserve those cues while revealing four independent paws'
	},
	elementalFire: {
		path: 'assets/enemies/experiments/affinity-workflow-v1/candidates/regression/elemental/fire-v2.png',
		contentHash: '5fa32c011896fe139c39a8e4e32f104105e48e8ec5eb3a7124a045da1353f0f1',
		purpose:
			'Previous Fire Bound Vanguard candidate supplies the retained headless chassis and continuous load-bearing flame-and-plasma construction; preserve the design while containing every flame and smoke wisp inside the safe frame'
	}
} as const satisfies Record<string, ImageProductionReference>;

type CorrectionRegressionConfig = Readonly<{
	speciesId: 'death-knight' | 'grey-wolf' | 'cave-bear' | 'elemental';
	affinityId: 'metal' | 'fire' | 'wood' | 'wind';
	version: 'v2' | 'v3';
	sourceTarget: AffinityWorkflowTarget;
	references: readonly ImageProductionReference[];
	identityInvariants?: readonly string[];
	anatomyInvariants?: readonly string[];
	prohibitedTraits?: readonly string[];
	affinityExpression?: string;
	composition: string;
	correctionCriterion: Readonly<{
		criterionId: string;
		description: string;
	}>;
}>;

const CORRECTION_REGRESSION_CONFIGS = [
	{
		speciesId: 'death-knight',
		affinityId: 'metal',
		version: CORRECTION_REGRESSION_VERSION,
		sourceTarget: createAffinityWorkflowTarget('death-knight', 'metal'),
		references: [CORRECTION_SOURCE_REFERENCES.deathKnightNormalContrast, REFERENCES.deathKnight],
		identityInvariants: [
			'the ribcage, spine, limb bones, and joints are themselves forged metal construction rather than a body hidden by ordinary plate armor'
		],
		anatomyInvariants: [
			'articulated metallic marrow visibly carries load through the torso, arms, and legs'
		],
		prohibitedTraits: [
			'ordinary armored knight silhouette with an unchanged body concealed beneath conventional plate',
			'construction materially indistinguishable from the Normal Death Knight reference'
		],
		affinityExpression:
			'Forged anatomy replaces the ordinary hidden body: articulated load-bearing plates interlock with visible metallic marrow across ribcage, spine, limbs, and joints, while controlled fragments orbit a distinct magnetic core.',
		composition:
			'Exactly one full-body Death Knight in a disciplined three-quarter command stance; sword, boots, pennant finial, cape ends, and every controlled fragment remain centered inside the inner eighty-four percent of the finished canvas.',
		correctionCriterion: {
			criterionId: 'forged-body-distinction',
			description:
				'The Metal variant visibly uses load-bearing forged anatomy, articulated metallic marrow, and a controlling core and cannot be mistaken for the Normal Death Knight merely wearing ordinary armor.'
		}
	},
	{
		speciesId: 'grey-wolf',
		affinityId: 'fire',
		version: CORRECTION_REGRESSION_VERSION,
		sourceTarget: createAffinityWorkflowTarget('grey-wolf', 'fire'),
		references: [CORRECTION_SOURCE_REFERENCES.greyWolfFire, REFERENCES.greyWolf],
		prohibitedTraits: ['uncanonical prompt or incomplete reference provenance'],
		composition:
			'Exactly one full-body Fire Grey Wolf in the approved flanking stance; nose, tail, paws, flame tips, smoke, and heat distortion remain centered inside the inner eighty-four percent of the fully finished canvas.',
		correctionCriterion: {
			criterionId: 'canonical-provenance-rerun',
			description:
				'The accepted design is regenerated from the exact safe-frame-v4 semantic-v2 manifest prompt with every declared reference attached in order and complete retained provenance.'
		}
	},
	{
		speciesId: 'cave-bear',
		affinityId: 'wood',
		version: CORRECTION_REGRESSION_VERSION,
		sourceTarget: createAffinityWorkflowTarget('cave-bear', 'wood'),
		references: [CORRECTION_SOURCE_REFERENCES.caveBearWood, REFERENCES.caveBear],
		anatomyInvariants: [
			'all four paws are separately readable with visible ground contact and no hind-paw occlusion'
		],
		prohibitedTraits: ['overlapping legs or stance that hides either hind paw'],
		composition:
			'Exactly one full-body Wood Cave Bear in a grounded broadside-to-three-quarter stance, with staggered legs and all four paws independently visible; every root tip and extremity remains inside the inner eighty-four percent of the finished canvas.',
		correctionCriterion: {
			criterionId: 'four-readable-paws',
			description:
				'Exactly four anatomically coherent paws are independently readable, visibly contact the floor, and do not overlap or disappear behind another leg.'
		}
	},
	{
		speciesId: 'cave-bear',
		affinityId: 'wind',
		version: CORRECTION_REGRESSION_VERSION,
		sourceTarget: createAffinityWorkflowTarget('cave-bear', 'wind'),
		references: [CORRECTION_SOURCE_REFERENCES.caveBearWind, REFERENCES.caveBear],
		anatomyInvariants: [
			'all four paws are separately readable with visible ground contact and no hind-paw occlusion'
		],
		prohibitedTraits: ['overlapping legs, vapor, or debris that hides either hind paw'],
		composition:
			'Exactly one full-body Wind Cave Bear in a grounded broadside-to-three-quarter stance, with staggered legs and all four paws independently visible; paws remain unobscured by vapor, and every wind effect remains inside the inner eighty-four percent of the finished canvas.',
		correctionCriterion: {
			criterionId: 'four-readable-paws',
			description:
				'Exactly four anatomically coherent paws are independently readable, visibly contact the floor, and remain unobscured by overlapping legs, vapor, or debris.'
		}
	},
	{
		speciesId: 'elemental',
		affinityId: 'fire',
		version: 'v3',
		sourceTarget: createElementalRegressionTarget('fire'),
		references: [CORRECTION_SOURCE_REFERENCES.elementalFire, REFERENCES.elementalNeutralChassis],
		anatomyInvariants: [
			'every visible flame, plasma tongue, spark, and smoke wisp remains part of the single bounded body presentation and inside the safe frame'
		],
		prohibitedTraits: [
			'flame, sparks, smoke, or heat distortion entering the outer eight-percent border'
		],
		composition:
			'Exactly one full-body Fire Bound Vanguard, deliberately scaled down and centered so its hard chassis plus every flame tip, spark, smoke wisp, and heat-distortion edge remain inside the inner eighty-four percent of the fully finished canvas.',
		correctionCriterion: {
			criterionId: 'bounded-combustion-safe-frame',
			description:
				'The approved continuous flame-and-plasma body is preserved while every visible combustion effect retains at least eight percent margin from every canvas edge.'
		}
	}
] as const satisfies readonly CorrectionRegressionConfig[];

function createCorrectionRegressionTarget(
	config: CorrectionRegressionConfig
): AffinityWorkflowTarget {
	const source = config.sourceTarget;
	const semanticCriteria = [
		{
			criterionId: 'protocol-provenance',
			kind: 'objective' as const,
			description:
				'The first submitted prompt exactly matches the declared canonical renderer and all retained source provenance is complete.',
			required: true
		},
		{
			criterionId: 'manifest-fidelity',
			kind: 'objective' as const,
			description:
				'Every identity, anatomy, duty, equipment, reference-purpose, and prohibited-trait invariant is visibly satisfied.',
			required: true
		},
		{
			criterionId: 'affinity-construction-fidelity',
			kind: 'objective' as const,
			description:
				'The declared affinity visibly changes at least two listed construction dimensions rather than acting as a color or effect overlay.',
			required: true
		},
		{
			criterionId: 'visible-counterplay-cue',
			kind: 'objective' as const,
			description:
				'The target-declared weak point or counterplay state is visibly readable in this still image.',
			required: true
		}
	];
	const existingCriterionIds = new Set(
		source.acceptanceCriteria.map((criterion) => criterion.criterionId)
	);
	const targetId = `${AFFINITY_WORKFLOW_VERSION}-${config.speciesId}-${config.affinityId}-${config.version}`;
	return ImageProductionTargetSchema.parse({
		...source,
		targetId,
		assetId: targetId,
		promptProtocol: 'safe-frame-v4',
		authoringProtocol: 'semantic-v2',
		cohort: 'regression',
		affinityDesign: {
			...source.affinityDesign,
			...(config.affinityExpression ? { expression: config.affinityExpression } : {})
		},
		identityInvariants: [...source.identityInvariants, ...(config.identityInvariants ?? [])],
		anatomyInvariants: [...source.anatomyInvariants, ...(config.anatomyInvariants ?? [])],
		prohibitedTraits: [...source.prohibitedTraits, ...(config.prohibitedTraits ?? [])],
		references: [...config.references],
		presentation: {
			...source.presentation,
			composition: config.composition
		},
		acceptanceCriteria: [
			...source.acceptanceCriteria,
			...semanticCriteria.filter((criterion) => !existingCriterionIds.has(criterion.criterionId)),
			{
				...config.correctionCriterion,
				kind: 'objective',
				required: true
			}
		],
		output: {
			candidatePath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/candidates/regression/${config.speciesId}/${config.affinityId}-${config.version}.png`,
			resultPath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/results/regression/${config.speciesId}-${config.affinityId}-${config.version}.json`
		}
	});
}

function createCohortTargets(cohort: AffinityCohortId): readonly AffinityWorkflowTarget[] {
	return AFFINITY_SPECIES.filter((species) => species.cohort === cohort).flatMap((species) =>
		AFFINITY_IDS.map((affinityId) => createAffinityWorkflowTarget(species.id, affinityId))
	);
}

export const CONTROLLED_AFFINITY_TARGETS = createCohortTargets('controlled');
export const BREADTH_AFFINITY_TARGETS = createCohortTargets('breadth');
export const BASE_AFFINITY_TARGETS = [
	...CONTROLLED_AFFINITY_TARGETS,
	...BREADTH_AFFINITY_TARGETS
] as const;
export const ELEMENTAL_REGRESSION_TARGETS = AFFINITY_IDS.map((affinityId) =>
	createElementalRegressionTarget(affinityId)
);
export const CORRECTION_REGRESSION_TARGETS = CORRECTION_REGRESSION_CONFIGS.map((config) =>
	createCorrectionRegressionTarget(config)
);
const deathKnightMetalV2 = CORRECTION_REGRESSION_TARGETS.find(
	(target) => target.targetId === `${AFFINITY_WORKFLOW_VERSION}-death-knight-metal-v2`
)!;
export const FINAL_FRAMING_REGRESSION_TARGETS = [
	ImageProductionTargetSchema.parse({
		...deathKnightMetalV2,
		targetId: `${AFFINITY_WORKFLOW_VERSION}-death-knight-metal-v3`,
		assetId: `${AFFINITY_WORKFLOW_VERSION}-death-knight-metal-v3`,
		references: [CORRECTION_SOURCE_REFERENCES.deathKnightMetalV2, REFERENCES.deathKnight],
		prohibitedTraits: [
			...deathKnightMetalV2.prohibitedTraits,
			'sword point, pennant finial, cape, or controlled fragment entering the outer eight-percent border'
		],
		presentation: {
			...deathKnightMetalV2.presentation,
			composition:
				'Exactly one full-body Metal Death Knight in a disciplined upright three-quarter command stance with a deliberately shorter sword held higher and closer to the body; boots, sword point, pennant finial, cape ends, and every controlled fragment remain clearly inside the inner eighty-four percent of the finished canvas.'
		},
		acceptanceCriteria: [
			...deathKnightMetalV2.acceptanceCriteria,
			{
				criterionId: 'bounded-sword-safe-frame',
				kind: 'objective',
				description:
					'The successful forged-body design is preserved while the complete sword point and every other hard or effect extent retain at least eight percent margin from every canvas edge.',
				required: true
			}
		],
		output: {
			candidatePath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/candidates/regression/death-knight/metal-v3.png`,
			resultPath: `assets/enemies/experiments/${AFFINITY_WORKFLOW_VERSION}/results/regression/death-knight-metal-v3.json`
		}
	})
] as const;
export const ALL_AFFINITY_TARGETS = [
	...BASE_AFFINITY_TARGETS,
	...ELEMENTAL_REGRESSION_TARGETS,
	...CORRECTION_REGRESSION_TARGETS,
	...FINAL_FRAMING_REGRESSION_TARGETS
] as const;

const GOBLIN_AUDIT_AXES = [
	'duty',
	'stature',
	'build',
	'faceShape',
	'nose',
	'jaw',
	'brow',
	'earShape',
	'skinPalette',
	'clothingSilhouette',
	'clothingCondition',
	'battlefieldImportance'
] as const;

type GoblinAuditAxis = (typeof GOBLIN_AUDIT_AXES)[number];
type GoblinAuditRow = Readonly<{ affinityId: AffinityId; attributes: GoblinAffinityAttributes }>;

export type GoblinManifestAuditSummary = Readonly<{
	version: 'goblin-affinity-audit-v1';
	seed: string;
	sampleSize: number;
	coverage: readonly Readonly<{
		axis: GoblinAuditAxis | 'affinityId';
		expectedValues: number;
		observedValues: number;
		minimumCount: number;
		requiredMinimumCount: number;
		passed: boolean;
	}>[];
	correlations: readonly Readonly<{
		leftAxis: 'affinityId';
		rightAxis: GoblinAuditAxis;
		biasCorrectedCramersV: number;
		maximumAllowed: number;
		passed: boolean;
	}>[];
	gates: Readonly<{
		coveragePassed: boolean;
		correlationPassed: boolean;
		passed: boolean;
	}>;
}>;

function countValues(values: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return counts;
}

function biasCorrectedCramersV(left: readonly string[], right: readonly string[]): number {
	if (left.length !== right.length || left.length < 2) return 0;
	const leftValues = [...new Set(left)];
	const rightValues = [...new Set(right)];
	if (leftValues.length < 2 || rightValues.length < 2) return 0;
	const leftCounts = countValues(left);
	const rightCounts = countValues(right);
	const table = new Map<string, number>();
	for (let index = 0; index < left.length; index += 1) {
		const key = `${left[index]}\u0000${right[index]}`;
		table.set(key, (table.get(key) ?? 0) + 1);
	}
	let chiSquared = 0;
	for (const leftValue of leftValues) {
		for (const rightValue of rightValues) {
			const expected =
				((leftCounts.get(leftValue) ?? 0) * (rightCounts.get(rightValue) ?? 0)) / left.length;
			if (expected === 0) continue;
			const observed = table.get(`${leftValue}\u0000${rightValue}`) ?? 0;
			chiSquared += (observed - expected) ** 2 / expected;
		}
	}
	const sampleSize = left.length;
	const phiSquared = chiSquared / sampleSize;
	const rows = leftValues.length;
	const columns = rightValues.length;
	const correctedPhiSquared = Math.max(
		0,
		phiSquared - ((columns - 1) * (rows - 1)) / (sampleSize - 1)
	);
	const correctedRows = rows - (rows - 1) ** 2 / (sampleSize - 1);
	const correctedColumns = columns - (columns - 1) ** 2 / (sampleSize - 1);
	const denominator = Math.min(correctedColumns - 1, correctedRows - 1);
	return denominator <= 0 ? 0 : Math.sqrt(correctedPhiSquared / denominator);
}

function optionsForAuditAxis(axis: GoblinAuditAxis): readonly string[] {
	return GOBLIN_ATTRIBUTE_OPTIONS[axis];
}

export function summarizeGoblinManifestAudit(
	rows: readonly GoblinAuditRow[],
	seed = 'provided-rows'
): GoblinManifestAuditSummary {
	if (rows.length < 1) throw new Error('Goblin manifest audit requires at least one row');
	const requiredCount = (optionCount: number) =>
		rows.length >= 600 ? Math.max(1, Math.floor(rows.length / optionCount / 3)) : 1;
	const coverageInputs = [
		{
			axis: 'affinityId' as const,
			values: rows.map((row) => row.affinityId),
			options: AFFINITY_IDS
		},
		...GOBLIN_AUDIT_AXES.map((axis) => ({
			axis,
			values: rows.map((row) => row.attributes[axis]),
			options: optionsForAuditAxis(axis)
		}))
	];
	const coverage = coverageInputs.map(({ axis, values, options }) => {
		const counts = countValues(values);
		const minimumCount = Math.min(...options.map((value) => counts.get(value) ?? 0));
		const requiredMinimumCount = requiredCount(options.length);
		return {
			axis,
			expectedValues: options.length,
			observedValues: options.filter((value) => counts.has(value)).length,
			minimumCount,
			requiredMinimumCount,
			passed: counts.size === options.length && minimumCount >= requiredMinimumCount
		};
	});
	const maximumAllowed = rows.length >= 600 ? 0.16 : 0.36;
	const affinities = rows.map((row) => row.affinityId);
	const correlations = GOBLIN_AUDIT_AXES.map((axis) => {
		const value = biasCorrectedCramersV(
			affinities,
			rows.map((row) => row.attributes[axis])
		);
		return {
			leftAxis: 'affinityId' as const,
			rightAxis: axis,
			biasCorrectedCramersV: Number(value.toFixed(4)),
			maximumAllowed,
			passed: value <= maximumAllowed
		};
	});
	const coveragePassed = coverage.every((entry) => entry.passed);
	const correlationPassed = correlations.every((entry) => entry.passed);
	return {
		version: 'goblin-affinity-audit-v1',
		seed,
		sampleSize: rows.length,
		coverage,
		correlations,
		gates: {
			coveragePassed,
			correlationPassed,
			passed: coveragePassed && correlationPassed
		}
	};
}

export function createGoblinManifestAudit(
	sampleSize: 60 | 600,
	seed: string
): GoblinManifestAuditSummary {
	if (seed.trim().length === 0) throw new Error('Goblin audit seed cannot be empty');
	const affinityOffset =
		hash32(`${AFFINITY_WORKFLOW_VERSION}\u0000affinity-offset\u0000${seed}`) % AFFINITY_IDS.length;
	const rows = Array.from({ length: sampleSize }, (_, index): GoblinAuditRow => ({
		affinityId: AFFINITY_IDS[(index + affinityOffset) % AFFINITY_IDS.length]!,
		attributes: createGoblinAffinityAttributes(`${seed}:${index}`)
	}));
	return summarizeGoblinManifestAudit(rows, seed);
}

export const GOBLIN_AFFINITY_AUDIT_60 = createGoblinManifestAudit(
	60,
	'goblin-affinity-independence-60-v1'
);

export const GOBLIN_AFFINITY_AUDIT_600 = createGoblinManifestAudit(
	600,
	'goblin-affinity-independence-600-v1'
);
