import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resealHistoricalEarthBridgeSources } from './reseal-historical-earth-bridge-sources.js';

const temporaryRoots: string[] = [];
const wavePath = 'assets/enemies/experiments/family-affinity-v1/waves/earth-bridge-v1.json';
const mappingPath = 'assets/enemies/experiments/family-affinity-v1/current-class-mapping.json';
const visualIndexPath = 'docs/wiki/creatures/monsters/visual-index.json';

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('historical Earth bridge source resealing', () => {
	it('updates only the exact mapping raw-source hash and retains historical visual evidence', async () => {
		const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'earth-bridge-reseal-'));
		temporaryRoots.push(repositoryRoot);
		for (const repositoryPath of [wavePath, mappingPath, visualIndexPath]) {
			await mkdir(path.dirname(path.join(repositoryRoot, repositoryPath)), { recursive: true });
		}
		const before = {
			schemaVersion: 'earth-bridge-wave-v1',
			waveId: 'earth-bridge-v1',
			sourceMappingPath: mappingPath,
			sourceMappingSha256: 'a'.repeat(64),
			sourceVisualIndexPath: visualIndexPath,
			sourceVisualIndexSha256: 'b'.repeat(64),
			preservedEvidence: { status: 'candidate-only', reviewedAt: '2026-09-02T18:30:00.000Z' }
		};
		await writeFile(path.join(repositoryRoot, wavePath), `${JSON.stringify(before)}\n`);
		await writeFile(path.join(repositoryRoot, mappingPath), '{"form":"gray-wolf"}\n');
		await writeFile(path.join(repositoryRoot, visualIndexPath), '{"palette":"ocher"}\n');

		await expect(
			resealHistoricalEarthBridgeSources({ repositoryRoot, write: false })
		).rejects.toThrow(/source seal drifted/i);
		await resealHistoricalEarthBridgeSources({ repositoryRoot, write: true });
		await expect(
			resealHistoricalEarthBridgeSources({ repositoryRoot, write: false })
		).resolves.toMatchObject({ mode: 'check' });

		const after = JSON.parse(await readFile(path.join(repositoryRoot, wavePath), 'utf8'));
		expect(after).toEqual({
			...before,
			sourceMappingSha256: createHash('sha256')
				.update(await readFile(path.join(repositoryRoot, mappingPath)))
				.digest('hex'),
			sourceVisualIndexSha256: before.sourceVisualIndexSha256
		});
	});

	it('rejects a wave that redirects either historical source', async () => {
		const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'earth-bridge-reseal-'));
		temporaryRoots.push(repositoryRoot);
		await mkdir(path.dirname(path.join(repositoryRoot, wavePath)), { recursive: true });
		await writeFile(
			path.join(repositoryRoot, wavePath),
			`${JSON.stringify({
				schemaVersion: 'earth-bridge-wave-v1',
				waveId: 'earth-bridge-v1',
				sourceMappingPath: 'unexpected.json',
				sourceMappingSha256: 'a'.repeat(64),
				sourceVisualIndexPath: visualIndexPath,
				sourceVisualIndexSha256: 'b'.repeat(64)
			})}\n`
		);

		await expect(
			resealHistoricalEarthBridgeSources({ repositoryRoot, write: true })
		).rejects.toThrow(/exact historical source paths/i);
	});
});
