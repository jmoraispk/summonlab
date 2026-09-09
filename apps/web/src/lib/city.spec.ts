import { describe, expect, it } from 'vitest';

import { CITY_MODES, cityModeHref, parseCityMode } from './city';

describe('City navigation', () => {
	it('builds the five approved campaign destinations in product order', () => {
		expect(CITY_MODES.map((mode) => mode.id)).toEqual([
			'village',
			'residents',
			'tower',
			'inventory',
			'missions'
		]);
		expect(CITY_MODES.map((mode) => mode.label)).toEqual([
			'Village',
			'Residents',
			'Tower',
			'Inventory',
			'Missions'
		]);
		expect(cityModeHref('run with spaces', 'village')).toBe('/play/run%20with%20spaces');
		expect(cityModeHref('run with spaces', 'tower')).toBe('/play/run%20with%20spaces?mode=tower');
	});

	it.each(['village', 'residents', 'tower', 'inventory', 'missions'] as const)(
		'accepts %s as a City mode',
		(mode) => expect(parseCityMode(mode)).toBe(mode)
	);

	it.each([null, '', 'prototype', 'VILLAGE'])('falls back from %s to Village', (mode) => {
		expect(parseCityMode(mode)).toBe('village');
	});
});
