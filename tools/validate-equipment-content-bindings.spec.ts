import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { EQUIPMENT_DEFINITION_CATALOG } from '../packages/content/src/equipment.js';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	type EquipmentApprovedSourceManifestV1
} from './equipment-approved-source-contract.js';
import {
	EQUIPMENT_RUNTIME_MANIFEST_PATH,
	validateEquipmentContentBindings
} from './validate-equipment-content-bindings.js';

async function fixtureManifests(): Promise<{
	approvedManifest: EquipmentApprovedSourceManifestV1;
	runtimeManifest: Record<string, unknown> & { bundles: Record<string, unknown>[] };
}> {
	return {
		approvedManifest: JSON.parse(
			await readFile(EQUIPMENT_APPROVED_MANIFEST_PATH, 'utf8')
		) as EquipmentApprovedSourceManifestV1,
		runtimeManifest: JSON.parse(await readFile(EQUIPMENT_RUNTIME_MANIFEST_PATH, 'utf8')) as Record<
			string,
			unknown
		> & { bundles: Record<string, unknown>[] }
	};
}

describe('equipment content bindings', () => {
	it('binds 140 definitions one-to-one to approved sources and card/detail assets', async () => {
		const manifests = await fixtureManifests();
		expect(
			validateEquipmentContentBindings({
				catalog: EQUIPMENT_DEFINITION_CATALOG,
				...manifests
			})
		).toStrictEqual({
			contentVersion: 'equipment-content-v1',
			contentHash: EQUIPMENT_DEFINITION_CATALOG.contentHash,
			definitionCount: 140,
			approvedItemCount: 140,
			approvedReferenceCount: 21,
			runtimeBundleCount: 140,
			runtimeAssetCount: 280,
			status: 'valid'
		});
	});

	it('rejects an orphan approved item source', async () => {
		const manifests = await fixtureManifests();
		const approvedManifest = structuredClone(manifests.approvedManifest);
		const record = approvedManifest.records.find(({ role }) => role === 'item');
		expect(record).toBeDefined();
		record!.assetKey = 'equipment-v1-f-bronze-sword-orphan';
		expect(() =>
			validateEquipmentContentBindings({
				catalog: EQUIPMENT_DEFINITION_CATALOG,
				approvedManifest,
				runtimeManifest: manifests.runtimeManifest
			})
		).toThrow(/Approved item bindings mismatch/u);
	});

	it('rejects an orphan runtime bundle', async () => {
		const manifests = await fixtureManifests();
		const runtimeManifest = structuredClone(manifests.runtimeManifest);
		const bundle = runtimeManifest.bundles[0] as {
			name: string;
			sourceAssetKey: string;
			assets: Array<{ alias: string; usage: 'card' | 'detail'; sourceAssetKey: string }>;
		};
		bundle.name = 'equipment-v1-f-bronze-sword-orphan';
		bundle.sourceAssetKey = bundle.name;
		for (const asset of bundle.assets) {
			asset.sourceAssetKey = bundle.name;
			asset.alias = `equipment.${bundle.name}.${asset.usage}`;
		}
		expect(() =>
			validateEquipmentContentBindings({
				catalog: EQUIPMENT_DEFINITION_CATALOG,
				approvedManifest: manifests.approvedManifest,
				runtimeManifest
			})
		).toThrow(/Runtime bundle bindings mismatch/u);
	});

	it('rejects a stale content hash', async () => {
		const manifests = await fixtureManifests();
		expect(() =>
			validateEquipmentContentBindings({
				catalog: { ...EQUIPMENT_DEFINITION_CATALOG, contentHash: 'f'.repeat(64) },
				...manifests
			})
		).toThrow(/content hash is stale/u);
	});
});
