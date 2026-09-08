import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function corruptFirstHashAfter(source: string, marker: string): string {
	const markerIndex = source.indexOf(marker);
	if (markerIndex < 0) throw new Error(`Fixture marker is absent: ${marker}`);
	const valuesStart = markerIndex + marker.length;
	const suffix = source.slice(valuesStart);
	const corrupted = suffix.replace(/[a-f0-9]{64}/u, '0'.repeat(64));
	if (corrupted === suffix) throw new Error(`Fixture hash is absent after marker: ${marker}`);
	return `${source.slice(0, valuesStart)}${corrupted}`;
}

describe('character generation expectation resealing', () => {
	it('repairs every current-generation deterministic hash family and then checks cleanly', async () => {
		const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'character-expectations-'));
		temporaryRoots.push(repositoryRoot);
		const specificationPath = path.join(
			repositoryRoot,
			'packages/characters/src/characters.spec.ts'
		);
		await mkdir(path.dirname(specificationPath), { recursive: true });

		const expected = await readFile('packages/characters/src/characters.spec.ts', 'utf8');
		const stale = [
			'\t\texpect(ember.manifestHash).toBe(\n',
			'\t\texpect(pilot.map((draft) => draft.manifestHash)).toEqual([\n',
			'\t\texpect(expansion.map((draft) => draft.manifestHash)).toEqual([\n'
		].reduce(corruptFirstHashAfter, expected);
		await writeFile(specificationPath, stale, 'utf8');

		const scriptPath = path.resolve('tools/reseal-character-generation-expectations.ts');
		const tsxLoader = import.meta.resolve('tsx');
		await expect(
			execFileAsync(process.execPath, ['--import', tsxLoader, scriptPath, '--check'], {
				cwd: repositoryRoot
			})
		).rejects.toThrow(/require resealing/i);
		await execFileAsync(process.execPath, ['--import', tsxLoader, scriptPath], {
			cwd: repositoryRoot
		});

		expect(await readFile(specificationPath, 'utf8')).toBe(expected);
		await expect(
			execFileAsync(process.execPath, ['--import', tsxLoader, scriptPath, '--check'], {
				cwd: repositoryRoot
			})
		).resolves.toBeDefined();
	});
});
