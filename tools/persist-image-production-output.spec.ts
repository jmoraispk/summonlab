import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { persistImageProductionOutput } from './persist-image-production-output.js';

describe('persistImageProductionOutput', () => {
	it('exclusive-creates an exact returned source without discovering shared files', async () => {
		const workspace = join(process.cwd(), 'test-results', `persist-exact-${crypto.randomUUID()}`);
		const source = join(workspace, 'returned-source.png');
		await mkdir(workspace, { recursive: true });
		await writeFile(
			source,
			await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#222833' } })
				.png()
				.toBuffer()
		);
		const destination = 'assets/enemies/experiments/test/candidates/subject/normal-v1.png';

		const report = await persistImageProductionOutput({
			workspaceRoot: workspace,
			sourcePath: source,
			destinationPath: destination,
			width: 1536,
			height: 1024,
			mediaType: 'image/png'
		});

		expect(report.operation).toBe('exclusive-copy');
		expect(report.source.contentHash).toBe(report.retained.contentHash);
		const originalBytes = await readFile(join(workspace, destination));
		expect(originalBytes.byteLength).toBe(report.retained.bytes);
		await expect(
			persistImageProductionOutput({
				workspaceRoot: workspace,
				sourcePath: source,
				destinationPath: destination,
				width: 1536,
				height: 1024,
				mediaType: 'image/png'
			})
		).rejects.toThrow(/EEXIST/u);
		expect(await readFile(join(workspace, destination))).toEqual(originalBytes);
	});

	it('rejects a symlinked destination parent without writing through it', async () => {
		const workspace = join(process.cwd(), 'test-results', `persist-symlink-${crypto.randomUUID()}`);
		const source = join(workspace, 'returned-source.png');
		const experimentRoot = join(workspace, 'assets/enemies/experiments');
		const symlinkTarget = join(workspace, 'symlink-target');
		await mkdir(experimentRoot, { recursive: true });
		await mkdir(symlinkTarget);
		await writeFile(
			source,
			await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#222833' } })
				.png()
				.toBuffer()
		);
		await symlink(symlinkTarget, join(experimentRoot, 'linked-output'));

		await expect(
			persistImageProductionOutput({
				workspaceRoot: workspace,
				sourcePath: source,
				destinationPath:
					'assets/enemies/experiments/linked-output/candidates/subject/normal-v1.png',
				width: 1536,
				height: 1024,
				mediaType: 'image/png'
			})
		).rejects.toThrow(/symbolic link/u);
		expect(await readdir(symlinkTarget)).toEqual([]);
	});

	it('normalizes only a near-match and rejects a different aspect ratio', async () => {
		const workspace = join(
			process.cwd(),
			'test-results',
			`persist-normalize-${crypto.randomUUID()}`
		);
		await mkdir(workspace, { recursive: true });
		const near = join(workspace, 'near.png');
		const wrong = join(workspace, 'wrong.png');
		await writeFile(
			near,
			await sharp({ create: { width: 1535, height: 1023, channels: 3, background: '#222833' } })
				.png()
				.toBuffer()
		);
		await writeFile(
			wrong,
			await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#222833' } })
				.png()
				.toBuffer()
		);

		const report = await persistImageProductionOutput({
			workspaceRoot: workspace,
			sourcePath: near,
			destinationPath: 'assets/enemies/experiments/test/candidates/subject/fire-v1.png',
			width: 1536,
			height: 1024,
			mediaType: 'image/png'
		});
		expect(report.operation).toBe('exclusive-resize-near-match');
		expect(report.retained).toMatchObject({ width: 1536, height: 1024 });

		await expect(
			persistImageProductionOutput({
				workspaceRoot: workspace,
				sourcePath: wrong,
				destinationPath: 'assets/enemies/experiments/test/candidates/subject/wind-v1.png',
				width: 1536,
				height: 1024,
				mediaType: 'image/png'
			})
		).rejects.toThrow(/aspect ratio/u);
	});
});
