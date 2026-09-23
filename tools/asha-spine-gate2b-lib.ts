import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
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
const pointSchema = z.tuple([z.number().int().min(0).max(767), z.number().int().min(0).max(767)]);
const polygonSchema = z.array(pointSchema).min(3);
const maskSchema = z.object({ polygons: z.array(polygonSchema).min(1) }).strict();
const rectangleSchema = z
	.object({
		left: z.number().int().nonnegative(),
		top: z.number().int().nonnegative(),
		width: z.number().int().positive(),
		height: z.number().int().positive()
	})
	.strict();

export const gate2bContractSchema = z
	.object({
		schemaVersion: z.literal('asha-spine-gate2b-v1'),
		status: z.literal('owner-approved'),
		version: z.literal(2),
		approval: z
			.object({
				date: z.literal('2026-09-22'),
				statement: z.literal(
					'Approve Gate 2B: deterministic source masks plus one chroma-key body-reconstruction attempt.'
				)
			})
			.strict(),
		originalBrief: repositoryPathSchema,
		acceptedCutout: repositoryPathSchema,
		acceptedCutoutSha256: sha256Schema,
		v1Failure: z
			.object({
				result: repositoryPathSchema,
				resultSha256: sha256Schema,
				board: repositoryPathSchema,
				boardSha256: sha256Schema
			})
			.strict(),
		sourceCanvas: z.object({ width: z.literal(768), height: z.literal(768) }).strict(),
		feetAnchor: z.object({ x: z.literal(384), y: z.literal(738) }).strict(),
		protectedFeet: rectangleSchema,
		chromaKey: z.literal('#00ff00'),
		masks: z.object({ nearArm: maskSchema, braid: maskSchema }).strict(),
		repairPrompt: z.string().min(40),
		outputs: z.object({ root: repositoryPathSchema }).strict()
	})
	.strict();

const artifactSchema = z
	.object({
		path: repositoryPathSchema,
		sha256: sha256Schema,
		width: z.number().int().positive(),
		height: z.number().int().positive()
	})
	.strict();
const sourceArtifactSchema = artifactSchema
	.extend({ pixels: z.number().int().positive() })
	.strict();
const providerSchema = z
	.object({
		mode: z.literal('edit-chroma'),
		returnedSourcePath: z.string().startsWith('$PROVIDER_OUTPUT_ROOT/'),
		chromaKey: z.literal('#00ff00'),
		raw: artifactSchema,
		keyed: artifactSchema
	})
	.strict();
const measurementsSchema = z
	.object({
		visiblePartSourceMismatchPixels: z.literal(0),
		bodyOutsideMaskMismatchPixels: z.literal(0),
		recompositionOutsideRepairMismatchPixels: z.literal(0),
		nearArmMaskPixels: z.number().int().positive(),
		braidMaskPixels: z.number().int().positive()
	})
	.strict();
const resultBase = {
	schemaVersion: z.literal('asha-spine-gate2b-result-v1'),
	version: z.literal(2),
	approval: gate2bContractSchema.shape.approval,
	prompt: z.string().min(40),
	promptSha256: sha256Schema,
	sourceSha256: sha256Schema,
	v1FailureResultSha256: sha256Schema,
	provider: providerSchema
};
const candidateResultSchema = z
	.object({
		...resultBase,
		disposition: z.literal('candidate'),
		failure: z.null(),
		masks: z.object({ nearArm: sourceArtifactSchema, braid: sourceArtifactSchema }).strict(),
		outputs: z
			.object({
				bodyCore: artifactSchema,
				nearArm: artifactSchema,
				braid: artifactSchema,
				recomposed: artifactSchema
			})
			.strict(),
		measurements: measurementsSchema,
		reconstructedRegions: z.tuple([z.literal('near-arm overlap'), z.literal('braid/head overlap')])
	})
	.strict();
const failedResultSchema = z
	.object({
		...resultBase,
		disposition: z.literal('failed'),
		failure: z.object({ stage: z.literal('gate-2b'), reason: z.string().min(1) }).strict(),
		masks: z.null(),
		outputs: z.null(),
		measurements: z.null(),
		reconstructedRegions: z.tuple([])
	})
	.strict();
const resultSchema = z.discriminatedUnion('disposition', [
	candidateResultSchema,
	failedResultSchema
]);

export type AshaSpineGate2BContract = z.infer<typeof gate2bContractSchema>;
export type AshaSpineGate2BResult = z.infer<typeof resultSchema>;
export type Gate2BMode = 'write' | 'check';
export type Gate2BPaths = Readonly<{
	rawProvider: string;
	keyedProvider: string;
	nearArmMask: string;
	braidMask: string;
	bodyCore: string;
	nearArm: string;
	braid: string;
	recomposed: string;
	result: string;
}>;
export type ParsedGate2BCli =
	| Readonly<{ command: 'preflight' | 'check' }>
	| Readonly<{
			command: 'materialize';
			providerOutputPath: string;
			keyedOutputPath: string;
	  }>;
export type SourceMasks = Readonly<{
	nearArmRaw: Buffer;
	braidRaw: Buffer;
	nearArmPng: Buffer;
	braidPng: Buffer;
}>;

function rawSha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
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

function containedPath(workspaceRoot: string, repositoryPath: string): string {
	const root = resolve(workspaceRoot);
	const path = resolve(root, repositoryPath);
	const offset = relative(root, path);
	if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
		throw new Error(`path escapes workspace: ${repositoryPath}`);
	}
	return path;
}

async function secureRead(path: string): Promise<Buffer> {
	if (process.platform !== 'linux') return readFile(path);
	const handle: FileHandle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function checkedAuthority(
	label: string,
	path: string,
	expectedHash: string
): Promise<Buffer> {
	const stats = await lstat(path);
	if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
	if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
	const bytes = await secureRead(path);
	if (rawSha256(bytes) !== expectedHash) throw new Error(`${label} hash mismatch`);
	return bytes;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

export async function loadGate2BContract(path: string): Promise<AshaSpineGate2BContract> {
	return gate2bContractSchema.parse(JSON.parse((await secureRead(path)).toString('utf8')));
}

export function resolveGate2BPaths(
	contract: AshaSpineGate2BContract,
	workspaceRoot: string
): Gate2BPaths {
	const root = containedPath(workspaceRoot, contract.outputs.root);
	return {
		rawProvider: join(root, 'provider/body-repair-v2.png'),
		keyedProvider: join(root, 'provider/body-repair-v2-rgba.png'),
		nearArmMask: join(root, 'masks/v2/near-arm.png'),
		braidMask: join(root, 'masks/v2/braid.png'),
		bodyCore: join(root, 'parts/v2/body-core.png'),
		nearArm: join(root, 'parts/v2/near-arm.png'),
		braid: join(root, 'parts/v2/braid.png'),
		recomposed: join(root, 'recomposed/asha-setup-v2.png'),
		result: join(root, 'results/result-v2.json')
	};
}

function allPaths(paths: Gate2BPaths): string[] {
	return Object.values(paths);
}

async function verifyAuthority(
	contract: AshaSpineGate2BContract,
	workspaceRoot: string
): Promise<Buffer> {
	const originalBrief = containedPath(workspaceRoot, contract.originalBrief);
	const briefStats = await lstat(originalBrief);
	if (briefStats.isSymbolicLink() || !briefStats.isFile()) {
		throw new Error('original brief must be a regular non-symbolic file');
	}
	const cutout = await checkedAuthority(
		'accepted cutout',
		containedPath(workspaceRoot, contract.acceptedCutout),
		contract.acceptedCutoutSha256
	);
	const metadata = await sharp(cutout, { failOn: 'error' }).metadata();
	if (metadata.width !== 768 || metadata.height !== 768 || metadata.channels !== 4) {
		throw new Error('accepted cutout must be 768x768 RGBA');
	}
	const v1Result = await checkedAuthority(
		'v1 failure result',
		containedPath(workspaceRoot, contract.v1Failure.result),
		contract.v1Failure.resultSha256
	);
	const parsedV1 = JSON.parse(v1Result.toString('utf8')) as { disposition?: unknown };
	if (parsedV1.disposition !== 'failed') throw new Error('v1 evidence must remain failed');
	await checkedAuthority(
		'v1 failure board',
		containedPath(workspaceRoot, contract.v1Failure.board),
		contract.v1Failure.boardSha256
	);
	return cutout;
}

export async function preflightGate2B(
	contractInput: AshaSpineGate2BContract,
	workspaceRoot: string,
	mode: Gate2BMode
): Promise<Gate2BPaths> {
	const contract = gate2bContractSchema.parse(contractInput);
	const cutout = await verifyAuthority(contract, workspaceRoot);
	await rasterizeSourceMasks(contract, cutout);
	const paths = resolveGate2BPaths(contract, workspaceRoot);
	if (mode === 'check') {
		await validateGate2BCandidate(contract, workspaceRoot);
		return paths;
	}
	for (const path of allPaths(paths)) {
		if (await pathExists(path)) throw new Error(`owned Gate 2B output already exists: ${path}`);
	}
	return paths;
}

export function parseGate2BCliArgs(args: readonly string[]): ParsedGate2BCli {
	const normalized = args.filter((argument) => argument !== '--');
	const command = normalized.shift();
	if (command !== 'preflight' && command !== 'materialize' && command !== 'check') {
		throw new Error('command must be preflight, materialize, or check');
	}
	let providerOutputPath: string | undefined;
	let keyedOutputPath: string | undefined;
	while (normalized.length > 0) {
		const option = normalized.shift();
		const value = normalized.shift();
		if (value === undefined) throw new Error(`missing value for ${option}`);
		if (option === '--provider-output') providerOutputPath = value;
		else if (option === '--keyed-output') keyedOutputPath = value;
		else throw new Error(`unsupported option: ${option}`);
	}
	if (command === 'materialize') {
		if (
			providerOutputPath === undefined ||
			keyedOutputPath === undefined ||
			!isAbsolute(providerOutputPath) ||
			!isAbsolute(keyedOutputPath) ||
			resolve(providerOutputPath) !== providerOutputPath ||
			resolve(keyedOutputPath) !== keyedOutputPath
		) {
			throw new Error('provider and keyed output paths must be absolute and normalized');
		}
		return { command, providerOutputPath, keyedOutputPath };
	}
	if (providerOutputPath !== undefined || keyedOutputPath !== undefined) {
		throw new Error('provider paths are valid only for materialize');
	}
	return { command };
}

function pointInsidePolygon(
	x: number,
	y: number,
	polygon: readonly (readonly [number, number])[]
): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [currentX, currentY] = polygon[index]!;
		const [previousX, previousY] = polygon[previous]!;
		if (
			currentY > y !== previousY > y &&
			x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
		) {
			inside = !inside;
		}
	}
	return inside;
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

async function maskPng(mask: Buffer): Promise<Buffer> {
	const rgba = Buffer.alloc(768 * 768 * 4);
	for (let pixel = 0; pixel < mask.length; pixel += 1) {
		if (mask[pixel] === 0) continue;
		const offset = pixel * 4;
		rgba[offset] = 255;
		rgba[offset + 1] = 255;
		rgba[offset + 2] = 255;
		rgba[offset + 3] = 255;
	}
	return sharp(rgba, { raw: { width: 768, height: 768, channels: 4 } })
		.png()
		.toBuffer();
}

export async function rasterizeSourceMasks(
	contractInput: AshaSpineGate2BContract,
	cutoutBytes: Buffer
): Promise<SourceMasks> {
	const contract = gate2bContractSchema.parse(contractInput);
	const source = await sharp(cutoutBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer();
	if (source.length !== 768 * 768 * 4)
		throw new Error('accepted cutout must decode to 768x768 RGBA');
	const makeMask = (polygons: readonly (readonly (readonly [number, number])[])[]): Buffer => {
		const mask = Buffer.alloc(768 * 768);
		for (let y = 0; y < 768; y += 1) {
			for (let x = 0; x < 768; x += 1) {
				if (!polygons.some((polygon) => pointInsidePolygon(x + 0.5, y + 0.5, polygon))) {
					continue;
				}
				const pixel = y * 768 + x;
				if (source[pixel * 4 + 3] !== 0) mask[pixel] = 255;
			}
		}
		return mask;
	};
	const nearArmRaw = makeMask(contract.masks.nearArm.polygons);
	const braidRaw = makeMask(contract.masks.braid.polygons);
	let nearArmPixels = 0;
	let braidPixels = 0;
	for (let pixel = 0; pixel < nearArmRaw.length; pixel += 1) {
		const x = pixel % 768;
		const y = Math.floor(pixel / 768);
		if (nearArmRaw[pixel] !== 0) {
			nearArmPixels += 1;
			if (insideRectangle(x, y, contract.protectedFeet)) {
				throw new Error('near-arm mask intersects protected feet');
			}
		}
		if (braidRaw[pixel] !== 0) {
			braidPixels += 1;
			if (insideRectangle(x, y, contract.protectedFeet)) {
				throw new Error('braid mask intersects protected feet');
			}
		}
		if (nearArmRaw[pixel] !== 0 && braidRaw[pixel] !== 0) {
			throw new Error('deterministic masks overlap');
		}
	}
	if (nearArmPixels === 0) throw new Error('near-arm deterministic mask is empty');
	if (braidPixels === 0) throw new Error('braid deterministic mask is empty');
	const [nearArmPng, braidPng] = await Promise.all([maskPng(nearArmRaw), maskPng(braidRaw)]);
	return { nearArmRaw, braidRaw, nearArmPng, braidPng };
}

async function providerRepair(
	rawBytes: Buffer,
	keyedBytes: Buffer
): Promise<{
	repair: Buffer;
	rawMetadata: { width: number; height: number };
	keyedMetadata: { width: number; height: number };
}> {
	const [rawMetadata, keyedMetadata] = await Promise.all([
		sharp(rawBytes, { failOn: 'error' }).metadata(),
		sharp(keyedBytes, { failOn: 'error' }).metadata()
	]);
	if (
		rawMetadata.width === undefined ||
		rawMetadata.height === undefined ||
		rawMetadata.width !== rawMetadata.height ||
		rawMetadata.width < 1024 ||
		(rawMetadata.channels !== 3 && rawMetadata.channels !== 4)
	) {
		throw new Error('raw provider repair must be square RGB or RGBA at least 1024px');
	}
	if (
		keyedMetadata.width !== rawMetadata.width ||
		keyedMetadata.height !== rawMetadata.height ||
		keyedMetadata.channels !== 4
	) {
		throw new Error('keyed provider repair must match raw dimensions as RGBA');
	}
	const decoded = await sharp(keyedBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer();
	const width = keyedMetadata.width!;
	const height = keyedMetadata.height!;
	const corners = [0, width - 1, (height - 1) * width, height * width - 1];
	if (corners.some((pixel) => decoded[pixel * 4 + 3]! > 16)) {
		throw new Error('keyed provider repair must have transparent corners');
	}
	let opaquePixels = 0;
	for (let pixel = 0; pixel < decoded.length / 4; pixel += 1) {
		if (decoded[pixel * 4 + 3]! >= 128) opaquePixels += 1;
	}
	if (opaquePixels === 0) throw new Error('keyed provider repair has no opaque subject pixels');
	const repair = await sharp(keyedBytes, { failOn: 'error' })
		.resize(768, 768, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.ensureAlpha()
		.raw()
		.toBuffer();
	return {
		repair,
		rawMetadata: { width: rawMetadata.width, height: rawMetadata.height },
		keyedMetadata: { width: keyedMetadata.width!, height: keyedMetadata.height! }
	};
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

function mismatchCount(left: Buffer, right: Buffer, include: (pixel: number) => boolean): number {
	let mismatches = 0;
	for (let pixel = 0; pixel < left.length / 4; pixel += 1) {
		if (!include(pixel)) continue;
		const offset = pixel * 4;
		if (!left.subarray(offset, offset + 4).equals(right.subarray(offset, offset + 4))) {
			mismatches += 1;
		}
	}
	return mismatches;
}

async function rgbaPng(pixels: Buffer): Promise<Buffer> {
	return sharp(pixels, { raw: { width: 768, height: 768, channels: 4 } })
		.png()
		.toBuffer();
}

function artifact(
	workspaceRoot: string,
	path: string,
	bytes: Buffer,
	width: number,
	height: number
): z.infer<typeof artifactSchema> {
	return {
		path: relative(workspaceRoot, path).split(sep).join('/'),
		sha256: rawSha256(bytes),
		width,
		height
	};
}

function countMask(mask: Buffer): number {
	let count = 0;
	for (const value of mask) if (value !== 0) count += 1;
	return count;
}

async function buildCandidate(
	contract: AshaSpineGate2BContract,
	cutoutBytes: Buffer,
	rawBytes: Buffer,
	keyedBytes: Buffer
): Promise<{
	masks: SourceMasks;
	bodyCore: Buffer;
	nearArm: Buffer;
	braid: Buffer;
	recomposed: Buffer;
	measurements: z.infer<typeof measurementsSchema>;
	rawSize: { width: number; height: number };
	keyedSize: { width: number; height: number };
}> {
	const masks = await rasterizeSourceMasks(contract, cutoutBytes);
	const normalized = await providerRepair(rawBytes, keyedBytes);
	const source = await sharp(cutoutBytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer();
	const nearArmRaw = maskedSource(source, masks.nearArmRaw);
	const braidRaw = maskedSource(source, masks.braidRaw);
	const bodyRaw = Buffer.from(source);
	const union = (pixel: number) => masks.nearArmRaw[pixel] !== 0 || masks.braidRaw[pixel] !== 0;
	for (let pixel = 0; pixel < masks.nearArmRaw.length; pixel += 1) {
		if (!union(pixel)) continue;
		const offset = pixel * 4;
		normalized.repair.copy(bodyRaw, offset, offset, offset + 4);
	}
	const [bodyCore, nearArm, braid] = await Promise.all([
		rgbaPng(bodyRaw),
		rgbaPng(nearArmRaw),
		rgbaPng(braidRaw)
	]);
	const recomposed = await sharp(bodyCore, { failOn: 'error' })
		.composite([
			{ input: braid, blend: 'over' },
			{ input: nearArm, blend: 'over' }
		])
		.png()
		.toBuffer();
	const recomposedRaw = await sharp(recomposed, { failOn: 'error' }).ensureAlpha().raw().toBuffer();
	const measurements = measurementsSchema.parse({
		visiblePartSourceMismatchPixels:
			mismatchCount(nearArmRaw, source, (pixel) => masks.nearArmRaw[pixel] !== 0) +
			mismatchCount(braidRaw, source, (pixel) => masks.braidRaw[pixel] !== 0),
		bodyOutsideMaskMismatchPixels: mismatchCount(bodyRaw, source, (pixel) => !union(pixel)),
		recompositionOutsideRepairMismatchPixels: mismatchCount(
			recomposedRaw,
			source,
			(pixel) => !union(pixel)
		),
		nearArmMaskPixels: countMask(masks.nearArmRaw),
		braidMaskPixels: countMask(masks.braidRaw)
	});
	return {
		masks,
		bodyCore,
		nearArm,
		braid,
		recomposed,
		measurements,
		rawSize: normalized.rawMetadata,
		keyedSize: normalized.keyedMetadata
	};
}

function resultBaseFields(
	contract: AshaSpineGate2BContract,
	workspaceRoot: string,
	paths: Gate2BPaths,
	providerOutputPath: string,
	rawBytes: Buffer,
	keyedBytes: Buffer,
	rawSize: { width: number; height: number },
	keyedSize: { width: number; height: number }
) {
	return {
		schemaVersion: 'asha-spine-gate2b-result-v1' as const,
		version: 2 as const,
		approval: contract.approval,
		prompt: contract.repairPrompt,
		promptSha256: rawSha256(Buffer.from(contract.repairPrompt, 'utf8')),
		sourceSha256: contract.acceptedCutoutSha256,
		v1FailureResultSha256: contract.v1Failure.resultSha256,
		provider: {
			mode: 'edit-chroma' as const,
			returnedSourcePath: `$PROVIDER_OUTPUT_ROOT/${basename(providerOutputPath)}`,
			chromaKey: contract.chromaKey,
			raw: artifact(workspaceRoot, paths.rawProvider, rawBytes, rawSize.width, rawSize.height),
			keyed: artifact(
				workspaceRoot,
				paths.keyedProvider,
				keyedBytes,
				keyedSize.width,
				keyedSize.height
			)
		}
	};
}

async function persistArtifacts(
	root: string,
	artifacts: readonly { destination: string; bytes: Buffer }[]
): Promise<void> {
	await mkdir(root, { recursive: true });
	const staging = await mkdtemp(join(root, '.gate2b-'));
	const staged = artifacts.map((item, index) => ({
		...item,
		staged: join(staging, `${index}.artifact`)
	}));
	const finalized: string[] = [];
	try {
		await Promise.all(staged.map((item) => writeFile(item.staged, item.bytes, { flag: 'wx' })));
		for (const item of staged) {
			await mkdir(dirname(item.destination), { recursive: true });
			await rename(item.staged, item.destination);
			finalized.push(item.destination);
		}
	} catch (error) {
		await Promise.all(finalized.map((path) => rm(path, { force: true })));
		throw error;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

export async function materializeGate2BCandidate(input: {
	contract: AshaSpineGate2BContract;
	workspaceRoot: string;
	providerOutputPath: string;
	keyedOutputPath: string;
}): Promise<AshaSpineGate2BResult> {
	if (
		!isAbsolute(input.providerOutputPath) ||
		!isAbsolute(input.keyedOutputPath) ||
		resolve(input.providerOutputPath) !== input.providerOutputPath ||
		resolve(input.keyedOutputPath) !== input.keyedOutputPath
	) {
		throw new Error('provider and keyed output paths must be absolute and normalized');
	}
	const contract = gate2bContractSchema.parse(input.contract);
	const paths = await preflightGate2B(contract, input.workspaceRoot, 'write');
	const [cutoutBytes, rawBytes, keyedBytes] = await Promise.all([
		secureRead(containedPath(input.workspaceRoot, contract.acceptedCutout)),
		secureRead(input.providerOutputPath),
		secureRead(input.keyedOutputPath)
	]);
	const root = containedPath(input.workspaceRoot, contract.outputs.root);
	try {
		const built = await buildCandidate(contract, cutoutBytes, rawBytes, keyedBytes);
		const result = candidateResultSchema.parse({
			...resultBaseFields(
				contract,
				input.workspaceRoot,
				paths,
				input.providerOutputPath,
				rawBytes,
				keyedBytes,
				built.rawSize,
				built.keyedSize
			),
			disposition: 'candidate',
			failure: null,
			masks: {
				nearArm: {
					...artifact(input.workspaceRoot, paths.nearArmMask, built.masks.nearArmPng, 768, 768),
					pixels: built.measurements.nearArmMaskPixels
				},
				braid: {
					...artifact(input.workspaceRoot, paths.braidMask, built.masks.braidPng, 768, 768),
					pixels: built.measurements.braidMaskPixels
				}
			},
			outputs: {
				bodyCore: artifact(input.workspaceRoot, paths.bodyCore, built.bodyCore, 768, 768),
				nearArm: artifact(input.workspaceRoot, paths.nearArm, built.nearArm, 768, 768),
				braid: artifact(input.workspaceRoot, paths.braid, built.braid, 768, 768),
				recomposed: artifact(input.workspaceRoot, paths.recomposed, built.recomposed, 768, 768)
			},
			measurements: built.measurements,
			reconstructedRegions: ['near-arm overlap', 'braid/head overlap']
		});
		await persistArtifacts(root, [
			{ destination: paths.rawProvider, bytes: rawBytes },
			{ destination: paths.keyedProvider, bytes: keyedBytes },
			{ destination: paths.nearArmMask, bytes: built.masks.nearArmPng },
			{ destination: paths.braidMask, bytes: built.masks.braidPng },
			{ destination: paths.bodyCore, bytes: built.bodyCore },
			{ destination: paths.nearArm, bytes: built.nearArm },
			{ destination: paths.braid, bytes: built.braid },
			{ destination: paths.recomposed, bytes: built.recomposed },
			{ destination: paths.result, bytes: Buffer.from(stableJson(result), 'utf8') }
		]);
		return await validateGate2BCandidate(contract, input.workspaceRoot);
	} catch (error) {
		const rawMetadata = await sharp(rawBytes, { failOn: 'error' }).metadata();
		const keyedMetadata = await sharp(keyedBytes, { failOn: 'error' }).metadata();
		if (
			rawMetadata.width === undefined ||
			rawMetadata.height === undefined ||
			keyedMetadata.width === undefined ||
			keyedMetadata.height === undefined
		) {
			throw error;
		}
		const failed = failedResultSchema.parse({
			...resultBaseFields(
				contract,
				input.workspaceRoot,
				paths,
				input.providerOutputPath,
				rawBytes,
				keyedBytes,
				{ width: rawMetadata.width, height: rawMetadata.height },
				{ width: keyedMetadata.width, height: keyedMetadata.height }
			),
			disposition: 'failed',
			failure: { stage: 'gate-2b', reason: error instanceof Error ? error.message : String(error) },
			masks: null,
			outputs: null,
			measurements: null,
			reconstructedRegions: []
		});
		await persistArtifacts(root, [
			{ destination: paths.rawProvider, bytes: rawBytes },
			{ destination: paths.keyedProvider, bytes: keyedBytes },
			{ destination: paths.result, bytes: Buffer.from(stableJson(failed), 'utf8') }
		]);
		return await validateGate2BCandidate(contract, input.workspaceRoot);
	}
}

async function validatedArtifact(
	workspaceRoot: string,
	expected: z.infer<typeof artifactSchema>,
	label: string
): Promise<Buffer> {
	const bytes = await secureRead(containedPath(workspaceRoot, expected.path));
	if (rawSha256(bytes) !== expected.sha256) throw new Error(`${label} hash mismatch`);
	const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
	if (metadata.width !== expected.width || metadata.height !== expected.height) {
		throw new Error(`${label} dimensions mismatch`);
	}
	return bytes;
}

export async function validateGate2BCandidate(
	contractInput: AshaSpineGate2BContract,
	workspaceRoot: string
): Promise<AshaSpineGate2BResult> {
	const contract = gate2bContractSchema.parse(contractInput);
	await verifyAuthority(contract, workspaceRoot);
	const paths = resolveGate2BPaths(contract, workspaceRoot);
	const result = resultSchema.parse(JSON.parse((await secureRead(paths.result)).toString('utf8')));
	if (result.prompt !== contract.repairPrompt) throw new Error('Gate 2B prompt mismatch');
	if (result.promptSha256 !== rawSha256(Buffer.from(contract.repairPrompt, 'utf8'))) {
		throw new Error('Gate 2B prompt hash mismatch');
	}
	if (result.sourceSha256 !== contract.acceptedCutoutSha256)
		throw new Error('source hash mismatch');
	if (result.v1FailureResultSha256 !== contract.v1Failure.resultSha256) {
		throw new Error('v1 failure authority mismatch');
	}
	await validatedArtifact(workspaceRoot, result.provider.raw, 'raw provider');
	await validatedArtifact(workspaceRoot, result.provider.keyed, 'keyed provider');
	if (result.disposition === 'failed') {
		for (const path of [
			paths.nearArmMask,
			paths.braidMask,
			paths.bodyCore,
			paths.nearArm,
			paths.braid,
			paths.recomposed
		]) {
			if (await pathExists(path))
				throw new Error('failed Gate 2B result must not contain candidate outputs');
		}
		return result;
	}
	await Promise.all([
		validatedArtifact(workspaceRoot, result.masks.nearArm, 'nearArm mask'),
		validatedArtifact(workspaceRoot, result.masks.braid, 'braid mask'),
		validatedArtifact(workspaceRoot, result.outputs.bodyCore, 'bodyCore output'),
		validatedArtifact(workspaceRoot, result.outputs.nearArm, 'nearArm output'),
		validatedArtifact(workspaceRoot, result.outputs.braid, 'braid output'),
		validatedArtifact(workspaceRoot, result.outputs.recomposed, 'recomposed output')
	]);
	return result;
}
