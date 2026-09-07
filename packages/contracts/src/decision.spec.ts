import { describe, expect, it } from 'vitest';

import {
	COMBAT_DECISION_JOB_VERSION,
	CombatDecisionJobResultBindingSchema,
	DecisionJobWindowBindingSchema,
	HeroDecisionKindSchema
} from './decision.js';

const ID = {
	window: '10000000-0000-4000-8000-000000000001',
	actor: '10000000-0000-4000-8000-000000000002'
} as const;
const HASH = { snapshot: '1'.repeat(64), view: '2'.repeat(64), legal: '3'.repeat(64) } as const;

describe('combat decision job contracts', () => {
	it('adds combat-action only to v3 jobs without widening legacy hero packets', () => {
		expect(HeroDecisionKindSchema.safeParse('combat-action').success).toBe(false);
		expect(COMBAT_DECISION_JOB_VERSION).toBe('decision-job-v3');
	});

	it('requires an exact window and actor-view binding', () => {
		expect(
			DecisionJobWindowBindingSchema.parse({
				windowId: ID.window,
				actorViewHash: HASH.view
			})
		).toEqual({ windowId: ID.window, actorViewHash: HASH.view });
		expect(
			DecisionJobWindowBindingSchema.safeParse({
				windowId: ID.window,
				actorViewHash: HASH.view,
				snapshotHash: HASH.snapshot
			}).success
		).toBe(false);
	});

	it('rejects cross-window combat results', () => {
		const result = CombatDecisionJobResultBindingSchema.safeParse({
			heroId: ID.actor,
			windowId: ID.window,
			actorViewHash: HASH.view,
			snapshotHash: HASH.snapshot,
			legalActionHash: HASH.legal,
			result: {
				windowId: '10000000-0000-4000-8000-000000000099',
				attemptId: ID.window,
				tick: 1,
				actorId: ID.actor,
				snapshotHash: HASH.snapshot,
				actorViewHash: HASH.view,
				legalActionSetHash: HASH.legal,
				actionId: 'guard-self',
				actionInstanceId: ID.actor,
				actionKind: 'guard',
				skillId: null,
				target: { kind: 'self' },
				fallbackId: null
			}
		});

		expect(result.success).toBe(false);
	});
});
