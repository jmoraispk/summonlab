import { createHash } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import sharp from 'sharp';

export interface PersistImageProductionOptions {
	readonly workspaceRoot: string;
	readonly sourcePath: string;
	readonly destinationPath: string;
	readonly width: number;
	readonly height: number;
	readonly mediaType: 'image/png' | 'image/webp';
}

export interface PersistImageProductionReport {
	readonly operation:
		'exclusive-copy' | 'exclusive-normalize-format' | 'exclusive-resize-near-match';
	readonly elapsedMs: number;
	readonly source: {
		readonly path: string;
		readonly width: number;
		readonly height: number;
		readonly mediaType: string;
		readonly bytes: number;
		readonly contentHash: string;
	};
	readonly retained: {
		readonly path: string;
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png' | 'image/webp';
		readonly bytes: number;
		readonly contentHash: string;
	};
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function ensureDestination(workspaceRoot: string, destinationPath: string): string {
	if (isAbsolute(destinationPath) || destinationPath.includes('\\')) {
		throw new Error('Destination must be a repository-relative POSIX path');
	}
	const absolute = resolve(workspaceRoot, destinationPath);
	const fromWorkspace = relative(workspaceRoot, absolute);
	if (
		fromWorkspace.startsWith('..') ||
		isAbsolute(fromWorkspace) ||
		!fromWorkspace.startsWith('assets/enemies/experiments/')
	) {
		throw new Error('Destination escaped the image-production experiment root');
	}
	return absolute;
}

function mediaTypeForFormat(format: string | undefined): string {
	return format === 'png'
		? 'image/png'
		: format === 'webp'
			? 'image/webp'
			: `image/${format ?? 'unknown'}`;
}

export async function persistImageProductionOutput(
	options: PersistImageProductionOptions
): Promise<PersistImageProductionReport> {
	const started = performance.now();
	const workspaceRoot = resolve(options.workspaceRoot);
	const sourcePath = resolve(options.sourcePath);
	const destinationPath = ensureDestination(workspaceRoot, options.destinationPath);
	if (sourcePath === destinationPath) throw new Error('Source and destination must differ');
	if (!Number.isInteger(options.width) || !Number.isInteger(options.height)) {
		throw new Error('Target dimensions must be integers');
	}

	const sourceBytes = await readFile(sourcePath);
	const sourceMetadata = await sharp(sourceBytes).metadata();
	if (!sourceMetadata.width || !sourceMetadata.height || !sourceMetadata.format) {
		throw new Error('Source image metadata is incomplete');
	}
	if (!['png', 'webp'].includes(sourceMetadata.format)) {
		throw new Error(`Unsupported source image format: ${sourceMetadata.format}`);
	}
	const sourceRatio = sourceMetadata.width / sourceMetadata.height;
	const targetRatio = options.width / options.height;
	const relativeRatioError = Math.abs(sourceRatio - targetRatio) / targetRatio;
	if (relativeRatioError > 0.005) {
		throw new Error(
			`Source aspect ratio ${sourceMetadata.width}×${sourceMetadata.height} is not a supported near-match for ${options.width}×${options.height}`
		);
	}

	const expectedFormat = options.mediaType === 'image/png' ? 'png' : 'webp';
	let operation: PersistImageProductionReport['operation'] = 'exclusive-copy';
	let retainedBytes = sourceBytes;
	if (sourceMetadata.width !== options.width || sourceMetadata.height !== options.height) {
		operation = 'exclusive-resize-near-match';
		const pipeline = sharp(sourceBytes).resize(options.width, options.height, {
			fit: 'fill',
			kernel: sharp.kernel.lanczos3
		});
		retainedBytes =
			expectedFormat === 'png'
				? await pipeline.png({ compressionLevel: 9 }).toBuffer()
				: await pipeline.webp({ quality: 95 }).toBuffer();
	} else if (sourceMetadata.format !== expectedFormat) {
		operation = 'exclusive-normalize-format';
		retainedBytes =
			expectedFormat === 'png'
				? await sharp(sourceBytes).png({ compressionLevel: 9 }).toBuffer()
				: await sharp(sourceBytes).webp({ quality: 95 }).toBuffer();
	}

	const retainedMetadata = await sharp(retainedBytes).metadata();
	if (
		retainedMetadata.width !== options.width ||
		retainedMetadata.height !== options.height ||
		retainedMetadata.format !== expectedFormat
	) {
		throw new Error('Normalized image does not satisfy the declared output contract');
	}

	await mkdir(dirname(destinationPath), { recursive: true });
	let handle;
	try {
		handle = await open(destinationPath, 'wx');
		await handle.writeFile(retainedBytes);
		await handle.sync();
		await handle.close();
		handle = undefined;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(destinationPath).catch(() => undefined);
		throw error;
	}

	return {
		operation,
		elapsedMs: Math.max(1, Math.round(performance.now() - started)),
		source: {
			path: sourcePath,
			width: sourceMetadata.width,
			height: sourceMetadata.height,
			mediaType: mediaTypeForFormat(sourceMetadata.format),
			bytes: sourceBytes.byteLength,
			contentHash: sha256(sourceBytes)
		},
		retained: {
			path: options.destinationPath,
			width: options.width,
			height: options.height,
			mediaType: options.mediaType,
			bytes: retainedBytes.byteLength,
			contentHash: sha256(retainedBytes)
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
	const report = await persistImageProductionOutput({
		workspaceRoot: option('--workspace-root'),
		sourcePath: option('--source'),
		destinationPath: option('--destination'),
		width: Number(option('--width')),
		height: Number(option('--height')),
		mediaType: option('--media-type') as 'image/png' | 'image/webp'
	});
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
