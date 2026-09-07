import { createEntropyCursor } from '../../entropy.js';
import { sha256Hex } from '../../hash.js';
import { describe, expect, it } from 'vitest';

import { purposeKeyedInteger } from './randomness.js';

const ID = {
	attempt: '41000000-0000-4000-8000-000000000001',
	actor: '41000000-0000-4000-8000-000000000002',
	otherActor: '41000000-0000-4000-8000-000000000003',
	action: '41000000-0000-4000-8000-000000000004',
	otherAction: '41000000-0000-4000-8000-000000000005',
	target: '41000000-0000-4000-8000-000000000006',
	otherTarget: '41000000-0000-4000-8000-000000000007'
} as const;

const BASE = {
	seed: sha256Hex('readiness-private-seed'),
	attemptId: ID.attempt,
	tick: 37,
	actorId: ID.actor,
	actionInstanceId: ID.action,
	targetId: ID.target,
	purpose: 'hit',
	localSequence: 0,
	minimum: 0,
	maximum: 9_999
} as const;

describe('purpose-keyed combat randomness', () => {
	it('replays the same draw without depending on object insertion order', () => {
		const first = purposeKeyedInteger(BASE);
		const reordered = purposeKeyedInteger({
			maximum: BASE.maximum,
			purpose: BASE.purpose,
			targetId: BASE.targetId,
			minimum: BASE.minimum,
			actionInstanceId: BASE.actionInstanceId,
			localSequence: BASE.localSequence,
			actorId: BASE.actorId,
			tick: BASE.tick,
			attemptId: BASE.attemptId,
			seed: BASE.seed
		});

		expect(reordered).toStrictEqual(first);
		expect(purposeKeyedInteger(BASE)).toStrictEqual(first);
	});

	it('keeps existing actor and area-target draws stable when unrelated entries are inserted', () => {
		const actorDraws = (actors: readonly string[]) =>
			Object.fromEntries(
				actors.map((actorId) => [
					actorId,
					purposeKeyedInteger({ ...BASE, actorId, targetId: null }).value
				])
			);
		const targetDraws = (targets: readonly string[]) =>
			Object.fromEntries(
				targets.map((targetId) => [targetId, purposeKeyedInteger({ ...BASE, targetId }).value])
			);

		expect(actorDraws([ID.actor])[ID.actor]).toBe(actorDraws([ID.otherActor, ID.actor])[ID.actor]);
		expect(targetDraws([ID.target])[ID.target]).toBe(
			targetDraws([ID.otherTarget, ID.target].reverse())[ID.target]
		);
	});

	it.each([
		['purpose', { purpose: 'critical' }],
		['actor', { actorId: ID.otherActor }],
		['action instance', { actionInstanceId: ID.otherAction }],
		['target', { targetId: ID.otherTarget }],
		['local sequence', { localSequence: 1 }],
		['tick', { tick: BASE.tick + 1 }]
	] as const)('gives a distinct keyed draw when %s changes', (_label, changed) => {
		const baseline = purposeKeyedInteger(BASE);
		const result = purposeKeyedInteger({ ...BASE, ...changed });
		expect(result.keyHash).not.toBe(baseline.keyHash);
	});

	it('keeps hit, critical, status, and target-fallback in separate purpose domains', () => {
		const purposes = ['hit', 'critical', 'status', 'target-fallback'] as const;
		const draws = purposes.map((purpose) => purposeKeyedInteger({ ...BASE, purpose }));
		expect(new Set(draws.map((draw) => draw.keyHash)).size).toBe(purposes.length);
	});

	it('does not consume or inspect the frozen legacy entropy cursor', () => {
		const legacy = createEntropyCursor('legacy-frozen-seed', 19);
		purposeKeyedInteger(BASE);
		expect(legacy).toStrictEqual({ seed: 'legacy-frozen-seed', cursor: 19 });
	});

	it('validates canonical coordinates and safe integer bounds', () => {
		expect(() => purposeKeyedInteger({ ...BASE, purpose: 'Hit' })).toThrow(
			'purpose must be canonical'
		);
		expect(() => purposeKeyedInteger({ ...BASE, minimum: 2, maximum: 1 })).toThrow(
			'bounds are invalid'
		);
		expect(() => purposeKeyedInteger({ ...BASE, localSequence: -1 })).toThrow('local sequence');
	});
});
