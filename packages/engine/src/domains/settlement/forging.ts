import {
	CurrentForgingSchema,
	EngineEquipmentItemStateV24Schema,
	EquipmentMaterialIdSchema,
	ExperienceReceiptSchema,
	HeroProgressionV2Schema,
	ProductionCompletionEvidenceV1Schema,
	ScheduledEventSchema,
	type CurrentForging,
	type EngineGameStateV24,
	type EngineGameStateV27,
	type EquipmentCraftsmanship,
	type EquipmentDefinition,
	type EquipmentMaterialId,
	type ScheduledEvent
} from '@summonlab/contracts';
import {
	EQUIPMENT_DEFINITIONS,
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING,
	deriveStandardEquipmentRecipe
} from '@summonlab/content';
import { z } from 'zod';

import {
	verifiedEquipmentCatalogBinding,
	verifiedEquipmentDefinition
} from '../../core/content-bindings.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { addGameMinutes } from '../../time.js';
import {
	applyExperienceClaim,
	reconcileHealthAfterProgression
} from '../progression/experience.js';
import { intrinsicAttributes, maximumHealth } from '../progression/math.js';
import { experienceClaimForProduction, productionEvidenceKey } from '../progression/production.js';
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

export const ForgingOutcomeV27Schema = ForgingOutcomeSchema.extend({
	productionEvidence: ProductionCompletionEvidenceV1Schema,
	experienceReceipt: ExperienceReceiptSchema,
	progressionAfter: HeroProgressionV2Schema,
	maxHealthAfter: z.number().int().positive(),
	healthAfter: z.number().int().nonnegative()
}).strict();

export type ForgingMaterialLotChange = z.infer<typeof ForgingMaterialLotChangeSchema>;
export type ForgingOutcome = z.infer<typeof ForgingOutcomeSchema>;
export type ForgingOutcomeV27 = z.infer<typeof ForgingOutcomeV27Schema>;
type ForgingState = EngineGameStateV24 | EngineGameStateV27;

export interface StandardForgingStart {
	readonly currentForging: CurrentForging;
	readonly scheduledEvent: ScheduledEvent;
	readonly materialLotChange: ForgingMaterialLotChange;
}

export function currentForgingFor(
	state: { readonly schemaVersion: number; readonly heroes: Record<string, unknown> },
	heroId: string
): CurrentForging | null {
	if (state.schemaVersion !== 24 && state.schemaVersion !== 27) return null;
	const hero = state.heroes[heroId] as
		{ readonly currentForging?: CurrentForging | null } | undefined;
	return hero?.currentForging ?? null;
}

export function heroHasForgePermission(state: ForgingState, heroId: string): boolean {
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
	state: ForgingState,
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
	state: ForgingState,
	heroId: string
): readonly Readonly<EquipmentDefinition>[] {
	if (!heroHasForgePermission(state, heroId)) return [];
	return EQUIPMENT_DEFINITIONS.filter(
		(definition) =>
			definition.forgeable && state.settlement.materialLots[definition.materialId] >= 1
	).sort((left, right) => left.definitionId.localeCompare(right.definitionId));
}

export function buildStandardForgingStart(input: {
	readonly state: ForgingState;
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

const MATERIAL_RARITY_BAND = { F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7 } as const;

export function buildForgingOutcome(
	state: ForgingState,
	heroId: string,
	completionEventId?: string
): ForgingOutcome | ForgingOutcomeV27 {
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
	const baseOutcome = {
		scheduledEventId: job.scheduledEventId,
		forgingJobId: job.forgingJobId,
		forgeEventId: job.forgeEventId,
		heroId,
		definitionId: definition.definitionId,
		materialId: definition.materialId,
		catalogContentVersion: binding.contentVersion,
		catalogContentHash: binding.contentHash,
		item
	};
	if (state.schemaVersion === 24) return ForgingOutcomeSchema.parse(baseOutcome);
	if (!completionEventId) throw new Error('V27 forging completion requires an event ID');
	const hero = state.heroes[heroId]!;
	const productionEvidence = ProductionCompletionEvidenceV1Schema.parse({
		evidenceVersion: 'production-completion-v1',
		craftKind: 'forging',
		heroId,
		resultId: item.itemId,
		recipeId: definition.definitionId,
		recipeDifficulty:
			PROGRESSION_RULES_V1.crafting.equipmentClassDifficulty[definition.equipmentClass],
		consumedIngredientRarities: [MATERIAL_RARITY_BAND[definition.materialRank]],
		resultQuality: job.recipe.craftsmanship.label,
		completionEventId
	});
	const evidenceKey = productionEvidenceKey(productionEvidence);
	const experienceClaim = experienceClaimForProduction(
		productionEvidence,
		{ priorCompletions: hero.progression.evidenceCounts.crafting[evidenceKey] ?? 0 },
		PROGRESSION_RULES_V1
	);
	const experience = applyExperienceClaim({
		progression: hero.progression,
		claim: experienceClaim,
		rules: PROGRESSION_RULES_V1,
		rulesBinding: PROGRESSION_RULES_V1_BINDING,
		occurredAt: state.simulatedAt
	});
	const maxHealthAfter = maximumHealth(
		intrinsicAttributes(hero.capabilityProfile, experience.progression.permanentGrowth).vitality,
		experience.progression.level,
		PROGRESSION_RULES_V1
	);
	return ForgingOutcomeV27Schema.parse({
		...baseOutcome,
		productionEvidence,
		experienceReceipt: experience.receipt,
		progressionAfter: {
			...experience.progression,
			evidenceCounts: {
				...experience.progression.evidenceCounts,
				crafting: {
					...experience.progression.evidenceCounts.crafting,
					[evidenceKey]: (experience.progression.evidenceCounts.crafting[evidenceKey] ?? 0) + 1
				}
			}
		},
		maxHealthAfter,
		healthAfter: reconcileHealthAfterProgression({
			health: hero.health,
			oldMaximum: hero.maxHealth,
			newMaximum: maxHealthAfter
		})
	});
}

export function forgingOutcomeMatches(
	state: ForgingState,
	outcome: ForgingOutcome | ForgingOutcomeV27,
	completionEventId?: string
): boolean {
	try {
		return (
			hashCanonical(buildForgingOutcome(state, outcome.heroId, completionEventId)) ===
			hashCanonical(outcome)
		);
	} catch {
		return false;
	}
}
