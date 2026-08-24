import {
	SettlementSceneDefinitionSchema,
	type SettlementSceneDefinition
} from '@summonlab/contracts';

import { HEARTH_01_CONTENT_VERSION } from './hearth-01.js';

export const HEARTH_01_SCENE_VERSION = 'hearth-01-scene-v1';

const HEARTH_01_SCENE_SOURCE = {
	schemaVersion: 'settlement-scene-v1',
	sceneVersion: HEARTH_01_SCENE_VERSION,
	status: 'approval-candidate',
	settlementContentVersion: HEARTH_01_CONTENT_VERSION,
	settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
	camera: 'high-three-quarter',
	createdAt: '2026-08-24T08:50:00Z',
	generation: {
		mode: 'built-in-imagegen',
		prompt:
			"Use case: stylized-concept\nAsset type: layered 2.5D game environment base plate for Summonlab Hearth 01\nInput images: Image 1 is the visual-quality, camera, material, palette, and lighting reference only; Image 2 is the authoritative spatial-layout reference only, specifically its five-place route map near the top.\nPrimary request: generate a new hero-free Hearth 01 settlement environment whose building arrangement matches the route topology exactly.\nScene/backdrop: compact hexagonal walled refuge at blue hour. The monumental cyan-and-ember summoning gate is at the north/top center. The common kitchen is west/upper-left. The dormant workshop is east/upper-right. The north dormitory is southwest/lower-left. The open training court is southeast/lower-right. A broad shared courtyard occupies the center, with visibly continuous cobblestone walking paths connecting all five places and no central obstruction.\nSubject: all five buildings must have distinct silhouettes and readable entrances: kitchen with hearth chimney and warm service windows; workshop with cold forge flue, repair awning, and tool racks; dormitory as a long quieter bunkhouse with curtained windows; training court as open sand with targets and practice racks; gate as monumental arcane machinery.\nStyle/medium: original premium painterly dark-fantasy game environment, manhwa-like clarity and controlled linework, matching Image 1's material richness without copying characters or UI.\nComposition/framing: wide 3:2 high-three-quarter view, full settlement inside the walls, enough clear ground for route overlays and small code-rendered hero sprites, strong depth separation between distant wall/gate, inhabited midground buildings, and foreground fence/props.\nLighting/mood: deep midnight navy stone, worn wood and soot, cool cyan rim light at the gate, localized amber habitation light at kitchen and dormitory, workshop mostly cold/dormant, training court readable but restrained, subtle mist and atmospheric depth.\nConstraints: no people, no characters, no monsters, no UI, no labels, no text, no logo, no watermark; exactly five functional places in the specified positions; do not place the dormitory at upper right or workshop at lower left; keep the central courtyard and path network unobstructed.",
		references: [
			{
				file: 'assets/heroes/visuals/hearth-settlement-scale-v1.png',
				contentHash: '555bd154e5914663dfdd7c4b37e97d1b68207f42f859af916b895eb0ed41a870',
				role: 'visual-style'
			},
			{
				file: 'docs/evidence/phase-4-settlement-route-lab-mobile.png',
				contentHash: 'c665d80fcd09137aff660d100e5180a6e47dc183da62bc5344ab6434a52f7652',
				role: 'spatial-layout'
			}
		]
	},
	source: {
		file: 'assets/settlements/hearth-01/hearth-01-environment-v1.png',
		width: 1536,
		height: 1024,
		bytes: 2_722_235,
		contentHash: '2913be0a1cabf22002baadccd1eed42bffee86e5bfa06ed06e5f09cdc6674f2e'
	},
	runtime: {
		file: 'apps/web/static/runtime/settlements/hearth-01/environment.96cbb666f3d9.webp',
		publicPath: '/runtime/settlements/hearth-01/environment.96cbb666f3d9.webp',
		width: 1536,
		height: 1024,
		bytes: 296_168,
		contentHash: '96cbb666f3d97e661be6ab6422309136d5071c78a35917c53c15515b326258c5',
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
			buildingId: 'summoning-gate',
			entranceNodeId: 'gate-court',
			center: { x: 0.5, y: 0.28 },
			bounds: { x: 0.36, y: 0.02, width: 0.28, height: 0.31 }
		},
		{
			buildingId: 'kitchen',
			entranceNodeId: 'kitchen-entry',
			center: { x: 0.32, y: 0.4 },
			bounds: { x: 0.05, y: 0.14, width: 0.36, height: 0.34 }
		},
		{
			buildingId: 'workshop',
			entranceNodeId: 'workshop-entry',
			center: { x: 0.67, y: 0.4 },
			bounds: { x: 0.62, y: 0.15, width: 0.32, height: 0.34 }
		},
		{
			buildingId: 'dormitory',
			entranceNodeId: 'dormitory-entry',
			center: { x: 0.35, y: 0.68 },
			bounds: { x: 0.01, y: 0.48, width: 0.4, height: 0.37 }
		},
		{
			buildingId: 'training-ground',
			entranceNodeId: 'training-entry',
			center: { x: 0.72, y: 0.68 },
			bounds: { x: 0.56, y: 0.49, width: 0.4, height: 0.37 }
		}
	],
	nodeProjections: [
		{ nodeId: 'gate-dais', point: { x: 0.5, y: 0.25 } },
		{ nodeId: 'gate-court', point: { x: 0.5, y: 0.35 } },
		{ nodeId: 'gate-rail', point: { x: 0.47, y: 0.33 } },
		{ nodeId: 'courtyard-heart', point: { x: 0.5, y: 0.52 } },
		{ nodeId: 'cistern-steps', point: { x: 0.42, y: 0.56 } },
		{ nodeId: 'wall-overlook', point: { x: 0.56, y: 0.57 } },
		{ nodeId: 'kitchen-entry', point: { x: 0.34, y: 0.45 } },
		{ nodeId: 'kitchen-hearth', point: { x: 0.2, y: 0.35 } },
		{ nodeId: 'kitchen-table', point: { x: 0.28, y: 0.4 } },
		{ nodeId: 'dormitory-entry', point: { x: 0.36, y: 0.68 } },
		{ nodeId: 'dormitory-bunks', point: { x: 0.23, y: 0.7 } },
		{ nodeId: 'dormitory-nook', point: { x: 0.34, y: 0.75 } },
		{ nodeId: 'training-entry', point: { x: 0.58, y: 0.63 } },
		{ nodeId: 'training-ring', point: { x: 0.72, y: 0.7 } },
		{ nodeId: 'training-rack', point: { x: 0.86, y: 0.58 } },
		{ nodeId: 'workshop-entry', point: { x: 0.65, y: 0.43 } },
		{ nodeId: 'workshop-bench', point: { x: 0.75, y: 0.36 } },
		{ nodeId: 'workshop-forge', point: { x: 0.85, y: 0.3 } }
	],
	sceneHash: 'c88d39611eee5b3939008da8353e3625ac97615c01e24cd9de5c191e80eb06bc'
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
