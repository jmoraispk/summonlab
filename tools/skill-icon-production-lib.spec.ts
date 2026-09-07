import { describe, expect, it } from 'vitest';

import {
	buildSkillIconCatalog,
	loadCanonicalSkillRows,
	summarizeSkillIconCatalog,
	validateVisualLineage,
	type SkillIconMotifMap,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';

describe('skill icon catalog construction', () => {
	it('builds the unified catalog from mechanics, motif lineage, and visual specs', async () => {
		const rows = await loadCanonicalSkillRows();
		const motifMap = (
			await import('../assets/wiki/skills/icon-production-v2/motif-map.json', {
				with: { type: 'json' }
			})
		).default as SkillIconMotifMap;
		const visualSpecs = (
			await import('../assets/wiki/skills/icon-production-v2/visual-specs.json', {
				with: { type: 'json' }
			})
		).default as SkillIconVisualSpecs;
		const catalog = buildSkillIconCatalog(rows, motifMap, visualSpecs);

		expect(summarizeSkillIconCatalog(catalog)).toMatchObject({
			canonical: 457,
			mapped: 457,
			duplicates: []
		});
		expect(catalog.records.some((record) => record.targetId === 'martial:blade:reversal-cut')).toBe(
			true
		);
	});

	it('rejects missing parents and cycles', () => {
		expect(() =>
			validateVisualLineage([
				{
					targetId: 'martial:blade:first',
					mapEntryId: 'blade.test',
					motifFamily: 'blade.test',
					primaryVisualParent: 'martial:blade:missing'
				}
			])
		).toThrow(/missing visual parent/i);
	});
});
