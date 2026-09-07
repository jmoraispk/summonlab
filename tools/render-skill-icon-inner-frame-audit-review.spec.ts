import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const REPORT_PATH =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v10-inner-frame-audit/report.json';

describe('inner legacy-frame audit review', () => {
	it('separates clear failures from borderline candidates without changing icons', async () => {
		const report = JSON.parse(await readFile(REPORT_PATH, 'utf8')) as {
			readonly status: string;
			readonly scope: {
				readonly catalogSkills: number;
				readonly clear: number;
				readonly borderline: number;
				readonly totalCandidates: number;
			};
			readonly records: readonly {
				readonly targetId: string;
				readonly classification: 'clear' | 'borderline';
				readonly currentHash: string;
				readonly exposedInteriorHash: string;
			}[];
		};

		expect(report.status).toBe('diagnostic-review-only-no-icons-modified');
		expect(report.scope).toEqual({
			catalogSkills: 456,
			clear: 23,
			borderline: 5,
			totalCandidates: 28
		});
		expect(report.records).toHaveLength(28);
		expect(new Set(report.records.map((record) => record.targetId))).toHaveLength(28);
		expect(report.records.filter((record) => record.classification === 'clear')).toHaveLength(23);
		expect(report.records.filter((record) => record.classification === 'borderline')).toHaveLength(
			5
		);
		expect(
			report.records.every(
				(record) => record.currentHash.length === 64 && record.exposedInteriorHash.length === 64
			)
		).toBe(true);
	});
});
