import { z } from 'zod';

import { CharacterCapabilityProfileV1Schema, CombatAttributesSchema } from './capability.js';
import {
	CharacterGenerationRecipeSchema,
	CharacterManifestSchema,
	CharacterMindSchema,
	CharacterMindV2Schema
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

export const ProofRunSnapshotV2Schema = z
	.object({
		runId: EntityIdSchema,
		characterSchemaVersion: z.literal('character-v2'),
		storyEnvelopeId: z.literal('first-ember-v1'),
		controlMode: ProofControlModeSchema,
		directive: z.string(),
		recipe: CharacterGenerationRecipeSchema,
		manifest: CharacterManifestSchema,
		mind: CharacterMindV2Schema,
		capabilityProfile: CharacterCapabilityProfileV1Schema,
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

export const PublicProofEventSchema = z
	.object({
		eventId: EntityIdSchema,
		sequence: z.number().int().positive(),
		eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		summary: z.string().min(1).max(500),
		decisionSource: DecisionSourceSchema,
		eventHash: StateHashSchema,
		createdAt: IsoDateTimeSchema
	})
	.strict();

const PublicProofRunBaseShape = {
	runId: EntityIdSchema,
	storyEnvelopeId: z.literal('first-ember-v1'),
	controlMode: ProofControlModeSchema,
	manifest: CharacterManifestSchema,
	manifestHash: StateHashSchema,
	firstObservation: z.string().min(1),
	firstLine: z.string().min(1).nullable(),
	destination: FirstDestinationSchema.nullable(),
	storyBranch: z.string().min(1).nullable(),
	arrived: z.boolean(),
	events: z.array(PublicProofEventSchema),
	createdAt: IsoDateTimeSchema
} as const;

export const PublicProofRunSnapshotSchema = z.object(PublicProofRunBaseShape).strict();

export const PublicProofRunSnapshotV2Schema = z
	.object({
		...PublicProofRunBaseShape,
		characterSchemaVersion: z.literal('character-v2'),
		capabilityProfile: z
			.object({
				profileVersion: z.literal('character-capability-v1'),
				attributes: CombatAttributesSchema
			})
			.strict()
	})
	.strict();

export type FirstDestination = z.infer<typeof FirstDestinationSchema>;
export type ProofControlMode = z.infer<typeof ProofControlModeSchema>;
export type ProofDecisionRequest = z.infer<typeof ProofDecisionRequestSchema>;
export type ProofEvent = z.infer<typeof ProofEventSchema>;
export type ProofRunCreateRequest = z.infer<typeof ProofRunCreateRequestSchema>;
export type ProofRunSnapshot = z.infer<typeof ProofRunSnapshotSchema>;
export type ProofRunSnapshotV2 = z.infer<typeof ProofRunSnapshotV2Schema>;
export type PublicProofEvent = z.infer<typeof PublicProofEventSchema>;
export type PublicProofRunSnapshot = z.infer<typeof PublicProofRunSnapshotSchema>;
export type PublicProofRunSnapshotV2 = z.infer<typeof PublicProofRunSnapshotV2Schema>;
