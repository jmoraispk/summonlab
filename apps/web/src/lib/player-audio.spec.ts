import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { captionForSoundCue, soundProfileForPath } from './player-audio';

describe('player audio presentation routing', () => {
	it.each([
		['/', 'title'],
		['/village', 'hearth'],
		['/residents', 'hearth'],
		['/tower', 'hearth'],
		['/inventory', 'hearth'],
		['/missions', 'hearth'],
		['/onboarding/run-1', 'silence'],
		['/play/run-1', 'silence'],
		['/mission/run-1', 'tower'],
		['/forge', 'silence']
	] as const)('maps %s to the %s soundscape', (pathname, profile) => {
		expect(soundProfileForPath(pathname)).toBe(profile);
	});

	it('keeps every decorative cue paired with readable text', () => {
		expect(captionForSoundCue('gate')).toContain('summoning rings');
		expect(captionForSoundCue('warning')).toContain('warning');
	});

	it('keeps restart navigation on the canonical Village path', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		const menu = readFileSync(
			`${repositoryRoot}/apps/web/src/lib/components/PlayerMenu.svelte`,
			'utf8'
		);
		expect(menu).toContain("goto(resolve('/village'))");
		expect(menu).not.toContain("startsWith('/play/')");
		expect(menu).not.toContain("resolve('/onboarding/[runId]'");
	});
});
