import { describe, expect, it } from 'vitest';

import { exportSkillIconProduction } from './export-skill-icon-production.js';

describe('unified skill icon catalog export', () => {
	it('derives a current catalog for every canonical skill', async () => {
		const report = await exportSkillIconProduction({ mode: 'check' });

		expect(report.inSync).toBe(true);
		expect(report.summary.canonical).toBe(457);
		expect(report.summary.mapped).toBe(457);
		expect(report.summary.duplicates).toEqual([]);
	});
});
