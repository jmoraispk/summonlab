import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DecisionJobSchema } from './index.js';

describe('decision job contract', () => {
	it('captures the versions needed to reject stale work', () => {
		const job = DecisionJobSchema.parse({
			decisionJobId: randomUUID(),
			runId: randomUUID(),
			heroId: randomUUID(),
			expectedRunVersion: 12,
			decisionGameTime: new Date().toISOString(),
			legalActionHash: 'a'.repeat(64),
			promptVersion: 'hero-turn-v1',
			contextPolicyVersion: 'memory-v1'
		});

		expect(job.expectedRunVersion).toBe(12);
	});
});
