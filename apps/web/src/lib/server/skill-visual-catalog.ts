import { createHash } from 'node:crypto';

import canonicalCatalogSource from '../../../../../assets/wiki/skills/icon-production-v1/catalog.json';
import massProductionManifestSource from '../../../../../assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
import runtimeManifestSource from '../../../static/wiki-media/skills/visual-catalog-v1/manifest.json';

const CATALOG_PATH = 'assets/wiki/skills/icon-production-v1/catalog.json';
const MASS_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const MASS_ICON_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons';
const PUBLIC_ROOT = '/wiki-media/skills/visual-catalog-v1/';
const PUBLIC_ICON_ROOT = `${PUBLIC_ROOT}icons/`;
const SKILL_COUNT = 456;

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
	readonly massProductionManifest: unknown;
	readonly runtimeManifest: unknown;
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
}

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as Record<string, unknown>;
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

function repositoryJsonHash(value: unknown): string {
	return createHash('sha256')
		.update(`${JSON.stringify(value, null, '\t')}\n`)
		.digest('hex');
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
	const record = object(value, 'runtime skill record');
	return {
		targetId: string(record.targetId, 'runtime target ID'),
		sourcePath: string(record.sourcePath, 'runtime source path'),
		sourceContentHash: hash(record.sourceContentHash, 'runtime source hash'),
		file: string(record.file, 'runtime file'),
		publicPath: string(record.publicPath, 'runtime public path'),
		width: literal(record.width, 512, 'runtime width'),
		height: literal(record.height, 512, 'runtime height')
	};
}

function authority(value: unknown, expectedPath: string, label: string): string {
	const source = object(value, label);
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
	massProductionManifest: massProductionManifestSource,
	runtimeManifest: runtimeManifestSource
};

export function buildSkillVisualCatalog(
	input: SkillVisualCatalogAuthorities = defaultAuthorities
): readonly SkillVisualCatalogRecord[] {
	const catalog = object(input.canonicalCatalog, 'canonical catalog');
	const mass = object(input.massProductionManifest, 'mass-production manifest');
	const runtime = object(input.runtimeManifest, 'runtime manifest');

	literal(catalog.schemaVersion, 'skill-icon-catalog-v1', 'canonical catalog schema');
	literal(
		mass.schemaVersion,
		'skill-icon-mass-production-manifest-v1',
		'mass-production manifest schema'
	);
	literal(mass.completionState, 'complete', 'mass-production completion state');
	literal(runtime.schemaVersion, 'wiki-skill-visual-catalog-v1', 'runtime manifest schema');

	const canonical = array(catalog.records, 'canonical records').map(canonicalRecord);
	const massRecords = array(mass.skills, 'mass-production skills').map(massRecord);
	const runtimeRecords = array(runtime.records, 'runtime records').map(runtimeRecord);
	unique(canonical, (record) => record.targetId, 'canonical target ID');
	unique(massRecords, (record) => record.targetId, 'mass-production target ID');
	unique(runtimeRecords, (record) => record.targetId, 'runtime target ID');
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

	const massAuthorities = object(mass.authorities, 'mass-production authorities');
	const massCatalogHash = authority(
		massAuthorities.catalog,
		CATALOG_PATH,
		'mass catalog authority'
	);
	const runtimeAuthorities = object(runtime.sourceAuthorities, 'runtime source authorities');
	const catalogHash = repositoryJsonHash(input.canonicalCatalog);
	const massManifestHash = repositoryJsonHash(input.massProductionManifest);
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
