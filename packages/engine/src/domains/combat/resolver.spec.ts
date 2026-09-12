import type {
	CombatActionIntent,
	CombatActionResolutionProfile,
	CombatLegalActionTemplate,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { hashCanonical, sha256Hex } from '../../hash.js';
import { createReadinessCombatOutcomeEvidence } from './outcome.js';
import { resolveCombatAction } from './resolver.js';
import { advanceUntilDecision } from './window.js';

const ID = {
	attempt: '42000000-0000-4000-8000-000000000001',
	actor: '42000000-0000-4000-8000-000000000002',
	ally: '42000000-0000-4000-8000-000000000003',
	target: '42000000-0000-4000-8000-000000000004'
} as const;

type AttackProfile = Extract<CombatActionResolutionProfile, { profileKind: 'attack' }>;

function profile(overrides: Partial<AttackProfile> = {}): AttackProfile {
	return {
		profileKind: 'attack',
		rulesVersion: 'combat-rules-v1',
		contentHash: COMBAT_CONTENT_BINDING.contentHash,
		deliveryTag: 'one-handed-blade',
		masteryStepMinimum: 0,
		skillAccuracyBasisPoints: 6_750,
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

function attackTemplate(resolutionProfile = profile()): CombatLegalActionTemplate {
	return {
		actionId: 'cross-cut',
		actionKind: 'attack',
		skillId: 'combat-skill-basic-sword-strike',
		publicLabel: 'Cross Cut',
		targetContract: { kind: 'entity', allowedCombatantIds: [ID.target] },
		reactionPriority: 0,
		recoveryTicks: 4,
		manaCost: 2,
		conflictPolicy: {
			invalidTarget: 'cancel',
			occupiedDestination: 'cancel',
			cancellationRefund: { mana: 'none', readiness: 'none' }
		},
		fallbackOptions: [
			{ fallbackId: 'hold-ground', publicLabel: 'Hold Ground', target: { kind: 'self' } }
		],
		resolutionProfile
	};
}

const GUARD_TEMPLATE = {
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

function fighter(
	combatantId: string,
	teamId: 'party' | 'enemy',
	position: { x: number; y: number },
	options: {
		mana?: number | undefined;
		health?: number | undefined;
		agility?: number | undefined;
		readiness?: number;
		facing?: 'north' | 'east' | 'south' | 'west';
		unaware?: boolean | undefined;
	} = {}
) {
	return {
		combatantId,
		combatantKind: teamId === 'party' ? ('hero' as const) : ('monster' as const),
		teamId,
		position,
		facing: options.facing ?? (teamId === 'party' ? ('east' as const) : ('west' as const)),
		resources: {
			health: { current: options.health ?? 500, maximum: 500 },
			mana: { current: options.mana ?? 20, maximum: 100 }
		},
		lastDamagedAtTick: null,
		attributes: { strength: 20, vitality: 20, agility: options.agility ?? 20, magic: 20 },
		armour: teamId === 'enemy' ? 100 : 0,
		resistances: teamId === 'enemy' ? { cut: 2_000, burn: 7_500 } : {},
		readiness: {
			value: options.readiness ?? 0,
			exactNumerator: options.readiness ?? 0,
			recoveryUntilTick: 0
		},
		conditions: options.unaware
			? [
					{
						conditionId: 'unaware',
						stacks: 1,
						appliedAtTick: 0,
						expiresAtTick: null,
						sourceCombatantId: null
					}
				]
			: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function state(
	options: {
		seed?: string;
		actorMana?: number;
		actorAgility?: number;
		targetAgility?: number;
		targetHealth?: number;
		targetFacing?: 'north' | 'east' | 'south' | 'west';
		includeAlly?: boolean;
		unaware?: boolean;
		resolutionProfile?: AttackProfile;
		tick?: number;
	} = {}
): ReadinessCombatStateV1 {
	const combatants: ReadinessCombatStateV1['combatants'] = {
		[ID.actor]: fighter(
			ID.actor,
			'party',
			{ x: 1, y: 1 },
			{
				mana: options.actorMana,
				agility: options.actorAgility,
				readiness: 10_000
			}
		),
		[ID.target]: fighter(
			ID.target,
			'enemy',
			{ x: 2, y: 1 },
			{
				health: options.targetHealth,
				agility: options.targetAgility,
				facing: options.targetFacing ?? 'north',
				unaware: options.unaware
			}
		)
	};
	if (options.includeAlly) {
		combatants[ID.ally] = fighter(ID.ally, 'party', { x: 2, y: 2 });
	}
	const actorContexts: ReadinessCombatStateV1['actorContexts'] = {
		[ID.actor]: {
			actorId: ID.actor,
			visibleCombatantIds: options.includeAlly ? [ID.target, ID.ally] : [ID.target],
			visibleTelegraphIds: [],
			observableReadinessActorIds: [],
			targetablePositions: [
				{ x: 1, y: 1 },
				{ x: 2, y: 1 },
				...(options.includeAlly ? [{ x: 2, y: 2 }] : [])
			],
			visibleTerrainFeatureIds: [],
			rememberedContext: [],
			doctrine: [],
			relationships: [],
			masterDirections: [],
			legalActionTemplates: [attackTemplate(options.resolutionProfile), GUARD_TEMPLATE]
		},
		[ID.target]: {
			actorId: ID.target,
			visibleCombatantIds: [],
			visibleTelegraphIds: [],
			observableReadinessActorIds: [],
			targetablePositions: [{ x: 2, y: 1 }],
			visibleTerrainFeatureIds: [],
			rememberedContext: [],
			doctrine: [],
			relationships: [],
			masterDirections: [],
			legalActionTemplates: [GUARD_TEMPLATE]
		}
	};
	if (options.includeAlly) {
		actorContexts[ID.ally] = {
			actorId: ID.ally,
			visibleCombatantIds: [],
			visibleTelegraphIds: [],
			observableReadinessActorIds: [],
			targetablePositions: [{ x: 2, y: 2 }],
			visibleTerrainFeatureIds: [],
			rememberedContext: [],
			doctrine: [],
			relationships: [],
			masterDirections: [],
			legalActionTemplates: [GUARD_TEMPLATE]
		};
	}
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed: options.seed ?? sha256Hex('resolver-private-seed'),
		attemptId: ID.attempt,
		tick: options.tick ?? 13,
		combatants,
		actorContexts,
		terrain: { width: 4, height: 4, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 13, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: createReadinessCombatOutcomeEvidence({ attemptId: ID.attempt, combatants }),
		status: 'active',
		result: null
	};
}

function decision(canonical: ReadinessCombatStateV1, publicIntent = 'Cross cut.') {
	const advance = advanceUntilDecision(canonical, COMBAT_RULES_V1);
	if (advance.kind !== 'decision-window') throw new Error('Expected decision window');
	const view = advance.views.find((candidate) => candidate.actorId === ID.actor)!;
	const action = view.legalActions.find((candidate) => candidate.actionId === 'cross-cut');
	if (!action) throw new Error('Expected an affordable Cross Cut');
	const intent: CombatActionIntent = {
		windowId: advance.snapshot.windowId,
		attemptId: advance.snapshot.attemptId,
		tick: advance.snapshot.tick,
		actorId: ID.actor,
		snapshotHash: advance.snapshot.snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: action.actionId,
		actionInstanceId: action.actionInstanceId,
		actionKind: action.actionKind,
		skillId: action.skillId,
		target: { kind: 'entity', combatantId: ID.target },
		fallbackId: 'hold-ground',
		publicIntent
	};
	return { intent, action };
}

function findOutcome(hit: boolean) {
	for (let index = 0; index < 1_000; index += 1) {
		const canonical = state({ seed: sha256Hex(`resolver-outcome-${index}`) });
		const { intent } = decision(canonical);
		const result = resolveCombatAction({ state: canonical, intent, rules: COMBAT_RULES_V1 });
		if (result.outcome.hit === hit) return { canonical, intent, result };
	}
	throw new Error('No deterministic outcome found');
}

describe('authoritative combat action resolution', () => {
	it('rederives evidence and uses only the catalog-bound private canonical profile', () => {
		const { canonical, result } = findOutcome(true);
		expect(result.hitContest).toStrictEqual({
			skillAccuracyBasisPoints: 6_750,
			defenderEvasionBasisPoints: 20,
			relativeAgilityBasisPoints: 0,
			flank: true,
			surround: false,
			unaware: false,
			positionalBasisPoints: 600,
			chanceBasisPoints: 7_330
		});
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
		expect(result.effects[0]).toStrictEqual({
			kind: 'resource',
			combatantId: ID.actor,
			resource: 'mana',
			before: 20,
			after: 18,
			delta: -2
		});
		expect(result.state.combatants[ID.target]!.resources.health.current).toBe(368);
		expect(canonical.combatants[ID.actor]!.resources.mana.current).toBe(20);
	});

	it('derives evasion, flank, surround, unaware, and capped relative Agility from state', () => {
		const canonical = state({
			actorAgility: 100,
			targetAgility: 1,
			includeAlly: true,
			unaware: true
		});
		const result = resolveCombatAction({
			state: canonical,
			intent: decision(canonical).intent,
			rules: COMBAT_RULES_V1
		});
		expect(result.hitContest).toMatchObject({
			defenderEvasionBasisPoints: 1,
			relativeAgilityBasisPoints: 900,
			flank: true,
			surround: true,
			unaware: true,
			positionalBasisPoints: 2_500,
			chanceBasisPoints: 9_950
		});
	});

	it('debits Mana exactly once on a miss and never regenerates during resolution', () => {
		const { canonical, result } = findOutcome(false);
		expect(result.outcome).toStrictEqual({
			hit: false,
			critical: false,
			statusApplied: false,
			downed: false
		});
		expect(result.effects).toStrictEqual([
			{
				kind: 'resource',
				combatantId: ID.actor,
				resource: 'mana',
				before: 20,
				after: 18,
				delta: -2
			}
		]);
		expect(result.state.combatants[ID.target]!.resources).toStrictEqual(
			canonical.combatants[ID.target]!.resources
		);
	});

	it('filters unaffordable actions and rejects their stale intent without mutation', () => {
		const rich = state();
		const staleIntent = decision(rich).intent;
		const poor = state({ actorMana: 1 });
		const advance = advanceUntilDecision(poor, COMBAT_RULES_V1);
		expect(advance.kind).toBe('decision-window');
		if (advance.kind !== 'decision-window') return;
		expect(advance.views[0]!.legalActions.map((action) => action.actionId)).toStrictEqual([
			'guard-self'
		]);
		const before = hashCanonical(poor);
		expect(() =>
			resolveCombatAction({ state: poor, intent: staleIntent, rules: COMBAT_RULES_V1 })
		).toThrow();
		expect(hashCanonical(poor)).toBe(before);
	});

	it.each([
		['window', { windowId: ID.attempt }],
		['snapshot', { snapshotHash: 'f'.repeat(64) }],
		['view', { actorViewHash: 'e'.repeat(64) }],
		['legal set', { legalActionSetHash: 'd'.repeat(64) }],
		['instance', { actionInstanceId: ID.attempt }],
		['kind', { actionKind: 'guard' }],
		['skill', { skillId: null }]
	] as const)('rejects forged %s binding atomically', (_label, forged) => {
		const canonical = state();
		const intent = { ...decision(canonical).intent, ...forged };
		const before = hashCanonical(canonical);
		expect(() =>
			resolveCombatAction({ state: canonical, intent, rules: COMBAT_RULES_V1 })
		).toThrow();
		expect(hashCanonical(canonical)).toBe(before);
	});

	it('rejects content, mastery accuracy, and delivery drift from immutable catalogs', () => {
		for (const changed of [
			{ contentHash: 'f'.repeat(64) },
			{ skillAccuracyBasisPoints: 6_751 },
			{ deliveryTag: 'bow' as const }
		]) {
			const canonical = state({ resolutionProfile: profile(changed) });
			const before = hashCanonical(canonical);
			expect(() =>
				resolveCombatAction({
					state: canonical,
					intent: decision(canonical).intent,
					rules: COMBAT_RULES_V1
				})
			).toThrow();
			expect(hashCanonical(canonical)).toBe(before);
		}
	});

	it('rejects an action conflict policy that drifts from its immutable skill', () => {
		const canonical = state();
		const template = canonical.actorContexts[ID.actor]!.legalActionTemplates.find(
			(action) => action.actionId === 'cross-cut'
		)!;
		template.conflictPolicy = {
			invalidTarget: 'selected-fallback',
			occupiedDestination: 'cancel',
			cancellationRefund: { mana: 'full', readiness: 'full' }
		};
		const before = hashCanonical(canonical);
		expect(() =>
			resolveCombatAction({
				state: canonical,
				intent: decision(canonical).intent,
				rules: COMBAT_RULES_V1
			})
		).toThrow('skill catalog');
		expect(hashCanonical(canonical)).toBe(before);
	});

	it('rejects caller-modified combat rules before resolving canonical state', () => {
		const canonical = state();
		const forgedRules = {
			...COMBAT_RULES_V1,
			hit: { ...COMBAT_RULES_V1.hit, flankBasisPoints: 601 }
		};
		const before = hashCanonical(canonical);
		expect(() =>
			resolveCombatAction({
				state: canonical,
				intent: decision(canonical).intent,
				rules: forgedRules
			})
		).toThrow('immutable combat rules');
		expect(hashCanonical(canonical)).toBe(before);
	});

	it('clamps lethal damage to zero, downs exactly once, and applies no status', () => {
		for (let index = 0; index < 1_000; index += 1) {
			const canonical = state({ targetHealth: 5, seed: sha256Hex(`lethal-${index}`) });
			const result = resolveCombatAction({
				state: canonical,
				intent: decision(canonical).intent,
				rules: COMBAT_RULES_V1
			});
			if (!result.outcome.hit) continue;
			expect(result.calculation?.finalDamage).toBe(5);
			expect(result.state.combatants[ID.target]).toMatchObject({
				resources: { health: { current: 0 } },
				downed: true,
				active: false
			});
			expect(result.outcome.statusApplied).toBe(false);
			expect(result.effects.at(-1)).toStrictEqual({ kind: 'downed', combatantId: ID.target });
			return;
		}
		throw new Error('No lethal hit found');
	});

	it('rejects provider outcomes while prose cannot alter resolution', () => {
		const canonical = state();
		const first = decision(canonical, 'First prose.').intent;
		const second = { ...first, publicIntent: 'Different prose.' };
		expect(
			resolveCombatAction({ state: canonical, intent: second, rules: COMBAT_RULES_V1 })
		).toStrictEqual(
			resolveCombatAction({ state: canonical, intent: first, rules: COMBAT_RULES_V1 })
		);
		expect(() =>
			resolveCombatAction({
				state: canonical,
				intent: { ...first, damage: 999, hit: true, death: ID.target } as CombatActionIntent,
				rules: COMBAT_RULES_V1
			})
		).toThrow();
	});

	it('rejects late status expiry overflow before changing Mana or Health', () => {
		const base = profile();
		const canonical = state({
			tick: Number.MAX_SAFE_INTEGER,
			resolutionProfile: profile({
				damage: { ...base.damage, status: { ...base.damage.status!, durationTicks: 1 } }
			})
		});
		const before = hashCanonical(canonical);
		expect(() =>
			resolveCombatAction({
				state: canonical,
				intent: decision(canonical).intent,
				rules: COMBAT_RULES_V1
			})
		).toThrow('safe integer');
		expect(hashCanonical(canonical)).toBe(before);
	});
});
