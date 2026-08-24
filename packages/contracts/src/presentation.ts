import { z } from 'zod';

import { BuildingPowerStateSchema, FirstEmberStateSchema, HeroLifeStateSchema } from './engine.js';
import { SettlementSlugSchema } from './settlement.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';
import {
	ConversationActKindSchema,
	ConversationOrderIntentSchema,
	HeroConversationResponseSchema
} from './social.js';

export const SettlementDayPhaseSchema = z.enum(['dawn', 'day', 'dusk', 'night']);
export const SettlementPoseSchema = z.enum([
	'idle',
	'walk',
	'work',
	'sleep',
	'eat',
	'train',
	'downed',
	'dead'
]);

export const SettlementTravelProjectionSchema = z
	.object({
		toNodeId: SettlementSlugSchema,
		routeNodeIds: z.array(SettlementSlugSchema).min(1),
		progress: z.number().min(0).max(0.98),
		startedAt: IsoDateTimeSchema,
		arrivesAt: IsoDateTimeSchema
	})
	.strict();

export const SettlementOccupantProjectionSchema = z
	.object({
		heroId: EntityIdSchema,
		lifeState: HeroLifeStateSchema.exclude(['synthesized']),
		nodeId: SettlementSlugSchema,
		buildingId: SettlementSlugSchema.nullable(),
		pose: SettlementPoseSchema,
		activityLabel: z.string().min(1).max(80),
		travel: SettlementTravelProjectionSchema.nullable()
	})
	.strict();

export const SettlementBuildingProjectionSchema = z
	.object({
		buildingId: SettlementSlugSchema,
		powerState: BuildingPowerStateSchema,
		assignmentCount: z.number().int().nonnegative(),
		assignmentCapacity: z.number().int().positive(),
		occupantHeroIds: z.array(EntityIdSchema)
	})
	.strict();

export const SocialRelationshipToneSchema = z.enum(['guarded', 'neutral', 'receptive', 'trusting']);
export const AuthorityStandingSchema = z.enum([
	'unrecognized',
	'contested',
	'provisional',
	'recognized'
]);

export const HeroSocialProjectionSchema = z
	.object({
		heroId: EntityIdSchema,
		beliefCount: z.number().int().nonnegative(),
		latestObservation: z
			.object({
				kind: z.enum(['awakening', 'first-ember-commitment', 'communication']),
				summary: z.string().min(1).max(300),
				observedAt: IsoDateTimeSchema
			})
			.strict()
			.nullable(),
		relationshipToMaster: z
			.object({
				tone: SocialRelationshipToneSchema,
				latestEvidence: z.string().min(1).max(240).nullable()
			})
			.strict(),
		authority: z
			.object({
				standing: AuthorityStandingSchema,
				latestEvidence: z.string().min(1).max(240).nullable()
			})
			.strict(),
		activePromiseTerms: z.array(z.string().min(1).max(240)).max(16)
	})
	.strict();

export const ConversationWitnessProjectionSchema = z
	.object({
		heroId: EntityIdSchema,
		role: z.enum(['intended', 'bystander']),
		perception: z.enum(['addressed', 'overheard']),
		learnedBelief: z.boolean()
	})
	.strict();

export const ConversationActProjectionSchema = z
	.object({
		actId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		kind: z.enum(['explain', 'tell', 'ask', 'order', 'conceal', 'accuse', 'investigate']),
		topic: z.enum([
			'master-role',
			'summoning-situation',
			'tower-mission',
			'hero-memory',
			'open-conversation',
			'daily-order'
		]),
		exactText: z.string().min(1).max(600),
		tone: z.enum(['neutral', 'reassuring', 'firm', 'urgent', 'apologetic']).nullable(),
		delivery: z.enum(['private', 'open']),
		location: z.enum(['summoning-gate', 'kitchen', 'training-ground', 'dormitory', 'workshop']),
		occurredAt: IsoDateTimeSchema,
		witnesses: z.array(ConversationWitnessProjectionSchema).min(1).max(32)
	})
	.strict();

export const CommunicationBeliefProjectionSchema = z
	.object({
		beliefId: EntityIdSchema,
		predicate: z.enum(['claims-master-role', 'was-summoned-into', 'described-tower-mission']),
		objectSummary: z.string().min(1).max(240),
		confidence: z.number().int().min(0).max(100),
		learnedFromId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		observationId: EntityIdSchema
	})
	.strict();

export const ConversationTurnProjectionSchema = z
	.object({
		turnId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		communicationActId: EntityIdSchema,
		kind: ConversationActKindSchema,
		orderIntent: ConversationOrderIntentSchema.nullable(),
		masterText: z.string().min(1).max(600),
		heroResponse: HeroConversationResponseSchema,
		occurredAt: IsoDateTimeSchema
	})
	.strict();

export const HeroConversationPresentationSchema = z
	.object({
		runId: EntityIdSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		stateHash: StateHashSchema,
		heroId: EntityIdSchema,
		canCommunicate: z.boolean(),
		availability: z.enum([
			'available',
			'legacy-history',
			'run-terminal',
			'master-terminal',
			'hero-terminal',
			'different-location',
			'hero-in-transit',
			'hero-occupied'
		]),
		masterLocation: z.string().min(1).max(80),
		heroLocation: z.string().min(1).max(80),
		acts: z.array(ConversationActProjectionSchema).max(24),
		turns: z.array(ConversationTurnProjectionSchema).max(24),
		beliefsLearnedFromCommunication: z.array(CommunicationBeliefProjectionSchema).max(48)
	})
	.strict();

export const SettlementPresentationSchema = z
	.object({
		runId: EntityIdSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		stateHash: StateHashSchema,
		gameTime: IsoDateTimeSchema,
		dayIndex: z.number().int().nonnegative(),
		dayNumber: z.number().int().positive(),
		minuteOfDay: z.number().int().min(0).max(1_439),
		dayPhase: SettlementDayPhaseSchema,
		firstEmber: FirstEmberStateSchema.nullable(),
		buildings: z.array(SettlementBuildingProjectionSchema),
		occupants: z.array(SettlementOccupantProjectionSchema),
		social: z.array(HeroSocialProjectionSchema)
	})
	.strict();

export type SettlementDayPhase = z.infer<typeof SettlementDayPhaseSchema>;
export type SettlementPose = z.infer<typeof SettlementPoseSchema>;
export type SettlementPresentation = z.infer<typeof SettlementPresentationSchema>;
export type HeroSocialProjection = z.infer<typeof HeroSocialProjectionSchema>;
export type HeroConversationPresentation = z.infer<typeof HeroConversationPresentationSchema>;
