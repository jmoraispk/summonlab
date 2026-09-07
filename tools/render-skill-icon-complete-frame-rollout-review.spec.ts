import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const REPORT_PATH =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v9-complete-frame-rollout/report.json';

describe('complete rarity-frame rollout review', () => {
	it('recomposes every skill with a complete final-layer frame', async () => {
		const report = JSON.parse(await readFile(REPORT_PATH, 'utf8')) as {
			readonly scope: { readonly ranks: readonly string[]; readonly skills: number };
			readonly assembly: {
				readonly frameIsFinalLayer: boolean;
				readonly v9PixelsMergedIntoFrame: boolean;
			};
			readonly frameAudits: readonly {
				readonly audit: { readonly centerBadgePixelsBelowLegacyCutoff: number };
			}[];
			readonly records: readonly {
				readonly inspection: {
					readonly layerHashesMatch: boolean;
					readonly exactComposite: boolean;
					readonly protectedBandMatches: boolean;
					readonly exteriorTransparent: boolean;
					readonly backingOnlyComponents: readonly unknown[];
				};
			}[];
		};

		expect(report.scope).toMatchObject({ skills: 456, ranks: ['F', 'E', 'D', 'C', 'B', 'A', 'S'] });
		expect(report.assembly).toMatchObject({
			frameIsFinalLayer: true,
			v9PixelsMergedIntoFrame: false
		});
		expect(report.frameAudits).toHaveLength(7);
		expect(
			report.frameAudits.every((frame) => frame.audit.centerBadgePixelsBelowLegacyCutoff > 0)
		).toBe(true);
		expect(report.records).toHaveLength(456);
		expect(
			report.records.every(
				(record) =>
					record.inspection.layerHashesMatch &&
					record.inspection.exactComposite &&
					record.inspection.protectedBandMatches &&
					record.inspection.exteriorTransparent &&
					record.inspection.backingOnlyComponents.length === 0
			)
		).toBe(true);
	});
});
