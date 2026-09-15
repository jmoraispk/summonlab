import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { resealEquipmentCatalogSource } from './reseal-equipment-content-expectations.js';

describe('equipment content intent resealing', () => {
	it('derives the self-bound catalog digest from the projected definitions', () => {
		const definitions = [{ id: 'fixture', label: 'projected' }];
		const source = `export const catalog = {\n\tcontentHash: '${'a'.repeat(64)}',\n\tdefinitions\n};\n`;
		const expected = createHash('sha256').update(JSON.stringify(definitions)).digest('hex');

		expect(resealEquipmentCatalogSource(source, definitions)).toBe(
			source.replace('a'.repeat(64), expected)
		);
	});

	it('rejects an ambiguous catalog source', () => {
		const source = `${'contentHash: '.repeat(2)}${'a'.repeat(64)}`;
		expect(() => resealEquipmentCatalogSource(source, [])).toThrow(/exactly one/u);
	});
});
