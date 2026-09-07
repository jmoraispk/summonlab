import { z } from 'zod';

import { InjurySchema } from './base-state.js';
import { MissionArenaKnowledgeSchema, MissionSlugSchema } from '../mission.js';
import { ReadinessCombatStateV1Schema } from '../readiness-combat.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from '../shared.js';

export const MissionAttemptStatusSchema = z.enum([
	'preparing',
	'deployed',
	'resolving',
	'extraction',
	'success',
	'failure',
	'retreat',
	'canceled',
	'death'
]);

export const MissionAttemptOutcomeSchema = z.enum([
	'success',
	'failure',
	'retreat',
	'canceled',
	'death'
]);

export const MissionContentBindingSchema = z
	.object({
		missionId: MissionSlugSchema,
		contentVersion: ContentVersionSchema,
		contentHash: StateHashSchema
	})
	.strict();

export const CombatModeIdSchema = z.enum(['legacy-auto-v1', 'agent-readiness-v1']);

export const CombatModeBindingSchema = z
	.object({
		modeId: CombatModeIdSchema,
		rulesVersion: ContentVersionSchema,
		contentHash: StateHashSchema,
		boundAt: IsoDateTimeSchema
	})
	.strict();

export const MissionPartySchema = z
	.object({
		masterId: EntityIdSchema,
		heroIds: z.array(EntityIdSchema).max(7),
		memberIds: z.array(EntityIdSchema).min(1).max(8)
	})
	.strict()
	.superRefine((party, context) => {
		if (
			party.memberIds[0] !== party.masterId ||
			party.memberIds.slice(1).join('|') !== party.heroIds.join('|')
		) {
			context.addIssue({ code: 'custom', message: 'Mission party members must be Master first' });
		}
		if (
			new Set(party.heroIds).size !== party.heroIds.length ||
			new Set(party.memberIds).size !== party.memberIds.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission party members must be unique' });
		}
	});

export const MissionAttemptSchema = z
	.object({
		attemptId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		status: MissionAttemptStatusSchema,
		party: MissionPartySchema,
		entryNodeId: MissionSlugSchema,
		extractionNodeId: MissionSlugSchema,
		positions: z.record(EntityIdSchema, MissionSlugSchema),
		knowledge: MissionArenaKnowledgeSchema,
		completedObjectiveIds: z.array(MissionSlugSchema).max(20),
		preparedAt: IsoDateTimeSchema,
		deployedAt: IsoDateTimeSchema.nullable(),
		extractionOpenedAt: IsoDateTimeSchema.nullable(),
		endedAt: IsoDateTimeSchema.nullable(),
		outcome: MissionAttemptOutcomeSchema.nullable()
	})
	.strict()
	.superRefine((attempt, context) => {
		if (new Set(attempt.completedObjectiveIds).size !== attempt.completedObjectiveIds.length) {
			context.addIssue({ code: 'custom', message: 'Completed mission objectives must be unique' });
		}
		const terminal = ['success', 'failure', 'retreat', 'canceled', 'death'].includes(
			attempt.status
		);
		if (terminal !== (attempt.endedAt !== null) || terminal !== (attempt.outcome !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission terminal fields are inconsistent' });
		}
		if (terminal && attempt.outcome !== attempt.status) {
			context.addIssue({ code: 'custom', message: 'Mission outcome must match terminal status' });
		}
		if (
			(attempt.status !== 'preparing' && attempt.status !== 'canceled') !==
			(attempt.deployedAt !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission deployment timestamp is inconsistent' });
		}
		if (
			(['extraction', 'success'].includes(attempt.status) && attempt.extractionOpenedAt === null) ||
			(['preparing', 'deployed', 'resolving', 'canceled'].includes(attempt.status) &&
				attempt.extractionOpenedAt !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission extraction timestamp is inconsistent' });
		}
		const positionIds = Object.keys(attempt.positions).sort();
		const memberIds = [...attempt.party.memberIds].sort();
		const positionsRequired = attempt.status !== 'preparing' && attempt.status !== 'canceled';
		if (
			positionsRequired ? positionIds.join('|') !== memberIds.join('|') : positionIds.length !== 0
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission positions must match the deployed party'
			});
		}
	});

export const MissionRunStateSchema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptSchema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Current mission attempt ordinal is inconsistent'
			});
		}
	});

export const MissionChoiceSourceSchema = z.enum(['manual', 'scripted', 'random', 'model']);

export const MissionObjectiveProgressSchema = z
	.object({
		objectiveId: MissionSlugSchema,
		status: z.enum(['available', 'carried', 'delivered']),
		carrierId: EntityIdSchema.nullable(),
		recoveredOnRound: z.number().int().positive().nullable(),
		deliveredOnRound: z.number().int().positive().nullable()
	})
	.strict()
	.superRefine((objective, context) => {
		if ((objective.status === 'carried') !== (objective.carrierId !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission objective carrier is inconsistent' });
		}
		if ((objective.status !== 'available') !== (objective.recoveredOnRound !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective recovery round is inconsistent'
			});
		}
		if ((objective.status === 'delivered') !== (objective.deliveredOnRound !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective delivery round is inconsistent'
			});
		}
	});

export const MissionTurnChoiceSchema = z
	.object({
		actorId: EntityIdSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		source: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240)
	})
	.strict()
	.superRefine((choice, context) => {
		const policyChoice = choice.source !== 'manual';
		if (
			policyChoice !== (choice.policyId !== null) ||
			policyChoice !== (choice.packetHash !== null) ||
			policyChoice !== (choice.legalActionHash !== null) ||
			policyChoice !== (choice.policyResultHash !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission choice policy evidence is inconsistent'
			});
		}
	});

export const MissionResolvedActionSchema = z
	.object({
		actorId: EntityIdSchema,
		actorKind: z.enum(['master', 'hero']),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		choiceSource: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		discoveryIds: z.array(MissionSlugSchema).max(20),
		objectiveTransition: z.enum(['recovered', 'delivered']).nullable(),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission initiative total is inconsistent'
	});

export const MissionRoundSchema = z
	.object({
		roundNumber: z.number().int().positive(),
		stateVersion: z.number().int().nonnegative(),
		environmentEventIds: z.array(MissionSlugSchema).max(20),
		monsterActionIds: z.array(z.string().min(1).max(120)).max(40),
		initiativeOrder: z.array(EntityIdSchema).min(1).max(8),
		actions: z.array(MissionResolvedActionSchema).min(1).max(8),
		statusAfter: MissionAttemptStatusSchema
	})
	.strict()
	.superRefine((round, context) => {
		if (
			round.actions.map((action) => action.actorId).join('|') !== round.initiativeOrder.join('|') ||
			new Set(round.initiativeOrder).size !== round.initiativeOrder.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission initiative order is inconsistent' });
		}
	});

export const MissionTurnStateSchema = z
	.object({
		turnVersion: z.literal('mission-turn-v1'),
		maximumRounds: z.literal(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: MissionObjectiveProgressSchema,
		rounds: z.array(MissionRoundSchema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (turn.roundNumber !== turn.rounds.length) {
			context.addIssue({ code: 'custom', message: 'Mission round history is inconsistent' });
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Mission round numbers must be contiguous' });
		}
	});

export const MissionAttemptV2Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateSchema
	})
	.strict()
	.superRefine((attempt, context) => {
		const legacyAttempt = Object.fromEntries(
			Object.entries(attempt).filter(([key]) => key !== 'turnState')
		);
		const legacy = MissionAttemptSchema.safeParse(legacyAttempt);
		if (!legacy.success) {
			context.addIssue({ code: 'custom', message: 'Mission attempt lifecycle is inconsistent' });
		}
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
			(attempt.turnState.objective.status === 'delivered')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective completion and delivery diverged'
			});
		}
		if (attempt.status === 'extraction' && attempt.turnState.objective.status !== 'delivered') {
			context.addIssue({
				code: 'custom',
				message: 'Mission extraction requires a delivered objective'
			});
		}
	});

export const MissionRunStateV2Schema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV2Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Current mission attempt ordinal is inconsistent'
			});
		}
	});

export const MissionMonsterPolicyBindingSchema = z
	.object({
		contentVersion: ContentVersionSchema,
		contentHash: StateHashSchema
	})
	.strict();

export const MissionMonsterStateSchema = z
	.object({
		monsterId: EntityIdSchema,
		dutySlotId: MissionSlugSchema,
		policyId: MissionSlugSchema,
		label: z.string().min(1).max(100),
		ordinal: z.number().int().positive().max(100),
		nodeId: MissionSlugSchema,
		status: z.enum(['active', 'defeated']),
		vitality: z.number().int().nonnegative().max(1_000),
		maximumVitality: z.number().int().positive().max(1_000),
		alertState: z.enum(['duty', 'alarmed', 'engaged']),
		defeatedOnRound: z.number().int().positive().nullable(),
		lastActionId: z
			.string()
			.regex(/^[a-z][a-z0-9._-]{1,119}$/u)
			.nullable()
	})
	.strict()
	.superRefine((monster, context) => {
		if (
			monster.vitality > monster.maximumVitality ||
			(monster.status === 'active') !== monster.vitality > 0 ||
			(monster.status === 'defeated') !== (monster.defeatedOnRound !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission monster state is inconsistent' });
		}
	});

export const MissionPartyGuardStateSchema = z
	.object({
		actorId: EntityIdSchema,
		guard: z.number().int().nonnegative().max(100),
		maximumGuard: z.number().int().positive().max(100),
		status: z.enum(['ready', 'exposed']),
		lastChangedOnRound: z.number().int().nonnegative().max(48)
	})
	.strict()
	.superRefine((guard, context) => {
		if (guard.guard > guard.maximumGuard || (guard.status === 'ready') !== guard.guard > 0) {
			context.addIssue({ code: 'custom', message: 'Mission party guard is inconsistent' });
		}
	});

export const MissionFurnaceStateSchema = z.enum(['absent', 'lit', 'cooling', 'quenched']);

export const MissionCombatArenaStateSchema = z
	.object({
		furnaceState: MissionFurnaceStateSchema,
		coolingControlNodeId: MissionSlugSchema.nullable(),
		coolingControlExposed: z.boolean()
	})
	.strict()
	.superRefine((arena, context) => {
		if (
			(arena.furnaceState === 'absent') !== (arena.coolingControlNodeId === null) ||
			(arena.coolingControlNodeId === null && arena.coolingControlExposed)
		) {
			context.addIssue({ code: 'custom', message: 'Mission furnace state is inconsistent' });
		}
	});

export const MissionMonsterIntentSchema = z
	.object({
		monsterId: EntityIdSchema,
		policyId: MissionSlugSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,119}$/u),
		kind: z.enum(['hold', 'move', 'strike', 'alarm', 'furnace-surge', 'defend-control']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		telegraph: z.string().min(1).max(240),
		anticipatedEffect: z.string().min(1).max(240)
	})
	.strict();

export const MissionResolvedEffectSchema = z
	.object({
		effectId: EntityIdSchema,
		sourceKind: z.enum(['party', 'monster', 'environment']),
		sourceId: z.string().min(1).max(120),
		targetKind: z.enum(['party', 'monster', 'arena']),
		targetId: z.string().min(1).max(120),
		kind: z.enum(['guard-damage', 'vitality-damage', 'alarm', 'furnace-change']),
		amount: z.number().int().nonnegative().max(1_000),
		before: z.number().int().nonnegative().max(1_000).nullable(),
		after: z.number().int().nonnegative().max(1_000).nullable(),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.superRefine((effect, context) => {
		const numerical = effect.kind === 'guard-damage' || effect.kind === 'vitality-damage';
		if (numerical !== (effect.before !== null && effect.after !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission effect values are inconsistent' });
		}
	});

export const MissionResolvedPartyActionV2Schema = z
	.object({
		actorId: EntityIdSchema,
		actorKind: z.enum(['master', 'hero']),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		choiceSource: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		discoveryIds: z.array(MissionSlugSchema).max(20),
		objectiveTransition: z.enum(['recovered', 'delivered']).nullable(),
		effectIds: z.array(EntityIdSchema).max(20),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission initiative total is inconsistent'
	});

export const MissionResolvedMonsterActionSchema = z
	.object({
		monsterId: EntityIdSchema,
		policyId: MissionSlugSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,119}$/u),
		kind: z.enum(['hold', 'move', 'strike', 'alarm', 'furnace-surge', 'defend-control']),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		effectIds: z.array(EntityIdSchema).max(20),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission monster initiative total is inconsistent'
	});

export const MissionRoundV2Schema = z
	.object({
		roundVersion: z.literal('mission-round-v2'),
		roundNumber: z.number().int().positive(),
		stateVersion: z.number().int().nonnegative(),
		environmentEventIds: z.array(MissionSlugSchema).max(20),
		threatIntents: z.array(MissionMonsterIntentSchema).max(40),
		monsterActionIds: z.array(z.string().min(1).max(120)).max(40),
		initiativeOrder: z.array(EntityIdSchema).min(1).max(48),
		actions: z.array(MissionResolvedPartyActionV2Schema).min(1).max(8),
		monsterActions: z.array(MissionResolvedMonsterActionSchema).max(40),
		effects: z.array(MissionResolvedEffectSchema).max(120),
		statusAfter: MissionAttemptStatusSchema
	})
	.strict()
	.superRefine((round, context) => {
		const ranked = [...round.actions, ...round.monsterActions]
			.sort(
				(left, right) =>
					right.initiative - left.initiative ||
					('actorId' in left ? left.actorId : left.monsterId).localeCompare(
						'actorId' in right ? right.actorId : right.monsterId
					)
			)
			.map((action) => ('actorId' in action ? action.actorId : action.monsterId));
		if (
			ranked.join('|') !== round.initiativeOrder.join('|') ||
			new Set(round.initiativeOrder).size !== round.initiativeOrder.length ||
			round.monsterActionIds.join('|') !==
				round.monsterActions.map((action) => action.actionId).join('|')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat initiative is inconsistent' });
		}
	});

export const MissionTurnStateV2Schema = z
	.object({
		turnVersion: z.literal('mission-turn-v2'),
		maximumRounds: z.literal(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: MissionObjectiveProgressSchema,
		policyBinding: MissionMonsterPolicyBindingSchema,
		monsters: z.record(EntityIdSchema, MissionMonsterStateSchema),
		partyGuard: z.record(EntityIdSchema, MissionPartyGuardStateSchema),
		arena: MissionCombatArenaStateSchema,
		currentThreatIntents: z.array(MissionMonsterIntentSchema).max(40),
		rounds: z.array(MissionRoundV2Schema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (turn.roundNumber !== turn.rounds.length) {
			context.addIssue({ code: 'custom', message: 'Mission combat round history is inconsistent' });
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Mission combat rounds must be contiguous' });
		}
		for (const [monsterId, monster] of Object.entries(turn.monsters)) {
			if (monster.monsterId !== monsterId) {
				context.addIssue({ code: 'custom', message: 'Mission monster key must match its id' });
			}
		}
		for (const [actorId, guard] of Object.entries(turn.partyGuard)) {
			if (guard.actorId !== actorId) {
				context.addIssue({ code: 'custom', message: 'Mission guard key must match its actor id' });
			}
		}
		if (
			turn.currentThreatIntents.some(
				(intent) => turn.monsters[intent.monsterId]?.status !== 'active'
			)
		) {
			context.addIssue({ code: 'custom', message: 'Only active monsters may telegraph intent' });
		}
	});

export const MissionAttemptV3Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateV2Schema
	})
	.strict()
	.superRefine((attempt, context) => {
		const legacyAttempt = Object.fromEntries(
			Object.entries(attempt).filter(([key]) => key !== 'turnState')
		);
		if (!MissionAttemptSchema.safeParse(legacyAttempt).success) {
			context.addIssue({ code: 'custom', message: 'Mission combat lifecycle is inconsistent' });
		}
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
			(attempt.turnState.objective.status === 'delivered')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat objective delivery diverged' });
		}
		const members = [...attempt.party.memberIds].sort().join('|');
		if (Object.keys(attempt.turnState.partyGuard).sort().join('|') !== members) {
			context.addIssue({ code: 'custom', message: 'Mission guard must match the complete party' });
		}
	});

export const MissionRunStateV3Schema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission combat attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Mission combat attempt ordinal is inconsistent'
			});
		}
	});

export const MissionEvidenceRecordSchema = z
	.object({
		evidenceId: EntityIdSchema,
		evidenceKey: MissionSlugSchema,
		holderActorId: EntityIdSchema,
		sourceBinding: MissionContentBindingSchema,
		sourceAttemptId: EntityIdSchema,
		discoveredOnRound: z.number().int().positive().max(48)
	})
	.strict();

export const MissionRunStateV4Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission evidence attempt count is inconsistent'
			});
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Mission evidence attempt ordinal is inconsistent'
			});
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Mission availability binding is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Mission evidence key must match its id' });
			}
		}
	});

export const PortalPressureStageSchema = z.enum(['stable', 'warning', 'critical', 'collapsed']);

export const PortalDepositStateSchema = z
	.object({
		depositId: MissionSlugSchema,
		nodeId: MissionSlugSchema,
		resource: z.literal('iron-ore'),
		initialAmount: z.number().int().positive().max(100),
		remainingAmount: z.number().int().nonnegative().max(100),
		mineAmountPerAction: z.number().int().positive().max(20)
	})
	.strict()
	.superRefine((deposit, context) => {
		if (
			deposit.remainingAmount > deposit.initialAmount ||
			deposit.mineAmountPerAction > deposit.initialAmount
		) {
			context.addIssue({ code: 'custom', message: 'Portal deposit state is inconsistent' });
		}
	});

export const PortalCargoStateSchema = z
	.object({
		actorId: EntityIdSchema,
		resource: z.literal('iron-ore'),
		amount: z.number().int().nonnegative().max(100),
		capacity: z.number().int().positive().max(100)
	})
	.strict()
	.refine((cargo) => cargo.amount <= cargo.capacity, {
		message: 'Portal cargo exceeds actor capacity'
	});

export const PortalOreLedgerEntrySchema = z
	.object({
		entryId: EntityIdSchema,
		sequence: z.number().int().positive().max(1_000),
		roundNumber: z.number().int().positive().max(48),
		kind: z.enum(['mined', 'extracted', 'lost']),
		actorId: EntityIdSchema,
		depositId: MissionSlugSchema.nullable(),
		nodeId: MissionSlugSchema,
		amount: z.number().int().positive().max(100),
		cargoBefore: z.number().int().nonnegative().max(100),
		cargoAfter: z.number().int().nonnegative().max(100),
		depositBefore: z.number().int().nonnegative().max(100).nullable(),
		depositAfter: z.number().int().nonnegative().max(100).nullable(),
		settlementBefore: z.number().int().nonnegative().nullable(),
		settlementAfter: z.number().int().nonnegative().nullable()
	})
	.strict()
	.superRefine((entry, context) => {
		if (
			entry.cargoBefore - entry.cargoAfter !==
			(entry.kind === 'mined' ? -entry.amount : entry.amount)
		) {
			context.addIssue({ code: 'custom', message: 'Portal ore cargo delta is inconsistent' });
		}
		if (entry.kind === 'mined') {
			if (
				entry.depositId === null ||
				entry.depositBefore === null ||
				entry.depositAfter === null ||
				entry.depositBefore - entry.depositAfter !== entry.amount ||
				entry.settlementBefore !== null ||
				entry.settlementAfter !== null
			) {
				context.addIssue({ code: 'custom', message: 'Portal mining ledger entry is inconsistent' });
			}
		} else if (
			entry.depositId !== null ||
			entry.depositBefore !== null ||
			entry.depositAfter !== null ||
			(entry.kind === 'extracted'
				? entry.settlementBefore === null ||
					entry.settlementAfter === null ||
					entry.settlementAfter - entry.settlementBefore !== entry.amount
				: entry.settlementBefore !== null || entry.settlementAfter !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal terminal ore ledger entry is inconsistent'
			});
		}
	});

export const PortalMissionObjectiveProgressSchema = z
	.object({
		objectiveId: MissionSlugSchema,
		status: z.enum(['available', 'quota-met', 'delivered']),
		quota: z.number().int().positive().max(1_000),
		minedAmount: z.number().int().nonnegative().max(10_000),
		quotaReachedOnRound: z.number().int().positive().max(48).nullable(),
		deliveredOnRound: z.number().int().positive().max(48).nullable()
	})
	.strict()
	.superRefine((objective, context) => {
		if (
			(objective.status === 'available') !== (objective.quotaReachedOnRound === null) ||
			(objective.status === 'delivered') !== (objective.deliveredOnRound !== null) ||
			(objective.status === 'available' && objective.minedAmount >= objective.quota) ||
			(objective.status !== 'available' && objective.minedAmount < objective.quota)
		) {
			context.addIssue({ code: 'custom', message: 'Portal objective progress is inconsistent' });
		}
	});

export const PortalRoundWindowSchema = z
	.object({
		roundsRemainingBefore: z.number().int().positive().max(48),
		roundsRemainingAfter: z.number().int().nonnegative().max(47),
		pressureBefore: PortalPressureStageSchema.exclude(['collapsed']),
		pressureAfter: PortalPressureStageSchema
	})
	.strict()
	.refine((window) => window.roundsRemainingBefore - window.roundsRemainingAfter === 1, {
		message: 'Portal round window must consume exactly one round'
	});

export const MissionRoundV3Schema = z
	.object({
		...MissionRoundV2Schema.shape,
		roundVersion: z.literal('mission-round-v3'),
		portalWindow: PortalRoundWindowSchema,
		oreLedgerEntryIds: z.array(EntityIdSchema).max(16)
	})
	.strict()
	.superRefine((round, context) => {
		const combatRound = Object.fromEntries(
			Object.entries(round).filter(([key]) => key !== 'portalWindow' && key !== 'oreLedgerEntryIds')
		);
		const combat = MissionRoundV2Schema.safeParse({
			...combatRound,
			roundVersion: 'mission-round-v2'
		});
		if (!combat.success) {
			context.addIssue({ code: 'custom', message: 'Portal round combat ledger is inconsistent' });
		}
		if (new Set(round.oreLedgerEntryIds).size !== round.oreLedgerEntryIds.length) {
			context.addIssue({ code: 'custom', message: 'Portal round ore ledger ids must be unique' });
		}
	});

export const PortalMissionStateSchema = z
	.object({
		portalVersion: z.literal('portal-runtime-v1'),
		portalId: MissionSlugSchema,
		durationRounds: z.number().int().min(3).max(48),
		roundsRemaining: z.number().int().nonnegative().max(48),
		warningAtRemainingRounds: z.number().int().positive().max(47),
		criticalAtRemainingRounds: z.number().int().positive().max(46),
		pressureStage: PortalPressureStageSchema,
		extractionQuota: z.number().int().positive().max(1_000),
		cargoCapacityPerActor: z.number().int().positive().max(100),
		deposits: z.record(MissionSlugSchema, PortalDepositStateSchema),
		cargo: z.record(EntityIdSchema, PortalCargoStateSchema),
		oreLedger: z.array(PortalOreLedgerEntrySchema).max(1_000),
		extractedAmount: z.number().int().nonnegative().max(10_000),
		extractionCredited: z.boolean()
	})
	.strict()
	.superRefine((portal, context) => {
		if (
			portal.warningAtRemainingRounds >= portal.durationRounds ||
			portal.criticalAtRemainingRounds >= portal.warningAtRemainingRounds
		) {
			context.addIssue({ code: 'custom', message: 'Portal runtime thresholds are inconsistent' });
		}
		const expectedPressure =
			portal.roundsRemaining === 0
				? 'collapsed'
				: portal.roundsRemaining <= portal.criticalAtRemainingRounds
					? 'critical'
					: portal.roundsRemaining <= portal.warningAtRemainingRounds
						? 'warning'
						: 'stable';
		if (portal.pressureStage !== expectedPressure) {
			context.addIssue({
				code: 'custom',
				message: 'Portal pressure stage diverged from its timer'
			});
		}
		for (const [depositId, deposit] of Object.entries(portal.deposits)) {
			if (deposit.depositId !== depositId) {
				context.addIssue({ code: 'custom', message: 'Portal deposit key must match its id' });
			}
		}
		for (const [actorId, cargo] of Object.entries(portal.cargo)) {
			if (cargo.actorId !== actorId || cargo.capacity !== portal.cargoCapacityPerActor) {
				context.addIssue({ code: 'custom', message: 'Portal cargo holder is inconsistent' });
			}
		}
		if (portal.oreLedger.some((entry, index) => entry.sequence !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Portal ore ledger sequence is inconsistent' });
		}
		const extracted = portal.oreLedger
			.filter((entry) => entry.kind === 'extracted')
			.reduce((sum, entry) => sum + entry.amount, 0);
		if (portal.extractedAmount !== extracted || portal.extractionCredited !== extracted > 0) {
			context.addIssue({ code: 'custom', message: 'Portal extracted ore total is inconsistent' });
		}
	});

export const MissionTurnStateV3Schema = z
	.object({
		turnVersion: z.literal('mission-turn-v3'),
		maximumRounds: z.number().int().min(3).max(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: PortalMissionObjectiveProgressSchema,
		policyBinding: MissionMonsterPolicyBindingSchema,
		monsters: z.record(EntityIdSchema, MissionMonsterStateSchema),
		partyGuard: z.record(EntityIdSchema, MissionPartyGuardStateSchema),
		arena: MissionCombatArenaStateSchema,
		currentThreatIntents: z.array(MissionMonsterIntentSchema).max(40),
		portal: PortalMissionStateSchema,
		rounds: z.array(MissionRoundV3Schema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (
			turn.roundNumber !== turn.rounds.length ||
			turn.maximumRounds !== turn.portal.durationRounds ||
			turn.portal.roundsRemaining !== turn.maximumRounds - turn.roundNumber
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal turn history and timer are inconsistent'
			});
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Portal rounds must be contiguous' });
		}
		for (const [monsterId, monster] of Object.entries(turn.monsters)) {
			if (monster.monsterId !== monsterId) {
				context.addIssue({ code: 'custom', message: 'Portal monster key must match its id' });
			}
		}
	});

export const MissionAttemptV4Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateV3Schema
	})
	.strict()
	.superRefine((attempt, context) => {
		const lifecycle = MissionAttemptSchema.safeParse(
			Object.fromEntries(Object.entries(attempt).filter(([key]) => key !== 'turnState'))
		);
		if (!lifecycle.success) {
			context.addIssue({ code: 'custom', message: 'Portal mission lifecycle is inconsistent' });
		}
		const memberIds = [...attempt.party.memberIds].sort().join('|');
		if (
			Object.keys(attempt.turnState.partyGuard).sort().join('|') !== memberIds ||
			Object.keys(attempt.turnState.portal.cargo).sort().join('|') !== memberIds
		) {
			context.addIssue({ code: 'custom', message: 'Portal party state must match every member' });
		}
		const delivered = attempt.turnState.objective.status === 'delivered';
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
				delivered ||
			(attempt.status === 'extraction' && !delivered) ||
			(attempt.status === 'failure') !== (attempt.turnState.portal.pressureStage === 'collapsed') ||
			(attempt.status === 'success') !== attempt.turnState.portal.extractionCredited
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission outcome is inconsistent' });
		}
	});

export const MissionRunStateV5Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV4Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if (
			(mission.attempt === null) !== (mission.attemptCount === 0) ||
			(mission.attempt !== null && mission.attempt.ordinal !== mission.attemptCount)
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission attempt count is inconsistent' });
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission availability is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Portal evidence key must match its id' });
			}
		}
	});

export const MissionItemWearSchema = z
	.object({
		itemId: EntityIdSchema,
		durabilityBefore: z.number().int().nonnegative().max(100),
		durabilityAfter: z.number().int().nonnegative().max(100)
	})
	.strict()
	.refine((wear) => wear.durabilityBefore - wear.durabilityAfter === 1, {
		message: 'Mission equipment wear must consume exactly one durability'
	});

export const MissionHarmWitnessSchema = z
	.object({
		heroId: EntityIdSchema,
		observationId: EntityIdSchema,
		relationshipId: EntityIdSchema
	})
	.strict();

export const MissionHarmRecordSchema = z
	.object({
		consequenceId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		sourceKind: z.enum(['monster', 'environment']),
		sourceId: z.string().min(1).max(120),
		targetHeroId: EntityIdSchema,
		nodeId: MissionSlugSchema,
		roundNumber: z.number().int().positive().max(48),
		guardAfterImpact: z.literal(0),
		healthBefore: z.number().int().positive().max(100),
		healthAfter: z.number().int().nonnegative().max(100),
		damage: z.number().int().positive().max(100),
		injury: InjurySchema.nullable(),
		itemWear: MissionItemWearSchema.nullable(),
		fatal: z.boolean(),
		witnesses: z.array(MissionHarmWitnessSchema).max(7),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.superRefine((harm, context) => {
		if (
			harm.healthBefore - harm.healthAfter !== harm.damage ||
			harm.fatal !== (harm.healthAfter === 0) ||
			(harm.fatal && harm.injury !== null) ||
			(!harm.fatal && harm.injury === null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission bodily harm is inconsistent' });
		}
		if (new Set(harm.witnesses.map((witness) => witness.heroId)).size !== harm.witnesses.length) {
			context.addIssue({ code: 'custom', message: 'Mission harm witnesses must be unique' });
		}
	});

export const MissionMasterHarmRecordSchema = z
	.object({
		consequenceKind: z.literal('master-harm'),
		consequenceId: EntityIdSchema,
		sourceEventId: EntityIdSchema,
		sourceKind: z.enum(['monster', 'environment']),
		sourceId: z.string().min(1).max(120),
		targetMasterId: EntityIdSchema,
		nodeId: MissionSlugSchema,
		roundNumber: z.number().int().positive().max(48),
		guardAfterImpact: z.literal(0),
		healthBefore: z.number().int().positive().max(100),
		healthAfter: z.number().int().nonnegative().max(100),
		damage: z.number().int().positive().max(100),
		injury: InjurySchema.nullable(),
		fatal: z.boolean(),
		witnesses: z.array(MissionHarmWitnessSchema).max(7),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.superRefine((harm, context) => {
		if (
			harm.healthBefore - harm.healthAfter !== harm.damage ||
			harm.fatal !== (harm.healthAfter === 0) ||
			(harm.fatal && harm.injury !== null) ||
			(!harm.fatal && harm.injury === null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission Master harm is inconsistent' });
		}
		if (new Set(harm.witnesses.map((witness) => witness.heroId)).size !== harm.witnesses.length) {
			context.addIssue({ code: 'custom', message: 'Mission Master harm witnesses must be unique' });
		}
	});

export const MissionConsequenceRecordV2Schema = z.union([
	MissionHarmRecordSchema,
	MissionMasterHarmRecordSchema
]);

export const MissionHarmRecordV2Schema = MissionHarmRecordSchema.safeExtend({
	sourceAttemptId: EntityIdSchema
});

const CapabilityHealthSchema = z.number().int().nonnegative().max(10_000);

export const MissionHarmRecordV3Schema = MissionHarmRecordV2Schema.safeExtend({
	healthBefore: CapabilityHealthSchema.positive(),
	healthAfter: CapabilityHealthSchema,
	damage: CapabilityHealthSchema.positive()
});

export const MissionMasterHarmRecordV2Schema = MissionMasterHarmRecordSchema.safeExtend({
	sourceAttemptId: EntityIdSchema
});

export const MissionConsequenceRecordV3Schema = z.union([
	MissionHarmRecordV2Schema,
	MissionMasterHarmRecordV2Schema
]);

export const MissionConsequenceRecordV4Schema = z.union([
	MissionHarmRecordV3Schema,
	MissionMasterHarmRecordV2Schema
]);

export const MissionAftermathStateSchema = z
	.object({
		aftermathVersion: z.literal('mission-aftermath-v1'),
		consequences: z.array(MissionHarmRecordSchema).max(1_000)
	})
	.strict()
	.superRefine((aftermath, context) => {
		if (
			new Set(aftermath.consequences.map((consequence) => consequence.consequenceId)).size !==
			aftermath.consequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission consequences must be unique' });
		}
	});

export const MissionRunStateV6Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		aftermath: MissionAftermathStateSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		const evidenceMission = MissionRunStateV4Schema.safeParse(
			Object.fromEntries(Object.entries(mission).filter(([key]) => key !== 'aftermath'))
		);
		if (!evidenceMission.success) {
			context.addIssue({ code: 'custom', message: 'Mission aftermath lifecycle is inconsistent' });
		}
		for (const consequence of mission.aftermath.consequences) {
			if (!mission.attempt || consequence.roundNumber > mission.attempt.turnState.roundNumber) {
				context.addIssue({
					code: 'custom',
					message: 'Mission consequence exceeds attempt history'
				});
			}
		}
	});

export const MissionAftermathStateV2Schema = z
	.object({
		aftermathVersion: z.literal('mission-aftermath-v2'),
		consequences: z.array(MissionConsequenceRecordV2Schema).max(1_000)
	})
	.strict()
	.superRefine((aftermath, context) => {
		if (
			new Set(aftermath.consequences.map((consequence) => consequence.consequenceId)).size !==
			aftermath.consequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission consequences must be unique' });
		}
	});

export const MissionRunStateV7Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		aftermath: MissionAftermathStateV2Schema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		const evidenceMission = MissionRunStateV4Schema.safeParse(
			Object.fromEntries(Object.entries(mission).filter(([key]) => key !== 'aftermath'))
		);
		if (!evidenceMission.success) {
			context.addIssue({
				code: 'custom',
				message: 'Mission Master aftermath lifecycle is inconsistent'
			});
		}
		for (const consequence of mission.aftermath.consequences) {
			if (!mission.attempt || consequence.roundNumber > mission.attempt.turnState.roundNumber) {
				context.addIssue({
					code: 'custom',
					message: 'Mission consequence exceeds attempt history'
				});
			}
		}
	});

export const MissionAttemptAftermathArchiveSchema = z
	.object({
		attemptId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		binding: MissionContentBindingSchema,
		outcome: MissionAttemptOutcomeSchema,
		preparedAt: IsoDateTimeSchema,
		deployedAt: IsoDateTimeSchema.nullable(),
		endedAt: IsoDateTimeSchema,
		finalRoundNumber: z.number().int().nonnegative().max(48),
		consequences: z.array(MissionConsequenceRecordV3Schema).max(1_000)
	})
	.strict()
	.superRefine((archive, context) => {
		for (const consequence of archive.consequences) {
			if (
				consequence.sourceAttemptId !== archive.attemptId ||
				consequence.roundNumber > archive.finalRoundNumber
			) {
				context.addIssue({
					code: 'custom',
					message: 'Archived mission consequence exceeds its source attempt'
				});
			}
		}
	});

export const MissionAftermathStateV3Schema = z
	.object({
		aftermathVersion: z.literal('mission-aftermath-v3'),
		activeAttemptId: EntityIdSchema.nullable(),
		consequences: z.array(MissionConsequenceRecordV3Schema).max(1_000),
		archives: z.array(MissionAttemptAftermathArchiveSchema).max(100)
	})
	.strict()
	.superRefine((aftermath, context) => {
		const allConsequences = [
			...aftermath.consequences,
			...aftermath.archives.flatMap((archive) => archive.consequences)
		];
		if (
			new Set(allConsequences.map((consequence) => consequence.consequenceId)).size !==
			allConsequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission consequences must be unique' });
		}
		if (allConsequences.length > 1_000) {
			context.addIssue({
				code: 'custom',
				message: 'Mission consequence history exceeds its bounded archive'
			});
		}
		if (
			new Set(aftermath.archives.map((archive) => archive.attemptId)).size !==
			aftermath.archives.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission aftermath archives must be unique' });
		}
		if (
			aftermath.activeAttemptId !== null &&
			aftermath.archives.some((archive) => archive.attemptId === aftermath.activeAttemptId)
		) {
			context.addIssue({
				code: 'custom',
				message: 'The active mission attempt cannot already be archived'
			});
		}
	});

export const MissionRunStateV8Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		aftermath: MissionAftermathStateV3Schema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		const evidenceMission = MissionRunStateV4Schema.safeParse(
			Object.fromEntries(Object.entries(mission).filter(([key]) => key !== 'aftermath'))
		);
		if (!evidenceMission.success) {
			context.addIssue({
				code: 'custom',
				message: 'Mission attempt aftermath lifecycle is inconsistent'
			});
		}
		if ((mission.attempt?.attemptId ?? null) !== mission.aftermath.activeAttemptId) {
			context.addIssue({
				code: 'custom',
				message: 'Mission aftermath must identify the active attempt'
			});
		}
		for (const consequence of mission.aftermath.consequences) {
			if (
				!mission.attempt ||
				consequence.sourceAttemptId !== mission.attempt.attemptId ||
				consequence.roundNumber > mission.attempt.turnState.roundNumber
			) {
				context.addIssue({
					code: 'custom',
					message: 'Mission consequence exceeds its active source attempt'
				});
			}
		}
	});

export const MissionAttemptV9Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateV2Schema,
		combatModeBinding: CombatModeBindingSchema
	})
	.strict()
	.superRefine((attempt, context) => {
		const legacyAttempt = Object.fromEntries(
			Object.entries(attempt).filter(([key]) => key !== 'turnState' && key !== 'combatModeBinding')
		);
		if (!MissionAttemptSchema.safeParse(legacyAttempt).success) {
			context.addIssue({ code: 'custom', message: 'Mission combat lifecycle is inconsistent' });
		}
		if (attempt.combatModeBinding.boundAt !== attempt.preparedAt) {
			context.addIssue({
				code: 'custom',
				message: 'Combat mode must bind exactly when mission preparation begins'
			});
		}
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
			(attempt.turnState.objective.status === 'delivered')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat objective delivery diverged' });
		}
		const members = [...attempt.party.memberIds].sort().join('|');
		if (Object.keys(attempt.turnState.partyGuard).sort().join('|') !== members) {
			context.addIssue({ code: 'custom', message: 'Mission guard must match the complete party' });
		}
	});

export const MissionAttemptAftermathArchiveV2Schema = z
	.object({
		attemptId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		binding: MissionContentBindingSchema,
		combatModeBinding: CombatModeBindingSchema,
		outcome: MissionAttemptOutcomeSchema,
		preparedAt: IsoDateTimeSchema,
		deployedAt: IsoDateTimeSchema.nullable(),
		endedAt: IsoDateTimeSchema,
		finalRoundNumber: z.number().int().nonnegative().max(48),
		consequences: z.array(MissionConsequenceRecordV4Schema).max(1_000)
	})
	.strict()
	.superRefine((archive, context) => {
		if (archive.combatModeBinding.boundAt !== archive.preparedAt) {
			context.addIssue({ code: 'custom', message: 'Archived combat mode binding time diverged' });
		}
		for (const consequence of archive.consequences) {
			if (
				consequence.sourceAttemptId !== archive.attemptId ||
				consequence.roundNumber > archive.finalRoundNumber
			) {
				context.addIssue({
					code: 'custom',
					message: 'Archived mission consequence exceeds its source attempt'
				});
			}
		}
	});

export const MissionAftermathStateV4Schema = z
	.object({
		aftermathVersion: z.literal('mission-aftermath-v4'),
		activeAttemptId: EntityIdSchema.nullable(),
		consequences: z.array(MissionConsequenceRecordV4Schema).max(1_000),
		archives: z.array(MissionAttemptAftermathArchiveV2Schema).max(100)
	})
	.strict()
	.superRefine((aftermath, context) => {
		const allConsequences = [
			...aftermath.consequences,
			...aftermath.archives.flatMap((archive) => archive.consequences)
		];
		if (
			new Set(allConsequences.map((consequence) => consequence.consequenceId)).size !==
			allConsequences.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission consequences must be unique' });
		}
		if (allConsequences.length > 1_000) {
			context.addIssue({
				code: 'custom',
				message: 'Mission consequence history exceeds its bound'
			});
		}
		if (
			new Set(aftermath.archives.map((archive) => archive.attemptId)).size !==
			aftermath.archives.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission aftermath archives must be unique' });
		}
		if (
			aftermath.activeAttemptId !== null &&
			aftermath.archives.some((archive) => archive.attemptId === aftermath.activeAttemptId)
		) {
			context.addIssue({ code: 'custom', message: 'Active attempt cannot already be archived' });
		}
	});

export const MissionRunStateV9Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		aftermath: MissionAftermathStateV4Schema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV9Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if (
			(mission.attempt === null) !== (mission.attemptCount === 0) ||
			(mission.attempt !== null && mission.attempt.ordinal !== mission.attemptCount)
		) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Mission availability binding is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Mission evidence key must match its id' });
			}
		}
		if ((mission.attempt?.attemptId ?? null) !== mission.aftermath.activeAttemptId) {
			context.addIssue({
				code: 'custom',
				message: 'Mission aftermath must identify active attempt'
			});
		}
		for (const consequence of mission.aftermath.consequences) {
			if (
				!mission.attempt ||
				consequence.sourceAttemptId !== mission.attempt.attemptId ||
				consequence.roundNumber > mission.attempt.turnState.roundNumber
			) {
				context.addIssue({ code: 'custom', message: 'Mission consequence exceeds active attempt' });
			}
		}
	});

export const MissionCombatStateV1Schema = z.discriminatedUnion('modeId', [
	z
		.object({
			modeId: z.literal('legacy-auto-v1'),
			turnState: MissionTurnStateV2Schema
		})
		.strict(),
	z
		.object({
			modeId: z.literal('agent-readiness-v1'),
			readinessState: ReadinessCombatStateV1Schema
		})
		.strict()
]);

export const MissionAttemptV10Schema = z
	.object({
		...MissionAttemptSchema.shape,
		combatModeBinding: CombatModeBindingSchema,
		combatState: MissionCombatStateV1Schema
	})
	.strict()
	.superRefine((attempt, context) => {
		const baseAttempt = Object.fromEntries(
			Object.entries(attempt).filter(
				([key]) => key !== 'combatModeBinding' && key !== 'combatState'
			)
		);
		if (!MissionAttemptSchema.safeParse(baseAttempt).success) {
			context.addIssue({ code: 'custom', message: 'Mission combat lifecycle is inconsistent' });
		}
		if (attempt.combatModeBinding.boundAt !== attempt.preparedAt) {
			context.addIssue({
				code: 'custom',
				path: ['combatModeBinding', 'boundAt'],
				message: 'Combat mode must bind exactly when mission preparation begins'
			});
		}
		if (attempt.combatModeBinding.modeId !== attempt.combatState.modeId) {
			context.addIssue({
				code: 'custom',
				path: ['combatState', 'modeId'],
				message: 'Mission combat state must match its immutable mode binding'
			});
		}
		if (attempt.combatState.modeId === 'agent-readiness-v1') {
			if (attempt.combatState.readinessState.attemptId !== attempt.attemptId) {
				context.addIssue({
					code: 'custom',
					path: ['combatState', 'readinessState', 'attemptId'],
					message: 'Readiness combat state must belong to its mission attempt'
				});
			}
			return;
		}
		const turnState = attempt.combatState.turnState;
		if (
			attempt.completedObjectiveIds.includes(turnState.objective.objectiveId) !==
			(turnState.objective.status === 'delivered')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat objective delivery diverged' });
		}
		const members = [...attempt.party.memberIds].sort().join('|');
		if (Object.keys(turnState.partyGuard).sort().join('|') !== members) {
			context.addIssue({ code: 'custom', message: 'Mission guard must match the complete party' });
		}
	});

export const MissionRunStateV10Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		aftermath: MissionAftermathStateV4Schema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV10Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if (
			(mission.attempt === null) !== (mission.attemptCount === 0) ||
			(mission.attempt !== null && mission.attempt.ordinal !== mission.attemptCount)
		) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Mission availability binding is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Mission evidence key must match its id' });
			}
		}
		if ((mission.attempt?.attemptId ?? null) !== mission.aftermath.activeAttemptId) {
			context.addIssue({ code: 'custom', message: 'Mission aftermath must identify active attempt' });
		}
		for (const consequence of mission.aftermath.consequences) {
			if (!mission.attempt || consequence.sourceAttemptId !== mission.attempt.attemptId) {
				context.addIssue({ code: 'custom', message: 'Mission consequence exceeds active attempt' });
			} else if (
				mission.attempt.combatState.modeId === 'legacy-auto-v1' &&
				consequence.roundNumber > mission.attempt.combatState.turnState.roundNumber
			) {
				context.addIssue({ code: 'custom', message: 'Mission consequence exceeds active legacy turn' });
			}
		}
	});

export type MissionAttempt = z.infer<typeof MissionAttemptSchema>;
export type MissionAttemptStatus = z.infer<typeof MissionAttemptStatusSchema>;
export type MissionRound = z.infer<typeof MissionRoundSchema>;
export type MissionRoundV2 = z.infer<typeof MissionRoundV2Schema>;
export type MissionMonsterIntent = z.infer<typeof MissionMonsterIntentSchema>;
export type MissionMonsterState = z.infer<typeof MissionMonsterStateSchema>;
export type MissionResolvedEffect = z.infer<typeof MissionResolvedEffectSchema>;
export type MissionTurnChoice = z.infer<typeof MissionTurnChoiceSchema>;
export type MissionRunState = z.infer<typeof MissionRunStateSchema>;
export type MissionRunStateV2 = z.infer<typeof MissionRunStateV2Schema>;
export type MissionRunStateV3 = z.infer<typeof MissionRunStateV3Schema>;
export type MissionRunStateV4 = z.infer<typeof MissionRunStateV4Schema>;
export type MissionRunStateV5 = z.infer<typeof MissionRunStateV5Schema>;
export type MissionRunStateV6 = z.infer<typeof MissionRunStateV6Schema>;
export type MissionRunStateV7 = z.infer<typeof MissionRunStateV7Schema>;
export type MissionRunStateV8 = z.infer<typeof MissionRunStateV8Schema>;
export type CombatModeId = z.infer<typeof CombatModeIdSchema>;
export type CombatModeBinding = z.infer<typeof CombatModeBindingSchema>;
export type MissionAttemptV9 = z.infer<typeof MissionAttemptV9Schema>;
export type MissionRunStateV9 = z.infer<typeof MissionRunStateV9Schema>;
export type MissionCombatStateV1 = z.infer<typeof MissionCombatStateV1Schema>;
export type MissionAttemptV10 = z.infer<typeof MissionAttemptV10Schema>;
export type MissionRunStateV10 = z.infer<typeof MissionRunStateV10Schema>;
export type MissionHarmRecord = z.infer<typeof MissionHarmRecordSchema>;
export type MissionHarmRecordV2 = z.infer<typeof MissionHarmRecordV2Schema>;
export type MissionHarmRecordV3 = z.infer<typeof MissionHarmRecordV3Schema>;
export type MissionMasterHarmRecord = z.infer<typeof MissionMasterHarmRecordSchema>;
export type MissionMasterHarmRecordV2 = z.infer<typeof MissionMasterHarmRecordV2Schema>;
export type MissionConsequenceRecordV2 = z.infer<typeof MissionConsequenceRecordV2Schema>;
export type MissionConsequenceRecordV3 = z.infer<typeof MissionConsequenceRecordV3Schema>;
export type MissionConsequenceRecordV4 = z.infer<typeof MissionConsequenceRecordV4Schema>;
export type MissionEvidenceRecord = z.infer<typeof MissionEvidenceRecordSchema>;
export type MissionRoundV3 = z.infer<typeof MissionRoundV3Schema>;
export type PortalMissionState = z.infer<typeof PortalMissionStateSchema>;
export type PortalOreLedgerEntry = z.infer<typeof PortalOreLedgerEntrySchema>;
