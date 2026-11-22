import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('wiki links to repository art', () => {
	it('open the asset bucket copy of Git LFS art instead of GitHub', async () => {
		vi.resetModules();
		vi.stubEnv('VITE_ASSET_BASE', 'https://assets.example.test');
		const { getWikiPage } = await import('./wiki');
		const html = getWikiPage('creatures/fauna-family-expansion')?.html ?? '';
		expect(html).toContain(
			'href="https://assets.example.test/assets/enemies/experiments/affinity-workflow-v1/candidates/gray-wolf/normal-v1.png"'
		);
		expect(html).not.toMatch(/github\.com\/jmoraispk\/summonlab\/blob\/main\/assets\/[^"]+\.png/u);
	}, 30_000); // a fresh import of the wiki module loads every Markdown page
});
