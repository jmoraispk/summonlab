import { z } from 'zod';

import { CombatAttributeNameSchema } from './capability.js';
import { CombatRulesVersionSchema } from './combat-rules.js';
import { CombatChoiceBatchV1Schema, CombatResolvedEventSchema } from './readiness-combat.js';
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

export const AttributeGrowthReceiptSchema = z
	.object({
		receiptId: EntityIdSchema,
		heroId: EntityIdSchema,
		attribute: CombatAttributeNameSchema,
		beforeIntrinsicValue: z.number().int().min(1).max(100),
		afterIntrinsicValue: z.number().int().min(1).max(100),
		spentPoints: z.literal(1),
		sourceLevel: z.number().int().min(2).max(70),
		rulesVersion: CombatRulesVersionSchema,
		commandId: EntityIdSchema,
		gameTime: IsoDateTimeSchema
	})
	.strict()
	.refine(
		(receipt) => receipt.afterIntrinsicValue - receipt.beforeIntrinsicValue === receipt.spentPoints,
		{ message: 'Attribute growth receipt must record exactly the points spent' }
	);

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
		eventType: z.union([
			z.literal('mission.combat.choice-batch.applied'),
			z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u)
		]),
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

export const CombatChoiceBatchAppliedEventSchema = AuthoritativeEventSchema.extend({
	schemaVersion: z.literal(26),
	eventType: z.literal('mission.combat.choice-batch.applied'),
	contentVersion: z.literal('engine-v26'),
	payload: z
		.object({
			batch: CombatChoiceBatchV1Schema,
			resolvedEvents: z.array(CombatResolvedEventSchema).max(1_000)
		})
		.strict()
}).strict();

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

export const PlayerJournalFacetSchema = z.enum([
	'action',
	'combat',
	'reward',
	'progression',
	'party',
	'control',
	'direction',
	'story',
	'failure'
]);

export const PlayerJournalActionSchema = z
	.object({
		actorId: z.string().min(1).max(120),
		actorKind: z.enum(['master', 'hero', 'monster', 'system']),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,119}$/u),
		decisionSource: DecisionSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		publicIntent: z.string().min(1).max(300),
		outcome: z.enum(['applied', 'superseded', 'recorded'])
	})
	.strict();

export const PlayerJournalMissionContextSchema = z
	.object({
		missionId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
		floor: z.number().int().min(1).max(100).nullable(),
		attemptId: EntityIdSchema.nullable(),
		attemptOrdinal: z.number().int().positive().nullable(),
		roundNumber: z.number().int().nonnegative().max(100).nullable(),
		status: z
			.enum([
				'available',
				'preparing',
				'deployed',
				'resolving',
				'extraction',
				'success',
				'failure',
				'retreat',
				'canceled',
				'death'
			])
			.nullable(),
		partyMemberIds: z.array(EntityIdSchema).max(8),
		completedObjectiveIds: z.array(z.string().min(1).max(100)).max(20),
		discoveryIds: z.array(z.string().min(1).max(100)).max(100)
	})
	.strict();

export const PlayerJournalPartyProgressKindSchema = z.enum([
	'party-members',
	'attempts-started',
	'deployments',
	'rounds-resolved',
	'objectives-completed',
	'discoveries',
	'threats-defeated',
	'successful-extractions',
	'retreats',
	'casualties'
]);

export const PlayerJournalPartyProgressDeltaSchema = z
	.object({
		kind: PlayerJournalPartyProgressKindSchema,
		key: z.string().min(1).max(120),
		before: z.number().int().nonnegative(),
		after: z.number().int().nonnegative(),
		delta: z.number().int()
	})
	.strict()
	.refine((value) => value.after - value.before === value.delta, {
		message: 'Party progress delta must equal after minus before'
	});

export const PlayerJournalDirectionSchema = z
	.object({
		directionId: EntityIdSchema,
		kind: z.enum(['directive', 'fallback']),
		text: z.string().min(1).max(1_000),
		priorities: z.array(z.string().min(1).max(80)).max(12),
		outcome: z.enum([
			'advanced',
			'conflicted',
			'unavailable',
			'selected',
			'unclassified',
			'safety-stopped',
			'paused',
			'mission-ended',
			'not-evaluated'
		]),
		rationale: z.string().min(1).max(300)
	})
	.strict();

export const PlayerJournalStoryChangeSchema = z
	.object({
		kind: z.enum([
			'branch',
			'first-ember',
			'mission',
			'objective',
			'discovery',
			'evidence',
			'patch'
		]),
		key: z.string().min(1).max(120),
		before: z.string().max(240).nullable(),
		after: z.string().min(1).max(240),
		summary: z.string().min(1).max(360)
	})
	.strict();

export const PlayerJournalEntrySchema = JournalEntrySchema.safeExtend({
	entryVersion: z.literal('player-journal-entry-v1'),
	eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
	stateHash: StateHashSchema,
	dayNumber: z.number().int().positive(),
	facets: z.array(PlayerJournalFacetSchema).min(1).max(9),
	mission: PlayerJournalMissionContextSchema.nullable(),
	actions: z.array(PlayerJournalActionSchema).max(48),
	partyProgressDeltas: z.array(PlayerJournalPartyProgressDeltaSchema).max(16),
	directions: z.array(PlayerJournalDirectionSchema).max(16),
	storyChanges: z.array(PlayerJournalStoryChangeSchema).max(32)
}).strict();

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

export const PlayerJournalPartyTotalsSchema = z
	.object({
		attemptsStarted: z.number().int().nonnegative(),
		deployments: z.number().int().nonnegative(),
		roundsResolved: z.number().int().nonnegative(),
		objectivesCompleted: z.number().int().nonnegative(),
		discoveries: z.number().int().nonnegative(),
		threatsDefeated: z.number().int().nonnegative(),
		successfulExtractions: z.number().int().nonnegative(),
		retreats: z.number().int().nonnegative(),
		casualties: z.number().int().nonnegative()
	})
	.strict();

export const PlayerJournalFilterOptionsSchema = z
	.object({
		days: z.array(z.number().int().positive()).max(10_000),
		missionIds: z.array(z.string().min(1).max(80)).max(100),
		floors: z.array(z.number().int().min(1).max(100)).max(100),
		heroIds: z.array(EntityIdSchema).max(1_000),
		eventTypes: z.array(z.string().min(1).max(100)).max(1_000),
		facets: z.array(PlayerJournalFacetSchema).max(9),
		sources: z.array(DecisionSourceSchema).max(10)
	})
	.strict();

export const PlayerJournalReportSchema = z
	.object({
		reportVersion: z.literal('player-journal-v1'),
		runId: EntityIdSchema,
		fromCursor: z.number().int().positive(),
		toCursor: z.number().int().positive(),
		entryCount: z.number().int().positive(),
		eventStreamHash: StateHashSchema,
		reportHash: StateHashSchema,
		entries: z.array(PlayerJournalEntrySchema).min(1).max(10_000),
		deltaTotals: z.array(ReturnRecapDeltaSchema).max(10_000),
		partyTotals: PlayerJournalPartyTotalsSchema,
		filterOptions: PlayerJournalFilterOptionsSchema
	})
	.strict()
	.superRefine((report, context) => {
		if (
			report.entryCount !== report.entries.length ||
			report.fromCursor !== report.entries[0]?.sequenceStart ||
			report.toCursor !== report.entries.at(-1)?.sequenceEnd
		) {
			context.addIssue({ code: 'custom', message: 'Player journal cursor range is inconsistent' });
		}
	});

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
export type AttributeGrowthReceipt = z.infer<typeof AttributeGrowthReceiptSchema>;
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
export type PlayerJournalAction = z.infer<typeof PlayerJournalActionSchema>;
export type PlayerJournalDirection = z.infer<typeof PlayerJournalDirectionSchema>;
export type PlayerJournalEntry = z.infer<typeof PlayerJournalEntrySchema>;
export type PlayerJournalFacet = z.infer<typeof PlayerJournalFacetSchema>;
export type PlayerJournalFilterOptions = z.infer<typeof PlayerJournalFilterOptionsSchema>;
export type PlayerJournalMissionContext = z.infer<typeof PlayerJournalMissionContextSchema>;
export type PlayerJournalPartyProgressDelta = z.infer<typeof PlayerJournalPartyProgressDeltaSchema>;
export type PlayerJournalPartyProgressKind = z.infer<typeof PlayerJournalPartyProgressKindSchema>;
export type PlayerJournalPartyTotals = z.infer<typeof PlayerJournalPartyTotalsSchema>;
export type PlayerJournalReport = z.infer<typeof PlayerJournalReportSchema>;
export type PlayerJournalStoryChange = z.infer<typeof PlayerJournalStoryChangeSchema>;
export type PlayerDirective = z.infer<typeof PlayerDirectiveSchema>;
export type ReturnRecap = z.infer<typeof ReturnRecapSchema>;
export type ReturnRecapCounts = z.infer<typeof ReturnRecapCountsSchema>;
export type ReturnRecapDelta = z.infer<typeof ReturnRecapDeltaSchema>;
export type RewardDelta = z.infer<typeof RewardDeltaSchema>;
