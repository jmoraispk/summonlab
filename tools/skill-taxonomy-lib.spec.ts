import { describe, expect, it } from 'vitest';

import { parseSkillMarkdown, validateLegacyInventory } from './skill-taxonomy-lib.js';

describe('skill taxonomy migration inventory', () => {
	it('parses a catalog row with its page and section identity', () => {
		const rows = parseSkillMarkdown(
			'martial-blade.md',
			'## Sword\n\n| # | Skill | R | T | Requires | Effect |\n|---|---|---|---|---|---|\n| 1 | **Swordsmanship** | F | P | Hold a sword | Foundation |'
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourcePath: 'martial-blade.md',
				section: 'Sword',
				name: 'Swordsmanship',
				rarity: 'F',
				type: 'P'
			})
		]);
	});

	it('parses an annotated catalog skill from its bold name', () => {
		const rows = parseSkillMarkdown(
			'magical-disciplines.md',
			'## Ward\n\n| # | Skill | R | T | Requires | Effect |\n|---|---|---|---|---|---|\n| 4 | **Elemental Guard** *(elemental)* | F | P | Warding Intermediate | Standing resistance |'
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourceId: 'magical-disciplines.md#ward:4',
				name: 'Elemental Guard'
			})
		]);
	});

	it('rejects duplicate source identities', () => {
		const row = {
			sourceId: 'martial-blade.md#sword:1',
			sourcePath: 'martial-blade.md',
			section: 'Sword',
			row: 1,
			name: 'Swordsmanship',
			rarity: 'F',
			type: 'P',
			requires: 'Hold a sword',
			effect: 'Foundation'
		} as const;

		expect(validateLegacyInventory([row, row])).toContain(
			'duplicate source id martial-blade.md#sword:1'
		);
	});
});
