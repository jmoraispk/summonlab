import { describe, expect, it } from 'vitest';

import { SkillIconCatalogSchema, SkillIconRecordSchema } from './skill-icon-production.js';

const record = {
	targetId: 'martial:blade:measured-cut',
	domain: 'Martial',
	family: 'Blade',
	name: 'Measured Cut',
	labels: [{ namespace: 'Equipment', value: 'Sword' }],
	rarity: 'F',
	type: 'A',
	requires: 'Swordsmanship Novice',
	effect: 'A controlled cut.',
	mapEntryId: 'blade.precision-cut',
	motifFamily: 'blade.precision-cut',
	primaryVisualParent: 'martial:blade:swordsmanship',
	status: 'authored',
	visualSpec: {
		dominantSubject: 'one sword making a controlled diagonal cut',
		supportingCue: 'one restrained pressure wake',
		semanticPalette: ['tempered steel', 'charcoal'],
		composition: 'Centered painted emblem with clear negative space.',
		exclusions: ['no text or scenery']
	},
	assets: null,
	review: null
} as const;

describe('skill icon catalog contract', () => {
	it('accepts a canonical authored skill and catalog', () => {
		expect(SkillIconRecordSchema.parse(record)).toEqual(record);
		expect(
			SkillIconCatalogSchema.parse({ schemaVersion: 'skill-icon-catalog-v1', records: [record] })
		).toMatchObject({ records: [record] });
	});

	it('rejects framed-art metadata and unknown catalog fields', () => {
		expect(SkillIconRecordSchema.safeParse({ ...record, framedMaster: 'old.png' }).success).toBe(
			false
		);
		expect(
			SkillIconCatalogSchema.safeParse({
				schemaVersion: 'skill-icon-catalog-v1',
				records: [record],
				overlay: 'retired'
			}).success
		).toBe(false);
	});
});
