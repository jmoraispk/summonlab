import { z } from 'zod';

import {
	EngineHeroStateV1Schema,
	EngineHeroStateV2Schema,
	EngineEquipmentItemStateV24Schema,
	EngineItemStateSchema,
	EngineMasterStateV1Schema,
	EngineMasterStateV2Schema,
	EngineStoryStateSchema,
	ResourceKeySchema
} from './base-state.js';
import { MasterControlStateSchema, MasterControlStateV2Schema } from './master-control.js';
import {
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionRunStateV9Schema
} from './mission-state.js';
import {
	EngineHeroStateV3Schema,
	EngineHeroStateV4Schema,
	EngineHeroStateV5Schema,
	EngineHeroStateV24Schema,
	EngineHeroStateV25Schema,
	EngineSettlementStateSchema,
	EngineSettlementStateV3Schema,
	EngineSettlementStateV4Schema,
	EngineSettlementStateV6Schema,
	EngineSettlementStateV24Schema
} from './settlement-state.js';
import { RunStatusSchema } from '../run.js';
import {
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema,
	SocietyStateV5Schema
} from '../social.js';
import { ContentVersionSchema, EntityIdSchema, IsoDateTimeSchema } from '../shared.js';
import {
	FirstBandArchiveStateSchema,
	RuntimeBandStoryStateSchema,
	SynthesisStateSchema
} from './story-synthesis-state.js';

export const EngineGameStateV1Schema = z
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
		master: EngineMasterStateV1Schema,
		heroes: z.record(EntityIdSchema, EngineHeroStateV1Schema),
		story: EngineStoryStateSchema
	})
	.strict();

export const EngineGameStateV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		runId: EntityIdSchema,
		seed: z.string().min(1).max(128),
		contentVersion: ContentVersionSchema,
		status: RunStatusSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		entropyCursor: z.number().int().nonnegative(),
		simulatedAt: IsoDateTimeSchema,
		master: EngineMasterStateV2Schema,
		heroes: z.record(EntityIdSchema, EngineHeroStateV2Schema),
		settlement: EngineSettlementStateSchema,
		items: z.record(EntityIdSchema, EngineItemStateSchema),
		story: EngineStoryStateSchema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (!itemId) continue;
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV3Schema = z
	.object({
		...EngineGameStateV2Schema.shape,
		schemaVersion: z.literal(3),
		heroes: z.record(EntityIdSchema, EngineHeroStateV3Schema),
		settlement: EngineSettlementStateV3Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (!itemId) continue;
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV4Schema = z
	.object({
		...EngineGameStateV3Schema.shape,
		schemaVersion: z.literal(4),
		heroes: z.record(EntityIdSchema, EngineHeroStateV4Schema),
		settlement: EngineSettlementStateV4Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'Powered building slot is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({ code: 'custom', message: 'Active systems diverged from building power' });
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV5Schema = z
	.object({
		...EngineGameStateV4Schema.shape,
		schemaVersion: z.literal(5),
		heroes: z.record(EntityIdSchema, EngineHeroStateV5Schema)
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'Powered building slot is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({ code: 'custom', message: 'Active systems diverged from building power' });
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV6Schema = z
	.object({
		...EngineGameStateV5Schema.shape,
		schemaVersion: z.literal(6),
		settlement: EngineSettlementStateV6Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({
					code: 'custom',
					message: 'Building power diverged from its baseline'
				});
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
		if (
			state.settlement.firstEmber.status === 'committed' &&
			state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId
		) {
			context.addIssue({
				code: 'custom',
				message: 'Committed First Ember must own the power slot'
			});
		}
		if (
			state.settlement.firstEmber.status !== 'committed' &&
			state.settlement.poweredBuildingId !== null
		) {
			context.addIssue({
				code: 'custom',
				message: 'Uncommitted First Ember cannot power a facility'
			});
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({
				code: 'custom',
				message: 'Active systems diverged from First Ember power'
			});
		}
	});

export const EngineGameStateV7Schema = z
	.object({
		...EngineGameStateV6Schema.shape,
		schemaVersion: z.literal(7),
		society: SocietyStateSchema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const last = state.settlement.resourceLedger
				.filter((entry) => entry.resource === resource)
				.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
		}
		if (
			(state.settlement.firstEmber.status === 'committed' &&
				state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId) ||
			(state.settlement.firstEmber.status !== 'committed' &&
				state.settlement.poweredBuildingId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember lifecycle diverged from power' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({
				code: 'custom',
				message: 'Active systems diverged from First Ember power'
			});
		}
		for (const observation of Object.values(state.society.observations)) {
			if (
				!state.heroes[observation.observerHeroId] ||
				observation.subjectIds.some(
					(subjectId) => subjectId !== state.master.masterId && !state.heroes[subjectId]
				)
			) {
				context.addIssue({ code: 'custom', message: 'Observation holder and subjects must exist' });
			}
		}
		for (const belief of Object.values(state.society.beliefs)) {
			const observation = state.society.observations[belief.provenance.observationId];
			if (
				!state.heroes[belief.holderHeroId] ||
				(belief.subjectId !== state.master.masterId && !state.heroes[belief.subjectId]) ||
				(belief.provenance.learnedFromId !== null &&
					belief.provenance.learnedFromId !== state.master.masterId &&
					!state.heroes[belief.provenance.learnedFromId]) ||
				(belief.object.kind === 'entity' &&
					belief.object.entityId !== state.master.masterId &&
					!state.heroes[belief.object.entityId]) ||
				(belief.object.kind === 'promise' && !state.society.promises[belief.object.promiseId]) ||
				!observation ||
				observation.observerHeroId !== belief.holderHeroId ||
				observation.sourceEventId !== belief.provenance.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Belief provenance must resolve to its holder observation'
				});
			}
		}
		const relationshipPairs = new Set<string>();
		for (const relationship of Object.values(state.society.relationships)) {
			const pair = `${relationship.fromHeroId}:${relationship.toEntityId}`;
			if (relationshipPairs.has(pair)) {
				context.addIssue({
					code: 'custom',
					message: 'Directed relationship endpoints must be unique'
				});
			}
			relationshipPairs.add(pair);
			if (
				!state.heroes[relationship.fromHeroId] ||
				(relationship.toEntityId !== state.master.masterId &&
					!state.heroes[relationship.toEntityId])
			) {
				context.addIssue({ code: 'custom', message: 'Relationship endpoints must exist' });
			}
			for (const evidence of relationship.evidence) {
				const observation = state.society.observations[evidence.observationId];
				if (
					!observation ||
					observation.observerHeroId !== relationship.fromHeroId ||
					observation.sourceEventId !== evidence.sourceEventId
				) {
					context.addIssue({
						code: 'custom',
						message: 'Relationship evidence requires an observation'
					});
				}
			}
		}
		const authorityPairs = new Set<string>();
		for (const authority of Object.values(state.society.authority)) {
			const pair = `${authority.observerHeroId}:${authority.subjectId}`;
			if (authorityPairs.has(pair)) {
				context.addIssue({
					code: 'custom',
					message: 'Authority observer and subject must be unique'
				});
			}
			authorityPairs.add(pair);
			if (
				!state.heroes[authority.observerHeroId] ||
				authority.subjectId !== state.master.masterId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Authority must be a hero view of the Master'
				});
			}
			for (const evidence of authority.evidence) {
				const observation = state.society.observations[evidence.observationId];
				if (
					!observation ||
					observation.observerHeroId !== authority.observerHeroId ||
					observation.sourceEventId !== evidence.sourceEventId
				) {
					context.addIssue({
						code: 'custom',
						message: 'Authority evidence requires an observation'
					});
				}
			}
		}
		for (const promise of Object.values(state.society.promises)) {
			if (
				promise.promisorId !== state.master.masterId ||
				promise.promiseeHeroIds.some((heroId) => !state.heroes[heroId]) ||
				promise.witnessObservationIds.some((observationId) => {
					const observation = state.society.observations[observationId];
					return (
						!observation ||
						observation.sourceEventId !== promise.sourceEventId ||
						!promise.promiseeHeroIds.includes(observation.observerHeroId)
					);
				})
			) {
				context.addIssue({
					code: 'custom',
					message: 'Promise participants and witnesses must exist'
				});
			}
		}
	});

const EngineGameStateV8BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(8),
		society: SocietyStateV2Schema
	})
	.strict();

const EngineGameStateV9BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(9),
		society: SocietyStateV3Schema
	})
	.strict();

const EngineGameStateV10BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(10),
		society: SocietyStateV4Schema
	})
	.strict();

const EngineGameStateV11BaseSchema = z
	.object({
		...EngineGameStateV10BaseSchema.shape,
		schemaVersion: z.literal(11),
		mission: MissionRunStateSchema
	})
	.strict();

const EngineGameStateV12BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(12),
		mission: MissionRunStateV2Schema
	})
	.strict();

const EngineGameStateV13BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(13),
		mission: MissionRunStateV3Schema
	})
	.strict();

const EngineGameStateV14BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(14),
		mission: MissionRunStateV4Schema
	})
	.strict();

const EngineGameStateV15BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(15),
		mission: MissionRunStateV5Schema
	})
	.strict();

const EngineGameStateV16BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(16),
		mission: MissionRunStateV6Schema
	})
	.strict();

const EngineGameStateV17BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(17),
		mission: MissionRunStateV7Schema
	})
	.strict();

const EngineGameStateV18BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(18),
		mission: MissionRunStateV8Schema
	})
	.strict();

const EngineGameStateV19BaseSchema = z
	.object({
		...EngineGameStateV18BaseSchema.shape,
		schemaVersion: z.literal(19),
		masterControl: MasterControlStateSchema
	})
	.strict();

const EngineGameStateV20BaseSchema = z
	.object({
		...EngineGameStateV18BaseSchema.shape,
		schemaVersion: z.literal(20),
		masterControl: MasterControlStateV2Schema
	})
	.strict();

const EngineGameStateV21BaseSchema = z
	.object({
		...EngineGameStateV20BaseSchema.shape,
		schemaVersion: z.literal(21),
		bandStory: RuntimeBandStoryStateSchema
	})
	.strict();

const EngineGameStateV22BaseSchema = z
	.object({
		...EngineGameStateV21BaseSchema.shape,
		schemaVersion: z.literal(22),
		society: SocietyStateV5Schema,
		synthesis: SynthesisStateSchema
	})
	.strict();

const EngineGameStateV23BaseSchema = z
	.object({
		...EngineGameStateV22BaseSchema.shape,
		schemaVersion: z.literal(23),
		firstBandArchive: FirstBandArchiveStateSchema
	})
	.strict();

const EngineGameStateV24BaseSchema = z
	.object({
		...EngineGameStateV23BaseSchema.shape,
		schemaVersion: z.literal(24),
		heroes: z.record(EntityIdSchema, EngineHeroStateV24Schema),
		settlement: EngineSettlementStateV24Schema,
		items: z.record(EntityIdSchema, EngineEquipmentItemStateV24Schema)
	})
	.strict();

const EngineGameStateV25BaseSchema = z
	.object({
		...EngineGameStateV24BaseSchema.shape,
		schemaVersion: z.literal(25),
		heroes: z.record(EntityIdSchema, EngineHeroStateV25Schema),
		mission: MissionRunStateV9Schema
	})
	.strict();

type CommunicationEngineValidationState =
	| z.infer<typeof EngineGameStateV8BaseSchema>
	| z.infer<typeof EngineGameStateV9BaseSchema>
	| z.infer<typeof EngineGameStateV10BaseSchema>
	| z.infer<typeof EngineGameStateV11BaseSchema>
	| z.infer<typeof EngineGameStateV12BaseSchema>
	| z.infer<typeof EngineGameStateV13BaseSchema>
	| z.infer<typeof EngineGameStateV14BaseSchema>
	| z.infer<typeof EngineGameStateV15BaseSchema>
	| z.infer<typeof EngineGameStateV16BaseSchema>
	| z.infer<typeof EngineGameStateV17BaseSchema>
	| z.infer<typeof EngineGameStateV18BaseSchema>
	| z.infer<typeof EngineGameStateV19BaseSchema>
	| z.infer<typeof EngineGameStateV20BaseSchema>
	| z.infer<typeof EngineGameStateV21BaseSchema>
	| z.infer<typeof EngineGameStateV22BaseSchema>
	| z.infer<typeof EngineGameStateV23BaseSchema>;

function validateCommunicationEngineState(
	state: CommunicationEngineValidationState,
	context: z.RefinementCtx
): void {
	if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
		context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
	}
	if (state.status === 'active' && state.master.lifeState !== 'alive') {
		context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
	}
	for (const hero of Object.values(state.heroes)) {
		const itemId = hero.equipment.mainHand;
		if (itemId) {
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		if (hero.assignment) {
			const building = state.settlement.buildings[hero.assignment.buildingId];
			if (
				!building ||
				building.assignmentNodeId !== hero.assignment.nodeId ||
				building.assignmentRole !== hero.assignment.role ||
				!building.assignedHeroIds.includes(hero.heroId)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Hero assignment diverged from building state'
				});
			}
		}
	}
	for (const item of Object.values(state.items)) {
		if (item.equippedById && state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId) {
			context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
		}
	}
	for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
		if (building.buildingId !== buildingId) {
			context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
		}
		for (const heroId of building.assignedHeroIds) {
			if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
				context.addIssue({
					code: 'custom',
					message: 'Building roster diverged from hero assignment'
				});
			}
		}
		if (building.powerState !== 'powered' && building.powerState !== building.baselinePowerState) {
			context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
		}
	}
	for (const resource of ResourceKeySchema.options) {
		const last = state.settlement.resourceLedger
			.filter((entry) => entry.resource === resource)
			.at(-1);
		if (last && last.after !== state.settlement.resources[resource]) {
			context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
		}
	}
	const powered = Object.values(state.settlement.buildings).filter(
		(building) => building.powerState === 'powered'
	);
	if (
		powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
		(state.settlement.poweredBuildingId !== null &&
			powered[0]?.buildingId !== state.settlement.poweredBuildingId)
	) {
		context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
	}
	if (
		(state.settlement.firstEmber.status === 'committed' &&
			state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId) ||
		(state.settlement.firstEmber.status !== 'committed' &&
			state.settlement.poweredBuildingId !== null)
	) {
		context.addIssue({ code: 'custom', message: 'First Ember lifecycle diverged from power' });
	}
	const activeSystemIds = Object.values(state.settlement.buildings)
		.filter((building) => building.powerState !== 'unpowered')
		.map((building) => building.systemId)
		.sort((left, right) => left.localeCompare(right));
	if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
		context.addIssue({
			code: 'custom',
			message: 'Active systems diverged from First Ember power'
		});
	}
	for (const observation of Object.values(state.society.observations)) {
		if (
			!state.heroes[observation.observerHeroId] ||
			observation.subjectIds.some(
				(subjectId) => subjectId !== state.master.masterId && !state.heroes[subjectId]
			)
		) {
			context.addIssue({ code: 'custom', message: 'Observation holder and subjects must exist' });
		}
	}
	for (const belief of Object.values(state.society.beliefs)) {
		const observation = state.society.observations[belief.provenance.observationId];
		if (
			!state.heroes[belief.holderHeroId] ||
			(belief.subjectId !== state.master.masterId && !state.heroes[belief.subjectId]) ||
			(belief.provenance.learnedFromId !== null &&
				belief.provenance.learnedFromId !== state.master.masterId &&
				!state.heroes[belief.provenance.learnedFromId]) ||
			(belief.object.kind === 'entity' &&
				belief.object.entityId !== state.master.masterId &&
				!state.heroes[belief.object.entityId]) ||
			(belief.object.kind === 'promise' && !state.society.promises[belief.object.promiseId]) ||
			!observation ||
			observation.observerHeroId !== belief.holderHeroId ||
			observation.sourceEventId !== belief.provenance.sourceEventId
		) {
			context.addIssue({
				code: 'custom',
				message: 'Belief provenance must resolve to its holder observation'
			});
		}
	}
	const relationshipPairs = new Set<string>();
	for (const relationship of Object.values(state.society.relationships)) {
		const pair = `${relationship.fromHeroId}:${relationship.toEntityId}`;
		if (relationshipPairs.has(pair)) {
			context.addIssue({
				code: 'custom',
				message: 'Directed relationship endpoints must be unique'
			});
		}
		relationshipPairs.add(pair);
		if (
			!state.heroes[relationship.fromHeroId] ||
			(relationship.toEntityId !== state.master.masterId && !state.heroes[relationship.toEntityId])
		) {
			context.addIssue({ code: 'custom', message: 'Relationship endpoints must exist' });
		}
		for (const evidence of relationship.evidence) {
			const observation = state.society.observations[evidence.observationId];
			if (
				!observation ||
				observation.observerHeroId !== relationship.fromHeroId ||
				observation.sourceEventId !== evidence.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Relationship evidence requires an observation'
				});
			}
		}
	}
	const authorityPairs = new Set<string>();
	for (const authority of Object.values(state.society.authority)) {
		const pair = `${authority.observerHeroId}:${authority.subjectId}`;
		if (authorityPairs.has(pair)) {
			context.addIssue({
				code: 'custom',
				message: 'Authority observer and subject must be unique'
			});
		}
		authorityPairs.add(pair);
		if (!state.heroes[authority.observerHeroId] || authority.subjectId !== state.master.masterId) {
			context.addIssue({
				code: 'custom',
				message: 'Authority must be a hero view of the Master'
			});
		}
		for (const evidence of authority.evidence) {
			const observation = state.society.observations[evidence.observationId];
			if (
				!observation ||
				observation.observerHeroId !== authority.observerHeroId ||
				observation.sourceEventId !== evidence.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Authority evidence requires an observation'
				});
			}
		}
	}
	for (const promise of Object.values(state.society.promises)) {
		if (
			promise.promisorId !== state.master.masterId ||
			promise.promiseeHeroIds.some((heroId) => !state.heroes[heroId]) ||
			promise.witnessObservationIds.some((observationId) => {
				const observation = state.society.observations[observationId];
				return (
					!observation ||
					observation.sourceEventId !== promise.sourceEventId ||
					!promise.promiseeHeroIds.includes(observation.observerHeroId)
				);
			})
		) {
			context.addIssue({
				code: 'custom',
				message: 'Promise participants and witnesses must exist'
			});
		}
	}
	const communicationSourceEvents = new Set<string>();
	for (const act of Object.values(state.society.communicativeActs)) {
		if (communicationSourceEvents.has(act.sourceEventId)) {
			context.addIssue({
				code: 'custom',
				message: 'One event cannot own multiple communicative acts'
			});
		}
		communicationSourceEvents.add(act.sourceEventId);
		if (
			(act.speakerId !== state.master.masterId && !state.heroes[act.speakerId]) ||
			act.intendedAudienceIds.some((heroId) => !state.heroes[heroId])
		) {
			context.addIssue({ code: 'custom', message: 'Communication participants must exist' });
		}
		for (const witness of act.witnesses) {
			const observation = state.society.observations[witness.observationId];
			const belief = witness.beliefId ? (state.society.beliefs[witness.beliefId] ?? null) : null;
			if (
				!state.heroes[witness.heroId] ||
				!observation ||
				observation.kind !== 'communication' ||
				observation.communicationActId !== act.actId ||
				observation.observerHeroId !== witness.heroId ||
				observation.sourceEventId !== act.sourceEventId ||
				(act.claim === null) !== (belief === null) ||
				(belief !== null &&
					(belief.holderHeroId !== witness.heroId ||
						belief.subjectId !== act.claim?.subjectId ||
						belief.predicate !== act.claim?.predicate ||
						JSON.stringify(belief.object) !== JSON.stringify(act.claim.object) ||
						belief.provenance.kind !== 'told' ||
						belief.provenance.sourceEventId !== act.sourceEventId ||
						belief.provenance.observationId !== witness.observationId ||
						belief.provenance.learnedFromId !== act.speakerId ||
						belief.provenance.chainDepth !== 1))
			) {
				context.addIssue({
					code: 'custom',
					message: 'Communication witness chain is inconsistent'
				});
			}
		}
	}
	for (const observation of Object.values(state.society.observations)) {
		if (observation.kind !== 'communication') continue;
		const act = state.society.communicativeActs[observation.communicationActId];
		if (!act?.witnesses.some((witness) => witness.observationId === observation.observationId)) {
			context.addIssue({
				code: 'custom',
				message: 'Communication observation must resolve to its act'
			});
		}
	}
	for (const belief of Object.values(state.society.beliefs)) {
		if (belief.provenance.kind !== 'told') continue;
		const observation = state.society.observations[belief.provenance.observationId];
		if (observation?.kind === 'synthesis-rumor') continue;
		const act =
			observation?.kind === 'communication'
				? state.society.communicativeActs[observation.communicationActId]
				: null;
		if (!act?.witnesses.some((witness) => witness.beliefId === belief.beliefId)) {
			context.addIssue({
				code: 'custom',
				message: 'Told belief must resolve to one communication witness'
			});
		}
	}
}

export const EngineGameStateV8Schema = EngineGameStateV8BaseSchema.superRefine(
	validateCommunicationEngineState
);

export const EngineGameStateV9Schema = EngineGameStateV9BaseSchema.superRefine((state, context) => {
	validateCommunicationEngineState(state, context);
	for (const turn of Object.values(state.society.conversationTurns)) {
		const act = state.society.communicativeActs[turn.communicationActId];
		if (
			turn.masterId !== state.master.masterId ||
			!state.heroes[turn.heroId] ||
			!act?.witnesses.some(
				(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Conversation turn participants and addressed witness must exist'
			});
		}
	}
});

export const EngineGameStateV10Schema = EngineGameStateV10BaseSchema.superRefine(
	(state, context) => {
		validateCommunicationEngineState(state, context);
		for (const turn of Object.values(state.society.conversationTurns)) {
			const act = state.society.communicativeActs[turn.communicationActId];
			if (
				turn.masterId !== state.master.masterId ||
				!state.heroes[turn.heroId] ||
				!act?.witnesses.some(
					(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
				)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Conversation turn participants and addressed witness must exist'
				});
			}
		}
		for (const directive of Object.values(state.society.directives)) {
			const witnessObservers = directive.witnessObservationIds.map(
				(observationId) => state.society.observations[observationId]?.observerHeroId
			);
			if (
				directive.runId !== state.runId ||
				directive.authorId !== state.master.masterId ||
				directive.witnessEventId === null ||
				directive.recipientIds.some(
					(heroId) => !state.heroes[heroId] || !witnessObservers.includes(heroId)
				) ||
				directive.witnessObservationIds.some((observationId) => {
					const observation = state.society.observations[observationId];
					return !observation || observation.sourceEventId !== directive.witnessEventId;
				}) ||
				(directive.status === 'active' &&
					directive.expiresAt !== null &&
					Date.parse(directive.expiresAt) <= Date.parse(state.simulatedAt))
			) {
				context.addIssue({ code: 'custom', message: 'Directive lifecycle is inconsistent' });
			}
		}
		for (const influence of Object.values(state.society.directiveInfluences)) {
			if (!state.heroes[influence.heroId]) {
				context.addIssue({ code: 'custom', message: 'Directive influence hero must exist' });
			}
		}
	}
);

type MissionEngineValidationState =
	| z.infer<typeof EngineGameStateV11BaseSchema>
	| z.infer<typeof EngineGameStateV12BaseSchema>
	| z.infer<typeof EngineGameStateV13BaseSchema>
	| z.infer<typeof EngineGameStateV14BaseSchema>
	| z.infer<typeof EngineGameStateV15BaseSchema>
	| z.infer<typeof EngineGameStateV16BaseSchema>
	| z.infer<typeof EngineGameStateV17BaseSchema>
	| z.infer<typeof EngineGameStateV18BaseSchema>
	| z.infer<typeof EngineGameStateV19BaseSchema>
	| z.infer<typeof EngineGameStateV20BaseSchema>
	| z.infer<typeof EngineGameStateV21BaseSchema>
	| z.infer<typeof EngineGameStateV22BaseSchema>
	| z.infer<typeof EngineGameStateV23BaseSchema>;

function validateMissionEngineState(
	state: MissionEngineValidationState,
	context: z.RefinementCtx
): void {
	validateCommunicationEngineState(state, context);
	for (const turn of Object.values(state.society.conversationTurns)) {
		const act = state.society.communicativeActs[turn.communicationActId];
		if (
			turn.masterId !== state.master.masterId ||
			!state.heroes[turn.heroId] ||
			!act?.witnesses.some(
				(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Conversation turn participants and addressed witness must exist'
			});
		}
	}
	for (const directive of Object.values(state.society.directives)) {
		const witnessObservers = directive.witnessObservationIds.map(
			(observationId) => state.society.observations[observationId]?.observerHeroId
		);
		if (
			directive.runId !== state.runId ||
			directive.authorId !== state.master.masterId ||
			directive.witnessEventId === null ||
			directive.recipientIds.some(
				(heroId) => !state.heroes[heroId] || !witnessObservers.includes(heroId)
			) ||
			directive.witnessObservationIds.some((observationId) => {
				const observation = state.society.observations[observationId];
				return !observation || observation.sourceEventId !== directive.witnessEventId;
			}) ||
			(directive.status === 'active' &&
				directive.expiresAt !== null &&
				Date.parse(directive.expiresAt) <= Date.parse(state.simulatedAt))
		) {
			context.addIssue({ code: 'custom', message: 'Directive lifecycle is inconsistent' });
		}
	}
	for (const influence of Object.values(state.society.directiveInfluences)) {
		if (!state.heroes[influence.heroId]) {
			context.addIssue({ code: 'custom', message: 'Directive influence hero must exist' });
		}
	}
	const attempt = state.mission.attempt;
	if (!attempt) return;
	if (
		attempt.party.masterId !== state.master.masterId ||
		attempt.party.heroIds.some((heroId) => !state.heroes[heroId])
	) {
		context.addIssue({ code: 'custom', message: 'Mission party members must exist in the run' });
	}
	if (
		['preparing', 'deployed', 'resolving', 'extraction'].includes(attempt.status) &&
		attempt.party.heroIds.some((heroId) => state.heroes[heroId]?.lifeState !== 'active')
	) {
		context.addIssue({
			code: 'custom',
			message: 'An active mission party requires living heroes'
		});
	}
	if (
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
	) {
		const turnAttempt = state.mission.attempt;
		if (
			turnAttempt?.turnState.objective.carrierId !== null &&
			turnAttempt?.turnState.objective.carrierId !== undefined &&
			!turnAttempt.party.memberIds.includes(turnAttempt.turnState.objective.carrierId)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective carrier must be in the party'
			});
		}
	}
	if (
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
	) {
		for (const evidence of Object.values(state.mission.evidence)) {
			if (
				evidence.holderActorId !== state.master.masterId &&
				!state.heroes[evidence.holderActorId]
			) {
				context.addIssue({ code: 'custom', message: 'Mission evidence holder must exist' });
			}
		}
	}
}

export const EngineGameStateV11Schema = EngineGameStateV11BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV12Schema = EngineGameStateV12BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV13Schema = EngineGameStateV13BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV14Schema = EngineGameStateV14BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV15Schema = EngineGameStateV15BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV16Schema = EngineGameStateV16BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV17Schema = EngineGameStateV17BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV18Schema = EngineGameStateV18BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV19Schema = EngineGameStateV19BaseSchema.superRefine(
	(state, context) => {
		validateMissionEngineState(state, context);
		const activeAttempt = state.mission.attempt;
		const canAwaitDecision =
			state.status === 'active' &&
			state.master.lifeState === 'alive' &&
			activeAttempt !== null &&
			['deployed', 'resolving'].includes(activeAttempt.status);
		if (state.masterControl.activeDecision !== null && !canAwaitDecision) {
			context.addIssue({
				code: 'custom',
				message: 'Only an active resolving mission may hold a Master decision window'
			});
		}
	}
);
export const EngineGameStateV20Schema = EngineGameStateV20BaseSchema.superRefine(
	(state, context) => {
		validateMissionEngineState(state, context);
		const activeAttempt = state.mission.attempt;
		const canAwaitDecision =
			state.status === 'active' &&
			state.master.lifeState === 'alive' &&
			activeAttempt !== null &&
			['deployed', 'resolving'].includes(activeAttempt.status);
		if (state.masterControl.activeDecision !== null && !canAwaitDecision) {
			context.addIssue({
				code: 'custom',
				message: 'Only an active resolving mission may hold a Master decision window'
			});
		}
		if (
			state.masterControl.fallback.protectedHeroId !== null &&
			!state.heroes[state.masterControl.fallback.protectedHeroId]
		) {
			context.addIssue({ code: 'custom', message: 'Protected fallback hero must exist' });
		}
	}
);
export const EngineGameStateV21Schema = EngineGameStateV21BaseSchema.superRefine(
	(state, context) => {
		validateMissionEngineState(state, context);
		const activeAttempt = state.mission.attempt;
		const canAwaitDecision =
			state.status === 'active' &&
			state.master.lifeState === 'alive' &&
			activeAttempt !== null &&
			['deployed', 'resolving'].includes(activeAttempt.status);
		if (state.masterControl.activeDecision !== null && !canAwaitDecision) {
			context.addIssue({
				code: 'custom',
				message: 'Only an active resolving mission may hold a Master decision window'
			});
		}
		if (
			state.masterControl.fallback.protectedHeroId !== null &&
			!state.heroes[state.masterControl.fallback.protectedHeroId]
		) {
			context.addIssue({ code: 'custom', message: 'Protected fallback hero must exist' });
		}
		for (const patch of state.bandStory.appliedPatches) {
			if (
				patch.candidate.roleBindings.some((binding) => !state.heroes[binding.heroId]) ||
				patch.appliedAt > state.simulatedAt
			) {
				context.addIssue({
					code: 'custom',
					message: 'Applied story patch cast and time must exist in the run'
				});
			}
		}
	}
);
export const EngineGameStateV22Schema = EngineGameStateV22BaseSchema.superRefine(
	(state, context) => {
		validateMissionEngineState(state, context);
		const activeAttempt = state.mission.attempt;
		const canAwaitDecision =
			state.status === 'active' &&
			state.master.lifeState === 'alive' &&
			activeAttempt !== null &&
			['deployed', 'resolving'].includes(activeAttempt.status);
		if (state.masterControl.activeDecision !== null && !canAwaitDecision) {
			context.addIssue({
				code: 'custom',
				message: 'Only an active resolving mission may hold a Master decision window'
			});
		}
		for (const patch of state.bandStory.appliedPatches) {
			if (
				patch.candidate.roleBindings.some((binding) => !state.heroes[binding.heroId]) ||
				patch.appliedAt > state.simulatedAt
			) {
				context.addIssue({
					code: 'custom',
					message: 'Applied story patch cast and time must exist in the run'
				});
			}
		}
		for (const receipt of Object.values(state.synthesis.receipts)) {
			const source = state.heroes[receipt.sourceHeroId];
			const recipient = state.heroes[receipt.recipientHeroId];
			if (
				receipt.masterId !== state.master.masterId ||
				!source ||
				source.lifeState !== 'synthesized' ||
				source.assignment !== null ||
				source.currentActivity !== null ||
				source.currentTravel !== null ||
				source.currentRoutine !== null ||
				!recipient ||
				receipt.committedAt > state.simulatedAt
			) {
				context.addIssue({
					code: 'custom',
					message: 'Synthesis receipt diverged from roster state'
				});
			}
			for (const consequence of receipt.socialConsequences) {
				const observation = state.society.observations[consequence.observationId];
				const belief = state.society.beliefs[consequence.beliefId];
				const relationship = state.society.relationships[consequence.relationshipId];
				if (
					!observation ||
					!('synthesisReceiptId' in observation) ||
					observation.synthesisReceiptId !== receipt.receiptId ||
					observation.observerHeroId !== consequence.heroId ||
					!belief ||
					belief.holderHeroId !== consequence.heroId ||
					belief.provenance.observationId !== consequence.observationId ||
					!relationship ||
					relationship.fromHeroId !== consequence.heroId ||
					relationship.toEntityId !== state.master.masterId
				) {
					context.addIssue({
						code: 'custom',
						message: 'Synthesis social consequence is inconsistent'
					});
				}
			}
		}
		for (const rumor of Object.values(state.synthesis.rumors)) {
			const observation = state.society.observations[rumor.observationId];
			const belief = state.society.beliefs[rumor.beliefId];
			if (
				!state.heroes[rumor.speakerHeroId] ||
				!state.heroes[rumor.listenerHeroId] ||
				!observation ||
				observation.kind !== 'synthesis-rumor' ||
				observation.synthesisReceiptId !== rumor.receiptId ||
				!belief ||
				belief.provenance.kind !== 'told' ||
				belief.provenance.learnedFromId !== rumor.speakerHeroId ||
				belief.provenance.observationId !== rumor.observationId
			) {
				context.addIssue({ code: 'custom', message: 'Synthesis rumor chain is inconsistent' });
			}
		}
	}
);

function validateFirstBandArchiveEngineState(
	state: z.infer<typeof EngineGameStateV23BaseSchema>,
	context: z.RefinementCtx
): void {
	validateMissionEngineState(state, context);
	const activeAttempt = state.mission.attempt;
	const canAwaitDecision =
		state.status === 'active' &&
		state.master.lifeState === 'alive' &&
		activeAttempt !== null &&
		['deployed', 'resolving'].includes(activeAttempt.status);
	if (state.masterControl.activeDecision !== null && !canAwaitDecision) {
		context.addIssue({
			code: 'custom',
			message: 'Only an active resolving mission may hold a Master decision window'
		});
	}
	for (const patch of state.bandStory.appliedPatches) {
		if (
			patch.candidate.roleBindings.some((binding) => !state.heroes[binding.heroId]) ||
			patch.appliedAt > state.simulatedAt
		) {
			context.addIssue({
				code: 'custom',
				message: 'Applied story patch cast and time must exist in the run'
			});
		}
	}
	for (const receipt of Object.values(state.synthesis.receipts)) {
		const source = state.heroes[receipt.sourceHeroId];
		const recipient = state.heroes[receipt.recipientHeroId];
		if (
			receipt.masterId !== state.master.masterId ||
			!source ||
			source.lifeState !== 'synthesized' ||
			!recipient ||
			receipt.committedAt > state.simulatedAt
		) {
			context.addIssue({
				code: 'custom',
				message: 'Synthesis receipt diverged from roster state'
			});
		}
	}
	const recovery = state.firstBandArchive.recovery;
	const reveal = state.firstBandArchive.reveal;
	if (
		state.firstBandArchive.envelopeId !== state.bandStory.envelopeId ||
		state.firstBandArchive.envelopeContentHash !== state.bandStory.envelopeContentHash ||
		(recovery !== null &&
			(recovery.recoveredAt > state.simulatedAt ||
				recovery.survivingHeroIds.some((heroId) => !state.heroes[heroId]))) ||
		(reveal !== null &&
			(reveal.revealedAt > state.simulatedAt ||
				!state.heroes[reveal.readerHeroId] ||
				reveal.knowledge.some((record) => !state.heroes[record.heroId])))
	) {
		context.addIssue({ code: 'custom', message: 'First-band archive diverged from run state' });
	}
}

export const EngineGameStateV23Schema = EngineGameStateV23BaseSchema.superRefine(
	validateFirstBandArchiveEngineState
);

export const EngineGameStateV24Schema = EngineGameStateV24BaseSchema.superRefine(
	(state, context) => {
		const mainHandItemIds = new Set(
			Object.values(state.heroes)
				.map((hero) => hero.equipment.mainHand)
				.filter((itemId): itemId is string => itemId !== null)
		);
		validateFirstBandArchiveEngineState(
			{
				...state,
				heroes: Object.fromEntries(
					Object.entries(state.heroes).map(([heroId, hero]) => [
						heroId,
						{ ...hero, equipment: { mainHand: hero.equipment.mainHand } }
					])
				),
				items: Object.fromEntries(
					Object.entries(state.items).map(([itemId, item]) => [
						itemId,
						{ ...item, equippedById: mainHandItemIds.has(itemId) ? item.equippedById : null }
					])
				)
			} as unknown as z.infer<typeof EngineGameStateV23BaseSchema>,
			context
		);
		const equippedItemIds = new Set<string>();
		for (const hero of Object.values(state.heroes)) {
			for (const itemId of Object.values(hero.equipment)) {
				if (itemId === null) continue;
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned v24 item'
					});
				}
				equippedItemIds.add(itemId);
			}
		}
		for (const item of Object.values(state.items)) {
			if (item.equippedById !== null && !equippedItemIds.has(item.itemId)) {
				context.addIssue({
					code: 'custom',
					message: 'Equipped v24 item must be linked by its hero loadout'
				});
			}
		}
	}
);

export const EngineGameStateV25Schema = EngineGameStateV25BaseSchema.superRefine(
	(state, context) => {
		const mainHandItemIds = new Set(
			Object.values(state.heroes)
				.map((hero) => hero.equipment.mainHand)
				.filter((itemId): itemId is string => itemId !== null)
		);
		validateFirstBandArchiveEngineState(
			{
				...state,
				mission: {
					...state.mission,
					aftermath: {
						aftermathVersion: 'mission-aftermath-v3',
						activeAttemptId: state.mission.aftermath.activeAttemptId,
						consequences: state.mission.aftermath.consequences,
						archives: state.mission.aftermath.archives.map((archive) => ({
							attemptId: archive.attemptId,
							ordinal: archive.ordinal,
							binding: archive.binding,
							outcome: archive.outcome,
							preparedAt: archive.preparedAt,
							deployedAt: archive.deployedAt,
							endedAt: archive.endedAt,
							finalRoundNumber: archive.finalRoundNumber,
							consequences: archive.consequences
						}))
					},
					attempt: state.mission.attempt
						? Object.fromEntries(
								Object.entries(state.mission.attempt).filter(([key]) => key !== 'combatModeBinding')
							)
						: null
				},
				heroes: Object.fromEntries(
					Object.entries(state.heroes).map(([heroId, hero]) => [
						heroId,
						{ ...hero, equipment: { mainHand: hero.equipment.mainHand } }
					])
				),
				items: Object.fromEntries(
					Object.entries(state.items).map(([itemId, item]) => [
						itemId,
						{ ...item, equippedById: mainHandItemIds.has(itemId) ? item.equippedById : null }
					])
				)
			} as unknown as z.infer<typeof EngineGameStateV23BaseSchema>,
			context
		);
		const equippedItemIds = new Set<string>();
		for (const hero of Object.values(state.heroes)) {
			for (const itemId of Object.values(hero.equipment)) {
				if (itemId === null) continue;
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned v25 item'
					});
				}
				equippedItemIds.add(itemId);
			}
		}
		for (const item of Object.values(state.items)) {
			if (item.equippedById !== null && !equippedItemIds.has(item.itemId)) {
				context.addIssue({
					code: 'custom',
					message: 'Equipped v25 item must be linked by its hero loadout'
				});
			}
		}
	}
);

export const EngineGameStateSchema = z.discriminatedUnion('schemaVersion', [
	EngineGameStateV1Schema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema
]);

export type EngineGameState = z.infer<typeof EngineGameStateSchema>;
export type EngineGameStateV1 = z.infer<typeof EngineGameStateV1Schema>;
export type EngineGameStateV2 = z.infer<typeof EngineGameStateV2Schema>;
export type EngineGameStateV3 = z.infer<typeof EngineGameStateV3Schema>;
export type EngineGameStateV4 = z.infer<typeof EngineGameStateV4Schema>;
export type EngineGameStateV5 = z.infer<typeof EngineGameStateV5Schema>;
export type EngineGameStateV6 = z.infer<typeof EngineGameStateV6Schema>;
export type EngineGameStateV7 = z.infer<typeof EngineGameStateV7Schema>;
export type EngineGameStateV8 = z.infer<typeof EngineGameStateV8Schema>;
export type EngineGameStateV9 = z.infer<typeof EngineGameStateV9Schema>;
export type EngineGameStateV10 = z.infer<typeof EngineGameStateV10Schema>;
export type EngineGameStateV11 = z.infer<typeof EngineGameStateV11Schema>;
export type EngineGameStateV12 = z.infer<typeof EngineGameStateV12Schema>;
export type EngineGameStateV13 = z.infer<typeof EngineGameStateV13Schema>;
export type EngineGameStateV14 = z.infer<typeof EngineGameStateV14Schema>;
export type EngineGameStateV15 = z.infer<typeof EngineGameStateV15Schema>;
export type EngineGameStateV16 = z.infer<typeof EngineGameStateV16Schema>;
export type EngineGameStateV17 = z.infer<typeof EngineGameStateV17Schema>;
export type EngineGameStateV18 = z.infer<typeof EngineGameStateV18Schema>;
export type EngineGameStateV19 = z.infer<typeof EngineGameStateV19Schema>;
export type EngineGameStateV20 = z.infer<typeof EngineGameStateV20Schema>;
export type EngineGameStateV21 = z.infer<typeof EngineGameStateV21Schema>;
export type EngineGameStateV22 = z.infer<typeof EngineGameStateV22Schema>;
export type EngineGameStateV23 = z.infer<typeof EngineGameStateV23Schema>;
export type EngineGameStateV24 = z.infer<typeof EngineGameStateV24Schema>;
export type EngineGameStateV25 = z.infer<typeof EngineGameStateV25Schema>;
