import { describe, expect, it } from 'vitest';

import type { SkillVisualCatalogRecord } from '../../server/skill-visual-catalog.js';
import {
	EMPTY_SKILL_CATALOG_FILTERS,
	SKILL_CATALOG_PAGE_SIZE,
	compatibleSkillCatalogOptions,
	filterSkillVisualCatalog,
	normalizeSkillCatalogFilters,
	parseSkillCatalogQuery,
	serializeSkillCatalogQuery
} from './skill-visual-catalog-model.js';

function record(
	targetId: string,
	fields: Pick<
		SkillVisualCatalogRecord,
		'name' | 'domain' | 'family' | 'labels' | 'type' | 'acquisition' | 'effect' | 'motifFamily'
	> &
		Partial<Pick<SkillVisualCatalogRecord, 'primaryVisualParent'>>
): SkillVisualCatalogRecord {
	return {
		targetId,
		name: fields.name,
		domain: fields.domain,
		family: fields.family,
		labels: fields.labels,
		type: fields.type,
		acquisition: fields.acquisition,
		effect: fields.effect,
		motifFamily: fields.motifFamily,
		primaryVisualParent: fields.primaryVisualParent ?? null,
		image: {
			publicPath: `/wiki-media/skills/visual-catalog-v1/icons/${targetId}.webp`,
			width: 512,
			height: 512
		},
		provenance: {
			status: 'candidate',
			sourcePath: `assets/${targetId}.png`,
			runtimePath: `${targetId}.webp`
		}
	};
}

const records: readonly SkillVisualCatalogRecord[] = [
	record('martial:blade:swordsmanship', {
		name: 'Swordsmanship',
		domain: 'Martial',
		family: 'Blade',
		labels: [{ namespace: 'Equipment', value: 'Sword' }],
		type: 'Passive',
		acquisition: 'Hold a sword',
		effect: 'Small accuracy bonus with swords',
		motifFamily: 'blade.precision-cut'
	}),
	record('martial:blade:parry', {
		name: 'Parry',
		domain: 'Martial',
		family: 'Blade',
		labels: [{ namespace: 'Equipment', value: 'Sword' }],
		type: 'Active',
		acquisition: 'Train with a blade',
		effect: 'Deflect an incoming strike',
		motifFamily: 'blade.precision-cut',
		primaryVisualParent: { targetId: 'martial:blade:swordsmanship', name: 'Swordsmanship' }
	}),
	record('martial:polearm:hook', {
		name: 'Hook Sweep',
		domain: 'Martial',
		family: 'Polearm',
		labels: [{ namespace: 'Equipment', value: 'Glaive' }],
		type: 'Active',
		acquisition: 'Hold a polearm',
		effect: 'Pull a target closer',
		motifFamily: 'polearm.reaping'
	}),
	record('magical:elemental:ember', {
		name: 'Ember',
		domain: 'Magical',
		family: 'Elemental',
		labels: [{ namespace: 'Element', value: 'Fire' }],
		type: 'Active',
		acquisition: 'Learn a fire affinity',
		effect: 'Launch a small firebolt',
		motifFamily: 'elemental.fire'
	}),
	record('magical:ward:aegis', {
		name: 'Aegis',
		domain: 'Magical',
		family: 'Ward',
		labels: [{ namespace: 'Element', value: 'Earth' }],
		type: 'Stance',
		acquisition: 'Study warding',
		effect: 'Absorb elemental damage',
		motifFamily: 'ward.protection'
	}),
	record('craft:forging:temper', {
		name: 'Temper',
		domain: 'Craft',
		family: 'Forging',
		labels: [{ namespace: 'Equipment', value: 'Metal' }],
		type: 'Craft',
		acquisition: 'Work at a forge',
		effect: 'Harden a metal item',
		motifFamily: 'forging.heat'
	})
];

describe('skill visual catalog model', () => {
	it('searches every visible field case-insensitively with normalized whitespace', () => {
		const queries = [
			'name: swordsmanship',
			'domain: martial',
			'family: blade',
			'label namespace: equipment',
			'label value: sword',
			'type: passive',
			'acquisition: hold a sword',
			'effect: accuracy bonus',
			'motif: precision-cut',
			'parent name: swordsmanship'
		];

		for (const query of queries) {
			const value = query.slice(query.indexOf(':') + 1);
			const result = filterSkillVisualCatalog(records, {
				...EMPTY_SKILL_CATALOG_FILTERS,
				q: `  ${value.toUpperCase().replaceAll(' ', '   ')}  `
			});
			expect(
				result.map(({ targetId }) => targetId),
				query
			).toContain('martial:blade:swordsmanship');
		}

		expect(
			filterSkillVisualCatalog(records, { ...EMPTY_SKILL_CATALOG_FILTERS, q: '  FIRE   AFFINITY ' })
		).toHaveLength(1);
		expect(
			filterSkillVisualCatalog(records, { ...EMPTY_SKILL_CATALOG_FILTERS, q: 'visual-catalog-v1' })
		).toHaveLength(0);
	});

	it('combines query, domain, family, and motif filters in source order', () => {
		const result = filterSkillVisualCatalog(records, {
			q: 'blade',
			domain: 'Martial',
			family: 'Blade',
			motif: 'blade.precision-cut'
		});

		expect(result.map(({ targetId }) => targetId)).toEqual([
			'martial:blade:swordsmanship',
			'martial:blade:parry'
		]);
	});

	it('derives sorted dependent family and motif options', () => {
		expect(compatibleSkillCatalogOptions(records, EMPTY_SKILL_CATALOG_FILTERS)).toEqual({
			families: ['Blade', 'Elemental', 'Forging', 'Polearm', 'Ward'],
			motifs: [
				'blade.precision-cut',
				'elemental.fire',
				'forging.heat',
				'polearm.reaping',
				'ward.protection'
			]
		});
		expect(
			compatibleSkillCatalogOptions(records, { ...EMPTY_SKILL_CATALOG_FILTERS, domain: 'Martial' })
		).toEqual({
			families: ['Blade', 'Polearm'],
			motifs: ['blade.precision-cut', 'polearm.reaping']
		});
		expect(
			compatibleSkillCatalogOptions(records, {
				...EMPTY_SKILL_CATALOG_FILTERS,
				domain: 'Martial',
				family: 'Blade'
			})
		).toEqual({ families: ['Blade', 'Polearm'], motifs: ['blade.precision-cut'] });
	});

	it('clears incompatible narrower filters while retaining compatible values', () => {
		expect(
			normalizeSkillCatalogFilters(records, {
				q: '  EMBER  ',
				domain: 'Martial',
				family: 'Elemental',
				motif: 'elemental.fire'
			})
		).toEqual({ q: 'ember', domain: 'Martial', family: '', motif: '' });
		expect(
			normalizeSkillCatalogFilters(records, {
				...EMPTY_SKILL_CATALOG_FILTERS,
				domain: 'Magical',
				family: 'Elemental',
				motif: 'elemental.fire'
			})
		).toEqual({ q: '', domain: 'Magical', family: 'Elemental', motif: 'elemental.fire' });
	});

	it('round-trips URL state in fixed order and removes invalid values', () => {
		const filters = {
			q: 'ember fire',
			domain: 'Magical' as const,
			family: 'Elemental',
			motif: 'elemental.fire'
		};
		expect(serializeSkillCatalogQuery(filters)).toBe(
			'q=ember+fire&domain=Magical&family=Elemental&motif=elemental.fire'
		);
		expect(parseSkillCatalogQuery(`?${serializeSkillCatalogQuery(filters)}`, records)).toEqual(
			filters
		);
		expect(
			parseSkillCatalogQuery('?q=%20%20EMBER%20%20&domain=Nope&family=Nope&motif=Nope', records)
		).toEqual({
			q: 'ember',
			domain: '',
			family: '',
			motif: ''
		});
	});

	it('uses the page size for visible windows at every catalog boundary', () => {
		const all = Array.from({ length: 456 }, (_, index) => records[index % records.length]!);
		expect(SKILL_CATALOG_PAGE_SIZE).toBe(120);
		expect(all.slice(0, SKILL_CATALOG_PAGE_SIZE)).toHaveLength(120);
		expect(all.slice(0, SKILL_CATALOG_PAGE_SIZE * 2)).toHaveLength(240);
		expect(all.slice(0, SKILL_CATALOG_PAGE_SIZE * 3)).toHaveLength(360);
		expect(all.slice(0, SKILL_CATALOG_PAGE_SIZE * 4)).toHaveLength(456);
	});
});
