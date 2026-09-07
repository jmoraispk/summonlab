import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

export const CANONICAL_SKILL_ROOT = 'assets/wiki/skills/icon-production-v2' as const;
export const CANONICAL_SKILL_CATALOG_PATH = `${CANONICAL_SKILL_ROOT}/catalog.json` as const;
export const CANONICAL_SKILL_ASSET_MANIFEST_PATH =
	`${CANONICAL_SKILL_ROOT}/asset-manifest.json` as const;
export const SKILL_RARITIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

type SkillRarity = (typeof SKILL_RARITIES)[number];

export interface HashedAsset {
	readonly path: string;
	readonly contentHash: string;
}

export interface CanonicalSkillInterior {
	readonly targetId: string;
	readonly slug: string;
	readonly interiorPath: string;
	readonly contentHash: string;
}

export interface CanonicalSkillFrame extends HashedAsset {
	readonly rarity: SkillRarity;
}

interface StoredCanonicalSkillAssets {
	readonly schemaVersion: 'skill-icon-canonical-assets-v1';
	readonly approvalPolicy: 'owner-approved-before-promotion';
	readonly sourcePolicy: 'exact-frameless-source';
	readonly catalog: HashedAsset;
	readonly composition: {
		readonly canvasSize: 1024;
		readonly layerOrder: readonly ['backing', 'interior', 'rarity-frame'];
		readonly interiorTransform: 'identity';
	};
	readonly backing: HashedAsset;
	readonly geometry: HashedAsset;
	readonly geometryGuide: HashedAsset;
	readonly frames: readonly CanonicalSkillFrame[];
	readonly records: readonly CanonicalSkillInterior[];
	readonly summary: {
		readonly skillCount: number;
		readonly interiorCount: number;
		readonly frameCount: number;
	};
}

export interface CanonicalSkillAssets extends Omit<StoredCanonicalSkillAssets, 'composition'> {
	readonly canvasSize: 1024;
	readonly layerOrder: readonly ['backing', 'interior', 'rarity-frame'];
	readonly interiorTransform: 'identity';
}

interface CatalogRecord {
	readonly targetId: string;
	readonly rarity: SkillRarity;
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function isHash(value: unknown): value is string {
	return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function slugFor(targetId: string): string {
	const slug = targetId.replaceAll(':', '-');
	if (!/^[a-z0-9-]+$/u.test(slug)) throw new Error(`Invalid canonical target ID: ${targetId}`);
	return slug;
}

function resolveInside(root: string, relativePath: string): string {
	if (path.isAbsolute(relativePath))
		throw new Error(`Asset path must be relative: ${relativePath}`);
	const resolved = path.resolve(root, relativePath);
	const relative = path.relative(root, resolved);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
		throw new Error(`Asset path escapes repository: ${relativePath}`);
	}
	return resolved;
}

async function regularFile(root: string, relativePath: string): Promise<Buffer> {
	const absolute = resolveInside(root, relativePath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Expected regular canonical asset: ${relativePath}`);
	}
	return readFile(absolute);
}

async function hashedAsset(root: string, relativePath: string): Promise<HashedAsset> {
	const bytes = await regularFile(root, relativePath);
	return { path: relativePath, contentHash: sha256(bytes) };
}

async function assertPng(root: string, asset: HashedAsset, label: string): Promise<void> {
	const bytes = await regularFile(root, asset.path);
	if (sha256(bytes) !== asset.contentHash) throw new Error(`${label} hash drift: ${asset.path}`);
	const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== 1024 ||
		metadata.height !== 1024 ||
		metadata.channels !== 4 ||
		!metadata.hasAlpha
	) {
		throw new Error(`${label} must be a 1024px RGBA PNG: ${asset.path}`);
	}
}

async function assertExactInventory(
	root: string,
	relativeDirectory: string,
	expectedNames: readonly string[]
): Promise<void> {
	const directory = resolveInside(root, relativeDirectory);
	const entries = await readdir(directory, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || entry.isSymbolicLink()) {
			throw new Error(`Unexpected canonical asset entry: ${relativeDirectory}/${entry.name}`);
		}
	}
	const actual = entries.map((entry) => entry.name).sort();
	const expected = [...expectedNames].sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(`Canonical asset inventory drift: ${relativeDirectory}`);
	}
}

async function readCatalog(root: string): Promise<{
	bytes: Buffer;
	records: readonly CatalogRecord[];
}> {
	const bytes = await regularFile(root, CANONICAL_SKILL_CATALOG_PATH);
	const parsed = JSON.parse(bytes.toString('utf8')) as {
		schemaVersion?: unknown;
		records?: unknown;
	};
	if (parsed.schemaVersion !== 'skill-icon-catalog-v1' || !Array.isArray(parsed.records)) {
		throw new Error('Invalid unified skill icon catalog');
	}
	const records = parsed.records.map((value) => {
		const record = value as { targetId?: unknown; rarity?: unknown };
		if (
			typeof record.targetId !== 'string' ||
			!SKILL_RARITIES.includes(record.rarity as SkillRarity)
		) {
			throw new Error('Invalid unified skill icon catalog record');
		}
		return { targetId: record.targetId, rarity: record.rarity as SkillRarity };
	});
	if (records.length === 0) throw new Error('Unified skill catalog must not be empty');
	if (new Set(records.map((record) => record.targetId)).size !== records.length) {
		throw new Error('Duplicate unified skill target ID');
	}
	return { bytes, records };
}

export async function buildCanonicalSkillAssets(
	root = repositoryRoot
): Promise<StoredCanonicalSkillAssets> {
	const catalog = await readCatalog(root);
	const expectedInteriorNames = catalog.records.map(({ targetId }) => `${slugFor(targetId)}.png`);
	const expectedFrameNames = SKILL_RARITIES.map(
		(rarity) => `rarity-frame-${rarity.toLowerCase()}.png`
	);
	await Promise.all([
		assertExactInventory(root, `${CANONICAL_SKILL_ROOT}/interiors`, expectedInteriorNames),
		assertExactInventory(root, `${CANONICAL_SKILL_ROOT}/frames`, expectedFrameNames)
	]);
	const records = await Promise.all(
		[...catalog.records]
			.sort((left, right) => left.targetId.localeCompare(right.targetId))
			.map(async ({ targetId }) => {
				const slug = slugFor(targetId);
				const interior = await hashedAsset(root, `${CANONICAL_SKILL_ROOT}/interiors/${slug}.png`);
				return {
					targetId,
					slug,
					interiorPath: interior.path,
					contentHash: interior.contentHash
				};
			})
	);
	const frames = await Promise.all(
		SKILL_RARITIES.map(async (rarity) => ({
			rarity,
			...(await hashedAsset(
				root,
				`${CANONICAL_SKILL_ROOT}/frames/rarity-frame-${rarity.toLowerCase()}.png`
			))
		}))
	);
	return {
		schemaVersion: 'skill-icon-canonical-assets-v1',
		approvalPolicy: 'owner-approved-before-promotion',
		sourcePolicy: 'exact-frameless-source',
		catalog: { path: CANONICAL_SKILL_CATALOG_PATH, contentHash: sha256(catalog.bytes) },
		composition: {
			canvasSize: 1024,
			layerOrder: ['backing', 'interior', 'rarity-frame'],
			interiorTransform: 'identity'
		},
		backing: await hashedAsset(root, `${CANONICAL_SKILL_ROOT}/backing.png`),
		geometry: await hashedAsset(root, `${CANONICAL_SKILL_ROOT}/geometry.json`),
		geometryGuide: await hashedAsset(root, `${CANONICAL_SKILL_ROOT}/geometry-guide.png`),
		frames,
		records,
		summary: {
			skillCount: catalog.records.length,
			interiorCount: records.length,
			frameCount: frames.length
		}
	};
}

async function formattedManifest(manifest: StoredCanonicalSkillAssets): Promise<string> {
	const destination = path.resolve(repositoryRoot, CANONICAL_SKILL_ASSET_MANIFEST_PATH);
	const config = await resolveConfig(destination, { useCache: false });
	return format(JSON.stringify(manifest), { ...config, filepath: destination, parser: 'json' });
}

export async function writeCanonicalSkillAssets(root = repositoryRoot): Promise<void> {
	const manifest = await buildCanonicalSkillAssets(root);
	await writeFile(
		resolveInside(root, CANONICAL_SKILL_ASSET_MANIFEST_PATH),
		await formattedManifest(manifest)
	);
}

export async function loadCanonicalSkillAssets(
	root = repositoryRoot
): Promise<CanonicalSkillAssets> {
	const stored = await readPromotedCanonicalSkillAssets(root);
	const built = await buildCanonicalSkillAssets(root);
	if (JSON.stringify(stored) !== JSON.stringify(built)) {
		throw new Error('Canonical skill asset manifest is stale');
	}
	return flattenComposition(stored);
}

function flattenComposition(stored: StoredCanonicalSkillAssets): CanonicalSkillAssets {
	return {
		...stored,
		canvasSize: stored.composition.canvasSize,
		layerOrder: stored.composition.layerOrder,
		interiorTransform: stored.composition.interiorTransform
	};
}

async function readPromotedCanonicalSkillAssets(root: string): Promise<StoredCanonicalSkillAssets> {
	const raw = await regularFile(root, CANONICAL_SKILL_ASSET_MANIFEST_PATH);
	const stored = JSON.parse(raw.toString('utf8')) as StoredCanonicalSkillAssets;
	if (
		stored.schemaVersion !== 'skill-icon-canonical-assets-v1' ||
		stored.approvalPolicy !== 'owner-approved-before-promotion' ||
		stored.sourcePolicy !== 'exact-frameless-source' ||
		stored.composition?.canvasSize !== 1024 ||
		stored.composition.interiorTransform !== 'identity' ||
		JSON.stringify(stored.composition.layerOrder) !==
			JSON.stringify(['backing', 'interior', 'rarity-frame']) ||
		!Array.isArray(stored.records) ||
		!Array.isArray(stored.frames)
	) {
		throw new Error('Invalid canonical skill asset manifest');
	}
	if (!isHash(stored.catalog.contentHash)) throw new Error('Invalid canonical catalog hash');
	await Promise.all([
		assertExactInventory(
			root,
			`${CANONICAL_SKILL_ROOT}/interiors`,
			stored.records.map((record) => `${record.slug}.png`)
		),
		assertExactInventory(
			root,
			`${CANONICAL_SKILL_ROOT}/frames`,
			stored.frames.map((frame) => path.basename(frame.path))
		)
	]);
	await Promise.all([
		assertPng(root, stored.backing, 'Canonical backing'),
		...stored.frames.map((frame) => assertPng(root, frame, `Canonical ${frame.rarity} frame`)),
		...stored.records.map((record) =>
			assertPng(
				root,
				{ path: record.interiorPath, contentHash: record.contentHash },
				`Canonical ${record.targetId} interior`
			)
		)
	]);
	return stored;
}

export async function loadPromotedCanonicalSkillAssets(
	root = repositoryRoot
): Promise<CanonicalSkillAssets> {
	return flattenComposition(await readPromotedCanonicalSkillAssets(root));
}

export async function checkCanonicalSkillAssets(root = repositoryRoot): Promise<void> {
	await loadCanonicalSkillAssets(root);
}
