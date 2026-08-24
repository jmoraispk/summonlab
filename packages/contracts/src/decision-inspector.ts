import { z } from 'zod';

import { LegalActionSchema } from './character.js';
import {
	DecisionJobApplicationSchema,
	DecisionJobAttemptSchema,
	DecisionJobStatusSchema,
	DecisionJobTransitionSchema,
	DecisionProviderRequestProfileSchema,
	HeroPolicyIdSchema,
	HeroPolicyTraceSchema,
	HeroDecisionKindSchema,
	MemoryScoreSchema,
	ModelPolicyUsageSchema
} from './decision.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const DECISION_INSPECTOR_VERSION = 'decision-inspector-v1';
export const DECISION_JOB_CLIENT_VIEW_VERSION = 'decision-job-client-v1';

export const DecisionJobClientViewSchema = z
	.object({
		schemaVersion: z.literal(DECISION_JOB_CLIENT_VIEW_VERSION),
		decisionJobId: EntityIdSchema,
		replacementJobId: EntityIdSchema.nullable(),
		status: DecisionJobStatusSchema,
		resolution: z.enum(['requested', 'fallback']).nullable(),
		packetHash: StateHashSchema,
		attemptCount: z.number().int().nonnegative(),
		replanCount: z.number().int().nonnegative(),
		failure: z
			.object({
				code: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
				retryable: z.boolean()
			})
			.strict()
			.nullable(),
		result: z
			.object({
				policyId: HeroPolicyIdSchema,
				actionId: z.string().min(1).max(80),
				resultHash: StateHashSchema
			})
			.strict()
			.nullable(),
		application: DecisionJobApplicationSchema.nullable(),
		transitions: z
			.array(
				z
					.object({
						sequence: z.number().int().positive(),
						toStatus: DecisionJobStatusSchema
					})
					.strict()
			)
			.min(1)
			.max(64)
	})
	.strict();

export const SensitiveTextDigestSchema = z
	.object({
		redacted: z.literal(true),
		classification: z.enum([
			'player-communication',
			'player-directive',
			'hero-memory-summary',
			'social-evidence',
			'promise-terms',
			'belief-text',
			'hero-public-output'
		]),
		characters: z.number().int().nonnegative().max(20_000),
		sha256: StateHashSchema
	})
	.strict();

export const DecisionInspectorRedactionSchema = z
	.object({
		path: z.string().min(1).max(240),
		value: SensitiveTextDigestSchema
	})
	.strict();

export const DecisionInspectorOmissionSchema = z
	.object({
		category: z.enum([
			'credential',
			'run-secret',
			'other-actor-private-state',
			'undiscovered-world-state',
			'future-state',
			'full-event-log',
			'provider-private-reasoning'
		]),
		path: z.string().min(1).max(160),
		reason: z.string().min(1).max(300),
		enforcedBy: z.enum([
			'packet-schema',
			'context-assembler',
			'provider-request-builder',
			'persistence-schema',
			'inspector-redactor'
		])
	})
	.strict();

export const DecisionInspectorMemoryEvidenceSchema = z
	.object({
		memoryId: EntityIdSchema,
		observationId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		kind: z.enum(['awakening', 'first-ember-commitment', 'communication']),
		occurredAt: IsoDateTimeSchema,
		subjectIds: z.array(EntityIdSchema).min(1).max(8),
		summary: SensitiveTextDigestSchema,
		exactCommunication: z
			.object({
				actId: EntityIdSchema,
				speakerId: EntityIdSchema,
				kind: z.string().min(1).max(40),
				topic: z.string().min(1).max(80),
				delivery: z.enum(['private', 'open']),
				perception: z.enum(['addressed', 'overheard']),
				exactText: SensitiveTextDigestSchema
			})
			.strict()
			.nullable(),
		score: MemoryScoreSchema,
		reasons: z.array(z.string().min(1).max(120)).min(1).max(8),
		characterCost: z.number().int().positive().max(1_200)
	})
	.strict();

export const DecisionInspectorValidationSchema = z
	.object({
		boundary: z.enum([
			'packet-schema',
			'packet-hash',
			'legal-action-hash',
			'job-packet-binding',
			'provider-request-binding',
			'result-schema',
			'result-hash',
			'result-packet-binding',
			'legal-action-selection',
			'target-boundary',
			'memory-boundary',
			'engine-application'
		]),
		outcome: z.enum(['passed', 'not-reached', 'rejected', 'legacy-unavailable']),
		evidence: z.string().min(1).max(500)
	})
	.strict();

export const DecisionInspectorResultSchema = z
	.object({
		schemaVersion: z.literal('hero-policy-result-v1'),
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
		decision: z
			.object({
				actionId: z.string().min(1).max(80),
				targetIds: z.array(EntityIdSchema).max(4),
				publicIntent: SensitiveTextDigestSchema,
				spokenText: SensitiveTextDigestSchema.nullable(),
				goalProposal: z
					.object({
						summary: SensitiveTextDigestSchema,
						motive: SensitiveTextDigestSchema,
						horizon: z.enum(['now', 'today', 'mission', 'long-term'])
					})
					.strict()
					.nullable(),
				memoryCandidateIds: z.array(EntityIdSchema).max(6)
			})
			.strict(),
		trace: HeroPolicyTraceSchema,
		resultHash: StateHashSchema
	})
	.strict();

export const DecisionInspectorReportSchema = z
	.object({
		schemaVersion: z.literal(DECISION_INSPECTOR_VERSION),
		reportHash: StateHashSchema,
		job: z
			.object({
				schemaVersion: z.enum(['decision-job-v1', 'decision-job-v2']),
				decisionJobId: EntityIdSchema,
				rootJobId: EntityIdSchema,
				parentJobId: EntityIdSchema.nullable(),
				replacementJobId: EntityIdSchema.nullable(),
				runId: EntityIdSchema,
				heroId: EntityIdSchema,
				decisionKind: HeroDecisionKindSchema,
				status: DecisionJobStatusSchema,
				requestedPolicy: z.enum(['random', 'scripted', 'model']),
				activePolicy: z.enum(['random', 'scripted', 'model']).nullable(),
				resolution: z.enum(['requested', 'fallback']).nullable(),
				attemptCount: z.number().int().nonnegative(),
				providerAttemptCount: z.number().int().nonnegative(),
				replanCount: z.number().int().nonnegative(),
				createdAt: IsoDateTimeSchema,
				updatedAt: IsoDateTimeSchema,
				application: DecisionJobApplicationSchema.nullable(),
				attempts: z.array(DecisionJobAttemptSchema).max(16),
				transitions: z.array(DecisionJobTransitionSchema).min(1).max(64)
			})
			.strict(),
		binding: z
			.object({
				packetId: EntityIdSchema,
				packetHash: StateHashSchema,
				stateVersion: z.number().int().nonnegative(),
				eventCursor: z.number().int().positive(),
				stateHash: StateHashSchema,
				legalActionHash: StateHashSchema,
				resultHash: StateHashSchema.nullable()
			})
			.strict(),
		context: z
			.object({
				packetVersion: z.literal('hero-decision-packet-v1'),
				contextPolicyVersion: z.literal('hero-context-v1'),
				memoryPolicyVersion: z.literal('hero-memory-v1'),
				assembledAtGameTime: IsoDateTimeSchema,
				suppliedSections: z.tuple([
					z.literal('identity'),
					z.literal('self'),
					z.literal('environment'),
					z.literal('knowledge'),
					z.literal('social'),
					z.literal('activeDirectives'),
					z.literal('legalActions'),
					z.literal('responseContract')
				]),
				counts: z
					.object({
						visibleEntities: z.number().int().nonnegative(),
						beliefs: z.number().int().nonnegative(),
						relationships: z.number().int().nonnegative(),
						authorityModels: z.number().int().nonnegative(),
						promises: z.number().int().nonnegative(),
						directives: z.number().int().nonnegative(),
						legalActions: z.number().int().positive(),
						memoryCandidates: z.number().int().nonnegative(),
						selectedMemories: z.number().int().nonnegative(),
						selectedMemoryCharacters: z.number().int().nonnegative()
					})
					.strict(),
				selectedEvidence: z.array(DecisionInspectorMemoryEvidenceSchema).max(32),
				legalActions: z.array(LegalActionSchema).min(1).max(128),
				redactedPacket: z.record(z.string(), z.unknown()),
				redactions: z.array(DecisionInspectorRedactionSchema).max(256)
			})
			.strict(),
		privacy: z
			.object({
				access: z.literal('development-only'),
				credentialPresent: z.literal(false),
				privateReasoningPresent: z.literal(false),
				rawSensitiveTextPresent: z.literal(false),
				omitted: z.array(DecisionInspectorOmissionSchema).min(7).max(16)
			})
			.strict(),
		provider: z
			.object({
				disposition: z.enum([
					'not-requested',
					'profiled-not-attempted',
					'attempted',
					'completed',
					'failed',
					'legacy-metadata-unavailable'
				]),
				request: DecisionProviderRequestProfileSchema.nullable(),
				response: z
					.object({
						responseId: z.string().min(1).max(160),
						requestedModel: z.string().min(1).max(120),
						resolvedModel: z.string().min(1).max(120),
						serviceTier: z.string().min(1).max(40).nullable(),
						requestHash: StateHashSchema,
						outputHash: StateHashSchema,
						usage: ModelPolicyUsageSchema
					})
					.strict()
					.nullable(),
				tokenMetadata: z
					.object({
						source: z.enum(['provider', 'not-applicable', 'unavailable']),
						usage: ModelPolicyUsageSchema.nullable()
					})
					.strict()
			})
			.strict(),
		result: DecisionInspectorResultSchema.nullable(),
		validation: z.array(DecisionInspectorValidationSchema).min(8).max(16)
	})
	.strict();

export type DecisionInspectorReport = z.infer<typeof DecisionInspectorReportSchema>;
export type DecisionJobClientView = z.infer<typeof DecisionJobClientViewSchema>;
export type SensitiveTextDigest = z.infer<typeof SensitiveTextDigestSchema>;
