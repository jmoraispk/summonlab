import { constants as fsConstants, type PathLike } from 'node:fs';
import { createHash } from 'node:crypto';
import {
	lstat,
	open,
	readFile,
	type FileHandle
} from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import sharp from 'sharp';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const repositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !isAbsolute(value), 'must be repository-relative')
	.refine(
		(value) => !value.split(/[\\/]/u).includes('..'),
		'must not traverse outside the repository'
	);

const manifestSchema = z
	.object({
		schemaVersion: z.literal('asha-spine-transport-v1'),
		status: z.literal('candidate'),
		editorVersion: z.literal('4.3.26'),
		runtimeVersion: z.literal('4.3.13'),
		pixiVersion: z.literal('8.20.0'),
		direction: z.literal('up-field'),
		mirrored: z.literal(false),
		identitySource: repositoryPathSchema,
		identitySourceSha256: sha256Schema,
		acceptedCutout: repositoryPathSchema,
		acceptedCutoutSha256: sha256Schema,
		comparisonMotionSheet: repositoryPathSchema,
		comparisonMotionSheetSha256: sha256Schema,
		sourceCanvas: z
			.object({ width: z.literal(768), height: z.literal(768) })
			.strict(),
		transportCanvas: z
			.object({
				width: z.literal(1024),
				height: z.literal(1024),
				left: z.literal(128),
				top: z.literal(128)
			})
			.strict(),
		feetAnchor: z
			.object({
				sourceX: z.literal(384),
				sourceY: z.literal(738),
				normalizedX: z.literal(0.5),
				normalizedY: z.literal(0.845703125)
			})
			.strict(),
		animation: z
			.object({
				name: z.literal('idle_transport_probe'),
				durationSeconds: z.literal(1),
				loop: z.literal(true)
			})
			.strict(),
		outputs: z
			.object({
				image: repositoryPathSchema,
				importJson: repositoryPathSchema,
				project: repositoryPathSchema,
				runtimeDirectory: repositoryPathSchema
			})
			.strict()
	})
	.strict();

export type AshaSpineTransportManifest = z.infer<typeof manifestSchema>;
export type TransportMode = 'write' | 'check';
export type TransportPaths = Readonly<{
	image: string;
	importJson: string;
	project: string;
	runtimeDirectory: string;
}>;

export type TransportPreflightIO = Readonly<{
	exists: (path: string) => Promise<boolean>;
	lstat: typeof import('node:fs/promises').lstat;
	readFile: typeof import('node:fs/promises').readFile;
	metadata: (path: string) => Promise<
		Readonly<{
			width?: number;
			height?: number;
			channels?: number;
		}>
	>;
}>;

async function pathExists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function secureReadFile(
	path: PathLike | FileHandle,
	options?: Parameters<typeof readFile>[1]
): Promise<Awaited<ReturnType<typeof readFile>>> {
	if (typeof path !== 'string' || process.platform !== 'linux') {
		return (await readFile(path, options as never)) as Awaited<ReturnType<typeof readFile>>;
	}
	const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		return (await handle.readFile(options as never)) as Awaited<ReturnType<typeof readFile>>;
	} finally {
		await handle.close();
	}
}

export const defaultTransportPreflightIO: TransportPreflightIO = {
	exists: pathExists,
	lstat,
	readFile: secureReadFile as typeof readFile,
	metadata: async (path) => {
		const bytes = await secureReadFile(path);
		return sharp(bytes as Buffer, { failOn: 'error' }).metadata();
	}
};

export async function loadTransportManifest(
	path: string
): Promise<AshaSpineTransportManifest> {
	const raw = await readFile(path, 'utf8');
	return manifestSchema.parse(JSON.parse(raw));
}

function containedPath(workspaceRoot: string, repositoryPath: string): string {
	const absoluteRoot = resolve(workspaceRoot);
	const absolutePath = resolve(absoluteRoot, repositoryPath);
	const offset = relative(absoluteRoot, absolutePath);
	if (offset === '..' || offset.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
		throw new Error(`path escapes workspace: ${repositoryPath}`);
	}
	return absolutePath;
}

export function resolveTransportPaths(
	manifest: AshaSpineTransportManifest,
	workspaceRoot: string
): TransportPaths {
	return {
		image: containedPath(workspaceRoot, manifest.outputs.image),
		importJson: containedPath(workspaceRoot, manifest.outputs.importJson),
		project: containedPath(workspaceRoot, manifest.outputs.project),
		runtimeDirectory: containedPath(workspaceRoot, manifest.outputs.runtimeDirectory)
	};
}

async function validatedInputBytes(
	label: string,
	path: string,
	expectedHash: string,
	io: TransportPreflightIO
): Promise<Buffer> {
	const statistics = await io.lstat(path);
	if (statistics.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
	if (!statistics.isFile()) throw new Error(`${label} must be a regular file`);
	const bytes = (await io.readFile(path)) as Buffer;
	const actualHash = createHash('sha256').update(bytes).digest('hex');
	if (actualHash !== expectedHash) throw new Error(`${label} hash mismatch`);
	return bytes;
}

export async function preflightTransport(
	manifest: AshaSpineTransportManifest,
	workspaceRoot: string,
	mode: TransportMode,
	io: TransportPreflightIO = defaultTransportPreflightIO
): Promise<TransportPaths> {
	const identitySource = containedPath(workspaceRoot, manifest.identitySource);
	const acceptedCutout = containedPath(workspaceRoot, manifest.acceptedCutout);
	const comparisonMotionSheet = containedPath(workspaceRoot, manifest.comparisonMotionSheet);

	await validatedInputBytes(
		'canonical identity source',
		identitySource,
		manifest.identitySourceSha256,
		io
	);
	await validatedInputBytes(
		'accepted transport cutout',
		acceptedCutout,
		manifest.acceptedCutoutSha256,
		io
	);
	await validatedInputBytes(
		'comparison motion sheet',
		comparisonMotionSheet,
		manifest.comparisonMotionSheetSha256,
		io
	);

	const metadata = await io.metadata(acceptedCutout);
	if (
		metadata.width !== manifest.sourceCanvas.width ||
		metadata.height !== manifest.sourceCanvas.height ||
		metadata.channels !== 4
	) {
		throw new Error('accepted transport cutout must be 768x768 RGBA');
	}

	const paths = resolveTransportPaths(manifest, workspaceRoot);
	for (const ownedPath of Object.values(paths)) {
		const exists = await io.exists(ownedPath);
		if (mode === 'write' && exists) throw new Error(`owned output already exists: ${ownedPath}`);
		if (mode === 'check' && !exists) throw new Error(`owned output is missing: ${ownedPath}`);
	}
	return paths;
}
