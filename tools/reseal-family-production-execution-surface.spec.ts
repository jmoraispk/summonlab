import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resealFamilyProductionExecutionSurface } from './reseal-family-production-execution-surface.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('family production execution-surface resealing', () => {
	it('updates only the non-contract skill-file hashes and then checks cleanly', async () => {
		const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'family-production-surface-'));
		temporaryRoots.push(repositoryRoot);
		const skillRoot = path.join(repositoryRoot, 'skills/summonlab-image-production');
		await cp(path.resolve('skills/summonlab-image-production'), skillRoot, { recursive: true });
		const contractPath = path.join(skillRoot, 'references/contract-v3.json');
		const sourcePath = path.join(skillRoot, 'references/species-grammar.md');
		const before = JSON.parse(await readFile(contractPath, 'utf8'));
		await writeFile(sourcePath, `${await readFile(sourcePath, 'utf8')}\nFixture migration.\n`);

		await expect(
			resealFamilyProductionExecutionSurface({ repositoryRoot, write: false })
		).rejects.toThrow(/execution surface seal drifted/i);
		await resealFamilyProductionExecutionSurface({ repositoryRoot, write: true });
		await expect(
			resealFamilyProductionExecutionSurface({ repositoryRoot, write: false })
		).resolves.toMatchObject({ mode: 'check' });

		const after = JSON.parse(await readFile(contractPath, 'utf8'));
		const expectedHash = createHash('sha256')
			.update(await readFile(sourcePath))
			.digest('hex');
		expect(after.executionSurface.expectedNonContractSha256['references/species-grammar.md']).toBe(
			expectedHash
		);
		expect({
			...after.executionSurface,
			expectedNonContractSha256: before.executionSurface.expectedNonContractSha256
		}).toEqual(before.executionSurface);
		expect({ ...after, executionSurface: before.executionSurface }).toEqual(before);
	});
});
