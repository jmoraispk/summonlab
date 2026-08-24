import { z } from 'zod';

import { ContentVersionSchema, EntityIdSchema } from './shared.js';

export const CharacterManifestSchema = z
	.object({
		characterId: EntityIdSchema,
		appearanceSeed: z.string().min(1).max(128),
		generationVersion: ContentVersionSchema,
		adultAge: z.number().int().min(18).max(42),
		genderPresentation: z.enum(['feminine', 'masculine', 'androgynous']),
		bodyFrame: z.enum(['slight', 'balanced', 'broad']),
		heightCm: z.number().int().min(140).max(210),
		phenotype: z
			.object({
				skinTone: z.string().min(1).max(40),
				hairTexture: z.string().min(1).max(40),
				hairColor: z.string().min(1).max(40),
				eyeColor: z.string().min(1).max(40)
			})
			.strict(),
		visualTraits: z.array(z.string().min(1).max(80)).max(12)
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

export type CharacterManifest = z.infer<typeof CharacterManifestSchema>;
export type LegalAction = z.infer<typeof LegalActionSchema>;
