import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { EQUIPMENT_PRODUCTION_ROOT } from './equipment-image-production-contract.js';

export interface PersistEquipmentImageProductionOptions {
	readonly workspaceRoot: string;
	readonly sourcePath: string;
	readonly destinationPath: string;
	readonly width: number;
	readonly height: number;
	readonly mediaType: 'image/png';
}

export interface EquipmentPersistenceReceipt {
	readonly operation:
		'exclusive-copy' | 'exclusive-normalize-format' | 'exclusive-resize-near-match';
	readonly elapsedMs: number;
	readonly source: {
		readonly path: string;
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png' | 'image/webp';
		readonly bytes: number;
		readonly sha256: string;
	};
	readonly retained: {
		readonly path: string;
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png';
		readonly bytes: number;
		readonly sha256: string;
	};
}

interface NormalizedImage {
	readonly bytes: Buffer;
	readonly operation: EquipmentPersistenceReceipt['operation'];
	readonly sourceMetadata: {
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png' | 'image/webp';
	};
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function destinationAbsolutePath(workspaceRoot: string, destinationPath: string): string {
	if (isAbsolute(destinationPath) || destinationPath.includes('\\')) {
		throw new Error('Destination must be a repository-relative POSIX path');
	}
	if (destinationPath.split('/').some((component) => component === '..')) {
		throw new Error('Destination must stay within the Equipment production root');
	}

	const candidatePattern = new RegExp(
		`^${EQUIPMENT_PRODUCTION_ROOT}/candidates/[fedcbas]/[a-z][a-z0-9-]*/[a-z][a-z0-9-]*\\.png$`,
		'u'
	);
	if (!destinationPath.startsWith(`${EQUIPMENT_PRODUCTION_ROOT}/`)) {
		throw new Error('Destination must stay within the Equipment production root');
	}
	if (!candidatePattern.test(destinationPath)) {
		throw new Error('Destination must be an assignment-owned candidate PNG path');
	}

	const absolutePath = resolve(workspaceRoot, destinationPath);
	const fromWorkspace = relative(workspaceRoot, absolutePath);
	if (fromWorkspace.startsWith('..') || isAbsolute(fromWorkspace)) {
		throw new Error('Destination must stay within the Equipment production root');
	}
	return absolutePath;
}

function assertDeclaredMetadata(
	options: PersistEquipmentImageProductionOptions
): asserts options is PersistEquipmentImageProductionOptions {
	if (
		!Number.isInteger(options.width) ||
		options.width <= 0 ||
		!Number.isInteger(options.height) ||
		options.height <= 0 ||
		options.mediaType !== 'image/png'
	) {
		throw new Error('Declared output metadata is incomplete or unsupported');
	}
}

function mediaTypeForFormat(format: string): 'image/png' | 'image/webp' {
	if (format === 'png') return 'image/png';
	if (format === 'webp') return 'image/webp';
	throw new Error(`Unsupported source image format: ${format}`);
}

async function normalizeAndVerify(
	sourceBytes: Buffer,
	declaredCanvas: { readonly width: number; readonly height: number }
): Promise<NormalizedImage> {
	const sourceMetadata = await sharp(sourceBytes).metadata();
	if (!sourceMetadata.width || !sourceMetadata.height || !sourceMetadata.format) {
		throw new Error('Source image metadata is incomplete');
	}
	const sourceMediaType = mediaTypeForFormat(sourceMetadata.format);
	const sourceRatio = sourceMetadata.width / sourceMetadata.height;
	const declaredRatio = declaredCanvas.width / declaredCanvas.height;
	const relativeRatioError = Math.abs(sourceRatio - declaredRatio) / declaredRatio;
	if (relativeRatioError > 0.005) {
		throw new Error(
			`Source aspect ratio ${sourceMetadata.width}×${sourceMetadata.height} is not a supported near-match for ${declaredCanvas.width}×${declaredCanvas.height}`
		);
	}

	let bytes = sourceBytes;
	let operation: EquipmentPersistenceReceipt['operation'] = 'exclusive-copy';
	if (
		sourceMetadata.width !== declaredCanvas.width ||
		sourceMetadata.height !== declaredCanvas.height
	) {
		operation = 'exclusive-resize-near-match';
		bytes = await sharp(sourceBytes)
			.resize(declaredCanvas.width, declaredCanvas.height, {
				fit: 'fill',
				kernel: sharp.kernel.lanczos3
			})
			.png({ compressionLevel: 9 })
			.toBuffer();
	} else if (sourceMetadata.format !== 'png') {
		operation = 'exclusive-normalize-format';
		bytes = await sharp(sourceBytes).png({ compressionLevel: 9 }).toBuffer();
	}

	const retainedMetadata = await sharp(bytes).metadata();
	if (
		retainedMetadata.width !== declaredCanvas.width ||
		retainedMetadata.height !== declaredCanvas.height ||
		retainedMetadata.format !== 'png'
	) {
		throw new Error('Normalized image does not satisfy the declared Equipment output contract');
	}

	return {
		bytes,
		operation,
		sourceMetadata: {
			width: sourceMetadata.width,
			height: sourceMetadata.height,
			mediaType: sourceMediaType
		}
	};
}

async function ensureSafeDestinationParents(
	workspaceRoot: string,
	destinationPath: string
): Promise<void> {
	const parentPath = dirname(destinationPath);
	const relativeParentPath = relative(workspaceRoot, parentPath);
	const components = relativeParentPath === '' ? [] : relativeParentPath.split(sep);
	let cursor = workspaceRoot;

	const workspaceMetadata = await lstat(cursor);
	if (workspaceMetadata.isSymbolicLink() || !workspaceMetadata.isDirectory()) {
		throw new Error('Workspace root must be a real directory, not a symbolic link');
	}

	for (const component of components) {
		cursor = resolve(cursor, component);
		let metadata;
		try {
			metadata = await lstat(cursor);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			try {
				await mkdir(cursor);
			} catch (mkdirError) {
				if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
			}
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink()) {
			throw new Error(`Destination parent cannot be a symbolic link: ${cursor}`);
		}
		if (!metadata.isDirectory()) {
			throw new Error(`Destination parent is not a directory: ${cursor}`);
		}
	}
}

export async function persistEquipmentImageProductionOutput(
	options: PersistEquipmentImageProductionOptions
): Promise<EquipmentPersistenceReceipt> {
	const started = performance.now();
	const workspaceRoot = resolve(options.workspaceRoot);
	const destinationPath = destinationAbsolutePath(workspaceRoot, options.destinationPath);
	const sourcePath = resolve(options.sourcePath);
	if (sourcePath === destinationPath) throw new Error('Source and destination must differ');
	assertDeclaredMetadata(options);

	const sourceBytes = await readFile(sourcePath);
	const normalized = await normalizeAndVerify(sourceBytes, {
		width: options.width,
		height: options.height
	});
	await ensureSafeDestinationParents(workspaceRoot, destinationPath);
	await ensureSafeDestinationParents(workspaceRoot, destinationPath);

	let handle;
	let createdDestination = false;
	try {
		handle = await open(destinationPath, 'wx');
		createdDestination = true;
		await handle.writeFile(normalized.bytes);
		await handle.sync();
		await handle.close();
		handle = undefined;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		if (createdDestination) await unlink(destinationPath).catch(() => undefined);
		throw error;
	}

	return {
		operation: normalized.operation,
		elapsedMs: Math.max(0, Math.round(performance.now() - started)),
		source: {
			path: sourcePath,
			width: normalized.sourceMetadata.width,
			height: normalized.sourceMetadata.height,
			mediaType: normalized.sourceMetadata.mediaType,
			bytes: sourceBytes.byteLength,
			sha256: sha256(sourceBytes)
		},
		retained: {
			path: options.destinationPath,
			width: options.width,
			height: options.height,
			mediaType: options.mediaType,
			bytes: normalized.bytes.byteLength,
			sha256: sha256(normalized.bytes)
		}
	};
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
if (isCli) {
	const receipt = await persistEquipmentImageProductionOutput({
		workspaceRoot: option('--workspace-root'),
		sourcePath: option('--source'),
		destinationPath: option('--destination'),
		width: Number(option('--width')),
		height: Number(option('--height')),
		mediaType: option('--media-type') as 'image/png'
	});
	process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
