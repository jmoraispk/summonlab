import visualIndexJson from '../../../../../docs/wiki/creatures/monsters/visual-index.json';
import runtimeCatalogJson from '../../../../../assets/enemies/runtime/monster-wiki-v1/catalog.json';

export type MonsterTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
export type MonsterAffinity = 'normal' | 'fire' | 'earth' | 'wind' | 'water';
export type MonsterProductionStatus =
	'planned' | 'planned-provisional-anchor' | 'blocked-on-anchor' | 'earth-bridge-provisional';
export type MonsterProductionPresentationStatus =
	| 'planned'
	| 'blocked-on-anchor'
	| 'candidate-only'
	| 'approved-review'
	| 'revision-required'
	| 'runtime';
export type MonsterCandidatePresentationStatus = 'candidate-only';
export type MonsterCurrentClassDisposition =
	'map' | 'rename-map' | 'secondary-archetype' | 'fauna' | 'retire';
export type MonsterVisualIndexSourceStatus = 'canonical-production-plan';
export type MonsterReconciliationSourceStatus = 'candidate-only-reference';

export const MONSTER_TIERS = [
	'T1',
	'T2',
	'T3',
	'T4',
	'T5'
] as const satisfies readonly MonsterTier[];
export const MONSTER_AFFINITIES = [
	'normal',
	'fire',
	'earth',
	'wind',
	'water'
] as const satisfies readonly MonsterAffinity[];
export const MONSTER_PRODUCTION_STATUSES = [
	'planned',
	'planned-provisional-anchor',
	'blocked-on-anchor',
	'earth-bridge-provisional'
] as const satisfies readonly MonsterProductionStatus[];
export const MONSTER_CURRENT_CLASS_DISPOSITIONS = [
	'map',
	'rename-map',
	'secondary-archetype',
	'fauna',
	'retire'
] as const satisfies readonly MonsterCurrentClassDisposition[];

export interface MonsterProductionVariant {
	affinity: MonsterAffinity;
	status: MonsterProductionStatus;
	presentationStatus: MonsterProductionPresentationStatus;
	targetId: string;
	targetPath: string;
	assignmentPath: string;
	candidatePath: string;
	resultPath: string;
	version: number;
	sourceContentHash: string | null;
	approvedPath?: string;
	runtimePath?: string;
	runtimePublicUrl?: string;
	contentHash?: string;
}

export interface MonsterProductionEntry {
	id: string;
	name: string;
	familyId: string;
	familyName: string;
	tier: MonsterTier;
	role: string;
	battlefieldDuty: string;
	teachingGoal: string;
	signatureMechanic: string | null;
	telegraph: string | null;
	counterplay: string | null;
	lowerFormInteraction: string | null;
	floorSlot: null;
	pagePath: string;
	variants: MonsterProductionVariant[];
}

export interface MonsterProductionFamily {
	familyId: string;
	displayName: string;
	sourceRaceNumber: number;
	sourcePage: string;
	classificationNotes: string;
	escalationAxis: string;
	visualConstants: string[];
	floorSlot: null;
	pagePath: string;
	formIds: string[];
}

export interface LegacyMonsterWikiRoute {
	currentClassId: string;
	disposition: MonsterCurrentClassDisposition;
	destination: string;
	statusCode: 308;
}

interface MonsterCandidateReference {
	affinity: MonsterAffinity;
	presentationStatus: MonsterCandidatePresentationStatus;
	candidatePath: string;
	contentHash: string;
}

interface MonsterReconciliationEntry {
	currentClassId: string;
	sourceFamilyLabel: string;
	disposition: MonsterCurrentClassDisposition;
	canonicalFamilyId: string | null;
	canonicalFormId: string | null;
	rationale: string;
	candidateReuseByAffinity: Record<MonsterAffinity, boolean>;
	references: MonsterCandidateReference[];
}

export interface MonsterVisualIndexV2 {
	schemaVersion: 'summonlab-monster-visual-index-v2';
	sourceStatus: MonsterVisualIndexSourceStatus;
	familyCount: 38;
	formCount: 190;
	coordinateCount: 950;
	currentClassCount: 40;
	affinities: readonly MonsterAffinity[];
	families: MonsterProductionFamily[];
	monsters: MonsterProductionEntry[];
	legacyRoutes: LegacyMonsterWikiRoute[];
	reconciliation: {
		sourceStatus: MonsterReconciliationSourceStatus;
		entries: MonsterReconciliationEntry[];
	};
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Invalid monster visual index ${label}`);
	}
	return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`Invalid monster visual index ${label}`);
	return value;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`Invalid monster visual index ${label}`);
	}
	return value;
}

function nullableString(value: unknown, label: string): string | null {
	if (value === null) return null;
	return string(value, label);
}

function boolean(value: unknown, label: string): boolean {
	if (typeof value !== 'boolean') {
		throw new Error(`Invalid monster visual index ${label}`);
	}
	return value;
}

function literal<T extends string | number>(
	value: unknown,
	allowed: readonly T[],
	label: string
): T {
	if (!allowed.includes(value as T)) {
		throw new Error(`Invalid monster visual index ${label}: ${String(value)}`);
	}
	return value as T;
}

function exactStringArray<T extends string>(
	value: unknown,
	expected: readonly T[],
	label: string
): readonly T[] {
	const values = array(value, label);
	if (
		values.length !== expected.length ||
		values.some((entry, index) => entry !== expected[index])
	) {
		throw new Error(`Invalid monster visual index ${label}`);
	}
	return values as T[];
}

export function parseMonsterVisualIndexV2(input: unknown): MonsterVisualIndexV2 {
	const root = record(input, 'root');
	literal(root.schemaVersion, ['summonlab-monster-visual-index-v2'] as const, 'schemaVersion');
	literal(root.sourceStatus, ['canonical-production-plan'] as const, 'sourceStatus');
	literal(root.familyCount, [38] as const, 'familyCount');
	literal(root.formCount, [190] as const, 'formCount');
	literal(root.coordinateCount, [950] as const, 'coordinateCount');
	literal(root.currentClassCount, [40] as const, 'currentClassCount');
	exactStringArray(root.affinities, MONSTER_AFFINITIES, 'affinities');

	const families = array(root.families, 'families');
	if (families.length !== 38) throw new Error('Invalid monster visual index family count');
	for (const [familyIndex, familyInput] of families.entries()) {
		const family = record(familyInput, `families[${familyIndex}]`);
		string(family.familyId, `families[${familyIndex}].familyId`);
		string(family.displayName, `families[${familyIndex}].displayName`);
		if (
			!Number.isInteger(family.sourceRaceNumber) ||
			Number(family.sourceRaceNumber) < 1 ||
			Number(family.sourceRaceNumber) > 38
		) {
			throw new Error(`Invalid monster visual index families[${familyIndex}].sourceRaceNumber`);
		}
		if (family.floorSlot !== null) {
			throw new Error(`Invalid monster visual index families[${familyIndex}].floorSlot`);
		}
		string(family.pagePath, `families[${familyIndex}].pagePath`);
		string(family.sourcePage, `families[${familyIndex}].sourcePage`);
		string(family.classificationNotes, `families[${familyIndex}].classificationNotes`);
		string(family.escalationAxis, `families[${familyIndex}].escalationAxis`);
		const visualConstants = array(
			family.visualConstants,
			`families[${familyIndex}].visualConstants`
		);
		if (visualConstants.length === 0) {
			throw new Error(`Invalid monster visual index families[${familyIndex}].visualConstants`);
		}
		for (const [constantIndex, constant] of visualConstants.entries()) {
			string(constant, `families[${familyIndex}].visualConstants[${constantIndex}]`);
		}
		const formIds = array(family.formIds, `families[${familyIndex}].formIds`);
		if (formIds.length !== 5) throw new Error('Invalid monster visual index family form count');
		for (const [formIndex, formId] of formIds.entries()) {
			string(formId, `families[${familyIndex}].formIds[${formIndex}]`);
		}
	}

	const monsters = array(root.monsters, 'monsters');
	if (monsters.length !== 190) throw new Error('Invalid monster visual index monster count');
	for (const [monsterIndex, monsterInput] of monsters.entries()) {
		const monster = record(monsterInput, `monsters[${monsterIndex}]`);
		for (const field of ['id', 'name', 'familyId', 'familyName', 'role', 'pagePath'] as const) {
			string(monster[field], `monsters[${monsterIndex}].${field}`);
		}
		for (const field of ['battlefieldDuty', 'teachingGoal'] as const) {
			string(monster[field], `monsters[${monsterIndex}].${field}`);
		}
		for (const field of [
			'signatureMechanic',
			'telegraph',
			'counterplay',
			'lowerFormInteraction'
		] as const) {
			nullableString(monster[field], `monsters[${monsterIndex}].${field}`);
		}
		literal(monster.tier, MONSTER_TIERS, `monster tier ${String(monster.tier)}`);
		if (monster.floorSlot !== null) {
			throw new Error(`Invalid monster visual index floorSlot: ${String(monster.floorSlot)}`);
		}
		const variants = array(monster.variants, `monsters[${monsterIndex}].variants`);
		if (variants.length !== 5) throw new Error('Invalid monster visual index variant count');
		for (const [variantIndex, variantInput] of variants.entries()) {
			const variant = record(variantInput, `variant ${variantIndex}`);
			literal(variant.affinity, MONSTER_AFFINITIES, 'variant affinity');
			literal(variant.status, MONSTER_PRODUCTION_STATUSES, 'variant status');
			literal(
				variant.presentationStatus,
				[
					'planned',
					'blocked-on-anchor',
					'candidate-only',
					'approved-review',
					'revision-required',
					'runtime'
				] as const,
				'variant presentationStatus'
			);
			for (const field of [
				'targetId',
				'targetPath',
				'assignmentPath',
				'candidatePath',
				'resultPath'
			] as const) {
				string(variant[field], `variant.${field}`);
			}
			nullableString(variant.sourceContentHash, 'variant.sourceContentHash');
			if (!Number.isInteger(variant.version) || Number(variant.version) < 1) {
				throw new Error(`Invalid monster visual index variant version: ${String(variant.version)}`);
			}
			if (variant.presentationStatus === 'runtime') {
				for (const field of [
					'approvedPath',
					'runtimePath',
					'runtimePublicUrl',
					'contentHash'
				] as const) {
					string(variant[field], `runtime variant.${field}`);
				}
			}
		}
	}

	const legacyRoutes = array(root.legacyRoutes, 'legacyRoutes');
	if (legacyRoutes.length !== 40)
		throw new Error('Invalid monster visual index legacy route count');
	for (const routeInput of legacyRoutes) {
		const route = record(routeInput, 'legacy route');
		string(route.currentClassId, 'legacy route currentClassId');
		literal(route.disposition, MONSTER_CURRENT_CLASS_DISPOSITIONS, 'legacy route disposition');
		string(route.destination, 'legacy route destination');
		literal(route.statusCode, [308] as const, 'legacy route statusCode');
	}

	const reconciliation = record(root.reconciliation, 'reconciliation');
	literal(
		reconciliation.sourceStatus,
		['candidate-only-reference'] as const,
		'reconciliation sourceStatus'
	);
	const reconciliationEntries = array(reconciliation.entries, 'reconciliation entries');
	if (reconciliationEntries.length !== 40) {
		throw new Error('Invalid monster visual index reconciliation count');
	}
	for (const entryInput of reconciliationEntries) {
		const entry = record(entryInput, 'reconciliation entry');
		string(entry.currentClassId, 'reconciliation currentClassId');
		string(entry.sourceFamilyLabel, 'reconciliation sourceFamilyLabel');
		string(entry.rationale, 'reconciliation rationale');
		literal(entry.disposition, MONSTER_CURRENT_CLASS_DISPOSITIONS, 'reconciliation disposition');
		nullableString(entry.canonicalFamilyId, 'reconciliation canonicalFamilyId');
		nullableString(entry.canonicalFormId, 'reconciliation canonicalFormId');
		const candidateReuseByAffinity = record(
			entry.candidateReuseByAffinity,
			'reconciliation candidateReuseByAffinity'
		);
		for (const affinity of MONSTER_AFFINITIES) {
			boolean(
				candidateReuseByAffinity[affinity],
				`reconciliation candidateReuseByAffinity.${affinity}`
			);
		}
		const references = array(entry.references, 'reconciliation references');
		for (const referenceInput of references) {
			const reference = record(referenceInput, 'candidate reference');
			literal(reference.affinity, MONSTER_AFFINITIES, 'candidate reference affinity');
			literal(
				reference.presentationStatus,
				['candidate-only'] as const,
				'candidate presentationStatus'
			);
			string(reference.candidatePath, 'candidate path');
			string(reference.contentHash, 'candidate contentHash');
		}
	}

	return input as MonsterVisualIndexV2;
}

const visualIndex = parseMonsterVisualIndexV2(visualIndexJson as unknown);
const productionByWikiId = new Map(
	visualIndex.monsters.map((monster) => [`monster.${monster.id}`, monster])
);
const legacyRedirectByCurrentClassId = new Map(
	visualIndex.legacyRoutes.map((route) => [route.currentClassId, route.destination])
);

type RuntimeCatalogRecord = {
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: MonsterAffinity;
	presentationStatus: MonsterProductionPresentationStatus;
	sourcePath: string;
	sourceSha256: string;
	delivery: 'generated' | 'reused';
	runtime: {
		path: string;
		publicUrl: string;
		sha256: string;
		width: number;
		height: number;
		bytes: number;
	};
};

type MonsterWikiVisualCatalogV1 = {
	schemaVersion: 'monster-wiki-visual-catalog-v1';
	exporterVersion: 'monster-wiki-visual-exporter-v1';
	familyCount: 38;
	formCount: 190;
	coordinateCount: 950;
	generatedCount: 750;
	reusedCount: 200;
	generatedBytes: number;
	records: RuntimeCatalogRecord[];
};

function positiveInteger(value: unknown, label: string): number {
	if (!Number.isInteger(value) || Number(value) < 1) {
		throw new Error(`Invalid monster wiki visual catalog ${label}`);
	}
	return Number(value);
}

export function parseMonsterWikiVisualCatalogV1(input: unknown): MonsterWikiVisualCatalogV1 {
	const root = record(input, 'wiki visual catalog root');
	literal(root.schemaVersion, ['monster-wiki-visual-catalog-v1'] as const, 'catalog schemaVersion');
	literal(
		root.exporterVersion,
		['monster-wiki-visual-exporter-v1'] as const,
		'catalog exporterVersion'
	);
	literal(root.familyCount, [38] as const, 'catalog familyCount');
	literal(root.formCount, [190] as const, 'catalog formCount');
	literal(root.coordinateCount, [950] as const, 'catalog coordinateCount');
	literal(root.generatedCount, [750] as const, 'catalog generatedCount');
	literal(root.reusedCount, [200] as const, 'catalog reusedCount');
	positiveInteger(root.generatedBytes, 'generatedBytes');
	const records = array(root.records, 'catalog records');
	if (records.length !== 950) throw new Error('Invalid monster wiki visual catalog record count');
	const coordinateIds = new Set<string>();
	for (const [index, inputRecord] of records.entries()) {
		const visual = record(inputRecord, `catalog records[${index}]`);
		const coordinateId = string(visual.coordinateId, `records[${index}].coordinateId`);
		if (coordinateIds.has(coordinateId)) {
			throw new Error(`Invalid monster wiki visual catalog duplicate ${coordinateId}`);
		}
		coordinateIds.add(coordinateId);
		string(visual.familyId, `records[${index}].familyId`);
		string(visual.formId, `records[${index}].formId`);
		literal(visual.affinity, MONSTER_AFFINITIES, `records[${index}].affinity`);
		literal(
			visual.presentationStatus,
			[
				'planned',
				'blocked-on-anchor',
				'candidate-only',
				'approved-review',
				'revision-required',
				'runtime'
			] as const,
			`records[${index}].presentationStatus`
		);
		string(visual.sourcePath, `records[${index}].sourcePath`);
		if (!/^[a-f0-9]{64}$/u.test(string(visual.sourceSha256, `records[${index}].sourceSha256`))) {
			throw new Error(`Invalid monster wiki visual catalog source hash ${coordinateId}`);
		}
		literal(visual.delivery, ['generated', 'reused'] as const, `records[${index}].delivery`);
		const runtime = record(visual.runtime, `records[${index}].runtime`);
		string(runtime.path, `records[${index}].runtime.path`);
		string(runtime.publicUrl, `records[${index}].runtime.publicUrl`);
		if (!/^[a-f0-9]{64}$/u.test(string(runtime.sha256, `records[${index}].runtime.sha256`))) {
			throw new Error(`Invalid monster wiki visual catalog runtime hash ${coordinateId}`);
		}
		positiveInteger(runtime.width, `records[${index}].runtime.width`);
		positiveInteger(runtime.height, `records[${index}].runtime.height`);
		positiveInteger(runtime.bytes, `records[${index}].runtime.bytes`);
	}
	return input as MonsterWikiVisualCatalogV1;
}

export interface MonsterVisualVariant extends MonsterProductionVariant {
	thumbnailPath: string;
	sourcePath: string;
	sourceHash: string;
	derivativeHash: string;
	width: number;
	height: number;
	bytes: number;
}

export interface MonsterVisualEntry extends Omit<MonsterProductionEntry, 'variants'> {
	variants: MonsterVisualVariant[];
}

export interface MonsterVisualFamily extends MonsterProductionFamily {
	forms: MonsterVisualEntry[];
}

function buildRuntimeVisuals(): {
	byWikiId: Map<string, MonsterVisualEntry>;
	families: MonsterVisualFamily[];
} {
	const catalog = parseMonsterWikiVisualCatalogV1(runtimeCatalogJson as unknown);
	const byCoordinate = new Map(catalog.records.map((entry) => [entry.coordinateId, entry]));
	const visuals = new Map<string, MonsterVisualEntry>();
	for (const monster of visualIndex.monsters) {
		const variants = monster.variants.map((variant) => {
			const runtime = byCoordinate.get(`${monster.familyId}/${monster.id}/${variant.affinity}`);
			if (
				!runtime ||
				runtime.familyId !== monster.familyId ||
				runtime.formId !== monster.id ||
				runtime.affinity !== variant.affinity ||
				runtime.presentationStatus !== variant.presentationStatus ||
				runtime.sourcePath !== (variant.approvedPath ?? variant.candidatePath) ||
				runtime.sourceSha256 !== variant.sourceContentHash
			) {
				throw new Error(`Invalid monster wiki runtime binding: ${monster.id}/${variant.affinity}`);
			}
			return {
				...variant,
				thumbnailPath: runtime.runtime.publicUrl,
				sourcePath: runtime.sourcePath,
				sourceHash: runtime.sourceSha256,
				derivativeHash: runtime.runtime.sha256,
				width: runtime.runtime.width,
				height: runtime.runtime.height,
				bytes: runtime.runtime.bytes
			};
		});
		visuals.set(`monster.${monster.id}`, { ...monster, variants });
	}
	if (visuals.size !== 190) throw new Error('Invalid monster wiki runtime visual form count');
	const families = visualIndex.families.map((family) => ({
		...family,
		forms: family.formIds.map((formId) => {
			const form = visuals.get(`monster.${formId}`);
			if (!form || form.familyId !== family.familyId) {
				throw new Error(`Invalid monster wiki family binding: ${family.familyId}/${formId}`);
			}
			return form;
		})
	}));
	return { byWikiId: visuals, families };
}

const runtimeVisuals = buildRuntimeVisuals();
// Reader presentation only: preserve canonical family identities and production order.
const featuredFamilyIds = [
	'giants',
	'orcs',
	'trolls',
	'harpies',
	'minotaurs',
	'golems',
	'treants',
	'dragons'
];
const laterFamilyIds = ['elementals', 'slimes', 'arachnids', 'wolves'];
const familyPosition = (familyId: string) => {
	const featured = featuredFamilyIds.indexOf(familyId);
	if (featured !== -1) return featured;
	const later = laterFamilyIds.indexOf(familyId);
	return later === -1 ? featuredFamilyIds.length : 100 + later;
};
const readerFamilies = runtimeVisuals.families.toSorted(
	(a, b) => familyPosition(a.familyId) - familyPosition(b.familyId)
);
const runtimeFamilyByWikiId = new Map(
	runtimeVisuals.families.map((family) => [`monster-family.${family.familyId}`, family])
);

export function getMonsterProductionDatabase(): readonly MonsterProductionEntry[] {
	return visualIndex.monsters;
}

export function getMonsterProductionEntry(wikiId: string): MonsterProductionEntry | null {
	return productionByWikiId.get(wikiId) ?? null;
}

export function getLegacyMonsterWikiRoutes(): readonly LegacyMonsterWikiRoute[] {
	return visualIndex.legacyRoutes;
}

export function getLegacyMonsterWikiRedirect(currentClassId: string): string | null {
	return legacyRedirectByCurrentClassId.get(currentClassId) ?? null;
}

export function getMonsterVisualDatabase(): readonly MonsterVisualFamily[] {
	return readerFamilies;
}

export function getMonsterFamilyVisualEntry(wikiId: string): MonsterVisualFamily | null {
	return runtimeFamilyByWikiId.get(wikiId) ?? null;
}

export function getMonsterVisualEntry(wikiId: string): MonsterVisualEntry | null {
	return runtimeVisuals.byWikiId.get(wikiId) ?? null;
}
