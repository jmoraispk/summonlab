import { describe, expect, it } from 'vitest';

import { checkDatabaseHealth } from './index.js';

describe('database health', () => {
	it('degrades cleanly when PostgreSQL is absent', async () => {
		const result = await checkDatabaseHealth(
			'postgresql://summonlab:summonlab@127.0.0.1:1/summonlab'
		);

		expect(result).toEqual({ status: 'unavailable', latencyMs: null });
	});
});
