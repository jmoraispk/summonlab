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
	'hero-memory',
	'open-conversation',
	'daily-order'
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
		const claimTopic = ['master-role', 'summoning-situation', 'tower-mission'].includes(act.topic);
		if (claimTopic !== (act.claim !== null)) {
			context.addIssue({ code: 'custom', message: 'Structured claims require a factual topic' });
		}
		if (
			(act.kind === 'ask' && !['hero-memory', 'open-conversation'].includes(act.topic)) ||
			(act.kind === 'order' && act.topic !== 'daily-order') ||
			(!['ask', 'order'].includes(act.kind) && ['hero-memory', 'daily-order'].includes(act.topic))
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
			'hero-memory': null,
			'open-conversation': null,
			'daily-order': null
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

export const ConversationActKindSchema = z.enum(['say', 'ask', 'order']);
export const ConversationOrderIntentSchema = z.enum([
	'train',
	'rest',
	'eat',
	'work',
	'prepare-tower'
]);
export const ConversationOrderOutcomeSchema = z.enum([
	'accepted',
	'negotiated',
	'refused',
	'deferred'
]);

export const ConversationOrderScoreSchema = z
	.object({
		authority: z.number().int().min(-100).max(100),
		relationship: z.number().int().min(-100).max(100),
		personality: z.number().int().min(-100).max(100),
		alignment: z.number().int().min(-100).max(100),
		needs: z.number().int().min(-100).max(100),
		tone: z.number().int().min(-100).max(100),
		total: z.number().int().min(-600).max(600)
	})
	.strict()
	.superRefine((score, context) => {
		if (
			score.total !==
			score.authority +
				score.relationship +
				score.personality +
				score.alignment +
				score.needs +
				score.tone
		) {
			context.addIssue({ code: 'custom', message: 'Conversation order score is inconsistent' });
		}
	});

export const HeroConversationResponseSchema = z
	.object({
		exactText: z
			.string()
			.min(1)
			.max(600)
			.refine((text) => /\S/u.test(text), {
				message: 'Hero response must contain a visible character'
			}),
		publicReason: z.string().min(1).max(240),
		orderOutcome: ConversationOrderOutcomeSchema.nullable(),
		orderScore: ConversationOrderScoreSchema.nullable(),
		preferenceWeight: z.number().int().min(0).max(36)
	})
	.strict()
	.superRefine((response, context) => {
		if (
			(response.orderOutcome === null) !== (response.orderScore === null) ||
			(response.orderOutcome === null && response.preferenceWeight !== 0) ||
			(response.orderOutcome === 'refused' && response.preferenceWeight !== 0) ||
			(response.orderOutcome === 'deferred' && response.preferenceWeight !== 0) ||
			(response.orderOutcome === 'negotiated' && response.preferenceWeight !== 12) ||
			(response.orderOutcome === 'accepted' && response.preferenceWeight !== 24)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Conversation response outcome is inconsistent'
			});
		}
	});

export const HeroConversationTurnSchema = z
	.object({
		turnId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		communicationActId: EntityIdSchema,
		masterId: EntityIdSchema,
		heroId: EntityIdSchema,
		kind: ConversationActKindSchema,
		orderIntent: ConversationOrderIntentSchema.nullable(),
		response: HeroConversationResponseSchema,
		occurredAt: IsoDateTimeSchema
	})
	.strict()
	.superRefine((turn, context) => {
		if (
			(turn.kind === 'order') !== (turn.orderIntent !== null) ||
			(turn.kind === 'order') !== (turn.response.orderOutcome !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Conversation turn kind is inconsistent' });
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

export const SocietyStateV3Schema = z
	.object({
		...SocietyStateV2Schema.shape,
		contentVersion: z.literal('society-v3'),
		conversationTurns: z.record(EntityIdSchema, HeroConversationTurnSchema)
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
		if (Object.keys(society.conversationTurns).length > 2_048) {
			context.addIssue({ code: 'custom', message: 'Too many conversation turns' });
		}
		for (const [turnId, turn] of Object.entries(society.conversationTurns)) {
			if (turn.turnId !== turnId) {
				context.addIssue({
					code: 'custom',
					message: 'Conversation turn key does not match its id'
				});
			}
			const act = society.communicativeActs[turn.communicationActId];
			if (
				!act ||
				act.sourceEventId !== turn.sourceEventId ||
				act.speakerId !== turn.masterId ||
				!act.intendedAudienceIds.includes(turn.heroId) ||
				act.occurredAt !== turn.occurredAt ||
				(turn.kind === 'order'
					? act.kind !== 'order'
					: act.kind !== turn.kind.replace('say', 'tell'))
			) {
				context.addIssue({
					code: 'custom',
					message: 'Conversation turn must resolve to its witnessed communication'
				});
			}
		}
	});

export type SocietyState = z.infer<typeof SocietyStateSchema>;
export type SocietyStateV2 = z.infer<typeof SocietyStateV2Schema>;
export type SocietyStateV3 = z.infer<typeof SocietyStateV3Schema>;
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
export type ConversationActKind = z.infer<typeof ConversationActKindSchema>;
export type ConversationOrderIntent = z.infer<typeof ConversationOrderIntentSchema>;
export type ConversationOrderOutcome = z.infer<typeof ConversationOrderOutcomeSchema>;
export type HeroConversationTurn = z.infer<typeof HeroConversationTurnSchema>;
