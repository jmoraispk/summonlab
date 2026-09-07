import type {
	CombatActionIntent,
	CombatLegalAction,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { sha256Hex } from '../../hash.js';
import { combatHitChance, resolveCombatAction, type CombatActionAuthority } from './resolver.js';

const ID = {
	attempt: '42000000-0000-4000-8000-000000000001',
	actor: '42000000-0000-4000-8000-000000000002',
	target: '42000000-0000-4000-8000-000000000003',
	action: '42000000-0000-4000-8000-000000000004',
	window: '42000000-0000-4000-8000-000000000005'
} as const;

function combatant(
	combatantId: string,
	teamId: 'party' | 'enemy',
	input: {
		health?: number;
		mana?: number;
		might?: number;
		spirit?: number;
		agility?: number;
		armour?: number;
		resistances?: ReadinessCombatStateV1['combatants'][string]['resistances'];
	} = {}
) {
	return {
		combatantId,
		combatantKind: teamId === 'party' ? ('hero' as const) : ('monster' as const),
		teamId,
		position: { x: teamId === 'party' ? 1 : 2, y: 1 },
		resources: {
			health: { current: input.health ?? 500, maximum: 500 },
			mana: { current: input.mana ?? 20, maximum: 100 }
		},
		lastDamagedAtTick: null,
		attributes: {
			might: input.might ?? 20,
			vitality: 20,
			agility: input.agility ?? 20,
			spirit: input.spirit ?? 20
		},
		armour: input.armour ?? 0,
		resistances: input.resistances ?? {},
		readiness: { value: 10_000, exactNumerator: 10_000, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function state(seed = sha256Hex('resolver-private-seed')): ReadinessCombatStateV1 {
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed,
		attemptId: ID.attempt,
		tick: 13,
		combatants: {
			[ID.actor]: combatant(ID.actor, 'party'),
			[ID.target]: combatant(ID.target, 'enemy', {
				armour: 100,
				resistances: { cut: 2_000, burn: 7_500 }
			})
		},
		actorContexts: {},
		terrain: { width: 4, height: 4, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 13, eventsEmitted: 0, noProgressCycles: 0 },
		status: 'active',
		result: null
	};
}

const ACTION = {
	actionId: 'cross-cut',
	actionInstanceId: ID.action,
	actionKind: 'attack',
	skillId: 'combat-skill-basic-sword-strike',
	publicLabel: 'Cross Cut',
	targetContract: { kind: 'entity', allowedCombatantIds: [ID.target] },
	reactionPriority: 0,
	recoveryTicks: 4,
	manaCost: 2,
	fallbackOptions: [
		{ fallbackId: 'hold-ground', publicLabel: 'Hold Ground', target: { kind: 'self' } }
	]
} as const satisfies CombatLegalAction;

function intent(publicIntent = 'Cut across the exposed line.'): CombatActionIntent {
	return {
		windowId: ID.window,
		attemptId: ID.attempt,
		tick: 13,
		actorId: ID.actor,
		snapshotHash: '1'.repeat(64),
		actorViewHash: '2'.repeat(64),
		legalActionSetHash: '3'.repeat(64),
		actionId: ACTION.actionId,
		target: { kind: 'entity', combatantId: ID.target },
		fallbackId: 'hold-ground',
		publicIntent
	};
}

function authority(overrides: Partial<CombatActionAuthority> = {}): CombatActionAuthority {
	return {
		authorityVersion: 'combat-action-authority-v1',
		actionId: ACTION.actionId,
		skillId: ACTION.skillId,
		hit: {
			skillAccuracyBasisPoints: 10_000,
			defenderEvasionBasisPoints: 0,
			flank: false,
			surround: false,
			unaware: false
		},
		damage: {
			channel: 'physical',
			tags: ['physical', 'cut'],
			baseMagnitude: 100,
			coefficientBasisPoints: 15_000,
			affinityContributionBasisPoints: 1_000,
			criticalChanceBasisPoints: 10_000,
			criticalMultiplierBasisPoints: 15_000,
			penetration: 0,
			status: {
				conditionId: 'opened-guard',
				chanceBasisPoints: 10_000,
				damageMultiplierBasisPoints: 12_000,
				stacks: 1,
				durationTicks: 3
			}
		},
		...overrides
	};
}

describe('authoritative combat action resolution', () => {
	it('uses bounded relative Agility and explicit positional modifiers in the hit contest', () => {
		expect(
			combatHitChance({
				skillAccuracyBasisPoints: 6_750,
				defenderEvasionBasisPoints: 0,
				attackerAgility: 20,
				defenderAgility: 20,
				flank: false,
				surround: false,
				unaware: false
			})
		).toBe(6_750);
		expect(
			combatHitChance({
				skillAccuracyBasisPoints: 6_750,
				defenderEvasionBasisPoints: 0,
				attackerAgility: 200,
				defenderAgility: 1,
				flank: true,
				surround: true,
				unaware: true
			})
		).toBe(9_950);
		expect(
			combatHitChance({
				skillAccuracyBasisPoints: 6_750,
				defenderEvasionBasisPoints: 0,
				attackerAgility: 1,
				defenderAgility: 200,
				flank: false,
				surround: false,
				unaware: false
			})
		).toBe(5_850);
	});

	it('applies authored, attribute, affinity, critical/status, armour, resistance, and clamp stages in order', () => {
		const arranged = state();
		const result = resolveCombatAction({
			state: arranged,
			intent: intent(),
			legalAction: ACTION,
			authority: authority(),
			rules: COMBAT_RULES_V1
		});

		expect(result.outcome).toMatchObject({ hit: true, critical: true, statusApplied: true });
		expect(result.calculation).toStrictEqual({
			authoredMagnitude: 150,
			attributeScaledMagnitude: 180,
			affinityAdjustedMagnitude: 183,
			criticalAdjustedMagnitude: 275,
			statusAdjustedMagnitude: 330,
			armourReductionBasisPoints: 5_000,
			armourAdjustedMagnitude: 165,
			resistanceReductionBasisPoints: 2_000,
			finalDamage: 132
		});
		expect(result.state.combatants[ID.target]).toMatchObject({
			resources: { health: { current: 368, maximum: 500 }, mana: { current: 20, maximum: 100 } },
			lastDamagedAtTick: 13,
			downed: false,
			active: true
		});
		expect(result.effects).toStrictEqual([
			{
				kind: 'resource',
				combatantId: ID.target,
				resource: 'health',
				before: 500,
				after: 368,
				delta: -132
			},
			{
				kind: 'condition',
				combatantId: ID.target,
				operation: 'applied',
				condition: {
					conditionId: 'opened-guard',
					stacks: 1,
					appliedAtTick: 13,
					expiresAtTick: 16,
					sourceCombatantId: ID.actor
				}
			}
		]);
		expect(arranged.combatants[ID.target]?.resources.health.current).toBe(500);
	});

	it('uses Spirit for magical damage and skips general physical armour', () => {
		const arranged = state();
		arranged.combatants[ID.actor]!.attributes = {
			...arranged.combatants[ID.actor]!.attributes,
			might: 1,
			spirit: 50
		};
		const result = resolveCombatAction({
			state: arranged,
			intent: intent(),
			legalAction: ACTION,
			authority: authority({
				damage: {
					channel: 'magical',
					tags: ['magical', 'burn'],
					baseMagnitude: 100,
					coefficientBasisPoints: 10_000,
					affinityContributionBasisPoints: 0,
					criticalChanceBasisPoints: 0,
					criticalMultiplierBasisPoints: 15_000,
					penetration: 0,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});

		expect(result.calculation).toMatchObject({
			authoredMagnitude: 100,
			attributeScaledMagnitude: 150,
			armourReductionBasisPoints: 0,
			armourAdjustedMagnitude: 150,
			resistanceReductionBasisPoints: 7_500,
			finalDamage: 38
		});
	});

	it('keeps hit and critical draws independent and does not regenerate during resolution', () => {
		let arranged = state();
		for (let index = 0; index < 10_000; index += 1) {
			arranged = state(sha256Hex(`forced-miss-${index}`));
			const candidate = resolveCombatAction({
				state: arranged,
				intent: intent('First prose.'),
				legalAction: ACTION,
				authority: authority({
					hit: {
						...authority().hit,
						skillAccuracyBasisPoints: 500
					},
					damage: {
						...authority().damage!,
						criticalChanceBasisPoints: 0,
						status: null
					}
				}),
				rules: COMBAT_RULES_V1
			});
			if (!candidate.outcome.hit) break;
		}
		const before = arranged.combatants[ID.actor]!.resources;
		const withoutCritical = resolveCombatAction({
			state: arranged,
			intent: intent('First prose.'),
			legalAction: ACTION,
			authority: authority({
				hit: { ...authority().hit, skillAccuracyBasisPoints: 500 },
				damage: {
					...authority().damage!,
					criticalChanceBasisPoints: 0,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});
		const guaranteedCritical = resolveCombatAction({
			state: arranged,
			intent: intent('Entirely different provider prose.'),
			legalAction: ACTION,
			authority: authority({
				hit: { ...authority().hit, skillAccuracyBasisPoints: 500 },
				damage: {
					...authority().damage!,
					criticalChanceBasisPoints: 10_000,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});

		expect(withoutCritical.outcome.hit).toBe(false);
		expect(guaranteedCritical.outcome.hit).toBe(false);
		expect(guaranteedCritical.outcome.critical).toBe(false);
		expect(guaranteedCritical.effects).toStrictEqual([]);
		expect(guaranteedCritical.state.combatants[ID.actor]!.resources).toStrictEqual(before);
	});

	it('clamps lethal damage to exact zero and emits one typed downing effect', () => {
		const arranged = state();
		arranged.combatants[ID.target]!.resources.health = { current: 5, maximum: 500 };
		const result = resolveCombatAction({
			state: arranged,
			intent: intent(),
			legalAction: ACTION,
			authority: authority({
				damage: {
					...authority().damage!,
					criticalChanceBasisPoints: 0,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});

		expect(result.state.combatants[ID.target]).toMatchObject({
			resources: { health: { current: 0 } },
			downed: true,
			active: false
		});
		expect(result.calculation?.finalDamage).toBe(5);
		expect(result.effects.at(-1)).toStrictEqual({ kind: 'downed', combatantId: ID.target });
	});

	it('applies penetration only to physical armour before matching named resistance', () => {
		const result = resolveCombatAction({
			state: state(),
			intent: intent(),
			legalAction: ACTION,
			authority: authority({
				damage: {
					...authority().damage!,
					baseMagnitude: 100,
					coefficientBasisPoints: 10_000,
					affinityContributionBasisPoints: 0,
					criticalChanceBasisPoints: 0,
					penetration: 25,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});

		expect(result.calculation).toMatchObject({
			attributeScaledMagnitude: 120,
			armourReductionBasisPoints: 4_286,
			armourAdjustedMagnitude: 69,
			resistanceReductionBasisPoints: 2_000,
			finalDamage: 55
		});
	});

	it('rounds every basis-point boundary half-up and keeps successful damage meaningful', () => {
		const arranged = state();
		arranged.combatants[ID.target]!.armour = 1_000_000;
		arranged.combatants[ID.target]!.resistances = { cut: 7_500 };
		const result = resolveCombatAction({
			state: arranged,
			intent: intent(),
			legalAction: ACTION,
			authority: authority({
				damage: {
					...authority().damage!,
					baseMagnitude: 1,
					coefficientBasisPoints: 5_000,
					affinityContributionBasisPoints: 0,
					criticalChanceBasisPoints: 0,
					status: null
				}
			}),
			rules: COMBAT_RULES_V1
		});
		expect(result.calculation?.authoredMagnitude).toBe(1);
		expect(result.calculation?.armourReductionBasisPoints).toBe(7_499);
		expect(result.calculation?.finalDamage).toBe(1);
	});

	it('rejects unsafe damage arithmetic before mutating canonical state', () => {
		const arranged = state();
		expect(() =>
			resolveCombatAction({
				state: arranged,
				intent: intent(),
				legalAction: ACTION,
				authority: authority({
					damage: {
						...authority().damage!,
						baseMagnitude: Number.MAX_SAFE_INTEGER,
						coefficientBasisPoints: 10_001,
						criticalChanceBasisPoints: 0,
						status: null
					}
				}),
				rules: COMBAT_RULES_V1
			})
		).toThrow('safe integer');
		expect(arranged.combatants[ID.target]!.resources.health.current).toBe(500);
	});

	it('rejects provider-authored outcomes and invented targets', () => {
		const forgedIntent = {
			...intent(),
			damage: 999,
			hit: true,
			critical: true,
			status: 'dead',
			downed: true,
			loot: ['crown'],
			death: ID.target
		};
		expect(() =>
			resolveCombatAction({
				state: state(),
				intent: forgedIntent,
				legalAction: ACTION,
				authority: authority(),
				rules: COMBAT_RULES_V1
			})
		).toThrow();
		expect(() =>
			resolveCombatAction({
				state: state(),
				intent: {
					...intent(),
					target: { kind: 'entity', combatantId: ID.actor }
				},
				legalAction: ACTION,
				authority: authority(),
				rules: COMBAT_RULES_V1
			})
		).toThrow('not supplied by the legal action');
	});
});
