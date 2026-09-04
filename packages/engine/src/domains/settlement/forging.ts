import {
	CurrentForgingSchema,
	EngineEquipmentItemStateV24Schema,
	EquipmentMaterialIdSchema,
	ScheduledEventSchema,
	type CurrentForging,
	type EngineGameStateV24,
	type EquipmentCraftsmanship,
	type EquipmentDefinition,
	type EquipmentMaterialId,
	type ScheduledEvent
} from '@summonlab/contracts';
import { EQUIPMENT_DEFINITIONS, deriveStandardEquipmentRecipe } from '@summonlab/content';
import { z } from 'zod';

import {
	verifiedEquipmentCatalogBinding,
	verifiedEquipmentDefinition
} from '../../core/content-bindings.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { addGameMinutes } from '../../time.js';
import { createEquipmentItem } from './equipment.js';

export const STANDARD_FORGING_DURATION_MINUTES = 60;

export const ForgingMaterialLotChangeSchema = z
	.object({
		materialId: EquipmentMaterialIdSchema,
		before: z.number().int().positive(),
		after: z.number().int().nonnegative(),
		delta: z.literal(-1),
		reason: z.literal('standard equipment forging reserved')
	})
	.strict()
	.refine((change) => change.after === change.before - 1, {
		message: 'Forging material lot change must consume exactly one lot'
	});

export const ForgingOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		forgingJobId: z.string().uuid(),
		forgeEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		definitionId: z.string(),
		materialId: EquipmentMaterialIdSchema,
		catalogContentVersion: z.literal('equipment-content-v1'),
		catalogContentHash: z.string().length(64),
		item: EngineEquipmentItemStateV24Schema
	})
	.strict();

export type ForgingMaterialLotChange = z.infer<typeof ForgingMaterialLotChangeSchema>;
export type ForgingOutcome = z.infer<typeof ForgingOutcomeSchema>;

export interface StandardForgingStart {
	readonly currentForging: CurrentForging;
	readonly scheduledEvent: ScheduledEvent;
	readonly materialLotChange: ForgingMaterialLotChange;
}

export function currentForgingFor(
	state: { readonly schemaVersion: number; readonly heroes: Record<string, unknown> },
	heroId: string
): CurrentForging | null {
	if (state.schemaVersion !== 24) return null;
	const hero = state.heroes[heroId] as
		{ readonly currentForging?: CurrentForging | null } | undefined;
	return hero?.currentForging ?? null;
}

export function heroHasForgePermission(state: EngineGameStateV24, heroId: string): boolean {
	const hero = state.heroes[heroId];
	const workshop = state.settlement.buildings.workshop;
	return Boolean(
		state.status === 'active' &&
		hero?.lifeState === 'active' &&
		hero.location === 'workshop' &&
		hero.locationNodeId === 'workshop-forge' &&
		hero.assignment?.buildingId === 'workshop' &&
		hero.assignment.role === 'artisan' &&
		workshop?.systemId === 'forge-system' &&
		workshop.assignedHeroIds.includes(heroId) &&
		state.settlement.forgeSystemPower === 'powered' &&
		!hero.currentActivity &&
		!hero.currentTravel &&
		!hero.currentRoutine &&
		!hero.currentForging
	);
}

function standardRequest(craftsmanship: EquipmentCraftsmanship): boolean {
	return craftsmanship.label === 'standard' && craftsmanship.bonus === 0;
}

export function canStartStandardForging(
	state: EngineGameStateV24,
	heroId: string,
	definitionId: string,
	materialId: EquipmentMaterialId,
	craftsmanship: EquipmentCraftsmanship
): boolean {
	if (!heroHasForgePermission(state, heroId) || !standardRequest(craftsmanship)) return false;
	let definition: Readonly<EquipmentDefinition>;
	try {
		definition = verifiedEquipmentDefinition(definitionId);
	} catch {
		return false;
	}
	return Boolean(
		definition.forgeable &&
		definition.materialId === materialId &&
		state.settlement.materialLots[materialId] >= 1
	);
}

export function availableStandardForgeDefinitions(
	state: EngineGameStateV24,
	heroId: string
): readonly Readonly<EquipmentDefinition>[] {
	if (!heroHasForgePermission(state, heroId)) return [];
	return EQUIPMENT_DEFINITIONS.filter(
		(definition) =>
			definition.forgeable && state.settlement.materialLots[definition.materialId] >= 1
	).sort((left, right) => left.definitionId.localeCompare(right.definitionId));
}

export function buildStandardForgingStart(input: {
	readonly state: EngineGameStateV24;
	readonly commandId: string;
	readonly forgeEventId: string;
	readonly heroId: string;
	readonly definitionId: string;
	readonly materialId: EquipmentMaterialId;
	readonly craftsmanship: EquipmentCraftsmanship;
}): StandardForgingStart {
	if (
		!canStartStandardForging(
			input.state,
			input.heroId,
			input.definitionId,
			input.materialId,
			input.craftsmanship
		)
	) {
		throw new Error('Standard forging start is not legal');
	}
	const definition = verifiedEquipmentDefinition(input.definitionId);
	const recipe = deriveStandardEquipmentRecipe(definition);
	const binding = verifiedEquipmentCatalogBinding();
	const forgingJobId = deterministicUuid(`${input.forgeEventId}:forging-job`);
	const scheduledEventId = deterministicUuid(`${input.commandId}:forging-completion`);
	const itemId = deterministicUuid(`${input.forgeEventId}:forged-item`);
	const completesAt = addGameMinutes(input.state.simulatedAt, STANDARD_FORGING_DURATION_MINUTES);
	const currentForging = CurrentForgingSchema.parse({
		forgingJobId,
		forgeEventId: input.forgeEventId,
		scheduledEventId,
		itemId,
		recipe,
		definitionId: definition.definitionId,
		materialId: definition.materialId,
		catalogContentVersion: binding.contentVersion,
		catalogContentHash: binding.contentHash,
		startedAt: input.state.simulatedAt,
		completesAt
	});
	const scheduledEvent = ScheduledEventSchema.parse({
		scheduledEventId,
		runId: input.state.runId,
		actorId: input.heroId,
		dueGameTime: completesAt,
		eventKind: 'hero.forging.complete',
		payload: {
			heroId: input.heroId,
			forgingJobId,
			forgeEventId: input.forgeEventId,
			itemId,
			definitionId: definition.definitionId,
			catalogContentVersion: binding.contentVersion,
			catalogContentHash: binding.contentHash
		}
	});
	const before = input.state.settlement.materialLots[input.materialId];
	return {
		currentForging,
		scheduledEvent,
		materialLotChange: ForgingMaterialLotChangeSchema.parse({
			materialId: input.materialId,
			before,
			after: before - 1,
			delta: -1,
			reason: 'standard equipment forging reserved'
		})
	};
}

export function buildForgingOutcome(state: EngineGameStateV24, heroId: string): ForgingOutcome {
	const job = state.heroes[heroId]?.currentForging;
	if (!job) throw new Error('Cannot resolve a missing forging job');
	const definition = verifiedEquipmentDefinition(job.definitionId);
	const binding = verifiedEquipmentCatalogBinding();
	if (
		definition.materialId !== job.materialId ||
		job.catalogContentVersion !== binding.contentVersion ||
		job.catalogContentHash !== binding.contentHash ||
		job.recipe.definitionId !== definition.definitionId ||
		job.recipe.material.materialId !== definition.materialId ||
		job.itemId !== deterministicUuid(`${job.forgeEventId}:forged-item`)
	) {
		throw new Error('Forging job content binding is unavailable');
	}
	const item = createEquipmentItem({
		itemId: job.itemId,
		definitionId: job.definitionId,
		ownerId: heroId,
		craftsmanship: job.recipe.craftsmanship,
		origin: { kind: 'forged', forgeEventId: job.forgeEventId, crafterId: heroId }
	});
	return ForgingOutcomeSchema.parse({
		scheduledEventId: job.scheduledEventId,
		forgingJobId: job.forgingJobId,
		forgeEventId: job.forgeEventId,
		heroId,
		definitionId: definition.definitionId,
		materialId: definition.materialId,
		catalogContentVersion: binding.contentVersion,
		catalogContentHash: binding.contentHash,
		item
	});
}

export function forgingOutcomeMatches(state: EngineGameStateV24, outcome: ForgingOutcome): boolean {
	try {
		return hashCanonical(buildForgingOutcome(state, outcome.heroId)) === hashCanonical(outcome);
	} catch {
		return false;
	}
}
