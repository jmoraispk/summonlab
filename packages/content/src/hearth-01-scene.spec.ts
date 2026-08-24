import { SettlementSceneDefinitionSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { loadHearth01 } from './hearth-01.js';
import { calculateSettlementSceneHash, loadHearth01Scene } from './hearth-01-scene.js';

describe('Hearth 01 layered scene', () => {
	it('binds an immutable approval candidate to the exact settlement content', async () => {
		const [settlement, scene] = await Promise.all([loadHearth01(), loadHearth01Scene()]);

		expect(scene.status).toBe('approval-candidate');
		expect(scene.settlementContentVersion).toBe(settlement.contentVersion);
		expect(scene.settlementContentHash).toBe(settlement.contentHash);
		expect(await calculateSettlementSceneHash(scene)).toBe(scene.sceneHash);
		expect(scene.layers.map((layer) => layer.kind)).toEqual([
			'bitmap-base',
			'code-atmosphere',
			'code-illumination',
			'code-route',
			'code-activity',
			'code-interface'
		]);
		expect(scene.runtime.bytes).toBeLessThanOrEqual(scene.runtime.budgetBytes);
		expect(Object.isFrozen(scene)).toBe(true);
		expect(Object.isFrozen(scene.nodeProjections[0])).toBe(true);
	});

	it('projects every authored building and node exactly once', async () => {
		const [settlement, scene] = await Promise.all([loadHearth01(), loadHearth01Scene()]);

		expect(scene.hotspots.map((hotspot) => hotspot.buildingId).sort()).toEqual(
			settlement.buildings.map((building) => building.buildingId).sort()
		);
		expect(scene.hotspots.map((hotspot) => hotspot.entranceNodeId).sort()).toEqual(
			settlement.buildings.map((building) => building.entranceNodeId).sort()
		);
		expect(scene.nodeProjections.map((projection) => projection.nodeId).sort()).toEqual(
			settlement.nodes.map((node) => node.nodeId).sort()
		);
	});

	it('rejects hotspots that escape the rendered canvas', async () => {
		const scene = structuredClone(await loadHearth01Scene());
		scene.hotspots[0]!.bounds = { x: 0.9, y: 0.02, width: 0.28, height: 0.31 };
		expect(SettlementSceneDefinitionSchema.safeParse(scene).success).toBe(false);
	});
});
