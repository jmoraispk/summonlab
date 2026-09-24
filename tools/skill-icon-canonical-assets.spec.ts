import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	CANONICAL_SKILL_ASSET_MANIFEST_PATH,
	buildCanonicalSkillAssets,
	loadCanonicalSkillAssets
} from './skill-icon-canonical-assets.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

describe('canonical skill icon assets', () => {
	it('binds exactly one frameless interior to every unified catalog record', async () => {
		const assets = await loadCanonicalSkillAssets(repositoryRoot);

		expect(assets.records).toHaveLength(457);
		expect(new Set(assets.records.map((record) => record.targetId)).size).toBe(457);
		expect(assets.records.every((record) => record.interiorPath.includes('/interiors/'))).toBe(
			true
		);
		expect(
			assets.records.find((record) => record.targetId === 'martial:blade:reversal-cut')
		).toMatchObject({
			slug: 'martial-blade-reversal-cut',
			interiorPath: 'assets/wiki/skills/icon-production-v2/interiors/martial-blade-reversal-cut.png'
		});
	});

	it('keeps only the seven reusable final frames and shared composition authorities', async () => {
		const assets = await loadCanonicalSkillAssets(repositoryRoot);

		expect(assets.frames.map((frame) => frame.rarity)).toEqual(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
		expect(assets.backing.path).toBe('assets/wiki/skills/icon-production-v2/backing.png');
		expect(assets.geometry.path).toBe('assets/wiki/skills/icon-production-v2/geometry.json');
		expect(assets.frameShapeAuthority).toEqual({
			path: 'assets/wiki/skills/icon-production-v2/frame-shape-authority.png',
			contentHash: '4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266'
		});
		expect(assets.layerOrder).toEqual(['backing', 'interior', 'rarity-frame']);
		expect(assets.sourcePolicy).toBe('exact-frameless-source');
		expect(assets.interiorTransform).toBe('identity');
	});

	it('stores a deterministic, hash-bound manifest instead of historical production evidence', async () => {
		const assets = await loadCanonicalSkillAssets(repositoryRoot);
		const raw = await readFile(
			path.join(repositoryRoot, CANONICAL_SKILL_ASSET_MANIFEST_PATH),
			'utf8'
		);

		expect(JSON.parse(raw).schemaVersion).toBe('skill-icon-canonical-assets-v1');
		expect(assets.summary).toEqual({ skillCount: 457, interiorCount: 457, frameCount: 7 });
		expect(raw).not.toContain('reversal-cut-v');
		expect(raw).not.toContain('review/');
	});

	it('rejects an unindexed interior instead of silently retaining production debris', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-assets-'));
		const destination = path.join(root, 'assets/wiki/skills/icon-production-v2');
		await mkdir(path.join(destination, 'interiors'), { recursive: true });
		await mkdir(path.join(destination, 'frames'));
		await writeFile(
			path.join(destination, 'catalog.json'),
			JSON.stringify({
				schemaVersion: 'skill-icon-catalog-v1',
				records: [{ targetId: 'martial:blade:measured-cut', rarity: 'F' }]
			})
		);
		await writeFile(path.join(destination, 'interiors/martial-blade-measured-cut.png'), 'art');
		for (const rarity of ['f', 'e', 'd', 'c', 'b', 'a', 's']) {
			await writeFile(path.join(destination, `frames/rarity-frame-${rarity}.png`), 'frame');
		}
		for (const file of ['backing.png', 'geometry.json', 'geometry-guide.png']) {
			await writeFile(path.join(destination, file), file);
		}
		await writeFile(path.join(destination, 'interiors/orphan.png'), 'not canonical');

		await expect(buildCanonicalSkillAssets(root)).rejects.toThrow(/inventory drift/i);
	});
});
