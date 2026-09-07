import type {
	CombatActorContextState,
	CombatLegalAction,
	CombatLegalActionTemplate,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../../hash.js';
import {
	advanceUntilDecision,
	assembleCombatDecisionWindow,
	buildCombatWindowSnapshot
} from './window.js';

const ID = {
	attempt: '31000000-0000-4000-8000-000000000001',
	hero: '31000000-0000-4000-8000-000000000002',
	ally: '31000000-0000-4000-8000-000000000003',
	visibleMonster: '31000000-0000-4000-8000-000000000004',
	hiddenMonster: '31000000-0000-4000-8000-000000000005',
	actionHero: '31000000-0000-4000-8000-000000000006',
	actionAlly: '31000000-0000-4000-8000-000000000007',
	telegraphVisible: 'raised-claw',
	telegraphHidden: 'hidden-strike'
} as const;

function combatant(
	combatantId: string,
	position: { x: number; y: number },
	teamId: 'party' | 'enemy',
	readiness = 10_000
) {
	return {
		combatantId,
		combatantKind: teamId === 'enemy' ? ('monster' as const) : ('hero' as const),
		teamId,
		position,
		resources: {
			health: { current: teamId === 'enemy' ? 70 : 90, maximum: 100 },
			mana: { current: teamId === 'enemy' ? 4 : 30, maximum: 40 }
		},
		lastDamagedAtTick: null,
		attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
		armour: teamId === 'enemy' ? 8 : 4,
		resistances: { cut: 500 },
		readiness: { value: readiness, exactNumerator: readiness, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function state(): ReadinessCombatStateV1 {
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed: '5'.repeat(64),
		attemptId: ID.attempt,
		tick: 7,
		combatants: {
			[ID.hiddenMonster]: combatant(ID.hiddenMonster, { x: 6, y: 6 }, 'enemy', 0),
			[ID.ally]: combatant(ID.ally, { x: 2, y: 1 }, 'party'),
			[ID.visibleMonster]: combatant(ID.visibleMonster, { x: 4, y: 1 }, 'enemy', 0),
			[ID.hero]: combatant(ID.hero, { x: 1, y: 1 }, 'party')
		},
		actorContexts: contexts(),
		terrain: {
			width: 8,
			height: 8,
			blockedTiles: [{ x: 0, y: 0 }],
			features: [{ featureId: 'cover-east', kind: 'cover', position: { x: 5, y: 1 } }]
		},
		visibleTelegraphs: [
			{
				telegraphId: ID.telegraphHidden,
				sourceCombatantId: ID.hiddenMonster,
				target: { kind: 'entity', combatantId: ID.ally },
				resolvesAtTick: 9,
				publicLabel: 'A hidden strike'
			},
			{
				telegraphId: ID.telegraphVisible,
				sourceCombatantId: ID.visibleMonster,
				target: { kind: 'entity', combatantId: ID.hero },
				resolvesAtTick: 8,
				publicLabel: 'A raised claw'
			}
		],
		scheduledEffects: [],
		safety: { ticksAdvanced: 7, eventsEmitted: 0, noProgressCycles: 0 },
		status: 'active',
		result: null
	};
}

function action(
	actionId: string,
	actionInstanceId: string,
	targetId: string,
	label: string,
	skillId: CombatLegalAction['skillId'] = 'combat-skill-basic-sword-strike'
): CombatLegalAction {
	return {
		actionId,
		actionInstanceId,
		actionKind: 'attack',
		skillId,
		publicLabel: label,
		targetContract: { kind: 'entity', allowedCombatantIds: [targetId] },
		reactionPriority: 0,
		recoveryTicks: 4,
		manaCost: 2,
		fallbackOptions: [
			{ fallbackId: 'hold-ground', publicLabel: 'Hold ground', target: { kind: 'self' } }
		]
	};
}

function actionTemplate(
	actionId: string,
	targetId: string,
	label: string,
	skillId: CombatLegalActionTemplate['skillId'] = 'combat-skill-basic-sword-strike'
): CombatLegalActionTemplate {
	const fullAction = action(actionId, ID.actionHero, targetId, label, skillId);
	return {
		actionId: fullAction.actionId,
		actionKind: fullAction.actionKind,
		skillId: fullAction.skillId,
		publicLabel: fullAction.publicLabel,
		targetContract: fullAction.targetContract,
		reactionPriority: fullAction.reactionPriority,
		recoveryTicks: fullAction.recoveryTicks,
		manaCost: fullAction.manaCost,
		fallbackOptions: fullAction.fallbackOptions
	};
}

function contexts(): Readonly<Record<string, CombatActorContextState>> {
	return {
		[ID.hero]: {
			actorId: ID.hero,
			visibleCombatantIds: [ID.visibleMonster, ID.ally],
			visibleTelegraphIds: [ID.telegraphVisible],
			observableReadinessActorIds: [ID.ally],
			visiblePositions: [
				{ x: 1, y: 1 },
				{ x: 2, y: 1 },
				{ x: 4, y: 1 },
				{ x: 5, y: 1 }
			],
			visibleTerrainFeatureIds: ['cover-east'],
			rememberedContext: ['The eastern beast recoils from pressure.'],
			doctrine: ['Protect allies before pursuing.'],
			relationships: [{ entityId: ID.ally, publicSummary: 'A trusted shield-partner.' }],
			masterDirections: ['Hold the eastern lane.'],
			legalActionTemplates: [actionTemplate('cross-cut', ID.visibleMonster, 'Cross Cut')]
		},
		[ID.ally]: {
			actorId: ID.ally,
			visibleCombatantIds: [ID.hiddenMonster, ID.hero],
			visibleTelegraphIds: [ID.telegraphHidden],
			observableReadinessActorIds: [],
			visiblePositions: [
				{ x: 1, y: 1 },
				{ x: 2, y: 1 },
				{ x: 6, y: 6 }
			],
			visibleTerrainFeatureIds: [],
			rememberedContext: ['Movement sounded beyond the southern cover.'],
			doctrine: ['Draw danger away from wounded allies.'],
			relationships: [{ entityId: ID.hero, publicSummary: 'A new but reliable companion.' }],
			masterDirections: ['Watch the southern approach.'],
			legalActionTemplates: [
				actionTemplate(
					'driving-shot',
					ID.hiddenMonster,
					'Driving Shot',
					'combat-skill-basic-bow-shot'
				)
			]
		}
	};
}

describe('frozen combat decision windows', () => {
	it('builds one canonical snapshot and distinct provider-safe views for a same-tick cohort', () => {
		const arranged = state();
		const inputHash = hashCanonical(arranged);
		const result = assembleCombatDecisionWindow({
			state: arranged,
			rules: COMBAT_RULES_V1,
			readyActorIds: [ID.ally, ID.hero],
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		});

		expect(result.snapshot.readyActorIds).toStrictEqual([ID.hero, ID.ally]);
		expect(result.views.map((view) => view.actorId)).toStrictEqual([ID.hero, ID.ally]);
		expect(new Set(result.views.map((view) => view.snapshotHash))).toStrictEqual(
			new Set([result.snapshot.snapshotHash])
		);
		const { snapshotHash, ...unsignedSnapshot } = result.snapshot;
		expect(snapshotHash).toBe(hashCanonical(unsignedSnapshot));
		for (const view of result.views) {
			const { actorViewHash, ...unsignedView } = view;
			expect(actorViewHash).toBe(hashCanonical(unsignedView));
			expect(view.legalActionSetHash).toBe(hashCanonical(view.legalActions));
		}
		expect(result.views[0]?.actorViewHash).not.toBe(result.views[1]?.actorViewHash);
		expect(result.views[0]?.legalActionSetHash).not.toBe(result.views[1]?.legalActionSetHash);
		expect(result.views[0]?.legalActions.map((legal) => legal.actionId)).toStrictEqual([
			'cross-cut'
		]);
		expect(result.views[1]?.legalActions.map((legal) => legal.actionId)).toStrictEqual([
			'driving-shot'
		]);
		expect(result.snapshot).not.toHaveProperty('actorContexts');
		expect(hashCanonical(arranged)).toBe(inputHash);
		expect(Object.isFrozen(result.snapshot)).toBe(true);
		expect(Object.isFrozen(result.snapshot.combatants[ID.hero]?.resources.health)).toBe(true);
		expect(Object.isFrozen(result.views[0]?.legalActions[0]?.fallbackOptions)).toBe(true);
		const changedContextState = state();
		changedContextState.actorContexts[ID.hero]!.doctrine = ['Withdraw if the eastern lane breaks.'];
		const changedSnapshot = buildCombatWindowSnapshot({
			state: changedContextState,
			rules: COMBAT_RULES_V1,
			readyActorIds: [ID.hero, ID.ally],
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		});
		expect(changedSnapshot.stateHash).not.toBe(result.snapshot.stateHash);
	});

	it('filters hidden truth, private readiness internals, ally private state, and unresolved choices', () => {
		const result = advanceUntilDecision(state(), COMBAT_RULES_V1);
		expect(result.kind).toBe('decision-window');
		if (result.kind !== 'decision-window') return;
		const heroView = result.views.find((view) => view.actorId === ID.hero)!;
		const encoded = JSON.stringify(heroView);

		expect(heroView.visibleCombatants.map((combatant) => combatant.combatantId)).toStrictEqual([
			ID.ally,
			ID.visibleMonster
		]);
		expect(heroView.visibleTelegraphs.map((telegraph) => telegraph.telegraphId)).toStrictEqual([
			ID.telegraphVisible
		]);
		expect(encoded).not.toContain(ID.hiddenMonster);
		expect(encoded).not.toContain('exactNumerator');
		expect(encoded).not.toContain('resistances');
		expect(encoded).not.toContain('armour');
		expect(encoded).not.toContain('cooldowns');
		expect(encoded).not.toContain('unresolvedChoices');
		expect(encoded).not.toContain(state().seed);
		expect(encoded).not.toContain('actorContexts');
		expect(encoded).not.toContain('legalActionTemplates');
		expect(result.views.find((view) => view.actorId === ID.ally)?.actorViewHash).not.toBe(
			heroView.actorViewHash
		);
	});

	it('rejects legal targets and terrain details outside the actor perception', () => {
		const actorContexts = contexts();
		const heroContext = actorContexts[ID.hero]!;
		expect(() =>
			assembleCombatDecisionWindow({
				state: {
					...state(),
					actorContexts: {
						...actorContexts,
						[ID.hero]: {
							...heroContext,
							legalActionTemplates: [
								actionTemplate('hidden-strike', ID.hiddenMonster, 'Hidden Strike')
							]
						}
					}
				},
				rules: COMBAT_RULES_V1,
				readyActorIds: [ID.hero, ID.ally],
				contentHash: COMBAT_CONTENT_BINDING.contentHash
			})
		).toThrow('visible');

		expect(() =>
			assembleCombatDecisionWindow({
				state: {
					...state(),
					actorContexts: {
						...actorContexts,
						[ID.hero]: {
							...heroContext,
							visiblePositions: [...heroContext.visiblePositions, { x: 8, y: 1 }]
						}
					}
				},
				rules: COMBAT_RULES_V1,
				readyActorIds: [ID.hero, ID.ally],
				contentHash: COMBAT_CONTENT_BINDING.contentHash
			})
		).toThrow('outside');

		expect(() =>
			assembleCombatDecisionWindow({
				state: {
					...state(),
					actorContexts: {
						...actorContexts,
						[ID.hero]: {
							...heroContext,
							visiblePositions: [...heroContext.visiblePositions, { x: 0, y: 0 }],
							legalActionTemplates: [
								{
									actionId: 'move-into-wall',
									actionKind: 'move',
									skillId: null,
									publicLabel: 'Move into wall',
									targetContract: {
										kind: 'tile',
										allowedPositions: [{ x: 0, y: 0 }]
									},
									reactionPriority: 0,
									recoveryTicks: 2,
									manaCost: 0,
									fallbackOptions: [
										{
											fallbackId: 'stay',
											publicLabel: 'Stay',
											target: { kind: 'self' }
										}
									]
								}
							]
						}
					}
				},
				rules: COMBAT_RULES_V1,
				readyActorIds: [ID.hero, ID.ally],
				contentHash: COMBAT_CONTENT_BINDING.contentHash
			})
		).toThrow('Tile targets');

		expect(() =>
			assembleCombatDecisionWindow({
				state: {
					...state(),
					actorContexts: {
						...actorContexts,
						[ID.hero]: {
							...heroContext,
							legalActionTemplates: [
								{
									actionId: 'unseen-flank',
									actionKind: 'move',
									skillId: null,
									publicLabel: 'Unseen flank',
									targetContract: {
										kind: 'entity-relative-position',
										allowedCombatantIds: [ID.visibleMonster],
										allowedRelations: ['flank-left']
									},
									reactionPriority: 0,
									recoveryTicks: 2,
									manaCost: 0,
									fallbackOptions: [
										{
											fallbackId: 'stay',
											publicLabel: 'Stay',
											target: { kind: 'self' }
										}
									]
								}
							]
						}
					}
				},
				rules: COMBAT_RULES_V1,
				readyActorIds: [ID.hero, ID.ally],
				contentHash: COMBAT_CONTENT_BINDING.contentHash
			})
		).toThrow('Relative targets');
	});

	it('returns a typed deterministic safety stop when a ready actor lacks engine-owned context', () => {
		const arranged = state();
		arranged.actorContexts = { [ID.hero]: arranged.actorContexts[ID.hero]! };
		const left = advanceUntilDecision(arranged, COMBAT_RULES_V1);
		const right = advanceUntilDecision(arranged, COMBAT_RULES_V1);

		expect(left).toStrictEqual(right);
		expect(left.kind).toBe('combat-result');
		if (left.kind !== 'combat-result') return;
		expect(left.result.outcome).toBe('safety-stop');
		expect(left.result.safetyStop?.reason).toBe('invalid-state');
	});

	it('rejects a ready actor set that does not exactly match canonical readiness', () => {
		expect(() =>
			buildCombatWindowSnapshot({
				state: state(),
				rules: COMBAT_RULES_V1,
				readyActorIds: [ID.hero],
				contentHash: COMBAT_CONTENT_BINDING.contentHash
			})
		).toThrow('ready actor set');
	});

	it('is byte-stable across semantically irrelevant record and context insertion order', () => {
		const arranged = state();
		arranged.scheduledEffects = [
			{
				scheduledEffectId: '31000000-0000-4000-8000-000000000010',
				resolvesAtTick: 10,
				sourceCombatantId: ID.visibleMonster,
				effects: [
					{
						kind: 'resource',
						combatantId: ID.hero,
						resource: 'health',
						before: 90,
						after: 89,
						delta: -1
					}
				]
			},
			{
				scheduledEffectId: '31000000-0000-4000-8000-000000000011',
				resolvesAtTick: 11,
				sourceCombatantId: ID.hiddenMonster,
				effects: [
					{
						kind: 'resource',
						combatantId: ID.ally,
						resource: 'mana',
						before: 30,
						after: 29,
						delta: -1
					}
				]
			}
		];
		const reversed = {
			...arranged,
			combatants: Object.fromEntries(Object.entries(arranged.combatants).reverse()),
			actorContexts: Object.fromEntries(Object.entries(arranged.actorContexts).reverse()),
			visibleTelegraphs: [...arranged.visibleTelegraphs].reverse(),
			scheduledEffects: [...arranged.scheduledEffects].reverse()
		};
		const left = assembleCombatDecisionWindow({
			state: arranged,
			rules: COMBAT_RULES_V1,
			readyActorIds: [ID.hero, ID.ally],
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		});
		const right = assembleCombatDecisionWindow({
			state: reversed,
			rules: COMBAT_RULES_V1,
			readyActorIds: [ID.ally, ID.hero],
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		});

		expect(right).toStrictEqual(left);
	});

	it('composes readiness advancement into the exact public stepped contract', () => {
		const arranged = state();
		for (const actor of [arranged.combatants[ID.hero]!, arranged.combatants[ID.ally]!]) {
			actor.readiness = { value: 9_899, exactNumerator: 9_899, recoveryUntilTick: 0 };
		}
		const result = advanceUntilDecision(arranged, COMBAT_RULES_V1);

		expect(result.kind).toBe('decision-window');
		if (result.kind !== 'decision-window') return;
		expect(result.snapshot.tick).toBe(8);
		expect(result.views.map((view) => view.actorId)).toStrictEqual(result.snapshot.readyActorIds);
		expect(result.views.every((view) => view.legalActions.length > 0)).toBe(true);
		expect(result.views.every((view) => view.snapshotHash === result.snapshot.snapshotHash)).toBe(
			true
		);
	});
});
