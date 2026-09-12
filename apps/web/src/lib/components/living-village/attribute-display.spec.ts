import { describe, expect, it } from 'vitest';

import { attributeDisplayName } from './attribute-display';

describe('attributeDisplayName', () => {
	it.each([
		['Strength', 'STR'],
		['Vitality', 'VIT'],
		['Agility', 'AGI'],
		['Spirit', 'SPI']
	])('shortens %s on compact character sheets', (fullName, abbreviation) => {
		expect(attributeDisplayName(fullName)).toBe(abbreviation);
	});

	it('leaves non-canonical and unknown labels readable in full', () => {
		expect(attributeDisplayName('Dexterity')).toBe('Dexterity');
		expect(attributeDisplayName('Guard')).toBe('Guard');
	});
});
