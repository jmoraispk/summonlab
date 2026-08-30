import { z } from 'zod';

import { LegalActionSchema } from './character.js';
import {
	ActivityKindSchema,
	EngineHeroStateV1Schema,
	EngineHeroStateV2Schema,
	EngineItemStateSchema,
	EngineMasterStateV1Schema,
	EngineMasterStateV2Schema,
	EngineStoryStateSchema,
	HeroProgressionSchema,
	ResourceKeySchema
} from './engine/base-state.js';
import {
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterFallbackPrioritySchema,
	MasterFallbackSafetyStopsSchema
} from './engine/master-control.js';
import {
	MissionContentBindingSchema,
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionTurnChoiceSchema
} from './engine/mission-state.js';
import {
	BuildingAssignmentRoleSchema,
	EngineHeroStateV3Schema,
	EngineHeroStateV4Schema,
	EngineHeroStateV5Schema,
	EngineSettlementStateSchema,
	EngineSettlementStateV3Schema,
	EngineSettlementStateV4Schema,
	EngineSettlementStateV6Schema,
	FirstEmberFacilitySchema,
	FirstEmberRationaleSchema,
	SettlementNodeIdSchema
} from './engine/settlement-state.js';
import {
	ActionSourceSchema,
	AuthoritativeEventSchema,
	DecisionTimingSchema,
	DirectiveScopeSchema,
	FallbackPolicySchema,
	JournalEntrySchema,
	PlayerJournalReportSchema,
	RewardDeltaSchema
} from './event.js';
import { RunStatusSchema } from './run.js';
import {
	MissionSlugSchema,
	RuntimeBandStoryStateSchema,
	StoryExpressionResolutionSchema,
	StoryPatchCandidateSchema
} from './mission.js';
import { SettlementSlugSchema } from './settlement.js';
import {
	ConversationActKindSchema,
	ConversationOrderIntentSchema,
	CommunicationDeliverySchema,
	CommunicationToneSchema,
	CommunicationTopicSchema,
	OnboardingCommunicativeActKindSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema,
	SocietyStateV5Schema,
	RelationshipDimensionsSchema
} from './social.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

export {
	ActivityKindSchema,
	CurrentActivitySchema,
	EngineHeroStateV1Schema,
	EngineHeroStateV2Schema,
	EngineItemStateSchema,
	EngineLocationSchema,
	EngineLocationV1Schema,
	EngineMasterStateV1Schema,
	EngineMasterStateV2Schema,
	EngineStoryStateSchema,
	EngineZoneSchema,
	EquipmentSlotSchema,
	HeroLifeStateSchema,
	HeroProgressionSchema,
	InjuryKindSchema,
	InjurySchema,
	MasterLifeStateSchema,
	NeedStateSchema,
	ResourceBalancesSchema,
	ResourceKeySchema,
	ResourceLedgerEntrySchema,
	SkillProgressSchema
} from './engine/base-state.js';
export type { ActivityKind, EngineItemState } from './engine/base-state.js';
export {
	BuildingAssignmentRoleSchema,
	BuildingPowerStateSchema,
	CurrentRoutineSchema,
	CurrentTravelSchema,
	DailyPlanEntrySchema,
	DailyPlanSchema,
	EngineBuildingStateSchema,
	EngineHeroStateV3Schema,
	EngineHeroStateV4Schema,
	EngineHeroStateV5Schema,
	EngineSettlementStateSchema,
	EngineSettlementStateV3Schema,
	EngineSettlementStateV4Schema,
	EngineSettlementStateV6Schema,
	FirstEmberFacilitySchema,
	FirstEmberHeroReactionSchema,
	FirstEmberModifierKeySchema,
	FirstEmberModifierSchema,
	FirstEmberRationaleSchema,
	FirstEmberReactionStanceSchema,
	FirstEmberStateSchema,
	HabitStateSchema,
	HeroBuildingAssignmentSchema,
	RoutineCandidateScoreSchema,
	RoutineKindSchema,
	RoutineResolutionSchema,
	SettlementNavigationStateSchema
} from './engine/settlement-state.js';
export type {
	BuildingAssignmentRole,
	FirstEmberFacility,
	FirstEmberRationale,
	FirstEmberState,
	RoutineKind
} from './engine/settlement-state.js';
export {
	MasterDecisionExpiryOutcomeSchema,
	MasterDecisionWindowSchema,
	MasterDecisionResolutionSchema,
	MasterControlStateSchema,
	MasterFallbackPrioritySchema,
	MasterFallbackSafetyStopsSchema,
	MasterFallbackConfigurationSchema,
	MasterSafetyStopReasonSchema,
	MasterFallbackSelectionSchema,
	MasterDecisionWindowV2Schema,
	MasterDecisionResolutionV2Schema,
	MasterControlStateV2Schema
} from './engine/master-control.js';
export type {
	MasterControlState,
	MasterControlStateV2,
	MasterDecisionResolution,
	MasterDecisionResolutionV2,
	MasterDecisionWindow,
	MasterFallbackConfiguration,
	MasterFallbackSelection,
	MasterFallbackPriority,
	MasterFallbackSafetyStops
} from './engine/master-control.js';
export {
	MissionAttemptStatusSchema,
	MissionAttemptOutcomeSchema,
	MissionContentBindingSchema,
	MissionPartySchema,
	MissionAttemptSchema,
	MissionRunStateSchema,
	MissionChoiceSourceSchema,
	MissionObjectiveProgressSchema,
	MissionTurnChoiceSchema,
	MissionResolvedActionSchema,
	MissionRoundSchema,
	MissionTurnStateSchema,
	MissionAttemptV2Schema,
	MissionRunStateV2Schema,
	MissionMonsterPolicyBindingSchema,
	MissionMonsterStateSchema,
	MissionPartyGuardStateSchema,
	MissionFurnaceStateSchema,
	MissionCombatArenaStateSchema,
	MissionMonsterIntentSchema,
	MissionResolvedEffectSchema,
	MissionResolvedPartyActionV2Schema,
	MissionResolvedMonsterActionSchema,
	MissionRoundV2Schema,
	MissionTurnStateV2Schema,
	MissionAttemptV3Schema,
	MissionRunStateV3Schema,
	MissionEvidenceRecordSchema,
	MissionRunStateV4Schema,
	PortalPressureStageSchema,
	PortalDepositStateSchema,
	PortalCargoStateSchema,
	PortalOreLedgerEntrySchema,
	PortalMissionObjectiveProgressSchema,
	PortalRoundWindowSchema,
	MissionRoundV3Schema,
	PortalMissionStateSchema,
	MissionTurnStateV3Schema,
	MissionAttemptV4Schema,
	MissionRunStateV5Schema,
	MissionItemWearSchema,
	MissionHarmWitnessSchema,
	MissionHarmRecordSchema,
	MissionMasterHarmRecordSchema,
	MissionConsequenceRecordV2Schema,
	MissionHarmRecordV2Schema,
	MissionMasterHarmRecordV2Schema,
	MissionConsequenceRecordV3Schema,
	MissionAftermathStateSchema,
	MissionRunStateV6Schema,
	MissionAftermathStateV2Schema,
	MissionRunStateV7Schema,
	MissionAttemptAftermathArchiveSchema,
	MissionAftermathStateV3Schema,
	MissionRunStateV8Schema
} from './engine/mission-state.js';
export type {
	MissionAttempt,
	MissionAttemptStatus,
	MissionRound,
	MissionRoundV2,
	MissionMonsterIntent,
	MissionMonsterState,
	MissionResolvedEffect,
	MissionTurnChoice,
	MissionRunState,
	MissionRunStateV2,
	MissionRunStateV3,
	MissionRunStateV4,
	MissionRunStateV5,
	MissionRunStateV6,
	MissionRunStateV7,
	MissionRunStateV8,
	MissionHarmRecord,
	MissionHarmRecordV2,
	MissionMasterHarmRecord,
	MissionMasterHarmRecordV2,
	MissionConsequenceRecordV2,
	MissionConsequenceRecordV3,
	MissionEvidenceRecord,
	MissionRoundV3,
	PortalMissionState,
	PortalOreLedgerEntry
} from './engine/mission-state.js';


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

export const SynthesisVisibilitySchema = z.enum(['private', 'open']);
export const SynthesisKnowledgeSchema = z.enum(['participant', 'witness', 'absence']);

export const SynthesisSocialConsequenceSchema = z
	.object({
		heroId: EntityIdSchema,
		knowledge: SynthesisKnowledgeSchema,
		observationId: EntityIdSchema,
		beliefId: EntityIdSchema,
		relationshipId: EntityIdSchema,
		confidence: z.number().int().min(0).max(100),
		relationshipDeltas: RelationshipDimensionsSchema
	})
	.strict();

export const SynthesisReceiptSchema = z
	.object({
		receiptVersion: z.literal('synthesis-receipt-v1'),
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		masterId: EntityIdSchema,
		sourceHeroId: EntityIdSchema,
		recipientHeroId: EntityIdSchema,
		visibility: SynthesisVisibilitySchema,
		warningVersion: z.literal('synthesis-warning-v1'),
		confirmedIrreversible: z.literal(true),
		rationale: z.string().min(1).max(240),
		committedAt: IsoDateTimeSchema,
		essenceExperience: z.number().int().positive().max(10_000),
		sourceProgression: HeroProgressionSchema,
		recipientProgressionBefore: HeroProgressionSchema,
		recipientProgressionAfter: HeroProgressionSchema,
		socialConsequences: z.array(SynthesisSocialConsequenceSchema).max(31)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.sourceHeroId === receipt.recipientHeroId) {
			context.addIssue({ code: 'custom', message: 'Synthesis source and recipient must differ' });
		}
		if (
			new Set(receipt.socialConsequences.map((consequence) => consequence.heroId)).size !==
			receipt.socialConsequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Synthesis social consequences must be unique' });
		}
	});

export const SynthesisRumorRecordSchema = z
	.object({
		rumorVersion: z.literal('synthesis-rumor-v1'),
		rumorId: EntityIdSchema,
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		originObservationId: EntityIdSchema,
		speakerHeroId: EntityIdSchema,
		listenerHeroId: EntityIdSchema,
		observationId: EntityIdSchema,
		beliefId: EntityIdSchema,
		relationshipId: EntityIdSchema,
		confidence: z.number().int().min(1).max(100),
		chainDepth: z.number().int().min(1).max(8),
		relationshipDeltas: RelationshipDimensionsSchema,
		sharedAt: IsoDateTimeSchema
	})
	.strict();

export const SynthesisStateSchema = z
	.object({
		contentVersion: z.literal('synthesis-v1'),
		receipts: z.record(EntityIdSchema, SynthesisReceiptSchema),
		rumors: z.record(EntityIdSchema, SynthesisRumorRecordSchema)
	})
	.strict()
	.superRefine((synthesis, context) => {
		for (const [receiptId, receipt] of Object.entries(synthesis.receipts)) {
			if (receipt.receiptId !== receiptId) {
				context.addIssue({
					code: 'custom',
					message: 'Synthesis receipt key does not match its id'
				});
			}
		}
		for (const [rumorId, rumor] of Object.entries(synthesis.rumors)) {
			if (rumor.rumorId !== rumorId || !synthesis.receipts[rumor.receiptId]) {
				context.addIssue({ code: 'custom', message: 'Synthesis rumor reference is inconsistent' });
			}
		}
		if (
			Object.keys(synthesis.receipts).length > 512 ||
			Object.keys(synthesis.rumors).length > 4_096
		) {
			context.addIssue({ code: 'custom', message: 'Synthesis history limit exceeded' });
		}
	});

export const FirstBandArchiveKnowledgeSchema = z
	.object({
		heroId: EntityIdSchema,
		role: z.enum(['reader', 'witness']),
		learnedAt: IsoDateTimeSchema,
		sourceEventId: EntityIdSchema
	})
	.strict();

export const FirstBandExtractionReceiptSchema = z
	.object({
		receiptVersion: z.literal('first-band-extraction-receipt-v1'),
		receiptId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		missionAttemptId: EntityIdSchema,
		missionBinding: MissionContentBindingSchema,
		recoveredAt: IsoDateTimeSchema,
		survivingHeroIds: z.array(EntityIdSchema).max(7),
		rewardGrantIds: z
			.tuple([z.literal('hearth-relight-core'), z.literal('first-hearth-archive-fragment')])
			.readonly(),
		completedStoryHistoryHash: StateHashSchema
	})
	.strict()
	.superRefine((receipt, context) => {
		if (
			receipt.missionBinding.missionId !== 'tower-floor-05' ||
			new Set(receipt.survivingHeroIds).size !== receipt.survivingHeroIds.length
		) {
			context.addIssue({
				code: 'custom',
				message: 'First-band extraction receipt is inconsistent'
			});
		}
	});

export const FirstBandArchiveRevealSchema = z
	.object({
		revealVersion: z.literal('first-band-archive-reveal-v1'),
		revealId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		readerHeroId: EntityIdSchema,
		revealedAt: IsoDateTimeSchema,
		canonicalMessage: z.literal('Hearth 01 was not the first.'),
		expression: StoryExpressionResolutionSchema,
		knowledge: z.array(FirstBandArchiveKnowledgeSchema).min(1).max(31)
	})
	.strict()
	.superRefine((reveal, context) => {
		const readers = reveal.knowledge.filter((record) => record.role === 'reader');
		if (
			readers.length !== 1 ||
			readers[0]?.heroId !== reveal.readerHeroId ||
			reveal.expression.speakerId !== reveal.readerHeroId ||
			new Set(reveal.knowledge.map((record) => record.heroId)).size !== reveal.knowledge.length
		) {
			context.addIssue({ code: 'custom', message: 'Archive reveal knowledge is inconsistent' });
		}
	});

export const FirstBandArchiveStateSchema = z
	.object({
		archiveVersion: z.literal('first-band-archive-v1'),
		status: z.enum(['sealed', 'recovered', 'revealed']),
		envelopeId: MissionSlugSchema,
		envelopeContentHash: StateHashSchema,
		canonicalMessageHash: StateHashSchema,
		recovery: FirstBandExtractionReceiptSchema.nullable(),
		reveal: FirstBandArchiveRevealSchema.nullable()
	})
	.strict()
	.superRefine((archive, context) => {
		if (
			(archive.status === 'sealed' && (archive.recovery !== null || archive.reveal !== null)) ||
			(archive.status === 'recovered' && (archive.recovery === null || archive.reveal !== null)) ||
			(archive.status === 'revealed' && (archive.recovery === null || archive.reveal === null))
		) {
			context.addIssue({ code: 'custom', message: 'First-band archive lifecycle is inconsistent' });
		}
	});

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

export const EngineGameStateV23Schema = EngineGameStateV23BaseSchema.superRefine(
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
	EngineGameStateV23Schema
]);

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

export const StartTravelCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.travel'),
	targetNodeId: SettlementNodeIdSchema
}).strict();

export const AssignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.assign.hero'),
	heroId: EntityIdSchema,
	buildingId: SettlementSlugSchema,
	role: BuildingAssignmentRoleSchema
}).strict();

export const UnassignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.unassign.hero'),
	heroId: EntityIdSchema
}).strict();

export const AllocateBuildingPowerCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.allocate.power'),
	buildingId: SettlementSlugSchema
}).strict();

export const RecoverFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.recover.first.ember')
}).strict();

export const CommitFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.commit.first.ember'),
	buildingId: FirstEmberFacilitySchema,
	rationale: FirstEmberRationaleSchema
}).strict();

export const MasterCommunicateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.communicate'),
	targetHeroId: EntityIdSchema,
	kind: OnboardingCommunicativeActKindSchema,
	topic: CommunicationTopicSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Communication text must contain a visible character'
		}),
	tone: CommunicationToneSchema.nullable(),
	delivery: CommunicationDeliverySchema
}).strict();

export const CommunicationRequestSchema = z
	.object({
		targetHeroId: EntityIdSchema,
		kind: OnboardingCommunicativeActKindSchema,
		topic: CommunicationTopicSchema,
		exactText: z
			.string()
			.min(1)
			.max(600)
			.refine((text) => /\S/u.test(text), {
				message: 'Communication text must contain a visible character'
			}),
		tone: CommunicationToneSchema.nullable(),
		delivery: CommunicationDeliverySchema
	})
	.strict();

const ConversationRequestShape = {
	targetHeroId: EntityIdSchema,
	kind: ConversationActKindSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Conversation text must contain a visible character'
		}),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema,
	orderIntent: ConversationOrderIntentSchema.nullable()
} as const;

function validateConversationRequest(
	request: { kind: 'say' | 'ask' | 'order'; orderIntent: string | null },
	context: z.RefinementCtx
): void {
	if ((request.kind === 'order') !== (request.orderIntent !== null)) {
		context.addIssue({ code: 'custom', message: 'Only an order has an order intent' });
	}
}

export const MasterConverseCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.converse'),
	...ConversationRequestShape
})
	.strict()
	.superRefine(validateConversationRequest);

export const ConversationRequestSchema = z
	.object(ConversationRequestShape)
	.strict()
	.superRefine(validateConversationRequest);

const DirectiveIssueShape = {
	text: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Directive text must contain a visible character'
		}),
	scope: DirectiveScopeSchema,
	recipientIds: z.array(EntityIdSchema).min(1).max(8),
	priorities: z.array(z.string().min(1).max(80)).max(12),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema
} as const;

export const MasterIssueDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.issue.directive'),
	...DirectiveIssueShape
}).strict();

export const MasterReplaceDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.replace.directive'),
	directiveId: EntityIdSchema,
	...DirectiveIssueShape
}).strict();

export const MasterRevokeDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.revoke.directive'),
	directiveId: EntityIdSchema
}).strict();

export const ConfigureMasterTimingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.configure.timing'),
	timing: DecisionTimingSchema,
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: IsoDateTimeSchema
}).strict();

export const OpenMasterDecisionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.open.decision'),
	observedAt: IsoDateTimeSchema
}).strict();

export const ConfigureMasterFallbackCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.configure.fallback'),
	policy: FallbackPolicySchema,
	directionText: z.string().min(1).max(600),
	priorities: z.array(MasterFallbackPrioritySchema).max(5),
	protectedHeroId: EntityIdSchema.nullable(),
	safetyStops: MasterFallbackSafetyStopsSchema,
	observedAt: IsoDateTimeSchema
}).strict();

export const ApplyMasterSafetyStopCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.apply.safety-stop'),
	decisionId: EntityIdSchema,
	observedAt: IsoDateTimeSchema
}).strict();

export const DirectiveRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('issue'), ...DirectiveIssueShape }).strict(),
	z
		.object({
			action: z.literal('replace'),
			directiveId: EntityIdSchema,
			...DirectiveIssueShape
		})
		.strict(),
	z.object({ action: z.literal('revoke'), directiveId: EntityIdSchema }).strict()
]);

export const FirstEmberRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('recover') }).strict(),
	z
		.object({
			action: z.literal('commit'),
			buildingId: FirstEmberFacilitySchema,
			rationale: FirstEmberRationaleSchema
		})
		.strict()
]);

export const CreateDailyPlanCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.plan.day')
}).strict();

export const StartRoutineCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.routine')
}).strict();

export const InspectGateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.inspect.gate')
}).strict();

export const StartActivityCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.activity'),
	activity: ActivityKindSchema
}).strict();

export const EquipItemCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.equip.item'),
	itemId: EntityIdSchema
}).strict();

export const AdvanceSimulationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.advance'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const SyncSimulationClockCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.sync.clock'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const ApplyDamageCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.apply.damage'),
	targetId: EntityIdSchema,
	amount: z.number().int().min(1).max(100),
	damageKind: z.enum(['hazard', 'training', 'combat'])
}).strict();

export const PrepareMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.prepare'),
	heroIds: z.array(EntityIdSchema).max(7),
	missionId: MissionSlugSchema.optional()
}).strict();

export const ReviseMissionPartyCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.revise.party'),
	heroIds: z.array(EntityIdSchema).max(7)
}).strict();

export const CancelMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.cancel')
}).strict();

export const DeployMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.deploy')
}).strict();

export const ResolveMissionTurnCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.resolve.turn'),
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	decisionId: EntityIdSchema.optional(),
	resolvedAt: IsoDateTimeSchema.optional()
}).strict();

export const OpenMissionExtractionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.open.extraction'),
	completedObjectiveIds: z.array(MissionSlugSchema).min(1).max(20)
}).strict();

export const ExtractMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.extract')
}).strict();

export const RetreatMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.retreat')
}).strict();

export const ApplyStoryPatchCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.apply.patch'),
	candidate: StoryPatchCandidateSchema
}).strict();

export const RevealFirstBandArchiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.reveal.first.archive'),
	readerHeroId: EntityIdSchema
}).strict();

export const SynthesizeHeroCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.synthesize.hero'),
	sourceHeroId: EntityIdSchema,
	recipientHeroId: EntityIdSchema,
	visibility: SynthesisVisibilitySchema,
	warningVersion: z.literal('synthesis-warning-v1'),
	confirmedIrreversible: z.literal(true),
	rationale: z.string().min(1).max(240)
}).strict();

export const ShareSynthesisRumorCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.share.synthesis.rumor'),
	receiptId: EntityIdSchema,
	targetHeroId: EntityIdSchema
}).strict();

export const SynthesisRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('synthesize'),
			sourceHeroId: EntityIdSchema,
			recipientHeroId: EntityIdSchema,
			visibility: SynthesisVisibilitySchema,
			warningVersion: z.literal('synthesis-warning-v1'),
			confirmedIrreversible: z.literal(true),
			rationale: z.string().min(1).max(240)
		})
		.strict(),
	z
		.object({
			action: z.literal('share-rumor'),
			receiptId: EntityIdSchema,
			speakerHeroId: EntityIdSchema,
			targetHeroId: EntityIdSchema
		})
		.strict()
]);

export const FirstBandArchiveRequestSchema = z
	.object({
		action: z.literal('reveal'),
		readerHeroId: EntityIdSchema
	})
	.strict();

export const EngineCommandSchema = z.discriminatedUnion('commandType', [
	ChooseDestinationCommandSchema,
	ArriveDestinationCommandSchema,
	StartTravelCommandSchema,
	AssignHeroBuildingCommandSchema,
	UnassignHeroBuildingCommandSchema,
	AllocateBuildingPowerCommandSchema,
	RecoverFirstEmberCommandSchema,
	CommitFirstEmberCommandSchema,
	MasterCommunicateCommandSchema,
	MasterConverseCommandSchema,
	MasterIssueDirectiveCommandSchema,
	MasterReplaceDirectiveCommandSchema,
	MasterRevokeDirectiveCommandSchema,
	ConfigureMasterTimingCommandSchema,
	OpenMasterDecisionCommandSchema,
	ConfigureMasterFallbackCommandSchema,
	ApplyMasterSafetyStopCommandSchema,
	CreateDailyPlanCommandSchema,
	StartRoutineCommandSchema,
	InspectGateCommandSchema,
	StartActivityCommandSchema,
	EquipItemCommandSchema,
	AdvanceSimulationCommandSchema,
	SyncSimulationClockCommandSchema,
	ApplyDamageCommandSchema,
	PrepareMissionCommandSchema,
	ReviseMissionPartyCommandSchema,
	CancelMissionCommandSchema,
	DeployMissionCommandSchema,
	ResolveMissionTurnCommandSchema,
	OpenMissionExtractionCommandSchema,
	ExtractMissionCommandSchema,
	RetreatMissionCommandSchema,
	ApplyStoryPatchCommandSchema,
	RevealFirstBandArchiveCommandSchema,
	SynthesizeHeroCommandSchema,
	ShareSynthesisRumorCommandSchema
]);

export const MissionLifecycleRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('prepare'),
			heroIds: z.array(EntityIdSchema).max(4),
			missionId: MissionSlugSchema.optional()
		})
		.strict(),
	z.object({ action: z.literal('revise-party'), heroIds: z.array(EntityIdSchema).max(4) }).strict(),
	z.object({ action: z.literal('cancel') }).strict(),
	z.object({ action: z.literal('deploy') }).strict(),
	z
		.object({
			action: z.literal('resolve-turn'),
			masterActionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u)
		})
		.strict(),
	z.object({ action: z.literal('resolve-fallback') }).strict(),
	z.object({ action: z.literal('extract') }).strict(),
	z.object({ action: z.literal('retreat') }).strict()
]);

export const MasterControlRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('timing'),
			timing: DecisionTimingSchema,
			countdownSeconds: z.number().int().min(1).max(60).default(5)
		})
		.strict(),
	z
		.object({
			action: z.literal('fallback'),
			policy: FallbackPolicySchema,
			directionText: z.string().min(1).max(600),
			priorities: z.array(MasterFallbackPrioritySchema).max(5),
			protectedHeroId: EntityIdSchema.nullable(),
			safetyStops: MasterFallbackSafetyStopsSchema
		})
		.strict()
]);

export const MasterDecisionWindowRequestSchema = z.object({}).strict();

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

export const CatchUpRequestSchema = z
	.object({
		wallTime: IsoDateTimeSchema.optional()
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
export type EngineCommand = z.infer<typeof EngineCommandSchema>;
export type EngineCommit = z.infer<typeof EngineCommitSchema>;
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
export type EngineReplayReport = z.infer<typeof EngineReplayReportSchema>;
export type EngineScheduleRecord = z.infer<typeof EngineScheduleRecordSchema>;
export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
export type EntropyDraw = z.infer<typeof EntropyDrawSchema>;
export type FirstEmberRequest = z.infer<typeof FirstEmberRequestSchema>;
export type MissionLifecycleRequest = z.infer<typeof MissionLifecycleRequestSchema>;
export type MasterControlRequest = z.infer<typeof MasterControlRequestSchema>;
export type SynthesisReceipt = z.infer<typeof SynthesisReceiptSchema>;
export type SynthesisRumorRecord = z.infer<typeof SynthesisRumorRecordSchema>;
export type SynthesisState = z.infer<typeof SynthesisStateSchema>;
export type FirstBandArchiveState = z.infer<typeof FirstBandArchiveStateSchema>;
export type FirstBandExtractionReceipt = z.infer<typeof FirstBandExtractionReceiptSchema>;
export type FirstBandArchiveReveal = z.infer<typeof FirstBandArchiveRevealSchema>;
export type SynthesisVisibility = z.infer<typeof SynthesisVisibilitySchema>;
export type SynthesisRequest = z.infer<typeof SynthesisRequestSchema>;
export type CommunicationRequest = z.infer<typeof CommunicationRequestSchema>;
export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;
export type DirectiveRequest = z.infer<typeof DirectiveRequestSchema>;
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;
export type SimulationClock = z.infer<typeof SimulationClockSchema>;
