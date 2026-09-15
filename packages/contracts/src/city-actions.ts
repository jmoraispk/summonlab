import { z } from 'zod';

import { EntityIdSchema } from './shared.js';

export const CityActionRequestSchema = z
	.object({
		action: z.enum(['court-training', 'rest']),
		heroId: EntityIdSchema,
		expectedVersion: z.number().int().nonnegative()
	})
	.strict();

export type CityActionRequest = z.infer<typeof CityActionRequestSchema>;
