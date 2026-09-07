import { describe, expect, it } from 'vitest';

import {
	ActorDecisionViewSchema,
	CombatAdvanceSchema,
	CombatChoiceBatchV1Schema,
	CombatClaimSchema,
	CombatResolvedEventSchema,
	CombatResultSchema,
	CombatSafetyStopSchema,
	CombatWindowSnapshotSchema,
	ReadinessCombatStateV1Schema
} from './readiness-combat.js';
import { ApplyCombatChoiceBatchCommandSchema } from './engine/commands.js';
import { MissionAttemptV10Schema } from './engine/mission-state.js';
import { CombatChoiceBatchAppliedEventSchema } from './event.js';

const ID = {
	attempt: '10000000-0000-4000-8000-000000000001',
	window: '10000000-0000-4000-8000-000000000002',
	hero: '10000000-0000-4000-8000-000000000003',
	monster: '10000000-0000-4000-8000-000000000004',
	action: '10000000-0000-4000-8000-000000000005',
	event: '10000000-0000-4000-8000-000000000006',
	claim: '10000000-0000-4000-8000-000000000007',
	master: '10000000-0000-4000-8000-000000000008'
} as const;

const HASH = {
	state: '1'.repeat(64),
	snapshot: '2'.repeat(64),
	view: '3'.repeat(64),
	legal: '4'.repeat(64),
	batch: '5'.repeat(64),
	content: '6'.repeat(64),
	trace: '7'.repeat(64)
} as const;

const hero = {
	combatantId: ID.hero,
	combatantKind: 'hero',
	teamId: 'party',
	position: { x: 1, y: 1 },
	resources: {
		health: { current: 120, maximum: 120 },
		mana: { current: 40, maximum: 50 }
	},
	lastDamagedAtTick: 2,
	attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
	armour: 10,
	resistances: { cut: 500 },
	readiness: {
		value: 10_000,
		exactNumerator: 10_000,
		recoveryUntilTick: 12
	},
	conditions: [
		{
			conditionId: 'burning',
			stacks: 1,
			appliedAtTick: 2,
			expiresAtTick: 8,
			sourceCombatantId: ID.monster
		}
	],
	cooldowns: { 'combat-skill-cleaving-step': 16 },
	downed: false,
	active: true
} as const;

const monster = {
	...hero,
	combatantId: ID.monster,
	combatantKind: 'monster',
	teamId: 'enemy',
	position: { x: 3, y: 1 },
	conditions: [],
	cooldowns: {},
	readiness: { value: 9_900, exactNumerator: 9_900, recoveryUntilTick: 0 },
	lastDamagedAtTick: null
} as const;

const terrain = {
	width: 8,
	height: 8,
	blockedTiles: [{ x: 0, y: 0 }],
	features: [{ featureId: 'pillar-a', kind: 'cover', position: { x: 4, y: 4 } }]
} as const;

const telegraph = {
	telegraphId: 'falling-stone',
	sourceCombatantId: ID.monster,
	target: { kind: 'tile', position: { x: 2, y: 2 } },
	resolvesAtTick: 18,
	publicLabel: 'Falling stone'
} as const;

const legalAction = {
	actionId: 'cleaving-step',
	actionInstanceId: ID.action,
	actionKind: 'skill',
	skillId: 'combat-skill-cleaving-step',
	publicLabel: 'Cleaving Step',
	targetContract: { kind: 'entity', allowedCombatantIds: [ID.monster] },
	reactionPriority: 0,
	recoveryTicks: 8,
	manaCost: 4,
	fallbackOptions: [
		{
			fallbackId: 'hold-ground',
			publicLabel: 'Hold ground',
			target: { kind: 'self' }
		}
	]
} as const;

const intent = {
	windowId: ID.window,
	attemptId: ID.attempt,
	tick: 12,
	actorId: ID.hero,
	snapshotHash: HASH.snapshot,
	actorViewHash: HASH.view,
	legalActionSetHash: HASH.legal,
	actionId: legalAction.actionId,
	target: { kind: 'entity', combatantId: ID.monster },
	fallbackId: 'hold-ground',
	publicIntent: 'I will draw it away from the gate.'
} as const;

const snapshot = {
	snapshotVersion: 'combat-window-v1',
	windowId: ID.window,
	attemptId: ID.attempt,
	tick: 12,
	readyActorIds: [ID.hero],
	combatants: { [ID.hero]: hero, [ID.monster]: monster },
	terrain,
	visibleTelegraphs: [telegraph],
	rulesVersion: 'combat-rules-v1',
	contentHash: HASH.content,
	stateHash: HASH.state,
	snapshotHash: HASH.snapshot
} as const;

const selfView = {
	combatantId: ID.hero,
	combatantKind: 'hero',
	teamId: 'party',
	position: { x: 1, y: 1 },
	resources: hero.resources,
	conditions: [{ conditionId: 'burning', stacks: 1, remainingTicks: 6, publicLabel: 'Burning' }],
	readiness: { ready: true, recoveryTicksRemaining: 0 },
	downed: false,
	active: true
} as const;

const visibleMonsterView = {
	combatantId: ID.monster,
	combatantKind: 'monster',
	teamId: 'enemy',
	position: { x: 3, y: 1 },
	resources: monster.resources,
	conditions: [],
	readinessStatus: 'recovering',
	downed: false,
	active: true
} as const;

const view = {
	viewVersion: 'actor-decision-view-v1',
	windowId: ID.window,
	actorId: ID.hero,
	snapshotHash: HASH.snapshot,
	actorViewHash: HASH.view,
	legalActionSetHash: HASH.legal,
	self: selfView,
	visibleCombatants: [visibleMonsterView],
	visibleTerrain: terrain,
	visibleTelegraphs: [telegraph],
	rememberedContext: ['The enemy favors the eastern lane.'],
	doctrine: ['Protect the Master.'],
	relationships: [{ entityId: ID.monster, publicSummary: 'A known threat.' }],
	masterDirections: ['Hold the gate.'],
	legalActions: [legalAction]
} as const;

const state = {
	stateVersion: 'readiness-combat-state-v1',
	seed: 'a'.repeat(64),
	attemptId: ID.attempt,
	tick: 12,
	combatants: { [ID.hero]: hero, [ID.monster]: monster },
	terrain,
	visibleTelegraphs: [telegraph],
	scheduledEffects: [],
	safety: { ticksAdvanced: 12, eventsEmitted: 0, noProgressCycles: 0 },
	status: 'active',
	result: null
} as const;

describe('readiness combat contracts', () => {
	it('accepts a bounded canonical readiness state and rejects unknown state fields', () => {
		expect(ReadinessCombatStateV1Schema.parse(state)).toStrictEqual(state);
		expect(
			ReadinessCombatStateV1Schema.safeParse({ ...state, seed: 'provider-visible' }).success
		).toBe(false);
		expect(ReadinessCombatStateV1Schema.safeParse({ ...state, seed: 'A'.repeat(64) }).success).toBe(
			false
		);
	});

	it('validates positions, resources, readiness, and condition timing', () => {
		expect(
			ReadinessCombatStateV1Schema.safeParse({
				...state,
				combatants: {
					...state.combatants,
					[ID.hero]: {
						...hero,
						readiness: { ...hero.readiness, value: 10_000, exactNumerator: 9_999 }
					}
				}
			}).success
		).toBe(false);
		expect(
			ReadinessCombatStateV1Schema.safeParse({
				...state,
				combatants: {
					...state.combatants,
					[ID.hero]: { ...hero, lastDamagedAtTick: state.tick + 1 }
				}
			}).success
		).toBe(false);
		expect(
			ReadinessCombatStateV1Schema.safeParse({
				...state,
				combatants: {
					...state.combatants,
					[ID.hero]: { ...hero, position: { x: 8, y: 1 } }
				}
			}).success
		).toBe(false);
		expect(
			ReadinessCombatStateV1Schema.safeParse({
				...state,
				combatants: {
					...state.combatants,
					[ID.hero]: {
						...hero,
						resources: { ...hero.resources, health: { current: 121, maximum: 120 } }
					}
				}
			}).success
		).toBe(false);
		expect(
			ReadinessCombatStateV1Schema.safeParse({
				...state,
				combatants: {
					...state.combatants,
					[ID.hero]: {
						...hero,
						conditions: [{ ...hero.conditions[0], expiresAtTick: 1 }]
					}
				}
			}).success
		).toBe(false);
	});

	it('accepts one frozen window and rejects a cohort outside its combatant truth', () => {
		expect(CombatWindowSnapshotSchema.parse(snapshot)).toStrictEqual(snapshot);
		expect(CombatWindowSnapshotSchema.safeParse({ ...snapshot, seed: state.seed }).success).toBe(
			false
		);
		expect(
			CombatWindowSnapshotSchema.safeParse({ ...snapshot, readyActorIds: [ID.action] }).success
		).toBe(false);
	});

	it('keeps actor views perception-filtered and legal choices effect-free', () => {
		expect(ActorDecisionViewSchema.parse(view)).toStrictEqual(view);
		expect(
			ActorDecisionViewSchema.safeParse({ ...view, seed: 'hidden', unresolvedChoices: [intent] })
				.success
		).toBe(false);
		expect(
			ActorDecisionViewSchema.safeParse({
				...view,
				legalActions: [{ ...legalAction, damage: 9001 }]
			}).success
		).toBe(false);
		expect(ActorDecisionViewSchema.safeParse({ ...view, self: hero }).success).toBe(false);
		expect(
			ActorDecisionViewSchema.safeParse({ ...view, visibleCombatants: [monster] }).success
		).toBe(false);
	});

	it('binds one strict choice batch to its frozen window', () => {
		const batch = {
			batchVersion: 'combat-choice-batch-v1',
			batchId: ID.action,
			windowId: ID.window,
			attemptId: ID.attempt,
			tick: 12,
			snapshotHash: HASH.snapshot,
			choices: [intent],
			batchHash: HASH.batch
		} as const;
		expect(CombatChoiceBatchV1Schema.parse(batch)).toStrictEqual(batch);
		expect(
			CombatChoiceBatchV1Schema.safeParse({
				...batch,
				choices: [{ ...intent, damage: 999, hit: true }]
			}).success
		).toBe(false);
		for (const contradictoryChoice of [
			{ ...intent, attemptId: ID.event },
			{ ...intent, tick: 13 },
			{ ...intent, windowId: ID.event },
			{ ...intent, snapshotHash: HASH.state }
		]) {
			expect(
				CombatChoiceBatchV1Schema.safeParse({ ...batch, choices: [contradictoryChoice] }).success
			).toBe(false);
		}
	});

	it('validates typed resolved effects without admitting an open payload', () => {
		const event = {
			eventVersion: 'combat-resolved-event-v1',
			eventId: ID.event,
			attemptId: ID.attempt,
			windowId: ID.window,
			tick: 12,
			actorId: ID.hero,
			actionId: legalAction.actionId,
			snapshotHash: HASH.snapshot,
			actorViewHash: HASH.view,
			legalActionSetHash: HASH.legal,
			originalIntent: intent,
			conflictingEventId: null,
			fallbackApplied: null,
			finalOutcome: 'applied',
			effects: [
				{
					kind: 'resource',
					combatantId: ID.monster,
					resource: 'health',
					before: 120,
					after: 92,
					delta: -28
				}
			]
		} as const;
		expect(CombatResolvedEventSchema.parse(event)).toStrictEqual(event);
		expect(CombatResolvedEventSchema.safeParse({ ...event, payload: { damage: 28 } }).success).toBe(
			false
		);
		for (const contradictoryEvent of [
			{ ...event, attemptId: ID.event },
			{ ...event, windowId: ID.event },
			{ ...event, tick: 13 },
			{ ...event, actorId: ID.monster },
			{ ...event, actionId: 'guard' },
			{ ...event, snapshotHash: HASH.state },
			{ ...event, actorViewHash: HASH.state },
			{ ...event, legalActionSetHash: HASH.state }
		]) {
			expect(CombatResolvedEventSchema.safeParse(contradictoryEvent).success).toBe(false);
		}
	});

	it('validates safety stops and idempotent typed claims', () => {
		const stop = {
			safetyStopVersion: 'combat-safety-stop-v1',
			reason: 'no-progress-cycles',
			disposition: 'diagnostic',
			ticksAdvanced: 50,
			eventsEmitted: 20,
			noProgressCycles: 10
		} as const;
		expect(CombatSafetyStopSchema.parse(stop)).toStrictEqual(stop);
		for (const reason of ['invalid-state', 'arithmetic-overflow', 'invalid-scheduled-effect']) {
			expect(CombatSafetyStopSchema.safeParse({ ...stop, reason }).success).toBe(true);
		}
		expect(
			CombatClaimSchema.parse({
				claimVersion: 'combat-claim-v1',
				claimId: ID.claim,
				idempotencyKey: `${ID.attempt}:practice:${ID.hero}`,
				claimType: 'skill-practice',
				heroId: ID.hero,
				skillId: 'combat-skill-cleaving-step',
				practiceEvidence: 4
			})
		).toBeDefined();
	});

	it('returns only a decision window or a common combat result', () => {
		expect(
			CombatAdvanceSchema.parse({ kind: 'decision-window', snapshot, views: [view] })
		).toBeDefined();
		const result = {
			resultVersion: 'combat-result-v1',
			resultId: ID.event,
			attemptId: ID.attempt,
			modeId: 'agent-readiness-v1',
			rulesVersion: 'combat-rules-v1',
			outcome: 'victory',
			endedAtTick: 20,
			finalCombatants: {
				[ID.hero]: hero,
				[ID.monster]: {
					...monster,
					resources: { ...monster.resources, health: { current: 0, maximum: 120 } },
					downed: true,
					active: false
				}
			},
			claims: [],
			decisiveEventIds: [ID.event],
			safetyStop: null,
			traceHash: HASH.trace
		} as const;
		expect(CombatResultSchema.parse(result)).toStrictEqual(result);
		expect(CombatAdvanceSchema.parse({ kind: 'combat-result', result })).toBeDefined();
	});

	it('requires exactly one correctly bound actor view for every ready actor', () => {
		expect(
			CombatAdvanceSchema.safeParse({ kind: 'decision-window', snapshot, views: [] }).success
		).toBe(false);
		expect(
			CombatAdvanceSchema.safeParse({
				kind: 'decision-window',
				snapshot,
				views: [view, { ...view, actorViewHash: HASH.state }]
			}).success
		).toBe(false);
		expect(
			CombatAdvanceSchema.safeParse({
				kind: 'decision-window',
				snapshot,
				views: [{ ...view, windowId: ID.action }]
			}).success
		).toBe(false);
		expect(
			CombatAdvanceSchema.safeParse({
				kind: 'decision-window',
				snapshot,
				views: [{ ...view, snapshotHash: HASH.state }]
			}).success
		).toBe(false);
		expect(
			CombatAdvanceSchema.safeParse({
				kind: 'decision-window',
				snapshot,
				views: [{ ...view, actorId: ID.monster, self: { ...selfView, combatantId: ID.monster } }]
			}).success
		).toBe(false);
	});

	it('binds v26 mission attempts to exactly one mode-specific state', () => {
		const commonAttempt = {
			attemptId: ID.attempt,
			ordinal: 1,
			status: 'preparing',
			party: { masterId: ID.master, heroIds: [ID.hero], memberIds: [ID.master, ID.hero] },
			entryNodeId: 'gate-entry',
			extractionNodeId: 'gate-exit',
			positions: {},
			knowledge: { discoveryIds: [], visitedNodeIds: [] },
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: null,
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null
		} as const;
		const binding = {
			modeId: 'agent-readiness-v1',
			rulesVersion: 'combat-rules-v1',
			contentHash: HASH.content,
			boundAt: commonAttempt.preparedAt
		} as const;
		const readinessAttempt = {
			...commonAttempt,
			combatModeBinding: binding,
			combatState: { modeId: 'agent-readiness-v1', readinessState: state }
		} as const;
		expect(MissionAttemptV10Schema.parse(readinessAttempt)).toStrictEqual(readinessAttempt);
		expect(
			MissionAttemptV10Schema.safeParse({
				...readinessAttempt,
				combatModeBinding: { ...binding, modeId: 'legacy-auto-v1' }
			}).success
		).toBe(false);
	});

	it('keeps the batch command and authoritative event envelope strict', () => {
		const batch = {
			batchVersion: 'combat-choice-batch-v1',
			batchId: ID.action,
			windowId: ID.window,
			attemptId: ID.attempt,
			tick: 12,
			snapshotHash: HASH.snapshot,
			choices: [intent],
			batchHash: HASH.batch
		} as const;
		const source = {
			source: 'system',
			timing: null,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		} as const;
		const command = {
			commandId: ID.claim,
			runId: ID.attempt,
			actorId: ID.master,
			expectedVersion: 3,
			correlationId: ID.event,
			source,
			commandType: 'mission.apply.combat-choice-batch',
			batch
		} as const;
		expect(ApplyCombatChoiceBatchCommandSchema.parse(command)).toStrictEqual(command);
		const event = {
			eventId: ID.event,
			runId: ID.attempt,
			sequence: 4,
			schemaVersion: 26,
			gameTime: '2000-01-01T00:00:00.000Z',
			eventType: 'mission.combat.choice-batch.applied',
			actorId: ID.master,
			commandId: ID.claim,
			causationId: null,
			correlationId: ID.event,
			source,
			seedCursor: 0,
			beforeStateHash: HASH.state,
			afterStateHash: HASH.trace,
			contentVersion: 'engine-v26',
			payload: { batch, resolvedEvents: [] }
		} as const;
		expect(CombatChoiceBatchAppliedEventSchema.parse(event)).toStrictEqual(event);
		expect(
			CombatChoiceBatchAppliedEventSchema.safeParse({
				...event,
				payload: { ...event.payload, providerDamage: 99 }
			}).success
		).toBe(false);
	});
});
