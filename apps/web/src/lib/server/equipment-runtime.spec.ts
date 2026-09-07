import { createBootstrapEngine } from '@summonlab/engine';
import { describe, expect, it } from 'vitest';

import approvedSourceManifest from '../../../../../assets/equipment/approved/material-equipment-v1/manifest.json';
import runtimeVisualManifest from '../../../static/runtime/equipment-v1/manifest.json';
import {
	projectEquipmentWorkshop,
	resolveEquipmentVisual,
	type EquipmentApprovedSourceManifest
} from './equipment-runtime.js';
import { hashPublicProjection } from './public-projection-hash.js';

function equipmentSnapshot() {
	return createBootstrapEngine({
		runId: '00000000-0000-4000-8000-000000000024',
		seed: 'equipment-workshop-projection',
		heroId: '00000000-0000-4000-8000-000000000124',
		manifestHash: 'a'.repeat(64),
		developmentEquipmentScenario: {
			enabled: true,
			forgeReady: true,
			materialLots: { bronze: 1 }
		}
	}).snapshot;
}

describe('Equipment workshop runtime projection', () => {
	it('projects owned lots, compatible card visuals, loadout, and one lazy detail inspection', () => {
		const snapshot = equipmentSnapshot();
		const projection = projectEquipmentWorkshop(snapshot, '00000000-0000-4000-8000-000000000124', {
			inspectDefinitionId: 'equipment-bronze-sword'
		});

		expect(projection.catalog.initialEquipmentBinaryBytes).toBe(0);
		expect(projection.materials).toEqual([
			expect.objectContaining({ materialId: 'bronze', lots: 1, rank: 'F' })
		]);
		expect(projection.definitions).toHaveLength(10);
		expect(projection.definitions.every((definition) => definition.card.width <= 256)).toBe(true);
		expect(projection.inspection).toMatchObject({
			definitionId: 'equipment-bronze-sword',
			finalRank: 'F',
			detail: { width: 512 }
		});
		expect(projection.inventory).toHaveLength(2);
		expect(Object.keys(projection.loadout)).toEqual([
			'main-hand',
			'off-hand',
			'head',
			'torso',
			'legs',
			'boots'
		]);
		const { publicProjectionHash, ...publicFields } = projection;
		expect(publicProjectionHash).toBe(hashPublicProjection('equipment-workshop', publicFields));
	});

	it('rejects missing runtime aliases before a projection can escape', () => {
		const changed = structuredClone(runtimeVisualManifest);
		changed.bundles[0]!.assets.pop();

		expect(() =>
			resolveEquipmentVisual('equipment-v1-f-bronze-sword', { runtimeManifest: changed })
		).toThrow();
	});

	it('rejects source-hash drift against the approved record', () => {
		const changed = structuredClone(
			approvedSourceManifest
		) as unknown as EquipmentApprovedSourceManifest;
		const record = changed.records.find(
			(candidate) => candidate.assetKey === 'equipment-v1-f-bronze-sword'
		)!;
		(record.approved as { sha256: string }).sha256 = '0'.repeat(64);

		expect(() =>
			resolveEquipmentVisual('equipment-v1-f-bronze-sword', { approvedManifest: changed })
		).toThrow(/source hash drifted/u);
	});

	it('rejects full-set references as inventory art', () => {
		expect(() =>
			resolveEquipmentVisual('equipment-v1-f-bronze-heavy-armour-set-reference')
		).toThrow(/Armour-set-reference/u);
	});
});
