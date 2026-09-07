import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

import {
	CANONICAL_SKILL_ASSET_MANIFEST_PATH,
	CANONICAL_SKILL_CATALOG_PATH,
	loadCanonicalSkillAssets
} from './skill-icon-canonical-assets.js';

export const WIKI_SKILL_VISUAL_ROOT =
	'apps/web/static/wiki-media/skills/visual-catalog-v2' as const;
export const WIKI_SKILL_VISUAL_MANIFEST_PATH = `${WIKI_SKILL_VISUAL_ROOT}/manifest.json` as const;
export const WIKI_SKILL_VISUAL_EXPORTER_VERSION = 'wiki-skill-visual-catalog-exporter-v2' as const;
export const WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES = 170_000 as const;
export const WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES = 60_000_000 as const;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryManifestPath = path.resolve(repositoryRoot, WIKI_SKILL_VISUAL_MANIFEST_PATH);
const workerCount = 12;

interface CatalogRecord {
	readonly targetId: string;
	readonly rarity: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
}

export interface WikiSkillVisualRuntimeRecord {
	readonly targetId: string;
	readonly sourcePath: string;
	readonly sourceContentHash: string;
	readonly framePath: string;
	readonly frameContentHash: string;
	readonly backingContentHash: string;
	readonly compositionContentHash: string;
	readonly file: string;
	readonly publicPath: string;
	readonly width: 512;
	readonly height: 512;
	readonly bytes: number;
	readonly contentHash: string;
}

export interface WikiSkillVisualRuntimeManifest {
	readonly schemaVersion: 'wiki-skill-visual-catalog-v2';
	readonly exporterVersion: typeof WIKI_SKILL_VISUAL_EXPORTER_VERSION;
	readonly encoder: {
		readonly format: 'webp';
		readonly quality: 86;
		readonly alphaQuality: 100;
		readonly effort: 4;
		readonly smartSubsample: true;
		readonly metadata: 'stripped';
	};
	readonly sourceAuthorities: {
		readonly catalog: { readonly path: string; readonly contentHash: string };
		readonly assetManifest: { readonly path: string; readonly contentHash: string };
	};
	readonly records: readonly WikiSkillVisualRuntimeRecord[];
	readonly summary: {
		readonly skillCount: number;
		readonly assetCount: number;
		readonly totalBytes: number;
		readonly managedDirectoryBytes: number;
		readonly maximumAssetBytes: typeof WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES;
		readonly maximumManagedDirectoryBytes: typeof WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES;
	};
}

export interface GeneratedAsset {
	readonly record: WikiSkillVisualRuntimeRecord;
	readonly buffer: Buffer;
}

export interface BuiltWikiSkillVisualCatalog {
	readonly manifest: WikiSkillVisualRuntimeManifest;
	readonly generated: readonly GeneratedAsset[];
}

export async function composeSkillIconLayers(
	backing: Buffer,
	interior: Buffer,
	frame: Buffer
): Promise<Buffer> {
	return sharp(backing, { failOn: 'error' })
		.composite([{ input: interior }, { input: frame }])
		.png()
		.toBuffer();
}

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function inside(root: string, relativePath: string): string {
	if (path.isAbsolute(relativePath))
		throw new Error(`Path must be workspace-relative: ${relativePath}`);
	const absolute = path.resolve(root, relativePath);
	const relative = path.relative(root, absolute);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
		throw new Error(`Path escapes workspace: ${relativePath}`);
	}
	return absolute;
}

function contained(root: string, target: string): boolean {
	const relative = path.relative(root, target);
	return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

async function assertResolvedInside(root: string, absolute: string): Promise<void> {
	const canonicalRoot = await realpath(root);
	let probe = absolute;
	while (true) {
		try {
			if (!contained(canonicalRoot, await realpath(probe))) {
				throw new Error(`Path escapes workspace through a symbolic link: ${absolute}`);
			}
			return;
		} catch (error: unknown) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			const parent = path.dirname(probe);
			if (parent === probe) throw error;
			probe = parent;
		}
	}
}

async function regularFile(root: string, relativePath: string): Promise<Buffer> {
	const absolute = inside(root, relativePath);
	await assertResolvedInside(root, absolute);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Expected regular file: ${relativePath}`);
	return readFile(absolute);
}

async function mapConcurrent<T, U>(
	values: readonly T[],
	mapper: (value: T) => Promise<U>
): Promise<U[]> {
	const output = new Array<U>(values.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(workerCount, values.length) }, async () => {
			while (next < values.length) {
				const index = next++;
				output[index] = await mapper(values[index]!);
			}
		})
	);
	return output;
}

async function formatManifest(manifest: WikiSkillVisualRuntimeManifest): Promise<Buffer> {
	const config = await resolveConfig(repositoryManifestPath, { useCache: false });
	return Buffer.from(
		await format(JSON.stringify(manifest), {
			...config,
			filepath: repositoryManifestPath,
			parser: 'json'
		}),
		'utf8'
	);
}

export function assertWikiSkillVisualManagedBudget(
	imageBytes: number,
	manifestBytes: number
): number {
	if (
		!Number.isSafeInteger(imageBytes) ||
		imageBytes < 0 ||
		!Number.isSafeInteger(manifestBytes) ||
		manifestBytes < 0
	) {
		throw new Error('Invalid managed-directory byte total');
	}
	const total = imageBytes + manifestBytes;
	if (!Number.isSafeInteger(total) || total > WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES) {
		throw new Error('Wiki skill visual managed-directory budget exceeded');
	}
	return total;
}

export async function assertWikiSkillVisualDerivative(
	data: Buffer,
	targetId: string
): Promise<void> {
	const decoded = await sharp(data, { failOn: 'error' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (decoded.info.width !== 512 || decoded.info.height !== 512 || decoded.info.channels !== 4) {
		throw new Error(`Invalid decoded WebP derivative geometry or alpha for ${targetId}`);
	}
}

async function finalizeSummary(
	manifest: WikiSkillVisualRuntimeManifest
): Promise<WikiSkillVisualRuntimeManifest> {
	let candidate = manifest;
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const managedDirectoryBytes = assertWikiSkillVisualManagedBudget(
			candidate.summary.totalBytes,
			(await formatManifest(candidate)).byteLength
		);
		if (candidate.summary.managedDirectoryBytes === managedDirectoryBytes) return candidate;
		candidate = { ...candidate, summary: { ...candidate.summary, managedDirectoryBytes } };
	}
	throw new Error('Managed-directory byte total did not converge');
}

export async function buildWikiSkillVisualCatalog(
	root = repositoryRoot
): Promise<BuiltWikiSkillVisualCatalog> {
	const assets = await loadCanonicalSkillAssets(root);
	const catalogBytes = await regularFile(root, CANONICAL_SKILL_CATALOG_PATH);
	const assetManifestBytes = await regularFile(root, CANONICAL_SKILL_ASSET_MANIFEST_PATH);
	const catalog = JSON.parse(catalogBytes.toString('utf8')) as {
		records: CatalogRecord[];
	};
	const catalogByTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const frames = new Map(assets.frames.map((frame) => [frame.rarity, frame]));
	const backing = await regularFile(root, assets.backing.path);
	const sorted = [...assets.records].sort((left, right) =>
		left.targetId.localeCompare(right.targetId)
	);
	const generated = await mapConcurrent(sorted, async (interior) => {
		const canonical = catalogByTargetId.get(interior.targetId);
		if (!canonical) throw new Error(`Missing catalog record: ${interior.targetId}`);
		const frame = frames.get(canonical.rarity);
		if (!frame) throw new Error(`Missing ${canonical.rarity} frame for ${interior.targetId}`);
		const interiorBytes = await regularFile(root, interior.interiorPath);
		const frameBytes = await regularFile(root, frame.path);
		const composite = await composeSkillIconLayers(backing, interiorBytes, frameBytes);
		const compositionContentHash = sha256(composite);
		const output = await sharp(composite, { failOn: 'error' })
			.resize(512, 512, { fit: 'fill' })
			.webp({ quality: 86, alphaQuality: 100, effort: 4, smartSubsample: true })
			.toBuffer();
		await assertWikiSkillVisualDerivative(output, interior.targetId);
		if (output.byteLength > WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES) {
			throw new Error(`Derivative exceeds byte budget for ${interior.targetId}`);
		}
		const file = `icons/${interior.slug}.${compositionContentHash.slice(0, 12)}.webp`;
		return {
			record: {
				targetId: interior.targetId,
				sourcePath: interior.interiorPath,
				sourceContentHash: interior.contentHash,
				framePath: frame.path,
				frameContentHash: frame.contentHash,
				backingContentHash: assets.backing.contentHash,
				compositionContentHash,
				file,
				publicPath: `/wiki-media/skills/visual-catalog-v2/${file}`,
				width: 512 as const,
				height: 512 as const,
				bytes: output.byteLength,
				contentHash: sha256(output)
			},
			buffer: output
		};
	});
	const totalBytes = generated.reduce((total, item) => total + item.buffer.byteLength, 0);
	const manifest = await finalizeSummary({
		schemaVersion: 'wiki-skill-visual-catalog-v2',
		exporterVersion: WIKI_SKILL_VISUAL_EXPORTER_VERSION,
		encoder: {
			format: 'webp',
			quality: 86,
			alphaQuality: 100,
			effort: 4,
			smartSubsample: true,
			metadata: 'stripped'
		},
		sourceAuthorities: {
			catalog: { path: CANONICAL_SKILL_CATALOG_PATH, contentHash: sha256(catalogBytes) },
			assetManifest: {
				path: CANONICAL_SKILL_ASSET_MANIFEST_PATH,
				contentHash: sha256(assetManifestBytes)
			}
		},
		records: generated.map((item) => item.record),
		summary: {
			skillCount: generated.length,
			assetCount: generated.length,
			totalBytes,
			managedDirectoryBytes: 0,
			maximumAssetBytes: WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES,
			maximumManagedDirectoryBytes: WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES
		}
	});
	return { manifest, generated };
}

async function listFiles(root: string, prefix = ''): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${relative}`);
		if (entry.isDirectory())
			files.push(...(await listFiles(path.join(root, entry.name), relative)));
		else if (entry.isFile()) files.push(relative);
		else throw new Error(`Unexpected output entry: ${relative}`);
	}
	return files.sort();
}

async function writeExclusive(destination: string, bytes: Buffer): Promise<void> {
	const handle = await open(destination, 'wx');
	try {
		await handle.writeFile(bytes);
	} finally {
		await handle.close();
	}
}

async function assertInventory(root: string, built: BuiltWikiSkillVisualCatalog): Promise<void> {
	const manifest = await formatManifest(built.manifest);
	const expected = ['manifest.json', ...built.generated.map((item) => item.record.file)].sort();
	const actual = await listFiles(root);
	if (JSON.stringify(actual) !== JSON.stringify(expected))
		throw new Error('Unexpected output file inventory');
	if (!(await readFile(path.join(root, 'manifest.json'))).equals(manifest))
		throw new Error('Stale manifest');
	for (const item of built.generated) {
		const current = await readFile(path.join(root, item.record.file));
		if (!current.equals(item.buffer))
			throw new Error(`Stale or changed derivative: ${item.record.file}`);
	}
}

export async function writeWikiSkillVisualCatalog(
	built: BuiltWikiSkillVisualCatalog,
	root = repositoryRoot
): Promise<void> {
	const outputRoot = inside(root, WIKI_SKILL_VISUAL_ROOT);
	await assertResolvedInside(root, outputRoot);
	await mkdir(path.dirname(outputRoot), { recursive: true });
	const stage = `${outputRoot}.staging-${process.pid}-${randomUUID()}`;
	const backup = `${outputRoot}.backup-${process.pid}-${randomUUID()}`;
	await mkdir(path.join(stage, 'icons'), { recursive: true });
	try {
		for (const item of built.generated)
			await writeExclusive(path.join(stage, item.record.file), item.buffer);
		await writeExclusive(path.join(stage, 'manifest.json'), await formatManifest(built.manifest));
		await assertInventory(stage, built);
		const existing = await lstat(outputRoot).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (existing) await rename(outputRoot, backup);
		try {
			await rename(stage, outputRoot);
		} catch (error) {
			if (existing) await rename(backup, outputRoot).catch(() => undefined);
			throw error;
		}
		if (existing) await rm(backup, { recursive: true });
	} catch (error) {
		await rm(stage, { recursive: true, force: true }).catch(() => undefined);
		throw error;
	}
}

export async function checkWikiSkillVisualCatalog(
	built: BuiltWikiSkillVisualCatalog,
	root = repositoryRoot
): Promise<void> {
	await assertInventory(inside(root, WIKI_SKILL_VISUAL_ROOT), built);
}
