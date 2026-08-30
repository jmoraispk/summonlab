import { describe, expect, it } from 'vitest';

import { listFinalControlledDesignRiskDecisions } from './final-controlled-design-risk-decisions.js';

describe('final-controlled design-risk decision reads', () => {
	it('validates the list scope through the real query entry point', async () => {
		await expect(
			listFinalControlledDesignRiskDecisions(
				'postgres://unused.invalid/summonlab',
				'other-experiment' as 'affinity-workflow-v1',
				'final-controlled-activation-v1'
			)
		).rejects.toMatchObject({ name: 'ZodError' });
	});
});
