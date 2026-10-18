import type { EquipmentWikiRecord } from '$lib/server/equipment-wiki-catalog';

export const EQUIPMENT_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export const EQUIPMENT_PAGE_SIZE = 24;

export interface EquipmentCatalogFilters {
	view: 'sets' | 'items';
	q: string;
	rank: string;
	equipmentClass: string;
}

export function filterEquipmentCatalog(
	records: readonly EquipmentWikiRecord[],
	filters: EquipmentCatalogFilters
): readonly EquipmentWikiRecord[] {
	const terms = filters.q.trim().toLowerCase().split(/\s+/u).filter(Boolean);
	return records
		.filter((record) => {
			if ((record.role === 'armor-set-reference') !== (filters.view === 'sets')) return false;
			if (filters.rank && record.rank !== filters.rank) return false;
			if (filters.equipmentClass && record.equipmentClass !== filters.equipmentClass) return false;
			const searchable = `${record.name} ${record.rank} ${record.assetKey}`.toLowerCase();
			return terms.every((term) => searchable.includes(term));
		})
		.sort(
			(left, right) =>
				EQUIPMENT_RANKS.indexOf(left.rank as (typeof EQUIPMENT_RANKS)[number]) -
				EQUIPMENT_RANKS.indexOf(right.rank as (typeof EQUIPMENT_RANKS)[number])
		);
}

export function equipmentCatalogPage(
	records: readonly EquipmentWikiRecord[],
	filters: EquipmentCatalogFilters,
	requestedPage: number
): { records: readonly EquipmentWikiRecord[]; total: number; page: number; pageCount: number } {
	const matching = filterEquipmentCatalog(records, filters);
	const pageCount =
		filters.view === 'sets' ? 1 : Math.max(1, Math.ceil(matching.length / EQUIPMENT_PAGE_SIZE));
	const page = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage) || 1));
	return {
		records:
			filters.view === 'sets'
				? matching
				: matching.slice((page - 1) * EQUIPMENT_PAGE_SIZE, page * EQUIPMENT_PAGE_SIZE),
		total: matching.length,
		page,
		pageCount
	};
}
