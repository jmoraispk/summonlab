import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import sharp from 'sharp';
import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const repositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !isAbsolute(value), 'must be repository-relative')
	.refine((value) => !value.split(/[\\/]/u).includes('..'), 'must not traverse outside repository');
const rectangleSchema = z
	.object({
		left: z.number().int().nonnegative(),
		top: z.number().int().nonnegative(),
		width: z.number().int().positive(),
		height: z.number().int().positive()
	})
	.strict();

export const decompositionBriefSchema = z
	.object({
		schemaVersion: z.literal('asha-spine-decomposition-brief-v1'),
		status: z.literal('planned'),
		acceptedCutout: repositoryPathSchema,
		acceptedCutoutSha256: sha256Schema,
		identitySource: repositoryPathSchema,
		identitySourceSha256: sha256Schema,
		sourceCanvas: z.object({ width: z.literal(768), height: z.literal(768) }).strict(),
		feetAnchor: z.object({ x: z.literal(384), y: z.literal(738) }).strict(),
		direction: z.literal('up-field'),
		mirrored: z.literal(false),
		defaultVisibleHeight: z.literal(84),
		attemptPolicy: z
			.object({ initial: z.literal(1), corrections: z.literal(1), maximumVersion: z.literal(2) })
			.strict(),
		providerBoard: z
			.object({
				layout: z.literal('quadrants-v1'),
				minimumSquareSize: z.literal(1024),
				panels: z.tuple([
					z.literal('body-core-repair'),
					z.literal('near-arm-matte'),
					z.literal('braid-matte'),
					z.literal('setup-preview')
				])
			})
			.strict(),
		protectedRegions: z
			.object({ faceAndMarking: rectangleSchema, feetAndAnchor: rectangleSchema })
			.strict(),
		partEnvelopes: z.object({ nearArm: rectangleSchema, braid: rectangleSchema }).strict(),
		initialPrompt: z.string().min(40),
		outputs: z.object({ root: repositoryPathSchema, reviewRoot: repositoryPathSchema }).strict()
	})
	.strict();

export type DecompositionMode = 'write' | 'check';
export type DecompositionVersion = 1 | 2;
export type DecompositionCliCommand = 'preflight' | 'check';
export type AshaSpineDecompositionBrief = z.infer<typeof decompositionBriefSchema>;
export type DecompositionPaths = Readonly<{
	providerBoard: string;
	bodyCore: string;
	nearArm: string;
	braid: string;
	recomposed: string;
	result: string;
}>;
export type DecompositionPreflightIO = Readonly<{
	lstat: typeof lstat;
	readFile: typeof readFile;
	metadata: (
		bytes: Buffer
	) => Promise<Readonly<{ width?: number; height?: number; channels?: number }>>;
}>;

async function secureRead(path: string): Promise<Buffer> {
	if (process.platform !== 'linux') return readFile(path);
	const handle: FileHandle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

export const defaultDecompositionPreflightIO: DecompositionPreflightIO = {
	lstat,
	readFile,
	metadata: async (bytes) => sharp(bytes, { failOn: 'error' }).metadata()
};

export function parseDecompositionCliArgs(args: readonly string[]): Readonly<{
	command: DecompositionCliCommand;
	version: DecompositionVersion;
}> {
	const normalized = args.filter((argument) => argument !== '--');
	const command = normalized.shift();
	if (command !== 'preflight' && command !== 'check') {
		throw new Error('command must be preflight or check');
	}
	let version: DecompositionVersion = 1;
	if (normalized.length > 0) {
		if (normalized.length !== 2 || normalized[0] !== '--version') {
			throw new Error('usage: preflight|check [--version 1|2]');
		}
		if (normalized[1] !== '1' && normalized[1] !== '2') {
			throw new Error('--version must be 1 or 2');
		}
		version = Number(normalized[1]) as DecompositionVersion;
	}
	return { command, version };
}

function containedPath(workspaceRoot: string, repositoryPath: string): string {
	const root = resolve(workspaceRoot);
	const path = resolve(root, repositoryPath);
	const offset = relative(root, path);
	if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
		throw new Error(`path escapes workspace: ${repositoryPath}`);
	}
	return path;
}

async function exists(path: string, io: DecompositionPreflightIO): Promise<boolean> {
	try {
		await io.lstat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function authorityBytes(
	label: string,
	path: string,
	expectedSha256: string,
	io: DecompositionPreflightIO
): Promise<Buffer> {
	const statistics = await io.lstat(path);
	if (statistics.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
	if (!statistics.isFile()) throw new Error(`${label} must be a regular file`);
	const bytes =
		io === defaultDecompositionPreflightIO ? await secureRead(path) : await io.readFile(path);
	if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) {
		throw new Error(`${label} hash mismatch`);
	}
	return bytes;
}

export async function loadDecompositionBrief(path: string): Promise<AshaSpineDecompositionBrief> {
	return decompositionBriefSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

export function resolveDecompositionPaths(
	brief: AshaSpineDecompositionBrief,
	workspaceRoot: string,
	version: DecompositionVersion
): DecompositionPaths {
	if (version !== 1 && version !== 2) throw new Error('decomposition version must be 1 or 2');
	const root = containedPath(workspaceRoot, brief.outputs.root);
	return {
		providerBoard: join(root, `provider/board-v${version}.png`),
		bodyCore: join(root, `parts/v${version}/body-core.png`),
		nearArm: join(root, `parts/v${version}/near-arm.png`),
		braid: join(root, `parts/v${version}/braid.png`),
		recomposed: join(root, `recomposed/asha-setup-v${version}.png`),
		result: join(root, `results/result-v${version}.json`)
	};
}

export async function preflightDecomposition(
	brief: AshaSpineDecompositionBrief,
	workspaceRoot: string,
	mode: DecompositionMode,
	version: DecompositionVersion,
	io: DecompositionPreflightIO = defaultDecompositionPreflightIO
): Promise<DecompositionPaths> {
	const identityPath = containedPath(workspaceRoot, brief.identitySource);
	const cutoutPath = containedPath(workspaceRoot, brief.acceptedCutout);
	await authorityBytes('identity source', identityPath, brief.identitySourceSha256, io);
	const cutout = await authorityBytes(
		'accepted cutout',
		cutoutPath,
		brief.acceptedCutoutSha256,
		io
	);
	const cutoutMetadata = await io.metadata(cutout);
	if (
		cutoutMetadata.width !== 768 ||
		cutoutMetadata.height !== 768 ||
		cutoutMetadata.channels !== 4
	) {
		throw new Error('accepted cutout must be 768x768 RGBA');
	}
	if (version === 2) {
		const v1ResultPath = resolveDecompositionPaths(brief, workspaceRoot, 1).result;
		if (!(await exists(v1ResultPath, io))) throw new Error('v2 requires a v1 revise receipt');
		const resultStatistics = await io.lstat(v1ResultPath);
		if (resultStatistics.isSymbolicLink() || !resultStatistics.isFile()) {
			throw new Error('v2 requires a v1 revise receipt');
		}
		let v1Result: unknown;
		try {
			v1Result = JSON.parse(await io.readFile(v1ResultPath, 'utf8'));
		} catch {
			throw new Error('v2 requires a v1 revise receipt');
		}
		if (
			v1Result === null ||
			typeof v1Result !== 'object' ||
			(v1Result as { version?: unknown }).version !== 1 ||
			(v1Result as { disposition?: unknown }).disposition !== 'revise'
		) {
			throw new Error('v2 requires a v1 revise receipt');
		}
	}

	const paths = resolveDecompositionPaths(brief, workspaceRoot, version);
	for (const path of Object.values(paths)) {
		const present = await exists(path, io);
		if (mode === 'write' && present) throw new Error(`owned output already exists: ${path}`);
		if (mode === 'check' && !present) throw new Error(`owned output is missing: ${path}`);
	}
	return paths;
}
