import { z } from 'zod';

import { AuthoritativeEventSchema, RewardDeltaSchema } from '../event.js';
import {
	ExperienceClaimSchema,
	ExperienceReceiptSchema,
	HeroProgressionV2Schema
} from '../progression.js';
import { EntityIdSchema } from '../shared.js';

export const HeroExperienceAppliedPayloadSchema = z
	.object({
		heroId: EntityIdSchema,
		claim: ExperienceClaimSchema,
		receipt: ExperienceReceiptSchema,
		progressionBefore: HeroProgressionV2Schema,
		progressionAfter: HeroProgressionV2Schema,
		maximumHealthBefore: z.number().int().positive(),
		maximumHealthAfter: z.number().int().positive(),
		healthAfter: z.number().int().nonnegative(),
		nextVersion: z.number().int().nonnegative(),
		summary: z.string().min(1).max(1_000),
		rewardDeltas: z.array(RewardDeltaSchema),
		resolvedScheduledEventIds: z.array(EntityIdSchema),
		canceledScheduledEventIds: z.array(EntityIdSchema),
		entropyDraws: z.array(z.unknown()).length(0)
	})
	.strict();

export const HeroExperienceAppliedEventSchema = AuthoritativeEventSchema.extend({
	schemaVersion: z.literal(27),
	eventType: z.literal('hero.experience.applied'),
	contentVersion: z.literal('engine-v27'),
	payload: HeroExperienceAppliedPayloadSchema
}).strict();

export type HeroExperienceAppliedPayload = z.infer<typeof HeroExperienceAppliedPayloadSchema>;
