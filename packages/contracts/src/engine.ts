import { z } from 'zod';

import { LegalActionSchema } from './character.js';
import { ActionSourceSchema, AuthoritativeEventSchema } from './event.js';
import { RunStatusSchema } from './run.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

export const EngineLocationSchema = z.enum(['summoning-gate', 'kitchen', 'training-ground']);
export const HeroLifeStateSchema = z.enum(['active', 'dead', 'synthesized']);
export const MasterLifeStateSchema = z.enum(['alive', 'dead']);

export const EngineHeroStateSchema = z
	.object({
		heroId: EntityIdSchema,
		lifeState: HeroLifeStateSchema,
		location: EngineLocationSchema,
		destination: z.enum(['kitchen', 'training-ground']).nullable(),
		health: z.number().int().min(0).max(100),
		maxHealth: z.number().int().positive().max(100),
		manifestHash: StateHashSchema
	})
	.strict()
	.refine((value) => value.health <= value.maxHealth, {
		message: 'Hero health cannot exceed maxHealth'
	});

export const EngineMasterStateSchema = z
	.object({
		masterId: EntityIdSchema,
		lifeState: MasterLifeStateSchema,
		location: EngineLocationSchema,
		health: z.number().int().min(0).max(100),
		maxHealth: z.number().int().positive().max(100),
		gateInspectionCount: z.number().int().nonnegative(),
		lastGateResonance: z.number().int().min(0).max(99).nullable()
	})
	.strict()
	.refine((value) => value.health <= value.maxHealth, {
		message: 'Master health cannot exceed maxHealth'
	});

export const EngineStoryStateSchema = z
	.object({
		envelopeId: z.literal('first-ember-v1'),
		branch: z.string().min(1).nullable()
	})
	.strict();

export const EngineGameStateSchema = z
	.object({
		schemaVersion: z.literal(1),
		runId: EntityIdSchema,
		seed: z.string().min(1).max(128),
		contentVersion: ContentVersionSchema,
		status: RunStatusSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		entropyCursor: z.number().int().nonnegative(),
		simulatedAt: IsoDateTimeSchema,
		master: EngineMasterStateSchema,
		heroes: z.record(EntityIdSchema, EngineHeroStateSchema),
		story: EngineStoryStateSchema
	})
	.strict();

const EngineCommandBaseSchema = z
	.object({
		commandId: EntityIdSchema,
		runId: EntityIdSchema,
		actorId: EntityIdSchema,
		expectedVersion: z.number().int().nonnegative(),
		correlationId: EntityIdSchema,
		source: ActionSourceSchema
	})
	.strict();

export const ChooseDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.choose.destination'),
	destination: z.enum(['kitchen', 'training-ground']),
	firstLine: z.string().min(1).max(500),
	storyBranch: z.string().min(1).max(100)
}).strict();

export const ArriveDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.arrive')
}).strict();

export const InspectGateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.inspect.gate')
}).strict();

export const EngineCommandSchema = z.discriminatedUnion('commandType', [
	ChooseDestinationCommandSchema,
	ArriveDestinationCommandSchema,
	InspectGateCommandSchema
]);

export const EntropyDrawSchema = z
	.object({
		purpose: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
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
		dueGameTime: IsoDateTimeSchema,
		eventKind: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		payload: z.record(z.string(), z.unknown())
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
		legalActions: z.array(LegalActionSchema),
		idempotentReplay: z.boolean()
	})
	.strict();

export const ReplayEventCheckSchema = z
	.object({
		sequence: z.number().int().positive(),
		eventType: z.string(),
		beforeStateHash: StateHashSchema,
		afterStateHash: StateHashSchema,
		computedStateHash: StateHashSchema,
		verified: z.boolean(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();

export const EngineReplayReportSchema = z
	.object({
		runId: EntityIdSchema,
		verified: z.boolean(),
		eventCount: z.number().int().positive(),
		checks: z.array(ReplayEventCheckSchema),
		snapshot: EngineSnapshotSchema,
		persistedStateHash: StateHashSchema,
		hashMatchesPersistedSnapshot: z.boolean(),
		legalActions: z.array(LegalActionSchema)
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
		.strict()
]);

export type EngineCommand = z.infer<typeof EngineCommandSchema>;
export type EngineCommit = z.infer<typeof EngineCommitSchema>;
export type EngineGameState = z.infer<typeof EngineGameStateSchema>;
export type EngineReplayReport = z.infer<typeof EngineReplayReportSchema>;
export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
export type EntropyDraw = z.infer<typeof EntropyDrawSchema>;
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;
