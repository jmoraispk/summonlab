import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	RETAINED_ENEMY_PACK_MANIFEST_PATH,
	RETAINED_FAMILY_AFFINITY_PACK_PATH,
	resealRetainedEnemyPackLineage
} from './reseal-retained-enemy-pack-lineage.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('retained enemy pack lineage reseal', () => {
	it('fails closed in check mode and byte-preservingly reseals catalog hashes in write mode', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'retained-enemy-pack-'));
		const catalogPath = 'assets/enemies/experiments/affinity-workflow-v1/review/catalog.json';
		const sourceManifestPath = 'assets/enemies/experiments/family-affinity-v1/manifest.json';
		const manifestPath = path.join(root, ...RETAINED_ENEMY_PACK_MANIFEST_PATH.split('/'));
		await Promise.all([
			mkdir(path.dirname(path.join(root, catalogPath)), { recursive: true }),
			mkdir(path.dirname(path.join(root, sourceManifestPath)), { recursive: true }),
			mkdir(path.dirname(manifestPath), { recursive: true })
		]);
		const catalog = '{"speciesId":"gray-wolf"}\n';
		const sourceManifest = '{"familyId":"gray-wolf"}\n';
		const stale = '1'.repeat(64);
		const manifest = `{"sources":[{"catalogPath":"${catalogPath}","catalogSha256":"${stale}"}]}\n`;
		const retainedPack = `{"sourceManifest":{"path":"${sourceManifestPath}","sha256":"${stale}"}}\n`;
		await Promise.all([
			writeFile(path.join(root, catalogPath), catalog),
			writeFile(path.join(root, sourceManifestPath), sourceManifest),
			writeFile(manifestPath, manifest),
			writeFile(path.join(root, RETAINED_FAMILY_AFFINITY_PACK_PATH), retainedPack)
		]);

		await expect(resealRetainedEnemyPackLineage({ root, mode: 'check' })).rejects.toThrow(
			'Retained enemy pack catalog lineage is stale'
		);
		await expect(resealRetainedEnemyPackLineage({ root, mode: 'write' })).resolves.toEqual({
			sources: 1,
			resealed: 2
		});
		expect(await readFile(manifestPath, 'utf8')).toBe(manifest.replace(stale, sha256(catalog)));
		expect(await readFile(path.join(root, RETAINED_FAMILY_AFFINITY_PACK_PATH), 'utf8')).toBe(
			retainedPack.replace(stale, sha256(sourceManifest))
		);
		await expect(resealRetainedEnemyPackLineage({ root, mode: 'check' })).resolves.toEqual({
			sources: 1,
			resealed: 0
		});
	});
});
