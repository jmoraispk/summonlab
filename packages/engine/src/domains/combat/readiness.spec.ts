import type {
	CombatLegalAction,
	CombatLegalActionTemplate,
	CombatRulesV1,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	AGENT_READINESS_CONTENT_BINDING_V2,
	COMBAT_CONTENT_BINDING,
	COMBAT_RULES_V1
} from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../../hash.js';
import { createReadinessCombatOutcomeEvidence } from './outcome.js';
import { advanceUntilReadyCohort, applyReadinessActionCost } from './readiness.js';

const ID = {
	attempt: '21000000-0000-4000-8000-000000000001',
	hero: '21000000-0000-4000-8000-000000000002',
	ally: '21000000-0000-4000-8000-000000000003',
	monster: '21000000-0000-4000-8000-000000000004',
	effect: '21000000-0000-4000-8000-000000000005',
	action: '21000000-0000-4000-8000-000000000006'
} as const;

const ZERO_MANA_GUARD_TEMPLATE = {
	actionId: 'guard-self',
	actionKind: 'guard',
	skillId: null,
	publicLabel: 'Guard',
	targetContract: { kind: 'self' },
	reactionPriority: 0,
	recoveryTicks: 2,
	manaCost: 0,
	conflictPolicy: {
		invalidTarget: 'cancel',
		occupiedDestination: 'cancel',
		cancellationRefund: { mana: 'full', readiness: 'full' }
	},
	fallbackOptions: [{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' } }],
	resolutionProfile: {
		profileKind: 'non-damaging',
		rulesVersion: 'combat-rules-v1',
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	}
} as const satisfies CombatLegalActionTemplate;

function combatant(
	combatantId: string,
	input: {
		readiness?: number;
		agility?: number;
		vitality?: number;
		spirit?: number;
		health?: number;
		mana?: number;
		lastDamagedAtTick?: number | null;
		recoveryUntilTick?: number;
		downed?: boolean;
	} = {}
) {
	const downed = input.downed ?? false;
	return {
		combatantId,
		combatantKind: combatantId === ID.monster ? ('monster' as const) : ('hero' as const),
		teamId: combatantId === ID.monster ? 'enemy' : 'party',
		position: { x: combatantId === ID.monster ? 3 : combatantId === ID.ally ? 2 : 1, y: 1 },
		facing: combatantId === ID.monster ? ('west' as const) : ('east' as const),
		resources: {
			health: { current: downed ? 0 : (input.health ?? 50), maximum: 100 },
			mana: { current: input.mana ?? 10, maximum: 100 }
		},
		lastDamagedAtTick: input.lastDamagedAtTick ?? null,
		attributes: {
			might: 20,
			vitality: input.vitality ?? 20,
			agility: input.agility ?? 1,
			spirit: input.spirit ?? 20
		},
		armour: 0,
		resistances: {},
		readiness: {
			value: input.readiness ?? 0,
			exactNumerator: input.readiness ?? 0,
			recoveryUntilTick: input.recoveryUntilTick ?? 0
		},
		conditions: [],
		cooldowns: {},
		downed,
		active: !downed
	};
}

function state(
	combatants: ReadinessCombatStateV1['combatants'],
	input: Partial<Pick<ReadinessCombatStateV1, 'tick' | 'scheduledEffects' | 'safety'>> = {}
): ReadinessCombatStateV1 {
	const safety = input.safety ?? { ticksAdvanced: 0, eventsEmitted: 0, noProgressCycles: 0 };
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed: 'a'.repeat(64),
		attemptId: ID.attempt,
		tick: input.tick ?? 0,
		combatants,
		actorContexts: Object.fromEntries(
			Object.values(combatants)
				.filter((combatant) => combatant.active && !combatant.downed)
				.map((combatant) => [
					combatant.combatantId,
					{
						actorId: combatant.combatantId,
						visibleCombatantIds: [],
						visibleTelegraphIds: [],
						observableReadinessActorIds: [],
						targetablePositions: [combatant.position],
						visibleTerrainFeatureIds: [],
						rememberedContext: [],
						doctrine: [],
						relationships: [],
						masterDirections: [],
						legalActionTemplates: [ZERO_MANA_GUARD_TEMPLATE]
					}
				])
		),
		terrain: { width: 8, height: 8, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: input.scheduledEffects ?? [],
		safety,
		outcomeEvidence: createReadinessCombatOutcomeEvidence({
			attemptId: ID.attempt,
			combatants,
			eventsEmitted: safety.eventsEmitted
		}),
		status: 'active',
		result: null
	};
}

function rulesWithSafety(safety: Partial<CombatRulesV1['readiness']['safety']>): CombatRulesV1 {
	return {
		...COMBAT_RULES_V1,
		readiness: {
			...COMBAT_RULES_V1.readiness,
			safety: { ...COMBAT_RULES_V1.readiness.safety, ...safety }
		}
	};
}

const ACTION = {
	actionId: 'guard',
	actionInstanceId: ID.action,
	actionKind: 'guard',
	skillId: null,
	publicLabel: 'Guard',
	targetContract: { kind: 'self' },
	reactionPriority: 0,
	recoveryTicks: 3,
	manaCost: 0,
	conflictPolicy: {
		invalidTarget: 'cancel',
		occupiedDestination: 'cancel',
		cancellationRefund: { mana: 'full', readiness: 'full' }
	},
	fallbackOptions: []
} as const satisfies CombatLegalAction;

describe('agent-readiness one-tick cohorts', () => {
	it('rejects a schema-valid capped value that contradicts the exact authoritative numerator', () => {
		const arranged = state({
			[ID.hero]: {
				...combatant(ID.hero),
				readiness: { value: 0, exactNumerator: 10_000, recoveryUntilTick: 0 }
			}
		});
		const before = hashCanonical(arranged);
		const result = advanceUntilReadyCohort(arranged, COMBAT_RULES_V1);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result.safetyStop?.reason).toBe('invalid-state');
		expect(result.state.tick).toBe(0);
		expect(result.state.combatants[ID.hero]?.readiness).toStrictEqual(
			arranged.combatants[ID.hero]?.readiness
		);
		expect(hashCanonical(arranged)).toBe(before);
	});

	it('stops on the first crossing tick and never emits an actor before it is ready', () => {
		const result = advanceUntilReadyCohort(
			state({ [ID.hero]: combatant(ID.hero, { readiness: 9_000, agility: 1 }) }),
			COMBAT_RULES_V1
		);
		expect(result.kind).toBe('decision-window');
		if (result.kind !== 'decision-window') return;
		expect(result.state.tick).toBe(10);
		expect(result.readyActorIds).toStrictEqual([ID.hero]);
		expect(result.state.combatants[ID.hero]?.readiness).toStrictEqual({
			value: 10_000,
			exactNumerator: 10_010,
			recoveryUntilTick: 0
		});
	});

	it('groups every actor crossing on one tick and leaves adjacent-tick actors for another window', () => {
		const sameTick = advanceUntilReadyCohort(
			state({
				[ID.hero]: combatant(ID.hero, { readiness: 9_900, agility: 1 }),
				[ID.ally]: combatant(ID.ally, { readiness: 9_899, agility: 2 })
			}),
			COMBAT_RULES_V1
		);
		expect(sameTick.kind).toBe('decision-window');
		if (sameTick.kind !== 'decision-window') return;
		expect(sameTick.state.tick).toBe(1);
		expect(sameTick.readyActorIds).toStrictEqual([ID.hero, ID.ally]);

		const adjacentTick = advanceUntilReadyCohort(
			state({
				[ID.hero]: combatant(ID.hero, { readiness: 9_798, agility: 1 }),
				[ID.ally]: combatant(ID.ally, { readiness: 9_696, agility: 1 })
			}),
			COMBAT_RULES_V1
		);
		expect(adjacentTick.kind).toBe('decision-window');
		if (adjacentTick.kind !== 'decision-window') return;
		expect(adjacentTick.state.tick).toBe(2);
		expect(adjacentTick.readyActorIds).toStrictEqual([ID.hero]);
		expect(adjacentTick.state.combatants[ID.ally]?.readiness.value).toBe(9_898);
	});

	it('makes Agility monotonically shorten the first readiness time', () => {
		const ticks = [1, 20, 50, 100].map((agility) => {
			const result = advanceUntilReadyCohort(
				state({ [ID.hero]: combatant(ID.hero, { agility }) }),
				COMBAT_RULES_V1
			);
			expect(result.kind).toBe('decision-window');
			return result.state.tick;
		});
		expect(ticks).toStrictEqual([...ticks].sort((left, right) => right - left));
		expect(new Set(ticks).size).toBe(ticks.length);
	});

	it('applies authored recovery only after a choice and delays the next action', () => {
		const ready = advanceUntilReadyCohort(
			state({ [ID.hero]: combatant(ID.hero, { readiness: 9_900, agility: 1 }) }),
			COMBAT_RULES_V1
		);
		expect(ready.kind).toBe('decision-window');
		if (ready.kind !== 'decision-window') return;
		expect(ready.state.combatants[ID.hero]?.readiness.recoveryUntilTick).toBe(0);
		expect(ready.state.combatants[ID.hero]?.readiness.exactNumerator).toBe(10_001);

		const paid = applyReadinessActionCost(ready.state, ID.hero, ACTION, COMBAT_RULES_V1);
		expect(paid.kind).toBe('applied');
		if (paid.kind !== 'applied') return;
		const afterChoice = paid.state;
		expect(afterChoice.combatants[ID.hero]?.readiness).toStrictEqual({
			value: 1,
			exactNumerator: 1,
			recoveryUntilTick: 4
		});
		expect(ready.state.combatants[ID.hero]?.readiness.exactNumerator).toBe(10_001);

		const next = advanceUntilReadyCohort(afterChoice, COMBAT_RULES_V1);
		expect(next.kind).toBe('decision-window');
		if (next.kind !== 'decision-window') return;
		expect(next.state.tick).toBe(102);
	});

	it('applies due scheduled damage before capped natural regeneration and keeps downed actors inert', () => {
		const arranged = state(
			{
				[ID.hero]: combatant(ID.hero, { readiness: 9_798, agility: 1, health: 50, mana: 10 }),
				[ID.ally]: combatant(ID.ally, {
					readiness: 10_000,
					health: 0,
					mana: 0,
					downed: true
				})
			},
			{
				scheduledEffects: [
					{
						scheduledEffectId: ID.effect,
						resolvesAtTick: 1,
						sourceCombatantId: ID.monster,
						effects: [
							{
								kind: 'resource',
								combatantId: ID.hero,
								resource: 'health',
								before: 50,
								after: 40,
								delta: -10
							}
						]
					}
				]
			}
		);
		const result = advanceUntilReadyCohort(arranged, COMBAT_RULES_V1);
		expect(result.kind).toBe('decision-window');
		if (result.kind !== 'decision-window') return;
		expect(result.state.tick).toBe(2);
		expect(result.state.scheduledEffects).toStrictEqual([]);
		expect(result.state.safety.eventsEmitted).toBe(1);
		expect(result.state.combatants[ID.hero]?.resources).toStrictEqual({
			health: { current: 40, maximum: 100 },
			mana: { current: 10, maximum: 100 }
		});
		expect(result.state.combatants[ID.hero]?.lastDamagedAtTick).toBe(1);
		expect(result.state.outcomeEvidence.partyHeroes[ID.hero]).toMatchObject({
			currentHealth: 40,
			damageTaken: 10,
			downed: false
		});
		expect(result.state.outcomeEvidence.emittedEventIds).toStrictEqual([ID.effect]);
		expect(result.state.combatants[ID.ally]).toStrictEqual(arranged.combatants[ID.ally]);
		expect(result.readyActorIds).toStrictEqual([ID.hero]);
	});

	it('finalizes victory immediately when a due scheduled effect downs the final enemy', () => {
		const result = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, { readiness: 10_000 }),
					[ID.monster]: combatant(ID.monster, { health: 20 })
				},
				{
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: 0,
							sourceCombatantId: ID.hero,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.monster,
									resource: 'health',
									before: 20,
									after: 0,
									delta: -20
								},
								{ kind: 'downed', combatantId: ID.monster }
							]
						}
					]
				}
			),
			COMBAT_RULES_V1
		);

		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result).toMatchObject({ outcome: 'victory', endedAtTick: 0, safetyStop: null });
		expect(result.state.combatants[ID.monster]).toMatchObject({
			resources: { health: { current: 0, maximum: 100 } },
			downed: true,
			active: false
		});
		expect(result.state.scheduledEffects).toStrictEqual([]);
		expect(result.state.safety.eventsEmitted).toBe(1);
		expect(result.state.outcomeEvidence).toMatchObject({
			eventsEmitted: 1,
			emittedEventIds: [ID.effect]
		});
		expect(result.result.claims).not.toHaveLength(0);
	});

	it('finalizes total-party downing immediately from a due scheduled lethal effect', () => {
		const result = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, { readiness: 10_000, health: 50 }),
					[ID.monster]: combatant(ID.monster)
				},
				{
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: 0,
							sourceCombatantId: ID.monster,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.hero,
									resource: 'health',
									before: 50,
									after: 0,
									delta: -50
								},
								{ kind: 'downed', combatantId: ID.hero }
							]
						}
					]
				}
			),
			COMBAT_RULES_V1
		);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result).toMatchObject({
			outcome: 'party-downed',
			endedAtTick: 0,
			safetyStop: null,
			claimEvidence: { engineDamageTakenByHeroId: { [ID.hero]: 50 } }
		});
		expect(result.state.combatants[ID.hero]).toMatchObject({
			lastDamagedAtTick: 0,
			downed: true,
			active: false
		});
		expect(result.state.scheduledEffects).toStrictEqual([]);
		expect(result.state.outcomeEvidence).toMatchObject({
			eventsEmitted: 1,
			emittedEventIds: [ID.effect],
			partyHeroes: {
				[ID.hero]: { currentHealth: 0, damageTaken: 50, downed: true }
			}
		});
	});

	it('ends at the authored deadline tick before any actor becomes ready', () => {
		const arranged = state({
			[ID.hero]: combatant(ID.hero),
			[ID.monster]: combatant(ID.monster)
		});
		arranged.outcomeEvidence.authoredDeadline = {
			deadlineVersion: 'readiness-authored-deadline-v1',
			deadlineId: ID.action,
			attemptId: ID.attempt,
			deadlineTick: 3
		};

		const result = advanceUntilReadyCohort(arranged, COMBAT_RULES_V1);

		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result).toMatchObject({
			outcome: 'deadline',
			endedAtTick: 3,
			safetyStop: null,
			claimEvidence: { resolvedEvents: [] }
		});
		expect(result.state.tick).toBe(3);
		expect(result.state.safety).toStrictEqual({
			ticksAdvanced: 3,
			eventsEmitted: 0,
			noProgressCycles: 0
		});
		expect(result.state.outcomeEvidence.eventsEmitted).toBe(0);
		expect(result.result.claims.some((claim) => claim.claimType === 'skill-practice')).toBe(false);
	});

	it('persists the Health damage clock across decision windows and ignores non-damaging effects', () => {
		const first = advanceUntilReadyCohort(
			state(
				{ [ID.hero]: combatant(ID.hero, { readiness: 9_798, agility: 1, health: 50 }) },
				{
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: 1,
							sourceCombatantId: ID.monster,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.hero,
									resource: 'health',
									before: 50,
									after: 40,
									delta: -10
								}
							]
						}
					]
				}
			),
			COMBAT_RULES_V1
		);
		expect(first.kind).toBe('decision-window');
		if (first.kind !== 'decision-window') return;
		const paid = applyReadinessActionCost(first.state, ID.hero, ACTION, COMBAT_RULES_V1);
		expect(paid.kind).toBe('applied');
		if (paid.kind !== 'applied') return;
		const second = advanceUntilReadyCohort(paid.state, COMBAT_RULES_V1);
		expect(second.kind).toBe('decision-window');
		if (second.kind !== 'decision-window') return;
		expect(second.state.tick).toBe(104);
		expect(second.state.combatants[ID.hero]?.lastDamagedAtTick).toBe(1);
		expect(second.state.combatants[ID.hero]?.resources.health.current).toBe(41);

		const manaOnly = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, {
						readiness: 9_798,
						lastDamagedAtTick: 0
					})
				},
				{
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: 1,
							sourceCombatantId: ID.monster,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.hero,
									resource: 'mana',
									before: 10,
									after: 9,
									delta: -1
								}
							]
						}
					]
				}
			),
			COMBAT_RULES_V1
		);
		expect(manaOnly.state.combatants[ID.hero]?.lastDamagedAtTick).toBe(0);
	});

	it('clamps regeneration to resource caps', () => {
		const result = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, {
						readiness: 9_798,
						agility: 1,
						health: 99,
						mana: 99
					})
				},
				{ tick: 98 }
			),
			COMBAT_RULES_V1
		);
		expect(result.kind).toBe('decision-window');
		if (result.kind !== 'decision-window') return;
		expect(result.state.combatants[ID.hero]?.resources).toStrictEqual({
			health: { current: 100, maximum: 100 },
			mana: { current: 100, maximum: 100 }
		});
	});

	it('pulses natural recovery once per canonical interval instead of every tick', () => {
		const beforePulse = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, {
						readiness: 9_898,
						agility: 1,
						health: 50,
						mana: 10,
						lastDamagedAtTick: 50
					})
				},
				{ tick: 98 }
			),
			COMBAT_RULES_V1
		);
		expect(beforePulse.kind).toBe('decision-window');
		if (beforePulse.kind !== 'decision-window') return;
		expect(beforePulse.state.tick).toBe(100);
		expect(beforePulse.state.combatants[ID.hero]?.resources).toStrictEqual({
			health: { current: 51, maximum: 100 },
			mana: { current: 12, maximum: 100 }
		});

		const afterPulse = advanceUntilReadyCohort(
			state(
				{
					[ID.hero]: combatant(ID.hero, {
						readiness: 9_898,
						agility: 1,
						health: 50,
						mana: 10,
						lastDamagedAtTick: 75
					})
				},
				{ tick: 98 }
			),
			COMBAT_RULES_V1
		);
		expect(afterPulse.kind).toBe('decision-window');
		if (afterPulse.kind !== 'decision-window') return;
		expect(afterPulse.state.combatants[ID.hero]?.resources).toStrictEqual({
			health: { current: 50, maximum: 100 },
			mana: { current: 12, maximum: 100 }
		});
	});

	it.each([
		['total-ticks', rulesWithSafety({ maximumTicksAdvanced: 1 })],
		['emitted-events', rulesWithSafety({ maximumEventsEmitted: 0 })],
		['no-progress-cycles', rulesWithSafety({ maximumNoProgressCycles: 1 })]
	] as const)('returns a typed %s safety stop rather than an authored timeout', (reason, rules) => {
		const arranged =
			reason === 'emitted-events'
				? state(
						{ [ID.hero]: combatant(ID.hero) },
						{
							scheduledEffects: [
								{
									scheduledEffectId: ID.effect,
									resolvesAtTick: 1,
									sourceCombatantId: ID.monster,
									effects: [
										{
											kind: 'resource',
											combatantId: ID.hero,
											resource: 'mana',
											before: 10,
											after: 9,
											delta: -1
										}
									]
								}
							]
						}
					)
				: reason === 'no-progress-cycles'
					? state({ [ID.hero]: { ...combatant(ID.hero), active: false } })
					: state({ [ID.hero]: combatant(ID.hero) });
		const result = advanceUntilReadyCohort(arranged, rules);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result).toMatchObject({
			outcome: 'safety-stop',
			safetyStop: { reason, disposition: 'diagnostic' }
		});
		expect(result.result.claims.map((claim) => claim.claimType)).toContain('attempt-outcome');
		expect(result.result.claims).not.toHaveLength(0);
		expect(result.result).not.toHaveProperty('timeout');
		expect(result.state.status).toBe('complete');
		expect(result.state.result).toStrictEqual(result.result);
	});

	it.each([
		[
			'tick increment',
			state(
				{ [ID.hero]: combatant(ID.hero) },
				{
					tick: Number.MAX_SAFE_INTEGER,
					safety: { ticksAdvanced: 0, eventsEmitted: 0, noProgressCycles: 0 }
				}
			),
			COMBAT_RULES_V1
		],
		[
			'gain multiplication',
			state({ [ID.hero]: combatant(ID.hero) }),
			{
				...COMBAT_RULES_V1,
				readiness: {
					...COMBAT_RULES_V1.readiness,
					threshold: Number.MAX_SAFE_INTEGER,
					agilityGainPerTick: Number.MAX_SAFE_INTEGER
				}
			}
		],
		[
			'numerator gain',
			state({
				[ID.hero]: {
					...combatant(ID.hero),
					readiness: {
						value: Number.MAX_SAFE_INTEGER - 1,
						exactNumerator: Number.MAX_SAFE_INTEGER - 1,
						recoveryUntilTick: 0
					}
				}
			}),
			{
				...COMBAT_RULES_V1,
				readiness: { ...COMBAT_RULES_V1.readiness, threshold: Number.MAX_SAFE_INTEGER }
			}
		],
		[
			'scheduled event counter',
			state(
				{ [ID.hero]: combatant(ID.hero) },
				{
					safety: {
						ticksAdvanced: 0,
						eventsEmitted: Number.MAX_SAFE_INTEGER,
						noProgressCycles: 0
					},
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: 0,
							sourceCombatantId: ID.monster,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.hero,
									resource: 'mana',
									before: 10,
									after: 9,
									delta: -1
								}
							]
						}
					]
				}
			),
			{
				...COMBAT_RULES_V1,
				readiness: {
					...COMBAT_RULES_V1.readiness,
					safety: {
						...COMBAT_RULES_V1.readiness.safety,
						maximumEventsEmitted: Number.MAX_SAFE_INTEGER
					}
				}
			}
		]
	] as const)(
		'returns an arithmetic safety stop before unsafe %s mutation',
		(_label, arranged, rules) => {
			const before = hashCanonical(arranged);
			const result = advanceUntilReadyCohort(arranged, rules);
			expect(result.kind).toBe('combat-result');
			if (result.kind !== 'combat-result') return;
			expect(result.result.safetyStop?.reason).toBe('arithmetic-overflow');
			expect(result.state.tick).toBe(arranged.tick);
			expect(result.state.combatants).toStrictEqual(arranged.combatants);
			expect(hashCanonical(arranged)).toBe(before);
		}
	);

	it('resolves a scheduled effect at the final safe tick without overflowing time', () => {
		const result = advanceUntilReadyCohort(
			state(
				{ [ID.hero]: combatant(ID.hero, { readiness: 9_899, agility: 1 }) },
				{
					tick: Number.MAX_SAFE_INTEGER - 1,
					scheduledEffects: [
						{
							scheduledEffectId: ID.effect,
							resolvesAtTick: Number.MAX_SAFE_INTEGER,
							sourceCombatantId: ID.monster,
							effects: [
								{
									kind: 'resource',
									combatantId: ID.hero,
									resource: 'mana',
									before: 10,
									after: 9,
									delta: -1
								}
							]
						}
					]
				}
			),
			COMBAT_RULES_V1
		);
		expect(result.kind).toBe('decision-window');
		expect(result.state.tick).toBe(Number.MAX_SAFE_INTEGER);
		expect(result.state.safety.eventsEmitted).toBe(1);
		expect(result.state.scheduledEffects).toStrictEqual([]);
	});

	it('returns an arithmetic safety stop before recovery would overflow the tick domain', () => {
		const arranged = state(
			{ [ID.hero]: combatant(ID.hero, { readiness: 10_000 }) },
			{ tick: Number.MAX_SAFE_INTEGER - 1 }
		);
		const result = applyReadinessActionCost(arranged, ID.hero, ACTION, COMBAT_RULES_V1);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result.safetyStop?.reason).toBe('arithmetic-overflow');
		expect(result.state.tick).toBe(arranged.tick);
		expect(result.state.combatants[ID.hero]?.readiness).toStrictEqual(
			arranged.combatants[ID.hero]?.readiness
		);
	});

	it('returns a typed invalid-state stop when action payment is requested before exact readiness', () => {
		const arranged = state({ [ID.hero]: combatant(ID.hero, { readiness: 9_999 }) });
		const result = applyReadinessActionCost(arranged, ID.hero, ACTION, COMBAT_RULES_V1);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result.safetyStop?.reason).toBe('invalid-state');
		expect(result.state.combatants[ID.hero]?.readiness).toStrictEqual(
			arranged.combatants[ID.hero]?.readiness
		);
	});

	it('returns a completed safety stop byte-for-byte instead of attempting action payment', () => {
		const terminal = advanceUntilReadyCohort(
			state({ [ID.hero]: combatant(ID.hero, { downed: true }) }),
			rulesWithSafety({ maximumNoProgressCycles: 1 })
		);
		expect(terminal.kind).toBe('combat-result');
		if (terminal.kind !== 'combat-result') return;
		const beforeState = hashCanonical(terminal.state);
		const beforeResult = hashCanonical(terminal.result);

		const payment = applyReadinessActionCost(terminal.state, ID.hero, ACTION, COMBAT_RULES_V1);

		expect(payment).toStrictEqual({
			kind: 'combat-result',
			state: terminal.state,
			result: terminal.result,
			authority: null
		});
		expect(hashCanonical(terminal.state)).toBe(beforeState);
		expect(hashCanonical(terminal.result)).toBe(beforeResult);
	});

	it('returns an ordinary completed result byte-for-byte instead of mutating final combatants', () => {
		const finalCombatants = {
			[ID.hero]: combatant(ID.hero, { readiness: 10_000 }),
			[ID.monster]: combatant(ID.monster, { downed: true })
		};
		const result = {
			resultVersion: 'combat-result-v1' as const,
			resultId: ID.effect,
			attemptId: ID.attempt,
			modeId: 'agent-readiness-v1' as const,
			rulesVersion: 'agent-readiness-rules-v2' as const,
			contentHash: AGENT_READINESS_CONTENT_BINDING_V2.contentHash,
			outcome: 'victory' as const,
			endedAtTick: 12,
			finalCombatants,
			claimEvidence: {
				evidenceVersion: 'combat-outcome-claim-evidence-v1' as const,
				partyHeroIds: [ID.hero],
				engineDamageTakenByHeroId: { [ID.hero]: 0 },
				resolvedEvents: [],
				engineRecoveredCombatantIds: [],
				securedLoot: [],
				objectiveStates: []
			},
			claims: [
				{
					claimVersion: 'combat-claim-v1' as const,
					claimId: ID.action,
					idempotencyKey: `${ID.attempt}:attempt-outcome`,
					claimType: 'attempt-outcome' as const,
					outcome: 'victory' as const
				}
			],
			decisiveEventIds: [],
			safetyStop: null,
			traceHash: 'b'.repeat(64)
		};
		const completed: ReadinessCombatStateV1 = {
			...state(finalCombatants, { tick: 12 }),
			status: 'complete',
			result
		};
		const beforeState = hashCanonical(completed);
		const beforeResult = hashCanonical(result);

		const payment = applyReadinessActionCost(completed, ID.hero, ACTION, COMBAT_RULES_V1);

		expect(payment).toStrictEqual({
			kind: 'combat-result',
			state: completed,
			result,
			authority: null
		});
		expect(hashCanonical(completed)).toBe(beforeState);
		expect(hashCanonical(result)).toBe(beforeResult);
	});

	it.each([
		['outside the arena', { x: 8, y: 1 }],
		['onto an occupied tile', { x: 2, y: 1 }],
		['onto blocked terrain', { x: 4, y: 1 }]
	] as const)('safety-stops a scheduled move %s before spatial mutation', (_label, destination) => {
		const arranged = {
			...state({
				[ID.hero]: combatant(ID.hero),
				[ID.ally]: combatant(ID.ally)
			}),
			terrain: { width: 8, height: 8, blockedTiles: [{ x: 4, y: 1 }], features: [] },
			scheduledEffects: [
				{
					scheduledEffectId: ID.effect,
					resolvesAtTick: 0,
					sourceCombatantId: ID.monster,
					effects: [
						{
							kind: 'position' as const,
							combatantId: ID.hero,
							before: { x: 1, y: 1 },
							after: destination
						}
					]
				}
			]
		};
		const before = hashCanonical(arranged);
		const result = advanceUntilReadyCohort(arranged, COMBAT_RULES_V1);
		expect(result.kind).toBe('combat-result');
		if (result.kind !== 'combat-result') return;
		expect(result.result.safetyStop?.reason).toBe('invalid-scheduled-effect');
		expect(result.state.combatants[ID.hero]?.position).toStrictEqual({ x: 1, y: 1 });
		expect(result.state.combatants[ID.ally]?.position).toStrictEqual({ x: 2, y: 1 });
		expect(hashCanonical(arranged)).toBe(before);
	});

	it('is pure and retains exact numerators only in authoritative state', () => {
		const arranged = state({ [ID.hero]: combatant(ID.hero, { readiness: 9_900 }) });
		const beforeHash = hashCanonical(arranged);
		const result = advanceUntilReadyCohort(arranged, COMBAT_RULES_V1);
		expect(hashCanonical(arranged)).toBe(beforeHash);
		expect(result.state).not.toBe(arranged);
		expect(result).not.toHaveProperty('initiative');
	});
});
