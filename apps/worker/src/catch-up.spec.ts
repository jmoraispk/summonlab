import { describe, expect, it, vi } from 'vitest';

import { createCatchUpLoop } from './catch-up.js';

describe('catch-up worker loop', () => {
	it('coalesces overlapping polls into one catch-up batch', async () => {
		let release!: () => void;
		const pending = new Promise<readonly []>((resolve) => {
			release = () => resolve([]);
		});
		const processDue = vi.fn(() => pending);
		const loop = createCatchUpLoop({ pollMs: 1_000, processDue });

		const left = loop.runOnce();
		const right = loop.runOnce();
		expect(processDue).toHaveBeenCalledTimes(1);
		release();
		expect(await left).toEqual([]);
		expect(await right).toEqual([]);
		await loop.stop();
	});

	it('reports a failed poll without terminating the loop contract', async () => {
		const onError = vi.fn();
		const loop = createCatchUpLoop({
			pollMs: 1_000,
			processDue: async () => {
				throw new Error('database unavailable');
			},
			onError
		});

		expect(await loop.runOnce()).toEqual([]);
		expect(onError).toHaveBeenCalledOnce();
		await loop.stop();
	});
});
