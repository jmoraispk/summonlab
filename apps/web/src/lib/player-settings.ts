import type { CampaignControlMode } from '@summonlab/contracts';

export type PlayerMotionPreference = 'system' | 'full' | 'reduced';
export type PlayerTextScale = 'compact' | 'standard' | 'large';
export type PlayerSoundPreference = 'muted' | 'ambient' | 'full';

export interface PlayerSettings {
	readonly motion: PlayerMotionPreference;
	readonly textScale: PlayerTextScale;
	readonly controlMode: CampaignControlMode;
	readonly sound: PlayerSoundPreference;
	readonly soundCaptions: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
	motion: 'system',
	textScale: 'standard',
	controlMode: 'wait',
	sound: 'muted',
	soundCaptions: true
};

export const PLAYER_SETTINGS_EVENT = 'summonlab:player-settings';
export const PLAYER_SETTINGS_STORAGE_KEY = 'summonlab.player-settings.v2';
const LEGACY_STORAGE_KEY = 'summonlab.player-settings.v1';

export function normalizePlayerSettings(value: unknown): PlayerSettings {
	if (!value || typeof value !== 'object') return DEFAULT_PLAYER_SETTINGS;
	const candidate = value as Partial<PlayerSettings>;
	return {
		motion: ['system', 'full', 'reduced'].includes(candidate.motion ?? '')
			? candidate.motion!
			: DEFAULT_PLAYER_SETTINGS.motion,
		textScale: ['compact', 'standard', 'large'].includes(candidate.textScale ?? '')
			? candidate.textScale!
			: DEFAULT_PLAYER_SETTINGS.textScale,
		controlMode: ['wait', 'countdown'].includes(candidate.controlMode ?? '')
			? candidate.controlMode!
			: DEFAULT_PLAYER_SETTINGS.controlMode,
		sound: ['muted', 'ambient', 'full'].includes(candidate.sound ?? '')
			? candidate.sound!
			: DEFAULT_PLAYER_SETTINGS.sound,
		soundCaptions:
			typeof candidate.soundCaptions === 'boolean'
				? candidate.soundCaptions
				: DEFAULT_PLAYER_SETTINGS.soundCaptions
	};
}

export function applyPlayerSettings(settings: PlayerSettings): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.playerMotion = settings.motion;
	document.documentElement.dataset.playerText = settings.textScale;
	document.documentElement.dataset.playerSound = settings.sound;
	document.documentElement.dataset.playerSoundCaptions = settings.soundCaptions
		? 'visible'
		: 'hidden';
}

export function loadPlayerSettings(): PlayerSettings {
	if (typeof localStorage === 'undefined') return DEFAULT_PLAYER_SETTINGS;
	try {
		const serialized =
			localStorage.getItem(PLAYER_SETTINGS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
		const settings = normalizePlayerSettings(JSON.parse(serialized ?? 'null'));
		applyPlayerSettings(settings);
		return settings;
	} catch {
		applyPlayerSettings(DEFAULT_PLAYER_SETTINGS);
		return DEFAULT_PLAYER_SETTINGS;
	}
}

export function savePlayerSettings(settings: PlayerSettings): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(PLAYER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	}
	applyPlayerSettings(settings);
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent<PlayerSettings>(PLAYER_SETTINGS_EVENT, { detail: settings })
		);
	}
}
