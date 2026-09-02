import {
	lstat,
	mkdtemp,
	mkdir,
	open,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	persistEquipmentImageProductionOutput,
	type PersistEquipmentImageProductionOptions
} from './persist-equipment-image-production-output.js';

const ROOT = 'assets/equipment/experiments/material-equipment-v1';
const DESTINATION = `${ROOT}/candidates/f/copper/sword-v1.png`;
const workspaces: string[] = [];

async function createWorkspace(): Promise<string> {
	const workspace = await mkdtemp(join(tmpdir(), 'summonlab-equipment-persistence-'));
	workspaces.push(workspace);
	await writeAssignment(workspace, DESTINATION);
	return workspace;
}

async function writeAssignment(
	workspace: string,
	candidatePath: string,
	permittedCandidatePath = candidatePath
): Promise<void> {
	const candidatePrefix = `${ROOT}/candidates/`;
	const assignmentPath = `${ROOT}/assignments/${candidatePath.slice(candidatePrefix.length, -4)}.json`;
	await mkdir(join(workspace, assignmentPath, '..'), { recursive: true });
	await writeFile(
		join(workspace, assignmentPath),
		`${JSON.stringify({
			schemaVersion: 'equipment-image-assignment-v1',
			assignmentId: 'assignment-material-equipment-v1-copper-sword-v1',
			targetId: 'material-equipment-v1-copper-sword-v1',
			contractVersion: 'equipment-image-production-contract-v1',
			rendererVersion: 'equipment-image-prompt-v1',
			assignedAt: '2026-09-01T23:05:00.000Z',
			dryRun: false,
			retryCeiling: 0,
			permittedOutputs: {
				candidatePath: permittedCandidatePath,
				resultPath: `${ROOT}/results/f/copper/sword-v1.json`
			},
			forbiddenSharedPaths: ['assets/enemies'],
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		})}\n`
	);
}

async function createImage(
	workspace: string,
	name: string,
	input: {
		readonly width: number;
		readonly height: number;
		readonly format: 'jpeg' | 'png' | 'webp';
	}
): Promise<string> {
	const sourcePath = join(workspace, name);
	let pipeline = sharp({
		create: {
			width: input.width,
			height: input.height,
			channels: 4,
			background: '#38404aff'
		}
	});
	pipeline =
		input.format === 'png'
			? pipeline.png()
			: input.format === 'webp'
				? pipeline.webp()
				: pipeline.jpeg();
	await writeFile(sourcePath, await pipeline.toBuffer());
	return sourcePath;
}

function options(
	workspaceRoot: string,
	sourcePath: string,
	overrides: Partial<PersistEquipmentImageProductionOptions> = {}
): PersistEquipmentImageProductionOptions {
	return {
		workspaceRoot,
		sourcePath,
		destinationPath: DESTINATION,
		width: 1024,
		height: 1024,
		mediaType: 'image/png',
		...overrides
	};
}

afterEach(async () => {
	await Promise.all(
		workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true }))
	);
});

describe('persistEquipmentImageProductionOutput', () => {
	it('reports an exact source read failure before validating a bad destination', async () => {
		const workspace = await createWorkspace();
		const missingSource = join(workspace, 'missing-source.png');

		await expect(
			persistEquipmentImageProductionOutput(
				options(workspace, missingSource, { destinationPath: 'assets/enemies/bad.png' })
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects a syntactically valid candidate path that has no matching assignment', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const unassignedDestination = `${ROOT}/candidates/f/copper/invented-v1.png`;

		await expect(
			persistEquipmentImageProductionOutput(
				options(workspace, source, { destinationPath: unassignedDestination })
			)
		).rejects.toThrow(/assignment/u);
		await expect(readFile(join(workspace, unassignedDestination))).rejects.toThrow();
	});

	it('rejects a candidate path not reserved by its derived assignment', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const mismatchedDestination = `${ROOT}/candidates/f/copper/invented-v1.png`;
		await writeAssignment(workspace, mismatchedDestination, DESTINATION);

		await expect(
			persistEquipmentImageProductionOutput(
				options(workspace, source, { destinationPath: mismatchedDestination })
			)
		).rejects.toThrow(/does not reserve/u);
		await expect(readFile(join(workspace, mismatchedDestination))).rejects.toThrow();
	});

	it('exclusive-creates an exact PNG only at its assignment-owned Equipment candidate destination', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});

		await expect(
			persistEquipmentImageProductionOutput(
				options(workspace, source, { destinationPath: 'assets/enemies/bad.png' })
			)
		).rejects.toThrow('Equipment production root');

		const receipt = await persistEquipmentImageProductionOutput(options(workspace, source));

		expect(receipt).toMatchObject({
			operation: 'exclusive-copy',
			source: { path: source, width: 1024, height: 1024, mediaType: 'image/png' },
			retained: { path: DESTINATION, width: 1024, height: 1024, mediaType: 'image/png' }
		});
		expect(receipt.elapsedMs).toBeGreaterThanOrEqual(0);
		expect(receipt.source.bytes).toBeGreaterThan(0);
		expect(receipt.source.sha256).toMatch(/^[a-f0-9]{64}$/u);
		expect(receipt.retained.bytes).toBe(receipt.source.bytes);
		expect(receipt.retained.sha256).toBe(receipt.source.sha256);
		expect(await readFile(join(workspace, DESTINATION))).toEqual(await readFile(source));

		await expect(
			persistEquipmentImageProductionOutput(options(workspace, source))
		).rejects.toThrow();
		expect(await readFile(join(workspace, DESTINATION))).toEqual(await readFile(source));
	});

	it.each([
		['an absolute path', (workspace: string) => join(workspace, DESTINATION)],
		['parent traversal', () => `${ROOT}/candidates/f/../../../../../../../outside.png`],
		['backslashes', () => `${ROOT}\\candidates\\f\\copper\\sword-v1.png`],
		['a non-candidate Equipment path', () => `${ROOT}/results/f/copper/sword-v1.png`],
		['a candidate path with the wrong extension', () => `${ROOT}/candidates/f/copper/sword-v1.webp`]
	])('rejects %s as an unowned destination', async (_label, destinationFor) => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const destinationPath = destinationFor(workspace);

		await expect(
			persistEquipmentImageProductionOutput(options(workspace, source, { destinationPath }))
		).rejects.toThrow(
			/Equipment production root|repository-relative POSIX|assignment-owned candidate/u
		);
		if (!isAbsolute(destinationPath)) {
			await expect(readFile(join(workspace, destinationPath))).rejects.toThrow();
		}
	});

	it('rejects a symbolic-link destination ancestor without writing through it', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const candidatesRoot = join(workspace, ROOT, 'candidates');
		const symlinkTarget = join(workspace, 'outside-target');
		await mkdir(candidatesRoot, { recursive: true });
		await mkdir(symlinkTarget);
		await symlink(symlinkTarget, join(candidatesRoot, 'f'));

		await expect(persistEquipmentImageProductionOutput(options(workspace, source))).rejects.toThrow(
			/symbolic link/u
		);
		expect(await readdir(symlinkTarget)).toEqual([]);
	});

	it('rejects assignment authorization through a stable symlink ancestor with zero writes', async () => {
		const workspace = await createWorkspace();
		const outsideRoot = await mkdtemp(join(tmpdir(), 'equipment-assignment-outside-'));
		workspaces.push(outsideRoot);
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const assignmentsRoot = join(workspace, ROOT, 'assignments');
		const outsideAssignmentsRoot = join(outsideRoot, 'assignments');
		await rename(assignmentsRoot, outsideAssignmentsRoot);
		await symlink(outsideAssignmentsRoot, assignmentsRoot, 'dir');
		const assignmentPath = join(outsideAssignmentsRoot, 'f/copper/sword-v1.json');
		const assignmentBefore = await readFile(assignmentPath);

		await expect(persistEquipmentImageProductionOutput(options(workspace, source))).rejects.toThrow(
			/symbolic|symlink/iu
		);
		expect(await readFile(assignmentPath)).toEqual(assignmentBefore);
		await expect(lstat(join(workspace, DESTINATION))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			lstat(join(outsideRoot, 'candidates/f/copper/sword-v1.png'))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('does not unlink a replacement destination after an injected write failure', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});
		const probePath = join(workspace, 'file-handle-probe');
		const probeHandle = await open(probePath, 'w');
		const fileHandlePrototype = Object.getPrototypeOf(probeHandle) as {
			writeFile: (bytes: Uint8Array) => Promise<void>;
		};
		await probeHandle.close();
		await rm(probePath);
		const destinationPath = join(workspace, DESTINATION);
		const replacementBytes = Buffer.from('replacement owned by another writer');
		const writeSpy = vi.spyOn(fileHandlePrototype, 'writeFile').mockImplementationOnce(async () => {
			await rm(destinationPath);
			await writeFile(destinationPath, replacementBytes);
			throw new Error('injected write failure');
		});

		try {
			await expect(
				persistEquipmentImageProductionOutput(options(workspace, source))
			).rejects.toThrow('injected write failure');
		} finally {
			writeSpy.mockRestore();
		}
		expect(await readFile(destinationPath)).toEqual(replacementBytes);
	});

	it('rejects unsupported source formats', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.jpg', {
			width: 1024,
			height: 1024,
			format: 'jpeg'
		});

		await expect(persistEquipmentImageProductionOutput(options(workspace, source))).rejects.toThrow(
			'Unsupported source image format'
		);
	});

	it('rejects a source aspect-ratio error above 0.5%', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'wrong-aspect.png', {
			width: 1018,
			height: 1024,
			format: 'png'
		});

		await expect(persistEquipmentImageProductionOutput(options(workspace, source))).rejects.toThrow(
			/aspect ratio/u
		);
	});

	it('accepts an exact 0.5% source aspect-ratio error', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'boundary-aspect.png', {
			width: 995,
			height: 1000,
			format: 'png'
		});

		const receipt = await persistEquipmentImageProductionOutput(options(workspace, source));

		expect(receipt.operation).toBe('exclusive-resize-near-match');
		expect(receipt.source).toMatchObject({ width: 995, height: 1000 });
		expect(await sharp(join(workspace, DESTINATION)).metadata()).toMatchObject({
			format: 'png',
			width: 1024,
			height: 1024
		});
	});

	it('rejects when source and destination resolve to the same file', async () => {
		const workspace = await createWorkspace();
		const source = join(workspace, DESTINATION);
		await mkdir(join(workspace, ROOT, 'candidates/f/copper'), { recursive: true });
		await writeFile(
			source,
			await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#38404aff' } })
				.png()
				.toBuffer()
		);

		await expect(persistEquipmentImageProductionOutput(options(workspace, source))).rejects.toThrow(
			'Source and destination must differ'
		);
	});

	it.each([
		['width', { width: undefined }],
		['height', { height: undefined }],
		['media type', { mediaType: undefined }]
	])('rejects incomplete declared %s metadata', async (_label, incomplete) => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.png', {
			width: 1024,
			height: 1024,
			format: 'png'
		});

		await expect(
			persistEquipmentImageProductionOutput({
				...options(workspace, source),
				...incomplete
			} as unknown as PersistEquipmentImageProductionOptions)
		).rejects.toThrow('Declared output metadata is incomplete');
	});

	it('normalizes a supported WebP source to an exact PNG', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'returned-source.webp', {
			width: 1024,
			height: 1024,
			format: 'webp'
		});

		const receipt = await persistEquipmentImageProductionOutput(options(workspace, source));
		const retainedMetadata = await sharp(join(workspace, DESTINATION)).metadata();

		expect(receipt.operation).toBe('exclusive-normalize-format');
		expect(receipt.source.mediaType).toBe('image/webp');
		expect(receipt.retained.mediaType).toBe('image/png');
		expect(receipt.retained.sha256).not.toBe(receipt.source.sha256);
		expect(retainedMetadata).toMatchObject({ format: 'png', width: 1024, height: 1024 });
	});

	it('resizes a supported near-match to the declared PNG canvas', async () => {
		const workspace = await createWorkspace();
		const source = await createImage(workspace, 'near-match.png', {
			width: 1023,
			height: 1024,
			format: 'png'
		});

		const receipt = await persistEquipmentImageProductionOutput(options(workspace, source));
		const retainedMetadata = await sharp(join(workspace, DESTINATION)).metadata();

		expect(receipt.operation).toBe('exclusive-resize-near-match');
		expect(receipt.source).toMatchObject({ width: 1023, height: 1024, mediaType: 'image/png' });
		expect(receipt.retained).toMatchObject({ width: 1024, height: 1024, mediaType: 'image/png' });
		expect(retainedMetadata).toMatchObject({ format: 'png', width: 1024, height: 1024 });
	});
});
