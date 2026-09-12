import { describe, expect, it } from 'vitest';

import { attributeDisplayName, orderCharacterSheetAttributes } from './attribute-display';

describe('attributeDisplayName', () => {
	it.each([
		['Strength', 'STR'],
		['Agility', 'AGI'],
		['Vitality', 'VIT'],
		['Magic', 'MAG']
	])('shortens %s on compact character sheets', (fullName, abbreviation) => {
		expect(attributeDisplayName(fullName)).toBe(abbreviation);
	});

	it('leaves non-canonical and unknown labels readable in full', () => {
		expect(attributeDisplayName('Dexterity')).toBe('Dexterity');
		expect(attributeDisplayName('Guard')).toBe('Guard');
	});

	it('places canonical attributes in STR, AGI, VIT, MAG sheet order', () => {
		const attributes = [
			{ name: 'Guard', value: 8 },
			{ name: 'Magic', value: 14 },
			{ name: 'Vitality', value: 12 },
			{ name: 'Dexterity', value: 9 },
			{ name: 'Strength', value: 16 },
			{ name: 'Agility', value: 18 }
		] as const;

		expect(orderCharacterSheetAttributes(attributes, (attribute) => attribute.name)).toEqual([
			{ name: 'Strength', value: 16 },
			{ name: 'Agility', value: 18 },
			{ name: 'Vitality', value: 12 },
			{ name: 'Magic', value: 14 },
			{ name: 'Guard', value: 8 },
			{ name: 'Dexterity', value: 9 }
		]);
		expect(attributes.map((attribute) => attribute.name)).toEqual([
			'Guard',
			'Magic',
			'Vitality',
			'Dexterity',
			'Strength',
			'Agility'
		]);
	});
});
