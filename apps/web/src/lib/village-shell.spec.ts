import { describe, expect, it } from 'vitest';

import { VILLAGE_MODES, parseVillageMode } from './village-shell';

describe('persistent Village modes', () => {
	it('keeps the five approved destinations in their navigation order', () => {
		expect(VILLAGE_MODES.map((mode) => mode.id)).toEqual([
			'village',
			'residents',
			'tower',
			'inventory',
			'missions'
		]);
	});

	it.each(['village', 'residents', 'tower', 'inventory', 'missions'] as const)(
		'accepts %s as a persistent Village mode',
		(mode) => {
			expect(parseVillageMode(mode)).toBe(mode);
		}
	);

	it.each([null, '', 'prototype', 'VILLAGE'])('falls back from %s to Village', (mode) => {
		expect(parseVillageMode(mode)).toBe('village');
	});
});
