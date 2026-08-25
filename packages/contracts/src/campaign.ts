import { z } from 'zod';

import { CharacterDraftSchema } from './character.js';
import { RunStatusSchema } from './run.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const CampaignControlModeSchema = z.enum(['wait', 'countdown']);
export const CampaignRunLifecycleSchema = z.enum(['active', 'superseded']);

export const CampaignHeroSchema = z
	.object({
		ordinal: z.number().int().min(1).max(3),
		draft: CharacterDraftSchema
	})
	.strict();

export const CampaignHeroesSchema = z.array(CampaignHeroSchema).length(3);

export const CampaignRunSchema = z
	.object({
		runId: EntityIdSchema,
		campaignSeed: z.string().min(1).max(128),
		controlMode: CampaignControlModeSchema,
		lifecycle: CampaignRunLifecycleSchema,
		engineStatus: RunStatusSchema,
		onboardingStep: z.number().int().min(0).max(3),
		restartedFromRunId: EntityIdSchema.nullable(),
		heroes: CampaignHeroesSchema,
		createdAt: IsoDateTimeSchema,
		updatedAt: IsoDateTimeSchema
	})
	.strict()
	.superRefine((campaign, context) => {
		const ordinals = campaign.heroes.map((hero) => hero.ordinal);
		const heroIds = campaign.heroes.map((hero) => hero.draft.manifest.characterId);
		if (new Set(ordinals).size !== 3 || ![1, 2, 3].every((ordinal) => ordinals.includes(ordinal))) {
			context.addIssue({
				code: 'custom',
				path: ['heroes'],
				message: 'Campaign hero order is invalid'
			});
		}
		if (new Set(heroIds).size !== heroIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['heroes'],
				message: 'Campaign heroes must be unique'
			});
		}
	});

export const CampaignRunCreateRequestSchema = z
	.object({
		seed: z.string().trim().min(1).max(128),
		controlMode: CampaignControlModeSchema.default('wait')
	})
	.strict();

export const CampaignRestartRequestSchema = z
	.object({
		seedMode: z.enum(['same', 'new']),
		seed: z.string().trim().min(1).max(128).optional(),
		controlMode: CampaignControlModeSchema.default('wait')
	})
	.strict()
	.superRefine((request, context) => {
		if (request.seedMode === 'new' && !request.seed) {
			context.addIssue({
				code: 'custom',
				path: ['seed'],
				message: 'A new campaign seed is required'
			});
		}
	});

export const CampaignOnboardingRequestSchema = z
	.object({ step: z.number().int().min(1).max(3) })
	.strict();

export const CampaignObjectiveStatusSchema = z.enum(['complete', 'current', 'locked']);

export const CampaignObjectiveSchema = z
	.object({
		objectiveId: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u),
		chapter: z.string().min(1).max(80),
		title: z.string().min(1).max(120),
		detail: z.string().min(1).max(280),
		status: CampaignObjectiveStatusSchema,
		evidence: z.array(z.string().min(1).max(160)).max(8)
	})
	.strict();

export const CampaignObjectiveProjectionSchema = z
	.object({
		projectionVersion: z.literal('campaign-objectives-v1'),
		runId: EntityIdSchema,
		stateHash: StateHashSchema,
		activeObjectiveId: z.string().nullable(),
		completedCount: z.number().int().nonnegative(),
		objectives: z.array(CampaignObjectiveSchema).length(7),
		projectionHash: StateHashSchema
	})
	.strict();

export type CampaignControlMode = z.infer<typeof CampaignControlModeSchema>;
export type CampaignHero = z.infer<typeof CampaignHeroSchema>;
export type CampaignObjective = z.infer<typeof CampaignObjectiveSchema>;
export type CampaignObjectiveProjection = z.infer<typeof CampaignObjectiveProjectionSchema>;
export type CampaignOnboardingRequest = z.infer<typeof CampaignOnboardingRequestSchema>;
export type CampaignRestartRequest = z.infer<typeof CampaignRestartRequestSchema>;
export type CampaignRun = z.infer<typeof CampaignRunSchema>;
export type CampaignRunCreateRequest = z.infer<typeof CampaignRunCreateRequestSchema>;
