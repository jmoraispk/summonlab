import visualIndexJson from '../../../../../docs/wiki/creatures/monsters/visual-index.json';
import runtimeCatalogJson from '../../../../../assets/enemies/runtime/fauna-family-v1/catalog.json';

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
	floorSlot: null;
	pagePath: string;
	variants: MonsterProductionVariant[];
}

export interface MonsterProductionFamily {
	familyId: string;
	displayName: string;
	sourceRaceNumber: number;
	floorSlot: null;
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
	source: { path: string; sha256: string };
	runtime: {
		path: string;
		publicUrl: string;
		sha256: string;
		width: number;
		height: number;
	};
};

export interface MonsterVisualVariant extends MonsterProductionVariant {
	thumbnailPath: string;
	approvedPath: string;
	contentHash: string;
	width: number;
	height: number;
}

export interface MonsterVisualEntry extends Omit<MonsterProductionEntry, 'variants'> {
	variants: MonsterVisualVariant[];
}

function buildRuntimeVisuals(): Map<string, MonsterVisualEntry> {
	const catalog = record(runtimeCatalogJson as unknown, 'runtime catalog');
	literal(
		catalog.schemaVersion,
		['fauna-family-runtime-catalog-v1'] as const,
		'runtime catalog schemaVersion'
	);
	const records = array(catalog.records, 'runtime catalog records') as RuntimeCatalogRecord[];
	if (records.length !== 200) throw new Error('Invalid fauna runtime catalog record count');
	const byCoordinate = new Map(records.map((entry) => [entry.coordinateId, entry]));
	if (byCoordinate.size !== 200) throw new Error('Duplicate fauna runtime catalog coordinate');
	const visuals = new Map<string, MonsterVisualEntry>();
	for (const monster of visualIndex.monsters) {
		if (!monster.variants.every(({ presentationStatus }) => presentationStatus === 'runtime')) {
			continue;
		}
		const variants = monster.variants.map((variant) => {
			const runtime = byCoordinate.get(`${monster.familyId}/${monster.id}/${variant.affinity}`);
			if (
				!runtime ||
				runtime.familyId !== monster.familyId ||
				runtime.formId !== monster.id ||
				runtime.affinity !== variant.affinity ||
				runtime.source.path !== variant.approvedPath ||
				runtime.source.sha256 !== variant.contentHash ||
				runtime.runtime.path !== variant.runtimePath ||
				runtime.runtime.publicUrl !== variant.runtimePublicUrl ||
				!Number.isInteger(runtime.runtime.width) ||
				!Number.isInteger(runtime.runtime.height)
			) {
				throw new Error(`Invalid fauna runtime binding: ${monster.id}/${variant.affinity}`);
			}
			return {
				...variant,
				thumbnailPath: runtime.runtime.publicUrl,
				approvedPath: runtime.source.path,
				contentHash: runtime.source.sha256,
				width: runtime.runtime.width,
				height: runtime.runtime.height
			};
		});
		visuals.set(`monster.${monster.id}`, { ...monster, variants });
	}
	if (visuals.size !== 40) throw new Error('Invalid fauna runtime visual form count');
	return visuals;
}

const runtimeVisualByWikiId = buildRuntimeVisuals();

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

// The canonical v2 index contains ownership plans, not renderable pixels. Keep the former visual
// hooks disabled until reviewed candidate thumbnails exist so the route falls back to Markdown.
export function getMonsterVisualDatabase(): null {
	return null;
}

export function getMonsterVisualEntry(wikiId: string): MonsterVisualEntry | null {
	return runtimeVisualByWikiId.get(wikiId) ?? null;
}
