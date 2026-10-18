import { describe, expect, it } from 'vitest';

import { getEquipmentWikiCatalog } from '$lib/server/equipment-wiki-catalog';

import { equipmentCatalogPage, filterEquipmentCatalog } from './equipment-visual-catalog-model';

const records = getEquipmentWikiCatalog();

describe('equipment gallery filters', () => {
	it('opens on the complete sets in rank order and combines rank, class, and material search', () => {
		expect(
			filterEquipmentCatalog(records, { view: 'sets', q: '', rank: '', equipmentClass: '' })
		).toHaveLength(21);
		const matches = filterEquipmentCatalog(records, {
			view: 'sets',
			q: '  bronze ',
			rank: 'F',
			equipmentClass: 'heavy-armor'
		});
		expect(matches.map((record) => record.assetKey)).toEqual([
			'equipment-v1-f-bronze-heavy-armor-set-reference'
		]);
		expect(
			filterEquipmentCatalog(records, { view: 'sets', q: 'bronze', rank: 'S', equipmentClass: '' })
		).toEqual([]);
	});

	it('finds all seven Greatswords and links a complete set to an exact individual piece', () => {
		expect(
			filterEquipmentCatalog(records, {
				view: 'items',
				q: 'GREATSWORD',
				rank: '',
				equipmentClass: ''
			})
		).toHaveLength(7);
		expect(
			filterEquipmentCatalog(records, {
				view: 'items',
				q: 'equipment-v1-f-bronze-heavy-armor-head',
				rank: '',
				equipmentClass: ''
			}).map((record) => record.name)
		).toEqual(['Bronze Heavy Armor · Head']);
	});

	it('limits individual pages to 24 and clamps the final page without hiding complete sets', () => {
		const filters = { view: 'items' as const, q: '', rank: '', equipmentClass: '' };
		const first = equipmentCatalogPage(records, filters, 1);
		const second = equipmentCatalogPage(records, filters, 2);
		const last = equipmentCatalogPage(records, filters, 999);
		expect(first.total).toBe(147);
		expect(first.records).toHaveLength(24);
		expect(second.records).toHaveLength(24);
		expect(second.records.some((record) => first.records.includes(record))).toBe(false);
		expect(last.page).toBe(7);
		expect(last.records).toHaveLength(3);
		expect(equipmentCatalogPage(records, { ...filters, view: 'sets' }, 1).records).toHaveLength(21);
	});
});
