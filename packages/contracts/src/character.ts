import { z } from 'zod';

import { CharacterCapabilityProfileV1Schema } from './capability.js';
import { ContentVersionSchema, EntityIdSchema, StateHashSchema } from './shared.js';

export const CharacterGenerationCursorsSchema = z
	.object({
		identity: z.number().int().nonnegative(),
		body: z.number().int().nonnegative(),
		features: z.number().int().nonnegative(),
		styling: z.number().int().nonnegative(),
		mind: z.number().int().nonnegative(),
		rarity: z.number().int().nonnegative()
	})
	.strict();

export const CharacterGenerationRecipeSchema = z
	.object({
		seed: z.string().min(1).max(128),
		generationVersion: ContentVersionSchema,
		cursors: CharacterGenerationCursorsSchema
	})
	.strict();

export const CharacterManifestSchema = z
	.object({
		characterId: EntityIdSchema,
		displayName: z.string().min(1).max(80),
		appearanceSeed: z.string().min(1).max(128),
		generationVersion: ContentVersionSchema,
		rarityStars: z.number().int().min(1).max(7),
		adultAge: z.number().int().min(18).max(42),
		apparentAgeBand: z.enum(['young-adult', 'adult', 'mature-adult']).optional(),
		genderPresentation: z.enum(['feminine', 'masculine', 'androgynous']),
		pronouns: z.enum(['she/her', 'he/him', 'they/them']),
		bodyFrame: z.enum(['slight', 'balanced', 'broad']),
		bodyBuild: z.enum(['wiry', 'lean', 'soft', 'athletic', 'solid', 'sturdy', 'powerful']),
		heightCm: z.number().int().min(140).max(210),
		physiology: z
			.object({
				massKg: z.number().int().min(40).max(160),
				muscleTone: z.number().int().min(1).max(10),
				bodyFat: z.number().int().min(1).max(10),
				limbProportion: z.enum(['short', 'balanced', 'long']),
				handScale: z.number().min(0.8).max(1.2),
				heightBand: z.enum(['short', 'medium', 'tall', 'exceptional']).optional(),
				proportions: z
					.object({
						profile: z.enum(['compact', 'balanced', 'long-limbed', 'long-torso']),
						torsoRatio: z.number().min(0.8).max(1.2),
						armRatio: z.number().min(0.8).max(1.2),
						legRatio: z.number().min(0.8).max(1.2),
						stanceWidth: z.number().min(0.8).max(1.2),
						weightDistribution: z.enum(['grounded', 'centered', 'forward', 'light'])
					})
					.strict()
					.optional()
			})
			.strict()
			.optional(),
		phenotype: z
			.object({
				skinTone: z.string().min(1).max(40),
				faceShape: z.string().min(1).max(40),
				noseProfile: z.string().min(1).max(40),
				hairTexture: z.string().min(1).max(40),
				hairColor: z.string().min(1).max(40),
				hairStyle: z.string().min(1).max(60),
				eyeColor: z.string().min(1).max(40),
				hairSilhouette: z
					.enum(['close', 'jaw', 'shoulder', 'long', 'raised', 'crown', 'wrapped'])
					.optional(),
				grooming: z.enum(['clean', 'neat', 'weathered']).optional(),
				facialHair: z
					.enum(['none', 'stubble', 'moustache', 'short-beard', 'full-beard'])
					.optional(),
				facialStructure: z
					.object({
						eyeShape: z.enum([
							'almond',
							'round',
							'deep-set',
							'hooded',
							'upturned',
							'downturned',
							'narrow',
							'wide'
						]),
						eyeSpacing: z.enum(['close-set', 'balanced', 'wide-set']),
						browShape: z.enum([
							'straight',
							'arched',
							'angular',
							'soft',
							'heavy',
							'fine',
							'low',
							'high'
						]),
						cheekStructure: z.enum(['flat', 'rounded', 'high', 'broad', 'hollow', 'soft']),
						jawShape: z.enum([
							'narrow',
							'tapered',
							'rounded',
							'square',
							'broad',
							'angular',
							'soft'
						]),
						chinShape: z.enum(['small', 'rounded', 'square', 'pointed', 'cleft']),
						mouthShape: z.enum([
							'narrow',
							'wide',
							'bowed',
							'full',
							'thin',
							'asymmetric',
							'downturned'
						])
					})
					.strict()
					.optional()
			})
			.strict(),
		voice: z
			.object({
				register: z.enum(['low', 'mid', 'high']),
				texture: z.enum(['clear', 'rough', 'warm', 'breathy']),
				cadence: z.enum(['measured', 'quick', 'deliberate', 'lilting'])
			})
			.strict(),
		posture: z.enum(['guarded', 'open', 'restless', 'grounded', 'formal']),
		handedness: z.enum(['right', 'left', 'ambidextrous']),
		visualTraits: z.array(z.string().min(1).max(80)).max(12),
		visualRole: z
			.enum(['guard', 'hunter', 'healer', 'smith', 'scribe', 'traveler', 'court', 'mage'])
			.optional(),
		attire: z
			.object({
				footwear: z.enum([
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
				]),
				legwear: z.enum([
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
				]),
				torso: z.enum([
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
				]),
				arms: z.enum([
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
				]),
				headwear: z.enum([
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
				]),
				material: z.enum(['linen', 'wool', 'leather', 'mail', 'plate', 'mixed']),
				condition: z.enum(['mended', 'maintained', 'weathered', 'fine']),
				layering: z.enum(['light', 'standard', 'layered', 'armored'])
			})
			.strict()
			.optional(),
		palette: z
			.object({
				skin: z.string().regex(/^#[a-f0-9]{6}$/iu),
				hair: z.string().regex(/^#[a-f0-9]{6}$/iu),
				cloth: z.string().regex(/^#[a-f0-9]{6}$/iu),
				accent: z.string().regex(/^#[a-f0-9]{6}$/iu)
			})
			.strict(),
		rig: z
			.object({
				headScale: z.number().min(0.8).max(1.2),
				shoulderWidth: z.number().min(0.75).max(1.3),
				hipWidth: z.number().min(0.75).max(1.3),
				legRatio: z.number().min(0.8).max(1.2),
				anchors: z
					.object({
						head: z.tuple([z.number(), z.number()]),
						leftHand: z.tuple([z.number(), z.number()]),
						rightHand: z.tuple([z.number(), z.number()]),
						back: z.tuple([z.number(), z.number()])
					})
					.strict()
			})
			.strict(),
		artKey: z.string().min(1).max(80).nullable(),
		assetProvenance: z.enum([
			'procedural',
			'original-generated-anchor',
			'approved-generated-roster'
		])
	})
	.strict();

export const PersonalityScoresSchema = z
	.object({
		openness: z.number().int().min(0).max(100),
		conscientiousness: z.number().int().min(0).max(100),
		extraversion: z.number().int().min(0).max(100),
		agreeableness: z.number().int().min(0).max(100),
		emotionalVolatility: z.number().int().min(0).max(100)
	})
	.strict();

export const CharacterMindSchema = z
	.object({
		personality: PersonalityScoresSchema,
		primaryValue: z.enum(['duty', 'freedom', 'knowledge', 'belonging', 'mastery', 'mercy']),
		primaryDrive: z.enum(['understand', 'protect', 'prove', 'connect', 'create', 'survive']),
		socialStyle: z.enum(['reserved', 'direct', 'warm', 'wry', 'formal', 'inquisitive']),
		stressResponse: z.enum(['observe', 'prepare', 'confront', 'withdraw', 'seek-allies']),
		dailyHabit: z.enum([
			'checks-exits',
			'stretches-at-dawn',
			'shares-breakfast',
			'catalogues-tools',
			'walks-the-walls',
			'practises-knots'
		]),
		aptitudes: z
			.object({
				might: z.number().int().min(1).max(10),
				finesse: z.number().int().min(1).max(10),
				insight: z.number().int().min(1).max(10),
				resolve: z.number().int().min(1).max(10)
			})
			.strict()
	})
	.strict();

export const CharacterDraftSchema = z
	.object({
		recipe: CharacterGenerationRecipeSchema,
		manifest: CharacterManifestSchema,
		mind: CharacterMindSchema,
		manifestHash: StateHashSchema
	})
	.strict();

export const CharacterMindV2Schema = CharacterMindSchema.omit({ aptitudes: true });

export const CharacterDraftV2Schema = z
	.object({
		recipe: CharacterGenerationRecipeSchema,
		manifest: CharacterManifestSchema,
		mind: CharacterMindV2Schema,
		capabilityProfile: CharacterCapabilityProfileV1Schema,
		manifestHash: StateHashSchema
	})
	.strict();

export const LegalActionSchema = z
	.object({
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		actorId: EntityIdSchema,
		kind: z.enum([
			'move',
			'attack',
			'defend',
			'interact',
			'communicate',
			'work',
			'train',
			'rest',
			'retreat',
			'wait'
		]),
		label: z.string().min(1).max(120),
		description: z.string().min(1).max(500),
		targetIds: z.array(EntityIdSchema).max(8),
		resourceCosts: z.record(z.string().min(1).max(60), z.number().nonnegative()).default({}),
		tags: z.array(z.string().min(1).max(60)).max(20).default([])
	})
	.strict();

export type CharacterDraft = z.infer<typeof CharacterDraftSchema>;
export type CharacterDraftV2 = z.infer<typeof CharacterDraftV2Schema>;
export type CharacterGenerationCursors = z.infer<typeof CharacterGenerationCursorsSchema>;
export type CharacterGenerationRecipe = z.infer<typeof CharacterGenerationRecipeSchema>;
export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
export type CharacterMind = z.infer<typeof CharacterMindSchema>;
export type CharacterMindV2 = z.infer<typeof CharacterMindV2Schema>;
export type LegalAction = z.infer<typeof LegalActionSchema>;
