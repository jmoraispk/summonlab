import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
	PRIVATE_PLAYTEST_COPY_TARGETS,
	PRIVATE_PLAYTEST_PACKAGE_NAMES,
	createPrivatePlaytestPackage
} from './playtest-package-lib.js';

const run = promisify(execFile);
const temporaryRoots: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), prefix));
	temporaryRoots.push(directory);
	return directory;
}

async function fixtureRoot(): Promise<string> {
	const root = await temporaryDirectory('summonlab-package-fixture-');
	for (const target of PRIVATE_PLAYTEST_COPY_TARGETS) {
		const targetPath = path.join(root, target);
		if (target.endsWith('/build') || target.endsWith('/dist') || target.endsWith('/migrations')) {
			await mkdir(targetPath, { recursive: true });
			await writeFile(path.join(targetPath, 'fixture.js'), 'export const fixture = true;\n');
			if (target === 'apps/web/build' || target === 'apps/worker/dist') {
				await writeFile(path.join(targetPath, 'index.js'), 'export const entry = true;\n');
			}
			if (target.endsWith('/build')) {
				await writeFile(path.join(targetPath, 'source-art.png'), 'not runtime art\n');
				await writeFile(path.join(targetPath, 'source.js.map'), 'development source map\n');
			}
		} else {
			await mkdir(path.dirname(targetPath), { recursive: true });
			const content = target.endsWith('package.json')
				? `${JSON.stringify({ name: `fixture-${target}`, private: true })}\n`
				: `${target}\n`;
			await writeFile(targetPath, content);
		}
	}
	for (const packageName of PRIVATE_PLAYTEST_PACKAGE_NAMES) {
		const packageRoot = path.join(root, 'packages', packageName);
		await mkdir(path.join(packageRoot, 'dist'), { recursive: true });
		await writeFile(
			path.join(packageRoot, 'package.json'),
			`${JSON.stringify({
				name: `@summonlab/${packageName}`,
				type: 'module',
				exports:
					packageName === 'policies'
						? { '.': './src/index.ts', './openai': './src/openai.ts' }
						: './src/index.ts',
				scripts: { build: 'fixture' }
			})}\n`
		);
		await writeFile(path.join(packageRoot, 'dist/index.js'), 'export const built = true;\n');
		if (packageName === 'database') {
			await writeFile(path.join(packageRoot, 'dist/migrate.js'), 'export const migrated = true;\n');
		}
		if (packageName === 'policies') {
			await writeFile(path.join(packageRoot, 'dist/openai.js'), 'export const openai = true;\n');
		}
	}
	return root;
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

describe('private playtest package assembly', () => {
	it('creates a deterministic, built-only rehearsal archive and typed receipt', async () => {
		const root = await fixtureRoot();
		const firstOutput = await temporaryDirectory('summonlab-package-output-a-');
		const secondOutput = await temporaryDirectory('summonlab-package-output-b-');
		const options = {
			root,
			archiveName: 'summonlab-fin008-package-rehearsal.tar.gz' as const,
			mode: 'rehearsal' as const,
			metadata: {
				releaseId: 'fin008-private-playtest-v1' as const,
				commit: 'a'.repeat(40),
				sourceTreeStatus: 'clean' as const,
				releaseReportHash: 'b'.repeat(64),
				ownerPlaytestReportHash: 'c'.repeat(64)
			}
		};
		const first = await createPrivatePlaytestPackage({ ...options, artifactRoot: firstOutput });
		const second = await createPrivatePlaytestPackage({ ...options, artifactRoot: secondOutput });

		expect(first.receipt).toMatchObject({ mode: 'rehearsal', bytes: expect.any(Number) });
		expect(first.receipt.sha256).toBe(second.receipt.sha256);
		expect(await readFile(first.receiptPath, 'utf8')).toContain(first.receipt.sha256);

		const { stdout: entries } = await run('tar', ['-tzf', first.archivePath]);
		expect(entries).toContain('summonlab-private-playtest/apps/web/build/fixture.js');
		expect(entries).toContain('summonlab-private-playtest/packages/database/dist/index.js');
		expect(entries).not.toMatch(/node_modules|\.env$|src\/|raw-notes|\.png|\.map/u);

		const { stdout: databaseManifestSource } = await run('tar', [
			'-xOzf',
			first.archivePath,
			'summonlab-private-playtest/packages/database/package.json'
		]);
		const databaseManifest = JSON.parse(databaseManifestSource) as {
			exports: string;
			scripts: { migrate: string };
		};
		expect(databaseManifest.exports).toBe('./dist/index.js');
		expect(databaseManifest.scripts.migrate).toBe('node dist/migrate.js');

		const { stdout: releaseSource } = await run('tar', [
			'-xOzf',
			first.archivePath,
			'summonlab-private-playtest/RELEASE.json'
		]);
		expect(JSON.parse(releaseSource)).toMatchObject({ mode: 'rehearsal', commit: 'a'.repeat(40) });
	});
});
