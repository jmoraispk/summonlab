import { describe, expect, it } from 'vitest';

import { captionForSoundCue, soundProfileForPath } from './player-audio';

describe('player audio presentation routing', () => {
	it.each([
		['/', 'title'],
		['/onboarding/run-1', 'gate'],
		['/play/run-1', 'hearth'],
		['/mission/run-1', 'tower'],
		['/forge', 'silence']
	] as const)('maps %s to the %s soundscape', (pathname, profile) => {
		expect(soundProfileForPath(pathname)).toBe(profile);
	});

	it('keeps every decorative cue paired with readable text', () => {
		expect(captionForSoundCue('gate')).toContain('summoning rings');
		expect(captionForSoundCue('warning')).toContain('warning');
	});
});
