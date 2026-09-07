import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import MissionHeroRosterArt from './MissionHeroRosterArt.svelte';

describe('mission hero roster art', () => {
	it('shows an honest non-character missing-art state for an unresolved v25 asset', () => {
		const { body } = render(MissionHeroRosterArt, {
			props: {
				isCapabilityMission: true,
				name: 'Aear Soro',
				portrait: null
			}
		});

		expect(body).toContain('data-testid="hero-roster-art-missing"');
		expect(body).toContain('data-character-art-status="missing"');
		expect(body).toContain('Art pending');
		expect(body).not.toContain('role="img"');
		expect(body).not.toContain('hero-art-placeholder');
		expect(body).not.toContain('✦');
	});

	it('keeps the decorative legacy placeholder within the explicit historical branch', () => {
		const { body } = render(MissionHeroRosterArt, {
			props: {
				isCapabilityMission: false,
				name: 'Legacy Hero',
				portrait: null
			}
		});

		expect(body).toContain('data-testid="hero-art-placeholder"');
		expect(body).toContain('role="img"');
		expect(body).toContain('✦');
	});
});
