import { z } from 'zod';

import { EntityIdSchema, IsoDateTimeSchema } from './shared.js';

export const SocialObservationKindSchema = z.enum(['awakening', 'first-ember-commitment']);

export const SocialObservationSchema = z
	.object({
		observationId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		observerHeroId: EntityIdSchema,
		observedAt: IsoDateTimeSchema,
		kind: SocialObservationKindSchema,
		summary: z.string().min(1).max(300),
		subjectIds: z.array(EntityIdSchema).min(1).max(8)
	})
	.strict()
	.refine((observation) => new Set(observation.subjectIds).size === observation.subjectIds.length, {
		message: 'Observation subjects must be unique'
	});

export const BeliefProvenanceSchema = z
	.object({
		kind: z.enum(['experienced', 'observed', 'told', 'inferred', 'recorded']),
		sourceEventId: EntityIdSchema,
		observationId: EntityIdSchema,
		learnedFromId: EntityIdSchema.nullable(),
		chainDepth: z.number().int().min(0).max(8)
	})
	.strict();

export const BeliefObjectSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('entity'), entityId: EntityIdSchema }).strict(),
	z.object({ kind: z.literal('location'), locationId: z.string().min(1).max(80) }).strict(),
	z.object({ kind: z.literal('text'), text: z.string().min(1).max(240) }).strict(),
	z
		.object({
			kind: z.literal('commitment'),
			facilityId: z.enum(['kitchen', 'dormitory', 'training-ground']),
			rationale: z.enum(['feed-everyone', 'protect-recovery', 'prepare-tower'])
		})
		.strict(),
	z.object({ kind: z.literal('promise'), promiseId: EntityIdSchema }).strict()
]);

export const HeroBeliefSchema = z
	.object({
		beliefId: EntityIdSchema,
		holderHeroId: EntityIdSchema,
		subjectId: EntityIdSchema,
		predicate: z.enum([
			'awakened-at',
			'present-at-awakening',
			'first-ember-bound-to',
			'made-founding-promise'
		]),
		object: BeliefObjectSchema,
		confidence: z.number().int().min(0).max(100),
		status: z.enum(['held', 'doubted', 'retracted']),
		learnedAt: IsoDateTimeSchema,
		provenance: BeliefProvenanceSchema
	})
	.strict();

export const RelationshipDimensionsSchema = z
	.object({
		trust: z.number().int().min(-100).max(100),
		respect: z.number().int().min(-100).max(100),
		fear: z.number().int().min(-100).max(100),
		affection: z.number().int().min(-100).max(100),
		resentment: z.number().int().min(-100).max(100),
		debt: z.number().int().min(-100).max(100)
	})
	.strict();

export const RelationshipEvidenceSchema = z
	.object({
		sourceEventId: EntityIdSchema,
		observationId: EntityIdSchema,
		summary: z.string().min(1).max(240),
		deltas: RelationshipDimensionsSchema
	})
	.strict();

export const DirectedRelationshipSchema = z
	.object({
		relationshipId: EntityIdSchema,
		fromHeroId: EntityIdSchema,
		toEntityId: EntityIdSchema,
		dimensions: RelationshipDimensionsSchema,
		updatedAt: IsoDateTimeSchema,
		lastSourceEventId: EntityIdSchema,
		evidence: z.array(RelationshipEvidenceSchema).max(64)
	})
	.strict();

export const AuthorityDimensionsSchema = z
	.object({
		competence: z.number().int().min(-100).max(100),
		provision: z.number().int().min(-100).max(100),
		trust: z.number().int().min(-100).max(100),
		legitimacy: z.number().int().min(-100).max(100),
		fear: z.number().int().min(-100).max(100),
		strength: z.number().int().min(-100).max(100),
		consistency: z.number().int().min(-100).max(100)
	})
	.strict();

export const AuthorityEvidenceSchema = z
	.object({
		sourceEventId: EntityIdSchema,
		observationId: EntityIdSchema,
		summary: z.string().min(1).max(240),
		deltas: AuthorityDimensionsSchema
	})
	.strict();

export const HeroAuthoritySchema = z
	.object({
		authorityId: EntityIdSchema,
		observerHeroId: EntityIdSchema,
		subjectId: EntityIdSchema,
		dimensions: AuthorityDimensionsSchema,
		updatedAt: IsoDateTimeSchema,
		lastSourceEventId: EntityIdSchema,
		evidence: z.array(AuthorityEvidenceSchema).max(64)
	})
	.strict();

export const SocialPromiseSchema = z
	.object({
		promiseId: EntityIdSchema,
		promisorId: EntityIdSchema,
		promiseeHeroIds: z.array(EntityIdSchema).min(1).max(32),
		kind: z.literal('founding-priority'),
		terms: z.string().min(1).max(240),
		status: z.enum(['active', 'kept', 'broken', 'expired']),
		sourceEventId: EntityIdSchema,
		createdAt: IsoDateTimeSchema,
		witnessObservationIds: z.array(EntityIdSchema).min(1).max(32),
		resolvedAt: IsoDateTimeSchema.nullable(),
		resolutionEventId: EntityIdSchema.nullable()
	})
	.strict()
	.superRefine((promise, context) => {
		if (
			(promise.status === 'active' &&
				(promise.resolvedAt !== null || promise.resolutionEventId !== null)) ||
			(promise.status !== 'active' &&
				(promise.resolvedAt === null || promise.resolutionEventId === null))
		) {
			context.addIssue({ code: 'custom', message: 'Promise resolution fields are inconsistent' });
		}
		if (new Set(promise.promiseeHeroIds).size !== promise.promiseeHeroIds.length) {
			context.addIssue({ code: 'custom', message: 'Promisees must be unique' });
		}
		if (new Set(promise.witnessObservationIds).size !== promise.witnessObservationIds.length) {
			context.addIssue({ code: 'custom', message: 'Promise witnesses must be unique' });
		}
	});

export const SocietyStateSchema = z
	.object({
		contentVersion: z.literal('society-v1'),
		observations: z.record(EntityIdSchema, SocialObservationSchema),
		beliefs: z.record(EntityIdSchema, HeroBeliefSchema),
		relationships: z.record(EntityIdSchema, DirectedRelationshipSchema),
		promises: z.record(EntityIdSchema, SocialPromiseSchema),
		authority: z.record(EntityIdSchema, HeroAuthoritySchema)
	})
	.strict()
	.superRefine((society, context) => {
		const collections = [
			['observation', society.observations, 'observationId'],
			['belief', society.beliefs, 'beliefId'],
			['relationship', society.relationships, 'relationshipId'],
			['promise', society.promises, 'promiseId'],
			['authority', society.authority, 'authorityId']
		] as const;
		for (const [label, records, idField] of collections) {
			if (Object.keys(records).length > 2_048) {
				context.addIssue({ code: 'custom', message: `Too many ${label} records` });
			}
			for (const [key, record] of Object.entries(records)) {
				if ((record as Record<string, unknown>)[idField] !== key) {
					context.addIssue({
						code: 'custom',
						message: `${label} record key does not match its id`
					});
				}
			}
		}
	});

export type SocietyState = z.infer<typeof SocietyStateSchema>;
export type SocialObservation = z.infer<typeof SocialObservationSchema>;
export type HeroBelief = z.infer<typeof HeroBeliefSchema>;
export type DirectedRelationship = z.infer<typeof DirectedRelationshipSchema>;
export type HeroAuthority = z.infer<typeof HeroAuthoritySchema>;
export type SocialPromise = z.infer<typeof SocialPromiseSchema>;
export type RelationshipDimensions = z.infer<typeof RelationshipDimensionsSchema>;
export type AuthorityDimensions = z.infer<typeof AuthorityDimensionsSchema>;
