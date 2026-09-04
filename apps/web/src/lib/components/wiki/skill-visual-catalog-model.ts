import type { SkillVisualCatalogRecord } from '../../server/skill-visual-catalog.js';

export const SKILL_CATALOG_PAGE_SIZE = 120;

export interface SkillCatalogFilters {
	q: string;
	domain: '' | 'Martial' | 'Magical' | 'Craft';
	family: string;
	motif: string;
}

export const EMPTY_SKILL_CATALOG_FILTERS: SkillCatalogFilters = Object.freeze({
	q: '',
	domain: '',
	family: '',
	motif: ''
}) as SkillCatalogFilters;

const DOMAINS = ['Martial', 'Magical', 'Craft'] as const;
type SkillCatalogDomain = (typeof DOMAINS)[number];

function normalizedText(value: string): string {
	return value.toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim();
}

function searchable(record: SkillVisualCatalogRecord): string {
	return [
		record.name,
		record.domain,
		record.family,
		...record.labels.flatMap(({ namespace, value }) => [namespace, value]),
		record.type,
		record.acquisition,
		record.effect,
		record.motifFamily,
		record.primaryVisualParent?.name ?? ''
	]
		.join(' ')
		.toLocaleLowerCase('en')
		.replace(/\s+/gu, ' ')
		.trim();
}

function domain(value: string): SkillCatalogDomain | '' {
	const candidate = DOMAINS.find((entry) => entry === value);
	return candidate ?? '';
}

function sortedUnique(values: readonly string[]): readonly string[] {
	return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function optionsFor(
	records: readonly SkillVisualCatalogRecord[],
	selectedDomain: SkillCatalogDomain | ''
): readonly string[] {
	return sortedUnique(
		records
			.filter((record) => selectedDomain === '' || record.domain === selectedDomain)
			.map((record) => record.family)
	);
}

function canonicalOption(value: string, options: readonly string[]): string {
	return options.find((option) => option === value) ?? '';
}

function recordsForBroaderFilters(
	records: readonly SkillVisualCatalogRecord[],
	filters: SkillCatalogFilters
): readonly SkillVisualCatalogRecord[] {
	const selectedDomain = domain(filters.domain);
	const familyOptions = optionsFor(records, selectedDomain);
	const selectedFamily = canonicalOption(filters.family, familyOptions);
	return records.filter(
		(record) =>
			(selectedDomain === '' || record.domain === selectedDomain) &&
			(selectedFamily === '' || record.family === selectedFamily)
	);
}

export function compatibleSkillCatalogOptions(
	records: readonly SkillVisualCatalogRecord[],
	filters: SkillCatalogFilters
): { families: readonly string[]; motifs: readonly string[] } {
	const selectedDomain = domain(filters.domain);
	const families = optionsFor(records, selectedDomain);
	const selectedFamily = canonicalOption(filters.family, families);
	const motifRecords = records.filter(
		(record) =>
			(selectedDomain === '' || record.domain === selectedDomain) &&
			(selectedFamily === '' || record.family === selectedFamily)
	);

	return {
		families,
		motifs: sortedUnique(motifRecords.map((record) => record.motifFamily))
	};
}

export function normalizeSkillCatalogFilters(
	records: readonly SkillVisualCatalogRecord[],
	filters: SkillCatalogFilters
): SkillCatalogFilters {
	const selectedDomain = domain(filters.domain);
	const familyOptions = optionsFor(records, selectedDomain);
	const selectedFamily = canonicalOption(filters.family, familyOptions);
	const compatibleRecords = recordsForBroaderFilters(records, {
		...filters,
		domain: selectedDomain,
		family: selectedFamily
	});
	const selectedMotif = canonicalOption(
		filters.motif,
		sortedUnique(compatibleRecords.map((record) => record.motifFamily))
	);

	return {
		q: normalizedText(filters.q),
		domain: selectedDomain,
		family: selectedFamily,
		motif: selectedMotif
	};
}

export function parseSkillCatalogQuery(
	search: string,
	records: readonly SkillVisualCatalogRecord[]
): SkillCatalogFilters {
	const query = search.startsWith('?') ? search.slice(1) : search;
	const params = new URLSearchParams(query);
	return normalizeSkillCatalogFilters(records, {
		q: params.get('q') ?? '',
		domain: params.get('domain') ?? '',
		family: params.get('family') ?? '',
		motif: params.get('motif') ?? ''
	} as SkillCatalogFilters);
}

export function serializeSkillCatalogQuery(filters: SkillCatalogFilters): string {
	const params = new URLSearchParams();
	const values: readonly [string, string][] = [
		['q', normalizedText(filters.q)],
		['domain', filters.domain],
		['family', filters.family],
		['motif', filters.motif]
	];
	for (const [key, value] of values) {
		if (value !== '') params.set(key, value);
	}
	return params.toString();
}

export function filterSkillVisualCatalog(
	records: readonly SkillVisualCatalogRecord[],
	filters: SkillCatalogFilters
): readonly SkillVisualCatalogRecord[] {
	const query = normalizedText(filters.q);
	return records.filter(
		(record) =>
			(query === '' || searchable(record).includes(query)) &&
			(filters.domain === '' || record.domain === filters.domain) &&
			(filters.family === '' || record.family === filters.family) &&
			(filters.motif === '' || record.motifFamily === filters.motif)
	);
}
