import type {
	CombatActionConflictPolicy,
	CombatActionIntent,
	CombatActionResolutionProfile,
	CombatChoiceBatchV1,
	CombatLegalActionTemplate,
	CombatTargetSelectionSchema,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { hashCanonical, sha256Hex } from '../../hash.js';
import { applyCombatChoiceBatch, combatChoiceBatchHash } from './arbitration.js';
import { advanceUntilDecision } from './window.js';

const ID = {
	attempt: '51000000-0000-4000-8000-000000000001',
	batch: '51000000-0000-4000-8000-000000000002',
	a: '51000000-0000-4000-8000-000000000003',
	b: '51000000-0000-4000-8000-000000000004',
	c: '51000000-0000-4000-8000-000000000005',
	target: '51000000-0000-4000-8000-000000000006'
} as const;

type Target = z.infer<typeof CombatTargetSelectionSchema>;
type AttackProfile = Extract<CombatActionResolutionProfile, { profileKind: 'attack' }>;

const FULL_REFUND: CombatActionConflictPolicy = {
	invalidTarget: 'selected-fallback',
	occupiedDestination: 'selected-fallback',
	cancellationRefund: { mana: 'full', readiness: 'full' }
};
const NO_REFUND: CombatActionConflictPolicy = {
	invalidTarget: 'cancel',
	occupiedDestination: 'cancel',
	cancellationRefund: { mana: 'none', readiness: 'none' }
};

function nonDamagingProfile() {
	return {
		profileKind: 'non-damaging' as const,
		rulesVersion: 'combat-rules-v1' as const,
		contentHash: COMBAT_CONTENT_BINDING.contentHash
	};
}

function guardTemplate(): CombatLegalActionTemplate {
	return {
		actionId: 'guard-self',
		actionKind: 'guard',
		skillId: null,
		publicLabel: 'Guard',
		targetContract: { kind: 'self' },
		reactionPriority: -100,
		recoveryTicks: 2,
		manaCost: 0,
		conflictPolicy: FULL_REFUND,
		fallbackOptions: [{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' } }],
		resolutionProfile: nonDamagingProfile()
	};
}

function moveTemplate(input: {
	actionId: string;
	target: Target;
	fallback: Target;
	reactionPriority?: number;
	conflictPolicy?: CombatActionConflictPolicy;
}): CombatLegalActionTemplate {
	const targetContract =
		input.target.kind === 'tile'
			? { kind: 'tile' as const, allowedPositions: [input.target.position] }
			: input.target.kind === 'entity-relative-position'
				? {
						kind: 'entity-relative-position' as const,
						allowedCombatantIds: [input.target.combatantId],
						allowedRelations: [input.target.relation]
					}
				: { kind: 'self' as const };
	return {
		actionId: input.actionId,
		actionKind: 'move',
		skillId: null,
		publicLabel: input.actionId,
		targetContract,
		reactionPriority: input.reactionPriority ?? 0,
		recoveryTicks: 5,
		manaCost: 3,
		conflictPolicy: input.conflictPolicy ?? FULL_REFUND,
		fallbackOptions: [
			{ fallbackId: 'alternate', publicLabel: 'Alternate', target: input.fallback }
		],
		resolutionProfile: nonDamagingProfile()
	};
}

function attackProfile(): AttackProfile {
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
			baseMagnitude: 1_000,
			coefficientBasisPoints: 10_000,
			affinityContributionBasisPoints: 0,
			criticalChanceBasisPoints: 0,
			criticalMultiplierBasisPoints: 10_000,
			penetration: 1_000_000,
			status: null
		}
	};
}

function attackTemplate(actionId: string, policy = NO_REFUND): CombatLegalActionTemplate {
	return {
		actionId,
		actionKind: 'attack',
		skillId: 'combat-skill-basic-sword-strike',
		publicLabel: actionId,
		targetContract: { kind: 'entity', allowedCombatantIds: [ID.target] },
		reactionPriority: 0,
		recoveryTicks: 5,
		manaCost: 3,
		conflictPolicy: policy,
		fallbackOptions: [{ fallbackId: 'alternate', publicLabel: 'Hold', target: { kind: 'self' } }],
		resolutionProfile: attackProfile()
	};
}

function fighter(
	combatantId: string,
	position: { x: number; y: number },
	readiness: number,
	health = 100
) {
	return {
		combatantId,
		combatantKind: combatantId === ID.target ? ('monster' as const) : ('hero' as const),
		teamId: combatantId === ID.target ? 'enemy' : 'party',
		position,
		facing: combatantId === ID.target ? ('west' as const) : ('east' as const),
		resources: { health: { current: health, maximum: 100 }, mana: { current: 20, maximum: 20 } },
		lastDamagedAtTick: null,
		attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
		armour: 0,
		resistances: {},
		readiness: {
			value: Math.min(10_000, readiness),
			exactNumerator: readiness,
			recoveryUntilTick: 0
		},
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function state(input: {
	actionByActor: Partial<Record<(typeof ID)[keyof typeof ID], CombatLegalActionTemplate>>;
	positions?: Partial<Record<(typeof ID)[keyof typeof ID], { x: number; y: number }>>;
	readiness?: Partial<Record<(typeof ID)[keyof typeof ID], number>>;
	include?: readonly string[];
	targetHealth?: number;
	seed?: string;
}): ReadinessCombatStateV1 {
	const ids = input.include ?? [ID.a, ID.b, ID.target];
	const defaults = {
		[ID.a]: { x: 1, y: 1 },
		[ID.b]: { x: 4, y: 1 },
		[ID.c]: { x: 1, y: 4 },
		[ID.target]: { x: 3, y: 3 }
	};
	const combatants = Object.fromEntries(
		ids.map((id) => [
			id,
			fighter(
				id,
				input.positions?.[id as keyof typeof input.positions] ??
					defaults[id as keyof typeof defaults],
				input.readiness?.[id as keyof typeof input.readiness] ?? (id === ID.target ? 0 : 10_000),
				id === ID.target ? (input.targetHealth ?? 100) : 100
			)
		])
	) as ReadinessCombatStateV1['combatants'];
	const allPositions = Array.from({ length: 36 }, (_, index) => ({
		x: index % 6,
		y: Math.floor(index / 6)
	}));
	const actorContexts = Object.fromEntries(
		ids.map((id) => [
			id,
			{
				actorId: id,
				visibleCombatantIds: ids.filter((other) => other !== id),
				visibleTelegraphIds: [],
				observableReadinessActorIds: [],
				targetablePositions: allPositions,
				visibleTerrainFeatureIds: [],
				rememberedContext: [],
				doctrine: [],
				relationships: [],
				masterDirections: [],
				legalActionTemplates: [
					input.actionByActor[id as keyof typeof input.actionByActor],
					guardTemplate()
				].filter((action): action is CombatLegalActionTemplate => Boolean(action))
			}
		])
	) as ReadinessCombatStateV1['actorContexts'];
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed: input.seed ?? sha256Hex('arbitration-seed'),
		attemptId: ID.attempt,
		tick: 20,
		combatants,
		actorContexts,
		terrain: { width: 6, height: 6, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 20, eventsEmitted: 0, noProgressCycles: 0 },
		status: 'active',
		result: null
	};
}

function choiceBatch(
	canonical: ReadinessCombatStateV1,
	selections: Record<string, { actionId: string; target: Target; fallbackId?: string | null }>,
	reverse = false
): CombatChoiceBatchV1 {
	const advance = advanceUntilDecision(canonical, COMBAT_RULES_V1);
	if (advance.kind !== 'decision-window') throw new Error('Expected decision window');
	const choices = advance.views.map((view): CombatActionIntent => {
		const selection = selections[view.actorId]!;
		const action = view.legalActions.find(
			(candidate) => candidate.actionId === selection.actionId
		)!;
		return {
			windowId: advance.snapshot.windowId,
			attemptId: advance.snapshot.attemptId,
			tick: advance.snapshot.tick,
			actorId: view.actorId,
			snapshotHash: advance.snapshot.snapshotHash,
			actorViewHash: view.actorViewHash,
			legalActionSetHash: view.legalActionSetHash,
			actionId: action.actionId,
			actionInstanceId: action.actionInstanceId,
			actionKind: action.actionKind,
			skillId: action.skillId,
			target: selection.target,
			fallbackId: selection.fallbackId ?? 'alternate'
		};
	});
	if (reverse) choices.reverse();
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId: ID.batch,
		windowId: advance.snapshot.windowId,
		attemptId: advance.snapshot.attemptId,
		tick: advance.snapshot.tick,
		snapshotHash: advance.snapshot.snapshotHash,
		choices
	};
	return { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) };
}

describe('same-window combat arbitration', () => {
	it('orders by readiness and lets only the earlier actor claim a tile before applying the selected fallback', () => {
		const destination = { kind: 'tile' as const, position: { x: 2, y: 2 } };
		const fallback = { kind: 'tile' as const, position: { x: 2, y: 3 } };
		const canonical = state({
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'advance-a',
					target: destination,
					fallback: { kind: 'self' }
				}),
				[ID.b]: moveTemplate({ actionId: 'advance-b', target: destination, fallback })
			},
			readiness: { [ID.a]: 12_000, [ID.b]: 11_000 }
		});
		const batch = choiceBatch(canonical, {
			[ID.a]: { actionId: 'advance-a', target: destination },
			[ID.b]: { actionId: 'advance-b', target: destination }
		});
		const result = applyCombatChoiceBatch(canonical, batch, COMBAT_RULES_V1);
		expect(result.events.map((event) => [event.actorId, event.finalOutcome])).toStrictEqual([
			[ID.a, 'applied'],
			[ID.b, 'superseded']
		]);
		expect(result.events[1]).toMatchObject({
			conflictingEventId: result.events[0]!.eventId,
			fallbackApplied: { fallbackId: 'alternate', target: fallback },
			refundApplied: null
		});
		expect(result.state.combatants[ID.a]!.position).toStrictEqual(destination.position);
		expect(result.state.combatants[ID.b]!.position).toStrictEqual(fallback.position);
	});

	it('allows both actors to flank independently and recalculates the later entity-relative tile around the moved target', () => {
		const aTarget = {
			kind: 'entity-relative-position' as const,
			combatantId: ID.b,
			relation: 'flank-left' as const
		};
		const bTarget = { ...aTarget, combatantId: ID.a };
		const canonical = state({
			actionByActor: {
				[ID.a]: moveTemplate({ actionId: 'flank-a', target: aTarget, fallback: { kind: 'self' } }),
				[ID.b]: moveTemplate({ actionId: 'flank-b', target: bTarget, fallback: { kind: 'self' } })
			},
			positions: { [ID.a]: { x: 1, y: 3 }, [ID.b]: { x: 3, y: 3 } },
			readiness: { [ID.a]: 12_000, [ID.b]: 11_000 }
		});
		const result = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.a]: { actionId: 'flank-a', target: aTarget },
				[ID.b]: { actionId: 'flank-b', target: bTarget }
			}),
			COMBAT_RULES_V1
		);
		expect(result.events.map((event) => event.finalOutcome)).toStrictEqual(['applied', 'applied']);
		expect(result.state.combatants[ID.a]!.position).toStrictEqual({ x: 3, y: 2 });
		expect(result.state.combatants[ID.b]!.position).toStrictEqual({ x: 3, y: 1 });
	});

	it('keeps a fixed-tile move fixed after an earlier action moves its observed target', () => {
		const targetMove = { kind: 'tile' as const, position: { x: 4, y: 4 } };
		const fixedMove = { kind: 'tile' as const, position: { x: 2, y: 4 } };
		const canonical = state({
			include: [ID.target, ID.b],
			actionByActor: {
				[ID.target]: moveTemplate({
					actionId: 'move-target',
					target: targetMove,
					fallback: { kind: 'self' }
				}),
				[ID.b]: moveTemplate({ actionId: 'fixed-b', target: fixedMove, fallback: { kind: 'self' } })
			},
			readiness: { [ID.target]: 12_000, [ID.b]: 11_000 }
		});
		const result = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.target]: { actionId: 'move-target', target: targetMove },
				[ID.b]: { actionId: 'fixed-b', target: fixedMove }
			}),
			COMBAT_RULES_V1
		);
		expect(result.state.combatants[ID.target]!.position).toStrictEqual(targetMove.position);
		expect(result.state.combatants[ID.b]!.position).toStrictEqual(fixedMove.position);
	});

	it('cancels a later attack after the earlier actor downs its target and applies authored no-refund costs', () => {
		let observed: ReturnType<typeof applyCombatChoiceBatch> | undefined;
		for (let index = 0; index < 100 && !observed; index += 1) {
			const canonical = state({
				actionByActor: {
					[ID.a]: attackTemplate('strike-a'),
					[ID.b]: attackTemplate('strike-b')
				},
				readiness: { [ID.a]: 12_000, [ID.b]: 11_000 },
				targetHealth: 1,
				seed: sha256Hex(`arbitration-down-${index}`)
			});
			const candidate = applyCombatChoiceBatch(
				canonical,
				choiceBatch(canonical, {
					[ID.a]: { actionId: 'strike-a', target: { kind: 'entity', combatantId: ID.target } },
					[ID.b]: { actionId: 'strike-b', target: { kind: 'entity', combatantId: ID.target } }
				}),
				COMBAT_RULES_V1
			);
			if (candidate.state.combatants[ID.target]!.downed) observed = candidate;
		}
		expect(observed).toBeDefined();
		const result = observed!;
		expect(result.events[1]).toMatchObject({
			actorId: ID.b,
			conflictingEventId: result.events[0]!.eventId,
			fallbackApplied: null,
			refundApplied: { mana: 'none', readiness: 'none' },
			finalOutcome: 'canceled'
		});
		expect(result.state.combatants[ID.b]!.resources.mana.current).toBe(17);
		expect(result.state.combatants[ID.b]!.readiness).toStrictEqual({
			value: 1_000,
			exactNumerator: 1_000,
			recoveryUntilTick: 25
		});
	});

	it('cancels when both the original tile and the selected fallback have been claimed', () => {
		const primary = { kind: 'tile' as const, position: { x: 2, y: 2 } };
		const alternate = { kind: 'tile' as const, position: { x: 3, y: 2 } };
		const canonical = state({
			include: [ID.a, ID.b, ID.c, ID.target],
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'claim-primary',
					target: primary,
					fallback: { kind: 'self' }
				}),
				[ID.b]: moveTemplate({ actionId: 'late-choice', target: primary, fallback: alternate }),
				[ID.c]: moveTemplate({
					actionId: 'claim-alternate',
					target: alternate,
					fallback: { kind: 'self' }
				})
			},
			readiness: { [ID.c]: 13_000, [ID.a]: 12_000, [ID.b]: 11_000 }
		});
		const result = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.a]: { actionId: 'claim-primary', target: primary },
				[ID.b]: { actionId: 'late-choice', target: primary },
				[ID.c]: { actionId: 'claim-alternate', target: alternate }
			}),
			COMBAT_RULES_V1
		);
		const canceled = result.events.find((event) => event.actorId === ID.b)!;
		expect(canceled).toMatchObject({
			conflictingEventId: result.events.find((event) => event.actorId === ID.c)!.eventId,
			fallbackApplied: null,
			refundApplied: { mana: 'full', readiness: 'full' },
			finalOutcome: 'canceled',
			effects: []
		});
		expect(result.state.combatants[ID.b]!.resources.mana.current).toBe(20);
		expect(result.state.combatants[ID.b]!.readiness.exactNumerator).toBe(11_000);
	});

	it('uses occupied-destination policy and exact causal event for an occupied entity-relative tile', () => {
		const relative = {
			kind: 'entity-relative-position' as const,
			combatantId: ID.target,
			relation: 'flank-left' as const
		};
		const alternate = { kind: 'tile' as const, position: { x: 5, y: 5 } };
		const occupiedCancel: CombatActionConflictPolicy = {
			invalidTarget: 'selected-fallback',
			occupiedDestination: 'cancel',
			cancellationRefund: { mana: 'full', readiness: 'full' }
		};
		const canonical = state({
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'relative-a',
					target: relative,
					fallback: { kind: 'self' }
				}),
				[ID.b]: moveTemplate({
					actionId: 'relative-b',
					target: relative,
					fallback: alternate,
					conflictPolicy: occupiedCancel
				})
			},
			readiness: { [ID.a]: 12_000, [ID.b]: 11_000 },
			positions: { [ID.target]: { x: 3, y: 3 } }
		});
		const result = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.a]: { actionId: 'relative-a', target: relative },
				[ID.b]: { actionId: 'relative-b', target: relative }
			}),
			COMBAT_RULES_V1
		);
		expect(result.events[1]).toMatchObject({
			actorId: ID.b,
			finalOutcome: 'canceled',
			fallbackApplied: null,
			conflictingEventId: result.events[0]!.eventId,
			refundApplied: { mana: 'full', readiness: 'full' },
			effects: []
		});
		expect(result.state.combatants[ID.b]!.position).toStrictEqual({ x: 4, y: 1 });
	});

	it('uses reaction priority before a purpose-keyed tie and is independent of submitted choice order', () => {
		const aMove = { kind: 'tile' as const, position: { x: 0, y: 0 } };
		const bMove = { kind: 'tile' as const, position: { x: 5, y: 5 } };
		const priorityState = state({
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'priority-a',
					target: aMove,
					fallback: { kind: 'self' },
					reactionPriority: 1
				}),
				[ID.b]: moveTemplate({
					actionId: 'priority-b',
					target: bMove,
					fallback: { kind: 'self' },
					reactionPriority: 9
				})
			}
		});
		const selections = {
			[ID.a]: { actionId: 'priority-a', target: aMove },
			[ID.b]: { actionId: 'priority-b', target: bMove }
		};
		expect(
			applyCombatChoiceBatch(priorityState, choiceBatch(priorityState, selections), COMBAT_RULES_V1)
				.events[0]!.actorId
		).toBe(ID.b);

		const tieState = state({
			actionByActor: {
				[ID.a]: moveTemplate({ actionId: 'tie-a', target: aMove, fallback: { kind: 'self' } }),
				[ID.b]: moveTemplate({ actionId: 'tie-b', target: bMove, fallback: { kind: 'self' } })
			}
		});
		const tieSelections = {
			[ID.a]: { actionId: 'tie-a', target: aMove },
			[ID.b]: { actionId: 'tie-b', target: bMove }
		};
		const first = applyCombatChoiceBatch(
			tieState,
			choiceBatch(tieState, tieSelections),
			COMBAT_RULES_V1
		);
		const reversed = applyCombatChoiceBatch(
			tieState,
			choiceBatch(tieState, tieSelections, true),
			COMBAT_RULES_V1
		);
		expect(reversed.events).toStrictEqual(first.events);
		expect(reversed.state).toStrictEqual(first.state);
	});

	it('preflights the batch hash and every frozen-window member before any mutation', () => {
		const move = { kind: 'tile' as const, position: { x: 2, y: 2 } };
		const canonical = state({
			actionByActor: {
				[ID.a]: moveTemplate({ actionId: 'move-a', target: move, fallback: { kind: 'self' } }),
				[ID.b]: moveTemplate({
					actionId: 'move-b',
					target: { kind: 'tile', position: { x: 2, y: 3 } },
					fallback: { kind: 'self' }
				})
			}
		});
		const batch = choiceBatch(canonical, {
			[ID.a]: { actionId: 'move-a', target: move },
			[ID.b]: { actionId: 'move-b', target: { kind: 'tile', position: { x: 2, y: 3 } } }
		});
		const before = hashCanonical(canonical);
		expect(() =>
			applyCombatChoiceBatch(canonical, { ...batch, batchHash: 'f'.repeat(64) }, COMBAT_RULES_V1)
		).toThrow('batch hash');
		const choices = batch.choices.map((choice, index) =>
			index === 1 ? { ...choice, actionId: 'forged-action' } : choice
		);
		const unsigned = { ...batch, choices } as Partial<CombatChoiceBatchV1>;
		delete unsigned.batchHash;
		expect(() =>
			applyCombatChoiceBatch(
				canonical,
				{
					...batch,
					choices,
					batchHash: combatChoiceBatchHash(unsigned as Omit<CombatChoiceBatchV1, 'batchHash'>)
				},
				COMBAT_RULES_V1
			)
		).toThrow();
		expect(hashCanonical(canonical)).toBe(before);
	});

	it('resolves from the canonical state advanced to the frozen window tick', () => {
		const destination = { kind: 'tile' as const, position: { x: 2, y: 2 } };
		const canonical = state({
			include: [ID.a, ID.target],
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'late-ready-move',
					target: destination,
					fallback: { kind: 'self' }
				})
			},
			readiness: { [ID.a]: 9_900 }
		});
		const result = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.a]: { actionId: 'late-ready-move', target: destination }
			}),
			COMBAT_RULES_V1
		);
		expect(result.state.tick).toBe(21);
		expect(result.state.combatants[ID.a]!.readiness).toStrictEqual({
			value: 20,
			exactNumerator: 20,
			recoveryUntilTick: 26
		});
	});

	it('keeps the next public decision window valid after ordinary successful movement', () => {
		const destination = { kind: 'tile' as const, position: { x: 2, y: 2 } };
		const canonical = state({
			include: [ID.a, ID.target],
			actionByActor: {
				[ID.a]: moveTemplate({
					actionId: 'repeatable-move',
					target: destination,
					fallback: { kind: 'self' }
				})
			},
			readiness: { [ID.a]: 10_000 }
		});
		canonical.combatants[ID.target]!.attributes.agility = 1;
		const first = applyCombatChoiceBatch(
			canonical,
			choiceBatch(canonical, {
				[ID.a]: { actionId: 'repeatable-move', target: destination }
			}),
			COMBAT_RULES_V1
		);
		const next = advanceUntilDecision(first.state, COMBAT_RULES_V1);
		expect(next.kind).toBe('decision-window');
		if (next.kind !== 'decision-window') return;
		const actorView = next.views.find((view) => view.actorId === ID.a)!;
		expect(actorView.legalActions.map((action) => action.actionId)).toContain('guard-self');
		expect(actorView.legalActions.map((action) => action.actionId)).not.toContain(
			'repeatable-move'
		);
	});
});
