import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DecisionQueueJobSchema } from './index.js';

describe('decision job contract', () => {
	it('carries only the durable job identity', () => {
		const decisionJobId = randomUUID();
		const job = DecisionQueueJobSchema.parse({ decisionJobId });

		expect(job).toEqual({ decisionJobId });
		expect(() => DecisionQueueJobSchema.parse({ decisionJobId, expectedRunVersion: 12 })).toThrow();
	});
});
