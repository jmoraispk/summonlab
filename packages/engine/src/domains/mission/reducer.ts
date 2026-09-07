import {
	CombatResultSchema,
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
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	FirstBandArchiveStateSchema,
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionResolutionSchema,
	MasterDecisionResolutionV2Schema,
	MasterFallbackConfigurationSchema,
	MissionConsequenceRecordV2Schema,
	MissionConsequenceRecordV3Schema,
	MissionConsequenceRecordV4Schema,
	MissionHarmRecordSchema,
	MissionRoundSchema,
	MissionRoundV2Schema,
	MissionRoundV3Schema,
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionRunStateV9Schema,
	MissionTurnChoiceSchema,
	ResourceKeySchema,
	RuntimeBandStoryStateSchema,
	type AuthoritativeEvent,
	type CombatClaim,
	type CombatResult,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type MissionRunStateV8,
	type MissionTurnChoice
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { z } from 'zod';

import { EmptyMetadataSchema } from '../../core/event-metadata.js';
import type { EngineEventReducer, EngineGameStateModern } from '../../core/types.js';
import {
	combatClaimReceipt,
	existingCombatClaimReceipt,
	type CombatClaimReceipt
} from '../../core/combat-claims.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { resolveMissionCombatTurn, resolveMissionTurn } from './combat.js';
import { buildMissionEquipmentDrop, MissionEquipmentDropOutcomeSchema } from './equipment-drop.js';
import {
	cancelMissionPreparation,
	completeMissionExtraction,
	deployMissionAttempt,
	openMissionExtraction,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty,
	type CombatMissionClaimProjection
} from './lifecycle.js';
import { resolveMissionModeTurn } from './mission-mode-runner.js';
import {
	applyMasterSafetyStop,
	configureMasterFallback,
	configureMasterTiming,
	configureMasterTimingV2,
	endMasterDecision,
	endMasterDecisionV2,
	masterDecisionWindow,
	masterDecisionWindowV2,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	resolveMasterDecision,
	resolveMasterDecisionV2
} from './master-control.js';
import {
	appendPortalCargoLosses,
	completePortalMissionExtraction,
	resolvePortalMissionTurn
} from './portal.js';

export interface CombatMissionClaimTransition {
	readonly projection: CombatMissionClaimProjection;
	readonly receipts: readonly CombatClaimReceipt[];
}

function checkedAdd(left: number, right: number, label: string): number {
	const value = left + right;
	if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} overflowed`);
	return value;
}

function validateOwnedClaim(result: CombatResult, claim: CombatClaim): void {
	if (!claim.idempotencyKey.startsWith(`${result.attemptId}:`)) {
		throw new Error('Combat claim belongs to another attempt');
	}
	if (claim.claimType === 'final-resource') {
		const combatant = result.finalCombatants[claim.combatantId];
		if (!combatant || combatant.resources[claim.resource].current !== claim.value) {
			throw new Error('Final-resource claim diverged from combat result');
		}
	}
	if (claim.claimType === 'harm') {
		const combatant = result.finalCombatants[claim.heroId];
		if (!combatant || combatant.downed !== claim.downed) {
			throw new Error('Harm claim diverged from combat result');
		}
	}
	if (claim.claimType === 'recovery') {
		const combatant = result.finalCombatants[claim.heroId];
		if (
			!combatant?.downed ||
			!['victory', 'extraction'].includes(result.outcome) ||
			claim.minimumSafeHealth !== COMBAT_RULES_V1.health.minimumSafeHealth ||
			claim.minimumSafeHealth > combatant.resources.health.maximum
		) {
			throw new Error('Recovery claim lacks engine-owned safe-outcome evidence');
		}
	}
}

/** Derives only the mission/aftermath-owned side of a common combat result. */
export function transitionCombatMissionClaims(
	projection: CombatMissionClaimProjection,
	resultInput: CombatResult
): CombatMissionClaimTransition {
	const result = CombatResultSchema.parse(resultInput);
	const outcomeClaims = result.claims.filter((claim) => claim.claimType === 'attempt-outcome');
	if (outcomeClaims.length !== 1 || outcomeClaims[0]?.outcome !== result.outcome) {
		throw new Error('Combat result outcome claims are inconsistent');
	}
	for (const claim of result.claims) validateOwnedClaim(result, claim);

	let mission = projection;
	const receipts: CombatClaimReceipt[] = [];
	for (const claim of result.claims) {
		if (claim.claimType === 'skill-practice') continue;
		const existing = existingCombatClaimReceipt(mission.receipts, claim, 'mission-aftermath');
		if (existing) {
			receipts.push(existing);
			continue;
		}
		const receipt = combatClaimReceipt(claim, 'mission-aftermath', hashCanonical(mission));
		if (claim.claimType === 'final-resource') {
			const combatant = mission.combatants[claim.combatantId];
			if (!combatant) throw new Error(`Unknown persistent combatant ${claim.combatantId}`);
			const maximum = claim.resource === 'health' ? combatant.maximumHealth : combatant.maximumMana;
			if (claim.value > maximum)
				throw new Error('Final combat resource exceeds its persistent cap');
			mission = {
				...mission,
				combatants: {
					...mission.combatants,
					[claim.combatantId]: { ...combatant, [claim.resource]: claim.value }
				}
			};
		} else if (claim.claimType === 'harm') {
			const combatant = mission.combatants[claim.heroId];
			if (!combatant) throw new Error(`Unknown harmed hero ${claim.heroId}`);
			mission = {
				...mission,
				combatants: {
					...mission.combatants,
					[claim.heroId]: { ...combatant, downed: claim.downed }
				},
				harm: {
					...mission.harm,
					[claim.heroId]: { damageTaken: claim.damageTaken, downed: claim.downed }
				}
			};
		} else if (claim.claimType === 'recovery') {
			const combatant = mission.combatants[claim.heroId];
			if (!combatant) throw new Error(`Unknown recovered hero ${claim.heroId}`);
			mission = {
				...mission,
				combatants: {
					...mission.combatants,
					[claim.heroId]: {
						...combatant,
						health: claim.minimumSafeHealth,
						downed: false,
						lost: false
					}
				},
				recoveries: {
					...mission.recoveries,
					[claim.heroId]: { minimumSafeHealth: claim.minimumSafeHealth }
				}
			};
		} else if (claim.claimType === 'loot') {
			const ownerLoot = mission.loot[claim.ownerId] ?? {};
			mission = {
				...mission,
				loot: {
					...mission.loot,
					[claim.ownerId]: {
						...ownerLoot,
						[claim.lootId]: checkedAdd(ownerLoot[claim.lootId] ?? 0, claim.quantity, 'Combat loot')
					}
				}
			};
		} else if (claim.claimType === 'objective') {
			mission = {
				...mission,
				objectives: { ...mission.objectives, [claim.objectiveId]: claim.completed }
			};
		} else {
			mission = {
				...mission,
				attempts: {
					...mission.attempts,
					[result.attemptId]: {
						outcome: claim.outcome,
						modeId: result.modeId,
						rulesVersion: result.rulesVersion,
						traceHash: result.traceHash
					}
				}
			};
		}
		mission = {
			...mission,
			receipts: { ...mission.receipts, [claim.idempotencyKey]: receipt }
		};
		receipts.push(receipt);
	}

	if (['retreat', 'party-downed', 'deadline'].includes(result.outcome)) {
		const recoveredIds = new Set(
			result.claims.filter((claim) => claim.claimType === 'recovery').map((claim) => claim.heroId)
		);
		const combatants = { ...mission.combatants };
		for (const [combatantId, finalCombatant] of Object.entries(result.finalCombatants)) {
			const persistent = combatants[combatantId];
			if (persistent && finalCombatant.downed && !recoveredIds.has(combatantId)) {
				combatants[combatantId] = { ...persistent, health: 0, downed: true, lost: true };
			}
		}
		mission = { ...mission, combatants };
	}

	return { projection: mission, receipts };
}

const ResourceChangeSchema = z
	.object({
		resource: ResourceKeySchema,
		before: z.number().int().nonnegative(),
		after: z.number().int().nonnegative(),
		delta: z.number().int(),
		reason: z.string().min(1).max(120)
	})
	.strict()
	.refine((value) => value.after - value.before === value.delta, {
		message: 'Resource change delta is invalid'
	});

function applyResourceChanges(
	state: EngineGameStateModern,
	event: AuthoritativeEvent,
	changes: readonly z.infer<typeof ResourceChangeSchema>[]
) {
	const resources = { ...state.settlement.resources };
	const resourceLedger = [...state.settlement.resourceLedger];
	for (const [index, change] of changes.entries()) {
		if (resources[change.resource] !== change.before || change.after < 0) {
			throw new ReplayIntegrityError('Resource ledger precondition failed', event.sequence);
		}
		resources[change.resource] = change.after;
		resourceLedger.push({
			entryId: deterministicUuid(`${event.eventId}:resource:${index}`),
			eventId: event.eventId,
			...change
		});
	}
	return { ...state.settlement, resources, resourceLedger };
}

type FirstBandMissionState = EngineGameStateV23 | EngineGameStateV24;

export type ReduceFirstBandMissionConsequences = (
	state: FirstBandMissionState,
	consequence: {
		readonly eventId: string;
		readonly sequence: number;
		readonly transition: 'prepare' | 'revise-party' | 'cancel' | 'deploy' | 'extract' | 'retreat';
		readonly mission: MissionRunStateV8;
		readonly bandStory: EngineGameStateV23['bandStory'];
		readonly firstBandArchive: EngineGameStateV23['firstBandArchive'];
	}
) => FirstBandMissionState;

const MissionTransitionPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.enum([
		'prepare',
		'revise-party',
		'cancel',
		'deploy',
		'open-extraction',
		'extract',
		'retreat'
	]),
	mission: MissionRunStateSchema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV2Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV2Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV2Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundSchema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV3Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV3Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionCombatTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV3Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV4Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV4Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionCombatTurnResolvedPayloadV4Schema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV4Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV5Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV5Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	resourceChanges: z.array(ResourceChangeSchema).max(3),
	nextVersion: z.number().int().positive()
}).strict();

const MissionPortalTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV5Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV3Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionAftermathTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV6Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionHarmRecordSchema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV7Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionConsequenceRecordV2Schema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MissionAttemptAftermathTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV8Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionConsequenceRecordV3Schema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MissionLegacyAutomaticTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV9Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionConsequenceRecordV4Schema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MasterTimingChangedPayloadSchema = EmptyMetadataSchema.extend({
	timing: z.enum(['wait', 'countdown', 'step', 'continuous']),
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateSchema,
	pausedResolution: MasterDecisionResolutionSchema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterDecisionOpenedPayloadSchema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterTimingTurnResolvedPayloadSchema =
	MissionAttemptAftermathTurnResolvedPayloadSchema.safeExtend({
		masterControl: MasterControlStateSchema,
		decisionResolution: MasterDecisionResolutionSchema
	}).strict();

const MasterTimingChangedPayloadV2Schema = EmptyMetadataSchema.extend({
	timing: z.enum(['wait', 'countdown', 'step', 'continuous']),
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	pausedResolution: MasterDecisionResolutionV2Schema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterFallbackChangedPayloadSchema = EmptyMetadataSchema.extend({
	policy: MasterFallbackConfigurationSchema.shape.policy,
	directionText: MasterFallbackConfigurationSchema.shape.directionText,
	priorities: MasterFallbackConfigurationSchema.shape.priorities,
	protectedHeroId: MasterFallbackConfigurationSchema.shape.protectedHeroId,
	safetyStops: MasterFallbackConfigurationSchema.shape.safetyStops,
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	pausedResolution: MasterDecisionResolutionV2Schema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterDecisionOpenedPayloadV2Schema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MasterSafetyStoppedPayloadSchema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	decisionResolution: MasterDecisionResolutionV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterFallbackTurnResolvedPayloadSchema =
	MissionAttemptAftermathTurnResolvedPayloadSchema.safeExtend({
		masterControl: MasterControlStateV2Schema,
		decisionResolution: MasterDecisionResolutionV2Schema
	}).strict();

const MissionTransitionPayloadV6Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV6Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV7Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV7Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV8Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV8Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV9Schema = MissionTransitionPayloadV8Schema.safeExtend({
	masterControl: MasterControlStateSchema,
	decisionResolution: MasterDecisionResolutionSchema.nullable()
}).strict();

const MissionTransitionPayloadV10Schema = MissionTransitionPayloadV8Schema.safeExtend({
	masterControl: MasterControlStateV2Schema,
	decisionResolution: MasterDecisionResolutionV2Schema.nullable()
}).strict();

const MissionTransitionPayloadV11Schema = MissionTransitionPayloadV8Schema.safeExtend({
	bandStory: RuntimeBandStoryStateSchema,
	firstBandArchive: FirstBandArchiveStateSchema
}).strict();

const MissionTransitionPayloadV12Schema = MissionTransitionPayloadV11Schema.safeExtend({
	equipmentDrop: MissionEquipmentDropOutcomeSchema.nullable()
}).strict();

const MissionTransitionPayloadV13Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV9Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

function reduceMissionEventInternal(
	state: EngineGameState,
	event: AuthoritativeEvent,
	reduceConsequences: ReduceFirstBandMissionConsequences
): EngineGameState {
	if (event.eventType === 'master.timing.changed') {
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.seedCursor !== state.entropyCursor ||
				event.source.source !== 'manual' ||
				event.source.timing !== 'step'
			) {
				throw new ReplayIntegrityError(
					'Master fallback timing precondition failed',
					event.sequence
				);
			}
			const payload = MasterTimingChangedPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master fallback timing version diverged', event.sequence);
			}
			const expected = configureMasterTimingV2(
				state.masterControl,
				event.commandId,
				payload.timing,
				payload.countdownSeconds,
				payload.observedAt,
				event.source
			);
			if (
				hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
			) {
				throw new ReplayIntegrityError('Master fallback timing payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				masterControl: payload.masterControl
			});
		}
		if (
			state.schemaVersion !== 19 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master timing change precondition failed', event.sequence);
		}
		const payload = MasterTimingChangedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master timing change version diverged', event.sequence);
		}
		const expected = configureMasterTiming(
			state.masterControl,
			event.commandId,
			payload.timing,
			payload.countdownSeconds,
			payload.observedAt,
			event.source
		);
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
		) {
			throw new ReplayIntegrityError('Master timing change payload diverged', event.sequence);
		}
		return EngineGameStateV19Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.fallback.changed') {
		if (
			state.schemaVersion !== 20 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual' ||
			event.source.timing !== 'step'
		) {
			throw new ReplayIntegrityError('Master fallback change precondition failed', event.sequence);
		}
		const payload = MasterFallbackChangedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master fallback change version diverged', event.sequence);
		}
		const expected = configureMasterFallback(state.masterControl, {
			commandId: event.commandId,
			observedAt: payload.observedAt,
			source: event.source,
			policy: payload.policy,
			directionText: payload.directionText,
			priorities: payload.priorities,
			protectedHeroId: payload.protectedHeroId,
			safetyStops: payload.safetyStops
		});
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
		) {
			throw new ReplayIntegrityError('Master fallback change payload diverged', event.sequence);
		}
		return EngineGameStateV20Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.safety.stopped') {
		if (
			state.schemaVersion !== 20 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master safety stop precondition failed', event.sequence);
		}
		const payload = MasterSafetyStoppedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master safety stop version diverged', event.sequence);
		}
		let expected;
		try {
			expected = applyMasterSafetyStop(
				state,
				event.commandId,
				payload.decisionResolution.decisionId,
				payload.observedAt,
				event.source
			);
		} catch {
			throw new ReplayIntegrityError('Master safety stop could not be reproduced', event.sequence);
		}
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.resolution) !== hashCanonical(payload.decisionResolution)
		) {
			throw new ReplayIntegrityError('Master safety stop payload diverged', event.sequence);
		}
		return EngineGameStateV20Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.decision.opened') {
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.seedCursor !== state.entropyCursor ||
				event.source.source !== 'manual' ||
				event.source.timing !== 'step'
			) {
				throw new ReplayIntegrityError(
					'Master fallback decision precondition failed',
					event.sequence
				);
			}
			const payload = MasterDecisionOpenedPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master fallback decision version diverged', event.sequence);
			}
			const expected = masterDecisionWindowV2(
				state.masterControl,
				event.commandId,
				payload.observedAt
			);
			if (hashCanonical(expected) !== hashCanonical(payload.masterControl)) {
				throw new ReplayIntegrityError('Master fallback decision payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				masterControl: payload.masterControl
			});
		}
		if (
			state.schemaVersion !== 19 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master decision opening precondition failed', event.sequence);
		}
		const payload = MasterDecisionOpenedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master decision opening version diverged', event.sequence);
		}
		const expected = masterDecisionWindow(state.masterControl, event.commandId, payload.observedAt);
		if (hashCanonical(expected) !== hashCanonical(payload.masterControl)) {
			throw new ReplayIntegrityError('Master decision opening payload diverged', event.sequence);
		}
		return EngineGameStateV19Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'mission.round.resolved') {
		if (state.schemaVersion === 25) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionLegacyAutomaticTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission round version diverged',
					event.sequence
				);
			}
			const expected = resolveMissionModeTurn(state, event.eventId);
			if (hashCanonical(expected.choices) !== hashCanonical(payload.choices)) {
				throw new ReplayIntegrityError('Legacy automatic policy evidence diverged', event.sequence);
			}
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission round payload diverged',
					event.sequence
				);
			}
			return EngineGameStateV25Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status
			});
		}
		if (state.schemaVersion === 23 || state.schemaVersion === 24) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'First-band mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionAttemptAftermathTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('First-band mission round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('First-band mission round payload diverged', event.sequence);
			}
			const schema =
				state.schemaVersion === 24 ? EngineGameStateV24Schema : EngineGameStateV23Schema;
			return schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status
			});
		}
		if (state.schemaVersion === 20) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Master fallback mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionMasterFallbackTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Master fallback round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			const masterChoice = expected.choices.find(
				(choice) => choice.actorId === state.master.masterId
			);
			if (!masterChoice) {
				throw new ReplayIntegrityError('Master fallback round omitted the Master', event.sequence);
			}
			const fallback = event.source.source !== 'manual';
			if ((event.source.source === 'manual') !== (masterChoice.source === 'manual')) {
				throw new ReplayIntegrityError(
					'Master fallback source and action evidence diverged',
					event.sequence
				);
			}
			if (fallback) {
				let expectedChoice: MissionTurnChoice;
				try {
					expectedChoice = masterFallbackMissionChoice(state);
				} catch {
					throw new ReplayIntegrityError(
						'Master fallback choice could not be reproduced',
						event.sequence
					);
				}
				if (
					hashCanonical(event.source) !== hashCanonical(masterFallbackActionSource(state)) ||
					hashCanonical(masterChoice) !== hashCanonical(expectedChoice)
				) {
					throw new ReplayIntegrityError(
						'Master fallback policy evidence diverged',
						event.sequence
					);
				}
			}
			const missionContinues =
				expected.status === 'active' &&
				expected.mission.attempt !== null &&
				['deployed', 'resolving'].includes(expected.mission.attempt.status);
			let expectedControl;
			try {
				expectedControl = resolveMasterDecisionV2(
					state,
					event.commandId,
					payload.decisionResolution.decisionId,
					payload.decisionResolution.resolvedAt,
					masterChoice.actionId,
					event.source,
					missionContinues
				);
			} catch {
				throw new ReplayIntegrityError(
					'Master fallback decision could not be reproduced',
					event.sequence
				);
			}
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError('Master fallback round payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 19) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Master timing mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionMasterTimingTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Master timing round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			const masterChoice = expected.choices.find(
				(choice) => choice.actorId === state.master.masterId
			);
			if (!masterChoice) {
				throw new ReplayIntegrityError('Master timing round omitted the Master', event.sequence);
			}
			if ((event.source.source === 'manual') !== (masterChoice.source === 'manual')) {
				throw new ReplayIntegrityError(
					'Master timing source and action evidence diverged',
					event.sequence
				);
			}
			const missionContinues =
				expected.status === 'active' &&
				expected.mission.attempt !== null &&
				['deployed', 'resolving'].includes(expected.mission.attempt.status);
			const expectedTiming = resolveMasterDecision(
				state.masterControl,
				event.commandId,
				payload.decisionResolution.decisionId,
				payload.decisionResolution.resolvedAt,
				masterChoice.actionId,
				event.source,
				missionContinues
			);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedTiming.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedTiming.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError('Master timing round payload diverged', event.sequence);
			}
			return EngineGameStateV19Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 16 || state.schemaVersion === 17 || state.schemaVersion === 18) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Mission aftermath round precondition failed',
					event.sequence
				);
			}
			const payload =
				state.schemaVersion === 18
					? MissionAttemptAftermathTurnResolvedPayloadSchema.parse(event.payload)
					: state.schemaVersion === 17
						? MissionMasterTurnResolvedPayloadSchema.parse(event.payload)
						: MissionAftermathTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission aftermath round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission aftermath round payload diverged', event.sequence);
			}
			const candidate = {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status
			};
			return state.schemaVersion === 18
				? EngineGameStateV18Schema.parse(candidate)
				: state.schemaVersion === 17
					? EngineGameStateV17Schema.parse(candidate)
					: EngineGameStateV16Schema.parse(candidate);
		}
		if (state.schemaVersion === 15) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError('Portal mission round precondition failed', event.sequence);
			}
			const payload = MissionPortalTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Portal mission round version diverged', event.sequence);
			}
			const expected = resolvePortalMissionTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Portal mission round payload diverged', event.sequence);
			}
			return EngineGameStateV15Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 14) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Mission evidence round precondition failed',
					event.sequence
				);
			}
			const payload = MissionCombatTurnResolvedPayloadV4Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission evidence round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission evidence round payload diverged', event.sequence);
			}
			return EngineGameStateV14Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 13) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError('Mission combat round precondition failed', event.sequence);
			}
			const payload = MissionCombatTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission combat round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission combat round payload diverged', event.sequence);
			}
			return EngineGameStateV13Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (
			state.schemaVersion !== 12 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt
		) {
			throw new ReplayIntegrityError('Mission round precondition failed', event.sequence);
		}
		const payload = MissionTurnResolvedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Mission round version diverged', event.sequence);
		}
		const expected = resolveMissionTurn(state, payload.choices);
		if (
			expected.entropyCursor !== event.seedCursor ||
			hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
			hashCanonical(expected.round) !== hashCanonical(payload.round) ||
			hashCanonical(expected.mission) !== hashCanonical(payload.mission)
		) {
			throw new ReplayIntegrityError('Mission round payload diverged', event.sequence);
		}
		return EngineGameStateV12Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			mission: payload.mission
		});
	}
	if (
		[
			'mission.preparation.started',
			'mission.party.revised',
			'mission.preparation.canceled',
			'mission.deployed',
			'mission.extraction.opened',
			'mission.extracted',
			'mission.retreated'
		].includes(event.eventType)
	) {
		if (state.schemaVersion === 25) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV13Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission event type diverged',
					event.sequence
				);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId,
							payload.mission.attempt?.combatModeBinding
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expectedMission) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Legacy automatic mission deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Legacy automatic mission transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV25Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 24) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Equipment mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV12Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Equipment mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Equipment mission event type diverged', event.sequence);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const storyState = reduceConsequences(state, {
				eventId: event.eventId,
				sequence: event.sequence,
				transition: payload.transition,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive
			});
			const expectedDrop =
				payload.transition === 'extract'
					? buildMissionEquipmentDrop(state, event.eventId, payload.mission)
					: null;
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedDrop) !== hashCanonical(payload.equipmentDrop)
			) {
				throw new ReplayIntegrityError(
					'Equipment mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Equipment mission deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Equipment mission transition entropy diverged',
					event.sequence
				);
			}
			const equipmentDrop = payload.equipmentDrop;
			if (equipmentDrop && state.items[equipmentDrop.item.itemId]) {
				throw new ReplayIntegrityError('Equipment drop item already exists', event.sequence);
			}
			return EngineGameStateV24Schema.parse({
				...storyState,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive,
				items: equipmentDrop
					? { ...state.items, [equipmentDrop.item.itemId]: equipmentDrop.item }
					: state.items
			});
		}
		if (state.schemaVersion === 23) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'First-band mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV11Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'First-band mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('First-band mission event type diverged', event.sequence);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const storyState = reduceConsequences(state, {
				eventId: event.eventId,
				sequence: event.sequence,
				transition: payload.transition,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive
			});
			if (hashCanonical(expectedMission) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'First-band mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError('First-band deployment entropy diverged', event.sequence);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('First-band transition entropy diverged', event.sequence);
			}
			return EngineGameStateV23Schema.parse({
				...storyState,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive
			});
		}
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV10Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError(
					'Master fallback mission event type diverged',
					event.sequence
				);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const expectedControl =
				expectedMission.attempt !== null &&
				!['deployed', 'resolving'].includes(expectedMission.attempt.status)
					? endMasterDecisionV2(state.masterControl, event.source)
					: { control: state.masterControl, resolution: null };
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Master fallback deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Master fallback transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 19) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Master timing mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV9Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Master timing mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Master timing mission event type diverged', event.sequence);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const expectedControl =
				expectedMission.attempt !== null &&
				!['deployed', 'resolving'].includes(expectedMission.attempt.status)
					? endMasterDecision(state.masterControl, event.source)
					: { control: state.masterControl, resolution: null };
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError(
					'Master timing mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Master timing deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master timing transition entropy diverged', event.sequence);
			}
			return EngineGameStateV19Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 16 || state.schemaVersion === 17 || state.schemaVersion === 18) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition precondition failed',
					event.sequence
				);
			}
			const payload =
				state.schemaVersion === 18
					? MissionTransitionPayloadV8Schema.parse(event.payload)
					: state.schemaVersion === 17
						? MissionTransitionPayloadV7Schema.parse(event.payload)
						: MissionTransitionPayloadV6Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission aftermath event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission aftermath deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition entropy diverged',
					event.sequence
				);
			}
			const candidate = {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			};
			return state.schemaVersion === 18
				? EngineGameStateV18Schema.parse(candidate)
				: state.schemaVersion === 17
					? EngineGameStateV17Schema.parse(candidate)
					: EngineGameStateV16Schema.parse(candidate);
		}
		if (state.schemaVersion === 15) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Portal mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV5Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Portal mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Portal mission event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? {
							mission: prepareMissionAttempt(
								state,
								event.commandId,
								payload.heroIds,
								payload.mission.binding.missionId
							),
							resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
						}
					: payload.transition === 'revise-party'
						? {
								mission: reviseMissionParty(state, payload.heroIds),
								resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
							}
						: payload.transition === 'cancel'
							? {
									mission: cancelMissionPreparation(state),
									resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
								}
							: payload.transition === 'deploy'
								? {
										mission: deployMissionAttempt(state).mission,
										resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
									}
								: payload.transition === 'extract'
									? completePortalMissionExtraction(state)
									: {
											mission: retreatMissionAttempt(state, appendPortalCargoLosses),
											resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
										};
			if (
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expected.resourceChanges) !== hashCanonical(payload.resourceChanges)
			) {
				throw new ReplayIntegrityError(
					'Portal mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError('Portal deployment entropy diverged', event.sequence);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Portal transition entropy diverged', event.sequence);
			}
			return EngineGameStateV15Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				settlement: applyResourceChanges(state, event, payload.resourceChanges)
			});
		}
		if (state.schemaVersion === 14) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission evidence transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV4Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission evidence transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission evidence event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission evidence transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission evidence deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission evidence transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV14Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 13) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission combat transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV3Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission combat transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission combat event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(state, event.commandId, payload.heroIds)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission combat transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission combat deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission combat transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV13Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 12) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError('Mission transition precondition failed', event.sequence);
			}
			const payload = MissionTransitionPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission transition version diverged', event.sequence);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(state, event.commandId, payload.heroIds)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError('Mission transition payload diverged', event.sequence);
			}
			return EngineGameStateV12Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (
			state.schemaVersion !== 11 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt
		) {
			throw new ReplayIntegrityError('Mission transition precondition failed', event.sequence);
		}
		const payload = MissionTransitionPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Mission transition version diverged', event.sequence);
		}
		const eventTypes = {
			prepare: 'mission.preparation.started',
			'revise-party': 'mission.party.revised',
			cancel: 'mission.preparation.canceled',
			deploy: 'mission.deployed',
			'open-extraction': 'mission.extraction.opened',
			extract: 'mission.extracted',
			retreat: 'mission.retreated'
		} as const;
		if (eventTypes[payload.transition] !== event.eventType) {
			throw new ReplayIntegrityError('Mission event type diverged', event.sequence);
		}
		const expected =
			payload.transition === 'prepare'
				? prepareMissionAttempt(state, event.commandId, payload.heroIds)
				: payload.transition === 'revise-party'
					? reviseMissionParty(state, payload.heroIds)
					: payload.transition === 'cancel'
						? cancelMissionPreparation(state)
						: payload.transition === 'deploy'
							? deployMissionAttempt(state).mission
							: payload.transition === 'open-extraction'
								? openMissionExtraction(state, payload.completedObjectiveIds)
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
		if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
			throw new ReplayIntegrityError('Mission transition payload diverged', event.sequence);
		}
		return EngineGameStateV11Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			mission: payload.mission
		});
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}

const rejectFirstBandMissionConsequences: ReduceFirstBandMissionConsequences = (
	_state,
	consequence
) => {
	throw new ReplayIntegrityError(
		'First-band mission transition requires orchestration',
		consequence.sequence
	);
};

export function reduceMissionEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
	return reduceMissionEventInternal(state, event, rejectFirstBandMissionConsequences);
}

export function reduceFirstBandMissionTransition(
	state: EngineGameStateV23 | EngineGameStateV24,
	event: AuthoritativeEvent,
	reduceConsequences: ReduceFirstBandMissionConsequences
): EngineGameStateV23 | EngineGameStateV24 {
	const reduced = reduceMissionEventInternal(state, event, reduceConsequences);
	return state.schemaVersion === 24
		? EngineGameStateV24Schema.parse(reduced)
		: EngineGameStateV23Schema.parse(reduced);
}

export const MISSION_EVENT_TYPES = [
	'master.timing.changed',
	'master.fallback.changed',
	'master.safety.stopped',
	'master.decision.opened',
	'mission.round.resolved',
	'mission.extraction.opened'
] as const;

export const missionEventReducer: EngineEventReducer = {
	ownerId: 'mission',
	eventTypes: MISSION_EVENT_TYPES,
	reduce: reduceMissionEvent
};
