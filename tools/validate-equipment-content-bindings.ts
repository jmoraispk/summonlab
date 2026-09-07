import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	EquipmentDefinitionCatalogSchema,
	EquipmentRuntimeVisualManifestSchema,
	type EquipmentDefinitionCatalog,
	type EquipmentRuntimeVisualManifest
} from '../packages/contracts/src/index.js';
import { EQUIPMENT_DEFINITION_CATALOG } from '../packages/content/src/equipment.js';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	EquipmentApprovedSourceManifestV1Schema,
	type EquipmentApprovedSourceManifestV1
} from './equipment-approved-source-contract.js';

export const EQUIPMENT_RUNTIME_MANIFEST_PATH =
	'apps/web/static/runtime/equipment-v1/manifest.json' as const;

export type EquipmentContentBindingValidation = Readonly<{
	contentVersion: string;
	contentHash: string;
	definitionCount: number;
	approvedItemCount: number;
	approvedReferenceCount: number;
	runtimeBundleCount: number;
	runtimeAssetCount: number;
	status: 'valid';
}>;

function assertEqualSets(
	label: string,
	expected: ReadonlySet<string>,
	observed: ReadonlySet<string>
) {
	const missing = [...expected].filter((value) => !observed.has(value));
	const orphans = [...observed].filter((value) => !expected.has(value));
	if (missing.length > 0 || orphans.length > 0) {
		throw new Error(
			`${label} mismatch: missing [${missing.join(', ')}], orphan [${orphans.join(', ')}]`
		);
	}
}

export function validateEquipmentContentBindings(input: {
	catalog: unknown;
	approvedManifest: unknown;
	runtimeManifest: unknown;
}): EquipmentContentBindingValidation {
	const catalog: EquipmentDefinitionCatalog = EquipmentDefinitionCatalogSchema.parse(input.catalog);
	const approvedManifest: EquipmentApprovedSourceManifestV1 =
		EquipmentApprovedSourceManifestV1Schema.parse(input.approvedManifest);
	const runtimeManifest: EquipmentRuntimeVisualManifest =
		EquipmentRuntimeVisualManifestSchema.parse(input.runtimeManifest);

	const observedContentHash = createHash('sha256')
		.update(JSON.stringify(catalog.definitions))
		.digest('hex');
	if (observedContentHash !== catalog.contentHash) {
		throw new Error('Equipment definition catalog content hash is stale');
	}

	const approvedItems = approvedManifest.records.filter((record) => record.role === 'item');
	const approvedReferences = approvedManifest.records.filter(
		(record) => record.role === 'armor-set-reference'
	);
	const definitionKeys = new Set(
		catalog.definitions.map((definition) => definition.approvedVisualAssetKey)
	);
	const approvedKeys = new Set(approvedItems.map((record) => record.assetKey));
	const runtimeKeys = new Set(runtimeManifest.bundles.map((bundle) => bundle.sourceAssetKey));
	assertEqualSets('Approved item bindings', definitionKeys, approvedKeys);
	assertEqualSets('Runtime bundle bindings', definitionKeys, runtimeKeys);

	const approvedByKey = new Map(approvedItems.map((record) => [record.assetKey, record]));
	const runtimeByKey = new Map(
		runtimeManifest.bundles.map((bundle) => [bundle.sourceAssetKey, bundle])
	);
	for (const definition of catalog.definitions) {
		const approved = approvedByKey.get(definition.approvedVisualAssetKey);
		const runtime = runtimeByKey.get(definition.approvedVisualAssetKey);
		if (!approved || !runtime)
			throw new Error(`Missing visual binding for ${definition.definitionId}`);

		const approvedSlot = ['head', 'torso', 'legs', 'boots'].includes(definition.slot)
			? definition.slot
			: null;
		if (
			approved.materialId !== definition.materialId ||
			approved.rank !== definition.materialRank ||
			approved.equipmentClass !== definition.equipmentClass ||
			approved.slot !== approvedSlot
		) {
			throw new Error(`Approved metadata drift for ${definition.definitionId}`);
		}

		const card = runtime.assets.find(({ usage }) => usage === 'card');
		const detail = runtime.assets.find(({ usage }) => usage === 'detail');
		if (
			card?.alias !== definition.runtimeCardAlias ||
			detail?.alias !== definition.runtimeDetailAlias ||
			card.sourceApprovedPath !== approved.approvedPath ||
			detail.sourceApprovedPath !== approved.approvedPath ||
			card.sourceContentHash !== approved.approved.sha256 ||
			detail.sourceContentHash !== approved.approved.sha256
		) {
			throw new Error(`Runtime visual drift for ${definition.definitionId}`);
		}
	}

	return Object.freeze({
		contentVersion: catalog.contentVersion,
		contentHash: catalog.contentHash,
		definitionCount: catalog.definitions.length,
		approvedItemCount: approvedItems.length,
		approvedReferenceCount: approvedReferences.length,
		runtimeBundleCount: runtimeManifest.bundles.length,
		runtimeAssetCount: runtimeManifest.bundles.flatMap(({ assets }) => assets).length,
		status: 'valid' as const
	});
}

async function loadJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
}

export async function validateRepositoryEquipmentContentBindings(): Promise<EquipmentContentBindingValidation> {
	return validateEquipmentContentBindings({
		catalog: EQUIPMENT_DEFINITION_CATALOG,
		approvedManifest: await loadJson(EQUIPMENT_APPROVED_MANIFEST_PATH),
		runtimeManifest: await loadJson(EQUIPMENT_RUNTIME_MANIFEST_PATH)
	});
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === resolve(import.meta.filename)) {
	const result = await validateRepositoryEquipmentContentBindings();
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
