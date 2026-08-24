import { z } from 'zod';

import { ContentVersionSchema, EntityIdSchema, IsoDateTimeSchema } from './shared.js';

export const PolicyModeSchema = z.enum(['random', 'scripted', 'model']);
export const RunStatusSchema = z.enum(['active', 'game_over', 'archived']);

export const RunSchema = z
	.object({
		runId: EntityIdSchema,
		ownerId: EntityIdSchema,
		seed: z.string().min(1).max(128),
		contentVersion: ContentVersionSchema,
		status: RunStatusSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().nonnegative(),
		policyMode: PolicyModeSchema,
		createdAt: IsoDateTimeSchema,
		updatedAt: IsoDateTimeSchema
	})
	.strict();

export type PolicyMode = z.infer<typeof PolicyModeSchema>;
export type Run = z.infer<typeof RunSchema>;
