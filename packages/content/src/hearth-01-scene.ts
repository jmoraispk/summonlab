import {
	SettlementSceneDefinitionSchema,
	type SettlementSceneDefinition
} from '@summonlab/contracts';

import { HEARTH_01_CONTENT_VERSION } from './hearth-01.js';

export const HEARTH_01_SCENE_VERSION = 'hearth-01-scene-v2';

const HEARTH_01_SCENE_SOURCE = {
	schemaVersion: 'settlement-scene-v2',
	sceneVersion: HEARTH_01_SCENE_VERSION,
	status: 'approval-candidate',
	settlementContentVersion: HEARTH_01_CONTENT_VERSION,
	settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
	camera: 'high-three-quarter',
	createdAt: '2026-09-09T19:56:00Z',
	generation: {
		mode: 'built-in-imagegen',
		prompt:
			'Use case: stylized-concept\nAsset type: production environment base plate for the Summonlab Hearth 01 Village runtime\nInput images: Image 1 is the authoritative spatial composition and facility-placement reference; Image 2 is the visual-style, material, lighting, camera, and environment-rendering reference.\nPrimary request: Create a new hero-free, UI-free 1536×1024 high-three-quarter dark-fantasy game environment base plate for a humble but complete tier-one Village.\nScene/backdrop: A compact fortified mountain refuge at blue-hour night. Preserve the accepted five-place composition: standalone glowing Tower Portal centered at the rear wall; modest Summoning Circle upper left; one larger Residence lower left with subtle hearth and communal-kitchen cues but no separate kitchen building; open Training Grounds upper right; working Forge lower right. One broad cobbled central road runs from foreground to the rear Portal, with exactly four clear branches to the side facilities.\nStyle/medium: premium painterly dark-fantasy game environment with controlled linework and readable silhouettes, midnight-navy stone, worn timber, soot, localized ember-gold habitation light, and cool cyan magical accents.\nComposition/framing: all destinations and entrances fully readable; generous unobstructed walkable ground for code-rendered characters; stable plots with breathing room; no cropped facility.\nEnvironmental detail: irregular grass verges, worn-earth shoulders, field stones, herb beds, timber, barrels, laundry, low fencing, and restrained practical clutter. Starting Village density only.\nConstraints: no people, no characters, no heroes, no monsters, no crowds, no labels, no text, no callout lines, no icons, no navigation, no panels, no logo, no watermark, no physical tower, no separate kitchen building, and no large central obstruction.',
		references: [
			{
				file: 'assets/settlements/hearth-01/hearth-01-environment-v1.png',
				contentHash: '2913be0a1cabf22002baadccd1eed42bffee86e5bfa06ed06e5f09cdc6674f2e',
				role: 'visual-style'
			},
			{
				file: 'docs/design-proposals/living-village-ui/mockups/village-balanced-cozy-layout-desktop-v4.png',
				contentHash: '40d69063975515799ca7f871e4debc1efacc46441f6a8424cda5a4cad768780a',
				role: 'spatial-layout'
			}
		]
	},
	source: {
		file: 'assets/settlements/hearth-01/hearth-01-threshold-v2.png',
		width: 1536,
		height: 1024,
		bytes: 3_460_720,
		contentHash: '816d32574f07f55b58b42f19347831e8ce040463022756646b5d0f0c62a5c748'
	},
	runtime: {
		file: 'apps/web/static/runtime/settlements/hearth-01/environment.931d862928be.webp',
		publicPath: '/runtime/settlements/hearth-01/environment.931d862928be.webp',
		width: 1536,
		height: 1024,
		bytes: 555_376,
		contentHash: '931d862928bee025fd529c22ab02799bba2bfacb3e3be9eb576b1292a220c727',
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
			bounds: { x: 0.1, y: 0.14, width: 0.3, height: 0.3 },
			labelAnchor: { x: 0.16, y: 0.2 },
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
			label: 'Tower Portal',
			target: { kind: 'village-mode', mode: 'tower' },
			center: { x: 0.5, y: 0.2 },
			bounds: { x: 0.4, y: 0.06, width: 0.2, height: 0.24 },
			labelAnchor: { x: 0.52, y: 0.09 },
			labelPlacement: 'below-right',
			labelPriority: 5
		}
	],
	nodeProjections: [
		{ nodeId: 'gate-dais', point: { x: 0.27, y: 0.29 } },
		{ nodeId: 'gate-court', point: { x: 0.33, y: 0.42 } },
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
	sceneHash: '349343dac24f3708bfc7462c6274af1c84880de067b23d1b0968cd435341a70b'
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
