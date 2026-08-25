import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAYER_SETTINGS, normalizePlayerSettings } from './player-settings';

describe('player settings', () => {
	it('migrates the FIN-003 settings record without losing preferences', () => {
		expect(
			normalizePlayerSettings({
				motion: 'reduced',
				textScale: 'large',
				controlMode: 'countdown'
			})
		).toEqual({
			motion: 'reduced',
			textScale: 'large',
			controlMode: 'countdown',
			sound: 'muted',
			soundCaptions: true
		});
	});

	it('repairs malformed fields independently', () => {
		expect(
			normalizePlayerSettings({
				motion: 'impossible',
				textScale: 'compact',
				controlMode: 'wait',
				sound: 'ambient',
				soundCaptions: false
			})
		).toEqual({
			...DEFAULT_PLAYER_SETTINGS,
			textScale: 'compact',
			sound: 'ambient',
			soundCaptions: false
		});
	});
});
