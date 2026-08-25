import type { CampaignControlMode } from '@summonlab/contracts';

export type PlayerMotionPreference = 'system' | 'full' | 'reduced';
export type PlayerTextScale = 'compact' | 'standard' | 'large';

export interface PlayerSettings {
	readonly motion: PlayerMotionPreference;
	readonly textScale: PlayerTextScale;
	readonly controlMode: CampaignControlMode;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
	motion: 'system',
	textScale: 'standard',
	controlMode: 'wait'
};

const STORAGE_KEY = 'summonlab.player-settings.v1';

function isSettings(value: unknown): value is PlayerSettings {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<PlayerSettings>;
	return (
		['system', 'full', 'reduced'].includes(candidate.motion ?? '') &&
		['compact', 'standard', 'large'].includes(candidate.textScale ?? '') &&
		['wait', 'countdown'].includes(candidate.controlMode ?? '')
	);
}

export function applyPlayerSettings(settings: PlayerSettings): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.playerMotion = settings.motion;
	document.documentElement.dataset.playerText = settings.textScale;
}

export function loadPlayerSettings(): PlayerSettings {
	if (typeof localStorage === 'undefined') return DEFAULT_PLAYER_SETTINGS;
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		const settings = isSettings(parsed) ? parsed : DEFAULT_PLAYER_SETTINGS;
		applyPlayerSettings(settings);
		return settings;
	} catch {
		applyPlayerSettings(DEFAULT_PLAYER_SETTINGS);
		return DEFAULT_PLAYER_SETTINGS;
	}
}

export function savePlayerSettings(settings: PlayerSettings): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}
	applyPlayerSettings(settings);
}
