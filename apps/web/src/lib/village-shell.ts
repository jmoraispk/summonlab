export const VILLAGE_MODES = [
	{ id: 'village', label: 'Village', route: '/play/[runId]' },
	{ id: 'residents', label: 'Residents', route: '/play/[runId]?mode=residents' },
	{ id: 'inventory', label: 'Inventory', route: '/play/[runId]?mode=inventory' },
	{ id: 'missions', label: 'Missions', route: '/play/[runId]?mode=missions' }
] as const;

export type VillageMode = (typeof VILLAGE_MODES)[number]['id'];

export interface VillageResidentArt {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
}

export interface VillageResident {
	readonly heroId: string;
	readonly ordinal: number;
	readonly name: string;
	readonly rarityStars: number;
	readonly pronouns: string;
	readonly role: string;
	readonly activity: string;
	readonly location: string;
	readonly relationship: string;
	readonly authority: string;
	readonly beliefCount: number;
	readonly latestObservation: string | null;
	readonly firstReply: string | null;
	readonly portrait: VillageResidentArt | null;
	readonly sceneArt: VillageResidentArt | null;
}

const VILLAGE_MODE_IDS = new Set<string>(VILLAGE_MODES.map((mode) => mode.id));

export function parseVillageMode(value: string | null): VillageMode {
	return value !== null && VILLAGE_MODE_IDS.has(value) ? (value as VillageMode) : 'village';
}
