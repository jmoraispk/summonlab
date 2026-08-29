import { z } from 'zod';

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
				facialHair: z.enum(['none', 'stubble', 'moustache', 'short-beard', 'full-beard']).optional()
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
		assetProvenance: z.enum(['procedural', 'original-generated-anchor'])
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
export type CharacterGenerationCursors = z.infer<typeof CharacterGenerationCursorsSchema>;
export type CharacterGenerationRecipe = z.infer<typeof CharacterGenerationRecipeSchema>;
export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
export type CharacterMind = z.infer<typeof CharacterMindSchema>;
export type LegalAction = z.infer<typeof LegalActionSchema>;
