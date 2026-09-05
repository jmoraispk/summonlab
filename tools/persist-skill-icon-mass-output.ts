import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	MASS_PRODUCTION_FRAME_AUTHORITY_PATH,
	MASS_PRODUCTION_MANIFEST_PATH,
	MASS_PRODUCTION_PAINTED_EMBLEM_PATH,
	MASS_PRODUCTION_ROOT,
	type MassProductionManifest,
	sha256
} from './skill-icon-mass-production-lib.js';

type Kind = 'family' | 'skill';

interface Arguments {
	readonly kind: Kind;
	readonly id: string;
	readonly source: string;
}

function parseArguments(args: readonly string[]): Arguments {
	if (args[0] === '--') args = args.slice(1);
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const key = args[index];
		const value = args[index + 1];
		if (!key?.startsWith('--') || !value) throw new Error('Expected --kind, --id, and --source');
		values.set(key.slice(2), value);
	}
	const kind = values.get('kind');
	const id = values.get('id');
	const source = values.get('source');
	if ((kind !== 'family' && kind !== 'skill') || !id || !source) {
		throw new Error('Usage: --kind family|skill --id ID --source ABSOLUTE_PNG_PATH');
	}
	return { kind, id, source };
}

async function assertRegularFile(filePath: string): Promise<void> {
	const metadata = await lstat(filePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Expected regular file: ${filePath}`);
	}
}

async function writeExclusive(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

async function copyExclusive(source: string, destination: string): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(source, destination, constants.COPYFILE_EXCL);
}

function transparentEdgeConnectedBackground(data: Buffer, width: number, height: number): Buffer {
	const output = Buffer.from(data);
	const visited = new Uint8Array(width * height);
	const queue = new Uint32Array(width * height);
	let head = 0;
	let tail = 0;
	const enqueue = (index: number) => {
		if (visited[index]) return;
		const offset = index * 4;
		const red = output[offset] ?? 255;
		const green = output[offset + 1] ?? 255;
		const blue = output[offset + 2] ?? 255;
		const alpha = output[offset + 3] ?? 255;
		const nearBlack = red <= 34 && green <= 34 && blue <= 34;
		const lightNeutral =
			Math.min(red, green, blue) >= 172 &&
			Math.max(red, green, blue) - Math.min(red, green, blue) <= 18;
		if (alpha > 8 && !nearBlack && !lightNeutral) return;
		visited[index] = 1;
		queue[tail++] = index;
	};
	for (let x = 0; x < width; x += 1) {
		enqueue(x);
		enqueue((height - 1) * width + x);
	}
	for (let y = 0; y < height; y += 1) {
		enqueue(y * width);
		enqueue(y * width + width - 1);
	}
	while (head < tail) {
		const index = queue[head++]!;
		output[index * 4 + 3] = 0;
		const x = index % width;
		const y = Math.floor(index / width);
		if (x > 0) enqueue(index - 1);
		if (x + 1 < width) enqueue(index + 1);
		if (y > 0) enqueue(index - width);
		if (y + 1 < height) enqueue(index + width);
		if (x > 0 && y > 0) enqueue(index - width - 1);
		if (x + 1 < width && y > 0) enqueue(index - width + 1);
		if (x > 0 && y + 1 < height) enqueue(index + width - 1);
		if (x + 1 < width && y + 1 < height) enqueue(index + width + 1);
	}
	return output;
}

export async function normalizeSkillSource(source: Buffer): Promise<Buffer> {
	const decoded = await sharp(source, { failOn: 'error' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (decoded.info.width < 1024 || decoded.info.height < 1024) {
		throw new Error(
			`Skill source must be at least 1024 pixels per edge, found ${decoded.info.width}x${decoded.info.height}`
		);
	}
	const keyed = transparentEdgeConnectedBackground(
		decoded.data,
		decoded.info.width,
		decoded.info.height
	);
	return sharp(keyed, {
		raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 }
	})
		.resize(1024, 1024, {
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
			withoutEnlargement: true
		})
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function mediaRecord(
	bytes: Buffer,
	metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>
) {
	return {
		mediaType: 'image/png',
		width: metadata.width,
		height: metadata.height,
		alphaMode: metadata.hasAlpha ? 'rgba' : 'rgb',
		bytes: bytes.byteLength,
		contentHash: sha256(bytes)
	};
}

export async function persistMassProductionOutput(
	args: Arguments,
	root = process.cwd()
): Promise<{ readonly outputPath: string; readonly resultPath: string }> {
	root = path.resolve(root);
	const sourcePath = path.resolve(args.source);
	await assertRegularFile(sourcePath);
	const sourceBytes = await readFile(sourcePath);
	const sourceMetadata = await sharp(sourceBytes).metadata();
	if (sourceMetadata.format !== 'png') throw new Error('Provider output must be a PNG');
	const manifest = JSON.parse(
		await readFile(path.resolve(root, MASS_PRODUCTION_MANIFEST_PATH), 'utf8')
	) as MassProductionManifest;
	const promptRecord =
		args.kind === 'family'
			? manifest.families.find((record) => record.familyId === args.id)
			: manifest.skills.find((record) => record.targetId === args.id);
	if (!promptRecord) throw new Error(`Unknown ${args.kind} identity: ${args.id}`);
	const promptBytes = await readFile(path.resolve(root, promptRecord.promptPath));
	const prompt = JSON.parse(promptBytes.toString('utf8')) as { readonly exactPrompt: string };
	const outputPath =
		args.kind === 'family'
			? (promptRecord as MassProductionManifest['families'][number]).referenceSheetPath
			: (promptRecord as MassProductionManifest['skills'][number]).finalImagePath;
	const resultPath = promptRecord.resultPath;
	await Promise.all([
		lstat(path.resolve(root, outputPath)).then(
			() => Promise.reject(new Error(`Output already exists: ${outputPath}`)),
			() => undefined
		),
		lstat(path.resolve(root, resultPath)).then(
			() => Promise.reject(new Error(`Result already exists: ${resultPath}`)),
			() => undefined
		)
	]);

	const references: string[] = [
		MASS_PRODUCTION_FRAME_AUTHORITY_PATH,
		MASS_PRODUCTION_PAINTED_EMBLEM_PATH
	];
	if (args.kind === 'skill') {
		const skill = promptRecord as MassProductionManifest['skills'][number];
		const family = manifest.families.find((record) => record.familyId === skill.motifFamily)!;
		references.push(family.referenceSheetPath);
		if (skill.primaryVisualParent) {
			const parent = manifest.skills.find(
				(record) => record.targetId === skill.primaryVisualParent
			);
			if (!parent) throw new Error(`Missing parent record ${skill.primaryVisualParent}`);
			references.push(parent.finalImagePath);
		}
	}
	const referenceRecords = await Promise.all(
		references.map(async (referencePath) => {
			const bytes = await readFile(path.resolve(root, referencePath));
			return { path: referencePath, contentHash: sha256(bytes) };
		})
	);

	let retainedBytes: Buffer = Buffer.from(sourceBytes);
	let providerSourcePath: string | null = null;
	if (args.kind === 'skill') {
		const skill = promptRecord as MassProductionManifest['skills'][number];
		providerSourcePath = `${MASS_PRODUCTION_ROOT}/provider-sources/${skill.slug}-v1.png`;
		await copyExclusive(sourcePath, path.resolve(root, providerSourcePath));
		retainedBytes = Buffer.from(await normalizeSkillSource(sourceBytes));
		await writeExclusive(path.resolve(root, outputPath), retainedBytes);
	} else {
		await copyExclusive(sourcePath, path.resolve(root, outputPath));
	}
	const retainedMetadata = await sharp(retainedBytes).metadata();
	const result = {
		schemaVersion: 'skill-icon-mass-result-v1',
		kind: args.kind,
		identity: args.id,
		status: 'candidate',
		promptPath: promptRecord.promptPath,
		promptHash: createHash('sha256').update(prompt.exactPrompt).digest('hex'),
		references: referenceRecords,
		providerSource: {
			path: providerSourcePath,
			...mediaRecord(sourceBytes, sourceMetadata)
		},
		output: { path: outputPath, ...mediaRecord(retainedBytes, retainedMetadata) },
		processing: args.kind === 'family' ? 'exact-provider-bytes' : 'edge-key-and-fit-1024',
		attemptCount: 1
	};
	await writeExclusive(
		path.resolve(root, resultPath),
		Buffer.from(`${JSON.stringify(result, null, '\t')}\n`)
	);
	return { outputPath, resultPath };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	persistMassProductionOutput(parseArguments(process.argv.slice(2)))
		.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
