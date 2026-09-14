import { z } from 'zod';

const ExplorationSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/u);
const ExplorationHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const ExplorationTileIdSchema = z.string().regex(/^f\d{3}-r\d{3}-c\d{3}$/u);
export const ExplorationChunkIdSchema = z.string().regex(/^f\d{3}-k-r\d{3}-c\d{3}$/u);
export const ExplorationLifecycleSchema = z.enum([
	'exploring',
	'encounter',
	'returning',
	'extracted',
	'defeated'
]);

export const ExplorationLootEntrySchema = z
	.object({
		kind: z.enum(['resource', 'experience', 'equipment', 'consumable']),
		key: ExplorationSlugSchema,
		amount: z.number().int().positive()
	})
	.strict();

export const ExplorationAttemptStateSchema = z
	.object({
		attemptId: z.string().uuid(),
		runId: z.string().uuid(),
		floorId: ExplorationSlugSchema,
		contentVersion: ExplorationSlugSchema,
		contentHash: ExplorationHashSchema,
		status: ExplorationLifecycleSchema,
		partyHeroIds: z.array(ExplorationSlugSchema).min(1).max(8),
		leaderHeroId: ExplorationSlugSchema,
		positionTileId: ExplorationTileIdSchema,
		revealedTileIds: z.array(ExplorationTileIdSchema).min(1),
		resolvedInteractionTileIds: z.array(ExplorationTileIdSchema).default([]),
		objectiveComplete: z.boolean().default(false),
		pendingLoot: z.array(ExplorationLootEntrySchema).default([]),
		version: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((state, context) => {
		if (!state.partyHeroIds.includes(state.leaderHeroId)) {
			context.addIssue({
				code: 'custom',
				path: ['leaderHeroId'],
				message: 'Exploration leader must belong to the party'
			});
		}
		if (new Set(state.partyHeroIds).size !== state.partyHeroIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['partyHeroIds'],
				message: 'Exploration party hero IDs must be unique'
			});
		}
	});

export const ExplorationInteractionSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('entry-extraction') }).strict(),
	z.object({ kind: z.literal('objective'), objectiveId: ExplorationSlugSchema }).strict(),
	z.object({ kind: z.literal('encounter'), dutySlotId: ExplorationSlugSchema }).strict(),
	z
		.object({
			kind: z.literal('resource'),
			resourceId: ExplorationSlugSchema,
			amount: z.number().int().positive()
		})
		.strict(),
	z
		.object({
			kind: z.literal('experience'),
			amount: z.number().int().positive()
		})
		.strict(),
	z
		.object({
			kind: z.literal('equipment'),
			definitionId: ExplorationSlugSchema
		})
		.strict(),
	z
		.object({
			kind: z.literal('consumable'),
			itemId: ExplorationSlugSchema,
			amount: z.number().int().positive()
		})
		.strict(),
	z.object({ kind: z.literal('discovery'), discoveryId: ExplorationSlugSchema }).strict()
]);

export const ExplorationTileDefinitionSchema = z
	.object({
		tileId: ExplorationTileIdSchema,
		chunkId: ExplorationChunkIdSchema,
		row: z.number().int().min(0).max(999),
		column: z.number().int().min(0).max(999),
		zoneId: ExplorationSlugSchema,
		zoneLabel: z.string().min(1).max(80),
		terrain: z.enum(['threshold', 'hall', 'gallery', 'court', 'vault', 'wall']),
		walkable: z.boolean(),
		interaction: ExplorationInteractionSchema.nullable()
	})
	.strict();

export const ExplorationEncounterWeightSchema = z
	.object({
		dutySlotId: ExplorationSlugSchema,
		weight: z.number().int().positive().max(100)
	})
	.strict();

export const ExplorationFloorDefinitionSchema = z
	.object({
		schemaVersion: z.literal('exploration-floor-v1'),
		floorId: ExplorationSlugSchema,
		floorNumber: z.number().int().min(1).max(100),
		displayName: z.string().min(1).max(100),
		contentVersion: ExplorationSlugSchema,
		contentHash: ExplorationHashSchema,
		columns: z.number().int().positive().max(999),
		rows: z.number().int().positive().max(999),
		chunkSize: z.literal(16),
		entryTileId: ExplorationTileIdSchema,
		objectiveTileId: ExplorationTileIdSchema,
		tiles: z.array(ExplorationTileDefinitionSchema).min(1).max(999_999),
		encounterWeights: z.array(ExplorationEncounterWeightSchema).min(1).max(20)
	})
	.strict();

export const HiddenExplorationTileProjectionSchema = z
	.object({
		tileId: ExplorationTileIdSchema,
		chunkId: ExplorationChunkIdSchema,
		row: z.number().int().min(0).max(999),
		column: z.number().int().min(0).max(999),
		knowledge: z.literal('hidden')
	})
	.strict();

export const RevealedExplorationTileProjectionSchema = ExplorationTileDefinitionSchema.extend({
	knowledge: z.literal('revealed')
}).strict();

export const ExplorationTileProjectionSchema = z.discriminatedUnion('knowledge', [
	HiddenExplorationTileProjectionSchema,
	RevealedExplorationTileProjectionSchema
]);

export const ExplorationPowerEstimateSchema = z
	.object({
		schemaVersion: z.literal('exploration-power-v1'),
		capability: z.number().int().nonnegative(),
		equipment: z.number().int().nonnegative(),
		survival: z.number().int().nonnegative(),
		skills: z.number().int().nonnegative(),
		total: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((power, context) => {
		const expected = Math.round(power.capability + power.equipment + power.survival + power.skills);
		if (power.total !== expected) {
			context.addIssue({ code: 'custom', message: `Power total must equal ${expected}` });
		}
	});

export type ExplorationTileId = z.infer<typeof ExplorationTileIdSchema>;
export type ExplorationChunkId = z.infer<typeof ExplorationChunkIdSchema>;
export type ExplorationLifecycle = z.infer<typeof ExplorationLifecycleSchema>;
export type ExplorationLootEntry = z.infer<typeof ExplorationLootEntrySchema>;
export type ExplorationAttemptState = z.infer<typeof ExplorationAttemptStateSchema>;
export type ExplorationInteraction = z.infer<typeof ExplorationInteractionSchema>;
export type ExplorationTileDefinition = z.infer<typeof ExplorationTileDefinitionSchema>;
export type ExplorationFloorDefinition = z.infer<typeof ExplorationFloorDefinitionSchema>;
export type ExplorationTileProjection = z.infer<typeof ExplorationTileProjectionSchema>;
export type ExplorationPowerEstimate = z.infer<typeof ExplorationPowerEstimateSchema>;
