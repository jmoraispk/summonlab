import { describe, expect, it } from 'vitest';

import {
	attributeDisplayName,
	attributeFullName,
	orderCharacterSheetAttributes
} from './attribute-display.js';

describe('character-sheet attribute display', () => {
	it('uses compact abbreviations while preserving accessible full names', () => {
		expect(['Strength', 'Agility', 'Vitality', 'Magic'].map(attributeDisplayName)).toEqual([
			'STR',
			'AGI',
			'VIT',
			'MAG'
		]);
		expect(['STR', 'AGI', 'VIT', 'MAG'].map(attributeFullName)).toEqual([
			'Strength',
			'Agility',
			'Vitality',
			'Magic'
		]);
	});

	it('keeps the canonical STR, AGI, VIT, MAG order without classifying attributes', () => {
		const ordered = orderCharacterSheetAttributes(
			['Magic', 'Vitality', 'Strength', 'Agility'],
			(value) => value
		);
		expect(ordered).toEqual(['Strength', 'Agility', 'Vitality', 'Magic']);
	});
});
