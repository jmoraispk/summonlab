import { describe, expect, it } from 'vitest';

import { projectCombatPoint } from './depth-projection';

const options = { width: 700, height: 1050 };

describe('combat depth projection', () => {
	it('keeps the 2D and classic 2.5D lanes rectangular', () => {
		for (const mode of ['2d', '2.5d'] as const) {
			expect(projectCombatPoint(mode, 0, 0.15, options).laneWidth).toBe(700);
			expect(projectCombatPoint(mode, 0, 0.85, options).laneWidth).toBe(700);
		}
	});

	it('makes the V2 far lane visibly narrower than the near lane', () => {
		const far = projectCombatPoint('2.5d-v2', 0, 0.15, options);
		const near = projectCombatPoint('2.5d-v2', 0, 0.85, options);
		expect(far.laneWidth / near.laneWidth).toBeLessThan(0.8);
		expect(near.scale / far.scale).toBeGreaterThan(1.25);
	});

	it('converges equal horizontal coordinates toward the V2 horizon', () => {
		const far = projectCombatPoint('2.5d-v2', 0.1, 0.1, options);
		const near = projectCombatPoint('2.5d-v2', 0.1, 0.9, options);
		expect(far.x).toBeGreaterThan(near.x);
	});

	it('keeps projection finite when world coordinates exceed the arena', () => {
		const point = projectCombatPoint('2.5d-v2', Number.POSITIVE_INFINITY, -4, options);
		expect(point).toEqual(expect.objectContaining({ x: expect.any(Number), y: 0 }));
		expect(Number.isFinite(point.x)).toBe(true);
	});
});
