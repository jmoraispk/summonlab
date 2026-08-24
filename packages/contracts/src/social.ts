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

export const CommunicationObservationSchema = z
	.object({
		observationId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		observerHeroId: EntityIdSchema,
		observedAt: IsoDateTimeSchema,
		kind: z.literal('communication'),
		communicationActId: EntityIdSchema,
		summary: z.string().min(1).max(300),
		subjectIds: z.array(EntityIdSchema).min(1).max(8)
	})
	.strict()
	.refine((observation) => new Set(observation.subjectIds).size === observation.subjectIds.length, {
		message: 'Observation subjects must be unique'
	});

export const SocialObservationV2Schema = z.union([
	SocialObservationSchema,
	CommunicationObservationSchema
]);

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

export const CommunicationBeliefPredicateSchema = z.enum([
	'claims-master-role',
	'was-summoned-into',
	'described-tower-mission'
]);

export const CommunicationHeroBeliefSchema = HeroBeliefSchema.extend({
	predicate: CommunicationBeliefPredicateSchema
}).strict();

export const HeroBeliefV2Schema = z.union([HeroBeliefSchema, CommunicationHeroBeliefSchema]);

export const CommunicativeActKindSchema = z.enum([
	'explain',
	'tell',
	'ask',
	'order',
	'conceal',
	'accuse',
	'investigate'
]);
export const OnboardingCommunicativeActKindSchema = z.enum(['explain', 'tell', 'ask']);
export const CommunicationTopicSchema = z.enum([
	'master-role',
	'summoning-situation',
	'tower-mission',
	'hero-memory'
]);
export const CommunicationDeliverySchema = z.enum(['private', 'open']);
export const CommunicationToneSchema = z.enum([
	'neutral',
	'reassuring',
	'firm',
	'urgent',
	'apologetic'
]);
export const CommunicationLocationSchema = z.enum([
	'summoning-gate',
	'kitchen',
	'training-ground',
	'dormitory',
	'workshop'
]);
export const CommunicationWitnessSchema = z
	.object({
		heroId: EntityIdSchema,
		role: z.enum(['intended', 'bystander']),
		perception: z.enum(['addressed', 'overheard']),
		observationId: EntityIdSchema,
		beliefId: EntityIdSchema.nullable()
	})
	.strict()
	.superRefine((witness, context) => {
		if (
			(witness.role === 'intended' && witness.perception !== 'addressed') ||
			(witness.role === 'bystander' && witness.perception !== 'overheard')
		) {
			context.addIssue({ code: 'custom', message: 'Communication witness role is inconsistent' });
		}
	});

export const CommunicationClaimSchema = z
	.object({
		subjectId: EntityIdSchema,
		predicate: CommunicationBeliefPredicateSchema,
		object: BeliefObjectSchema
	})
	.strict();

export const CommunicativeActSchema = z
	.object({
		actId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		speakerId: EntityIdSchema,
		intendedAudienceIds: z.array(EntityIdSchema).min(1).max(8),
		kind: CommunicativeActKindSchema,
		topic: CommunicationTopicSchema,
		exactText: z
			.string()
			.min(1)
			.max(600)
			.refine((text) => /\S/u.test(text), {
				message: 'Communication text must contain a visible character'
			}),
		tone: CommunicationToneSchema.nullable(),
		delivery: CommunicationDeliverySchema,
		location: CommunicationLocationSchema,
		occurredAt: IsoDateTimeSchema,
		claim: CommunicationClaimSchema.nullable(),
		witnesses: z.array(CommunicationWitnessSchema).min(1).max(32)
	})
	.strict()
	.superRefine((act, context) => {
		if (new Set(act.intendedAudienceIds).size !== act.intendedAudienceIds.length) {
			context.addIssue({ code: 'custom', message: 'Intended audience must be unique' });
		}
		if (new Set(act.witnesses.map((witness) => witness.heroId)).size !== act.witnesses.length) {
			context.addIssue({ code: 'custom', message: 'Communication witnesses must be unique' });
		}
		const intendedWitnesses = act.witnesses
			.filter((witness) => witness.role === 'intended')
			.map((witness) => witness.heroId)
			.sort((left, right) => left.localeCompare(right));
		if (
			intendedWitnesses.join('|') !==
			[...act.intendedAudienceIds].sort((left, right) => left.localeCompare(right)).join('|')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Intended audience must be addressed witnesses'
			});
		}
		if (
			act.delivery === 'private' &&
			act.witnesses.some((witness) => witness.role === 'bystander')
		) {
			context.addIssue({ code: 'custom', message: 'Private communication cannot have bystanders' });
		}
		if ((act.kind === 'ask') !== (act.claim === null)) {
			context.addIssue({ code: 'custom', message: 'Only questions omit a structured claim' });
		}
		if (
			(act.kind === 'ask' && act.topic !== 'hero-memory') ||
			(act.kind !== 'ask' && act.topic === 'hero-memory')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Communication kind and topic are inconsistent'
			});
		}
		const expectedPredicate = {
			'master-role': 'claims-master-role',
			'summoning-situation': 'was-summoned-into',
			'tower-mission': 'described-tower-mission',
			'hero-memory': null
		} as const;
		if ((act.claim?.predicate ?? null) !== expectedPredicate[act.topic]) {
			context.addIssue({ code: 'custom', message: 'Communication claim diverged from its topic' });
		}
		if (
			(act.topic === 'summoning-situation' &&
				act.claim !== null &&
				!act.intendedAudienceIds.includes(act.claim.subjectId)) ||
			(act.topic !== 'summoning-situation' &&
				act.claim !== null &&
				act.claim.subjectId !== act.speakerId)
		) {
			context.addIssue({ code: 'custom', message: 'Communication claim subject is inconsistent' });
		}
	});

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

export const SocietyStateV2Schema = z
	.object({
		contentVersion: z.literal('society-v2'),
		observations: z.record(EntityIdSchema, SocialObservationV2Schema),
		beliefs: z.record(EntityIdSchema, HeroBeliefV2Schema),
		relationships: z.record(EntityIdSchema, DirectedRelationshipSchema),
		promises: z.record(EntityIdSchema, SocialPromiseSchema),
		authority: z.record(EntityIdSchema, HeroAuthoritySchema),
		communicativeActs: z.record(EntityIdSchema, CommunicativeActSchema)
	})
	.strict()
	.superRefine((society, context) => {
		const collections = [
			['observation', society.observations, 'observationId'],
			['belief', society.beliefs, 'beliefId'],
			['relationship', society.relationships, 'relationshipId'],
			['promise', society.promises, 'promiseId'],
			['authority', society.authority, 'authorityId'],
			['communicative act', society.communicativeActs, 'actId']
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
export type SocietyStateV2 = z.infer<typeof SocietyStateV2Schema>;
export type SocialObservation = z.infer<typeof SocialObservationSchema>;
export type HeroBelief = z.infer<typeof HeroBeliefSchema>;
export type DirectedRelationship = z.infer<typeof DirectedRelationshipSchema>;
export type HeroAuthority = z.infer<typeof HeroAuthoritySchema>;
export type SocialPromise = z.infer<typeof SocialPromiseSchema>;
export type RelationshipDimensions = z.infer<typeof RelationshipDimensionsSchema>;
export type AuthorityDimensions = z.infer<typeof AuthorityDimensionsSchema>;
export type CommunicativeAct = z.infer<typeof CommunicativeActSchema>;
export type CommunicationTopic = z.infer<typeof CommunicationTopicSchema>;
export type CommunicationDelivery = z.infer<typeof CommunicationDeliverySchema>;
export type CommunicationTone = z.infer<typeof CommunicationToneSchema>;
export type OnboardingCommunicativeActKind = z.infer<typeof OnboardingCommunicativeActKindSchema>;
