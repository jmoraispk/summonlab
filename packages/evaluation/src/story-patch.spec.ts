import { describe, expect, it } from 'vitest';

import { generateRuntimeStoryPatchReport } from './story-patch.js';

describe('runtime StoryPatch evaluation', () => {
	it('proves accepted replay, alternative eligibility, and adversarial containment deterministically', () => {
		const first = generateRuntimeStoryPatchReport();
		const second = generateRuntimeStoryPatchReport();
		expect(first).toEqual(second);
		expect(first.acceptedPatch.passedCheckCount).toBe(17);
		expect(first.alternativePreview.accepted).toBe(true);
		expect(first.adversarialCases).toHaveLength(11);
		expect(first.allAdversarialCasesBlocked).toBe(true);
		expect(first.replay).toMatchObject({
			verified: true,
			hashMatchesCommittedState: true,
			activatedProposalIds: ['floor-four-surface-discovery']
		});
	});
});
