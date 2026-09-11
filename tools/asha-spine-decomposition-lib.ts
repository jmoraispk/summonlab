import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import {
	lstat,
	mkdir,
	mkdtemp,
	open,
	readFile,
	rename,
	rm,
	writeFile,
	type FileHandle
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
export type DecompositionCliCommand = 'preflight' | 'materialize' | 'check';
export type ParsedDecompositionCli =
	| Readonly<{
			command: 'preflight' | 'check';
			version: DecompositionVersion;
	  }>
	| Readonly<{
			command: 'materialize';
			version: DecompositionVersion;
			providerOutputPath: string;
	  }>;
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

export function parseDecompositionCliArgs(args: readonly string[]): ParsedDecompositionCli {
	const normalized = args.filter((argument) => argument !== '--');
	const command = normalized.shift();
	if (command !== 'preflight' && command !== 'materialize' && command !== 'check') {
		throw new Error('command must be preflight, materialize, or check');
	}
	let version: DecompositionVersion = 1;
	let providerOutputPath: string | undefined;
	while (normalized.length > 0) {
		const option = normalized.shift();
		const value = normalized.shift();
		if (value === undefined) throw new Error(`missing value for ${option}`);
		if (option === '--version') {
			if (value !== '1' && value !== '2') throw new Error('--version must be 1 or 2');
			version = Number(value) as DecompositionVersion;
		} else if (option === '--provider-output') {
			providerOutputPath = value;
		} else {
			throw new Error(`unsupported option: ${option}`);
		}
	}
	if (command === 'materialize') {
		if (
			providerOutputPath === undefined ||
			!isAbsolute(providerOutputPath) ||
			resolve(providerOutputPath) !== providerOutputPath
		) {
			throw new Error('provider output path must be absolute and normalized');
		}
		return { command, version, providerOutputPath };
	}
	if (providerOutputPath !== undefined) {
		throw new Error('--provider-output is valid only for materialize');
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
	if (mode === 'write') {
		for (const path of Object.values(paths)) {
			if (await exists(path, io)) throw new Error(`owned output already exists: ${path}`);
		}
		return paths;
	}
	if (!(await exists(paths.result, io)))
		throw new Error(`owned output is missing: ${paths.result}`);
	const receiptStatistics = await io.lstat(paths.result);
	if (receiptStatistics.isSymbolicLink() || !receiptStatistics.isFile()) {
		throw new Error('decomposition result must be a regular non-symlink file');
	}
	const receipt = decompositionResultSchema.parse(
		JSON.parse(String(await io.readFile(paths.result, 'utf8')))
	);
	const required =
		receipt.disposition === 'failed' ? [paths.providerBoard, paths.result] : Object.values(paths);
	for (const path of required) {
		if (!(await exists(path, io))) throw new Error(`owned output is missing: ${path}`);
	}
	if (receipt.disposition === 'failed') {
		for (const path of [paths.bodyCore, paths.nearArm, paths.braid, paths.recomposed]) {
			if (await exists(path, io)) throw new Error(`failed result forbids part output: ${path}`);
		}
	}
	return paths;
}

const decompositionOutputSchema = z
	.object({
		path: repositoryPathSchema,
		sha256: sha256Schema,
		width: z.literal(768),
		height: z.literal(768)
	})
	.strict();

const decompositionResultBaseSchema = z
	.object({
		schemaVersion: z.literal('asha-spine-decomposition-result-v1'),
		version: z.union([z.literal(1), z.literal(2)]),
		prompt: z.string().min(40),
		promptSha256: sha256Schema,
		provider: z
			.object({
				mode: z.literal('edit'),
				returnedSourcePath: z.string().min(1),
				boardPath: repositoryPathSchema,
				boardSha256: sha256Schema
			})
			.strict()
	})
	.strict();

const successfulDecompositionResultSchema = decompositionResultBaseSchema.extend({
	disposition: z.enum(['candidate', 'revise']),
	outputs: z
		.object({
			bodyCore: decompositionOutputSchema,
			nearArm: decompositionOutputSchema,
			braid: decompositionOutputSchema,
			recomposed: decompositionOutputSchema
		})
		.strict(),
	reconstructedRegions: z.tuple([z.literal('near-arm overlap'), z.literal('braid/head overlap')]),
	measurements: z
		.object({
			visiblePartSourceMismatchPixels: z.literal(0),
			bodyOutsideMatteMismatchPixels: z.literal(0),
			recompositionOutsideRepairMismatchPixels: z.literal(0),
			nearArmMattePixels: z.number().int().positive(),
			braidMattePixels: z.number().int().positive()
		})
		.strict()
});

const failedDecompositionResultSchema = decompositionResultBaseSchema.extend({
	disposition: z.literal('failed'),
	failure: z
		.object({
			stage: z.enum(['provider-board', 'decomposition']),
			reason: z.string().min(1)
		})
		.strict(),
	outputs: z.null(),
	reconstructedRegions: z.tuple([]),
	measurements: z.null()
});

export const decompositionResultSchema = z.union([
	successfulDecompositionResultSchema,
	failedDecompositionResultSchema
]);

export type AshaSpineDecompositionResult = z.infer<typeof decompositionResultSchema>;
type DecompositionOutputReceipt = z.infer<typeof decompositionOutputSchema>;
export type NormalizedProviderBoard = Readonly<{ bytes: Buffer; size: number }>;
export type DecompositionPanels = Readonly<{
	bodyCoreRepair: Buffer;
	nearArmMatte: Buffer;
	braidMatte: Buffer;
	setupPreview: Buffer;
}>;

type MaterializedBuffers = Readonly<{
	bodyCore: Buffer;
	nearArm: Buffer;
	braid: Buffer;
	recomposed: Buffer;
	measurements: DecompositionMeasurements;
}>;

export type DecompositionMeasurements = Readonly<{
	visiblePartSourceMismatchPixels: number;
	bodyOutsideMatteMismatchPixels: number;
	recompositionOutsideRepairMismatchPixels: number;
	nearArmMattePixels: number;
	braidMattePixels: number;
}>;

function rawSha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function repositoryRelative(workspaceRoot: string, path: string): string {
	const offset = relative(resolve(workspaceRoot), resolve(path));
	if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
		throw new Error('output path escapes workspace');
	}
	return offset.split(sep).join('/');
}

function stableValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stableValue);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, stableValue(child)])
		);
	}
	return value;
}

function stableJson(value: unknown): string {
	return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export async function normalizeProviderBoard(
	bytes: Buffer,
	minimumSquareSize: number
): Promise<NormalizedProviderBoard> {
	const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
	if (
		metadata.width === undefined ||
		metadata.height === undefined ||
		metadata.width !== metadata.height ||
		metadata.width < minimumSquareSize ||
		metadata.width % 2 !== 0 ||
		metadata.channels !== 4
	) {
		throw new Error('provider board must be square RGBA');
	}
	return { bytes, size: metadata.width };
}

async function normalizedPanel(
	board: NormalizedProviderBoard,
	left: number,
	top: number
): Promise<Buffer> {
	const panelSize = board.size / 2;
	return sharp(board.bytes, { failOn: 'error' })
		.extract({ left, top, width: panelSize, height: panelSize })
		.resize(768, 768, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.ensureAlpha()
		.png()
		.toBuffer();
}

export async function extractDecompositionPanels(
	board: NormalizedProviderBoard
): Promise<DecompositionPanels> {
	const panelSize = board.size / 2;
	const [bodyCoreRepair, nearArmMatte, braidMatte, setupPreview] = await Promise.all([
		normalizedPanel(board, 0, 0),
		normalizedPanel(board, panelSize, 0),
		normalizedPanel(board, 0, panelSize),
		normalizedPanel(board, panelSize, panelSize)
	]);
	return { bodyCoreRepair, nearArmMatte, braidMatte, setupPreview };
}

async function binaryAlpha(panel: Buffer): Promise<Buffer> {
	const alpha = await sharp(panel, { failOn: 'error' }).extractChannel(3).raw().toBuffer();
	for (let index = 0; index < alpha.length; index += 1) {
		alpha[index] = alpha[index]! >= 128 ? 255 : 0;
	}
	return alpha;
}

function insideRectangle(
	x: number,
	y: number,
	rectangle: { left: number; top: number; width: number; height: number }
): boolean {
	return (
		x >= rectangle.left &&
		y >= rectangle.top &&
		x < rectangle.left + rectangle.width &&
		y < rectangle.top + rectangle.height
	);
}

function validateMatte(
	label: 'near-arm' | 'braid',
	mask: Buffer,
	envelope: { left: number; top: number; width: number; height: number },
	protectedRegions: AshaSpineDecompositionBrief['protectedRegions']
): number {
	let count = 0;
	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] === 0) continue;
		count += 1;
		const x = index % 768;
		const y = Math.floor(index / 768);
		if (!insideRectangle(x, y, envelope)) {
			throw new Error(`${label} matte escapes its part envelope`);
		}
		if (insideRectangle(x, y, protectedRegions.feetAndAnchor)) {
			throw new Error(`${label} matte intersects protected feetAndAnchor region`);
		}
		if (insideRectangle(x, y, protectedRegions.faceAndMarking)) {
			throw new Error(`${label} matte intersects protected faceAndMarking region`);
		}
	}
	if (count === 0) throw new Error(`${label} matte is empty`);
	return count;
}

function maskedSource(source: Buffer, mask: Buffer): Buffer {
	const output = Buffer.alloc(source.length);
	for (let pixel = 0; pixel < mask.length; pixel += 1) {
		if (mask[pixel] === 0) continue;
		const offset = pixel * 4;
		source.copy(output, offset, offset, offset + 4);
	}
	return output;
}

function countMismatch(left: Buffer, right: Buffer, include: (pixel: number) => boolean): number {
	let mismatches = 0;
	for (let pixel = 0; pixel < left.length / 4; pixel += 1) {
		if (!include(pixel)) continue;
		const offset = pixel * 4;
		if (
			left[offset] !== right[offset] ||
			left[offset + 1] !== right[offset + 1] ||
			left[offset + 2] !== right[offset + 2] ||
			left[offset + 3] !== right[offset + 3]
		) {
			mismatches += 1;
		}
	}
	return mismatches;
}

async function encodeRaw(pixels: Buffer): Promise<Buffer> {
	return sharp(pixels, { raw: { width: 768, height: 768, channels: 4 } })
		.png()
		.toBuffer();
}

export async function measureDecompositionCandidate(input: {
	brief: AshaSpineDecompositionBrief;
	source: Buffer;
	bodyCore: Buffer;
	nearArm: Buffer;
	braid: Buffer;
	recomposed: Buffer;
	nearArmMask: Buffer;
	braidMask: Buffer;
}): Promise<DecompositionMeasurements> {
	const recomposed = await sharp(input.recomposed, { failOn: 'error' })
		.ensureAlpha()
		.raw()
		.toBuffer();
	const union = (pixel: number) => input.nearArmMask[pixel] !== 0 || input.braidMask[pixel] !== 0;
	return {
		visiblePartSourceMismatchPixels:
			countMismatch(input.nearArm, input.source, (pixel) => input.nearArmMask[pixel] !== 0) +
			countMismatch(input.braid, input.source, (pixel) => input.braidMask[pixel] !== 0),
		bodyOutsideMatteMismatchPixels: countMismatch(
			input.bodyCore,
			input.source,
			(pixel) => !union(pixel)
		),
		recompositionOutsideRepairMismatchPixels: countMismatch(
			recomposed,
			input.source,
			(pixel) => !union(pixel)
		),
		nearArmMattePixels: input.nearArmMask.reduce(
			(total, value) => total + (value === 0 ? 0 : 1),
			0
		),
		braidMattePixels: input.braidMask.reduce((total, value) => total + (value === 0 ? 0 : 1), 0)
	};
}

async function buildMaterializedBuffers(
	brief: AshaSpineDecompositionBrief,
	cutoutBytes: Buffer,
	providerBytes: Buffer
): Promise<MaterializedBuffers> {
	const board = await normalizeProviderBoard(providerBytes, brief.providerBoard.minimumSquareSize);
	const panels = await extractDecompositionPanels(board);
	const [nearArmMask, braidMask, source, repair] = await Promise.all([
		binaryAlpha(panels.nearArmMatte),
		binaryAlpha(panels.braidMatte),
		sharp(cutoutBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer(),
		sharp(panels.bodyCoreRepair, { failOn: 'error' }).ensureAlpha().raw().toBuffer()
	]);
	validateMatte('near-arm', nearArmMask, brief.partEnvelopes.nearArm, brief.protectedRegions);
	validateMatte('braid', braidMask, brief.partEnvelopes.braid, brief.protectedRegions);
	let matteOverlap = 0;
	for (let pixel = 0; pixel < nearArmMask.length; pixel += 1) {
		if (nearArmMask[pixel] !== 0 && braidMask[pixel] !== 0) matteOverlap += 1;
	}
	if (matteOverlap > 64) throw new Error('decomposition mattes overlap by more than 64 pixels');

	const nearArmRaw = maskedSource(source, nearArmMask);
	const braidRaw = maskedSource(source, braidMask);
	const bodyCoreRaw = Buffer.from(source);
	for (let pixel = 0; pixel < nearArmMask.length; pixel += 1) {
		if (nearArmMask[pixel] === 0 && braidMask[pixel] === 0) continue;
		const offset = pixel * 4;
		repair.copy(bodyCoreRaw, offset, offset, offset + 4);
	}
	const [bodyCore, nearArm, braid] = await Promise.all([
		encodeRaw(bodyCoreRaw),
		encodeRaw(nearArmRaw),
		encodeRaw(braidRaw)
	]);
	const recomposed = await sharp(bodyCore, { failOn: 'error' })
		.composite([
			{ input: braid, blend: 'over' },
			{ input: nearArm, blend: 'over' }
		])
		.png()
		.toBuffer();
	const measurements = await measureDecompositionCandidate({
		brief,
		source,
		bodyCore: bodyCoreRaw,
		nearArm: nearArmRaw,
		braid: braidRaw,
		recomposed,
		nearArmMask,
		braidMask
	});
	if (
		measurements.visiblePartSourceMismatchPixels !== 0 ||
		measurements.bodyOutsideMatteMismatchPixels !== 0 ||
		measurements.recompositionOutsideRepairMismatchPixels !== 0
	) {
		throw new Error('materialized decomposition changed protected source pixels');
	}
	return { bodyCore, nearArm, braid, recomposed, measurements };
}

function outputReceipt(
	workspaceRoot: string,
	path: string,
	bytes: Buffer
): DecompositionOutputReceipt {
	return {
		path: repositoryRelative(workspaceRoot, path),
		sha256: rawSha256(bytes),
		width: 768,
		height: 768
	};
}

async function persistFailedCandidate(input: {
	brief: AshaSpineDecompositionBrief;
	workspaceRoot: string;
	version: DecompositionVersion;
	providerOutputPath: string;
	providerBytes: Buffer;
	paths: DecompositionPaths;
	error: unknown;
}): Promise<AshaSpineDecompositionResult> {
	const reason = input.error instanceof Error ? input.error.message : String(input.error);
	const result = failedDecompositionResultSchema.parse({
		schemaVersion: 'asha-spine-decomposition-result-v1',
		version: input.version,
		disposition: 'failed',
		failure: {
			stage: reason.startsWith('provider board') ? 'provider-board' : 'decomposition',
			reason
		},
		prompt: input.brief.initialPrompt,
		promptSha256: rawSha256(Buffer.from(input.brief.initialPrompt, 'utf8')),
		provider: {
			mode: 'edit',
			returnedSourcePath: `$PROVIDER_OUTPUT_ROOT/${basename(input.providerOutputPath)}`,
			boardPath: repositoryRelative(input.workspaceRoot, input.paths.providerBoard),
			boardSha256: rawSha256(input.providerBytes)
		},
		outputs: null,
		reconstructedRegions: [],
		measurements: null
	});
	const root = containedPath(input.workspaceRoot, input.brief.outputs.root);
	await mkdir(root, { recursive: true });
	const staging = await mkdtemp(join(root, '.failed-'));
	const artifacts = [
		{
			source: join(staging, 'provider.png'),
			destination: input.paths.providerBoard,
			bytes: input.providerBytes
		},
		{
			source: join(staging, 'result.json'),
			destination: input.paths.result,
			bytes: Buffer.from(stableJson(result), 'utf8')
		}
	];
	const finalized: string[] = [];
	try {
		await Promise.all(
			artifacts.map(({ source, bytes }) => writeFile(source, bytes, { flag: 'wx' }))
		);
		for (const artifact of artifacts) {
			await mkdir(dirname(artifact.destination), { recursive: true });
			await rename(artifact.source, artifact.destination);
			finalized.push(artifact.destination);
		}
		return await validateDecompositionCandidate(input.brief, input.workspaceRoot, input.version);
	} catch (error) {
		await Promise.all(finalized.map((path) => rm(path, { force: true })));
		throw error;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

export async function materializeDecompositionCandidate(input: {
	brief: AshaSpineDecompositionBrief;
	workspaceRoot: string;
	version: DecompositionVersion;
	providerOutputPath: string;
}): Promise<AshaSpineDecompositionResult> {
	if (
		!isAbsolute(input.providerOutputPath) ||
		resolve(input.providerOutputPath) !== input.providerOutputPath
	) {
		throw new Error('provider output path must be absolute and normalized');
	}
	const paths = await preflightDecomposition(
		input.brief,
		input.workspaceRoot,
		'write',
		input.version
	);
	const providerStatistics = await lstat(input.providerOutputPath);
	if (providerStatistics.isSymbolicLink())
		throw new Error('provider output must not be a symbolic link');
	if (!providerStatistics.isFile()) throw new Error('provider output must be a regular file');
	const providerBytes = await secureRead(input.providerOutputPath);
	const cutoutBytes = await secureRead(
		containedPath(input.workspaceRoot, input.brief.acceptedCutout)
	);
	let buffers: MaterializedBuffers;
	try {
		buffers = await buildMaterializedBuffers(input.brief, cutoutBytes, providerBytes);
	} catch (error) {
		return persistFailedCandidate({ ...input, paths, providerBytes, error });
	}
	const result = successfulDecompositionResultSchema.parse({
		schemaVersion: 'asha-spine-decomposition-result-v1',
		version: input.version,
		disposition: 'candidate',
		prompt: input.brief.initialPrompt,
		promptSha256: rawSha256(Buffer.from(input.brief.initialPrompt, 'utf8')),
		provider: {
			mode: 'edit',
			returnedSourcePath: `$PROVIDER_OUTPUT_ROOT/${basename(input.providerOutputPath)}`,
			boardPath: repositoryRelative(input.workspaceRoot, paths.providerBoard),
			boardSha256: rawSha256(providerBytes)
		},
		outputs: {
			bodyCore: outputReceipt(input.workspaceRoot, paths.bodyCore, buffers.bodyCore),
			nearArm: outputReceipt(input.workspaceRoot, paths.nearArm, buffers.nearArm),
			braid: outputReceipt(input.workspaceRoot, paths.braid, buffers.braid),
			recomposed: outputReceipt(input.workspaceRoot, paths.recomposed, buffers.recomposed)
		},
		reconstructedRegions: ['near-arm overlap', 'braid/head overlap'],
		measurements: {
			visiblePartSourceMismatchPixels: 0,
			bodyOutsideMatteMismatchPixels: 0,
			recompositionOutsideRepairMismatchPixels: 0,
			nearArmMattePixels: buffers.measurements.nearArmMattePixels,
			braidMattePixels: buffers.measurements.braidMattePixels
		}
	});

	const root = containedPath(input.workspaceRoot, input.brief.outputs.root);
	await mkdir(root, { recursive: true });
	const staging = await mkdtemp(join(root, '.materialize-'));
	const staged = [
		{
			source: join(staging, 'provider.png'),
			destination: paths.providerBoard,
			bytes: providerBytes
		},
		{
			source: join(staging, 'body-core.png'),
			destination: paths.bodyCore,
			bytes: buffers.bodyCore
		},
		{ source: join(staging, 'near-arm.png'), destination: paths.nearArm, bytes: buffers.nearArm },
		{ source: join(staging, 'braid.png'), destination: paths.braid, bytes: buffers.braid },
		{
			source: join(staging, 'recomposed.png'),
			destination: paths.recomposed,
			bytes: buffers.recomposed
		},
		{
			source: join(staging, 'result.json'),
			destination: paths.result,
			bytes: Buffer.from(stableJson(result), 'utf8')
		}
	];
	const finalized: string[] = [];
	try {
		await Promise.all(staged.map(({ source, bytes }) => writeFile(source, bytes, { flag: 'wx' })));
		for (const artifact of staged) {
			await mkdir(dirname(artifact.destination), { recursive: true });
			await rename(artifact.source, artifact.destination);
			finalized.push(artifact.destination);
		}
		return await validateDecompositionCandidate(input.brief, input.workspaceRoot, input.version);
	} catch (error) {
		await Promise.all(finalized.map((path) => rm(path, { force: true })));
		throw error;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

export async function validateDecompositionCandidate(
	brief: AshaSpineDecompositionBrief,
	workspaceRoot: string,
	version: DecompositionVersion
): Promise<AshaSpineDecompositionResult> {
	const paths = await preflightDecomposition(brief, workspaceRoot, 'check', version);
	const result = decompositionResultSchema.parse(JSON.parse(await readFile(paths.result, 'utf8')));
	if (result.version !== version) throw new Error('result version mismatch');
	if (result.prompt !== brief.initialPrompt) throw new Error('result prompt mismatch');
	if (result.promptSha256 !== rawSha256(Buffer.from(brief.initialPrompt, 'utf8'))) {
		throw new Error('result prompt hash mismatch');
	}
	if (result.provider.boardPath !== repositoryRelative(workspaceRoot, paths.providerBoard)) {
		throw new Error('provider board path mismatch');
	}
	if (result.provider.boardSha256 !== rawSha256(await secureRead(paths.providerBoard))) {
		throw new Error('provider board hash mismatch');
	}
	if (result.disposition === 'failed') return result;
	const expectedOutputs = {
		bodyCore: paths.bodyCore,
		nearArm: paths.nearArm,
		braid: paths.braid,
		recomposed: paths.recomposed
	} as const;
	for (const [name, path] of Object.entries(expectedOutputs) as Array<
		[keyof typeof expectedOutputs, string]
	>) {
		const receipt = result.outputs[name];
		if (receipt.path !== repositoryRelative(workspaceRoot, path))
			throw new Error(`${name} path mismatch`);
		const bytes = await secureRead(path);
		if (receipt.sha256 !== rawSha256(bytes)) throw new Error(`${name} hash mismatch`);
		const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
		if (metadata.width !== 768 || metadata.height !== 768 || metadata.channels !== 4) {
			throw new Error(`${name} must be 768x768 RGBA`);
		}
	}
	return result;
}
