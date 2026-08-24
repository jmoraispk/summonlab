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

export const HeroPolicyTraceSchema = z.discriminatedUnion('kind', [
	RandomPolicyTraceSchema,
	ScriptedPolicyTraceSchema,
	ModelPolicyTraceSchema
]);

export const HeroPolicyResultSchema = z
	.object({
		schemaVersion: z.literal(HERO_POLICY_RESULT_VERSION),
		policyId: z.enum([RANDOM_POLICY_VERSION, SCRIPTED_POLICY_VERSION, MODEL_POLICY_VERSION]),
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
export type PolicyActionScore = z.infer<typeof PolicyActionScoreSchema>;
export type PolicyScoreContribution = z.infer<typeof PolicyScoreContributionSchema>;
export type RetrievedMemory = z.infer<typeof RetrievedMemorySchema>;
