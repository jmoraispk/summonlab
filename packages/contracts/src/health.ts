import { z } from 'zod';

import { IsoDateTimeSchema } from './shared.js';
import { PolicyModeSchema } from './run.js';

export const DatabaseHealthSchema = z
	.object({
		status: z.enum(['available', 'unavailable']),
		latencyMs: z.number().nonnegative().nullable()
	})
	.strict();

export const HealthResponseSchema = z
	.object({
		status: z.enum(['ok', 'degraded']),
		service: z.enum(['web', 'worker']),
		version: z.string().min(1),
		commit: z.string().min(1),
		policyMode: PolicyModeSchema,
		database: DatabaseHealthSchema,
		timestamp: IsoDateTimeSchema,
		requestId: z.string().regex(/^[a-zA-Z0-9._:-]{8,128}$/u)
	})
	.strict();

export type DatabaseHealth = z.infer<typeof DatabaseHealthSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
