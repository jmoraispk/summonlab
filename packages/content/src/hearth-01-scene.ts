import {
	SettlementSceneDefinitionSchema,
	type SettlementSceneDefinition
} from '@summonlab/contracts';

import { HEARTH_01_CONTENT_VERSION } from './hearth-01.js';

export const HEARTH_01_SCENE_VERSION = 'hearth-01-scene-v3';

const HEARTH_01_SCENE_SOURCE = {
	schemaVersion: 'settlement-scene-v2',
	sceneVersion: HEARTH_01_SCENE_VERSION,
	status: 'approval-candidate',
	settlementContentVersion: HEARTH_01_CONTENT_VERSION,
	settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
	camera: 'high-three-quarter',
	createdAt: '2026-09-09T22:21:03Z',
	generation: {
		mode: 'built-in-imagegen',
		prompt:
			'Use case: precise-object-edit\nAsset type: Summonlab Hearth 01 Village environment revision\nInput image: Image 1 is the edit target and authoritative reference for every unaffected feature.\nPrimary request: At the fully zoomed-out fitted view, make the Village outer perimeter wall read as one continuous rough circle or perspective ellipse. Remove the inward dent in the upper-left wall behind the Summoning Circle. Continue that wall as an uninterrupted outward-convex arc from the left side through the upper-left district toward the rear Portal, matching the smooth circular character of the right wall. The Summoning Circle must not push, dent, notch, or bulge the perimeter wall. Move the Summoning Circle slightly inward and toward the foreground only as much as needed to leave clear ground between it and the circular wall, then reconnect its short path and immediate lamps, vegetation, and retaining stones.\nConstraints: Preserve the camera, framing, mountains, moon, Portal, central road, Residence, Training Grounds, Forge, lighting, palette, scale, paths, props, and all pixels outside the necessary upper-left correction as closely as possible. Keep the full perimeter readable at fitted zoom. Do not add or remove buildings, people, characters, animals, labels, text, UI, icons, panels, or watermarks.',
		references: [
			{
				file: 'assets/settlements/hearth-01/experiments/city-circular-wall-v1/hearth-01-circular-wall-candidate.png',
				contentHash: '26a092776068692022986907e363fab0ab738b8b8da3408aecfe114460169e1e',
				role: 'visual-style'
			},
			{
				file: 'assets/settlements/hearth-01/hearth-01-threshold-v2.png',
				contentHash: '816d32574f07f55b58b42f19347831e8ce040463022756646b5d0f0c62a5c748',
				role: 'spatial-layout'
			}
		]
	},
	source: {
		file: 'assets/settlements/hearth-01/hearth-01-threshold-v3.png',
		width: 1536,
		height: 1024,
		bytes: 3_092_258,
		contentHash: '02bb8a592627641e400d56fd94863aca52f2d45f9244475f9319b343a89fa1d1'
	},
	runtime: {
		file: 'apps/web/static/runtime/settlements/hearth-01/environment.bce003169755.webp',
		publicPath: '/runtime/settlements/hearth-01/environment.bce003169755.webp',
		width: 1536,
		height: 1024,
		bytes: 447_374,
		contentHash: 'bce003169755e70b215698ba5f68b513802b410ca7e46592b21d425882d9f595',
		budgetBytes: 1_500_000,
		budgetStatus: 'within-budget',
		decodedRgbaBytes: 6_291_456,
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
		{
			layerId: 'environment-base',
			kind: 'bitmap-base',
			depth: 0,
			motion: 'static',
			reducedMotion: 'unchanged',
			description: 'Hero-free, topology-aligned architectural base plate.'
		},
		{
			layerId: 'atmosphere-depth',
			kind: 'code-atmosphere',
			depth: 1,
			motion: 'ambient',
			reducedMotion: 'frozen',
			description: 'Slow mist and depth falloff that never obscures an entrance.'
		},
		{
			layerId: 'localized-light',
			kind: 'code-illumination',
			depth: 2,
			motion: 'ambient',
			reducedMotion: 'frozen',
			description: 'Cyan gate resonance and amber inhabited-building light.'
		},
		{
			layerId: 'route-preview',
			kind: 'code-route',
			depth: 3,
			motion: 'reactive',
			reducedMotion: 'unchanged',
			description: 'Projected route evidence derived from the selected deterministic plan.'
		},
		{
			layerId: 'activity-silhouettes',
			kind: 'code-activity',
			depth: 4,
			motion: 'ambient',
			reducedMotion: 'frozen',
			description: 'Non-authoritative scale silhouettes reserved for later hero activity.'
		},
		{
			layerId: 'building-interface',
			kind: 'code-interface',
			depth: 5,
			motion: 'reactive',
			reducedMotion: 'unchanged',
			description: 'Keyboard-accessible building hotspots and state labels.'
		}
	],
	hotspots: [
		{
			facilityId: 'summoning-circle',
			label: 'Summoning Circle',
			target: {
				kind: 'settlement-buildings',
				buildingIds: ['summoning-gate'],
				entranceNodeIds: ['gate-court']
			},
			center: { x: 0.27, y: 0.3 },
			bounds: { x: 0.15, y: 0.21, width: 0.24, height: 0.2 },
			labelAnchor: { x: 0.18, y: 0.24 },
			labelPlacement: 'above-right',
			labelPriority: 4
		},
		{
			facilityId: 'residence',
			label: 'Residence',
			target: {
				kind: 'settlement-buildings',
				buildingIds: ['kitchen', 'dormitory'],
				entranceNodeIds: ['kitchen-entry', 'dormitory-entry']
			},
			center: { x: 0.25, y: 0.68 },
			bounds: { x: 0.03, y: 0.46, width: 0.39, height: 0.36 },
			labelAnchor: { x: 0.12, y: 0.52 },
			labelPlacement: 'above-right',
			labelPriority: 2
		},
		{
			facilityId: 'training-grounds',
			label: 'Training Grounds',
			target: {
				kind: 'settlement-buildings',
				buildingIds: ['training-ground'],
				entranceNodeIds: ['training-entry']
			},
			center: { x: 0.77, y: 0.34 },
			bounds: { x: 0.62, y: 0.17, width: 0.34, height: 0.3 },
			labelAnchor: { x: 0.87, y: 0.21 },
			labelPlacement: 'above-left',
			labelPriority: 3
		},
		{
			facilityId: 'forge',
			label: 'Forge',
			target: {
				kind: 'settlement-buildings',
				buildingIds: ['workshop'],
				entranceNodeIds: ['workshop-entry']
			},
			center: { x: 0.76, y: 0.69 },
			bounds: { x: 0.59, y: 0.47, width: 0.38, height: 0.36 },
			labelAnchor: { x: 0.89, y: 0.54 },
			labelPlacement: 'above-left',
			labelPriority: 1
		},
		{
			facilityId: 'tower-portal',
			label: 'Portal',
			target: { kind: 'village-mode', mode: 'tower' },
			center: { x: 0.5, y: 0.2 },
			bounds: { x: 0.4, y: 0.06, width: 0.2, height: 0.24 },
			labelAnchor: { x: 0.5, y: 0.17 },
			labelPlacement: 'below-right',
			labelPriority: 5
		}
	],
	nodeProjections: [
		{ nodeId: 'gate-dais', point: { x: 0.27, y: 0.29 } },
		{ nodeId: 'gate-court', point: { x: 0.33, y: 0.41 } },
		{ nodeId: 'gate-rail', point: { x: 0.22, y: 0.35 } },
		{ nodeId: 'courtyard-heart', point: { x: 0.5, y: 0.53 } },
		{ nodeId: 'cistern-steps', point: { x: 0.45, y: 0.58 } },
		{ nodeId: 'wall-overlook', point: { x: 0.55, y: 0.42 } },
		{ nodeId: 'kitchen-entry', point: { x: 0.36, y: 0.63 } },
		{ nodeId: 'kitchen-hearth', point: { x: 0.2, y: 0.68 } },
		{ nodeId: 'kitchen-table', point: { x: 0.27, y: 0.72 } },
		{ nodeId: 'dormitory-entry', point: { x: 0.33, y: 0.67 } },
		{ nodeId: 'dormitory-bunks', point: { x: 0.2, y: 0.72 } },
		{ nodeId: 'dormitory-nook', point: { x: 0.29, y: 0.76 } },
		{ nodeId: 'training-entry', point: { x: 0.66, y: 0.44 } },
		{ nodeId: 'training-ring', point: { x: 0.77, y: 0.34 } },
		{ nodeId: 'training-rack', point: { x: 0.86, y: 0.31 } },
		{ nodeId: 'workshop-entry', point: { x: 0.64, y: 0.64 } },
		{ nodeId: 'workshop-bench', point: { x: 0.75, y: 0.7 } },
		{ nodeId: 'workshop-forge', point: { x: 0.82, y: 0.67 } }
	],
	sceneHash: '4dea1551545f6820778eed52e7fd37396124874d2c49b3252ec6a2c307d4d313'
} as const;

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculateSettlementSceneHash(
	scene: SettlementSceneDefinition
): Promise<string> {
	const payload: Partial<SettlementSceneDefinition> = { ...scene };
	delete payload.sceneHash;
	const bytes = new TextEncoder().encode(canonicalJson(payload));
	const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

let verifiedScene: Promise<SettlementSceneDefinition> | undefined;

export function loadHearth01Scene(): Promise<SettlementSceneDefinition> {
	verifiedScene ??= (async () => {
		const scene = SettlementSceneDefinitionSchema.parse(HEARTH_01_SCENE_SOURCE);
		const hash = await calculateSettlementSceneHash(scene);
		if (hash !== scene.sceneHash) throw new Error(`Hearth 01 scene hash mismatch: ${hash}`);
		return deepFreeze(scene);
	})();
	return verifiedScene;
}
