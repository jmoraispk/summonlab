import { describe, expect, it } from 'vitest';

import { buildSkillIconQualityCleanupReviewPlan } from './render-skill-icon-quality-cleanup-review.js';

describe('skill-icon quality-cleanup review plan', () => {
	it('keeps terminal revise evidence visible without substituting its composite', () => {
		// A higher terminal receipt is visible in the plan but can never replace the eligible cleanup image.
		const plan = buildSkillIconQualityCleanupReviewPlan({
			records: [
				{
					targetId: 'martial:blade:blade-dance',
					name: 'Blade Dance',
					domain: 'Martial',
					family: 'Blade',
					rank: 'D',
					motifFamily: 'blade.flourish',
					disposition: 'revise-art',
					finding: 'Up/down arrows.',
					beforePath: 'mass/blade-dance.png',
					cleanupPath: 'cleanup/blade-dance.png'
				},
				{
					targetId: 'magical:elemental:tide-sense',
					name: 'Tide Sense',
					domain: 'Magical',
					family: 'Elemental',
					rank: 'D',
					motifFamily: 'elemental.water-sense',
					disposition: 'owner-review',
					finding: 'Symbolic language may be the central subject.',
					beforePath: 'mass/tide-sense.png',
					cleanupPath: 'cleanup/tide-sense.png'
				},
				{
					targetId: 'craft:forging:ore-sense',
					name: 'Ore Sense',
					domain: 'Craft',
					family: 'Forging',
					rank: 'F',
					motifFamily: 'forging.ore-sense',
					disposition: 'revise-art',
					finding: 'Corner eye badge.',
					beforePath: 'mass/ore-sense.png',
					cleanupPath: 'cleanup/ore-sense.png'
				}
			],
			revisionReceipts: [
				{
					targetId: 'martial:blade:blade-dance',
					status: 'candidate',
					compositePath: 'revisions/blade-dance.png'
				},
				{
					targetId: 'craft:forging:ore-sense',
					status: 'revise',
					compositePath: 'revisions/ore-sense.png'
				}
			]
		});

		expect(plan.summary).toEqual({
			catalogRecords: 3,
			reviewedRevisions: 2,
			candidateRevisions: 1,
			reviseRevisions: 1,
			failedRevisions: 0,
			symbolicDecisions: 1,
			ownerPromotion: false
		});
		expect(
			plan.records.map((record) => [record.targetId, record.beforePath, record.afterPath])
		).toEqual([
			['martial:blade:blade-dance', 'mass/blade-dance.png', 'revisions/blade-dance.png'],
			['magical:elemental:tide-sense', 'mass/tide-sense.png', 'cleanup/tide-sense.png'],
			['craft:forging:ore-sense', 'mass/ore-sense.png', 'cleanup/ore-sense.png']
		]);
	});
});
