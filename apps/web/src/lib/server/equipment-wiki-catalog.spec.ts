import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildEquipmentWikiCatalog, getEquipmentWikiCatalog } from './equipment-wiki-catalog';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..');
const read = (file: string) => readFileSync(path.join(repositoryRoot, file));
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('equipment wiki catalog', () => {
	it('includes all approved art without presenting Greatswords as integrated gameplay items', () => {
		const records = getEquipmentWikiCatalog();
		expect(records).toHaveLength(168);
		expect(records.filter((record) => record.role === 'armor-set-reference')).toHaveLength(21);
		expect(
			records.filter((record) => record.image.publicPath.startsWith('/runtime/'))
		).toHaveLength(140);
		const greatswords = records.filter((record) => record.equipmentClass === 'greatsword');
		expect(greatswords).toHaveLength(7);
		expect(greatswords.every((record) => record.integration === 'pending')).toBe(true);
		expect(new Set(records.map((record) => record.assetKey)).size).toBe(168);
	});

	it('pairs every complete set with its four matching approved pieces', () => {
		const records = getEquipmentWikiCatalog();
		for (const set of records.filter((record) => record.role === 'armor-set-reference')) {
			expect(set.pieces.map((piece) => piece.slot)).toEqual(['head', 'torso', 'legs', 'boots']);
			for (const piece of set.pieces) {
				expect(records.find((record) => record.assetKey === piece.assetKey)).toMatchObject({
					rank: set.rank,
					materialId: set.materialId,
					equipmentClass: set.equipmentClass
				});
			}
		}
	});

	it('binds displayed derivatives to approved sources and verifies the 28 new exported files', () => {
		const records = getEquipmentWikiCatalog();
		for (const record of records) {
			expect(sha256(read(record.sourcePath))).toBe(record.sourceContentHash);
			expect(sha256(read(`apps/web/static${record.image.publicPath}`))).toBe(
				record.image.contentHash
			);
		}
		expect(
			records.filter((record) => record.image.publicPath.startsWith('/wiki-media/'))
		).toHaveLength(28);
	});

	it('rejects stale source authority and a derivative rebound to another source', () => {
		const material = read(
			'assets/equipment/approved/material-equipment-v1/manifest.json'
		).toString();
		const greatsword = read(
			'assets/equipment/approved/two-handed-greatsword-v1/manifest.json'
		).toString();
		const runtime = read('apps/web/static/runtime/equipment-v1/manifest.json').toString();
		const gallery = JSON.parse(
			read('apps/web/static/wiki-media/equipment-gallery-v1/manifest.json').toString()
		);
		const stale = structuredClone(gallery);
		stale.sourceAuthorities.material.contentHash = '0'.repeat(64);
		expect(() =>
			buildEquipmentWikiCatalog({ material, greatsword, runtime, gallery: JSON.stringify(stale) })
		).toThrow(/source hash/i);
		const rebound = structuredClone(gallery);
		rebound.records[0].sourceContentHash = '0'.repeat(64);
		expect(() =>
			buildEquipmentWikiCatalog({ material, greatsword, runtime, gallery: JSON.stringify(rebound) })
		).toThrow(/source mismatch/i);
	});
});
