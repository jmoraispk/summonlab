import { describe, expect, it } from 'vitest';

import { mapCombatJobsConcurrently } from './combat-decision.js';

describe('combat decision concurrency', () => {
	it('bounds provider work while preserving input result order', async () => {
		let active = 0;
		let peak = 0;
		const completed: number[] = [];
		const results = await mapCombatJobsConcurrently([30, 5, 15, 1], 2, async (delay) => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise((resolve) => setTimeout(resolve, delay));
			active -= 1;
			completed.push(delay);
			return delay * 2;
		});

		expect(peak).toBe(2);
		expect(completed).not.toEqual([30, 5, 15, 1]);
		expect(results).toEqual([60, 10, 30, 2]);
	});

	it.each([0, 33, 1.5])('rejects invalid concurrency %s', async (concurrency) => {
		await expect(
			mapCombatJobsConcurrently([1], concurrency, async (value) => value)
		).rejects.toThrow(/concurrency/u);
	});
});
