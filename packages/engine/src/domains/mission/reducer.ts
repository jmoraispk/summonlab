import {
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
	FirstBandArchiveStateSchema,
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionResolutionSchema,
	MasterDecisionResolutionV2Schema,
	MasterFallbackConfigurationSchema,
	MissionConsequenceRecordV2Schema,
	MissionConsequenceRecordV3Schema,
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
	MissionTurnChoiceSchema,
	ResourceKeySchema,
	RuntimeBandStoryStateSchema,
	type AuthoritativeEvent,
	type EngineGameState,
	type EngineGameStateV23,
	type MissionRunStateV8,
	type MissionTurnChoice
} from '@summonlab/contracts';
import { z } from 'zod';

import { EmptyMetadataSchema } from '../../core/event-metadata.js';
import type { EngineEventReducer, EngineGameStateModern } from '../../core/types.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { resolveMissionCombatTurn, resolveMissionTurn } from './combat.js';
import {
	cancelMissionPreparation,
	completeMissionExtraction,
	deployMissionAttempt,
	openMissionExtraction,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty
} from './lifecycle.js';
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

export type ReduceFirstBandMissionConsequences = (
	state: EngineGameStateV23,
	consequence: {
		readonly eventId: string;
		readonly sequence: number;
		readonly transition: 'prepare' | 'revise-party' | 'cancel' | 'deploy' | 'extract' | 'retreat';
		readonly mission: MissionRunStateV8;
		readonly bandStory: EngineGameStateV23['bandStory'];
		readonly firstBandArchive: EngineGameStateV23['firstBandArchive'];
	}
) => EngineGameStateV23;

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
		if (state.schemaVersion === 23) {
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
			return EngineGameStateV23Schema.parse({
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
	state: EngineGameStateV23,
	event: AuthoritativeEvent,
	reduceConsequences: ReduceFirstBandMissionConsequences
): EngineGameStateV23 {
	return EngineGameStateV23Schema.parse(
		reduceMissionEventInternal(state, event, reduceConsequences)
	);
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
