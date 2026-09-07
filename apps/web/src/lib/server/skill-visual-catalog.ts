import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import canonicalCatalogSource from '../../../../../assets/wiki/skills/icon-production-v2/catalog.json';
import canonicalCatalogRaw from '../../../../../assets/wiki/skills/icon-production-v2/catalog.json?raw';
import canonicalAssetsSource from '../../../../../assets/wiki/skills/icon-production-v2/asset-manifest.json';
import canonicalAssetsRaw from '../../../../../assets/wiki/skills/icon-production-v2/asset-manifest.json?raw';
import runtimeManifestSource from '../../../static/wiki-media/skills/visual-catalog-v2/manifest.json';
import runtimeManifestRaw from '../../../static/wiki-media/skills/visual-catalog-v2/manifest.json?raw';

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v2/catalog.json';
const ASSET_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v2/asset-manifest.json';
const PUBLIC_ROOT = '/wiki-media/skills/visual-catalog-v2/';
const RUNTIME_EXPORTER_VERSION = 'wiki-skill-visual-catalog-exporter-v2';
const MAXIMUM_ASSET_BYTES = 170_000;
const MAXIMUM_MANAGED_DIRECTORY_BYTES = 60_000_000;

type SkillDomain = 'Martial' | 'Magical' | 'Craft';
type SkillType = 'Active' | 'Passive' | 'Stance' | 'Craft';
type SkillLabelNamespace = 'Equipment' | 'Element';

export interface SkillVisualCatalogRecord {
	readonly targetId: string;
	readonly name: string;
	readonly domain: SkillDomain;
	readonly family: string;
	readonly labels: readonly { readonly namespace: SkillLabelNamespace; readonly value: string }[];
	readonly type: SkillType;
	readonly acquisition: string;
	readonly effect: string;
	readonly motifFamily: string;
	readonly primaryVisualParent: { readonly targetId: string; readonly name: string } | null;
	readonly image: { readonly publicPath: string; readonly width: 512; readonly height: 512 };
	readonly provenance: {
		readonly status: 'approved';
		readonly sourcePath: string;
		readonly runtimePath: string;
	};
}

export interface SkillVisualCatalogAuthorities {
	readonly canonicalCatalog: unknown;
	readonly canonicalCatalogBytes: Uint8Array;
	readonly canonicalAssets: unknown;
	readonly canonicalAssetsBytes: Uint8Array;
	readonly runtimeManifest: unknown;
	readonly runtimeManifestBytes: Uint8Array;
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as JsonObject;
}

function array(value: unknown, label: string): readonly unknown[] {
	if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
	return value;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`);
	return value;
}

function integer(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`Invalid ${label}`);
	return value as number;
}

function hash(value: unknown, label: string): string {
	const result = string(value, label);
	if (!/^[a-f0-9]{64}$/u.test(result)) throw new Error(`Invalid ${label}`);
	return result;
}

function sha256(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function parsedBytes(bytes: Uint8Array, label: string): unknown {
	try {
		return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
	} catch {
		throw new Error(`Invalid ${label} bytes`);
	}
}

function assertRaw(value: unknown, bytes: Uint8Array, label: string): JsonObject {
	const raw = parsedBytes(bytes, label);
	if (!isDeepStrictEqual(value, raw)) throw new Error(`${label} does not match raw bytes`);
	return object(raw, label);
}

function domain(value: unknown): SkillDomain {
	if (value === 'Martial' || value === 'Magical' || value === 'Craft') return value;
	throw new Error('Invalid canonical Domain');
}

function skillType(value: unknown): SkillType {
	if (value === 'A') return 'Active';
	if (value === 'P') return 'Passive';
	if (value === 'St') return 'Stance';
	if (value === 'C') return 'Craft';
	throw new Error('Invalid canonical type');
}

function labels(value: unknown): { namespace: SkillLabelNamespace; value: string }[] {
	return array(value, 'canonical labels').map((item) => {
		const source = object(item, 'canonical label');
		if (source.namespace !== 'Equipment' && source.namespace !== 'Element') {
			throw new Error('Invalid canonical label namespace');
		}
		return { namespace: source.namespace, value: string(source.value, 'canonical label value') };
	});
}

function authority(value: unknown, expectedPath: string, label: string): string {
	const source = object(value, label);
	if (source.path !== expectedPath) throw new Error(`Invalid ${label} path`);
	return hash(source.contentHash, `${label} hash`);
}

function unique<T>(items: readonly T[], id: (item: T) => string, label: string): void {
	const seen = new Set<string>();
	for (const item of items) {
		const value = id(item);
		if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
		seen.add(value);
	}
}

const defaultAuthorities: SkillVisualCatalogAuthorities = {
	canonicalCatalog: canonicalCatalogSource,
	canonicalCatalogBytes: new TextEncoder().encode(canonicalCatalogRaw),
	canonicalAssets: canonicalAssetsSource,
	canonicalAssetsBytes: new TextEncoder().encode(canonicalAssetsRaw),
	runtimeManifest: runtimeManifestSource,
	runtimeManifestBytes: new TextEncoder().encode(runtimeManifestRaw)
};

export function buildSkillVisualCatalog(
	input: SkillVisualCatalogAuthorities = defaultAuthorities
): readonly SkillVisualCatalogRecord[] {
	const catalog = assertRaw(
		input.canonicalCatalog,
		input.canonicalCatalogBytes,
		'Canonical catalog'
	);
	const assets = assertRaw(input.canonicalAssets, input.canonicalAssetsBytes, 'Canonical assets');
	const runtime = assertRaw(input.runtimeManifest, input.runtimeManifestBytes, 'Runtime manifest');
	if (catalog.schemaVersion !== 'skill-icon-catalog-v1')
		throw new Error('Invalid canonical catalog schema');
	if (assets.schemaVersion !== 'skill-icon-canonical-assets-v1')
		throw new Error('Invalid canonical asset schema');
	if (runtime.schemaVersion !== 'wiki-skill-visual-catalog-v2')
		throw new Error('Invalid runtime manifest schema');
	if (runtime.exporterVersion !== RUNTIME_EXPORTER_VERSION)
		throw new Error('Invalid runtime exporter version');

	const canonical = array(catalog.records, 'canonical records').map((item) =>
		object(item, 'canonical record')
	);
	const interiors = array(assets.records, 'canonical interiors').map((item) =>
		object(item, 'canonical interior')
	);
	const runtimeRecords = array(runtime.records, 'runtime records').map((item) =>
		object(item, 'runtime record')
	);
	if (
		canonical.length === 0 ||
		interiors.length !== canonical.length ||
		runtimeRecords.length !== canonical.length
	) {
		throw new Error('Canonical, interior, and runtime record counts must agree');
	}
	unique(canonical, (item) => string(item.targetId, 'canonical target ID'), 'canonical target ID');
	unique(interiors, (item) => string(item.targetId, 'interior target ID'), 'interior target ID');
	unique(runtimeRecords, (item) => string(item.targetId, 'runtime target ID'), 'runtime target ID');

	const summary = object(runtime.summary, 'runtime summary');
	if (summary.skillCount !== canonical.length || summary.assetCount !== canonical.length) {
		throw new Error('Invalid runtime summary skill count');
	}
	if (
		summary.maximumAssetBytes !== MAXIMUM_ASSET_BYTES ||
		summary.maximumManagedDirectoryBytes !== MAXIMUM_MANAGED_DIRECTORY_BYTES
	) {
		throw new Error('Invalid runtime maximum budget');
	}
	const totalBytes = runtimeRecords.reduce(
		(total, record) => total + integer(record.bytes, 'runtime bytes'),
		0
	);
	if (summary.totalBytes !== totalBytes) throw new Error('Invalid runtime total bytes');
	if (summary.managedDirectoryBytes !== totalBytes + input.runtimeManifestBytes.byteLength) {
		throw new Error('Invalid runtime managed directory bytes');
	}

	const sources = object(runtime.sourceAuthorities, 'runtime source authorities');
	if (
		authority(sources.catalog, CATALOG_PATH, 'runtime catalog authority') !==
		sha256(input.canonicalCatalogBytes)
	) {
		throw new Error('Runtime catalog source hash mismatch');
	}
	if (
		authority(sources.assetManifest, ASSET_MANIFEST_PATH, 'runtime asset authority') !==
		sha256(input.canonicalAssetsBytes)
	) {
		throw new Error('Runtime asset source hash mismatch');
	}
	if (
		authority(assets.catalog, CATALOG_PATH, 'asset catalog authority') !==
		sha256(input.canonicalCatalogBytes)
	) {
		throw new Error('Canonical asset catalog hash mismatch');
	}

	const interiorById = new Map(
		interiors.map((record) => [string(record.targetId, 'interior target ID'), record])
	);
	const runtimeById = new Map(
		runtimeRecords.map((record) => [string(record.targetId, 'runtime target ID'), record])
	);
	const canonicalById = new Map(
		canonical.map((record) => [string(record.targetId, 'canonical target ID'), record])
	);
	const result = canonical.map((record): SkillVisualCatalogRecord => {
		const targetId = string(record.targetId, 'canonical target ID');
		const skillDomain = domain(record.domain);
		const interior = interiorById.get(targetId);
		const runtimeRecord = runtimeById.get(targetId);
		if (!interior || !runtimeRecord)
			throw new Error(`Missing canonical visual record: ${targetId}`);
		const sourcePath = string(interior.interiorPath, 'interior path');
		const sourceHash = hash(interior.contentHash, 'interior hash');
		if (runtimeRecord.sourcePath !== sourcePath || runtimeRecord.sourceContentHash !== sourceHash) {
			throw new Error(`Runtime source mismatch for ${targetId}`);
		}
		const publicPath = string(runtimeRecord.publicPath, 'runtime public path');
		const file = string(runtimeRecord.file, 'runtime file');
		if (publicPath !== `${PUBLIC_ROOT}${file}` || !file.startsWith('icons/')) {
			throw new Error(`Invalid runtime public path for ${targetId}`);
		}
		const parentId =
			record.primaryVisualParent === null
				? null
				: string(record.primaryVisualParent, 'visual parent');
		const parent = parentId ? canonicalById.get(parentId) : null;
		if (parentId && !parent) throw new Error(`Unresolved primary visual parent: ${parentId}`);
		const output: SkillVisualCatalogRecord = {
			targetId,
			name: string(record.name, 'canonical name'),
			domain: skillDomain,
			family: string(record.family, 'canonical family'),
			labels: labels(record.labels),
			type: skillType(record.type),
			acquisition: string(record.requires, 'canonical acquisition'),
			effect: string(record.effect, 'canonical effect'),
			motifFamily: string(record.motifFamily ?? record.mapEntryId, 'canonical motif family'),
			primaryVisualParent: parent
				? { targetId: parentId!, name: string(parent.name, 'parent name') }
				: null,
			image: { publicPath, width: 512, height: 512 },
			provenance: { status: 'approved', sourcePath, runtimePath: file }
		};
		Object.freeze(output.labels);
		if (output.primaryVisualParent) Object.freeze(output.primaryVisualParent);
		Object.freeze(output.image);
		Object.freeze(output.provenance);
		return Object.freeze(output);
	});
	return Object.freeze(result);
}

const skillVisualCatalog = buildSkillVisualCatalog();

export function getSkillVisualCatalog(): readonly SkillVisualCatalogRecord[] {
	return skillVisualCatalog;
}
