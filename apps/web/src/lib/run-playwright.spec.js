import { describe, expect, it } from 'vitest';

import { normalizePlaywrightArgs } from '../../scripts/run-playwright.js';

describe('Playwright argument forwarding', () => {
	it('removes only the leading package-script separator', () => {
		expect(normalizePlaywrightArgs([])).toEqual([]);
		expect(normalizePlaywrightArgs(['wiki-skill-visual-catalog.e2e.ts'])).toEqual([
			'wiki-skill-visual-catalog.e2e.ts'
		]);
		expect(normalizePlaywrightArgs(['--', 'wiki-skill-visual-catalog.e2e.ts'])).toEqual([
			'wiki-skill-visual-catalog.e2e.ts'
		]);
		expect(normalizePlaywrightArgs(['--project=chromium'])).toEqual(['--project=chromium']);
		expect(normalizePlaywrightArgs(['--', '--project=chromium'])).toEqual(['--project=chromium']);
	});
});
