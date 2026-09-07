import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import CharacterArtMissing from './CharacterArtMissing.svelte';

describe('missing character art', () => {
	it('renders an honest labeled absence instead of a character depiction', () => {
		const { body } = render(CharacterArtMissing, {
			props: { label: 'The Master' }
		});

		expect(body).toContain('Art pending');
		expect(body).toContain('The Master');
		expect(body).toContain('data-character-art-status="missing"');
		expect(body).not.toMatch(/<(?:img|svg|canvas)\b/u);
		expect(body).not.toContain('role="img"');
		expect(body).not.toMatch(/[✦♟♞👤]/u);
	});
});
