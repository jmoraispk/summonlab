import { z } from 'zod';

import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

export const DecisionTimingSchema = z.enum(['wait', 'countdown', 'step', 'continuous']);
export const FallbackPolicySchema = z.enum(['directed', 'random']);
export const DecisionSourceSchema = z.enum([
	'manual',
	'countdown',
	'step',
	'continuous',
	'directed',
	'random',
	'scripted',
	'model',
	'habit',
	'system'
]);

export const PlayerDirectiveSchema = z
	.object({
		directiveId: EntityIdSchema,
		runId: EntityIdSchema,
		authorId: EntityIdSchema,
		text: z.string().min(1).max(1_000),
		scope: z.enum(['decision', 'mission', 'day', 'until_revoked']),
		recipientIds: z.array(EntityIdSchema).max(32),
		witnessEventId: EntityIdSchema.nullable(),
		priorities: z.array(z.string().min(1).max(80)).max(12),
		createdAt: IsoDateTimeSchema,
		expiresAt: IsoDateTimeSchema.nullable(),
		revokedAt: IsoDateTimeSchema.nullable()
	})
	.strict();

export const DirectiveScopeSchema = PlayerDirectiveSchema.shape.scope;
export const DirectiveStatusSchema = z.enum([
	'active',
	'consumed',
	'expired',
	'revoked',
	'replaced'
]);
export const DirectiveInfluenceOutcomeSchema = z.enum(['advanced', 'conflicted', 'unavailable']);

export const DirectiveRecordSchema = PlayerDirectiveSchema.extend({
	delivery: z.enum(['private', 'open']),
	status: DirectiveStatusSchema,
	witnessObservationIds: z.array(EntityIdSchema).min(1).max(32),
	expiryScheduledEventId: EntityIdSchema.nullable(),
	replacesDirectiveId: EntityIdSchema.nullable(),
	replacedByDirectiveId: EntityIdSchema.nullable(),
	terminalAt: IsoDateTimeSchema.nullable(),
	terminalEventId: EntityIdSchema.nullable()
})
	.strict()
	.superRefine((directive, context) => {
		const terminal = directive.status !== 'active';
		if (
			terminal !== (directive.terminalAt !== null) ||
			terminal !== (directive.terminalEventId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Directive terminal state is inconsistent' });
		}
		if (
			(directive.scope === 'day') !== (directive.expiresAt !== null) ||
			(directive.scope === 'day') !== (directive.expiryScheduledEventId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Only day directives have timed expiry' });
		}
		if (
			(directive.status === 'replaced') !== (directive.replacedByDirectiveId !== null) ||
			['revoked', 'replaced'].includes(directive.status) !== (directive.revokedAt !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Directive revocation state is inconsistent' });
		}
		if (
			directive.status === 'expired' &&
			(directive.expiresAt === null || directive.terminalAt !== directive.expiresAt)
		) {
			context.addIssue({ code: 'custom', message: 'Directive expiry time is inconsistent' });
		}
	});

export const DirectiveInfluenceRecordSchema = z
	.object({
		influenceId: EntityIdSchema,
		directiveId: EntityIdSchema,
		heroId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		decisionJobId: EntityIdSchema.nullable(),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		outcome: DirectiveInfluenceOutcomeSchema,
		rationale: z.string().min(1).max(240),
		evaluatedAt: IsoDateTimeSchema
	})
	.strict();

export const ActionSourceSchema = z
	.object({
		source: DecisionSourceSchema,
		timing: DecisionTimingSchema.nullable(),
		fallbackPolicy: FallbackPolicySchema.nullable(),
		directiveIds: z.array(EntityIdSchema).max(16),
		decisionJobId: EntityIdSchema.nullable()
	})
	.strict();

export const RewardDeltaSchema = z
	.object({
		ownerId: EntityIdSchema,
		kind: z.enum([
			'resource',
			'experience',
			'level',
			'skill',
			'item',
			'durability',
			'health',
			'need',
			'habit',
			'relationship'
		]),
		key: z.string().min(1).max(100),
		before: z.number(),
		after: z.number(),
		delta: z.number()
	})
	.strict()
	.refine((value) => value.after - value.before === value.delta, {
		message: 'Delta must equal after minus before'
	});

export const AuthoritativeEventSchema = z
	.object({
		eventId: EntityIdSchema,
		runId: EntityIdSchema,
		sequence: z.number().int().positive(),
		schemaVersion: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		actorId: EntityIdSchema.nullable(),
		commandId: EntityIdSchema,
		causationId: EntityIdSchema.nullable(),
		correlationId: EntityIdSchema,
		source: ActionSourceSchema,
		seedCursor: z.number().int().nonnegative(),
		beforeStateHash: StateHashSchema,
		afterStateHash: StateHashSchema,
		contentVersion: ContentVersionSchema,
		payload: z.record(z.string(), z.unknown())
	})
	.strict();

export const JournalEntrySchema = z
	.object({
		journalEntryId: EntityIdSchema,
		runId: EntityIdSchema,
		eventIds: z.array(EntityIdSchema).min(1).max(100),
		sequenceStart: z.number().int().positive(),
		sequenceEnd: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		category: z.enum([
			'action',
			'combat',
			'reward',
			'progression',
			'social',
			'story',
			'control',
			'failure'
		]),
		title: z.string().min(1).max(120),
		summary: z.string().min(1).max(1_000),
		participantIds: z.array(EntityIdSchema).max(32),
		deltas: z.array(RewardDeltaSchema).max(50),
		source: ActionSourceSchema,
		directionOutcome: z.enum(['advanced', 'conflicted', 'unavailable']).nullable(),
		replayCursor: z.number().int().positive()
	})
	.strict()
	.refine((value) => value.sequenceStart <= value.sequenceEnd, {
		message: 'Journal sequence range is inverted'
	});

export const EngineEventHeadSchema = z
	.object({
		runId: EntityIdSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		stateHash: StateHashSchema,
		gameTime: IsoDateTimeSchema
	})
	.strict();

export const EngineEventPageSchema = z
	.object({
		runId: EntityIdSchema,
		requestedAfter: z.number().int().nonnegative(),
		nextCursor: z.number().int().nonnegative(),
		latestCursor: z.number().int().positive(),
		hasMore: z.boolean(),
		gap: z.enum(['cursor_ahead', 'missing_events']).nullable(),
		events: z.array(AuthoritativeEventSchema).max(256)
	})
	.strict();

export const EngineStreamReadySchema = z
	.object({
		runId: EntityIdSchema,
		afterCursor: z.number().int().nonnegative(),
		latestCursor: z.number().int().positive(),
		heartbeatMs: z.number().int().min(1_000).max(60_000)
	})
	.strict();

export const EngineCursorGapSchema = z
	.object({
		runId: EntityIdSchema,
		requestedAfter: z.number().int().nonnegative(),
		latestCursor: z.number().int().positive(),
		reason: z.enum(['cursor_ahead', 'missing_events'])
	})
	.strict();

export const ReturnRecapCountsSchema = z
	.object({
		plansCreated: z.number().int().nonnegative(),
		routinesCompleted: z.number().int().nonnegative(),
		activitiesCompleted: z.number().int().nonnegative(),
		travelArrivals: z.number().int().nonnegative(),
		failures: z.number().int().nonnegative(),
		clockSyncs: z.number().int().nonnegative()
	})
	.strict();

export const ReturnRecapDeltaSchema = z
	.object({
		ownerId: EntityIdSchema,
		kind: RewardDeltaSchema.shape.kind,
		key: z.string().min(1).max(100),
		delta: z.number()
	})
	.strict();

export const ReturnRecapSchema = z
	.object({
		runId: EntityIdSchema,
		fromCursor: z.number().int().nonnegative(),
		toCursor: z.number().int().positive(),
		fromGameTime: IsoDateTimeSchema.nullable(),
		toGameTime: IsoDateTimeSchema,
		spanGameMinutes: z.number().int().nonnegative(),
		eventCount: z.number().int().nonnegative(),
		omittedEventCount: z.number().int().nonnegative(),
		headline: z.string().min(1).max(160),
		summary: z.string().min(1).max(1_000),
		counts: ReturnRecapCountsSchema,
		deltas: z.array(ReturnRecapDeltaSchema).max(24),
		highlights: z.array(JournalEntrySchema).max(8)
	})
	.strict()
	.refine((value) => value.fromCursor <= value.toCursor, {
		message: 'Recap cursor range is inverted'
	});

export type ActionSource = z.infer<typeof ActionSourceSchema>;
export type AuthoritativeEvent = z.infer<typeof AuthoritativeEventSchema>;
export type DecisionSource = z.infer<typeof DecisionSourceSchema>;
export type DecisionTiming = z.infer<typeof DecisionTimingSchema>;
export type EngineCursorGap = z.infer<typeof EngineCursorGapSchema>;
export type EngineEventHead = z.infer<typeof EngineEventHeadSchema>;
export type EngineEventPage = z.infer<typeof EngineEventPageSchema>;
export type EngineStreamReady = z.infer<typeof EngineStreamReadySchema>;
export type FallbackPolicy = z.infer<typeof FallbackPolicySchema>;
export type DirectiveInfluenceOutcome = z.infer<typeof DirectiveInfluenceOutcomeSchema>;
export type DirectiveInfluenceRecord = z.infer<typeof DirectiveInfluenceRecordSchema>;
export type DirectiveRecord = z.infer<typeof DirectiveRecordSchema>;
export type DirectiveScope = z.infer<typeof DirectiveScopeSchema>;
export type DirectiveStatus = z.infer<typeof DirectiveStatusSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type PlayerDirective = z.infer<typeof PlayerDirectiveSchema>;
export type ReturnRecap = z.infer<typeof ReturnRecapSchema>;
export type ReturnRecapCounts = z.infer<typeof ReturnRecapCountsSchema>;
export type ReturnRecapDelta = z.infer<typeof ReturnRecapDeltaSchema>;
export type RewardDelta = z.infer<typeof RewardDeltaSchema>;
