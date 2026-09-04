import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import canonicalCatalogSource from '../../../../../assets/wiki/skills/icon-production-v1/catalog.json';
import canonicalCatalogRaw from '../../../../../assets/wiki/skills/icon-production-v1/catalog.json?raw';
import massProductionManifestSource from '../../../../../assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
import massProductionManifestRaw from '../../../../../assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json?raw';
import runtimeManifestSource from '../../../static/wiki-media/skills/visual-catalog-v1/manifest.json';
import runtimeManifestRaw from '../../../static/wiki-media/skills/visual-catalog-v1/manifest.json?raw';

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v1/catalog.json';
const MASS_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const MASS_ICON_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons';
const PUBLIC_ROOT = '/wiki-media/skills/visual-catalog-v1/';
const PUBLIC_ICON_ROOT = `${PUBLIC_ROOT}icons/`;
const SKILL_COUNT = 456;
const DOMAIN_COUNTS = { Martial: 258, Magical: 124, Craft: 74 } as const;
const RUNTIME_EXPORTER_VERSION = 'wiki-skill-visual-catalog-exporter-v1';
const MAXIMUM_ASSET_BYTES = 133_120;
const MAXIMUM_MANAGED_DIRECTORY_BYTES = 44_040_192;

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
		readonly status: 'candidate';
		readonly sourcePath: string;
		readonly runtimePath: string;
	};
}

export interface SkillVisualCatalogAuthorities {
	readonly canonicalCatalog: unknown;
	readonly canonicalCatalogBytes: Uint8Array;
	readonly massProductionManifest: unknown;
	readonly massProductionManifestBytes: Uint8Array;
	readonly runtimeManifest: unknown;
	readonly runtimeManifestBytes: Uint8Array;
}

interface CanonicalRecord {
	readonly targetId: string;
	readonly name: string;
	readonly domain: SkillDomain;
	readonly family: string;
	readonly labels: readonly { readonly namespace: SkillLabelNamespace; readonly value: string }[];
	readonly rarity: string;
	readonly type: SkillType;
	readonly acquisition: string;
	readonly effect: string;
	readonly motifFamily: string;
	readonly primaryVisualParent: string | null;
}

interface MassRecord {
	readonly targetId: string;
	readonly slug: string;
	readonly name: string;
	readonly domain: SkillDomain;
	readonly family: string;
	readonly motifFamily: string;
	readonly rarity: string;
	readonly primaryVisualParent: string | null;
	readonly status: 'candidate';
	readonly finalImagePath: string;
	readonly finalImageHash: string;
}

interface RuntimeRecord {
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

interface RuntimeSummary {
	readonly skillCount: 456;
	readonly assetCount: 456;
	readonly totalBytes: number;
	readonly managedDirectoryBytes: number;
	readonly maximumAssetBytes: 133_120;
	readonly maximumManagedDirectoryBytes: 44_040_192;
}

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as Record<string, unknown>;
}

function exactObject(
	value: unknown,
	label: string,
	expectedKeys: readonly string[]
): Record<string, unknown> {
	const source = object(value, label);
	const actualKeys = Object.keys(source).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();
	if (!isDeepStrictEqual(actualKeys, sortedExpectedKeys)) {
		throw new Error(`Invalid ${label} fields`);
	}
	return source;
}

function array(value: unknown, label: string): readonly unknown[] {
	if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
	return value;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`);
	return value;
}

function literal<T extends string | number | boolean>(
	value: unknown,
	expected: T,
	label: string
): T {
	if (value !== expected) throw new Error(`Invalid ${label}`);
	return expected;
}

function positiveInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		throw new Error(`Invalid ${label}`);
	}
	return value as number;
}

function domain(value: unknown, label: string): SkillDomain {
	if (value === 'Martial' || value === 'Magical' || value === 'Craft') return value;
	throw new Error(`Invalid ${label} Domain`);
}

function skillType(value: unknown, label: string): SkillType {
	switch (value) {
		case 'A':
			return 'Active';
		case 'P':
			return 'Passive';
		case 'St':
			return 'Stance';
		case 'C':
			return 'Craft';
		default:
			throw new Error(`Invalid ${label} type`);
	}
}

function label(value: unknown): {
	readonly namespace: SkillLabelNamespace;
	readonly value: string;
} {
	const source = object(value, 'canonical label');
	const namespace = source.namespace;
	if (namespace !== 'Equipment' && namespace !== 'Element') {
		throw new Error('Invalid canonical label namespace');
	}
	return { namespace, value: string(source.value, 'canonical label value') };
}

function nullableString(value: unknown, label: string): string | null {
	return value === null ? null : string(value, label);
}

function hash(value: unknown, label: string): string {
	const candidate = string(value, label);
	if (!/^[a-f0-9]{64}$/u.test(candidate)) throw new Error(`Invalid ${label}`);
	return candidate;
}

function rawContentHash(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function parseRawJson(value: Uint8Array, label: string): unknown {
	try {
		return JSON.parse(new TextDecoder().decode(value)) as unknown;
	} catch {
		throw new Error(`Invalid ${label} raw bytes`);
	}
}

function assertMatchesRawBytes(supplied: unknown, raw: unknown, label: string): void {
	if (!isDeepStrictEqual(supplied, raw)) {
		throw new Error(`${label} does not match its raw bytes`);
	}
}

function unique<T>(records: readonly T[], identifier: (record: T) => string, label: string): void {
	const seen = new Set<string>();
	for (const record of records) {
		const id = identifier(record);
		if (seen.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
		seen.add(id);
	}
}

function canonicalRecord(value: unknown): CanonicalRecord {
	const record = object(value, 'canonical skill record');
	const rarity = string(record.rarity, 'canonical rarity');
	if (!['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(rarity)) {
		throw new Error('Invalid canonical rarity');
	}
	return {
		targetId: string(record.targetId, 'canonical target ID'),
		name: string(record.name, 'canonical name'),
		domain: domain(record.domain, 'canonical'),
		family: string(record.family, 'canonical family'),
		labels: array(record.labels, 'canonical labels').map(label),
		rarity,
		type: skillType(record.type, 'canonical'),
		acquisition: string(record.requires, 'canonical acquisition'),
		effect: string(record.effect, 'canonical effect'),
		motifFamily: string(record.motifFamily ?? record.mapEntryId, 'canonical motif family'),
		primaryVisualParent: nullableString(
			record.primaryVisualParent,
			'canonical primary visual parent'
		)
	};
}

function massRecord(value: unknown): MassRecord {
	const record = object(value, 'mass-production skill record');
	const rarity = string(record.rarity, 'mass-production rarity');
	if (!['F', 'E', 'D', 'C', 'B', 'A', 'S'].includes(rarity)) {
		throw new Error('Invalid mass-production rarity');
	}
	return {
		targetId: string(record.targetId, 'mass-production target ID'),
		slug: string(record.slug, 'mass-production slug'),
		name: string(record.name, 'mass-production name'),
		domain: domain(record.domain, 'mass-production'),
		family: string(record.family, 'mass-production family'),
		motifFamily: string(record.motifFamily, 'mass-production motif family'),
		rarity,
		primaryVisualParent: nullableString(
			record.primaryVisualParent,
			'mass-production primary visual parent'
		),
		status: literal(record.status, 'candidate', 'mass-production status'),
		finalImagePath: string(record.finalImagePath, 'mass-production final image path'),
		finalImageHash: hash(record.finalImageHash, 'mass-production final image hash')
	};
}

function runtimeRecord(value: unknown): RuntimeRecord {
	const record = exactObject(value, 'runtime skill record', [
		'targetId',
		'sourcePath',
		'sourceContentHash',
		'file',
		'publicPath',
		'width',
		'height',
		'bytes',
		'contentHash'
	]);
	return {
		targetId: string(record.targetId, 'runtime target ID'),
		sourcePath: string(record.sourcePath, 'runtime source path'),
		sourceContentHash: hash(record.sourceContentHash, 'runtime source hash'),
		file: string(record.file, 'runtime file'),
		publicPath: string(record.publicPath, 'runtime public path'),
		width: literal(record.width, 512, 'runtime width'),
		height: literal(record.height, 512, 'runtime height'),
		bytes: positiveInteger(record.bytes, 'runtime bytes'),
		contentHash: hash(record.contentHash, 'runtime content hash')
	};
}

function runtimeSummary(value: unknown): RuntimeSummary {
	const summary = exactObject(value, 'runtime summary', [
		'skillCount',
		'assetCount',
		'totalBytes',
		'managedDirectoryBytes',
		'maximumAssetBytes',
		'maximumManagedDirectoryBytes'
	]);
	return {
		skillCount: literal(summary.skillCount, SKILL_COUNT, 'runtime summary skill count'),
		assetCount: literal(summary.assetCount, SKILL_COUNT, 'runtime summary asset count'),
		totalBytes: positiveInteger(summary.totalBytes, 'runtime summary total bytes'),
		managedDirectoryBytes: positiveInteger(
			summary.managedDirectoryBytes,
			'runtime summary managed directory bytes'
		),
		maximumAssetBytes: literal(
			summary.maximumAssetBytes,
			MAXIMUM_ASSET_BYTES,
			'runtime maximum asset bytes'
		),
		maximumManagedDirectoryBytes: literal(
			summary.maximumManagedDirectoryBytes,
			MAXIMUM_MANAGED_DIRECTORY_BYTES,
			'runtime maximum managed directory bytes'
		)
	};
}

function authority(value: unknown, expectedPath: string, label: string): string {
	const source = exactObject(value, label, ['path', 'contentHash']);
	if (string(source.path, `${label} path`) !== expectedPath) {
		throw new Error(`Invalid ${label} path`);
	}
	return hash(source.contentHash, `${label} hash`);
}

function assertCanonicalMatchesMass(canonical: CanonicalRecord, mass: MassRecord): void {
	for (const field of [
		'name',
		'domain',
		'family',
		'motifFamily',
		'rarity',
		'primaryVisualParent'
	] as const) {
		if (canonical[field] !== mass[field]) {
			throw new Error(`Canonical/mass ${field} mismatch for ${canonical.targetId}`);
		}
	}
	if (
		!new RegExp(`^${MASS_ICON_ROOT}/[a-z0-9-]+\\.png$`, 'u').test(mass.finalImagePath) ||
		mass.finalImagePath !== `${MASS_ICON_ROOT}/${mass.slug}.png`
	) {
		throw new Error(`Invalid mass-production source path: ${mass.finalImagePath}`);
	}
}

function freezeRecord(record: SkillVisualCatalogRecord): SkillVisualCatalogRecord {
	for (const item of record.labels) Object.freeze(item);
	Object.freeze(record.labels);
	if (record.primaryVisualParent) Object.freeze(record.primaryVisualParent);
	Object.freeze(record.image);
	Object.freeze(record.provenance);
	return Object.freeze(record);
}

const defaultAuthorities: SkillVisualCatalogAuthorities = {
	canonicalCatalog: canonicalCatalogSource,
	canonicalCatalogBytes: new TextEncoder().encode(canonicalCatalogRaw),
	massProductionManifest: massProductionManifestSource,
	massProductionManifestBytes: new TextEncoder().encode(massProductionManifestRaw),
	runtimeManifest: runtimeManifestSource,
	runtimeManifestBytes: new TextEncoder().encode(runtimeManifestRaw)
};

export function buildSkillVisualCatalog(
	input: SkillVisualCatalogAuthorities = defaultAuthorities
): readonly SkillVisualCatalogRecord[] {
	const rawCatalog = parseRawJson(input.canonicalCatalogBytes, 'canonical catalog');
	const rawMass = parseRawJson(input.massProductionManifestBytes, 'mass-production manifest');
	const rawRuntime = parseRawJson(input.runtimeManifestBytes, 'runtime manifest');
	assertMatchesRawBytes(input.canonicalCatalog, rawCatalog, 'Canonical catalog');
	assertMatchesRawBytes(input.massProductionManifest, rawMass, 'Mass-production manifest');
	assertMatchesRawBytes(input.runtimeManifest, rawRuntime, 'Runtime manifest');
	const catalog = object(rawCatalog, 'canonical catalog');
	const mass = object(rawMass, 'mass-production manifest');
	const runtime = exactObject(rawRuntime, 'runtime manifest', [
		'schemaVersion',
		'exporterVersion',
		'encoder',
		'sourceAuthorities',
		'records',
		'summary'
	]);

	literal(catalog.schemaVersion, 'skill-icon-catalog-v1', 'canonical catalog schema');
	literal(
		mass.schemaVersion,
		'skill-icon-mass-production-manifest-v1',
		'mass-production manifest schema'
	);
	literal(mass.completionState, 'complete', 'mass-production completion state');
	literal(runtime.schemaVersion, 'wiki-skill-visual-catalog-v1', 'runtime manifest schema');
	literal(runtime.exporterVersion, RUNTIME_EXPORTER_VERSION, 'runtime exporter version');
	const encoder = exactObject(runtime.encoder, 'runtime encoder', [
		'format',
		'quality',
		'alphaQuality',
		'effort',
		'smartSubsample',
		'metadata'
	]);
	literal(encoder.format, 'webp', 'runtime encoder format');
	literal(encoder.quality, 86, 'runtime encoder quality');
	literal(encoder.alphaQuality, 100, 'runtime encoder alpha quality');
	literal(encoder.effort, 4, 'runtime encoder effort');
	literal(encoder.smartSubsample, true, 'runtime encoder smart subsampling');
	literal(encoder.metadata, 'stripped', 'runtime encoder metadata');

	const canonical = array(catalog.records, 'canonical records').map(canonicalRecord);
	const massRecords = array(mass.skills, 'mass-production skills').map(massRecord);
	const runtimeRecords = array(runtime.records, 'runtime records').map(runtimeRecord);
	unique(canonical, (record) => record.targetId, 'canonical target ID');
	unique(massRecords, (record) => record.targetId, 'mass-production target ID');
	unique(runtimeRecords, (record) => record.targetId, 'runtime target ID');
	for (let index = 1; index < runtimeRecords.length; index += 1) {
		if (runtimeRecords[index - 1]!.targetId.localeCompare(runtimeRecords[index]!.targetId) >= 0) {
			throw new Error('Invalid runtime record order');
		}
	}
	const canonicalByTargetId = new Map(canonical.map((record) => [record.targetId, record]));
	for (const record of canonical) {
		if (record.primaryVisualParent && !canonicalByTargetId.has(record.primaryVisualParent)) {
			throw new Error(`Unresolved primary visual parent: ${record.primaryVisualParent}`);
		}
	}
	if (canonical.length !== SKILL_COUNT) {
		throw new Error(`Expected ${SKILL_COUNT} canonical records; got ${canonical.length}`);
	}
	if (massRecords.length !== SKILL_COUNT) {
		throw new Error(`Expected ${SKILL_COUNT} mass-production records; got ${massRecords.length}`);
	}
	if (runtimeRecords.length !== SKILL_COUNT) {
		throw new Error(`Expected ${SKILL_COUNT} runtime records; got ${runtimeRecords.length}`);
	}
	const summary = runtimeSummary(runtime.summary);
	const runtimeTotalBytes = runtimeRecords.reduce((total, record) => total + record.bytes, 0);
	if (runtimeTotalBytes !== summary.totalBytes) {
		throw new Error('Runtime total bytes do not match record bytes');
	}
	if (runtimeRecords.some((record) => record.bytes > summary.maximumAssetBytes)) {
		throw new Error('Runtime record exceeds maximum asset bytes');
	}
	if (
		summary.managedDirectoryBytes !==
		summary.totalBytes + input.runtimeManifestBytes.byteLength
	) {
		throw new Error('Runtime managed directory bytes do not include the exact manifest bytes');
	}
	if (summary.managedDirectoryBytes > summary.maximumManagedDirectoryBytes) {
		throw new Error('Runtime managed directory exceeds maximum managed directory bytes');
	}
	const actualDomainCounts = Object.fromEntries(
		(Object.keys(DOMAIN_COUNTS) as SkillDomain[]).map((expectedDomain) => [
			expectedDomain,
			canonical.filter((record) => record.domain === expectedDomain).length
		])
	) as Record<SkillDomain, number>;
	for (const [expectedDomain, expectedCount] of Object.entries(DOMAIN_COUNTS) as [
		SkillDomain,
		number
	][]) {
		if (actualDomainCounts[expectedDomain] !== expectedCount) {
			throw new Error(
				`Invalid canonical domain count for ${expectedDomain}: expected ${expectedCount}; got ${actualDomainCounts[expectedDomain]}`
			);
		}
	}

	const massAuthorities = object(mass.authorities, 'mass-production authorities');
	const massCatalogHash = authority(
		massAuthorities.catalog,
		CATALOG_PATH,
		'mass catalog authority'
	);
	const runtimeAuthorities = exactObject(runtime.sourceAuthorities, 'runtime source authorities', [
		'catalog',
		'massProductionManifest'
	]);
	const catalogHash = rawContentHash(input.canonicalCatalogBytes);
	const massManifestHash = rawContentHash(input.massProductionManifestBytes);
	if (massCatalogHash !== catalogHash) {
		throw new Error('Mass-production catalog source hash mismatch');
	}
	if (
		authority(runtimeAuthorities.catalog, CATALOG_PATH, 'runtime catalog authority') !== catalogHash
	) {
		throw new Error('Runtime catalog source hash mismatch');
	}
	if (
		authority(
			runtimeAuthorities.massProductionManifest,
			MASS_MANIFEST_PATH,
			'runtime mass-production authority'
		) !== massManifestHash
	) {
		throw new Error('Runtime mass-production source hash mismatch');
	}

	const massByTargetId = new Map(massRecords.map((record) => [record.targetId, record]));
	const runtimeByTargetId = new Map(runtimeRecords.map((record) => [record.targetId, record]));

	const records = canonical.map((record) => {
		const massRecord = massByTargetId.get(record.targetId);
		if (!massRecord) throw new Error(`Missing mass-production record: ${record.targetId}`);
		assertCanonicalMatchesMass(record, massRecord);
		const runtimeRecord = runtimeByTargetId.get(record.targetId);
		if (!runtimeRecord) throw new Error(`Missing runtime record: ${record.targetId}`);
		if (
			runtimeRecord.sourcePath !== massRecord.finalImagePath ||
			runtimeRecord.sourceContentHash !== massRecord.finalImageHash
		) {
			throw new Error(`Runtime source hash mismatch for ${record.targetId}`);
		}
		const expectedFile = `icons/${massRecord.slug}.${massRecord.finalImageHash.slice(0, 12)}.webp`;
		if (runtimeRecord.file !== expectedFile) {
			throw new Error(`Runtime file mismatch for ${record.targetId}`);
		}
		if (
			!runtimeRecord.publicPath.startsWith(PUBLIC_ICON_ROOT) ||
			runtimeRecord.publicPath !== `${PUBLIC_ROOT}${runtimeRecord.file}`
		) {
			throw new Error(`Runtime public path mismatch for ${record.targetId}`);
		}
		const parent = record.primaryVisualParent
			? canonicalByTargetId.get(record.primaryVisualParent)
			: null;
		if (record.primaryVisualParent && !parent) {
			throw new Error(`Unresolved primary visual parent: ${record.primaryVisualParent}`);
		}
		return freezeRecord({
			targetId: record.targetId,
			name: record.name,
			domain: record.domain,
			family: record.family,
			labels: record.labels.map((item) => ({ ...item })),
			type: record.type,
			acquisition: record.acquisition,
			effect: record.effect,
			motifFamily: record.motifFamily,
			primaryVisualParent: parent ? { targetId: parent.targetId, name: parent.name } : null,
			image: {
				publicPath: runtimeRecord.publicPath,
				width: runtimeRecord.width,
				height: runtimeRecord.height
			},
			provenance: {
				status: massRecord.status,
				sourcePath: massRecord.finalImagePath,
				runtimePath: runtimeRecord.file
			}
		});
	});

	return Object.freeze(records);
}

const skillVisualCatalog = buildSkillVisualCatalog();

export function getSkillVisualCatalog(): readonly SkillVisualCatalogRecord[] {
	return skillVisualCatalog;
}
