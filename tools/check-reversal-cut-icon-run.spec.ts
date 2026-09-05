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
			ownerDecision: 'accepted',
			calibrationStatus: 'approved',
			individualStatus: 'failed-provider-envelope',
			individualJobId: 'martial-blade-reversal-cut-v1',
			individualAttemptCount: 2,
			previousActivationStatus: 'rejected-frame',
			previousActivationId: 'martial-blade-reversal-cut-activation-v2',
			activationStatus: 'approved-runtime',
			activationId: 'martial-blade-reversal-cut-activation-v3',
			correctionStatus: 'superseded',
			correctionId: 'martial-blade-reversal-cut-frame-correction-v1',
			frameCandidateStatus: 'candidate',
			frameCandidateRunId: 'reversal-cut-v6',
			frameVisualDecision: 'accepted',
			framePromotionStatus: 'approved-runtime',
			approvedFrameHash: '3e5b368c8953bd9eec50044e61ae12c2966451450e6721776c713fd4db2e47d1',
			runtimeUpdated: true,
			runtimeSizes: [512, 256, 128]
		});
	});
});
