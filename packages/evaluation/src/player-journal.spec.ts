import { describe, expect, it } from 'vitest';

import { generatePlayerJournalEvidence } from './player-journal.js';

describe('player journal evidence', () => {
	it('proves numerical progress and replay-bound readable history', () => {
		const report = generatePlayerJournalEvidence();
		expect(report.assertions).toEqual({
			experienceGain: 16,
			levelGain: 1,
			attemptsStarted: 1,
			directionRecords: expect.any(Number),
			storyChanges: expect.any(Number),
			exactReplayCursor: true
		});
		expect(report.assertions.directionRecords).toBeGreaterThan(0);
		expect(report.assertions.storyChanges).toBeGreaterThan(0);
		expect(report.journal.filterOptions.facets).toEqual(
			expect.arrayContaining(['progression', 'party', 'control', 'direction', 'story'])
		);
	});

	it('is byte-for-byte deterministic', () => {
		expect(generatePlayerJournalEvidence()).toEqual(generatePlayerJournalEvidence());
	});
});
