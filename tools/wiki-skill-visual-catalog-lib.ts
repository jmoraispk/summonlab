import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import sharp from 'sharp';

export const WIKI_SKILL_VISUAL_ROOT =
	'apps/web/static/wiki-media/skills/visual-catalog-v1' as const;
export const WIKI_SKILL_VISUAL_MANIFEST_PATH = `${WIKI_SKILL_VISUAL_ROOT}/manifest.json` as const;
export const WIKI_SKILL_VISUAL_EXPORTER_VERSION = 'wiki-skill-visual-catalog-exporter-v1' as const;
export const WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES = 133_120 as const;
export const WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES = 44_040_192 as const;

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v1/catalog.json';
const MASS_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const MASS_ICON_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons';
const WORKER_COUNT = 12;

export type WikiSkillVisualExportMode = 'write' | 'check';

export interface WikiSkillVisualRuntimeRecord {
	readonly targetId: string;
	readonly sourcePath: string;
	readonly sourceContentHash: string;
	readonly file: string;
	readonly publicPath: string;
	readonly width: 512;
	readonly height: 512;
	readonly bytes: number;
	readonly contentHash: string;
}

export interface WikiSkillVisualRuntimeManifest {
	readonly schemaVersion: 'wiki-skill-visual-catalog-v1';
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
		readonly massProductionManifest: { readonly path: string; readonly contentHash: string };
	};
	readonly records: readonly WikiSkillVisualRuntimeRecord[];
	readonly summary: {
		readonly skillCount: number;
		readonly assetCount: number;
		readonly totalBytes: number;
		readonly maximumAssetBytes: typeof WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES;
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

interface CanonicalRecord {
	readonly targetId: string;
	readonly name: string;
	readonly domain: string;
	readonly family: string;
	readonly rarity: string;
	readonly motifFamily: string;
}

interface MassRecord extends CanonicalRecord {
	readonly slug: string;
	readonly finalImagePath: string;
	readonly finalImageHash: string;
}

interface Authorities {
	readonly workspaceRoot: string;
	readonly catalogPath: string;
	readonly massManifestPath: string;
	readonly expectedSkillCount: number;
}

function sha256(value: Uint8Array | string): string {
	return createHash('sha256').update(value).digest('hex');
}

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string') throw new Error(`Invalid ${label}`);
	return value;
}

function array(value: unknown, label: string): readonly unknown[] {
	if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
	return value;
}

function canonicalRecord(value: unknown): CanonicalRecord {
	const record = object(value, 'canonical skill record');
	const motifFamily = record.motifFamily ?? record.mapEntryId;
	return {
		targetId: string(record.targetId, 'canonical targetId'),
		name: string(record.name, 'canonical name'),
		domain: string(record.domain, 'canonical domain'),
		family: string(record.family, 'canonical family'),
		rarity: string(record.rarity, 'canonical rarity'),
		motifFamily: string(motifFamily, 'canonical motif family')
	};
}

function massRecord(value: unknown): MassRecord {
	const record = object(value, 'mass-production skill record');
	return {
		...canonicalRecord(record),
		slug: string(record.slug, 'mass-production slug'),
		finalImagePath: string(record.finalImagePath, 'mass-production final image path'),
		finalImageHash: string(record.finalImageHash, 'mass-production final image hash')
	};
}

function assertUnique<T>(
	records: readonly T[],
	identifier: (record: T) => string,
	label: string
): void {
	const seen = new Set<string>();
	for (const record of records) {
		const id = identifier(record);
		if (seen.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
		seen.add(id);
	}
}

function workspacePath(root: string, relativePath: string, label: string): string {
	if (path.isAbsolute(relativePath)) throw new Error(`${label} must be workspace-relative`);
	const absolute = path.resolve(root, relativePath);
	const relative = path.relative(root, absolute);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
		throw new Error(`${label} escapes workspace: ${relativePath}`);
	}
	return absolute;
}

function isContained(root: string, target: string): boolean {
	const relative = path.relative(root, target);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function assertResolvedContainment(
	workspaceRoot: string,
	absolutePath: string,
	label: string
): Promise<void> {
	const canonicalRoot = await realpath(workspaceRoot);
	let probe = absolutePath;
	while (true) {
		try {
			const resolved = await realpath(probe);
			if (!isContained(canonicalRoot, resolved)) {
				throw new Error(`${label} escapes workspace through a symbolic link: ${absolutePath}`);
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

async function readRegularFile(root: string, relativePath: string, label: string): Promise<Buffer> {
	const absolute = workspacePath(root, relativePath, label);
	await assertResolvedContainment(root, absolute, label);
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile())
		throw new Error(`Expected regular file: ${relativePath}`);
	return readFile(absolute);
}

function assertMassPath(record: MassRecord): void {
	if (!/^[a-z0-9-]+$/u.test(record.slug)) throw new Error(`Invalid output slug: ${record.slug}`);
	const expected = `${MASS_ICON_ROOT}/${record.slug}.png`;
	if (record.finalImagePath !== expected) {
		throw new Error(`Source path outside mass-production icons: ${record.finalImagePath}`);
	}
}

async function mapConcurrent<T, U>(
	values: readonly T[],
	mapper: (value: T) => Promise<U>
): Promise<U[]> {
	const result = new Array<U>(values.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(WORKER_COUNT, values.length) }, async () => {
			while (next < values.length) {
				const index = next++;
				result[index] = await mapper(values[index]!);
			}
		})
	);
	return result;
}

function assertMatched(canonical: CanonicalRecord, mass: MassRecord): void {
	for (const field of ['name', 'domain', 'family', 'rarity', 'motifFamily'] as const) {
		if (canonical[field] !== mass[field]) {
			throw new Error(`Canonical/mass ${field} mismatch for ${canonical.targetId}`);
		}
	}
}

async function formatManifest(manifest: WikiSkillVisualRuntimeManifest): Promise<Buffer> {
	return Buffer.from(
		await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100, tabWidth: 2 }),
		'utf8'
	);
}

export async function assertWikiSkillVisualDerivative(
	data: Buffer,
	targetId: string
): Promise<void> {
	const decoded = await sharp(data, { failOn: 'error' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (
		decoded.info.width !== 512 ||
		decoded.info.height !== 512 ||
		decoded.info.channels !== 4 ||
		decoded.data.byteLength !== 512 * 512 * 4
	) {
		throw new Error(`Invalid decoded WebP derivative geometry or alpha for ${targetId}`);
	}
}

function outputPath(record: WikiSkillVisualRuntimeRecord): string {
	return `${WIKI_SKILL_VISUAL_ROOT}/${record.file}`;
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

async function writeExclusive(destination: string, bytes: Buffer, sync = false): Promise<void> {
	const handle = await open(destination, 'wx');
	try {
		await handle.writeFile(bytes);
		if (sync) await handle.sync();
	} finally {
		await handle.close();
	}
}

async function assertBuiltInventory(
	root: string,
	built: BuiltWikiSkillVisualCatalog,
	manifestBytes?: Buffer
): Promise<void> {
	const actual = await listFiles(root);
	const expected = ['manifest.json', ...built.generated.map(({ record }) => record.file)].sort();
	if (actual.length !== expected.length || actual.some((file, index) => file !== expected[index])) {
		throw new Error('Unexpected output file inventory');
	}
	const totalBytes = built.generated.reduce((total, asset) => total + asset.buffer.byteLength, 0);
	if (
		totalBytes !== built.manifest.summary.totalBytes ||
		totalBytes > WIKI_SKILL_VISUAL_MAXIMUM_TOTAL_BYTES
	) {
		throw new Error('Runtime output exceeds total budget');
	}
	if (manifestBytes && !(await readFile(path.join(root, 'manifest.json'))).equals(manifestBytes)) {
		throw new Error('Stale manifest');
	}
}

export async function buildWikiSkillVisualCatalogFromAuthorities(
	authorities: Authorities
): Promise<BuiltWikiSkillVisualCatalog> {
	const root = path.resolve(authorities.workspaceRoot);
	const catalogBytes = await readRegularFile(root, authorities.catalogPath, 'canonical catalog');
	const massBytes = await readRegularFile(
		root,
		authorities.massManifestPath,
		'mass-production manifest'
	);
	const catalog = object(JSON.parse(catalogBytes.toString('utf8')) as unknown, 'canonical catalog');
	const mass = object(
		JSON.parse(massBytes.toString('utf8')) as unknown,
		'mass-production manifest'
	);
	if (catalog.schemaVersion !== 'skill-icon-catalog-v1') {
		throw new Error('Invalid canonical skill catalog schema');
	}
	if (mass.schemaVersion !== 'skill-icon-mass-production-manifest-v1') {
		throw new Error('Invalid skill mass-production manifest schema');
	}
	const canonical = array(catalog.records, 'canonical records').map(canonicalRecord);
	const massSkills = array(mass.skills, 'mass-production skills').map(massRecord);
	if (mass.completionState !== 'complete' || massSkills.length !== authorities.expectedSkillCount) {
		throw new Error('Skill mass-production inventory is incomplete');
	}
	if (canonical.length !== authorities.expectedSkillCount) {
		throw new Error(
			`Expected ${authorities.expectedSkillCount} canonical skills; got ${canonical.length}`
		);
	}
	assertUnique(canonical, (record) => record.targetId, 'canonical target ID');
	assertUnique(massSkills, (record) => record.targetId, 'mass-production target ID');
	const massByTargetId = new Map(massSkills.map((record) => [record.targetId, record]));
	const sorted = [...canonical].sort((left, right) => left.targetId.localeCompare(right.targetId));
	const generated = await mapConcurrent(sorted, async (record) => {
		const massRecord = massByTargetId.get(record.targetId);
		if (!massRecord) throw new Error(`Missing mass-production skill: ${record.targetId}`);
		assertMatched(record, massRecord);
		assertMassPath(massRecord);
		const sourceBytes = await readRegularFile(root, massRecord.finalImagePath, 'skill icon source');
		const sourceContentHash = sha256(sourceBytes);
		if (sourceContentHash !== massRecord.finalImageHash) {
			throw new Error(`Source hash drift for ${record.targetId}`);
		}
		const sourceMetadata = await sharp(sourceBytes, { failOn: 'error' }).metadata();
		if (sourceMetadata.width !== 1024 || sourceMetadata.height !== 1024) {
			throw new Error(`Expected 1024×1024 RGBA source: ${massRecord.finalImagePath}`);
		}
		if (sourceMetadata.channels !== 4 || !sourceMetadata.hasAlpha) {
			throw new Error(`Expected RGBA source with alpha: ${massRecord.finalImagePath}`);
		}
		const { data } = await sharp(sourceBytes, { failOn: 'error' })
			.resize(512, 512, { fit: 'fill' })
			.webp({ quality: 86, alphaQuality: 100, effort: 4, smartSubsample: true })
			.toBuffer({ resolveWithObject: true });
		await assertWikiSkillVisualDerivative(data, record.targetId);
		if (data.byteLength > WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES) {
			throw new Error(`Derivative exceeds byte budget for ${record.targetId}`);
		}
		const file = `icons/${massRecord.slug}.${sourceContentHash.slice(0, 12)}.webp`;
		const runtimeRecord: WikiSkillVisualRuntimeRecord = {
			targetId: record.targetId,
			sourcePath: massRecord.finalImagePath,
			sourceContentHash,
			file,
			publicPath: `/wiki-media/skills/visual-catalog-v1/${file}`,
			width: 512,
			height: 512,
			bytes: data.byteLength,
			contentHash: sha256(data)
		};
		return { record: runtimeRecord, buffer: data };
	});
	const records = generated.map(({ record }) => record);
	const totalBytes = records.reduce((total, record) => total + record.bytes, 0);
	const manifest: WikiSkillVisualRuntimeManifest = {
		schemaVersion: 'wiki-skill-visual-catalog-v1',
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
			catalog: { path: authorities.catalogPath, contentHash: sha256(catalogBytes) },
			massProductionManifest: { path: authorities.massManifestPath, contentHash: sha256(massBytes) }
		},
		records,
		summary: {
			skillCount: records.length,
			assetCount: records.length,
			totalBytes,
			maximumAssetBytes: WIKI_SKILL_VISUAL_MAXIMUM_ASSET_BYTES
		}
	};
	return { manifest, generated };
}

export async function buildWikiSkillVisualCatalog(
	workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
): Promise<BuiltWikiSkillVisualCatalog> {
	return buildWikiSkillVisualCatalogFromAuthorities({
		workspaceRoot,
		catalogPath: CATALOG_PATH,
		massManifestPath: MASS_MANIFEST_PATH,
		expectedSkillCount: 456
	});
}

export async function writeWikiSkillVisualCatalog(
	built: BuiltWikiSkillVisualCatalog,
	workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
): Promise<void> {
	const outputRoot = workspacePath(workspaceRoot, WIKI_SKILL_VISUAL_ROOT, 'managed output root');
	await assertResolvedContainment(workspaceRoot, outputRoot, 'managed output root');
	const outputParent = path.dirname(outputRoot);
	await mkdir(outputParent, { recursive: true });
	const stage = `${outputRoot}.staging-${process.pid}-${randomUUID()}`;
	const backup = `${outputRoot}.backup-${process.pid}-${randomUUID()}`;
	await assertResolvedContainment(workspaceRoot, stage, 'managed staging root');
	await assertResolvedContainment(workspaceRoot, backup, 'managed backup root');
	await mkdir(stage, { recursive: false });
	try {
		await mkdir(path.join(stage, 'icons'), { recursive: false });
		for (const { record, buffer } of built.generated) {
			await writeExclusive(path.join(stage, record.file), buffer);
		}
		const manifestBytes = await formatManifest(built.manifest);
		await writeExclusive(path.join(stage, 'manifest.json'), manifestBytes, true);
		await assertBuiltInventory(stage, built, manifestBytes);
		const existing = await lstat(outputRoot).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
			throw new Error('Managed output root must be a non-symbolic-link directory');
		}
		let backedUp = false;
		try {
			if (existing) {
				await rename(outputRoot, backup);
				backedUp = true;
			}
			await rename(stage, outputRoot);
		} catch (error) {
			if (backedUp) await rename(backup, outputRoot).catch(() => undefined);
			throw error;
		}
		if (backedUp) await rm(backup, { recursive: true, force: false });
	} catch (error) {
		await rm(stage, { recursive: true, force: true }).catch(() => undefined);
		throw error;
	}
}

export async function checkWikiSkillVisualCatalog(
	built: BuiltWikiSkillVisualCatalog,
	workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
): Promise<void> {
	const outputRoot = workspacePath(workspaceRoot, WIKI_SKILL_VISUAL_ROOT, 'managed output root');
	await assertResolvedContainment(workspaceRoot, outputRoot, 'managed output root');
	const metadata = await lstat(outputRoot);
	if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
		throw new Error('Managed output root must be a non-symbolic-link directory');
	}
	const expectedManifest = await formatManifest(built.manifest);
	await assertBuiltInventory(outputRoot, built, expectedManifest);
	for (const { record, buffer } of built.generated) {
		const current = await readRegularFile(workspaceRoot, outputPath(record), 'derived skill icon');
		if (!current.equals(buffer)) throw new Error(`Stale or changed derivative: ${record.file}`);
	}
}
