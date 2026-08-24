import {
	CharacterDraftSchema,
	CharacterGenerationRecipeSchema,
	CharacterManifestSchema,
	CharacterMindSchema,
	type CharacterDraft,
	type CharacterGenerationCursors,
	type CharacterGenerationRecipe,
	type CharacterManifest,
	type CharacterMind,
	type FirstDestination,
	type ProofControlMode
} from '@summonlab/contracts';

export const LEGACY_CHARACTER_GENERATION_VERSION = 'human-v1';
export const CHARACTER_GENERATION_VERSION = 'human-v2';

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
	if (recipe.seed === 'ember-01') return 'ember-01-anchor-v1';
	if (recipe.seed === 'hearth-02' && recipe.generationVersion === CHARACTER_GENERATION_VERSION) {
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
	const anchorKey = visualAnchorKey(recipe);
	const maraAnchor = anchorKey === 'ember-01-anchor-v1';
	const [firstName, lastName] = maraAnchor ? names[0] : choose(identity, names);
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
		: choose(body, ['slight', 'balanced', 'broad'] as const);
	const bodyBuild = maraAnchor
		? ('athletic' as const)
		: choose(body, ['wiry', 'soft', 'athletic', 'solid'] as const);
	const heightBase = presentation === 'masculine' ? 162 : presentation === 'feminine' ? 154 : 158;
	const heightRange = presentation === 'masculine' ? 37 : presentation === 'feminine' ? 34 : 36;
	const heightCm = maraAnchor ? 178 : heightBase + Math.floor(body() * heightRange);
	const ageSampleA = Math.max(body(), Number.EPSILON);
	const ageSampleB = body();
	const ageNormal = Math.sqrt(-2 * Math.log(ageSampleA)) * Math.cos(2 * Math.PI * ageSampleB);
	const age = maraAnchor ? 27 : Math.max(18, Math.min(42, Math.round(26 + ageNormal * 4.5)));
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
	const buildMass = { wiry: -7, soft: 3, athletic: 2, solid: 10 }[bodyBuild];
	const frameMass = { slight: -4, balanced: 0, broad: 6 }[bodyFrame];
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
		genderPresentation: presentation,
		pronouns,
		bodyFrame,
		bodyBuild,
		heightCm,
		...(recipe.generationVersion === CHARACTER_GENERATION_VERSION
			? {
					physiology: {
						massKg: Math.max(
							40,
							Math.min(160, Math.round((heightCm - 100) * 0.82 + buildMass + frameMass))
						),
						muscleTone: Math.max(
							1,
							Math.min(
								10,
								Math.round(
									(bodyBuild === 'athletic' ? 7 : bodyBuild === 'solid' ? 6 : 4) +
										(physiology() - 0.5) * 3
								)
							)
						),
						bodyFat: Math.max(
							1,
							Math.min(
								10,
								Math.round(
									(bodyBuild === 'soft' ? 7 : bodyBuild === 'wiry' ? 3 : 4) +
										(physiology() - 0.5) * 3
								)
							)
						),
						limbProportion: choose(physiology, ['short', 'balanced', 'balanced', 'long'] as const),
						handScale: Number((0.86 + physiology() * 0.28).toFixed(3))
					}
				}
			: {}),
		phenotype: {
			skinTone: skin[0],
			faceShape: maraAnchor
				? 'angular oval'
				: choose(features, ['round', 'oval', 'angular oval', 'long', 'heart-shaped'] as const),
			noseProfile: maraAnchor
				? 'broad straight'
				: choose(features, [
						'fine straight',
						'broad straight',
						'soft convex',
						'short rounded'
					] as const),
			hairTexture: maraAnchor
				? 'tightly coiled'
				: choose(features, ['straight', 'wavy', 'curly', 'coiled', 'tightly coiled'] as const),
			hairColor: hair[0],
			hairStyle: maraAnchor
				? 'high coiled knot'
				: choose(styling, [
						'cropped',
						'jaw-length',
						'loose shoulder-length',
						'high knot',
						'braided crown'
					] as const),
			eyeColor: maraAnchor
				? 'dark brown'
				: choose(features, ['dark brown', 'warm brown', 'hazel', 'grey', 'green', 'amber'] as const)
		},
		voice: {
			register: choose(identity, ['low', 'mid', 'high'] as const),
			texture: choose(identity, ['clear', 'rough', 'warm', 'breathy'] as const),
			cadence: choose(identity, ['measured', 'quick', 'deliberate', 'lilting'] as const)
		},
		posture,
		handedness: choose(body, ['right', 'right', 'right', 'left', 'ambidextrous'] as const),
		visualTraits,
		palette: { skin: skin[1], hair: hair[1], cloth: cloth[0], accent: cloth[1] },
		rig: {
			headScale: Number((0.9 + body() * 0.18).toFixed(3)),
			shoulderWidth: Number((0.84 + body() * 0.32).toFixed(3)),
			hipWidth: Number((0.84 + body() * 0.28).toFixed(3)),
			legRatio: Number((0.88 + body() * 0.24).toFixed(3)),
			anchors: {
				head: [50, 17],
				leftHand: [27, 56],
				rightHand: [73, 56],
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

export async function generateCharacterDraft(
	input: CharacterGenerationRecipe
): Promise<CharacterDraft> {
	const recipe = CharacterGenerationRecipeSchema.parse(input);
	const manifest = generateManifest(recipe);
	const mind = generateMind(recipe);
	return CharacterDraftSchema.parse({
		recipe,
		manifest,
		mind,
		manifestHash: await hashManifest(manifest)
	});
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

function scriptedScores(draft: CharacterDraft, directive: string) {
	const { mind } = draft;
	let kitchen = Math.round((mind.personality.agreeableness + mind.personality.extraversion) / 12);
	let trainingGround = Math.round(
		(mind.personality.conscientiousness + mind.aptitudes.might * 8 + mind.aptitudes.resolve * 7) /
			16
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

function openingLine(draft: CharacterDraft, destination: FirstDestination): string {
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
	draft: CharacterDraft,
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
