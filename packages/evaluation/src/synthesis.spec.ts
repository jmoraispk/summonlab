import { describe, expect, it } from 'vitest';

import { generateSynthesisReport } from './synthesis.js';

describe('synthesis evidence', () => {
	it('proves the irreversible, social, rumor, and replay boundaries', () => {
		const report = generateSynthesisReport();
		expect(report.checks).toHaveLength(10);
		expect(report.checks.every((check) => check.passed)).toBe(true);
		expect(report.adversarial).toHaveLength(7);
		expect(report.adversarial.every((test) => test.blocked)).toBe(true);
		expect(report.replay.verified).toBe(true);
	});
});
