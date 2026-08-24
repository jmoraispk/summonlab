import { z } from 'zod';

import {
	CharacterGenerationRecipeSchema,
	CharacterManifestSchema,
	CharacterMindSchema
} from './character.js';
import { DecisionSourceSchema } from './event.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const ProofControlModeSchema = z.enum(['autonomous', 'random', 'wait', 'countdown']);
export const FirstDestinationSchema = z.enum(['kitchen', 'training-ground']);

export const ProofRunCreateRequestSchema = z
	.object({
		recipe: CharacterGenerationRecipeSchema,
		controlMode: ProofControlModeSchema,
		directive: z.string().trim().max(500).default('')
	})
	.strict();

export const ProofDecisionRequestSchema = z
	.object({
		directive: z.string().trim().max(500).default(''),
		trigger: z.enum(['step', 'countdown'])
	})
	.strict();

export const ProofArrivalRequestSchema = z.object({}).strict();

export const ProofEventSchema = z
	.object({
		eventId: EntityIdSchema,
		sequence: z.number().int().positive(),
		eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		summary: z.string().min(1).max(500),
		decisionSource: DecisionSourceSchema,
		payload: z.record(z.string(), z.unknown()),
		eventHash: StateHashSchema,
		createdAt: IsoDateTimeSchema
	})
	.strict();

export const ProofRunSnapshotSchema = z
	.object({
		runId: EntityIdSchema,
		storyEnvelopeId: z.literal('first-ember-v1'),
		controlMode: ProofControlModeSchema,
		directive: z.string(),
		recipe: CharacterGenerationRecipeSchema,
		manifest: CharacterManifestSchema,
		mind: CharacterMindSchema,
		manifestHash: StateHashSchema,
		firstObservation: z.string().min(1),
		firstLine: z.string().min(1).nullable(),
		destination: FirstDestinationSchema.nullable(),
		storyBranch: z.string().min(1).nullable(),
		arrived: z.boolean(),
		events: z.array(ProofEventSchema),
		createdAt: IsoDateTimeSchema
	})
	.strict();

export type FirstDestination = z.infer<typeof FirstDestinationSchema>;
export type ProofControlMode = z.infer<typeof ProofControlModeSchema>;
export type ProofDecisionRequest = z.infer<typeof ProofDecisionRequestSchema>;
export type ProofEvent = z.infer<typeof ProofEventSchema>;
export type ProofRunCreateRequest = z.infer<typeof ProofRunCreateRequestSchema>;
export type ProofRunSnapshot = z.infer<typeof ProofRunSnapshotSchema>;
