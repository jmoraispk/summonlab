import { describe, expect, it } from 'vitest';

import { listLaterPackRuleDecisions } from './later-pack-rule-decisions.js';

describe('later-pack rule decision reads', () => {
	it('validates the list scope through the real query entry point', async () => {
		await expect(
			listLaterPackRuleDecisions(
				'postgres://unused.invalid/summonlab',
				'other-experiment' as 'affinity-workflow-v1',
				'final-controlled-v1'
			)
		).rejects.toMatchObject({ name: 'ZodError' });
	});
});
