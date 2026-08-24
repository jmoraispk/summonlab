import { z } from 'zod';

import { CharacterManifestSchema, CharacterMindSchema, LegalActionSchema } from './character.js';
import {
	CurrentActivitySchema,
	CurrentRoutineSchema,
	CurrentTravelSchema,
	DailyPlanSchema,
	EngineItemStateSchema,
	EngineZoneSchema,
	HabitStateSchema,
	HeroBuildingAssignmentSchema,
	HeroLifeStateSchema,
	HeroProgressionSchema,
	InjurySchema,
	NeedStateSchema
} from './engine.js';
import { PlayerDirectiveSchema } from './event.js';
import {
	AuthorityDimensionsSchema,
	BeliefObjectSchema,
	BeliefProvenanceSchema,
	CommunicationDeliverySchema,
	CommunicationToneSchema,
	CommunicationTopicSchema,
	CommunicativeActKindSchema,
	RelationshipDimensionsSchema
} from './social.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';
import { PolicyModeSchema } from './run.js';

export const HERO_DECISION_PACKET_VERSION = 'hero-decision-packet-v1';
export const HERO_CONTEXT_POLICY_VERSION = 'hero-context-v1';
export const HERO_MEMORY_RETRIEVAL_VERSION = 'hero-memory-v1';
export const HERO_DECISION_RESPONSE_VERSION = 'hero-decision-v1';
export const HERO_POLICY_RESULT_VERSION = 'hero-policy-result-v1';
export const HERO_DECISION_PREVIEW_VERSION = 'hero-decision-preview-v1';
export const RANDOM_POLICY_VERSION = 'random-policy-v1';
export const SCRIPTED_POLICY_VERSION = 'scripted-policy-v1';
export const MODEL_POLICY_VERSION = 'model-policy-v1';
export const HERO_MODEL_PROMPT_VERSION = 'hero-model-prompt-v1';
export const LEGACY_DECISION_JOB_VERSION = 'decision-job-v1';
export const DECISION_JOB_VERSION = 'decision-job-v2';
export const DECISION_PROVIDER_REQUEST_VERSION = 'decision-provider-request-v1';

export const HeroDecisionKindSchema = z.enum([
	'settlement-action',
	'mission-action',
	'conversation-response',
	'story-expression'
]);

export const GoalProposalSchema = z
	.object({
		summary: z.string().min(1).max(240),
		motive: z.string().min(1).max(160),
		horizon: z.enum(['now', 'today', 'mission', 'long-term'])
	})
	.strict();

export const HeroDecisionSchema = z
	.object({
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		targetIds: z.array(EntityIdSchema).max(4),
		publicIntent: z.string().min(1).max(240),
		spokenText: z.string().min(1).max(600).nullable(),
		goalProposal: GoalProposalSchema.nullable(),
		memoryCandidateIds: z.array(EntityIdSchema).max(6)
	})
	.strict();

export const HeroDecisionResponseContractSchema = z
	.object({
		schemaVersion: z.literal(HERO_DECISION_RESPONSE_VERSION),
		instruction: z.literal('Choose exactly one supplied legal action. The engine resolves it.'),
		maxTargetIds: z.literal(4),
		maxMemoryCandidateIds: z.literal(6)
	})
	.strict();

export const DecisionIdentityProfileSchema = CharacterManifestSchema.pick({
	characterId: true,
	displayName: true,
	rarityStars: true,
	adultAge: true,
	genderPresentation: true,
	pronouns: true,
	bodyFrame: true,
	bodyBuild: true,
	heightCm: true,
	physiology: true,
	phenotype: true,
	voice: true,
	posture: true,
	handedness: true,
	visualTraits: true
}).strict();

export const DecisionBeliefSchema = z
	.object({
		beliefId: EntityIdSchema,
		subjectId: EntityIdSchema,
		predicate: z.string().min(1).max(80),
		object: BeliefObjectSchema,
		confidence: z.number().int().min(0).max(100),
		status: z.enum(['held', 'doubted', 'retracted']),
		learnedAt: IsoDateTimeSchema,
		provenance: BeliefProvenanceSchema
	})
	.strict();

export const MemoryScoreSchema = z
	.object({
		total: z.number().int().min(0).max(500),
		salience: z.number().int().min(0).max(100),
		recency: z.number().int().min(0).max(100),
		subjectRelevance: z.number().int().min(0).max(100),
		locationRelevance: z.number().int().min(0).max(100),
		communicationRelevance: z.number().int().min(0).max(100)
	})
	.strict();

export const RetrievedMemorySchema = z
	.object({
		memoryId: EntityIdSchema,
		observationId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		kind: z.enum(['awakening', 'first-ember-commitment', 'communication']),
		occurredAt: IsoDateTimeSchema,
		summary: z.string().min(1).max(300),
		subjectIds: z.array(EntityIdSchema).min(1).max(8),
		exactCommunication: z
			.object({
				actId: EntityIdSchema,
				speakerId: EntityIdSchema,
				kind: CommunicativeActKindSchema,
				topic: CommunicationTopicSchema,
				exactText: z.string().min(1).max(600),
				tone: CommunicationToneSchema.nullable(),
				delivery: CommunicationDeliverySchema,
				perception: z.enum(['addressed', 'overheard'])
			})
			.strict()
			.nullable(),
		score: MemoryScoreSchema,
		reasons: z.array(z.string().min(1).max(120)).min(1).max(8),
		characterCost: z.number().int().positive().max(1_200)
	})
	.strict();

export const MemoryRetrievalTraceSchema = z
	.object({
		policyVersion: z.literal(HERO_MEMORY_RETRIEVAL_VERSION),
		candidateCount: z.number().int().nonnegative(),
		selectedCount: z.number().int().nonnegative(),
		maxItems: z.number().int().positive().max(32),
		maxCharacters: z.number().int().positive().max(20_000),
		selectedCharacters: z.number().int().nonnegative(),
		memories: z.array(RetrievedMemorySchema).max(32)
	})
	.strict()
	.superRefine((trace, context) => {
		if (trace.selectedCount !== trace.memories.length) {
			context.addIssue({ code: 'custom', message: 'Selected memory count is inconsistent' });
		}
		if (
			trace.selectedCount > trace.maxItems ||
			trace.selectedCharacters > trace.maxCharacters ||
			trace.selectedCharacters !==
				trace.memories.reduce((total, memory) => total + memory.characterCost, 0)
		) {
			context.addIssue({ code: 'custom', message: 'Memory retrieval exceeded its budget' });
		}
	});

export const DecisionRelationshipSchema = z
	.object({
		relationshipId: EntityIdSchema,
		toEntityId: EntityIdSchema,
		dimensions: RelationshipDimensionsSchema,
		updatedAt: IsoDateTimeSchema,
		latestEvidence: z.string().min(1).max(240).nullable()
	})
	.strict();

export const DecisionAuthoritySchema = z
	.object({
		authorityId: EntityIdSchema,
		subjectId: EntityIdSchema,
		dimensions: AuthorityDimensionsSchema,
		updatedAt: IsoDateTimeSchema,
		latestEvidence: z.string().min(1).max(240).nullable()
	})
	.strict();

export const DecisionPromiseSchema = z
	.object({
		promiseId: EntityIdSchema,
		promisorId: EntityIdSchema,
		terms: z.string().min(1).max(240),
		status: z.enum(['active', 'kept', 'broken', 'expired']),
		createdAt: IsoDateTimeSchema
	})
	.strict();

export const VisibleEntitySchema = z
	.object({
		entityId: EntityIdSchema,
		kind: z.enum(['self', 'person']),
		knownAs: z.string().min(1).max(80).nullable(),
		lifeState: z.enum(['active', 'dead', 'synthesized', 'alive'])
	})
	.strict();

export const HeroDecisionPacketSchema = z
	.object({
		packetVersion: z.literal(HERO_DECISION_PACKET_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		packetId: EntityIdSchema,
		packetHash: StateHashSchema,
		runId: EntityIdSchema,
		heroId: EntityIdSchema,
		decisionKind: HeroDecisionKindSchema,
		assembledAtGameTime: IsoDateTimeSchema,
		world: z
			.object({
				stateVersion: z.number().int().nonnegative(),
				eventCursor: z.number().int().positive(),
				stateHash: StateHashSchema,
				contentVersion: z.string().min(1).max(80)
			})
			.strict(),
		identity: z
			.object({
				profile: DecisionIdentityProfileSchema,
				manifestHash: StateHashSchema,
				mind: CharacterMindSchema
			})
			.strict(),
		self: z
			.object({
				lifeState: HeroLifeStateSchema,
				location: EngineZoneSchema,
				locationNodeId: z.string().min(1).max(80),
				destination: z.enum(['kitchen', 'training-ground']).nullable(),
				health: z.number().int().nonnegative(),
				maxHealth: z.number().int().positive(),
				needs: NeedStateSchema,
				injuries: z.array(InjurySchema).max(20),
				progression: HeroProgressionSchema,
				items: z.array(EngineItemStateSchema).max(32),
				assignment: HeroBuildingAssignmentSchema.nullable(),
				habit: HabitStateSchema,
				dailyPlan: DailyPlanSchema.nullable(),
				currentActivity: CurrentActivitySchema.nullable(),
				currentTravel: CurrentTravelSchema.nullable(),
				currentRoutine: CurrentRoutineSchema.nullable()
			})
			.strict(),
		environment: z
			.object({
				location: EngineZoneSchema,
				locationNodeId: z.string().min(1).max(80),
				visibleEntities: z.array(VisibleEntitySchema).min(1).max(64),
				currentBuilding: z
					.object({
						buildingId: z.string().min(1).max(80),
						powerState: z.enum(['unpowered', 'reserve', 'powered'])
					})
					.strict()
					.nullable(),
				affordanceActionIds: z.array(z.string()).min(1).max(128)
			})
			.strict(),
		knowledge: z
			.object({
				beliefs: z.array(DecisionBeliefSchema).max(32),
				memoryRetrieval: MemoryRetrievalTraceSchema
			})
			.strict(),
		social: z
			.object({
				relationships: z.array(DecisionRelationshipSchema).max(32),
				authority: z.array(DecisionAuthoritySchema).max(8),
				promises: z.array(DecisionPromiseSchema).max(32)
			})
			.strict(),
		activeDirectives: z.array(PlayerDirectiveSchema).max(16),
		legalActions: z.array(LegalActionSchema).min(1).max(128),
		legalActionHash: StateHashSchema,
		responseContract: HeroDecisionResponseContractSchema
	})
	.strict()
	.superRefine((packet, context) => {
		if (
			packet.identity.profile.characterId !== packet.heroId ||
			packet.legalActions.some((action) => action.actorId !== packet.heroId) ||
			packet.environment.affordanceActionIds.join('|') !==
				packet.legalActions.map((action) => action.actionId).join('|')
		) {
			context.addIssue({ code: 'custom', message: 'Decision packet actor scope is inconsistent' });
		}
	});

export const PolicyScoreContributionSchema = z
	.object({
		key: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		value: z.number().int().min(-10_000).max(10_000),
		reason: z.string().min(1).max(200)
	})
	.strict();

export const PolicyActionScoreSchema = z
	.object({
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		total: z.number().int().min(-100_000).max(100_000),
		contributions: z.array(PolicyScoreContributionSchema).min(1).max(32)
	})
	.strict()
	.superRefine((score, context) => {
		if (
			score.total !==
			score.contributions.reduce((total, contribution) => total + contribution.value, 0)
		) {
			context.addIssue({ code: 'custom', message: 'Policy score total is inconsistent' });
		}
	});

export const RandomPolicyTraceSchema = z
	.object({
		kind: z.literal('random'),
		policyVersion: z.literal(RANDOM_POLICY_VERSION),
		seedHash: StateHashSchema,
		draw: z.number().int().nonnegative().max(0xffff_ffff),
		candidateActionIds: z
			.array(z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u))
			.min(1)
			.max(128),
		selectedIndex: z.number().int().nonnegative().max(127)
	})
	.strict()
	.superRefine((trace, context) => {
		if (trace.selectedIndex >= trace.candidateActionIds.length) {
			context.addIssue({ code: 'custom', message: 'Random policy selected index is out of range' });
		}
	});

export const ScriptedPolicyTraceSchema = z
	.object({
		kind: z.literal('scripted'),
		policyVersion: z.literal(SCRIPTED_POLICY_VERSION),
		tieBreakRule: z.literal('highest-score-then-action-id'),
		actionScores: z.array(PolicyActionScoreSchema).min(1).max(128)
	})
	.strict();

export const ModelPolicyUsageSchema = z
	.object({
		inputTokens: z.number().int().nonnegative(),
		cachedInputTokens: z.number().int().nonnegative(),
		outputTokens: z.number().int().nonnegative(),
		reasoningTokens: z.number().int().nonnegative(),
		totalTokens: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((usage, context) => {
		if (usage.cachedInputTokens > usage.inputTokens) {
			context.addIssue({ code: 'custom', message: 'Cached input tokens exceed input tokens' });
		}
		if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
			context.addIssue({ code: 'custom', message: 'Model policy token total is inconsistent' });
		}
	});

export const ModelPolicyTraceSchema = z
	.object({
		kind: z.literal('model'),
		policyVersion: z.literal(MODEL_POLICY_VERSION),
		provider: z.literal('openai'),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		schemaName: z.literal('summonlab_hero_decision'),
		requestedModel: z.string().min(1).max(120),
		resolvedModel: z.string().min(1).max(120),
		responseId: z.string().min(1).max(160),
		serviceTier: z.string().min(1).max(40).nullable(),
		requestHash: StateHashSchema,
		outputHash: StateHashSchema,
		selectedActionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		usage: ModelPolicyUsageSchema
	})
	.strict();

export const HeroPolicyIdSchema = z.enum([
	RANDOM_POLICY_VERSION,
	SCRIPTED_POLICY_VERSION,
	MODEL_POLICY_VERSION
]);

export const HeroPolicyTraceSchema = z.discriminatedUnion('kind', [
	RandomPolicyTraceSchema,
	ScriptedPolicyTraceSchema,
	ModelPolicyTraceSchema
]);

export const HeroPolicyResultSchema = z
	.object({
		schemaVersion: z.literal(HERO_POLICY_RESULT_VERSION),
		policyId: HeroPolicyIdSchema,
		packetId: EntityIdSchema,
		packetHash: StateHashSchema,
		legalActionHash: StateHashSchema,
		decisionKind: HeroDecisionKindSchema,
		world: z
			.object({
				stateVersion: z.number().int().nonnegative(),
				eventCursor: z.number().int().positive(),
				stateHash: StateHashSchema
			})
			.strict(),
		decision: HeroDecisionSchema,
		trace: HeroPolicyTraceSchema,
		resultHash: StateHashSchema
	})
	.strict()
	.superRefine((result, context) => {
		if (result.policyId !== result.trace.policyVersion) {
			context.addIssue({ code: 'custom', message: 'Policy result version is inconsistent' });
		}
		const selectedActionId =
			result.trace.kind === 'random'
				? result.trace.candidateActionIds[result.trace.selectedIndex]
				: result.trace.kind === 'scripted'
					? [...result.trace.actionScores].sort(
							(left, right) =>
								right.total - left.total || left.actionId.localeCompare(right.actionId)
						)[0]?.actionId
					: result.trace.selectedActionId;
		if (selectedActionId !== result.decision.actionId) {
			context.addIssue({
				code: 'custom',
				message: 'Policy trace does not select the decision action'
			});
		}
	});

export const DecisionProviderRequestProfileSchema = z
	.object({
		schemaVersion: z.literal(DECISION_PROVIDER_REQUEST_VERSION),
		provider: z.literal('openai'),
		endpoint: z.literal('/v1/responses'),
		packetHash: StateHashSchema,
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		schemaName: z.literal('summonlab_hero_decision'),
		requestedModel: z.string().min(1).max(120),
		background: z.literal(false),
		store: z.literal(false),
		serviceTier: z.literal('default'),
		maxOutputTokens: z.number().int().min(128).max(4_000),
		reasoningEffort: z.enum(['minimal', 'low', 'medium']),
		textVerbosity: z.literal('low'),
		conversationId: z.null(),
		previousResponseId: z.null(),
		toolCount: z.literal(0),
		requestKeys: z.tuple([
			z.literal('background'),
			z.literal('input'),
			z.literal('instructions'),
			z.literal('max_output_tokens'),
			z.literal('model'),
			z.literal('reasoning'),
			z.literal('service_tier'),
			z.literal('store'),
			z.literal('text')
		]),
		inputCharacters: z.number().int().positive().max(200_000),
		inputHash: StateHashSchema,
		instructionsHash: StateHashSchema,
		schemaHash: StateHashSchema,
		requestHash: StateHashSchema,
		credentialDisposition: z.literal('server-only-never-persisted'),
		privateReasoningDisposition: z.literal('private-reasoning-content-not-requested-or-stored')
	})
	.strict();

export const DecisionJobStatusSchema = z.enum([
	'created',
	'queued',
	'in_progress',
	'retry_wait',
	'fallback',
	'completed',
	'validated',
	'applied',
	'stale',
	'replanned',
	'failed'
]);

export const DecisionAttemptKindSchema = z.enum(['primary', 'retry', 'fallback']);

export const DecisionJobFailureSchema = z
	.object({
		code: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		message: z.string().min(1).max(500),
		retryable: z.boolean(),
		occurredAt: IsoDateTimeSchema
	})
	.strict();

export const DecisionJobAttemptSchema = z
	.object({
		attemptNumber: z.number().int().positive(),
		kind: DecisionAttemptKindSchema,
		policy: PolicyModeSchema,
		policyId: HeroPolicyIdSchema,
		status: z.enum(['in_progress', 'succeeded', 'failed']),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema.nullable(),
		latencyMs: z.number().int().nonnegative().nullable(),
		resultHash: StateHashSchema.nullable(),
		failure: DecisionJobFailureSchema.nullable()
	})
	.strict()
	.superRefine((attempt, context) => {
		if (
			(attempt.status === 'in_progress') !== (attempt.completedAt === null) ||
			(attempt.status === 'succeeded') !== (attempt.resultHash !== null) ||
			(attempt.status === 'failed') !== (attempt.failure !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Decision attempt terminal fields are inconsistent'
			});
		}
	});

export const DecisionJobTransitionSchema = z
	.object({
		sequence: z.number().int().positive(),
		fromStatus: DecisionJobStatusSchema.nullable(),
		toStatus: DecisionJobStatusSchema,
		reason: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		detail: z.string().min(1).max(500).nullable(),
		occurredAt: IsoDateTimeSchema
	})
	.strict();

export const DecisionJobApplicationSchema = z
	.object({
		commandId: EntityIdSchema,
		eventCursor: z.number().int().positive(),
		runVersion: z.number().int().positive(),
		stateHash: StateHashSchema,
		appliedAt: IsoDateTimeSchema
	})
	.strict();

const DecisionJobRecordFields = {
	decisionJobId: EntityIdSchema,
	rootJobId: EntityIdSchema,
	parentJobId: EntityIdSchema.nullable(),
	replacementJobId: EntityIdSchema.nullable(),
	runId: EntityIdSchema,
	heroId: EntityIdSchema,
	decisionKind: HeroDecisionKindSchema,
	status: DecisionJobStatusSchema,
	requestedPolicy: PolicyModeSchema,
	nextAttemptKind: DecisionAttemptKindSchema,
	activePolicy: PolicyModeSchema.nullable(),
	resolution: z.enum(['requested', 'fallback']).nullable(),
	expectedRunVersion: z.number().int().nonnegative(),
	expectedEventCursor: z.number().int().positive(),
	decisionGameTime: IsoDateTimeSchema,
	packetId: EntityIdSchema,
	packetHash: StateHashSchema,
	stateHash: StateHashSchema,
	legalActionHash: StateHashSchema,
	promptVersion: z.string().min(1).max(80),
	contextPolicyVersion: z.string().min(1).max(80),
	packet: HeroDecisionPacketSchema,
	result: HeroPolicyResultSchema.nullable(),
	failure: DecisionJobFailureSchema.nullable(),
	attemptCount: z.number().int().nonnegative(),
	providerAttemptCount: z.number().int().nonnegative(),
	maxProviderAttempts: z.number().int().min(1).max(4),
	replanCount: z.number().int().nonnegative().max(16),
	maxReplans: z.number().int().nonnegative().max(16),
	leaseExpiresAt: IsoDateTimeSchema.nullable(),
	application: DecisionJobApplicationSchema.nullable(),
	attempts: z.array(DecisionJobAttemptSchema).max(16),
	transitions: z.array(DecisionJobTransitionSchema).min(1).max(64),
	createdAt: IsoDateTimeSchema,
	updatedAt: IsoDateTimeSchema
} satisfies z.ZodRawShape;

function validateDecisionJobRecord(
	job: z.infer<z.ZodObject<typeof DecisionJobRecordFields>>,
	context: z.RefinementCtx
): void {
	if (
		job.packet.packetId !== job.packetId ||
		job.packet.packetHash !== job.packetHash ||
		job.packet.runId !== job.runId ||
		job.packet.heroId !== job.heroId ||
		job.packet.decisionKind !== job.decisionKind ||
		job.packet.world.stateVersion !== job.expectedRunVersion ||
		job.packet.world.eventCursor !== job.expectedEventCursor ||
		job.packet.world.stateHash !== job.stateHash ||
		job.packet.legalActionHash !== job.legalActionHash
	) {
		context.addIssue({ code: 'custom', message: 'Decision job packet binding is inconsistent' });
	}
	if (
		job.result &&
		(job.result.packetId !== job.packetId ||
			job.result.packetHash !== job.packetHash ||
			job.result.legalActionHash !== job.legalActionHash ||
			job.result.world.stateVersion !== job.expectedRunVersion ||
			job.result.world.eventCursor !== job.expectedEventCursor ||
			job.result.world.stateHash !== job.stateHash)
	) {
		context.addIssue({ code: 'custom', message: 'Decision job result binding is inconsistent' });
	}
	if (job.attemptCount !== job.attempts.length) {
		context.addIssue({ code: 'custom', message: 'Decision job attempt count is inconsistent' });
	}
	const latestTransition = job.transitions.at(-1);
	if (!latestTransition || latestTransition.toStatus !== job.status) {
		context.addIssue({ code: 'custom', message: 'Decision job transition head is inconsistent' });
	}
	if ((job.status === 'applied') !== (job.application !== null)) {
		context.addIssue({ code: 'custom', message: 'Decision job application is inconsistent' });
	}
	if (job.status === 'applied' && !job.result) {
		context.addIssue({ code: 'custom', message: 'Applied decision job has no result' });
	}
	if (job.parentJobId === null && job.rootJobId !== job.decisionJobId) {
		context.addIssue({ code: 'custom', message: 'Root decision job identity is inconsistent' });
	}
}

export const DecisionJobRecordV1Schema = z
	.object({
		schemaVersion: z.literal(LEGACY_DECISION_JOB_VERSION),
		...DecisionJobRecordFields
	})
	.strict()
	.superRefine(validateDecisionJobRecord);

export const DecisionJobRecordV2Schema = z
	.object({
		schemaVersion: z.literal(DECISION_JOB_VERSION),
		...DecisionJobRecordFields,
		providerRequest: DecisionProviderRequestProfileSchema.nullable()
	})
	.strict()
	.superRefine((job, context) => {
		validateDecisionJobRecord(job, context);
		if ((job.requestedPolicy === 'model') !== (job.providerRequest !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Decision provider request profile does not match the requested policy'
			});
		}
		if (job.providerRequest && job.providerRequest.packetHash !== job.packetHash) {
			context.addIssue({
				code: 'custom',
				message: 'Decision provider request profile is bound to another packet'
			});
		}
	});

export const DecisionJobRecordSchema = z.discriminatedUnion('schemaVersion', [
	DecisionJobRecordV1Schema,
	DecisionJobRecordV2Schema
]);

export const DecisionJobCreateRequestSchema = z
	.object({
		heroId: EntityIdSchema,
		packetHash: StateHashSchema,
		policy: PolicyModeSchema,
		costAcknowledged: z.boolean().default(false)
	})
	.strict();

export const HeroDecisionPreviewSchema = z
	.object({
		schemaVersion: z.literal(HERO_DECISION_PREVIEW_VERSION),
		packet: HeroDecisionPacketSchema,
		policies: z
			.object({
				random: HeroPolicyResultSchema,
				scripted: HeroPolicyResultSchema
			})
			.strict()
	})
	.strict()
	.superRefine((preview, context) => {
		if (
			preview.policies.random.policyId !== RANDOM_POLICY_VERSION ||
			preview.policies.scripted.policyId !== SCRIPTED_POLICY_VERSION
		) {
			context.addIssue({
				code: 'custom',
				message: 'Policy preview baseline slots are inconsistent'
			});
		}
		for (const result of Object.values(preview.policies)) {
			if (
				result.packetId !== preview.packet.packetId ||
				result.packetHash !== preview.packet.packetHash ||
				result.legalActionHash !== preview.packet.legalActionHash ||
				result.decisionKind !== preview.packet.decisionKind
			) {
				context.addIssue({
					code: 'custom',
					message: 'Policy preview packet reference is inconsistent'
				});
			}
		}
	});

export type HeroDecision = z.infer<typeof HeroDecisionSchema>;
export type HeroDecisionKind = z.infer<typeof HeroDecisionKindSchema>;
export type HeroDecisionPacket = z.infer<typeof HeroDecisionPacketSchema>;
export type HeroDecisionPreview = z.infer<typeof HeroDecisionPreviewSchema>;
export type HeroPolicyResult = z.infer<typeof HeroPolicyResultSchema>;
export type DecisionProviderRequestProfile = z.infer<typeof DecisionProviderRequestProfileSchema>;
export type DecisionAttemptKind = z.infer<typeof DecisionAttemptKindSchema>;
export type DecisionJobAttempt = z.infer<typeof DecisionJobAttemptSchema>;
export type DecisionJobCreateRequest = z.infer<typeof DecisionJobCreateRequestSchema>;
export type DecisionJobFailure = z.infer<typeof DecisionJobFailureSchema>;
export type DecisionJobRecord = z.infer<typeof DecisionJobRecordSchema>;
export type DecisionJobStatus = z.infer<typeof DecisionJobStatusSchema>;
export type DecisionJobTransition = z.infer<typeof DecisionJobTransitionSchema>;
export type PolicyActionScore = z.infer<typeof PolicyActionScoreSchema>;
export type PolicyScoreContribution = z.infer<typeof PolicyScoreContributionSchema>;
export type RetrievedMemory = z.infer<typeof RetrievedMemorySchema>;
