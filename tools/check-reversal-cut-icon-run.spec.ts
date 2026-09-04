import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkReversalCutIconRun } from './check-reversal-cut-icon-run.js';

describe('Reversal Cut icon run', () => {
	it('binds the candidate result to the additive authority without promotion', async () => {
		await expect(checkReversalCutIconRun(path.resolve('.'))).resolves.toMatchObject({
			runId: 'reversal-cut-v2',
			jobId: 'blade-guard-flow-reversal-cut-v2',
			status: 'candidate',
			candidateHash: 'e505f796d2ec174c5db35eb762ea37dd1fe51f0a08579f403847a5303d3a7d54',
			selfPromoted: false,
			individualStatus: 'blocked-pending-owner-authorities'
		});
	});
});
