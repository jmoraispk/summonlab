import { constants as fsConstants, type PathLike } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
	copyFile,
	lstat,
	mkdir,
	mkdtemp,
	open,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
	type FileHandle
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
		sourceCanvas: z.object({ width: z.literal(768), height: z.literal(768) }).strict(),
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

export async function loadTransportManifest(path: string): Promise<AshaSpineTransportManifest> {
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

export type TransportImageResult = Readonly<{
	path: string;
	width: 1024;
	height: 1024;
	left: 128;
	top: 128;
}>;

export async function extractedPixelHash(
	path: string,
	left: number,
	top: number,
	width: number,
	height: number
): Promise<string> {
	const pixels = await sharp(path, { failOn: 'error' })
		.extract({ left, top, width, height })
		.ensureAlpha()
		.raw()
		.toBuffer();
	return createHash('sha256').update(pixels).digest('hex');
}

export async function buildTransportImage(
	manifest: AshaSpineTransportManifest,
	workspaceRoot: string,
	outputDirectory: string
): Promise<TransportImageResult> {
	const sourcePath = containedPath(workspaceRoot, manifest.acceptedCutout);
	const source = (await secureReadFile(sourcePath)) as Buffer;
	const sourceHash = createHash('sha256').update(source).digest('hex');
	if (sourceHash !== manifest.acceptedCutoutSha256) {
		throw new Error('accepted transport cutout hash mismatch');
	}

	const horizontalPadding =
		manifest.transportCanvas.width - manifest.sourceCanvas.width - manifest.transportCanvas.left;
	const verticalPadding =
		manifest.transportCanvas.height - manifest.sourceCanvas.height - manifest.transportCanvas.top;
	const outputPath = join(outputDirectory, 'asha-transport-v1.png');
	const encoded = await sharp(source, { failOn: 'error' })
		.extend({
			top: manifest.transportCanvas.top,
			bottom: verticalPadding,
			left: manifest.transportCanvas.left,
			right: horizontalPadding,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		})
		.png()
		.toBuffer();
	await mkdir(outputDirectory, { recursive: true });
	await writeFile(outputPath, encoded, { flag: 'wx' });

	return {
		path: outputPath,
		width: 1024,
		height: 1024,
		left: 128,
		top: 128
	};
}

export type TransportImport = Readonly<{
	skeleton: Readonly<Record<string, string | number>>;
	bones: ReadonlyArray<Readonly<{ name: string; parent?: string }>>;
	slots: ReadonlyArray<Readonly<{ name: string; bone: string; attachment: string }>>;
	skins: ReadonlyArray<Readonly<Record<string, unknown>>>;
	animations: Readonly<{
		idle_transport_probe: Readonly<{
			bones: Readonly<{
				root?: never;
				body: Readonly<{
					rotate: ReadonlyArray<Readonly<{ time?: number; value: number }>>;
				}>;
			}>;
		}>;
	}>;
}>;

export function buildTransportImport(manifest: AshaSpineTransportManifest): TransportImport {
	const paddedFeetY = manifest.feetAnchor.sourceY + manifest.transportCanvas.top;
	return {
		skeleton: {
			hash: 'asha-spine-transport-v1',
			spine: manifest.editorVersion,
			x: -manifest.transportCanvas.width / 2,
			y: -(manifest.transportCanvas.height - paddedFeetY),
			width: manifest.transportCanvas.width,
			height: manifest.transportCanvas.height,
			images: './images/'
		},
		bones: [{ name: 'root' }, { name: 'body', parent: 'root' }],
		slots: [{ name: 'body', bone: 'body', attachment: 'asha_transport' }],
		skins: [
			{
				name: 'default',
				attachments: {
					body: {
						asha_transport: {
							path: 'asha-transport-v1',
							y: paddedFeetY - manifest.transportCanvas.height / 2,
							width: manifest.transportCanvas.width,
							height: manifest.transportCanvas.height
						}
					}
				}
			}
		],
		animations: {
			idle_transport_probe: {
				bones: {
					body: {
						rotate: [
							{ value: 0 },
							{ time: manifest.animation.durationSeconds / 2, value: 0.35 },
							{ time: manifest.animation.durationSeconds, value: 0 }
						]
					}
				}
			}
		}
	};
}

export function spineTransportCommands(
	spineCli: string,
	manifest: AshaSpineTransportManifest,
	paths: TransportPaths
): ReadonlyArray<ReadonlyArray<string>> {
	return [
		[
			spineCli,
			'--hide-license',
			'--update',
			manifest.editorVersion,
			'--input',
			paths.importJson,
			'--output',
			paths.project,
			'--to',
			'asha_transport_v1',
			'--import'
		],
		[
			spineCli,
			'--hide-license',
			'--update',
			manifest.editorVersion,
			'--input',
			paths.project,
			'--output',
			paths.runtimeDirectory,
			'--export',
			'json+pack'
		]
	];
}

export function redactSpineOutput(output: string): string {
	return output.replace(/^Licensed to:.*$/gmu, '[license identity redacted]');
}

export function resolveSpineCli(workspaceRoot: string, configuredPath?: string): string {
	const root = resolve(workspaceRoot);
	const candidate = resolve(root, configuredPath ?? 'Spine/Spine.sh');
	const offset = relative(root, candidate);
	if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
		throw new Error('Spine CLI must be inside the workspace');
	}
	return candidate;
}

type RuntimeJson = {
	skeleton?: { spine?: unknown };
	bones?: Array<Record<string, unknown>>;
	slots?: Array<Record<string, unknown>>;
	skins?: Array<Record<string, unknown>>;
	animations?: Record<string, unknown>;
};

export type TransportExportValidation = Readonly<{
	json: string;
	atlas: string;
	png: string;
	animationDurationSeconds: number;
	pageWidth: number;
	pageHeight: number;
}>;

export async function normalizeRuntimeArtifacts(runtimeDirectory: string): Promise<void> {
	const entries = await readdir(runtimeDirectory, { withFileTypes: true });
	const only = (extension: string) =>
		entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension));
	const json = only('.json');
	const atlas = only('.atlas');
	const png = only('.png');
	if (json.length !== 1 || atlas.length !== 1 || png.length !== 1) {
		throw new Error('runtime export must contain exactly one JSON, atlas, and PNG');
	}

	const canonicalBase = 'asha-transport-v1';
	const oldPngName = png[0]!.name;
	const oldRegionName = oldPngName.replace(/\.png$/u, '');
	const atlasText = await readFile(join(runtimeDirectory, atlas[0]!.name), 'utf8');
	const normalizedAtlas = atlasText
		.split(/\r?\n/u)
		.map((line) => {
			if (line === oldPngName) return `${canonicalBase}.png`;
			if (line === oldRegionName) return canonicalBase;
			return line;
		})
		.join('\n');

	for (const [source, destination] of [
		[json[0]!.name, `${canonicalBase}.json`],
		[atlas[0]!.name, `${canonicalBase}.atlas`],
		[png[0]!.name, `${canonicalBase}.png`]
	] as const) {
		if (source === destination) continue;
		if (await pathExists(join(runtimeDirectory, destination))) {
			throw new Error(`owned output already exists: ${join(runtimeDirectory, destination)}`);
		}
		await rename(join(runtimeDirectory, source), join(runtimeDirectory, destination));
	}
	await writeFile(join(runtimeDirectory, `${canonicalBase}.atlas`), normalizedAtlas, {
		flag: 'w'
	});
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
	return value;
}

function numericTimeline(
	value: unknown,
	label: string
): Array<Readonly<{ time: number; value: number }>> {
	return requireArray(value, label).map((entry, index) => {
		const key = requireRecord(entry, `${label}[${index}]`);
		const time = key.time === undefined ? 0 : key.time;
		const amount = key.value === undefined ? 0 : key.value;
		if (typeof time !== 'number' || typeof amount !== 'number') {
			throw new Error(`${label}[${index}] must contain numeric time and value`);
		}
		return { time, value: amount };
	});
}

function hasNegativeScaleX(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(hasNegativeScaleX);
	if (typeof value !== 'object' || value === null) return false;
	return Object.entries(value).some(
		([key, nested]) =>
			((key === 'scaleX' || key === 'x') && typeof nested === 'number' && nested < 0) ||
			hasNegativeScaleX(nested)
	);
}

function containsMesh(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(containsMesh);
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	if (record.type === 'mesh' || record.type === 'linkedmesh') return true;
	return Object.values(record).some(containsMesh);
}

function findDefaultAttachment(data: RuntimeJson): Record<string, unknown> {
	const skins = requireArray(data.skins, 'skins').map((skin) => requireRecord(skin, 'skin'));
	const defaultSkin = skins.find((skin) => skin.name === 'default');
	if (!defaultSkin) throw new Error('default skin is missing');
	const attachments = requireRecord(defaultSkin.attachments, 'default skin attachments');
	const body = requireRecord(attachments.body, 'body attachments');
	return requireRecord(body.asha_transport, 'asha_transport attachment');
}

function parseAtlas(atlasText: string): {
	pageName: string;
	pageWidth: number;
	pageHeight: number;
	regions: string[];
} {
	const lines = atlasText.split(/\r?\n/u);
	const pageLines = lines.filter((line) => /^\S+\.png$/u.test(line));
	if (pageLines.length !== 1) throw new Error('atlas must contain exactly one page');
	const pageIndex = lines.indexOf(pageLines[0]!);
	const sizeLine = lines.slice(pageIndex + 1).find((line) => /^size:\s*/u.test(line));
	const sizeMatch = sizeLine?.match(/^size:\s*(\d+)\s*,\s*(\d+)\s*$/u);
	if (!sizeMatch) throw new Error('atlas page size is missing');
	const regions = lines.filter(
		(line, index) =>
			index > pageIndex && /^\S/u.test(line) && !line.includes(':') && !line.endsWith('.png')
	);
	return {
		pageName: pageLines[0]!,
		pageWidth: Number(sizeMatch[1]),
		pageHeight: Number(sizeMatch[2]),
		regions
	};
}

export async function validateTransportExport(
	runtimeDirectory: string
): Promise<TransportExportValidation> {
	const entries = await readdir(runtimeDirectory, { withFileTypes: true });
	if (entries.some((entry) => !entry.isFile())) {
		throw new Error('runtime export must contain files only');
	}
	const withExtension = (extension: string) =>
		entries.filter((entry) => entry.name.endsWith(extension));
	const jsonFiles = withExtension('.json');
	const atlasFiles = withExtension('.atlas');
	const pngFiles = withExtension('.png');
	if (jsonFiles.length !== 1 || atlasFiles.length !== 1 || pngFiles.length !== 1) {
		throw new Error('runtime export must contain exactly one JSON, atlas, and PNG');
	}

	const jsonPath = join(runtimeDirectory, jsonFiles[0]!.name);
	const atlasPath = join(runtimeDirectory, atlasFiles[0]!.name);
	const pngPath = join(runtimeDirectory, pngFiles[0]!.name);
	const data = JSON.parse(await readFile(jsonPath, 'utf8')) as RuntimeJson;
	if (data.skeleton?.spine !== '4.3.26') throw new Error('exported Spine version mismatch');

	const bones = requireArray(data.bones, 'bones').map((bone) => requireRecord(bone, 'bone'));
	if (bones.length !== 2 || bones[0]?.name !== 'root' || bones[1]?.name !== 'body') {
		throw new Error('export must contain exactly root and body bones');
	}
	if (hasNegativeScaleX(bones)) throw new Error('negative scaleX is not allowed');

	const slots = requireArray(data.slots, 'slots').map((slot) => requireRecord(slot, 'slot'));
	if (
		slots.length !== 1 ||
		slots[0]?.name !== 'body' ||
		slots[0]?.bone !== 'body' ||
		slots[0]?.attachment !== 'asha_transport'
	) {
		throw new Error('body slot does not resolve asha_transport');
	}
	const attachment = findDefaultAttachment(data);
	if (containsMesh(attachment)) throw new Error('mesh attachments are not allowed');

	const animations = requireRecord(data.animations, 'animations');
	if (Object.keys(animations).length !== 1 || !animations.idle_transport_probe) {
		throw new Error('export must contain only idle_transport_probe');
	}
	const animation = requireRecord(animations.idle_transport_probe, 'idle_transport_probe');
	if ('drawOrder' in animation || 'draworder' in animation) {
		throw new Error('draw-order timeline is not allowed');
	}
	const animationBones = requireRecord(animation.bones, 'animation bones');
	if (animationBones.root !== undefined) throw new Error('root timeline is not allowed');
	if (hasNegativeScaleX(animationBones)) throw new Error('negative scaleX is not allowed');
	const bodyTimeline = requireRecord(animationBones.body, 'body animation');
	const rotation = numericTimeline(bodyTimeline.rotate, 'body rotation');
	const expected = [
		{ time: 0, value: 0 },
		{ time: 0.5, value: 0.35 },
		{ time: 1, value: 0 }
	];
	if (
		rotation.length !== expected.length ||
		rotation.some(
			(key, index) =>
				Math.abs(key.time - expected[index]!.time) > 1e-6 ||
				Math.abs(key.value - expected[index]!.value) > 1e-6
		)
	) {
		throw new Error('body rotation keys do not match the transport probe');
	}

	const atlasText = await readFile(atlasPath, 'utf8');
	const atlas = parseAtlas(atlasText);
	if (atlas.pageWidth > 2048 || atlas.pageHeight > 2048) {
		throw new Error('atlas page exceeds 2048x2048');
	}
	if (atlas.regions.length !== 1 || atlas.regions[0] !== 'asha-transport-v1') {
		throw new Error('atlas must contain exactly the asha-transport-v1 region');
	}
	if (atlas.pageName !== pngFiles[0]!.name) throw new Error('atlas page does not match PNG');
	if (attachment.path !== 'asha-transport-v1') throw new Error('attachment region is missing');

	const pngMetadata = await sharp(pngPath, { failOn: 'error' }).metadata();
	if (
		pngMetadata.channels !== 4 ||
		(pngMetadata.width ?? Number.POSITIVE_INFINITY) > 2048 ||
		(pngMetadata.height ?? Number.POSITIVE_INFINITY) > 2048
	) {
		throw new Error('runtime PNG must be RGBA and no larger than 2048x2048');
	}

	return {
		json: jsonPath,
		atlas: atlasPath,
		png: pngPath,
		animationDurationSeconds: rotation.at(-1)!.time,
		pageWidth: atlas.pageWidth,
		pageHeight: atlas.pageHeight
	};
}

export type AshaSpineTransportRunResult = Readonly<{
	mode: TransportMode;
	paths: TransportPaths;
	validation: TransportExportValidation;
}>;

async function assertSpineExecutable(workspaceRoot: string, cliPath: string): Promise<void> {
	const metadata = await lstat(cliPath);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error('Spine CLI must be a regular non-symbolic-link file');
	}
	const root = await realpath(workspaceRoot);
	const executable = await realpath(cliPath);
	const offset = relative(root, executable);
	if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
		throw new Error('Spine CLI must be inside the workspace');
	}
	if ((metadata.mode & 0o111) === 0) throw new Error('Spine CLI is not executable');
}

async function executeSpineCommand(command: ReadonlyArray<string>): Promise<string> {
	const [executable, ...args] = command;
	if (!executable) throw new Error('Spine command is empty');
	return new Promise((resolvePromise, reject) => {
		const child = spawn(executable, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env
		});
		let output = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			output += chunk;
		});
		child.stderr.on('data', (chunk: string) => {
			output += chunk;
		});
		child.once('error', reject);
		child.once('close', (code, signal) => {
			const safeOutput = redactSpineOutput(output);
			if (code !== 0) {
				reject(
					new Error(
						`Spine command failed (${signal ? `signal ${signal}` : `exit ${String(code)}`}):\n${safeOutput}`
					)
				);
				return;
			}
			resolvePromise(safeOutput);
		});
	});
}

async function validateGeneratedImage(
	manifest: AshaSpineTransportManifest,
	workspaceRoot: string,
	imagePath: string
): Promise<void> {
	const metadata = await sharp(imagePath, { failOn: 'error' }).metadata();
	if (
		metadata.width !== manifest.transportCanvas.width ||
		metadata.height !== manifest.transportCanvas.height ||
		metadata.channels !== 4
	) {
		throw new Error('transport image must be 1024x1024 RGBA');
	}
	const embedded = await extractedPixelHash(
		imagePath,
		manifest.transportCanvas.left,
		manifest.transportCanvas.top,
		manifest.sourceCanvas.width,
		manifest.sourceCanvas.height
	);
	const source = await extractedPixelHash(
		containedPath(workspaceRoot, manifest.acceptedCutout),
		0,
		0,
		manifest.sourceCanvas.width,
		manifest.sourceCanvas.height
	);
	if (embedded !== source) throw new Error('transport image changed an accepted source pixel');
}

async function validateImportJson(
	manifest: AshaSpineTransportManifest,
	path: string
): Promise<void> {
	const actual = JSON.parse(await readFile(path, 'utf8')) as unknown;
	if (JSON.stringify(actual) !== JSON.stringify(buildTransportImport(manifest))) {
		throw new Error('transport import JSON does not match the deterministic contract');
	}
}

function stagedPaths(stagingRoot: string): TransportPaths {
	const transport = join(stagingRoot, 'transport');
	return {
		image: join(transport, 'images', 'asha-transport-v1.png'),
		importJson: join(transport, 'asha-transport-import-v1.json'),
		project: join(transport, 'asha-transport-v1.spine'),
		runtimeDirectory: join(stagingRoot, 'runtime')
	};
}

async function commitStagedOutputs(staged: TransportPaths, target: TransportPaths): Promise<void> {
	const createdFiles: string[] = [];
	let createdRuntimeDirectory = false;
	try {
		await mkdir(dirname(target.image), { recursive: true });
		for (const [source, destination] of [
			[staged.image, target.image],
			[staged.importJson, target.importJson],
			[staged.project, target.project]
		] as const) {
			await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
			createdFiles.push(destination);
		}

		await mkdir(dirname(target.runtimeDirectory), { recursive: true });
		await mkdir(target.runtimeDirectory);
		createdRuntimeDirectory = true;
		for (const fileName of [
			'asha-transport-v1.json',
			'asha-transport-v1.atlas',
			'asha-transport-v1.png'
		]) {
			const destination = join(target.runtimeDirectory, fileName);
			await copyFile(
				join(staged.runtimeDirectory, fileName),
				destination,
				fsConstants.COPYFILE_EXCL
			);
			createdFiles.push(destination);
		}
	} catch (error) {
		await Promise.all(createdFiles.map((path) => rm(path, { force: true })));
		if (createdRuntimeDirectory) {
			await rm(target.runtimeDirectory, { recursive: true, force: true });
		}
		throw error;
	}
}

export async function runAshaSpineTransport(
	options: Readonly<{
		workspaceRoot: string;
		mode: TransportMode;
		spineCli?: string;
		log?: (message: string) => void;
	}>
): Promise<AshaSpineTransportRunResult> {
	const workspaceRoot = resolve(options.workspaceRoot);
	const manifestPath = join(
		workspaceRoot,
		'assets/heroes/visuals/spine-exploration-canary-v1/transport/manifest.json'
	);
	const manifest = await loadTransportManifest(manifestPath);
	const paths = await preflightTransport(manifest, workspaceRoot, options.mode);

	if (options.mode === 'check') {
		await validateGeneratedImage(manifest, workspaceRoot, paths.image);
		await validateImportJson(manifest, paths.importJson);
		const projectMetadata = await stat(paths.project);
		if (!projectMetadata.isFile() || projectMetadata.size === 0) {
			throw new Error('transport Spine project is missing or empty');
		}
		return {
			mode: options.mode,
			paths,
			validation: await validateTransportExport(paths.runtimeDirectory)
		};
	}

	const cliPath = resolveSpineCli(
		workspaceRoot,
		options.spineCli ?? process.env.SUMMONLAB_SPINE_CLI
	);
	await assertSpineExecutable(workspaceRoot, cliPath);
	const stagingRoot = await mkdtemp(join(workspaceRoot, '.asha-spine-transport.'));
	try {
		const staged = stagedPaths(stagingRoot);
		await buildTransportImage(manifest, workspaceRoot, dirname(staged.image));
		await writeFile(
			staged.importJson,
			`${JSON.stringify(buildTransportImport(manifest), null, 2)}\n`,
			{ flag: 'wx' }
		);
		for (const command of spineTransportCommands(cliPath, manifest, staged)) {
			const output = await executeSpineCommand(command);
			if (output.trim()) options.log?.(output.trimEnd());
		}
		await normalizeRuntimeArtifacts(staged.runtimeDirectory);
		await validateGeneratedImage(manifest, workspaceRoot, staged.image);
		await validateImportJson(manifest, staged.importJson);
		const validation = await validateTransportExport(staged.runtimeDirectory);
		await commitStagedOutputs(staged, paths);
		return {
			mode: options.mode,
			paths,
			validation: {
				...validation,
				json: join(paths.runtimeDirectory, 'asha-transport-v1.json'),
				atlas: join(paths.runtimeDirectory, 'asha-transport-v1.atlas'),
				png: join(paths.runtimeDirectory, 'asha-transport-v1.png')
			}
		};
	} finally {
		await rm(stagingRoot, { recursive: true, force: true });
	}
}
