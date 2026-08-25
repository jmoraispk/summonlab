import { describe, expect, it } from 'vitest';

import { generateFirstBandArchiveReport } from './first-band-archive.js';

describe('first-band archive evidence', () => {
	it('binds the authored reveal to successful extraction and holder knowledge', () => {
		const report = generateFirstBandArchiveReport();
		expect(report.checks.every((check) => check.passed)).toBe(true);
		expect(report.adversarial.every((test) => test.blocked)).toBe(true);
		expect(report.reveal.readerVariants.map((variant) => variant.frame)).toEqual([
			'operational',
			'defiant',
			'relational',
			'cautious'
		]);
	}, 30_000);
});
