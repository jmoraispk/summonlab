import { z } from 'zod';

import { LegalActionSchema } from '../character.js';
import {
	ActionSourceSchema,
	AuthoritativeEventSchema,
	JournalEntrySchema,
	PlayerJournalReportSchema,
	RewardDeltaSchema
} from '../event.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from '../shared.js';
import { EngineGameStateSchema } from './game-state.js';

export const EntropyDrawSchema = z
	.object({
		purpose: z.string().regex(/^[a-z][a-z0-9.-]{2,99}$/u),
		cursor: z.number().int().nonnegative(),
		minimum: z.number().int(),
		maximum: z.number().int(),
		value: z.number().int()
	})
	.strict()
	.refine((draw) => draw.minimum <= draw.value && draw.value <= draw.maximum, {
		message: 'Entropy draw fell outside its declared bounds'
	});

export const ScheduledEventSchema = z
	.object({
		scheduledEventId: EntityIdSchema,
		runId: EntityIdSchema,
		actorId: EntityIdSchema,
		dueGameTime: IsoDateTimeSchema,
		eventKind: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		payload: z.record(z.string(), z.unknown())
	})
	.strict();

export const EngineScheduleRecordSchema = ScheduledEventSchema.extend({
	status: z.enum(['pending', 'resolved', 'canceled']),
	createdEventId: EntityIdSchema,
	terminalEventId: EntityIdSchema.nullable()
}).strict();

export const ClockSpeedSchema = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(2),
	z.literal(4),
	z.literal(8)
]);

export const SimulationClockSchema = z
	.object({
		runId: EntityIdSchema,
		speed: ClockSpeedSchema,
		anchorGameTime: IsoDateTimeSchema,
		anchorRealTime: IsoDateTimeSchema,
		currentGameTime: IsoDateTimeSchema,
		projectedGameTime: IsoDateTimeSchema,
		lastCatchUpAt: IsoDateTimeSchema.nullable(),
		nextDueGameTime: IsoDateTimeSchema.nullable(),
		nextDueRealTime: IsoDateTimeSchema.nullable(),
		backlogGameMinutes: z.number().nonnegative(),
		leaseStatus: z.enum(['idle', 'leased'])
	})
	.strict();

export const CatchUpEventSchema = z
	.object({
		sequence: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		summary: z.string().min(1).max(1_000)
	})
	.strict();

export const CatchUpReportSchema = z
	.object({
		runId: EntityIdSchema,
		result: z.enum(['caught_up', 'noop', 'lease_busy', 'terminal', 'safety_limit']),
		fromGameTime: IsoDateTimeSchema,
		toGameTime: IsoDateTimeSchema,
		targetGameTime: IsoDateTimeSchema,
		wallTime: IsoDateTimeSchema,
		speed: ClockSpeedSchema,
		commandsApplied: z.number().int().nonnegative(),
		schedulesResolved: z.number().int().nonnegative(),
		plansCreated: z.number().int().nonnegative(),
		routinesStarted: z.number().int().nonnegative(),
		truncated: z.boolean(),
		events: z.array(CatchUpEventSchema).max(512),
		clock: SimulationClockSchema
	})
	.strict();

export const EngineSnapshotSchema = z
	.object({
		state: EngineGameStateSchema,
		stateHash: StateHashSchema
	})
	.strict();

export const EngineCommitSchema = z
	.object({
		snapshot: EngineSnapshotSchema,
		events: z.array(AuthoritativeEventSchema).min(1),
		scheduled: z.array(ScheduledEventSchema),
		resolvedScheduledEventIds: z.array(EntityIdSchema),
		canceledScheduledEventIds: z.array(EntityIdSchema),
		legalActions: z.array(LegalActionSchema),
		idempotentReplay: z.boolean()
	})
	.strict();

export const ReplayEventCheckSchema = z
	.object({
		sequence: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		eventType: z.string(),
		actorId: EntityIdSchema.nullable(),
		source: ActionSourceSchema,
		summary: z.string().min(1).max(1_000),
		beforeStateHash: StateHashSchema,
		afterStateHash: StateHashSchema,
		computedStateHash: StateHashSchema,
		verified: z.boolean(),
		entropyDraws: z.array(EntropyDrawSchema),
		deltas: z.array(RewardDeltaSchema)
	})
	.strict();

export const EngineReplayReportSchema = z
	.object({
		runId: EntityIdSchema,
		verified: z.boolean(),
		eventCount: z.number().int().positive(),
		checks: z.array(ReplayEventCheckSchema),
		journalEntries: z.array(JournalEntrySchema),
		playerJournal: PlayerJournalReportSchema,
		scheduledEvents: z.array(EngineScheduleRecordSchema),
		clock: SimulationClockSchema,
		snapshot: EngineSnapshotSchema,
		persistedStateHash: StateHashSchema,
		hashMatchesPersistedSnapshot: z.boolean(),
		legalActions: z.array(LegalActionSchema),
		legalActionsByActor: z.record(EntityIdSchema, z.array(LegalActionSchema))
	})
	.strict();

export const EngineErrorResponseSchema = z.discriminatedUnion('code', [
	z
		.object({
			code: z.literal('STALE_RUN_VERSION'),
			message: z.string(),
			latestVersion: z.number().int().nonnegative(),
			eventCursor: z.number().int().positive(),
			stateHash: StateHashSchema
		})
		.strict(),
	z
		.object({
			code: z.literal('ILLEGAL_ACTION'),
			message: z.string(),
			legalActionIds: z.array(z.string())
		})
		.strict(),
	z
		.object({
			code: z.literal('IDEMPOTENCY_CONFLICT'),
			message: z.string()
		})
		.strict()
]);

export type CatchUpReport = z.infer<typeof CatchUpReportSchema>;
export type ClockSpeed = z.infer<typeof ClockSpeedSchema>;
export type EngineCommit = z.infer<typeof EngineCommitSchema>;
export type EngineReplayReport = z.infer<typeof EngineReplayReportSchema>;
export type EngineScheduleRecord = z.infer<typeof EngineScheduleRecordSchema>;
export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
export type EntropyDraw = z.infer<typeof EntropyDrawSchema>;
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;
export type SimulationClock = z.infer<typeof SimulationClockSchema>;
