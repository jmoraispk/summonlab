import { describe, expect, it } from 'vitest';

import { buildSkillVisualCatalog, getSkillVisualCatalog } from './skill-visual-catalog.js';

describe('skill visual catalog', () => {
	it('exposes the unified 457-skill catalog, including Reversal Cut', () => {
		const records = getSkillVisualCatalog();

		expect(records).toHaveLength(457);
		expect(records.filter((record) => record.domain === 'Martial')).toHaveLength(259);
		expect(records.filter((record) => record.domain === 'Magical')).toHaveLength(124);
		expect(records.filter((record) => record.domain === 'Craft')).toHaveLength(74);
		expect(
			records.find((record) => record.targetId === 'martial:blade:reversal-cut')
		).toMatchObject({
			name: 'Reversal Cut',
			family: 'Blade',
			image: { width: 512, height: 512 },
			provenance: {
				status: 'approved',
				sourcePath: 'assets/wiki/skills/icon-production-v2/interiors/martial-blade-reversal-cut.png'
			}
		});
		expect(Object.isFrozen(records)).toBe(true);
	});

	it('does not expose rarity or rank through the wiki model', () => {
		const record = getSkillVisualCatalog()[0]!;
		expect(record).not.toHaveProperty('rarity');
		expect(record).not.toHaveProperty('rank');
	});

	it('resolves visual parents from the unified catalog', () => {
		const reversal = getSkillVisualCatalog().find(
			(record) => record.targetId === 'martial:blade:reversal-cut'
		);
		expect(reversal?.primaryVisualParent).toEqual({
			targetId: 'martial:blade:mirrored-edge',
			name: 'Mirrored Edge'
		});
	});

	it('builds successfully from the default hash-bound authorities', () => {
		expect(buildSkillVisualCatalog()).toEqual(getSkillVisualCatalog());
	});
});
