import { describe, expect, it } from 'vitest';

import { SettlementSceneDefinitionSchema } from './index.js';

const hash = 'a'.repeat(64);

function validScene() {
	return {
		schemaVersion: 'settlement-scene-v2',
		sceneVersion: 'hearth-01-scene-v2',
		status: 'approval-candidate',
		settlementContentVersion: 'hearth-01-v1',
		settlementContentHash: hash,
		camera: 'high-three-quarter',
		createdAt: '2026-09-09T00:00:00.000Z',
		generation: {
			mode: 'built-in-imagegen',
			prompt: 'A hero-free, UI-free tier-one settlement.',
			references: [
				{ file: 'assets/settlements/hearth-01/style.png', contentHash: hash, role: 'visual-style' },
				{ file: 'docs/evidence/layout.png', contentHash: hash, role: 'spatial-layout' }
			]
		},
		source: {
			file: 'assets/settlements/hearth-01/source.png',
			width: 1536,
			height: 1024,
			bytes: 100,
			contentHash: hash
		},
		runtime: {
			file: 'apps/web/static/runtime/settlements/hearth-01/environment.aaaaaaaaaaaa.webp',
			publicPath: '/runtime/settlements/hearth-01/environment.aaaaaaaaaaaa.webp',
			width: 1536,
			height: 1024,
			bytes: 80,
			contentHash: hash,
			budgetBytes: 1_500_000,
			budgetStatus: 'within-budget',
			decodedRgbaBytes: 1536 * 1024 * 4,
			decodedMemoryBudgetBytes: 64_000_000,
			decodedMemoryStatus: 'within-budget',
			encoder: {
				format: 'webp',
				quality: 86,
				effort: 6,
				preset: 'picture',
				smartSubsample: true,
				metadata: 'stripped'
			}
		},
		layers: [
			['base', 'bitmap-base', 0, 'static', 'unchanged'],
			['atmosphere', 'code-atmosphere', 1, 'ambient', 'frozen'],
			['illumination', 'code-illumination', 2, 'ambient', 'frozen'],
			['route', 'code-route', 3, 'reactive', 'unchanged'],
			['activity', 'code-activity', 4, 'ambient', 'frozen'],
			['interface', 'code-interface', 5, 'reactive', 'unchanged']
		].map(([layerId, kind, depth, motion, reducedMotion]) => ({
			layerId,
			kind,
			depth,
			motion,
			reducedMotion,
			description: `${layerId} layer`
		})),
		hotspots: [
			facility('summoning-circle', 'Summoning Circle', {
				kind: 'settlement-buildings',
				buildingIds: ['summoning-gate'],
				entranceNodeIds: ['gate-court']
			}),
			facility('residence', 'Residence', {
				kind: 'settlement-buildings',
				buildingIds: ['kitchen', 'dormitory'],
				entranceNodeIds: ['kitchen-entry', 'dormitory-entry']
			}),
			facility('training-grounds', 'Training Grounds', {
				kind: 'settlement-buildings',
				buildingIds: ['training-ground'],
				entranceNodeIds: ['training-entry']
			}),
			facility('forge', 'Forge', {
				kind: 'settlement-buildings',
				buildingIds: ['workshop'],
				entranceNodeIds: ['workshop-entry']
			}),
			facility('tower-portal', 'Tower Portal', { kind: 'village-mode', mode: 'tower' })
		],
		nodeProjections: Array.from({ length: 15 }, (_, index) => ({
			nodeId: `route-node-${index}`,
			point: { x: 0.5, y: 0.5 }
		})),
		sceneHash: hash
	};
}

function facility(facilityId: string, label: string, target: Record<string, unknown>) {
	return {
		facilityId,
		label,
		target,
		center: { x: 0.5, y: 0.5 },
		bounds: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
		labelAnchor: { x: 0.45, y: 0.45 },
		labelPlacement: 'above-left',
		labelPriority: 3
	};
}

describe('settlement scene v2 visual facilities', () => {
	it('accepts the five approved facilities with a composite Residence and Tower mode target', () => {
		const scene = SettlementSceneDefinitionSchema.parse(validScene());

		expect(scene.hotspots.map((hotspot) => hotspot.facilityId)).toEqual([
			'summoning-circle',
			'residence',
			'training-grounds',
			'forge',
			'tower-portal'
		]);
		expect(scene.hotspots.find((entry) => entry.facilityId === 'residence')?.target).toEqual({
			kind: 'settlement-buildings',
			buildingIds: ['kitchen', 'dormitory'],
			entranceNodeIds: ['kitchen-entry', 'dormitory-entry']
		});
		expect(scene.hotspots.find((entry) => entry.facilityId === 'tower-portal')?.target).toEqual({
			kind: 'village-mode',
			mode: 'tower'
		});
	});

	it.each([
		[
			'duplicate facilities',
			(scene: ReturnType<typeof validScene>) => {
				scene.hotspots[1]!.facilityId = 'summoning-circle';
			}
		],
		[
			'duplicate buildings',
			(scene: ReturnType<typeof validScene>) => {
				const target = scene.hotspots[2]!.target as { buildingIds: string[] };
				target.buildingIds = ['kitchen'];
			}
		],
		[
			'mismatched entrances',
			(scene: ReturnType<typeof validScene>) => {
				const target = scene.hotspots[1]!.target as { entranceNodeIds: string[] };
				target.entranceNodeIds = ['kitchen-entry'];
			}
		],
		[
			'Tower as a building',
			(scene: ReturnType<typeof validScene>) => {
				scene.hotspots[4]!.target = {
					kind: 'settlement-buildings',
					buildingIds: ['tower'],
					entranceNodeIds: ['tower-entry']
				};
			}
		],
		[
			'missing facility',
			(scene: ReturnType<typeof validScene>) => {
				scene.hotspots.pop();
			}
		]
	])('rejects %s', (_, mutate) => {
		const scene = validScene();
		mutate(scene);
		expect(SettlementSceneDefinitionSchema.safeParse(scene).success).toBe(false);
	});
});
