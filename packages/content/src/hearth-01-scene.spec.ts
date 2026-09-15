import { SettlementSceneDefinitionSchema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { loadHearth01 } from './hearth-01.js';
import { calculateSettlementSceneHash, loadHearth01Scene } from './hearth-01-scene.js';

describe('Hearth 01 layered scene', () => {
	it('promotes the accepted circular-wall Village and its revised Circle geometry', async () => {
		const scene = await loadHearth01Scene();
		const circle = scene.hotspots.find((hotspot) => hotspot.facilityId === 'summoning-circle');

		expect(scene.sceneVersion).toBe('hearth-01-scene-v3');
		expect(scene.source).toEqual({
			file: 'assets/settlements/hearth-01/hearth-01-threshold-v3.png',
			width: 1536,
			height: 1024,
			bytes: 3_092_258,
			contentHash: '02bb8a592627641e400d56fd94863aca52f2d45f9244475f9319b343a89fa1d1'
		});
		expect(scene.runtime).toMatchObject({
			file: 'apps/web/static/runtime/settlements/hearth-01/environment.bce003169755.webp',
			publicPath: '/runtime/settlements/hearth-01/environment.bce003169755.webp',
			width: 1536,
			height: 1024,
			bytes: 447_374,
			contentHash: 'bce003169755e70b215698ba5f68b513802b410ca7e46592b21d425882d9f595'
		});
		expect(circle).toMatchObject({
			label: 'Summoning Circle',
			center: { x: 0.27, y: 0.3 },
			bounds: { x: 0.15, y: 0.21, width: 0.24, height: 0.2 },
			labelAnchor: { x: 0.18, y: 0.24 }
		});
		expect(scene.nodeProjections.find((node) => node.nodeId === 'gate-court')?.point).toEqual({
			x: 0.33,
			y: 0.41
		});
		expect(scene.hotspots.find((hotspot) => hotspot.facilityId === 'tower-portal')?.label).toBe(
			'Portal'
		);
	});

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
		expect(
			scene.hotspots
				.flatMap((hotspot) =>
					hotspot.target.kind === 'settlement-buildings' ? hotspot.target.buildingIds : []
				)
				.sort()
		).toEqual(settlement.buildings.map((building) => building.buildingId).sort());
		expect(
			scene.hotspots
				.flatMap((hotspot) =>
					hotspot.target.kind === 'settlement-buildings' ? hotspot.target.entranceNodeIds : []
				)
				.sort()
		).toEqual(settlement.buildings.map((building) => building.entranceNodeId).sort());
		expect(scene.hotspots.find((hotspot) => hotspot.facilityId === 'tower-portal')?.target).toEqual(
			{
				kind: 'village-mode',
				mode: 'tower'
			}
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
