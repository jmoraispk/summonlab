import { z } from 'zod';

import { BuildingPowerStateSchema, HeroLifeStateSchema } from './engine.js';
import { SettlementSlugSchema } from './settlement.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

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
		buildings: z.array(SettlementBuildingProjectionSchema),
		occupants: z.array(SettlementOccupantProjectionSchema)
	})
	.strict();

export type SettlementDayPhase = z.infer<typeof SettlementDayPhaseSchema>;
export type SettlementPose = z.infer<typeof SettlementPoseSchema>;
export type SettlementPresentation = z.infer<typeof SettlementPresentationSchema>;
