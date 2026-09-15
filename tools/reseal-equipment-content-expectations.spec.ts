import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { resealEquipmentCatalogSource } from './reseal-equipment-content-expectations.js';

describe('equipment content intent resealing', () => {
	it('derives the self-bound catalog digest from the projected definitions', () => {
		const definitions = [{ id: 'fixture', label: 'projected' }];
		const combatHash = 'b'.repeat(64);
		const source = [
			`export const COMBAT_EQUIPMENT_PROFILE_CATALOG = {\n\tcontentHash: '${'a'.repeat(64)}'\n};`,
			`export const EQUIPMENT_DEFINITION_CATALOG = {\n\tcontentHash: '${'c'.repeat(64)}',\n\tdefinitions\n};`
		].join('\n');
		const definitionHash = createHash('sha256').update(JSON.stringify(definitions)).digest('hex');

		expect(resealEquipmentCatalogSource(source, combatHash, definitions)).toBe(
			source.replace('a'.repeat(64), combatHash).replace('c'.repeat(64), definitionHash)
		);
	});

	it('rejects a source without both named catalog hashes', () => {
		const source = `export const EQUIPMENT_DEFINITION_CATALOG = {\n\tcontentHash: '${'a'.repeat(64)}'\n};`;
		expect(() => resealEquipmentCatalogSource(source, 'b'.repeat(64), [])).toThrow(/both named/u);
	});
});
