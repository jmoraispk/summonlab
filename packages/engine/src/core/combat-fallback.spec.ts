import {
	ActorDecisionViewSchema,
	CombatActionIntentSchema,
	type ActorDecisionView
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import * as engine from '../index.js';
import { deterministicUuid, hashCanonical } from '../index.js';

function frozenView() {
	const actorId = deterministicUuid('engine-fallback-actor');
	const firstTargetId = deterministicUuid('engine-fallback-first-target');
	const secondTargetId = deterministicUuid('engine-fallback-second-target');
	const legalActions = [
		{
			actionId: 'first-frozen-action',
			actionInstanceId: deterministicUuid('engine-fallback-first-action'),
			actionKind: 'attack' as const,
			skillId: 'combat-skill-strike',
			publicLabel: 'Strike nearby',
			targetContract: {
				kind: 'entity' as const,
				allowedCombatantIds: [firstTargetId, secondTargetId]
			},
			reactionPriority: 0,
			recoveryTicks: 3,
			manaCost: 0,
			conflictPolicy: {
				invalidTarget: 'selected-fallback' as const,
				occupiedDestination: 'cancel' as const,
				cancellationRefund: { mana: 'full' as const, readiness: 'none' as const }
			},
			fallbackOptions: [
				{
					fallbackId: 'first-fallback',
					publicLabel: 'Guard instead',
					target: { kind: 'self' as const }
				},
				{
					fallbackId: 'second-fallback',
					publicLabel: 'Wait instead',
					target: { kind: 'self' as const }
				}
			]
		},
		{
			actionId: 'second-legal-action',
			actionInstanceId: deterministicUuid('engine-fallback-second-action'),
			actionKind: 'guard' as const,
			skillId: null,
			publicLabel: 'Wait here',
			targetContract: { kind: 'self' as const },
			reactionPriority: 0,
			recoveryTicks: 1,
			manaCost: 0,
			conflictPolicy: {
				invalidTarget: 'cancel' as const,
				occupiedDestination: 'cancel' as const,
				cancellationRefund: { mana: 'full' as const, readiness: 'full' as const }
			},
			fallbackOptions: []
		}
	];
	const unsigned = {
		viewVersion: 'actor-decision-view-v1' as const,
		windowId: deterministicUuid('engine-fallback-window'),
		actorId,
		snapshotHash: 'a'.repeat(64),
		legalActionSetHash: hashCanonical(legalActions),
		self: {
			combatantId: actorId,
			combatantKind: 'hero' as const,
			teamId: 'party',
			position: { x: 1, y: 1 },
			resources: {
				health: { current: 100, maximum: 100 },
				mana: { current: 10, maximum: 10 }
			},
			conditions: [],
			readiness: { ready: true, recoveryTicksRemaining: 0 },
			downed: false,
			active: true
		},
		visibleCombatants: [],
		visibleTerrain: { width: 8, height: 8, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		rememberedContext: [],
		doctrine: [],
		relationships: [],
		masterDirections: [],
		legalActions
	};
	return ActorDecisionViewSchema.parse({
		...unsigned,
		actorViewHash: hashCanonical(unsigned)
	});
}

describe('engine-owned combat fallback', () => {
	it('builds the exact first frozen legal action, canonical target, and fallback option', () => {
		const view = frozenView();
		const builder = (
			engine as typeof engine & {
				buildDeterministicCombatFallbackIntent?: (
					view: ActorDecisionView,
					binding: { attemptId: string; tick: number; snapshotHash: string }
				) => unknown;
			}
		).buildDeterministicCombatFallbackIntent;
		expect(builder).toBeTypeOf('function');
		if (!builder) return;
		const attemptId = deterministicUuid('engine-fallback-attempt');
		const intent = CombatActionIntentSchema.parse(
			builder(view, { attemptId, tick: 17, snapshotHash: view.snapshotHash })
		);

		expect(intent).toMatchObject({
			attemptId,
			tick: 17,
			actionId: 'first-frozen-action',
			target: {
				kind: 'entity',
				combatantId: deterministicUuid('engine-fallback-first-target')
			},
			fallbackId: 'first-fallback'
		});
	});
});
