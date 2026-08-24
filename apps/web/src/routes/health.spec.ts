import { randomUUID } from 'node:crypto';

import { HealthResponseSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

describe('health contract', () => {
	it('keeps the health page payload typed', () => {
		const response = HealthResponseSchema.parse({
			status: 'ok',
			service: 'web',
			version: '0.0.0',
			commit: 'abc123',
			policyMode: 'scripted',
			database: { status: 'available', latencyMs: 4.2 },
			timestamp: new Date().toISOString(),
			requestId: randomUUID()
		});

		expect(response.database.status).toBe('available');
	});
});
